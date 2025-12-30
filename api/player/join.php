<?php
/**
 * API: Player Join
 * POST /api/player/join.php
 * 
 * Jugador se conecta a una partida
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['code']) || !isset($input['playerName']) || !isset($input['playerColor'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Faltan parámetros: code, playerName, playerColor']);
    exit;
}

$code = strtoupper(trim($input['code']));
$playerName = trim($input['playerName']);
$playerColor = trim($input['playerColor']);
if (!isset($input['playerId'])) {
    $playerId = uniqid('player_', true);
} else {
    $playerId = $input['playerId'];
}

$gameFile = "../game_states/{$code}.json";

if (!file_exists($gameFile)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Partida no encontrada']);
    exit;
}

// Lock para lectura/escritura
if (flock($fp = fopen($gameFile, 'c+'), LOCK_EX)) {
    fseek($fp, 0);
    $gameState = json_decode(fread($fp, filesize($gameFile) ?: 1), true) ?: [];
    
    // Verificar que partida no haya iniciado
    if ($gameState['status'] !== 'waiting') {
        flock($fp, LOCK_UN);
        fclose($fp);
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Partida ya inició o terminó']);
        exit;
    }
    
    // Agregar jugador
    $player = [
        'id' => $playerId,
        'name' => $playerName,
        'color' => $playerColor,
        'score' => 0,
        'ready' => false,
        'joinedAt' => date('c')
    ];
    
    $gameState['players'][] = $player;
    
    // Guardar
    ftruncate($fp, 0);
    fseek($fp, 0);
    fwrite($fp, json_encode($gameState, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    
    echo json_encode([
        'success' => true,
        'playerId' => $playerId,
        'message' => 'Jugador conectado exitosamente'
    ]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al adquirir lock']);
}

?>
