<?php
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/WordNormalizer.php';

define('LOG_LEVEL_ERROR', 1);
define('LOG_LEVEL_WARN', 2);
define('LOG_LEVEL_INFO', 3);
define('LOG_LEVEL_DEBUG', 4);

function getLogLevel() {
    static $logLevel = null;
    if ($logLevel === null) {
        $level = getenv('LOG_LEVEL') ?: 'INFO';
        $levels = ['ERROR' => LOG_LEVEL_ERROR, 'WARN' => LOG_LEVEL_WARN, 'INFO' => LOG_LEVEL_INFO, 'DEBUG' => LOG_LEVEL_DEBUG];
        $logLevel = $levels[$level] ?? LOG_LEVEL_INFO;
    }
    return $logLevel;
}

function logMessage($message, $level = 'INFO') {
    $levelMap = ['ERROR' => LOG_LEVEL_ERROR, 'WARN' => LOG_LEVEL_WARN, 'INFO' => LOG_LEVEL_INFO, 'DEBUG' => LOG_LEVEL_DEBUG];
    $currentLevel = $levelMap[$level] ?? LOG_LEVEL_INFO;
    
    if ($currentLevel > getLogLevel()) {
        return;
    }
    
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[{$timestamp}] [{$level}] {$message}\n";
    error_log($logMessage);
}
?>
