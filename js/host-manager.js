/**
 * Host Manager - Gestión de partida en host
 * Maneja: timer, categoría, ranking, panel tabs
 * (Lógica del menú hamburguesa ahora en menu-opciones.js)
 * 
 * 🔧 REFACTORIZADO FASE 2:
 * - Elimina método showFatalError() duplicado
 * - Usa UI.showFatalError() centralizado de shared-utils.js
 * - ModalHandler centralizado para modales
 * - SessionManager para persistencia
 * - ConfigService.load() + syncCommConfigWithServer() para sincronización
 * 🎯 FEATURE: Restaurada lógica de selector de categoría
 * 🔧 FIX: Moved determineUIState to after dependencies load
 * 🔧 FIX: Remove fallbacks - fail-fast dev mode for v1.0
 * 🔧 FIX: Ensure dictionaryService.initialize() executed before operations
 * 🔧 FASE 3-CORE: Espera a que dictionaryService Y configService estén listos
 * 🔧 FASE 3-CORE: WordEngine ya está configurado por DictionaryService.initialize()
 * 🔧 FASE 3-OPT: Optimized manager to consume GameTimer centralized utility
 * 🔧 PHASE 1: Removed ghost 'start-screen' element from cacheElements
 * 🔧 PHASE 1: Fixed round display - removed duplicate "Ronda" label
 * 🔧 PHASE 3: Settings Modal wired - cached, initialized, events bound
 * 🔧 PHASE 6-MODAL: Migrado a ModalManager unificado
 * 🔧 PHASE 2-SYNC: ConfigService + COMM_CONFIG sync after load
 * 🎯 FEATURE: Hurry Up (Remate) implemented - reduces round timer to threshold
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
        this.hurryUpActive = false;

        this.elements = {};
        this.wordEngineReady = false;
        this.categories = [];
        this.categoryWordsMap = {};

        this.roundsInput = 3;
        this.durationInput = 60;
        this.categorySelectValue = '';
        this.gameCodeInput = '';

        this.loadConfigAndInit();
    }

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
            debug('⏳ Cargando configuración y diccionario...', null, 'info');
            
            const [configResult, dictResult] = await Promise.all([
                configService.load(),
                dictionaryService.load()
            ]);

            debug('✅ ConfigService listo', null, 'success');
            debug('✅ DictionaryService listo + WordEngine inicializado', null, 'success');

            if (!configService.isConfigReady()) {
                throw new Error('ConfigService no está en estado ready');
            }

            if (!dictionaryService.isReady) {
                throw new Error('DictionaryService no está en estado ready');
            }

            if (!wordEngine || !wordEngine.isLoaded) {
                throw new Error('WordEngine no fue inicializado por DictionaryService');
            }

            this.wordEngineReady = true;
            debug('✅ Verificación exitosa: ConfigService + DictionaryService + WordEngine listos', null, 'success');

            syncCommConfigWithServer(configService.config);
            debug('🔗 COMM_CONFIG sincronizado con servidor', null, 'success');

            this.cacheElements();
            this.attachEventListeners();

            await this.populateCategories();

            this.determineUIState();

            const sessionData = hostSession.recover();
            if (sessionData) {
                debug('🔄 Recuperando sesión de host', null, 'info');
                this.resumeGame(sessionData.gameCode);
            } else {
                debug('💡 Mostrando pantalla inicial', null, 'info');
                this.showStartScreen();
            }

            hostSession.registerManager(this);

            debug('✅ HostManager inicializado completamente', null, 'success');
        } catch (error) {
            debug('❌ Error fatal en loadConfigAndInit: ' + error.message, null, 'error');
            UI.showFatalError(`Error de inicialización: ${error.message}`);
            throw error;
        }
    }

    async populateCategories() {
        try {
            this.categories = dictionaryService.getCategories();
            if (this.categories.length > 0) {
                const randomIndex = Math.floor(Math.random() * this.categories.length);
                this.categorySelectValue = this.categories[randomIndex];
                this.updateCodeWithCategoryWord();
            }
            debug('📚 Categorías cargadas', { total: this.categories.length }, 'success');
        } catch (error) {
            debug('⚠️  Error cargando categorías: ' + error.message, null, 'warn');
            throw error;
        }
    }

    async updateCodeWithCategoryWord() {
        try {
            const maxLength = configService.get('max_code_length', 5);
            const randomWord = dictionaryService.getRandomWordByCategory(this.categorySelectValue, maxLength);
            if (randomWord) {
                this.gameCodeInput = randomWord.slice(0, maxLength).toUpperCase();
            }
        } catch (error) {
            debug('⚠️  Error actualizando código: ' + error.message, null, 'warn');
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
            btnSelectCategory: safeGetElement('btn-select-category'),
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

        if (this.elements.btnSelectCategory) {
            this.elements.btnSelectCategory.addEventListener('click', () => this.showCategoryModal());
        }

        if (this.elements.btnEndGame) {
            this.elements.btnEndGame.addEventListener('click', () => this.endGame());
        }

        const btnHamburgerSettings = safeGetElement('hamburger-settings');
        if (btnHamburgerSettings) {
            btnHamburgerSettings.addEventListener('click', () => {
                const hamburgerMenu = safeGetElement('hamburger-menu-host');
                if (hamburgerMenu) hamburgerMenu.classList.remove('menu-open');
                this.showSettingsModal();
            });
        }
    }

    buildStartScreenContent() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="input-group">
                <label class="input-label" for="modal-category-select">Categoría Inicial</label>
                <select id="modal-category-select" class="input-field"></select>
            </div>
            <div class="input-group">
                <label class="input-label" for="modal-game-code">Código de Sala</label>
                <input type="text" id="modal-game-code" class="input-field"
                       placeholder="EJ: ABC123" maxlength="6" autocomplete="off">
            </div>
        `;

        const categorySelect = container.querySelector('#modal-category-select');
        const gameCodeInput = container.querySelector('#modal-game-code');

        this.categories.forEach((cat) => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categorySelect.appendChild(option);
        });

        categorySelect.value = this.categorySelectValue;
        gameCodeInput.value = this.gameCodeInput;

        categorySelect.addEventListener('change', (e) => {
            this.categorySelectValue = e.target.value;
            this.updateCodeWithCategoryWord();
            gameCodeInput.value = this.gameCodeInput;
        });

        gameCodeInput.addEventListener('input', (e) => {
            this.gameCodeInput = e.target.value.toUpperCase();
        });

        gameCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createGame();
        });

        return container;
    }

    buildSettingsContent() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="input-group">
                <label class="input-label" for="modal-rounds">Rondas</label>
                <input type="number" id="modal-rounds" class="input-field"
                       min="1" max="10" value="${this.roundsInput}">
            </div>
            <div class="input-group">
                <label class="input-label" for="modal-duration">Duración por Ronda (seg)</label>
                <input type="number" id="modal-duration" class="input-field"
                       min="10" max="300" value="${this.durationInput}">
            </div>
        `;

        const roundsInput = container.querySelector('#modal-rounds');
        const durationInput = container.querySelector('#modal-duration');

        roundsInput.addEventListener('change', (e) => {
            this.roundsInput = parseInt(e.target.value, 10);
        });

        durationInput.addEventListener('change', (e) => {
            this.durationInput = parseInt(e.target.value, 10);
        });

        return container;
    }

    buildCategoryContent() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="input-group">
                <label class="input-label" for="modal-category-input">Categoría</label>
                <input type="text" id="modal-category-input" class="input-field"
                       placeholder="Escribe una categoría (ej: Películas, Animales, Países)"
                       maxlength="50">
            </div>
        `;
        return container;
    }

    showStartScreen() {
        const content = this.buildStartScreenContent();

        ModalManager_Instance.show({
            type: 'primary',
            title: 'Nueva Partida',
            content: content,
            buttons: [
                { label: '🎮 Crear Juego', class: 'btn-modal-primary', action: () => this.createGame(), close: false },
                { label: '⚡ Opciones', class: 'btn-secondary', action: () => this.showSettingsModal(), close: false }
            ]
        });
    }

    showSettingsModal() {
        const content = this.buildSettingsContent();

        ModalManager_Instance.show({
            type: 'secondary',
            title: '⚡ Configuración de Juego',
            content: content,
            buttons: [
                { label: 'Cerrar', class: 'btn', action: null, close: true }
            ]
        });
    }

    showCategoryModal() {
        const content = this.buildCategoryContent();
        const categoryInput = content.querySelector('#modal-category-input');

        ModalManager_Instance.show({
            type: 'secondary',
            title: '📚 Seleccionar Categoría',
            content: content,
            buttons: [
                { label: 'Cancelar', class: 'btn', action: null, close: true },
                { label: 'Confirmar', class: 'btn-modal-primary', action: () => this.setCategory(categoryInput.value), close: false }
            ]
        });
    }

    async createGame() {
        const code = this.gameCodeInput.trim().toUpperCase();
        const selectedCategory = this.categorySelectValue;
        const rounds = this.roundsInput;
        const duration = this.durationInput;

        if (!isValidGameCode(code)) {
            showNotification('⚠️  Código inválido', 'warning');
            return;
        }

        if (rounds < 1 || rounds > 10) {
            showNotification('⚠️  Rondas deben estar entre 1 y 10', 'warning');
            return;
        }

        if (duration < 10 || duration > 300) {
            showNotification('⚠️  Duración debe estar entre 10 y 300 segundos', 'warning');
            return;
        }

        try {
            this.gameCode = code;
            this.currentCategory = selectedCategory;
            this.totalRounds = rounds;
            this.client = new GameClient(code, code, 'host');

            const result = await this.client.sendAction('create_game', {
                category: selectedCategory,
                total_rounds: rounds,
                round_duration: duration
            });

            if (result.success) {
                debug(`✅ Juego creado: ${code} (Categoría: ${selectedCategory}, Rondas: ${rounds}, Duración: ${duration}s)`, null, 'success');

                hostSession.saveHostSession(code, selectedCategory);

                ModalManager_Instance.close();
                this.loadGameScreen(result.state || {});
            } else {
                showNotification('❌ ' + (result.message || 'Error al crear juego'), 'error');
            }
        } catch (error) {
            debug('Error creando juego:', error, 'error');
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
        debug('📈 Estado actualizado:', null, 'debug');

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

        if (this.elements.btnHurryUp) {
            safeShowElement(this.elements.btnHurryUp);
            this.elements.btnHurryUp.disabled = this.hurryUpActive;
            this.elements.btnHurryUp.textContent = this.hurryUpActive ? '⚡ REMATE ACTIVO' : '⚡ REMATE';
        }

        if (state.round_started_at && state.round_duration) {
            this.startContinuousTimer(state);
        }
    }

    async showCountdown(state) {
        debug('⏱️ Iniciando countdown para host', null, 'debug');
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

        const remaining = GameTimer.getRemaining(state.round_started_at, state.round_duration);
        GameTimer.updateDisplay(remaining, this.elements.headerTimer, '⏳');
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
            debug('✅ Juego terminado', null, 'success');

            hostSession.clear();
            location.reload();
        } catch (error) {
            debug('Error terminando juego:', error, 'error');
        }
    }

    destroy() {
        debug('🧹 Destroying HostManager...', null, 'info');

        this.stopTimer();

        if (this.client) {
            this.client.disconnect();
            this.client = null;
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

console.log('%c✅ host-manager.js - Hurry Up (Remate) feature implemented', 'color: #FF00FF; font-weight: bold; font-size: 12px');