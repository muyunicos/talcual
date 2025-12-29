<?php
// Configuración para mostrar errores en pantalla durante las pruebas
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Definir dónde está el diccionario antes de cargar el motor
define('DICTIONARY_FILE', __DIR__ . '/diccionario.json');

// Cargar el motor mejorado
require_once __DIR__ . '/word-comparison-engine.php';

// Asegurar que el motor se inicialice
$engine = WordEquivalenceEngine::getInstance();

$resultHtml = '';
$word1 = '';
$word2 = '';

// Procesar el formulario al enviarlo
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $word1 = $_POST['word1'] ?? '';
    $word2 = $_POST['word2'] ?? '';

    if (trim($word1) !== '' && trim($word2) !== '') {
        // --- AQUÍ OCURRE LA MAGIA ---
        // Usamos la función helper global del motor
        $isMatch = compareWords($word1, $word2);
        // -----------------------------

        // Obtenemos las formas internas para depurar
        $canonical1 = getCanonicalWord($word1);
        $canonical2 = getCanonicalWord($word2);

        // Definir estilos según el resultado
        $statusClass = $isMatch ? 'bg-green-100 border-green-500 text-green-800' : 'bg-red-100 border-red-500 text-red-800';
        $icon = $isMatch ? '✅ MATCH EXACTO O SINÓNIMO' : '❌ NO COINCIDEN';
        
        $resultHtml = "
            <div class='mt-6 p-6 border-l-8 rounded-r-lg shadow-md $statusClass'>
                <h2 class='text-3xl font-bold flex items-center'>$icon</h2>
                <div class='mt-4 grid grid-cols-2 gap-4'>
                    <div class='bg-white/50 p-3 rounded'>
                        <span class='text-sm uppercase font-semibold opacity-70'>Palabra 1 ingresada:</span>
                        <p class='text-xl font-mono'>" . htmlspecialchars($word1) . "</p>
                        <div class='mt-1 text-xs text-gray-600'>Canonical interna: <code class='bg-gray-200 px-1 rounded'>$canonical1</code></div>
                    </div>
                    <div class='bg-white/50 p-3 rounded'>
                        <span class='text-sm uppercase font-semibold opacity-70'>Palabra 2 ingresada:</span>
                        <p class='text-xl font-mono'>" . htmlspecialchars($word2) . "</p>
                        <div class='mt-1 text-xs text-gray-600'>Canonical interna: <code class='bg-gray-200 px-1 rounded'>$canonical2</code></div>
                    </div>
                </div>
            </div>
        ";
    }
}

// Obtener datos del diccionario para mostrar en pantalla
$dictData = $engine->getDictionary();
$jsonPreview = json_encode($dictData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test de Motor de Equivalencias V2</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #f0f2f5; }
    </style>
</head>
<body class="p-6 md:p-12">

    <div class="max-w-4xl mx-auto">
        
        <h1 class="text-4xl font-extrabold text-gray-800 mb-2">⚡ Probador de Equivalencia Semántica</h1>
        <p class="text-gray-600 mb-8">Prueba si dos palabras son consideradas iguales por el motor (incluyendo sinónimos, plurales, femeninos y tildes).</p>


        <?= $resultHtml ?>


        <div class="bg-white rounded-xl shadow-lg p-8 mt-8">
            <form method="POST" action="" class="flex flex-col md:flex-row gap-4 items-end">
                <div class="flex-1 w-full">
                    <label class="block text-sm font-bold text-gray-700 mb-2" for="word1">Palabra A</label>
                    <input type="text" id="word1" name="word1" value="<?= htmlspecialchars($word1) ?>" required
                           class="shadow-sm appearance-none border rounded-lg w-full py-4 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-xl" placeholder="Ej: Camión">
                </div>
                
                <div class="hidden md:block text-4xl text-gray-400 pb-2">↔️</div>

                <div class="flex-1 w-full">
                    <label class="block text-sm font-bold text-gray-700 mb-2" for="word2">Palabra B</label>
                    <input type="text" id="word2" name="word2" value="<?= htmlspecialchars($word2) ?>" required
                           class="shadow-sm appearance-none border rounded-lg w-full py-4 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-xl" placeholder="Ej: Camiones">
                </div>

                <button type="submit" class="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg focus:outline-none focus:shadow-outline transition-all text-xl shadow-blue-500/50 shadow-lg">
                    COMPARAR
                </button>
            </form>
        </div>

        <div class="mt-12">
            <h3 class="text-xl font-bold text-gray-700 mb-4">📚 Diccionario Cargado (diccionario.json)</h3>
            <div class="bg-gray-800 rounded-xl shadow-inner p-6 overflow-auto max-h-96 border-4 border-gray-700">
                <pre class="text-green-400 font-mono text-sm"><?= $jsonPreview; ?></pre>
            </div>
            <p class="text-sm text-gray-500 mt-2">Nota: Si editas el archivo JSON, borra el archivo .cache si no ves los cambios.</p>
        </div>

    </div>
</body>
</html>