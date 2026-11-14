/**
 * FLOATING WINDOW MANAGER (JLDApps 2026)
 * Gestionnaire universel de déplacement et redimensionnement des fenêtres flottantes
 * Permet de déplacer n'importe quelle petite fenêtre en tirant son contour haut / barre de titre,
 * et d'ajuster sa hauteur en tirant sur la bordure supérieure (ou son coin inférieur droit).
 * Fonctionne sur toutes les fenêtres des 2 cartes (Carte & Outils et Espace Randonner).
 */
class FloatingWindowManager {
  constructor() {
    this.enhancedElements = new WeakSet();
    this.activeDrag = null;
    this.activeResize = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Scan initial
    this.scanAndEnhanceAll();

    // Observer pour toute nouvelle fenêtre injectée dynamiquement
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) {
        this.scanAndEnhanceAll();
      }
    });

    const target = document.getElementById('main-map-app-container') || document.body;
    observer.observe(target, { childList: true, subtree: true });

    // Événements globaux de déplacement et redimensionnement
    window.addEventListener('mousemove', (e) => this.handleGlobalMouseMove(e), { passive: false });
    window.addEventListener('mouseup', (e) => this.handleGlobalMouseUp(e));
    window.addEventListener('touchmove', (e) => this.handleGlobalMouseMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this.handleGlobalMouseUp(e));
  }

  scanAndEnhanceAll() {
    const selectors = [
      '#standalone-gpx-hud',
      '#map-bearing-panel',
      '#map-measure-panel',
      '#gpx-creator-floating-panel',
      '#gpx-editor-floating-panel',
      '#gr-floating-banner',
      '#gr-color-filter-panel',
      '#map-selection-banner',
      '#hike-preview-panel',
      '#screen-calib-modal > div',
      '#map-area-export-modal > div',
      '#map-legend-modal > div'
    ];

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => this.enhance(el));
    });
  }

  enhance(el) {
    if (!el || this.enhancedElements.has(el)) return;
    this.enhancedElements.add(el);

    el.classList.add('movable-floating-window');

    // Désactiver la propagation des clics vers Leaflet
    if (typeof L !== 'undefined' && L.DomEvent) {
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);
    }

    // 1. Bordure supérieure active pour le redimensionnement vertical (contour haut)
    if (!el.querySelector('.window-top-resize-handle')) {
      const topResize = document.createElement('div');
      topResize.className = 'window-top-resize-handle';
      topResize.title = 'Tirer vers le haut ou le bas pour ajuster la hauteur de la fenêtre';
      el.prepend(topResize);
    }

    // 2. Identifier ou équiper la barre de titre
    let header = el.querySelector('.window-drag-header') ||
                 el.querySelector('#preview-drag-handle') ||
                 el.querySelector('.flex.items-center.justify-between');

    if (header) {
      header.classList.add('window-drag-header');
      header.setAttribute('title', 'Maintenir et tirer avec la souris pour déplacer cette fenêtre sur la carte');

      if (!header.querySelector('.window-drag-grip') && !header.querySelector('#preview-drag-handle')) {
        const grip = document.createElement('span');
        grip.className = 'window-drag-grip text-slate-400 hover:text-white mr-1 text-xs opacity-70 select-none cursor-grab';
        grip.innerText = '⠿';
        grip.title = 'Déplacer';
        header.prepend(grip);
      }
    }

    // 3. Poignée de redimensionnement en coin inférieur droit
    if (!el.querySelector('.window-corner-resize-handle')) {
      const cornerResize = document.createElement('div');
      cornerResize.className = 'window-corner-resize-handle';
      cornerResize.title = 'Tirer pour redimensionner la fenêtre';
      cornerResize.addEventListener('mousedown', (e) => this.startCornerResize(e, el));
      cornerResize.addEventListener('touchstart', (e) => this.startCornerResize(e, el), { passive: false });
      el.appendChild(cornerResize);
    }

    // 4. Écouteur unifié sur le contour haut de la fenêtre (zone de 0 à 55px depuis le haut)
    el.addEventListener('mousedown', (e) => this.handlePanelMouseDown(e, el));
    el.addEventListener('touchstart', (e) => this.handlePanelMouseDown(e, el), { passive: false });
  }

  getContainer(el) {
    return el.offsetParent || document.getElementById('map-column') || document.getElementById('main-map-app-container') || document.body;
  }

  handlePanelMouseDown(e, el) {
    // Ignorer clics sur boutons, inputs, liens, cases à cocher, etc.
    if (e.target.closest('button, input, select, a, [type="button"], .hud-win-btn, .custom-edit-handle, .window-corner-resize-handle')) return;

    const panelRect = el.getBoundingClientRect();
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    const relY = clientY - panelRect.top;

    // Zone 1 : Bordure supérieure (0 à 8px) -> Redimensionnement hauteur par le haut
    if (relY <= 8 || e.target.classList.contains('window-top-resize-handle')) {
      this.startTopResize(e, el);
      return;
    }

    // Zone 2 : Bandeau / contour supérieur (8 à 55px) -> Déplacement de la fenêtre
    if (relY <= 55 || e.target.closest('.window-drag-header')) {
      this.startDrag(e, el);
    }
  }

  // --- DÉPLACEMENT PAR LE CONTOUR HAUT ---
  startDrag(e, el) {
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

    const container = this.getContainer(el);
    const containerRect = container.getBoundingClientRect();
    const panelRect = el.getBoundingClientRect();

    const initialLeft = panelRect.left - containerRect.left;
    const initialTop = panelRect.top - containerRect.top;

    // Retirer classes Tailwind conflictuelles
    el.classList.remove('right-2', 'sm:right-16', 'right-auto', 'left-1/2', '-translate-x-1/2');

    el.style.setProperty('transform', 'none', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('left', `${initialLeft}px`, 'important');
    el.style.setProperty('top', `${initialTop}px`, 'important');
    el.style.setProperty('width', `${panelRect.width}px`, 'important');

    el.classList.add('window-is-moving');
    const header = el.querySelector('.window-drag-header') || el;
    header.classList.add('is-dragging');

    this.activeDrag = {
      el,
      header,
      container,
      startX: clientX,
      startY: clientY,
      initialLeft,
      initialTop
    };

    e.preventDefault();
    e.stopPropagation();
  }

  // --- REDIMENSIONNEMENT PAR LA BORDURE HAUTE ---
  startTopResize(e, el) {
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    const container = this.getContainer(el);
    const containerRect = container.getBoundingClientRect();
    const panelRect = el.getBoundingClientRect();

    const initialTop = panelRect.top - containerRect.top;
    const initialHeight = panelRect.height;

    // Retirer classes Tailwind conflictuelles
    el.classList.remove('right-2', 'sm:right-16', 'right-auto', 'left-1/2', '-translate-x-1/2');

    el.style.setProperty('transform', 'none', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('left', `${panelRect.left - containerRect.left}px`, 'important');
    el.style.setProperty('top', `${initialTop}px`, 'important');
    el.style.setProperty('width', `${panelRect.width}px`, 'important');
    el.style.setProperty('height', `${initialHeight}px`, 'important');

    el.classList.add('window-is-moving');
    const handle = el.querySelector('.window-top-resize-handle');
    if (handle) handle.classList.add('is-resizing');

    this.activeResize = {
      type: 'top',
      el,
      handle,
      container,
      startY: clientY,
      initialTop,
      initialHeight,
      minHeight: 60
    };

    e.preventDefault();
    e.stopPropagation();
  }

  // --- REDIMENSIONNEMENT PAR LE COIN INFÉRIEUR DROIT ---
  startCornerResize(e, el) {
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    const container = this.getContainer(el);
    const panelRect = el.getBoundingClientRect();

    const handle = el.querySelector('.window-corner-resize-handle');
    if (handle) handle.classList.add('is-resizing');
    el.classList.add('window-is-moving');

    this.activeResize = {
      type: 'corner',
      el,
      handle,
      container,
      startX: clientX,
      startY: clientY,
      initialWidth: panelRect.width,
      initialHeight: panelRect.height,
      minWidth: 180,
      minHeight: 60
    };

    e.preventDefault();
    e.stopPropagation();
  }

  handleGlobalMouseMove(e) {
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

    if (this.activeDrag) {
      const { el, container, startX, startY, initialLeft, initialTop } = this.activeDrag;
      const dx = clientX - startX;
      const dy = clientY - startY;

      const containerRect = container.getBoundingClientRect();
      const panelRect = el.getBoundingClientRect();

      const minX = 4;
      const maxX = Math.max(minX, containerRect.width - panelRect.width - 4);
      const minY = 4;
      const maxY = Math.max(minY, containerRect.height - panelRect.height - 4);

      const targetX = Math.max(minX, Math.min(maxX, initialLeft + dx));
      const targetY = Math.max(minY, Math.min(maxY, initialTop + dy));

      el.style.setProperty('left', `${targetX}px`, 'important');
      el.style.setProperty('top', `${targetY}px`, 'important');

      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (this.activeResize) {
      const r = this.activeResize;
      if (r.type === 'top') {
        const dy = clientY - r.startY;
        const newTop = r.initialTop + dy;
        const newHeight = r.initialHeight - dy;

        if (newHeight >= r.minHeight && newTop >= 4) {
          r.el.style.setProperty('top', `${newTop}px`, 'important');
          r.el.style.setProperty('height', `${newHeight}px`, 'important');
        }
      } else if (r.type === 'corner') {
        const dx = clientX - r.startX;
        const dy = clientY - r.startY;
        const newWidth = Math.max(r.minWidth, r.initialWidth + dx);
        const newHeight = Math.max(r.minHeight, r.initialHeight + dy);

        r.el.style.setProperty('width', `${newWidth}px`, 'important');
        r.el.style.setProperty('height', `${newHeight}px`, 'important');
      }

      e.preventDefault();
      e.stopPropagation();
    }
  }

  handleGlobalMouseUp() {
    if (this.activeDrag) {
      this.activeDrag.el.classList.remove('window-is-moving');
      if (this.activeDrag.header) this.activeDrag.header.classList.remove('is-dragging');
      this.activeDrag = null;
    }
    if (this.activeResize) {
      this.activeResize.el.classList.remove('window-is-moving');
      if (this.activeResize.handle) this.activeResize.handle.classList.remove('is-resizing');
      this.activeResize = null;
    }
  }
}

window.FloatingWindowManagerInstance = new FloatingWindowManager();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.FloatingWindowManagerInstance.init());
} else {
  window.FloatingWindowManagerInstance.init();
}
