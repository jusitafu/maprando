/**
 * GPX Creator & Interactive Editor - Map & Rando by JLDApps 2026
 * 1. Créateur d'itinéraire GPX automatique (magnétisme sentiers via BRouter & IGN)
 * 2. Éditeur interactif de trace GPX (déplacement de points vers des chemins voisins & export GPX)
 */

class GpxCreatorEditor {
  constructor() {
    this.mapManager = null;
    this.map = null;
    this.mode = null; // 'create' | 'edit' | null

    // État Création
    this.createWaypoints = [];       // [{ lat, lon, marker }]
    this.createRouteCoords = [];      // [[lat, lon, ele], ...]
    this.createPolyline = null;
    this.createAutoRoute = true;
    this.createFloatingCard = null;

    // État Édition
    this.editingTrack = null;         // Reference vers la trace dans standaloneTracks
    this.originalCoords = [];         // Backup pour annulation
    this.editHandles = [];            // [{ index, lat, lon, marker }]
    this.editPolyline = null;
    this.editAutoRoute = true;
    this.editFloatingCard = null;

    // Service BRouter
    this.brouterBase = 'https://brouter.de/brouter';
    this.routingProfile = 'hiking-mountain';
  }

  init(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager ? mapManager.map : null;

    const btnCreate = document.getElementById('btn-create-gpx');
    const btnEdit = document.getElementById('btn-edit-gpx');

    if (btnCreate) {
      btnCreate.addEventListener('click', () => {
        if (this.mode === 'create') {
          this.stopCreateMode();
        } else {
          this.startCreateMode();
        }
      });
    }

    if (btnEdit) {
      btnEdit.addEventListener('click', () => {
        if (this.mode === 'edit') {
          this.stopEditMode();
        } else {
          this.startEditMode();
        }
      });
    }

    // Réinitialisation si la carte change
    window.addEventListener('hashchange', () => {
      if (window.location.hash !== '#carte') {
        this.stopCreateMode();
        this.stopEditMode();
      }
    });
  }

  // =========================================================================
  // 1. MODULE CRÉATION DE TRACE GPX (AUTO-ROUTAGE SENTIERS)
  // =========================================================================

  startCreateMode() {
    this.stopEditMode();
    this.mode = 'create';
    this.map = this.mapManager ? this.mapManager.map : null;
    if (!this.map) return;

    // Masquer le hud standalone pendant la création
    const hud = document.getElementById('standalone-gpx-hud');
    if (hud) hud.classList.add('hidden');

    // Modifier le curseur
    const mapContainer = this.map.getContainer();
    if (mapContainer) mapContainer.style.cursor = 'crosshair';

    // Bouton actif
    const btnCreate = document.getElementById('btn-create-gpx');
    if (btnCreate) {
      btnCreate.classList.add('ring-4', 'ring-sky-300', 'bg-sky-700');
    }

    // Écouteur de clic sur la carte
    this._mapClickHandler = (e) => this.handleCreateMapClick(e.latlng);
    this.map.on('click', this._mapClickHandler);

    // Afficher le panneau flottant de création
    this.showCreateFloatingPanel();
  }

  stopCreateMode() {
    if (this.mode !== 'create') return;
    this.mode = null;

    if (this.map && this._mapClickHandler) {
      this.map.off('click', this._mapClickHandler);
      this._mapClickHandler = null;
      const mapContainer = this.map.getContainer();
      if (mapContainer) mapContainer.style.cursor = '';
    }

    const btnCreate = document.getElementById('btn-create-gpx');
    if (btnCreate) {
      btnCreate.classList.remove('ring-4', 'ring-sky-300', 'bg-sky-700');
    }

    // Réafficher le HUD si des traces standalone sont présentes
    const hud = document.getElementById('standalone-gpx-hud');
    if (hud && this.mapManager && this.mapManager.standaloneTracks && this.mapManager.standaloneTracks.length > 0) {
      hud.classList.remove('hidden');
    }

    // Retirer polyline et marqueurs temporaires
    if (this.createPolyline && this.map) {
      this.map.removeLayer(this.createPolyline);
      this.createPolyline = null;
    }
    this.createWaypoints.forEach(wp => {
      if (wp.marker && this.map) this.map.removeLayer(wp.marker);
    });
    this.createWaypoints = [];
    this.createRouteCoords = [];

    // Retirer panneau flottant
    if (this.createFloatingCard) {
      this.createFloatingCard.remove();
      this.createFloatingCard = null;
    }
  }

  showCreateFloatingPanel() {
    if (this.createFloatingCard) this.createFloatingCard.remove();

    const parent = document.getElementById('map-column') || document.getElementById('main-map-app-container') || document.body;
    const card = document.createElement('div');
    card.id = 'gpx-creator-floating-panel';
    card.className = 'absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border-2 border-sky-400 backdrop-blur-md w-[92%] max-w-lg transition-all animate-in fade-in slide-in-from-top-3 duration-200';
    card.innerHTML = `
      <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div class="flex items-center gap-2">
          <span class="text-xl">✏️</span>
          <span class="font-extrabold text-sm sm:text-base text-sky-300">Créateur d'Itinéraire GPX</span>
        </div>
        <button id="btn-close-gpx-creator" type="button" class="text-slate-400 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800" title="Quitter le mode création">✕</button>
      </div>

      <div class="text-xs text-slate-300 mb-2.5 bg-slate-800/80 p-2 rounded-xl flex items-center justify-between gap-2 border border-slate-700/60">
        <span id="gpx-creator-tip">👉 Cliquez sur la carte pour poser le point A (Départ)...</span>
        <button id="btn-toggle-create-autoroute" type="button" class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${this.createAutoRoute ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}" title="Activer/désactiver le magnétisme automatique sur les sentiers réels">
          ${this.createAutoRoute ? '🥾 Auto-routage Sentiers : OUI' : '📏 Ligne Droite : OUI'}
        </button>
      </div>

      <div class="grid grid-cols-3 gap-2 mb-3 text-center">
        <div class="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
          <span class="text-[10px] text-slate-400 block font-semibold uppercase">Distance</span>
          <span id="gpx-create-dist" class="text-sm sm:text-base font-black text-sky-400">0.00 km</span>
        </div>
        <div class="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
          <span class="text-[10px] text-slate-400 block font-semibold uppercase">Dénivelé D+</span>
          <span id="gpx-create-ele" class="text-sm sm:text-base font-black text-emerald-400">+0 m</span>
        </div>
        <div class="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
          <span class="text-[10px] text-slate-400 block font-semibold uppercase">Waypoints</span>
          <span id="gpx-create-pts" class="text-sm sm:text-base font-black text-amber-400">0</span>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
        <button id="btn-undo-create-point" type="button" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5">
          <span>↶</span> <span>Annuler dernier point</span>
        </button>
        <div class="flex items-center gap-2">
          <button id="btn-reset-create-points" type="button" class="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 text-xs font-bold rounded-xl transition" title="Effacer tout">
            <span>🗑️</span>
          </button>
          <button id="btn-export-created-gpx" type="button" disabled class="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-black rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer">
            <span>💾</span> <span>Exporter le GPX</span>
          </button>
        </div>
      </div>
    `;

    parent.appendChild(card);
    this.createFloatingCard = card;

    // Événements du panneau
    document.getElementById('btn-close-gpx-creator')?.addEventListener('click', () => this.stopCreateMode());
    document.getElementById('btn-toggle-create-autoroute')?.addEventListener('click', () => {
      this.createAutoRoute = !this.createAutoRoute;
      const b = document.getElementById('btn-toggle-create-autoroute');
      if (b) {
        b.className = `px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${this.createAutoRoute ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`;
        b.innerHTML = this.createAutoRoute ? '🥾 Auto-routage Sentiers : OUI' : '📏 Ligne Droite : OUI';
      }
      this.recalculateCreatedRoute();
    });
    document.getElementById('btn-undo-create-point')?.addEventListener('click', () => this.undoLastCreatePoint());
    document.getElementById('btn-reset-create-points')?.addEventListener('click', () => this.resetCreatePoints());
    document.getElementById('btn-export-created-gpx')?.addEventListener('click', () => this.exportCreatedGpx());
  }

  async handleCreateMapClick(latlng) {
    if (this.mode !== 'create' || !this.map) return;

    const letter = String.fromCharCode(65 + this.createWaypoints.length);
    const marker = L.marker([latlng.lat, latlng.lng], {
      draggable: true,
      icon: L.divIcon({
        className: 'custom-wp-pin',
        html: `
          <div style="background:#0284c7; color:white; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:12px; border:2px solid white; box-shadow:0 3px 6px rgba(0,0,0,0.4); cursor:grab;">
            ${letter}
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      })
    }).addTo(this.map);

    const wp = { lat: latlng.lat, lon: latlng.lng, marker, letter };

    // Déplacement interactif d'un waypoint posé
    marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      wp.lat = pos.lat;
      wp.lon = pos.lng;
      this.recalculateCreatedRoute();
    });

    this.createWaypoints.push(wp);
    await this.recalculateCreatedRoute();
  }

  async recalculateCreatedRoute() {
    if (!this.map) return;
    const pts = this.createWaypoints;

    // Mise à jour compteur waypoints
    const ptsEl = document.getElementById('gpx-create-pts');
    if (ptsEl) ptsEl.innerText = pts.length;

    const tipEl = document.getElementById('gpx-creator-tip');
    if (tipEl) {
      if (pts.length === 0) tipEl.innerText = '👉 Cliquez sur la carte pour poser le point A (Départ)...';
      else if (pts.length === 1) tipEl.innerText = `Point A posé. Cliquez pour poser le point B...`;
      else tipEl.innerText = `Trace en cours (${pts.length} points). Déplacez une lettre ou continuez à cliquer.`;
    }

    const exportBtn = document.getElementById('btn-export-created-gpx');
    if (exportBtn) {
      exportBtn.disabled = pts.length < 2;
    }

    if (pts.length < 2) {
      if (this.createPolyline) {
        this.map.removeLayer(this.createPolyline);
        this.createPolyline = null;
      }
      this.createRouteCoords = [];
      const dEl = document.getElementById('gpx-create-dist');
      if (dEl) dEl.innerText = '0.00 km';
      const eEl = document.getElementById('gpx-create-ele');
      if (eEl) eEl.innerText = '+0 m';
      return;
    }

    let coords = [];
    if (this.createAutoRoute) {
      // Routage automatique via BRouter
      coords = await this.queryBRouter(pts);
      // Fallback ligne droite si BRouter renvoie vide
      if (!coords || coords.length === 0) {
        coords = pts.map(p => [p.lat, p.lon, 0]);
      }
    } else {
      // Ligne droite point à point
      coords = pts.map(p => [p.lat, p.lon, 0]);
    }

    this.createRouteCoords = coords;

    // Dessiner la polyline
    const latlngs = coords.map(c => [c[0], c[1]]);
    if (!this.createPolyline) {
      this.createPolyline = L.polyline(latlngs, {
        color: '#0284c7',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.map);
    } else {
      this.createPolyline.setLatLngs(latlngs);
    }

    // Calcul métriques réelles
    const stats = this.computeTrackStats(coords);
    const dEl = document.getElementById('gpx-create-dist');
    if (dEl) dEl.innerText = `${stats.distanceKm.toFixed(2)} km`;
    const eEl = document.getElementById('gpx-create-ele');
    if (eEl) eEl.innerText = `+${stats.elevationGain} m`;
  }

  undoLastCreatePoint() {
    if (this.createWaypoints.length === 0) return;
    const last = this.createWaypoints.pop();
    if (last && last.marker && this.map) {
      this.map.removeLayer(last.marker);
    }
    this.recalculateCreatedRoute();
  }

  resetCreatePoints() {
    this.createWaypoints.forEach(wp => {
      if (wp.marker && this.map) this.map.removeLayer(wp.marker);
    });
    this.createWaypoints = [];
    this.recalculateCreatedRoute();
  }

  exportCreatedGpx() {
    if (this.createRouteCoords.length < 2) return;
    const now = new Date().toISOString();
    const name = `Itineraire_MapRando_${new Date().toISOString().slice(0, 10)}`;

    const gpx = this.generateGpxXml(name, this.createRouteCoords, this.createWaypoints);
    this.downloadGpxFile(`${name}.gpx`, gpx);

    // Charger immédiatement le parcours créé dans MapManager pour qu'il soit affiché
    if (this.mapManager && typeof this.mapManager.loadStandaloneGpxContent === 'function') {
      this.mapManager.loadStandaloneGpxContent(gpx, `${name}.gpx`);
    }

    this.stopCreateMode();
  }

  // =========================================================================
  // 2. MODULE MODIFICATION DE TRACE GPX (DÉPLACEMENT DE POINTS INTERMÉDIAIRES)
  // =========================================================================

  startEditMode() {
    this.stopCreateMode();

    if (!this.mapManager || !this.mapManager.standaloneTracks || this.mapManager.standaloneTracks.length === 0) {
      alert("⚠️ Aucune trace GPX n'est actuellement affichée sur la carte.\n\nVeuillez d'abord cliquer sur « Charger 1 à 3 traces GPX » pour charger une trace à modifier, ou sur « Créer un GPX » pour tracer un nouvel itinéraire.");
      return;
    }

    this.mode = 'edit';
    this.map = this.mapManager.map;
    if (!this.map) return;

    // Masquer le hud standalone pendant l'édition
    const hud = document.getElementById('standalone-gpx-hud');
    if (hud) hud.classList.add('hidden');

    // Bouton actif
    const btnEdit = document.getElementById('btn-edit-gpx');
    if (btnEdit) {
      btnEdit.classList.add('ring-4', 'ring-violet-300', 'bg-violet-700');
    }

    // Sélectionner la trace active
    this.editingTrack = this.mapManager.standaloneHike || this.mapManager.standaloneTracks[0];
    
    // Backup coordonnées originales
    const poly = this.editingTrack.polyline;
    const rawLatLngs = poly.getLatLngs();
    // Aplatir si multi-segment
    const flatLatLngs = Array.isArray(rawLatLngs[0]) ? rawLatLngs.flat() : rawLatLngs;
    this.originalCoords = flatLatLngs.map(pt => [pt.lat, pt.lng, pt.alt || 0]);
    this.currentEditCoords = JSON.parse(JSON.stringify(this.originalCoords));

    // Générer les poignées de manipulation le long de la trace
    this.generateEditHandles();

    // Afficher le panneau flottant d'édition
    this.showEditFloatingPanel();
  }

  stopEditMode() {
    if (this.mode !== 'edit') return;
    this.mode = null;

    const btnEdit = document.getElementById('btn-edit-gpx');
    if (btnEdit) {
      btnEdit.classList.remove('ring-4', 'ring-violet-300', 'bg-violet-700');
    }

    // Réafficher le HUD si des traces standalone sont présentes
    const hud = document.getElementById('standalone-gpx-hud');
    if (hud && this.mapManager && this.mapManager.standaloneTracks && this.mapManager.standaloneTracks.length > 0) {
      hud.classList.remove('hidden');
    }

    // Nettoyer les poignées
    this.clearEditHandles();

    // Fermer panneau flottant
    if (this.editFloatingCard) {
      this.editFloatingCard.remove();
      this.editFloatingCard = null;
    }

    this.editingTrack = null;
  }

  generateEditHandles() {
    this.clearEditHandles();
    if (!this.map || !this.currentEditCoords || this.currentEditCoords.length < 2) return;

    const totalPts = this.currentEditCoords.length;
    // On sélectionne entre 12 et 25 poignées bien réparties le long du tracé
    const targetCount = Math.min(25, Math.max(10, Math.floor(totalPts / 15)));
    const step = Math.max(1, Math.floor(totalPts / targetCount));

    const handleIndices = [];
    for (let i = 0; i < totalPts; i += step) {
      handleIndices.push(i);
    }
    if (handleIndices[handleIndices.length - 1] !== totalPts - 1) {
      handleIndices.push(totalPts - 1);
    }

    handleIndices.forEach((idx, order) => {
      const coord = this.currentEditCoords[idx];
      const isStart = (idx === 0);
      const isEnd = (idx === totalPts - 1);
      
      const bgColor = isStart ? '#10b981' : (isEnd ? '#ef4444' : '#8b5cf6');
      const label = isStart ? 'D' : (isEnd ? 'A' : `${order}`);

      const marker = L.marker([coord[0], coord[1]], {
        draggable: true,
        icon: L.divIcon({
          className: 'custom-edit-handle',
          html: `
            <div style="background:${bgColor}; color:white; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:10px; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.5); cursor:grab;" title="Glissez ce point vers un sentier voisin pour dévier le tracé">
              ${label}
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      }).addTo(this.map);

      // Déplacement interactif de la poignée
      marker.on('dragend', async (e) => {
        const newPos = e.target.getLatLng();
        await this.handleEditHandleMoved(idx, [newPos.lat, newPos.lng], order, handleIndices);
      });

      this.editHandles.push({ index: idx, lat: coord[0], lon: coord[1], marker, order });
    });
  }

  clearEditHandles() {
    this.editHandles.forEach(h => {
      if (h.marker && this.map) this.map.removeLayer(h.marker);
    });
    this.editHandles = [];
  }

  async handleEditHandleMoved(handleIndex, newCoord, handleOrder, handleIndices) {
    if (!this.currentEditCoords || !this.editingTrack) return;

    // Identifier les poignées adjacentes pour recalculer la portion
    const prevHandle = handleOrder > 0 ? this.editHandles[handleOrder - 1] : null;
    const nextHandle = handleOrder < this.editHandles.length - 1 ? this.editHandles[handleOrder + 1] : null;

    if (this.editAutoRoute && prevHandle && nextHandle) {
      // Auto-routage entre [prevHandle -> newCoord -> nextHandle]
      const intermediatePts = [
        { lat: prevHandle.lat, lon: prevHandle.lon },
        { lat: newCoord[0], lon: newCoord[1] },
        { lat: nextHandle.lat, lon: nextHandle.lon }
      ];

      const reroutedSegment = await this.queryBRouter(intermediatePts);
      if (reroutedSegment && reroutedSegment.length > 0) {
        // Remplacer le segment existant dans currentEditCoords
        const startSlice = this.currentEditCoords.slice(0, prevHandle.index);
        const endSlice = this.currentEditCoords.slice(nextHandle.index + 1);
        this.currentEditCoords = [...startSlice, ...reroutedSegment, ...endSlice];
      } else {
        // Fallback déplacement direct du point
        this.currentEditCoords[handleIndex] = [newCoord[0], newCoord[1], 0];
      }
    } else {
      // Déplacement direct
      this.currentEditCoords[handleIndex] = [newCoord[0], newCoord[1], 0];
    }

    // Mettre à jour la polyline sur la carte
    const latlngs = this.currentEditCoords.map(c => [c[0], c[1]]);
    if (this.editingTrack.polyline) {
      this.editingTrack.polyline.setLatLngs(latlngs);
    }

    // Recalculer les poignées pour les réaligner
    this.generateEditHandles();

    // Mettre à jour les métriques
    const stats = this.computeTrackStats(this.currentEditCoords);
    this.editingTrack.distance = stats.distanceKm.toFixed(1);
    this.editingTrack.elevationGain = stats.elevationGain;

    const dEl = document.getElementById('gpx-edit-dist');
    if (dEl) dEl.innerText = `${stats.distanceKm.toFixed(2)} km`;
    const eEl = document.getElementById('gpx-edit-ele');
    if (eEl) eEl.innerText = `+${stats.elevationGain} m`;

    if (typeof this.mapManager.updateStandaloneGpxHud === 'function') {
      this.mapManager.updateStandaloneGpxHud();
    }
  }

  showEditFloatingPanel() {
    if (this.editFloatingCard) this.editFloatingCard.remove();

    const parent = document.getElementById('map-column') || document.getElementById('main-map-app-container') || document.body;
    const card = document.createElement('div');
    card.id = 'gpx-editor-floating-panel';
    card.className = 'absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border-2 border-violet-400 backdrop-blur-md w-[92%] max-w-lg transition-all animate-in fade-in slide-in-from-top-3 duration-200';

    const currentStats = this.computeTrackStats(this.currentEditCoords);

    card.innerHTML = `
      <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div class="flex items-center gap-2">
          <span class="text-xl">🛠️</span>
          <span class="font-extrabold text-sm sm:text-base text-violet-300">Modification de Trace GPX</span>
        </div>
        <button id="btn-close-gpx-editor" type="button" class="text-slate-400 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800" title="Quitter le mode édition">✕</button>
      </div>

      <div class="text-xs text-slate-300 mb-2.5 bg-slate-800/80 p-2 rounded-xl flex items-center justify-between gap-2 border border-slate-700/60">
        <span class="leading-tight">👉 <strong>Faites glisser une poignée ronde</strong> vers un sentier voisin pour dévier le tracé.</span>
        <button id="btn-toggle-edit-autoroute" type="button" class="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${this.editAutoRoute ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'}" title="Activer/désactiver l'auto-routage sur les sentiers voisins">
          ${this.editAutoRoute ? '🥾 Auto-routage : OUI' : '📏 Glisser simple'}
        </button>
      </div>

      <div class="grid grid-cols-2 gap-2 mb-3 text-center">
        <div class="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
          <span class="text-[10px] text-slate-400 block font-semibold uppercase">Distance modifiée</span>
          <span id="gpx-edit-dist" class="text-sm sm:text-base font-black text-violet-400">${currentStats.distanceKm.toFixed(2)} km</span>
        </div>
        <div class="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
          <span class="text-[10px] text-slate-400 block font-semibold uppercase">Dénivelé D+ recalculé</span>
          <span id="gpx-edit-ele" class="text-sm sm:text-base font-black text-emerald-400">+${currentStats.elevationGain} m</span>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
        <button id="btn-reset-edited-track" type="button" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5" title="Annuler toutes les modifications">
          <span>↶</span> <span>Rétablir l'original</span>
        </button>
        <button id="btn-export-edited-gpx" type="button" class="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-black rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer">
          <span>💾</span> <span>Télécharger le GPX modifié</span>
        </button>
      </div>
    `;

    parent.appendChild(card);
    this.editFloatingCard = card;

    // Événements du panneau
    document.getElementById('btn-close-gpx-editor')?.addEventListener('click', () => this.stopEditMode());
    document.getElementById('btn-toggle-edit-autoroute')?.addEventListener('click', () => {
      this.editAutoRoute = !this.editAutoRoute;
      const b = document.getElementById('btn-toggle-edit-autoroute');
      if (b) {
        b.className = `px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${this.editAutoRoute ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'}`;
        b.innerHTML = this.editAutoRoute ? '🥾 Auto-routage : OUI' : '📏 Glisser simple';
      }
    });
    document.getElementById('btn-reset-edited-track')?.addEventListener('click', () => this.resetEditTrack());
    document.getElementById('btn-export-edited-gpx')?.addEventListener('click', () => this.exportEditedGpx());
  }

  resetEditTrack() {
    if (!this.editingTrack || !this.originalCoords || this.originalCoords.length === 0) return;
    this.currentEditCoords = JSON.parse(JSON.stringify(this.originalCoords));
    const latlngs = this.currentEditCoords.map(c => [c[0], c[1]]);
    if (this.editingTrack.polyline) {
      this.editingTrack.polyline.setLatLngs(latlngs);
    }
    this.generateEditHandles();
    const stats = this.computeTrackStats(this.currentEditCoords);
    this.editingTrack.distance = stats.distanceKm.toFixed(1);
    this.editingTrack.elevationGain = stats.elevationGain;

    const dEl = document.getElementById('gpx-edit-dist');
    if (dEl) dEl.innerText = `${stats.distanceKm.toFixed(2)} km`;
    const eEl = document.getElementById('gpx-edit-ele');
    if (eEl) eEl.innerText = `+${stats.elevationGain} m`;
  }

  exportEditedGpx() {
    if (!this.editingTrack || !this.currentEditCoords || this.currentEditCoords.length < 2) return;
    const name = `${this.editingTrack.name || 'Trace'}_modifiee`;
    const gpx = this.generateGpxXml(name, this.currentEditCoords, []);
    this.downloadGpxFile(`${name}.gpx`, gpx);
    this.stopEditMode();
  }

  // =========================================================================
  // 3. UTILITAIRES : BRouter, Calculs Métriques & XML GPX
  // =========================================================================

  async queryBRouter(waypoints) {
    if (!waypoints || waypoints.length < 2) return null;
    const lonlats = waypoints.map(wp => `${wp.lon.toFixed(6)},${wp.lat.toFixed(6)}`).join('|');
    const url = `${this.brouterBase}?lonlats=${lonlats}&profile=${this.routingProfile}&alternativeidx=0&format=geojson`;

    try {
      const resp = await fetch(url, { headers: { 'Accept': 'application/geo+json' } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data && data.features && data.features[0] && data.features[0].geometry) {
        // BRouter renvoie [lon, lat, ele]
        return data.features[0].geometry.coordinates.map(pt => [pt[1], pt[0], pt[2] || 0]);
      }
    } catch (err) {
      console.warn("BRouter routing warning (fallback to straight line):", err);
    }
    return null;
  }

  computeTrackStats(coords) {
    let distMeters = 0;
    let dPlus = 0;

    for (let i = 1; i < coords.length; i++) {
      const p1 = coords[i - 1];
      const p2 = coords[i];

      // Distance haversine
      const d = this.haversineDistance(p1[0], p1[1], p2[0], p2[1]);
      distMeters += d;

      // Dénivelé
      const ele1 = p1[2] || 0;
      const ele2 = p2[2] || 0;
      if (ele2 > ele1) {
        dPlus += (ele2 - ele1);
      }
    }

    return {
      distanceKm: distMeters / 1000,
      elevationGain: Math.round(dPlus)
    };
  }

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // mètres
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  generateGpxXml(trackName, coords, waypoints) {
    const now = new Date().toISOString();
    let wptXml = '';
    if (waypoints && waypoints.length > 0) {
      wptXml = waypoints.map(wp => `
  <wpt lat="${wp.lat.toFixed(6)}" lon="${wp.lon.toFixed(6)}">
    <name>Point ${wp.letter || ''}</name>
  </wpt>`).join('');
    }

    const trkptXml = coords.map(c => `
      <trkpt lat="${c[0].toFixed(6)}" lon="${c[1].toFixed(6)}">
        <ele>${(c[2] || 0).toFixed(1)}</ele>
        <time>${now}</time>
      </trkpt>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="Map &amp; Rando by JLDApps 2026" version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${trackName}</name>
    <author>
      <name>JLDApps - Map &amp; Rando</name>
    </author>
    <time>${now}</time>
  </metadata>${wptXml}
  <trk>
    <name>${trackName}</name>
    <trkseg>${trkptXml}
    </trkseg>
  </trk>
</gpx>`;
  }

  downloadGpxFile(filename, content) {
    const blob = new Blob([content], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Instance globale
window.GpxCreatorEditorInstance = new GpxCreatorEditor();
