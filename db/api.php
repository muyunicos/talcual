<?php
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

    match($method) {
        'POST' => handlePost($db, $action),
        'GET' => handleGet($db, $action),
        default => respondError('Invalid request method')
    };

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
        $this->ensureSchema();
    }

    private function ensureSchema() {
        $this->pdo->exec('PRAGMA foreign_keys = ON');
        
        try {
            $stmt = $this->pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'");
            $exists = $stmt->fetch() !== null;
            
            if (!$exists) {
                $this->createSchema();
            } else {
                $this->migrateSchema();
            }
        } catch (PDOException $e) {
            logMessage('Schema check error: ' . $e->getMessage(), 'WARN');
        }
    }

    private function createSchema() {
        try {
            $this->pdo->exec('
                CREATE TABLE categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    orden INTEGER NOT NULL DEFAULT 0,
                    is_active BOOLEAN DEFAULT 1,
                    created_at INTEGER NOT NULL DEFAULT 0
                )
            ');

            $this->pdo->exec('
                CREATE TABLE prompts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    text TEXT UNIQUE NOT NULL,
                    difficulty INTEGER DEFAULT 1,
                    is_active BOOLEAN DEFAULT 1,
                    created_at INTEGER NOT NULL DEFAULT 0
                )
            ');

            $this->pdo->exec('
                CREATE TABLE prompt_categories (
                    prompt_id INTEGER NOT NULL,
                    category_id INTEGER NOT NULL,
                    PRIMARY KEY (prompt_id, category_id),
                    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
                    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
                )
            ');

            $this->pdo->exec('
                CREATE TABLE valid_words (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    prompt_id INTEGER NOT NULL,
                    word TEXT NOT NULL,
                    normalized_word TEXT NOT NULL,
                    gender TEXT,
                    created_at INTEGER DEFAULT 0,
                    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
                    UNIQUE(prompt_id, normalized_word)
                )
            ');

            $this->createIndexes();
            logMessage('Schema created successfully', 'INFO');
        } catch (PDOException $e) {
            logMessage('Schema creation error: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Could not create schema: ' . $e->getMessage());
        }
    }

    private function migrateSchema() {
        try {
            $tableInfo = $this->pdo->query("PRAGMA table_info(categories)")->fetchAll(PDO::FETCH_COLUMN, 1);
            
            if (!in_array('orden', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE categories ADD COLUMN orden INTEGER NOT NULL DEFAULT 0');
            }
            if (!in_array('is_active', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE categories ADD COLUMN is_active BOOLEAN DEFAULT 1');
            }
            if (!in_array('created_at', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE categories ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0');
            }
            
            $tableInfo = $this->pdo->query("PRAGMA table_info(prompts)")->fetchAll(PDO::FETCH_COLUMN, 1);
            if (!in_array('difficulty', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE prompts ADD COLUMN difficulty INTEGER DEFAULT 1');
            }
            if (!in_array('is_active', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE prompts ADD COLUMN is_active BOOLEAN DEFAULT 1');
            }
            if (!in_array('created_at', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE prompts ADD COLUMN created_at INTEGER DEFAULT 0');
            }
            
            $tableInfo = $this->pdo->query("PRAGMA table_info(valid_words)")->fetchAll(PDO::FETCH_COLUMN, 1);
            if (!in_array('normalized_word', $tableInfo)) {
                $this->pdo->exec('ALTER TABLE valid_words ADD COLUMN normalized_word TEXT');
                $this->pdo->exec('ALTER TABLE valid_words ADD COLUMN gender TEXT');
                $this->pdo->exec('ALTER TABLE valid_words ADD COLUMN created_at INTEGER DEFAULT 0');
                
                $words = $this->pdo->query('SELECT id, word FROM valid_words')->fetchAll(PDO::FETCH_ASSOC);
                $stmt = $this->pdo->prepare('UPDATE valid_words SET normalized_word = ? WHERE id = ?');
                foreach ($words as $w) {
                    $normalized = mb_strtoupper(trim($w['word']), 'UTF-8');
                    $stmt->execute([$normalized, $w['id']]);
                }
            }
            
            $this->createIndexes();
            logMessage('Schema migrated successfully', 'INFO');
        } catch (PDOException $e) {
            logMessage('Schema migration error: ' . $e->getMessage(), 'WARN');
        }
    }

    private function createIndexes() {
        $indexes = [
            'CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active)',
            'CREATE INDEX IF NOT EXISTS idx_categories_orden ON categories(orden)',
            'CREATE INDEX IF NOT EXISTS idx_prompts_active ON prompts(is_active)',
            'CREATE INDEX IF NOT EXISTS idx_prompts_difficulty ON prompts(difficulty)',
            'CREATE INDEX IF NOT EXISTS idx_prompt_categories_prompt ON prompt_categories(prompt_id)',
            'CREATE INDEX IF NOT EXISTS idx_prompt_categories_category ON prompt_categories(category_id)',
            'CREATE INDEX IF NOT EXISTS idx_valid_words_prompt ON valid_words(prompt_id)',
            'CREATE INDEX IF NOT EXISTS idx_valid_words_normalized ON valid_words(normalized_word)'
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

    public function addCategory($name, $orden = null) {
        if (empty(trim($name))) throw new Exception('Category name cannot be empty');
        
        if ($orden === null) {
            $result = $this->pdo->query('SELECT MAX(orden) as max_orden FROM categories')->fetch(PDO::FETCH_ASSOC);
            $orden = (int)($result['max_orden'] ?? 0) + 1;
        }
        
        try {
            $stmt = $this->pdo->prepare('INSERT INTO categories (name, orden, is_active, created_at) VALUES (?, ?, 1, 0)');
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
                    LEFT JOIN prompt_categories pc ON p.id = pc.prompt_id
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
            $row['category_ids'] = array_values(array_filter(array_map('intval', explode(',', $row['category_ids'] ?? ''))));
            $row['difficulty'] = (int)$row['difficulty'];
        }
        return $results;
    }

    public function addPrompt($categoryIds, $text, $difficulty = 1) {
        if (empty(trim($text))) throw new Exception('Prompt text cannot be empty');
        if (!is_array($categoryIds)) $categoryIds = [$categoryIds];
        if (empty($categoryIds)) throw new Exception('At least one category is required');
        
        try {
            $stmt = $this->pdo->prepare('INSERT INTO prompts (text, difficulty, is_active, created_at) VALUES (?, ?, 1, 0)');
            $stmt->execute([$text, max(1, min(5, (int)$difficulty))]);
            $promptId = $this->pdo->lastInsertId();
            
            $relStmt = $this->pdo->prepare('INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)');
            foreach (array_unique($categoryIds) as $catId) {
                $relStmt->execute([$promptId, $catId]);
            }
            
            return $promptId;
        } catch (PDOException $e) {
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
        
        if (!empty($updates)) {
            $params[] = $id;
            $sql = 'UPDATE prompts SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
        }
        
        if ($categoryIds !== null) {
            if (!is_array($categoryIds)) $categoryIds = [$categoryIds];
            $this->pdo->prepare('DELETE FROM prompt_categories WHERE prompt_id = ?')->execute([$id]);
            
            foreach (array_unique($categoryIds) as $catId) {
                $this->pdo->prepare('INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)')->execute([$id, $catId]);
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
            $stmt = $this->pdo->prepare('SELECT id, prompt_id, word, normalized_word, gender, created_at FROM valid_words WHERE prompt_id = ? ORDER BY word');
            $stmt->execute([$promptId]);
        } else {
            $stmt = $this->pdo->query('SELECT id, prompt_id, word, normalized_word, gender, created_at FROM valid_words ORDER BY prompt_id, word');
        }
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function addWord($promptId, $word, $gender = null) {
        if (empty(trim($word))) throw new Exception('Word cannot be empty');
        
        $normalized = mb_strtoupper(trim($word), 'UTF-8');
        
        try {
            $stmt = $this->pdo->prepare('INSERT INTO valid_words (prompt_id, word, normalized_word, gender, created_at) VALUES (?, ?, ?, ?, 0)');
            $stmt->execute([$promptId, trim($word), $normalized, $gender]);
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
            $updates[] = 'word = ?';
            $params[] = trim($word);
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

    public function getDictionaryStats() {
        return [
            'categories' => (int)$this->pdo->query('SELECT COUNT(*) FROM categories')->fetchColumn(),
            'prompts' => (int)$this->pdo->query('SELECT COUNT(*) FROM prompts')->fetchColumn(),
            'words' => (int)$this->pdo->query('SELECT COUNT(*) FROM valid_words')->fetchColumn(),
            'games' => (int)$this->pdo->query('SELECT COUNT(*) FROM games')->fetchColumn(),
            'players' => (int)$this->pdo->query('SELECT COUNT(*) FROM players')->fetchColumn()
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
            $stmt->execute([$index, (int)$catId]);
        }
        return true;
    }
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
            'delete-word' => handleDeleteWord($db),
            'reorder-categories' => handleReorderCategories($db),
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
            'get-categories' => respondSuccess('Categories loaded', $db->getAllCategories()),
            'get-prompts' => respondSuccess('Prompts loaded', $db->getPrompts($_GET['category_id'] ?? null)),
            'get-words' => respondSuccess('Words loaded', $db->getWords($_GET['prompt_id'] ?? null)),
            'get-stats' => respondSuccess('Stats loaded', $db->getDictionaryStats()),
            'inspect' => respondSuccess('Inspection completed', ['stats' => $db->getDictionaryStats()]),
            default => respondError('Unknown GET action: ' . $action)
        };
    } catch (Exception $e) {
        respondError($e->getMessage());
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
    if (!$data || !isset($data['text']) || !isset($data['category_ids'])) {
        throw new Exception('Missing text or category_ids');
    }
    
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
    if (!$data || !isset($data['prompt_id']) || !isset($data['word'])) {
        throw new Exception('Missing prompt_id or word');
    }
    
    $wordId = $db->addWord($data['prompt_id'], $data['word'], $data['gender'] ?? null);
    respondSuccess('Word added', ['word_id' => $wordId]);
}

function handleDeleteWord($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) throw new Exception('Missing id');
    
    $db->deleteWord($data['id']);
    respondSuccess('Word deleted');
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
    
    $stats = ['categories_added' => 0, 'prompts_added' => 0, 'words_added' => 0];
    
    $categoryMap = [];
    foreach ($json['categories'] ?? [] as $catData) {
        try {
            $cat = $db->addCategory($catData['name'] ?? 'Unknown', $catData['orden'] ?? null);
            $categoryMap[$catData['id'] ?? null] = $cat['id'];
            $stats['categories_added']++;
        } catch (Exception $e) {
            logMessage('Category import error: ' . $e->getMessage(), 'WARN');
        }
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
