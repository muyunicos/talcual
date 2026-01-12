class HostView {
  constructor() {
    this.elements = this.cacheElements();
    this.eventHandlers = new Map();
    this.leaderboard = new LeaderboardComponent();
    this.leaderboard.mount(this.elements.gameScreen);
    this.initializeVisibility();
    this.resultsContainerId = 'round-results-container';
  }

  cacheElements() {
    const elements = {
      gameScreen: getElement('game-screen'),
      headerCode: getElement('header-code'),
      headerRound: getElement('header-round'),
      headerTimer: getElement('header-timer'),
      playersGrid: getElement('players-grid'),
      categoryLabel: getElement('category-label'),
      currentWord: getElement('current-word'),
      countdownOverlay: getElement('countdown-overlay'),
      countdownNumber: getElement('countdown-number'),
      statusMessage: getElement('status-message'),
      btnStartRound: getElement('btn-start-round'),
      btnHurryUp: getElement('btn-hurry-up'),
      btnEndGame: getElement('btn-end-game'),
      btnEndRound: document.querySelector('[aria-label="Botón para terminar la ronda"], .btn-end-round'),
      centerStage: getElement('center-stage')
    };

    return elements;
  }

  initializeVisibility() {
    safeHideElement(this.elements.countdownOverlay);
  }

  bindStartGame(handler) {
    this.elements.btnStartRound.addEventListener('click', () => handler());
  }

  bindHurryUp(handler) {
    this.elements.btnHurryUp.addEventListener('click', () => handler());
  }

  bindEndGame(handler) {
    this.elements.btnEndGame.addEventListener('click', () => handler());
  }

  bindRemovePlayer(handler) {
    this.elements.playersGrid.addEventListener('click', (event) => {
      const target = event.target;
      if (!target || !target.classList.contains('btn-remove-player')) return;

      const playerId = target.getAttribute('data-player-id');
      if (!playerId) return;

      handler(playerId);
    });
  }

  normalizeAuraString(aura) {
    if (!aura || typeof aura !== 'string') return '';
    return aura.toLowerCase().trim().replace(/\s+/g, '');
  }

  getAuraGradientClass(aura) {
    if (!aura || typeof aura !== 'string') return 'aura-gradient--neon-pink-cyan';

    const normalized = this.normalizeAuraString(aura);
    
    const auraMap = {
      '#ff0055,#00f0ff': 'aura-gradient--neon-pink-cyan',
      '#ff0055#00f0ff': 'aura-gradient--neon-pink-cyan',
      '#8b5cf6,#06b6d4': 'aura-gradient--purple-cyan',
      '#8b5cf606b6d4': 'aura-gradient--purple-cyan',
      '#d946ef,#14b8a6': 'aura-gradient--magenta-teal',
      '#d946ef14b8a6': 'aura-gradient--magenta-teal',
      '#ea580c,#ec4899': 'aura-gradient--orange-pink',
      '#ea580cec4899': 'aura-gradient--orange-pink',
      '#3b82f6,#10b981': 'aura-gradient--blue-green',
      '#3b82f610b981': 'aura-gradient--blue-green'
    };

    if (auraMap[normalized]) {
      return auraMap[normalized];
    }

    return 'aura-gradient';
  }

  renderPlayerCards(players) {
    if (!players) return;

    const html = Object.entries(players).map(([pid, player]) => {
      const name = sanitizeText(player.name || 'Jugador');
      const initial = name.charAt(0).toUpperCase();
      const score = player.score || 0;
      const status = player.disconnected
        ? 'status-disconnected'
        : (player.status === 'ready'
          ? 'status-ready'
          : (player.answers && player.answers.length ? 'status-answered' : 'status-waiting'));

      const aura = player.aura && typeof isValidAura === 'function' && isValidAura(player.aura)
        ? player.aura
        : null;

      const auraClass = aura ? this.getAuraGradientClass(aura) : 'aura-gradient';
      const customGradientStyle = aura
        ? `style="--aura-gradient: linear-gradient(135deg, ${aura.split(',')[0]} 0%, ${aura.split(',')[1]} 100%);"`
        : '';

      return `
        <div class="player-squarcle ${status}" data-player-id="${pid}">
          <button class="btn-remove-player" data-player-id="${pid}" aria-label="Expulsar jugador" type="button">&times;</button>
          <div class="player-initial ${auraClass}" ${customGradientStyle}>
            ${initial}
          </div>
          <div class="player-name-label" title="${name}">
            ${name}
          </div>
          <div class="player-score-label">
            ${score} pts
          </div>
        </div>
      `;
    }).join('');

    this.elements.playersGrid.innerHTML = html || '';
  }

  showGameScreen() {
    safeShowElement(this.elements.gameScreen);
  }

  renderRoomCode(code) {
    this.elements.headerCode.textContent = code;
  }

  setRoundInfo(round, total) {
    this.elements.headerRound.textContent = `${round}/${total}`;
  }

  updateTimer(remaining, totalDuration) {
    SharedUIManager.updateTimerDisplay(this.elements.headerTimer, remaining, totalDuration);
  }

  clearTimer() {
    SharedUIManager.clearTimerDisplay(this.elements.headerTimer);
  }

  updatePlayerList(players) {
    this.leaderboard.updateList(players);
    this.renderPlayerCards(players);
  }

  showWaitingState(playerCount, minPlayers = 1) {
    safeHideElement(this.elements.currentWord);
    safeHideElement(this.elements.categoryLabel);
    safeHideElement(this.elements.countdownOverlay);
    safeHideElement(this.elements.btnHurryUp);

    this.elements.statusMessage.textContent = `⏳ En espera de jugadores (mín. ${minPlayers})`;

    const hasMinPlayers = playerCount >= minPlayers;
    this.setStartButtonState(hasMinPlayers ? 'ready' : 'disabled');
  }

  showPlayingState(state, readyCount) {
    this.hideRoundResultsComponent();

    this.elements.currentWord.textContent = state.current_prompt || '???';
    safeShowElement(this.elements.currentWord);

    if (state.current_category) {
      this.elements.categoryLabel.textContent = `Categoría: ${state.current_category}`;
      safeShowElement(this.elements.categoryLabel);
    }

    const total = state.players ? Object.keys(state.players).length : 0;
    this.elements.statusMessage.textContent = `🎮 Jugando... (${readyCount}/${total} listos)`;

    this.setStartButtonState('playing');
    this.setHurryUpButtonState('active');
  }

  showRoundEnded() {
    safeHideElement(this.elements.currentWord);
    safeHideElement(this.elements.categoryLabel);
    safeHideElement(this.elements.countdownOverlay);
    safeHideElement(this.elements.btnHurryUp);

    this.elements.statusMessage.textContent = '✅ Ronda Finalizada - Mostrando Resultados';

    this.setStartButtonState('next_round');
  }

  showGameFinished() {
    safeHideElement(this.elements.countdownOverlay);
    safeHideElement(this.elements.btnHurryUp);

    this.elements.statusMessage.textContent = '🏆 ¡Juego Finalizado!';

    this.setStartButtonState('finished');
  }

  setStartButtonState(state) {
    const states = {
      'disabled': { disabled: true, text: '🔐 Esperando', visible: true },
      'ready': { disabled: false, text: '🎮 Iniciar Ronda', visible: true },
      'playing': { disabled: true, text: '▶️ En Juego', visible: true },
      'next_round': { disabled: false, text: '🎮 Siguiente Ronda', visible: true },
      'finished': { disabled: true, text: '🏆 Fin', visible: true }
    };

    const config = states[state] || states.disabled;
    this.elements.btnStartRound.disabled = config.disabled;
    this.elements.btnStartRound.textContent = config.text;
    if (config.visible) {
      safeShowElement(this.elements.btnStartRound);
    }
  }

  setHurryUpButtonState(state) {
    const states = {
      'active': { disabled: false, text: '⚡ REMATE', visible: true },
      'active_used': { disabled: true, text: '⚡ REMATE ACTIVO', visible: true },
      'hidden': { visible: false }
    };

    const config = states[state] || states.hidden;
    this.elements.btnHurryUp.disabled = config.disabled;
    this.elements.btnHurryUp.textContent = config.text;
    if (config.visible) {
      safeShowElement(this.elements.btnHurryUp);
    } else {
      safeHideElement(this.elements.btnHurryUp);
    }
  }

  setEndRoundButtonLoading() {
    if (!this.elements.btnEndRound) return;
    this.elements.btnEndRound.disabled = true;
    this.elements.btnEndRound.textContent = '⏳ Finalizando...';
    this.elements.btnEndRound.classList.add('loading');
  }

  setEndRoundButtonState(state) {
    if (!this.elements.btnEndRound) return;
    this.elements.btnEndRound.disabled = false;
    this.elements.btnEndRound.textContent = '🎯 Terminar Ronda';
    this.elements.btnEndRound.classList.remove('loading');
  }

  setStartButtonLoading() {
    this.elements.btnStartRound.disabled = true;
    this.elements.btnStartRound.textContent = '⏳ Iniciando...';
  }

  setHurryUpButtonLoading() {
    this.elements.btnHurryUp.disabled = true;
    this.elements.btnHurryUp.textContent = '⏳ Enviando...';
  }

  setCategoryLabel(category) {
    this.leaderboard.setCategory(category);
    this.elements.categoryLabel.textContent = `Categoría: ${category}`;
  }

  showCountdownOverlay() {
    SharedUIManager.showCountdownOverlay(this.elements.countdownOverlay);
  }

  hideCountdownOverlay() {
    SharedUIManager.hideCountdownOverlay(this.elements.countdownOverlay);
  }

  updateCountdownNumber(seconds) {
    SharedUIManager.updateCountdownNumber(this.elements.countdownNumber, seconds);
  }

  showRoundResultsComponent(results, players, topWords) {
    if (!results || typeof results !== 'object') {
      debug('⚠️ showRoundResultsComponent: invalid results', null, 'warn');
      return;
    }

    let container = document.getElementById(this.resultsContainerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.resultsContainerId;
      container.className = 'round-results-component';
      this.elements.centerStage.appendChild(container);
    }

    const topWordsHtml = (topWords || []).slice(0, 5).map(tw => `
      <div class="result-top-word">
        <span class="result-word-text">${sanitizeText(tw.word)}</span>
        <span class="result-word-count">${tw.count}</span>
      </div>
    `).join('');

    const playerResultsHtml = Object.entries(results).map(([pid, pResult]) => {
      const player = players && players[pid];
      const playerName = player ? sanitizeText(player.name || 'Jugador') : 'Jugador';
      const scoreDelta = pResult.scoreDelta || 0;
      const scoreDeltaClass = scoreDelta > 0 ? 'positive' : (scoreDelta < 0 ? 'negative' : 'neutral');
      const scoreDeltaText = scoreDelta > 0 ? `+${scoreDelta}` : `${scoreDelta}`;

      const answersHtml = (pResult.answers || []).map(ans => {
        const hasMatches = ans.matches && ans.matches.length > 0;
        const icon = hasMatches ? '✅' : '❌';
        const matchText = hasMatches ? `(${ans.matches.length})` : '';
        return `<div class="result-player-answer ${hasMatches ? 'matched' : 'unmatched'}">${icon} ${sanitizeText(ans.word)} ${matchText}</div>`;
      }).join('');

      return `
        <div class="result-player-group">
          <div class="result-player-header">
            <span class="result-player-name">👤 ${playerName}</span>
            <span class="result-player-score ${scoreDeltaClass}">${scoreDeltaText} pts</span>
          </div>
          <div class="result-player-answers">${answersHtml || '<div class="result-no-answers">Sin respuestas</div>'}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="results-header">
        <h3 class="results-title">🏆 Resultados de la Ronda</h3>
      </div>
      <div class="results-content">
        <div class="results-top-words">
          <h4>📈 Palabras Top</h4>
          <div class="top-words-list">${topWordsHtml || '<div class="no-top-words">Sin coincidencias</div>'}</div>
        </div>
        <div class="results-player-scores">
          <h4>📋 Puntuaciones</h4>
          <div class="player-scores-list">${playerResultsHtml}</div>
        </div>
      </div>
    `;

    container.style.display = 'block';
    debug('🏆 Componente de resultados mostrado', null, 'success');
  }

  hideRoundResultsComponent() {
    const container = document.getElementById(this.resultsContainerId);
    if (container) {
      container.style.display = 'none';
    }
  }
}

console.log('%c✅ HostView.js', 'color: #00aa00; font-weight: bold');