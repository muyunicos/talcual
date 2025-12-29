<?php
// Configuración del juego

require_once __DIR__ . '/settings.php';

// Crear directorio si no existe
if (!is_dir(GAME_STATES_DIR)) {
    $mkdir_result = @mkdir(GAME_STATES_DIR, 0755, true);
    if (!$mkdir_result) {
        error_log('[CRITICAL] No se pudo crear directorio: ' . GAME_STATES_DIR);
    }
}

// Logging seguro
function logMessage($message, $level = 'INFO') {
    if (!DEV_MODE && $level === 'DEBUG') return;
    
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[{$timestamp}] [{$level}] {$message}\n";
    
    if (DEV_MODE) {
        error_log($logMessage);
    }
}

// Cargar diccionario (con caché)
function loadDictionary() {
    static $cache = null;

    if ($cache === null) {
        $file = DICTIONARY_FILE;

        if (!file_exists($file)) {
            logMessage('Diccionario no encontrado, usando fallback', 'WARNING');
            return [
                'categorias' => [
                    'GENERAL' => ['CASA', 'SOL', 'MAR', 'LUNA', 'NUBE']
                ]
            ];
        }

        $json = file_get_contents($file);
        $cache = json_decode($json, true);

        if (!$cache) {
            logMessage('Error decodificando diccionario: ' . json_last_error_msg(), 'ERROR');
            $cache = [
                'categorias' => [
                    'GENERAL' => ['CASA', 'SOL', 'MAR', 'LUNA', 'NUBE']
                ]
            ];
        }
    }

    return $cache;
}

// Obtener todas las palabras (para el juego)
function getAllWords() {
    $dict = loadDictionary();
    $words = [];

    if (isset($dict['categorias'])) {
        foreach ($dict['categorias'] as $categoria => $palabras) {
            $words = array_merge($words, $palabras);
        }
    }

    // Eliminar duplicados (no ordenar, es innecesario para random - MEJORA #17)
    return array_unique($words);
}

// Obtener palabras de una categoría específica
function getWordsByCategory($category) {
    $dict = loadDictionary();

    if (isset($dict['categorias'][$category])) {
        return $dict['categorias'][$category];
    }

    return [];
}

// Obtener todas las categorías disponibles
function getCategories() {
    $dict = loadDictionary();

    if (isset($dict['categorias'])) {
        return array_keys($dict['categorias']);
    }

    return [];
}

// Obtener códigos activos de salas
function getActiveCodes() {
    $files = glob(GAME_STATES_DIR . '/*.json');
    $codes = [];

    if ($files) {
        foreach ($files as $file) {
            // Verificar que el archivo no sea muy viejo
            if (time() - filemtime($file) < MAX_GAME_AGE) {
                $codes[] = pathinfo($file, PATHINFO_FILENAME);
            } else {
                // Eliminar archivos viejos
                @unlink($file);
            }
        }
    }

    return $codes;
}

// Generar código de sala automáticamente desde diccionario (MEJORA: usar palabras ≤30 letras)
function generateGameCode() {
    $allWords = getAllWords();
    
    // Filtrar palabras de 5 letras o menos
    $shortWords = array_filter($allWords, function($w) {
        return mb_strlen($w) <= MAX_CODE_LENGTH;
    });
    
    // Si no hay palabras cortas, fallback a palabras de hasta 6 letras
    if (empty($shortWords)) {
        $shortWords = array_filter($allWords, function($w) {
            return mb_strlen($w) <= 6;
        });
    }
    
    // Filtrar códigos no usados
    $usedCodes = getActiveCodes();
    $freeCodes = array_diff($shortWords, $usedCodes);

    if (empty($freeCodes)) {
        // Fallback: Generar código aleatorio
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        do {
            $code = '';
            for ($i = 0; $i < 4; $i++) {
                $code .= $chars[rand(0, strlen($chars) - 1)];
            }
        } while (in_array($code, $usedCodes));

        return $code;
    }

    $freeCodes = array_values($freeCodes);
    return $freeCodes[array_rand($freeCodes)];
}

// Sanitizar y validar código de sala (MEJORA #1: Seguridad)
function sanitizeGameId($gameId) {
    if (empty($gameId)) return null;
    
    // Solo permitir letras y números, máximo 6 caracteres
    $clean = preg_replace('/[^A-Z0-9]/', '', strtoupper($gameId));
    
    if (strlen($clean) < 3 || strlen($clean) > 6) {
        return null;
    }
    
    return $clean;
}

// Sanitizar player ID (MEJORA #1: Seguridad)
function sanitizePlayerId($playerId) {
    if (empty($playerId)) return null;
    
    // Solo permitir caracteres alfanuméricos y guión bajo
    $clean = preg_replace('/[^a-zA-Z0-9_]/', '', $playerId);
    
    if (strlen($clean) < 5 || strlen($clean) > 50) {
        return null;
    }
    
    return $clean;
}

// Validar color de jugador (MEJORA #7: Validación de colores)
function validatePlayerColor($color) {
    if (empty($color)) return null;
    
    // Formato esperado: "#RRGGBB,#RRGGBB"
    $parts = explode(',', $color);
    
    if (count($parts) !== 2) return null;
    
    foreach ($parts as $part) {
        if (!preg_match('/^#[0-9A-Fa-f]{6}$/', trim($part))) {
            return null;
        }
    }
    
    return $color;
}

// Guardar estado del juego con lock mejorado (MEJORA #2: Race conditions)
function saveGameState($gameId, $state) {
    $gameId = sanitizeGameId($gameId);
    if (!$gameId) {
        logMessage('Intento de guardar con gameId inválido', 'ERROR');
        return false;
    }
    
    // ============ NUEVA VALIDACIÓN: Verificar directorio ============
    if (!is_dir(GAME_STATES_DIR)) {
        logMessage('[WARN] game_states no existe. Intentando crear...', 'WARNING');
        if (!@mkdir(GAME_STATES_DIR, 0755, true)) {
            logMessage('[ERROR] No se pudo crear directorio: ' . GAME_STATES_DIR, 'ERROR');
            return false;
        }
    }
    
    // ============ NUEVA VALIDACIÓN: Verificar permisos ============
    if (!is_writable(GAME_STATES_DIR)) {
        logMessage('[ERROR] Directorio NO tiene permisos de escritura: ' . GAME_STATES_DIR . ' | Permisos: ' . substr(sprintf('%o', fileperms(GAME_STATES_DIR)), -4), 'ERROR');
        return false;
    }
    
    // Agregar versión del estado (MEJORA #13)
    $state['_version'] = 1;
    $state['_updated_at'] = time();
    
    $file = GAME_STATES_DIR . '/' . $gameId . '.json';
    $lockFile = $file . '.lock';
    
    // Obtener lock exclusivo
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
        // Forzar objetos vacíos como objetos JSON
        $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

        if ($json === false) {
            logMessage('[ERROR] Error encoding JSON: ' . json_last_error_msg() . ' | State: ' . var_export(array_keys($state), true), 'ERROR');
            return false;
        }
        
        // ============ NUEVA VALIDACIÓN: Verificar tamaño ============
        $jsonSize = strlen($json);
        if ($jsonSize > 1000000) { // 1MB máximo
            logMessage('[ERROR] JSON demasiado grande: ' . $jsonSize . ' bytes', 'ERROR');
            return false;
        }

        $result = @file_put_contents($file, $json, LOCK_EX);

        if ($result === false) {
            logMessage('[ERROR] Error escribiendo archivo: ' . $file . ' | Permisos dir: ' . substr(sprintf('%o', @fileperms(dirname($file))), -4), 'ERROR');
            return false;
        }
        
        // ============ NUEVA VALIDACIÓN: Verificar que se escribió correctamente ============
        if (!file_exists($file)) {
            logMessage('[ERROR] Archivo no existe después de escribir: ' . $file, 'ERROR');
            return false;
        }
        
        $fileSize = filesize($file);
        if ($fileSize === 0 || $fileSize === false) {
            logMessage('[ERROR] Archivo está vacío o no se puede leer: ' . $file . ' | Size: ' . var_export($fileSize, true), 'ERROR');
            return false;
        }
        
        // Registrar en analytics (MEJORA #10)
        trackGameAction($gameId, 'state_updated', ['players' => count($state['players'] ?? []), 'status' => $state['status'] ?? 'unknown']);
        
        logMessage('[SUCCESS] Estado guardado para ' . $gameId . ' | Size: ' . $fileSize . ' bytes', 'DEBUG');
        return true;
        
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
        @unlink($lockFile);
    }
}

// Cargar estado del juego con lock (MEJORA #2: Race conditions)
function loadGameState($gameId) {
    $gameId = sanitizeGameId($gameId);
    if (!$gameId) {
        logMessage('[ERROR] Intento de cargar con gameId inválido', 'ERROR');
        return null;
    }
    
    $file = GAME_STATES_DIR . '/' . $gameId . '.json';

    if (!file_exists($file)) {
        logMessage('[DEBUG] Archivo no existe: ' . $file, 'DEBUG');
        return null;
    }

    // Verificar que no sea muy viejo
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

    // Migración de versiones si es necesario (MEJORA #13)
    if (!isset($state['_version'])) {
        $state['_version'] = 0;
        // Aquí podrías agregar lógica de migración
    }

    return $state;
}

// Eliminar estados de juego viejos (MEJORA #16: Mejorado)
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
    
    // Limpiar locks huérfanos
    $locks = glob(GAME_STATES_DIR . '/*.lock');
    if ($locks) {
        foreach ($locks as $lock) {
            if (time() - filemtime($lock) > 300) { // 5 minutos
                @unlink($lock);
            }
        }
    }

    return $deleted;
}

// Seleccionar palabra aleatoria del juego
function getRandomWord() {
    $words = getAllWords();

    if (empty($words)) {
        logMessage('[WARN] No hay palabras disponibles, usando fallback', 'WARNING');
        return 'JUEGO';
    }

    return $words[array_rand($words)];
}

// Seleccionar palabra aleatoria de una categoría
function getRandomWordFromCategory($category) {
    $words = getWordsByCategory($category);

    if (empty($words)) {
        return getRandomWord();
    }

    return $words[array_rand($words)];
}

// Verificar si un código de sala existe
function gameExists($gameId) {
    $gameId = sanitizeGameId($gameId);
    if (!$gameId) return false;
    
    $file = GAME_STATES_DIR . '/' . $gameId . '.json';
    return file_exists($file) && (time() - filemtime($file) < MAX_GAME_AGE);
}

// Obtener estadísticas del diccionario
function getDictionaryStats() {
    $dict = loadDictionary();

    $stats = [
        'categorias' => count($dict['categorias'] ?? []),
        'total_palabras' => 0,
        'palabras_codigo' => 0,
        'categorias_detalle' => []
    ];

    if (isset($dict['categorias'])) {
        foreach ($dict['categorias'] as $categoria => $palabras) {
            $count = count($palabras);
            $stats['total_palabras'] += $count;
            $stats['categorias_detalle'][$categoria] = $count;
            
            // Contar palabras que sirven para código
            foreach ($palabras as $palabra) {
                if (mb_strlen($palabra) <= MAX_CODE_LENGTH) {
                    $stats['palabras_codigo']++;
                }
            }
        }
    }

    return $stats;
}

// Analytics básico (MEJORA #10)
function trackGameAction($gameId, $action, $data = []) {
    if (!DEV_MODE && !file_exists(ANALYTICS_FILE)) {
        // Solo trackear en producción si analytics existe
        return;
    }
    
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
    
    // Mantener solo últimas 1000 entradas
    if (count($analytics) > 1000) {
        $analytics = array_slice($analytics, -1000);
    }
    
    @file_put_contents(ANALYTICS_FILE, json_encode($analytics, JSON_PRETTY_PRINT));
}

// Validar palabra del jugador (MEJORA #14, #20)
function validatePlayerWord($word, $currentWord = '') {
    if (empty($word)) {
        return ['valid' => false, 'error' => 'Palabra vacía'];
    }
    
    $word = trim($word);
    
    // Validar longitud
    if (mb_strlen($word) > MAX_WORD_LENGTH) {
        return ['valid' => false, 'error' => 'Palabra demasiado larga'];
    }
    
    // No permitir espacios (MEJORA #20)
    if (strpos($word, ' ') !== false) {
        return ['valid' => false, 'error' => 'No se permiten espacios'];
    }
    
    // No permitir la palabra actual
    if (!empty($currentWord) && strtoupper($word) === strtoupper($currentWord)) {
        return ['valid' => false, 'error' => 'No puedes usar la palabra actual'];
    }
    
    return ['valid' => true];
}

// Ejecutar limpieza automática mejorada (MEJORA #16)
if (rand(1, 100) <= (CLEANUP_PROBABILITY * 100)) {
    cleanupOldGames();
}
?>