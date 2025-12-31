/**
 * @file modal-handler.js
 * @description ModalHandler - Abstracción genérica para modales
 * Reutilizable para Join, Edit, Config, etc.
 * 
 * REFACTOR: Elimina 200 líneas de código duplicado (3 patrones diferentes)
 */

class ModalHandler {
    constructor(modalId, options = {}) {
        this.modalId = modalId;
        this.modalElement = document.getElementById(modalId);
        this.options = {
            displayType: 'flex', // 'flex', 'block', etc.
            closeOnBackdropClick: true,
            beforeShow: null,
            beforeHide: null,
            onConfirm: null,
            ...options
        };

        this.isVisible = false;
        this.setupEventListeners();
    }

    /**
     * Configura los event listeners básicos
     */
    setupEventListeners() {
        if (!this.modalElement) return;

        // Cerrar al hacer click en backdrop
        if (this.options.closeOnBackdropClick) {
            this.modalElement.addEventListener('click', (e) => {
                if (e.target === this.modalElement) {
                    this.hide();
                }
            });
        }

        // Botones de cerrar/cancelar (estándar)
        const btnCancel = this.modalElement.querySelector('[data-modal-cancel], .btn-cancel, #modal-btn-cancel, #btn-config-cancel');
        const btnClose = this.modalElement.querySelector('[data-modal-close], .btn-close');

        if (btnCancel) {
            btnCancel.addEventListener('click', () => this.hide());
        }
        if (btnClose) {
            btnClose.addEventListener('click', () => this.hide());
        }

        // Botón de confirmar
        const btnConfirm = this.modalElement.querySelector('[data-modal-confirm], .btn-confirm, #btn-config-save, #modal-btn-save');
        if (btnConfirm && this.options.onConfirm) {
            btnConfirm.addEventListener('click', () => {
                const result = this.options.onConfirm();
                if (result !== false) {
                    this.hide();
                }
            });
        }
    }

    /**
     * Muestra el modal
     */
    show() {
        if (!this.modalElement) {
            console.warn(`Modal ${this.modalId} not found`);
            return;
        }

        if (this.options.beforeShow && typeof this.options.beforeShow === 'function') {
            this.options.beforeShow();
        }

        this.modalElement.style.display = this.options.displayType;
        this.isVisible = true;
        debug(`🔓 Modal ${this.modalId} shown`, null, 'info');
    }

    /**
     * Oculta el modal
     */
    hide() {
        if (!this.modalElement) return;

        if (this.options.beforeHide && typeof this.options.beforeHide === 'function') {
            this.options.beforeHide();
        }

        this.modalElement.style.display = 'none';
        this.isVisible = false;
        debug(`🔒 Modal ${this.modalId} hidden`, null, 'info');
    }

    /**
     * Toggle visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Obtiene input by name (útil para formularios)
     */
    getInputValue(inputName) {
        const input = this.modalElement?.querySelector(`input[name="${inputName}"], input[id="${inputName}"]`);
        return input?.value || null;
    }

    /**
     * Establece valor de input
     */
    setInputValue(inputName, value) {
        const input = this.modalElement?.querySelector(`input[name="${inputName}"], input[id="${inputName}"]`);
        if (input) {
            input.value = value;
        }
    }

    /**
     * Limpia todos los inputs
     */
    clearInputs() {
        const inputs = this.modalElement?.querySelectorAll('input, textarea, select');
        inputs?.forEach(input => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });
    }

    /**
     * Obtiene todos los valores de inputs como objeto
     */
    getFormData() {
        const inputs = this.modalElement?.querySelectorAll('input, textarea, select');
        const data = {};

        inputs?.forEach(input => {
            if (input.name || input.id) {
                const key = input.name || input.id;
                if (input.type === 'checkbox') {
                    data[key] = input.checked;
                } else if (input.type === 'radio') {
                    if (input.checked) data[key] = input.value;
                } else {
                    data[key] = input.value;
                }
            }
        });

        return data;
    }

    /**
     * Establece contenido HTML
     */
    setContent(html) {
        const content = this.modalElement?.querySelector('[data-modal-content], .modal-content, .modal-body');
        if (content) {
            content.innerHTML = html;
        }
    }

    /**
     * Destruct: desregistra listeners
     */
    destroy() {
        if (this.modalElement) {
            this.modalElement.replaceWith(this.modalElement.cloneNode(true));
        }
        debug(`🗑️ Modal ${this.modalId} destroyed`, null, 'info');
    }
}

console.log('%c✅ modal-handler.js loaded', 'color: #06B6D4; font-weight: bold; font-size: 12px');
