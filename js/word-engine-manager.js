/**
 * @file word-engine-manager.js
 * @description WordEngineManager - Inicialización centralizada de WordEquivalenceEngine
 * Asegura comportamiento consistente en Host y Player
 * 
 * REFACTOR: Elimina 60 líneas de código similar pero diferente (timeout inconsistente)
 */

class WordEngineManager {
    constructor(timeoutMs = 3000) {
        this.engine = null;
        this.isReady = false;
        this.timeoutMs = timeoutMs;
        this.initPromise = null;
    }

    /**
     * Inicializa el engine (solo una vez)
     */
    async initialize(dictionaryPath = './js/sinonimos.json') {
        if (this.initPromise) {
            return this.initPromise;
        }

        if (this.isReady) {
            return Promise.resolve(this.engine);
        }

        this.initPromise = (async () => {
            try {
                if (typeof WordEquivalenceEngine !== 'function') {
                    throw new Error('WordEquivalenceEngine not loaded');
                }

                this.engine = new WordEquivalenceEngine();

                // Inicializar con timeout consistente
                await Promise.race([
                    this.engine.init(dictionaryPath),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('WordEngine init timeout')), this.timeoutMs)
                    )
                ]);

                this.isReady = true;
                debug('✅ Word engine initialized', null, 'success');
                console.log('%c✅ WordEngineManager ready with', 'color: #00AA00; font-weight: bold', 
                    Object.keys(this.engine.dictionaryMap || {}).length, 'words');
                return this.engine;
            } catch (error) {
                this.isReady = false;
                debug(`❌ Word engine init failed: ${error.message}`, null, 'error');
                console.error('%c❌ WordEngineManager failed', 'color: #AA0000; font-weight: bold', error.message);
                return null;
            } finally {
                this.initPromise = null;
            }
        })();

        return this.initPromise;
    }

    /**
     * Obtiene forma canónica de una palabra
     */
    getCanonical(word) {
        if (!this.engine || !this.isReady) {
            // Fallback simple
            const raw = (word || '').toString().trim();
            if (!raw) return '';
            
            return raw
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '');
        }

        return this.engine.getCanonical(word);
    }

    /**
     * Obtiene tipo de coincidencia
     */
    getMatchType(word1, word2) {
        if (!this.engine || !this.isReady) return null;
        return this.engine.getMatchType(word1, word2);
    }

    /**
     * Destruye el engine
     */
    destroy() {
        this.engine = null;
        this.isReady = false;
        this.initPromise = null;
        debug('🗑️ WordEngineManager destroyed', null, 'info');
    }
}

// Singleton global con timeout consistente de 3000ms
const wordEngineManager = new WordEngineManager(3000);

console.log('%c✅ word-engine-manager.js loaded', 'color: #A78BFA; font-weight: bold; font-size: 12px');
