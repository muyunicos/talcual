/**
 * Host Manager - Gestión de partida en host
 * Maneja: timer, categoría, ranking, panel tabs
 * (Lógica del menú hamburguesa ahora en menu-opciones.js)
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
        this.countdownRAFId = null;
        this.currentCategory = 'Sin categoría';
        this.roundEnded = false;
        
        // Word comparison engine
        this.wordEngine = null;
        this.wordEngineReady = false;
        this.initWordEngine();
        
        this.initUI();
        this.attachEventListeners();
        this.attachMenuEventListeners();
        this.attachConfigModalListeners();
        this.connectGameClient();
    }

    initWordEngine() {
        if (typeof WordEquivalenceEngine !== 'function') {
            debug('⚠️ WordEquivalenceEngine no disponible - usando comparación simple', null, 'warning');
            return;
        }

        try {
            this.wordEngine = new WordEquivalenceEngine();
            this.wordEngine.init('/js/sinonimos.json').then(() => {
                this.wordEngineReady = true;
                debug('📜 Word engine inicializado en host', null, 'info');
            }).catch(err => {
                debug('❌ Error cargando word engine: ' + err, null, 'warning');
            });
        } catch (e) {
            debug('❌ Word engine no disponible: ' + e.message, null, 'warning');
        }
    }

    getCanonicalForCompare(word) {
        const raw = (word || '').toString().trim();
        if (!raw) return '';

        // Usar word engine si está disponible
        if (this.wordEngine && this.wordEngineReady && typeof this.wordEngine.getCanonical === 'function') {
            return this.wordEngine.getCanonical(raw);
        }

        // Fallback a normalización simple
        return raw
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
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

    attachMenuEventListeners() {
        document.getElementById('hamburger-restart-round')?.addEventListener('click', () => this.handleRestartRound());
        document.getElementById('hamburger-new-game')?.addEventListener('click', () => this.handleNewGame());
        document.getElementById('hamburger-settings')?.addEventListener('click', () => this.handleSettings());
        document.getElementById('hamburger-terminate')?.addEventListener('click', () => this.handleTerminate());
    }

    attachConfigModalListeners() {
        const modalConfig = document.getElementById('modal-game-config');
        const btnCancel = document.getElementById('btn-config-cancel');
        const btnSave = document.getElementById('btn-config-save');
        
        if (!modalConfig || !btnCancel || !btnSave) return;

        btnCancel.addEventListener('click', () => this.closeConfigModal());

        btnSave.addEventListener('click', () => this.saveGameConfig());

        document.getElementById('btn-decrease-rounds')?.addEventListener('click', () => {
            const input = document.getElementById('config-total-rounds');
            if (input && parseInt(input.value) > 1) {
                input.value = parseInt(input.value) - 1;
            }
        });

        document.getElementById('btn-increase-rounds')?.addEventListener('click', () => {
            const input = document.getElementById('config-total-rounds');
            if (input && parseInt(input.value) < 10) {
                input.value = parseInt(input.value) + 1;
            }
        });

        document.getElementById('btn-decrease-duration')?.addEventListener('click', () => {
            const input = document.getElementById('config-round-duration');
            if (input && parseInt(input.value) > 30) {
                input.value = parseInt(input.value) - 10;
            }
        });

        document.getElementById('btn-increase-duration')?.addEventListener('click', () => {
            const input = document.getElementById('config-round-duration');
            if (input && parseInt(input.value) < 300) {
                input.value = parseInt(input.value) + 10;
            }
        });

        document.getElementById('btn-decrease-min-players')?.addEventListener('click', () => {
            const input = document.getElementById('config-min-players');
            if (input && parseInt(input.value) > 1) {
                input.value = parseInt(input.value) - 1;
            }
        });

        document.getElementById('btn-increase-min-players')?.addEventListener('click', () => {
            const input = document.getElementById('config-min-players');
            if (input && parseInt(input.value) < 6) {
                input.value = parseInt(input.value) + 1;
            }
        });

        modalConfig.addEventListener('click', (e) => {
            if (e.target === modalConfig) {
                this.closeConfigModal();
            }
        });
    }

    closeConfigModal() {
        const modalConfig = document.getElementById('modal-game-config');
        if (modalConfig) {
            modalConfig.style.display = 'none';
        }
    }

    async saveGameConfig() {
        const totalRounds = parseInt(document.getElementById('config-total-rounds')?.value || 3);
        const roundDuration = parseInt(document.getElementById('config-round-duration')?.value || 60);
        const minPlayers = parseInt(document.getElementById('config-min-players')?.value || 2);

        this.totalRounds = totalRounds;
        this.minPlayers = minPlayers;

        try {
            if (this.client) {
                await this.client.sendAction('update_game_config', {
                    game_id: this.gameCode,
                    total_rounds: totalRounds,
                    round_duration: roundDuration,
                    min_players: minPlayers
                });
            }
            
            this.updateRoundInfo();
            this.closeConfigModal();
            console.log('✅ Configuración guardada');
        } catch (error) {
            console.error('Error guardando configuración:', error);
            alert('Error al guardar configuración');
        }
    }

    handleRestartRound() {
        if (confirm('¿Reiniciar la ronda actual?')) {
            this.startGame();
        }
    }

    handleNewGame() {
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
        const modalConfig = document.getElementById('modal-game-config');
        if (modalConfig) {
            const inputRounds = document.getElementById('config-total-rounds');
            const inputDuration = document.getElementById('config-round-duration');
            const inputMinPlayers = document.getElementById('config-min-players');
            
            if (inputRounds) inputRounds.value = this.totalRounds;
            if (inputDuration) inputDuration.value = 60;
            if (inputMinPlayers) inputMinPlayers.value = this.minPlayers;
            
            modalConfig.style.display = 'flex';
        } else {
            alert('Modal de configuración no disponible');
        }
    }

    handleTerminate() {
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
        debug('📈 Estado del host actualizado:', state.status, 'info');
        
        // Actualizar categoría
        if (state.current_category || state.category) {
            const category = state.current_category || state.category;
            this.updateCategorySticker(category);
        }
        
        if (state.players) {
            this.currentPlayers = Array.isArray(state.players) 
                ? state.players 
                : Object.values(state.players);
        }
        this.updatePlayersGrid(this.currentPlayers);
        this.updateRanking(this.currentPlayers);
        this.updateTopWords(state.topWords || []);
        this.checkStartButtonVisibility();

        if (state.round !== undefined) {
            this.currentRound = state.round;
            this.totalRounds = state.total_rounds || 3;
            this.updateRoundInfo();
        }

        if (state.status === 'playing') {
            this.roundEnded = false;
            if (state.round_started_at && state.round_duration) {
                this.startContinuousTimer(state);
            }
        } else if (state.status === 'round_ended') {
            this.roundEnded = true;
            this.stopTimer();
        } else if (state.status === 'finished') {
            this.stopTimer();
        }
        
        if (state.min_players !== undefined) {
            this.minPlayers = state.min_players;
        }
    }

    updateCategorySticker(category) {
        const categorySticker = document.getElementById('category-sticker');
        if (categorySticker) {
            const displayCategory = category && category.trim() ? category : 'Sin categoría';
            if (categorySticker.textContent !== displayCategory) {
                categorySticker.textContent = displayCategory;
                this.currentCategory = displayCategory;
                debug(`🍰 Categoría actualizada: ${displayCategory}`, null, 'info');
            }
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
            
            if (player.color) {
                const colors = player.color.split(',').map(c => c.trim());
                if (colors.length === 2) {
                    squarcle.style.background = `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
                } else {
                    squarcle.style.background = colors[0];
                }
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
    }

    updateRoundInfo() {
        const roundEl = document.getElementById('round-display');
        const totalEl = document.getElementById('total-rounds-display');
        if (roundEl) roundEl.textContent = this.currentRound;
        if (totalEl) totalEl.textContent = this.totalRounds;
    }

    updateTimer() {
        const timerEl = document.getElementById('timer-display');
        if (timerEl && typeof this.remainingTime === 'number') {
            const seconds = Math.max(0, Math.floor(this.remainingTime / 1000));
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
    }

    startContinuousTimer(state) {
        this.stopTimer();
        
        const tick = () => {
            if (this.gameState && this.gameState.round_started_at && this.gameState.round_duration) {
                // CAMBIO: Usar round_started_at (cuando empieza REALMENTE la ronda)
                // No round_starts_at (que es cuando empieza el countdown)
                this.remainingTime = getRemainingTime(
                    this.gameState.round_started_at,
                    this.gameState.round_duration
                );
                this.updateTimer();

                // Cuando el tiempo de juego se agota y estamos en playing, procesar resultados
                if (this.remainingTime <= 100 && this.gameState.status === 'playing' && !this.roundEnded) {
                    debug('⏱️ TIEMPO DE RONDA AGOTADO - Procesando resultados...', null, 'warning');
                    this.stopTimer();
                    this.endRoundAndCalculateResults();
                }
            }
        };
        
        tick(); // Actualizar inmediatamente
        this.timerInterval = setInterval(tick, 1000);
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
        
        debug(`🏆 Ranking actualizado: ${sorted.length} jugadores`, null, 'info');
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
        
        debug(`📄 Top palabras actualizado: ${topWords.length} palabras`, null, 'info');
    }

    processRoundResults() {
        debug('🧰 Calculando resultados con word-comparison engine...', null, 'info');
        const state = this.gameState;
        if (!state || !state.players) {
            debug('❌ Estado inválido para procesar resultados', null, 'error');
            return null;
        }

        // Obtener todos los jugadores y sus respuestas
        const playersArray = Array.isArray(state.players) 
            ? state.players 
            : Object.values(state.players);

        debug(`👥 Procesando ${playersArray.length} jugadores`, null, 'info');

        // Normalizar respuestas de cada jugador
        const playerAnswers = {};
        playersArray.forEach(player => {
            if (player.answers && Array.isArray(player.answers)) {
                playerAnswers[player.id] = player.answers.map(w => String(w).toUpperCase().trim());
            } else {
                playerAnswers[player.id] = [];
            }
        });

        // Calcular matching de palabras usando canonicalización
        const roundResults = {};
        const canonicalToOriginal = {};  // Map de canonical -> [list of original words]
        const wordFrequency = {};

        Object.entries(playerAnswers).forEach(([playerId, answers]) => {
            roundResults[playerId] = {};
            
            answers.forEach(word => {
                const canonical = this.getCanonicalForCompare(word);
                
                if (!canonicalToOriginal[canonical]) {
                    canonicalToOriginal[canonical] = new Set();
                }
                canonicalToOriginal[canonical].add(word);
                
                if (!wordFrequency[canonical]) {
                    wordFrequency[canonical] = { count: 0, players: [], originalWords: new Set() };
                }
                wordFrequency[canonical].count++;
                if (!wordFrequency[canonical].players.includes(playerId)) {
                    wordFrequency[canonical].players.push(playerId);
                }
                wordFrequency[canonical].originalWords.add(word);
            });
        });

        debug(`📊 Palabras encontradas (canonical): ${Object.keys(wordFrequency).length}`, null, 'info');

        // Calcular puntos y results por jugador
        const scoreDelta = {};
        Object.entries(playerAnswers).forEach(([playerId, answers]) => {
            scoreDelta[playerId] = 0;
            
            answers.forEach(word => {
                const canonical = this.getCanonicalForCompare(word);
                const freq = wordFrequency[canonical];
                
                if (freq && freq.count > 1) {
                    // Palabra coincidió con otro jugador
                    const points = 10;
                    roundResults[playerId][word] = {
                        count: freq.count,
                        points: points,
                        matched_with: freq.players.filter(p => p !== playerId).map(pId => {
                            const player = playersArray.find(pl => pl.id === pId);
                            return player?.name || 'Anonym';
                        })
                    };
                    scoreDelta[playerId] += points;
                } else {
                    // Palabra no coincidió
                    roundResults[playerId][word] = {
                        count: 1,
                        points: 0,
                        matched_with: []
                    };
                }
            });
        });

        debug(`⭐ Deltas de puntos calculados`, null, 'info');

        // Calcular top palabras (usando la palabra más común de cada canonical)
        const topWords = Object.entries(wordFrequency)
            .filter(([canonical, data]) => data.count > 1)  // Solo palabras con más de 1 jugador
            .map(([canonical, data]) => {
                // Usar la palabra original más común o simplemente la primera
                const originalWord = Array.from(data.originalWords)[0];
                return { word: originalWord || canonical, count: data.count };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        debug(`📄 Top palabras: ${topWords.length} (con equivalencias)`, null, 'info');

        return {
            round_results: roundResults,
            score_deltas: scoreDelta,
            top_words: topWords
        };
    }

    async endRoundAndCalculateResults() {
        if (this.roundEnded) {
            debug('⚠️ Ronda ya finalizada, ignorando', null, 'warning');
            return;
        }

        this.roundEnded = true;

        try {
            // Procesar resultados localmente
            const results = this.processRoundResults();
            if (!results) {
                throw new Error('No se pudieron procesar los resultados');
            }

            // Actualizar el estado local con los resultados
            const playersArray = Array.isArray(this.gameState.players) 
                ? this.gameState.players 
                : Object.values(this.gameState.players);

            playersArray.forEach(player => {
                // Actualizar round_results
                player.round_results = results.round_results[player.id] || {};
                // Actualizar score
                player.score = (player.score || 0) + (results.score_deltas[player.id] || 0);
                // Cambiar status a connected
                player.status = 'connected';
            });

            // Actualizar top words en estado
            this.gameState.round_top_words = results.top_words;
            this.gameState.last_update = Math.floor(Date.now() / 1000);

            debug('📄 Enviando end_round al servidor...', null, 'info');

            // Llamar a end_round - el backend solo actualiza score basado en player.score
            const response = await this.client.sendAction('end_round', {
                round_results: results.round_results,
                top_words: results.top_words,
                score_deltas: results.score_deltas
            });

            if (response.success) {
                debug('✅ Ronda finalizada en el servidor', null, 'success');
                if (response.state) {
                    this.handleGameState(response.state);
                }
            } else {
                debug('❌ Error en end_round: ' + response.message, null, 'error');
            }
        } catch (error) {
            debug('❌ Error en endRoundAndCalculateResults: ' + error.message, null, 'error');
        }
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

    runPreciseCountdown(roundStartsAt, countdownDuration) {
        if (this.countdownRAFId) {
            cancelAnimationFrame(this.countdownRAFId);
        }

        const overlay = document.getElementById('countdown-overlay-host');
        const numberEl = document.getElementById('countdown-number-host');

        if (!overlay || !numberEl) return;

        overlay.classList.add('active');

        const update = () => {
            const nowServer = timeSync.getServerTime();
            const elapsed = nowServer - roundStartsAt;
            const remaining = Math.max(0, countdownDuration - elapsed);
            const seconds = Math.ceil(remaining / 1000);
            
            if (seconds > 3) {
                numberEl.textContent = '¿Preparado?';
            } else if (seconds > 0) {
                numberEl.classList.add('timer-hury');
                const displayValue = Math.max(1, seconds - 1);
                numberEl.textContent = displayValue.toString();
            } else {
                numberEl.classList.remove('timer-hury');
                numberEl.textContent = '';
            }

            if (remaining > 0) {
                this.countdownRAFId = requestAnimationFrame(update);
            } else {
                overlay.classList.remove('active');
            }
        };
        this.countdownRAFId = requestAnimationFrame(update);
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
            } else {
                if (result.state && result.state.round_starts_at && result.state.countdown_duration) {
                    if (typeof timeSync !== 'undefined' && timeSync && !timeSync.isCalibrated) {
                        timeSync.calibrateWithServerTime(
                            result.state.server_now,
                            result.state.round_starts_at,
                            result.state.round_ends_at,
                            result.state.round_duration
                        );
                        console.log('%c⏱️ HOST SYNC CALIBRADO', 'color: #3B82F6; font-weight: bold', `Offset: ${timeSync.offset}ms`);
                    }
                    this.runPreciseCountdown(result.state.round_starts_at, result.state.countdown_duration);
                }
            }
        } catch (error) {
            console.error('Error en startGame():', error);
            alert('Error de conexión');
        }
    }

    destroy() {
        this.stopTimer();
        if (this.countdownRAFId) {
            cancelAnimationFrame(this.countdownRAFId);
            this.countdownRAFId = null;
        }
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

console.log('%c✅ host-manager.js - REFACTORED: Timer shows only gameplay duration (uses round_started_at)', 'color: #FF00FF; font-weight: bold; font-size: 12px');