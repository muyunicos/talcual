<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');

header('Content-Type: application/json');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/GameRepository.php';
require_once __DIR__ . '/DictionaryRepository.php';

try {
    $response = [
        'debug' => true,
        'MAX_CODE_LENGTH' => MAX_CODE_LENGTH,
        'categories_analysis' => []
    ];
    
    $dictRepo = new DictionaryRepository();
    $categories = $dictRepo->getCategories();
    
    foreach ($categories as $category) {
        $analysis = [
            'category' => $category,
            'all_words' => [],
            'filtered_words' => [],
            'valid_for_code' => []
        ];
        
        $pdo = $dictRepo->pdo ?? null;
        if (!$pdo) {
            $db = new ReflectionClass('DictionaryRepository');
            $prop = $db->getProperty('pdo');
            $prop->setAccessible(true);
            $pdo = $prop->getValue($dictRepo);
        }
        
        $categoryStmt = $pdo->prepare('SELECT id FROM categories WHERE name = ?');
        $categoryStmt->execute([$category]);
        $categoryRow = $categoryStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$categoryRow) {
            $analysis['error'] = 'Category not found';
            $response['categories_analysis'][] = $analysis;
            continue;
        }
        
        $categoryId = $categoryRow['id'];
        
        $sql = 'SELECT vw.word_entry FROM valid_words vw '
             . 'JOIN prompts p ON vw.prompt_id = p.id '
             . 'JOIN prompt_categories pc ON p.id = pc.prompt_id '
             . 'WHERE pc.category_id = ? '
             . 'ORDER BY vw.word_entry ASC';
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$categoryId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $analysis['total_words'] = count($rows);
        
        foreach ($rows as $row) {
            $rawWord = $row['word_entry'];
            $analysis['all_words'][] = $rawWord;
            
            $cleaned = self::cleanWordPrompt($rawWord);
            $analysis['filtered_words'][] = [
                'raw' => $rawWord,
                'cleaned' => $cleaned,
                'length' => mb_strlen($cleaned),
                'valid' => !empty($cleaned) && mb_strlen($cleaned) <= MAX_CODE_LENGTH
            ];
            
            if (!empty($cleaned) && mb_strlen($cleaned) <= MAX_CODE_LENGTH) {
                $analysis['valid_for_code'][] = $cleaned;
            }
        }
        
        $analysis['valid_count'] = count($analysis['valid_for_code']);
        $response['categories_analysis'][] = $analysis;
    }
    
} catch (Throwable $e) {
    $response['error'] = $e->getMessage();
    $response['trace'] = explode("\n", $e->getTraceAsString());
}

function cleanWordPrompt($rawWord) {
    if (empty($rawWord)) {
        return '';
    }
    
    $word = trim($rawWord);
    
    if (strpos($word, '|') !== false) {
        $parts = explode('|', $word);
        $word = trim($parts[0]);
    }
    
    if (substr($word, -1) === '.') {
        $word = substr($word, 0, -1);
    }
    
    $word = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $word);
    $word = strtoupper($word);
    $word = preg_replace('/[^A-Z0-9]/', '', $word);
    
    return $word;
}

echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?>
