<?php
// sse-stream.php - Server-Sent Events con detección de cambios
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

$gameId = $_GET['game_id'] ?? null;

if (!$gameId) {
    echo "data: ERROR\n\n";
    flush();
    exit;
}

$lastModified = 0;
$count = 0;

// Loop principal
while ($count < 1800) {
    $count++;

    // Verificar conexión
    if (connection_status() != CONNECTION_NORMAL) {
        break;
    }

    // Leer estado
    $state = loadGameState($gameId);

    if ($state) {
        $file = GAME_STATES_DIR . '/' . $gameId . '.json';

        if (file_exists($file)) {
            $currentModified = @filemtime($file);

            // Detectar cambio
            if ($currentModified !== $lastModified) {
                // Enviar actualización
                echo "event: update\n";
                echo "data: " . json_encode($state, JSON_UNESCAPED_UNICODE) . "\n\n";

                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                flush();

                $lastModified = $currentModified;
            }
        }
    }

    // Heartbeat cada 15s
    if ($count % 15 === 0) {
        echo ": heartbeat\n\n";
        if (function_exists('ob_flush')) {
            @ob_flush();
        }
        flush();
    }

    sleep(1);
}
?>