<?php
require_once __DIR__ . '/settings.php';

if (!is_dir(GAME_STATES_DIR)) {
    $mkdir_result = @mkdir(GAME_STATES_DIR, 0755, true);
    if (!$mkdir_result) {
        error_log('[CRITICAL] No se pudo crear directorio: ' . GAME_STATES_DIR);
    }
}

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

function flattenWords($data) {
    $words = [];
    
    if (!is_array($data)) {
        return $words;
    }

    array_walk_recursive($data, function($item) use (&$words) {
        if (is_string($item) && !empty(trim($item))) {
            $words[] = trim($item);
        }
    });

    return $words;
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

function getAllWords() {
    $dict = loadDictionary();
    $rawWords = flattenWords($dict);
    
    $cleanedWords = array_map('cleanWordPrompt', $rawWords);
    $cleanedWords = array_filter($cleanedWords, function($w) { 
        return !empty($w); 
    });

    return array_unique($cleanedWords);
}

function getWordsByCategory($category) {
    $dict = loadDictionary();

    if (isset($dict[$category])) {
        $rawWords = flattenWords($dict[$category]);
        $cleanedWords = array_map('cleanWordPrompt', $rawWords);
        $cleanedWords = array_filter($cleanedWords, function($w) { 
            return !empty($w); 
        });
        return array_unique($cleanedWords);
    }

    return [];
}

function getAllResponsesByCategory($category) {
    $dict = loadDictionary();
    
    if (!isset($dict[$category]) || !is_array($dict[$category])) {
        return [];
    }
    
    $responses = [];
    foreach ($dict[$category] as $hintObj) {
        if (is_array($hintObj)) {
            foreach ($hintObj as $hint => $words) {
                if (is_array($words)) {
                    foreach ($words as $word) {
                        $cleaned = cleanWordPrompt($word);
                        if ($cleaned) {
                            $responses[] = $cleaned;
                        }
                    }
                }
            }
        }
    }
    
    return array_unique($responses);
}

function getCategories() {
    $dict = loadDictionary();

    if (is_array($dict)) {
        return array_keys($dict);
    }

    return [];
}

function getDictionaryCategoryWords($category, $minLength = 1, $maxLength = null) {
    $words = getWordsByCategory($category);
    if (empty($words)) return [];
    
    $filtered = array_filter($words, function($word) use ($minLength, $maxLength) {
        $len = mb_strlen($word);
        if ($len < $minLength) return false;
        if ($maxLength !== null && $len > $maxLength) return false;
        return true;
    });
    
    return array_values($filtered);
}

function getPromptsByCategory($category) {
    $dict = loadDictionary();
    
    if (!isset($dict[$category]) || !is_array($dict[$category])) {
        return [];
    }
    
    $prompts = [];
    foreach ($dict[$category] as $hintObj) {
        if (is_array($hintObj)) {
            foreach (array_keys($hintObj) as $hint) {
                $cleaned = cleanWordPrompt($hint);
                if ($cleaned && strlen($cleaned) <= MAX_CODE_LENGTH) {
                    $prompts[] = $cleaned;
                }
            }
        }
    }
    
    return array_unique($prompts);
}

function getResponsesByPrompt($category, $prompt) {
    $dict = loadDictionary();
    $cleanPrompt = cleanWordPrompt($prompt);
    
    if (!isset($dict[$category]) || !is_array($dict[$category])) {
        return [];
    }
    
    $responses = [];
    foreach ($dict[$category] as $hintObj) {
        if (is_array($hintObj)) {
            foreach ($hintObj as $hint => $words) {
                if (cleanWordPrompt($hint) === $cleanPrompt && is_array($words)) {
                    foreach ($words as $word) {
                        $cleaned = cleanWordPrompt($word);
                        if ($cleaned) {
                            $responses[] = $cleaned;
                        }
                    }
                }
            }
        }
    }
    
    return array_unique($responses);
}

function getRoundContext($category, $prompt) {
    $cleanPrompt = cleanWordPrompt($prompt);
    $responses = getResponsesByPrompt($category, $prompt);
    
    if (empty($responses)) {
        return [
            'prompt' => $cleanPrompt, 
            'synonyms' => [$cleanPrompt], 
            'variants' => [$cleanPrompt]
        ];
    }
    
    $variants = [$cleanPrompt];
    foreach ($responses as $resp) {
        $variants[] = $resp;
        $variants[] = $resp . 'S';
        $variants[] = $resp . 'A';
        $variants[] = $resp . 'O';
        if (strlen($resp) > 1) {
            $variants[] = substr($resp, 0, -1);
        }
    }
    
    return [
        'prompt' => $cleanPrompt, 
        'synonyms' => array_unique($responses),
        'variants' => array_unique(array_filter($variants))
    ];
}

function getActiveCodes() {
    $files = glob(GAME_STATES_DIR . '/*.json');
    $codes = [];

    if ($files) {
        foreach ($files as $file) {
            if (time() - filemtime($file) < MAX_GAME_AGE) {
                $codes[] = pathinfo($file, PATHINFO_FILENAME);
            } else {
                @unlink($file);
            }
        }
    }

    return $codes;
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
        } while (in_array($code, getActiveCodes()));
        
        return $code;
    }
    
    $allResponses = [];
    foreach ($categories as $category) {
        $responses = getAllResponsesByCategory($category);
        $allResponses = array_merge($allResponses, $responses);
    }
    
    $shortWords = array_filter($allResponses, function($w) {
        $length = mb_strlen($w);
        return $length >= 3 && $length <= MAX_CODE_LENGTH;
    });
    
    if (empty($shortWords)) {
        $shortWords = array_filter($allResponses, function($w) {
            return mb_strlen($w) <= MAX_CODE_LENGTH;
        });
    }
    
    $usedCodes = getActiveCodes();
    $freeCodes = array_diff($shortWords, $usedCodes);

    if (empty($freeCodes)) {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        do {
            $code = '';
            for ($i = 0; $i < 4; $i++) {
                $code .= $chars[rand(0, strlen($chars) - 1)];
            }
        } while (in_array($code, $usedCodes));

        if (mb_strlen($code) > MAX_CODE_LENGTH) {
            logMessage('[WARNING] Código generado excede MAX_CODE_LENGTH: ' . $code . ' (longitud: ' . mb_strlen($code) . ')', 'WARNING');
            $code = substr($code, 0, MAX_CODE_LENGTH);
        }
        
        return $code;
    }

    $freeCodes = array_values($freeCodes);
    $selected = $freeCodes[array_rand($freeCodes)];
    
    if (mb_strlen($selected) > MAX_CODE_LENGTH) {
        logMessage('[WARNING] Palabra seleccionada excede MAX_CODE_LENGTH: ' . $selected, 'WARNING');
        $selected = substr($selected, 0, MAX_CODE_LENGTH);
    }
    
    return $selected;
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
    
    if (!is_dir(GAME_STATES_DIR)) {
        logMessage('[WARN] game_states no existe. Intentando crear...', 'WARNING');
        if (!@mkdir(GAME_STATES_DIR, 0755, true)) {
            logMessage('[ERROR] No se pudo crear directorio: ' . GAME_STATES_DIR, 'ERROR');
            return false;
        }
    }
    
    if (!is_writable(GAME_STATES_DIR)) {
        logMessage('[ERROR] Directorio NO tiene permisos de escritura: ' . GAME_STATES_DIR . ' | Permisos: ' . substr(sprintf('%o', fileperms(GAME_STATES_DIR)), -4), 'ERROR');
        return false;
    }
    
    $state['_version'] = 1;
    $state['_updated_at'] = time();
    
    $file = GAME_STATES_DIR . '/' . $gameId . '.json';
    $lockFile = $file . '.lock';
    
    $lock = @fopen($lockFile, 'c+');
    if (!$lock) {
        logMessage('[ERROR] No se pudo abrir lockfile: ' . $lockFile . ' (Permisos: ' . substr(sprintf('%o', @fileperms(dirname($lockFile))), -4) . ')', 'ERROR');
        return false;
    }
    
    if (!@flock($lock, LOCK_EX)) {
        logMessage('[ERROR] No se pudo obtener lock para ' . $gameId, 'ERROR');
        fclose($lock);
        return false;
    }
    
    try {
        $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

        if ($json === false) {
            logMessage('[ERROR] Error encoding JSON: ' . json_last_error_msg() . ' | State: ' . var_export(array_keys($state), true), 'ERROR');
            return false;
        }
        
        $jsonSize = strlen($json);
        if ($jsonSize > 1000000) {
            logMessage('[ERROR] JSON demasiado grande: ' . $jsonSize . ' bytes', 'ERROR');
            return false;
        }

        $result = @file_put_contents($file, $json, LOCK_EX);

        if ($result === false) {
            logMessage('[ERROR] Error escribiendo archivo: ' . $file . ' | Permisos dir: ' . substr(sprintf('%o', @fileperms(dirname($file))), -4), 'ERROR');
            return false;
        }
        
        if (!file_exists($file)) {
            logMessage('[ERROR] Archivo no existe después de escribir: ' . $file, 'ERROR');
            return false;
        }
        
        $fileSize = filesize($file);
        if ($fileSize === 0 || $fileSize === false) {
            logMessage('[ERROR] Archivo está vacío o no se puede leer: ' . $file . ' | Size: ' . var_export($fileSize, true), 'ERROR');
            return false;
        }
        
        trackGameAction($gameId, 'state_updated', ['players' => count($state['players'] ?? []), 'status' => $state['status'] ?? 'unknown']);
        
        logMessage('[SUCCESS] Estado guardado para ' . $gameId . ' | Size: ' . $fileSize . ' bytes', 'DEBUG');
        return true;
        
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
        @unlink($lockFile);
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
    
    $file = GAME_STATES_DIR . '/' . $gameId . '.json';

    if (!file_exists($file)) {
        logMessage('[DEBUG] Archivo no existe: ' . $file, 'DEBUG');
        return null;
    }

    if (time() - filemtime($file) > MAX_GAME_AGE) {
        logMessage('[INFO] Archivo antiguo eliminado: ' . $gameId, 'INFO');
        @unlink($file);
        return null;
    }

    $json = @file_get_contents($file);
    if ($json === false) {
        logMessage('[ERROR] No se pudo leer archivo: ' . $file . ' | Permisos: ' . substr(sprintf('%o', @fileperms($file)), -4), 'ERROR');
        return null;
    }
    
    $state = json_decode($json, true);

    if (!$state) {
        logMessage('[ERROR] Error decoding JSON: ' . json_last_error_msg() . ' | File: ' . $file, 'ERROR');
        return null;
    }

    if (!isset($state['_version'])) {
        $state['_version'] = 0;
    }

    return $state;
}

function cleanupOldGames() {
    $files = glob(GAME_STATES_DIR . '/*.json');
    $deleted = 0;

    if ($files) {
        foreach ($files as $file) {
            if (time() - filemtime($file) > MAX_GAME_AGE) {
                if (@unlink($file)) {
                    $deleted++;
                    logMessage('[INFO] Juego antiguo eliminado: ' . basename($file), 'INFO');
                }
            }
        }
    }
    
    $locks = glob(GAME_STATES_DIR . '/*.lock');
    if ($locks) {
        foreach ($locks as $lock) {
            if (time() - filemtime($lock) > 300) {
                @unlink($lock);
            }
        }
    }

    return $deleted;
}

function getRandomWord() {
    $words = getAllWords();

    if (empty($words)) {
        logMessage('[WARN] No hay palabras disponibles, usando fallback', 'WARNING');
        return 'JUEGO';
    }

    return $words[array_rand($words)];
}

function getRandomWordFromCategory($category) {
    $words = getWordsByCategory($category);
    if (empty($words)) {
        return getRandomWord();
    }
    return $words[array_rand($words)];
}

function getRandomWordByCategoryFiltered($category, $maxLength = null) {
    if ($maxLength === null) {
        $maxLength = MAX_CODE_LENGTH;
    }

    $responses = getAllResponsesByCategory($category);
    if (empty($responses)) {
        return null;
    }

    $filtered = array_filter($responses, function($word) use ($maxLength) {
        return mb_strlen($word) <= $maxLength;
    });

    if (empty($filtered)) {
        logMessage("[WARN] No hay respuestas en '{$category}' con longitud ≤ {$maxLength}", 'WARNING');
        return null;
    }

    $filtered = array_values($filtered);
    return $filtered[array_rand($filtered)];
}

function gameExists($gameId) {
    $gameId = sanitizeGameId($gameId);
    if (!$gameId) return false;
    if (strlen($gameId) > MAX_CODE_LENGTH) return false;
    $file = GAME_STATES_DIR . '/' . $gameId . '.json';
    return file_exists($file) && (time() - filemtime($file) < MAX_GAME_AGE);
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
        $words = flattenWords([$categoria => $content]);
        $cleanedWords = array_map('cleanWordPrompt', $words);
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

function trackGameAction($gameId, $action, $data = []) {
    $entry = [
        'timestamp' => time(),
        'game_id' => $gameId,
        'action' => $action,
        'data' => $data
    ];
    
    $analytics = [];
    if (file_exists(ANALYTICS_FILE)) {
        $json = @file_get_contents(ANALYTICS_FILE);
        $analytics = json_decode($json, true) ?? [];
    }
    
    $analytics[] = $entry;
    
    if (count($analytics) > 1000) {
        $analytics = array_slice($analytics, -1000);
    }
    
    @file_put_contents(ANALYTICS_FILE, json_encode($analytics, JSON_PRETTY_PRINT));
}

if (rand(1, 100) <= (CLEANUP_PROBABILITY * 100)) {
    cleanupOldGames();
}
?>