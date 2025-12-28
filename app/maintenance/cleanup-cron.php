<?php
// Script de limpieza automática
// Ejecutar vía cron o manualmente

require_once __DIR__ . '/../core/config.php';

echo "Iniciando limpieza...\n";
$deleted = cleanupOldGames();
echo "Juegos eliminados: {$deleted}\n";
echo "Limpieza completada.\n";
?>