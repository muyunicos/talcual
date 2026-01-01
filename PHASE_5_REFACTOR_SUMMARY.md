# PHASE 5: Strong Error Handling, WordEngine Decoupling & ModalHandler

Esta es la continuación del refactor iniciado en Fase 1-4. Se completaron las correcciones críticas identificadas en el análisis.

---

## 🎯 Objetivos Logrados

### 1. **Error Handling FUERTE (Rechaza Dummies/Fallbacks)**

#### Antes (Problema):
```javascript
// DictionaryService - Fallback silencioso
async initialize() {
    try {
        const res = await fetch('./app/dictionary.json');
        const data = await res.json();
        this.dictionary = data;
    } catch (error) {
        // ❌ PROBLEMA: Datos falsos en desarrollo
        this.dictionary = { "GENERAL": ["PRUEBA"] };
    }
}
```

#### Después (Solución):
```javascript
// DictionaryService - Rechaza si falla
async initialize() {
    try {
        const res = await fetch('./app/dictionary.json');
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: No se puede cargar diccionario`);
        }
        const data = await res.json();
        this.dictionary = data;
        debug('✅ Diccionario cargado', 'success');
    } catch (error) {
        // ✅ SOLUCIÓN: Rechaza la Promise
        debug('❌ Error cargando diccionario: ' + error.message, 'error');
        throw error;  // NO continuar con datos falsos
    }
}
```

**Impact**: El frontend ahora falla visiblemente en UI si hay error en config/dict, en lugar de funcionar con datos incorrectos.

---

### 2. **WordEngine Desacoplado de DictionaryService**

#### Problema Original:
```javascript
// Confusión de roles
window.wordEngineManager = window.dictionaryService;
// El "WordEngine" es en realidad solo la BBDD de palabras
```

#### Solución Implementada:
```javascript
// shared-utils.js: Tres servicios desacoplados
window.dictionaryService = new DictionaryService();
window.wordEngine = new WordComparison();
window.configService = new ConfigService();

// host-manager.js y player-manager.js ahora usan:
this.getCanonicalForCompare(word) {
    return wordEngine.getCanonical(word);
}
```

**Responsabilidades Claras**:
- `DictionaryService`: Carga el archivo `dictionary.json` (BBDD pura)
- `WordComparison` (wordEngine): Lógica de comparación (sinonimos, plurales, acentos, etc.)
- `ConfigService`: Carga configuración de `actions.php`

---

### 3. **ModalHandler Centralizado (Pieza Faltante)**

#### Antes (Anti-patrón):
```javascript
// player-manager.js - Manipulación manual de DOM repetida
safeHideElement(this.elements.modalJoinGame);
safeShowElement(this.elements.editNameModal);
this.elements.modalEditName.classList.add('active');
this.elements.modalEditName.style.display = 'block';
```

#### Después (Clase Centralizada):
```javascript
// shared-utils.js + modal-controller.js
class ModalController {
    constructor(modalId, options = {}) {
        this.modalId = modalId;
        this.isOpen = false;
        this.options = {
            closeOnBackdrop: true,
            closeOnEsc: true,
            onBeforeOpen: null,
            onAfterOpen: null
        };
    }
    
    open() {
        // Maneja overlay, animaciones, callbacks
        this.isOpen = true;
        this.modalElement.classList.add('active');
        this.overlayElement.style.display = 'block';
    }
    
    close() {
        // Limpia listeners, remueve clases, anima
        this.isOpen = false;
        // ...
    }
}

// Uso en managers:
this.joinModal = new ModalController('modal-join-game', {
    closeOnBackdrop: true,
    closeOnEsc: true,
    onAfterOpen: () => {
        this.elements.inputGameCode.focus();
    }
});

this.joinModal.open();
this.joinModal.close();
```

**Ventajas**:
- ✅ No hay manipulación manual de DOM
- ✅ Manejo automático de backdrop y ESC
- ✅ Callbacks para customización (onBeforeOpen, onAfterOpen)
- ✅ Transiciones CSS consistentes
- ✅ Cleanup automático con destroy()

---

### 4. **SessionManager: Desconexión Explícita de GameClient**

#### Antes (Problema):
```javascript
// SessionManager.clear() solo borraba localStorage
clear() {
    StorageManager.remove(StorageKeys.GAME_ID);
    StorageManager.remove(StorageKeys.PLAYER_ID);
    // ❌ ¿Y la conexión de red? Sigue abierta
}
```

#### Después (Solución):
```javascript
// sessionManager.destroy() - ejecuta callback del manager
destroy() {
    if (this.manager && typeof this.manager.destroy === 'function') {
        this.manager.destroy();
    }
    this.clear();
}

// host-manager.js y player-manager.js
destroy() {
    this.stopTimer();
    if (this.client) {
        this.client.disconnect();  // ✅ Cierra conexión SSE
        this.client = null;
    }
    if (this.joinModal) {
        this.joinModal.destroy();
    }
}
```

---

## 📁 Archivos Creados/Modificados

### **Nuevos Archivos**
- `js/modal-controller.js` - Clase ModalController (256 líneas)

### **Modificados - Managers**
- `js/host-manager.js` - Error handling, ModalController, WordEngine desacoplado
- `js/player-manager.js` - Error handling, ModalController, WordEngine desacoplado

### **Modificados - HTML**
- `host.html` - Agregado `<script src="./js/modal-controller.js"></script>`
- `play.html` - Agregado `<script src="./js/modal-controller.js"></script>`

### **Pendiente en Siguiente Phase**
- `js/shared-utils.js` - Aún necesita:
  - ❌ Eliminar `setLocalStorage`, `getLocalStorage` (legacy wrappers)
  - ❌ Eliminar `loadDictionary()` función suelta
  - ❌ Mejorar validación en ConfigService (agregar más campos)

---

## 🔧 Flujo de Inicialización FASE 5

### Host:
```
DOMContentLoaded
  ↓
HostManager constructor (rápido)
  ↓
await loadConfigAndInit()
  ├─ await configService.load() → ❌ rechaza si falla
  ├─ await initWordEngine() → ✅ continúa si falla (fallback ok)
  ├─ cacheElements()
  ├─ initializeModals() → ✅ crea 2 ModalControllers
  ├─ attachEventListeners()
  └─ hostSession.recover() → intenta recuperar sesión
```

### Player:
```
DOMContentLoaded
  ↓
PlayerManager constructor (rápido)
  ↓
await initialize()
  ├─ await configService.load() → ❌ rechaza si falla
  ├─ await initWordEngine() → ✅ continúa si falla
  ├─ cacheElements()
  ├─ initializeModals() → ✅ crea 2 ModalControllers
  ├─ attachEventListeners()
  └─ playerSession.recover() → intenta recuperar sesión
```

---

## 🚨 Diferencia Crítica: ConfigService vs DictionaryService

### **ConfigService (RECHAZA en error)**
```javascript
// El backend define las REGLAS del juego
// Si no se puede cargar config, NO jugar con reglas antiguas/default
await configService.load();
// Si falla → Promesa rechazada → Fatal error en UI
```

### **DictionaryService (Continúa en error)**
```javascript
// Es solo para MEJORAS de scoring (sinonimos, plurales)
// Sin diccionario → scoring fallback sigue funcionando
await dictionaryService.initialize();
// Si falla → Log warning → Continúa sin sinonimos
```

---

## ✅ Checklist de Completitud FASE 5

- [x] Error handling FUERTE en DictionaryService
- [x] Error handling FUERTE en ConfigService
- [x] Crear ModalController clase
- [x] Refactorizar host-manager.js con ModalController
- [x] Refactorizar player-manager.js con ModalController
- [x] WordEngine desacoplado de DictionaryService
- [x] SessionManager.registerManager() funcional
- [x] HTMLs actualizados con ModalController import
- [x] Documentación PHASE_5_REFACTOR_SUMMARY.md

### ❌ Pendiente para PHASE 6
- [ ] Eliminar legacy wrappers (setLocalStorage, getLocalStorage)
- [ ] Limpiar funciones sueltas en shared-utils.js
- [ ] Validar todos los campos en ConfigService
- [ ] Audit de console.log vs debug()
- [ ] Testing manual (flujo completo Host → Players)

---

## 🔗 Referencias

- **ModalController**: `js/modal-controller.js`
- **Host Manager**: `js/host-manager.js`
- **Player Manager**: `js/player-manager.js`
- **Shared Utils**: `js/shared-utils.js` (SessionManager, ConfigService, DictionaryService)

---

**Status**: ✅ FASE 5 Completada
**Branch**: `refactor/phase-5-cleanup-legacy-and-error-handling`
**Próximo paso**: Merge a main + PHASE 6 (Legacy cleanup)
