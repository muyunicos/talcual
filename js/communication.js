/**
 * @file communication.js
 * @description Sistema centralizado de comunicacion SSE para TalCual
 * Define tipos de eventos y constantes de comunicacion.
 */

const EVENT_TYPES = {
  'GAME_STATE_UPDATE': 'game:state:update',
  'GAME_CREATED': 'game:created',
  'GAME_STARTED': 'game:started',
  'GAME_FINISHED': 'game:finished',
  
  'ROUND_STARTED': 'game:round:started',
  'ROUND_ENDED': 'game:round:ended',
  'ROUND_COUNTDOWN': 'game:round:countdown',
  
  'PLAYER_JOINED': 'game:player:joined',
  'PLAYER_LEFT': 'game:player:left',
  'PLAYER_UPDATED': 'game:player:updated',
  'PLAYER_SCORE_CHANGED': 'game:player:score:changed',
  
  'TIMER_SYNC': 'game:timer:sync',
  'SERVER_TIME': 'server:time',
  
  'SUBMIT_ANSWERS': 'player:answers:submit',
  'PLAYER_READY': 'player:ready',
  'PLAYER_NAME_CHANGED': 'player:name:changed',
  'PLAYER_LEFT': 'player:left',
  
  'HEARTBEAT': 'player:heartbeat',
  'ACK': 'ack'
};

const COMM_CONFIG = {
  HEARTBEAT_INTERVAL: 30000,
  MESSAGE_TIMEOUT: 30000,
  HEARTBEAT_CHECK_INTERVAL: 5000,
  
  RECONNECT_INITIAL_DELAY: 1000,
  RECONNECT_MAX_DELAY: 30000,
  RECONNECT_BACKOFF_MULTIPLIER: 1.5,
  RECONNECT_MAX_ATTEMPTS: 15,
  RECONNECT_JITTER_MAX: 1000,
  
  WORDS_UPDATE_THROTTLE: 2000,
  STATE_UPDATE_THROTTLE: 500,
  
  MAX_WORD_LENGTH: 30,
  MAX_PLAYER_NAME_LENGTH: 20,
  MIN_PLAYER_NAME_LENGTH: 2,
  MAX_WORDS_PER_PLAYER: 6,
  GAME_CODE_LENGTH_MIN: 3,
  GAME_CODE_LENGTH_MAX: 5,
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 20,
  START_COUNTDOWN: 5
};

function syncCommConfigWithServer(serverConfig) {
  if (!serverConfig || typeof serverConfig !== 'object') {
    console.warn('[COMM] Server config invalid, using defaults');
    return;
  }

  const mappings = {
    'max_word_length': 'MAX_WORD_LENGTH',
    'max_player_name_length': 'MAX_PLAYER_NAME_LENGTH',
    'min_player_name_length': 'MIN_PLAYER_NAME_LENGTH',
    'max_words_per_player': 'MAX_WORDS_PER_PLAYER',
    'max_code_length': 'GAME_CODE_LENGTH_MAX',
    'min_players': 'MIN_PLAYERS',
    'max_players': 'MAX_PLAYERS',
    'start_countdown': 'START_COUNTDOWN'
  };

  Object.entries(mappings).forEach(([serverKey, configKey]) => {
    if (serverKey in serverConfig) {
      COMM_CONFIG[configKey] = serverConfig[serverKey];
    }
  });

  console.log(
    '%c🔗 COMM_CONFIG synchronized with server',
    'color: #10B981; font-weight: bold',
    COMM_CONFIG
  );
}

function validateAPIResponse(response) {
  return response && typeof response === 'object' && response.success !== undefined;
}

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

class TimeSyncManager {
  constructor() {
    this.serverStartTime = null;
    this.clientStartTime = null;
    this.offset = 0;
    this.isCalibrated = false;
    this.calibrationError = 0;
    this.roundDuration = 0;
    this.latencyEstimate = 0;
  }

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
      `%c⏱️ TIMER CALIBRADO (SSE)`,
      'color: #3B82F6; font-weight: bold',
      `| server_now: ${serverNow}ms | Offset: ${this.offset}ms | Range: ${roundStartsAt}-${roundEndsAt}`
    );
  }

  calibrateWithRTT(serverNow, rtt) {
    const latencyEstimate = rtt / 2;
    const adjustedServerTime = serverNow + latencyEstimate;
    this.offset = adjustedServerTime - Date.now();
    this.isCalibrated = true;
    this.latencyEstimate = latencyEstimate;
    this.calibrationError = Math.max(30, latencyEstimate * 0.5);
    
    console.log(
      `%c⏱️ SINCRONIZACION FINA (RTT)`,
      'color: #8B5CF6; font-weight: bold',
      `| Latencia estimada: ${latencyEstimate.toFixed(2)}ms | RTT: ${rtt.toFixed(2)}ms | Offset: ${this.offset.toFixed(2)}ms`
    );
  }

  getServerTime() {
    return Date.now() + this.offset;
  }

  getRemainingTime(roundStartedAt, roundDuration) {
    if (!this.isCalibrated) {
      return Math.max(0, roundStartedAt + roundDuration - Date.now());
    }

    const now = this.getServerTime();
    const roundEndTime = roundStartedAt + roundDuration;
    const remaining = roundEndTime - now;
    
    return Math.max(0, remaining);
  }

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
    this.latencyEstimate = 0;
    console.log('%c⏱️ Timer reset para nueva ronda', 'color: #6B7280');
  }

  getDebugInfo() {
    return {
      isCalibrated: this.isCalibrated,
      offset: this.offset,
      calibrationError: this.calibrationError,
      latencyEstimate: this.latencyEstimate,
      serverStartTime: this.serverStartTime,
      clientStartTime: this.clientStartTime,
      serverNow: this.serverNow,
      roundStartsAt: this.roundStartsAt,
      roundEndsAt: this.roundEndsAt,
      currentServerTime: this.getServerTime()
    };
  }
}

const timeSync = new TimeSyncManager();

if (typeof window !== 'undefined') {
  window.COMM = {
    EVENT_TYPES,
    COMM_CONFIG,
    validateAPIResponse,
    calculateReconnectDelay,
    getConnectionHealth,
    syncCommConfigWithServer,
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
    syncCommConfigWithServer,
    TimeSyncManager,
    timeSync
  };
}

console.log('%c✅ communication.js', 'color: #10B981; font-weight: bold');
