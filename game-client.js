// game-client.js - Cliente para manejar conexión SSE y acciones del juego
// MEJORAS: #4 (timeout absoluto), #10 (actualización centralizada), #12 (retry logic)

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
        this.connectionStartTime = null; // MEJORA #4: Timeout absoluto
        this.maxConnectionTime = 1800000; // 30 minutos en ms
        this.retryQueue = []; // MEJORA #12: Cola de reintentos
    }

    connect() {
        const sseUrl = `sse-stream.php?game_id=${this.gameId}`;
        console.log('Conectando a SSE:', sseUrl);
        
        this.connectionStartTime = Date.now();

        try {
            this.eventSource = new EventSource(sseUrl);

            this.eventSource.onopen = () => {
                console.log('Conexión SSE establecida');
                this.reconnectAttempts = 0;
                this.processRetryQueue(); // MEJORA #12: Procesar cola
            };

            this.eventSource.addEventListener('update', (event) => {
                try {
                    const state = JSON.parse(event.data);
                    this.updateState(state); // MEJORA #10: Centralizado
                } catch (error) {
                    console.error('Error parseando estado SSE:', error);
                }
            });
            
            this.eventSource.addEventListener('game_ended', (event) => {
                console.log('Juego finalizado o no encontrado');
                this.disconnect();
                if (typeof this.onGameEnded === 'function') {
                    this.onGameEnded();
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
        
        // MEJORA #4: Timeout absoluto
        this.checkConnectionTimeout();
    }
    
    // MEJORA #4: Verificar timeout absoluto
    checkConnectionTimeout() {
        setTimeout(() => {
            if (this.connectionStartTime) {
                const elapsed = Date.now() - this.connectionStartTime;
                if (elapsed >= this.maxConnectionTime) {
                    console.log('Tiempo máximo de conexión alcanzado, reconectando...');
                    this.disconnect();
                    this.connect();
                } else {
                    this.checkConnectionTimeout();
                }
            }
        }, 60000); // Verificar cada minuto
    }

    handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Máximo de intentos de reconexión alcanzado');
            if (typeof this.onMaxRetriesReached === 'function') {
                this.onMaxRetriesReached();
            }
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
        
        console.log(`Reconectando en ${delay}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.disconnect();
            this.connect();
        }, delay);
    }

    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            console.log('Desconectado de SSE');
        }
    }
    
    // MEJORA #10: Actualizar estado centralizado
    updateState(state) {
        this.gameState = state;
        console.log('📥 Estado actualizado:', state);

        if (this.onStateUpdate) {
            this.onStateUpdate(state);
        }
    }

    // MEJORA #12: Enviar acción con retry logic
    async sendAction(action, data = {}, retries = 3) {
        const payload = {
            action: action,
            game_id: this.gameId,
            player_id: this.playerId,
            ...data
        };

        console.log('📤 Enviando acción:', action, data);

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await fetch('api-action.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();

                console.log('📥 Respuesta de acción:', action, result);

                if (result.success && result.state) {
                    this.updateState(result.state); // MEJORA #10: Centralizado
                }

                return result;
                
            } catch (error) {
                console.error(`Error enviando acción (intento ${attempt + 1}/${retries + 1}):`, error);
                
                if (attempt < retries) {
                    // Esperar antes de reintentar (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
                } else {
                    // Último intento fallido, agregar a cola
                    this.retryQueue.push({ action, data });
                    return { success: false, message: 'Error de red después de ' + (retries + 1) + ' intentos' };
                }
            }
        }
    }
    
    // MEJORA #12: Procesar cola de reintentos
    async processRetryQueue() {
        while (this.retryQueue.length > 0) {
            const {action, data} = this.retryQueue.shift();
            console.log('Reintentando acción desde cola:', action);
            await this.sendAction(action, data, 1);
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

// MEJORA #22: Mejor manejo de localStorage con prefijo
function getGameStorage(key) {
    const prefix = 'unanimo_';
    return localStorage.getItem(prefix + key);
}

function setGameStorage(key, value) {
    const prefix = 'unanimo_';
    localStorage.setItem(prefix + key, value);
}

function clearGameStorage() {
    const prefix = 'unanimo_';
    Object.keys(localStorage)
        .filter(key => key.startsWith(prefix))
        .forEach(key => localStorage.removeItem(key));
}

console.log('✅ GameClient cargado correctamente');