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
                
                -- Estado del Flujo del Juego
                status TEXT NOT NULL DEFAULT "waiting",  -- waiting, playing, finished
                round INTEGER NOT NULL DEFAULT 0,
                current_prompt TEXT,                     -- Snapshot de la pregunta actual
                current_category TEXT,                   -- Categoría de la ronda actual
                selected_category TEXT,                  -- Categoría forzada para todo el juego (si aplica)
                
                -- Tiempos: Sincronización y Recuperación
                round_started_at INTEGER,                -- Timestamp (ms) inicio real de la ronda (pre-countdown)
                round_starts_at INTEGER,                 -- Timestamp (ms) inicio de acción (post-countdown, para SSE sync)
                round_ends_at INTEGER,                   -- Timestamp (ms) fin de ronda (ajustable por Hurry Up)
                countdown_duration INTEGER,              -- Duración del countdown en ms (snapshot de configuración)
                created_at INTEGER,                      -- Timestamp creación de partida
                updated_at INTEGER,                      -- Timestamp última modificación (heartbeat)
                
                -- SNAPSHOT DE CONFIGURACIÓN (Inmutable para esta partida)
                total_rounds INTEGER NOT NULL,
                round_duration INTEGER NOT NULL,         -- Duración base de ronda en ms
                min_players INTEGER NOT NULL,
                max_players INTEGER NOT NULL,
                start_countdown INTEGER,                 -- DEPRECATED: usar countdown_duration
                hurry_up_threshold INTEGER,              -- Segundos para activar "Hurry Up"
                max_words_per_player INTEGER,            -- Límite de palabras por jugador
                max_word_length INTEGER,                 -- Límite de caracteres por palabra
                
                -- Datos Flexibles / No Estructurados
                data TEXT                                -- JSON para metadatos extra (prompts usados, etc.)
            )');

            $this->pdo->exec('CREATE TABLE IF NOT EXISTS players (
                id TEXT NOT NULL,
                game_id TEXT NOT NULL,
                
                -- Identidad y Personalización
                name TEXT NOT NULL,
                color TEXT,
                avatar TEXT,
                
                -- Estado de Conexión
                status TEXT DEFAULT "connected",        -- connected, ready, playing, disconnected
                
                -- Estado de Juego Actual
                score INTEGER DEFAULT 0,                 -- Puntaje acumulado (cache para no recalcular siempre)
                current_answers TEXT,                    -- JSON Array: Respuestas de la ronda actual (borrador)
                
                -- Historial Completo (State Recovery)
                -- JSON Object: { "1": { "words": [...], "points": 10 }, "2": ... }
                round_history TEXT DEFAULT "{}",
                
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
