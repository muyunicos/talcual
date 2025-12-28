<?php
// Script para ejecutar periódicamente (cron job)
// Agregar a crontab: 0 */6 * * * php /ruta/a/cleanup-cron.php

require_once 'config.php';

echo "Iniciando limpieza de partidas antiguas...\n";
$cleaned = cleanupOldGames();
echo "Partidas eliminadas: $cleaned\n";
echo "Limpieza completada: " . date('Y-m-d H:i:s') . "\n";
?>