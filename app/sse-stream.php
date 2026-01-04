<?php
set_time_limit(0);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/GameRepository.php';

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
    echo "event: heartbeat\n";
    echo "data: {\"timestamp\": " . time() . "}\n\n";
    flush();
    if (function_exists('apache_flush')) {
        @apache_flush();
    }
}

function sanitizeStateForPlayer($state, $playerId) {
    if ($playerId === 'host') {
        return $state;
    }

    if (!isset($state['players']) || !is_array($state['players'])) {
        return $state;
    }

    $status = $state['status'] ?? 'waiting';

    if ($status === 'round_ended' || $status === 'finished') {
        return $state;
    }

    $sanitized = $state;
    $sanitized['players'] = [];

    foreach ($state['players'] as $pid => $player) {
        if ($pid === $playerId) {
            $sanitized['players'][$pid] = $player;
        } else {
            $sanitized['players'][$pid] = [
                'id' => $player['id'] ?? $pid,
                'name' => $player['name'] ?? 'Jugador',
                'score' => $player['score'] ?? 0,
                'status' => $player['status'] ?? 'waiting',
                'color' => $player['color'] ?? '#999999',
                'disconnected' => $player['disconnected'] ?? false,
                'answer_count' => isset($player['answers']) && is_array($player['answers']) ? count($player['answers']) : 0
            ];
        }
    }

    return $sanitized;
}

function isLightweightEvent($eventType) {
    $lightweight = ['player_joined', 'player_ready', 'player_left', 'player_updated', 'connection', 'typing'];
    return in_array($eventType, $lightweight);
}

function getAPCuNotificationKey($gameId, $playerId) {
    if ($playerId === 'host') {
        return 'talcual_notify_' . $gameId . '_host';
    }
    return 'talcual_notify_' . $gameId . '_all';
}

function getAPCuNotification($key) {
    if (!extension_loaded('apcu') || !apcu_enabled()) {
        return null;
    }

    $success = false;
    $notification = apcu_fetch($key, $success);

    if ($success && is_array($notification)) {
        return $notification;
    }

    return null;
}

$notifyKey = getAPCuNotificationKey($gameId, $playerId);

$lastNotificationTs = null;
$startTime = microtime(true);
$maxDuration = 3600;
if (defined('SSE_TIMEOUT') && SSE_TIMEOUT > 0) {
    $maxDuration = SSE_TIMEOUT;
}
$heartbeatInterval = defined('SSE_HEARTBEAT_INTERVAL') && SSE_HEARTBEAT_INTERVAL > 0 ? SSE_HEARTBEAT_INTERVAL : 15;
$lastHeartbeatTime = microtime(true);
$pollingInterval = 2;

sendSSE('connected', [
    'game_id' => $gameId,
    'player_id' => $playerId,
    'timestamp' => time(),
    'method' => 'SSE with APCu-based event notifications + Phase 4 distributed calculation',
    'max_duration_seconds' => $maxDuration
]);

$lastHeartbeatTime = microtime(true);

logMessage("SSE conectado para {$gameId} (player: {$playerId}), usando APCu, max duration: {$maxDuration}s, heartbeat: {$heartbeatInterval}s", 'DEBUG');

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
    
    $notification = getAPCuNotification($notifyKey);
    
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
    
    $currentTs = $notification['ts'] ?? microtime(true);
    
    if ($lastNotificationTs !== null && $currentTs === $lastNotificationTs) {
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
    
    $lastNotificationTs = $currentTs;
    
    $eventType = $notification['event'] ?? 'update';
    $eventData = $notification['data'] ?? [];
    
    if (isLightweightEvent($eventType)) {
        sendSSE($eventType, $eventData);
        logMessage("SSE lightweight event '{$eventType}' enviado para {$gameId}", 'DEBUG');
    } elseif ($eventType === 'sync' || $eventType === 'refresh') {
        $state = loadGameState($gameId);
        if ($state) {
            $sanitizedState = sanitizeStateForPlayer($state, $playerId);
            sendSSE('update', $sanitizedState);
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
