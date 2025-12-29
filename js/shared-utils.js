/**
 * @file shared-utils.js
 * @description Utilidades compartidas entre host y player
 */

// Global dictionary cache
let dictionaryCache = null;

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
// GESTIÓN DE TIEMPO
// ============================================================================

/**
 * Obtiene el tiempo restante entre un timestamp y una duración
 * @param {number} startTimestamp - Timestamp de inicio (segundos)
 * @param {number} duration - Duración en segundos
 * @returns {number} Segundos restantes
 */
function getRemainingTime(startTimestamp, duration) {
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - startTimestamp;
    return Math.max(0, duration - elapsed);
}

/**
 * Formatea segundos a MM:SS
 * @param {number} seconds - Número de segundos
 * @returns {string} Formato MM:SS
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Actualiza display de timer en el DOM
 * @param {number} seconds - Segundos restantes
 * @param {HTMLElement} element - Elemento donde mostrar
 * @param {string} prefix - Prefijo (ej: '⏳')
 * @param {number} warningThreshold - Mostrar warning desde X segundos
 */
function updateTimerDisplay(seconds, element, prefix = '⏳', warningThreshold = 10) {
    if (!element) return;
    
    const formatted = formatTime(seconds);
    element.textContent = prefix ? `${prefix} ${formatted}` : formatted;
    
    if (seconds <= warningThreshold) {
        element.classList.add('warning');
    } else {
        element.classList.remove('warning');
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

/**
 * Guarda dato en localStorage de forma segura
 * @param {string} key - Clave
 * @param {*} value - Valor (se convierte a JSON si es objeto)
 */
function setLocalStorage(key, value) {
    try {
        const data = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, data);
    } catch (error) {
        console.warn('Error guardando localStorage:', error);
    }
}

/**
 * Obtiene dato de localStorage de forma segura
 * @param {string} key - Clave
 * @param {*} defaultValue - Valor por defecto
 * @returns {*} Valor guardado o default
 */
function getLocalStorage(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        if (!value) return defaultValue;
        
        // Intentar parsear como JSON
        try {
            return JSON.parse(value);
        } catch {
            return value; // Si no es JSON, devolver string
        }
    } catch (error) {
        console.warn('Error leyendo localStorage:', error);
        return defaultValue;
    }
}

/**
 * Limpia las claves del juego del localStorage
 */
function clearGameSession() {
    const keys = ['gameId', 'playerId', 'playerName', 'playerColor'];
    keys.forEach(key => localStorage.removeItem(key));
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
    return code && code.length >= 3 && code.length <= 6;
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
    if (el) el.style.display = display;
}

/**
 * Oculta elemento con seguridad
 * @param {HTMLElement|string} element - Elemento o ID
 */
function safeHideElement(element) {
    const el = typeof element === 'string' ? safeGetElement(element) : element;
    if (el) el.style.display = 'none';
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
 * Carga el diccionario de manera sincrónica (usando cache)
 * @returns {Array} Array de palabras del diccionario
 */
async function loadDictionary() {
    if (dictionaryCache) return dictionaryCache;
    
    try {
        const response = await fetch('../app/dictionary.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        dictionaryCache = data.palabras || data.words || [];
        debug(`📚 Diccionario cargado: ${dictionaryCache.length} palabras`, 'info');
        return dictionaryCache;
    } catch (error) {
        debug('Error cargando diccionario, usando fallback', error, 'warn');
        // Fallback: palabras comunes de 4-5 letras
        return ['CASA', 'MESA', 'LIBRO', 'GATO', 'PERRO', 'AGUA', 'FUEGO', 'VIENTO', 'LLUVIA', 'SOL', 'LUNA', 'ESTRELLA', 'ARBOL', 'FLOR', 'PAJARO', 'PESCADO', 'LECHE', 'PAN', 'VINO', 'CARNE', 'QUESO', 'MANZANA', 'PERA', 'UVA', 'PLATANO'];
    }
}

/**
 * Filtra palabras por rango de caracteres
 * @param {Array} words - Array de palabras
 * @param {number} minLength - Longitud mínima
 * @param {number} maxLength - Longitud máxima
 * @returns {Array} Palabras filtradas
 */
function filterWordsByLength(words, minLength, maxLength) {
    return words.filter(word => {
        const len = (word.palabra || word).length;
        return len >= minLength && len <= maxLength;
    });
}

/**
 * Genera código aleatorio para sala usando palabras del diccionario
 * Genera 1-2 palabras de 4-5 letras del diccionario
 * @returns {string} Código generado
 */
async function generateGameCode() {
    const dict = await loadDictionary();
    const validWords = filterWordsByLength(dict, 4, 5);
    
    if (validWords.length === 0) {
        // Fallback si no hay palabras válidas
        return generateRandomLetterCode(4);
    }
    
    // Seleccionar 1 palabra aleatoria del diccionario
    const randomWord = validWords[Math.floor(Math.random() * validWords.length)];
    const word = (randomWord.palabra || randomWord).toUpperCase().trim();
    
    return word.length <= 6 ? word : word.substring(0, 6);
}

/**
 * Fallback: Genera código con letras aleatorias
 * @param {number} length - Longitud (default: 4)
 * @returns {string}
 */
function generateRandomLetterCode(length = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
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

console.log('%c✅ shared-utils.js cargado - Debug centralizado, diccionario async, códigos de palabra', 'color: #10B981; font-weight: bold');
