<?php

require_once __DIR__ . '/Database.php';

class GameRepository {
    private $db = null;

    public function __construct($gameStatesDir = null) {
        $this->db = Database::getInstance();
        $this->initializeTables();
    }

    private function initializeTables() {
        try {
            $pdo = $this->db->getConnection();

            $pdo->exec('CREATE TABLE IF NOT EXISTS games (
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

            $pdo->exec('CREATE TABLE IF NOT EXISTS players (
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

            $pdo->exec('CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id)');

            $pdo->exec('CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )');

            $pdo->exec('CREATE TABLE IF NOT EXISTS prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER NOT NULL,
                text TEXT NOT NULL,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            )');

            $pdo->exec('CREATE INDEX IF NOT EXISTS idx_prompts_category_id ON prompts(category_id)');

            $pdo->exec('CREATE TABLE IF NOT EXISTS valid_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id INTEGER NOT NULL,
                word_entry TEXT NOT NULL,
                FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
            )');

            $pdo->exec('CREATE INDEX IF NOT EXISTS idx_valid_words_prompt_id ON valid_words(prompt_id)');

            logMessage('Database tables initialized successfully', 'DEBUG');

        } catch (PDOException $e) {
            logMessage('Error initializing tables: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database initialization error: ' . $e->getMessage());
        }
    }

    public function load($gameId) {
        if (strlen($gameId) > MAX_CODE_LENGTH) {
            throw new Exception('gameId excede MAX_CODE_LENGTH');
        }

        try {
            $pdo = $this->db->getConnection();

            $stmt = $pdo->prepare('SELECT * FROM games WHERE id = ?');
            $stmt->execute([$gameId]);
            $gameRow = $stmt->fetch();

            if (!$gameRow) {
                return null;
            }

            $stmt = $pdo->prepare('SELECT * FROM players WHERE game_id = ?');
            $stmt->execute([$gameId]);
            $playerRows = $stmt->fetchAll();

            $state = $this->reconstructState($gameRow, $playerRows);

            return $state;

        } catch (PDOException $e) {
            logMessage('Error loading game ' . $gameId . ': ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database load error: ' . $e->getMessage());
        }
    }

    private function reconstructState($gameRow, $playerRows) {
        $data = json_decode($gameRow['data'], true) ?? [];

        $state = [
            'game_id' => $gameRow['id'],
            'status' => $gameRow['status'],
            'round' => (int)$gameRow['round'],
            'total_rounds' => (int)$gameRow['total_rounds'],
            'current_prompt' => $gameRow['current_prompt'],
            'current_category' => $gameRow['current_category'],
            'selected_category' => $gameRow['selected_category'],
            'min_players' => (int)$gameRow['min_players'],
            'round_duration' => $gameRow['round_duration'] !== null ? (int)$gameRow['round_duration'] : null,
            'countdown_duration' => $gameRow['countdown_duration'] !== null ? (int)$gameRow['countdown_duration'] : null,
            'round_started_at' => $gameRow['round_started_at'] !== null ? (int)$gameRow['round_started_at'] : null,
            'round_starts_at' => $gameRow['round_starts_at'] !== null ? (int)$gameRow['round_starts_at'] : null,
            'round_ends_at' => $gameRow['round_ends_at'] !== null ? (int)$gameRow['round_ends_at'] : null,
            'last_update' => (int)$gameRow['updated_at'],
            '_updated_at' => (int)$gameRow['updated_at'],
            '_version' => 1
        ];

        $state = array_merge($state, $data);

        $state['players'] = [];
        foreach ($playerRows as $playerRow) {
            $playerId = $playerRow['id'];
            $state['players'][$playerId] = [
                'id' => $playerId,
                'name' => $playerRow['name'],
                'score' => (int)$playerRow['score'],
                'status' => $playerRow['status'],
                'color' => $playerRow['color'],
                'answers' => json_decode($playerRow['answers'], true) ?? [],
                'round_results' => json_decode($playerRow['round_results'], true) ?? [],
                'disconnected' => (bool)$playerRow['disconnected']
            ];
        }

        return $state;
    }

    public function save($gameId, $state) {
        if (strlen($gameId) > MAX_CODE_LENGTH) {
            throw new Exception('gameId excede MAX_CODE_LENGTH');
        }

        try {
            $this->db->beginTransaction();

            $pdo = $this->db->getConnection();

            $now = time();
            $state['_updated_at'] = $now;
            $state['_version'] = 1;

            $nonRelationalFields = [
                'used_prompts',
                'round_details',
                'round_top_words',
                'game_history',
                'roundData'
            ];

            $dataToStore = [];
            foreach ($nonRelationalFields as $field) {
                if (isset($state[$field])) {
                    $dataToStore[$field] = $state[$field];
                }
            }

            $dataJson = json_encode($dataToStore, JSON_UNESCAPED_UNICODE);

            $stmt = $pdo->prepare('INSERT OR REPLACE INTO games (
                id, status, round, total_rounds, current_prompt, current_category, selected_category,
                min_players, round_duration, countdown_duration, round_started_at, round_starts_at,
                round_ends_at, data, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

            $stmt->execute([
                $gameId,
                $state['status'] ?? 'waiting',
                (int)($state['round'] ?? 0),
                (int)($state['total_rounds'] ?? 0),
                $state['current_prompt'] ?? null,
                $state['current_category'] ?? null,
                $state['selected_category'] ?? null,
                (int)($state['min_players'] ?? 2),
                $state['round_duration'] ?? null,
                $state['countdown_duration'] ?? null,
                $state['round_started_at'] ?? null,
                $state['round_starts_at'] ?? null,
                $state['round_ends_at'] ?? null,
                $dataJson,
                $now
            ]);

            if (isset($state['players']) && is_array($state['players'])) {
                $stmt = $pdo->prepare('DELETE FROM players WHERE game_id = ?');
                $stmt->execute([$gameId]);

                $insertStmt = $pdo->prepare('INSERT INTO players (
                    id, game_id, name, score, status, color, answers, round_results, disconnected
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

                foreach ($state['players'] as $playerId => $player) {
                    $answersJson = json_encode($player['answers'] ?? [], JSON_UNESCAPED_UNICODE);
                    $resultsJson = json_encode($player['round_results'] ?? [], JSON_UNESCAPED_UNICODE);

                    $insertStmt->execute([
                        $playerId,
                        $gameId,
                        $player['name'] ?? 'Jugador',
                        (int)($player['score'] ?? 0),
                        $player['status'] ?? 'connected',
                        $player['color'] ?? null,
                        $answersJson,
                        $resultsJson,
                        (int)(bool)($player['disconnected'] ?? false)
                    ]);
                }
            }

            $this->db->commit();
            logMessage('Game saved: ' . $gameId, 'DEBUG');

            return true;

        } catch (PDOException $e) {
            $this->db->rollback();
            logMessage('Error saving game ' . $gameId . ': ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database save error: ' . $e->getMessage());
        } catch (Exception $e) {
            $this->db->rollback();
            throw $e;
        }
    }

    public function exists($gameId) {
        if (strlen($gameId) > MAX_CODE_LENGTH) {
            return false;
        }

        try {
            $pdo = $this->db->getConnection();
            $stmt = $pdo->prepare('SELECT COUNT(*) as count FROM games WHERE id = ?');
            $stmt->execute([$gameId]);
            $result = $stmt->fetch();

            return (int)($result['count'] ?? 0) > 0;

        } catch (PDOException $e) {
            logMessage('Error checking game existence: ' . $e->getMessage(), 'ERROR');
            return false;
        }
    }

    public function delete($gameId) {
        if (strlen($gameId) > MAX_CODE_LENGTH) {
            throw new Exception('gameId excede MAX_CODE_LENGTH');
        }

        try {
            $pdo = $this->db->getConnection();
            $stmt = $pdo->prepare('DELETE FROM games WHERE id = ?');
            $stmt->execute([$gameId]);

            logMessage('Game deleted: ' . $gameId, 'DEBUG');
            return true;

        } catch (PDOException $e) {
            logMessage('Error deleting game ' . $gameId . ': ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database delete error: ' . $e->getMessage());
        }
    }

    public function cleanup($maxAge = null) {
        if ($maxAge === null) {
            $maxAge = defined('MAX_GAME_AGE') ? MAX_GAME_AGE : 86400;
        }

        try {
            $pdo = $this->db->getConnection();
            $cutoffTime = time() - $maxAge;

            $stmt = $pdo->prepare('DELETE FROM games WHERE updated_at < ?');
            $stmt->execute([$cutoffTime]);

            $deletedCount = $stmt->rowCount();
            logMessage('Cleanup: ' . $deletedCount . ' old games deleted', 'DEBUG');

            return $deletedCount;

        } catch (PDOException $e) {
            logMessage('Error during cleanup: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database cleanup error: ' . $e->getMessage());
        }
    }

    public function getAllGameIds() {
        try {
            $pdo = $this->db->getConnection();
            $stmt = $pdo->query('SELECT id FROM games ORDER BY updated_at DESC');
            $results = $stmt->fetchAll();

            return array_column($results, 'id');

        } catch (PDOException $e) {
            logMessage('Error fetching game IDs: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database query error: ' . $e->getMessage());
        }
    }
}
?>
