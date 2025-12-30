<?php
/**
 * API: Game Events (SSE)
 * GET /api/host/events.php?code=XXXX
 * 
 * Server-Sent Events para el host
 * Mantiene conexión abierta y envía actualizaciones en tiempo real
 */

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Access-Control-Allow-Origin: *');
header('Connection: keep-alive');

if (!isset($_GET['code'])) {
    http_response_code(400);
    echo "data: {\"error\": \"Falta el parámetro code\"}\n\n";
    exit;
}

$code = strtoupper(trim($_GET['code']));
if (strlen($code) < 3 || strlen($code) > 5) {
    http_response_code(400);
    echo "data: {\"error\": \"Código inválido\"}\n\n";
    exit;
}

$gameFile = "../game_states/{$code}.json";

if (!file_exists($gameFile)) {
    http_response_code(404);
    echo "data: {\"error\": \"Partida no encontrada\"}\n\n";
    exit;
}

// Ignorar si cliente cierra conexión
ignore_user_abort(true);
set_time_limit(0);

// Enviar estado inicial
$gameState = json_decode(file_get_contents($gameFile), true);
echo "event: game_state\n";
echo "data: " . json_encode($gameState) . "\n\n";
flush();

// Polling cada 2 segundos
$lastMtime = filemtime($gameFile);
$counter = 0;

while (true) {
    if (connection_aborted()) {
        break;
    }
    
    // Comprobar cambios en el archivo
    if (file_exists($gameFile)) {
        $mtime = filemtime($gameFile);
        
        if ($mtime > $lastMtime) {
            $gameState = json_decode(file_get_contents($gameFile), true);
            
            // Enviar actualización de estado
            echo "event: game_state\n";
            echo "data: " . json_encode($gameState) . "\n\n";
            flush();
            
            $lastMtime = $mtime;
        }
    }
    
    // Heartbeat cada 30 segundos
    if ($counter % 15 === 0) {
        echo ": heartbeat\n\n";
        flush();
    }
    
    $counter++;
    sleep(2); // Esperar 2 segundos antes de siguiente check
}

?>
