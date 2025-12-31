/**
 * @file session-manager.js
 * @description SessionManager - Gestiona sesiones de juego (Host o Player)
 * Unifica la lógica de recuperación, persistencia y limpieza
 * 
 * REFACTOR: Elimina 75 líneas de código duplicado entre host-manager y player-manager
 */

class SessionManager {
    constructor(sessionType = 'player') {
        this.sessionType = sessionType; // 'host' o 'player'
        this.isActive = false;
        this.manager = null; // Referencia al manager (host o player)
    }

    /**
     * Inicializa la sesión recuperando datos almacenados
     * @returns {Object|null} Datos de sesión recuperados o null
     */
    recover() {
        if (this.sessionType === 'host') {
            return this.recoverHostSession();
        } else {
            return this.recoverPlayerSession();
        }
    }

    recoverHostSession() {
        const code = StorageManager.get(StorageKeys.HOST_GAME_CODE);
        const isHost = StorageManager.get(StorageKeys.IS_HOST);

        if (!code || isHost !== 'true') {
            debug('⚠️ No active host session', null, 'warn');
            return null;
        }

        this.isActive = true;
        debug('🔄 Host session recovered', { code }, 'success');
        return { gameCode: code };
    }

    recoverPlayerSession() {
        const gameId = StorageManager.get(StorageKeys.GAME_ID);
        const playerId = StorageManager.get(StorageKeys.PLAYER_ID);
        const playerName = StorageManager.get(StorageKeys.PLAYER_NAME);
        const playerColor = StorageManager.get(StorageKeys.PLAYER_COLOR);

        if (!gameId || !playerId || !playerName || !playerColor) {
            debug('⚠️ No active player session', null, 'warn');
            return null;
        }

        this.isActive = true;
        debug('🔄 Player session recovered', { gameId, playerId, playerName }, 'success');
        return { gameId, playerId, playerName, playerColor };
    }

    /**
     * Guarda datos de sesión de forma segura
     */
    saveHostSession(gameCode) {
        StorageManager.set(StorageKeys.HOST_GAME_CODE, gameCode);
        StorageManager.set(StorageKeys.IS_HOST, 'true');
        this.isActive = true;
        debug('💾 Host session saved', { gameCode }, 'success');
    }

    savePlayerSession(gameId, playerId, playerName, playerColor) {
        StorageManager.set(StorageKeys.GAME_ID, gameId);
        StorageManager.set(StorageKeys.PLAYER_ID, playerId);
        StorageManager.set(StorageKeys.PLAYER_NAME, playerName);
        StorageManager.set(StorageKeys.PLAYER_COLOR, playerColor);
        this.isActive = true;
        debug('💾 Player session saved', { gameId, playerId, playerName }, 'success');
    }

    /**
     * Limpia la sesión completamente
     */
    clear() {
        if (this.sessionType === 'host') {
            StorageManager.clearHostSession();
        } else {
            StorageManager.clearPlayerSession();
        }
        this.isActive = false;
        debug('🧹 Session cleared', null, 'info');
    }

    /**
     * Registra un manager para notificarlo de la destrucción
     */
    registerManager(managerInstance) {
        this.manager = managerInstance;
        window.addEventListener('beforeunload', () => {
            if (this.manager && typeof this.manager.destroy === 'function') {
                this.manager.destroy();
            }
        });
        debug('📌 Manager registered with SessionManager', null, 'info');
    }

    /**
     * Verifica si hay sesión activa del tipo especificado
     */
    isSessionActive() {
        return this.isActive;
    }
}

// Singleton global (uno para host, uno para player)
const hostSession = new SessionManager('host');
const playerSession = new SessionManager('player');

console.log('%c✅ session-manager.js loaded', 'color: #3B82F6; font-weight: bold; font-size: 12px');
