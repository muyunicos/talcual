/**
 * @file game-client.js
 * @description Cliente SSE
 */

class GameClient {
  constructor(gameId, playerId = null, role = 'player') {
    this.gameId = gameId;
    this.playerId = playerId;
    this.role = role;
    this.eventSource = null;
    this.gameState = null;
    
    // Callbacks heredados
    this.onStateUpdate = null;
    this.onConnectionLost = null;
    
    // Event listeners
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
   * Obtiene configuración de comunicación con fallback
   */
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
   * Helper seguro para llamar callbacks
   * @param {Function} callback - Función a ejecutar
   * @param {*} data - Datos a pasar
   * @param {string} callbackName - Nombre para logging
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
   * Helper para hacer requests HTTP con timeout
   * @param {Object} payload - Datos a enviar
   * @returns {Promise<Object>} Respuesta JSON
   */
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

  /**
   * Conecta a SSE
   */
  connect() {
    // FIX #38: Enviar player_id en la URL de SSE para que el servidor sepa a quién notificar
    let sseUrl = `/app/sse-stream.php?game_id=${encodeURIComponent(this.gameId)}`;
    if (this.playerId) {
      sseUrl += `&player_id=${encodeURIComponent(this.playerId)}`;
    }
    
    console.log(`🔌 [${this.role}] Conectando a SSE: ${sseUrl}`);
    
    try {
      this.eventSource = new EventSource(sseUrl);
      this.metrics.connectionStartTime = Date.now();
      
      this.eventSource.onopen = () => this.onConnectionOpen();
      this.eventSource.onmessage = (event) => this.onSSEMessage(event);
      this.eventSource.onerror = () => this.onSSEError();
      
      // 🔧 FIX #34: Agregar listener explícito para evento 'update'
      // El servidor envía: event: update\ndata: {...}
      // EventSource necesita addEventListener('update') para recibirlo
      if (this.eventSource && typeof this.eventSource.addEventListener === 'function') {
        this.eventSource.addEventListener('update', (event) => {
          console.log(`📨 [${this.role}] Evento SSE 'update' recibido`);
          this.onSSEMessage(event);
        });
      }
      
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
    // 🔧 FIX #22: No es necesario resetear reconnectsCount cada conexión exitosa
    // Solo incrementarlo en handleReconnect(). Eliminar línea redundante.
    
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
      
      if (!newState || typeof newState !== 'object') {
        this.consecutiveEmptyMessages++;
        if (this.consecutiveEmptyMessages > 10) {
          console.error(`❌ [${this.role}] Estados inválidos consecutivos - reconectando...`);
          this.handleReconnect();
          this.consecutiveEmptyMessages = 0;
        }
        return;
      }
      
      const stateHash = JSON.stringify(newState);
      if (stateHash === this.lastMessageHash) return;
      this.lastMessageHash = stateHash;
      
      this.gameState = newState;
      const playerCount = newState.players ? Object.keys(newState.players).length : 0;
      console.log(`📨 [${this.role}] Estado actualizado (ronda ${newState.round || 0}, ${playerCount} jugadores, palabra: ${newState.current_word || 'N/A'})`);
      
      this.safeCallCallback(this.onStateUpdate, newState, 'onStateUpdate');
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
    
    // ✅ FIX: Validar que eventSource existe antes de acceder readyState
    if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
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
    
    const commConfig = this.getCommConfig();
    this.heartbeatCheckInterval = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      
      if (timeSinceLastMessage > commConfig.MESSAGE_TIMEOUT && this.isConnected) {
        console.warn(`⚠️ [${this.role}] No hay mensajes en ${timeSinceLastMessage}ms`);
        this.handleReconnect();
      }
    }, commConfig.HEARTBEAT_CHECK_INTERVAL);
  }

  /**
   * Maneja reconexiones con backoff exponencial
   */
  handleReconnect() {
    const commConfig = this.getCommConfig();
    
    if (this.reconnectAttempts >= commConfig.RECONNECT_MAX_ATTEMPTS) {
      console.error(`❌ [${this.role}] Máximo de reconexiones alcanzado`);
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
    
    console.log(`🔄 [${this.role}] Reconectando en ${Math.floor(delay)}ms (intento ${this.reconnectAttempts}/${commConfig.RECONNECT_MAX_ATTEMPTS})`);
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
    
    this.eventListeners.clear();
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      console.log(`🔌 [${this.role}] SSE desconectado`);
    }
    
    // ✅ FIX #14: Resetear reconnectAttempts cuando se desconecta para evitar
    // que se agoten los intentos prematuramente durante reconexiones múltiples
    this.reconnectAttempts = 0;
  }

  /**
   * ✅ MEJORA #28: Envía acción al servidor con emisión inmediata de eventos críticos
   * Reduce latencia emitiendo cambios inmediatamente sin esperar SSE
   */
  async sendAction(action, data = {}) {
    console.log(`📤 [${this.role}] Enviando acción: ${action}`);
    
    // ✅ MEJORA #28: Lista de acciones críticas que se emiten inmediatamente
    const criticalActions = [
      'join_game',      // Jugador se une
      'leave_game',     // Jugador se va
      'start_round',    // Host inicia ronda
      'end_round',      // Host termina ronda
      'submit_answers'  // Jugador envía respuestas
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
        console.log(`✅ [${this.role}] Respuesta para ${action}:`, result.success ? '✓' : '✗');
        
        // ✅ MEJORA #28: Si es acción crítica y la respuesta contiene estado,
        // emitir inmediatamente sin esperar SSE
        if (criticalActions.includes(action) && result.state) {
          const playerCount = result.state.players ? Object.keys(result.state.players).length : 0;
          console.log(`⚡ [${this.role}] Emitiendo evento crítico inmediatamente: ${action} (${playerCount} jugadores, palabra: ${result.state.current_word || 'N/A'})`);
          
          this.gameState = result.state;
          this.lastMessageHash = JSON.stringify(result.state);
          this.lastMessageTime = Date.now();
          
          // Emitir evento inmediatamente (no esperar SSE)
          this.safeCallCallback(this.onStateUpdate, result.state, 'onStateUpdate (immediate)');
          this.emit('state:update', result.state);
        }
      }
      
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
      
      const result = await this._makeRequest(payload);
      
      if (result.success && result.state) {
        this.gameState = result.state;
        this.lastMessageHash = JSON.stringify(result.state);
        this.lastMessageTime = Date.now();
        
        this.safeCallCallback(this.onStateUpdate, result.state, 'onStateUpdate (forceRefresh)');
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

console.log('%c✅ GameClient - FIX #38: Enviar player_id en SSE para notificación correcta', 'color: #10B981; font-weight: bold');