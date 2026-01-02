/**
 * Create Game Modal - Modal para crear nuevas partidas
 * Maneja: UI para crear partida
 * 
 * ✅ REFACTORIZADO FASE 3C:
 * - Usa ModalController para gestión centralizada de modales
 * - Usa DictionaryService para carga de categorías
 * - Usa ConfigService para configuración
 * - SOLO responsable de UI
 */

class CreateGameModal {
    constructor() {
        this.modalController = null;
        this.btnCreate = document.getElementById('btn-create-game');
        this.categorySelect = document.getElementById('category-select');
        this.customCodeInput = document.getElementById('custom-code');
        this.statusMessage = document.getElementById('status-message');

        this.categories = [];
        this.categoryWordsMap = {};

        this.init();
    }

    async init() {
        try {
            this.modalController = new ModalController('modal-create-game', {
                closeOnBackdrop: true,
                closeOnEsc: true,
                onBeforeOpen: () => {
                    this.selectRandomCategory();
                    this.customCodeInput.value = '';
                    this.statusMessage.style.display = 'none';
                }
            });

            await dictionaryService.initialize();
            await configService.load();

            this.categories = await dictionaryService.getCategories();
            this.populateCategorySelect(this.categories);

            this.btnCreate.addEventListener('click', () => this.handleCreateClick());
            this.categorySelect.addEventListener('change', () => this.updateCodeWithCategoryWord());

            this.customCodeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.trim().toUpperCase().slice(0, 5);
            });

            this.selectRandomCategory();
            debug('✅ CreateGameModal inicializado', null, 'success');
        } catch (error) {
            debug('❌ Error inicializando CreateGameModal', error, 'error');
            this.showMessage('Error inicializando modal', 'error');
            this.btnCreate.disabled = true;
        }
    }

    populateCategorySelect(categories) {
        this.categorySelect.innerHTML = '';
        categories.forEach((cat) => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            this.categorySelect.appendChild(option);
        });
    }

    selectRandomCategory() {
        if (this.categories.length === 0) return;
        
        const randomIndex = Math.floor(Math.random() * this.categories.length);
        this.categorySelect.value = this.categories[randomIndex];
        this.updateCodeWithCategoryWord();
    }

    async updateCodeWithCategoryWord() {
        const selectedCategory = this.categorySelect.value;
        
        try {
            const randomWord = await dictionaryService.getRandomWord();
            
            if (randomWord) {
                this.customCodeInput.value = randomWord.slice(0, 5);
            }
        } catch (error) {
            debug('Error obteniendo palabra para categoría', error, 'warn');
        }
    }

    async handleCreateClick() {
        this.btnCreate.disabled = true;
        this.showMessage('Creando partida...', 'info');
        
        try {
            const category = this.categorySelect.value;
            const customCode = this.customCodeInput.value.trim().toUpperCase() || null;

            const payload = {
                action: 'create_game',
                game_id: customCode,
                category,
                total_rounds: configService.get('TOTAL_ROUNDS', 3),
                round_duration: configService.get('ROUND_DURATION', 60),
                min_players: configService.get('min_players', 2)
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
            
            if (!result || !result.game_id) {
                throw new Error('Invalid response: missing game_id');
            }

            const gameId = result.game_id;

            StorageManager.set(StorageKeys.HOST_GAME_CODE, gameId);
            StorageManager.set(StorageKeys.GAME_ID, gameId);
            StorageManager.set(StorageKeys.IS_HOST, 'true');
            StorageManager.set(StorageKeys.GAME_CATEGORY, category);

            this.showMessage('Partida creada. Inicializando...', 'success');

            await new Promise((r) => setTimeout(r, 500));

            if (typeof determineUIState === 'function') {
                determineUIState();
            }
        } catch (error) {
            debug('Error creando partida', error, 'error');
            
            if (error.name === 'AbortError') {
                this.showMessage('Timeout: La solicitud tardó demasiado', 'error');
            } else {
                this.showMessage('Error creando partida', 'error');
            }
        } finally {
            this.btnCreate.disabled = false;
        }
    }

    showMessage(text, type = 'info') {
        this.statusMessage.textContent = text;
        this.statusMessage.className = `status-message-modal status-${type}`;
        this.statusMessage.style.display = 'block';

        setTimeout(() => {
            this.statusMessage.style.display = 'none';
        }, 2000);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new CreateGameModal());
} else {
    new CreateGameModal();
}

console.log('%c✅ create-game-modal.js - REFACTORIZADO FASE 3C: Usa ModalController', 'color: #0066FF; font-weight: bold; font-size: 12px');