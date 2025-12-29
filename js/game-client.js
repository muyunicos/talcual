/**
 * @file game-client.js
 * @description Cliente SSE robusto para comunicación en tiempo real
 * - Reconexiones con exponential backoff
 * - Event emitter interno
 * - Heartbeat monitor adaptativo
 * - Métricas de conexión
 * - Manejo de errores robusto
 */

class GameClient {
  constructor(gameId, playerId = null, role = 'player') {
    this.gameId = gameId;
    this.playerId = playerId;
    this.role = role;
    this.eventSource = null;
    this.gameState = null;
    
    // Callbacks heredados (compatibilidad)
    this.onStateUpdate = null;
    this.onConnectionLost = null;
    
    // Event listeners (nuevo sistema)
    this.eventListeners = new Map();
    
    // Estado de conexión
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.lastMessageTime = Date.now();
    this.lastMessageHash = null;
    
    // Monitores
    this.heartbeatCheckInterval = null;
    this.parseErrorCount = 0;
    this.consecutiveEmptyMessages = 0;
    
    // Métricas
    this.metrics = {
      messagesReceived: 0,
      errorsCount: 0,
      reconnectsCount: 0,
      connectionStartTime: null,
      uptime: 0
    };
  }

  /**
   * Suscribirse a eventos
   */
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

  /**
   * Emitir evento a listeners
   */
  emit(eventType, data) {
    const callbacks = this.eventListeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[${this.role}] Error en listener para ${eventType}:`, err);
        }
      });
    }
  }

  /**
   * Conecta a SSE
   */
  connect() {
    const sseUrl = `/app/sse-stream.php?game_id=${encodeURIComponent(this.gameId)}`;
    console.log(`🔌 [${this.role}] Conectando a SSE: ${sseUrl}`);
    
    try {
      this.eventSource = new EventSource(sseUrl);
      this.metrics.connectionStartTime = Date.now();
      
      this.eventSource.onopen = () => this.onConnectionOpen();
      this.eventSource.onmessage = (event) => this.onSSEMessage(event);
      this.eventSource.onerror = () => this.onSSEError();
      
    } catch (error) {
      console.error(`❌ [${this.role}] Error creando EventSource:`, error);
      this.handleReconnect();
    }
  }

  /**
   * Maneja apertura de conexión
   */
  onConnectionOpen() {
    console.log(`✅ [${this.role}] SSE conectado`);
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.lastMessageTime = Date.now();
    this.parseErrorCount = 0;
    this.consecutiveEmptyMessages = 0;
    this.startHeartbeatMonitor();
    this.emit('connected', { timestamp: Date.now() });
  }

  /**
   * Maneja mensaje SSE
   */
  onSSEMessage(event) {
    this.lastMessageTime = Date.now();
    this.metrics.messagesReceived++;
    
    try {
      if (!event || !event.data) return;
      
      const dataTrimmed = event.data.trim();
      if (!dataTrimmed || dataTrimmed.startsWith(':')) return;
      
      // Parsear JSON
      let newState;
      try {
        newState = JSON.parse(dataTrimmed);
        this.parseErrorCount = 0;
        this.consecutiveEmptyMessages = 0;
      } catch (parseError) {
        this.parseErrorCount++;
        this.metrics.errorsCount++;
        console.warn(`❌ [${this.role}] Error parseando JSON (${this.parseErrorCount})`);
        
        if (this.parseErrorCount >= 5) {
          console.error(`❌ [${this.role}] Reconectando por parsing errors`);
          this.handleReconnect();
          this.parseErrorCount = 0;
        }
        return;
      }
      
      // Validación de estructura
      if (!newState || typeof newState !== 'object') {
        this.consecutiveEmptyMessages++;
        if (this.consecutiveEmptyMessages > 10) {
          console.error(`❌ [${this.role}] Reconectando por estados inválidos`);
          this.handleReconnect();
          this.consecutiveEmptyMessages = 0;
        }
        return;
      }
      
      // Evitar actualizaciones duplicadas
      const stateHash = JSON.stringify(newState);
      if (stateHash === this.lastMessageHash) return;
      this.lastMessageHash = stateHash;
      
      // Aplicar estado
      this.gameState = newState;
      console.log(`📨 [${this.role}] Estado actualizado`);
      
      this.safeCallCallback(this.onStateUpdate, newState, 'onStateUpdate');
      this.emit('state:update', newState);
      
    } catch (error) {
      console.error(`❌ [${this.role}] Error en onSSEMessage:`, error);
    }
  }

  /**
   * Maneja errores SSE
   */
  onSSEError() {
    console.error(`❌ [${this.role}] Error en SSE`);
    this.isConnected = false;
    this.metrics.errorsCount++;
    
    if (this.eventSource?.readyState === EventSource.CLOSED) {
      this.handleReconnect();
    }
  }

  /**
   * Monitor de heartbeat
   */
  startHeartbeatMonitor() {
    if (this.heartbeatCheckInterval) clearInterval(this.heartbeatCheckInterval);
    
    this.heartbeatCheckInterval = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      
      if (timeSinceLastMessage > COMM_CONFIG.MESSAGE_TIMEOUT && this.isConnected) {
        console.warn(`⚠️ [${this.role}] Sin mensajes ${timeSinceLastMessage}ms`);
        this.handleReconnect();
      }
    }, COMM_CONFIG.HEARTBEAT_CHECK_INTERVAL);
  }

  /**
   * Maneja reconexiones con backoff exponencial
   */
  handleReconnect() {
    if (this.reconnectAttempts >= COMM_CONFIG.RECONNECT_MAX_ATTEMPTS) {
      console.error(`❌ [${this.role}] Máximo de reconexiones alcanzado`);
      this.emit('connection:failed', { attempts: this.reconnectAttempts });
      this.safeCallCallback(this.onConnectionLost, null, 'onConnectionLost');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.getReconnectDelay();
    
    console.log(`🔄 [${this.role}] Reconectando en ${Math.floor(delay)}ms (intento ${this.reconnectAttempts}/${COMM_CONFIG.RECONNECT_MAX_ATTEMPTS})`);
    this.metrics.reconnectsCount++;
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
    
    setTimeout(() => {
      this.disconnect();
      this.connect();
    }, delay);
  }

  /**
   * Obtiene delay de reconexión
   */
  getReconnectDelay() {
    if (typeof COMM !== 'undefined' && COMM.calculateReconnectDelay) {
      return COMM.calculateReconnectDelay(this.reconnectAttempts);
    }
    // Fallback si COMM no está disponible
    const base = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
    return base + Math.random() * 1000;
  }

  /**
   * Desconectar
   */
  disconnect() {
    // Limpiar listeners
    this.eventListeners.clear();
    
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
      this.heartbeatCheckInterval = null;
    }
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      console.log(`🔌 [${this.role}] SSE desconectado`);
    }
  }

  /**
   * Helper para llamar callbacks con manejo de errores
   */
  safeCallCallback(callback, data, callbackName) {
    if (!callback || typeof callback !== 'function') return;
    try {
      callback(data);
    } catch (err) {
      console.error(`❌ [${this.role}] Error en ${callbackName}:`, err);
    }
  }

  /**
   * Envía acción al servidor
   */
  async sendAction(action, data = {}) {
    console.log(`📤 [${this.role}] Enviando: ${action}`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    try {
      const payload = {
        action: action,
        game_id: this.gameId,
        ...data
      };
      
      if (this.playerId && [
        'join_game', 'submit_answers', 'leave_game', 'update_player_name'
      ].includes(action)) {
        payload.player_id = this.playerId;
      }
      
      const response = await fetch('/app/actions.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!COMM.validateAPIResponse(result)) {
        throw new Error('Respuesta inválida del servidor');
      }
      
      console.log(`✅ [${this.role}] ${action}: ${result.success ? '✓' : '✗'}`);
      return result;
      
    } catch (error) {
      clearTimeout(timeout);
      
      if (error.name === 'AbortError') {
        console.error(`⏱️ [${this.role}] Timeout en ${action}`);
        this.metrics.errorsCount++;
        return { success: false, message: 'Timeout de conexión' };
      }
      
      console.error(`❌ [${this.role}] Error ${action}:`, error.message);
      this.metrics.errorsCount++;
      return { success: false, message: error.message };
    }
  }

  /**
   * Fuerza actualizar estado
   */
  async forceRefresh() {
    console.log(`📤 [${this.role}] Forzando actualización`);
    
    try {
      const payload = {
        action: 'get_state',
        game_id: this.gameId
      };
      
      if (this.playerId) payload.player_id = this.playerId;
      
      const response = await fetch('/app/actions.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (result.success && result.state) {
        this.gameState = result.state;
        this.lastMessageHash = JSON.stringify(result.state);
        this.lastMessageTime = Date.now();
        
        this.safeCallCallback(this.onStateUpdate, result.state, 'onStateUpdate');
        this.emit('state:refreshed', result.state);
      }
    } catch (error) {
      console.error(`❌ [${this.role}] Error actualizando:`, error);
    }
  }

  /**
   * Obtiene estado actual
   */
  getState() {
    return this.gameState;
  }

  /**
   * Verifica si la conexión está viva
   */
  isAlive() {
    return this.isConnected && this.eventSource?.readyState === EventSource.OPEN;
  }

  /**
   * Obtiene métricas de conexión
   */
  getMetrics() {
    const uptime = this.metrics.connectionStartTime
      ? Date.now() - this.metrics.connectionStartTime
      : 0;
    
    return {
      ...this.metrics,
      uptime,
      health: COMM.getConnectionHealth({
        lastMessageTime: this.lastMessageTime,
        messageCount: this.metrics.messagesReceived,
        errorCount: this.metrics.errorsCount
      })
    };
  }
}

// ============================================================================
// UTILIDADES
// ============================================================================

function getRemainingTime(startTimestamp, duration) {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - startTimestamp;
  return Math.max(0, duration - elapsed);
}

function showNotification(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
}

console.log('%c✅ GameClient cargado', 'color: #10B981; font-weight: bold');