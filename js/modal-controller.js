/**
 * Modal Controller - Gestión centralizada de modales
 * 
 * 🔧 FASE 5: La pieza faltante del refactor
 * 🔧 FASE 5-HOTFIX: Use CSS classes instead of inline display manipulation
 * 🔧 FASE 4-HOTFIX: Prevenir duplicación de listeners
 * 
 * Responsabilidades:
 * - Mostrar/ocultar modales de forma consistente
 * - Manejar overlays y backdrop
 * - Ejecutar callbacks (onBeforeOpen, onAfterOpen, etc.)
 * - Gestionar el estado (abierto/cerrado)
 * - Permitir cierre por ESC o backdrop
 * - Evitar manipulación repetida de DOM
 * - Evitar duplicación de event listeners
 */

class ModalController {
    constructor(modalId, options = {}) {
        this.modalId = modalId;
        this.modalElement = null;
        this.overlayElement = null;
        this.isOpen = false;

        this.options = {
            closeOnBackdrop: options.closeOnBackdrop !== false,
            closeOnEsc: options.closeOnEsc !== false,
            onBeforeOpen: options.onBeforeOpen || null,
            onAfterOpen: options.onAfterOpen || null,
            onBeforeClose: options.onBeforeClose || null,
            onAfterClose: options.onAfterClose || null
        };

        this.escHandler = null;
        this.backdropHandler = null;
        this.escListenerAttached = false;
        this.backdropListenerAttached = false;

        this.init();
    }

    init() {
        this.modalElement = document.getElementById(this.modalId);
        if (!this.modalElement) {
            console.error(`❌ Modal no encontrado: ${this.modalId}`);
            return;
        }

        this.overlayElement = this.findOrCreateOverlay();

        if (this.options.closeOnEsc) {
            this.escHandler = (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            };
        }

        if (this.options.closeOnBackdrop && this.overlayElement) {
            this.backdropHandler = () => {
                if (this.isOpen) {
                    this.close();
                }
            };
        }

        debug(`🔧 ModalController inicializado: ${this.modalId}`, 'info');
    }

    findOrCreateOverlay() {
        let overlay = document.querySelector(`#${this.modalId} ~ .modal-overlay`);
        
        if (!overlay) {
            overlay = document.querySelector('.modal-overlay');
        }

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 999;
                opacity: 0;
                transition: opacity 0.3s ease;
                visibility: hidden;
            `;
            document.body.appendChild(overlay);
        }

        return overlay;
    }

    open() {
        if (this.isOpen) {
            debug(`⚠️ Modal ya está abierto: ${this.modalId}`, 'warning');
            return;
        }

        if (this.options.onBeforeOpen) {
            try {
                this.options.onBeforeOpen();
            } catch (error) {
                debug(`❌ Error en onBeforeOpen: ${error.message}`, 'error');
            }
        }

        this.isOpen = true;

        if (this.overlayElement) {
            this.overlayElement.classList.add('active');
            this.overlayElement.offsetHeight;
            this.overlayElement.style.opacity = '1';
            this.overlayElement.style.visibility = 'visible';

            if (this.options.closeOnBackdrop && this.backdropHandler && !this.backdropListenerAttached) {
                this.overlayElement.addEventListener('click', this.backdropHandler);
                this.backdropListenerAttached = true;
            }
        }

        if (this.modalElement) {
            this.modalElement.classList.remove('hidden');
            this.modalElement.classList.add('active');
            this.modalElement.offsetHeight;
        }

        if (this.options.closeOnEsc && this.escHandler && !this.escListenerAttached) {
            document.addEventListener('keydown', this.escHandler);
            this.escListenerAttached = true;
        }

        document.body.style.overflow = 'hidden';

        debug(`🔌 Modal abierto: ${this.modalId}`, 'info');

        if (this.options.onAfterOpen) {
            try {
                this.options.onAfterOpen();
            } catch (error) {
                debug(`❌ Error en onAfterOpen: ${error.message}`, 'error');
            }
        }
    }

    close() {
        if (!this.isOpen) {
            debug(`⚠️ Modal ya está cerrado: ${this.modalId}`, 'warning');
            return;
        }

        if (this.options.onBeforeClose) {
            try {
                this.options.onBeforeClose();
            } catch (error) {
                debug(`❌ Error en onBeforeClose: ${error.message}`, 'error');
            }
        }

        this.isOpen = false;

        if (this.overlayElement) {
            this.overlayElement.classList.remove('active');
            this.overlayElement.style.opacity = '0';
            
            if (this.options.closeOnBackdrop && this.backdropHandler && this.backdropListenerAttached) {
                this.overlayElement.removeEventListener('click', this.backdropHandler);
                this.backdropListenerAttached = false;
            }

            setTimeout(() => {
                if (this.overlayElement) {
                    this.overlayElement.style.visibility = 'hidden';
                }
            }, 300);
        }

        if (this.modalElement) {
            this.modalElement.classList.remove('active');
            this.modalElement.classList.add('hidden');
        }

        if (this.options.closeOnEsc && this.escHandler && this.escListenerAttached) {
            document.removeEventListener('keydown', this.escHandler);
            this.escListenerAttached = false;
        }

        document.body.style.overflow = '';

        debug(`🔌 Modal cerrado: ${this.modalId}`, 'info');

        if (this.options.onAfterClose) {
            try {
                this.options.onAfterClose();
            } catch (error) {
                debug(`❌ Error en onAfterClose: ${error.message}`, 'error');
            }
        }
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    getIsOpen() {
        return this.isOpen;
    }

    destroy() {
        debug(`🧹 Destroying ModalController: ${this.modalId}`, 'info');

        if (this.escHandler && this.escListenerAttached) {
            document.removeEventListener('keydown', this.escHandler);
            this.escListenerAttached = false;
        }

        if (this.overlayElement && this.backdropHandler && this.backdropListenerAttached) {
            this.overlayElement.removeEventListener('click', this.backdropHandler);
            this.backdropListenerAttached = false;
        }

        if (this.isOpen) {
            this.close();
        }

        this.modalElement = null;
        this.overlayElement = null;
        this.escHandler = null;
        this.backdropHandler = null;
    }
}

console.log('%c✅ modal-controller.js cargado - FASE 4-HOTFIX: Prevención de duplicación de listeners', 'color: #00FF00; font-weight: bold; font-size: 12px');