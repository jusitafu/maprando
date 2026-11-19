/**
 * Module Tableau de Marche Officiel - Fédération Française de Randonnée (FFRandonnée)
 * Map & Rando by JLDApps 2026
 * 
 * Fonctionnalités :
 * - Analyse intelligente de la trace GPX active : en moyenne 1 point tous les 1.5 km (max 1.5 km)
 * - Détection des points clés (virages en épingle, virages à 90°, cols, sommets, POIs nommés)
 * - Calcul de l'azimut de sortie immédiat du sentier (cap tangentiel à 30-50m du point)
 * - Affichage 3 niveaux en regard vertical :
 *     1. Tableau transposé (lignes <-> colonnes avec défilement horizontal)
 *     2. Profil altimétrique aligné verticalement avec repères
 *     3. Carte Leaflet interactive affichée en dessous avec points numérotés
 * - Vitesses et pauses modifiables en direct avec recalcul instantané des temps et horaires
 * - Synchronisation interactive triple (Tableau <-> Profil altimétrique <-> Carte)
 * - Export CSV officiel FFRandonnée et impression / PDF paysage
 */

class FfrRoadmapManager {
  constructor() {
    this.modalEl = null;
    this.currentTrack = null;
    this.points = [];
    this.startTime = "09:30:00";
    this.refSpeed = 3.2; // km/h
    this.animatorName = "";
    this.hikeName = "";
    this.miniMap = null;
    this.miniMapMarkers = [];
    this.mapHighlightMarker = null;

    this.initTrigger();
  }

  initTrigger() {
    const btn = document.getElementById('btn-ffr-roadmap');
    if (btn) {
      btn.addEventListener('click', () => this.openRoadmapModal());
    }
  }

  // Calcul d'azimut / cap géographique (0-360°)
  calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    let brng = (Math.atan2(y, x) * 180) / Math.PI;
    return Math.round((brng + 360) % 360);
  }

  // Distance haversine en kilomètres
  calculateHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  formatTime(dateObj) {
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    const ss = String(dateObj.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  addMinutesToTime(timeStr, minutesToAdd) {
    const parts = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
    d.setTime(d.getTime() + Math.round(minutesToAdd * 60 * 1000));
    return this.formatTime(d);
  }

  /**
   * Analyse intelligente de la trace GPX :
   * Règle stricte demandée : En moyenne 1 point tous les ~1.5 km (max 1.5 km par tronçon)
   */
  analyzeTrack(track) {
    const rawPts = track.points || [];
    if (rawPts.length < 2) return [];

    // 1. Calculer les distances cumulées le long de la trace
    const trackPts = [];
    let cumDist = 0;
    for (let i = 0; i < rawPts.length; i++) {
      const p = rawPts[i];
      const lat = p.lat !== undefined ? p.lat : p[0];
      const lon = p.lon !== undefined ? (p.lon !== undefined ? p.lon : p.lng) : p[1];
      const ele = p.ele !== undefined ? p.ele : (p[2] || 0);

      if (i > 0) {
        cumDist += this.calculateHaversine(trackPts[i - 1].lat, trackPts[i - 1].lon, lat, lon);
      }
      trackPts.push({ lat, lon, ele, dist: cumDist, idx: i });
    }

    const totalDistance = trackPts[trackPts.length - 1].dist;

    // Lissage des altitudes (moyenne mobile 5 points)
    for (let i = 0; i < trackPts.length; i++) {
      let sum = 0, count = 0;
      for (let w = -2; w <= 2; w++) {
        const j = i + w;
        if (j >= 0 && j < trackPts.length) {
          sum += trackPts[j].ele;
          count++;
        }
      }
      trackPts[i].smoothEle = count > 0 ? sum / count : trackPts[i].ele;
    }

    // 2. Détection des particularités du terrain le long du tracé
    const stepMeters = 35;
    for (let i = 5; i < trackPts.length - 5; i++) {
      let prevI = i - 1;
      while (prevI > 0 && (trackPts[i].dist - trackPts[prevI].dist) * 1000 < stepMeters) prevI--;
      let nextI = i + 1;
      while (nextI < trackPts.length - 1 && (trackPts[nextI].dist - trackPts[i].dist) * 1000 < stepMeters) nextI++;

      const pPrev = trackPts[prevI];
      const pCurr = trackPts[i];
      const pNext = trackPts[nextI];

      const bIn = this.calculateBearing(pPrev.lat, pPrev.lon, pCurr.lat, pCurr.lon);
      const bOut = this.calculateBearing(pCurr.lat, pCurr.lon, pNext.lat, pNext.lon);
      const angleDiff = Math.abs(((bOut - bIn + 540) % 360) - 180);

      if (angleDiff >= 120) {
        trackPts[i].feature = 'Virage en épingle';
        trackPts[i].featureScore = 9;
      } else if (angleDiff >= 72 && angleDiff <= 115) {
        trackPts[i].feature = 'Virage à 90°';
        trackPts[i].featureScore = 7;
      } else if (pCurr.smoothEle > pPrev.smoothEle + 6 && pCurr.smoothEle > pNext.smoothEle + 6) {
        trackPts[i].feature = 'Sommet / Crête';
        trackPts[i].featureScore = 8;
      } else if (pCurr.smoothEle < pPrev.smoothEle - 6 && pCurr.smoothEle < pNext.smoothEle - 6) {
        trackPts[i].feature = 'Col / Bas de vallon';
        trackPts[i].featureScore = 8;
      }
    }

    // Intégrer les Waypoints / POIs explicites du GPX
    const waypoints = track.waypoints || [];
    waypoints.forEach(wp => {
      let bestIdx = -1;
      let minD = Infinity;
      for (let i = 0; i < trackPts.length; i++) {
        const d = this.calculateHaversine(wp.lat, wp.lon, trackPts[i].lat, trackPts[i].lon);
        if (d < minD) {
          minD = d;
          bestIdx = i;
        }
      }
      if (bestIdx !== -1 && minD < 0.25) {
        trackPts[bestIdx].poiName = wp.name || 'Point d\'intérêt';
        trackPts[bestIdx].featureScore = 15;
      }
    });

    // 3. SELECTION STRICTE : En moyenne 1 point tous les ~1.5 km (max 1.5 km par tronçon)
    const selectedIndices = [0]; // Point 0 (Départ)
    let currentIdx = 0;

    while (currentIdx < trackPts.length - 1) {
      const currentDist = trackPts[currentIdx].dist;
      const remainingDist = totalDistance - currentDist;

      // S'il reste 1.5 km ou moins jusqu'au bout, le prochain point est directement l'Arrivée !
      if (remainingDist <= 1.5) {
        break;
      }

      // Fenêtre de recherche : entre currentDist + 1.1 km et currentDist + 1.48 km (STRICTEMENT <= 1.5 km !)
      const targetMinDist = currentDist + 1.0;
      const targetIdealDist = currentDist + 1.35;
      const targetMaxDist = currentDist + 1.48;

      let bestCandidateIdx = -1;
      let bestScore = -1;
      let closestToIdealIdx = -1;
      let minDiffToIdeal = Infinity;

      for (let i = currentIdx + 1; i < trackPts.length - 1; i++) {
        const d = trackPts[i].dist;
        if (d >= targetMinDist && d <= targetMaxDist) {
          const diff = Math.abs(d - targetIdealDist);
          if (diff < minDiffToIdeal) {
            minDiffToIdeal = diff;
            closestToIdealIdx = i;
          }
          const score = trackPts[i].featureScore || 0;
          if (score > bestScore) {
            bestScore = score;
            bestCandidateIdx = i;
          }
        }
        if (d > targetMaxDist) break;
      }

      // Sélectionner la meilleure particularité (sommet, col, épingle, POI) trouvée dans la tranche de 1.5 km
      let chosenIdx = (bestCandidateIdx !== -1 && bestScore > 0) ? bestCandidateIdx : closestToIdealIdx;

      // Si aucun point n'est tombé dans la fenêtre, chercher le point le plus proche sous 1.48 km
      if (chosenIdx === -1) {
        let safeIdx = currentIdx + 1;
        while (safeIdx < trackPts.length - 1 && trackPts[safeIdx].dist - currentDist <= 1.45) {
          safeIdx++;
        }
        chosenIdx = safeIdx;
      }

      selectedIndices.push(chosenIdx);
      currentIdx = chosenIdx;
    }

    // Toujours ajouter l'Arrivée à la fin
    selectedIndices.push(trackPts.length - 1);

    // 4. Construction des fiches points avec calcul de l'azimut de sortie immédiat
    const roadmapPoints = [];
    let cumulDPlus = 0;
    let cumulDMoins = 0;

    for (let i = 0; i < selectedIndices.length; i++) {
      const ptIdx = selectedIndices[i];
      const pt = trackPts[ptIdx];
      const isStart = i === 0;
      const isEnd = i === selectedIndices.length - 1;

      // Azimut de sortie immédiat du sentier (sur 30 à 50 mètres le long de la trace réelle)
      let exitAzimuth = '-';
      if (!isEnd) {
        let fwdIdx = ptIdx + 1;
        while (fwdIdx < trackPts.length - 1 && (trackPts[fwdIdx].dist - pt.dist) * 1000 < 45) {
          fwdIdx++;
        }
        exitAzimuth = this.calculateBearing(pt.lat, pt.lon, trackPts[fwdIdx].lat, trackPts[fwdIdx].lon);
      }

      // Métriques relatives au tronçon précédent
      let distTroncon = 0;
      let deniveleTroncon = 0;
      let pentePct = 0;

      if (!isStart) {
        const prevPt = roadmapPoints[i - 1];
        distTroncon = Math.round((pt.dist - prevPt.cumulDist) * 100) / 100;
        deniveleTroncon = Math.round(pt.smoothEle - prevPt.altitude);
        if (distTroncon > 0) {
          pentePct = Math.round((deniveleTroncon / (distTroncon * 1000)) * 100);
        }
      }

      // Cumuls D+ et D- réels le long du sentier
      if (!isStart) {
        const prevIdx = selectedIndices[i - 1];
        for (let s = prevIdx + 1; s <= ptIdx; s++) {
          const diff = trackPts[s].ele - trackPts[s - 1].ele;
          if (diff > 0) cumulDPlus += diff;
          else cumulDMoins += Math.abs(diff);
        }
      }

      // Désignation du point
      let designation = `Point ${i}`;
      if (isStart) designation = 'Départ';
      else if (isEnd) designation = 'Arrivée';
      else if (pt.poiName) designation = pt.poiName;
      else if (pt.feature) designation = pt.feature;
      else designation = `Point de repère (km ${pt.dist.toFixed(1)})`;

      roadmapPoints.push({
        num: i,
        designation: designation,
        azimuth: exitAzimuth,
        altitude: Math.round(pt.smoothEle),
        distTroncon: distTroncon,
        vitesse: this.refSpeed,
        pause: (isStart ? 0 : (i === Math.floor(selectedIndices.length / 2) ? 40 : 0)), // 40 min par défaut à mi-parcours (pique-nique)
        deniveleTroncon: deniveleTroncon,
        pentePct: pentePct,
        cumulDPlus: Math.round(cumulDPlus),
        cumulDMoins: Math.round(cumulDMoins),
        cumulDist: Math.round(pt.dist * 100) / 100,
        tempsTronconMin: 0,
        heureArrivee: '',
        info: isStart ? 'Rassemblement et consignes' : (isEnd ? 'Fin de la randonnée' : ''),
        lat: pt.lat,
        lon: pt.lon
      });
    }

    this.points = roadmapPoints;
    this.recalculateTimes();
    return this.points;
  }

  /**
   * Recalcule tous les temps de marche et heures d'arrivée
   */
  recalculateTimes() {
    let currentHeure = this.startTime;

    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      if (i === 0) {
        p.tempsTronconMin = p.pause || 0;
        p.heureArrivee = this.startTime;
      } else {
        const vit = p.vitesse > 0 ? p.vitesse : this.refSpeed;
        const tempsMarcheMin = (p.distTroncon / vit) * 60;
        const tempsDPlusMin = (p.deniveleTroncon > 0) ? (p.deniveleTroncon / 300) * 60 : 0;
        p.tempsTronconMin = Math.round(tempsMarcheMin + tempsDPlusMin + (p.pause || 0));
        currentHeure = this.addMinutesToTime(currentHeure, p.tempsTronconMin);
        p.heureArrivee = currentHeure;
      }
    }
  }

  /**
   * Ouverture du modal Tableau de Marche FFR
   */
  openRoadmapModal() {
    const mapMgr = window.MapManagerInstance;
    const track = mapMgr?.standaloneHike || (mapMgr?.standaloneTracks && mapMgr.standaloneTracks[0]) || mapMgr?.currentHike;

    if (!track) {
      alert("⚠️ Aucune trace GPX n'est actuellement affichée sur la carte.\n\nVeuillez d'abord charger une trace GPX pour générer son Tableau de Marche FFR.");
      return;
    }

    this.currentTrack = track;
    this.hikeName = track.name || 'Randonnée';
    this.animatorName = window.AuthManagerInstance?.getCurrentUser()?.username || 'Animateur FFR';

    // Analyse avec la règle : ~1 point tous les 1.5 km
    this.analyzeTrack(track);

    // Rendu du modal complet 3 niveaux (Tableau, Profil, Carte)
    this.renderModal();
  }

  renderModal() {
    if (this.modalEl) this.modalEl.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-ffr-roadmap';
    modal.className = 'fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex flex-col p-2 sm:p-3 text-white animate-in fade-in duration-200 overflow-hidden';
    modal.innerHTML = `
      <!-- Entête du Tableau de Marche -->
      <div class="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-800 flex-shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-base shadow-lg shadow-emerald-950/60 font-black">
            📋
          </div>
          <div>
            <h2 class="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <span>Tableau de Marche FFRandonnée</span>
              <span class="px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 text-[10px] font-bold border border-emerald-700/50">Moyenne 1 pt / 1.5 km</span>
            </h2>
            <div class="text-[11px] text-slate-400 flex items-center gap-2.5">
              <span>Rando : <strong class="text-slate-200">${this.escapeHtml(this.hikeName)}</strong></span>
              <span>•</span>
              <span>Distance : <strong class="text-sky-400">${this.points[this.points.length - 1]?.cumulDist || 0} km</strong></span>
              <span>•</span>
              <span>D+ : <strong class="text-emerald-400">+${this.points[this.points.length - 1]?.cumulDPlus || 0} m</strong></span>
              <span>•</span>
              <span>Points : <strong class="text-amber-400">${this.points.length} jalons</strong></span>
            </div>
          </div>
        </div>

        <!-- Paramètres rapides (Heure départ, Vitesse réf, Actions) -->
        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-700 text-xs">
            <span class="text-slate-400 font-semibold text-[11px]">Départ :</span>
            <input id="ffr-input-start-time" type="time" step="1" value="${this.startTime}" class="bg-transparent text-white font-bold text-xs focus:outline-none w-20 cursor-pointer" />
          </div>

          <div class="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-700 text-xs">
            <span class="text-slate-400 font-semibold text-[11px]">Vitesse réf :</span>
            <input id="ffr-input-ref-speed" type="number" step="0.1" value="${this.refSpeed}" class="bg-transparent text-white font-bold text-xs focus:outline-none w-12 cursor-pointer text-center" />
            <span class="text-slate-500 text-[10px]">km/h</span>
          </div>

          <button id="btn-ffr-export-csv" type="button" class="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer" title="Télécharger le fichier CSV officiel FFR">
            <span>📥</span> <span>Export CSV</span>
          </button>

          <button id="btn-ffr-print" type="button" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer" title="Imprimer le tableau de marche">
            <span>🖨️</span> <span>Imprimer</span>
          </button>

          <button id="btn-ffr-close" type="button" class="w-7 h-7 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm transition cursor-pointer" title="Fermer">✕</button>
        </div>
      </div>

      <!-- Zone Principale : 3 NIVEAUX EN REGARD VERTICAL (Tableau -> Profil -> Carte) -->
      <div class="flex-1 flex flex-col min-h-0 overflow-hidden my-2 gap-2">
        <!-- 1. TABLEAU TRANSPOSÉ (En haut, défilement horizontal) -->
        <div id="ffr-transposed-table-container" class="flex-[1.1] min-h-[150px] overflow-x-auto overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/60 relative select-none">
          ${this.buildTransposedTableHtml()}
        </div>

        <!-- 2. PROFIL ALTIMÉTRIQUE EN REGARD ALIGNÉ (Au milieu) -->
        <div id="ffr-aligned-profile-container" class="h-32 sm:h-36 bg-slate-900/90 rounded-xl border border-slate-800 p-2 flex flex-col flex-shrink-0 relative">
          <div class="flex items-center justify-between text-[11px] text-slate-400 px-2 pb-0.5 border-b border-slate-800/60">
            <span class="font-bold text-emerald-300 flex items-center gap-1.5">
              <span>▲</span> <span>Profil Altimétrique &amp; Repères Verticaux des Points</span>
            </span>
            <span class="text-[10px] text-slate-500">Survol = synchronisation Profil / Carte</span>
          </div>
          <div id="ffr-svg-profile-wrapper" class="flex-1 relative w-full h-full min-h-0 mt-0.5">
            ${this.buildSvgProfileHtml()}
          </div>
        </div>

        <!-- 3. LA CARTE INTERACTIVE EN-DESSOUS DU PROFIL (En bas) -->
        <div id="ffr-roadmap-map-container" class="flex-1 min-h-[180px] bg-slate-900 rounded-xl border border-slate-800 overflow-hidden relative flex flex-col">
          <div class="absolute top-2 left-3 z-[400] bg-slate-900/90 text-white px-2.5 py-1 rounded-lg border border-slate-700 text-[10px] font-bold shadow flex items-center gap-1.5 pointer-events-none">
            <span>🗺️</span> <span>Carte du tracé • ${this.points.length} points jalonnés</span>
          </div>
          <div id="ffr-roadmap-map" class="w-full h-full min-h-[170px]"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalEl = modal;

    // Initialiser la mini-carte Leaflet en bas
    this.initMiniMap();

    // Événements
    this.bindModalEvents();
  }

  /**
   * Initialise la mini-carte Leaflet affichée en dessous du profil
   */
  initMiniMap() {
    const mapEl = document.getElementById('ffr-roadmap-map');
    if (!mapEl || typeof L === 'undefined') return;

    if (this.miniMap) {
      this.miniMap.remove();
      this.miniMap = null;
    }

    const miniMap = L.map('ffr-roadmap-map', {
      zoomControl: true,
      attributionControl: false
    });
    this.miniMap = miniMap;

    // Couche de tuiles OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(miniMap);

    const rawPts = this.currentTrack?.points || [];
    const latlngs = rawPts.map(p => [
      p.lat !== undefined ? p.lat : p[0],
      p.lon !== undefined ? (p.lon !== undefined ? p.lon : p.lng) : p[1]
    ]);

    if (latlngs.length > 0) {
      // Tracé avec halo blanc et trait violet/bleu
      L.polyline(latlngs, { color: '#ffffff', weight: 6, opacity: 0.9 }).addTo(miniMap);
      L.polyline(latlngs, { color: '#0284c7', weight: 4, opacity: 1.0 }).addTo(miniMap);

      // Pastilles des points 0..N
      this.miniMapMarkers = [];
      this.points.forEach((p, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === this.points.length - 1;
        const color = isStart ? '#10b981' : (isEnd ? '#ef4444' : '#0284c7');

        const m = L.marker([p.lat, p.lon], {
          icon: L.divIcon({
            className: 'ffr-map-pin',
            html: `
              <div style="background:${color}; color:white; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:10px; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.5); cursor:pointer;">
                ${p.num}
              </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          })
        }).addTo(miniMap);

        m.bindPopup(`
          <div style="font-family:sans-serif; text-align:left; min-width:140px; padding:3px;">
            <div style="font-weight:900; color:${color}; font-size:12px;">Point ${p.num} : ${this.escapeHtml(p.designation)}</div>
            <div style="font-size:11px; color:#475569; margin-top:2px;">Altitude : <strong>${p.altitude} m</strong></div>
            <div style="font-size:11px; color:#475569;">Azimut départ : <strong>${p.azimuth}°</strong></div>
            <div style="font-size:11px; color:#475569;">Heure : <strong>${p.heureArrivee}</strong></div>
          </div>
        `);

        m.on('click', () => {
          this.setHighlightIdx(idx, true);
          this.scrollToColumn(idx);
        });

        this.miniMapMarkers.push(m);
      });

      miniMap.fitBounds(L.latLngBounds(latlngs), { padding: [25, 25] });
      setTimeout(() => miniMap.invalidateSize(), 200);
    }
  }

  /**
   * Génère le HTML du tableau transposé (Lignes = Métriques, Colonnes = Points 0..N)
   */
  buildTransposedTableHtml() {
    const totalPoints = this.points.length;
    if (totalPoints === 0) return '<div class="p-4 text-center text-slate-400 text-xs">Aucun point détecté.</div>';

    const rows = [
      { key: 'num', label: 'Points N°', header: true },
      { key: 'designation', label: 'Désignation', isEditableText: true },
      { key: 'azimuth', label: 'Azimut (°)', isBadge: true },
      { key: 'altitude', label: 'Altitude (M)', suffix: ' m' },
      { key: 'distTroncon', label: 'Dist. tronçon (kM)', suffix: ' km' },
      { key: 'vitesse', label: 'Vitesse (Km/H)', isEditableSpeed: true },
      { key: 'pause', label: 'Pauses (Mn)', isEditablePause: true },
      { key: 'deniveleTroncon', label: 'Dénivelé (M)', formatDenivele: true },
      { key: 'pentePct', label: 'Pente (%)', formatPente: true },
      { key: 'cumulDPlus', label: 'D+ cumulé (M)', prefix: '+' },
      { key: 'cumulDMoins', label: 'D- cumulé (M)', prefix: '-' },
      { key: 'cumulDist', label: 'Dist. cumulée (kM)', suffix: ' km', isHighlight: true },
      { key: 'tempsTronconMin', label: 'Temps Tronçon (Mn)', suffix: ' mn', isHighlight: true },
      { key: 'heureArrivee', label: 'Heure arrivée', isTime: true },
      { key: 'info', label: 'Information', isEditableInfo: true }
    ];

    let html = `
      <table class="w-full text-left text-xs border-collapse">
        <tbody>
    `;

    rows.forEach((row, rIdx) => {
      const isAltBg = rIdx % 2 === 1;
      const rowBg = isAltBg ? 'bg-slate-900/80' : 'bg-slate-950/60';

      html += `<tr class="${rowBg} border-b border-slate-800/60 hover:bg-slate-800/50 transition">`;
      html += `
        <th class="sticky left-0 z-20 ${rowBg} px-3 py-1.5 text-[11px] font-extrabold text-slate-300 border-r border-slate-800 whitespace-nowrap min-w-[160px] shadow-sm">
          ${row.label}
        </th>
      `;

      this.points.forEach((p, cIdx) => {
        const isStart = cIdx === 0;
        const isEnd = cIdx === totalPoints - 1;
        const colClass = `ffr-col-${cIdx} px-2.5 py-1 text-center whitespace-nowrap border-r border-slate-800/40 min-w-[110px] transition-colors`;

        let cellContent = '';

        if (row.key === 'num') {
          const badgeBg = isStart ? 'bg-emerald-600' : (isEnd ? 'bg-rose-600' : 'bg-sky-600');
          cellContent = `
            <div class="flex items-center justify-center gap-1.5 cursor-pointer ffr-btn-center-point" data-idx="${cIdx}" title="Cliquer pour centrer sur la carte">
              <span class="w-5 h-5 rounded-full ${badgeBg} text-white font-black text-[10px] flex items-center justify-center shadow">${p.num}</span>
              <span class="font-extrabold text-white text-[11px]">${isStart ? 'Départ' : (isEnd ? 'Arrivée' : 'Pt ' + p.num)}</span>
            </div>
          `;
        } else if (row.isEditableText) {
          cellContent = `<input type="text" class="ffr-input-cell ffr-edit-name bg-slate-900/90 text-white font-bold text-[11px] px-2 py-0.5 rounded border border-slate-700/80 w-full text-center focus:border-sky-400 focus:outline-none" data-idx="${cIdx}" value="${this.escapeHtml(p.designation)}" />`;
        } else if (row.isBadge) {
          cellContent = p.azimuth !== '-' ? `<span class="px-2 py-0.5 rounded bg-sky-950 border border-sky-700/80 text-sky-300 font-mono font-black text-[11px]">🧭 ${p.azimuth}°</span>` : '<span class="text-slate-600 font-mono">-</span>';
        } else if (row.isEditableSpeed) {
          cellContent = isStart ? '<span class="text-slate-600">-</span>' : `<input type="number" step="0.1" min="1" max="10" class="ffr-input-cell ffr-edit-speed bg-slate-900/90 text-amber-300 font-bold text-[11px] px-1.5 py-0.5 rounded border border-slate-700/80 w-16 text-center focus:border-amber-400 focus:outline-none" data-idx="${cIdx}" value="${p.vitesse}" />`;
        } else if (row.isEditablePause) {
          cellContent = isStart ? '<span class="text-slate-600">-</span>' : `<input type="number" step="1" min="0" max="180" class="ffr-input-cell ffr-edit-pause bg-slate-900/90 text-amber-300 font-bold text-[11px] px-1.5 py-0.5 rounded border border-slate-700/80 w-16 text-center focus:border-amber-400 focus:outline-none" data-idx="${cIdx}" value="${p.pause}" />`;
        } else if (row.formatDenivele) {
          const val = p.deniveleTroncon;
          const color = val > 0 ? 'text-emerald-400' : (val < 0 ? 'text-rose-400' : 'text-slate-400');
          cellContent = isStart ? '<span class="text-slate-600">-</span>' : `<span class="font-bold ${color}">${val > 0 ? '+' : ''}${val} m</span>`;
        } else if (row.formatPente) {
          const val = p.pentePct;
          const color = val > 0 ? 'text-emerald-400' : (val < 0 ? 'text-rose-400' : 'text-slate-400');
          cellContent = isStart ? '<span class="text-slate-600">-</span>' : `<span class="font-bold ${color}">${val > 0 ? '+' : ''}${val} %</span>`;
        } else if (row.isTime) {
          cellContent = `<span class="font-mono font-black text-emerald-400 text-xs px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/80 shadow-xs">${p.heureArrivee}</span>`;
        } else if (row.isHighlight) {
          const val = row.key === 'cumulDist' ? `${p.cumulDist.toFixed(2)} km` : `${p.tempsTronconMin} mn`;
          cellContent = `<span class="font-black text-sky-300">${val}</span>`;
        } else if (row.isEditableInfo) {
          cellContent = `<input type="text" placeholder="Note..." class="ffr-input-cell ffr-edit-info bg-slate-900/90 text-slate-300 text-[10px] px-2 py-0.5 rounded border border-slate-700/80 w-full text-center focus:border-sky-400 focus:outline-none" data-idx="${cIdx}" value="${this.escapeHtml(p.info)}" />`;
        } else {
          let val = p[row.key];
          if (row.prefix) val = `${row.prefix}${val}`;
          if (row.suffix) val = `${val}${row.suffix}`;
          cellContent = `<span class="text-slate-300 font-medium">${val}</span>`;
        }

        html += `<td class="${colClass}">${cellContent}</td>`;
      });

      html += `</tr>`;
    });

    html += `
        </tbody>
      </table>
    `;

    return html;
  }

  /**
   * Construit le profil altimétrique SVG aligné avec les points FFR
   */
  buildSvgProfileHtml() {
    const rawPts = this.currentTrack?.points || [];
    if (rawPts.length < 2) return '';

    const width = 1000;
    const height = 140;
    const paddingLeft = 35;
    const paddingRight = 25;
    const paddingTop = 20;
    const paddingBottom = 20;

    const totalDist = this.points[this.points.length - 1]?.cumulDist || 1;

    let minEle = Infinity;
    let maxEle = -Infinity;
    rawPts.forEach(p => {
      const e = p.ele !== undefined ? p.ele : (p[2] || 0);
      if (e < minEle) minEle = e;
      if (e > maxEle) maxEle = e;
    });

    if (minEle === Infinity) { minEle = 0; maxEle = 500; }
    const eleSpan = Math.max(maxEle - minEle, 40);
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    // Échantillonner la courbe de dénivelé
    let pathD = '';
    const numSamples = Math.min(rawPts.length, 300);
    const step = Math.max(1, Math.floor(rawPts.length / numSamples));

    for (let i = 0; i < rawPts.length; i += step) {
      const p = rawPts[i];
      const dist = p.dist !== undefined ? p.dist : (i / (rawPts.length - 1)) * totalDist;
      const ele = p.ele !== undefined ? p.ele : (p[2] || 0);

      const x = paddingLeft + (dist / totalDist) * plotWidth;
      const y = paddingTop + plotHeight - ((ele - minEle) / eleSpan) * plotHeight;

      if (pathD === '') pathD = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      else pathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }

    const areaD = `${pathD} L ${(paddingLeft + plotWidth).toFixed(1)} ${(paddingTop + plotHeight).toFixed(1)} L ${paddingLeft} ${(paddingTop + plotHeight).toFixed(1)} Z`;

    // Repères verticaux pour chaque point
    let pinsSvg = '';
    this.points.forEach((p, idx) => {
      const x = paddingLeft + (p.cumulDist / totalDist) * plotWidth;
      const y = paddingTop + plotHeight - ((p.altitude - minEle) / eleSpan) * plotHeight;
      const isStart = idx === 0;
      const isEnd = idx === this.points.length - 1;
      const pinColor = isStart ? '#10b981' : (isEnd ? '#ef4444' : '#0284c7');

      pinsSvg += `
        <!-- Ligne guide verticale -->
        <line x1="${x.toFixed(1)}" y1="${paddingTop}" x2="${x.toFixed(1)}" y2="${(paddingTop + plotHeight).toFixed(1)}" stroke="#334155" stroke-dasharray="3,3" stroke-width="1.2" class="ffr-guide-line ffr-guide-${idx}" />
        
        <!-- Pastille numérotée sur la courbe -->
        <g class="ffr-pin-group ffr-pin-${idx} cursor-pointer" data-idx="${idx}" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})">
          <circle r="8" fill="${pinColor}" stroke="#ffffff" stroke-width="1.8" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))" />
          <text text-anchor="middle" dy="3.2" fill="#ffffff" font-size="8.5" font-weight="900" font-family="sans-serif">${p.num}</text>
        </g>
      `;
    });

    return `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-full select-none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ffrProfileGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0284c7" stop-opacity="0.45" />
            <stop offset="100%" stop-color="#0284c7" stop-opacity="0.05" />
          </linearGradient>
        </defs>

        <line x1="${paddingLeft}" y1="${paddingTop + plotHeight}" x2="${paddingLeft + plotWidth}" y2="${paddingTop + plotHeight}" stroke="#475569" stroke-width="1.2" />
        <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${paddingTop + plotHeight}" stroke="#475569" stroke-width="1.2" />

        <path d="${areaD}" fill="url(#ffrProfileGrad)" />
        <path d="${pathD}" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" />

        ${pinsSvg}

        <text x="${paddingLeft - 4}" y="${paddingTop + 4}" text-anchor="end" fill="#94a3b8" font-size="8.5" font-weight="bold">${Math.round(maxEle)}m</text>
        <text x="${paddingLeft - 4}" y="${paddingTop + plotHeight}" text-anchor="end" fill="#94a3b8" font-size="8.5" font-weight="bold">${Math.round(minEle)}m</text>
        <text x="${paddingLeft + plotWidth}" y="${paddingTop + plotHeight + 12}" text-anchor="end" fill="#94a3b8" font-size="8.5" font-weight="bold">${totalDist.toFixed(1)} km</text>
      </svg>
    `;
  }

  /**
   * Événements du modal
   */
  bindModalEvents() {
    if (!this.modalEl) return;

    this.modalEl.querySelector('#btn-ffr-close')?.addEventListener('click', () => {
      this.closeModal();
    });

    this.modalEl.querySelector('#ffr-input-start-time')?.addEventListener('change', (e) => {
      this.startTime = e.target.value || "09:30:00";
      this.recalculateTimes();
      this.refreshTableAndProfile();
    });

    this.modalEl.querySelector('#ffr-input-ref-speed')?.addEventListener('change', (e) => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v) && v > 0) {
        this.refSpeed = v;
        this.points.forEach((p, idx) => {
          if (idx > 0) p.vitesse = v;
        });
        this.recalculateTimes();
        this.refreshTableAndProfile();
      }
    });

    this.modalEl.querySelectorAll('.ffr-edit-name').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.getAttribute('data-idx'), 10);
        if (this.points[idx]) this.points[idx].designation = inp.value;
      });
    });

    this.modalEl.querySelectorAll('.ffr-edit-speed').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.getAttribute('data-idx'), 10);
        const v = parseFloat(inp.value);
        if (this.points[idx] && !isNaN(v) && v > 0) {
          this.points[idx].vitesse = v;
          this.recalculateTimes();
          this.refreshTableAndProfile();
        }
      });
    });

    this.modalEl.querySelectorAll('.ffr-edit-pause').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.getAttribute('data-idx'), 10);
        const p = parseInt(inp.value, 10);
        if (this.points[idx] && !isNaN(p) && p >= 0) {
          this.points[idx].pause = p;
          this.recalculateTimes();
          this.refreshTableAndProfile();
        }
      });
    });

    this.modalEl.querySelectorAll('.ffr-edit-info').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.getAttribute('data-idx'), 10);
        if (this.points[idx]) this.points[idx].info = inp.value;
      });
    });

    this.modalEl.querySelectorAll('.ffr-btn-center-point, .ffr-pin-group').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        this.highlightPointOnMap(idx);
      });
    });

    this.modalEl.querySelectorAll('[class*="ffr-col-"]').forEach(colEl => {
      const match = colEl.className.match(/ffr-col-(\d+)/);
      if (match) {
        const idx = match[1];
        colEl.addEventListener('mouseenter', () => this.setHighlightIdx(idx, true));
        colEl.addEventListener('mouseleave', () => this.setHighlightIdx(idx, false));
      }
    });

    this.modalEl.querySelectorAll('.ffr-pin-group').forEach(pinEl => {
      const idx = pinEl.getAttribute('data-idx');
      pinEl.addEventListener('mouseenter', () => this.setHighlightIdx(idx, true));
      pinEl.addEventListener('mouseleave', () => this.setHighlightIdx(idx, false));
    });

    this.modalEl.querySelector('#btn-ffr-export-csv')?.addEventListener('click', () => {
      this.exportCsv();
    });

    this.modalEl.querySelector('#btn-ffr-print')?.addEventListener('click', () => {
      this.printRoadmap();
    });
  }

  scrollToColumn(idx) {
    const tableContainer = this.modalEl?.querySelector('#ffr-transposed-table-container');
    const targetCell = this.modalEl?.querySelector(`.ffr-col-${idx}`);
    if (tableContainer && targetCell) {
      targetCell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  setHighlightIdx(idx, active) {
    if (!this.modalEl) return;
    const colCells = this.modalEl.querySelectorAll(`.ffr-col-${idx}`);
    colCells.forEach(c => {
      c.classList.toggle('bg-sky-950/70', active);
      c.classList.toggle('ring-1', active);
      c.classList.toggle('ring-sky-400', active);
    });

    const guide = this.modalEl.querySelector(`.ffr-guide-${idx}`);
    if (guide) {
      guide.setAttribute('stroke', active ? '#38bdf8' : '#334155');
      guide.setAttribute('stroke-width', active ? '2.5' : '1.2');
    }

    const pin = this.modalEl.querySelector(`.ffr-pin-${idx} circle`);
    if (pin) {
      pin.setAttribute('stroke-width', active ? '3.5' : '1.8');
      pin.setAttribute('r', active ? '10' : '8');
    }

    // Mettre en valeur le marqueur sur la mini-carte
    if (this.miniMapMarkers && this.miniMapMarkers[idx]) {
      const m = this.miniMapMarkers[idx];
      const el = m.getElement();
      if (el) {
        el.style.transform = active ? 'scale(1.35)' : 'scale(1.0)';
        el.style.zIndex = active ? '999' : '100';
      }
    }
  }

  highlightPointOnMap(idx) {
    const pt = this.points[idx];
    if (!pt) return;

    this.scrollToColumn(idx);
    this.setHighlightIdx(idx, true);

    // Pan sur la mini-carte
    if (this.miniMap) {
      this.miniMap.panTo([pt.lat, pt.lon], { animate: true });
      if (this.miniMapMarkers && this.miniMapMarkers[idx]) {
        this.miniMapMarkers[idx].openPopup();
      }
    }

    // Pan sur la carte principale
    const map = window.MapManagerInstance?.map;
    if (map) {
      map.panTo([pt.lat, pt.lon], { animate: true });
    }
  }

  refreshTableAndProfile() {
    const tableContainer = this.modalEl?.querySelector('#ffr-transposed-table-container');
    if (tableContainer) {
      tableContainer.innerHTML = this.buildTransposedTableHtml();
    }
    const profileContainer = this.modalEl?.querySelector('#ffr-svg-profile-wrapper');
    if (profileContainer) {
      profileContainer.innerHTML = this.buildSvgProfileHtml();
    }
    this.bindModalEvents();
  }

  closeModal() {
    if (this.miniMap) {
      this.miniMap.remove();
      this.miniMap = null;
    }
    this.miniMapMarkers = [];
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }

  /**
   * Export CSV officiel 100% conforme au modèle FFRandonnée
   */
  exportCsv() {
    let csv = `\uFEFF`; // BOM UTF-8 pour Excel
    csv += `,Rando :,"${this.escapeCsv(this.hikeName)}",,,,,Tableau de marche,,,,,,Heure Départ   ==>  ,${this.startTime},\n`;
    csv += `,Animateur,"${this.escapeCsv(this.animatorName)}",,,,,,,,,,,,,\n`;
    csv += `,,,,,,,,,,,,,,,\n`;
    csv += `Points N°,Désignation,,Azimut  (°),Altitude  (M),Distance du point précédent (kM),Vitesse  (Km/H),Pauses  (Mn),Dénivelé (M),Pente (%),Dénivelé cumulé >0       (M),Dénivelé cumulé <0        (M),Distance cumulée (kM),Temps Tronçon (Mn),Heure arrivée,Information\n`;

    this.points.forEach(p => {
      const isStart = p.num === 0;
      const az = p.azimuth !== '-' ? p.azimuth : '';
      const dist = isStart ? '' : p.distTroncon;
      const vit = isStart ? '' : p.vitesse;
      const pau = (p.pause > 0) ? p.pause : '';
      const deniv = isStart ? '' : p.deniveleTroncon;
      const pente = isStart ? '' : p.pentePct;

      csv += `${p.num},"${this.escapeCsv(p.designation)}",,${az},${p.altitude},${dist},${vit},${pau},${deniv},${pente},${p.cumulDPlus},${p.cumulDMoins},${p.cumulDist},${p.tempsTronconMin},${p.heureArrivee},"${this.escapeCsv(p.info)}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Tableau_de_marche_FFR_${this.hikeName.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Impression / Export PDF en mode paysage propre
   */
  printRoadmap() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let rowsHtml = '';
    this.points.forEach(p => {
      rowsHtml += `
        <tr>
          <td style="font-weight:bold; text-align:center;">${p.num}</td>
          <td style="font-weight:bold;">${this.escapeHtml(p.designation)}</td>
          <td style="text-align:center; font-family:monospace;">${p.azimuth !== '-' ? p.azimuth + '°' : '-'}</td>
          <td style="text-align:center;">${p.altitude} m</td>
          <td style="text-align:center;">${p.num === 0 ? '-' : p.distTroncon + ' km'}</td>
          <td style="text-align:center;">${p.num === 0 ? '-' : p.vitesse}</td>
          <td style="text-align:center;">${p.pause > 0 ? p.pause + ' mn' : '-'}</td>
          <td style="text-align:center;">${p.num === 0 ? '-' : (p.deniveleTroncon > 0 ? '+' : '') + p.deniveleTroncon + ' m'}</td>
          <td style="text-align:center;">${p.num === 0 ? '-' : (p.pentePct > 0 ? '+' : '') + p.pentePct + ' %'}</td>
          <td style="text-align:center; color:#047857;">+${p.cumulDPlus} m</td>
          <td style="text-align:center; color:#b91c1c;">-${p.cumulDMoins} m</td>
          <td style="text-align:center; font-weight:bold;">${p.cumulDist} km</td>
          <td style="text-align:center; font-weight:bold;">${p.tempsTronconMin} mn</td>
          <td style="text-align:center; font-family:monospace; font-weight:bold; background:#f0fdf4;">${p.heureArrivee}</td>
          <td>${this.escapeHtml(p.info)}</td>
        </tr>
      `;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tableau de Marche FFR - ${this.escapeHtml(this.hikeName)}</title>
        <style>
          @page { size: landscape; margin: 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 10px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; }
          .title { font-size: 16px; font-weight: 900; color: #0f172a; }
          .meta { font-size: 11px; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-top: 5px; }
          th { background: #f1f5f9; color: #0f172a; font-size: 10px; font-weight: 800; border: 1px solid #cbd5e1; padding: 5px 4px; text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 10px; }
          tr:nth-child(even) { background: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">Tableau de Marche FFRandonnée • ${this.escapeHtml(this.hikeName)}</div>
            <div class="meta">Animateur : <strong>${this.escapeHtml(this.animatorName || 'Animateur')}</strong> • Heure de départ : <strong>${this.startTime}</strong> • Tronçons ≤ 1.5 km</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:bold; color:#0284c7;">Map &amp; Rando by JLDApps</div>
            <div style="font-size:9px; color:#64748b;">Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Désignation</th>
              <th>Azimut</th>
              <th>Alt.</th>
              <th>Dist.</th>
              <th>Vitesse</th>
              <th>Pause</th>
              <th>Déniv.</th>
              <th>Pente</th>
              <th>D+ cum.</th>
              <th>D- cum.</th>
              <th>Dist. cum.</th>
              <th>Temps</th>
              <th>Arrivée</th>
              <th>Information</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  escapeCsv(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '""');
  }
}

// Instance globale
window.FfrRoadmapManagerInstance = new FfrRoadmapManager();
