/**
 * Modal Manager - Gestor centralizado de modales (3 CAPAS JERÁRQUICAS)
 */

class ModalManager {
    constructor() {
        this.container = null;
        this.stack = [];
        this.baseZIndex = 1000;

        this.TYPES = {
            PRIMARY: 'primary',
            SECONDARY: 'secondary',
            CONFIRMATION: 'confirmation'
        };

        this.Z_INDEX = {
            primary: 1000,
            secondary: 1100,
            confirmation: 1200
        };

        this.init();
    }

    init() {
        this.container = document.getElementById('modal-manager');
        if (!this.container) {
            this.createContainer();
        }
        debug('🎯 ModalManager inicializado (3 capas jerárquicas)', 'info');
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'modal-manager';
        document.body.appendChild(this.container);
    }

    show(config) {
        const { type = this.TYPES.SECONDARY, title, content, buttons = [], onDismiss } = config;

        const modalData = {
            id: `modal-${Date.now()}-${Math.random()}`,
            type,
            title,
            content,
            buttons,
            onDismiss,
            zIndex: this.Z_INDEX[type],
            overlay: null,
            overlayClickHandler: null,
            element: null
        };

        this.stack.push(modalData);
        this.renderModal(modalData);
        this.openModal(modalData);

        debug(`🎯 Modal abierto [${type}] - Capas abiertas: ${this.stack.length}/3`, 'info');
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

        if (modalData.type === this.TYPES.CONFIRMATION || modalData.type === this.TYPES.SECONDARY) {
            modalData.overlayClickHandler = (e) => {
                if (e.target === modalData.overlay) {
                    this.closeTopModal();
                }
            };
            modalData.overlay.addEventListener('click', modalData.overlayClickHandler);
        }

        document.body.style.overflow = 'hidden';

        debug(`🎯 Modal renderizado: ${modalData.type} (z-index: ${modalData.zIndex})`, 'debug');
    }

    closeTopModal() {
        if (this.stack.length === 0) return;

        const modalData = this.stack.pop();
        this.removeModal(modalData);

        debug(`🎯 Modal cerrado [${modalData.type}] - Capas abiertas: ${this.stack.length}`, 'info');

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
        debug('🎯 Todas las capas cerradas', 'info');
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

console.log('%c✅ modal-manager.js cargado - 3 capas jerárquicas (PRIMARY, SECONDARY, CONFIRMATION)', 'color: #00FF00; font-weight: bold; font-size: 12px');