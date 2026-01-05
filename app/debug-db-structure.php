<?php
header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Database.php';

try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();
    
    echo "=== Database Structure Analysis ===\n\n";
    
    echo "CATEGORIES:\n";
    $categories = $pdo->query('SELECT id, name FROM categories')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($categories as $cat) {
        echo "  [{$cat['id']}] {$cat['name']}\n";
    }
    echo "\n";
    
    echo "PROMPTS:\n";
    $prompts = $pdo->query('SELECT p.id, p.text, GROUP_CONCAT(pc.category_id) as cat_ids FROM prompts p LEFT JOIN prompt_categories pc ON p.id = pc.prompt_id GROUP BY p.id')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($prompts as $p) {
        echo "  [{$p['id']}] {$p['text']} (Categories: {$p['cat_ids']})\n";
    }
    echo "\n";
    
    echo "VALID WORDS (per prompt):\n";
    $words = $pdo->query('SELECT prompt_id, GROUP_CONCAT(word_entry) as words FROM valid_words GROUP BY prompt_id')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($words as $w) {
        echo "  Prompt {$w['prompt_id']}: {$w['words']}\n";
    }
    echo "\n";
    
    echo "RELATIONAL CHECK (category -> prompt -> words):\n";
    foreach ($categories as $cat) {
        $catId = $cat['id'];
        $prompts = $pdo->prepare(
            'SELECT p.id, p.text FROM prompts p '
            . 'JOIN prompt_categories pc ON p.id = pc.prompt_id '
            . 'WHERE pc.category_id = ?'
        );
        $prompts->execute([$catId]);
        $prompts = $prompts->fetchAll(PDO::FETCH_ASSOC);
        
        echo "  Category '{$cat['name']}' ({$catId}):\n";
        if (empty($prompts)) {
            echo "    ❌ NO PROMPTS LINKED!\n";
        } else {
            foreach ($prompts as $p) {
                $words = $pdo->prepare('SELECT COUNT(*) as count FROM valid_words WHERE prompt_id = ?');
                $words->execute([$p['id']]);
                $count = $words->fetch()['count'];
                echo "    ✓ Prompt: {$p['text']} ({$count} words)\n";
            }
        }
    }
    
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage();
}
?>
