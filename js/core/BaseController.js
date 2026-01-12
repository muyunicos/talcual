class BaseController {
  constructor() {
    this.timerRAFId = null;
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

  applyPlayerAura(colorStr) {
    this.auraModule.applyColorGradient(colorStr);
  }

  setTimerHurryUp(isActive) {
    this.hurryUpActive = isActive;
    if (this.view && this.view.elements && this.view.elements.headerTimer) {
      this.view.elements.headerTimer.classList.toggle('tc-timer--hurry', isActive);
    }
  }

  checkRoundTimeout() {
  }

  startContinuousTimer(state) {
    if (!this.view) {
      throw new Error('View not initialized before startContinuousTimer');
    }

    this.stopTimer();

    const timerLoop = () => {
      if (!this.gameState || this.gameState.status !== 'playing') {
        this.timerRAFId = requestAnimationFrame(timerLoop);
        return;
      }

      const roundStartedAt = Number(this.gameState.round_started_at);
      const roundDuration = Number(this.gameState.round_duration);

      if (!roundStartedAt || !roundDuration) {
        this.view.updateTimer(undefined, undefined);
        this.timerRAFId = requestAnimationFrame(timerLoop);
        return;
      }

      const remaining = GameTimer.getRemaining(roundStartedAt, roundDuration);

      this.view.updateTimer(remaining, roundDuration);

      this.checkRoundTimeout();

      this.timerRAFId = requestAnimationFrame(timerLoop);
    };

    this.timerRAFId = requestAnimationFrame(timerLoop);
  }

  stopTimer() {
    if (this.timerRAFId) {
      cancelAnimationFrame(this.timerRAFId);
      this.timerRAFId = null;
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

    this.view.showCountdownOverlay();

    const update = () => {
      const nowServer = timeSync.getServerTime();
      const elapsed = nowServer - roundStartsAt;
      const remaining = Math.max(0, countdownDuration - elapsed);
      const seconds = Math.ceil(remaining / 1000);

      this.view.updateCountdownNumber(seconds);

      if (remaining > 0) {
        this.countdownRAFId = requestAnimationFrame(update);
      } else {
        this.view.hideCountdownOverlay();
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }
    };

    this.countdownRAFId = requestAnimationFrame(update);
  }

  showCountdown(state) {
    debug('⏳ Iniciando countdown', 'debug');
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
    debug('🧶 Destroying controller...', null, 'info');
    this.stopTimer();

    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    this.gameState = null;
  }
}

console.log('%c✅ BaseController.js', 'color: #00aa00; font-weight: bold');