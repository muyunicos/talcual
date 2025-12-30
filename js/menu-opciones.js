/**
 * Menu Opciones Handler
 * Centraliza la lógica de apertura/cierre del menú hamburguesa para host y player
 * - Arranca siempre cerrado
 * - Toggle al click del botón
 * - Cierra al hacer click afuera
 * - Cierra al seleccionar una opción
 */

class MenuOpcionesHandler {
    constructor(buttonSelector, menuSelector) {
        this.btn = document.querySelector(buttonSelector);
        this.menu = document.querySelector(menuSelector);
        this.isOpen = false;

        if (!this.btn || !this.menu) {
            console.warn(`⚠️ MenuOpcionesHandler: No se encontró botón o menú para ${buttonSelector}`);
            return;
        }

        this.init();
    }

    init() {
        // Asegurar que arranca cerrado
        this.menu.style.display = 'none';
        this.isOpen = false;

        // Toggle al click del botón
        this.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Cerrar al hacer click en cualquier opción del menú
        const options = this.menu.querySelectorAll('.hamburger-option');
        options.forEach(option => {
            option.addEventListener('click', () => {
                this.close();
            });
        });

        // Cerrar al hacer click afuera
        document.addEventListener('click', (e) => {
            if (this.isOpen && 
                !this.menu.contains(e.target) && 
                !this.btn.contains(e.target)) {
                this.close();
            }
        });

        console.log(`✅ MenuOpcionesHandler inicializado para ${this.btn.id}`);
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.menu.style.display = 'flex';
        this.menu.style.animation = 'slideDown 0.3s ease-out';
        console.log(`📂 Menú abierto`);
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.menu.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (!this.isOpen) {
                this.menu.style.display = 'none';
            }
        }, 300);
        console.log(`📂 Menú cerrado`);
    }
}

// ===== INICIALIZACIÓN =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Inicializar menú host (si existe)
        if (document.getElementById('btn-hamburger-host')) {
            window.menuHostHandler = new MenuOpcionesHandler('#btn-hamburger-host', '#hamburger-menu-host');
        }

        // Inicializar menú player (si existe)
        if (document.getElementById('btn-hamburger-player')) {
            window.menuPlayerHandler = new MenuOpcionesHandler('#btn-hamburger-player', '#hamburger-menu-player');
        }
    });
} else {
    if (document.getElementById('btn-hamburger-host')) {
        window.menuHostHandler = new MenuOpcionesHandler('#btn-hamburger-host', '#hamburger-menu-host');
    }
    if (document.getElementById('btn-hamburger-player')) {
        window.menuPlayerHandler = new MenuOpcionesHandler('#btn-hamburger-player', '#hamburger-menu-player');
    }
}

console.log('%c✅ menu-opciones.js cargado', 'color: #22C55E; font-weight: bold; font-size: 12px');
