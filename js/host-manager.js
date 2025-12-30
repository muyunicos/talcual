/**
 * Host Manager - Floating Panels Architecture
 * Gestiona: timer, categoría tab, fade ranking/top, panel draggable (TODO: integrate interact.js)
 */

class HostManager {
    constructor(gameCode) {
        this.gameCode = gameCode;
        this.eventSource = null;
        this.currentRound = 0;
        this.totalRounds = 3;
        this.remainingTime = 0;
        this.timerInterval = null;

        this.activeTab = 'ranking'; // 'ranking' | 'topwords'

        this.initUI();
        this.attachEventListeners();
        this.connectSSE();
    }

    initUI() {
        // Código sala
        const codeValueEl = document.getElementById('code-sticker-value');
        if (codeValueEl) {
            codeValueEl.textContent = this.gameCode;
        }

        // Copy to clipboard
        const codeSticker = document.querySelector('.code-sticker-floating');
        if (codeSticker) {
            codeSticker.addEventListener('click', () => {
                navigator.clipboard.writeText(this.gameCode).then(() => {
                    console.log('Código copiado:', this.gameCode);
                    // TODO: mostrar toast/feedback visual
                });
            });
        }

        // Tabs panel lateral
        this.initPanelTabs();

        // TODO: init draggable/resizable con interact.js o custom
    }

    initPanelTabs() {
        const tabs = document.querySelectorAll('.panel-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab; // 'ranking' | 'topwords'
                this.switchTab(targetTab);
            });
        });

        // Set inicial
        this.switchTab(this.activeTab);
    }

    switchTab(tabName) {
        this.activeTab = tabName;

        // Update tabs
        const tabs = document.querySelectorAll('.panel-tab');
        tabs.forEach(t => {
            if (t.dataset.tab === tabName) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });

        // Update views (fade)
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
        // Botón empezar
        const btnStart = document.getElementById('btn-start-game');
        if (btnStart) {
            btnStart.addEventListener('click', () => this.startGame());
        }
    }

    connectSSE() {
        this.eventSource = new EventSource(`/api/host/events.php?code=${this.gameCode}`);

        this.eventSource.addEventListener('game_state', (e) => {
            const state = JSON.parse(e.data);
            this.handleGameState(state);
        });

        this.eventSource.addEventListener('player_joined', (e) => {
            const player = JSON.parse(e.data);
            this.addPlayer(player);
        });

        this.eventSource.addEventListener('player_left', (e) => {
            const data = JSON.parse(e.data);
            this.removePlayer(data.playerId);
        });

        this.eventSource.addEventListener('round_start', (e) => {
            const data = JSON.parse(e.data);
            this.handleRoundStart(data);
        });

        this.eventSource.addEventListener('round_end', (e) => {
            const data = JSON.parse(e.data);
            this.handleRoundEnd(data);
        });

        this.eventSource.addEventListener('game_end', (e) => {
            const data = JSON.parse(e.data);
            this.handleGameEnd(data);
        });

        this.eventSource.onerror = (err) => {
            console.error('SSE error:', err);
            // TODO: retry logic
        };
    }

    handleGameState(state) {
        console.log('Game state:', state);

        // Update players
        this.updatePlayers(state.players || []);

        // Update ranking
        this.updateRanking(state.players || []);

        // Update top words
        this.updateTopWords(state.topWords || []);

        // Update category sticker
        const categorySticker = document.querySelector('.category-sticker');
        if (categorySticker && state.category) {
            categorySticker.textContent = state.category;
        }

        // Update round info
        if (state.currentRound !== undefined) {
            this.currentRound = state.currentRound;
            this.totalRounds = state.totalRounds || 3;
            this.updateRoundInfo();
        }

        // Update timer
        if (state.remainingTime !== undefined) {
            this.remainingTime = state.remainingTime;
            this.updateTimer();
        }

        // Update center stage
        this.updateCenterStage(state);
    }

    updateRoundInfo() {
        const roundInfoEl = document.querySelector('.round-info');
        if (roundInfoEl) {
            roundInfoEl.textContent = `Ronda ${this.currentRound}/${this.totalRounds}`;
        }
    }

    updateTimer() {
        const timerEl = document.querySelector('.timer-display');
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

    updateCenterStage(state) {
        const centerStage = document.querySelector('.center-stage');
        if (!centerStage) return;

        // Clear
        centerStage.innerHTML = '';

        switch (state.phase) {
            case 'waiting':
                centerStage.innerHTML = `
                    <div class="status-message">Esperando jugadores...</div>
                    <button id="btn-start-game" class="btn-empezar">Empezar Juego</button>
                `;
                // Re-attach
                const btnStart = document.getElementById('btn-start-game');
                if (btnStart) {
                    btnStart.addEventListener('click', () => this.startGame());
                }
                break;

            case 'countdown':
                centerStage.innerHTML = `
                    <div class="countdown-display">${state.countdown || 3}</div>
                `;
                break;

            case 'playing':
                centerStage.innerHTML = `
                    <div class="category-display">
                        <span class="label">Categoría:</span>
                        <span class="value">${state.category || ''}</span>
                    </div>
                    <div class="word-display">
                        <div class="label">Consigna</div>
                        <div class="word">${state.prompt || ''}</div>
                    </div>
                `;
                break;

            case 'round_ended':
                // Mostrar results overlay
                this.showResults(state.results || []);
                break;

            case 'game_ended':
                // Mostrar final results
                this.showFinalResults(state.finalResults || []);
                break;

            default:
                centerStage.innerHTML = `<div class="status-message">Cargando...</div>`;
        }
    }

    updatePlayers(players) {
        const playersGrid = document.querySelector('.players-grid');
        if (!playersGrid) return;

        playersGrid.innerHTML = '';

        players.forEach(player => {
            const squarcle = document.createElement('div');
            squarcle.className = 'player-squarcle';
            squarcle.dataset.playerId = player.id;

            squarcle.innerHTML = `
                <div class="squarcle-initial">${player.name.charAt(0).toUpperCase()}</div>
                <div class="squarcle-name">${player.name}</div>
                ${player.ready ? '<div class="squarcle-status ready">✓</div>' : ''}
            `;

            playersGrid.appendChild(squarcle);
        });
    }

    updateRanking(players) {
        const rankingList = document.getElementById('ranking-list');
        if (!rankingList) return;

        // Sort by score
        const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

        rankingList.innerHTML = '';

        sorted.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'panel-item';
            item.innerHTML = `
                <div class="position">${index + 1}</div>
                <div class="name">${player.name}</div>
                <div class="value">${player.score || 0}</div>
            `;
            rankingList.appendChild(item);
        });
    }

    updateTopWords(topWords) {
        const topWordsList = document.getElementById('top-words-list');
        if (!topWordsList) return;

        topWordsList.innerHTML = '';

        if (!topWords || topWords.length === 0) {
            topWordsList.innerHTML = '<div class="panel-item"><div class="name">Sin palabras aún</div></div>';
            return;
        }

        topWords.forEach(wordData => {
            const item = document.createElement('div');
            item.className = 'panel-item';
            item.innerHTML = `
                <div class="name">${wordData.word}</div>
                <div class="value">${wordData.count}</div>
            `;
            topWordsList.appendChild(item);
        });
    }

    showResults(results) {
        const overlay = document.querySelector('.results-overlay');
        if (!overlay) return;

        const panel = overlay.querySelector('.results-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="results-title">Resultados Ronda ${this.currentRound}</div>
            <div class="panel-list">
                ${results.map((r, i) => `
                    <div class="panel-item">
                        <div class="position">${i + 1}</div>
                        <div class="name">${r.playerName}</div>
                        <div class="value">+${r.roundScore || 0}</div>
                    </div>
                `).join('')}
            </div>
        `;

        overlay.classList.add('active');

        // Auto-hide después de X segundos
        setTimeout(() => {
            overlay.classList.remove('active');
        }, 5000);
    }

    showFinalResults(finalResults) {
        const overlay = document.querySelector('.results-overlay');
        if (!overlay) return;

        const panel = overlay.querySelector('.results-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="results-title">🏆 Resultados Finales</div>
            <div class="panel-list">
                ${finalResults.map((r, i) => `
                    <div class="panel-item">
                        <div class="position">${i + 1}</div>
                        <div class="name">${r.playerName}</div>
                        <div class="value">${r.totalScore || 0}</div>
                    </div>
                `).join('')}
            </div>
        `;

        overlay.classList.add('active');

        // No auto-hide en final results
    }

    addPlayer(player) {
        console.log('Player joined:', player);
        // Re-fetch state (SSE game_state event lo actualiza)
    }

    removePlayer(playerId) {
        console.log('Player left:', playerId);
        const squarcle = document.querySelector(`[data-player-id="${playerId}"]`);
        if (squarcle) {
            squarcle.remove();
        }
    }

    handleRoundStart(data) {
        console.log('Round start:', data);
        this.currentRound = data.round;
        this.remainingTime = data.timeLimit || 60;
        this.updateRoundInfo();
        this.startTimer();
    }

    handleRoundEnd(data) {
        console.log('Round end:', data);
        this.stopTimer();
        this.showResults(data.results || []);
    }

    handleGameEnd(data) {
        console.log('Game end:', data);
        this.stopTimer();
        this.showFinalResults(data.finalResults || []);
    }

    async startGame() {
        try {
            const response = await fetch('/api/host/start_game.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: this.gameCode })
            });

            const result = await response.json();
            if (!result.success) {
                console.error('Error starting game:', result.error);
                alert(result.error || 'Error al iniciar el juego');
            }
        } catch (error) {
            console.error('Error starting game:', error);
            alert('Error al iniciar el juego');
        }
    }

    destroy() {
        this.stopTimer();
        if (this.eventSource) {
            this.eventSource.close();
        }
    }
}

// Init
const urlParams = new URLSearchParams(window.location.search);
const gameCode = urlParams.get('code');

if (!gameCode) {
    alert('No se especificó código de sala');
    window.location.href = '/index.html';
} else {
    const hostManager = new HostManager(gameCode);

    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
        hostManager.destroy();
    });
}
