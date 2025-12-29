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
        
        // MEJORA #22: Debounce para DOM updates
        this.updatePending = false;
        this.updateTimeout = null;
        
        // MEJORA #27: Sincronización periódica (fallback SSE)
        this.periodicSyncInterval = null;
        this.lastSyncTime = 0;
        
        // Elementos del DOM
        this.elements = {};
    }
    
    /**
     * Inicializa el gestor del host
     */
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
        
        // Atajos de teclado
        document.addEventListener('keypress', (e) => this.handleKeyPress(e));
        
        debug('✅ HostManager inicializado');
    }
    
    /**
     * Cachea referencias a elementos del DOM
     */
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
    
    /**
     * Adjunta event listeners
     */
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
    }
    
    /**
     * Maneja presiones de teclas
     */
    handleKeyPress(event) {
        if (event.key === 'c' || event.key === 'C') {
            this.toggleControls();
        }
    }
    
    /**
     * Toggle de visibilidad de controles
     */
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
    
    /**
     * Intenta recuperar una sesión anterior del host
     */
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
    
    /**
     * Muestra el modal de crear juego
     */
    showCreateGameModal() {
        this.elements.modalCreateGame.classList.add('active');
        this.elements.gameScreen.classList.remove('active');
    }
    
    /**
     * Carga la pantalla de juego
     */
    loadGameScreen(state) {
        this.elements.modalCreateGame.classList.remove('active');
        this.elements.gameScreen.classList.add('active');
        
        this.elements.gameCodeTv.textContent = this.gameId;
        
        this.client.onStateUpdate = (state) => this.handleStateUpdate(state);
        this.client.onConnectionLost = () => this.handleConnectionLost();
        this.client.connect();
        
        this.controlsVisible = false;
        safeHideElement(this.elements.controlsPanel);
        
        // ✅ MEJORA #27: Iniciar sincronización periódica (fallback SSE)
        this.setupPeriodicSync();
        
        this.handleStateUpdate(state);
    }
    
    /**
     * ✅ MEJORA #27: Sincronización periódica cada 500ms
     * Fallback automático si SSE falla o se retrasa
     */
    setupPeriodicSync() {
        if (this.periodicSyncInterval) {
            clearInterval(this.periodicSyncInterval);
        }
        
        debug('🔄 Iniciando sincronización periódica (500ms)', 'info');
        
        this.periodicSyncInterval = setInterval(async () => {
            try {
                // Evitar spam: máximo 1 sincronización por segundo
                const now = Date.now();
                if (now - this.lastSyncTime < 1000) {
                    return;
                }
                this.lastSyncTime = now;
                
                // Forzar refresco del estado
                const result = await this.client.sendAction('get_state', { game_id: this.gameId });
                
                if (result.success && result.state) {
                    // Comparar timestamps: solo actualizar si hay cambio
                    const oldTimestamp = this.gameState?.last_update || 0;
                    const newTimestamp = result.state?.last_update || 0;
                    
                    if (newTimestamp > oldTimestamp) {
                        debug('🔄 Sincronización periódica: Estado actualizado', 'debug');
                        this.handleStateUpdate(result.state);
                    }
                }
            } catch (error) {
                // Fallback silencioso - SSE probablemente funciona
                debug('ℹ️ Sincronización periódica falló (SSE probablemente activo)', 'debug');
            }
        }, 500);
    }
    
    /**
     * Crea una nueva partida
     */
    async createGame() {
        let customCode = this.elements.customCodeInput?.value?.trim().toUpperCase();
        
        if (customCode && !isValidGameCode(customCode)) {
            this.elements.statusMessage.innerHTML = '⚠️ Código inválido (3-6 caracteres)';
            return;
        }
        
        if (!customCode) {
            customCode = generateGameCode(4);
        }
        
        this.gameId = customCode;
        
        this.elements.btnCreateGame.disabled = true;
        this.elements.btnCreateGame.textContent = 'Conectando...';
        this.elements.statusMessage.innerHTML = '⏳ Conectando...';
        
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
                this.elements.statusMessage.innerHTML = '❌ Error: ' + (result.message || 'Desconocido');
                this.elements.btnCreateGame.disabled = false;
                this.elements.btnCreateGame.textContent = '🎮 Crear Partida';
            }
        } catch (error) {
            debug('Error creando juego:', error, 'error');
            this.elements.statusMessage.innerHTML = '❌ Error de conexión';
            this.elements.btnCreateGame.disabled = false;
            this.elements.btnCreateGame.textContent = '🎮 Crear Partida';
        }
    }
    
    /**
     * Maneja actualizaciones de estado
     */
    handleStateUpdate(state) {
        this.gameState = state;
        debug('📈 Estado actualizado:', state.status);
        // MEJORA #22: Usar debounce para evitar múltiples updates
        this.debouncedUpdateHostUI();
    }
    
    /**
     * Actualización de UI con debounce (máximo 1 cada 500ms)
     */
    debouncedUpdateHostUI() {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        if (this.updatePending) {
            return; // Ya hay una actualización en proceso
        }
        
        this.updatePending = true;
        this.updateTimeout = setTimeout(() => {
            this.updateHostUI();
            this.updatePending = false;
        }, 500);
    }
    
    /**
     * Actualiza la UI del host
     */
    updateHostUI() {
        if (!this.gameState) return;
        
        this.updateRanking();
        this.updateTopWords();
        this.updatePlayersGrid();
        this.updateStatusMessage();
        this.updateButtonStates();
        this.updateTimer();
    }
    
    /**
     * Actualiza ranking de jugadores
     */
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
    
    /**
     * Actualiza palabras top - FIX: Usar round_top_words
     */
    updateTopWords() {
        if (!this.gameState.round_top_words) return; // FIX: Nombre consistente
        
        let html = '';
        this.gameState.round_top_words.forEach((item) => {
            html += `
                <div class="top-word-item">
                    <span class="word-text">${sanitizeText(item.word)}</span>
                    <span class="word-count">${item.count}x</span>
                </div>
            `;
        });
        
        if (this.elements.topWordsList) {
            this.elements.topWordsList.innerHTML = html || '<div style="opacity: 0.5;">Sin palabras aún</div>';
        }
    }
    
    /**
     * Actualiza grid de jugadores
     */
    updatePlayersGrid() {
        if (!this.gameState.players) return;
        
        const players = Object.values(this.gameState.players);
        let html = '';
        
        players.forEach(player => {
            const statusEmoji = player.status === 'ready' ? '✅' : '⏳';
            const colors = player.color?.split(',') || ['#808080', '#404040'];
            const gradient = `linear-gradient(135deg, ${colors[0].trim()} 0%, ${colors[1].trim()} 100%)`;
            
            html += `
                <div class="player-card" style="background: ${gradient};">
                    <div class="player-status">${statusEmoji}</div>
                    <div class="player-name">${sanitizeText(player.name)}</div>
                    <div class="player-score">${player.score || 0} pts</div>
                </div>
            `;
        });
        
        if (this.elements.playersGrid) {
            this.elements.playersGrid.innerHTML = html || '<div>Sin jugadores</div>';
        }
    }
    
    /**
     * Actualiza mensaje de estado
     */
    updateStatusMessage() {
        let message = 'Cargando...';
        
        switch (this.gameState.status) {
            case 'waiting':
                message = `👥 ${Object.keys(this.gameState.players || {}).length} jugadores conectados`;
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
    
    /**
     * Actualiza estado de botones
     */
    updateButtonStates() {
        const isWaiting = this.gameState.status === 'waiting';
        const isPlaying = this.gameState.status === 'playing';
        const numPlayers = Object.keys(this.gameState.players || {}).length;
        
        if (this.elements.btnStartRound) {
            this.elements.btnStartRound.disabled = !isWaiting || numPlayers === 0;
        }
        if (this.elements.btnEndRound) {
            this.elements.btnEndRound.disabled = !isPlaying;
        }
    }
    
    /**
     * Actualiza timer
     */
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
    
    /**
     * Inicia timer continuo
     */
    startContinuousTimer() {
        if (this.timerInterval) return; // Ya en ejecución
        
        this.updateTimerFromState();
        
        this.timerInterval = setInterval(() => {
            if (this.client && this.gameState && this.gameState.status === 'playing') {
                this.updateTimerFromState();
            } else {
                this.stopTimer();
            }
        }, 1000);
    }
    
    /**
     * Actualiza timer desde estado
     */
    updateTimerFromState() {
        const now = Math.floor(Date.now() / 1000);
        const elapsed = now - this.gameState.round_started_at;
        const remaining = Math.max(0, this.gameState.round_duration - elapsed);
        updateTimerDisplay(remaining, this.elements.timerDisplay, '⏳');
    }
    
    /**
     * Detiene el timer
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    /**
     * Inicia una ronda
     */
    async startRound() {
        try {
            this.elements.btnStartRound.disabled = true;
            this.elements.btnStartRound.textContent = 'Iniciando...';
            
            const result = await this.client.sendAction('start_round', {});
            
            if (!result.success) {
                showNotification('Error iniciando ronda', 'error');
                this.elements.btnStartRound.disabled = false;
                this.elements.btnStartRound.textContent = '▶️ Iniciar Ronda';
            }
        } catch (error) {
            debug('Error iniciando ronda:', error, 'error');
            showNotification('Error de conexión', 'error');
            this.elements.btnStartRound.disabled = false;
            this.elements.btnStartRound.textContent = '▶️ Iniciar Ronda';
        }
    }
    
    /**
     * Termina una ronda
     */
    async endRound() {
        try {
            this.elements.btnEndRound.disabled = true;
            this.elements.btnEndRound.textContent = 'Finalizando...';
            
            const result = await this.client.sendAction('end_round', {});
            
            if (!result.success) {
                showNotification('Error finalizando ronda', 'error');
                this.elements.btnEndRound.disabled = false;
                this.elements.btnEndRound.textContent = '⏹️ Finalizar Ronda';
            }
        } catch (error) {
            debug('Error finalizando ronda:', error, 'error');
            showNotification('Error de conexión', 'error');
            this.elements.btnEndRound.disabled = false;
            this.elements.btnEndRound.textContent = '⏹️ Finalizar Ronda';
        }
    }
    
    /**
     * Crea nueva partida
     */
    createNewGame() {
        if (confirm('¿Iniciar una nueva partida?')) {
            clearGameSession();
            location.reload();
        }
    }
    
    /**
     * Maneja pérdida de conexión
     */
    handleConnectionLost() {
        alert('Desconectado del servidor');
        location.reload();
    }
}

// Instancia global
let hostManager = null;

// Inicializar cuando carga el DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        hostManager = new HostManager();
        hostManager.initialize();
    });
} else {
    hostManager = new HostManager();
    hostManager.initialize();
}

console.log('%c✅ host-manager.js cargado - Mejorado con periodic sync y debounce', 'color: #10B981; font-weight: bold');