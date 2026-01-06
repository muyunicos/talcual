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
    if ($action === 'find_duplicates') {
        $type = $_GET['type'] ?? 'categories';
        $result = [];

        if ($type === 'categories') {
            $stmt = $pdo->query('
                SELECT name, COUNT(*) as count, GROUP_CONCAT(id) as ids
                FROM categories
                GROUP BY LOWER(name)
                HAVING count > 1
                ORDER BY count DESC
            ');
            $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } elseif ($type === 'prompts') {
            $stmt = $pdo->query('
                SELECT text, COUNT(*) as count, GROUP_CONCAT(id) as ids
                FROM prompts
                GROUP BY LOWER(text)
                HAVING count > 1
                ORDER BY count DESC
            ');
            $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } elseif ($type === 'words') {
            $stmt = $pdo->query('
                SELECT prompt_id, word, COUNT(*) as count, GROUP_CONCAT(id) as ids
                FROM words
                GROUP BY prompt_id, word
                HAVING count > 1
                ORDER BY count DESC
            ');
            $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        echo json_encode(['duplicates' => $result]);
    } elseif ($action === 'remove_duplicate_words') {
        $pdo->beginTransaction();

        $stmt = $pdo->query('
            DELETE FROM words WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                        ROW_NUMBER() OVER (PARTITION BY prompt_id, word ORDER BY id DESC) as rn
                    FROM words
                ) WHERE rn > 1
            )
        ');

        $affected = $stmt->rowCount();
        $pdo->commit();

        echo json_encode(['success' => true, 'removed' => $affected]);
    } elseif ($action === 'cleanup_unused_prompts') {
        $pdo->beginTransaction();

        $stmt = $pdo->query('
            DELETE FROM prompts WHERE id NOT IN (
                SELECT DISTINCT prompt_id FROM prompt_categories
            )
        ');

        $affected = $stmt->rowCount();
        $pdo->commit();

        echo json_encode(['success' => true, 'removed' => $affected]);
    } elseif ($action === 'vacuum') {
        $pdo->exec('VACUUM');
        $size = filesize($dbPath);

        echo json_encode([
            'success' => true,
            'message' => 'Database optimized',
            'size' => $size
        ]);
    } elseif ($action === 'stats') {
        $stats = [];

        $stmt = $pdo->query('SELECT COUNT(*) as count FROM categories WHERE is_active = 1');
        $stats['active_categories'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        $stmt = $pdo->query('SELECT COUNT(*) as count FROM prompts WHERE is_active = 1');
        $stats['active_prompts'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        $stmt = $pdo->query('SELECT COUNT(*) as count FROM words');
        $stats['total_words'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        $stmt = $pdo->query('SELECT COUNT(*) as count FROM games');
        $stats['total_games'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        $stmt = $pdo->query('SELECT COUNT(*) as count FROM games WHERE status = "finished"');
        $stats['finished_games'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        $stmt = $pdo->query('SELECT COUNT(DISTINCT game_id) as count FROM players');
        $stats['total_unique_players'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        $stats['db_size'] = filesize($dbPath);

        echo json_encode(['stats' => $stats]);
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
