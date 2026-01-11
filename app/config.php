<?php
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/Database.php';

function logMessage($message, $level = 'INFO') {
    $levelMap = ['ERROR' => LOG_LEVEL_ERROR, 'WARN' => LOG_LEVEL_WARN, 'INFO' => LOG_LEVEL_INFO, 'DEBUG' => LOG_LEVEL_DEBUG];
    $currentLevel = $levelMap[$level] ?? LOG_LEVEL_INFO;
    
    if ($currentLevel > (DEV_MODE ? LOG_LEVEL_DEBUG : LOG_LEVEL_ERROR)) {
        return;
    }
    
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[{$timestamp}] [{$level}] {$message}\n";
    error_log($logMessage);
}
?>