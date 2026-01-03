class PlayerManager extends BaseController {
    constructor() {
        super();
        this.gameId = null;
        this.playerId = null;
        this.playerName = null;
        this.playerColor = null;
        this.gameState = null;
        this.myWords = [];
        this.maxWords = 6;
        this.isReady = false;

        this.lastWordsUpdateTime = 0;
        this.wordsUpdatePending = false;

        this.availableAuras = [];
        this.selectedAura = null;
        this.tempSelectedAura = null;
    }

    getStorageKeys() {
        return {
            primary: StorageKeys.PLAYER_ID,
            gameCode: StorageKeys.PLAYER_GAME_CODE,
            name: StorageKeys.PLAYER_NAME,
            color: StorageKeys.PLAYER_COLOR
        };
    }

    recoverSession() {
        const keys = this.getStorageKeys();
        const gameId = StorageManager.get(keys.gameCode);
        const playerId = StorageManager.get(keys.primary);
        const playerName = StorageManager.get(keys.name);
        const playerColor = StorageManager.get(keys.color);
        
        return (gameId && playerId && playerName) 
            ? { gameId, playerId, playerName, playerColor } 
            : null;
    }

    saveSession(gameId, playerId, playerName, playerColor) {
        const keys = this.getStorageKeys();
        StorageManager.set(keys.gameCode, gameId);
        StorageManager.set(keys.primary, playerId);
        StorageManager.set(keys.name, playerName);
        if (playerColor) {
            StorageManager.set(keys.color, playerColor);
        }
    }

    async initialize() {
        debug('📃 Inicializando PlayerManager');
        
        try {
            await configService.load();
            this.maxWords = configService.get('max_words_per_player', 6);
            
            this.cacheElements();
            this.attachEventListeners();

            const sessionData = this.recoverSession();
            if (sessionData) {
                debug('🔄 Recuperando sesión', 'info');
                this.recoverGameSession(sessionData.gameId, sessionData.playerId, sessionData.playerName, sessionData.playerColor);
            } else {
                debug('💡 Mostrando modal de unión', 'info');
                this.showJoinModal();
            }

            debug('✅ PlayerManager inicializado');
        } catch (error) {
            debug('❌ Error inicializando PlayerManager: ' + error.message, null, 'error');
            UI.showFatalError('Error de inicialización. Por favor recarga la página.');
            throw error;
        }
    }

    getCanonicalForCompare(word) {
        return wordEngine.getCanonical(word);
    }

    cacheElements() {
        this.elements = {
            gameScreen: safeGetElement('game-screen'),
            headerRound: safeGetElement('header-round'),
            headerTimer: safeGetElement('header-timer'),
            headerCode: safeGetElement('header-code'),
            playerScore: safeGetElement('player-score'),
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
            playerNameDisplay: safeGetElement('player-name-display')
        };

        if (this.elements.maxWordsDisplay) {
            this.elements.maxWordsDisplay.textContent = this.maxWords;
        }
        
        if (this.elements.headerTimer) {
            GameTimer.updateDisplay(null, this.elements.headerTimer, '⏳');
        }
    }

    attachEventListeners() {
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
    }

    buildJoinContent() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="input-group">
                <label class="input-label" for="modal-join-code">Código de Sala</label>
                <input type="text" id="modal-join-code" class="input-field" 
                       placeholder="Ej: CASA" maxlength="6" autocomplete="off">
            </div>
            <div class="input-group">
                <label class="input-label" for="modal-join-name">Tu Nombre</label>
                <input type="text" id="modal-join-name" class="input-field" 
                       placeholder="" maxlength="20" autocomplete="on">
            </div>
            <div class="input-group">
                <label class="input-label">✨ Elige tu Aura</label>
                <div class="aura-selector" id="modal-aura-selector"></div>
            </div>
        `;

        const codeInput = container.querySelector('#modal-join-code');
        const nameInput = container.querySelector('#modal-join-name');
        const auraSelector = container.querySelector('#modal-aura-selector');

        this.availableAuras = generateRandomAuras();
        const randomAura = this.availableAuras[Math.floor(Math.random() * this.availableAuras.length)];

        renderAuraSelectors(
            auraSelector,
            this.availableAuras,
            randomAura.hex,
            (aura) => {
                this.playerColor = aura.hex;
                this.selectedAura = aura;
            }
        );
        this.playerColor = randomAura.hex;
        this.selectedAura = randomAura;

        codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') nameInput.focus();
        });

        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame(codeInput.value, nameInput.value);
        });

        return container;
    }

    buildEditNameContent() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="input-group">
                <label class="input-label" for="modal-edit-name">Nuevo Nombre</label>
                <input type="text" id="modal-edit-name" class="input-field" maxlength="20" autocomplete="off">
            </div>
            <div class="input-group" style="margin-top: 15px;">
                <label class="input-label">✨ Tu Aura</label>
                <div class="aura-selector" id="modal-edit-aura"></div>
            </div>
        `;

        const nameInput = container.querySelector('#modal-edit-name');
        const auraSelector = container.querySelector('#modal-edit-aura');

        nameInput.value = this.playerName;
        this.tempSelectedAura = this.playerColor;

        renderAuraSelectorsEdit(
            auraSelector,
            this.playerColor,
            (aura) => {
                this.tempSelectedAura = aura.hex;
            }
        );

        return container;
    }

    showJoinModal() {
        const content = this.buildJoinContent();

        ModalManager_Instance.show({
            type: 'primary',
            title: 'Unirse a una Partida',
            content: content,
            buttons: [
                { label: '¡A Jugar!', class: 'btn-modal-primary', action: () => {
                    const codeInput = document.querySelector('#modal-join-code');
                    const nameInput = document.querySelector('#modal-join-name');
                    this.joinGame(codeInput.value, nameInput.value);
                }, close: false }
            ]
        });
    }

    async recoverGameSession(gameId, playerId, playerName, playerColor) {
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
            this.clearSession();
            this.showJoinModal();

        } catch (error) {
            debug('Error recuperando sesión:', error, 'error');
            this.clearSession();
            this.showJoinModal();
        }
    }

    loadGameScreen(state) {
        if (!this.playerColor) {
            this.playerColor = '#FF0055,#00F0FF';
        }

        applyColorGradient(this.playerColor);

        ModalManager_Instance.close();
        safeShowElement(this.elements.gameScreen);

        if (this.elements.headerCode) this.elements.headerCode.textContent = this.gameId;
        if (this.elements.playerNameDisplay) this.elements.playerNameDisplay.textContent = this.playerName;

        this.client.onStateUpdate = (s) => this.handleStateUpdate(s);
        this.client.onConnectionLost = () => this.handleConnectionLost();
        this.client.connect();

        this.handleStateUpdate(state);
    }

    async joinGame(code, name) {
        const gameCode = (code || '').trim().toUpperCase();
        const playerName = (name || '').trim();

        if (!this.playerColor) {
            showNotification('⚠️ Selecciona un aura', 'warning');
            return;
        }

        if (!isValidGameCode(gameCode)) {
            showNotification('⚠️ Código inválido', 'warning');
            return;
        }

        if (!isValidPlayerName(playerName)) {
            showNotification('⚠️ Nombre inválido (2-20 caracteres)', 'warning');
            return;
        }

        this.gameId = gameCode;
        this.playerName = playerName;
        this.playerId = generatePlayerId();

        this.saveSession(this.gameId, this.playerId, this.playerName, this.playerColor);

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
                showNotification('❌ ' + (result.message || 'Error'), 'error');
            }
        } catch (error) {
            debug('Error uniéndose:', error, 'error');
            showNotification('❌ Error de conexión', 'error');
        }
    }

    handleStateUpdate(state) {
        this.gameState = state;
        debug('📈 Estado actualizado:', state.status);

        this.calibrateTimeSync(state);

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
        GameTimer.updateDisplay(null, this.elements.headerTimer, '⏳');
        wordEngine.reset();
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

        if (state.roundData && state.roundData.validMatches) {
            initializeWordEngineFromRound(state.roundData);
            debug('📚 Mini-diccionario cargado desde roundData', 'info');
        } else {
            debug('⚠️ No hay roundData.validMatches en estado', 'warning');
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
                this.elements.btnSubmit.textContent = '👍 LISTO';
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
            this.elements.btnSubmit.textContent = '✍️ ENVÍAR';
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
        GameTimer.updateDisplay(null, this.elements.headerTimer, '⏳');

        const me = state.players?.[this.playerId];
        const myResults = me?.round_results;

        if (!myResults || Object.keys(myResults).length === 0) {
            const myAnswers = me?.answers;
            const sentAnswers = myAnswers && Array.isArray(myAnswers) && myAnswers.length > 0;
            
            if (!sentAnswers) {
                if (this.elements.resultsSection) {
                    this.elements.resultsSection.innerHTML = '<div class="waiting-message">❌ No enviaste palabras esta ronda</div>';
                }
                debug('⚠️ No envén palabras esta ronda', 'warning');
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

    updateTimerFromState(state) {
        if (!state.round_started_at) {
            this.stopTimer();
            return;
        }

        const remaining = GameTimer.getRemaining(state.round_started_at, state.round_duration);
        GameTimer.updateDisplay(remaining, this.elements.headerTimer, '⏳');

        if (remaining <= 500 && this.gameState.status === 'playing') {
            const me = this.gameState.players?.[this.playerId];
            if (me?.status !== 'ready') {
                debug('🔵 Auto-enviando palabras al terminar el tiempo', 'info');
                this.autoSubmitWords();
            }
        }
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
        const content = this.buildEditNameContent();

        ModalManager_Instance.show({
            type: 'secondary',
            title: 'Cambiar Nombre',
            content: content,
            buttons: [
                { label: 'Cancelar', class: 'btn', action: null, close: true },
                { label: 'Guardar', class: 'btn-modal-primary', action: () => {
                    const nameInput = document.querySelector('#modal-edit-name');
                    this.saveNewName(nameInput.value);
                }, close: false }
            ]
        });
    }

    async saveNewName(newName) {
        const trimmedName = (newName || '').trim();

        if (!isValidPlayerName(trimmedName)) {
            showNotification('Nombre inválido (2-20 caracteres)', 'warning');
            return;
        }

        this.playerName = trimmedName;
        if (this.elements.playerNameDisplay) {
            this.elements.playerNameDisplay.textContent = trimmedName;
        }

        if (this.tempSelectedAura && this.tempSelectedAura !== this.playerColor) {
            this.playerColor = this.tempSelectedAura;
            applyColorGradient(this.playerColor);
            savePlayerColor(this.playerColor);
        }

        this.saveSession(this.gameId, this.playerId, trimmedName, this.playerColor);

        if (this.client) {
            try {
                await this.client.sendAction('update_player_name', { name: trimmedName });
                if (this.tempSelectedAura) {
                    await this.client.sendAction('update_player_color', { color: this.tempSelectedAura });
                }
            } catch (error) {
                debug('Error actualizando nombre/color:', error, 'error');
            }
        }

        ModalManager_Instance.close();
    }
}

let playerManager = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!playerManager) {
        playerManager = new PlayerManager();
        playerManager.initialize();
    }
}, { once: true });

console.log('%c✅ PlayerController.js', 'color: #FF00FF; font-weight: bold; font-size: 12px');
