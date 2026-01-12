class CreateGameModal {
    constructor() {
        this.gameCandidates = [];
        this.selectedCandidate = null;
        this.gameConfig = {};
        this.readyPromise = null;
        this.isReady = false;
        this.currentRoomCode = null;
        this.isFirstGame = true;
        this.maxCodeLength = 6;
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
        if (this.isCached && configManager.isInitialized()) {
            this.gameConfig = configManager.getAll();
            this.maxCodeLength = this.gameConfig.max_code_length || 6;
            return true;
        }

        try {
            const ready = await configManager.initialize();
            if (!ready) {
                debug('⚠️ configManager.initialize() returned false, using defaults', null, 'warn');
                this.gameConfig = configManager.getAll();
                this.maxCodeLength = configManager.get('max_code_length', 6);
                this.isCached = true;
                return true;
            }

            this.gameConfig = configManager.getAll();
            this.maxCodeLength = this.gameConfig.max_code_length || 6;
            this.isCached = true;
            return true;
        } catch (error) {
            debug('⚠️ Error fetching config from configManager, using fallback', error, 'warn');
            this.gameConfig = configManager.getAll();
            this.maxCodeLength = this.gameConfig.max_code_length || 6;
            this.isCached = true;
            return true;
        }
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

        window.settingsModal.openModal();
    }

    async handleCreateClick() {
        try {
            if (!this.currentRoomCode || this.currentRoomCode.trim() === '') {
                showNotification('⚠️ Ingresa un código de sala válido', 'warning');
                return;
            }

            const gameId = this.currentRoomCode.trim();
            const category = this.selectedCandidate?.category || 'General';
            const config = configManager.getAll();

            const payload = {
                action: 'create_game',
                game_id: gameId,
                category,
                config
            };

            debug('🎮 Payload for create_game:', payload, 'debug');

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

            await this.transitionToGameScreen(result);
        } catch (error) {
            debug('Error creando partida', error, 'error');
            
            if (error.name === 'AbortError') {
                showNotification('⚠️ Timeout: La solicitud tardó demasiado', 'error');
            } else {
                showNotification('❌ ' + (error.message || 'Error creando partida'), 'error');
            }
        }
    }

    async transitionToGameScreen(createResult) {
        try {
            debug('🔄 Transicionando a pantalla de juego sin reload...', null, 'info');

            ModalSystem_Instance.close(1);

            if (!window.hostManager) {
                window.hostManager = new HostManager();
            }

            const gameCode = createResult.game_id;
            const gameState = createResult.state || {};

            window.hostManager.gameCode = gameCode;
            window.hostManager.currentCategory = gameState.current_category || 'Sin categoría';
            window.hostManager.currentRound = gameState.round || 0;

            if (!window.hostManager.client) {
                window.hostManager.client = new GameClient(gameCode, gameCode, 'host');
            } else {
                window.hostManager.client.disconnect();
                window.hostManager.client = new GameClient(gameCode, gameCode, 'host');
            }

            window.hostManager.saveSession(gameCode, gameState.current_category || 'General');
            window.hostManager.loadGameScreen(gameState);

            debug('✅ Transición completada sin reload', { gameCode }, 'success');
        } catch (error) {
            debug('❌ Error en transitionToGameScreen, reloadando...', error, 'error');
            window.location.reload();
        }
    }
}

let createGameModal = null;

console.log('%c✅ GameSetup.js', 'color: #0066FF; font-weight: bold; font-size: 12px');