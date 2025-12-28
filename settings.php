<?php
// Configuración Global - TalCual Party
// MEJORA: Soporte para variables de entorno (.env)

// Cargar variables de entorno si existe .env
if (file_exists(__DIR__ . '/.env')) {
    $envFile = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($envFile as $line) {
        if (strpos(trim($line), '#') === 0 || strpos($line, '=') === false) {
            continue;
        }
        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }
}

// Helper para obtener valor de entorno con fallback
function env($key, $default = null) {
    $value = getenv($key);
    if ($value === false) {
        return $default;
    }
    // Convertir strings booleanos
    if (strtolower($value) === 'true') return true;
    if (strtolower($value) === 'false') return false;
    return $value;
}

// MODO DE DESARROLLO
define('DEV_MODE', env('DEV_MODE', false));

// CONFIGURACIÓN DEL JUEGO
define('MIN_PLAYERS', (int)env('MIN_PLAYERS', 3));
define('MAX_PLAYERS', (int)env('MAX_PLAYERS', 20));
define('DEFAULT_ROUND_DURATION', (int)env('DEFAULT_ROUND_DURATION', 120));
define('DEFAULT_TOTAL_ROUNDS', (int)env('DEFAULT_TOTAL_ROUNDS', 3));
define('MAX_WORDS_PER_PLAYER', (int)env('MAX_WORDS_PER_PLAYER', 6));
define('MAX_WORD_LENGTH', (int)env('MAX_WORD_LENGTH', 30));
define('MAX_CODE_LENGTH', (int)env('MAX_CODE_LENGTH', 5));

// CONFIGURACIÓN DE ARCHIVOS
define('GAME_STATES_DIR', __DIR__ . '/game_states');
define('ANALYTICS_FILE', __DIR__ . '/analytics.json');
define('DICTIONARY_FILE', __DIR__ . '/diccionario.json');

// CONFIGURACIÓN DE LIMPIEZA (MEJORA: aumentada a 5% para mejor limpieza)
define('MAX_GAME_AGE', (int)env('MAX_GAME_AGE', 86400)); // 24 horas
define('CLEANUP_PROBABILITY', (float)env('CLEANUP_PROBABILITY', 0.05)); // 5%

// CONFIGURACIÓN SSE (MEJORA: timeout reducido a 15 min para evitar problemas)
define('SSE_TIMEOUT', (int)env('SSE_TIMEOUT', 900)); // 15 minutos
define('SSE_HEARTBEAT_INTERVAL', (int)env('SSE_HEARTBEAT_INTERVAL', 15));

// CONFIGURACIÓN PHP
if (DEV_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
    ini_set('log_errors', 1);
    ini_set('error_log', __DIR__ . '/debug.log');
} else {
    error_reporting(E_ERROR | E_WARNING);
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
}

// MEJORA: Aumentar límites para SSE
if (function_exists('ini_set')) {
    @ini_set('max_execution_time', SSE_TIMEOUT);
    @ini_set('memory_limit', '128M');
}
?>
