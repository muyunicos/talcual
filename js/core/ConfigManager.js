class ConfigManager {
    constructor() {
        this.defaultConfig = {};
        this.config = {};
        this.listeners = [];
        this._initialized = false;
        this._initPromise = null;
    }

    async initialize() {
        if (this._initialized) return true;
        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            try {
                const success = await this.loadDefaults();
                if (success) {
                    this.config = { ...this.defaultConfig };
                    debug('[CONFIG] Initialized with defaults', null, 'success');
                    this._initialized = true;
                    return true;
                }
                return false;
            } catch (error) {
                debug('[CONFIG] Error initializing', error, 'error');
                return false;
            }
        })();

        return this._initPromise;
    }

    async loadDefaults() {
        try {
            const response = await fetch('/app/actions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_config' })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const text = await response.text();
            if (!text) {
                throw new Error('Empty response');
            }

            const data = JSON.parse(text);
            if (data.success && data.config) {
                this.defaultConfig = { ...data.config };
                debug('[CONFIG] Loaded defaults from server', null, 'debug');
                return true;
            }

            return false;
        } catch (error) {
            debug('[CONFIG] Failed to load defaults, using fallback', error, 'warn');
            this.defaultConfig = this.getFallbackDefaults();
            return true;
        }
    }

    getFallbackDefaults() {
        return {
            dev_mode: false,
            min_players: 3,
            max_players: 20,
            round_duration: 90,
            total_rounds: 5,
            start_countdown: 5,
            hurry_up_threshold: 10,
            max_words_per_player: 6,
            max_word_length: 30,
            max_code_length: 6,
            max_game_age: 86400,
            cleanup_probability: 0.05,
            sse_timeout: 900,
            sse_heartbeat_interval: 15,
            max_category_length: 50
        };
    }

    syncFromGameState(gameState) {
        if (!gameState || typeof gameState !== 'object') return;

        const mapping = {
            'round_duration': 'round_duration',
            'total_rounds': 'total_rounds',
            'min_players': 'min_players',
            'max_players': 'max_players',
            'countdown_duration': 'start_countdown',
            'hurry_up_threshold': 'hurry_up_threshold',
            'max_words_per_player': 'max_words_per_player',
            'max_word_length': 'max_word_length'
        };

        for (const [stateKey, configKey] of Object.entries(mapping)) {
            if (gameState[stateKey] !== undefined) {
                this.config[configKey] = gameState[stateKey];
            }
        }

        debug('[CONFIG] Synced from game state', null, 'debug');
        this.notifyListeners();
    }

    syncFromObject(obj) {
        if (!obj || typeof obj !== 'object') return;

        Object.keys(obj).forEach(key => {
            if (this.config.hasOwnProperty(key)) {
                this.config[key] = obj[key];
            }
        });

        debug('[CONFIG] Synced from object', null, 'debug');
        this.notifyListeners();
    }

    get(key, fallback = null) {
        if (this.config.hasOwnProperty(key)) {
            return this.config[key];
        }
        return fallback;
    }

    getDefault(key, fallback = null) {
        if (this.defaultConfig.hasOwnProperty(key)) {
            return this.defaultConfig[key];
        }
        return fallback;
    }

    set(key, value) {
        if (this.config.hasOwnProperty(key)) {
            this.config[key] = value;
            this.notifyListeners();
        }
    }

    resetToDefault(key) {
        if (this.defaultConfig.hasOwnProperty(key)) {
            this.config[key] = this.defaultConfig[key];
            this.notifyListeners();
        }
    }

    resetAll() {
        this.config = { ...this.defaultConfig };
        this.notifyListeners();
    }

    subscribe(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    unsubscribe(callback) {
        this.listeners = this.listeners.filter(cb => cb !== callback);
    }

    notifyListeners() {
        this.listeners.forEach(cb => {
            try {
                cb(this.config);
            } catch (error) {
                console.error('Error in config listener:', error);
            }
        });
    }

    getAll() {
        return { ...this.config };
    }

    getAllDefaults() {
        return { ...this.defaultConfig };
    }

    isInitialized() {
        return this._initialized;
    }
}

const configManager = new ConfigManager();

document.addEventListener('DOMContentLoaded', async () => {
    await configManager.initialize();
}, { once: true });

console.log('%c✅ ConfigManager.js', 'color: #FF8800; font-weight: bold; font-size: 12px');
