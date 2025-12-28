// game-client-FIXED.js - Cliente para SSE mejorado
// Correciones aplicadas: Validacion robusta, contador de errores, timestamp sync, heartbeat monitor

class GameClient {
  constructor(gameId, playerId = null, role = 'player') {
    this.gameId = gameId;
    this.playerId = playerId;
    this.role = role;
    this.eventSource = null;
    this.gameState = null;
    this.onStateUpdate = null;
    this.onConnectionLost = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.isConnected = false;
    
    // NUEVO: Tracking de errores y sincronizacion
    this.parseErrorCount = 0;
    this.parseErrorThreshold = 5;
    this.consecutiveEmptyMessages = 0;
    this.lastMessageTime = Date.now();
    this.messageTimeout = 30000; // 30 segundos
    this.timeoutCheckInterval = null;
    
    // Para evitar actualizaciones innecesarias
    this.lastStateHash = null;
    this.lastStateTimestamp = 0;
    this.stateVersion = 0;
  }

  // NUEVO: Monitor de heartbeat para detectar conexiones muertas
  startHeartbeatMonitor() {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
    }
    
    this.timeoutCheckInterval = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      
      if (timeSinceLastMessage > this.messageTimeout && this.isConnected) {
        console.warn(`\u26A0\uFE0F [${this.role}] No hay mensajes en ${timeSinceLastMessage}ms - reconectando...`);
        this.handleReconnect();
      }
    }, 10000); // Verificar cada 10 segundos
  }

  connect() {
    const sseUrl = `/app/sse-stream.php?game_id=${encodeURIComponent(this.gameId)}`;
    console.log(`\uD83D\uDD0C [${this.role}] Conectando a SSE: ${sseUrl}`);
    
    try {
      this.eventSource = new EventSource(sseUrl);
      
      this.eventSource.onopen = () => {
        console.log(`\u2705 [${this.role}] SSE conectado exitosamente`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastMessageTime = Date.now();
        this.parseErrorCount = 0; // Reset
        this.startHeartbeatMonitor(); // NUEVO
      };
      
      // Manejo de mensajes
      this.eventSource.onmessage = (event) => {
        this.lastMessageTime = Date.now(); // NUEVO: Registrar que recibimos algo
        
        try {
          // NUEVO: Validacion completa antes de trim()
          if (!event || !event.data) {
            console.debug(`[${this.role}] Evento vacío o sin data`);
            return;
          }
          
          if (typeof event.data !== 'string') {
            console.warn(`[${this.role}] Data no es string:`, typeof event.data);
            return;
          }
          
          const dataTrimmed = event.data.trim();
          
          // Ignorar heartbeats
          if (dataTrimmed === '' || dataTrimmed === ':') {
            console.debug(`[${this.role}] Heartbeat recibido`);
            return;
          }
          
          // NUEVO: Ignorar comentarios SSE
          if (dataTrimmed.startsWith(':')) {
            console.debug(`[${this.role}] Comentario SSE:`, dataTrimmed);
            return;
          }
          
          let newState;
          try {
            newState = JSON.parse(dataTrimmed);
            // Reset de errores si parsea exitosamente
            this.parseErrorCount = 0;
            this.consecutiveEmptyMessages = 0;
            
          } catch (parseError) {
            // NUEVO: Contador de errores de parsing
            this.parseErrorCount++;
            console.warn(`\u274C [${this.role}] Error #${this.parseErrorCount} parseando JSON:`, parseError);
            console.warn(`   Data (primeros 200 chars):`, dataTrimmed.substring(0, 200));
            
            // NUEVO: Reconectar si hay múltiples errores
            if (this.parseErrorCount >= this.parseErrorThreshold) {
              console.error(`\u274C [${this.role}] ${this.parseErrorCount} errores de parsing - reconectando...`);
              this.handleReconnect();
              this.parseErrorCount = 0;
            }
            return;
          }
          
          // NUEVO: Validacion de estructura
          if (!newState || typeof newState !== 'object') {
            this.consecutiveEmptyMessages++;
            if (this.consecutiveEmptyMessages > 10) {
              console.error(`\u274C [${this.role}] Estados inválidos consecutivos - reconectando...`);
              this.handleReconnect();
              this.consecutiveEmptyMessages = 0;
            }
            return;
          }
          
          if (!newState.game_id && newState.message !== 'error') {
            console.warn(`\u26A0\uFE0F [${this.role}] Estado sin game_id:`, newState);
            return;
          }
          
          // NUEVO: Mejor sincronización con timestamp + versión
          const newHash = JSON.stringify(newState);
          const receivedTimestamp = Date.now();
          
          const shouldUpdate = 
            newHash !== this.lastStateHash || 
            receivedTimestamp > this.lastStateTimestamp ||
            (newState._version && newState._version > (this.stateVersion || 0));
          
          if (shouldUpdate) {
            this.gameState = newState;
            this.lastStateHash = newHash;
            this.lastStateTimestamp = receivedTimestamp;
            this.stateVersion = newState._version || 0;
            
            console.log(`\uD83D\uDCE8 [${this.role}] Estado actualizado (v${this.stateVersion}, ronda ${newState.round || 0})`);
            
            if (this.onStateUpdate && typeof this.onStateUpdate === 'function') {
              try {
                this.onStateUpdate(newState);
              } catch (callbackError) {
                console.error(`\u274C [${this.role}] Error en callback onStateUpdate:`, callbackError);
              }
            }
          } else {
            console.debug(`[${this.role}] Estado sin cambios reales (mismo v${this.stateVersion})`);
          }
          
        } catch (error) {
          console.error(`\u274C [${this.role}] Error inesperado en onmessage:`, error);
        }
      };
      
      // Manejo de errores
      this.eventSource.onerror = (error) => {
        console.error(`\u274C [${this.role}] Error en SSE:`, error);
        this.isConnected = false;
        
        if (this.eventSource.readyState === EventSource.CLOSED) {
          this.handleReconnect();
        }
      };
      
    } catch (error) {
      console.error(`\u274C [${this.role}] Error creando EventSource:`, error);
      this.handleReconnect();
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`\u274C [${this.role}] Máximo de reconexiones (${this.maxReconnectAttempts}) alcanzado`);
      
      // NUEVO: Permitir un último intento después de espera larga
      if (this.reconnectAttempts === this.maxReconnectAttempts) {
        console.log(`\u23F1\uFE0F [${this.role}] Esperando 60 segundos antes de último intento...`);
        setTimeout(() => {
          this.reconnectAttempts++;
          this.attemptReconnect();
        }, 60000);
        return;
      }
      
      if (this.onConnectionLost && typeof this.onConnectionLost === 'function') {
        this.onConnectionLost();
      }
      return;
    }
    
    this.reconnectAttempts++;
    
    // NUEVO: Exponential backoff con jitter
    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    const jitter = Math.random() * 1000; // 0-1s jitter
    const delay = baseDelay + jitter;
    
    console.log(`\uD83D\uDD04 [${this.role}] Reconectando en ${Math.floor(delay)}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.attemptReconnect();
    }, delay);
  }

  // NUEVO: Método separado para intentar reconexión
  attemptReconnect() {
    this.disconnect();
    this.connect();
  }

  disconnect() {
    // NUEVO: Limpiar monitor de heartbeat
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = null;
    }
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      console.log(`\uD83D\uDD0C [${this.role}] SSE desconectado`);
    }
  }

  getState() {
    return this.gameState;
  }

  async sendAction(action, data = {}) {
    console.log(`\uD83D\uD4E4 [${this.role}] Enviando acción: ${action}`, data);
    
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
      
      console.log(`\u2705 [${this.role}] Respuesta recibida para ${action}:`, result.success ? '\u2713' : '\u2717');
      
      return result;
    } catch (error) {
      console.error(`\u274C [${this.role}] Error enviando acción ${action}:`, error);
      return { success: false, message: 'Error de red: ' + error.message };
    }
  }

  async forceRefresh() {
    console.log(`\uD83D\uD4E4 [${this.role}] Forzando actualización...`);
    
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
        this.lastStateHash = JSON.stringify(result.state);
        this.lastStateTimestamp = Date.now();
        
        if (this.onStateUpdate && typeof this.onStateUpdate === 'function') {
          this.onStateUpdate(result.state);
        }
      }
    } catch (error) {
      console.error(`\u274C [${this.role}] Error forzando actualización:`, error);
    }
  }

  isAlive() {
    return this.isConnected && this.eventSource && this.eventSource.readyState === EventSource.OPEN;
  }
}

// Utilidades
function getRemainingTime(startTimestamp, duration) {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - startTimestamp;
  const remaining = Math.max(0, duration - elapsed);
  return remaining;
}

function showNotification(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
}

console.log('%c\u2705 GameClient FIXED - SSE robusto con validación completa, contador de errores, heartbeat monitor, y sync mejorada', 'color: #10B981; font-weight: bold');
