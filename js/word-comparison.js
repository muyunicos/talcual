/**
 * Word Comparison Engine V6 - Soporte de Género Estricto (.)
 */

class WordEquivalenceEngine {
    constructor() {
        this.dictionaryMap = {};
        // Aquí guardaremos las palabras que NO deben perder su vocal final
        this.strictGenderSet = new Set(); 
        this.isLoaded = false;
    }

    async init(jsonUrl = 'sinonimos.json') {
        try {
            const response = await fetch(jsonUrl);
            if (!response.ok) throw new Error("Error cargando JSON");
            const data = await response.json();
            this.processDictionary(data);
            this.isLoaded = true;
            console.log("✅ Motor listo. Palabras estrictas protegidas:", this.strictGenderSet.size);
        } catch (error) {
            console.error(error);
        }
    }

    processDictionary(data) {
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
        return word.toString()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, ""); // Borra puntos y simbolos del INPUT del usuario
    }

    /**
     * Obtiene la raíz, pero consulta la LISTA DE PROTECCIÓN antes de cortar vocales.
     */
    getStem(word) {
        let stem = word;

        // 1. Limpieza de Plurales (Siempre permitida, PENAS -> PENA es válido)
        if (stem.endsWith('CES')) stem = stem.slice(0, -3) + 'Z';
        else if (stem.endsWith('S') && stem.length > 3) stem = stem.slice(0, -1);
        
        // 2. Limpieza de Diminutivos (Gatito -> Gat)
        // Esto lo hacemos antes de chequear protección, para que PENITA -> PENA
        stem = stem.replace(/(C)?IT[AO]$/, '');

        // --- LA MAGIA DEL PUNTO ---
        // Antes de cortar la vocal final (Género), chequeamos si esta palabra
        // está en la lista de "strictGenderSet" (la que cargamos con puntos).
        if (this.strictGenderSet.has(stem)) {
            // ¡ALTO! Es una palabra protegida (ej: PENA). 
            // Devolvemos "PENA" tal cual, sin cortar la A.
            return stem; 
        }

        // 3. Limpieza de Vocal Final (Solo si NO es estricta)
        if (stem.length > 2) {
            const last = stem.slice(-1);
            if (['A', 'E', 'O'].includes(last)) stem = stem.slice(0, -1);
        }
        return stem;
    }

    areEquivalent(word1, word2) {
        if (!this.isLoaded && Object.keys(this.dictionaryMap).length === 0) {
             console.warn("Diccionario vacío o cargando...");
        }

        const n1 = this.normalize(word1);
        const n2 = this.normalize(word2);
        
        if (n1 === n2) return true;

        // Búsqueda Inteligente (Dict -> Stem)
        let id1 = this.dictionaryMap[n1];
        let id2 = this.dictionaryMap[n2];

        // Si no está exacto, buscamos por su Stem (que ahora respeta el punto)
        if (!id1) id1 = this.dictionaryMap[this.getStem(n1)];
        if (!id2) id2 = this.dictionaryMap[this.getStem(n2)];

        if (id1 && id2 && id1 === id2) return true;

        // Comparación manual de raíces
        const root1 = this.getStem(n1);
        const root2 = this.getStem(n2);

        // Cruce Dict vs Raíz
        if (id1) {
            // OJO: Normalizamos el ID antes de sacar stem para evitar errores
            const dictRoot = this.getStem(this.normalize(id1));
            if (dictRoot === root2) return true;
        }
        if (id2) {
            const dictRoot = this.getStem(this.normalize(id2));
            if (dictRoot === root1) return true;
        }

        // Comparación Final
        if (root1 === root2 && root1.length > 2) return true;

        return false;
    }
}