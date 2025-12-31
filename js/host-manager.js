    startContinuousTimer(state) {
        this.stopTimer();
        
        // ✅ CORRECCIÓN: Calibrar timeSync si aún no está calibrado
        if (state.server_now && state.round_starts_at && !timeSync.isCalibrated) {
            timeSync.calibrateWithServerTime(
                state.server_now,
                state.round_starts_at,
                state.round_ends_at,
                state.round_duration
            );
            debug('⏱️ HOST SYNC CALIBRADO en startContinuousTimer', null, 'success');
        }
        
        const tick = () => {
            // ✅ CORRECCIÓN: Usar timeSync.getServerTime() como en player-manager
            if (this.gameState && this.gameState.round_started_at && this.gameState.round_duration) {
                this.remainingTime = getRemainingTime(
                    this.gameState.round_started_at,
                    this.gameState.round_duration
                );
                this.updateTimer();

                if (this.remainingTime <= 100 && this.gameState.status === 'playing' && !this.roundEnded) {
                    debug('⏲️ TIEMPO DE RONDA AGOTADO - Procesando resultados...', null, 'warning');
                    this.stopTimer();
                    this.endRoundAndCalculateResults();
                }
            }
        };
        
        // ✅ CRITICAL FIX: Hacer el primer tick INMEDIATAMENTE (no esperar 1 segundo)
        // Esto sincroniza el timer del host con el de los jugadores
        tick();
        
        // Luego continuar cada 1 segundo
        this.timerInterval = setInterval(tick, 1000);
    }