class CreateGameModal {
    constructor() {
        this.gameCandidates = [];
        this.selectedCandidate = null;
        this.gameConfig = {};
        this.readyPromise = null;
        this.isReady = false;
        this.currentRoomCode = null;
        this.isFirstGame = true;
        this.maxCodeLength = 4;
        this.isCached = false;
    }

    async fetchCandidates() {
        try {
            const url = new URL('./app/actions.php', window.location.href);
            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_game_candidates' })
            });

            if (!response.ok) {
                debug(`⚠️ get_game_candidates returned ${response.status}`, null, 'warn');
                return false;
            }

            const text = await response.text();
            if (!text) {
                debug('⚠️ Empty response from get_game_candidates', null, 'warn');
                return false;
            }

            const result = JSON.parse(text);

            if (!result.success || !Array.isArray(result.candidates)) {
                debug('⚠️ Invalid candidates response', result, 'warn');
                return false;
            }

            this.gameCandidates = result.candidates;
            debug('🌟 Candidatos cargados exitosamente', { count: this.gameCandidates.length }, 'success');
            return true;
        } catch (error) {
            debug('⚠️ get_game_candidates no disponible - continuando sin candidatos', null, 'warn');
            this.gameCandidates = [];
            return false;
        }
    }

    async fetchConfig() {
        if (this.isCached && Object.keys(this.gameConfig).length > 0) {
            return true;
        }

        try {
            const ready = await configService.load();
            if (!ready) {
                debug('⚠️ configService.load() returned false, using fallback config', null, 'warn');
                this.gameConfig = this.getDefaultConfig();
                this.maxCodeLength = 4;
                this.isCached = true;
                return true;
            }

            this.gameConfig = configService.getForGame();
            this.maxCodeLength = this.gameConfig.max_code_length || 4;
            this.isCached = true;
            return true;
        } catch (error) {
            debug('⚠️ Error fetching config from configService, using defaults', error, 'warn');
            this.gameConfig = this.getDefaultConfig();
            this.maxCodeLength = 4;
            this.isCached = true;
            return true;
        }
    }

    getDefaultConfig() {
        return {
            round_duration: 90,
            total_rounds: 3,
            min_players: 1,
            max_players: 20,
            countdown_duration: 5,
            hurry_up_threshold: 10,
            max_words_per_player: 6,
            max_word_length: 30,
            max_code_length: 4
        };
    }

    async init() {
        try {
            await this.fetchConfig();
            await this.fetchCandidates();

            this.isFirstGame = !StorageManager.get(StorageKeys.HOST_GAME_CODE);

            this.isReady = true;
            debug('✅ CreateGameModal inicializado', { 
                candidatos: this.gameCandidates.length,
                isFirstGame: this.isFirstGame
            }, 'success');
        } catch (error) {
            this.isReady = false;
            debug('❌ Error inicializando CreateGameModal', error, 'error');
            throw error;
        }
    }

    async ensureReady() {
        if (this.isReady) return;
        if (!this.readyPromise) {
            this.readyPromise = this.init();
        }
        await this.readyPromise;
    }

    getCategories() {
        const categories = new Set();
        this.gameCandidates.forEach(c => categories.add(c.category));
        return Array.from(categories).sort();
    }

    getCandidateForCategory(category) {
        const matching = this.gameCandidates.filter(c => c.category === category);
        if (matching.length === 0) return null;
        return matching[Math.floor(Math.random() * matching.length)];
    }

    selectRandomCandidate() {
        if (this.gameCandidates.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * this.gameCandidates.length);
        this.selectedCandidate = { ...this.gameCandidates[randomIndex] };
        return this.selectedCandidate;
    }

    updateCandidateFromCategory(category) {
        const candidate = this.getCandidateForCategory(category);
        if (candidate) {
            this.selectedCandidate = { ...candidate };
        }
    }

    truncateCode(code) {
        return code.substring(0, this.maxCodeLength);
    }

    generateRandomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < this.maxCodeLength; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    async openModal() {
        try {
            await this.ensureReady();

            if (this.isFirstGame) {
                this.openFirstGameModal();
            } else {
                this.openNewGameModal();
            }
        } catch (error) {
            debug('Error abriendo modal de creación', error, 'error');
            showNotification('❌ Error cargando datos de partida', 'error');
        }
    }

    openFirstGameModal() {
        this.selectRandomCandidate();
        const categories = this.getCategories();
        const selectedCategory = this.selectedCandidate?.category || (categories[0] || 'General');
        let selectedCode = this.selectedCandidate?.code || '';
        
        if (!selectedCode) {
            selectedCode = this.generateRandomCode();
        }
        this.currentRoomCode = this.truncateCode(selectedCode);

        const categoryOptions = categories.length > 0
            ? categories.map(cat => 
                `<option value="${cat}" ${cat === selectedCategory ? 'selected' : ''}>${cat}</option>`
              ).join('')
            : `<option value="General" selected>General</option>`;

        const formHTML = `
            <div class="input-group">
                <label class="input-label" for="category-select-modal">Categoría</label>
                <select id="category-select-modal" class="input-field">
                    ${categoryOptions}
                </select>
            </div>
            <div class="input-group">
                <label class="input-label" for="code-input-modal">Código de Sala</label>
                <input 
                    id="code-input-modal" 
                    type="text" 
                    class="input-field" 
                    placeholder="Ej: SALA"
                    maxlength="${this.maxCodeLength}"
                    value="${this.currentRoomCode}"
                    autocomplete="off"
                />
                <p class="custom-code-info">Máx. ${this.maxCodeLength} caracteres. Solo letras y números.</p>
            </div>
        `;

        const buttons = [
            [
                () => this.openSettingsModal(),
                'Más Opciones',
                'btn'
            ],
            [
                () => this.handleCreateClick(),
                'Crear',
                'btn-modal-primary'
            ]
        ];

        ModalSystem_Instance.show(1, formHTML, buttons);

        const categorySelect = document.getElementById('category-select-modal');
        const codeInput = document.getElementById('code-input-modal');

        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                this.updateCandidateFromCategory(e.target.value);
                if (codeInput && this.selectedCandidate) {
                    const newCode = this.truncateCode(this.selectedCandidate.code);
                    codeInput.value = newCode;
                    this.currentRoomCode = newCode;
                }
            });
        }

        if (codeInput) {
            codeInput.addEventListener('input', (e) => {
                const sanitized = sanitizeInputValue(e.target.value);
                const truncated = this.truncateCode(sanitized);
                e.target.value = truncated;
                this.currentRoomCode = truncated;
            });
        }
    }

    openNewGameModal() {
        const currentCode = StorageManager.get(StorageKeys.HOST_GAME_CODE) || '';
        this.currentRoomCode = currentCode;

        const formHTML = `
            <div class="input-group">
                <label class="input-label" for="code-display-modal">Código de Sala</label>
                <div id="code-display-modal" class="input-field code-display" style="background: var(--color-secondary); padding: 12px; border-radius: 6px; font-weight: bold; letter-spacing: 2px; text-align: center; font-size: 18px;">
                    ${currentCode}
                </div>
                <p class="custom-code-info">Código de sala permanente. Los jugadores mantienen la conexión.</p>
            </div>
        `;

        const buttons = [
            [
                () => this.openSettingsModal(),
                'Más Opciones',
                'btn'
            ],
            [
                () => this.handleCreateClick(),
                'Nueva Partida',
                'btn-modal-primary'
            ]
        ];

        ModalSystem_Instance.show(1, formHTML, buttons);
    }

    openSettingsModal() {
        if (!window.settingsModal) {
            debug('⚠️ SettingsModal no está disponible', null, 'warn');
            return;
        }

        let config = null;
        if (window.configService && window.configService.getForGame()) {
            config = window.configService.getForGame();
        } else if (Object.keys(this.gameConfig).length > 0) {
            config = this.gameConfig;
        } else {
            config = this.getDefaultConfig();
        }

        window.settingsModal.openModal('creation', null, config);
    }

    async handleCreateClick() {
        try {
            if (!this.currentRoomCode || this.currentRoomCode.trim() === '') {
                showNotification('⚠️ Ingresa un código de sala válido', 'warning');
                return;
            }

            const gameId = this.currentRoomCode.trim();
            const category = this.selectedCandidate?.category || 'General';

            const payload = {
                action: 'create_game',
                game_id: gameId,
                category
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const url = new URL('./app/actions.php', window.location.href);
            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                if (result.message && result.message.includes('exists')) {
                    showNotification('🚫 Sala en uso - Intenta con otro código', 'error');
                } else {
                    showNotification('❌ ' + (result.message || 'Error creando partida'), 'error');
                }
                return;
            }

            if (!result.game_id) {
                throw new Error('Invalid response: missing game_id');
            }

            StorageManager.set(StorageKeys.HOST_GAME_CODE, result.game_id);
            StorageManager.set(StorageKeys.HOST_CATEGORY, category || 'General');

            showNotification('✅ Partida creada', 'success');

            await new Promise((r) => setTimeout(r, 500));

            window.location.reload();
        } catch (error) {
            debug('Error creando partida', error, 'error');
            
            if (error.name === 'AbortError') {
                showNotification('⚠️ Timeout: La solicitud tardó demasiado', 'error');
            } else {
                showNotification('❌ ' + (error.message || 'Error creando partida'), 'error');
            }
        }
    }
}

let createGameModal = null;

document.addEventListener('DOMContentLoaded', async () => {
    createGameModal = new CreateGameModal();
    window.createGameModal = createGameModal;
    
    try {
        await createGameModal.init();
    } catch (error) {
        debug('❌ Error inicializando CreateGameModal durante boot', error, 'error');
    }
}, { once: true });

console.log('%c✅ GameSetup.js', 'color: #0066FF; font-weight: bold; font-size: 12px');
