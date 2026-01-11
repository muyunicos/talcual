<?php

require_once __DIR__ . '/Database.php';

class DictionaryRepository {
    private $db = null;
    private $pdo = null;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->pdo = $this->db->getConnection();
    }

    private static function normalizeWord($rawWord) {
        if (empty($rawWord)) return '';
        $word = trim($rawWord);
        $word = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $word);
        $word = strtoupper($word);
        $word = preg_replace('/[^A-Z0-9]/', '', $word);
        return $word;
    }

    private static function cleanWordPrompt($rawWord) {
        if (empty($rawWord)) return '';
        $word = trim($rawWord);
        if (strpos($word, '|') !== false) {
            $parts = explode('|', $word);
            $word = trim($parts[0]);
        }
        if (substr($word, -1) === '.') {
            $word = substr($word, 0, -1);
        }
        return self::normalizeWord($word);
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

    public function getCategoriesFull() {
        try {
            $stmt = $this->pdo->query('SELECT id, name, orden, is_active FROM categories WHERE is_active = 1 ORDER BY orden, name');
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching categories: ' . $e->getMessage());
        }
    }

    public function getCategoryById($categoryId) {
        try {
            $stmt = $this->pdo->prepare('SELECT id, name, orden, is_active FROM categories WHERE id = ? AND is_active = 1');
            $stmt->execute([$categoryId]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching category: ' . $e->getMessage());
        }
    }

    public function getCategoryByName($categoryName) {
        try {
            $stmt = $this->pdo->prepare('SELECT id, name, orden, is_active FROM categories WHERE name = ? AND is_active = 1');
            $stmt->execute([$categoryName]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching category by name: ' . $e->getMessage());
        }
    }

    public function getTopicCard($category) {
        try {
            $categoryStmt = $this->pdo->prepare('SELECT id FROM categories WHERE name = ? AND is_active = 1');
            $categoryStmt->execute([$category]);
            $categoryRow = $categoryStmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$categoryRow) {
                return [
                    'id' => null,
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
                    'id' => null,
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
                'id' => (int)$promptId,
                'question' => $question,
                'answers' => $answers
            ];
        } catch (Exception $e) {
            logMessage('Error fetching topic card for ' . $category . ': ' . $e->getMessage(), 'ERROR');
            return [
                'id' => null,
                'question' => 'JUEGO',
                'answers' => []
            ];
        }
    }

    public function getAllResponsesByCategory($category) {
        try {
            $sql = 'SELECT DISTINCT vw.word_group '
                 . 'FROM valid_words vw '
                 . 'JOIN prompts p ON vw.prompt_id = p.id '
                 . 'JOIN prompt_categories pc ON p.id = pc.prompt_id '
                 . 'JOIN categories c ON pc.category_id = c.id '
                 . 'WHERE c.name = ? AND c.is_active = 1 AND p.is_active = 1 '
                 . 'ORDER BY vw.word_group ASC';
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$category]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return array_map(function($row) { return $row['word_group']; }, $rows);
        } catch (Exception $e) {
            logMessage('Error fetching responses for category ' . $category . ': ' . $e->getMessage(), 'ERROR');
            return [];
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