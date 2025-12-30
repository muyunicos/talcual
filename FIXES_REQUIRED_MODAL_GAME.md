# 🎮 CORRECCIONES REQUERIDAS - MODAL NUEVA PARTIDA

**Fecha:** 30 Diciembre 2025, 02:26 UTC-3  
**Status:** 🔴 CRÍTICO - Requerimientos de UI  

---

## 📊 RESUMEN FUNCIONAL

El modal "Nueva Partida" debe:

1. **✅ Seleccionar categoría al azar** al abrir (automático)
2. **✅ Generar palabra aleatoria** de categoría elegida (3-5 letras)
3. **✅ Mostrar en código de sala** la palabra generada
4. **✅ Si se borra:** mostrar "se generará automáticamente"
5. **✅ Categoría persistente** durante todas las rondas
6. **✅ Sin repetir consignas** en una sesión de juego

---

## 📿 ARQUITECTURA ACTUAL

### Archivos Involucrados

```
js/
  ├─ create-game-modal.js    (Lógica del modal)
  ├─ shared-utils.js         (Utilidades compartidas)
  └─ game-client.js          (Cliente del juego)

css/
  └─ 2-play.css              (Estilos modales)
```

### HTML (host.html)
```html
<div class="modal-overlay boot-el nosession-only" id="modal-create-game">
    <div class="modal-content">
        <div class="modal-title">Nueva Partida</div>

        <div class="input-group">
            <label class="input-label" for="category-select">Categoría</label>
            <select id="category-select" class="input-field">
                <option value="" selected>Cargando categorías...</option>
            </select>
        </div>
        
        <div class="input-group">
            <label class="input-label" for="custom-code">Código de Sala</label>
            <input type="text" id="custom-code" class="input-field"
                   placeholder="Se genera automáticamente (3-5 letras)" 
                   maxlength="5" autocomplete="off">
            <small class="custom-code-info">
                Este codigo de sala solo se puede cambiar antes de crear la partida.
            </small>
        </div>

        <button class="btn-modal-primary btn-create-game" id="btn-create-game">
            Crear Partida
        </button>
    </div>
</div>
```

---

## 🔠 CORRECCIONES REQUERIDAS

### 1. SELECCIONAR CATEGORÍA AL AZAR AL ABRIR

**Ubicación:** `js/create-game-modal.js`

**Cambios necesarios:**

```javascript
class CreateGameModal {
    constructor() {
        this.modal = document.getElementById('modal-create-game');
        this.categorySelect = document.getElementById('category-select');
        this.customCodeInput = document.getElementById('custom-code');
        this.btnCreateGame = document.getElementById('btn-create-game');
        this.statusMessage = document.getElementById('status-message');
        
        this.categories = [];
        this.usedCategories = []; // Nueva: Track categorías usadas
        
        this.init();
    }
    
    async init() {
        await this.loadCategories();
        
        // FIX 1: Seleccionar categoría al azar al abrir
        this.selectRandomCategory();
        
        // Listeners
        this.categorySelect.addEventListener('change', () => {
            this.generateRandomCode();
        });
        
        this.customCodeInput.addEventListener('input', (e) => {
            if (e.target.value === '') {
                this.customCodeInput.placeholder = 'Se generará automáticamente (3-5 letras)';
            }
        });
        
        this.btnCreateGame.addEventListener('click', () => this.createGame());
    }
    
    /**
     * FIX 1: Seleccionar categoría al azar
     */
    selectRandomCategory() {
        if (this.categories.length === 0) return;
        
        // Obtener categoría guardada o elegir al azar
        const savedCategory = localStorage.getItem('gameCategory');
        const availableCategories = this.getAvailableCategoriesForSession();
        
        if (!availableCategories.length) {
            // Si todas fueron usadas, reiniciar
            this.usedCategories = [];
            localStorage.setItem('usedCategories', '[]');
        }
        
        let categoryToUse = savedCategory;
        if (!categoryToUse) {
            // Elegir al azar de disponibles
            const randomIndex = Math.floor(Math.random() * availableCategories.length);
            categoryToUse = availableCategories[randomIndex];
        }
        
        // Guardar y aplicar
        localStorage.setItem('gameCategory', categoryToUse);
        this.categorySelect.value = categoryToUse;
        
        console.log('🎮 Categoría seleccionada:', categoryToUse);
        
        // Generar código automáticamente
        this.generateRandomCode();
    }
    
    /**
     * Obtener categorías disponibles (no usadas en esta sesión)
     */
    getAvailableCategoriesForSession() {
        const used = JSON.parse(localStorage.getItem('usedCategories') || '[]');
        return this.categories.filter(cat => !used.includes(cat));
    }
    
    /**
     * FIX 2: Generar palabra aleatoria de 3-5 letras
     */
    generateRandomCode() {
        const category = this.categorySelect.value;
        if (!category) return;
        
        // Obtener palabras de la categoría
        const words = this.getWordsForCategory(category);
        
        // Filtrar: solo 3-5 letras completas
        const filtered = words.filter(word => {
            const clean = word.trim().toLowerCase();
            return clean.length >= 3 && clean.length <= 5;
        });
        
        if (filtered.length === 0) {
            console.warn('⚠️ No hay palabras de 3-5 letras en:', category);
            this.customCodeInput.placeholder = 'Error: sin palabras válidas';
            return;
        }
        
        // Elegir palabra al azar
        const randomIndex = Math.floor(Math.random() * filtered.length);
        const randomWord = filtered[randomIndex];
        
        // Mostrar en input
        this.customCodeInput.value = randomWord.toUpperCase();
        this.customCodeInput.placeholder = 'Se generará automáticamente (3-5 letras)';
        
        console.log('🂯 Palabra generada:', randomWord);
    }
    
    /**
     * Obtener palabras para una categoría
     */
    getWordsForCategory(category) {
        // Esta función debe obtener las palabras del diccionario
        // Asume que existe window.dictionary o similar
        if (!window.dictionary || !window.dictionary[category]) {
            return [];
        }
        return window.dictionary[category];
    }
    
    /**
     * FIX 3: Trackear categoría persistente
     */
    createGame() {
        const category = this.categorySelect.value;
        const code = this.customCodeInput.value || this.generateCode();
        
        // Guardar categoría y marcar como usada
        localStorage.setItem('gameCategory', category);
        
        // Agregar a usadas
        const used = JSON.parse(localStorage.getItem('usedCategories') || '[]');
        if (!used.includes(category)) {
            used.push(category);
            localStorage.setItem('usedCategories', JSON.stringify(used));
            console.log('💭 Categoría marcada como usada:', category);
        }
        
        // Crear partida
        console.log('🎮 Creando partida:', { category, code });
        
        // Enviar al servidor
        // ...
    }
    
    /**
     * Generar código automático si está vacío
     */
    generateCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const length = Math.floor(Math.random() * 3) + 3; // 3-5 caracteres
        let code = '';
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
}
```

---

### 2. ACTUALIZAR HTML DEL INPUT (Placeholder mejorado)

**Ubicación:** `host.html`

**Cambio:**

```html
<!-- ANTES -->
<input type="text" id="custom-code" class="input-field"
       placeholder="Se genera automáticamente (3-5 letras)" 
       maxlength="5" autocomplete="off">

<!-- DESPUÉS: Sin cambios necesarios, el JS controla el placeholder -->
<!-- El placeholder se actualiza dinámicamente en JS -->
```

---

### 3. ACTUALIZAR ALMACENAMIENTO DE SESIÓN

**Ubicación:** `js/shared-utils.js` o `js/game-client.js`

**Agregar estas utilidades:**

```javascript
/**
 * Gestionar categorías de sesión
 */
const SessionManager = {
    
    /**
     * Guardar categoría actual
     */
    setGameCategory(category) {
        localStorage.setItem('gameCategory', category);
        console.log('🂯 Categoría de sesión:', category);
    },
    
    /**
     * Obtener categoría actual
     */
    getGameCategory() {
        return localStorage.getItem('gameCategory');
    },
    
    /**
     * Marcar categoría como usada en esta sesión
     */
    markCategoryUsed(category) {
        const used = JSON.parse(localStorage.getItem('usedCategories') || '[]');
        if (!used.includes(category)) {
            used.push(category);
            localStorage.setItem('usedCategories', JSON.stringify(used));
        }
    },
    
    /**
     * Obtener categorías usadas
     */
    getUsedCategories() {
        return JSON.parse(localStorage.getItem('usedCategories') || '[]');
    },
    
    /**
     * Limpiar categorías usadas (nueva partida)
     */
    resetUsedCategories() {
        localStorage.removeItem('usedCategories');
        localStorage.removeItem('gameCategory');
        console.log('🔄 Categorías reiniciadas');
    },
    
    /**
     * Verificar si quedan categorías disponibles
     */
    hasAvailableCategories(totalCategories) {
        const used = this.getUsedCategories();
        return used.length < totalCategories;
    },
    
    /**
     * Obtener todas las categorías disponibles
     */
    getAvailableCategories(allCategories) {
        const used = this.getUsedCategories();
        return allCategories.filter(cat => !used.includes(cat));
    }
};
```

---

## 🔍 FLUJO DE FUNCIONAMIENTO

### Sequence 1: Abrir Modal

```
1. Usuario hace click en "Nueva Partida"
2. Modal se abre (está visible en HTML)
3. 🎯 constructor() de CreateGameModal se ejecuta
4. init() carga categorías del servidor
5. selectRandomCategory() elige una al azar
6. generateRandomCode() genera palabra de 3-5 letras
7. Palabra aparece en input #custom-code
```

### Sequence 2: Cambiar Categoría

```
1. Usuario cambia select #category-select
2. Dispara evento 'change'
3. Listener llama generateRandomCode()
4. Nueva palabra de 3-5 letras aparece
5. Input se limpia y muestra nueva palabra
```

### Sequence 3: Borrar Código

```
1. Usuario borra input #custom-code
2. value === '' se detecta
3. placeholder = "Se generará automáticamente (3-5 letras)"
4. Al crear partida, se genera código automático
```

### Sequence 4: Crear Partida

```
1. Usuario hace click en "Crear Partida"
2. createGame() se ejecuta
3. Lee categoría y código
4. Marca categoría como usada en SessionManager
5. Envía al servidor
6. Sesión mantiene categoría en localStorage
7. Siguiente ronda NO repite categoría
```

### Sequence 5: Todas las Categorías Usadas

```
1. usedCategories.length === totalCategories
2. getAvailableCategoriesForSession() retorna []
3. Reiniciar: usedCategories = []
4. Mostrar notificación: "Todas las categorías se han usado, reiniciando..."
5. Volver a seleccionar al azar
```

---

## 🚫 RESTRICCIONES

### Palabras válidas para código de sala

- **Longitud:** 3-5 letras COMPLETAS
- **Ejemplos válidos:** CAT (3), BOOK (4), HOUSE (5)
- **Ejemplos inválidos:** A (1 letra), AB (2 letras), ELEPHANT (6+ letras)
- **Formato:** MAYUSCULA (se convierte en el JS)

### Categoría persistencia

- Debe guardarse en `localStorage['gameCategory']`
- Debe recuperarse al iniciar nueva ronda
- Debe marcarse como usada en `localStorage['usedCategories']`
- Al llegar a final de lista, reiniciar ciclo

---

## 📚 TESTING

### Test Case 1: Selección al azar
```
Pasos:
1. Abrir modal 3 veces
2. Verificar que categoría sea diferente (probablemente)
3. Cada vez debe haber una palabra en #custom-code
```

### Test Case 2: Filtrado 3-5 letras
```
Pasos:
1. Abrir modal
2. Ver palabra en #custom-code
3. Contar letras de la palabra
4. Debe ser 3, 4 o 5 letras
```

### Test Case 3: Borrar código
```
Pasos:
1. Abrir modal
2. Borrar texto de #custom-code
3. Placeholder debe cambiar
4. Crear partida
5. Sistema debe generar código automáticamente
```

### Test Case 4: Persistencia categoría
```
Pasos:
1. Crear partida (categoría: ANIMALS)
2. Completar ronda
3. Iniciar nueva ronda
4. Abrir nueva partida
5. Categoría debe ser diferente (ANIMALS no disponible)
```

### Test Case 5: Ciclo completo
```
Pasos:
1. Contar total de categorías (ej: 10)
2. Crear 10 partidas (una por categoría)
3. En la 11a partida
4. Sistema debe reiniciar: categorías disponibles nuevamente
5. Mostrar mensaje: "Reiniciando categorías..."
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Agregar `selectRandomCategory()` a CreateGameModal
- [ ] Agregar `generateRandomCode()` con filtrado 3-5 letras
- [ ] Agregar `getWordsForCategory()` para acceder a diccionario
- [ ] Agregar listeners en constructor
- [ ] Implementar SessionManager en shared-utils.js
- [ ] Guardar categoría al crear partida
- [ ] Marcar categoría como usada
- [ ] Verificar localStorage['usedCategories']
- [ ] Testing en todos los casos
- [ ] Documentar en comments
- [ ] Commit y PR

---

## 📞 REFERENCIAS

**Archivos relacionados:**
- `js/create-game-modal.js` - Lógica principal
- `js/shared-utils.js` - Utilidades compartidas
- `host.html` - HTML del modal
- `css/2-play.css` - Estilos

**Issue GitHub:** #25 - POST-MERGE AUDIT
**Último actualizado:** 30 Dic 2025, 02:26 UTC-3