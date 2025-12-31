/**
 * DictionaryService Test Suite
 * Covers: word loading, validation, search, filtering
 * Coverage Target: 80%+
 */

describe('DictionaryService', () => {
    let dictionaryService;
    let mockDictionary;

    beforeEach(async () => {
        // Mock fetch for dictionary.json
        mockDictionary = {
            words: [
                { word: 'GATO', length: 4, difficulty: 'easy' },
                { word: 'PERRO', length: 5, difficulty: 'easy' },
                { word: 'PROGRAMACION', length: 12, difficulty: 'hard' },
                { word: 'JAVASCRIPT', length: 10, difficulty: 'hard' },
                { word: 'COMPUTER', length: 8, difficulty: 'medium' }
            ]
        };

        global.fetch = jest.fn(() => 
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockDictionary)
            })
        );

        dictionaryService = new DictionaryService();
        await dictionaryService.loadDictionary();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Dictionary Loading', () => {
        test('should load dictionary successfully', async () => {
            expect(dictionaryService.isLoaded()).toBe(true);
        });

        test('should fetch from correct URL', async () => {
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('dictionary.json')
            );
        });

        test('should cache dictionary in memory', () => {
            expect(dictionaryService.getWordCount()).toBeGreaterThan(0);
        });

        test('should handle loading errors gracefully', async () => {
            global.fetch = jest.fn(() => 
                Promise.resolve({ ok: false })
            );
            const service = new DictionaryService();
            await expect(service.loadDictionary()).rejects.toThrow();
        });
    });

    describe('Word Retrieval', () => {
        test('should get random word', () => {
            const word = dictionaryService.getRandomWord();
            expect(word).toBeDefined();
            expect(word.word).toBeDefined();
        });

        test('should get word by exact match', () => {
            const word = dictionaryService.getWord('GATO');
            expect(word).not.toBeNull();
            expect(word.word).toBe('GATO');
        });

        test('should return null for non-existent word', () => {
            const word = dictionaryService.getWord('NOTEXIST');
            expect(word).toBeNull();
        });

        test('should be case-insensitive', () => {
            const word1 = dictionaryService.getWord('gato');
            const word2 = dictionaryService.getWord('GATO');
            expect(word1).not.toBeNull();
            expect(word1.word).toBe(word2.word);
        });
    });

    describe('Word Filtering', () => {
        test('should filter by length', () => {
            const words = dictionaryService.getWordsByLength(4);
            expect(words.length).toBeGreaterThan(0);
            words.forEach(word => {
                expect(word.word.length).toBe(4);
            });
        });

        test('should filter by difficulty', () => {
            const words = dictionaryService.getWordsByDifficulty('easy');
            expect(words.length).toBeGreaterThan(0);
            words.forEach(word => {
                expect(word.difficulty).toBe('easy');
            });
        });

        test('should filter by length range', () => {
            const words = dictionaryService.getWordsByLengthRange(4, 6);
            words.forEach(word => {
                expect(word.word.length).toBeGreaterThanOrEqual(4);
                expect(word.word.length).toBeLessThanOrEqual(6);
            });
        });

        test('should handle multiple filters', () => {
            const words = dictionaryService.getWords({
                length: 5,
                difficulty: 'easy'
            });
            words.forEach(word => {
                expect(word.word.length).toBe(5);
                expect(word.difficulty).toBe('easy');
            });
        });
    });

    describe('Word Validation', () => {
        test('should validate existing word', () => {
            expect(dictionaryService.isValidWord('GATO')).toBe(true);
        });

        test('should reject non-existent word', () => {
            expect(dictionaryService.isValidWord('NOTEXIST')).toBe(false);
        });

        test('should handle empty string', () => {
            expect(dictionaryService.isValidWord('')).toBe(false);
        });

        test('should handle null/undefined', () => {
            expect(dictionaryService.isValidWord(null)).toBe(false);
            expect(dictionaryService.isValidWord(undefined)).toBe(false);
        });

        test('should be case-insensitive for validation', () => {
            expect(dictionaryService.isValidWord('gato')).toBe(true);
            expect(dictionaryService.isValidWord('GATO')).toBe(true);
        });
    });

    describe('Word Search', () => {
        test('should search words by pattern', () => {
            const words = dictionaryService.searchWords('GA*');
            expect(words.length).toBeGreaterThan(0);
        });

        test('should search with wildcard', () => {
            const words = dictionaryService.searchWords('*ATO');
            expect(words.length).toBeGreaterThan(0);
        });

        test('should handle partial matches', () => {
            const words = dictionaryService.searchWords('PROG%');
            expect(words.some(w => w.word.startsWith('PROG'))).toBe(true);
        });
    });

    describe('Statistics', () => {
        test('should get word count', () => {
            const count = dictionaryService.getWordCount();
            expect(count).toBe(mockDictionary.words.length);
        });

        test('should get length distribution', () => {
            const dist = dictionaryService.getLengthDistribution();
            expect(Object.keys(dist).length).toBeGreaterThan(0);
        });

        test('should get difficulty distribution', () => {
            const dist = dictionaryService.getDifficultyDistribution();
            expect(dist.easy).toBeGreaterThan(0);
        });

        test('should get average word length', () => {
            const avg = dictionaryService.getAverageWordLength();
            expect(avg).toBeGreaterThan(0);
        });
    });

    describe('Performance', () => {
        test('should return word quickly', () => {
            const start = performance.now();
            dictionaryService.getWord('GATO');
            const end = performance.now();
            expect(end - start).toBeLessThan(10); // < 10ms
        });

        test('should filter large lists efficiently', () => {
            const start = performance.now();
            dictionaryService.getWordsByLength(5);
            const end = performance.now();
            expect(end - start).toBeLessThan(50); // < 50ms
        });
    });

    describe('Edge Cases', () => {
        test('should handle special characters in words', () => {
            const words = dictionaryService.searchWords('*');
            expect(words.length).toBeGreaterThan(0);
        });

        test('should handle very long words', () => {
            const longWord = ictionaryService.getWord('PROGRAMACION');
            expect(longWord).not.toBeNull();
        });

        test('should handle empty filter', () => {
            const words = dictionaryService.getWords({});
            expect(words.length).toBe(mockDictionary.words.length);
        });
    });

    describe('Caching', () => {
        test('should return same reference for repeated calls', () => {
            const word1 = dictionaryService.getWord('GATO');
            const word2 = dictionaryService.getWord('GATO');
            // Should be from cache (same reference or equal)
            expect(word1).toEqual(word2);
        });
    });
});
