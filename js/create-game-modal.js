/**
 * Create Game Modal - Modal para crear nuevas partidas
 */

class CreateGameModal {
    constructor() {
        this.btnCreate = document.getElementById('btn-create-game');
        this.statusMessage = document.getElementById('status-message');

        this.gameCandidates = [];
        this.selectedCandidate = null;
        this.gameConfig = {};

        this.init();
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

            this.btnCreate.addEventListener('click', () => this.handleCreateClick());

            debug('✅ CreateGameModal inicializado', { candidatos: this.gameCandidates.length }, 'success');
        } catch (error) {
            debug('❌ Error inicializando CreateGameModal', error, 'error');
            this.showMessage('Error inicializando modal', 'error');
            this.btnCreate.disabled = true;
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

                if (categorySelect) {
                    categorySelect.addEventListener('change', (e) => {
                        this.updateCandidateFromCategory(e.target.value);
                        if (codeDisplay && this.selectedCandidate) {
                            codeDisplay.textContent = this.selectedCandidate.code;
                        }
                    });
                }
            }
        });
    }

    async handleCreateClick() {
        this.btnCreate.disabled = true;
        this.showMessage('Creando partida...', 'info');
        
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
                total_rounds: this.gameConfig.TOTAL_ROUNDS || 3,
                round_duration: this.gameConfig.round_duration || 60,
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

            hostSession.saveHostSession(result.game_id, category);

            this.showMessage('Partida creada. Inicializando...', 'success');

            await new Promise((r) => setTimeout(r, 500));

            ModalManager_Instance.closeAll();

            if (typeof determineUIState === 'function') {
                determineUIState();
            }
        } catch (error) {
            debug('Error creando partida', error, 'error');
            
            if (error.name === 'AbortError') {
                this.showMessage('Timeout: La solicitud tardó demasiado', 'error');
            } else {
                this.showMessage(error.message || 'Error creando partida', 'error');
            }
        } finally {
            this.btnCreate.disabled = false;
        }
    }

    showMessage(text, type = 'info') {
        if (this.statusMessage) {
            this.statusMessage.textContent = text;
            this.statusMessage.className = `status-message-modal status-${type}`;
            this.statusMessage.style.display = 'block';

            setTimeout(() => {
                this.statusMessage.style.display = 'none';
            }, 2000);
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new CreateGameModal());
} else {
    new CreateGameModal();
}

console.log('%c✅ create-game-modal.js', 'color: #0066FF; font-weight: bold; font-size: 12px');
