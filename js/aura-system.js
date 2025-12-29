/**
 * @file aura-system.js
 * @description Sistema de Auras Dinámicas - 12 colores base generan 6 auras aleatorias
 * Cada aura es un par de colores para gradientes vibrantes tipo Jackbox
 */

/**
 * 12 Colores Base Neón - Vibrantes y saturados
 * Listos para combinarse en pares (gradientes)
 */
const AURA_BASE_COLORS = [
    '#FF0055',  // 0: Magenta puro
    '#FF5500',  // 1: Naranja fuego
    '#FFD700',  // 2: Amarillo dorado
    '#00FF88',  // 3: Verde neón
    '#00F0FF',  // 4: Cian puro
    '#0055FF',  // 5: Azul neón
    '#AA00FF',  // 6: Púrpura neón
    '#FF00AA',  // 7: Magenta-Rosa
    '#FF6600',  // 8: Naranja suave
    '#88FF00',  // 9: Lima
    '#00FFAA',  // 10: Turquesa
    '#FF0088'   // 11: Magenta oscuro
];

/**
 * Genera 6 auras aleatorias seleccionando pares de colores de los 12 base
 * Cada aura es un objeto con dos colores para el gradiente
 * @returns {Array} Array de 6 auras con estructura {color1, color2, hex}
 */
function generateRandomAuras() {
    const auras = [];
    const usedIndices = new Set();
    
    // Generar 6 auras usando pares aleatorios
    while (auras.length < 6) {
        const idx1 = Math.floor(Math.random() * AURA_BASE_COLORS.length);
        const idx2 = Math.floor(Math.random() * AURA_BASE_COLORS.length);
        
        // Evitar colores iguales y pares duplicados
        if (idx1 !== idx2) {
            const pairKey = [Math.min(idx1, idx2), Math.max(idx1, idx2)].join('-');
            
            if (!usedIndices.has(pairKey)) {
                usedIndices.add(pairKey);
                const color1 = AURA_BASE_COLORS[idx1];
                const color2 = AURA_BASE_COLORS[idx2];
                
                auras.push({
                    color1: color1,
                    color2: color2,
                    hex: `${color1},${color2}`  // Formato para almacenamiento
                });
            }
        }
    }
    
    return auras;
}

/**
 * Retorna un color aleatorio de los 12 base
 * (Útil para preselección en el modal)
 * @returns {Object} Un aura aleatorio
 */
function getRandomAura() {
    const auras = generateRandomAuras();
    return auras[Math.floor(Math.random() * auras.length)];
}

/**
 * Aplica un gradiente a un elemento o al body
 * @param {string} color - Formato "#COLOR1,#COLOR2" o un solo color
 * @param {HTMLElement} element - Elemento a aplicar (default: body)
 */
function applyColorGradient(colorStr, element = null) {
    const target = element || document.body;
    
    if (!colorStr) return;
    
    const colors = colorStr.split(',').map(c => c.trim());
    
    if (colors.length === 2) {
        // Gradiente 135deg diagonal (tipo Jackbox)
        const gradient = `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
        target.style.background = gradient;
        target.style.backgroundAttachment = 'fixed';
    } else if (colors.length === 1) {
        // Color sólido
        target.style.background = colors[0];
    }
    
    // Superponer bg.webp si está disponible
    if (target === document.body) {
        addBackgroundTextureOverlay();
    }
}

/**
 * Agrega la textura bg.webp como overlay sobre el gradiente/color base
 * Usa ::before pseudo-elemento (ya existe en body según 1-global.css)
 */
function addBackgroundTextureOverlay() {
    const before = document.querySelector('body::before');
    if (!before) {
        // Si no existe, el CSS ya lo debería tener
        // Solo aseguramos que esté visible
        const style = document.createElement('style');
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

/**
 * Convierte dos colores hex a un estilo CSS variable compatible
 * Útil para guardar en localStorage
 * @param {string} color1 - Color hex (e.g., #FF0055)
 * @param {string} color2 - Color hex (e.g., #00F0FF)
 * @returns {string} Formato "#COLOR1,#COLOR2"
 */
function encodeAuraColors(color1, color2) {
    return `${color1},${color2}`;
}

/**
 * Decodifica una aura almacenada
 * @param {string} encoded - Formato "#COLOR1,#COLOR2"
 * @returns {Object} {color1, color2}
 */
function decodeAuraColors(encoded) {
    const [color1, color2] = encoded.split(',').map(c => c.trim());
    return { color1: color1 || '#FF0055', color2: color2 || '#00F0FF' };
}

/**
 * Validar si una aura es válida (formato correcto)
 * @param {string} aura - Formato "#COLOR1,#COLOR2"
 * @returns {boolean}
 */
function isValidAura(aura) {
    if (!aura || typeof aura !== 'string') return false;
    const colors = aura.split(',');
    return colors.length === 2 && 
           colors[0].match(/^#[0-9A-F]{6}$/i) && 
           colors[1].match(/^#[0-9A-F]{6}$/i);
}

/**
 * Renderiza los selectores de aura en el DOM (para el modal)
 * @param {HTMLElement} container - Contenedor donde insertar los círculos
 * @param {Array} auras - Array de auras a renderizar
 * @param {string} selectedAura - Aura preseleccionada (formato "#COLOR1,#COLOR2")
 * @param {Function} onSelect - Callback al seleccionar una aura
 */
function renderAuraSelectors(container, auras, selectedAura = null, onSelect = null) {
    if (!container) return;
    
    container.innerHTML = ''; // Limpiar
    
    auras.forEach((aura, index) => {
        const circle = document.createElement('div');
        circle.className = 'aura-circle';
        circle.dataset.color = aura.hex;
        circle.dataset.index = index;
        
        // Aplicar gradiente al círculo
        const gradient = `linear-gradient(135deg, ${aura.color1} 0%, ${aura.color2} 100%)`;
        circle.style.background = gradient;
        
        // Preseleccionar si corresponde
        if (selectedAura === aura.hex) {
            circle.classList.add('selected');
        }
        
        // Event listener para selección
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
}

console.log('%c✅ aura-system.js - Sistema de auras dinámicas cargado ✨', 'color: #FF00FF; font-weight: bold; font-size: 12px');
