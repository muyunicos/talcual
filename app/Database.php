<?php

class Database {
    private static $instance = null;
    private $pdo = null;
    private $dbPath = null;

    private function __construct() {
        $this->dbPath = __DIR__ . '/../data/talcual.db';
        $this->ensureDataDirectory();
        $this->connect();
    }

    private function ensureDataDirectory() {
        $dataDir = dirname($this->dbPath);
        if (!is_dir($dataDir)) {
            if (!@mkdir($dataDir, 0755, true)) {
                throw new Exception('No se pudo crear directorio de datos: ' . $dataDir);
            }
        }
        if (!is_writable($dataDir)) {
            throw new Exception('Directorio de datos no tiene permisos de escritura: ' . $dataDir);
        }
    }

    private function connect() {
        try {
            $this->pdo = new PDO(
                'sqlite:' . $this->dbPath,
                null,
                null,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_TIMEOUT => 30
                ]
            );

            $this->pdo->exec('PRAGMA journal_mode = WAL');
            $this->pdo->exec('PRAGMA foreign_keys = ON');
            $this->pdo->exec('PRAGMA synchronous = NORMAL');

            logMessage('SQLite connected: ' . $this->dbPath, 'DEBUG');

        } catch (PDOException $e) {
            logMessage('SQLite connection failed: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database connection error: ' . $e->getMessage());
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection() {
        if ($this->pdo === null) {
            $this->connect();
        }
        return $this->pdo;
    }

    public function getDatabasePath() {
        return $this->dbPath;
    }

    public function beginTransaction() {
        try {
            $this->getConnection()->beginTransaction();
        } catch (PDOException $e) {
            logMessage('Transaction begin failed: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Transaction error: ' . $e->getMessage());
        }
    }

    public function commit() {
        try {
            $this->getConnection()->commit();
        } catch (PDOException $e) {
            logMessage('Transaction commit failed: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Transaction error: ' . $e->getMessage());
        }
    }

    public function rollback() {
        try {
            $this->getConnection()->rollBack();
        } catch (PDOException $e) {
            logMessage('Transaction rollback failed: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Transaction error: ' . $e->getMessage());
        }
    }

    public function prepare($sql) {
        try {
            return $this->getConnection()->prepare($sql);
        } catch (PDOException $e) {
            logMessage('Prepare failed: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database prepare error: ' . $e->getMessage());
        }
    }

    public function execute($sql, $params = []) {
        try {
            $stmt = $this->prepare($sql);
            $stmt->execute($params);
            return $stmt;
        } catch (PDOException $e) {
            logMessage('Execute failed: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database execute error: ' . $e->getMessage());
        }
    }

    public function lastInsertId() {
        return $this->getConnection()->lastInsertId();
    }
}
?>
