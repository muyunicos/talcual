/**
 * @file player-manager.js
 * @description Gestor mejorado de lógica del jugador con countdown sincronizado y auto-submit
 * (Menú hamburguesa ahora manejado por menu-opciones.js)
 */

class PlayerManager {
    constructor() {
        this.gameId = null;
        this.playerId = null;
        this.playerName = null;
        this.playerColor = null;
        this.client = null;
        this.gameState = null;
        this.myWords = [];
        this.maxWords = 6;
        this.timerInterval = null;
        this.countdownTimeout = null;

        this.lastWordsUpdateTime = 0;
        this.wordsUpdatePending = false;

        this.availableAuras = [];
        this.selectedAura = null;

        this.elements = {};

        // Motor de comparación (player) - evita equivalentes repetidos
        this.wordEngine = null;
        this.wordEngineReady = false;
        this.wordEngineInitPromise = null;
    }

    initialize() {
        debug('🍢 Inicializando PlayerManager');
        this.cacheElements();
        this.attachEventListeners();

        // Precargar motor de palabras lo antes posible
        this.initWordEngine();

        // FASE 1: usar claves centralizadas
        const savedGameId = (typeof StorageKeys !== 'undefined') ? getLocalStorage(StorageKeys.GAME_ID) : getLocalStorage('gameId');
        const savedPlayerId = (typeof StorageKeys !== 'undefined') ? getLocalStorage(StorageKeys.PLAYER_ID) : getLocalStorage('playerId');
        const savedPlayerName = (typeof StorageKeys !== 'undefined') ? getLocalStorage(StorageKeys.PLAYER_NAME) : getLocalStorage('playerName');
        const savedPlayerColor = (typeof StorageKeys !== 'undefined') ? getLocalStorage(StorageKeys.PLAYER_COLOR) : getLocalStorage('playerColor');

        if (savedGameId && savedPlayerId && savedPlayerName && savedPlayerColor) {
            debug('🔄 Recuperando sesión');
            this.recoverSession(savedGameId, savedPlayerId, savedPlayerName, savedPlayerColor);
        } else {
            debug('💱 Mostrando modal de unión');
            this.showJoinModal();
        }

        debug('✅ PlayerManager inicializado');
    }

    initWordEngine() {
        if (this.wordEngineInitPromise) return this.wordEngineInitPromise;

        this.wordEngineInitPromise = (async () => {
            try {
                if (typeof WordEquivalenceEngine !== 'function') {
                    console.warn('⚠️ WordEquivalenceEngine no está disponible. Verificar inclusión de js/word-comparison.js');
                    this.wordEngineReady = false;
                    return;
                }

                this.wordEngine = new WordEquivalenceEngine();
                await this.wordEngine.init('/js/sinonimos.json');
                this.wordEngineReady = true;
            } catch (e) {
                console.error('❌ Error inicializando word engine (player):', e);
                this.wordEngineReady = false;
            }
        })();

        return this.wordEngineInitPromise;
    }

    getCanonicalForCompare(word) {
        const raw = (word || '').toString().trim();
        if (!raw) return '';

        if (this.wordEngine && this.wordEngineReady && typeof this.wordEngine.getCanonical === 'function') {
            return this.wordEngine.getCanonical(raw);
        }

        // Fallback (sin diccionario): normalización básica
        return raw
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
    }

    cacheElements() {
        this.elements = {
            modalJoinGame: safeGetElement('modal-join-game'),
            gameScreen: safeGetElement('game-screen'),
            modalEditName: safeGetElement('modal-edit-name'),
            inputGameCode: safeGetElement('input-game-code'),
            inputPlayerName: safeGetElement('input-player-name'),
            btnJoin: safeGetElement('btn-join'),
            colorSelector: safeGetElement('color-selector'),
            statusMessage: document.querySelector('#modal-join-game #status-message'),
            headerRound: safeGetElement('header-round'),
            headerTimer: safeGetElement('header-timer'),
            headerCode: safeGetElement('header-code'),
            playerScore: safeGetElement('player-score'),
            statusCard: safeGetElement('status-card'),
            categoryLabel: safeGetElement('category-label'),
            currentWord: safeGetElement('current-word'),
            waitingMessage: safeGetElement('waiting-message'),
            wordsInputSection: safeGetElement('words-input-section'),
            currentWordInput: safeGetElement('current-word-input'),
            btnAddWord: safeGetElement('btn-add-word'),
            wordsListContainer: safeGetElement('words-list-container'),
            wordsList: safeGetElement('words-list'),
            wordCount: safeGetElement('word-count'),
            maxWordsDisplay: safeGetElement('max-words'),
            btnSubmit: safeGetElement('btn-submit'),
            resultsSection: safeGetElement('results-section'),
            countdownOverlay: safeGetElement('countdown-overlay'),
            countdownNumber: safeGetElement('countdown-number'),
            playerNameDisplay: safeGetElement('player-name-display'),
            btnConfigMenu: safeGetElement('btn-config-menu'),
            configDropdown: safeGetElement('config-dropdown'),
            optionEditName: safeGetElement('option-edit-name'),
            optionExit: safeGetElement('option-exit'),
            modalNameInput: safeGetElement('modal-name-input'),
            modalBtnCancel: safeGetElement('modal-btn-cancel'),
            modalBtnSave: safeGetElement('modal-btn-save')
        };
    }

    attachEventListeners() {
        if (this.elements.btnJoin) {
            this.elements.btnJoin.addEventListener('click', () => this.joinGame());
        }

        if (this.elements.inputGameCode) {
            this.elements.inputGameCode.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.elements.inputPlayerName.focus();
            });
        }

        if (this.elements.inputPlayerName) {
            this.elements.inputPlayerName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.joinGame();
            });
        }

        if (this.elements.btnAddWord) {
            this.elements.btnAddWord.addEventListener('click', () => this.addWord());
        }

        if (this.elements.currentWordInput) {
            this.elements.currentWordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addWord();
            });
        }

        if (this.elements.btnSubmit) {
            this.elements.btnSubmit.addEventListener('click', () => this.submitWords());
        }

        // Config menu dropdown
        if (this.elements.btnConfigMenu) {
            this.elements.btnConfigMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleConfigDropdown();
            });
        }

        if (this.elements.optionEditName) {
            this.elements.optionEditName.addEventListener('click', () => {
                this.hideConfigDropdown();
                this.showEditNameModal();
            });
        }

        if (this.elements.optionExit) {
            this.elements.optionExit.addEventListener('click', () => {
                this.hideConfigDropdown();
                this.exitGame();
            });
        }

        // Hamburger menu options (menu open/close handled by menu-opciones.js)
        const hamburgerCustomize = safeGetElement('hamburger-customize');
        const hamburgerAbandon = safeGetElement('hamburger-abandon');

        if (hamburgerCustomize) {
            hamburgerCustomize.addEventListener('click', () => {
                this.showEditNameModal();
            });
        }

        if (hamburgerAbandon) {
            hamburgerAbandon.addEventListener('click', () => {
                this.exitGame();
            });
        }

        if (this.elements.modalBtnCancel) {
            this.elements.modalBtnCancel.addEventListener('click', () => this.hideEditNameModal());
        }

        if (this.elements.modalBtnSave) {
            this.elements.modalBtnSave.addEventListener('click', () => this.saveNewName());
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.footer-left') && !e.target.closest('.btn-config-menu')) {
                this.hideConfigDropdown();
            }
        });
    }

    toggleConfigDropdown() {
        if (!this.elements.configDropdown) return;
        if (this.elements.configDropdown.style.display === 'none') {
            this.showConfigDropdown();
        } else {
            this.hideConfigDropdown();
        }
    }

    showConfigDropdown() {
        if (this.elements.configDropdown) {
            this.elements.configDropdown.style.display = 'block';
        }
    }

    hideConfigDropdown() {
        if (this.elements.configDropdown) {
            this.elements.configDropdown.style.display = 'none';
        }
    }

    showJoinModal() {
        safeShowElement(this.elements.modalJoinGame);
        safeHideElement(this.elements.gameScreen);

        this.availableAuras = generateRandomAuras();

        if (this.elements.colorSelector) {
            const randomAura = this.availableAuras[Math.floor(Math.random() * this.availableAuras.length)];
            renderAuraSelectors(
                this.elements.colorSelector,
                this.availableAuras,
                randomAura.hex,
                (aura) => {
                    this.playerColor = aura.hex;
                    this.selectedAura = aura;
                }
            );
            this.playerColor = randomAura.hex;
            this.selectedAura = randomAura;
        }

        if (this.elements.inputGameCode) {
            setTimeout(() => this.elements.inputGameCode.focus(), 100);
        }
    }

    async recoverSession(gameId, playerId, playerName, playerColor) {
        try {
            this.gameId = gameId;
            this.playerId = playerId;
            this.playerName = playerName;
            this.playerColor = playerColor;

            this.client = new GameClient(gameId, playerId, 'player');
            const result = await this.client.sendAction('get_state');

            if (result.success && result.state) {
                const state = result.state;

                if (state.players && state.players[playerId]) {
                    debug('✅ Sesión recuperada');
                    this.loadGameScreen(state);
                    return;
                }
            }

            debug('⚠️ No se pudo recuperar sesión');
            clearGameSession();
            this.showJoinModal();

        } catch (error) {
            debug('Error recuperando sesión:', error, 'error');
            clearGameSession();
            this.showJoinModal();
        }
    }

    loadGameScreen(state) {
        if (!this.playerColor) {
            this.playerColor = '#FF0055,#00F0FF';
        }

        applyColorGradient(this.playerColor);

        safeHideElement(this.elements.modalJoinGame);
        safeShowElement(this.elements.gameScreen);

        if (this.elements.headerCode) this.elements.headerCode.textContent = this.gameId;
        if (this.elements.playerNameDisplay) this.elements.playerNameDisplay.textContent = this.playerName;

        this.client.onStateUpdate = (s) => this.handleStateUpdate(s);
        this.client.onConnectionLost = () => this.handleConnectionLost();
        this.client.connect();

        this.handleStateUpdate(state);
    }

    async joinGame() {
        const code = this.elements.inputGameCode?.value?.trim().toUpperCase();
        const name = this.elements.inputPlayerName?.value?.trim();

        if (!this.playerColor) {
            if (this.elements.statusMessage) {
                this.elements.statusMessage.innerHTML = '⚠️ Selecciona un aura';
            }
            return;
        }

        if (!isValidGameCode(code)) {
            if (this.elements.statusMessage) {
                this.elements.statusMessage.innerHTML = '⚠️ Código inválido';
            }
            return;
        }

        if (!isValidPlayerName(name)) {
            if (this.elements.statusMessage) {
                this.elements.statusMessage.innerHTML = '⚠️ Nombre inválido (2-20 caracteres)';
            }
            return;
        }

        this.gameId = code;
        this.playerName = name;
        this.playerId = generatePlayerId();

        // FASE 1: usar claves centralizadas
        if (typeof StorageKeys !== 'undefined') {
            setLocalStorage(StorageKeys.GAME_ID, this.gameId);
            setLocalStorage(StorageKeys.PLAYER_ID, this.playerId);
            setLocalStorage(StorageKeys.PLAYER_NAME, this.playerName);
            setLocalStorage(StorageKeys.PLAYER_COLOR, this.playerColor);
        } else {
            setLocalStorage('gameId', this.gameId);
            setLocalStorage('playerId', this.playerId);
            setLocalStorage('playerName', this.playerName);
            setLocalStorage('playerColor', this.playerColor);
        }

        if (this.elements.btnJoin) {
            this.elements.btnJoin.disabled = true;
            this.elements.btnJoin.textContent = 'Conectando...';
        }

        if (this.elements.statusMessage) {
            this.elements.statusMessage.innerHTML = '⏳ Conectando...';
        }

        try {
            this.client = new GameClient(this.gameId, this.playerId, 'player');

            const result = await this.client.sendAction('join_game', {
                name: this.playerName,
                color: this.playerColor
            });

            if (result.success) {
                debug(`✅ Conectado a juego: ${this.gameId}`);
                this.loadGameScreen(result.state || {});
            } else {
                if (this.elements.statusMessage) {
                    this.elements.statusMessage.innerHTML = '❌ ' + (result.message || 'Error');
                }
                if (this.elements.btnJoin) {
                    this.elements.btnJoin.disabled = false;
                    this.elements.btnJoin.textContent = '🎮 ¡Jugar!';
                }
            }
        } catch (error) {
            debug('Error uniéndose:', error, 'error');
            if (this.elements.statusMessage) {
                this.elements.statusMessage.innerHTML = '❌ Error de conexión';
            }
            if (this.elements.btnJoin) {
                this.elements.btnJoin.disabled = false;
                this.elements.btnJoin.textContent = '🎮 ¡Jugar!';
            }
        }
    }

    handleStateUpdate(state) {
        this.gameState = state;
        debug('📈 Estado actualizado:', state.status);

        // CAMBIO #2: Calibración automática de timeSync
        if (state.round_started_at && state.round_duration && !timeSync.isCalibrated) {
            timeSync.calibrate(state.round_started_at, state.round_duration);
            console.log('%c⏱️ SYNC CALIBRADO', 'color: #3B82F6; font-weight: bold', `Offset: ${timeSync.offset}ms`);
        }

        const me = state.players?.[this.playerId];
        if (me && this.elements.playerScore) {
            this.elements.playerScore.textContent = (me.score || 0) + ' pts';
        }

        if (this.elements.headerRound) {
            const round = state.round || 0;
            const total = state.total_rounds || 3;
            this.elements.headerRound.textContent = `Ronda ${round}/${total}`;
        }

        switch (state.status) {
            case 'waiting':
                this.showWaitingState();
                break;
            case 'playing':
                this.showPlayingState(state);
                break;
            case 'round_ended':
                this.showResults(state);
                break;
            case 'finished':
                this.showFinalResults(state);
                break;
        }
    }

    showWaitingState() {
        safeHideElement(this.elements.currentWord);
        safeHideElement(this.elements.categoryLabel);
        safeShowElement(this.elements.waitingMessage);
        if (this.elements.waitingMessage) {
            this.elements.waitingMessage.textContent = 'El anfitrión iniciará la ronda pronto';
        }
        safeHideElement(this.elements.wordsInputSection);
        safeHideElement(this.elements.resultsSection);
        safeHideElement(this.elements.countdownOverlay);
        this.stopTimer();
    }

    // FIX #2: Agregar showCountdown para animación 3,2,1
    async showCountdown(state) {
        debug('⏱️ Iniciando countdown', 'debug');
        
        safeHideElement(this.elements.waitingMessage);
        safeShowElement(this.elements.countdownOverlay);
        
        if (this.elements.currentWordInput) this.elements.currentWordInput.disabled = true;
        if (this.elements.btnAddWord) this.elements.btnAddWord.disabled = true;
        if (this.elements.btnSubmit) this.elements.btnSubmit.disabled = true;

        // Calcular cuándo empezó el countdown
        const countdownDuration = 4000; // 4 segundos desde el servidor
        const elapsedSinceStart = Date.now() - state.round_started_at;
        const countdownRemaining = Math.max(0, countdownDuration - elapsedSinceStart);
        
        // Mostrar números: 3, 2, 1
        for (let i = 3; i >= 1; i--) {
            // Calcular cuándo mostrar este número
            const numberShowTime = countdownDuration - (i * 1000);
            const waitTime = Math.max(0, numberShowTime - elapsedSinceStart);
            
            await new Promise(resolve => {
                setTimeout(() => {
                    if (this.elements.countdownNumber) {
                        this.elements.countdownNumber.textContent = i.toString();
                        this.elements.countdownNumber.style.animation = 'none';
                        // Trigger reflow para reiniciar animación
                        void this.elements.countdownNumber.offsetWidth;
                        this.elements.countdownNumber.style.animation = '';
                    }
                    resolve();
                }, waitTime);
            });
        }
        
        // Esperar a que termine el countdown
        const remainingCountdown = Math.max(0, countdownDuration - (Date.now() - state.round_started_at));
        await new Promise(resolve => setTimeout(resolve, remainingCountdown + 100));
        
        // FIX #2a: Mostrar la consigna DESPUÉS del countdown
        safeHideElement(this.elements.countdownOverlay);
        
        if (this.elements.currentWord) {
            this.elements.currentWord.textContent = state.current_word;
            this.elements.currentWord.classList.remove('hidden');
            safeShowElement(this.elements.currentWord);
            debug(`💡 Palabra mostrada: ${state.current_word}`, 'debug');
        }
        
        if (this.elements.categoryLabel && state.current_category) {
            this.elements.categoryLabel.textContent = `Categoría: ${state.current_category}`;
            safeShowElement(this.elements.categoryLabel);
        } else {
            safeHideElement(this.elements.categoryLabel);
        }
        
        // FIX #2b: Habilitar inputs DESPUÉS del countdown
        const me = state.players?.[this.playerId];
        const isReady = me?.status === 'ready';
        
        if (!isReady) {
            if (this.elements.currentWordInput) this.elements.currentWordInput.disabled = false;
            if (this.elements.btnAddWord) this.elements.btnAddWord.disabled = false;
            if (this.elements.btnSubmit) this.elements.btnSubmit.disabled = false;
            if (this.elements.currentWordInput) this.elements.currentWordInput.focus();
        }
        
        // FIX #2c: Iniciar timer DESPUÉS del countdown
        if (state.round_started_at && state.round_duration) {
            this.startContinuousTimer(state);
        }
    }

    showPlayingState(state) {
        debug('🎮 Estado PLAYING detectado', 'debug');

        safeHideElement(this.elements.resultsSection);
        safeHideElement(this.elements.waitingMessage);

        // FIX: Si .hidden tiene display:none (o !important), safeShowElement no alcanza.
        if (this.elements.currentWord) this.elements.currentWord.classList.remove('hidden');
        if (this.elements.wordsInputSection) this.elements.wordsInputSection.classList.remove('hidden');

        if (!state.current_word) {
            debug('❌ PROBLEMA: No hay current_word en el estado!', 'error');
            if (this.elements.waitingMessage) {
                this.elements.waitingMessage.textContent = '🔄 Cargando palabra...';
                safeShowElement(this.elements.waitingMessage);
            }
            return;
        }

        // FIX #2d: Ejecutar countdown si aún no pasaron los 4 segundos
        if (state.round_started_at) {
            const elapsedSinceStart = Date.now() - state.round_started_at;
            const countdownDuration = 4000; // 4 segundos
            
            if (elapsedSinceStart < countdownDuration) {
                debug(`⏱️ Countdown aún en progreso (${countdownDuration - elapsedSinceStart}ms restantes)`, 'debug');
                this.showCountdown(state);
                return;
            }
        }

        // Si ya pasó el countdown, mostrar palabra inmediatamente
        if (this.elements.currentWord) {
            this.elements.currentWord.textContent = state.current_word;
            safeShowElement(this.elements.currentWord);
            debug(`💡 Palabra mostrada: ${state.current_word}`, 'debug');
        }

        if (this.elements.categoryLabel && state.current_category) {
            this.elements.categoryLabel.textContent = `Categoría: ${state.current_category}`;
            safeShowElement(this.elements.categoryLabel);
        } else {
            safeHideElement(this.elements.categoryLabel);
        }

        const me = state.players?.[this.playerId];
        const isReady = me?.status === 'ready';

        debug(`Verificando si estoy ready: isReady=${isReady}, myStatus=${me?.status}`, 'debug');

        if (isReady) {
            debug('📏 Ya enviaste tus palabras', 'debug');
            if (this.elements.currentWordInput) this.elements.currentWordInput.disabled = true;
            if (this.elements.btnAddWord) this.elements.btnAddWord.disabled = true;
            if (this.elements.btnSubmit) this.elements.btnSubmit.disabled = true;
            if (this.elements.btnSubmit) this.elements.btnSubmit.textContent = '✅ Enviado';

            if (this.elements.waitingMessage) {
                this.elements.waitingMessage.textContent = 'Esperando a los demás jugadores...';
                safeShowElement(this.elements.waitingMessage);
            }
            safeHideElement(this.elements.wordsInputSection);
        } else {
            debug('🗒 Puedes escribir palabras', 'debug');
            if (this.elements.currentWordInput) this.elements.currentWordInput.disabled = false;
            if (this.elements.btnAddWord) this.elements.btnAddWord.disabled = false;
            if (this.elements.btnSubmit) this.elements.btnSubmit.disabled = false;
            if (this.elements.btnSubmit) this.elements.btnSubmit.textContent = '✍️ PASO';

            safeHideElement(this.elements.waitingMessage);
            safeShowElement(this.elements.wordsInputSection);

            if (!me?.answers || me.answers.length === 0) {
                this.myWords = [];
                this.updateWordsList();
            } else {
                this.myWords = me.answers || [];
                this.updateWordsList();
            }
        }

        if (state.round_started_at && state.round_duration) {
            this.startContinuousTimer(state);
        }
    }

    async addWord() {
        const input = this.elements.currentWordInput;
        if (!input) return;

        const word = input.value.trim();
        if (!word) return;

        if (word.length > COMM_CONFIG.MAX_WORD_LENGTH) {
            showNotification(`Palabra demasiado larga (máx ${COMM_CONFIG.MAX_WORD_LENGTH})`, 'warning');
            return;
        }

        if (this.myWords.length >= this.maxWords) {
            showNotification(`Máximo ${this.maxWords} palabras`, 'warning');
            return;
        }

        // Asegurar motor listo (si existe)
        await this.initWordEngine();

        const normalized = word.toUpperCase();
        if (this.myWords.includes(normalized)) {
            showNotification('Ya agregaste esa palabra', 'warning');
            return;
        }

        // Bloquear equivalentes (sinónimos/raíces) contra MI lista
        const newCanonical = this.getCanonicalForCompare(word);
        if (newCanonical) {
            for (let i = 0; i < this.myWords.length; i++) {
                const existing = this.myWords[i];
                const existingCanonical = this.getCanonicalForCompare(existing);
                if (existingCanonical && existingCanonical === newCanonical) {
                    showNotification('¡Intenta con otra! Ya escribiste una equivalente', 'warning');
                    return;
                }
            }
        }

        this.myWords.push(normalized);
        input.value = '';
        this.updateWordsList();
        this.scheduleWordsUpdate();
        input.focus();
    }

    updateWordsList() {
        if (this.elements.wordCount) {
            this.elements.wordCount.textContent = this.myWords.length;
        }

        if (this.myWords.length > 0) {
            if (this.elements.wordsListContainer) this.elements.wordsListContainer.classList.remove('hidden');
            safeShowElement(this.elements.wordsListContainer);

            if (this.elements.wordsList) {
                this.elements.wordsList.innerHTML = this.myWords.map((word, idx) => `
                    <div class="word-item" onclick="playerManager.removeWord(${idx})">
                        <span class="word-text">${sanitizeText(word)}</span>
                        <span class="word-delete">🗑️</span>
                    </div>
                `).join('');
            }
        } else {
            safeHideElement(this.elements.wordsListContainer);
        }
    }

    removeWord(index) {
        this.myWords.splice(index, 1);
        this.updateWordsList();
        this.scheduleWordsUpdate();
    }

    scheduleWordsUpdate() {
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastWordsUpdateTime;

        if (timeSinceLastUpdate >= COMM_CONFIG.WORDS_UPDATE_THROTTLE) {
            this.sendWordsUpdate();
        } else {
            if (!this.wordsUpdatePending) {
                this.wordsUpdatePending = true;
                const delay = COMM_CONFIG.WORDS_UPDATE_THROTTLE - timeSinceLastUpdate;

                setTimeout(() => {
                    this.sendWordsUpdate();
                }, delay);
            }
        }
    }

    async sendWordsUpdate() {
        if (!this.client) return;

        this.lastWordsUpdateTime = Date.now();
        this.wordsUpdatePending = false;

        try {
            await this.client.sendAction('submit_answers', {
                answers: this.myWords,
                forced_pass: false
            });
        } catch (error) {
            debug('Error enviando palabras:', error, 'error');
        }
    }

    async submitWords() {
        if (!this.client || !this.elements.btnSubmit) return;

        this.elements.btnSubmit.disabled = true;
        this.elements.btnSubmit.textContent = 'Enviando...';

        try {
            const result = await this.client.sendAction('submit_answers', {
                answers: this.myWords,
                forced_pass: true
            });

            if (result.success) {
                if (this.elements.currentWordInput) this.elements.currentWordInput.disabled = true;
                if (this.elements.btnAddWord) this.elements.btnAddWord.disabled = true;
                this.elements.btnSubmit.textContent = '✅ Enviado';

                if (this.elements.waitingMessage) {
                    this.elements.waitingMessage.textContent = 'Esperando a los demás jugadores...';
                    safeShowElement(this.elements.waitingMessage);
                }
                safeHideElement(this.elements.wordsInputSection);
            } else {
                showNotification('Error al enviar', 'error');
                this.elements.btnSubmit.disabled = false;
                this.elements.btnSubmit.textContent = '✍️ PASO';
            }
        } catch (error) {
            debug('Error:', error, 'error');
            showNotification('Error de conexión', 'error');
            this.elements.btnSubmit.disabled = false;
            this.elements.btnSubmit.textContent = '✍️ PASO';
        }
    }

    showResults(state) {
        safeHideElement(this.elements.wordsInputSection);
        safeHideElement(this.elements.currentWord);
        safeHideElement(this.elements.categoryLabel);
        safeHideElement(this.elements.waitingMessage);
        this.stopTimer();

        const me = state.players?.[this.playerId];
        const myResults = me?.round_results;

        if (!myResults || Object.keys(myResults).length === 0) {
            if (this.elements.resultsSection) {
                this.elements.resultsSection.innerHTML = '<div class="waiting-message">No enviaste palabras esta ronda</div>';
            }
        } else {
            let html = '<div class="results-title">📈 Tus Resultados</div>';
            let roundScore = 0;

            Object.entries(myResults).forEach(([word, result]) => {
                const hasMatch = result.count > 1;
                const icon = hasMatch ? '✅' : '❌';
                html += `
                    <div class="result-item ${hasMatch ? 'match' : 'no-match'}">
                        <div class="result-word">${icon} ${sanitizeText(word)}</div>
                        <div class="result-points">+${result.points} puntos</div>
                        ${hasMatch ? `<div class="result-players">Coincidió con: ${(result.matched_with || []).join(', ')}</div>` : ''}
                    </div>
                `;
                roundScore += result.points;
            });

            html += `<div class="total-score">Total ronda: ${roundScore} pts</div>`;

            if (this.elements.resultsSection) {
                this.elements.resultsSection.innerHTML = html;
            }
        }

        safeShowElement(this.elements.resultsSection);
    }

    showFinalResults(state) {
        this.showResults(state);
        if (this.elements.waitingMessage) {
            this.elements.waitingMessage.textContent = '🎉 ¡Juego terminado!';
            safeShowElement(this.elements.waitingMessage);
        }
    }

    startContinuousTimer(state) {
        this.stopTimer();
        this.updateTimerFromState(state);

        this.timerInterval = setInterval(() => {
            if (this.gameState && this.gameState.status === 'playing') {
                this.updateTimerFromState(this.gameState);
            } else {
                this.stopTimer();
            }
        }, 1000);
    }

    updateTimerFromState(state) {
        const remaining = getRemainingTime(state.round_started_at, state.round_duration);
        updateTimerDisplay(remaining, this.elements.headerTimer, '⏳');

        if (remaining <= 0 && this.gameState.status === 'playing') {
            this.autoSubmitWords();
        }
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    async autoSubmitWords() {
        const me = this.gameState.players?.[this.playerId];
        if (me?.status !== 'ready') {
            debug('🔅 Auto-enviando palabras al terminar el tiempo', 'info');
            await this.submitWords();
        }
    }

    showEditNameModal() {
        if (this.elements.modalNameInput) {
            this.elements.modalNameInput.value = this.playerName;
        }
        safeShowElement(this.elements.modalEditName, 'flex');
        if (this.elements.modalNameInput) {
            this.elements.modalNameInput.focus();
        }
    }

    hideEditNameModal() {
        safeHideElement(this.elements.modalEditName);
    }

    async saveNewName() {
        const newName = this.elements.modalNameInput?.value?.trim();

        if (!isValidPlayerName(newName)) {
            showNotification('Nombre inválido (2-20 caracteres)', 'warning');
            return;
        }

        this.playerName = newName;
        if (this.elements.playerNameDisplay) {
            this.elements.playerNameDisplay.textContent = newName;
        }

        // FASE 1: usar claves centralizadas
        if (typeof StorageKeys !== 'undefined') {
            setLocalStorage(StorageKeys.PLAYER_NAME, newName);
        } else {
            setLocalStorage('playerName', newName);
        }

        if (this.client) {
            try {
                await this.client.sendAction('update_player_name', { name: newName });
            } catch (error) {
                debug('Error actualizando nombre:', error, 'error');
            }
        }

        this.hideEditNameModal();
    }

    handleConnectionLost() {
        alert('Desconectado del servidor');
        this.exitGame();
    }

    exitGame() {
        if (this.client) {
            this.client.disconnect();
        }
        clearGameSession();
        location.reload();
    }
}

let playerManager = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!playerManager) {
        playerManager = new PlayerManager();
        playerManager.initialize();
    }
}, { once: true });

console.log('%c✅ player-manager.js - Countdown 3,2,1 implementado', 'color: #FF00FF; font-weight: bold; font-size: 12px');