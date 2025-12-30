/**
 * @file communication.js
 * @description Sistema centralizado de comunicación SSE para TalCual
 * Define tipos de eventos y constantes de comunicación.
 * 
 * SECURITY NOTE: All input validation must be performed both client-side
 * and server-side. This file defines validation constants for consistency.
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
  // Timeouts - Ajustados para detectar desconexiones rápidamente
  HEARTBEAT_INTERVAL: 30000,        // Intervalo de heartbeat (30s)
  MESSAGE_TIMEOUT: 30000,            // Timeout de inactividad (30s)
  HEARTBEAT_CHECK_INTERVAL: 5000,    // Verificar heartbeat cada 5s
  
  // Reconexión - Exponential backoff con jitter para evitar "thundering herd"
  RECONNECT_INITIAL_DELAY: 1000,           // 1s inicial
  RECONNECT_MAX_DELAY: 30000,              // Máximo 30s entre intentos
  RECONNECT_BACKOFF_MULTIPLIER: 1.5,       // Multiplicador exponencial
  RECONNECT_MAX_ATTEMPTS: 15,               // Máximo 15 intentos (~2min total)
  RECONNECT_JITTER_MAX: 1000,               // Jitter hasta 1s
  
  // Rate limiting - Prevenir saturación del servidor
  WORDS_UPDATE_THROTTLE: 2000,      // Máximo cada 2s para palabras
  STATE_UPDATE_THROTTLE: 500,        // Máximo cada 500ms para estado
  
  // Validación - Límites y restricciones
  MAX_WORD_LENGTH: 50,                      // Longitud máxima de palabra
  MAX_PLAYER_NAME_LENGTH: 20,               // Longitud máxima de nombre
  MIN_PLAYER_NAME_LENGTH: 2,                // Longitud mínima de nombre
  MAX_WORDS_PER_ROUND: 10,                  // Máximo palabras por ronda
  GAME_CODE_LENGTH_MIN: 3,                  // Longitud mínima de código
  GAME_CODE_LENGTH_MAX: 6                   // Longitud máxima de código
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
 * Implementa algoritmo estándar para evitar "thundering herd"
 * 
 * Fórmula:
 * - exponentialDelay = min(initialDelay * (multiplier ^ (attempt - 1)), maxDelay)
 * - finalDelay = exponentialDelay + random(0, jitterMax)
 * 
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
 * Usado para monitoreo y debugging de conexiones
 * 
 * @param {object} connectionMetrics - Métricas de conexión
 * @param {number} connectionMetrics.lastMessageTime - Timestamp del último mensaje
 * @param {number} connectionMetrics.messageCount - Total de mensajes recibidos
 * @param {number} connectionMetrics.errorCount - Total de errores
 * @returns {string} Estado: 'healthy', 'degraded', 'critical'
 */
function getConnectionHealth(connectionMetrics) {
  if (!connectionMetrics) return 'unknown';
  
  const { lastMessageTime, messageCount, errorCount } = connectionMetrics;
  const timeSinceLastMessage = Date.now() - lastMessageTime;
  const errorRate = errorCount / Math.max(messageCount, 1);
  
  // Critical: >50% errores o timeout
  if (errorRate > 0.5 || timeSinceLastMessage > COMM_CONFIG.MESSAGE_TIMEOUT) {
    return 'critical';
  }
  
  // Degraded: >20% errores o inactividad parcial
  if (errorRate > 0.2 || timeSinceLastMessage > COMM_CONFIG.MESSAGE_TIMEOUT / 2) {
    return 'degraded';
  }
  
  // Healthy: bajo error rate y actividad reciente
  return 'healthy';
}

// ============================================================================
// TIMESYNCMANAGER - SINCRONIZACIÓN DE TIEMPO
// ============================================================================

/**
 * Gestor de sincronización de tiempo cliente-servidor
 * Resuelve desincronización de relojes entre dispositivos
 * 
 * Problema: Cada cliente usa su reloj local, causando diferencias de ±5-10s
 * Solución: Calibrar offset respecto a servidor en cada ronda
 * 
 * @class TimeSyncManager
 */
class TimeSyncManager {
  constructor() {
    this.serverStartTime = null;      // Timestamp servidor cuando empezó ronda
    this.clientStartTime = null;      // Timestamp cliente cuando se recibió
    this.offset = 0;                  // Diferencia: serverTime - clientTime
    this.isCalibrated = false;        // ¿Se calibró ya?
    this.calibrationError = 0;        // Error estimado en ms
    this.roundDuration = 0;           // Duración de la ronda en ms
  }

  /**
   * Calibra el offset del reloj usando server_now (PHASE 2)
   * Se ejecuta una vez por ronda cuando recibe server_now
   * 
   * @param {number} serverNow - Timestamp servidor AHORA (ms)
   * @param {number} roundStartsAt - Timestamp cuando comienza la ronda (ms, servidor)
   * @param {number} roundEndsAt - Timestamp cuando termina la ronda (ms, servidor)
   * @param {number} roundDuration - Duración de ronda (ms)
   */
  calibrateWithServerTime(serverNow, roundStartsAt, roundEndsAt, roundDuration = 0) {
    this.serverNow = serverNow;
    this.roundStartsAt = roundStartsAt;
    this.roundEndsAt = roundEndsAt;
    this.clientCalibrateTime = Date.now();
    this.offset = serverNow - this.clientCalibrateTime;
    this.isCalibrated = true;
    this.calibrationError = 50;
    this.roundDuration = roundDuration;
    
    console.log(
      `%c⏱️ TIMER CALIBRADO (server_now)`,
      'color: #3B82F6; font-weight: bold',
      `| server_now: ${serverNow}ms | Offset: ${this.offset}ms | Range: ${roundStartsAt}-${roundEndsAt}`
    );
  }

  /**
   * Calibra el offset del reloj usando timestamp del servidor (LEGACY)
   * Se ejecuta una vez por ronda cuando recibe round_started_at
   * 
   * @param {number} serverTimestamp - Timestamp servidor (ms)
   * @param {number} roundDuration - Duración de ronda (ms)
   */
  calibrate(serverTimestamp, roundDuration = 0) {
    this.serverStartTime = serverTimestamp;
    this.clientStartTime = Date.now();
    this.offset = this.serverStartTime - this.clientStartTime;
    this.isCalibrated = true;
    this.calibrationError = 50;
    this.roundDuration = roundDuration;
    
    console.log(
      `%c⏱️ TIMER CALIBRADO`,
      'color: #3B82F6; font-weight: bold',
      `| Offset: ${this.offset}ms | Error: ±${this.calibrationError}ms | Duración: ${roundDuration}ms`
    );
  }

  /**
   * Obtiene "ahora" sincronizado con servidor
   * @returns {number} Timestamp sincronizado (ms)
   */
  getServerTime() {
    return Date.now() + this.offset;
  }

  /**
   * Calcula tiempo RESTANTE sincronizado
   * CRÍTICO: Se usa en updateTimerDisplay() cada 100ms
   * 
   * @param {number} roundStartedAt - Timestamp inicio ronda (servidor)
   * @param {number} roundDuration - Duración total (ms)
   * @returns {number} Tiempo restante (ms, min 0)
   */
  getRemainingTime(roundStartedAt, roundDuration) {
    if (!this.isCalibrated) {
      return Math.max(0, roundStartedAt + roundDuration - Date.now());
    }

    const now = this.getServerTime();
    const roundEndTime = roundStartedAt + roundDuration;
    const remaining = roundEndTime - now;
    
    return Math.max(0, remaining);
  }

  /**
   * Reinicia calibración para nueva ronda
   */
  reset() {
    this.serverStartTime = null;
    this.clientStartTime = null;
    this.serverNow = null;
    this.roundStartsAt = null;
    this.roundEndsAt = null;
    this.clientCalibrateTime = null;
    this.offset = 0;
    this.isCalibrated = false;
    this.calibrationError = 0;
    this.roundDuration = 0;
    console.log('%c⏱️ Timer reset para nueva ronda', 'color: #6B7280');
  }

  /**
   * Información de debugging
   * @returns {object}
   */
  getDebugInfo() {
    return {
      isCalibrated: this.isCalibrated,
      offset: this.offset,
      calibrationError: this.calibrationError,
      serverStartTime: this.serverStartTime,
      clientStartTime: this.clientStartTime,
      serverNow: this.serverNow,
      roundStartsAt: this.roundStartsAt,
      roundEndsAt: this.roundEndsAt,
      currentOffset: Date.now() + this.offset - Date.now()
    };
  }
}

// Instancia global para todos los scripts
const timeSync = new TimeSyncManager();

// ============================================================================
// EXPORT
// ============================================================================

if (typeof window !== 'undefined') {
  window.COMM = {
    EVENT_TYPES,
    COMM_CONFIG,
    validateAPIResponse,
    calculateReconnectDelay,
    getConnectionHealth,
    TimeSyncManager,
    timeSync
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EVENT_TYPES,
    COMM_CONFIG,
    validateAPIResponse,
    calculateReconnectDelay,
    getConnectionHealth,
    TimeSyncManager,
    timeSync
  };
}

console.log('%c✅ communication.js cargado - Sistema centralizado de eventos + TimeSyncManager mejorado', 'color: #10B981; font-weight: bold');
