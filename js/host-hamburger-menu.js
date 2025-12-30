/**
 * Host Hamburger Menu Handler
 * Maneja el menú hamburguesa del host
 * 
 * FUNCIONALIDADES:
 * - Mostrar/ocultar menú
 * - Acceso a opciones avanzadas
 * - Reiniciar partida
 * - Volver al inicio
 */

class HostHamburgerMenu {
    constructor() {
        this.btnHamburger = document.getElementById('btn-hamburger-host');
        this.hamburgerMenu = document.getElementById('hamburger-menu-host');
        this.sidepanel = document.getElementById('floating-side-panel');
        
        if (!this.btnHamburger || !this.hamburgerMenu) {
            console.warn('⚠️ HostHamburgerMenu: elementos no encontrados');
            return;
        }
        
        this.isOpen = false;
        this.init();
    }
    
    init() {
        console.log('🍴 HostHamburgerMenu inicializando...');
        
        // Toggle menú
        this.btnHamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        
        // Cerrar menú al hacer click afuera
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.hamburgerMenu.contains(e.target) && !this.btnHamburger.contains(e.target)) {
                this.close();
            }
        });
        
        // Menú opciones
        const btnRestartRound = document.getElementById('hamburger-restart-round');
        const btnNewGame = document.getElementById('hamburger-new-game');
        const btnSettings = document.getElementById('hamburger-settings');
        const btnTerminate = document.getElementById('hamburger-terminate');
        
        if (btnRestartRound) {
            btnRestartRound.addEventListener('click', () => this.handleRestartRound());
        }
        
        if (btnNewGame) {
            btnNewGame.addEventListener('click', () => this.handleNewGame());
        }
        
        if (btnSettings) {
            btnSettings.addEventListener('click', () => this.handleSettings());
        }
        
        if (btnTerminate) {
            btnTerminate.addEventListener('click', () => this.handleTerminate());
        }
        
        // Siempre visible (nunca está hidden)
        this.show();
        
        console.log('✅ HostHamburgerMenu listo');
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        this.isOpen = true;
        this.hamburgerMenu.style.display = 'flex';
        this.hamburgerMenu.style.animation = 'slideIn 0.3s ease-out';
        console.log('📂 Menú abierto');
    }
    
    close() {
        this.isOpen = false;
        this.hamburgerMenu.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (!this.isOpen) {
                this.hamburgerMenu.style.display = 'none';
            }
        }, 300);
        console.log('📂 Menú cerrado');
    }
    
    show() {
        this.btnHamburger.style.display = 'block';
    }
    
    hide() {
        this.btnHamburger.style.display = 'none';
    }
    
    handleRestartRound() {
        console.log('🔄 Reiniciando ronda...');
        this.close();
        // TODO: Implementar reinicio de ronda
        if (window.hostManager && window.hostManager.startGame) {
            window.hostManager.startGame();
        }
    }
    
    handleNewGame() {
        console.log('🎮 Nueva partida...');
        this.close();
        // Limpiar localStorage y recargar
        localStorage.removeItem('hostGameCode');
        localStorage.removeItem('gameId');
        localStorage.removeItem('isHost');
        location.reload();
    }
    
    handleSettings() {
        console.log('⚙️ Abriendo opciones avanzadas...');
        this.close();
        // Mostrar modal de configuración
        const modalConfig = document.getElementById('modal-game-config');
        if (modalConfig) {
            modalConfig.style.display = 'flex';
            console.log('✅ Modal de configuración abierto');
        }
    }
    
    handleTerminate() {
        console.log('🚺 Terminando partida...');
        this.close();
        if (confirm('¿Estás seguro de que quieres terminar la partida?')) {
            localStorage.removeItem('hostGameCode');
            localStorage.removeItem('gameId');
            localStorage.removeItem('isHost');
            location.href = './index.html';
        }
    }
}

// ===== INIT =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.hostHamburgerMenu = new HostHamburgerMenu();
    });
} else {
    window.hostHamburgerMenu = new HostHamburgerMenu();
}

console.log('%c✅ HostHamburgerMenu listo', 'color: #10B981; font-weight: bold');
