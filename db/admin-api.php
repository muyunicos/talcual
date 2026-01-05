<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/config.php';

$dbPath = DB_PATH;

if (!file_exists($dbPath)) {
    http_response_code(404);
    echo json_encode(['error' => 'Database not found']);
    exit;
}

try {
    $pdo = new PDO('sqlite:' . $dbPath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

$action = $_GET['action'] ?? null;

switch ($action) {
    case 'get_tables':
        getTablesList();
        break;
    
    case 'get_table_data':
        getTableData($_GET['table'] ?? null);
        break;
    
    case 'get_schema':
        getTableSchema($_GET['table'] ?? null);
        break;
    
    case 'update_record':
        updateRecord();
        break;
    
    case 'delete_record':
        deleteRecord();
        break;
    
    case 'insert_record':
        insertRecord();
        break;
    
    case 'truncate_table':
        truncateTable($_GET['table'] ?? null);
        break;
    
    case 'export_json':
        exportJson($_GET['table'] ?? null);
        break;
    
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action']);
}

function getTablesList() {
    global $pdo;
    $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    $tables = $stmt->fetchAll();
    echo json_encode(['tables' => array_column($tables, 'name')]);
}

function getTableSchema($table) {
    global $pdo;
    if (!validateTableName($table)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid table name']);
        return;
    }
    
    $stmt = $pdo->query("PRAGMA table_info({$table})");
    $columns = $stmt->fetchAll();
    echo json_encode(['columns' => $columns]);
}

function getTableData($table) {
    global $pdo;
    if (!validateTableName($table)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid table name']);
        return;
    }
    
    $limit = min((int)($_GET['limit'] ?? 100), 1000);
    $offset = (int)($_GET['offset'] ?? 0);
    
    $countStmt = $pdo->query("SELECT COUNT(*) as count FROM {$table}");
    $total = $countStmt->fetch()['count'];
    
    $stmt = $pdo->query("SELECT * FROM {$table} LIMIT {$limit} OFFSET {$offset}");
    $data = $stmt->fetchAll();
    
    echo json_encode([
        'table' => $table,
        'total' => $total,
        'limit' => $limit,
        'offset' => $offset,
        'data' => $data
    ]);
}

function updateRecord() {
    global $pdo;
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['table'], $input['id'], $input['updates'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        return;
    }
    
    $table = $input['table'];
    if (!validateTableName($table)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid table name']);
        return;
    }
    
    $updates = $input['updates'];
    $idColumn = $input['id_column'] ?? 'id';
    $idValue = $input['id'];
    
    $setClauses = [];
    $params = [];
    
    foreach ($updates as $column => $value) {
        if (!validateColumnName($column)) continue;
        $setClauses[] = "{$column} = ?";
        $params[] = $value;
    }
    
    if (empty($setClauses)) {
        http_response_code(400);
        echo json_encode(['error' => 'No valid columns to update']);
        return;
    }
    
    $params[] = $idValue;
    $query = "UPDATE {$table} SET " . implode(', ', $setClauses) . " WHERE {$idColumn} = ?";
    
    try {
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        echo json_encode(['success' => true, 'affected' => $stmt->rowCount()]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function deleteRecord() {
    global $pdo;
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['table'], $input['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        return;
    }
    
    $table = $input['table'];
    if (!validateTableName($table)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid table name']);
        return;
    }
    
    $idColumn = $input['id_column'] ?? 'id';
    $idValue = $input['id'];
    
    try {
        $stmt = $pdo->prepare("DELETE FROM {$table} WHERE {$idColumn} = ?");
        $stmt->execute([$idValue]);
        echo json_encode(['success' => true, 'affected' => $stmt->rowCount()]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function insertRecord() {
    global $pdo;
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['table'], $input['data'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        return;
    }
    
    $table = $input['table'];
    if (!validateTableName($table)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid table name']);
        return;
    }
    
    $data = $input['data'];
    $columns = array_keys($data);
    $values = array_values($data);
    
    foreach ($columns as $col) {
        if (!validateColumnName($col)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid column name']);
            return;
        }
    }
    
    $placeholders = array_fill(0, count($columns), '?');
    $query = "INSERT INTO {$table} (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";
    
    try {
        $stmt = $pdo->prepare($query);
        $stmt->execute($values);
        echo json_encode(['success' => true, 'lastInsertId' => $pdo->lastInsertId()]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function truncateTable($table) {
    global $pdo;
    if (!validateTableName($table)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid table name']);
        return;
    }
    
    try {
        $pdo->exec("DELETE FROM {$table}");
        echo json_encode(['success' => true, 'message' => "Table {$table} truncated"]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function exportJson($table) {
    global $pdo;
    if (!validateTableName($table)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid table name']);
        return;
    }
    
    $stmt = $pdo->query("SELECT * FROM {$table}");
    $data = $stmt->fetchAll();
    
    header('Content-Type: application/json');
    header("Content-Disposition: attachment; filename=\"talcual_{$table}.json\"");
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}

function validateTableName($table) {
    $allowed = ['games', 'players', 'categories', 'prompts', 'prompt_categories', 'valid_words'];
    return in_array($table, $allowed);
}

function validateColumnName($column) {
    return preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $column) === 1;
}
?>