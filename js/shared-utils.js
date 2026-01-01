/**
 * @file shared-utils.js
 * @description Utilidades compartidas + SERVICIOS CENTRALIZADOS
 * 
 * 🔧 FASE 1: Centralización de dependencias
 * 🔧 FASE 2: SessionManager y beforeunload handling
 * 🔧 FASE 3A: DictionaryService category-aware methods
 * 🔧 FASE 3B: ModalController para gestión unificada de modales (DEFINED IN modal-controller.js)
 * 🔧 FASE 4: ConfigService race condition safeguards
 * 🔧 FASE 5: Cleanup, error handling fuerte, desacoplamiento WordEngine
 * 🔧 FASE 5-HOTFIX: CRITICAL - Remove race condition, restore fallbacks, fix dependencies
 * 🔧 FEATURE: Remove duplicate timeSync + hostSession/debug dependency fix
 * 🔧 FIX: Remove duplicate ModalController (defined in modal-controller.js)
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

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerDisplay(remainingMs, element, emoji = '⏳') {
    if (!element) return;
    if (remainingMs === null || remainingMs === undefined) {
        element.textContent = `${emoji}`;
        return;
    }
    const seconds = Math.ceil(remainingMs / 1000);
    element.textContent = `${emoji} ${formatTime(seconds)}`;
}

function getRemainingTime(startTime, duration) {
    const nowServer = typeof timeSync !== 'undefined' && timeSync.isCalibrated ? timeSync.getServerTime() : Date.now();
    const elapsed = nowServer - startTime;
    return Math.max(0, duration - elapsed);
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
// SESSION MANAGER
// ============================================================================

class SessionManager {
    constructor(role) {
        this.role = role;
        this.managers = [];  // 🔧 FASE 5: Track managers for cleanup
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
// WORD COMPARISON ENGINE
// ============================================================================

let wordEngine = null;

if (typeof WordEquivalenceEngine !== 'undefined' && !wordEngine) {
    wordEngine = new WordEquivalenceEngine();
    debug('✅ WordEngine instanciado inmediatamente en shared-utils.js', null, 'success');
}

if (typeof WordEquivalenceEngine === 'undefined') {
    class WordEquivalenceEngine {
        constructor() {
            this.dictionary = null;
            this.thesaurus = null;
            this.wordClassifications = null;
        }
        getCanonical(word) {
            return word ? word.toUpperCase().trim() : '';
        }
        getMatchType(word1, word2) {
            return word1.toUpperCase() === word2.toUpperCase() ? 'EXACTA' : null;
        }
        processDictionary(dict) {
            this.dictionary = dict;
        }
    }
    wordEngine = new WordEquivalenceEngine();
    debug('⚠️  STUB: WordEquivalenceEngine stub creado (word-comparison.js aún no cargó)', null, 'warn');
}

// ============================================================================
// DICTIONARY SERVICE
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
            try {
                debug('📚 Iniciando carga de diccionario...', null, 'info');
                
                const response = await fetch('./dictionary.json', { 
                    cache: 'no-store'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: No se puede acceder a dictionary.json`);
                }

                const data = await response.json();
                
                if (!data || typeof data !== 'object') {
                    throw new Error('Formato de diccionario inválido (no es un objeto JSON válido)');
                }

                const validCategories = Object.entries(data).filter(
                    ([k, v]) => Array.isArray(v) && v.length > 0
                );
                
                if (validCategories.length === 0) {
                    throw new Error('Diccionario vacío o sin categorías válidas');
                }

                this.dictionary = data;
                this.categories = validCategories.map(([k]) => k);
                this.isReady = true;

                if (typeof wordEngine !== 'undefined' && wordEngine && typeof wordEngine.processDictionary === 'function') {
                    wordEngine.processDictionary(data);
                    debug('🔗 WordEngine inicializado con diccionario', null, 'success');
                }

                debug('📚 Diccionario cargado exitosamente', { 
                    categories: this.categories.length,
                    totalWords: this.getTotalWordCount()
                }, 'success');

                return this.dictionary;
            } catch (error) {
                console.error("❌ Error cargando diccionario, usando valores por defecto", error);
                
                this.dictionary = {
                    'general': ['PALABRA', 'JUEGO', 'PALABRA'],
                    'animales': ['GATO', 'PERRO', 'PAJARO']
                };
                this.categories = ['general', 'animales'];
                this.isReady = true;
                this.loadPromise = null;
                
                debug('⚠️  Diccionario: usando fallback por defecto', null, 'warn');
                return this.dictionary;
            }
        })();

        return this.loadPromise;
    }

    getTotalWordCount() {
        if (!this.dictionary) return 0;
        return Object.values(this.dictionary).reduce((sum, words) => {
            return sum + (Array.isArray(words) ? words.length : 0);
        }, 0);
    }

    getCategories() {
        return [...this.categories];
    }

    getWordsForCategory(category) {
        if (!this.dictionary || !this.dictionary[category]) {
            return [];
        }
        const words = this.dictionary[category];
        return Array.isArray(words) ? [...words] : [];
    }

    getRandomWord() {
        if (!this.dictionary) return null;
        
        const categories = Object.keys(this.dictionary);
        if (categories.length === 0) return null;

        const randomCat = categories[Math.floor(Math.random() * categories.length)];
        const words = this.dictionary[randomCat];

        if (!Array.isArray(words) || words.length === 0) return null;

        return words[Math.floor(Math.random() * words.length)];
    }

    getRandomWordByCategory(category) {
        const words = this.getWordsForCategory(category);
        if (words.length === 0) return null;
        return words[Math.floor(Math.random() * words.length)];
    }
}

const dictionaryService = new DictionaryService();

// ============================================================================
// CONFIG SERVICE
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
            try {
                debug('⚙️  Cargando configuración...', null, 'info');
                
                const url = new URL('./app/actions.php', window.location.href);
                const response = await fetch(url.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_config' }),
                    cache: 'no-store'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: Error conectando con el servidor`);
                }

                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.message || 'Respuesta del servidor inválida');
                }

                if (!result.config || typeof result.config !== 'object') {
                    throw new Error('Configuración del servidor está vacía o mal formada');
                }

                const requiredFields = ['max_words_per_player', 'default_total_rounds', 'round_duration'];
                for (const field of requiredFields) {
                    if (!(field in result.config)) {
                        throw new Error(`Campo crítico faltante en config: ${field}`);
                    }
                }

                this.config = result.config;
                this.isReady = true;

                debug('⚙️  Configuración cargada exitosamente', this.config, 'success');
                return this.config;
            } catch (error) {
                console.error("❌ Error cargando configuración, usando valores por defecto", error);
                
                this.config = { 
                    max_words_per_player: 6, 
                    default_total_rounds: 3, 
                    round_duration: 60,
                    default_category: 'general'
                };
                this.isReady = true;
                this.loadPromise = null;
                
                debug('⚠️  Configuración: usando fallback por defecto', null, 'warn');
                return this.config;
            }
        })();

        return this.loadPromise;
    }

    get(key, defaultValue = null) {
        if (!this.config) {
            debug(`⚠️  ConfigService.get('${key}'): Config no está listo, usando default`, null, 'warn');
            return defaultValue;
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

function generateRandomAuras(count = 10) {
    const baseColors = [
        { name: 'Rojo', hex: '#FF0055' },
        { name: 'Azul', hex: '#0066FF' },
        { name: 'Verde', hex: '#00CC44' },
        { name: 'Morado', hex: '#9933FF' },
        { name: 'Naranja', hex: '#FF6600' },
        { name: 'Rosa', hex: '#FF3366' },
        { name: 'Turquesa', hex: '#00DDDD' },
        { name: 'Lima', hex: '#CCFF00' },
        { name: 'Indigo', hex: '#3300FF' },
        { name: 'Naranja Oscuro', hex: '#CC4400' }
    ];

    const auras = [];
    for (let i = 0; i < count && i < baseColors.length; i++) {
        const color1 = baseColors[i];
        const color2 = baseColors[(i + 1) % baseColors.length];
        auras.push({
            name: color1.name,
            hex: color1.hex,
            gradient: `${color1.hex},${color2.hex}`
        });
    }
    return auras;
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
    const auras = generateRandomAuras();
    renderAuraSelectors(container, auras, selectedHex, onSelect);
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
