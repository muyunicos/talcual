class SettingsModal {
    constructor() {
        this.gameId = null;
        this.activeTab = 'general';
    }

    buildFormHTML() {
        const config = configManager.getAll();

        return `
            <div class="settings-form">
                <div class="settings-tabs">
                    <button class="settings-tab-btn active" data-tab="general">⚙️ General</button>
                    <button class="settings-tab-btn" data-tab="duration">⏱️ Duración</button>
                </div>

                <div class="settings-tabs-content">
                    <div class="settings-tab-pane active" data-tab="general">
                        <div class="settings-control">
                            <div class="settings-control-header">
                                <label class="settings-label">Número de Jugadores</label>
                                <button class="settings-reset-individual" data-field="players" type="button" title="Restablecer">
                                    🔄
                                </button>
                            </div>
                            <div class="settings-dual-range">
                                <input type="range" id="min-players" class="settings-range-min" 
                                       min="1" max="20" value="${config.min_players}">
                                <input type="range" id="max-players" class="settings-range-max" 
                                       min="1" max="20" value="${config.max_players}">
                                <div class="settings-range-display">
                                    <span class="settings-value-mini" id="min-players-display">${config.min_players}</span>
                                    <span class="settings-range-divider">-</span>
                                    <span class="settings-value-mini" id="max-players-display">${config.max_players}</span>
                                </div>
                            </div>
                            <small class="settings-hint">Mínimo 1-20 Máximo</small>
                        </div>

                        <div class="settings-control">
                            <div class="settings-control-header">
                                <label class="settings-label">Máx. Palabras por Jugador</label>
                                <button class="settings-reset-individual" data-field="max-words" type="button" title="Restablecer">
                                    🔄
                                </button>
                            </div>
                            <div class="settings-input-wrapper">
                                <input type="range" id="max-words-per-player" class="settings-slider" 
                                       min="1" max="8" value="${config.max_words_per_player}">
                                <span class="settings-value-display" id="max-words-per-player-display">${config.max_words_per_player}</span>
                            </div>
                            <small class="settings-hint">Límite de palabras (1-8)</small>
                        </div>

                        <div class="settings-control">
                            <div class="settings-control-header">
                                <label class="settings-label">Total de Rondas</label>
                                <button class="settings-reset-individual" data-field="total-rounds" type="button" title="Restablecer">
                                    🔄
                                </button>
                            </div>
                            <div class="settings-input-wrapper">
                                <input type="range" id="total-rounds" class="settings-slider" 
                                       min="1" max="8" value="${config.total_rounds}">
                                <span class="settings-value-display" id="total-rounds-display">${config.total_rounds}</span>
                            </div>
                            <small class="settings-hint">Rondas en partida (1-8)</small>
                        </div>
                    </div>

                    <div class="settings-tab-pane" data-tab="duration">
                        <div class="settings-control">
                            <div class="settings-control-header">
                                <label class="settings-label">Duración por Ronda</label>
                                <button class="settings-reset-individual" data-field="round-duration" type="button" title="Restablecer">
                                    🔄
                                </button>
                            </div>
                            <div class="settings-input-wrapper">
                                <input type="range" id="round-duration" class="settings-slider" 
                                       min="30" max="120" step="10" value="${config.round_duration}">
                                <span class="settings-value-display" id="round-duration-display">${config.round_duration}s</span>
                            </div>
                            <small class="settings-hint">30s a 2 minutos</small>
                        </div>

                        <div class="settings-control">
                            <div class="settings-control-header">
                                <label class="settings-label">Cuenta Atrás Inicial</label>
                                <button class="settings-reset-individual" data-field="start-countdown" type="button" title="Restablecer">
                                    🔄
                                </button>
                            </div>
                            <div class="settings-input-wrapper">
                                <input type="range" id="start-countdown" class="settings-slider" 
                                       min="1" max="6" value="${config.start_countdown}">
                                <span class="settings-value-display" id="start-countdown-display">${config.start_countdown}s</span>
                            </div>
                            <small class="settings-hint">1-6 segundos</small>
                        </div>

                        <div class="settings-control">
                            <div class="settings-control-header">
                                <label class="settings-label">Remate - Tiempo Restante</label>
                                <button class="settings-reset-individual" data-field="hurry-up" type="button" title="Restablecer">
                                    🔄
                                </button>
                            </div>
                            <div class="settings-input-wrapper">
                                <input type="range" id="hurry-up-threshold" class="settings-slider" 
                                       min="5" max="20" value="${config.hurry_up_threshold}">
                                <span class="settings-value-display" id="hurry-up-threshold-display">${config.hurry_up_threshold}s</span>
                            </div>
                            <small class="settings-hint">5-20 segundos</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    openModal(gameId = null) {
        this.gameId = gameId;
        const formHTML = this.buildFormHTML();

        const buttons = [
            [
                () => ModalSystem_Instance.close(2),
                'Cancelar',
                'btn'
            ],
            [
                () => this.saveSettings(),
                'Guardar',
                'btn-modal-primary'
            ]            
        ];

        ModalSystem_Instance.show(2, formHTML, buttons);
        this.attachEventListeners();
    }

    attachEventListeners() {
        const tabButtons = document.querySelectorAll('.settings-tab-btn');
        const sliders = document.querySelectorAll('.settings-slider');
        const dualRanges = document.querySelectorAll('.settings-range-min, .settings-range-max');
        const resetBtns = document.querySelectorAll('.settings-reset-individual');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => this.updateSliderDisplay(e.target));
        });

        dualRanges.forEach(range => {
            range.addEventListener('input', (e) => this.updateDualRangeDisplay(e.target));
        });

        resetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.resetFieldToDefault(e.target.dataset.field));
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"].settings-tab-btn`).classList.add('active');

        document.querySelectorAll('.settings-tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"].settings-tab-pane`).classList.add('active');
    }

    updateSliderDisplay(slider) {
        const displayId = slider.id + '-display';
        const displayEl = document.getElementById(displayId);
        if (displayEl) {
            const suffix = ['round-duration', 'start-countdown', 'hurry-up-threshold'].includes(slider.id) ? 's' : '';
            displayEl.textContent = slider.value + suffix;
        }
    }

    updateDualRangeDisplay(range) {
        const minInput = document.getElementById('min-players');
        const maxInput = document.getElementById('max-players');
        const minDisplay = document.getElementById('min-players-display');
        const maxDisplay = document.getElementById('max-players-display');

        let min = parseInt(minInput.value);
        let max = parseInt(maxInput.value);

        if (min > max) {
            if (range.id === 'min-players') {
                max = min;
                maxInput.value = min;
            } else {
                min = max;
                minInput.value = max;
            }
        }

        minDisplay.textContent = min;
        maxDisplay.textContent = max;
    }

    resetFieldToDefault(field) {
        const defaults = configManager.getAllDefaults();
        const fieldMap = {
            'players': ['min-players', 'max-players'],
            'max-words': ['max-words-per-player'],
            'total-rounds': ['total-rounds'],
            'round-duration': ['round-duration'],
            'start-countdown': ['start-countdown'],
            'hurry-up': ['hurry-up-threshold']
        };

        const fieldIds = fieldMap[field];
        if (!fieldIds) return;

        fieldIds.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                const defaultValue = defaults[this.fieldIdToKey(fieldId)];
                input.value = defaultValue;
                this.updateSliderDisplay(input);
            }
        });

        if (field === 'players') {
            this.updateDualRangeDisplay(document.getElementById('min-players'));
        }
    }

    fieldIdToKey(fieldId) {
        const map = {
            'min-players': 'min_players',
            'max-players': 'max_players',
            'round-duration': 'round_duration',
            'total-rounds': 'total_rounds',
            'start-countdown': 'start_countdown',
            'hurry-up-threshold': 'hurry_up_threshold',
            'max-words-per-player': 'max_words_per_player'
        };
        return map[fieldId];
    }

    getFormValues() {
        const minPlayersInput = document.getElementById('min-players');
        const maxPlayersInput = document.getElementById('max-players');
        const roundDurationInput = document.getElementById('round-duration');
        const totalRoundsInput = document.getElementById('total-rounds');
        const startCountdownInput = document.getElementById('start-countdown');
        const hurryUpThresholdInput = document.getElementById('hurry-up-threshold');
        const maxWordsPerPlayerInput = document.getElementById('max-words-per-player');

        return {
            min_players: parseInt(minPlayersInput?.value || 1, 10),
            max_players: parseInt(maxPlayersInput?.value || 20, 10),
            round_duration: parseInt(roundDurationInput?.value || 90, 10),
            total_rounds: parseInt(totalRoundsInput?.value || 5, 10),
            start_countdown: parseInt(startCountdownInput?.value || 5, 10),
            hurry_up_threshold: parseInt(hurryUpThresholdInput?.value || 10, 10),
            max_words_per_player: parseInt(maxWordsPerPlayerInput?.value || 6, 10),
            max_word_length: 30
        };
    }

    validateSettings(settings) {
        const errors = [];

        if (settings.min_players < 1 || settings.min_players > 20) {
            errors.push('Mínimo de jugadores: 1-20');
        }
        if (settings.max_players < settings.min_players || settings.max_players > 20) {
            errors.push('Máximo debe ser ≥ mínimo y ≤ 20');
        }
        if (settings.total_rounds < 1 || settings.total_rounds > 8) {
            errors.push('Rondas totales: 1-8');
        }
        if (settings.round_duration < 30 || settings.round_duration > 120) {
            errors.push('Duración ronda: 30-120 segundos');
        }
        if (settings.start_countdown < 1 || settings.start_countdown > 6) {
            errors.push('Cuenta atrás: 1-6 segundos');
        }
        if (settings.hurry_up_threshold < 5 || settings.hurry_up_threshold > 20) {
            errors.push('Remate: 5-20 segundos');
        }
        if (settings.max_words_per_player < 1 || settings.max_words_per_player > 8) {
            errors.push('Máx palabras por jugador: 1-8');
        }

        return errors;
    }

    async saveSettings() {
        const values = this.getFormValues();
        const errors = this.validateSettings(values);

        if (errors.length > 0) {
            showNotification('❌ ' + errors.join(', '), 'error');
            return;
        }

        const payload = {
            action: 'update_config',
            config: values
        };

        if (this.gameId) {
            payload.game_id = this.gameId;
        }

        debug('💾 Guardando config:', values, 'debug');

        try {
            const response = await fetch('./app/actions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Error saving configuration');
            }

            configManager.syncFromObject(values);
            debug('✅ Configuración guardada correctamente', null, 'success');
            showNotification('✅ Configuración guardada', 'success');
            ModalSystem_Instance.close(2);
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