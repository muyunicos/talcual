<?php

require_once __DIR__ . '/Database.php';

class GameRepository {
    private $db = null;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function load($gameId) {
        if (empty($gameId)) {
            return null;
        }

        $pdo = $this->db->getConnection();

        $stmt = $pdo->prepare('SELECT * FROM games WHERE id = ?');
        $stmt->execute([$gameId]);
        $gameRow = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$gameRow) {
            return null;
        }

        $stmt = $pdo->prepare('SELECT id, game_id, name, aura, status, last_heartbeat, score, round_history, answers FROM players WHERE game_id = ?');
        $stmt->execute([$gameId]);
        $playerRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return $this->reconstructState($gameRow, $playerRows);
    }

    private function reconstructState($gameRow, $playerRows) {
        $metadata = json_decode($gameRow['metadata'] ?? '{}', true) ?? [];

        $state = [
            'game_id' => $gameRow['id'],
            'status' => $gameRow['status'],
            'round' => (int)$gameRow['round'],
            'total_rounds' => (int)$gameRow['total_rounds'],
            'current_prompt_id' => $gameRow['current_prompt_id'] !== null ? (int)$gameRow['current_prompt_id'] : null,
            'current_category_id' => $gameRow['current_category_id'] !== null ? (int)$gameRow['current_category_id'] : null,
            'selected_category_id' => $gameRow['selected_category_id'] !== null ? (int)$gameRow['selected_category_id'] : null,
            'round_starts_at' => $gameRow['round_starts_at'] !== null ? (int)$gameRow['round_starts_at'] : null,
            'round_ends_at' => $gameRow['round_ends_at'] !== null ? (int)$gameRow['round_ends_at'] : null,
            'countdown_duration' => $gameRow['countdown_duration'] !== null ? (int)$gameRow['countdown_duration'] : null,
            'created_at' => $gameRow['created_at'] !== null ? (int)$gameRow['created_at'] : null,
            'updated_at' => $gameRow['updated_at'] !== null ? (int)$gameRow['updated_at'] : null,
            'min_players' => (int)($gameRow['min_players'] ?? 2),
            'max_players' => (int)($gameRow['max_players'] ?? 8),
            'round_duration' => (int)($gameRow['round_duration'] ?? 60),
            'hurry_up_threshold' => (int)($gameRow['hurry_up_threshold'] ?? 10),
            'max_words_per_player' => (int)($gameRow['max_words_per_player'] ?? 6),
            'max_word_length' => (int)($gameRow['max_word_length'] ?? 30),
            'last_update' => (int)($gameRow['updated_at'] ?? time())
        ];

        $state = array_merge($state, $metadata);

        $state['players'] = [];
        foreach ($playerRows as $playerRow) {
            $playerId = $playerRow['id'];
            $roundHistory = json_decode($playerRow['round_history'] ?? '[]', true) ?? [];
            $answers = json_decode($playerRow['answers'] ?? '[]', true) ?: [];

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
                'aura' => $playerRow['aura'],
                'color' => $playerRow['aura'],
                'score' => $score,
                'status' => $playerRow['status'],
                'round_history' => $roundHistory,
                'answers' => $answers,
                'disconnected' => $playerRow['status'] === 'disconnected'
            ];
        }

        return $state;
    }

    public function save($gameId, $state) {
        if (empty($gameId)) {
            throw new Exception('gameId is required');
        }

        $this->db->beginTransaction();

        $pdo = $this->db->getConnection();

        $now = time();

        $metadata = [
            'used_prompts' => $state['used_prompts'] ?? [],
            'round_details' => $state['round_details'] ?? [],
            'round_top_words' => $state['round_top_words'] ?? [],
            'game_history' => $state['game_history'] ?? [],
            'roundData' => $state['roundData'] ?? null
        ];

        $metadataJson = json_encode($metadata, JSON_UNESCAPED_UNICODE);

        $stmt = $pdo->prepare('INSERT OR REPLACE INTO games (
            id, status, round, total_rounds, current_prompt_id, current_category_id,
            selected_category_id, round_starts_at, round_ends_at,
            countdown_duration, created_at, updated_at,
            min_players, max_players, round_duration,
            hurry_up_threshold, max_words_per_player, max_word_length,
            metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

        $createdAt = $state['created_at'] ?? $now;

        $stmt->execute([
            $gameId,
            $state['status'] ?? 'waiting',
            (int)($state['round'] ?? 0),
            (int)($state['total_rounds'] ?? 0),
            $state['current_prompt_id'] ?? null,
            $state['current_category_id'] ?? null,
            $state['selected_category_id'] ?? null,
            $state['round_starts_at'] ?? null,
            $state['round_ends_at'] ?? null,
            $state['countdown_duration'] ?? null,
            $createdAt,
            $now,
            (int)($state['min_players'] ?? 2),
            (int)($state['max_players'] ?? 8),
            (int)($state['round_duration'] ?? 60),
            (int)($state['hurry_up_threshold'] ?? 10),
            (int)($state['max_words_per_player'] ?? 6),
            (int)($state['max_word_length'] ?? 30),
            $metadataJson
        ]);

        $stmt = $pdo->prepare('DELETE FROM players WHERE game_id = ?');
        $stmt->execute([$gameId]);

        if (isset($state['players']) && is_array($state['players'])) {
            $insertStmt = $pdo->prepare('INSERT INTO players (
                id, game_id, name, aura, status, score, round_history, answers
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

            foreach ($state['players'] as $playerId => $player) {
                $roundHistory = $player['round_history'] ?? [];
                $roundHistoryJson = json_encode($roundHistory, JSON_UNESCAPED_UNICODE);
                
                $answersList = $player['answers'] ?? [];
                $answersJson = json_encode($answersList, JSON_UNESCAPED_UNICODE);

                $aura = $player['aura'] ?? $player['color'] ?? null;

                $insertStmt->execute([
                    $playerId,
                    $gameId,
                    $player['name'] ?? 'Jugador',
                    $aura,
                    $player['status'] ?? 'connected',
                    (int)($player['score'] ?? 0),
                    $roundHistoryJson,
                    $answersJson
                ]);
            }
        }

        $this->db->commit();
        logMessage('Game saved: ' . $gameId, 'DEBUG');

        return true;
    }

    public function exists($gameId) {
        if (empty($gameId)) {
            return false;
        }

        $pdo = $this->db->getConnection();
        $stmt = $pdo->prepare('SELECT COUNT(*) as count FROM games WHERE id = ?');
        $stmt->execute([$gameId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        return (int)($result['count'] ?? 0) > 0;
    }

    public function delete($gameId) {
        if (empty($gameId)) {
            throw new Exception('gameId is required');
        }

        $pdo = $this->db->getConnection();
        $stmt = $pdo->prepare('DELETE FROM games WHERE id = ?');
        $stmt->execute([$gameId]);

        logMessage('Game deleted: ' . $gameId, 'DEBUG');
        return true;
    }

    public function cleanup($maxAge = null) {
        if ($maxAge === null) {
            $maxAge = defined('MAX_GAME_AGE') ? MAX_GAME_AGE : 86400;
        }

        $pdo = $this->db->getConnection();
        $cutoffTime = time() - $maxAge;

        $stmt = $pdo->prepare('DELETE FROM games WHERE updated_at < ?');
        $stmt->execute([$cutoffTime]);

        $deletedCount = $stmt->rowCount();
        logMessage('Cleanup: ' . $deletedCount . ' old games deleted', 'DEBUG');

        return $deletedCount;
    }

    public function getAllGameIds() {
        $pdo = $this->db->getConnection();
        $stmt = $pdo->query('SELECT id FROM games ORDER BY updated_at DESC');
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_column($results, 'id');
    }
}
?>