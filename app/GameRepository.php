<?php

require_once __DIR__ . '/Database.php';

class GameRepository {
    private $db = null;

    public function __construct() {
        $this->db = Database::getInstance();
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
        $complexData = json_decode($gameRow['data'] ?? '{}', true) ?? [];

        $state = [
            'game_id' => $gameRow['id'],
            'status' => $gameRow['status'],
            'round' => (int)$gameRow['round'],
            'total_rounds' => (int)$gameRow['total_rounds'],
            'current_prompt' => $gameRow['current_prompt'],
            'current_category' => $gameRow['current_category'],
            'selected_category' => $gameRow['selected_category'] ?? null,
            'round_started_at' => $gameRow['round_started_at'] !== null ? (int)$gameRow['round_started_at'] : null,
            'round_starts_at' => $gameRow['round_starts_at'] !== null ? (int)$gameRow['round_starts_at'] : null,
            'round_ends_at' => $gameRow['round_ends_at'] !== null ? (int)$gameRow['round_ends_at'] : null,
            'countdown_duration' => $gameRow['countdown_duration'] !== null ? (int)$gameRow['countdown_duration'] : null,
            'created_at' => $gameRow['created_at'] !== null ? (int)$gameRow['created_at'] : null,
            'min_players' => (int)$gameRow['min_players'],
            'max_players' => (int)$gameRow['max_players'],
            'round_duration' => (int)$gameRow['round_duration'],
            'start_countdown' => (int)$gameRow['start_countdown'],
            'hurry_up_threshold' => (int)$gameRow['hurry_up_threshold'],
            'max_words_per_player' => (int)$gameRow['max_words_per_player'],
            'max_word_length' => (int)$gameRow['max_word_length'],
            'last_update' => (int)$gameRow['updated_at'],
            '_updated_at' => (int)$gameRow['updated_at'],
            '_version' => 1
        ];

        $state = array_merge($state, $complexData);

        $state['players'] = [];
        foreach ($playerRows as $playerRow) {
            $playerId = $playerRow['id'];
            $roundHistory = json_decode($playerRow['round_history'] ?? '{}', true) ?? [];
            $currentAnswers = json_decode($playerRow['current_answers'] ?? '[]', true) ?? [];

            $score = (int)($playerRow['score'] ?? 0);
            if ($score === 0 && is_array($roundHistory) && !empty($roundHistory)) {
                foreach ($roundHistory as $roundData) {
                    if (is_array($roundData) && isset($roundData['score'])) {
                        $score += (int)$roundData['score'];
                    }
                }
            }

            $state['players'][$playerId] = [
                'id' => $playerId,
                'name' => $playerRow['name'],
                'score' => $score,
                'status' => $playerRow['status'],
                'color' => $playerRow['color'],
                'avatar' => $playerRow['avatar'],
                'answers' => $currentAnswers,
                'current_answers' => $currentAnswers,
                'round_history' => $roundHistory,
                'disconnected' => false
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

            $complexData = [
                'used_prompts' => $state['used_prompts'] ?? [],
                'round_details' => $state['round_details'] ?? [],
                'round_top_words' => $state['round_top_words'] ?? [],
                'game_history' => $state['game_history'] ?? [],
                'roundData' => $state['roundData'] ?? null
            ];

            $dataJson = json_encode($complexData, JSON_UNESCAPED_UNICODE);

            $stmt = $pdo->prepare('INSERT OR REPLACE INTO games (
                id, status, round, total_rounds, current_prompt, current_category,
                selected_category, round_started_at, round_starts_at, round_ends_at,
                countdown_duration, created_at, updated_at,
                min_players, max_players, round_duration, start_countdown,
                hurry_up_threshold, max_words_per_player, max_word_length, data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

            $createdAt = $state['created_at'] ?? $now;

            $stmt->execute([
                $gameId,
                $state['status'] ?? 'waiting',
                (int)($state['round'] ?? 0),
                (int)($state['total_rounds'] ?? 0),
                $state['current_prompt'] ?? null,
                $state['current_category'] ?? null,
                $state['selected_category'] ?? null,
                $state['round_started_at'] ?? null,
                $state['round_starts_at'] ?? null,
                $state['round_ends_at'] ?? null,
                $state['countdown_duration'] ?? null,
                $createdAt,
                $now,
                (int)($state['min_players'] ?? 2),
                (int)($state['max_players'] ?? 8),
                (int)($state['round_duration'] ?? 60),
                (int)($state['start_countdown'] ?? 5),
                (int)($state['hurry_up_threshold'] ?? 10),
                (int)($state['max_words_per_player'] ?? 5),
                (int)($state['max_word_length'] ?? 20),
                $dataJson
            ]);

            $stmt = $pdo->prepare('DELETE FROM players WHERE game_id = ?');
            $stmt->execute([$gameId]);

            if (isset($state['players']) && is_array($state['players'])) {
                $insertStmt = $pdo->prepare('INSERT INTO players (
                    id, game_id, name, color, avatar, status, score,
                    current_answers, round_history
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

                foreach ($state['players'] as $playerId => $player) {
                    $currentAnswers = $player['current_answers'] ?? $player['answers'] ?? [];
                    $roundHistory = $player['round_history'] ?? [];

                    $currentAnswersJson = json_encode($currentAnswers, JSON_UNESCAPED_UNICODE);
                    $roundHistoryJson = json_encode($roundHistory, JSON_UNESCAPED_UNICODE);

                    $insertStmt->execute([
                        $playerId,
                        $gameId,
                        $player['name'] ?? 'Jugador',
                        $player['color'] ?? null,
                        $player['avatar'] ?? null,
                        $player['status'] ?? 'connected',
                        (int)($player['score'] ?? 0),
                        $currentAnswersJson,
                        $roundHistoryJson
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