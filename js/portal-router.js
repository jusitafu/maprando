/**
 * MapRando Portal Router & View Manager
 * Gère la navigation fluide entre la page d'accueil (Hub 3 voies),
 * la carte plein écran en accès libre, l'espace randonnées et les guides techniques.
 * JLDApps 2026
 */

(function () {
  const LOCATIONS = {
    tongariro: {
      name: "Tongariro Alpine Crossing",
      lat: -39.1444,
      lng: 175.6478,
      zoom: 13,
      layer: "OpenStreetMap France (Sentiers)"
    },
    bardenas: {
      name: "Désert des Bardenas Reales",
      lat: 42.1895,
      lng: -1.5312,
      zoom: 13,
      layer: "Satellite Mondial (Esri 🌍)"
    },
    morimond: {
      name: "Étang de Morimond",
      lat: 48.0531,
      lng: 5.6425,
      zoom: 14,
      layer: "IGN TOP 25 (Carte papier officielle)"
    },
    sanary_bandol: {
      name: "Sentier du Littoral Sanary - Bandol",
      lat: 43.1250,
      lng: 5.7750,
      zoom: 14,
      layer: "IGN TOP 25 (Carte papier officielle)"
    }
  };

  class PortalRouter {
    constructor() {
      this.currentView = 'accueil'; // 'accueil' | 'carte' | 'randonner' | 'guides'
      this.initEvents();
    }

    initEvents() {
      window.addEventListener('hashchange', () => this.handleHashChange());
      document.addEventListener('DOMContentLoaded', () => {
        this.bindDomButtons();
        this.handleHashChange();
      });
    }

    bindDomButtons() {
      // 1. Boutons du Hub d'accueil
      const btnToCarte = document.getElementById('hub-btn-carte');
      const btnToRando = document.getElementById('hub-btn-randonner');
      const btnToGuides = document.getElementById('hub-btn-guides');
      const btnOpenCgu = document.getElementById('btn-open-cgu');
      const btnCloseCgu = document.getElementById('btn-close-cgu');
      const modalCgu = document.getElementById('modal-cgu');

      if (btnToCarte) {
        btnToCarte.addEventListener('click', (e) => {
          e.preventDefault();
          this.navigateTo('carte');
        });
      }

      if (btnToRando) {
        btnToRando.addEventListener('click', (e) => {
          e.preventDefault();
          this.navigateTo('randonner');
        });
      }

      if (btnToGuides) {
        btnToGuides.addEventListener('click', (e) => {
          e.preventDefault();
          this.navigateTo('guides');
        });
      }

      // Boutons retour accueil
      document.querySelectorAll('.btn-return-home').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.navigateTo('accueil');
        });
      });

      // Modale CGU
      if (btnOpenCgu && modalCgu) {
        btnOpenCgu.addEventListener('click', (e) => {
          e.preventDefault();
          modalCgu.classList.remove('hidden');
        });
      }
      if (btnCloseCgu && modalCgu) {
        btnCloseCgu.addEventListener('click', (e) => {
          e.preventDefault();
          modalCgu.classList.add('hidden');
        });
      }
      if (modalCgu) {
        modalCgu.addEventListener('click', (e) => {
          if (e.target === modalCgu) modalCgu.classList.add('hidden');
        });
      }

      // Clics sur les 4 vignettes de territoires
      document.querySelectorAll('[data-loc-id]').forEach(card => {
        card.addEventListener('click', () => {
          const locId = card.getAttribute('data-loc-id');
          this.openLocationOnMap(locId);
        });
      });

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

    navigateTo(viewName) {
      window.location.hash = '#' + viewName;
    }

    handleHashChange() {
      const hash = window.location.hash.replace('#', '') || 'accueil';
      const parts = hash.split('?');
      const route = parts[0];

      // Extraction des paramètres
      const params = new URLSearchParams(parts[1] || '');

      this.switchView(route, params);
    }

    switchView(viewName, params = new URLSearchParams()) {
      this.currentView = viewName;

      const viewPortal = document.getElementById('portal-view');
      const viewMapContainer = document.getElementById('main-map-app-container');
      const viewGuides = document.getElementById('guides-view');
      const randoFiltersBar = document.getElementById('search-controls-container');
      const randoNavTabs = document.getElementById('main-nav-tabs');
      const quickGpxBtn = document.getElementById('btn-quick-gpx-viewer');

      // 1. Masquer toutes les vues
      if (viewPortal) viewPortal.classList.add('hidden');
      if (viewMapContainer) viewMapContainer.classList.add('hidden');
      if (viewGuides) viewGuides.classList.add('hidden');

      if (viewName === 'accueil') {
        if (viewPortal) viewPortal.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (viewName === 'guides') {
        if (viewGuides) viewGuides.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (viewName === 'carte' || viewName === 'randonner') {
        if (viewMapContainer) viewMapContainer.classList.remove('hidden');

        // Mode Carte libre (sans mot de passe) vs Mode Randonner (avec gestion/authentification)
        const isCarteLibre = (viewName === 'carte');

        if (randoFiltersBar) {
          if (isCarteLibre) {
            randoFiltersBar.classList.add('hidden');
          } else {
            randoFiltersBar.classList.remove('hidden');
          }
        }

        if (randoNavTabs) {
          if (isCarteLibre) {
            // Afficher seulement un titre épuré "Cartes & Outils"
            randoNavTabs.classList.add('opacity-40', 'pointer-events-none');
          } else {
            randoNavTabs.classList.remove('opacity-40', 'pointer-events-none');
          }
        }

        if (quickGpxBtn) {
          quickGpxBtn.classList.toggle('hidden', !isCarteLibre);
        }

        const lockModal = document.getElementById('login-lock-modal');
        if (viewName === 'randonner') {
          const isAuthed = typeof window.AuthManager !== 'undefined' && window.AuthManager.isAuthenticated();
          if (!isAuthed && lockModal) {
            lockModal.classList.remove('hidden');
          }
        } else {
          if (lockModal) {
            lockModal.classList.add('hidden');
          }
        }

        // Rafraîchir Leaflet
        setTimeout(() => {
          if (window.MapManagerInstance && window.MapManagerInstance.map) {
            window.MapManagerInstance.map.invalidateSize();
            // Gérer un éventuel paramètre de lieu (ex: ?loc=tongariro)
            const locId = params.get('loc');
            if (locId && LOCATIONS[locId]) {
              this.applyLocation(LOCATIONS[locId]);
            }
          }
        }, 150);
      }
    }

    openLocationOnMap(locId) {
      const loc = LOCATIONS[locId];
      if (!loc) return;
      window.location.hash = `#carte?loc=${locId}`;
    }

    applyLocation(loc) {
      const mm = window.MapManagerInstance;
      if (!mm || !mm.map) return;

      mm.map.setView([loc.lat, loc.lng], loc.zoom);

      if (loc.layer && mm.baseLayers && mm.baseLayers[loc.layer]) {
        for (const [k, l] of Object.entries(mm.baseLayers)) {
          if (mm.map.hasLayer(l)) mm.map.removeLayer(l);
        }
        mm.map.addLayer(mm.baseLayers[loc.layer]);
      }

      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`🗺️ Navigation vers : ${loc.name}`, "info");
      }
    }

    /**
     * Charge et affiche un fichier GPX en accès libre sur la carte
     */
    async handleQuickGpxFile(file) {
      if (!file) return;
      try {
        const text = await file.text();
        if (window.GPXParser && window.MapManagerInstance) {
          const gpxData = GPXParser.parse(text);
          if (gpxData && gpxData.tracks && gpxData.tracks.length > 0) {
            // Affichage du tracé
            window.MapManagerInstance.displayStandaloneGpxTrack(gpxData);
            if (window.App && typeof window.App.showToast === 'function') {
              window.App.showToast(`✅ Tracé "${gpxData.name || file.name}" affiché sur la carte !`, "success");
            }
          } else {
            alert("Le fichier GPX ne semble pas contenir de tracé valide.");
          }
        }
      } catch (err) {
        console.error("Erreur lecture GPX:", err);
        alert("Erreur lors de la lecture du fichier GPX.");
      }
    }
  }

  window.PortalRouter = new PortalRouter();
})();
