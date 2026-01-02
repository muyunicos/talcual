/**
 * EJEMPLOS DE USO - ModalManager (Con soporte de STACK)
 * 
 * Este archivo documenta cómo usar el ModalManager_Instance desde diferentes contextos
 * El ModalManager ahora soporta múltiples modales encimados en una pila (stack)
 * 
 * NO DEBE SER IMPORTADO EN PRODUCCIÓN - SÓLO PARA REFERENCIA
 * 
 * El ModalManager es un gestor centralizado de modales que soporta 3 tipos:
 * - PRIMARY: Modal principal (z-index: 1000 + offset de stack)
 * - SECONDARY: Modal secundario (z-index: 1000 + offset de stack)
 * - MESSAGE: Modal de mensaje (z-index: 1000 + offset de stack)
 */


// ============================================================
// CONCEPTO: STACK DE MODALES
// ============================================================
/*
El ModalManager ahora funciona con una PILA (stack) de modales:

1. Primer modal (Crear Partida)     z-index: 1000
2. Segundo modal (Opciones)         z-index: 1100  <- encima del primero
3. Tercer modal (Confirmar salida)  z-index: 1200  <- encima de todos

Cuando cierras el tercer modal, vuelves al segundo.
Cuando cierras el segundo, vuelves al primero.
Cuando cierras el primero, vuelves a la pantalla principal.

z-index se calcula: baseZIndex (1000) + (stackIndex * 100)
*/


// ============================================================
// 1. MODAL SIMPLE CON CONTENIDO DE TEXTO
// ============================================================
function exampleSimpleModal() {
    ModalManager_Instance.show({
        type: 'secondary',
        title: '📄 Título del Modal',
        content: 'Este es un contenido simple de texto',
        buttons: [
            { label: 'Cerrar', class: 'btn', action: null, close: true }
        ]
    });
}


// ============================================================
// 2. MODAL CON CONTENIDO HTML/ELEMENTO
// ============================================================
function exampleHtmlModal() {
    const contentElement = document.createElement('div');
    contentElement.innerHTML = `
        <div style="padding: 10px;">
            <p>⚠️ Este es un modal con contenido HTML personalizado</p>
            <strong>Puedes agregar cualquier estructura HTML aquí</strong>
        </div>
    `;

    ModalManager_Instance.show({
        type: 'secondary',
        title: 'Modal con HTML',
        content: contentElement,
        buttons: [
            { label: 'Cancelar', class: 'btn', action: null, close: true },
            { label: 'Continuar', class: 'btn-modal-primary', action: () => {
                console.log('Acción ejecutada');
            }, close: true }
        ]
    });
}


// ============================================================
// 3. MODAL CON FORMULARIO Y VALIDACIÓN
// ============================================================
function exampleFormModal() {
    const formElement = document.createElement('div');
    formElement.innerHTML = `
        <div class="input-group">
            <label class="input-label" for="modal-input-name">Tu Nombre</label>
            <input type="text" id="modal-input-name" class="input-field" 
                   placeholder="Ingresa tu nombre">
        </div>
        <div class="input-group">
            <label class="input-label" for="modal-input-email">Tu Email</label>
            <input type="email" id="modal-input-email" class="input-field" 
                   placeholder="tu@email.com">
        </div>
    `;

    ModalManager_Instance.show({
        type: 'secondary',
        title: '📄 Completa tu perfil',
        content: formElement,
        buttons: [
            { label: 'Cancelar', class: 'btn', action: null, close: true },
            { label: 'Guardar', class: 'btn-modal-primary', action: () => {
                const name = document.querySelector('#modal-input-name').value;
                const email = document.querySelector('#modal-input-email').value;
                
                if (!name || !email) {
                    showNotification('Completa todos los campos', 'warning');
                    return;
                }
                
                console.log('Guardado:', { name, email });
                showNotification('Datos guardados correctamente', 'success');
            }, close: true }
        ]
    });
}


// ============================================================
// 4. MODAL DE MENSAJE (DESAPARECE AL HACER CLIC)
// ============================================================
function exampleMessageModal() {
    const message = document.createElement('div');
    message.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <h2>🎉 ¡Felicitaciones!</h2>
            <p>Tu acción se completó exitosamente</p>
        </div>
    `;

    ModalManager_Instance.show({
        type: 'message',
        title: 'Exito',
        content: message,
        buttons: [
            { label: 'Entendido', class: 'btn-modal-primary', action: null, close: true }
        ]
    });
}


// ============================================================
// 5. MODAL CON CALLBACK AL CERRAR
// ============================================================
function exampleModalWithCallback() {
    ModalManager_Instance.show({
        type: 'secondary',
        title: '🎯 Modal con Callback',
        content: 'Este modal ejecutará una acción al cerrarse',
        buttons: [
            { label: 'Cerrar', class: 'btn', action: null, close: true }
        ],
        onDismiss: () => {
            console.log('Modal cerrado - ejecutando callback');
            showNotification('🎯 Modal cerrado', 'info');
        }
    });
}


// ============================================================
// 6. MODAL SIN BOTONEs (SÓLO CERRAR AL HACER CLIC EN OVERLAY)
// ============================================================
function exampleNoButtonsModal() {
    const content = document.createElement('div');
    content.innerHTML = `
        <div style="text-align: center;">
            <p>📄 Haz clic fuera del modal para cerrarlo</p>
        </div>
    `;

    ModalManager_Instance.show({
        type: 'secondary',
        title: 'Modal sin Botones',
        content: content,
        buttons: []
    });
}


// ============================================================
// 7. MODAL CON ACCIÓN SIN CIERRE
// ============================================================
function exampleActionNoClose() {
    ModalManager_Instance.show({
        type: 'secondary',
        title: '📋 Procesando...',
        content: 'Esta acción no cierra el modal automáticamente',
        buttons: [
            { 
                label: 'Procesar', 
                class: 'btn-modal-primary', 
                action: async () => {
                    console.log('Procesando...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    console.log('Completado');
                    ModalManager_Instance.close();
                }, 
                close: false
            },
            { label: 'Cancelar', class: 'btn', action: null, close: true }
        ]
    });
}


// ============================================================
// 8. VERIFICAR ESTADO DEL MODAL
// ============================================================
function exampleCheckModalState() {
    console.log('Está abierto:', ModalManager_Instance.isOpen());
    console.log('Cantidad de modales:', ModalManager_Instance.getStackSize());
    
    if (ModalManager_Instance.isOpen()) {
        const topModal = ModalManager_Instance.getTopModal();
        console.log('Modal en top:', topModal);
    }
}


// ============================================================
// 9. CERRAR MODAL PROGRAMATICAMENTE
// ============================================================
function exampleProgrammaticClose() {
    ModalManager_Instance.show({
        type: 'secondary',
        title: 'Cerrar Programaticamente',
        content: 'Este modal se cerrará en 3 segundos',
        buttons: []
    });

    setTimeout(() => {
        ModalManager_Instance.close();
        showNotification('Modal cerrado programaticamente', 'info');
    }, 3000);
}


// ============================================================
// 10. CASO DE USO REAL: FLUJO CON STACK
// ============================================================
/*
CSO: Usuario intenta salir de una partida activa

Flujo esperado:
1. Click en "Salir"
2. Se abre Modal de Confirmación ("Quieres terminar?")
3. Usuario hace click en "Ver Opciones"
4. Se abre Modal de Opciones ENCIMA del anterior
5. Usuario hace click en "Volver"
6. Se cierra Modal de Opciones y vuelve al de Confirmación
7. Usuario hace click en "Sí, terminar"
8. Se cierra Modal de Confirmación y se ejecuta la acción
*/

function exampleRealWorldStack() {
    // PASO 1: Modal de confirmación al intentar salir
    const showExitConfirmation = () => {
        ModalManager_Instance.show({
            type: 'message',
            title: '⚠️ Salir de la Partida',
            content: 'La partida seguirá activa. ¿Quieres terminarla?',
            buttons: [
                { 
                    label: 'Ver Opciones', 
                    class: 'btn', 
                    action: showOptionsModal, 
                    close: false  // No cierra, abre otro modal
                },
                { label: 'No', class: 'btn', action: null, close: true },
                { 
                    label: 'Sí, Terminar', 
                    class: 'btn-modal-danger', 
                    action: () => {
                        console.log('Terminando partida...');
                        // Aquí va la lógica de salida
                    }, 
                    close: true 
                }
            ]
        });
    };

    // PASO 2: Modal de opciones que se abre ENCIMA
    const showOptionsModal = () => {
        const options = document.createElement('div');
        options.innerHTML = `
            <div style="padding: 15px;">
                <p><strong>🎮 Opciones Disponibles:</strong></p>
                <ul>
                    <li>🔊 Volumen</li>
                    <li>🌟 Tema</li>
                    <li>📄 Guardar Progreso</li>
                </ul>
            </div>
        `;

        ModalManager_Instance.show({
            type: 'secondary',
            title: '🎮 Opciones',
            content: options,
            buttons: [
                { label: 'Volver', class: 'btn-modal-primary', action: null, close: true }
            ]
        });
    };

    // Iniciar el flujo
    showExitConfirmation();
}


// ============================================================
// 11. CERRAR TODOS LOS MODALES
// ============================================================
function exampleCloseAll() {
    console.log('Cerrando todos los modales...');
    ModalManager_Instance.closeAll();
    showNotification('Todos los modales cerrados', 'info');
}


// ============================================================
// TIPOS Y ESTILOS DE BOTONES DISPONIBLES
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
- close: boolean - Si es true, cierra el modal después de la acción

NOTA: Si action abre otro modal sin cerrar (close: false),
se creará un stack de modales encimados.
*/


// ============================================================
// MÉTODOS DISPONIBLES DEL ModalManager
// ============================================================
/*
ModalManager_Instance.show(config)     - Abre un nuevo modal
ModalManager_Instance.close()           - Cierra el modal superior
ModalManager_Instance.closeAll()        - Cierra todos los modales
ModalManager_Instance.isOpen()          - Devuelve true si hay modales abiertos
ModalManager_Instance.getStackSize()    - Devuelve cantidad de modales abiertos
ModalManager_Instance.getTopModal()     - Devuelve el modal superior (o null)
*/

console.log('%c📄 examples-modal-usage.js cargado - Stack de modales totalmente funcional', 'color: #FFAA00; font-weight: bold; font-size: 12px');