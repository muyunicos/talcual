<?php
// Analytics Dashboard - TalCual Party
// MEJORA #10: Analytics básico accesible desde desarrollador

require_once __DIR__ . '/../core/config.php';

if (!DEV_MODE) {
    http_response_code(403);
    die('Analytics solo disponible en modo desarrollo');
}

header('Content-Type: application/json');

$action = $_GET['action'] ?? 'summary';

$response = ['success' => false];

switch ($action) {
    case 'summary':
        $analytics = [];
        
        if (file_exists(ANALYTICS_FILE)) {
            $json = file_get_contents(ANALYTICS_FILE);
            $analytics = json_decode($json, true) ?? [];
        }
        
        // Calcular estadísticas
        $stats = [
            'total_events' => count($analytics),
            'games_created' => 0,
            'games_finished' => 0,
            'total_players' => 0,
            'total_rounds' => 0,
            'active_games' => count(getActiveCodes()),
            'events_by_type' => [],
            'recent_events' => array_slice($analytics, -10)
        ];
        
        foreach ($analytics as $entry) {
            $action = $entry['action'] ?? 'unknown';
            
            if (!isset($stats['events_by_type'][$action])) {
                $stats['events_by_type'][$action] = 0;
            }
            $stats['events_by_type'][$action]++;
            
            if ($action === 'game_created') {
                $stats['games_created']++;
            } elseif ($action === 'game_finished') {
                $stats['games_finished']++;
            } elseif ($action === 'player_joined') {
                $stats['total_players']++;
            } elseif ($action === 'round_started') {
                $stats['total_rounds']++;
            }
        }
        
        $response = [
            'success' => true,
            'stats' => $stats
        ];
        break;
        
    case 'clear':
        if (file_exists(ANALYTICS_FILE)) {
            unlink(ANALYTICS_FILE);
        }
        $response = ['success' => true, 'message' => 'Analytics cleared'];
        break;
        
    case 'export':
        if (file_exists(ANALYTICS_FILE)) {
            header('Content-Type: application/json');
            header('Content-Disposition: attachment; filename="talcual-analytics-' . date('Y-m-d') . '.json"');
            readfile(ANALYTICS_FILE);
            exit;
        }
        $response = ['success' => false, 'message' => 'No data to export'];
        break;
        
    default:
        $response = ['success' => false, 'message' => 'Unknown action'];
}

echo json_encode($response, JSON_PRETTY_PRINT);
?>