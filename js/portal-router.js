/**
 * MapRando Portal Router & View Manager
 * JLDApps 2026 - Sanary-sur-Mer
 * 
 * Gère :
 * 1. Le fond d'écran dynamique (4 territoires d'exception en rotation douce)
 * 2. La navigation entre Accueil épuré, Carte libre, Randonner (protégé) et Guides
 * 3. L'isolation stricte de la carte en accès libre (pas d'accès aux randonnées du fonds)
 * 4. Le chargement d'un GPX local sur la carte libre avec impression PDF autour du tracé
 */

(function () {
  const BG_SLIDES = [
    {
      id: "sanary_bandol",
      name: "Sentier du Littoral Sanary - Bandol (IGN TOP 25®)",
      url: "images/vignettes/wallpaper_sanary_bandol.jpg"
    },
    {
      id: "bardenas",
      name: "Désert des Bardenas Reales (Satellite Mondial HD)",
      url: "images/vignettes/wallpaper_bardenas.jpg"
    },
    {
      id: "morimond",
      name: "Abbaye & Étang de Morimond (IGN TOP 25®)",
      url: "images/vignettes/wallpaper_morimond.jpg"
    },
    {
      id: "tongariro",
      name: "Tongariro Alpine Crossing (OpenStreetMap France)",
      url: "images/vignettes/wallpaper_tongariro.jpg"
    }
  ];

  class PortalRouter {
    constructor() {
      this.currentView = 'accueil'; // 'accueil' | 'carte' | 'randonner' | 'guides'
      this.bgSlideIndex = 0;
      this.bgSlideTimer = null;
      this.initEvents();
      this.startBgSlideshow();
    }

    initEvents() {
      window.addEventListener('hashchange', () => this.handleHashChange());
      document.addEventListener('DOMContentLoaded', () => {
        this.bindDomButtons();
        this.handleHashChange();
      });
    }

    /* =========================================================================
     * FOND D'ÉCRAN DYNAMIQUE (DIAPORAMA DES 4 TERRITOIRES)
     * ========================================================================= */
    startBgSlideshow() {
      if (this.bgSlideTimer) clearInterval(this.bgSlideTimer);
      this.bgSlideTimer = setInterval(() => {
        if (this.currentView === 'accueil') {
          this.nextBgSlide();
        }
      }, 7000);
    }

    nextBgSlide() {
      this.setBgSlide((this.bgSlideIndex + 1) % BG_SLIDES.length);
    }

    setBgSlide(index) {
      this.bgSlideIndex = index;
      const slides = document.querySelectorAll('#portal-bg-slideshow .bg-slide');
      const dots = document.querySelectorAll('.bg-slide-dot');
      const label = document.getElementById('bg-slide-label');

      slides.forEach((slide, idx) => {
        if (idx === index) {
          slide.classList.remove('opacity-0');
          slide.classList.add('opacity-100');
        } else {
          slide.classList.remove('opacity-100');
          slide.classList.add('opacity-0');
        }
      });

      dots.forEach((dot, idx) => {
        if (idx === index) {
          dot.className = 'bg-slide-dot w-2.5 h-2.5 rounded-full bg-emerald-400 transition cursor-pointer';
        } else {
          dot.className = 'bg-slide-dot w-2.5 h-2.5 rounded-full bg-white/30 hover:bg-white/60 transition cursor-pointer';
        }
      });

      if (label && BG_SLIDES[index]) {
        label.textContent = BG_SLIDES[index].name;
      }
    }

    /* =========================================================================
     * GESTION DU DOM ET NAVIGATION
     * ========================================================================= */
    bindDomButtons() {
      // Modale CGU
      const btnOpenCgu = document.getElementById('btn-open-cgu');
      const modalCgu = document.getElementById('modal-cgu');
      if (btnOpenCgu && modalCgu) {
        btnOpenCgu.addEventListener('click', (e) => {
          e.preventDefault();
          modalCgu.classList.remove('hidden');
        });
      }

      // Visualiseur GPX libre (accès libre sans compte)
      const inputGpxViewer = document.getElementById('input-quick-gpx-viewer');
      const btnQuickGpx = document.getElementById('btn-quick-gpx-viewer');
      if (btnQuickGpx && inputGpxViewer) {
        btnQuickGpx.addEventListener('click', () => inputGpxViewer.click());
        inputGpxViewer.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) this.handleQuickGpxFile(file);
        });
      }
    }

    handleHashChange() {
      const hash = window.location.hash.replace('#', '') || 'accueil';
      const parts = hash.split('?');
      const route = parts[0];
      const params = new URLSearchParams(parts[1] || '');
      this.switchView(route, params);
    }

    switchView(viewName, params = new URLSearchParams()) {
      this.currentView = viewName;

      const viewPortal = document.getElementById('portal-view');
      const viewMapContainer = document.getElementById('main-map-app-container');
      const viewGuides = document.getElementById('guides-view');
      const lockModal = document.getElementById('login-lock-modal');

      // 1. Masquer les 3 vues principales
      if (viewPortal) viewPortal.classList.add('hidden');
      if (viewMapContainer) viewMapContainer.classList.add('hidden');
      if (viewGuides) viewGuides.classList.add('hidden');

      if (viewName === 'accueil') {
        if (viewPortal) viewPortal.classList.remove('hidden');
        if (lockModal) lockModal.classList.add('hidden');
        this.hideStandaloneGpxHud();
        window.scrollTo({ top: 0, behavior: 'smooth' });

      } else if (viewName === 'guides') {
        if (viewGuides) viewGuides.classList.remove('hidden');
        if (lockModal) lockModal.classList.add('hidden');
        this.hideStandaloneGpxHud();
        window.scrollTo({ top: 0, behavior: 'smooth' });

      } else if (viewName === 'carte') {
        // =====================================================================
        // MODE CARTE SEULE EN ACCÈS LIBRE (AUCUN ACCÈS AUX TRACES DU FONDS CLUB)
        // =====================================================================
        if (viewMapContainer) viewMapContainer.classList.remove('hidden');
        if (lockModal) lockModal.classList.add('hidden');

        this.applyFreeMapMode(true);

        // Rafraîchir Leaflet
        setTimeout(() => {
          if (window.MapManagerInstance && window.MapManagerInstance.map) {
            window.MapManagerInstance.map.invalidateSize();
          }
        }, 150);

      } else if (viewName === 'randonner') {
        // =====================================================================
        // MODE RANDONNER (PROTÉGÉ PAR MOT DE PASSE : RECHERCHE & GESTION)
        // =====================================================================
        if (viewMapContainer) viewMapContainer.classList.remove('hidden');
        this.hideStandaloneGpxHud();

        const isAuthed = typeof window.AuthManager !== 'undefined' && window.AuthManager.isAuthenticated();
        if (!isAuthed) {
          if (lockModal) lockModal.classList.remove('hidden');
        } else {
          if (lockModal) lockModal.classList.add('hidden');
          this.applyFreeMapMode(false);
        }

        setTimeout(() => {
          if (window.MapManagerInstance && window.MapManagerInstance.map) {
            window.MapManagerInstance.map.invalidateSize();
          }
        }, 150);
      }
    }

    /**
     * Isole strictement la carte libre vs l'espace membre
     */
    applyFreeMapMode(isFree) {
      const searchFilterBar = document.getElementById('search-filter-bar');
      const searchInstructionsBar = document.getElementById('search-instructions-bar');
      const dbSelectorBox = document.getElementById('header-db-selector')?.closest('div');
      const storageBadge = document.getElementById('storage-badge')?.closest('div');
      const tabButtons = document.querySelectorAll('.tab-btn');
      const quickGpxBtn = document.getElementById('btn-quick-gpx-viewer');

      if (isFree) {
        // Masquer complètement les barres de filtres et d'instructions de randonnées
        if (searchFilterBar) searchFilterBar.classList.add('hidden');
        if (searchInstructionsBar) searchInstructionsBar.classList.add('hidden');
        // Masquer le sélecteur de base du club / JLDApps
        if (dbSelectorBox) dbSelectorBox.classList.add('hidden');
        if (storageBadge) storageBadge.classList.add('hidden');
        // Masquer les onglets adhérents (Trouver, Charger, Gérer)
        tabButtons.forEach(btn => btn.classList.add('hidden'));
        // Afficher le bouton charger GPX libre
        if (quickGpxBtn) quickGpxBtn.classList.remove('hidden');

        // Retirer les marqueurs du club de la carte
        if (window.MapManagerInstance) {
          const mm = window.MapManagerInstance;
          if (mm.markersLayer && mm.map && mm.map.hasLayer(mm.markersLayer)) {
            mm.map.removeLayer(mm.markersLayer);
          }
          if (mm.currentHikePolyline && mm.map && mm.map.hasLayer(mm.currentHikePolyline)) {
            mm.map.removeLayer(mm.currentHikePolyline);
          }
        }
      } else {
        // Restaurer l'interface club complète
        if (searchFilterBar) searchFilterBar.classList.remove('hidden');
        if (searchInstructionsBar) searchInstructionsBar.classList.remove('hidden');
        if (dbSelectorBox) dbSelectorBox.classList.remove('hidden');
        if (storageBadge) storageBadge.classList.remove('hidden');
        tabButtons.forEach(btn => btn.classList.remove('hidden'));
        if (quickGpxBtn) quickGpxBtn.classList.add('hidden');

        // Restaurer les marqueurs de randonnées sur la carte
        if (window.MapManagerInstance) {
          const mm = window.MapManagerInstance;
          if (mm.markersLayer && mm.map && !mm.map.hasLayer(mm.markersLayer)) {
            mm.map.addLayer(mm.markersLayer);
          }
          if (window.App && typeof window.App.filterHikes === 'function') {
            window.App.filterHikes();
          }
        }
      }
    }

    /* =========================================================================
     * CHARGEMENT GPX LIBRE & IMPRESSION AUTOUR DU TRACÉ
     * ========================================================================= */
    handleQuickGpxFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const parsed = GPXParser.parse(content, file.name);
          if (parsed && window.MapManagerInstance) {
            window.MapManagerInstance.displayStandaloneGpxTrack(parsed, file.name);
          }
        } catch (err) {
          console.error("Erreur de lecture GPX :", err);
          alert("Erreur lors de l'analyse du fichier GPX.");
        }
      };
      reader.readAsText(file);
    }

    hideStandaloneGpxHud() {
      const hud = document.getElementById('standalone-gpx-hud');
      if (hud) hud.classList.add('hidden');
    }
  }

  // Instanciation globale
  window.PortalRouterInstance = new PortalRouter();
})();
