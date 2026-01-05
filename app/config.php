<?php
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/GameRepository.php';

function logMessage($message, $level = 'INFO') {
    if (!DEV_MODE && $level === 'DEBUG') return;
    
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[{$timestamp}] [{$level}] {$message}\n";
    
    if (DEV_MODE) {
        error_log($logMessage);
    }
}

function normalizeWord($rawWord) {
    if (empty($rawWord)) {
        return '';
    }
    
    $word = trim($rawWord);
    
    $word = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $word);
    
    $word = strtoupper($word);
    
    $word = preg_replace('/[^A-Z0-9]/', '', $word);
    
    return $word;
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
    
    return normalizeWord($word);
}

function getCategories() {
    try {
        $db = Database::getInstance();
        $pdo = $db->getConnection();
        
        $stmt = $pdo->query('SELECT name FROM categories ORDER BY name ASC');
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        return array_map(function($row) { return $row['name']; }, $rows);
    } catch (Exception $e) {
        logMessage('Error fetching categories from SQLite: ' . $e->getMessage(), 'ERROR');
        return [];
    }
}

function getTopicCard($category) {
    try {
        $db = Database::getInstance();
        $pdo = $db->getConnection();
        
        $categoryStmt = $pdo->prepare('SELECT id FROM categories WHERE name = ?');
        $categoryStmt->execute([$category]);
        $categoryRow = $categoryStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$categoryRow) {
            return [
                'question' => 'JUEGO',
                'answers' => []
            ];
        }
        
        $categoryId = $categoryRow['id'];
        
        $promptStmt = $pdo->prepare(
            'SELECT p.id, p.text FROM prompts p '
            . 'JOIN prompt_categories pc ON p.id = pc.prompt_id '
            . 'WHERE pc.category_id = ? '
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
        
        $wordStmt = $pdo->prepare(
            'SELECT word_entry FROM valid_words WHERE prompt_id = ? ORDER BY word_entry ASC'
        );
        $wordStmt->execute([$promptId]);
        $wordRows = $wordStmt->fetchAll(PDO::FETCH_ASSOC);
        
        $answers = array_map(function($row) { return $row['word_entry']; }, $wordRows);
        
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

function getAllResponsesByCategory($category) {
    try {
        $db = Database::getInstance();
        $pdo = $db->getConnection();
        
        $sql = 'SELECT DISTINCT vw.word_entry '
             . 'FROM valid_words vw '
             . 'JOIN prompts p ON vw.prompt_id = p.id '
             . 'JOIN prompt_categories pc ON p.id = pc.prompt_id '
             . 'JOIN categories c ON pc.category_id = c.id '
             . 'WHERE c.name = ? '
             . 'ORDER BY vw.word_entry ASC';
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$category]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        return array_map(function($row) { return $row['word_entry']; }, $rows);
    } catch (Exception $e) {
        logMessage('Error fetching responses for category ' . $category . ': ' . $e->getMessage(), 'ERROR');
        return [];
    }
}

function getRandomWordByCategoryFiltered($category, $maxLength = null) {
    if ($maxLength === null) {
        $maxLength = MAX_CODE_LENGTH;
    }
    
    try {
        $db = Database::getInstance();
        $pdo = $db->getConnection();
        
        $categoryStmt = $pdo->prepare('SELECT id FROM categories WHERE name = ?');
        $categoryStmt->execute([$category]);
        $categoryRow = $categoryStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$categoryRow) {
            return null;
        }
        
        $categoryId = $categoryRow['id'];
        $attempts = 0;
        $maxAttempts = 30;
        
        while ($attempts < $maxAttempts) {
            $sql = 'SELECT vw.word_entry '
                 . 'FROM valid_words vw '
                 . 'JOIN prompts p ON vw.prompt_id = p.id '
                 . 'JOIN prompt_categories pc ON p.id = pc.prompt_id '
                 . 'WHERE pc.category_id = ? '
                 . 'ORDER BY RANDOM() '
                 . 'LIMIT 1';
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$categoryId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$row) {
                return null;
            }
            
            $rawWord = $row['word_entry'];
            $cleaned = cleanWordPrompt($rawWord);
            
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

function generateGameCode() {
    $categories = getCategories();
    
    if (empty($categories)) {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        do {
            $code = '';
            for ($i = 0; $i < 4; $i++) {
                $code .= $chars[rand(0, strlen($chars) - 1)];
            }
        } while (gameExists($code));
        
        return $code;
    }
    
    $roomCodeCandidates = [];
    
    foreach ($categories as $category) {
        $word = getRandomWordByCategoryFiltered($category, MAX_CODE_LENGTH);
        
        if ($word && !gameExists($word)) {
            $roomCodeCandidates[] = $word;
        }
    }
    
    if (!empty($roomCodeCandidates)) {
        return $roomCodeCandidates[array_rand($roomCodeCandidates)];
    }
    
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    do {
        $code = '';
        for ($i = 0; $i < 4; $i++) {
            $code .= $chars[rand(0, strlen($chars) - 1)];
        }
    } while (gameExists($code));
    
    if (mb_strlen($code) > MAX_CODE_LENGTH) {
        logMessage('[WARNING] Código generado excede MAX_CODE_LENGTH: ' . $code, 'WARNING');
        $code = substr($code, 0, MAX_CODE_LENGTH);
    }
    
    return $code;
}

function sanitizeGameId($gameId) {
    if (empty($gameId)) return null;
    
    $clean = preg_replace('/[^A-Z0-9]/', '', strtoupper($gameId));
    
    if (strlen($clean) < 3 || strlen($clean) > MAX_CODE_LENGTH) {
        return null;
    }
    
    return $clean;
}

function sanitizePlayerId($playerId) {
    if (empty($playerId)) return null;
    
    $clean = preg_replace('/[^a-zA-Z0-9_]/', '', $playerId);
    
    if (strlen($clean) < 5 || strlen($clean) > 50) {
        return null;
    }
    
    return $clean;
}

function validatePlayerColor($color) {
    if (empty($color)) return null;
    
    $parts = explode(',', $color);
    
    if (count($parts) !== 2) return null;
    
    foreach ($parts as $part) {
        if (!preg_match('/^#[0-9A-Fa-f]{6}$/', trim($part))) {
            return null;
        }
    }
    
    return $color;
}

function saveGameState($gameId, $state) {
    $gameId = sanitizeGameId($gameId);
    if (!$gameId) {
        logMessage('Intento de guardar con gameId inválido', 'ERROR');
        return false;
    }
    
    if (strlen($gameId) > MAX_CODE_LENGTH) {
        logMessage('[ERROR] gameId excede MAX_CODE_LENGTH: ' . $gameId . ' (longitud: ' . strlen($gameId) . ')', 'ERROR');
        return false;
    }
    
    $state['_version'] = 1;
    $state['_updated_at'] = time();
    
    try {
        $db = Database::getInstance();
        $repo = new GameRepository();
        $repo->save($gameId, $state);
        logMessage('[SUCCESS] Estado guardado para ' . $gameId . ' vía SQLite', 'DEBUG');
        return true;
    } catch (Exception $e) {
        logMessage('[ERROR] Error guardando a SQLite: ' . $e->getMessage(), 'ERROR');
        return false;
    }
}

function loadGameState($gameId) {
    $gameId = sanitizeGameId($gameId);
    if (!$gameId) {
        logMessage('[ERROR] Intento de cargar con gameId inválido', 'ERROR');
        return null;
    }
    
    if (strlen($gameId) > MAX_CODE_LENGTH) {
        logMessage('[ERROR] gameId excede MAX_CODE_LENGTH en loadGameState: ' . $gameId, 'ERROR');
        return null;
    }
    
    try {
        $db = Database::getInstance();
        $repo = new GameRepository();
        $state = $repo->load($gameId);
        
        if ($state) {
            logMessage('[DEBUG] Estado cargado desde SQLite: ' . $gameId, 'DEBUG');
            return $state;
        }
        
        logMessage('[DEBUG] Game no encontrado en SQLite: ' . $gameId, 'DEBUG');
        return null;
        
    } catch (Exception $e) {
        logMessage('[ERROR] Error cargando de SQLite: ' . $e->getMessage(), 'ERROR');
        return null;
    }
}

function cleanupOldGames() {
    try {
        $db = Database::getInstance();
        $repo = new GameRepository();
        $deleted = $repo->cleanup(MAX_GAME_AGE);
        logMessage('[INFO] Cleanup: ' . $deleted . ' old games removed from SQLite', 'INFO');
        return $deleted;
    } catch (Exception $e) {
        logMessage('[ERROR] Cleanup failed: ' . $e->getMessage(), 'ERROR');
        return 0;
    }
}

function gameExists($gameId) {
    $gameId = sanitizeGameId($gameId);
    if (!$gameId) return false;
    if (strlen($gameId) > MAX_CODE_LENGTH) return false;
    
    try {
        $db = Database::getInstance();
        $repo = new GameRepository();
        return $repo->exists($gameId);
    } catch (Exception $e) {
        logMessage('[ERROR] gameExists check failed: ' . $e->getMessage(), 'ERROR');
        return false;
    }
}

function getDictionaryStats() {
    try {
        $db = Database::getInstance();
        $pdo = $db->getConnection();
        
        $categoryCount = $pdo->query('SELECT COUNT(*) as count FROM categories')->fetch()['count'];
        $categories = getCategories();
        
        $stats = [
            'categorias' => (int)$categoryCount,
            'total_palabras' => 0,
            'palabras_codigo' => 0,
            'categorias_detalle' => []
        ];
        
        foreach ($categories as $categoria) {
            $responses = getAllResponsesByCategory($categoria);
            $cleanedWords = array_map('cleanWordPrompt', $responses);
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

if (rand(1, 100) <= (CLEANUP_PROBABILITY * 100)) {
    cleanupOldGames();
}
?>