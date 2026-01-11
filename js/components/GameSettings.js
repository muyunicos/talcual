class SettingsModal {
    constructor() {
        this.settings = {};
        this.openedFrom = null;
        this.gameId = null;
        this.activeTab = 'players';
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
                <div class="settings-tabs">
                    <button class="settings-tab-btn active" data-tab="players">👥 Jugadores</button>
                    <button class="settings-tab-btn" data-tab="rounds">⏱️ Rondas</button>
                    <button class="settings-tab-btn" data-tab="words">📋 Palabras</button>
                </div>

                <div class="settings-tabs-content">
                    <div class="settings-tab-pane active" data-tab="players">
                        <div class="settings-control">
                            <label class="settings-label">Mínimo de Jugadores</label>
                            <div class="settings-input-wrapper">
                                <input type="range" id="min-players" class="settings-slider" 
                                       min="1" max="20" value="${minPlayers}">
                                <span class="settings-value-display" id="min-players-display">${minPlayers}</span>
                            </div>
                            <small class="settings-hint">Entre 1 y 20 jugadores</small>
                        </div>

                        <div class="settings-control">
                            <label class="settings-label">Máximo de Jugadores</label>
                            <div class="settings-input-wrapper">
                                <input type="range" id="max-players" class="settings-slider" 
                                       min="1" max="100" value="${maxPlayers}">
                                <span class="settings-value-display" id="max-players-display">${maxPlayers}</span>
                            </div>
                            <small class="settings-hint">Slots máximos en partida (1-100)</small>
                        </div>
                    </div>

                    <div class="settings-tab-pane" data-tab="rounds">
                        <div class="settings-control">
                            <label class="settings-label">Total de Rondas</label>
                            <div class="settings-input-wrapper">
                                <input type="range" id="total-rounds" class="settings-slider" 
                                       min="1" max="10" value="${totalRounds}">
                                <span class="settings-value-display" id="total-rounds-display">${totalRounds}</span>
                            </div>
                            <small class="settings-hint">Rondas en partida completa (1-10)</small>
                        </div>

                        <div class="settings-control">
                            <label class="settings-label">Duración por Ronda</label>
                            <div class="settings-input-wrapper">
                                <input type="range" id="round-duration" class="settings-slider" 
                                       min="30" max="300" step="5" value="${roundDuration}">
                                <span class="settings-value-display" id="round-duration-display">${roundDuration}s</span>
                            </div>
                            <small class="settings-hint">30s a 5 minutos por ronda</small>
                        </div>

                        <div class="settings-control">
                            <label class="settings-label">Cuenta Atrás Inicial</label>
                            <div class="settings-input-wrapper">
                                <input type="range" id="start-countdown" class="settings-slider" 
                                       min="1" max="10" value="${startCountdown}">
                                <span class="settings-value-display" id="start-countdown-display">${startCountdown}s</span>
                            </div>
                            <small class="settings-hint">Preparación antes de empezar (1-10s)</small>
                        </div>

                        <div class="settings-control">
                            <label class="settings-label">Remate - Tiempo Restante</label>
                            <div class="settings-input-wrapper">
                                <input type="range" id="hurry-up-threshold" class="settings-slider" 
                                       min="5" max="60" step="5" value="${hurryUpThreshold}">
                                <span class="settings-value-display" id="hurry-up-threshold-display">${hurryUpThreshold}s</span>
                            </div>
                            <small class="settings-hint">Tiempo para activar remate (5-60s)</small>
                        </div>
                    </div>

                    <div class="settings-tab-pane" data-tab="words">
                        <div class="settings-control">
                            <label class="settings-label">Máx. Palabras por Jugador</label>
                            <div class="settings-input-wrapper">
                                <input type="range" id="max-words-per-player" class="settings-slider" 
                                       min="1" max="20" value="${maxWordsPerPlayer}">
                                <span class="settings-value-display" id="max-words-per-player-display">${maxWordsPerPlayer}</span>
                            </div>
                            <small class="settings-hint">Límite de palabras por jugador (1-20)</small>
                        </div>

                        <div class="settings-control">
                            <label class="settings-label">Longitud Máxima de Palabra</label>
                            <div class="settings-input-wrapper">
                                <input type="range" id="max-word-length" class="settings-slider" 
                                       min="10" max="100" step="5" value="${maxWordLength}">
                                <span class="settings-value-display" id="max-word-length-display">${maxWordLength}</span>
                            </div>
                            <small class="settings-hint">Máximo de caracteres (10-100)</small>
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
        } else if (gameId && window.configService && window.configService.isConfigReady(gameId)) {
            this.settings = window.configService.getForGame(gameId);
        } else if (window.configService && window.configService.getForGame()) {
            this.settings = window.configService.getForGame();
        } else {
            this.settings = this.getDefaults();
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

        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => this.updateSliderDisplay(e.target));
        });
    }

    switchTab(tabName) {
        this.activeTab = tabName;
        
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

            this.settings = values;
            if (this.gameId && window.configService) {
                window.configService.invalidate(this.gameId);
                if (result.state) {
                    window.configService.loadFromState(result.state);
                }
            } else if (window.configService) {
                window.configService.invalidate();
            }
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
            if (window.configService) {
                window.configService.invalidate();
            }
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
