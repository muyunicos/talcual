<?php
// Server-Sent Events para actualizaciones en tiempo real
// MEJORAS: Manejo robusto de conexiones, heartbeat optimizado, detección de desconexiones

require_once 'config.php';

// Headers SSE
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no'); // Deshabilitar buffering en Nginx

// Deshabilitar output buffering de PHP
if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', '1');
}
@ini_set('output_buffering', 'off');
@ini_set('zlib.output_compression', 0);
@ini_set('implicit_flush', 1);
ob_implicit_flush(1);
while (ob_get_level()) ob_end_flush();

// Validar game_id
$gameId = sanitizeGameId($_GET['game_id'] ?? null);

if (!$gameId) {
    echo "event: error\n";
    echo "data: {\"message\": \"game_id inválido\"}\n\n";
    flush();
    exit;
}

logMessage("SSE iniciado para game: {$gameId}", 'DEBUG');

// Enviar función helper
function sendSSE($event, $data) {
    echo "event: {$event}\n";
    echo "data: " . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
    flush();
}

// Verificar que el juego existe
if (!gameExists($gameId)) {
    sendSSE('error', ['message' => 'Juego no encontrado']);
    exit;
}

// Variables de control
$lastModified = 0;
$startTime = time();
$lastHeartbeat = time();
$connectionBroken = false;

// Loop principal
while (true) {
    // Verificar timeout
    if (time() - $startTime > SSE_TIMEOUT) {
        logMessage("SSE timeout alcanzado para {$gameId}", 'INFO');
        sendSSE('timeout', ['message' => 'Timeout alcanzado']);
        break;
    }
    
    // MEJORA: Detectar si el cliente cerró la conexión
    if (connection_aborted()) {
        $connectionBroken = true;
        logMessage("SSE conexión cerrada por cliente: {$gameId}", 'DEBUG');
        break;
    }
    
    // Verificar que el juego aún existe
    $stateFile = GAME_STATES_DIR . '/' . $gameId . '.json';
    
    if (!file_exists($stateFile)) {
        sendSSE('game_ended', ['message' => 'El juego ha finalizado']);
        logMessage("SSE juego finalizado: {$gameId}", 'INFO');
        break;
    }
    
    // Verificar si hay actualizaciones
    $currentModified = filemtime($stateFile);
    
    if ($currentModified > $lastModified) {
        $state = loadGameState($gameId);
        
        if ($state) {
            sendSSE('update', $state);
            $lastModified = $currentModified;
            $lastHeartbeat = time(); // Resetear heartbeat al enviar actualización
            logMessage("SSE update enviado para {$gameId}", 'DEBUG');
        }
    }
    
    // MEJORA: Heartbeat optimizado - solo si no se envió actualización reciente
    if (time() - $lastHeartbeat >= SSE_HEARTBEAT_INTERVAL) {
        echo ": heartbeat\n\n";
        flush();
        $lastHeartbeat = time();
    }
    
    // MEJORA: Sleep dinámico - más frecuente durante juego activo
    $state = loadGameState($gameId);
    if ($state && $state['status'] === 'playing') {
        usleep(500000); // 0.5 segundos durante juego activo
    } else {
        sleep(1); // 1 segundo en otros estados
    }
}

if ($connectionBroken) {
    logMessage("SSE terminado (conexión rota): {$gameId}", 'DEBUG');
} else {
    logMessage("SSE terminado normalmente: {$gameId}", 'DEBUG');
}
?>
