/**
 * @file game-client.js
 * @description Cliente SSE mejorado para comunicación en tiempo real
 * Características:
 * - Validación de eventos centralizados
 * - Reconexiones robustas con exponential backoff
 * - Event emitter para eventos específicos
 * - Heartbeat monitor adaptativo
 * - Métricas de conexión
 */

class GameClient {
  constructor(gameId, playerId = null, role = 'player') {
    this.gameId = gameId;
    this.playerId = playerId;
    this.role = role;
    this.eventSource = null;
    this.gameState = null;
    
    // Callbacks heredados (mantener compatibilidad)
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
      lastHeartbeatTime: Date.now(),
      connectionStartTime: null,
      uptime: 0
    };
    
    // Validación de esquema
    this.validateSchema = true;
  }

  /**
   * Suscribirse a eventos específicos
   * @param {string} eventType - Tipo de evento (de COMM.EVENT_TYPES)
   * @param {Function} callback - Callback al recibir evento
   */
  on(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(callback);
    return () => {
      // Return unsubscribe function
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
      
      this.eventSource.onopen = () => {
        this.onConnectionOpen();
      };
      
      this.eventSource.onmessage = (event) => {
        this.onSSEMessage(event);
      };
      
      this.eventSource.onerror = () => {
        this.onSSEError();
      };
      
    } catch (error) {
      console.error(`❌ [${this.role}] Error creando EventSource:`, error);
      this.handleReconnect();
    }
  }

  /**
   * Maneja apertura de conexión SSE
   */
  onConnectionOpen() {
    console.log(`✅ [${this.role}] SSE conectado exitosamente`);
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.lastMessageTime = Date.now();
    this.parseErrorCount = 0;
    this.consecutiveEmptyMessages = 0;
    this.metrics.reconnectsCount === 0 && (this.metrics.reconnectsCount = 0);
    
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
      // Validación básica
      if (!event || !event.data) {
        return;
      }
      
      const dataTrimmed = event.data.trim();
      
      // Ignorar heartbeats y comentarios SSE
      if (!dataTrimmed || dataTrimmed.startsWith(':')) {
        return;
      }
      
      // Parsear JSON
      let newState;
      try {
        newState = JSON.parse(dataTrimmed);
        this.parseErrorCount = 0;
        this.consecutiveEmptyMessages = 0;
      } catch (parseError) {
        this.parseErrorCount++;
        this.metrics.errorsCount++;
        console.warn(`❌ [${this.role}] Error parseando JSON (${this.parseErrorCount}):`, parseError);
        
        if (this.parseErrorCount >= 5) {
          console.error(`❌ [${this.role}] Múltiples errores de parsing - reconectando...`);
          this.handleReconnect();
          this.parseErrorCount = 0;
        }
        return;
      }
      
      // Validación de estructura
      if (!newState || typeof newState !== 'object') {
        this.consecutiveEmptyMessages++;
        if (this.consecutiveEmptyMessages > 10) {
          console.error(`❌ [${this.role}] Estados inválidos consecutivos - reconectando...`);
          this.handleReconnect();
          this.consecutiveEmptyMessages = 0;
        }
        return;
      }
      
      // Evitar actualizaciones duplicadas
      const stateHash = JSON.stringify(newState);
      if (stateHash === this.lastMessageHash) {
        return;
      }
      this.lastMessageHash = stateHash;
      
      // Aplicar estado
      this.gameState = newState;
      console.log(`📨 [${this.role}] Estado actualizado (ronda ${newState.round || 0})`);
      
      // Callback heredado
      if (this.onStateUpdate && typeof this.onStateUpdate === 'function') {
        try {
          this.onStateUpdate(newState);
        } catch (err) {
          console.error(`❌ [${this.role}] Error en callback onStateUpdate:`, err);
        }
      }
      
      // Emitir evento
      this.emit('state:update', newState);
      
    } catch (error) {
      console.error(`❌ [${this.role}] Error inesperado en onSSEMessage:`, error);
    }
  }

  /**
   * Maneja errores SSE
   */
  onSSEError() {
    console.error(`❌ [${this.role}] Error en SSE`);
    this.isConnected = false;
    this.metrics.errorsCount++;
    
    if (this.eventSource.readyState === EventSource.CLOSED) {
      this.handleReconnect();
    }
  }

  /**
   * Monitor de heartbeat
   */
  startHeartbeatMonitor() {
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
    }
    
    this.heartbeatCheckInterval = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      
      if (timeSinceLastMessage > COMM_CONFIG.MESSAGE_TIMEOUT && this.isConnected) {
        console.warn(`⚠️ [${this.role}] No hay mensajes en ${timeSinceLastMessage}ms`);
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
      
      if (this.onConnectionLost && typeof this.onConnectionLost === 'function') {
        this.onConnectionLost();
      }
      return;
    }
    
    this.reconnectAttempts++;
    const delay = COMM.calculateReconnectDelay(this.reconnectAttempts);
    
    console.log(`🔄 [${this.role}] Reconectando en ${Math.floor(delay)}ms (intento ${this.reconnectAttempts}/${COMM_CONFIG.RECONNECT_MAX_ATTEMPTS})`);
    this.metrics.reconnectsCount++;
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
    
    setTimeout(() => {
      this.disconnect();
      this.connect();
    }, delay);
  }

  /**
   * Desconectar
   */
  disconnect() {
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
   * Envía acción al servidor
   */
  async sendAction(action, data = {}) {
    console.log(`📤 [${this.role}] Enviando acción: ${action}`);
    
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
      
      const response = await fetch('/app/actions.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Validar respuesta
      if (!COMM.validateAPIResponse(result)) {
        console.warn(`⚠️ [${this.role}] Respuesta inválida para ${action}`);
      }
      
      console.log(`✅ [${this.role}] Respuesta para ${action}:`, result.success ? '✓' : '✗');
      
      return result;
    } catch (error) {
      console.error(`❌ [${this.role}] Error enviando ${action}:`, error);
      this.metrics.errorsCount++;
      return { success: false, message: 'Error de red: ' + error.message };
    }
  }

  /**
   * Fuerza actualización de estado
   */
  async forceRefresh() {
    console.log(`📤 [${this.role}] Forzando actualización...`);
    
    try {
      const payload = {
        action: 'get_state',
        game_id: this.gameId
      };
      
      if (this.playerId) {
        payload.player_id = this.playerId;
      }
      
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
        
        if (this.onStateUpdate && typeof this.onStateUpdate === 'function') {
          this.onStateUpdate(result.state);
        }
        
        this.emit('state:refreshed', result.state);
      }
    } catch (error) {
      console.error(`❌ [${this.role}] Error forzando actualización:`, error);
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
    return this.isConnected && this.eventSource && this.eventSource.readyState === EventSource.OPEN;
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

/**
 * Obtiene tiempo restante
 */
function getRemainingTime(startTimestamp, duration) {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - startTimestamp;
  return Math.max(0, duration - elapsed);
}

/**
 * Muestra notificación
 */
function showNotification(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
}

console.log('%c✅ GameClient - Sistema robusto de comunicación SSE con validación y event emitter', 'color: #10B981; font-weight: bold');
