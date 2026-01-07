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
    
    this.lastTypingTime = 0;
    this.typingThrottleMs = 2000;

    this._autoSubmitInterval = null;
    this.view = null;
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
    debug('📋 Inicializando PlayerManager');
    
    try {
      if (typeof wordEngine === 'undefined') {
        throw new Error('[PlayerManager] WordEngine not loaded');
      }

      await configService.load();
      this.maxWords = configService.get('max_words_per_player', 6);
      
      this.view = new PlayerView(this.maxWords);
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

  attachEventListeners() {
    this.view.bindAddWord(() => this.addWord());
    this.view.bindKeyPressInInput(() => this.addWord());
    this.view.bindInputEvent(() => this.scheduleTypingEvent());
    this.view.bindSubmit(() => this.handleFinishButton());
    this.view.bindJoinGame((code, name) => this.joinGame(code, name));
  }

  scheduleTypingEvent() {
    const currentInput = this.view.getInputValue();
    if (!currentInput) return;

    const now = Date.now();
    const timeSinceLastTyping = now - this.lastTypingTime;

    if (timeSinceLastTyping >= this.typingThrottleMs) {
      this.sendTypingEvent();
    }
  }

  async sendTypingEvent() {
    if (!this.client || !this.gameId || !this.playerId) return;

    this.lastTypingTime = Date.now();

    try {
      await this.client.sendAction('typing', {});
      debug('🗣️ Typing event enviado', null, 'debug');
    } catch (error) {
      debug('Error enviando typing event:', error, 'debug');
    }
  }

  showJoinModal() {
    this.view.showJoinScreen();
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

    this.view.showGameScreen(this.playerName, this.gameId, this.playerColor);

    this.client.onStateUpdate = (s) => this.handleStateUpdate(s);
    this.client.onConnectionLost = () => this.handleConnectionLost();
    this.client.connect();

    this.client.on('event:player_updated', (data) => {
      debug('⚡ Estado actualizado detectado:', data, 'info');
      this.client.forceRefresh();
    });

    this.client.on('event:player_ready', (data) => {
      debug('⚡ Jugador terminó detectado:', data, 'info');
      this.client.forceRefresh();
    });

    this.client.on('event:game_started', (data) => {
      debug('⚡ Juego iniciado detectado:', data, 'info');
      this.client.forceRefresh();
    });

    this.handleStateUpdate(state);
  }

  async joinGame(code, name) {
    const gameCode = (code || '').trim().toUpperCase();
    const playerName = (name || '').trim();
    const playerColor = this.view.getSelectedAuraColor();

    if (!playerColor) {
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
    this.playerColor = playerColor;
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
    debug('📨 Estado actualizado:', state.status);

    this.calibrateTimeSync(state);

    const me = state.players?.[this.playerId];
    if (me) {
      this.view.setPlayerScore(me.score || 0);
    }

    const round = state.round || 0;
    const total = state.total_rounds || 3;
    this.view.setRoundInfo(round, total);

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

    if (window.actionMenuPlayer) {
      window.actionMenuPlayer.updateOptions(state);
    }
  }

  showWaitingState() {
    this.view.showWaitingState();
    this.stopTimer();
    wordEngine.reset();
  }

  async showPlayingState(state) {
    debug('🎮 Estado PLAYING detectado', 'debug');

    const wordPrompt = state.current_prompt || state.current_word;

    if (!wordPrompt) {
      debug('❌ No prompt encontrado en el estado', 'error');
      return;
    }

    if (state.roundData && state.roundData.commonAnswers) {
      initializeWordEngineFromRound(state.roundData);
      debug('📚 Mini-diccionario cargado desde roundData', 'info');
    } else {
      debug('⚠️ No hay roundData.commonAnswers en estado', 'warning');
    }

    if (state.round_starts_at) {
      this.calibrateTimeSync(state);
      const nowServer = timeSync.getServerTime();
      const countdownDuration = state.countdown_duration || 4000;
      const elapsedSinceStart = nowServer - state.round_starts_at;
      
      if (elapsedSinceStart < countdownDuration) {
        debug(`⏱️ Countdown aún en progreso (${countdownDuration - elapsedSinceStart}ms restantes)`, 'debug');
        await this.showCountdown(state);
      }
    }

    const me = state.players?.[this.playerId];
    const isReady = me?.status === 'ready';
    const hasAnswers = (me?.answers || []).length;

    debug(`Verificando si estoy ready: isReady=${isReady}, myStatus=${me?.status}`, 'debug');

    this.view.showPlayingState(wordPrompt, state.current_category, hasAnswers, isReady);

    if (!isReady) {
      if (!me?.answers || me.answers.length === 0) {
        this.myWords = [];
        this.view.updateWordChips(this.myWords);
      } else {
        this.myWords = me.answers || [];
        this.view.updateWordChips(this.myWords);
      }
    }

    if (state.round_started_at && state.round_duration) {
      this.startContinuousTimer(state);
    }
  }

  async addWord() {
    const word = this.view.getInputValue();
    if (!word) return;

    if (this.myWords.length >= this.maxWords) {
      showNotification(`📓 Alcanzaste el máximo de ${this.maxWords} palabras. Edita o termina.`, 'warning');
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
    this.view.clearInput();
    this.view.updateWordChips(this.myWords);
    this.scheduleWordsUpdate();
    this.view.focusInput();

    if (this.myWords.length === this.maxWords) {
      debug(`📓 Máximo de palabras alcanzado (${this.maxWords})`, 'info');
      this.updateInputAndButtons();
    }
  }

  removeWord(index) {
    const removed = this.myWords.splice(index, 1)[0] || '';
    
    this.view.updateWordChips(this.myWords);
    this.scheduleWordsUpdate();

    this.view.setInputValue(removed);
    this.view.focusInput();

    this.updateInputAndButtons();

    if (this.isReady && this.myWords.length < this.maxWords) {
      debug('🔜 Revertiendo a estado editable (palabras removidas)', 'debug');
      this.markNotReady();
    }
  }

  updateInputAndButtons() {
    if (!this.isReady) {
      const isAtMax = this.myWords.length >= this.maxWords;
      
      if (isAtMax) {
        this.view.updateFinishButtonText(this.maxWords);
      } else {
        this.view.updateFinishButtonText(this.myWords.length);
      }
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

  async markReady() {
    if (!this.client) return;

    debug('👍 Marcando como READY (confirmó terminar)', 'info');
    this.isReady = true;

    this.view.setReadOnlyMode();

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

    debug('🔜 Revertiendo a NO READY', 'info');
    this.isReady = false;

    this.view.setEditableMode(this.myWords.length);

    try {
      await this.client.sendAction('submit_answers', {
        answers: this.myWords,
        forced_pass: false
      });
    } catch (error) {
      debug('Error revertiendo ready:', error, 'error');
    }
  }

  ensureWordEngineInitialized(state) {
    if (!state.roundData || !state.roundData.commonAnswers) {
      debug('⚠️ No roundData disponible para inicializar WordEngine', 'warn');
      return false;
    }

    initializeWordEngineFromRound(state.roundData);
    debug('📚 WordEngine inicializado en showResults', 'info');
    return true;
  }

  showResults(state) {
    const me = state.players?.[this.playerId];
    if (!me) return;

    this.ensureWordEngineInitialized(state);

    const globalResults = wordEngine.calculateGlobalMatches(
        state.players,
        state.roundData
    );

    const myResultData = globalResults[this.playerId];

    if (myResultData && myResultData.answers.length > 0) {
      const formattedMatches = myResultData.answers.map(ans => ({
        word: ans.word,
        matched: ans.matches.length > 0,
        matchedPlayers: ans.matches.map(m => m.name),
        count: ans.matches.length,
        matchType: ans.matches[0]?.type
      }));

      this.view.showRoundResults(formattedMatches);
    } else {
      this.view.showRoundResults(null);
    }
  }

  showFinalResults(state) {
    const me = state.players?.[this.playerId];
    if (!me) return;

    this.ensureWordEngineInitialized(state);

    const globalResults = wordEngine.calculateGlobalMatches(
        state.players,
        state.roundData
    );

    const myResultData = globalResults[this.playerId];

    if (myResultData && myResultData.answers.length > 0) {
      const formattedMatches = myResultData.answers.map(ans => ({
        word: ans.word,
        matched: ans.matches.length > 0,
        matchedPlayers: ans.matches.map(m => m.name),
        count: ans.matches.length,
        matchType: ans.matches[0]?.type
      }));

      this.view.showRoundResults(formattedMatches);
    } else {
      this.view.showRoundResults(null);
    }

    this.view.showFinalResults();
  }

  startContinuousTimer(state) {
    super.startContinuousTimer(state);

    if (this._autoSubmitInterval) clearInterval(this._autoSubmitInterval);

    this._autoSubmitInterval = setInterval(() => {
      if (!this.gameState || this.gameState.status !== 'playing') {
        clearInterval(this._autoSubmitInterval);
        return;
      }

      const remaining = GameTimer.getRemaining(
        this.gameState.round_started_at,
        this.gameState.round_duration
      );

      if (remaining !== null && remaining <= 500) {
        const me = this.gameState.players?.[this.playerId];
        if (me && me.status !== 'ready') {
          debug('🔵 Auto-enviando palabras al terminar el tiempo', null, 'info');
          this.autoSubmitWords();
          clearInterval(this._autoSubmitInterval);
        }
      }
    }, 1000);
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
    this.view.showEditNameModal(
      this.playerName,
      this.playerColor,
      (newName) => this.saveNewName(newName)
    );
  }

  async saveNewName(newName) {
    const trimmedName = (newName || '').trim();

    if (!isValidPlayerName(trimmedName)) {
      showNotification('Nombre inválido (2-20 caracteres)', 'warning');
      return;
    }

    this.playerName = trimmedName;

    const selectedAura = this.view.getSelectedEditAura();
    if (selectedAura && selectedAura !== this.playerColor) {
      this.playerColor = selectedAura;
      auraModuleInstance.applyColorGradient(this.playerColor);
      auraModuleInstance.savePlayerColor(this.playerColor);
    }

    this.saveSession(this.gameId, this.playerId, trimmedName, this.playerColor);

    if (this.client) {
      try {
        await this.client.sendAction('update_player_name', { name: trimmedName });
        if (selectedAura) {
          await this.client.sendAction('update_player_color', { color: selectedAura });
        }
      } catch (error) {
        debug('Error actualizando nombre/color:', error, 'error');
      }
    }

    ModalSystem_Instance.close();
  }

  async exitGame() {
    if (!this.client) {
      this.clearSession();
      this.showJoinModal();
      return;
    }

    try {
      await this.client.sendAction('leave_game', {});
    } catch (error) {
      debug('Error al retirarse:', error, 'error');
    } finally {
      this.destroy();
      this.clearSession();
      location.reload();
    }
  }

  destroy() {
    if (this._autoSubmitInterval) {
      clearInterval(this._autoSubmitInterval);
      this._autoSubmitInterval = null;
    }
    super.destroy();
  }
}

let playerManager = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!playerManager) {
    playerManager = new PlayerManager();
    window.playerManager = playerManager;
    playerManager.initialize();
  }
}, { once: true });

console.log('%c✅ PlayerController.js', 'color: #FF00FF; font-weight: bold; font-size: 12px');