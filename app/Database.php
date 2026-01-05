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
            $this->pdo->exec('CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                round INTEGER NOT NULL DEFAULT 0,
                total_rounds INTEGER NOT NULL DEFAULT 0,
                current_prompt TEXT,
                current_category TEXT,
                selected_category TEXT,
                min_players INTEGER NOT NULL DEFAULT 2,
                round_duration INTEGER,
                countdown_duration INTEGER,
                round_started_at INTEGER,
                round_starts_at INTEGER,
                round_ends_at INTEGER,
                data TEXT NOT NULL,
                updated_at INTEGER NOT NULL DEFAULT 0
            )');

            $this->pdo->exec('CREATE TABLE IF NOT EXISTS players (
                id TEXT NOT NULL,
                game_id TEXT NOT NULL,
                name TEXT NOT NULL,
                score INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT "connected",
                color TEXT,
                answers TEXT NOT NULL DEFAULT "[]",
                round_results TEXT NOT NULL DEFAULT "{}",
                disconnected INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (id, game_id),
                FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
            )');

            $this->pdo->exec('CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id)');

            $this->pdo->exec('CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )');

            $this->pdo->exec('CREATE TABLE IF NOT EXISTS prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL UNIQUE
            )');

            $this->pdo->exec('CREATE TABLE IF NOT EXISTS prompt_categories (
                prompt_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                PRIMARY KEY (prompt_id, category_id),
                FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            )');

            $this->pdo->exec('CREATE INDEX IF NOT EXISTS idx_prompt_categories_prompt ON prompt_categories(prompt_id)');
            $this->pdo->exec('CREATE INDEX IF NOT EXISTS idx_prompt_categories_category ON prompt_categories(category_id)');

            $this->pdo->exec('CREATE TABLE IF NOT EXISTS valid_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id INTEGER NOT NULL,
                word_entry TEXT NOT NULL,
                FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
            )');

            $this->pdo->exec('CREATE INDEX IF NOT EXISTS idx_valid_words_prompt_id ON valid_words(prompt_id)');

            $this->migratePromptCategories();

            logMessage('Database tables initialized successfully', 'DEBUG');

        } catch (PDOException $e) {
            logMessage('Error initializing tables: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database initialization error: ' . $e->getMessage());
        }
    }

    private function migratePromptCategories() {
        try {
            $stmt = $this->pdo->query("PRAGMA table_info(prompts)");
            $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $hasOldColumn = false;

            foreach ($columns as $column) {
                if ($column['name'] === 'category_id') {
                    $hasOldColumn = true;
                    break;
                }
            }

            if (!$hasOldColumn) {
                return;
            }

            logMessage('Migrating prompts.category_id to prompt_categories', 'INFO');

            $stmt = $this->pdo->query('SELECT id, category_id FROM prompts WHERE category_id IS NOT NULL');
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $insertStmt = $this->pdo->prepare('INSERT OR IGNORE INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)');
            foreach ($rows as $row) {
                $insertStmt->execute([$row['id'], $row['category_id']]);
            }

            $this->pdo->exec('CREATE TABLE prompts_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL UNIQUE
            )');

            $this->pdo->exec('INSERT INTO prompts_new (id, text) SELECT id, text FROM prompts');
            $this->pdo->exec('DROP TABLE prompts');
            $this->pdo->exec('ALTER TABLE prompts_new RENAME TO prompts');

            logMessage('Migration completed: ' . count($rows) . ' records migrated and category_id column removed', 'INFO');
        } catch (Exception $e) {
            logMessage('Migration error (non-critical): ' . $e->getMessage(), 'WARNING');
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
