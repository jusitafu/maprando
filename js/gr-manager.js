/**
 * MapRando - Gestionnaire et Répertoire des GR (Sentiers de Grande Randonnée)
 * Permet la recherche directe par "GR XX", l'affichage haute visibilité
 * et le clignotement animé du tracé officiel sur la carte.
 */
class GrManager {
  static catalog = [
    {
      ref: 'GR 20',
      num: '20',
      name: 'Traversée de la Corse (Fra li Monti)',
      region: 'Corse (Haute-Corse & Corse-du-Sud)',
      start: 'Calenzana',
      finish: 'Conca',
      distKm: 183,
      dplus: 11000,
      bounds: [[41.70, 8.80], [42.55, 9.40]],
      center: [42.15, 9.10],
      osmRelationId: 101692,
      // Tracé géométrique représentatif de la dorsale corse
      track: [
        [42.507, 8.855], [42.470, 8.870], [42.435, 8.910], [42.395, 8.925],
        [42.380, 8.940], [42.350, 8.930], [42.300, 8.970], [42.270, 9.010],
        [42.230, 9.050], [42.180, 9.080], [42.120, 9.120], [42.060, 9.140],
        [42.020, 9.160], [41.970, 9.200], [41.910, 9.220], [41.860, 9.250],
        [41.810, 9.270], [41.760, 9.300], [41.725, 9.335]
      ]
    },
    {
      ref: 'GR 51',
      num: '51',
      name: 'Balcons de la Méditerranée',
      region: 'Provence-Alpes-Côte d’Azur (Alpes-Maritimes, Var, Bouches-du-Rhône)',
      start: 'Menton',
      finish: 'Marseille (La Madrague)',
      distKm: 460,
      dplus: 14000,
      bounds: [[43.15, 5.35], [43.85, 7.50]],
      center: [43.40, 6.40],
      track: [
        [43.775, 7.498], [43.740, 7.420], [43.730, 7.350], [43.720, 7.250],
        [43.710, 7.150], [43.700, 7.020], [43.660, 6.920], [43.620, 6.780],
        [43.580, 6.640], [43.530, 6.500], [43.480, 6.360], [43.420, 6.220],
        [43.360, 6.080], [43.310, 5.940], [43.250, 5.800], [43.210, 5.660],
        [43.180, 5.520], [43.210, 5.380]
      ]
    },
    {
      ref: 'GR 98',
      num: '98',
      name: 'Sentier des Calanques de Marseille à La Ciotat',
      region: 'Bouches-du-Rhône (Parc National des Calanques)',
      start: 'Marseille (La Madrague de Montredon)',
      finish: 'La Ciotat (Gare)',
      distKm: 28,
      dplus: 1250,
      bounds: [[43.18, 5.35], [43.25, 5.62]],
      center: [43.21, 5.48],
      track: [
        [43.242, 5.362], [43.235, 5.378], [43.228, 5.395], [43.215, 5.420],
        [43.208, 5.445], [43.203, 5.472], [43.205, 5.500], [43.212, 5.525],
        [43.215, 5.548], [43.205, 5.570], [43.195, 5.590], [43.185, 5.608]
      ]
    },
    {
      ref: 'GR 5',
      num: '5',
      name: 'Grande Traversée des Alpes (GTA) & Mer du Nord - Méditerranée',
      region: 'Haute-Savoie, Savoie, Hautes-Alpes, Alpes-Maritimes',
      start: 'Saint-Gingolph (Lac Léman)',
      finish: 'Nice / Menton',
      distKm: 660,
      dplus: 34000,
      bounds: [[43.70, 6.70], [46.40, 7.30]],
      center: [45.10, 6.90],
      track: [
        [46.390, 6.800], [46.220, 6.840], [46.010, 6.880], [45.850, 6.780],
        [45.680, 6.720], [45.500, 6.850], [45.320, 6.950], [45.150, 6.700],
        [44.950, 6.650], [44.750, 6.750], [44.520, 6.850], [44.250, 6.950],
        [44.020, 7.150], [43.850, 7.300], [43.700, 7.350]
      ]
    },
    {
      ref: 'GR 10',
      num: '10',
      name: 'La Grande Traversée des Pyrénées (Océan Atlantique - Méditerranée)',
      region: 'Pyrénées-Atlantiques, Hautes-Pyrénées, Haute-Garonne, Ariège, Pyrénées-Orientales',
      start: 'Hendaye',
      finish: 'Banyuls-sur-Mer',
      distKm: 920,
      dplus: 55000,
      bounds: [[42.40, -1.80], [43.40, 3.15]],
      center: [42.85, 0.70],
      track: [
        [43.370, -1.770], [43.310, -1.450], [43.160, -1.240], [43.050, -0.950],
        [42.920, -0.650], [42.840, -0.320], [42.810, 0.050], [42.820, 0.420],
        [42.830, 0.810], [42.780, 1.150], [42.720, 1.480], [42.650, 1.820],
        [42.540, 2.150], [42.480, 2.520], [42.450, 2.850], [42.480, 3.130]
      ]
    },
    {
      ref: 'GR 34',
      num: '34',
      name: 'Le Sentier des Douaniers (Tour de Bretagne)',
      region: 'Normandie, Bretagne, Pays de la Loire',
      start: 'Mont-Saint-Michel',
      finish: 'Saint-Nazaire',
      distKm: 2000,
      dplus: 22000,
      bounds: [[47.25, -4.85], [48.90, -1.50]],
      center: [48.20, -3.20],
      track: [
        [48.636, -1.511], [48.650, -1.950], [48.630, -2.400], [48.780, -3.020],
        [48.830, -3.550], [48.720, -4.050], [48.550, -4.720], [48.350, -4.620],
        [48.200, -4.550], [48.050, -4.720], [47.820, -4.350], [47.800, -3.750],
        [47.600, -3.150], [47.550, -2.750], [47.300, -2.450], [47.270, -2.210]
      ]
    },
    {
      ref: 'GR 70',
      num: '70',
      name: 'Le Chemin de Stevenson (Cévennes)',
      region: 'Auvergne-Rhône-Alpes, Occitanie (Haute-Loire, Lozère, Ardèche, Gard)',
      start: 'Le Puy-en-Velay',
      finish: 'Alès',
      distKm: 272,
      dplus: 7500,
      bounds: [[44.10, 3.65], [45.05, 4.05]],
      center: [44.55, 3.85],
      track: [
        [45.043, 3.885], [44.910, 3.920], [44.780, 3.950], [44.640, 3.900],
        [44.520, 3.820], [44.400, 3.750], [44.320, 3.710], [44.220, 3.800],
        [44.150, 3.950], [44.125, 4.080]
      ]
    },
    {
      ref: 'GR 65',
      num: '65',
      name: 'Chemin de Saint-Jacques de Compostelle (Via Podiensis)',
      region: 'Massif Central, Occitanie, Nouvelle-Aquitaine',
      start: 'Le Puy-en-Velay',
      finish: 'Saint-Jean-Pied-de-Port',
      distKm: 750,
      dplus: 16000,
      bounds: [[43.15, -1.25], [45.05, 3.90]],
      center: [44.10, 1.30],
      track: [
        [45.043, 3.885], [44.850, 3.550], [44.680, 3.150], [44.520, 2.650],
        [44.590, 2.380], [44.600, 1.950], [44.450, 1.450], [44.200, 1.050],
        [44.050, 0.650], [43.850, 0.250], [43.650, -0.250], [43.350, -0.850],
        [43.163, -1.238]
      ]
    },
    {
      ref: 'GR 4',
      num: '4',
      name: 'De l’Atlantique à la Provence (Gorges du Verdon)',
      region: 'Nouvelle-Aquitaine, Auvergne-Rhône-Alpes, Provence',
      start: 'Royan',
      finish: 'Grasse',
      distKm: 1470,
      dplus: 21000,
      bounds: [[43.65, -1.05], [45.75, 6.95]],
      center: [44.70, 2.90],
      track: [
        [45.620, -1.020], [45.700, 0.500], [45.750, 1.900], [45.550, 2.800],
        [45.100, 3.200], [44.500, 4.400], [44.150, 5.000], [43.850, 5.850],
        [43.720, 6.380], [43.660, 6.920]
      ]
    },
    {
      ref: 'GR 9',
      num: '9',
      name: 'Du Jura à la Méditerranée',
      region: 'Bourgogne-Franche-Comté, Auvergne-Rhône-Alpes, PACA',
      start: 'Saint-Amour (Jura)',
      finish: 'Port Grimaud (Golfe de Saint-Tropez)',
      distKm: 980,
      dplus: 28000,
      bounds: [[43.25, 5.25], [46.50, 6.00]],
      center: [44.85, 5.60],
      track: [
        [46.480, 5.350], [46.100, 5.600], [45.700, 5.850], [45.250, 5.800],
        [44.750, 5.500], [44.200, 5.300], [43.850, 5.550], [43.450, 5.850],
        [43.280, 6.580]
      ]
    },
    {
      ref: 'GR 2013',
      num: '2013',
      name: 'Sentier Métropolitain d’Aix-Marseille Provence',
      region: 'Bouches-du-Rhône (Marseille, Vitrolles, Aix, Aubagne)',
      start: 'Marseille Saint-Charles',
      finish: 'Marseille (Boucle)',
      distKm: 365,
      dplus: 8500,
      bounds: [[43.25, 5.15], [43.60, 5.65]],
      center: [43.42, 5.40],
      track: [
        [43.300, 5.380], [43.380, 5.250], [43.450, 5.250], [43.520, 5.450],
        [43.480, 5.600], [43.380, 5.550], [43.300, 5.450], [43.300, 5.380]
      ]
    },
    {
      ref: 'GR 54',
      num: '54',
      name: 'Tour de l’Oisans et des Écrins',
      region: 'Isère & Hautes-Alpes (Parc National des Écrins)',
      start: 'Le Bourg-d’Oisans',
      finish: 'Le Bourg-d’Oisans (Boucle)',
      distKm: 176,
      dplus: 12800,
      bounds: [[44.75, 6.05], [45.10, 6.50]],
      center: [44.92, 6.28],
      track: [
        [45.055, 6.030], [45.020, 6.180], [45.040, 6.380], [44.950, 6.480],
        [44.820, 6.450], [44.760, 6.250], [44.850, 6.080], [45.055, 6.030]
      ]
    },
    {
      ref: 'GR 58',
      num: '58',
      name: 'Tour du Queyras',
      region: 'Hautes-Alpes (Parc Naturel Régional du Queyras)',
      start: 'Guillestre / Ceillac',
      finish: 'Guillestre (Boucle)',
      distKm: 130,
      dplus: 9000,
      bounds: [[44.60, 6.60], [44.85, 7.10]],
      center: [44.72, 6.85],
      track: [
        [44.660, 6.650], [44.670, 6.780], [44.650, 6.950], [44.750, 7.050],
        [44.820, 6.950], [44.800, 6.750], [44.720, 6.680], [44.660, 6.650]
      ]
    },
    {
      ref: 'GR 1',
      num: '1',
      name: 'Tour d’Île-de-France',
      region: 'Île-de-France (Ceinture verte autour de Paris)',
      start: 'Porte Maillot (Paris)',
      finish: 'Porte Maillot (Boucle)',
      distKm: 540,
      dplus: 4500,
      bounds: [[48.35, 1.80], [49.20, 3.10]],
      center: [48.80, 2.45],
      track: [
        [48.875, 2.280], [48.950, 2.100], [49.100, 2.300], [49.120, 2.800],
        [48.900, 3.050], [48.550, 2.950], [48.400, 2.650], [48.450, 2.100],
        [48.700, 1.900], [48.875, 2.280]
      ]
    },
    {
      ref: 'GR 2',
      num: '2',
      name: 'Au fil de la Seine (Des sources à la mer)',
      region: 'Bourgogne, Île-de-France, Normandie',
      start: 'Source de la Seine (Côte-d’Or)',
      finish: 'Le Havre',
      distKm: 850,
      dplus: 6200,
      bounds: [[47.45, 0.10], [49.50, 4.75]],
      center: [48.50, 2.40],
      track: [
        [47.495, 4.710], [47.850, 4.500], [48.300, 4.080], [48.550, 3.200],
        [48.850, 2.350], [49.050, 1.800], [49.440, 1.100], [49.490, 0.110]
      ]
    },
    {
      ref: 'GR 3',
      num: '3',
      name: 'La Loire Sauvage',
      region: 'Auvergne, Centre-Val de Loire, Pays de la Loire',
      start: 'Mont Gerbier-de-Jonc',
      finish: 'La Baule / Guérande',
      distKm: 1240,
      dplus: 8500,
      bounds: [[44.80, -2.40], [47.95, 4.25]],
      center: [46.35, 0.90],
      track: [
        [44.840, 4.220], [45.400, 4.100], [46.100, 3.800], [46.700, 3.400],
        [47.500, 2.700], [47.900, 1.900], [47.400, 0.700], [47.300, -0.600],
        [47.200, -1.550], [47.290, -2.390]
      ]
    },
    {
      ref: 'GR 21',
      num: '21',
      name: 'Les Falaises de la Côte d’Albâtre (Étretat)',
      region: 'Normandie (Seine-Maritime)',
      start: 'Le Havre',
      finish: 'Le Tréport',
      distKm: 190,
      dplus: 3400,
      bounds: [[49.50, 0.10], [50.10, 1.40]],
      center: [49.80, 0.75],
      track: [
        [49.490, 0.110], [49.707, 0.203], [49.760, 0.360], [49.860, 0.700],
        [49.920, 1.080], [50.060, 1.370]
      ]
    },
    {
      ref: 'GR 30',
      num: '30',
      name: 'Tour des Volcans et Lacs d’Auvergne',
      region: 'Auvergne (Puy-de-Dôme)',
      start: 'Mont-Dore',
      finish: 'Mont-Dore (Boucle)',
      distKm: 198,
      dplus: 5600,
      bounds: [[45.35, 2.75], [45.75, 3.05]],
      center: [45.55, 2.90],
      track: [
        [45.570, 2.810], [45.680, 2.950], [45.550, 3.020], [45.420, 2.950],
        [45.450, 2.800], [45.570, 2.810]
      ]
    },
    {
      ref: 'GR 400',
      num: '400',
      name: 'Tour du Volcan Cantalien (Puy Mary)',
      region: 'Auvergne (Cantal)',
      start: 'Murat',
      finish: 'Murat (Boucle)',
      distKm: 140,
      dplus: 5800,
      bounds: [[45.00, 2.60], [45.20, 2.95]],
      center: [45.10, 2.78],
      track: [
        [45.110, 2.870], [45.150, 2.750], [45.120, 2.650], [45.050, 2.680],
        [45.080, 2.820], [45.110, 2.870]
      ]
    }
  ];

  static currentGrLayer = null;
  static currentGrBanner = null;

  /**
   * Recherche un ou plusieurs GR selon la saisie utilisateur (ex: "GR 20", "GR20", "GR 51", "GR")
   * @param {string} query 
   * @returns {Array} Liste des GR correspondants
   */
  static search(query) {
    if (!query) return [];
    const clean = query.trim().toUpperCase().replace(/\s+/g, ' ');
    const numMatch = clean.match(/^GR\s*([0-9]+[A-Z0-9_-]*)/i) || clean.match(/^([0-9]+)/);
    const targetNum = numMatch ? numMatch[1] : '';

    return this.catalog.filter(gr => {
      if (clean === 'GR' || clean === 'GR ') return true;
      if (targetNum && gr.num === targetNum) return true;
      if (gr.ref.toUpperCase().includes(clean)) return true;
      if (gr.name.toUpperCase().includes(clean)) return true;
      if (gr.region.toUpperCase().includes(clean)) return true;
      return false;
    });
  }

  /**
   * Affiche le GR sélectionné avec son tracé officiel, son clignotement animé et son bandeau flottant
   * @param {Object|string} grOrRef 
   * @param {L.Map} map 
   */
  static displayGr(grOrRef, map) {
    if (!map) {
      if (window.MapManagerInstance && window.MapManagerInstance.map) {
        map = window.MapManagerInstance.map;
      } else {
        return;
      }
    }

    let gr = typeof grOrRef === 'string'
      ? this.catalog.find(g => g.ref.toUpperCase() === grOrRef.toUpperCase() || g.num === grOrRef)
      : grOrRef;

    if (!gr) return;

    // 1. Nettoyer tout affichage GR précédent
    this.clearGr(map);

    // 2. Créer le groupe de calques pour le tracé clignotant
    this.currentGrLayer = L.layerGroup();

    // 2.A Liseré lumineux sous-jacent (Halo blanc pour détacher sur tout fond de carte)
    const halo = L.polyline(gr.track, {
      color: '#ffffff',
      weight: 8,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false
    });
    this.currentGrLayer.addLayer(halo);

    // 2.B Tracé rouge officiel FFRP (Fond plein rouge éclatant)
    const redTrack = L.polyline(gr.track, {
      color: '#e11d48', // Rouge éclatant officiel GR
      weight: 5.5,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
      className: 'leaflet-gr-blinking-path'
    });
    this.currentGrLayer.addLayer(redTrack);

    // 2.C Tirets blancs officiels de balisage GR (Rouge et Blanc)
    const whiteDash = L.polyline(gr.track, {
      color: '#ffffff',
      weight: 2.5,
      dashArray: '12, 10',
      opacity: 0.95,
      interactive: false,
      className: 'leaflet-gr-blinking-dash'
    });
    this.currentGrLayer.addLayer(whiteDash);

    // 2.D Marqueurs de Départ et d'Arrivée
    if (gr.track.length > 0) {
      const startPt = gr.track[0];
      const endPt = gr.track[gr.track.length - 1];

      const startIcon = L.divIcon({
        className: 'gr-marker-pin',
        html: `<div class="bg-emerald-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-lg border-2 border-white flex items-center gap-1 select-none"><span>🚩</span> Départ ${gr.start}</div>`,
        iconSize: [110, 22],
        iconAnchor: [55, 24]
      });
      this.currentGrLayer.addLayer(L.marker(startPt, { icon: startIcon }));

      const endIcon = L.divIcon({
        className: 'gr-marker-pin',
        html: `<div class="bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-lg border-2 border-white flex items-center gap-1 select-none"><span>🏁</span> Arrivée ${gr.finish}</div>`,
        iconSize: [110, 22],
        iconAnchor: [55, 24]
      });
      this.currentGrLayer.addLayer(L.marker(endPt, { icon: endIcon }));
    }

    // 3. Ajouter à la carte
    this.currentGrLayer.addTo(map);

    // Ajouter la classe globale pour activer l'animation CSS clignotante
    const container = this.currentGrLayer.getPane ? this.currentGrLayer.getPane() : map.getContainer();
    if (container) {
      container.classList.add('leaflet-gr-blinking');
    }

    // 4. Centrer et zoomer automatiquement sur l'intégralité du GR
    if (gr.bounds) {
      map.fitBounds(gr.bounds, { padding: [50, 50], maxZoom: 14 });
    } else {
      map.fitBounds(redTrack.getBounds(), { padding: [50, 50], maxZoom: 14 });
    }

    // 5. Afficher la bannière informative flottante avec bouton Fermer
    this.showGrBanner(gr, map);

    // 6. Optionnel : Si un OSM relation ID est présent, streamer en arrière-plan la géométrie fine
    if (gr.osmRelationId) {
      this.fetchFineGeometry(gr, map);
    }
  }

  /**
   * Récupère en arrière-plan la géométrie fine complète depuis Waymarked Trails si disponible
   */
  static async fetchFineGeometry(gr, map) {
    try {
      const url = `https://hiking.waymarkedtrails.org/api/v1/details/relation/${gr.osmRelationId}`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data || !data.route || !data.route.main) return;

      const fineCoords = [];
      const extractWays = (obj) => {
        if (!obj) return;
        if (Array.isArray(obj)) {
          obj.forEach(extractWays);
        } else if (obj.ways && Array.isArray(obj.ways)) {
          obj.ways.forEach(w => {
            if (w.geometry && Array.isArray(w.geometry.coordinates)) {
              w.geometry.coordinates.forEach(c => {
                // Conversion EPSG:3857 (Web Mercator) vers EPSG:4326 (WGS84)
                const lon = (c[0] / 20037508.34) * 180;
                const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((c[1] / 20037508.34) * Math.PI)) - Math.PI / 2);
                fineCoords.push([lat, lon]);
              });
            }
          });
        } else if (obj.main) {
          extractWays(obj.main);
        }
      };

      extractWays(data.route.main);

      if (fineCoords.length > 50 && this.currentGrLayer) {
        // Remplacer par le tracé haute fidélité
        this.currentGrLayer.clearLayers();

        const halo = L.polyline(fineCoords, {
          color: '#ffffff',
          weight: 8,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        });
        const red = L.polyline(fineCoords, {
          color: '#e11d48',
          weight: 5.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
          className: 'leaflet-gr-blinking-path'
        });
        const white = L.polyline(fineCoords, {
          color: '#ffffff',
          weight: 2.5,
          dashArray: '12, 10',
          opacity: 0.95,
          className: 'leaflet-gr-blinking-dash'
        });

        this.currentGrLayer.addLayer(halo);
        this.currentGrLayer.addLayer(red);
        this.currentGrLayer.addLayer(white);
      }
    } catch (e) {
      console.warn('Géométrie fine GR non disponible:', e);
    }
  }

  /**
   * Affiche un bandeau flottant élégant en haut de l'écran avec informations du GR et bouton de fermeture
   */
  static showGrBanner(gr, map) {
    this.removeGrBanner();

    const banner = document.createElement('div');
    banner.id = 'gr-floating-banner';
    banner.className = 'fixed top-16 left-1/2 -translate-x-1/2 z-[1500] bg-slate-900/95 text-white backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border-2 border-rose-500/80 flex items-center gap-3.5 max-w-[92vw] sm:max-w-xl transition-all duration-300 animate-bounce-short select-none';
    banner.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="bg-rose-600 text-white font-black text-xs px-2 py-0.5 rounded-md shadow uppercase tracking-wide flex items-center gap-1">
          <span class="inline-block w-2 h-2 rounded-full bg-white animate-ping"></span>
          ${gr.ref}
        </span>
        <div class="flex flex-col text-left">
          <span class="font-extrabold text-xs text-white truncate max-w-[220px] sm:max-w-xs">${gr.name}</span>
          <span class="text-[10px] text-slate-300 font-semibold">${gr.distKm} km • D+ ${gr.dplus.toLocaleString('fr-FR')} m • ${gr.start} ➔ ${gr.finish}</span>
        </div>
      </div>
      <button id="btn-close-gr-banner" type="button" class="ml-auto text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-xl transition cursor-pointer text-xs font-bold" title="Masquer le tracé du GR">
        ✕
      </button>
    `;

    document.body.appendChild(banner);
    this.currentGrBanner = banner;

    const closeBtn = banner.querySelector('#btn-close-gr-banner');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.clearGr(map);
      });
    }
  }

  static removeGrBanner() {
    if (this.currentGrBanner) {
      this.currentGrBanner.remove();
      this.currentGrBanner = null;
    }
    const existing = document.getElementById('gr-floating-banner');
    if (existing) existing.remove();
  }

  /**
   * Efface le tracé du GR et son bandeau
   */
  static clearGr(map) {
    if (this.currentGrLayer && map) {
      map.removeLayer(this.currentGrLayer);
      this.currentGrLayer = null;
    }
    const container = map ? map.getContainer() : null;
    if (container) {
      container.classList.remove('leaflet-gr-blinking');
    }
    this.removeGrBanner();
  }
}

if (typeof window !== 'undefined') {
  window.GrManager = GrManager;
}
