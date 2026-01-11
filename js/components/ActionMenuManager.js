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
        if (this.role === 'host') {
            if (!window.hostManager) {
                console.error('❌ hostManager no está disponible');
                return;
            }

            switch (actionId) {
                case 'hamburger-restart-round':
                    window.hostManager.startRound();
                    break;
                case 'hamburger-new-game':
                    window.hostManager.createLinkedGame();
                    break;
                case 'hamburger-settings':
                    if (window.settingsModal) {
                        window.settingsModal.openModal('normal');
                    }
                    break;
                case 'hamburger-terminate':
                    window.hostManager.endGame();
                    break;
            }
        } else if (this.role === 'player') {
            if (!window.playerManager) {
                console.error('❌ playerManager no está disponible');
                return;
            }

            switch (actionId) {
                case 'hamburger-customize':
                    window.playerManager.showEditNameModal();
                    break;
                case 'hamburger-abandon':
                    window.playerManager.exitGame();
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
        if (!gameState) return;

        const restartBtn = this.menu.querySelector('#hamburger-restart-round');
        if (restartBtn) {
            const canRestart = gameState.status === 'playing' || 
                              gameState.status === 'round_ended' || 
                              gameState.status === 'waiting';
            restartBtn.disabled = !canRestart;
            restartBtn.style.opacity = canRestart ? "1" : "0.5";
        }

        const newGameBtn = this.menu.querySelector('#hamburger-new-game');
        if (newGameBtn) {
            const canCreateNewGame = gameState.status === 'finished' || gameState.status === 'round_ended';
            newGameBtn.disabled = !canCreateNewGame;
            newGameBtn.style.opacity = canCreateNewGame ? "1" : "0.5";
        }

        const terminateBtn = this.menu.querySelector('#hamburger-terminate');
        if (terminateBtn) {
            terminateBtn.disabled = false;
            terminateBtn.style.opacity = "1";
        }

        const settingsBtn = this.menu.querySelector('#hamburger-settings');
        if (settingsBtn) {
            settingsBtn.disabled = false;
            settingsBtn.style.opacity = "1";
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