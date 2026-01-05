<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');
ini_set('log_errors', '1');

header('Content-Type: application/json');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/GameRepository.php';
require_once __DIR__ . '/DictionaryRepository.php';
require_once __DIR__ . '/GameService.php';

try {
    echo json_encode([
        'debug' => true,
        'step1_config_loaded' => true,
        'constants' => [
            'MAX_CODE_LENGTH' => defined('MAX_CODE_LENGTH') ? MAX_CODE_LENGTH : 'UNDEFINED',
            'TOTAL_ROUNDS' => defined('TOTAL_ROUNDS') ? TOTAL_ROUNDS : 'UNDEFINED'
        ]
    ]);
    exit;
} catch (Throwable $e) {
    echo json_encode([
        'debug' => true,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => explode("\n", $e->getTraceAsString())
    ]);
    exit;
}
?>
