<?php
header('Content-Type: text/plain; charset=utf-8');

echo "=== TalCual Database Diagnostic ===\n\n";

$dbPath = __DIR__ . '/../data/talcual.db';
$dataDir = dirname($dbPath);

echo "1. Data Directory Check\n";
echo "   Path: {$dataDir}\n";
echo "   Exists: " . (is_dir($dataDir) ? "✓ YES" : "✗ NO") . "\n";
echo "   Writable: " . (is_writable($dataDir) ? "✓ YES" : "✗ NO") . "\n";
if (is_dir($dataDir)) {
    $perms = substr(sprintf('%o', fileperms($dataDir)), -4);
    echo "   Permissions: {$perms}\n";
}
echo "\n";

echo "2. Database File Check\n";
echo "   Path: {$dbPath}\n";
echo "   Exists: " . (file_exists($dbPath) ? "✓ YES" : "✗ NO") . "\n";
if (file_exists($dbPath)) {
    $size = filesize($dbPath);
    $perms = substr(sprintf('%o', fileperms($dbPath)), -4);
    echo "   Size: {$size} bytes\n";
    echo "   Permissions: {$perms}\n";
    echo "   Readable: " . (is_readable($dbPath) ? "✓ YES" : "✗ NO") . "\n";
    echo "   Writable: " . (is_writable($dbPath) ? "✓ YES" : "✗ NO") . "\n";
}
echo "\n";

echo "3. PHP Environment\n";
echo "   PHP Version: " . phpversion() . "\n";
echo "   PDO Support: " . (extension_loaded('pdo') ? "✓ YES" : "✗ NO") . "\n";
echo "   PDO SQLite: " . (extension_loaded('pdo_sqlite') ? "✓ YES" : "✗ NO") . "\n";
echo "   APCu Support: " . (extension_loaded('apcu') ? "✓ YES" : "✗ NO") . "\n";
echo "\n";

echo "4. Database Connection Test\n";
try {
    $pdo = new PDO(
        'sqlite:' . $dbPath,
        null,
        null,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 5
        ]
    );
    echo "   Connection: ✓ SUCCESS\n";
    
    $pdo->exec('PRAGMA foreign_keys = ON');
    $tables = $pdo->query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )->fetchAll();
    
    echo "   Tables Found: " . count($tables) . "\n";
    if (!empty($tables)) {
        foreach ($tables as $row) {
            $count = $pdo->query("SELECT COUNT(*) FROM {$row['name']}")->fetchColumn();
            echo "     - {$row['name']}: {$count} records\n";
        }
    }
    
    $pdo = null;
} catch (Throwable $e) {
    echo "   Connection: ✗ FAILED\n";
    echo "   Error: " . $e->getMessage() . "\n";
}

echo "\n5. Recommendations\n";
if (!is_dir($dataDir)) {
    echo "   ⚠️  Create /data directory: mkdir -p data && chmod 755 data\n";
}
if (!file_exists($dbPath)) {
    echo "   ⚠️  Database file not found. It will be auto-created on first connection.\n";
} else {
    echo "   ✓ Database file exists\n";
}

echo "\n=== End Diagnostic ===\n";
?>
