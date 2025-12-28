<?php
// Unánimo Party - Diagnóstico SSE
// Ejecuta este archivo para verificar la configuración del servidor

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Diagnóstico SSE - Unánimo Party</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            padding: 20px;
            background: #1a1a1a;
            color: #00ff00;
        }
        .success { color: #00ff00; }
        .error { color: #ff0000; }
        .warning { color: #ffaa00; }
        .info { color: #00aaff; }
        pre {
            background: #000;
            padding: 15px;
            border: 1px solid #333;
            border-radius: 5px;
            overflow-x: auto;
        }
        h2 {
            border-bottom: 2px solid #00ff00;
            padding-bottom: 10px;
        }
        button {
            background: #00ff00;
            color: #000;
            border: none;
            padding: 10px 20px;
            font-weight: bold;
            cursor: pointer;
            margin: 10px 0;
        }
        #sse-test {
            background: #000;
            padding: 15px;
            border: 1px solid #00ff00;
            min-height: 200px;
            max-height: 400px;
            overflow-y: auto;
        }
    </style>
</head>
<body>
    <h1>🔍 Diagnóstico SSE - Unánimo Party</h1>

    <h2>1. Configuración PHP</h2>
    <pre>
<?php
echo "PHP Version:           " . PHP_VERSION . "\n";
echo "output_buffering:      " . (ini_get('output_buffering') ? 'ON (⚠️ DEBERÍA ESTAR OFF)' : 'OFF (✓)') . "\n";
echo "zlib.output_compress:  " . (ini_get('zlib.output_compression') ? 'ON (⚠️ DEBERÍA ESTAR OFF)' : 'OFF (✓)') . "\n";
echo "max_execution_time:    " . ini_get('max_execution_time') . "s\n";
echo "memory_limit:          " . ini_get('memory_limit') . "\n";
echo "error_reporting:       " . error_reporting() . "\n";
?>
    </pre>

    <h2>2. Sistema de Archivos</h2>
    <pre>
<?php
$gameStatesDir = __DIR__ . '/game_states';

echo "Directorio: {$gameStatesDir}\n";
echo "Existe:     " . (is_dir($gameStatesDir) ? '✓ SI' : '❌ NO (CREAR!)') . "\n";

if (is_dir($gameStatesDir)) {
    echo "Escribible: " . (is_writable($gameStatesDir) ? '✓ SI' : '❌ NO (CAMBIAR PERMISOS!)') . "\n";
    echo "Permisos:   " . substr(sprintf('%o', fileperms($gameStatesDir)), -4) . "\n";

    $files = glob($gameStatesDir . '/*.json');
    echo "Archivos:   " . count($files) . " juegos activos\n";

    if (count($files) > 0) {
        echo "\nJuegos existentes:\n";
        foreach (array_slice($files, 0, 5) as $file) {
            $gameId = pathinfo($file, PATHINFO_FILENAME);
            $age = time() - filemtime($file);
            $ageStr = $age < 60 ? "{$age}s" : ($age < 3600 ? floor($age/60)."m" : floor($age/3600)."h");
            echo "  - {$gameId} (hace {$ageStr})\n";
        }
    }
} else {
    echo "\n❌ PROBLEMA: Directorio no existe. Créalo con:\n";
    echo "   mkdir game_states\n";
    echo "   chmod 755 game_states\n";
}
?>
    </pre>

    <h2>3. Archivos Requeridos</h2>
    <pre>
<?php
$files = [
    'sse-stream.php' => 'Stream SSE',
    'api-action.php' => 'API Backend',
    'config.php' => 'Configuración',
    'game-client.js' => 'Cliente JavaScript',
    'host.html' => 'Interfaz Host',
    'player.html' => 'Interfaz Player',
    'diccionario.json' => 'Diccionario de palabras'
];

foreach ($files as $file => $desc) {
    $exists = file_exists(__DIR__ . '/' . $file);
    $status = $exists ? '✓' : '❌';
    $size = $exists ? filesize(__DIR__ . '/' . $file) : 0;
    $sizeStr = $size > 0 ? ' (' . number_format($size) . ' bytes)' : '';
    echo sprintf("%-20s %s %s%s\n", $file, $status, $desc, $sizeStr);
}
?>
    </pre>

    <h2>4. Configuración Servidor</h2>
    <pre>
<?php
echo "Servidor:       " . $_SERVER['SERVER_SOFTWARE'] . "\n";
echo "PHP SAPI:       " . php_sapi_name() . "\n";
echo "Document Root:  " . $_SERVER['DOCUMENT_ROOT'] . "\n";
echo "Script Path:    " . __DIR__ . "\n";

// Verificar módulos Apache
if (function_exists('apache_get_modules')) {
    $modules = apache_get_modules();
    echo "\nMódulos Apache cargados:\n";
    $important = ['mod_headers', 'mod_rewrite', 'mod_mime'];
    foreach ($important as $mod) {
        $loaded = in_array($mod, $modules);
        echo "  {$mod}: " . ($loaded ? '✓' : '❌') . "\n";
    }
}
?>
    </pre>

    <h2>5. Prueba de Conexión SSE</h2>
    <button onclick="testSSE()">🔌 Iniciar Prueba SSE</button>
    <button onclick="clearTest()">🗑️ Limpiar</button>

    <div id="sse-test">
        <div class="info">Haz clic en "Iniciar Prueba SSE" para verificar la conexión...</div>
    </div>

    <h2>6. Recomendaciones</h2>
    <pre>
<?php
$issues = [];

if (ini_get('output_buffering')) {
    $issues[] = "⚠️ output_buffering está activado. Agregar a php.ini: output_buffering = Off";
}

if (ini_get('zlib.output_compression')) {
    $issues[] = "⚠️ zlib.output_compression está activado. Agregar a php.ini: zlib.output_compression = Off";
}

if (!is_dir($gameStatesDir)) {
    $issues[] = "❌ Crear directorio: mkdir game_states && chmod 755 game_states";
}

if (is_dir($gameStatesDir) && !is_writable($gameStatesDir)) {
    $issues[] = "❌ Dar permisos de escritura: chmod 755 game_states";
}

if (empty($issues)) {
    echo "✅ Todo parece estar configurado correctamente!\n";
    echo "\nPróximos pasos:\n";
    echo "1. Hacer la prueba SSE arriba\n";
    echo "2. Si la prueba funciona, abrir host.html\n";
    echo "3. Crear una partida y probar\n";
} else {
    echo "Problemas detectados:\n\n";
    foreach ($issues as $issue) {
        echo $issue . "\n";
    }
    echo "\nResuelve estos problemas antes de usar el juego.\n";
}
?>
    </pre>

    <script>
        let eventSource = null;
        let messageCount = 0;

        function testSSE() {
            const testDiv = document.getElementById('sse-test');
            testDiv.innerHTML = '<div class="info">Conectando a SSE...</div>';
            messageCount = 0;

            // Crear juego de prueba
            fetch('api-action.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'create_game',
                    player_id: 'test_diag',
                    name: 'Diagnóstico'
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.game_id) {
                    const gameId = data.game_id;
                    testDiv.innerHTML += `<div class="success">✓ Juego creado: ${gameId}</div>`;
                    testDiv.innerHTML += `<div class="info">Conectando SSE...</div>`;

                    // Conectar SSE
                    eventSource = new EventSource('sse-stream.php?game_id=' + gameId);

                    eventSource.addEventListener('open', () => {
                        testDiv.innerHTML += '<div class="success">✓ Conexión SSE establecida</div>';
                    });

                    eventSource.addEventListener('update', (e) => {
                        messageCount++;
                        const data = JSON.parse(e.data);
                        testDiv.innerHTML += `<div class="success">✓ Mensaje ${messageCount}: ${JSON.stringify(data).substring(0, 100)}...</div>`;
                    });

                    eventSource.addEventListener('error', (e) => {
                        if (eventSource.readyState === EventSource.CLOSED) {
                            testDiv.innerHTML += '<div class="error">❌ Conexión cerrada por el servidor</div>';
                            testDiv.innerHTML += '<div class="warning">⚠️ PROBLEMA: El servidor está cerrando la conexión SSE prematuramente</div>';
                            testDiv.innerHTML += '<div class="info">Revisa los logs del servidor y la configuración PHP</div>';
                        } else {
                            testDiv.innerHTML += '<div class="error">❌ Error en SSE: ' + e.type + '</div>';
                        }
                    });

                    // Detener después de 10 segundos
                    setTimeout(() => {
                        if (eventSource) {
                            eventSource.close();
                            if (messageCount >= 1) {
                                testDiv.innerHTML += '<div class="success">\n✅ PRUEBA EXITOSA! SSE está funcionando correctamente</div>';
                                testDiv.innerHTML += `<div class="info">Se recibieron ${messageCount} mensajes en 10 segundos</div>`;
                            } else {
                                testDiv.innerHTML += '<div class="warning">\n⚠️ No se recibieron mensajes. Verifica la configuración</div>';
                            }
                        }
                    }, 10000);

                } else {
                    testDiv.innerHTML += `<div class="error">❌ Error creando juego: ${data.message || 'desconocido'}</div>`;
                }
            })
            .catch(error => {
                testDiv.innerHTML += `<div class="error">❌ Error: ${error.message}</div>`;
            });
        }

        function clearTest() {
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
            document.getElementById('sse-test').innerHTML = '<div class="info">Limpiado. Listo para nueva prueba.</div>';
        }
    </script>
</body>
</html>