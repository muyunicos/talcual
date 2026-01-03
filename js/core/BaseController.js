class BaseController {
    constructor() {
        this.gameTimer = null;
        this.countdownRAFId = null;
        this.client = null;
        this.gameState = {};
        this.elements = {};
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
        if (this.elements.headerTimer) {
            this.elements.headerTimer.classList.toggle('tc-timer--hurry', isActive);
        }
    }

    startContinuousTimer(state, onTick = null) {
        this.stopTimer();
        this.gameTimer = new GameTimer(this.elements.headerTimer, onTick);
        this.gameTimer.start(100);
        this.updateTimerFromState(state);

        const timerCheckInterval = setInterval(() => {
            if (this.gameState && this.gameState.status === 'playing') {
                this.updateTimerFromState(this.gameState);
            } else {
                clearInterval(timerCheckInterval);
            }
        }, 1000);

        if (!this._timerCheckIntervals) {
            this._timerCheckIntervals = [];
        }
        this._timerCheckIntervals.push(timerCheckInterval);
    }

    updateTimerFromState(state) {
        if (!state.round_started_at) {
            this.stopTimer();
            return;
        }

        const remaining = GameTimer.getRemaining(state.round_started_at, state.round_duration);
        GameTimer.updateDisplay(remaining, this.elements.headerTimer, '⏳');
    }

    stopTimer() {
        if (this.gameTimer) {
            this.gameTimer.destroy();
            this.gameTimer = null;
        }
        if (this._timerCheckIntervals) {
            this._timerCheckIntervals.forEach(id => clearInterval(id));
            this._timerCheckIntervals = [];
        }
        if (this.countdownRAFId) {
            cancelAnimationFrame(this.countdownRAFId);
            this.countdownRAFId = null;
        }
        this.setTimerHurryUp(false);
    }

    runCountdown(roundStartsAt, countdownDuration, onComplete) {
        if (this.countdownRAFId) {
            cancelAnimationFrame(this.countdownRAFId);
        }

        safeShowElement(this.elements.countdownOverlay);

        if (this.elements.countdownNumber) {
            this.elements.countdownNumber.style.fontSize = 'inherit';
        }

        const update = () => {
            const nowServer = timeSync.getServerTime();
            const elapsed = nowServer - roundStartsAt;
            const remaining = Math.max(0, countdownDuration - elapsed);
            const seconds = Math.ceil(remaining / 1000);

            if (this.elements.countdownNumber) {
                if (seconds > 3) {
                    this.elements.countdownNumber.textContent = '¿Preparado?';
                    this.elements.countdownNumber.style.fontSize = '1.2em';
                } else if (seconds > 0) {
                    this.elements.countdownNumber.textContent = seconds.toString();
                    this.elements.countdownNumber.style.fontSize = 'inherit';
                } else {
                    this.elements.countdownNumber.textContent = '';
                }
            }

            if (remaining > 0) {
                this.countdownRAFId = requestAnimationFrame(update);
            } else {
                safeHideElement(this.elements.countdownOverlay);
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
        this.elements = {};
    }
}

console.log('%c✅ BaseController.js', 'color: #00aa00; font-weight: bold');
