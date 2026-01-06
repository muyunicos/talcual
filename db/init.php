<?php
$dbPath = __DIR__ . '/../data/talcual.db';
$dirPath = dirname($dbPath);

if (!is_dir($dirPath)) {
    mkdir($dirPath, 0755, true);
}

try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA synchronous = NORMAL');
    $pdo->exec('PRAGMA foreign_keys = ON');

    $pdo->exec('
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            orden INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            date INTEGER,
            UNIQUE(name)
        )
    ');

    $pdo->exec('
        CREATE TABLE IF NOT EXISTS prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT UNIQUE NOT NULL,
            difficulty INTEGER DEFAULT 1,
            is_active BOOLEAN DEFAULT 1,
            date INTEGER,
            UNIQUE(text)
        )
    ');

    $pdo->exec('
        CREATE TABLE IF NOT EXISTS prompt_categories (
            prompt_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            PRIMARY KEY (prompt_id, category_id),
            FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        )
    ');

    $pdo->exec('
        CREATE TABLE IF NOT EXISTS words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt_id INTEGER NOT NULL,
            word TEXT NOT NULL,
            FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
            UNIQUE(prompt_id, word)
        )
    ');

    $pdo->exec('
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            original_id TEXT,
            status TEXT NOT NULL DEFAULT "waiting",
            round INTEGER NOT NULL DEFAULT 0,
            current_prompt_id INTEGER,
            current_category_id INTEGER,
            created_at INTEGER NOT NULL,
            round_starts_at INTEGER,
            round_ends_at INTEGER,
            updated_at INTEGER,
            total_rounds INTEGER NOT NULL,
            round_duration INTEGER NOT NULL,
            min_players INTEGER NOT NULL,
            max_players INTEGER NOT NULL,
            countdown_duration INTEGER,
            hurry_up_threshold INTEGER,
            max_words_per_player INTEGER,
            max_word_length INTEGER,
            version INTEGER DEFAULT 0,
            locked_until INTEGER,
            metadata TEXT,
            FOREIGN KEY (current_prompt_id) REFERENCES prompts(id),
            FOREIGN KEY (current_category_id) REFERENCES categories(id)
        )
    ');

    $pdo->exec('
        CREATE TABLE IF NOT EXISTS players (
            id TEXT NOT NULL,
            game_id TEXT NOT NULL,
            name TEXT NOT NULL,
            aura TEXT,
            status TEXT DEFAULT "connected",
            last_heartbeat INTEGER,
            score INTEGER DEFAULT 0,
            round_history TEXT DEFAULT "{}",
            PRIMARY KEY (id, game_id),
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
        )
    ');

    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_games_original_id ON games(original_id)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_words_prompt ON words(prompt_id)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_prompts_active ON prompts(is_active)');

    echo json_encode(['success' => true, 'message' => 'Database initialized']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
