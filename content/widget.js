// Floating capsule widget (Web Component)

class CapsuleWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 999999;
          display: none;
        }
        .capsule {
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: white;
          padding: 12px 24px;
          border-radius: 9999px;
          font-family: system-ui, sans-serif;
          font-weight: bold;
          cursor: grab;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          user-select: none;
          transition: transform 0.1s;
        }
        .capsule:active {
          cursor: grabbing;
          transform: scale(0.95);
        }
      </style>
      <div class="capsule" id="capsule-ui">
        Capsule
      </div>
    `;
    
    this.capsuleElement = this.shadowRoot.getElementById('capsule-ui');
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.capsuleData = null;

    this.initDrag();
  }

  show(data) {
    this.capsuleData = data;
    this.style.display = 'block';
  }

  hide() {
    this.style.display = 'none';
  }

  initDrag() {
    this.capsuleElement.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      
      const rect = this.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      
      document.addEventListener('mousemove', this.onDrag);
      document.addEventListener('mouseup', this.onDrop);
    });
  }

  onDrag = (e) => {
    if (!this.isDragging) return;
    
    // Position using fixed coordinates
    this.style.left = `${e.clientX - this.dragOffset.x}px`;
    this.style.top = `${e.clientY - this.dragOffset.y}px`;
    this.style.right = 'auto';
    this.style.bottom = 'auto';
  };

  onDrop = (e) => {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.onDrag);
    document.removeEventListener('mouseup', this.onDrop);
    
    // Dispatch a custom event when dropped so the main script can handle injection
    this.dispatchEvent(new CustomEvent('capsule-drop', {
      detail: { data: this.capsuleData, x: e.clientX, y: e.clientY }
    }));
  };
}

customElements.define('capsule-widget', CapsuleWidget);

// Make it available to the content script
window.CapsuleWidget = CapsuleWidget;
