class HostManager extends BaseController {
    constructor(gameCode) {
        super();
        this.gameCode = gameCode;
        this.currentRound = 0;
        this.totalRounds = 3;
        this.remainingTime = 0;
        this.activeTab = 'ranking';
        this.minPlayers = 2;
        this.currentPlayers = [];
        this.currentCategory = 'Sin categoría';
        this.roundEnded = false;
        this.hurryUpActive = false;
        this.categories = [];
        this.categoryWordsMap = {};

        this.loadConfigAndInit();
    }

    getStorageKeys() {
        return {
            primary: StorageKeys.HOST_GAME_CODE,
            category: StorageKeys.HOST_CATEGORY
        };
    }

    recoverSession() {
        const keys = this.getStorageKeys();
        const gameCode = StorageManager.get(keys.primary);
        const category = StorageManager.get(keys.category);
        return gameCode ? { gameCode, category } : null;
    }

    saveSession(gameCode, category) {
        const keys = this.getStorageKeys();
        StorageManager.set(keys.primary, gameCode);
        StorageManager.set(keys.category, category || 'Sin categoría');
    }

    determineUIState() {
        const hasSession = this.hasActiveSession();
        const root = document.documentElement;

        if (hasSession) {
            root.classList.add('has-session');
            root.classList.remove('no-session');
        } else {
            root.classList.add('no-session');
            root.classList.remove('has-session');
        }
    }

    async loadConfigAndInit() {
        try {
            debug('⏳ Cargando configuración...', null, 'info');
            
            const configResult = await configService.load();

            debug('✅ ConfigService listo', null, 'success');

            if (!configService.isConfigReady()) {
                throw new Error('ConfigService no está en estado ready');
            }

            debug('✅ Verificación exitosa: ConfigService listo', null, 'success');

            syncCommConfigWithServer(configService.config);
            debug('🔗 COMM_CONFIG sincronizado con servidor', null, 'success');

            this.cacheElements();
            this.attachEventListeners();

            await this.populateCategories();

            this.determineUIState();

            const sessionData = this.recoverSession();
            if (sessionData) {
                debug('🔄 Recuperando sesión de host', null, 'info');
                this.resumeGame(sessionData.gameCode);
            } else {
                debug('💡 Mostrando pantalla inicial', null, 'info');
                this.showStartScreen();
            }

            debug('✅ HostManager inicializado completamente', null, 'success');
        } catch (error) {
            debug('❌ Error fatal en loadConfigAndInit: ' + error.message, null, 'error');
            UI.showFatalError(`Error de inicialización: ${error.message}`);
            throw error;
        }
    }

    async populateCategories() {
        try {
            const result = await fetch('/app/actions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_categories' })
            });
            const data = await result.json();

            if (data.success && Array.isArray(data.categories)) {
                this.categories = data.categories;
                debug('📚 Categorías cargadas', { total: this.categories.length }, 'success');
            } else {
                debug('⚠️  Error cargando categorías', null, 'warn');
                this.categories = [];
            }
        } catch (error) {
            debug('⚠️  Error cargando categorías: ' + error.message, null, 'warn');
            this.categories = [];
        }
    }

    getCanonicalForCompare(word) {
        return wordEngine.getCanonical(word);
    }

    getMatchType(word1, word2) {
        return wordEngine.getMatchType(word1, word2);
    }

    cacheElements() {
        this.elements = {
            gameScreen: safeGetElement('game-screen'),
            headerCode: safeGetElement('header-code'),
            headerRound: safeGetElement('header-round'),
            headerTimer: safeGetElement('header-timer'),
            playersList: safeGetElement('players-list'),
            categoryLabel: safeGetElement('category-label'),
            currentWord: safeGetElement('current-word'),
            countdownOverlay: safeGetElement('countdown-overlay'),
            countdownNumber: safeGetElement('countdown-number'),
            statusMessage: safeGetElement('status-message'),
            btnStartRound: safeGetElement('btn-start-round'),
            btnHurryUp: safeGetElement('btn-hurry-up'),
            btnEndGame: safeGetElement('btn-end-game')
        };
    }

    attachEventListeners() {
        if (this.elements.btnStartRound) {
            this.elements.btnStartRound.addEventListener('click', () => this.startRound());
        }

        if (this.elements.btnHurryUp) {
            this.elements.btnHurryUp.addEventListener('click', () => this.activateHurryUp());
        }

        if (this.elements.btnEndGame) {
            this.elements.btnEndGame.addEventListener('click', () => this.endGame());
        }
    }

    showStartScreen() {
        window.createGameModal.openModal();
    }

    async setCategory(category) {
        const cat = (category || '').trim();

        if (!cat || cat.length > COMM_CONFIG.MAX_CATEGORY_LENGTH) {
            showNotification('⚠️ Categoría inválida', 'warning');
            return;
        }

        if (!this.client) return;

        try {
            const result = await this.client.sendAction('set_category', { category: cat });

            if (result.success) {
                debug(`✅ Categoría establecida: ${cat}`, null, 'success');
                this.currentCategory = cat;

                ModalManager_Instance.close();
                showNotification(`📂 Categoría: ${cat}`, 'success');
            } else {
                showNotification('❌ Error estableciendo categoría', 'error');
            }
        } catch (error) {
            debug('Error estableciendo categoría:', error, 'error');
            showNotification('❌ Error de conexión', 'error');
        }
    }

    loadGameScreen(state) {
        safeShowElement(this.elements.gameScreen);

        if (this.elements.headerCode) {
            this.elements.headerCode.textContent = this.gameCode;
        }

        this.client.onStateUpdate = (s) => this.handleStateUpdate(s);
        this.client.onConnectionLost = () => this.handleConnectionLost();
        this.client.connect();

        this.handleStateUpdate(state);
    }

    async resumeGame(gameCode) {
        try {
            this.gameCode = gameCode;
            this.client = new GameClient(gameCode, gameCode, 'host');
            const result = await this.client.sendAction('get_state');

            if (result.success && result.state) {
                debug('✅ Sesión recuperada', null, 'success');
                this.loadGameScreen(result.state);
                return;
            }

            debug('⚠️  No se pudo recuperar sesión', null, 'warn');
            this.clearSession();
            this.showStartScreen();
        } catch (error) {
            debug('Error recuperando sesión:', error, 'error');
            this.clearSession();
            this.showStartScreen();
        }
    }

    handleStateUpdate(state) {
        this.gameState = state;
        debug('📈 Estado actualizado:', null, 'debug');

        this.calibrateTimeSync(state);

        if (this.elements.headerRound) {
            const round = state.round || 0;
            const total = state.total_rounds || 3;
            this.elements.headerRound.textContent = `${round}/${total}`;
        }

        this.updatePlayersList(state);

        switch (state.status) {
            case 'waiting':
                this.showWaitingState();
                break;
            case 'playing':
                this.showPlayingState(state);
                break;
            case 'round_ended':
                this.showRoundEnded(state);
                break;
            case 'finished':
                this.showGameFinished(state);
                break;
        }
    }

    updatePlayersList(state) {
        if (!state.players) return;

        this.currentPlayers = Object.values(state.players);

        if (this.elements.playersList) {
            const html = Object.entries(state.players).map(([pid, player]) => {
                const ready = player.status === 'ready';
                const readyIcon = ready ? '✅' : '⏳';
                const wordCount = player.answers ? player.answers.length : 0;
                return `
                    <div class="player-item ${ready ? 'ready' : 'waiting'}">
                        <div class="player-name" style="color: ${player.color || '#999'}">
                            ${readyIcon} ${sanitizeText(player.name)}
                        </div>
                        <div class="player-words">${wordCount} palabras</div>
                        <div class="player-score">${player.score || 0} pts</div>
                    </div>
                `;
            }).join('');

            this.elements.playersList.innerHTML = html;
        }
    }

    showWaitingState() {
        safeHideElement(this.elements.currentWord);
        safeHideElement(this.elements.categoryLabel);
        safeHideElement(this.elements.countdownOverlay);
        safeHideElement(this.elements.btnHurryUp);

        if (this.elements.statusMessage) {
            this.elements.statusMessage.textContent = '⏳ En espera de jugadores (mín. 2)';
        }

        if (this.elements.btnStartRound) {
            const hasMinPlayers = this.currentPlayers && this.currentPlayers.length >= this.minPlayers;
            this.elements.btnStartRound.disabled = !hasMinPlayers;
            if (hasMinPlayers) {
                this.elements.btnStartRound.textContent = '🎮 Iniciar Ronda';
            }
        }

        this.stopTimer();
        GameTimer.updateDisplay(null, this.elements.headerTimer, '⏳');
    }

    showPlayingState(state) {
        safeHideElement(this.elements.countdownOverlay);

        if (this.elements.currentWord) {
            this.elements.currentWord.textContent = state.current_prompt || '???';
            safeShowElement(this.elements.currentWord);
        }

        if (this.elements.categoryLabel && state.current_category) {
            this.elements.categoryLabel.textContent = `Categoría: ${state.current_category}`;
            safeShowElement(this.elements.categoryLabel);
        }

        if (this.elements.statusMessage) {
            const readyCount = (this.currentPlayers || []).filter(p => p.status === 'ready').length;
            const total = this.currentPlayers.length;
            this.elements.statusMessage.textContent = `🎮 Jugando... (${readyCount}/${total} listos)`;
        }

        if (this.elements.btnStartRound) {
            this.elements.btnStartRound.disabled = true;
            this.elements.btnStartRound.textContent = '▶️ En Juego';
        }

        if (this.elements.btnHurryUp) {
            safeShowElement(this.elements.btnHurryUp);
            this.elements.btnHurryUp.disabled = this.hurryUpActive;
            this.elements.btnHurryUp.textContent = this.hurryUpActive ? '⚡ REMATE ACTIVO' : '⚡ REMATE';
        }

        if (state.round_started_at && state.round_duration) {
            this.startContinuousTimer(state);
        }
    }

    async startRound() {
        if (!this.client) return;

        debug('🎮 Iniciando ronda...', null, 'info');

        if (this.elements.btnStartRound) {
            this.elements.btnStartRound.disabled = true;
            this.elements.btnStartRound.textContent = '⏳ Iniciando...';
        }

        this.hurryUpActive = false;

        try {
            const result = await this.client.sendAction('start_round', {});

            if (result.success && result.state) {
                debug('✅ Ronda iniciada', null, 'success');
                const state = result.state;

                if (state.round_starts_at) {
                    const nowServer = timeSync.isCalibrated ? timeSync.getServerTime() : Date.now();
                    const countdownDuration = state.countdown_duration || 4000;
                    const elapsedSinceStart = nowServer - state.round_starts_at;

                    if (elapsedSinceStart < countdownDuration) {
                        await this.showCountdown(state);
                    }
                }

                this.handleStateUpdate(state);
            } else {
                showNotification('❌ Error iniciando ronda', 'error');
                if (this.elements.btnStartRound) {
                    this.elements.btnStartRound.disabled = false;
                    this.elements.btnStartRound.textContent = '🎮 Iniciar Ronda';
                }
            }
        } catch (error) {
            debug('Error iniciando ronda:', error, 'error');
            if (this.elements.btnStartRound) {
                this.elements.btnStartRound.disabled = false;
                this.elements.btnStartRound.textContent = '🎮 Iniciar Ronda';
            }
        }
    }

    async activateHurryUp() {
        if (!this.client || this.hurryUpActive) return;

        debug('⚡ Activando Remate...', null, 'info');

        if (this.elements.btnHurryUp) {
            this.elements.btnHurryUp.disabled = true;
            this.elements.btnHurryUp.textContent = '⏳ Enviando...';
        }

        try {
            const hurryUpThreshold = configService.get('hurry_up_threshold', 10) * 1000;
            const result = await this.client.sendAction('update_round_timer', {
                new_end_time: timeSync.getServerTime() + hurryUpThreshold
            });

            if (result.success) {
                debug('✅ Remate activado', null, 'success');
                this.hurryUpActive = true;
                showNotification('⚡ ¡REMATE ACTIVADO!', 'info');
                this.handleStateUpdate(result.state || this.gameState);
            } else {
                showNotification('❌ Error activando remate', 'error');
                if (this.elements.btnHurryUp) {
                    this.elements.btnHurryUp.disabled = false;
                    this.elements.btnHurryUp.textContent = '⚡ REMATE';
                }
            }
        } catch (error) {
            debug('Error activando remate:', error, 'error');
            showNotification('❌ Error de conexión', 'error');
            if (this.elements.btnHurryUp) {
                this.elements.btnHurryUp.disabled = false;
                this.elements.btnHurryUp.textContent = '⚡ REMATE';
            }
        }
    }

    showRoundEnded(state) {
        this.stopTimer();
        safeHideElement(this.elements.currentWord);
        safeHideElement(this.elements.categoryLabel);
        safeHideElement(this.elements.countdownOverlay);
        safeHideElement(this.elements.btnHurryUp);

        if (this.elements.statusMessage) {
            this.elements.statusMessage.textContent = '✅ Ronda Finalizada - Mostrando Resultados';
        }

        if (this.elements.btnStartRound) {
            this.elements.btnStartRound.disabled = false;
            this.elements.btnStartRound.textContent = '🎮 Siguiente Ronda';
        }
    }

    showGameFinished(state) {
        this.stopTimer();
        safeHideElement(this.elements.countdownOverlay);
        safeHideElement(this.elements.btnHurryUp);

        if (this.elements.statusMessage) {
            this.elements.statusMessage.textContent = '🏆 ¡Juego Finalizado!';
        }

        if (this.elements.btnStartRound) {
            this.elements.btnStartRound.disabled = true;
            this.elements.btnStartRound.textContent = '🏆 Fin';
        }
    }

    async endGame() {
        if (!this.client) return;

        const confirm = window.confirm('¿Terminar juego?');
        if (!confirm) return;

        try {
            await this.client.sendAction('end_game', {});
            debug('✅ Juego terminado', null, 'success');

            this.clearSession();
            location.reload();
        } catch (error) {
            debug('Error terminando juego:', error, 'error');
        }
    }
}

let hostManager = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!hostManager) {
        hostManager = new HostManager();
    }
}, { once: true });

console.log('%c✅ HostController.js', 'color: #FF00FF; font-weight: bold; font-size: 12px');
