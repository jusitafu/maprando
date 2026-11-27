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

    locateUserOnWorldMap() {
      if (!navigator.geolocation) {
        if (typeof window.App?.showToast === 'function') {
          window.App.showToast("La géolocalisation n'est pas supportée par votre navigateur", "error");
        }
        return;
      }

      const btn = document.getElementById('btn-map-world-geoloc');
      if (btn) btn.classList.add('animate-pulse');

      if (typeof window.App?.showToast === 'function') {
        window.App.showToast("Recherche de votre position GPS...", "info");
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (btn) btn.classList.remove('animate-pulse');
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const accuracy = Math.round(pos.coords.accuracy || 20);

          let placeName = 'Ma position GPS';
          let lidarAlt = null;
          let lidarSource = 'LiDAR IGN';

          const fetchLidarAlt = async () => {
            try {
              const ignUrl = `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=${lon.toFixed(6)}&lat=${lat.toFixed(6)}&resource=ign_rge_alti_wld&zonly=true`;
              const resp = await fetch(ignUrl, { headers: { 'Accept': 'application/json' } });
              if (resp.ok) {
                const data = await resp.json();
                const z = data?.elevations?.[0];
                if (typeof z === 'number' && !isNaN(z) && z > -500 && z !== -99999) {
                  lidarAlt = Math.round(z);
                  lidarSource = 'IGN RGE ALTI';
                  return;
                }
              }
            } catch (e) {}
            // Fallback mondial Open-Meteo si hors France ou coupure IGN
            try {
              const omResp = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(6)}&longitude=${lon.toFixed(6)}`);
              if (omResp.ok) {
                const omData = await omResp.json();
                const z = omData?.elevation?.[0];
                if (typeof z === 'number' && !isNaN(z)) {
                  lidarAlt = Math.round(z);
                  lidarSource = 'MNT';
                }
              }
            } catch (e) {}
          };

          await Promise.all([
            (async () => {
              try {
                if (typeof GPXParser !== 'undefined' && GPXParser.reverseGeocode) {
                  placeName = await GPXParser.reverseGeocode(lat, lon);
                }
              } catch (e) {
                console.warn('Reverse geocode error:', e);
              }
            })(),
            fetchLidarAlt()
          ]);

          const input = document.getElementById('map-world-search-input');
          if (input) input.value = placeName || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
          const clearBtn = document.getElementById('btn-clear-world-search');
          if (clearBtn) clearBtn.classList.remove('hidden');

          if (window.MapManagerInstance && window.MapManagerInstance.map) {
            const map = window.MapManagerInstance.map;
            map.setView([lat, lon], 16, { animate: true });

            if (window._worldSearchMarker) {
              map.removeLayer(window._worldSearchMarker);
            }
            if (window._worldSearchCircle) {
              map.removeLayer(window._worldSearchCircle);
            }

            window._worldSearchCircle = L.circle([lat, lon], {
              radius: Math.max(20, accuracy),
              color: '#10b981',
              fillColor: '#10b981',
              fillOpacity: 0.15,
              weight: 2
            }).addTo(map);

            const userIcon = L.divIcon({
              className: 'custom-world-user-marker',
              html: `
                <div style="position:relative; width:30px; height:30px; display:flex; align-items:center; justify-content:center;">
                  <span style="position:absolute; width:30px; height:30px; border-radius:9999px; background:rgba(16,185,129,0.35); animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
                  <span style="position:relative; width:18px; height:18px; border-radius:9999px; background:#10b981; border:3px solid #ffffff; box-shadow:0 3px 10px rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; color:white; font-size:10px;">📍</span>
                </div>
              `,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
              popupAnchor: [0, -15]
            });

            const safePlace = (placeName || 'Ma position GPS').replace(/'/g, "\\'");
            const altLineHtml = (lidarAlt !== null)
              ? `<div style="font-size:10.5px; color:#64748b; font-family:monospace; margin-bottom:6px;">Altitude : ${lidarAlt} m (${lidarSource})</div>`
              : '';
            window._worldSearchMarker = L.marker([lat, lon], { icon: userIcon, zIndexOffset: 2000 })
              .addTo(map)
              .bindPopup(`
                <div style="min-width:205px; font-family:sans-serif; padding:4px;">
                  <div style="font-weight:900; font-size:13px; color:#065f46; display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                    <span>📍</span> <span>Ma position GPS</span>
                  </div>
                  <div style="font-weight:700; font-size:12px; color:#1e293b; margin-bottom:4px;">${placeName}</div>
                  <div style="font-size:10.5px; color:#64748b; font-family:monospace; margin-bottom:3px;">${lat.toFixed(5)}, ${lon.toFixed(5)} &bull; Précision : ~${accuracy} m</div>
                  ${altLineHtml}
                  <button type="button" style="padding:4px 8px; border-radius:6px; background:#f1f5f9; border:1px solid #cbd5e1; font-size:10.5px; font-weight:700; color:#334155; cursor:pointer;" onclick="window.MapManagerInstance ? window.MapManagerInstance.copyGpsCoords(${lat.toFixed(5)}, ${lon.toFixed(5)}, this) : null">
                    📋 Copier GPS
                  </button>
                </div>
              `)
              .openPopup();
          }

          if (typeof window.App?.showToast === 'function') {
            window.App.showToast(`📍 Position trouvée : ${placeName}`, "success");
          }
        },
        (err) => {
          if (btn) btn.classList.remove('animate-pulse');
          console.warn("Erreur géolocalisation GPS :", err);
          if (typeof window.App?.showToast === 'function') {
            window.App.showToast("Impossible d'accéder à votre position GPS.", "error");
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    }

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
          if (typeof window.clearWorldSearchAndWaterway === 'function') {
            window.clearWorldSearchAndWaterway();
          }
          input.focus();
        });
      }

      const worldGeolocBtn = document.getElementById('btn-map-world-geoloc');
      if (worldGeolocBtn) {
        worldGeolocBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.locateUserOnWorldMap();
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
          const clearBtn = document.getElementById('btn-clear-world-search');
          if (clearBtn) clearBtn.classList.remove('hidden');
        });
        return;
      }

      results.innerHTML = '<div class="p-2.5 text-center text-slate-500 text-[11px]"><span class="inline-block animate-spin mr-1">⏳</span>Recherche mondiale en cours...</div>';
      results.classList.remove('hidden');

      // Recherche parallèle des sentiers réputés par nom (ex: Via Francigena, West Highland Way, Stevenson, TMB...)
      let namedTrailsPromise = Promise.resolve([]);
      if (typeof GrManager !== 'undefined' && GrManager.searchNamedTrails && query.trim().length >= 3) {
        namedTrailsPromise = GrManager.searchNamedTrails(query).catch(() => []);
      }

      // Recherche parallèle des cours d'eau (IGN Hydrographie + OSM Waterway)
      let waterwaysPromise = Promise.resolve([]);
      if (typeof window.searchWaterways === 'function' && query.trim().length >= 3) {
        waterwaysPromise = window.searchWaterways(query).catch(() => []);
      }

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

      const [namedTrails, waterways] = await Promise.all([namedTrailsPromise, waterwaysPromise]);

      // Intégrer les cours d'eau (avec déduplication simple)
      if (waterways && waterways.length > 0) {
        const merged = [];
        waterways.forEach(w => merged.push(w));
        items.forEach(it => {
          const dup = waterways.some(w => Math.abs(w.lat - it.lat) < 0.02 && Math.abs(w.lon - it.lon) < 0.02 && it.title.toLowerCase().includes(w.rawName.toLowerCase()));
          if (!dup) merged.push(it);
        });
        items = merged;
      }

      if (items.length === 0 && (!namedTrails || namedTrails.length === 0)) {
        results.innerHTML = '<div class="p-2.5 text-center text-slate-400 text-[11px]">Aucun lieu, cours d\'eau ou sentier trouvé pour cette recherche</div>';
        return;
      }

      results.innerHTML = '';
      results.style.backgroundColor = '#ffffff';
      results.style.opacity = '1';

      if (namedTrails && namedTrails.length > 0 && typeof GrManager !== 'undefined') {
        GrManager.appendTrailItemsToContainer(results, namedTrails, (it) => {
          const input = document.getElementById('map-world-search-input');
          if (input) input.value = `${it.ref ? it.ref + ' - ' : ''}${it.name || ''}`;
          const clearBtn = document.getElementById('btn-clear-world-search');
          if (clearBtn) clearBtn.classList.remove('hidden');
        });
      }
      items.forEach(item => {
        const div = document.createElement('div');
        div.className = item.isWaterway
          ? 'search-item p-3 hover:bg-sky-50 cursor-pointer transition flex items-start gap-2.5 border-b border-slate-200/90 last:border-b-0'
          : 'search-item p-3 hover:bg-emerald-50 cursor-pointer transition flex items-start gap-2.5 border-b border-slate-200/90 last:border-b-0';
        div.style.backgroundColor = '#ffffff';
        div.style.opacity = '1';
        const iconHtml = item.isWaterway
          ? '<span class="text-sky-600 mt-0.5 text-sm flex-shrink-0">🌊</span>'
          : '<span class="text-emerald-600 mt-0.5 text-sm flex-shrink-0">📍</span>';
        const badgeHtml = item.waterType
          ? `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-bold">${item.waterType}</span>`
          : '';
        div.innerHTML = `
          ${iconHtml}
          <div class="flex-1 min-w-0">
            <div class="font-extrabold text-slate-900 text-xs truncate flex items-center">${item.rawName || item.title}${badgeHtml}</div>
            <div class="text-[11px] text-slate-600 truncate font-medium mt-0.5">${item.subtitle}</div>
          </div>
        `;
        div.addEventListener('click', () => {
          results.classList.add('hidden');
          const input = document.getElementById('map-world-search-input');
          if (input) input.value = item.title;
          const clearBtn = document.getElementById('btn-clear-world-search');
          if (clearBtn) clearBtn.classList.remove('hidden');
          if (window.MapManagerInstance && window.MapManagerInstance.map) {
            const map = window.MapManagerInstance.map;
            if (item.isWaterway && typeof WaterwayManager !== 'undefined') {
              WaterwayManager.displayWaterway(item, map);
              return;
            }
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
      this.initMusicPlayer();
      const btnOpenCgu = document.getElementById('btn-open-cgu');
      const modalCgu = document.getElementById('modal-cgu');
      if (btnOpenCgu && modalCgu) {
        btnOpenCgu.addEventListener('click', (e) => {
          e.preventDefault();
          modalCgu.classList.remove('hidden');
        });
      }

      // Modale Autres applications JLDApps (WaterMetrics & FuelCoPilot)
      const modalJldapps = document.getElementById('modal-jldapps');
      document.querySelectorAll('.btn-open-jldapps-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (modalJldapps) modalJldapps.classList.remove('hidden');
        });
      });
      if (modalJldapps) {
        modalJldapps.addEventListener('click', (e) => {
          if (e.target === modalJldapps) {
            modalJldapps.classList.add('hidden');
          }
        });
      }

      // Modale Mode d'emploi détaillé (à gauche de CGU)
      const btnOpenModeEmploi = document.getElementById('btn-open-mode-emploi');
      const modalModeEmploi = document.getElementById('modal-mode-emploi');
      if (btnOpenModeEmploi && modalModeEmploi) {
        btnOpenModeEmploi.addEventListener('click', (e) => {
          e.preventDefault();
          modalModeEmploi.classList.remove('hidden');
        });
      }
      document.querySelectorAll('[data-open-mode-emploi]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          if (modalModeEmploi) modalModeEmploi.classList.remove('hidden');
        });
      });

      // Recherche de lieu monde entier
      this.initWorldSearch();

      // Visualiseur GPX libre (accès libre sans compte : Glisser-Déposer + Chargement classique)
      const inputGpxViewer = document.getElementById('input-quick-gpx-viewer');
      const btnQuickGpx = document.getElementById('btn-quick-gpx-viewer');
      if (btnQuickGpx && inputGpxViewer) {
        btnQuickGpx.addEventListener('click', () => this.openQuickGpxModal());
        inputGpxViewer.addEventListener('change', (e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length > 0) {
            this.closeQuickGpxModal();
            files.slice(0, 3).forEach(f => this.handleQuickGpxFile(f));
            e.target.value = '';
          }
        });

        // Glisser-déposer direct sur le bouton orange "Charger une trace GPX"
        btnQuickGpx.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.stopPropagation();
          btnQuickGpx.classList.add('ring-4', 'ring-amber-300', 'scale-105');
        });
        btnQuickGpx.addEventListener('dragleave', (e) => {
          e.preventDefault();
          e.stopPropagation();
          btnQuickGpx.classList.remove('ring-4', 'ring-amber-300', 'scale-105');
        });
        btnQuickGpx.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          btnQuickGpx.classList.remove('ring-4', 'ring-amber-300', 'scale-105');
          const files = e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
          files.slice(0, 3).forEach(f => this.handleQuickGpxFile(f));
        });
      }

      // Initialisation du Créateur & Éditeur interactif GPX
      if (window.GpxCreatorEditorInstance && window.MapManagerInstance) {
        window.GpxCreatorEditorInstance.init(window.MapManagerInstance);
      }

      // Glisser-déposer direct sur la carte (#map-column)
      this.initMapDragAndDropGpx();
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
      const modalJldapps = document.getElementById('modal-jldapps');
      if (modalJldapps) modalJldapps.classList.add('hidden');

      if (viewName !== 'accueil') { this.pauseMusic(); }

      // Reset complet et strict de toute trace résiduelle lors du retour à l'accueil, aux guides ou au module randonner
      if (viewName === 'accueil' || viewName === 'guides' || viewName === 'randonner') {
        try {
          if (window.MapManagerInstance) {
            window.MapManagerInstance.clearStandaloneGpxTrack();
            window.MapManagerInstance.resetAllMapTools();
            if (viewName !== 'randonner' || !params.get('hike')) {
              window.MapManagerInstance.deselectHike();
            }
          }
          if (window.App && (viewName !== 'randonner' || !params.get('hike'))) {
            window.App.deselectHike();
          }
        } catch (err) {
          console.warn("Erreur reset switchView:", err);
        }
      }

      if (viewName === 'accueil') {
        const portalActions = document.getElementById('portal-header-actions');
        if (portalActions) portalActions.classList.remove('hidden');
        if (viewPortal) viewPortal.classList.remove('hidden');
        if (window.ScrollElevatorInstance) window.ScrollElevatorInstance.checkAndShowMobileWarning();
        if (lockModal) lockModal.classList.add('hidden');
        this.hideStandaloneGpxHud();
        if (typeof GrManager !== 'undefined') GrManager.removeGrBanner();

        // ÉTANCHÉITÉ STRICTE : Fermer toutes les fenêtres modales et réinitialiser l'onglet sur explorer
        const modalsToClose = [
          'modal-cgu', 'modal-jldapps', 'modal-mode-emploi',
          'screen-calib-modal', 'map-area-export-modal', 'map-legend-modal'
        ];
        modalsToClose.forEach(id => {
          const m = document.getElementById(id);
          if (m) m.classList.add('hidden');
        });
        if (window.App) window.App.currentTab = 'explorer';
        document.querySelectorAll('.tab-content').forEach(tc => {
          if (tc.id === 'tab-content-explorer') tc.classList.remove('hidden');
          else tc.classList.add('hidden');
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });

      } else if (viewName === 'guides') {
        if (viewGuides) viewGuides.classList.remove('hidden');
        if (lockModal) lockModal.classList.add('hidden');
        this.hideStandaloneGpxHud();
        if (typeof GrManager !== 'undefined') GrManager.removeGrBanner();
        window.scrollTo({ top: 0, behavior: 'smooth' });

      } else if (viewName === 'carte') {
        // =====================================================================
        // MODE CARTE SEULE EN ACCÈS LIBRE (AUCUN ACCÈS AUX TRACES DU FONDS CLUB)
        // =====================================================================
        if (viewMapContainer) viewMapContainer.classList.remove('hidden');
        if (lockModal) lockModal.classList.add('hidden');

        // ÉTANCHÉITÉ STRICTE : La carte Carte & Outils doit afficher exclusivement la carte (#tab-content-explorer)
        // et masquer rigoureusement tout écran d'options, chargement ou gestion adhérents
        document.querySelectorAll('.tab-content').forEach(tc => {
          if (tc.id === 'tab-content-explorer') {
            tc.classList.remove('hidden');
          } else {
            tc.classList.add('hidden');
          }
        });
        if (window.App) window.App.currentTab = 'explorer';

        // Réinitialiser systématiquement les outils temporaires (caps, mesures, zone d'impression)
        try {
          if (window.MapManagerInstance) {
            window.MapManagerInstance.resetAllMapTools();
          }
        } catch (err) {
          console.warn("Erreur resetAllMapTools carte:", err);
        }

        this.applyFreeMapMode(true);

        // Rafraîchir Leaflet et garantir une netteté topographique optimale
        setTimeout(() => {
          if (window.MapManagerInstance && window.MapManagerInstance.map) {
            const map = window.MapManagerInstance.map;
            map.invalidateSize();
            // Si aucune trace standalone n'est chargée, centrer sur une vue topographique idéale au 1:25 000
            if (!window.MapManagerInstance.standaloneTracks || window.MapManagerInstance.standaloneTracks.length === 0) {
              map.setView([43.125, 5.800], 13.5);
            }
          }
        }, 150);

      } else if (viewName === 'randonner') {
        // =====================================================================
        // MODE RANDONNER (PROTÉGÉ PAR MOT DE PASSE : RECHERCHE & GESTION)
        // =====================================================================
        if (viewMapContainer) viewMapContainer.classList.remove('hidden');
        this.hideStandaloneGpxHud();

        // ÉTANCHÉITÉ STRICTE : Réinitialiser proprement sur l'explorateur (carte + rando)
        if (window.App) window.App.currentTab = 'explorer';
        document.querySelectorAll('.tab-content').forEach(tc => {
          if (tc.id === 'tab-content-explorer') {
            tc.classList.remove('hidden');
          } else {
            tc.classList.add('hidden');
          }
        });
        document.querySelectorAll('[data-tab]').forEach(btn => {
          const isExp = btn.getAttribute('data-tab') === 'explorer';
          btn.classList.toggle('bg-emerald-700', isExp);
          btn.classList.toggle('text-white', isExp);
          btn.classList.toggle('shadow-sm', isExp);
          btn.classList.toggle('text-slate-300', !isExp);
          btn.classList.toggle('hover:bg-slate-800', !isExp);
        });

        const isAuthed = typeof window.AuthManager !== 'undefined' && window.AuthManager.isAuthenticated();
        this.applyFreeMapMode(false);
        if (!isAuthed) {
          if (lockModal) lockModal.classList.remove('hidden');
        } else {
          if (lockModal) lockModal.classList.add('hidden');
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
        if (ficheId === 'fiche-top25-catalog-content') {
          // Déplacer directement sous <body> pour échapper à tout transform/overflow-hidden (vrai pleine page 100vw x 100vh)
          if (!this._top25OrigParent && el.parentElement && el.parentElement !== document.body) {
            this._top25OrigParent = el.parentElement;
          }
          if (el.parentElement !== document.body) {
            document.body.appendChild(el);
          }
          el.classList.remove('hidden');
          el.style.display = 'flex';
          document.body.style.overflow = 'hidden';
          this.renderTop25CatalogTable();
          if (!this._top25EscHandler) {
            this._top25EscHandler = (ev) => {
              if (ev.key === 'Escape') {
                const panel = document.getElementById('fiche-top25-catalog-content');
                if (panel && !panel.classList.contains('hidden')) {
                  this.toggleGuideFiche('fiche-top25-catalog-content');
                }
              }
            };
            document.addEventListener('keydown', this._top25EscHandler);
          }
        } else {
          el.classList.remove('hidden');
        }
        if (buttonEl) {
          const icon = buttonEl.querySelector('.guide-toggle-icon');
          if (icon) icon.textContent = 'Replier ▴';
        }
      } else {
        el.classList.add('hidden');
        if (ficheId === 'fiche-top25-catalog-content') {
          el.style.display = 'none';
          document.body.style.overflow = '';
          if (this._top25OrigParent && el.parentElement === document.body) {
            this._top25OrigParent.appendChild(el);
          }
          if (this._top25EscHandler) {
            document.removeEventListener('keydown', this._top25EscHandler);
            this._top25EscHandler = null;
          }
        }
        if (buttonEl) {
          const icon = buttonEl.querySelector('.guide-toggle-icon');
          if (icon) icon.textContent = 'Déplier ▾';
        } else {
          const parentCard = (ficheId === 'fiche-top25-catalog-content' && this._top25OrigParent)
            ? this._top25OrigParent
            : el.closest('.rounded-3xl');
          if (parentCard) {
            const icon = parentCard.querySelector('.guide-toggle-icon');
            if (icon) icon.textContent = 'Déplier ▾';
          }
        }
      }
      if (window.ScrollElevatorInstance) {
        window.ScrollElevatorInstance.fitMenuToFullPage();
        window.ScrollElevatorInstance.refresh();
      }
    }

    /* =========================================================================
     * CATALOGUE DES CARTES IGN TOP 25 FRANCE & CALANQUES (RUBRIQUE SAVOIRS)
     * ========================================================================= */
    getTop25CatalogItems() {
      if (this._top25CatalogCache) return this._top25CatalogCache;

      const norm = (str) => String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      const items = [];

      // Entrée dédiée : Carte spéciale IGN 89035 – Parc National des Calanques (1:15 000)
      items.push({
        id: 'calanques_89035',
        r: '89035',
        a: 'Spéciale 1:15 000',
        aNum: 9999,
        t: 'LES CALANQUES — Traversée des Calanques (Marseille – Cassis – La Ciotat)',
        b: [43.175, 5.335, 43.275, 5.625],
        series: 'calanques',
        isCalanques: true,
        _search: norm('89035 calanques traversee des calanques marseille cassis la ciotat parc national speciale 1:15000 1:15 000')
      });

      const rawSheets = Array.isArray(window.IGN_TOP25_SHEETS) ? window.IGN_TOP25_SHEETS : [];
      for (const s of rawSheets) {
        if (!s || !s.r || !s.t || !Array.isArray(s.b) || s.b.length < 4) continue;
        const ref = String(s.r).trim();
        if (ref.startsWith('-')) continue;
        // France métropolitaine uniquement (lat 41..51.5, lon -6..10.5)
        const latS = Number(s.b[0]);
        const lonW = Number(s.b[1]);
        if (latS < 41 || latS > 51.5 || lonW < -6 || lonW > 10.5) continue;

        const title = String(s.t).trim();
        const yearNum = Number(s.a) || 0;
        const yearStr = yearNum ? String(yearNum) : '—';
        const isSb = /\bSB$/i.test(ref);
        items.push({
          id: s.n || (ref + '_' + title),
          r: ref,
          a: yearStr,
          aNum: yearNum,
          t: title,
          b: s.b,
          series: isSb ? 'sb' : 'top25',
          isCalanques: false,
          _search: norm(`${ref} ${yearStr} ${title} ${isSb ? 'serie bleue' : 'top 25 top25'}`)
        });
      }

      this._top25CatalogCache = items;
      return items;
    }

    setTop25CatalogFilter(filter) {
      this._top25Filter = filter || 'all';
      this._top25ShowAll = false;
      document.querySelectorAll('.top25-filter-btn').forEach((btn) => {
        const isActive = btn.dataset.top25Filter === this._top25Filter;
        if (isActive) {
          btn.className = 'top25-filter-btn px-3.5 py-1.5 rounded-full bg-cyan-600 text-white border border-cyan-400 cursor-pointer transition';
        } else if (btn.dataset.top25Filter === 'calanques') {
          btn.className = 'top25-filter-btn px-3.5 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/40 cursor-pointer transition';
        } else {
          btn.className = 'top25-filter-btn px-3.5 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition';
        }
      });
      this.renderTop25CatalogTable();
    }

    sortTop25Catalog(col) {
      if (this._top25SortCol === col) {
        this._top25SortDir = this._top25SortDir === 'asc' ? 'desc' : 'asc';
      } else {
        this._top25SortCol = col;
        this._top25SortDir = col === 'a' ? 'desc' : 'asc';
      }
      ['r', 'a', 't'].forEach((k) => {
        const el = document.getElementById(`top25-sort-${k}`);
        if (!el) return;
        if (k === this._top25SortCol) {
          el.textContent = this._top25SortDir === 'asc' ? '▲' : '▼';
          el.className = 'text-cyan-400';
        } else {
          el.textContent = '↕';
          el.className = 'text-slate-500';
        }
      });
      this.renderTop25CatalogTable();
    }

    showAllTop25CatalogRows() {
      this._top25ShowAll = true;
      this.renderTop25CatalogTable();
    }

    renderTop25CatalogTable(queryOverride) {
      const tbody = document.getElementById('top25-catalog-tbody');
      const countEl = document.getElementById('top25-catalog-count');
      const inputEl = document.getElementById('top25-catalog-search');
      const clearBtn = document.getElementById('top25-catalog-clear');
      const moreWrap = document.getElementById('top25-catalog-more-wrap');
      if (!tbody) return;

      const rawQuery = (typeof queryOverride === 'string')
        ? queryOverride
        : (inputEl ? inputEl.value : '');

      if (typeof queryOverride === 'string') {
        this._top25ShowAll = false;
      }

      if (clearBtn) {
        clearBtn.classList.toggle('hidden', !rawQuery.trim());
      }

      const normQuery = rawQuery
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
      const tokens = normQuery ? normQuery.split(/\s+/).filter(Boolean) : [];

      const activeFilter = this._top25Filter || 'all';
      const sortCol = this._top25SortCol || 'r';
      const sortDir = this._top25SortDir || 'asc';

      const allItems = this.getTop25CatalogItems();
      const filtered = allItems.filter((it) => {
        if (activeFilter !== 'all' && it.series !== activeFilter) return false;
        if (tokens.length > 0) {
          for (const tk of tokens) {
            if (!it._search.includes(tk)) return false;
          }
        }
        return true;
      });

      // Tri (en conservant la Carte spéciale des Calanques en tête lors du tri par défaut)
      filtered.sort((a, b) => {
        if (sortCol === 'r' && sortDir === 'asc') {
          if (a.isCalanques && !b.isCalanques) return -1;
          if (!a.isCalanques && b.isCalanques) return 1;
        }
        let cmp = 0;
        if (sortCol === 'a') {
          cmp = (a.aNum - b.aNum) || a.r.localeCompare(b.r, 'fr');
        } else if (sortCol === 't') {
          cmp = a.t.localeCompare(b.t, 'fr');
        } else {
          cmp = a.r.localeCompare(b.r, 'fr') || a.t.localeCompare(b.t, 'fr');
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });

      this._top25FilteredList = filtered;

      if (countEl) {
        const totalFmt = filtered.length.toLocaleString('fr-FR');
        countEl.textContent = filtered.length <= 1
          ? `${totalFmt} carte affichée`
          : `${totalFmt} cartes affichées`;
      }

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" class="p-6 text-center text-slate-400">
              Aucune carte trouvée pour « <span class="text-white font-bold">${rawQuery.replace(/</g, '&lt;')}</span> ».
            </td>
          </tr>`;
        if (moreWrap) moreWrap.classList.add('hidden');
        return;
      }

      const limit = this._top25ShowAll ? filtered.length : Math.min(filtered.length, 250);
      const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const rows = [];

      for (let i = 0; i < limit; i++) {
        const it = filtered[i];
        if (it.isCalanques) {
          rows.push(`
            <tr class="bg-rose-950/40 hover:bg-rose-900/45 transition">
              <td class="px-4 sm:px-6 py-3 whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600/30 border border-rose-400/50 text-rose-200 font-mono text-sm sm:text-[15px] font-extrabold">🏖️ ${esc(it.r)}</span>
              </td>
              <td class="px-4 sm:px-6 py-3 whitespace-nowrap">
                <span class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-200 font-bold text-xs sm:text-sm">${esc(it.a)}</span>
              </td>
              <td class="px-4 sm:px-6 py-3 text-sm sm:text-base font-bold text-rose-100 leading-snug">${esc(it.t)}</td>
              <td class="px-4 sm:px-6 py-3 text-right whitespace-nowrap">
                <button type="button" onclick="window.PortalRouterInstance && window.PortalRouterInstance.openTop25SheetOnMap(${i})"
                        class="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer"
                        title="Ouvrir la carte spéciale IGN 89035 des Calanques">
                  🗺️ Voir sur la carte
                </button>
              </td>
            </tr>`);
        } else {
          const badgeClass = it.series === 'top25'
            ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200'
            : 'bg-slate-800 border-slate-700 text-slate-200';
          rows.push(`
            <tr class="hover:bg-slate-800/50 transition">
              <td class="px-4 sm:px-6 py-3 whitespace-nowrap">
                <span class="inline-block px-2.5 py-1 rounded-lg border font-mono text-sm sm:text-[15px] font-bold ${badgeClass}">${esc(it.r)}</span>
              </td>
              <td class="px-4 sm:px-6 py-3 whitespace-nowrap text-slate-300 font-mono text-sm sm:text-[15px]">${esc(it.a)}</td>
              <td class="px-4 sm:px-6 py-3 text-white text-sm sm:text-base font-semibold leading-snug">${esc(it.t)}</td>
              <td class="px-4 sm:px-6 py-3 text-right whitespace-nowrap">
                <button type="button" onclick="window.PortalRouterInstance && window.PortalRouterInstance.openTop25SheetOnMap(${i})"
                        class="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 font-bold text-xs sm:text-sm transition cursor-pointer"
                        title="Centrer la carte IGN TOP 25 sur cette feuille">
                  🗺️ Voir sur la carte
                </button>
              </td>
            </tr>`);
        }
      }

      tbody.innerHTML = rows.join('');

      if (moreWrap) {
        if (filtered.length > limit) {
          moreWrap.classList.remove('hidden');
          const btn = moreWrap.querySelector('button');
          if (btn) {
            btn.textContent = `Afficher toutes les ${(filtered.length).toLocaleString('fr-FR')} cartes correspondantes (+${(filtered.length - limit).toLocaleString('fr-FR')})`;
          }
        } else {
          moreWrap.classList.add('hidden');
        }
      }
    }

    openTop25SheetOnMap(idx) {
      const list = this._top25FilteredList || [];
      const item = list[idx];
      if (!item) return;

      // Refermer proprement la vue pleine page du catalogue avant d'aller sur la carte
      const panel = document.getElementById('fiche-top25-catalog-content');
      if (panel && !panel.classList.contains('hidden')) {
        this.toggleGuideFiche('fiche-top25-catalog-content');
      }

      this.navigateTo('carte');

      const focusSheet = () => {
        const mm = window.MapManagerInstance;
        if (!mm || !mm.map) return;

        if (item.isCalanques && typeof mm.activateCalanquesMode === 'function') {
          mm.activateCalanquesMode();
        } else {
          if (mm.currentBaseLayer !== 'igntop25' && typeof mm.setBaseLayer === 'function') {
            mm.setBaseLayer('igntop25');
          }
          if (mm.paperSheetLayer && !mm.map.hasLayer(mm.paperSheetLayer)) {
            mm.paperSheetLayer.addTo(mm.map);
          }
          if (Array.isArray(item.b) && item.b.length >= 4) {
            mm.map.fitBounds([[item.b[0], item.b[1]], [item.b[2], item.b[3]]], { padding: [25, 25], animate: true });
          }
          if (typeof mm.renderPaperSheetBounds === 'function') {
            setTimeout(() => mm.renderPaperSheetBounds(), 350);
          }
        }

        if (typeof window.App?.showToast === 'function') {
          window.App.showToast(`🗺️ Carte IGN ${item.r} — ${item.t}`, 'success');
        }
      };

      setTimeout(focusSheet, 250);
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
      const userControls = document.querySelector('#main-map-app-container header .flex.items-center.gap-2.flex-wrap.justify-end');
      const tabButtons = document.querySelectorAll('.tab-btn');
      const quickGpxBtn = document.getElementById('btn-quick-gpx-viewer');
      const createGpxBtn = document.getElementById('btn-create-gpx');
      const editGpxBtn = document.getElementById('btn-edit-gpx');
      const tableCol = document.getElementById('table-column');
      const mapCol = document.getElementById('map-column');
      const headerSubLocation = document.getElementById('header-sub-location');
      const ibpLegend = document.getElementById('map-ibp-legend');
      const searchBox = document.getElementById('map-world-search-box');
      const btnMapManual = document.getElementById('btn-map-manual');
      const outdoorGearBar = document.getElementById('outdoor-gear-header-bar');

      // Dans le module Carte & Outils : masquer strictement le bouton de téléchargement
      const previewDlBtn = document.getElementById('preview-btn-download');
      if (previewDlBtn) {
        if (isFree) {
          previewDlBtn.classList.add('hidden');
          previewDlBtn.style.setProperty('display', 'none', 'important');
        } else {
          previewDlBtn.classList.remove('hidden');
          previewDlBtn.style.removeProperty('display');
        }
      }

      if (isFree) {
        // Supprimer la boîte "Sélection Rando" dans le module Cartes & Outils
        if (outdoorGearBar) {
          outdoorGearBar.classList.add('hidden');
          outdoorGearBar.style.setProperty('display', 'none', 'important');
        }
        // En mode libre : masquer Randonneurs Sanaryens et afficher Map & Rando by JLDApps
        if (logoFrame) logoFrame.classList.add('hidden');
        if (maprandoBranding) {
          maprandoBranding.classList.remove('hidden');
          maprandoBranding.classList.add('flex');
        }
        const centerPillText = document.getElementById('header-center-pill-text');
        if (centerPillText) {
          centerPillText.textContent = "Outils Cartographiques & GPX";
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
        tabButtons.forEach(btn => {
          btn.classList.add('hidden');
          btn.style.setProperty('display', 'none', 'important');
        });
        // Afficher les boutons GPX libre (Charger 1-3 traces, Créer, Modifier)
        if (quickGpxBtn) quickGpxBtn.classList.remove('hidden');
        if (createGpxBtn) createGpxBtn.classList.remove('hidden');
        if (editGpxBtn) editGpxBtn.classList.remove('hidden');

        // ÉTANCHÉITÉ STRICTE : Forcer l'affichage exclusif de l'onglet carte
        document.querySelectorAll('.tab-content').forEach(tc => {
          if (tc.id === 'tab-content-explorer') {
            tc.classList.remove('hidden');
          } else {
            tc.classList.add('hidden');
          }
        });

        // Forcer la carte en pleine page (100% largeur / hauteur, cacher la colonne tableau)
        if (tableCol) {
          tableCol.classList.add('hidden');
          tableCol.style.setProperty('display', 'none', 'important');
        }
        if (mapCol) {
          mapCol.classList.remove('lg:w-1/2');
          mapCol.classList.add('w-full', 'h-full');
          mapCol.style.setProperty('width', '100%', 'important');
          mapCol.style.setProperty('height', '100%', 'important');
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
          if (mm.searchCircle && mm.map && mm.map.hasLayer(mm.searchCircle)) {
            mm.map.removeLayer(mm.searchCircle);
          }
          if (mm.searchOriginMarker && mm.map && mm.map.hasLayer(mm.searchOriginMarker)) {
            mm.map.removeLayer(mm.searchOriginMarker);
          }
          if (mm.currentHikePolyline && mm.map && mm.map.hasLayer(mm.currentHikePolyline)) {
            mm.map.removeLayer(mm.currentHikePolyline);
          }
          if (mm.map) {
            setTimeout(() => mm.map.invalidateSize(), 100);
          }
        }
      } else {
        // En mode Randonner : restaurer la barre Sélection Rando, Randonneurs Sanaryens, l'IBP index et le mode d'emploi
        if (outdoorGearBar) {
          outdoorGearBar.classList.remove('hidden');
          outdoorGearBar.style.display = '';
        }
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
        const centerPillText = document.getElementById('header-center-pill-text');
        if (centerPillText) {
          centerPillText.textContent = "Rando Finder";
        }
        // Restaurer l'interface club complète
        if (searchFilterBar) searchFilterBar.classList.remove('hidden');
        if (searchInstructionsBar) searchInstructionsBar.classList.remove('hidden');
        if (userControls) userControls.classList.remove('hidden');
        if (dbSelectorBox) dbSelectorBox.classList.remove('hidden');
        if (storageBadge) storageBadge.classList.remove('hidden');
        if (headerSubLocation) headerSubLocation.innerHTML = 'Sanary-sur-Mer &bull; Var (83)';
        tabButtons.forEach(btn => {
          btn.classList.remove('hidden');
          btn.style.removeProperty('display');
        });
        if (tableCol) {
          tableCol.classList.remove('hidden');
          tableCol.style.removeProperty('display');
        }
        if (mapCol) {
          mapCol.style.removeProperty('width');
          mapCol.style.removeProperty('height');
        }
        if (quickGpxBtn) quickGpxBtn.classList.add('hidden');
        if (createGpxBtn) createGpxBtn.classList.add('hidden');
        if (editGpxBtn) editGpxBtn.classList.add('hidden');
        if (window.GpxCreatorEditorInstance) {
          window.GpxCreatorEditorInstance.stopCreateMode();
          window.GpxCreatorEditorInstance.stopEditMode();
        }

        // Restaurer la vue (mixte par défaut pour le club)
        if (window.App && typeof window.App.setViewMode === 'function') {
          window.App.setViewMode('split');
        }

        // Restaurer les marqueurs de randonnées sur la carte
        if (window.MapManagerInstance) {
          const mm = window.MapManagerInstance;
          if (mm.markersLayer && mm.map && !mm.map.hasLayer(mm.markersLayer)) {
            mm.map.addLayer(mm.markersLayer);
          }
          mm.updateSearchRadiusVisuals(false);
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
    ensureQuickGpxModal() {
      let modal = document.getElementById('quick-gpx-drop-modal');
      if (modal) return modal;

      modal = document.createElement('div');
      modal.id = 'quick-gpx-drop-modal';
      modal.className = 'hidden fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4';
      modal.innerHTML = `
        <div class="bg-slate-900 border-2 border-amber-500/60 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-white relative animate-fade-in">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">📂</span>
              <div>
                <h3 class="text-base sm:text-lg font-black text-white leading-tight">Charger une trace GPX sur la carte</h3>
                <p class="text-[11px] text-slate-400">Glisser-déposer ou parcourir depuis votre ordinateur</p>
              </div>
            </div>
            <button type="button" id="btn-close-quick-gpx-modal" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-black text-sm flex items-center justify-center transition" title="Fermer">✕</button>
          </div>

          <div id="quick-gpx-modal-dropzone" class="border-2 border-dashed border-amber-400/80 hover:border-amber-300 bg-slate-950/70 hover:bg-slate-950 rounded-2xl p-7 text-center cursor-pointer transition-all group">
            <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform pointer-events-none">
              📥
            </div>
            <p class="text-sm sm:text-base font-extrabold text-white pointer-events-none">
              Glissez-déposez votre fichier <span class="text-amber-400">.gpx</span> ici
            </p>
            <p class="text-xs text-slate-400 mt-1 pointer-events-none">
              Relâchez directement votre fichier dans ce cadre pour afficher son tracé et son profil
            </p>

            <div class="my-4 flex items-center justify-center gap-3 pointer-events-none">
              <span class="h-px w-14 bg-slate-800"></span>
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">ou chargement classique</span>
              <span class="h-px w-14 bg-slate-800"></span>
            </div>

            <button type="button" id="btn-quick-gpx-browse" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg transition cursor-pointer">
              <span>📂</span>
              <span>Parcourir sur mon ordinateur</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const closeBtn = modal.querySelector('#btn-close-quick-gpx-modal');
      const browseBtn = modal.querySelector('#btn-quick-gpx-browse');
      const dz = modal.querySelector('#quick-gpx-modal-dropzone');
      const inputGpxViewer = document.getElementById('input-quick-gpx-viewer');

      closeBtn.addEventListener('click', () => this.closeQuickGpxModal());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeQuickGpxModal();
      });

      const triggerBrowse = (e) => {
        if (e) e.stopPropagation();
        if (inputGpxViewer) inputGpxViewer.click();
      };
      browseBtn.addEventListener('click', triggerBrowse);
      dz.addEventListener('click', triggerBrowse);

      dz.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add('border-amber-300', 'bg-amber-500/15', 'ring-4', 'ring-amber-400/30');
      });
      dz.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        dz.classList.add('border-amber-300', 'bg-amber-500/15', 'ring-4', 'ring-amber-400/30');
      });
      dz.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dz.contains(e.relatedTarget)) {
          dz.classList.remove('border-amber-300', 'bg-amber-500/15', 'ring-4', 'ring-amber-400/30');
        }
      });
      dz.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove('border-amber-300', 'bg-amber-500/15', 'ring-4', 'ring-amber-400/30');
        const files = e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
        if (files.length > 0) {
          this.closeQuickGpxModal();
          files.slice(0, 3).forEach(f => this.handleQuickGpxFile(f));
        }
      });

      return modal;
    }

    openQuickGpxModal() {
      const modal = this.ensureQuickGpxModal();
      modal.classList.remove('hidden');
    }

    closeQuickGpxModal() {
      const modal = document.getElementById('quick-gpx-drop-modal');
      if (modal) modal.classList.add('hidden');
    }

    initMapDragAndDropGpx() {
      const mapCol = document.getElementById('map-column');
      if (!mapCol) return;

      let overlay = document.getElementById('map-gpx-drag-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'map-gpx-drag-overlay';
        overlay.className = 'hidden absolute inset-2 z-[2000] rounded-2xl border-4 border-dashed border-amber-400 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none text-white shadow-2xl';
        overlay.innerHTML = `
          <div class="w-16 h-16 rounded-2xl bg-amber-500/25 border border-amber-400/60 flex items-center justify-center text-4xl mb-3 animate-bounce">📥</div>
          <div class="text-base sm:text-lg font-black text-amber-300">Relâchez votre fichier GPX ici</div>
          <div class="text-xs sm:text-sm text-slate-200 mt-1">Affichage immédiat du tracé sur la carte</div>
        `;
        mapCol.appendChild(overlay);
      }

      let dragDepth = 0;
      mapCol.addEventListener('dragenter', (e) => {
        if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
        e.preventDefault();
        dragDepth++;
        overlay.classList.remove('hidden');
      });
      mapCol.addEventListener('dragover', (e) => {
        if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        overlay.classList.remove('hidden');
      });
      mapCol.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0 || !mapCol.contains(e.relatedTarget)) {
          dragDepth = 0;
          overlay.classList.add('hidden');
        }
      });
      mapCol.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragDepth = 0;
        overlay.classList.add('hidden');
        const files = e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
        if (!files || !files.length) return;
        files.slice(0, 3).forEach(f => this.handleQuickGpxFile(f));
      });
    }

    handleQuickGpxFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target.result;
          const parsed = GPXParser.parse(content, file.name);
          if (parsed && window.MapManagerInstance) {
            window.MapManagerInstance.displayStandaloneGpxTrack(parsed, file.name);

            // Calcul asynchrone IBP officiel en arrière-plan
            try {
              const officialIbp = await GPXParser.fetchOfficialIBP(content, file.name);
              if (officialIbp !== null) {
                parsed.ibp = officialIbp;
                const lvl = GPXParser.getIBPLevel(officialIbp);
                parsed.ibpLevel = lvl.level;
                parsed.difficulty = lvl.label;
                if (window.MapManagerInstance.standaloneHike) {
                  window.MapManagerInstance.standaloneHike.ibp = officialIbp;
                  window.MapManagerInstance.showStandaloneGpxHud(window.MapManagerInstance.standaloneHike);
                }
              }
            } catch (errIbp) {
              console.warn("IBP quick fetch notice:", errIbp);
            }
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
  

        /* =========================================================================
     * MUSIQUE D'AMBIANCE ACCUEIL (HAUT-PARLEUR ÉPURÉ : BARRÉ / PAS BARRÉ)
     * ========================================================================= */
    initMusicPlayer() {
      const btn = document.getElementById('btn-toggle-music');
      const audio = document.getElementById('portal-bg-music');
      const icon = document.getElementById('music-icon');
      if (!btn || !audio) return;

      audio.volume = 0.40;
      let isPlaying = false;

      // Haut-parleur barré (quand pas de musique / off)
      const SVG_MUTED = `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
        <line x1="22" y1="2" x2="2" y2="22" stroke-width="2.2"></line>
      </svg>`;

      // Haut-parleur pas barré (quand musique active)
      const SVG_PLAYING = `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      </svg>`;

      const setPlayingState = (playing) => {
        isPlaying = playing;
        if (playing) {
          if (icon) icon.innerHTML = SVG_PLAYING;
          btn.classList.add('text-emerald-400');
          btn.classList.remove('text-slate-400');
          btn.title = "Musique d'ambiance active (cliquer pour couper)";
        } else {
          if (icon) icon.innerHTML = SVG_MUTED;
          btn.classList.add('text-slate-400');
          btn.classList.remove('text-emerald-400');
          btn.title = "Musique d'ambiance (cliquer pour écouter)";
        }
      };

      // État initial sobre : barré (pas de musique)
      setPlayingState(false);

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (audio.paused) {
          audio.play().then(() => {
            setPlayingState(true);
          }).catch(err => {
            console.warn('Lecture audio bloquée ou non autorisée:', err);
          });
        } else {
          audio.pause();
          setPlayingState(false);
        }
      });

      audio.addEventListener('play', () => setPlayingState(true));
      audio.addEventListener('pause', () => setPlayingState(false));
      audio.addEventListener('ended', () => setPlayingState(false));

      this._musicAudio = audio;
    }

    pauseMusic() {
      if (this._musicAudio && !this._musicAudio.paused) {
        this._musicAudio.pause();
      }
    }
  }

  // Instanciation globale
  window.PortalRouterInstance = new PortalRouter();

  // =========================================================================
  // RECHERCHE UNIFIÉE DE COURS D'EAU (IGN Hydrographie BD TOPO + OSM Waterway)
  // Utilisée par les 2 systèmes de carte (Cartes & Outils et Randonner)
  // =========================================================================
  const FRENCH_FLEUVES = new Set([
    'rhone', 'loire', 'seine', 'garonne', 'rhin', 'meuse', 'escaut', 'somme',
    'vilaine', 'charente', 'adour', 'var', 'argens', 'herault', 'aude', 'tet',
    'orne', 'vire', 'sevre niortaise', 'golo', 'tavignano', 'orb', 'tech',
    'roya', 'siagne', 'gapeau', 'huveaune', 'arc', 'reppe', 'touloubre', 'vidourle',
    'lez', 'paillon', 'cagne', 'loup', 'brague', 'giscle', 'eyrieux', 'dordogne'
  ]);

  function normalizeWaterName(str) {
    return String(str || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/^(le |la |l'|les |fleuve |riviere |ruisseau |torrent |canal |vallon |ravin |bief )+/i, '')
      .trim();
  }

  function classifyWaterway(name, osmValue) {
    const low = String(name || '').toLowerCase();
    const core = normalizeWaterName(name);
    if (osmValue === 'waterfall' || /\b(cascade|chute|chutes|saut)\b/i.test(low)) return 'Cascade';
    if (osmValue === 'canal' || /^canal\b/i.test(low)) return 'Canal';
    if (/^bief\b/i.test(low)) return 'Bief';
    if (/^torrent\b/i.test(low)) return 'Torrent';
    if (/^vallon\b/i.test(low)) return 'Vallon';
    if (/^ravin\b/i.test(low)) return 'Ravin';
    if (/^ruisseau\b/i.test(low) || osmValue === 'stream') return 'Ruisseau';
    if (/^fleuve\b/i.test(low) || FRENCH_FLEUVES.has(core)) return 'Fleuve';
    if (osmValue === 'river' || /^rivi[èe]re\b/i.test(low)) return 'Rivière';
    if (osmValue === 'drain' || osmValue === 'ditch') return 'Ruisseau / Fossé';
    return 'Cours d\'eau';
  }

  window.searchWaterways = async function(query, signal) {
    const q = (query || '').trim();
    if (q.length < 3) return [];
    const qNorm = normalizeWaterName(q);

    const ignPromise = (async () => {
      try {
        const url = `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(q)}&index=poi&category=${encodeURIComponent("cours d'eau")}&limit=5`;
        const resp = await fetch(url, { headers: { 'Accept': 'application/json' }, signal });
        if (!resp.ok) return [];
        const data = await resp.json();
        const feats = data.features || [];
        return feats.map(f => {
          const p = f.properties || {};
          const coords = f.geometry?.coordinates || [];
          const rawName = (p.toponym || p.name || '').trim();
          if (!rawName || coords.length < 2) return null;
          // Filtrer les résultats IGN qui ne matchent que la commune et pas le nom du cours d'eau
          const nameNorm = normalizeWaterName(rawName);
          if (qNorm.length >= 3 && !nameNorm.includes(qNorm) && !rawName.toLowerCase().includes(q.toLowerCase())) {
            return null;
          }
          const waterType = classifyWaterway(rawName, null);
          const cities = Array.isArray(p.city) ? p.city.filter(Boolean).slice(0, 2).join(', ') : (p.city || '');
          const sub = [waterType, cities, 'France (IGN)'].filter(Boolean).join(' • ');
          return {
            rawName,
            waterType,
            title: `${rawName} — ${waterType}`,
            subtitle: sub,
            lat: Number(coords[1]),
            lon: Number(coords[0]),
            bbox: null,
            icon: '🌊',
            isWaterway: true,
            score: nameNorm === qNorm ? 120 : 88
          };
        }).filter(Boolean);
      } catch (e) {
        return [];
      }
    })();

    const photonPromise = (async () => {
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&osm_tag=waterway&limit=5&lang=fr`;
        const resp = await fetch(url, { signal });
        if (!resp.ok) return [];
        const data = await resp.json();
        const feats = data.features || [];
        return feats.map(f => {
          const p = f.properties || {};
          const coords = f.geometry?.coordinates || [];
          const rawName = (p.name || '').trim();
          const osmVal = p.osm_value || '';
          if (!rawName || coords.length < 2 || osmVal === 'dam' || osmVal === 'weir') return null;
          const nameNorm = normalizeWaterName(rawName);
          const waterType = classifyWaterway(rawName, osmVal);
          const loc = [p.city, p.state, p.country].filter(Boolean).join(', ');
          const sub = [waterType, loc].filter(Boolean).join(' • ');
          const isFrance = (p.countrycode || '').toUpperCase() === 'FR';
          return {
            rawName,
            waterType,
            title: `${rawName} — ${waterType}`,
            subtitle: sub,
            lat: Number(coords[1]),
            lon: Number(coords[0]),
            bbox: f.bbox ? [[f.bbox[1], f.bbox[0]], [f.bbox[3], f.bbox[2]]] : null,
            icon: '🌊',
            isWaterway: true,
            score: (nameNorm === qNorm ? 115 : 80) + (isFrance ? 25 : 0),
            osmType: p.osm_type,
            osmId: p.osm_id,
            osmValue: osmVal
          };
        }).filter(Boolean);
      } catch (e) {
        return [];
      }
    })();

    const [ignRes, phRes] = await Promise.all([ignPromise, photonPromise]);
    const all = [...ignRes, ...phRes].sort((a, b) => b.score - a.score);

    // Déduplication par nom + proximité
    const unique = [];
    for (const item of all) {
      const dup = unique.some(u =>
        normalizeWaterName(u.rawName) === normalizeWaterName(item.rawName) &&
        Math.abs(u.lat - item.lat) < 0.25 && Math.abs(u.lon - item.lon) < 0.25
      );
      if (!dup) unique.push(item);
      if (unique.length >= 4) break;
    }
    return unique;
  };

  // =========================================================================
  // GESTIONNAIRE ET AFFICHAGE ANIMÉ CLIGNOTANT DES COURS D'EAU (WATERWAYS)
  // Permet le clignotement haute visibilité et l'écoulement animé sur le tracé
  // =========================================================================
  class WaterwayManager {
    static currentWaterwayLayer = null;
    static currentWaterwayBanner = null;
    static _cache = new Map();

    /**
     * Nettoie tout tracé de cours d'eau précédent
     */
    static clearWaterway(map) {
      if (!map && window.MapManagerInstance && window.MapManagerInstance.map) {
        map = window.MapManagerInstance.map;
      }
      if (this.currentWaterwayLayer) {
        try {
          if (map && map.hasLayer(this.currentWaterwayLayer)) {
            map.removeLayer(this.currentWaterwayLayer);
          }
        } catch (e) {}
        this.currentWaterwayLayer = null;
      }
      this.removeWaterwayBanner();
    }

    /**
     * Supprime le bandeau flottant d'information du cours d'eau
     */
    static removeWaterwayBanner() {
      if (this.currentWaterwayBanner) {
        try { this.currentWaterwayBanner.remove(); } catch (e) {}
        this.currentWaterwayBanner = null;
      }
      const b = document.getElementById('waterway-floating-banner');
      if (b) {
        try { b.remove(); } catch (e) {}
      }
    }

    /**
     * Affiche la fenêtre flottante d'information à droite du cours d'eau (dans la carte, déplaçable avec - et ✕)
     */
    static showWaterwayBanner(waterway, map, opts = {}) {
      this.removeWaterwayBanner();

      const container = (map && map.getContainer) ? map.getContainer() : document.body;
      const banner = document.createElement('div');
      banner.id = 'waterway-floating-banner';
      banner.className = 'movable-floating-window absolute z-[1040] bg-slate-900/95 text-white backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-2xl border-2 border-sky-500/80 flex flex-col gap-1.5 w-[270px] sm:w-[320px] max-w-[calc(100%-2rem)] transition-all duration-200 select-none';

      const wType = waterway.waterType || "Cours d'eau";
      const distText = opts.distKm ? `Longueur : ~${opts.distKm} km` : (opts.segmentsCount ? `${opts.segmentsCount} tronçons` : '');

      banner.innerHTML = `
        <div class="window-drag-header flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800 cursor-grab active:cursor-grabbing">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="window-drag-grip text-slate-400 hover:text-white text-xs opacity-75">⠿</span>
            <span class="bg-sky-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md shadow uppercase tracking-wide flex items-center gap-1 flex-shrink-0">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-cyan-200 animate-ping"></span>
              🌊 ${wType}
            </span>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button id="btn-min-waterway-banner" type="button" class="hud-win-btn bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600" title="Réduire / Agrandir">&minus;</button>
            <button id="btn-close-waterway-banner" type="button" class="hud-win-btn bg-rose-950/90 hover:bg-rose-700 text-rose-300 hover:text-white border border-rose-800" title="Masquer le cours d'eau">&#x2715;</button>
          </div>
        </div>
        <div id="waterway-banner-body" class="flex flex-col gap-0.5">
          <div class="font-extrabold text-white text-sm leading-tight truncate">${waterway.rawName || waterway.title || "Cours d'eau"}</div>
          ${distText ? `<div class="text-xs text-cyan-300 font-bold">${distText}</div>` : ''}
          <div class="text-[10.5px] text-slate-400 font-medium truncate">
            ${waterway.subtitle || 'Tracé hydrographique officiel'}
          </div>
        </div>
      `;

      // Calcul de la position : à droite du cours d'eau / point cliqué, à l'intérieur de la carte
      const cW = container.clientWidth || window.innerWidth;
      const cH = container.clientHeight || window.innerHeight;
      const panelW = Math.min(320, cW - 32);
      const panelH = 105;
      let leftPx = Math.max(16, cW - panelW - 18);
      let topPx = Math.max(72, Math.round(cH * 0.32));

      if (map && typeof map.latLngToContainerPoint === 'function') {
        let anchor = null;
        if (opts.bounds && typeof opts.bounds.isValid === 'function' && opts.bounds.isValid()) {
          anchor = L.latLng(opts.bounds.getCenter().lat, opts.bounds.getEast());
        } else if (waterway.lat != null && waterway.lon != null) {
          anchor = L.latLng(waterway.lat, waterway.lon);
        }
        if (anchor) {
          const pt = map.latLngToContainerPoint(anchor);
          leftPx = Math.min(cW - panelW - 16, Math.max(16, Math.round(pt.x + 22)));
          topPx = Math.min(cH - panelH - 58, Math.max(72, Math.round(pt.y - panelH / 2)));
        }
      }

      banner.style.left = `${leftPx}px`;
      banner.style.top = `${topPx}px`;

      container.appendChild(banner);
      this.currentWaterwayBanner = banner;

      if (typeof L !== 'undefined' && L.DomEvent) {
        L.DomEvent.disableClickPropagation(banner);
        L.DomEvent.disableScrollPropagation(banner);
      }

      const minBtn = banner.querySelector('#btn-min-waterway-banner');
      const bodyEl = banner.querySelector('#waterway-banner-body');
      if (minBtn && bodyEl) {
        minBtn.addEventListener('click', () => {
          const hidden = bodyEl.classList.toggle('hidden');
          minBtn.innerHTML = hidden ? '&#x25A1;' : '&minus;';
        });
      }

      const closeBtn = banner.querySelector('#btn-close-waterway-banner');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.clearWaterway(map);
        });
      }
    }

    /**
     * Récupère la géométrie fine complète d'un cours d'eau depuis OSM (way/relation/full.json) ou Nominatim
     */
    static async fetchWaterwayGeometry(item) {
      const cacheKey = `${item.osmType || ''}_${item.osmId || ''}_${item.rawName || item.title || ''}`;
      if (this._cache.has(cacheKey)) {
        return this._cache.get(cacheKey);
      }

      let segments = [];

      // 1. Si osmType et osmId sont présents (provenant de Photon)
      if (item.osmType && item.osmId) {
        const typeStr = (item.osmType === 'R' || item.osmType === 'relation') ? 'relation' : 'way';
        try {
          const url = `https://api.openstreetmap.org/api/0.6/${typeStr}/${item.osmId}/full.json`;
          const resp = await fetch(url);
          if (resp.ok) {
            const data = await resp.json();
            if (data && Array.isArray(data.elements)) {
              const nodes = {};
              data.elements.forEach(el => {
                if (el.type === 'node' && el.lat != null && el.lon != null) {
                  nodes[el.id] = [Number(el.lat), Number(el.lon)];
                }
              });
              data.elements.forEach(el => {
                if (el.type === 'way' && Array.isArray(el.nodes)) {
                  const pts = el.nodes.map(nid => nodes[nid]).filter(Boolean);
                  if (pts.length > 1) {
                    segments.push(pts);
                  }
                }
              });
            }
          }
        } catch (e) {
          console.warn('[WaterwayManager] Erreur OSM direct full.json:', e);
        }
      }

      // 2. Fallback Nominatim avec polygon_geojson si segments vides
      if (segments.length === 0 && (item.rawName || item.title)) {
        try {
          const queryName = item.rawName || item.title.split('—')[0].trim();
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryName)}&format=json&polygon_geojson=1&limit=3`;
          const resp = await fetch(url);
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data)) {
              for (const res of data) {
                const geo = res.geojson;
                if (!geo) continue;
                if (geo.type === 'LineString' && Array.isArray(geo.coordinates)) {
                  const pts = geo.coordinates.map(c => [c[1], c[0]]);
                  if (pts.length > 1) segments.push(pts);
                  break;
                } else if (geo.type === 'MultiLineString' && Array.isArray(geo.coordinates)) {
                  geo.coordinates.forEach(line => {
                    const pts = line.map(c => [c[1], c[0]]);
                    if (pts.length > 1) segments.push(pts);
                  });
                  break;
                }
              }
            }
          }
        } catch (e) {
          console.warn('[WaterwayManager] Erreur Nominatim geojson:', e);
        }
      }

      // 3. Fallback Overpass ciblé autour du point si toujours vide
      if (segments.length === 0 && item.lat && item.lon) {
        try {
          const qName = (item.rawName || item.title || '').replace(/["']/g, '');
          const opQuery = `[out:json][timeout:6];(way["waterway"~"river|stream|canal"]["name"~"${qName}",i](around:35000,${item.lat},${item.lon});relation["waterway"~"river|stream|canal"]["name"~"${qName}",i](around:35000,${item.lat},${item.lon}););out geom 30;`;
          const mirrors = [
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass-api.de/api/interpreter'
          ];
          for (const mirror of mirrors) {
            try {
              const resp = await fetch(mirror, {
                method: 'POST',
                body: 'data=' + encodeURIComponent(opQuery),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
              });
              if (!resp.ok) continue;
              const data = await resp.json();
              if (data && Array.isArray(data.elements)) {
                data.elements.forEach(el => {
                  if (el.type === 'way' && Array.isArray(el.geometry)) {
                    const pts = el.geometry.map(g => [g.lat, g.lon]);
                    if (pts.length > 1) segments.push(pts);
                  } else if (el.type === 'relation' && Array.isArray(el.members)) {
                    el.members.forEach(m => {
                      if (m.type === 'way' && Array.isArray(m.geometry)) {
                        const pts = m.geometry.map(g => [g.lat, g.lon]);
                        if (pts.length > 1) segments.push(pts);
                      }
                    });
                  }
                });
                if (segments.length > 0) break;
              }
            } catch (me) {}
          }
        } catch (e) {
          console.warn('[WaterwayManager] Erreur Overpass fallback:', e);
        }
      }

      // 4. Fallback ultime : si aucun tracé géométrique détaillé trouvé, tracer un segment représentatif
      if (segments.length === 0 && item.lat && item.lon) {
        const d = 0.015;
        segments.push([
          [item.lat - d, item.lon - d],
          [item.lat, item.lon],
          [item.lat + d, item.lon + d]
        ]);
      }

      if (segments.length > 0) {
        this._cache.set(cacheKey, segments);
      }
      return segments;
    }

    /**
     * Calcule la distance totale approximative en kilomètres
     */
    static computeDistanceKm(segments) {
      if (!segments || !segments.length) return 0;
      let distMeters = 0;
      const toRad = x => (x * Math.PI) / 180;
      segments.forEach(pts => {
        for (let i = 0; i < pts.length - 1; i++) {
          const [lat1, lon1] = pts[i];
          const [lat2, lon2] = pts[i + 1];
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distMeters += 6371000 * c;
        }
      });
      return Math.round(distMeters / 1000);
    }

    /**
     * Affiche le cours d'eau sur la carte avec clignotement animé, halo lumineux et écoulement continu
     */
    static async displayWaterway(waterway, map) {
      if (!map) {
        if (window.MapManagerInstance && window.MapManagerInstance.map) {
          map = window.MapManagerInstance.map;
        } else {
          return;
        }
      }

      if (!waterway) return;

      // Nettoyer tout affichage précédent
      this.clearWaterway(map);

      // Supprimer tout éventuel marker de recherche précédent
      if (window._worldSearchMarker) {
        try { map.removeLayer(window._worldSearchMarker); } catch (e) {}
        window._worldSearchMarker = null;
      }

      // Récupérer la géométrie fine
      const segments = (waterway.geometry && Array.isArray(waterway.geometry))
        ? waterway.geometry
        : await this.fetchWaterwayGeometry(waterway);

      if (!segments || segments.length === 0) {
        if (waterway.lat && waterway.lon) {
          map.setView([waterway.lat, waterway.lon], 14);
        }
        return;
      }

      const distKm = this.computeDistanceKm(segments);

      // Créer le groupe de calques pour le tracé clignotant
      this.currentWaterwayLayer = L.layerGroup();

      // 1. Halo lumineux sous-jacent (Blanc éclatant pour détacher sur tout fond IGN/Satellite/OSM)
      const halo = L.polyline(segments, {
        color: '#ffffff',
        weight: 9,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false
      });
      this.currentWaterwayLayer.addLayer(halo);

      // 2. Tracé corps du cours d'eau en bleu azur éclatant avec pulsation / clignotement
      const bodyTrack = L.polyline(segments, {
        color: '#0284c7', // Bleu azur éclatant
        weight: 5.5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
        className: 'leaflet-waterway-blinking-path'
      });
      this.currentWaterwayLayer.addLayer(bodyTrack);

      // 3. Tirets d'écoulement de l'eau animés en continu le long du lit du cours d'eau
      const dashTrack = L.polyline(segments, {
        color: '#e0f2fe', // Écume / eau claire lumineuse
        weight: 2.8,
        dashArray: '12, 10',
        opacity: 0.95,
        interactive: false,
        className: 'leaflet-waterway-blinking-dash'
      });
      this.currentWaterwayLayer.addLayer(dashTrack);

      // Ajouter à la carte
      this.currentWaterwayLayer.addTo(map);

      // Ajuster le zoom pour englober tout le cours d'eau ou le tronçon
      let fitBoundsObj = null;
      try {
        const allPts = segments.flat();
        if (allPts.length > 0) {
          fitBoundsObj = L.latLngBounds(allPts);
          map.fitBounds(fitBoundsObj, { padding: [50, 50], maxZoom: 15, animate: false });
        } else if (waterway.lat && waterway.lon) {
          map.setView([waterway.lat, waterway.lon], 14, { animate: false });
        }
      } catch (e) {
        if (waterway.lat && waterway.lon) map.setView([waterway.lat, waterway.lon], 14, { animate: false });
      }

      // Afficher la fenêtre d'information à droite du cours d'eau dans la carte
      this.showWaterwayBanner(waterway, map, { distKm, segmentsCount: segments.length, bounds: fitBoundsObj });
    }
  }

  // Export global
  window.WaterwayManager = WaterwayManager;
  window.displayWaterway = WaterwayManager.displayWaterway.bind(WaterwayManager);
  window.clearWaterway = WaterwayManager.clearWaterway.bind(WaterwayManager);

  // Effacement complet depuis la croix (✕) de la barre de recherche (GR + cours d'eau + marqueur + cercle + popup)
  window.clearWorldSearchAndWaterway = function() {
    const map = window.MapManagerInstance && window.MapManagerInstance.map;
    if (typeof GrManager !== 'undefined' && typeof GrManager.clearGr === 'function') {
      GrManager.clearGr(map);
    }
    if (typeof WaterwayManager !== 'undefined') {
      WaterwayManager.clearWaterway(map);
    }
    if (map) {
      if (window._worldSearchMarker) {
        try { map.removeLayer(window._worldSearchMarker); } catch (e) {}
        window._worldSearchMarker = null;
      }
      if (window._worldSearchCircle) {
        try { map.removeLayer(window._worldSearchCircle); } catch (e) {}
        window._worldSearchCircle = null;
      }
      try { map.closePopup(); } catch (e) {}
    }
  };

  // Interrogation silencieuse au clic direct sur un cours d'eau sur la carte -> affiche son nom et l'illumine
  let _waterwayClickAbort = null;
  window.queryWaterwayAtPoint = async function(latlng) {
    const map = window.MapManagerInstance && window.MapManagerInstance.map;
    if (!map || !latlng) return false;
    if (_waterwayClickAbort) {
      try { _waterwayClickAbort.abort(); } catch (e) {}
    }
    _waterwayClickAbort = new AbortController();
    const lat = Number(latlng.lat);
    const lon = Number(latlng.lng);
    const z = map.getZoom();

    // Tolérance de clic adaptative selon le zoom (en mètres réels par rapport au lit du cours d'eau)
    const maxTapMeters = z >= 16 ? 55 : (z >= 15 ? 85 : (z >= 14 ? 130 : (z >= 13 ? 210 : (z >= 12 ? 320 : 480))));
    const degTol = maxTapMeters / 111000;

    // Utilitaire : distance minimale en mètres entre le clic et un ensemble de segments [[lat,lon],...]
    const minDistToSegments = (segs) => {
      let minM = Infinity;
      const cosLat = Math.cos(lat * Math.PI / 180);
      for (const seg of segs) {
        for (let i = 0; i < seg.length; i++) {
          const dy = (seg[i][0] - lat) * 111320;
          const dx = (seg[i][1] - lon) * 111320 * cosLat;
          const m = Math.hypot(dx, dy);
          if (m < minM) minM = m;
        }
      }
      return minM;
    };

    // 1) PRIORITÉ FRANCE : API officielle IGN Géoplateforme WFS BD TOPO® (100ms, 100% fiable, géométrie complète incluse !)
    if (lat >= 41.0 && lat <= 51.5 && lon >= -5.5 && lon <= 10.0) {
      try {
        const bbox = `${(lat - degTol).toFixed(6)},${(lon - degTol).toFixed(6)},${(lat + degTol).toFixed(6)},${(lon + degTol).toFixed(6)},urn:ogc:def:crs:EPSG::4326`;
        const wfsUrl = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:cours_d_eau&OUTPUTFORMAT=application/json&COUNT=6&BBOX=${bbox}`;
        const resp = await fetch(wfsUrl, { headers: { 'Accept': 'application/json' }, signal: _waterwayClickAbort.signal });
        if (resp.ok) {
          const data = await resp.json();
          const feats = (data && Array.isArray(data.features)) ? data.features : [];
          let bestMatch = null;
          let bestDist = Infinity;

          for (const f of feats) {
            const p = f.properties || {};
            const rawName = (p.toponyme || '').trim();
            const geom = f.geometry;
            if (!rawName || !geom || !geom.coordinates) continue;

            let segs = [];
            if (geom.type === 'LineString') {
              segs = [geom.coordinates.map(c => [c[1], c[0]])];
            } else if (geom.type === 'MultiLineString') {
              segs = geom.coordinates.map(line => line.map(c => [c[1], c[0]]));
            }
            if (!segs.length) continue;

            const distM = minDistToSegments(segs);
            if (distM <= maxTapMeters && distM < bestDist) {
              bestDist = distM;
              bestMatch = { rawName, segs };
            }
          }

          if (bestMatch) {
            const waterType = classifyWaterway(bestMatch.rawName, null);
            const item = {
              rawName: bestMatch.rawName,
              waterType,
              title: `${bestMatch.rawName} — ${waterType}`,
              subtitle: `${waterType} • IGN BD TOPO®`,
              lat,
              lon,
              geometry: bestMatch.segs,
              icon: '🌊',
              isWaterway: true
            };
            const input = document.getElementById('map-world-search-input');
            if (input) input.value = item.title;
            const clearBtn = document.getElementById('btn-clear-world-search');
            if (clearBtn) clearBtn.classList.remove('hidden');

            WaterwayManager.displayWaterway(item, map);
            return true;
          }
        }
      } catch (e) {
        if (e.name === 'AbortError') return false;
      }
    }

    // 2) Fallback international : Overpass OSM
    const q = `[out:json][timeout:6];(way(around:${maxTapMeters},${lat.toFixed(6)},${lon.toFixed(6)})["waterway"]["name"];);out tags center 3;`;
    try {
      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: _waterwayClickAbort.signal
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      const el = data && Array.isArray(data.elements) && data.elements.find(e => e.tags && e.tags.name);
      if (!el) return false;

      const rawName = el.tags.name.trim();
      const waterType = classifyWaterway(rawName, el.tags.waterway || '');
      const item = {
        rawName,
        waterType,
        title: `${rawName} — ${waterType}`,
        subtitle: `${waterType} • OpenStreetMap`,
        lat,
        lon,
        icon: '🌊',
        isWaterway: true
      };
      const input = document.getElementById('map-world-search-input');
      if (input) input.value = item.title;
      const clearBtn = document.getElementById('btn-clear-world-search');
      if (clearBtn) clearBtn.classList.remove('hidden');

      WaterwayManager.displayWaterway(item, map);
      return true;
    } catch (e) {
      return false;
    }
  };
})();
