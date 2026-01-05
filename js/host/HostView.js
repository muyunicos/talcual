class HostView {
  constructor() {
    this.elements = this.cacheElements();
    this.eventHandlers = new Map();
    this.leaderboard = new LeaderboardComponent();
    this.leaderboard.mount(this.elements.gameScreen);
    this.initializeVisibility();
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

  getAuraGradientClass(aura) {
    if (!aura || typeof aura !== 'string') return 'aura-gradient--neon-pink-cyan';

    const normalized = aura.toLowerCase().trim();
    
    const auraMap = {
      '#ff0055,#00f0ff': 'aura-gradient--neon-pink-cyan',
      '#8b5cf6,#06b6d4': 'aura-gradient--purple-cyan',
      '#d946ef,#14b8a6': 'aura-gradient--magenta-teal',
      '#ea580c,#ec4899': 'aura-gradient--orange-pink',
      '#3b82f6,#10b981': 'aura-gradient--blue-green'
    };

    for (const [key, className] of Object.entries(auraMap)) {
      if (normalized === key || normalized === key.replace(/#/g, '')) {
        return className;
      }
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

      const aura = player.color && typeof isValidAura === 'function' && isValidAura(player.color)
        ? player.color
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
    if (remaining === null || remaining === undefined) {
      this.elements.headerTimer.textContent = '⏳ --:--';
      this.elements.headerTimer.style.opacity = '1';
      return;
    }

    if (remaining > totalDuration) {
      this.elements.headerTimer.style.opacity = '0';
      return;
    }

    this.elements.headerTimer.style.opacity = '1';

    if (remaining < 0) {
      remaining = 0;
    }

    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    this.elements.headerTimer.textContent = `⏳ ${timeStr}`;
  }

  clearTimer() {
    this.elements.headerTimer.textContent = '⏳ 00:00';
    this.elements.headerTimer.style.opacity = '1';
  }

  updatePlayerList(players) {
    this.leaderboard.updateList(players);
    this.renderPlayerCards(players);
  }

  showWaitingState(playerCount) {
    safeHideElement(this.elements.currentWord);
    safeHideElement(this.elements.categoryLabel);
    safeHideElement(this.elements.countdownOverlay);
    safeHideElement(this.elements.btnHurryUp);

    this.elements.statusMessage.textContent = '⏳ En espera de jugadores (mín. 2)';

    const hasMinPlayers = playerCount >= 2;
    this.setStartButtonState(hasMinPlayers ? 'ready' : 'disabled');
  }

  showPlayingState(state, readyCount) {
    safeHideElement(this.elements.countdownOverlay);

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
    safeShowElement(this.elements.countdownOverlay);
  }

  hideCountdownOverlay() {
    safeHideElement(this.elements.countdownOverlay);
  }

  updateCountdownNumber(seconds) {
    if (seconds > 3) {
      this.elements.countdownNumber.textContent = '¿Preparado?';
    } else if (seconds > 0) {
      this.elements.countdownNumber.textContent = seconds.toString();
    } else {
      this.elements.countdownNumber.textContent = '';
    }
  }
}

console.log('%c✅ HostView.js', 'color: #00aa00; font-weight: bold');