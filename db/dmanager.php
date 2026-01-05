<?php
header('Content-Type: application/json');

$action = $_GET['action'] ?? null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($action === 'import') handleImport();
    elseif ($action === 'save') handleSave();
    elseif ($action === 'optimize') handleOptimize();
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'get-db') getDatabase();
}

function handleImport() {
    $json = json_decode(file_get_contents('php://input'), true);
    
    if (!$json) {
        respondError('JSON inválido');
        return;
    }
    
    $json = validateStructure($json);
    $currentDb = loadDatabase();
    $merged = mergeDatabase($currentDb, $json);
    $merged = cleanDatabase($merged);
    respondSuccess('Base de datos importada inteligentemente', $merged);
}

function handleSave() {
    $json = json_decode(file_get_contents('php://input'), true);
    
    if (!$json) {
        respondError('JSON inválido');
        return;
    }
    
    $json = validateStructure($json);
    $normalized = normalizeDatabase($json);
    $normalized = cleanDatabase($normalized);
    saveToDatabase($normalized);
    respondSuccess('Base de datos guardada', $normalized);
}

function handleOptimize() {
    $db = loadDatabase();
    if (!$db) {
        respondError('Base de datos no encontrada');
        return;
    }
    
    $db = validateStructure($db);
    $report = [
        'before' => countDB($db),
        'issues' => []
    ];
    
    $orphanedClues = findOrphanedClues($db);
    if (!empty($orphanedClues)) {
        $report['issues'][] = 'Consignas huérfanas encontradas: ' . implode(', ', $orphanedClues);
        foreach ($orphanedClues as $clueId) {
            unset($db['consignas'][$clueId]);
        }
    }
    
    $deadRefs = findDeadReferences($db);
    if (!empty($deadRefs)) {
        $report['issues'][] = 'Referencias muertas limpiadas: ' . count($deadRefs);
        foreach ($deadRefs as $catName => $clueIds) {
            foreach ($clueIds as $clueId) {
                $db['categorias'][$catName]['consignas'] = array_values(
                    array_filter($db['categorias'][$catName]['consignas'], fn($id) => $id !== $clueId)
                );
            }
        }
    }
    
    $db = cleanDatabase($db);
    saveToDatabase($db);
    
    $report['after'] = countDB($db);
    respondSuccess('Base de datos optimizada', ['report' => $report, 'data' => $db]);
}

function getDatabase() {
    $db = loadDatabase();
    if (!$db) {
        respondError('Base de datos no encontrada');
        return;
    }
    $db = validateStructure($db);
    respondSuccess('Base de datos cargada', $db);
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

function cleanDatabase($db) {
    $db = validateStructure($db);
    
    foreach ($db['categorias'] as $catName => &$catData) {
        if (!is_array($catData['consignas'] ?? null)) {
            $catData['consignas'] = [];
        }
        $catData['consignas'] = array_filter($catData['consignas'], fn($id) => isset($db['consignas'][$id]));
        $catData['consignas'] = array_values($catData['consignas']);
    }
    
    foreach ($db['consignas'] as &$clue) {
        if (!is_array($clue['respuestas'] ?? null)) {
            $clue['respuestas'] = [];
        }
        $clue['respuestas'] = array_filter($clue['respuestas'], fn($r) => !empty($r));
        $clue['respuestas'] = array_values($clue['respuestas']);
    }
    
    return $db;
}

function findOrphanedClues($db) {
    $usedClues = [];
    foreach ($db['categorias'] as $catData) {
        $usedClues = array_merge($usedClues, $catData['consignas'] ?? []);
    }
    
    return array_diff(array_keys($db['consignas']), $usedClues);
}

function findDeadReferences($db) {
    $deadRefs = [];
    foreach ($db['categorias'] as $catName => $catData) {
        foreach ($catData['consignas'] ?? [] as $clueId) {
            if (!isset($db['consignas'][$clueId])) {
                if (!isset($deadRefs[$catName])) $deadRefs[$catName] = [];
                $deadRefs[$catName][] = $clueId;
            }
        }
    }
    return $deadRefs;
}

function countDB($db) {
    return [
        'categorias' => count($db['categorias'] ?? []),
        'consignas' => count($db['consignas'] ?? []),
        'respuestas' => array_sum(array_map(fn($c) => count($c['respuestas'] ?? []), $db['consignas'] ?? []))
    ];
}

function mergeDatabase($current, $imported) {
    if (empty($current)) {
        return normalizeDatabase($imported);
    }
    
    $categories = $current['categorias'] ?? [];
    $consignas = $current['consignas'] ?? [];
    
    $importedCategories = $imported['categorias'] ?? [];
    $importedConsignas = $imported['consignas'] ?? [];
    
    $nextOrder = empty($categories) ? 1 : max(array_column($categories, 'orden', null) ?? [0]) + 1;
    
    foreach ($importedCategories as $catName => $catData) {
        if (!isset($categories[$catName])) {
            $categories[$catName] = [
                'orden' => $nextOrder++,
                'consignas' => []
            ];
        }
        
        if (isset($catData['consignas']) && is_array($catData['consignas'])) {
            foreach ($catData['consignas'] as $clueId) {
                if (!in_array($clueId, $categories[$catName]['consignas'])) {
                    $categories[$catName]['consignas'][] = $clueId;
                }
            }
        }
    }
    
    foreach ($importedConsignas as $clueId => $clueData) {
        if (!isset($consignas[$clueId])) {
            $consignas[$clueId] = [
                'pregunta' => $clueData['pregunta'] ?? '',
                'respuestas' => array_map(fn($r) => normalizeResponse($r), $clueData['respuestas'] ?? []),
                'created_at' => $clueData['created_at'] ?? date('c')
            ];
        }
    }
    
    return [
        'categorias' => $categories,
        'consignas' => $consignas
    ];
}

function normalizeDatabase($data) {
    $normalized = [
        'categorias' => [],
        'consignas' => []
    ];
    
    $importedCategories = $data['categorias'] ?? [];
    $importedConsignas = $data['consignas'] ?? [];
    
    $order = 1;
    foreach ($importedCategories as $catName => $catData) {
        $normalized['categorias'][$catName] = [
            'orden' => $order++,
            'consignas' => $catData['consignas'] ?? []
        ];
    }
    
    foreach ($importedConsignas as $clueId => $clueData) {
        $normalized['consignas'][$clueId] = [
            'pregunta' => $clueData['pregunta'] ?? '',
            'respuestas' => array_map(fn($r) => normalizeResponse($r), $clueData['respuestas'] ?? []),
            'created_at' => $clueData['created_at'] ?? date('c')
        ];
    }
    
    return $normalized;
}

function normalizeResponse($text) {
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

function loadDatabase() {
    $dbPath = getDatabasePath();
    
    if (!file_exists($dbPath)) {
        return null;
    }
    
    return json_decode(file_get_contents($dbPath), true);
}

function saveToDatabase($data) {
    $dbPath = getDatabasePath();
    
    if (!is_dir(dirname($dbPath))) {
        mkdir(dirname($dbPath), 0755, true);
    }
    
    $handle = fopen($dbPath, 'c');
    if (flock($handle, LOCK_EX)) {
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        flock($handle, LOCK_UN);
    }
    fclose($handle);
}

function getDatabasePath() {
    return __DIR__ . '/../data/talcual.db';
}

function respondSuccess($msg, $data = null) {
    echo json_encode(['success' => true, 'message' => $msg, 'data' => $data], JSON_UNESCAPED_UNICODE);
}

function respondError($msg) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
}
?>
