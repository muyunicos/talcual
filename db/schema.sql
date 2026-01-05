-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prompts (Questions/Clues)
CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prompt-Category Relationships (One prompt can belong to multiple categories)
CREATE TABLE IF NOT EXISTS prompt_categories (
    prompt_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (prompt_id, category_id),
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Valid Answers
CREATE TABLE IF NOT EXISTS valid_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id INTEGER NOT NULL,
    word_entry TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
);

-- Games
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'waiting',
    round INTEGER DEFAULT 0,
    total_rounds INTEGER DEFAULT 3,
    current_prompt_id INTEGER,
    round_data JSON,
    round_started_at INTEGER,
    round_duration INTEGER,
    countdown_duration INTEGER,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (current_prompt_id) REFERENCES prompts(id) ON DELETE SET NULL
);

-- Players
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'waiting',
    answers JSON,
    disconnected BOOLEAN DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompts_categories ON prompt_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_valid_words_prompt ON valid_words(prompt_id);
CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_updated ON games(updated_at);
