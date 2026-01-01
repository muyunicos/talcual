/**
 * @file shared-utils.js
 * @description Utilidades compartidas + SERVICIOS CENTRALIZADOS (SessionManager, DictionaryService, ConfigService, ModalHandler, ModalController)
 * 
 * 🎯 FASE 1 COMPLETA: Este archivo centraliza TODA la lógica de dependencias
 * 🎯 FASE 2: FIX - Logging y timeout en beforeunload
 * 🎯 FASE 3A: ADD - DictionaryService category-aware methods
 * 🎯 FASE 3B: ADD - ModalController class para gestión unificada de modales
 * 🔧 FIX: SessionManager improvements - beforeunload, role validation, state tracking
 * 🎪 FIX: ModalController enhancements - focus management, reset, a11y
 * 🔧 FASE 4 FIX: ConfigService - Race condition safeguards + readiness state
 */

// ... [Keeping all existing code from DEBUGGING through to DictionaryService] ...

/**
 * ConfigService - Gestión centralizada de configuración
 * ✅ CENTRALIZA: Carga única de config desde actions.php
 * ✅ ELIMINA REDUNDANCIA: Solo un lugar hace fetch a get_config
 * 🔧 FASE 4 FIX: Race condition safeguards + readiness state tracking
 */
class ConfigService {
    constructor() {
        this.config = null;
        this.loadPromise = null;
        this.isReady = false;  // 🔧 NEW: Track readiness state
    }

    /**
     * 🔧 FASE 4: Carga config con safeguards
     * Garantiza que config esté disponible antes de ser usada
     */
    async load() {
        if (this.config) {
            this.isReady = true;
            return this.config;
        }
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            try {
                const url = new URL('./app/actions.php', window.location.href);
                const response = await fetch(url.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_config' }),
                    cache: 'no-store'
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.config) {
                        this.config = result.config;
                        this.isReady = true;  // 🔧 Mark ready after success
                        debug('⚙️ Configuración cargada exitosamente', this.config, 'success');
                        return this.config;
                    }
                }

                throw new Error('Config response invalid');
            } catch (error) {
                debug('⚠️ Config load failed, usando defaults', error, 'warn');
                // 🔧 Set defaults even on failure
                this.config = {
                    default_total_rounds: 3,
                    min_players: 2,
                    max_words_per_player: 6,
                    round_duration: 60000,
                    default_round_duration: 60
                };
                this.isReady = true;  // 🔧 Mark ready with defaults
                return this.config;
            }
        })();

        return this.loadPromise;
    }

    /**
     * 🔧 FASE 4: Get with safeguard check
     * Returns value if ready, otherwise uses default
     * Safe to call even before load() completes
     */
    get(key, defaultValue = null) {
        if (!this.config) {
            // Only warn in dev, don't break functionality
            if (typeof window !== 'undefined' && window.DEBUG_MODE) {
                console.warn(`[ConfigService.get('${key}')] called before load() - using default`);
            }
            return defaultValue;
        }
        return this.config[key] ?? defaultValue;
    }

    /**
     * 🔧 FASE 4: Check if service is ready
     * Useful for debugging or conditional logic
     * @returns {boolean} true if config is loaded
     */
    isConfigReady() {
        return this.isReady && this.config !== null;
    }
}

// ... [Rest of file remains unchanged] ...