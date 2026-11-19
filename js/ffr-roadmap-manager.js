/**
 * Module Tableau de Marche Officiel - Fédération Française de Randonnée (FFRandonnée)
 * Map & Rando by JLDApps 2026
 * 
 * Fonctionnalités :
 * - Analyse intelligente de la trace GPX active (détection des virages à 90°, épingles, cols, sommets, POIs)
 * - Découpage automatique avec contrainte stricte : tronçons d'1,5 km maximum
 * - Calcul de l'azimut de sortie immédiat du sentier (cap tangentiel à 30-50m du point)
 * - Tableau transposé (lignes <-> colonnes) aligné verticalement avec le profil altimétrique en dessous
 * - Vitesses et pauses modifiables en direct avec recalcul instantané des temps et horaires
 * - Synchronisation interactive triple (Tableau <-> Profil altimétrique <-> Carte Leaflet)
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

  // Formate les minutes en format HH:MM:SS ou HH:MM
  formatTime(dateObj) {
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    const ss = String(dateObj.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  // Ajoute des minutes à une heure de référence sous forme "HH:MM:SS"
  addMinutesToTime(timeStr, minutesToAdd) {
    const parts = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
    d.setTime(d.getTime() + Math.round(minutesToAdd * 60 * 1000));
    return this.formatTime(d);
  }

  /**
   * Analyse intelligente de la trace GPX
   */
  analyzeTrack(track) {
    const rawPts = track.points || [];
    if (rawPts.length < 2) return [];

    // 1. Calculer les distances cumulées et altitudes lissées le long de la trace
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

    // 2. Sélection des points remarquables
    const selectedIndices = new Set();
    selectedIndices.add(0); // Départ
    selectedIndices.add(trackPts.length - 1); // Arrivée

    // A. Intégrer les Waypoints / POIs existants dans le GPX (nommés par l'utilisateur ou le GPX)
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
      if (bestIdx !== -1 && minD < 0.25) { // à moins de 250m de la trace
        selectedIndices.add(bestIdx);
        trackPts[bestIdx].poiName = wp.name || 'Point d\'intérêt';
      }
    });

    // B. Détection angulaire des virages et cols/sommets
    const stepMeters = 35; // Fenêtre d'analyse de 35m pour s'affranchir du bruit GPS
    for (let i = 5; i < trackPts.length - 5; i++) {
      // Trouver point en amont à ~35m
      let prevI = i - 1;
      while (prevI > 0 && (trackPts[i].dist - trackPts[prevI].dist) * 1000 < stepMeters) {
        prevI--;
      }
      // Trouver point en aval à ~35m
      let nextI = i + 1;
      while (nextI < trackPts.length - 1 && (trackPts[nextI].dist - trackPts[i].dist) * 1000 < stepMeters) {
        nextI++;
      }

      const pPrev = trackPts[prevI];
      const pCurr = trackPts[i];
      const pNext = trackPts[nextI];

      const bIn = this.calculateBearing(pPrev.lat, pPrev.lon, pCurr.lat, pCurr.lon);
      const bOut = this.calculateBearing(pCurr.lat, pCurr.lon, pNext.lat, pNext.lon);
      const angleDiff = Math.abs(((bOut - bIn + 540) % 360) - 180);

      // Virage en épingle (> 120°)
      if (angleDiff >= 120) {
        selectedIndices.add(i);
        trackPts[i].detectedType = 'Virage en épingle';
      }
      // Virage à 90° (entre 72° et 115°)
      else if (angleDiff >= 72 && angleDiff <= 115) {
        selectedIndices.add(i);
        trackPts[i].detectedType = 'Virage à 90°';
      }

      // Sommet local (inversion de pente)
      if (pCurr.smoothEle > pPrev.smoothEle + 6 && pCurr.smoothEle > pNext.smoothEle + 6) {
        selectedIndices.add(i);
        trackPts[i].detectedType = 'Sommet / Crête';
      }
      // Col local (creux)
      else if (pCurr.smoothEle < pPrev.smoothEle - 6 && pCurr.smoothEle < pNext.smoothEle - 6) {
        selectedIndices.add(i);
        trackPts[i].detectedType = 'Col / Bas de vallon';
      }
    }

    // Convertir en tableau trié par distance
    let sortedIndices = Array.from(selectedIndices).sort((a, b) => trackPts[a].dist - trackPts[b].dist);

    // Élagage des points trop rapprochés (garder au moins 120 mètres sauf départ/arrivée/POI)
    const prunedIndices = [sortedIndices[0]];
    for (let k = 1; k < sortedIndices.length - 1; k++) {
      const idx = sortedIndices[k];
      const prevIdx = prunedIndices[prunedIndices.length - 1];
      const distBetween = trackPts[idx].dist - trackPts[prevIdx].dist;
      if (distBetween >= 0.12 || trackPts[idx].poiName) {
        prunedIndices.push(idx);
      }
    }
    prunedIndices.push(sortedIndices[sortedIndices.length - 1]);

    // C. Contrainte stricte : Tronçons de 1,5 km maximum !
    // Si la distance entre deux points dépasse 1,5 km, insérer des points de repère intermédiaires
    const finalIndices = [];
    for (let k = 0; k < prunedIndices.length - 1; k++) {
      const idxA = prunedIndices[k];
      const idxB = prunedIndices[k + 1];
      finalIndices.push(idxA);

      const segmentDist = trackPts[idxB].dist - trackPts[idxA].dist;
      if (segmentDist > 1.5) {
        const numSplits = Math.ceil(segmentDist / 1.3); // fractionner à ~1.2 - 1.3 km
        const stepDist = segmentDist / numSplits;
        for (let s = 1; s < numSplits; s++) {
          const targetDist = trackPts[idxA].dist + s * stepDist;
          // Trouver le point le plus proche de targetDist
          let bestMidIdx = idxA;
          let minDiff = Infinity;
          for (let m = idxA + 1; m < idxB; m++) {
            const diff = Math.abs(trackPts[m].dist - targetDist);
            if (diff < minDiff) {
              minDiff = diff;
              bestMidIdx = m;
            }
          }
          finalIndices.push(bestMidIdx);
          trackPts[bestMidIdx].detectedType = `Point de repère (km ${trackPts[bestMidIdx].dist.toFixed(1)})`;
        }
      }
    }
    finalIndices.push(prunedIndices[prunedIndices.length - 1]);

    // 3. Construction des fiches points avec calcul de l'azimut de sortie immédiat
    const roadmapPoints = [];
    let cumulDPlus = 0;
    let cumulDMoins = 0;

    for (let i = 0; i < finalIndices.length; i++) {
      const ptIdx = finalIndices[i];
      const pt = trackPts[ptIdx];
      const isStart = i === 0;
      const isEnd = i === finalIndices.length - 1;

      // Azimut de sortie immédiat du sentier (sur 30 à 50 mètres)
      let exitAzimuth = '-';
      if (!isEnd) {
        let fwdIdx = ptIdx + 1;
        while (fwdIdx < trackPts.length - 1 && (trackPts[fwdIdx].dist - pt.dist) * 1000 < 40) {
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
        const prevIdx = finalIndices[i - 1];
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
      else if (pt.detectedType) designation = pt.detectedType;

      roadmapPoints.push({
        num: i,
        designation: designation,
        azimuth: exitAzimuth,
        altitude: Math.round(pt.smoothEle),
        distTroncon: distTroncon,
        vitesse: this.refSpeed,
        pause: (isStart ? 0 : (i === Math.floor(finalIndices.length / 2) ? 40 : 0)), // 40 min par défaut à mi-parcours (pique-nique)
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
   * Recalcule tous les temps de marche et heures d'arrivée selon les vitesses et pauses
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
        // Calcul FFRandonnée : (Distance / Vitesse) * 60 + D+ / 300 * 60 + Pause
        const tempsMarcheMin = (p.distTroncon / vit) * 60;
        const tempsDPlusMin = (p.deniveleTroncon > 0) ? (p.deniveleTroncon / 300) * 60 : 0;
        p.tempsTronconMin = Math.round(tempsMarcheMin + tempsDPlusMin + (p.pause || 0));
        currentHeure = this.addMinutesToTime(currentHeure, p.tempsTronconMin);
        p.heureArrivee = currentHeure;
      }
    }
  }

  /**
   * Ouverture du panneau / modal Tableau de Marche FFR
   */
  openRoadmapModal() {
    // Récupérer la trace active
    const mapMgr = window.MapManagerInstance;
    const track = mapMgr?.standaloneHike || (mapMgr?.standaloneTracks && mapMgr.standaloneTracks[0]) || mapMgr?.currentHike;

    if (!track) {
      alert("⚠️ Aucune trace GPX n'est actuellement affichée sur la carte.\n\nVeuillez d'abord charger une trace GPX pour générer son Tableau de Marche FFR.");
      return;
    }

    this.currentTrack = track;
    this.hikeName = track.name || 'Randonnée';
    this.animatorName = window.AuthManagerInstance?.getCurrentUser()?.username || 'Animateur FFR';

    // Analyse et extraction des points
    this.analyzeTrack(track);

    // Construction et affichage du DOM
    this.renderModal();
  }

  renderModal() {
    if (this.modalEl) this.modalEl.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-ffr-roadmap';
    modal.className = 'fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex flex-col p-2 sm:p-4 text-white animate-in fade-in duration-200 overflow-hidden';
    modal.innerHTML = `
      <!-- Entête du Tableau de Marche -->
      <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 flex-shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-lg shadow-lg shadow-emerald-950/60 font-black">
            📋
          </div>
          <div>
            <h2 class="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>Tableau de Marche FFRandonnée</span>
              <span class="px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 text-[10px] font-bold border border-emerald-700/50">Tronçons ≤ 1.5 km</span>
            </h2>
            <div class="text-xs text-slate-400 flex items-center gap-3">
              <span>Rando : <strong class="text-slate-200">${this.escapeHtml(this.hikeName)}</strong></span>
              <span>•</span>
              <span>Distance : <strong class="text-sky-400">${this.points[this.points.length - 1]?.cumulDist || 0} km</strong></span>
              <span>•</span>
              <span>D+ : <strong class="text-emerald-400">+${this.points[this.points.length - 1]?.cumulDPlus || 0} m</strong></span>
            </div>
          </div>
        </div>

        <!-- Paramètres rapides (Heure départ, Vitesse réf, Animateur) -->
        <div class="flex items-center gap-2.5 flex-wrap">
          <div class="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs">
            <span class="text-slate-400 font-semibold">Départ :</span>
            <input id="ffr-input-start-time" type="time" step="1" value="${this.startTime}" class="bg-transparent text-white font-bold text-xs focus:outline-none w-20 cursor-pointer" />
          </div>

          <div class="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs">
            <span class="text-slate-400 font-semibold">Vitesse réf :</span>
            <input id="ffr-input-ref-speed" type="number" step="0.1" value="${this.refSpeed}" class="bg-transparent text-white font-bold text-xs focus:outline-none w-12 cursor-pointer text-center" />
            <span class="text-slate-500 text-[10px]">km/h</span>
          </div>

          <button id="btn-ffr-export-csv" type="button" class="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer" title="Télécharger le fichier CSV officiel FFR">
            <span>📥</span> <span>Export CSV</span>
          </button>

          <button id="btn-ffr-print" type="button" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer" title="Imprimer le tableau de marche">
            <span>🖨️</span> <span>Imprimer</span>
          </button>

          <button id="btn-ffr-close" type="button" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-white flex items-center justify-center font-bold text-base transition cursor-pointer" title="Fermer">✕</button>
        </div>
      </div>

      <!-- Zone Principale : Tableau Transposé (En haut) + Profil Altimétrique Aligné (En dessous) -->
      <div class="flex-1 flex flex-col min-h-0 overflow-hidden my-2">
        <!-- 1. TABLEAU TRANSPOSÉ (Colonnes = Points 0, 1, 2... défilant de gauche à droite) -->
        <div id="ffr-transposed-table-container" class="flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/60 relative select-none">
          ${this.buildTransposedTableHtml()}
        </div>

        <!-- 2. PROFIL ALTIMÉTRIQUE EN REGARD ALIGNÉ VERTICALEMENT (En dessous du tableau) -->
        <div id="ffr-aligned-profile-container" class="h-44 sm:h-52 bg-slate-900/90 rounded-xl border border-slate-800 mt-2 p-2 flex flex-col flex-shrink-0 relative">
          <div class="flex items-center justify-between text-[11px] text-slate-400 px-2 pb-1 border-b border-slate-800/60">
            <span class="font-bold text-emerald-300 flex items-center gap-1.5">
              <span>▲</span> <span>Profil Altimétrique &amp; Repères Verticaux des Points</span>
            </span>
            <span class="text-[10px] text-slate-500">Survolez une colonne ou un point pour synchroniser le profil et la carte</span>
          </div>
          <div id="ffr-svg-profile-wrapper" class="flex-1 relative w-full h-full min-h-0 mt-1">
            ${this.buildSvgProfileHtml()}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalEl = modal;

    this.bindModalEvents();
  }

  /**
   * Génère le HTML du tableau transposé (Lignes = Métriques, Colonnes = Points 0..N)
   */
  buildTransposedTableHtml() {
    const totalPoints = this.points.length;
    if (totalPoints === 0) return '<div class="p-4 text-center text-slate-400 text-xs">Aucun point détecté.</div>';

    // Définition des lignes (métriques)
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
      // Cellule d'en-tête de ligne (Sticky gauche)
      html += `
        <th class="sticky left-0 z-20 ${rowBg} px-3 py-2 text-[11px] font-extrabold text-slate-300 border-r border-slate-800 whitespace-nowrap min-w-[170px] shadow-sm">
          ${row.label}
        </th>
      `;

      // Colonnes des points 0..N
      this.points.forEach((p, cIdx) => {
        const isStart = cIdx === 0;
        const isEnd = cIdx === totalPoints - 1;
        const colClass = `ffr-col-${cIdx} px-2.5 py-1.5 text-center whitespace-nowrap border-r border-slate-800/40 min-w-[110px] transition-colors`;

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
          cellContent = `<input type="text" class="ffr-input-cell ffr-edit-name bg-slate-900/90 text-white font-bold text-[11px] px-2 py-1 rounded border border-slate-700/80 w-full text-center focus:border-sky-400 focus:outline-none" data-idx="${cIdx}" value="${this.escapeHtml(p.designation)}" />`;
        } else if (row.isBadge) {
          cellContent = p.azimuth !== '-' ? `<span class="px-2 py-0.5 rounded bg-sky-950 border border-sky-700/80 text-sky-300 font-mono font-black text-[11px]">🧭 ${p.azimuth}°</span>` : '<span class="text-slate-600 font-mono">-</span>';
        } else if (row.isEditableSpeed) {
          cellContent = isStart ? '<span class="text-slate-600">-</span>' : `<input type="number" step="0.1" min="1" max="10" class="ffr-input-cell ffr-edit-speed bg-slate-900/90 text-amber-300 font-bold text-[11px] px-1.5 py-1 rounded border border-slate-700/80 w-16 text-center focus:border-amber-400 focus:outline-none" data-idx="${cIdx}" value="${p.vitesse}" />`;
        } else if (row.isEditablePause) {
          cellContent = isStart ? '<span class="text-slate-600">-</span>' : `<input type="number" step="1" min="0" max="180" class="ffr-input-cell ffr-edit-pause bg-slate-900/90 text-amber-300 font-bold text-[11px] px-1.5 py-1 rounded border border-slate-700/80 w-16 text-center focus:border-amber-400 focus:outline-none" data-idx="${cIdx}" value="${p.pause}" />`;
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
          cellContent = `<input type="text" placeholder="Note..." class="ffr-input-cell ffr-edit-info bg-slate-900/90 text-slate-300 text-[10px] px-2 py-1 rounded border border-slate-700/80 w-full text-center focus:border-sky-400 focus:outline-none" data-idx="${cIdx}" value="${this.escapeHtml(p.info)}" />`;
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
    const height = 150;
    const paddingLeft = 40;
    const paddingRight = 30;
    const paddingTop = 25;
    const paddingBottom = 25;

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

    // Fermer le tracé pour le dégradé sous le profil
    const areaD = `${pathD} L ${(paddingLeft + plotWidth).toFixed(1)} ${(paddingTop + plotHeight).toFixed(1)} L ${paddingLeft} ${(paddingTop + plotHeight).toFixed(1)} Z`;

    // Repères verticaux pour chaque point du tableau de marche
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
          <circle r="9" fill="${pinColor}" stroke="#ffffff" stroke-width="2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))" />
          <text text-anchor="middle" dy="3.5" fill="#ffffff" font-size="9" font-weight="900" font-family="sans-serif">${p.num}</text>
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

        <!-- Fond de grille et axes -->
        <line x1="${paddingLeft}" y1="${paddingTop + plotHeight}" x2="${paddingLeft + plotWidth}" y2="${paddingTop + plotHeight}" stroke="#475569" stroke-width="1.5" />
        <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${paddingTop + plotHeight}" stroke="#475569" stroke-width="1.5" />

        <!-- Remplissage dégradé et courbe altimétrique -->
        <path d="${areaD}" fill="url(#ffrProfileGrad)" />
        <path d="${pathD}" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />

        <!-- Repères de chaque point -->
        ${pinsSvg}

        <!-- Étiquettes d'altitude min / max -->
        <text x="${paddingLeft - 6}" y="${paddingTop + 5}" text-anchor="end" fill="#94a3b8" font-size="9" font-weight="bold">${Math.round(maxEle)}m</text>
        <text x="${paddingLeft - 6}" y="${paddingTop + plotHeight}" text-anchor="end" fill="#94a3b8" font-size="9" font-weight="bold">${Math.round(minEle)}m</text>
        <text x="${paddingLeft + plotWidth}" y="${paddingTop + plotHeight + 14}" text-anchor="end" fill="#94a3b8" font-size="9" font-weight="bold">${totalDist.toFixed(1)} km</text>
      </svg>
    `;
  }

  /**
   * Événements du modal (saisie des vitesses, pauses, centrage carte, exports)
   */
  bindModalEvents() {
    if (!this.modalEl) return;

    // Fermeture
    this.modalEl.querySelector('#btn-ffr-close')?.addEventListener('click', () => {
      this.closeModal();
    });

    // Modification Heure de départ
    this.modalEl.querySelector('#ffr-input-start-time')?.addEventListener('change', (e) => {
      this.startTime = e.target.value || "09:30:00";
      this.recalculateTimes();
      this.refreshTableAndProfile();
    });

    // Modification Vitesse de référence globale
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

    // Écouteurs de modification dans les cellules
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

    // Centrage sur la carte au clic sur le numéro de point
    this.modalEl.querySelectorAll('.ffr-btn-center-point, .ffr-pin-group').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        this.highlightPointOnMap(idx);
      });
    });

    // Survol synchronisé (Tableau <-> Profil SVG)
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

    // Bouton Export CSV
    this.modalEl.querySelector('#btn-ffr-export-csv')?.addEventListener('click', () => {
      this.exportCsv();
    });

    // Bouton Imprimer
    this.modalEl.querySelector('#btn-ffr-print')?.addEventListener('click', () => {
      this.printRoadmap();
    });
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
      pin.setAttribute('stroke-width', active ? '4' : '2');
      pin.setAttribute('r', active ? '11' : '9');
    }
  }

  highlightPointOnMap(idx) {
    const pt = this.points[idx];
    const map = window.MapManagerInstance?.map;
    if (!pt || !map) return;

    map.panTo([pt.lat, pt.lon], { animate: true });

    if (this.mapHighlightMarker) {
      map.removeLayer(this.mapHighlightMarker);
    }

    this.mapHighlightMarker = L.circleMarker([pt.lat, pt.lon], {
      radius: 12,
      color: '#ffffff',
      weight: 3,
      fillColor: '#38bdf8',
      fillOpacity: 0.9
    }).addTo(map);

    this.mapHighlightMarker.bindPopup(`
      <div style="font-family:sans-serif; text-align:left; min-width:140px; padding:3px;">
        <div style="font-weight:900; color:#0284c7; font-size:13px;">Point ${pt.num} : ${this.escapeHtml(pt.designation)}</div>
        <div style="font-size:11px; color:#475569; margin-top:2px;">Altitude : <strong>${pt.altitude} m</strong></div>
        <div style="font-size:11px; color:#475569;">Azimut sortie : <strong>${pt.azimuth}°</strong></div>
        <div style="font-size:11px; color:#475569;">Heure estimée : <strong>${pt.heureArrivee}</strong></div>
      </div>
    `).openPopup();
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
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
    if (this.mapHighlightMarker && window.MapManagerInstance?.map) {
      window.MapManagerInstance.map.removeLayer(this.mapHighlightMarker);
      this.mapHighlightMarker = null;
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
