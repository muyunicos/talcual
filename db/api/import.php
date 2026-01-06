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
    if ($action === 'export') {
        $stmt = $pdo->query('SELECT * FROM categories ORDER BY orden ASC');
        $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmt = $pdo->query('SELECT * FROM prompts');
        $prompts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmt = $pdo->query('SELECT * FROM prompt_categories');
        $promptCategories = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmt = $pdo->query('SELECT * FROM words');
        $words = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $export = [
            'version' => 1,
            'exported_at' => time(),
            'categories' => $categories,
            'prompts' => $prompts,
            'prompt_categories' => $promptCategories,
            'words' => $words
        ];

        echo json_encode($export);
    } elseif ($action === 'import') {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || !is_array($data)) {
            throw new Exception('Invalid JSON');
        }

        $mergeMode = $_GET['merge'] ?? false;
        $categories = $data['categories'] ?? [];
        $prompts = $data['prompts'] ?? [];
        $promptCategories = $data['prompt_categories'] ?? [];
        $words = $data['words'] ?? [];

        $pdo->beginTransaction();

        $categoryMap = [];
        $promptMap = [];

        foreach ($categories as $cat) {
            $oldId = $cat['id'];
            unset($cat['id']);

            if ($mergeMode) {
                $stmt = $pdo->prepare('SELECT id FROM categories WHERE name = ?');
                $stmt->execute([$cat['name']]);
                $existing = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($existing) {
                    $categoryMap[$oldId] = $existing['id'];
                    continue;
                }
            }

            $cat['date'] = time();
            $cols = implode(', ', array_keys($cat));
            $placeholders = implode(', ', array_fill(0, count($cat), '?'));
            $stmt = $pdo->prepare("INSERT INTO categories ($cols) VALUES ($placeholders)");
            $stmt->execute(array_values($cat));
            $categoryMap[$oldId] = $pdo->lastInsertId();
        }

        foreach ($prompts as $prompt) {
            $oldId = $prompt['id'];
            unset($prompt['id']);

            if ($mergeMode) {
                $stmt = $pdo->prepare('SELECT id FROM prompts WHERE text = ?');
                $stmt->execute([$prompt['text']]);
                $existing = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($existing) {
                    $promptMap[$oldId] = $existing['id'];
                    continue;
                }
            }

            $prompt['date'] = time();
            $cols = implode(', ', array_keys($prompt));
            $placeholders = implode(', ', array_fill(0, count($prompt), '?'));
            $stmt = $pdo->prepare("INSERT INTO prompts ($cols) VALUES ($placeholders)");
            $stmt->execute(array_values($prompt));
            $promptMap[$oldId] = $pdo->lastInsertId();
        }

        foreach ($promptCategories as $pc) {
            $promptId = $promptMap[$pc['prompt_id']] ?? $pc['prompt_id'];
            $categoryId = $categoryMap[$pc['category_id']] ?? $pc['category_id'];

            $stmt = $pdo->prepare('INSERT OR IGNORE INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)');
            $stmt->execute([$promptId, $categoryId]);
        }

        foreach ($words as $word) {
            unset($word['id']);
            $promptId = $promptMap[$word['prompt_id']] ?? $word['prompt_id'];
            $word['prompt_id'] = $promptId;

            $cols = implode(', ', array_keys($word));
            $placeholders = implode(', ', array_fill(0, count($word), '?'));
            $stmt = $pdo->prepare("INSERT OR IGNORE INTO words ($cols) VALUES ($placeholders)");
            $stmt->execute(array_values($word));
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'imported' => [
                'categories' => count($categories),
                'prompts' => count($prompts),
                'words' => count($words)
            ]
        ]);
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
