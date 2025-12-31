/**
 * @file shared-utils.js
 * @description Utilidades compartidas + SERVICIOS CENTRALIZADOS (SessionManager, DictionaryService, ConfigService, ModalHandler, ModalController)
 * 
 * 🎯 FASE 1 COMPLETA: Este archivo centraliza TODA la lógica de dependencias
 * 🎯 FASE 2: FIX - Logging y timeout en beforeunload
 * 🎯 FASE 3A: ADD - DictionaryService category-aware methods
 * 🎯 FASE 3B: ADD - ModalController class para gestión unificada de modales
 */

// Global dictionary cache
let dictionaryCache = null; // flattened words
let dictionaryPromise = null;
let dictionaryDataCache = null; // raw JSON
let dictionaryDataPromise = null;

// Global modal z-index tracking
let modalZIndexCounter = 1000;

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
        case 'success':
            console.log(`${prefix} ✅ ${message}`, data || '');
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
 * REFACTORIZADO: Obtiene el tiempo restante SOLO de la ronda (sin countdown)
 * Usa el timestamp cuando comienza la ronda real (round_started_at)
 * 
 * @param {number} roundStartedAt - Timestamp cuando COMIENZA LA RONDA REAL (ms, servidor)
 * @param {number} roundDuration - Duración SOLO de la ronda en ms (sin countdown)
 * @returns {number} Milisegundos restantes (sincronizado)
 */
function getRemainingTime(roundStartedAt, roundDuration) {
    // Si timeSync está disponible y calibrado, usar tiempo sincronizado
    if (typeof timeSync !== 'undefined' && timeSync && timeSync.isCalibrated) {
        return timeSync.getRemainingTime(roundStartedAt, roundDuration);
    }
    
    // Fallback: cálculo local (menos preciso, pero funciona)
    const now = Date.now();
    const endTime = roundStartedAt + roundDuration;
    return Math.max(0, endTime - now);
}

/**
 * NUEVO: Obtiene el tiempo restante del COUNTDOWN
 * Usa round_starts_at (cuando comienza el countdown)
 * 
 * @param {number} roundStartsAt - Timestamp cuando comienza countdown (ms, servidor)
 * @param {number} countdownDuration - Duración countdown en ms
 * @returns {number} Milisegundos restantes
 */
function getRemainingCountdownTime(roundStartsAt, countdownDuration) {
    if (typeof timeSync !== 'undefined' && timeSync && timeSync.isCalibrated) {
        return timeSync.getRemainingTime(roundStartsAt, countdownDuration);
    }
    
    const now = Date.now();
    const endTime = roundStartsAt + countdownDuration;
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
 * Muestra --:-- hasta que la ronda comience (round_started_at existe)
 * Luego muestra tiempo de ronda (sin countdown)
 * 
 * @param {number} ms - Milisegundos restantes (null/undefined para mostrar --:--)  
 * @param {HTMLElement} element - Elemento donde mostrar
 * @param {string} prefix - Prefijo (ej: '⏳')
 * @param {number} warningThreshold - Mostrar warning desde X ms
 */
function updateTimerDisplay(ms, element, prefix = '⏳', warningThreshold = 5000) {
    if (!element) return;
    
    // Si no hay tiempo (null, undefined o negativo), mostrar --:--
    if (ms === null || ms === undefined || ms === false) {
        element.textContent = prefix ? `${prefix} --:--` : '--:--';
        element.classList.remove('timer-warning');
        element.classList.remove('timer-expired');
        return;
    }
    
    const formatted = formatTime(ms);
    element.textContent = prefix ? `${prefix} ${formatted}` : formatted;
    
    // Agregar feedback visual
    // Rojo cuando < 5s
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

            debug(`📚 Diccionario cargado: ${dictionaryCache.length} palabras`, null, 'success');
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

        debug(`✅ Código generado: ${code}`, null, 'success');
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
// 🎯 FASE 1: SERVICIOS CENTRALIZADOS
// ============================================================================

/**
 * SessionManager - Gestión unificada de sesiones (host/player)
 * ✅ CENTRALIZA: localStorage, beforeunload, recuperación de sesión
 * ✅ FASE 2 FIX: Logging y timeout en beforeunload
 */
class SessionManager {
    constructor(type = 'player') {
        this.type = type; // 'host' o 'player'
        this.manager = null; // Referencia al manager que se registre
        this.setupBeforeUnload();
    }

    /**
     * ✅ FASE 2 FIX: beforeunload con logging y timeout
     */
    setupBeforeUnload() {
        window.addEventListener('beforeunload', () => {
            try {
                // ✅ FIX: Agregar logging de inicio
                debug(`⏹️ beforeunload ejecutado para ${this.type.toUpperCase()}`, null, 'info');
                
                if (this.manager && typeof this.manager.destroy === 'function') {
                    // ✅ FIX: Timeout de 2000ms para permitir que destroy() se complete
                    const destroyPromise = Promise.resolve(this.manager.destroy());
                    
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => {
                            reject(new Error('destroy() timeout'));
                        }, 2000);
                    });
                    
                    Promise.race([destroyPromise, timeoutPromise])
                        .then(() => {
                            debug(`✅ destroy() completado para ${this.type.toUpperCase()}`, null, 'success');
                        })
                        .catch((err) => {
                            debug(`⚠️ destroy() timeout o error: ${err.message}`, null, 'warn');
                        });
                }
            } catch (error) {
                debug(`❌ Error en beforeunload: ${error.message}`, null, 'error');
            }
        });
    }

    registerManager(manager) {
        this.manager = manager;
        debug(`✅ ${this.type.toUpperCase()} manager registrado en SessionManager`, null, 'success');
    }

    isSessionActive() {
        if (this.type === 'host') {
            return StorageManager.isHostSessionActive();
        }
        const gameId = StorageManager.get(StorageKeys.GAME_ID);
        const playerId = StorageManager.get(StorageKeys.PLAYER_ID);
        return !!(gameId && playerId);
    }

    /**
     * Guarda sesión de jugador
     */
    savePlayerSession(gameId, playerId, playerName, playerColor) {
        StorageManager.set(StorageKeys.GAME_ID, gameId);
        StorageManager.set(StorageKeys.PLAYER_ID, playerId);
        StorageManager.set(StorageKeys.PLAYER_NAME, playerName);
        StorageManager.set(StorageKeys.PLAYER_COLOR, playerColor);
        debug(`✅ Sesión de jugador guardada: ${playerId}`, null, 'success');
    }

    /**
     * Recupera sesión de jugador
     */
    recover() {
        const gameId = StorageManager.get(StorageKeys.GAME_ID);
        const playerId = StorageManager.get(StorageKeys.PLAYER_ID);
        const playerName = StorageManager.get(StorageKeys.PLAYER_NAME);
        const playerColor = StorageManager.get(StorageKeys.PLAYER_COLOR);

        if (gameId && playerId && playerName && playerColor) {
            return { gameId, playerId, playerName, playerColor };
        }

        return null;
    }

    /**
     * Limpia sesión completamente
     */
    clear() {
        if (this.type === 'host') {
            StorageManager.clearHostSession();
        } else {
            StorageManager.clearPlayerSession();
        }
        debug(`🧹 ${this.type.toUpperCase()} session cleared`, null, 'info');
    }
}

/**
 * DictionaryService - Gestión centralizada del diccionario + motor de comparación
 * ✅ CENTRALIZA: Carga de JSON, acceso a palabras, categorías, comparación lingüística
 * ✅ INTEGRA: WordEquivalenceEngine para análisis semántico de palabras
 * ✅ ELIMINA REDUNDANCIA: Solo un lugar hace fetch a /app/diccionario.json
 * ✅ FASE 3A: ADD - Métodos category-aware (getWordsForCategory, getRandomWordByCategory)
 */
class DictionaryService {
    constructor() {
        this.isReady = false;
        this.initPromise = null;
        this.engine = null; // WordEquivalenceEngine instance
    }

    /**
     * Inicializa el servicio y su motor de comparación
     */
    async initialize() {
        if (this.isReady) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                // 1. Cargar diccionario de tips
                await loadDictionary();

                // 2. Instanciar motor de comparación si está disponible
                if (typeof WordEquivalenceEngine !== 'undefined') {
                    this.engine = new WordEquivalenceEngine();
                    
                    // El engine carga desde /js/sinonimos.json (diccionario semántico)
                    try {
                        const response = await fetch('/js/sinonimos.json', { cache: 'no-store' });
                        if (response.ok) {
                            const semiData = await response.json();
                            this.engine.processDictionary(semiData);
                            this.engine.isLoaded = true;
                            debug('🔤 WordEquivalenceEngine integrado en DictionaryService', null, 'success');
                        }
                    } catch (e) {
                        debug('⚠️ No se pudo cargar sinonimos.json, motor sin diccionario semántico', e, 'warn');
                    }
                }

                this.isReady = true;
                debug('📚 DictionaryService completamente inicializado', null, 'success');
            } catch (error) {
                debug('❌ Error inicializando DictionaryService: ' + error.message, null, 'error');
                this.isReady = false;
            }
        })();

        return this.initPromise;
    }

    /**
     * Obtiene categorías del diccionario
     */
    async getCategories() {
        await this.initialize();
        return loadDictionaryCategories();
    }

    /**
     * Obtiene todas las palabras cargadas
     */
    async getWords() {
        await this.initialize();
        return loadDictionary();
    }

    /**
     * Obtiene palabra aleatoria
     */
    async getRandomWord() {
        const words = await this.getWords();
        if (!words.length) return 'SOL';
        return words[Math.floor(Math.random() * words.length)];
    }

    /**
     * 📌 FASE 3A NEW: Obtiene todas las palabras de una categoría específica
     * @param {string} categoryName - Nombre de categoría
     * @returns {Promise<Array<string>>} Array de palabras normalizadas
     */
    async getWordsForCategory(categoryName) {
        if (!categoryName) return this.getWords();
        
        const data = await loadDictionaryData();
        if (!data || !data[categoryName]) {
            debug(`⚠️ Categoría no encontrada: ${categoryName}`, null, 'warn');
            return [];
        }

        const categoryNode = data[categoryName];
        const words = extractWordsFromDictionary(categoryNode);
        
        if (!words.length) {
            debug(`⚠️ Categoría vacía: ${categoryName}`, null, 'warn');
        }

        return words;
    }

    /**
     * 📌 FASE 3A NEW: Obtiene palabra random de una categoría específica
     * @param {string} categoryName - Nombre de categoría
     * @returns {Promise<string>} Palabra normalizada random
     */
    async getRandomWordByCategory(categoryName) {
        if (!categoryName) {
            return this.getRandomWord();
        }

        const words = await this.getWordsForCategory(categoryName);
        
        if (!words.length) {
            debug(`⚠️ Sin palabras en ${categoryName}, fallback a general`, null, 'warn');
            return this.getRandomWord();
        }

        const randomIndex = Math.floor(Math.random() * words.length);
        return words[randomIndex];
    }

    /**
     * 🔤 MÉTODOS PROXY PARA WordEquivalenceEngine
     * Estos permiten que otros módulos usen la lógica sin acceder directo a engine
     */

    /**
     * Obtiene forma canónica de una palabra
     * @param {string} word
     * @returns {string}
     */
    getCanonical(word) {
        if (!this.engine || !this.engine.isLoaded) {
            return normalizeWordForCode(word);
        }
        return this.engine.getCanonical(word);
    }

    /**
     * Obtiene tipo de coincidencia entre dos palabras
     * @param {string} word1
     * @param {string} word2
     * @returns {string | null} 'EXACTA', 'PLURAL', 'GENERO', 'SINONIMO', null
     */
    getMatchType(word1, word2) {
        if (!this.engine) return null;
        return this.engine.getMatchType(word1, word2);
    }

    /**
     * Compara dos palabras con detalle
     * @param {string} word1
     * @param {string} word2
     * @returns {boolean}
     */
    areEquivalent(word1, word2) {
        if (!this.engine || !this.engine.isLoaded) {
            // Fallback: comparación local por stems
            const n1 = normalizeWordForCode(word1);
            const n2 = normalizeWordForCode(word2);
            return n1 === n2;
        }
        return this.engine.areEquivalent(word1, word2);
    }

    /**
     * Compara con tipo de coincidencia
     * @param {string} word1
     * @param {string} word2
     * @returns {object} {match: boolean, type: string | null}
     */
    areEquivalentWithType(word1, word2) {
        if (!this.engine) {
            const match = this.areEquivalent(word1, word2);
            return { match, type: match ? 'EQUIVALENTE' : null };
        }
        return this.engine.areEquivalentWithType(word1, word2);
    }
}

/**
 * ConfigService - Gestión centralizada de configuración
 * ✅ CENTRALIZA: Carga única de config desde actions.php
 * ✅ ELIMINA REDUNDANCIA: Solo un lugar hace fetch a get_config
 */
class ConfigService {
    constructor() {
        this.config = null;
        this.loadPromise = null;
    }

    async load() {
        if (this.config) return this.config;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            try {
                const url = new URL('./app/actions.php', window.location.href);
                const response = await fetch(url.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_config' }),
                    cache: 'no-store'
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.config) {
                        this.config = result.config;
                        debug('⚙️ Configuración cargada', this.config, 'success');
                        return this.config;
                    }
                }

                throw new Error('Config response invalid');
            } catch (error) {
                debug('⚠️ Config load failed, usando defaults', error, 'warn');
                this.config = {
                    default_total_rounds: 3,
                    min_players: 2,
                    max_words_per_player: 6,
                    round_duration: 60000
                };
                return this.config;
            }
        })();

        return this.loadPromise;
    }

    get(key, defaultValue = null) {
        if (!this.config) return defaultValue;
        return this.config[key] ?? defaultValue;
    }
}

// ============================================================================
// 🎯 FASE 3B: ModalController - Gestión Unificada de Modales
// ============================================================================

/**
 * ModalController - Controlador único para cualquier modal
 * 
 * Maneja automáticamente:
 * - Apertura/cierre con transiciones
 * - Click en backdrop (click fuera del modal)
 * - Tecla ESC para cerrar
 * - Z-index stacking
 * - Atributos ARIA para accesibilidad
 * - Hooks lifecycle (beforeOpen, afterOpen, beforeClose, afterClose)
 * 
 * Reduce ~80 líneas de código duplicado en managers
 */
class ModalController {
    /**
     * @param {string} modalId - ID del elemento modal (clase .modal-overlay)
     * @param {Object} options - Configuración del modal
     * @param {boolean} options.closeOnBackdrop - Cerrar al click fuera (default: true)
     * @param {boolean} options.closeOnEsc - Cerrar con tecla ESC (default: true)
     * @param {Function} options.onBeforeOpen - Hook antes de abrir
     * @param {Function} options.onAfterOpen - Hook después de abrir
     * @param {Function} options.onBeforeClose - Hook antes de cerrar
     * @param {Function} options.onAfterClose - Hook después de cerrar
     */
    constructor(modalId, options = {}) {
        this.modalId = modalId;
        this.modal = document.getElementById(modalId);
        this.isOpen = false;
        this.options = {
            closeOnBackdrop: options.closeOnBackdrop !== false,
            closeOnEsc: options.closeOnEsc !== false,
            onBeforeOpen: options.onBeforeOpen || (() => {}),
            onAfterOpen: options.onAfterOpen || (() => {}),
            onBeforeClose: options.onBeforeClose || (() => {}),
            onAfterClose: options.onAfterClose || (() => {})
        };

        if (!this.modal) {
            console.error(`[ModalController] Modal no encontrado: ${modalId}`);
            return;
        }

        this.setupEventListeners();
        debug(`🎪 ModalController creado para: ${modalId}`, null, 'info');
    }

    /**
     * Configura event listeners del modal
     */
    setupEventListeners() {
        // Backdrop click (solo si el click es en el overlay, no en el contenido)
        this.modal.addEventListener('click', (e) => {
            if (this.options.closeOnBackdrop && e.target === this.modal) {
                this.close();
            }
        });

        // Botones con atributo data-close
        const closeButtons = this.modal.querySelectorAll('[data-close]');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        // Tecla ESC global
        if (this.options.closeOnEsc) {
            this.escKeyHandler = (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            };
        }
    }

    /**
     * Abre el modal
     */
    open() {
        if (this.isOpen) return;

        try {
            // Hook pre-apertura
            this.options.onBeforeOpen();

            // Mostrar modal
            this.modal.style.display = 'flex';
            this.modal.classList.add('active');
            this.modal.setAttribute('aria-hidden', 'false');

            // Z-index
            this.modal.style.zIndex = modalZIndexCounter++;

            // Agregar listener de ESC
            if (this.escKeyHandler) {
                document.addEventListener('keydown', this.escKeyHandler);
            }

            this.isOpen = true;

            // Hook post-apertura (asincrónico para permitir transiciones CSS)
            requestAnimationFrame(() => {
                this.options.onAfterOpen();
            });

            debug(`🎪 Modal abierto: ${this.modalId}`, null, 'info');
        } catch (error) {
            debug(`❌ Error abriendo modal ${this.modalId}: ${error.message}`, null, 'error');
        }
    }

    /**
     * Cierra el modal
     */
    close() {
        if (!this.isOpen) return;

        try {
            // Hook pre-cierre
            this.options.onBeforeClose();

            // Ocultar modal
            this.modal.classList.remove('active');
            this.modal.setAttribute('aria-hidden', 'true');

            // Remover listener de ESC
            if (this.escKeyHandler) {
                document.removeEventListener('keydown', this.escKeyHandler);
            }

            this.isOpen = false;

            // Hook post-cierre (permite transiciones CSS)
            setTimeout(() => {
                this.modal.style.display = 'none';
                this.options.onAfterClose();
            }, 300); // Ajustar según duración de transición CSS

            debug(`🎪 Modal cerrado: ${this.modalId}`, null, 'info');
        } catch (error) {
            debug(`❌ Error cerrando modal ${this.modalId}: ${error.message}`, null, 'error');
        }
    }

    /**
     * Toggle apertura/cierre
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Verifica si el modal está abierto
     * @returns {boolean}
     */
    getIsOpen() {
        return this.isOpen;
    }

    /**
     * Limpia event listeners (destructor)
     */
    destroy() {
        if (this.escKeyHandler) {
            document.removeEventListener('keydown', this.escKeyHandler);
        }
        debug(`🗑️ ModalController destruido: ${this.modalId}`, null, 'info');
    }
}

/**
 * ModalHandler - Gestión centralizada de modales (LEGACY - para compatibilidad)
 * ✅ CENTRALIZA: Apertura/cierre de modales, manejo de overlay, tracking de modales abiertos
 * ✅ ELIMINA REDUNDANCIA: ~150 líneas de código duplicado en managers
 * ✅ DRY: Un solo lugar para lógica modal
 * 
 * NOTA: Usa ModalController internamente para nueva funcionalidad
 */
class ModalHandler {
    constructor() {
        this.openModals = new Set();
        this.controllers = new Map(); // ID -> ModalController
    }

    /**
     * Abre un modal por ID (compatibilidad legacy)
     * @param {string} modalId - ID del elemento modal
     * @returns {boolean} true si se abrió exitosamente
     */
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`[ModalHandler] Modal no encontrado: ${modalId}`);
            return false;
        }

        modal.style.display = 'flex';
        if (modal.classList) {
            modal.classList.add('active');
        }

        this.openModals.add(modalId);
        debug(`📂 Modal abierto: ${modalId}`, null, 'info');

        return true;
    }

    /**
     * Cierra un modal por ID (compatibilidad legacy)
     * @param {string} modalId - ID del elemento modal
     * @returns {boolean} true si se cerró exitosamente
     */
    close(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`[ModalHandler] Modal no encontrado: ${modalId}`);
            return false;
        }

        modal.style.display = 'none';
        if (modal.classList) {
            modal.classList.remove('active');
        }

        this.openModals.delete(modalId);
        debug(`📂 Modal cerrado: ${modalId}`, null, 'info');

        return true;
    }

    /**
     * Cierra todos los modales abiertos
     */
    closeAll() {
        const modalIds = Array.from(this.openModals);
        modalIds.forEach(id => this.close(id));
    }

    /**
     * Verifica si un modal está abierto
     * @param {string} modalId - ID del elemento modal
     * @returns {boolean} true si está abierto
     */
    isOpen(modalId) {
        return this.openModals.has(modalId);
    }

    /**
     * Obtiene todos los modales abiertos
     * @returns {string[]} array de IDs de modales abiertos
     */
    getOpenModals() {
        return Array.from(this.openModals);
    }

    /**
     * NUEVA: Crea o retorna un ModalController para un modal
     * @param {string} modalId - ID del elemento modal
     * @param {Object} options - Opciones del ModalController
     * @returns {ModalController}
     */
    createController(modalId, options = {}) {
        if (!this.controllers.has(modalId)) {
            this.controllers.set(modalId, new ModalController(modalId, options));
        }
        return this.controllers.get(modalId);
    }

    /**
     * NUEVA: Obtiene un ModalController existente
     * @param {string} modalId - ID del elemento modal
     * @returns {ModalController | null}
     */
    getController(modalId) {
        return this.controllers.get(modalId) || null;
    }
}

// ============================================================================
// 🌍 INSTANCIAS GLOBALES - EXPORTAR A window
// ============================================================================

// ✅ Instancias singleton que se inyectan en todo el código
window.hostSession = new SessionManager('host');
window.playerSession = new SessionManager('player');
window.dictionaryService = new DictionaryService();
window.configService = new ConfigService();
window.modalHandler = new ModalHandler();

// ✅ ALIAS PARA BACKWARDS COMPATIBILITY: wordEngineManager -> dictionaryService
// Esto evita ReferenceError en managers que aún usan wordEngineManager
window.wordEngineManager = window.dictionaryService;

// ✅ ALIAS PARA UI: Modal -> modalHandler
window.Modal = window.modalHandler;

debug('✅ Servicios centralizados inicializados (SessionManager, DictionaryService, ConfigService, ModalHandler)', null, 'success');
debug('✅ wordEngineManager aliased a dictionaryService (para compatibilidad)', null, 'success');
debug('✅ Modal aliased a modalHandler (para UI centralizada)', null, 'success');
debug('🎯 FASE 3A: DictionaryService con getWordsForCategory() y getRandomWordByCategory()', null, 'success');
debug('🎪 FASE 3B: ModalController para gestión unificada de modales', null, 'success');

console.log('%c✅ shared-utils.js - FASE 1 + 2 + 3A + 3B: Servicios centralizados + ModalController', 'color: #10B981; font-weight: bold; font-size: 12px');
