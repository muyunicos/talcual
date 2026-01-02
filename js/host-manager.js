/**
 * Host Manager - Gestión de partida en host
 * Maneja: timer, categoría, ranking, panel tabs
 * (Lógica del menú hamburguesa ahora en menu-opciones.js)
 * 
 * 🔧 REFACTORIZADO FASE 5:
 * - Manejo de errores FUERTE (rechaza Promises, no fallbacks)
 * - Usa wordEngine desacoplado (no wordEngineManager)
 * - ModalHandler centralizado para modales
 * - SessionManager para persistencia
 * 🎯 FEATURE: Restaurada lógica de selector de categoría
 * 🔧 FIX: Moved determineUIState to after dependencies load
 * 🔧 FIX: Remove fallbacks - fail-fast dev mode for v1.0
 */

class HostManager {
    constructor(gameCode) {
        this.gameCode = gameCode;
        this.client = null;
        this.currentRound = 0;
        this.totalRounds = 3;
        this.remainingTime = 0;
        this.timerInterval = null;
        this.activeTab = 'ranking';
        this.minPlayers = 2;
        this.currentPlayers = [];
        this.gameState = {};
        this.countdownRAFId = null;
        this.currentCategory = 'Sin categoría';
        this.roundEnded = false;

        this.elements = {};

        this.startGameModal = null;
        this.categoryModal = null;

        this.wordEngineReady = false;

        this.categories = [];
        this.categoryWordsMap = {};

        this.loadConfigAndInit();
    }

    /**
     * 🔧 FIX: Determinar UI state basado en sesión activa
     * Esta función ahora se llama después de que las dependencias estén listas
     */
    determineUIState() {
        const hasSession = hostSession.isSessionActive();
        const gameCode = StorageManager.get(StorageKeys.HOST_GAME_CODE);
        const root = document.documentElement;

        if (hasSession && gameCode) {
            root.classList.add('has-session');
            root.classList.remove('no-session');
        } else {
            root.classList.add('no-session');
            root.classList.remove('has-session');
        }
    }

    async loadConfigAndInit() {
        try {
            debug('⏳ Cargando configuración...', 'info');
            await configService.load();
            debug('✅ Config cargada', 'info');

            debug('⏳ Inicializando diccionario...', 'info');
            await this.initWordEngine();
            debug('✅ WordEngine listo', 'info');

            this.cacheElements();
            this.initializeModals();
            this.attachEventListeners();

            await this.populateCategorySelector();

            this.determineUIState();

            const sessionData = hostSession.recover();
            if (sessionData) {
                debug('🔄 Recuperando sesión de host', 'info');
                this.resumeGame(sessionData.gameCode);
            } else {
                debug('💡 Mostrando pantalla inicial', 'info');
                this.showStartScreen();
            }

            hostSession.registerManager(this);

            debug('✅ HostManager inicializado completamente');
        } catch (error) {
            debug('❌ Error fatal en loadConfigAndInit: ' + error.message, null, 'error');
            this.showFatalError(`Error de inicialización: ${error.message}`);
            throw error;
        }
    }

    showFatalError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fatal-error';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #EF4444;
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 9999;
            text-align: center;
            font-weight: bold;
            max-width: 80%;
            word-wrap: break-word;
        `;
        document.body.appendChild(errorDiv);
    }

    async initWordEngine() {
        await dictionaryService.initialize();
        this.wordEngineReady = true;
        debug('📚 Word engine inicializado en host', null, 'success');
    }

    async populateCategorySelector() {
        try {
            const categorySelect = safeGetElement('category-select');
            if (!categorySelect) return;

            this.categories = dictionaryService.getCategories();

            categorySelect.innerHTML = '';
            this.categories.forEach((cat) => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                categorySelect.appendChild(option);
            });

            if (this.categories.length > 0) {
                const randomIndex = Math.floor(Math.random() * this.categories.length);
                categorySelect.value = this.categories[randomIndex];
                this.updateCodeWithCategoryWord();

                categorySelect.addEventListener('change', () => this.updateCodeWithCategoryWord());
            }

            debug('📚 Selector de categoría poblado', { total: this.categories.length }, 'success');
        } catch (error) {
            debug('⚠️  Error poblando selector de categoría: ' + error.message, null, 'warn');
            throw error;
        }
    }

    async updateCodeWithCategoryWord() {
        try {
            const categorySelect = safeGetElement('category-select');
            const inputCode = safeGetElement('input-game-code');

            if (!categorySelect || !inputCode) return;

            const selectedCategory = categorySelect.value;
            const randomWord = dictionaryService.getRandomWordByCategory(selectedCategory);

            if (randomWord) {
                inputCode.value = randomWord.slice(0, 5).toUpperCase();
            }
        } catch (error) {
            debug('⚠️  Error actualizando código con palabra: ' + error.message, null, 'warn');
        }
    }

    getCanonicalForCompare(word) {
        return wordEngine.getCanonical(word);
    }

    getMatchType(word1, word2) {
        return wordEngine.getMatchType(word1, word2);
    }

    initializeModals() {
        this.startGameModal = new ModalController('modal-start-game', {
            closeOnBackdrop: false,
            closeOnEsc: false,
            onAfterOpen: () => {
                const inputCode = safeGetElement('input-game-code');
                if (inputCode) {
                    inputCode.focus();
                }
            }
        });

        this.categoryModal = new ModalController('modal-category', {
            closeOnBackdrop: true,
            closeOnEsc: true
        });
    }

    cacheElements() {
        this.elements = {
            startScreen: safeGetElement('start-screen'),
            categorySelect: safeGetElement('category-select'),
            inputGameCode: safeGetElement('input-game-code'),
            btnCreateGame: safeGetElement('btn-create-game'),

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
            btnSelectCategory: safeGetElement('btn-select-category'),
            btnEndGame: safeGetElement('btn-end-game'),

            categoryInput: safeGetElement('category-input'),
            btnConfirmCategory: safeGetElement('btn-confirm-category')
        };
    }

    attachEventListeners() {
        if (this.elements.btnCreateGame) {
            this.elements.btnCreateGame.addEventListener('click', () => this.createGame());
        }

        if (this.elements.inputGameCode) {
            this.elements.inputGameCode.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.createGame();
            });
        }

        if (this.elements.btnStartRound) {
            this.elements.btnStartRound.addEventListener('click', () => this.startRound());
        }

        if (this.elements.btnSelectCategory) {
            this.elements.btnSelectCategory.addEventListener('click', () => this.showCategoryModal());
        }

        if (this.elements.btnConfirmCategory) {
            this.elements.btnConfirmCategory.addEventListener('click', () => this.setCategory());
        }

        if (this.elements.btnEndGame) {
            this.elements.btnEndGame.addEventListener('click', () => this.endGame());
        }
    }

    async createGame() {
        const selectedCategory = this.elements.categorySelect?.value || 'general';
        const code = (this.elements.inputGameCode?.value || '').trim().toUpperCase();

        if (!isValidGameCode(code)) {
            showNotification('⚠️  Código inválido', 'warning');
            return;
        }

        if (this.elements.btnCreateGame) {
            this.elements.btnCreateGame.disabled = true;
            this.elements.btnCreateGame.textContent = 'Creando...';
        }

        try {
            this.gameCode = code;
            this.currentCategory = selectedCategory;
            this.client = new GameClient(code, code, 'host');

            const result = await this.client.sendAction('create_game', {
                category: selectedCategory
            });

            if (result.success) {
                debug(`✅ Juego creado: ${code} (Categoría: ${selectedCategory})`);

                hostSession.saveHostSession(code, selectedCategory);

                this.loadGameScreen(result.state || {});
            } else {
                if (this.elements.btnCreateGame) {
                    this.elements.btnCreateGame.disabled = false;
                    this.elements.btnCreateGame.textContent = '🎮 Crear Juego';
                }
                showNotification('❌ ' + (result.message || 'Error al crear juego'), 'error');
            }
        } catch (error) {
            debug('Error creando juego:', error, 'error');
            if (this.elements.btnCreateGame) {
                this.elements.btnCreateGame.disabled = false;
                this.elements.btnCreateGame.textContent = '🎮 Crear Juego';
            }
            showNotification('❌ Error de conexión', 'error');
        }
    }

    showStartScreen() {
        this.startGameModal.open();
    }

    loadGameScreen(state) {
        this.startGameModal.close();
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
                debug('✅ Sesión recuperada');
                this.loadGameScreen(result.state);
                return;
            }

            debug('⚠️  No se pudo recuperar sesión');
            hostSession.clear();
            this.showStartScreen();
        } catch (error) {
            debug('Error recuperando sesión:', error, 'error');
            hostSession.clear();
            this.showStartScreen();
        }
    }

    handleStateUpdate(state) {
        this.gameState = state;
        debug('📈 Estado actualizado:', state.status);

        if (state.server_now && state.round_starts_at && !timeSync.isCalibrated) {
            timeSync.calibrateWithServerTime(
                state.server_now,
                state.round_starts_at,
                state.round_ends_at,
                state.round_duration
            );
        }

        if (this.elements.headerRound) {
            const round = state.round || 0;
            const total = state.total_rounds || 3;
            this.elements.headerRound.textContent = `Ronda ${round}/${total}`;
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
        if (this.elements.headerTimer) {
            updateTimerDisplay(null, this.elements.headerTimer, '⏳');
        }
    }

    showPlayingState(state) {
        safeHideElement(this.elements.countdownOverlay);

        if (this.elements.currentWord) {
            this.elements.currentWord.textContent = state.current_word || '???';
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

        if (state.round_started_at && state.round_duration) {
            this.startContinuousTimer(state);
        }
    }

    async showCountdown(state) {
        debug('⏱️ Iniciando countdown para host', 'debug');
        const countdownDuration = state.countdown_duration || 4000;

        safeShowElement(this.elements.countdownOverlay);
        if (this.elements.countdownNumber) {
            this.elements.countdownNumber.style.fontSize = 'inherit';
        }

        return new Promise((resolve) => {
            const update = () => {
                const nowServer = timeSync.getServerTime();
                const elapsed = nowServer - state.round_starts_at;
                const remaining = Math.max(0, countdownDuration - elapsed);
                const seconds = Math.ceil(remaining / 1000);

                if (this.elements.countdownNumber) {
                    if (seconds > 3) {
                        this.elements.countdownNumber.textContent = '¿Preparado?';
                        this.elements.countdownNumber.style.fontSize = '1.2em';
                    } else if (seconds > 0) {
                        this.elements.countdownNumber.textContent = seconds.toString();
                        this.elements.countdownNumber.style.fontSize = 'inherit';
                    } else {
                        this.elements.countdownNumber.textContent = '';
                    }
                }

                if (remaining > 0) {
                    this.countdownRAFId = requestAnimationFrame(update);
                } else {
                    safeHideElement(this.elements.countdownOverlay);
                    resolve();
                }
            };
            this.countdownRAFId = requestAnimationFrame(update);
        });
    }

    async startRound() {
        if (!this.client) return;

        debug('🎮 Iniciando ronda...', 'info');

        if (this.elements.btnStartRound) {
            this.elements.btnStartRound.disabled = true;
            this.elements.btnStartRound.textContent = '⏳ Iniciando...';
        }

        try {
            const result = await this.client.sendAction('start_round', {});

            if (result.success && result.state) {
                debug('✅ Ronda iniciada');
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

    showRoundEnded(state) {
        this.stopTimer();
        safeHideElement(this.elements.currentWord);
        safeHideElement(this.elements.categoryLabel);
        safeHideElement(this.elements.countdownOverlay);

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

        if (this.elements.statusMessage) {
            this.elements.statusMessage.textContent = '🏆 ¡Juego Finalizado!';
        }

        if (this.elements.btnStartRound) {
            this.elements.btnStartRound.disabled = true;
            this.elements.btnStartRound.textContent = '🏆 Fin';
        }
    }

    showCategoryModal() {
        this.categoryModal.open();
    }

    async setCategory() {
        const category = (this.elements.categoryInput?.value || '').trim();

        if (!category || category.length > COMM_CONFIG.MAX_CATEGORY_LENGTH) {
            showNotification('⚠️ Categoría inválida', 'warning');
            return;
        }

        if (!this.client) return;

        try {
            const result = await this.client.sendAction('set_category', { category });

            if (result.success) {
                debug(`✅ Categoría establecida: ${category}`);
                this.currentCategory = category;

                this.categoryModal.close();
                showNotification(`📂 Categoría: ${category}`, 'success');
            } else {
                showNotification('❌ Error estableciendo categoría', 'error');
            }
        } catch (error) {
            debug('Error estableciendo categoría:', error, 'error');
            showNotification('❌ Error de conexión', 'error');
        }
    }

    startContinuousTimer(state) {
        this.stopTimer();
        this.updateTimerFromState(state);

        this.timerInterval = setInterval(() => {
            if (this.gameState && this.gameState.status === 'playing') {
                this.updateTimerFromState(this.gameState);
            }
        }, 1000);
    }

    updateTimerFromState(state) {
        if (!state.round_started_at) {
            this.stopTimer();
            return;
        }

        const remaining = getRemainingTime(state.round_started_at, state.round_duration);
        updateTimerDisplay(remaining, this.elements.headerTimer, '⏳');
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.countdownRAFId) {
            cancelAnimationFrame(this.countdownRAFId);
            this.countdownRAFId = null;
        }
    }

    async endGame() {
        if (!this.client) return;

        const confirm = window.confirm('¿Terminar juego?');
        if (!confirm) return;

        try {
            await this.client.sendAction('end_game', {});
            debug('✅ Juego terminado');

            hostSession.clear();
            location.reload();
        } catch (error) {
            debug('Error terminando juego:', error, 'error');
        }
    }

    destroy() {
        debug('🧹 Destroying HostManager...', 'info');

        this.stopTimer();

        if (this.client) {
            this.client.disconnect();
            this.client = null;
        }

        if (this.startGameModal) {
            this.startGameModal.destroy();
        }
        if (this.categoryModal) {
            this.categoryModal.destroy();
        }

        this.currentPlayers = [];
        this.gameState = null;
        this.elements = {};
    }

    handleConnectionLost() {
        alert('Desconectado del servidor');
        this.exitGame();
    }

    exitGame() {
        if (this.client) {
            this.client.disconnect();
        }
        hostSession.clear();
        location.reload();
    }
}

let hostManager = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!hostManager) {
        hostManager = new HostManager();
    }
}, { once: true });

console.log('%c✅ host-manager.js - FASE 5-FEATURE: Category selector integration + fail-fast dev mode', 'color: #FF00FF; font-weight: bold; font-size: 12px');
