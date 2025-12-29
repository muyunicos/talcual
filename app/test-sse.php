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

// 🔥 CRITICAL: Deshabilitar buffering ANTES de cualquier output
while (@ob_end_flush());
if (ob_get_level()) @ob_end_clean();

if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', '1');
    @apache_setenv('dont-vary', '1');
}

// Configuración agresiva
@ini_set('output_buffering', 0);
@ini_set('implicit_flush', 1);
@ini_set('zlib.output_compression', 0);
ob_implicit_flush(1);

// Headers SSE
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');
header('Pragma: no-cache');
header('Expires: 0');

function send($event, $data) {
    echo "event: {$event}\n";
    echo "data: " . json_encode($data) . "\n\n";
    flush();
}

// Heartbeat inicial (debe llegar INMEDIATAMENTE)
error_log("TEST-SSE: Enviando heartbeat inicial...");
echo ": ping\n\n";
flush();
error_log("TEST-SSE: flush() ejecutado");

send('start', ['message' => 'Test SSE iniciado', 'time' => date('H:i:s')]);

for ($i = 1; $i <= 10; $i++) {
    sleep(1);
    
    send('count', [
        'count' => $i,
        'message' => "Mensaje #{$i}",
        'time' => date('H:i:s')
    ]);
    
    error_log("TEST-SSE: Mensaje #{$i} enviado");
}

send('end', ['message' => 'Test finalizado', 'total' => 10]);

error_log("TEST-SSE: Test completado");
exit;
?>
