class HostManager extends BaseController {
  constructor(gameCode) {
    super();
    this.gameCode = gameCode;
    this.currentRound = 0;
    this.totalRounds = 3;
    this.remainingTime = 0;
    this.activeTab = 'ranking';
    this.minPlayers = 1;
    this.currentPlayers = [];
    this.currentCategory = 'Sin categoría';
    this.roundEnded = false;
    this.hurryUpActive = false;
    this.categories = [];
    this.categoryWordsMap = {};
    this.roundResults = null;
    this.roundTopWords = [];
    this.gameChain = [];
    this.configCached = false;

    this.view = new HostView();

    this.initializeHost();
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

  async initializeHost() {
    try {
      debug('❫ Inicializando Host...', null, 'info');
      
      this.attachEventListeners();
      this.determineUIState();

      const sessionData = this.recoverSession();
      if (sessionData) {
        debug('🔄 Recuperando sesión de host', null, 'info');
        await this.resumeGame(sessionData.gameCode);
      } else {
        debug('💡 Mostrando pantalla inicial', null, 'info');
        await this.initializeCreateGameModal();
        await this.loadCategoriesForSetup();
        this.showStartScreen();
      }

      debug('✅ HostManager inicializado completamente', null, 'success');
    } catch (error) {
      debug('❌ Error fatal en initializeHost: ' + error.message, null, 'error');
      UI.showFatalError(`Error de inicialización: ${error.message}`);
      throw error;
    }
  }

  async initializeCreateGameModal() {
    if (!createGameModal) {
      createGameModal = new CreateGameModal();
      window.createGameModal = createGameModal;
    }
  }

  async loadCategoriesForSetup() {
    try {
      debug('📚 Cargando categorías para setup...', null, 'info');
      
      if (window.createGameModal && window.createGameModal.gameCandidates) {
        const categories = new Set();
        window.createGameModal.gameCandidates.forEach(c => {
          if (c.category) categories.add(c.category);
        });
        this.categories = Array.from(categories).sort();
        debug('📚 Categorías cargadas', { total: this.categories.length }, 'success');
      } else {
        this.categories = [];
      }
    } catch (error) {
      debug('⚠️ Error cargando categorías:', error, 'warn');
      this.categories = [];
    }
  }

  attachEventListeners() {
    this.view.bindStartGame(() => this.startRound());
    this.view.bindHurryUp(() => this.activateHurryUp());
    this.view.bindEndGame(() => this.endGame());
    this.view.bindRemovePlayer((playerId) => this.handleRemovePlayer(playerId));
  }

  async openSettings() {
    if (!window.settingsModal) {
      debug('⚠️ SettingsModal no está disponible', null, 'warn');
      return;
    }

    let config = null;

    if (this.gameState) {
      config = {
        min_players: this.gameState.min_players,
        max_players: this.gameState.max_players,
        round_duration: this.gameState.round_duration,
        total_rounds: this.gameState.total_rounds,
        countdown_duration: this.gameState.countdown_duration,
        hurry_up_threshold: this.gameState.hurry_up_threshold,
        max_words_per_player: this.gameState.max_words_per_player,
        max_word_length: this.gameState.max_word_length
      };
    } else if (this.gameCode) {
      const ready = await configService.load(this.gameCode);
      config = ready ? configService.getForGame(this.gameCode) : {};
    } else {
      const ready = await configService.load();
      config = ready ? configService.getForGame() : {};
    }

    window.settingsModal.openModal('normal', this.gameCode, config);
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

        ModalSystem_Instance.close();
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

    this.client.on('event:player_joined', (data) => {
      debug('⚡ Jugador unido detectado:', data, 'info');
      this.client.forceRefresh();
    });

    this.client.on('event:player_left', (data) => {
      debug('⚡ Jugador desconectado detectado:', data, 'info');
      this.client.forceRefresh();
    });

    this.client.on('event:player_updated', (data) => {
      debug('⚡ Jugador actualizado detectado:', data, 'info');
      this.client.forceRefresh();
    });

    this.client.on('event:player_ready', (data) => {
      debug('⚡ Jugador terminó detectado:', data, 'info');
      this.client.forceRefresh();
    });
  }

  async resumeGame(gameCode) {
    try {
      this.gameCode = gameCode;
      this.client = new GameClient(gameCode, gameCode, 'host');
      const result = await this.client.sendAction('get_state');

      if (result.success && result.state) {
        debug('✅ Sesión recuperada', null, 'success');
        
        configService.loadFromState(result.state);
        this.minPlayers = result.state.min_players || 1;
        this.totalRounds = result.state.total_rounds || 3;
        
        await this.loadGameChain(gameCode);
        this.loadGameScreen(result.state);
        return;
      }

      debug('⚠️ No se pudo recuperar sesión', null, 'warn');
      this.clearSession();
      await this.initializeCreateGameModal();
      await this.loadCategoriesForSetup();
      this.showStartScreen();
    } catch (error) {
      debug('Error recuperando sesión:', error, 'error');
      this.clearSession();
      await this.initializeCreateGameModal();
      await this.loadCategoriesForSetup();
      this.showStartScreen();
    }
  }

  async loadGameChain(gameCodeOrId) {
    try {
      const result = await fetch('/app/actions.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_game_chain', game_id: gameCodeOrId })
      });
      const data = await result.json();

      if (data.success && Array.isArray(data.chain)) {
        this.gameChain = data.chain;
        debug('🔗 Cadena de partidas cargada', { count: data.chain_count }, 'success');
      } else {
        this.gameChain = [];
      }
    } catch (error) {
      debug('⚠️ Error cargando cadena de partidas:', error, 'warn');
      this.gameChain = [];
    }
  }

  async createLinkedGame() {
    if (!this.client || !this.gameState) return;

    debug('🔗 Creando nueva partida encadenada...', null, 'info');

    try {
      const currentGameId = this.gameState.game_id;
      const originalId = this.gameState.original_id || currentGameId;
      
      const result = await this.client.sendAction('create_game', {
        game_id: currentGameId,
        category: this.currentCategory || null,
        total_rounds: this.gameState.total_rounds || COMM_CONFIG.TOTAL_ROUNDS,
        round_duration: this.gameState.round_duration || COMM_CONFIG.ROUND_DURATION,
        min_players: this.gameState.min_players || this.minPlayers
      });

      if (result.success && result.game_id) {
        debug('🌟 Nova partida creada:', { new_game_id: result.game_id, original_id: result.original_id }, 'success');
        
        this.gameCode = result.game_id;
        this.clearSession();
        this.saveSession(result.game_id, this.currentCategory);
        
        await this.loadGameChain(result.game_id);
        
        setTimeout(() => {
          location.reload();
        }, 500);
      } else {
        showNotification('❌ Error creando nueva partida', 'error');
        debug('❌ Respuesta inválida al crear partida encadenada', result, 'error');
      }
    } catch (error) {
      debug('❌ Error creando partida encadenada:', error, 'error');
      showNotification('❌ Error de conexión', 'error');
    }
  }

  calculateTopWords(results) {
    if (!results || typeof results !== 'object') {
      return [];
    }

    const wordFrequency = {};
    
    Object.values(results).forEach(pResult => {
      if (pResult && pResult.answers && Array.isArray(pResult.answers)) {
        pResult.answers.forEach(ans => {
          if (ans && ans.matches && ans.matches.length > 0) {
            const key = ans.canonical || ans.word;
            if (!wordFrequency[key]) {
              wordFrequency[key] = {
                word: ans.word,
                count: 1,
                type: ans.type,
                points: ans.points
              };
            } else {
              wordFrequency[key].count++;
            }
          }
        });
      }
    });

    return Object.values(wordFrequency)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  handleStateUpdate(state) {
    this.gameState = state;
    debug('📨 Estado actualizado:', null, 'debug');

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

    this.checkAutoGameFlow(state);

    if (window.actionMenuHost) {
      window.actionMenuHost.updateOptions(state);
    }
  }

  updatePlayersList(state) {
    if (!state.players) return;

    this.currentPlayers = Object.values(state.players);
    this.view.updatePlayerList(state.players);
  }

  checkAutoGameFlow(state) {
    if (state.status !== 'playing') return;

    const activePlayers = Object.values(state.players).filter(p => !p.disconnected);
    const readyPlayers = activePlayers.filter(p => p.status === 'ready');

    debug(`🔍 Game Flow: ${readyPlayers.length}/${activePlayers.length} listos`, null, 'debug');

    if (readyPlayers.length === activePlayers.length && activePlayers.length > 0) {
      debug('🐫 TODOS listos - Auto-end ronda', null, 'info');
      this.endRound();
      return;
    }

    const notReadyCount = activePlayers.length - readyPlayers.length;

    if (notReadyCount === 1 && !this.hurryUpActive) {
      const remaining = GameTimer.getRemaining(
        state.round_started_at,
        state.round_duration
      );

      const threshold = (configService.get('hurry_up_threshold', 10) + 2) * 1000;

      if (remaining > threshold) {
        debug('🔫 Solo 1 jugador falta - Auto-Remate', null, 'info');
        this.activateHurryUp();
      }
    }
  }

  async handleRemovePlayer(playerId) {
    if (!this.client || !playerId) return;

    const confirmed = window.confirm('¿Expulsar a este jugador de la sala?');
    if (!confirmed) return;

    try {
      debug(`💪 Expulsando jugador: ${playerId}`, null, 'info');
      const result = await this.client.sendAction('leave_game', { player_id: playerId });

      if (result.success) {
        debug(`✅ Jugador ${playerId} expulsado`, null, 'success');
        showNotification('👋 Jugador expulsado', 'success');
      } else {
        debug(`❌ Error expulsando jugador: ${result.error}`, null, 'error');
        showNotification('❌ No se pudo expulsar al jugador', 'error');
      }
    } catch (error) {
      debug(`Error expulsando jugador: ${error.message}`, null, 'error');
      showNotification('❌ Error de conexión', 'error');
    }
  }

  showWaitingState() {
    this.view.showWaitingState(this.currentPlayers.length, this.minPlayers);
    this.stopTimer();
    this.view.clearTimer();
  }

  async showPlayingState(state) {
    const readyCount = (this.currentPlayers || []).filter(p => p.status === 'ready').length;
    this.view.showPlayingState(state, readyCount);

    if (state.round_starts_at) {
      this.calibrateTimeSync(state);
      const nowServer = timeSync.getServerTime();
      const countdownDurationSeconds = state.countdown_duration || 4;
      const countdownDurationMs = countdownDurationSeconds * 1000;
      const elapsed = nowServer - state.round_starts_at;

      if (elapsed < countdownDurationMs) {
        debug('⏳ Detectado countdown activo desde update', null, 'info');
        await this.showCountdown(state);
      }
    }

    if (state.round_started_at && state.round_duration) {
      this.startContinuousTimer(state);
    }
  }

  async startRound() {
    if (!this.client) return;

    debug('🎮 Iniciando ronda...', null, 'info');

    this.roundEnded = false;
    this.view.setStartButtonLoading();
    this.hurryUpActive = false;

    try {
      const result = await this.client.sendAction('start_round', {});

      if (result.success && result.state) {
        debug('✅ Ronda iniciada', null, 'success');
        const state = result.state;

        this.calibrateTimeSync(state);
        await this.showCountdown(state);

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
      debug('❌ Error en activateHurryUp:', error, 'error');
      console.error('activateHurryUp error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      showNotification('❌ Error activando remate', 'error');
      this.view.setHurryUpButtonState('active');
    }
  }

  async endRound() {
    if (!this.client) return;

    debug('🌣 Finalizando ronda...', null, 'info');

    this.view.setEndRoundButtonLoading();

    try {
      await this.client.forceRefresh();
      debug('✅ Estado sincronizado antes de finalizar', null, 'success');
      
      if (!this.gameState) {
        throw new Error('gameState no disponible después de refresh');
      }

      if (!this.gameState.roundData) {
        debug('⚠️ No hay roundData disponible para calcular resultados', null, 'warn');
        this.roundResults = {};
      } else {
        this.roundResults = wordEngine.calculateGlobalMatches(
          this.gameState.players,
          this.gameState.roundData
        );
        this.roundTopWords = this.calculateTopWords(this.roundResults);
        debug('✅ Resultados calculados localmente', { topWords: this.roundTopWords.length }, 'success');
      }

      const result = await this.client.sendAction('end_round', {
        results: this.roundResults
      });

      if (result.success) {
        debug('✅ Ronda finalizada (resultados enviados al servidor)', null, 'success');
        this.handleStateUpdate(result.state || this.gameState);
      } else {
        showNotification('❌ Error finalizando ronda', 'error');
        this.view.setEndRoundButtonState('ready');
      }
    } catch (error) {
      debug('❌ Error finalizando ronda:', error, 'error');
      console.error('Stack trace:', error.stack);
      showNotification('❌ Error de conexión', 'error');
      this.view.setEndRoundButtonState('ready');
    }
  }

  showRoundEnded(state) {
    this.stopTimer();
    this.view.showRoundEnded();
    
    if (this.roundResults) {
      this.view.showRoundResultsComponent(this.roundResults, state.players, this.roundTopWords);
      debug('🎆 Resultados mostrados al host', null, 'success');
    }
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

  checkRoundTimeout() {
    if (!this.gameState || this.gameState.status !== 'playing') {
      return;
    }
    
    const remaining = GameTimer.getRemaining(
      this.gameState.round_started_at,
      this.gameState.round_duration
    );
    
    if (remaining <= 0 && !this.roundEnded) {
      debug('⏰ Tiempo agotado - Host finalizando ronda...', null, 'info');
      this.roundEnded = true;
      this.endRound();
    }
  }
}

let hostManager = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!hostManager) {
    hostManager = new HostManager();
    window.hostManager = hostManager;
  }
}, { once: true });

console.log('%c✅ HostController.js', 'color: #FF00FF; font-weight: bold; font-size: 12px');