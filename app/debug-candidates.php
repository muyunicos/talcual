<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');

header('Content-Type: application/json');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/GameRepository.php';
require_once __DIR__ . '/DictionaryRepository.php';
require_once __DIR__ . '/GameService.php';

try {
    $response = [
        'debug' => true,
        'steps' => []
    ];
    
    $response['steps'][] = 'Config loaded';
    
    $response['steps'][] = 'Creating DictionaryRepository';
    $dictRepo = new DictionaryRepository();
    
    $response['steps'][] = 'Getting categories';
    $categories = $dictRepo->getCategories();
    $response['categories'] = $categories;
    $response['category_count'] = count($categories);
    
    if (empty($categories)) {
        $response['error'] = 'No categories found';
        echo json_encode($response);
        exit;
    }
    
    $response['steps'][] = 'Creating GameRepository';
    $gameRepo = new GameRepository();
    
    $response['steps'][] = 'Creating GameService';
    $service = new GameService($gameRepo, $dictRepo);
    
    $response['steps'][] = 'Calling getGameCandidates()';
    $candidates = $service->getGameCandidates();
    
    $response['steps'][] = 'Success';
    $response['candidates'] = $candidates;
    
} catch (Throwable $e) {
    $response['error'] = $e->getMessage();
    $response['file'] = $e->getFile();
    $response['line'] = $e->getLine();
    $response['class'] = get_class($e);
    $response['trace'] = array_slice(explode("\n", $e->getTraceAsString()), 0, 10);
    $response['last_step'] = $response['steps'][count($response['steps']) - 1] ?? 'Unknown';
}

echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?>
