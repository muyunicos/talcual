<?php

require_once __DIR__ . '/config.php';

class Database {
    private static $instance = null;
    private $pdo = null;
    private $inTransaction = false;

    private function __construct() {
        try {
            $this->pdo = new PDO(
                'sqlite:' . DB_PATH,
                null,
                null,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_TIMEOUT => 5000
                ]
            );
            
            $this->pdo->exec('PRAGMA journal_mode = WAL');
            $this->pdo->exec('PRAGMA synchronous = NORMAL');
            $this->pdo->exec('PRAGMA cache_size = 10000');
            $this->pdo->exec('PRAGMA foreign_keys = ON');
            
            $this->initializeSchema();
        } catch (PDOException $e) {
            logMessage('Database connection failed: ' . $e->getMessage(), 'ERROR');
            throw new Exception('Database connection failed');
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection() {
        return $this->pdo;
    }

    private function initializeSchema() {
        $schema = file_get_contents(__DIR__ . '/schema.sql');
        $statements = array_filter(array_map('trim', explode(';', $schema)));
        
        foreach ($statements as $statement) {
            if (!empty($statement)) {
                try {
                    $this->pdo->exec($statement);
                } catch (PDOException $e) {
                    if (strpos($e->getMessage(), 'already exists') === false) {
                        logMessage('Schema initialization error: ' . $e->getMessage(), 'WARN');
                    }
                }
            }
        }
    }

    public function beginTransaction() {
        if (!$this->inTransaction) {
            $this->pdo->beginTransaction();
            $this->inTransaction = true;
        }
    }

    public function commit() {
        if ($this->inTransaction) {
            $this->pdo->commit();
            $this->inTransaction = false;
        }
    }

    public function rollback() {
        if ($this->inTransaction) {
            $this->pdo->rollBack();
            $this->inTransaction = false;
        }
    }

    public function checkpoint() {
        try {
            $this->pdo->exec('PRAGMA wal_checkpoint(TRUNCATE)');
        } catch (PDOException $e) {
            logMessage('Checkpoint failed: ' . $e->getMessage(), 'WARN');
        }
    }
}

?>
