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

console.log('%c✅ Utils.js', 'color: #00aa00; font-weight: bold');