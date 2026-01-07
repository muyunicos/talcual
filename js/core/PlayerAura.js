const AURA_STORAGE_KEY = 'talcual_playerColor';
const AURA_SESSION_KEY = 'talcual_sessionAuras';

const AURA_BASE_COLORS = [
    '#FF0055',
    '#FF5500',
    '#FFD700',
    '#00FF88',
    '#00F0FF',
    '#0055FF',
    '#AA00FF',
    '#FF00AA',
    '#FF6600',
    '#88FF00',
    '#00FFAA',
    '#FF0088'
];

class AuraModule {
    constructor() {
        if (AuraModule._instance) {
            return AuraModule._instance;
        }
        this.currentAura = null;
        this.backgroundTextureApplied = false;
        AuraModule._instance = this;
    }

    generateRandomAuras() {
        const auras = [];
        const usedIndices = new Set();
        while (auras.length < 3) {
            const idx1 = Math.floor(Math.random() * AURA_BASE_COLORS.length);
            const idx2 = Math.floor(Math.random() * AURA_BASE_COLORS.length);
            if (idx1 !== idx2) {
                const pairKey = [Math.min(idx1, idx2), Math.max(idx1, idx2)].join('-');
                
                if (!usedIndices.has(pairKey)) {
                    usedIndices.add(pairKey);
                    const color1 = AURA_BASE_COLORS[idx1];
                    const color2 = AURA_BASE_COLORS[idx2];
                    auras.push({
                        color1: color1,
                        color2: color2,
                        hex: `${color1},${color2}`
                    });
                }
            }
        }
        
        return auras;
    }

    getRandomAura() {
        const auras = this.generateRandomAuras();
        return auras[Math.floor(Math.random() * auras.length)];
    }

    savePlayerColor(colorStr) {
        if (typeof StorageManager !== 'undefined' && typeof StorageKeys !== 'undefined') {
            StorageManager.set(StorageKeys.PLAYER_COLOR, colorStr);
        } else {
            localStorage.setItem(AURA_STORAGE_KEY, colorStr);
        }
    }

    loadPlayerColor() {
        let color = null;
        if (typeof StorageManager !== 'undefined' && typeof StorageKeys !== 'undefined') {
            color = StorageManager.get(StorageKeys.PLAYER_COLOR);
            if (color && this.isValidAura(color)) {
                return color;
            }
        }
        color = localStorage.getItem(AURA_STORAGE_KEY);
        if (color && this.isValidAura(color)) {
            return color;
        }
        return null;
    }

    clearPlayerColor() {
        if (typeof StorageManager !== 'undefined' && typeof StorageKeys !== 'undefined') {
            StorageManager.remove(StorageKeys.PLAYER_COLOR);
        } else {
            localStorage.removeItem(AURA_STORAGE_KEY);
        }
    }

    applyColorGradient(colorStr) {
        if (!colorStr) return;
        const colors = colorStr.split(',').map(c => c.trim());
        if (colors.length === 2) {
            const gradient = `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
            document.body.style.background = gradient;
            document.body.style.backgroundAttachment = 'fixed';
        } else if (colors.length === 1) {
            document.body.style.background = colors[0];
        }
        this.currentAura = colorStr;
        this.addBackgroundTextureOverlay();
    }

    addBackgroundTextureOverlay() {
        if (this.backgroundTextureApplied) return;
        let style = document.querySelector('style[data-texture]');
        if (!style) {
            style = document.createElement('style');
            style.setAttribute('data-texture', 'true');
            style.textContent = `
                body::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-image: url('../images/bg.webp');
                    background-repeat: repeat;
                    background-position: center center;
                    opacity: 0.15;
                    mix-blend-mode: overlay;
                    pointer-events: none;
                    z-index: 0;
                }
            `;
            document.head.appendChild(style);
        }
        this.backgroundTextureApplied = true;
    }

    encodeAuraColors(color1, color2) {
        return `${color1},${color2}`;
    }

    decodeAuraColors(encoded) {
        const [color1, color2] = encoded.split(',').map(c => c.trim());
        return { color1: color1 || '#FF0055', color2: color2 || '#00F0FF' };
    }

    renderAuraSelectors(container, auras, selectedAura = null, onSelect = null) {
        if (!container) return;
        
        container.innerHTML = ''; 
        
        auras.forEach((aura, index) => {
            const circle = document.createElement('div');
            circle.className = 'aura-circle';
            circle.dataset.color = aura.hex;
            circle.dataset.index = index;
            
            const gradient = `linear-gradient(135deg, ${aura.color1} 0%, ${aura.color2} 100%)`;
            circle.style.background = gradient;
            
            if (selectedAura === aura.hex) {
                circle.classList.add('selected');
            }
            
            circle.addEventListener('click', () => {
                container.querySelectorAll('.aura-circle').forEach(c => {
                    c.classList.remove('selected');
                });
                circle.classList.add('selected');
                
                if (onSelect) {
                    onSelect(aura);
                }
            });
            container.appendChild(circle);
        });
        
        const randomizer = document.createElement('div');
        randomizer.className = 'aura-circle aura-randomizer';
        randomizer.dataset.index = 'random';
        randomizer.innerHTML = '✨';
        randomizer.title = 'Generar nuevas auras';
        
        randomizer.addEventListener('click', () => {
            const newAuras = this.generateRandomAuras();
            const randomAura = newAuras[Math.floor(Math.random() * newAuras.length)];
            
            this.renderAuraSelectors(container, newAuras, randomAura.hex, onSelect);
            
            if (onSelect) {
                onSelect(randomAura);
            }
        });
        
        container.appendChild(randomizer);
    }

    renderAuraSelectorsEdit(container, currentAura, onSelect = null) {
        if (!container) return;
        
        container.innerHTML = '';
        
        const auras = [];
        if (currentAura && this.isValidAura(currentAura)) {
            const [c1, c2] = currentAura.split(',').map(c => c.trim());
            auras.push({
                color1: c1,
                color2: c2,
                hex: currentAura
            });
        }
        
        const additionalAuras = this.generateRandomAuras();
        auras.push(...additionalAuras);
        
        let selectedAura = auras[0];
        
        auras.forEach((aura, index) => {
            const circle = document.createElement('div');
            circle.className = 'aura-circle';
            circle.dataset.color = aura.hex;
            circle.dataset.index = index;
            
            const gradient = `linear-gradient(135deg, ${aura.color1} 0%, ${aura.color2} 100%)`;
            circle.style.background = gradient;
            
            if (index === 0) {
                circle.classList.add('selected');
            }
            
            circle.addEventListener('click', () => {
                container.querySelectorAll('.aura-circle:not(.aura-randomizer)').forEach(c => {
                    c.classList.remove('selected');
                });
                circle.classList.add('selected');
                
                selectedAura = aura;
                
                if (onSelect) {
                    onSelect(aura);
                }
            });
            container.appendChild(circle);
        });
        
        const randomizer = document.createElement('div');
        randomizer.className = 'aura-circle aura-randomizer';
        randomizer.dataset.index = 'random';
        randomizer.innerHTML = '✨';
        randomizer.title = 'Generar nuevas auras';
        
        randomizer.addEventListener('click', () => {
            const newAuras = this.generateRandomAuras();
            const preservedAura = selectedAura;
            
            const allAuras = [];
            if (preservedAura && this.isValidAura(preservedAura.hex)) {
                allAuras.push(preservedAura);
            }
            allAuras.push(...newAuras);
            
            this.renderAuraSelectorsEdit(container, preservedAura?.hex || currentAura, onSelect);
            
            if (onSelect && preservedAura) {
                onSelect(preservedAura);
            }
        });
        
        container.appendChild(randomizer);
    }

    isValidAura(colorStr) {
        if (!colorStr || typeof colorStr !== 'string') return false;
        const parts = colorStr.split(',');
        return parts.every(color => /^#[0-9A-F]{6}$/i.test(color.trim()));
    }

    renderPlayerNode(player) {
        const node = document.createElement('div');
        node.className = 'player-aura-node';
        const aura = player.aura || '#FF0055,#00F0FF';
        const [color1, color2] = aura.split(',');
        node.style.cssText = `
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 8px;
            background: linear-gradient(135deg, ${color1 || '#FF0055'} 0%, ${color2 || '#00F0FF'} 100%);
            color: white;
            font-weight: 500;
        `;
        node.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${sanitizeText(player.name || 'Anónimo')}</span>
                <span style="font-size: 14px;">${player.score || 0} pts</span>
            </div>
        `;
        return node;
    }
}

const auraModuleInstance = new AuraModule();

console.log('%c✅ PlayerAura.js (AuraModule Singleton)', 'color: #00aa00; font-weight: bold');
