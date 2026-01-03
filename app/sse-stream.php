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
header('Keep-Alive: timeout=3600, max=10000');

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

function readNotificationFile($filePath) {
    if (!file_exists($filePath)) {
        return null;
    }
    
    $content = @file_get_contents($filePath);
    if (!$content) {
        return null;
    }
    
    $decoded = @json_decode($content, true);
    
    if (!is_array($decoded) || !isset($decoded['event'])) {
        return ['error' => true, 'content' => $content];
    }
    
    return $decoded;
}

function isLightweightEvent($eventType) {
    $lightweight = ['player_joined', 'player_ready', 'player_left', 'player_updated', 'connection', 'typing'];
    return in_array($eventType, $lightweight);
}

$notifyAllFile = GAME_STATES_DIR . '/' . $gameId . '_all.json';
$notifyHostFile = GAME_STATES_DIR . '/' . $gameId . '_host.json';
$notifyFile = $playerId === 'host' ? $notifyHostFile : $notifyAllFile;

$lastNotifyHash = null;
$startTime = microtime(true);
$maxDuration = 3600;
if (defined('SSE_TIMEOUT') && SSE_TIMEOUT > 0) {
    $maxDuration = SSE_TIMEOUT;
}
$heartbeatInterval = 30;
if (defined('SSE_HEARTBEAT_INTERVAL') && SSE_HEARTBEAT_INTERVAL > 0) {
    $heartbeatInterval = SSE_HEARTBEAT_INTERVAL;
}
$lastHeartbeatTime = microtime(true);
$pollingInterval = 2;

sendSSE('connected', [
    'game_id' => $gameId,
    'player_id' => $playerId,
    'timestamp' => time(),
    'method' => 'SSE with event-driven notifications',
    'max_duration_seconds' => $maxDuration
]);

$lastHeartbeatTime = microtime(true);

logMessage("SSE conectado para {$gameId}, mirando: {$notifyFile}, max duration: {$maxDuration}s", 'DEBUG');

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
    $notification = readNotificationFile($notifyFile);
    
    if ($notification === null) {
        $now = microtime(true);
        $timeSinceHeartbeat = $now - $lastHeartbeatTime;
        
        if ($timeSinceHeartbeat >= $heartbeatInterval) {
            sendHeartbeat();
            $lastHeartbeatTime = $now;
            logMessage("SSE heartbeat para {$gameId}", 'DEBUG');
        }
        
        sleep($pollingInterval);
        continue;
    }
    
    if (isset($notification['error']) && $notification['error']) {
        logMessage("SSE notification JSON parsing failed for {$gameId}, forcing sync", 'ERROR');
        sendSSE('sync', ['reason' => 'notification_parse_error']);
        $lastNotifyHash = null;
        $lastHeartbeatTime = microtime(true);
        sleep(1);
        continue;
    }
    
    $notifyHash = json_encode($notification);
    if ($notifyHash === $lastNotifyHash) {
        $now = microtime(true);
        $timeSinceHeartbeat = $now - $lastHeartbeatTime;
        
        if ($timeSinceHeartbeat >= $heartbeatInterval) {
            sendHeartbeat();
            $lastHeartbeatTime = $now;
            logMessage("SSE heartbeat para {$gameId}", 'DEBUG');
        }
        
        sleep($pollingInterval);
        continue;
    }
    
    $lastNotifyHash = $notifyHash;
    
    $eventType = $notification['event'];
    $eventData = $notification['data'] ?? [];
    
    if (isLightweightEvent($eventType)) {
        sendSSE($eventType, $eventData);
        logMessage("SSE lightweight event '{$eventType}' enviado para {$gameId}", 'DEBUG');
    } elseif ($eventType === 'sync' || $eventType === 'refresh') {
        $state = loadGameState($gameId);
        if ($state) {
            sendSSE('update', $state);
            $activePlayers = count(array_filter($state['players'], function($p) {
                return !$p['disconnected'];
            }));
            logMessage("SSE full state 'update' enviado para {$gameId} ({$activePlayers} activos, status={$state['status']})", 'DEBUG');
        }
    } else {
        sendSSE($eventType, $eventData);
        logMessage("SSE custom event '{$eventType}' enviado para {$gameId}", 'DEBUG');
    }
    
    $lastHeartbeatTime = microtime(true);
    usleep(100000);
}

logMessage("SSE terminado para {$gameId}", 'DEBUG');
?>