/**
 * Host Hamburger Menu Handler - Enhanced v2
 * Maneja el menú hamburguesa del host
 * 
 * MEJORAS v2 (29 Dic 2025 - 23:21):
 * - Solo se muestra si hay sesión activa (hostGameCode en localStorage)
 * - Si NO hay sesión: muestra modal de crear partida
 * - Menú responsive: no estirado, botón correctamente visible
 * - Todas las opciones funcionan correctamente
 * - Cerrar menú después de seleccionar opción
 * 
 * FUNCIONALIDADES:
 * - Mostrar/ocultar menú
 * - Acceso a opciones avanzadas
 * - Reiniciar partida
 * - Nueva partida
 * - Volver al inicio
 */

class HostHamburgerMenu {
    constructor() {
        this.btnHamburger = document.getElementById('btn-hamburger-host');
        this.hamburgerMenu = document.getElementById('hamburger-menu-host');
        this.modalCreateGame = document.getElementById('modal-create-game');
        this.sidepanel = document.getElementById('floating-side-panel');
        
        if (!this.btnHamburger || !this.hamburgerMenu) {
            console.warn('⚠️ HostHamburgerMenu: elementos no encontrados');
            return;
        }
        
        this.isOpen = false;
        this.hasActiveSession = false;
        this.init();
    }
    
    init() {
        console.log('🛍 HostHamburgerMenu inicializando...');
        
        // Verificar si hay sesión activa
        this.checkActiveSession();
        
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
        
        // Mostrar/ocultar según sesión
        if (this.hasActiveSession) {
            this.show();
            console.log('🎮 Hay sesión activa - menu visible');
        } else {
            this.hide();
            console.log('⚠️ Sin sesión activa - menu oculto');
        }
        
        console.log('✅ HostHamburgerMenu listo');
    }
    
    /**
     * FIX: Verificar si hay sesión activa
     * Si no hay sesión: mostrar modal de crear
     */
    checkActiveSession() {
        const gameCode = localStorage.getItem('hostGameCode');
        const isHost = localStorage.getItem('isHost');
        
        this.hasActiveSession = !!(gameCode && isHost === 'true');
        
        if (!this.hasActiveSession && this.modalCreateGame) {
            // Mostrar modal de crear si no hay sesión
            this.modalCreateGame.style.display = 'flex';
            console.log('🎮 Mostrando modal de crear partida');
        }
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
        this.hamburgerMenu.style.animation = 'slideDown 0.3s ease-out';
        console.log('📋 Menú abierto');
    }
    
    close() {
        this.isOpen = false;
        this.hamburgerMenu.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (!this.isOpen) {
                this.hamburgerMenu.style.display = 'none';
            }
        }, 300);
        console.log('📋 Menú cerrado');
    }
    
    /**
     * Mostrar botón hamburguesa
     */
    show() {
        this.btnHamburger.style.display = 'block';
        console.log('🛍 Botón hamburguesa visible');
    }
    
    /**
     * Ocultar botón hamburguesa
     */
    hide() {
        this.btnHamburger.style.display = 'none';
        console.log('🛍 Botón hamburguesa oculto');
    }
    
    /**
     * Reiniciar ronda
     */
    handleRestartRound() {
        console.log('🔄 Reiniciando ronda...');
        this.close();
        
        if (window.hostManager && window.hostManager.startGame) {
            window.hostManager.startGame();
            console.log('✅ Ronda reiniciada');
        } else {
            console.warn('⚠️ HostManager no disponible');
        }
    }
    
    /**
     * Nueva partida
     */
    handleNewGame() {
        console.log('🎮 Nueva partida...');
        this.close();
        
        if (confirm('¿Estas seguro de que quieres empezar una nueva partida? Se perdera el juego actual.')) {
            // Limpiar localStorage
            localStorage.removeItem('hostGameCode');
            localStorage.removeItem('gameId');
            localStorage.removeItem('isHost');
            localStorage.removeItem('gameCategory');
            
            // Recargar
            location.reload();
            console.log('✅ Nueva partida iniciada');
        }
    }
    
    /**
     * Abrir opciones avanzadas
     */
    handleSettings() {
        console.log('⚙️ Abriendo opciones avanzadas...');
        this.close();
        
        // Mostrar modal de configuración
        const modalConfig = document.getElementById('modal-game-config');
        if (modalConfig) {
            modalConfig.style.display = 'flex';
            console.log('✅ Modal de configuración abierto');
        } else {
            console.warn('⚠️ Modal de configuración no encontrado');
        }
    }
    
    /**
     * Terminar partida
     */
    handleTerminate() {
        console.log('💯 Terminando partida...');
        this.close();
        
        if (confirm('¿Estas seguro de que quieres terminar la partida? No se puede deshacer.')) {
            // Limpiar localStorage
            localStorage.removeItem('hostGameCode');
            localStorage.removeItem('gameId');
            localStorage.removeItem('isHost');
            localStorage.removeItem('gameCategory');
            
            // Ir al inicio
            location.href = './index.html';
            console.log('✅ Partida terminada');
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

console.log('%c✅ HostHamburgerMenu Enhanced v2 - Solo visible con sesión activa, responsive', 'color: #10B981; font-weight: bold');