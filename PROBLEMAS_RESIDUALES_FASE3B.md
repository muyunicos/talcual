# PROBLEMAS RESIDUALES - GUIA FASE 3B

## RESUMEN EJECUTIVO

Se han completado FASE 1 (DRY consolidation) y FASE 3A (404 error resolution). Ahora se han identificado 6 problemas arquitectónicos residuales que requieren resolución antes de proceder a testing completo y futuras expansiones.

**Estado actual**: ✅ Código funcional | 🔴 Deuda técnica presente | ⚠️ Race conditions potenciales

---

## 1. RACE CONDITIONS EN STARTUP (CRÍTICA)

### Problema
```javascript
// FLUJO ACTUAL (PROBLEMÁTICO)
[0ms]    Carga shared-utils.js
[0ms]    configService.load() → Fetch config.json (200-300ms)
[0ms]    dictionaryService.initialize() → Fetch dictionary.json (200-300ms)
[50ms]   Carga player-manager.js
[50ms]   DOMContentLoaded → Crea PlayerManager
[50ms]   PlayerManager intenta usar servicios
[100ms]  ⚠️ Servicios aún no listos!
[300ms]  ✅ Todos los servicios listos
```

### Impacto
- PlayerManager/HostManager pueden inicializar antes de que Config y Diccionario estén cargados
- Comportamiento indefinido si user intenta interactuar muy rápido

### Solución (30 minutos)
```javascript
// shared-utils.js (final del archivo)
const servicesReady = Promise.all([
    configService.load(),
    dictionaryService.initialize(),
    storageManager.init(),
]);

// play.html / host.html
document.addEventListener('DOMContentLoaded', async () => {
    await servicesReady;  // Esperar a que TODO esté listo
    playerManager = new PlayerManager();
    playerManager.initialize();
});
```

---

## 2. SHARED-UTILS.JS DEMASIADO GRANDE (ALTA)

### Problema Actual
- **Tamaño**: ~1200 líneas
- **Responsabilidades**: 8+ clases + helpers
- **SRP violation**: Todo en un archivo

### Impacto
- Imposible testear individualmente
- Debugging difícil
- Reutilización en otros proyectos: NO

### Decisión Arquitectónica Elegida
**OPCIÓN A: Monolítica (Actual)**
- ✅ Funciona inmediatamente
- ✅ Sin race conditions
- ✅ Sin problemas de orden de carga
- ❌ Acoplamiento alto
- ❌ Mantenibilidad futura

**Cuándo cambiar a OPCIÓN B**: Cuando >1500 líneas o necesite testing

---

## 3. MODALHANDLER SIN EVENTOS (ALTA)

### Problema
```javascript
// ACOPLAMIENTO ACTUAL
// modal-handler.js
class ModalHandler {
    static open(id) { /* mostrar modal */ }
    static close(id) { /* ocultar modal */ }
}

// player-manager.js
showEditNameModal() {
    Modal.open('modal-edit-name');
    // Pero PlayerManager sigue manejando internals:
    this.elements.modalNameInput.focus();  // Acoplado a DOM interno
    // Sigue pendiente de click en #modal-btn-save
}
```

### Impacto
- Si cambia estructura HTML del modal, PlayerManager se rompe
- Difícil de testear
- Cambios en UI afectan lógica de negocio

### Solución (20 minutos)
```javascript
// modal-handler.js (mejorado)
class ModalHandler {
    static open(id, options = {}) {
        const modal = document.getElementById(id);
        modal.classList.add('active');
        // NUEVO: Emitir evento
        window.dispatchEvent(new CustomEvent('modal:opened', {
            detail: { id, options }
        }));
    }
    
    static close(id) {
        const modal = document.getElementById(id);
        modal.classList.remove('active');
        // NUEVO: Emitir evento
        window.dispatchEvent(new CustomEvent('modal:closed', {
            detail: { id }
        }));
    }
}

// player-manager.js (desacoplado)
constructor() {
    window.addEventListener('modal:opened', (e) => {
        if (e.detail.id === 'modal-edit-name') {
            this.elements.modalNameInput?.focus();
        }
    });
}
```

---

## 4. SESSIONMANAGER SIN STRATEGY (MEDIA)

### Problema
```javascript
// session-manager.js (genérico)
window.addEventListener('beforeunload', () => {
    this.clear();  // ¿Qué hacer para Host? ¿Para Player?
});

// HOST: Debe enviar destroy_game al servidor
// PLAYER: Solo limpiar estado local
```

### Impacto
- Host y Player tienen diferentes comportamientos de desconexión
- Código actual es genérico y no diferencia

### Solución (25 minutos)
```javascript
// session-manager.js
class SessionManager {
    constructor(role, onBeforeUnload = null) {
        this.role = role;
        this.onBeforeUnload = onBeforeUnload;
        this.setupBeforeUnload();
    }
    
    setupBeforeUnload(callback) {
        window.addEventListener('beforeunload', () => {
            if (this.onBeforeUnload) {
                this.onBeforeUnload();
            }
            this.clear();
        });
    }
}

// host-manager.js
window.hostSession = new SessionManager('host', () => {
    this.gameClient?.send({ action: 'destroy_game' });
});

// player-manager.js
window.playerSession = new SessionManager('player', () => {
    // Solo limpiar local, servidor marca como disconnected
});
```

---

## 5. WORD-COMPARISON.JS REDUNDANTE (MEDIA)

### Problema
- `word-comparison.js` existe como archivo separado
- `DictionaryService` en `shared-utils.js` integra `WordEngineManager`
- ¿Cuál es la fuente de verdad?

### Posibles Escenarios
```javascript
// ESCENARIO A: Duplicación (MALO)
// word-comparison.js
class WordEquivalenceEngine { /* definición */ }

// shared-utils.js
class WordEquivalenceEngine { /* otra copia */ }  // DUPLICADO

// ESCENARIO B: Dependencia circular (MALO)
// word-comparison.js
class WordEquivalenceEngine { ... }

// shared-utils.js
this.engine = new WordEquivalenceEngine()  // ¿Cargado antes?

// ESCENARIO C: Consolidado (BUENO)
// shared-utils.js
class DictionaryService {
    constructor() {
        this.engine = new WordEquivalenceEngine();  // Integrado
    }
}
```

### Solución (15 minutos)
1. Verificar si `word-comparison.js` es necesario
2. Si duplica → Eliminar o consolidar
3. Si es fuente única → Mantener y documentar dependencia en HTML

---

## 6. SIN TESTING AUTOMATIZADO (MEDIA)

### Problema
- Cambios en `shared-utils.js` pueden romper todo
- Sin forma de verificar regressions
- Cada cambio requiere testing manual

### Solución (1 hora)
```javascript
// tests/dictionary-service.test.js
describe('DictionaryService', () => {
    test('loads dictionary correctly', async () => {
        const service = new DictionaryService();
        await service.initialize();
        const words = await service.getWords();
        expect(words.length).toBeGreaterThan(1000);
    });
    
    test('word comparison works', () => {
        const result = service.compareWords('HOLA', 'OHLÁ');
        expect(result).toBe(true);
    });
});

// tests/session-manager.test.js
describe('SessionManager', () => {
    test('creates session correctly', () => {
        const session = new SessionManager('player');
        expect(session.isActive()).toBe(false);
    });
});
```

---

## PLAN FASE 3B (90 minutos total)

| Tarea | Tiempo | Prioridad |
|-------|--------|-----------|
| Implementar `servicesReady` | 30 min | 🔴 CRÍTICA |
| Mejorar ModalHandler con eventos | 20 min | 🟠 ALTA |
| Strategy pattern en SessionManager | 25 min | 🟠 ALTA |
| Consolidar word-comparison.js | 15 min | 🟡 MEDIA |

---

## PLAN FASE 3C (Testing + Docs - 1.5 horas)

| Tarea | Tiempo | 
|-------|--------|
| Unit tests para DictionaryService | 30 min |
| Unit tests para SessionManager | 25 min |
| Integration tests | 20 min |
| Documentación API | 15 min |

---

## CHECKLIST ANTES DE FASE 3B

- [ ] Verificar cero errores 404 en Network
- [ ] Confirmar servicios cargan correctamente
- [ ] Modales abren/cierran sin errores
- [ ] Menú hamburguesa funciona
- [ ] Storage Manager funciona

---

## SIGUIENTE PASO

✅ Ejecutar CHECKLIST_VERIFICACION.md  
➡️ Si todo pasa → Proceder a FASE 3B
