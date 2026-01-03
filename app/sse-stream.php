<?php
set_time_limit(0);

require_once __DIR__ . '/config.php';

header('Content-Type: text/event-stream; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');
header('X-Content-Type-Options: nosniff');

if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', '1');
    @apache_setenv('dont-vary', '1');
}

while (ob_get_level()) {
    @ob_end_clean();
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
    if (function_exists('apache_flush')) {
        @apache_flush();
    }
}

function sendHeartbeat() {
    echo ": heartbeat\n\n";
    flush();
    if (function_exists('apache_flush')) {
        @apache_flush();
    }
}

function getNotifyCounter($filePath) {
    if (!file_exists($filePath)) {
        return 0;
    }
    $content = @file_get_contents($filePath);
    if ($content && is_numeric(trim($content))) {
        return (int)trim($content);
    }
    return 0;
}

$notifyAllFile = GAME_STATES_DIR . '/' . $gameId . '_all.json';
$notifyHostFile = GAME_STATES_DIR . '/' . $gameId . '_host.json';
$notifyFile = $playerId === 'host' ? $notifyHostFile : $notifyAllFile;

$lastNotify = 0;
$startTime = microtime(true);
$maxDuration = SSE_TIMEOUT;
$heartbeatInterval = SSE_HEARTBEAT_INTERVAL;
$lastHeartbeatTime = microtime(true);
$pollingInterval = 2;

sendSSE('connected', [
    'game_id' => $gameId,
    'player_id' => $playerId,
    'timestamp' => time(),
    'method' => 'SSE with per-game monotonic counter'
]);

$lastHeartbeatTime = microtime(true);

logMessage("SSE conectado para {$gameId}, mirando: {$notifyFile}", 'DEBUG');

while ((microtime(true) - $startTime) < $maxDuration) {
    if (connection_aborted()) {
        logMessage("SSE desconectado por cliente: {$gameId}", 'DEBUG');
        break;
    }
    
    if (!gameExists($gameId)) {
        sendSSE('game_ended', ['message' => 'El juego ha finalizado']);
        logMessage("SSE juego desaparecido: {$gameId}", 'INFO');
        break;
    }
    
    clearstatcache(false, $notifyFile);
    $currentNotify = getNotifyCounter($notifyFile);
    
    if ($currentNotify > $lastNotify) {
        $state = loadGameState($gameId);
        
        if ($state) {
            $playerCount = count(array_filter($state['players'], function($p) {
                return !$p['disconnected'];
            }));
            
            sendSSE('update', $state);
            $lastNotify = $currentNotify;
            $lastHeartbeatTime = microtime(true);
            
            logMessage("SSE update enviado para {$gameId} (counter: {$currentNotify}, status={$state['status']}, {$playerCount} activos)", 'DEBUG');
            
            usleep(100000);
        }
    } else {
        $now = microtime(true);
        $timeSinceHeartbeat = $now - $lastHeartbeatTime;
        
        if ($timeSinceHeartbeat >= $heartbeatInterval) {
            sendHeartbeat();
            $lastHeartbeatTime = $now;
            logMessage("SSE heartbeat para {$gameId}", 'DEBUG');
        }
        
        sleep($pollingInterval);
    }
}

logMessage("SSE terminado para {$gameId}", 'DEBUG');
?>
