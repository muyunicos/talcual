<?php

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/WordNormalizer.php';

class AdminDictionary {
    use WordNormalizer;
    
    public $pdo = null;

    public function __construct() {
        $db = Database::getInstance();
        $this->pdo = $db->getConnection();
    }

    public function getCategories() {
        try {
            $stmt = $this->pdo->query('SELECT id, name, orden, is_active FROM categories ORDER BY orden, name ASC');
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            logMessage('Error getCategories: ' . $e->getMessage(), 'ERROR');
            return [];
        }
    }

    public function getCategoryByName($name) {
        try {
            $stmt = $this->pdo->prepare('SELECT id, name, orden, is_active FROM categories WHERE name = ?');
            $stmt->execute([trim($name)]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            logMessage('Error getCategoryByName: ' . $e->getMessage(), 'ERROR');
            return null;
        }
    }

    public function addCategory($name) {
        try {
            $name = trim($name);
            if (empty($name)) {
                throw new Exception('Category name cannot be empty');
            }
            
            $stmt = $this->pdo->prepare('INSERT INTO categories (name, orden, is_active, date) VALUES (?, (SELECT COALESCE(MAX(orden), 0) + 1 FROM categories), 1, ?)');
            $stmt->execute([$name, time()]);
            
            return [
                'id' => $this->pdo->lastInsertId(),
                'name' => $name
            ];
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'UNIQUE constraint failed') !== false) {
                throw new Exception('Category already exists');
            }
            throw $e;
        } catch (Exception $e) {
            logMessage('Error addCategory: ' . $e->getMessage(), 'ERROR');
            throw $e;
        }
    }

    public function deleteCategory($categoryId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM categories WHERE id = ?');
            $stmt->execute([$categoryId]);
            return true;
        } catch (Exception $e) {
            logMessage('Error deleteCategory: ' . $e->getMessage(), 'ERROR');
            throw $e;
        }
    }

    public function getPrompts() {
        try {
            $stmt = $this->pdo->query(
                'SELECT p.id, p.text, p.difficulty, p.is_active, COUNT(vw.id) as word_count '
                . 'FROM prompts p '
                . 'LEFT JOIN valid_words vw ON p.id = vw.prompt_id '
                . 'GROUP BY p.id '
                . 'ORDER BY p.text ASC'
            );
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            logMessage('Error getPrompts: ' . $e->getMessage(), 'ERROR');
            return [];
        }
    }

    public function getPromptById($promptId) {
        try {
            $stmt = $this->pdo->prepare(
                'SELECT p.id, p.text, p.difficulty, p.is_active FROM prompts p WHERE p.id = ?'
            );
            $stmt->execute([$promptId]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            logMessage('Error getPromptById: ' . $e->getMessage(), 'ERROR');
            return null;
        }
    }

    public function addPrompt($categoryIds, $promptText) {
        try {
            $promptText = trim($promptText);
            if (empty($promptText)) {
                throw new Exception('Prompt text cannot be empty');
            }
            
            if (!is_array($categoryIds) || empty($categoryIds)) {
                throw new Exception('At least one category required');
            }
            
            $stmt = $this->pdo->prepare('INSERT INTO prompts (text, is_active, date) VALUES (?, 1, ?)');
            $stmt->execute([$promptText, time()]);
            
            $promptId = $this->pdo->lastInsertId();
            
            foreach ($categoryIds as $catId) {
                $catStmt = $this->pdo->prepare(
                    'INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)'
                );
                $catStmt->execute([$promptId, $catId]);
            }
            
            return $promptId;
        } catch (Exception $e) {
            logMessage('Error addPrompt: ' . $e->getMessage(), 'ERROR');
            throw $e;
        }
    }

    public function deletePrompt($promptId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM prompts WHERE id = ?');
            $stmt->execute([$promptId]);
            return true;
        } catch (Exception $e) {
            logMessage('Error deletePrompt: ' . $e->getMessage(), 'ERROR');
            throw $e;
        }
    }

    public function getValidWords($promptId) {
        try {
            $stmt = $this->pdo->prepare(
                'SELECT id, word_group FROM valid_words WHERE prompt_id = ? ORDER BY word_group ASC'
            );
            $stmt->execute([$promptId]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            logMessage('Error getValidWords: ' . $e->getMessage(), 'ERROR');
            return [];
        }
    }

    public function addValidWord($promptId, $word) {
        try {
            $word = mb_strtoupper(trim($word), 'UTF-8');
            if (empty($word)) {
                throw new Exception('Word cannot be empty');
            }
            
            $stmt = $this->pdo->prepare(
                'INSERT INTO valid_words (prompt_id, word_group) VALUES (?, ?)'
            );
            $stmt->execute([$promptId, $word]);
            
            return [
                'id' => $this->pdo->lastInsertId(),
                'prompt_id' => $promptId,
                'word_group' => $word
            ];
        } catch (Exception $e) {
            logMessage('Error addValidWord: ' . $e->getMessage(), 'ERROR');
            throw $e;
        }
    }

    public function deleteValidWord($wordId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM valid_words WHERE id = ?');
            $stmt->execute([$wordId]);
            return true;
        } catch (Exception $e) {
            logMessage('Error deleteValidWord: ' . $e->getMessage(), 'ERROR');
            throw $e;
        }
    }

    public function getDictionaryStats() {
        try {
            $catCount = $this->pdo->query('SELECT COUNT(*) FROM categories WHERE is_active = 1')->fetchColumn();
            $promptCount = $this->pdo->query('SELECT COUNT(*) FROM prompts WHERE is_active = 1')->fetchColumn();
            $wordCount = $this->pdo->query('SELECT COUNT(*) FROM valid_words')->fetchColumn();
            
            return [
                'categories' => intval($catCount),
                'prompts' => intval($promptCount),
                'words' => intval($wordCount),
                'timestamp' => date('Y-m-d H:i:s')
            ];
        } catch (Exception $e) {
            logMessage('Error getDictionaryStats: ' . $e->getMessage(), 'ERROR');
            return [
                'categories' => 0,
                'prompts' => 0,
                'words' => 0,
                'timestamp' => date('Y-m-d H:i:s')
            ];
        }
    }

    public function getDatabaseInspection() {
        try {
            $stats = $this->getDictionaryStats();
            
            return [
                'success' => true,
                'stats' => $stats,
                'status' => 'HEALTHY'
            ];
        } catch (Exception $e) {
            logMessage('Error getDatabaseInspection: ' . $e->getMessage(), 'ERROR');
            return [
                'success' => false,
                'stats' => ['categories' => 0, 'prompts' => 0, 'words' => 0],
                'status' => 'ERROR'
            ];
        }
    }

    public function getGames() {
        try {
            $stmt = $this->pdo->query(
                'SELECT id, status, round, created_at FROM games ORDER BY created_at DESC LIMIT 10'
            );
            return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Exception $e) {
            logMessage('Error getGames: ' . $e->getMessage(), 'ERROR');
            return [];
        }
    }

    public function vacuumDatabase() {
        try {
            $this->pdo->exec('VACUUM');
            $this->pdo->exec('PRAGMA optimize');
            return true;
        } catch (Exception $e) {
            logMessage('Error vacuumDatabase: ' . $e->getMessage(), 'ERROR');
            throw $e;
        }
    }
}
?>