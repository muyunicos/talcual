<?php
// api.php - API para broadcasts y mensajes directos

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Carpeta de datos
$dataDir = __DIR__ . '/sse_data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

$clientFile = $dataDir . '/clients.json';

// Función auxiliar
function getClients() {
    global $dataDir, $clientFile;
    if (!file_exists($clientFile)) {
        return [];
    }
    return json_decode(@file_get_contents($clientFile), true) ?? [];
}

// Determinar endpoint
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'broadcast':
        // POST /api.php?action=broadcast
        $input = json_decode(file_get_contents('php://input'), true);
        $message = $input['message'] ?? '';
        $sender = $input['sender'] ?? 'system';

        if (!$message) {
            http_response_code(400);
            echo json_encode(['error' => 'Message required']);
            exit;
        }

        $clients = getClients();
        $successCount = 0;

        foreach ($clients as $clientId => $info) {
            $notifyFile = $dataDir . '/notify_' . $clientId . '.json';
            $result = @file_put_contents(
                $notifyFile,
                json_encode([
                    'event' => 'global_message',
                    'data' => [
                        'sender' => $sender,
                        'message' => $message,
                        'timestamp' => date('c'),
                        'clientCount' => count($clients)
                    ]
                ]),
                LOCK_EX
            );
            if ($result) {
                $successCount++;
            }
        }

        echo json_encode([
            'status' => 'success',
            'message' => "Broadcast to {$successCount}/" . count($clients) . " clients",
            'recipientCount' => $successCount
        ]);
        break;

    case 'send':
        // POST /api.php?action=send
        $input = json_decode(file_get_contents('php://input'), true);
        $to = $input['to'] ?? '';
        $message = $input['message'] ?? '';
        $from = $input['from'] ?? 'system';

        if (!$to || !$message) {
            http_response_code(400);
            echo json_encode(['error' => 'Target (to) and message required']);
            exit;
        }

        $clients = getClients();

        if (!isset($clients[$to])) {
            http_response_code(404);
            echo json_encode([
                'error' => "Client '{$to}' not connected",
                'availableClients' => array_keys($clients)
            ]);
            exit;
        }

        $notifyFile = $dataDir . '/notify_' . $to . '.json';
        $result = @file_put_contents(
            $notifyFile,
            json_encode([
                'event' => 'directed_message',
                'data' => [
                    'from' => $from,
                    'to' => $to,
                    'message' => $message,
                    'timestamp' => date('c')
                ]
            ]),
            LOCK_EX
        );

        if ($result) {
            echo json_encode([
                'status' => 'sent',
                'to' => $to,
                'message' => "Message delivered to {$to}"
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to send message']);
        }
        break;

    case 'clients':
        // GET /api.php?action=clients
        $clients = getClients();
        $clientList = [];

        foreach ($clients as $id => $info) {
            $clientList[] = [
                'clientId' => $id,
                'connectedAt' => $info['connectedAt'],
                'lastHeartbeat' => date('c', $info['lastHeartbeat']),
                'status' => $info['status']
            ];
        }

        echo json_encode([
            'total' => count($clients),
            'clients' => $clientList,
            'timestamp' => date('c')
        ]);
        break;

    case 'health':
        // GET /api.php?action=health
        $clients = getClients();
        echo json_encode([
            'status' => 'healthy',
            'activeConnections' => count($clients),
            'timestamp' => date('c')
        ]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
}
?>