class CreateGameModal {
    constructor() {
        this.modalElement = document.getElementById('modal-create-game');
        this.btnCreate = document.getElementById('btn-create-game');
        this.categorySelect = document.getElementById('category-select');
        this.customCodeInput = document.getElementById('custom-code');
        this.statusMessage = document.getElementById('status-message');

        this.dictionary = null;
        this.categories = [];

        this.init();
    }

    async init() {
        await this.loadDictionary();

        this.populateCategorySelect(this.categories);

        this.btnCreate.addEventListener('click', () => this.handleCreateClick());
        this.categorySelect.addEventListener('change', () => this.updateCodeWithCategoryWord());

        this.customCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.trim().toUpperCase().slice(0, 5);
        });

        this.selectRandomCategory();
    }

    async loadDictionary() {
        const url = new URL('./app/diccionario.json', window.location.href);
        const response = await fetch(url.toString(), { cache: 'no-store' });
        this.dictionary = await response.json();
        this.categories = Object.keys(this.dictionary).sort((a, b) => a.localeCompare(b, 'es'));
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
        const randomIndex = Math.floor(Math.random() * this.categories.length);
        this.categorySelect.value = this.categories[randomIndex];
        this.updateCodeWithCategoryWord();
    }

    extractWordsForCategory(category) {
        const categoryData = this.dictionary[category]; // Array de objetos: { CONSIGNA: [tips...] }
        const words = [];

        for (const consignaObj of categoryData) {
            for (const tips of Object.values(consignaObj)) {
                for (const tip of tips) {
                    for (const part of tip.split('|')) {
                        words.push(part.trim());
                    }
                }
            }
        }

        return words;
    }

    getValidWordsForCategory(category) {
        return this.extractWordsForCategory(category)
            .map((w) => w.trim().toUpperCase())
            .filter(Boolean)
            .filter((w) => w.length >= 3 && w.length <= 5)
            .filter((w) => /^[A-ZÁÉÍÓÚÑ]+$/.test(w));
    }

    getRandomWord(category) {
        const validWords = this.getValidWordsForCategory(category);
        return validWords[Math.floor(Math.random() * validWords.length)];
    }

    updateCodeWithCategoryWord() {
        const selectedCategory = this.categorySelect.value;
        const code = this.getRandomWord(selectedCategory).slice(0, 5);
        this.customCodeInput.value = code;
    }

    async handleCreateClick() {
        this.btnCreate.disabled = true;

        this.showMessage('🔄 Creando partida...', 'info');

        const category = this.categorySelect.value;
        const customCode = this.customCodeInput.value.trim().toUpperCase() || null;

        const payload = {
            action: 'create_game',
            game_id: customCode,
            category,
            total_rounds: 3,
            round_duration: 60,
            min_players: 2
        };

        const url = new URL('./app/actions.php', window.location.href);
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        const gameId = result.game_id;

        StorageManager.set(StorageKeys.HOST_GAME_CODE, gameId);
        StorageManager.set(StorageKeys.GAME_ID, gameId);
        StorageManager.set(StorageKeys.IS_HOST, 'true');
        StorageManager.set(StorageKeys.GAME_CATEGORY, category);

        this.showMessage('✅ Partida creada. Inicializando...', 'success');

        await new Promise((r) => setTimeout(r, 500));

        // FASE 2: Usar determineUIState() centralizado
        // Esta función maneja toda la lógica de mostrar/ocultar UI basándose en sesión
        // Garantiza que la pantalla de juego se muestre correctamente
        if (typeof determineUIState === 'function') {
            determineUIState();
            console.log('✅ determineUIState() ejecutado - UI renderizada');
        } else {
            console.warn('⚠️  determineUIState() no disponible, fallback a ocultacion manual');
            this.modalElement.style.display = 'none';
            // Mostrar elementos del juego
            const gameScreen = document.getElementById('game-screen');
            if (gameScreen) gameScreen.style.display = '';
        }

        setTimeout(() => {
            initHostManager();
        }, 100);

        this.btnCreate.disabled = false;
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

console.log('%c✅ create-game-modal.js - Usa determineUIState() centralizado', 'color: #10B981; font-weight: bold');
