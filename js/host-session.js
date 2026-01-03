const hostSession = {
    manager: null,

    isSessionActive() {
        const gameCode = StorageManager.get(StorageKeys.HOST_GAME_CODE);
        return !!gameCode;
    },

    recover() {
        const gameCode = StorageManager.get(StorageKeys.HOST_GAME_CODE);
        const category = StorageManager.get(StorageKeys.HOST_CATEGORY);
        
        if (gameCode) {
            return { gameCode, category };
        }
        return null;
    },

    saveHostSession(gameCode, category) {
        StorageManager.set(StorageKeys.HOST_GAME_CODE, gameCode);
        StorageManager.set(StorageKeys.HOST_CATEGORY, category || 'Sin categoría');
    },

    clear() {
        StorageManager.remove(StorageKeys.HOST_GAME_CODE);
        StorageManager.remove(StorageKeys.HOST_CATEGORY);
    },

    registerManager(managerInstance) {
        this.manager = managerInstance;
    }
};

StorageKeys.HOST_CATEGORY = 'host_category';

console.log('%c✅ host-session.js', 'color: #FF6600; font-weight: bold');
