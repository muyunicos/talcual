<?php
header('Content-Type: application/json');

$dbPath = __DIR__ . '/../../data/talcual.db';
if (!file_exists($dbPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Database not initialized']);
    exit;
}

$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('PRAGMA foreign_keys = ON');

$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    if ($action === 'categories') {
        $data = json_decode(file_get_contents('php://input'), true);
        $sourceId = $data['source_id'] ?? null;
        $targetId = $data['target_id'] ?? null;

        if (!$sourceId || !$targetId) {
            throw new Exception('source_id and target_id required');
        }

        $pdo->beginTransaction();

        $stmt = $pdo->prepare('UPDATE prompt_categories SET category_id = ? WHERE category_id = ?');
        $stmt->execute([$targetId, $sourceId]);

        $stmt = $pdo->prepare('DELETE FROM categories WHERE id = ?');
        $stmt->execute([$sourceId]);

        $pdo->commit();

        echo json_encode(['success' => true, 'message' => 'Categories merged']);
    } elseif ($action === 'prompts') {
        $data = json_decode(file_get_contents('php://input'), true);
        $sourceId = $data['source_id'] ?? null;
        $targetId = $data['target_id'] ?? null;

        if (!$sourceId || !$targetId) {
            throw new Exception('source_id and target_id required');
        }

        $pdo->beginTransaction();

        $stmt = $pdo->prepare('UPDATE words SET prompt_id = ? WHERE prompt_id = ?');
        $stmt->execute([$targetId, $sourceId]);

        $stmt = $pdo->prepare('UPDATE prompt_categories SET prompt_id = ? WHERE prompt_id = ?');
        $stmt->execute([$targetId, $sourceId]);

        $stmt = $pdo->prepare('DELETE FROM prompt_categories WHERE prompt_id = ?');
        $stmt->execute([$sourceId]);

        $stmt = $pdo->prepare('DELETE FROM prompts WHERE id = ?');
        $stmt->execute([$sourceId]);

        $pdo->commit();

        echo json_encode(['success' => true, 'message' => 'Prompts merged']);
    } else {
        throw new Exception('Unknown action');
    }
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
