<?php

class Database {
    private static $instance = null;
    private $pdo = null;
    private $dbPath = null;
    private static $tablesInitialized = false;

    private function __construct() {
        $this->dbPath = __DIR__ . '/../data/talcual.db';
        $this->ensureDataDirectory();
        $this->connect();
    }

    private function ensureDataDirectory() {
        $dataDir = dirname($this->dbPath);
        if (!is_dir($dataDir)) {
            if (!@mkdir($dataDir, 0755, true)) {
                throw new Exception('No se pudo crear directorio de datos: ' . $dataDir);
            }
        }
        if (!is_writable($dataDir)) {
            throw new Exception('Directorio de datos no tiene permisos de escritura: ' . $dataDir);
        }
    }

    private function connect() {
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
                category_id INTEGER NOT NULL,
                text TEXT NOT NULL,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            )');

            $this->pdo->exec('CREATE INDEX IF NOT EXISTS idx_prompts_category_id ON prompts(category_id)');

            $this->pdo->exec('CREATE TABLE IF NOT EXISTS valid_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id INTEGER NOT NULL,
                word_entry TEXT NOT NULL,
                FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
            )');

            $this->pdo->exec('CREATE INDEX IF NOT EXISTS idx_valid_words_prompt_id ON valid_words(prompt_id)');

            logMessage('Database tables initialized successfully', 'DEBUG');

        } catch (PDOException $e) {
            logMessage('Error initializing tables: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database initialization error: ' . $e->getMessage());
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
