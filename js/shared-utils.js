/**
 * @file shared-utils.js
 * @description Centralization of services and shared utilities
 * 
 * 🔧 PHASE 2 (SYNC) - CONSOLIDATED:
 * - UNIFIED: ConfigService with extended server config
 * - SYNC: Client-side defaults match PHP constants
 * - ROBUST: Fallbacks for server failure aligned with PHP defaults
 * - DictionaryService loads app/diccionario.json and injects into wordEngine
 * - Flattens dictionary data for UI prompts
 */

// ============================================================================
// DEBUGGING & UTILITIES
// ============================================================================

const DEBUG = true;

function debug(message, data = null, type = 'log') {
    if (!DEBUG) return;
    
    const styles = {
        log: 'color: #666; font-size: 11px;',
        info: 'color: #3B82F6; font-weight: bold;',
        success: 'color: #22C55E; font-weight: bold;',
        warn: 'color: #F59E0B; font-weight: bold;',
        error: 'color: #EF4444; font-weight: bold;'
    };

    console.log(`%c[${type.toUpperCase()}] ${message}`, styles[type] || styles.log);
    if (data !== null && typeof data === 'object') {
        console.table(data);
    } else if (data !== null) {
        console.log('%cData:', 'font-weight: bold;', data);
    }
}

// ============================================================================
// UI NAMESPACE - CENTRALIZED ERROR DISPLAY
// ============================================================================

const UI = {
    showFatalError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fatal-error';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #EF4444;
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 9999;
            text-align: center;
            font-weight: bold;
            max-width: 80%;
            word-wrap: break-word;
        `;
        document.body.appendChild(errorDiv);
        console.error('❌ FATAL ERROR:', message);
    }
};

// ============================================================================
// GAME TIMER UTILITY - CENTRALIZED
// ============================================================================

const GameTimer = {
    format(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    getRemaining(startTime, duration) {
        const nowServer = typeof timeSync !== 'undefined' && timeSync.isCalibrated ? timeSync.getServerTime() : Date.now();
        const elapsed = nowServer - startTime;
        return Math.max(0, duration - elapsed);
    },

    updateDisplay(remainingMs, element, emoji = '⏳') {
        if (!element) return;
        if (remainingMs === null || remainingMs === undefined) {
            element.textContent = `${emoji}`;
            return;
        }
        const seconds = Math.ceil(remainingMs / 1000);
        element.textContent = `${emoji} ${this.format(seconds)}`;
    }
};

function formatTime(seconds) {
    return GameTimer.format(seconds);
}

function updateTimerDisplay(remainingMs, element, emoji = '⏳') {
    return GameTimer.updateDisplay(remainingMs, element, emoji);
}

function getRemainingTime(startTime, duration) {
    return GameTimer.getRemaining(startTime, duration);
}

// ============================================================================
// DOM UTILITIES
// ============================================================================

function safeGetElement(id) {
    const el = document.getElementById(id);
    if (!el && typeof DEBUG !== 'undefined' && DEBUG) {
        console.warn(`[DOM] Element not found: #${id}`);
    }
    return el;
}

function safeShowElement(el) {
    if (el) {
        el.classList.remove('hidden');
        el.style.display = '';
    }
}

function safeHideElement(el) {
    if (el) {
        el.classList.add('hidden');
        el.style.display = 'none';
    }
}

function sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// STORAGE MANAGER & KEYS
// ============================================================================

const StorageKeys = {
    GAME_ID: 'gameId',
    PLAYER_ID: 'playerId',
    PLAYER_NAME: 'playerName',
    PLAYER_COLOR: 'playerColor',
    HOST_GAME_CODE: 'hostGameCode',
    IS_HOST: 'isHost',
    SESSION_ACTIVE: 'sessionActive',
    GAME_CATEGORY: 'gameCategory'
};

class StorageManager {
    static set(key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch (e) {
            console.error(`[StorageManager] Error escribiendo ${key}:`, e);
        }
    }

    static get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value !== null ? value : defaultValue;
        } catch (e) {
            console.error(`[StorageManager] Error leyendo ${key}:`, e);
            return defaultValue;
        }
    }

    static remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error(`[StorageManager] Error removiendo ${key}:`, e);
        }
    }

    static clear() {
        try {
            localStorage.clear();
        } catch (e) {
            console.error('[StorageManager] Error limpiando storage:', e);
        }
    }

    static isHostSessionActive() {
        const isHost = StorageManager.get(StorageKeys.IS_HOST) === 'true';
        const gameCode = StorageManager.get(StorageKeys.HOST_GAME_CODE);
        return isHost && !!gameCode;
    }
}

// ============================================================================
// SESSION MANAGER (MUST BE BEFORE HOST MANAGER USES IT)
// ============================================================================

class SessionManager {
    constructor(role) {
        this.role = role;
        this.managers = [];
    }

    isSessionActive() {
        if (this.role === 'host') {
            return StorageManager.isHostSessionActive();
        } else {
            const gameId = StorageManager.get(StorageKeys.GAME_ID);
            const playerId = StorageManager.get(StorageKeys.PLAYER_ID);
            return !!gameId && !!playerId;
        }
    }

    saveHostSession(gameCode, category = null) {
        StorageManager.set(StorageKeys.HOST_GAME_CODE, gameCode);
        StorageManager.set(StorageKeys.GAME_ID, gameCode);
        StorageManager.set(StorageKeys.IS_HOST, 'true');
        if (category) {
            StorageManager.set(StorageKeys.GAME_CATEGORY, category);
        }
        debug('💾 Sesión host guardada', { gameCode, category }, 'success');
    }

    savePlayerSession(gameId, playerId, playerName, playerColor) {
        StorageManager.set(StorageKeys.GAME_ID, gameId);
        StorageManager.set(StorageKeys.PLAYER_ID, playerId);
        StorageManager.set(StorageKeys.PLAYER_NAME, playerName);
        StorageManager.set(StorageKeys.PLAYER_COLOR, playerColor);
        StorageManager.set(StorageKeys.IS_HOST, 'false');
        debug('💾 Sesión player guardada', { gameId, playerId, playerName }, 'success');
    }

    recover() {
        if (!this.isSessionActive()) return null;

        if (this.role === 'host') {
            return {
                gameCode: StorageManager.get(StorageKeys.HOST_GAME_CODE),
                category: StorageManager.get(StorageKeys.GAME_CATEGORY)
            };
        } else {
            return {
                gameId: StorageManager.get(StorageKeys.GAME_ID),
                playerId: StorageManager.get(StorageKeys.PLAYER_ID),
                playerName: StorageManager.get(StorageKeys.PLAYER_NAME),
                playerColor: StorageManager.get(StorageKeys.PLAYER_COLOR)
            };
        }
    }

    registerManager(instance) {
        if (instance && typeof instance.destroy === 'function') {
            this.managers.push(instance);
            debug(`📋 Manager registrado (${this.managers.length} total)`, null, 'info');
        }
    }

    clear() {
        debug('📑 Limpiando sesión...', null, 'info');
        
        this.managers.forEach(manager => {
            try {
                manager.destroy?.();
            } catch (e) {
                debug(`⚠️  Error limpiando manager: ${e.message}`, null, 'warn');
            }
        });
        this.managers = [];

        StorageManager.clear();
        debug('✅ Sesión limpiada completamente', null, 'success');
    }
}

const hostSession = new SessionManager('host');
const playerSession = new SessionManager('player');

// ============================================================================
// WORD EQUIVALENCE ENGINE - FAIL-FAST (NO STUB)
// ============================================================================

let wordEngine = null;

if (typeof WordEquivalenceEngine === 'undefined') {
    throw new Error('❌ CRITICAL: WordEquivalenceEngine not loaded - word-comparison.js must be included before shared-utils.js');
} else {
    wordEngine = new WordEquivalenceEngine();
    debug('✅ WordEngine instantiated from word-comparison.js', null, 'success');
}

// ============================================================================
// CONFIG SERVICE - SYNCHRONIZED WITH SERVER
// ============================================================================

class ConfigService {
    constructor() {
        this.config = null;
        this.loadPromise = null;
        this.isReady = false;
    }

    getDefaults() {
        return {
            round_duration: 60,
            TOTAL_ROUNDS: 3,
            max_words_per_player: 6,
            max_code_length: 5,
            min_players: 2,
            max_players: 20,
            start_countdown: 5,
            max_word_length: 30,
            min_player_name_length: 2,
            max_player_name_length: 20
        };
    }

    async load() {
        if (this.config) {
            this.isReady = true;
            return this.config;
        }
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            debug('⚙️  Cargando configuración...', null, 'info');
            
            try {
                const url = new URL('./app/actions.php', window.location.href);
                const response = await fetch(url.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_config' }),
                    cache: 'no-store'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: Error connecting to server`);
                }

                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.message || 'Invalid server response');
                }

                if (!result.config || typeof result.config !== 'object') {
                    throw new Error('Server config is empty or malformed');
                }

                const requiredFields = ['round_duration', 'TOTAL_ROUNDS', 'max_words_per_player', 'max_code_length'];
                for (const field of requiredFields) {
                    if (!(field in result.config)) {
                        throw new Error(`Critical config field missing: ${field}`);
                    }
                }

                this.config = result.config;
                this.isReady = true;

                debug('⚙️  Configuración cargada exitosamente', this.config, 'success');
                return this.config;
            } catch (error) {
                debug('⚠️  Error cargando configuración, usando defaults: ' + error.message, null, 'warn');
                this.config = this.getDefaults();
                this.isReady = true;
                return this.config;
            }
        })();

        return this.loadPromise;
    }

    get(key, defaultValue = null) {
        if (!this.config) {
            const defaults = this.getDefaults();
            return key in defaults ? defaults[key] : defaultValue;
        }
        return this.config[key] ?? defaultValue;
    }

    isConfigReady() {
        return this.isReady && this.config !== null;
    }
}

const configService = new ConfigService();

// ============================================================================
// DICTIONARY SERVICE - SINGLE SOURCE OF TRUTH
// ============================================================================

class DictionaryService {
    constructor() {
        this.rawDictionary = null;
        this.flattenedWords = [];
        this.categories = [];
        this.isReady = false;
        this.loadPromise = null;
    }

    async load() {
        if (this.isReady) {
            return { rawDictionary: this.rawDictionary, flattenedWords: this.flattenedWords };
        }
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            debug('📚 Cargando diccionario desde app/diccionario.json...', null, 'info');
            
            try {
                const response = await fetch('./app/diccionario.json', { 
                    cache: 'no-store'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: No se puede acceder a app/diccionario.json`);
                }

                const data = await response.json();
                
                if (!data || typeof data !== 'object') {
                    throw new Error('Formato de diccionario inválido (no es un objeto JSON válido)');
                }

                this.rawDictionary = data;
                this.categories = Object.keys(data).filter(k => {
                    const v = data[k];
                    return Array.isArray(v) || typeof v === 'object';
                });

                if (typeof wordEngine === 'undefined' || !wordEngine) {
                    throw new Error('WordEngine not available for dictionary injection');
                }

                wordEngine.processDictionary(data);
                debug('🔗 WordEngine initialized with diccionario.json', { entriesCount: Object.keys(wordEngine.dictionaryMap).length }, 'success');

                this.flattenedWords = this._flattenDictionary(data);
                this.isReady = true;

                debug('📚 Diccionario completamente cargado', { categorias: this.categories.length, palabras: this.flattenedWords.length }, 'success');
                return { rawDictionary: this.rawDictionary, flattenedWords: this.flattenedWords };

            } catch (error) {
                debug('❌ Error cargando diccionario: ' + error.message, null, 'error');
                throw error;
            }
        })();
        return this.loadPromise;
    }

    _flattenDictionary(data) {
        const words = [];
        
        Object.entries(data).forEach(([category, categoryContent]) => {
            if (!Array.isArray(categoryContent)) return;

            categoryContent.forEach(hintObj => {
                if (typeof hintObj !== 'object' || Array.isArray(hintObj)) return;

                Object.entries(hintObj).forEach(([hint, wordsArray]) => {
                    if (!Array.isArray(wordsArray)) return;

                    wordsArray.forEach(wordEntry => {
                        if (typeof wordEntry !== 'string' || wordEntry.length === 0) return;

                        if (wordEntry.includes('|')) {
                            const parts = wordEntry.split('|').map(p => p.trim()).filter(p => p.length > 0);
                            if (parts.length > 0) {
                                words.push(parts[0]);
                            }
                        } else {
                            words.push(wordEntry);
                        }
                    });
                });
            });
        });

        return [...new Set(words)];
    }

    getCategories() {
        if (!this.isReady) throw new Error('Llamar a load() primero');
        return [...this.categories];
    }

    getFlattenedWords() {
        if (!this.isReady) throw new Error('Llamar a load() primero');
        return [...this.flattenedWords];
    }

    getTotalWordCount() {
        if (!this.isReady) return 0;
        return this.flattenedWords.length;
    }

    async getRandomWord() {
        if (!this.isReady) await this.load();
        if (this.flattenedWords.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * this.flattenedWords.length);
        return this.flattenedWords[randomIndex];
    }
}

const dictionaryService = new DictionaryService();

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function isValidGameCode(code) {
    return code && /^[A-Z0-9]{3,6}$/.test(code);
}

function isValidPlayerName(name) {
    return name && name.length >= 2 && name.length <= 20;
}

function generatePlayerId() {
    return `player_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function renderAuraSelectors(container, auras, selectedHex, onSelect) {
    if (!container) return;

    container.innerHTML = '';
    auras.forEach(aura => {
        const button = document.createElement('button');
        button.className = 'aura-selector-btn';
        button.style.background = `linear-gradient(135deg, ${aura.gradient})`;
        
        if (aura.hex === selectedHex) {
            button.classList.add('selected');
        }

        button.addEventListener('click', () => {
            document.querySelectorAll('.aura-selector-btn.selected').forEach(b => {
                b.classList.remove('selected');
            });
            button.classList.add('selected');
            if (typeof onSelect === 'function') {
                onSelect(aura);
            }
        });

        container.appendChild(button);
    });
}

function renderAuraSelectorsEdit(container, selectedHex, onSelect) {
    if (typeof generateRandomAuras === 'function') {
        const auras = generateRandomAuras();
        renderAuraSelectors(container, auras, selectedHex, onSelect);
    } else {
        debug('⚠️  generateRandomAuras not available (aura-system.js not loaded)', null, 'warn');
    }
}

function applyColorGradient(colorString) {
    const root = document.documentElement;
    if (colorString && colorString.includes(',')) {
        const [c1, c2] = colorString.split(',').map(c => c.trim());
        root.style.setProperty('--player-gradient', `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`);
    }
}

function savePlayerColor(color) {
    StorageManager.set(StorageKeys.PLAYER_COLOR, color);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

debug('✅ shared-utils.js cargado exitosamente - ConfigService + DictionaryService + SessionManager centralizados', null, 'success');
