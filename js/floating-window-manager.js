/**
 * FLOATING WINDOW MANAGER (JLDApps 2026 - v157)
 * Gestionnaire universel de déplacement fluide et de redimensionnement des fenêtres flottantes
 * Permet de :
 * 1. Déplacer n'importe quelle fenêtre en tirant son contour haut / bandeau de titre (ultra-fluide 60-120 FPS).
 * 2. Redimensionner la hauteur par le bas (tirer sur le contour bas) pour afficher facilement toutes les traces (1, 2 ou 3).
 * 3. Redimensionner la hauteur par le haut (tirer sur la fine bordure supérieure).
 * 4. Redimensionner librement largeur et hauteur par le coin inférieur droit.
 * 5. Ajuster automatiquement la fenêtre au contenu (double-clic sur l'en-tête ou bouton Agrandir □).
 * Fonctionne sur toutes les fenêtres (Cartes & Outils, Visualiseur GPX, Créateur, Éditeur, Espace Randonner, Profil alti).
 */
class FloatingWindowManager {
  constructor() {
    this.enhancedElements = new WeakSet();
    this.activeDrag = null;
    this.activeResize = null;
    this.rafPending = false;
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
    window.addEventListener('resize', () => this.clampAllMovedWindows());
  }

  scanAndEnhanceAll() {
    const selectors = [
      '#standalone-gpx-hud',
      '#hike-preview-panel',
      '#elevation-profile-container',
      '#elevation-chart-container',
      '#gpx-creator-floating-panel',
      '#gpx-editor-panel',
      '#gpx-editor-floating-panel',
      '#map-bearing-panel',
      '#map-measure-panel',
      '#gr-floating-banner',
      '#gr-color-filter-panel',
      '#map-selection-banner',
      '#screen-calib-modal > div',
      '#map-area-export-modal > div',
      '#map-legend-modal > div',
      '.movable-floating-window'
    ];

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => this.enhance(el));
    });
  }

  enhance(el) {
    if (!el) return;

    el.classList.add('movable-floating-window');

    // Désactiver la propagation des clics vers Leaflet
    if (typeof L !== 'undefined' && L.DomEvent) {
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);
    }

    // 1. Bordure supérieure active pour le redimensionnement vertical par le haut
    let topResize = el.querySelector('.window-top-resize-handle');
    if (!topResize) {
      topResize = document.createElement('div');
      topResize.className = 'window-top-resize-handle';
      topResize.title = 'Tirer vers le haut pour agrandir la fenêtre';
      topResize.addEventListener('mousedown', (e) => this.startTopResize(e, el));
      topResize.addEventListener('touchstart', (e) => this.startTopResize(e, el), { passive: false });
      el.prepend(topResize);
    }

    // 2. Bordure inférieure active pour le redimensionnement vertical par le bas (Traces & Hauteur)
    let bottomResize = el.querySelector('.window-bottom-resize-handle');
    if (!bottomResize) {
      bottomResize = document.createElement('div');
      bottomResize.className = 'window-bottom-resize-handle';
      bottomResize.title = 'Tirer vers le bas pour agrandir la fenêtre et voir toutes les randonnées';
      bottomResize.addEventListener('mousedown', (e) => this.startBottomResize(e, el));
      bottomResize.addEventListener('touchstart', (e) => this.startBottomResize(e, el), { passive: false });
      el.appendChild(bottomResize);
    }

    // 3. Poignée de redimensionnement en coin inférieur droit
    let cornerResize = el.querySelector('.window-corner-resize-handle');
    if (!cornerResize) {
      cornerResize = document.createElement('div');
      cornerResize.className = 'window-corner-resize-handle';
      cornerResize.title = 'Tirer pour redimensionner la fenêtre';
      cornerResize.addEventListener('mousedown', (e) => this.startCornerResize(e, el));
      cornerResize.addEventListener('touchstart', (e) => this.startCornerResize(e, el), { passive: false });
      el.appendChild(cornerResize);
    }

    // 4. Identifier ou équiper la barre de titre pour le déplacement
    let header = el.querySelector('.window-drag-header') ||
                 el.querySelector('#preview-drag-handle') ||
                 el.querySelector('.flex.items-center.justify-between') ||
                 el.querySelector('.flex.items-start');

    if (header) {
      header.classList.add('window-drag-header');
      header.setAttribute('title', 'Maintenir et tirer avec la souris pour déplacer cette fenêtre sur la carte (double-clic pour ajuster la taille)');

      if (!header.querySelector('.window-drag-grip') && !header.querySelector('#preview-drag-handle')) {
        const grip = document.createElement('span');
        grip.className = 'window-drag-grip text-slate-400 hover:text-white mr-1.5 text-xs opacity-75 select-none cursor-grab';
        grip.innerText = '⠿';
        grip.title = 'Déplacer';
        header.prepend(grip);
      }

      // Double-clic sur l'en-tête pour auto-ajustement de la taille
      if (!header.dataset.hasDblClick) {
        header.dataset.hasDblClick = 'true';
        header.addEventListener('dblclick', (e) => {
          if (e.target.closest('button, a, input, select, [type="button"], .hud-win-btn')) return;
          this.autoFit(el);
        });
      }
    }

    // 5. Écouteur principal de déplacement par le contour haut
    if (!el.dataset.dragListening) {
      el.dataset.dragListening = 'true';
      el.addEventListener('mousedown', (e) => this.handlePanelMouseDown(e, el));
      el.addEventListener('touchstart', (e) => this.handlePanelMouseDown(e, el), { passive: false });
    }
  }

  handlePanelMouseDown(e, el) {
    // Ignorer clics sur boutons, inputs, liens, cases à cocher, pastilles de couleur, fermetures
    const ignored = e.target.closest('button, input, select, a, [type="button"], .hud-win-btn, .custom-edit-handle, .window-corner-resize-handle, .window-bottom-resize-handle, .window-top-resize-handle');
    if (ignored) return;

    const panelRect = el.getBoundingClientRect();
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    const relY = clientY - panelRect.top;
    const relBottom = panelRect.bottom - clientY;

    // Si clic très proche du bas (0-8px) -> redimensionnement par le bas
    if (relBottom <= 8) {
      this.startBottomResize(e, el);
      return;
    }

    // Si clic dans les 55 premiers pixels ou en-tête -> DÉPLACEMENT
    if (relY <= 55 || e.target.closest('.window-drag-header')) {
      this.startDrag(e, el);
    }
  }

  // --- DÉPLACEMENT PAR LE CONTOUR HAUT (FLUIDITÉ MAXIMALE 60-120 FPS) ---
  startDrag(e, el) {
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

    const offsetParent = el.offsetParent || document.body;
    const parentRect = offsetParent.getBoundingClientRect();
    const panelRect = el.getBoundingClientRect();

    const initialLeft = panelRect.left - parentRect.left;
    const initialTop = panelRect.top - parentRect.top;

    // Retirer toutes les classes Tailwind de positionnement relatif pour éviter les conflits
    el.classList.remove('right-2', 'sm:right-16', 'right-auto', 'left-1/2', '-translate-x-1/2', 'top-4', 'bottom-11', 'sm:bottom-12', 'transition-all', 'transition', 'duration-200', 'duration-300');

    el.style.setProperty('transition', 'none', 'important');
    el.style.setProperty('transform', 'none', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('left', `${initialLeft}px`, 'important');
    el.style.setProperty('top', `${initialTop}px`, 'important');
    el.style.setProperty('width', `${panelRect.width}px`, 'important');

    el.dataset.userMoved = 'true';
    el.dataset.userLeft = String(initialLeft);
    el.dataset.userTop = String(initialTop);

    el.classList.add('window-is-moving');
    const header = el.querySelector('.window-drag-header') || el;
    header.classList.add('is-dragging');

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    this.activeDrag = {
      el,
      header,
      startX: clientX,
      startY: clientY,
      initialLeft,
      initialTop,
      parentLeft: parentRect.left,
      parentTop: parentRect.top,
      panelWidth: panelRect.width,
      panelHeight: panelRect.height,
      targetX: initialLeft,
      targetY: initialTop
    };

    e.preventDefault();
    e.stopPropagation();
  }

  // --- REDIMENSIONNEMENT PAR LA BORDURE BASSE (TRACES & HAUTEUR) ---
  startBottomResize(e, el) {
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    const offsetParent = el.offsetParent || document.body;
    const parentRect = offsetParent.getBoundingClientRect();
    const panelRect = el.getBoundingClientRect();

    const initialTop = panelRect.top - parentRect.top;
    const initialHeight = panelRect.height;

    el.classList.remove('transition-all', 'transition', 'duration-200', 'duration-300', 'bottom-11', 'sm:bottom-12');
    el.style.setProperty('transition', 'none', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty('top', `${initialTop}px`, 'important');
    el.style.setProperty('left', `${panelRect.left - parentRect.left}px`, 'important');
    el.style.setProperty('width', `${panelRect.width}px`, 'important');
    el.style.setProperty('height', `${initialHeight}px`, 'important');

    el.dataset.userResized = 'true';

    el.classList.add('window-is-moving');
    const handle = el.querySelector('.window-bottom-resize-handle');
    if (handle) handle.classList.add('is-resizing');

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';

    this.activeResize = {
      type: 'bottom',
      el,
      handle,
      startY: clientY,
      initialHeight,
      minHeight: 80,
      targetHeight: initialHeight
    };

    e.preventDefault();
    e.stopPropagation();
  }

  // --- REDIMENSIONNEMENT PAR LA BORDURE HAUTE ---
  startTopResize(e, el) {
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    const offsetParent = el.offsetParent || document.body;
    const parentRect = offsetParent.getBoundingClientRect();
    const panelRect = el.getBoundingClientRect();

    const initialTop = panelRect.top - parentRect.top;
    const initialHeight = panelRect.height;

    el.classList.remove('right-2', 'sm:right-16', 'right-auto', 'left-1/2', '-translate-x-1/2', 'top-4', 'bottom-11', 'sm:bottom-12', 'transition-all', 'transition', 'duration-200', 'duration-300');

    el.style.setProperty('transition', 'none', 'important');
    el.style.setProperty('transform', 'none', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('left', `${panelRect.left - parentRect.left}px`, 'important');
    el.style.setProperty('top', `${initialTop}px`, 'important');
    el.style.setProperty('width', `${panelRect.width}px`, 'important');
    el.style.setProperty('height', `${initialHeight}px`, 'important');

    el.dataset.userResized = 'true';

    el.classList.add('window-is-moving');
    const handle = el.querySelector('.window-top-resize-handle');
    if (handle) handle.classList.add('is-resizing');

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';

    this.activeResize = {
      type: 'top',
      el,
      handle,
      startY: clientY,
      initialTop,
      initialHeight,
      minHeight: 80,
      targetTop: initialTop,
      targetHeight: initialHeight
    };

    e.preventDefault();
    e.stopPropagation();
  }

  // --- REDIMENSIONNEMENT PAR LE COIN INFÉRIEUR DROIT ---
  startCornerResize(e, el) {
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    const panelRect = el.getBoundingClientRect();

    el.classList.remove('transition-all', 'transition', 'duration-200', 'duration-300');
    el.style.setProperty('transition', 'none', 'important');

    el.dataset.userResized = 'true';

    const handle = el.querySelector('.window-corner-resize-handle');
    if (handle) handle.classList.add('is-resizing');
    el.classList.add('window-is-moving');

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'se-resize';

    this.activeResize = {
      type: 'corner',
      el,
      handle,
      startX: clientX,
      startY: clientY,
      initialWidth: panelRect.width,
      initialHeight: panelRect.height,
      minWidth: 200,
      minHeight: 80,
      targetWidth: panelRect.width,
      targetHeight: panelRect.height
    };

    e.preventDefault();
    e.stopPropagation();
  }

  handleGlobalMouseMove(e) {
    if (!this.activeDrag && !this.activeResize) return;

    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

    if (this.activeDrag) {
      const d = this.activeDrag;
      const dx = clientX - d.startX;
      const dy = clientY - d.startY;

      // Dimensions réelles actuelles de la fenêtre
      const currentWidth = d.el.offsetWidth || d.panelWidth || 320;
      const currentHeight = d.el.offsetHeight || d.panelHeight || 180;

      // CONFINEMENT STRICT DANS LE VIEWPORT (Image 2) :
      // La fenêtre ne doit JAMAIS sortir de la zone d'affichage (minimum 8px de marge sur les 4 côtés)
      const minMargin = 8;
      const minViewportX = minMargin;
      const maxViewportX = Math.max(minMargin, window.innerWidth - currentWidth - minMargin);
      const minViewportY = minMargin;
      const maxViewportY = Math.max(minViewportY, window.innerHeight - currentHeight - minMargin);

      const targetViewportX = Math.min(Math.max(minViewportX, d.initialLeft + dx + d.parentLeft), maxViewportX);
      const targetViewportY = Math.min(Math.max(minViewportY, d.initialTop + dy + d.parentTop), maxViewportY);

      let newX = targetViewportX - d.parentLeft;
      let newY = targetViewportY - d.parentTop;

      d.targetX = newX;
      d.targetY = newY;

      d.el.style.setProperty('left', `${newX}px`, 'important');
      d.el.style.setProperty('top', `${newY}px`, 'important');
      d.el.dataset.userLeft = String(newX);
      d.el.dataset.userTop = String(newY);

      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (this.activeResize) {
      const r = this.activeResize;
      if (r.type === 'top') {
        const dy = clientY - r.startY;
        r.targetTop = r.initialTop + dy;
        r.targetHeight = Math.max(r.minHeight, r.initialHeight - dy);
        if (r.targetHeight >= r.minHeight && r.targetTop >= 4) {
          r.el.style.setProperty('top', `${r.targetTop}px`, 'important');
          r.el.style.setProperty('height', `${r.targetHeight}px`, 'important');
          r.el.dataset.userTop = String(r.targetTop);
        }
      } else if (r.type === 'bottom') {
        const dy = clientY - r.startY;
        r.targetHeight = Math.max(r.minHeight, r.initialHeight + dy);
        r.el.style.setProperty('height', `${r.targetHeight}px`, 'important');
      } else if (r.type === 'corner') {
        const dx = clientX - r.startX;
        const dy = clientY - r.startY;
        r.targetWidth = Math.max(r.minWidth, r.initialWidth + dx);
        r.targetHeight = Math.max(r.minHeight, r.initialHeight + dy);
        r.el.style.setProperty('width', `${r.targetWidth}px`, 'important');
        r.el.style.setProperty('height', `${r.targetHeight}px`, 'important');
      }

      if (r.el.id === 'hike-preview-panel' && window.ElevationProfileInstance) {
        window.ElevationProfileInstance.resizeAndDraw();
      }

      e.preventDefault();
      e.stopPropagation();
    }
  }

  handleGlobalMouseUp() {
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    if (this.activeDrag) {
      const d = this.activeDrag;
      d.el.style.setProperty('left', `${d.targetX}px`, 'important');
      d.el.style.setProperty('top', `${d.targetY}px`, 'important');
      d.el.dataset.userLeft = String(d.targetX);
      d.el.dataset.userTop = String(d.targetY);
      d.el.classList.remove('window-is-moving');
      if (d.header) d.header.classList.remove('is-dragging');
      this.activeDrag = null;
    }
    if (this.activeResize) {
      const r = this.activeResize;
      r.el.classList.remove('window-is-moving');
      if (r.handle) r.handle.classList.remove('is-resizing');
      if (r.el.id === 'hike-preview-panel' && window.ElevationProfileInstance) {
        window.ElevationProfileInstance.resizeAndDraw();
      }
      this.activeResize = null;
    }
  }

  /**
   * Ajuste automatiquement la taille de la fenêtre à son contenu complet
   */
  autoFit(el) {
    if (!el) return;
    delete el.dataset.userResized;
    el.style.removeProperty('height');
    el.style.height = '';

    const tracksContainer = el.querySelector('.gpx-tracks-container');
    if (tracksContainer) {
      tracksContainer.style.removeProperty('max-height');
    }

    if (el.id === 'hike-preview-panel' && window.ElevationProfileInstance) {
      window.ElevationProfileInstance.resizeAndDraw();
    }

    if (typeof window.App?.showToast === 'function') {
      window.App.showToast('Fenêtre ajustée automatiquement à son contenu', 'info');
    }
  }

  /**
   * Confinement strict d'une fenêtre dans les limites visibles de l'écran (Image 2)
   */
  clampWindow(el) {
    if (!el || el.classList.contains('hidden') || el.style.display === 'none') return;
    const offsetParent = el.offsetParent || document.body;
    const parentRect = offsetParent.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w <= 0 || h <= 0) return;

    const minMargin = 8;
    const minX = minMargin;
    const maxX = Math.max(minMargin, window.innerWidth - w - minMargin);
    const minY = minMargin;
    const maxY = Math.max(minMargin, window.innerHeight - h - minMargin);

    const curViewportX = rect.left;
    const curViewportY = rect.top;

    const clampedX = Math.min(Math.max(minX, curViewportX), maxX);
    const clampedY = Math.min(Math.max(minY, curViewportY), maxY);

    if (Math.abs(clampedX - curViewportX) > 1 || Math.abs(clampedY - curViewportY) > 1) {
      const newLeft = clampedX - parentRect.left;
      const newTop = clampedY - parentRect.top;
      el.style.setProperty('left', `${newLeft}px`, 'important');
      el.style.setProperty('top', `${newTop}px`, 'important');
      el.dataset.userLeft = String(newLeft);
      el.dataset.userTop = String(newTop);
    }
  }

  /**
   * Confinement automatique de toutes les fenêtres déplacées par l'utilisateur
   */
  clampAllMovedWindows() {
    const selectors = [
      '#standalone-gpx-hud',
      '#hike-preview-panel',
      '#elevation-profile-container',
      '#gpx-creator-floating-panel',
      '#gpx-editor-panel',
      '#gpx-editor-floating-panel',
      '#map-bearing-panel',
      '#map-measure-panel',
      '#gr-floating-banner',
      '#gr-color-filter-panel',
      '#map-selection-banner',
      '.movable-floating-window'
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (el.dataset.userMoved === 'true') {
          this.clampWindow(el);
        }
      });
    });
  }
}

window.FloatingWindowManagerInstance = new FloatingWindowManager();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.FloatingWindowManagerInstance.init());
} else {
  window.FloatingWindowManagerInstance.init();
}
