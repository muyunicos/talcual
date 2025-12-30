/**
 * Host Create Game Modal Handler - Enhanced v2
 * Maneja la creación de partidas desde el modal en host.html
 * 
 * MEJORAS v2 (29 Dic 2025):
 * - Al abrir modal: categoría seleccionada al azar automáticamente
 * - Eliminada vista previa de categoría/palabra
 * - Código sala muestra palabra aleatoria de categoría elegida
 * - Si se borra: muestra "se generará automáticamente"
 * - Categoría elegida persistente durante todas las rondas
 * - Consignas no se repiten (descartadas hasta agotar, luego reset)
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
        
        // Ocultar elementos del game screen
        this.hideGameElements();
        
        // Eventos
        this.btnCreate.addEventListener('click', () => this.handleCreateClick());
        
        // FIX: Evento de categoría para actualizar código con palabra de categoría
        this.categorySelect.addEventListener('change', () => this.updateCodeWithCategoryWord());
        
        // FIX: Evento de input para detectar borrado
        this.customCodeInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (value === '') {
                e.target.placeholder = 'se generará automáticamente';
            } else {
                e.target.value = value.toUpperCase();
            }
        });
        
        // FIX: Seleccionar categoría aleatoria automáticamente
        this.selectRandomCategory();
        
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
            this.categories = ['GENERAL', 'DEPORTES', 'MÚSICA'];
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
        
        // FIX: SIN opción vacía, directamente las categorías
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            this.categorySelect.appendChild(option);
        });
    }
    
    // FIX: Seleccionar categoría aleatoria automáticamente
    selectRandomCategory() {
        if (this.categories.length === 0) return;
        
        const randomIndex = Math.floor(Math.random() * this.categories.length);
        const randomCategory = this.categories[randomIndex];
        
        this.categorySelect.value = randomCategory;
        console.log('🎲 Categoría seleccionada automáticamente:', randomCategory);
        
        // Actualizar código con palabra de esta categoría
        this.updateCodeWithCategoryWord();
    }
    
    // FIX: Actualizar código con palabra de categoría
    updateCodeWithCategoryWord() {
        const selectedCategory = this.categorySelect.value;
        if (!selectedCategory) return;
        
        const randomWord = this.getRandomWord(selectedCategory);
        this.customCodeInput.value = randomWord.toUpperCase().substring(0, 5); // Máx 5 letras
        this.customCodeInput.placeholder = 'se generará automáticamente';
        
        console.log(`📝 Código actualizado con palabra de ${selectedCategory}: ${randomWord}`);
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
            
            // FIX: Guardar categoría para persistencia
            localStorage.setItem('gameCategory', category);
            console.log('📋 Código y categoría guardados:', gameId, category);
            
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

console.log('%c✅ CreateGameModal Enhanced v2 - Categoría automática, código como palabra', 'color: #10B981; font-weight: bold');