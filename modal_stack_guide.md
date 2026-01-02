# 🎯 Modal Stack - Guía Completa

## ✅ Respuesta a tu pregunta

**SI, ahora funcionará correctamente.** He implementado un sistema de **STACK (pila)** que permite **máximo 3 modales simultáneos encimados**.

---

## 🏗️ Arquitectura del Stack

El ModalManager ahora funciona como una **pila LIFO** (Last In, First Out) con **máximo 3 niveles**:

```
┌─────────────────────────────────────┐
│  Modal 3: "¿Terminar partida?"     │  ← TOP (z-index: 1200)
│  Mensaje de confirmación            │
└─────────────────────────────────────┘
           ↑
      Abierto cuando:
      Click en "Salir" + "Ver Opciones" + ¿Confirmar?
           ↓
┌─────────────────────────────────────┐
│  Modal 2: "Opciones"                │  ← MIDDLE (z-index: 1100)
│  Volumen, Tema, Guardar             │
└─────────────────────────────────────┘
           ↑
      Abierto cuando:
      Click en "Opciones"
           ↓
┌─────────────────────────────────────┐
│  Modal 1: "Crear Partida"           │  ← BASE (z-index: 1000)
│  Código, Nombre, Color              │
└─────────────────────────────────────┘
           ↑
      Pantalla principal
```

---

## ⚠️ Límite de Modales Simultáneos

**MÁXIMO 3 modales abiertos a la vez:**

```javascript
Stack size = 3 ✅ PERMITIDO
┌──────────────────┐
│ Modal 3 (z: 1200)│ 
├──────────────────┤
│ Modal 2 (z: 1100)│ 
├──────────────────┤
│ Modal 1 (z: 1000)│ 
└──────────────────┘

Stack size = 4 ❌ NO PERMITIDO
┌──────────────────┐
│ Modal 4 (z: 1300)│  ← Rechazado
├──────────────────┤
│ Modal 3 (z: 1200)│ 
├──────────────────┤
│ Modal 2 (z: 1100)│ 
├──────────────────┤
│ Modal 1 (z: 1000)│ 
└──────────────────┘
```

**Si intentas abrir un 4º modal:**
- Se descarta silenciosamente
- El usuario sigue viendo el Modal 3 (el TOP)
- Se muestra warning en console: `⚠️ Stack completo (máximo 3 modales)`

---

## 📊 Z-Index Automático

```javascript
z-index = baseZIndex (1000) + (stackIndex * 100)

Modal 1 (index 0): 1000 + (0 * 100) = 1000
Modal 2 (index 1): 1000 + (1 * 100) = 1100
Modal 3 (index 2): 1000 + (2 * 100) = 1200
```

---

## 🔄 Flujo de Cierre

### Caso: Cierre del Modal Superior

```
Estado Actual:   Stack size = 3
┌─────────────────┐
│ Modal 3 (TOP)   │  ← Click en botón "No" o click en overlay
└─────────────────┘
│ Modal 2         │
└─────────────────┘
│ Modal 1         │
└─────────────────┘

      ↓ closeTopModal()
      ↓ (Modal 3 se elimina)

Nuevo Estado:    Stack size = 2
┌─────────────────┐
│ Modal 2 (NEW TOP)│  ← Ahora este es el modal visible
└─────────────────┘
│ Modal 1         │
└─────────────────┘

✅ Ahora puedes abrir otro Modal (Modal 3 nuevo)
```

---

## 💻 Código Necesario en Host Manager

Para implementar el flujo que describiste, necesitarás algo como esto:

```javascript
// En host-manager.js (o donde manejes el flujo de modales)

// 1. Modal Principal: "Crear Partida"
function showCreateGameModal() {
    ModalManager_Instance.show({
        type: 'primary',
        title: '🎮 Crear Partida',
        content: buildCreateGameForm(),
        buttons: [
            { label: 'Crear', class: 'btn-modal-primary', action: createGame, close: false },
            { label: 'Opciones', class: 'btn', action: showOptionsModal, close: false },
            { label: 'Cancelar', class: 'btn', action: null, close: true }
        ]
    });
}

// 2. Modal Secundario: "Opciones" - Se abre ENCIMA del anterior
function showOptionsModal() {
    ModalManager_Instance.show({
        type: 'secondary',
        title: '⚙️ Opciones',
        content: buildOptionsMenu(),
        buttons: [
            { label: 'Volver', class: 'btn-modal-primary', action: null, close: true }
        ]
    });
}

// 3. Si intenta cerrar sin crear, muestra confirmación
function showExitConfirmation() {
    ModalManager_Instance.show({
        type: 'message',
        title: '⚠️ Salir',
        content: 'La partida seguirá activa. ¿Quieres terminarla?',
        buttons: [
            { label: 'Ver Opciones', class: 'btn', action: showOptionsModal, close: false },
            { label: 'No', class: 'btn', action: null, close: true },
            { label: 'Sí, Terminar', class: 'btn-modal-danger', action: exitGame, close: true }
        ]
    });
}
```

---

## 🎬 Flujo de Ejecución Real

```
USER INTERACTION          MODAL STACK              SCREEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Inicio]                  []                       Main screen
                          stack.size = 0

Click "Crear"             [Modal 1]                Visible: Modal 1
→ showCreateGameModal()   stack.size = 1

Click "Opciones"          [Modal 1, Modal 2]       Visible: Modal 2
→ showOptionsModal()      stack.size = 2           (Modal 1 detrás)

Click "Volver"            [Modal 1]                Visible: Modal 1
→ close()                 stack.size = 1

Click botón cerrar        [Modal 1, Modal 3]       Visible: Modal 3
→ showExitConfirmation()  stack.size = 2           (Modal 1 detrás)

Click "Ver Opciones"      [Modal 1, Modal 3,       Visible: Modal 2
→ showOptionsModal()        Modal 2]              (Modal 3 detrás)
                          stack.size = 3          (Modal 1 más atrás)

Click "Volver"            [Modal 1, Modal 3]       Visible: Modal 3
→ close()                 stack.size = 2

Click "Sí, Terminar"      [Modal 1]                Visible: Modal 1
→ exitGame()              stack.size = 1          (pero en proceso
→ close()                 []                       de cerrarse)
                          stack.size = 0

[Fin]                     []                       Main screen
```

---

## 📋 API Disponible

### Métodos Principales

```javascript
// Abrir un nuevo modal (se apila)
// ⚠️ Si stack.size === 3, se rechaza la apertura
ModalManager_Instance.show({
    type: 'primary|secondary|message',
    title: 'Título',
    content: 'Contenido o HTMLElement',
    buttons: [{...}],
    onDismiss: () => {...}  // Ejecuta al cerrar
});

// Cerrar el modal superior
ModalManager_Instance.close();

// Cerrar todos los modales
ModalManager_Instance.closeAll();

// Verificar si hay modales abiertos
if (ModalManager_Instance.isOpen()) {
    // Hay al menos uno abierto
}

// Obtener cantidad de modales abiertos (0, 1, 2, o 3)
const count = ModalManager_Instance.getStackSize();

// Obtener el modal superior sin cerrarlo
const topModal = ModalManager_Instance.getTopModal();
```

---

## 🔑 Propiedades de los Botones

```javascript
buttons: [
    {
        label: 'Texto del botón',
        class: 'btn|btn-modal-primary|btn-modal-danger',
        action: () => { /* función ejecutar */ },
        close: true|false  // ¿Cerrar después de la acción?
    }
]
```

### Comportamientos Comunes

```javascript
// Botón que cierra
{ label: 'Cerrar', action: null, close: true }

// Botón que ejecuta acción y cierra
{ label: 'Guardar', action: saveData, close: true }

// Botón que abre otro modal sin cerrar
{ label: 'Opciones', action: showOptions, close: false }

// Botón que abre modal Y cierra el actual
{ label: 'Siguiente', action: showNext, close: true }
```

---

## ⚠️ Consideraciones Importantes

### 1. **Límite de Stack (MÁXIMO 3)**

Si intentas abrir un 4º modal:
- Se rechaza automáticamente
- Console: `⚠️ Stack completo (máximo 3 modales)`
- El usuario sigue viendo el Modal 3
- Debes cerrar uno (click en botón o overlay) para abrir otro

### 2. **Overflow de Body**

El ModalManager gestiona automáticamente `document.body.style.overflow`:
- Si `stack.size > 0`: Establece `overflow: hidden` (previene scroll)
- Si `stack.size === 0`: Establece `overflow: ''` (restaura)

### 3. **Click en Overlay**

Por defecto:
- **SECONDARY y MESSAGE**: Click en overlay cierra el modal
- **PRIMARY**: No tiene comportamiento de click en overlay

### 4. **Transiciones CSS**

Los modales usan transiciones de opacidad. El tiempo de animación es ~300ms.

---

## 🎯 Caso de Uso: Tu Flujo Exacto

```javascript
// Host Manager - Flujo completo

class HostManager {
    // ... otros métodos ...

    showMainModal() {
        ModalManager_Instance.show({
            type: 'primary',
            title: '🎮 Crear Partida',
            content: this.buildMainContent(),
            buttons: [
                { 
                    label: 'Crear', 
                    class: 'btn-modal-primary',
                    action: () => this.startGame(),
                    close: false  // Se cierra en startGame()
                },
                { 
                    label: 'Opciones', 
                    class: 'btn',
                    action: () => this.showOptions(),
                    close: false  // No cierra, abre otro modal
                }
            ]
        });
    }

    showOptions() {
        // MODAL 2: Se apila encima de MODAL 1
        ModalManager_Instance.show({
            type: 'secondary',
            title: '⚙️ Opciones',
            content: this.buildOptionsContent(),
            buttons: [
                { label: 'Atrás', class: 'btn', action: null, close: true }
            ]
        });
    }

    async startGame() {
        // Intenta crear la partida
        const result = await this.createGame();
        
        if (result.success) {
            // Éxito: cierra todo
            ModalManager_Instance.closeAll();
        } else {
            // Error: muestra confirmación
            // MODAL 3: Se apila encima de MODAL 1 y MODAL 2
            ModalManager_Instance.show({
                type: 'message',
                title: '⚠️ Error',
                content: 'La partida seguirá activa. ¿Quieres terminarla?',
                buttons: [
                    { 
                        label: 'Ver Opciones', 
                        class: 'btn',
                        action: () => this.showOptions(),
                        close: false
                    },
                    { label: 'No', class: 'btn', action: null, close: true },
                    { 
                        label: 'Sí, Terminar', 
                        class: 'btn-modal-danger',
                        action: () => this.exitGame(),
                        close: true
                    }
                ]
            });
        }
    }
}
```

---

## ✅ Cambios Implementados

- ✅ **Modal Stack (MAX 3)**: Sistema LIFO con límite de 3 modales simultáneos
- ✅ **Z-Index Automático**: Cada modal obtiene z-index único
- ✅ **Cierre Seguro**: Solo cierra el modal superior
- ✅ **Event Listeners**: Se limpian correctamente al cerrar
- ✅ **Overflow Management**: Gestión automática de scroll
- ✅ **Validación**: Rechaza apertura si stack.size === 3
- ✅ **Documentación**: 11 ejemplos de uso en `examples-modal-usage.js`

---

## 📝 Resumen

**Tu pregunta:** "¿Funcionará si abro 3 modales encimados?"

**Respuesta:** **SÍ, funciona perfectamente para exactamente 3 modales.** El ModalManager maneja automáticamente:

1. ✅ Z-index correcto para cada modal
2. ✅ Cierre seguro del modal superior
3. ✅ Preservación de modales inferiores
4. ✅ Limpieza de event listeners
5. ✅ Gestión de body overflow
6. ✅ **Validación: MÁXIMO 3 simultáneos**

**Próximo paso:** Refactorizar `host-manager.js` para usar `ModalManager_Instance` en lugar de `ModalController`.