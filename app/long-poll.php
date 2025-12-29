<?php
/**
 * Long Polling Endpoint
 * Fallback para servidores que no soportan SSE (como Hostinger compartido)
 * 
 * Espera hasta 25s por cambios en el estado del juego.
 * Si hay cambio: responde inmediatamente
 * Si no: timeout y responde estado actual
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('Access-Control-Allow-Origin: *');

$gameId = sanitizeGameId($_GET['game_id'] ?? null);
$lastModified = intval($_GET['last_modified'] ?? 0);

if (!$gameId) {
    http_response_code(400);
    echo json_encode(['error' => 'game_id requerido']);
    exit;
}

if (!gameExists($gameId)) {
    http_response_code(404);
    echo json_encode(['error' => 'Juego no encontrado']);
    exit;
}

$stateFile = GAME_STATES_DIR . '/' . $gameId . '.json';
$startTime = time();
$timeout = 25; // 25 segundos
$pollInterval = 200000; // 200ms en microsegundos

logMessage("Long-poll iniciado para {$gameId} (lastModified={$lastModified})", 'DEBUG');

// Loop: esperar cambios o timeout
while (time() - $startTime < $timeout) {
    if (!file_exists($stateFile)) {
        http_response_code(404);
        echo json_encode(['error' => 'Juego finalizado']);
        logMessage("Long-poll: juego {$gameId} ya no existe", 'DEBUG');
        exit;
    }
    
    $currentModified = @filemtime($stateFile);
    
    if ($currentModified === false) {
        // Archivo desapareció
        http_response_code(404);
        echo json_encode(['error' => 'Error al leer estado']);
        exit;
    }
    
    // ¡HAY CAMBIO! Responder inmediatamente
    if ($currentModified > $lastModified) {
        $state = loadGameState($gameId);
        
        if ($state) {
            $response = [
                'success' => true,
                'state' => $state,
                'last_modified' => $currentModified,
                'polling' => true,
                'wait_time' => time() - $startTime
            ];
            
            logMessage("Long-poll: cambio detectado para {$gameId} después de " . (time() - $startTime) . "s", 'DEBUG');
            echo json_encode($response, JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
    
    // Esperar antes del próximo chequeo
    usleep($pollInterval);
}

// Timeout: responder con estado actual
$state = loadGameState($gameId);
$currentModified = @filemtime($stateFile) ?: time();

if ($state) {
    $response = [
        'success' => true,
        'state' => $state,
        'last_modified' => $currentModified,
        'polling' => true,
        'timeout' => true,
        'wait_time' => $timeout
    ];
    
    logMessage("Long-poll: timeout para {$gameId}, respondiendo estado actual", 'DEBUG');
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Error al cargar estado']);
}
?>
