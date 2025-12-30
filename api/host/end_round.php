<?php
/**
 * API: End Round
 * POST /api/host/end_round.php
 * 
 * Host finaliza una ronda
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['code'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Falta parámetro: code']);
    exit;
}

$code = strtoupper(trim($input['code']));
$gameFile = "../game_states/{$code}.json";

if (!file_exists($gameFile)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Partida no encontrada']);
    exit;
}

if (flock($fp = fopen($gameFile, 'c+'), LOCK_EX)) {
    fseek($fp, 0);
    $gameState = json_decode(fread($fp, filesize($gameFile) ?: 1), true) ?: [];
    
    // Procesar respuestas y calcular puntajes
    $roundResults = [];
    $answers = [];
    
    foreach ($gameState['players'] as &$player) {
        if (isset($player['answer'])) {
            $answer = strtolower(trim($player['answer']));
            $answers[$answer] = ($answers[$answer] ?? 0) + 1;
            
            $roundResults[] = [
                'playerId' => $player['id'],
                'playerName' => $player['name'],
                'answer' => $player['answer'],
                'roundScore' => 0
            ];
        }
    }
    
    // Calcular puntos (respuestas únicas dan más puntos)
    foreach ($roundResults as &$result) {
        $answer = strtolower(trim($result['answer']));
        $count = $answers[$answer];
        $result['roundScore'] = 100 - ($count - 1) * 10; // Más jugadores = menos puntos
        
        // Actualizar jugador
        foreach ($gameState['players'] as &$player) {
            if ($player['id'] === $result['playerId']) {
                $player['score'] = ($player['score'] ?? 0) + $result['roundScore'];
                break;
            }
        }
    }
    
    // Actualizar top words
    if (!isset($gameState['topWords'])) {
        $gameState['topWords'] = [];
    }
    
    foreach ($answers as $word => $count) {
        $found = false;
        foreach ($gameState['topWords'] as &$topWord) {
            if (strtolower($topWord['word']) === $word) {
                $topWord['count'] += $count;
                $found = true;
                break;
            }
        }
        if (!$found) {
            $gameState['topWords'][] = ['word' => $word, 'count' => $count];
        }
    }
    
    // Ordenar top words
    usort($gameState['topWords'], function($a, $b) {
        return $b['count'] <=> $a['count'];
    });
    $gameState['topWords'] = array_slice($gameState['topWords'], 0, 10);
    
    // Limpiar respuestas para siguiente ronda
    foreach ($gameState['players'] as &$player) {
        unset($player['answer']);
        unset($player['answeredAt']);
    }
    
    // Preparar siguiente ronda o terminar
    $gameState['currentRound']++;
    if ($gameState['currentRound'] > $gameState['totalRounds']) {
        $gameState['status'] = 'finished';
        $gameState['endedAt'] = date('c');
        
        // Preparar resultados finales
        $gameState['finalResults'] = array_map(function($p) {
            return [
                'playerName' => $p['name'],
                'totalScore' => $p['score'] ?? 0
            ];
        }, $gameState['players']);
        
        usort($gameState['finalResults'], function($a, $b) {
            return $b['totalScore'] <=> $a['totalScore'];
        });
    }
    
    // Guardar
    ftruncate($fp, 0);
    fseek($fp, 0);
    fwrite($fp, json_encode($gameState, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    
    echo json_encode([
        'success' => true,
        'roundResults' => $roundResults,
        'nextRound' => $gameState['currentRound'],
        'gameFinished' => $gameState['status'] === 'finished'
    ]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al adquirir lock']);
}

?>
