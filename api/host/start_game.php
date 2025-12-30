<?php
/**
 * API: Start Game
 * POST /api/host/start_game.php
 * 
 * Inicia una partida (cambia estado a 'playing')
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['code'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Falta parámetro: code']);
    exit;
}

$code = strtoupper(trim($input['code']));
$gameFile = "../game_states/{$code}.json";

if (!file_exists($gameFile)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Partida no encontrada']);
    exit;
}

// Leer, modificar, guardar con lock
if (flock($fp = fopen($gameFile, 'c+'), LOCK_EX)) {
    fseek($fp, 0);
    $gameState = json_decode(fread($fp, filesize($gameFile) ?: 1), true) ?: [];
    
    // Verificar mínimo de jugadores
    $playerCount = count($gameState['players'] ?? []);
    if ($playerCount < ($gameState['minPlayers'] ?? 2)) {
        flock($fp, LOCK_UN);
        fclose($fp);
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Mínimo {$gameState['minPlayers']} jugadores requeridos, hay {$playerCount}"]);
        exit;
    }
    
    // Iniciar juego
    $gameState['status'] = 'playing';
    $gameState['startedAt'] = date('c');
    $gameState['currentRound'] = 1;
    $gameState['roundStartTime'] = time();
    
    // Guardar
    ftruncate($fp, 0);
    fseek($fp, 0);
    fwrite($fp, json_encode($gameState, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    
    echo json_encode(['success' => true, 'message' => 'Juego iniciado']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al adquirir lock']);
}

?>
