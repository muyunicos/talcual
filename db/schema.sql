PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT CAST(strftime('%s') AS INTEGER)
);

CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT UNIQUE NOT NULL,
    difficulty INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT CAST(strftime('%s') AS INTEGER)
);

CREATE TABLE IF NOT EXISTS prompt_categories (
    prompt_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (prompt_id, category_id),
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS valid_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id INTEGER NOT NULL,
    word_entry TEXT NOT NULL,
    normalized_word TEXT NOT NULL,
    gender TEXT,
    created_at INTEGER DEFAULT CAST(strftime('%s') AS INTEGER),
    UNIQUE(prompt_id, normalized_word),
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'waiting',
    round INTEGER NOT NULL DEFAULT 0,
    current_prompt_id INTEGER,
    current_category_id INTEGER,
    selected_category_id INTEGER,
    round_started_at INTEGER,
    round_starts_at INTEGER,
    round_ends_at INTEGER,
    countdown_duration INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER,
    total_rounds INTEGER NOT NULL DEFAULT 3,
    round_duration INTEGER NOT NULL DEFAULT 60000,
    min_players INTEGER NOT NULL DEFAULT 2,
    max_players INTEGER NOT NULL DEFAULT 4,
    start_countdown INTEGER NOT NULL DEFAULT 5000,
    hurry_up_threshold INTEGER NOT NULL DEFAULT 10,
    max_words_per_player INTEGER NOT NULL DEFAULT 3,
    max_word_length INTEGER NOT NULL DEFAULT 20,
    data TEXT,
    FOREIGN KEY (current_prompt_id) REFERENCES prompts(id),
    FOREIGN KEY (current_category_id) REFERENCES categories(id),
    FOREIGN KEY (selected_category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS players (
    id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    avatar TEXT,
    status TEXT DEFAULT 'connected',
    disconnected BOOLEAN DEFAULT 0,
    score INTEGER DEFAULT 0,
    current_answers TEXT,
    round_history TEXT DEFAULT '{}',
    last_heartbeat INTEGER,
    last_submission_at INTEGER,
    PRIMARY KEY (id, game_id),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_orden ON categories(orden);
CREATE INDEX IF NOT EXISTS idx_prompts_active ON prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_prompts_difficulty ON prompts(difficulty);
CREATE INDEX IF NOT EXISTS idx_prompt_categories_prompt ON prompt_categories(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_categories_category ON prompt_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_valid_words_prompt ON valid_words(prompt_id);
CREATE INDEX IF NOT EXISTS idx_valid_words_normalized ON valid_words(prompt_id, normalized_word);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at);
CREATE INDEX IF NOT EXISTS idx_games_category ON games(current_category_id);
CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_players_status_game ON players(status, game_id);
CREATE INDEX IF NOT EXISTS idx_players_heartbeat ON players(last_heartbeat);