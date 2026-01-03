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
      categoryLabel: safeGetElement('category-label'),
      currentWord: safeGetElement('current-word'),
      countdownOverlay: safeGetElement('countdown-overlay'),
      countdownNumber: safeGetElement('countdown-number'),
      statusMessage: safeGetElement('status-message'),
      btnStartRound: safeGetElement('btn-start-round'),
      btnHurryUp: safeGetElement('btn-hurry-up'),
      btnEndGame: safeGetElement('btn-end-game'),
      centerStage: safeGetElement('center-stage'),
      categorySticker: safeGetElement('category-sticker')
    };

    Object.entries(elements).forEach(([key, el]) => {
      if (!el) {
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

  updateTimer(remaining) {
    GameTimer.updateDisplay(remaining, this.elements.headerTimer, '⏳');
  }

  clearTimer() {
    GameTimer.updateDisplay(null, this.elements.headerTimer, '⏳');
  }

  updatePlayerList(players) {
    if (!players) return;

    const html = Object.entries(players).map(([pid, player]) => {
      const ready = player.status === 'ready';
      const readyIcon = ready ? '✅' : '⏳';
      const wordCount = player.answers ? player.answers.length : 0;
      return `
                <div class="player-item ${ready ? 'ready' : 'waiting'}">
                    <div class="player-name" style="color: ${player.color || '#999'}">
                        ${readyIcon} ${sanitizeText(player.name)}
                    </div>
                    <div class="player-words">${wordCount} palabras</div>
                    <div class="player-score">${player.score || 0} pts</div>
                </div>
            `;
    }).join('');

    if (this.elements.playersList) {
      this.elements.playersList.innerHTML = html;
    }
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
      'disabled': { disabled: true, text: '🔒 Esperando', visible: true },
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
    safeShowElement(this.elements.countdownOverlay);
  }

  hideCountdownOverlay() {
    safeHideElement(this.elements.countdownOverlay);
  }

  updateCountdownNumber(seconds) {
    if (this.elements.countdownNumber) {
      if (seconds > 3) {
        this.elements.countdownNumber.textContent = '¿Preparado?';
      } else if (seconds > 0) {
        this.elements.countdownNumber.textContent = seconds.toString();
      } else {
        this.elements.countdownNumber.textContent = '';
      }
    }
  }
}

console.log('%c✅ HostView.js', 'color: #00aa00; font-weight: bold');
