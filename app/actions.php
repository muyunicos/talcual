<?php
// Unánimo Party - API Actions
// Maneja todas las acciones del juego
// MEJORAS: #1 (seguridad), #6 (validaciones), #11 (eliminar redundancia), #14 (validar palabras), #21 (feedback)
// NUEVAS: Countdown sincronizado y acortar timer

require_once __DIR__ . '/config.php';

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
$gameId = sanitizeGameId($input['game_id'] ?? null);  // MEJORA #1: Sanitizar
$playerId = sanitizePlayerId($input['player_id'] ?? null);  // MEJORA #1: Sanitizar

// Log
logMessage("API Action: {$action} | Game: {$gameId} | Player: {$playerId}", 'DEBUG');

$response = ['success' => false, 'message' => 'Acción no válida'];

switch ($action) {

    case 'create_game':
        // Crear nueva partida
        // FIX #1: Respetar game_id si es válido, sino generar uno
        if (!$gameId || strlen($gameId) < 3) {
            // Si no se proporciona código válido, generar uno aleatorio
            $gameId = generateGameCode();
            logMessage("No game_id proporcionado, generando: {$gameId}", 'DEBUG');
        } else {
            // Validar que sea único
            $existingState = loadGameState($gameId);
            if ($existingState) {
                // El código ya existe, generar uno nuevo
                $oldGameId = $gameId;
                $gameId = generateGameCode();
                logMessage("Game_id '{$oldGameId}' ya existe, generando nuevo: {$gameId}", 'DEBUG');
            } else {
                logMessage("Usando game_id proporcionado: {$gameId}", 'DEBUG');
            }
        }

        $state = [
            'game_id' => $gameId,
            'players' => [],
            'round' => 0,
            'total_rounds' => DEFAULT_TOTAL_ROUNDS,
            'status' => 'waiting',
            'current_word' => null,
            'round_duration' => DEFAULT_ROUND_DURATION,
            'round_started_at' => null,
            'round_start_at' => null,  // NUEVO: Timestamp futuro para countdown
            'round_details' => [],
            'round_top_words' => [],
            'game_history' => []
        ];

        if (saveGameState($gameId, $state)) {
            trackGameAction($gameId, 'game_created', []);
            $response = [
                'success' => true,
                'game_id' => $gameId,  // ✅ DEVUELVE EL GAME_ID CORRECTO
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

        $playerName = trim($input['name'] ?? 'Jugador');
        $playerColor = validatePlayerColor($input['color'] ?? null); // MEJORA #7: Validar color

        // Validar nombre
        if (strlen($playerName) < 2 || strlen($playerName) > 20) {
            $response = ['success' => false, 'message' => 'Nombre inválido (2-20 caracteres)'];
            break;
        }
        
        // Validar máximo de jugadores (MEJORA #6)
        if (count($state['players']) >= MAX_PLAYERS) {
            $response = ['success' => false, 'message' => 'Sala llena (máximo ' . MAX_PLAYERS . ' jugadores)'];
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
            'color' => $playerColor,
            'score' => 0,
            'status' => 'connected',
            'answers' => [],
            'round_results' => []
        ];

        if (saveGameState($gameId, $state)) {
            trackGameAction($gameId, 'player_joined', ['player_name' => $playerName]);
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
        // Iniciar nueva ronda con countdown sincronizado
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
        if (count($state['players']) < MIN_PLAYERS) {
            $response = ['success' => false, 'message' => 'Mínimo ' . MIN_PLAYERS . ' jugadores'];
            break;
        }

        $word = strtoupper(trim($input['word'] ?? ''));
        
        // Si no se proporciona palabra, seleccionar una aleatoria
        if (empty($word)) {
            $word = getRandomWord();
        }
        
        // Validar palabra
        $validation = validatePlayerWord($word);
        if (!$validation['valid']) {
            $response = ['success' => false, 'message' => 'Palabra inválida: ' . $validation['error']];
            break;
        }
        
        $duration = intval($input['duration'] ?? DEFAULT_ROUND_DURATION);
        
        // Validar duración
        if ($duration < 30 || $duration > 300) {
            $duration = DEFAULT_ROUND_DURATION;
        }

        // NUEVO: Calcular timestamp futuro para countdown sincronizado
        // 4 segundos de countdown (3, 2, 1, + 1 segundo de margen)
        $countdownDuration = 4;
        $round_start_at = time() + $countdownDuration;

        // Incrementar ronda
        $state['round']++;
        $state['status'] = 'playing';
        $state['current_word'] = $word;
        $state['round_duration'] = $duration;
        $state['round_start_at'] = $round_start_at;  // NUEVO: Timestamp futuro
        $state['round_started_at'] = $round_start_at; // Se usará cuando realmente inicie

        // Resetear jugadores para nueva ronda
        foreach ($state['players'] as $playerId => $player) {
            $state['players'][$playerId]['status'] = 'playing';
            $state['players'][$playerId]['answers'] = [];
            $state['players'][$playerId]['round_results'] = [];
        }

        if (saveGameState($gameId, $state)) {
            trackGameAction($gameId, 'round_started', ['round' => $state['round'], 'word' => $word]);
            $response = [
                'success' => true,
                'message' => 'Ronda iniciada',
                'state' => $state
            ];
        }
        break;

    case 'submit_answers':
        // Enviar respuestas del jugador (ahora se llama automáticamente con cada palabra)
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
        $validAnswers = [];
        $errors = [];

        // Validar cada respuesta (MEJORA #14)
        foreach ($answers as $word) {
            // FIX: Filtrar strings vacíos
            $trimmed = trim($word);
            if (empty($trimmed)) {
                continue; // Saltar palabras vacías
            }
            
            $validation = validatePlayerWord($trimmed, $state['current_word']);
            
            if ($validation['valid']) {
                $normalized = strtoupper($trimmed);
                
                // Evitar duplicados
                if (!in_array($normalized, $validAnswers)) {
                    $validAnswers[] = $normalized;
                }
            } else {
                $errors[] = $validation['error'];
            }
        }
        
        // Limitar cantidad de palabras (MEJORA #6)
        if (count($validAnswers) > MAX_WORDS_PER_PLAYER) {
            $validAnswers = array_slice($validAnswers, 0, MAX_WORDS_PER_PLAYER);
        }

        // Guardar respuestas
        $state['players'][$playerId]['answers'] = $validAnswers;
        
        // NUEVO: Marcar como ready solo si tiene el máximo de palabras o presionó PASO
        $hasMaxWords = count($validAnswers) >= MAX_WORDS_PER_PLAYER;
        $forcedPass = $input['forced_pass'] ?? false;
        
        if ($hasMaxWords || $forcedPass) {
            $state['players'][$playerId]['status'] = 'ready';
        }

        if (saveGameState($gameId, $state)) {
            $response = [
                'success' => true,
                'message' => 'Respuestas guardadas',
                'valid_answers' => count($validAnswers),
                'errors' => $errors,
                'state' => $state
            ];
        }
        break;

    case 'shorten_round':
        // NUEVO: Acortar timer a 5 segundos cuando todos terminaron
        if (!$gameId) {
            $response = ['success' => false, 'message' => 'game_id requerido'];
            break;
        }

        $state = loadGameState($gameId);

        if (!$state || $state['status'] !== 'playing') {
            $response = ['success' => false, 'message' => 'No hay ronda activa'];
            break;
        }

        // Calcular tiempo transcurrido
        $elapsed = time() - $state['round_started_at'];
        
        // Solo acortar si quedan más de 5 segundos
        if ($elapsed < $state['round_duration'] - 5) {
            $state['round_duration'] = $elapsed + 5;
            
            if (saveGameState($gameId, $state)) {
                logMessage("Timer acortado a 5 segundos en game {$gameId}", 'INFO');
                $response = [
                    'success' => true,
                    'message' => 'Timer acortado a 5 segundos',
                    'state' => $state
                ];
            }
        } else {
            $response = [
                'success' => true,
                'message' => 'Timer ya está en los últimos 5 segundos',
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
                // FIX: Filtrar palabras vacías
                $trimmed = trim($word);
                if (empty($trimmed)) {
                    continue;
                }
                
                $normalized = strtoupper($trimmed);

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
            trackGameAction($gameId, 'game_finished', ['total_rounds' => $state['round']]);
        } else {
            $state['status'] = 'round_ended';
        }

        // Resetear round_start_at
        $state['round_start_at'] = null;

        if (saveGameState($gameId, $state)) {
            trackGameAction($gameId, 'round_ended', ['round' => $state['round']]);
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
        $state['round_start_at'] = null;
        $state['round_top_words'] = [];

        if (saveGameState($gameId, $state)) {
            trackGameAction($gameId, 'game_reset', []);
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
            $playerName = $state['players'][$playerId]['name'];
            unset($state['players'][$playerId]);

            if (saveGameState($gameId, $state)) {
                trackGameAction($gameId, 'player_left', ['player_name' => $playerName]);
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
            'words' => array_values($words) // Reindexar para JSON
        ];
        break;
        
    case 'get_stats':
        // Obtener estadísticas (solo en modo desarrollo)
        if (!DEV_MODE) {
            $response = ['success' => false, 'message' => 'No disponible'];
            break;
        }
        
        $response = [
            'success' => true,
            'stats' => [
                'dictionary' => getDictionaryStats(),
                'active_games' => count(getActiveCodes()),
                'dev_mode' => DEV_MODE
            ]
        ];
        break;

    default:
        $response = ['success' => false, 'message' => 'Acción desconocida: ' . $action];
        break;
}

// Enviar respuesta
echo json_encode($response, JSON_UNESCAPED_UNICODE);
?>