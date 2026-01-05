<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/DictionaryRepository.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = Database::getInstance()->getConnection();
    $action = $_GET['action'] ?? $_POST['action'] ?? 'diagnose';
    
    $response = ['success' => false, 'message' => 'Unknown action'];
    
    switch ($action) {
        case 'diagnose':
            // Diagnosticar estado de la BD
            $stats = [
                'categories' => (int)$pdo->query('SELECT COUNT(*) FROM categories')->fetchColumn(),
                'prompts' => (int)$pdo->query('SELECT COUNT(*) FROM prompts')->fetchColumn(),
                'prompt_categories' => (int)$pdo->query('SELECT COUNT(*) FROM prompt_categories')->fetchColumn(),
                'valid_words' => (int)$pdo->query('SELECT COUNT(*) FROM valid_words')->fetchColumn(),
            ];
            
            // Obtener prompts sin categorías
            $orphaned = $pdo->query(
                'SELECT id, text FROM prompts WHERE id NOT IN (SELECT prompt_id FROM prompt_categories)'
            )->fetchAll(PDO::FETCH_ASSOC);
            
            $response = [
                'success' => true,
                'stats' => $stats,
                'orphaned_prompts' => $orphaned,
                'needs_repair' => count($orphaned) > 0 || $stats['prompt_categories'] == 0
            ];
            break;
        
        case 'fix_orphaned':
            // Asignar prompts huérfanas a categoría por defecto
            $defaultCategoryId = $_POST['default_category_id'] ?? 1;
            
            $pdo->beginTransaction();
            
            $stmt = $pdo->prepare(
                'INSERT INTO prompt_categories (prompt_id, category_id) '
                . 'SELECT DISTINCT p.id, ? FROM prompts p '
                . 'WHERE p.id NOT IN (SELECT prompt_id FROM prompt_categories)'
            );
            $stmt->execute([$defaultCategoryId]);
            $inserted = $stmt->rowCount();
            
            $pdo->commit();
            
            $response = [
                'success' => true,
                'message' => "Se vincularon $inserted consignas a categoría #$defaultCategoryId"
            ];
            break;
        
        case 'rebuild_from_old':
            // Reconstruir todo desde palabras antiguas
            $pdo->beginTransaction();
            
            try {
                // 1. Obtener todas las palabras agrupadas por prompt_id (que era categoría_id en BD vieja)
                $oldWords = $pdo->query(
                    'SELECT DISTINCT prompt_id as old_category FROM valid_words ORDER BY prompt_id'
                )->fetchAll(PDO::FETCH_ASSOC);
                
                $categoryMap = []; // Mapeo de old_category_id -> new_category_id
                
                foreach ($oldWords as $row) {
                    $oldCatId = $row['old_category'];
                    
                    // Si no existe categoría con nombre "Categoría {id}", crearla
                    $stmt = $pdo->prepare(
                        'INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)'
                    );
                    $stmt->execute([$oldCatId, "Categoría $oldCatId"]);
                    
                    $categoryMap[$oldCatId] = $oldCatId;
                }
                
                // 2. Reconstruir prompts desde valid_words (cada palabra se convierte en prompt)
                $allWords = $pdo->query(
                    'SELECT id, prompt_id as old_category, word_entry FROM valid_words ORDER BY id'
                )->fetchAll(PDO::FETCH_ASSOC);
                
                $wordToPromptMap = [];
                $categoryToPromptsMap = [];
                
                foreach ($allWords as $word) {
                    $oldCatId = $word['old_category'];
                    $wordEntry = $word['word_entry'];
                    
                    // Crear prompt con el word_entry como texto
                    $stmtInsert = $pdo->prepare(
                        'INSERT INTO prompts (text) VALUES (?)'
                    );
                    $stmtInsert->execute([$wordEntry]);
                    $newPromptId = $pdo->lastInsertId();
                    
                    // Vincular a categoría
                    if (!isset($categoryToPromptsMap[$oldCatId])) {
                        $categoryToPromptsMap[$oldCatId] = [];
                    }
                    $categoryToPromptsMap[$oldCatId][] = $newPromptId;
                    
                    $wordToPromptMap[$word['id']] = $newPromptId;
                }
                
                // 3. Crear relaciones prompt_categories
                foreach ($categoryToPromptsMap as $catId => $promptIds) {
                    $stmt = $pdo->prepare(
                        'INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)'
                    );
                    foreach (array_unique($promptIds) as $pid) {
                        $stmt->execute([$pid, $catId]);
                    }
                }
                
                // 4. Eliminar valid_words antiguas
                $pdo->query('DELETE FROM valid_words');
                
                $pdo->commit();
                
                $response = [
                    'success' => true,
                    'message' => count($allWords) . ' palabras convertidas a consignas',
                    'categories_created' => count($categoryMap),
                    'prompts_created' => count($wordToPromptMap)
                ];
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            break;
        
        default:
            $response = ['success' => false, 'message' => 'Unknown action: ' . $action];
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
