<?php
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/Database.php';

function logMessage($message, $level = 'INFO') {
    if (!DEV_MODE && $level === 'DEBUG') return;
    
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[{$timestamp}] [{$level}] {$message}\n";
    
    if (DEV_MODE) {
        error_log($logMessage);
    }
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
?>
