/**
 * @file dictionary-service.js
 * @description DictionaryService - Servicio centralizado del diccionario
 * Maneja: carga, caché, extracción, generación de códigos
 * 
 * REFACTOR: Elimina 100 líneas de código duplicado (create-game-modal + shared-utils)
 */

class DictionaryService {
    constructor() {
        this.cache = {
            rawData: null,
            allWords: null,
            categories: null
        };
        this.loadPromise = null;
    }

    /**
     * Carga el diccionario (con caché)
     */
    async loadDictionary() {
        if (this.cache.rawData) {
            return this.cache.rawData;
        }

        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = (async () => {
            try {
                const response = await fetch('/app/diccionario.json', { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                this.cache.rawData = await response.json();
                this.cache.allWords = this.extractWordsFromDictionary(this.cache.rawData);
                this.cache.categories = Object.keys(this.cache.rawData || {});

                debug(`📚 Dictionary loaded: ${this.cache.allWords.length} words`, null, 'success');
                return this.cache.rawData;
            } catch (error) {
                debug('Error loading dictionary, using fallback', error, 'warn');
                this.cache.rawData = {};
                this.cache.allWords = ['SOL', 'LUNA', 'CASA', 'MESA', 'GATO', 'PERRO'];
                this.cache.categories = [];
                return this.cache.rawData;
            } finally {
                this.loadPromise = null;
            }
        })();

        return this.loadPromise;
    }

    /**
     * Extrae todas las palabras del diccionario jerárquico
     */
    extractWordsFromDictionary(data) {
        const raw = [];

        const walk = (node) => {
            if (!node) return;

            if (Array.isArray(node)) {
                node.forEach(walk);
                return;
            }

            const t = typeof node;
            if (t === 'string') {
                raw.push(node);
                return;
            }

            if (t === 'object') {
                Object.values(node).forEach(walk);
            }
        };

        walk(data);

        const out = [];
        const seen = new Set();

        raw.forEach(str => {
            if (typeof str !== 'string') return;

            // Separar sinónimos: "Bar|Barrio" -> ["Bar", "Barrio"]
            str.split('|').forEach(part => {
                const normalized = this.normalizeWordForCode(part);
                if (!normalized) return;

                if (!seen.has(normalized)) {
                    seen.add(normalized);
                    out.push(normalized);
                }
            });
        });

        return out;
    }

    /**
     * Normaliza palabra para código de sala
     */
    normalizeWordForCode(input) {
        if (input === null || input === undefined) return '';

        let w = String(input).trim().toUpperCase();

        // Remover diacríticos
        if (typeof w.normalize === 'function') {
            w = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }

        // Quitar espacios y caracteres no seguros
        w = w.replace(/\s+/g, '');
        w = w.replace(/[^A-Z0-9]/g, '');

        return w;
    }

    /**
     * Obtiene todas las palabras del diccionario
     */
    async getAllWords() {
        if (this.cache.allWords) {
            return this.cache.allWords;
        }

        await this.loadDictionary();
        return this.cache.allWords || [];
    }

    /**
     * Obtiene categorías disponibles
     */
    async getCategories() {
        if (this.cache.categories) {
            return this.cache.categories;
        }

        await this.loadDictionary();
        return this.cache.categories || [];
    }

    /**
     * Obtiene palabras de una categoría específica
     */
    async getWordsForCategory(categoryName) {
        if (!categoryName) {
            return this.getAllWords();
        }

        await this.loadDictionary();
        const categoryNode = this.cache.rawData?.[categoryName];

        if (!categoryNode) {
            debug(`⚠️ Category ${categoryName} not found`, null, 'warn');
            return this.getAllWords();
        }

        return this.extractWordsFromDictionary(categoryNode);
    }

    /**
     * Filtra palabras por longitud
     */
    filterWordsByLength(words, minLength, maxLength) {
        if (!Array.isArray(words)) return [];

        return words.filter(word => {
            const len = word.length;
            return len >= minLength && len <= maxLength;
        });
    }

    /**
     * Genera un código aleatorio para sala
     * @param {string} categoryName - Categoría (null para cualquiera)
     * @param {number} minLength - Longitud mínima
     * @param {number} maxLength - Longitud máxima
     */
    async generateGameCode(categoryName = null, minLength = 3, maxLength = 5) {
        try {
            const words = categoryName 
                ? await this.getWordsForCategory(categoryName)
                : await this.getAllWords();

            const validWords = this.filterWordsByLength(words, minLength, maxLength);

            if (!validWords.length) {
                debug('⚠️ No valid words, using random letters', null, 'warn');
                return this.generateRandomLetterCode(4);
            }

            const randomIndex = Math.floor(Math.random() * validWords.length);
            const code = validWords[randomIndex];

            debug(`✅ Game code generated: ${code}`, null, 'success');
            return code;
        } catch (error) {
            debug('Error generating game code', error, 'error');
            return this.generateRandomLetterCode(4);
        }
    }

    /**
     * Fallback: genera código con letras aleatorias
     */
    generateRandomLetterCode(length = 4) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        debug(`⚠️ Random code generated: ${code}`, null, 'warn');
        return code;
    }

    /**
     * Obtiene una palabra aleatoria (útil para UI)
     */
    async getRandomWord(categoryName = null) {
        const words = categoryName
            ? await this.getWordsForCategory(categoryName)
            : await this.getAllWords();

        if (!words.length) return 'PALABRA';

        return words[Math.floor(Math.random() * words.length)];
    }
}

// Singleton global
const dictionaryService = new DictionaryService();

console.log('%c✅ dictionary-service.js loaded', 'color: #F59E0B; font-weight: bold; font-size: 12px');
