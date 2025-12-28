// game-client.js - Cliente para manejar conexión SSE y acciones del juego
// FIX #3: Eliminado polling simultáneo, usando SOLO SSE en tiempo real
// FIX #5: Mejorada validación de datos SSE y manejo de heartbeats
// FIX #9: Incluir player_id en acciones que lo requieren (join_game, submit_answers, etc)

class GameClient {
    constructor(gameId, playerId = null, role = 'player') {
        this.gameId = gameId;
        this.playerId = playerId;  // ✅ FIX #9: Agregar playerId al constructor
        this.role = role;  // 'player' o 'host'
        this.eventSource = null;
        this.gameState = null;
        this.onStateUpdate = null;  // Callback para actualizaciones
        this.onConnectionLost = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.isConnected = false;
        this.lastStateHash = null;  // Para evitar actualizaciones innecesarias
    }

    connect() {
        const sseUrl = `/app/sse-stream.php?game_id=${encodeURIComponent(this.gameId)}`;
        console.log(`🔌 [${this.role}] Conectando a SSE: ${sseUrl}`);

        try {
            this.eventSource = new EventSource(sseUrl);

            // Cuando la conexión se abre
            this.eventSource.onopen = () => {
                console.log(`✅ [${this.role}] SSE conectado exitosamente`);
                this.isConnected = true;
                this.reconnectAttempts = 0;
            };

            // Mensaje por defecto (data simple)
            // FIX #5: Mejorada validación de datos SSE
            this.eventSource.onmessage = (event) => {
                try {
                    // Ignorar heartbeats y datos vacíos
                    if (!event.data || typeof event.data !== 'string') {
                        console.debug(`[${this.role}] Heartbeat recibido`);
                        return;
                    }

                    const dataTrimmed = event.data.trim();
                    if (dataTrimmed === '') {
                        console.debug(`[${this.role}] Datos vacíos recibidos`);
                        return;
                    }

                    // Intentar parsear JSON
                    let newState;
                    try {
                        newState = JSON.parse(dataTrimmed);
                    } catch (parseError) {
                        console.warn(`❌ [${this.role}] Error parseando JSON SSE:`, parseError);
                        console.warn(`   Datos recibidos:`, dataTrimmed.substring(0, 100));
                        return;
                    }

                    // FIX #5: Validar estructura básica del estado
                    if (!newState || typeof newState !== 'object') {
                        console.warn(`⚠️ [${this.role}] Estado inválido (no es objeto):`, newState);
                        return;
                    }

                    // Validar que tenga al menos un game_id
                    if (!newState.game_id && newState.message !== 'error') {
                        console.warn(`⚠️ [${this.role}] Estado sin game_id:`, newState);
                        return;
                    }

                    // FIX #3: Solo actualizar si hay cambios reales
                    const newHash = JSON.stringify(newState);
                    if (newHash !== this.lastStateHash) {
                        this.gameState = newState;
                        this.lastStateHash = newHash;
                        
                        console.log(`📨 [${this.role}] Estado actualizado vía SSE (ronda ${newState.round || 0})`);
                        
                        // Callback inmediato
                        if (this.onStateUpdate && typeof this.onStateUpdate === 'function') {
                            try {
                                this.onStateUpdate(newState);
                            } catch (callbackError) {
                                console.error(`❌ [${this.role}] Error en callback onStateUpdate:`, callbackError);
                            }
                        }
                    } else {
                        console.debug(`[${this.role}] Estado sin cambios, ignorando`);
                    }
                } catch (error) {
                    console.error(`❌ [${this.role}] Error inesperado en onmessage:`, error);
                }
            };

            // Cuando hay error
            this.eventSource.onerror = (error) => {
                console.error(`❌ [${this.role}] Error en SSE:`, error);
                this.isConnected = false;
                
                // Cerrar la conexión actual
                if (this.eventSource.readyState === EventSource.CLOSED) {
                    this.handleReconnect();
                }
            };

        } catch (error) {
            console.error(`❌ [${this.role}] Error creando EventSource:`, error);
            this.handleReconnect();
        }
    }

    handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`❌ [${this.role}] Máximo de intentos de reconexión alcanzado`);
            
            if (this.onConnectionLost && typeof this.onConnectionLost === 'function') {
                this.onConnectionLost();
            }
            return;
        }

        this.reconnectAttempts++;
        // Exponential backoff: 1s, 2s, 4s, 8s, etc. (máximo 30s)
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
        
        console.log(`🔄 [${this.role}] Reconectando en ${delay}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            this.disconnect();
            this.connect();
        }, delay);
    }

    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            this.isConnected = false;
            console.log(`🔌 [${this.role}] SSE desconectado`);
        }
    }

    // FIX #3: NO hacer polling - solo obtener estado actual del cache local
    getState() {
        return this.gameState;
    }

    // Enviar acción al servidor
    // FIX #9: Incluir player_id cuando sea necesario
    async sendAction(action, data = {}) {
        console.log(`📤 [${this.role}] Enviando acción: ${action}`, data);
        
        try {
            const payload = {
                action: action,
                game_id: this.gameId,
                ...data
            };

            // ✅ FIX #9: Agregar player_id a acciones que lo requieren
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
            
            console.log(`✅ [${this.role}] Respuesta recibida para ${action}:`, result.success ? '✓' : '✗');
            
            // La actualización del estado vendrá vía SSE, NO por aquí
            // Esto asegura sincronización en tiempo real para todos
            
            return result;
        } catch (error) {
            console.error(`❌ [${this.role}] Error enviando acción ${action}:`, error);
            return { success: false, message: 'Error de red: ' + error.message };
        }
    }

    // Método para forzar una actualización si es necesario (excepcional)
    async forceRefresh() {
        console.log(`🔄 [${this.role}] Forzando actualización...`);
        
        try {
            const payload = {
                action: 'get_state',
                game_id: this.gameId
            };

            // ✅ FIX #9: Agregar player_id si está disponible
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
                
                if (this.onStateUpdate && typeof this.onStateUpdate === 'function') {
                    this.onStateUpdate(result.state);
                }
            }
        } catch (error) {
            console.error(`❌ [${this.role}] Error forzando actualización:`, error);
        }
    }

    // Verificar si está conectado
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

console.log('✅ GameClient FIX #3,#5,#9 - SSE con player_id incluido');
