/**
 * @file player-manager.js
 * @description Gestor de lógica del jugador
 * Maneja:
 * - Unirse a partidas
 * - Sesión del jugador (recuperación automática)
 * - Gestión de palabras
 * - UI del jugador
 * - Integración con GameClient (SSE)
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
        this.countdownInterval = null;
        
        // Elementos del DOM
        this.elements = {
            // Modales
            modalJoinGame: null,
            gameScreen: null,
            modalEditName: null,
            
            // Inputs del modal de unión
            inputGameCode: null,
            inputPlayerName: null,
            btnJoin: null,
            colorSelector: null,
            statusMessage: null,
            
            // Header
            headerRound: null,
            headerTimer: null,
            headerCode: null,
            
            // UI del juego
            playerScore: null,
            statusCard: null,
            currentWord: null,
            waitingMessage: null,
            wordsInputSection: null,
            currentWordInput: null,
            btnAddWord: null,
            wordsListContainer: null,
            wordsList: null,
            wordCount: null,
            maxWordsDisplay: null,
            btnSubmit: null,
            resultsSection: null,
            countdownOverlay: null,
            countdownNumber: null,
            playerNameDisplay: null,
            btnEditName: null,
            btnExit: null,
            
            // Modal editar nombre
            modalNameInput: null,
            modalBtnCancel: null,
            modalBtnSave: null
        };
    }
    
    /**
     * Inicializa el gestor del jugador
     */
    initialize() {
        debug('🎲 Inicializando PlayerManager');
        this.cacheElements();
        this.attachEventListeners();
        
        // Intentar recuperar sesión existente
        const savedGameId = getLocalStorage('gameId');
        const savedPlayerId = getLocalStorage('playerId');
        const savedPlayerName = getLocalStorage('playerName');
        const savedPlayerColor = getLocalStorage('playerColor');
        
        if (savedGameId && savedPlayerId && savedPlayerName && savedPlayerColor) {
            debug('🔄 Recuperando sesión');
            this.recoverSession(savedGameId, savedPlayerId, savedPlayerName, savedPlayerColor);
        } else {
            debug('📱 Mostrando modal de unión');
            this.showJoinModal();
        }
        
        debug('✅ PlayerManager inicializado');
    }
    
    /**
     * Cachea referencias a elementos del DOM
     */
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
            btnEditName: safeGetElement('btn-edit-name'),
            btnExit: safeGetElement('btn-exit'),
            modalNameInput: safeGetElement('modal-name-input'),
            modalBtnCancel: safeGetElement('modal-btn-cancel'),
            modalBtnSave: safeGetElement('modal-btn-save')
        };
    }
    
    /**
     * Adjunta event listeners
     * FIX #4: Inicializar color por defecto correctamente
     */
    attachEventListeners() {
        // Botón unirse
        if (this.elements.btnJoin) {
            this.elements.btnJoin.addEventListener('click', () => this.joinGame());
        }
        
        // Enter en inputs
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
        
        // Selector de color - FIX #4: Mejor validación y inicialización
        const colorOptions = this.elements.colorSelector?.querySelectorAll('.aura-circle');
        if (colorOptions && colorOptions.length > 0) {
            // Encontrar el ya seleccionado o seleccionar el primero
            let selectedOption = this.elements.colorSelector.querySelector('.aura-circle.selected');
            if (!selectedOption) {
                selectedOption = colorOptions[0];
                selectedOption.classList.add('selected');
            }
            
            // Inicializar playerColor con el color por defecto
            this.playerColor = selectedOption.dataset.color;
            if (!this.playerColor) {
                console.warn('⚠️ Color sin data-color attribute, usando fallback');
                this.playerColor = '#FF9966,#FF5E62'; // Fallback
            }
            
            // Event listeners para cambiar color
            colorOptions.forEach(option => {
                option.addEventListener('click', () => {
                    colorOptions.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    this.playerColor = option.dataset.color;
                    if (!this.playerColor) {
                        console.warn('⚠️ Opción sin data-color');
                        this.playerColor = '#FF9966,#FF5E62';
                    }
                });
            });
        } else {
            console.warn('⚠️ No color options found in DOM');
            this.playerColor = '#FF9966,#FF5E62'; // Fallback
        }
        
        // Palabras
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
        
        // Editar nombre
        if (this.elements.btnEditName) {
            this.elements.btnEditName.addEventListener('click', () => this.showEditNameModal());
        }
        if (this.elements.modalBtnCancel) {
            this.elements.modalBtnCancel.addEventListener('click', () => this.hideEditNameModal());
        }
        if (this.elements.modalBtnSave) {
            this.elements.modalBtnSave.addEventListener('click', () => this.saveNewName());
        }
        
        // Salir
        if (this.elements.btnExit) {
            this.elements.btnExit.addEventListener('click', () => this.exitGame());
        }
    }
    
    /**
     * Muestra modal de unión
     */
    showJoinModal() {
        safeShowElement(this.elements.modalJoinGame);
        safeHideElement(this.elements.gameScreen);
        
        // FIX #4: Ya se inicializa playerColor en attachEventListeners
        // No necesita otra selección aquí
        
        // Focus en input de código
        if (this.elements.inputGameCode) {
            setTimeout(() => this.elements.inputGameCode.focus(), 100);
        }
    }
    
    /**
     * Intenta recuperar una sesión anterior
     */
    async recoverSession(gameId, playerId, playerName, playerColor) {
        try {
            this.gameId = gameId;
            this.playerId = playerId;
            this.playerName = playerName;
            this.playerColor = playerColor;
            
            // Crear cliente y verificar estado
            this.client = new GameClient(gameId, 'player');
            const result = await this.client.sendAction('get_state', { game_id: gameId });
            
            if (result.success && result.state) {
                const state = result.state;
                
                // Verificar que el jugador sigue en el juego
                if (state.players && state.players[playerId]) {
                    debug('✅ Sesión recuperada');
                    this.loadGameScreen(state);
                    return;
                }
            }
            
            // Si falla, limpiar y mostrar modal
            debug('⚠️ No se pudo recuperar sesión');
            clearGameSession();
            this.showJoinModal();
            
        } catch (error) {
            debug('Error recuperando sesión:', error, 'error');
            clearGameSession();
            this.showJoinModal();
        }
    }
    
    /**
     * Carga la pantalla de juego
     */
    loadGameScreen(state) {
        // FIX #4: Validar que playerColor no sea null
        if (!this.playerColor) {
            console.warn('⚠️ playerColor es null, usando fallback');
            this.playerColor = '#FF9966,#FF5E62';
        }
        
        // Aplicar gradiente de color
        applyColorGradient(this.playerColor);
        
        // Mostrar pantalla de juego
        safeHideElement(this.elements.modalJoinGame);
        safeShowElement(this.elements.gameScreen);
        
        // Actualizar UI
        if (this.elements.headerCode) this.elements.headerCode.textContent = this.gameId;
        if (this.elements.playerNameDisplay) this.elements.playerNameDisplay.textContent = this.playerName;
        
        // Conectar cliente
        this.client.onStateUpdate = (s) => this.handleStateUpdate(s);
        this.client.onConnectionLost = () => this.handleConnectionLost();
        this.client.connect();
        
        // Aplicar estado
        this.handleStateUpdate(state);
    }
    
    /**
     * Unirse a un juego
     */
    async joinGame() {
        const code = this.elements.inputGameCode?.value?.trim().toUpperCase();
        const name = this.elements.inputPlayerName?.value?.trim();
        
        // Validar color
        if (!this.playerColor) {
            if (this.elements.statusMessage) {
                this.elements.statusMessage.innerHTML = '⚠️ Selecciona un aura';
            }
            return;
        }
        
        // Validar
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
        
        // Guardar sesión
        setLocalStorage('gameId', this.gameId);
        setLocalStorage('playerId', this.playerId);
        setLocalStorage('playerName', this.playerName);
        setLocalStorage('playerColor', this.playerColor);
        
        if (this.elements.btnJoin) {
            this.elements.btnJoin.disabled = true;
            this.elements.btnJoin.textContent = 'Conectando...';
        }
        if (this.elements.statusMessage) {
            this.elements.statusMessage.innerHTML = '⏳ Conectando...';
        }
        
        try {
            this.client = new GameClient(this.gameId, 'player');
            
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
            debug('Error uniendose:', error, 'error');
            if (this.elements.statusMessage) {
                this.elements.statusMessage.innerHTML = '❌ Error de conexión';
            }
            if (this.elements.btnJoin) {
                this.elements.btnJoin.disabled = false;
                this.elements.btnJoin.textContent = '🎮 ¡Jugar!';
            }
        }
    }
    
    /**
     * Maneja actualizaciones de estado
     */
    handleStateUpdate(state) {
        this.gameState = state;
        debug('📈 Estado actualizado:', state.status);
        
        // Actualizar puntuación
        const me = state.players?.[this.playerId];
        if (me && this.elements.playerScore) {
            this.elements.playerScore.textContent = (me.score || 0) + ' pts';
        }
        
        // Actualizar ronda
        if (this.elements.headerRound) {
            const total = state.total_rounds || 3;
            this.elements.headerRound.textContent = `Ronda ${state.round || 0}/${total}`;
        }
        
        // Manejo de estado
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
    
    /**
     * Muestra estado de espera
     */
    showWaitingState() {
        safeHideElement(this.elements.currentWord);
        safeShowElement(this.elements.waitingMessage);
        if (this.elements.waitingMessage) {
            this.elements.waitingMessage.textContent = 'El anfitrión iniciará la ronda pronto';
        }
        safeHideElement(this.elements.wordsInputSection);
        safeHideElement(this.elements.resultsSection);
        safeHideElement(this.elements.countdownOverlay);
    }
    
    /**
     * Muestra estado de juego
     */
    showPlayingState(state) {
        safeHideElement(this.elements.countdownOverlay);
        safeHideElement(this.elements.resultsSection);
        
        if (state.current_word) {
            if (this.elements.currentWord) {
                this.elements.currentWord.textContent = state.current_word;
                safeShowElement(this.elements.currentWord);
            }
            safeHideElement(this.elements.waitingMessage);
            
            const me = state.players?.[this.playerId];
            const isReady = me?.status === 'ready';
            
            if (isReady) {
                // Ya envió respuestas
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
                // Puede escribir
                if (this.elements.currentWordInput) this.elements.currentWordInput.disabled = false;
                if (this.elements.btnAddWord) this.elements.btnAddWord.disabled = false;
                if (this.elements.btnSubmit) this.elements.btnSubmit.disabled = false;
                if (this.elements.btnSubmit) this.elements.btnSubmit.textContent = '⏭️ PASO';
                
                safeHideElement(this.elements.waitingMessage);
                safeShowElement(this.elements.wordsInputSection);
                
                // Limpiar palabras si es nueva ronda
                if (!me?.answers || me.answers.length === 0) {
                    this.myWords = [];
                    this.updateWordsList();
                }
            }
        }
        
        // Timer
        if (state.round_started_at && state.round_duration) {
            this.startContinuousTimer(state);
        }
    }
    
    /**
     * Añade una palabra a la lista
     */
    addWord() {
        const input = this.elements.currentWordInput;
        if (!input) return;
        
        const word = input.value.trim();
        if (!word) return;
        
        if (this.myWords.length >= this.maxWords) {
            showNotification(`Máximo ${this.maxWords} palabras`, 'warning');
            return;
        }
        
        const normalized = word.toUpperCase();
        if (this.myWords.includes(normalized)) {
            showNotification('Ya agregaste esa palabra', 'warning');
            return;
        }
        
        this.myWords.push(normalized);
        input.value = '';
        this.updateWordsList();
        this.sendWordsUpdate();
        input.focus();
    }
    
    /**
     * Actualiza lista de palabras en UI
     */
    updateWordsList() {
        if (this.elements.wordCount) {
            this.elements.wordCount.textContent = this.myWords.length;
        }
        
        if (this.myWords.length > 0) {
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
    
    /**
     * Elimina palabra de la lista
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
            debug('Error enviando palabras:', error, 'error');
        }
    }
    
    /**
     * Envía palabras finales
     */
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
                this.elements.btnSubmit.textContent = '⏭️ PASO';
            }
        } catch (error) {
            debug('Error:', error, 'error');
            showNotification('Error de conexión', 'error');
            this.elements.btnSubmit.disabled = false;
            this.elements.btnSubmit.textContent = '⏭️ PASO';
        }
    }
    
    /**
     * Muestra resultados de ronda
     */
    showResults(state) {
        safeHideElement(this.elements.wordsInputSection);
        safeHideElement(this.elements.currentWord);
        safeHideElement(this.elements.waitingMessage);
        
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
    
    /**
     * Muestra resultados finales
     */
    showFinalResults(state) {
        this.showResults(state);
        if (this.elements.waitingMessage) {
            this.elements.waitingMessage.textContent = '🎉 ¡Juego terminado!';
            safeShowElement(this.elements.waitingMessage);
        }
    }
    
    /**
     * Inicia timer continuo
     */
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
    
    /**
     * Actualiza timer
     */
    updateTimerFromState(state) {
        const remaining = getRemainingTime(state.round_started_at, state.round_duration);
        updateTimerDisplay(remaining, this.elements.headerTimer, '⏳');
    }
    
    /**
     * Detiene timer
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    /**
     * Muestra modal de editar nombre
     */
    showEditNameModal() {
        if (this.elements.modalNameInput) {
            this.elements.modalNameInput.value = this.playerName;
        }
        safeShowElement(this.elements.modalEditName, 'flex');
        if (this.elements.modalNameInput) {
            this.elements.modalNameInput.focus();
        }
    }
    
    /**
     * Oculta modal de editar nombre
     */
    hideEditNameModal() {
        safeHideElement(this.elements.modalEditName);
    }
    
    /**
     * Guarda nuevo nombre
     */
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
        setLocalStorage('playerName', newName);
        
        if (this.client) {
            try {
                await this.client.sendAction('update_player_name', { name: newName });
            } catch (error) {
                debug('Error actualizando nombre:', error, 'error');
            }
        }
        
        this.hideEditNameModal();
    }
    
    /**
     * Maneja pérdida de conexión
     */
    handleConnectionLost() {
        alert('Desconectado del servidor');
        this.exitGame();
    }
    
    /**
     * Salir del juego
     */
    exitGame() {
        if (this.client) {
            this.client.disconnect();
        }
        clearGameSession();
        location.reload();
    }
}

// Instancia global
let playerManager = null;

// FIX #3: Inicialización correcta - solo una vez
document.addEventListener('DOMContentLoaded', () => {
    if (!playerManager) {
        playerManager = new PlayerManager();
        playerManager.initialize();
    }
}, { once: true });

console.log('%c✅ player-manager.js cargado', 'color: #10B981; font-weight: bold');