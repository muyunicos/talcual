<?php
header('Content-Type: application/json');

set_error_handler(function($severity, $message, $file, $line) {
    logMessage("PHP Error [$severity]: $message in $file:$line", 'ERROR');
    respondError("Server error: $message");
    exit;
});

try {
    ensureDataDirectory();
    ensureDatabaseFile();
    
    require_once __DIR__ . '/../app/Database.php';

    $db = new DatabaseManager();
    $action = $_GET['action'] ?? null;
    $method = $_SERVER['REQUEST_METHOD'];

    if (!$action) {
        respondError('Missing action parameter');
        exit;
    }

    if ($method === 'POST') {
        switch ($action) {
            case 'add-category': handleAddCategory($db); break;
            case 'update-category': handleUpdateCategory($db); break;
            case 'delete-category': handleDeleteCategory($db); break;
            case 'add-prompt': handleAddPrompt($db); break;
            case 'update-prompt': handleUpdatePrompt($db); break;
            case 'delete-prompt': handleDeletePrompt($db); break;
            case 'add-word': handleAddWord($db); break;
            case 'update-word': handleUpdateWord($db); break;
            case 'delete-word': handleDeleteWord($db); break;
            case 'delete-game': handleDeleteGame($db); break;
            case 'delete-player': handleDeletePlayer($db); break;
            case 'update-game-status': handleUpdateGameStatus($db); break;
            case 'clean-disconnected': handleCleanDisconnected($db); break;
            case 'archive-finished': handleArchiveFinished($db); break;
            case 'reorder-categories': handleReorderCategories($db); break;
            case 'optimize': handleOptimize($db); break;
            case 'repair': handleRepair($db); break;
            case 'import': handleImport($db); break;
            case 'export': handleExport($db); break;
            default: respondError('Unknown POST action: ' . $action);
        }
    } elseif ($method === 'GET') {
        switch ($action) {
            case 'get-categories': getCategories($db); break;
            case 'get-prompts': getPrompts($db); break;
            case 'get-words': getWords($db); break;
            case 'get-games': getGames($db); break;
            case 'get-game': getGame($db); break;
            case 'get-game-players': getGamePlayers($db); break;
            case 'get-player-stats': getPlayerStats($db); break;
            case 'get-active-games': getActiveGames($db); break;
            case 'get-finished-games': getFinishedGames($db); break;
            case 'get-analytics': getGameAnalytics($db); break;
            case 'get-player-history': getPlayerHistory($db); break;
            case 'get-storage-stats': getStorageStats($db); break;
            case 'inspect': inspectDatabase($db); break;
            default: respondError('Unknown GET action: ' . $action);
        }
    } else {
        respondError('Invalid request method');
    }

} catch (Exception $e) {
    logMessage('Fatal error: ' . $e->getMessage(), 'FATAL');
    http_response_code(400);
    respondError('Server Error: ' . $e->getMessage());
}

class DatabaseManager {
    public $pdo = null;
    private $dbFile = null;

    public function __construct() {
        $this->dbFile = __DIR__ . '/../data/talcual.db';
        $this->pdo = Database::getInstance()->getConnection();
        $this->migrateSchema();
    }

    private function migrateSchema() {
        try {
            $this->pdo->exec('PRAGMA foreign_keys = ON');
            
            $tableInfo = $this->pdo->query("PRAGMA table_info(categories)")->fetchAll(PDO::FETCH_COLUMN, 1);
            
            if (!in_array('orden', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE categories ADD COLUMN orden INTEGER NOT NULL DEFAULT 0');
                $this->pdo->exec('ALTER TABLE categories ADD COLUMN is_active BOOLEAN DEFAULT 1');
                $this->pdo->exec('ALTER TABLE categories ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0');
                logMessage('Migrated categories table', 'INFO');
            }
            
            $tableInfo = $this->pdo->query("PRAGMA table_info(prompts)")->fetchAll(PDO::FETCH_COLUMN, 1);
            if (!in_array('difficulty', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE prompts ADD COLUMN difficulty INTEGER DEFAULT 1');
                $this->pdo->exec('ALTER TABLE prompts ADD COLUMN is_active BOOLEAN DEFAULT 1');
                $this->pdo->exec('ALTER TABLE prompts ADD COLUMN created_at INTEGER DEFAULT 0');
                logMessage('Migrated prompts table', 'INFO');
            }
            
            $tableInfo = $this->pdo->query("PRAGMA table_info(valid_words)")->fetchAll(PDO::FETCH_COLUMN, 1);
            if (!in_array('normalized_word', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE valid_words ADD COLUMN normalized_word TEXT');
                $this->pdo->exec('ALTER TABLE valid_words ADD COLUMN gender TEXT');
                $this->pdo->exec('ALTER TABLE valid_words ADD COLUMN created_at INTEGER DEFAULT 0');
                
                $words = $this->pdo->query('SELECT id, word_entry FROM valid_words')->fetchAll(PDO::FETCH_ASSOC);
                $stmt = $this->pdo->prepare('UPDATE valid_words SET normalized_word = ? WHERE id = ?');
                foreach ($words as $word) {
                    $normalized = mb_strtoupper(trim($word['word_entry']), 'UTF-8');
                    $stmt->execute([$normalized, $word['id']]);
                }
                
                $this->pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_valid_words_unique ON valid_words(prompt_id, normalized_word)');
                logMessage('Migrated valid_words table', 'INFO');
            }
            
            $tableInfo = $this->pdo->query("PRAGMA table_info(games)")->fetchAll(PDO::FETCH_COLUMN, 1);
            if (!in_array('current_prompt_id', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE games ADD COLUMN current_prompt_id INTEGER');
                $this->pdo->exec('ALTER TABLE games ADD COLUMN current_category_id INTEGER');
                $this->pdo->exec('ALTER TABLE games ADD COLUMN selected_category_id INTEGER');
                logMessage('Migrated games table', 'INFO');
            }
            
            $tableInfo = $this->pdo->query("PRAGMA table_info(players)")->fetchAll(PDO::FETCH_COLUMN, 1);
            if (!in_array('last_submission_at', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE players ADD COLUMN last_heartbeat INTEGER');
                $this->pdo->exec('ALTER TABLE players ADD COLUMN last_submission_at INTEGER');
                $this->pdo->exec('ALTER TABLE players ADD COLUMN disconnected BOOLEAN DEFAULT 0');
                logMessage('Migrated players table', 'INFO');
            }
            
            $this->createIndexesIfNeeded();
            
        } catch (PDOException $e) {
            logMessage('Schema migration error: ' . $e->getMessage(), 'WARN');
        }
    }
    
    private function createIndexesIfNeeded() {
        $indexes = [
            'CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active)',
            'CREATE INDEX IF NOT EXISTS idx_categories_orden ON categories(orden)',
            'CREATE INDEX IF NOT EXISTS idx_prompts_active ON prompts(is_active)',
            'CREATE INDEX IF NOT EXISTS idx_prompts_difficulty ON prompts(difficulty)',
            'CREATE INDEX IF NOT EXISTS idx_valid_words_prompt ON valid_words(prompt_id)',
            'CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)',
            'CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at)',
            'CREATE INDEX IF NOT EXISTS idx_games_category ON games(current_category_id)',
            'CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id)',
            'CREATE INDEX IF NOT EXISTS idx_players_status_game ON players(status, game_id)',
            'CREATE INDEX IF NOT EXISTS idx_players_heartbeat ON players(last_heartbeat)'
        ];
        
        try {
            foreach ($indexes as $sql) {
                $this->pdo->exec($sql);
            }
        } catch (PDOException $e) {
            logMessage('Index creation warning: ' . $e->getMessage(), 'WARN');
        }
    }

    public function getAllCategories() {
        $stmt = $this->pdo->query('SELECT id, name, orden, is_active, created_at FROM categories ORDER BY orden, name');
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function getCategoryById($id) {
        $stmt = $this->pdo->prepare('SELECT id, name, orden, is_active, created_at FROM categories WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getCategoryByName($name) {
        $stmt = $this->pdo->prepare('SELECT id, name, orden, is_active, created_at FROM categories WHERE name = ?');
        $stmt->execute([$name]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function addCategory($name, $orden = null) {
        if (empty($name)) throw new Exception('Category name cannot be empty');
        
        if ($orden === null) {
            $stmt = $this->pdo->query('SELECT MAX(orden) as max_orden FROM categories');
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            $orden = ($result['max_orden'] ?? 0) + 1;
        }
        
        $stmt = $this->pdo->prepare('INSERT INTO categories (name, orden, is_active, created_at) VALUES (?, ?, 1, 0)');
        $stmt->execute([$name, $orden]);
        return $this->getCategoryByName($name);
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
        
        if (empty($updates)) return false;
        
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
        if ($categoryId) {
            $sql = 'SELECT DISTINCT p.id, p.text, p.difficulty, p.is_active, p.created_at,
                    GROUP_CONCAT(pc.category_id, ",") as category_ids
                    FROM prompts p
                    JOIN prompt_categories pc ON p.id = pc.prompt_id
                    WHERE pc.category_id = ?
                    GROUP BY p.id
                    ORDER BY p.text';
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$categoryId]);
        } else {
            $sql = 'SELECT p.id, p.text, p.difficulty, p.is_active, p.created_at,
                    GROUP_CONCAT(pc.category_id, ",") as category_ids
                    FROM prompts p
                    LEFT JOIN prompt_categories pc ON p.id = pc.prompt_id
                    GROUP BY p.id
                    ORDER BY p.text';
            $stmt = $this->pdo->query($sql);
        }
        
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($results as &$row) {
            $row['category_ids'] = array_map('intval', array_filter(explode(',', $row['category_ids'] ?? '')));
            $row['difficulty'] = (int)$row['difficulty'];
        }
        return $results;
    }

    public function getPromptById($id) {
        $sql = 'SELECT p.id, p.text, p.difficulty, p.is_active, p.created_at,
                GROUP_CONCAT(pc.category_id, ",") as category_ids
                FROM prompts p
                LEFT JOIN prompt_categories pc ON p.id = pc.prompt_id
                WHERE p.id = ?
                GROUP BY p.id';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result) {
            $result['category_ids'] = array_map('intval', array_filter(explode(',', $result['category_ids'] ?? '')));
            $result['difficulty'] = (int)$result['difficulty'];
        }
        return $result;
    }

    public function addPrompt($categoryIds, $text, $difficulty = 1) {
        if (empty($text)) throw new Exception('Prompt text cannot be empty');
        if (!is_array($categoryIds)) $categoryIds = [$categoryIds];
        if (empty($categoryIds)) throw new Exception('At least one category is required');
        
        $stmt = $this->pdo->prepare('INSERT INTO prompts (text, difficulty, is_active, created_at) VALUES (?, ?, 1, 0)');
        $stmt->execute([$text, max(1, min(5, $difficulty))]);
        $promptId = $this->pdo->lastInsertId();
        
        $relStmt = $this->pdo->prepare('INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)');
        foreach ($categoryIds as $catId) {
            $relStmt->execute([$promptId, $catId]);
        }
        
        return $promptId;
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
            $params[] = max(1, min(5, $difficulty));
        }
        
        if (!empty($updates)) {
            $params[] = $id;
            $sql = 'UPDATE prompts SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
        }
        
        if ($categoryIds !== null) {
            if (!is_array($categoryIds)) $categoryIds = [$categoryIds];
            $this->pdo->prepare('DELETE FROM prompt_categories WHERE prompt_id = ?')->execute([$id]);
            
            if (!empty($categoryIds)) {
                $relStmt = $this->pdo->prepare('INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)');
                foreach ($categoryIds as $catId) {
                    $relStmt->execute([$id, $catId]);
                }
            }
        }
        
        return true;
    }

    public function deletePrompt($id) {
        $this->pdo->prepare('DELETE FROM prompt_categories WHERE prompt_id = ?')->execute([$id]);
        $this->pdo->prepare('DELETE FROM valid_words WHERE prompt_id = ?')->execute([$id]);
        $stmt = $this->pdo->prepare('DELETE FROM prompts WHERE id = ?');
        return $stmt->execute([$id]) && $stmt->rowCount() > 0;
    }

    public function getWords($promptId = null) {
        if ($promptId) {
            $stmt = $this->pdo->prepare('SELECT id, prompt_id, word_entry, normalized_word, gender, created_at FROM valid_words WHERE prompt_id = ? ORDER BY word_entry');
            $stmt->execute([$promptId]);
        } else {
            $stmt = $this->pdo->query('SELECT id, prompt_id, word_entry, normalized_word, gender, created_at FROM valid_words ORDER BY prompt_id, word_entry');
        }
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function getWordById($id) {
        $stmt = $this->pdo->prepare('SELECT id, prompt_id, word_entry, normalized_word, gender, created_at FROM valid_words WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function addWord($promptId, $word, $gender = null) {
        if (empty($word)) throw new Exception('Word cannot be empty');
        
        $normalized = mb_strtoupper(trim($word), 'UTF-8');
        
        try {
            $stmt = $this->pdo->prepare('INSERT INTO valid_words (prompt_id, word_entry, normalized_word, gender, created_at) VALUES (?, ?, ?, ?, 0)');
            $stmt->execute([$promptId, $word, $normalized, $gender]);
            return $this->pdo->lastInsertId();
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'UNIQUE constraint failed') !== false) {
                throw new Exception('Word already exists for this prompt');
            }
            throw $e;
        }
    }

    public function updateWord($id, $word = null, $gender = null) {
        $updates = [];
        $params = [];
        
        if ($word !== null) {
            $normalized = mb_strtoupper(trim($word), 'UTF-8');
            $updates[] = 'word_entry = ?';
            $params[] = $word;
            $updates[] = 'normalized_word = ?';
            $params[] = $normalized;
        }
        if ($gender !== null) {
            $updates[] = 'gender = ?';
            $params[] = $gender;
        }
        
        if (empty($updates)) return false;
        
        $params[] = $id;
        $sql = 'UPDATE valid_words SET ' . implode(', ', $updates) . ' WHERE id = ?';
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute($params) && $stmt->rowCount() > 0;
    }

    public function deleteWord($id) {
        $stmt = $this->pdo->prepare('DELETE FROM valid_words WHERE id = ?');
        return $stmt->execute([$id]) && $stmt->rowCount() > 0;
    }

    public function getGames($limit = 100, $offset = 0) {
        $sql = 'SELECT g.id, g.status, g.round, g.current_category_id, g.selected_category_id,
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

    public function getGameById($id) {
        $stmt = $this->pdo->prepare('SELECT * FROM games WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getGamePlayers($gameId) {
        $stmt = $this->pdo->prepare('SELECT id, game_id, name, color, avatar, status, score, current_answers, round_history, disconnected
                FROM players WHERE game_id = ? ORDER BY id');
        $stmt->execute([$gameId]);
        $players = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        
        foreach ($players as &$player) {
            $player['score'] = (int)$player['score'];
            $player['disconnected'] = (bool)$player['disconnected'];
            $player['current_answers'] = $player['current_answers'] ? json_decode($player['current_answers'], true) : [];
            $player['round_history'] = $player['round_history'] ? json_decode($player['round_history'], true) : [];
        }
        return $players;
    }

    public function getPlayerStats($gameId, $playerId) {
        $stmt = $this->pdo->prepare('SELECT id, name, score, status, round_history, current_answers FROM players WHERE game_id = ? AND id = ? LIMIT 1');
        $stmt->execute([$gameId, $playerId]);
        $player = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($player) {
            $player['score'] = (int)$player['score'];
            $player['round_history'] = $player['round_history'] ? json_decode($player['round_history'], true) : [];
            $player['current_answers'] = $player['current_answers'] ? json_decode($player['current_answers'], true) : [];
        }
        return $player;
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

    public function updateGameStatus($gameId, $status) {
        $stmt = $this->pdo->prepare('UPDATE games SET status = ?, updated_at = 0 WHERE id = ?');
        return $stmt->execute([$status, $gameId]) && $stmt->rowCount() > 0;
    }

    public function cleanDisconnectedPlayers($maxIdleMs = 300000) {
        $cutoff = (int)(microtime(true) * 1000) - $maxIdleMs;
        $stmt = $this->pdo->prepare('DELETE FROM players WHERE status = \'disconnected\' AND last_heartbeat < ?');
        $stmt->execute([$cutoff]);
        return $stmt->rowCount();
    }

    public function archiveFinishedGames($maxAgeMs = 86400000) {
        $cutoff = (int)(microtime(true) * 1000) - $maxAgeMs;
        $stmt = $this->pdo->prepare('DELETE FROM games WHERE status = \'finished\' AND updated_at < ?');
        $stmt->execute([$cutoff]);
        return $stmt->rowCount();
    }

    public function getDictionaryStats() {
        $categories = (int)$this->pdo->query('SELECT COUNT(*) FROM categories')->fetchColumn() ?: 0;
        $prompts = (int)$this->pdo->query('SELECT COUNT(*) FROM prompts')->fetchColumn() ?: 0;
        $words = (int)$this->pdo->query('SELECT COUNT(*) FROM valid_words')->fetchColumn() ?: 0;
        $games = (int)$this->pdo->query('SELECT COUNT(*) FROM games')->fetchColumn() ?: 0;
        $players = (int)$this->pdo->query('SELECT COUNT(*) FROM players')->fetchColumn() ?: 0;
        
        return [
            'categories' => $categories,
            'prompts' => $prompts,
            'words' => $words,
            'games' => $games,
            'players' => $players
        ];
    }

    public function getActiveGames() {
        $stmt = $this->pdo->query('SELECT id, status, round, (SELECT COUNT(*) FROM players WHERE game_id = games.id) as player_count FROM games WHERE status IN (\'waiting\', \'playing\') ORDER BY updated_at DESC');
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function getFinishedGames($limit = 50, $offset = 0) {
        $stmt = $this->pdo->prepare('SELECT id, status, round, total_rounds, updated_at FROM games WHERE status = \'finished\' ORDER BY updated_at DESC LIMIT ? OFFSET ?');
        $stmt->execute([$limit, $offset]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function getGameAnalytics($gameId) {
        $game = $this->getGameById($gameId);
        if (!$game) return null;
        
        $players = $this->getGamePlayers($gameId);
        
        return [
            'game' => $game,
            'players' => $players,
            'total_players' => count($players),
            'timestamp' => time()
        ];
    }

    public function getPlayerHistory($playerId) {
        $stmt = $this->pdo->prepare('SELECT DISTINCT g.id, g.created_at, g.total_rounds, p.score FROM players p
                JOIN games g ON p.game_id = g.id
                WHERE p.id = ?
                ORDER BY g.created_at DESC');
        $stmt->execute([$playerId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function getStorageStats() {
        $dbFile = $this->dbFile;
        return [
            'db_file_size' => file_exists($dbFile) ? filesize($dbFile) : 0,
            'db_file_exists' => file_exists($dbFile),
            'db_file_readable' => is_readable($dbFile),
            'db_file_writable' => is_writable($dbFile),
            'timestamp' => time()
        ];
    }

    public function getDatabaseInspection() {
        return [
            'categories' => $this->getAllCategories(),
            'prompts_count' => (int)$this->pdo->query('SELECT COUNT(*) FROM prompts')->fetchColumn() ?: 0,
            'words_count' => (int)$this->pdo->query('SELECT COUNT(*) FROM valid_words')->fetchColumn() ?: 0,
            'games_count' => (int)$this->pdo->query('SELECT COUNT(*) FROM games')->fetchColumn() ?: 0,
            'stats' => $this->getDictionaryStats()
        ];
    }

    public function optimizeDatabase() {
        $this->pdo->exec('PRAGMA optimize');
        $this->pdo->exec('VACUUM');
        return true;
    }

    public function reorderCategories($order) {
        $stmt = $this->pdo->prepare('UPDATE categories SET orden = ? WHERE id = ?');
        foreach ($order as $index => $catId) {
            $stmt->execute([$index, $catId]);
        }
        return true;
    }
}

function handleAddCategory($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['name'])) throw new Exception('Missing name');
    
    $cat = $db->addCategory($data['name'], $data['orden'] ?? null);
    respondSuccess('Category added', $cat);
}

function handleUpdateCategory($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) throw new Exception('Missing id');
    
    $db->updateCategory($data['id'], $data['name'] ?? null, $data['orden'] ?? null, $data['is_active'] ?? null);
    respondSuccess('Category updated');
}

function handleDeleteCategory($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) throw new Exception('Missing id');
    
    $db->deleteCategory($data['id']);
    respondSuccess('Category deleted');
}

function handleAddPrompt($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['text']) || !isset($data['category_ids'])) throw new Exception('Missing required fields');
    
    $promptId = $db->addPrompt($data['category_ids'], $data['text'], $data['difficulty'] ?? 1);
    
    if (isset($data['words']) && is_array($data['words'])) {
        foreach ($data['words'] as $word) {
            if (!empty(trim($word))) {
                try {
                    $db->addWord($promptId, $word, null);
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
    if (!$data || !isset($data['id'])) throw new Exception('Missing id');
    
    $db->updatePrompt($data['id'], $data['text'] ?? null, $data['difficulty'] ?? null, $data['category_ids'] ?? null);
    respondSuccess('Prompt updated');
}

function handleDeletePrompt($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) throw new Exception('Missing id');
    
    $db->deletePrompt($data['id']);
    respondSuccess('Prompt deleted');
}

function handleAddWord($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['prompt_id']) || !isset($data['word'])) throw new Exception('Missing required fields');
    
    $wordId = $db->addWord($data['prompt_id'], $data['word'], $data['gender'] ?? null);
    respondSuccess('Word added', ['word_id' => $wordId]);
}

function handleUpdateWord($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) throw new Exception('Missing id');
    
    $db->updateWord($data['id'], $data['word'] ?? null, $data['gender'] ?? null);
    respondSuccess('Word updated');
}

function handleDeleteWord($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) throw new Exception('Missing id');
    
    $db->deleteWord($data['id']);
    respondSuccess('Word deleted');
}

function handleDeleteGame($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) throw new Exception('Missing id');
    
    $db->deleteGame($data['id']);
    respondSuccess('Game deleted');
}

function handleDeletePlayer($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['game_id']) || !isset($data['player_id'])) throw new Exception('Missing fields');
    
    $db->deletePlayer($data['game_id'], $data['player_id']);
    respondSuccess('Player deleted');
}

function handleUpdateGameStatus($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id']) || !isset($data['status'])) throw new Exception('Missing fields');
    
    $db->updateGameStatus($data['id'], $data['status']);
    respondSuccess('Game status updated');
}

function handleCleanDisconnected($db) {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $count = $db->cleanDisconnectedPlayers($data['max_idle_ms'] ?? 300000);
    respondSuccess('Disconnected players cleaned', ['removed' => $count]);
}

function handleArchiveFinished($db) {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $count = $db->archiveFinishedGames($data['max_age_ms'] ?? 86400000);
    respondSuccess('Finished games archived', ['archived' => $count]);
}

function handleReorderCategories($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['order'])) throw new Exception('Missing order');
    
    $db->reorderCategories($data['order']);
    respondSuccess('Categories reordered');
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
    $dbFile = __DIR__ . '/../data/talcual.db';
    
    @unlink($dbFile);
    @unlink($dbFile . '-wal');
    @unlink($dbFile . '-shm');
    
    respondSuccess('Database repaired');
}

function handleImport($db) {
    $input = file_get_contents('php://input');
    if (empty($input)) throw new Exception('Empty input');
    
    $json = json_decode($input, true);
    if (!$json) throw new Exception('Invalid JSON: ' . json_last_error_msg());
    
    $stats = [
        'categories_added' => 0,
        'prompts_added' => 0,
        'words_added' => 0
    ];
    
    $categoryMap = [];
    foreach ($json['categories'] ?? [] as $catData) {
        $cat = $db->addCategory($catData['name'] ?? 'Unknown', $catData['orden'] ?? null);
        $categoryMap[$catData['id'] ?? null] = $cat['id'];
        $stats['categories_added']++;
    }
    
    foreach ($json['prompts'] ?? [] as $promptData) {
        $catIds = [];
        foreach ($promptData['category_ids'] ?? [] as $id) {
            if (isset($categoryMap[$id])) $catIds[] = $categoryMap[$id];
        }
        
        if (!empty($catIds) && !empty($promptData['text'])) {
            try {
                $promptId = $db->addPrompt($catIds, $promptData['text'], $promptData['difficulty'] ?? 1);
                $stats['prompts_added']++;
                
                foreach ($promptData['words'] ?? [] as $word) {
                    if (!empty(trim($word))) {
                        try {
                            $db->addWord($promptId, $word, null);
                            $stats['words_added']++;
                        } catch (Exception $e) {
                            logMessage('Word import error: ' . $e->getMessage(), 'WARN');
                        }
                    }
                }
            } catch (Exception $e) {
                logMessage('Prompt import error: ' . $e->getMessage(), 'WARN');
            }
        }
    }
    
    respondSuccess('Database imported', $stats);
}

function handleExport($db) {
    $data = [
        'categories' => $db->getAllCategories(),
        'prompts' => $db->getPrompts(),
        'timestamp' => time()
    ];
    respondSuccess('Export completed', $data);
}

function getCategories($db) {
    respondSuccess('Categories loaded', $db->getAllCategories());
}

function getPrompts($db) {
    $categoryId = $_GET['category_id'] ?? null;
    if ($categoryId) $categoryId = (int)$categoryId;
    respondSuccess('Prompts loaded', $db->getPrompts($categoryId));
}

function getWords($db) {
    $promptId = $_GET['prompt_id'] ?? null;
    if ($promptId) $promptId = (int)$promptId;
    respondSuccess('Words loaded', $db->getWords($promptId));
}

function getGames($db) {
    $limit = (int)($_GET['limit'] ?? 100);
    $offset = (int)($_GET['offset'] ?? 0);
    respondSuccess('Games loaded', $db->getGames($limit, $offset));
}

function getGame($db) {
    if (!isset($_GET['id'])) throw new Exception('Missing id');
    $game = $db->getGameById($_GET['id']);
    if (!$game) throw new Exception('Game not found');
    respondSuccess('Game loaded', $game);
}

function getGamePlayers($db) {
    if (!isset($_GET['game_id'])) throw new Exception('Missing game_id');
    respondSuccess('Players loaded', $db->getGamePlayers($_GET['game_id']));
}

function getPlayerStats($db) {
    if (!isset($_GET['game_id']) || !isset($_GET['player_id'])) throw new Exception('Missing fields');
    $stats = $db->getPlayerStats($_GET['game_id'], $_GET['player_id']);
    if (!$stats) throw new Exception('Player not found');
    respondSuccess('Player stats loaded', $stats);
}

function getActiveGames($db) {
    respondSuccess('Active games loaded', $db->getActiveGames());
}

function getFinishedGames($db) {
    $limit = (int)($_GET['limit'] ?? 50);
    $offset = (int)($_GET['offset'] ?? 0);
    respondSuccess('Finished games loaded', $db->getFinishedGames($limit, $offset));
}

function getGameAnalytics($db) {
    if (!isset($_GET['id'])) throw new Exception('Missing id');
    $analytics = $db->getGameAnalytics($_GET['id']);
    if (!$analytics) throw new Exception('Game not found');
    respondSuccess('Game analytics loaded', $analytics);
}

function getPlayerHistory($db) {
    if (!isset($_GET['player_id'])) throw new Exception('Missing player_id');
    respondSuccess('Player history loaded', $db->getPlayerHistory($_GET['player_id']));
}

function getStorageStats($db) {
    respondSuccess('Storage stats loaded', $db->getStorageStats());
}

function inspectDatabase($db) {
    respondSuccess('Database inspection completed', $db->getDatabaseInspection());
}

function ensureDataDirectory() {
    $dataDir = __DIR__ . '/../data';
    if (!is_dir($dataDir) && !mkdir($dataDir, 0755, true)) {
        throw new Exception('Cannot create /data directory');
    }
}

function ensureDatabaseFile() {
    $dbFile = __DIR__ . '/../data/talcual.db';
    if (!file_exists($dbFile)) {
        touch($dbFile);
    }
}

function logMessage($msg, $level = 'INFO') {
    $logFile = __DIR__ . '/../logs/dmanager.log';
    $logDir = dirname($logFile);
    
    if (!is_dir($logDir)) @mkdir($logDir, 0755, true);
    
    $timestamp = date('Y-m-d H:i:s');
    @file_put_contents($logFile, "[$timestamp] [$level] $msg\n", FILE_APPEND);
}

function respondSuccess($msg, $data = null) {
    echo json_encode(['success' => true, 'message' => $msg, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function respondError($msg) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
?>