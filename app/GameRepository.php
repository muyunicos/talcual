<?php

class GameRepository {
    private $gameStatesDir;

    public function __construct($gameStatesDir) {
        $this->gameStatesDir = $gameStatesDir;
        $this->ensureDirectory();
    }

    private function ensureDirectory() {
        if (!is_dir($this->gameStatesDir)) {
            if (!@mkdir($this->gameStatesDir, 0755, true)) {
                throw new Exception('No se pudo crear directorio: ' . $this->gameStatesDir);
            }
        }
        if (!is_writable($this->gameStatesDir)) {
            throw new Exception('Directorio no tiene permisos de escritura: ' . $this->gameStatesDir);
        }
    }

    public function load($gameId) {
        if (strlen($gameId) > MAX_CODE_LENGTH) {
            throw new Exception('gameId excede MAX_CODE_LENGTH');
        }

        $file = $this->gameStatesDir . '/' . $gameId . '.json';

        if (!file_exists($file)) {
            return null;
        }

        if (time() - filemtime($file) > MAX_GAME_AGE) {
            @unlink($file);
            return null;
        }

        $json = @file_get_contents($file);
        if ($json === false) {
            throw new Exception('No se pudo leer archivo: ' . $file);
        }

        $state = json_decode($json, true);
        if ($state === null) {
            throw new Exception('Error decoding JSON: ' . json_last_error_msg());
        }

        if (!isset($state['_version'])) {
            $state['_version'] = 0;
        }

        return $state;
    }

    public function save($gameId, $state) {
        if (strlen($gameId) > MAX_CODE_LENGTH) {
            throw new Exception('gameId excede MAX_CODE_LENGTH');
        }

        $state['_version'] = 1;
        $state['_updated_at'] = time();

        $file = $this->gameStatesDir . '/' . $gameId . '.json';
        $lockFile = $file . '.lock';

        $lock = @fopen($lockFile, 'c+');
        if (!$lock) {
            throw new Exception('No se pudo abrir lockfile: ' . $lockFile);
        }

        if (!@flock($lock, LOCK_EX)) {
            fclose($lock);
            throw new Exception('No se pudo obtener lock para ' . $gameId);
        }

        try {
            $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

            if ($json === false) {
                throw new Exception('Error encoding JSON: ' . json_last_error_msg());
            }

            $jsonSize = strlen($json);
            if ($jsonSize > 1000000) {
                throw new Exception('JSON demasiado grande: ' . $jsonSize . ' bytes');
            }

            $result = @file_put_contents($file, $json, LOCK_EX);
            if ($result === false) {
                throw new Exception('Error escribiendo archivo: ' . $file);
            }

            if (!file_exists($file)) {
                throw new Exception('Archivo no existe después de escribir: ' . $file);
            }

            $fileSize = filesize($file);
            if ($fileSize === 0 || $fileSize === false) {
                throw new Exception('Archivo está vacío o no se puede leer: ' . $file);
            }

            return true;

        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
            @unlink($lockFile);
        }
    }

    public function exists($gameId) {
        if (strlen($gameId) > MAX_CODE_LENGTH) {
            return false;
        }

        $file = $this->gameStatesDir . '/' . $gameId . '.json';

        if (!file_exists($file)) {
            return false;
        }

        if (time() - filemtime($file) > MAX_GAME_AGE) {
            @unlink($file);
            return false;
        }

        return true;
    }

    public function delete($gameId) {
        if (strlen($gameId) > MAX_CODE_LENGTH) {
            throw new Exception('gameId excede MAX_CODE_LENGTH');
        }

        $file = $this->gameStatesDir . '/' . $gameId . '.json';

        if (file_exists($file)) {
            if (!@unlink($file)) {
                throw new Exception('No se pudo eliminar archivo: ' . $file);
            }
        }

        return true;
    }
}
?>
