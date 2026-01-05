<?php

define('APP_ENV', getenv('APP_ENV') ?: 'development');
define('APP_DEBUG', APP_ENV === 'development');
define('DB_PATH', __DIR__ . '/talcual.db');
define('LOG_PATH', __DIR__ . '/logs');
define('MAX_GAME_DURATION', 3600);
define('MAX_CATEGORY_LENGTH', 100);
define('MAX_WORD_LENGTH', 50);
define('MAX_CODE_LENGTH', 4);

function logMessage($message, $level = 'INFO') {
    if (!is_dir(LOG_PATH)) {
        @mkdir(LOG_PATH, 0755, true);
    }
    $timestamp = date('Y-m-d H:i:s');
    $logFile = LOG_PATH . '/' . date('Y-m-d') . '.log';
    error_log("[$timestamp] [$level] $message\n", 3, $logFile);
    if (APP_DEBUG) {
        error_log("[$timestamp] [$level] $message");
    }
}

function sanitizeText($text) {
    return htmlspecialchars(trim($text), ENT_QUOTES, 'UTF-8');
}

function sanitizeWord($word) {
    return sanitizeText(strtoupper($word));
}

?>
