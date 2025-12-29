<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
error_log("PRUEBA DE LOG: Esto es un mensaje de prueba personalizado.");
// Server-Sent Events para actualizaciones en tiempo real

require_once __DIR__ . '/config.php';

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', '1');
}
@ini_set('output_buffering', 'off');
@ini_set('zlib.output_compression', 0);
@ini_set('implicit_flush', 1);
ob_implicit_flush(1);
while (ob_get_level()) ob_end_flush();

$gameId = sanitizeGameId($_GET['game_id'] ?? null);

if (!$gameId) {
    echo "event: error\n";
    echo "data: {\"message\": \"game_id inválido\"}\n\n";
    flush();
    exit;
}

logMessage("SSE iniciado para game: {$gameId}", 'DEBUG');

function sendSSE($event, $data) {
    echo "event: {$event}\n";
    echo "data: " . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
    flush();
}

if (!gameExists($gameId)) {
    sendSSE('error', ['message' => 'Juego no encontrado']);
    exit;
}

$lastModified = 0;
$startTime = time();
$lastHeartbeat = microtime(true);
$connectionBroken = false;

// 🔧 FIX #27: Enviar heartbeat inicial inmediatamente después de conectar
// Esto evita race condition donde SSE conecta antes de que archivo JSON exista
echo ": heartbeat\n\n";
flush();
logMessage("SSE heartbeat inicial enviado para {$gameId}", 'DEBUG');

while (true) {
    if (time() - $startTime > SSE_TIMEOUT) {
        logMessage("SSE timeout alcanzado para {$gameId}", 'INFO');
        sendSSE('timeout', ['message' => 'Timeout alcanzado']);
        break;
    }
    
    if (connection_aborted()) {
        $connectionBroken = true;
        logMessage("SSE conexión cerrada por cliente: {$gameId}", 'DEBUG');
        break;
    }
    
    $stateFile = GAME_STATES_DIR . '/' . $gameId . '.json';
    
    if (!file_exists($stateFile)) {
        sendSSE('game_ended', ['message' => 'El juego ha finalizado']);
        logMessage("SSE juego finalizado: {$gameId}", 'INFO');
        break;
    }
    
    $currentModified = filemtime($stateFile);
    
    $state = null;
    $sleep = 500000;
    
    if ($currentModified > $lastModified) {
        $state = loadGameState($gameId);
        
        if ($state) {
            sendSSE('update', $state);
            $lastModified = $currentModified;
            logMessage("SSE update enviado para {$gameId}", 'DEBUG');
        }
    } else {
        $state = loadGameState($gameId);
    }
    
    $now = microtime(true);
    if ($now - $lastHeartbeat >= SSE_HEARTBEAT_INTERVAL) {
        echo ": heartbeat\n\n";
        flush();
        $lastHeartbeat = $now;
        logMessage("SSE heartbeat enviado para {$gameId}", 'DEBUG');
    }

    if ($state) {
        $playerCount = count($state['players'] ?? []);
        
        if ($playerCount > 0 && $state['status'] === 'waiting') {
            $sleep = 30000;
        } elseif ($state['status'] === 'playing') {
            $sleep = 100000;
        } else {
            $sleep = 500000;
        }
    }
    
    usleep($sleep);
}

if ($connectionBroken) {
    logMessage("SSE terminado (conexión rota): {$gameId}", 'DEBUG');
} else {
    logMessage("SSE terminado normalmente: {$gameId}", 'DEBUG');
}
?>
