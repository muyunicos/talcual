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
        if (empty(trim($name))) throw new Exception('Category name cannot be empty');
        
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
        if (empty(trim($text))) throw new Exception('Prompt text cannot be empty');
        if (!is_array($categoryIds)) $categoryIds = [$categoryIds];
        if (empty($categoryIds)) throw new Exception('At least one category is required');
        
        try {
            $stmt = $this->pdo->prepare('INSERT INTO prompts (text, difficulty, is_active, date) VALUES (?, ?, 1, 0)');
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
        if (empty(trim($wordGroup))) throw new Exception('Word group cannot be empty');
        
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
        if ($wordGroup === null) return false;
        
        $stmt = $this->pdo->prepare('UPDATE valid_words SET word_group = ? WHERE id = ?');
        return $stmt->execute([trim($wordGroup), $id]) && $stmt->rowCount() > 0;
    }

    public function deleteWord($id) {
        $stmt = $this->pdo->prepare('DELETE FROM valid_words WHERE id = ?');
        return $stmt->execute([$id]) && $stmt->rowCount() > 0;
    }

    public function replacePromptWords($promptId, $wordGroups) {
        if (!is_array($wordGroups)) $wordGroups = [$wordGroups];
        
        $wordGroups = array_map(function($w) { return trim($w); }, $wordGroups);
        $wordGroups = array_filter($wordGroups, function($w) { return !empty($w); });
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

    public function getDictionaryStats() {
        return [
            'categories' => (int)$this->pdo->query('SELECT COUNT(*) FROM categories')->fetchColumn(),
            'prompts' => (int)$this->pdo->query('SELECT COUNT(*) FROM prompts')->fetchColumn(),
            'words' => (int)$this->pdo->query('SELECT COUNT(*) FROM valid_words')->fetchColumn(),
            'games' => (int)$this->pdo->query('SELECT COUNT(*) FROM games')->fetchColumn(),
            'players' => (int)$this->pdo->query('SELECT COUNT(*) FROM players')->fetchColumn()
        ];
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
        $stmt = $this->pdo->prepare('SELECT id, game_id, name, aura, status, score, round_history
                FROM players WHERE game_id = ? ORDER BY id');
        $stmt->execute([$gameId]);
        $players = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        
        foreach ($players as &$player) {
            $player['score'] = (int)$player['score'];
            $player['round_history'] = $player['round_history'] ? json_decode($player['round_history'], true) : [];
        }
        return $players;
    }

    public function optimizeDatabase() {
        $this->pdo->exec('PRAGMA optimize');
        $this->pdo->exec('VACUUM');
        return true;
    }

    public function reorderCategories($order) {
        if (!is_array($order) || empty($order)) {
            throw new Exception('Invalid order array');
        }

        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare('UPDATE categories SET orden = ? WHERE id = ?');
            foreach ($order as $index => $catId) {
                $stmt->execute([$index + 1, (int)$catId]);
            }
            $this->pdo->commit();
            return true;
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function getInspectionData() {
        return [
            'stats' => $this->getDictionaryStats(),
            'games_sample' => $this->getGames(10),
            'dictionary_size' => filesize($this->dbFile) ?? 0,
            'schema_version' => 2
        ];
    }

    public function getDeepInspection() {
        $schema = [];
        
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
            'database_file' => $this->dbFile,
            'file_size_bytes' => filesize($this->dbFile) ?? 0,
            'file_size_mb' => round((filesize($this->dbFile) ?? 0) / (1024 * 1024), 2),
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
            'get-games' => respondSuccess('Games loaded', $db->getGames()),
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
    
    $wordId = $db->addWord($data['prompt_id'], $data['word']);
    respondSuccess('Word added', ['word_id' => $wordId]);
}

function handleUpdateWord($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) throw new Exception('Missing id');
    
    $db->updateWord($data['id'], $data['word'] ?? null);
    respondSuccess('Word updated');
}

function handleDeleteWord($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id'])) throw new Exception('Missing id');
    
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
            if (isset($categoryMap[$id])) $catIds[] = $categoryMap[$id];
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
        if (!is_array($categoryData)) continue;
        
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
                if (!is_array($promptItem) || empty($promptItem)) continue;
                
                foreach ($promptItem as $promptText => $wordsData) {
                    if (!is_string($promptText) || empty(trim($promptText))) continue;
                    
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
                    
                    if (empty($wordGroups)) continue;
                    
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