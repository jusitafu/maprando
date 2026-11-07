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
  static showGrBanner(gr, map, opts = {}) {
    this.removeGrBanner();

    const banner = document.createElement('div');
    banner.id = 'gr-floating-banner';
    banner.className = 'fixed top-16 left-1/2 -translate-x-1/2 z-[1500] bg-slate-900/95 text-white backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border-2 border-rose-500/80 flex flex-col gap-1.5 max-w-[94vw] sm:max-w-2xl transition-all duration-300 animate-bounce-short select-none';

    const badgeColor = gr.group === 'INT' ? 'bg-blue-600' : (gr.group === 'REG' ? 'bg-amber-600' : 'bg-rose-600');
    const candidates = Array.isArray(opts.candidates) ? opts.candidates : [];

    let candidatesHtml = '';
    if (candidates.length > 1) {
      const pills = candidates.map((c, idx) => {
        const isCurrent = String(c.id) === String(gr.id);
        const cLabel = c.ref || (c.name ? c.name.slice(0, 18) : `Sentier ${idx + 1}`);
        return `<button type="button" data-candidate-idx="${idx}" class="px-2 py-0.5 rounded-full text-[10px] font-extrabold transition cursor-pointer ${isCurrent ? 'bg-rose-600 text-white ring-2 ring-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'}">${this._esc(cLabel)}</button>`;
      }).join('');
      candidatesHtml = `
        <div class="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-700/80 text-[10px]">
          <span class="text-slate-400 font-semibold">Sentiers à cet endroit :</span>
          ${pills}
        </div>
      `;
    }

    banner.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="${badgeColor} text-white font-black text-xs px-2.5 py-0.5 rounded-md shadow uppercase tracking-wide flex items-center gap-1.5 flex-shrink-0">
            <span class="inline-block w-2 h-2 rounded-full bg-white animate-ping"></span>
            ${this._esc(gr.ref || 'Sentier')}
          </span>
          <div class="flex flex-col text-left min-w-0">
            <span class="font-extrabold text-xs text-white truncate max-w-[200px] sm:max-w-md">${this._esc(gr.name || gr.ref)}</span>
            <span class="text-[10px] text-slate-300 font-semibold truncate">${this._esc([gr.distKm ? gr.distKm + ' km' : '', gr.dplus ? 'D+ ' + gr.dplus.toLocaleString('fr-FR') + ' m' : '', (gr.start || gr.finish) ? (gr.start + ' ➔ ' + gr.finish) : ''].filter(Boolean).join(' • ') || 'Tracé OpenStreetMap officiel')}</span>
          </div>
        </div>
        <div class="ml-auto flex items-center gap-1.5 flex-shrink-0">
          ${opts.bounds ? `<button id="btn-fit-gr-bounds" type="button" class="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded-lg transition cursor-pointer shadow" title="Zoomer sur l'intégralité du sentier">🔍 Voir tout</button>` : ''}
          <button id="btn-close-gr-banner" type="button" class="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-xl transition cursor-pointer text-xs font-bold" title="Masquer le tracé du sentier">
            ✕
          </button>
        </div>
      </div>
      ${candidatesHtml}
    `;

    document.body.appendChild(banner);
    this.currentGrBanner = banner;

    const closeBtn = banner.querySelector('#btn-close-gr-banner');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.clearGr(map);
      });
    }

    const fitBtn = banner.querySelector('#btn-fit-gr-bounds');
    if (fitBtn && opts.bounds && map) {
      fitBtn.addEventListener('click', () => {
        map.fitBounds(opts.bounds, { padding: [50, 50], maxZoom: 14 });
      });
    }

    if (candidates.length > 1) {
      banner.querySelectorAll('button[data-candidate-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-candidate-idx'), 10);
          if (candidates[idx]) {
            this.displayRemote(candidates[idx], map, { fitBounds: false, candidates });
          }
        });
      });
    }
  }

  // ====================================================================
  // RECHERCHE ET TRACÉ RÉELS DES GR & SENTIERS RÉPUTÉS (OpenStreetMap)
  // via l'API Waymarked Trails (relations OSM de sentiers de randonnée)
  // ====================================================================
  static WMT = 'https://hiking.waymarkedtrails.org/api/v1';
  static _remoteCache = new Map();
  static _detailCache = new Map();
  static _renderToken = 0;

  static isGrQuery(query) {
    return /^\s*GR\s*(P|T|R|PAYS)?\s*\d/i.test(query || '') || /^\s*GR\s*$/i.test(query || '');
  }

  static _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  static _merc2ll(x, y) {
    const lon = (x / 20037508.34) * 180;
    const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((y / 20037508.34) * Math.PI)) - Math.PI / 2);
    return [lat, lon];
  }

  /** Recherche tous les GR français correspondant à "GR XX" (variantes GR 20A, GRP/GR Pays, GRT, GR R...) */
  static async searchRemote(query) {
    const m = (query || '').trim().match(/^GR\s*(PAYS|P|T|R)?\s*(\d+)\s*([A-Za-z]{0,2})/i);
    if (!m) return [];
    const typed = (m[1] || '').toUpperCase().charAt(0); // '', 'P', 'T', 'R'
    const num = m[2];
    const suffix = (m[3] || '').toUpperCase();
    const key = `${typed}|${num}${suffix}`;
    if (this._remoteCache.has(key)) return this._remoteCache.get(key);

    const fetchList = async (q) => {
      const resp = await fetch(`${this.WMT}/list/search?limit=60&query=${encodeURIComponent(q)}`);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return (await resp.json()).results || [];
    };
    const qs = ['GR ' + num + suffix];
    if (!suffix) qs.push(num);
    const settled = await Promise.allSettled(qs.map(fetchList));
    if (settled.every(r => r.status === 'rejected')) throw new Error('search failed');
    const raw = [];
    settled.forEach(r => { if (r.status === 'fulfilled') raw.push(...r.value); });

    const seen = new Set();
    const parse = (r) => {
      const ref = (r.ref || '').toUpperCase().replace(/[\s\u00a0]+/g, '').replace(/^GRPAYS/, 'GRP');
      return ref.match(/^GR(P|T|R)?(\d+)([A-Z]*)$/);
    };
    let list = raw.filter(r => {
      if (!r || !r.ref || seen.has(r.id)) return false;
      const mm = parse(r);
      if (!mm || mm[2] !== num) return false;
      if (suffix && !mm[3].startsWith(suffix)) return false;
      if (typed && (mm[1] || '') !== typed) return false;
      seen.add(r.id);
      return true;
    });
    const score = r => {
      const mm = parse(r);
      let s = 0;
      if (mm && !mm[3]) s += 50;
      if (mm && !mm[1]) s += 40;
      if (r.group === 'NAT') s += 20;
      if (r.itinerary && r.itinerary.length) s += 10;
      if (/variante|variant|alternat|liaison|acc[eè]s|sec\.|stage|etappe/i.test(r.name || '')) s -= 15;
      if (/etapa|tramo|ramal|derivaci|sender|sendeiro|cam[ií]\b|belgie|vlaanderen|nederland/i.test(r.name || '')) s -= 85;
      if (/travers[ée]e|sentier|chemin|tour\s+d|france|pyr[ée]n[ée]es|alpes|bretagne|corse|c[ée]vennes|jura|loire|seine|m[ée]diterran[ée]e/i.test(r.name || '')) s += 55;
      return s;
    };
    list.sort((a, b) => score(b) - score(a));
    list = list.slice(0, 14);

    // Ne conserver que les GR français (emprise du tracé située en France)
    const detailed = await Promise.allSettled(list.map(async (r) => {
      let det = this._detailCache.get(r.id);
      if (!det) {
        const resp = await fetch(`${this.WMT}/details/relation/${r.id}`);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        det = await resp.json();
        this._detailCache.set(r.id, det);
      }
      return { r, det };
    }));
    const kept = [];
    detailed.forEach(x => {
      if (x.status === 'fulfilled' && this._isFrench(x.value.det)) kept.push(x.value.r);
    });
    list = kept.slice(0, 10);
    this._remoteCache.set(key, list);
    return list;
  }

  static _FR_POLY = [
    [-4.8, 48.4], [-3.0, 48.9], [-1.6, 49.75], [1.4, 50.2], [1.6, 50.95], [2.6, 51.1], [3.3, 50.6], [4.2, 50.3],
    [4.85, 49.95], [5.8, 49.5], [6.4, 49.45], [8.25, 49.0], [7.6, 47.55], [6.9, 47.35], [6.1, 46.3], [7.05, 45.9],
    [7.1, 44.1], [7.7, 43.8], [6.0, 43.0], [3.1, 42.45], [1.45, 42.45], [0.7, 42.85], [-0.7, 42.8], [-1.78, 43.35],
    [-1.4, 44.6], [-1.2, 46.0], [-2.2, 47.1], [-4.8, 48.4]
  ];
  static _FR_BOXES = [
    [41.3, 43.05, 8.5, 9.6], [-21.5, -20.8, 55.1, 55.9], [15.8, 16.6, -61.9, -60.9],
    [14.3, 14.95, -61.3, -60.7], [2.0, 6.0, -54.7, -51.5], [-13.1, -12.5, 44.9, 45.4]
  ];

  static _inFrance(lat, lon) {
    if (this._FR_BOXES.some(b => lat >= b[0] && lat <= b[1] && lon >= b[2] && lon <= b[3])) return true;
    const poly = this._FR_POLY;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  static _isFrench(det) {
    if (!det) return false;
    const op = (det.operator || '').toString();
    if (/FFRP|F[ée]d[ée]ration fran[cç]aise|Club Vosgien/i.test(op)) return true;
    if (!Array.isArray(det.bbox) || det.bbox.length !== 4) return false;
    const sw = this._merc2ll(det.bbox[0], det.bbox[1]);
    const ne = this._merc2ll(det.bbox[2], det.bbox[3]);
    return this._inFrance((sw[0] + ne[0]) / 2, (sw[1] + ne[1]) / 2);
  }

  /** Remplit le conteneur de résultats avec les GR ou sentiers réputés trouvés */
  static async renderResults(container, query, onPick) {
    if (!container) return;
    const token = ++this._renderToken;
    container.classList.remove('hidden');
    container.style.backgroundColor = '#ffffff';
    container.style.opacity = '1';

    if (/^\s*GR\s*$/i.test(query)) {
      container.innerHTML = '<div class="p-3 text-xs text-slate-600 text-center">🚩 Tapez le numéro du GR (ex : <b>GR 20</b>, <b>GR 34</b>, <b>GR 65</b>) ou le nom d’un grand sentier (<b>Francigena</b>, <b>West Highland Way</b>, <b>Stevenson</b>…)</div>';
      return;
    }
    container.innerHTML = '<div class="p-3 text-xs text-slate-500 text-center"><span class="inline-block animate-spin mr-1">⏳</span> Recherche du sentier ' + this._esc(query.trim()) + '…</div>';

    let items = [];
    const isGrCode = this.isGrQuery(query);
    try {
      items = isGrCode ? await this.searchRemote(query) : await this.searchNamedTrails(query);
    } catch (e) {
      if (token !== this._renderToken) return;
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
      container.innerHTML = '<div class="p-3 text-xs text-slate-500 text-center">Aucun sentier « ' + this._esc(query.trim()) + ' » trouvé.</div>';
      return;
    }
    container.innerHTML = '';
    this.appendTrailItemsToContainer(container, items, onPick);
  }

  static appendTrailItemsToContainer(container, items, onPick) {
    if (!container || !Array.isArray(items)) return;
    items.forEach(it => {
      const div = document.createElement('div');
      div.className = 'search-item px-3 py-2 cursor-pointer transition flex items-center gap-2.5 border-b border-rose-200/90 hover:bg-rose-100 text-left';
      div.style.backgroundColor = '#fff1f2';
      const itin = (it.itinerary && it.itinerary.length) ? it.itinerary.filter(Boolean) : [];
      const sub = itin.length ? (itin[0] + ' ➔ ' + itin[itin.length - 1]) : (it.operator || 'Sentier de Grande Randonnée / Itinéraire balisé');
      const badgeBg = it.group === 'INT' ? 'bg-blue-600' : (it.group === 'REG' ? 'bg-amber-600' : 'bg-rose-600');
      div.innerHTML = `
        <span class="${badgeBg} text-white font-black text-[11px] px-2 py-0.5 rounded-md shadow uppercase tracking-wide flex-shrink-0">🥾 ${this._esc(it.ref || 'GR')}</span>
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
    const visitedObjs = new Set();
    const walk = (o) => {
      if (!o || typeof o !== 'object') return;
      if (visitedObjs.has(o)) return;
      visitedObjs.add(o);
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (Array.isArray(o.ways)) o.ways.forEach(w => ways.push(w));
      if (o.main) walk(o.main);
      if (o.appendices) walk(o.appendices);
      if (o.subrelations) walk(o.subrelations);
      if (o.superroutes) walk(o.superroutes);
      if (o.routes) walk(o.routes);
      if (o.sections) walk(o.sections);
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
        if (prev && idx !== coords.length - 1 && Math.abs(c[0] - prev[0]) + Math.abs(c[1] - prev[1]) < 15) return;
        prev = c;
        pts.push(this._merc2ll(c[0], c[1]));
      });
      if (pts.length > 1) segs.push(pts);
    });
    return segs;
  }

  /**
   * Répertoire complet des GR® Français classés par ordre numérique strict
   */
  static FRENCH_GR_DIRECTORY = [
    { ref: 'GR 1', name: 'Tour d’Île-de-France (Ceinture verte de Paris)' },
    { ref: 'GR 2', name: 'Au fil de la Seine (Sources de la Seine ➔ Le Havre)' },
    { ref: 'GR 3', name: 'La Loire Sauvage (Mont Gerbier-de-Jonc ➔ La Baule)' },
    { ref: 'GR 4', name: 'De l’Atlantique à la Provence (Royan ➔ Grasse)' },
    { ref: 'GR 5', name: 'Grande Traversée Vosges • Jura • Alpes (Lac Léman ➔ Nice)' },
    { ref: 'GR 6', name: 'De l’Aquitaine aux Alpes (Arcachon ➔ Saint-Paul-sur-Ubaye)' },
    { ref: 'GR 7', name: 'La Ligne de Partage des Eaux (Ballon d’Alsace ➔ Pyrénées)' },
    { ref: 'GR 9', name: 'Du Jura à la Méditerranée (Saint-Amour ➔ Saint-Tropez)' },
    { ref: 'GR 10', name: 'La Grande Traversée des Pyrénées (Hendaye ➔ Banyuls-sur-Mer)' },
    { ref: 'GR 11', name: 'Grand Tour d’Île-de-France (Pays d’Othe, Brie, Vexin)' },
    { ref: 'GR 12', name: 'De la Flandre à l’Île-de-France (Ardennes, Oise, Paris)' },
    { ref: 'GR 13', name: 'Traversée du Morvan et du Gâtinais (Fontainebleau ➔ Bourbon-Lancy)' },
    { ref: 'GR 14', name: 'Sentier des Ardennes et de l’Argonne (Paris ➔ Malmedy)' },
    { ref: 'GR 20', name: 'Traversée de la Corse • Fra li Monti (Calenzana ➔ Conca)' },
    { ref: 'GR 21', name: 'Les Falaises de la Côte d’Albâtre (Le Havre ➔ Le Tréport)' },
    { ref: 'GR 22', name: 'De Paris au Mont-Saint-Michel' },
    { ref: 'GR 23', name: 'De la Vallée de la Seine à la Côte d’Albâtre (Normandie)' },
    { ref: 'GR 26', name: 'De Paris à la Côte Fleurie (Poissy ➔ Deauville / Villers-sur-Mer)' },
    { ref: 'GR 30', name: 'Tour des Volcans et Lacs d’Auvergne (Puy-de-Dôme)' },
    { ref: 'GR 31', name: 'Traversée de la Sologne (Bléneau ➔ Souvigny)' },
    { ref: 'GR 32', name: 'De la Brie au Val de Loire (Forêt d’Orléans)' },
    { ref: 'GR 34', name: 'Le Sentier des Douaniers • Tour de Bretagne (Mont-Saint-Michel ➔ Saint-Nazaire)' },
    { ref: 'GR 35', name: 'Vallée du Loir (Voves ➔ Rochefort-sur-Loire)' },
    { ref: 'GR 36', name: 'De la Manche aux Pyrénées (Ouistreham ➔ Bourg-Madame)' },
    { ref: 'GR 37', name: 'Cœur de Bretagne (Mont-Saint-Michel ➔ Presqu’île de Crozon)' },
    { ref: 'GR 38', name: 'De la Mayenne à l’Océan (Douarnenez)' },
    { ref: 'GR 39', name: 'Du Mont-Saint-Michel à l’Estuaire de la Vilaine (Guérande)' },
    { ref: 'GR 40', name: 'Tour des Volcans du Velay (Haute-Loire)' },
    { ref: 'GR 41', name: 'Vallée du Cher (Tours ➔ Mont-Dore)' },
    { ref: 'GR 42', name: 'Les Balcons du Rhône (Saint-Étienne ➔ Le Grau-du-Roi)' },
    { ref: 'GR 43', name: 'Du Col des Faïsses à Sainte-Eulalie (Lozère / Margeride)' },
    { ref: 'GR 44', name: 'Des Vans à Champerboux (Ardèche, Gorges du Chassezac, Lozère)' },
    { ref: 'GR 46', name: 'De Tours à Toulouse (Vallées de l’Indre, Creuse, Lot)' },
    { ref: 'GR 48', name: 'De Chinon à La Rochefoucauld (Vienne & Limousin)' },
    { ref: 'GR 49', name: 'De Saint-Raphaël aux Gorges du Verdon (Estérel & Haut-Var)' },
    { ref: 'GR 50', name: 'Tour du Parc National des Écrins (Balcons du Dauphiné)' },
    { ref: 'GR 51', name: 'Les Balcons de la Méditerranée (Menton ➔ Marseille)' },
    { ref: 'GR 52', name: 'Grande Traversée du Mercantour et Vallée des Merveilles (Menton)' },
    { ref: 'GR 53', name: 'La Crête des Vosges du Nord (Wissembourg ➔ Masevaux)' },
    { ref: 'GR 54', name: 'Tour de l’Oisans et des Écrins (Bourg-d’Oisans)' },
    { ref: 'GR 55', name: 'La Vanoise (Tignes ➔ Pralognan ➔ Modane)' },
    { ref: 'GR 56', name: 'Tour de l’Ubaye (Alpes-de-Haute-Provence)' },
    { ref: 'GR 57', name: 'Tour du Mont-Thabor (Clarée & Maurienne)' },
    { ref: 'GR 58', name: 'Tour du Queyras (Hautes-Alpes)' },
    { ref: 'GR 59', name: 'Des Vosges au Bugey par le Revermont et le Jura' },
    { ref: 'GR 60', name: 'Traversée de l’Aubrac (Signal de Mailhebiau ➔ Saint-Chély-d’Apcher)' },
    { ref: 'GR 62', name: 'Des Grands Causses à Conques (Meyrueis ➔ Rodez ➔ Conques)' },
    { ref: 'GR 65', name: 'Chemin de Saint-Jacques • Via Podiensis (Le Puy-en-Velay ➔ Saint-Jean-Pied-de-Port)' },
    { ref: 'GR 66', name: 'Tour du Mont Aigoual (Cévennes)' },
    { ref: 'GR 67', name: 'Tour en Pays Cévenol (Anduze, Florac, Alès)' },
    { ref: 'GR 68', name: 'Tour du Mont Lozère' },
    { ref: 'GR 69', name: 'La Routo • Sur les pas de la Transhumance (Arles ➔ Vallée de la Stura)' },
    { ref: 'GR 70', name: 'Le Chemin de Stevenson (Le Puy-en-Velay ➔ Alès)' },
    { ref: 'GR 71', name: 'Tour du Larzac (Aveyron & Hérault)' },
    { ref: 'GR 72', name: 'Du Col du Bez à Barre-des-Cévennes (Tanargue & Lozère)' },
    { ref: 'GR 73', name: 'Cévennes et Monts d’Ardèche' },
    { ref: 'GR 74', name: 'De Saint-Maurice-Navacelles à Pézenas (Hérault)' },
    { ref: 'GR 78', name: 'Chemin du Piémont Pyrénéen (Carcassonne ➔ Saint-Jean-Pied-de-Port)' },
    { ref: 'GR 86', name: 'De Toulouse à Bagnères-de-Luchon (Haute-Garonne)' },
    { ref: 'GR 89', name: 'Chemin de Montaigne (Lyon ➔ Thiers ➔ Bordeaux)' },
    { ref: 'GR 90', name: 'Traversée du Massif des Maures (Notre-Dame-des-Anges ➔ Saint-Tropez)' },
    { ref: 'GR 91', name: 'Traversée des Hauts-Plateaux du Vercors (Grenoble ➔ Brantes)' },
    { ref: 'GR 93', name: 'Du Vercors au Dévoluy et à la Durance' },
    { ref: 'GR 95', name: 'De Saillans à Vaunières (Drôme & Diois)' },
    { ref: 'GR 96', name: 'Préalpes de Haute-Savoie (Samoëns ➔ Lac d’Annecy)' },
    { ref: 'GR 97', name: 'Tour du Grand Luberon (Vaucluse)' },
    { ref: 'GR 98', name: 'Sentier des Calanques de Marseille à La Ciotat' },
    { ref: 'GR 99', name: 'Des Gorges du Verdon à la Mer Méditerranée (Toulon / Revest)' },
    { ref: 'GR 100', name: 'Sur les pas des Maîtres Sonneurs (Berry & Bourbonnais)' },
    { ref: 'GR 101', name: 'Chemin de Saint-Jacques des Pyrénées (Nogaro ➔ Col de Saucède)' },
    { ref: 'GR 105', name: 'Route d’Artagnan / Vallée d’Aure' },
    { ref: 'GR 107', name: 'Le Chemin des Bonshommes • Sentier Cathare (Foix ➔ Berga)' },
    { ref: 'GR 111', name: 'Traversée de l’Essonne' },
    { ref: 'GR 120', name: 'Sentier du Littoral des Hauts-de-France (Dunkerque ➔ Baie de Somme)' },
    { ref: 'GR 145', name: 'Via Francigena en France (Calais ➔ Reims ➔ Besançon ➔ Pontarlier)' },
    { ref: 'GR 210', name: 'Sur les traces du Chasse-Marée (Dieppe ➔ Rouen)' },
    { ref: 'GR 222', name: 'Tour de Normandie Centrale (Pont-de-l’Arche ➔ Verneuil-sur-Avre)' },
    { ref: 'GR 223', name: 'Sentier du Littoral du Cotentin (Honfleur ➔ Mont-Saint-Michel)' },
    { ref: 'GR 300', name: 'Chemin de Saint-Jacques en Bourbonnais (Sancoins ➔ Clermont-Ferrand)' },
    { ref: 'GR 340', name: 'Tour de Belle-Île-en-Mer (Morbihan)' },
    { ref: 'GR 360', name: 'Tour de la Saintonge (Charente-Maritime)' },
    { ref: 'GR 380', name: 'Tour des Monts d’Arrée (Finistère)' },
    { ref: 'GR 400', name: 'Tour du Volcan Cantalien • Puy Mary (Cantal)' },
    { ref: 'GR 440', name: 'Tour de la Montagne Limousine (Plateau de Millevaches)' },
    { ref: 'GR 441', name: 'Tour de la Chaîne des Puys (Puy de Dôme)' },
    { ref: 'GR 470', name: 'Sources et Gorges de l’Allier (Brioude ➔ La Bastide-Puylaurent)' },
    { ref: 'GR 509', name: 'Grande Traversée du Jura • GTJ (Mandeure ➔ Culoz)' },
    { ref: 'GR 651', name: 'Variante de la Vallée du Célé (Saint-Jacques dans le Lot)' },
    { ref: 'GR 652', name: 'Voie de Rocamadour (Lhospitalet ➔ La Romieu)' },
    { ref: 'GR 653', name: 'Voie d’Arles • Via Tolosana (Arles ➔ Montpellier ➔ Toulouse ➔ Col du Somport)' },
    { ref: 'GR 654', name: 'Voie de Vézelay (Namur ➔ Reims ➔ Vézelay ➔ Périgueux ➔ Montréal-du-Gers)' },
    { ref: 'GR 655', name: 'Via Turonensis • Voie de Tours (Paris ➔ Tours ➔ Poitiers ➔ Bordeaux ➔ Saint-Jean-Pied-de-Port)' },
    { ref: 'GR 736', name: 'Gorges et Vallée du Tarn (Mont Lozère ➔ Albi)' },
    { ref: 'GR 800', name: 'Au fil de la Somme (Saint-Quentin ➔ Amiens ➔ Saint-Valery-sur-Somme)' },
    { ref: 'GR 2013', name: 'Sentier Métropolitain d’Aix-Marseille Provence' },
    { ref: 'GR R1', name: 'Tour du Piton des Neiges (La Réunion : Cilaos • Mafate • Salazie)' },
    { ref: 'GR R2', name: 'Grande Traversée de l’Île de La Réunion (Saint-Denis ➔ Saint-Philippe)' },
    { ref: 'GR R3', name: 'Tour du Cirque de Mafate (La Réunion)' }
  ];

  /**
   * Affiche l'intégralité d'un GR français (tous tronçons / sections assemblés) à partir de son code "GR XX"
   */
  static async displayFrenchGrByRef(refCode, map) {
    if (!refCode) return;
    if (!map) {
      if (window.MapManagerInstance && window.MapManagerInstance.map) map = window.MapManagerInstance.map;
      else return;
    }
    const dirEntry = this.FRENCH_GR_DIRECTORY.find(d => d.ref.toUpperCase() === refCode.trim().toUpperCase());
    const labelName = dirEntry ? dirEntry.name : refCode;

    this.clearGr(map);
    this.showLoadingBanner({ ref: refCode, name: labelName });

    try {
      const results = await this.searchRemote(refCode);
      if (results && results.length > 0) {
        const cleanRefUpper = refCode.toUpperCase().replace(/[\s\u00a0]+/g, '');
        const trunkSections = results.filter(r => {
          const rRef = (r.ref || '').toUpperCase().replace(/[\s\u00a0]+/g, '');
          return rRef === cleanRefUpper;
        });
        const toLoad = (trunkSections.length > 0 ? trunkSections : [results[0]]).slice(0, 10);

        const detailPromises = toLoad.map(async (rel) => {
          let det = this._detailCache.get(rel.id);
          if (!det) {
            const resp = await fetch(`${this.WMT}/details/relation/${rel.id}`);
            if (resp.ok) {
              det = await resp.json();
              this._detailCache.set(rel.id, det);
            }
          }
          return { rel, det };
        });

        const loaded = await Promise.all(detailPromises);
        const allSegs = [];
        let totalLengthMeters = 0;
        let primaryDet = null;

        loaded.forEach(({ det }) => {
          if (!det || !det.route) return;
          if (!primaryDet) primaryDet = det;
          const s = this._extractSegments(det.route);
          if (s.length) {
            allSegs.push(...s);
            if (det.route.length) totalLengthMeters += det.route.length;
          }
        });

        if (allSegs.length > 0) {
          this.setOverlayDimmed(true);
          this.currentGrLayer = L.layerGroup();
          this.currentGrLayer.addLayer(L.polyline(allSegs, { color: '#ffffff', weight: 9, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }));
          this.currentGrLayer.addLayer(L.polyline(allSegs, { color: '#e11d48', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false, className: 'leaflet-gr-blinking-path' }));
          this.currentGrLayer.addLayer(L.polyline(allSegs, { color: '#ffffff', weight: 2.5, dashArray: '12, 10', opacity: 0.95, interactive: false, className: 'leaflet-gr-blinking-dash' }));

          const finalName = dirEntry ? dirEntry.name : (primaryDet && primaryDet.name ? primaryDet.name : refCode);
          this._addRouteNameLabels(allSegs, refCode, finalName, this.currentGrLayer);
          this.currentGrLayer.addTo(map);

          const container = map.getContainer();
          if (container) container.classList.add('leaflet-gr-blinking');

          const bounds = L.latLngBounds(allSegs.flat());
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });

          const itin = (primaryDet && primaryDet.itinerary && primaryDet.itinerary.length) ? primaryDet.itinerary.filter(Boolean) : [];
          this.showGrBanner({
            id: toLoad[0].id,
            ref: refCode,
            name: finalName,
            group: 'NAT',
            distKm: totalLengthMeters > 0 ? Math.round(totalLengthMeters / 1000) : null,
            dplus: null,
            start: itin[0] || (primaryDet && primaryDet.tags && primaryDet.tags.from) || '',
            finish: itin[itin.length - 1] || (primaryDet && primaryDet.tags && primaryDet.tags.to) || ''
          }, map, {
            bounds,
            candidates: (() => {
              const seenRefs = new Set([cleanRefUpper]);
              const variants = results.filter(r => {
                const rr = (r.ref || '').toUpperCase().replace(/[\s\u00a0]+/g, '');
                if (!rr || seenRefs.has(rr)) return false;
                seenRefs.add(rr);
                return true;
              });
              return variants.length > 0 ? [toLoad[0], ...variants.slice(0, 5)] : null;
            })()
          });
          return;
        }
      }
    } catch (e) {
      console.warn('Assemblée multi-tronçons GR indisponible, fallback catalogue:', e);
    }

    const catMatch = this.catalog.find(g => g.ref.toUpperCase() === refCode.trim().toUpperCase());
    if (catMatch) {
      this.displayGr(catMatch, map);
    } else {
      this.removeGrBanner();
      alert('Impossible de charger le tracé complet de ' + refCode + '.');
    }
  }

  /** Charge la géométrie OSM réelle d'un GR / sentier réputé et l'affiche en surbrillance clignotante avec son nom sur le tracé */
  static async displayRemote(item, map, opts = {}) {
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
      alert('Impossible de charger le tracé de ' + (item.ref || item.name) + ' (service indisponible).');
      return;
    }
    let segs = this._extractSegments(det.route);

    // Si c'est un GR français découpé en plusieurs tronçons sur OSM, assembler automatiquement tous ses tronçons français
    const cleanRef = (det.ref || item.ref || '').trim().toUpperCase();
    if (!opts.candidates && /^GR\s*(R?\d+)$/.test(cleanRef) && this._isFrench(det)) {
      try {
        const siblings = await this.searchRemote(cleanRef);
        const targetNorm = cleanRef.replace(/\s+/g, '');
        const extraRels = (siblings || []).filter(s => s.id !== item.id && (s.ref || '').toUpperCase().replace(/\s+/g, '') === targetNorm).slice(0, 8);
        if (extraRels.length > 0) {
          const extraDets = await Promise.allSettled(extraRels.map(async (sr) => {
            let sdet = this._detailCache.get(sr.id);
            if (!sdet) {
              const r = await fetch(`${this.WMT}/details/relation/${sr.id}`);
              if (r.ok) {
                sdet = await r.json();
                this._detailCache.set(sr.id, sdet);
              }
            }
            return sdet;
          }));
          extraDets.forEach(ed => {
            if (ed.status === 'fulfilled' && ed.value && ed.value.route) {
              const extraSegs = this._extractSegments(ed.value.route);
              if (extraSegs.length) segs.push(...extraSegs);
            }
          });
        }
      } catch (e) {}
    }

    if (!segs.length) {
      this.removeGrBanner();
      alert('Aucune géométrie disponible pour ' + (item.ref || item.name) + '.');
      return;
    }

    // Estomper le réseau secondaire en arrière-plan pour faire ressortir le sentier sélectionné
    this.setOverlayDimmed(true);

    const refLabel = det.ref || item.ref || (det.name ? det.name.slice(0, 12) : 'Sentier');
    const nameLabel = det.name || item.name || refLabel;

    this.currentGrLayer = L.layerGroup();
    this.currentGrLayer.addLayer(L.polyline(segs, { color: '#ffffff', weight: 9, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }));
    this.currentGrLayer.addLayer(L.polyline(segs, { color: '#e11d48', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false, className: 'leaflet-gr-blinking-path' }));
    this.currentGrLayer.addLayer(L.polyline(segs, { color: '#ffffff', weight: 2.5, dashArray: '12, 10', opacity: 0.95, interactive: false, className: 'leaflet-gr-blinking-dash' }));

    // Ajouter les badges de nom explicites directement sur le tracé
    this._addRouteNameLabels(segs, refLabel, nameLabel, this.currentGrLayer);

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

    if (opts.fitBounds !== false) {
      // Si le sentier est hors de France et qu'on est sur un fond IGN France, basculer automatiquement sur Carte des GR ou OpenTopoMap
      if (window.MapManagerInstance && !this._isFrench(det)) {
        const curBase = window.MapManagerInstance.currentBaseLayer;
        if (curBase === 'igntop25' || curBase === 'ignplan') {
          window.MapManagerInstance.setBaseLayer('grmap');
        }
      }
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }

    const itin = (det.itinerary && det.itinerary.length) ? det.itinerary.filter(Boolean) : [];
    this.showGrBanner({
      id: item.id,
      ref: refLabel,
      name: nameLabel,
      group: item.group || det.group || 'NAT',
      distKm: det.route && det.route.length ? Math.round(det.route.length / 1000) : null,
      dplus: null,
      start: itin[0] || (det.tags && det.tags.from) || '',
      finish: itin[itin.length - 1] || (det.tags && det.tags.to) || ''
    }, map, {
      bounds,
      candidates: opts.candidates || null
    });
  }

  static showLoadingBanner(item) {
    this.removeGrBanner();
    const banner = document.createElement('div');
    banner.id = 'gr-floating-banner';
    banner.className = 'fixed top-16 left-1/2 -translate-x-1/2 z-[1500] bg-slate-900/95 text-white px-4 py-2.5 rounded-2xl shadow-2xl border-2 border-rose-500/80 text-xs font-bold';
    banner.innerHTML = '<span class="inline-block animate-spin mr-1">⏳</span> Chargement du tracé ' + this._esc(item.ref || item.name || '') + '…';
    document.body.appendChild(banner);
    this.currentGrBanner = banner;
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
   * Efface le tracé du GR, restaure l'opacité normale du réseau et masque le bandeau
   */
  static clearGr(map) {
    if (this.currentGrLayer && map) {
      map.removeLayer(this.currentGrLayer);
      this.currentGrLayer = null;
    }
    this.setOverlayDimmed(false);
    const container = map ? map.getContainer() : null;
    if (container) {
      container.classList.remove('leaflet-gr-blinking');
    }
    this.removeGrBanner();
  }

  // ====================================================================
  // 1. FILTRAGE PAR COULEUR DES SENTIERS (CASES À COCHER SUR CARTE DES GR)
  // ====================================================================
  static colorFilters = {
    blue: true,   // INT : Grands itinéraires Européens / Internationaux (Bleu)
    red: true,    // NAT : GR® Nationaux (Rouge)
    orange: true, // REG : GR® de Pays & Régionaux (Orange)
    purple: true  // LOC : Sentiers locaux & PR (Violet / Autres)
  };
  static _activeGridLayer = null;
  static _overlayDimmed = false;

  static createFilteredGrTileLayer() {
    const self = this;
    const FilteredLayer = L.GridLayer.extend({
      createTile: function (coords, done) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        canvas.className = 'leaflet-tile';

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
          canvas._img = img;
          self._drawFilteredTile(canvas);
          done(null, canvas);
        };
        img.onerror = function (err) {
          done(err, canvas);
        };
        img.src = `https://tile.waymarkedtrails.org/hiking/${coords.z}/${coords.x}/${coords.y}.png`;
        return canvas;
      }
    });

    const layer = new FilteredLayer({
      tileSize: 256,
      maxZoom: 19,
      maxNativeZoom: 18,
      opacity: 0.92,
      attribution: '&copy; Waymarked Trails (Réseau GR® & Sentiers balisés)'
    });
    this._activeGridLayer = layer;
    return layer;
  }

  static _ensureTileCategoryMap(canvas) {
    if (canvas._catMap && canvas._rawBytes) return;
    const img = canvas._img;
    if (!img) return;

    const off = document.createElement('canvas');
    off.width = 256;
    off.height = 256;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(img, 0, 0);
    let imgData;
    try {
      imgData = octx.getImageData(0, 0, 256, 256);
    } catch (e) {
      return;
    }
    const data = imgData.data;
    canvas._rawBytes = new Uint8ClampedArray(data);
    const catMap = new Uint8Array(65536);

    // Passe 1 : classification chromatique directe (1=Bleu, 2=Rouge, 3=Orange, 4=Violet/Local)
    for (let idx = 0; idx < 65536; idx++) {
      const p = idx * 4;
      const a = data[p + 3];
      if (a <= 12) continue;
      const r = data[p], g = data[p + 1], b = data[p + 2];
      const maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const sat = maxC - minC;
      if (sat < 26) continue; // pixel neutre (cartouche blanc/noir) -> résolu en passe 2

      if (b > 85 && b > r * 1.25 && b >= g * 1.08) {
        catMap[idx] = 1; // Bleu (INT)
      } else if (r > 95 && r > b * 1.35 && g < r * 0.42) {
        catMap[idx] = 2; // Rouge (NAT)
      } else if (r > 105 && g >= r * 0.42 && b < r * 0.65) {
        catMap[idx] = 3; // Orange (REG)
      } else {
        catMap[idx] = 4; // Violet / Autres (LOC)
      }
    }

    // Passe 2 : rattacher les pixels neutres (fond/texte des cartouches) à la couleur de leur bordure voisine
    const offsets = [-2, 2, -512, 512, -4, 4, -1024, 1024, -771, 771, -765, 765, -1536, 1536, -6, 6];
    for (let idx = 0; idx < 65536; idx++) {
      if (catMap[idx] !== 0) continue;
      if (data[idx * 4 + 3] <= 12) continue;
      for (let k = 0; k < offsets.length; k++) {
        const nIdx = idx + offsets[k];
        if (nIdx >= 0 && nIdx < 65536) {
          const c = catMap[nIdx];
          if (c !== 0) {
            catMap[idx] = c;
            break;
          }
        }
      }
      if (catMap[idx] === 0) catMap[idx] = 2; // par défaut rattacher aux GR nationaux
    }

    canvas._catMap = catMap;
  }

  static _drawFilteredTile(canvas) {
    const img = canvas._img;
    if (!img) return;
    const ctx = canvas.getContext('2d');
    const f = this.colorFilters;

    // Si toutes les couleurs sont cochées : dessin natif ultra-rapide
    if (f.blue && f.red && f.orange && f.purple) {
      ctx.clearRect(0, 0, 256, 256);
      ctx.drawImage(img, 0, 0);
      return;
    }

    // Si aucune couleur n'est cochée : tuile vide
    if (!f.blue && !f.red && !f.orange && !f.purple) {
      ctx.clearRect(0, 0, 256, 256);
      return;
    }

    this._ensureTileCategoryMap(canvas);
    if (!canvas._rawBytes || !canvas._catMap) {
      ctx.clearRect(0, 0, 256, 256);
      ctx.drawImage(img, 0, 0);
      return;
    }

    const allow = [0, f.blue ? 1 : 0, f.red ? 1 : 0, f.orange ? 1 : 0, f.purple ? 1 : 0];
    const outImg = ctx.createImageData(256, 256);
    const out = outImg.data;
    const raw = canvas._rawBytes;
    const catMap = canvas._catMap;

    for (let idx = 0; idx < 65536; idx++) {
      const cat = catMap[idx];
      if (cat !== 0 && allow[cat]) {
        const p = idx * 4;
        out[p] = raw[p];
        out[p + 1] = raw[p + 1];
        out[p + 2] = raw[p + 2];
        out[p + 3] = raw[p + 3];
      }
    }
    ctx.putImageData(outImg, 0, 0);
  }

  static refreshFilteredTiles() {
    if (!this._activeGridLayer || !this._activeGridLayer._tiles) return;
    Object.values(this._activeGridLayer._tiles).forEach(t => {
      if (t && t.el) this._drawFilteredTile(t.el);
    });
  }

  static setColorFilter(colorKey, enabled) {
    if (!(colorKey in this.colorFilters)) return;
    this.colorFilters[colorKey] = !!enabled;
    this._syncFilterCheckboxesUI();
    this.refreshFilteredTiles();
  }

  static setAllColorFilters(preset) {
    if (preset === 'all') {
      this.colorFilters = { blue: true, red: true, orange: true, purple: true };
    } else if (preset === 'red') {
      this.colorFilters = { blue: false, red: true, orange: false, purple: false };
    } else if (preset === 'major') {
      this.colorFilters = { blue: true, red: true, orange: false, purple: false };
    }
    this._syncFilterCheckboxesUI();
    this.refreshFilteredTiles();
  }

  static _syncFilterCheckboxesUI() {
    const panel = document.getElementById('gr-color-filter-panel');
    if (!panel) return;
    ['blue', 'red', 'orange', 'purple'].forEach(k => {
      const cb = panel.querySelector(`input[data-gr-color="${k}"]`);
      if (cb) cb.checked = !!this.colorFilters[k];
    });
  }

  static setOverlayDimmed(dimmed) {
    this._overlayDimmed = !!dimmed;
    if (this._activeGridLayer && typeof this._activeGridLayer.setOpacity === 'function') {
      this._activeGridLayer.setOpacity(dimmed ? 0.28 : 0.92);
    }
  }

  static ensureColorFilterPanel(map) {
    let panel = document.getElementById('gr-color-filter-panel');
    if (panel) return panel;

    const host = (map && map.getContainer()) ? map.getContainer() : document.body;
    panel = document.createElement('div');
    panel.id = 'gr-color-filter-panel';
    panel.className = 'hidden absolute top-14 right-2.5 z-[1000] bg-white/95 backdrop-blur-md border-2 border-slate-300 rounded-2xl shadow-xl p-2.5 w-72 text-slate-800 select-none transition-all';

    const frenchGrOptions = this.FRENCH_GR_DIRECTORY.map(item =>
      `<option value="${this._esc(item.ref)}">${this._esc(item.ref)} — ${this._esc(item.name)}</option>`
    ).join('');

    const famousOptions = this.FAMOUS_TRAILS.map(ft =>
      `<option value="FAMOUS:${ft.id}">${this._esc(ft.ref)} — ${this._esc(ft.name)}</option>`
    ).join('');

    panel.innerHTML = `
      <div class="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-200">
        <div class="flex items-center gap-1.5">
          <span class="text-sm">🥾</span>
          <span class="font-black text-[11px] uppercase tracking-wider text-slate-900">Carte des GR® &amp; Filtres</span>
        </div>
        <button type="button" id="btn-toggle-gr-filter-body" class="text-[11px] font-bold text-slate-500 hover:text-slate-900 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 cursor-pointer" title="Réduire / Agrandir">▾</button>
      </div>
      <div id="gr-color-filter-body" class="space-y-1.5">
        <!-- Module Choix du GR Français par liste déroulante numérique -->
        <div class="bg-rose-50/90 border border-rose-200 rounded-xl p-2 space-y-1.5">
          <label for="gr-french-dropdown" class="block text-[10px] font-black uppercase tracking-wider text-rose-800 flex items-center gap-1">
            <span>🇫🇷</span> Choix d'un GR® Français (ordre numérique)
          </label>
          <div class="flex items-center gap-1">
            <select id="gr-french-dropdown" class="flex-1 min-w-0 text-[11px] font-bold text-slate-900 bg-white border border-rose-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer">
              <option value="">— Sélectionner un GR® Français (${this.FRENCH_GR_DIRECTORY.length} GR) —</option>
              <optgroup label="🇫🇷 GR® Français ( par ordre numérique )">
                ${frenchGrOptions}
              </optgroup>
              <optgroup label="🌍 Grands Itinéraires Réputés (Europe &amp; Monde)">
                ${famousOptions}
              </optgroup>
            </select>
            <button type="button" id="btn-gr-dropdown-go" class="bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] px-2.5 py-1.5 rounded-lg shadow cursor-pointer transition flex-shrink-0" title="Afficher et zoomer sur ce GR">
              Afficher
            </button>
          </div>
        </div>
        <div class="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 font-semibold leading-tight">
          💡 <b>Cliquez aussi sur un chemin</b> sur la carte pour afficher son nom et le faire ressortir !
        </div>
        <label class="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-slate-100 cursor-pointer transition">
          <input type="checkbox" data-gr-color="blue" checked class="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer" />
          <span class="w-4 h-1.5 rounded-full flex-shrink-0" style="background:#1028e0;"></span>
          <span class="flex-1 min-w-0">
            <span class="block text-[11px] font-extrabold text-slate-900 leading-tight">Chemins Bleus (Europe)</span>
            <span class="block text-[9.5px] text-slate-500 truncate">E1–E12, Compostelle, Francigena, GR 5</span>
          </span>
        </label>
        <label class="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-slate-100 cursor-pointer transition">
          <input type="checkbox" data-gr-color="red" checked class="w-3.5 h-3.5 accent-rose-600 rounded cursor-pointer" />
          <span class="w-4 h-1.5 rounded-full flex-shrink-0" style="background:#b00000;"></span>
          <span class="flex-1 min-w-0">
            <span class="block text-[11px] font-extrabold text-slate-900 leading-tight">Chemins Rouges (GR®)</span>
            <span class="block text-[9.5px] text-slate-500 truncate">GR Nationaux (GR 20, GR 10, GR 34…)</span>
          </span>
        </label>
        <label class="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-slate-100 cursor-pointer transition">
          <input type="checkbox" data-gr-color="orange" checked class="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer" />
          <span class="w-4 h-1.5 rounded-full flex-shrink-0" style="background:#d97706;"></span>
          <span class="flex-1 min-w-0">
            <span class="block text-[11px] font-extrabold text-slate-900 leading-tight">Chemins Oranges (GRP)</span>
            <span class="block text-[9.5px] text-slate-500 truncate">GR de Pays & Régionaux (TMB…)</span>
          </span>
        </label>
        <label class="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-slate-100 cursor-pointer transition">
          <input type="checkbox" data-gr-color="purple" checked class="w-3.5 h-3.5 accent-purple-600 rounded cursor-pointer" />
          <span class="w-4 h-1.5 rounded-full flex-shrink-0" style="background:#8b3dff;"></span>
          <span class="flex-1 min-w-0">
            <span class="block text-[11px] font-extrabold text-slate-900 leading-tight">Chemins Violets (PR)</span>
            <span class="block text-[9.5px] text-slate-500 truncate">Sentiers locaux & Promenades</span>
          </span>
        </label>
        <div class="pt-1 border-t border-slate-200 flex items-center justify-between gap-1">
          <button type="button" data-gr-preset="all" class="flex-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 py-1 rounded-md cursor-pointer transition">Tout cocher</button>
          <button type="button" data-gr-preset="red" class="flex-1 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-1 rounded-md cursor-pointer transition">GR Rouges</button>
          <button type="button" data-gr-preset="major" class="flex-1 text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 py-1 rounded-md cursor-pointer transition">Bleus+Rouges</button>
        </div>
      </div>
    `;

    if (typeof L !== 'undefined' && L.DomEvent) {
      L.DomEvent.disableClickPropagation(panel);
      L.DomEvent.disableScrollPropagation(panel);
    }

    panel.querySelectorAll('input[data-gr-color]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const key = e.target.getAttribute('data-gr-color');
        this.setColorFilter(key, e.target.checked);
      });
    });

    panel.querySelectorAll('button[data-gr-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setAllColorFilters(btn.getAttribute('data-gr-preset'));
      });
    });

    const grSelect = panel.querySelector('#gr-french-dropdown');
    const grGoBtn = panel.querySelector('#btn-gr-dropdown-go');
    const triggerDropdownGr = () => {
      if (!grSelect || !grSelect.value) return;
      const val = grSelect.value;
      const targetMap = map || (window.MapManagerInstance ? window.MapManagerInstance.map : null);
      if (val.startsWith('FAMOUS:')) {
        const relId = parseInt(val.replace('FAMOUS:', ''), 10);
        const ft = this.FAMOUS_TRAILS.find(f => f.id === relId);
        if (ft) this.displayRemote(ft, targetMap);
      } else {
        this.displayFrenchGrByRef(val, targetMap);
      }
    };
    if (grSelect) {
      grSelect.addEventListener('change', triggerDropdownGr);
    }
    if (grGoBtn) {
      grGoBtn.addEventListener('click', triggerDropdownGr);
    }

    const toggleBtn = panel.querySelector('#btn-toggle-gr-filter-body');
    const bodyEl = panel.querySelector('#gr-color-filter-body');
    if (toggleBtn && bodyEl) {
      toggleBtn.addEventListener('click', () => {
        const isHidden = bodyEl.classList.toggle('hidden');
        toggleBtn.textContent = isHidden ? '▸' : '▾';
      });
    }

    host.appendChild(panel);
    return panel;
  }

  static setColorFilterPanelVisible(visible, map) {
    const panel = this.ensureColorFilterPanel(map);
    if (!panel) return;
    if (visible) {
      panel.classList.remove('hidden');
      this._syncFilterCheckboxesUI();
    } else {
      panel.classList.add('hidden');
    }
  }

  // ====================================================================
  // 2. CLIC DIRECT SUR UN CHEMIN SUR LA CARTE POUR L'IDENTIFIER
  // ====================================================================
  static _ll2merc(lat, lon) {
    const x = lon * 20037508.34 / 180;
    const y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
    return [x, y * 20037508.34 / 180];
  }

  static _groupToColorKey(group) {
    const g = (group || '').toUpperCase();
    if (g === 'INT') return 'blue';
    if (g === 'NAT') return 'red';
    if (g === 'REG') return 'orange';
    return 'purple';
  }

  static async handleMapClickForGr(latlng, map) {
    if (!latlng || !map) return false;
    const [mx, my] = this._ll2merc(latlng.lat, latlng.lng);
    const zoom = map.getZoom ? map.getZoom() : 10;
    // Rayon de tolérance équivalent à ~11 pixels à l'écran
    const metersPerPixel = 40075016.686 / (256 * Math.pow(2, zoom));
    const tol = Math.min(35000, Math.max(100, Math.round(metersPerPixel * 11)));
    const bbox = `${(mx - tol).toFixed(1)},${(my - tol).toFixed(1)},${(mx + tol).toFixed(1)},${(my + tol).toFixed(1)}`;

    try {
      const resp = await fetch(`${this.WMT}/list/by_area?bbox=${bbox}&limit=18`);
      if (!resp.ok) return false;
      const data = await resp.json();
      let results = (data && Array.isArray(data.results)) ? data.results : [];
      if (!results.length) return false;

      // Ne retenir que les catégories de couleurs actuellement cochées par l'utilisateur
      results = results.filter(r => {
        const cKey = this._groupToColorKey(r.group);
        return !!this.colorFilters[cKey];
      });
      if (!results.length) return false;

      // Prioriser les GR Nationaux (NAT) et Internationaux (INT) puis Régionaux (REG)
      const rank = (r) => {
        const g = (r.group || '').toUpperCase();
        let s = 0;
        if (g === 'NAT') s += 40;
        else if (g === 'INT') s += 38;
        else if (g === 'REG') s += 25;
        if (r.ref && /^GR/i.test(r.ref)) s += 20;
        if (r.name) s += 5;
        return s;
      };
      results.sort((a, b) => rank(b) - rank(a));

      await this.displayRemote(results[0], map, {
        fitBounds: false,
        candidates: results.slice(0, 6)
      });
      return true;
    } catch (e) {
      console.warn('Identification sentier au clic non disponible:', e);
      return false;
    }
  }

  // ====================================================================
  // 3. NOMS EXPLICITES SUR LE CHEMIN (BADGES LE LONG DU TRACÉ)
  // ====================================================================
  static _addRouteNameLabels(segs, refText, nameText, layerGroup) {
    if (!segs || !segs.length || !layerGroup) return;
    const flatPts = [];
    segs.forEach(s => {
      if (Array.isArray(s)) s.forEach(pt => flatPts.push(pt));
    });
    if (flatPts.length < 4) return;

    const cleanRef = (refText || '').trim();
    const cleanName = (nameText || '').trim();
    let badgeLabel = cleanRef || cleanName;
    if (cleanRef && cleanName && cleanName.toUpperCase() !== cleanRef.toUpperCase()) {
      const shortName = cleanName.length > 30 ? cleanName.slice(0, 28) + '…' : cleanName;
      badgeLabel = `${cleanRef} • ${shortName}`;
    }
    if (!badgeLabel) return;

    // Placer 1 à 3 étiquettes bien espacées le long du sentier (22%, 50%, 78%)
    const fractions = flatPts.length > 80 ? [0.22, 0.50, 0.78] : [0.50];
    const usedPts = [];

    fractions.forEach(f => {
      const idx = Math.min(flatPts.length - 1, Math.max(0, Math.floor(flatPts.length * f)));
      const pt = flatPts[idx];
      if (!pt) return;
      // Éviter que deux étiquettes soient trop proches
      const tooClose = usedPts.some(u => Math.abs(u[0] - pt[0]) + Math.abs(u[1] - pt[1]) < 0.04);
      if (tooClose) return;
      usedPts.push(pt);

      const labelIcon = L.divIcon({
        className: 'gr-route-inline-label',
        html: `<div class="inline-flex items-center gap-1 bg-white/95 text-rose-700 font-black text-[10px] px-2 py-0.5 rounded-full shadow-md border-2 border-rose-600 whitespace-nowrap select-none pointer-events-none -translate-x-1/2 -translate-y-1/2"><span>🥾</span><span>${this._esc(badgeLabel)}</span></div>`,
        iconSize: [0, 0]
      });
      layerGroup.addLayer(L.marker(pt, { icon: labelIcon, interactive: false, zIndexOffset: 900 }));
    });

    // Marqueurs Départ & Arrivée aux extrémités du tracé réel
    const startPt = flatPts[0];
    const endPt = flatPts[flatPts.length - 1];
    if (startPt && endPt && (Math.abs(startPt[0] - endPt[0]) + Math.abs(startPt[1] - endPt[1]) > 0.01)) {
      const startIcon = L.divIcon({
        className: 'gr-marker-pin',
        html: `<div class="bg-emerald-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-lg border-2 border-white flex items-center gap-1 whitespace-nowrap select-none -translate-x-1/2 -translate-y-full"><span>🚩</span><span>${this._esc(cleanRef || 'Départ')}</span></div>`,
        iconSize: [0, 0]
      });
      const endIcon = L.divIcon({
        className: 'gr-marker-pin',
        html: `<div class="bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-lg border-2 border-white flex items-center gap-1 whitespace-nowrap select-none -translate-x-1/2 -translate-y-full"><span>🏁</span><span>${this._esc(cleanRef || 'Arrivée')}</span></div>`,
        iconSize: [0, 0]
      });
      layerGroup.addLayer(L.marker(startPt, { icon: startIcon, interactive: false, zIndexOffset: 950 }));
      layerGroup.addLayer(L.marker(endPt, { icon: endIcon, interactive: false, zIndexOffset: 950 }));
    }
  }

  // ====================================================================
  // 4. RECHERCHE DES CHEMINS RÉPUTÉS PAR LEUR NOM (FRANCE, EUROPE & MONDE)
  // ====================================================================
  static FAMOUS_TRAILS = [
    { keywords: ['francigena', 'via francigena'], id: 11860709, ref: 'VF', name: 'Via Francigena (Canterbury ➔ Rome)', group: 'INT', query: 'Via Francigena' },
    { keywords: ['west highland', 'highland way', 'whw'], id: 16287, ref: 'WHW', name: 'West Highland Way (Écosse)', group: 'NAT', query: 'West Highland Way' },
    { keywords: ['mont-blanc', 'mont blanc', 'tmb', 'tour du mont'], id: 124456, ref: 'TMB', name: 'Tour du Mont-Blanc (France • Italie • Suisse)', group: 'REG', query: 'Tour du Mont Blanc' },
    { keywords: ['stevenson', 'chemin de stevenson'], id: 223039, ref: 'GR 70', name: 'Chemin de Stevenson (Cévennes)', group: 'NAT', query: 'Stevenson' },
    { keywords: ['douaniers', 'sentier des douaniers', 'tour de bretagne'], id: 7790332, ref: 'GR 34', name: 'Sentier des Douaniers (Tour de Bretagne)', group: 'NAT', query: 'GR 34' },
    { keywords: ['compostelle', 'saint-jacques', 'saint jacques', 'via podiensis', 'chemin du puy'], id: 11959152, ref: 'GR 65', name: 'Chemin de Saint-Jacques (Via Podiensis • Le Puy)', group: 'NAT', query: 'GR 65' },
    { keywords: ['camino frances', 'camino francés', 'camino de santiago'], id: 2163569, ref: 'Camino', name: 'Camino Francés de Santiago (Espagne)', group: 'INT', query: 'Camino Frances' },
    { keywords: ['alta via', 'dolomiti', 'dolomites'], id: 177743, ref: 'AV1', name: 'Alta Via n. 1 delle Dolomiti (Italie)', group: 'REG', query: 'Alta Via 1' },
    { keywords: ['kungsleden', 'voie royale'], id: 1657661, ref: 'KL', name: 'Kungsleden • La Voie Royale (Suède)', group: 'NAT', query: 'Kungsleden' },
    { keywords: ['pennine way', 'pennine'], id: 4086931, ref: 'PW', name: 'Pennine Way (Angleterre / Écosse)', group: 'NAT', query: 'Pennine Way' },
    { keywords: ['via alpina'], id: 20014200, ref: 'VA', name: 'Via Alpina (Traversée de l’Arc Alpin)', group: 'INT', query: 'Via Alpina' },
    { keywords: ['rota vicentina', 'vicentina'], id: 7592697, ref: 'GR 11', name: 'Rota Vicentina • Caminho Histórico (Portugal)', group: 'NAT', query: 'Rota Vicentina' },
    { keywords: ['laugavegur'], id: 1225037, ref: 'Laugav.', name: 'Laugavegur (Islande : Landmannalaugar ➔ Þórsmörk)', group: 'REG', query: 'Laugavegur' },
    { keywords: ['oisans', 'ecrins', 'écrins', 'tour des ecrins', 'tour des écrins'], id: 2909096, ref: 'GR 54', name: 'Tour de l’Oisans et des Écrins', group: 'NAT', query: 'GR 54' },
    { keywords: ['queyras', 'tour du queyras'], id: 9711201, ref: 'GR 58', name: 'Tour du Queyras (Hautes-Alpes)', group: 'NAT', query: 'GR 58' },
    { keywords: ['jura', 'gtj', 'traversee du jura', 'traversée du jura'], id: 1750445, ref: 'GR 509', name: 'Grande Traversée du Jura (GTJ)', group: 'NAT', query: 'Grande Traversee du Jura' },
    { keywords: ['gta', 'traversee des alpes', 'traversée des alpes'], id: 18308154, ref: 'GR 5', name: 'Grande Traversée des Alpes (GR 5 France)', group: 'INT', query: 'GR 5' },
    { keywords: ['traversee des pyrenees', 'traversée des pyrénées', 'hendaye banyuls'], id: 7411272, ref: 'GR 10', name: 'La Grande Traversée des Pyrénées (GR 10)', group: 'NAT', query: 'GR 10' },
    { keywords: ['fra li monti', 'traversee de la corse', 'traversée de la corse'], id: 101692, ref: 'GR 20', name: 'GR 20 • Traversée de la Corse (Fra li Monti)', group: 'NAT', query: 'GR 20' }
  ];

  static isNamedTrailQuery(query) {
    if (!query || query.trim().length < 3) return false;
    if (this.isGrQuery(query)) return false;
    const q = query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/^(sentier|chemin|tour d|via |camino |alta via|traversee |gr |grp )/i.test(q)) return true;
    return this.FAMOUS_TRAILS.some(ft =>
      ft.keywords.some(kw => {
        const cleanKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return (q.length >= 3 && cleanKw.includes(q)) || q.includes(cleanKw);
      })
    );
  }

  static async searchNamedTrails(query) {
    if (!query || query.trim().length < 3) return [];
    const qNorm = query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 1. Correspondances directes parmi les grands itinéraires réputés (France, Europe, Monde)
    const directMatches = this.FAMOUS_TRAILS.filter(ft =>
      ft.keywords.some(kw => {
        const cleanKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return cleanKw.includes(qNorm) || qNorm.includes(cleanKw);
      })
    ).map(ft => ({
      id: ft.id,
      ref: ft.ref,
      name: ft.name,
      group: ft.group
    }));

    // 2. Recherche complémentaire temps réel sur l'API Waymarked Trails
    let apiResults = [];
    try {
      const resp = await fetch(`${this.WMT}/list/search?limit=15&query=${encodeURIComponent(query.trim())}`);
      if (resp.ok) {
        const data = await resp.json();
        apiResults = (data && Array.isArray(data.results)) ? data.results : [];
      }
    } catch (e) {}

    const seen = new Set();
    const combined = [];
    [...directMatches, ...apiResults].forEach(it => {
      if (!it || !it.id || seen.has(it.id)) return;
      seen.add(it.id);
      combined.push({
        id: it.id,
        ref: it.ref || (it.name ? it.name.slice(0, 10) : 'Sentier'),
        name: it.name || it.ref || 'Sentier balisé',
        group: it.group || 'NAT',
        itinerary: it.itinerary || null,
        operator: it.operator || ''
      });
    });

    return combined.slice(0, 8);
  }

}

if (typeof window !== 'undefined') {
  window.GrManager = GrManager;
}
