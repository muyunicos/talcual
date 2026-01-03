/**
 * Create Game Modal - Modal para crear nuevas partidas
 */

class CreateGameModal {
    constructor() {
        this.gameCandidates = [];
        this.selectedCandidate = null;
        this.gameConfig = {};
        this.userRounds = 3;
        this.userDuration = 90;
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
            this.userRounds = this.gameConfig.TOTAL_ROUNDS || 3;
            this.userDuration = this.gameConfig.round_duration || 90;
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

            debug('✅ CreateGameModal inicializado', { candidatos: this.gameCandidates.length }, 'success');
        } catch (error) {
            debug('❌ Error inicializando CreateGameModal', error, 'error');
            throw error;
        }
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

    openModal() {
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
            
            <div style="border-top: 1px solid var(--color-border); margin-top: 16px; padding-top: 16px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--color-text-secondary);">⚙️ Configuración</h4>
                
                <div class="input-group">
                    <label class="input-label" for="rounds-select-modal">Rondas</label>
                    <select id="rounds-select-modal" class="input-field">
                        <option value="1" ${this.userRounds === 1 ? 'selected' : ''}>1 ronda</option>
                        <option value="2" ${this.userRounds === 2 ? 'selected' : ''}>2 rondas</option>
                        <option value="3" ${this.userRounds === 3 ? 'selected' : ''}>3 rondas</option>
                        <option value="4" ${this.userRounds === 4 ? 'selected' : ''}>4 rondas</option>
                        <option value="5" ${this.userRounds === 5 ? 'selected' : ''}>5 rondas</option>
                        <option value="6" ${this.userRounds === 6 ? 'selected' : ''}>6 rondas</option>
                        <option value="7" ${this.userRounds === 7 ? 'selected' : ''}>7 rondas</option>
                        <option value="8" ${this.userRounds === 8 ? 'selected' : ''}>8 rondas</option>
                        <option value="9" ${this.userRounds === 9 ? 'selected' : ''}>9 rondas</option>
                        <option value="10" ${this.userRounds === 10 ? 'selected' : ''}>10 rondas</option>
                    </select>
                </div>

                <div class="input-group">
                    <label class="input-label" for="duration-select-modal">Duración por Ronda</label>
                    <select id="duration-select-modal" class="input-field">
                        <option value="30" ${this.userDuration === 30 ? 'selected' : ''}>30 segundos</option>
                        <option value="45" ${this.userDuration === 45 ? 'selected' : ''}>45 segundos</option>
                        <option value="60" ${this.userDuration === 60 ? 'selected' : ''}>1 minuto</option>
                        <option value="75" ${this.userDuration === 75 ? 'selected' : ''}>1m 15s</option>
                        <option value="90" ${this.userDuration === 90 ? 'selected' : ''}>1m 30s</option>
                        <option value="120" ${this.userDuration === 120 ? 'selected' : ''}>2 minutos</option>
                        <option value="150" ${this.userDuration === 150 ? 'selected' : ''}>2m 30s</option>
                        <option value="180" ${this.userDuration === 180 ? 'selected' : ''}>3 minutos</option>
                        <option value="240" ${this.userDuration === 240 ? 'selected' : ''}>4 minutos</option>
                        <option value="300" ${this.userDuration === 300 ? 'selected' : ''}>5 minutos</option>
                    </select>
                </div>
            </div>
        `;

        ModalManager_Instance.show({
            type: ModalManager_Instance.TYPES.SECONDARY,
            title: '🎮 Crear Nueva Partida',
            content: formHTML,
            buttons: [
                {
                    label: 'Crear',
                    class: 'btn-modal-primary',
                    action: () => this.handleCreateClick(),
                    close: false
                },
                {
                    label: 'Cancelar',
                    class: 'btn',
                    action: null,
                    close: true
                }
            ],
            onDismiss: () => {
                debug('Modal cerrado por el usuario', null, 'info');
            },
            onOpen: () => {
                const categorySelect = document.getElementById('category-select-modal');
                const codeDisplay = document.getElementById('code-display-modal');
                const roundsSelect = document.getElementById('rounds-select-modal');
                const durationSelect = document.getElementById('duration-select-modal');

                if (categorySelect) {
                    categorySelect.addEventListener('change', (e) => {
                        this.updateCandidateFromCategory(e.target.value);
                        if (codeDisplay && this.selectedCandidate) {
                            codeDisplay.textContent = this.selectedCandidate.code;
                        }
                    });
                }

                if (roundsSelect) {
                    roundsSelect.addEventListener('change', (e) => {
                        this.userRounds = parseInt(e.target.value, 10);
                    });
                }

                if (durationSelect) {
                    durationSelect.addEventListener('change', (e) => {
                        this.userDuration = parseInt(e.target.value, 10);
                    });
                }
            }
        });
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
                category,
                total_rounds: this.userRounds,
                round_duration: this.userDuration,
                min_players: this.gameConfig.min_players || 2
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

            ModalManager_Instance.closeAll();

            if (typeof determineUIState === 'function') {
                determineUIState();
            }
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
        await createGameModal.init();
        window.createGameModal = createGameModal;
    });
} else {
    (async () => {
        createGameModal = new CreateGameModal();
        await createGameModal.init();
        window.createGameModal = createGameModal;
    })();
}

console.log('%c✅ create-game-modal.js', 'color: #0066FF; font-weight: bold; font-size: 12px');