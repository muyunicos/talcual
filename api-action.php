<?php
// Unánimo Party - API Actions
// Maneja todas las acciones del juego

require_once 'config.php';

// Headers para JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Leer input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode(['success' => false, 'message' => 'JSON inválido']);
    exit;
}

$action = $input['action'] ?? null;
$gameId = $input['game_id'] ?? null;
$playerId = $input['player_id'] ?? null;

// Log
error_log("API Action: {$action} | Game: {$gameId} | Player: {$playerId}");

$response = ['success' => false, 'message' => 'Acción no válida'];

switch ($action) {

    case 'create_game':
        // Crear nueva partida
        $gameId = generateGameCode();

        $state = [
            'game_id' => $gameId,
            'players' => [],
            'round' => 0,
            'total_rounds' => 3,
            'status' => 'waiting',
            'current_word' => null,
            'round_duration' => 120,
            'round_started_at' => null,
            'round_details' => [],
            'round_top_words' => [],
            'game_history' => []
        ];

        if (saveGameState($gameId, $state)) {
            $response = [
                'success' => true,
                'game_id' => $gameId,
                'state' => $state
            ];
        } else {
            $response = ['success' => false, 'message' => 'Error al crear juego'];
        }
        break;

    case 'join_game':
        // Unirse a partida existente
        if (!$gameId || !$playerId) {
            $response = ['success' => false, 'message' => 'game_id y player_id requeridos'];
            break;
        }

        $state = loadGameState($gameId);

        if (!$state) {
            $response = ['success' => false, 'message' => 'Juego no encontrado'];
            break;
        }

        $playerName = $input['name'] ?? 'Jugador';
        $playerColor = $input['color'] ?? null; // Nuevo: color del jugador

        // Validar nombre
        if (strlen($playerName) < 2) {
            $response = ['success' => false, 'message' => 'Nombre muy corto'];
            break;
        }

        // Verificar si ya existe
        if (isset($state['players'][$playerId])) {
            $response = [
                'success' => true,
                'message' => 'Ya estás en el juego',
                'state' => $state
            ];
            break;
        }

        // Agregar jugador
        $state['players'][$playerId] = [
            'id' => $playerId,
            'name' => $playerName,
            'color' => $playerColor, // Guardar color
            'score' => 0,
            'status' => 'connected',
            'answers' => [],
            'round_results' => []
        ];

        if (saveGameState($gameId, $state)) {
            $response = [
                'success' => true,
                'message' => 'Te uniste al juego',
                'state' => $state
            ];
        } else {
            $response = ['success' => false, 'message' => 'Error al unirse'];
        }
        break;

    case 'start_round':
        // Iniciar nueva ronda
        if (!$gameId) {
            $response = ['success' => false, 'message' => 'game_id requerido'];
            break;
        }

        $state = loadGameState($gameId);

        if (!$state) {
            $response = ['success' => false, 'message' => 'Juego no encontrado'];
            break;
        }

        // Validar que haya suficientes jugadores
        if (count($state['players']) < 3) {
            $response = ['success' => false, 'message' => 'Mínimo 3 jugadores'];
            break;
        }

        $word = $input['word'] ?? getRandomWord();
        $duration = $input['duration'] ?? 120;

        // Incrementar ronda
        $state['round']++;
        $state['status'] = 'playing';
        $state['current_word'] = $word;
        $state['round_duration'] = $duration;
        $state['round_started_at'] = time();

        // Resetear jugadores para nueva ronda
        foreach ($state['players'] as $playerId => $player) {
            $state['players'][$playerId]['status'] = 'playing';
            $state['players'][$playerId]['answers'] = [];
            $state['players'][$playerId]['round_results'] = [];
        }

        if (saveGameState($gameId, $state)) {
            $response = [
                'success' => true,
                'message' => 'Ronda iniciada',
                'state' => $state
            ];
        }
        break;

    case 'submit_answers':
        // Enviar respuestas del jugador
        if (!$gameId || !$playerId) {
            $response = ['success' => false, 'message' => 'game_id y player_id requeridos'];
            break;
        }

        $state = loadGameState($gameId);

        if (!$state || !isset($state['players'][$playerId])) {
            $response = ['success' => false, 'message' => 'Jugador no encontrado'];
            break;
        }

        $answers = $input['answers'] ?? [];

        // Filtrar respuestas
        $answers = array_filter($answers, function($word) use ($state) {
            $normalized = strtoupper(trim($word));
            return !empty($normalized) && $normalized !== strtoupper($state['current_word']);
        });

        // Remover duplicados
        $answers = array_unique(array_map('strtoupper', $answers));
        $answers = array_values($answers);

        // Guardar respuestas
        $state['players'][$playerId]['answers'] = $answers;
        $state['players'][$playerId]['status'] = 'ready';

        if (saveGameState($gameId, $state)) {
            $response = [
                'success' => true,
                'message' => 'Respuestas guardadas',
                'state' => $state
            ];
        }
        break;

    case 'end_round':
        // Finalizar ronda y calcular puntos
        if (!$gameId) {
            $response = ['success' => false, 'message' => 'game_id requerido'];
            break;
        }

        $state = loadGameState($gameId);

        if (!$state) {
            $response = ['success' => false, 'message' => 'Juego no encontrado'];
            break;
        }

        // Calcular puntos
        $wordCounts = [];
        $playerWords = [];

        foreach ($state['players'] as $playerId => $player) {
            foreach ($player['answers'] as $word) {
                $normalized = strtoupper($word);

                if (!isset($wordCounts[$normalized])) {
                    $wordCounts[$normalized] = [];
                }

                $wordCounts[$normalized][] = $player['name'];

                if (!isset($playerWords[$playerId])) {
                    $playerWords[$playerId] = [];
                }

                $playerWords[$playerId][] = $normalized;
            }
        }

        // Calcular puntos por jugador
        foreach ($state['players'] as $playerId => $player) {
            $roundResults = [];
            $roundScore = 0;

            if (isset($playerWords[$playerId])) {
                foreach ($playerWords[$playerId] as $word) {
                    $count = count($wordCounts[$word]);
                    $points = $count > 1 ? $count : 0;

                    $matchedWith = array_diff($wordCounts[$word], [$player['name']]);

                    $roundResults[$word] = [
                        'points' => $points,
                        'count' => $count,
                        'matched_with' => array_values($matchedWith)
                    ];

                    $roundScore += $points;
                }
            }

            $state['players'][$playerId]['round_results'] = $roundResults;
            $state['players'][$playerId]['score'] += $roundScore;
            $state['players'][$playerId]['status'] = 'connected';
        }

        // Top palabras de la ronda
        $topWords = [];
        foreach ($wordCounts as $word => $players) {
            if (count($players) > 1) {
                $topWords[] = [
                    'word' => $word,
                    'count' => count($players),
                    'players' => $players
                ];
            }
        }

        usort($topWords, function($a, $b) {
            return $b['count'] - $a['count'];
        });

        $state['round_top_words'] = array_slice($topWords, 0, 10);

        // Cambiar estado
        if ($state['round'] >= $state['total_rounds']) {
            $state['status'] = 'finished';
        } else {
            $state['status'] = 'round_ended';
        }

        if (saveGameState($gameId, $state)) {
            $response = [
                'success' => true,
                'message' => 'Ronda finalizada',
                'state' => $state
            ];
        }
        break;

    case 'reset_game':
        // Reiniciar juego
        if (!$gameId) {
            $response = ['success' => false, 'message' => 'game_id requerido'];
            break;
        }

        $state = loadGameState($gameId);

        if (!$state) {
            $response = ['success' => false, 'message' => 'Juego no encontrado'];
            break;
        }

        // Resetear pero mantener jugadores
        foreach ($state['players'] as $playerId => $player) {
            $state['players'][$playerId]['score'] = 0;
            $state['players'][$playerId]['status'] = 'connected';
            $state['players'][$playerId]['answers'] = [];
            $state['players'][$playerId]['round_results'] = [];
        }

        $state['round'] = 0;
        $state['status'] = 'waiting';
        $state['current_word'] = null;
        $state['round_started_at'] = null;
        $state['round_top_words'] = [];

        if (saveGameState($gameId, $state)) {
            $response = [
                'success' => true,
                'message' => 'Juego reiniciado',
                'state' => $state
            ];
        }
        break;

    case 'leave_game':
        // Salir del juego
        if (!$gameId || !$playerId) {
            $response = ['success' => false, 'message' => 'game_id y player_id requeridos'];
            break;
        }

        $state = loadGameState($gameId);

        if ($state && isset($state['players'][$playerId])) {
            unset($state['players'][$playerId]);

            if (saveGameState($gameId, $state)) {
                $response = [
                    'success' => true,
                    'message' => 'Saliste del juego'
                ];
            }
        } else {
            $response = ['success' => true, 'message' => 'Ya no estás en el juego'];
        }
        break;

    case 'get_state':
        // Obtener estado actual
        if (!$gameId) {
            $response = ['success' => false, 'message' => 'game_id requerido'];
            break;
        }

        $state = loadGameState($gameId);

        if ($state) {
            $response = [
                'success' => true,
                'state' => $state
            ];
        } else {
            $response = ['success' => false, 'message' => 'Juego no encontrado'];
        }
        break;

    case 'get_words':
        // Obtener lista de palabras
        $words = getAllWords();

        $response = [
            'success' => true,
            'words' => $words
        ];
        break;

    default:
        $response = ['success' => false, 'message' => 'Acción desconocida: ' . $action];
        break;
}

// Enviar respuesta
echo json_encode($response, JSON_UNESCAPED_UNICODE);
?>