/**
 * EXEMPLOS DE USO - ModalManager
 * 
 * Este archivo documenta cómo usar el ModalManager_Instance desde diferentes contextos
 * NO DEBE SER IMPORTADO EN PRODUCCIÓN - SÓLO PARA REFERENCIA
 * 
 * El ModalManager es un gestor centralizado de modales que soporta 3 tipos:
 * - PRIMARY: Modal principal (z-index: 1000)
 * - SECONDARY: Modal secundario (z-index: 2000)
 * - MESSAGE: Modal de mensaje (z-index: 3000)
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
// 8. VERIFICAR SI UN MODAL ESTÁ ABIERTO
// ============================================================
function exampleCheckIfOpen() {
    if (ModalManager_Instance.isOpen()) {
        console.log('✅ Hay un modal abierto');
        ModalManager_Instance.close();
    } else {
        console.log('❌ No hay modal abierto');
        exampleSimpleModal();
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
// 10. ENCADENAR MODALES
// ============================================================
function exampleChainedModals() {
    const firstModal = () => {
        ModalManager_Instance.show({
            type: 'secondary',
            title: 'Primer Modal',
            content: 'Abre el segundo modal',
            buttons: [
                { label: 'Siguiente', class: 'btn-modal-primary', action: secondModal, close: true },
                { label: 'Cancelar', class: 'btn', action: null, close: true }
            ]
        });
    };

    const secondModal = () => {
        ModalManager_Instance.show({
            type: 'secondary',
            title: 'Segundo Modal',
            content: 'Abre el tercer modal',
            buttons: [
                { label: 'Siguiente', class: 'btn-modal-primary', action: thirdModal, close: true },
                { label: 'Volver', class: 'btn', action: firstModal, close: true }
            ]
        });
    };

    const thirdModal = () => {
        ModalManager_Instance.show({
            type: 'message',
            title: '🌟 Completado!',
            content: 'Has llegado al final',
            buttons: [
                { label: 'Cerrar', class: 'btn-modal-primary', action: null, close: true }
            ]
        });
    };

    firstModal();
}


// ============================================================
// TIPOS Y ESTILOS DE BOTONEs DISPONIBLES
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
*/


console.log('%c📄 examples-modal-usage.js cargado - Solo para referencia', 'color: #FFAA00; font-weight: bold; font-size: 12px');