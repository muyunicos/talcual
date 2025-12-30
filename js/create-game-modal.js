/**
 * Host Create Game Modal Handler - Enhanced
 * Maneja la creación de partidas desde el modal en host.html
 * 
 * MEJORAS:
 * - Muestra categoría + palabra aleatoria en el modal
 * - Acceso a opciones avanzadas (hamburguesa)
 * - Al crear: anima entrada de elementos del game screen
 * - Oculta elementos innecesarios mientras el modal está abierto
 */

class CreateGameModal {
    constructor() {
        this.modalElement = document.getElementById('modal-create-game');
        this.btnCreate = document.getElementById('btn-create-game');
        this.categorySelect = document.getElementById('category-select');
        this.customCodeInput = document.getElementById('custom-code');
        this.statusMessage = document.getElementById('status-message');
        
        // Elementos a ocultar mientras el modal está abierto
        this.gameElements = {
            codeSticker: document.getElementById('code-sticker-floating'),
            tvHeader: document.querySelector('.tv-header'),
            sidepanel: document.getElementById('floating-side-panel'),
            playersContainer: document.getElementById('players-container')
        };
        
        // Elementos para mostrar preview de categoría
        this.categoryPreview = null;
        this.wordPreview = null;
        
        this.categories = [];
        this.dictionary = null;
        this.isCreating = false;
        
        if (!this.modalElement || !this.btnCreate) {
            console.warn('⚠️ CreateGameModal: elementos no encontrados');
            return;
        }
        
        this.init();
    }
    
    async init() {
        console.log('🎮 CreateGameModal inicializando...');
        
        // Cargar diccionario
        await this.loadDictionary();
        
        // Crear previsualización de categoría en el modal
        this.createCategoryPreview();
        
        // Ocultar elementos del game screen
        this.hideGameElements();
        
        // Eventos
        this.btnCreate.addEventListener('click', () => this.handleCreateClick());
        this.categorySelect.addEventListener('change', () => this.updatePreview());
        this.customCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
        
        // Inicializar preview con categoría aleatoria
        this.updatePreview();
        
        console.log('✅ CreateGameModal listo');
    }
    
    async loadDictionary() {
        try {
            console.log('📄 Cargando diccionario...');
            
            const response = await fetch('/app/diccionario.json');
            if (!response.ok) throw new Error('No se pudo cargar diccionario');
            
            this.dictionary = await response.json();
            const categories = this.extractCategories(this.dictionary);
            
            if (categories.length === 0) {
                console.warn('⚠️ No se encontraron categorías, usando defecto');
                categories.push('GENERAL');
            }
            
            this.categories = categories;
            console.log(`✅ ${categories.length} categorías cargadas:`, categories);
            this.populateCategorySelect(categories);
            
        } catch (error) {
            console.error('❌ Error cargando diccionario:', error);
            this.categories = ['GENERAL', 'DEPORTES', 'MÚUSICA'];
            this.populateCategorySelect(this.categories);
        }
    }
    
    extractCategories(data) {
        const categories = [];
        
        if (data.categorias && typeof data.categorias === 'object') {
            categories.push(...Object.keys(data.categorias));
            return categories;
        }
        
        for (const [key, value] of Object.entries(data)) {
            if (Array.isArray(value) && key !== 'categorias') {
                categories.push(key);
            }
        }
        
        return categories.sort();
    }
    
    extractWordsForCategory(category) {
        if (!this.dictionary) return [];
        
        const words = [];
        
        // Legacy format
        if (this.dictionary.categorias && this.dictionary.categorias[category]) {
            return this.dictionary.categorias[category];
        }
        
        // New format
        if (this.dictionary[category]) {
            const items = this.dictionary[category];
            if (Array.isArray(items)) {
                items.forEach(item => {
                    if (typeof item === 'object') {
                        Object.keys(item).forEach(word => {
                            if (word && word !== '') words.push(word);
                        });
                    }
                });
            }
        }
        
        return words;
    }
    
    getRandomWord(category) {
        const words = this.extractWordsForCategory(category || this.categories[0]);
        if (words.length === 0) return 'JUEGO';
        return words[Math.floor(Math.random() * words.length)];
    }
    
    populateCategorySelect(categories) {
        this.categorySelect.innerHTML = '';
        
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '🎲 Categoría Aleatoria';
        emptyOption.selected = true;
        this.categorySelect.appendChild(emptyOption);
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            this.categorySelect.appendChild(option);
        });
    }
    
    createCategoryPreview() {
        // Buscar si ya existe
        if (document.getElementById('category-preview-section')) return;
        
        const previewSection = document.createElement('div');
        previewSection.id = 'category-preview-section';
        previewSection.style.cssText = `
            margin: 1.5rem 0;
            padding: 1rem;
            background: linear-gradient(135deg, rgba(50, 184, 198, 0.1) 0%, rgba(45, 166, 178, 0.05) 100%);
            border-radius: 12px;
            border: 2px solid var(--color-primary, #2186 8D);
            text-align: center;
        `;
        
        previewSection.innerHTML = `
            <div style="font-size: 0.9rem; color: var(--color-text-secondary, #626C70); margin-bottom: 0.5rem;">
                🌠 Vista Previa
            </div>
            <div id="category-preview" style="font-weight: 600; font-size: 1.2rem; color: var(--color-primary, #2186 8D); margin-bottom: 0.5rem;">
                CATEGORÍA
            </div>
            <div id="word-preview" style="font-size: 1.5rem; font-weight: bold; color: var(--color-text, #134252); font-style: italic;">
                palabra
            </div>
        `;
        
        // Insertar después del select de categoría
        this.categorySelect.parentElement.insertAdjacentElement('afterend', previewSection);
        
        this.categoryPreview = document.getElementById('category-preview');
        this.wordPreview = document.getElementById('word-preview');
    }
    
    updatePreview() {
        if (!this.categoryPreview || !this.wordPreview) return;
        
        const selectedCategory = this.categorySelect.value || this.categories[Math.floor(Math.random() * this.categories.length)];
        const randomWord = this.getRandomWord(selectedCategory);
        
        this.categoryPreview.textContent = selectedCategory || 'ALEATORIO';
        this.wordPreview.textContent = randomWord;
    }
    
    hideGameElements() {
        Object.values(this.gameElements).forEach(el => {
            if (el) el.style.display = 'none';
        });
    }
    
    showGameElements() {
        const elementsToShow = [
            { el: this.gameElements.codeSticker, delay: 0 },
            { el: this.gameElements.tvHeader, delay: 150 },
            { el: this.gameElements.playersContainer, delay: 300 },
            { el: this.gameElements.sidepanel, delay: 450 }
        ];
        
        elementsToShow.forEach(({ el, delay }) => {
            if (!el) return;
            
            setTimeout(() => {
                el.style.display = '';
                el.style.opacity = '0';
                el.style.animation = 'fadeInUp 0.5s ease-out forwards';
            }, delay);
        });
    }
    
    async handleCreateClick() {
        if (this.isCreating) return;
        
        this.isCreating = true;
        this.btnCreate.disabled = true;
        
        const customCode = this.customCodeInput.value.trim() || null;
        const category = this.categorySelect.value || null;
        
        try {
            this.showMessage('🔄 Creando partida...', 'info');
            
            const payload = {
                action: 'create_game',
                game_id: customCode,
                category: category,
                total_rounds: 3,
                round_duration: 60,
                min_players: 2
            };
            
            console.log('📤 Enviando:', payload);
            
            const response = await fetch('/app/actions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📥 Respuesta:', result);
            
            if (!result.success) {
                throw new Error(result.message || 'Error desconocido');
            }
            
            const gameId = result.game_id;
            console.log('✅ Juego creado:', gameId);
            
            // Guardar en localStorage
            localStorage.setItem('hostGameCode', gameId);
            localStorage.setItem('gameId', gameId);
            localStorage.setItem('isHost', 'true');
            console.log('📋 Código guardado en localStorage:', gameId);
            
            this.showMessage('✅ Partida creada. Inicializando...', 'success');
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Cerrar modal
            this.modalElement.style.display = 'none';
            
            // Mostrar elementos con animación
            this.showGameElements();
            
            // Re-inicializar HostManager
            console.log('🎮 Re-inicializando HostManager...');
            setTimeout(() => {
                initHostManager();
            }, 100);
            
        } catch (error) {
            console.error('❌ Error:', error);
            this.showMessage('❌ ' + error.message, 'error');
            
        } finally {
            this.isCreating = false;
            this.btnCreate.disabled = false;
        }
    }
    
    showMessage(text, type = 'info') {
        if (!this.statusMessage) return;
        
        this.statusMessage.textContent = text;
        this.statusMessage.className = `status-message-modal status-${type}`;
        this.statusMessage.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => {
                this.statusMessage.style.display = 'none';
            }, 2000);
        }
    }
}

// ===== INIT =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new CreateGameModal();
    });
} else {
    new CreateGameModal();
}

console.log('%c✅ CreateGameModal Enhanced', 'color: #10B981; font-weight: bold');
