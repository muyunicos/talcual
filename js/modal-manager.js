/**
 * Modal Manager - Gestor centralizado de modales
 * 
 * Sistema unificado para renderizar y controlar modales dinámicamente
 * Soporta 3 tipos: PRINCIPAL, SECUNDARIO, MENSAJE
 * 
 * API:
 * ModalManager.show({ type, title, content, buttons, onDismiss })
 * ModalManager.close()
 * ModalManager.isOpen()
 */

class ModalManager {
    constructor() {
        this.container = null;
        this.overlay = null;
        this.modal = null;
        this.currentType = null;
        this.currentConfig = null;
        this.onDismissCallback = null;
        this.isOpenFlag = false;
        this.overlayClickHandler = null;

        this.TYPES = {
            PRIMARY: 'primary',
            SECONDARY: 'secondary',
            MESSAGE: 'message'
        };

        this.Z_INDEX = {
            primary: 1000,
            secondary: 2000,
            message: 3000
        };

        this.init();
    }

    init() {
        this.container = document.getElementById('modal-manager');
        if (!this.container) {
            this.createContainer();
        }

        debug('🎯 ModalManager inicializado', 'info');
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'modal-manager';
        document.body.appendChild(this.container);
    }

    show(config) {
        if (this.isOpenFlag) {
            debug('⚠️ Modal ya está abierto', 'warning');
            return;
        }

        const { type = this.TYPES.SECONDARY, title, content, buttons = [], onDismiss } = config;

        this.currentType = type;
        this.currentConfig = config;
        this.onDismissCallback = onDismiss || null;

        this.render(type, title, content, buttons);
        this.open(type);
        this.isOpenFlag = true;
    }

    render(type, title, content, buttons) {
        this.container.innerHTML = '';

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.dataset.modalType = type;
        overlay.style.zIndex = this.Z_INDEX[type];

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'modal-title';
            titleEl.textContent = title;
            modalContent.appendChild(titleEl);
        }

        if (content) {
            const contentEl = document.createElement('div');
            contentEl.className = 'modal-body';

            if (typeof content === 'string') {
                contentEl.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                contentEl.appendChild(content);
            }

            modalContent.appendChild(contentEl);
        }

        if (buttons.length > 0) {
            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'modal-buttons';

            buttons.forEach((btn) => {
                const button = document.createElement('button');
                button.className = btn.class || 'btn';
                button.textContent = btn.label;

                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (btn.action) {
                        btn.action();
                    }
                    if (btn.close !== false) {
                        this.close();
                    }
                });

                buttonsContainer.appendChild(button);
            });

            modalContent.appendChild(buttonsContainer);
        }

        overlay.appendChild(modalContent);
        this.overlay = overlay;
        this.modal = modalContent;
        this.container.appendChild(overlay);
    }

    open(type) {
        if (!this.overlay) return;

        requestAnimationFrame(() => {
            this.overlay.classList.remove('hidden');
            this.overlay.classList.add('active');
        });

        if (type === this.TYPES.MESSAGE || type === this.TYPES.SECONDARY) {
            this.overlayClickHandler = (e) => {
                if (e.target === this.overlay) {
                    this.close();
                }
            };
            this.overlay.addEventListener('click', this.overlayClickHandler);
        }

        if (type !== this.TYPES.PRIMARY) {
            document.body.style.overflow = 'hidden';
        }

        debug(`🎯 Modal abierto: ${type}`, 'info');
    }

    close() {
        if (!this.isOpenFlag) return;

        if (this.overlay) {
            if (this.overlayClickHandler) {
                this.overlay.removeEventListener('click', this.overlayClickHandler);
                this.overlayClickHandler = null;
            }
            this.overlay.classList.remove('active');
            this.overlay.classList.add('hidden');
        }

        if (this.currentType !== this.TYPES.PRIMARY) {
            document.body.style.overflow = '';
        }

        if (this.onDismissCallback) {
            this.onDismissCallback();
            this.onDismissCallback = null;
        }

        this.isOpenFlag = false;
        this.currentType = null;
        this.currentConfig = null;

        debug('🎯 Modal cerrado', 'info');
    }

    isOpen() {
        return this.isOpenFlag;
    }

    destroy() {
        if (this.overlay && this.overlayClickHandler) {
            this.overlay.removeEventListener('click', this.overlayClickHandler);
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.overlay = null;
        this.modal = null;
        this.container = null;
        this.overlayClickHandler = null;
        debug('🧹 ModalManager destruido', 'info');
    }
}

const ModalManager_Instance = new ModalManager();

console.log('%c✅ modal-manager.js cargado - Gestor unificado de modales', 'color: #00FF00; font-weight: bold; font-size: 12px');