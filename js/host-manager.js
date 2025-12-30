/**
 * Host Manager - Integración completa con menú hamburguesa
 * Gestiona: timer, categoría, ranking/top words, panel tabs, menú hamburguesa
 * 
 * MEJORAS v9 (30 Dic 2025):
 * - Integrada funcionalidad de menú hamburguesa
 * - Opciones funcionando: Reiniciar Ronda, Nuevo Juego, Opciones, Terminar
 * - Categoría persistente en localStorage
 * - FASE 2: Función centralizada determineUIState() para visibilidad
 * - FASE 3: Consolidación UI - Solo clases CSS, eliminados inline styles conflictivos
 */

/**
 * Determina qué UI mostrar basándose en el estado de sesión
 * Se ejecuta al cargar y después de cada cambio de estado crítico
 * 
 * FASE 3: Simplificado - Solo maneja clases del <html>
 * - El CSS con .session-only/.nosession-only + !important maneja todo
 * - Sin inline styles que compitan con CSS
 * - Sin manipulación manual de display: none/flex/block
 */
function determineUIState() {
    const hasSession = StorageManager.isHostSessionActive();
    const gameCode = StorageManager.get(StorageKeys.HOST_GAME_CODE);
    
    console.log(`📋 determineUIState() - Session: ${hasSession}, Code: ${gameCode || 'none'}`);

    // Único trabajo: sincronizar las clases del <html>
    // host.html usa .no-session/.has-session + CSS !important para controlar visibilidad
    const root = document.documentElement;
    
    if (hasSession && gameCode) {
        root.classList.add('has-session');
        root.classList.remove('no-session');
        console.log('🎮 determineUIState: Sesión activa - UI mostrada por CSS');
    } else {
        root.classList.add('no-session');
        root.classList.remove('has-session');
        console.log('➕ determineUIState: Sin sesión - Modal visible por CSS');
    }
}

// Ejecutar determineUIState cuando el DOM esté listo
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
        
        // Menú hamburguesa
        this.btnHamburger = document.getElementById('btn-hamburger-host');
        this.hamburgerMenu = document.getElementById('hamburger-menu-host');
        this.isMenuOpen = false;

        console.log('🎮 HostManager iniciando con código:', this.gameCode);
        
        this.initUI();
        this.attachEventListeners();
        this.initHamburgerMenu();
        this.connectGameClient();
    }

    /**
     * FASE 1: Valida que exista una sesión activa de host
     * Si no existe sesión, retorna false y deja que CSS muestre el modal
     * @returns {boolean} true si hay sesión activa, false si no
     */
    checkActiveSession() {
        const hasSession = StorageManager.isHostSessionActive();
        if (!hasSession) {
            console.warn('⚠️ Sin sesión activa - CSS mostrará modal automáticamente');
        }
        return hasSession;
    }

    initUI() {
        // FASE 1: Validar sesión antes de inicializar UI
        const hasSession = this.checkActiveSession();
        if (!hasSession) {
            console.log('⚠️ UI no inicializado: sin sesión activa');
            return;
        }

        const codeValueEl = document.getElementById('code-sticker-value');
        if (codeValueEl) {
            codeValueEl.textContent = this.gameCode;
            console.log('✅ Código de sala mostrado:', this.gameCode);
        } else {
            console.warn('⚠️ Elemento #code-sticker-value no encontrado');
        }

        const codeSticker = document.querySelector('.code-sticker-floating');
        if (codeSticker) {
            codeSticker.addEventListener('click', () => {
                navigator.clipboard.writeText(this.gameCode).then(() => {
                    console.log('📋 Código copiado al clipboard:', this.gameCode);
                }).catch(err => {
                    console.error('❌ Error copiando código:', err);
                });
            });
        }

        this.initPanelTabs();

        console.log('✅ UI inicializado');
    }

    initPanelTabs() {
        const tabs = document.querySelectorAll('.panel-tab');
        if (tabs.length === 0) {
            console.warn('⚠️ Tabs del panel no encontrados');
            return;
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                console.log('🔄 Cambiando a tab:', targetTab);
                this.switchTab(targetTab);
            });
        });

        this.switchTab(this.activeTab);
        console.log('✅ Panel tabs inicializado');
    }

    switchTab(tabName) {
        this.activeTab = tabName;

        const tabs = document.querySelectorAll('.panel-tab');
        tabs.forEach(t => {
            if (t.dataset.tab === tabName) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });

        const views = document.querySelectorAll('.panel-view');
        views.forEach(v => {
            if (v.dataset.view === tabName) {
                v.classList.add('active');
            } else {
                v.classList.remove('active');
            }
        });
    }

    attachEventListeners() {
        const btnStart = document.getElementById('btn-start-game');
        if (btnStart) {
            btnStart.addEventListener('click', () => {
                console.log('▶️ Click en btn-start-game');
                this.startGame();
            });
        } else {
            console.warn('⚠️ Botón #btn-start-game no encontrado');
        }
    }

    // FIX #54: Menú hamburguesa integrado
    initHamburgerMenu() {
        if (!this.btnHamburger || !this.hamburgerMenu) {
            console.warn('⚠️ Menú hamburguesa no encontrado');
            return;
        }

        console.log('🍔 Inicializando menú hamburguesa...');

        // Toggle
        this.btnHamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleHamburgerMenu();
        });

        // Cerrar al click afuera
        document.addEventListener('click', (e) => {
            if (this.isMenuOpen && 
                !this.hamburgerMenu.contains(e.target) && 
                !this.btnHamburger.contains(e.target)) {
                this.closeHamburgerMenu();
            }
        });

        // Opciones
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

        console.log('✅ Menú hamburguesa inicializado');
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
        console.log('📂 Menú abierto');
    }

    closeHamburgerMenu() {
        this.isMenuOpen = false;
        this.hamburgerMenu.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (!this.isMenuOpen) {
                this.hamburgerMenu.style.display = 'none';
            }
        }, 300);
        console.log('📂 Menú cerrado');
    }

    handleRestartRound() {
        console.log('🔄 Reiniciando ronda...');
        this.closeHamburgerMenu();
        
        if (confirm('¿Reiniciar la ronda actual?')) {
            this.startGame();
        }
    }

    handleNewGame() {
        console.log('🎮 Nueva partida...');
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
        console.log('⚙️ Abriendo opciones avanzadas...');
        this.closeHamburgerMenu();
        
        const modalConfig = document.getElementById('modal-game-config');
        if (modalConfig) {
            modalConfig.style.display = 'flex';
            console.log('✅ Modal de configuración abierto');
        } else {
            alert('Modal de configuración no disponible');
        }
    }

    handleTerminate() {
        console.log('🚫 Terminando partida...');
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
            console.error('❌ communication.js no cargado');
            return;
        }

        console.log('🔌 Conectando GameClient para HOST...');
        
        this.client = new GameClient(this.gameCode, null, 'host');
        
        this.client.on('connected', () => {
            console.log('✅ Host conectado a SSE - renderizando estado inicial');
            this.updatePlayersGrid([]);
            this.updateRanking([]);
            this.updateTopWords([]);
        });
        
        this.client.onStateUpdate = (state) => this.handleGameState(state);
        
        this.client.onConnectionLost = () => {
            console.error('❌ Conexión perdida');
            alert('Se perdió la conexión con el servidor');
        };
        
        this.client.connect();
        console.log('✅ GameClient conectado');
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
            console.log('⚙️ Mínimo de jugadores:', this.minPlayers);
        }
    }

    updatePlayersGrid(players) {
        const grid = document.getElementById('players-grid');
        if (!grid) {
            console.warn('⚠️ #players-grid no encontrado');
            return;
        }

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

            if (player.color) {
                squarcle.style.background = player.color;
            } else {
                squarcle.style.background = 'linear-gradient(135deg, #808080 0%, #404040 100%)';
            }

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

        console.log(`✅ ${players.length} jugadores renderizados`);
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
            console.log(`✅ Botón visible (${playerCount}/${this.minPlayers} jugadores)`);
        } else if (!canStart && btnStart.style.display !== 'none') {
            btnStart.style.display = 'none';
            console.log(`⏳ Esperando ${this.minPlayers - playerCount} jugador(es) más`);
        }
    }

    updateRanking(players) {
        const list = document.getElementById('ranking-list');
        if (!list) {
            console.warn('⚠️ #ranking-list no encontrado');
            return;
        }

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
        if (!list) {
            console.warn('⚠️ #top-words-list no encontrado');
            return;
        }

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
        if (!overlay) {
            console.warn('⚠️ #results-overlay no encontrado');
            return;
        }

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
        console.log('▶️ Iniciando juego...');
        if (!this.client) {
            console.error('❌ Cliente no inicializado');
            return;
        }

        try {
            const result = await this.client.sendAction('start_round', {
                game_id: this.gameCode
            });

            if (result.success) {
                console.log('✅ Ronda iniciada');
            } else {
                console.error('❌ Error:', result.message);
                alert(result.message || 'Error al iniciar la ronda');
            }
        } catch (error) {
            console.error('❌ Error en startGame():', error);
            alert('Error de conexión');
        }
    }

    destroy() {
        this.stopTimer();
        if (this.client) {
            this.client.disconnect();
            console.log('🔌 GameClient desconectado');
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
        console.log('⚠️ Sin código de partida - esperando al modal de crear');
        return;
    }

    console.log('🎮 Iniciando Host Manager con código:', gameCode);
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

console.log('%c✅ host-manager.js v9 - FASE 3: Solo clases CSS, sin inline styles conflictivos', 'color: #10B981; font-weight: bold');
