/**
 * Floating Side Panel Handler
 * Hace el panel lateral fijo, colapsible y posicionado en esquina inferior derecha
 */

class FloatingSidePanelHandler {
    constructor() {
        this.sidepanel = document.getElementById('floating-side-panel');
        this.isOpen = true;
        
        if (!this.sidepanel) {
            console.warn('⚠️ FloatingSidePanelHandler: panel no encontrado');
            return;
        }
        
        this.init();
    }
    
    init() {
        console.log('📊 FloatingSidePanelHandler inicializando...');
        
        // Aplicar estilos de posicionamiento
        this.sidepanel.style.cssText = `
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            width: 280px !important;
            max-width: 90vw !important;
            z-index: 500 !important;
            display: flex !important;
            flex-direction: column !important;
            max-height: 60vh !important;
            overflow-y: auto !important;
            border-radius: 12px !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3) !important;
        `;
        
        // Crear botón de toggle en la esquina
        this.createToggleButton();
        
        console.log('✅ FloatingSidePanelHandler listo');
    }
    
    createToggleButton() {
        // Si ya existe, no crear otro
        if (document.getElementById('sidepanel-toggle-btn')) return;
        
        const btn = document.createElement('button');
        btn.id = 'sidepanel-toggle-btn';
        btn.className = 'sidepanel-toggle';
        btn.innerHTML = '📈';
        btn.setAttribute('aria-label', 'Toggle panel lateral');
        btn.style.cssText = `
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            width: 280px !important;
            padding: 12px !important;
            background: var(--color-primary, #2186 8D) !important;
            color: var(--color-btn-primary-text, #FCFCF9) !important;
            border: none !important;
            border-radius: 8px 8px 0 0 !important;
            cursor: pointer !important;
            font-weight: 600 !important;
            font-size: 0.9rem !important;
            z-index: 501 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            transition: all 0.3s ease !important;
        `;
        
        // Contenido del botón
        btn.innerHTML = `
            <span>📈 Ranking / Top Palabras</span>
            <span id="toggle-arrow" style="font-size: 1.2rem; margin-left: 8px;">▼</span>
        `;
        
        btn.addEventListener('click', () => this.togglePanel());
        
        // Insertar antes del panel
        this.sidepanel.parentElement.insertBefore(btn, this.sidepanel);
        
        this.toggleBtn = btn;
        this.toggleArrow = document.getElementById('toggle-arrow');
    }
    
    togglePanel() {
        if (this.isOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }
    
    closePanel() {
        this.isOpen = false;
        this.sidepanel.style.display = 'none';
        if (this.toggleArrow) {
            this.toggleArrow.textContent = '▲'; // Arriba
        }
        console.log('📊 Panel cerrado');
    }
    
    openPanel() {
        this.isOpen = true;
        this.sidepanel.style.display = 'flex';
        if (this.toggleArrow) {
            this.toggleArrow.textContent = '▼'; // Abajo
        }
        console.log('📊 Panel abierto');
    }
}

// ===== INIT =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.floatingSidePanelHandler = new FloatingSidePanelHandler();
    });
} else {
    window.floatingSidePanelHandler = new FloatingSidePanelHandler();
}

console.log('%c✅ FloatingSidePanelHandler listo', 'color: #10B981; font-weight: bold');
