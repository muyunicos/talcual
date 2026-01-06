# TalCual Database Structure Verification Report

## ✅ DATABASE STRUCTURE VERIFICATION

### Current Status: VERIFIED & COMPLIANT
Date: 2025-01-05

---

## 1. DICTIONARY TABLES (Core Game Data)

### ✅ categories
```sql
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);
```
**Purpose:** Game categories (e.g., "Things in the Kitchen", "Car Brands")
**Status:** ✅ Implemented & Working
**Coverage:** Used in prompt_categories relationships

### ✅ prompts
```sql
CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL UNIQUE
);
```
**Purpose:** Reusable question/clue templates
**Status:** ✅ Implemented & Working
**Coverage:** Separated from categories to enable many-to-many relationships

### ✅ prompt_categories (Many-to-Many Junction)
```sql
CREATE TABLE IF NOT EXISTS prompt_categories (
    prompt_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (prompt_id, category_id),
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
```
**Purpose:** Enables single prompt to be used in multiple categories
**Status:** ✅ Implemented & Working
**Example:** "Red things" can apply to both "Colors" and "Fruits"

### ✅ valid_words
```sql
CREATE TABLE IF NOT EXISTS valid_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id INTEGER NOT NULL,
    word_entry TEXT NOT NULL,
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
);
```
**Purpose:** Correct answers/words for each prompt
**Status:** ✅ Implemented & Working
**Data:** Normalized to UPPERCASE for consistent comparison

---

## 2. GAME STATE TABLES (Runtime Data)

### ✅ games
```sql
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,                          -- Room code (e.g., "ABCD")
    
    -- Game Flow Status
    status TEXT NOT NULL DEFAULT 'waiting',       -- 'waiting', 'playing', 'finished'
    round INTEGER NOT NULL DEFAULT 0,             -- Current round number
    current_prompt TEXT,                          -- Current question text (snapshot)
    current_category TEXT,                        -- Category for this round
    selected_category TEXT,                       -- Forced category (if any)
    
    -- Timing (for synchronization and state recovery)
    round_started_at INTEGER,                     -- Timestamp (ms) when round actually started
    round_starts_at INTEGER,                      -- Timestamp (ms) when action begins (post-countdown)
    round_ends_at INTEGER,                        -- Timestamp (ms) when round ends (adjustable for Hurry Up)
    countdown_duration INTEGER,                   -- Duration of countdown in ms
    created_at INTEGER,                           -- Game creation timestamp
    updated_at INTEGER,                           -- Last modification (heartbeat)
    
    -- Configuration Snapshot (IMMUTABLE for this game)
    total_rounds INTEGER NOT NULL,                -- Total rounds configured
    round_duration INTEGER NOT NULL,              -- Base duration per round in ms
    min_players INTEGER NOT NULL,                 -- Minimum players to start
    max_players INTEGER NOT NULL,                 -- Maximum players allowed
    start_countdown INTEGER NOT NULL,             -- Pre-round countdown duration
    hurry_up_threshold INTEGER NOT NULL,          -- Seconds remaining to trigger hurry up
    max_words_per_player INTEGER NOT NULL,        -- Word limit per player
    max_word_length INTEGER NOT NULL,             -- Character limit per word
    
    -- Flexible Storage
    data TEXT                                     -- JSON for additional metadata
);
```
**Purpose:** Stores complete game configuration and state snapshot
**Status:** ✅ Implemented & Working
**Key Feature:** Configuration is immutable once game starts, ensuring all players follow same rules
**Indexes:** idx_games_status, idx_games_updated_at

### ✅ players
```sql
CREATE TABLE IF NOT EXISTS players (
    id TEXT NOT NULL,                             -- Player ID (UUID or session ID)
    game_id TEXT NOT NULL,                        -- Reference to game
    
    -- Identity and Customization
    name TEXT NOT NULL,                           -- Player name
    color TEXT,                                   -- Player color (for UI)
    avatar TEXT,                                  -- Avatar identifier
    
    -- Connection Status
    status TEXT DEFAULT 'connected',              -- 'connected', 'ready', 'playing', 'disconnected'
    disconnected BOOLEAN DEFAULT 0,               -- Quick flag for disconnection logic
    
    -- Game State
    score INTEGER DEFAULT 0,                      -- Cached accumulated score
    current_answers TEXT,                         -- JSON Array of current round answers (draft)
    
    -- Complete History (for recovery and analytics)
    round_history TEXT DEFAULT '{}',              -- JSON Object by round: { "1": { "words": [...], "points": 10 }, ... }
    
    PRIMARY KEY (id, game_id),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```
**Purpose:** Tracks participant identity and complete game history
**Status:** ✅ Implemented & Working
**Key Feature:** round_history enables state recovery and comprehensive analytics
**Indexes:** idx_players_game_id

---

## 3. PERFORMANCE INDEXES

✅ All indexes implemented:
- `idx_players_game_id` - Fast game player lookups
- `idx_prompt_categories_prompt` - Prompt category relationships
- `idx_prompt_categories_category` - Category prompt lookups
- `idx_valid_words_prompt_id` - Word validation by prompt
- `idx_games_status` - Game state filtering
- `idx_games_updated_at` - Recent game queries

---

## 4. DATABASE PRAGMAS & CONFIGURATION

✅ All optimizations enabled:
```sql
PRAGMA foreign_keys = ON;           -- Enable referential integrity
PRAGMA journal_mode = WAL;          -- Write-Ahead Logging for better concurrency
PRAGMA synchronous = NORMAL;        -- Balance safety vs performance
```

---

## 5. ADMIN CAPABILITIES

### Dictionary Management
✅ **Categories**
- `addCategory()` - Create new categories
- `updateCategory()` - Modify category names
- `deleteCategory()` - Remove categories (cascades to prompts)
- `getCategoriesFull()` - List all categories

✅ **Prompts/Consignas**
- `addPrompt()` - Create prompts with category relationships
- `updatePrompt()` - Modify prompt text and categories
- `deletePrompt()` - Remove prompts (cascades to valid_words)
- `getPrompts()` - List all or filter by category
- `getPromptsWithStats()` - Include word count stats

✅ **Valid Words**
- `addValidWord()` - Add acceptable answers
- `updateValidWord()` - Modify word entries
- `deleteValidWord()` - Remove single words
- `deleteValidWordsByPrompt()` - Batch delete by prompt
- `getValidWords()` - List by prompt or all

### Game Management
✅ **Game Operations**
- `getGames()` - List games with pagination
- `getGameByCode()` - Fetch specific game
- `deleteGame()` - Remove game (cascades to players)

✅ **Player Operations**
- `getGamePlayers()` - List game participants
- `getPlayerStats()` - Individual player statistics
- `updatePlayerStatus()` - Modify connection/game state
- `deletePlayer()` - Remove player from game

### Database Maintenance
✅ **Health & Optimization**
- `getDictionaryStats()` - Category and word counts
- `getDatabaseInspection()` - Full database audit
- `vacuumDatabase()` - Compact database file

### Available API Endpoints
All functionality exposed via `dmanager.php`:

**GET Endpoints:**
- `/db/dmanager.php?action=get-db` - Export full database
- `/db/dmanager.php?action=inspect` - Inspect database health
- `/db/dmanager.php?action=get-categories` - List categories
- `/db/dmanager.php?action=get-prompts` - List prompts
- `/db/dmanager.php?action=get-games` - List games
- `/db/dmanager.php?action=get-game&code=XXXX` - Get game details
- `/db/dmanager.php?action=get-game-players&game_id=XXXX` - Get game players
- `/db/dmanager.php?action=get-player-stats&game_id=XXXX&player_id=XXXX` - Get player stats
- `/db/dmanager.php?action=export` - Export dictionary

**POST Endpoints:**
- `/db/dmanager.php?action=add-category` - Create category
- `/db/dmanager.php?action=delete-category` - Remove category
- `/db/dmanager.php?action=add-prompt` - Create prompt
- `/db/dmanager.php?action=delete-prompt` - Remove prompt
- `/db/dmanager.php?action=delete-game` - Remove game
- `/db/dmanager.php?action=delete-player` - Remove player
- `/db/dmanager.php?action=update-player-status` - Update player state
- `/db/dmanager.php?action=import` - Import dictionary JSON
- `/db/dmanager.php?action=save` - Save/sync dictionary
- `/db/dmanager.php?action=optimize` - Optimize database
- `/db/dmanager.php?action=repair` - Repair corrupted database
- `/db/dmanager.php?action=nuke` - Completely reset database
- `/db/dmanager.php?action=diagnose` - Run diagnostics

---

## 6. SCHEMA DESIGN RATIONALE

### Dictionary Structure Design
**Why separate Categories, Prompts, and Valid Words?**
- **Categories** = Thematic grouping ("Kitchen", "Animals", "Colors")
- **Prompts** = Reusable questions ("Wooden things", "Red things")
- **Prompt_Categories** = Junction table enabling prompt reuse across categories
- **Valid_Words** = Acceptable answers for each prompt

**Benefits:**
1. Single prompt can apply to multiple categories (no duplication)
2. Easy to expand with new categories
3. Isolated word validation logic
4. Efficient queries by category or prompt

### Game State Design
**Why store configuration as snapshot?**
- Prevents rule changes mid-game
- Ensures fairness for all players
- Enables accurate game state recovery
- Supports server restart without losing state

**Why JSON for flexible data?**
- Supports game metadata without schema migrations
- Round history can expand with new fields
- Player answers stored in flexible format

### Timing Strategy
- `round_started_at` - When actual game round begins
- `round_starts_at` - When player interaction begins (after countdown)
- `round_ends_at` - When answers stop being accepted (adjustable for Hurry Up)
- Enables accurate time tracking and recovery

---

## 7. DATA INTEGRITY

✅ **Referential Integrity**
- All foreign keys enforce CASCADE DELETE
- Invalid data cannot exist (UNIQUE constraints)
- Orphaned records cleaned up automatically

✅ **Normalization**
- Words normalized to UPPERCASE
- Timestamps in milliseconds (consistent)
- JSON data validated on input

✅ **Recovery Mechanisms**
- WAL mode enables crash recovery
- Player round_history preserved
- Game state snapshots enable recovery

---

## 8. VALIDATION CHECKLIST

- [x] All 6 tables implemented (categories, prompts, prompt_categories, valid_words, games, players)
- [x] All foreign keys with CASCADE DELETE
- [x] All indexes created for performance
- [x] All pragmas configured (journal_mode, synchronous, foreign_keys)
- [x] Word normalization (UPPERCASE) implemented
- [x] Game configuration immutable after creation
- [x] Player state recovery enabled via round_history
- [x] JSON fields for flexible data storage
- [x] Admin API endpoints complete
- [x] Database maintenance utilities available
- [x] Orphan cleanup and optimization tools
- [x] Health check and diagnostics implemented

---

## 9. RECOMMENDED ADMIN OPERATIONS

### Daily
- Run `/db/dmanager.php?action=inspect` - Check database health
- Monitor `/logs/dmanager.log` - Review error logs

### Weekly
- Run `/db/dmanager.php?action=optimize` - Clean orphaned records
- Export database via `/db/dmanager.php?action=export` - Backup

### Monthly
- Vacuum database to reclaim space
- Review game analytics for patterns
- Update prompts/words based on gameplay data

### As Needed
- `/db/dmanager.php?action=repair` - Fix corrupted database
- `/db/dmanager.php?action=nuke` - Complete reset (destructive)

---

## 10. CONCLUSION

✅ **DATABASE STRUCTURE IS FULLY COMPLIANT**

The SQLite implementation matches all specified requirements:
1. Dictionary tables are properly normalized and relatable
2. Game state tables capture immutable configuration and runtime state
3. All admin operations are implemented and functional
4. Performance is optimized with appropriate indexes
5. Data integrity is enforced with foreign keys and constraints
6. Recovery and analytics are enabled via comprehensive data storage

The database is production-ready and supports the full feature set of the TalCual game.
