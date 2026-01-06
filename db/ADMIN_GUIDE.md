# TalCual Database Administration Guide

## Overview

The `/db/` directory contains a complete SQLite database administration system for managing the TalCual game. This system is designed for administrators to:
- Manage the game dictionary (categories, prompts, valid words)
- Monitor active games and players
- Perform analytics on player performance
- Maintain database health and integrity
- Handle cleanup and optimization

---

## Directory Structure

```
db/
├── index.html                    # Admin dashboard UI
├── repair.html                   # Database repair UI
├── dmanager.php                  # Main API endpoint
├── AdminDictionary.php           # Dictionary management class
├── ADMIN_OPERATIONS.php          # Games & players management class
├── SQLITE_SCHEMA.sql             # Database schema definition
├── VERIFICATION_REPORT.md        # Structure verification
├── DATABASE_REPAIR_GUIDE.txt     # Repair procedures
├── health-check.php              # Health monitoring
├── repair-database.php           # Database repair utilities
└── API_ENDPOINTS.md              # Complete endpoint documentation
```

---

## Database Structure

### Dictionary Tables (6 tables total)

#### 1. categories
Stores game categories
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
name        TEXT UNIQUE NOT NULL
```

#### 2. prompts
Stores reusable question/clue templates
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
text        TEXT NOT NULL UNIQUE
```

#### 3. prompt_categories
Many-to-many relationship between prompts and categories
```sql
prompt_id   INTEGER PRIMARY KEY (with category_id)
category_id INTEGER PRIMARY KEY (with prompt_id)
```

#### 4. valid_words
Stores correct answers for each prompt (normalized to UPPERCASE)
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
prompt_id   INTEGER FOREIGN KEY
word_entry  TEXT NOT NULL
```

#### 5. games
Stores game state and immutable configuration
```sql
id                      TEXT PRIMARY KEY (room code)
status                  TEXT (waiting, playing, finished)
round                   INTEGER (current round)
current_prompt          TEXT (snapshot of current prompt text)
current_category        TEXT (snapshot of current category)
selected_category       TEXT (forced category if selected)
round_started_at        INTEGER (ms timestamp)
round_starts_at         INTEGER (ms timestamp)
round_ends_at           INTEGER (ms timestamp)
countdown_duration      INTEGER (ms)
created_at              INTEGER (ms timestamp)
updated_at              INTEGER (ms timestamp)
total_rounds            INTEGER (immutable config)
round_duration          INTEGER (immutable config, ms)
min_players             INTEGER (immutable config)
max_players             INTEGER (immutable config)
start_countdown         INTEGER (immutable config, ms)
hurry_up_threshold      INTEGER (immutable config, seconds)
max_words_per_player    INTEGER (immutable config)
max_word_length         INTEGER (immutable config, characters)
data                    TEXT (JSON for metadata)
```

#### 6. players
Stores player identity and game history
```sql
id                  TEXT PRIMARY KEY (with game_id)
game_id             TEXT PRIMARY KEY (with id)
name                TEXT NOT NULL
color               TEXT (UI color)
avatar              TEXT (avatar identifier)
status              TEXT (connected, ready, playing, disconnected)
disconnected        BOOLEAN (quick flag)
score               INTEGER (cached accumulated score)
current_answers     TEXT (JSON array of current round answers)
round_history       TEXT (JSON object with round-by-round history)
```

---

## API Endpoints

### Dictionary Management

#### GET /db/dmanager.php?action=get-categories
Fetch all categories
**Response:** `{ success: true, data: [{id, name}, ...] }`

#### GET /db/dmanager.php?action=get-prompts
Fetch all prompts
**Query Params:**
- `category_id` (optional) - Filter by category
**Response:** `{ success: true, data: [{id, text, category_ids}, ...] }`

#### POST /db/dmanager.php?action=add-category
Create new category
**Body:** `{ "name": "Category Name" }`
**Response:** `{ success: true, data: {id, name} }`

#### POST /db/dmanager.php?action=delete-category
Remove category (cascades to prompts)
**Body:** `{ "id": 1 }`
**Response:** `{ success: true }`

#### POST /db/dmanager.php?action=add-prompt
Create new prompt with words
**Body:**
```json
{
  "text": "Prompt text",
  "category_id": 1,
  "words": ["WORD1", "WORD2", "WORD3"]
}
```
**Response:** `{ success: true, data: {prompt_id} }`

#### POST /db/dmanager.php?action=delete-prompt
Remove prompt (cascades to valid_words)
**Body:** `{ "id": 1 }`
**Response:** `{ success: true }`

#### POST /db/dmanager.php?action=import
Bulk import dictionary from JSON
**Body:** `{ "categorias": {...}, "consignas": {...} }`
**Response:** `{ success: true, data: {import stats} }`

#### POST /db/dmanager.php?action=save
Sync/save dictionary changes
**Body:** `{ "categorias": {...}, "consignas": {...} }`
**Response:** `{ success: true, data: {dictionary stats} }`

#### GET /db/dmanager.php?action=export
Export complete dictionary
**Response:** `{ success: true, data: {categorias, prompts} }`

---

### Game Management

#### GET /db/dmanager.php?action=get-games
Fetch all games with pagination
**Query Params:**
- `limit` (default: 100) - Results per page
- `offset` (default: 0) - Pagination offset
**Response:** `{ success: true, data: [{id, status, round, player_count, ...}, ...] }`

#### GET /db/dmanager.php?action=get-game?code=XXXX
Fetch specific game details
**Query Params:**
- `code` (required) - Game room code
**Response:** `{ success: true, data: {id, status, current_category, ...} }`

#### GET /db/dmanager.php?action=get-game-players?game_id=XXXX
Fetch all players in a game
**Query Params:**
- `game_id` (required) - Game ID
**Response:** `{ success: true, data: [{id, name, score, status, round_history}, ...] }`

#### GET /db/dmanager.php?action=get-player-stats?game_id=XXXX&player_id=YYYY
Fetch individual player statistics
**Query Params:**
- `game_id` (required) - Game ID
- `player_id` (required) - Player ID
**Response:** `{ success: true, data: {id, name, score, status, round_history, current_answers} }`

#### POST /db/dmanager.php?action=delete-game
Remove game (cascades to players)
**Body:** `{ "game_id": "XXXX" }`
**Response:** `{ success: true }`

#### POST /db/dmanager.php?action=delete-player
Remove player from game
**Body:** `{ "game_id": "XXXX", "player_id": "YYYY" }`
**Response:** `{ success: true }`

#### POST /db/dmanager.php?action=update-player-status
Change player connection/game status
**Body:** `{ "game_id": "XXXX", "player_id": "YYYY", "status": "disconnected" }`
**Valid Statuses:** `connected`, `ready`, `playing`, `disconnected`
**Response:** `{ success: true }`

---

### Database Maintenance

#### GET /db/dmanager.php?action=inspect
Inspect database health
**Response:** `{ success: true, data: {db_file_exists, db_file_readable, is_valid_sqlite, integrity_ok, table_count, index_count} }`

#### GET /db/dmanager.php?action=get-db
Export entire database (all tables)
**Response:** `{ success: true, data: {categories, prompts, words, games, players, stats} }`

#### POST /db/dmanager.php?action=optimize
Optimize database (remove orphans, VACUUM)
**Response:** `{ success: true, data: {before stats, issues, after stats} }`

#### POST /db/dmanager.php?action=diagnose
Run full diagnostics
**Response:** `{ success: true, data: {all diagnostic info} }`

#### POST /db/dmanager.php?action=repair
Repair corrupted database (recreates from scratch if needed)
**Response:** `{ success: true }`

#### POST /db/dmanager.php?action=nuke
Completely reset database (DESTRUCTIVE)
**Response:** `{ success: true }`

---

## AdminDictionary Class Methods

### Category Management
```php
$admin = new AdminDictionary();

// Get all categories
$categories = $admin->getCategoriesFull();

// Get specific category
$category = $admin->getCategoryById($id);
$category = $admin->getCategoryByName($name);

// CRUD operations
$category = $admin->addCategory($name);
$admin->updateCategory($id, $newName);
$admin->deleteCategory($id);
```

### Prompt Management
```php
// Get prompts
$prompts = $admin->getPrompts();
$prompts = $admin->getPrompts($categoryId);  // Filter by category
$prompt = $admin->getPromptById($id);
$prompts = $admin->getPromptsWithStats($categoryId);

// CRUD operations
$promptId = $admin->addPrompt([$catId1, $catId2], "Prompt text");
$admin->updatePrompt($id, "New text", [$catId1, $catId2]);
$admin->deletePrompt($id);

// Relationships
$categoryIds = $admin->getPromptCategories($promptId);
```

### Word Management
```php
// Get words
$words = $admin->getValidWords();
$words = $admin->getValidWords($promptId);
$word = $admin->getValidWordById($id);

// CRUD operations
$wordId = $admin->addValidWord($promptId, "WORD_ENTRY");
$admin->updateValidWord($id, "NEW_WORD");
$admin->deleteValidWord($id);
$count = $admin->deleteValidWordsByPrompt($promptId);
```

### Statistics
```php
// Dictionary stats
$stats = $admin->getDictionaryStats();
// Returns: {categorias, total_palabras, categorias_detalle}

// Database inspection
$inspection = $admin->getDatabaseInspection();
// Returns: {categories, prompts, words, games, players, stats}
```

### Game Management
```php
// Get games
$games = $admin->getGames($limit, $offset);
$game = $admin->getGameByCode($code);
$players = $admin->getGamePlayers($gameId);
$stats = $admin->getPlayerStats($gameId, $playerId);

// Delete
$admin->deleteGame($gameId);
$admin->deletePlayer($gameId, $playerId);
$admin->updatePlayerStatus($gameId, $playerId, $status);
```

### Database Maintenance
```php
// Optimization
$admin->vacuumDatabase();
```

---

## AdminOperations Class Methods

New comprehensive operations for games and players analytics:

```php
$ops = new AdminOperations();

// Game queries
$games = $ops->getAllGamesWithDetails($limit, $offset);
$games = $ops->getActiveGames();
$games = $ops->getFinishedGames($limit, $offset);
$timestamps = $ops->getGameTimestamps($gameId);
$details = $ops->getGamePlayerDetails($gameId);

// Game operations
$ops->updateGameStatus($gameId, $status);
$ops->resetGameRound($gameId);
$ops->deleteGame($gameId);
$count = $ops->bulkDeleteGames([$id1, $id2, ...]);

// Cleanup
$count = $ops->cleanDisconnectedPlayers($maxIdleMs);
$count = $ops->archiveFinishedGames($maxAgeMs);

// Analytics
$analytics = $ops->getGameAnalytics($gameId);
$history = $ops->getPlayerGameHistory($playerId);
$stats = $ops->getPlayerCrossGameStats($playerId);

// Storage
$stats = $ops->getDatabaseStorageStats();
$export = $ops->exportGameData($gameId);
```

---

## Common Admin Tasks

### 1. Add New Category
```bash
curl -X POST http://localhost/db/dmanager.php?action=add-category \
  -H "Content-Type: application/json" \
  -d '{"name": "Frutas"}'
```

### 2. Add Prompt with Words
```bash
curl -X POST http://localhost/db/dmanager.php?action=add-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Frutas rojas",
    "category_id": 1,
    "words": ["FRESA", "SANDÍA", "CEREZA", "TOMATE"]
  }'
```

### 3. Export Dictionary
```bash
curl http://localhost/db/dmanager.php?action=export
```

### 4. Check Database Health
```bash
curl http://localhost/db/dmanager.php?action=inspect
```

### 5. Optimize Database
```bash
curl -X POST http://localhost/db/dmanager.php?action=optimize
```

### 6. Get Game Analytics
Use `AdminOperations::getGameAnalytics()` or the UI dashboard

### 7. Clean Old Games
Use `AdminOperations::archiveFinishedGames()` to remove old games

### 8. Get Player Cross-Game Stats
Use `AdminOperations::getPlayerCrossGameStats()` for performance analysis

---

## Performance Indexes

Automatically created for optimization:

- `idx_players_game_id` - Fast player lookups by game
- `idx_prompt_categories_prompt` - Prompt to categories
- `idx_prompt_categories_category` - Category to prompts
- `idx_valid_words_prompt_id` - Words by prompt
- `idx_games_status` - Filter games by status
- `idx_games_updated_at` - Recent game queries

---

## Database Configuration

### SQLite Pragmas
```sql
PRAGMA foreign_keys = ON;           -- Enforce referential integrity
PRAGMA journal_mode = WAL;          -- Write-Ahead Logging for concurrency
PRAGMA synchronous = NORMAL;        -- Balance safety and performance
```

### Data Normalization
- All words stored as UPPERCASE
- Timestamps in milliseconds (Unix * 1000)
- JSON for flexible data storage

---

## Monitoring & Maintenance Schedule

### Daily
- Review `/logs/dmanager.log` for errors
- Monitor active games count

### Weekly
- Run `optimize` action
- Export and backup dictionary
- Check database size

### Monthly
- Analyze player performance trends
- Review prompt effectiveness
- Archive old games (>30 days finished)
- Update prompts based on feedback

### As Needed
- Use `repair` to fix corruption
- Use `nuke` for complete reset (careful!)
- Manual cleanup with `cleanDisconnectedPlayers()`

---

## Security Notes

1. **Authentication:** Add authentication layer before exposing admin endpoints to public
2. **Logs:** Check `/logs/dmanager.log` for security events
3. **Backups:** Regular exports recommended before major changes
4. **Destructive Operations:** `nuke` and `repair` operations are destructive

---

## Troubleshooting

### Database Corruption
```bash
# Run diagnostics
curl http://localhost/db/dmanager.php?action=diagnose

# Attempt repair
curl -X POST http://localhost/db/dmanager.php?action=repair

# If repair fails, use nuke (clears everything)
curl -X POST http://localhost/db/dmanager.php?action=nuke
```

### Slow Queries
```bash
# Optimize database
curl -X POST http://localhost/db/dmanager.php?action=optimize
```

### Lost Player Data
Check `round_history` in players table - contains full game history

### Import Issues
Use `import` endpoint instead of `save` to merge data without overwriting

---

## References

- `SQLITE_SCHEMA.sql` - Complete schema definition
- `VERIFICATION_REPORT.md` - Structure verification details
- `API_ENDPOINTS.md` - Detailed endpoint documentation
- `DATABASE_REPAIR_GUIDE.txt` - Troubleshooting procedures
