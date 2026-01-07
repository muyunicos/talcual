<?php

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/WordNormalizer.php';

class GameDictionary {
    use WordNormalizer;
    
    private $pdo = null;

    public function __construct() {
        $db = Database::getInstance();
        $this->pdo = $db->getConnection();
    }

    public function getCategories() {
        try {
            $stmt = $this->pdo->query('SELECT name FROM categories WHERE is_active = 1 ORDER BY orden, name ASC');
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return array_map(function($row) { return $row['name']; }, $rows);
        } catch (PDOException $e) {
            logMessage('Error fetching categories: ' . $e->getMessage(), 'ERROR');
            return [];
        }
    }

    public function getTopicCard($category) {
        try {
            $categoryStmt = $this->pdo->prepare('SELECT id FROM categories WHERE name = ? AND is_active = 1');
            $categoryStmt->execute([$category]);
            $categoryRow = $categoryStmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$categoryRow) {
                return [
                    'question' => 'JUEGO',
                    'answers' => []
                ];
            }
            
            $categoryId = $categoryRow['id'];
            
            $promptStmt = $this->pdo->prepare(
                'SELECT p.id, p.text FROM prompts p '
                . 'JOIN prompt_categories pc ON p.id = pc.prompt_id '
                . 'WHERE pc.category_id = ? AND p.is_active = 1 '
                . 'ORDER BY RANDOM() LIMIT 1'
            );
            $promptStmt->execute([$categoryId]);
            $promptRow = $promptStmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$promptRow) {
                return [
                    'question' => 'JUEGO',
                    'answers' => []
                ];
            }
            
            $promptId = $promptRow['id'];
            $question = trim($promptRow['text']);
            
            $wordStmt = $this->pdo->prepare(
                'SELECT word_group FROM valid_words WHERE prompt_id = ? ORDER BY word_group ASC'
            );
            $wordStmt->execute([$promptId]);
            $wordRows = $wordStmt->fetchAll(PDO::FETCH_ASSOC);
            
            $answers = array_map(function($row) { return $row['word_group']; }, $wordRows);
            
            return [
                'question' => $question,
                'answers' => $answers
            ];
        } catch (Exception $e) {
            logMessage('Error fetching topic card for ' . $category . ': ' . $e->getMessage(), 'ERROR');
            return [
                'question' => 'JUEGO',
                'answers' => []
            ];
        }
    }

    public function getRandomWordByCategoryFiltered($category, $maxLength = null) {
        if ($maxLength === null) {
            $maxLength = MAX_CODE_LENGTH;
        }
        
        try {
            $categoryStmt = $this->pdo->prepare('SELECT id FROM categories WHERE name = ? AND is_active = 1');
            $categoryStmt->execute([$category]);
            $categoryRow = $categoryStmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$categoryRow) {
                return null;
            }
            
            $categoryId = $categoryRow['id'];
            $attempts = 0;
            $maxAttempts = 30;
            
            while ($attempts < $maxAttempts) {
                $sql = 'SELECT vw.word_group '
                     . 'FROM valid_words vw '
                     . 'JOIN prompts p ON vw.prompt_id = p.id '
                     . 'JOIN prompt_categories pc ON p.id = pc.prompt_id '
                     . 'WHERE pc.category_id = ? AND p.is_active = 1 '
                     . 'ORDER BY RANDOM() '
                     . 'LIMIT 1';
                
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([$categoryId]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$row) {
                    return null;
                }
                
                $rawWord = $row['word_group'];
                $cleaned = self::cleanWordPrompt($rawWord);
                
                if (!empty($cleaned) && mb_strlen($cleaned) <= $maxLength) {
                    return $cleaned;
                }
                
                $attempts++;
            }
            
            return null;
        } catch (Exception $e) {
            logMessage('Error getting random word for category ' . $category . ': ' . $e->getMessage(), 'ERROR');
            return null;
        }
    }
}
?>