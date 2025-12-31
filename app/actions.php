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

function loadRawDictionaryJson() {
    $file = defined('DICTIONARY_FILE') ? DICTIONARY_FILE : (__DIR__ . '/diccionario.json');

    if (!file_exists($file)) {
        return [];
    }

    $raw = @file_get_contents($file);
    $data = json_decode($raw ?: '', true);

    return is_array($data) ? $data : [];
}

function getPromptPoolFromDictionary($preferredCategory = null) {
    $data = loadRawDictionaryJson();

    if (empty($data)) {
        return ['category' => null, 'prompts' => ['JUEGO']];
    }

    if (isset($data['categorias']) && is_array($data['categorias'])) {
        $cats = array_keys($data['categorias']);
        if (empty($cats)) {
            return ['category' => null, 'prompts' => ['JUEGO']];
        }

        $cat = ($preferredCategory && isset($data['categorias'][$preferredCategory]))
            ? $preferredCategory
            : $cats[array_rand($cats)];

        $pool = (isset($data['categorias'][$cat]) && is_array($data['categorias'][$cat])) ? $data['categorias'][$cat] : [];
        $prompts = array_values(array_unique(array_filter(array_map(function ($p) {
            return is_string($p) ? trim($p) : '';
        }, $pool))));

        if (empty($prompts)) {
            $prompts = ['JUEGO'];
        }

        return ['category' => $cat, 'prompts' => $prompts];
    }

    $cats = array_values(array_filter(array_keys($data), function ($k) use ($data) {
        return is_array($data[$k]);
    }));

    if (empty($cats)) {
        return ['category' => null, 'prompts' => ['JUEGO']];
    }

    $cat = ($preferredCategory && isset($data[$preferredCategory])) ? $preferredCategory : $cats[array_rand($cats)];
    $node = $data[$cat];

    $prompts = [];
    if (is_array($node)) {
        foreach ($node as $item) {
            if (!is_array($item)) continue;
            foreach ($item as $prompt => $tips) {
                if (is_string($prompt)) {
                    $p = trim($prompt);
                    if ($p !== '') $prompts[] = $p;
                }
            }
        }
    }

    $prompts = array_values(array_unique($prompts));
    if (empty($prompts)) {
        $prompts = ['JUEGO'];
    }

    return ['category' => $cat, 'prompts' => $prompts];
}

function pickNonRepeatingPrompt($state, $preferredCategory = null) {
    $poolInfo = getPromptPoolFromDictionary($preferredCategory);
    $category = $poolInfo['category'];
    $prompts = $poolInfo['prompts'];

    $used = [];
    if (isset($state['used_prompts']) && is_array($state['used_prompts']) && $category !== null) {
        $used = $state['used_prompts'][$category] ?? [];
        if (!is_array($used)) $used = [];
    }

    $available = array_values(array_diff($prompts, $used));

    if (empty($available)) {
        $used = [];
        $available = $prompts;
    }

    $prompt = !empty($available) ? (string)$available[array_rand($available)] : 'JUEGO';

    $used[] = $prompt;

    if (count($used) > 500) {
        $used = array_slice($used, -500);
    }

    $newUsedPrompts = (isset($state['used_prompts']) && is_array($state['used_prompts'])) ? $state['used_prompts'] : [];
    if ($category !== null) {
        $newUsedPrompts[$category] = $used;
    }

    return ['category' => $category, 'prompt' => $prompt, 'used_prompts' => $newUsedPrompts];
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
            if ($minPlayers < MIN_PLAYERS || $minPlayers > MAX_PLAYERS) $minPlayers = MIN_PLAYERS;

            $selectedCategory = isset($input['category']) ? trim((string)$input['category']) : null;
            if ($selectedCategory === '') $selectedCategory = null;

            $serverNow = intval(microtime(true) * 1000);
            $state = [
                'game_id' => $gameId,
                'players' => [],
                'round' => 0,
                'total_rounds' => $totalRounds,
                'status' => 'waiting',
                'current_word' => null,
                'current_category' => null,
                'selected_category' => $selectedCategory,
                'used_prompts' => [],
                'round_duration' => $roundDuration * 1000,
                'round_started_at' => null,
                'round_starts_at' => null,
                'round_ends_at' => null,
                'countdown_duration' => INITIAL_TIMER * 1000,
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
                    'server_now' => $serverNow,
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
                    'server_now' => intval(microtime(true) * 1000),
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
                    'server_now' => intval(microtime(true) * 1000),
                    'state' => $state
                ];
            } else {
                $response = ['success' => false, 'message' => 'Error al unirse'];
            }
            break;

        case 'start_round':
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

                $prompt = trim((string)($input['word'] ?? ''));

                $categoryFromRequest = isset($input['category']) ? trim((string)$input['category']) : null;
                if ($categoryFromRequest === '') $categoryFromRequest = null;

                $preferredCategory = $categoryFromRequest ?: ($state['selected_category'] ?? null);
                if ($preferredCategory === '') $preferredCategory = null;

                if ($prompt === '') {
                    $picked = pickNonRepeatingPrompt($state, $preferredCategory);
                    $prompt = (string)($picked['prompt'] ?? 'JUEGO');
                    $preferredCategory = $picked['category'] ?? $preferredCategory;
                    $state['used_prompts'] = $picked['used_prompts'] ?? ($state['used_prompts'] ?? []);
                }

                $duration = intval($input['duration'] ?? $state['round_duration'] ?? DEFAULT_ROUND_DURATION * 1000);
                $totalRounds = intval($input['total_rounds'] ?? $state['total_rounds'] ?? DEFAULT_TOTAL_ROUNDS);

                if ($duration < 30000 || $duration > 300000) {
                    $duration = ($state['round_duration'] ?? DEFAULT_ROUND_DURATION * 1000);
                }

                if ($totalRounds < 1 || $totalRounds > 10) {
                    $totalRounds = $state['total_rounds'] ?? DEFAULT_TOTAL_ROUNDS;
                }

                $serverNow = intval(microtime(true) * 1000);
                $countdownDuration = INITIAL_TIMER * 1000;
                $roundStartsAt = $serverNow;
                $roundStartedAt = $roundStartsAt + $countdownDuration;
                $roundEndsAt = $roundStartedAt + $duration;

                $state['round']++;
                $state['status'] = 'playing';
                $state['current_word'] = $prompt;
                $state['current_category'] = $preferredCategory;
                $state['round_duration'] = $duration;
                $state['total_rounds'] = $totalRounds;
                $state['countdown_duration'] = $countdownDuration;
                $state['round_starts_at'] = $roundStartsAt;
                $state['round_started_at'] = $roundStartedAt;
                $state['round_ends_at'] = $roundEndsAt;
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
                        'server_now' => $serverNow,
                        'state' => $state
                    ];
                } else {
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
                $validAnswers[] = strtoupper($trimmed);
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
                    'server_now' => intval(microtime(true) * 1000),
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

            $roundResults = $input['round_results'] ?? [];
            $topWords = $input['top_words'] ?? [];
            $scoreDeltas = $input['score_deltas'] ?? [];

            foreach ($state['players'] as $pId => $player) {
                if (isset($roundResults[$pId])) {
                    $state['players'][$pId]['round_results'] = $roundResults[$pId];
                }
                if (isset($scoreDeltas[$pId])) {
                    $state['players'][$pId]['score'] = intval($state['players'][$pId]['score'] ?? 0) + intval($scoreDeltas[$pId]);
                }
                $state['players'][$pId]['status'] = 'connected';
            }

            if (!empty($topWords)) {
                $state['round_top_words'] = $topWords;
            }

            $state['last_update'] = time();

            if (($state['round'] ?? 0) >= ($state['total_rounds'] ?? DEFAULT_TOTAL_ROUNDS)) {
                $state['status'] = 'finished';
                trackGameAction($gameId, 'game_finished', []);
            } else {
                $state['status'] = 'round_ended';
            }

            $state['round_started_at'] = null;
            $state['round_starts_at'] = null;
            $state['round_ends_at'] = null;
            $state['countdown_duration'] = null;

            if (saveGameState($gameId, $state)) {
                trackGameAction($gameId, 'round_ended', []);
                notifyGameChanged($gameId);
                $response = [
                    'success' => true,
                    'message' => 'Ronda finalizada',
                    'server_now' => intval(microtime(true) * 1000),
                    'state' => $state
                ];
            } else {
                $response = ['success' => false, 'message' => 'Error guardando resultados'];
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
            $state['round_starts_at'] = null;
            $state['round_ends_at'] = null;
            $state['countdown_duration'] = null;
            $state['round_top_words'] = [];
            $state['last_update'] = time();

            if (saveGameState($gameId, $state)) {
                trackGameAction($gameId, 'game_reset', []);
                notifyGameChanged($gameId);
                $response = [
                    'success' => true,
                    'message' => 'Juego reiniciado',
                    'server_now' => intval(microtime(true) * 1000),
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
                    'server_now' => intval(microtime(true) * 1000),
                    'state' => $state
                ];
            } else {
                $response = ['success' => false, 'message' => 'Error actualizando nombre'];
            }
            break;

        case 'update_player_color':
            if (!$gameId || !$playerId) {
                $response = ['success' => false, 'message' => 'game_id y player_id requeridos'];
                break;
            }

            $state = loadGameState($gameId);

            if (!$state || !isset($state['players'][$playerId])) {
                $response = ['success' => false, 'message' => 'Jugador no encontrado'];
                break;
            }

            $newColor = validatePlayerColor($input['color'] ?? null);

            if (!$newColor) {
                $response = ['success' => false, 'message' => 'Color invalido'];
                break;
            }

            $state['players'][$playerId]['color'] = $newColor;
            $state['last_update'] = time();

            if (saveGameState($gameId, $state)) {
                trackGameAction($gameId, 'player_color_updated', []);
                notifyGameChanged($gameId);
                $response = [
                    'success' => true,
                    'message' => 'Color actualizado',
                    'server_now' => intval(microtime(true) * 1000),
                    'state' => $state
                ];
            } else {
                $response = ['success' => false, 'message' => 'Error actualizando color'];
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
                    'server_now' => intval(microtime(true) * 1000),
                    'state' => $state
                ];
            } else {
                $response = ['success' => false, 'message' => 'Juego no encontrado'];
            }
            break;

        case 'get_config':
            $response = [
                'success' => true,
                'server_now' => intval(microtime(true) * 1000),
                'config' => [
                    'initial_timer' => INITIAL_TIMER,
                    'default_total_rounds' => DEFAULT_TOTAL_ROUNDS,
                    'default_round_duration' => DEFAULT_ROUND_DURATION,
                    'min_players' => MIN_PLAYERS,
                    'max_players' => MAX_PLAYERS,
                    'max_words_per_player' => MAX_WORDS_PER_PLAYER
                ]
            ];
            break;

        case 'get_words':
            $words = getAllWords();

            $response = [
                'success' => true,
                'server_now' => intval(microtime(true) * 1000),
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
                'server_now' => intval(microtime(true) * 1000),
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