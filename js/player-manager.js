/**
 * Player Manager - Gestión de jugador en partida
 * Maneja: unión, palabras, timer, resultados
 * 
 * 🔧 REFACTORIZADO FASE 2:
 * - Elimina método showFatalError() duplicado
 * - Usa UI.showFatalError() centralizado de shared-utils.js
 * - Usa wordEngine desacoplado
 * - Manejo de errores fuerte en config/dict
 * - Rechaza Promises si hay error (no fallbacks)
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
        this.isReady = false;
        this.timerInterval = null;
        this.countdownTimeout = null;
        this.countdownRAFId = null;

        this.lastWordsUpdateTime = 0;
        this.wordsUpdatePending = false;

        this.availableAuras = [];
        this.selectedAura = null;
        this.tempSelectedAura = null;

        this.elements = {};

        this.joinModal = null;
        this.editNameModal = null;
    }

    async initialize() {
        debug('📃 Inicializando PlayerManager');
        
        try {
            await configService.load();
            this.maxWords = configService.get('max_words_per_player', 6);
            
            this.cacheElements();
            
            this.initializeModals();
            
            this.attachEventListeners();

            await this.initWordEngine();

            const sessionData = playerSession.recover();
            if (sessionData) {
                debug('🔄 Recuperando sesión', 'info');
                this.recoverSession(sessionData.gameId, sessionData.playerId, sessionData.playerName, sessionData.playerColor);
            } else {
                debug('💡 Mostrando modal de unión', 'info');
                this.showJoinModal();
            }

            playerSession.registerManager(this);

            debug('✅ PlayerManager inicializado');
        } catch (error) {
            debug('❌ Error inicializando PlayerManager: ' + error.message, null, 'error');
            UI.showFatalError('Error de inicialización. Por favor recarga la página.');
            throw error;
        }
    }

    initializeModals() {
        this.joinModal = new ModalController('modal-join-game', {
            closeOnBackdrop: true,
            closeOnEsc: true,
            onBeforeOpen: () => {
                safeHideElement(this.elements.gameScreen);
            },
            onAfterOpen: () => {
                setTimeout(() => {
                    if (this.elements.inputGameCode) {
                        this.elements.inputGameCode.focus();
                    }
                }, 100);
            }
        });

        this.editNameModal = new ModalController('modal-edit-name', {
            closeOnBackdrop: true,
            closeOnEsc: true,
            onAfterOpen: () => {
                if (this.elements.modalNameInput) {
                    this.elements.modalNameInput.focus();
                }
            }
        });
    }

    async initWordEngine() {
        try {
            await dictionaryService.initialize();
            debug('📜 Word engine inicializado en player', null, 'success');
        } catch (error) {
            debug('❌ Error inicializando word engine: ' + error.message, null, 'error');
        }
    }

    getCanonicalForCompare(word) {
        return wordEngine.getCanonical(word);
    }

    cacheElements() {
        this.elements = {
            gameScreen: safeGetElement('game-screen'),
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
            modalNameInput: safeGetElement('modal-name-input'),
            modalBtnCancel: safeGetElement('modal-btn-cancel'),
            modalBtnSave: safeGetElement('modal-btn-save'),
            auraSelectorEdit: safeGetElement('aura-selector-edit')
        };

        if (this.elements.maxWordsDisplay) {
            this.elements.maxWordsDisplay.textContent = this.maxWords;
        }
        
        if (this.elements.headerTimer) {
            updateTimerDisplay(null, this.elements.headerTimer, '⏳');
        }
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
            this.elements.btnSubmit.addEventListener('click', () => this.handleFinishButton());
        }

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
    }

    showJoinModal() {
        this.joinModal.open();

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
            playerSession.clear();
            this.showJoinModal();

        } catch (error) {
            debug('Error recuperando sesión:', error, 'error');
            playerSession.clear();
            this.showJoinModal();
        }
    }

    loadGameScreen(state) {
        if (!this.playerColor) {
            this.playerColor = '#FF0055,#00F0FF';
        }

        applyColorGradient(this.playerColor);

        this.joinModal.close();
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

        playerSession.savePlayerSession(this.gameId, this.playerId, this.playerName, this.playerColor);

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

        if (state.server_now && state.round_starts_at && !timeSync.isCalibrated) {
            timeSync.calibrateWithServerTime(
                state.server_now,
                state.round_starts_at,
                state.round_ends_at,
                state.round_duration
            );
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
        if (this.elements.headerTimer) {
            updateTimerDisplay(null, this.elements.headerTimer, '⏳');
        }
    }

    runPreciseCountdown(roundStartsAt, countdownDuration, onComplete) {
        if (this.countdownRAFId) {
            cancelAnimationFrame(this.countdownRAFId);
        }

        safeShowElement(this.elements.countdownOverlay);
        if (this.elements.currentWordInput) this.elements.currentWordInput.disabled = true;
        if (this.elements.btnAddWord) this.elements.btnAddWord.disabled = true;
        if (this.elements.btnSubmit) this.elements.btnSubmit.disabled = true;

        if (this.elements.countdownNumber) {
            this.elements.countdownNumber.style.fontSize = 'inherit';
        }

        const update = () => {
            const nowServer = timeSync.getServerTime();
            const elapsed = nowServer - roundStartsAt;
            const remaining = Math.max(0, countdownDuration - elapsed);
            const seconds = Math.ceil(remaining / 1000);

            if (this.elements.countdownNumber) {
                if (seconds > 3) {
                    this.elements.countdownNumber.classList.add('timer-hury');
                    this.elements.countdownNumber.textContent = '¿Preparado?';
                    this.elements.countdownNumber.style.fontSize = '1.2em';
                } else if (seconds > 0) {
                    const displayValue = Math.max(1, seconds);
                    this.elements.countdownNumber.textContent = displayValue.toString();
                    this.elements.countdownNumber.style.fontSize = 'inherit';
                } else {
                    this.elements.countdownNumber.classList.remove('timer-hury');
                    this.elements.countdownNumber.textContent = '';
                }
            }

            if (remaining > 0) {
                this.countdownRAFId = requestAnimationFrame(update);
            } else {
                safeHideElement(this.elements.countdownOverlay);
                if (this.elements.currentWordInput) this.elements.currentWordInput.disabled = false;
                if (this.elements.btnAddWord) this.elements.btnAddWord.disabled = false;
                if (this.elements.btnSubmit) this.elements.btnSubmit.disabled = false;
                if (this.elements.currentWordInput) this.elements.currentWordInput.focus();
                
                if (typeof onComplete === 'function') {
                    onComplete();
                }
            }
        };
        this.countdownRAFId = requestAnimationFrame(update);
    }

    async showCountdown(state) {
        debug('⏱️ Iniciando countdown', 'debug');
        const countdownDuration = state.countdown_duration || 4000;
        safeHideElement(this.elements.waitingMessage);
        
        return new Promise((resolve) => {
            this.runPreciseCountdown(state.round_starts_at, countdownDuration, resolve);
        });
    }

    async showPlayingState(state) {
        debug('🎮 Estado PLAYING detectado', 'debug');

        safeHideElement(this.elements.resultsSection);
        safeHideElement(this.elements.waitingMessage);

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

        if (state.round_starts_at) {
            const nowServer = timeSync.isCalibrated ? timeSync.getServerTime() : Date.now();
            const countdownDuration = state.countdown_duration || 4000;
            const elapsedSinceStart = nowServer - state.round_starts_at;
            
            if (elapsedSinceStart < countdownDuration) {
                debug(`⏱️ Countdown aún en progreso (${countdownDuration - elapsedSinceStart}ms restantes)`, 'debug');
                await this.showCountdown(state);
            }
        }

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
            debug('📆 Ya confirmaste que terminaste', 'debug');
            this.isReady = true;
            if (this.elements.currentWordInput) {
                this.elements.currentWordInput.disabled = true;
                this.elements.currentWordInput.placeholder = '✅ Terminaste';
            }
            if (this.elements.btnAddWord) this.elements.btnAddWord.disabled = false;
            if (this.elements.btnSubmit) {
                this.elements.btnSubmit.disabled = false;
                this.elements.btnSubmit.textContent = 'ἷ4d LISTO';
            }

            if (this.elements.waitingMessage) {
                this.elements.waitingMessage.textContent = 'Esperando a los demás jugadores...';
                safeShowElement(this.elements.waitingMessage);
            }
            
            if (this.elements.wordsListContainer) {
                this.elements.wordsListContainer.classList.add('read-only');
            }
        } else {
            debug('💗 Puedes escribir y editar palabras', 'debug');
            this.isReady = false;
            if (this.elements.currentWordInput) {
                const isAtMax = this.myWords.length >= this.maxWords;
                this.elements.currentWordInput.disabled = isAtMax;
                this.elements.currentWordInput.placeholder = isAtMax ? `Máximo ${this.maxWords} palabras` : 'Ingresa una palabra...';
            }
            if (this.elements.btnAddWord) this.elements.btnAddWord.disabled = false;
            if (this.elements.btnSubmit) {
                this.elements.btnSubmit.disabled = false;
                this.updateFinishButtonText();
            }

            safeHideElement(this.elements.waitingMessage);
            safeShowElement(this.elements.wordsInputSection);
            
            if (this.elements.wordsListContainer) {
                this.elements.wordsListContainer.classList.remove('read-only');
            }

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

        if (this.myWords.length >= this.maxWords) {
            showNotification(`📆 Alcanzaste el máximo de ${this.maxWords} palabras. Edita o termina.`, 'warning');
            return;
        }

        if (word.length > COMM_CONFIG.MAX_WORD_LENGTH) {
            showNotification(`Palabra demasiado larga (máximo ${COMM_CONFIG.MAX_WORD_LENGTH})`, 'warning');
            return;
        }

        const normalized = word.toUpperCase();
        if (this.myWords.includes(normalized)) {
            showNotification('Ya agregaste esa palabra', 'warning');
            return;
        }

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

        if (this.myWords.length === this.maxWords) {
            debug(`📆 Máximo de palabras alcanzado (${this.maxWords})`, 'info');
            this.updateInputAndButtons();
        }
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
                        <span class="word-delete">✍️</span>
                    </div>
                `).join('');
            }
        } else {
            safeHideElement(this.elements.wordsListContainer);
        }
    }

    removeWord(index) {
        const removed = this.myWords.splice(index, 1)[0] || '';
        
        this.updateWordsList();
        this.scheduleWordsUpdate();

        if (this.elements.currentWordInput) {
            this.elements.currentWordInput.value = removed;
        }

        if (this.elements.currentWordInput) {
            this.elements.currentWordInput.disabled = false;
            this.elements.currentWordInput.placeholder = 'Edita o agrega otra palabra...';
            if (!this.isReady) {
                this.elements.currentWordInput.focus();
            }
        }

        this.updateInputAndButtons();

        if (this.isReady && this.myWords.length < this.maxWords) {
            debug('🔼 Revertiendo a estado editable (palabras removidas)', 'debug');
            this.markNotReady();
        }
    }

    updateInputAndButtons() {
        if (!this.isReady) {
            const isAtMax = this.myWords.length >= this.maxWords;
            
            if (this.elements.currentWordInput) {
                this.elements.currentWordInput.disabled = isAtMax;
                if (isAtMax) {
                    this.elements.currentWordInput.placeholder = `Máximo ${this.maxWords} palabras`;
                } else {
                    this.elements.currentWordInput.placeholder = 'Ingresa una palabra...';
                }
            }
            
            this.updateFinishButtonText();
        }
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

    async handleFinishButton() {
        if (this.isReady) {
            await this.markNotReady();
        } else {
            await this.markReady();
        }
    }

    updateFinishButtonText() {
        if (!this.elements.btnSubmit) return;
        
        if (this.myWords.length === this.maxWords) {
            this.elements.btnSubmit.textContent = '✍️ ENVIAR';
        } else {
            this.elements.btnSubmit.textContent = '✍️ PASO';
        }
    }

    async markReady() {
        if (!this.client) return;

        debug('👍 Marcando como READY (confirmó terminar)', 'info');
        this.isReady = true;

        if (this.elements.currentWordInput) {
            this.elements.currentWordInput.disabled = true;
            this.elements.currentWordInput.placeholder = '✅ Terminaste';
        }
        if (this.elements.btnAddWord) this.elements.btnAddWord.disabled = false;
        if (this.elements.btnSubmit) {
            this.elements.btnSubmit.disabled = false;
            this.elements.btnSubmit.textContent = '👍 LISTO';
        }

        try {
            await this.client.sendAction('submit_answers', {
                answers: this.myWords,
                forced_pass: true
            });
        } catch (error) {
            debug('Error marcando como ready:', error, 'error');
        }
    }

    async markNotReady() {
        if (!this.client) return;

        debug('🔼 Revertiendo a NO READY', 'info');
        this.isReady = false;

        if (this.elements.currentWordInput) {
            const isAtMax = this.myWords.length >= this.maxWords;
            this.elements.currentWordInput.disabled = isAtMax;
            this.elements.currentWordInput.placeholder = isAtMax ? `Máximo ${this.maxWords} palabras` : 'Ingresa una palabra...';
        }
        if (this.elements.btnAddWord) this.elements.btnAddWord.disabled = false;
        if (this.elements.btnSubmit) {
            this.elements.btnSubmit.disabled = false;
            this.updateFinishButtonText();
        }

        try {
            await this.client.sendAction('submit_answers', {
                answers: this.myWords,
                forced_pass: false
            });
        } catch (error) {
            debug('Error revertiendo ready:', error, 'error');
        }
    }

    showResults(state) {
        safeHideElement(this.elements.wordsInputSection);
        safeHideElement(this.elements.currentWord);
        safeHideElement(this.elements.categoryLabel);
        safeHideElement(this.elements.waitingMessage);
        this.stopTimer();
        if (this.elements.headerTimer) {
            updateTimerDisplay(null, this.elements.headerTimer, '⏳');
        }

        const me = state.players?.[this.playerId];
        const myResults = me?.round_results;

        if (!myResults || Object.keys(myResults).length === 0) {
            const myAnswers = me?.answers;
            const sentAnswers = myAnswers && Array.isArray(myAnswers) && myAnswers.length > 0;
            
            if (!sentAnswers) {
                if (this.elements.resultsSection) {
                    this.elements.resultsSection.innerHTML = '<div class="waiting-message">❌ No enviaste palabras esta ronda</div>';
                }
                debug('⚠️ No envíné palabras esta ronda', 'warning');
            } else {
                if (this.elements.resultsSection) {
                    this.elements.resultsSection.innerHTML = '<div class="waiting-message">⏳ Esperando resultados...</div>';
                }
                debug('⏳ Esperando procesamiento de resultados', 'info');
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

        if (remaining <= 500 && this.gameState.status === 'playing') {
            const me = this.gameState.players?.[this.playerId];
            if (me?.status !== 'ready') {
                debug('🔵 Auto-enviando palabras al terminar el tiempo', 'info');
                this.autoSubmitWords();
            }
        }
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

    destroy() {
        debug('🗗️ Destroying PlayerManager...', 'info');
        
        this.stopTimer();
        
        if (this.client) {
            this.client.disconnect();
            this.client = null;
        }
        
        if (this.joinModal) {
            this.joinModal.destroy();
        }
        if (this.editNameModal) {
            this.editNameModal.destroy();
        }
        
        this.myWords = [];
        this.gameState = null;
        this.elements = {};
    }

    async autoSubmitWords() {
        if (!this.client) return;
        try {
            await this.client.sendAction('submit_answers', {
                answers: this.myWords,
                forced_pass: true
            });
        } catch (error) {
            debug('Error en auto-submit:', error, 'error');
        }
    }

    showEditNameModal() {
        if (this.elements.modalNameInput) {
            this.elements.modalNameInput.value = this.playerName;
        }
        
        this.tempSelectedAura = this.playerColor;
        
        if (this.elements.auraSelectorEdit) {
            renderAuraSelectorsEdit(
                this.elements.auraSelectorEdit,
                this.playerColor,
                (aura) => {
                    this.tempSelectedAura = aura.hex;
                }
            );
        }
        
        this.editNameModal.open();
    }

    hideEditNameModal() {
        this.editNameModal.close();
        this.tempSelectedAura = null;
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

        if (this.tempSelectedAura && this.tempSelectedAura !== this.playerColor) {
            this.playerColor = this.tempSelectedAura;
            applyColorGradient(this.playerColor);
            savePlayerColor(this.playerColor);
        }

        playerSession.savePlayerSession(this.gameId, this.playerId, newName, this.playerColor);

        if (this.client) {
            try {
                await this.client.sendAction('update_player_name', { name: newName });
                if (this.tempSelectedAura) {
                    await this.client.sendAction('update_player_color', { color: this.tempSelectedAura });
                }
            } catch (error) {
                debug('Error actualizando nombre/color:', error, 'error');
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
        playerSession.clear();
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

console.log('%c✅ player-manager.js - FASE 2: UI.showFatalError centralizado', 'color: #FF00FF; font-weight: bold; font-size: 12px');
