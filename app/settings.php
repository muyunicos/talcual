<?php
$dotenv = __DIR__ . '/../.env';
$config = [];

if (file_exists($dotenv)) {
    $lines = file($dotenv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $config[trim($parts[0])] = trim($parts[1]);
        }
    }
}

$getenv = function($key, $default) use ($config) {
    if (isset($config[$key])) {
        $val = $config[$key];
        if ($val === 'true') return true;
        if ($val === 'false') return false;
        if (is_numeric($val)) return (int)$val;
        return $val;
    }
    return $default;
};

define('DEV_MODE', $getenv('DEV_MODE', false) === true || $getenv('DEV_MODE', false) === 'true');
define('MIN_PLAYERS', $getenv('MIN_PLAYERS', 3));
define('MAX_PLAYERS', $getenv('MAX_PLAYERS', 8));
define('ROUND_DURATION', $getenv('ROUND_DURATION', 120));
define('TOTAL_ROUNDS', $getenv('TOTAL_ROUNDS', 3));
define('START_COUNTDOWN', $getenv('START_COUNTDOWN', 5));
define('HURRY_UP_THRESHOLD', $getenv('HURRY_UP_THRESHOLD', 10));
define('MAX_WORDS_PER_PLAYER', $getenv('MAX_WORDS_PER_PLAYER', 6));
define('MAX_WORD_LENGTH', $getenv('MAX_WORD_LENGTH', 30));
define('MAX_CODE_LENGTH', $getenv('MAX_CODE_LENGTH', 5));
define('MAX_GAME_AGE', $getenv('MAX_GAME_AGE', 86400));
define('CLEANUP_PROBABILITY', $getenv('CLEANUP_PROBABILITY', 0.05));
define('RATE_LIMIT_REQUESTS', 100);
define('RATE_LIMIT_WINDOW', 60);
define('SSE_TIMEOUT', $getenv('SSE_TIMEOUT', 900));
define('SSE_HEARTBEAT_INTERVAL', $getenv('SSE_HEARTBEAT_INTERVAL', 15));
?>
