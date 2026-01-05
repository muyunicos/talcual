<?php

trait WordNormalizer {
    protected static function normalizeWord($rawWord) {
        if (empty($rawWord)) {
            return '';
        }
        
        $word = trim($rawWord);
        $word = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $word);
        $word = strtoupper($word);
        $word = preg_replace('/[^A-Z0-9]/', '', $word);
        
        return $word;
    }

    protected static function cleanWordPrompt($rawWord) {
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
        
        return self::normalizeWord($word);
    }
}
?>