// Dictionnaire des correspondances commerciales IGN TOP 25 / Série Bleue (OT / ET / SB)

window.IGN_COMMERCIAL_REFS = {

  "085_086": "3245 ET",  // Aubagne / Massif de la Sainte-Baume

  "085_088": "3245 ET",  // Aubagne / La Ciotat

  "087_088": "3346 OT",  // Toulon / Le Gros Cerveau / Mont Faron

  "089_088": "3446 OT",  // Hyères / Ile de Porquerolles

  "091_088": "3446 OT",  // La Londe-les-Maures / Bormes-les-Mimosas

  "065_034": "3218 SB",  // Bourbonne-les-Bains

  "083_086": "3145 ET",  // Marseille / Les Calanques

  "091_086": "3545 OT",  // Saint-Tropez / Sainte-Maxime / Massif des Maures

  "091_084": "3544 ET",  // Fréjus / Saint-Raphaël

  "093_082": "3643 ET",  // Cannes / Grasse

  "095_080": "3742 OT",  // Nice / Monaco / Menton

  "093_056": "3630 OT",  // Chamonix / Mont-Blanc

  "087_086": "3345 OT",  // Signes / Tourves / Brignoles

  "089_086": "3445 OT",  // Le Luc / Cuers

  "083_084": "3144 OT",  // Aix-en-Provence / Sainte-Victoire

  "085_084": "3244 ET",  // Sainte-Victoire

  "089_082": "3442 OT",  // Gorges du Verdon / Moustiers-Sainte-Marie

  "091_082": "3542 ET",  // Castellane / Lac de Castillon

  "095_078": "3841 OT",  // Vallée de la Roya / Vallée de la Bévéra

  "093_078": "3741 OT",  // Vallée de la Vésubie / Mercantour

  "065_032": "3218 SB"   // Bourbonne-les-Bains / Fresnes-sur-Apance

};

const IGN_COMMERCIAL_REFS = window.IGN_COMMERCIAL_REFS;



function getSheetCommercialLabel(num, title) {

  if (IGN_COMMERCIAL_REFS[num]) {

    return `${IGN_COMMERCIAL_REFS[num]} • ${title}`;

  }

  return `TOP 25 ${title}`;

}



/**

 * Leaflet Map Manager with IGN, OpenStreetMap, Clean GPX Polylines & Selection Halo

 * Les Randonneurs Sanaryens - RandoFinder - JLD Apps 2026

 */



class MapManager {

  constructor(mapContainerId) {

    this.containerId = mapContainerId;

    this.map = null;

        // -------------------------------------------------------------

    this.baseLayers = {};

    this.markersLayer = null;

    this.selectionHaloLayer = null;

    this.trackLayer = null;

    this.activeTrackPolyline = null;

    this.searchCircle = null;

    this.searchOriginMarker = null;

    this.cursorMarker = null;

    this.clickModeActive = false;



    this.selectedHike = null;

    this.hoveredHike = null;

    this.currentHikesList = [];

    this.onHikeSelectCallback = null;

    this.onHikeHoverCallback = null;

    this.onHikeHoverEndCallback = null;

    this.onSearchOriginChangeCallback = null;

    this.onMapBackgroundClickCallback = null;



    // Default center: Sanary-sur-Mer (43.1189, 5.8033)

    this.searchOrigin = { lat: 43.1189, lon: 5.8033, name: 'Sanary-sur-Mer' };

    this.searchRadiusKm = 100;



    // Area selection state (2-click rectangle print mode)

    this.currentBaseLayer = 'igntop25';

    this.areaSelectionActive = false;

    this.areaSelectionCorner1 = null;

    this.areaSelectionLayer = null;

    this.areaSelectionRect = null;

    this.areaSelectionOnComplete = null;

    this.areaSelectionOnCancel = null;



    // Carroyage UTM & HUD

    this.utmGridLayer = null;

    this._lastCoords = null;

    this._cursorRafId = null;

    this._pendingCursorLatLng = null;

    this._isProgrammaticZoom = false;



    // Mesure de Cap / Azimut (2 clics entre Point A et Point B)

    this.bearingMeasurementActive = false;

    this.bearingMeasurements = [];

    this.bearingPointA = null;

    this.bearingPointB = null;

    this.bearingLayer = null;

    this.bearingPreviewLine = null;



    // Mesure d'itinéraire par clics successifs

    this.measurePathActive = false;

    this.isHudMinimized = false;

    this.measurePoints = [];

    this.measureMarkers = [];

    this.measurePolyline = null;

    this.measurePreviewLine = null;

    this.measureLayer = null;

    this._onMeasureMouseMove = null;

    this.measureTotalDistance = 0;

    this._onBearingMouseMove = null;

    this._onBearingKeyDown = null;



    // Altimétrie en direct (IGN RGE Alti® & Open-Meteo)

    this._elevationCache = new Map();

    this._cityCache = new Map();

    this._cityAbortCtrl = null;

    this._cityTimeout = null;

    this.currentCity = '';

    this._elevationDebounceTimer = null;

    this._elevationAbortCtrl = null;

    this._currentElevation = null;



    // Date edition carte papier IGN (Scan 25 WFS graphe_scan25)

    this._ignSheetCache = new Map();

    this._ignSheetTimeout = null;

    this._sheetsCache = new Map();

    this._sheetsTimeout = null;

    this.currentBaseLayer = 'igntop25';

    this._currentIgnAttribution = '&copy; IGN France - Carte TOPO 25 (SCAN 25® • <span id="ign-paper-date-badge" class="font-bold text-slate-700 hover:text-sky-600 cursor-pointer" onclick="window.MapManagerInstance && window.MapManagerInstance.togglePaperSheetBounds()" title="Feuille IGN : TOULON (087_088) • Édition papier : 2020 • Cliquer pour afficher/masquer les limites papier">Édition papier : 2020</span>)';

  }



  init() {

    if (this.map) return;



    // 1. Define Base Layers

    // Véritable IGN TOP 25 officiel (Scan 25 Touristique papier avec balisages GR® roses et rochers)

    
    // Rechargement automatique des tuiles en cas de micro-coupure réseau IGN
    const attachTileAutoRetry = (layer, maxRetries = 2, delayMs = 600) => {
      if (!layer) return;
      layer.on('tileerror', (error) => {
        const tile = error.tile;
        if (!tile) return;
        const count = parseInt(tile.dataset.retryCount || '0', 10);
        if (count < maxRetries) {
          tile.dataset.retryCount = count + 1;
          setTimeout(() => {
            const rawSrc = tile.src.split('&_retry=')[0];
            const sep = rawSrc.includes('?') ? '&' : '?';
            tile.src = `${rawSrc}${sep}_retry=${count + 1}_${Date.now()}`;
          }, delayMs);
        }
      });
    };

    const ignTop25 = L.tileLayer('https://data.geopf.fr/private/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image%2Fjpeg&apikey=ign_scan_ws', {

      maxZoom: 19,

      maxNativeZoom: 18,

      attribution: this._currentIgnAttribution

    });



    const ignPlan = L.tileLayer('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image%2Fpng', {

      maxZoom: 19,

      attribution: '&copy; IGN France - Plan Numérique v2'

    });



    const osmFr = L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {

      maxZoom: 19,

      subdomains: 'abc',

      attribution: '&copy; OpenStreetMap France'

    });



    const openTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {

      maxZoom: 19,

      maxNativeZoom: 17,

      subdomains: 'abc',

      attribution: '&copy; OpenTopoMap'

    });



    const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {

      maxZoom: 19,

      maxNativeZoom: 18,

      attribution: '&copy; Esri World Imagery (Monde 🌍 & France)'

    });



    const ignSat = L.tileLayer('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image%2Fjpeg', {

      maxZoom: 19,

      attribution: '&copy; IGN France (Orthophoto HD)'

    });



    // Carte des GR sur fond épuré (IGN Plan v2 atténué monochrome + Esri Light Gray + Waymarked Trails Hiking)

    const esriLightGray = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {

      maxZoom: 19,

      maxNativeZoom: 16,

      attribution: '&copy; Esri, HERE, Garmin'

    });

    const ignPlanEpure = L.tileLayer('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image%2Fpng', {

      maxZoom: 19,

      opacity: 0.58,

      className: 'leaflet-layer-epure',

      attribution: '&copy; IGN France (Fond Plan épuré)'

    });

    const waymarkedGrOverlay = (typeof GrManager !== 'undefined' && GrManager.createFilteredGrTileLayer)

      ? GrManager.createFilteredGrTileLayer()

      : L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {

          maxZoom: 19,

          maxNativeZoom: 18,

          opacity: 0.92,

          attribution: '&copy; Waymarked Trails (Réseau GR® & Sentiers balisés)'

        });

    this.waymarkedGrOverlay = waymarkedGrOverlay;

    const grMapLayer = L.layerGroup([esriLightGray, ignPlanEpure, waymarkedGrOverlay]);



    // -------------------------------------------------------------

    // DRAPEAUX SVG VECTORIELS (Compatibilité 100% Windows, Mac & Mobile)

    // -------------------------------------------------------------

    const flagFr = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'%3E%3Crect width='1' height='2' fill='%23002654'/%3E%3Crect x='1' width='1' height='2' fill='%23ffffff'/%3E%3Crect x='2' width='1' height='2' fill='%23ce1126'/%3E%3C/svg%3E";

    const flagDe = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 5 3'%3E%3Crect width='5' height='1' fill='%23000'/%3E%3Crect y='1' width='5' height='1' fill='%23d00'/%3E%3Crect y='2' width='5' height='1' fill='%23ffce00'/%3E%3C/svg%3E";

    const flagAt = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'%3E%3Crect width='3' height='2' fill='%23ed2939'/%3E%3Crect y='0.667' width='3' height='0.667' fill='%23fff'/%3E%3C/svg%3E";

    const flagBe = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'%3E%3Crect width='1' height='2' fill='%23000'/%3E%3Crect x='1' width='1' height='2' fill='%23ffd90c'/%3E%3Crect x='2' width='1' height='2' fill='%23f31830'/%3E%3C/svg%3E";

    const flagEs = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'%3E%3Crect width='3' height='2' fill='%23aa151b'/%3E%3Crect y='0.5' width='3' height='1' fill='%23f1bf00'/%3E%3C/svg%3E";

    const flagIt = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'%3E%3Crect width='1' height='2' fill='%23009246'/%3E%3Crect x='1' width='1' height='2' fill='%23fff'/%3E%3Crect x='2' width='1' height='2' fill='%23ce2b37'/%3E%3C/svg%3E";

    const flagLu = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 5 3'%3E%3Crect width='5' height='1' fill='%23ea141d'/%3E%3Crect y='1' width='5' height='1' fill='%23fff'/%3E%3Crect y='2' width='5' height='1' fill='%2300a1de'/%3E%3C/svg%3E";

    const flagNo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 16'%3E%3Crect width='22' height='16' fill='%23ba0c2f'/%3E%3Cpath d='M0,8h22M8,0v16' stroke='%23fff' stroke-width='4'/%3E%3Cpath d='M0,8h22M8,0v16' stroke='%2300205b' stroke-width='2'/%3E%3C/svg%3E";

    const flagCh = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23d52b1e' rx='2'/%3E%3Cpath d='M13,6h6v7h7v6h-7v7h-6v-7h-7v-6h7z' fill='%23fff'/%3E%3C/svg%3E";



    const flagBadge = (dataUri, alt) => `<img src="${dataUri}" alt="${alt}" style="display:inline-block;width:17px;height:12px;vertical-align:middle;margin-right:6px;border-radius:2px;border:1px solid rgba(0,0,0,0.25);box-shadow:0 1px 2px rgba(0,0,0,0.15)">`;



    // -------------------------------------------------------------

    // FONDS NATIONAUX OFFICIELS (France, Limitrophes & Europe)

    // -------------------------------------------------------------

    // 1. Suisse - Swisstopo Pixelkarte 1:25 000 officiel (Open Data Confédération Suisse)

    const swisstopo = L.tileLayer('https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg', {

      maxZoom: 19,

      maxNativeZoom: 18,

      attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">Swisstopo</a>'

    });



    // 2. Espagne - IGN España MTN Mapa Ráster 1:25 000 officiel (Open Data Espagne / CNIG)

    const ignSpain = L.tileLayer('https://www.ign.es/wmts/mapa-raster?request=getTile&layer=MTN&TileMatrixSet=GoogleMapsCompatible&TileMatrix={z}&TileCol={x}&TileRow={y}&format=image/jpeg', {

      maxZoom: 19,

      maxNativeZoom: 18,

      attribution: '&copy; <a href="https://www.ign.es" target="_blank">IGN España - CNIG</a>'

    });



    // 3. Belgique - IGN Belgique CartoWeb Topo 1:25 000 officiel (Open Data Belgique / NGI)

    const ignBelgium = L.tileLayer('https://cartoweb.wmts.ngi.be/1.0.0/topo/default/3857/{z}/{y}/{x}.png', {

      maxZoom: 19,

      maxNativeZoom: 17,

      attribution: '&copy; <a href="https://www.ngi.be" target="_blank">IGN Belgique - CartoWeb</a>'

    });



    // 4. Allemagne - BKG basemap.de Web Raster officiel (Open Data Allemagne)

    const ignGermany = L.tileLayer('https://sgx.geodatenzentrum.de/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_farbe/default/GLOBAL_WEBMERCATOR/{z}/{y}/{x}.png', {

      maxZoom: 19,

      maxNativeZoom: 18,

      attribution: '&copy; <a href="https://www.bkg.bund.de" target="_blank">BKG / basemap.de</a>'

    });



    // 5. Autriche - Carte de randonnée alpine (Relief Topo & Sentiers balisés ÖAV Alpenverein)

    const austriaTopoBase = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {

      maxZoom: 17,

      subdomains: 'abc',

      attribution: '&copy; OpenTopoMap'

    });

    const austriaTrails = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {

      maxZoom: 18,

      opacity: 0.95,

      attribution: '&copy; Sentiers ÖAV (Alpenverein) • Waymarked Trails'

    });

    const ignAustria = L.layerGroup([austriaTopoBase, austriaTrails]);



    // 6. Italie - Carte de randonnée alpine (Relief Topo & Sentiers balisés CAI Club Alpino Italiano)

    const italyTopoBase = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {

      maxZoom: 17,

      subdomains: 'abc',

      attribution: '&copy; OpenTopoMap'

    });

    const italyCaiTrails = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {

      maxZoom: 18,

      opacity: 0.95,

      attribution: '&copy; Sentiers CAI (Club Alpino Italiano) • Waymarked Trails'

    });

    const ignItaly = L.layerGroup([italyTopoBase, italyCaiTrails]);



    // 7. Luxembourg - ACT Geoportail.lu Topo 1:20 000 officiel (Open Data Luxembourg)

    const ignLuxembourg = L.tileLayer('https://wmts.geoportail.lu/opendata/wmts/topomap/GLOBAL_WEBMERCATOR/{z}/{x}/{y}.png', {

      maxZoom: 19,

      maxNativeZoom: 18,

      attribution: '&copy; <a href="https://www.geoportail.lu" target="_blank">ACT Geoportail.lu (Luxembourg)</a>'

    });



    // 8. Norvège - Kartverket Toporaster officiel (Open Data Norvège)

    const ignNorway = L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/toporaster/default/webmercator/{z}/{y}/{x}.png', {

      maxZoom: 19,

      maxNativeZoom: 18,

      attribution: '&copy; <a href="https://www.kartverket.no" target="_blank">Kartverket (Norvège)</a>'

    });



    this.baseLayers = {

      // 1er : France

      [`${flagBadge(flagFr, 'FR')} France (IGN TOP 25 officiel)`]: ignTop25,

      [`${flagBadge(flagFr, 'FR')} France (IGN Plan moderne)`]: ignPlan,

      [`${flagBadge(flagFr, 'FR')} France (Carte des GR® épurée)`]: grMapLayer,

      // Puis par ordre alphabétique des pays

      [`${flagBadge(flagDe, 'DE')} Allemagne (basemap.de Topo)`]: ignGermany,

      [`${flagBadge(flagAt, 'AT')} Autriche (Topo & Sentiers ÖAV)`]: ignAustria,

      [`${flagBadge(flagBe, 'BE')} Belgique (IGN CartoWeb 1:25 000)`]: ignBelgium,

      [`${flagBadge(flagEs, 'ES')} Espagne (IGN MTN 1:25 000)`]: ignSpain,

      [`${flagBadge(flagIt, 'IT')} Italie (Topo & Sentiers CAI)`]: ignItaly,

      [`${flagBadge(flagLu, 'LU')} Luxembourg (ACT Topo 1:20 000)`]: ignLuxembourg,

      [`${flagBadge(flagNo, 'NO')} Norvège (Kartverket Topo)`]: ignNorway,

      [`${flagBadge(flagCh, 'CH')} Suisse (Swisstopo 1:25 000)`]: swisstopo,

      // Après les pays : fonds mondiaux & satellites

      "🌍 OpenTopoMap (Relief mondial)": openTopo,

      "🌍 OpenStreetMap France (Sentiers)": osmFr,

      "🛰️ Satellite Mondial (Esri 🌍)": esriSat,

      "🛰️ Satellite France (IGN Ortho)": ignSat

    };



    // 2. Init Map centered on Sanary-sur-Mer with official IGN Top 25 layer

    this.map = L.map(this.containerId, {

      center: [this.searchOrigin.lat, this.searchOrigin.lon],

      zoom: 11,

      maxZoom: 19,

      layers: [ignTop25],

      zoomControl: true,

      zoomSnap: 0.25,

      zoomDelta: 0.25,

      wheelPxPerZoomLevel: 60

    });



    this.utmGridLayer = L.layerGroup();

    this.paperSheetLayer = L.layerGroup();

    const overlayLayers = {

      "🌐 Carroyage UTM (Grille kilométrique)": this.utmGridLayer,

      "🗺️ Limites feuille papier (TOP 25)": this.paperSheetLayer

    };



    this.layerControl = L.control.layers(this.baseLayers, overlayLayers, { position: 'topright' }).addTo(this.map);

    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(this.map);



    this.markersLayer = L.layerGroup().addTo(this.map);

    this.selectionHaloLayer = L.layerGroup().addTo(this.map);

    this.trackLayer = L.layerGroup().addTo(this.map);



    // Activer la grille kilométrique UTM par défaut (conforme carte papier IGN Top 25)

    this.utmGridLayer.addTo(this.map);



    // Activer les limites de la carte papier TOP 25 si souhaite (actif par defaut)

    const showPaperLimits = localStorage.getItem('rf_show_paper_sheet_bounds') !== 'false';

    if (showPaperLimits) {

      this.paperSheetLayer.addTo(this.map);

    }



        // Détection automatique du pays lors du déplacement libre de la carte (pan/zoom)

    this.map.on('moveend', () => {

      if (this.currentBaseLayer === 'satellite' || this.currentBaseLayer === 'grmap') return;

      const center = this.map.getCenter();

      if (!center) return;

      const rec = this.getCountryForCoords(center.lat, center.lng);

      if (rec && rec !== this.currentBaseLayer && this.map.getZoom() >= 8) {

        this.setBaseLayer(rec);

      }

    });



    this.updateSearchRadiusVisuals(false);
    this.initCalanquesDetection();



    // Track active base layer & quadrillage IGN TOP 25

    this.map.on('baselayerchange', (e) => {

      const name = (e.name || '').toLowerCase();

      if (name.includes('top 25') || name.includes('top25')) {

        this.currentBaseLayer = 'igntop25';

        this.scheduleIgnPaperDateUpdate();

        // Si activé, ré-afficher le quadrillage des feuilles IGN TOP 25

        const showPaperLimits = localStorage.getItem('rf_show_paper_sheet_bounds') !== 'false';

        if (showPaperLimits && !this.map.hasLayer(this.paperSheetLayer)) {

          this.paperSheetLayer.addTo(this.map);

        }

        if (this.map.hasLayer(this.paperSheetLayer)) {

          this.renderPaperSheetBounds();

        }

      } else {

        if (name.includes('swisstopo') || name.includes('suisse')) this.currentBaseLayer = 'swisstopo';

        else if (name.includes('espagne') || name.includes('spain')) this.currentBaseLayer = 'ignspain';

        else if (name.includes('belgique') || name.includes('belgium')) this.currentBaseLayer = 'ignbelgium';

        else if (name.includes('allemagne') || name.includes('germany') || name.includes('basemap.de')) this.currentBaseLayer = 'igngermany';

        else if (name.includes('autriche') || name.includes('austria') || name.includes('basemap.at')) this.currentBaseLayer = 'ignaustria';

        else if (name.includes('italie') || name.includes('italy') || name.includes('igm') || name.includes('cai')) this.currentBaseLayer = 'ignitaly';

        else if (name.includes('luxembourg') || name.includes('geoportail.lu')) this.currentBaseLayer = 'ignluxembourg';

        else if (name.includes('norvège') || name.includes('norvege') || name.includes('norway') || name.includes('kartverket')) this.currentBaseLayer = 'ignnorway';

        else if (name.includes('plan')) this.currentBaseLayer = 'ignplan';

        else if (name.includes('carte des gr') || name.includes('fond épuré') || name.includes('gr®')) this.currentBaseLayer = 'grmap';

        else if (name.includes('opentopo')) this.currentBaseLayer = 'opentopo';

        else if (name.includes('france') || name.includes('openstreetmap') || name.includes('sentiers')) this.currentBaseLayer = 'osmfr';

        else if (name.includes('satellite')) this.currentBaseLayer = 'satellite';

        else this.currentBaseLayer = 'other';



        // Les limites des feuilles papier IGN sont spécifiques à IGN TOP 25

        if (this.paperSheetLayer) {

          this.paperSheetLayer.clearLayers();

        }

        // Le carroyage UTM kilométrique est universel (WGS84 mondial) et s'affiche sur tous les fonds de carte

        if (this.map.hasLayer(this.utmGridLayer)) {

          this.renderUtmGrid();

        }

        if (this.currentBaseLayer === 'satellite') {

          this.scheduleSatelliteDateUpdate();

        }

      }



      if (typeof GrManager !== 'undefined' && GrManager.setColorFilterPanelVisible) {

        GrManager.setColorFilterPanelVisible(this.currentBaseLayer === 'grmap', this.map);

      }

      if (typeof this.onBaseLayerChangeCallback === 'function') {

        this.onBaseLayerChangeCallback(this.currentBaseLayer);

      }

    });



    // Map Click Listener (Background click deselects or sets search origin)

    this.map.on('dblclick', (e) => {

      if (this.measurePathActive) {

        L.DomEvent.stop(e);

        this.finishMeasurePath();

      }

      if (this.bearingMeasurementActive) {

        L.DomEvent.stop(e);

      }

    });



    this.map.on('click', (e) => {

      if (this.measurePathActive) {

        L.DomEvent.stop(e);

        this.handleMeasureClick(e.latlng);

        return;

      }

      if (this.bearingMeasurementActive) {

        L.DomEvent.stop(e);

        this.handleBearingClick(e.latlng);

        return;

      }

      if (this.areaSelectionActive) {

        this.handleAreaSelectionClick(e.latlng);

        return;

      }

      if (this.clickModeActive) {

        this.setSearchOrigin(e.latlng.lat, e.latlng.lng, 'Point choisi sur carte');

        this.setClickMode(false);

      } else {

        if (this.currentBaseLayer === 'grmap' && typeof GrManager !== 'undefined' && GrManager.handleMapClickForGr) {

          GrManager.handleMapClickForGr(e.latlng, this.map);

        }

        if (this.onMapBackgroundClickCallback) {

          this.onMapBackgroundClickCallback();

        }

      }

    });



    // Déplacement de la carte (pan/glisser) : mise à jour UTM & HUD sans altérer le curseur de rayon

    this.map.on('moveend', () => {

      if (this.map.hasLayer(this.utmGridLayer)) {

        this.renderUtmGrid();

      }

      if (this.map.hasLayer(this.paperSheetLayer)) {

        this.schedulePaperSheetBoundsUpdate();

      }

      this.updateMapHud();

      this.updateCursorCoords(null);

      if (typeof GrManager !== 'undefined' && GrManager.scheduleViewportShieldsUpdate) {

        GrManager.scheduleViewportShieldsUpdate(this.map);

      }

      if (this.currentBaseLayer === 'igntop25') {

        this.scheduleIgnPaperDateUpdate();

      }

      if (this.currentBaseLayer === 'satellite') {

        this.scheduleSatelliteDateUpdate();

      }

    });



    // Zoom/Dézoom de la carte (molette de la souris, boutons +/-)

    this.map.on('zoomend', () => {

      if (this.map.hasLayer(this.utmGridLayer)) {

        this.renderUtmGrid();

      }

      if (this.map.hasLayer(this.paperSheetLayer)) {

        this.schedulePaperSheetBoundsUpdate();

      }

      this.updateMapHud();

      this.updateCursorCoords(null);

      if (typeof GrManager !== 'undefined' && GrManager.scheduleViewportShieldsUpdate) {

        GrManager.scheduleViewportShieldsUpdate(this.map);

      }



      // Si le zoom a été déclenché par le curseur ou la sélection d'une rando, ne pas reboucler

      if (this._isProgrammaticZoom) {

        this._isProgrammaticZoom = false;

        return;

      }



      if (this.onMapZoomChangeCallback) {

        this.onMapZoomChangeCallback(this.map.getZoom());

      }

    });



    this.map.on('overlayadd', (e) => {

      if (e.layer === this.utmGridLayer) {

        this.renderUtmGrid();

      } else if (e.layer === this.paperSheetLayer) {

        localStorage.setItem('rf_show_paper_sheet_bounds', 'true');

        this.renderPaperSheetBounds();

      }

    });



    this.map.on('overlayremove', (e) => {

      if (e.layer === this.utmGridLayer) {

        this.utmGridLayer.clearLayers();

      } else if (e.layer === this.paperSheetLayer) {

        localStorage.setItem('rf_show_paper_sheet_bounds', 'false');

        this.paperSheetLayer.clearLayers();

      }

    });



    // Écouteur de position du curseur en direct sur la carte

    this.map.on('mousemove', (e) => {

      this.updateCursorCoords(e.latlng);

    });



    this.map.on('mouseout', () => {

      this.updateCursorCoords(null);

    });



    setTimeout(() => {

      if (this.map) {

        this.map.invalidateSize();

        this.renderUtmGrid();

        this.updateMapHud();

        this.updateCursorCoords(null);

        this.setupScaleInputListeners();

        this.scheduleIgnPaperDateUpdate();

        if (this.map.hasLayer(this.paperSheetLayer)) {

          this.schedulePaperSheetBoundsUpdate();

        }

      }

    }, 250);

  }



  getCurrentBaseLayerKey() {

    return this.currentBaseLayer || 'igntop25';

  }



  /**

   * Start 2-click rectangular area selection on the map

   * @param {Function} onComplete - Callback with final bounds [[minLat, minLon], [maxLat, maxLon]]

   * @param {Function} onCancel - Callback on cancel

   */

  startAreaSelection(onComplete, onCancel) {

    if (this.measurePathActive) {

      this.cancelMeasurePath();

    }

    if (this.bearingMeasurementActive) {

      this.cancelBearingMeasurement();

    }

    this.areaSelectionActive = true;

    this.areaSelectionCorner1 = null;

    this.areaSelectionOnComplete = onComplete;

    this.areaSelectionOnCancel = onCancel;



    // Change cursor to crosshair

    L.DomUtil.addClass(this.map.getContainer(), 'area-selection-cursor');



    // Layer group for selection rectangle and corner markers

    if (!this.areaSelectionLayer) {

      this.areaSelectionLayer = L.layerGroup().addTo(this.map);

    }

    this.areaSelectionLayer.clearLayers();

    this.areaSelectionRect = null;



    // Show banner & update button in UI

    const banner = document.getElementById('map-selection-banner');

    const msg = document.getElementById('map-selection-msg');

    const btnText = document.getElementById('btn-map-area-print-text');

    if (banner) banner.classList.remove('hidden');

    if (msg) msg.innerHTML = '<span class="font-bold text-emerald-300">Étape 1 sur 2 :</span> Cliquez sur la carte pour poser le premier coin.';

    if (btnText) btnText.textContent = 'Annuler la sélection';



    // Mouse move handler

    this._onAreaMouseMove = (e) => {

      if (!this.areaSelectionCorner1) return;

      const corner2 = e.latlng;

      const bounds = L.latLngBounds(this.areaSelectionCorner1, corner2);



      if (!this.areaSelectionRect) {

        this.areaSelectionRect = L.rectangle(bounds, {

          color: '#10b981',

          weight: 2,

          dashArray: '5, 5',

          fillColor: '#10b981',

          fillOpacity: 0.2

        }).addTo(this.areaSelectionLayer);

      } else {

        this.areaSelectionRect.setBounds(bounds);

      }



      // Calculate approximate dimensions in km

      const dKmWidth = GPXParser.haversineDistance(

        this.areaSelectionCorner1.lat, this.areaSelectionCorner1.lng,

        this.areaSelectionCorner1.lat, corner2.lng

      );

      const dKmHeight = GPXParser.haversineDistance(

        this.areaSelectionCorner1.lat, this.areaSelectionCorner1.lng,

        corner2.lat, this.areaSelectionCorner1.lng

      );

      if (msg) {

        msg.innerHTML = `<span class="font-bold text-emerald-300">Étape 2 sur 2 :</span> Cliquez pour le coin opposé • <span class="bg-slate-800 px-2 py-0.5 rounded text-white font-mono">${dKmWidth.toFixed(1)} km × ${dKmHeight.toFixed(1)} km</span>`;

      }

    };

    this.map.on('mousemove', this._onAreaMouseMove);



    // Escape key handler

    this._onAreaKeyDown = (e) => {

      if (e.key === 'Escape') {

        this.cancelAreaSelection();

      }

    };

    window.addEventListener('keydown', this._onAreaKeyDown);

  }



  cancelAreaSelection() {

    this.areaSelectionActive = false;

    this.areaSelectionCorner1 = null;

    L.DomUtil.removeClass(this.map.getContainer(), 'area-selection-cursor');



    if (this._onAreaMouseMove) {

      this.map.off('mousemove', this._onAreaMouseMove);

      this._onAreaMouseMove = null;

    }

    if (this._onAreaKeyDown) {

      window.removeEventListener('keydown', this._onAreaKeyDown);

      this._onAreaKeyDown = null;

    }



    if (this.areaSelectionLayer) {

      this.areaSelectionLayer.clearLayers();

    }

    this.areaSelectionRect = null;



    const banner = document.getElementById('map-selection-banner');

    const btnText = document.getElementById('btn-map-area-print-text');

    if (banner) banner.classList.add('hidden');

    if (btnText) btnText.textContent = 'Imprimer une zone';



    if (this.areaSelectionOnCancel) {

      this.areaSelectionOnCancel();

    }

  }



  handleAreaSelectionClick(latlng) {

    if (!this.areaSelectionCorner1) {

      // 1st click: set Corner 1

      this.areaSelectionCorner1 = latlng;



      // Marker at corner 1

      L.circleMarker(latlng, {

        radius: 6,

        color: '#ffffff',

        weight: 2,

        fillColor: '#10b981',

        fillOpacity: 1

      }).addTo(this.areaSelectionLayer);



      const msg = document.getElementById('map-selection-msg');

      if (msg) {

        msg.innerHTML = '<span class="font-bold text-emerald-300">Étape 2 sur 2 :</span> Déplacez la souris et cliquez pour figer le coin opposé.';

      }

    } else {

      // 2nd click: finish selection

      const corner2 = latlng;

      const bounds = L.latLngBounds(this.areaSelectionCorner1, corner2);



      // Lock rectangle style (solid border)

      if (this.areaSelectionRect) {

        this.areaSelectionRect.setBounds(bounds);

        this.areaSelectionRect.setStyle({

          dashArray: null,

          weight: 3,

          color: '#059669',

          fillOpacity: 0.15

        });

      }



      // Marker at corner 2

      L.circleMarker(corner2, {

        radius: 6,

        color: '#ffffff',

        weight: 2,

        fillColor: '#059669',

        fillOpacity: 1

      }).addTo(this.areaSelectionLayer);



      // Clean up event listeners & cursor

      L.DomUtil.removeClass(this.map.getContainer(), 'area-selection-cursor');

      if (this._onAreaMouseMove) {

        this.map.off('mousemove', this._onAreaMouseMove);

        this._onAreaMouseMove = null;

      }

      if (this._onAreaKeyDown) {

        window.removeEventListener('keydown', this._onAreaKeyDown);

        this._onAreaKeyDown = null;

      }



      const banner = document.getElementById('map-selection-banner');

      const btnText = document.getElementById('btn-map-area-print-text');

      if (banner) banner.classList.add('hidden');

      if (btnText) btnText.textContent = 'Imprimer une zone';



      const finalBounds = [

        [Math.min(bounds.getSouth(), bounds.getNorth()), Math.min(bounds.getWest(), bounds.getEast())],

        [Math.max(bounds.getSouth(), bounds.getNorth()), Math.max(bounds.getWest(), bounds.getEast())]

      ];



      this.areaSelectionActive = false;

      this.areaSelectionCorner1 = null;



      if (this.areaSelectionOnComplete) {

        this.areaSelectionOnComplete(finalBounds);

      }

    }

  }



  clearAreaSelectionVisuals() {

    if (this.areaSelectionLayer) {

      this.areaSelectionLayer.clearLayers();

    }

    this.areaSelectionRect = null;

  }



  setClickMode(active) {

    if (active && this.bearingMeasurementActive) {

      this.cancelBearingMeasurement();

    }

    if (active && this.areaSelectionActive) {

      this.cancelAreaSelection();

    }

    this.clickModeActive = active;

    const mapEl = document.getElementById(this.containerId);

    if (mapEl) {

      if (active) mapEl.classList.add('cursor-crosshair');

      else mapEl.classList.remove('cursor-crosshair');

    }

  }



  isInsideFrance(lat, lon) {
    if (typeof lat !== 'number' || typeof lon !== 'number') return false;
    return this.getCountryForCoords(lat, lon) === 'igntop25';
  }



  setBaseLayer(key) {

    if (!this.map || !this.baseLayers) return;

    let targetLayer = null;

    let targetKey = key;

    for (const [name, layer] of Object.entries(this.baseLayers)) {

      const lower = name.toLowerCase();

      if ((key === 'swisstopo' || key === 'ch') && (lower.includes('swisstopo') || lower.includes('suisse'))) { targetLayer = layer; targetKey = 'swisstopo'; break; }

      if ((key === 'ignspain' || key === 'es') && (lower.includes('espagne') || lower.includes('spain'))) { targetLayer = layer; targetKey = 'ignspain'; break; }

      if ((key === 'ignbelgium' || key === 'be') && (lower.includes('belgique') || lower.includes('belgium'))) { targetLayer = layer; targetKey = 'ignbelgium'; break; }

      if ((key === 'igngermany' || key === 'de') && (lower.includes('allemagne') || lower.includes('germany') || lower.includes('basemap.de'))) { targetLayer = layer; targetKey = 'igngermany'; break; }

      if ((key === 'ignaustria' || key === 'at') && (lower.includes('autriche') || lower.includes('austria') || lower.includes('öav') || lower.includes('oav'))) { targetLayer = layer; targetKey = 'ignaustria'; break; }

      if ((key === 'ignitaly' || key === 'it') && (lower.includes('italie') || lower.includes('italy') || lower.includes('cai') || lower.includes('igm'))) { targetLayer = layer; targetKey = 'ignitaly'; break; }

      if ((key === 'ignluxembourg' || key === 'lu') && (lower.includes('luxembourg') || lower.includes('geoportail.lu'))) { targetLayer = layer; targetKey = 'ignluxembourg'; break; }

      if ((key === 'ignnorway' || key === 'no') && (lower.includes('norvège') || lower.includes('norvege') || lower.includes('norway') || lower.includes('kartverket'))) { targetLayer = layer; targetKey = 'ignnorway'; break; }

      if ((key === 'opentopo' || key === 'opentopomap') && lower.includes('opentopo')) { targetLayer = layer; targetKey = 'opentopo'; break; }

      if ((key === 'igntop25' || key === 'ign' || key === 'fr') && (lower.includes('top 25') || lower.includes('top25'))) { targetLayer = layer; targetKey = 'igntop25'; break; }

      if (key === 'ignplan' && lower.includes('plan')) { targetLayer = layer; targetKey = 'ignplan'; break; }

      if (key === 'grmap' && (lower.includes('carte des gr') || lower.includes('fond épuré') || lower.includes('gr®'))) { targetLayer = layer; targetKey = 'grmap'; break; }

      if (key === 'osmfr' && (lower.includes('openstreetmap') || lower.includes('sentiers') || lower.includes('france'))) { targetLayer = layer; targetKey = 'osmfr'; break; }

      if (key === 'satellite' && lower.includes('satellite')) { targetLayer = layer; targetKey = 'satellite'; break; }

    }

    if (targetLayer && !this.map.hasLayer(targetLayer)) {

      for (const [_, l] of Object.entries(this.baseLayers)) {

        if (this.map.hasLayer(l)) this.map.removeLayer(l);

      }

      this.map.addLayer(targetLayer);

      this.currentBaseLayer = targetKey;

      if (targetKey === 'igntop25') {

        this.scheduleIgnPaperDateUpdate();

        const showPaperLimits = localStorage.getItem('rf_show_paper_sheet_bounds') !== 'false';

        if (showPaperLimits && !this.map.hasLayer(this.paperSheetLayer)) {

          this.paperSheetLayer.addTo(this.map);

        }

        if (this.map.hasLayer(this.paperSheetLayer)) {

          this.renderPaperSheetBounds();

        }

      } else {

        // Le quadrillage carte IGN ne doit apparaître que lorsqu'on est en affichage IGN TOP 25

        if (this.paperSheetLayer) {

          this.paperSheetLayer.clearLayers();

        }

        if (this.utmGridLayer) {

          this.utmGridLayer.clearLayers();

        }

      }

      if (typeof GrManager !== 'undefined' && GrManager.setColorFilterPanelVisible) {

        GrManager.setColorFilterPanelVisible(this.currentBaseLayer === 'grmap', this.map);

      }

      if (typeof this.onBaseLayerChangeCallback === 'function') {

        this.onBaseLayerChangeCallback(this.currentBaseLayer);

      }

    }

  }



    getCountryForCoords(lat, lon) {

    // 1. Luxembourg (territoire précis entre Belgique, France et Allemagne)

    if (lat >= 49.44 && lat <= 50.22 && lon >= 5.73 && lon <= 6.54) {

      return 'ignluxembourg';

    }

    // 2. Suisse (Valais, Genève, Tessin, Grisons, Alpes suisses)

    // Frontière nord avec l'Allemagne : le Rhin (lat ~ 47.58, sauf Schaffhouse jusqu'à 47.81 entre 8.45 et 8.75)

    // Frontière ouest avec la France : Chamonix exclu (< 6.93 et lat < 46.05)

    if (lat >= 45.81 && lat <= 47.81 && lon >= 5.95 && lon <= 10.50) {

      const isChamonix = (lon < 6.93 && lat < 46.05);

      const isGermanSchwarzwald = (lat > 47.60 && lon < 8.45);

      const isGermanBodensee = (lat > 47.60 && lon > 8.75);

      if (!isChamonix && !isGermanSchwarzwald && !isGermanBodensee) return 'swisstopo';

    }

    // 3. Autriche (Tyrol, Tauern, Alpes autrichiennes - exclure la Bavière allemande au nord de 47.75)

    if (lat >= 46.37 && lat <= 49.03 && lon >= 9.53 && lon <= 17.17) {

      if (!(lat > 47.75 && lon < 12.8)) return 'ignaustria';

    }

    // 4. Belgique (Ardennes, Fagnes)

    if (lat >= 49.49 && lat <= 51.51 && lon >= 2.54 && lon <= 6.41) {

      return 'ignbelgium';

    }

    // 5. Espagne (Pyrénées espagnoles, Picos de Europa, Sierras)

    if (lat >= 35.9 && lat <= 43.8 && lon >= -9.3 && lon <= 3.35) {

      return 'ignspain';

    }

    // 6. Italie (Val d'Aoste, Piémont, Dolomites, Apennins)

    if (lat >= 36.6 && lat <= 47.1 && lon >= 6.62 && lon <= 18.53) {

      if (!(lat > 45.8 && lon < 6.93)) return 'ignitaly';

    }

    // 7. Allemagne (Forêt Noire, Bavière, Harz)

    if (lat >= 47.27 && lat <= 55.06 && lon >= 5.86 && lon <= 15.05) {

      return 'igngermany';

    }

    // 8. Norvège (Fjords, Lofoten, Jotunheimen)

    if (lat >= 57.9 && lat <= 71.2 && lon >= 4.5 && lon <= 31.1) {

      return 'ignnorway';

    }

    // 9. France métropolitaine, Corse & DOM
    if ((lat >= 41.3 && lat <= 51.1 && lon >= -5.2 && lon <= 9.6) ||
        (lat >= -21.5 && lat <= -20.8 && lon >= 55.1 && lon <= 55.9) ||
        (lat >= 14.3 && lat <= 16.6 && lon >= -61.9 && lon <= -60.7)) {
      return 'igntop25';
    }
    // 10. Reste du monde

    return 'opentopo';

  }



  setSearchOrigin(lat, lon, name = 'Lieu sélectionné', autoZoom = false) {

    this.searchOrigin = { lat, lon, name };



    // Si le lieu est hors de France (ex: Rome, Tokyo, Madrid, New York, Aoste, Genève)

    // et que le fond de carte actif est IGN (qui ne couvre que la France),

    // basculer automatiquement sur OpenTopoMap (Relief mondial) pour afficher le relief et la topographie

    // Auto-détection intelligente du pays et bascule automatique sur sa carte de randonnée

    if (this.currentBaseLayer !== 'satellite' && this.currentBaseLayer !== 'grmap') {

      const rec = this.getCountryForCoords(lat, lon);

      if (rec && rec !== this.currentBaseLayer) {

        this.setBaseLayer(rec);

      }

    }



    this.updateSearchRadiusVisuals(autoZoom);

    if (this.onSearchOriginChangeCallback) {

      this.onSearchOriginChangeCallback(this.searchOrigin);

    }

  }



  zoomToLocation(lat, lon, zoom = null) {

    if (!this.map) return;

    this.map.invalidateSize();

    this._isProgrammaticZoom = true;

    const targetZoom = (zoom !== null) 

      ? zoom 

      : ((this.map.getMaxZoom && this.map.getMaxZoom() !== Infinity) ? this.map.getMaxZoom() : 19);

    this.map.setView([lat, lon], targetZoom, { animate: true });

    if (this.searchOriginMarker) {

      this.searchOriginMarker.openTooltip();

    }

  }



  setSearchRadius(radiusKm, autoZoom = true) {

    this.searchRadiusKm = Number(radiusKm);

    this.updateSearchRadiusVisuals(autoZoom);

  }



  updateSearchRadiusVisuals(autoZoom = false) {

    if (!this.map) return;

    if (window.PortalRouterInstance && window.PortalRouterInstance.currentView === 'carte') {

      if (this.searchOriginMarker) { this.searchOriginMarker.remove(); this.searchOriginMarker = null; }

      if (this.searchCircle) { this.searchCircle.remove(); this.searchCircle = null; }

      return;

    }



    if (this.searchOriginMarker) {

      this.searchOriginMarker.remove();

    }



    const originIcon = L.divIcon({

      className: 'custom-origin-icon',

      html: `

        <div class="relative flex items-center justify-center w-8 h-8 -translate-x-1/2 -translate-y-1/2">

          <div class="absolute w-8 h-8 bg-blue-500 rounded-full opacity-30 animate-ping"></div>

          <div class="w-6 h-6 bg-blue-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-xs font-bold">

            📍

          </div>

        </div>

      `,

      iconSize: [0, 0]

    });



    this.searchOriginMarker = L.marker([this.searchOrigin.lat, this.searchOrigin.lon], {

      icon: originIcon,

      zIndexOffset: 1000

    }).addTo(this.map);



    this.searchOriginMarker.bindTooltip(`<b>Centre :</b> ${this.searchOrigin.name}`, {

      direction: 'top',

      offset: [0, -15]

    });



    if (this.searchCircle) {

      this.searchCircle.remove();

      this.searchCircle = null;

    }



    if (this.searchRadiusKm < 2500) {

      this.searchCircle = L.circle([this.searchOrigin.lat, this.searchOrigin.lon], {

        radius: this.searchRadiusKm * 1000,

        color: '#2563eb',

        weight: 1.5,

        dashArray: '5, 5',

        fillColor: '#3b82f6',

        fillOpacity: 0.05,

        interactive: false

      }).addTo(this.map);



      if (autoZoom && this.searchCircle) {

        this._isProgrammaticZoom = true;

        this.map.fitBounds(this.searchCircle.getBounds(), { padding: [30, 30], maxZoom: 14 });

      }

    } else {

      // Rayon Continental / Mondial (>= 2500 km et jusqu'à 20 000 km / Monde entier)

      if (autoZoom) {

        this._isProgrammaticZoom = true;

        this.fitBoundsToAllMarkers();

      }

    }

  }



  fitBoundsToAllMarkers() {

    this._isProgrammaticZoom = true;

    if (this.markersLayer && this.markersLayer.getLayers().length > 0) {

      try {

        this.map.fitBounds(this.markersLayer.getBounds(), { padding: [40, 40], maxZoom: 6 });

      } catch (e) {

        this.map.setView([25, 10], 2);

      }

    } else {

      this.map.setView([25, 10], 2);

    }

  }



  clearMarkers() {

    if (this.markersLayer) {

      this.markersLayer.clearLayers();

    }

    this.currentHikesList = [];

    this.clearTrack();

    this.clearCursorPosition();

  }



  renderHikeMarkers(hikes) {

    if (!this.markersLayer) return;

    this.currentHikesList = hikes || [];

    this.markersLayer.clearLayers();



    this.currentHikesList.forEach((hike) => {

      if (!hike.startPoint || isNaN(hike.startPoint.lat) || isNaN(hike.startPoint.lon)) return;



      const isSelected = this.selectedHike && (this.selectedHike.id === hike.id || this.selectedHike.name === hike.name);



      const ibpVal = (typeof hike.ibp === 'number') ? hike.ibp : (typeof GPXParser !== 'undefined' ? GPXParser.calculateIBP(hike) : 50);

      const ibpInfo = (typeof GPXParser !== 'undefined') ? GPXParser.getIBPLevel(ibpVal) : { level: 3, label: 'Peu difficile', color: '#ea580c' };



      const pinTooltip = `${hike.name} (${hike.distanceKm} km, +${hike.elevationGain}m) • IBP : ${ibpVal} (Niveau ${ibpInfo.level} - ${ibpInfo.label})`;



      // Marker HTML - 5 Couleurs Officielles IBP Index avec le Niveau (1 à 5)

      const icon = L.divIcon({

        className: 'custom-hike-start-icon',

        html: `

          <div class="relative cursor-pointer -translate-x-1/2 -translate-y-full group" title="${pinTooltip}">

            <!-- Pin Body -->

            <div class="relative ${isSelected ? 'w-8 h-8 scale-110 ring-4 ring-yellow-400 shadow-2xl' : 'w-7 h-7 shadow-lg'} text-white rounded-full flex items-center justify-center border-2 border-white text-xs font-black transition-transform duration-150 transform group-hover:scale-125" style="background-color: ${ibpInfo.color};">

              ${ibpInfo.level}

            </div>

            <!-- Bottom Anchor Shadow -->

            <div class="w-1.5 h-1.5 bg-slate-900 rounded-full mx-auto -mt-0.5 opacity-80"></div>

          </div>

        `,

        iconSize: [0, 0]

      });



      const marker = L.marker([hike.startPoint.lat, hike.startPoint.lon], { 

        icon: icon,

        title: pinTooltip,

        zIndexOffset: isSelected ? 2500 : 500

      });



      // Hover displays clean GPX track and preview card

      marker.on('mouseover', () => {

        this.hoveredHike = hike;

        if (this.onHikeHoverCallback) {

          this.onHikeHoverCallback(hike);

        } else {

          this.displayTrack(hike, false);

        }

      });



      marker.on('mouseout', () => {

        if (this.onHikeHoverEndCallback) {

          this.onHikeHoverEndCallback(hike);

        } else if (this.onHikeHoverCallback) {

          this.onHikeHoverCallback(this.selectedHike || null);

        } else {

          if (this.selectedHike) {

            this.displayTrack(this.selectedHike, true);

          } else {

            this.clearTrack();

          }

        }

      });



      marker.on('click', (e) => {

        L.DomEvent.stopPropagation(e);

        if (this.areaSelectionActive) {

          this.handleAreaSelectionClick(e.latlng);

          return;

        }

        this.selectHike(hike, true, true);

      });



      this.markersLayer.addLayer(marker);

    });

  }



  /**

   * Display High-Contrast Clean GPX Polyline (Authentic GPS Track)

   */

  async displayTrack(hike, isSelected = false) {

    if (!hike) return;

    if ((!hike.points || hike.points.length < 5) && typeof StorageManager !== 'undefined') {

      await StorageManager.ensureHikeTrackLoaded(hike);

    }

    if (!hike.points || hike.points.length < 5) {

      this.clearTrack();

      return;

    }



    this.clearTrack();



    const latLngs = hike.points.map(p => [p.lat, p.lon]);

    

    // GPS Track Colors: Bleu Roi Électrique (#1d4ed8 / #2563eb) pour un contraste absolu sur le fond Top 25

    const trackColor = isSelected ? '#1d4ed8' : '#2563eb';



    // 1. Bordure d'ombre externe sombre (détache le halo blanc des zones claires/falaises)

    L.polyline(latLngs, {

      color: '#0f172a',

      weight: isSelected ? 10 : 8,

      opacity: 0.35,

      lineCap: 'round',

      lineJoin: 'round',

      interactive: false

    }).addTo(this.trackLayer);



    // 2. Halo blanc pur très contrasté (détache la trace des forêts vertes et sentiers GR roses)

    L.polyline(latLngs, {

      color: '#ffffff',

      weight: isSelected ? 8 : 6,

      opacity: 0.95,

      lineCap: 'round',

      lineJoin: 'round',

      interactive: false

    }).addTo(this.trackLayer);



    // 3. Tracé GPS principal en Bleu Roi Électrique

    this.activeTrackPolyline = L.polyline(latLngs, {

      color: trackColor,

      weight: isSelected ? 5 : 4,

      opacity: 1,

      lineCap: 'round',

      lineJoin: 'round',

      interactive: false

    }).addTo(this.trackLayer);



    // 4. Marqueur de départ (Pastille verte 'D' avec halo blanc)

    const startPt = hike.points[0];

    const startIcon = L.divIcon({

      className: 'custom-start-marker',

      html: '<div style="width:20px;height:20px;background:#10b981;border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);color:#ffffff;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1;">D</div>',

      iconSize: [20, 20],

      iconAnchor: [10, 10]

    });

    L.marker([startPt.lat, startPt.lon], { icon: startIcon, interactive: false }).addTo(this.trackLayer);



    // 5. Marqueur d'arrivée (si hors boucle : Pastille rouge 'A')

    if (!hike.isLoop && hike.points.length > 1) {

      const endPt = hike.points[hike.points.length - 1];

      const endIcon = L.divIcon({

        className: 'custom-end-marker',

        html: '<div style="width:20px;height:20px;background:#ef4444;border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);color:#ffffff;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1;">A</div>',

        iconSize: [20, 20],

        iconAnchor: [10, 10]

      });

      L.marker([endPt.lat, endPt.lon], { icon: endIcon, interactive: false }).addTo(this.trackLayer);

    }



  }



  clearTrack() {

    if (this.trackLayer) {

      this.trackLayer.clearLayers();

    }

    this.activeTrackPolyline = null;

  }



  /**

   * Select a hike: draw GPX track, zoom into track, and surround start marker with flashing red circle

   */

  selectHike(hike, fitBounds = true, triggerCallback = true) {

    if (!hike) return;



    // Bascule automatique sur la carte de randonnée officielle du pays de la randonnée

    if (this.currentBaseLayer !== 'satellite' && this.currentBaseLayer !== 'grmap') {

      const hLat = (hike.startPoint && hike.startPoint.lat) || hike.lat || (hike.points && hike.points[0] && hike.points[0].lat);

      const hLon = (hike.startPoint && hike.startPoint.lon) || hike.lon || (hike.points && hike.points[0] && hike.points[0].lon);

      if (hLat != null && hLon != null) {

        const recLayer = this.getCountryForCoords(hLat, hLon);

        if (recLayer && recLayer !== this.currentBaseLayer) {

          this.setBaseLayer(recLayer);

        }

      }

    }



    this.selectedHike = hike;

    this.displayTrack(hike, true);



    // 1. Nettoyage de l'ancien calque de sélection

    if (this.selectionHaloLayer) {

      this.selectionHaloLayer.clearLayers();

    }



    // 2. Re-render markers so the selected one has highlighted pin styling

    this.renderHikeMarkers(this.currentHikesList);



    // 3. Centrage fluide sur le tracé ou le point de départ de la randonnée

    if (fitBounds && hike) {

      this._isProgrammaticZoom = true;

      let b = hike.bounds;

      if (!b && hike.points && hike.points.length > 0) {

        b = L.latLngBounds(hike.points.map(p => [p.lat, p.lon]));

      }

      if (b && typeof b.isValid === 'function' && b.isValid()) {

        this.map.fitBounds(b, { padding: [50, 50], maxZoom: 15, animate: true, duration: 0.3 });

      } else if (hike.startPoint) {

        this.map.setView([hike.startPoint.lat, hike.startPoint.lon], 13);

      }

    }



    if (triggerCallback && this.onHikeSelectCallback) {

      this.onHikeSelectCallback(hike);

    }

  }



  deselectHike() {

    this.selectedHike = null;

    this.clearTrack();

    this.clearCursorPosition();

    if (this.selectionHaloLayer) {

      this.selectionHaloLayer.clearLayers();

    }

    this.renderHikeMarkers(this.currentHikesList);

  }



  setCursorPosition(point) {

    if (!this.map || !point) return;



    if (!this.cursorMarker) {

      this.cursorMarker = L.circleMarker([point.lat, point.lon], {

        radius: 6,

        fillColor: '#dc2626',

        color: '#ffffff',

        weight: 2,

        fillOpacity: 1,

        zIndexOffset: 2000

      }).addTo(this.map);

    } else {

      this.cursorMarker.setLatLng([point.lat, point.lon]);

    }

  }



  clearCursorPosition() {

    if (this.cursorMarker) {

      this.cursorMarker.remove();

      this.cursorMarker = null;

    }

  }



  // =========================================================================

  // CARROYAGE UTM & OUTILS CARTOGRAPHIQUES (TOP 25)

  // =========================================================================



  /**

   * Conversion WGS84 (Lat, Lon) vers UTM (Zone, Band, Easting, Northing)

   * Précision sub-millimétrique basée sur l'ellipsoïde WGS84 standard IGN/OTAN

   */

  static latLonToUtm(lat, lon) {

    const a = 6378137.0;

    const f = 1 / 298.257223563;

    const b = a * (1 - f);

    const e2 = (a * a - b * b) / (a * a);

    const e_prime2 = (a * a - b * b) / (b * b);

    const k0 = 0.9996;



    let zone = Math.floor((lon + 180) / 6) + 1;

    if (lat >= 56.0 && lat < 64.0 && lon >= 3.0 && lon < 12.0) zone = 32;



    const lon0 = (zone - 1) * 6 - 180 + 3;

    const lon0_rad = (lon0 * Math.PI) / 180;

    const lat_rad = (lat * Math.PI) / 180;

    const lon_rad = (lon * Math.PI) / 180;



    const N = a / Math.sqrt(1 - e2 * Math.sin(lat_rad) * Math.sin(lat_rad));

    const T = Math.tan(lat_rad) * Math.tan(lat_rad);

    const C = e_prime2 * Math.cos(lat_rad) * Math.cos(lat_rad);

    const A = (lon_rad - lon0_rad) * Math.cos(lat_rad);



    const M = a * (

      (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * Math.pow(e2, 3) / 256) * lat_rad

      - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(2 * lat_rad)

      + (15 * e2 * e2 / 256 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(4 * lat_rad)

      - (35 * Math.pow(e2, 3) / 3072) * Math.sin(6 * lat_rad)

    );



    const easting = k0 * N * (

      A + (1 - T + C) * Math.pow(A, 3) / 6

      + (5 - 18 * T + T * T + 72 * C - 58 * e_prime2) * Math.pow(A, 5) / 120

    ) + 500000.0;



    let northing = k0 * (

      M + N * Math.tan(lat_rad) * (

        (A * A) / 2

        + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24

        + (61 - 58 * T + T * T + 600 * C - 330 * e_prime2) * Math.pow(A, 6) / 720

      )

    );



    if (lat < 0) {

      northing += 10000000.0;

    }



    const bands = 'CDEFGHJKLMNPQRSTUVWX';

    let band = 'N';

    if (lat >= -80 && lat <= 84) {

      const idx = Math.floor((lat + 80) / 8);

      band = bands[Math.min(idx, bands.length - 1)];

    }



    return {

      zone,

      band,

      easting: Math.round(easting),

      northing: Math.round(northing),

      formatted: `${zone}${band} ${Math.round(easting)} E  ${Math.round(northing)} N`

    };

  }



  /**

   * Conversion Inverse UTM vers WGS84 (Lat, Lon)

   */

  static utmToLatLon(easting, northing, zone, isNorthern = true) {

    const a = 6378137.0;

    const f = 1 / 298.257223563;

    const b = a * (1 - f);

    const e2 = (a * a - b * b) / (a * a);

    const e_prime2 = (a * a - b * b) / (b * b);

    const k0 = 0.9996;



    const x = easting - 500000.0;

    const y = isNorthern ? northing : northing - 10000000.0;

    const lon0 = (zone - 1) * 6 - 180 + 3;

    const lon0_rad = (lon0 * Math.PI) / 180;



    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

    const M = y / k0;

    const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * Math.pow(e2, 3) / 256));



    const phi1_rad = mu

      + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu)

      + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu)

      + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu);



    const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1_rad) * Math.sin(phi1_rad));

    const T1 = Math.tan(phi1_rad) * Math.tan(phi1_rad);

    const C1 = e_prime2 * Math.cos(phi1_rad) * Math.cos(phi1_rad);

    const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1_rad) * Math.sin(phi1_rad), 1.5);

    const D = x / (N1 * k0);



    const lat_rad = phi1_rad - (N1 * Math.tan(phi1_rad) / R1) * (

      (D * D) / 2

      - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e_prime2) * Math.pow(D, 4) / 24

      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * e_prime2 - 3 * C1 * C1) * Math.pow(D, 6) / 720

    );



    const lon_rad = lon0_rad + (

      D

      - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6

      + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e_prime2 + 24 * T1 * T1) * Math.pow(D, 5) / 120

    ) / Math.cos(phi1_rad);



    return {

      lat: (lat_rad * 180) / Math.PI,

      lon: (lon_rad * 180) / Math.PI

    };

  }



  /**

   * Rendu dynamique du Carroyage UTM kilométrique sur la carte

   */

  renderUtmGrid() {

    if (!this.map || !this.utmGridLayer || !this.map.hasLayer(this.utmGridLayer)) return;

    this.utmGridLayer.clearLayers();



    // Le carroyage UTM kilométrique est universel (WGS84 mondial) et actif sur tous les calques



    const zoom = this.map.getZoom();

    // Le carroyage kilométrique officiel TOP 25 (1 km x 1 km) est actif aux échelles de randonnée

    // (zoom >= 13, soit échelle 1:50 000 et 1:25 000 TOP 25).

    // Aux échelles régionales ou départementales (zoom < 13, échelle > 1:100 000), il est masqué

    // pour éviter tout quadrillage serré et illisible.

    if (zoom < 13) return;



    const step = 1000; // Strictement 1 km x 1 km officiel TOP 25



    const bounds = this.map.getBounds();

    const sw = bounds.getSouthWest();

    const ne = bounds.getNorthEast();

    const center = bounds.getCenter();



    const centerUtm = MapManager.latLonToUtm(center.lat, center.lng);

    const zone = centerUtm.zone;



    const utmSW = MapManager.latLonToUtm(sw.lat, sw.lng);

    const utmNE = MapManager.latLonToUtm(ne.lat, ne.lng);

    const utmNW = MapManager.latLonToUtm(ne.lat, sw.lng);

    const utmSE = MapManager.latLonToUtm(sw.lat, ne.lng);



    const minE = Math.min(utmSW.easting, utmNE.easting, utmNW.easting, utmSE.easting);

    const maxE = Math.max(utmSW.easting, utmNE.easting, utmNW.easting, utmSE.easting);

    const minN = Math.min(utmSW.northing, utmNE.northing, utmNW.northing, utmSE.northing);

    const maxN = Math.max(utmSW.northing, utmNE.northing, utmNW.northing, utmSE.northing);



    const startE = Math.floor(minE / step) * step;

    const endE = Math.ceil(maxE / step) * step;

    const startN = Math.floor(minN / step) * step;

    const endN = Math.ceil(maxN / step) * step;



    // Protection surcharge

    const countE = Math.round((endE - startE) / step);

    const countN = Math.round((endN - startN) / step);

    if (countE > 60 || countN > 60 || countE < 1 || countN < 1) return;



    // Marges de sécurité intérieures pour que les étiquettes restent en permanence

    // visibles dans l'écran (cadre topographique permanent façon carte IGN papier),

    // dégagées de l'en-tête (55px), du filtre haut et du HUD bas (48px)

    const size = this.map.getSize();

    const padTop = 55;

    const padBottom = 48;

    const padLeft = 28;

    const padRight = 28;



    const visTopLat = this.map.containerPointToLatLng([size.x / 2, padTop]).lat;

    const visBottomLat = this.map.containerPointToLatLng([size.x / 2, size.y - padBottom]).lat;

    const visLeftLon = this.map.containerPointToLatLng([padLeft, size.y / 2]).lng;

    const visRightLon = this.map.containerPointToLatLng([size.x - padRight, size.y / 2]).lng;



    const utmVisTop = MapManager.latLonToUtm(visTopLat, center.lng);

    const utmVisBottom = MapManager.latLonToUtm(visBottomLat, center.lng);

    const utmVisLeft = MapManager.latLonToUtm(center.lat, visLeftLon);

    const utmVisRight = MapManager.latLonToUtm(center.lat, visRightLon);



    const safeBottomN = utmVisBottom.northing;

    const safeTopN = utmVisTop.northing;

    const safeLeftE = utmVisLeft.easting;

    const safeRightE = utmVisRight.easting;



    // Lignes verticales de carroyage (Easting constant)

    const nSteps = 6;

    for (let e = startE; e <= endE; e += step) {

      const linePts = [];

      for (let s = 0; s <= nSteps; s++) {

        const currN = startN + (s / nSteps) * (endN - startN);

        const ll = MapManager.utmToLatLon(e, currN, zone, center.lat >= 0);

        linePts.push([ll.lat, ll.lon]);

      }



      // 1. Liseré sous-jacent blanc pour contraste maximal sur forêts, reliefs et rochers

      L.polyline(linePts, {

        color: '#ffffff',

        weight: 3.5,

        opacity: 0.8,

        interactive: false

      }).addTo(this.utmGridLayer);



      // 2. Ligne principale continue Bleu Cartographique TOP 25

      L.polyline(linePts, {

        color: '#0284c7', // Bleu Cyan officiel TOP 25

        weight: 1.8,

        opacity: 0.95,

        interactive: false

      }).addTo(this.utmGridLayer);



      // Étiquette kilométrique en haut et en bas (ancrées en permanence sur les bords visibles de l'écran)

      const km = Math.round(e / 1000);

      const icon = L.divIcon({

        className: 'utm-grid-label',

        html: `<span>${km}</span>`,

        iconSize: [32, 18],

        iconAnchor: [16, 9]

      });

      const ptBottom = MapManager.utmToLatLon(e, safeBottomN, zone, center.lat >= 0);

      const ptTop = MapManager.utmToLatLon(e, safeTopN, zone, center.lat >= 0);

      L.marker([ptBottom.lat, ptBottom.lon], { icon, interactive: false }).addTo(this.utmGridLayer);

      L.marker([ptTop.lat, ptTop.lon], { icon, interactive: false }).addTo(this.utmGridLayer);

    }



    // Lignes horizontales de carroyage (Northing constant)

    for (let n = startN; n <= endN; n += step) {

      const linePts = [];

      for (let s = 0; s <= nSteps; s++) {

        const currE = startE + (s / nSteps) * (endE - startE);

        const ll = MapManager.utmToLatLon(currE, n, zone, center.lat >= 0);

        linePts.push([ll.lat, ll.lon]);

      }



      // 1. Liseré sous-jacent blanc pour contraste maximal

      L.polyline(linePts, {

        color: '#ffffff',

        weight: 3.5,

        opacity: 0.8,

        interactive: false

      }).addTo(this.utmGridLayer);



      // 2. Ligne principale continue Bleu Cartographique TOP 25

      L.polyline(linePts, {

        color: '#0284c7',

        weight: 1.8,

        opacity: 0.95,

        interactive: false

      }).addTo(this.utmGridLayer);



      // Étiquette kilométrique à gauche et à droite (ancrées en permanence sur les bords visibles de l'écran)

      const km = Math.round(n / 1000);

      const icon = L.divIcon({

        className: 'utm-grid-label',

        html: `<span>${km}</span>`,

        iconSize: [42, 18],

        iconAnchor: [21, 9]

      });

      const ptLeft = MapManager.utmToLatLon(safeLeftE, n, zone, center.lat >= 0);

      const ptRight = MapManager.utmToLatLon(safeRightE, n, zone, center.lat >= 0);

      L.marker([ptLeft.lat, ptLeft.lon], { icon, interactive: false }).addTo(this.utmGridLayer);

      L.marker([ptRight.lat, ptRight.lon], { icon, interactive: false }).addTo(this.utmGridLayer);

    }

  }



  /**

   * Calcul du ratio d'échelle cartographique dynamique selon le zoom et la latitude

   */

  getNumericScaleRatio() {

    if (!this.map) return 25000;

    const center = this.map.getCenter();

    const zoom = this.map.getZoom();

    const metersPerPixel = (40075016.686 * Math.cos((center.lat * Math.PI) / 180)) / (256 * Math.pow(2, zoom));

    const cssPxPerCm = this.getScreenCssPxPerCm();

    // 1 cm sur écran = (cssPxPerCm * metersPerPixel) mètres sur le terrain -> en cm: x 100

    const scale = cssPxPerCm * metersPerPixel * 100;

    return Math.round(scale);

  }



  /**

   * Mise à jour du bandeau HUD sur la carte (Échelle dynamique & saisissable)

   */

  updateMapHud() {

    if (!this.map) return;

    this.setupScaleInputListeners();

    const scaleInput = document.getElementById('map-hud-scale-input');

    const scale = this.getNumericScaleRatio();

    if (scaleInput && document.activeElement !== scaleInput) {

      scaleInput.value = scale.toLocaleString('fr-FR');

      const calib = this.getScreenCalibration();

      const calibText = calib.isCalibrated ? ` • Écran étalonné : ${calib.name}` : '';

      if (scale >= 22000 && scale <= 28000) {

        scaleInput.title = `Échelle 1 : ${scale.toLocaleString('fr-FR')} (proche TOP 25)${calibText}. Saisissez une valeur et appuyez sur Entrée pour ajuster la carte.`;

      } else {

        scaleInput.title = `Échelle 1 : ${scale.toLocaleString('fr-FR')}${calibText}. Saisissez une valeur et appuyez sur Entrée pour ajuster la carte.`;

      }

    }



    const btnCalib = document.getElementById('btn-open-screen-calib');

    if (btnCalib) {

      const calib = this.getScreenCalibration();

      if (calib.isCalibrated) {

        btnCalib.classList.add('text-emerald-300', 'border-emerald-400', 'bg-emerald-950/70');

        btnCalib.title = `Écran étalonné : ${calib.name} (1 cm sur l'écran = vraie mesure terrain). Cliquez pour modifier.`;

      } else {

        btnCalib.classList.remove('text-emerald-300', 'border-emerald-400', 'bg-emerald-950/70');

        btnCalib.title = "Étalonner mon écran pour avoir 1 cm vrai sur la vitre (Règle physique)";

      }

    }

  }



  /**

   * Mise à jour des coordonnées GPS et UTM du curseur en direct (optimisé requestAnimationFrame)

   */

  updateCursorCoords(latlng) {

    this._pendingCursorLatLng = latlng;

    const now = performance.now();

    if (!latlng || !this._lastCursorRenderTs || (now - this._lastCursorRenderTs) >= 16) {

      this._lastCursorRenderTs = now;

      if (this._cursorRafId) {

        cancelAnimationFrame(this._cursorRafId);

        this._cursorRafId = null;

      }

      this._renderCursorCoords(latlng);

      return;

    }

    if (this._cursorRafId) return;

    this._cursorRafId = requestAnimationFrame(() => {

      this._cursorRafId = null;

      this._lastCursorRenderTs = performance.now();

      this._renderCursorCoords(this._pendingCursorLatLng);

    });

  }



  _renderCursorCoords(latlng) {

    const wgsEl = document.getElementById('map-hud-wgs84');

    const utmEl = document.getElementById('map-hud-utm');

    if (!wgsEl || !utmEl) return;



    const pt = latlng || (this.map ? this.map.getCenter() : { lat: 43.1189, lng: 5.8033 });

    const lat = pt.lat;

    const lon = pt.lng;



    const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;

    const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'O'}`;

    wgsEl.innerHTML = `<span>📍</span> <span>${latStr}, ${lonStr}</span>`;



    const utm = MapManager.latLonToUtm(lat, lon);

    utmEl.innerHTML = `<span>🌐</span> <span>${utm.zone}${utm.band} ${utm.easting} E  ${utm.northing} N</span>`;



    this._lastCoords = {

      lat,

      lon,

      latStr,

      lonStr,

      utm,

      elevation: this._currentElevation

    };



    // Actualisation altimétrique temporisée (uniquement en France métropolitaine et DOM)
    if (!this.isInsideFrance(lat, lon)) {
      if (this._elevationDebounceTimer) {
        clearTimeout(this._elevationDebounceTimer);
        this._elevationDebounceTimer = null;
      }
      if (this._elevationAbortCtrl) {
        this._elevationAbortCtrl.abort();
        this._elevationAbortCtrl = null;
      }
      this._applyElevationResult(null);
    } else {
      this.scheduleElevationFetch(lat, lon);
    }



    // N'afficher la commune française que lorsque le curseur (ou la zone) est en France

    if (!this.isInsideFrance(lat, lon)) {

      if (this._cityTimeout) {

        clearTimeout(this._cityTimeout);

        this._cityTimeout = null;

      }

      if (this._cityAbortCtrl) {

        this._cityAbortCtrl.abort();

        this._cityAbortCtrl = null;

      }

      this._applyCityResult('');

    } else {

      this.scheduleCityFetch(lat, lon);

    }

  }



  /**

   * Copie dans le presse-papier des coordonnées actuelles

   */

  copyCurrentCoordsToClipboard() {

    const c = this._lastCoords;

    if (!c) return;

    const altText = (c.elevation !== null && c.elevation !== undefined) ? ` • Alt. ${c.elevation} m` : '';

    const cityText = this.currentCity ? ` • ${this.currentCity}` : '';

    const text = `GPS WGS84 : ${c.lat.toFixed(5)}°, ${c.lon.toFixed(5)}° (${c.latStr}, ${c.lonStr}${altText}) | Carroyage UTM : ${c.utm.zone}${c.utm.band} ${c.utm.easting} m E, ${c.utm.northing} m N`;

    if (navigator.clipboard && navigator.clipboard.writeText) {

      navigator.clipboard.writeText(text).then(() => {

        if (window.App && window.App.showToast) {

          window.App.showToast(`📋 Coordonnées copiées : ${c.latStr}, ${c.lonStr} (UTM ${c.utm.zone}${c.utm.band} ${c.utm.easting}E ${c.utm.northing}N)`, "success");

        }

      }).catch(() => {

        prompt("Coordonnées GPS & UTM :", text);

      });

    } else {

      prompt("Coordonnées GPS & UTM :", text);

    }

  }

  // =========================================================================

  // SAISIE DE L'ÉCHELLE NUMÉRIQUE

  // =========================================================================



  /**

   * Configuration de la saisie manuelle de l'échelle dans le HUD

   */

  setupScaleInputListeners() {

    const scaleInput = document.getElementById('map-hud-scale-input');

    if (!scaleInput || scaleInput._hasScaleListeners) return;

    scaleInput._hasScaleListeners = true;



    scaleInput.addEventListener('focus', () => {

      setTimeout(() => {

        try { scaleInput.select(); } catch (_) {}

      }, 50);

    });



    scaleInput.addEventListener('keydown', (e) => {

      if (e.key === 'Enter') {

        e.preventDefault();

        this.applyScaleFromInput();

        scaleInput.blur();

      } else if (e.key === 'Escape') {

        scaleInput.blur();

        this.updateMapHud();

      }

    });



    scaleInput.addEventListener('blur', () => {

      this.applyScaleFromInput();

    });

  }



  /**

   * Applique l'échelle saisie par l'utilisateur (seule la valeur après 1 : est attendue)

   */

  applyScaleFromInput() {

    const scaleInput = document.getElementById('map-hud-scale-input');

    if (!scaleInput || !this.map) return;

    let raw = (scaleInput.value || '').trim();

    if (raw.includes(':')) {

      raw = raw.split(':')[1];

    }

    const cleaned = raw.replace(/\s+/g, '').replace(/\./g, '').replace(/,/g, '');

    const val = parseInt(cleaned, 10);

    if (isNaN(val) || val < 500 || val > 50000000) {

      this.updateMapHud();

      return;

    }

    this.setScaleRatio(val);

  }



  /**

   * Ajuste le niveau de zoom de la carte pour correspondre exactement à l'échelle numérique 1 : targetScale

   * @param {number} targetScale - Ex: 25000 pour 1:25 000

   */

  setScaleRatio(targetScale) {

    if (!this.map || !targetScale || targetScale <= 0) return;

    const center = this.map.getCenter();

    const lat = center.lat;

    // Formule inverse exacte tenant compte du profil d'écran étalonné (cssPxPerCm)

    const cssPxPerCm = this.getScreenCssPxPerCm();

    const K = (40075016.686 * Math.cos((lat * Math.PI) / 180) * cssPxPerCm * 100) / 256;

    const targetZoom = Math.log2(K / targetScale);



    const minZoom = this.map.getMinZoom() || 1;

    const maxZoom = this.map.getMaxZoom() || 19;

    const clampedZoom = Math.max(minZoom, Math.min(maxZoom, targetZoom));



    this._isProgrammaticZoom = true;

    this.map.setZoom(clampedZoom, { animate: false });

    this.updateMapHud();



    if (window.App && typeof window.App.showToast === 'function') {

      window.App.showToast(`🔍 Échelle ajustée à 1 : ${Math.round(targetScale).toLocaleString('fr-FR')}`, "info");

    }

  }



  // =========================================================================

  // OUTIL MESURE DE CAP (AZIMUT) ENTRE 2 POINTS

  // =========================================================================



  /**

   * Active le mode de mesure de cap entre 2 points

   */

  startBearingMeasurement() {

    if (!this.map) return;



    // Désactiver les autres modes exclusifs

    if (this.measurePathActive) {

      this.cancelMeasurePath();

    }

    if (this.areaSelectionActive) {

      this.cancelAreaSelection();

    }

    if (this.clickModeActive) {

      this.setClickMode(false);

    }



    this.bearingMeasurementActive = true;

    if (!this.bearingMeasurements) {

      this.bearingMeasurements = [];

    }

    this.bearingPointA = null;

    this.bearingPointB = null;



    // Désactiver le zoom au double-clic

    if (this.map.doubleClickZoom) {

      this.map.doubleClickZoom.disable();

    }

    if (this.map.getPane('markerPane')) this.map.getPane('markerPane').style.pointerEvents = 'none';

    if (this.map.getPane('overlayPane')) this.map.getPane('overlayPane').style.pointerEvents = 'none';



    // Curseur réticule

    L.DomUtil.addClass(this.map.getContainer(), 'bearing-selection-cursor');



    // Calque dédié pour les lignes et marqueurs

    if (!this.bearingLayer) {

      this.bearingLayer = L.layerGroup().addTo(this.map);

    }

    this.bearingPreviewLine = null;



    // Afficher le panneau flottant

    const panel = document.getElementById('map-bearing-panel');

    const btn = document.getElementById('btn-map-bearing');

    const btnText = document.getElementById('btn-map-bearing-text');



    if (panel) panel.classList.remove('hidden');

    if (btn) {

      btn.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-400');

    }

    if (btnText) btnText.textContent = `Cap (${this.bearingMeasurements.length}/3)`;



    this.updateBearingInstructionText();

    this.renderBearingListUI();



    // Suivi de la souris pour la ligne en temps réel

    if (this._onBearingMouseMove) {

      this.map.off('mousemove', this._onBearingMouseMove);

    }

    this._onBearingMouseMove = (e) => {

      if (!this.bearingMeasurementActive || !this.bearingPointA || this.bearingPointB) return;

      if (this.bearingMeasurements.length >= 3) return;



      const currentPoint = e.latlng;

      const colors = ['#059669', '#2563eb', '#dc2626'];

      const curColor = colors[this.bearingMeasurements.length] || '#059669';



      if (!this.bearingPreviewLine) {

        this.bearingPreviewLine = L.polyline([this.bearingPointA, currentPoint], {

          color: curColor,

          weight: 3,

          dashArray: '6, 6',

          opacity: 0.85

        }).addTo(this.bearingLayer);

      } else {

        this.bearingPreviewLine.setLatLngs([this.bearingPointA, currentPoint]);

      }



      this.updateBearingDisplay(this.bearingPointA, currentPoint, true);

    };

    this.map.on('mousemove', this._onBearingMouseMove);



    // Échap pour annuler la mesure en cours

    if (this._onBearingKeyDown) {

      window.removeEventListener('keydown', this._onBearingKeyDown);

    }

    this._onBearingKeyDown = (e) => {

      if (e.key === 'Escape') {

        if (this.bearingPointA) {

          // Annuler le point A en cours

          if (this.currentPendingMarkerA) {

            this.bearingLayer.removeLayer(this.currentPendingMarkerA);

            this.currentPendingMarkerA = null;

          }

          if (this.bearingPreviewLine) {

            this.bearingLayer.removeLayer(this.bearingPreviewLine);

            this.bearingPreviewLine = null;

          }

          this.bearingPointA = null;

          this.updateBearingInstructionText();

        } else {

          this.cancelBearingMeasurement();

        }

      }

    };

    window.addEventListener('keydown', this._onBearingKeyDown);

  }



  updateBearingInstructionText() {

    const instrText = document.getElementById('map-bearing-instruction-text');

    const liveTitle = document.getElementById('map-bearing-live-title');

    const restartBtn = document.getElementById('btn-restart-map-bearing');

    const restartBtnText = document.getElementById('btn-restart-map-bearing-text');

    const btnText = document.getElementById('btn-map-bearing-text');



    const count = (this.bearingMeasurements && this.bearingMeasurements.length) || 0;

    if (btnText) btnText.textContent = count > 0 ? `Cap (${count}/3)` : 'Cap (actif)';



    if (count >= 3) {

      if (instrText) instrText.textContent = '✅ Maximum de 3 caps atteint. Tous sont visibles sur la carte.';

      if (liveTitle) liveTitle.textContent = '3/3 caps enregistrés';

      if (restartBtn) {

        restartBtn.disabled = true;

        restartBtn.classList.add('opacity-50', 'cursor-not-allowed');

      }

      if (restartBtnText) restartBtnText.textContent = '3/3 caps mesurés';

      return;

    }



    if (restartBtn) {

      restartBtn.disabled = false;

      restartBtn.classList.remove('opacity-50', 'cursor-not-allowed');

    }

    if (restartBtnText) restartBtnText.textContent = `Cap suivant (${count + 1}/3)`;



    const capNum = count + 1;

    if (liveTitle) liveTitle.textContent = `Cap ${capNum} en cours`;



    if (!this.bearingPointA) {

      if (instrText) instrText.textContent = `Cap ${capNum}/3 : Cliquez sur la carte pour poser A${capNum} (départ).`;

    } else {

      if (instrText) instrText.textContent = `Cap ${capNum}/3 : Déplacez le curseur et cliquez pour poser B${capNum} (arrivée).`;

    }

  }



  cancelBearingMeasurement() {

    this.bearingMeasurementActive = false;

    this.bearingPointA = null;

    this.bearingPointB = null;



    if (this.map) {

      if (this.map.doubleClickZoom) {

        this.map.doubleClickZoom.enable();

      }

      if (this.map.getPane('markerPane')) this.map.getPane('markerPane').style.pointerEvents = '';

      if (this.map.getPane('overlayPane')) this.map.getPane('overlayPane').style.pointerEvents = '';

      L.DomUtil.removeClass(this.map.getContainer(), 'bearing-selection-cursor');

      if (this._onBearingMouseMove) {

        this.map.off('mousemove', this._onBearingMouseMove);

        this._onBearingMouseMove = null;

      }

    }



    if (this._onBearingKeyDown) {

      window.removeEventListener('keydown', this._onBearingKeyDown);

      this._onBearingKeyDown = null;

    }



    if (this.bearingPreviewLine && this.bearingLayer) {

      this.bearingLayer.removeLayer(this.bearingPreviewLine);

      this.bearingPreviewLine = null;

    }

    if (this.currentPendingMarkerA && this.bearingLayer) {

      this.bearingLayer.removeLayer(this.currentPendingMarkerA);

      this.currentPendingMarkerA = null;

    }



    const panel = document.getElementById('map-bearing-panel');

    const btn = document.getElementById('btn-map-bearing');

    const btnText = document.getElementById('btn-map-bearing-text');

    if (panel) panel.classList.add('hidden');

    if (btn) {

      btn.classList.remove('bg-emerald-50', 'text-emerald-700', 'border-emerald-400');

    }

    if (btnText) btnText.textContent = 'Cap';

  }



  clearBearingVisuals() {

    if (this.bearingLayer) {

      this.bearingLayer.clearLayers();

    }

    this.bearingPreviewLine = null;

    this.currentPendingMarkerA = null;

    this.bearingPointA = null;

    this.bearingPointB = null;

    this.bearingMeasurements = [];



    const valEl = document.getElementById('map-bearing-val');

    const compassEl = document.getElementById('map-bearing-compass');

    const revEl = document.getElementById('map-bearing-reverse');

    const distEl = document.getElementById('map-bearing-distance');

    const arrowEl = document.getElementById('map-bearing-arrow');



    if (valEl) valEl.textContent = '--°';

    if (compassEl) compassEl.textContent = '';

    if (revEl) revEl.textContent = '--°';

    if (distEl) distEl.textContent = '-- km';

    if (arrowEl) arrowEl.style.transform = 'rotate(0deg)';



    this.updateBearingInstructionText();

    this.renderBearingListUI();



    if (this.bearingMeasurementActive && this.map) {

      L.DomUtil.addClass(this.map.getContainer(), 'bearing-selection-cursor');

    }

  }



  removeSingleBearing(capNum) {

    if (!this.bearingMeasurements) return;

    const idx = this.bearingMeasurements.findIndex(c => c.num === capNum);

    if (idx === -1) return;



    const removed = this.bearingMeasurements.splice(idx, 1)[0];

    if (removed && removed.layers && this.bearingLayer) {

      removed.layers.forEach(l => {

        try { this.bearingLayer.removeLayer(l); } catch (e) {}

      });

    }



    this.updateBearingInstructionText();

    this.renderBearingListUI();

  }



  toggleMinimizeBearing(minimized) {

    this.isBearingMinimized = !!minimized;

    const panel = document.getElementById('map-bearing-panel');

    const fullContent = document.getElementById('map-bearing-full-content');

    const minContent = document.getElementById('map-bearing-minimized-content');

    const btnMin = document.getElementById('btn-minimize-map-bearing');

    const btnMax = document.getElementById('btn-maximize-map-bearing');



    if (!panel) return;



    if (this.isBearingMinimized) {

      if (fullContent) fullContent.classList.add('hidden');

      if (minContent) minContent.classList.remove('hidden');

      panel.classList.remove('sm:w-88', 'max-w-sm');

      panel.classList.add('sm:w-auto', 'max-w-[95vw]');

      if (btnMin) {

        btnMin.classList.add('opacity-40', 'cursor-default');

        btnMin.classList.remove('hover:bg-slate-700', 'cursor-pointer');

      }

      if (btnMax) {

        btnMax.classList.remove('opacity-40');

        btnMax.classList.add('bg-emerald-600', 'text-white', 'hover:bg-emerald-500');

      }

    } else {

      if (fullContent) fullContent.classList.remove('hidden');

      if (minContent) minContent.classList.add('hidden');

      panel.classList.add('sm:w-88', 'max-w-sm');

      panel.classList.remove('sm:w-auto', 'max-w-[95vw]');

      if (btnMin) {

        btnMin.classList.remove('opacity-40', 'cursor-default');

        btnMin.classList.add('hover:bg-slate-700', 'cursor-pointer');

      }

      if (btnMax) {

        btnMax.classList.remove('bg-emerald-600', 'text-white', 'hover:bg-emerald-500');

        btnMax.classList.add('bg-slate-800', 'text-slate-200');

      }

    }

    this.renderBearingListUI();

  }



  renderBearingListUI() {

    const listEl = document.getElementById('map-bearing-list');

    const minBadgesEl = document.getElementById('map-bearing-min-badges');

    const titleEl = document.getElementById('map-bearing-panel-title');

    const count = (this.bearingMeasurements && this.bearingMeasurements.length) || 0;



    if (titleEl) {

      titleEl.textContent = count > 0 ? `Caps mesurés (${count}/3)` : 'Mesure de Cap (1 à 3)';

    }



    if (minBadgesEl) {

      if (!this.bearingMeasurements || this.bearingMeasurements.length === 0) {

        minBadgesEl.innerHTML = '<span class="text-slate-400 text-[10px]">Aucun cap mesuré</span>';

      } else {

        minBadgesEl.innerHTML = this.bearingMeasurements.map(cap => `

          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold text-white shadow-xs" style="background:${cap.color}">

            <span>${cap.num}: ${cap.metrics.bearingRound}°</span>

            <span class="opacity-80">${cap.metrics.compass}</span>

          </span>

        `).join('');

      }

    }



    if (!listEl) return;



    if (!this.bearingMeasurements || this.bearingMeasurements.length === 0) {

      listEl.innerHTML = '';

      return;

    }



    let html = '';

    this.bearingMeasurements.forEach(cap => {

      html += `

        <div class="p-2 rounded-xl border flex items-center justify-between text-[11px]" style="background:rgba(15,23,42,0.8);border-color:${cap.color};box-shadow:0 2px 6px rgba(0,0,0,0.25);">

          <div class="flex items-center gap-2">

            <span class="w-5 h-5 rounded-full text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-sm" style="background:${cap.color}">${cap.num}</span>

            <div>

              <div class="font-bold text-white flex items-center gap-1.5 font-mono">

                <span>Cap : ${cap.metrics.bearingRound}°</span>

                <span class="text-xs" style="color:${cap.color}">(${cap.metrics.compass})</span>

                <span class="text-slate-400 font-sans font-normal">• ${cap.metrics.distStr}</span>

              </div>

              <div class="text-[10px] text-slate-300 font-mono">

                Retour : ${cap.metrics.reverseRound}° (${cap.metrics.reverseCompass})

              </div>

            </div>

          </div>

          <button type="button" class="w-5 h-5 rounded-md bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 flex items-center justify-center text-xs transition cursor-pointer" onclick="window.MapManagerInstance.removeSingleBearing(${cap.num});" title="Supprimer ce cap">✕</button>

        </div>

      `;

    });



    listEl.innerHTML = html;

  }



  handleBearingClick(latlng) {

    if (!this.bearingMeasurements) {

      this.bearingMeasurements = [];

    }



    if (this.bearingMeasurements.length >= 3) {

      this.updateBearingInstructionText();

      return;

    }



    const currentCapNum = this.bearingMeasurements.length + 1;

    const colors = ['#059669', '#2563eb', '#dc2626'];

    const curColor = colors[this.bearingMeasurements.length] || '#059669';



    if (!this.bearingPointA) {

      // 1er clic de ce cap : Point A

      this.bearingPointA = latlng;



      const iconA = L.divIcon({

        className: 'bearing-marker-icon',

        html: `<div class="bearing-marker-badge" style="background:${curColor};color:#ffffff;border:2px solid #ffffff;border-radius:9999px;font-weight:900;font-size:11px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.4);">A${currentCapNum}</div>`,

        iconSize: [26, 26],

        iconAnchor: [13, 13]

      });

      const markerA = L.marker(latlng, { icon: iconA, interactive: false }).addTo(this.bearingLayer);

      this.currentPendingMarkerA = markerA;



      this.updateBearingInstructionText();

    } else {

      // 2e clic : Point B

      const pointA = this.bearingPointA;

      const pointB = latlng;

      const markerA = this.currentPendingMarkerA;

      this.currentPendingMarkerA = null;



      if (this.bearingPreviewLine) {

        this.bearingLayer.removeLayer(this.bearingPreviewLine);

        this.bearingPreviewLine = null;

      }



      const iconB = L.divIcon({

        className: 'bearing-marker-icon',

        html: `<div class="bearing-marker-badge" style="background:${curColor};color:#ffffff;border:2px solid #ffffff;border-radius:9999px;font-weight:900;font-size:11px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.4);">B${currentCapNum}</div>`,

        iconSize: [26, 26],

        iconAnchor: [13, 13]

      });

      const markerB = L.marker(pointB, { icon: iconB, interactive: false }).addTo(this.bearingLayer);



      // Tracé plein A -> B avec sa couleur dédiée

      const polyline = L.polyline([pointA, pointB], {

        color: curColor,

        weight: 4,

        opacity: 0.95

      }).addTo(this.bearingLayer);



      const metrics = this.updateBearingDisplay(pointA, pointB, false);



      // Badge au milieu de la ligne

      const midLat = (pointA.lat + pointB.lat) / 2;

      const midLng = (pointA.lng + pointB.lng) / 2;

      const midIcon = L.divIcon({

        className: 'bearing-line-label',

        html: `<span style="background:rgba(15,23,42,0.92);color:#ffffff;padding:3px 8px;border-radius:8px;font-weight:800;font-size:10.5px;box-shadow:0 2px 8px rgba(0,0,0,0.4);white-space:nowrap;border:1.5px solid ${curColor};">🧭 Cap ${currentCapNum} : ${metrics.bearingRound}° (${metrics.compass}) • ${metrics.distStr}</span>`,

        iconSize: [160, 24],

        iconAnchor: [80, 12]

      });

      const badgeMarker = L.marker([midLat, midLng], { icon: midIcon, interactive: false }).addTo(this.bearingLayer);



      // Enregistrer ce cap (reste affiché sur la carte !)

      this.bearingMeasurements.push({

        num: currentCapNum,

        color: curColor,

        pointA: pointA,

        pointB: pointB,

        metrics: metrics,

        layers: [markerA, markerB, polyline, badgeMarker].filter(Boolean)

      });



      // Réinitialiser pour le cap suivant

      this.bearingPointA = null;

      this.bearingPointB = null;



      this.updateBearingInstructionText();

      this.renderBearingListUI();

    }

  }



  updateBearingDisplay(pointA, pointB, isLive) {

    const bearing = MapManager.calculateBearing(pointA.lat, pointA.lng, pointB.lat, pointB.lng);

    const reverseBearing = (bearing + 180) % 360;

    const compass = MapManager.getCompassDirection(bearing);

    const reverseCompass = MapManager.getCompassDirection(reverseBearing);

    const bearingRound = Math.round(bearing);

    const reverseRound = Math.round(reverseBearing);



    const distKm = MapManager.haversineDistance(pointA.lat, pointA.lng, pointB.lat, pointB.lng);

    const distMeters = distKm * 1000;

    const distStr = distMeters < 1000 

      ? `${Math.round(distMeters)} m` 

      : `${distKm.toFixed(2)} km`;



    const valEl = document.getElementById('map-bearing-val');

    const compassEl = document.getElementById('map-bearing-compass');

    const revEl = document.getElementById('map-bearing-reverse');

    const distEl = document.getElementById('map-bearing-distance');

    const arrowEl = document.getElementById('map-bearing-arrow');



    if (valEl) valEl.textContent = `${bearingRound}°`;

    if (compassEl) compassEl.textContent = `(${compass})`;

    if (revEl) revEl.textContent = `${reverseRound}°`;

    if (distEl) distEl.textContent = distStr;

    if (arrowEl) arrowEl.style.transform = `rotate(${bearingRound}deg)`;



    return { bearing, bearingRound, reverseBearing, reverseRound, compass, reverseCompass, distKm, distMeters, distStr };

  }



    static calculateBearing(lat1, lon1, lat2, lon2) {

    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const phi1 = (lat1 * Math.PI) / 180;

    const phi2 = (lat2 * Math.PI) / 180;



    const y = Math.sin(dLon) * Math.cos(phi2);

    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);



    let brng = (Math.atan2(y, x) * 180) / Math.PI;

    brng = (brng + 360) % 360;

    return brng;

  }



  /**

   * Rose des vents en français (16 divisions cardinales)

   */

  static getCompassDirection(deg) {

    const directions = [

      'N', 'NNE', 'NE', 'ENE',

      'E', 'ESE', 'SE', 'SSE',

      'S', 'SSO', 'SO', 'OSO',

      'O', 'ONO', 'NO', 'NNO'

    ];

    const idx = Math.round(deg / 22.5) % 16;

    return directions[idx];

  }



  /**

   * Distance haversine géodésique en km

   */

  static haversineDistance(lat1, lon1, lat2, lon2) {

    if (typeof GPXParser !== 'undefined' && GPXParser.haversineDistance) {

      return GPXParser.haversineDistance(lat1, lon1, lat2, lon2);

    }

    const R = 6371;

    const dLat = (lat2 - lat1) * Math.PI / 180;

    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +

              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *

              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;

  }





  // =========================================================================

  // METHODES D ETALONNAGE D ECRAN

  // =========================================================================



  getScreenCssPxPerCm() {

    if (window.ScreenCalibManager && window.ScreenCalibManager.activeCalib) {

      return window.ScreenCalibManager.activeCalib.cssPxPerCm || 37.795275;

    }

    return 37.795275;

  }



  getScreenCalibration() {

    if (window.ScreenCalibManager && window.ScreenCalibManager.activeCalib) {

      return window.ScreenCalibManager.activeCalib;

    }

    return { isCalibrated: false, name: 'Standard 96 DPI' };

  }



  // =========================================================================

  // GESTION ALTIMÉTRIQUE EN TEMPS RÉEL (IGN RGE ALTI® & FALLBACK)

  // =========================================================================



  /**

   * Planifie l'interrogation de l'altitude avec un debounce de 200 ms

   */

  scheduleElevationFetch(lat, lon) {
    if (!this.isInsideFrance(lat, lon)) {
      this._applyElevationResult(null);
      return;
    }
    if (this._elevationDebounceTimer) {
      clearTimeout(this._elevationDebounceTimer);
    }
    this._elevationDebounceTimer = setTimeout(() => {
      this.fetchElevation(lat, lon);
    }, 200);
  }



  /**

   * Interroge l'API altimétrique officielle IGN (ou fallback mondial)

   */

  async fetchElevation(lat, lon) {
    if (!this.isInsideFrance(lat, lon)) {
      this._applyElevationResult(null);
      return;
    }
    if (!this.isInsideFrance(lat, lon)) {
      this._applyElevationResult(null);
      return;
    }

    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;



    if (this._elevationCache.has(key)) {

      const z = this._elevationCache.get(key);

      this._applyElevationResult(z);

      return;

    }



    if (this._elevationAbortCtrl) {

      this._elevationAbortCtrl.abort();

    }

    this._elevationAbortCtrl = new AbortController();



    try {

      let z = null;



      // 1. En France métropolitaine et DOM-TOM : API RGE Alti® Géoplateforme IGN

      if (this.isInsideFrance(lat, lon)) {

        try {

          const ignUrl = `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=${lon}&lat=${lat}&resource=ign_rge_alti_wld`;

          const resp = await fetch(ignUrl, {

            signal: this._elevationAbortCtrl.signal,

            headers: { 'Accept': 'application/json' }

          });

          if (resp.ok) {

            const data = await resp.json();

            if (data && data.elevations && data.elevations.length > 0 && typeof data.elevations[0].z === 'number') {

              const rawZ = data.elevations[0].z;

              if (rawZ > -9999) {

                z = Math.round(rawZ);

              }

            }

          }

        } catch (ignErr) {

          if (ignErr.name === 'AbortError') return;

        }

      }



      if (z !== null) {

        if (this._elevationCache.size > 600) {

          const firstKey = this._elevationCache.keys().next().value;

          this._elevationCache.delete(firstKey);

        }

        this._elevationCache.set(key, z);

        this._applyElevationResult(z);

      }

    } catch (_) {}

  }



  _applyElevationResult(z) {
    this._currentElevation = z;
    const altiValEl = document.getElementById('map-hud-elevation-val');
    const altiBadge = document.getElementById('map-hud-elevation');
    if (z === null || z === undefined) {
      if (altiValEl) altiValEl.textContent = '-- m';
      if (altiBadge) {
        altiBadge.classList.add('hidden');
        altiBadge.style.setProperty('display', 'none', 'important');
      }
    } else {
      if (altiValEl) altiValEl.textContent = `${z} m`;
      if (altiBadge) {
        altiBadge.classList.remove('hidden');
        altiBadge.style.removeProperty('display');
      }
    }
    if (this._lastCoords) {
      this._lastCoords.elevation = z;
    }
  }



  // ========================================================================

  // MESURE D'ITINÉRAIRE PAR CLICS SUCCESSIFS

  // ========================================================================



  /**

   * Active ou désactive le mode mesure de trajet

   */

  toggleMeasurePath() {

    if (this._lastMeasureToggle && Date.now() - this._lastMeasureToggle < 250) return;

    this._lastMeasureToggle = Date.now();

    if (this.measurePathActive) {

      this.cancelMeasurePath();

    } else {

      this.startMeasurePath();

    }

  }



  /**

   * Démarre la mesure d'itinéraire

   */

  startMeasurePath() {

    if (!this.map) return;



    if (this.bearingMeasurementActive) {

      this.cancelBearingMeasurement();

    }

    if (this.areaSelectionActive) {

      this.cancelAreaSelection();

    }

    if (this.clickModeActive) {

      this.setClickMode(false);

    }



    this.measurePathActive = true;

    this.measurePoints = [];

    this.measureMarkers = [];

    this.measureTotalDistance = 0;



    this.map.doubleClickZoom.disable();

    if (this.map.getPane('markerPane')) this.map.getPane('markerPane').style.pointerEvents = 'none';

    if (this.map.getPane('overlayPane')) this.map.getPane('overlayPane').style.pointerEvents = 'none';

    L.DomUtil.addClass(this.map.getContainer(), 'measure-selection-cursor');



    if (!this.measureLayer) {

      this.measureLayer = L.layerGroup().addTo(this.map);

    }

    this.measureLayer.clearLayers();

    this.measurePolyline = null;

    this.measurePreviewLine = null;



    const panel = document.getElementById('map-measure-panel');

    const btn = document.getElementById('btn-map-measure');

    const btnText = document.getElementById('btn-map-measure-text');

    const instrText = document.getElementById('map-measure-instruction-text');

    const totalDistEl = document.getElementById('map-measure-total-dist');

    const countEl = document.getElementById('map-measure-points-count');

    const lastSegEl = document.getElementById('map-measure-last-seg');

    const lastBearingEl = document.getElementById('map-measure-last-bearing');



    if (panel) panel.classList.remove('hidden');

    if (btn) {

      btn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-400');

      btn.classList.remove('bg-white/95', 'text-slate-800');

    }

    if (btnText) btnText.textContent = 'En mesure...';

    if (instrText) instrText.textContent = 'Cliquez sur la carte pour poser le 1er point.';

    if (totalDistEl) totalDistEl.textContent = '0.00 km';

    if (countEl) countEl.textContent = '0';

    if (lastSegEl) lastSegEl.textContent = '-- m';

    if (lastBearingEl) lastBearingEl.textContent = '--°';



    this._onMeasureMouseMove = (e) => {

      if (!this.measurePathActive || this.measurePoints.length === 0) return;

      const lastPoint = this.measurePoints[this.measurePoints.length - 1];

      const previewPoints = [lastPoint, e.latlng];



      if (!this.measurePreviewLine) {

        this.measurePreviewLine = L.polyline(previewPoints, {

          color: '#818cf8',

          weight: 3,

          dashArray: '5, 6',

          opacity: 0.85,

          interactive: false,

          className: 'measure-preview-line pointer-events-none'

        }).addTo(this.measureLayer);

      } else {

        this.measurePreviewLine.setLatLngs(previewPoints);

      }



      // Preview distance dynamique en direct

      const segDist = lastPoint.distanceTo(e.latlng);

      const liveTotal = this.measureTotalDistance + segDist;

      if (totalDistEl) {

        totalDistEl.textContent = liveTotal >= 1000 

          ? (liveTotal / 1000).toFixed(2) + ' km' 

          : Math.round(liveTotal) + ' m';

      }

    };

    this.map.on('mousemove', this._onMeasureMouseMove);

  }



  /**

   * Traite un clic sur la carte pendant la mesure

   */

  handleMeasureClick(latlng) {

    if (!this.measurePathActive) return;



    this.measurePoints.push(latlng);

    const idx = this.measurePoints.length;



    // Marqueur numéroté

    const isStart = (idx === 1);

    const icon = L.divIcon({

      className: 'measure-marker-icon',

      html: `<div class="measure-marker-badge ${isStart ? 'marker-start' : ''}">${idx}</div>`,

      iconSize: [24, 24],

      iconAnchor: [12, 12]

    });

    const marker = L.marker(latlng, { icon: icon, interactive: false }).addTo(this.measureLayer);

    this.measureMarkers.push(marker);



    // Calculs de distance

    let lastSegDist = 0;

    let lastBearing = null;

    if (idx > 1) {

      const prev = this.measurePoints[idx - 2];

      lastSegDist = prev.distanceTo(latlng);

      this.measureTotalDistance += lastSegDist;

      const deg = MapManager.calculateBearing(prev.lat, prev.lng, latlng.lat, latlng.lng);

      lastBearing = { azimuthDeg: Math.round(deg), compass: MapManager.getCompassDirection(deg) };

    } else {

      this.measureTotalDistance = 0;

    }



    // Mise à jour du tracé polyline

    if (!this.measurePolyline) {

      this.measurePolyline = L.polyline(this.measurePoints, {

        color: '#6366f1',

        weight: 4,

        opacity: 0.95,

        lineCap: 'round',

        lineJoin: 'round',

        interactive: false

      }).addTo(this.measureLayer);

    } else {

      this.measurePolyline.setLatLngs(this.measurePoints);

    }



    // Mise à jour de l'interface

    const instrText = document.getElementById('map-measure-instruction-text');

    const totalDistEl = document.getElementById('map-measure-total-dist');

    const countEl = document.getElementById('map-measure-points-count');

    const lastSegEl = document.getElementById('map-measure-last-seg');

    const lastBearingEl = document.getElementById('map-measure-last-bearing');



    if (instrText) {

      instrText.textContent = `Point ${idx} posé. Cliquez pour continuer ou double-cliquez pour terminer.`;

    }

    if (totalDistEl) {

      totalDistEl.textContent = this.measureTotalDistance >= 1000 

        ? (this.measureTotalDistance / 1000).toFixed(2) + ' km' 

        : Math.round(this.measureTotalDistance) + ' m';

    }

    if (countEl) countEl.textContent = idx.toString();

    if (lastSegEl) {

      lastSegEl.textContent = idx > 1 

        ? (lastSegDist >= 1000 ? (lastSegDist / 1000).toFixed(2) + ' km' : Math.round(lastSegDist) + ' m')

        : '-- m';

    }

    if (lastBearingEl && lastBearing !== null) {

      lastBearingEl.textContent = `${lastBearing.azimuthDeg}° (${lastBearing.compass})`;

    }

  }



  /**

   * Annule le dernier point posé

   */

  undoLastMeasurePoint() {

    if (!this.measurePathActive || this.measurePoints.length === 0) return;



    this.measurePoints.pop();

    const lastMarker = this.measureMarkers.pop();

    if (lastMarker && this.measureLayer) {

      this.measureLayer.removeLayer(lastMarker);

    }



    // Recalcul de la distance totale

    this.measureTotalDistance = 0;

    for (let i = 1; i < this.measurePoints.length; i++) {

      this.measureTotalDistance += this.measurePoints[i - 1].distanceTo(this.measurePoints[i]);

    }



    if (this.measurePolyline) {

      this.measurePolyline.setLatLngs(this.measurePoints);

    }



    const idx = this.measurePoints.length;

    const countEl = document.getElementById('map-measure-points-count');

    const totalDistEl = document.getElementById('map-measure-total-dist');

    const instrText = document.getElementById('map-measure-instruction-text');

    const lastSegEl = document.getElementById('map-measure-last-seg');

    const lastBearingEl = document.getElementById('map-measure-last-bearing');



    if (countEl) countEl.textContent = idx.toString();

    if (totalDistEl) {

      totalDistEl.textContent = this.measureTotalDistance >= 1000 

        ? (this.measureTotalDistance / 1000).toFixed(2) + ' km' 

        : Math.round(this.measureTotalDistance) + ' m';

    }

    if (instrText) {

      instrText.textContent = idx === 0 

        ? 'Cliquez sur la carte pour poser le 1er point.'

        : `Point ${idx} actif. Cliquez pour continuer.`;

    }

    if (lastSegEl) {

      if (idx > 1) {

        const seg = this.measurePoints[idx - 2].distanceTo(this.measurePoints[idx - 1]);

        lastSegEl.textContent = seg >= 1000 ? (seg / 1000).toFixed(2) + ' km' : Math.round(seg) + ' m';

      } else {

        lastSegEl.textContent = '-- m';

      }

    }

    if (lastBearingEl) {

      if (idx > 1) {

        const pA = this.measurePoints[idx - 2];

        const pB = this.measurePoints[idx - 1];

        const deg = MapManager.calculateBearing(pA.lat, pA.lng, pB.lat, pB.lng);

        lastBearingEl.textContent = `${Math.round(deg)}° (${MapManager.getCompassDirection(deg)})`;

      } else {

        lastBearingEl.textContent = '--°';

      }

    }

  }



  /**

   * Efface le tracé en cours pour recommencer à zéro

   */

  resetMeasurePath() {

    this.measurePoints = [];

    this.measureMarkers = [];

    this.measureTotalDistance = 0;

    if (this.measureLayer) {

      this.measureLayer.clearLayers();

    }

    this.measurePolyline = null;

    this.measurePreviewLine = null;



    const totalDistEl = document.getElementById('map-measure-total-dist');

    const countEl = document.getElementById('map-measure-points-count');

    const lastSegEl = document.getElementById('map-measure-last-seg');

    const lastBearingEl = document.getElementById('map-measure-last-bearing');

    const instrText = document.getElementById('map-measure-instruction-text');



    if (totalDistEl) totalDistEl.textContent = '0.00 km';

    if (countEl) countEl.textContent = '0';

    if (lastSegEl) lastSegEl.textContent = '-- m';

    if (lastBearingEl) lastBearingEl.textContent = '--°';

    if (instrText) instrText.textContent = 'Tracé effacé. Cliquez pour poser le 1er point.';

  }



  /**

   * Fige le tracé terminé

   */

  finishMeasurePath() {

    if (this.measurePreviewLine && this.measureLayer) {

      this.measureLayer.removeLayer(this.measurePreviewLine);

      this.measurePreviewLine = null;

    }

    if (this._onMeasureMouseMove && this.map) {

      this.map.off('mousemove', this._onMeasureMouseMove);

      this._onMeasureMouseMove = null;

    }

    if (this.map) {

      this.map.doubleClickZoom.enable();

      if (this.map.getPane('markerPane')) this.map.getPane('markerPane').style.pointerEvents = 'auto';

      if (this.map.getPane('overlayPane')) this.map.getPane('overlayPane').style.pointerEvents = 'auto';

      L.DomUtil.removeClass(this.map.getContainer(), 'measure-selection-cursor');

    }



    const instrText = document.getElementById('map-measure-instruction-text');

    const totalDistEl = document.getElementById('map-measure-total-dist');

    if (instrText) {

      instrText.textContent = `✔ Tracé terminé (${this.measurePoints.length} points).`;

    }

    if (totalDistEl) {

      totalDistEl.textContent = this.measureTotalDistance >= 1000 

        ? (this.measureTotalDistance / 1000).toFixed(2) + ' km' 

        : Math.round(this.measureTotalDistance) + ' m';

    }

  }



  /**

   * Annule et ferme le mode mesure

   */

  cancelMeasurePath() {

    this.finishMeasurePath();

    this.measurePathActive = false;

    this.isHudMinimized = false;

    this.measurePoints = [];

    this.measureMarkers = [];

    this.measureTotalDistance = 0;



    if (this.measureLayer) {

      this.measureLayer.clearLayers();

    }

    this.measurePolyline = null;

    this.measurePreviewLine = null;



    if (this.map) {

      this.map.doubleClickZoom.enable();

      if (this.map.getPane('markerPane')) this.map.getPane('markerPane').style.pointerEvents = 'auto';

      if (this.map.getPane('overlayPane')) this.map.getPane('overlayPane').style.pointerEvents = 'auto';

      L.DomUtil.removeClass(this.map.getContainer(), 'measure-selection-cursor');

    }



    const panel = document.getElementById('map-measure-panel');

    const btn = document.getElementById('btn-map-measure');

    const btnText = document.getElementById('btn-map-measure-text');

    if (panel) panel.classList.add('hidden');

    if (btn) {

      btn.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-400');

      btn.classList.add('bg-white/95', 'text-slate-800');

    }

    if (btnText) btnText.textContent = 'Mesurer';

  }



  /**

   * Bascule l'affichage des limites de la carte papier

   */

  togglePaperSheetBounds() {

    if (!this.map || !this.paperSheetLayer) return;

    if (this.map.hasLayer(this.paperSheetLayer)) {

      this.map.removeLayer(this.paperSheetLayer);

      localStorage.setItem('rf_show_paper_sheet_bounds', 'false');

    } else {

      this.paperSheetLayer.addTo(this.map);

      localStorage.setItem('rf_show_paper_sheet_bounds', 'true');

      this.renderPaperSheetBounds();

    }

  }



  /**

   * Planifie la mise a jour des limites des feuilles papier

   */

  schedulePaperSheetBoundsUpdate() {

    if (!this.map || !this.map.hasLayer(this.paperSheetLayer) || this.currentBaseLayer !== 'igntop25') return;

    if (this._sheetsTimeout) {

      clearTimeout(this._sheetsTimeout);

    }

    this._sheetsTimeout = setTimeout(() => {

      this.renderPaperSheetBounds();

    }, 350);

  }



  /**

   * Rendu visuel adaptatif des limites de la carte papier TOP 25 pour toute la France

   * - Fonctionne a tous les niveaux de zoom (zoom 3 a 19)

   * - Epaisseur adaptee selon le niveau de zoom

   * - Le cartouche texte est masque des lors qu il depasse la largeur de la feuille sur l ecran

   */

  renderPaperSheetBounds() {

    if (!this.map || !this.paperSheetLayer) return;

    // Le quadrillage carte IGN ne doit apparaître que lorsqu'on est en affichage IGN TOP 25

    if (this.currentBaseLayer !== 'igntop25') {

      this.paperSheetLayer.clearLayers();

      return;

    }

    if (!this.map.hasLayer(this.paperSheetLayer)) return;



    const allSheets = window.IGN_TOP25_SHEETS;

    if (!Array.isArray(allSheets) || allSheets.length === 0) {

      return;

    }



    const bounds = this.map.getBounds();

    const minLat = bounds.getSouth();

    const minLon = bounds.getWest();

    const maxLat = bounds.getNorth();

    const maxLon = bounds.getEast();



    const zoom = this.map.getZoom();



    // 1. Calcul de l'epaisseur adaptee selon le niveau de zoom

    let outerWeight, innerWeight, showInnerDashed;

    if (zoom >= 13) {

      outerWeight = 14;

      innerWeight = 2;

      showInnerDashed = true;

    } else if (zoom >= 11) {

      outerWeight = 9;

      innerWeight = 1.5;

      showInnerDashed = true;

    } else if (zoom >= 9) {

      outerWeight = 5;

      innerWeight = 1;

      showInnerDashed = true;

    } else if (zoom >= 7) {

      outerWeight = 2.5;

      innerWeight = 0;

      showInnerDashed = false;

    } else { // zoom <= 6 (France entiere)

      outerWeight = 1.2;

      innerWeight = 0;

      showInnerDashed = false;

    }



    this.paperSheetLayer.clearLayers();



    // 2. Parcourir toutes les feuilles visibles dans la zone BBOX

    for (let i = 0; i < allSheets.length; i++) {

      const s = allSheets[i];

      const sb = s.b; // [minLat, minLon, maxLat, maxLon]



      // Test d'intersection rapide

      if (sb[2] < minLat || sb[0] > maxLat || sb[3] < minLon || sb[1] > maxLon) {

        continue;

      }



      const sheetBounds = [[sb[0], sb[1]], [sb[2], sb[3]]];



      // A. Bande translucide adaptee (interactive: false pour ne jamais bloquer les clics sur la carte)

      const outerBand = L.rectangle(sheetBounds, {

        color: '#0284c7',

        weight: outerWeight,

        opacity: zoom >= 8 ? 0.35 : 0.55,

        fill: true,

        fillColor: '#0284c7',

        fillOpacity: zoom >= 10 ? 0.025 : 0.001,

        interactive: false

      });



      // B. Trait interieur en pointilles (si zoom suffisant)

      if (showInnerDashed) {

        const innerBorder = L.rectangle(sheetBounds, {

          color: '#0369a1',

          weight: innerWeight,

          opacity: 0.85,

          dashArray: '8, 6',

          fill: false,

          interactive: false

        });

        this.paperSheetLayer.addLayer(innerBorder);

      }



      // C. Verification de la largeur du cartouche texte vs largeur de la feuille sur l'ecran

      const pTopLeft = this.map.latLngToContainerPoint([sb[2], sb[1]]);

      const pTopRight = this.map.latLngToContainerPoint([sb[2], sb[3]]);

      const sheetWidthPx = Math.abs(pTopRight.x - pTopLeft.x);



      // Largeur requise estimee pour le cartouche texte (titre + numero + annee)

      const labelText = `TOP 25 ${s.t} (${s.n}) Éd. ${s.a}`;

      const labelEstimatedWidth = Math.max(160, labelText.length * 7.5 + 44);



      // REGLE STRICTE DEMANDEE : "la mention de la carte ne sera plus affichée dès lors que le cartouche texte correspondant dépasse la largeur de la carte"

      // Ne tracer le badge que si :

      // 1. Le cartouche ne depasse pas la largeur de la feuille (avec marge de securite de 20px)

      // 2. Le point d'ancrage est visible a l'ecran sans chevaucher les bordures d'ecran ni la barre d'attribution du bas

      if (labelEstimatedWidth + 20 <= sheetWidthPx) {

        const topLat = sb[2];

        const centerLon = (sb[1] + sb[3]) / 2;

        const pMarker = this.map.latLngToContainerPoint([topLat, centerLon]);

        const mapSize = this.map.getSize();



        // Evite tout depassement d'ecran ou chevauchement avec la barre basse d'attribution / HUD

        if (pMarker.y >= 20 && pMarker.y <= mapSize.y - 48 &&

            pMarker.x >= (labelEstimatedWidth / 2) && pMarker.x <= mapSize.x - (labelEstimatedWidth / 2)) {

          const labelHtml = `

            <div class="paper-sheet-badge-label" title="Feuille IGN : ${getSheetCommercialLabel(s.n, s.t)}\nÉdition papier : ${s.a}\nCliquer pour recadrer toute la feuille">

              <span class="mr-1">📄</span>

              <strong>${getSheetCommercialLabel(s.n, s.t)}</strong>

              <span class="ml-1 px-1 py-0.5 rounded bg-sky-100 text-sky-800 font-mono text-[9px] font-bold">Éd. ${s.a}</span>

            </div>

          `;



          const sheetMarker = L.marker([topLat, centerLon], {

            icon: L.divIcon({

              className: 'paper-sheet-label-container',

              html: labelHtml,

              iconSize: [labelEstimatedWidth, 26],

              iconAnchor: [labelEstimatedWidth / 2, 13]

            }),

            interactive: true

          });



          const fitSheet = () => {

            this.map.fitBounds(sheetBounds, { padding: [30, 30], maxZoom: 14 });

          };

          sheetMarker.on('click', fitSheet);

          this.paperSheetLayer.addLayer(sheetMarker);

        }

      }



      // Recadrage uniquement via le badge central si non en mode mesure

      const fitSheet = () => {

        if (this.bearingMeasurementActive || this.measurePathActive || this.areaSelectionActive) return;

        this.map.fitBounds(sheetBounds, { padding: [30, 30], maxZoom: 14 });

      };



      // Infobulle complete toujours disponible au survol meme si le badge texte est masque

      const tooltipText = `<b>Feuille IGN : ${getSheetCommercialLabel(s.n, s.t)}</b><br>Édition papier : <b>${s.a}</b><br><i>Cliquez pour recadrer toute la feuille</i>`;

      outerBand.bindTooltip(tooltipText, { sticky: true, opacity: 0.95 });



      this.paperSheetLayer.addLayer(outerBand);

    }

  }



  /**

   * Planifie la mise a jour de la date d'edition de la carte papier IGN

   */

  scheduleIgnPaperDateUpdate() {

    if (this.currentBaseLayer !== 'igntop25' || !this.map) return;

    if (this._ignSheetTimeout) {

      clearTimeout(this._ignSheetTimeout);

    }

    this._ignSheetTimeout = setTimeout(() => {

      this.updateIgnPaperDate();

    }, 350);

  }



  /**

   * Met a jour dynamiquement la date de la feuille papier dans le cartouche Leaflet

   */

  async updateIgnPaperDate() {

    if (this.currentBaseLayer !== 'igntop25' || !this.map) return;

    const center = this.map.getCenter();

    if (!center || !this.isInsideFrance(center.lat, center.lng)) return;



    const lat = center.lat;

    const lon = center.lng;



    // 1. Recherche instantanee dans les 1861 feuilles de France

    let annee = '2020';

    let titre = 'TOULON (087_088)';

    let fullTooltip = `Édition papier : ${annee}`;



    if (window.IGN_TOP25_SHEETS && Array.isArray(window.IGN_TOP25_SHEETS)) {

      const match = window.IGN_TOP25_SHEETS.find(s =>

        lat >= s.b[0] && lat <= s.b[2] && lon >= s.b[1] && lon <= s.b[3]

      );

      if (match) {

        annee = match.a;

        titre = match.t ? getSheetCommercialLabel(match.n, match.t) : match.n;

        fullTooltip = `Feuille IGN : ${titre} • Édition papier : ${annee}`;

      }

    }



    // 2. Mettre a jour immediatement le badge dans le cartouche DOM

    const badgeEl = document.getElementById('ign-paper-date-badge');

    if (badgeEl) {

      badgeEl.textContent = `Édition papier : ${annee}`;

      badgeEl.setAttribute('title', `${fullTooltip} • Cliquer pour afficher/masquer les limites papier`);

    }



    const newAttr = `&copy; IGN France - Carte TOPO 25 (SCAN 25® • <span id="ign-paper-date-badge" class="font-bold text-slate-700 hover:text-sky-600 cursor-pointer" onclick="window.MapManagerInstance && window.MapManagerInstance.togglePaperSheetBounds()" title="${fullTooltip} • Cliquer pour afficher/masquer les limites papier">Édition papier : ${annee}</span>)`;



    const top25Layer = this.baseLayers && (this.baseLayers["🇫🇷 France (IGN TOP 25 officiel)"] || this.baseLayers["IGN TOP 25 (France officiel)"] || this.baseLayers["IGN TOP 25 (Carte papier officielle)"]);

    if (top25Layer) {

      top25Layer.options.attribution = newAttr;

    }

    if (this._currentIgnAttribution !== newAttr && this.map.attributionControl) {

      this.map.attributionControl.removeAttribution(this._currentIgnAttribution);

      this.map.attributionControl.addAttribution(newAttr);

      this._currentIgnAttribution = newAttr;

    }



    // 3. Enrichir via le flux WFS en arriere-plan pour obtenir les dates precises de Scan HD et sentiers

    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;

    let info = this._ignSheetCache ? this._ignSheetCache.get(cacheKey) : null;

    if (!info) {

      info = await this.fetchIgnSheetInfo(lat, lon);

      if (info && this._ignSheetCache) {

        this._ignSheetCache.set(cacheKey, info);

      }

    }

    if (info && (info.dateScan || info.dateMajThematique)) {

      const scanYear = info.dateScan ? String(info.dateScan).slice(0, 4) : '';

      const majYear = info.dateMajThematique ? String(info.dateMajThematique).slice(0, 4) : '';

      let enrichedParts = [`Feuille IGN : ${titre}`, `Édition papier : ${annee}`];

      if (scanYear) enrichedParts.push(`Scan HD : ${scanYear}`);

      if (majYear) enrichedParts.push(`Sentiers : ${majYear}`);

      const enrichedTooltip = enrichedParts.join(' • ');

      if (badgeEl) {

        badgeEl.setAttribute('title', `${enrichedTooltip} • Cliquer pour afficher/masquer les limites papier`);

      }

    }

  }



  /**

   * Interroge l'API WFS IGN graphe_scan25 pour obtenir la date et le titre de la feuille papier

   */

  async fetchIgnSheetInfo(lat, lon) {

    try {

      const delta = 0.01;

      const url = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAME=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25.GRAPHE-MOSAIQUAGE:graphe_scan25&BBOX=${lat - delta},${lon - delta},${lat + delta},${lon + delta},urn:ogc:def:crs:EPSG::4326&OUTPUTFORMAT=application/json`;

      const resp = await fetch(url);

      if (!resp.ok) return null;

      const data = await resp.json();

      if (data && data.features && data.features.length > 0) {

        const props = data.features[0].properties;

        return {

          titre: props.titre,

          numero: props.numero,

          anneeEdition: props.annee_edition,

          dateScan: props.date_int_scan,

          dateMajThematique: props.date_int_a || props.thema_a,

          numDep: props.num_dep

        };

      }

    } catch (e) {

      console.warn('Erreur lecture feuille IGN:', e);

    }

    return null;

  }



  /**

   * Planifie la récupération du nom de la commune avec temporisation

   */

  scheduleCityFetch(lat, lon) {

    if (this._cityTimeout) {

      clearTimeout(this._cityTimeout);

      this._cityTimeout = null;

    }

    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;

    if (this._cityCache && this._cityCache.has(key)) {

      this._applyCityResult(this._cityCache.get(key));

      return;

    }

    this._cityTimeout = setTimeout(() => {

      this._cityTimeout = null;

      this.fetchCity(lat, lon);

    }, 220);

  }



  /**

   * Récupère le nom de la commune (API officielle découpage administratif geo.api.gouv.fr)

   */

  async fetchCity(lat, lon) {

    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;



    if (this._cityCache.has(key)) {

      const c = this._cityCache.get(key);

      this._applyCityResult(c);

      return;

    }



    if (this._cityAbortCtrl) {

      this._cityAbortCtrl.abort();

    }

    this._cityAbortCtrl = new AbortController();



    try {

      let cityStr = '';

      if (this.isInsideFrance(lat, lon)) {

        const url = `https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lon}&fields=nom,code,codeDepartement`;

        const resp = await fetch(url, {

          signal: this._cityAbortCtrl.signal,

          headers: { 'Accept': 'application/json' }

        });

        if (resp.ok) {

          const data = await resp.json();

          if (Array.isArray(data) && data.length > 0 && data[0].nom) {

            const item = data[0];

            cityStr = `${item.nom}${item.codeDepartement ? ` (${item.codeDepartement})` : ''}`;

          }

        }

      }



      if (this._cityCache.size > 500) {

        const firstKey = this._cityCache.keys().next().value;

        this._cityCache.delete(firstKey);

      }

      this._cityCache.set(key, cityStr);

      this._applyCityResult(cityStr);

    } catch (e) {

      if (e.name === 'AbortError') return;

      this._applyCityResult('');

    }

  }



  /**

   * Met à jour l'étiquette de la commune dans le bandeau inférieur

   */

  _applyCityResult(cityStr) {

    this.currentCity = cityStr || '';

    const cityEl = document.getElementById('map-hud-city');

    const valEl = document.getElementById('map-hud-city-val');

    if (!cityEl || !valEl) return;



    cityEl.classList.remove('sm:flex');

    if (cityStr) {

      valEl.textContent = cityStr;

      cityEl.classList.remove('hidden');

      cityEl.classList.add('flex');

      cityEl.style.display = '';

    } else {

      valEl.textContent = '';

      cityEl.classList.add('hidden');

      cityEl.classList.remove('flex');

      cityEl.style.display = 'none';

    }

  }



  /**

   * Bascule le mode mesure de cap

   */

  toggleBearingMeasurement() {

    if (this._lastBearingToggle && Date.now() - this._lastBearingToggle < 250) return;

    this._lastBearingToggle = Date.now();

    if (this.bearingMeasurementActive) {

      this.cancelBearingMeasurement();

    } else {

      this.startBearingMeasurement();

    }

  }



  /* =========================================================================

   * MODULE VISUALISEUR MULTI-TRACES GPX (JUSQU'À 3 TRACES + COULEURS AU CLIC)

   * ========================================================================= */

  displayStandaloneGpxTrack(gpxData, fileName, preferredColor = null) {

    if (!this.map || !gpxData) return;



    if (!this.standaloneTracks) {

      this.standaloneTracks = [];

    }

    // Couleurs vives et contrastées (optimisées pour fond TOP 25 et IGN)

    const DEFAULT_COLORS = ['#ff0033', '#0066ff', '#00d655']; // Rouge néon, Bleu roi électrique, Vert lime éclatant

    const PALETTE = ['#ff0033', '#0066ff', '#00d655', '#ff6a00', '#a020f0', '#00d4ff', '#0f172a'];



    // Récupérer les points GPS

    let pts = gpxData.points || [];

    if (pts.length === 0 && gpxData.tracks) {

      gpxData.tracks.forEach(track => {

        track.segments.forEach(seg => {

          seg.points.forEach(p => pts.push(p));

        });

      });

    }

    if (pts.length === 0) return;



    // Limite max : 3 traces. Si déjà 3, retirer la plus ancienne

    if (this.standaloneTracks.length >= 3) {

      const removed = this.standaloneTracks.shift();

      if (removed && removed.layer && this.map.hasLayer(removed.layer)) {

        this.map.removeLayer(removed.layer);

      }

    }



    const trackIndex = this.standaloneTracks.length;

    const assignedColor = preferredColor || DEFAULT_COLORS[trackIndex % DEFAULT_COLORS.length];



    const latlngs = pts.map(p => [p.lat, p.lon]);



    // Halo blanc sous-jacent ultra-large et opaque (14px) pour détacher nettement la trace des fonds très denses (IGN TOP 25)

    const borderPolyline = L.polyline(latlngs, {

      color: '#ffffff',

      weight: 14,

      opacity: 1.0,

      lineCap: 'round',

      lineJoin: 'round',

      offset: 0

    });



    // Tracé principal élargi (7px) en couleur néon éclatante

    const polyline = L.polyline(latlngs, {

      color: assignedColor,

      weight: 7,

      opacity: 1.0,

      lineCap: 'round',

      lineJoin: 'round',

      offset: 0

    });



    const startPt = latlngs[0];

    const endPt = latlngs[latlngs.length - 1];



    const startMarker = L.circleMarker(startPt, {

      radius: 8.5,

      fillColor: assignedColor,

      color: '#ffffff',

      weight: 3,

      fillOpacity: 1

    }).bindTooltip('<b>Départ : ' + (gpxData.name || fileName || 'Trace') + '</b>');



    const endMarker = L.circleMarker(endPt, {

      radius: 8.5,

      fillColor: '#0f172a',

      color: '#ffffff',

      weight: 3,

      fillOpacity: 1

    }).bindTooltip('<b>Arrivée : ' + (gpxData.name || fileName || 'Trace') + '</b>');



    const trackLayer = L.featureGroup([borderPolyline, polyline, startMarker, endMarker]);

    this.map.addLayer(trackLayer);



    const trackName = (gpxData.name || fileName || ('Trace ' + (trackIndex + 1))).replace(/\.gpx$/i, '');

    const distVal = (gpxData.distanceKm !== undefined) ? gpxData.distanceKm : ((gpxData.distance !== undefined) ? gpxData.distance : '0');

    const eleVal = (gpxData.elevationGain !== undefined) ? Math.round(gpxData.elevationGain) : 0;



    const trackItem = {

      id: gpxData.id || ('gpx_user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),

      name: trackName,

      distance: String(distVal),

      elevationGain: eleVal,

      ibp: (gpxData.ibp !== undefined) ? gpxData.ibp : null,

      color: assignedColor,

      points: pts,

      startPoint: gpxData.startPoint || { lat: startPt[0], lon: startPt[1] },

      endPoint: gpxData.endPoint || { lat: endPt[0], lon: endPt[1] },

      layer: trackLayer,

      borderPolyline: borderPolyline,

      polyline: polyline,

      startMarker: startMarker,

      endMarker: endMarker

    };



    // Clic direct sur la trace (trait ou halo blanc) pour changer sa couleur au vol

    const handleColorClick = (e) => {

      L.DomEvent.stopPropagation(e);

      this.cycleTrackColor(trackItem.id);

    };

    polyline.on('click', handleColorClick);

    borderPolyline.on('click', handleColorClick);



    this.standaloneTracks.push(trackItem);

    this.standaloneHike = trackItem; // dernière trace active

    this.selectedHike = trackItem;



    // Recalculer les décalages parallèles (côte à côte) sur les tronçons communs

    this.updateAllStandaloneOffsets();



    // Ajuster la vue pour englober toutes les traces affichées

    this.fitAllStandaloneTracks();



    // Afficher ou actualiser le HUD multi-traces interactif

    this.showStandaloneGpxHud();

  }



  updateAllStandaloneOffsets() {

    if (!this.standaloneTracks || this.standaloneTracks.length === 0) return;

    const total = this.standaloneTracks.length;

    // Décalage en pixels entre traces parallèles sur tronçons communs

    // 1 trace: offset 0

    // 2 traces: -3.5 px, +3.5 px (écart de 7 px)

    // 3 traces: -6 px, 0 px, +6 px (écart de 6 px)

    const step = 10; // Pas de 10px adapté au trait de 7px et halo de 14px

    this.standaloneTracks.forEach((t, idx) => {

      const offset = total <= 1 ? 0 : (idx - (total - 1) / 2) * step;

      t.offset = offset;

      if (t.borderPolyline && typeof t.borderPolyline.setOffset === 'function') {

        t.borderPolyline.setOffset(offset);

      }

      if (t.polyline && typeof t.polyline.setOffset === 'function') {

        t.polyline.setOffset(offset);

      }

    });

  }



  fitAllStandaloneTracks() {

    if (!this.standaloneTracks || this.standaloneTracks.length === 0) return;

    const allBounds = L.latLngBounds([]);

    this.standaloneTracks.forEach(t => {

      if (t.layer) allBounds.extend(t.layer.getBounds());

    });

    if (allBounds.isValid()) {

      this.map.fitBounds(allBounds, { padding: [50, 50] });

    }

  }



  setTrackColor(trackId, newColor) {

    if (!this.standaloneTracks) return;

    const track = this.standaloneTracks.find(t => t.id === trackId);

    if (!track) return;

    track.color = newColor;

    if (track.polyline) {

      track.polyline.setStyle({ color: newColor });

    }

    if (track.startMarker) {

      track.startMarker.setStyle({ fillColor: newColor });

    }

    if (track.endMarker) {

      track.endMarker.setStyle({ color: newColor });

    }

    this.showStandaloneGpxHud();

  }



  cycleTrackColor(trackId) {

    if (!this.standaloneTracks) return;

    const PALETTE = ['#ff0033', '#0066ff', '#00d655', '#ff6a00', '#a020f0', '#00d4ff', '#0f172a'];

    const track = this.standaloneTracks.find(t => t.id === trackId);

    if (!track) return;

    const curIdx = PALETTE.indexOf(track.color);

    const nextColor = PALETTE[(curIdx + 1) % PALETTE.length];

    this.setTrackColor(trackId, nextColor);

  }



  removeStandaloneTrack(trackId) {

    if (!this.standaloneTracks) return;

    const idx = this.standaloneTracks.findIndex(t => t.id === trackId);

    if (idx >= 0) {

      const removed = this.standaloneTracks.splice(idx, 1)[0];

      if (removed && removed.layer && this.map.hasLayer(removed.layer)) {

        this.map.removeLayer(removed.layer);

      }

    }

    this.updateAllStandaloneOffsets();

    if (this.standaloneTracks.length === 0) {

      this.clearStandaloneGpxTrack();

    } else {

      this.standaloneHike = this.standaloneTracks[this.standaloneTracks.length - 1];

      this.selectedHike = this.standaloneHike;

      this.showStandaloneGpxHud();

    }

  }



    toggleMinimizeHud(forceState = null) {

    if (typeof forceState === 'boolean') {

      this.isHudMinimized = forceState;

    } else {

      this.isHudMinimized = !this.isHudMinimized;

    }

    this.showStandaloneGpxHud();

  }



  showStandaloneGpxHud(ignoredParam = null) {

    if (!this.standaloneTracks || this.standaloneTracks.length === 0) {

      const hud = document.getElementById('standalone-gpx-hud');

      if (hud) hud.classList.add('hidden');

      return;

    }



    const PALETTE = ['#ff0033', '#0066ff', '#00d655', '#ff6a00', '#a020f0', '#00d4ff', '#0f172a'];

    let hud = document.getElementById('standalone-gpx-hud');

    if (!hud) {

      hud = document.createElement('div');

      hud.id = 'standalone-gpx-hud';

      hud.className = 'fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[1050] bg-slate-900/95 backdrop-blur-md border-2 border-slate-700/80 rounded-3xl px-4 sm:px-5 py-3 shadow-2xl flex flex-col gap-3 text-sm text-white max-w-[95vw] sm:max-w-2xl';

      document.body.appendChild(hud);

    }



    const count = this.standaloneTracks.length;



    // MODE RÉDUIT (Minimisé pour dégager la carte tout en gardant les traces)

    if (this.isHudMinimized) {

      hud.className = 'fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[1050] bg-slate-900/95 backdrop-blur-md border-2 border-emerald-500 rounded-2xl px-4 sm:px-5 py-2.5 shadow-2xl flex items-center justify-between gap-4 text-sm text-white max-w-[95vw]';

      hud.innerHTML = `

        <div class="flex items-center gap-3 cursor-pointer select-none" onclick="window.MapManagerInstance.toggleMinimizeHud(false)" title="Cliquer pour agrandir le cartouche">

          <span class="text-xl">📊</span>

          <span class="text-amber-400 font-black text-sm sm:text-base uppercase tracking-wider">Traces GPX (${count}/3)</span>

          <div class="flex items-center gap-2 ml-1">

            ${this.standaloneTracks.map(t => `

              <span class="w-5 h-5 rounded-full border-2 border-white shadow-md inline-block cursor-pointer hover:scale-125 transition-transform" style="background-color: ${t.color};" onclick="event.stopPropagation(); window.MapManagerInstance.cycleTrackColor('${t.id}')" title="Trace: ${t.name} (cliquez pour changer de couleur)"></span>

            `).join('')}

          </div>

          <span class="text-sm text-slate-200 font-bold hidden sm:inline ml-1">

            (${this.standaloneTracks.map(t => `${t.distance} km`).join(' • ')})

          </span>

        </div>

        <div class="flex items-center gap-2 ml-3 pl-3 border-l-2 border-slate-700">

          <button type="button" onclick="window.MapManagerInstance.toggleMinimizeHud(true)" title="Réduire (déjà réduit)" class="hud-win-btn bg-slate-800 text-slate-500 cursor-default" disabled>

            &minus;

          </button>

          <button type="button" onclick="window.MapManagerInstance.toggleMinimizeHud(false)" title="Agrandir / Afficher les détails" class="hud-win-btn bg-emerald-600 hover:bg-emerald-500 text-white shadow-md">

            &#x25A1;

          </button>

          <button type="button" onclick="window.MapManagerInstance.clearStandaloneGpxTrack()" title="Fermer et effacer les traces GPX" class="hud-win-btn bg-rose-950/80 hover:bg-rose-700 text-rose-300 hover:text-white">

            &#x2715;

          </button>

        </div>

      `;

      hud.classList.remove('hidden');

      return;

    }



    // MODE NORMAL AGRANDI (Conforme aux standards ergonomiques 16px)

    hud.className = 'fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[1050] bg-slate-900/95 backdrop-blur-md border-2 border-slate-700/90 rounded-3xl px-4 sm:px-6 py-3.5 sm:py-4 shadow-2xl flex flex-col gap-3 text-sm text-white max-w-[95vw] sm:max-w-3xl';



    let tracksHtml = this.standaloneTracks.map((t, i) => {

      const palettePicker = PALETTE.map(c => `

        <button type="button" class="w-5 h-5 rounded-full transition-transform hover:scale-125 border-2 ${c === t.color ? 'border-white scale-110 shadow-sm ring-2 ring-white/80' : 'border-black/50'}" style="background-color: ${c};" onclick="window.MapManagerInstance.setTrackColor('${t.id}', '${c}')" title="Appliquer cette couleur"></button>

      `).join('');



      return `

        <div class="flex items-center justify-between gap-3.5 p-2.5 rounded-2xl bg-slate-950/75 border border-slate-800 hover:border-slate-700 transition">

          <div class="flex items-center gap-3 min-w-0">

            <!-- Pastille de couleur cliquable grand format 28px -->

            <button type="button" class="w-7 h-7 rounded-full border-2 border-white shadow-lg flex-shrink-0 cursor-pointer hover:scale-125 transition-transform" style="background-color: ${t.color};" onclick="window.MapManagerInstance.cycleTrackColor('${t.id}')" title="Cliquez pour changer la couleur">

            </button>

            <span class="font-black text-base text-white truncate max-w-[150px] sm:max-w-[260px]" title="${t.name}">

              ${t.name}

            </span>

            <span class="px-2.5 py-1 rounded-xl bg-slate-800 text-sm font-mono text-emerald-300 font-bold whitespace-nowrap shadow-xs">

              ${t.distance} km • +${t.elevationGain}m${t.ibp ? ` • <strong class="text-amber-400 font-extrabold">IBP ${t.ibp}</strong>` : ''}

            </span>

          </div>



          <div class="flex items-center gap-2.5 flex-shrink-0">

            <!-- Palette rapide de couleurs -->

            <div class="hidden sm:flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-2xl border border-slate-800">

              ${palettePicker}

            </div>

            <!-- Bouton centrer la vue sur cette trace -->

            <button type="button" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-base text-slate-100 hover:text-white flex items-center justify-center transition shadow cursor-pointer" onclick="if(window.MapManagerInstance.standaloneTracks[${i}].layer) window.MapManagerInstance.map.fitBounds(window.MapManagerInstance.standaloneTracks[${i}].layer.getBounds(), {padding:[40,40]});" title="Centrer la carte sur cette trace">

              🎯

            </button>

            <!-- Bouton supprimer cette trace -->

            <button type="button" class="w-8 h-8 rounded-xl hover:bg-rose-900/70 text-slate-300 hover:text-rose-300 text-base font-black flex items-center justify-center transition cursor-pointer" onclick="window.MapManagerInstance.removeStandaloneTrack('${t.id}')" title="Fermer cette trace">

              ✕

            </button>

          </div>

        </div>

      `;

    }).join('');



    hud.innerHTML = `

      <div class="flex items-center justify-between gap-4 pb-2.5 border-b border-slate-800">

        <div class="flex items-center gap-2.5">

          <span class="text-amber-400 font-black text-sm sm:text-base uppercase tracking-wider">Traces GPX (${count}/3)</span>

          <span class="text-xs sm:text-sm text-slate-300 hidden md:inline">Cliquez sur une pastille pour changer de couleur</span>

        </div>

        <div class="flex items-center gap-2">

          ${count < 3 ? `

            <button type="button" onclick="document.getElementById('input-quick-gpx-viewer')?.click()" class="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md transition cursor-pointer">

              <span class="text-base font-black">+</span> <span>Ajouter trace</span>

            </button>

          ` : ''}

          <button id="btn-print-standalone-gpx" type="button" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md transition cursor-pointer">

            <span class="text-base">🖨️</span> <span>Imprimer</span>

          </button>

          <button id="btn-clear-standalone-gpx" type="button" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-700 text-slate-200 hover:text-white font-black text-xs sm:text-sm transition cursor-pointer" title="Fermer toutes les traces">

            Tout effacer

          </button>

          <!-- 3 solutions habituelles : - pour réduire, □ pour agrandir, ✕ pour fermer -->

          <div class="flex items-center gap-1.5 ml-2 pl-2.5 border-l-2 border-slate-700">

            <button type="button" onclick="window.MapManagerInstance.toggleMinimizeHud(true)" title="Réduire la boîte" class="hud-win-btn bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600">

              &minus;

            </button>

            <button type="button" onclick="window.MapManagerInstance.toggleMinimizeHud(false)" title="Agrandir / Pleine taille" class="hud-win-btn bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600">

              &#x25A1;

            </button>

            <button type="button" onclick="window.MapManagerInstance.clearStandaloneGpxTrack()" title="Fermer et effacer les traces GPX" class="hud-win-btn bg-rose-950/90 hover:bg-rose-700 text-rose-300 hover:text-white border border-rose-800">

              &#x2715;

            </button>

          </div>

        </div>

      </div>

      <div class="flex flex-col gap-2 max-h-64 overflow-y-auto">

        ${tracksHtml}

      </div>

    `;

    hud.classList.remove('hidden');



    const printBtn = document.getElementById('btn-print-standalone-gpx');

    if (printBtn) {

      printBtn.onclick = () => this.printAroundStandaloneGpx();

    }

    const clearBtn = document.getElementById('btn-clear-standalone-gpx');

    if (clearBtn) {

      clearBtn.onclick = () => this.clearStandaloneGpxTrack();

    }

  }



  printAroundStandaloneGpx() {

    if (!this.standaloneTracks || this.standaloneTracks.length === 0) return;

    const allBounds = L.latLngBounds([]);

    this.standaloneTracks.forEach(t => {

      if (t.layer) allBounds.extend(t.layer.getBounds());

    });

    if (!allBounds.isValid()) return;

    const padLat = (allBounds.getNorth() - allBounds.getSouth()) * 0.15;

    const padLng = (allBounds.getEast() - allBounds.getWest()) * 0.15;

    const paddedBounds = [

      [allBounds.getSouth() - padLat, allBounds.getWest() - padLng],

      [allBounds.getNorth() + padLat, allBounds.getEast() + padLng]

    ];

    if (window.App) {

      window.App.areaPrintHike = this.standaloneHike || this.standaloneTracks[0];

      window.App.openMapAreaModal(paddedBounds);

    }

  }



  clearStandaloneGpxTrack() {

    if (this.standaloneTracks && this.standaloneTracks.length > 0) {

      this.standaloneTracks.forEach(t => {

        if (t.layer && this.map.hasLayer(t.layer)) {

          this.map.removeLayer(t.layer);

        }

      });

      this.standaloneTracks = [];

    }

    this.standaloneHike = null;

    if (this.selectedHike && String(this.selectedHike.id).startsWith('gpx_user_')) {

      this.selectedHike = null;

    }

    const hud = document.getElementById('standalone-gpx-hud');

    if (hud) hud.classList.add('hidden');

  }



  /**

   * Planifie la mise à jour de la date de prise de vue de l'imagerie satellite

   */

  scheduleSatelliteDateUpdate() {

    if (!this.map) return;

    if (this._satDateTimeout) clearTimeout(this._satDateTimeout);

    this._satDateTimeout = setTimeout(() => {

      this.updateSatelliteDate();

    }, 400);

  }



  /**

   * Récupère et affiche la date exacte de prise de vue satellite (IGN Ortho HR en France ou Esri World)

   */

  async updateSatelliteDate() {

    if (!this.map) return;

    const center = this.map.getCenter();

    if (!center) return;



    const lat = center.lat;

    const lon = center.lng;

    let dateStr = '';

    let provider = '';



    try {

      if (this.isInsideFrance(lat, lon)) {

        // Flux officiel IGN WFS Ortho

        const delta = 0.01;

        const url = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAME=ORTHOIMAGERY.ORTHOPHOTOS.GRAPHE-MOSAIQUAGE:graphe_bdortho&BBOX=${lat-delta},${lon-delta},${lat+delta},${lon+delta},urn:ogc:def:crs:EPSG::4326&OUTPUTFORMAT=application/json`;

        const resp = await fetch(url);

        if (resp.ok) {

          const data = await resp.json();

          if (data && data.features && data.features.length > 0) {

            const p = data.features[0].properties;

            if (p.date_vol) {

              const dParts = String(p.date_vol).replace('Z', '').split('-');

              if (dParts.length >= 3) {

                dateStr = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;

              } else {

                dateStr = String(p.date_vol);

              }

              provider = 'IGN BD ORTHO® (20 cm)';

            } else if (p.pva) {

              dateStr = String(p.pva);

              provider = 'IGN BD ORTHO®';

            }

          }

        }

      }



      if (!dateStr) {

        // Esri World Imagery Identify

        const esriUrl = `https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/identify?geometry=${lon},${lat}&geometryType=esriGeometryPoint&sr=4326&layers=top&tolerance=2&mapExtent=${lon-0.05},${lat-0.05},${lon+0.05},${lat+0.05}&imageDisplay=800,600,96&returnGeometry=false&f=json`;

        const eResp = await fetch(esriUrl);

        if (eResp.ok) {

          const eData = await eResp.json();

          if (eData && eData.results && eData.results.length > 0) {

            const attr = eData.results[0].attributes || {};

            const dVal = attr['DATE (YYYYMMDD)'] || attr['SRC_DATE2'];

            if (dVal) {

              if (String(dVal).length === 8) {

                const y = String(dVal).substring(0, 4);

                const m = String(dVal).substring(4, 6);

                const d = String(dVal).substring(6, 8);

                dateStr = `${d}/${m}/${y}`;

              } else {

                dateStr = String(dVal);

              }

              provider = attr['SOURCE'] ? `Satellite ${attr['SOURCE']}` : 'Satellite Haute Résolution';

            }

          }

        }

      }

    } catch (e) {

      console.warn('Erreur lecture date satellite:', e);

    }



    if (dateStr) {

      this.currentSatelliteDateStr = `Prise de vue : ${dateStr} (${provider})`;

      // Mettre à jour l'attribution Leaflet

      const satLayer = this.baseLayers && (this.baseLayers["Satellite France (IGN Ortho)"] || this.baseLayers["Satellite Mondial (Esri 🌍)"]);

      if (satLayer) {

        const satAttr = `&copy; Satellite (${provider} • <span class="font-bold text-slate-800">Date : ${dateStr}</span>)`;

        satLayer.options.attribution = satAttr;

        if (this.map.attributionControl) {

          this.map.attributionControl.addAttribution(satAttr);

        }

      }

    }

  }




                /* =========================================================================
   * DÉTECTION ET BASCULE SPÉCIALE CARTE DES CALANQUES (IGN 89035 - 1:15 000)
   * ========================================================================= */
  initCalanquesDetection() {
    this._calanquesBounds = L.latLngBounds([43.175, 5.335], [43.275, 5.625]);
    this._calanquesAlertDismissed = false;
    this._calanquesActive = false;
    this._calanquesEverActivated = false;

    // Déplacement et zoom carte : détection continue en direct
    this.map.on('move', () => {
      this.checkCalanquesProximity();
    });

    this.map.on('moveend', () => {
      this.checkCalanquesProximity();
    });

    this.map.on('zoomend', () => {
      if (this._calanquesActive) {
        this.renderCalanquesDelimitation();
      }
      this.checkCalanquesProximity();
    });

    // Survol souris
    let moveThrottle = null;
    this.map.on('mousemove', (e) => {
      if (this._calanquesAlertDismissed || this._calanquesActive) return;
      if (moveThrottle) return;
      moveThrottle = setTimeout(() => {
        moveThrottle = null;
        if (this._calanquesBounds && this._calanquesBounds.contains(e.latlng)) {
          this.showCalanquesAlert();
        }
      }, 500);
    });
  }

  checkCalanquesProximity() {
    if (!this.map || !this._calanquesBounds) return;
    const mapBounds = this.map.getBounds();
    if (!mapBounds) return;

    const zoom = this.map.getZoom();
    // On est dans la zone des Calanques si le champ visuel intersecte les limites de la feuille 89035
    // à un niveau de zoom randonnée (zoom >= 10)
    const inZone = zoom >= 10 && mapBounds.intersects(this._calanquesBounds);

    const legendBtnUnderMap = document.getElementById('btn-open-calanques-legend');

    if (!inZone) {
      // REGLE UTILISATEUR STRICTE :
      // "quand on n'est plus dans la zone des calanques, le bandeau bordeau 89035 doit disparaître de même que la légende"
      this.hideCalanquesFloatingBadge();
      this.hideCalanquesAlert();
      if (legendBtnUnderMap) {
        legendBtnUnderMap.classList.add('hidden');
        legendBtnUnderMap.style.display = 'none';
      }
    } else {
      // On est DANS la zone des Calanques
      if (this._calanquesActive) {
        // La carte 89035 est active : afficher le bandeau bordeaux avec [✕] et les légendes
        this.showCalanquesFloatingBadge(true);
        if (legendBtnUnderMap) {
          legendBtnUnderMap.classList.remove('hidden');
          legendBtnUnderMap.style.display = 'inline-flex';
        }
      } else {
        // La carte 89035 n'est pas active :
        // La légende doit rester masquée
        if (legendBtnUnderMap) {
          legendBtnUnderMap.classList.add('hidden');
          legendBtnUnderMap.style.display = 'none';
        }
        // Si l'utilisateur avait précédemment activé la carte puis cliqué sur le carré pour masquer le calque
        // tout en restant dans la zone des Calanques, on maintient le bandeau avec le carré vide [ ]
        if (this._calanquesEverActivated) {
          this.showCalanquesFloatingBadge(false);
        } else if (!this._calanquesAlertDismissed && zoom >= 10 && zoom < 15) {
          this.showCalanquesAlert();
        }
      }
    }
  }

  showCalanquesAlert() {
    if (this._calanquesAlertDismissed || this._calanquesActive) return;
    let hud = document.getElementById('calanques-alert-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'calanques-alert-hud';
      hud.className = 'fixed bottom-14 left-1/2 -translate-x-1/2 z-[1050] bg-slate-900/95 backdrop-blur-md border-2 border-rose-800 rounded-2xl px-3.5 sm:px-5 py-2.5 shadow-2xl flex items-center gap-2.5 sm:gap-4 text-xs sm:text-sm text-white transition-all transform duration-300';
      hud.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-base sm:text-xl">🏖️</span>
          <div>
            <span class="font-black text-rose-300">Zone Calanques</span>
            <span class="text-slate-300 text-xs hidden sm:inline"> (Carte IGN 89035)</span>
            <div class="text-[11px] text-slate-300">Voulez-vous passer à l'échelle détaillée 1:15 000 ?</div>
          </div>
        </div>
        <div class="flex items-center gap-2 ml-1">
          <button id="btn-confirm-calanques" type="button" class="px-3 py-1.5 bg-gradient-to-r from-rose-800 to-amber-700 hover:from-rose-700 hover:to-amber-600 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1">
            <span>Oui, basculer</span>
            <span>&rarr;</span>
          </button>
          <button id="btn-close-calanques-alert" type="button" class="w-6 h-6 rounded-lg bg-slate-800 hover:bg-rose-900/80 text-slate-400 hover:text-white flex items-center justify-center font-bold text-xs transition cursor-pointer" title="Ignorer pour cette session">
            &#x2715;
          </button>
        </div>
      `;
      document.body.appendChild(hud);

      document.getElementById('btn-confirm-calanques').addEventListener('click', () => {
        this.activateCalanquesMode();
      });
      document.getElementById('btn-close-calanques-alert').addEventListener('click', () => {
        this._calanquesAlertDismissed = true;
        this.hideCalanquesAlert();
      });
    }
    hud.classList.remove('hidden');
    hud.style.display = 'flex';
  }

  hideCalanquesAlert() {
    const hud = document.getElementById('calanques-alert-hud');
    if (hud) {
      hud.classList.add('hidden');
      hud.style.display = 'none';
    }
  }

  activateCalanquesMode() {
    this._calanquesActive = true;
    this._calanquesEverActivated = true;
    this.hideCalanquesAlert();

    // 1. S'assurer d'être sur la carte IGN TOP 25
    if (this.currentBaseLayer !== 'igntop25') {
      this.setBaseLayer('igntop25');
    }

    // 2. Afficher la délimitation officielle feuille 89035 en BORDEAUX
    this.renderCalanquesDelimitation();

    // 3. Afficher l'UNIQUE bandeau en haut avec le carré coché (✕) et le bouton Légende
    this.showCalanquesFloatingBadge(true);

    // 4. Afficher le bouton Légende sous la carte
    const legendBtnUnderMap = document.getElementById('btn-open-calanques-legend');
    if (legendBtnUnderMap) {
      legendBtnUnderMap.classList.remove('hidden');
      legendBtnUnderMap.style.display = 'inline-flex';
    }

    // 5. Cadrer sur les Calanques
    this._isProgrammaticZoom = true;
    this.map.fitBounds(this._calanquesBounds, { padding: [30, 30], animate: true });
    this.updateMapHud();
  }

  showCalanquesFloatingBadge(isActive = true) {
    let chip = document.getElementById('calanques-floating-chip');
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'calanques-floating-chip';
      chip.className = 'fixed top-14 left-1/2 -translate-x-1/2 z-[1000] bg-gradient-to-r from-[#2b040e] to-[#4c0519] text-[#ffe4e6] border-2 border-[#be123c] px-3.5 py-1.5 rounded-2xl text-xs font-black shadow-2xl flex items-center gap-2.5 transition-all pointer-events-auto';
      chip.innerHTML = `
        <span class="text-sm">🗺️</span>
        <span class="whitespace-nowrap font-black">IGN 89035 &bull; Traversée des Calanques</span>
        
        <button type="button" id="btn-calanques-chip-legend"
                title="Consulter la légende détaillée de la carte IGN 89035" 
                class="${isActive ? '' : 'hidden'}"
                style="margin-left:4px;background:#881337;border:1px solid #fda4af;color:#ffffff;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:bold;cursor:pointer;display:${isActive ? 'inline-flex' : 'none'};align-items:center;gap:3px;transition:all 0.2s;" 
                onmouseover="this.style.background='#be123c'" 
                onmouseout="this.style.background='#881337'">
          <span>📖</span><span>Légende</span>
        </button>

        <button type="button" id="btn-toggle-calanques-square" 
                title="${isActive ? "Désactiver la carte IGN 89035 (revenir à TOP 25)" : "Réafficher la carte IGN 89035 (1:15 000)"}" 
                style="margin-left:4px;background:${isActive ? '#881337' : 'rgba(43,4,14,0.5)'};border:2px solid ${isActive ? '#fecdd3' : '#fda4af'};color:#ffffff;border-radius:5px;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;cursor:pointer;transition:all 0.2s;" 
                onmouseover="this.style.transform='scale(1.1)'" 
                onmouseout="this.style.transform='scale(1)'">${isActive ? '✕' : ''}</button>
      `;
      document.body.appendChild(chip);

      document.getElementById('btn-calanques-chip-legend').addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.App) window.App.openMapLegendModal('calanques');
      });

      document.getElementById('btn-toggle-calanques-square').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCalanquesLayer();
      });
    } else {
      this.updateCalanquesSquare(isActive);
    }
    chip.classList.remove('hidden');
    chip.style.display = 'flex';
  }

  hideCalanquesFloatingBadge() {
    const chip = document.getElementById('calanques-floating-chip');
    if (chip) {
      chip.classList.add('hidden');
      chip.style.display = 'none';
    }
  }

  updateCalanquesSquare(isActive) {
    const square = document.getElementById('btn-toggle-calanques-square');
    const chipLegendBtn = document.getElementById('btn-calanques-chip-legend');
    const underMapLegendBtn = document.getElementById('btn-open-calanques-legend');

    if (isActive) {
      if (square) {
        square.textContent = '✕';
        square.title = "Désactiver la carte IGN 89035 (revenir à TOP 25)";
        square.style.background = '#881337';
        square.style.borderColor = '#fecdd3';
        square.style.color = '#ffffff';
      }
      if (chipLegendBtn) {
        chipLegendBtn.style.display = 'inline-flex';
        chipLegendBtn.classList.remove('hidden');
      }
      if (underMapLegendBtn) {
        underMapLegendBtn.style.display = 'inline-flex';
        underMapLegendBtn.classList.remove('hidden');
      }
    } else {
      if (square) {
        square.textContent = ''; // Carré vide sans X
        square.title = "Réafficher la carte IGN 89035 (1:15 000)";
        square.style.background = 'rgba(43, 4, 14, 0.4)';
        square.style.borderColor = '#fda4af';
        square.style.color = 'transparent';
      }
      // La légende ne doit apparaître QUE quand la carte calanques est active
      if (chipLegendBtn) {
        chipLegendBtn.style.display = 'none';
        chipLegendBtn.classList.add('hidden');
      }
      if (underMapLegendBtn) {
        underMapLegendBtn.style.display = 'none';
        underMapLegendBtn.classList.add('hidden');
      }
    }
  }

  toggleCalanquesLayer() {
    if (this._calanquesActive) {
      // Désactiver la carte 89035 : retirer les contours mais GARDER le bandeau avec le carré sans X tant qu'on est dans la zone
      this._calanquesActive = false;
      this._calanquesEverActivated = true;
      if (this._calanquesDelimLayer) {
        this.map.removeLayer(this._calanquesDelimLayer);
        this._calanquesDelimLayer = null;
      }
      // Revenir à l'échelle standard TOP 25 (zoom 14)
      this._isProgrammaticZoom = true;
      this.map.setZoom(14, { animate: true, duration: 0.5 });
      // Mettre à jour le bouton carré : carré vide sans X et masquer la légende
      this.updateCalanquesSquare(false);
    } else {
      // Réactiver la carte 89035 : afficher les contours Bordeaux et zoomer au 1:15 000
      this._calanquesActive = true;
      this._calanquesEverActivated = true;
      this.renderCalanquesDelimitation();
      this._isProgrammaticZoom = true;
      this.map.setView([43.218, 5.465], 15, { animate: true, duration: 0.5 });
      // Mettre à jour le bouton carré : carré avec ✕ et afficher la légende
      this.updateCalanquesSquare(true);
    }
    this.updateMapHud();
  }

  renderCalanquesDelimitation() {
    if (!this.map || !this._calanquesActive) return;
    if (this._calanquesDelimLayer) {
      this.map.removeLayer(this._calanquesDelimLayer);
    }
    this._calanquesDelimLayer = L.layerGroup();

    // MÊMES CARACTÉRISTIQUES D'ÉPAISSEUR ET TRANSPARENCE QUE LE TRAIT BLEU DES FEUILLES TOP 25 (en Bordeaux #800020)
    const zoom = this.map.getZoom();
    let outerWeight, innerWeight, showInnerDashed;

    if (zoom >= 13) {
      outerWeight = 14;
      innerWeight = 2;
      showInnerDashed = true;
    } else if (zoom >= 11) {
      outerWeight = 9;
      innerWeight = 1.5;
      showInnerDashed = true;
    } else if (zoom >= 9) {
      outerWeight = 5;
      innerWeight = 1;
      showInnerDashed = true;
    } else if (zoom >= 7) {
      outerWeight = 2.5;
      innerWeight = 0;
      showInnerDashed = false;
    } else {
      outerWeight = 1.2;
      innerWeight = 0;
      showInnerDashed = false;
    }

    // A. Bande extérieure translucide Bordeaux (strictement identique au '#0284c7' des TOP 25)
    L.rectangle(this._calanquesBounds, {
      color: '#800020',
      weight: outerWeight,
      opacity: zoom >= 8 ? 0.35 : 0.55,
      fill: true,
      fillColor: '#800020',
      fillOpacity: zoom >= 10 ? 0.025 : 0.001,
      interactive: false
    }).addTo(this._calanquesDelimLayer);

    // B. Trait intérieur en pointillés Bordeaux (strictement identique au '#0369a1' des TOP 25 : dashArray '8, 6', opacity 0.85)
    if (showInnerDashed) {
      L.rectangle(this._calanquesBounds, {
        color: '#800020',
        weight: innerWeight,
        opacity: 0.85,
        dashArray: '8, 6',
        fill: false,
        interactive: false
      }).addTo(this._calanquesDelimLayer);
    }

    // Un seul bandeau unique existe en haut de l'écran tant qu'on est dans la zone.
    this._calanquesDelimLayer.addTo(this.map);
  }

  deactivateCalanquesMode() {
    this.toggleCalanquesLayer();
  }

  deactivateCalanquesMode() {
    this._calanquesActive = false;
    this._calanquesAlertDismissed = true;
    
    // 1. Supprimer le calque de délimitation
    if (this._calanquesDelimLayer) {
      this.map.removeLayer(this._calanquesDelimLayer);
      this._calanquesDelimLayer = null;
    }

    // 2. S'assurer d'être sur la couche TOP 25 Standard
    if (this.currentBaseLayer !== 'igntop25') {
      this.setBaseLayer('igntop25');
    }

    // 3. Revenir à l'échelle standard TOP 25 (1:25 000, zoom 14)
    this._isProgrammaticZoom = true;
    this.map.setZoom(14, { animate: true, duration: 0.5 });

    // 4. Mettre à jour l'indicateur d'échelle et les affichages
    this.updateMapHud();
  }

}



window.MapManager = MapManager;

