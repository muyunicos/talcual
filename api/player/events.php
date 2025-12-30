<?php
/**
 * API: Player Events (SSE)
 * GET /api/player/events.php?code=XXXX&playerId=YYYY
 * 
 * Server-Sent Events para el jugador
 */

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Access-Control-Allow-Origin: *');
header('Connection: keep-alive');

if (!isset($_GET['code']) || !isset($_GET['playerId'])) {
    http_response_code(400);
    echo "data: {\"error\": \"Faltan parámetros\"}\n\n";
    exit;
}

$code = strtoupper(trim($_GET['code']));
$playerId = trim($_GET['playerId']);
$gameFile = "../game_states/{$code}.json";

if (!file_exists($gameFile)) {
    http_response_code(404);
    echo "data: {\"error\": \"Partida no encontrada\"}\n\n";
    exit;
}

ignore_user_abort(true);
set_time_limit(0);

// Enviar estado inicial
$gameState = json_decode(file_get_contents($gameFile), true);
echo "event: game_state\n";
echo "data: " . json_encode($gameState) . "\n\n";
flush();

$lastMtime = filemtime($gameFile);
$counter = 0;

while (true) {
    if (connection_aborted()) {
        break;
    }
    
    if (file_exists($gameFile)) {
        $mtime = filemtime($gameFile);
        
        if ($mtime > $lastMtime) {
            $gameState = json_decode(file_get_contents($gameFile), true);
            
            echo "event: game_state\n";
            echo "data: " . json_encode($gameState) . "\n\n";
            flush();
            
            $lastMtime = $mtime;
        }
    }
    
    if ($counter % 15 === 0) {
        echo ": heartbeat\n\n";
        flush();
    }
    
    $counter++;
    sleep(2);
}

?>
