<?php
// Configuración Global - Unánimo Party
// Modificar aquí los valores según necesites

// MODO DE DESARROLLO
define('DEV_MODE', false); // Cambiar a true para activar modo desarrollo

// CONFIGURACIÓN DEL JUEGO
define('MIN_PLAYERS', 3);              // Mínimo de jugadores para empezar
define('MAX_PLAYERS', 20);             // Máximo de jugadores permitidos
define('DEFAULT_ROUND_DURATION', 120); // Duración de ronda en segundos
define('DEFAULT_TOTAL_ROUNDS', 3);     // Número de rondas por partida
define('MAX_WORDS_PER_PLAYER', 6);     // Máximo de palabras por jugador
define('MAX_WORD_LENGTH', 30);         // Longitud máxima de palabra
define('MAX_CODE_LENGTH', 5);          // Longitud máxima código de sala

// CONFIGURACIÓN DE ARCHIVOS
define('GAME_STATES_DIR', __DIR__ . '/game_states');
define('ANALYTICS_FILE', __DIR__ . '/analytics.json');
define('DICTIONARY_FILE', __DIR__ . '/diccionario.json');

// CONFIGURACIÓN DE LIMPIEZA
define('MAX_GAME_AGE', 86400);         // 24 horas en segundos
define('CLEANUP_PROBABILITY', 0.01);   // 1% de probabilidad de limpieza automática

// CONFIGURACIÓN SSE
define('SSE_TIMEOUT', 1800);           // 30 minutos
define('SSE_HEARTBEAT_INTERVAL', 15);  // Heartbeat cada 15 segundos

// LOGS (solo en modo desarrollo)
if (DEV_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
    ini_set('log_errors', 1);
    ini_set('error_log', __DIR__ . '/debug.log');
} else {
    error_reporting(E_ERROR | E_WARNING);
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
}
?>