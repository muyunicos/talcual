<?php

require_once __DIR__ . '/GameRepository.php';
require_once __DIR__ . '/DictionaryRepository.php';

class GameService {
    private $repository;
    private $dictionary;

    public function __construct(GameRepository $repository, DictionaryRepository $dictionary = null) {
        $this->repository = $repository;
        $this->dictionary = $dictionary ?? new DictionaryRepository();
    }

    private function generateGameCode() {
        $categories = $this->dictionary->getCategoriesFull();
        
        if (empty($categories)) {
            return $this->generateRandomCode();
        }
        
        $roomCodeCandidates = [];
        
        foreach ($categories as $categoryData) {
            $word = $this->dictionary->getRandomWordByCategoryFiltered($categoryData['name'], MAX_CODE_LENGTH);
            
            if ($word && !$this->repository->exists($word)) {
                $roomCodeCandidates[] = $word;
            }
        }
        
        if (!empty($roomCodeCandidates)) {
            return $roomCodeCandidates[array_rand($roomCodeCandidates)];
        }
        
        return $this->generateRandomCode();
    }

    private function generateRandomCode() {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        do {
            $code = '';
            for ($i = 0; $i < MAX_CODE_LENGTH; $i++) {
                $code .= $chars[rand(0, strlen($chars) - 1)];
            }
        } while ($this->repository->exists($code));
        
        return $code;
    }

    private function generateUniqueGameId() {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        do {
            $id = '';
            for ($i = 0; $i < 8; $i++) {
                $id .= $chars[rand(0, strlen($chars) - 1)];
            }
        } while ($this->repository->exists($id));
        
        return $id;
    }

    public function getGameCandidates() {
        $categories = $this->dictionary->getCategoriesFull();

        if (empty($categories)) {
            throw new Exception('No categories available');
        }

        $candidates = [];
        $maxCategoryAttempts = 10;

        foreach ($categories as $categoryData) {
            $categoryAttempts = 0;
            $code = null;

            while ($categoryAttempts < $maxCategoryAttempts) {
                $word = $this->dictionary->getRandomWordByCategoryFiltered($categoryData['name'], MAX_CODE_LENGTH);

                if (!$word || $this->repository->exists($word)) {
                    $categoryAttempts++;
                    continue;
                }

                $code = $word;
                break;
            }

            if (!$code) {
                $code = $this->generateRandomCode();
            }

            $candidates[] = [
                'category' => $categoryData['name'],
                'category_id' => (int)$categoryData['id'],
                'code' => $code
            ];
        }

        return $candidates;
    }

    public function createGame($gameId, $requestedCategory, $totalRounds, $roundDuration, $minPlayers) {
        $originalGameId = null;
        $previousGameState = null;

        if (!$gameId) {
            throw new Exception('Game code is required');
        }

        $gameId = trim((string)$gameId);

        $previousGameState = $this->repository->load($gameId);
        
        if ($previousGameState) {
            $originalGameId = $previousGameState['original_id'] ?? $gameId;
        } else {
            if ($this->repository->exists($gameId)) {
                throw new Exception('Room already exists');
            }
            $originalGameId = $gameId;
        }

        if ($requestedCategory) {
            $categoryData = $this->dictionary->getCategoryByName($requestedCategory);
            if (!$categoryData) {
                throw new Exception('Invalid category');
            }
        }

        if ($totalRounds < 1 || $totalRounds > 10) $totalRounds = TOTAL_ROUNDS;
        if ($roundDuration < 30 || $roundDuration > 300) $roundDuration = ROUND_DURATION;
        if ($minPlayers < MIN_PLAYERS || $minPlayers > MAX_PLAYERS) $minPlayers = MIN_PLAYERS;

        $newGameId = $gameId;
        $serverNow = intval(microtime(true) * 1000);
        $now = time();
        $countdownDuration = START_COUNTDOWN * 1000;

        $selectedCategoryId = null;
        if ($requestedCategory) {
            $categoryData = $this->dictionary->getCategoryByName($requestedCategory);
            if ($categoryData) {
                $selectedCategoryId = (int)$categoryData['id'];
            }
        }

        $initialState = [
            'game_id' => $newGameId,
            'original_id' => $originalGameId,
            'players' => [],
            'round' => 0,
            'total_rounds' => $totalRounds,
            'status' => 'waiting',
            'current_prompt_id' => null,
            'current_category_id' => null,
            'selected_category_id' => $selectedCategoryId,
            'used_prompts' => [],
            'round_duration' => $roundDuration,
            'round_started_at' => null,
            'round_starts_at' => null,
            'round_ends_at' => null,
            'countdown_duration' => $countdownDuration,
            'created_at' => $now,
            'updated_at' => $now,
            'start_countdown' => START_COUNTDOWN,
            'hurry_up_threshold' => 10,
            'max_words_per_player' => MAX_WORDS_PER_PLAYER,
            'max_word_length' => MAX_WORD_LENGTH,
            'min_players' => $minPlayers,
            'max_players' => MAX_PLAYERS,
            'round_details' => [],
            'round_top_words' => [],
            'game_history' => [],
            'roundData' => null,
            'last_update' => time()
        ];

        $this->repository->save($newGameId, $initialState);

        if ($previousGameState) {
            $previousGameState['status'] = $newGameId;
            $previousGameState['updated_at'] = $now;
            $previousGameState['last_update'] = $now;
            $this->repository->save($gameId, $previousGameState);
            logMessage('Game continuity: ' . $gameId . ' -> ' . $newGameId . ' (original: ' . $originalGameId . ')', 'INFO');
        }

        return [
            'game_id' => $newGameId,
            'original_id' => $originalGameId,
            'server_now' => $serverNow,
            'state' => $initialState
        ];
    }

    public function getGameChain($gameIdOrOriginalId) {
        $chain = [];
        $currentId = $gameIdOrOriginalId;
        $visited = [];
        $maxIterations = 50;
        $iterations = 0;

        while ($currentId && !isset($visited[$currentId]) && $iterations < $maxIterations) {
            $visited[$currentId] = true;
            $state = $this->repository->load($currentId);

            if (!$state) {
                break;
            }

            $chainEntry = [
                'game_id' => $state['game_id'],
                'original_id' => $state['original_id'] ?? $state['game_id'],
                'created_at' => $state['created_at'] ?? 0,
                'updated_at' => $state['updated_at'] ?? 0,
                'status' => $state['status'] ?? 'unknown',
                'players_count' => count($state['players'] ?? []),
                'round' => $state['round'] ?? 0,
                'total_rounds' => $state['total_rounds'] ?? 0
            ];

            $chain[] = $chainEntry;

            if ($state['status'] && is_string($state['status']) && strlen($state['status']) > 4 && !in_array($state['status'], ['waiting', 'playing', 'round_ended', 'finished', 'closed', 'ended'])) {
                $currentId = $state['status'];
            } else {
                break;
            }

            $iterations++;
        }

        return $chain;
    }

    public function getOriginalGameId($gameId) {
        $state = $this->repository->load($gameId);
        
        if ($state && isset($state['original_id'])) {
            return $state['original_id'];
        }
        
        return $gameId;
    }

    public function joinGame($gameId, $playerId, $playerName, $playerColor) {
        $state = $this->repository->load($gameId);

        if (!$state) {
            throw new Exception('Game not found');
        }

        $playerName = trim($playerName);
        if (strlen($playerName) < 2 || strlen($playerName) > 20) {
            throw new Exception('Invalid name');
        }

        if (isset($state['players'][$playerId])) {
            return [
                'message' => 'Reconnected to game',
                'server_now' => intval(microtime(true) * 1000),
                'state' => $state,
                'reconnected' => true
            ];
        }

        if (count($state['players']) >= $state['max_players']) {
            throw new Exception('Room full');
        }

        $state['players'][$playerId] = [
            'id' => $playerId,
            'name' => $playerName,
            'aura' => $playerColor,
            'score' => 0,
            'status' => 'connected',
            'disconnected' => false,
            'answers' => [],
            'round_history' => []
        ];

        $state['last_update'] = time();
        $state['updated_at'] = time();

        $this->repository->save($gameId, $state);

        return [
            'message' => 'Joined game',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state,
            'reconnected' => false
        ];
    }

    public function startRound($gameId, $categoryFromRequest, $duration, $totalRounds) {
        $state = $this->repository->load($gameId);

        if (!$state) {
            throw new Exception('Game not found');
        }

        $activePlayers = array_filter($state['players'], function ($player) {
            return empty($player['disconnected']);
        });

        $minPlayers = $state['min_players'] ?? MIN_PLAYERS;

        if (count($activePlayers) < $minPlayers) {
            throw new Exception('Minimum ' . $minPlayers . ' players required');
        }

        $categoryIdToUse = null;
        $categoryNameToUse = null;

        if ($categoryFromRequest) {
            $categoryData = $this->dictionary->getCategoryByName($categoryFromRequest);
            if ($categoryData) {
                $categoryIdToUse = (int)$categoryData['id'];
                $categoryNameToUse = $categoryData['name'];
            }
        } elseif ($state['selected_category_id']) {
            $categoryData = $this->dictionary->getCategoryById($state['selected_category_id']);
            if ($categoryData) {
                $categoryIdToUse = (int)$categoryData['id'];
                $categoryNameToUse = $categoryData['name'];
            }
        }

        if (!$categoryIdToUse) {
            $categories = $this->dictionary->getCategoriesFull();
            if (!empty($categories)) {
                $randomCategory = $categories[array_rand($categories)];
                $categoryIdToUse = (int)$randomCategory['id'];
                $categoryNameToUse = $randomCategory['name'];
            }
        }

        if (!$categoryIdToUse || !$categoryNameToUse) {
            throw new Exception('Cannot determine category for round');
        }

        $card = $this->dictionary->getTopicCard($categoryNameToUse);
        $promptId = $card['id'];
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
        $state['current_prompt_id'] = $promptId;
        $state['current_category_id'] = $categoryIdToUse;
        $state['round_duration'] = $duration;
        $state['total_rounds'] = $totalRounds;
        $state['start_countdown'] = START_COUNTDOWN;
        $state['countdown_duration'] = $countdownDuration;
        $state['round_started_at'] = $roundStartedAt;
        $state['round_starts_at'] = $roundStartsAt;
        $state['round_ends_at'] = $roundEndsAt;

        $state['roundData'] = [
            'roundQuestion' => $roundQuestion,
            'commonAnswers' => $commonAnswers
        ];

        $state['last_update'] = time();
        $state['updated_at'] = time();

        foreach ($state['players'] as $pId => $player) {
            if (!empty($player['disconnected'])) {
                continue;
            }
            $state['players'][$pId]['status'] = 'playing';
            $state['players'][$pId]['answers'] = [];
        }

        $this->repository->save($gameId, $state);

        return [
            'message' => 'Round started',
            'server_now' => $serverNow,
            'state' => $state
        ];
    }

    public function setSelectedCategory($gameId, $newCategory) {
        $state = $this->repository->load($gameId);

        if (!$state) {
            throw new Exception('Game not found');
        }

        if ($state['status'] !== 'waiting') {
            throw new Exception('Cannot change category during a round');
        }

        $categoryData = $this->dictionary->getCategoryByName($newCategory);
        if (!$categoryData) {
            throw new Exception('Invalid category');
        }

        $state['selected_category_id'] = (int)$categoryData['id'];
        $state['last_update'] = time();
        $state['updated_at'] = time();

        $this->repository->save($gameId, $state);

        return [
            'message' => 'Category updated',
            'selected_category_id' => $state['selected_category_id'],
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    public function submitAnswers($gameId, $playerId, $answers, $forcedPass = false) {
        $state = $this->repository->load($gameId);

        if (!$state || !isset($state['players'][$playerId])) {
            throw new Exception('Player not found');
        }

        if ($state['status'] !== 'playing') {
            throw new Exception('No active round');
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
        $state['updated_at'] = time();

        $this->repository->save($gameId, $state);

        return [
            'message' => 'Answers saved',
            'valid_answers' => count($validAnswers),
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    public function endRound($gameId) {
        $state = $this->repository->load($gameId);

        if (!$state) {
            throw new Exception('Game not found');
        }

        if ($state['status'] !== 'playing') {
            throw new Exception('No active round');
        }

        foreach ($state['players'] as $pId => $player) {
            $roundEntry = [
                'round' => $state['round'],
                'answers' => $player['answers'] ?? [],
                'score' => 0
            ];

            if (!isset($state['players'][$pId]['round_history'])) {
                $state['players'][$pId]['round_history'] = [];
            }
            if (!is_array($state['players'][$pId]['round_history'])) {
                $state['players'][$pId]['round_history'] = [];
            }

            $state['players'][$pId]['round_history'][] = $roundEntry;
            $state['players'][$pId]['answers'] = [];
            $state['players'][$pId]['status'] = 'connected';
        }

        $isGameFinished = (($state['round'] ?? 0) >= ($state['total_rounds'] ?? TOTAL_ROUNDS));

        if ($isGameFinished) {
            $roundSnapshot = [
                'round' => $state['round'] ?? 0,
                'current_category_id' => $state['current_category_id'] ?? null,
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
        $state['updated_at'] = time();

        if ($isGameFinished) {
            $state['status'] = 'finished';
            $state['roundData'] = null;
        } else {
            $state['status'] = 'round_ended';
        }

        $state['round_started_at'] = null;
        $state['round_starts_at'] = null;
        $state['round_ends_at'] = null;
        $state['countdown_duration'] = null;

        $this->repository->save($gameId, $state);

        return [
            'message' => 'Round ended',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    public function resetGame($gameId) {
        $state = $this->repository->load($gameId);

        if (!$state) {
            throw new Exception('Game not found');
        }

        foreach ($state['players'] as $pId => $player) {
            $state['players'][$pId]['score'] = 0;
            $state['players'][$pId]['status'] = 'connected';
            $state['players'][$pId]['disconnected'] = false;
            $state['players'][$pId]['answers'] = [];
            $state['players'][$pId]['round_history'] = [];
        }

        $state['round'] = 0;
        $state['status'] = 'waiting';
        $state['current_prompt_id'] = null;
        $state['current_category_id'] = null;
        $state['round_started_at'] = null;
        $state['round_starts_at'] = null;
        $state['round_ends_at'] = null;
        $state['countdown_duration'] = null;
        $state['round_top_words'] = [];
        $state['roundData'] = null;
        $state['last_update'] = time();
        $state['updated_at'] = time();

        $this->repository->save($gameId, $state);

        return [
            'message' => 'Game reset',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    public function endGame($gameId) {
        $state = $this->repository->load($gameId);

        if (!$state) {
            throw new Exception('Game not found');
        }

        $state['status'] = 'closed';
        $state['round_started_at'] = null;
        $state['round_starts_at'] = null;
        $state['round_ends_at'] = null;
        $state['countdown_duration'] = null;
        $state['roundData'] = null;
        $state['last_update'] = time();
        $state['updated_at'] = time();

        foreach ($state['players'] as $pId => $player) {
            $state['players'][$pId]['answers'] = [];
            $state['players'][$pId]['status'] = 'disconnected';
            $state['players'][$pId]['disconnected'] = true;
        }

        $this->repository->save($gameId, $state);

        return [
            'message' => 'Game ended',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    public function updateRoundTimer($gameId, $newEndTime) {
        $state = $this->repository->load($gameId);

        if (!$state) {
            throw new Exception('Game not found');
        }

        if ($state['status'] !== 'playing') {
            throw new Exception('No active round');
        }

        if ($newEndTime <= 0) {
            throw new Exception('Invalid time');
        }

        $state['round_ends_at'] = $newEndTime;
        $newDuration = $newEndTime - ($state['round_started_at'] ?? 0);
        if ($newDuration > 0) {
            $state['round_duration'] = $newDuration;
        }

        $state['last_update'] = time();
        $state['updated_at'] = time();

        $this->repository->save($gameId, $state);

        return [
            'message' => 'Timer updated',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    public function leaveGame($gameId, $playerId) {
        $state = $this->repository->load($gameId);

        if ($state && isset($state['players'][$playerId])) {
            $state['players'][$playerId]['disconnected'] = true;
            $state['players'][$playerId]['status'] = 'disconnected';
            $state['last_update'] = time();
            $state['updated_at'] = time();

            $this->repository->save($gameId, $state);

            return [
                'message' => 'Left game'
            ];
        }

        return [
            'message' => 'Already left the game'
        ];
    }

    public function updatePlayerName($gameId, $playerId, $newName) {
        $state = $this->repository->load($gameId);

        if (!$state || !isset($state['players'][$playerId])) {
            throw new Exception('Player not found');
        }

        $newName = trim($newName);
        if (strlen($newName) < 2 || strlen($newName) > 20) {
            throw new Exception('Invalid name');
        }

        $state['players'][$playerId]['name'] = $newName;
        $state['last_update'] = time();
        $state['updated_at'] = time();

        $this->repository->save($gameId, $state);

        return [
            'message' => 'Name updated',
            'server_now' => intval(microtime(true) * 1000),
            'state' => $state
        ];
    }

    public function updatePlayerColor($gameId, $playerId, $newColor) {
        $state = $this->repository->load($gameId);

        if (!$state || !isset($state['players'][$playerId])) {
            throw new Exception('Player not found');
        }

        if (!$newColor) {
            throw new Exception('Invalid color');
        }

        $state['players'][$playerId]['aura'] = $newColor;
        $state['last_update'] = time();
        $state['updated_at'] = time();

        $this->repository->save($gameId, $state);

        return [
            'message' => 'Color updated',
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

        throw new Exception('Game not found');
    }
}
?>