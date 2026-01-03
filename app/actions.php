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
                echo json_encode(['success' => false, 'message' => 'Límite de solicitudes excedido']);
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

function pickNonRepeatingPrompt($state, $preferredCategory = null) {
    $category = $preferredCategory;
    
    if (!$category) {
        $categories = getCategories();
        if (empty($categories)) {
            return ['category' => null, 'prompt' => 'JUEGO', 'used_prompts' => $state['used_prompts'] ?? []];
        }
        $category = $categories[array_rand($categories)];
    }
    
    $card = getTopicCard($category);
    $question = $card['question'];
    
    if (empty($question)) {
        return ['category' => $category, 'prompt' => 'JUEGO', 'used_prompts' => $state['used_prompts'] ?? []];
    }

    $used = [];
    if (isset($state['used_prompts']) && is_array($state['used_prompts'])) {
        $used = $state['used_prompts'][$category] ?? [];
        if (!is_array($used)) $used = [];
    }

    $cleanPrompt = cleanWordPrompt($question);
    $used[] = $cleanPrompt;

    if (count($used) > 500) {
        $used = array_slice($used, -500);
    }

    $newUsedPrompts = (isset($state['used_prompts']) && is_array($state['used_prompts'])) ? $state['used_prompts'] : [];
    $newUsedPrompts[$category] = $used;

    return ['category' => $category, 'prompt' => $cleanPrompt, 'used_prompts' => $newUsedPrompts];
}

function handleGetGameCandidates($input) {
    $categories = getCategories();
    
    if (empty($categories)) {
        return ['success' => false, 'message' => 'No hay categorías disponibles'];
    }
    
    $usedCodes = getActiveCodes();
    $candidates = [];
    $maxCategoryAttempts = 10;
    
    foreach ($categories as $category) {
        $categoryAttempts = 0;
        $code = null;
        
        while ($categoryAttempts < $maxCategoryAttempts) {
            $word = getRandomWordByCategoryFiltered($category, MAX_CODE_LENGTH);
            
            if (!$word || in_array($word, $usedCodes)) {
                $categoryAttempts++;
                continue;
            }
            
            $code = $word;
            break;
        }
        
        if ($code) {
            $candidates[] = [
                'category' => $category,
                'code' => $code
            ];
            $usedCodes[] = $code;
        }
    }
    
    if (empty($candidates)) {
        return ['success' => false, 'message' => 'No se pudieron generar códigos para las categorías'];
    }
    
    return [
        'success' => true,
        'server_now' => intval(microtime(true) * 1000),
        'candidates' => $candidates
    ];
}

function handleCreateGame($input) {
    $gameId = sanitizeGameId($input['game_id'] ?? null);
    $requestedCategory = isset($input['category']) ? trim((string)$input['category']) : null;
    if ($requestedCategory === '') $requestedCategory = null;

    if ($gameId) {
        $existingState = loadGameState($gameId);
        if ($existingState) {
            return ['success' => false, 'message' => 'El código de sala ya está en uso'];
        }
        
        if ($requestedCategory) {
            $availableCategories = getCategories();
            if (!in_array($requestedCategory, $availableCategories)) {
                return ['success' => false, 'message' => 'Categoría no válida'];
            }
        }
    } else {
        $gameId = generateGameCode();
    }

    $totalRounds = intval($input['total_rounds'] ?? TOTAL_ROUNDS);
    $roundDuration = intval($input['round_duration'] ?? ROUND_DURATION);
    $minPlayers = intval($input['min_players'] ?? MIN_PLAYERS);

    if ($totalRounds < 1 || $totalRounds > 10) $totalRounds = TOTAL_ROUNDS;
    if ($roundDuration < 30 || $roundDuration > 300) $roundDuration = ROUND_DURATION;
    if ($minPlayers < MIN_PLAYERS || $minPlayers > MAX_PLAYERS) $minPlayers = MIN_PLAYERS;

    $serverNow = intval(microtime(true) * 1000);
    
    $initialState = [
        'game_id' => $gameId,
        'players' => [],
        'round' => 0,
        'total_rounds' => $totalRounds,
        'status' => 'waiting',
        'current_prompt' => null,
        'current_category' => null,
        'selected_category' => $requestedCategory,
        'used_prompts' => [],
        'round_duration' => $roundDuration * 1000,
        'round_started_at' => null,
        'round_starts_at' => null,
        'round_ends_at' => null,
        'countdown_duration' => START_COUNTDOWN * 1000,
        'min_players' => $minPlayers,
        'round_details' => [],
        'round_top_words' => [],
        'game_history' => [],
        'roundData' => null,
        'last_update' => time()
    ];
    
    $state = $initialState;

    if (saveGameState($gameId, $state)) {
        trackGameAction($gameId, 'game_created', []);
        notifyGameChanged($gameId, true);
        return [
            'success' => true,
            'game_id' => $gameId,
            'server_now' => $serverNow,
            'state' => $state
        ];
    } else {
        return ['success' => false, 'message' => 'Error al crear juego'];
    }
}

function handleJoinGame($input) {
    $gameId = sanitizeGameId($input['game_id'] ?? null);
    $playerId = sanitizePlayerId($input['player_id'] ?? null);

    if (!$gameId || !$playerId) {
        return ['success' => false, 'message' => 'game_id y player_id requeridos'];
    }

    $state = loadGameState($gameId);

    if (!$state) {
        return ['success' => false, 'message' => 'Juego no encontrado'];
    }

    $playerName = trim($input['name'] ?? 'Jugador');
    $playerColor = validatePlayerColor($input['color'] ?? null);

    if (strlen($playerName) < 2 || strlen($playerName) > 20) {
        return ['success' => false, 'message' => 'Nombre inválido'];
    }

    if (count($state['players']) >= MAX_PLAYERS) {
        return ['success' => false, 'message' => 'Sala llena'];
    }

    if (isset($state['players'][$playerId])) {
        return [
            'success' => true,
            'message' => 'Ya estás en el juego',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
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
        return [
            'success' => true,
            'message' => 'Te uniste al juego',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    } else {
        return ['success' => false, 'message' => 'Error al unirse'];
    }
}

function handleStartRound($input) {
    $gameId = sanitizeGameId($input['game_id'] ?? null);

    if (!$gameId) {
        return ['success' => false, 'message' => 'game_id requerido'];
    }

    $state = loadGameState($gameId);

    if (!$state) {
        return ['success' => false, 'message' => 'Juego no encontrado'];
    }

    $activePlayers = array_filter($state['players'], function ($player) {
        return empty($player['disconnected']);
    });

    $minPlayers = $state['min_players'] ?? MIN_PLAYERS;

    if (count($activePlayers) < $minPlayers) {
        return ['success' => false, 'message' => 'Mínimo ' . $minPlayers . ' jugadores'];
    }

    $categoryFromRequest = isset($input['category']) ? trim((string)$input['category']) : null;
    if ($categoryFromRequest === '') $categoryFromRequest = null;

    $preferredCategory = $categoryFromRequest ?: ($state['selected_category'] ?? null);
    if ($preferredCategory === '') $preferredCategory = null;
    
    if (!$preferredCategory) {
        $categories = getCategories();
        if (!empty($categories)) {
            $preferredCategory = $categories[array_rand($categories)];
        }
    }
    
    $card = getTopicCard($preferredCategory);
    $roundQuestion = $card['question'];
    $commonAnswers = $card['answers'];

    $duration = intval($input['duration'] ?? $state['round_duration'] ?? ROUND_DURATION * 1000);
    $totalRounds = intval($input['total_rounds'] ?? $state['total_rounds'] ?? TOTAL_ROUNDS);

    if ($duration < 30000 || $duration > 300000) {
        $duration = ($state['round_duration'] ?? ROUND_DURATION * 1000);
    }

    if ($totalRounds < 1 || $totalRounds > 10) {
        $totalRounds = $state['total_rounds'] ?? TOTAL_ROUNDS;
    }

    $serverNow = intval(microtime(true) * 1000);
    $countdownDuration = START_COUNTDOWN * 1000;
    $roundStartsAt = $serverNow;
    $roundStartedAt = $roundStartsAt + $countdownDuration;
    $roundEndsAt = $roundStartedAt + $duration;

    $state['round']++;
    $state['status'] = 'playing';
    $state['current_prompt'] = $roundQuestion;
    $state['current_category'] = $preferredCategory ?: 'Sin categoría';
    $state['round_duration'] = $duration;
    $state['total_rounds'] = $totalRounds;
    $state['countdown_duration'] = $countdownDuration;
    $state['round_starts_at'] = $roundStartsAt;
    $state['round_started_at'] = $roundStartedAt;
    $state['round_ends_at'] = $roundEndsAt;
    
    $state['roundData'] = [
        'roundQuestion' => $roundQuestion,
        'validMatches' => $commonAnswers
    ];
    
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
        return [
            'success' => true,
            'message' => 'Ronda iniciada',
            'server_now' => $serverNow,
            'state' => $state
        ];
    } else {
        logMessage('[ERROR] start_round: saveGameState falló para ' . $gameId, 'ERROR');
        return [
            'success' => false,
            'message' => 'Error guardando estado del juego. Inténtalo nuevamente.'
        ];
    }
}

function handleSubmitAnswers($input) {
    $gameId = sanitizeGameId($input['game_id'] ?? null);
    $playerId = sanitizePlayerId($input['player_id'] ?? null);

    if (!$gameId || !$playerId) {
        return ['success' => false, 'message' => 'game_id y player_id requeridos'];
    }

    $state = loadGameState($gameId);

    if (!$state || !isset($state['players'][$playerId])) {
        return ['success' => false, 'message' => 'Jugador no encontrado'];
    }

    if ($state['status'] !== 'playing') {
        return ['success' => false, 'message' => 'No hay ronda activa'];
    }

    $answers = $input['answers'] ?? [];
    $validAnswers = [];

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
        return [
            'success' => true,
            'message' => 'Respuestas guardadas',
            'valid_answers' => count($validAnswers),
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    return ['success' => false, 'message' => 'Error al guardar respuestas'];
}

function handleEndRound($input) {
    $gameId = sanitizeGameId($input['game_id'] ?? null);

    if (!$gameId) {
        return ['success' => false, 'message' => 'game_id requerido'];
    }

    $state = loadGameState($gameId);

    if (!$state) {
        return ['success' => false, 'message' => 'Juego no encontrado'];
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

    if (($state['round'] ?? 0) >= ($state['total_rounds'] ?? TOTAL_ROUNDS)) {
        $state['status'] = 'finished';
        $state['roundData'] = null;
        trackGameAction($gameId, 'game_finished', []);
    } else {
        $state['status'] = 'round_ended';
        $state['roundData'] = null;
    }

    $state['round_started_at'] = null;
    $state['round_starts_at'] = null;
    $state['round_ends_at'] = null;
    $state['countdown_duration'] = null;

    if (saveGameState($gameId, $state)) {
        trackGameAction($gameId, 'round_ended', []);
        notifyGameChanged($gameId);
        return [
            'success' => true,
            'message' => 'Ronda finalizada',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    } else {
        return ['success' => false, 'message' => 'Error guardando resultados'];
    }
}

function handleResetGame($input) {
    $gameId = sanitizeGameId($input['game_id'] ?? null);

    if (!$gameId) {
        return ['success' => false, 'message' => 'game_id requerido'];
    }

    $state = loadGameState($gameId);

    if (!$state) {
        return ['success' => false, 'message' => 'Juego no encontrado'];
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
    $state['current_prompt'] = null;
    $state['current_category'] = null;
    $state['round_started_at'] = null;
    $state['round_starts_at'] = null;
    $state['round_ends_at'] = null;
    $state['countdown_duration'] = null;
    $state['round_top_words'] = [];
    $state['roundData'] = null;
    $state['last_update'] = time();

    if (saveGameState($gameId, $state)) {
        trackGameAction($gameId, 'game_reset', []);
        notifyGameChanged($gameId);
        return [
            'success' => true,
            'message' => 'Juego reiniciado',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    return ['success' => false, 'message' => 'Error al reiniciar juego'];
}

function handleUpdateRoundTimer($input) {
    $gameId = sanitizeGameId($input['game_id'] ?? null);

    if (!$gameId) {
        return ['success' => false, 'message' => 'game_id requerido'];
    }

    $state = loadGameState($gameId);

    if (!$state) {
        return ['success' => false, 'message' => 'Juego no encontrado'];
    }

    if ($state['status'] !== 'playing') {
        return ['success' => false, 'message' => 'No hay ronda en curso'];
    }

    $newEndTime = intval($input['new_end_time'] ?? 0);

    if ($newEndTime <= 0) {
        return ['success' => false, 'message' => 'Tiempo inválido'];
    }

    $state['round_ends_at'] = $newEndTime;
    $newDuration = $newEndTime - ($state['round_started_at'] ?? 0);
    if ($newDuration > 0) {
        $state['round_duration'] = $newDuration;
    }

    $state['last_update'] = time();

    if (saveGameState($gameId, $state)) {
        trackGameAction($gameId, 'round_timer_updated', ['new_end_time' => $newEndTime]);
        notifyGameChanged($gameId);
        return [
            'success' => true,
            'message' => 'Temporizador actualizado',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    } else {
        return ['success' => false, 'message' => 'Error actualizando temporizador'];
    }
}

function handleLeaveGame($input) {
    $gameId = sanitizeGameId($input['game_id'] ?? null);
    $playerId = sanitizePlayerId($input['player_id'] ?? null);

    if (!$gameId || !$playerId) {
        return ['success' => false, 'message' => 'game_id y player_id requeridos'];
    }

    $state = loadGameState($gameId);

    if ($state && isset($state['players'][$playerId])) {
        $state['players'][$playerId]['disconnected'] = true;
        $state['last_update'] = time();

        if (saveGameState($gameId, $state)) {
            trackGameAction($gameId, 'player_left', []);
            notifyGameChanged($gameId);
            return [
                'success' => true,
                'message' => 'Saliste del juego'
            ];
        }
    } else {
        return ['success' => true, 'message' => 'Ya no estás en el juego'];
    }

    return ['success' => false, 'message' => 'Error al salir del juego'];
}

function handleUpdatePlayerName($input) {
    $gameId = sanitizeGameId($input['game_id'] ?? null);
    $playerId = sanitizePlayerId($input['player_id'] ?? null);

    if (!$gameId || !$playerId) {
        return ['success' => false, 'message' => 'game_id y player_id requeridos'];
    }

    $state = loadGameState($gameId);

    if (!$state || !isset($state['players'][$playerId])) {
        return ['success' => false, 'message' => 'Jugador no encontrado'];
    }

    $newName = trim($input['name'] ?? '');

    if (strlen($newName) < 2 || strlen($newName) > 20) {
        return ['success' => false, 'message' => 'Nombre inválido'];
    }

    $state['players'][$playerId]['name'] = $newName;
    $state['last_update'] = time();

    if (saveGameState($gameId, $state)) {
        trackGameAction($gameId, 'player_name_updated', []);
        notifyGameChanged($gameId);
        return [
            'success' => true,
            'message' => 'Nombre actualizado',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    } else {
        return ['success' => false, 'message' => 'Error actualizando nombre'];
    }
}

function handleUpdatePlayerColor($input) {
    $gameId = sanitizeGameId($input['game_id'] ?? null);
    $playerId = sanitizePlayerId($input['player_id'] ?? null);

    if (!$gameId || !$playerId) {
        return ['success' => false, 'message' => 'game_id y player_id requeridos'];
    }

    $state = loadGameState($gameId);

    if (!$state || !isset($state['players'][$playerId])) {
        return ['success' => false, 'message' => 'Jugador no encontrado'];
    }

    $newColor = validatePlayerColor($input['color'] ?? null);

    if (!$newColor) {
        return ['success' => false, 'message' => 'Color inválido'];
    }

    $state['players'][$playerId]['color'] = $newColor;
    $state['last_update'] = time();

    if (saveGameState($gameId, $state)) {
        trackGameAction($gameId, 'player_color_updated', []);
        notifyGameChanged($gameId);
        return [
            'success' => true,
            'message' => 'Color actualizado',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    } else {
        return ['success' => false, 'message' => 'Error actualizando color'];
    }
}

function handleGetState($input) {
    $gameId = sanitizeGameId($input['game_id'] ?? null);

    if (!$gameId) {
        return ['success' => false, 'message' => 'game_id requerido'];
    }

    $state = loadGameState($gameId);

    if ($state) {
        return [
            'success' => true,
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    } else {
        return ['success' => false, 'message' => 'Juego no encontrado'];
    }
}

function handleGetConfig() {
    return [
        'success' => true,
        'server_now' => intval(microtime(true) * 1000),
        'config' => [
            'round_duration' => ROUND_DURATION,
            'TOTAL_ROUNDS' => TOTAL_ROUNDS,
            'max_words_per_player' => MAX_WORDS_PER_PLAYER,
            'max_code_length' => MAX_CODE_LENGTH,
            'min_players' => MIN_PLAYERS,
            'max_players' => MAX_PLAYERS,
            'start_countdown' => START_COUNTDOWN,
            'max_word_length' => MAX_WORD_LENGTH,
            'min_player_name_length' => 2,
            'max_player_name_length' => 20
        ]
    ];
}

function handleGetCategories() {
    $categories = getCategories();
    
    if (empty($categories)) {
        return ['success' => false, 'message' => 'No hay categorías'];
    }
    
    return [
        'success' => true,
        'server_now' => intval(microtime(true) * 1000),
        'categories' => $categories
    ];
}

function handleGetStats() {
    if (!DEV_MODE) {
        return ['success' => false, 'message' => 'No disponible'];
    }

    return [
        'success' => true,
        'server_now' => intval(microtime(true) * 1000),
        'stats' => [
            'dictionary' => getDictionaryStats(),
            'active_games' => count(getActiveCodes()),
            'dev_mode' => DEV_MODE
        ]
    ];
}

try {
    checkRateLimit();

    $inputRaw = file_get_contents('php://input');
    $input = json_decode($inputRaw, true);

    if (!is_array($input)) {
        echo json_encode(['success' => false, 'message' => 'JSON inválido']);
        exit;
    }

    $action = isset($input['action']) ? trim((string)$input['action']) : null;

    logMessage("API Action: {$action} | game_id: " . ($input['game_id'] ?? 'N/A') . " | player_id: " . ($input['player_id'] ?? 'N/A'), 'DEBUG');

    $response = ['success' => false, 'message' => 'Acción no válida'];

    switch ($action) {
        case 'get_game_candidates':
            $response = handleGetGameCandidates($input);
            break;
        case 'create_game':
            $response = handleCreateGame($input);
            break;
        case 'join_game':
            $response = handleJoinGame($input);
            break;
        case 'start_round':
            $response = handleStartRound($input);
            break;
        case 'submit_answers':
            $response = handleSubmitAnswers($input);
            break;
        case 'end_round':
            $response = handleEndRound($input);
            break;
        case 'update_round_timer':
            $response = handleUpdateRoundTimer($input);
            break;
        case 'reset_game':
            $response = handleResetGame($input);
            break;
        case 'leave_game':
            $response = handleLeaveGame($input);
            break;
        case 'update_player_name':
            $response = handleUpdatePlayerName($input);
            break;
        case 'update_player_color':
            $response = handleUpdatePlayerColor($input);
            break;
        case 'get_state':
            $response = handleGetState($input);
            break;
        case 'get_config':
            $response = handleGetConfig();
            break;
        case 'get_categories':
            $response = handleGetCategories();
            break;
        case 'get_stats':
            $response = handleGetStats();
            break;
        default:
            $response = ['success' => false, 'message' => 'Acción desconocida'];
            break;
    }

    echo json_encode($response, JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    logMessage('Error fatal: ' . $e->getMessage(), 'ERROR');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}
?>
