<?php

require_once __DIR__ . '/../app/Database.php';

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

class DatabaseManager {
    private $db = null;
    private $pdo = null;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->pdo = $this->db->getConnection();
    }

    public function initializeDatabase() {
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

            $this->createIndexes();
            $this->runMigrations();
            
            logMessage('Database initialized successfully', 'INFO');
            return true;

        } catch (PDOException $e) {
            logMessage('Error initializing database: ' . $e->getMessage(), 'ERROR');
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
            $stats = $this->getStats();
            
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

    public function getStats() {
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

    public function addCategory($name) {
        try {
            $name = trim($name);
            if (empty($name)) {
                throw new Exception('Category name cannot be empty');
            }
            
            $stmt = $this->pdo->prepare('INSERT INTO categories (name, orden, is_active, date) VALUES (?, (SELECT COALESCE(MAX(orden), 0) + 1 FROM categories), 1, ?)');
            $stmt->execute([$name, time()]);
            
            return [
                'id' => $this->pdo->lastInsertId(),
                'name' => $name
            ];
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'UNIQUE constraint failed') !== false) {
                throw new Exception('Category already exists');
            }
            throw $e;
        }
    }

    public function updateCategory($categoryId, $name) {
        try {
            $name = trim($name);
            if (empty($name)) {
                throw new Exception('Category name cannot be empty');
            }
            
            $stmt = $this->pdo->prepare('UPDATE categories SET name = ? WHERE id = ?');
            $stmt->execute([$name, $categoryId]);
            
            return $stmt->rowCount() > 0;
        } catch (Exception $e) {
            throw new Exception('Error updating category: ' . $e->getMessage());
        }
    }

    public function deleteCategory($categoryId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM categories WHERE id = ?');
            $stmt->execute([$categoryId]);
            return $stmt->rowCount() > 0;
        } catch (Exception $e) {
            throw new Exception('Error deleting category: ' . $e->getMessage());
        }
    }

    public function addPrompt($categoryIds, $promptText) {
        try {
            $promptText = trim($promptText);
            if (empty($promptText)) {
                throw new Exception('Prompt text cannot be empty');
            }
            
            if (!is_array($categoryIds) || empty($categoryIds)) {
                throw new Exception('At least one category required');
            }
            
            $this->db->beginTransaction();
            
            $stmt = $this->pdo->prepare('INSERT INTO prompts (text, is_active, date) VALUES (?, 1, ?)');
            $stmt->execute([$promptText, time()]);
            
            $promptId = $this->pdo->lastInsertId();
            
            $relStmt = $this->pdo->prepare('INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)');
            foreach ($categoryIds as $catId) {
                $relStmt->execute([$promptId, (int)$catId]);
            }
            
            $this->db->commit();
            
            return $promptId;
        } catch (Exception $e) {
            $this->db->rollback();
            throw new Exception('Error adding prompt: ' . $e->getMessage());
        }
    }

    public function updatePrompt($promptId, $promptText, $categoryIds = null) {
        try {
            $promptText = trim($promptText);
            if (empty($promptText)) {
                throw new Exception('Prompt text cannot be empty');
            }
            
            $this->db->beginTransaction();
            
            $stmt = $this->pdo->prepare('UPDATE prompts SET text = ? WHERE id = ?');
            $stmt->execute([$promptText, $promptId]);
            
            if ($categoryIds !== null) {
                if (!is_array($categoryIds)) {
                    throw new Exception('Invalid categoryIds format');
                }
                
                $this->pdo->prepare('DELETE FROM prompt_categories WHERE prompt_id = ?')->execute([$promptId]);
                
                if (!empty($categoryIds)) {
                    $relStmt = $this->pdo->prepare('INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)');
                    foreach ($categoryIds as $catId) {
                        $relStmt->execute([$promptId, (int)$catId]);
                    }
                }
            }
            
            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollback();
            throw new Exception('Error updating prompt: ' . $e->getMessage());
        }
    }

    public function deletePrompt($promptId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM prompts WHERE id = ?');
            $stmt->execute([$promptId]);
            return $stmt->rowCount() > 0;
        } catch (Exception $e) {
            throw new Exception('Error deleting prompt: ' . $e->getMessage());
        }
    }

    public function addValidWord($promptId, $word) {
        try {
            $word = mb_strtoupper(trim($word), 'UTF-8');
            if (empty($word)) {
                throw new Exception('Word cannot be empty');
            }
            
            $stmt = $this->pdo->prepare('INSERT INTO valid_words (prompt_id, word_group) VALUES (?, ?)');
            $stmt->execute([$promptId, $word]);
            
            return [
                'id' => $this->pdo->lastInsertId(),
                'prompt_id' => $promptId,
                'word_group' => $word
            ];
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'UNIQUE constraint failed') !== false) {
                throw new Exception('Word already exists for this prompt');
            }
            throw $e;
        }
    }

    public function updateValidWord($wordId, $word) {
        try {
            $word = mb_strtoupper(trim($word), 'UTF-8');
            if (empty($word)) {
                throw new Exception('Word cannot be empty');
            }
            
            $stmt = $this->pdo->prepare('UPDATE valid_words SET word_group = ? WHERE id = ?');
            $stmt->execute([$word, $wordId]);
            
            return $stmt->rowCount() > 0;
        } catch (Exception $e) {
            throw new Exception('Error updating valid word: ' . $e->getMessage());
        }
    }

    public function deleteValidWord($wordId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM valid_words WHERE id = ?');
            $stmt->execute([$wordId]);
            return $stmt->rowCount() > 0;
        } catch (Exception $e) {
            throw new Exception('Error deleting valid word: ' . $e->getMessage());
        }
    }

    public function vacuum() {
        try {
            $this->pdo->exec('VACUUM');
            $this->pdo->exec('PRAGMA optimize');
            $this->db->checkpoint();
            logMessage('Database vacuumed', 'INFO');
            return true;
        } catch (Exception $e) {
            throw new Exception('Error vacuuming database: ' . $e->getMessage());
        }
    }

    public function getDatabaseInspection() {
        try {
            $categories = $this->pdo->query('SELECT id, name, orden, is_active FROM categories ORDER BY orden')->fetchAll(PDO::FETCH_ASSOC);
            $prompts = $this->pdo->query('SELECT p.id, p.text, (SELECT GROUP_CONCAT(category_id, ",") FROM prompt_categories WHERE prompt_id = p.id) as category_ids FROM prompts p WHERE p.is_active = 1 ORDER BY p.text')->fetchAll(PDO::FETCH_ASSOC);
            $words = $this->pdo->query('SELECT id, prompt_id, word_group FROM valid_words ORDER BY prompt_id, id')->fetchAll(PDO::FETCH_ASSOC);
            
            return [
                'success' => true,
                'categories' => $categories,
                'prompts' => $prompts,
                'words' => $words,
                'stats' => $this->getStats()
            ];
        } catch (Exception $e) {
            throw new Exception('Error inspecting database: ' . $e->getMessage());
        }
    }
}

header('Content-Type: application/json');

try {
    $action = $_GET['action'] ?? $_POST['action'] ?? null;
    $manager = new DatabaseManager();

    if (!$action) {
        http_response_code(400);
        echo json_encode(['error' => 'No action specified']);
        exit;
    }

    switch ($action) {
        case 'init':
            $manager->initializeDatabase();
            echo json_encode(['success' => true, 'message' => 'Database initialized']);
            break;

        case 'health':
            echo json_encode($manager->getHealth());
            break;

        case 'stats':
            echo json_encode(['success' => true, 'stats' => $manager->getStats()]);
            break;

        case 'inspect':
            echo json_encode($manager->getDatabaseInspection());
            break;

        case 'add-category':
            $name = $_POST['name'] ?? null;
            if (!$name) {
                throw new Exception('Category name required');
            }
            $result = $manager->addCategory($name);
            echo json_encode(['success' => true, 'data' => $result]);
            break;

        case 'update-category':
            $id = $_POST['id'] ?? null;
            $name = $_POST['name'] ?? null;
            if (!$id || !$name) {
                throw new Exception('Category ID and name required');
            }
            $manager->updateCategory($id, $name);
            echo json_encode(['success' => true, 'message' => 'Category updated']);
            break;

        case 'delete-category':
            $id = $_POST['id'] ?? null;
            if (!$id) {
                throw new Exception('Category ID required');
            }
            $manager->deleteCategory($id);
            echo json_encode(['success' => true, 'message' => 'Category deleted']);
            break;

        case 'add-prompt':
            $categoryIds = $_POST['category_ids'] ?? null;
            $text = $_POST['text'] ?? null;
            if (!$categoryIds || !$text) {
                throw new Exception('Category IDs and prompt text required');
            }
            $categoryIds = is_array($categoryIds) ? $categoryIds : [$categoryIds];
            $result = $manager->addPrompt($categoryIds, $text);
            echo json_encode(['success' => true, 'prompt_id' => $result]);
            break;

        case 'update-prompt':
            $id = $_POST['id'] ?? null;
            $text = $_POST['text'] ?? null;
            $categoryIds = $_POST['category_ids'] ?? null;
            if (!$id || !$text) {
                throw new Exception('Prompt ID and text required');
            }
            if ($categoryIds) {
                $categoryIds = is_array($categoryIds) ? $categoryIds : [$categoryIds];
            }
            $manager->updatePrompt($id, $text, $categoryIds);
            echo json_encode(['success' => true, 'message' => 'Prompt updated']);
            break;

        case 'delete-prompt':
            $id = $_POST['id'] ?? null;
            if (!$id) {
                throw new Exception('Prompt ID required');
            }
            $manager->deletePrompt($id);
            echo json_encode(['success' => true, 'message' => 'Prompt deleted']);
            break;

        case 'add-word':
            $promptId = $_POST['prompt_id'] ?? null;
            $word = $_POST['word'] ?? null;
            if (!$promptId || !$word) {
                throw new Exception('Prompt ID and word required');
            }
            $result = $manager->addValidWord($promptId, $word);
            echo json_encode(['success' => true, 'data' => $result]);
            break;

        case 'update-word':
            $id = $_POST['id'] ?? null;
            $word = $_POST['word'] ?? null;
            if (!$id || !$word) {
                throw new Exception('Word ID and word required');
            }
            $manager->updateValidWord($id, $word);
            echo json_encode(['success' => true, 'message' => 'Word updated']);
            break;

        case 'delete-word':
            $id = $_POST['id'] ?? null;
            if (!$id) {
                throw new Exception('Word ID required');
            }
            $manager->deleteValidWord($id);
            echo json_encode(['success' => true, 'message' => 'Word deleted']);
            break;

        case 'vacuum':
            $manager->vacuum();
            echo json_encode(['success' => true, 'message' => 'Database vacuumed']);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Unknown action: ' . $action]);
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>