<?php
/**
 * API: Player Submit Answer
 * POST /api/player/submit_answer.php
 * 
 * Jugador envía su respuesta
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['code']) || !isset($input['playerId']) || !isset($input['answer'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Faltan parámetros']);
    exit;
}

$code = strtoupper(trim($input['code']));
$playerId = trim($input['playerId']);
$answer = trim($input['answer']);
$gameFile = "../game_states/{$code}.json";

if (!file_exists($gameFile)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Partida no encontrada']);
    exit;
}

if (flock($fp = fopen($gameFile, 'c+'), LOCK_EX)) {
    fseek($fp, 0);
    $gameState = json_decode(fread($fp, filesize($gameFile) ?: 1), true) ?: [];
    
    // Encontrar jugador
    $playerFound = false;
    foreach ($gameState['players'] as &$player) {
        if ($player['id'] === $playerId) {
            $player['answer'] = $answer;
            $player['answeredAt'] = date('c');
            $playerFound = true;
            break;
        }
    }
    
    if (!$playerFound) {
        flock($fp, LOCK_UN);
        fclose($fp);
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Jugador no encontrado']);
        exit;
    }
    
    // Guardar
    ftruncate($fp, 0);
    fseek($fp, 0);
    fwrite($fp, json_encode($gameState, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    
    echo json_encode(['success' => true, 'message' => 'Respuesta guardada']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al adquirir lock']);
}

?>
