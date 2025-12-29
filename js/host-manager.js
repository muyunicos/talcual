/**
 * @file host-manager.js
 * @description Gestor de lógica del anfitrion Host
 */

class HostManager {
    constructor() {
        this.gameId = null;
        this.client = null;
        this.gameState = null;
        this.timerInterval = null;
        this.controlsVisible = false;
        this.debugMode = false;
        this.fallbackRefreshInterval = null;
        this.lastSSEMessageTime = 0;
        this.elements = {};
        this.copyIndicatorTimeout = null;
    }
    
    initialize() {
        debug('🌟 Inicializando HostManager');
        this.cacheElements();
        this.attachEventListeners();
        
        const savedGameId = getLocalStorage('gameId');
        
        if (savedGameId) {
            debug('🔄 Intentando recuperar sesión del host');
            this.recoverSession(savedGameId).then(recovered => {
                if (!recovered) {
                    this.showCreateGameModal();
                }
            });
        } else {
            this.showCreateGameModal();
        }
        
        document.addEventListener('keypress', (e) => this.handleKeyPress(e));
        debug('✅ HostManager inicializado');
    }
    
    cacheElements() {
        this.elements = {
            modalCreateGame: safeGetElement('modal-create-game'),
            gameScreen: safeGetElement('game-screen'),
            customCodeInput: safeGetElement('custom-code'),
            btnCreateGame: safeGetElement('btn-create-game'),
            statusMessage: safeGetElement('status-message'),
            timerDisplay: safeGetElement('timer-display'),
            gameCodeTv: safeGetElement('game-code-tv'),
            rankingList: safeGetElement('ranking-list'),
            wordDisplay: safeGetElement('word-display'),
            countdownDisplay: safeGetElement('countdown-display'),
            statusMsg: safeGetElement('status-message'),
            topWordsList: safeGetElement('top-words-list'),
            playersGrid: safeGetElement('players-grid'),
            controlsPanel: safeGetElement('controls-panel'),
            btnStartRound: safeGetElement('btn-start-round'),
            btnEndRound: safeGetElement('btn-end-round'),
            btnNewGame: safeGetElement('btn-new-game')
        };
    }
    
    attachEventListeners() {
        if (this.elements.btnCreateGame) {
            this.elements.btnCreateGame.addEventListener('click', () => this.createGame());
        }
        
        if (this.elements.customCodeInput) {
            this.elements.customCodeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.createGame();
            });
        }
        
        if (this.elements.btnStartRound) {
            this.elements.btnStartRound.addEventListener('click', () => this.startRound());
        }
        
        if (this.elements.btnEndRound) {
            this.elements.btnEndRound.addEventListener('click', () => this.endRound());
        }
        
        if (this.elements.btnNewGame) {
            this.elements.btnNewGame.addEventListener('click', () => this.createNewGame());
        }

        this.setupGameCodeCopy();
    }

    setupGameCodeCopy() {
        const sticker = this.elements.gameCodeTv;
        if (!sticker) return;

        sticker.title = 'Click para copiar el código';
        sticker.setAttribute('role', 'button');
        sticker.setAttribute('tabindex', '0');

        const copyHandler = () => this.copyGameCodeToClipboard();

        sticker.addEventListener('click', copyHandler);
        sticker.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                copyHandler();
            }
        });
    }

    async copyGameCodeToClipboard() {
        const sticker = this.elements.gameCodeTv;
        const code = (sticker?.textContent || '').trim();

        if (!code || code === '------') return;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(code);
            } else {
                this.fallbackCopyText(code);
            }
            this.showGameCodeCopiedIndicator();
        } catch (error) {
            this.fallbackCopyText(code);
            this.showGameCodeCopiedIndicator();
        }
    }

    fallbackCopyText(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();

        try {
            document.execCommand('copy');
        } finally {
            document.body.removeChild(ta);
        }
    }

    showGameCodeCopiedIndicator() {
        const sticker = this.elements.gameCodeTv;
        if (!sticker) return;

        sticker.classList.remove('copied');
        void sticker.offsetWidth;
        sticker.classList.add('copied');

        if (this.copyIndicatorTimeout) {
            clearTimeout(this.copyIndicatorTimeout);
        }

        this.copyIndicatorTimeout = setTimeout(() => {
            sticker.classList.remove('copied');
        }, 900);
    }
    
    handleKeyPress(event) {
        if (event.key === 'c' || event.key === 'C') {
            this.toggleControls();
        }
    }
    
    toggleControls() {
        this.controlsVisible = !this.controlsVisible;
        if (this.elements.controlsPanel) {
            if (this.controlsVisible) {
                safeShowElement(this.elements.controlsPanel);
                showNotification('🎬 Controles visibles (presiona C para ocultar)', 'info', 2000);
            } else {
                safeHideElement(this.elements.controlsPanel);
            }
        }
    }
    
    async recoverSession(gameId) {
        try {
            this.gameId = gameId;
            this.client = new GameClient(gameId, null, 'host');
            
            const result = await this.client.sendAction('get_state', { game_id: gameId });
            
            if (result.success && result.state) {
                debug('✅ Sesión del host recuperada');
                this.loadGameScreen(result.state);
                return true;
            }
        } catch (error) {
            debug('Error recuperando sesión:', error, 'error');
        }
        
        return false;
    }
    
    showCreateGameModal() {
        safeShowElement(this.elements.modalCreateGame);
        safeHideElement(this.elements.gameScreen);
    }
    
    loadGameScreen(state) {
        safeHideElement(this.elements.modalCreateGame);
        safeShowElement(this.elements.gameScreen);
        
        if (this.elements.gameCodeTv) {
            this.elements.gameCodeTv.textContent = this.gameId;
        }
        
        this.client.onStateUpdate = (state) => this.handleStateUpdate(state);
        this.client.onConnectionLost = () => this.handleConnectionLost();
        
        // 🔧 FIX #25: Escuchar 'connected' event para actualizar lastSSEMessageTime
        // Esto permite que el heartbeat sea detectado sin esperar un 'update' event
        this.client.on('connected', () => {
            this.lastSSEMessageTime = Date.now();
            debug('📡 [HOST] SSE conectado - heartbeat será recibido', 'debug');
        });
        
        this.client.connect();
        this.lastSSEMessageTime = Date.now();
        
        this.controlsVisible = false;
        safeHideElement(this.elements.controlsPanel);
        
        // MEJORA #26: Reemplazar setupPeriodicSync() con fallback robusto
        this.setupFallbackRefresh();
        
        this.handleStateUpdate(state);
    }
    
    /**
     * MEJORA #26: Fallback inteligente en lugar de polling cada 100ms
     * Solo hace forceRefresh() si SSE muere > MESSAGE_TIMEOUT
     * Usa COMM_CONFIG para evitar valores hardcodeados
     */
    setupFallbackRefresh() {
        if (this.fallbackRefreshInterval) {
            clearInterval(this.fallbackRefreshInterval);
        }
        
        // Obtener CONFIG con fallback
        const commConfig = window.COMM?.COMM_CONFIG || {
            MESSAGE_TIMEOUT: 30000,
            HEARTBEAT_CHECK_INTERVAL: 5000
        };
        
        const checkInterval = commConfig.HEARTBEAT_CHECK_INTERVAL;
        const messageTimeout = commConfig.MESSAGE_TIMEOUT;
        
        debug(`🔄 Iniciando fallback refresh (${messageTimeout}ms sin SSE = forceRefresh)`, 'info');
        
        this.fallbackRefreshInterval = setInterval(() => {
            const timeSinceLastSSE = Date.now() - this.lastSSEMessageTime;
            
            if (timeSinceLastSSE > messageTimeout && this.client && this.gameId) {
                console.warn(`⚠️ [HOST] SSE sin mensajes ${Math.floor(timeSinceLastSSE / 1000)}s, forzando refresh...`);
                this.client.forceRefresh();
            }
        }, checkInterval);
    }
    
    async createGame() {
        let customCode = this.elements.customCodeInput?.value?.trim().toUpperCase();
        
        if (customCode && !isValidGameCode(customCode)) {
            if (this.elements.statusMessage) {
                this.elements.statusMessage.innerHTML = '⚠️ Código inválido (3-6 caracteres)';
            }
            return;
        }
        
        if (!customCode) {
            customCode = generateGameCode(4);
        }
        
        this.gameId = customCode;
        
        if (this.elements.btnCreateGame) {
            this.elements.btnCreateGame.disabled = true;
            this.elements.btnCreateGame.textContent = 'Conectando...';
        }
        
        if (this.elements.statusMessage) {
            this.elements.statusMessage.innerHTML = '⏳ Conectando...';
        }
        
        try {
            this.client = new GameClient(this.gameId, null, 'host');
            
            const result = await this.client.sendAction('create_game', {
                game_id: this.gameId,
                mode: 'word_matching'
            });
            
            if (result.success) {
                debug(`✅ Juego creado: ${this.gameId}`);
                
                setLocalStorage('gameId', this.gameId);
                
                this.loadGameScreen(result.state || {});
                showNotification(`🎮 Partida creada: ${this.gameId}`, 'success');
                
            } else {
                if (this.elements.statusMessage) {
                    this.elements.statusMessage.innerHTML = '❌ Error: ' + (result.message || 'Desconocido');
                }
                if (this.elements.btnCreateGame) {
                    this.elements.btnCreateGame.disabled = false;
                    this.elements.btnCreateGame.textContent = '🎮 Crear Partida';
                }
            }
        } catch (error) {
            debug('Error creando juego:', error, 'error');
            if (this.elements.statusMessage) {
                this.elements.statusMessage.innerHTML = '❌ Error de conexión';
            }
            if (this.elements.btnCreateGame) {
                this.elements.btnCreateGame.disabled = false;
                this.elements.btnCreateGame.textContent = '🎮 Crear Partida';
            }
        }
    }
    
    handleStateUpdate(state) {
        this.gameState = state;
        this.lastSSEMessageTime = Date.now();
        debug('📈 Estado actualizado:', state.status);
        // 🔧 FIX #31: QUITAR el debounce excesivo - actualizar UI directamente
        // El debounce de 500ms causaba que se perdieran updates de join_game
        // Ahora se actualiza la UI inmediatamente en cada cambio de estado
        this.updateHostUI();
    }
    
    updateHostUI() {
        if (!this.gameState) return;
        
        debug('🖥️ Actualizando UI del host', 'debug');
        this.updateRanking();
        this.updateTopWords();
        this.updatePlayersGrid();
        this.updateStatusMessage();
        this.updateButtonStates();
        this.updateTimer();
    }
    
    updateRanking() {
        if (!this.gameState.players) return;
        
        const ranking = Object.values(this.gameState.players)
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 5);
        
        let html = '';
        ranking.forEach((player, idx) => {
            const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][idx];
            html += `
                <div class="ranking-item">
                    <span class="ranking-position">${medal}</span>
                    <span class="ranking-name">${sanitizeText(player.name)}</span>
                    <span class="ranking-score">${player.score || 0}</span>
                </div>
            `;
        });
        
        if (this.elements.rankingList) {
            this.elements.rankingList.innerHTML = html || '<div style="opacity: 0.5;">Esperando jugadores...</div>';
        }
    }
    
    updateTopWords() {
        if (!this.gameState.round_top_words) return;
        
        let html = '';
        this.gameState.round_top_words.forEach((item) => {
            html += `
                <div class="top-word-item">
                    <span class="word">${sanitizeText(item.word)}</span>
                    <span class="count">${item.count}x</span>
                </div>
            `;
        });
        
        if (this.elements.topWordsList) {
            this.elements.topWordsList.innerHTML = html || '<div style="opacity: 0.5;">Sin palabras aún</div>';
        }
    }
    
    updatePlayersGrid() {
        const grid = this.elements.playersGrid;
        if (!grid) {
            debug('❌ #players-grid no encontrado', 'error');
            return;
        }
        
        if (!this.gameState.players) {
            debug('⚠️ No hay jugadores en gameState', 'warn');
            grid.innerHTML = '<div style="text-align: center; padding: 2rem; opacity: 0.5; grid-column: 1 / -1;">Esperando jugadores...</div>';
            return;
        }
        
        const players = Object.values(this.gameState.players);
        
        if (players.length === 0) {
            debug('⚠️ Array de jugadores vacío', 'warn');
            grid.innerHTML = '<div style="text-align: center; padding: 2rem; opacity: 0.5; grid-column: 1 / -1;">Esperando jugadores...</div>';
            return;
        }
        
        let html = '';
        
        players.forEach(player => {
            try {
                // Decodificar colores del aura - CORREGIDO #1
                const colors = player.color?.split(',') || ['#808080', '#404040'];
                const color1 = colors[0]?.trim() || '#808080';
                const color2 = colors[1]?.trim() || '#404040';
                const gradient = `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
                
                // Obtener estado y clase CSS
                const statusClass = this.getStatusClass(player);
                const statusEmoji = this.getStatusEmoji(player);
                
                // Obtener glow dinámico basado en color
                const glowColor = color1;
                const glowShadow = `0 0 24px ${glowColor}88, 0 0 48px ${glowColor}44, inset 0 0 24px ${glowColor}22`;
                
                // Obtener inicial del nombre
                const initial = (player.name || 'J')[0].toUpperCase();
                
                html += `
                    <div class="player-squarcle status-${statusClass}" 
                         data-player-id="${player.id}" 
                         style="background: ${gradient}; box-shadow: ${glowShadow};">
                        <div class="player-initial">${initial}</div>
                        <div class="player-status-icon">${statusEmoji}</div>
                        <div class="player-name-label">${sanitizeText(player.name)}</div>
                    </div>
                `;
            } catch (error) {
                debug(`Error renderizando squarcle para ${player.name}:`, error, 'error');
            }
        });
        
        grid.innerHTML = html;
        debug(`✅ ${players.length} squarcles renderizados`, 'debug');
    }
    
    getStatusClass(player) {
        if (player.disconnected) return 'disconnected';
        if (player.status === 'ready') return 'ready';
        if (player.status === 'answered') return 'answered';
        if (player.status === 'waiting') return 'waiting';
        return 'connected';
    }
    
    getStatusEmoji(player) {
        if (player.disconnected) return '❌';
        if (player.status === 'ready') return '✅';
        if (player.status === 'answered') return '📝';
        if (player.status === 'waiting') return '⏳';
        if (player.status === 'connected') return '👥';
        return '👤';
    }
    
    updateStatusMessage() {
        let message = 'Cargando...';
        
        switch (this.gameState.status) {
            case 'waiting':
                const playerCount = Object.keys(this.gameState.players || {}).length;
                message = `👥 ${playerCount} jugadores conectados`;
                break;
            case 'playing':
                message = `📚 Ronda ${this.gameState.round}/${this.gameState.total_rounds}`;
                if (this.gameState.current_word) {
                    message += ` - Palabra: <strong>${sanitizeText(this.gameState.current_word)}</strong>`;
                }
                break;
            case 'round_ended':
                message = '✅ Ronda terminada';
                break;
            case 'finished':
                message = '🎉 Partida finalizada';
                break;
        }
        
        if (this.elements.statusMsg) {
            this.elements.statusMsg.innerHTML = message;
        }
    }
    
    updateButtonStates() {
        const isWaiting = this.gameState.status === 'waiting';
        const isPlaying = this.gameState.status === 'playing';
        const numPlayers = Object.keys(this.gameState.players || {}).length;
        
        // 🔧 FIX #31: Validar que hay al menos MIN_PLAYERS activos (no desconectados)
        const activePlayers = Object.values(this.gameState.players || {})
            .filter(p => !p.disconnected);
        const activeCount = activePlayers.length;
        
        if (this.elements.btnStartRound) {
            // Botón habilitado si: estado es waiting Y hay al menos MIN_PLAYERS activos
            const canStart = isWaiting && activeCount >= 2;  // MIN_PLAYERS es 2 (ver settings.php)
            this.elements.btnStartRound.disabled = !canStart;
            
            // Debug: mostrar por qué está habilitado/deshabilitado
            if (!canStart) {
                debug(`Botón deshabilitado: isWaiting=${isWaiting}, activeCount=${activeCount}`, 'debug');
            }
        }
        if (this.elements.btnEndRound) {
            this.elements.btnEndRound.disabled = !isPlaying;
        }
    }
    
    updateTimer() {
        if (this.gameState.status !== 'playing') {
            this.stopTimer();
            return;
        }
        
        if (this.gameState.round_started_at && this.gameState.round_duration) {
            const now = Math.floor(Date.now() / 1000);
            const remaining = this.gameState.round_duration - (now - this.gameState.round_started_at);
            
            if (remaining > 0) {
                this.startContinuousTimer();
            } else {
                this.stopTimer();
            }
        }
    }
    
    startContinuousTimer() {
        if (this.timerInterval) return;
        
        this.updateTimerFromState();
        
        this.timerInterval = setInterval(() => {
            if (this.client && this.gameState && this.gameState.status === 'playing') {
                this.updateTimerFromState();
            } else {
                this.stopTimer();
            }
        }, 1000);
    }
    
    updateTimerFromState() {
        const now = Math.floor(Date.now() / 1000);
        const elapsed = now - this.gameState.round_started_at;
        const remaining = Math.max(0, this.gameState.round_duration - elapsed);
        updateTimerDisplay(remaining, this.elements.timerDisplay, '⏳');
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    async startRound() {
        try {
            if (this.elements.btnStartRound) {
                this.elements.btnStartRound.disabled = true;
                this.elements.btnStartRound.textContent = 'Iniciando...';
            }
            
            const result = await this.client.sendAction('start_round', {});
            
            if (!result.success) {
                showNotification('Error iniciando ronda: ' + (result.message || 'desconocido'), 'error');
                if (this.elements.btnStartRound) {
                    this.elements.btnStartRound.disabled = false;
                    this.elements.btnStartRound.textContent = '▶️ Iniciar Ronda';
                }
            }
        } catch (error) {
            debug('Error iniciando ronda:', error, 'error');
            showNotification('Error de conexión', 'error');
            if (this.elements.btnStartRound) {
                this.elements.btnStartRound.disabled = false;
                this.elements.btnStartRound.textContent = '▶️ Iniciar Ronda';
            }
        }
    }
    
    async endRound() {
        try {
            if (this.elements.btnEndRound) {
                this.elements.btnEndRound.disabled = true;
                this.elements.btnEndRound.textContent = 'Finalizando...';
            }
            
            const result = await this.client.sendAction('end_round', {});
            
            if (!result.success) {
                showNotification('Error finalizando ronda', 'error');
                if (this.elements.btnEndRound) {
                    this.elements.btnEndRound.disabled = false;
                    this.elements.btnEndRound.textContent = '⏹️ Finalizar Ronda';
                }
            }
        } catch (error) {
            debug('Error finalizando ronda:', error, 'error');
            showNotification('Error de conexión', 'error');
            if (this.elements.btnEndRound) {
                this.elements.btnEndRound.disabled = false;
                this.elements.btnEndRound.textContent = '⏹️ Finalizar Ronda';
            }
        }
    }
    
    createNewGame() {
        if (confirm('¿Iniciar una nueva partida?')) {
            clearGameSession();
            location.reload();
        }
    }
    
    handleConnectionLost() {
        alert('Desconectado del servidor');
        location.reload();
    }
}

let hostManager = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        hostManager = new HostManager();
        hostManager.initialize();
    });
} else {
    hostManager = new HostManager();
    hostManager.initialize();
}

console.log('%c✅ host-manager.js cargado - FIX #31: Debounce removido para updates inmediatos', 'color: #10B981; font-weight: bold');
