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
    this._configSyncUnsubscribe = null;
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
    debug('📋 Inicializando PlayerManager', null, 'info');
    
    try {
      if (typeof wordEngine === 'undefined') {
        throw new Error('[PlayerManager] WordEngine not loaded');
      }

      await configManager.initialize();
      this.maxWords = configManager.get('max_words_per_player', 6);
      
      this.view = new PlayerView(this.maxWords);
      this.attachEventListeners();

      const sessionData = this.recoverSession();
      if (sessionData) {
        debug('🔄 Recuperando sesión', null, 'info');
        this.recoverGameSession(sessionData.gameId, sessionData.playerId, sessionData.playerName, sessionData.playerColor);
      } else {
        debug('💡 Mostrando modal de unión', null, 'info');
        this.showJoinModal();
      }

      debug('✅ PlayerManager inicializado', null, 'success');
    } catch (error) {
      debug('❌ Error inicializando PlayerManager: ' + error.message, null, 'error');
      UI.showFatalError('Error de inicialización. Por favor recarga la página.');
      throw error;
    }
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
          debug('✅ Sesión recuperada', null, 'success');
          configManager.syncFromGameState(state);
          this.maxWords = configManager.get('max_words_per_player', 6);
          this.loadGameScreen(state);
          return;
        }
      }

      debug('⚠️ No se pudo recuperar sesión', null, 'warn');
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

    this.client.on('config_field_changed', (data) => {
      debug('🔄 Config field change recibido:', data, 'debug');
      if (data && data.field && data.value !== undefined) {
        configManager.set(data.field, data.value);
        debug(`✅ ${data.field} = ${data.value}`, null, 'debug');
      }
    });

    this.handleStateUpdate(state);
  }

  async joinGame(code, name) {
    const gameCode = sanitizeInputValue(code);
    const playerName = sanitizeInputValue(name);
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
        debug(`✅ Conectado a juego: ${this.gameId}`, null, 'success');
        if (result.state) {
          configManager.syncFromGameState(result.state);
          this.maxWords = configManager.get('max_words_per_player', 6);
        }
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
    debug('📨 Estado actualizado:', { status: state.status }, 'debug');

    configManager.syncFromGameState(state);
    this.calibrateTimeSync(state);

    const me = state.players?.[this.playerId];
    if (me) {
      this.view.setPlayerScore(me.score || 0);
    }

    const round = state.round || 0;
    const total = configManager.get('total_rounds', 5);
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
    debug('🎮 Estado PLAYING detectado', null, 'debug');

    const wordPrompt = state.roundData?.roundQuestion;

    if (!wordPrompt) {
      debug('❌ No prompt encontrado en el estado', null, 'error');
      return;
    }

    if (state.roundData && state.roundData.commonAnswers) {
      initializeWordEngineFromRound(state.roundData);
      debug('📚 Mini-diccionario cargado desde roundData', null, 'info');
    } else {
      debug('⚠️ No hay roundData.commonAnswers en estado', null, 'warning');
    }

    if (state.round_starts_at) {
      this.calibrateTimeSync(state);
      const nowServer = timeSync.getServerTime();
      const roundStartsAt = Number(state.round_starts_at);

      if (nowServer < roundStartsAt) {
        const timeUntilStart = roundStartsAt - nowServer;
        debug(`⏳ Countdown aún sin terminar (${timeUntilStart}ms restantes)`, null, 'debug');
        await this.showCountdown(state);
      }
    }

    const me = state.players?.[this.playerId];
    const isReady = me?.status === 'ready';
    const hasAnswers = (me?.answers || []).length;

    debug(`Verificando si estoy ready: isReady=${isReady}, myStatus=${me?.status}`, null, 'debug');

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

    if (state.round_ends_at && state.round_duration) {
      this.startContinuousTimer(state);
    }
  }

  async addWord() {
    const word = sanitizeInputValue(this.view.getInputValue());
    if (!word) return;

    const maxWordsPerPlayer = configManager.get('max_words_per_player', 6);
    if (this.myWords.length >= maxWordsPerPlayer) {
      showNotification(`📚 Alcanzaste el máximo de ${maxWordsPerPlayer} palabras. Edita o termina.`, 'warning');
      return;
    }

    const maxWordLength = configManager.get('max_word_length', 50);
    if (word.length > maxWordLength) {
      showNotification(`Palabra demasiado larga (máximo ${maxWordLength})`, 'warning');
      return;
    }

    if (this.myWords.includes(word)) {
      showNotification('Ya agregaste esa palabra', 'warning');
      return;
    }

    for (let i = 0; i < this.myWords.length; i++) {
      const existing = this.myWords[i];
      if (wordEngine.areEquivalent(word, existing)) {
        showNotification('¡Intenta con otra! Ya escribiste una equivalente', 'warning');
        return;
      }
    }

    this.myWords.push(word);
    this.view.clearInput();
    this.view.updateWordChips(this.myWords);
    this.scheduleWordsUpdate();
    this.view.focusInput();

    if (this.myWords.length === maxWordsPerPlayer) {
      debug(`📚 Máximo de palabras alcanzado (${maxWordsPerPlayer})`, null, 'info');
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

    if (this.isReady && this.myWords.length < configManager.get('max_words_per_player', 6)) {
      debug('🔜 Revertiendo a estado editable (palabras removidas)', null, 'debug');
      this.markNotReady();
    }
  }

  updateInputAndButtons() {
    if (!this.isReady) {
      const maxWordsPerPlayer = configManager.get('max_words_per_player', 6);
      const isAtMax = this.myWords.length >= maxWordsPerPlayer;
      
      if (isAtMax) {
        this.view.updateFinishButtonText(maxWordsPerPlayer);
      } else {
        this.view.updateFinishButtonText(this.myWords.length);
      }
    }
  }

  scheduleWordsUpdate() {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastWordsUpdateTime;
    const throttleMs = 500;

    if (timeSinceLastUpdate >= throttleMs) {
      this.sendWordsUpdate();
    } else {
      if (!this.wordsUpdatePending) {
        this.wordsUpdatePending = true;
        const delay = throttleMs - timeSinceLastUpdate;

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

    debug('👍 Marcando como READY (confirmó terminar)', null, 'info');
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

    debug('🔜 Revertiendo a NO READY', null, 'info');
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

  showResults(state) {
    const me = state.players?.[this.playerId];
    if (!me) {
      return;
    }

    const roundResults = state.round_results;

    if (roundResults && roundResults[this.playerId]) {
      const myResultData = roundResults[this.playerId];
      
      if (myResultData && myResultData.answers && myResultData.answers.length > 0) {
        const formattedResults = [];
        
        myResultData.answers.forEach(ans => {
          if (ans.matches && ans.matches.length > 0) {
            formattedResults.push({
              word: ans.word,
              type: ans.type,
              points: ans.points,
              matchCount: ans.matches.length
            });
          }
        });

        if (formattedResults.length > 0) {
          this.view.showRoundResults(formattedResults);
        } else {
          this.view.showRoundResults(null);
        }
      } else {
        this.view.showRoundResults(null);
      }
    } else {
      this.view.showRoundResults(null);
    }
  }

  showFinalResults(state) {
    const me = state.players?.[this.playerId];
    if (!me) return;

    const roundResults = state.round_results;

    if (roundResults && roundResults[this.playerId]) {
      const myResultData = roundResults[this.playerId];
      
      if (myResultData && myResultData.answers && myResultData.answers.length > 0) {
        const formattedResults = [];
        
        myResultData.answers.forEach(ans => {
          if (ans.matches && ans.matches.length > 0) {
            formattedResults.push({
              word: ans.word,
              type: ans.type,
              points: ans.points,
              matchCount: ans.matches.length
            });
          }
        });

        if (formattedResults.length > 0) {
          this.view.showRoundResults(formattedResults);
        } else {
          this.view.showRoundResults(null);
        }
      } else {
        this.view.showRoundResults(null);
      }
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

      const roundEndsAt = Number(this.gameState.round_ends_at);
      if (!roundEndsAt) {
        return;
      }

      const nowServer = timeSync.getServerTime();
      const remaining = Math.max(0, roundEndsAt - nowServer);

      if (remaining <= 500) {
        const me = this.gameState.players?.[this.playerId];
        if (me && me.status !== 'ready') {
          debug('🟡 Auto-enviando palabras al terminar el tiempo', null, 'info');
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
    const trimmedName = sanitizeInputValue(newName);

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

    if (this._configSyncUnsubscribe) {
      this._configSyncUnsubscribe();
      this._configSyncUnsubscribe = null;
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