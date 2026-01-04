<?php

require_once __DIR__ . '/Database.php';

class DictionaryManager {
    private $db = null;
    private $pdo = null;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->pdo = $this->db->getConnection();
    }

    public function getCategories() {
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
            
            if ($stmt->rowCount() > 0) {
                return $this->getCategoryByName($categoryName);
            } else {
                return $this->getCategoryByName($categoryName);
            }
        } catch (PDOException $e) {
            throw new Exception('Error adding category: ' . $e->getMessage());
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

    public function getPrompts($categoryId = null) {
        try {
            if ($categoryId) {
                $stmt = $this->pdo->prepare('SELECT id, category_id, text FROM prompts WHERE category_id = ? ORDER BY text');
                $stmt->execute([$categoryId]);
            } else {
                $stmt = $this->pdo->query('SELECT id, category_id, text FROM prompts ORDER BY category_id, text');
            }
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching prompts: ' . $e->getMessage());
        }
    }

    public function getPromptById($promptId) {
        try {
            $stmt = $this->pdo->prepare('SELECT id, category_id, text FROM prompts WHERE id = ?');
            $stmt->execute([$promptId]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching prompt: ' . $e->getMessage());
        }
    }

    public function addPrompt($categoryId, $promptText) {
        try {
            $stmt = $this->pdo->prepare('INSERT INTO prompts (category_id, text) VALUES (?, ?)');
            $stmt->execute([$categoryId, $promptText]);
            return $this->pdo->lastInsertId();
        } catch (PDOException $e) {
            throw new Exception('Error adding prompt: ' . $e->getMessage());
        }
    }

    public function updatePrompt($promptId, $newText) {
        try {
            $stmt = $this->pdo->prepare('UPDATE prompts SET text = ? WHERE id = ?');
            $stmt->execute([$newText, $promptId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error updating prompt: ' . $e->getMessage());
        }
    }

    public function deletePrompt($promptId) {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM prompts WHERE id = ?');
            $stmt->execute([$promptId]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            throw new Exception('Error deleting prompt: ' . $e->getMessage());
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

    public function addValidWords($promptId, array $wordEntries) {
        try {
            $this->db->beginTransaction();
            $stmt = $this->pdo->prepare('INSERT INTO valid_words (prompt_id, word_entry) VALUES (?, ?)');
            $count = 0;

            foreach ($wordEntries as $wordEntry) {
                $stmt->execute([$promptId, (string)$wordEntry]);
                $count++;
            }

            $this->db->commit();
            return $count;
        } catch (PDOException $e) {
            $this->db->rollback();
            throw new Exception('Error adding valid words: ' . $e->getMessage());
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

    public function getFullDictionary() {
        try {
            $sql = 'SELECT 
                c.id as category_id,
                c.name as category_name,
                p.id as prompt_id,
                p.text as prompt_text,
                vw.id as word_id,
                vw.word_entry
            FROM categories c
            LEFT JOIN prompts p ON c.id = p.category_id
            LEFT JOIN valid_words vw ON p.id = vw.prompt_id
            ORDER BY c.name, p.text, vw.word_entry';
            
            $stmt = $this->pdo->query($sql);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('Error fetching full dictionary: ' . $e->getMessage());
        }
    }

    public function getStats() {
        try {
            $categories = $this->pdo->query('SELECT COUNT(*) as count FROM categories')->fetch()['count'];
            $prompts = $this->pdo->query('SELECT COUNT(*) as count FROM prompts')->fetch()['count'];
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
}

function printHeader($title) {
    echo "\n" . str_repeat("=", 70) . "\n";
    echo "{$title}\n";
    echo str_repeat("=", 70) . "\n\n";
}

function printSubHeader($title) {
    echo "\n" . str_repeat("-", 70) . "\n";
    echo "{$title}\n";
    echo str_repeat("-", 70) . "\n\n";
}

function printStats(DictionaryManager $manager) {
    $stats = $manager->getStats();
    echo "📈 ESTADO ACTUAL DE BASE DE DATOS\n";
    echo "   Categorías:  " . $stats['categories'] . "\n";
    echo "   Consignas:   " . $stats['prompts'] . "\n";
    echo "   Palabras:    " . $stats['words'] . "\n\n";
}

try {
    $manager = new DictionaryManager();

    printHeader("📚 TalCual Dictionary Manager (SQLite)");

    echo "Available commands:\n";
    echo "  list_categories       - List all categories\n";
    echo "  list_prompts          - List all prompts\n";
    echo "  list_words            - List all valid words\n";
    echo "  full_dictionary       - Show full dictionary structure\n";
    echo "  add_category          - Add a new category\n";
    echo "  add_prompt            - Add a new prompt to category\n";
    echo "  add_words             - Add multiple words to prompt\n";
    echo "  delete_category       - Delete a category\n";
    echo "  delete_prompt         - Delete a prompt\n";
    echo "  delete_word           - Delete a word\n";
    echo "  stats                 - Show database statistics\n";
    echo "\n";

    $command = isset($argv[1]) ? $argv[1] : 'stats';
    $args = array_slice($argv, 2);

    switch ($command) {
        case 'list_categories':
            printSubHeader("🗄️ Categories");
            $categories = $manager->getCategories();
            foreach ($categories as $cat) {
                echo "[{$cat['id']}] {$cat['name']}\n";
            }
            echo "\n";
            break;

        case 'list_prompts':
            printSubHeader("📄 Prompts");
            $categoryId = isset($args[0]) ? (int)$args[0] : null;
            $prompts = $manager->getPrompts($categoryId);
            foreach ($prompts as $prompt) {
                echo "[{$prompt['id']}] Cat#{$prompt['category_id']}: {$prompt['text']}\n";
            }
            echo "\n";
            break;

        case 'list_words':
            printSubHeader("🔍 Valid Words");
            $promptId = isset($args[0]) ? (int)$args[0] : null;
            $words = $manager->getValidWords($promptId);
            foreach ($words as $word) {
                echo "[{$word['id']}] Prompt#{$word['prompt_id']}: {$word['word_entry']}\n";
            }
            echo "\n";
            break;

        case 'full_dictionary':
            printSubHeader("📚 Full Dictionary Structure");
            $dict = $manager->getFullDictionary();
            $lastCategory = null;
            $lastPrompt = null;
            foreach ($dict as $row) {
                if ($row['category_name'] !== $lastCategory) {
                    echo "\n📅 {$row['category_name']}\n";
                    $lastCategory = $row['category_name'];
                    $lastPrompt = null;
                }
                if ($row['prompt_text'] && $row['prompt_text'] !== $lastPrompt) {
                    echo "  ↓ {$row['prompt_text']}\n";
                    $lastPrompt = $row['prompt_text'];
                }
                if ($row['word_entry']) {
                    echo "     - {$row['word_entry']}\n";
                }
            }
            echo "\n";
            break;

        case 'add_category':
            if (empty($args)) {
                echo "\n⚠️  Usage: php migrate_dictionary.php add_category 'Category Name'\n\n";
                exit(1);
            }
            printSubHeader("➕ Adding Category");
            $categoryName = $args[0];
            $result = $manager->addCategory($categoryName);
            if ($result) {
                echo "✅ Category added: #{$result['id']} {$result['name']}\n\n";
            } else {
                echo "⚠️  Category already exists: {$categoryName}\n\n";
            }
            break;

        case 'add_prompt':
            if (count($args) < 2) {
                echo "\n⚠️  Usage: php migrate_dictionary.php add_prompt <category_id> 'Prompt Text'\n\n";
                exit(1);
            }
            printSubHeader("➕ Adding Prompt");
            $categoryId = (int)$args[0];
            $promptText = $args[1];
            $promptId = $manager->addPrompt($categoryId, $promptText);
            echo "✅ Prompt added: #{$promptId}\n";
            echo "   Category: #{$categoryId}\n";
            echo "   Text: {$promptText}\n\n";
            break;

        case 'add_words':
            if (count($args) < 2) {
                echo "\n⚠️  Usage: php migrate_dictionary.php add_words <prompt_id> 'word1|alt1' 'word2' ...\n\n";
                exit(1);
            }
            printSubHeader("➕ Adding Words");
            $promptId = (int)$args[0];
            $words = array_slice($args, 1);
            $count = $manager->addValidWords($promptId, $words);
            echo "✅ {$count} words added to prompt #{$promptId}\n\n";
            foreach ($words as $word) {
                echo "   - {$word}\n";
            }
            echo "\n";
            break;

        case 'delete_category':
            if (empty($args)) {
                echo "\n⚠️  Usage: php migrate_dictionary.php delete_category <category_id>\n\n";
                exit(1);
            }
            printSubHeader("❌ Deleting Category");
            $categoryId = (int)$args[0];
            $result = $manager->deleteCategory($categoryId);
            if ($result) {
                echo "✅ Category #{$categoryId} deleted\n\n";
            } else {
                echo "⚠️  Category #{$categoryId} not found\n\n";
            }
            break;

        case 'delete_prompt':
            if (empty($args)) {
                echo "\n⚠️  Usage: php migrate_dictionary.php delete_prompt <prompt_id>\n\n";
                exit(1);
            }
            printSubHeader("❌ Deleting Prompt");
            $promptId = (int)$args[0];
            $result = $manager->deletePrompt($promptId);
            if ($result) {
                echo "✅ Prompt #{$promptId} deleted\n\n";
            } else {
                echo "⚠️  Prompt #{$promptId} not found\n\n";
            }
            break;

        case 'delete_word':
            if (empty($args)) {
                echo "\n⚠️  Usage: php migrate_dictionary.php delete_word <word_id>\n\n";
                exit(1);
            }
            printSubHeader("❌ Deleting Word");
            $wordId = (int)$args[0];
            $result = $manager->deleteValidWord($wordId);
            if ($result) {
                echo "✅ Word #{$wordId} deleted\n\n";
            } else {
                echo "⚠️  Word #{$wordId} not found\n\n";
            }
            break;

        case 'stats':
            printSubHeader("📈 Dictionary Statistics");
            printStats($manager);
            break;

        default:
            echo "❌ Unknown command: {$command}\n\n";
            exit(1);
    }

    printStats($manager);
    exit(0);

} catch (Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n\n";
    exit(1);
}
?>
