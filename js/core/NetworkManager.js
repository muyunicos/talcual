/**
 * NetworkManager.js
 * @description Unified network communication module for TalCual
 * - SSE client for real-time game state synchronization
 * - Communication constants and configurations
 * - Time synchronization for client-server alignment
 * - Connection health monitoring and automatic reconnection
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

class GameClient {
  constructor(gameId, playerId = null, role = 'player') {
    this.gameId = gameId;
    this.playerId = playerId;
    this.role = role;
    this.eventSource = null;
    this.gameState = null;
    
    this.onStateUpdate = null;
    this.onConnectionLost = null;
    
    this.eventListeners = new Map();
    
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.lastMessageTime = Date.now();
    this.lastMessageHash = null;
    
    this.heartbeatCheckInterval = null;
    this.parseErrorCount = 0;
    this.consecutiveEmptyMessages = 0;
    
    this.metrics = {
      messagesReceived: 0,
      errorsCount: 0,
      reconnectsCount: 0,
      lastHeartbeatTime: Date.now(),
      connectionStartTime: null,
      uptime: 0,
      latencyEstimate: 0,
      latencySamples: []
    };
    
    this.validateSchema = true;
  }

  getCommConfig() {
    return {
      MESSAGE_TIMEOUT: COMM_CONFIG.MESSAGE_TIMEOUT,
      HEARTBEAT_CHECK_INTERVAL: COMM_CONFIG.HEARTBEAT_CHECK_INTERVAL,
      RECONNECT_MAX_ATTEMPTS: COMM_CONFIG.RECONNECT_MAX_ATTEMPTS,
      RECONNECT_INITIAL_DELAY: COMM_CONFIG.RECONNECT_INITIAL_DELAY,
      RECONNECT_MAX_DELAY: COMM_CONFIG.RECONNECT_MAX_DELAY,
      RECONNECT_BACKOFF_MULTIPLIER: COMM_CONFIG.RECONNECT_BACKOFF_MULTIPLIER,
      RECONNECT_JITTER_MAX: COMM_CONFIG.RECONNECT_JITTER_MAX
    };
  }

  on(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(callback);
    return () => {
      const callbacks = this.eventListeners.get(eventType);
      const idx = callbacks.indexOf(callback);
      if (idx > -1) callbacks.splice(idx, 1);
    };
  }

  emit(eventType, data) {
    const callbacks = this.eventListeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[ERROR] [${this.role}] Event listener for ${eventType}:`, err);
        }
      });
    }
  }

  safeCallCallback(callback, data, callbackName) {
    if (!callback || typeof callback !== 'function') return;
    try {
      callback(data);
    } catch (err) {
      console.error(`[ERROR] [${this.role}] ${callbackName}:`, err);
    }
  }

  async _makeRequest(payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const t0 = performance.now();
    
    try {
      const response = await fetch('app/actions.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      const t1 = performance.now();
      const rtt = t1 - t0;
      
      this.updateLatencyMetrics(rtt);
      
      if (result && typeof result === 'object') {
        if (result.server_now && !timeSync.isCalibrated) {
          timeSync.calibrateWithRTT(result.server_now, rtt);
        }
      }
      
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout: 30s');
      }
      throw error;
    }
  }

  updateLatencyMetrics(rtt) {
    this.metrics.latencySamples.push(rtt);
    if (this.metrics.latencySamples.length > 20) {
      this.metrics.latencySamples.shift();
    }
    
    const sum = this.metrics.latencySamples.reduce((a, b) => a + b, 0);
    this.metrics.latencyEstimate = sum / this.metrics.latencySamples.length;
  }

  connect() {
    let sseUrl = `/app/sse-stream.php?game_id=${encodeURIComponent(this.gameId)}`;
    if (this.playerId) {
      sseUrl += `&player_id=${encodeURIComponent(this.playerId)}`;
    }
    
    console.log(`[INFO] [${this.role}] Connecting to SSE: ${sseUrl}`);
    
    try {
      this.eventSource = new EventSource(sseUrl);
      this.metrics.connectionStartTime = Date.now();
      
      this.eventSource.onopen = () => this.onConnectionOpen();
      this.eventSource.onmessage = (event) => this.onSSEMessage(event);
      this.eventSource.onerror = () => this.onSSEError();
      
      if (this.eventSource && typeof this.eventSource.addEventListener === 'function') {
        this.eventSource.addEventListener('update', (event) => {
          console.log(`[INFO] [${this.role}] SSE 'update' event received`);
          this.onSSEMessage(event);
        });
      }
      
    } catch (error) {
      console.error(`[ERROR] [${this.role}] Creating EventSource:`, error);
      this.handleReconnect();
    }
  }

  onConnectionOpen() {
    console.log(`[INFO] [${this.role}] SSE connected successfully`);
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.lastMessageTime = Date.now();
    this.parseErrorCount = 0;
    this.consecutiveEmptyMessages = 0;
    
    this.startHeartbeatMonitor();
    this.emit('connected', { timestamp: Date.now() });
  }

  onSSEMessage(event) {
    this.lastMessageTime = Date.now();
    this.metrics.messagesReceived++;
    
    try {
      if (!event || !event.data) return;
      
      const dataTrimmed = event.data.trim();
      if (!dataTrimmed || dataTrimmed.startsWith(':')) return;
      
      let newState;
      try {
        newState = JSON.parse(dataTrimmed);
        
        if (!newState || typeof newState !== 'object') {
          this.consecutiveEmptyMessages++;
          if (this.consecutiveEmptyMessages > 10) {
            console.error(`[ERROR] [${this.role}] Multiple invalid states - reconnecting...`);
            this.handleReconnect();
            this.consecutiveEmptyMessages = 0;
          }
          return;
        }
        
        this.parseErrorCount = 0;
        this.consecutiveEmptyMessages = 0;
      } catch (parseError) {
        this.parseErrorCount++;
        this.metrics.errorsCount++;
        console.warn(`[WARN] [${this.role}] JSON parse error (${this.parseErrorCount}):`, parseError);
        
        if (this.parseErrorCount >= 5) {
          console.error(`[ERROR] [${this.role}] Multiple parse errors - reconnecting...`);
          this.handleReconnect();
          this.parseErrorCount = 0;
        }
        return;
      }
      
      const stateHash = JSON.stringify(newState);
      if (stateHash === this.lastMessageHash) return;
      this.lastMessageHash = stateHash;
      
      this.gameState = newState;
      const playerCount = newState.players ? Object.keys(newState.players).length : 0;
      console.log(`[INFO] [${this.role}] State updated (round ${newState.round || 0}, ${playerCount} players, word: ${newState.current_word || 'N/A'})`);
      
      this.safeCallCallback(this.onStateUpdate, newState, 'onStateUpdate');
      this.emit('state:update', newState);
      
    } catch (error) {
      console.error(`[ERROR] [${this.role}] Unexpected error in onSSEMessage:`, error);
    }
  }

  onSSEError() {
    console.error(`[ERROR] [${this.role}] SSE error`);
    this.isConnected = false;
    this.metrics.errorsCount++;
    
    if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
      this.handleReconnect();
    }
  }

  startHeartbeatMonitor() {
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
    }
    
    const commConfig = this.getCommConfig();
    this.heartbeatCheckInterval = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      
      if (timeSinceLastMessage > commConfig.MESSAGE_TIMEOUT && this.isConnected) {
        console.warn(`[WARN] [${this.role}] No messages for ${timeSinceLastMessage}ms`);
        this.handleReconnect();
      }
    }, commConfig.HEARTBEAT_CHECK_INTERVAL);
  }

  handleReconnect() {
    const commConfig = this.getCommConfig();
    
    if (this.reconnectAttempts >= commConfig.RECONNECT_MAX_ATTEMPTS) {
      console.error(`[ERROR] [${this.role}] Max reconnect attempts reached`);
      this.emit('connection:failed', { attempts: this.reconnectAttempts });
      this.safeCallCallback(this.onConnectionLost, null, 'onConnectionLost');
      return;
    }
    
    this.reconnectAttempts++;
    this.metrics.reconnectsCount++;
    
    const delay = calculateReconnectDelay(this.reconnectAttempts);
    
    console.log(`[INFO] [${this.role}] Reconnecting in ${Math.floor(delay)}ms (attempt ${this.reconnectAttempts}/${commConfig.RECONNECT_MAX_ATTEMPTS})`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
    
    setTimeout(() => {
      this.disconnect();
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
      this.heartbeatCheckInterval = null;
    }
    
    this.eventListeners.clear();
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      console.log(`[INFO] [${this.role}] SSE disconnected`);
    }
    
    this.reconnectAttempts = 0;
  }

  async sendAction(action, data = {}) {
    console.log(`[INFO] [${this.role}] Sending action: ${action}`);
    
    const criticalActions = [
      'join_game',
      'leave_game',
      'start_round',
      'end_round',
      'submit_answers'
    ];
    
    try {
      const payload = {
        action: action,
        game_id: this.gameId,
        ...data
      };
      
      if (this.playerId && [
        'join_game',
        'submit_answers',
        'leave_game',
        'update_player_name'
      ].includes(action)) {
        payload.player_id = this.playerId;
      }
      
      const result = await this._makeRequest(payload);
      
      if (result && typeof result === 'object' && result.success !== undefined) {
        console.log(`[INFO] [${this.role}] ${action}: ${result.success ? 'success' : 'failed'}`);
        
        if (criticalActions.includes(action) && result.state) {
          const playerCount = result.state.players ? Object.keys(result.state.players).length : 0;
          console.log(`[INFO] [${this.role}] Critical action emitted: ${action} (${playerCount} players, word: ${result.state.current_word || 'N/A'})`);
          
          this.gameState = result.state;
          this.lastMessageHash = JSON.stringify(result.state);
          this.lastMessageTime = Date.now();
          
          this.safeCallCallback(this.onStateUpdate, result.state, 'onStateUpdate (immediate)');
          this.emit('state:update', result.state);
        }
      }
      
      return result;
    } catch (error) {
      console.error(`[ERROR] [${this.role}] Sending ${action}:`, error);
      this.metrics.errorsCount++;
      return { success: false, message: 'Network error: ' + error.message };
    }
  }

  async forceRefresh() {
    console.log(`[INFO] [${this.role}] Forcing state refresh...`);
    
    try {
      const payload = {
        action: 'get_state',
        game_id: this.gameId
      };
      
      if (this.playerId) {
        payload.player_id = this.playerId;
      }
      
      const result = await this._makeRequest(payload);
      
      if (result.success && result.state) {
        this.gameState = result.state;
        this.lastMessageHash = JSON.stringify(result.state);
        this.lastMessageTime = Date.now();
        
        this.safeCallCallback(this.onStateUpdate, result.state, 'onStateUpdate (forceRefresh)');
        this.emit('state:refreshed', result.state);
      }
    } catch (error) {
      console.error(`[ERROR] [${this.role}] Force refresh:`, error);
    }
  }

  getState() {
    return this.gameState;
  }

  isAlive() {
    return this.isConnected && this.eventSource && this.eventSource.readyState === EventSource.OPEN;
  }

  getMetrics() {
    const uptime = this.metrics.connectionStartTime
      ? Date.now() - this.metrics.connectionStartTime
      : 0;
    
    const connectionHealth = getConnectionHealth({
      lastMessageTime: this.lastMessageTime,
      messageCount: this.metrics.messagesReceived,
      errorCount: this.metrics.errorsCount
    });
    
    return {
      ...this.metrics,
      uptime,
      health: connectionHealth
    };
  }
}

if (typeof window !== 'undefined') {
  window.COMM = {
    EVENT_TYPES,
    COMM_CONFIG,
    validateAPIResponse,
    calculateReconnectDelay,
    getConnectionHealth,
    syncCommConfigWithServer,
    TimeSyncManager,
    timeSync,
    GameClient
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
    timeSync,
    GameClient
  };
}

console.log('%c✅ NetworkManager.js (consolidated)', 'color: #10B981; font-weight: bold');