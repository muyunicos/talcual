<?php
// Configuración global del juego

// Define la ruta del directorio de estados de juego
define('GAME_STATES_DIR', __DIR__ . '/../game_states');
define('ANALYTICS_FILE', __DIR__ . '/../game_states/analytics.json');
define('DICTIONARY_FILE', __DIR__ . '/diccionario.json');

// Limpieza automática de juegos viejos
define('MAX_GAME_AGE', 3600); // 1 hora en segundos
define('CLEANUP_PROBABILITY', 0.05); // 5% de probabilidad

// Configuración de límite de tasa
define('RATE_LIMIT_REQUESTS', 100);
define('RATE_LIMIT_WINDOW', 60);

// Configuración de códigos de sala
define('MAX_CODE_LENGTH', 5); // Máximo de caracteres para código

// Parámetros del juego - AHORA CONFIGURABLES POR EL HOST
// Estos son valores por defecto que pueden ser sobrescritos
define('DEFAULT_TOTAL_ROUNDS', 3);
define('DEFAULT_ROUND_DURATION', 120); // segundos
define('MIN_PLAYERS', 2);
define('MAX_PLAYERS', 12);
define('MAX_WORDS_PER_PLAYER', 6);
define('MAX_WORD_LENGTH', 50);

// Modo desarrollo
define('DEV_MODE', getenv('DEV_MODE') === 'true' || getenv('DEV_MODE') === '1');

// Validar que directorios existan
if (!is_dir(GAME_STATES_DIR)) {
    mkdir(GAME_STATES_DIR, 0755, true);
}
?>
