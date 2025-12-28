// game-client.js - Cliente para manejar conexión SSE y acciones del juego

class GameClient {
    constructor(gameId, playerId) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.eventSource = null;
        this.gameState = null; // ← IMPORTANTE: Guardar estado aquí
        this.onStateUpdate = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
    }

    connect() {
        const sseUrl = `sse-stream.php?game_id=${this.gameId}`;
        console.log('Conectando a SSE:', sseUrl);

        try {
            this.eventSource = new EventSource(sseUrl);

            this.eventSource.onopen = () => {
                console.log('Conexión SSE establecida');
                this.reconnectAttempts = 0;
            };

            this.eventSource.addEventListener('update', (event) => {
                try {
                    const state = JSON.parse(event.data);

                    // ✅ GUARDAR ESTADO EN LA INSTANCIA
                    this.gameState = state;

                    console.log('📥 Estado recibido vía SSE:', state);

                    if (this.onStateUpdate) {
                        this.onStateUpdate(state);
                    }
                } catch (error) {
                    console.error('Error parseando estado SSE:', error);
                }
            });

            this.eventSource.onerror = (error) => {
                console.error('Error en SSE:', error);

                if (this.eventSource.readyState === EventSource.CLOSED) {
                    console.log('SSE cerrado. Intentando reconectar...');
                    this.handleReconnect();
                }
            };

        } catch (error) {
            console.error('Error creando EventSource:', error);
            this.handleReconnect();
        }
    }

    handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Máximo de intentos de reconexión alcanzado');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Reconectando en ${this.reconnectDelay}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.disconnect();
            this.connect();
        }, this.reconnectDelay);
    }

    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            console.log('Desconectado de SSE');
        }
    }

    async sendAction(action, data = {}) {
        const payload = {
            action: action,
            game_id: this.gameId,
            player_id: this.playerId,
            ...data
        };

        console.log('📤 Enviando acción:', action, data);

        try {
            const response = await fetch('api-action.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            console.log('📥 Respuesta de acción:', action, result);

            if (result.success && result.state) {
                // ✅ ACTUALIZAR ESTADO LOCAL
                this.gameState = result.state;

                if (this.onStateUpdate) {
                    this.onStateUpdate(result.state);
                }
            }

            return result;
        } catch (error) {
            console.error('Error enviando acción:', error);
            return { success: false, message: 'Error de red' };
        }
    }

    // Obtener estado actual
    async getState() {
        return await this.sendAction('get_state');
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
    // Podrías agregar aquí una notificación visual
}

console.log('✅ GameClient cargado correctamente');
