class BaseController {
  constructor() {
    this.timerRAFId = null;
    this.countdownRAFId = null;
    this.countdownActive = false;
    this.roundTimeoutId = null;
    this.client = null;
    this.gameState = {};
    this.auraModule = new AuraModule();
    this.hurryUpActive = false;
    this.roundEnded = false;
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

  scheduleRoundTimeout(state) {
    if (this.roundTimeoutId) {
      clearTimeout(this.roundTimeoutId);
      this.roundTimeoutId = null;
    }

    const roundEndsAt = Number(state.round_ends_at);
    if (!roundEndsAt || this.roundEnded) {
      return;
    }

    const nowServer = timeSync.getServerTime();
    const delay = Math.max(0, roundEndsAt - nowServer);

    if (delay === 0) {
      this.onRoundTimeout();
      return;
    }

    this.roundTimeoutId = setTimeout(() => {
      this.roundTimeoutId = null;
      this.onRoundTimeout();
    }, delay);
  }

  onRoundTimeout() {
    if (this.roundEnded) {
      return;
    }
    this.roundEnded = true;
  }

  startContinuousTimer(state) {
    if (!this.view) {
      throw new Error('View not initialized before startContinuousTimer');
    }

    this.stopTimer();

    this.scheduleRoundTimeout(state);

    const timerLoop = () => {
      if (!this.gameState || this.gameState.status !== 'playing') {
        this.timerRAFId = requestAnimationFrame(timerLoop);
        return;
      }

      const roundStartsAt = Number(this.gameState.round_starts_at);
      const roundEndsAt = Number(this.gameState.round_ends_at);
      const roundDuration = Number(this.gameState.round_duration);

      if (!roundEndsAt || !roundDuration) {
        this.view.updateTimer(undefined, undefined);
        this.timerRAFId = requestAnimationFrame(timerLoop);
        return;
      }

      const nowServer = timeSync.getServerTime();

      if (nowServer < roundStartsAt) {
        this.view.updateTimer(undefined, undefined);
      } else {
        const remaining = Math.max(0, roundEndsAt - nowServer);
        this.view.updateTimer(remaining, roundDuration);
      }

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

    if (this.roundTimeoutId) {
      clearTimeout(this.roundTimeoutId);
      this.roundTimeoutId = null;
    }

    this.countdownActive = false;
    this.setTimerHurryUp(false);
  }

  runCountdown(countdownStartsAt, roundStartsAt, onComplete) {
    if (!this.view || !this.view.elements) {
      throw new Error('View not initialized before runCountdown');
    }

    if (this.countdownActive) {
      return;
    }

    this.countdownActive = true;

    const nowServer = timeSync.getServerTime();
    const timeToRoundStart = roundStartsAt - nowServer;

    if (timeToRoundStart <= 0) {
      this.view.hideCountdownOverlay();
      this.countdownActive = false;
      if (typeof onComplete === 'function') {
        onComplete();
      }
      return;
    }

    this.view.showCountdownOverlay();

    const update = () => {
      const now = timeSync.getServerTime();
      const remaining = Math.max(0, roundStartsAt - now);
      const seconds = Math.ceil(remaining / 1000);

      this.view.updateCountdownNumber(seconds);

      if (remaining > 0) {
        this.countdownRAFId = requestAnimationFrame(update);
      } else {
        this.view.hideCountdownOverlay();
        this.countdownActive = false;
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }
    };

    this.countdownRAFId = requestAnimationFrame(update);
  }

  showCountdown(state) {
    const roundStartsAt = Number(state.round_starts_at);
    const nowServer = timeSync.getServerTime();

    if (!roundStartsAt) {
      return Promise.resolve();
    }

    if (nowServer >= roundStartsAt) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.runCountdown(null, roundStartsAt, resolve);
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
    debug('🧺 Destroying controller...', null, 'info');
    this.stopTimer();

    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    this.gameState = null;
  }
}

console.log('%c✅ BaseController.js', 'color: #00aa00; font-weight: bold');