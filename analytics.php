<?php
// Analytics - Solo accesible en modo desarrollo
require_once 'settings.php';
require_once 'config.php';

header('Content-Type: application/json');

if (!DEV_MODE) {
    echo json_encode(['error' => 'Analytics solo disponible en modo desarrollo']);
    exit;
}

// Cargar analytics
$analytics = loadAnalytics();

echo json_encode($analytics, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?>