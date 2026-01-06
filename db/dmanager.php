<?php
header('Content-Type: application/json');

set_error_handler(function($severity, $message, $file, $line) {
    logMessage("PHP Error [$severity]: $message in $file:$line", 'ERROR');
    respondError("Server error: $message");
    exit;
});

try {
    require_once __DIR__ . '/../app/Database.php';
    require_once __DIR__ . '/../app/Traits/WordNormalizer.php';
    require_once __DIR__ . '/../app/AdminDictionary.php';
    require_once __DIR__ . '/../app/AppUtils.php';

    $action = $_GET['action'] ?? null;

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if ($action === 'import') handleImport();
        elseif ($action === 'save') handleSave();
        elseif ($action === 'optimize') handleOptimize();
        else respondError('Unknown POST action: ' . $action);
    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($action === 'get-db') getDatabase();
        elseif ($action === 'inspect') inspectDatabase();
        else respondError('Unknown GET action: ' . $action);
    } else {
        respondError('Invalid request method');
    }

} catch (Exception $e) {
    logMessage('dmanager.php fatal error: ' . $e->getMessage(), 'FATAL');
    http_response_code(500);
    respondError('Server Error: ' . $e->getMessage());
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
        
        respondSuccess('Base de datos importada inteligentemente', $stats);
    } catch (Exception $e) {
        logMessage('handleImport error: ' . $e->getMessage(), 'ERROR');
        respondError('Import error: ' . $e->getMessage());
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
        $games = $admin->getGames();
        
        $inspection = [
            'stats' => $stats,
            'games' => $games,
            'database_file' => '/data/talcual.db',
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        respondSuccess('Inspección de base de datos', $inspection);
    } catch (Exception $e) {
        logMessage('inspectDatabase error: ' . $e->getMessage(), 'ERROR');
        respondError('Database inspection error: ' . $e->getMessage());
    }
}

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
                logMessage('Skipping prompt with empty text (ID: ' . $promptId . ')', 'WARN');
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
                logMessage('Prompt "' . $promptText . '" has no valid categories, skipping', 'WARN');
                continue;
            }
            
            $newPromptId = $admin->addPrompt($categoriesForPrompt, $promptText);
            $imported['prompts_added']++;
            
            foreach ($consigna['respuestas'] ?? [] as $word) {
                try {
                    $normalized = normalizeWordForImport($word);
                    if (!empty($normalized)) {
                        $admin->addValidWord($newPromptId, $normalized);
                        $imported['words_added']++;
                    }
                } catch (Exception $e) {
                    logMessage('Import word error for "' . $word . '": ' . $e->getMessage(), 'WARN');
                }
            }
        } catch (Exception $e) {
            logMessage('Import prompt error for ID "' . $promptId . '": ' . $e->getMessage(), 'WARN');
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
                logMessage('Save category error for "' . $catName . '": ' . $e->getMessage(), 'WARN');
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
                logMessage('Delete orphaned prompt error for ID ' . $promptId . ': ' . $e->getMessage(), 'WARN');
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
                logMessage('Delete dead reference error for ID ' . $wordId . ': ' . $e->getMessage(), 'WARN');
            }
        }
        
        return $count;
    } catch (Exception $e) {
        logMessage('Cleanup dead references error: ' . $e->getMessage(), 'WARN');
        return 0;
    }
}

function normalizeWordForImport($text) {
    $text = mb_strtoupper($text, 'UTF-8');
    
    $replacements = [
        'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U',
        'À' => 'A', 'È' => 'E', 'Ì' => 'I', 'Ò' => 'O', 'Ù' => 'U',
        'Ä' => 'A', 'Ë' => 'E', 'Ï' => 'I', 'Ö' => 'O', 'Ü' => 'U',
        'Ã' => 'A', 'Õ' => 'O', 'Ñ' => 'N', 'Ç' => 'C'
    ];
    
    $text = strtr($text, $replacements);
    $text = preg_replace('/[^A-Z0-9|.]/u', '', $text);
    
    return $text;
}

function respondSuccess($msg, $data = null) {
    echo json_encode(['success' => true, 'message' => $msg, 'data' => $data], JSON_UNESCAPED_UNICODE);
}

function respondError($msg) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
}
?>
