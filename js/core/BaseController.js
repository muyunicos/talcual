class BaseController {
  constructor() {
    this.gameTimer = null;
    this.countdownRAFId = null;
    this.client = null;
    this.gameState = {};
    this.auraModule = new AuraModule();
    this.hurryUpActive = false;
  }

  getStorageKeys() {
    throw new Error('getStorageKeys() must be implemented by subclass');
  }

  hasActiveSession() {
    const keys = this.getStorageKeys();
    return !!StorageManager.get(keys.primary);
  }

  recoverSession() {
    throw new Error('recoverSession() must be implemented by subclass');
  }

  saveSession() {
    throw new Error('saveSession() must be implemented by subclass');
  }

  clearSession() {
    const keys = this.getStorageKeys();
    Object.values(keys).forEach(key => StorageManager.remove(key));
  }

  calibrateTimeSync(state) {
    if (state.server_now && state.round_starts_at && !timeSync.isCalibrated) {
      timeSync.calibrateWithServerTime(
        state.server_now,
        state.round_starts_at,
        state.round_ends_at,
        state.round_duration
      );
    }
  }

  createPlayerAuraNode(player) {
    return this.auraModule.renderPlayerNode(player);
  }

  applyPlayerAura(colorStr) {
    this.auraModule.applyColorGradient(colorStr);
  }

  setTimerHurryUp(isActive) {
    this.hurryUpActive = isActive;
    if (this.view && this.view.elements && this.view.elements.headerTimer) {
      this.view.elements.headerTimer.classList.toggle('tc-timer--hurry', isActive);
    }
  }

  startContinuousTimer(state, onTick = null) {
    this.stopTimer();
    
    if (!this.view || !this.view.elements) {
      throw new Error('View not initialized before startContinuousTimer');
    }

    this.gameTimer = new GameTimer(this.view.elements.headerTimer, onTick);
    this.gameTimer.start(100);
    this.updateTimerFromState(state);

    const timerLoop = () => {
      if (!this.gameTimer) return;
      
      if (this.gameState && this.gameState.status === 'playing') {
        this.updateTimerFromState(this.gameState);
        this.gameTimer.rafId = requestAnimationFrame(timerLoop);
      }
    };
    
    this.gameTimer.rafId = requestAnimationFrame(timerLoop);
  }

  updateTimerFromState(state) {
    if (!state.round_started_at) {
      this.stopTimer();
      return;
    }

    const remaining = GameTimer.getRemaining(state.round_started_at, state.round_duration);
    
    if (this.view && this.view.elements && this.view.elements.headerTimer) {
      GameTimer.updateDisplay(remaining, this.view.elements.headerTimer, '⏳');
    }
  }

  stopTimer() {
    if (this.gameTimer) {
      if (this.gameTimer.rafId) {
        cancelAnimationFrame(this.gameTimer.rafId);
      }
      this.gameTimer.destroy();
      this.gameTimer = null;
    }
    
    if (this.countdownRAFId) {
      cancelAnimationFrame(this.countdownRAFId);
      this.countdownRAFId = null;
    }
    
    this.setTimerHurryUp(false);
  }

  runCountdown(roundStartsAt, countdownDuration, onComplete) {
    if (!this.view || !this.view.elements) {
      throw new Error('View not initialized before runCountdown');
    }

    if (this.countdownRAFId) {
      cancelAnimationFrame(this.countdownRAFId);
    }

    safeShowElement(this.view.elements.countdownOverlay);

    if (this.view.elements.countdownNumber) {
      this.view.elements.countdownNumber.style.fontSize = 'inherit';
    }

    const update = () => {
      const nowServer = timeSync.getServerTime();
      const elapsed = nowServer - roundStartsAt;
      const remaining = Math.max(0, countdownDuration - elapsed);
      const seconds = Math.ceil(remaining / 1000);

      if (this.view.elements.countdownNumber) {
        if (seconds > 3) {
          this.view.elements.countdownNumber.textContent = '¿Preparado?';
          this.view.elements.countdownNumber.style.fontSize = '1.2em';
        } else if (seconds > 0) {
          this.view.elements.countdownNumber.textContent = seconds.toString();
          this.view.elements.countdownNumber.style.fontSize = 'inherit';
        } else {
          this.view.elements.countdownNumber.textContent = '';
        }
      }

      if (remaining > 0) {
        this.countdownRAFId = requestAnimationFrame(update);
      } else {
        safeHideElement(this.view.elements.countdownOverlay);
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }
    };
    
    this.countdownRAFId = requestAnimationFrame(update);
  }

  showCountdown(state) {
    debug('⏱️ Iniciando countdown', 'debug');
    const countdownDuration = state.countdown_duration || 4000;

    return new Promise((resolve) => {
      this.runCountdown(state.round_starts_at, countdownDuration, resolve);
    });
  }

  handleConnectionLost() {
    alert('Desconectado del servidor');
    this.exitGame();
  }

  exitGame() {
    if (this.client) {
      this.client.disconnect();
    }
    this.clearSession();
    location.reload();
  }

  destroy() {
    debug('🧹 Destroying controller...', null, 'info');
    this.stopTimer();

    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    this.gameState = null;
  }
}

console.log('%c✅ BaseController.js', 'color: #00aa00; font-weight: bold');