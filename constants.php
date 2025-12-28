<?php
// constants.php - Constantes configurables del sistema

// ========================================
// MODO DE OPERACIÓN
// ========================================

// Modo desarrollo: muestra errores detallados, logs, y herramientas de debugging
define('DEV_MODE', false);

// ========================================
// CONFIGURACIÓN DEL JUEGO
// ========================================

// Duración de ronda por defecto (en segundos)
define('DEFAULT_ROUND_DURATION', 120);

// Número de rondas por defecto
define('DEFAULT_TOTAL_ROUNDS', 3);

// Máximo de palabras que puede enviar cada jugador por ronda
define('MAX_WORDS_PER_PLAYER', 6);

// Longitud máxima de cada palabra (caracteres)
define('MAX_WORD_LENGTH', 30);

// Longitud mínima de nombre de jugador
define('MIN_PLAYER_NAME_LENGTH', 2);

// Longitud máxima de nombre de jugador
define('MAX_PLAYER_NAME_LENGTH', 20);

// Número mínimo de jugadores para comenzar
define('MIN_PLAYERS', 3);

// Longitud máxima de código de sala
define('MAX_GAME_CODE_LENGTH', 5);

// ========================================
// SERVIDOR Y ALMACENAMIENTO
// ========================================

// Tiempo de expiración de partidas inactivas (en segundos)
// 86400 = 24 horas
define('GAME_EXPIRATION_TIME', 86400);

// Intervalo de heartbeat de SSE (en segundos)
define('SSE_HEARTBEAT_INTERVAL', 15);

// Timeout máximo de conexión SSE (en segundos)
define('SSE_MAX_DURATION', 1800); // 30 minutos

// Directorio para estados de juego
define('GAME_STATES_DIR', __DIR__ . '/game_states');

// ========================================
// ANALYTICS Y LOGS
// ========================================

// Guardar analytics (solo en producción)
define('ENABLE_ANALYTICS', !DEV_MODE);

// Archivo de analytics
define('ANALYTICS_FILE', GAME_STATES_DIR . '/analytics.json');

// Guardar logs detallados
define('ENABLE_LOGGING', DEV_MODE);

// ========================================
// VALIDACIONES
// ========================================

// Caracteres válidos para códigos de sala
define('VALID_GAME_CODE_CHARS', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');

// Caracteres válidos para nombres de jugador (regex)
define('VALID_PLAYER_NAME_REGEX', '/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]+$/');

// ========================================
// MENSAJES Y TEXTOS
// ========================================

// Mensajes de error
define('ERROR_INVALID_JSON', 'JSON inválido');
define('ERROR_INVALID_ACTION', 'Acción no válida');
define('ERROR_GAME_NOT_FOUND', 'Juego no encontrado');
define('ERROR_PLAYER_NOT_FOUND', 'Jugador no encontrado');
define('ERROR_MIN_PLAYERS', 'Mínimo ' . MIN_PLAYERS . ' jugadores requeridos');
define('ERROR_NAME_TOO_SHORT', 'Nombre muy corto (mínimo ' . MIN_PLAYER_NAME_LENGTH . ' caracteres)');
define('ERROR_NAME_TOO_LONG', 'Nombre muy largo (máximo ' . MAX_PLAYER_NAME_LENGTH . ' caracteres)');
define('ERROR_INVALID_NAME', 'Nombre contiene caracteres inválidos');
define('ERROR_WORD_TOO_LONG', 'Palabra muy larga (máximo ' . MAX_WORD_LENGTH . ' caracteres)');
define('ERROR_TOO_MANY_WORDS', 'Máximo ' . MAX_WORDS_PER_PLAYER . ' palabras permitidas');

// ========================================
// FUNCIONES DE UTILIDAD
// ========================================

function isDevMode() {
    return DEV_MODE;
}

function shouldEnableAnalytics() {
    return ENABLE_ANALYTICS;
}

function shouldEnableLogging() {
    return ENABLE_LOGGING;
}

function logDebug($message, $data = null) {
    if (ENABLE_LOGGING) {
        $timestamp = date('Y-m-d H:i:s');
        $logMessage = "[{$timestamp}] {$message}";
        
        if ($data !== null) {
            $logMessage .= ' | Data: ' . json_encode($data);
        }
        
        error_log($logMessage);
    }
}

// Configurar errores según modo
if (DEV_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(E_ERROR | E_WARNING | E_PARSE);
    ini_set('display_errors', '0');
}
?>
