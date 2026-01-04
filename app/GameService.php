<?php

class GameService {
    private $repository;

    public function __construct(GameRepository $repository) {
        $this->repository = $repository;
    }

    public function getGameCandidates() {
        $categories = getCategories();

        if (empty($categories)) {
            throw new Exception('No hay categorías disponibles');
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
            throw new Exception('No se pudieron generar códigos para las categorías');
        }

        return $candidates;
    }

    public function createGame($gameId, $requestedCategory, $totalRounds, $roundDuration, $minPlayers) {
        if ($gameId) {
            if ($this->repository->exists($gameId)) {
                throw new Exception('El código de sala ya está en uso');
            }

            if ($requestedCategory) {
                $availableCategories = getCategories();
                if (!in_array($requestedCategory, $availableCategories)) {
                    throw new Exception('Categoría no válida');
                }
            }
        } else {
            $gameId = generateGameCode();
        }

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

        $this->repository->save($gameId, $initialState);
        
        try {
            trackGameAction($gameId, 'game_created', []);
        } catch (Throwable $t) {
            logMessage('Analytics error in createGame: ' . $t->getMessage(), 'WARNING');
        }

        return [
            'game_id' => $gameId,
            'server_now' => $serverNow,
            'state' => $initialState
        ];
    }

    public function joinGame($gameId, $playerId, $playerName, $playerColor) {
        $state = $this->repository->load($gameId);

        if (!$state) {
            throw new Exception('Juego no encontrado');
        }

        $playerName = trim($playerName);
        if (strlen($playerName) < 2 || strlen($playerName) > 20) {
            throw new Exception('Nombre inválido');
        }

        if (count($state['players']) >= MAX_PLAYERS) {
            throw new Exception('Sala llena');
        }

        if (isset($state['players'][$playerId])) {
            return [
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

        $this->repository->save($gameId, $state);
        
        try {
            trackGameAction($gameId, 'player_joined', ['player_name' => $playerName]);
        } catch (Throwable $t) {
            logMessage('Analytics error in joinGame: ' . $t->getMessage(), 'WARNING');
        }

        return [
            'message' => 'Te uniste al juego',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    public function startRound($gameId, $categoryFromRequest, $duration, $totalRounds) {
        $state = $this->repository->load($gameId);

        if (!$state) {
            throw new Exception('Juego no encontrado');
        }

        $activePlayers = array_filter($state['players'], function ($player) {
            return empty($player['disconnected']);
        });

        $minPlayers = $state['min_players'] ?? MIN_PLAYERS;

        if (count($activePlayers) < $minPlayers) {
            throw new Exception('Mínimo ' . $minPlayers . ' jugadores');
        }

        $preferredCategory = $categoryFromRequest ?: ($state['selected_category'] ?? null);
        if (!$preferredCategory) {
            $categories = getCategories();
            if (!empty($categories)) {
                $preferredCategory = $categories[array_rand($categories)];
            }
        }

        $card = getTopicCard($preferredCategory);
        $roundQuestion = $card['question'];
        $commonAnswers = $card['answers'];

        if ($duration < 10000 || $duration > 300000) {
            $duration = defined('ROUND_DURATION') ? ROUND_DURATION * 1000 : 90000;
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

        $this->repository->save($gameId, $state);
        
        try {
            trackGameAction($gameId, 'round_started', ['round' => $state['round']]);
        } catch (Throwable $t) {
            logMessage('Analytics error in startRound: ' . $t->getMessage(), 'WARNING');
        }

        return [
            'message' => 'Ronda iniciada',
            'server_now' => $serverNow,
            'state' => $state
        ];
    }

    public function submitAnswers($gameId, $playerId, $answers, $forcedPass = false) {
        $state = $this->repository->load($gameId);

        if (!$state || !isset($state['players'][$playerId])) {
            throw new Exception('Jugador no encontrado');
        }

        if ($state['status'] !== 'playing') {
            throw new Exception('No hay ronda activa');
        }

        $validAnswers = [];
        foreach ($answers as $word) {
            if (is_string($word)) {
                $validAnswers[] = trim($word);
            }
        }

        if (count($validAnswers) > MAX_WORDS_PER_PLAYER) {
            $validAnswers = array_slice($validAnswers, 0, MAX_WORDS_PER_PLAYER);
        }

        $state['players'][$playerId]['answers'] = $validAnswers;

        if ($forcedPass) {
            $state['players'][$playerId]['status'] = 'ready';
        } else {
            $state['players'][$playerId]['status'] = 'playing';
        }

        $state['last_update'] = time();

        $this->repository->save($gameId, $state);

        return [
            'message' => 'Respuestas guardadas',
            'valid_answers' => count($validAnswers),
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    public function endRound($gameId, $roundResults, $topWords, $scoreDeltas) {
        $state = $this->repository->load($gameId);

        if (!$state) {
            throw new Exception('Juego no encontrado');
        }

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

        $isGameFinished = (($state['round'] ?? 0) >= ($state['total_rounds'] ?? TOTAL_ROUNDS));

        if ($isGameFinished) {
            $roundSnapshot = [
                'round' => $state['round'] ?? 0,
                'current_prompt' => $state['current_prompt'] ?? null,
                'current_category' => $state['current_category'] ?? null,
                'round_top_words' => $state['round_top_words'] ?? []
            ];
            
            if (!isset($state['game_history'])) {
                $state['game_history'] = [];
            }
            
            if (!is_array($state['game_history'])) {
                $state['game_history'] = [];
            }
            
            $state['game_history'][] = $roundSnapshot;
        }

        $state['last_update'] = time();

        if ($isGameFinished) {
            $state['status'] = 'finished';
            $state['roundData'] = null;

            foreach ($state['players'] as $pId => $player) {
                $state['players'][$pId]['answers'] = [];
                $state['players'][$pId]['round_results'] = [];
            }

            try {
                trackGameAction($gameId, 'game_finished', []);
            } catch (Throwable $t) {
                logMessage('Analytics error in endRound (game_finished): ' . $t->getMessage(), 'WARNING');
            }
        } else {
            $state['status'] = 'round_ended';
            $state['roundData'] = null;
        }

        $state['round_started_at'] = null;
        $state['round_starts_at'] = null;
        $state['round_ends_at'] = null;
        $state['countdown_duration'] = null;

        $this->repository->save($gameId, $state);
        
        try {
            trackGameAction($gameId, 'round_ended', []);
        } catch (Throwable $t) {
            logMessage('Analytics error in endRound: ' . $t->getMessage(), 'WARNING');
        }

        return [
            'message' => 'Ronda finalizada',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    public function resetGame($gameId) {
        $state = $this->repository->load($gameId);

        if (!$state) {
            throw new Exception('Juego no encontrado');
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

        $this->repository->save($gameId, $state);
        
        try {
            trackGameAction($gameId, 'game_reset', []);
        } catch (Throwable $t) {
            logMessage('Analytics error in resetGame: ' . $t->getMessage(), 'WARNING');
        }

        return [
            'message' => 'Juego reiniciado',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    public function updateRoundTimer($gameId, $newEndTime) {
        $state = $this->repository->load($gameId);

        if (!$state) {
            throw new Exception('Juego no encontrado');
        }

        if ($state['status'] !== 'playing') {
            throw new Exception('No hay ronda en curso');
        }

        if ($newEndTime <= 0) {
            throw new Exception('Tiempo inválido');
        }

        $state['round_ends_at'] = $newEndTime;
        $newDuration = $newEndTime - ($state['round_started_at'] ?? 0);
        if ($newDuration > 0) {
            $state['round_duration'] = $newDuration;
        }

        $state['last_update'] = time();

        $this->repository->save($gameId, $state);
        
        try {
            trackGameAction($gameId, 'round_timer_updated', ['new_end_time' => $newEndTime]);
        } catch (Throwable $t) {
            logMessage('Analytics error in updateRoundTimer: ' . $t->getMessage(), 'WARNING');
        }

        return [
            'message' => 'Temporizador actualizado',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    public function leaveGame($gameId, $playerId) {
        $state = $this->repository->load($gameId);

        if ($state && isset($state['players'][$playerId])) {
            $state['players'][$playerId]['disconnected'] = true;
            $state['last_update'] = time();

            $this->repository->save($gameId, $state);
            
            try {
                trackGameAction($gameId, 'player_left', []);
            } catch (Throwable $t) {
                logMessage('Analytics error in leaveGame: ' . $t->getMessage(), 'WARNING');
            }

            return [
                'message' => 'Saliste del juego'
            ];
        }

        return [
            'message' => 'Ya no estás en el juego'
        ];
    }

    public function updatePlayerName($gameId, $playerId, $newName) {
        $state = $this->repository->load($gameId);

        if (!$state || !isset($state['players'][$playerId])) {
            throw new Exception('Jugador no encontrado');
        }

        $newName = trim($newName);
        if (strlen($newName) < 2 || strlen($newName) > 20) {
            throw new Exception('Nombre inválido');
        }

        $state['players'][$playerId]['name'] = $newName;
        $state['last_update'] = time();

        $this->repository->save($gameId, $state);
        
        try {
            trackGameAction($gameId, 'player_name_updated', []);
        } catch (Throwable $t) {
            logMessage('Analytics error in updatePlayerName: ' . $t->getMessage(), 'WARNING');
        }

        return [
            'message' => 'Nombre actualizado',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    public function updatePlayerColor($gameId, $playerId, $newColor) {
        $state = $this->repository->load($gameId);

        if (!$state || !isset($state['players'][$playerId])) {
            throw new Exception('Jugador no encontrado');
        }

        if (!$newColor) {
            throw new Exception('Color inválido');
        }

        $state['players'][$playerId]['color'] = $newColor;
        $state['last_update'] = time();

        $this->repository->save($gameId, $state);
        
        try {
            trackGameAction($gameId, 'player_color_updated', []);
        } catch (Throwable $t) {
            logMessage('Analytics error in updatePlayerColor: ' . $t->getMessage(), 'WARNING');
        }

        return [
            'message' => 'Color actualizado',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    public function getState($gameId) {
        $state = $this->repository->load($gameId);

        if ($state) {
            return [
                'server_now' => intval(microtime(true) * 1000),
                'state' => $state
            ];
        }

        throw new Exception('Juego no encontrado');
    }
}
?>
