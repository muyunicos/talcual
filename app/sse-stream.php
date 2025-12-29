<?php
// 🔧 FIX #33: SSE usando patrón de notificación por game_id
// Archivos: {GAME_ID}_all.json, {GAME_ID}_host.json
// En lugar de filemtime() agresivo que causa buffering en Hostinger

require_once __DIR__ . '/config.php';

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');
header('Pragma: no-cache');
header('Expires: 0');

if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', '1');
    @apache_setenv('dont-vary', '1');
}

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
}

// 🔧 FIX #33: Usar archivos de notificación per-game
$notifyAllFile = GAME_STATES_DIR . '/' . $gameId . '_all.json';
$notifyHostFile = GAME_STATES_DIR . '/' . $gameId . '_host.json';

// Único archivo que nos importa según el rol
$notifyFile = $playerId === 'host' ? $notifyHostFile : $notifyAllFile;

$lastNotify = 0;
$startTime = time();
$maxDuration = 1800; // 30 minutos
$heartbeatInterval = 30; // cada 30s
$lastHeartbeat = time();

// Enviar evento de conexión inmediato
sendSSE('connected', [
    'game_id' => $gameId,
    'player_id' => $playerId,
    'timestamp' => time(),
    'method' => 'SSE with per-game notify files'
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
    
    // 🔧 FIX #33: Chequear archivo de notificación per-game
    clearstatcache(false, $notifyFile);
    
    if (file_exists($notifyFile)) {
        $currentNotify = @filemtime($notifyFile) ?: time();
        
        if ($currentNotify > $lastNotify) {
            // Hay cambio, enviar estado actualizado
            $state = loadGameState($gameId);
            
            if ($state) {
                $playerCount = count(array_filter($state['players'], function($p) {
                    return !$p['disconnected'];
                }));
                
                sendSSE('update', $state);
                $lastNotify = $currentNotify;
                
                logMessage("SSE update enviado para {$gameId} (status={$state['status']}, {$playerCount} activos)", 'DEBUG');
            }
        }
    }
    
    // Enviar heartbeat cada 30 segundos
    $now = time();
    if ($now - $lastHeartbeat >= $heartbeatInterval) {
        echo ": heartbeat\n\n";
        flush();
        $lastHeartbeat = $now;
        logMessage("SSE heartbeat para {$gameId}", 'DEBUG');
    }
    
    // Dormir 1 segundo (no 50ms como antes)
    sleep(1);
}

logMessage("SSE terminado para {$gameId}", 'DEBUG');
?>
