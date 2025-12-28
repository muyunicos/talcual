<?php
// sse-stream.php - Server-Sent Events con detección de cambios
// MEJORAS: #3, #15 (mejorar heartbeat y detección de cambios)
// FIX: JSON comprimido para evitar problemas con saltos de línea en SSE

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
    echo "event: error\n";
    echo "data: {\"error\": \"game_id inválido\"}\n\n";
    flush();
    exit;
}

$lastModified = 0;
$lastContentHash = '';
$count = 0;
$maxIterations = SSE_TIMEOUT; // Usar constante de settings.php

// Loop principal
while ($count < $maxIterations) {
    $count++;

    // Detectar si el cliente se desconectó (MEJORA #3)
    if (connection_status() != CONNECTION_NORMAL || connection_aborted()) {
        logMessage("SSE: Cliente desconectado (game: {$gameId})", 'DEBUG');
        break;
    }

    // Leer estado
    $state = loadGameState($gameId);

    if ($state) {
        $file = GAME_STATES_DIR . '/' . $gameId . '.json';

        if (file_exists($file)) {
            $currentModified = @filemtime($file);
            
            // Re-encodear sin pretty print para SSE (FIX)
            $compactJson = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $currentHash = md5($compactJson);

            // Detectar cambio real (MEJORA #15: comparar contenido, no solo timestamp)
            if ($currentHash !== $lastContentHash) {
                // Enviar actualización con JSON compacto
                echo "event: update\n";
                echo "data: " . $compactJson . "\n\n";

                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                flush();

                $lastModified = $currentModified;
                $lastContentHash = $currentHash;
                
                logMessage("SSE: Estado actualizado enviado (game: {$gameId})", 'DEBUG');
            }
        }
    } else {
        // Juego no existe o expiró
        echo "event: game_ended\n";
        echo "data: {\"message\": \"Juego finalizado o expirado\"}\n\n";
        flush();
        break;
    }

    // Heartbeat cada 15s (MEJORA #15: usar constante)
    if ($count % SSE_HEARTBEAT_INTERVAL === 0) {
        echo ": heartbeat\n\n";
        if (function_exists('ob_flush')) {
            @ob_flush();
        }
        flush();
    }

    sleep(1);
}

logMessage("SSE: Conexión cerrada (game: {$gameId}, iterations: {$count})", 'DEBUG');
?>
