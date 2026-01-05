<?php
require_once __DIR__ . '/../config.php';

class DictionaryManager {
    private $db = null;
    private $pdo = null;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->pdo = $this->db->getConnection();
    }

    public function getCategories() {
        try {
            $stmt = $this->pdo->query('SELECT id, name FROM categories ORDER BY name');
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching categories: ' . $e->getMessage());
        }
    }

    public function getCategoryById($categoryId) {
        try {
            $stmt = $this->pdo->prepare('SELECT id, name FROM categories WHERE id = ?');
            $stmt->execute([$categoryId]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching category: ' . $e->getMessage());
        }
    }

    public function getCategoryByName($categoryName) {
        try {
            $stmt = $this->pdo->prepare('SELECT id, name FROM categories WHERE name = ?');
            $stmt->execute([$categoryName]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching category by name: ' . $e->getMessage());
        }
    }

    public function addCategory($categoryName) {
        try {
            $stmt = $this->pdo->prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
            $stmt->execute([$categoryName]);
            return $this->getCategoryByName($categoryName);
        } catch (PDOException $e) {
            throw new Exception('Error adding category: ' . $e->getMessage());
        }
    }

    public function updateCategory($categoryId, $newName) {
        try {
            $stmt = $this->pdo->prepare('UPDATE categories SET name = ? WHERE id = ?');
            $stmt->execute([$newName, $categoryId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error updating category: ' . $e->getMessage());
        }
    }

    public function deleteCategory($categoryId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM categories WHERE id = ?');
            $stmt->execute([$categoryId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error deleting category: ' . $e->getMessage());
        }
    }

    public function getPromptsWithStats($categoryId) {
        try {
            $sql = 'SELECT 
                p.id, p.category_id, p.text,
                COUNT(vw.id) as word_count
            FROM prompts p
            LEFT JOIN valid_words vw ON p.id = vw.prompt_id
            WHERE p.category_id = ?
            GROUP BY p.id, p.category_id, p.text
            ORDER BY p.text';
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$categoryId]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching prompts: ' . $e->getMessage());
        }
    }

    public function getPrompts($categoryId = null) {
        try {
            if ($categoryId) {
                $stmt = $this->pdo->prepare('SELECT id, category_id, text FROM prompts WHERE category_id = ? ORDER BY text');
                $stmt->execute([$categoryId]);
            } else {
                $stmt = $this->pdo->query('SELECT id, category_id, text FROM prompts ORDER BY category_id, text');
            }
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching prompts: ' . $e->getMessage());
        }
    }

    public function getPromptById($promptId) {
        try {
            $stmt = $this->pdo->prepare('SELECT id, category_id, text FROM prompts WHERE id = ?');
            $stmt->execute([$promptId]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching prompt: ' . $e->getMessage());
        }
    }

    public function addPrompt($categoryId, $promptText) {
        try {
            $stmt = $this->pdo->prepare('INSERT INTO prompts (category_id, text) VALUES (?, ?)');
            $stmt->execute([$categoryId, $promptText]);
            return $this->pdo->lastInsertId();
        } catch (PDOException $e) {
            throw new Exception('Error adding prompt: ' . $e->getMessage());
        }
    }

    public function updatePrompt($promptId, $newText) {
        try {
            $stmt = $this->pdo->prepare('UPDATE prompts SET text = ? WHERE id = ?');
            $stmt->execute([$newText, $promptId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error updating prompt: ' . $e->getMessage());
        }
    }

    public function deletePrompt($promptId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM prompts WHERE id = ?');
            $stmt->execute([$promptId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error deleting prompt: ' . $e->getMessage());
        }
    }

    public function getValidWords($promptId = null) {
        try {
            if ($promptId) {
                $stmt = $this->pdo->prepare('SELECT id, prompt_id, word_entry FROM valid_words WHERE prompt_id = ? ORDER BY word_entry');
                $stmt->execute([$promptId]);
            } else {
                $stmt = $this->pdo->query('SELECT id, prompt_id, word_entry FROM valid_words ORDER BY prompt_id, word_entry');
            }
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching valid words: ' . $e->getMessage());
        }
    }

    public function getValidWordById($wordId) {
        try {
            $stmt = $this->pdo->prepare('SELECT id, prompt_id, word_entry FROM valid_words WHERE id = ?');
            $stmt->execute([$wordId]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching valid word: ' . $e->getMessage());
        }
    }

    public function addValidWord($promptId, $wordEntry) {
        try {
            $stmt = $this->pdo->prepare('INSERT INTO valid_words (prompt_id, word_entry) VALUES (?, ?)');
            $stmt->execute([$promptId, $wordEntry]);
            return $this->pdo->lastInsertId();
        } catch (PDOException $e) {
            throw new Exception('Error adding valid word: ' . $e->getMessage());
        }
    }

    public function updateValidWord($wordId, $newWordEntry) {
        try {
            $stmt = $this->pdo->prepare('UPDATE valid_words SET word_entry = ? WHERE id = ?');
            $stmt->execute([$newWordEntry, $wordId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error updating valid word: ' . $e->getMessage());
        }
    }

    public function deleteValidWord($wordId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM valid_words WHERE id = ?');
            $stmt->execute([$wordId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error deleting valid word: ' . $e->getMessage());
        }
    }

    public function deleteValidWordsByPrompt($promptId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM valid_words WHERE prompt_id = ?');
            $stmt->execute([$promptId]);
            return $stmt->rowCount();
        } catch (PDOException $e) {
            throw new Exception('Error deleting valid words: ' . $e->getMessage());
        }
    }

    public function getStats() {
        try {
            $categories = $this->pdo->query('SELECT COUNT(*) as count FROM categories')->fetch()['count'];
            $prompts = $this->pdo->query('SELECT COUNT(*) as count FROM prompts')->fetch()['count'];
            $words = $this->pdo->query('SELECT COUNT(*) as count FROM valid_words')->fetch()['count'];

            return [
                'categories' => (int)$categories,
                'prompts' => (int)$prompts,
                'words' => (int)$words
            ];
        } catch (PDOException $e) {
            throw new Exception('Error fetching stats: ' . $e->getMessage());
        }
    }

    public function getGames() {
        try {
            $sql = 'SELECT 
                g.id, g.code, g.host_name, g.status, g.current_round, g.created_at,
                COUNT(DISTINCT gp.id) as player_count
            FROM games g
            LEFT JOIN game_players gp ON g.id = gp.game_id
            GROUP BY g.id, g.code, g.host_name, g.status, g.current_round, g.created_at
            ORDER BY g.created_at DESC';
            
            $stmt = $this->pdo->query($sql);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching games: ' . $e->getMessage());
        }
    }

    public function getGameByCode($code) {
        try {
            $stmt = $this->pdo->prepare('SELECT * FROM games WHERE code = ? LIMIT 1');
            $stmt->execute([$code]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching game: ' . $e->getMessage());
        }
    }

    public function deleteGame($code) {
        try {
            $game = $this->getGameByCode($code);
            if (!$game) throw new Exception('Game not found');
            
            $gameId = $game['id'];
            
            $this->pdo->prepare('DELETE FROM game_players WHERE game_id = ?')->execute([$gameId]);
            $this->pdo->prepare('DELETE FROM games WHERE id = ?')->execute([$gameId]);
            
            return true;
        } catch (PDOException $e) {
            throw new Exception('Error deleting game: ' . $e->getMessage());
        }
    }
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-cache, no-store, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    $manager = new DictionaryManager();
    $action = $_GET['action'] ?? $_POST['action'] ?? null;
    $id = $_GET['id'] ?? $_POST['id'] ?? null;
    $categoryId = $_GET['category_id'] ?? $_POST['category_id'] ?? null;
    $promptId = $_GET['prompt_id'] ?? $_POST['prompt_id'] ?? null;
    $code = $_GET['code'] ?? $_POST['code'] ?? null;

    $response = ['success' => false, 'message' => 'Unknown action'];

    switch ($action) {
        case 'get_categories':
            $response = ['success' => true, 'data' => $manager->getCategories()];
            break;

        case 'get_category':
            if (!$id) throw new Exception('Missing category_id');
            $response = ['success' => true, 'data' => $manager->getCategoryById($id)];
            break;

        case 'add_category':
            if (!isset($_POST['name']) || empty($_POST['name'])) throw new Exception('Missing category name');
            $result = $manager->addCategory($_POST['name']);
            $response = ['success' => true, 'data' => $result, 'message' => 'Category added'];
            break;

        case 'update_category':
            if (!$id) throw new Exception('Missing category_id');
            if (!isset($_POST['name']) || empty($_POST['name'])) throw new Exception('Missing category name');
            $manager->updateCategory($id, $_POST['name']);
            $response = ['success' => true, 'message' => 'Category updated'];
            break;

        case 'delete_category':
            if (!$id) throw new Exception('Missing category_id');
            $manager->deleteCategory($id);
            $response = ['success' => true, 'message' => 'Category deleted'];
            break;

        case 'get_prompts':
            if (!$categoryId) throw new Exception('Missing category_id');
            $response = ['success' => true, 'data' => $manager->getPromptsWithStats($categoryId)];
            break;

        case 'get_prompt':
            if (!$id) throw new Exception('Missing prompt_id');
            $response = ['success' => true, 'data' => $manager->getPromptById($id)];
            break;

        case 'add_prompt':
            if (!$categoryId) throw new Exception('Missing category_id');
            if (!isset($_POST['text']) || empty($_POST['text'])) throw new Exception('Missing prompt text');
            $promptId = $manager->addPrompt($categoryId, $_POST['text']);
            $response = ['success' => true, 'data' => ['id' => $promptId], 'message' => 'Prompt added'];
            break;

        case 'update_prompt':
            if (!$id) throw new Exception('Missing prompt_id');
            if (!isset($_POST['text']) || empty($_POST['text'])) throw new Exception('Missing prompt text');
            $manager->updatePrompt($id, $_POST['text']);
            $response = ['success' => true, 'message' => 'Prompt updated'];
            break;

        case 'delete_prompt':
            if (!$id) throw new Exception('Missing prompt_id');
            $manager->deleteValidWordsByPrompt($id);
            $manager->deletePrompt($id);
            $response = ['success' => true, 'message' => 'Prompt and its words deleted'];
            break;

        case 'get_words':
            if (!$promptId) throw new Exception('Missing prompt_id');
            $response = ['success' => true, 'data' => $manager->getValidWords($promptId)];
            break;

        case 'get_word':
            if (!$id) throw new Exception('Missing word_id');
            $response = ['success' => true, 'data' => $manager->getValidWordById($id)];
            break;

        case 'add_word':
            if (!$promptId) throw new Exception('Missing prompt_id');
            if (!isset($_POST['word']) || empty($_POST['word'])) throw new Exception('Missing word entry');
            $wordId = $manager->addValidWord($promptId, $_POST['word']);
            $response = ['success' => true, 'data' => ['id' => $wordId], 'message' => 'Word added'];
            break;

        case 'update_word':
            if (!$id) throw new Exception('Missing word_id');
            if (!isset($_POST['word']) || empty($_POST['word'])) throw new Exception('Missing word entry');
            $manager->updateValidWord($id, $_POST['word']);
            $response = ['success' => true, 'message' => 'Word updated'];
            break;

        case 'delete_word':
            if (!$id) throw new Exception('Missing word_id');
            $manager->deleteValidWord($id);
            $response = ['success' => true, 'message' => 'Word deleted'];
            break;

        case 'stats':
            $response = ['success' => true, 'data' => $manager->getStats()];
            break;

        case 'get_games':
            $response = ['success' => true, 'data' => $manager->getGames()];
            break;

        case 'get_game':
            if (!$code) throw new Exception('Missing game code');
            $response = ['success' => true, 'data' => $manager->getGameByCode($code)];
            break;

        case 'delete_game':
            if (!$code) throw new Exception('Missing game code');
            $manager->deleteGame($code);
            $response = ['success' => true, 'message' => 'Game deleted'];
            break;
    }

    http_response_code($response['success'] ? 200 : 400);
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
?>
