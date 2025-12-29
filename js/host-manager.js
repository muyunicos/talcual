/**
 * @file host-manager.js
 * @description Gestor de lógica del anfitrión con configuración y control de flujo
 */

class HostManager {
    constructor() {
        this.gameId = null;
        this.client = null;
        this.gameState = null;
        this.timerInterval = null;
        this.countdownInterval = null;
        this.gameConfig = {
            totalRounds: 3,
            roundDuration: 60,
            minPlayers: 2
        };
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
            modalGameConfig: safeGetElement('modal-game-config'),
            gameScreen: safeGetElement('game-screen'),
            customCodeInput: safeGetElement('custom-code'),
            btnCreateGame: safeGetElement('btn-create-game'),
            statusMessage: safeGetElement('status-message'),
            timerDisplay: safeGetElement('timer-display'),
            gameCodeTv: safeGetElement('game-code-tv'),
            rankingList: safeGetElement('ranking-list'),
            wordDisplay: safeGetElement('word-display'),
            countdownDisplay: safeGetElement('countdown-display'),
            roundInfo: safeGetElement('round-info'),
            categoryDisplay: safeGetElement('category-display'),
            topWordsList: safeGetElement('top-words-list'),
            playersGrid: safeGetElement('players-grid'),
            resultsPanel: safeGetElement('results-panel'),
            resultsContent: safeGetElement('results-content'),
            controlsPanel: safeGetElement('controls-panel'),
            btnConfig: safeGetElement('btn-config'),
            btnStartRound: safeGetElement('btn-start-round'),
            btnEndRound: safeGetElement('btn-end-round'),
            btnNextRound: safeGetElement('btn-next-round'),
            btnFinishGame: safeGetElement('btn-finish-game'),
            btnNewGame: safeGetElement('btn-new-game'),
            configTotalRounds: safeGetElement('config-total-rounds'),
            configRoundDuration: safeGetElement('config-round-duration'),
            configMinPlayers: safeGetElement('config-min-players'),
            btnConfigCancel: safeGetElement('btn-config-cancel'),
            btnConfigSave: safeGetElement('btn-config-save')
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

        if (this.elements.btnConfig) {
            this.elements.btnConfig.addEventListener('click', () => this.showConfigModal());
        }
        
        if (this.elements.btnConfigCancel) {
            this.elements.btnConfigCancel.addEventListener('click', () => this.hideConfigModal());
        }
        
        if (this.elements.btnConfigSave) {
            this.elements.btnConfigSave.addEventListener('click', () => this.saveGameConfig());
        }
        
        if (this.elements.btnStartRound) {
            this.elements.btnStartRound.addEventListener('click', () => this.startRound());
        }
        
        if (this.elements.btnEndRound) {
            this.elements.btnEndRound.addEventListener('click', () => this.endRound());
        }

        if (this.elements.btnNextRound) {
            this.elements.btnNextRound.addEventListener('click', () => this.nextRound());
        }

        if (this.elements.btnFinishGame) {
            this.elements.btnFinishGame.addEventListener('click', () => this.finishGame());
        }
        
        if (this.elements.btnNewGame) {
            this.elements.btnNewGame.addEventListener('click', () => this.createNewGame());
        }

        this.setupGameCodeCopy();
        this.setupConfigInputAdjusters();
    }

    setupConfigInputAdjusters() {
        const adjusters = [
            { btnDec: 'btn-decrease-rounds', btnInc: 'btn-increase-rounds', input: 'config-total-rounds', min: 1, max: 10 },
            { btnDec: 'btn-decrease-duration', btnInc: 'btn-increase-duration', input: 'config-round-duration', min: 30, max: 300, step: 10 },
            { btnDec: 'btn-decrease-min-players', btnInc: 'btn-increase-min-players', input: 'config-min-players', min: 1, max: 6 }
        ];

        adjusters.forEach(adjuster => {
            const input = safeGetElement(adjuster.input);
            const btnDec = safeGetElement(adjuster.btnDec);
            const btnInc = safeGetElement(adjuster.btnInc);

            if (btnDec) {
                btnDec.addEventListener('click', () => {
                    let val = parseInt(input?.value || adjuster.min) - (adjuster.step || 1);
                    val = Math.max(adjuster.min, val);
                    if (input) input.value = val;
                });
            }

            if (btnInc) {
                btnInc.addEventListener('click', () => {
                    let val = parseInt(input?.value || adjuster.min) + (adjuster.step || 1);
                    val = Math.min(adjuster.max, val);
                    if (input) input.value = val;
                });
            }
        });
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

    showConfigModal() {
        if (this.gameState?.status !== 'waiting') {
            showNotification('No puedes configurar durante una ronda activa', 'warning');
            return;
        }
        
        if (this.elements.configTotalRounds) {
            this.elements.configTotalRounds.value = this.gameConfig.totalRounds;
        }
        if (this.elements.configRoundDuration) {
            this.elements.configRoundDuration.value = this.gameConfig.roundDuration;
        }
        if (this.elements.configMinPlayers) {
            this.elements.configMinPlayers.value = this.gameConfig.minPlayers;
        }
        
        safeShowElement(this.elements.modalGameConfig);
    }

    hideConfigModal() {
        safeHideElement(this.elements.modalGameConfig);
    }

    saveGameConfig() {
        const totalRounds = parseInt(this.elements.configTotalRounds?.value || 3);
        const roundDuration = parseInt(this.elements.configRoundDuration?.value || 60);
        const minPlayers = parseInt(this.elements.configMinPlayers?.value || 2);

        if (totalRounds < 1 || totalRounds > 10) {
            showNotification('Rondas debe estar entre 1 y 10', 'error');
            return;
        }
        if (roundDuration < 30 || roundDuration > 300) {
            showNotification('Duración debe estar entre 30 y 300 segundos', 'error');
            return;
        }
        if (minPlayers < 1 || minPlayers > 6) {
            showNotification('Mínimo de jugadores debe estar entre 1 y 6', 'error');
            return;
        }

        this.gameConfig = { totalRounds, roundDuration, minPlayers };
        this.hideConfigModal();
        showNotification('✅ Configuración guardada', 'success');
        debug(`Config: ${totalRounds} rondas, ${roundDuration}s, mín ${minPlayers} jugadores`);
    }
    
    handleKeyPress(event) {
        if (event.key === 'Enter') {
            if (this.elements.btnStartRound && !this.elements.btnStartRound.disabled) {
                this.startRound();
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
        
        this.client.connect();
        safeShowElement(this.elements.controlsPanel);
        
        this.handleStateUpdate(state);
    }
    
    async createGame() {
        let customCode = this.elements.customCodeInput?.value?.trim().toUpperCase();
        
        if (customCode && !isValidGameCode(customCode)) {
            if (this.elements.statusMessage) {
                this.elements.statusMessage.innerHTML = '⚠️ Código inválido';
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
                total_rounds: this.gameConfig.totalRounds,
                round_duration: this.gameConfig.roundDuration,
                min_players: this.gameConfig.minPlayers
            });
            
            if (result.success) {
                debug(`✅ Juego creado: ${this.gameId}`);
                
                setLocalStorage('gameId', this.gameId);
                setLocalStorage('gameConfig', JSON.stringify(this.gameConfig));
                
                this.loadGameScreen(result.state || {});
                showNotification(`🎮 Partida: ${this.gameId}`, 'success');
                
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
        debug('📈 Estado actualizado:', state.status);
        this.updateHostUI();
    }
    
    updateHostUI() {
        if (!this.gameState) return;
        
        debug('🖥️ Actualizando UI del host', 'debug');
        this.updateRanking();
        this.updateTopWords();
        this.updatePlayersGrid();
        this.updateStatusMessage();
        this.updateRoundInfo();
        this.updateCategoryDisplay();
        this.updateWordDisplay();
        this.updateButtonStates();
        this.updateTimer();
    }

    updateRoundInfo() {
        const roundInfo = this.elements.roundInfo;
        if (!roundInfo) return;

        if (this.gameState.status === 'waiting') {
            safeHideElement(roundInfo);
        } else {
            const roundDisplay = document.getElementById('round-display');
            const totalRoundsDisplay = document.getElementById('total-rounds-display');
            
            if (roundDisplay) roundDisplay.textContent = this.gameState.round || 0;
            if (totalRoundsDisplay) totalRoundsDisplay.textContent = this.gameConfig.totalRounds;
            
            safeShowElement(roundInfo);
        }
    }

    updateCategoryDisplay() {
        const categoryDisplay = this.elements.categoryDisplay;
        if (!categoryDisplay) return;

        if (this.gameState.status === 'playing' && this.gameState.current_category) {
            const categoryValue = document.getElementById('category-value');
            if (categoryValue) {
                categoryValue.textContent = sanitizeText(this.gameState.current_category);
            }
            safeShowElement(categoryDisplay);
        } else {
            safeHideElement(categoryDisplay);
        }
    }

    updateWordDisplay() {
        const wordDisplay = this.elements.wordDisplay;
        if (!wordDisplay) return;

        if (this.gameState.status === 'playing' && this.gameState.current_word) {
            const wordValue = document.getElementById('word-value');
            if (wordValue) {
                wordValue.textContent = sanitizeText(this.gameState.current_word);
            }
            safeShowElement(wordDisplay);
        } else {
            safeHideElement(wordDisplay);
        }
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
            this.elements.rankingList.innerHTML = html || '<div style="opacity: 0.5; text-align: center; padding: 20px;">Esperando jugadores...</div>';
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
            this.elements.topWordsList.innerHTML = html || '<div style="opacity: 0.5; text-align: center; padding: 20px;">Sin palabras aún</div>';
        }
    }
    
    updatePlayersGrid() {
        const grid = this.elements.playersGrid;
        if (!grid) return;
        
        if (!this.gameState.players) {
            grid.innerHTML = '<div style="text-align: center; padding: 2rem; opacity: 0.5; grid-column: 1 / -1;">Esperando jugadores...</div>';
            return;
        }
        
        const players = Object.values(this.gameState.players);
        
        if (players.length === 0) {
            grid.innerHTML = '<div style="text-align: center; padding: 2rem; opacity: 0.5; grid-column: 1 / -1;">Esperando jugadores...</div>';
            return;
        }
        
        let html = '';
        
        players.forEach(player => {
            try {
                const colors = player.color?.split(',') || ['#808080', '#404040'];
                const color1 = colors[0]?.trim() || '#808080';
                const color2 = colors[1]?.trim() || '#404040';
                const gradient = `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
                
                const statusClass = this.getStatusClass(player);
                const statusEmoji = this.getStatusEmoji(player);
                const glowColor = color1;
                const glowShadow = `0 0 24px ${glowColor}88, 0 0 48px ${glowColor}44, inset 0 0 24px ${glowColor}22`;
                const initial = (player.name || 'J')[0].toUpperCase();
                
                html += `
                    <div class="player-squarcle status-${statusClass}" 
                         data-player-id="${player.id}"
                         style="background: ${gradient}; box-shadow: ${glowShadow};">
                        <div class="player-initial">${initial}</div>
                        <div class="player-status-icon">${statusEmoji}</div>
                        <div class="player-name-label">${sanitizeText(player.name)}</div>
                        ${this.gameState.status === 'waiting' ? `<button class="btn-remove-player" data-player-id="${player.id}" title="Eliminar jugador">✕</button>` : ''}
                    </div>
                `;
            } catch (error) {
                debug(`Error renderizando squarcle para ${player.name}:`, error, 'error');
            }
        });
        
        grid.innerHTML = html;
        
        grid.querySelectorAll('.btn-remove-player').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const playerId = btn.dataset.playerId;
                this.removePlayer(playerId);
            });
        });
        
        debug(`✅ ${players.length} jugadores renderizados`, 'debug');
    }

    async removePlayer(playerId) {
        const player = this.gameState.players?.[playerId];
        if (!player) return;

        if (!confirm(`¿Eliminar a ${player.name}?`)) {
            return;
        }

        try {
            const result = await this.client.sendAction('leave_game', {
                game_id: this.gameId,
                player_id: playerId
            });

            if (result.success) {
                showNotification(`${player.name} eliminado`, 'info');
            }
        } catch (error) {
            debug('Error eliminando jugador:', error, 'error');
            showNotification('Error al eliminar jugador', 'error');
        }
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
                const activePlayers = Object.values(this.gameState.players || {})
                    .filter(p => !p.disconnected).length;
                
                if (activePlayers === 0) {
                    message = '👥 Esperando al primer jugador';
                } else if (activePlayers < this.gameConfig.minPlayers) {
                    const needed = this.gameConfig.minPlayers - activePlayers;
                    message = `👥 ${activePlayers} conectado${activePlayers === 1 ? '' : 's'} - Falta${needed === 1 ? '' : 'n'} ${needed} para comenzar`;
                } else {
                    message = `🏃 ¡${activePlayers} listo${activePlayers === 1 ? '' : 's'}! Presiona ENTER para comenzar`;
                }
                break;
            case 'playing':
                message = `📚 Escribiendo...`;
                break;
            case 'round_ended':
                message = '✅ Mostrando resultados';
                break;
            case 'finished':
                message = '🎉 ¡Partida finalizada!';
                break;
        }
        
        if (this.elements.statusMessage) {
            this.elements.statusMessage.innerHTML = message;
        }
    }
    
    updateButtonStates() {
        const isWaiting = this.gameState.status === 'waiting';
        const isPlaying = this.gameState.status === 'playing';
        const isRoundEnded = this.gameState.status === 'round_ended';
        const isFinished = this.gameState.status === 'finished';
        
        const activePlayers = Object.values(this.gameState.players || {})
            .filter(p => !p.disconnected);
        const activeCount = activePlayers.length;
        const canStartRound = isWaiting && activeCount >= this.gameConfig.minPlayers;
        const isLastRound = this.gameState.round >= this.gameConfig.totalRounds;
        
        if (this.elements.btnStartRound) {
            this.elements.btnStartRound.disabled = !canStartRound;
            this.elements.btnStartRound.style.display = isWaiting ? 'block' : 'none';
        }
        
        if (this.elements.btnEndRound) {
            this.elements.btnEndRound.disabled = !isPlaying;
            this.elements.btnEndRound.style.display = isPlaying ? 'block' : 'none';
        }

        if (this.elements.btnNextRound) {
            this.elements.btnNextRound.disabled = !isRoundEnded || isLastRound;
            this.elements.btnNextRound.style.display = (isRoundEnded && !isLastRound) ? 'block' : 'none';
        }

        if (this.elements.btnFinishGame) {
            this.elements.btnFinishGame.disabled = !isRoundEnded;
            this.elements.btnFinishGame.style.display = (isRoundEnded && isLastRound) ? 'block' : 'none';
        }
        
        if (this.elements.btnNewGame) {
            this.elements.btnNewGame.style.display = isFinished ? 'block' : 'none';
        }
        
        if (this.elements.btnConfig) {
            this.elements.btnConfig.disabled = !isWaiting;
        }
    }
    
    updateTimer() {
        if (this.gameState.status !== 'playing') {
            this.stopTimer();
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = '00:00';
            }
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
        updateTimerDisplay(remaining, this.elements.timerDisplay);
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
            
            const result = await this.client.sendAction('start_round', {
                game_id: this.gameId,
                duration: this.gameConfig.roundDuration,
                total_rounds: this.gameConfig.totalRounds
            });
            
            if (!result.success) {
                showNotification('Error iniciando: ' + (result.message || 'desconocido'), 'error');
                if (this.elements.btnStartRound) {
                    this.elements.btnStartRound.disabled = false;
                    this.elements.btnStartRound.textContent = '▶️ Iniciar (ENTER)';
                }
            }
        } catch (error) {
            debug('Error iniciando ronda:', error, 'error');
            showNotification('Error de conexión', 'error');
            if (this.elements.btnStartRound) {
                this.elements.btnStartRound.disabled = false;
                this.elements.btnStartRound.textContent = '▶️ Iniciar (ENTER)';
            }
        }
    }
    
    async endRound() {
        try {
            if (this.elements.btnEndRound) {
                this.elements.btnEndRound.disabled = true;
                this.elements.btnEndRound.textContent = 'Finalizando...';
            }
            
            const result = await this.client.sendAction('end_round', {
                game_id: this.gameId
            });
            
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

    async nextRound() {
        try {
            if (this.elements.btnNextRound) {
                this.elements.btnNextRound.disabled = true;
                this.elements.btnNextRound.textContent = 'Preparando...';
            }
            
            const result = await this.client.sendAction('start_round', {
                game_id: this.gameId,
                duration: this.gameConfig.roundDuration,
                total_rounds: this.gameConfig.totalRounds
            });
            
            if (!result.success) {
                showNotification('Error iniciando siguiente ronda', 'error');
                if (this.elements.btnNextRound) {
                    this.elements.btnNextRound.disabled = false;
                    this.elements.btnNextRound.textContent = '📝 Siguiente';
                }
            }
        } catch (error) {
            debug('Error iniciando siguiente ronda:', error, 'error');
            showNotification('Error de conexión', 'error');
            if (this.elements.btnNextRound) {
                this.elements.btnNextRound.disabled = false;
                this.elements.btnNextRound.textContent = '📝 Siguiente';
            }
        }
    }

    async finishGame() {
        try {
            if (this.elements.btnFinishGame) {
                this.elements.btnFinishGame.disabled = true;
                this.elements.btnFinishGame.textContent = 'Terminando...';
            }
            
            const result = await this.client.sendAction('reset_game', {
                game_id: this.gameId
            });
            
            if (!result.success) {
                showNotification('Error terminando partida', 'error');
                if (this.elements.btnFinishGame) {
                    this.elements.btnFinishGame.disabled = false;
                    this.elements.btnFinishGame.textContent = '🏁 Terminar';
                }
            }
        } catch (error) {
            debug('Error terminando partida:', error, 'error');
            showNotification('Error de conexión', 'error');
            if (this.elements.btnFinishGame) {
                this.elements.btnFinishGame.disabled = false;
                this.elements.btnFinishGame.textContent = '🏁 Terminar';
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

console.log('%c✅ host-manager.js - Control de rondas, configuración, eliminación de jugadores, resultados', 'color: #10B981; font-weight: bold');