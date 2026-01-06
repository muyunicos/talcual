<?php

class AdminOperations {
    use WordNormalizer;
    
    public $pdo = null;

    public function __construct() {
        require_once __DIR__ . '/../app/Database.php';
        require_once __DIR__ . '/../app/Traits/WordNormalizer.php';
        
        $db = Database::getInstance();
        $this->pdo = $db->getConnection();
    }

    public function getAllGamesWithDetails($limit = 100, $offset = 0) {
        try {
            $sql = 'SELECT 
                g.id,
                g.status,
                g.round as current_round,
                g.current_prompt,
                g.current_category,
                g.selected_category,
                g.created_at,
                g.updated_at,
                g.total_rounds,
                g.round_duration,
                g.min_players,
                g.max_players,
                g.start_countdown,
                g.hurry_up_threshold,
                g.max_words_per_player,
                g.max_word_length,
                COUNT(DISTINCT p.id) as player_count,
                SUM(p.score) as total_score
            FROM games g
            LEFT JOIN players p ON g.id = p.game_id
            GROUP BY g.id
            ORDER BY g.updated_at DESC
            LIMIT ? OFFSET ?';
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$limit, $offset]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching games with details: ' . $e->getMessage());
        }
    }

    public function getActiveGames() {
        try {
            $sql = 'SELECT 
                g.id,
                g.status,
                g.round as current_round,
                g.updated_at,
                COUNT(DISTINCT p.id) as player_count
            FROM games g
            LEFT JOIN players p ON g.id = p.game_id
            WHERE g.status IN ("waiting", "playing")
            GROUP BY g.id
            ORDER BY g.updated_at DESC';
            
            $stmt = $this->pdo->query($sql);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching active games: ' . $e->getMessage());
        }
    }

    public function getFinishedGames($limit = 50, $offset = 0) {
        try {
            $sql = 'SELECT 
                g.id,
                g.status,
                g.round as current_round,
                g.updated_at,
                g.total_rounds,
                COUNT(DISTINCT p.id) as player_count,
                SUM(p.score) as total_score
            FROM games g
            LEFT JOIN players p ON g.id = p.game_id
            WHERE g.status = "finished"
            GROUP BY g.id
            ORDER BY g.updated_at DESC
            LIMIT ? OFFSET ?';
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$limit, $offset]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching finished games: ' . $e->getMessage());
        }
    }

    public function getGameTimestamps($gameId) {
        try {
            $sql = 'SELECT 
                id,
                created_at,
                updated_at,
                round_started_at,
                round_starts_at,
                round_ends_at,
                countdown_duration
            FROM games 
            WHERE id = ?
            LIMIT 1';
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$gameId]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching game timestamps: ' . $e->getMessage());
        }
    }

    public function getGamePlayerDetails($gameId) {
        try {
            $sql = 'SELECT 
                p.id,
                p.name,
                p.color,
                p.avatar,
                p.status,
                p.disconnected,
                p.score,
                LENGTH(p.current_answers) as current_answers_size,
                LENGTH(p.round_history) as round_history_size,
                (SELECT COUNT(*) FROM valid_words WHERE prompt_id IN (
                    SELECT id FROM prompts
                )) as total_dictionary_size
            FROM players 
            WHERE game_id = ?
            ORDER BY p.score DESC';
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$gameId]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching game player details: ' . $e->getMessage());
        }
    }

    public function updateGameStatus($gameId, $status) {
        $validStatuses = ['waiting', 'playing', 'finished'];
        
        if (!in_array($status, $validStatuses)) {
            throw new Exception('Invalid game status: ' . $status);
        }
        
        try {
            $stmt = $this->pdo->prepare('UPDATE games SET status = ?, updated_at = ? WHERE id = ?');
            $stmt->execute([$status, time() * 1000, $gameId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error updating game status: ' . $e->getMessage());
        }
    }

    public function resetGameRound($gameId) {
        try {
            $stmt = $this->pdo->prepare(
                'UPDATE games SET 
                    round = 0,
                    current_prompt = NULL,
                    current_category = NULL,
                    round_started_at = NULL,
                    round_starts_at = NULL,
                    round_ends_at = NULL,
                    updated_at = ?
                WHERE id = ?'
            );
            $stmt->execute([time() * 1000, $gameId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error resetting game round: ' . $e->getMessage());
        }
    }

    public function cleanDisconnectedPlayers($maxIdleMs = 300000) {
        try {
            $cutoffTime = (time() * 1000) - $maxIdleMs;
            
            $sql = 'SELECT id, game_id FROM players 
                    WHERE (updated_at IS NULL OR updated_at < ?) 
                    AND status = "disconnected"';
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$cutoffTime]);
            $players = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $deleteStmt = $this->pdo->prepare('DELETE FROM players WHERE id = ? AND game_id = ?');
            
            $count = 0;
            foreach ($players as $player) {
                $deleteStmt->execute([$player['id'], $player['game_id']]);
                $count++;
            }
            
            return $count;
        } catch (PDOException $e) {
            throw new Exception('Error cleaning disconnected players: ' . $e->getMessage());
        }
    }

    public function archiveFinishedGames($maxAgeMs = 86400000) {
        try {
            $cutoffTime = (time() * 1000) - $maxAgeMs;
            
            $sql = 'SELECT id FROM games 
                    WHERE status = "finished" 
                    AND updated_at < ?
                    AND updated_at IS NOT NULL';
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$cutoffTime]);
            $games = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            $count = 0;
            foreach ($games as $gameId) {
                $this->deleteGame($gameId);
                $count++;
            }
            
            return $count;
        } catch (PDOException $e) {
            throw new Exception('Error archiving finished games: ' . $e->getMessage());
        }
    }

    public function getGameAnalytics($gameId) {
        try {
            $stmt = $this->pdo->prepare('SELECT * FROM games WHERE id = ? LIMIT 1');
            $stmt->execute([$gameId]);
            $game = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$game) {
                return null;
            }
            
            $playerStmt = $this->pdo->prepare(
                'SELECT 
                    id,
                    name,
                    score,
                    status,
                    round_history
                FROM players 
                WHERE game_id = ?
                ORDER BY score DESC'
            );
            $playerStmt->execute([$gameId]);
            $players = $playerStmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($players as &$player) {
                $player['round_history'] = $player['round_history'] ? json_decode($player['round_history'], true) : [];
            }
            
            return [
                'game_info' => $game,
                'players' => $players,
                'stats' => [
                    'total_players' => count($players),
                    'total_score' => array_sum(array_column($players, 'score')),
                    'average_score' => count($players) > 0 ? (array_sum(array_column($players, 'score')) / count($players)) : 0,
                    'highest_score' => max(array_column($players, 'score')) ?? 0
                ]
            ];
        } catch (PDOException $e) {
            throw new Exception('Error fetching game analytics: ' . $e->getMessage());
        }
    }

    public function getPlayerGameHistory($playerId) {
        try {
            $sql = 'SELECT 
                p.id as player_id,
                p.name,
                g.id as game_id,
                g.status,
                g.created_at,
                g.updated_at,
                p.score,
                p.round_history
            FROM players p
            JOIN games g ON p.game_id = g.id
            WHERE p.id = ?
            ORDER BY g.created_at DESC';
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$playerId]);
            $games = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($games as &$game) {
                $game['round_history'] = $game['round_history'] ? json_decode($game['round_history'], true) : [];
            }
            
            return $games;
        } catch (PDOException $e) {
            throw new Exception('Error fetching player game history: ' . $e->getMessage());
        }
    }

    public function getPlayerCrossGameStats($playerId) {
        try {
            $sql = 'SELECT 
                p.name,
                COUNT(DISTINCT g.id) as games_played,
                SUM(p.score) as total_score,
                AVG(p.score) as average_score,
                MAX(p.score) as highest_score,
                MIN(p.score) as lowest_score
            FROM players p
            JOIN games g ON p.game_id = g.id
            WHERE p.id = ?
            GROUP BY p.id';
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$playerId]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching player cross-game stats: ' . $e->getMessage());
        }
    }

    public function getDatabaseStorageStats() {
        try {
            return [
                'tables' => [
                    'categories' => $this->pdo->query('SELECT COUNT(*) as count FROM categories')->fetch()['count'],
                    'prompts' => $this->pdo->query('SELECT COUNT(*) as count FROM prompts')->fetch()['count'],
                    'prompt_categories' => $this->pdo->query('SELECT COUNT(*) as count FROM prompt_categories')->fetch()['count'],
                    'valid_words' => $this->pdo->query('SELECT COUNT(*) as count FROM valid_words')->fetch()['count'],
                    'games' => $this->pdo->query('SELECT COUNT(*) as count FROM games')->fetch()['count'],
                    'players' => $this->pdo->query('SELECT COUNT(*) as count FROM players')->fetch()['count']
                ],
                'games_by_status' => [
                    'waiting' => $this->pdo->query('SELECT COUNT(*) as count FROM games WHERE status = "waiting"')->fetch()['count'],
                    'playing' => $this->pdo->query('SELECT COUNT(*) as count FROM games WHERE status = "playing"')->fetch()['count'],
                    'finished' => $this->pdo->query('SELECT COUNT(*) as count FROM games WHERE status = "finished"')->fetch()['count']
                ]
            ];
        } catch (PDOException $e) {
            throw new Exception('Error fetching storage stats: ' . $e->getMessage());
        }
    }

    public function deleteGame($gameId) {
        try {
            $this->pdo->prepare('DELETE FROM players WHERE game_id = ?')->execute([$gameId]);
            $this->pdo->prepare('DELETE FROM games WHERE id = ?')->execute([$gameId]);
            return true;
        } catch (PDOException $e) {
            throw new Exception('Error deleting game: ' . $e->getMessage());
        }
    }

    public function deletePlayer($gameId, $playerId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM players WHERE game_id = ? AND id = ?');
            $stmt->execute([$gameId, $playerId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error deleting player: ' . $e->getMessage());
        }
    }

    public function bulkDeleteGames($gameIds) {
        try {
            $count = 0;
            foreach ($gameIds as $gameId) {
                $this->deleteGame($gameId);
                $count++;
            }
            return $count;
        } catch (Exception $e) {
            throw new Exception('Error bulk deleting games: ' . $e->getMessage());
        }
    }

    public function exportGameData($gameId) {
        try {
            $stmt = $this->pdo->prepare('SELECT * FROM games WHERE id = ? LIMIT 1');
            $stmt->execute([$gameId]);
            $game = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$game) {
                return null;
            }
            
            $playerStmt = $this->pdo->prepare('SELECT * FROM players WHERE game_id = ?');
            $playerStmt->execute([$gameId]);
            $players = $playerStmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($players as &$player) {
                $player['current_answers'] = $player['current_answers'] ? json_decode($player['current_answers'], true) : [];
                $player['round_history'] = $player['round_history'] ? json_decode($player['round_history'], true) : [];
            }
            
            return [
                'game' => $game,
                'players' => $players,
                'export_timestamp' => date('Y-m-d H:i:s')
            ];
        } catch (PDOException $e) {
            throw new Exception('Error exporting game data: ' . $e->getMessage());
        }
    }
}
?>
