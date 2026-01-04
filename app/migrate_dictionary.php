<?php

require_once __DIR__ . '/Database.php';

echo "\n" . str_repeat("=", 70) . "\n";
echo "🔄 TalCual Dictionary Migration (JSON → SQLite)\n";
echo str_repeat("=", 70) . "\n\n";

$dictFile = __DIR__ . '/diccionario.json';

if (!file_exists($dictFile)) {
    echo "❌ ERROR: {$dictFile} no encontrado.\n\n";
    exit(1);
}

echo "📂 Leyendo diccionario desde: {$dictFile}\n\n";

$rawJson = file_get_contents($dictFile);
$dictionary = json_decode($rawJson, true);

if (!is_array($dictionary) || empty($dictionary)) {
    echo "❌ ERROR: Diccionario vacío o JSON inválido.\n\n";
    exit(1);
}

echo "✅ Diccionario cargado en memoria.\n";
echo "   Total de categorías: " . count($dictionary) . "\n\n";

try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    echo "🔐 Iniciando transacción...\n\n";
    $db->beginTransaction();

    $stats = [
        'categories_inserted' => 0,
        'categories_skipped' => 0,
        'prompts_inserted' => 0,
        'words_inserted' => 0,
        'words_total' => 0
    ];

    foreach ($dictionary as $categoryName => $prompts) {
        if (!is_array($prompts) || empty($prompts)) {
            echo "⚠️  Categoría vacía: {$categoryName}\n";
            continue;
        }

        $stmt = $pdo->prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
        $stmt->execute([$categoryName]);

        if ($stmt->rowCount() > 0) {
            echo "✓ Categoría insertada: {$categoryName}\n";
            $stats['categories_inserted']++;
        } else {
            echo "⊘ Categoría ya existe: {$categoryName}\n";
            $stats['categories_skipped']++;
        }

        $categoryStmt = $pdo->prepare('SELECT id FROM categories WHERE name = ?');
        $categoryStmt->execute([$categoryName]);
        $categoryRow = $categoryStmt->fetch();

        if (!$categoryRow) {
            echo "  ❌ Error: No se pudo recuperar category_id para {$categoryName}\n";
            continue;
        }

        $categoryId = $categoryRow['id'];

        foreach ($prompts as $promptObj) {
            if (!is_array($promptObj) || empty($promptObj)) {
                echo "  ⚠️  Prompt vacío en {$categoryName}\n";
                continue;
            }

            foreach ($promptObj as $promptText => $words) {
                $promptStmt = $pdo->prepare('INSERT INTO prompts (category_id, text) VALUES (?, ?)');
                $promptStmt->execute([$categoryId, $promptText]);
                $promptId = $pdo->lastInsertId();

                echo "  ✓ Consigna: {$promptText}\n";
                $stats['prompts_inserted']++;

                if (!is_array($words)) {
                    echo "    ⚠️  Palabras válidas no es array para '{$promptText}'\n";
                    continue;
                }

                $wordStmt = $pdo->prepare('INSERT INTO valid_words (prompt_id, word_entry) VALUES (?, ?)');

                foreach ($words as $wordEntry) {
                    $wordEntry = (string)$wordEntry;

                    $wordStmt->execute([$promptId, $wordEntry]);
                    $stats['words_inserted']++;
                    $stats['words_total']++;

                    echo "    - {$wordEntry}\n";
                }
            }
        }
    }

    echo "\n🔒 Confirmando transacción...\n";
    $db->commit();
    echo "✅ Transacción completada exitosamente.\n\n";

    echo str_repeat("=", 70) . "\n";
    echo "📊 RESUMEN DE MIGRACIÓN\n";
    echo str_repeat("=", 70) . "\n";
    echo "✓ Categorías insertadas:    " . $stats['categories_inserted'] . "\n";
    echo "⊘ Categorías ya existentes: " . $stats['categories_skipped'] . "\n";
    echo "✓ Consignas/Prompts:        " . $stats['prompts_inserted'] . "\n";
    echo "✓ Palabras válidas:         " . $stats['words_inserted'] . "\n";
    echo str_repeat("=", 70) . "\n\n";

    $categoryCount = $pdo->query('SELECT COUNT(*) as count FROM categories')->fetch()['count'];
    $promptCount = $pdo->query('SELECT COUNT(*) as count FROM prompts')->fetch()['count'];
    $wordCount = $pdo->query('SELECT COUNT(*) as count FROM valid_words')->fetch()['count'];

    echo "📈 ESTADO ACTUAL DE BASE DE DATOS\n";
    echo str_repeat("-", 70) . "\n";
    echo "Categorías en DB:   " . $categoryCount . "\n";
    echo "Consignas en DB:    " . $promptCount . "\n";
    echo "Palabras en DB:     " . $wordCount . "\n";
    echo str_repeat("=", 70) . "\n\n";

    echo "✅ ¡Migración completada exitosamente!\n\n";
    exit(0);

} catch (PDOException $e) {
    echo "\n❌ ERROR DE BASE DE DATOS:\n";
    echo "   " . $e->getMessage() . "\n\n";
    try {
        $db->rollback();
        echo "🔄 Transacción revertida.\n\n";
    } catch (Exception $rollbackErr) {
        echo "❌ Error al revertir: " . $rollbackErr->getMessage() . "\n\n";
    }
    exit(1);

} catch (Exception $e) {
    echo "\n❌ ERROR:\n";
    echo "   " . $e->getMessage() . "\n\n";
    try {
        $db->rollback();
    } catch (Exception $rollbackErr) {
        // silenciar
    }
    exit(1);
}
?>
