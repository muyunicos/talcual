/**
 * Host Create Game Modal Handler
 * Maneja la creación de partidas desde el modal en host.html
 * 
 * FLUJO:
 * 1. Página carga sin código → modal visible
 * 2. Usuario selecciona categoría y hace click "Crear Partida"
 * 3. API crea juego → guarda código en localStorage
 * 4. Modal cierra → HostManager se re-inicializa
 */

class CreateGameModal {
    constructor() {
        this.modalElement = document.getElementById('modal-create-game');
        this.btnCreate = document.getElementById('btn-create-game');
        this.categorySelect = document.getElementById('category-select');
        this.customCodeInput = document.getElementById('custom-code');
        this.statusMessage = document.getElementById('status-message');
        
        this.isCreating = false;
        
        if (!this.modalElement || !this.btnCreate) {
            console.warn('⚠️ CreateGameModal: elementos no encontrados');
            return;
        }
        
        this.init();
    }
    
    async init() {
        console.log('🎮 CreateGameModal inicializando...');
        
        // Cargar categorías
        await this.loadCategories();
        
        // Eventos
        this.btnCreate.addEventListener('click', () => this.handleCreateClick());
        this.customCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
        
        console.log('✅ CreateGameModal listo');
    }
    
    async loadCategories() {
        try {
            console.log('📄 Cargando categorias...');
            
            // Opción 1: Desde diccionario.json
            const response = await fetch('/app/diccionario.json');
            if (!response.ok) throw new Error('No se pudo cargar diccionario');
            
            const data = await response.json();
            const categories = this.extractCategories(data);
            
            if (categories.length === 0) {
                console.warn('⚠️ No se encontraron categorías, usando defecto');
                categories.push('GENERAL');
            }
            
            console.log(`✅ ${categories.length} categorías cargadas:`, categories);
            this.populateCategorySelect(categories);
            
        } catch (error) {
            console.error('❌ Error cargando categorías:', error);
            // Fallback
            this.populateCategorySelect(['GENERAL', 'DEPORTES', 'MÚUSICA']);
        }
    }
    
    extractCategories(data) {
        const categories = [];
        
        // Legacy format: data.categorias
        if (data.categorias && typeof data.categorias === 'object') {
            categories.push(...Object.keys(data.categorias));
            return categories;
        }
        
        // New format: top-level keys that are arrays
        for (const [key, value] of Object.entries(data)) {
            if (Array.isArray(value) && key !== 'categorias') {
                categories.push(key);
            }
        }
        
        return categories.sort();
    }
    
    populateCategorySelect(categories) {
        this.categorySelect.innerHTML = '';
        
        // Opción vacía
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Categoría Aleatoria';
        emptyOption.selected = true;
        this.categorySelect.appendChild(emptyOption);
        
        // Categorías
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            this.categorySelect.appendChild(option);
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
            
            // Cerrar modal
            this.showMessage('✅ Partida creada. Inicializando...', 'success');
            
            // Esperar un poco para que el usuario vea el mensaje
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Cerrar modal
            this.modalElement.style.display = 'none';
            
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

console.log('%c✅ CreateGameModal listo', 'color: #10B981; font-weight: bold');
