<?php
// Configuración Global - TalCual Party
// MEJORA: Soporte para variables de entorno (.env) con validación mejorada

// Helper para obtener valor de entorno con fallback (DEBE estar antes de usarse)
function env($key, $default = null) {
    $value = getenv($key);
    if ($value === false) {
        return $default;
    }
    // Convertir strings booleanos
    $valueLower = strtolower(trim($value));
    if ($valueLower === 'true') return true;
    if ($valueLower === 'false') return false;
    if ($valueLower === 'null') return null;
    return $value;
}

// Cargar variables de entorno si existe .env
$envPath = dirname(__DIR__, 2) . '/.env';
if (file_exists($envPath)) {
    $envFile = @file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($envFile) {
        foreach ($envFile as $line) {
            $line = trim($line);
            // Ignorar comentarios y líneas vacías
            if (empty($line) || strpos($line, '#') === 0) {
                continue;
            }
            // Parsear KEY=VALUE
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);
                // Remover comillas si existen
                if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
                    (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
                    $value = substr($value, 1, -1);
                }
                if (!empty($key) && !array_key_exists($key, $_ENV)) {
                    $_ENV[$key] = $value;
                    putenv("$key=$value");
                }
            }
        }
    }
}

// MODO DE DESARROLLO
define('DEV_MODE', env('DEV_MODE', false));

// CONFIGURACIÓN DEL JUEGO
define('MIN_PLAYERS', max(2, (int)env('MIN_PLAYERS', 3)));
define('MAX_PLAYERS', min(100, max(3, (int)env('MAX_PLAYERS', 20))));
define('DEFAULT_ROUND_DURATION', max(30, min(600, (int)env('DEFAULT_ROUND_DURATION', 120))));
define('DEFAULT_TOTAL_ROUNDS', max(1, min(10, (int)env('DEFAULT_TOTAL_ROUNDS', 3))));
define('MAX_WORDS_PER_PLAYER', max(1, min(20, (int)env('MAX_WORDS_PER_PLAYER', 6))));
define('MAX_WORD_LENGTH', max(10, min(100, (int)env('MAX_WORD_LENGTH', 30))));
define('MAX_CODE_LENGTH', max(3, min(10, (int)env('MAX_CODE_LENGTH', 5))));

// CONFIGURACIÓN DE ARCHIVOS
$rootDir = dirname(__DIR__, 2);
define('GAME_STATES_DIR', $rootDir . '/game_states');
define('ANALYTICS_FILE', $rootDir . '/analytics.json');
define('DICTIONARY_FILE', $rootDir . '/data/diccionario.json');

// CONFIGURACIÓN DE LIMPIEZA (MEJORA: aumentada a 5% para mejor limpieza)
define('MAX_GAME_AGE', max(3600, (int)env('MAX_GAME_AGE', 86400))); // Mínimo 1 hora
define('CLEANUP_PROBABILITY', max(0.0, min(1.0, (float)env('CLEANUP_PROBABILITY', 0.05)))); // Entre 0 y 1

// CONFIGURACIÓN SSE (MEJORA: timeout reducido a 15 min para evitar problemas)
define('SSE_TIMEOUT', max(60, min(3600, (int)env('SSE_TIMEOUT', 900)))); // Entre 1-60 min
define('SSE_HEARTBEAT_INTERVAL', max(5, min(60, (int)env('SSE_HEARTBEAT_INTERVAL', 15)))); // Entre 5-60 seg

// CONFIGURACIÓN PHP
if (DEV_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
    ini_set('log_errors', '1');
    ini_set('error_log', $rootDir . '/debug.log');
} else {
    error_reporting(E_ERROR | E_WARNING);
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');
}

// MEJORA: Aumentar límites para SSE
if (function_exists('ini_set')) {
    @ini_set('max_execution_time', (string)SSE_TIMEOUT);
    @ini_set('memory_limit', '128M');
    @ini_set('output_buffering', 'off');
    @ini_set('implicit_flush', '1');
}

// Deshabilitar buffering para SSE
if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', '1');
}

// VALIDACIÓN DE CONFIGURACIÓN
if (DEV_MODE) {
    // Verificar que MIN_PLAYERS <= MAX_PLAYERS
    if (MIN_PLAYERS > MAX_PLAYERS) {
        error_log('WARNING: MIN_PLAYERS (' . MIN_PLAYERS . ') es mayor que MAX_PLAYERS (' . MAX_PLAYERS . ')');
    }
}
?>