<?php
header('Content-Type: application/json');

set_error_handler(function($severity, $message, $file, $line) {
    logMessage("PHP Error [$severity]: $message in $file:$line", 'ERROR');
    respondError("Server error: $message");
    exit;
});

try {
    // 1. ENSURE DATA DIRECTORY EXISTS
    ensureDataDirectory();
    
    // 2. CHECK IF DB FILE EXISTS, IF NOT CREATE IT
    ensureDatabaseFile();
    
    require_once __DIR__ . '/../app/Database.php';
    require_once __DIR__ . '/../app/Traits/WordNormalizer.php';
    require_once __DIR__ . '/../app/AdminDictionary.php';
    require_once __DIR__ . '/../app/AppUtils.php';

    $action = $_GET['action'] ?? null;

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if ($action === 'import') handleImport();
        elseif ($action === 'save') handleSave();
        elseif ($action === 'optimize') handleOptimize();
        elseif ($action === 'repair') handleRepair();
        elseif ($action === 'nuke') handleNuke();
        elseif ($action === 'diagnose') handleDiagnose();
        elseif ($action === 'add-category') handleAddCategory();
        elseif ($action === 'delete-category') handleDeleteCategory();
        elseif ($action === 'add-prompt') handleAddPrompt();
        elseif ($action === 'delete-prompt') handleDeletePrompt();
        else respondError('Unknown POST action: ' . $action);
    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($action === 'get-db') getDatabase();
        elseif ($action === 'inspect') inspectDatabase();
        elseif ($action === 'get-categories') getCategories();
        elseif ($action === 'get-prompts') getPrompts();
        elseif ($action === 'export') exportDatabase();
        else respondError('Unknown GET action: ' . $action);
    } else {
        respondError('Invalid request method');
    }

} catch (Exception $e) {
    logMessage('dmanager.php fatal error: ' . $e->getMessage(), 'FATAL');
    http_response_code(500);
    respondError('Server Error: ' . $e->getMessage());
}

// ============================================================================
// INITIALIZATION FUNCTIONS
// ============================================================================

function ensureDataDirectory() {
    $dataDir = __DIR__ . '/../data';
    if (!is_dir($dataDir)) {
        if (!mkdir($dataDir, 0755, true)) {
            throw new Exception('Cannot create /data directory');
        }
    }
    if (!is_writable($dataDir)) {
        throw new Exception('/data directory is not writable');
    }
}

function ensureDatabaseFile() {
    $dbFile = __DIR__ . '/../data/talcual.db';
    
    // If file exists and is valid SQLite, return
    if (file_exists($dbFile)) {
        if (isValidSQLiteDatabase($dbFile)) {
            return;
        } else {
            logMessage('Corrupted DB detected at ' . $dbFile . ', will attempt repair', 'WARN');
            return;
        }
    }
    
    // File doesn't exist, create new clean database
    logMessage('Creating new database file: ' . $dbFile, 'INFO');
    createNewDatabase($dbFile);
}

function isValidSQLiteDatabase($filePath) {
    if (!file_exists($filePath) || !is_readable($filePath)) {
        return false;
    }
    
    $handle = @fopen($filePath, 'r');
    if (!$handle) return false;
    
    $header = fread($handle, 16);
    fclose($handle);
    
    // SQLite database files start with 'SQLite format 3\x00'
    return strpos($header, 'SQLite format 3') === 0;
}

function createNewDatabase($dbFile) {
    try {
        $pdo = new PDO('sqlite:' . $dbFile);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        // Set pragmas
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA synchronous = NORMAL');
        
        // Create all tables
        createTables($pdo);
        
        logMessage('New database created successfully at ' . $dbFile, 'INFO');
    } catch (Exception $e) {
        throw new Exception('Failed to create database: ' . $e->getMessage());
    }
}

function createTables($pdo) {
    $tables = [
        'CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL DEFAULT "waiting",
            round INTEGER NOT NULL DEFAULT 0,
            current_prompt TEXT,
            current_category TEXT,
            selected_category TEXT,
            round_started_at INTEGER,
            round_starts_at INTEGER,
            round_ends_at INTEGER,
            countdown_duration INTEGER,
            created_at INTEGER,
            updated_at INTEGER,
            total_rounds INTEGER NOT NULL DEFAULT 3,
            round_duration INTEGER NOT NULL DEFAULT 60,
            min_players INTEGER NOT NULL DEFAULT 2,
            max_players INTEGER NOT NULL DEFAULT 4,
            start_countdown INTEGER NOT NULL DEFAULT 5,
            hurry_up_threshold INTEGER NOT NULL DEFAULT 10,
            max_words_per_player INTEGER NOT NULL DEFAULT 3,
            max_word_length INTEGER NOT NULL DEFAULT 20,
            data TEXT
        )',
        'CREATE TABLE IF NOT EXISTS players (
            id TEXT NOT NULL,
            game_id TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT,
            avatar TEXT,
            status TEXT DEFAULT "connected",
            score INTEGER DEFAULT 0,
            current_answers TEXT,
            round_history TEXT DEFAULT "{}",
            PRIMARY KEY (id, game_id),
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
        )',
        'CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )',
        'CREATE TABLE IF NOT EXISTS prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL UNIQUE
        )',
        'CREATE TABLE IF NOT EXISTS prompt_categories (
            prompt_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            PRIMARY KEY (prompt_id, category_id),
            FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        )',
        'CREATE TABLE IF NOT EXISTS valid_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt_id INTEGER NOT NULL,
            word_entry TEXT NOT NULL,
            FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
        )'
    ];
    
    $indexes = [
        'CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id)',
        'CREATE INDEX IF NOT EXISTS idx_prompt_categories_prompt ON prompt_categories(prompt_id)',
        'CREATE INDEX IF NOT EXISTS idx_prompt_categories_category ON prompt_categories(category_id)',
        'CREATE INDEX IF NOT EXISTS idx_valid_words_prompt_id ON valid_words(prompt_id)'
    ];
    
    foreach (array_merge($tables, $indexes) as $sql) {
        $pdo->exec($sql);
    }
}

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

function handleAddCategory() {
    try {
        $input = file_get_contents('php://input');
        if (empty($input)) {
            respondError('Empty input');
            return;
        }

        $data = json_decode($input, true);
        if (!$data || !isset($data['name'])) {
            respondError('Missing name field');
            return;
        }
        
        $admin = new AdminDictionary();
        $cat = $admin->addCategory($data['name']);
        respondSuccess('Categoría agregada', $cat);
    } catch (Exception $e) {
        logMessage('addCategory error: ' . $e->getMessage(), 'ERROR');
        respondError('Error: ' . $e->getMessage());
    }
}

function handleDeleteCategory() {
    try {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        if (!$data || !isset($data['id'])) {
            respondError('Missing id');
            return;
        }
        
        $admin = new AdminDictionary();
        $admin->deleteCategory($data['id']);
        respondSuccess('Categoría eliminada');
    } catch (Exception $e) {
        logMessage('deleteCategory error: ' . $e->getMessage(), 'ERROR');
        respondError('Error: ' . $e->getMessage());
    }
}

function handleAddPrompt() {
    try {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        if (!$data || !isset($data['text']) || !isset($data['category_id']) || !isset($data['words'])) {
            respondError('Missing required fields');
            return;
        }
        
        $admin = new AdminDictionary();
        $promptId = $admin->addPrompt([$data['category_id']], $data['text']);
        
        foreach ($data['words'] as $word) {
            if (!empty($word)) {
                $normalized = mb_strtoupper(trim($word), 'UTF-8');
                $admin->addValidWord($promptId, $normalized);
            }
        }
        
        respondSuccess('Consigna agregada', ['prompt_id' => $promptId]);
    } catch (Exception $e) {
        logMessage('addPrompt error: ' . $e->getMessage(), 'ERROR');
        respondError('Error: ' . $e->getMessage());
    }
}

function handleDeletePrompt() {
    try {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        if (!$data || !isset($data['id'])) {
            respondError('Missing id');
            return;
        }
        
        $admin = new AdminDictionary();
        $admin->deletePrompt($data['id']);
        respondSuccess('Consigna eliminada');
    } catch (Exception $e) {
        logMessage('deletePrompt error: ' . $e->getMessage(), 'ERROR');
        respondError('Error: ' . $e->getMessage());
    }
}

function getCategories() {
    try {
        $admin = new AdminDictionary();
        $cats = $admin->getCategories();
        respondSuccess('Categorías cargadas', $cats);
    } catch (Exception $e) {
        logMessage('getCategories error: ' . $e->getMessage(), 'ERROR');
        respondError('Error: ' . $e->getMessage());
    }
}

function getPrompts() {
    try {
        $admin = new AdminDictionary();
        $prompts = $admin->getPrompts();
        respondSuccess('Consignas cargadas', $prompts);
    } catch (Exception $e) {
        logMessage('getPrompts error: ' . $e->getMessage(), 'ERROR');
        respondError('Error: ' . $e->getMessage());
    }
}

function handleImport() {
    try {
        $input = file_get_contents('php://input');
        if (empty($input)) {
            respondError('Empty input');
            return;
        }

        $json = json_decode($input, true);
        if (!$json) {
            respondError('JSON inválido: ' . json_last_error_msg());
            return;
        }
        
        $admin = new AdminDictionary();
        $json = validateStructure($json);
        
        $stats = importData($admin, $json);
        
        respondSuccess('Base de datos importada', $stats);
    } catch (Exception $e) {
        logMessage('handleImport error: ' . $e->getMessage(), 'ERROR');
        respondError('Import error: ' . $e->getMessage());
    }
}

function exportDatabase() {
    try {
        $admin = new AdminDictionary();
        $data = [
            'categorias' => $admin->getCategories(),
            'prompts' => $admin->getPrompts()
        ];
        respondSuccess('Exportación completada', $data);
    } catch (Exception $e) {
        logMessage('exportDatabase error: ' . $e->getMessage(), 'ERROR');
        respondError('Export error: ' . $e->getMessage());
    }
}

function handleSave() {
    try {
        $input = file_get_contents('php://input');
        if (empty($input)) {
            respondError('Empty input');
            return;
        }

        $json = json_decode($input, true);
        if (!$json) {
            respondError('JSON inválido: ' . json_last_error_msg());
            return;
        }
        
        $admin = new AdminDictionary();
        $json = validateStructure($json);
        $json = cleanDatabase($admin, $json);
        
        saveToDatabase($admin, $json);
        
        $stats = $admin->getDictionaryStats();
        respondSuccess('Base de datos guardada', $stats);
    } catch (Exception $e) {
        logMessage('handleSave error: ' . $e->getMessage(), 'ERROR');
        respondError('Save error: ' . $e->getMessage());
    }
}

function handleOptimize() {
    try {
        $admin = new AdminDictionary();
        
        $beforeStats = $admin->getDictionaryStats();
        $report = [
            'before' => $beforeStats,
            'issues' => []
        ];
        
        $orphanCount = removeOrphanedPrompts($admin);
        if ($orphanCount > 0) {
            $report['issues'][] = 'Consignas huérfanas eliminadas: ' . $orphanCount;
        }
        
        $deadCount = removeDeadReferences($admin);
        if ($deadCount > 0) {
            $report['issues'][] = 'Referencias muertas limpiadas: ' . $deadCount;
        }
        
        $admin->vacuumDatabase();
        
        $afterStats = $admin->getDictionaryStats();
        $report['after'] = $afterStats;
        
        respondSuccess('Base de datos optimizada', $report);
    } catch (Exception $e) {
        logMessage('handleOptimize error: ' . $e->getMessage(), 'ERROR');
        respondError('Optimize error: ' . $e->getMessage());
    }
}

function handleRepair() {
    try {
        $dbFile = __DIR__ . '/../data/talcual.db';
        
        // Check integrity
        if (file_exists($dbFile) && isValidSQLiteDatabase($dbFile)) {
            $pdo = new PDO('sqlite:' . $dbFile);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            
            $result = $pdo->query('PRAGMA integrity_check')->fetch(PDO::FETCH_ASSOC);
            if ($result['integrity_check'] === 'ok') {
                respondSuccess('BD ya está saludable');
                return;
            }
        }
        
        // Recreate database
        if (file_exists($dbFile)) {
            @unlink($dbFile);
            @unlink($dbFile . '-wal');
            @unlink($dbFile . '-shm');
        }
        
        createNewDatabase($dbFile);
        respondSuccess('BD reparada y reinicializada');
    } catch (Exception $e) {
        logMessage('handleRepair error: ' . $e->getMessage(), 'ERROR');
        respondError('Repair error: ' . $e->getMessage());
    }
}

function handleNuke() {
    try {
        $dbFile = __DIR__ . '/../data/talcual.db';
        
        // Delete all database files
        @unlink($dbFile);
        @unlink($dbFile . '-wal');
        @unlink($dbFile . '-shm');
        
        // Create fresh database
        createNewDatabase($dbFile);
        respondSuccess('BD reinicializada completamente');
    } catch (Exception $e) {
        logMessage('handleNuke error: ' . $e->getMessage(), 'ERROR');
        respondError('Nuke error: ' . $e->getMessage());
    }
}

function handleDiagnose() {
    try {
        $dbFile = __DIR__ . '/../data/talcual.db';
        $diag = [
            'db_file_exists' => file_exists($dbFile),
            'db_file_readable' => is_readable($dbFile),
            'db_file_writable' => is_writable($dbFile),
            'is_valid_sqlite' => isValidSQLiteDatabase($dbFile),
            'tables_ok' => false,
            'integrity_ok' => false,
            'indexes_ok' => false,
            'errors' => []
        ];
        
        if ($diag['is_valid_sqlite']) {
            $pdo = new PDO('sqlite:' . $dbFile);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            
            // Check tables
            $tables = $pdo->query('SELECT name FROM sqlite_master WHERE type="table"')->fetchAll(PDO::FETCH_COLUMN);
            $diag['tables_ok'] = count($tables) === 6;
            $diag['table_count'] = count($tables);
            
            // Check integrity
            $result = $pdo->query('PRAGMA integrity_check')->fetch(PDO::FETCH_ASSOC);
            $diag['integrity_ok'] = $result['integrity_check'] === 'ok';
            
            // Check indexes
            $indexes = $pdo->query('SELECT name FROM sqlite_master WHERE type="index"')->fetchAll(PDO::FETCH_COLUMN);
            $diag['indexes_ok'] = count($indexes) >= 4;
            $diag['index_count'] = count($indexes);
        }
        
        respondSuccess('Diagnóstico completado', $diag);
    } catch (Exception $e) {
        logMessage('handleDiagnose error: ' . $e->getMessage(), 'ERROR');
        respondError('Diagnose error: ' . $e->getMessage());
    }
}

function getDatabase() {
    try {
        $admin = new AdminDictionary();
        $inspection = $admin->getDatabaseInspection();
        respondSuccess('Base de datos cargada', $inspection);
    } catch (Exception $e) {
        logMessage('getDatabase error: ' . $e->getMessage(), 'ERROR');
        respondError('Failed to load database: ' . $e->getMessage());
    }
}

function inspectDatabase() {
    try {
        $admin = new AdminDictionary();
        $stats = $admin->getDictionaryStats();
        
        $inspection = [
            'stats' => $stats,
            'status' => 'HEALTHY',
            'database_file' => '/data/talcual.db',
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        respondSuccess('Inspección de base de datos', $inspection);
    } catch (Exception $e) {
        logMessage('inspectDatabase error: ' . $e->getMessage(), 'ERROR');
        respondError('Database inspection error: ' . $e->getMessage());
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function validateStructure($data) {
    if (!isset($data['categorias'])) $data['categorias'] = [];
    if (!isset($data['consignas'])) $data['consignas'] = [];
    
    if (is_array($data['categorias']) && !empty($data['categorias']) && isset($data['categorias'][0])) {
        $data['categorias'] = [];
    }
    
    if (is_array($data['consignas']) && !empty($data['consignas']) && isset($data['consignas'][0])) {
        $data['consignas'] = [];
    }
    
    $data['categorias'] = is_array($data['categorias']) ? $data['categorias'] : [];
    $data['consignas'] = is_array($data['consignas']) ? $data['consignas'] : [];
    
    return $data;
}

function importData($admin, $data) {
    $imported = [
        'categories_added' => 0,
        'categories_existing' => 0,
        'prompts_added' => 0,
        'prompts_existing' => 0,
        'words_added' => 0,
        'words_existing' => 0
    ];
    
    $categoryMap = [];
    foreach ($data['categorias'] ?? [] as $catName => $catData) {
        try {
            $existing = $admin->getCategoryByName($catName);
            if ($existing) {
                $imported['categories_existing']++;
                $categoryMap[$catName] = $existing['id'];
            } else {
                $cat = $admin->addCategory($catName);
                $imported['categories_added']++;
                $categoryMap[$catName] = $cat['id'];
            }
        } catch (Exception $e) {
            logMessage('Import category error for "' . $catName . '": ' . $e->getMessage(), 'WARN');
        }
    }
    
    foreach ($data['consignas'] ?? [] as $promptId => $consigna) {
        try {
            $promptText = $consigna['pregunta'] ?? '';
            if (empty($promptText)) {
                logMessage('Skipping prompt with empty text', 'WARN');
                continue;
            }

            $categoriesForPrompt = [];
            
            foreach ($data['categorias'] ?? [] as $catName => $catData) {
                if (isset($catData['consignas']) && in_array($promptId, $catData['consignas'])) {
                    if (isset($categoryMap[$catName])) {
                        $categoriesForPrompt[] = $categoryMap[$catName];
                    }
                }
            }
            
            if (empty($categoriesForPrompt)) {
                logMessage('Prompt has no valid categories, skipping', 'WARN');
                continue;
            }
            
            $newPromptId = $admin->addPrompt($categoriesForPrompt, $promptText);
            $imported['prompts_added']++;
            
            foreach ($consigna['respuestas'] ?? [] as $word) {
                try {
                    $normalized = mb_strtoupper(trim($word), 'UTF-8');
                    if (!empty($normalized)) {
                        $admin->addValidWord($newPromptId, $normalized);
                        $imported['words_added']++;
                    }
                } catch (Exception $e) {
                    logMessage('Import word error: ' . $e->getMessage(), 'WARN');
                }
            }
        } catch (Exception $e) {
            logMessage('Import prompt error: ' . $e->getMessage(), 'WARN');
        }
    }
    
    return $imported;
}

function saveToDatabase($admin, $data) {
    try {
        $admin->pdo->beginTransaction();
        
        foreach ($data['categorias'] ?? [] as $catName => $catData) {
            try {
                $existing = $admin->getCategoryByName($catName);
                if (!$existing) {
                    $admin->addCategory($catName);
                }
            } catch (Exception $e) {
                logMessage('Save category error: ' . $e->getMessage(), 'WARN');
            }
        }
        
        $admin->pdo->commit();
    } catch (Exception $e) {
        $admin->pdo->rollback();
        throw new Exception('Error saving database: ' . $e->getMessage());
    }
}

function cleanDatabase($admin, $data) {
    $data = validateStructure($data);
    
    foreach ($data['categorias'] as $catName => &$catData) {
        if (!is_array($catData['consignas'] ?? null)) {
            $catData['consignas'] = [];
        }
        $catData['consignas'] = array_filter($catData['consignas'], fn($id) => isset($data['consignas'][$id]));
        $catData['consignas'] = array_values($catData['consignas']);
    }
    
    foreach ($data['consignas'] as &$clue) {
        if (!is_array($clue['respuestas'] ?? null)) {
            $clue['respuestas'] = [];
        }
        $clue['respuestas'] = array_filter($clue['respuestas'], fn($r) => !empty($r));
        $clue['respuestas'] = array_values($clue['respuestas']);
    }
    
    return $data;
}

function removeOrphanedPrompts($admin) {
    try {
        $pdo = Database::getInstance()->getConnection();
        $stmt = $pdo->query(
            'SELECT p.id FROM prompts p '
            . 'WHERE NOT EXISTS (SELECT 1 FROM prompt_categories WHERE prompt_id = p.id)'
        );
        
        if (!$stmt) {
            logMessage('Failed to query orphaned prompts', 'WARN');
            return 0;
        }

        $orphans = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $count = 0;
        
        foreach ($orphans as $promptId) {
            try {
                $admin->deletePrompt($promptId);
                $count++;
            } catch (Exception $e) {
                logMessage('Delete orphaned prompt error: ' . $e->getMessage(), 'WARN');
            }
        }
        
        return $count;
    } catch (Exception $e) {
        logMessage('Cleanup orphaned prompts error: ' . $e->getMessage(), 'WARN');
        return 0;
    }
}

function removeDeadReferences($admin) {
    try {
        $pdo = Database::getInstance()->getConnection();
        $stmt = $pdo->query(
            'SELECT vw.id FROM valid_words vw '
            . 'WHERE NOT EXISTS (SELECT 1 FROM prompts WHERE id = vw.prompt_id)'
        );
        
        if (!$stmt) {
            logMessage('Failed to query dead references', 'WARN');
            return 0;
        }

        $deadWords = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $count = 0;
        
        foreach ($deadWords as $wordId) {
            try {
                $admin->deleteValidWord($wordId);
                $count++;
            } catch (Exception $e) {
                logMessage('Delete dead reference error: ' . $e->getMessage(), 'WARN');
            }
        }
        
        return $count;
    } catch (Exception $e) {
        logMessage('Cleanup dead references error: ' . $e->getMessage(), 'WARN');
        return 0;
    }
}

function logMessage($msg, $level = 'INFO') {
    $logFile = __DIR__ . '/../logs/dmanager.log';
    $logDir = dirname($logFile);
    
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    
    $timestamp = date('Y-m-d H:i:s');
    $logLine = "[$timestamp] [$level] $msg\n";
    @file_put_contents($logFile, $logLine, FILE_APPEND);
}

function respondSuccess($msg, $data = null) {
    echo json_encode(['success' => true, 'message' => $msg, 'data' => $data], JSON_UNESCAPED_UNICODE);
}

function respondError($msg) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
}
?>
