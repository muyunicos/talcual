class LeaderboardComponent {
    constructor() {
        this.sidepanel = null;
        this.isOpen = true;
        this.toggleBtn = null;
        this.toggleArrow = null;
        this.playersList = null;
        this.categorySticker = null;
    }

    mount(parentElement) {
        const html = `
            <div class="floating-side-panel" id="floating-side-panel" role="complementary" aria-label="Panel lateral con ranking">
                <div class="category-sticker" id="category-sticker" aria-label="Categoría actual">Sin categoría</div>

                <div class="panel-tabs" role="tablist" aria-label="Vistas del panel lateral">
                    <div class="panel-tab active" data-tab="ranking" role="tab" aria-selected="true" aria-label="Ver ranking de jugadores">🏆 Ranking</div>
                </div>

                <div class="panel-content" role="tabpanel">
                    <div class="panel-view active" data-view="ranking">
                        <div class="panel-list" id="players-list">
                            <div class="panel-item"><div class="name">Sin jugadores aún</div></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        parentElement.insertAdjacentHTML('beforeend', html);

        this.sidepanel = document.getElementById('floating-side-panel');
        this.playersList = document.getElementById('players-list');
        this.categorySticker = document.getElementById('category-sticker');

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

    updateList(players) {
        if (!players || !this.playersList) return;

        const sidebarHtml = Object.entries(players).map(([pid, player]) => {
            const ready = player.status === 'ready';
            const readyIcon = ready ? '✅' : '⏳';
            const wordCount = player.answers ? player.answers.length : 0;
            return `
                <div class="player-item ${ready ? 'ready' : 'waiting'}" data-player-id="${pid}">
                    <div class="player-name" style="color: ${player.color ? player.color.split(',')[0] : '#999'}">
                        ${readyIcon} ${sanitizeText(player.name)}
                    </div>
                    <div class="player-words">${wordCount} palabras</div>
                    <div class="player-score">${player.score || 0} pts</div>
                    <div class="player-status-indicator" data-player-status></div>
                </div>
            `;
        }).join('');

        this.playersList.innerHTML = sidebarHtml || '<div class="panel-item"><div class="name">Sin jugadores aún</div></div>';
    }

    setCategory(categoryName) {
        if (!this.categorySticker) return;
        this.categorySticker.textContent = categoryName || 'Sin categoría';
    }
}

console.log('%c✅ LeaderboardComponent', 'color: #00aa00; font-weight: bold');