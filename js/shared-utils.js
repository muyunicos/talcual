/**
 * @file shared-utils.js
 * @description Utilidades compartidas entre host y player
 */

// Global dictionary cache
let dictionaryCache = null; // flattened words
let dictionaryPromise = null;
let dictionaryDataCache = null; // raw JSON
let dictionaryDataPromise = null;

// ============================================================================
// DEBUGGING
// ============================================================================

/**
 * Sistema centralizado de debugging
 * Facilita tracing sin consola.log directa
 * @param {string} message - Mensaje a loguear
 * @param {*} data - Datos adicionales (opcional)
 * @param {string} type - Tipo: 'info' (default), 'error', 'warn'
 */
function debug(message, data = null, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}]`;
    
    switch (type) {
        case 'error':
            console.error(`${prefix} ❌ ${message}`, data || '');
            break;
        case 'warn':
            console.warn(`${prefix} ⚠️ ${message}`, data || '');
            break;
        case 'info':
        default:
            console.log(`${prefix} ${message}`, data || '');
            break;
    }
}

// ============================================================================
// GESTIÓN DE TIEMPO - CON SINCRONIZACIÓN
// ============================================================================

/**
 * Obtiene el tiempo restante usando timeSync sincronizado
 * CAMBIO #3: Usa TimeSyncManager para sincronización client-servidor
 * 
 * @param {number} startTimestamp - Timestamp de inicio ronda (ms, servidor)
 * @param {number} duration - Duración en ms
 * @returns {number} Milisegundos restantes (sincronizado)
 */
function getRemainingTime(startTimestamp, duration) {
    // Si timeSync está disponible y calibrado, usar tiempo sincronizado
    if (typeof timeSync !== 'undefined' && timeSync && timeSync.isCalibrated) {
        return timeSync.getRemainingTime(startTimestamp, duration);
    }
    
    // Fallback: cálculo local (menos preciso, pero funciona)
    const now = Date.now();
    const endTime = startTimestamp + duration;
    return Math.max(0, endTime - now);
}

/**
 * Formatea milisegundos a MM:SS
 * @param {number} ms - Milisegundos
 * @returns {string} Formato MM:SS
 */
function formatTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000); // Redondear hacia arriba
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Actualiza display de timer en el DOM con feedback visual
 * CAMBIO #3: Agrega clases CSS para feedback visual
 * 
 * @param {number} ms - Milisegundos restantes
 * @param {HTMLElement} element - Elemento donde mostrar
 * @param {string} prefix - Prefijo (ej: '⏳')
 * @param {number} warningThreshold - Mostrar warning desde X ms
 */
function updateTimerDisplay(ms, element, prefix = '⏳', warningThreshold = 5000) {
    if (!element) return;
    
    const formatted = formatTime(ms);
    element.textContent = prefix ? `${prefix} ${formatted}` : formatted;
    
    // CAMBIO #3: Agregar feedback visual
    // Rojo parpadeante cuando < 5s
    if (ms <= warningThreshold && ms > 0) {
        element.classList.add('timer-warning');
        element.classList.remove('timer-expired');
    } 
    // Gris cuando se agota (0ms)
    else if (ms <= 0) {
        element.classList.add('timer-expired');
        element.classList.remove('timer-warning');
    } 
    // Normal en resto
    else {
        element.classList.remove('timer-warning');
        element.classList.remove('timer-expired');
    }
}

/**
 * Crea un timer que se ejecuta cada X ms
 * @param {Function} callback - Función a ejecutar
 * @param {number} interval - Intervalo en ms (default: 1000)
 * @returns {number} ID del intervalo
 */
function createTimer(callback, interval = 1000) {
    return setInterval(callback, interval);
}

// ============================================================================
// ALMACENAMIENTO LOCAL
// ============================================================================

// NOTA: FASE 1 - Centralización de claves/operaciones en un único lugar.
// Mantener wrappers legacy (setLocalStorage/getLocalStorage/clearGameSession)
// para evitar romper código existente.

class StorageKeys {
    static HOST_GAME_CODE = 'hostGameCode';
    static GAME_ID = 'gameId';
    static IS_HOST = 'isHost';
    static GAME_CATEGORY = 'gameCategory';

    static PLAYER_ID = 'playerId';
    static PLAYER_NAME = 'playerName';
    static PLAYER_COLOR = 'playerColor';
}

class StorageManager {
    static set(key, value) {
        try {
            const data = typeof value === 'string' ? value : JSON.stringify(value);
            localStorage.setItem(key, data);
            // Usar debug centralizado (no console.log)
            debug(`💾 Storage set: ${key}`, value, 'info');
        } catch (error) {
            debug(`❌ Storage error (set): ${key}`, error, 'error');
        }
    }

    static get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            if (!value) return defaultValue;

            // IMPORTANTE: no parsear boolean/number ("true" -> true) para no
            // romper comparaciones existentes (ej: isHost === 'true').
            const firstChar = value[0];
            if (firstChar === '{' || firstChar === '[') {
                try {
                    return JSON.parse(value);
                } catch {
                    return value;
                }
            }

            return value;
        } catch (error) {
            debug(`❌ Storage error (get): ${key}`, error, 'error');
            return defaultValue;
        }
    }

    static remove(key) {
        try {
            localStorage.removeItem(key);
            debug(`🗑️ Storage removed: ${key}`, null, 'info');
        } catch (error) {
            debug(`❌ Storage error (remove): ${key}`, error, 'error');
        }
    }

    static isHostSessionActive() {
        const code = this.get(StorageKeys.HOST_GAME_CODE);
        const isHost = this.get(StorageKeys.IS_HOST);
        return !!(code && isHost === 'true');
    }

    static clearHostSession() {
        const keys = [
            StorageKeys.HOST_GAME_CODE,
            StorageKeys.GAME_ID,
            StorageKeys.IS_HOST,
            StorageKeys.GAME_CATEGORY
        ];
        keys.forEach(k => this.remove(k));
        debug('🧹 Host session cleared', null, 'info');
    }

    static clearPlayerSession() {
        const keys = [
            StorageKeys.GAME_ID,
            StorageKeys.PLAYER_ID,
            StorageKeys.PLAYER_NAME,
            StorageKeys.PLAYER_COLOR
        ];
        keys.forEach(k => this.remove(k));
        debug('🧹 Player session cleared', null, 'info');
    }
}

/**
 * Guarda dato en localStorage de forma segura (LEGACY)
 * @param {string} key - Clave
 * @param {*} value - Valor (se convierte a JSON si es objeto)
 */
function setLocalStorage(key, value) {
    StorageManager.set(key, value);
}

/**
 * Obtiene dato de localStorage de forma segura (LEGACY)
 * @param {string} key - Clave
 * @param {*} defaultValue - Valor por defecto
 * @returns {*} Valor guardado o default
 */
function getLocalStorage(key, defaultValue = null) {
    return StorageManager.get(key, defaultValue);
}

/**
 * Limpia las claves del juego del localStorage (LEGACY)
 * Mantiene el comportamiento anterior (player session).
 */
function clearGameSession() {
    StorageManager.clearPlayerSession();
}

// ============================================================================
// VALIDACIÓN
// ============================================================================

/**
 * Valida código de juego
 * @param {string} code - Código a validar
 * @returns {boolean} Es válido
 */
function isValidGameCode(code) {
    return code && code.length >= 3 && code.length <= 5;
}

/**
 * Valida nombre de jugador
 * @param {string} name - Nombre a validar
 * @returns {boolean} Es válido
 */
function isValidPlayerName(name) {
    return name && name.trim().length >= 2 && name.trim().length <= 20;
}

/**
 * Sanitiza texto para mostrar en HTML
 * CRÍTICO: Protege referencias a /images/ y otros assets
 * @param {string} text - Texto a sanitizar
 * @returns {string} Texto sanitizado
 */
function sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Valida formato de color
 * @param {string} color - Color en formato hex (#RRGGBB)
 * @returns {boolean} Es válido
 */
function isValidColor(color) {
    return /^#[0-9A-F]{6}$/i.test(color);
}

// ============================================================================
// UTILIDADES DOM
// ============================================================================

/**
 * Obtiene elemento de forma segura
 * @param {string} id - ID del elemento
 * @param {*} orDefault - Valor por defecto si no existe
 * @returns {HTMLElement|*}
 */
function safeGetElement(id, orDefault = null) {
    const el = document.getElementById(id);
    if (!el && orDefault === null) {
        console.warn(`Elemento no encontrado: ${id}`);
    }
    return el || orDefault;
}

/**
 * Muestra elemento con seguridad
 * @param {HTMLElement|string} element - Elemento o ID
 * @param {string} display - Valor de display (default: 'block')
 */
function safeShowElement(element, display = 'block') {
    const el = typeof element === 'string' ? safeGetElement(element) : element;
    if (!el) return;

    // Para overlays modales, nunca forzar display inline (rompe layout);
    // se controla exclusivamente con .modal-overlay.hidden
    if (el.classList && el.classList.contains('modal-overlay')) {
        el.classList.remove('hidden');
        el.style.display = '';
        return;
    }

    el.style.display = display;
}

/**
 * Oculta elemento con seguridad
 * @param {HTMLElement|string} element - Elemento o ID
 */
function safeHideElement(element) {
    const el = typeof element === 'string' ? safeGetElement(element) : element;
    if (!el) return;

    // Para overlays modales, ocultar via clase .hidden (sin tocar display)
    if (el.classList && el.classList.contains('modal-overlay')) {
        el.classList.add('hidden');
        el.style.display = '';
        return;
    }

    el.style.display = 'none';
}

/**
 * Añade clase a elemento con seguridad
 * @param {HTMLElement|string} element - Elemento o ID
 * @param {string} className - Nombre de clase
 */
function safeAddClass(element, className) {
    const el = typeof element === 'string' ? safeGetElement(element) : element;
    if (el) el.classList.add(className);
}

/**
 * Elimina clase de elemento con seguridad
 * @param {HTMLElement|string} element - Elemento o ID
 * @param {string} className - Nombre de clase
 */
function safeRemoveClass(element, className) {
    const el = typeof element === 'string' ? safeGetElement(element) : element;
    if (el) el.classList.remove(className);
}

/**
 * Toggle clase con seguridad
 * @param {HTMLElement|string} element - Elemento o ID
 * @param {string} className - Nombre de clase
 */
function safeToggleClass(element, className) {
    const el = typeof element === 'string' ? safeGetElement(element) : element;
    if (el) el.classList.toggle(className);
}

/**
 * Establece atributo con seguridad
 * @param {HTMLElement|string} element - Elemento o ID
 * @param {string} attr - Nombre del atributo
 * @param {string} value - Valor
 */
function safeSetAttribute(element, attr, value) {
    const el = typeof element === 'string' ? safeGetElement(element) : element;
    if (el) el.setAttribute(attr, value);
}

/**
 * Obtiene atributo con seguridad
 * @param {HTMLElement|string} element - Elemento o ID
 * @param {string} attr - Nombre del atributo
 * @param {*} orDefault - Valor por defecto
 * @returns {string|*}
 */
function safeGetAttribute(element, attr, orDefault = null) {
    const el = typeof element === 'string' ? safeGetElement(element) : element;
    if (!el) return orDefault;
    return el.getAttribute(attr) || orDefault;
}

// ============================================================================
// NOTIFICACIONES
// ============================================================================

/**
 * Muestra notificación en pantalla
 * @param {string} message - Mensaje
 * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duración en ms (0 = indefinido)
 */
function showNotification(message, type = 'info', duration = 3000) {
    const colors = {
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6'
    };
    
    const backgroundColor = colors[type] || colors.info;
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 8px;
        background: ${backgroundColor};
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    if (duration > 0) {
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
    
    return notification;
}

// ============================================================================
// GENERACIÓN DE IDs
// ============================================================================

/**
 * Genera ID único para jugador
 * @returns {string} ID del jugador
 */
function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Normaliza un texto para usar como código de sala.
 * - Quita espacios
 * - Pasa a mayúsculas
 * - Remueve diacríticos (ÁÉÍÓÚ -> AEIOU)
 * - Mantiene sólo A-Z y 0-9
 * @param {string} input
 * @returns {string}
 */
function normalizeWordForCode(input) {
    if (input === null || input === undefined) return '';

    let w = String(input).trim().toUpperCase();

    // Remover diacríticos (compatibilidad amplia)
    if (typeof w.normalize === 'function') {
        w = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    // Quitar espacios y caracteres no seguros para un code
    w = w.replace(/\s+/g, '');
    w = w.replace(/[^A-Z0-9]/g, '');

    return w;
}

/**
 * Extrae todas las palabras "tip" desde el diccionario jerárquico.
 * Soporta estructuras anidadas del tipo:
 * { "CATEGORIA": [ { "CONSIGNA": ["Cine", "Bar|Barrio", ...] } ] }
 * @param {*} data
 * @returns {Array<string>}
 */
function extractWordsFromDictionary(data) {
    const raw = [];

    const walk = (node) => {
        if (!node) return;

        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }

        const t = typeof node;
        if (t === 'string') {
            raw.push(node);
            return;
        }

        if (t === 'object') {
            Object.values(node).forEach(walk);
        }
    };

    walk(data);

    const out = [];
    const seen = new Set();

    raw.forEach(str => {
        if (typeof str !== 'string') return;

        // Separar sinónimos: "Bar|Barrio" -> ["Bar", "Barrio"]
        str.split('|').forEach(part => {
            const normalized = normalizeWordForCode(part);
            if (!normalized) return;

            if (!seen.has(normalized)) {
                seen.add(normalized);
                out.push(normalized);
            }
        });
    });

    return out;
}

/**
 * Carga el JSON crudo del diccionario.
 * @returns {Promise<Object>} Diccionario jerárquico
 */
async function loadDictionaryData() {
    if (dictionaryDataCache) return dictionaryDataCache;
    if (dictionaryDataPromise) return dictionaryDataPromise;

    dictionaryDataPromise = (async () => {
        try {
            const response = await fetch('/app/diccionario.json', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            dictionaryDataCache = data && typeof data === 'object' ? data : {};
            dictionaryDataPromise = null;
            return dictionaryDataCache;
        } catch (error) {
            debug('Error cargando diccionario (data), usando fallback', error, 'warn');
            dictionaryDataPromise = null;
            dictionaryDataCache = {};
            return dictionaryDataCache;
        }
    })();

    return dictionaryDataPromise;
}

/**
 * Devuelve el listado de categorías del diccionario.
 * @returns {Promise<Array<string>>}
 */
async function loadDictionaryCategories() {
    const data = await loadDictionaryData();
    const cats = (data && typeof data === 'object') ? Object.keys(data) : [];
    return Array.isArray(cats) ? cats : [];
}

/**
 * Carga el diccionario aplanado de tips (todas las categorías).
 * @returns {Promise<Array<string>>}
 */
async function loadDictionary() {
    if (dictionaryCache) return dictionaryCache;
    if (dictionaryPromise) return dictionaryPromise;

    dictionaryPromise = (async () => {
        try {
            const data = await loadDictionaryData();

            const extracted = extractWordsFromDictionary(data);

            // Fallback a formatos anteriores
            if (extracted.length) {
                dictionaryCache = extracted;
            } else {
                const maybe = data?.palabras || data?.words || data;
                dictionaryCache = Array.isArray(maybe) ? maybe.map(normalizeWordForCode).filter(Boolean) : [];
            }

            debug(`📚 Diccionario cargado: ${dictionaryCache.length} palabras`, null, 'info');
            dictionaryPromise = null;
            return dictionaryCache;
        } catch (error) {
            debug('Error cargando diccionario, usando fallback', error, 'warn');
            dictionaryPromise = null;

            dictionaryCache = [
                'SOL', 'LUNA', 'CASA', 'MESA', 'GATO', 'PERRO', 'AGUA', 'PAN', 'VINO', 'FLOR'
            ];

            return dictionaryCache;
        }
    })();

    return dictionaryPromise;
}

/**
 * Filtra palabras por rango de caracteres
 * @param {Array} words - Array de palabras
 * @param {number} minLength - Longitud mínima
 * @param {number} maxLength - Longitud máxima
 * @returns {Array} Palabras filtradas
 */
function filterWordsByLength(words, minLength, maxLength) {
    if (!Array.isArray(words)) return [];

    return words
        .map(word => {
            const text = typeof word === 'string' ? word : (word?.palabra || word?.word || '');
            return normalizeWordForCode(text);
        })
        .filter(word => {
            const len = word.length;
            return len >= minLength && len <= maxLength;
        });
}

/**
 * Genera código aleatorio para sala usando palabras del diccionario.
 * Puede limitarse a una categoría.
 * @param {string|null} categoryName
 * @param {number} minLength
 * @param {number} maxLength
 * @returns {Promise<string>}
 */
async function generateGameCodeForCategory(categoryName = null, minLength = 3, maxLength = 5) {
    try {
        let pool = [];

        if (categoryName) {
            const data = await loadDictionaryData();
            const categoryNode = data?.[categoryName];

            if (categoryNode) {
                pool = extractWordsFromDictionary(categoryNode);
            }
        }

        if (!pool.length) {
            pool = await loadDictionary();
        }

        const validWords = filterWordsByLength(pool, minLength, maxLength);

        if (!validWords.length) {
            debug('⚠️ No hay palabras válidas en diccionario, usando generador aleatorio', null, 'warn');
            return generateRandomLetterCode(4);
        }

        const randomIndex = Math.floor(Math.random() * validWords.length);
        const code = validWords[randomIndex];

        debug(`✅ Código generado: ${code}`, null, 'info');
        return code;
    } catch (error) {
        debug('Error en generateGameCodeForCategory, usando fallback', error, 'warn');
        return generateRandomLetterCode(4);
    }
}

/**
 * Compatibilidad: genera un código genérico (sin categoría) 3-5.
 * @returns {Promise<string>}
 */
async function generateGameCode() {
    return generateGameCodeForCategory(null, 3, 5);
}

/**
 * Fallback: Genera código con letras aleatorias
 * @param {number} length - Longitud (default: 4)
 * @returns {string} Código (ej: "ABCD")
 */
function generateRandomLetterCode(length = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    debug(`⚠️ Código aleatorio generado: ${code}`, null, 'warn');
    return code;
}

// ============================================================================
// APLICAR GRADIENTES DE COLOR (Player Manager)
// ============================================================================

/**
 * Aplica gradiente de aura del jugador
 * @param {string} colorString - String con dos colores separados por coma (ej: "#FF9966,#FF5E62")
 */
function applyColorGradient(colorString) {
    if (!colorString) return;
    
    const colors = colorString.split(',').map(c => c.trim());
    if (colors.length < 2) {
        colors.push(colors[0]); // Si solo hay un color, usarlo para ambos
    }
    
    const root = document.documentElement;
    root.style.setProperty('--aura-color-1', colors[0]);
    root.style.setProperty('--aura-color-2', colors[1] || colors[0]);
}

console.log('%c✅ shared-utils.js - Sincronización de tiempo + feedback visual mejorada', 'color: #10B981; font-weight: bold');
