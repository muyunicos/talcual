<?php
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/GameRepository.php';
require_once __DIR__ . '/DictionaryRepository.php';
require_once __DIR__ . '/GameService.php';
require_once __DIR__ . '/AppUtils.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function notifyGameChanged($gameId, $data = null, $isHostOnly = false) {
    if (!extension_loaded('apcu') || !apcu_enabled()) {
        return;
    }

    if ($data === null) {
        $event = 'sync';
        $eventData = [];
    } else {
        $event = isset($data['event']) ? $data['event'] : 'update';
        $eventData = array_diff_key($data, ['event' => null]);
    }

    $notification = [
        'event' => $event,
        'data' => $eventData,
        'ts' => microtime(true)
    ];

    $ttl = 60;

    $hostKey = 'talcual_notify_' . $gameId . '_host';
    apcu_store($hostKey, $notification, $ttl);

    if (!$isHostOnly) {
        $allKey = 'talcual_notify_' . $gameId . '_all';
        apcu_store($allKey, $notification, $ttl);
    }
}

try {
    $inputRaw = file_get_contents('php://input');
    $input = json_decode($inputRaw, true);

    if (!is_array($input)) {
        echo json_encode(['success' => false, 'message' => 'JSON inválido']);
        exit;
    }

    $action = isset($input['action']) ? trim((string)$input['action']) : null;

    logMessage("API: {$action}", 'INFO');

    $repository = new GameRepository();
    $dictionaryRepository = new DictionaryRepository();
    $service = new GameService($repository, $dictionaryRepository);

    $response = ['success' => false, 'message' => 'Acción no válida'];

    switch ($action) {
        case 'get_game_candidates':
            $candidates = $service->getGameCandidates();
            $response = [
                'success' => true,
                'server_now' => intval(microtime(true) * 1000),
                'candidates' => $candidates
            ];
            break;

        case 'create_game':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);
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
            notifyGameChanged($result['game_id'], ['event' => 'sync'], true);
            break;

        case 'join_game':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);
            $playerId = AppUtils::sanitizePlayerId($input['player_id'] ?? null);

            if (!$gameId || !$playerId) {
                throw new Exception('game_id y player_id requeridos');
            }

            $playerName = trim($input['name'] ?? 'Jugador');
            $playerColor = AppUtils::validatePlayerColor($input['color'] ?? null);

            $result = $service->joinGame($gameId, $playerId, $playerName, $playerColor);
            $response = [
                'success' => true,
                'message' => $result['message'],
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            notifyGameChanged($gameId, ['event' => 'player_joined', 'player_id' => $playerId, 'player_name' => $playerName]);
            break;

        case 'start_round':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);

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
            notifyGameChanged($gameId, ['event' => 'sync']);
            break;

        case 'submit_answers':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);
            $playerId = AppUtils::sanitizePlayerId($input['player_id'] ?? null);

            if (!$gameId || !$playerId) {
                throw new Exception('game_id y player_id requeridos');
            }

            $answers = $input['answers'] ?? [];
            $forcedPass = isset($input['forced_pass']) && !empty($input['forced_pass']);

            $result = $service->submitAnswers($gameId, $playerId, $answers, $forcedPass);
            $response = [
                'success' => true,
                'message' => $result['message'],
                'valid_answers' => $result['valid_answers'],
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            notifyGameChanged($gameId, ['event' => 'player_ready', 'player_id' => $playerId, 'answer_count' => $result['valid_answers']]);
            break;

        case 'end_round':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);

            if (!$gameId) {
                throw new Exception('game_id requerido');
            }

            $result = $service->endRound($gameId);
            $response = [
                'success' => true,
                'message' => $result['message'],
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            notifyGameChanged($gameId, ['event' => 'sync']);
            break;

        case 'update_round_timer':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);

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
            notifyGameChanged($gameId, ['event' => 'timer_updated', 'new_end_time' => $newEndTime], true);
            break;

        case 'set_category':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);

            if (!$gameId) {
                throw new Exception('game_id requerido');
            }

            $newCategory = isset($input['category']) ? trim((string)$input['category']) : null;

            $result = $service->setSelectedCategory($gameId, $newCategory);
            $response = [
                'success' => true,
                'message' => $result['message'],
                'selected_category_id' => $result['selected_category_id'],
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            notifyGameChanged($gameId, ['event' => 'sync'], true);
            break;

        case 'reset_game':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);

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
            notifyGameChanged($gameId, ['event' => 'sync']);
            break;

        case 'end_game':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);

            if (!$gameId) {
                throw new Exception('game_id requerido');
            }

            $result = $service->endGame($gameId);
            $repository->delete($gameId);
            $response = [
                'success' => true,
                'message' => 'Juego finalizado',
                'server_now' => intval(microtime(true) * 1000)
            ];
            notifyGameChanged($gameId, ['event' => 'game_ended']);
            break;

        case 'leave_game':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);
            $playerId = AppUtils::sanitizePlayerId($input['player_id'] ?? null);

            if (!$gameId || !$playerId) {
                throw new Exception('game_id y player_id requeridos');
            }

            $result = $service->leaveGame($gameId, $playerId);
            $response = [
                'success' => true,
                'message' => $result['message']
            ];
            notifyGameChanged($gameId, ['event' => 'player_left', 'player_id' => $playerId]);
            break;

        case 'update_player_name':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);
            $playerId = AppUtils::sanitizePlayerId($input['player_id'] ?? null);

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
            notifyGameChanged($gameId, ['event' => 'player_updated', 'player_id' => $playerId]);
            break;

        case 'update_player_color':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);
            $playerId = AppUtils::sanitizePlayerId($input['player_id'] ?? null);

            if (!$gameId || !$playerId) {
                throw new Exception('game_id y player_id requeridos');
            }

            $newColor = AppUtils::validatePlayerColor($input['color'] ?? null);

            $result = $service->updatePlayerColor($gameId, $playerId, $newColor);
            $response = [
                'success' => true,
                'message' => $result['message'],
                'server_now' => $result['server_now'],
                'state' => $result['state']
            ];
            notifyGameChanged($gameId, ['event' => 'player_updated', 'player_id' => $playerId]);
            break;

        case 'typing':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);
            $playerId = AppUtils::sanitizePlayerId($input['player_id'] ?? null);

            if (!$gameId || !$playerId) {
                throw new Exception('game_id y player_id requeridos para typing');
            }

            $response = [
                'success' => true,
                'message' => 'typing notificación enviada',
                'server_now' => intval(microtime(true) * 1000)
            ];
            notifyGameChanged($gameId, ['event' => 'typing', 'player_id' => $playerId], true);
            break;

        case 'get_config':
            $gameId = isset($input['game_id']) ? AppUtils::sanitizeGameId($input['game_id']) : null;

            if ($gameId) {
                // Context-aware: return config from specific game
                try {
                    $result = $service->getState($gameId);
                    $state = $result['state'];
                    $response = [
                        'success' => true,
                        'server_now' => $result['server_now'],
                        'config' => [
                            'round_duration' => $state['round_duration'] ?? ROUND_DURATION,
                            'total_rounds' => $state['total_rounds'] ?? TOTAL_ROUNDS,
                            'min_players' => $state['min_players'] ?? MIN_PLAYERS,
                            'max_players' => $state['max_players'] ?? MAX_PLAYERS,
                            'start_countdown' => $state['start_countdown'] ?? START_COUNTDOWN,
                            'hurry_up_threshold' => $state['hurry_up_threshold'] ?? HURRY_UP_THRESHOLD,
                            'max_words_per_player' => $state['max_words_per_player'] ?? MAX_WORDS_PER_PLAYER,
                            'max_word_length' => $state['max_word_length'] ?? MAX_WORD_LENGTH,
                        ]
                    ];
                } catch (Exception $e) {
                    // Game not found, return defaults
                    $response = [
                        'success' => true,
                        'server_now' => intval(microtime(true) * 1000),
                        'config' => [
                            'round_duration' => ROUND_DURATION,
                            'total_rounds' => TOTAL_ROUNDS,
                            'min_players' => MIN_PLAYERS,
                            'max_players' => MAX_PLAYERS,
                            'start_countdown' => START_COUNTDOWN,
                            'hurry_up_threshold' => HURRY_UP_THRESHOLD,
                            'max_words_per_player' => MAX_WORDS_PER_PLAYER,
                            'max_word_length' => MAX_WORD_LENGTH,
                        ]
                    ];
                }
            } else {
                // Default: return global config from .env
                $response = [
                    'success' => true,
                    'server_now' => intval(microtime(true) * 1000),
                    'config' => [
                        'round_duration' => ROUND_DURATION,
                        'total_rounds' => TOTAL_ROUNDS,
                        'min_players' => MIN_PLAYERS,
                        'max_players' => MAX_PLAYERS,
                        'start_countdown' => START_COUNTDOWN,
                        'hurry_up_threshold' => HURRY_UP_THRESHOLD,
                        'max_words_per_player' => MAX_WORDS_PER_PLAYER,
                        'max_word_length' => MAX_WORD_LENGTH,
                    ]
                ];
            }
            break;

        case 'update_config':
            $gameId = isset($input['game_id']) ? AppUtils::sanitizeGameId($input['game_id']) : null;
            $configData = $input['config'] ?? [];

            if ($gameId) {
                // Context-aware: update specific game config
                try {
                    $result = $service->updateGameConfig($gameId, $configData);
                    $response = [
                        'success' => true,
                        'message' => 'Game config updated',
                        'server_now' => $result['server_now'],
                        'state' => $result['state']
                    ];
                    notifyGameChanged($gameId, ['event' => 'config_updated'], true);
                } catch (Exception $e) {
                    throw $e;
                }
            } else {
                // No game_id: store in session (future enhancement)
                // For now, just acknowledge
                $response = [
                    'success' => true,
                    'message' => 'Config settings stored',
                    'server_now' => intval(microtime(true) * 1000)
                ];
            }
            break;

        case 'get_categories':
            $categories = $dictionaryRepository->getCategories();

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
                    'dictionary' => $dictionaryRepository->getDictionaryStats(),
                    'dev_mode' => DEV_MODE
                ]
            ];
            break;

        case 'get_state':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);

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

        case 'get_game_chain':
            $gameId = AppUtils::sanitizeGameId($input['game_id'] ?? null);

            if (!$gameId) {
                throw new Exception('game_id requerido');
            }

            $chain = $service->getGameChain($gameId);
            $response = [
                'success' => true,
                'server_now' => intval(microtime(true) * 1000),
                'chain' => $chain,
                'chain_count' => count($chain)
            ];
            break;

        default:
            $response = ['success' => false, 'message' => 'Acción desconocida'];
            break;
    }

    echo json_encode($response, JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    logMessage('Error: ' . $e->getMessage(), 'ERROR');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}
?>