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

    this.view = new HostView();

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
        debug('⚠️ Error cargando categorías', null, 'warn');
        this.categories = [];
      }
    } catch (error) {
      debug('⚠️ Error cargando categorías: ' + error.message, null, 'warn');
      this.categories = [];
    }
  }

  getCanonicalForCompare(word) {
    return wordEngine.getCanonical(word);
  }

  getMatchType(word1, word2) {
    return wordEngine.getMatchType(word1, word2);
  }

  attachEventListeners() {
    this.view.bindStartGame(() => this.startRound());
    this.view.bindHurryUp(() => this.activateHurryUp());
    this.view.bindEndGame(() => this.endGame());
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
        this.view.setCategoryLabel(cat);

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
    this.view.showGameScreen();
    this.view.renderRoomCode(this.gameCode);

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

      debug('⚠️ No se pudo recuperar sesión', null, 'warn');
      this.clearSession();
      this.showStartScreen();
    } catch (error) {
      debug('Error recuperando sesión:', error, 'error');
      this.clearSession();
      this.showStartScreen();
    }
  }

  processRoundResults(state) {
    const roundResults = {};
    const scoreDeltas = {};
    const wordMatches = {};

    if (!state.roundData || !state.roundData.validMatches) {
      debug('⚠️ processRoundResults: no roundData', null, 'warn');
      return { roundResults, scoreDeltas, topWords: [] };
    }

    const validAnswers = state.roundData.validMatches;
    if (!Array.isArray(validAnswers)) {
      debug('⚠️ processRoundResults: validMatches not array', null, 'warn');
      return { roundResults, scoreDeltas, topWords: [] };
    }

    wordEngine.initializeFromRoundContext({
      roundQuestion: state.current_prompt || '',
      commonAnswers: validAnswers
    });

    for (const [playerId, player] of Object.entries(state.players)) {
      if (!player || !Array.isArray(player.answers)) continue;

      const playerResults = {};

      player.answers.forEach(playerWord => {
        let bestMatch = null;
        let bestMatchType = null;

        for (const validWord of validAnswers) {
          const comparison = wordEngine.areEquivalentWithType(playerWord, validWord);
          
          if (comparison.match) {
            bestMatch = validWord;
            bestMatchType = comparison.type;
            break;
          }
        }

        playerResults[playerWord] = {
          matched: bestMatch !== null,
          matchedWord: bestMatch,
          matchType: bestMatchType
        };

        if (bestMatch !== null) {
          if (!wordMatches[bestMatch]) {
            wordMatches[bestMatch] = [];
          }
          wordMatches[bestMatch].push({
            player: player.name,
            playerWord,
            matchType: bestMatchType
          });
        }
      });

      roundResults[playerId] = playerResults;

      const pointsEarned = Object.values(playerResults).filter(r => r.matched).length;
      scoreDeltas[playerId] = pointsEarned;
    }

    const topWords = Object.entries(wordMatches)
      .map(([word, matches]) => ({
        word,
        count: matches.length,
        matches
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    debug('✅ processRoundResults completed', {
      playerCount: Object.keys(roundResults).length,
      topWordsCount: topWords.length
    }, 'success');

    return { roundResults, scoreDeltas, topWords };
  }

  handleStateUpdate(state) {
    this.gameState = state;
    debug('📈 Estado actualizado:', null, 'debug');

    this.calibrateTimeSync(state);

    const round = state.round || 0;
    const total = state.total_rounds || 3;
    this.view.setRoundInfo(round, total);

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
    this.view.updatePlayerList(state.players);
  }

  showWaitingState() {
    this.view.showWaitingState(this.currentPlayers.length);
    this.stopTimer();
    this.view.clearTimer();
  }

  showPlayingState(state) {
    const readyCount = (this.currentPlayers || []).filter(p => p.status === 'ready').length;
    this.view.showPlayingState(state, readyCount);

    if (state.round_started_at && state.round_duration) {
      this.startContinuousTimer(state, (remaining) => {
        this.view.updateTimer(remaining);
      });
    }
  }

  async startRound() {
    if (!this.client) return;

    debug('🎮 Iniciando ronda...', null, 'info');

    this.view.setStartButtonLoading();
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
        this.view.setStartButtonState('ready');
      }
    } catch (error) {
      debug('Error iniciando ronda:', error, 'error');
      this.view.setStartButtonState('ready');
    }
  }

  async activateHurryUp() {
    if (!this.client || this.hurryUpActive) return;

    debug('⚡ Activando Remate...', null, 'info');

    this.view.setHurryUpButtonLoading();

    try {
      const hurryUpThreshold = configService.get('hurry_up_threshold', 10) * 1000;
      const result = await this.client.sendAction('update_round_timer', {
        new_end_time: timeSync.getServerTime() + hurryUpThreshold
      });

      if (result.success) {
        debug('✅ Remate activado', null, 'success');
        this.hurryUpActive = true;
        showNotification('⚡ ¡REMATE ACTIVADO!', 'info');
        this.view.setHurryUpButtonState('active_used');
        this.handleStateUpdate(result.state || this.gameState);
      } else {
        showNotification('❌ Error activando remate', 'error');
        this.view.setHurryUpButtonState('active');
      }
    } catch (error) {
      debug('Error activando remate:', error, 'error');
      showNotification('❌ Error de conexión', 'error');
      this.view.setHurryUpButtonState('active');
    }
  }

  async endRound() {
    if (!this.client || !this.gameState) return;

    debug('🎯 Finalizando ronda...', null, 'info');

    this.view.setEndRoundButtonLoading();

    try {
      const { roundResults, scoreDeltas, topWords } = this.processRoundResults(this.gameState);

      const result = await this.client.sendAction('end_round', {
        round_results: roundResults,
        score_deltas: scoreDeltas,
        top_words: topWords
      });

      if (result.success) {
        debug('✅ Ronda finalizada', null, 'success');
        this.handleStateUpdate(result.state || this.gameState);
      } else {
        showNotification('❌ Error finalizando ronda', 'error');
        this.view.setEndRoundButtonState('ready');
      }
    } catch (error) {
      debug('Error finalizando ronda:', error, 'error');
      showNotification('❌ Error de conexión', 'error');
      this.view.setEndRoundButtonState('ready');
    }
  }

  showRoundEnded(state) {
    this.stopTimer();
    this.view.showRoundEnded();
  }

  showGameFinished(state) {
    this.stopTimer();
    this.view.showGameFinished();
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

  async showCountdown(state) {
    debug('⏱️ Iniciando countdown', 'debug');
    const countdownDuration = state.countdown_duration || 4000;

    this.view.showCountdownOverlay();

    return new Promise((resolve) => {
      const update = () => {
        const nowServer = timeSync.getServerTime();
        const elapsed = nowServer - state.round_starts_at;
        const remaining = Math.max(0, countdownDuration - elapsed);
        const seconds = Math.ceil(remaining / 1000);

        this.view.updateCountdownNumber(seconds);

        if (remaining > 0) {
          requestAnimationFrame(update);
        } else {
          this.view.hideCountdownOverlay();
          resolve();
        }
      };

      requestAnimationFrame(update);
    });
  }
}

let hostManager = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!hostManager) {
    hostManager = new HostManager();
  }
}, { once: true });

console.log('%c✅ HostController.js', 'color: #FF00FF; font-weight: bold; font-size: 12px');