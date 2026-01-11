<?php

define('LOG_LEVEL_ERROR', 1);
define('LOG_LEVEL_WARN', 2);
define('LOG_LEVEL_INFO', 3);
define('LOG_LEVEL_DEBUG', 4);

function logMessage($message, $level = 'INFO') {
    $levelMap = ['ERROR' => LOG_LEVEL_ERROR, 'WARN' => LOG_LEVEL_WARN, 'INFO' => LOG_LEVEL_INFO, 'DEBUG' => LOG_LEVEL_DEBUG];
    $currentLevel = $levelMap[$level] ?? LOG_LEVEL_INFO;

    if ($currentLevel > LOG_LEVEL_INFO) {
        return;
    }

    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[{$timestamp}] [{$level}] {$message}\n";
    error_log($logMessage);
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

set_error_handler(function($severity, $message, $file, $line) {
    logMessage("PHP Error [$severity]: $message in $file:$line", 'ERROR');
    respondError("Server error: $message");
    exit;
});

class DatabaseConnection {
    private static $instance = null;
    private $pdo = null;
    private $dbPath = null;
    private $inTransaction = false;

    private function __construct() {
        $this->dbPath = __DIR__ . '/../data/talcual.db';
        $this->connect();
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function connect() {
        try {
            $this->pdo = new PDO('sqlite:' . $this->dbPath, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);

            $this->pdo->exec('PRAGMA journal_mode = WAL');
            $this->pdo->exec('PRAGMA foreign_keys = ON');
            $this->pdo->exec('PRAGMA synchronous = NORMAL');
            $this->pdo->exec('PRAGMA wal_autocheckpoint = 1000');
        } catch (PDOException $e) {
            throw new Exception('Database connection error: ' . $e->getMessage());
        }
    }

    public function getConnection() {
        return $this->pdo;
    }

    public function getDatabasePath() {
        return $this->dbPath;
    }

    public function beginTransaction() {
        if (!$this->inTransaction) {
            $this->pdo->beginTransaction();
            $this->inTransaction = true;
        }
    }

    public function commit() {
        if ($this->inTransaction) {
            $this->pdo->commit();
            $this->inTransaction = false;
        }
    }

    public function rollback() {
        if ($this->inTransaction) {
            $this->pdo->rollBack();
            $this->inTransaction = false;
        }
    }

    public function isInTransaction() {
        return $this->inTransaction;
    }
}

class DatabaseManager {
    private $db = null;
    private $pdo = null;

    public function __construct() {
        $this->db = DatabaseConnection::getInstance();
        $this->pdo = $this->db->getConnection();
        $this->ensureSchemaInitialized();
    }

    private function ensureSchemaInitialized() {
        try {
            $result = $this->pdo->query(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='categories' LIMIT 1"
            )->fetch();

            if (!$result) {
                logMessage('Schema not found, initializing...', 'INFO');
                $this->initializeDatabase();
                $this->createIndexes();
                $this->runMigrations();
                logMessage('Schema initialized successfully', 'INFO');
            } else {
                $this->runMigrations();
            }
        } catch (Exception $e) {
            logMessage('Schema initialization check error: ' . $e->getMessage(), 'ERROR');
        }
    }

    private function initializeDatabase() {
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

            logMessage('Database tables created successfully', 'INFO');
        } catch (PDOException $e) {
            logMessage('Error creating database tables: ' . $e->getMessage(), 'ERROR');
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
            logMessage('Database indexes created successfully', 'INFO');
        } catch (PDOException $e) {
            logMessage('Index creation warning: ' . $e->getMessage(), 'WARN');
        }
    }

    private function runMigrations() {
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
            }

            logMessage('Schema migration completed', 'INFO');
        } catch (PDOException $e) {
            logMessage('Schema migration error: ' . $e->getMessage(), 'WARN');
        }
    }

    public function getHealth() {
        try {
            $this->pdo->query('SELECT 1');
            $stats = $this->getDictionaryStats();

            return [
                'success' => true,
                'status' => 'HEALTHY',
                'database' => $this->db->getDatabasePath(),
                'stats' => $stats,
                'timestamp' => date('Y-m-d H:i:s')
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'status' => 'ERROR',
                'message' => $e->getMessage(),
                'timestamp' => date('Y-m-d H:i:s')
            ];
        }
    }

    public function getDictionaryStats() {
        try {
            $categoryCount = $this->pdo->query('SELECT COUNT(*) as count FROM categories WHERE is_active = 1')->fetch()['count'];
            $promptCount = $this->pdo->query('SELECT COUNT(*) as count FROM prompts WHERE is_active = 1')->fetch()['count'];
            $wordCount = $this->pdo->query('SELECT COUNT(*) as count FROM valid_words')->fetch()['count'];
            $gameCount = $this->pdo->query('SELECT COUNT(*) as count FROM games')->fetch()['count'];
            $playerCount = $this->pdo->query('SELECT COUNT(*) as count FROM players')->fetch()['count'];

            return [
                'categories' => (int)$categoryCount,
                'prompts' => (int)$promptCount,
                'words' => (int)$wordCount,
                'games' => (int)$gameCount,
                'players' => (int)$playerCount
            ];
        } catch (Exception $e) {
            logMessage('Error fetching stats: ' . $e->getMessage(), 'ERROR');
            return [
                'categories' => 0,
                'prompts' => 0,
                'words' => 0,
                'games' => 0,
                'players' => 0
            ];
        }
    }

    public function getAllCategories() {
        $stmt = $this->pdo->query('SELECT id, name, orden, is_active, date FROM categories ORDER BY orden, name');
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function getCategoryById($id) {
        $stmt = $this->pdo->prepare('SELECT id, name, orden, is_active, date FROM categories WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getCategoryByName($name) {
        $stmt = $this->pdo->prepare('SELECT id, name, orden, is_active, date FROM categories WHERE name = ?');
        $stmt->execute([$name]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function addCategory($name, $orden = null) {
        if (empty(trim($name))) {
            throw new Exception('Category name cannot be empty');
        }

        if ($orden === null) {
            $result = $this->pdo->query('SELECT MAX(orden) as max_orden FROM categories')->fetch(PDO::FETCH_ASSOC);
            $orden = (int)($result['max_orden'] ?? 0) + 1;
        }

        try {
            $stmt = $this->pdo->prepare('INSERT INTO categories (name, orden, is_active, date) VALUES (?, ?, 1, 0)');
            $stmt->execute([$name, $orden]);
            return $this->getCategoryById($this->pdo->lastInsertId());
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'UNIQUE constraint failed') !== false) {
                throw new Exception('Category already exists');
            }
            throw $e;
        }
    }

    public function updateCategory($id, $name = null, $orden = null, $is_active = null) {
        $updates = [];
        $params = [];

        if ($name !== null) {
            $updates[] = 'name = ?';
            $params[] = $name;
        }
        if ($orden !== null) {
            $updates[] = 'orden = ?';
            $params[] = $orden;
        }
        if ($is_active !== null) {
            $updates[] = 'is_active = ?';
            $params[] = $is_active ? 1 : 0;
        }

        if (empty($updates)) {
            return false;
        }

        $params[] = $id;
        $sql = 'UPDATE categories SET ' . implode(', ', $updates) . ' WHERE id = ?';
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute($params) && $stmt->rowCount() > 0;
    }

    public function deleteCategory($id) {
        $this->pdo->prepare('DELETE FROM prompt_categories WHERE category_id = ?')->execute([$id]);
        $stmt = $this->pdo->prepare('DELETE FROM categories WHERE id = ?');
        return $stmt->execute([$id]) && $stmt->rowCount() > 0;
    }

    public function getPrompts($categoryId = null) {
        $categoryId = self::sanitizeParam($categoryId);

        if ($categoryId) {
            $sql = 'SELECT DISTINCT p.id, p.text, p.difficulty, p.is_active, p.date,
                    GROUP_CONCAT(pc.category_id, ",") as category_ids
                    FROM prompts p
                    LEFT JOIN prompt_categories pc ON p.id = pc.prompt_id
                    WHERE pc.category_id = ?
                    GROUP BY p.id
                    ORDER BY p.text';
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$categoryId]);
        } else {
            $sql = 'SELECT p.id, p.text, p.difficulty, p.is_active, p.date,
                    GROUP_CONCAT(pc.category_id, ",") as category_ids
                    FROM prompts p
                    LEFT JOIN prompt_categories pc ON p.id = pc.prompt_id
                    GROUP BY p.id
                    ORDER BY p.text';
            $stmt = $this->pdo->query($sql);
        }

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($results as &$row) {
            $row['category_ids'] = array_values(array_filter(array_map('intval', explode(',', $row['category_ids'] ?? ''))));
            $row['difficulty'] = (int)$row['difficulty'];
        }
        return $results;
    }

    public function getPromptByText($text) {
        $stmt = $this->pdo->prepare('SELECT id, text, difficulty, is_active, date FROM prompts WHERE text = ?');
        $stmt->execute([$text]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function addPrompt($categoryIds, $text, $difficulty = 1) {
        if (empty(trim($text))) {
            throw new Exception('Prompt text cannot be empty');
        }
        if (!is_array($categoryIds)) {
            $categoryIds = [$categoryIds];
        }
        if (empty($categoryIds)) {
            throw new Exception('At least one category is required');
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->pdo->prepare('INSERT INTO prompts (text, difficulty, is_active, date) VALUES (?, ?, 1, 0)');
            $stmt->execute([$text, max(1, min(5, (int)$difficulty))]);
            $promptId = $this->pdo->lastInsertId();

            $relStmt = $this->pdo->prepare('INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)');
            foreach (array_unique($categoryIds) as $catId) {
                $relStmt->execute([$promptId, $catId]);
            }

            $this->db->commit();
            return $promptId;
        } catch (PDOException $e) {
            $this->db->rollback();
            if (strpos($e->getMessage(), 'UNIQUE constraint failed') !== false) {
                throw new Exception('Prompt text already exists');
            }
            throw $e;
        }
    }

    public function updatePrompt($id, $text = null, $difficulty = null, $categoryIds = null) {
        $updates = [];
        $params = [];

        if ($text !== null) {
            $updates[] = 'text = ?';
            $params[] = $text;
        }
        if ($difficulty !== null) {
            $updates[] = 'difficulty = ?';
            $params[] = max(1, min(5, (int)$difficulty));
        }

        $this->db->beginTransaction();
        try {
            if (!empty($updates)) {
                $params[] = $id;
                $sql = 'UPDATE prompts SET ' . implode(', ', $updates) . ' WHERE id = ?';
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute($params);
            }

            if ($categoryIds !== null) {
                if (!is_array($categoryIds)) {
                    $categoryIds = [$categoryIds];
                }
                $this->pdo->prepare('DELETE FROM prompt_categories WHERE prompt_id = ?')->execute([$id]);

                foreach (array_unique($categoryIds) as $catId) {
                    $this->pdo->prepare('INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)')->execute([$id, $catId]);
                }
            }

            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollback();
            throw $e;
        }
    }

    public function deletePrompt($id) {
        $this->pdo->prepare('DELETE FROM prompt_categories WHERE prompt_id = ?')->execute([$id]);
        $this->pdo->prepare('DELETE FROM valid_words WHERE prompt_id = ?')->execute([$id]);
        $stmt = $this->pdo->prepare('DELETE FROM prompts WHERE id = ?');
        return $stmt->execute([$id]) && $stmt->rowCount() > 0;
    }

    public function getWords($promptId = null) {
        $promptId = self::sanitizeParam($promptId);

        if ($promptId) {
            $stmt = $this->pdo->prepare('SELECT id, prompt_id, word_group FROM valid_words WHERE prompt_id = ? ORDER BY word_group');
            $stmt->execute([(int)$promptId]);
        } else {
            $stmt = $this->pdo->query('SELECT id, prompt_id, word_group FROM valid_words ORDER BY prompt_id, word_group');
        }
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function getWordByPromptAndGroup($promptId, $wordGroup) {
        $stmt = $this->pdo->prepare('SELECT id, prompt_id, word_group FROM valid_words WHERE prompt_id = ? AND word_group = ?');
        $stmt->execute([$promptId, $wordGroup]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function addWord($promptId, $wordGroup) {
        if (empty(trim($wordGroup))) {
            throw new Exception('Word group cannot be empty');
        }

        try {
            $stmt = $this->pdo->prepare('INSERT INTO valid_words (prompt_id, word_group) VALUES (?, ?)');
            $stmt->execute([$promptId, trim($wordGroup)]);
            return $this->pdo->lastInsertId();
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'UNIQUE constraint failed') !== false) {
                throw new Exception('Word group already exists for this prompt');
            }
            throw $e;
        }
    }

    public function updateWord($id, $wordGroup = null) {
        if ($wordGroup === null) {
            return false;
        }

        $stmt = $this->pdo->prepare('UPDATE valid_words SET word_group = ? WHERE id = ?');
        return $stmt->execute([trim($wordGroup), $id]) && $stmt->rowCount() > 0;
    }

    public function deleteWord($id) {
        $stmt = $this->pdo->prepare('DELETE FROM valid_words WHERE id = ?');
        return $stmt->execute([$id]) && $stmt->rowCount() > 0;
    }

    public function replacePromptWords($promptId, $wordGroups) {
        if (!is_array($wordGroups)) {
            $wordGroups = [$wordGroups];
        }

        $wordGroups = array_map(function($w) {
            return trim($w);
        }, $wordGroups);
        $wordGroups = array_filter($wordGroups, function($w) {
            return !empty($w);
        });
        $wordGroups = array_unique($wordGroups);

        $this->pdo->prepare('DELETE FROM valid_words WHERE prompt_id = ?')->execute([$promptId]);

        $added = 0;
        foreach ($wordGroups as $wordGroup) {
            try {
                $this->addWord($promptId, $wordGroup);
                $added++;
            } catch (Exception $e) {
                logMessage('Word addition error: ' . $e->getMessage(), 'WARN');
            }
        }

        return ['deleted' => count($wordGroups), 'added' => $added];
    }

    public function getGames($limit = 100, $offset = 0) {
        $sql = 'SELECT g.id, g.original_id, g.status, g.round, g.current_category_id, g.selected_category_id,
                g.updated_at, g.created_at, g.total_rounds, g.round_duration,
                COUNT(DISTINCT p.id) as player_count
                FROM games g
                LEFT JOIN players p ON g.id = p.game_id
                GROUP BY g.id
                ORDER BY g.updated_at DESC
                LIMIT ? OFFSET ?';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$limit, $offset]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function getGamesByOriginalId($originalId, $limit = 100, $offset = 0) {
        $sql = 'SELECT g.id, g.original_id, g.status, g.round, g.current_category_id, g.selected_category_id,
                g.updated_at, g.created_at, g.total_rounds, g.round_duration,
                COUNT(DISTINCT p.id) as player_count
                FROM games g
                LEFT JOIN players p ON g.id = p.game_id
                WHERE g.original_id = ?
                GROUP BY g.id
                ORDER BY g.updated_at DESC
                LIMIT ? OFFSET ?';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$originalId, $limit, $offset]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function getGameById($id) {
        $stmt = $this->pdo->prepare('SELECT * FROM games WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getGamePlayers($gameId) {
        $stmt = $this->pdo->prepare('SELECT id, game_id, name, aura, status, score, round_history, answers
                FROM players WHERE game_id = ? ORDER BY id');
        $stmt->execute([$gameId]);
        $players = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        foreach ($players as &$player) {
            $player['score'] = (int)$player['score'];
            $player['round_history'] = $player['round_history'] ? json_decode($player['round_history'], true) : [];
            $player['answers'] = !empty($player['answers']) ? explode(',', $player['answers']) : [];
        }
        return $players;
    }

    public function deleteGame($gameId) {
        $this->pdo->prepare('DELETE FROM players WHERE game_id = ?')->execute([$gameId]);
        $stmt = $this->pdo->prepare('DELETE FROM games WHERE id = ?');
        return $stmt->execute([$gameId]) && $stmt->rowCount() > 0;
    }

    public function deletePlayer($gameId, $playerId) {
        $stmt = $this->pdo->prepare('DELETE FROM players WHERE game_id = ? AND id = ?');
        return $stmt->execute([$gameId, $playerId]) && $stmt->rowCount() > 0;
    }

    public function deleteAllChainedGames($originalId) {
        $stmt = $this->pdo->prepare('SELECT id FROM games WHERE original_id = ?');
        $stmt->execute([$originalId]);
        $games = $stmt->fetchAll(PDO::FETCH_COLUMN);

        foreach ($games as $gameId) {
            $this->deleteGame($gameId);
        }

        $stmt = $this->pdo->prepare('DELETE FROM games WHERE id = ?');
        $stmt->execute([$originalId]);

        return count($games) + 1;
    }

    public function optimizeDatabase() {
        $this->pdo->exec('PRAGMA optimize');
        $this->pdo->exec('VACUUM');
        return true;
    }

    public function repairDatabase() {
        $dbFile = $this->db->getDatabasePath();
        @unlink($dbFile);
        @unlink($dbFile . '-wal');
        @unlink($dbFile . '-shm');
        return true;
    }

    public function reorderCategories($order) {
        if (!is_array($order) || empty($order)) {
            throw new Exception('Invalid order array');
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->pdo->prepare('UPDATE categories SET orden = ? WHERE id = ?');
            foreach ($order as $index => $catId) {
                $stmt->execute([$index + 1, (int)$catId]);
            }
            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollback();
            throw $e;
        }
    }

    public function getInspectionData() {
        return [
            'stats' => $this->getDictionaryStats(),
            'games_sample' => $this->getGames(10),
            'database_file' => $this->db->getDatabasePath(),
            'schema_version' => 2
        ];
    }

    public function getDeepInspection() {
        $schema = [];
        $dbFile = $this->db->getDatabasePath();

        $tables = $this->pdo->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);

        foreach ($tables as $table) {
            $columns = $this->pdo->query("PRAGMA table_info($table)")->fetchAll(PDO::FETCH_ASSOC);
            $indexes = $this->pdo->query("PRAGMA index_list($table)")->fetchAll(PDO::FETCH_ASSOC);
            $foreignKeys = $this->pdo->query("PRAGMA foreign_key_list($table)")->fetchAll(PDO::FETCH_ASSOC);

            $tableInfo = [];
            foreach ($columns as $col) {
                $tableInfo['columns'][] = [
                    'name' => $col['name'],
                    'type' => $col['type'],
                    'notnull' => (bool)$col['notnull'],
                    'default' => $col['dflt_value'],
                    'pk' => (bool)$col['pk']
                ];
            }

            if (!empty($indexes)) {
                foreach ($indexes as $idx) {
                    $indexColumns = $this->pdo->query("PRAGMA index_info({$idx['name']})")->fetchAll(PDO::FETCH_COLUMN, 2);
                    $tableInfo['indexes'][] = [
                        'name' => $idx['name'],
                        'columns' => $indexColumns,
                        'unique' => (bool)$idx['unique']
                    ];
                }
            }

            if (!empty($foreignKeys)) {
                foreach ($foreignKeys as $fk) {
                    $tableInfo['foreign_keys'][] = [
                        'column' => $fk['from'],
                        'references_table' => $fk['table'],
                        'references_column' => $fk['to']
                    ];
                }
            }

            $rowCount = (int)$this->pdo->query("SELECT COUNT(*) FROM $table")->fetchColumn();
            $tableInfo['row_count'] = $rowCount;

            $schema[$table] = $tableInfo;
        }

        return [
            'database_file' => $dbFile,
            'file_size_bytes' => filesize($dbFile) ?? 0,
            'file_size_mb' => round((filesize($dbFile) ?? 0) / (1024 * 1024), 2),
            'timestamp' => date('Y-m-d H:i:s'),
            'total_tables' => count($tables),
            'tables' => $schema,
            'stats' => $this->getDictionaryStats()
        ];
    }

    private static function sanitizeParam($value) {
        if ($value === null || $value === '' || $value === '0') {
            return null;
        }
        $int = (int)$value;
        return $int > 0 ? $int : null;
    }
}

try {
    $action = $_GET['action'] ?? null;
    $method = $_SERVER['REQUEST_METHOD'];

    if (!$action) {
        respondError('Missing action parameter');
        exit;
    }

    $db = new DatabaseManager();

    if ($method === 'POST') {
        handlePost($db, $action);
    } elseif ($method === 'GET') {
        handleGet($db, $action);
    } else {
        respondError('Invalid request method');
    }

} catch (Exception $e) {
    logMessage('Fatal error: ' . $e->getMessage(), 'ERROR');
    http_response_code(400);
    respondError('Server Error: ' . $e->getMessage());
}

function handlePost($db, $action) {
    try {
        match($action) {
            'add-category' => handleAddCategory($db),
            'update-category' => handleUpdateCategory($db),
            'delete-category' => handleDeleteCategory($db),
            'add-prompt' => handleAddPrompt($db),
            'update-prompt' => handleUpdatePrompt($db),
            'delete-prompt' => handleDeletePrompt($db),
            'add-word' => handleAddWord($db),
            'update-word' => handleUpdateWord($db),
            'delete-word' => handleDeleteWord($db),
            'replace-prompt-words' => handleReplacePromptWords($db),
            'reorder-categories' => handleReorderCategories($db),
            'delete-game' => handleDeleteGame($db),
            'delete-player' => handleDeletePlayer($db),
            'delete-chained-games' => handleDeleteChainedGames($db),
            'import' => handleImport($db),
            'optimize' => handleOptimize($db),
            'repair' => handleRepair($db),
            default => respondError('Unknown POST action: ' . $action)
        };
    } catch (Exception $e) {
        respondError($e->getMessage());
    }
}

function handleGet($db, $action) {
    try {
        match($action) {
            'health' => respondSuccess('Health check', $db->getHealth()),
            'get-categories' => respondSuccess('Categories loaded', $db->getAllCategories()),
            'get-prompts' => respondSuccess('Prompts loaded', $db->getPrompts($_GET['category_id'] ?? null)),
            'get-words' => respondSuccess('Words loaded', $db->getWords($_GET['prompt_id'] ?? null)),
            'get-stats' => respondSuccess('Stats loaded', $db->getDictionaryStats()),
            'get-games' => respondSuccess('Games loaded', $db->getGames()),
            'get-games-by-original' => respondSuccess('Chained games loaded', $db->getGamesByOriginalId($_GET['original_id'] ?? '')),
            'get-game' => respondSuccess('Game loaded', $db->getGameById($_GET['id'] ?? '')),
            'get-game-players' => respondSuccess('Players loaded', $db->getGamePlayers($_GET['game_id'] ?? '')),
            'inspect' => respondSuccess('Inspection completed', $db->getInspectionData()),
            'deep-inspect' => respondSuccess('Deep inspection completed', $db->getDeepInspection()),
            default => respondError('Unknown GET action: ' . $action)
        };
    } catch (Exception $e) {
        respondError($e->getMessage());
    }
}

function handleAddCategory($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['name'])) {
        throw new Exception('Missing name');
    }

    $cat = $db->addCategory($data['name'], $data['orden'] ?? null);
    respondSuccess('Category added', $cat);
}

function handleUpdateCategory($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) {
        throw new Exception('Missing id');
    }

    $db->updateCategory($data['id'], $data['name'] ?? null, $data['orden'] ?? null, $data['is_active'] ?? null);
    respondSuccess('Category updated');
}

function handleDeleteCategory($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) {
        throw new Exception('Missing id');
    }

    $db->deleteCategory($data['id']);
    respondSuccess('Category deleted');
}

function handleAddPrompt($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['text']) || !isset($data['category_ids'])) {
        throw new Exception('Missing text or category_ids');
    }

    $promptId = $db->addPrompt($data['category_ids'], $data['text'], $data['difficulty'] ?? 1);

    if (isset($data['words']) && is_array($data['words'])) {
        foreach ($data['words'] as $word) {
            if (!empty(trim($word))) {
                try {
                    $db->addWord($promptId, $word);
                } catch (Exception $e) {
                    logMessage('Word error: ' . $e->getMessage(), 'WARN');
                }
            }
        }
    }

    respondSuccess('Prompt added', ['prompt_id' => $promptId]);
}

function handleUpdatePrompt($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) {
        throw new Exception('Missing id');
    }

    $db->updatePrompt($data['id'], $data['text'] ?? null, $data['difficulty'] ?? null, $data['category_ids'] ?? null);
    respondSuccess('Prompt updated');
}

function handleDeletePrompt($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) {
        throw new Exception('Missing id');
    }

    $db->deletePrompt($data['id']);
    respondSuccess('Prompt deleted');
}

function handleAddWord($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['prompt_id']) || !isset($data['word'])) {
        throw new Exception('Missing prompt_id or word');
    }

    $wordId = $db->addWord($data['prompt_id'], $data['word']);
    respondSuccess('Word added', ['word_id' => $wordId]);
}

function handleUpdateWord($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) {
        throw new Exception('Missing id');
    }

    $db->updateWord($data['id'], $data['word'] ?? null);
    respondSuccess('Word updated');
}

function handleDeleteWord($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) {
        throw new Exception('Missing id');
    }

    $db->deleteWord($data['id']);
    respondSuccess('Word deleted');
}

function handleReplacePromptWords($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['prompt_id']) || !isset($data['words'])) {
        throw new Exception('Missing prompt_id or words');
    }

    $result = $db->replacePromptWords($data['prompt_id'], $data['words']);
    respondSuccess('Prompt words replaced', $result);
}

function handleReorderCategories($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['order'])) {
        throw new Exception('Missing order');
    }

    $db->reorderCategories($data['order']);
    respondSuccess('Categories reordered');
}

function handleDeleteGame($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['game_id'])) {
        throw new Exception('Missing game_id');
    }

    $db->deleteGame($data['game_id']);
    respondSuccess('Game deleted');
}

function handleDeletePlayer($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['game_id']) || !isset($data['player_id'])) {
        throw new Exception('Missing game_id or player_id');
    }

    $db->deletePlayer($data['game_id'], $data['player_id']);
    respondSuccess('Player deleted');
}

function handleDeleteChainedGames($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['original_id'])) {
        throw new Exception('Missing original_id');
    }

    $count = $db->deleteAllChainedGames($data['original_id']);
    respondSuccess('Chained games deleted', ['count' => $count]);
}

function handleOptimize($db) {
    $before = $db->getDictionaryStats();
    $db->optimizeDatabase();
    $after = $db->getDictionaryStats();

    respondSuccess('Database optimized', [
        'before' => $before,
        'after' => $after
    ]);
}

function handleRepair($db) {
    $db->repairDatabase();
    respondSuccess('Database repaired');
}

function handleImport($db) {
    $input = file_get_contents('php://input');
    if (empty($input)) {
        throw new Exception('Empty input');
    }

    $json = json_decode($input, true);
    if (!$json) {
        throw new Exception('Invalid JSON: ' . json_last_error_msg());
    }

    $stats = ['categories_added' => 0, 'prompts_added' => 0, 'words_added' => 0, 'format' => 'unknown', 'errors' => []];

    if (isset($json['categories']) && isset($json['prompts'])) {
        $stats['format'] = 'standard';
        importStandardFormat($db, $json, $stats);
    } else {
        $stats['format'] = 'compact';
        importCompactFormat($db, $json, $stats);
    }

    respondSuccess('Database imported', $stats);
}

function importStandardFormat($db, $json, &$stats) {
    $categoryMap = [];
    foreach ($json['categories'] ?? [] as $catData) {
        try {
            $cat = $db->addCategory($catData['name'] ?? 'Unknown', $catData['orden'] ?? null);
            $categoryMap[$catData['id'] ?? null] = $cat['id'];
            $stats['categories_added']++;
        } catch (Exception $e) {
            logMessage('Category import error: ' . $e->getMessage(), 'WARN');
            $stats['errors'][] = 'Category error: ' . $e->getMessage();
        }
    }

    foreach ($json['prompts'] ?? [] as $promptData) {
        $catIds = [];
        foreach ($promptData['category_ids'] ?? [] as $id) {
            if (isset($categoryMap[$id])) {
                $catIds[] = $categoryMap[$id];
            }
        }

        if (!empty($catIds) && !empty($promptData['text'])) {
            try {
                $promptId = $db->addPrompt($catIds, $promptData['text'], $promptData['difficulty'] ?? 1);
                $stats['prompts_added']++;

                foreach ($promptData['words'] ?? [] as $word) {
                    if (!empty(trim($word))) {
                        try {
                            $db->addWord($promptId, $word);
                            $stats['words_added']++;
                        } catch (Exception $e) {
                            logMessage('Word import error: ' . $e->getMessage(), 'WARN');
                        }
                    }
                }
            } catch (Exception $e) {
                logMessage('Prompt import error: ' . $e->getMessage(), 'WARN');
                $stats['errors'][] = 'Prompt error: ' . $e->getMessage();
            }
        }
    }
}

function importCompactFormat($db, $json, &$stats) {
    foreach ($json as $categoryName => $categoryData) {
        if (!is_array($categoryData)) {
            continue;
        }

        try {
            $existingCat = $db->getCategoryByName($categoryName);
            if ($existingCat) {
                $categoryId = $existingCat['id'];
            } else {
                $cat = $db->addCategory($categoryName);
                $categoryId = $cat['id'];
                $stats['categories_added']++;
            }

            foreach ($categoryData as $promptItem) {
                if (!is_array($promptItem) || empty($promptItem)) {
                    continue;
                }

                foreach ($promptItem as $promptText => $wordsData) {
                    if (!is_string($promptText) || empty(trim($promptText))) {
                        continue;
                    }

                    $promptText = trim($promptText);
                    $difficulty = 1;
                    $wordGroups = [];

                    if (is_array($wordsData)) {
                        foreach ($wordsData as $item) {
                            if (is_numeric($item)) {
                                $difficulty = max(1, min(5, (int)$item));
                            } elseif (is_string($item) && !empty(trim($item))) {
                                $wordGroups[] = trim($item);
                            }
                        }
                    }

                    if (empty($wordGroups)) {
                        continue;
                    }

                    try {
                        $existingPrompt = $db->getPromptByText($promptText);

                        if ($existingPrompt) {
                            $promptId = $existingPrompt['id'];
                        } else {
                            $promptId = $db->addPrompt($categoryId, $promptText, $difficulty);
                            $stats['prompts_added']++;
                        }

                        foreach (array_unique($wordGroups) as $wordGroup) {
                            if (!empty(trim($wordGroup))) {
                                try {
                                    $existingWord = $db->getWordByPromptAndGroup($promptId, $wordGroup);

                                    if (!$existingWord) {
                                        $db->addWord($promptId, $wordGroup);
                                        $stats['words_added']++;
                                    }
                                } catch (Exception $e) {
                                    logMessage('Word group import error: ' . $e->getMessage(), 'WARN');
                                }
                            }
                        }
                    } catch (Exception $e) {
                        logMessage('Prompt import error: ' . $e->getMessage(), 'WARN');
                        $stats['errors'][] = "Prompt '{$promptText}': " . $e->getMessage();
                    }
                }
            }
        } catch (Exception $e) {
            logMessage('Category import error: ' . $e->getMessage(), 'WARN');
            $stats['errors'][] = "Category '{$categoryName}': " . $e->getMessage();
        }
    }
}

function respondSuccess($msg, $data = null) {
    echo json_encode([
        'success' => true,
        'message' => $msg,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function respondError($msg) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $msg
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
?>