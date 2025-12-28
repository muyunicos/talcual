// ============================================================================
// js/shared-utils.js - Utilidades Compartidas
// ============================================================================
// Funciones comunes entre host.html y play.html
// Sin dependencias de rol específico (host/player)

console.log('📦 Cargando shared-utils.js...');

// ============================================================================
// UTILIDADES DE TIEMPO
// ============================================================================

/**
 * Calcula el tiempo restante basado en timestamp y duración
 * @param {number} startTimestamp - Timestamp de inicio (segundos)
 * @param {number} duration - Duración total en segundos
 * @returns {number} Tiempo restante en segundos (mínimo 0)
 */
function getRemainingTime(startTimestamp, duration) {
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - startTimestamp;
    return Math.max(0, duration - elapsed);
}

/**
 * Formatea segundos en formato MM:SS
 * @param {number} seconds - Tiempo en segundos
 * @returns {string} Formato "MM:SS"
 */
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Actualiza display de timer con estilos
 * @param {number} seconds - Tiempo en segundos
 * @param {HTMLElement} timerElement - Elemento DOM del timer
 * @param {string} prefix - Prefijo del timer (ej: "⏳ ")
 */
function updateTimerDisplay(seconds, timerElement, prefix = '⏳ ') {
    if (!timerElement) return;
    
    timerElement.textContent = prefix + formatTime(seconds);
    
    // Agregar clase warning si está bajo 10 segundos
    if (seconds <= 10) {
        timerElement.classList.add('warning');
    } else {
        timerElement.classList.remove('warning');
    }
}

// ============================================================================
// UTILIDADES DE ALMACENAMIENTO LOCAL
// ============================================================================

/**
 * Guarda datos en localStorage con validación
 * @param {string} key - Clave
 * @param {*} value - Valor
 */
function setLocalStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        console.error(`❌ Error guardando ${key} en localStorage:`, error);
    }
}

/**
 * Obtiene datos de localStorage
 * @param {string} key - Clave
 * @returns {string|null} Valor guardado o null
 */
function getLocalStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        console.error(`❌ Error leyendo ${key} de localStorage:`, error);
        return null;
    }
}

/**
 * Elimina datos de localStorage
 * @param {string} key - Clave
 */
function removeLocalStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error(`❌ Error eliminando ${key} de localStorage:`, error);
    }
}

/**
 * Limpia toda la sesión del juego
 */
function clearGameSession() {
    const keysToRemove = ['gameId', 'playerId', 'playerName', 'playerColor', 'isHost'];
    keysToRemove.forEach(key => removeLocalStorage(key));
    console.log('🔄 Sesión de juego limpiada');
}

// ============================================================================
// UTILIDADES DE VALIDACIÓN
// ============================================================================

/**
 * Valida código de juego
 * @param {string} code - Código
 * @returns {boolean} Es válido
 */
function isValidGameCode(code) {
    return code && code.length >= 3 && code.length <= 6 && /^[A-Z0-9]+$/.test(code);
}

/**
 * Valida nombre de jugador
 * @param {string} name - Nombre
 * @returns {boolean} Es válido
 */
function isValidPlayerName(name) {
    return name && name.length >= 2 && name.length <= 20;
}

/**
 * Sanitiza entrada de texto
 * @param {string} text - Texto a sanitizar
 * @returns {string} Texto sanitizado
 */
function sanitizeText(text) {
    return text
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, ''); // Solo letras, números y espacios
}

// ============================================================================
// UTILIDADES DE NOTIFICACIÓN
// ============================================================================

/**
 * Muestra notificación en consola y opcionalmente en UI
 * @param {string} message - Mensaje
 * @param {string} type - Tipo: 'info', 'success', 'warning', 'error'
 * @param {HTMLElement} targetElement - Elemento DOM opcional para mostrar mensaje
 */
function showNotification(message, type = 'info', targetElement = null) {
    // Mostrar en consola
    const icons = {
        'info': 'ℹ️',
        'success': '✅',
        'warning': '⚠️',
        'error': '❌'
    };
    
    const icon = icons[type] || '📢';
    console.log(`${icon} [${type.toUpperCase()}] ${message}`);
    
    // Mostrar en UI si se proporciona elemento
    if (targetElement) {
        const colorClass = {
            'info': 'info',
            'success': 'success',
            'warning': 'warning',
            'error': 'error'
        }[type] || 'info';
        
        targetElement.className = `notification notification-${colorClass}`;
        targetElement.textContent = message;
        targetElement.style.display = 'block';
        
        // Auto-ocultar después de 5 segundos
        setTimeout(() => {
            targetElement.style.display = 'none';
        }, 5000);
    }
}

// ============================================================================
// UTILIDADES DE COLOR
// ============================================================================

/**
 * Aplica gradiente de color a elemento
 * @param {string} colorString - String de color (ej: "#FF9966,#FF5E62")
 * @param {HTMLElement} element - Elemento para aplicar gradiente
 */
function applyColorGradient(colorString, element = document.body) {
    if (!colorString) return;
    
    const colors = colorString.split(',');
    if (colors.length === 2) {
        element.style.background = `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
    }
}

/**
 * Genera ID único para jugador
 * @returns {string} ID único
 */
function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ============================================================================
// UTILIDADES DE MANEJO DE DOM
// ============================================================================

/**
 * Obtiene referencia a elemento de forma segura
 * @param {string} id - ID del elemento
 * @returns {HTMLElement|null} Elemento o null
 */
function safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`⚠️ Elemento no encontrado: #${id}`);
    }
    return element;
}

/**
 * Agrega clase a elemento de forma segura
 * @param {HTMLElement|string} elementOrId - Elemento o ID
 * @param {string} className - Clase a agregar
 */
function safeAddClass(elementOrId, className) {
    const element = typeof elementOrId === 'string' 
        ? document.getElementById(elementOrId) 
        : elementOrId;
    
    if (element) {
        element.classList.add(className);
    }
}

/**
 * Remueve clase de elemento de forma segura
 * @param {HTMLElement|string} elementOrId - Elemento o ID
 * @param {string} className - Clase a remover
 */
function safeRemoveClass(elementOrId, className) {
    const element = typeof elementOrId === 'string' 
        ? document.getElementById(elementOrId) 
        : elementOrId;
    
    if (element) {
        element.classList.remove(className);
    }
}

/**
 * Alterna clase de elemento de forma segura
 * @param {HTMLElement|string} elementOrId - Elemento o ID
 * @param {string} className - Clase a alternar
 */
function safeToggleClass(elementOrId, className) {
    const element = typeof elementOrId === 'string' 
        ? document.getElementById(elementOrId) 
        : elementOrId;
    
    if (element) {
        element.classList.toggle(className);
    }
}

/**
 * Muestra/oculta elemento de forma segura
 * @param {HTMLElement|string} elementOrId - Elemento o ID
 * @param {boolean} show - Mostrar (true) u ocultar (false)
 */
function safeShowElement(elementOrId, show = true) {
    const element = typeof elementOrId === 'string' 
        ? document.getElementById(elementOrId) 
        : elementOrId;
    
    if (element) {
        element.style.display = show ? 'block' : 'none';
    }
}

// ============================================================================
// UTILIDADES DE TIMER
// ============================================================================

/**
 * Maneja intervalo de timer de forma centralizada
 * @param {number} startTimestamp - Timestamp de inicio
 * @param {number} duration - Duración en segundos
 * @param {Function} onTick - Callback cada 100ms
 * @param {Function} onComplete - Callback al completar
 * @returns {number} ID del intervalo
 */
function createTimer(startTimestamp, duration, onTick, onComplete) {
    const intervalId = setInterval(() => {
        const remaining = getRemainingTime(startTimestamp, duration);
        
        if (onTick) {
            onTick(remaining);
        }
        
        if (remaining <= 0) {
            clearInterval(intervalId);
            if (onComplete) {
                onComplete();
            }
        }
    }, 100);
    
    return intervalId;
}

/**
 * Crea countdown visual (3-2-1)
 * @param {Function} onCountdown - Callback cada segundo
 * @param {Function} onComplete - Callback al completar
 * @returns {number} ID del intervalo
 */
function createCountdown(onCountdown, onComplete) {
    let count = 3;
    
    const intervalId = setInterval(() => {
        if (onCountdown) {
            onCountdown(count);
        }
        
        count--;
        
        if (count < 0) {
            clearInterval(intervalId);
            if (onComplete) {
                onComplete();
            }
        }
    }, 1000);
    
    return intervalId;
}

// ============================================================================
// UTILIDADES DE DEBUG
// ============================================================================

/**
 * Habilita/deshabilita modo debug
 */
let DEBUG_MODE = false;

function setDebugMode(enabled) {
    DEBUG_MODE = enabled;
    console.log(`🐛 Debug mode: ${enabled ? 'ON' : 'OFF'}`);
}

function debug(message, data = null) {
    if (DEBUG_MODE) {
        console.log(`[DEBUG] ${message}`, data || '');
    }
}

console.log('✅ shared-utils.js cargado');
