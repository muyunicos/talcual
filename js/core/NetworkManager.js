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
  'HEARTBEAT': 'player:heartbeat',
  'ACK': 'ack'
};

const SSE_EVENT_NAMES = [
  'heartbeat', 'connected', 'game_ended', 'sync', 'update',
  'player_joined', 'player_ready', 'player_left', 'player_updated',
  'timer_updated', 'typing', 'connection', 'error'
];

const KNOWN_EVENTS = ['player_joined', 'player_ready', 'player_left', 'player_updated', 'timer_updated', 'typing', 'connection', 'connected'];

const COMM_CONFIG_DEFAULTS = {
  HEARTBEAT_INTERVAL: 15000,
  MESSAGE_TIMEOUT: 35000,
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

const COMM_CONFIG = { ...COMM_CONFIG_DEFAULTS };

function getCommConfig(key) {
  if (typeof configService !== 'undefined' && configService.isConfigReady && configService.isConfigReady()) {
    const serverValue = configService.get(key);
    if (serverValue !== undefined && serverValue !== null) {
      return serverValue;
    }
  }
  return COMM_CONFIG[key];
}

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
}

function validateAPIResponse(response) {
  return response && typeof response === 'object' && response.success !== undefined;
}

function calculateReconnectDelay(attemptNumber) {
  const exponentialDelay = Math.min(
    getCommConfig('RECONNECT_INITIAL_DELAY') * Math.pow(
      getCommConfig('RECONNECT_BACKOFF_MULTIPLIER'),
      attemptNumber - 1
    ),
    getCommConfig('RECONNECT_MAX_DELAY')
  );
  const jitter = Math.random() * getCommConfig('RECONNECT_JITTER_MAX');
  return exponentialDelay + jitter;
}

function getConnectionHealth(connectionMetrics) {
  if (!connectionMetrics) return 'unknown';
  
  const { lastMessageTime, messageCount, errorCount } = connectionMetrics;
  const timeSinceLastMessage = Date.now() - lastMessageTime;
  const errorRate = errorCount / Math.max(messageCount, 1);
  
  if (errorRate > 0.5 || timeSinceLastMessage > getCommConfig('MESSAGE_TIMEOUT')) {
    return 'critical';
  }
  if (errorRate > 0.2 || timeSinceLastMessage > getCommConfig('MESSAGE_TIMEOUT') / 2) {
    return 'degraded';
  }
  return 'healthy';
}

class TimeSyncManager {
  constructor() {
    this.offset = 0;
    this.isCalibrated = false;
    this.calibrationError = 0;
    this.latencyEstimate = 0;
  }

  calibrateWithServerTime(serverNow, roundStartsAt, roundEndsAt, roundDuration = 0) {
    this.clientCalibrateTime = Date.now();
    this.offset = serverNow - this.clientCalibrateTime;
    this.isCalibrated = true;
    this.calibrationError = 50;
  }

  calibrateWithRTT(serverNow, rtt) {
    const latencyEstimate = rtt / 2;
    const adjustedServerTime = serverNow + latencyEstimate;
    this.offset = adjustedServerTime - Date.now();
    this.isCalibrated = true;
    this.latencyEstimate = latencyEstimate;
    this.calibrationError = Math.max(30, latencyEstimate * 0.5);
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
    return Math.max(0, roundEndTime - now);
  }

  reset() {
    this.offset = 0;
    this.isCalibrated = false;
    this.calibrationError = 0;
    this.latencyEstimate = 0;
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
    this.unknownEventCount = 0;
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
          console.error(`[ERROR] Event listener for ${eventType}:`, err);
        }
      });
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
      
      if (result && result.server_now && !timeSync.isCalibrated) {
        timeSync.calibrateWithRTT(result.server_now, rtt);
      }
      
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
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
    
    try {
      this.eventSource = new EventSource(sseUrl);
      this.metrics.connectionStartTime = Date.now();
      this.eventSource.onopen = () => this.onConnectionOpen();
      
      SSE_EVENT_NAMES.forEach(eventName => {
        this.eventSource.addEventListener(eventName, (event) => this.onSSEMessage(event));
      });
      
      this.eventSource.onmessage = (event) => this.onSSEMessage(event);
      this.eventSource.onerror = () => this.onSSEError();
    } catch (error) {
      console.error(`[ERROR] EventSource creation:`, error);
      this.handleReconnect();
    }
  }

  onConnectionOpen() {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.lastMessageTime = Date.now();
    this.parseErrorCount = 0;
    this.consecutiveEmptyMessages = 0;
    this.unknownEventCount = 0;
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
      
      console.log('📡 SSE RECEIVED:', event.type, dataTrimmed.substring(0, 100));
      
      if (event.type === 'heartbeat') {
        console.log('💓 Heartbeat received');
        this.metrics.lastHeartbeatTime = Date.now();
        this.emit('event:heartbeat', { timestamp: Date.now() });
        return;
      }
      
      let messageData;
      try {
        messageData = JSON.parse(dataTrimmed);
        
        if (!messageData || typeof messageData !== 'object') {
          this.consecutiveEmptyMessages++;
          if (this.consecutiveEmptyMessages > 10) {
            console.error('[ERROR] Multiple invalid messages - force refresh');
            this.forceRefresh();
            this.consecutiveEmptyMessages = 0;
          }
          return;
        }
        
        this.parseErrorCount = 0;
        this.consecutiveEmptyMessages = 0;
      } catch (parseError) {
        this.parseErrorCount++;
        this.metrics.errorsCount++;
        console.warn('[WARN] Parse error on SSE message - triggering refresh', parseError);
        
        if (this.parseErrorCount >= 3) {
          console.error('[ERROR] Multiple parse errors - force refresh');
          this.forceRefresh();
          this.parseErrorCount = 0;
        }
        return;
      }

      const messageHash = JSON.stringify(messageData);
      if (messageHash === this.lastMessageHash) return;
      this.lastMessageHash = messageHash;
      
      if (event.type === 'update') {
        this.gameState = messageData;
        
        if (this.onStateUpdate) {
          try {
            this.onStateUpdate(messageData);
          } catch (err) {
            console.error('[ERROR] onStateUpdate callback:', err);
          }
        }
        this.emit('state:update', messageData);
      } else {
        const eventName = event.type;
        const eventPayload = messageData;
        
        this.emit(eventName, eventPayload);
        
        if (KNOWN_EVENTS.includes(eventName)) {
          this.unknownEventCount = 0;
          console.log(`✅ Lightweight event: ${eventName}`);
          this.emit(`event:${eventName}`, eventPayload);
        } else {
          this.unknownEventCount++;
          console.warn(`[WARN] Unknown event type: ${eventName}`);
          
          if (this.unknownEventCount >= 5) {
            console.error('[ERROR] Multiple unknown events - force refresh');
            this.forceRefresh();
            this.unknownEventCount = 0;
          }
        }
      }
      
    } catch (error) {
      console.error('[ERROR] Unexpected error in onSSEMessage:', error);
      this.metrics.errorsCount++;
    }
  }

  onSSEError() {
    console.error('[ERROR] SSE connection error');
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
    
    this.heartbeatCheckInterval = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      
      if (timeSinceLastMessage > getCommConfig('MESSAGE_TIMEOUT') && this.isConnected) {
        console.warn(`[WARN] No messages for ${timeSinceLastMessage}ms`);
        this.handleReconnect();
      }
    }, getCommConfig('HEARTBEAT_CHECK_INTERVAL'));
  }

  handleReconnect() {
    if (this.reconnectAttempts >= getCommConfig('RECONNECT_MAX_ATTEMPTS')) {
      console.error(`[ERROR] Max reconnect attempts reached (${this.reconnectAttempts})`);
      this.emit('connection:failed', { attempts: this.reconnectAttempts });
      if (this.onConnectionLost) {
        try {
          this.onConnectionLost();
        } catch (err) {
          console.error('[ERROR] onConnectionLost callback:', err);
        }
      }
      return;
    }
    
    this.reconnectAttempts++;
    this.metrics.reconnectsCount++;
    
    const delay = calculateReconnectDelay(this.reconnectAttempts);
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
    }
    
    this.reconnectAttempts = 0;
  }

  async _resolveGameId(gameId) {
    const validStatuses = ['waiting', 'playing', 'round_ended', 'finished', 'closed', 'ended'];
    
    try {
      const result = await this._makeRequest({ action: 'get_state', game_id: gameId });
      
      if (!result.success || !result.state) {
        return gameId;
      }

      const state = result.state;
      
      if (validStatuses.includes(state.status)) {
        return gameId;
      }

      const nextId = state.status;
      if (nextId && typeof nextId === 'string' && nextId !== gameId) {
        const nextResult = await this._makeRequest({ action: 'get_state', game_id: nextId });
        if (nextResult.success && nextResult.state) {
          return nextId;
        }
      }

      return gameId;
    } catch (error) {
      console.warn('[WARN] Error resolving game ID:', error);
      return gameId;
    }
  }

  async sendAction(action, data = {}) {
    const criticalActions = [
      'join_game', 'leave_game', 'start_round', 'end_round', 'submit_answers'
    ];
    
    try {
      let resolvedGameId = this.gameId;
      if (['join_game', 'get_state'].includes(action)) {
        resolvedGameId = await this._resolveGameId(this.gameId);
        if (resolvedGameId !== this.gameId) {
          console.log(`🔗 Game ID resolved: ${this.gameId} -> ${resolvedGameId}`);
          this.gameId = resolvedGameId;
        }
      }

      const payload = {
        action: action,
        game_id: resolvedGameId,
        ...data
      };
      
      if (this.playerId && [
        'join_game', 'submit_answers', 'leave_game', 'update_player_name', 'update_player_color', 'typing'
      ].includes(action)) {
        payload.player_id = this.playerId;
      }
      
      const result = await this._makeRequest(payload);
      
      if (result && typeof result === 'object' && result.success !== undefined) {
        if (criticalActions.includes(action) && result.state) {
          this.gameState = result.state;
          this.lastMessageHash = JSON.stringify(result.state);
          this.lastMessageTime = Date.now();
          
          if (this.onStateUpdate) {
            try {
              this.onStateUpdate(result.state);
            } catch (err) {
              console.error('[ERROR] onStateUpdate callback:', err);
            }
          }
          this.emit('state:update', result.state);
        }
      }
      
      return result;
    } catch (error) {
      console.error(`[ERROR] Sending ${action}:`, error);
      this.metrics.errorsCount++;
      return { success: false, message: 'Network error: ' + error.message };
    }
  }

  async forceRefresh() {
    try {
      debug('🔄 Force refresh initiated', null, 'debug');
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
        this.parseErrorCount = 0;
        this.unknownEventCount = 0;
        
        if (this.onStateUpdate) {
          try {
            this.onStateUpdate(result.state);
          } catch (err) {
            console.error('[ERROR] onStateUpdate callback:', err);
          }
        }
        this.emit('state:refreshed', result.state);
        debug('✅ Force refresh completed', null, 'success');
      }
    } catch (error) {
      console.error('[ERROR] Force refresh:', error);
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
    SSE_EVENT_NAMES,
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
    SSE_EVENT_NAMES,
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

console.log('%c✅ NetworkManager.js', 'color: #00aa00; font-weight: bold');