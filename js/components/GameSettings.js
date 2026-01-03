class SettingsModal {
    constructor() {
        this.settings = {};
        this.openedFrom = null;
    }

    async loadSettings() {
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
            return true;
        } catch (error) {
            debug('Error cargando configuración', error, 'error');
            this.settings = this.getDefaults();
            return false;
        }
    }

    getDefaults() {
        return {
            MIN_PLAYERS: 1,
            MAX_PLAYERS: 20,
            ROUND_DURATION: 90,
            TOTAL_ROUNDS: 3,
            START_COUNTDOWN: 5,
            HURRY_UP_THRESHOLD: 10,
            MAX_WORDS_PER_PLAYER: 6,
            MAX_WORD_LENGTH: 30
        };
    }

    buildFormHTML() {
        const s = this.settings;

        return `
            <div class="settings-form">
                <div class="settings-group">
                    <h4>👥 Jugadores</h4>
                    
                    <div class="input-group">
                        <label class="input-label" for="min-players">Mínimo de Jugadores</label>
                        <input type="number" id="min-players" class="input-field"
                               min="1" max="20" value="${s.MIN_PLAYERS || 1}">
                        <small style="color: var(--color-text-secondary); margin-top: 4px; display: block;">
                            Mínimo: 1, Máximo: 20
                        </small>
                    </div>

                    <div class="input-group">
                        <label class="input-label" for="max-players">Máximo de Jugadores</label>
                        <input type="number" id="max-players" class="input-field"
                               min="1" max="100" value="${s.MAX_PLAYERS || 20}">
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
                               min="1" max="10" value="${s.TOTAL_ROUNDS || 3}">
                        <small style="color: var(--color-text-secondary); margin-top: 4px; display: block;">
                            Número de rondas en una partida completa (1-10)
                        </small>
                    </div>

                    <div class="input-group">
                        <label class="input-label" for="round-duration">Duración por Ronda (segundos)</label>
                        <input type="number" id="round-duration" class="input-field"
                               min="30" max="300" value="${s.ROUND_DURATION || 90}">
                        <small style="color: var(--color-text-secondary); margin-top: 4px; display: block;">
                            Tiempo límite por ronda: 30s a 5 minutos
                        </small>
                    </div>

                    <div class="input-group">
                        <label class="input-label" for="start-countdown">Cuenta Atrás Inicial (segundos)</label>
                        <input type="number" id="start-countdown" class="input-field"
                               min="1" max="10" value="${s.START_COUNTDOWN || 5}">
                        <small style="color: var(--color-text-secondary); margin-top: 4px; display: block;">
                            Tiempo de preparación antes de empezar (1-10s)
                        </small>
                    </div>

                    <div class="input-group">
                        <label class="input-label" for="hurry-up-threshold">Remate - Tiempo Restante (segundos)</label>
                        <input type="number" id="hurry-up-threshold" class="input-field"
                               min="5" max="60" value="${s.HURRY_UP_THRESHOLD || 10}">
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
                               min="1" max="20" value="${s.MAX_WORDS_PER_PLAYER || 6}">
                        <small style="color: var(--color-text-secondary); margin-top: 4px; display: block;">
                            Límite de palabras que puede enviar cada jugador (1-20)
                        </small>
                    </div>

                    <div class="input-group">
                        <label class="input-label" for="max-word-length">Longitud Máxima de Palabra</label>
                        <input type="number" id="max-word-length" class="input-field"
                               min="10" max="100" value="${s.MAX_WORD_LENGTH || 30}">
                        <small style="color: var(--color-text-secondary); margin-top: 4px; display: block;">
                            Máximo de caracteres por palabra (10-100)
                        </small>
                    </div>
                </div>
            </div>
        `;
    }

    openModal(context = 'normal') {
        this.openedFrom = context;
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
            MIN_PLAYERS: parseInt(document.getElementById('min-players')?.value || 1, 10),
            MAX_PLAYERS: parseInt(document.getElementById('max-players')?.value || 20, 10),
            ROUND_DURATION: parseInt(document.getElementById('round-duration')?.value || 90, 10),
            TOTAL_ROUNDS: parseInt(document.getElementById('total-rounds')?.value || 3, 10),
            START_COUNTDOWN: parseInt(document.getElementById('start-countdown')?.value || 5, 10),
            HURRY_UP_THRESHOLD: parseInt(document.getElementById('hurry-up-threshold')?.value || 10, 10),
            MAX_WORDS_PER_PLAYER: parseInt(document.getElementById('max-words-per-player')?.value || 6, 10),
            MAX_WORD_LENGTH: parseInt(document.getElementById('max-word-length')?.value || 30, 10)
        };
    }

    validateSettings(settings) {
        const errors = [];

        if (settings.MIN_PLAYERS < 1 || settings.MIN_PLAYERS > 20) {
            errors.push('Mínimo de jugadores: 1-20');
        }
        if (settings.MAX_PLAYERS < settings.MIN_PLAYERS || settings.MAX_PLAYERS > 100) {
            errors.push('Máximo debe ser ≥ mínimo y ≤ 100');
        }
        if (settings.TOTAL_ROUNDS < 1 || settings.TOTAL_ROUNDS > 10) {
            errors.push('Rondas totales: 1-10');
        }
        if (settings.ROUND_DURATION < 30 || settings.ROUND_DURATION > 300) {
            errors.push('Duración ronda: 30-300 segundos');
        }
        if (settings.START_COUNTDOWN < 1 || settings.START_COUNTDOWN > 10) {
            errors.push('Cuenta atrás: 1-10 segundos');
        }
        if (settings.HURRY_UP_THRESHOLD < 5 || settings.HURRY_UP_THRESHOLD > 60) {
            errors.push('Remate: 5-60 segundos');
        }
        if (settings.MAX_WORDS_PER_PLAYER < 1 || settings.MAX_WORDS_PER_PLAYER > 20) {
            errors.push('Máx palabras por jugador: 1-20');
        }
        if (settings.MAX_WORD_LENGTH < 10 || settings.MAX_WORD_LENGTH > 100) {
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        settingsModal = new SettingsModal();
        await settingsModal.loadSettings();
        window.settingsModal = settingsModal;
    });
} else {
    (async () => {
        settingsModal = new SettingsModal();
        await settingsModal.loadSettings();
        window.settingsModal = settingsModal;
    })();
}

console.log('%c✅ GameSettings.js', 'color: #FF6B00; font-weight: bold; font-size: 12px');