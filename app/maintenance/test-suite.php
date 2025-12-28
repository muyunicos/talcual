<?php
// Suite de pruebas básicas para TalCual Party
// Solo disponible en modo desarrollo

require_once __DIR__ . '/../core/config.php';

if (!DEV_MODE) {
    http_response_code(403);
    die('Test suite solo disponible en modo desarrollo');
}

header('Content-Type: text/plain');

echo "=== TalCual Party Test Suite ===\n\n";

// Test 1: Cargar diccionario
echo "[TEST] Cargar diccionario...\n";
$dict = loadDictionary();
echo "  \u2713 Diccionario cargado: " . count($dict['categorias'] ?? []) . " categorías\n\n";

// Test 2: Obtener palabras
echo "[TEST] Obtener todas las palabras...\n";
$words = getAllWords();
echo "  \u2713 Total palabras: " . count($words) . "\n\n";

// Test 3: Generar código de sala
echo "[TEST] Generar código de sala...\n";
$code = generateGameCode();
echo "  \u2713 Código generado: {$code}\n\n";

// Test 4: Sanitizar game ID
echo "[TEST] Sanitizar game IDs...\n";
$tests = ['ABC', 'abc', 'ABC123', 'AB', 'ABCDEFG', 'ABC-123'];
foreach ($tests as $test) {
    $result = sanitizeGameId($test);
    $status = $result ? '\u2713' : '\u2717';
    echo "  {$status} '{$test}' -> " . ($result ?? 'null') . "\n";
}
echo "\n";

// Test 5: Validar palabras
echo "[TEST] Validar palabras de jugador...\n";
$testWords = ['CASA', 'PERRO', 'A', str_repeat('X', 100), 'HOL A', ''];
foreach ($testWords as $word) {
    $validation = validatePlayerWord($word);
    $status = $validation['valid'] ? '\u2713' : '\u2717';
    $error = $validation['valid'] ? '' : " ({$validation['error']})";
    echo "  {$status} '{$word}'{$error}\n";
}
echo "\n";

// Test 6: Crear y cargar estado de juego
echo "[TEST] Crear y cargar estado de juego...\n";
$testGameId = 'TEST' . rand(100, 999);
$testState = [
    'game_id' => $testGameId,
    'players' => [],
    'status' => 'waiting'
];

if (saveGameState($testGameId, $testState)) {
    echo "  \u2713 Estado guardado: {$testGameId}\n";
    
    $loaded = loadGameState($testGameId);
    if ($loaded && $loaded['game_id'] === $testGameId) {
        echo "  \u2713 Estado cargado correctamente\n";
        
        // Limpiar
        @unlink(GAME_STATES_DIR . '/' . $testGameId . '.json');
        echo "  \u2713 Estado de prueba eliminado\n";
    } else {
        echo "  \u2717 Error cargando estado\n";
    }
} else {
    echo "  \u2717 Error guardando estado\n";
}
echo "\n";

// Test 7: Estadísticas del diccionario
echo "[TEST] Estadísticas del diccionario...\n";
$stats = getDictionaryStats();
echo "  \u2713 Categorías: {$stats['categorias']}\n";
echo "  \u2713 Total palabras: {$stats['total_palabras']}\n";
echo "  \u2713 Palabras válidas para código: {$stats['palabras_codigo']}\n\n";

echo "=== Todos los tests completados ===\n";
?>