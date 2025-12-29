<?php
// 🔧 FIX #33: SSE usando patrón de notificación per-game con contador monótonico
// Archivos: {GAME_ID}_all.json, {GAME_ID}_host.json
// Contienen un número que incrementa con cada cambio (nunca retrocede)

require_once __DIR__ . '/config.php';

// 🔧 CRITICAL: Headers para evitar buffering en TODOS los niveles
header('Content-Type: text/event-stream; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');  // Nginx
header('X-Content-Type-Options: nosniff');

// Deshabilitar output buffering desde PHP
if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', '1');
    @apache_setenv('dont-vary', '1');
}

ini_set('output_buffering', 'off');
ini_set('zlib.output_compression', 'off');
ini_set('implicit_flush', 'on');

$gameId = sanitizeGameId($_GET['game_id'] ?? null);
$playerId = sanitizePlayerId($_GET['player_id'] ?? null);

if (!$gameId) {
    echo "event: error\n";
    echo "data: {\"message\": \"game_id inválido\"}\n\n";
    flush();
    exit;
}

logMessage("SSE iniciado para game: {$gameId}, player: {$playerId}", 'DEBUG');

if (!gameExists($gameId)) {
    echo "event: error\n";
    echo "data: {\"message\": \"Juego no encontrado\"}\n\n";
    flush();
    exit;
}

function sendSSE($event, $data) {
    echo "event: {$event}\n";
    echo "data: " . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
    flush();
    
    // Fuerza flush en Apache también
    if (function_exists('apache_flush')) {
        @apache_flush();
    }
}

/**
 * Lee el contador monótonico del archivo de notificación
 * Nunca retrocede, siempre incrementa
 */
function getNotifyCounter($filePath) {
    if (!file_exists($filePath)) {
        return 0;
    }
    $content = @file_get_contents($filePath);
    if ($content && is_numeric($content)) {
        return (int)$content;
    }
    return 0;
}

// 🔧 FIX #33: Usar archivos de notificación per-game con contador
$notifyAllFile = GAME_STATES_DIR . '/' . $gameId . '_all.json';
$notifyHostFile = GAME_STATES_DIR . '/' . $gameId . '_host.json';

// Único archivo que nos importa según el rol
$notifyFile = $playerId === 'host' ? $notifyHostFile : $notifyAllFile;

$lastNotify = 0;  // Contador anterior
$startTime = time();
$maxDuration = 1800; // 30 minutos
$heartbeatInterval = 30; // cada 30s
$lastHeartbeat = time();

// Enviar evento de conexión inmediato
sendSSE('connected', [
    'game_id' => $gameId,
    'player_id' => $playerId,
    'timestamp' => time(),
    'method' => 'SSE with per-game monotonic counter'
]);

logMessage("SSE conectado para {$gameId}, mirando: {$notifyFile}", 'DEBUG');

while ((time() - $startTime) < $maxDuration) {
    if (connection_aborted()) {
        logMessage("SSE desconectado por cliente: {$gameId}", 'DEBUG');
        break;
    }
    
    // Verificar si el juego existe
    if (!gameExists($gameId)) {
        sendSSE('game_ended', ['message' => 'El juego ha finalizado']);
        logMessage("SSE juego desaparecido: {$gameId}", 'INFO');
        break;
    }
    
    // 🔧 FIX #33: Leer contador monótonico (nunca retrocede)
    clearstatcache(false, $notifyFile);
    $currentNotify = getNotifyCounter($notifyFile);
    
    if ($currentNotify > $lastNotify) {
        // Hay cambio(s), enviar estado actualizado
        $state = loadGameState($gameId);
        
        if ($state) {
            $playerCount = count(array_filter($state['players'], function($p) {
                return !$p['disconnected'];
            }));
            
            sendSSE('update', $state);
            $lastNotify = $currentNotify;
            
            logMessage("SSE update enviado para {$gameId} (counter: {$currentNotify}, status={$state['status']}, {$playerCount} activos)", 'DEBUG');
        }
    }
    
    // Enviar heartbeat cada 30 segundos
    $now = time();
    if ($now - $lastHeartbeat >= $heartbeatInterval) {
        echo ": heartbeat\n\n";
        flush();
        if (function_exists('apache_flush')) {
            @apache_flush();
        }
        $lastHeartbeat = $now;
        logMessage("SSE heartbeat para {$gameId}", 'DEBUG');
    }
    
    // Dormir 1 segundo
    sleep(1);
}

logMessage("SSE terminado para {$gameId}", 'DEBUG');
?>
