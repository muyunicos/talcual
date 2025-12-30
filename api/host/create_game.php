<?php
/**
 * API: Create Game
 * POST /api/host/create_game.php
 * 
 * Crea una nueva partida con código y categoría
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Leer JSON del body
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['code']) || !isset($input['category'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Faltan parámetros: code, category']);
    exit;
}

$code = strtoupper(trim($input['code']));
$category = trim($input['category']);

// Validar código
if (strlen($code) < 3 || strlen($code) > 5 || !preg_match('/^[A-Z0-9]+$/', $code)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Código inválido (3-5 caracteres alfanuméricos)']);
    exit;
}

// Crear directorio de estados de juego si no existe
if (!is_dir('../game_states')) {
    mkdir('../game_states', 0755, true);
}

$gameFile = "../game_states/{$code}.json";

// Verificar que no exista
if (file_exists($gameFile)) {
    http_response_code(409);
    echo json_encode(['success' => false, 'error' => 'Código de partida ya existe']);
    exit;
}

// Estado inicial del juego
$gameState = [
    'code' => $code,
    'category' => $category,
    'status' => 'waiting', // waiting, playing, finished
    'createdAt' => date('c'),
    'startedAt' => null,
    'endedAt' => null,
    'currentRound' => 0,
    'totalRounds' => 3,
    'roundDuration' => 60,
    'minPlayers' => 2,
    'players' => [],
    'roundStartTime' => null,
    'topWords' => [],
    'finalResults' => []
];

// Guardar archivo con lock
if (file_put_contents($gameFile, json_encode($gameState, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) !== false) {
    echo json_encode([
        'success' => true,
        'code' => $code,
        'message' => 'Partida creada exitosamente'
    ]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al crear el archivo de juego']);
}
?>
