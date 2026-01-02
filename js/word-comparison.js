/**
 * Word Comparison Engine V10 - Passive Logic Engine (PHASE 2 FINAL)
 *
 * PHASE 2 Changes:
 * - REMOVED: async init(jsonUrl) - no I/O at all
 * - REFACTORED: processDictionary(data) handles diccionario.json structure
 *   Expects: Object -> Categories -> Array[Objects] -> Hints -> Array[Strings]
 *   With pipe syntax: "Cine|Cinema" -> canonical ID is first part "Cine"
 * - Pipe parsing: "A|B|C" -> all mapped to first item as canonical
 * - Data is INJECTED from DictionaryService - engine is passive
 */

class WordEquivalenceEngine {
    constructor() {
        this.dictionaryMap = {};
        this.strictGenderSet = new Set();
        this.isLoaded = false;
        this.debugMode = false;
        this.roundContext = null;
    }

    processDictionary(data) {
        if (!data || typeof data !== 'object') {
            console.error('❌ processDictionary: invalid data');
            return;
        }

        this.dictionaryMap = {};
        this.strictGenderSet.clear();

        if (Array.isArray(data)) {
            this.processLegacyFormat(data);
        } else {
            this.processModernFormat(data);
        }

        this.isLoaded = true;
        console.log('✅ WordEngine ready. Dictionary entries:', Object.keys(this.dictionaryMap).length);
    }

    processModernFormat(data) {
        Object.entries(data).forEach(([category, categoryContent]) => {
            if (!Array.isArray(categoryContent)) return;

            categoryContent.forEach(hintObj => {
                if (typeof hintObj !== 'object' || Array.isArray(hintObj)) return;

                Object.entries(hintObj).forEach(([hint, words]) => {
                    if (!Array.isArray(words)) return;

                    words.forEach(wordEntry => {
                        if (typeof wordEntry !== 'string' || wordEntry.length === 0) return;

                        if (wordEntry.includes('|')) {
                            this.processPipeDelimitedEntry(wordEntry, category);
                        } else {
                            this.registerWord(wordEntry, wordEntry, category);
                        }
                    });
                });
            });
        });
    }

    processPipeDelimitedEntry(entry, category) {
        const parts = entry.split('|')
            .map(p => p.trim())
            .filter(p => p.length > 0);

        if (parts.length === 0) return;

        const canonical = parts[0];

        parts.forEach(word => {
            this.registerWord(word, canonical, category);
        });
    }

    registerWord(word, canonical, category) {
        if (!word || typeof word !== 'string') return;

        let cleanWord = word;
        let isStrict = false;

        if (cleanWord.endsWith('.')) {
            isStrict = true;
            cleanWord = cleanWord.slice(0, -1);
        }

        const norm = this.normalize(cleanWord);
        if (!norm) return;

        if (isStrict) {
            this.strictGenderSet.add(norm);
        }

        const canonicalNorm = this.normalize(canonical);
        this.dictionaryMap[norm] = canonicalNorm || canonical;

        const stem = this.getStem(norm);
        if (stem !== norm && !this.dictionaryMap[stem]) {
            this.dictionaryMap[stem] = canonicalNorm || canonical;
        }
    }

    processLegacyFormat(data) {
        data.forEach(group => {
            if (!Array.isArray(group) || group.length === 0) return;

            let canonicalRaw = group[0];

            if (canonicalRaw.endsWith('.')) {
                canonicalRaw = canonicalRaw.slice(0, -1);
            }

            group.forEach(word => {
                let cleanWord = word;
                let isStrict = false;

                if (cleanWord.endsWith('.')) {
                    isStrict = true;
                    cleanWord = cleanWord.slice(0, -1);
                }

                const norm = this.normalize(cleanWord);
                if (!norm) return;

                if (isStrict) {
                    this.strictGenderSet.add(norm);
                }

                this.dictionaryMap[norm] = canonicalRaw;

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
            .replace(/[^A-Z0-9]/g, '');
    }

    getStem(word) {
        let stem = word;

        if (stem.endsWith('CION')) {
            stem = stem.slice(0, -2);
        }
        else if (stem.endsWith('CES')) {
            stem = stem.slice(0, -3) + 'Z';
        }
        else if (stem.endsWith('ES') && stem.length > 4) {
            const base = stem.slice(0, -2);
            if (!base.match(/[AEIOU]$/)) {
                stem = base;
            }
        }
        else if (stem.endsWith('S') && stem.length > 3) {
            stem = stem.slice(0, -1);
        }

        stem = stem.replace(/(C)?IT[AO]$/, '');
        stem = stem.replace(/[AO]CH[AO]$/, '');
        stem = stem.replace(/[AO]LL[AO]$/, '');

        if (this.strictGenderSet.has(stem)) {
            return stem;
        }

        if (stem.length > 2) {
            const last = stem.slice(-1);
            if (['A', 'E', 'O'].includes(last)) {
                stem = stem.slice(0, -1);
            }
        }
        return stem;
    }

    setRoundContext(context) {
        if (!context || typeof context !== 'object') {
            this.roundContext = null;
            return;
        }
        this.roundContext = {
            prompt: (context.prompt || '').toUpperCase().trim(),
            synonyms: Array.isArray(context.synonyms) ? context.synonyms.map(w => this.normalize(w)) : [],
            variants: Array.isArray(context.variants) ? context.variants.map(w => this.normalize(w)) : []
        };
        if (this.debugMode) console.log('%c📦 Round Context', 'color: #00DD00; font-weight: bold;', this.roundContext);
    }

    getRoundContext() {
        return this.roundContext;
    }

    getMatchType(word1, word2) {
        const n1 = this.normalize(word1);
        const n2 = this.normalize(word2);

        if (!n1 || !n2) return null;

        if (n1 === n2) return 'EXACTA';

        const stem1 = this.getStem(n1);
        const stem2 = this.getStem(n2);

        if (stem1 !== stem2) return null;

        const isPluralLike = (word) => {
            return word.endsWith('S') || 
                   word.endsWith('ES') || 
                   word.match(/IT[AO]$/) ||
                   word.match(/CH[AO]$/) ||
                   word.match(/LL[AO]$/);
        };
        
        if (isPluralLike(n1) || isPluralLike(n2)) {
            return 'PLURAL';
        }

        const last1 = n1.slice(-1);
        const last2 = n2.slice(-1);
        const isGenderVowel = (v) => ['A', 'E', 'O'].includes(v);
        
        if (isGenderVowel(last1) && isGenderVowel(last2) && last1 !== last2) {
            return 'GENERO';
        }

        if (this.isLoaded) {
            let id1 = this.dictionaryMap[n1];
            let id2 = this.dictionaryMap[n2];
            
            if (!id1) id1 = this.dictionaryMap[stem1];
            if (!id2) id2 = this.dictionaryMap[stem2];
            
            if (id1 && id2 && id1 === id2) {
                return 'SINONIMO';
            }
        }

        return 'SIMILAR';
    }

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
            console.log(`❌ areEquivalentLocally("${word1}", "${word2}"): stems don't match "${root1}" !== "${root2}"`);
        }

        return false;
    }

    getCanonical(word) {
        const n = this.normalize(word);
        if (!n) return '';

        let id = this.dictionaryMap[n];
        if (id) return id;

        const stem = this.getStem(n);
        id = this.dictionaryMap[stem];
        if (id) return id;

        return stem.length > 0 ? stem : n;
    }

    areEquivalentWithType(word1, word2) {
        const matchType = this.getMatchType(word1, word2);
        
        if (this.debugMode && matchType) {
            console.log(`🎯 areEquivalentWithType("${word1}", "${word2}"): type=${matchType}`);
        }
        
        return {
            match: matchType !== null,
            type: matchType
        };
    }

    areEquivalent(word1, word2) {
        const n1 = this.normalize(word1);
        const n2 = this.normalize(word2);

        if (!n1 || !n2) return false;
        if (n1 === n2) return true;

        if (this.roundContext && this.roundContext.synonyms.length > 0) {
            const inSynonyms = this.roundContext.synonyms.includes(n1) || this.roundContext.synonyms.includes(n2);
            const inVariants = this.roundContext.variants.includes(n1) || this.roundContext.variants.includes(n2);
            if (inSynonyms || inVariants) {
                if (this.debugMode) console.log(`✅ areEquivalent (roundContext): "${word1}" ~ "${word2}"`);
                return true;
            }
            if (this.debugMode) console.log(`❌ areEquivalent (roundContext): "${word1}" ≠ "${word2}"`);
            return false;
        }

        if (this.isLoaded && Object.keys(this.dictionaryMap).length > 0) {
            let id1 = this.dictionaryMap[n1];
            let id2 = this.dictionaryMap[n2];

            if (!id1) id1 = this.dictionaryMap[this.getStem(n1)];
            if (!id2) id2 = this.dictionaryMap[this.getStem(n2)];

            if (id1 && id2 && id1 === id2) {
                if (this.debugMode) console.log(`✅ areEquivalent (dict): "${word1}" == "${word2}" (by canonical)`);
                return true;
            }

            const root1 = this.getStem(n1);
            const root2 = this.getStem(n2);

            if (id1) {
                const dictRoot = this.getStem(id1);
                if (dictRoot === root2) {
                    if (this.debugMode) console.log(`✅ areEquivalent (dict-stem): "${word1}" == "${word2}"`);
                    return true;
                }
            }
            if (id2) {
                const dictRoot = this.getStem(id2);
                if (dictRoot === root1) {
                    if (this.debugMode) console.log(`✅ areEquivalent (dict-stem): "${word1}" == "${word2}"`);
                    return true;
                }
            }

            if (root1 === root2 && root1.length > 2) {
                if (this.debugMode) console.log(`✅ areEquivalent (root): "${word1}" == "${word2}"`);
                return true;
            }
        } else {
            if (this.debugMode) console.log(`⚠️  Dictionary not loaded, using local fallback for "${word1}" vs "${word2}"`);
            return this.areEquivalentLocally(word1, word2);
        }

        if (this.debugMode) {
            const root1 = this.getStem(n1);
            const root2 = this.getStem(n2);
            console.log(`❌ areEquivalent: "${word1}" != "${word2}"`);
        }

        return false;
    }

    enableDebug() {
        this.debugMode = true;
        console.log('%c🔧 Word Equivalence Engine in DEBUG mode', 'color: #FF6600; font-weight: bold');
    }

    disableDebug() {
        this.debugMode = false;
    }
}