// game-client.js - Cliente para manejar conexión SSE y acciones del juego
// MEJORAS: #4, #10, #12 (mejor manejo de errores y reconexiones)

class GameClient {
    constructor(gameId, playerId) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.eventSource = null;
        this.gameState = null;
        this.onStateUpdate = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.reconnectTimeout = null;
        this.isConnected = false;
        this.lastStateUpdate = Date.now();
    }

    connect() {
        const sseUrl = `sse-stream.php?game_id=${this.gameId}`;
        console.log('[GameClient] Conectando a SSE:', sseUrl);

        try {
            this.eventSource = new EventSource(sseUrl);

            this.eventSource.onopen = () => {
                console.log('[GameClient] Conexión SSE establecida');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                // Limpiar timeout de reconexion
                if (this.reconnectTimeout) {
                    clearTimeout(this.reconnectTimeout);
                    this.reconnectTimeout = null;
                }
            };

            this.eventSource.addEventListener('update', (event) => {
                try {
                    const state = JSON.parse(event.data);
                    this.gameState = state;
                    this.lastStateUpdate = Date.now();

                    console.log('[GameClient] Estado recibido vía SSE');

                    if (this.onStateUpdate) {
                        this.onStateUpdate(state);
                    }
                } catch (error) {
                    console.error('[GameClient] Error parseando estado SSE:', error);
                }
            });
            
            this.eventSource.addEventListener('game_ended', (event) => {
                console.log('[GameClient] Juego finalizado o expirado');
                this.disconnect();
                
                if (this.onGameEnded) {
                    this.onGameEnded();
                }
            });

            this.eventSource.onerror = (error) => {
                console.error('[GameClient] Error en SSE:', error);
                this.isConnected = false;

                if (this.eventSource.readyState === EventSource.CLOSED) {
                    console.log('[GameClient] SSE cerrado. Intentando reconectar...');
                    this.handleReconnect();
                }
            };

        } catch (error) {
            console.error('[GameClient] Error creando EventSource:', error);
            this.handleReconnect();
        }
    }

    handleReconnect() {
        // MEJORA #4: Evitar reconexiones infinitas con timeout absoluto
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[GameClient] Máximo de intentos de reconexion alcanzado');
            
            if (this.onConnectionFailed) {
                this.onConnectionFailed();
            }
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1); // Exponential backoff
        
        console.log(`[GameClient] Reconectando en ${delay}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.reconnectTimeout = setTimeout(() => {
            this.disconnect();
            this.connect();
        }, delay);
    }

    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            this.isConnected = false;
            console.log('[GameClient] Desconectado de SSE');
        }
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    async sendAction(action, data = {}) {
        const payload = {
            action: action,
            game_id: this.gameId,
            player_id: this.playerId,
            ...data
        };

        console.log('[GameClient] Enviando acción:', action);

        try {
            const response = await fetch('api-action.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            console.log('[GameClient] Respuesta de acción:', action, result.success ? '✅' : '❌');

            if (result.success && result.state) {
                this.gameState = result.state;

                if (this.onStateUpdate) {
                    this.onStateUpdate(result.state);
                }
            }

            return result;
        } catch (error) {
            console.error('[GameClient] Error enviando acción:', error);
            
            // MEJORA #12: Notificar error de red
            if (this.onNetworkError) {
                this.onNetworkError(error);
            }
            
            return { success: false, message: 'Error de red: ' + error.message };
        }
    }

    // Obtener estado actual
    async getState() {
        return await this.sendAction('get_state');
    }
    
    // Verificar si la conexión está activa
    isAlive() {
        return this.isConnected && (Date.now() - this.lastStateUpdate) < 60000; // 1 minuto
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
    // Aquí podrías agregar notificaciones visuales
}

// Sistema de reporte de bugs (MEJORA #9: solo en modo desarrollo)
function reportBug(description, data = {}) {
    console.error('[BUG REPORT]', description, data);
    
    // En producción esto podría enviar a un endpoint
    if (window.DEV_MODE) {
        const report = {
            timestamp: new Date().toISOString(),
            description: description,
            data: data,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        console.log('[BUG REPORT] Datos completos:', report);
    }
}

console.log('✅ GameClient cargado correctamente');
