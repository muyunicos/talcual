/**
 * @file shared-utils.js
 * @description Utilidades compartidas entre host y player
 */

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

/**
 * Crea un countdown sincronizado
 * @param {number} targetTimestamp - Timestamp destino
 * @param {Function} callback - Callback cada segundo
 * @param {Function} onComplete - Callback cuando termina
 * @returns {number} ID del intervalo
 */
function createCountdown(targetTimestamp, callback, onComplete) {
    return setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const remaining = targetTimestamp - now;
        
        if (callback) callback(remaining);
        
        if (remaining <= 0) {
            clearInterval(timerID);
            if (onComplete) onComplete();
        }
    }, 100);
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
        debug('Error guardando localStorage:', error, 'warn');
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
        debug('Error leyendo localStorage:', error, 'warn');
        return defaultValue;
    }
}

/**
 * Limpia la sesión del juego del localStorage
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
        debug(`Elemento no encontrado: ${id}`, 'warn');
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
// GRADIENTES Y ESTILOS
// ============================================================================

/**
 * Aplica gradiente de color al fondo
 * @param {string} colorGradient - Colores separados por coma ("#FF9966,#FF5E62")
 */
function applyColorGradient(colorGradient) {
    const colors = colorGradient.split(',').map(c => c.trim());
    if (colors.length >= 2) {
        document.body.style.background = `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
    }
}

/**
 * Limpia gradiente de fondo
 */
function clearColorGradient() {
    document.body.style.background = '';
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
 * Genera código aleatorio para sala
 * @param {number} length - Longitud del código (default: 4)
 * @returns {string} Código generado
 */
function generateGameCode(length = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
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
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 8px;
        background: ${getNotificationColor(type)};
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

function getNotificationColor(type) {
    const colors = {
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6'
    };
    return colors[type] || colors.info;
}

// ============================================================================
// DEBUG MODE
// ============================================================================

let DEBUG_MODE = false;

/**
 * Activa/desactiva modo debug
 * @param {boolean} enabled - Activar o no
 */
function setDebugMode(enabled) {
    DEBUG_MODE = enabled;
    if (enabled) {
        console.log('%c🔍 DEBUG MODE ACTIVADO', 'color: #00FF00; font-size: 14px; font-weight: bold');
    }
}

/**
 * Log de debug
 * @param {string} message - Mensaje
 * @param {*} data - Datos opcionales
 * @param {string} level - Nivel: 'log', 'warn', 'error'
 */
function debug(message, data = null, level = 'log') {
    if (!DEBUG_MODE) return;
    
    const styles = {
        log: 'color: #3B82F6',
        warn: 'color: #F59E0B',
        error: 'color: #EF4444'
    };
    
    const style = styles[level] || styles.log;
    console.log(`%c[DEBUG] ${message}`, style, data || '');
}

/**
 * Alias para console.log con DEBUG_MODE check
 */
function logDebug(message, data) {
    debug(message, data, 'log');
}

/**
 * Alias para console.warn con DEBUG_MODE check
 */
function warnDebug(message, data) {
    debug(message, data, 'warn');
}

/**
 * Alias para console.error con DEBUG_MODE check
 */
function errorDebug(message, data) {
    debug(message, data, 'error');
}

console.log('%c✅ shared-utils.js cargado', 'color: #10B981; font-weight: bold');
