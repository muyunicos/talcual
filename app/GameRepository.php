<?php

class GameRepository {
    private $gameStatesDir;
    private $maxRetries = 3;
    private $retryDelayMs = 50;

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

        $state = null;
        $lastError = null;

        for ($attempt = 0; $attempt < $this->maxRetries; $attempt++) {
            try {
                $json = @file_get_contents($file);
                if ($json === false) {
                    throw new Exception('No se pudo leer archivo: ' . $file);
                }

                if (empty($json)) {
                    if ($attempt < $this->maxRetries - 1) {
                        usleep($this->retryDelayMs * 1000);
                        continue;
                    }
                    throw new Exception('Archivo vacío: ' . $file);
                }

                $state = json_decode($json, true);
                if ($state === null) {
                    throw new Exception('Error decoding JSON: ' . json_last_error_msg());
                }

                if (!isset($state['_version'])) {
                    $state['_version'] = 0;
                }

                return $state;

            } catch (Exception $e) {
                $lastError = $e;
                if ($attempt < $this->maxRetries - 1) {
                    usleep($this->retryDelayMs * 1000);
                }
            }
        }

        if ($lastError) {
            logMessage('FAIL FAST: Load failed after ' . $this->maxRetries . ' attempts: ' . $lastError->getMessage(), 'ERROR');
            throw $lastError;
        }

        throw new Exception('Tidak dapat membaca state untuk ' . $gameId);
    }

    public function save($gameId, $state) {
        if (strlen($gameId) > MAX_CODE_LENGTH) {
            throw new Exception('gameId excede MAX_CODE_LENGTH');
        }

        $state['_version'] = 1;
        $state['_updated_at'] = time();

        $file = $this->gameStatesDir . '/' . $gameId . '.json';
        $lockFile = $file . '.lock';
        $tempFile = $file . '.tmp';

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

            $tempResult = @file_put_contents($tempFile, $json, LOCK_EX);
            if ($tempResult === false) {
                throw new Exception('Error escribiendo archivo temporal: ' . $tempFile);
            }

            $tempFileSize = @filesize($tempFile);
            if ($tempFileSize === false || $tempFileSize === 0) {
                @unlink($tempFile);
                throw new Exception('Archivo temporal está vacío o corrupto: ' . $tempFile);
            }

            if (!@rename($tempFile, $file)) {
                @unlink($tempFile);
                throw new Exception('Error renombrando archivo temporal a ' . $file);
            }

            if (!file_exists($file)) {
                throw new Exception('Archivo no existe después de rename: ' . $file);
            }

            $finalFileSize = @filesize($file);
            if ($finalFileSize === false || $finalFileSize === 0) {
                throw new Exception('Archivo final está vacío o corrupto: ' . $file);
            }

            return true;

        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
            @unlink($lockFile);
            @unlink($tempFile);
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