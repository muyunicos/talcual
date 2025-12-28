<?php
// Script de limpieza automática (para ejecutar via cron)
// Uso: php cleanup-cron.php

require_once __DIR__ . '/../core/config.php';

echo "Iniciando limpieza...\n";

$deleted = cleanupOldGames();

echo "Limpieza completada. Juegos eliminados: {$deleted}\n";
echo "Juegos activos: " . count(getActiveCodes()) . "\n";
?>