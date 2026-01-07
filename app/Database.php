<?php

class Database {
    private static $instance = null;
    private $pdo = null;
    private $dbPath = null;
    private static $tablesInitialized = false;

    private function __construct() {
        $this->dbPath = __DIR__ . '/../data/talcual.db';
        $this->connect();
    }

    private function connect() {
        $dataDir = dirname($this->dbPath);
        
        if (!is_dir($dataDir)) {
            throw new Exception('Data directory does not exist: ' . $dataDir);
        }
        
        if (!is_writable($dataDir)) {
            throw new Exception('Data directory is not writable: ' . $dataDir);
        }

        try {
            $this->pdo = new PDO(
                'sqlite:' . $this->dbPath,
                null,
                null,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_TIMEOUT => 30
                ]
            );

            $this->pdo->exec('PRAGMA journal_mode = WAL');
            $this->pdo->exec('PRAGMA foreign_keys = ON');
            $this->pdo->exec('PRAGMA synchronous = NORMAL');
            $this->pdo->exec('PRAGMA wal_autocheckpoint = 1000');

            logMessage('SQLite connected: ' . $this->dbPath, 'DEBUG');

        } catch (PDOException $e) {
            logMessage('SQLite connection failed: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database connection error: ' . $e->getMessage());
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
            if (!self::$tablesInitialized) {
                self::$instance->initializeTables();
                self::$tablesInitialized = true;
            }
        }
        return self::$instance;
    }

    private function initializeTables() {
        try {
            $this->pdo->exec('PRAGMA foreign_keys = ON');
            
            $this->pdo->exec('CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                orden INTEGER NOT NULL DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                date INTEGER NOT NULL DEFAULT 0
            )');

            $this->pdo->exec('CREATE TABLE IF NOT EXISTS prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT UNIQUE NOT NULL,
                difficulty INTEGER DEFAULT 1,
                is_active BOOLEAN DEFAULT 1,
                date INTEGER NOT NULL DEFAULT 0
            )');

            $this->pdo->exec('CREATE TABLE IF NOT EXISTS prompt_categories (
                prompt_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                PRIMARY KEY (prompt_id, category_id),
                FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            )');

            $this->pdo->exec('CREATE TABLE IF NOT EXISTS valid_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id INTEGER NOT NULL,
                word_group TEXT NOT NULL,
                FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
                UNIQUE(prompt_id, word_group)
            )');

            $this->pdo->exec('CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                original_id TEXT,
                
                status TEXT NOT NULL DEFAULT "waiting",
                round INTEGER NOT NULL DEFAULT 0,
                current_prompt_id INTEGER,
                current_category_id INTEGER,
                selected_category_id INTEGER,
                
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
                FOREIGN KEY (current_category_id) REFERENCES categories(id),
                FOREIGN KEY (selected_category_id) REFERENCES categories(id)
            )');

            $this->pdo->exec('CREATE TABLE IF NOT EXISTS players (
                id TEXT NOT NULL,
                game_id TEXT NOT NULL,
                
                name TEXT NOT NULL,
                aura TEXT,
                
                status TEXT DEFAULT "connected",
                last_heartbeat INTEGER,
                
                score INTEGER DEFAULT 0,
                round_history TEXT DEFAULT "{}",
                answers TEXT DEFAULT "",
                
                PRIMARY KEY (id, game_id),
                FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
            )');

            $this->createIndexes();
            $this->migrateSchema();
            
            logMessage('Database tables initialized successfully', 'DEBUG');

        } catch (PDOException $e) {
            logMessage('Error initializing tables: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database initialization error: ' . $e->getMessage());
        }
    }

    private function createIndexes() {
        $indexes = [
            'CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)',
            'CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_games_original_id ON games(original_id)',
            'CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id)',
            'CREATE INDEX IF NOT EXISTS idx_valid_words_prompt ON valid_words(prompt_id)',
            'CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active)',
            'CREATE INDEX IF NOT EXISTS idx_categories_orden ON categories(orden)',
            'CREATE INDEX IF NOT EXISTS idx_prompts_active ON prompts(is_active)',
            'CREATE INDEX IF NOT EXISTS idx_prompts_difficulty ON prompts(difficulty)',
            'CREATE INDEX IF NOT EXISTS idx_prompt_categories_prompt ON prompt_categories(prompt_id)',
            'CREATE INDEX IF NOT EXISTS idx_prompt_categories_category ON prompt_categories(category_id)'
        ];
        
        try {
            foreach ($indexes as $sql) {
                $this->pdo->exec($sql);
            }
        } catch (PDOException $e) {
            logMessage('Index creation warning: ' . $e->getMessage(), 'WARN');
        }
    }

    private function migrateSchema() {
        try {
            $tableInfo = $this->pdo->query("PRAGMA table_info(categories)")->fetchAll(PDO::FETCH_COLUMN, 1);
            
            if (!in_array('orden', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE categories ADD COLUMN orden INTEGER NOT NULL DEFAULT 0');
            }
            if (!in_array('is_active', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE categories ADD COLUMN is_active BOOLEAN DEFAULT 1');
            }
            if (!in_array('date', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE categories ADD COLUMN date INTEGER NOT NULL DEFAULT 0');
            }
            
            $tableInfo = $this->pdo->query("PRAGMA table_info(prompts)")->fetchAll(PDO::FETCH_COLUMN, 1);
            if (!in_array('difficulty', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE prompts ADD COLUMN difficulty INTEGER DEFAULT 1');
            }
            if (!in_array('is_active', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE prompts ADD COLUMN is_active BOOLEAN DEFAULT 1');
            }
            if (!in_array('date', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE prompts ADD COLUMN date INTEGER NOT NULL DEFAULT 0');
            }
            
            $tableInfo = $this->pdo->query("PRAGMA table_info(valid_words)")->fetchAll(PDO::FETCH_COLUMN, 1);
            if (!in_array('word_group', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE valid_words ADD COLUMN word_group TEXT');
                $this->pdo->exec('UPDATE valid_words SET word_group = word WHERE word_group IS NULL');
            }
            
            $tableInfo = $this->pdo->query("PRAGMA table_info(games)")->fetchAll(PDO::FETCH_COLUMN, 1);
            if (!in_array('current_prompt_id', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE games ADD COLUMN current_prompt_id INTEGER');
            }
            if (!in_array('current_category_id', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE games ADD COLUMN current_category_id INTEGER');
            }
            if (!in_array('selected_category_id', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE games ADD COLUMN selected_category_id INTEGER');
            }
            if (!in_array('original_id', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE games ADD COLUMN original_id TEXT');
            }
            if (!in_array('version', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE games ADD COLUMN version INTEGER DEFAULT 0');
            }
            if (!in_array('locked_until', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE games ADD COLUMN locked_until INTEGER');
            }
            if (!in_array('metadata', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE games ADD COLUMN metadata TEXT');
            }
            
            $tableInfo = $this->pdo->query("PRAGMA table_info(players)")->fetchAll(PDO::FETCH_COLUMN, 1);
            if (!in_array('aura', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE players ADD COLUMN aura TEXT');
            }
            if (!in_array('last_heartbeat', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE players ADD COLUMN last_heartbeat INTEGER');
            }
            if (!in_array('answers', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE players ADD COLUMN answers TEXT DEFAULT ""');
                logMessage('Migration: added answers column to players', 'INFO');
            }
            
            logMessage('Schema migration completed', 'INFO');
        } catch (PDOException $e) {
            logMessage('Schema migration error: ' . $e->getMessage(), 'WARN');
        }
    }

    public function getConnection() {
        if ($this->pdo === null) {
            $this->connect();
        }
        return $this->pdo;
    }

    public function getDatabasePath() {
        return $this->dbPath;
    }

    public function checkpoint() {
        try {
            $this->getConnection()->exec('PRAGMA wal_checkpoint(RESTART)');
            logMessage('WAL checkpoint completed', 'DEBUG');
        } catch (PDOException $e) {
            logMessage('WAL checkpoint failed: ' . $e->getMessage(), 'ERROR');
        }
    }

    public function beginTransaction() {
        try {
            $this->getConnection()->beginTransaction();
        } catch (PDOException $e) {
            logMessage('Transaction begin failed: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Transaction error: ' . $e->getMessage());
        }
    }

    public function commit() {
        try {
            $this->getConnection()->commit();
            $this->checkpoint();
        } catch (PDOException $e) {
            logMessage('Transaction commit failed: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Transaction error: ' . $e->getMessage());
        }
    }

    public function rollback() {
        try {
            $this->getConnection()->rollBack();
        } catch (PDOException $e) {
            logMessage('Transaction rollback failed: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Transaction error: ' . $e->getMessage());
        }
    }

    public function prepare($sql) {
        try {
            return $this->getConnection()->prepare($sql);
        } catch (PDOException $e) {
            logMessage('Prepare failed: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database prepare error: ' . $e->getMessage());
        }
    }

    public function execute($sql, $params = []) {
        try {
            $stmt = $this->prepare($sql);
            $stmt->execute($params);
            return $stmt;
        } catch (PDOException $e) {
            logMessage('Execute failed: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database execute error: ' . $e->getMessage());
        }
    }

    public function lastInsertId() {
        return $this->getConnection()->lastInsertId();
    }

    public function __destruct() {
        if ($this->pdo !== null) {
            try {
                $this->checkpoint();
            } catch (Exception $e) {
            }
        }
    }
}
?>