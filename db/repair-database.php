<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../app/AppUtils.php';

$action = $_GET['action'] ?? 'status';
$report = [];

try {
    $dbPath = __DIR__ . '/../data/talcual.db';
    $dataDir = dirname($dbPath);

    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0755, true);
        logMessage('Data directory created: ' . $dataDir, 'INFO');
    }

    switch ($action) {
        case 'status':
            $report = checkDatabaseStatus($dbPath);
            break;

        case 'backup':
            $report = backupCorruptedDatabase($dbPath);
            break;

        case 'nuke':
            $report = nukeAndReinitialize($dbPath, $dataDir);
            break;

        case 'repair':
            $report = repairDatabase($dbPath, $dataDir);
            break;

        case 'initialize':
            $report = initializeFreshDatabase($dbPath);
            break;

        default:
            throw new Exception('Unknown action: ' . $action);
    }

    respondSuccess($report);

} catch (Exception $e) {
    logMessage('Database repair error: ' . $e->getMessage(), 'ERROR');
    respondError($e->getMessage());
}

function checkDatabaseStatus($dbPath) {
    $report = [
        'action' => 'status',
        'database_path' => $dbPath,
        'exists' => file_exists($dbPath),
        'readable' => false,
        'writable' => false,
        'size' => 0,
        'integrity' => 'unknown',
        'is_valid_sqlite' => false,
        'timestamp' => date('Y-m-d H:i:s')
    ];

    if ($report['exists']) {
        $report['size'] = filesize($dbPath);
        $report['readable'] = is_readable($dbPath);
        $report['writable'] = is_writable($dbPath);

        if ($report['readable'] && $report['size'] > 0) {
            $handle = fopen($dbPath, 'rb');
            $header = fread($handle, 16);
            fclose($handle);

            $report['is_valid_sqlite'] = (strpos($header, 'SQLite format 3') === 0);

            if ($report['is_valid_sqlite']) {
                try {
                    $pdo = new PDO('sqlite:' . $dbPath, null, null, [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_TIMEOUT => 5
                    ]);
                    $result = $pdo->query('PRAGMA integrity_check')->fetch();
                    $report['integrity'] = $result ? $result[0] : 'unknown';
                    $pdo = null;
                } catch (Exception $e) {
                    $report['integrity'] = 'error: ' . $e->getMessage();
                }
            }
        }
    }

    return $report;
}

function backupCorruptedDatabase($dbPath) {
    if (!file_exists($dbPath)) {
        return ['action' => 'backup', 'status' => 'no_database_to_backup'];
    }

    $backupDir = dirname($dbPath) . '/backups';
    if (!is_dir($backupDir)) {
        mkdir($backupDir, 0755, true);
    }

    $timestamp = date('Y-m-d_H-i-s');
    $backupPath = $backupDir . '/talcual_' . $timestamp . '.db.bak';

    if (copy($dbPath, $backupPath)) {
        logMessage('Database backed up to: ' . $backupPath, 'INFO');
        return [
            'action' => 'backup',
            'status' => 'success',
            'backup_path' => $backupPath,
            'backup_size' => filesize($backupPath)
        ];
    } else {
        throw new Exception('Failed to backup database to ' . $backupPath);
    }
}

function nukeAndReinitialize($dbPath, $dataDir) {
    $backup = backupCorruptedDatabase($dbPath);

    if (file_exists($dbPath)) {
        if (!unlink($dbPath)) {
            throw new Exception('Failed to delete corrupted database file');
        }
        logMessage('Corrupted database deleted: ' . $dbPath, 'INFO');
    }

    $wals = glob($dbPath . '-wal');
    $shms = glob($dbPath . '-shm');

    foreach (array_merge($wals, $shms) as $file) {
        if (file_exists($file)) {
            unlink($file);
        }
    }

    $initialized = initializeFreshDatabase($dbPath);

    return [
        'action' => 'nuke_and_reinitialize',
        'backup' => $backup,
        'initialization' => $initialized
    ];
}

function repairDatabase($dbPath, $dataDir) {
    if (!file_exists($dbPath)) {
        return initializeFreshDatabase($dbPath);
    }

    try {
        $pdo = new PDO('sqlite:' . $dbPath, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 30
        ]);

        $pdo->exec('PRAGMA integrity_check');
        $pdo->exec('VACUUM');
        $pdo->exec('PRAGMA foreign_keys = ON');

        $pdo = null;

        return [
            'action' => 'repair',
            'status' => 'success',
            'message' => 'Database repaired and optimized',
            'timestamp' => date('Y-m-d H:i:s')
        ];

    } catch (Exception $e) {
        logMessage('Repair failed, will reinitialize: ' . $e->getMessage(), 'WARN');
        return nukeAndReinitialize($dbPath, $dataDir);
    }
}

function initializeFreshDatabase($dbPath) {
    try {
        $pdo = new PDO('sqlite:' . $dbPath, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);

        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA synchronous = NORMAL');
        $pdo->exec('PRAGMA wal_autocheckpoint = 1000');

        $tables = [
            'CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL DEFAULT "waiting",
                round INTEGER NOT NULL DEFAULT 0,
                current_prompt TEXT,
                current_category TEXT,
                selected_category TEXT,
                round_started_at INTEGER,
                round_starts_at INTEGER,
                round_ends_at INTEGER,
                countdown_duration INTEGER,
                created_at INTEGER,
                updated_at INTEGER,
                total_rounds INTEGER NOT NULL,
                round_duration INTEGER NOT NULL,
                min_players INTEGER NOT NULL,
                max_players INTEGER NOT NULL,
                start_countdown INTEGER,
                hurry_up_threshold INTEGER,
                max_words_per_player INTEGER,
                max_word_length INTEGER,
                data TEXT
            )',

            'CREATE TABLE IF NOT EXISTS players (
                id TEXT NOT NULL,
                game_id TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT,
                avatar TEXT,
                status TEXT DEFAULT "connected",
                score INTEGER DEFAULT 0,
                current_answers TEXT,
                round_history TEXT DEFAULT "{}",
                PRIMARY KEY (id, game_id),
                FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
            )',

            'CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )',

            'CREATE TABLE IF NOT EXISTS prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL UNIQUE
            )',

            'CREATE TABLE IF NOT EXISTS prompt_categories (
                prompt_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                PRIMARY KEY (prompt_id, category_id),
                FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            )',

            'CREATE TABLE IF NOT EXISTS valid_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id INTEGER NOT NULL,
                word_entry TEXT NOT NULL,
                FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
            )'
        ];

        foreach ($tables as $sql) {
            $pdo->exec($sql);
        }

        $indexes = [
            'CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id)',
            'CREATE INDEX IF NOT EXISTS idx_prompt_categories_prompt ON prompt_categories(prompt_id)',
            'CREATE INDEX IF NOT EXISTS idx_prompt_categories_category ON prompt_categories(category_id)',
            'CREATE INDEX IF NOT EXISTS idx_valid_words_prompt_id ON valid_words(prompt_id)'
        ];

        foreach ($indexes as $sql) {
            $pdo->exec($sql);
        }

        $pdo = null;

        logMessage('Fresh database initialized: ' . $dbPath, 'INFO');

        return [
            'action' => 'initialize',
            'status' => 'success',
            'database_path' => $dbPath,
            'tables_created' => count($tables),
            'indexes_created' => count($indexes),
            'timestamp' => date('Y-m-d H:i:s')
        ];

    } catch (PDOException $e) {
        throw new Exception('Failed to initialize database: ' . $e->getMessage());
    }
}

function respondSuccess($data) {
    echo json_encode([
        'success' => true,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}

function respondError($message) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $message,
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
?>
