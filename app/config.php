<?php
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/GameRepository.php';

function logMessage($message, $level = 'INFO') {
    if (!DEV_MODE && $level === 'DEBUG') return;
    
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[{$timestamp}] [{$level}] {$message}\n";
    
    if (DEV_MODE) {
        error_log($logMessage);
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

function normalizeWord($rawWord) {
    if (empty($rawWord)) {
        return '';
    }
    
    $word = trim($rawWord);
    
    $word = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $word);
    
    $word = strtoupper($word);
    
    $word = preg_replace('/[^A-Z0-9]/', '', $word);
    
    return $word;
}

function cleanWordPrompt($rawWord) {
    if (empty($rawWord)) {
        return '';
    }
    
    $word = trim($rawWord);
    
    if (strpos($word, '|') !== false) {
        $parts = explode('|', $word);
        $word = trim($parts[0]);
    }
    
    if (substr($word, -1) === '.') {
        $word = substr($word, 0, -1);
    }
    
    return normalizeWord($word);
}

function loadDictionary() {
    static $cache = null;

    if ($cache === null) {
        $data = loadRawDictionaryJson();

        if (empty($data)) {
            logMessage('Diccionario vacío o no encontrado, usando fallback', 'WARNING');
            $cache = [
                'GENERAL' => ['CASA', 'SOL', 'MAR', 'LUNA', 'NUBE']
            ];
        } else {
            $cache = $data;
        }
    }

    return $cache;
}

function getTopicCard($category) {
    $dict = loadDictionary();
    
    if (!isset($dict[$category]) || !is_array($dict[$category]) || empty($dict[$category])) {
        return [
            'question' => 'JUEGO',
            'answers' => []
        ];
    }
    
    $categoryArray = $dict[$category];
    $randomCard = $categoryArray[array_rand($categoryArray)];
    
    if (!is_array($randomCard) || empty($randomCard)) {
        return [
            'question' => 'JUEGO',
            'answers' => []
        ];
    }
    
    $question = (string)key($randomCard);
    $answers = current($randomCard);
    
    if (!is_array($answers)) {
        $answers = [];
    }
    
    return [
        'question' => trim($question),
        'answers' => array_values($answers)
    ];
}

function getCategories() {
    $dict = loadDictionary();

    if (is_array($dict)) {
        return array_keys($dict);
    }

    return [];
}

function getAllResponsesByCategory($category) {
    $dict = loadDictionary();
    
    if (!isset($dict[$category]) || !is_array($dict[$category])) {
        return [];
    }
    
    $responses = [];
    foreach ($dict[$category] as $cardObj) {
        if (is_array($cardObj)) {
            foreach ($cardObj as $question => $answers) {
                if (is_array($answers)) {
                    foreach ($answers as $rawAnswer) {
                        $responses[] = (string)$rawAnswer;
                    }
                }
            }
        }
    }
    
    return array_unique($responses);
}

function getRandomWordByCategoryFiltered($category, $maxLength = null) {
    if ($maxLength === null) {
        $maxLength = MAX_CODE_LENGTH;
    }

    $responses = getAllResponsesByCategory($category);
    if (empty($responses)) {
        return null;
    }

    $attempts = 0;
    $maxAttempts = 30;
    
    while ($attempts < $maxAttempts) {
        $rawWord = $responses[array_rand($responses)];
        $cleaned = cleanWordPrompt($rawWord);
        
        if (!empty($cleaned) && mb_strlen($cleaned) <= $maxLength) {
            return $cleaned;
        }
        
        $attempts++;
    }
    
    return null;
}

function generateGameCode() {
    $categories = getCategories();
    
    if (empty($categories)) {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        do {
            $code = '';
            for ($i = 0; $i < 4; $i++) {
                $code .= $chars[rand(0, strlen($chars) - 1)];
            }
        } while (gameExists($code));
        
        return $code;
    }
    
    $roomCodeCandidates = [];
    
    foreach ($categories as $category) {
        $word = getRandomWordByCategoryFiltered($category, MAX_CODE_LENGTH);
        
        if ($word && !gameExists($word)) {
            $roomCodeCandidates[] = $word;
        }
    }
    
    if (!empty($roomCodeCandidates)) {
        return $roomCodeCandidates[array_rand($roomCodeCandidates)];
    }
    
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    do {
        $code = '';
        for ($i = 0; $i < 4; $i++) {
            $code .= $chars[rand(0, strlen($chars) - 1)];
        }
    } while (gameExists($code));
    
    if (mb_strlen($code) > MAX_CODE_LENGTH) {
        logMessage('[WARNING] Código generado excede MAX_CODE_LENGTH: ' . $code, 'WARNING');
        $code = substr($code, 0, MAX_CODE_LENGTH);
    }
    
    return $code;
}

function sanitizeGameId($gameId) {
    if (empty($gameId)) return null;
    
    $clean = preg_replace('/[^A-Z0-9]/', '', strtoupper($gameId));
    
    if (strlen($clean) < 3 || strlen($clean) > MAX_CODE_LENGTH) {
        return null;
    }
    
    return $clean;
}

function sanitizePlayerId($playerId) {
    if (empty($playerId)) return null;
    
    $clean = preg_replace('/[^a-zA-Z0-9_]/', '', $playerId);
    
    if (strlen($clean) < 5 || strlen($clean) > 50) {
        return null;
    }
    
    return $clean;
}

function validatePlayerColor($color) {
    if (empty($color)) return null;
    
    $parts = explode(',', $color);
    
    if (count($parts) !== 2) return null;
    
    foreach ($parts as $part) {
        if (!preg_match('/^#[0-9A-Fa-f]{6}$/', trim($part))) {
            return null;
        }
    }
    
    return $color;
}

function saveGameState($gameId, $state) {
    $gameId = sanitizeGameId($gameId);
    if (!$gameId) {
        logMessage('Intento de guardar con gameId inválido', 'ERROR');
        return false;
    }
    
    if (strlen($gameId) > MAX_CODE_LENGTH) {
        logMessage('[ERROR] gameId excede MAX_CODE_LENGTH: ' . $gameId . ' (longitud: ' . strlen($gameId) . ')', 'ERROR');
        return false;
    }
    
    $state['_version'] = 1;
    $state['_updated_at'] = time();
    
    try {
        $db = Database::getInstance();
        $repo = new GameRepository();
        $repo->save($gameId, $state);
        logMessage('[SUCCESS] Estado guardado para ' . $gameId . ' vía SQLite', 'DEBUG');
        return true;
    } catch (Exception $e) {
        logMessage('[ERROR] Error guardando a SQLite: ' . $e->getMessage(), 'ERROR');
        return false;
    }
}

function loadGameState($gameId) {
    $gameId = sanitizeGameId($gameId);
    if (!$gameId) {
        logMessage('[ERROR] Intento de cargar con gameId inválido', 'ERROR');
        return null;
    }
    
    if (strlen($gameId) > MAX_CODE_LENGTH) {
        logMessage('[ERROR] gameId excede MAX_CODE_LENGTH en loadGameState: ' . $gameId, 'ERROR');
        return null;
    }
    
    try {
        $db = Database::getInstance();
        $repo = new GameRepository();
        $state = $repo->load($gameId);
        
        if ($state) {
            logMessage('[DEBUG] Estado cargado desde SQLite: ' . $gameId, 'DEBUG');
            return $state;
        }
        
        logMessage('[DEBUG] Game no encontrado en SQLite: ' . $gameId, 'DEBUG');
        return null;
        
    } catch (Exception $e) {
        logMessage('[ERROR] Error cargando de SQLite: ' . $e->getMessage(), 'ERROR');
        return null;
    }
}

function cleanupOldGames() {
    try {
        $db = Database::getInstance();
        $repo = new GameRepository();
        $deleted = $repo->cleanup(MAX_GAME_AGE);
        logMessage('[INFO] Cleanup: ' . $deleted . ' old games removed from SQLite', 'INFO');
        return $deleted;
    } catch (Exception $e) {
        logMessage('[ERROR] Cleanup failed: ' . $e->getMessage(), 'ERROR');
        return 0;
    }
}

function gameExists($gameId) {
    $gameId = sanitizeGameId($gameId);
    if (!$gameId) return false;
    if (strlen($gameId) > MAX_CODE_LENGTH) return false;
    
    try {
        $db = Database::getInstance();
        $repo = new GameRepository();
        return $repo->exists($gameId);
    } catch (Exception $e) {
        logMessage('[ERROR] gameExists check failed: ' . $e->getMessage(), 'ERROR');
        return false;
    }
}

function getDictionaryStats() {
    $dict = loadDictionary();

    $stats = [
        'categorias' => count($dict),
        'total_palabras' => 0,
        'palabras_codigo' => 0,
        'categorias_detalle' => []
    ];

    foreach ($dict as $categoria => $content) {
        $responses = getAllResponsesByCategory($categoria);
        $cleanedWords = array_map('cleanWordPrompt', $responses);
        $cleanedWords = array_filter($cleanedWords, function($w) { 
            return !empty($w); 
        });
        $uniqueWords = array_unique($cleanedWords);
        
        $count = count($uniqueWords);
        $stats['total_palabras'] += $count;
        $stats['categorias_detalle'][$categoria] = $count;
        
        foreach ($uniqueWords as $palabra) {
            if (mb_strlen($palabra) <= MAX_CODE_LENGTH) {
                $stats['palabras_codigo']++;
            }
        }
    }

    return $stats;
}

if (rand(1, 100) <= (CLEANUP_PROBABILITY * 100)) {
    cleanupOldGames();
}
?>
