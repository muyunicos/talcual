class HostManager extends BaseController {
  constructor(gameCode) {
    super();
    this.gameCode = gameCode;
    this.currentRound = 0;
    this.remainingTime = 0;
    this.activeTab = 'ranking';
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
    this._configSyncUnsubscribe = null;

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
      debug('« Inicializando Host...', null, 'info');
      
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

    window.settingsModal.openModal(this.gameCode);
  }

  showStartScreen() {
    window.createGameModal.openModal();
  }

  async setCategory(category) {
    const cat = (category || '').trim();

    if (!cat || cat.length > configManager.get('max_category_length', 50)) {
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
    this.determineUIState();

    this.client.onStateUpdate = (s) => this.handleStateUpdate(s);
    this.client.onConnectionLost = () => this.handleConnectionLost();
    this.client.connect();

    setTimeout(async () => {
      debug('🔄 Host forceRefresh después de conectar SSE', null, 'info');
      await this.client.forceRefresh();
    }, 100);

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

    this.client.on('config_field_changed', (data) => {
      debug('🔄 Config field change recibido (HOST):', data, 'debug');
      if (data && data.field && data.value !== undefined) {
        configManager.set(data.field, data.value);
        debug(`✅ [HOST] ${data.field} = ${data.value}`, null, 'debug');
      }
    });
  }

  async resumeGame(gameCode) {
    try {
      this.gameCode = gameCode;
      this.client = new GameClient(gameCode, gameCode, 'host');
      const result = await this.client.sendAction('get_state');

      if (result.success && result.state) {
        debug('✅ Sesión recuperada', null, 'success');
        
        configManager.syncFromGameState(result.state);
        
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
      const currentConfig = configManager.getAll();
      
      const result = await this.client.sendAction('create_game', {
        game_id: currentGameId,
        category: this.currentCategory || null,
        total_rounds: currentConfig.total_rounds,
        round_duration: currentConfig.round_duration,
        min_players: currentConfig.min_players,
        config: currentConfig
      });

      if (result.success && result.game_id) {
        debug('🌟 Nova partida creada:', { new_game_id: result.game_id }, 'success');
        
        showNotification('🔗 Nueva partida encadenada creada', 'success');
        await this.transitionToLinkedGame(result);
      } else {
        showNotification('❌ Error creando nueva partida', 'error');
        debug('❌ Respuesta inválida al crear partida encadenada', result, 'error');
      }
    } catch (error) {
      debug('❌ Error creando partida encadenada:', error, 'error');
      showNotification('❌ Error de conexión', 'error');
    }
  }

  async transitionToLinkedGame(createResult) {
    try {
      debug('🔄 Transicionando a partida encadenada sin reload...', null, 'info');

      const newGameCode = createResult.game_id;
      const newGameState = createResult.state || {};

      this.gameCode = newGameCode;
      this.currentCategory = newGameState.current_category || this.currentCategory;
      this.currentRound = 0;
      this.roundEnded = false;
      this.hurryUpActive = false;

      if (this.client) {
        this.client.disconnect();
      }

      this.client = new GameClient(newGameCode, newGameCode, 'host');
      this.saveSession(newGameCode, this.currentCategory);

      await this.loadGameChain(newGameCode);
      this.loadGameScreen(newGameState);

      debug('✅ Transición a partida encadenada completada sin reload', { newGameCode }, 'success');
    } catch (error) {
      debug('❌ Error en transitionToLinkedGame, reloadando...', error, 'error');
      window.location.reload();
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

    configManager.syncFromGameState(state);
    this.calibrateTimeSync(state);

    const round = state.round || 0;
    const total = configManager.get('total_rounds', 5);
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
      const roundStartsAt = Number(state.round_starts_at);
      const nowServer = timeSync.getServerTime();
      const roundEndsAt = Number(state.round_ends_at);
      const remaining = roundEndsAt - nowServer;

      const threshold = (configManager.get('hurry_up_threshold', 10) + 2) * 1000;

      if (remaining > threshold && nowServer >= roundStartsAt) {
        debug('🔫 Sólo 1 jugador falta - Auto-Remate', null, 'info');
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
    this.view.showWaitingState(this.currentPlayers.length, configManager.get('min_players', 1));
    this.stopTimer();
    this.view.clearTimer();
  }

  async showPlayingState(state) {
    const readyCount = (this.currentPlayers || []).filter(p => p.status === 'ready').length;
    this.view.showPlayingState(state, readyCount);

    if (state.round_starts_at && !this.countdownActive) {
      this.calibrateTimeSync(state);
      const nowServer = timeSync.getServerTime();
      const roundStartsAt = Number(state.round_starts_at);

      if (nowServer < roundStartsAt) {
        debug('⏳ Iniciando countdown en HOST', null, 'info');
        await this.showCountdown(state);
      }
    }

    if (state.round_ends_at && state.round_duration) {
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

        this.handleStateUpdate(result.state);
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
      const hurryUpThreshold = configManager.get('hurry_up_threshold', 10) * 1000;
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

    debug('🌇 Finalizando ronda...', null, 'info');

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
    
    if (state.round_results) {
      this.view.showRoundResultsComponent(state.round_results, state.players, this.roundTopWords);
      debug('🌆 Resultados mostrados al host desde state.round_results', null, 'success');
    } else if (this.roundResults) {
      this.view.showRoundResultsComponent(this.roundResults, state.players, this.roundTopWords);
      debug('🌆 Resultados mostrados al host desde local roundResults', null, 'success');
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

  onRoundTimeout() {
    if (!this.roundEnded) {
      debug('⏰ Timeout ejecutado - Host finalizando ronda', null, 'info');
      this.roundEnded = true;
      this.endRound();
    }
  }

  destroy() {
    if (this._configSyncUnsubscribe) {
      this._configSyncUnsubscribe();
      this._configSyncUnsubscribe = null;
    }

    super.destroy();
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