<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../app/AppUtils.php';

function checkDatabaseHealth() {
    $dbPath = __DIR__ . '/../data/talcual.db';
    
    $health = [
        'timestamp' => date('Y-m-d H:i:s'),
        'database' => [
            'path' => $dbPath,
            'exists' => file_exists($dbPath),
            'size' => 0,
            'readable' => false,
            'writable' => false,
            'is_sqlite' => false,
            'integrity' => null,
            'tables' => [],
            'connection' => false,
            'status' => 'unknown'
        ],
        'checks' => [
            'file_exists' => false,
            'valid_sqlite' => false,
            'integrity_ok' => false,
            'tables_created' => false,
            'connection_works' => false
        ],
        'overall_status' => 'UNKNOWN'
    ];

    if (!$health['database']['exists']) {
        $health['overall_status'] = 'DATABASE_MISSING';
        return $health;
    }

    $health['checks']['file_exists'] = true;
    $health['database']['size'] = filesize($dbPath);
    $health['database']['readable'] = is_readable($dbPath);
    $health['database']['writable'] = is_writable($dbPath);

    if ($health['database']['readable'] && $health['database']['size'] > 0) {
        $handle = @fopen($dbPath, 'rb');
        if ($handle) {
            $header = fread($handle, 16);
            fclose($handle);
            $health['database']['is_sqlite'] = (strpos($header, 'SQLite format 3') === 0);
            $health['checks']['valid_sqlite'] = $health['database']['is_sqlite'];
        }
    }

    if (!$health['database']['is_sqlite']) {
        $health['overall_status'] = 'INVALID_SQLITE';
        return $health;
    }

    try {
        $pdo = new PDO('sqlite:' . $dbPath, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 5
        ]);

        $health['database']['connection'] = true;
        $health['checks']['connection_works'] = true;

        $integrityResult = $pdo->query('PRAGMA integrity_check')->fetch();
        $health['database']['integrity'] = $integrityResult ? $integrityResult[0] : 'unknown';
        $health['checks']['integrity_ok'] = ($health['database']['integrity'] === 'ok');

        $requiredTables = ['games', 'players', 'categories', 'prompts', 'prompt_categories', 'valid_words'];
        $tables = $pdo->query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )->fetchAll(PDO::FETCH_COLUMN);

        $health['database']['tables'] = $tables;
        $tablesCreated = true;
        
        foreach ($requiredTables as $table) {
            if (!in_array($table, $tables)) {
                $tablesCreated = false;
                break;
            }
        }

        $health['checks']['tables_created'] = $tablesCreated;

        $pdo = null;

    } catch (Exception $e) {
        $health['database']['connection'] = false;
        $health['overall_status'] = 'CONNECTION_ERROR';
        return $health;
    }

    if ($health['checks']['connection_works'] && 
        $health['checks']['valid_sqlite'] && 
        $health['checks']['integrity_ok'] && 
        $health['checks']['tables_created']) {
        $health['overall_status'] = 'HEALTHY';
    } elseif ($health['checks']['tables_created']) {
        $health['overall_status'] = 'DEGRADED';
    } else {
        $health['overall_status'] = 'CORRUPTED';
    }

    return $health;
}

function getStatusColor($status) {
    return [
        'HEALTHY' => '#4caf50',
        'DEGRADED' => '#ff9800',
        'CORRUPTED' => '#f44336',
        'INVALID_SQLITE' => '#f44336',
        'DATABASE_MISSING' => '#f44336',
        'CONNECTION_ERROR' => '#f44336',
        'UNKNOWN' => '#999'
    ][$status] ?? '#999';
}

$action = $_GET['action'] ?? 'json';

if ($action === 'json') {
    $health = checkDatabaseHealth();
    echo json_encode($health, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
elseif ($action === 'html') {
    $health = checkDatabaseHealth();
    $statusColor = getStatusColor($health['overall_status']);
    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TalCual Database Health Check</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                max-width: 800px;
                margin: 40px auto;
                padding: 20px;
                background: #f5f5f5;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            h1 {
                margin: 0;
                color: #333;
            }
            .status-badge {
                display: inline-block;
                padding: 8px 16px;
                border-radius: 20px;
                color: white;
                font-weight: 600;
                margin-top: 10px;
                background-color: <?php echo $statusColor; ?>;
            }
            .section {
                background: white;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .section h2 {
                margin-top: 0;
                color: #333;
                border-bottom: 2px solid #eee;
                padding-bottom: 10px;
            }
            .check-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #eee;
            }
            .check-item:last-child {
                border-bottom: none;
            }
            .check-label {
                color: #666;
            }
            .check-value {
                font-weight: 600;
                color: #333;
            }
            .check-pass {
                color: #4caf50;
            }
            .check-fail {
                color: #f44336;
            }
            .check-warn {
                color: #ff9800;
            }
            .timestamp {
                text-align: center;
                color: #999;
                font-size: 12px;
                margin-top: 20px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
            }
            td {
                padding: 8px;
                border-bottom: 1px solid #eee;
            }
            td:first-child {
                color: #666;
                width: 40%;
            }
            .code {
                font-family: 'Courier New', monospace;
                background: #f9f9f9;
                padding: 2px 6px;
                border-radius: 3px;
                color: #d63384;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🔍 Database Health Check</h1>
            <div class="status-badge"><?php echo $health['overall_status']; ?></div>
        </div>

        <div class="section">
            <h2>Database Status</h2>
            <table>
                <tr>
                    <td>Overall Status</td>
                    <td><strong><?php echo $health['overall_status']; ?></strong></td>
                </tr>
                <tr>
                    <td>File Exists</td>
                    <td><?php echo $health['database']['exists'] ? '✓ Yes' : '✗ No'; ?></td>
                </tr>
                <tr>
                    <td>File Size</td>
                    <td><?php echo number_format($health['database']['size']) . ' bytes'; ?></td>
                </tr>
                <tr>
                    <td>Readable</td>
                    <td><?php echo $health['database']['readable'] ? '✓ Yes' : '✗ No'; ?></td>
                </tr>
                <tr>
                    <td>Writable</td>
                    <td><?php echo $health['database']['writable'] ? '✓ Yes' : '✗ No'; ?></td>
                </tr>
                <tr>
                    <td>Valid SQLite</td>
                    <td>
                        <span class="<?php echo $health['database']['is_sqlite'] ? 'check-pass' : 'check-fail'; ?>">
                            <?php echo $health['database']['is_sqlite'] ? '✓ Yes' : '✗ No'; ?>
                        </span>
                    </td>
                </tr>
                <tr>
                    <td>Integrity Check</td>
                    <td>
                        <span class="<?php echo ($health['database']['integrity'] === 'ok') ? 'check-pass' : 'check-fail'; ?>">
                            <?php echo htmlspecialchars($health['database']['integrity'] ?? 'unknown'); ?>
                        </span>
                    </td>
                </tr>
            </table>
        </div>

        <div class="section">
            <h2>Health Checks</h2>
            <?php foreach ($health['checks'] as $check => $result): ?>
                <div class="check-item">
                    <span class="check-label"><?php echo str_replace('_', ' ', ucfirst($check)); ?></span>
                    <span class="check-value <?php echo $result ? 'check-pass' : 'check-fail'; ?>">
                        <?php echo $result ? '✓ PASS' : '✗ FAIL'; ?>
                    </span>
                </div>
            <?php endforeach; ?>
        </div>

        <div class="section">
            <h2>Database Tables</h2>
            <?php if (!empty($health['database']['tables'])): ?>
                <ul style="margin: 0; padding-left: 20px;">
                    <?php foreach ($health['database']['tables'] as $table): ?>
                        <li><?php echo htmlspecialchars($table); ?></li>
                    <?php endforeach; ?>
                </ul>
            <?php else: ?>
                <p style="color: #999; margin: 0;">No tables found</p>
            <?php endif; ?>
        </div>

        <?php if ($health['overall_status'] !== 'HEALTHY'): ?>
            <div class="section" style="background: #fff3cd; border-left: 4px solid #ff9800;">
                <h2 style="color: #ff9800; margin-top: 0;">⚠️ Action Required</h2>
                <p>Your database is not in a healthy state. Please run the repair tool:</p>
                <p><a href="repair.html" style="color: #ff9800; font-weight: 600;">🔧 Go to Database Repair Tool</a></p>
            </div>
        <?php endif; ?>

        <div class="timestamp">
            Last checked: <?php echo $health['timestamp']; ?>
        </div>
    </body>
    </html>
    <?php
} else {
    http_response_code(400);
    echo json_encode([
        'error' => 'Unknown action. Use ?action=json or ?action=html'
    ], JSON_UNESCAPED_UNICODE);
}
?>
