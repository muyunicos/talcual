<?php
// Configuración del juego Unánimo Party

// Directorio donde se guardan los estados de juego
define('GAME_STATES_DIR', __DIR__ . '/game_states');

// Crear directorio si no existe
if (!is_dir(GAME_STATES_DIR)) {
    mkdir(GAME_STATES_DIR, 0755, true);
}

// Cargar diccionario (con caché)
function loadDictionary() {
    static $cache = null;

    if ($cache === null) {
        $file = __DIR__ . '/diccionario.json';

        if (!file_exists($file)) {
            // Fallback si no existe el archivo
            return [
                'codigos_sala' => ['JUEGO', 'PARTY', 'SALA', 'GAME', 'PLAY'],
                'categorias' => [
                    'GENERAL' => ['CASA', 'SOL', 'MAR', 'LUNA', 'NUBE']
                ]
            ];
        }

        $json = file_get_contents($file);
        $cache = json_decode($json, true);

        if (!$cache) {
            // Error al decodificar, usar fallback
            $cache = [
                'codigos_sala' => ['JUEGO', 'PARTY', 'SALA', 'GAME', 'PLAY'],
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

    // Eliminar duplicados y ordenar
    $words = array_unique($words);
    sort($words);

    return $words;
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
            // Verificar que el archivo no sea muy viejo (más de 24 horas)
            if (time() - filemtime($file) < 86400) {
                $codes[] = pathinfo($file, PATHINFO_FILENAME);
            } else {
                // Eliminar archivos viejos
                @unlink($file);
            }
        }
    }

    return $codes;
}

// Generar código de sala con palabra real del diccionario
function generateGameCode() {
    $dict = loadDictionary();
    $availableCodes = isset($dict['codigos_sala']) ? $dict['codigos_sala'] : [];

    // Filtrar códigos no usados
    $usedCodes = getActiveCodes();
    $freeCodes = array_diff($availableCodes, $usedCodes);

    if (empty($freeCodes)) {
        // Fallback 1: Todas las palabras de máximo 5 letras del diccionario
        $allWords = getAllWords();
        $shortWords = array_filter($allWords, function($w) {
            return mb_strlen($w) <= 5;
        });
        $freeCodes = array_diff($shortWords, $usedCodes);

        if (empty($freeCodes)) {
            // Fallback 2: Generar código aleatorio
            $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            do {
                $code = '';
                for ($i = 0; $i < 4; $i++) {
                    $code .= $chars[rand(0, strlen($chars) - 1)];
                }
            } while (in_array($code, $usedCodes));

            return $code;
        }
    }

    $freeCodes = array_values($freeCodes); // Reindexar
    return $freeCodes[array_rand($freeCodes)];
}

// Guardar estado del juego
function saveGameState($gameId, $state) {
    $file = GAME_STATES_DIR . '/' . $gameId . '.json';

    // Convertir arrays vacíos a objetos para JSON
    if (isset($state['players']) && is_array($state['players']) && empty($state['players'])) {
        $state['players'] = new stdClass();
    }
    if (isset($state['round_details']) && is_array($state['round_details']) && empty($state['round_details'])) {
        $state['round_details'] = new stdClass();
    }
    if (isset($state['game_history']) && is_array($state['game_history']) && empty($state['game_history'])) {
        $state['game_history'] = new stdClass();
    }

    $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

    if ($json === false) {
        error_log('Error encoding game state: ' . json_last_error_msg());
        return false;
    }

    $result = file_put_contents($file, $json, LOCK_EX);

    if ($result === false) {
        error_log('Error writing game state file: ' . $file);
        return false;
    }

    return true;
}

// Cargar estado del juego
function loadGameState($gameId) {
    $file = GAME_STATES_DIR . '/' . $gameId . '.json';

    if (!file_exists($file)) {
        return null;
    }

    // Verificar que no sea muy viejo
    if (time() - filemtime($file) > 86400) {
        @unlink($file);
        return null;
    }

    $json = file_get_contents($file);
    $state = json_decode($json, true);

    if (!$state) {
        error_log('Error decoding game state: ' . json_last_error_msg());
        return null;
    }

    // Convertir objetos vacíos en arrays para PHP
    if (isset($state['players']) && is_object($state['players']) && empty((array)$state['players'])) {
        $state['players'] = [];
    }
    if (isset($state['round_details']) && is_object($state['round_details']) && empty((array)$state['round_details'])) {
        $state['round_details'] = [];
    }
    if (isset($state['game_history']) && is_object($state['game_history']) && empty((array)$state['game_history'])) {
        $state['game_history'] = [];
    }

    return $state;
}

// Eliminar estados de juego viejos (más de 24 horas)
function cleanupOldGames() {
    $files = glob(GAME_STATES_DIR . '/*.json');
    $deleted = 0;

    if ($files) {
        foreach ($files as $file) {
            if (time() - filemtime($file) > 86400) {
                if (@unlink($file)) {
                    $deleted++;
                }
            }
        }
    }

    return $deleted;
}

// Obtener lista de palabras (alias para compatibilidad)
function getWordList() {
    return getAllWords();
}

// Seleccionar palabra aleatoria del juego
function getRandomWord() {
    $words = getAllWords();

    if (empty($words)) {
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
    $file = GAME_STATES_DIR . '/' . $gameId . '.json';
    return file_exists($file) && (time() - filemtime($file) < 86400);
}

// Obtener estadísticas del diccionario
function getDictionaryStats() {
    $dict = loadDictionary();

    $stats = [
        'codigos_sala' => count($dict['codigos_sala'] ?? []),
        'categorias' => count($dict['categorias'] ?? []),
        'total_palabras' => 0,
        'categorias_detalle' => []
    ];

    if (isset($dict['categorias'])) {
        foreach ($dict['categorias'] as $categoria => $palabras) {
            $count = count($palabras);
            $stats['total_palabras'] += $count;
            $stats['categorias_detalle'][$categoria] = $count;
        }
    }

    return $stats;
}

// Ejecutar limpieza automática cada cierto tiempo
if (rand(1, 100) === 1) { // 1% de probabilidad en cada request
    cleanupOldGames();
}
?>