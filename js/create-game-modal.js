/**
 * Create Game Modal - Modal para crear nuevas partidas
 * Maneja: UI para crear partida
 * 
 * ✅ REFACTORIZADO FASE 1:
 * - Usa ModalManager_Instance para gestión centralizada de modales
 * - Usa DictionaryService para carga de categorías
 * - Usa ConfigService para configuración
 * - SOLO responsable de UI
 */

class CreateGameModal {
    constructor() {
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

    openModal() {
        this.selectRandomCategory();
        this.customCodeInput.value = '';
        this.statusMessage.style.display = 'none';

        const formHTML = `
            <div class="input-group">
                <label class="input-label" for="category-select">Categoría</label>
                <select id="category-select" class="input-field">
                    ${this.categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                </select>
            </div>
            <div class="input-group">
                <label class="input-label" for="custom-code">Código personalizado (opcional)</label>
                <input type="text" id="custom-code" class="input-field" placeholder="Máx. 5 caracteres" maxlength="5">
                <p class="custom-code-info">Si no completas, se generará automáticamente</p>
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
            }
        });
    }

    populateCategorySelect(categories) {
        // Ya no necesario si el select se genera dinámicamente
        // Pero se mantiene por compatibilidad
    }

    selectRandomCategory() {
        if (this.categories.length === 0) return;
        const randomIndex = Math.floor(Math.random() * this.categories.length);
        const selectedCategory = this.categories[randomIndex];
        return selectedCategory;
    }

    async updateCodeWithCategoryWord() {
        try {
            const randomWord = await dictionaryService.getRandomWord();
            if (randomWord) {
                return randomWord.slice(0, 5);
            }
        } catch (error) {
            debug('Error obteniendo palabra para categoría', error, 'warn');
        }
    }

    async handleCreateClick() {
        this.btnCreate.disabled = true;
        this.showMessage('Creando partida...', 'info');
        
        try {
            const categorySelect = document.getElementById('category-select');
            const customCodeInput = document.getElementById('custom-code');
            
            const category = categorySelect?.value || this.selectRandomCategory();
            const customCode = (customCodeInput?.value || '').trim().toUpperCase() || null;

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

            ModalManager_Instance.closeAll();

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

console.log('%c✅ create-game-modal.js - REFACTORIZADO FASE 1: Usa ModalManager_Instance', 'color: #0066FF; font-weight: bold; font-size: 12px');