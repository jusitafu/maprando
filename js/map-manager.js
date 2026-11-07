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
    this.bearingPointA = null;
    this.bearingPointB = null;
    this.bearingLayer = null;
    this.bearingPreviewLine = null;

    // Mesure d'itinéraire par clics successifs
    this.measurePathActive = false;
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

    this.baseLayers = {
      "IGN TOP 25 (Carte papier officielle)": ignTop25,
      "IGN Plan (Numérique moderne)": ignPlan,
      "OpenTopoMap (Relief mondial)": openTopo,
      "OpenStreetMap France (Sentiers)": osmFr,
      "Satellite Mondial (Esri 🌍)": esriSat,
      "Satellite France (IGN Ortho)": ignSat
    };

    // 2. Init Map centered on Sanary-sur-Mer with official IGN Top 25 layer
    this.map = L.map(this.containerId, {
      center: [this.searchOrigin.lat, this.searchOrigin.lon],
      zoom: 11,
      maxZoom: 19,
      layers: [ignTop25],
      zoomControl: true,
      zoomSnap: 0,
      zoomDelta: 1
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

    this.updateSearchRadiusVisuals(false);

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
        if (name.includes('plan')) this.currentBaseLayer = 'ignplan';
        else if (name.includes('opentopo')) this.currentBaseLayer = 'opentopo';
        else if (name.includes('france') || name.includes('openstreetmap')) this.currentBaseLayer = 'osmfr';
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
    if (typeof lat !== 'number' || typeof lon !== 'number') return true;
    // Métropole + Corse
    if (lat >= 41.3 && lat <= 51.2 && lon >= -5.2 && lon <= 9.6) return true;
    // DOM-TOM
    if (lat >= 14.3 && lat <= 16.6 && lon >= -61.9 && lon <= -60.7) return true; // Antilles
    if (lat >= -21.4 && lat <= -20.8 && lon >= 55.1 && lon <= 55.9) return true; // Réunion
    if (lat >= 2.1 && lat <= 5.8 && lon >= -54.7 && lon <= -51.6) return true; // Guyane
    if (lat >= -13.0 && lat <= -12.6 && lon >= 45.0 && lon <= 45.3) return true; // Mayotte
    return false;
  }

  setBaseLayer(key) {
    if (!this.map || !this.baseLayers) return;
    let targetLayer = null;
    let targetKey = key;
    for (const [name, layer] of Object.entries(this.baseLayers)) {
      const lower = name.toLowerCase();
      if (key === 'opentopo' && lower.includes('opentopo')) { targetLayer = layer; break; }
      if (key === 'igntop25' && (lower.includes('top 25') || lower.includes('top25'))) { targetLayer = layer; break; }
      if (key === 'ignplan' && lower.includes('plan')) { targetLayer = layer; break; }
      if (key === 'osmfr' && (lower.includes('france') || lower.includes('openstreetmap'))) { targetLayer = layer; break; }
      if (key === 'satellite' && lower.includes('satellite')) { targetLayer = layer; break; }
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
      if (typeof this.onBaseLayerChangeCallback === 'function') {
        this.onBaseLayerChangeCallback(this.currentBaseLayer);
      }
    }
  }

  setSearchOrigin(lat, lon, name = 'Lieu sélectionné', autoZoom = false) {
    this.searchOrigin = { lat, lon, name };

    // Si le lieu est hors de France (ex: Rome, Tokyo, Madrid, New York, Aoste, Genève)
    // et que le fond de carte actif est IGN (qui ne couvre que la France),
    // basculer automatiquement sur OpenTopoMap (Relief mondial) pour afficher le relief et la topographie
    if (!this.isInsideFrance(lat, lon)) {
      if (this.currentBaseLayer === 'igntop25' || this.currentBaseLayer === 'ignplan') {
        this.setBaseLayer('opentopo');
        this._autoSwitchedForeign = true;
      }
    } else {
      if (this._autoSwitchedForeign && this.currentBaseLayer === 'opentopo') {
        this.setBaseLayer('igntop25');
        this._autoSwitchedForeign = false;
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
    if (this._cursorRafId) return;
    this._cursorRafId = requestAnimationFrame(() => {
      this._cursorRafId = null;
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

    // Actualisation altimétrique temporisée (IGN RGE Alti®)
    this.scheduleElevationFetch(lat, lon);
    this.scheduleCityFetch(lat, lon);
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
    this.bearingPointA = null;
    this.bearingPointB = null;

    // Désactiver le zoom au double-clic et les interactions parasites
    if (this.map.doubleClickZoom) {
      this.map.doubleClickZoom.disable();
    }
    if (this.map.getPane('markerPane')) this.map.getPane('markerPane').style.pointerEvents = 'none';
    if (this.map.getPane('overlayPane')) this.map.getPane('overlayPane').style.pointerEvents = 'none';

    // Curseur réticule
    L.DomUtil.addClass(this.map.getContainer(), 'bearing-selection-cursor');

    // Calque dédié pour la ligne et les marqueurs A/B
    if (!this.bearingLayer) {
      this.bearingLayer = L.layerGroup().addTo(this.map);
    }
    this.bearingLayer.clearLayers();
    this.bearingPreviewLine = null;

    // Mesure d'itinéraire par clics successifs
    this.measurePathActive = false;
    this.measurePoints = [];
    this.measureMarkers = [];
    this.measurePolyline = null;
    this.measurePreviewLine = null;
    this.measureLayer = null;
    this._onMeasureMouseMove = null;
    this.measureTotalDistance = 0;

    // Afficher le panneau flottant
    const panel = document.getElementById('map-bearing-panel');
    const btn = document.getElementById('btn-map-bearing');
    const btnText = document.getElementById('btn-map-bearing-text');
    const instrText = document.getElementById('map-bearing-instruction-text');
    const valEl = document.getElementById('map-bearing-val');
    const compassEl = document.getElementById('map-bearing-compass');
    const revEl = document.getElementById('map-bearing-reverse');
    const distEl = document.getElementById('map-bearing-distance');
    const coordsBox = document.getElementById('map-bearing-coords');
    const arrowEl = document.getElementById('map-bearing-arrow');

    if (panel) panel.classList.remove('hidden');
    if (btn) {
      btn.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-400');
    }
    if (btnText) btnText.textContent = 'Cap (actif)';
    if (instrText) instrText.textContent = 'Étape 1 sur 2 : Cliquez sur la carte pour poser le point A (départ).';
    if (valEl) valEl.textContent = '--°';
    if (compassEl) compassEl.textContent = '';
    if (revEl) revEl.textContent = '--°';
    if (distEl) distEl.textContent = '-- km';
    if (coordsBox) coordsBox.classList.add('hidden');
    if (arrowEl) arrowEl.style.transform = 'rotate(0deg)';

    // Suivi de la souris pour la ligne en temps réel vers le curseur
    this._onBearingMouseMove = (e) => {
      if (!this.bearingMeasurementActive || !this.bearingPointA || this.bearingPointB) return;
      const currentPoint = e.latlng;

      if (!this.bearingPreviewLine) {
        this.bearingPreviewLine = L.polyline([this.bearingPointA, currentPoint], {
          color: '#10b981',
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

    // Échap pour annuler
    this._onBearingKeyDown = (e) => {
      if (e.key === 'Escape') {
        this.cancelBearingMeasurement();
      }
    };
    window.addEventListener('keydown', this._onBearingKeyDown);
  }

  /**
   * Ferme le panneau et réinitialise l'outil Cap
   */
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

    if (this.bearingLayer) {
      this.bearingLayer.clearLayers();
    }
    this.bearingPreviewLine = null;

    // Mesure d'itinéraire par clics successifs
    this.measurePathActive = false;
    this.measurePoints = [];
    this.measureMarkers = [];
    this.measurePolyline = null;
    this.measurePreviewLine = null;
    this.measureLayer = null;
    this._onMeasureMouseMove = null;
    this.measureTotalDistance = 0;

    const panel = document.getElementById('map-bearing-panel');
    const btn = document.getElementById('btn-map-bearing');
    const btnText = document.getElementById('btn-map-bearing-text');
    if (panel) panel.classList.add('hidden');
    if (btn) {
      btn.classList.remove('bg-emerald-50', 'text-emerald-700', 'border-emerald-400');
    }
    if (btnText) btnText.textContent = 'Cap';
  }

  /**
   * Efface le tracé actuel pour recommencer immédiatement une mesure
   */
  clearBearingVisuals() {
    if (this.bearingLayer) {
      this.bearingLayer.clearLayers();
    }
    this.bearingPreviewLine = null;

    // Mesure d'itinéraire par clics successifs
    this.measurePathActive = false;
    this.measurePoints = [];
    this.measureMarkers = [];
    this.measurePolyline = null;
    this.measurePreviewLine = null;
    this.measureLayer = null;
    this._onMeasureMouseMove = null;
    this.measureTotalDistance = 0;
    this.bearingPointA = null;
    this.bearingPointB = null;

    const instrText = document.getElementById('map-bearing-instruction-text');
    const valEl = document.getElementById('map-bearing-val');
    const compassEl = document.getElementById('map-bearing-compass');
    const revEl = document.getElementById('map-bearing-reverse');
    const distEl = document.getElementById('map-bearing-distance');
    const coordsBox = document.getElementById('map-bearing-coords');
    const arrowEl = document.getElementById('map-bearing-arrow');

    if (instrText) instrText.textContent = 'Étape 1 sur 2 : Cliquez sur la carte pour poser le point A (départ).';
    if (valEl) valEl.textContent = '--°';
    if (compassEl) compassEl.textContent = '';
    if (revEl) revEl.textContent = '--°';
    if (distEl) distEl.textContent = '-- km';
    if (coordsBox) coordsBox.classList.add('hidden');
    if (arrowEl) arrowEl.style.transform = 'rotate(0deg)';

    if (this.map) {
      L.DomUtil.addClass(this.map.getContainer(), 'bearing-selection-cursor');
      if (this._onBearingMouseMove) {
        this.map.off('mousemove', this._onBearingMouseMove);
      }
      this._onBearingMouseMove = (e) => {
        if (!this.bearingMeasurementActive || !this.bearingPointA || this.bearingPointB) return;
        const currentPoint = e.latlng;
        if (!this.bearingPreviewLine) {
          this.bearingPreviewLine = L.polyline([this.bearingPointA, currentPoint], {
            color: '#10b981',
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
    }
  }

  /**
   * Gestion du clic sur la carte pendant la mesure de cap
   */
  handleBearingClick(latlng) {
    if (!this.bearingPointA) {
      // 1er clic : Point A
      this.bearingPointA = latlng;

      const iconA = L.divIcon({
        className: 'bearing-marker-icon',
        html: '<div class="bearing-marker-badge marker-a">A</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      L.marker(latlng, { icon: iconA, interactive: false }).addTo(this.bearingLayer);

      const instrText = document.getElementById('map-bearing-instruction-text');
      if (instrText) {
        instrText.textContent = 'Étape 2 sur 2 : Déplacez le curseur et cliquez pour le point B (arrivée).';
      }
    } else if (!this.bearingPointB) {
      // 2e clic : Point B
      this.bearingPointB = latlng;

      if (this.bearingPreviewLine) {
        this.bearingLayer.removeLayer(this.bearingPreviewLine);
        this.bearingPreviewLine = null;

    // Mesure d'itinéraire par clics successifs
    this.measurePathActive = false;
    this.measurePoints = [];
    this.measureMarkers = [];
    this.measurePolyline = null;
    this.measurePreviewLine = null;
    this.measureLayer = null;
    this._onMeasureMouseMove = null;
    this.measureTotalDistance = 0;
      }

      if (this._onBearingMouseMove && this.map) {
        this.map.off('mousemove', this._onBearingMouseMove);
        this._onBearingMouseMove = null;
      }
      if (this.map) {
        L.DomUtil.removeClass(this.map.getContainer(), 'bearing-selection-cursor');
      }

      const iconB = L.divIcon({
        className: 'bearing-marker-icon',
        html: '<div class="bearing-marker-badge marker-b">B</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      L.marker(latlng, { icon: iconB, interactive: false }).addTo(this.bearingLayer);

      // Tracé plein A -> B
      L.polyline([this.bearingPointA, this.bearingPointB], {
        color: '#059669',
        weight: 4,
        opacity: 0.95
      }).addTo(this.bearingLayer);

      const metrics = this.updateBearingDisplay(this.bearingPointA, this.bearingPointB, false);

      // Badge au milieu de la ligne
      const midLat = (this.bearingPointA.lat + this.bearingPointB.lat) / 2;
      const midLng = (this.bearingPointA.lng + this.bearingPointB.lng) / 2;
      const midIcon = L.divIcon({
        className: 'bearing-line-label',
        html: `<span>🧭 ${metrics.bearingRound}° (${metrics.compass}) • ${metrics.distStr}</span>`,
        iconSize: [140, 24],
        iconAnchor: [70, 12]
      });
      L.marker([midLat, midLng], { icon: midIcon, interactive: false }).addTo(this.bearingLayer);

      const instrText = document.getElementById('map-bearing-instruction-text');
      if (instrText) {
        instrText.textContent = '✅ Cap mesuré ! Cliquez sur "Nouvelle mesure" pour recommencer.';
      }
    }
  }

  /**
   * Calcul géodésique et mise à jour de l'affichage du panneau Cap
   */
  updateBearingDisplay(pointA, pointB, isLive) {
    const bearing = MapManager.calculateBearing(pointA.lat, pointA.lng, pointB.lat, pointB.lng);
    const reverseBearing = (bearing + 180) % 360;
    const compass = MapManager.getCompassDirection(bearing);
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
    const coordsBox = document.getElementById('map-bearing-coords');
    const coordA = document.getElementById('map-bearing-coord-a');
    const coordB = document.getElementById('map-bearing-coord-b');

    if (valEl) valEl.textContent = `${bearingRound}°`;
    if (compassEl) compassEl.textContent = `(${compass})`;
    if (revEl) revEl.textContent = `${reverseRound}°`;
    if (distEl) distEl.textContent = distStr;
    if (arrowEl) arrowEl.style.transform = `rotate(${bearingRound}deg)`;

    if (!isLive && coordsBox && coordA && coordB) {
      coordsBox.classList.remove('hidden');
      const utmA = MapManager.latLonToUtm(pointA.lat, pointA.lng);
      const utmB = MapManager.latLonToUtm(pointB.lat, pointB.lng);
      coordA.textContent = `${pointA.lat.toFixed(4)}°, ${pointA.lng.toFixed(4)}° • ${utmA.zone}${utmA.band} ${utmA.easting}E ${utmA.northing}N`;
      coordB.textContent = `${pointB.lat.toFixed(4)}°, ${pointB.lng.toFixed(4)}° • ${utmB.zone}${utmB.band} ${utmB.easting}E ${utmB.northing}N`;
    }

    return { bearing, bearingRound, reverseRound, compass, distKm, distMeters, distStr };
  }

  /**
   * Calcul du cap (azimut initial géodésique) en degrés entre 2 coordonnées WGS84
   */
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

      // 2. Si hors de France ou indisponibilité : Fallback mondial Open-Meteo Elevation
      if (z === null) {
        try {
          const openUrl = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;
          const resp = await fetch(openUrl, { signal: this._elevationAbortCtrl.signal });
          if (resp.ok) {
            const data = await resp.json();
            if (data && Array.isArray(data.elevation) && data.elevation.length > 0) {
              z = Math.round(data.elevation[0]);
            }
          }
        } catch (openErr) {
          if (openErr.name === 'AbortError') return;
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
    if (altiValEl) {
      altiValEl.textContent = `${z} m`;
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

    const top25Layer = this.baseLayers && this.baseLayers["IGN TOP 25 (Carte papier officielle)"];
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
    }
    this._cityTimeout = setTimeout(() => {
      this.fetchCity(lat, lon);
    }, 250);
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

    if (cityStr) {
      valEl.textContent = cityStr;
      cityEl.classList.remove('hidden');
      cityEl.classList.add('flex');
    } else {
      cityEl.classList.add('hidden');
      cityEl.classList.remove('flex');
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

  /**
   * Affiche un tracé GPX en mode autonome (accès libre sans enregistrement)
   * et propose l'impression de la carte haute définition autour du tracé.
   */
  displayStandaloneGpxTrack(gpxData, fileName) {
    if (!this.map || !gpxData) return;

    if (this._standaloneGpxLayer) {
      this.map.removeLayer(this._standaloneGpxLayer);
      this._standaloneGpxLayer = null;
    }

    // Récupérer les points (soit direct de GPXParser.parse, soit tracks)
    let pts = gpxData.points || [];
    if (pts.length === 0 && gpxData.tracks) {
      gpxData.tracks.forEach(track => {
        track.segments.forEach(seg => {
          seg.points.forEach(p => pts.push(p));
        });
      });
    }

    if (pts.length === 0) return;

    const latlngs = pts.map(p => [p.lat, p.lon]);

    const polyline = L.polyline(latlngs, {
      color: '#e11d48',
      weight: 4.5,
      opacity: 0.95,
      lineJoin: 'round'
    });

    const startPt = latlngs[0];
    const endPt = latlngs[latlngs.length - 1];

    const startMarker = L.circleMarker(startPt, {
      radius: 7,
      fillColor: '#16a34a',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 1
    }).bindTooltip('<b>Départ</b>');

    const endMarker = L.circleMarker(endPt, {
      radius: 7,
      fillColor: '#dc2626',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 1
    }).bindTooltip('<b>Arrivée</b>');

    this._standaloneGpxLayer = L.featureGroup([polyline, startMarker, endMarker]);
    this.map.addLayer(this._standaloneGpxLayer);
    this.map.fitBounds(this._standaloneGpxLayer.getBounds(), { padding: [40, 40] });

    const trackName = (gpxData.name || fileName || 'Trace GPX importée').replace(/\.gpx$/i, '');
    const distVal = (gpxData.distanceKm !== undefined) ? gpxData.distanceKm : ((gpxData.distance !== undefined) ? gpxData.distance : '0');
    const eleVal = (gpxData.elevationGain !== undefined) ? Math.round(gpxData.elevationGain) : 0;

    this.standaloneHike = {
      id: gpxData.id || ('gpx_user_' + Date.now()),
      name: trackName,
      distance: String(distVal),
      elevationGain: eleVal,
      points: pts,
      startPoint: gpxData.startPoint || { lat: startPt[0], lon: startPt[1] },
      endPoint: gpxData.endPoint || { lat: endPt[0], lon: endPt[1] }
    };
    this.selectedHike = this.standaloneHike;

    // Afficher le HUD interactif avec bouton d'impression
    this.showStandaloneGpxHud(this.standaloneHike);
  }

  showStandaloneGpxHud(hike) {
    let hud = document.getElementById('standalone-gpx-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'standalone-gpx-hud';
      hud.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[1050] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl px-4 py-2.5 shadow-2xl flex items-center gap-3 text-xs text-white';
      document.body.appendChild(hud);
    }
    hud.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
        <span class="font-bold text-slate-100 truncate max-w-[180px] sm:max-w-[280px]" title="${hike.name}">${hike.name}</span>
        <span class="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-mono text-emerald-400 whitespace-nowrap">${hike.distance} km • +${hike.elevationGain}m</span>
      </div>
      <div class="flex items-center gap-2 border-l border-slate-700 pl-3">
        <button id="btn-print-standalone-gpx" type="button" class="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm">
          <span>🖨️</span> <span class="hidden sm:inline">Imprimer la carte</span><span class="sm:hidden">Imprimer</span>
        </button>
        <button id="btn-clear-standalone-gpx" type="button" class="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition cursor-pointer" title="Fermer cette trace">
          ✕
        </button>
      </div>
    `;
    hud.classList.remove('hidden');

    document.getElementById('btn-print-standalone-gpx').addEventListener('click', () => {
      this.printAroundStandaloneGpx();
    });

    document.getElementById('btn-clear-standalone-gpx').addEventListener('click', () => {
      this.clearStandaloneGpxTrack();
    });
  }

  printAroundStandaloneGpx() {
    if (!this._standaloneGpxLayer) return;
    const bounds = this._standaloneGpxLayer.getBounds();
    const padLat = (bounds.getNorth() - bounds.getSouth()) * 0.15;
    const padLng = (bounds.getEast() - bounds.getWest()) * 0.15;
    const paddedBounds = [
      [bounds.getSouth() - padLat, bounds.getWest() - padLng],
      [bounds.getNorth() + padLat, bounds.getEast() + padLng]
    ];
    if (window.App) {
      window.App.areaPrintHike = this.standaloneHike;
      window.App.openMapAreaModal(paddedBounds);
    }
  }

  clearStandaloneGpxTrack() {
    if (this._standaloneGpxLayer) {
      this.map.removeLayer(this._standaloneGpxLayer);
      this._standaloneGpxLayer = null;
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

}

window.MapManager = MapManager;
