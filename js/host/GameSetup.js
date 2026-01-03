class CreateGameModal {
    constructor() {
        this.gameCandidates = [];
        this.selectedCandidate = null;
        this.gameConfig = {};
        this.readyPromise = null;
        this.isReady = false;
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
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success || !Array.isArray(result.candidates)) {
                throw new Error(result.message || 'Invalid response: missing candidates');
            }

            this.gameCandidates = result.candidates;
            return true;
        } catch (error) {
            debug('Error fetching game candidates', error, 'error');
            throw error;
        }
    }

    async fetchConfig() {
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

            this.gameConfig = result.config;
            return true;
        } catch (error) {
            debug('Error fetching game config', error, 'error');
            throw error;
        }
    }

    async init() {
        try {
            await this.fetchConfig();
            await this.fetchCandidates();

            if (this.gameCandidates.length === 0) {
                throw new Error('No hay candidatos disponibles');
            }

            this.isReady = true;
            debug('✅ CreateGameModal inicializado', { candidatos: this.gameCandidates.length }, 'success');
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

    async openModal() {
        try {
            await this.ensureReady();

            this.selectRandomCandidate();
            const categories = this.getCategories();
            const selectedCategory = this.selectedCandidate?.category || categories[0];
            const selectedCode = this.selectedCandidate?.code || '';

            const categoryOptions = categories.map(cat => 
                `<option value="${cat}" ${cat === selectedCategory ? 'selected' : ''}>${cat}</option>`
            ).join('');

            const formHTML = `
                <div class="input-group">
                    <label class="input-label" for="category-select-modal">Categoría</label>
                    <select id="category-select-modal" class="input-field">
                        ${categoryOptions}
                    </select>
                </div>
                <div class="input-group">
                    <label class="input-label" for="code-display-modal">Código de Sala</label>
                    <div id="code-display-modal" class="input-field code-display" style="background: var(--color-secondary); padding: 12px; border-radius: 6px; font-weight: bold; letter-spacing: 2px; text-align: center; font-size: 18px;">
                        ${selectedCode}
                    </div>
                    <p class="custom-code-info">Código generado automáticamente por el servidor</p>
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
            const codeDisplay = document.getElementById('code-display-modal');

            if (categorySelect) {
                categorySelect.addEventListener('change', (e) => {
                    this.updateCandidateFromCategory(e.target.value);
                    if (codeDisplay && this.selectedCandidate) {
                        codeDisplay.textContent = this.selectedCandidate.code;
                    }
                });
            }
        } catch (error) {
            debug('Error abriendo modal de creación', error, 'error');
            showNotification('❌ Error cargando datos de partida', 'error');
        }
    }

    openSettingsModal() {
        if (window.settingsModal) {
            window.settingsModal.openModal('creation');
        } else {
            debug('⚠️ SettingsModal no está disponible', null, 'warn');
        }
    }

    async handleCreateClick() {
        try {
            if (!this.selectedCandidate || !this.selectedCandidate.code) {
                throw new Error('No hay código seleccionado');
            }

            const gameId = this.selectedCandidate.code;
            const category = this.selectedCandidate.category;

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
            
            if (!result.success || !result.game_id) {
                throw new Error(result.message || 'Invalid response: missing game_id');
            }

            StorageManager.set(StorageKeys.HOST_GAME_CODE, result.game_id);
            StorageManager.set(StorageKeys.HOST_CATEGORY, category);

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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        createGameModal = new CreateGameModal();
        window.createGameModal = createGameModal;
        
        try {
            await createGameModal.init();
        } catch (error) {
            debug('❌ Error inicializando CreateGameModal durante boot', error, 'error');
        }
    });
} else {
    (async () => {
        createGameModal = new CreateGameModal();
        window.createGameModal = createGameModal;
        
        try {
            await createGameModal.init();
        } catch (error) {
            debug('❌ Error inicializando CreateGameModal durante boot', error, 'error');
        }
    })();
}

console.log('%c✅ GameSetup.js', 'color: #0066FF; font-weight: bold; font-size: 12px');