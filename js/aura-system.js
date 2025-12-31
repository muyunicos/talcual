/**
 * @file aura-system.js
 * @description Sistema de Auras Dinámicas - 12 colores base generan 6 auras aleatorias
 * Cada aura es un par de colores para gradientes vibrantes
 */

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

function generateRandomAuras() {
    const auras = [];
    const usedIndices = new Set();
    while (auras.length < 6) {
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

function getRandomAura() {
    const auras = generateRandomAuras();
    return auras[Math.floor(Math.random() * auras.length)];
}

function savePlayerColor(colorStr) {
    if (typeof StorageManager !== 'undefined' && typeof StorageKeys !== 'undefined') {
        StorageManager.set(StorageKeys.PLAYER_COLOR, colorStr);
    } else {
        localStorage.setItem(AURA_STORAGE_KEY, colorStr);
    }
}

function loadPlayerColor() {
    let color = null;
    if (typeof StorageManager !== 'undefined' && typeof StorageKeys !== 'undefined') {
        color = StorageManager.get(StorageKeys.PLAYER_COLOR);
        if (color && isValidAura(color)) {
            return color;
        }
    }
    color = localStorage.getItem(AURA_STORAGE_KEY);
    if (color && isValidAura(color)) {
        return color;
    }
    return null;
}

function clearPlayerColor() {
    if (typeof StorageManager !== 'undefined' && typeof StorageKeys !== 'undefined') {
        StorageManager.remove(StorageKeys.PLAYER_COLOR);
    } else {
        localStorage.removeItem(AURA_STORAGE_KEY);
    }
}

function applyColorGradient(colorStr) {
    if (!colorStr) return;
    const colors = colorStr.split(',').map(c => c.trim());
    if (colors.length === 2) {
        const gradient = `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
        document.body.style.background = gradient;
        document.body.style.backgroundAttachment = 'fixed';
    } else if (colors.length === 1) {
        document.body.style.background = colors[0];
    }
    addBackgroundTextureOverlay();
}

function addBackgroundTextureOverlay() {
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
}

function encodeAuraColors(color1, color2) {
    return `${color1},${color2}`;
}

function decodeAuraColors(encoded) {
    const [color1, color2] = encoded.split(',').map(c => c.trim());
    return { color1: color1 || '#FF0055', color2: color2 || '#00F0FF' };
}

function renderAuraSelectors(container, auras, selectedAura = null, onSelect = null) {
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
                savePlayerColor(aura.hex);
            }
        });
        container.appendChild(circle);
    });
}

function isValidAura(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return false;
    const parts = colorStr.split(',');
    return parts.every(color => /^#[0-9A-F]{6}$/i.test(color.trim()));
}