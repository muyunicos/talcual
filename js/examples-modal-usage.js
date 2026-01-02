/**
 * EJEMPLOS DE USO - ModalManager (3 CAPAS JERÁRQUICAS)
 * 
 * Este archivo documenta cómo usar el ModalManager_Instance desde diferentes contextos
 * El ModalManager soporta 3 capas máximas:
 * - PRIMARY (z-index: 1000): Modal base del flujo
 * - SECONDARY (z-index: 1100): Formularios, opciones, menús
 * - CONFIRMATION (z-index: 1200): Mensajes de confirmación
 * 
 * NO DEBE SER IMPORTADO EN PRODUCCIÓN - SÓLO PARA REFERENCIA
 */


// ============================================================
// CONCEPTO: 3 CAPAS JERÁRQUICAS
// ============================================================
/*
El ModalManager funciona con 3 CAPAS máximas, NO es un stack ilimitado:

CAPAS ABIERTAS    VISIBLE              Z-INDEX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1 capa:           PRIMARY              1000

2 capas:          SECONDARY            1100
                  (PRIMARY detrás)

3 capas:          CONFIRMATION         1200
                  (SECONDARY detrás)
                  (PRIMARY más atrás)


Cada tipo de modal tiene un z-index FIJO:
- PRIMARY:      SIEMPRE 1000
- SECONDARY:    SIEMPRE 1100
- CONFIRMATION: SIEMPRE 1200

No puedes tener 2 PRIMARY o 2 SECONDARY simultáneamente.
*/


// ============================================================
// 1. MODAL PRIMARY - BASE DEL FLUJO
// ============================================================
function examplePrimaryModal() {
    ModalManager_Instance.show({
        type: 'primary',
        title: '🎯 Modal Principal',
        content: 'Este es el modal base del flujo (z: 1000)',
        buttons: [
            { label: 'Cerrar', class: 'btn', action: null, close: true }
        ]
    });
}


// ============================================================
// 2. MODAL SECONDARY - SOBRE PRIMARY
// ============================================================
function exampleSecondaryModal() {
    // Primero abre PRIMARY
    ModalManager_Instance.show({
        type: 'primary',
        title: '🎯 Principal',
        content: 'Haz click en "Opciones"',
        buttons: [
            { label: 'Opciones', class: 'btn', action: exampleSecondaryModalLayer, close: false },
            { label: 'Cerrar', class: 'btn', action: null, close: true }
        ]
    });
}

function exampleSecondaryModalLayer() {
    // Luego abre SECONDARY encima
    ModalManager_Instance.show({
        type: 'secondary',
        title: '⚙️ Opciones',
        content: 'Este modal está encima del PRIMARY (z: 1100)',
        buttons: [
            { label: 'Volver', class: 'btn', action: null, close: true }
        ]
    });
}


// ============================================================
// 3. MODAL CONFIRMATION - SOBRE TODOS
// ============================================================
function exampleConfirmationModal() {
    ModalManager_Instance.show({
        type: 'primary',
        title: '🎯 Principal',
        content: 'Haz click en "Confirmar"',
        buttons: [
            { label: 'Confirmar', class: 'btn', action: showConfirmLayer, close: false },
            { label: 'Cerrar', class: 'btn', action: null, close: true }
        ]
    });
}

function showConfirmLayer() {
    ModalManager_Instance.show({
        type: 'confirmation',
        title: '⚠️ Confirmar',
        content: '¿Estás seguro? Este modal está encima de todos (z: 1200)',
        buttons: [
            { label: 'No', class: 'btn', action: null, close: true },
            { label: 'Sí', class: 'btn-modal-primary', action: null, close: true }
        ]
    });
}


// ============================================================
// 4. LAS 3 CAPAS JUNTAS
// ============================================================
function exampleAllThreeLayers() {
    // CAPA 1: PRIMARY
    ModalManager_Instance.show({
        type: 'primary',
        title: '🎯 Crear Partida',
        content: 'Modal base - Haz click en "Opciones"',
        buttons: [
            { label: 'Opciones', class: 'btn', action: openSecondaryLayer, close: false },
            { label: 'Cerrar', class: 'btn', action: null, close: true }
        ]
    });
}

function openSecondaryLayer() {
    // CAPA 2: SECONDARY
    ModalManager_Instance.show({
        type: 'secondary',
        title: '⚙️ Opciones',
        content: 'Modal intermedio - Haz click en "Confirmar"',
        buttons: [
            { label: 'Confirmar', class: 'btn', action: openConfirmationLayer, close: false },
            { label: 'Volver', class: 'btn', action: null, close: true }
        ]
    });
}

function openConfirmationLayer() {
    // CAPA 3: CONFIRMATION
    ModalManager_Instance.show({
        type: 'confirmation',
        title: '⚠️ ¿Terminar Partida?',
        content: 'Las 3 capas están abiertas. Cierra este para volver al anterior.',
        buttons: [
            { label: 'Ver Opciones', class: 'btn', action: openSecondaryLayer, close: false },
            { label: 'No', class: 'btn', action: null, close: true },
            { label: 'Sí', class: 'btn-modal-primary', action: null, close: true }
        ]
    });
}


// ============================================================
// 5. FLUJO CON CALLBACKS
// ============================================================
function exampleWithCallbacks() {
    ModalManager_Instance.show({
        type: 'primary',
        title: '🎯 Test Callbacks',
        content: 'Este modal ejecutará callbacks al cerrar',
        buttons: [
            { label: 'Cerrar', class: 'btn', action: null, close: true }
        ],
        onDismiss: () => {
            console.log('🎯 PRIMARY modal cerrado');
            showNotification('PRIMARY cerrado', 'info');
        }
    });
}


// ============================================================
// 6. VERIFICAR ESTADO
// ============================================================
function exampleCheckState() {
    console.log('🎯 Está abierto:', ModalManager_Instance.isOpen());
    console.log('🎯 Capas abiertas:', ModalManager_Instance.getStackSize());
    console.log('🎯 (Máximo: 3 capas)');
    
    if (ModalManager_Instance.isOpen()) {
        const topModal = ModalManager_Instance.getTopModal();
        console.log('🎯 Capa superior:', topModal.type);
    }
}


// ============================================================
// 7. CERRAR PROGRAMATICAMENTE
// ============================================================
function exampleProgrammaticClose() {
    ModalManager_Instance.show({
        type: 'primary',
        title: '🎯 Auto-close',
        content: 'Este modal se cerrará en 3 segundos',
        buttons: []
    });

    setTimeout(() => {
        ModalManager_Instance.close();
        showNotification('🎯 Modal cerrado automáticamente', 'info');
    }, 3000);
}


// ============================================================
// 8. CERRAR TODAS LAS CAPAS
// ============================================================
function exampleCloseAll() {
    // Abre 3 capas
    ModalManager_Instance.show({
        type: 'primary',
        title: '🎯 Capa 1',
        buttons: [{ label: 'Abrir Capa 2', class: 'btn', action: () => {
            ModalManager_Instance.show({
                type: 'secondary',
                title: '⚙️ Capa 2',
                buttons: [{ label: 'Abrir Capa 3', class: 'btn', action: () => {
                    ModalManager_Instance.show({
                        type: 'confirmation',
                        title: '⚠️ Capa 3',
                        buttons: [{ label: 'Cerrar Todo', class: 'btn', action: () => {
                            ModalManager_Instance.closeAll();
                        }, close: false }]
                    });
                }, close: false }]
            });
        }, close: false }]
    });
}


// ============================================================
// 9. CASO DE USO REAL: TU FLUJO
// ============================================================
function exampleRealWorldFlow() {
    const showCreateGameModal = () => {
        ModalManager_Instance.show({
            type: 'primary',
            title: '🎮 Crear Partida',
            content: '<div>Código: XXX<br>Nombre: Jugador</div>',
            buttons: [
                { label: 'Crear', class: 'btn-modal-primary', action: null, close: false },
                { label: 'Opciones', class: 'btn', action: showOptionsModal, close: false },
                { label: 'Cancelar', class: 'btn', action: null, close: true }
            ]
        });
    };

    const showOptionsModal = () => {
        // CAPA 2: Se abre SOBRE PRIMARY
        ModalManager_Instance.show({
            type: 'secondary',
            title: '⚙️ Opciones',
            content: '<div>🔊 Volumen<br>🌟 Tema<br>📄 Guardar</div>',
            buttons: [
                { label: 'Atrás', class: 'btn', action: null, close: true }
            ]
        });
    };

    const showExitConfirmation = () => {
        // CAPA 3: Se abre SOBRE TODO
        ModalManager_Instance.show({
            type: 'confirmation',
            title: '⚠️ Salir',
            content: 'La partida seguirá activa. ¿Quieres terminarla?',
            buttons: [
                { label: 'Ver Opciones', class: 'btn', action: showOptionsModal, close: false },
                { label: 'No', class: 'btn', action: null, close: true },
                { label: 'Sí, Terminar', class: 'btn-modal-danger', action: () => {
                    console.log('🎮 Partida terminada');
                }, close: true }
            ]
        });
    };

    // Iniciar flujo
    showCreateGameModal();
    console.log('🎮 Flujo iniciado - Haz click en "Opciones" o "Cancelar"');
}


// ============================================================
// TIPOS DE BOTONES DISPONIBLES
// ============================================================
/*
Clases de botón disponibles:
- 'btn' - Botón estándar (gris)
- 'btn-modal-primary' - Botón primario (azul/teal)
- 'btn-modal-danger' - Botón de peligro (rojo)
- 'btn-modal-success' - Botón de éxito (verde)

Propiedades del botón:
- label: string - Texto del botón
- class: string - Clase CSS
- action: function|null - Función a ejecutar (null = no hace nada)
- close: boolean - Si es true, cierra la capa después de la acción
*/


// ============================================================
// API DISPONIBLE
// ============================================================
/*
ÉTODOS DEL ModalManager:

ModalManager_Instance.show(config)
  Abre un nuevo modal en una de las 3 capas
  type: 'primary' | 'secondary' | 'confirmation'
  Si ya existe un modal de ese tipo, se reemplaza

ModalManager_Instance.close()
  Cierra la capa superior (TOP)
  Si hay 3 capas, cierra la CONFIRMATION
  Si hay 2 capas, cierra la SECONDARY
  Si hay 1 capa, cierra la PRIMARY

ModalManager_Instance.closeAll()
  Cierra TODAS las capas de una vez

ModalManager_Instance.isOpen()
  Devuelve true si hay al menos una capa abierta
  Devuelve false si no hay ninguna

ModalManager_Instance.getStackSize()
  Devuelve la cantidad de capas abiertas
  Posibles valores: 0, 1, 2, 3

ModalManager_Instance.getTopModal()
  Devuelve la capa superior (o null si no hay ninguna)
  Retorna el objeto {id, type, title, content, ...}
*/


// ============================================================
// LÓGICA DE CAPAS
// ============================================================
/*
Cuando abres una capa que ya existe:

Ejemplo:
1. Abres PRIMARY (stack size: 1)
2. Abres SECONDARY (stack size: 2)
3. Abres PRIMARY nuevamente
   -> Reemplaza el PRIMARY anterior (stack size: 2)
   -> Ahora visible: PRIMARY (nuevo)
   -> Detrás: SECONDARY
   -> CONFIRMATION no existe

Esto permite actualizar modales sin cerrar los que están debajo.
*/


console.log('%c📄 examples-modal-usage.js cargado - 3 capas jerárquicas (PRIMARY, SECONDARY, CONFIRMATION)', 'color: #FFAA00; font-weight: bold; font-size: 12px');