/**
 * Enhanced Create Game Modal
 * - Muestra categoría y palabra aleatoria
 * - Oculta elementos innecesarios mientras está abierto
 * - Anima los elementos cuando se abre
 */

class EnhancedCreateGameModal {
    constructor() {
        this.modal = document.getElementById('modal-create-game');
        this.categorySelect = document.getElementById('category-select');
        this.customCodeInput = document.getElementById('custom-code');
        this.btnCreate = document.getElementById('btn-create-game');
        this.statusMessage = document.getElementById('status-message');
        
        // Elementos a ocultar cuando el modal está abierto
        this.hiddenElements = [
            'code-sticker-floating',
            'tv-header',
            'floating-side-panel',
            'players-container',
            'results-overlay'
        ];
        
        this.categories = [];
        this.dictionary = {};
        this.isOpen = false;
        
        if (!this.modal || !this.categorySelect) {
            console.warn('⚠️ EnhancedCreateGameModal: elementos faltantes');
            return;
        }
        
        this.init();
    }
    
    async init() {
        console.log('📋 EnhancedCreateGameModal inicializando...');
        
        // Cargar diccionario y categorías
        await this.loadDictionary();
        
        // Llenar select de categorías
        this.populateCategories();
        
        // Event listeners
        this.attachEventListeners();
        
        // Mostrar modal si no hay código
        const code = localStorage.getItem('hostGameCode') || new URL(window.location).searchParams.get('code');
        if (!code) {
            this.show();
        }
        
        console.log('✅ EnhancedCreateGameModal listo');
    }
    
    async loadDictionary() {
        try {
            const response = await fetch('/dictionary.json');
            if (!response.ok) throw new Error('No se pudo cargar el diccionario');
            this.dictionary = await response.json();
            this.categories = Object.keys(this.dictionary);
            console.log('📚 Diccionario cargado:', this.categories.length, 'categorías');
        } catch (error) {
            console.error('❌ Error cargando diccionario:', error);
        }
    }
    
    populateCategories() {
        if (this.categories.length === 0) {
            this.categorySelect.innerHTML = '<option>No hay categorías disponibles</option>';
            return;
        }
        
        this.categorySelect.innerHTML = this.categories
            .map(cat => `<option value="${cat}">${cat}</option>`)
            .join('');
        
        // Seleccionar categoría aleatoria
        this.selectRandomCategory();
        
        console.log('✅ Categorías pobladas');
    }
    
    selectRandomCategory() {
        if (this.categories.length === 0) return;
        
        const randomCategory = this.categories[Math.floor(Math.random() * this.categories.length)];
        this.categorySelect.value = randomCategory;
        this.displayRandomWord();
    }
    
    displayRandomWord() {
        const selectedCategory = this.categorySelect.value;
        const words = this.dictionary[selectedCategory] || [];
        
        if (words.length === 0) {
            console.warn('⚠️ No hay palabras para la categoría:', selectedCategory);
            return;
        }
        
        const randomWord = words[Math.floor(Math.random() * words.length)];
        
        // Mostrar palabra aleatoria en un elemento especial
        let wordDisplay = document.getElementById('random-word-display');
        if (!wordDisplay) {
            wordDisplay = document.createElement('div');
            wordDisplay.id = 'random-word-display';
            wordDisplay.style.cssText = `
                margin-top: 1rem;
                padding: 1rem;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 8px;
                text-align: center;
                font-weight: 600;
                font-size: 1.2rem;
                animation: slideDown 0.4s ease-out;
            `;
            this.categorySelect.parentElement.after(wordDisplay);
        }
        
        wordDisplay.textContent = `📝 Palabra: "${randomWord}"`;
        console.log('📝 Palabra aleatoria:', randomWord);
    }
    
    attachEventListeners() {
        // Cambiar categoría → nueva palabra
        this.categorySelect.addEventListener('change', () => {
            this.displayRandomWord();
        });
        
        // Botón crear partida
        this.btnCreate.addEventListener('click', () => {
            this.createGame();
        });
        
        // Enter en inputs
        this.customCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createGame();
            }
        });
    }
    
    async createGame() {
        const category = this.categorySelect.value;
        let customCode = this.customCodeInput.value.trim().toUpperCase();
        
        if (!category) {
            this.showStatus('❌ Selecciona una categoría', 'error');
            return;
        }
        
        // Generar código si no hay personalizado
        if (!customCode) {
            customCode = this.generateCode();
        }
        
        // Validar código
        if (customCode.length < 3 || customCode.length > 5) {
            this.showStatus('❌ El código debe tener 3-5 caracteres', 'error');
            return;
        }
        
        this.btnCreate.disabled = true;
        this.showStatus('⏳ Creando partida...', 'loading');
        
        try {
            const response = await fetch('/api/host/create_game.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: customCode,
                    category: category
                })
            });
            
            const result = await response.json();
            
            if (!result.success) {
                this.showStatus(`❌ ${result.error || 'Error al crear la partida'}`, 'error');
                this.btnCreate.disabled = false;
                return;
            }
            
            // Guardar código
            localStorage.setItem('hostGameCode', customCode);
            localStorage.setItem('gameCategory', category);
            console.log('✅ Partida creada:', customCode);
            
            // Esperar un momento y luego actualizar
            setTimeout(() => {
                // Recargar página o inicializar manager
                location.href = `?code=${customCode}`;
            }, 500);
            
        } catch (error) {
            console.error('❌ Error:', error);
            this.showStatus('❌ Error de conexión', 'error');
            this.btnCreate.disabled = false;
        }
    }
    
    generateCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let code = '';
        const length = 4;
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    showStatus(message, type = 'info') {
        if (!this.statusMessage) return;
        
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message-modal status-${type}`;
        this.statusMessage.style.display = 'block';
    }
    
    show() {
        if (!this.modal) return;
        
        console.log('📋 Mostrando modal de crear partida');
        this.isOpen = true;
        this.modal.style.display = 'flex';
        this.modal.style.animation = 'fadeIn 0.3s ease-out';
        
        // Ocultar elementos innecesarios
        this.hiddenElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
                console.log('🙈 Oculto:', id);
            }
        });
        
        // Animar elementos del modal
        this.animateModalElements();
    }
    
    hide() {
        if (!this.modal) return;
        
        console.log('📋 Ocultando modal de crear partida');
        this.isOpen = false;
        this.modal.style.display = 'none';
        
        // Mostrar elementos
        this.hiddenElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = '';
                console.log('👁️ Mostrado:', id);
            }
        });
    }
    
    animateModalElements() {
        const modalContent = this.modal?.querySelector('.modal-content');
        if (!modalContent) return;
        
        const inputs = modalContent.querySelectorAll('.input-group');
        const button = modalContent.querySelector('.btn-modal-primary');
        
        inputs.forEach((input, index) => {
            input.style.opacity = '0';
            input.style.transform = 'translateY(20px)';
            setTimeout(() => {
                input.style.transition = 'all 0.4s ease-out';
                input.style.opacity = '1';
                input.style.transform = 'translateY(0)';
            }, 100 + (index * 100));
        });
        
        if (button) {
            button.style.opacity = '0';
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transition = 'all 0.4s ease-out';
                button.style.opacity = '1';
                button.style.transform = 'scale(1)';
            }, 300 + (inputs.length * 100));
        }
    }
}

// ===== INIT =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.enhancedCreateGameModal = new EnhancedCreateGameModal();
    });
} else {
    window.enhancedCreateGameModal = new EnhancedCreateGameModal();
}

console.log('%c✅ EnhancedCreateGameModal listo', 'color: #10B981; font-weight: bold');
