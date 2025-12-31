/**
 * Word Comparison Engine V7 - Género, Plural, Sinónimos + Fallback Local
 * 
 * Cambios:
 * - Extender getStem() para manejar más plurales (CIÓN->CIÓN, diminutivos)
 * - Agregar areEquivalentLocally() fallback para cuando diccionario no está cargado
 * - Mejorar getCanonical() con stemming local
 * - Agregar debug granular para diagnosticar por qué dos palabras sí/no se comparan
 */

class WordEquivalenceEngine {
    constructor() {
        this.dictionaryMap = {};
        // Aquí guardaremos las palabras que NO deben perder su vocal final
        this.strictGenderSet = new Set();
        this.isLoaded = false;
        this.debugMode = false;  // Para auditar comparaciones
    }

    async init(jsonUrl = '/js/sinonimos.json') {
        try {
            const response = await fetch(jsonUrl);
            if (!response.ok) throw new Error('Error cargando JSON');
            const data = await response.json();
            this.processDictionary(data);
            this.isLoaded = true;
            console.log('✅ Motor listo. Palabras estrictas protegidas:', this.strictGenderSet.size, 'Entradas en diccionario:', Object.keys(this.dictionaryMap).length);
        } catch (error) {
            console.error('⚠️ Error cargando diccionario en WordEquivalenceEngine:', error);
            this.isLoaded = false;
        }
    }

    processDictionary(data) {
        if (!Array.isArray(data)) return;

        data.forEach(group => {
            if (!Array.isArray(group) || group.length === 0) return;

            // Procesamos la primera palabra para saber si es el ID canónico
            let canonicalRaw = group[0];

            // Si la canónica tiene punto, la limpiamos para usarla de ID
            if (canonicalRaw.endsWith('.')) {
                canonicalRaw = canonicalRaw.slice(0, -1);
            }

            group.forEach(word => {
                let cleanWord = word;
                let isStrict = false;

                // 1. DETECTAR EL PUNTO (.)
                if (cleanWord.endsWith('.')) {
                    isStrict = true;
                    cleanWord = cleanWord.slice(0, -1); // Quitamos el punto
                }

                const norm = this.normalize(cleanWord);
                if (!norm) return;

                // 2. GUARDAR EN LA LISTA DE PROTECCIÓN
                if (isStrict) {
                    this.strictGenderSet.add(norm);
                }

                // 3. MAPEAR
                this.dictionaryMap[norm] = canonicalRaw;

                // Mapeamos también la raíz para búsquedas flexibles
                // OJO: Al generar el stem inicial, respetamos si es estricta o no
                const stem = this.getStem(norm);
                if (stem !== norm) {
                    if (!this.dictionaryMap[stem]) {
                        this.dictionaryMap[stem] = canonicalRaw;
                    }
                }
            });
        });
    }

    normalize(word) {
        if (!word) return '';
        return word
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, ''); // Borra puntos y simbolos del INPUT del usuario
    }

    /**
     * Obtiene la raíz, respetando palabras protegidas (con punto).
     * Maneja: plurales, diminutivos, género.
     */
    getStem(word) {
        let stem = word;

        // 1. Limpieza de Plurales en -CIÓN (ACCIONES -> ACCIÓN)
        if (stem.endsWith('CION')) {
            stem = stem.slice(0, -2); // ACCIÓN -> ACCIÓN (sin cambio intencional, respeta ó)
        }
        // Plurales generales (S, ES)
        else if (stem.endsWith('CES')) {
            stem = stem.slice(0, -3) + 'Z'; // VOCES -> VOZ
        }
        else if (stem.endsWith('ES') && stem.length > 4) {
            // Plural compuesto (RESTAURANTE + S = RESTAURANTES)
            const base = stem.slice(0, -2);
            // Solo si el base termina en consonante o vocal que típicamente agrega -ES
            if (!base.match(/[AEIOU]$/)) {
                stem = base;
            }
        }
        else if (stem.endsWith('S') && stem.length > 3) {
            // Plural simple (PENA -> PENAS)
            stem = stem.slice(0, -1);
        }

        // 2. Limpieza de Diminutivos (Gatito -> Gat, Gatita -> Gat)
        stem = stem.replace(/(C)?IT[AO]$/, '');
        stem = stem.replace(/[AO]CH[AO]$/, ''); // Muchach@
        stem = stem.replace(/[AO]LL[AO]$/, ''); // Vaquill@

        // --- LA MAGIA DEL PUNTO ---
        // Antes de cortar la vocal final (Género), chequeamos si esta palabra
        // está en la lista de "strictGenderSet" (la que cargamos con puntos).
        if (this.strictGenderSet.has(stem)) {
            // ¡ALTO! Es una palabra protegida (ej: PENA.)
            // Devolvemos "PENA" tal cual, sin cortar la A.
            return stem;
        }

        // 3. Limpieza de Vocal Final de Género (Solo si NO es estricta)
        // LOCA -> LOC, LOCO -> LOC
        // BEBE -> BEB
        if (stem.length > 2) {
            const last = stem.slice(-1);
            if (['A', 'E', 'O'].includes(last)) {
                stem = stem.slice(0, -1);
            }
        }
        return stem;
    }

    /**
     * Comparación LOCAL: Sin diccionario, solo por raíces derivadas.
     * Útil cuando el diccionario aún no ha cargado.
     */
    areEquivalentLocally(word1, word2) {
        const n1 = this.normalize(word1);
        const n2 = this.normalize(word2);

        if (!n1 || !n2) return false;
        if (n1 === n2) return true;

        const root1 = this.getStem(n1);
        const root2 = this.getStem(n2);

        if (root1 && root2 && root1 === root2 && root1.length > 2) {
            if (this.debugMode) {
                console.log(`✅ areEquivalentLocally("${word1}", "${word2}"): ${n1} vs ${n2} -> stem "${root1}" === "${root2}"`);
            }
            return true;
        }

        if (this.debugMode && root1.length > 2 && root2.length > 2) {
            console.log(`❌ areEquivalentLocally("${word1}", "${word2}"): stems no coinciden "${root1}" !== "${root2}"`);
        }

        return false;
    }

    /**
     * Devuelve una clave canónica para agrupar resultados.
     * Si está en el diccionario (exacto o por stem), devuelve el ID canónico.
     * Si no está, devuelve la palabra con su raíz (normalizada).
     */
    getCanonical(word) {
        const n = this.normalize(word);
        if (!n) return '';

        // Búsqueda 1: Exacta en diccionario
        let id = this.dictionaryMap[n];
        if (id) return this.normalize(id);

        // Búsqueda 2: Por stem en diccionario
        const stem = this.getStem(n);
        id = this.dictionaryMap[stem];
        if (id) return this.normalize(id);

        // Fallback 3: Si no está en diccionario, devolver la raíz
        // Esto asegura que BEBE, BEBES, BEBÉ todos mapeen a "BEB"
        return stem.length > 0 ? stem : n;
    }

    /**
     * Comparación completa: Usa diccionario si está listo, sino usa fallback local.
     */
    areEquivalent(word1, word2) {
        const n1 = this.normalize(word1);
        const n2 = this.normalize(word2);

        if (!n1 || !n2) return false;
        if (n1 === n2) return true;

        // Si el diccionario está cargado, usarlo
        if (this.isLoaded && Object.keys(this.dictionaryMap).length > 0) {
            // Búsqueda Inteligente (Dict -> Stem)
            let id1 = this.dictionaryMap[n1];
            let id2 = this.dictionaryMap[n2];

            // Si no está exacto, buscamos por su Stem
            if (!id1) id1 = this.dictionaryMap[this.getStem(n1)];
            if (!id2) id2 = this.dictionaryMap[this.getStem(n2)];

            if (id1 && id2 && id1 === id2) {
                if (this.debugMode) console.log(`✅ areEquivalent (dict): "${word1}" == "${word2}" (por diccionario)`);
                return true;
            }

            // Comparación manual de raíces
            const root1 = this.getStem(n1);
            const root2 = this.getStem(n2);

            // Cruce Dict vs Raíz
            if (id1) {
                const dictRoot = this.getStem(this.normalize(id1));
                if (dictRoot === root2) {
                    if (this.debugMode) console.log(`✅ areEquivalent (dict-stem): "${word1}" == "${word2}" (dict stem match)`);
                    return true;
                }
            }
            if (id2) {
                const dictRoot = this.getStem(this.normalize(id2));
                if (dictRoot === root1) {
                    if (this.debugMode) console.log(`✅ areEquivalent (dict-stem): "${word1}" == "${word2}" (dict stem match)`);
                    return true;
                }
            }

            // Comparación Final de raíces
            if (root1 === root2 && root1.length > 2) {
                if (this.debugMode) console.log(`✅ areEquivalent (root): "${word1}" == "${word2}" (roots "${root1}" == "${root2}")`);
                return true;
            }
        } else {
            // Fallback: Sin diccionario, usar comparación local
            if (this.debugMode) console.log(`⚠️  Diccionario no cargado, usando fallback local para "${word1}" vs "${word2}"`);
            return this.areEquivalentLocally(word1, word2);
        }

        if (this.debugMode) {
            const root1 = this.getStem(n1);
            const root2 = this.getStem(n2);
            console.log(`❌ areEquivalent: "${word1}" != "${word2}" (stems: "${root1}" != "${root2}")`);
        }

        return false;
    }

    /**
     * Habilitar logs de auditoría para debugging.
     */
    enableDebug() {
        this.debugMode = true;
        console.log('%c🔧 Word Equivalence Engine en modo DEBUG', 'color: #FF6600; font-weight: bold');
    }

    disableDebug() {
        this.debugMode = false;
    }
}
