-- ============================================================================
-- TalCual Game Database Schema (SQLite 3)
-- ============================================================================
-- Administration tool for managing the TalCual word game database.
-- This separate app handles dictionary, games, and player analytics.
-- Executed by administrators to maintain game integrity and performance.
-- ============================================================================

-- ============================================================================
-- DICTIONARY TABLES
-- ============================================================================

-- 1. CATEGORIES - Game categories (e.g., "Things in the Kitchen", "Car Brands")
-- Provides grouping for prompts and thematic organization of words.
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

-- 2. PROMPTS - Questions/Clues (e.g., "Wooden utensils", "Japanese brands")
-- Separated from categories to allow prompt reuse across multiple categories.
-- A single prompt can apply to different category contexts.
CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL UNIQUE
);

-- 3. PROMPT_CATEGORIES - Many-to-Many relationship
-- Enables a single prompt to be used in multiple categories.
-- Example: "Red things" can be a prompt for both "Colors" and "Fruits" categories.
CREATE TABLE IF NOT EXISTS prompt_categories (
    prompt_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (prompt_id, category_id),
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- 4. VALID_WORDS - Correct answers for each prompt
-- Stores all acceptable words/answers for a given prompt.
-- Words are normalized to UPPERCASE for comparison.
CREATE TABLE IF NOT EXISTS valid_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id INTEGER NOT NULL,
    word_entry TEXT NOT NULL,
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
);

-- ============================================================================
-- GAME STATE TABLES
-- ============================================================================

-- 1. GAMES - Current and historical game state
-- Stores complete game configuration and state snapshot.
-- Immutable configuration ensures all players follow same rules for a game.
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,                          -- Room code (e.g., "ABCD")
    
    -- Game Flow Status
    status TEXT NOT NULL DEFAULT 'waiting',       -- 'waiting', 'playing', 'finished'
    round INTEGER NOT NULL DEFAULT 0,             -- Current round number
    current_prompt TEXT,                          -- Current question text (snapshot, not ID)
    current_category TEXT,                        -- Category for this round
    selected_category TEXT,                       -- Forced category (if any)
    
    -- Timing (for synchronization and state recovery)
    round_started_at INTEGER,                     -- Timestamp (ms) when round actually started
    round_starts_at INTEGER,                      -- Timestamp (ms) when action begins (post-countdown)
    round_ends_at INTEGER,                        -- Timestamp (ms) when round ends (adjustable by Hurry Up)
    countdown_duration INTEGER,                   -- Duration of countdown in ms
    created_at INTEGER,                           -- Game creation timestamp
    updated_at INTEGER,                           -- Last modification (heartbeat)
    
    -- Configuration Snapshot (immutable for this game)
    -- These values are locked when game starts - prevents mid-game rule changes
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

-- 2. PLAYERS - Participant identities and game history
-- Complete record of each player across all games.
-- Enables recovery and analytics on player performance.
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
    -- JSON Object: { "1": { "words": [...], "points": 10 }, "2": ... }
    round_history TEXT DEFAULT '{}',              -- Complete round-by-round performance
    
    PRIMARY KEY (id, game_id),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES - Performance optimization
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_prompt_categories_prompt ON prompt_categories(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_categories_category ON prompt_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_valid_words_prompt_id ON valid_words(prompt_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at);

-- ============================================================================
-- PRAGMAS - Database configuration
-- ============================================================================
-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Use WAL mode for better concurrency
PRAGMA journal_mode = WAL;

-- Balance between safety and performance
PRAGMA synchronous = NORMAL;

-- ============================================================================
-- SCHEMA DESIGN RATIONALE
-- ============================================================================
--
-- DICTIONARY STRUCTURE:
-- - Categories are grouped containers for thematic organization
-- - Prompts are reusable question templates
-- - Prompt_Categories junction table enables many-to-many relationships
-- - Valid_Words stores all acceptable answers (normalized to UPPERCASE)
--
-- This separation allows:
--   * Reusing the same prompt across different categories
--   * Efficient category filtering
--   * Isolated word validation logic
--   * Easy expansion to new categories without prompt duplication
--
-- GAME STATE STRUCTURE:
-- - Games table stores immutable configuration snapshot
--   Prevents rule changes mid-game, ensures fair play
-- - Players table tracks individual performance and connection state
-- - Separate storage of current_answers (draft) vs round_history (final)
-- - JSON fields for flexible, schema-free data (metadata, custom data)
--
-- TIMING STRATEGY:
-- - round_started_at: When actual game round begins
-- - round_starts_at: When player interaction begins (after countdown)
-- - round_ends_at: When answers stop being accepted (adjustable for Hurry Up)
-- - allows accurate time tracking and recovery from interruptions
--
-- PLAYER RECOVERY:
-- - round_history as JSON object keyed by round number
-- - current_answers for in-flight data (not yet finalized)
-- - allows server to reconstruct game state even after disconnection
-- - supports analytics on per-round performance
-- ============================================================================
