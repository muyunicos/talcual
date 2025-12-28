// ============================================================================
// js/host-manager.js - Gestor del Host
// ============================================================================
// Reúne toda la lógica, UI y eventos del host en un solo archivo modular

console.log('🎮 Host Manager v2.0 - Unified');

class HostManager {
    constructor() {
        // Variables de estado
        this.gameId = null;
        this.client = null;
        this.timerInterval = null;
        this.autoShortenTriggered = false;

        // Referencias a elementos del DOM
        this.elements = {
            modalCreateGame: document.getElementById('modal-create-game'),
            gameScreen: document.getElementById('game-screen'),
            customCodeInput: document.getElementById('custom-code'),
            btnCreateGame: document.getElementById('btn-create-game'),
            statusMessage: document.getElementById('status-message'),
            gameCodeTv: document.getElementById('game-code-tv'),
            timerDisplay: document.getElementById('timer-display'),
            wordDisplay: document.getElementById('word-display'),
            statusMessageCenter: document.getElementById('status-message'),
            countdownDisplay: document.getElementById('countdown-display'),
            rankingList: document.getElementById('ranking-list'),
            topWordsList: document.getElementById('top-words-list'),
            playersGrid: document.getElementById('players-grid'),
            btnStartRound: document.getElementById('btn-start-round'),
            btnEndRound: document.getElementById('btn-end-round'),
            btnNewGame: document.getElementById('btn-new-game'),
            controlsPanel: document.getElementById('controls-panel'),
        };
    }

    /**
     * Inicializa el manager y carga la interfaz
     */
    initialize() {
        console.log('🔧 Inicializando HostManager...');

        const savedGameId = getLocalStorage('gameId');
        const isHost = getLocalStorage('isHost') === 'true';

        if (savedGameId && isHost) {
            console.log('✅ Sesión de host encontrada:', savedGameId);
            this.loadHostScreen(savedGameId);
        } else {
            console.log('📏 No hay sesión, mostrando formulario de creación');
            this.showCreateGameModal();
        }

        this.setupEventListeners();
    }

    /**
     * Configura todos los event listeners
     */
    setupEventListeners() {
        // Botón crear juego
        if (this.elements.btnCreateGame) {
            this.elements.btnCreateGame.addEventListener('click', () => this.createGame());
            this.elements.customCodeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.createGame();
            });
        }

        // Botones de control
        if (this.elements.btnStartRound) {
            this.elements.btnStartRound.addEventListener('click', () => this.startNewRound());
        }
        if (this.elements.btnEndRound) {
            this.elements.btnEndRound.addEventListener('click', () => this.endRound());
        }
        if (this.elements.btnNewGame) {
            this.elements.btnNewGame.addEventListener('click', () => this.resetGame());
        }

        // Teclado
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    /**
     * Maneja eventos de teclado
     */
    handleKeyboard(e) {
        // Tecla 'C' para mostrar/ocultar controles
        if (e.key.toLowerCase() === 'c') {
            if (this.elements.controlsPanel) {
                this.elements.controlsPanel.classList.toggle('visible');
            }
        }
        // Tecla 'Enter' para iniciar ronda
        if (e.key === 'Enter') {
            const startBtn = this.elements.btnStartRound;
            if (startBtn && !startBtn.disabled) {
                startBtn.click();
            }
        }
    }

    /**
     * Muestra modal de creación de juego
     */
    showCreateGameModal() {
        if (this.elements.modalCreateGame) {
            this.elements.modalCreateGame.classList.add('active');
        }
    }

    /**
     * Crea un nuevo juego
     */
    async createGame() {
        const customCode = this.elements.customCodeInput.value.trim().toUpperCase();
        const statusMsg = this.elements.statusMessage;
        const btnCreate = this.elements.btnCreateGame;

        // Validación
        if (customCode && !isValidGameCode(customCode)) {
            showNotification('Código inválido (3-6 caracteres)', 'warning', statusMsg);
            return;
        }

        btnCreate.disabled = true;
        btnCreate.textContent = '⏳ Creando...';
        showNotification('⏳ Creando partida...', 'info', statusMsg);

        try {
            const response = await fetch('/app/actions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_game',
                    game_id: customCode || undefined
                })
            });

            const result = await response.json();

            if (result.success) {
                const gameId = result.game_id;
                showNotification(`✅ Partida creada: ${gameId}`, 'success', statusMsg);

                setLocalStorage('gameId', gameId);
                setLocalStorage('isHost', 'true');

                setTimeout(() => {
                    this.elements.modalCreateGame.classList.remove('active');
                    this.loadHostScreen(gameId);
                }, 1000);
            } else {
                showNotification(`❌ Error: ${result.message}`, 'error', statusMsg);
                btnCreate.disabled = false;
                btnCreate.textContent = '🎮 Crear Partida';
            }
        } catch (error) {
            console.error('❌ Error creando juego:', error);
            showNotification(`❌ Error de conexión: ${error.message}`, 'error', statusMsg);
            btnCreate.disabled = false;
            btnCreate.textContent = '🎮 Crear Partida';
        }
    }

    /**
     * Carga la pantalla del host
     */
    async loadHostScreen(gameId) {
        console.log('🔌 Cargando pantalla de host con gameId:', gameId);

        this.gameId = gameId;
        this.elements.gameCodeTv.textContent = gameId;
        this.elements.gameScreen.classList.add('active');

        await this.initializeHost(gameId);
    }

    /**
     * Inicializa la conexión con el servidor
     */
    async initializeHost(gameId) {
        try {
            console.log('🔧 Verificando si el juego existe...');

            const checkResponse = await fetch('/app/actions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get_state',
                    game_id: gameId
                })
            });

            const checkData = await checkResponse.json();

            if (!checkData.success) {
                console.log('⚠️ Juego no encontrado, creando nuevo...');

                const createResponse = await fetch('/app/actions.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'create_game'
                    })
                });

                const createData = await createResponse.json();

                if (createData.success) {
                    const newGameId = createData.game_id;
                    console.log('✅ Juego creado con ID:', newGameId);

                    setLocalStorage('gameId', newGameId);
                    this.elements.gameCodeTv.textContent = newGameId;

                    window.location.reload();
                    return;
                } else {
                    console.error('❌ Error creando juego:', createData.message);
                    alert('Error al crear el juego. Intenta nuevamente.');
                    clearGameSession();
                    window.location.href = 'index.html';
                    return;
                }
            }

            console.log('✅ Juego encontrado, conectando...');

            // Crear cliente SSE
            this.client = new GameClient(gameId, 'host');
            window.client = this.client;

            this.client.onStateUpdate = (state) => {
                console.log('🔄 Estado actualizado en host');
                this.updateHostUI(state);
            };

            this.client.onConnectionLost = () => {
                console.error('❌ Conexión SSE perdida');
            };

            console.log('🔌 Conectando SSE...');
            this.client.connect();
            console.log('✅ Host configurado y listo (modo unificado)');
        } catch (error) {
            console.error('❌ Error inicializando host:', error);
            alert('Error al conectar con el servidor.');
            clearGameSession();
            window.location.href = 'index.html';
        }
    }

    /**
     * Inicia una nueva ronda
     */
    async startNewRound() {
        if (!this.client) {
            console.error('❌ Cliente no inicializado');
            return;
        }

        console.log('🎬 Intentando iniciar ronda...');
        this.autoShortenTriggered = false;

        // Esperar a que el estado esté disponible
        let attempts = 0;
        while (!this.client.gameState && attempts < 30) {
            console.log('⏳ Esperando estado del servidor... intento', attempts + 1);
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!this.client.gameState) {
            alert('No se pudo conectar con el servidor. Intenta recargar (F5).');
            return;
        }

        const playerCount = Object.keys(this.client.gameState.players || {}).length;
        console.log('👥 Jugadores detectados:', playerCount);

        if (playerCount < 3) {
            alert(`Se necesitan al menos 3 jugadores (tienes ${playerCount})`);
            return;
        }

        console.log('📚 Obteniendo lista de palabras...');
        const words = await this.getWordsList();
        console.log('📚 Palabras disponibles:', words.length);

        const randomWord = words[Math.floor(Math.random() * words.length)];
        console.log('🎯 Palabra seleccionada:', randomWord);

        this.showCountdownSynced();

        console.log('▶️ Iniciando ronda...');
        await this.client.sendAction('start_round', {
            word: randomWord,
            duration: 120
        });
    }

    /**
     * Obtiene lista de palabras disponibles
     */
    async getWordsList() {
        const response = await fetch('/app/actions.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_words' })
        });
        const data = await response.json();
        return data.words || [];
    }

    /**
     * Finaliza la ronda actual
     */
    async endRound() {
        if (this.client) {
            await this.client.sendAction('end_round');
            this.stopTimer();
            this.autoShortenTriggered = false;
        }
    }

    /**
     * Reinicia el juego
     */
    async resetGame() {
        if (this.client) {
            await this.client.sendAction('reset_game');
            this.autoShortenTriggered = false;
        }
    }

    /**
     * Muestra countdown sincronizado 3-2-1
     */
    showCountdownSynced() {
        const countdownEl = this.elements.countdownDisplay;
        const statusEl = this.elements.statusMessageCenter;
        const wordEl = this.elements.wordDisplay;

        if (!countdownEl) return;

        statusEl.style.display = 'none';
        wordEl.style.display = 'none';
        countdownEl.style.display = 'block';

        const countdownInterval = setInterval(() => {
            if (!this.client || !this.client.gameState || !this.client.gameState.round_start_at) {
                return;
            }

            const now = Math.floor(Date.now() / 1000);
            const remaining = this.client.gameState.round_start_at - now;

            if (remaining > 0 && remaining <= 3) {
                countdownEl.textContent = remaining;
                countdownEl.style.animation = 'none';
                setTimeout(() => {
                    countdownEl.style.animation = 'countdownPulse 1s ease-in-out';
                }, 10);
            } else if (remaining <= 0) {
                countdownEl.style.display = 'none';
                clearInterval(countdownInterval);
            }
        }, 100);

        setTimeout(() => {
            countdownEl.style.display = 'none';
            clearInterval(countdownInterval);
        }, 4000);
    }

    /**
     * Inicia timer de ronda
     */
    startTimer(startTimestamp, duration) {
        this.stopTimer();

        this.timerInterval = setInterval(() => {
            const remaining = getRemainingTime(startTimestamp, duration);
            updateTimerDisplay(remaining, this.elements.timerDisplay, '');

            if (remaining <= 0) {
                this.stopTimer();
                this.endRound();
            }
        }, 1000);
    }

    /**
     * Detiene el timer
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * Actualiza toda la interfaz del host
     */
    updateHostUI(state) {
        if (!state) {
            console.warn('⚠️ Estado vacío recibido');
            return;
        }

        const playerCount = Object.keys(state.players || {}).length;
        const statusEl = this.elements.statusMessageCenter;
        const wordEl = this.elements.wordDisplay;

        if (state.status === 'waiting') {
            statusEl.style.display = 'block';
            wordEl.style.display = 'none';

            if (playerCount < 3) {
                statusEl.textContent = `Esperando más jugadores... (${playerCount}/3 mínimo)`;
            } else {
                statusEl.textContent = `Presiona ENTER para comenzar (${playerCount} jugadores listos)`;
            }

            this.stopTimer();
        } else if (state.status === 'playing') {
            statusEl.style.display = 'none';
            wordEl.style.display = 'block';
            wordEl.textContent = state.current_word || '';

            if (state.round_started_at) {
                this.startTimer(state.round_started_at, state.round_duration);
            }

            this.checkAllPlayersReady(state);
        } else if (state.status === 'round_ended') {
            statusEl.style.display = 'block';
            wordEl.style.display = 'none';

            if (playerCount < 3) {
                statusEl.textContent = 'Se necesitan al menos 3 jugadores para continuar';
            } else {
                statusEl.textContent = 'Ronda Finalizada - Presiona ENTER para continuar';
            }

            this.stopTimer();
        } else if (state.status === 'finished') {
            statusEl.style.display = 'block';
            wordEl.style.display = 'none';
            statusEl.textContent = '🏆 ¡Partida Finalizada!';
            this.stopTimer();
        }

        this.updateRanking(state);
        this.updateTopWords(state);
        this.updatePlayersGrid(state);
        this.updateControls(state);
    }

    /**
     * Verifica si todos los jugadores terminaron
     */
    checkAllPlayersReady(state) {
        if (this.autoShortenTriggered) return;

        const players = Object.values(state.players || {});
        const notReadyCount = players.filter(p => p.status !== 'ready').length;
        const remaining = getRemainingTime(state.round_started_at, state.round_duration);

        if (notReadyCount === 0 && remaining > 5 && players.length > 0) {
            console.log('✅ Todos los jugadores terminaron, acortando timer a 5 segundos');
            this.autoShortenTriggered = true;
            if (this.client) {
                this.client.sendAction('shorten_round');
            }
        }
    }

    /**
     * Actualiza estado de botones
     */
    updateControls(state) {
        if (!state) return;

        const playerCount = Object.keys(state.players || {}).length;
        const startBtn = this.elements.btnStartRound;
        const endBtn = this.elements.btnEndRound;

        if (state.status === 'waiting') {
            startBtn.disabled = playerCount < 3;
            startBtn.textContent = playerCount < 3
                ? `⏸️ Min. 3 jugadores (${playerCount}/3)`
                : `▶️ Iniciar Ronda (${playerCount} jugadores)`;
            endBtn.disabled = true;
        } else if (state.status === 'playing') {
            startBtn.disabled = true;
            startBtn.textContent = '▶️ Ronda en curso...';
            endBtn.disabled = false;
            endBtn.textContent = '⏹️ Finalizar Ahora';
        } else if (state.status === 'round_ended') {
            startBtn.disabled = playerCount < 3;
            startBtn.textContent = playerCount < 3
                ? `⏸️ Min. 3 jugadores (${playerCount}/3)`
                : '▶️ Siguiente Ronda';
            endBtn.disabled = true;
        } else if (state.status === 'finished') {
            startBtn.disabled = true;
            startBtn.textContent = '🏆 Partida Finalizada';
            endBtn.disabled = true;
        }
    }

    /**
     * Actualiza tabla de ranking
     */
    updateRanking(state) {
        const players = Object.values(state.players || {});
        const sorted = players.sort((a, b) => b.score - a.score);

        const rankingList = this.elements.rankingList;
        rankingList.innerHTML = sorted.map((player, index) => {
            const topClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}°`;

            return `
                <div class="ranking-item ${topClass}">
                    <span>${medal} ${player.name}</span>
                    <span>${player.score} pts</span>
                </div>
            `;
        }).join('');
    }

    /**
     * Actualiza palabras más frecuentes
     */
    updateTopWords(state) {
        const topWordsList = this.elements.topWordsList;

        if (state.round_top_words && state.round_top_words.length > 0) {
            topWordsList.innerHTML = state.round_top_words.map((item, index) => `
                <div class="top-word-item">
                    <span class="word">${index + 1}. ${item.word}</span>
                    <span class="count">${item.count}</span>
                </div>
            `).join('');
        } else {
            topWordsList.innerHTML = '<div style="text-align: center; opacity: 0.5; padding: 20px;">No hay datos aún</div>';
        }
    }

    /**
     * Actualiza grid de jugadores
     */
    updatePlayersGrid(state) {
        const players = Object.values(state.players || {});
        const grid = this.elements.playersGrid;

        grid.innerHTML = players.map(player => {
            const initial = player.name.charAt(0).toUpperCase();
            const statusIcon = player.status === 'ready' ? '✅' :
                player.status === 'playing' ? '✍️' : '🟢';
            const readyClass = player.status === 'ready' ? 'ready' : '';

            let squarcleStyle = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);';
            if (player.color) {
                const colors = player.color.split(',');
                squarcleStyle = `background: linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%);`;
            }

            const answerCount = (player.answers || []).length;
            const maxWords = 6;
            const answersDisplay = state.status === 'playing' ?
                `<div class="player-answers-count">${answerCount}/${maxWords}</div>` : '';

            return `
                <div class="player-squarcle ${readyClass}" style="${squarcleStyle}">
                    <span class="player-status-icon">${statusIcon}</span>
                    <div class="player-initial">${initial}</div>
                    <div class="player-name-label">${player.name}</div>
                    <div class="player-score-badge">${player.score}</div>
                    ${answersDisplay}
                </div>
            `;
        }).join('');
    }
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM cargado, inicializando HostManager...');
    window.hostManager = new HostManager();
    window.hostManager.initialize();
});

console.log('✅ host-manager.js cargado');
