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
      const onReady = () => {
        this.bindDomButtons();
        this.handleHashChange();
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
      } else {
        setTimeout(onReady, 50);
      }
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

    /* =========================================================================
     * RECHERCHE MONDE ENTIER (LIEUX, SOMMETS, ADRESSES)
     * ========================================================================= */
    initWorldSearch() {
      const box = document.getElementById('map-world-search-box');
      const input = document.getElementById('map-world-search-input');
      const results = document.getElementById('map-world-search-results');
      const clearBtn = document.getElementById('btn-clear-world-search');
      if (!input || !results) return;

      if (box && typeof L !== 'undefined' && L.DomEvent) {
        L.DomEvent.disableClickPropagation(box);
        L.DomEvent.disableScrollPropagation(box);
      }

      let debounceTimer = null;

      input.addEventListener('input', () => {
        const q = input.value.trim();
        if (clearBtn) clearBtn.classList.toggle('hidden', !q);
        if (debounceTimer) clearTimeout(debounceTimer);
        if (q.length < 2) {
          results.classList.add('hidden');
          results.innerHTML = '';
          return;
        }
        debounceTimer = setTimeout(() => this.searchWorldPlace(q), 300);
      });

      if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          input.value = '';
          clearBtn.classList.add('hidden');
          results.classList.add('hidden');
          results.innerHTML = '';
          input.focus();
        });
      }

      document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !results.contains(e.target)) {
          results.classList.add('hidden');
        }
      });

            input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const first = results.querySelector('.search-item');
          if (first && !results.classList.contains('hidden')) {
            first.click();
          } else {
            const q = input.value.trim();
            if (q.length >= 2) {
              if (debounceTimer) clearTimeout(debounceTimer);
              this.searchWorldPlace(q);
            }
          }
        }
      });
    }

    async searchWorldPlace(query) {
      const results = document.getElementById('map-world-search-results');
      if (!results) return;

      // 0. Recherche de GR (tous les GR, tracé réel OpenStreetMap)
      if (typeof GrManager !== 'undefined' && GrManager.isGrQuery(query)) {
        GrManager.renderResults(results, query, (it) => {
          const input = document.getElementById('map-world-search-input');
          if (input) input.value = `${it.ref}${it.name && it.name !== it.ref ? ' - ' + it.name : ''}`;
        });
        return;
      }

      results.innerHTML = '<div class="p-2.5 text-center text-slate-500 text-[11px]"><span class="inline-block animate-spin mr-1">⏳</span>Recherche mondiale en cours...</div>';
      results.classList.remove('hidden');

      let items = [];

      // 1. Essai Nominatim OSM
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`;
        const resp = await fetch(url, { headers: { 'Accept-Language': 'fr,en' } });
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data) && data.length > 0) {
            items = data.map(d => ({
              title: (d.display_name || '').split(',')[0],
              subtitle: d.display_name || '',
              lat: parseFloat(d.lat),
              lon: parseFloat(d.lon),
              bbox: d.boundingbox ? [
                [parseFloat(d.boundingbox[0]), parseFloat(d.boundingbox[2])],
                [parseFloat(d.boundingbox[1]), parseFloat(d.boundingbox[3])]
              ] : null
            }));
          }
        }
      } catch (err) {
        console.warn('Nominatim non disponible, tentative Photon fallback...', err);
      }

      // 2. Si aucun résultat ou erreur : fallback instantané Photon (Komoot OSM)
      if (items.length === 0) {
        try {
          const pUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=fr`;
          const pResp = await fetch(pUrl);
          if (pResp.ok) {
            const pData = await pResp.json();
            if (pData && Array.isArray(pData.features)) {
              items = pData.features.map(f => {
                const props = f.properties || {};
                const name = props.name || props.street || query;
                const details = [props.city, props.state, props.country].filter(Boolean).join(', ');
                const coords = f.geometry && f.geometry.coordinates; // [lon, lat]
                return {
                  title: name,
                  subtitle: details ? `${name}, ${details}` : name,
                  lat: coords ? coords[1] : 0,
                  lon: coords ? coords[0] : 0,
                  bbox: f.bbox ? [
                    [f.bbox[1], f.bbox[0]],
                    [f.bbox[3], f.bbox[2]]
                  ] : null
                };
              }).filter(it => it.lat && it.lon);
            }
          }
        } catch (err2) {
          console.warn('Photon fallback non disponible:', err2);
        }
      }

      if (items.length === 0) {
        results.innerHTML = '<div class="p-2.5 text-center text-slate-400 text-[11px]">Aucun lieu trouvé pour cette recherche</div>';
        return;
      }

      results.innerHTML = '';
      results.style.backgroundColor = '#ffffff';
      results.style.opacity = '1';
      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'search-item p-3 hover:bg-emerald-50 cursor-pointer transition flex items-start gap-2.5 border-b border-slate-200/90 last:border-b-0';
        div.style.backgroundColor = '#ffffff';
        div.style.opacity = '1';
        div.innerHTML = `
          <span class="text-emerald-600 mt-0.5 text-sm flex-shrink-0">📍</span>
          <div class="flex-1 min-w-0">
            <div class="font-extrabold text-slate-900 text-xs truncate">${item.title}</div>
            <div class="text-[11px] text-slate-600 truncate font-medium mt-0.5">${item.subtitle}</div>
          </div>
        `;
        div.addEventListener('click', () => {
          results.classList.add('hidden');
          const input = document.getElementById('map-world-search-input');
          if (input) input.value = item.title;
          if (window.MapManagerInstance && window.MapManagerInstance.map) {
            const map = window.MapManagerInstance.map;
            if (item.bbox) {
              map.fitBounds(item.bbox, { maxZoom: 15, padding: [30, 30] });
            } else {
              map.setView([item.lat, item.lon], 14);
            }
            if (window._worldSearchMarker) {
              map.removeLayer(window._worldSearchMarker);
            }
            window._worldSearchMarker = L.marker([item.lat, item.lon])
              .addTo(map)
              .bindPopup(`<b>${item.title}</b><br><span style="font-size:11px;color:#64748b;">${item.subtitle}</span>`)
              .openPopup();
          }
        });
        results.appendChild(div);
      });
    }

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

      // Recherche de lieu monde entier
      this.initWorldSearch();

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
    toggleGuideFiche(ficheId, buttonEl) {
      const el = document.getElementById(ficheId);
      if (!el) return;
      const isHidden = el.classList.contains('hidden');
      if (isHidden) {
        el.classList.remove('hidden');
        if (buttonEl) {
          const icon = buttonEl.querySelector('.guide-toggle-icon');
          if (icon) icon.textContent = 'Replier ▴';
        }
      } else {
        el.classList.add('hidden');
        if (buttonEl) {
          const icon = buttonEl.querySelector('.guide-toggle-icon');
          if (icon) icon.textContent = 'Déplier ▾';
        } else {
          const parentCard = el.closest('.rounded-3xl');
          if (parentCard) {
            const icon = parentCard.querySelector('.guide-toggle-icon');
            if (icon) icon.textContent = 'Déplier ▾';
          }
        }
      }
    }

    /**
     * Isole strictement la carte libre vs l'espace membre
     */
    applyFreeMapMode(isFree) {
      const logoFrame = document.getElementById('logo-frame');
      const maprandoBranding = document.getElementById('header-maprando-branding');
      const searchFilterBar = document.getElementById('search-filter-bar');
      const searchInstructionsBar = document.getElementById('search-instructions-bar');
      const dbSelectorBox = document.getElementById('header-db-selector')?.closest('div');
      const storageBadge = document.getElementById('storage-badge')?.closest('div');
      const userControls = document.querySelector('header .flex.items-center.gap-2.flex-wrap.justify-end');
      const tabButtons = document.querySelectorAll('.tab-btn');
      const quickGpxBtn = document.getElementById('btn-quick-gpx-viewer');
      const tableCol = document.getElementById('table-column');
      const mapCol = document.getElementById('map-column');
      const headerSubLocation = document.getElementById('header-sub-location');
      const ibpLegend = document.getElementById('map-ibp-legend');
      const searchBox = document.getElementById('map-world-search-box');
      const btnMapManual = document.getElementById('btn-map-manual');

      if (isFree) {
        // En mode libre : masquer Randonneurs Sanaryens et afficher Map & Rando by JLDApps
        if (logoFrame) logoFrame.classList.add('hidden');
        if (maprandoBranding) {
          maprandoBranding.classList.remove('hidden');
          maprandoBranding.classList.add('flex');
        }
        // Masquer complètement l'IBP index et le Mode d'emploi RandoFinder en mode Carte & Outils
        // Masquer complètement l'IBP index et le Mode d'emploi RandoFinder en mode Carte & Outils
        if (ibpLegend) {
          ibpLegend.classList.add('hidden');
          ibpLegend.style.setProperty('display', 'none', 'important');
        }
        if (btnMapManual) {
          btnMapManual.classList.add('hidden');
          btnMapManual.style.setProperty('display', 'none', 'important');
        }
        if (searchBox) {
          searchBox.classList.remove('hidden');
          searchBox.style.setProperty('display', 'flex', 'important');
        }

        // Masquer complètement les barres de filtres et d'instructions de randonnées
        if (searchFilterBar) searchFilterBar.classList.add('hidden');
        if (searchInstructionsBar) searchInstructionsBar.classList.add('hidden');
        // Masquer le panneau utilisateur club droit (Base, Stockage, Compte)
        if (userControls) userControls.classList.add('hidden');
        if (dbSelectorBox) dbSelectorBox.classList.add('hidden');
        if (storageBadge) storageBadge.classList.add('hidden');
        if (headerSubLocation) headerSubLocation.innerHTML = 'Outils Cartographiques &bull; IGN &amp; GPX';
        // Masquer les onglets adhérents (Trouver, Charger, Gérer)
        tabButtons.forEach(btn => btn.classList.add('hidden'));
        // Afficher le bouton charger GPX libre
        if (quickGpxBtn) quickGpxBtn.classList.remove('hidden');

        // Forcer la carte en pleine page (100% largeur / hauteur, cacher la colonne tableau)
        if (tableCol) tableCol.classList.add('hidden');
        if (mapCol) {
          mapCol.classList.remove('lg:w-1/2');
          mapCol.classList.add('w-full', 'h-full');
        }
        if (window.App && typeof window.App.setViewMode === 'function') {
          window.App.setViewMode('map');
        }

        // Retirer les marqueurs du club de la carte
        if (window.MapManagerInstance) {
          const mm = window.MapManagerInstance;
          if (mm.markersLayer && mm.map && mm.map.hasLayer(mm.markersLayer)) {
            mm.map.removeLayer(mm.markersLayer);
          }
          if (mm.currentHikePolyline && mm.map && mm.map.hasLayer(mm.currentHikePolyline)) {
            mm.map.removeLayer(mm.currentHikePolyline);
          }
          if (mm.map) {
            setTimeout(() => mm.map.invalidateSize(), 100);
          }
        }
      } else {
        // En mode adhérent : restaurer Randonneurs Sanaryens, l'IBP index et le mode d'emploi
        if (ibpLegend) {
          ibpLegend.classList.remove('hidden');
          ibpLegend.style.display = '';
        }
        if (btnMapManual) {
          btnMapManual.classList.remove('hidden');
          btnMapManual.style.display = '';
        }
        if (searchBox) {
          searchBox.classList.add('hidden');
          searchBox.style.setProperty('display', 'none', 'important');
        }

        // En mode adhérent : restaurer Randonneurs Sanaryens et masquer Map & Rando libre
        if (logoFrame) logoFrame.classList.remove('hidden');
        if (maprandoBranding) {
          maprandoBranding.classList.add('hidden');
          maprandoBranding.classList.remove('flex');
        }
        // Restaurer l'interface club complète
        if (searchFilterBar) searchFilterBar.classList.remove('hidden');
        if (searchInstructionsBar) searchInstructionsBar.classList.remove('hidden');
        if (userControls) userControls.classList.remove('hidden');
        if (dbSelectorBox) dbSelectorBox.classList.remove('hidden');
        if (storageBadge) storageBadge.classList.remove('hidden');
        if (headerSubLocation) headerSubLocation.innerHTML = 'Sanary-sur-Mer &bull; Var (83)';
        tabButtons.forEach(btn => btn.classList.remove('hidden'));
        if (quickGpxBtn) quickGpxBtn.classList.add('hidden');

        // Restaurer la vue (mixte par défaut pour le club)
        if (window.App && typeof window.App.setViewMode === 'function') {
          window.App.setViewMode(window.App.currentViewMode || 'mixte');
        }

        // Restaurer les marqueurs de randonnées sur la carte
        if (window.MapManagerInstance) {
          const mm = window.MapManagerInstance;
          if (mm.markersLayer && mm.map && !mm.map.hasLayer(mm.markersLayer)) {
            mm.map.addLayer(mm.markersLayer);
          }
          if (window.App && typeof window.App.filterHikes === 'function') {
            window.App.filterHikes();
          }
          if (mm.map) {
            setTimeout(() => mm.map.invalidateSize(), 100);
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
