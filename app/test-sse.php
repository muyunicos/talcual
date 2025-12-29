<?php
/**
 * Test de SSE sin dependencias
 * Verifica que el servidor envía datos sin buffer
 * 
 * Uso:
 *   https://juegos.loc.ar/app/test-sse.php
 * 
 * Debe mostrar mensajes cada 1 segundo EN TIEMPO REAL.
 * Si no se ve hasta que termina: hay buffering.
 */

// CRITICAL: Deshabilitar buffering ANTES de cualquier output
while (@ob_end_flush());

// Headers SSE
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', '1');
}

// Configuración agresiva
@ini_set('output_buffering', 0);
@ini_set('implicit_flush', 1);
@ini_set('zlib.output_compression', 0);
ob_implicit_flush(1);

function send($event, $data) {
    echo "event: {$event}\n";
    echo "data: " . json_encode($data) . "\n\n";
    flush();
}

// Heartbeat inicial (debe llegar INMEDIATAMENTE)
echo ": ping\n\n";
flush();

send('start', ['message' => 'Test SSE iniciado', 'time' => date('H:i:s')]);

for ($i = 1; $i <= 10; $i++) {
    sleep(1);
    
    send('count', [
        'count' => $i,
        'message' => "Mensaje #{$i}",
        'time' => date('H:i:s')
    ]);
}

send('end', ['message' => 'Test finalizado', 'total' => 10]);

exit;
?>
