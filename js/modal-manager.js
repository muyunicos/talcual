/**
 * Modal Manager - Gestor centralizado de modales con soporte de stack
 * 
 * Sistema unificado para renderizar y controlar múltiples modales encimados
 * Soporta 3 tipos: PRIMARY (z: 1000), SECONDARY (z: 2000), MESSAGE (z: 3000)
 * 
 * Los modales se apilan en orden FIFO (First In First Out) y cada nuevo modal
 * se renderiza encima del anterior con z-index incrementado.
 * 
 * API:
 * ModalManager.show({ type, title, content, buttons, onDismiss })
 * ModalManager.close()
 * ModalManager.closeAll()
 * ModalManager.isOpen()
 * ModalManager.getStackSize()
 */

class ModalManager {
    constructor() {
        this.container = null;
        this.stack = [];        // Pila de modales abiertos
        this.baseZIndex = 1000; // z-index base

        this.TYPES = {
            PRIMARY: 'primary',
            SECONDARY: 'secondary',
            MESSAGE: 'message'
        };

        this.init();
    }

    init() {
        this.container = document.getElementById('modal-manager');
        if (!this.container) {
            this.createContainer();
        }
        debug('🎯 ModalManager inicializado (con soporte stack)', 'info');
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'modal-manager';
        document.body.appendChild(this.container);
    }

    show(config) {
        const { type = this.TYPES.SECONDARY, title, content, buttons = [], onDismiss } = config;
        const stackIndex = this.stack.length;
        const zIndex = this.baseZIndex + (stackIndex * 100);

        const modalData = {
            id: `modal-${Date.now()}-${Math.random()}`,
            type,
            title,
            content,
            buttons,
            onDismiss,
            zIndex,
            overlay: null,
            overlayClickHandler: null,
            element: null
        };

        this.stack.push(modalData);
        this.renderModal(modalData);
        this.openModal(modalData);

        debug(`🎯 Modal abierto [${type}] - Stack size: ${this.stack.length}`, 'info');
    }

    renderModal(modalData) {
        const overlay = document.createElement('div');
        overlay.id = modalData.id;
        overlay.className = 'modal-overlay';
        overlay.dataset.modalType = modalData.type;
        overlay.style.zIndex = modalData.zIndex;

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        if (modalData.title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'modal-title';
            titleEl.textContent = modalData.title;
            modalContent.appendChild(titleEl);
        }

        if (modalData.content) {
            const contentEl = document.createElement('div');
            contentEl.className = 'modal-body';

            if (typeof modalData.content === 'string') {
                contentEl.innerHTML = modalData.content;
            } else if (modalData.content instanceof HTMLElement) {
                contentEl.appendChild(modalData.content);
            }

            modalContent.appendChild(contentEl);
        }

        if (modalData.buttons.length > 0) {
            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'modal-buttons';

            modalData.buttons.forEach((btn) => {
                const button = document.createElement('button');
                button.className = btn.class || 'btn';
                button.textContent = btn.label;

                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (btn.action) {
                        btn.action();
                    }
                    if (btn.close !== false) {
                        this.closeTopModal();
                    }
                });

                buttonsContainer.appendChild(button);
            });

            modalContent.appendChild(buttonsContainer);
        }

        overlay.appendChild(modalContent);
        modalData.overlay = overlay;
        modalData.element = modalContent;
        this.container.appendChild(overlay);
    }

    openModal(modalData) {
        if (!modalData.overlay) return;

        requestAnimationFrame(() => {
            modalData.overlay.classList.remove('hidden');
            modalData.overlay.classList.add('active');
        });

        // Agregar listener al overlay para cerrar al hacer clic fuera del modal
        if (modalData.type === this.TYPES.MESSAGE || modalData.type === this.TYPES.SECONDARY) {
            modalData.overlayClickHandler = (e) => {
                if (e.target === modalData.overlay) {
                    this.closeTopModal();
                }
            };
            modalData.overlay.addEventListener('click', modalData.overlayClickHandler);
        }

        // Prevenir scroll en el body si hay cualquier modal abierto
        document.body.style.overflow = 'hidden';

        debug(`🎯 Modal renderizado: ${modalData.type} (z-index: ${modalData.zIndex})`, 'debug');
    }

    closeTopModal() {
        if (this.stack.length === 0) return;

        const modalData = this.stack.pop();
        this.removeModal(modalData);

        debug(`🎯 Modal cerrado [${modalData.type}] - Stack size: ${this.stack.length}`, 'info');

        // Restaurar overflow solo si no hay modales abiertos
        if (this.stack.length === 0) {
            document.body.style.overflow = '';
        }
    }

    removeModal(modalData) {
        if (modalData.overlay) {
            if (modalData.overlayClickHandler) {
                modalData.overlay.removeEventListener('click', modalData.overlayClickHandler);
                modalData.overlayClickHandler = null;
            }
            modalData.overlay.classList.remove('active');
            modalData.overlay.classList.add('hidden');

            setTimeout(() => {
                if (modalData.overlay && modalData.overlay.parentNode) {
                    modalData.overlay.parentNode.removeChild(modalData.overlay);
                }
            }, 300);
        }

        if (modalData.onDismiss) {
            modalData.onDismiss();
            modalData.onDismiss = null;
        }
    }

    close() {
        this.closeTopModal();
    }

    closeAll() {
        while (this.stack.length > 0) {
            this.closeTopModal();
        }
        document.body.style.overflow = '';
        debug('🎯 Todos los modales cerrados', 'info');
    }

    isOpen() {
        return this.stack.length > 0;
    }

    getStackSize() {
        return this.stack.length;
    }

    getTopModal() {
        return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
    }

    destroy() {
        this.closeAll();
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.stack = [];
        this.container = null;
        debug('🧹 ModalManager destruido', 'info');
    }
}

const ModalManager_Instance = new ModalManager();

console.log('%c✅ modal-manager.js cargado - Soporte stack de modales múltiples', 'color: #00FF00; font-weight: bold; font-size: 12px');