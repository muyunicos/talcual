/**
 * Host Manager - Reconectado a arquitectura real (GameClient + /app/actions.php)
 * Gestiona: timer, categoría tab, fade ranking/top, panel draggable
 * 
 * MEJORAS v5:
 * - FIX: Usa GameClient en lugar de /api/host/events.php inexistente
 * - FIX: Llama updatePlayersGrid() en handleGameState()
 * - FIX: Modales centrados con flexbox
 * - FIX: Escucha evento 'connected' para renderizar estado inicial (FIX #52)
 * - Controla visibilidad del botón "Empezar Juego" según mín jugadores
 * - Anima entrada de elementos cuando aparecen jugadores
 */

class HostManager {
    constructor(gameCode) {
        this.gameCode = gameCode;
        this.client = null;  // GameClient instance (FIX)
        this.currentRound = 0;
        this.totalRounds = 3;
        this.remainingTime = 0;
        this.timerInterval = null;
        this.activeTab = 'ranking';
        this.minPlayers = 2; // Por defecto
        this.currentPlayers = [];
        this.gameState = {};

        console.log('🎮 HostManager iniciando con código:', this.gameCode);
        
        this.initUI();
        this.attachEventListeners();
        this.connectGameClient();  // FIX: Usar GameClient
    }

    initUI() {
        // Código sala - display
        const codeValueEl = document.getElementById('code-sticker-value');
        if (codeValueEl) {
            codeValueEl.textContent = this.gameCode;
            console.log('✅ Código de sala mostrado:', this.gameCode);
        } else {
            console.warn('⚠️ Elemento #code-sticker-value no encontrado');
        }

        // Copy to clipboard
        const codeSticker = document.querySelector('.code-sticker-floating');
        if (codeSticker) {
            codeSticker.addEventListener('click', () => {
                navigator.clipboard.writeText(this.gameCode).then(() => {
                    console.log('📋 Código copiado al clipboard:', this.gameCode);
                }).catch(err => {
                    console.error('❌ Error copiando código:', err);
                    const codeValueEl = document.getElementById('code-sticker-value');
                    codeValueEl?.select?.();
                });
            });
        }

        // Tabs del panel lateral
        this.initPanelTabs();
        
        // Ocultar modal de crear partida
        const modalCreate = document.getElementById('modal-create-game');
        if (modalCreate) {
            modalCreate.style.display = 'none';
            console.log('✅ Modal de crear ocultado');
        }

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

    /**
     * FIX #38: Usar GameClient en lugar de EventSource directo
     * FIX #52: Agregar listener 'connected' para renderizar estado inicial
     * Conecta a /app/sse-stream.php con player_id=null para host
     */
    connectGameClient() {
        if (!window.COMM) {
            console.error('❌ communication.js no cargado');
            return;
        }

        console.log('🔌 Conectando GameClient para HOST...');
        
        // Crear cliente sin player_id (es el host)
        this.client = new GameClient(this.gameCode, null, 'host');
        
        // FIX #52: Escuchar evento 'connected' para renderizar estado inicial
        this.client.on('connected', () => {
            console.log('✅ Host conectado a SSE - renderizando estado inicial');
            // Renderizar estado vacío inicial mientras no haya jugadores
            this.updatePlayersGrid([]);
            this.updateRanking([]);
            this.updateTopWords([]);
        });
        
        // Escuchar cambios de estado
        this.client.onStateUpdate = (state) => this.handleGameState(state);
        
        // Escuchar conexión perdida
        this.client.onConnectionLost = () => {
            console.error('❌ Conexión perdida');
            alert('Se perdió la conexión con el servidor');
        };
        
        // Conectar
        this.client.connect();
        console.log('✅ GameClient conectado');
    }

    /**
     * FIX #1: Renderizar squarcles de jugadores
     * Ahora se llama desde handleGameState()
     */
    handleGameState(state) {
        this.gameState = state;
        
        // FIX #1: Guardar y renderizar jugadores
        if (state.players) {
            this.currentPlayers = Array.isArray(state.players) 
                ? state.players 
                : Object.values(state.players);
        }
        this.updatePlayersGrid(this.currentPlayers);  // ← FIX: Ahora se llama
        
        // Actualizar otros elementos
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

    /**
     * FIX #1: Renderiza squarcles en #players-grid
     * Ahora con colores degradados desde state.players[i].color
     */
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
            squarcle.style.animationDelay = `${index * 0.1}s`; // Stagger animation
            squarcle.style.animation = 'popIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards';

            // Aplicar color degradado si existe
            if (player.color) {
                squarcle.style.background = player.color;
            } else {
                squarcle.style.background = 'linear-gradient(135deg, #808080 0%, #404040 100%)';
            }

            const initial = document.createElement('div');
            initial.className = 'squarcle-initial';
            initial.textContent = (player.name || '?').charAt(0).toUpperCase();

            const label = document.createElement('div');
            label.className = 'squarcle-name';
            label.textContent = player.name || 'Anónimo';

            squarcle.appendChild(initial);
            squarcle.appendChild(label);
            
            // Indicador de estado (opcional)
            if (player.status === 'ready') {
                const statusBadge = document.createElement('div');
                statusBadge.className = 'squarcle-status ready';
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
            // Mostrar con animación
            btnStart.style.display = 'block';
            btnStart.style.animation = 'popIn 0.5s ease-out';
            console.log(`✅ Botón visible (${playerCount}/${this.minPlayers} jugadores)`);
        } else if (!canStart && btnStart.style.display !== 'none') {
            // Ocultar
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

// ===== INIT =====
let hostManager = null; // Global para que sea accesible desde otros scripts

function initHostManager() {
    const urlParams = new URLSearchParams(window.location.search);
    let gameCode = urlParams.get('code');

    // Fallback: localStorage
    if (!gameCode) {
        gameCode = localStorage.getItem('hostGameCode');
    }

    // SIN código: el enhanced-create-game-modal maneja esto
    if (!gameCode) {
        console.log('⚠️ Sin código de partida - esperando al modal de crear');
        return;
    }

    // CON código: inicializar Manager
    console.log('🎮 Iniciando Host Manager con código:', gameCode);
    hostManager = new HostManager(gameCode);

    // Cleanup
    window.addEventListener('beforeunload', () => {
        if (hostManager) hostManager.destroy();
    });
}

// Init cuando DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHostManager);
} else {
    initHostManager();
}

console.log('%c✅ host-manager.js - FIX #52: Listener connected para renderizar estado inicial', 'color: #10B981; font-weight: bold');