<?php
header('Content-Type: application/json');

$action = $_GET['action'] ?? null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($action === 'import') handleImport();
    elseif ($action === 'save') handleSave();
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'get-db') getDatabase();
}

function handleImport() {
    $json = json_decode(file_get_contents('php://input'), true);
    
    if (!$json) {
        respondError('JSON inválido');
        return;
    }
    
    $currentDb = loadDatabase();
    $merged = mergeDatabase($currentDb, $json);
    respondSuccess('Base de datos importada inteligentemente', $merged);
}

function handleSave() {
    $json = json_decode(file_get_contents('php://input'), true);
    
    if (!$json) {
        respondError('JSON inválido');
        return;
    }
    
    $normalized = normalizeDatabase($json);
    saveToDatabase($normalized);
    respondSuccess('Base de datos guardada', $normalized);
}

function getDatabase() {
    $db = loadDatabase();
    if (!$db) {
        respondError('Base de datos no encontrada');
        return;
    }
    respondSuccess('Base de datos cargada', $db);
}

function mergeDatabase($current, $imported) {
    if (empty($current)) {
        return normalizeDatabase($imported);
    }
    
    $categories = $current['categorias'] ?? [];
    $consignas = ensureConsignasIsObject($current['consignas'] ?? []);
    
    $importedCategories = $imported['categorias'] ?? [];
    $importedConsignas = ensureConsignasIsObject($imported['consignas'] ?? []);
    
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
    $importedConsignas = ensureConsignasIsObject($data['consignas'] ?? []);
    
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

function ensureConsignasIsObject($consignas) {
    if (is_array($consignas) && (empty($consignas) || isset($consignas[0]))) {
        return [];
    }
    return is_array($consignas) ? $consignas : [];
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
