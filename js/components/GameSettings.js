class SettingsModal {
    constructor() {
        this.settings = {};
        this.openedFrom = null;
        this.settingsLoaded = false;
    }

    async loadSettings() {
        if (this.settingsLoaded) {
            return true;
        }

        try {
            const url = new URL('./app/actions.php', window.location.href);
            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_config' })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success || !result.config) {
                throw new Error(result.message || 'Invalid response: missing config');
            }

            this.settings = result.config;
            this.settingsLoaded = true;
            return true;
        } catch (error) {
            debug('Error cargando configuración', error, 'error');
            this.settings = this.getDefaults();
            this.settingsLoaded = true;
            return false;
        }
    }

    getDefaults() {
        return {
            min_players: 1,
            max_players: 20,
            round_duration: 90,
            total_rounds: 3,
            start_countdown: 5,
            hurry_up_threshold: 10,
            max_words_per_player: 6,
            max_word_length: 30
        };
    }

    buildFormHTML() {
        const s = this.settings;
        const minPlayers = s.min_players !== undefined ? s.min_players : 1;
        const maxPlayers = s.max_players !== undefined ? s.max_players : 20;
        const roundDuration = s.round_duration !== undefined ? s.round_duration : 90;
        const totalRounds = s.total_rounds !== undefined ? s.total_rounds : 3;
        const startCountdown = s.start_countdown !== undefined ? s.start_countdown : 5;
        const hurryUpThreshold = s.hurry_up_threshold !== undefined ? s.hurry_up_threshold : 10;
        const maxWordsPerPlayer = s.max_words_per_player !== undefined ? s.max_words_per_player : 6;
        const maxWordLength = s.max_word_length !== undefined ? s.max_word_length : 30;

        return `
            <div class="settings-form">
                <div class="settings-group">
                    <h4>👥 Jugadores</h4>
                    
                    <div class="input-group">
                        <label class="input-label" for="min-players">Mínimo de Jugadores</label>
                        <input type="number" id="min-players" class="input-field"
                               min="1" max="20" value="${minPlayers}">
                        <small style="color: var(--color-text-secondary); margin-top: 4px; display: block;">
                            Mínimo: 1, Máximo: 20
                        </small>
                    </div>

                    <div class="input-group">
                        <label class="input-label" for="max-players">Máximo de Jugadores</label>
                        <input type="number" id="max-players" class="input-field"
                               min="1" max="100" value="${maxPlayers}">
                        <small style="color: var(--color-text-secondary); margin-top: 4px; display: block;">
                            Máximo de slots en una partida
                        </small>
                    </div>
                </div>

                <div class="settings-group">
                    <h4>⏱️ Rondas y Tiempo</h4>
                    
                    <div class="input-group">
                        <label class="input-label" for="total-rounds">Total de Rondas</label>
                        <input type="number" id="total-rounds" class="input-field"
                               min="1" max="10" value="${totalRounds}">
                        <small style="color: var(--color-text-secondary); margin-top: 4px; display: block;">
                            Número de rondas en una partida completa (1-10)
                        </small>
                    </div>

                    <div class="input-group">
                        <label class="input-label" for="round-duration">Duración por Ronda (segundos)</label>
                        <input type="number" id="round-duration" class="input-field"
                               min="30" max="300" value="${roundDuration}">
                        <small style="color: var(--color-text-secondary); margin-top: 4px; display: block;">
                            Tiempo límite por ronda: 30s a 5 minutos
                        </small>
                    </div>

                    <div class="input-group">
                        <label class="input-label" for="start-countdown">Cuenta Atrás Inicial (segundos)</label>
                        <input type="number" id="start-countdown" class="input-field"
                               min="1" max="10" value="${startCountdown}">
                        <small style="color: var(--color-text-secondary); margin-top: 4px; display: block;">
                            Tiempo de preparación antes de empezar (1-10s)
                        </small>
                    </div>

                    <div class="input-group">
                        <label class="input-label" for="hurry-up-threshold">Remate - Tiempo Restante (segundos)</label>
                        <input type="number" id="hurry-up-threshold" class="input-field"
                               min="5" max="60" value="${hurryUpThreshold}">
                        <small style="color: var(--color-text-secondary); margin-top: 4px; display: block;">
                            Tiempo que queda cuando se activa el remate (5-60s)
                        </small>
                    </div>
                </div>

                <div class="settings-group">
                    <h4>📏 Palabras</h4>
                    
                    <div class="input-group">
                        <label class="input-label" for="max-words-per-player">Máx. Palabras por Jugador</label>
                        <input type="number" id="max-words-per-player" class="input-field"
                               min="1" max="20" value="${maxWordsPerPlayer}">
                        <small style="color: var(--color-text-secondary); margin-top: 4px; display: block;">
                            Límite de palabras que puede enviar cada jugador (1-20)
                        </small>
                    </div>

                    <div class="input-group">
                        <label class="input-label" for="max-word-length">Longitud Máxima de Palabra</label>
                        <input type="number" id="max-word-length" class="input-field"
                               min="10" max="100" value="${maxWordLength}">
                        <small style="color: var(--color-text-secondary); margin-top: 4px; display: block;">
                            Máximo de caracteres por palabra (10-100)
                        </small>
                    </div>
                </div>
            </div>
        `;
    }

    async openModal(context = 'normal') {
        this.openedFrom = context;
        await this.loadSettings();
        const formHTML = this.buildFormHTML();
        const isCreationContext = context === 'creation';

        const buttons = isCreationContext ? [
            [
                () => this.saveAndCreateGame(),
                'Guardar y Crear',
                'btn-modal-primary'
            ],
            [
                () => ModalSystem_Instance.close(2),
                'Volver',
                'btn'
            ]
        ] : [
            [
                () => this.saveSettings(),
                'Guardar',
                'btn-modal-primary'
            ],
            [
                () => ModalSystem_Instance.close(2),
                'Cancelar',
                'btn'
            ]
        ];

        ModalSystem_Instance.show(2, formHTML, buttons);
    }

    getFormValues() {
        return {
            min_players: parseInt(document.getElementById('min-players')?.value || 1, 10),
            max_players: parseInt(document.getElementById('max-players')?.value || 20, 10),
            round_duration: parseInt(document.getElementById('round-duration')?.value || 90, 10),
            total_rounds: parseInt(document.getElementById('total-rounds')?.value || 3, 10),
            start_countdown: parseInt(document.getElementById('start-countdown')?.value || 5, 10),
            hurry_up_threshold: parseInt(document.getElementById('hurry-up-threshold')?.value || 10, 10),
            max_words_per_player: parseInt(document.getElementById('max-words-per-player')?.value || 6, 10),
            max_word_length: parseInt(document.getElementById('max-word-length')?.value || 30, 10)
        };
    }

    validateSettings(settings) {
        const errors = [];

        if (settings.min_players < 1 || settings.min_players > 20) {
            errors.push('Mínimo de jugadores: 1-20');
        }
        if (settings.max_players < settings.min_players || settings.max_players > 100) {
            errors.push('Máximo debe ser ≥ mínimo y ≤ 100');
        }
        if (settings.total_rounds < 1 || settings.total_rounds > 10) {
            errors.push('Rondas totales: 1-10');
        }
        if (settings.round_duration < 30 || settings.round_duration > 300) {
            errors.push('Duración ronda: 30-300 segundos');
        }
        if (settings.start_countdown < 1 || settings.start_countdown > 10) {
            errors.push('Cuenta atrás: 1-10 segundos');
        }
        if (settings.hurry_up_threshold < 5 || settings.hurry_up_threshold > 60) {
            errors.push('Remate: 5-60 segundos');
        }
        if (settings.max_words_per_player < 1 || settings.max_words_per_player > 20) {
            errors.push('Máx palabras por jugador: 1-20');
        }
        if (settings.max_word_length < 10 || settings.max_word_length > 100) {
            errors.push('Longitud palabra: 10-100 caracteres');
        }

        return errors;
    }

    async saveSettings() {
        try {
            const values = this.getFormValues();
            const errors = this.validateSettings(values);

            if (errors.length > 0) {
                showNotification('❌ ' + errors.join(', '), 'error');
                return;
            }

            const url = new URL('./app/actions.php', window.location.href);
            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_config',
                    config: values
                })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Error saving configuration');
            }

            this.settings = values;
            showNotification('✅ Configuración guardada', 'success');
            ModalSystem_Instance.close(2);
        } catch (error) {
            debug('Error guardando configuración', error, 'error');
            showNotification('❌ Error guardando configuración', 'error');
        }
    }

    async saveAndCreateGame() {
        try {
            const values = this.getFormValues();
            const errors = this.validateSettings(values);

            if (errors.length > 0) {
                showNotification('❌ ' + errors.join(', '), 'error');
                return;
            }

            const url = new URL('./app/actions.php', window.location.href);
            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_config',
                    config: values
                })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Error saving configuration');
            }

            this.settings = values;
            showNotification('✅ Configuración guardada', 'success');
            ModalSystem_Instance.close(2);

            await new Promise((r) => setTimeout(r, 300));

            if (window.createGameModal) {
                window.createGameModal.openModal();
            }
        } catch (error) {
            debug('Error guardando configuración', error, 'error');
            showNotification('❌ Error guardando configuración', 'error');
        }
    }
}

let settingsModal = null;

document.addEventListener('DOMContentLoaded', async () => {
    settingsModal = new SettingsModal();
    window.settingsModal = settingsModal;
}, { once: true });

console.log('%c✅ GameSettings.js', 'color: #FF6B00; font-weight: bold; font-size: 12px');