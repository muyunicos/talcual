// ============================================================================
// js/player-manager.js - Gestor del Jugador
// ============================================================================
// Reúne toda la lógica, UI y eventos del jugador en un solo archivo modular

console.log('🎮 Player Manager v2.0 - Unified');

class PlayerManager {
    constructor() {
        // Variables de estado
        this.gameId = null;
        this.playerId = null;
        this.playerName = null;
        this.playerColor = null;
        this.client = null;
        this.myWords = [];
        this.maxWords = 6;
        this.currentRound = 0;
        this.timerInterval = null;
        this.countdownInterval = null;
        this.playerScore = 0;

        // Referencias a elementos del DOM
        this.elements = {
            modalJoinGame: document.getElementById('modal-join-game'),
            gameScreen: document.getElementById('game-screen'),
            inputGameCode: document.getElementById('input-game-code'),
            inputPlayerName: document.getElementById('input-player-name'),
            btnJoin: document.getElementById('btn-join'),
            colorSelector: document.getElementById('color-selector'),
            statusMessage: document.getElementById('status-message'),
            headerRound: document.getElementById('header-round'),
            headerTimer: document.getElementById('header-timer'),
            headerCode: document.getElementById('header-code'),
            playerScoreDisplay: document.getElementById('player-score'),
            statusCard: document.getElementById('status-card'),
            currentWordDisplay: document.getElementById('current-word'),
            waitingMessage: document.getElementById('waiting-message'),
            wordsInputSection: document.getElementById('words-input-section'),
            currentWordInput: document.getElementById('current-word-input'),
            btnAddWord: document.getElementById('btn-add-word'),
            wordsListContainer: document.getElementById('words-list-container'),
            wordsList: document.getElementById('words-list'),
            wordCount: document.getElementById('word-count'),
            maxWordsDisplay: document.getElementById('max-words'),
            btnSubmit: document.getElementById('btn-submit'),
            resultsSection: document.getElementById('results-section'),
            countdownOverlay: document.getElementById('countdown-overlay'),
            countdownNumber: document.getElementById('countdown-number'),
            playerNameDisplay: document.getElementById('player-name-display'),
            btnEditName: document.getElementById('btn-edit-name'),
            btnExit: document.getElementById('btn-exit'),
            modalEditName: document.getElementById('modal-edit-name'),
            modalNameInput: document.getElementById('modal-name-input'),
            modalBtnCancel: document.getElementById('modal-btn-cancel'),
            modalBtnSave: document.getElementById('modal-btn-save'),
        };
    }

    /**
     * Inicializa el manager y carga la interfaz
     */
    initialize() {
        console.log('🔧 Inicializando PlayerManager...');

        // Verificar si hay sesión guardada
        const savedGameId = getLocalStorage('gameId');
        const savedPlayerId = getLocalStorage('playerId');
        const savedPlayerName = getLocalStorage('playerName');
        const savedPlayerColor = getLocalStorage('playerColor');

        if (savedGameId && savedPlayerId && savedPlayerName && savedPlayerColor) {
            console.log('🔄 Recuperando sesión:', savedGameId);
            this.recoverSession(savedGameId, savedPlayerId, savedPlayerName, savedPlayerColor);
        } else {
            console.log('📏 No hay sesión, mostrando modal de unión');
            this.showJoinGameModal();
        }

        this.setupEventListeners();
    }

    /**
     * Configura todos los event listeners
     */
    setupEventListeners() {
        // Botón unirse
        if (this.elements.btnJoin) {
            this.elements.btnJoin.addEventListener('click', () => this.joinGame());
        }

        // Input de código de juego
        if (this.elements.inputGameCode) {
            this.elements.inputGameCode.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.elements.inputPlayerName.focus();
            });
        }

        // Input de nombre
        if (this.elements.inputPlayerName) {
            this.elements.inputPlayerName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.joinGame();
            });
        }

        // Selector de color
        const colorOptions = this.elements.colorSelector.querySelectorAll('.aura-circle');
        colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                colorOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                this.playerColor = option.dataset.color;
            });
        });

        // Seleccionar color aleatorio por defecto
        const randomIndex = Math.floor(Math.random() * colorOptions.length);
        colorOptions[randomIndex].click();

        // Botones de palabras
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

        // Botón editar nombre
        if (this.elements.btnEditName) {
            this.elements.btnEditName.addEventListener('click', () => this.showEditNameModal());
        }
        if (this.elements.modalBtnCancel) {
            this.elements.modalBtnCancel.addEventListener('click', () => this.hideEditNameModal());
        }
        if (this.elements.modalBtnSave) {
            this.elements.modalBtnSave.addEventListener('click', () => this.saveNewName());
        }

        // Botón salir
        if (this.elements.btnExit) {
            this.elements.btnExit.addEventListener('click', () => {
                if (confirm('¿Seguro que quieres salir del juego?')) {
                    this.exitGame();
                }
            });
        }
    }

    /**
     * Muestra modal de unión al juego
     */
    showJoinGameModal() {
        if (this.elements.modalJoinGame) {
            this.elements.modalJoinGame.classList.add('active');
        }
    }

    /**
     * Recupera sesión anterior
     */
    async recoverSession(gId, pId, pName, pColor) {
        try {
            this.gameId = gId;
            this.playerId = pId;
            this.playerName = pName;
            this.playerColor = pColor;

            // Pre-llenar formulario por si falla
            this.elements.inputGameCode.value = gId;
            this.elements.inputPlayerName.value = pName;

            // Seleccionar color guardado
            const colorOptions = this.elements.colorSelector.querySelectorAll('.aura-circle');
            colorOptions.forEach(option => {
                if (option.dataset.color === pColor) {
                    option.click();
                }
            });

            // Crear cliente y verificar estado
            this.client = new GameClient(this.gameId, 'player');
            const result = await this.client.sendAction('get_state', { game_id: this.gameId });

            if (result.success && result.state) {
                const state = result.state;

                // Verificar que el jugador siga en el juego
                if (state.players && state.players[this.playerId]) {
                    console.log('✅ Sesión recuperada exitosamente');

                    // Aplicar color de fondo
                    applyColorGradient(this.playerColor);

                    // Mostrar pantalla de juego
                    this.elements.gameScreen.classList.add('active');
                    this.elements.headerCode.textContent = this.gameId;
                    this.elements.playerNameDisplay.textContent = this.playerName;

                    // Conectar eventos
                    this.client.onStateUpdate = (state) => this.handleStateUpdate(state);
                    this.client.onConnectionLost = () => this.handleConnectionFailed();
                    this.client.connect();

                    // Actualizar con el estado actual
                    this.handleStateUpdate(state);
                } else {
                    console.log('⚠️ Jugador no encontrado en el juego');
                    clearGameSession();
                    this.showJoinGameModal();
                }
            } else {
                console.log('⚠️ Juego no encontrado');
                clearGameSession();
                this.showJoinGameModal();
            }
        } catch (error) {
            console.error('❌ Error recuperando sesión:', error);
            clearGameSession();
            this.showJoinGameModal();
        }
    }

    /**
     * Se une al juego
     */
    async joinGame() {
        const code = this.elements.inputGameCode.value.trim().toUpperCase();
        const name = this.elements.inputPlayerName.value.trim();

        // Validación
        if (!isValidGameCode(code)) {
            this.elements.statusMessage.innerHTML = '⚠️ Ingresa un código válido';
            this.elements.inputGameCode.focus();
            return;
        }

        if (!isValidPlayerName(name)) {
            this.elements.statusMessage.innerHTML = '⚠️ Ingresa tu nombre (mínimo 2 caracteres)';
            this.elements.inputPlayerName.focus();
            return;
        }

        this.gameId = code;
        this.playerName = name;
        this.playerId = generatePlayerId();

        setLocalStorage('gameId', this.gameId);
        setLocalStorage('playerId', this.playerId);
        setLocalStorage('playerName', this.playerName);
        setLocalStorage('playerColor', this.playerColor);

        this.elements.btnJoin.disabled = true;
        this.elements.btnJoin.textContent = 'Conectando...';
        this.elements.statusMessage.innerHTML = '⏳ Conectando...';

        try {
            this.client = new GameClient(this.gameId, 'player');

            const result = await this.client.sendAction('join_game', {
                name: this.playerName,
                color: this.playerColor
            });

            if (result.success) {
                applyColorGradient(this.playerColor);

                this.elements.modalJoinGame.classList.remove('active');
                this.elements.gameScreen.classList.add('active');

                this.elements.headerCode.textContent = this.gameId;
                this.elements.playerNameDisplay.textContent = this.playerName;

                this.client.onStateUpdate = (state) => this.handleStateUpdate(state);
                this.client.onConnectionLost = () => this.handleConnectionFailed();
                this.client.connect();

                console.log('✅ Conectado al juego:', this.gameId);
            } else {
                this.elements.statusMessage.innerHTML = '❌ Error: ' + (result.message || 'desconocido');
                this.elements.btnJoin.disabled = false;
                this.elements.btnJoin.textContent = '🎮 ¡Jugar!';
            }
        } catch (error) {
            console.error('❌ Error:', error);
            this.elements.statusMessage.innerHTML = '❌ Error de conexión';
            this.elements.btnJoin.disabled = false;
            this.elements.btnJoin.textContent = '🎮 ¡Jugar!';
        }
    }

    /**
     * Maneja actualizaciones de estado
     */
    handleStateUpdate(state) {
        console.log('📈 Estado actualizado:', state.status);

        // Actualizar puntuación
        if (state.players && typeof state.players === 'object') {
            const me = state.players[this.playerId];
            if (me) {
                this.playerScore = me.score || 0;
                this.elements.playerScoreDisplay.textContent = this.playerScore + ' pts';
            }
        }

        // Actualizar ronda
        this.currentRound = state.round || 0;
        const totalRounds = state.total_rounds || 3;
        this.elements.headerRound.textContent = `Ronda ${this.currentRound}/${totalRounds}`;

        // Manejo de estados
        switch (state.status) {
            case 'waiting':
                this.showWaitingState();
                this.stopTimer();
                break;

            case 'playing':
                if (state.round_start_at) {
                    const now = Math.floor(Date.now() / 1000);
                    const remaining = state.round_start_at - now;

                    if (remaining > 0 && remaining <= 4) {
                        this.showCountdownSynced(state);
                    } else if (remaining <= 0) {
                        this.showPlayingState(state);
                        this.startContinuousTimer(state);
                    }
                } else {
                    this.showPlayingState(state);
                    this.startContinuousTimer(state);
                }
                break;

            case 'round_ended':
                this.showResults(state);
                this.stopTimer();
                break;

            case 'finished':
                this.showFinalResults(state);
                this.stopTimer();
                break;
        }
    }

    /**
     * Muestra estado de espera
     */
    showWaitingState() {
        this.elements.currentWordDisplay.style.display = 'none';
        this.elements.waitingMessage.style.display = 'block';
        this.elements.waitingMessage.textContent = 'El anfitrión iniciará la ronda pronto';
        this.elements.wordsInputSection.style.display = 'none';
        this.elements.resultsSection.style.display = 'none';
        this.elements.countdownOverlay.style.display = 'none';
    }

    /**
     * Muestra estado de juego en progreso
     */
    showPlayingState(state) {
        this.elements.countdownOverlay.style.display = 'none';
        this.elements.resultsSection.style.display = 'none';

        if (state.current_word) {
            this.elements.currentWordDisplay.textContent = state.current_word;
            this.elements.currentWordDisplay.style.display = 'block';
            this.elements.waitingMessage.style.display = 'none';
            this.elements.wordsInputSection.style.display = 'block';

            this.maxWords = 6;
            this.elements.maxWordsDisplay.textContent = this.maxWords;

            const me = state.players?.[this.playerId];
            if (me && me.status === 'ready') {
                this.elements.currentWordInput.disabled = true;
                this.elements.btnAddWord.disabled = true;
                this.elements.btnSubmit.disabled = true;
                this.elements.btnSubmit.textContent = '✅ Enviado';
                this.elements.waitingMessage.textContent = 'Esperando a los demás jugadores...';
                this.elements.waitingMessage.style.display = 'block';
                this.elements.wordsInputSection.style.display = 'none';
            } else {
                this.elements.currentWordInput.disabled = false;
                this.elements.btnAddWord.disabled = false;
                this.elements.btnSubmit.disabled = false;
                this.elements.btnSubmit.textContent = '⏭️ PASO';

                if (this.myWords.length > 0 && (!me || !me.answers || me.answers.length === 0)) {
                    this.myWords = [];
                    this.updateWordsList();
                }
            }
        }
    }

    /**
     * Muestra countdown sincronizado
     */
    showCountdownSynced(state) {
        const countdownOverlay = this.elements.countdownOverlay;
        const countdownNumber = this.elements.countdownNumber;

        countdownOverlay.style.display = 'flex';

        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        this.countdownInterval = setInterval(() => {
            if (!this.client || !this.client.gameState || !this.client.gameState.round_start_at) {
                countdownOverlay.style.display = 'none';
                clearInterval(this.countdownInterval);
                return;
            }

            const now = Math.floor(Date.now() / 1000);
            const remaining = this.client.gameState.round_start_at - now;

            if (remaining > 0 && remaining <= 3) {
                countdownNumber.textContent = remaining;
                countdownNumber.style.animation = 'none';
                setTimeout(() => {
                    countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
                }, 10);
            } else if (remaining <= 0) {
                countdownOverlay.style.display = 'none';
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;

                if (this.client.gameState) {
                    this.showPlayingState(this.client.gameState);
                    this.startContinuousTimer(this.client.gameState);
                }
            }
        }, 100);
    }

    /**
     * Inicia timer continuo
     */
    startContinuousTimer(state) {
        this.stopTimer();

        if (!state.round_started_at || !state.round_duration) {
            return;
        }

        this.updateTimerFromState(state);

        this.timerInterval = setInterval(() => {
            if (this.client && this.client.gameState && this.client.gameState.status === 'playing') {
                this.updateTimerFromState(this.client.gameState);
            } else {
                this.stopTimer();
            }
        }, 1000);
    }

    /**
     * Actualiza timer desde estado
     */
    updateTimerFromState(state) {
        const now = Math.floor(Date.now() / 1000);
        const elapsed = now - state.round_started_at;
        const remaining = Math.max(0, state.round_duration - elapsed);
        updateTimerDisplay(remaining, this.elements.headerTimer, '⏳ ');
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
     * Agrega una palabra
     */
    addWord() {
        const word = this.elements.currentWordInput.value.trim();

        if (!word) {
            return;
        }

        if (this.myWords.length >= this.maxWords) {
            alert(`Máximo ${this.maxWords} palabras`);
            return;
        }

        const normalized = word.toUpperCase();

        if (this.myWords.includes(normalized)) {
            alert('Ya agregaste esa palabra');
            return;
        }

        this.myWords.push(normalized);
        this.elements.currentWordInput.value = '';
        this.updateWordsList();

        this.sendWordsUpdate();

        this.elements.currentWordInput.focus();
    }

    /**
     * Actualiza lista de palabras
     */
    updateWordsList() {
        this.elements.wordCount.textContent = this.myWords.length;

        if (this.myWords.length > 0) {
            this.elements.wordsListContainer.style.display = 'block';
            this.elements.wordsList.innerHTML = this.myWords.map((word, index) => `
                <div class="word-item" data-index="${index}">
                    <span class="word-text">${word}</span>
                    <span class="word-edit">🗑️</span>
                </div>
            `).join('');

            // Añadir event listeners a items
            this.elements.wordsList.querySelectorAll('.word-item').forEach((item, index) => {
                item.addEventListener('click', () => this.removeWord(index));
            });
        } else {
            this.elements.wordsListContainer.style.display = 'none';
        }
    }

    /**
     * Elimina una palabra
     */
    removeWord(index) {
        this.myWords.splice(index, 1);
        this.updateWordsList();
        this.sendWordsUpdate();
    }

    /**
     * Envía actualización de palabras
     */
    async sendWordsUpdate() {
        if (!this.client) return;

        try {
            await this.client.sendAction('submit_answers', {
                answers: this.myWords,
                forced_pass: false
            });
        } catch (error) {
            console.error('❌ Error enviando palabras:', error);
        }
    }

    /**
     * Envía palabras finales
     */
    async submitWords() {
        if (!this.client) return;

        this.elements.btnSubmit.disabled = true;
        this.elements.btnSubmit.textContent = 'Enviando...';

        try {
            const result = await this.client.sendAction('submit_answers', {
                answers: this.myWords,
                forced_pass: true
            });

            if (result.success) {
                this.elements.currentWordInput.disabled = true;
                this.elements.btnAddWord.disabled = true;
                this.elements.btnSubmit.textContent = '✅ Enviado';

                this.elements.waitingMessage.textContent = 'Esperando a los demás jugadores...';
                this.elements.waitingMessage.style.display = 'block';
                this.elements.wordsInputSection.style.display = 'none';
            } else {
                alert('Error al enviar: ' + (result.message || 'desconocido'));
                this.elements.btnSubmit.disabled = false;
                this.elements.btnSubmit.textContent = '⏭️ PASO';
            }
        } catch (error) {
            console.error('❌ Error:', error);
            alert('Error de conexión');
            this.elements.btnSubmit.disabled = false;
            this.elements.btnSubmit.textContent = '⏭️ PASO';
        }
    }

    /**
     * Muestra resultados de ronda
     */
    showResults(state) {
        this.elements.countdownOverlay.style.display = 'none';
        this.elements.wordsInputSection.style.display = 'none';
        this.elements.currentWordDisplay.style.display = 'none';
        this.elements.waitingMessage.style.display = 'none';

        if (!state.players || !state.players[this.playerId]) return;

        const me = state.players[this.playerId];
        const myResults = me.round_results;

        if (!myResults || Object.keys(myResults).length === 0) {
            this.elements.resultsSection.innerHTML = '<div class="waiting-message">No enviaste palabras esta ronda</div>';
            this.elements.resultsSection.style.display = 'block';
            return;
        }

        this.elements.resultsSection.style.display = 'block';

        let html = '<div class="results-title">📈 Tus Resultados</div>';
        let roundScore = 0;

        Object.entries(myResults).forEach(([word, result]) => {
            const hasMatch = result.count > 1;
            const matchClass = hasMatch ? 'match' : 'no-match';
            const icon = hasMatch ? '✅' : '❌';

            html += `
                <div class="result-item ${matchClass}">
                    <div class="result-word">${icon} ${word}</div>
                    <div class="result-points">+${result.points} puntos</div>
                    ${hasMatch ? `<div class="result-players">Coincidió con: ${result.matched_with?.join(', ') || 'otros'}</div>` : ''}
                </div>
            `;

            roundScore += result.points;
        });

        html += `<div class="total-score">Total ronda: ${roundScore} pts</div>`;

        this.elements.resultsSection.innerHTML = html;
    }

    /**
     * Muestra resultados finales
     */
    showFinalResults(state) {
        this.showResults(state);

        this.elements.waitingMessage.textContent = '🎉 ¡Juego terminado!';
        this.elements.waitingMessage.style.display = 'block';
    }

    /**
     * Muestra modal de edición de nombre
     */
    showEditNameModal() {
        this.elements.modalNameInput.value = this.playerName;
        this.elements.modalEditName.style.display = 'flex';
        this.elements.modalNameInput.focus();
    }

    /**
     * Oculta modal de edición de nombre
     */
    hideEditNameModal() {
        this.elements.modalEditName.style.display = 'none';
    }

    /**
     * Guarda nuevo nombre
     */
    async saveNewName() {
        const newName = this.elements.modalNameInput.value.trim();
        if (newName && newName.length >= 2) {
            this.playerName = newName;
            this.elements.playerNameDisplay.textContent = newName;
            setLocalStorage('playerName', newName);

            if (this.client) {
                await this.client.sendAction('update_player_name', { name: newName });
            }

            this.hideEditNameModal();
        } else {
            alert('Ingresa un nombre válido (mínimo 2 caracteres)');
        }
    }

    /**
     * Maneja fallo de conexión
     */
    handleConnectionFailed() {
        alert('No se pudo conectar al servidor. Por favor, intenta de nuevo.');
        this.exitGame();
    }

    /**
     * Sale del juego
     */
    exitGame() {
        if (this.client) {
            this.client.disconnect();
        }

        clearGameSession();
        location.reload();
    }
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM cargado, inicializando PlayerManager...');
    window.playerManager = new PlayerManager();
    window.playerManager.initialize();
});

console.log('✅ player-manager.js cargado');
