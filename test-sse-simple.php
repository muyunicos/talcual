<?php
// test-sse-simple.php - Test básico de SSE
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');

echo "event: test\n";
echo "data: " . json_encode(['message' => 'SSE funciona', 'time' => time()]) . "\n\n";
flush();

for ($i = 1; $i <= 5; $i++) {
    sleep(1);
    echo "event: ping\n";
    echo "data: " . json_encode(['ping' => $i]) . "\n\n";
    flush();
}
?>