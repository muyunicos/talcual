/**
 * GameClient - SSE client for multiplayer game state synchronization
 */

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
      uptime: 0
    };
    
    this.validateSchema = true;
  }

  getCommConfig() {
    return window.COMM?.COMM_CONFIG || {
      MESSAGE_TIMEOUT: 30000,
      HEARTBEAT_CHECK_INTERVAL: 5000,
      RECONNECT_MAX_ATTEMPTS: 15,
      RECONNECT_INITIAL_DELAY: 1000,
      RECONNECT_MAX_DELAY: 30000,
      RECONNECT_BACKOFF_MULTIPLIER: 1.5,
      RECONNECT_JITTER_MAX: 1000
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
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout: 30s');
      }
      throw error;
    }
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
    
    let delay;
    if (window.COMM?.calculateReconnectDelay) {
      delay = COMM.calculateReconnectDelay(this.reconnectAttempts);
    } else {
      const exponentialDelay = Math.min(
        commConfig.RECONNECT_INITIAL_DELAY * Math.pow(
          commConfig.RECONNECT_BACKOFF_MULTIPLIER,
          this.reconnectAttempts - 1
        ),
        commConfig.RECONNECT_MAX_DELAY
      );
      delay = exponentialDelay + Math.random() * commConfig.RECONNECT_JITTER_MAX;
    }
    
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
    
    const connectionHealth = window.COMM?.getConnectionHealth
      ? COMM.getConnectionHealth({
          lastMessageTime: this.lastMessageTime,
          messageCount: this.metrics.messagesReceived,
          errorCount: this.metrics.errorsCount
        })
      : 'unknown';
    
    return {
      ...this.metrics,
      uptime,
      health: connectionHealth
    };
  }
}

function getRemainingTime(startTimestamp, duration) {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - startTimestamp;
  return Math.max(0, duration - elapsed);
}

function showNotification(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
}