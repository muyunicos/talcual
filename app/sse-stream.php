<?php
// Server-Sent Events para actualizaciones en tiempo real

require_once __DIR__ . '/config.php';

// Headers SSE
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

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
    
    // Detectar si el cliente cerró la conexión
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
    
    // Heartbeat
    if (time() - $lastHeartbeat >= SSE_HEARTBEAT_INTERVAL) {
        echo ": heartbeat\n\n";
        flush();
        $lastHeartbeat = time();
    }

    // ✅ MEJORA #26: Polling inteligente basado en estado del juego
    // Reduce latencia de detección de nuevos jugadores de 200ms a 50ms
    $state = loadGameState($gameId);
    if ($state) {
        $playerCount = count($state['players'] ?? []);
        
        // CRÍTICO: Mientras esperamos jugadores, máxima atención (50ms)
        if ($playerCount > 0 && $state['status'] === 'waiting') {
            usleep(50000);  // 50ms - máxima sensibilidad
            logMessage("SSE sleep 50ms (waiting with {$playerCount} players)", 'DEBUG');
        }
        // Durante juego activo: moderadamente rápido (100ms)
        elseif ($state['status'] === 'playing') {
            usleep(100000); // 100ms - juego activo
            logMessage("SSE sleep 100ms (playing)", 'DEBUG');
        }
        // Sin jugadores: relajado (500ms)
        else {
            usleep(500000); // 500ms - sin actividad
            logMessage("SSE sleep 500ms (idle)", 'DEBUG');
        }
    } else {
        usleep(500000);
    }
}

if ($connectionBroken) {
    logMessage("SSE terminado (conexión rota): {$gameId}", 'DEBUG');
} else {
    logMessage("SSE terminado normalmente: {$gameId}", 'DEBUG');
}
?>