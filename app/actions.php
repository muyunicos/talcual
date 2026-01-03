<?php
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/GameRepository.php';
require_once __DIR__ . '/GameService.php';

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

    $repository = new GameRepository(GAME_STATES_DIR);
    $service = new GameService($repository);

    $response = ['success' => false, 'message' => 'Acción no válida'];

    switch ($action) {
        case 'get_game_candidates':
            $candidates = $service->getGameCandidates();
            $response = [
                'success' => true,
                'server_now' => intval(microtime(true) * 1000),
                'candidates' => $candidates['candidates'] ?? $candidates
            ];
            break;

        case 'create_game':
            $gameId = sanitizeGameId($input['game_id'] ?? null);
            $requestedCategory = isset($input['category']) ? trim((string)$input['category']) : null;
            if ($requestedCategory === '') $requestedCategory = null;
            $totalRounds = intval($input['total_rounds'] ?? TOTAL_ROUNDS);
            $roundDuration = intval($input['round_duration'] ?? ROUND_DURATION);
            $minPlayers = intval($input['min_players'] ?? MIN_PLAYERS);

            $result = $service->createGame($gameId, $requestedCategory, $totalRounds, $roundDuration, $minPlayers);
            $response = [
                'success' => true,
                'game_id' => $result['game_id'],
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            notifyGameChanged($result['game_id'], true);
            break;

        case 'join_game':
            $gameId = sanitizeGameId($input['game_id'] ?? null);
            $playerId = sanitizePlayerId($input['player_id'] ?? null);

            if (!$gameId || !$playerId) {
                throw new Exception('game_id y player_id requeridos');
            }

            $playerName = trim($input['name'] ?? 'Jugador');
            $playerColor = validatePlayerColor($input['color'] ?? null);

            $result = $service->joinGame($gameId, $playerId, $playerName, $playerColor);
            $response = [
                'success' => true,
                'message' => $result['message'],
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            notifyGameChanged($gameId);
            break;

        case 'start_round':
            $gameId = sanitizeGameId($input['game_id'] ?? null);

            if (!$gameId) {
                throw new Exception('game_id requerido');
            }

            $categoryFromRequest = isset($input['category']) ? trim((string)$input['category']) : null;
            if ($categoryFromRequest === '') $categoryFromRequest = null;
            $duration = intval($input['duration'] ?? 0);
            $totalRounds = intval($input['total_rounds'] ?? 0);

            $result = $service->startRound($gameId, $categoryFromRequest, $duration, $totalRounds);
            $response = [
                'success' => true,
                'message' => $result['message'],
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            notifyGameChanged($gameId);
            break;

        case 'submit_answers':
            $gameId = sanitizeGameId($input['game_id'] ?? null);
            $playerId = sanitizePlayerId($input['player_id'] ?? null);

            if (!$gameId || !$playerId) {
                throw new Exception('game_id y player_id requeridos');
            }

            $answers = $input['answers'] ?? [];

            $result = $service->submitAnswers($gameId, $playerId, $answers);
            $response = [
                'success' => true,
                'message' => $result['message'],
                'valid_answers' => $result['valid_answers'],
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            notifyGameChanged($gameId);
            break;

        case 'end_round':
            $gameId = sanitizeGameId($input['game_id'] ?? null);

            if (!$gameId) {
                throw new Exception('game_id requerido');
            }

            $roundResults = $input['round_results'] ?? [];
            $topWords = $input['top_words'] ?? [];
            $scoreDeltas = $input['score_deltas'] ?? [];

            $result = $service->endRound($gameId, $roundResults, $topWords, $scoreDeltas);
            $response = [
                'success' => true,
                'message' => $result['message'],
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            notifyGameChanged($gameId);
            break;

        case 'update_round_timer':
            $gameId = sanitizeGameId($input['game_id'] ?? null);

            if (!$gameId) {
                throw new Exception('game_id requerido');
            }

            $newEndTime = intval($input['new_end_time'] ?? 0);

            $result = $service->updateRoundTimer($gameId, $newEndTime);
            $response = [
                'success' => true,
                'message' => $result['message'],
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            notifyGameChanged($gameId);
            break;

        case 'reset_game':
            $gameId = sanitizeGameId($input['game_id'] ?? null);

            if (!$gameId) {
                throw new Exception('game_id requerido');
            }

            $result = $service->resetGame($gameId);
            $response = [
                'success' => true,
                'message' => $result['message'],
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            notifyGameChanged($gameId);
            break;

        case 'leave_game':
            $gameId = sanitizeGameId($input['game_id'] ?? null);
            $playerId = sanitizePlayerId($input['player_id'] ?? null);

            if (!$gameId || !$playerId) {
                throw new Exception('game_id y player_id requeridos');
            }

            $result = $service->leaveGame($gameId, $playerId);
            $response = [
                'success' => true,
                'message' => $result['message']
            ];
            notifyGameChanged($gameId);
            break;

        case 'update_player_name':
            $gameId = sanitizeGameId($input['game_id'] ?? null);
            $playerId = sanitizePlayerId($input['player_id'] ?? null);

            if (!$gameId || !$playerId) {
                throw new Exception('game_id y player_id requeridos');
            }

            $newName = trim($input['name'] ?? '');

            $result = $service->updatePlayerName($gameId, $playerId, $newName);
            $response = [
                'success' => true,
                'message' => $result['message'],
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            notifyGameChanged($gameId);
            break;

        case 'update_player_color':
            $gameId = sanitizeGameId($input['game_id'] ?? null);
            $playerId = sanitizePlayerId($input['player_id'] ?? null);

            if (!$gameId || !$playerId) {
                throw new Exception('game_id y player_id requeridos');
            }

            $newColor = validatePlayerColor($input['color'] ?? null);

            $result = $service->updatePlayerColor($gameId, $playerId, $newColor);
            $response = [
                'success' => true,
                'message' => $result['message'],
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            notifyGameChanged($gameId);
            break;

        case 'get_state':
            $gameId = sanitizeGameId($input['game_id'] ?? null);

            if (!$gameId) {
                throw new Exception('game_id requerido');
            }

            $result = $service->getState($gameId);
            $response = [
                'success' => true,
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            break;

        case 'get_config':
            $response = [
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
            break;

        case 'get_categories':
            $categories = getCategories();

            if (empty($categories)) {
                throw new Exception('No hay categorías');
            }

            $response = [
                'success' => true,
                'server_now' => intval(microtime(true) * 1000),
                'categories' => $categories
            ];
            break;

        case 'get_stats':
            if (!DEV_MODE) {
                throw new Exception('No disponible');
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
