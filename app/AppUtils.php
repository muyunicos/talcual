<?php

class AppUtils {
    public static function sanitizeGameId($gameId) {
        if (empty($gameId)) return null;
        
        $clean = preg_replace('/[^A-Z0-9]/', '', strtoupper($gameId));
        
        if (strlen($clean) < 3 || strlen($clean) > MAX_CODE_LENGTH) {
            return null;
        }
        
        return $clean;
    }

    public static function sanitizePlayerId($playerId) {
        if (empty($playerId)) return null;
        
        $clean = preg_replace('/[^a-zA-Z0-9_]/', '', $playerId);
        
        if (strlen($clean) < 5 || strlen($clean) > 50) {
            return null;
        }
        
        return $clean;
    }

    public static function validatePlayerColor($color) {
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
}
?>
