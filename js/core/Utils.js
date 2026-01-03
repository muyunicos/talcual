function safeGetElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Element with id "${id}" not found`);
    }
    return el;
}

function safeShowElement(el) {
    if (el) el.style.display = '';
}

function safeHideElement(el) {
    if (el) el.style.display = 'none';
}

function sanitizeText(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function isValidGameCode(code) {
    if (!code || typeof code !== 'string') return false;
    const clean = code.trim().toUpperCase();
    return /^[A-Z0-9]{3,6}$/.test(clean);
}

function showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    notif.setAttribute('role', 'alert');
    notif.textContent = message;
    notif.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 6px;
        font-weight: 500;
        z-index: 4000;
        max-width: 300px;
        word-wrap: break-word;
    `;
    notif.style.background = type === 'error' ? '#ff4444' :
                             type === 'warning' ? '#ffaa00' :
                             type === 'success' ? '#44ff44' : '#4488ff';
    notif.style.color = '#fff';
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

function debug(message, data = null, level = 'log') {
    if (level === 'debug') {
        if (!window.DEBUG_MODE) return;
    }

    const validConsoleMethod = (method) => {
        const map = {
            'success': 'log',
            'info': 'log',
            'warning': 'warn',
            'warn': 'warn',
            'error': 'error',
            'debug': 'debug',
            'log': 'log'
        };
        return map[method] || 'log';
    };

    const consoleMethod = validConsoleMethod(level);
    const prefix = `[${new Date().toLocaleTimeString()}]`;

    if (data) {
        console[consoleMethod](prefix, message, data);
    } else {
        console[consoleMethod](prefix, message);
    }
}

const UI = {
    showFatalError: function(message) {
        if (typeof ModalSystem_Instance !== 'undefined' && ModalSystem_Instance) {
            const errorHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                    <h2 style="color: #ff6666; margin: 0 0 16px 0; font-size: 20px;">Error Fatal</h2>
                    <p style="color: #e0e0e0; margin: 0 0 16px 0; line-height: 1.6;">${sanitizeText(message)}</p>
                </div>
            `;
            ModalSystem_Instance.show(3, errorHTML, [
                [
                    () => location.reload(),
                    'Recargar Página',
                    'btn-modal-primary'
                ]
            ]);
        } else {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.9); display: flex; align-items: center;
                justify-content: center; z-index: 99999;
            `;
            modal.innerHTML = `
                <div style="background: rgba(46, 0, 78, 0.95); padding: 30px; border-radius: 12px; max-width: 450px; text-align: center; border: 2px solid rgba(255, 0, 85, 0.6);">
                    <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                    <h2 style="color: #ff6666; margin: 0 0 16px 0; font-size: 22px; font-weight: 700;">Error Fatal</h2>
                    <p style="color: #e0e0e0; margin: 0 0 24px 0; line-height: 1.6; font-size: 14px;">${sanitizeText(message)}</p>
                    <button onclick="location.reload()" style="padding: 12px 24px; margin-top: 0; cursor: pointer; background: var(--amarillo, #FFD700); color: #000; border: none; border-radius: 6px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px; transition: all 0.3s ease;">
                        Recargar Página
                    </button>
                </div>
            `;
            document.body.appendChild(modal);
        }
    }
};

const initializeWordEngineFromRound = (roundContext) => {
    if (!roundContext) {
        debug('⚠️ initializeWordEngineFromRound: no roundContext provided', null, 'warning');
        wordEngine.reset();
        return;
    }
    wordEngine.initializeFromRoundContext(roundContext);
};

const StorageKeys = {
    HOST_GAME_CODE: 'host_game_code',
    HOST_CATEGORY: 'host_category',
    HOST_SESSION: 'host_session',
    PLAYER_GAME_CODE: 'player_game_code',
    PLAYER_ID: 'player_id',
    PLAYER_NAME: 'player_name',
    PLAYER_COLOR: 'player_color'
};

const StorageManager = {
    get: (key) => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('StorageManager.get error:', e);
            return null;
        }
    },
    set: (key, value) => {
        try {
            localStorage.setItem(key, String(value));
            return true;
        } catch (e) {
            console.warn('StorageManager.set error:', e);
            return false;
        }
    },
    remove: (key) => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.warn('StorageManager.remove error:', e);
            return false;
        }
    },
    clear: () => {
        try {
            localStorage.clear();
            return true;
        } catch (e) {
            console.warn('StorageManager.clear error:', e);
            return false;
        }
    }
};

class GameTimer {
    constructor(element, onTick = null) {
        this.element = element;
        this.onTick = onTick;
        this.intervalId = null;
        this.remainingMs = 0;
        this.icon = '⏳';
    }

    static getRemaining(roundStartedAt, roundDuration) {
        if (!roundStartedAt || !roundDuration) return null;
        const now = timeSync.getServerTime();
        const elapsed = now - roundStartedAt;
        const remaining = Math.max(0, roundDuration - elapsed);
        return remaining;
    }

    static updateDisplay(remaining, element, icon = '⏳') {
        if (!element) return;
        if (remaining === null || remaining === undefined) {
            element.textContent = `${icon} --:--`;
            return;
        }
        const seconds = Math.ceil(remaining / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        element.textContent = `${icon} ${mins}:${secs.toString().padStart(2, '0')}`;
    }

    start(durationMs, startTime = null) {
        this.stop();
        this.remainingMs = durationMs;
        const refTime = startTime || performance.now();
        
        this.intervalId = setInterval(() => {
            const elapsed = performance.now() - refTime;
            const newRemaining = Math.max(durationMs - elapsed, 0);
            
            if (newRemaining !== this.remainingMs) {
                this.remainingMs = newRemaining;
                this.updateUI();
            }
            
            if (this.remainingMs <= 0) {
                this.stop();
            }
        }, 100);
    }

    updateUI() {
        if (this.element) {
            GameTimer.updateDisplay(this.remainingMs, this.element, this.icon);
        }
        if (typeof this.onTick === 'function') {
            this.onTick(this.remainingMs);
        }
    }

    stop() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    setIcon(icon) {
        this.icon = icon;
    }

    getRemaining() {
        return this.remainingMs;
    }

    isRunning() {
        return this.intervalId !== null;
    }

    destroy() {
        this.stop();
        this.element = null;
        this.onTick = null;
    }
}

const configService = {
    config: {},

    load: async function() {
        try {
            const response = await fetch('/app/actions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_config' })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const text = await response.text();
            if (!text) {
                throw new Error('Empty response from server');
            }

            const data = JSON.parse(text);
            if (data.success && data.config) {
                this.config = data.config;
                return true;
            }
            return false;
        } catch (e) {
            console.error('configService.load error:', e);
            return false;
        }
    },

    isConfigReady: function() {
        return Object.keys(this.config).length > 0;
    },

    get: (key, defaultValue = null) => {
        return configService.config[key] !== undefined ? configService.config[key] : defaultValue;
    }
};

console.log('%c✅ Utils.js', 'color: #00aa00; font-weight: bold');