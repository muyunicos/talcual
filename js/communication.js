/**
 * @file communication.js
 * @description Sistema centralizado de comunicación SSE para TalCual
 * Define tipos de eventos y constantes de comunicación.
 */

// ============================================================================
// TIPOS DE EVENTOS
// ============================================================================

const EVENT_TYPES = {
  // ========== HOST → CLIENTS ==========
  // Actualizaciones de estado general
  'GAME_STATE_UPDATE': 'game:state:update',
  'GAME_CREATED': 'game:created',
  'GAME_STARTED': 'game:started',
  'GAME_FINISHED': 'game:finished',
  
  // Eventos de ronda
  'ROUND_STARTED': 'game:round:started',
  'ROUND_ENDED': 'game:round:ended',
  'ROUND_COUNTDOWN': 'game:round:countdown',
  
  // Eventos de jugadores
  'PLAYER_JOINED': 'game:player:joined',
  'PLAYER_LEFT': 'game:player:left',
  'PLAYER_UPDATED': 'game:player:updated',
  'PLAYER_SCORE_CHANGED': 'game:player:score:changed',
  
  // Sincronización
  'TIMER_SYNC': 'game:timer:sync',
  'SERVER_TIME': 'server:time',
  
  // ========== CLIENT → HOST ==========
  // Acciones del jugador
  'SUBMIT_ANSWERS': 'player:answers:submit',
  'PLAYER_READY': 'player:ready',
  'PLAYER_NAME_CHANGED': 'player:name:changed',
  'PLAYER_LEFT': 'player:left',
  
  // Sincronización
  'HEARTBEAT': 'player:heartbeat',
  'ACK': 'ack'
};

// ============================================================================
// CONSTANTES DE COMUNICACIÓN
// ============================================================================

const COMM_CONFIG = {
  // Timeouts
  HEARTBEAT_INTERVAL: 30000,
  MESSAGE_TIMEOUT: 30000,
  HEARTBEAT_CHECK_INTERVAL: 5000,
  
  // Reconexión
  RECONNECT_INITIAL_DELAY: 1000,
  RECONNECT_MAX_DELAY: 30000,
  RECONNECT_BACKOFF_MULTIPLIER: 1.5,
  RECONNECT_MAX_ATTEMPTS: 15,
  RECONNECT_JITTER_MAX: 1000,
  
  // Rate limiting
  WORDS_UPDATE_THROTTLE: 2000,
  STATE_UPDATE_THROTTLE: 500,
  
  // Validación
  MAX_WORD_LENGTH: 50,
  MAX_PLAYER_NAME_LENGTH: 20,
  MIN_PLAYER_NAME_LENGTH: 2,
  MAX_WORDS_PER_ROUND: 10,
  GAME_CODE_LENGTH_MIN: 3,
  GAME_CODE_LENGTH_MAX: 6
};

// ============================================================================
// VALIDACIÓN DE API
// ============================================================================

/**
 * Valida respuesta de API
 * @param {object} response
 * @returns {boolean}
 */
function validateAPIResponse(response) {
  return response && typeof response === 'object' && response.success !== undefined;
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Calcula delay de reconexión con backoff exponencial + jitter
 * @param {number} attemptNumber - Número de intento (base 1)
 * @returns {number} Delay en ms
 */
function calculateReconnectDelay(attemptNumber) {
  const exponentialDelay = Math.min(
    COMM_CONFIG.RECONNECT_INITIAL_DELAY * Math.pow(
      COMM_CONFIG.RECONNECT_BACKOFF_MULTIPLIER,
      attemptNumber - 1
    ),
    COMM_CONFIG.RECONNECT_MAX_DELAY
  );
  
  const jitter = Math.random() * COMM_CONFIG.RECONNECT_JITTER_MAX;
  return exponentialDelay + jitter;
}

/**
 * Obtiene el estado de salud de la conexión
 * @param {object} connectionMetrics - Métricas de conexión
 * @returns {string} Estado: 'healthy', 'degraded', 'critical'
 */
function getConnectionHealth(connectionMetrics) {
  if (!connectionMetrics) return 'unknown';
  
  const { lastMessageTime, messageCount, errorCount } = connectionMetrics;
  const timeSinceLastMessage = Date.now() - lastMessageTime;
  const errorRate = errorCount / Math.max(messageCount, 1);
  
  if (errorRate > 0.5 || timeSinceLastMessage > COMM_CONFIG.MESSAGE_TIMEOUT) {
    return 'critical';
  }
  
  if (errorRate > 0.2 || timeSinceLastMessage > COMM_CONFIG.MESSAGE_TIMEOUT / 2) {
    return 'degraded';
  }
  
  return 'healthy';
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof window !== 'undefined') {
  window.COMM = {
    EVENT_TYPES,
    COMM_CONFIG,
    validateAPIResponse,
    calculateReconnectDelay,
    getConnectionHealth
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EVENT_TYPES,
    COMM_CONFIG,
    validateAPIResponse,
    calculateReconnectDelay,
    getConnectionHealth
  };
}

console.log('%c✅ communication.js cargado - Sistema centralizado de eventos', 'color: #10B981; font-weight: bold');
