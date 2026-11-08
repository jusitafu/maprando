
  // ====================================================================
  // RECHERCHE ET TRACÉ RÉELS DES GR (tous les GR, géométrie OpenStreetMap)
  // via l'API Waymarked Trails (relations OSM de sentiers de randonnée)
  // ====================================================================
  static WMT = 'https://hiking.waymarkedtrails.org/api/v1';
  static _remoteCache = new Map();
  static _detailCache = new Map();
  static _renderToken = 0;

  static isGrQuery(query) {
    return /^\s*GR\s*\d/i.test(query || '') || /^\s*GR\s*$/i.test(query || '');
  }

  static _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  static _merc2ll(x, y) {
    const lon = (x / 20037508.34) * 180;
    const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((y / 20037508.34) * Math.PI)) - Math.PI / 2);
    return [lat, lon];
  }

  /** Recherche tous les GR correspondant à "GR XX" (y compris variantes GR 20A, GR 653...) */
  static async searchRemote(query) {
    const m = (query || '').trim().match(/^GR\s*(\d+)\s*([A-Za-z]{0,2})/i);
    if (!m) return [];
    const num = m[1];
    const suffix = (m[2] || '').toUpperCase();
    const key = `${num}${suffix}`;
    if (this._remoteCache.has(key)) return this._remoteCache.get(key);

    const url = `${this.WMT}/list/search?limit=60&query=${encodeURIComponent('GR ' + num + suffix)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const seen = new Set();
    let list = (data.results || []).filter(r => {
      if (!r || !r.ref || seen.has(r.id)) return false;
      const ref = r.ref.toUpperCase().replace(/\s+/g, '');
      const mm = ref.match(/^GR(\d+)([A-Z]*)/);
      if (!mm || mm[1] !== num) return false;
      if (suffix && !mm[2].startsWith(suffix)) return false;
      seen.add(r.id);
      return true;
    });
    const score = r => {
      let s = 0;
      if (r.ref.toUpperCase().replace(/\s+/g, '') === 'GR' + key) s += 100;
      if (r.group === 'NAT') s += 20;
      if (r.itinerary && r.itinerary.length) s += 10;
      if (/variante|alternat/i.test(r.name || '')) s -= 15;
      return s;
    };
    list.sort((a, b) => score(b) - score(a));
    list = list.slice(0, 8);
    this._remoteCache.set(key, list);
    return list;
  }

  /** Remplit le conteneur de résultats avec les GR trouvés (asynchrone, anti-scintillement) */
  static async renderResults(container, query, onPick) {
    if (!container) return;
    const token = ++this._renderToken;
    container.classList.remove('hidden');
    container.style.backgroundColor = '#ffffff';
    container.style.opacity = '1';

    if (/^\s*GR\s*$/i.test(query)) {
      container.innerHTML = '<div class="p-3 text-xs text-slate-600 text-center">🚩 Tapez le numéro du GR (ex : <b>GR 20</b>, <b>GR 653</b>, <b>GR 2013</b>…)</div>';
      return;
    }
    container.innerHTML = '<div class="p-3 text-xs text-slate-500 text-center"><span class="inline-block animate-spin mr-1">⏳</span> Recherche du sentier ' + this._esc(query.trim()) + '…</div>';

    let items = [];
    try {
      items = await this.searchRemote(query);
    } catch (e) {
      if (token !== this._renderToken) return;
      // Repli hors-ligne : catalogue intégré (tracés schématiques)
      const fb = this.search(query);
      if (fb.length) {
        container.innerHTML = '';
        fb.forEach(gr => this._appendCatalogItem(container, gr, onPick));
      } else {
        container.innerHTML = '<div class="p-3 text-xs text-rose-600 text-center">⚠️ Service de sentiers indisponible. Réessayez dans un instant.</div>';
      }
      return;
    }
    if (token !== this._renderToken) return;

    if (!items.length) {
      container.innerHTML = '<div class="p-3 text-xs text-slate-500 text-center">Aucun sentier « ' + this._esc(query.trim()) + ' » trouvé dans OpenStreetMap.</div>';
      return;
    }
    container.innerHTML = '';
    items.forEach(it => {
      const div = document.createElement('div');
      div.className = 'search-item px-3 py-2 cursor-pointer transition flex items-center gap-2.5 border-b border-rose-200/90 hover:bg-rose-100 text-left';
      div.style.backgroundColor = '#fff1f2';
      const itin = (it.itinerary && it.itinerary.length) ? it.itinerary.filter(Boolean) : [];
      const sub = itin.length ? (itin[0] + ' ➔ ' + itin[itin.length - 1]) : (it.operator || '');
      div.innerHTML = `
        <span class="bg-rose-600 text-white font-black text-[11px] px-2 py-0.5 rounded-md shadow uppercase tracking-wide flex-shrink-0">${this._esc(it.ref)}</span>
        <div class="flex-1 min-w-0">
          <div class="font-extrabold text-slate-900 text-xs truncate">${this._esc(it.name || it.ref)}</div>
          <div class="text-[10px] text-rose-700 font-semibold truncate mt-0.5">${this._esc(sub)}</div>
        </div>
        <span class="text-xs text-rose-600 font-bold flex-shrink-0">Afficher ➔</span>`;
      div.addEventListener('click', () => {
        container.classList.add('hidden');
        if (typeof onPick === 'function') onPick(it);
        this.displayRemote(it, window.MapManagerInstance ? window.MapManagerInstance.map : null);
      });
      container.appendChild(div);
    });
  }

  static _appendCatalogItem(container, gr, onPick) {
    const div = document.createElement('div');
    div.className = 'search-item px-3 py-2 cursor-pointer flex items-center gap-2.5 border-b border-rose-200/90 hover:bg-rose-100';
    div.style.backgroundColor = '#fff1f2';
    div.innerHTML = `<span class="bg-rose-600 text-white font-black text-[11px] px-2 py-0.5 rounded-md">${gr.ref}</span><div class="flex-1 min-w-0 text-xs font-bold truncate">${gr.name} <span class="text-[10px] text-slate-500">(tracé schématique)</span></div>`;
    div.addEventListener('click', () => {
      container.classList.add('hidden');
      if (typeof onPick === 'function') onPick(gr);
      this.displayGr(gr, window.MapManagerInstance ? window.MapManagerInstance.map : null);
    });
    container.appendChild(div);
  }

  static _extractSegments(route) {
    const ways = [];
    const walk = (o) => {
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o.ways)) o.ways.forEach(w => ways.push(w));
      if (o.main) walk(o.main);
      if (o.appendices) walk(o.appendices);
    };
    walk(route);
    const seenIds = new Set();
    const segs = [];
    ways.forEach(w => {
      if (!w.geometry || !Array.isArray(w.geometry.coordinates)) return;
      if (w.id != null) { if (seenIds.has(w.id)) return; seenIds.add(w.id); }
      let prev = null;
      const pts = [];
      const coords = w.geometry.coordinates;
      coords.forEach((c, idx) => {
        // décimation légère (~15 m) pour garder un affichage fluide sur les longs GR
        if (prev && idx !== coords.length - 1 && Math.abs(c[0] - prev[0]) + Math.abs(c[1] - prev[1]) < 15) return;
        prev = c;
        pts.push(this._merc2ll(c[0], c[1]));
      });
      if (pts.length > 1) segs.push(pts);
    });
    return segs;
  }

  /** Charge la géométrie OSM réelle d'un GR et l'affiche en rouge clignotant */
  static async displayRemote(item, map) {
    if (!map) {
      if (window.MapManagerInstance && window.MapManagerInstance.map) map = window.MapManagerInstance.map;
      else return;
    }
    this.clearGr(map);
    this.showLoadingBanner(item);
    let det = this._detailCache.get(item.id);
    try {
      if (!det) {
        const resp = await fetch(`${this.WMT}/details/relation/${item.id}`);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        det = await resp.json();
        this._detailCache.set(item.id, det);
      }
    } catch (e) {
      this.removeGrBanner();
      alert('Impossible de charger le tracé de ' + item.ref + ' (service indisponible).');
      return;
    }
    const segs = this._extractSegments(det.route);
    if (!segs.length) {
      this.removeGrBanner();
      alert('Aucune géométrie disponible pour ' + item.ref + '.');
      return;
    }

    this.currentGrLayer = L.layerGroup();
    this.currentGrLayer.addLayer(L.polyline(segs, { color: '#ffffff', weight: 8, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }));
    this.currentGrLayer.addLayer(L.polyline(segs, { color: '#e11d48', weight: 5.5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false, className: 'leaflet-gr-blinking-path' }));
    this.currentGrLayer.addLayer(L.polyline(segs, { color: '#ffffff', weight: 2.5, dashArray: '12, 10', opacity: 0.95, interactive: false, className: 'leaflet-gr-blinking-dash' }));
    this.currentGrLayer.addTo(map);

    const container = map.getContainer();
    if (container) container.classList.add('leaflet-gr-blinking');

    let bounds = null;
    if (Array.isArray(det.bbox) && det.bbox.length === 4) {
      const sw = this._merc2ll(det.bbox[0], det.bbox[1]);
      const ne = this._merc2ll(det.bbox[2], det.bbox[3]);
      bounds = L.latLngBounds(sw, ne);
    } else {
      bounds = L.latLngBounds(segs.flat());
    }
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });

    const itin = (det.itinerary && det.itinerary.length) ? det.itinerary.filter(Boolean) : [];
    this.showGrBanner({
      ref: det.ref || item.ref,
      name: det.name || item.name || item.ref,
      distKm: det.route && det.route.length ? Math.round(det.route.length / 1000) : null,
      dplus: null,
      start: itin[0] || (det.tags && det.tags.from) || '',
      finish: itin[itin.length - 1] || (det.tags && det.tags.to) || ''
    }, map);
  }

  static showLoadingBanner(item) {
    this.removeGrBanner();
    const banner = document.createElement('div');
    banner.id = 'gr-floating-banner';
    banner.className = 'fixed top-16 left-1/2 -translate-x-1/2 z-[1500] bg-slate-900/95 text-white px-4 py-2.5 rounded-2xl shadow-2xl border-2 border-rose-500/80 text-xs font-bold';
    banner.innerHTML = '<span class="inline-block animate-spin mr-1">⏳</span> Chargement du tracé ' + this._esc(item.ref) + '…';
    document.body.appendChild(banner);
    this.currentGrBanner = banner;
  }
