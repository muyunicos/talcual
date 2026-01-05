<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-cache, no-store, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $pdo = Database::getInstance()->getConnection();
    $action = $_GET['action'] ?? $_POST['action'] ?? null;
    
    if (!$action) {
        throw new Exception('Missing action parameter');
    }
    
    $response = ['success' => false, 'message' => 'Unknown action'];
    
    switch ($action) {
        // CATEGORIES
        case 'get_categories':
            $stmt = $pdo->query('SELECT id, name FROM categories ORDER BY name');
            $response = ['success' => true, 'data' => $stmt->fetchAll()];
            break;
        
        case 'add_category':
            $name = trim($_POST['name'] ?? '');
            if (!$name || strlen($name) > MAX_CATEGORY_LENGTH) {
                throw new Exception('Invalid category name');
            }
            $stmt = $pdo->prepare('INSERT INTO categories (name) VALUES (?)');
            $stmt->execute([$name]);
            $response = ['success' => true, 'data' => ['id' => $pdo->lastInsertId()], 'message' => 'Category added'];
            break;
        
        case 'update_category':
            $id = (int)($_POST['id'] ?? 0);
            $name = trim($_POST['name'] ?? '');
            if (!$id || !$name) throw new Exception('Invalid parameters');
            $stmt = $pdo->prepare('UPDATE categories SET name = ? WHERE id = ?');
            $stmt->execute([$name, $id]);
            $response = ['success' => true, 'message' => 'Category updated'];
            break;
        
        case 'delete_category':
            $id = (int)($_POST['id'] ?? 0);
            if (!$id) throw new Exception('Invalid category id');
            $stmt = $pdo->prepare('DELETE FROM categories WHERE id = ?');
            $stmt->execute([$id]);
            $response = ['success' => true, 'message' => 'Category deleted'];
            break;
        
        // PROMPTS
        case 'get_prompts':
            $categoryId = (int)($_GET['category_id'] ?? 0);
            if (!$categoryId) throw new Exception('Missing category_id');
            
            $sql = 'SELECT p.id, p.text, '
                . '(SELECT GROUP_CONCAT(category_id, ",") FROM prompt_categories WHERE prompt_id = p.id) as category_ids, '
                . '(SELECT COUNT(*) FROM valid_words WHERE prompt_id = p.id) as word_count '
                . 'FROM prompts p '
                . 'JOIN prompt_categories pc ON p.id = pc.prompt_id '
                . 'WHERE pc.category_id = ? '
                . 'GROUP BY p.id '
                . 'ORDER BY p.text';
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$categoryId]);
            $results = $stmt->fetchAll();
            
            foreach ($results as &$row) {
                $row['category_ids'] = array_map('intval', array_filter(explode(',', $row['category_ids'] ?? '')));
                $row['word_count'] = (int)$row['word_count'];
            }
            
            $response = ['success' => true, 'data' => $results];
            break;
        
        case 'add_prompt':
            $categoryIds = json_decode($_POST['category_ids'] ?? '[]', true);
            $text = trim($_POST['text'] ?? '');
            
            if (!$text || empty($categoryIds)) {
                throw new Exception('Invalid parameters');
            }
            
            Database::getInstance()->beginTransaction();
            
            $stmt = $pdo->prepare('INSERT INTO prompts (text) VALUES (?)');
            $stmt->execute([$text]);
            $promptId = $pdo->lastInsertId();
            
            $relStmt = $pdo->prepare('INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)');
            foreach ($categoryIds as $catId) {
                $relStmt->execute([$promptId, (int)$catId]);
            }
            
            Database::getInstance()->commit();
            
            $response = ['success' => true, 'data' => ['id' => $promptId], 'message' => 'Prompt added'];
            break;
        
        case 'update_prompt':
            $id = (int)($_POST['id'] ?? 0);
            $text = trim($_POST['text'] ?? '');
            $categoryIds = json_decode($_POST['category_ids'] ?? '[]', true);
            
            if (!$id || !$text) throw new Exception('Invalid parameters');
            
            Database::getInstance()->beginTransaction();
            
            $stmt = $pdo->prepare('UPDATE prompts SET text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            $stmt->execute([$text, $id]);
            
            if (!empty($categoryIds)) {
                $pdo->prepare('DELETE FROM prompt_categories WHERE prompt_id = ?')->execute([$id]);
                $relStmt = $pdo->prepare('INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)');
                foreach ($categoryIds as $catId) {
                    $relStmt->execute([$id, (int)$catId]);
                }
            }
            
            Database::getInstance()->commit();
            
            $response = ['success' => true, 'message' => 'Prompt updated'];
            break;
        
        case 'delete_prompt':
            $id = (int)($_POST['id'] ?? 0);
            if (!$id) throw new Exception('Invalid prompt id');
            
            Database::getInstance()->beginTransaction();
            
            $pdo->prepare('DELETE FROM valid_words WHERE prompt_id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM prompt_categories WHERE prompt_id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM prompts WHERE id = ?')->execute([$id]);
            
            Database::getInstance()->commit();
            
            $response = ['success' => true, 'message' => 'Prompt deleted'];
            break;
        
        // VALID WORDS
        case 'get_words':
            $promptId = (int)($_GET['prompt_id'] ?? 0);
            if (!$promptId) throw new Exception('Missing prompt_id');
            
            $stmt = $pdo->prepare('SELECT id, prompt_id, word_entry FROM valid_words WHERE prompt_id = ? ORDER BY word_entry');
            $stmt->execute([$promptId]);
            $response = ['success' => true, 'data' => $stmt->fetchAll()];
            break;
        
        case 'add_word':
            $promptId = (int)($_POST['prompt_id'] ?? 0);
            $word = trim($_POST['word'] ?? '');
            
            if (!$promptId || !$word || strlen($word) > MAX_WORD_LENGTH) {
                throw new Exception('Invalid parameters');
            }
            
            $stmt = $pdo->prepare('INSERT INTO valid_words (prompt_id, word_entry) VALUES (?, ?)');
            $stmt->execute([$promptId, $word]);
            $response = ['success' => true, 'data' => ['id' => $pdo->lastInsertId()], 'message' => 'Word added'];
            break;
        
        case 'update_word':
            $id = (int)($_POST['id'] ?? 0);
            $word = trim($_POST['word'] ?? '');
            
            if (!$id || !$word) throw new Exception('Invalid parameters');
            
            $stmt = $pdo->prepare('UPDATE valid_words SET word_entry = ? WHERE id = ?');
            $stmt->execute([$word, $id]);
            $response = ['success' => true, 'message' => 'Word updated'];
            break;
        
        case 'delete_word':
            $id = (int)($_POST['id'] ?? 0);
            if (!$id) throw new Exception('Invalid word id');
            
            $stmt = $pdo->prepare('DELETE FROM valid_words WHERE id = ?');
            $stmt->execute([$id]);
            $response = ['success' => true, 'message' => 'Word deleted'];
            break;
        
        // STATISTICS
        case 'get_stats':
            $categories = (int)$pdo->query('SELECT COUNT(*) FROM categories')->fetchColumn();
            $prompts = (int)$pdo->query('SELECT COUNT(*) FROM prompts')->fetchColumn();
            $words = (int)$pdo->query('SELECT COUNT(*) FROM valid_words')->fetchColumn();
            $games = (int)$pdo->query('SELECT COUNT(*) FROM games')->fetchColumn();
            $players = (int)$pdo->query('SELECT COUNT(*) FROM players')->fetchColumn();
            
            $response = ['success' => true, 'data' => [
                'categories' => $categories,
                'prompts' => $prompts,
                'words' => $words,
                'games' => $games,
                'players' => $players
            ]];
            break;
        
        // GAMES
        case 'get_games':
            $sql = 'SELECT g.id as code, g.status, g.round as current_round, g.created_at, '
                . 'COUNT(DISTINCT p.id) as player_count '
                . 'FROM games g '
                . 'LEFT JOIN players p ON g.id = p.game_id '
                . 'GROUP BY g.id '
                . 'ORDER BY g.updated_at DESC LIMIT 100';
            
            $stmt = $pdo->query($sql);
            $games = $stmt->fetchAll();
            
            $response = ['success' => true, 'data' => $games];
            break;
        
        case 'delete_game':
            $code = trim($_POST['code'] ?? '');
            if (!$code) throw new Exception('Invalid game code');
            
            Database::getInstance()->beginTransaction();
            
            $pdo->prepare('DELETE FROM players WHERE game_id = ?')->execute([$code]);
            $pdo->prepare('DELETE FROM games WHERE id = ?')->execute([$code]);
            
            Database::getInstance()->commit();
            
            $response = ['success' => true, 'message' => 'Game deleted'];
            break;
        
        // DATABASE INSPECTION
        case 'inspect_db':
            $inspection = [
                'categories' => $pdo->query('SELECT id, name FROM categories ORDER BY id')->fetchAll(),
                'prompts' => $pdo->query('SELECT p.id, p.text, (SELECT GROUP_CONCAT(category_id, ",") FROM prompt_categories WHERE prompt_id = p.id) as category_ids FROM prompts p ORDER BY p.id')->fetchAll(),
                'words' => $pdo->query('SELECT id, prompt_id, word_entry FROM valid_words ORDER BY prompt_id, id')->fetchAll(),
                'games' => $pdo->query('SELECT id, status, round, created_at FROM games ORDER BY id')->fetchAll(),
                'stats' => [
                    'categories' => (int)$pdo->query('SELECT COUNT(*) FROM categories')->fetchColumn(),
                    'prompts' => (int)$pdo->query('SELECT COUNT(*) FROM prompts')->fetchColumn(),
                    'words' => (int)$pdo->query('SELECT COUNT(*) FROM valid_words')->fetchColumn(),
                    'games' => (int)$pdo->query('SELECT COUNT(*) FROM games')->fetchColumn()
                ]
            ];
            
            $response = ['success' => true, 'data' => $inspection];
            break;
        
        // VACUUM DATABASE
        case 'vacuum_db':
            $pdo->exec('VACUUM');
            Database::getInstance()->checkpoint();
            $response = ['success' => true, 'message' => 'Database optimized'];
            break;
        
        default:
            throw new Exception('Unknown action: ' . $action);
    }
    
    http_response_code($response['success'] ? 200 : 400);
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
    
} catch (Exception $e) {
    logMessage('API Error: ' . $e->getMessage(), 'ERROR');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => APP_DEBUG ? $e->getMessage() : 'An error occurred'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

?>
