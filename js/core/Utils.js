function getElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`Required DOM element "${id}" not found.`);
    }
    return el;
}

function safeShowElement(el) {
    if (!el) {
        throw new Error('Cannot show element: element is null or undefined');
    }
    el.classList.remove('hidden');
    el.style.display = '';
}

function safeHideElement(el) {
    if (!el) {
        throw new Error('Cannot hide element: element is null or undefined');
    }
    el.classList.add('hidden');
}

function sanitizeText(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeInputValue(text) {
    if (typeof text !== 'string') return '';
    return text
        .toUpperCase()
        .replace(/[^A-ZÁÉÍÓÚÑ\s]/g, '')
        .trim();
}

function isValidGameCode(code) {
    if (!code || typeof code !== 'string') return false;
    const clean = code.trim().toUpperCase();
    return /^[A-Z0-9]{3,6}$/.test(clean);
}

function isValidPlayerName(name) {
    if (!name || typeof name !== 'string') return false;
    const clean = name.trim();
    return clean.length >= 2 && clean.length <= 20;
}

function generatePlayerId() {
    return 'player_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
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
        if (typeof ModalSystem_Instance === 'undefined' || !ModalSystem_Instance) {
            console.error('[UI.showFatalError] ModalSystem not available. Message:', message);
            throw new Error('ModalSystem_Instance not initialized');
        }

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
}

const configService = {
    config: {},
    configByGameId: new Map(),
    _loading: false,
    _loadPromise: null,
    _gameIdLoading: new Map(),
    _gameIdPromises: new Map(),

    load: async function(gameId = null) {
        try {
            if (gameId) {
                return await this.loadForGame(gameId);
            } else {
                return await this.loadDefaults();
            }
        } catch (e) {
            console.error('configService.load error:', e);
            return false;
        }
    },

    loadForGame: async function(gameId) {
        if (!gameId) return false;

        if (this.configByGameId.has(gameId)) {
            debug(`[CONFIG] Cache hit for gameId: ${gameId}`, null, 'debug');
            return true;
        }

        if (this._gameIdLoading.has(gameId) && this._gameIdPromises.has(gameId)) {
            debug(`[CONFIG] Already loading gameId: ${gameId}, waiting...`, null, 'debug');
            return this._gameIdPromises.get(gameId);
        }

        this._gameIdLoading.set(gameId, true);
        this._gameIdPromises.set(gameId, (async () => {
            try {
                const response = await fetch('/app/actions.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_config', game_id: gameId })
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
                    this.configByGameId.set(gameId, data.config);
                    debug(`[CONFIG] Loaded config for gameId: ${gameId}`, null, 'debug');
                    return true;
                }
                return false;
            } finally {
                this._gameIdLoading.delete(gameId);
                this._gameIdPromises.delete(gameId);
            }
        })());

        return await this._gameIdPromises.get(gameId);
    },

    loadDefaults: async function() {
        if (Object.keys(this.config).length > 0) {
            return true;
        }

        if (this._loading && this._loadPromise) {
            return this._loadPromise;
        }

        this._loading = true;
        this._loadPromise = (async () => {
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
                    debug('[CONFIG] Loaded defaults from .env', null, 'debug');
                    return true;
                }
                return false;
            } finally {
                this._loading = false;
            }
        })();

        return await this._loadPromise;
    },

    loadFromState: function(state) {
        if (!state || typeof state !== 'object') return;

        const gameId = state.game_id;
        if (!gameId) return;

        const configFromState = {
            round_duration: state.round_duration,
            total_rounds: state.total_rounds,
            min_players: state.min_players,
            max_players: state.max_players,
            start_countdown: state.countdown_duration,
            hurry_up_threshold: state.hurry_up_threshold,
            max_words_per_player: state.max_words_per_player,
            max_word_length: state.max_word_length
        };

        this.configByGameId.set(gameId, configFromState);
        debug(`[CONFIG] Loaded config from state for gameId: ${gameId}`, null, 'debug');
    },

    isConfigReady: function(gameId = null) {
        if (gameId) {
            return this.configByGameId.has(gameId);
        }
        return Object.keys(this.config).length > 0;
    },

    get: function(key, defaultValue = null, gameId = null) {
        const source = gameId ? this.configByGameId.get(gameId) : this.config;
        if (!source) return defaultValue;
        return source[key] !== undefined ? source[key] : defaultValue;
    },

    invalidate: function(gameId = null) {
        if (gameId) {
            this.configByGameId.delete(gameId);
            this._gameIdLoading.delete(gameId);
            this._gameIdPromises.delete(gameId);
            debug(`[CONFIG] Invalidated cache for gameId: ${gameId}`, null, 'debug');
        } else {
            this.config = {};
            this._loading = false;
            this._loadPromise = null;
            debug('[CONFIG] Invalidated defaults cache', null, 'debug');
        }
    },

    getForGame: function(gameId = null) {
        if (gameId) {
            return this.configByGameId.get(gameId) || {};
        }
        return this.config;
    }
};

console.log('%c✅ Utils.js', 'color: #00aa00; font-weight: bold');
