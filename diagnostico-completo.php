<?php
// diagnostico-completo.php - Diagnóstico exhaustivo del sistema

header('Content-Type: text/plain; charset=utf-8');

echo "🔍 DIAGNÓSTICO COMPLETO - Unánimo Party\n";
echo "==========================================\n\n";

// 1. VERIFICAR PHP
echo "1. CONFIGURACIÓN PHP\n";
echo "   PHP Version: " . PHP_VERSION . "\n";
echo "   SAPI: " . php_sapi_name() . "\n";
echo "   output_buffering: " . ini_get('output_buffering') . "\n";
echo "   zlib.output_compression: " . ini_get('zlib.output_compression') . "\n";
echo "   max_execution_time: " . ini_get('max_execution_time') . "\n";
echo "\n";

// 2. VERIFICAR ARCHIVOS
echo "2. ARCHIVOS REQUERIDOS\n";
$archivosRequeridos = [
    'config.php',
    'api-action.php',
    'sse-stream.php',
    'game-client.js',
    'host.html',
    'player.html',
    'diccionario.json'
];

foreach ($archivosRequeridos as $archivo) {
    if (file_exists($archivo)) {
        $size = filesize($archivo);
        echo "   ✓ {$archivo} ({$size} bytes)\n";
    } else {
        echo "   ✗ {$archivo} - NO EXISTE\n";
    }
}
echo "\n";

// 3. VERIFICAR DIRECTORIO game_states
echo "3. DIRECTORIO game_states\n";
$gameStatesDir = __DIR__ . '/game_states';

if (is_dir($gameStatesDir)) {
    echo "   ✓ Existe\n";
    echo "   ✓ Escribible: " . (is_writable($gameStatesDir) ? 'SI' : 'NO') . "\n";

    $files = glob($gameStatesDir . '/*.json');
    echo "   Juegos activos: " . count($files) . "\n";

    if (count($files) > 0) {
        echo "\n   Juegos encontrados:\n";
        foreach ($files as $file) {
            $gameId = basename($file, '.json');
            $content = file_get_contents($file);
            $state = json_decode($content, true);
            $playerCount = count($state['players'] ?? []);
            $modified = filemtime($file);
            $age = time() - $modified;

            echo "   - {$gameId}: {$playerCount} jugadores (modificado hace {$age}s)\n";
        }
    }
} else {
    echo "   ✗ NO EXISTE\n";
}
echo "\n";

// 4. VERIFICAR SINTAXIS DE ARCHIVOS PHP
echo "4. SINTAXIS PHP\n";
$archivosPhp = ['config.php', 'api-action.php', 'sse-stream.php'];

foreach ($archivosPhp as $archivo) {
    if (file_exists($archivo)) {
        $output = [];
        $return = 0;
        exec("php -l {$archivo} 2>&1", $output, $return);

        if ($return === 0) {
            echo "   ✓ {$archivo} - Sintaxis OK\n";
        } else {
            echo "   ✗ {$archivo} - ERROR:\n";
            foreach ($output as $line) {
                echo "      {$line}\n";
            }
        }
    }
}
echo "\n";

// 5. PROBAR FUNCIONES DE config.php
echo "5. FUNCIONES DE config.php\n";

if (file_exists('config.php')) {
    require_once 'config.php';

    // Verificar funciones
    $funciones = [
        'loadGameState',
        'saveGameState',
        'getAllWords',
        'getRandomWord'
    ];

    foreach ($funciones as $func) {
        echo "   " . (function_exists($func) ? "✓" : "✗") . " {$func}()\n";
    }

    // Probar loadGameState
    echo "\n   Probando loadGameState('TEST'):\n";
    $testState = loadGameState('TEST');
    if ($testState) {
        echo "   ✓ Retorna estado\n";
        echo "   Players: " . count($testState['players'] ?? []) . "\n";
    } else {
        echo "   ✗ No retorna estado\n";
    }

    // Probar getAllWords
    echo "\n   Probando getAllWords():\n";
    $words = getAllWords();
    if (is_array($words) && count($words) > 0) {
        echo "   ✓ Retorna " . count($words) . " palabras\n";
    } else {
        echo "   ✗ No retorna palabras\n";
    }
}
echo "\n";

// 6. PROBAR API
echo "6. PROBAR API (api-action.php)\n";

// Crear juego de prueba
$testPayload = json_encode([
    'action' => 'create_game'
]);

$ch = curl_init('http://localhost/api-action.php');
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $testPayload);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "   HTTP Code: {$httpCode}\n";

if ($httpCode === 200) {
    $result = json_decode($response, true);
    if ($result['success'] ?? false) {
        echo "   ✓ API funciona\n";
        echo "   Game creado: {$result['game_id']}\n";
    } else {
        echo "   ✗ API retorna error: " . ($result['message'] ?? 'desconocido') . "\n";
    }
} else {
    echo "   ✗ API no responde correctamente\n";
}
echo "\n";

// 7. PROBAR SSE
echo "7. PROBAR SSE (sse-stream.php)\n";
echo "   Para probar SSE, ejecutar en terminal:\n";
echo "   curl -N 'http://localhost/sse-stream.php?game_id=TEST'\n";
echo "\n";
echo "   Debe mostrar:\n";
echo "   event: update\n";
echo "   data: {...}\n";
echo "   \n";
echo "   : heartbeat\n";
echo "\n";

// 8. VERIFICAR PERMISOS
echo "8. PERMISOS\n";
$archivos = [
    'game_states',
    'config.php',
    'api-action.php',
    'sse-stream.php'
];

foreach ($archivos as $archivo) {
    if (file_exists($archivo)) {
        $perms = substr(sprintf('%o', fileperms($archivo)), -4);
        echo "   {$archivo}: {$perms}\n";
    }
}
echo "\n";

// 9. LOGS RECIENTES
echo "9. ÚLTIMOS ERRORES PHP\n";
$logFile = ini_get('error_log');
if ($logFile && file_exists($logFile)) {
    echo "   Log file: {$logFile}\n";
    $lines = file($logFile);
    $recent = array_slice($lines, -10);
    foreach ($recent as $line) {
        if (stripos($line, 'error') !== false || stripos($line, 'warning') !== false) {
            echo "   " . trim($line) . "\n";
        }
    }
} else {
    echo "   No se encontró archivo de log\n";
}
echo "\n";

echo "==========================================\n";
echo "FIN DEL DIAGNÓSTICO\n";
?>