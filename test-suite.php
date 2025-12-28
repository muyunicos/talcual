<?php
// Test Suite - Unánimo Party
// MEJORA #4: Tests activables en modo desarrollo
// Solo accesible si DEV_MODE = true

require_once 'config.php';

if (!DEV_MODE) {
    http_response_code(403);
    die('Tests solo disponibles en modo desarrollo');
}

header('Content-Type: text/html; charset=utf-8');

$tests = [];
$passed = 0;
$failed = 0;

// Test helper
function test($name, $condition, $message = '') {
    global $tests, $passed, $failed;
    
    $result = $condition ? 'PASS' : 'FAIL';
    if ($condition) {
        $passed++;
    } else {
        $failed++;
    }
    
    $tests[] = [
        'name' => $name,
        'result' => $result,
        'message' => $message
    ];
}

// ===== TESTS =====

// Test 1: Sanitización de game ID
test(
    'Sanitizar game ID válido',
    sanitizeGameId('ABC123') === 'ABC123',
    'Debe aceptar códigos alfanuméricos válidos'
);

test(
    'Rechazar game ID con caracteres especiales',
    sanitizeGameId('ABC-123!') === 'ABC123',
    'Debe eliminar caracteres especiales'
);

test(
    'Rechazar game ID muy corto',
    sanitizeGameId('AB') === null,
    'Debe rechazar códigos menores a 3 caracteres'
);

// Test 2: Validación de palabras
test(
    'Validar palabra normal',
    validatePlayerWord('CASA')['valid'] === true,
    'Debe aceptar palabras normales'
);

test(
    'Rechazar palabra con espacios',
    validatePlayerWord('CASA BLANCA')['valid'] === false,
    'No debe permitir espacios en palabras'
);

test(
    'Rechazar palabra muy larga',
    validatePlayerWord(str_repeat('A', MAX_WORD_LENGTH + 1))['valid'] === false,
    'Debe rechazar palabras que excedan MAX_WORD_LENGTH'
);

test(
    'Rechazar palabra actual',
    validatePlayerWord('PERRO', 'PERRO')['valid'] === false,
    'No debe permitir usar la palabra actual'
);

// Test 3: Diccionario
$words = getAllWords();
test(
    'Diccionario tiene palabras',
    count($words) > 0,
    'El diccionario debe contener al menos 1 palabra'
);

$stats = getDictionaryStats();
test(
    'Palabras cortas para códigos',
    $stats['palabras_codigo'] > 0,
    'Debe haber palabras de ' . MAX_CODE_LENGTH . ' letras o menos para códigos'
);

// Test 4: Generación de códigos
$code = generateGameCode();
test(
    'Generar código válido',
    !empty($code) && strlen($code) >= 3 && strlen($code) <= 6,
    'Código generado: ' . $code
);

// Test 5: Crear y cargar juego
$testGameId = generateGameCode();
$testState = [
    'game_id' => $testGameId,
    'players' => [],
    'round' => 0,
    'status' => 'waiting'
];

test(
    'Guardar estado de juego',
    saveGameState($testGameId, $testState),
    'Debe poder guardar estado'
);

$loadedState = loadGameState($testGameId);
test(
    'Cargar estado de juego',
    $loadedState !== null && $loadedState['game_id'] === $testGameId,
    'Debe poder cargar el estado guardado'
);

test(
    'Estado tiene versión',
    isset($loadedState['_version']),
    'El estado cargado debe tener campo _version'
);

// Limpiar test
@unlink(GAME_STATES_DIR . '/' . $testGameId . '.json');

// Test 6: Validación de colores
test(
    'Validar color válido',
    validatePlayerColor('#FF0000,#00FF00') !== null,
    'Debe aceptar colores en formato válido'
);

test(
    'Rechazar color inválido',
    validatePlayerColor('rojo,azul') === null,
    'Debe rechazar colores en formato inválido'
);

// Test 7: Limpieza de juegos antiguos
test(
    'Función de limpieza existe',
    function_exists('cleanupOldGames'),
    'Debe existir la función cleanupOldGames'
);

?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Suite - Unánimo Party</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            max-width: 900px;
            margin: 50px auto;
            padding: 20px;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        h1 {
            color: #4ec9b0;
            border-bottom: 2px solid #4ec9b0;
            padding-bottom: 10px;
        }
        .summary {
            background: #252526;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #4ec9b0;
        }
        .test {
            background: #252526;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 4px solid #ccc;
        }
        .test.pass {
            border-left-color: #4ec9b0;
        }
        .test.fail {
            border-left-color: #f48771;
        }
        .result {
            font-weight: bold;
            display: inline-block;
            padding: 3px 10px;
            border-radius: 3px;
            margin-right: 10px;
        }
        .pass .result {
            background: #4ec9b0;
            color: #1e1e1e;
        }
        .fail .result {
            background: #f48771;
            color: #1e1e1e;
        }
        .message {
            color: #888;
            font-size: 0.9em;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <h1>🧪 Test Suite - Unánimo Party</h1>
    
    <div class="summary">
        <h2>Resumen</h2>
        <p><strong>Total:</strong> <?= count($tests) ?> tests</p>
        <p><strong style="color: #4ec9b0;">✅ Pasados:</strong> <?= $passed ?></p>
        <p><strong style="color: #f48771;">❌ Fallidos:</strong> <?= $failed ?></p>
    </div>
    
    <h2>Resultados</h2>
    <?php foreach ($tests as $test): ?>
        <div class="test <?= strtolower($test['result']) ?>">
            <span class="result"><?= $test['result'] ?></span>
            <strong><?= htmlspecialchars($test['name']) ?></strong>
            <?php if ($test['message']): ?>
                <div class="message"><?= htmlspecialchars($test['message']) ?></div>
            <?php endif; ?>
        </div>
    <?php endforeach; ?>
</body>
</html>