class HostView {
  constructor() {
    this.elements = this.cacheElements();
    this.eventHandlers = new Map();
  }

  cacheElements() {
    const elements = {
      gameScreen: safeGetElement('game-screen'),
      headerCode: safeGetElement('header-code'),
      headerRound: safeGetElement('header-round'),
      headerTimer: safeGetElement('header-timer'),
      playersList: safeGetElement('players-list'),
      playersGrid: safeGetElement('players-grid'),
      categoryLabel: safeGetElement('category-label'),
      currentWord: safeGetElement('current-word'),
      countdownOverlay: safeGetElement('countdown-overlay'),
      countdownNumber: safeGetElement('countdown-number'),
      statusMessage: safeGetElement('status-message'),
      btnStartRound: safeGetElement('btn-start-round'),
      btnHurryUp: safeGetElement('btn-hurry-up'),
      btnEndGame: safeGetElement('btn-end-game'),
      btnEndRound: null,
      centerStage: safeGetElement('center-stage'),
      categorySticker: safeGetElement('category-sticker')
    };

    elements.btnEndRound = document.querySelector('[aria-label="Botón para terminar la ronda"], .btn-end-round');

    Object.entries(elements).forEach(([key, el]) => {
      if (!el && key !== 'btnEndRound' && key !== 'countdownOverlay' && key !== 'countdownNumber') {
        throw new Error(`[HostView] Critical element not found: ${key}`);
      }
    });

    return elements;
  }

  bindStartGame(handler) {
    if (this.elements.btnStartRound) {
      this.elements.btnStartRound.addEventListener('click', () => handler());
    }
  }

  bindHurryUp(handler) {
    if (this.elements.btnHurryUp) {
      this.elements.btnHurryUp.addEventListener('click', () => handler());
    }
  }

  bindEndGame(handler) {
    if (this.elements.btnEndGame) {
      this.elements.btnEndGame.addEventListener('click', () => handler());
    }
  }

  bindRemovePlayer(handler) {
    if (!this.elements.playersGrid) return;

    this.elements.playersGrid.addEventListener('click', (event) => {
      const target = event.target;
      if (!target || !target.classList.contains('btn-remove-player')) return;

      const playerId = target.getAttribute('data-player-id');
      if (!playerId) return;

      handler(playerId);
    });
  }

  renderPlayerCards(players) {
    if (!this.elements.playersGrid || !players) return;

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

      const initialStyle = aura
        ? `background: linear-gradient(135deg, ${aura.split(',')[0]} 0%, ${aura.split(',')[1]} 100%);`
        : '';

      return `
        <div class="player-squarcle ${status}" data-player-id="${pid}">
          <button class="btn-remove-player" data-player-id="${pid}" aria-label="Expulsar jugador" type="button">&times;</button>
          <div class="player-initial" style="${initialStyle}">
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
    if (this.elements.headerCode) {
      this.elements.headerCode.textContent = code;
    }
  }

  setRoundInfo(round, total) {
    if (this.elements.headerRound) {
      this.elements.headerRound.textContent = `${round}/${total}`;
    }
  }

  updateTimer(remaining, totalDuration) {
    if (!this.elements.headerTimer) return;

    if (remaining === null || remaining === undefined) {
      this.elements.headerTimer.textContent = '⏳ --:--';
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
    if (this.elements.headerTimer) {
      this.elements.headerTimer.textContent = '⏳ 00:00';
      this.elements.headerTimer.style.opacity = '1';
    }
  }

  updatePlayerList(players) {
    if (!players) return;

    const sidebarHtml = Object.entries(players).map(([pid, player]) => {
      const ready = player.status === 'ready';
      const readyIcon = ready ? '✅' : '⏳';
      const wordCount = player.answers ? player.answers.length : 0;
      return `
        <div class="player-item ${ready ? 'ready' : 'waiting'}" data-player-id="${pid}">
          <div class="player-name" style="color: ${player.color ? player.color.split(',')[0] : '#999'}">
            ${readyIcon} ${sanitizeText(player.name)}
          </div>
          <div class="player-words">${wordCount} palabras</div>
          <div class="player-score">${player.score || 0} pts</div>
          <div class="player-status-indicator" data-player-status></div>
        </div>
      `;
    }).join('');

    if (this.elements.playersList) {
      this.elements.playersList.innerHTML = sidebarHtml || '<div class="panel-item"><div class="name">Sin jugadores aún</div></div>';
    }

    this.renderPlayerCards(players);
  }

  showWaitingState(playerCount) {
    safeHideElement(this.elements.currentWord);
    safeHideElement(this.elements.categoryLabel);
    safeHideElement(this.elements.countdownOverlay);
    safeHideElement(this.elements.btnHurryUp);

    if (this.elements.statusMessage) {
      this.elements.statusMessage.textContent = '⏳ En espera de jugadores (mín. 2)';
    }

    const hasMinPlayers = playerCount >= 2;
    this.setStartButtonState(hasMinPlayers ? 'ready' : 'disabled');
  }

  showPlayingState(state, readyCount) {
    safeHideElement(this.elements.countdownOverlay);

    if (this.elements.currentWord) {
      this.elements.currentWord.textContent = state.current_prompt || '???';
      safeShowElement(this.elements.currentWord);
    }

    if (this.elements.categoryLabel && state.current_category) {
      this.elements.categoryLabel.textContent = `Categoría: ${state.current_category}`;
      safeShowElement(this.elements.categoryLabel);
    }

    const total = state.players ? Object.keys(state.players).length : 0;
    if (this.elements.statusMessage) {
      this.elements.statusMessage.textContent = `🎮 Jugando... (${readyCount}/${total} listos)`;
    }

    this.setStartButtonState('playing');
    this.setHurryUpButtonState('active');
  }

  showRoundEnded() {
    safeHideElement(this.elements.currentWord);
    safeHideElement(this.elements.categoryLabel);
    safeHideElement(this.elements.countdownOverlay);
    safeHideElement(this.elements.btnHurryUp);

    if (this.elements.statusMessage) {
      this.elements.statusMessage.textContent = '✅ Ronda Finalizada - Mostrando Resultados';
    }

    this.setStartButtonState('next_round');
  }

  showGameFinished() {
    safeHideElement(this.elements.countdownOverlay);
    safeHideElement(this.elements.btnHurryUp);

    if (this.elements.statusMessage) {
      this.elements.statusMessage.textContent = '🏆 ¡Juego Finalizado!';
    }

    this.setStartButtonState('finished');
  }

  setStartButtonState(state) {
    if (!this.elements.btnStartRound) return;

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
    if (!this.elements.btnHurryUp) return;

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
    if (!this.elements.btnEndRound) {
      this.elements.btnEndRound = document.querySelector('.btn-end-round, [aria-label*="Terminar"]');
    }
    if (this.elements.btnEndRound) {
      this.elements.btnEndRound.disabled = true;
      this.elements.btnEndRound.textContent = '⏳ Finalizando...';
      this.elements.btnEndRound.classList.add('loading');
    }
  }

  setEndRoundButtonState(state) {
    if (!this.elements.btnEndRound) {
      this.elements.btnEndRound = document.querySelector('.btn-end-round, [aria-label*="Terminar"]');
    }
    if (this.elements.btnEndRound) {
      this.elements.btnEndRound.disabled = false;
      this.elements.btnEndRound.textContent = '🎯 Terminar Ronda';
      this.elements.btnEndRound.classList.remove('loading');
    }
  }

  setStartButtonLoading() {
    if (this.elements.btnStartRound) {
      this.elements.btnStartRound.disabled = true;
      this.elements.btnStartRound.textContent = '⏳ Iniciando...';
    }
  }

  setHurryUpButtonLoading() {
    if (this.elements.btnHurryUp) {
      this.elements.btnHurryUp.disabled = true;
      this.elements.btnHurryUp.textContent = '⏳ Enviando...';
    }
  }

  setCategoryLabel(category) {
    if (this.elements.categorySticker) {
      this.elements.categorySticker.textContent = category || 'Sin categoría';
    }
    if (this.elements.categoryLabel) {
      this.elements.categoryLabel.textContent = `Categoría: ${category}`;
    }
  }

  showCountdownOverlay() {
    if (this.elements.countdownOverlay) {
      safeShowElement(this.elements.countdownOverlay);
    } else {
      debug('⚠️ [HostView] countdownOverlay element not found, skipping show', null, 'warn');
    }
  }

  hideCountdownOverlay() {
    if (this.elements.countdownOverlay) {
      safeHideElement(this.elements.countdownOverlay);
    }
  }

  updateCountdownNumber(seconds) {
    if (!this.elements.countdownNumber) {
      debug('⚠️ [HostView] countdownNumber element not found, skipping update', null, 'warn');
      return;
    }

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