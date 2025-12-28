<?php
// Script de limpieza automática
// Ejecutar vía cron o manualmente

require_once __DIR__ . '/../core/config.php';

echo "Limpiando juegos antiguos...\n";
$deleted = cleanupOldGames();
echo "Eliminados: {$deleted} juegos\n";
echo "Códigos activos: " . count(getActiveCodes()) . "\n";
?>