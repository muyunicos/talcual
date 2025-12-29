<?php
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function notifyGameChanged($gameId, $isHostOnlyChange = false) {
    $notifyAll = GAME_STATES_DIR . '/' . $gameId . '_all.json';
    $notifyHost = GAME_STATES_DIR . '/' . $gameId . '_host.json';
    
    $allCounter = 0;
    if (file_exists($notifyAll)) {
        $content = @file_get_contents($notifyAll);
        if ($content && is_numeric($content)) {
            $allCounter = (int)$content;
        }
    }
    
    $allCounter++;
    @file_put_contents($notifyAll, (string)$allCounter, LOCK_EX);
    
    if ($isHostOnlyChange) {
        $hostCounter = 0;
        if (file_exists($notifyHost)) {
            $content = @file_get_contents($notifyHost);
            if ($content && is_numeric($content)) {
                $hostCounter = (int)$content;
            }
        }
        $hostCounter++;
        @file_put_contents($notifyHost, (string)$hostCounter, LOCK_EX);
    }
}

function checkRateLimit() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $cacheKey = 'rate_limit:' . md5($ip);
    $cacheFile = sys_get_temp_dir() . '/' . $cacheKey . '.txt';
    
    $limit = RATE_LIMIT_REQUESTS;
    $window = RATE_LIMIT_WINDOW;
    
    if (file_exists($cacheFile)) {
        $raw = file_get_contents($cacheFile);
        $data = json_decode($raw, true);

        if (!is_array($data) || !isset($data['timestamp'], $data['count'])) {
            $data = ['timestamp' => time(), 'count' => 0];
        }

        $elapsed = time() - (int)$data['timestamp'];
        
        if ($elapsed < $window) {
            $data['count']++;
            if ($data['count'] > $limit) {
                http_response_code(429);
                echo json_encode(['success' => false, 'message' => 'Rate limit exceeded']);
                exit;
            }
        } else {
            $data = ['timestamp' => time(), 'count' => 1];
        }
        file_put_contents($cacheFile, json_encode($data));
    } else {
        $data = ['timestamp' => time(), 'count' => 1];
        file_put_contents($cacheFile, json_encode($data));
    }
}

try {
    checkRateLimit();

    $inputRaw = file_get_contents('php://input');
    $input = json_decode($inputRaw, true);

    if (!is_array($input)) {
        echo json_encode(['success' => false, 'message' => 'JSON invalido']);
        exit;
    }

    $action = isset($input['action']) ? trim((string)$input['action']) : null;
    $gameId = sanitizeGameId($input['game_id'] ?? null);
    $playerId = sanitizePlayerId($input['player_id'] ?? null);

    logMessage("API Action: {$action} | game_id: {$gameId} | player_id: {$playerId}", 'DEBUG');

    $response = ['success' => false, 'message' => 'Accion no valida'];

    switch ($action) {

        case 'create_game':
            if (!$gameId || strlen($gameId) < 3) {
                $gameId = generateGameCode();
            } else {
                $existingState = loadGameState($gameId);
                if ($existingState) {
                    $gameId = generateGameCode();
                }
            }

            $totalRounds = intval($input['total_rounds'] ?? DEFAULT_TOTAL_ROUNDS);
            $roundDuration = intval($input['round_duration'] ?? DEFAULT_ROUND_DURATION);
            $minPlayers = intval($input['min_players'] ?? MIN_PLAYERS);
            
            if ($totalRounds < 1 || $totalRounds > 10) $totalRounds = DEFAULT_TOTAL_ROUNDS;
            if ($roundDuration < 30 || $roundDuration > 300) $roundDuration = DEFAULT_ROUND_DURATION;
            if ($minPlayers < 1 || $minPlayers > 6) $minPlayers = MIN_PLAYERS;

            $state = [
                'game_id' => $gameId,
                'players' => [],
                'round' => 0,
                'total_rounds' => $totalRounds,
                'status' => 'waiting',
                'current_word' => null,
                'current_category' => null,
                'round_duration' => $roundDuration,
                'round_started_at' => null,
                'round_start_at' => null,
                'min_players' => $minPlayers,
                'round_details' => [],
                'round_top_words' => [],
                'game_history' => [],
                'last_update' => time()
            ];

            if (saveGameState($gameId, $state)) {
                trackGameAction($gameId, 'game_created', []);
                notifyGameChanged($gameId, true);
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
            $playerColor = validatePlayerColor($input['color'] ?? null);

            if (strlen($playerName) < 2 || strlen($playerName) > 20) {
                $response = ['success' => false, 'message' => 'Nombre invalido'];
                break;
            }
            
            if (count($state['players']) >= MAX_PLAYERS) {
                $response = ['success' => false, 'message' => 'Sala llena'];
                break;
            }

            if (isset($state['players'][$playerId])) {
                $response = [
                    'success' => true,
                    'message' => 'Ya estas en el juego',
                    'state' => $state
                ];
                break;
            }

            $state['players'][$playerId] = [
                'id' => $playerId,
                'name' => $playerName,
                'color' => $playerColor,
                'score' => 0,
                'status' => 'connected',
                'disconnected' => false,
                'answers' => [],
                'round_results' => []
            ];

            $state['last_update'] = time();

            if (saveGameState($gameId, $state)) {
                trackGameAction($gameId, 'player_joined', ['player_name' => $playerName]);
                notifyGameChanged($gameId);
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
            // FIX #41: Mejorar manejo de errores con try-catch adicional
            try {
                if (!$gameId) {
                    $response = ['success' => false, 'message' => 'game_id requerido'];
                    break;
                }

                $state = loadGameState($gameId);

                if (!$state) {
                    $response = ['success' => false, 'message' => 'Juego no encontrado'];
                    break;
                }

                $activePlayers = array_filter($state['players'], function ($player) {
                    return empty($player['disconnected']);
                });

                $minPlayers = $state['min_players'] ?? MIN_PLAYERS;
                
                if (count($activePlayers) < $minPlayers) {
                    $response = ['success' => false, 'message' => 'Minimo ' . $minPlayers . ' jugadores'];
                    break;
                }

                $word = strtoupper(trim($input['word'] ?? ''));
                
                if (empty($word)) {
                    $word = getRandomWord();
                }
                
                $validation = validatePlayerWord($word);
                if (!$validation['valid']) {
                    $response = ['success' => false, 'message' => 'Palabra invalida'];
                    break;
                }
                
                $duration = intval($input['duration'] ?? $state['round_duration'] ?? DEFAULT_ROUND_DURATION);
                $totalRounds = intval($input['total_rounds'] ?? $state['total_rounds'] ?? DEFAULT_TOTAL_ROUNDS);
                
                if ($duration < 30 || $duration > 300) {
                    $duration = $state['round_duration'] ?? DEFAULT_ROUND_DURATION;
                }
                
                if ($totalRounds < 1 || $totalRounds > 10) {
                    $totalRounds = $state['total_rounds'] ?? DEFAULT_TOTAL_ROUNDS;
                }

                $countdownDuration = 4;
                $round_start_at = time() + $countdownDuration;

                $state['round']++;
                $state['status'] = 'playing';
                $state['current_word'] = $word;
                $state['current_category'] = null;
                $state['round_duration'] = $duration;
                $state['total_rounds'] = $totalRounds;
                $state['round_start_at'] = $round_start_at;
                $state['round_started_at'] = $round_start_at;
                $state['last_update'] = time();

                foreach ($state['players'] as $pId => $player) {
                    if (!empty($player['disconnected'])) {
                        continue;
                    }
                    $state['players'][$pId]['status'] = 'playing';
                    $state['players'][$pId]['answers'] = [];
                    $state['players'][$pId]['round_results'] = [];
                }

                if (saveGameState($gameId, $state)) {
                    trackGameAction($gameId, 'round_started', ['round' => $state['round']]);
                    notifyGameChanged($gameId);
                    $response = [
                        'success' => true,
                        'message' => 'Ronda iniciada',
                        'state' => $state
                    ];
                } else {
                    // FIX #41: Mensaje más específico cuando saveGameState falla
                    logMessage('[ERROR] start_round: saveGameState falló para ' . $gameId, 'ERROR');
                    $response = [
                        'success' => false,
                        'message' => 'Error guardando estado del juego. Intenta nuevamente.'
                    ];
                }
            } catch (Exception $e) {
                logMessage('Error en start_round: ' . $e->getMessage(), 'ERROR');
                $response = ['success' => false, 'message' => 'Error: ' . $e->getMessage()];
            }
            break;

        case 'submit_answers':
            if (!$gameId || !$playerId) {
                $response = ['success' => false, 'message' => 'game_id y player_id requeridos'];
                break;
            }

            $state = loadGameState($gameId);

            if (!$state || !isset($state['players'][$playerId])) {
                $response = ['success' => false, 'message' => 'Jugador no encontrado'];
                break;
            }

            if ($state['status'] !== 'playing') {
                $response = ['success' => false, 'message' => 'No hay ronda activa'];
                break;
            }

            $answers = $input['answers'] ?? [];
            $validAnswers = [];
            $errors = [];

            foreach ($answers as $word) {
                $trimmed = trim($word);
                if (empty($trimmed)) {
                    continue;
                }
                
                $validation = validatePlayerWord($trimmed, $state['current_word']);
                
                if ($validation['valid']) {
                    $normalized = strtoupper($trimmed);
                    
                    if (!in_array($normalized, $validAnswers, true)) {
                        $validAnswers[] = $normalized;
                    }
                } else {
                    $errors[] = $validation['error'];
                }
            }
            
            if (count($validAnswers) > MAX_WORDS_PER_PLAYER) {
                $validAnswers = array_slice($validAnswers, 0, MAX_WORDS_PER_PLAYER);
            }

            $state['players'][$playerId]['answers'] = $validAnswers;
            
            $hasMaxWords = count($validAnswers) >= MAX_WORDS_PER_PLAYER;
            $forcedPass = !empty($input['forced_pass']);
            
            if ($hasMaxWords || $forcedPass) {
                $state['players'][$playerId]['status'] = 'ready';
            }

            $state['last_update'] = time();

            if (saveGameState($gameId, $state)) {
                notifyGameChanged($gameId);
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
            if (!$gameId) {
                $response = ['success' => false, 'message' => 'game_id requerido'];
                break;
            }

            $state = loadGameState($gameId);

            if (!$state || $state['status'] !== 'playing') {
                $response = ['success' => false, 'message' => 'No hay ronda activa'];
                break;
            }

            $elapsed = time() - $state['round_started_at'];
            
            if ($elapsed < $state['round_duration'] - 5) {
                $state['round_duration'] = $elapsed + 5;
                $state['last_update'] = time();
                
                if (saveGameState($gameId, $state)) {
                    notifyGameChanged($gameId);
                    $response = [
                        'success' => true,
                        'message' => 'Timer acortado',
                        'state' => $state
                    ];
                }
            } else {
                $response = [
                    'success' => true,
                    'message' => 'Timer ya en ultimos 5 segundos',
                    'state' => $state
                ];
            }
            break;

        case 'end_round':
            if (!$gameId) {
                $response = ['success' => false, 'message' => 'game_id requerido'];
                break;
            }

            $state = loadGameState($gameId);

            if (!$state) {
                $response = ['success' => false, 'message' => 'Juego no encontrado'];
                break;
            }

            $wordCounts = [];
            $playerWords = [];

            foreach ($state['players'] as $pId => $player) {
                foreach ($player['answers'] as $word) {
                    $trimmed = trim($word);
                    if (empty($trimmed)) {
                        continue;
                    }
                    
                    $normalized = strtoupper($trimmed);

                    if (!isset($wordCounts[$normalized])) {
                        $wordCounts[$normalized] = [];
                    }

                    $wordCounts[$normalized][] = $player['name'];

                    if (!isset($playerWords[$pId])) {
                        $playerWords[$pId] = [];
                    }

                    $playerWords[$pId][] = $normalized;
                }
            }

            foreach ($state['players'] as $pId => $player) {
                $roundResults = [];
                $roundScore = 0;

                if (!empty($playerWords[$pId])) {
                    foreach ($playerWords[$pId] as $word) {
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

                $state['players'][$pId]['round_results'] = $roundResults;
                $state['players'][$pId]['score'] += $roundScore;
                $state['players'][$pId]['status'] = 'connected';
            }

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
            $state['last_update'] = time();

            if ($state['round'] >= $state['total_rounds']) {
                $state['status'] = 'finished';
                trackGameAction($gameId, 'game_finished', []);
            } else {
                $state['status'] = 'round_ended';
            }

            $state['round_start_at'] = null;

            if (saveGameState($gameId, $state)) {
                trackGameAction($gameId, 'round_ended', []);
                notifyGameChanged($gameId);
                $response = [
                    'success' => true,
                    'message' => 'Ronda finalizada',
                    'state' => $state
                ];
            }
            break;

        case 'reset_game':
            if (!$gameId) {
                $response = ['success' => false, 'message' => 'game_id requerido'];
                break;
            }

            $state = loadGameState($gameId);

            if (!$state) {
                $response = ['success' => false, 'message' => 'Juego no encontrado'];
                break;
            }

            foreach ($state['players'] as $pId => $player) {
                $state['players'][$pId]['score'] = 0;
                $state['players'][$pId]['status'] = 'connected';
                $state['players'][$pId]['disconnected'] = false;
                $state['players'][$pId]['answers'] = [];
                $state['players'][$pId]['round_results'] = [];
            }

            $state['round'] = 0;
            $state['status'] = 'waiting';
            $state['current_word'] = null;
            $state['current_category'] = null;
            $state['round_started_at'] = null;
            $state['round_start_at'] = null;
            $state['round_top_words'] = [];
            $state['last_update'] = time();

            if (saveGameState($gameId, $state)) {
                trackGameAction($gameId, 'game_reset', []);
                notifyGameChanged($gameId);
                $response = [
                    'success' => true,
                    'message' => 'Juego reiniciado',
                    'state' => $state
                ];
            }
            break;

        case 'leave_game':
            if (!$gameId || !$playerId) {
                $response = ['success' => false, 'message' => 'game_id y player_id requeridos'];
                break;
            }

            $state = loadGameState($gameId);

            if ($state && isset($state['players'][$playerId])) {
                $state['players'][$playerId]['disconnected'] = true;
                $state['last_update'] = time();

                if (saveGameState($gameId, $state)) {
                    trackGameAction($gameId, 'player_left', []);
                    notifyGameChanged($gameId);
                    $response = [
                        'success' => true,
                        'message' => 'Saliste del juego'
                    ];
                }
            } else {
                $response = ['success' => true, 'message' => 'Ya no estas en el juego'];
            }
            break;

        case 'update_player_name':
            if (!$gameId || !$playerId) {
                $response = ['success' => false, 'message' => 'game_id y player_id requeridos'];
                break;
            }
            
            $state = loadGameState($gameId);
            
            if (!$state || !isset($state['players'][$playerId])) {
                $response = ['success' => false, 'message' => 'Jugador no encontrado'];
                break;
            }
            
            $newName = trim($input['name'] ?? '');
            
            if (strlen($newName) < 2 || strlen($newName) > 20) {
                $response = ['success' => false, 'message' => 'Nombre invalido'];
                break;
            }
            
            $state['players'][$playerId]['name'] = $newName;
            $state['last_update'] = time();
            
            if (saveGameState($gameId, $state)) {
                trackGameAction($gameId, 'player_name_updated', []);
                notifyGameChanged($gameId);
                $response = [
                    'success' => true,
                    'message' => 'Nombre actualizado',
                    'state' => $state
                ];
            } else {
                $response = ['success' => false, 'message' => 'Error actualizando nombre'];
            }
            break;

        case 'get_state':
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
            $words = getAllWords();

            $response = [
                'success' => true,
                'words' => array_values($words)
            ];
            break;
            
        case 'get_stats':
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
            $response = ['success' => false, 'message' => 'Accion desconocida'];
            break;
    }

    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    logMessage('Error fatal: ' . $e->getMessage(), 'ERROR');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}
?>