<?php

class AdminDictionary {
    use WordNormalizer;
    
    private $pdo = null;

    public function __construct() {
        require_once __DIR__ . '/../app/Database.php';
        require_once __DIR__ . '/../app/Traits/WordNormalizer.php';
        
        $db = Database::getInstance();
        $this->pdo = $db->getConnection();
    }

    public function getCategoriesFull() {
        try {
            $stmt = $this->pdo->query('SELECT id, name FROM categories ORDER BY name');
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching categories: ' . $e->getMessage());
        }
    }

    public function getCategoryById($categoryId) {
        try {
            $stmt = $this->pdo->prepare('SELECT id, name FROM categories WHERE id = ?');
            $stmt->execute([$categoryId]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching category: ' . $e->getMessage());
        }
    }

    public function getCategoryByName($categoryName) {
        try {
            $stmt = $this->pdo->prepare('SELECT id, name FROM categories WHERE name = ?');
            $stmt->execute([$categoryName]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching category by name: ' . $e->getMessage());
        }
    }

    public function addCategory($categoryName) {
        try {
            $stmt = $this->pdo->prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
            $stmt->execute([$categoryName]);
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

    public function getPromptsWithStats($categoryId) {
        try {
            $sql = 'SELECT 
                p.id, p.text,
                (SELECT GROUP_CONCAT(category_id, ",") FROM prompt_categories WHERE prompt_id = p.id) as category_ids,
                COUNT(DISTINCT vw.id) as word_count
            FROM prompts p
            JOIN prompt_categories pc ON p.id = pc.prompt_id
            LEFT JOIN valid_words vw ON p.id = vw.prompt_id
            WHERE pc.category_id = ?
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
                $sql = 'SELECT p.id, p.text, '
                    . '(SELECT GROUP_CONCAT(category_id, ",") FROM prompt_categories WHERE prompt_id = p.id) as category_ids '
                    . 'FROM prompts p '
                    . 'JOIN prompt_categories pc ON p.id = pc.prompt_id '
                    . 'WHERE pc.category_id = ? '
                    . 'GROUP BY p.id, p.text '
                    . 'ORDER BY p.text';
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([$categoryId]);
            } else {
                $sql = 'SELECT p.id, p.text, '
                    . '(SELECT GROUP_CONCAT(category_id, ",") FROM prompt_categories WHERE prompt_id = p.id) as category_ids '
                    . 'FROM prompts p '
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
            $sql = 'SELECT p.id, p.text, '
                . '(SELECT GROUP_CONCAT(category_id, ",") FROM prompt_categories WHERE prompt_id = p.id) as category_ids '
                . 'FROM prompts p '
                . 'WHERE p.id = ?';
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
            
            $stmt = $this->pdo->prepare('INSERT INTO prompts (text) VALUES (?)');
            $stmt->execute([$promptText]);
            $promptId = $this->pdo->lastInsertId();
            
            $relStmt = $this->pdo->prepare('INSERT INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)');
            foreach ($categoryIds as $catId) {
                $relStmt->execute([$promptId, $catId]);
            }
            
            return $promptId;
        } catch (Exception $e) {
            throw new Exception('Error adding prompt: ' . $e->getMessage());
        }
    }

    public function updatePrompt($promptId, $newText, $categoryIds = null) {
        try {
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
            
            return true;
        } catch (Exception $e) {
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
                $stmt = $this->pdo->prepare('SELECT id, prompt_id, word_entry FROM valid_words WHERE prompt_id = ? ORDER BY word_entry');
                $stmt->execute([$promptId]);
            } else {
                $stmt = $this->pdo->query('SELECT id, prompt_id, word_entry FROM valid_words ORDER BY prompt_id, word_entry');
            }
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching valid words: ' . $e->getMessage());
        }
    }

    public function getValidWordById($wordId) {
        try {
            $stmt = $this->pdo->prepare('SELECT id, prompt_id, word_entry FROM valid_words WHERE id = ?');
            $stmt->execute([$wordId]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching valid word: ' . $e->getMessage());
        }
    }

    public function addValidWord($promptId, $wordEntry) {
        try {
            $stmt = $this->pdo->prepare('INSERT INTO valid_words (prompt_id, word_entry) VALUES (?, ?)');
            $stmt->execute([$promptId, $wordEntry]);
            return $this->pdo->lastInsertId();
        } catch (PDOException $e) {
            throw new Exception('Error adding valid word: ' . $e->getMessage());
        }
    }

    public function updateValidWord($wordId, $newWordEntry) {
        try {
            $stmt = $this->pdo->prepare('UPDATE valid_words SET word_entry = ? WHERE id = ?');
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

    public function getDictionaryStats() {
        try {
            $categoryCount = $this->pdo->query('SELECT COUNT(*) as count FROM categories')->fetch()['count'];
            
            $categories = $this->pdo->query('SELECT name FROM categories ORDER BY name')->fetchAll(PDO::FETCH_ASSOC);
            $categoryNames = array_map(function($row) { return $row['name']; }, $categories);
            
            $stats = [
                'categorias' => (int)$categoryCount,
                'total_palabras' => 0,
                'palabras_codigo' => 0,
                'categorias_detalle' => []
            ];
            
            $promptCount = $this->pdo->query('SELECT COUNT(*) as count FROM prompts')->fetch()['count'];
            $wordCount = $this->pdo->query('SELECT COUNT(*) as count FROM valid_words')->fetch()['count'];
            
            $stats['total_palabras'] = (int)$wordCount;
            $stats['palabras_codigo'] = (int)$wordCount;
            
            foreach ($categoryNames as $categoria) {
                $stmt = $this->pdo->prepare(
                    'SELECT COUNT(DISTINCT vw.id) as count FROM valid_words vw '
                    . 'JOIN prompts p ON vw.prompt_id = p.id '
                    . 'JOIN prompt_categories pc ON p.id = pc.prompt_id '
                    . 'JOIN categories c ON pc.category_id = c.id '
                    . 'WHERE c.name = ?'
                );
                $stmt->execute([$categoria]);
                $count = (int)$stmt->fetch()['count'];
                $stats['categorias_detalle'][$categoria] = $count;
            }
            
            return $stats;
        } catch (Exception $e) {
            throw new Exception('Error fetching dictionary stats: ' . $e->getMessage());
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
                'categories' => $this->pdo->query('SELECT id, name FROM categories ORDER BY id')->fetchAll(PDO::FETCH_ASSOC),
                'prompts' => $this->pdo->query('SELECT p.id, p.text, (SELECT GROUP_CONCAT(category_id, ",") FROM prompt_categories WHERE prompt_id = p.id) as category_ids FROM prompts p GROUP BY p.id ORDER BY p.id')->fetchAll(PDO::FETCH_ASSOC),
                'words' => $this->pdo->query('SELECT id, prompt_id, word_entry FROM valid_words ORDER BY prompt_id, id')->fetchAll(PDO::FETCH_ASSOC),
                'games' => $this->pdo->query('SELECT id, status, round, updated_at FROM games ORDER BY id')->fetchAll(PDO::FETCH_ASSOC),
                'players' => $this->pdo->query('SELECT id, game_id, name, score FROM players ORDER BY game_id, id')->fetchAll(PDO::FETCH_ASSOC),
                'stats' => [
                    'categories_count' => $this->pdo->query('SELECT COUNT(*) as count FROM categories')->fetch()['count'],
                    'prompts_count' => $this->pdo->query('SELECT COUNT(*) as count FROM prompts')->fetch()['count'],
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
            return true;
        } catch (PDOException $e) {
            throw new Exception('Error vacuuming database: ' . $e->getMessage());
        }
    }
}
?>