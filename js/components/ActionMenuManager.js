class ActionMenuManager {
    constructor(config) {
        this.btn = document.querySelector(config.buttonSelector);
        this.menu = document.querySelector(config.menuSelector);
        this.role = config.role;
        this.isOpen = false;

        if (!this.btn || !this.menu) {
            console.warn(`⚠️ ActionMenuManager: No se encontró botón o menú para ${config.buttonSelector}`);
            return;
        }

        this.init();
    }

    init() {
        this.menu.classList.remove('menu-open');
        this.isOpen = false;

        this.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        document.addEventListener('click', (e) => {
            if (this.isOpen && 
                !this.menu.contains(e.target) && 
                !this.btn.contains(e.target)) {
                this.close();
            }
        });

        this.menu.addEventListener('click', (e) => {
            const option = e.target.closest('.hamburger-option');
            if (!option) return;

            const actionId = option.id;
            this.handleAction(actionId);
            this.close();
        });

        console.log(`✅ ActionMenuManager inicializado (${this.role})`);
    }

    handleAction(actionId) {
        if (this.role === 'host' && window.hostManager) {
            switch (actionId) {
                case 'hamburger-restart-round':
                    hostManager.startRound();
                    break;
                case 'hamburger-new-game':
                    hostManager.showStartScreen();
                    break;
                case 'hamburger-settings':
                    if (window.settingsModal) {
                        window.settingsModal.openModal('normal');
                    }
                    break;
                case 'hamburger-terminate':
                    hostManager.endGame();
                    break;
            }
        } else if (this.role === 'player' && window.playerManager) {
            switch (actionId) {
                case 'hamburger-customize':
                    playerManager.showEditNameModal();
                    break;
                case 'hamburger-abandon':
                    playerManager.exitGame();
                    break;
            }
        }
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.menu.classList.add('menu-open');
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.menu.classList.remove('menu-open');
    }

    updateOptions(gameState) {
        const restartBtn = this.menu.querySelector('#hamburger-restart-round');
        if (restartBtn) {
            const canRestart = gameState?.status === 'waiting';
            restartBtn.disabled = !canRestart;
            restartBtn.style.opacity = canRestart ? "1" : "0.5";
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('btn-hamburger-host')) {
            window.actionMenuHost = new ActionMenuManager({
                buttonSelector: '#btn-hamburger-host',
                menuSelector: '#hamburger-menu-host',
                role: 'host'
            });
        }

        if (document.getElementById('btn-hamburger-player')) {
            window.actionMenuPlayer = new ActionMenuManager({
                buttonSelector: '#btn-hamburger-player',
                menuSelector: '#hamburger-menu-player',
                role: 'player'
            });
        }
    });
} else {
    if (document.getElementById('btn-hamburger-host')) {
        window.actionMenuHost = new ActionMenuManager({
            buttonSelector: '#btn-hamburger-host',
            menuSelector: '#hamburger-menu-host',
            role: 'host'
        });
    }
    if (document.getElementById('btn-hamburger-player')) {
        window.actionMenuPlayer = new ActionMenuManager({
            buttonSelector: '#btn-hamburger-player',
            menuSelector: '#hamburger-menu-player',
            role: 'player'
        });
    }
}

console.log('%c✅ ActionMenuManager.js', 'color: #22C55E; font-weight: bold; font-size: 12px');
