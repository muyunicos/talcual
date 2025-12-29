<?php

define('GAME_STATES_DIR', __DIR__ . '/../game_states');
define('ANALYTICS_FILE', __DIR__ . '/../game_states/analytics.json');
define('DICTIONARY_FILE', __DIR__ . '/diccionario.json');

define('MAX_GAME_AGE', 3600);
define('CLEANUP_PROBABILITY', 0.05);

define('RATE_LIMIT_REQUESTS', 100);
define('RATE_LIMIT_WINDOW', 60);

define('MAX_CODE_LENGTH', 5);

define('DEFAULT_TOTAL_ROUNDS', 3);
define('DEFAULT_ROUND_DURATION', 60);
define('MIN_PLAYERS', 2);
define('MAX_PLAYERS', 12);
define('MAX_WORDS_PER_PLAYER', 6);
define('MAX_WORD_LENGTH', 50);

define('DEV_MODE', getenv('DEV_MODE') === 'true' || getenv('DEV_MODE') === '1');

if (!is_dir(GAME_STATES_DIR)) {
    mkdir(GAME_STATES_DIR, 0755, true);
}
?>