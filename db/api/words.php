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
    if ($action === 'list') {
        $promptId = $_GET['prompt_id'] ?? null;
        if ($promptId) {
            $stmt = $pdo->prepare('SELECT * FROM words WHERE prompt_id = ? ORDER BY id ASC');
            $stmt->execute([$promptId]);
        } else {
            $stmt = $pdo->query('SELECT * FROM words ORDER BY id ASC');
        }
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    } elseif ($action === 'create') {
        $data = json_decode(file_get_contents('php://input'), true);
        $promptId = $data['prompt_id'] ?? null;
        $word = $data['word'] ?? '';

        if (!$promptId || !$word) {
            throw new Exception('Prompt ID and word are required');
        }

        $stmt = $pdo->prepare('INSERT INTO words (prompt_id, word) VALUES (?, ?)');
        $stmt->execute([$promptId, $word]);
        echo json_encode(['id' => $pdo->lastInsertId()]);
    } elseif ($action === 'batch_create') {
        $data = json_decode(file_get_contents('php://input'), true);
        $promptId = $data['prompt_id'] ?? null;
        $wordsText = $data['words'] ?? '';

        if (!$promptId) {
            throw new Exception('Prompt ID is required');
        }

        $wordsList = array_filter(array_map('trim', explode(',', $wordsText)));
        if (empty($wordsList)) {
            throw new Exception('No words provided');
        }

        $pdo->beginTransaction();
        $inserted = 0;
        foreach ($wordsList as $word) {
            try {
                $stmt = $pdo->prepare('INSERT INTO words (prompt_id, word) VALUES (?, ?)');
                $stmt->execute([$promptId, $word]);
                $inserted++;
            } catch (PDOException $e) {
            }
        }
        $pdo->commit();
        echo json_encode(['inserted' => $inserted, 'total' => count($wordsList)]);
    } elseif ($action === 'update') {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = $data['id'] ?? null;
        $word = $data['word'] ?? '';

        if (!$id) {
            throw new Exception('ID is required');
        }

        $stmt = $pdo->prepare('UPDATE words SET word = ? WHERE id = ?');
        $stmt->execute([$word, $id]);
        echo json_encode(['success' => true]);
    } elseif ($action === 'delete') {
        $id = $_POST['id'] ?? null;
        if (!$id) {
            throw new Exception('ID is required');
        }

        $stmt = $pdo->prepare('DELETE FROM words WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } else {
        throw new Exception('Unknown action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
