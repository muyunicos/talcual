/**
 * Host Manager - Gestión de partida en host
 * Maneja: timer, categoría, ranking, panel tabs, menú hamburguesa
 */

function determineUIState() {
    const hasSession = StorageManager.isHostSessionActive();
    const gameCode = StorageManager.get(StorageKeys.HOST_GAME_CODE);
    const root = document.documentElement;
    
    if (hasSession && gameCode) {
        root.classList.add('has-session');
        root.classList.remove('no-session');
    } else {
        root.classList.add('no-session');
        root.classList.remove('has-session');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', determineUIState);
} else {
    determineUIState();
}

class HostManager {
    constructor(gameCode) {
        this.gameCode = gameCode;
        this.client = null;
        this.currentRound = 0;
        this.totalRounds = 3;
        this.remainingTime = 0;
        this.timerInterval = null;
        this.activeTab = 'ranking';
        this.minPlayers = 2;
        this.currentPlayers = [];
        this.gameState = {};
        
        this.btnHamburger = document.getElementById('btn-hamburger-host');
        this.hamburgerMenu = document.getElementById('hamburger-menu-host');
        this.isMenuOpen = false;
        
        this.initUI();
        this.attachEventListeners();
        this.initHamburgerMenu();
        this.connectGameClient();
    }

    checkActiveSession() {
        return StorageManager.isHostSessionActive();
    }

    initUI() {
        if (!this.checkActiveSession()) {
            return;
        }

        const codeValueEl = document.getElementById('code-sticker-value');
        if (codeValueEl) {
            codeValueEl.textContent = this.gameCode;
        }

        const codeSticker = document.querySelector('.code-sticker-floating');
        if (codeSticker) {
            codeSticker.addEventListener('click', () => {
                navigator.clipboard.writeText(this.gameCode).then(() => {
                    codeSticker.classList.add('copied');
                    setTimeout(() => {
                        codeSticker.classList.remove('copied');
                    }, 600);
                }).catch(err => {
                    console.error('Error copiando código:', err);
                });
            });
        }

        this.initPanelTabs();
    }

    initPanelTabs() {
        const tabs = document.querySelectorAll('.panel-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });
        this.switchTab(this.activeTab);
    }

    switchTab(tabName) {
        this.activeTab = tabName;
        const tabs = document.querySelectorAll('.panel-tab');
        tabs.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabName);
        });
        const views = document.querySelectorAll('.panel-view');
        views.forEach(v => {
            v.classList.toggle('active', v.dataset.view === tabName);
        });
    }

    attachEventListeners() {
        const btnStart = document.getElementById('btn-start-game');
        if (btnStart) {
            btnStart.addEventListener('click', () => this.startGame());
        }
    }

    initHamburgerMenu() {
        if (!this.btnHamburger || !this.hamburgerMenu) {
            return;
        }

        this.btnHamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleHamburgerMenu();
        });

        document.addEventListener('click', (e) => {
            if (this.isMenuOpen && 
                !this.hamburgerMenu.contains(e.target) && 
                !this.btnHamburger.contains(e.target)) {
                this.closeHamburgerMenu();
            }
        });

        document.getElementById('hamburger-restart-round')?.addEventListener('click', () => this.handleRestartRound());
        document.getElementById('hamburger-new-game')?.addEventListener('click', () => this.handleNewGame());
        document.getElementById('hamburger-settings')?.addEventListener('click', () => this.handleSettings());
        document.getElementById('hamburger-terminate')?.addEventListener('click', () => this.handleTerminate());
    }

    toggleHamburgerMenu() {
        if (this.isMenuOpen) {
            this.closeHamburgerMenu();
        } else {
            this.openHamburgerMenu();
        }
    }

    openHamburgerMenu() {
        this.isMenuOpen = true;
        this.hamburgerMenu.style.display = 'flex';
        this.hamburgerMenu.style.animation = 'slideDown 0.3s ease-out';
    }

    closeHamburgerMenu() {
        this.isMenuOpen = false;
        this.hamburgerMenu.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (!this.isMenuOpen) {
                this.hamburgerMenu.style.display = 'none';
            }
        }, 300);
    }

    handleRestartRound() {
        this.closeHamburgerMenu();
        if (confirm('¿Reiniciar la ronda actual?')) {
            this.startGame();
        }
    }

    handleNewGame() {
        this.closeHamburgerMenu();
        if (confirm('¿Crear una nueva partida? Se perderá el progreso actual.')) {
            if (typeof StorageManager !== 'undefined') {
                StorageManager.clearHostSession();
            } else {
                localStorage.removeItem('hostGameCode');
                localStorage.removeItem('gameId');
                localStorage.removeItem('isHost');
                localStorage.removeItem('gameCategory');
            }
            location.reload();
        }
    }

    handleSettings() {
        this.closeHamburgerMenu();
        const modalConfig = document.getElementById('modal-game-config');
        if (modalConfig) {
            modalConfig.style.display = 'flex';
        } else {
            alert('Modal de configuración no disponible');
        }
    }

    handleTerminate() {
        this.closeHamburgerMenu();
        if (confirm('¿Estás seguro de que quieres terminar la partida?')) {
            if (typeof StorageManager !== 'undefined') {
                StorageManager.clearHostSession();
            } else {
                localStorage.removeItem('hostGameCode');
                localStorage.removeItem('gameId');
                localStorage.removeItem('isHost');
                localStorage.removeItem('gameCategory');
            }
            location.href = './index.html';
        }
    }

    connectGameClient() {
        if (!window.COMM) {
            console.error('communication.js no cargado');
            return;
        }
        
        this.client = new GameClient(this.gameCode, null, 'host');
        
        this.client.on('connected', () => {
            this.updatePlayersGrid([]);
            this.updateRanking([]);
            this.updateTopWords([]);
        });
        
        this.client.onStateUpdate = (state) => this.handleGameState(state);
        this.client.onConnectionLost = () => {
            alert('Se perdió la conexión con el servidor');
        };
        
        this.client.connect();
    }

    handleGameState(state) {
        this.gameState = state;
        
        if (state.players) {
            this.currentPlayers = Array.isArray(state.players) 
                ? state.players 
                : Object.values(state.players);
        }
        this.updatePlayersGrid(this.currentPlayers);
        this.updateRanking(this.currentPlayers);
        this.updateTopWords(state.topWords || []);
        this.checkStartButtonVisibility();

        const categorySticker = document.getElementById('category-sticker');
        if (categorySticker && state.category) {
            categorySticker.textContent = state.category;
        }

        if (state.round !== undefined) {
            this.currentRound = state.round;
            this.totalRounds = state.total_rounds || 3;
            this.updateRoundInfo();
        }

        if (state.remaining_time !== undefined) {
            this.remainingTime = state.remaining_time;
            this.updateTimer();
        }
        
        if (state.min_players !== undefined) {
            this.minPlayers = state.min_players;
        }
    }

    updatePlayersGrid(players) {
        const grid = document.getElementById('players-grid');
        if (!grid) return;

        grid.innerHTML = '';

        if (!players || players.length === 0) {
            grid.innerHTML = '<div style="text-align: center; color: #999; padding: 20px; grid-column: 1 / -1;">Sin jugadores conectados</div>';
            return;
        }

        players.forEach((player, index) => {
            const squarcle = document.createElement('div');
            squarcle.className = 'player-squarcle';
            squarcle.dataset.playerId = player.id || player.playerId;
            squarcle.style.animationDelay = `${index * 0.1}s`;
            squarcle.style.animation = 'popIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards';
            squarcle.style.background = player.color || 'linear-gradient(135deg, #808080 0%, #404040 100%)';

            const initial = document.createElement('div');
            initial.className = 'player-initial';
            initial.textContent = (player.name || '?').charAt(0).toUpperCase();

            const label = document.createElement('div');
            label.className = 'player-name-label';
            label.textContent = player.name || 'Anónimo';

            squarcle.appendChild(initial);
            squarcle.appendChild(label);
            
            if (player.status === 'ready') {
                const statusBadge = document.createElement('div');
                statusBadge.className = 'player-status-icon';
                statusBadge.textContent = '✓';
                squarcle.appendChild(statusBadge);
            }

            grid.appendChild(squarcle);
        });
    }

    updateRoundInfo() {
        const roundEl = document.getElementById('round-display');
        const totalEl = document.getElementById('total-rounds-display');
        if (roundEl) roundEl.textContent = this.currentRound;
        if (totalEl) totalEl.textContent = this.totalRounds;
    }

    updateTimer() {
        const timerEl = document.getElementById('timer-display');
        if (timerEl) {
            const minutes = Math.floor(this.remainingTime / 60);
            const seconds = this.remainingTime % 60;
            timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }

    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            if (this.remainingTime > 0) {
                this.remainingTime--;
                this.updateTimer();
            } else {
                this.stopTimer();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    checkStartButtonVisibility() {
        const btnStart = document.getElementById('btn-start-game');
        if (!btnStart) return;
        
        const playerCount = this.currentPlayers.length;
        const canStart = playerCount >= this.minPlayers;
        
        if (canStart && btnStart.style.display === 'none') {
            btnStart.style.display = 'block';
            btnStart.style.animation = 'popIn 0.5s ease-out';
        } else if (!canStart && btnStart.style.display !== 'none') {
            btnStart.style.display = 'none';
        }
    }

    updateRanking(players) {
        const list = document.getElementById('ranking-list');
        if (!list) return;

        const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
        list.innerHTML = '';

        if (sorted.length === 0) {
            list.innerHTML = '<div class="panel-item"><div class="name">Sin jugadores aún</div></div>';
            return;
        }

        sorted.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'panel-item';
            item.style.animation = `fadeIn 0.3s ease-out`;
            item.style.animationDelay = `${index * 0.05}s`;
            item.innerHTML = `
                <div class="position">${index + 1}</div>
                <div class="name">${player.name || 'Anónimo'}</div>
                <div class="value">${player.score || 0}</div>
            `;
            list.appendChild(item);
        });
    }

    updateTopWords(topWords) {
        const list = document.getElementById('top-words-list');
        if (!list) return;

        list.innerHTML = '';

        if (!topWords || topWords.length === 0) {
            list.innerHTML = '<div class="panel-item"><div class="name">Sin palabras aún</div></div>';
            return;
        }

        topWords.forEach((wordData, index) => {
            const item = document.createElement('div');
            item.className = 'panel-item';
            item.style.animation = `fadeIn 0.3s ease-out`;
            item.style.animationDelay = `${index * 0.05}s`;
            item.innerHTML = `
                <div class="name">${wordData.word || 'N/A'}</div>
                <div class="value">${wordData.count || 0}</div>
            `;
            list.appendChild(item);
        });
    }

    showResults(results) {
        const overlay = document.getElementById('results-overlay');
        if (!overlay) return;

        const content = document.getElementById('results-content');
        if (!content) return;

        content.innerHTML = (results || []).map((r, i) => `
            <div class="panel-item">
                <div class="position">${i + 1}</div>
                <div class="name">${r.playerName || 'Anónimo'}</div>
                <div class="value">+${r.roundScore || 0}</div>
            </div>
        `).join('');

        overlay.classList.add('active');
        setTimeout(() => {
            overlay.classList.remove('active');
        }, 5000);
    }

    showFinalResults(finalResults) {
        const overlay = document.getElementById('results-overlay');
        if (!overlay) return;

        const panel = overlay.querySelector('.results-title');
        if (panel) panel.textContent = '🏆 Resultados Finales';

        const content = document.getElementById('results-content');
        if (!content) return;

        content.innerHTML = (finalResults || []).map((r, i) => `
            <div class="panel-item">
                <div class="position">${i + 1}</div>
                <div class="name">${r.playerName || 'Anónimo'}</div>
                <div class="value">${r.totalScore || 0}</div>
            </div>
        `).join('');

        overlay.classList.add('active');
    }

    async startGame() {
        if (!this.client) {
            console.error('Cliente no inicializado');
            return;
        }

        try {
            const result = await this.client.sendAction('start_round', {
                game_id: this.gameCode
            });

            if (!result.success) {
                alert(result.message || 'Error al iniciar la ronda');
            }
        } catch (error) {
            console.error('Error en startGame():', error);
            alert('Error de conexión');
        }
    }

    destroy() {
        this.stopTimer();
        if (this.client) {
            this.client.disconnect();
        }
    }
}

let hostManager = null;

function initHostManager() {
    const urlParams = new URLSearchParams(window.location.search);
    let gameCode = urlParams.get('code');

    if (!gameCode) {
        if (typeof StorageManager !== 'undefined' && typeof StorageKeys !== 'undefined') {
            gameCode = StorageManager.get(StorageKeys.HOST_GAME_CODE);
        } else {
            gameCode = localStorage.getItem('hostGameCode');
        }
    }

    if (!gameCode) {
        return;
    }

    hostManager = new HostManager(gameCode);

    window.addEventListener('beforeunload', () => {
        if (hostManager) hostManager.destroy();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHostManager);
} else {
    initHostManager();
}