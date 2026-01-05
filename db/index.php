<?php
header('Content-Type: application/json');

$action = $_GET['action'] ?? null;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'import') {
    handleImport();
} elseif ($action === 'get-db') {
    getDatabase();
}

function handleImport() {
    $json = json_decode(file_get_contents('php://input'), true);
    
    if (!$json) {
        respondError('JSON inválido');
        return;
    }
    
    $normalized = normalizeDatabase($json);
    saveToDatabase($normalized);
    respondSuccess('Base de datos importada y normalizada', $normalized);
}

function getDatabase() {
    $dbPath = getDatabasePath();
    
    if (!file_exists($dbPath)) {
        respondError('Base de datos no encontrada');
        return;
    }
    
    $data = json_decode(file_get_contents($dbPath), true);
    respondSuccess('Base de datos cargada', $data);
}

function normalizeDatabase($data) {
    $normalized = [];
    
    foreach ($data as $category => $questions) {
        $normalized[$category] = [];
        
        if (is_array($questions)) {
            foreach ($questions as $item) {
                if (isset($item['pregunta']) && isset($item['respuestas'])) {
                    $normalizedRespuestas = array_map(fn($r) => normalizeResponse($r), $item['respuestas']);
                    
                    $normalized[$category][] = [
                        'pregunta' => $item['pregunta'],
                        'respuestas' => $normalizedRespuestas
                    ];
                }
            }
        }
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
    return __DIR__ . '/../game_states/game_db.json';
}

function respondSuccess($msg, $data = null) {
    echo json_encode(['success' => true, 'message' => $msg, 'data' => $data], JSON_UNESCAPED_UNICODE);
}

function respondError($msg) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
}
?>
