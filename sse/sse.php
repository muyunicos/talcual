<?php
// sse.php - SSE Server (Servidor de eventos)

// Headers para SSE
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache, no-transform');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

// Permitir CORS
header('Access-Control-Allow-Origin: *');

// Obtener clientId del query string
$clientId = $_GET['clientId'] ?? 'client_' . uniqid();

// Crear carpeta de datos si no existe
$dataDir = __DIR__ . '/sse_data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

// Archivo para registrar este cliente
$clientFile = $dataDir . '/clients.json';
$messagesFile = $dataDir . '/messages.json';

// Función para enviar evento SSE
function sendEvent($eventType, $data) {
    echo "event: {$eventType}\n";
    echo "data: " . json_encode($data) . "\n\n";
    @ob_flush();
    @flush();
}

// Función para leer clientes conectados
function getConnectedClients($file) {
    if (!file_exists($file)) {
        return [];
    }
    $content = @file_get_contents($file);
    return $content ? json_decode($content, true) : [];
}

// Función para guardar cliente
function saveClients($file, $clients) {
    @file_put_contents($file, json_encode($clients, JSON_PRETTY_PRINT), LOCK_EX);
}

// Registrar este cliente
$clients = getConnectedClients($clientFile);
$clients[$clientId] = [
    'clientId' => $clientId,
    'connectedAt' => date('c'),
    'lastHeartbeat' => time(),
    'status' => 'active'
];
saveClients($clientFile, $clients);

// Notificar conexión
sendEvent('connected', [
    'clientId' => $clientId,
    'message' => 'Connected to SSE server',
    'clientCount' => count($clients),
    'timestamp' => date('c')
]);

// Notificar a otros clientes que se unió
foreach ($clients as $cid => $info) {
    if ($cid !== $clientId) {
        file_put_contents(
            $dataDir . '/notify_' . $cid . '.json',
            json_encode([
                'event' => 'client_joined',
                'data' => [
                    'clientId' => $clientId,
                    'totalClients' => count($clients),
                    'timestamp' => date('c')
                ]
            ]),
            LOCK_EX
        );
    }
}

// Loop para mantener la conexión abierta
$startTime = time();
$maxDuration = 1800; // 30 minutos máximo

while ((time() - $startTime) < $maxDuration) {
    // Verificar si hay mensajes nuevos para este cliente
    $notifyFile = $dataDir . '/notify_' . $clientId . '.json';
    if (file_exists($notifyFile)) {
        $notification = @file_get_contents($notifyFile);
        if ($notification) {
            $data = json_decode($notification, true);
            sendEvent($data['event'], $data['data']);
            @unlink($notifyFile);
        }
    }

    // Enviar heartbeat cada 30 segundos
    if (time() % 30 === 0) {
        echo ": heartbeat - " . date('c') . "\n\n";
        @ob_flush();
        @flush();
    }

    sleep(1);
}

// Limpiar al desconectar
$clients = getConnectedClients($clientFile);
unset($clients[$clientId]);
saveClients($clientFile, $clients);

// Notificar desconexión
foreach ($clients as $cid => $info) {
    file_put_contents(
        $dataDir . '/notify_' . $cid . '.json',
        json_encode([
            'event' => 'client_left',
            'data' => [
                'clientId' => $clientId,
                'totalClients' => count($clients),
                'timestamp' => date('c')
            ]
        ]),
        LOCK_EX
    );
}
?>