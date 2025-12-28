<?php
// verificar-sintaxis.php - Verificador de sintaxis de archivos PHP

echo "🔍 VERIFICADOR DE SINTAXIS PHP\n";
echo "================================\n\n";

$archivos = [
    'sse-stream.php',
    'api-action.php',
    'config.php'
];

$todosOk = true;

foreach ($archivos as $archivo) {
    echo "Verificando: {$archivo}\n";

    if (!file_exists($archivo)) {
        echo "   ❌ Archivo no existe\n\n";
        $todosOk = false;
        continue;
    }

    // Verificar sintaxis
    $output = [];
    $returnCode = 0;
    exec("php -l {$archivo} 2>&1", $output, $returnCode);

    if ($returnCode === 0) {
        echo "   ✅ Sintaxis correcta\n";
    } else {
        echo "   ❌ Error de sintaxis:\n";
        foreach ($output as $line) {
            echo "      {$line}\n";
        }
        $todosOk = false;
    }

    echo "\n";
}

echo "================================\n";

if ($todosOk) {
    echo "✅ TODOS LOS ARCHIVOS OK\n";
} else {
    echo "❌ HAY ERRORES QUE CORREGIR\n";
}

echo "\nPrueba manual de SSE:\n";
echo "curl -N 'http://localhost/sse-stream.php?game_id=TEST'\n";
?>