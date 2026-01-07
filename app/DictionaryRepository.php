<?php

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/WordNormalizer.php';

class DictionaryRepository {
    use WordNormalizer;
    
    private $db = null;
    private $pdo = null;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->pdo = $this->db->getConnection();
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

    public function addCategory($categoryName) {
        try {
            $stmt = $this->pdo->prepare('INSERT OR IGNORE INTO categories (name, is_active, date) VALUES (?, 1, ?)');
            $stmt->execute([$categoryName, time()]);
            return $this->getCategoryByName($categoryName);
        } catch (PDOException $e) {
            throw new Exception('Error adding category: ' . $e->getMessage());
        }
    }

    public function updateCategory($categoryId, $newName) {
        try {
            $stmt = $this->pdo->prepare('UPDATE categories SET name = ? WHERE id = ?');
            $stmt->execute([$newName, $categoryId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error updating category: ' . $e->getMessage());
        }
    }

    public function deleteCategory($categoryId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM categories WHERE id = ?');
            $stmt->execute([$categoryId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error deleting category: ' . $e->getMessage());
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

    public function getDictionaryStats() {
        try {
            $categoryCount = $this->pdo->query('SELECT COUNT(*) as count FROM categories WHERE is_active = 1')->fetch()['count'];
            $categories = $this->getCategories();
            
            $stats = [
                'categorias' => (int)$categoryCount,
                'total_palabras' => 0,
                'palabras_codigo' => 0,
                'categorias_detalle' => []
            ];
            
            foreach ($categories as $categoria) {
                $responses = $this->getAllResponsesByCategory($categoria);
                $cleanedWords = array_map([self::class, 'cleanWordPrompt'], $responses);
                $cleanedWords = array_filter($cleanedWords, function($w) { 
                    return !empty($w); 
                });
                $uniqueWords = array_unique($cleanedWords);
                
                $count = count($uniqueWords);
                $stats['total_palabras'] += $count;
                $stats['categorias_detalle'][$categoria] = $count;
                
                foreach ($uniqueWords as $palabra) {
                    if (mb_strlen($palabra) <= MAX_CODE_LENGTH) {
                        $stats['palabras_codigo']++;
                    }
                }
            }
            
            return $stats;
        } catch (Exception $e) {
            logMessage('Error fetching dictionary stats: ' . $e->getMessage(), 'ERROR');
            return [
                'categorias' => 0,
                'total_palabras' => 0,
                'palabras_codigo' => 0,
                'categorias_detalle' => []
            ];
        }
    }

    public function getPromptsWithStats($categoryId) {
        try {
            $sql = 'SELECT 
                p.id, p.text, p.difficulty,
                (SELECT GROUP_CONCAT(category_id, ",") FROM prompt_categories WHERE prompt_id = p.id) as category_ids,
                COUNT(DISTINCT vw.id) as word_count
            FROM prompts p
            JOIN prompt_categories pc ON p.id = pc.prompt_id
            LEFT JOIN valid_words vw ON p.id = vw.prompt_id
            WHERE pc.category_id = ? AND p.is_active = 1
            GROUP BY p.id, p.text
            ORDER BY p.text';
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$categoryId]);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($results as &$row) {
                $row['category_ids'] = array_map('intval', array_filter(explode(',', $row['category_ids'] ?? '')));
                $row['word_count'] = (int)$row['word_count'];
            }
            
            return $results;
        } catch (PDOException $e) {
            throw new Exception('Error fetching prompts: ' . $e->getMessage());
        }
    }

    public function getPrompts($categoryId = null) {
        try {
            if ($categoryId) {
                $sql = 'SELECT p.id, p.text, p.difficulty, '
                    . '(SELECT GROUP_CONCAT(category_id, ",") FROM prompt_categories WHERE prompt_id = p.id) as category_ids '
                    . 'FROM prompts p '
                    . 'JOIN prompt_categories pc ON p.id = pc.prompt_id '
                    . 'WHERE pc.category_id = ? AND p.is_active = 1 '
                    . 'GROUP BY p.id, p.text '
                    . 'ORDER BY p.text';
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([$categoryId]);
            } else {
                $sql = 'SELECT p.id, p.text, p.difficulty, '
                    . '(SELECT GROUP_CONCAT(category_id, ",") FROM prompt_categories WHERE prompt_id = p.id) as category_ids '
                    . 'FROM prompts p '
                    . 'WHERE p.is_active = 1 '
                    . 'GROUP BY p.id, p.text '
                    . 'ORDER BY p.text';
                $stmt = $this->pdo->query($sql);
            }
            
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($results as &$row) {
                $row['category_ids'] = array_map('intval', array_filter(explode(',', $row['category_ids'] ?? '')));
            }
            
            return $results;
        } catch (PDOException $e) {
            throw new Exception('Error fetching prompts: ' . $e->getMessage());
        }
    }

    public function getPromptById($promptId) {
        try {
            $sql = 'SELECT p.id, p.text, p.difficulty, '
                . '(SELECT GROUP_CONCAT(category_id, ",") FROM prompt_categories WHERE prompt_id = p.id) as category_ids '
                . 'FROM prompts p '
                . 'WHERE p.id = ? AND p.is_active = 1';
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$promptId]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($result) {
                $result['category_ids'] = array_map('intval', array_filter(explode(',', $result['category_ids'] ?? '')));
            }
            
            return $result;
        } catch (PDOException $e) {
            throw new Exception('Error fetching prompt: ' . $e->getMessage());
        }
    }

    public function addPrompt($categoryIds, $promptText) {
        try {
            if (is_string($categoryIds)) {
                $categoryIds = [$categoryIds];
            } elseif (!is_array($categoryIds)) {
                throw new Exception('Invalid categoryIds format');
            }
            
            if (empty($categoryIds)) {
                throw new Exception('At least one category is required');
            }
            
            $this->db->beginTransaction();
            
            $stmt = $this->pdo->prepare('INSERT INTO prompts (text, is_active, date) VALUES (?, 1, ?)');
            $stmt->execute([$promptText, time()]);
            $promptId = $this->pdo->lastInsertId();
            
            $relStmt = $this->pdo->prepare('INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)');
            foreach ($categoryIds as $catId) {
                $relStmt->execute([$promptId, $catId]);
            }
            
            $this->db->commit();
            
            return $promptId;
        } catch (Exception $e) {
            $this->db->rollback();
            throw new Exception('Error adding prompt: ' . $e->getMessage());
        }
    }

    public function updatePrompt($promptId, $newText, $categoryIds = null) {
        try {
            $this->db->beginTransaction();
            
            $stmt = $this->pdo->prepare('UPDATE prompts SET text = ? WHERE id = ?');
            $stmt->execute([$newText, $promptId]);
            
            if ($categoryIds !== null) {
                if (is_string($categoryIds)) {
                    $categoryIds = [$categoryIds];
                } elseif (!is_array($categoryIds)) {
                    throw new Exception('Invalid categoryIds format');
                }
                
                $this->pdo->prepare('DELETE FROM prompt_categories WHERE prompt_id = ?')->execute([$promptId]);
                
                if (!empty($categoryIds)) {
                    $relStmt = $this->pdo->prepare('INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)');
                    foreach ($categoryIds as $catId) {
                        $relStmt->execute([$promptId, $catId]);
                    }
                }
            }
            
            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollback();
            throw new Exception('Error updating prompt: ' . $e->getMessage());
        }
    }

    public function deletePrompt($promptId) {
        try {
            $this->pdo->prepare('DELETE FROM prompt_categories WHERE prompt_id = ?')->execute([$promptId]);
            $stmt = $this->pdo->prepare('DELETE FROM prompts WHERE id = ?');
            $stmt->execute([$promptId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error deleting prompt: ' . $e->getMessage());
        }
    }

    public function getPromptCategories($promptId) {
        try {
            $stmt = $this->pdo->prepare('SELECT category_id FROM prompt_categories WHERE prompt_id = ? ORDER BY category_id');
            $stmt->execute([$promptId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return array_map(function($row) { return (int)$row['category_id']; }, $rows);
        } catch (PDOException $e) {
            throw new Exception('Error fetching prompt categories: ' . $e->getMessage());
        }
    }

    public function getValidWords($promptId = null) {
        try {
            if ($promptId) {
                $stmt = $this->pdo->prepare('SELECT id, prompt_id, word_group FROM valid_words WHERE prompt_id = ? ORDER BY word_group');
                $stmt->execute([$promptId]);
            } else {
                $stmt = $this->pdo->query('SELECT id, prompt_id, word_group FROM valid_words ORDER BY prompt_id, word_group');
            }
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching valid words: ' . $e->getMessage());
        }
    }

    public function getValidWordById($wordId) {
        try {
            $stmt = $this->pdo->prepare('SELECT id, prompt_id, word_group FROM valid_words WHERE id = ?');
            $stmt->execute([$wordId]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching valid word: ' . $e->getMessage());
        }
    }

    public function addValidWord($promptId, $wordEntry) {
        try {
            $stmt = $this->pdo->prepare('INSERT INTO valid_words (prompt_id, word_group) VALUES (?, ?)');
            $stmt->execute([$promptId, $wordEntry]);
            return $this->pdo->lastInsertId();
        } catch (PDOException $e) {
            throw new Exception('Error adding valid word: ' . $e->getMessage());
        }
    }

    public function updateValidWord($wordId, $newWordEntry) {
        try {
            $stmt = $this->pdo->prepare('UPDATE valid_words SET word_group = ? WHERE id = ?');
            $stmt->execute([$newWordEntry, $wordId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error updating valid word: ' . $e->getMessage());
        }
    }

    public function deleteValidWord($wordId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM valid_words WHERE id = ?');
            $stmt->execute([$wordId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error deleting valid word: ' . $e->getMessage());
        }
    }

    public function deleteValidWordsByPrompt($promptId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM valid_words WHERE prompt_id = ?');
            $stmt->execute([$promptId]);
            return $stmt->rowCount();
        } catch (PDOException $e) {
            throw new Exception('Error deleting valid words: ' . $e->getMessage());
        }
    }

    public function getStats() {
        try {
            $categories = $this->pdo->query('SELECT COUNT(*) as count FROM categories WHERE is_active = 1')->fetch()['count'];
            $prompts = $this->pdo->query('SELECT COUNT(*) as count FROM prompts WHERE is_active = 1')->fetch()['count'];
            $words = $this->pdo->query('SELECT COUNT(*) as count FROM valid_words')->fetch()['count'];

            return [
                'categories' => (int)$categories,
                'prompts' => (int)$prompts,
                'words' => (int)$words
            ];
        } catch (PDOException $e) {
            throw new Exception('Error fetching stats: ' . $e->getMessage());
        }
    }

    public function getGames() {
        try {
            $sql = 'SELECT 
                g.id,
                g.id as code,
                g.status,
                g.round as current_round,
                g.updated_at,
                COUNT(DISTINCT p.id) as player_count
            FROM games g
            LEFT JOIN players p ON g.id = p.game_id
            GROUP BY g.id
            ORDER BY g.updated_at DESC
            LIMIT 100';
            
            $stmt = $this->pdo->query($sql);
            $games = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($games as &$game) {
                $game['host_name'] = 'TalCual';
                $game['player_count'] = (int)$game['player_count'];
                $game['current_round'] = (int)$game['current_round'];
                $game['created_at'] = date('Y-m-d H:i:s', $game['updated_at']);
            }
            
            return $games;
        } catch (PDOException $e) {
            throw new Exception('Error fetching games: ' . $e->getMessage());
        }
    }

    public function getGameByCode($code) {
        try {
            $stmt = $this->pdo->prepare('SELECT 
                id, status, round as current_round, updated_at, 
                (SELECT COUNT(*) FROM players WHERE game_id = games.id) as player_count
            FROM games WHERE id = ? LIMIT 1');
            $stmt->execute([$code]);
            $game = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($game) {
                $game['code'] = $game['id'];
                $game['host_name'] = 'TalCual';
                $game['created_at'] = date('Y-m-d H:i:s', $game['updated_at']);
            }
            
            return $game;
        } catch (PDOException $e) {
            throw new Exception('Error fetching game: ' . $e->getMessage());
        }
    }

    public function deleteGame($code) {
        try {
            $this->pdo->prepare('DELETE FROM players WHERE game_id = ?')->execute([$code]);
            $this->pdo->prepare('DELETE FROM games WHERE id = ?')->execute([$code]);
            return true;
        } catch (PDOException $e) {
            throw new Exception('Error deleting game: ' . $e->getMessage());
        }
    }

    public function getDatabaseInspection() {
        try {
            $inspection = [
                'categories' => $this->pdo->query('SELECT id, name FROM categories WHERE is_active = 1 ORDER BY id')->fetchAll(PDO::FETCH_ASSOC),
                'prompts' => $this->pdo->query('SELECT p.id, p.text, (SELECT GROUP_CONCAT(category_id, ",") FROM prompt_categories WHERE prompt_id = p.id) as category_ids FROM prompts p WHERE p.is_active = 1 GROUP BY p.id ORDER BY p.id')->fetchAll(PDO::FETCH_ASSOC),
                'words' => $this->pdo->query('SELECT id, prompt_id, word_group FROM valid_words ORDER BY prompt_id, id')->fetchAll(PDO::FETCH_ASSOC),
                'games' => $this->pdo->query('SELECT id, status, round, updated_at FROM games ORDER BY id')->fetchAll(PDO::FETCH_ASSOC),
                'players' => $this->pdo->query('SELECT id, game_id, name, score FROM players ORDER BY game_id, id')->fetchAll(PDO::FETCH_ASSOC),
                'stats' => [
                    'categories_count' => $this->pdo->query('SELECT COUNT(*) as count FROM categories WHERE is_active = 1')->fetch()['count'],
                    'prompts_count' => $this->pdo->query('SELECT COUNT(*) as count FROM prompts WHERE is_active = 1')->fetch()['count'],
                    'words_count' => $this->pdo->query('SELECT COUNT(*) as count FROM valid_words')->fetch()['count'],
                    'games_count' => $this->pdo->query('SELECT COUNT(*) as count FROM games')->fetch()['count'],
                    'players_count' => $this->pdo->query('SELECT COUNT(*) as count FROM players')->fetch()['count']
                ]
            ];
            return $inspection;
        } catch (PDOException $e) {
            throw new Exception('Error inspecting database: ' . $e->getMessage());
        }
    }

    public function vacuumDatabase() {
        try {
            $this->pdo->exec('VACUUM');
            $this->db->checkpoint();
            return true;
        } catch (PDOException $e) {
            throw new Exception('Error vacuuming database: ' . $e->getMessage());
        }
    }
}
?>