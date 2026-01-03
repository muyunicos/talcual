/**
 * @file shared-utils.js
 * @description Centralization of services and shared utilities
 * 
 * 🔧 SERVER-SIDE FIRST (Phase 4-REFINED):
 * - FIXED: wordEngine injection via getDictionaryForRound() with proper structure
 * - NEW: Shim methods for HostManager compatibility (getCategories, getRandomWordByCategory)
 * - NEW: load() method for backward compatibility with HostManager
 * - Shim methods extract data from gameCandidates (server-fetched codes)
 * - WordEngine initialized on-demand when getDictionaryForRound() is called
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
// WORD NORMALIZATION - UNIFIED ALGORITHM
// ============================================================================

function normalizeWord(rawWord) {
    if (!rawWord || typeof rawWord !== 'string') {
        return '';
    }
    
    let word = rawWord.trim();
    
    if (word.includes('|')) {
        const parts = word.split('|').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length > 0) {
            word = parts[0];
        }
    }
    
    word = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    word = word.toUpperCase();
    word = word.replace(/[^A-Z0-9]/g, '');
    
    return word;
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
        debug('📦 Sesión host guardada', { gameCode, category }, 'success');
    }

    savePlayerSession(gameId, playerId, playerName, playerColor) {
        StorageManager.set(StorageKeys.GAME_ID, gameId);
        StorageManager.set(StorageKeys.PLAYER_ID, playerId);
        StorageManager.set(StorageKeys.PLAYER_NAME, playerName);
        StorageManager.set(StorageKeys.PLAYER_COLOR, playerColor);
        StorageManager.set(StorageKeys.IS_HOST, 'false');
        debug('📦 Sesión player guardada', { gameId, playerId, playerName }, 'success');
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
// DICTIONARY SERVICE - SERVER-SIDE FIRST WITH SHIMMED METHODS FOR HostManager
// ============================================================================

class DictionaryService {
    constructor() {
        this.gameCandidates = [];
        this.isReady = false;
        this.loadPromise = null;
        this.wordEngineInitialized = false;
    }

    async load() {
        if (this.isReady) {
            return { rawDictionary: {}, flattenedWords: [] };
        }
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            debug('🎯 Cargando candidatos de c\u00f3digos del servidor...', null, 'info');
            
            try {
                const url = new URL('./app/actions.php', window.location.href);
                const response = await fetch(url.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_game_candidates' }),
                    cache: 'no-store'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: Error obteniendo candidatos`);
                }

                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.message || 'Error fetching candidates');
                }

                if (!Array.isArray(result.candidates) || result.candidates.length === 0) {
                    throw new Error('No candidates returned from server');
                }

                this.gameCandidates = result.candidates;
                this.isReady = true;
                this.wordEngineInitialized = false;

                debug('🎯 Candidatos cargados exitosamente', { count: this.gameCandidates.length }, 'success');
                return { rawDictionary: {}, flattenedWords: [] };

            } catch (error) {
                debug('❌ Error obteniendo candidatos: ' + error.message, null, 'error');
                throw error;
            }
        })();

        return this.loadPromise;
    }

    async initialize() {
        return this.load();
    }

    getCategories() {
        if (!this.isReady || this.gameCandidates.length === 0) {
            debug('⚠️  SHIM: getCategories() called before load() - returning empty', null, 'warn');
            return [];
        }

        const categories = new Set();
        this.gameCandidates.forEach(c => categories.add(c.category));
        return Array.from(categories).sort();
    }

    getRandomWordByCategory(category, maxLength = null) {
        if (!this.isReady || this.gameCandidates.length === 0) {
            debug('⚠️  SHIM: getRandomWordByCategory() called before load()', null, 'warn');
            return null;
        }

        const matching = this.gameCandidates.filter(c => 
            c.category === category && 
            (!maxLength || c.code.length <= maxLength)
        );

        if (matching.length === 0) {
            return null;
        }

        const randomIndex = Math.floor(Math.random() * matching.length);
        return matching[randomIndex].code;
    }

    getRandomCandidate() {
        if (this.gameCandidates.length === 0) {
            throw new Error('No candidates loaded - call load() first');
        }
        const randomIndex = Math.floor(Math.random() * this.gameCandidates.length);
        return { ...this.gameCandidates[randomIndex] };
    }

    async fetchGameCandidates() {
        if (this.gameCandidates.length > 0) {
            return [...this.gameCandidates];
        }
        
        await this.load();
        return [...this.gameCandidates];
    }

    getCandidatesByCategory(category) {
        return this.gameCandidates.filter(c => c.category === category);
    }

    getDictionaryForRound(roundContext) {
        if (!roundContext || typeof roundContext !== 'object') {
            debug('⚠️  roundContext inv\u00e1lido, limpiando WordEngine', null, 'warn');
            if (wordEngine && typeof wordEngine.reset === 'function') {
                wordEngine.reset();
            }
            this.wordEngineInitialized = false;
            return;
        }

        const { prompt, synonyms, variants } = roundContext;
        
        if (!prompt) {
            debug('⚠️  roundContext.prompt faltante, limpiando WordEngine', null, 'warn');
            if (wordEngine && typeof wordEngine.reset === 'function') {
                wordEngine.reset();
            }
            this.wordEngineInitialized = false;
            return;
        }

        const normalizedPrompt = normalizeWord(prompt);
        const normalizedSynonyms = (synonyms || []).map(w => normalizeWord(w)).filter(w => w.length > 0);
        const normalizedVariants = (variants || []).map(w => normalizeWord(w)).filter(w => w.length > 0);

        const allWords = [normalizedPrompt, ...normalizedSynonyms, ...normalizedVariants];
        const uniqueWords = [...new Set(allWords)];

        const miniDictionary = {
            'PROMPT': uniqueWords
        };

        if (wordEngine && typeof wordEngine.processDictionary === 'function') {
            wordEngine.processDictionary(miniDictionary);
            this.wordEngineInitialized = true;
            debug('🔗 WordEngine inicializado con mini-diccionario de ronda', { prompt: normalizedPrompt, wordsCount: uniqueWords.length }, 'success');
        } else {
            debug('⚠️  WordEngine no tiene m\u00e9todo processDictionary', null, 'warn');
        }
    }
}

const dictionaryService = new DictionaryService();

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function isValidGameCode(code) {
    return code && /^[A-Z0-9]{3,5}$/.test(code);
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

debug('✅ shared-utils.js - Server-Side First: FIXED wordEngine injection + SHIMMED HostManager methods', null, 'success');
