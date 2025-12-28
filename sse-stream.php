<?php
// sse-stream.php - Server-Sent Events con detección de cambios
// MEJORAS: #3 (detección desconexiones), #15 (heartbeat optimizado)

require_once 'config.php';

// Headers SSE
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

// Deshabilitar buffering
@ini_set('output_buffering', 0);
@ini_set('zlib.output_compression', 0);
@ini_set('implicit_flush', 1);

while (@ob_get_level()) {
    @ob_end_clean();
}

set_time_limit(0);

$gameId = sanitizeGameId($_GET['game_id'] ?? null);

if (!$gameId) {
    echo "data: ERROR\n\n";
    flush();
    exit;
}

$lastModified = 0;
$lastContent = null; // MEJORA #15: Comparar contenido real
$count = 0;
$maxIterations = SSE_TIMEOUT; // Usar constante de settings

logMessage("SSE iniciado para game: {$gameId}", 'DEBUG');

// Loop principal
while ($count < $maxIterations) {
    $count++;

    // MEJORA #3: Verificar conexión y si cliente abortó
    if (connection_aborted() || connection_status() != CONNECTION_NORMAL) {
        logMessage("Cliente desconectado: {$gameId}", 'DEBUG');
        break;
    }

    // Leer estado
    $state = loadGameState($gameId);

    if ($state) {
        $file = GAME_STATES_DIR . '/' . $gameId . '.json';

        if (file_exists($file)) {
            $currentModified = @filemtime($file);
            $currentContent = md5(json_encode($state)); // MEJORA #15: Hash del contenido

            // Detectar cambio REAL (no solo timestamp)
            if ($currentContent !== $lastContent) {
                // Enviar actualización
                echo "event: update\n";
                echo "data: " . json_encode($state, JSON_UNESCAPED_UNICODE) . "\n\n";

                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                flush();

                $lastModified = $currentModified;
                $lastContent = $currentContent;
                
                logMessage("Estado enviado vía SSE: {$gameId}", 'DEBUG');
            }
        }
    } else {
        // Juego no existe o expiró
        echo "event: game_ended\n";
        echo "data: {\"message\": \"Juego finalizado o no encontrado\"}\n\n";
        flush();
        break;
    }

    // Heartbeat cada N segundos (MEJORA #15)
    if ($count % SSE_HEARTBEAT_INTERVAL === 0) {
        echo ": heartbeat\n\n";
        if (function_exists('ob_flush')) {
            @ob_flush();
        }
        flush();
    }

    sleep(1);
}

logMessage("SSE finalizado para game: {$gameId}", 'DEBUG');
?>