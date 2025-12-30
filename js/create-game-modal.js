/**
 * Host Create Game Modal Handler - Enhanced v4
 * Maneja la creación de partidas desde el modal en host.html
 * 
 * MEJORAS v4 (30 Dic 2025 - 02:30):
 * - Soporte para estructura de diccionario ANIDADA (categorías -> subcategorías -> palabras)
 * - Extrae TODAS las palabras de subcategorías automáticamente
 * - Filtrado de palabras 3-5 letras (completas)
 * - Al abrir modal: categoría seleccionada al azar automáticamente
 * - Código sala muestra palabra aleatoria de categoría elegida (3-5 letras)
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
        
        // Buscar categorías en el nivel principal
        for (const [key, value] of Object.entries(data)) {
            // Si es un objeto (no array), probablemente sea una categoría con subcategorías
            if (typeof value === 'object' && !Array.isArray(value)) {
                categories.push(key);
            }
            // Si es un array, también es una categoría
            else if (Array.isArray(value)) {
                categories.push(key);
            }
        }
        
        return categories.sort();
    }
    
    /**
     * FIX v4: Extraer palabras de estructura ANIDADA
     * Soporta: categoría -> subcategoría -> palabras
     * Ejemplo: "AMOR Y CITAS ❤️" -> {"Un lugar...": [...], "Algo...": [...]}
     */
    extractWordsForCategory(category) {
        if (!this.dictionary) return [];
        
        const words = [];
        
        // Obtener el contenido de la categoría
        const categoryData = this.dictionary[category];
        
        if (!categoryData) {
            console.warn(`⚠️ Categoría no encontrada: ${category}`);
            return [];
        }
        
        // Caso 1: Array directo de palabras
        if (Array.isArray(categoryData)) {
            categoryData.forEach(item => {
                if (typeof item === 'string') {
                    words.push(item);
                } else if (typeof item === 'object') {
                    // Si es objeto dentro de array, extraer las claves como palabras
                    Object.keys(item).forEach(key => {
                        if (key && key.trim() !== '') {
                            words.push(key);
                        }
                    });
                }
            });
        }
        // Caso 2: Objeto con subcategorías (estructura anidada)
        else if (typeof categoryData === 'object') {
            // Iterar sobre cada subcategoría
            for (const [subcategoryKey, subcategoryItems] of Object.entries(categoryData)) {
                // Si la subcategoría es un array
                if (Array.isArray(subcategoryItems)) {
                    subcategoryItems.forEach(item => {
                        if (typeof item === 'string') {
                            words.push(item);
                        } else if (typeof item === 'object') {
                            // Extraer claves del objeto como palabras
                            Object.keys(item).forEach(key => {
                                if (key && key.trim() !== '') {
                                    words.push(key);
                                }
                            });
                        }
                    });
                }
                // Si la subcategoría es un objeto directo
                else if (typeof subcategoryItems === 'object') {
                    Object.keys(subcategoryItems).forEach(key => {
                        if (key && key.trim() !== '') {
                            words.push(key);
                        }
                    });
                }
            }
        }
        
        console.log(`📚 ${words.length} palabras extraídas de ${category}`);
        return words;
    }
    
    /**
     * FIX: Filtrar palabras de 3-5 letras completas
     * Evita palabras incompletas o muy cortas/largas
     */
    getValidWordsForCategory(category) {
        const allWords = this.extractWordsForCategory(category || this.categories[0]);
        
        if (allWords.length === 0) {
            console.warn(`⚠️ No hay palabras para ${category}`);
            return [];
        }
        
        // Filtrar: 3-5 letras, sin espacios, solo letras y números
        const filtered = allWords.filter(word => {
            const cleanWord = word.trim().toUpperCase();
            // 3-5 letras, solo caracteres alfabéticos (incluye acentos)
            const isValidLength = cleanWord.length >= 3 && cleanWord.length <= 5;
            const isValidChars = /^[A-ZÁÉÍÓÚÑ\s]+$/.test(cleanWord);
            return isValidLength && isValidChars && cleanWord !== '';
        });
        
        console.log(`✅ ${filtered.length} palabras válidas (3-5 letras) de ${category}`);
        return filtered;
    }
    
    /**
     * FIX: Obtener palabra aleatoria válida (3-5 letras)
     */
    getRandomWord(category) {
        const validWords = this.getValidWordsForCategory(category || this.categories[0]);
        
        if (validWords.length === 0) {
            console.warn(`⚠️ No hay palabras válidas para ${category}, usando JUEGO`);
            return 'JUEGO';
        }
        
        const randomWord = validWords[Math.floor(Math.random() * validWords.length)];
        console.log(`🎲 Palabra válida seleccionada para ${category}: ${randomWord}`);
        return randomWord;
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
    
    // FIX: Actualizar código con palabra de categoría (3-5 letras)
    updateCodeWithCategoryWord() {
        const selectedCategory = this.categorySelect.value;
        if (!selectedCategory) return;
        
        const randomWord = this.getRandomWord(selectedCategory);
        const code = randomWord.toUpperCase().substring(0, 5); // Máx 5 letras
        
        this.customCodeInput.value = code;
        this.customCodeInput.placeholder = 'se generará automáticamente';
        
        console.log(`📝 Código actualizado: ${code} (de categoría ${selectedCategory})`);
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
            
            // Guardar en localStorage (FASE 1: centralizado)
            StorageManager.set(StorageKeys.HOST_GAME_CODE, gameId);
            StorageManager.set(StorageKeys.GAME_ID, gameId);
            StorageManager.set(StorageKeys.IS_HOST, 'true');
            StorageManager.set(StorageKeys.GAME_CATEGORY, category);

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

console.log('%c✅ CreateGameModal Enhanced v4 - Soporte anidado, filtrado 3-5 letras, categoría persistente', 'color: #10B981; font-weight: bold');
