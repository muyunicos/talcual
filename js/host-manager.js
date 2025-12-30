/**
 * Host Manager - Floating Panels Architecture (Fixed v2)
 * Gestiona: timer, categoría tab, fade ranking/top, panel draggable
 * 
 * MEJORAS:
 * - Sin redirect forzado si no hay código (modal es visible)
 * - Espera a que modal cree partida y guarde código
 * - Luego init del Manager automáticamente
 */

class HostManager {
    constructor(gameCode) {
        this.gameCode = gameCode;
        this.eventSource = null;
        this.currentRound = 0;
        this.totalRounds = 3;
        this.remainingTime = 0;
        this.timerInterval = null;
        this.activeTab = 'ranking';

        console.log('🎮 HostManager iniciando con código:', this.gameCode);
        
        this.initUI();
        this.attachEventListeners();
        this.connectSSE();
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

    connectSSE() {
        const eventUrl = `/api/host/events.php?code=${encodeURIComponent(this.gameCode)}`;
        console.log('🔌 Conectando SSE a:', eventUrl);

        this.eventSource = new EventSource(eventUrl);

        this.eventSource.addEventListener('game_state', (e) => {
            try {
                const state = JSON.parse(e.data);
                console.log('📨 game_state:', state);
                this.handleGameState(state);
            } catch (err) {
                console.error('❌ Error parsing game_state:', err);
            }
        });

        this.eventSource.addEventListener('player_joined', (e) => {
            try {
                const player = JSON.parse(e.data);
                console.log('👤 player_joined:', player);
                this.addPlayer(player);
            } catch (err) {
                console.error('❌ Error parsing player_joined:', err);
            }
        });

        this.eventSource.addEventListener('player_left', (e) => {
            try {
                const data = JSON.parse(e.data);
                console.log('👤 player_left:', data);
                this.removePlayer(data.playerId);
            } catch (err) {
                console.error('❌ Error parsing player_left:', err);
            }
        });

        this.eventSource.addEventListener('round_start', (e) => {
            try {
                const data = JSON.parse(e.data);
                console.log('⏱️ round_start:', data);
                this.handleRoundStart(data);
            } catch (err) {
                console.error('❌ Error parsing round_start:', err);
            }
        });

        this.eventSource.addEventListener('round_end', (e) => {
            try {
                const data = JSON.parse(e.data);
                console.log('⏹️ round_end:', data);
                this.handleRoundEnd(data);
            } catch (err) {
                console.error('❌ Error parsing round_end:', err);
            }
        });

        this.eventSource.addEventListener('game_end', (e) => {
            try {
                const data = JSON.parse(e.data);
                console.log('🏁 game_end:', data);
                this.handleGameEnd(data);
            } catch (err) {
                console.error('❌ Error parsing game_end:', err);
            }
        });

        this.eventSource.onerror = (err) => {
            console.error('❌ SSE error:', err);
            if (this.eventSource.readyState === EventSource.CLOSED) {
                console.warn('⚠️ SSE desconectado. Reintentando en 3s...');
                setTimeout(() => this.connectSSE(), 3000);
            }
        };

        console.log('✅ SSE conectado');
    }

    handleGameState(state) {
        this.updatePlayers(state.players || []);
        this.updateRanking(state.players || []);
        this.updateTopWords(state.topWords || []);

        const categorySticker = document.getElementById('category-sticker');
        if (categorySticker && state.category) {
            categorySticker.textContent = state.category;
        }

        if (state.currentRound !== undefined) {
            this.currentRound = state.currentRound;
            this.totalRounds = state.totalRounds || 3;
            this.updateRoundInfo();
        }

        if (state.remainingTime !== undefined) {
            this.remainingTime = state.remainingTime;
            this.updateTimer();
        }
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

    updatePlayers(players) {
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

        players.forEach(player => {
            const squarcle = document.createElement('div');
            squarcle.className = 'player-squarcle';
            squarcle.dataset.playerId = player.id;

            if (player.color) {
                squarcle.style.background = player.color;
            }

            squarcle.innerHTML = `
                <div class="squarcle-initial">${(player.name || '?').charAt(0).toUpperCase()}</div>
                <div class="squarcle-name">${player.name || 'Anónimo'}</div>
                ${player.ready ? '<div class="squarcle-status ready">✓</div>' : ''}
            `;

            grid.appendChild(squarcle);
        });

        console.log(`✅ ${players.length} jugadores renderizados`);
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

        topWords.forEach(wordData => {
            const item = document.createElement('div');
            item.className = 'panel-item';
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

    addPlayer(player) {
        console.log('👤 Jugador agregado:', player);
    }

    removePlayer(playerId) {
        console.log('👤 Jugador removido:', playerId);
        const squarcle = document.querySelector(`[data-player-id="${playerId}"]`);
        if (squarcle) squarcle.remove();
    }

    handleRoundStart(data) {
        console.log('⏱️ Ronda iniciada:', data);
        this.currentRound = data.round || 1;
        this.remainingTime = data.timeLimit || 60;
        this.updateRoundInfo();
        this.startTimer();
    }

    handleRoundEnd(data) {
        console.log('⏹️ Ronda finalizada:', data);
        this.stopTimer();
        this.showResults(data.results || []);
    }

    handleGameEnd(data) {
        console.log('🏁 Juego finalizado:', data);
        this.stopTimer();
        this.showFinalResults(data.finalResults || []);
    }

    async startGame() {
        console.log('▶️ Iniciando juego...');
        try {
            const response = await fetch('/api/host/start_game.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: this.gameCode })
            });

            const result = await response.json();
            if (!result.success) {
                console.error('❌ Error:', result.error);
                alert(result.error || 'Error al iniciar el juego');
            } else {
                console.log('✅ Juego iniciado');
            }
        } catch (error) {
            console.error('❌ Error en startGame():', error);
            alert('Error de conexión');
        }
    }

    destroy() {
        this.stopTimer();
        if (this.eventSource) {
            this.eventSource.close();
            console.log('🔌 SSE desconectado');
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

    // SIN código: mostrar modal de crear partida
    if (!gameCode) {
        console.log('⚠️ Sin código de partida - mostrando modal de crear');
        const modalCreate = document.getElementById('modal-create-game');
        if (modalCreate) {
            modalCreate.style.display = 'flex';
            console.log('✅ Modal de crear partida mostrado');
        }
        return; // NO inicializar Manager aún
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
