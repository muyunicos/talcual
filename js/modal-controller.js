/**
 * Modal Controller - Gestión centralizada de modales
 * 
 * 🔧 FASE 5: La pieza faltante del refactor
 * 
 * Responsabilidades:
 * - Mostrar/ocultar modales de forma consistente
 * - Manejar overlays y backdrop
 * - Ejecutar callbacks (onBeforeOpen, onAfterOpen, etc.)
 * - Gestionar el estado (abierto/cerrado)
 * - Permitir cierre por ESC o backdrop
 * - Evitar manipulación repetida de DOM
 * 
 * Uso:
 *   const modal = new ModalController('modal-id', {
 *       closeOnBackdrop: true,
 *       closeOnEsc: true,
 *       onBeforeOpen: () => { ... },
 *       onAfterOpen: () => { ... }
 *   });
 *   
 *   modal.open();
 *   modal.close();
 */

class ModalController {
    constructor(modalId, options = {}) {
        this.modalId = modalId;
        this.modalElement = null;
        this.overlayElement = null;
        this.isOpen = false;

        // Opciones
        this.options = {
            closeOnBackdrop: options.closeOnBackdrop !== false,
            closeOnEsc: options.closeOnEsc !== false,
            onBeforeOpen: options.onBeforeOpen || null,
            onAfterOpen: options.onAfterOpen || null,
            onBeforeClose: options.onBeforeClose || null,
            onAfterClose: options.onAfterClose || null
        };

        this.init();
    }

    init() {
        // 🔍 Buscar modal en DOM
        this.modalElement = document.getElementById(this.modalId);
        if (!this.modalElement) {
            console.error(`❌ Modal no encontrado: ${this.modalId}`);
            return;
        }

        // 🔍 Buscar o crear overlay (backdrop)
        this.overlayElement = this.findOrCreateOverlay();

        // 🔧 Event listeners para ESC y backdrop
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
        // 🔍 Intentar encontrar overlay existente
        let overlay = document.querySelector(`#${this.modalId} ~ .modal-overlay`);
        
        if (!overlay) {
            overlay = document.querySelector('.modal-overlay');
        }

        // Si no existe, crear uno
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
                display: none;
                z-index: 999;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            document.body.appendChild(overlay);
        }

        return overlay;
    }

    /**
     * Abrir modal con animación
     */
    open() {
        if (this.isOpen) {
            debug(`⚠️ Modal ya está abierto: ${this.modalId}`, 'warning');
            return;
        }

        // 🔧 Callback antes de abrir
        if (this.options.onBeforeOpen) {
            try {
                this.options.onBeforeOpen();
            } catch (error) {
                debug(`❌ Error en onBeforeOpen: ${error.message}`, 'error');
            }
        }

        this.isOpen = true;

        // Mostrar overlay
        if (this.overlayElement) {
            this.overlayElement.style.display = 'block';
            // Trigger reflow para activar transición CSS
            this.overlayElement.offsetHeight;
            this.overlayElement.style.opacity = '1';

            if (this.options.closeOnBackdrop && this.backdropHandler) {
                this.overlayElement.addEventListener('click', this.backdropHandler);
            }
        }

        // Mostrar modal
        if (this.modalElement) {
            this.modalElement.style.display = 'block';
            this.modalElement.classList.remove('hidden');
            this.modalElement.classList.add('active');
            // Trigger reflow para activar transición CSS
            this.modalElement.offsetHeight;
        }

        // Escuchar ESC
        if (this.options.closeOnEsc && this.escHandler) {
            document.addEventListener('keydown', this.escHandler);
        }

        // Prevenir scroll en body
        document.body.style.overflow = 'hidden';

        debug(`🔌 Modal abierto: ${this.modalId}`, 'info');

        // 🔧 Callback después de abrir
        if (this.options.onAfterOpen) {
            try {
                this.options.onAfterOpen();
            } catch (error) {
                debug(`❌ Error en onAfterOpen: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Cerrar modal con animación
     */
    close() {
        if (!this.isOpen) {
            debug(`⚠️ Modal ya está cerrado: ${this.modalId}`, 'warning');
            return;
        }

        // 🔧 Callback antes de cerrar
        if (this.options.onBeforeClose) {
            try {
                this.options.onBeforeClose();
            } catch (error) {
                debug(`❌ Error en onBeforeClose: ${error.message}`, 'error');
            }
        }

        this.isOpen = false;

        // Ocultar overlay
        if (this.overlayElement) {
            this.overlayElement.style.opacity = '0';
            
            if (this.options.closeOnBackdrop && this.backdropHandler) {
                this.overlayElement.removeEventListener('click', this.backdropHandler);
            }

            // Esperar a que termine la transición
            setTimeout(() => {
                if (this.overlayElement) {
                    this.overlayElement.style.display = 'none';
                }
            }, 300);
        }

        // Ocultar modal
        if (this.modalElement) {
            this.modalElement.classList.remove('active');
            this.modalElement.classList.add('hidden');
            
            // Esperar a que termine la transición CSS
            setTimeout(() => {
                if (this.modalElement) {
                    this.modalElement.style.display = 'none';
                }
            }, 300);
        }

        // Dejar de escuchar ESC
        if (this.options.closeOnEsc && this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
        }

        // Restaurar scroll en body
        document.body.style.overflow = '';

        debug(`🔌 Modal cerrado: ${this.modalId}`, 'info');

        // 🔧 Callback después de cerrar
        if (this.options.onAfterClose) {
            try {
                this.options.onAfterClose();
            } catch (error) {
                debug(`❌ Error en onAfterClose: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Toggle modal (abrir/cerrar)
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Verificar si está abierto
     */
    getIsOpen() {
        return this.isOpen;
    }

    /**
     * Limpiar resources
     */
    destroy() {
        debug(`🧹 Destroying ModalController: ${this.modalId}`, 'info');

        // Remover listeners
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
        }

        if (this.overlayElement && this.backdropHandler) {
            this.overlayElement.removeEventListener('click', this.backdropHandler);
        }

        // Cerrar si estaba abierto
        if (this.isOpen) {
            this.close();
        }

        this.modalElement = null;
        this.overlayElement = null;
    }
}

console.log('%c✅ modal-controller.js cargado - FASE 5: Centralized modal management', 'color: #00FF00; font-weight: bold; font-size: 12px');
