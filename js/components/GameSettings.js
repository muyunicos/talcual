class SettingsModal {
    constructor() {
        this.settings = {};
        this.openedFrom = null;
        this.gameId = null;
        this.activeTab = 'general';
    }

    getDefaults() {
        return configManager.getAllDefaults();
    }

    buildFormHTML() {
        const s = this.settings;
        const defaults = this.getDefaults();
        const minPlayers = s.min_players !== undefined ? s.min_players : defaults.min_players;
        const maxPlayers = s.max_players !== undefined ? s.max_players : defaults.max_players;
        const roundDuration = s.round_duration !== undefined ? s.round_duration : defaults.round_duration;
        const totalRounds = s.total_rounds !== undefined ? s.total_rounds : defaults.total_rounds;
        const startCountdown = s.start_countdown !== undefined ? s.start_countdown : defaults.start_countdown;
        const hurryUpThreshold = s.hurry_up_threshold !== undefined ? s.hurry_up_threshold : defaults.hurry_up_threshold;
        const maxWordsPerPlayer = s.max_words_per_player !== undefined ? s.max_words_per_player : defaults.max_words_per_player;

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
                                       min="1" max="20" value="${minPlayers}">
                                <input type="range" id="max-players" class="settings-range-max" 
                                       min="1" max="20" value="${maxPlayers}">
                                <div class="settings-range-display">
                                    <span class="settings-value-mini" id="min-players-display">${minPlayers}</span>
                                    <span class="settings-range-divider">-</span>
                                    <span class="settings-value-mini" id="max-players-display">${maxPlayers}</span>
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
                                       min="1" max="8" value="${maxWordsPerPlayer}">
                                <span class="settings-value-display" id="max-words-per-player-display">${maxWordsPerPlayer}</span>
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
                                       min="1" max="8" value="${totalRounds}">
                                <span class="settings-value-display" id="total-rounds-display">${totalRounds}</span>
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
                                       min="30" max="120" step="10" value="${roundDuration}">
                                <span class="settings-value-display" id="round-duration-display">${roundDuration}s</span>
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
                                       min="1" max="6" value="${startCountdown}">
                                <span class="settings-value-display" id="start-countdown-display">${startCountdown}s</span>
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
                                       min="5" max="20" value="${hurryUpThreshold}">
                                <span class="settings-value-display" id="hurry-up-threshold-display">${hurryUpThreshold}s</span>
                            </div>
                            <small class="settings-hint">5-20 segundos</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    openModal(context = 'normal', gameId = null, config = null) {
        this.openedFrom = context;
        this.gameId = gameId;

        if (config && typeof config === 'object') {
            this.settings = config;
        } else {
            this.settings = configManager.getAll();
        }

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
        return {
            min_players: parseInt(document.getElementById('min-players')?.value || 3, 10),
            max_players: parseInt(document.getElementById('max-players')?.value || 8, 10),
            round_duration: parseInt(document.getElementById('round-duration')?.value || 120, 10),
            total_rounds: parseInt(document.getElementById('total-rounds')?.value || 3, 10),
            start_countdown: parseInt(document.getElementById('start-countdown')?.value || 5, 10),
            hurry_up_threshold: parseInt(document.getElementById('hurry-up-threshold')?.value || 10, 10),
            max_words_per_player: parseInt(document.getElementById('max-words-per-player')?.value || 6, 10),
            max_word_length: 30
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
            const payload = {
                action: 'update_config',
                config: values
            };

            if (this.gameId) {
                payload.game_id = this.gameId;
            }

            const response = await fetch(url.toString(), {
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

            configManager.syncFromObject(values);
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
