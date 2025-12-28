<?php
// Suite de pruebas básicas
// Para verificar funcionalidad del sistema

require_once __DIR__ . '/../core/config.php';

if (!DEV_MODE) {
    http_response_code(403);
    die('Tests solo disponibles en modo desarrollo');
}

header('Content-Type: text/plain; charset=utf-8');

echo "=== SUITE DE PRUEBAS TALCUAL ===\n\n";

// Test 1: Configuración
echo "[TEST] Configuración\n";
echo "DEV_MODE: " . (DEV_MODE ? 'SI' : 'NO') . "\n";
echo "MIN_PLAYERS: " . MIN_PLAYERS . "\n";
echo "MAX_PLAYERS: " . MAX_PLAYERS . "\n";
echo "Directorio estados: " . GAME_STATES_DIR . "\n";
echo "Diccionario: " . DICTIONARY_FILE . "\n\n";

// Test 2: Diccionario
echo "[TEST] Diccionario\n";
$stats = getDictionaryStats();
echo "Categorías: " . $stats['categorias'] . "\n";
echo "Total palabras: " . $stats['total_palabras'] . "\n";
echo "Palabras para código: " . $stats['palabras_codigo'] . "\n\n";

// Test 3: Generación de códigos
echo "[TEST] Generación de códigos\n";
for ($i = 0; $i < 5; $i++) {
    $code = generateGameCode();
    echo "Código #{$i}: {$code}\n";
}
echo "\n";

// Test 4: Validaciones
echo "[TEST] Validaciones\n";
$testIds = ['CASA', 'AB', 'ABCDEFGH', 'TEST123', 'test@!'];
foreach ($testIds as $id) {
    $clean = sanitizeGameId($id);
    echo "sanitizeGameId('{$id}') = " . ($clean ?? 'NULL') . "\n";
}
echo "\n";

// Test 5: Creación y carga de estado
echo "[TEST] Estado de juego\n";
$testGameId = 'TEST';
$testState = [
    'game_id' => $testGameId,
    'players' => [],
    'round' => 0,
    'status' => 'waiting'
];

if (saveGameState($testGameId, $testState)) {
    echo "✓ Estado guardado\n";
    $loaded = loadGameState($testGameId);
    if ($loaded && $loaded['game_id'] === $testGameId) {
        echo "✓ Estado cargado correctamente\n";
        @unlink(GAME_STATES_DIR . '/' . $testGameId . '.json');
        echo "✓ Estado eliminado\n";
    } else {
        echo "✗ Error al cargar estado\n";
    }
} else {
    echo "✗ Error al guardar estado\n";
}

echo "\n=== PRUEBAS COMPLETADAS ===\n";
?>