<?php
// 🔥 CRITICAL: DESHABILITAR BUFFERING ANTES DE CUALQUIER OUTPUT O INCLUDE
// Debe ser lo PRIMERO en el archivo (incluso antes de error_reporting)
while (@ob_end_flush());
if (ob_get_level()) @ob_end_clean();

if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', '1');
    @apache_setenv('dont-vary', '1');
}

// Configuración AGRESIVA de unbuffering
@ini_set('output_buffering', 0);
@ini_set('implicit_flush', 1);
@ini_set('zlib.output_compression', 0);
ob_implicit_flush(1);

error_reporting(E_ALL);
ini_set('display_errors', 1);
error_log("PRUEBA DE LOG: Esto es un mensaje de prueba personalizado.");

// Server-Sent Events para actualizaciones en tiempo real
require_once __DIR__ . '/config.php';

// Headers SSE (después de deshabilitar buffering)
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');
header('Pragma: no-cache');
header('Expires: 0');

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
error_log("SSE: Heartbeat inicial enviado para {$gameId}");
logMessage("SSE heartbeat inicial enviado para {$gameId}", 'DEBUG');

// 🔧 NUEVO: Enviar un evento test para confirmar que llega
sendSSE('connected', ['game_id' => $gameId, 'timestamp' => time()]);

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
    
    $currentModified = @filemtime($stateFile);
    
    // 🔧 FIX #30: Si filemtime() falla, usar stat para un chequeo más robusto
    if ($currentModified === false) {
        $stat = @stat($stateFile);
        if (!$stat) {
            // Archivo ya no existe
            sendSSE('game_ended', ['message' => 'El juego ha finalizado']);
            logMessage("SSE archivo desaparecido: {$gameId}", 'INFO');
            break;
        }
        $currentModified = $stat['mtime'];
    }
    
    $state = null;
    // 🔧 FIX #30: Reducir sleep AGRESIVAMENTE cuando hay jugadores
    // En lugar de esperar 500ms, espera 50ms para detectar cambios rápido
    $sleep = 500000;
    
    if ($currentModified > $lastModified) {
        $state = loadGameState($gameId);
        
        if ($state) {
            $playerCount = count($state['players'] ?? []);
            sendSSE('update', $state);
            $lastModified = $currentModified;
            logMessage("SSE update enviado para {$gameId} (status={$state['status']}, {$playerCount} jugadores)", 'DEBUG');
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
        
        // 🔧 FIX #30: AGRESIVO - En estado 'waiting' con jugadores, poll cada 50ms
        // Antes estaba en 30000μs (30ms) pero eso es demasiado rápido y consume CPU
        // Ahora es 50ms: balance entre respuesta rápida y eficiencia
        if ($playerCount > 0 && $state['status'] === 'waiting') {
            $sleep = 50000;  // 50ms para detectar joins rápido
        } elseif ($state['status'] === 'playing') {
            $sleep = 100000;  // 100ms durante la ronda
        } else {
            $sleep = 500000;  // 500ms sin jugadores
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
