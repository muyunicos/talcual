# PHASE 2: INTEGRATED REFACTOR - Dictionary Single Source of Truth

## Overview
Phase 2 establishes `app/diccionario.json` as the **Single Source of Truth (SSOT)** for both Backend (PHP) and Frontend (JS), eliminating redundant synonym data files and introducing centralized dictionary logic with pipe-delimited word variants.

---

## Architecture Changes

### Before (PHASE 1)
- **Backend:** Simple dictionary loading, no synonym handling
- **Frontend:** Relied on external `sinonimos.json`, redundant data sources
- **Structure:** Fragmented logic across multiple files

### After (PHASE 2)
- **Backend:** Centralized dictionary logic with `flattenWords()` and `cleanWordPrompt()` helpers
- **Frontend:** Single `DictionaryService` injecting into `WordEquivalenceEngine`
- **Structure:** `diccionario.json` is SSOT for both sides
- **Pipe Syntax:** "Cine|Cinema" -> both map to "Cine" as canonical

---

## Backend Changes (PHP)

### `app/config.php`

#### New Helper Functions

**1. `flattenWords($data)` - Recursive Word Extraction**
```php
function flattenWords($data) {
    // Recursively extracts all string values from complex nested arrays/objects
    // Handles: Categories > Hints > WordLists
    // Returns: Flat array of all word strings
}
```
- Used by all word-retrieval functions
- Handles deeply nested dictionary structures
- Preserves pipe-delimited entries for processing

**2. `cleanWordPrompt($rawWord)` - Pipe Delimiter Handling**
```php
function cleanWordPrompt($rawWord) {
    // Input: "Cine|Cinema" or "Cine"
    // Output: "Cine" (first part before pipe)
    // CRITICAL: Server NEVER returns strings with '|' to client as prompts
}
```
- Always called before returning words to client
- Extracts canonical form from pipe-delimited entries
- Ensures consistency in UI prompts

#### Updated Functions

**`getAllWords()`**
- Now uses `flattenWords()` + `cleanWordPrompt()`
- Returns only cleaned canonical forms
- No duplicates

**`getWordsByCategory($category)`**
- Extracts category content
- Applies `flattenWords()` and `cleanWordPrompt()`
- Returns unique cleaned words

**`getRoundContext($category, $prompt)`**
- NEW: Returns server-side round context
- Structure:
  ```json
  {
    "prompt": "CINE",
    "synonyms": ["CINE", "CINEMA", ...],
    "variants": ["CINE", "CINES", "CINEA", ...]
  }
  ```
- Sent to client for synonym matching

#### Removed Functions
- `loadRawDictionaryJson()` - **No longer needed** (not renamed, was part of internal flow)
- `getPromptPoolFromDictionary()` - **Consolidated into** `pickNonRepeatingPrompt()`

---

### `app/actions.php`

#### Refactored Functions

**`pickNonRepeatingPrompt($state, $preferredCategory)`**
- Uses `getWordsByCategory()` directly (from config.php)
- Returns cleaned words via `cleanWordPrompt()`
- Simplified logic without redundant dictionary loading

**`handleStartRound($input)`**
- **NEW:** Injects `round_context` into game state
  ```php
  $state['round_context'] = getRoundContext($preferredCategory, $prompt);
  ```
- Called via `app/actions.php` before sending state to client
- Used by `WordEquivalenceEngine.setRoundContext()` on frontend

#### New Endpoints

**`get_categories`**
- Returns available categories from dictionary
- Used by frontend to populate category selections

**`get_category_word`**
- Returns random word from specified category
- Cleans word via backend before transmission

#### Fixed Spelling
- "Accion" → "Acción" (proper Spanish diacritics)
- "Accion no valida" → "Acción no válida"
- All error messages now use proper Spanish

---

## Frontend Changes (JavaScript)

### `js/word-comparison.js`

#### Removed
- `async init(url)` method
- All `fetch()` calls
- External dependency on `sinonimos.json`

#### Refactored `processDictionary(data)`

**Behavior:**
1. **Receives raw `diccionario.json` structure:**
   ```json
   {
     "AMOR Y CITAS": [
       { "Un lugar para una primera cita": ["Cine|Cinema", "Bar|Pub", ...] },
       { "Un regalo de aniversario": [...] }
     ]
   }
   ```

2. **Processes pipe-delimited entries:**
   - "Cine|Cinema" → `registerWord("Cine", "Cine")` and `registerWord("Cinema", "Cine")`
   - Both "CINE" and "CINEMA" (normalized) map to canonical "CINE"

3. **Builds internal mapping:**
   ```javascript
   dictionaryMap = {
     "CINE": "CINE",
     "CINEMA": "CINE",
     "CINES": "CINE",
     "BAR": "BAR",
     "PUB": "BAR",
     // ...
   }
   ```

#### Pipe Processing Method

```javascript
processPipeDelimitedEntry(entry, category) {
    const parts = entry.split('|')
        .map(p => p.trim())
        .filter(p => p.length > 0);
    
    const canonical = parts[0];  // "Cine"
    
    parts.forEach(word => {
        this.registerWord(word, canonical, category);
        // "Cine" -> "Cine"
        // "Cinema" -> "Cine"
    });
}
```

---

### `js/shared-utils.js`

#### Major Changes

**1. Removed Stub Classes**
- ❌ Deleted fake `WordEquivalenceEngine` class at top of file
- **Fail-fast:** If `word-comparison.js` not loaded, throws error immediately
- No silent failures or race conditions

**2. Centralized `GameTimer` Object**

```javascript
const GameTimer = {
    format(seconds) {          // Convert 90 -> "1:30"
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    getRemaining(startTime, duration) {  // Calculate time left
        const elapsed = now - startTime;
        return Math.max(0, duration - elapsed);
    },

    updateDisplay(remainingMs, element) {  // Update DOM
        element.textContent = `⏳ ${this.format(seconds)}`;
    }
}
```

**Backward Compatible:**
- `formatTime()` → calls `GameTimer.format()`
- `getRemainingTime()` → calls `GameTimer.getRemaining()`
- `updateTimerDisplay()` → calls `GameTimer.updateDisplay()`

**3. New `DictionaryService` Class**

```javascript
class DictionaryService {
    async load() {
        // Fetches ./app/diccionario.json
        // Injects into wordEngine via processDictionary()
        // Flattens dictionary for UI prompts
        // Returns: { rawDictionary, flattenedWords }
    }
    
    getFlattenedWords() {
        // Returns clean word list (no pipes)
        // Used for autocomplete, dropdowns, etc.
    }
    
    getCategories() {
        // Returns category names from dictionary
    }
}
```

**Flattening Process:**
```javascript
_flattenDictionary(data) {
    // Input: Raw diccionario.json structure
    // Process:
    //   1. Iterate through categories
    //   2. Extract words from hints
    //   3. For "Cine|Cinema", take only "Cine"
    //   4. Remove duplicates with Set
    // Returns: ["Cine", "Bar", "Restaurante", ...]
}
```

**Injection Flow:**
```
DictionaryService.load()
  ↓
fetch('./app/diccionario.json')
  ↓
wordEngine.processDictionary(rawData)
  ↓
wordEngine.dictionaryMap = { "CINEMA": "CINE", ... }
  ↓
this.flattenedWords = ["Cine", "Bar", ...]
```

---

## Data Flow

### Round Start (Server → Client)

1. **Backend:** `handleStartRound()` receives word request
2. **Backend:** Picks prompt and calls `getRoundContext(category, prompt)`
3. **Backend:** Returns game state with `round_context`:
   ```json
   {
     "current_word": "CINE",
     "current_category": "AMOR Y CITAS",
     "round_context": {
       "prompt": "CINE",
       "synonyms": ["CINE", "CINEMA", ...],
       "variants": ["CINE", "CINES", ...]
     }
   }
   ```

4. **Frontend:** Receives state
5. **Frontend:** Calls `wordEngine.setRoundContext(state.round_context)`
6. **Frontend:** Engine now knows valid synonyms for this round

### Answer Submission (Client → Server → Backend)

1. **Frontend:** Player submits "Cinema"
2. **Frontend:** Engine checks `areEquivalent("Cinema", "CINE")` → **true** (via round context)
3. **Frontend:** Sends answers to server
4. **Backend:** Validates using similar logic (PHP version of word comparison)
5. **Backend:** Returns scoring results

---

## Testing Checklist

### Backend
- [ ] `flattenWords()` extracts all words recursively
- [ ] `cleanWordPrompt()` removes pipes correctly
- [ ] `getAllWords()` returns no duplicates
- [ ] `getWordsByCategory()` returns cleaned words
- [ ] `getRoundContext()` returns valid synonyms + variants
- [ ] `start_round` includes `round_context` in response
- [ ] Error messages use proper Spanish diacritics

### Frontend
- [ ] `DictionaryService.load()` fetches `diccionario.json`
- [ ] `wordEngine.processDictionary()` handles pipe syntax
- [ ] `dictionaryMap["CINEMA"] === "CINE"`
- [ ] `getFlattenedWords()` returns no pipes
- [ ] `wordEngine.setRoundContext()` stores context correctly
- [ ] `areEquivalent()` prioritizes round context when available
- [ ] Timer functions format correctly

### Integration
- [ ] Game starts and displays correct prompt (no pipes visible)
- [ ] Synonyms from dictionary are accepted
- [ ] Players can't see internal mapping (only canonical forms)
- [ ] Round context updates correctly on new rounds

---

## File Manifest

| File | Changes |
|------|----------|
| `app/config.php` | ✅ Added `flattenWords()`, `cleanWordPrompt()`, updated word functions |
| `app/actions.php` | ✅ Removed `loadRawDictionaryJson()`, `getPromptPoolFromDictionary()`, added context injection |
| `js/word-comparison.js` | ✅ Removed `init()`, refactored `processDictionary()` for pipe syntax |
| `js/shared-utils.js` | ✅ Removed stubs, added centralized `GameTimer`, refactored `DictionaryService` |

---

## Key Principles

1. **Single Source of Truth:** `diccionario.json` is the only dictionary file
2. **Clean Transmission:** Server never sends pipes to client
3. **Synonym Mapping:** Pipe delimiters define equivalence at load time
4. **Fail-Fast:** Missing dependencies throw immediately
5. **Backward Compatibility:** Old API calls still work via wrapper functions
6. **Passive Engine:** `WordEquivalenceEngine` receives data, doesn't fetch it

---

## Migration Notes

### From PHASE 1 to PHASE 2

**Deprecated Files:**
- `sinonimos.json` - **No longer needed**
- Any old dictionary synonyms - **Migrate to pipe syntax in `diccionario.json`**

**Required Updates:**
- Update `diccionario.json` with pipe syntax for variants
- Ensure `host.html` and `play.html` load `word-comparison.js` before `shared-utils.js`
- Update any external calls to removed functions

---

## Future Improvements

- [ ] Add dictionary validation endpoint
- [ ] Implement dictionary caching on client (IndexedDB)
- [ ] Add multi-language support via dictionary structure
- [ ] Create admin UI for dictionary management
- [ ] Add word frequency weighting to scoring

---

**Phase 2 Status:** ✅ **COMPLETE**
**Last Updated:** 2026-01-02
**Compatibility:** TalCual Party v2.0+
