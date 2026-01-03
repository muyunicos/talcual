class ModalSystem {
  constructor() {
    this.slots = {};
    this.buttonHandlers = {};
    this.init();
  }

  init() {
    if (!document.getElementById('modal-system-root')) {
      this.injectHTML();
    }
    this.cacheSlots();
  }

  injectHTML() {
    const root = document.createElement('div');
    root.id = 'modal-system-root';
    root.innerHTML = `
      <div id="modal-slot-1" class="modal-slot">
        <div class="modal-overlay">
          <div class="modal-content">
            <div class="modal-body"></div>
            <div class="modal-buttons"></div>
          </div>
        </div>
      </div>
      <div id="modal-slot-2" class="modal-slot">
        <div class="modal-overlay">
          <div class="modal-content">
            <div class="modal-body"></div>
            <div class="modal-buttons"></div>
          </div>
        </div>
      </div>
      <div id="modal-slot-3" class="modal-slot">
        <div class="modal-overlay">
          <div class="modal-content">
            <div class="modal-body"></div>
            <div class="modal-buttons"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);
  }

  cacheSlots() {
    for (let i = 1; i <= 3; i++) {
      const slot = document.getElementById(`modal-slot-${i}`);
      if (!slot) {
        throw new Error(`[ModalSystem] Critical element not found: modal-slot-${i}`);
      }
      this.slots[i] = {
        container: slot,
        overlay: slot.querySelector('.modal-overlay'),
        content: slot.querySelector('.modal-content'),
        body: slot.querySelector('.modal-body'),
        buttons: slot.querySelector('.modal-buttons')
      };
    }
  }

  show(slotId, htmlContent, buttons = []) {
    if (!this.slots[slotId]) {
      throw new Error(`[ModalSystem] Invalid slotId: ${slotId}. Must be 1, 2, or 3.`);
    }

    const slot = this.slots[slotId];

    if (slot.body) {
      if (typeof htmlContent === 'string') {
        slot.body.innerHTML = htmlContent;
      } else if (htmlContent instanceof HTMLElement) {
        slot.body.innerHTML = '';
        slot.body.appendChild(htmlContent);
      }
    }

    if (slot.buttons) {
      slot.buttons.innerHTML = '';
      buttons.forEach((btnDef) => {
        const [callback, label, styleClass] = btnDef;
        const button = document.createElement('button');
        button.textContent = label;
        button.className = styleClass || 'btn';

        button.addEventListener('click', (e) => {
          e.stopPropagation();
          if (callback) {
            callback();
          }
        });

        slot.buttons.appendChild(button);
      });
    }

    slot.container.classList.remove('hidden');
    requestAnimationFrame(() => {
      slot.overlay.classList.add('active');
    });

    document.body.style.overflow = 'hidden';
  }

  close(slotId) {
    if (!this.slots[slotId]) {
      throw new Error(`[ModalSystem] Invalid slotId: ${slotId}. Must be 1, 2, or 3.`);
    }

    const slot = this.slots[slotId];
    slot.overlay.classList.remove('active');

    setTimeout(() => {
      slot.container.classList.add('hidden');
      if (slot.body) slot.body.innerHTML = '';
      if (slot.buttons) slot.buttons.innerHTML = '';

      const hasOpenModal = Object.values(this.slots).some(
        (s) => !s.container.classList.contains('hidden')
      );
      if (!hasOpenModal) {
        document.body.style.overflow = '';
      }
    }, 300);
  }

  closeAll() {
    for (let i = 1; i <= 3; i++) {
      if (!this.slots[i].container.classList.contains('hidden')) {
        this.close(i);
      }
    }
  }

  isOpen(slotId) {
    if (!this.slots[slotId]) return false;
    return !this.slots[slotId].container.classList.contains('hidden');
  }
}

const ModalSystem_Instance = new ModalSystem();

console.log('%c✅ ModalSystem.js', 'color: #00FF00; font-weight: bold; font-size: 12px');