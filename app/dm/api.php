<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../DictionaryRepository.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-cache, no-store, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    $manager = new DictionaryRepository();
    $action = $_GET['action'] ?? $_POST['action'] ?? null;
    $id = $_GET['id'] ?? $_POST['id'] ?? null;
    $categoryId = $_GET['category_id'] ?? $_POST['category_id'] ?? null;
    $categoryIds = isset($_POST['category_ids']) ? json_decode($_POST['category_ids'], true) : null;
    $promptId = $_GET['prompt_id'] ?? $_POST['prompt_id'] ?? null;
    $code = $_GET['code'] ?? $_POST['code'] ?? null;

    $response = ['success' => false, 'message' => 'Unknown action'];

    switch ($action) {
        case 'get_categories':
            $response = ['success' => true, 'data' => $manager->getCategoriesFull()];
            break;

        case 'get_category':
            if (!$id) throw new Exception('Missing category_id');
            $response = ['success' => true, 'data' => $manager->getCategoryById($id)];
            break;

        case 'add_category':
            if (!isset($_POST['name']) || empty($_POST['name'])) throw new Exception('Missing category name');
            $result = $manager->addCategory($_POST['name']);
            $response = ['success' => true, 'data' => $result, 'message' => 'Category added'];
            break;

        case 'update_category':
            if (!$id) throw new Exception('Missing category_id');
            if (!isset($_POST['name']) || empty($_POST['name'])) throw new Exception('Missing category name');
            $manager->updateCategory($id, $_POST['name']);
            $response = ['success' => true, 'message' => 'Category updated'];
            break;

        case 'delete_category':
            if (!$id) throw new Exception('Missing category_id');
            $manager->deleteCategory($id);
            $response = ['success' => true, 'message' => 'Category deleted'];
            break;

        case 'get_prompts':
            if (!$categoryId) throw new Exception('Missing category_id');
            $response = ['success' => true, 'data' => $manager->getPromptsWithStats($categoryId)];
            break;

        case 'get_prompt':
            if (!$id) throw new Exception('Missing prompt_id');
            $response = ['success' => true, 'data' => $manager->getPromptById($id)];
            break;

        case 'add_prompt':
            $cats = $categoryIds ?? (isset($_POST['category_id']) ? [$_POST['category_id']] : null);
            if (!$cats) throw new Exception('Missing category_id or category_ids');
            if (!isset($_POST['text']) || empty($_POST['text'])) throw new Exception('Missing prompt text');
            $promptId = $manager->addPrompt($cats, $_POST['text']);
            $response = ['success' => true, 'data' => ['id' => $promptId], 'message' => 'Prompt added'];
            break;

        case 'update_prompt':
            if (!$id) throw new Exception('Missing prompt_id');
            if (!isset($_POST['text']) || empty($_POST['text'])) throw new Exception('Missing prompt text');
            $manager->updatePrompt($id, $_POST['text'], $categoryIds);
            $response = ['success' => true, 'message' => 'Prompt updated'];
            break;

        case 'delete_prompt':
            if (!$id) throw new Exception('Missing prompt_id');
            $manager->deleteValidWordsByPrompt($id);
            $manager->deletePrompt($id);
            $response = ['success' => true, 'message' => 'Prompt and its words deleted'];
            break;

        case 'get_words':
            if (!$promptId) throw new Exception('Missing prompt_id');
            $response = ['success' => true, 'data' => $manager->getValidWords($promptId)];
            break;

        case 'get_word':
            if (!$id) throw new Exception('Missing word_id');
            $response = ['success' => true, 'data' => $manager->getValidWordById($id)];
            break;

        case 'add_word':
            if (!$promptId) throw new Exception('Missing prompt_id');
            if (!isset($_POST['word']) || empty($_POST['word'])) throw new Exception('Missing word entry');
            $wordId = $manager->addValidWord($promptId, $_POST['word']);
            $response = ['success' => true, 'data' => ['id' => $wordId], 'message' => 'Word added'];
            break;

        case 'update_word':
            if (!$id) throw new Exception('Missing word_id');
            if (!isset($_POST['word']) || empty($_POST['word'])) throw new Exception('Missing word entry');
            $manager->updateValidWord($id, $_POST['word']);
            $response = ['success' => true, 'message' => 'Word updated'];
            break;

        case 'delete_word':
            if (!$id) throw new Exception('Missing word_id');
            $manager->deleteValidWord($id);
            $response = ['success' => true, 'message' => 'Word deleted'];
            break;

        case 'stats':
            $response = ['success' => true, 'data' => $manager->getStats()];
            break;

        case 'get_games':
            $response = ['success' => true, 'data' => $manager->getGames()];
            break;

        case 'get_game':
            if (!$code) throw new Exception('Missing game code');
            $response = ['success' => true, 'data' => $manager->getGameByCode($code)];
            break;

        case 'delete_game':
            if (!$code) throw new Exception('Missing game code');
            $manager->deleteGame($code);
            $response = ['success' => true, 'message' => 'Game deleted'];
            break;

        case 'inspect_db':
            $response = ['success' => true, 'data' => $manager->getDatabaseInspection()];
            break;

        case 'vacuum_db':
            $manager->vacuumDatabase();
            $response = ['success' => true, 'message' => 'Database vacuumed and optimized'];
            break;
    }

    http_response_code($response['success'] ? 200 : 400);
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
?>
