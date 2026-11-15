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
    this.createHistory = [];          // Historique pour annulation (Ctrl+Z)

    // État Édition
    this.editingTrack = null;         // Reference vers la trace dans standaloneTracks
    this.originalCoords = [];         // Backup pour annulation
    this.editHandles = [];            // [{ index, lat, lon, marker }]
    this.editPolyline = null;
    this.editAutoRoute = true;
    this.editFloatingCard = null;
    this.isProcessingEdit = false;
    this.editHistory = [];            // Historique pour annulation (Ctrl+Z)
    this._undoToastTimer = null;

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

    // Raccourci universel clavier CTRL+Z / CMD+Z pour annuler la dernière opération
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        if (document.activeElement && (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable)) {
          return;
        }
        if (this.mode === 'create') {
          e.preventDefault();
          e.stopPropagation();
          this.undoLastCreateOperation();
        } else if (this.mode === 'edit') {
          e.preventDefault();
          e.stopPropagation();
          this.undoLastEditOperation();
        }
      }
    });

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
    card.className = 'absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border-2 border-sky-400 backdrop-blur-md w-[92%] max-w-lg';
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

      <div class="grid grid-cols-3 gap-2 mb-2 text-center">
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

      <!-- Ruban visuel de succession des étapes (A -> B -> C -> D) avec suppression directe 1-clic -->
      <div id="gpx-create-waypoints-list" class="my-2 bg-slate-950/80 p-2 rounded-xl border border-slate-800 text-xs flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto">
        <span class="text-[11px] text-slate-500 italic">👉 Cliquez sur la carte pour poser les étapes successives (A, B, C...)</span>
      </div>

      <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
        <button id="btn-undo-create-point" type="button" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5" title="Annuler la dernière opération (Ctrl+Z)">
          <span>↶</span> <span>Annuler (Ctrl+Z)</span>
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

      <div class="text-[11px] text-sky-200 mt-2 bg-sky-950/70 px-3 py-1.5 rounded-xl border border-sky-800/80 flex items-center justify-between gap-2">
        <span class="leading-tight">🖐️ <strong>Déplacez n'importe quelle lettre avec la souris</strong> pour ajuster l'itinéraire.</span>
        <span class="text-[10px] text-sky-300 font-semibold whitespace-nowrap">Annuler : <strong>Ctrl+Z</strong></span>
      </div>
    `;

    parent.appendChild(card);
    this.createFloatingCard = card;
    window.FloatingWindowManagerInstance?.enhance(card);

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
    document.getElementById('btn-undo-create-point')?.addEventListener('click', () => this.undoLastCreateOperation());
    document.getElementById('btn-reset-create-points')?.addEventListener('click', () => this.resetCreatePoints());
    document.getElementById('btn-export-created-gpx')?.addEventListener('click', () => this.exportCreatedGpx());
  }

  saveCreateHistorySnapshot() {
    if (!this.createHistory) this.createHistory = [];
    const snapshot = this.createWaypoints.map(w => ({ lat: w.lat, lon: w.lon }));
    this.createHistory.push(snapshot);
    if (this.createHistory.length > 30) this.createHistory.shift();
  }

  createWaypointObject(latlng) {
    const index = this.createWaypoints.length;
    const letter = String.fromCharCode(65 + index);
    const isStart = index === 0;
    const bgColor = isStart ? '#10b981' : '#0284c7';

    const marker = L.marker([latlng.lat, latlng.lng], {
      draggable: true,
      icon: L.divIcon({
        className: 'custom-wp-pin',
        html: `
          <div style="background:${bgColor}; color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:13px; border:2.5px solid white; box-shadow:0 4px 10px rgba(0,0,0,0.5); cursor:grab;">
            ${letter}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    }).addTo(this.map);

    const wp = { lat: latlng.lat, lon: latlng.lng, marker, letter };

    // Sauvegarder l'état au tout début du glissement pour que Ctrl+Z permette de revenir en arrière
    marker.on('dragstart', (e) => {
      this.isDraggingWaypoint = true;
      this.saveCreateHistorySnapshot();
      if (e && e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
    });

    marker.on('drag', (e) => {
      const pos = e.target.getLatLng();
      wp.lat = pos.lat;
      wp.lon = pos.lng;
      if (this.createPolyline && this.createWaypoints.length >= 2) {
        this.createPolyline.setLatLngs(this.createWaypoints.map(p => [p.lat, p.lon]));
      }
    });

    marker.on('dragend', async (e) => {
      const pos = e.target.getLatLng();
      wp.lat = pos.lat;
      wp.lon = pos.lng;
      await this.recalculateCreatedRoute();
      setTimeout(() => {
        this.isDraggingWaypoint = false;
      }, 350);
    });

    marker.on('click', (e) => {
      if (e && e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
    });

    marker.on('mousedown', (e) => {
      if (e && e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
    });

    marker.on('contextmenu', (e) => {
      if (e && e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
      this.removeCreateWaypoint(wp);
    });

    return wp;
  }

  async handleCreateMapClick(latlng) {
    if (this.mode !== 'create' || !this.map || this.isDraggingWaypoint) return;

    this.saveCreateHistorySnapshot();
    const wp = this.createWaypointObject(latlng);
    this.createWaypoints.push(wp);
    this.updateWaypointIcons();
    await this.recalculateCreatedRoute();
  }

  updateWaypointIcons() {
    const total = this.createWaypoints.length;
    this.createWaypoints.forEach((wp, idx) => {
      const letter = String.fromCharCode(65 + idx);
      wp.letter = letter;
      const isStart = idx === 0;
      const isEnd = idx === total - 1 && total > 1;
      const bgColor = isStart ? '#10b981' : (isEnd ? '#ef4444' : '#0284c7');
      const roleLabel = isStart ? 'Départ' : (isEnd ? 'Arrivée' : 'Étape');

      wp.marker.setIcon(L.divIcon({
        className: 'custom-wp-pin',
        html: `
          <div style="background:${bgColor}; color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:13px; border:2.5px solid white; box-shadow:0 4px 10px rgba(0,0,0,0.5); cursor:grab;">
            ${letter}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      }));

      wp.marker.setTooltipContent(`📍 Point <strong>${letter}</strong> (${roleLabel})<br><span style="font-size:10px; color:#cbd5e1;">Glissez pour déplacer • Clic droit = supprimer</span>`);

      // Popup au clic avec suppression directe de l'étape
      wp.marker.bindPopup(`
        <div style="font-family:sans-serif; text-align:center; min-width:140px; padding:3px;">
          <div style="font-weight:900; color:${bgColor}; font-size:14px;">Point ${letter}</div>
          <div style="font-size:11px; color:#475569; margin-bottom:5px;">${isStart ? 'Point de Départ' : (isEnd ? 'Point d\'Arrivée' : 'Étape intermédiaire')}</div>
          <div style="font-size:10px; color:#64748b; margin-bottom:8px;">Glissez pour déplacer vers un autre chemin</div>
          ${total > 1 ? `<button type="button" class="btn-popup-del-wp" style="background:#ef4444; color:white; border:none; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:11px; cursor:pointer; width:100%; box-shadow:0 2px 4px rgba(0,0,0,0.2);">🗑️ Supprimer ce point (${letter})</button>` : ''}
        </div>
      `, { offset: [0, -14] });

      wp.marker.off('popupopen');
      wp.marker.on('popupopen', (popEvt) => {
        const popEl = popEvt.popup.getElement();
        if (popEl) {
          const btn = popEl.querySelector('.btn-popup-del-wp');
          if (btn) {
            btn.onclick = (be) => {
              be.stopPropagation();
              this.removeCreateWaypoint(wp);
            };
          }
        }
      });
    });

    this.updateWaypointsListUI();
  }

  updateWaypointsListUI() {
    const listEl = document.getElementById('gpx-create-waypoints-list');
    if (!listEl) return;

    const total = this.createWaypoints.length;
    if (total === 0) {
      listEl.innerHTML = `<span class="text-[11px] text-slate-500 italic">👉 Cliquez sur la carte pour poser les étapes successives (A, B, C...)</span>`;
      return;
    }

    let html = '';
    this.createWaypoints.forEach((wp, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === total - 1 && total > 1;
      const letter = String.fromCharCode(65 + idx);

      let colorClass = 'bg-sky-950/80 text-sky-300 border-sky-700/60';
      let roleLabel = 'Étape';
      if (isStart) {
        colorClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60';
        roleLabel = 'Départ';
      } else if (isEnd) {
        colorClass = 'bg-rose-950/80 text-rose-300 border-rose-700/60';
        roleLabel = 'Arrivée';
      }

      html += `
        <div class="flex items-center gap-1.5 px-2 py-1 rounded-lg border ${colorClass} text-[11px] font-bold shadow-sm select-none" title="Waypoint ${letter} (${roleLabel})">
          <span class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isStart ? 'bg-emerald-600' : (isEnd ? 'bg-rose-600' : 'bg-sky-600')} text-white">${letter}</span>
          <span class="text-[10px] opacity-80 font-medium">${roleLabel}</span>
          ${wp.isBacktrack ? `<span class="px-1 py-0.5 rounded bg-amber-500/30 text-amber-300 text-[9px] border border-amber-500/50 font-bold" title="Demi-tour forcé : supprimez ou déplacez l'étape suivante (${wp.backtrackNext}) pour filer tout droit">↩️ Demi-tour</span>` : ''}
          ${total > 1 ? `
            <button type="button" class="btn-delete-wp ml-1 text-slate-400 hover:text-white hover:bg-rose-600 rounded px-1.5 py-0.5 transition-colors font-black text-xs leading-none" data-idx="${idx}" title="Supprimer l'étape ${letter}">✕</button>
          ` : ''}
        </div>
      `;

      if (idx < total - 1) {
        html += `<span class="text-slate-600 text-xs font-bold select-none">➔</span>`;
      }
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll('.btn-delete-wp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (!isNaN(idx) && this.createWaypoints[idx]) {
          this.removeCreateWaypoint(this.createWaypoints[idx]);
        }
      });
    });
  }

  removeCreateWaypoint(wp) {
    if (!wp || !this.map) return;
    this.saveCreateHistorySnapshot();
    if (wp.marker) this.map.removeLayer(wp.marker);
    const idx = this.createWaypoints.indexOf(wp);
    if (idx !== -1) {
      this.createWaypoints.splice(idx, 1);
    }
    this.updateWaypointIcons();
    this.recalculateCreatedRoute();
  }

  async recalculateCreatedRoute() {
    if (!this.map) return;
    const pts = this.createWaypoints;

    // Mise à jour compteur waypoints & ruban d'étapes
    const ptsEl = document.getElementById('gpx-create-pts');
    if (ptsEl) ptsEl.innerText = pts.length;
    this.updateWaypointsListUI();

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
      // Routage automatique via BRouter / IGN
      coords = await this.queryBRouter(pts);
      // Fallback ligne droite si renvoie vide
      if (!coords || coords.length === 0) {
        coords = pts.map(p => [p.lat, p.lon, 0]);
      }
    } else {
      // Ligne droite point à point
      coords = pts.map(p => [p.lat, p.lon, 0]);
    }

    // Actualiser le ruban d'étapes (affiche d'éventuels badges [↩️ Demi-tour])
    this.updateWaypointsListUI();

    // Message d'alerte pédagogique si un demi-tour / antenne est détecté
    const backtrackWp = pts.find(p => p.isBacktrack);
    if (backtrackWp && tipEl) {
      tipEl.innerHTML = `⚠️ <strong class="text-amber-300">Demi-tour forcé au point ${backtrackWp.letter}</strong> : l'étape suivante (<strong>${backtrackWp.backtrackNext}</strong>) est restée sur l'autre chemin. Supprimez-la (bouton ✕) ou déplacez-la.`;
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

  async undoLastCreateOperation() {
    if (!this.createHistory || this.createHistory.length === 0) {
      if (this.createWaypoints.length > 0) {
        const last = this.createWaypoints.pop();
        if (last && last.marker && this.map) this.map.removeLayer(last.marker);
        this.updateWaypointIcons();
        await this.recalculateCreatedRoute();
        this.showUndoFeedback("Dernier point retiré");
      } else {
        this.showUndoFeedback("Aucune opération à annuler");
      }
      return;
    }
    const prevSnapshot = this.createHistory.pop();
    // Nettoyer tous les marqueurs actuels
    this.createWaypoints.forEach(wp => {
      if (wp.marker && this.map) this.map.removeLayer(wp.marker);
    });
    this.createWaypoints = [];
    // Recréer chaque waypoint
    prevSnapshot.forEach(pt => {
      const wp = this.createWaypointObject(L.latLng(pt.lat, pt.lon));
      this.createWaypoints.push(wp);
    });
    this.updateWaypointIcons();
    await this.recalculateCreatedRoute();
    this.showUndoFeedback("Opération annulée (Ctrl+Z)");
  }

  undoLastCreatePoint() {
    this.undoLastCreateOperation();
  }

  resetCreatePoints() {
    if (this.createWaypoints.length === 0) return;
    this.saveCreateHistorySnapshot();
    this.createWaypoints.forEach(wp => {
      if (wp.marker && this.map) this.map.removeLayer(wp.marker);
    });
    this.createWaypoints = [];
    this.recalculateCreatedRoute();
    this.showUndoFeedback("Tous les points ont été effacés (Ctrl+Z pour restaurer)");
  }

  async exportCreatedGpx() {
    if (this.createRouteCoords.length < 2) return;
    const defaultName = await this.buildProposedGpxName(this.createRouteCoords);

    // Boîte de dialogue pour valider ou personnaliser le nom avant l'export
    const chosenName = await this.promptGpxFilename(defaultName, 'sky');
    if (!chosenName) return;

    const gpx = this.generateGpxXml(chosenName, this.createRouteCoords, this.createWaypoints);
    this.downloadGpxFile(`${chosenName}.gpx`, gpx);

    // Charger immédiatement le parcours créé dans MapManager pour qu'il soit affiché
    if (this.mapManager && typeof this.mapManager.loadStandaloneGpxContent === 'function') {
      this.mapManager.loadStandaloneGpxContent(gpx, `${chosenName}.gpx`);
    }

    this.showUndoFeedback(`Trace exportée : ${chosenName}.gpx`);
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

    // Sauvegarder l'état au démarrage du mode édition
    this.editHistory = [];

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

    // Nettoyer les poignées et le mode découpe
    this.stopBoxCutMode();
    this.clearEditHandles();
    this.clearGapDashedLine();

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
      marker.on('dragstart', (e) => {
        this.saveEditHistorySnapshot();
        if (e && e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
      });

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
    if (!this.currentEditCoords || !this.editingTrack || this.isProcessingEdit) return;

    this.isProcessingEdit = true;
    const statusEl = document.getElementById('gpx-edit-status');
    if (statusEl) statusEl.classList.remove('hidden');

    try {
      // Identifier les poignées adjacentes pour recalculer la portion
      const prevHandle = handleOrder > 0 ? this.editHandles[handleOrder - 1] : null;
      const nextHandle = handleOrder < this.editHandles.length - 1 ? this.editHandles[handleOrder + 1] : null;

      let routeSuccess = false;

      if (this.editAutoRoute && (prevHandle || nextHandle)) {
        let intermediatePts = [];
        let isStart = false;
        let isEnd = false;

        if (prevHandle && nextHandle) {
          // Point intermédiaire : relier [prevHandle -> newCoord -> nextHandle]
          intermediatePts = [
            { lat: prevHandle.lat, lon: prevHandle.lon },
            { lat: newCoord[0], lon: newCoord[1] },
            { lat: nextHandle.lat, lon: nextHandle.lon }
          ];
        } else if (!prevHandle && nextHandle) {
          // Point de départ (D) : relier [newCoord -> nextHandle]
          isStart = true;
          intermediatePts = [
            { lat: newCoord[0], lon: newCoord[1] },
            { lat: nextHandle.lat, lon: nextHandle.lon }
          ];
        } else if (prevHandle && !nextHandle) {
          // Point d'arrivée (A) : relier [prevHandle -> newCoord]
          isEnd = true;
          intermediatePts = [
            { lat: prevHandle.lat, lon: prevHandle.lon },
            { lat: newCoord[0], lon: newCoord[1] }
          ];
        }

        // Requête BRouter multi-profils (sentiers, chemins, routes)
        const reroutedSegment = await this.queryBRouter(intermediatePts);
        if (reroutedSegment && reroutedSegment.length > 0) {
          routeSuccess = true;
          if (isStart) {
            // Remplacer du début jusqu'à nextHandle inclus
            const endSlice = this.currentEditCoords.slice(nextHandle.index + 1);
            this.currentEditCoords = [...reroutedSegment, ...endSlice];
          } else if (isEnd) {
            // Remplacer de prevHandle jusqu'à la fin
            const startSlice = this.currentEditCoords.slice(0, prevHandle.index);
            this.currentEditCoords = [...startSlice, ...reroutedSegment];
          } else {
            // Remplacer la portion entre prevHandle et nextHandle
            const startSlice = this.currentEditCoords.slice(0, prevHandle.index);
            const endSlice = this.currentEditCoords.slice(nextHandle.index + 1);
            this.currentEditCoords = [...startSlice, ...reroutedSegment, ...endSlice];
          }
        }
      }

      if (!routeSuccess) {
        // Fallback déplacement direct
        if (handleOrder === 0) {
          this.currentEditCoords[0] = [newCoord[0], newCoord[1], 0];
        } else if (handleOrder === this.editHandles.length - 1) {
          this.currentEditCoords[this.currentEditCoords.length - 1] = [newCoord[0], newCoord[1], 0];
        } else if (handleIndex >= 0 && handleIndex < this.currentEditCoords.length) {
          this.currentEditCoords[handleIndex] = [newCoord[0], newCoord[1], 0];
        }
      }

      // Mettre à jour l'affichage de la trace modifiée et ses métriques
      this.updateEditedTrackDisplay();
    } catch (err) {
      console.error("Erreur lors du déplacement de poignée GPX:", err);
    } finally {
      this.isProcessingEdit = false;
      if (statusEl) statusEl.classList.add('hidden');
    }
  }

  showEditFloatingPanel() {
    if (this.editFloatingCard) this.editFloatingCard.remove();

    const parent = document.getElementById('map-column') || document.getElementById('main-map-app-container') || document.body;
    const card = document.createElement('div');
    card.id = 'gpx-editor-floating-panel';
    card.className = 'absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border-2 border-violet-400 backdrop-blur-md w-[92%] max-w-lg';

    const currentStats = this.computeTrackStats(this.currentEditCoords);

    card.innerHTML = `
      <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div class="flex items-center gap-2">
          <span class="text-xl">🛠️</span>
          <span class="font-extrabold text-sm sm:text-base text-violet-300">Modification de Trace GPX</span>
        </div>
        <button id="btn-close-gpx-editor" type="button" class="text-slate-400 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800" title="Quitter le mode édition">✕</button>
      </div>

      <div class="text-xs text-slate-300 mb-2.5 bg-slate-800/80 p-2 rounded-xl flex items-center justify-between gap-2 border border-slate-700/60 flex-wrap">
        <span id="gpx-editor-tip" class="leading-tight">👉 <strong>Faites glisser une poignée</strong> ou utilisez <strong>Supprimer zone</strong>.</span>
        <div class="flex items-center gap-1.5 ml-auto">
          <button id="btn-box-cut-track" type="button" class="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/80 text-rose-300 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1 shadow-sm cursor-pointer" title="Sélectionner une portion de trace à supprimer avec un rectangle (clic maintenu + glisser)">
            <span>✂️</span> <span>Supprimer zone</span>
          </button>
          <button id="btn-toggle-edit-autoroute" type="button" class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${this.editAutoRoute ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'}" title="Activer/désactiver l'auto-routage sur les sentiers voisins">
            ${this.editAutoRoute ? '🥾 Auto-routage : OUI' : '📏 Glisser simple'}
          </button>
        </div>
      </div>

      <!-- Bandeau interactif de reconnexion de tronçon coupé -->
      <div id="gpx-edit-reconnect-bar" class="text-xs text-amber-200 bg-amber-950/90 p-2.5 rounded-xl border border-amber-700/80 mb-2 hidden flex items-center justify-between gap-2 shadow-lg animate-in fade-in">
        <span id="gpx-edit-reconnect-msg" class="leading-tight text-left">✂️ <strong>Tronçon supprimé</strong>. Relier les 2 extrémités ?</span>
        <button id="btn-reconnect-split-track" type="button" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black shadow transition whitespace-nowrap cursor-pointer">
          🥾 Relier par sentiers
        </button>
      </div>

      <div id="gpx-edit-status" class="text-xs text-center text-violet-300 font-semibold mb-2 hidden bg-violet-950/80 p-2 rounded-xl border border-violet-800 animate-pulse">
        🔄 <strong>Calcul du tracé en cours...</strong> Ajustement automatique sur les sentiers et routes.
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
        <div class="flex items-center gap-1.5">
          <button id="btn-undo-edit-point" type="button" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5" title="Annuler la dernière modification (Ctrl+Z)">
            <span>↶</span> <span>Annuler (Ctrl+Z)</span>
          </button>
          <button id="btn-reset-edited-track" type="button" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 text-xs font-bold rounded-xl transition" title="Rétablir le tracé d'origine">
            <span>Rétablir l'original</span>
          </button>
        </div>
        <button id="btn-export-edited-gpx" type="button" class="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-black rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer">
          <span>💾</span> <span>Télécharger le GPX modifié</span>
        </button>
      </div>

      <div class="text-[11px] text-violet-200 mt-2 bg-violet-950/70 px-3 py-1.5 rounded-xl border border-violet-800/80 flex items-center justify-between gap-2">
        <span class="leading-tight">🖐️ <strong>Glissez une poignée</strong> ou <strong>supprimez une zone par rectangle</strong>.</span>
        <span class="text-[10px] text-violet-300 font-semibold whitespace-nowrap">Annuler : <strong>Ctrl+Z</strong></span>
      </div>
    `;

    parent.appendChild(card);
    this.editFloatingCard = card;
    window.FloatingWindowManagerInstance?.enhance(card);

    // Événements du panneau
    document.getElementById('btn-close-gpx-editor')?.addEventListener('click', () => this.stopEditMode());
    document.getElementById('btn-box-cut-track')?.addEventListener('click', () => this.toggleBoxCutMode());
    document.getElementById('btn-reconnect-split-track')?.addEventListener('click', () => this.reconnectCutParts());
    document.getElementById('btn-toggle-edit-autoroute')?.addEventListener('click', () => {
      this.editAutoRoute = !this.editAutoRoute;
      const b = document.getElementById('btn-toggle-edit-autoroute');
      if (b) {
        b.className = `px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${this.editAutoRoute ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'}`;
        b.innerHTML = this.editAutoRoute ? '🥾 Auto-routage : OUI' : '📏 Glisser simple';
      }
    });
    document.getElementById('btn-undo-edit-point')?.addEventListener('click', () => this.undoLastEditOperation());
    document.getElementById('btn-reset-edited-track')?.addEventListener('click', () => this.resetEditTrack());
    document.getElementById('btn-export-edited-gpx')?.addEventListener('click', () => this.exportEditedGpx());
  }

  toggleBoxCutMode() {
    if (this._isBoxCutMode) {
      this.stopBoxCutMode();
    } else {
      this.startBoxCutMode();
    }
  }

  startBoxCutMode() {
    this._isBoxCutMode = true;
    const btn = document.getElementById('btn-box-cut-track');
    if (btn) {
      btn.className = 'px-2.5 py-1 bg-rose-600 text-white border border-rose-400 ring-2 ring-rose-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1 shadow-sm cursor-pointer';
      btn.innerHTML = '<span>✕</span> <span>Annuler découpe</span>';
    }
    const tip = document.getElementById('gpx-editor-tip');
    if (tip) {
      tip.innerHTML = '✂️ <strong>Tracez un rectangle</strong> (clic maintenu + glisser) sur la zone à couper.';
    }

    if (this.map && this.map.dragging) this.map.dragging.disable();
    const container = this.map ? this.map.getContainer() : null;
    if (container) container.style.cursor = 'crosshair';

    // Rendre les marqueurs et poignées transparents aux clics pendant la découpe
    const markerPane = this.map ? this.map.getPane('markerPane') : null;
    if (markerPane) markerPane.style.pointerEvents = 'none';

    let startLatLng = null;
    let tempRect = null;

    this._onBoxCutMouseDown = (e) => {
      const latlng = e.latlng || (this.map ? this.map.mouseEventToLatLng(e) : null);
      if (!latlng) return;
      startLatLng = latlng;

      if (tempRect && this.map) {
        this.map.removeLayer(tempRect);
        tempRect = null;
      }
      tempRect = L.rectangle([startLatLng, startLatLng], {
        interactive: false,
        color: '#f43f5e',
        weight: 2,
        dashArray: '4, 4',
        fillColor: '#f43f5e',
        fillOpacity: 0.25
      }).addTo(this.map);

      const onMouseMove = (ev) => {
        if (!startLatLng || !tempRect || !this.map) return;
        try {
          const curLatLng = this.map.mouseEventToLatLng(ev);
          tempRect.setBounds(L.latLngBounds(startLatLng, curLatLng));
        } catch (err) {}
      };

      const onMouseUp = async (ev) => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (!startLatLng || !this.map) return;
        let curLatLng = null;
        try {
          curLatLng = this.map.mouseEventToLatLng(ev);
        } catch (err) {
          curLatLng = startLatLng;
        }

        const bounds = L.latLngBounds(startLatLng, curLatLng);
        if (tempRect && this.map) {
          this.map.removeLayer(tempRect);
          tempRect = null;
        }
        startLatLng = null;
        this.stopBoxCutMode();

        // Appliquer la coupe si le rectangle a une diagonale d'au moins 5 mètres
        if (bounds.getNorthEast().distanceTo(bounds.getSouthWest()) > 5) {
          await this.applyBoxCut(bounds);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    if (this.map) {
      this.map.on('mousedown', this._onBoxCutMouseDown);
    }
  }

  stopBoxCutMode() {
    this._isBoxCutMode = false;
    const btn = document.getElementById('btn-box-cut-track');
    if (btn) {
      btn.className = 'px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/80 text-rose-300 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1 shadow-sm cursor-pointer';
      btn.innerHTML = '<span>✂️</span> <span>Supprimer zone</span>';
    }
    const tip = document.getElementById('gpx-editor-tip');
    if (tip) {
      tip.innerHTML = '👉 <strong>Faites glisser une poignée</strong> ou utilisez <strong>Supprimer zone</strong>.';
    }

    if (this.map) {
      if (this.map.dragging) this.map.dragging.enable();
      const container = this.map.getContainer();
      if (container) container.style.cursor = '';
      const markerPane = this.map.getPane('markerPane');
      if (markerPane) markerPane.style.pointerEvents = '';
      if (this._onBoxCutMouseDown) {
        this.map.off('mousedown', this._onBoxCutMouseDown);
        this._onBoxCutMouseDown = null;
      }
    }
  }

  showGapDashedLine(p1, p2) {
    this.clearGapDashedLine();
    if (!this.map) return;
    this._gapDashedLine = L.polyline([[p1.lat, p1.lon], [p2.lat, p2.lon]], {
      color: '#f59e0b',
      weight: 3.5,
      dashArray: '6, 8',
      opacity: 0.9,
      interactive: true
    }).addTo(this.map);
    this._gapDashedLine.bindTooltip("✂️ Portion coupée (en attente de raccordement)", {
      permanent: true,
      direction: 'center',
      className: 'bg-slate-900 text-amber-300 font-bold px-2 py-1 rounded text-xs border border-amber-500 shadow-md'
    });
  }

  clearGapDashedLine() {
    if (this._gapDashedLine && this.map) {
      this.map.removeLayer(this._gapDashedLine);
      this._gapDashedLine = null;
    }
  }

  async applyBoxCut(bounds) {
    if (!this.currentEditCoords || this.currentEditCoords.length < 2) return;

    const coords = this.currentEditCoords;
    const insideIndices = [];
    coords.forEach((c, idx) => {
      const isInside = bounds.contains(L.latLng(c[0], c[1]));
      if (isInside) {
        insideIndices.push(idx);
      }
    });

    if (insideIndices.length === 0) {
      this.showUndoFeedback("Aucun point de la trace dans le rectangle");
      return;
    }

    // Sauvegarder pour Ctrl+Z
    this.saveEditHistorySnapshot();

    const firstIdx = insideIndices[0];
    const lastIdx = insideIndices[insideIndices.length - 1];

    const part1 = coords.slice(0, firstIdx);
    const part2 = coords.slice(lastIdx + 1);

    if (part1.length > 0 && part2.length > 0) {
      // Coupe en plein milieu de la trace
      const p1 = { lat: part1[part1.length - 1][0], lon: part1[part1.length - 1][1] };
      const p2 = { lat: part2[0][0], lon: part2[0][1] };

      // Si l'auto-routage est actif (AUTO-ROUTAGE : OUI), calcul et raccordement 100% automatique immédiat par les sentiers réels !
      if (this.editAutoRoute) {
        const statusEl = document.getElementById('gpx-edit-status');
        if (statusEl) {
          statusEl.classList.remove('hidden');
          statusEl.innerHTML = `🔄 <strong>Auto-routage...</strong> Raccordement automatique par les sentiers (${insideIndices.length} points coupés).`;
        }

        let bridgeCoords = null;
        try {
          bridgeCoords = await this.querySingleLeg(p1, p2);
        } catch (err) {
          console.warn("Échec auto-routage raccordement direct :", err);
        } finally {
          if (statusEl) statusEl.classList.add('hidden');
        }

        if (bridgeCoords && bridgeCoords.length > 0) {
          this.currentEditCoords = [...part1, ...bridgeCoords, ...part2];
          this.clearGapDashedLine();
          this.updateEditedTrackDisplay();
          this.showUndoFeedback(`✂️ ${insideIndices.length} pts coupés & raccordé par les sentiers (${bridgeCoords.length} pts) ! (Ctrl+Z pour annuler)`);

          const reconnectBar = document.getElementById('gpx-edit-reconnect-bar');
          if (reconnectBar) reconnectBar.classList.add('hidden');
          this._lastCutPart1End = null;
          this._lastCutPart2Start = null;
          this._lastCutIndex = null;
          return;
        }
      }

      // Si auto-routage inactif (mode manuel) ou si aucun sentier n'a pu relier p1 et p2 :
      this.currentEditCoords = [...part1, ...part2];
      this._lastCutPart1End = part1[part1.length - 1];
      this._lastCutPart2Start = part2[0];
      this._lastCutIndex = part1.length;

      // Afficher les deux morceaux séparés (sans trait plein continu trompeur à travers champ)
      if (this.editingTrack && this.editingTrack.polyline) {
        this.editingTrack.polyline.setLatLngs([
          part1.map(c => [c[0], c[1]]),
          part2.map(c => [c[0], c[1]])
        ]);
      }
      this.generateEditHandles();
      const stats = this.computeTrackStats(this.currentEditCoords);
      if (this.editingTrack) {
        this.editingTrack.distance = stats.distanceKm.toFixed(1);
        this.editingTrack.elevationGain = stats.elevationGain;
      }
      const dEl = document.getElementById('gpx-edit-dist');
      if (dEl) dEl.innerText = `${stats.distanceKm.toFixed(2)} km`;
      const eEl = document.getElementById('gpx-edit-ele');
      if (eEl) eEl.innerText = `+${stats.elevationGain} m`;

      // Afficher une ligne en pointillés orange très visible entre p1 et p2
      this.showGapDashedLine(p1, p2);

      this.showUndoFeedback(`✂️ Tronçon de ${insideIndices.length} points supprimé (en attente de raccordement)`);

      // Afficher le bandeau pour proposer de relier
      const reconnectBar = document.getElementById('gpx-edit-reconnect-bar');
      const reconnectMsg = document.getElementById('gpx-edit-reconnect-msg');
      if (reconnectBar) {
        reconnectBar.classList.remove('hidden');
        if (reconnectMsg) {
          reconnectMsg.innerHTML = `✂️ <strong>${insideIndices.length} points coupés</strong>. Relier les 2 extrémités ?`;
        }
      }
    } else if (part1.length > 0) {
      // Coupe en fin de parcours
      this.clearGapDashedLine();
      this.currentEditCoords = part1;
      this.updateEditedTrackDisplay();
      this.showUndoFeedback(`✂️ Fin de trace raccourcie (${insideIndices.length} points retirés)`);
    } else if (part2.length > 0) {
      // Coupe en début de parcours
      this.clearGapDashedLine();
      this.currentEditCoords = part2;
      this.updateEditedTrackDisplay();
      this.showUndoFeedback(`✂️ Début de trace raccourci (${insideIndices.length} points retirés)`);
    }
  }

  async reconnectCutParts() {
    if (!this._lastCutPart1End || !this._lastCutPart2Start || typeof this._lastCutIndex !== 'number') return;

    const p1 = { lat: this._lastCutPart1End[0], lon: this._lastCutPart1End[1] };
    const p2 = { lat: this._lastCutPart2Start[0], lon: this._lastCutPart2Start[1] };

    const statusEl = document.getElementById('gpx-edit-status');
    if (statusEl) {
      statusEl.classList.remove('hidden');
      statusEl.innerHTML = '🔄 <strong>Raccordement automatique en cours...</strong> Calcul de la nouvelle portion.';
    }

    this.saveEditHistorySnapshot();

    try {
      let bridgeCoords = null;
      if (this.editAutoRoute) {
        bridgeCoords = await this.querySingleLeg(p1, p2);
      }
      if (!bridgeCoords || bridgeCoords.length === 0) {
        bridgeCoords = [
          [p1.lat, p1.lon, this._lastCutPart1End[2] || 0],
          [p2.lat, p2.lon, this._lastCutPart2Start[2] || 0]
        ];
      }

      const part1 = this.currentEditCoords.slice(0, this._lastCutIndex);
      const part2 = this.currentEditCoords.slice(this._lastCutIndex);

      this.currentEditCoords = [...part1, ...bridgeCoords, ...part2];
      this.clearGapDashedLine();
      this.updateEditedTrackDisplay();
      this.showUndoFeedback("🔗 Nouvelle portion raccordée avec succès !");

      const reconnectBar = document.getElementById('gpx-edit-reconnect-bar');
      if (reconnectBar) reconnectBar.classList.add('hidden');
    } catch (err) {
      console.error("Erreur lors de la reconnexion de trace :", err);
    } finally {
      if (statusEl) statusEl.classList.add('hidden');
      this._lastCutPart1End = null;
      this._lastCutPart2Start = null;
      this._lastCutIndex = null;
    }
  }

  updateEditedTrackDisplay() {
    if (!this.currentEditCoords) return;
    const latlngs = this.currentEditCoords.map(c => [c[0], c[1]]);
    if (this.editingTrack && this.editingTrack.polyline) {
      this.editingTrack.polyline.setLatLngs(latlngs);
    }
    this.generateEditHandles();
    const stats = this.computeTrackStats(this.currentEditCoords);
    if (this.editingTrack) {
      this.editingTrack.distance = stats.distanceKm.toFixed(1);
      this.editingTrack.elevationGain = stats.elevationGain;
    }
    const dEl = document.getElementById('gpx-edit-dist');
    if (dEl) dEl.innerText = `${stats.distanceKm.toFixed(2)} km`;
    const eEl = document.getElementById('gpx-edit-ele');
    if (eEl) eEl.innerText = `+${stats.elevationGain} m`;
    if (typeof this.mapManager?.updateStandaloneGpxHud === 'function') {
      this.mapManager.updateStandaloneGpxHud();
    }
  }

  saveEditHistorySnapshot() {
    if (!this.editHistory) this.editHistory = [];
    if (!this.currentEditCoords) return;
    this.editHistory.push(JSON.parse(JSON.stringify(this.currentEditCoords)));
    if (this.editHistory.length > 30) this.editHistory.shift();
  }

  undoLastEditOperation() {
    if (!this.editHistory || this.editHistory.length === 0) {
      this.showUndoFeedback("Aucune modification antérieure à annuler");
      return;
    }
    const prevCoords = this.editHistory.pop();
    this.currentEditCoords = prevCoords;
    this.clearGapDashedLine();
    this.updateEditedTrackDisplay();

    const reconnectBar = document.getElementById('gpx-edit-reconnect-bar');
    if (reconnectBar) reconnectBar.classList.add('hidden');
    this._lastCutPart1End = null;
    this._lastCutPart2Start = null;
    this._lastCutIndex = null;

    this.showUndoFeedback("Modification annulée (Ctrl+Z)");
  }

  resetEditTrack() {
    if (!this.editingTrack || !this.originalCoords || this.originalCoords.length === 0) return;
    this.saveEditHistorySnapshot();
    this.clearGapDashedLine();
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
    this.showUndoFeedback("Tracé original rétabli (Ctrl+Z pour annuler)");
  }

  showUndoFeedback(msg) {
    let toast = document.getElementById('gpx-undo-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'gpx-undo-toast';
      toast.className = 'fixed bottom-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white border border-sky-400 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl backdrop-blur-md transition-opacity duration-200 pointer-events-none flex items-center gap-2';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="text-amber-400 text-sm">↶</span> <span>${msg}</span>`;
    toast.style.opacity = '1';
    if (this._undoToastTimer) clearTimeout(this._undoToastTimer);
    this._undoToastTimer = setTimeout(() => {
      if (toast) toast.style.opacity = '0';
    }, 1600);
  }

  async exportEditedGpx() {
    if (!this.editingTrack || !this.currentEditCoords || this.currentEditCoords.length < 2) return;
    const defaultName = await this.buildProposedGpxName(this.currentEditCoords);

    // Boîte de dialogue pour valider ou personnaliser le nom avant l'export
    const chosenName = await this.promptGpxFilename(defaultName, 'violet');
    if (!chosenName) return;

    const gpx = this.generateGpxXml(chosenName, this.currentEditCoords, []);
    this.downloadGpxFile(`${chosenName}.gpx`, gpx);
    this.showUndoFeedback(`Trace modifiée exportée : ${chosenName}.gpx`);
    this.stopEditMode();
  }

  // =========================================================================
  // 3. UTILITAIRES : Routage Hybride IGN GeoPF & BRouter, Calculs Métriques & XML GPX
  // =========================================================================

  async queryRoute(waypoints) {
    if (!waypoints || waypoints.length < 2) return null;

    // Réinitialiser les indicateurs de demi-tour
    waypoints.forEach(wp => {
      delete wp.isBacktrack;
      delete wp.backtrackNext;
    });

    // Calcul tronçon par tronçon (leg-by-leg)
    // Garantit que CHAQUE waypoint posé ou déplacé est relié sans embranchement orphelin
    const fullRoute = [];
    const legs = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];

      let legCoords = await this.querySingleLeg(p1, p2);

      // Si le routage automatique échoue pour ce tronçon, fallback ligne droite
      if (!legCoords || legCoords.length === 0) {
        legCoords = [
          [Number(p1.lat), Number(p1.lon), p1.ele || 0],
          [Number(p2.lat), Number(p2.lon), p2.ele || 0]
        ];
      }

      // S'assurer de la connexion exacte au point de départ du tronçon
      const dStart = this.haversineDistance(legCoords[0][0], legCoords[0][1], p1.lat, p1.lon);
      if (dStart > 5) {
        legCoords.unshift([Number(p1.lat), Number(p1.lon), p1.ele || 0]);
      } else {
        legCoords[0] = [Number(p1.lat), Number(p1.lon), legCoords[0][2] || p1.ele || 0];
      }

      // S'assurer de la connexion exacte au point d'arrivée du tronçon
      const dEnd = this.haversineDistance(legCoords[legCoords.length - 1][0], legCoords[legCoords.length - 1][1], p2.lat, p2.lon);
      if (dEnd > 5) {
        legCoords.push([Number(p2.lat), Number(p2.lon), p2.ele || 0]);
      } else {
        legCoords[legCoords.length - 1] = [Number(p2.lat), Number(p2.lon), legCoords[legCoords.length - 1][2] || p2.ele || 0];
      }

      legs.push(legCoords);

      if (fullRoute.length > 0) {
        fullRoute.push(...legCoords.slice(1));
      } else {
        fullRoute.push(...legCoords);
      }
    }

    // Détection automatique des demi-tours / antennes parasites
    // Se produit quand un waypoint intermédiaire i mène sur une voie sans issue ou déviée,
    // et que l'étape suivante i+1 oblige à rebrousser chemin par le même tracé
    for (let i = 1; i < waypoints.length - 1; i++) {
      const legIn = legs[i - 1]; // Arrivée vers waypoint i
      const legOut = legs[i];    // Départ depuis waypoint i vers i+1
      if (legIn && legIn.length >= 2 && legOut && legOut.length >= 2) {
        // Observer les points proches du waypoint i (à ~10-40m)
        const inLast = legIn[legIn.length - 1];
        const inPrev = legIn[Math.max(0, legIn.length - Math.min(5, legIn.length - 1))];
        const outNext = legOut[Math.min(legOut.length - 1, Math.min(4, legOut.length - 1))];

        const distOpposite = this.haversineDistance(inPrev[0], inPrev[1], outNext[0], outNext[1]);
        const distArm = this.haversineDistance(inLast[0], inLast[1], inPrev[0], inPrev[1]);

        // Si le chemin retour calque le chemin aller (antenne < 25m d'écart)
        if (distArm > 8 && distOpposite < 25) {
          waypoints[i].isBacktrack = true;
          waypoints[i].backtrackNext = waypoints[i + 1].letter;
        }
      }
    }

    // Enrichir avec le profil altimétrique IGN RGE ALTI si nécessaire
    return await this.enrichElevations(fullRoute);
  }

  async querySingleLeg(p1, p2) {
    const lat1 = Number(p1.lat);
    const lon1 = Number(p1.lon);
    const lat2 = Number(p2.lat);
    const lon2 = Number(p2.lon);

    // 1. Priorité IGN Géoplateforme (BD TOPO Piéton) en France
    // Traite fidèlement les impasses, cours, sentiers et chemins même étiquetés privés sur OSM
    const isInFrance = (lat1 >= -22 && lat1 <= 52 && lon1 >= -63 && lon1 <= 56);
    if (isInFrance) {
      try {
        const ignUrl = `https://data.geopf.fr/navigation/itineraire?resource=bdtopo-osrm&start=${lon1.toFixed(6)},${lat1.toFixed(6)}&end=${lon2.toFixed(6)},${lat2.toFixed(6)}&profile=pedestrian&optimization=shortest`;
        const resp = await fetch(ignUrl, { headers: { 'Accept': 'application/json' } });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.geometry && data.geometry.coordinates && data.geometry.coordinates.length > 0) {
            return data.geometry.coordinates.map(pt => [pt[1], pt[0], 0]);
          }
        }
      } catch (err) {
        console.warn("IGN GeoPF routing fallback to BRouter:", err);
      }
    }

    // 2. Fallback BRouter multi-profils (sentiers de montagne, trekking, routes)
    const profiles = [this.routingProfile || 'hiking-mountain', 'trekking', 'safety'];
    const lonlats = `${lon1.toFixed(6)},${lat1.toFixed(6)}|${lon2.toFixed(6)},${lat2.toFixed(6)}`;

    for (const profile of profiles) {
      const url = `${this.brouterBase}?lonlats=${lonlats}&profile=${profile}&alternativeidx=0&format=geojson`;
      try {
        const resp = await fetch(url, { headers: { 'Accept': 'application/geo+json' } });
        if (!resp.ok) continue;
        const data = await resp.json();
        if (data && data.features && data.features[0] && data.features[0].geometry) {
          const coords = data.features[0].geometry.coordinates;
          if (coords && coords.length > 0) {
            return coords.map(pt => [pt[1], pt[0], pt[2] || 0]);
          }
        }
      } catch (err) {
        // profil suivant
      }
    }

    return null;
  }

  async enrichElevations(coords) {
    if (!coords || coords.length < 2) return coords;
    // Vérifier si des altitudes sont déjà présentes
    const hasEle = coords.some(c => (c[2] || 0) > 0);
    if (hasEle) return coords;

    try {
      // Échantillonner au maximum 50 points pour l'API alti IGN
      const sampleStep = Math.max(1, Math.floor(coords.length / 50));
      const sampleIndices = [];
      for (let i = 0; i < coords.length; i += sampleStep) sampleIndices.push(i);
      if (sampleIndices[sampleIndices.length - 1] !== coords.length - 1) {
        sampleIndices.push(coords.length - 1);
      }

      const lons = sampleIndices.map(i => coords[i][1].toFixed(6)).join('|');
      const lats = sampleIndices.map(i => coords[i][0].toFixed(6)).join('|');
      const url = `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevationLine.json?lon=${lons}&lat=${lats}&resource=ign_rge_alti_wld&sampling=${sampleIndices.length}`;

      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (resp.ok) {
        const data = await resp.json();
        const eles = data.elevations || [];
        if (eles.length === sampleIndices.length) {
          for (let k = 0; k < sampleIndices.length; k++) {
            const idx = sampleIndices[k];
            coords[idx][2] = Math.round((eles[k].z || 0) * 10) / 10;
          }
          // Remplir les points intermédiaires par interpolation
          for (let k = 0; k < sampleIndices.length - 1; k++) {
            const i1 = sampleIndices[k];
            const i2 = sampleIndices[k + 1];
            const z1 = coords[i1][2];
            const z2 = coords[i2][2];
            for (let j = i1 + 1; j < i2; j++) {
              const ratio = (j - i1) / (i2 - i1);
              coords[j][2] = Math.round((z1 + ratio * (z2 - z1)) * 10) / 10;
            }
          }
        }
      }
    } catch (e) {
      // Ignorer silencieusement si hors-ligne
    }
    return coords;
  }

  // Alias rétro-compatible
  async queryBRouter(waypoints) {
    return await this.queryRoute(waypoints);
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

  /**
   * Identifie la commune de départ d'une trace pour le nommage automatique
   */
  async getStartCity(coords) {
    if (coords && coords.length > 0) {
      const lat = Number(coords[0][0]);
      const lon = Number(coords[0][1]);
      try {
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 750);
        const resp = await fetch(`https://geo.api.gouv.fr/communes?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&fields=nom`, {
          signal: ctrl.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data) && data.length > 0 && data[0].nom) {
            return data[0].nom.trim();
          }
        }
      } catch (e) {
        // Fallback silencieux vers le cache ou le HUD
      }
    }

    // Fallback vers la commune actuellement affichée sur le bandeau bas
    const rawCity = this.mapManager?.currentCity || document.getElementById('map-hud-city-val')?.innerText || '';
    if (rawCity) {
      const cleaned = rawCity.replace(/\s*\(\d+\)$/, '').trim();
      if (cleaned) return cleaned;
    }

    return 'Randonnée';
  }

  /**
   * Construit le nom de fichier GPX recommandé selon la nomenclature :
   * YYYYMMDDHHMM - ville - kilométrage - dénivelé positif total (format D+XXX m)
   * Exemple : 202611150805 - Cassis - 0.7 km - D+53 m
   */
  async buildProposedGpxName(coords) {
    const stats = this.computeTrackStats(coords);
    const city = await this.getStartCity(coords);
    const distStr = `${stats.distanceKm.toFixed(1)} km`;
    const eleStr = `D+${Math.round(stats.elevationGain)} m`;

    // Horodatage sous format YYYYMMDDHHMM (12 chiffres consécutifs)
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${YYYY}${MM}${DD}${HH}${mm}`;

    return `${timestamp} - ${city} - ${distStr} - ${eleStr}`;
  }

  /**
   * Affiche une boîte de dialogue interactive pour proposer le nom du GPX,
   * permettant à l'utilisateur de valider immédiatement (Touche Entrée / OK)
   * ou de modifier le texte avant l'export vers le disque.
   */
  promptGpxFilename(defaultName, theme = 'sky') {
    return new Promise((resolve) => {
      // Nettoyer toute boîte précédente
      const oldModal = document.getElementById('modal-gpx-export-filename');
      if (oldModal) oldModal.remove();

      const accentBorder = (theme === 'violet') ? 'border-violet-400' : 'border-sky-400';
      const accentText = (theme === 'violet') ? 'text-violet-300' : 'text-sky-300';
      const accentFocus = (theme === 'violet') ? 'focus-within:border-violet-400 focus-within:ring-violet-400/40' : 'focus-within:border-sky-400 focus-within:ring-sky-400/40';
      const badgeBg = (theme === 'violet') ? 'bg-violet-950 border-violet-800 text-violet-300' : 'bg-sky-950 border-sky-800 text-sky-400';

      const modal = document.createElement('div');
      modal.id = 'modal-gpx-export-filename';
      modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none';
      modal.innerHTML = `
        <div class="bg-slate-900 border-2 ${accentBorder} text-white rounded-2xl p-5 sm:p-6 shadow-2xl max-w-md w-full relative">
          <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div class="flex items-center gap-2">
              <span class="text-xl">💾</span>
              <h3 class="font-extrabold text-base ${accentText}">Exporter la trace GPX</h3>
            </div>
            <button id="btn-modal-gpx-close" type="button" class="text-slate-400 hover:text-white text-lg font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition" title="Annuler">✕</button>
          </div>

          <div class="mb-5">
            <label for="input-gpx-filename" class="block text-xs font-semibold text-slate-300 mb-2">
              Nom du fichier GPX (modifiable) :
            </label>
            <div class="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-700 ${accentFocus} transition">
              <input id="input-gpx-filename" type="text" value="${defaultName}" class="bg-transparent flex-1 text-white text-sm font-bold focus:outline-none placeholder-slate-500" placeholder="Nom de la trace..." autocomplete="off" spellcheck="false" />
              <span class="text-xs font-mono font-bold select-none px-2 py-0.5 rounded border ${badgeBg}">.gpx</span>
            </div>
            <p class="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
              <span>💡</span> <span>Format automatique : <strong>Ville - Distance - D+</strong> (modifiable avant enregistrement).</span>
            </p>
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
            <button id="btn-modal-gpx-cancel" type="button" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer">
              Annuler
            </button>
            <button id="btn-modal-gpx-ok" type="button" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer">
              <span>✓</span> <span>OK</span>
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const input = modal.querySelector('#input-gpx-filename');
      const btnOk = modal.querySelector('#btn-modal-gpx-ok');
      const btnCancel = modal.querySelector('#btn-modal-gpx-cancel');
      const btnClose = modal.querySelector('#btn-modal-gpx-close');

      const cleanup = () => {
        window.removeEventListener('keydown', handleKey, { capture: true });
        modal.remove();
      };

      const confirm = () => {
        let val = (input ? input.value : '').trim();
        val = val.replace(/\.gpx$/i, '').trim();
        val = val.replace(/[/\\?%*:|"<>]/g, '-');
        if (!val) val = defaultName.replace(/[/\\?%*:|"<>]/g, '-');
        cleanup();
        resolve(val);
      };

      const cancel = () => {
        cleanup();
        resolve(null);
      };

      const handleKey = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          confirm();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cancel();
        }
      };

      window.addEventListener('keydown', handleKey, { capture: true });
      btnOk?.addEventListener('click', confirm);
      btnCancel?.addEventListener('click', cancel);
      btnClose?.addEventListener('click', cancel);

      modal.addEventListener('click', (e) => {
        if (e.target === modal) cancel();
      });

      setTimeout(() => {
        if (input) {
          input.focus();
          input.select();
        }
      }, 50);
    });
  }

  generateGpxXml(trackName, coords, waypoints) {
    const now = new Date().toISOString();
    const safeTrackName = (trackName || 'Randonnee')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

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
    <name>${safeTrackName}</name>
    <author>
      <name>JLDApps - Map &amp; Rando</name>
    </author>
    <time>${now}</time>
  </metadata>${wptXml}
  <trk>
    <name>${safeTrackName}</name>
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
