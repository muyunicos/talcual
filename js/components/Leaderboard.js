class FloatingSidePanelHandler {
    constructor() {
        this.sidepanel = document.getElementById('floating-side-panel');
        this.isOpen = true;
        
        if (!this.sidepanel) {
            return;
        }
        
        this.init();
    }
    
    init() {
        this.createToggleButton();
    }
    
    createToggleButton() {
        if (document.getElementById('sidepanel-toggle-btn')) return;
        
        const btn = document.createElement('button');
        btn.id = 'sidepanel-toggle-btn';
        btn.className = 'sidepanel-toggle';
        btn.setAttribute('aria-label', 'Toggle panel lateral');     
        btn.innerHTML = `
            <span>Top Ranking</span>
            <span id="toggle-arrow" style="font-size: 1.2rem; margin-left: 8px;">▼</span>
        `;
        btn.addEventListener('click', () => this.togglePanel());
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
            this.toggleArrow.textContent = '▲';
        }
    }
    
    openPanel() {
        this.isOpen = true;
        this.sidepanel.style.display = 'flex';
        if (this.toggleArrow) {
            this.toggleArrow.textContent = '▼';
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.floatingSidePanelHandler = new FloatingSidePanelHandler();
    });
} else {
    window.floatingSidePanelHandler = new FloatingSidePanelHandler();
}