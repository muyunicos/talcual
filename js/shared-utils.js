/**
 * @file shared-utils.js
 * @description Centralización de servicios y utilidades compartidas
 * 
 * 🔧 PHASE 2 (REVISED):
 * - REMOVED: WordEquivalenceEngine stub (fail-fast if word-comparison.js missing)
 * - NEW: GameTimer utility centralized
 * - DictionaryService injects data via processDictionary()
 * - Pipe delimiters handled by WordEngine
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
// GAME TIMER UTILITY - CENTRALIZED (NEW)
// ============================================================================

const GameTimer = {
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    getRemainingTime(startTime, duration) {
        const nowServer = typeof timeSync !== 'undefined' && timeSync.isCalibrated ? timeSync.getServerTime() : Date.now();
        const elapsed = nowServer - startTime;
        return Math.max(0, duration - elapsed);
    },

    updateTimerDisplay(remainingMs, element, emoji = '⏳') {
        if (!element) return;
        if (remainingMs === null || remainingMs === undefined) {
            element.textContent = `${emoji}`;
            return;
        }
        const seconds = Math.ceil(remainingMs / 1000);
        element.textContent = `${emoji} ${this.formatTime(seconds)}`;
    }
};

function formatTime(seconds) {
    return GameTimer.formatTime(seconds);
}

function updateTimerDisplay(remainingMs, element, emoji = '⏳') {
    return GameTimer.updateTimerDisplay(remainingMs, element, emoji);
}

function getRemainingTime(startTime, duration) {
    return GameTimer.getRemainingTime(startTime, duration);
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
        debug('🧹 Limpiando sesión...', null, 'info');
        
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
// WORD EQUIVALENCE ENGINE - ASSUMED TO BE LOADED (FAIL-FAST)
// ============================================================================

let wordEngine = null;

if (typeof WordEquivalenceEngine === 'undefined') {
    console.error('❌ CRITICAL: WordEquivalenceEngine class not found. Check word-comparison.js loading order');
    throw new Error('WordEquivalenceEngine not loaded - word-comparison.js must be included before shared-utils.js');
} else {
    wordEngine = new WordEquivalenceEngine();
    debug('✅ WordEngine instantiated from word-comparison.js', null, 'success');
}

// ============================================================================
// DICTIONARY SERVICE - SINGLE SOURCE OF TRUTH
// ============================================================================

class DictionaryService {
    constructor() {
        this.dictionary = null;
        this.categories = [];
        this.loadPromise = null;
        this.isReady = false;
    }

    async initialize() {
        if (this.isReady) return this.dictionary;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            debug('📚 Iniciando carga de diccionario...', null, 'info');
            
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

            this.dictionary = data;
            this.categories = Object.keys(data).filter(k => Array.isArray(data[k]) || typeof data[k] === 'object');
            this.isReady = true;

            if (typeof wordEngine !== 'undefined' && wordEngine && typeof wordEngine.processDictionary === 'function') {
                wordEngine.processDictionary(data);
                debug('🔗 WordEngine initialized with diccionario.json data', { entriesCount: Object.keys(wordEngine.dictionaryMap).length }, 'success');
            } else {
                debug('❌ WordEngine not available for dictionary injection', null, 'error');
                throw new Error('WordEngine not ready for data injection');
            }

            debug('📚 Diccionario cargado exitosamente', { 
                categories: this.categories.length,
                totalWords: this.getTotalWordCount()
            }, 'success');

            return this.dictionary;
        })();

        return this.loadPromise;
    }

    getTotalWordCount() {
        if (!this.dictionary) return 0;
        let count = 0;
        
        Object.values(this.dictionary).forEach(categoryContent => {
            if (Array.isArray(categoryContent)) {
                categoryContent.forEach(hintObj => {
                    if (typeof hintObj === 'object' && !Array.isArray(hintObj)) {
                        Object.values(hintObj).forEach(wordsArray => {
                            if (Array.isArray(wordsArray)) {
                                count += wordsArray.length;
                            }
                        });
                    }
                });
            }
        });
        
        return count;
    }

    getCategories() {
        return [...this.categories];
    }

    getWordsForCategory(category) {
        if (!this.dictionary || !this.dictionary[category]) {
            return [];
        }
        
        const categoryContent = this.dictionary[category];
        const words = [];
        
        if (Array.isArray(categoryContent)) {
            categoryContent.forEach(hintObj => {
                if (typeof hintObj === 'object' && !Array.isArray(hintObj)) {
                    Object.values(hintObj).forEach(wordsArray => {
                        if (Array.isArray(wordsArray)) {
                            words.push(...wordsArray);
                        }
                    });
                }
            });
        }
        
        return words;
    }

    getRandomWord() {
        if (!this.dictionary) return null;
        
        const categories = this.getCategories();
        if (categories.length === 0) return null;

        const randomCat = categories[Math.floor(Math.random() * categories.length)];
        const words = this.getWordsForCategory(randomCat);

        if (words.length === 0) return null;

        const randomWord = words[Math.floor(Math.random() * words.length)];
        
        if (typeof randomWord !== 'string') {
            debug(`⚠️  Invalid type in getRandomWord from ${randomCat}:`, typeof randomWord, 'warn');
            return null;
        }

        return randomWord;
    }

    getRandomWordByCategory(category, maxLength = null) {
        const words = this.getWordsForCategory(category);
        if (words.length === 0) return null;
        
        let availableWords = words;
        
        if (maxLength !== null && maxLength > 0) {
            availableWords = words.filter(word => typeof word === 'string' && word.length <= maxLength);
            if (availableWords.length === 0) {
                debug(`⚠️  No words in "${category}" with length ≤ ${maxLength}`, null, 'warn');
                return null;
            }
        }
        
        const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
        
        if (typeof randomWord !== 'string') {
            debug(`⚠️  Invalid type in getRandomWordByCategory(${category}):`, typeof randomWord, 'warn');
            return null;
        }

        return randomWord;
    }
}

const dictionaryService = new DictionaryService();

// ============================================================================
// CONFIG SERVICE - NO FALLBACKS
// ============================================================================

class ConfigService {
    constructor() {
        this.config = null;
        this.loadPromise = null;
        this.isReady = false;
    }

    async load() {
        if (this.config) {
            this.isReady = true;
            return this.config;
        }
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            debug('⚙️  Cargando configuración...', null, 'info');
            
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
        })();

        return this.loadPromise;
    }

    get(key, defaultValue = null) {
        if (!this.config) {
            throw new Error(`ConfigService.get('${key}'): Config not ready`);
        }
        return this.config[key] ?? defaultValue;
    }

    isConfigReady() {
        return this.isReady && this.config !== null;
    }
}

const configService = new ConfigService();

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function isValidGameCode(code) {
    return code && /^[A-Z0-9]{4,5}$/.test(code);
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

debug('✅ shared-utils.js cargado exitosamente - servicios centralizados listos', null, 'success');
