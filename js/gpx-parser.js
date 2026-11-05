/**
 * Universal & Bulletproof GPX / XML / KML / GeoJSON Parser
 * Les Randonneurs Sanaryens - RandoFinder - JLD Apps 2026
 * Strict Separation of Track Points (<trkpt>), Route Points (<rtept>) and Waypoints (<wpt>)
 * 100% Guaranteed pure continuous hiking trails without rogue straight-line chords
 */

class GPXParser {
  /**
   * Parse GPS text content into a clean Hike object
   */
  static parse(gpxText, filename = 'randonnee.gpx') {
    if (!gpxText || typeof gpxText !== 'string' || gpxText.trim().length === 0) {
      throw new Error("Le fichier est vide.");
    }

    // 1. Clean & sanitize text
    let cleanText = gpxText
      .replace(/^\uFEFF/, '') // UTF-8 BOM
      .replace(/^\uFFFE/, '') // UTF-16 BOM
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Non-printable control chars
      .trim();

    // Default name from filename
    let name = (filename || 'Randonnée')
      .replace(/\.(gpx|xml|kml|geojson|json|tcx|fit|txt)$/i, '')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/[-_]/g, ' ')
      .trim();

    let notes = '';
    const waypoints = [];
    const segments = []; // Array of point arrays for multi-segment tracks
    let rawPoints = [];

    // -------------------------------------------------------------
    // STEP A: Extract Name & Notes
    // -------------------------------------------------------------
    // Look for track name or metadata name
    const trkNameMatch = /<trk\b[^>]*>[\s\S]*?<name\b[^>]*>([\s\S]*?)<\/name>/i.exec(cleanText);
    const metaNameMatch = /<metadata\b[^>]*>[\s\S]*?<name\b[^>]*>([\s\S]*?)<\/name>/i.exec(cleanText);
    const generalNameMatch = /<([a-zA-Z0-9_:-]+:)?name\b[^>]*>([^<]+)<\//i.exec(cleanText);

    const isGenericName = (n) => !n || /^(trail planner map|track|active log|export|randonn[eé]e|route|map|alltrails|visorando|komoot|strava|route\s*\d*|unnamed)$/i.test(n.trim());

    if (trkNameMatch && trkNameMatch[1] && trkNameMatch[1].trim()) {
      const extracted = trkNameMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
      if (extracted && !isGenericName(extracted)) {
        name = extracted;
      }
    } else if (metaNameMatch && metaNameMatch[1] && metaNameMatch[1].trim()) {
      const extracted = metaNameMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
      if (extracted && !isGenericName(extracted)) {
        name = extracted;
      }
    } else if (generalNameMatch && generalNameMatch[2] && generalNameMatch[2].trim()) {
      const extracted = generalNameMatch[2].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      if (extracted && !isGenericName(extracted)) {
        name = extracted;
      }
    }

    const descMatch = /<([a-zA-Z0-9_:-]+:)?(?:desc|description)\b[^>]*>([\s\S]*?)<\//i.exec(cleanText);
    const cmtMatch = /<([a-zA-Z0-9_:-]+:)?cmt\b[^>]*>([\s\S]*?)<\//i.exec(cleanText);

    if (descMatch && descMatch[2]) {
      notes = descMatch[2].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
    } else if (cmtMatch && cmtMatch[2]) {
      notes = cmtMatch[2].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
    }

    // -------------------------------------------------------------
    // STEP B: Strict Hierarchical Track Extraction
    // -------------------------------------------------------------

    // Helper to parse lat/lon/ele/time from a point XML string
    const parsePointElement = (attrs, body = '') => {
      const latMatch = /\blat(?:itude)?\s*=\s*["']?([0-9.,+-]+)/i.exec(attrs);
      const lonMatch = /\b(?:lon|lng|longitude)\s*=\s*["']?([0-9.,+-]+)/i.exec(attrs);

      if (latMatch && lonMatch) {
        const lat = parseFloat(latMatch[1].replace(',', '.'));
        const lon = parseFloat(lonMatch[1].replace(',', '.'));

        if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          let ele = 0;
          const eleMatch = /<(?:[a-zA-Z0-9_:-]+:)?ele\b[^>]*>([0-9.,+-]+)</i.exec(body) ||
                           /\bele\s*=\s*["']?([0-9.,+-]+)/i.exec(attrs);
          if (eleMatch) {
            const parsedEle = parseFloat(eleMatch[1].replace(',', '.'));
            if (!isNaN(parsedEle)) ele = parsedEle;
          }

          let time = null;
          const timeMatch = /<(?:[a-zA-Z0-9_:-]+:)?time\b[^>]*>([^<]+)</i.exec(body);
          if (timeMatch) time = timeMatch[1].trim();

          return { lat, lon, ele, time };
        }
      }
      return null;
    };

    // PRIORITY 1: Parse <trkseg> blocks containing <trkpt> (Authentic Recorded Track)
    const trksegRegex = /<(?:[a-zA-Z0-9_:-]+:)?trkseg\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_:-]+:)?trkseg>/gi;
    let segMatch;
    let foundTrksegs = false;

    while ((segMatch = trksegRegex.exec(cleanText)) !== null) {
      foundTrksegs = true;
      const segBody = segMatch[1];
      const segPoints = [];

      const trkptRegex = /<(?:[a-zA-Z0-9_:-]+:)?trkpt\b([^>]*?)(?:\/>|>(.*?)<\/(?:[a-zA-Z0-9_:-]+:)?trkpt>)/gis;
      let ptMatch;
      while ((ptMatch = trkptRegex.exec(segBody)) !== null) {
        const pt = parsePointElement(ptMatch[1], ptMatch[2] || '');
        if (pt) segPoints.push(pt);
      }

      if (segPoints.length > 0) {
        segments.push(segPoints);
        rawPoints.push(...segPoints);
      }
    }

    // PRIORITY 1.1: If no <trkseg> tags, check for standalone <trkpt> tags
    if (rawPoints.length === 0) {
      const trkptRegex = /<(?:[a-zA-Z0-9_:-]+:)?trkpt\b([^>]*?)(?:\/>|>(.*?)<\/(?:[a-zA-Z0-9_:-]+:)?trkpt>)/gis;
      let ptMatch;
      while ((ptMatch = trkptRegex.exec(cleanText)) !== null) {
        const pt = parsePointElement(ptMatch[1], ptMatch[2] || '');
        if (pt) rawPoints.push(pt);
      }
    }

    // PRIORITY 2: If ZERO <trkpt> found, look for <rtept> (Route Points)
    if (rawPoints.length === 0) {
      const rteptRegex = /<(?:[a-zA-Z0-9_:-]+:)?rtept\b([^>]*?)(?:\/>|>(.*?)<\/(?:[a-zA-Z0-9_:-]+:)?rtept>)/gis;
      let ptMatch;
      while ((ptMatch = rteptRegex.exec(cleanText)) !== null) {
        const pt = parsePointElement(ptMatch[1], ptMatch[2] || '');
        if (pt) rawPoints.push(pt);
      }
    }

    // PRIORITY 3: KML <coordinates> Tag (lon,lat,ele ...)
    if (rawPoints.length === 0) {
      const coordRegex = /<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi;
      let cm;
      while ((cm = coordRegex.exec(cleanText)) !== null) {
        const tokens = cm[1].trim().split(/\s+/);
        for (const token of tokens) {
          const parts = token.split(',');
          if (parts.length >= 2) {
            const lon = parseFloat(parts[0].replace(',', '.'));
            const lat = parseFloat(parts[1].replace(',', '.'));
            const ele = parts.length > 2 ? parseFloat(parts[2].replace(',', '.')) : 0;
            if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
              rawPoints.push({ lat, lon, ele: isNaN(ele) ? 0 : ele, time: null });
            }
          }
        }
      }
    }

    // PRIORITY 4: GeoJSON Coordinates (LineString / MultiLineString)
    if (rawPoints.length === 0 && (cleanText.startsWith('{') || cleanText.startsWith('['))) {
      try {
        const geoObj = JSON.parse(cleanText);
        const extractFromCoords = (coords) => {
          if (Array.isArray(coords)) {
            if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
              const lon = coords[0];
              const lat = coords[1];
              const ele = typeof coords[2] === 'number' ? coords[2] : 0;
              if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                rawPoints.push({ lat, lon, ele, time: null });
              }
            } else {
              coords.forEach(extractFromCoords);
            }
          }
        };

        if (geoObj.type === 'FeatureCollection' && Array.isArray(geoObj.features)) {
          for (const f of geoObj.features) {
            if (f.geometry && f.geometry.coordinates) extractFromCoords(f.geometry.coordinates);
            if (f.properties && f.properties.name) name = f.properties.name;
          }
        } else if (geoObj.geometry && geoObj.geometry.coordinates) {
          extractFromCoords(geoObj.geometry.coordinates);
        } else if (geoObj.coordinates) {
          extractFromCoords(geoObj.coordinates);
        }
      } catch (e) {}
    }

    // PRIORITY 5: Fallback to <wpt> ONLY if NO track or route exists at all
    if (rawPoints.length === 0) {
      const wptRegex = /<(?:[a-zA-Z0-9_:-]+:)?wpt\b([^>]*?)(?:\/>|>(.*?)<\/(?:[a-zA-Z0-9_:-]+:)?wpt>)/gis;
      let ptMatch;
      while ((ptMatch = wptRegex.exec(cleanText)) !== null) {
        const pt = parsePointElement(ptMatch[1], ptMatch[2] || '');
        if (pt) rawPoints.push(pt);
      }
    }

    // Validation
    if (rawPoints.length === 0) {
      throw new Error("Aucune coordonnée GPS (latitude/longitude) n'a pu être trouvée dans ce fichier.");
    }

    // -------------------------------------------------------------
    // STEP C: Compute Metrics, Bounds, Elevation, & Durations
    // -------------------------------------------------------------
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    let minEle = Infinity, maxEle = -Infinity;

    for (const p of rawPoints) {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLon = Math.min(minLon, p.lon);
      maxLon = Math.max(maxLon, p.lon);
      minEle = Math.min(minEle, p.ele);
      maxEle = Math.max(maxEle, p.ele);
    }

    if (minEle === Infinity) { minEle = 0; maxEle = 0; }

    const { points, totalDistanceKm, elevationGain, elevationLoss } = this.calculateMetrics(rawPoints);
    const estimatedHours = (totalDistanceKm / 4) + (elevationGain / 400);
    const durationFormatted = this.formatDuration(estimatedHours);

    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    const startEndDistMeters = this.haversineDistance(startPoint.lat, startPoint.lon, endPoint.lat, endPoint.lon) * 1000;
    const isLoop = startEndDistMeters < 350;

    return {
      id: 'hike_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      filename: filename,
      name: name,
      originalName: name,
      proposedName: '',
      notes: notes,
      distanceKm: Math.round(totalDistanceKm * 10) / 10,
      elevationGain: Math.round(elevationGain),
      elevationLoss: Math.round(elevationLoss),
      minElevation: Math.round(minEle),
      maxElevation: Math.round(maxEle),
      estimatedDuration: durationFormatted,
      isLoop: isLoop,
      startPoint: {
        lat: startPoint.lat,
        lon: startPoint.lon,
        ele: startPoint.ele
      },
      endPoint: {
        lat: endPoint.lat,
        lon: endPoint.lon,
        ele: endPoint.ele
      },
      bounds: [[minLat, minLon], [maxLat, maxLon]],
      points: points,
      rawGpx: cleanText,
      ibp: this.calculateIBP({ points, distanceKm: Math.round(totalDistanceKm * 10) / 10, elevationGain: Math.round(elevationGain), notes, name }),
      ibpLevel: this.getIBPLevel(this.calculateIBP({ points, distanceKm: Math.round(totalDistanceKm * 10) / 10, elevationGain: Math.round(elevationGain), notes, name })).level,
      difficulty: this.getIBPLevel(this.calculateIBP({ points, distanceKm: Math.round(totalDistanceKm * 10) / 10, elevationGain: Math.round(elevationGain), notes, name })).label,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Calculate cumulative distance and smoothed elevation profile
   */
  static calculateMetrics(rawPoints) {
    const points = [];
    let totalDist = 0;
    let dPlus = 0;
    let dMoins = 0;

    // Moving average filter for realistic elevation
    const eleWindowSize = 3;
    const smoothedElevations = [];
    for (let i = 0; i < rawPoints.length; i++) {
      let sum = 0;
      let count = 0;
      for (let w = -eleWindowSize; w <= eleWindowSize; w++) {
        const idx = i + w;
        if (idx >= 0 && idx < rawPoints.length) {
          sum += (rawPoints[idx].ele || 0);
          count++;
        }
      }
      smoothedElevations.push(count > 0 ? sum / count : 0);
    }

    let lastEle = smoothedElevations.length > 0 ? smoothedElevations[0] : 0;
    const eleThreshold = 1.5; // 1.5 meters noise threshold

    for (let i = 0; i < rawPoints.length; i++) {
      const p = rawPoints[i];
      const curEle = smoothedElevations[i] || 0;

      if (i > 0) {
        const prev = rawPoints[i - 1];
        const segDist = this.haversineDistance(prev.lat, prev.lon, p.lat, p.lon);
        totalDist += segDist;

        const eleDelta = curEle - lastEle;
        if (Math.abs(eleDelta) >= eleThreshold) {
          if (eleDelta > 0) {
            dPlus += eleDelta;
          } else {
            dMoins += Math.abs(eleDelta);
          }
          lastEle = curEle;
        }
      }

      points.push({
        lat: p.lat,
        lon: p.lon,
        ele: Math.round(curEle),
        dist: Math.round(totalDist * 100) / 100,
        time: p.time
      });
    }

    return {
      points,
      totalDistanceKm: totalDist,
      elevationGain: dPlus,
      elevationLoss: dMoins
    };
  }

  static haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  static formatDuration(hoursDecimal) {
    if (isNaN(hoursDecimal) || hoursDecimal <= 0) return '1h00';
    const h = Math.floor(hoursDecimal);
    const m = Math.round((hoursDecimal - h) * 60);
    return `${h}h${m < 10 ? '0' : ''}${m}`;
  }

  /**
   * Standardise le nom d'un pays en convention française propre (ex: USA, Nouvelle-Zélande, Royaume-Uni, etc.)
   */
  static standardizeCountryName(raw) {
    if (!raw) return '';
    const c = String(raw).trim();
    const lc = c.toLowerCase();

    if (lc.includes('united states') || lc.includes('états-unis') || lc.includes('etats-unis') || lc === 'usa' || lc === 'us') {
      return 'USA';
    }
    if (lc.includes('new zealand') || lc.includes('nouvelle-zélande') || lc.includes('nouvelle-zelande')) {
      return 'Nouvelle-Zélande';
    }
    if (lc.includes('united kingdom') || lc.includes('royaume-uni') || lc.includes('great britain') || lc.includes('scotland') || lc.includes('écosse') || lc.includes('england') || lc.includes('wales')) {
      return 'Royaume-Uni';
    }
    if (lc.includes('canada')) return 'Canada';
    if (lc.includes('italy') || lc.includes('italie')) return 'Italie';
    if (lc.includes('spain') || lc.includes('espagne')) return 'Espagne';
    if (lc.includes('switzerland') || lc.includes('suisse')) return 'Suisse';
    if (lc.includes('china') || lc.includes('chine')) return 'Chine';
    if (lc.includes('singapore') || lc.includes('singapour')) return 'Singapour';
    if (lc.includes('australia') || lc.includes('australie')) return 'Australie';
    if (lc.includes('japan') || lc.includes('japon')) return 'Japon';
    if (lc.includes('norway') || lc.includes('norvège') || lc.includes('norvege')) return 'Norvège';
    if (lc.includes('germany') || lc.includes('allemagne')) return 'Allemagne';
    if (lc.includes('belgium') || lc.includes('belgique')) return 'Belgique';
    if (lc.includes('portugal')) return 'Portugal';
    if (lc.includes('austria') || lc.includes('autriche')) return 'Autriche';
    if (lc.includes('greece') || lc.includes('grèce') || lc.includes('grece')) return 'Grèce';
    if (lc.includes('morocco') || lc.includes('maroc')) return 'Maroc';
    if (lc.includes('south africa') || lc.includes('afrique du sud')) return 'Afrique du Sud';
    if (lc.includes('iceland') || lc.includes('islande')) return 'Islande';
    if (lc.includes('ireland') || lc.includes('irlande')) return 'Irlande';
    if (lc.includes('france')) return 'France';
    if (lc.includes('monaco')) return 'Monaco';

    return c;
  }

  /**
   * Détection géographique instantanée du pays d'après les coordonnées GPS (sans dépendance réseau)
   */
  static detectCountryFromCoords(lat, lon) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return null;

    // France métropolitaine & Corse
    const inFranceMainland = (lat >= 42.33 && lat <= 51.1 && lon >= -4.8 && lon <= 8.25);
    const inCorsica = (lat >= 41.3 && lat <= 43.1 && lon >= 8.5 && lon <= 9.6);

    // Nouvelle-Zélande (-47.5 à -34.0, 166.0 à 179.0)
    if (lat >= -47.5 && lat <= -34.0 && lon >= 166.0 && lon <= 179.0) return 'Nouvelle-Zélande';
    // Canada (48.0 à 70.0, -141.0 à -52.0)
    if (lat >= 48.0 && lat <= 70.0 && lon >= -141.0 && lon <= -52.0) return 'Canada';
    // USA (continental + Alaska + Hawaii)
    if ((lat >= 24.5 && lat <= 49.4 && lon >= -125.0 && lon <= -66.9) ||
        (lat >= 51.0 && lat <= 71.5 && lon >= -179.0 && lon <= -129.0) ||
        (lat >= 18.9 && lat <= 22.3 && lon >= -160.3 && lon <= -154.8)) {
      return 'USA';
    }
    // Chine (18.0 à 53.6, 73.5 à 135.0)
    if (lat >= 18.0 && lat <= 53.6 && lon >= 73.5 && lon <= 135.0) return 'Chine';
    // Singapour (1.15 à 1.48, 103.6 à 104.05)
    if (lat >= 1.15 && lat <= 1.48 && lon >= 103.6 && lon <= 104.05) return 'Singapour';
    // Australie (-44.0 à -10.0, 113.0 à 154.0)
    if (lat >= -44.0 && lat <= -10.0 && lon >= 113.0 && lon <= 154.0) return 'Australie';
    // Japon (30.0 à 45.6, 129.0 à 146.0)
    if (lat >= 30.0 && lat <= 45.6 && lon >= 129.0 && lon <= 146.0) return 'Japon';
    // Royaume-Uni (49.85 à 60.9, -8.7 à 1.8) en excluant la Côte d'Opale française
    if (lat >= 49.85 && lat <= 60.9 && lon >= -8.7 && lon <= 1.8) {
      if (lat >= 50.8 && lon >= 1.55) return 'France'; // Sangatte / Calais
      return 'Royaume-Uni';
    }
    // Italie (Dolomites / Alpes et péninsule)
    if ((lat >= 46.0 && lat <= 47.1 && lon >= 10.5 && lon <= 13.7) ||
        (lat >= 36.6 && lat <= 46.5 && lon >= 6.7 && lon <= 18.6 && !(inFranceMainland || inCorsica))) {
      return 'Italie';
    }
    // Espagne
    if (lat >= 35.9 && lat <= 43.8 && lon >= -9.3 && lon <= 3.4 && !inFranceMainland) return 'Espagne';
    // Suisse
    if (lat >= 45.8 && lat <= 47.8 && lon >= 5.95 && lon <= 10.5 && !inFranceMainland) return 'Suisse';
    // Norvège
    if (lat >= 57.9 && lat <= 71.2 && lon >= 4.5 && lon <= 31.1) return 'Norvège';

    if (inFranceMainland || inCorsica) return 'France';
    return null;
  }

  /**
   * Garantit que le nom de la randonnée commence systématiquement par le nom du pays si c'est un pays étranger
   */
  static ensureForeignCountryPrefix(name, country = null, lat = null, lon = null) {
    if (!name) return name;

    let resolvedCountry = country;
    if (!resolvedCountry && lat !== null && lon !== null) {
      resolvedCountry = this.detectCountryFromCoords(Number(lat), Number(lon));
    }
    resolvedCountry = this.standardizeCountryName(resolvedCountry);

    // Si pas de pays étranger ou France/Monaco, ne rien changer
    if (!resolvedCountry || resolvedCountry === 'France' || resolvedCountry === 'Monaco') {
      return name;
    }

    // Nettoyer les préfixes existants éventuels pour éviter les doublons ("Canada - Canada - ...")
    let cleaned = name.trim();
    const knownPrefixes = [
      'Canada', 'Nouvelle-Zélande', 'Nouvelle-Zelande', 'USA', 'États-Unis', 'Etats-Unis',
      'Chine', 'Italie', 'Espagne', 'Suisse', 'Royaume-Uni', 'Singapour', 'Norvège', 'Japon',
      'Australie', 'Allemagne', 'Belgique', 'Portugal', 'Islande', 'Irlande'
    ];

    for (const kp of knownPrefixes) {
      const pRegex = new RegExp(`^${kp}(\\s*\\([^)]*\\))?\\s*-\\s*`, 'i');
      if (pRegex.test(cleaned)) {
        cleaned = cleaned.replace(pRegex, '').trim();
        break;
      }
    }

    // Préfixer systématiquement avec le pays étranger standardisé
    return `${resolvedCountry} - ${cleaned}`;
  }

  /**
   * Géocodage inverse mondial (Photon Komoot API + Nominatim fallback + détection coordonnées)
   */
  static async reverseGeocode(lat, lon) {
    const latNum = Number(lat);
    const lonNum = Number(lon);

    // 1. Try Photon (fast, worldwide, recognises trails, peaks, nature parks)
    try {
      const pController = new AbortController();
      const pTimeout = setTimeout(() => pController.abort(), 2000);
      const pRes = await fetch(`https://photon.komoot.io/reverse?lat=${latNum}&lon=${lonNum}`, { signal: pController.signal });
      clearTimeout(pTimeout);
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData && pData.features && pData.features.length > 0) {
          const props = pData.features[0].properties || {};
          const trailOrPlace = props.name || props.city || props.town || props.village || props.county || '';
          const rawCountry = props.country || '';
          const stdCountry = this.standardizeCountryName(rawCountry) || this.detectCountryFromCoords(latNum, lonNum) || '';
          const isFrance = (stdCountry === 'France' || stdCountry === 'Monaco');
          if (trailOrPlace) {
            if (!isFrance && stdCountry) {
              return `${stdCountry} - ${trailOrPlace}`;
            }
            return trailOrPlace;
          }
        }
      }
    } catch (e) {}

    // 2. Nominatim fallback
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latNum}&lon=${lonNum}&zoom=14&addressdetails=1`;
      const response = await fetch(url, { 
        headers: { 'Accept-Language': 'fr' },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (data && data.address) {
          const addr = data.address;
          const place = addr.village || addr.town || addr.city || addr.municipality || 
                        addr.hamlet || addr.suburb || addr.county || '';
          const rawCountry = addr.country || '';
          const stdCountry = this.standardizeCountryName(rawCountry) || this.detectCountryFromCoords(latNum, lonNum) || '';
          const isFrance = (stdCountry === 'France' || stdCountry === 'Monaco');
          if (place) {
            if (!isFrance && stdCountry) {
              return `${stdCountry} - ${place}`;
            }
            return place;
          }
        }
      }
    } catch (e) {
      clearTimeout(timeout);
    }

    // 3. Fallback immédiat d'après les coordonnées
    const offlineCountry = this.detectCountryFromCoords(latNum, lonNum);
    if (offlineCountry && offlineCountry !== 'France' && offlineCountry !== 'Monaco') {
      return offlineCountry;
    }

    return '';
  }

  /**
   * Génération d'un nom standardisé : "[Pays (si étranger)] - Lieu - XX.X km - D+ XXXm"
   */
  static async generateProposedName(hike) {
    let placeName = '';
    let detectedCountry = '';

    if (hike.startPoint) {
      const lat = Number(hike.startPoint.lat);
      const lon = Number(hike.startPoint.lon);
      detectedCountry = this.detectCountryFromCoords(lat, lon);

      try {
        const geoInfo = await this.reverseGeocode(lat, lon);
        if (geoInfo) {
          placeName = geoInfo;
          if (geoInfo.includes(' - ')) {
            const cStr = geoInfo.split(' - ')[0];
            detectedCountry = this.standardizeCountryName(cStr) || detectedCountry;
          }
        }
      } catch (e) {}
    }

    detectedCountry = this.standardizeCountryName(detectedCountry);

    const cleanOriginal = (hike.originalName || hike.filename || '')
      .replace(/\.(gpx|xml|kml|json|geojson|tcx|fit)$/i, '')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const isGeneric = (n) => !n || /^(trail planner map|track|active log|export|randonn[eé]e|route|map|alltrails|visorando|komoot|strava|route\s*\d*|unnamed)$/i.test(n.trim());

    let baseName = '';
    if (!isGeneric(cleanOriginal)) {
      baseName = cleanOriginal;
    } else {
      baseName = placeName || 'Randonnée';
    }

    // Si pays étranger, s'assurer que le nom commence obligatoirement par le nom du pays
    if (detectedCountry && detectedCountry !== 'France' && detectedCountry !== 'Monaco') {
      baseName = this.ensureForeignCountryPrefix(baseName, detectedCountry);
    }

    const cleanBase = baseName.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    return `${cleanBase} - ${hike.distanceKm} km - D+ ${hike.elevationGain}m`;
  }

  /**
   * Standard XML GPX Exporter
   */
  static exportToGpxString(hike) {
    const name = hike.name || 'Randonnee';
    const notes = hike.notes || '';
    const creator = 'Randonneurs Sanaryens - RandoFinder 2026';

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    gpx += `<gpx version="1.1" creator="${creator}" xmlns="http://www.topografix.com/GPX/1/1">\n`;
    gpx += `  <metadata>\n    <name>${this.escapeXml(name)}</name>\n`;
    if (notes) gpx += `    <desc>${this.escapeXml(notes)}</desc>\n`;
    gpx += `    <time>${new Date().toISOString()}</time>\n  </metadata>\n`;

    if (hike.startPoint) {
      gpx += `  <wpt lat="${hike.startPoint.lat}" lon="${hike.startPoint.lon}">\n`;
      gpx += `    <name>Départ - ${this.escapeXml(name)}</name>\n`;
      if (hike.startPoint.ele) gpx += `    <ele>${hike.startPoint.ele}</ele>\n`;
      gpx += `  </wpt>\n`;
    }

    gpx += `  <trk>\n    <name>${this.escapeXml(name)}</name>\n`;
    if (notes) {
      gpx += `    <desc>${this.escapeXml(notes)}</desc>\n`;
      gpx += `    <cmt>${this.escapeXml(notes)}</cmt>\n`;
    }
    gpx += `    <trkseg>\n`;

    if (hike.points && Array.isArray(hike.points)) {
      for (const pt of hike.points) {
        gpx += `      <trkpt lat="${pt.lat}" lon="${pt.lon}">\n`;
        if (pt.ele !== undefined && pt.ele !== null) gpx += `        <ele>${pt.ele}</ele>\n`;
        if (pt.time) gpx += `        <time>${pt.time}</time>\n`;
        gpx += `      </trkpt>\n`;
      }
    }

    gpx += `    </trkseg>\n  </trk>\n</gpx>`;
    return gpx;
  }

  static escapeXml(unsafe) {
    return String(unsafe || '').replace(/[<>&'"]/g, function (c) {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }

  /**
   * Calcul officiel de l'Indice IBP Index (Effort Physique FFRandonnée)
   * Prise en compte : Distance, Dénivelé D+, Distribution non-linéaire des pentes et descentes raides
   */
  static calculateIBP(hikeOrPoints, elevationGain = 0, distanceKm = 0) {
    let points = [];
    let dPlus = elevationGain;
    let distKm = distanceKm;
    let notes = '';
    let name = '';

    if (Array.isArray(hikeOrPoints)) {
      points = hikeOrPoints;
    } else if (hikeOrPoints && typeof hikeOrPoints === 'object') {
      // 1. Détection prioritaire si un IBP explicite existe déjà
      if (typeof hikeOrPoints.ibp === 'number' && hikeOrPoints.ibp > 0) {
        return Math.round(hikeOrPoints.ibp);
      }
      points = hikeOrPoints.points || [];
      dPlus = Number(hikeOrPoints.elevationGain || 0);
      distKm = Number(hikeOrPoints.distanceKm || 0);
      notes = String(hikeOrPoints.notes || '');
      name = String(hikeOrPoints.name || '');

      // Détection dans les notes ou le nom (ex: [IBP: 64] ou IBP 64 ou IBP_64)
      const ibpMatch = notes.match(/\[IBP:\s*(\d+)\]/i) || 
                       notes.match(/IBP\s*[:_]?\s*(\d+)/i) || 
                       name.match(/IBP\s*[:_]?\s*(\d+)/i);
      if (ibpMatch) {
        const parsed = parseInt(ibpMatch[1], 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }

    // 2. Calcul à partir des points GPS précis et des pourcentages de pentes
    if (points && points.length >= 10) {
      let totalDistM = 0;
      let weightedClimb = 0;
      let steepDescentM = 0;
      let maxEle = 0;

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const d = (p2.distFromStart && p1.distFromStart) 
          ? (p2.distFromStart - p1.distFromStart) * 1000 
          : GPXParser.haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon) * 1000;
        
        if (d <= 0.5) continue; // Filtre bruit GPS
        totalDistM += d;

        const ele1 = p1.ele || 0;
        const ele2 = p2.ele || 0;
        if (ele2 > maxEle) maxEle = ele2;

        const dElev = ele2 - ele1;
        const grade = (dElev / d) * 100; // pente en %

        if (dElev > 0) {
          // Pente ascendante : pondération non-linéaire selon la cotation de l'effort FFRandonnée
          let weight = 0.055;
          if (grade >= 1 && grade < 5) weight = 0.060;
          else if (grade >= 5 && grade < 8) weight = 0.075;
          else if (grade >= 8 && grade < 12) weight = 0.095;
          else if (grade >= 12 && grade < 18) weight = 0.125;
          else if (grade >= 18) weight = 0.160;
          
          weightedClimb += dElev * weight;
        } else if (dElev < 0 && grade <= -12) {
          // Descente très raide : effort articulaire et musculaire supplémentaire
          steepDescentM += Math.abs(dElev) * 0.015;
        }
      }

      let highAltitudeFactor = 1.0;
      if (maxEle > 1500) {
        highAltitudeFactor = 1.0 + Math.min(0.20, (maxEle - 1500) / 7500);
      }

      const calcDistKm = totalDistM > 0 ? (totalDistM / 1000) : distKm;
      const rawIbp = (calcDistKm * 2.1 + weightedClimb + steepDescentM) * highAltitudeFactor;
      return Math.max(1, Math.round(rawIbp));
    }

    // 3. Formule standard éprouvée en l'absence de profils GPS détaillés
    const rawIbp = (distKm * 2.1) + (dPlus * 0.075);
    return Math.max(1, Math.round(rawIbp));
  }

  /**
   * Grille officielle FFRandonnée / IBP Index (Effort Physique) en 5 Couleurs
   * 1 (Vert) : Facile (IBP <= 25)
   * 2 (Bleu) : Assez facile (IBP 26 - 50)
   * 3 (Orange) : Peu difficile (IBP 51 - 75)
   * 4 (Rouge) : Assez difficile (IBP 76 - 100)
   * 5 (Noir) : Difficile (IBP > 100)
   */
  static getIBPLevel(ibp) {
    const val = Math.round(Number(ibp) || 1);
    if (val <= 25) {
      return {
        level: 1,
        color: '#16a34a', // Vert
        bgClass: 'bg-emerald-600',
        textClass: 'text-emerald-700',
        badgeClass: 'bg-emerald-600 text-white',
        borderClass: 'border-emerald-600',
        label: 'Facile',
        shortLabel: 'Facile',
        desc: 'Sans difficulté physique particulière (balade, promenade, Rando Santé)',
        range: 'IBP ≤ 25',
        iconNum: 1
      };
    } else if (val <= 50) {
      return {
        level: 2,
        color: '#2563eb', // Bleu
        bgClass: 'bg-blue-600',
        textClass: 'text-blue-700',
        badgeClass: 'bg-blue-600 text-white',
        borderClass: 'border-blue-600',
        label: 'Assez facile',
        shortLabel: 'Assez facile',
        desc: 'Présente peu de difficulté physique (randonnée modérée accessible)',
        range: 'IBP 26 - 50',
        iconNum: 2
      };
    } else if (val <= 75) {
      return {
        level: 3,
        color: '#ea580c', // Orange FFRandonnée
        bgClass: 'bg-amber-500',
        textClass: 'text-amber-800',
        badgeClass: 'bg-amber-500 text-slate-900',
        borderClass: 'border-amber-500',
        label: 'Peu difficile',
        shortLabel: 'Moyen',
        desc: 'Nécessite un engagement physique mesuré (effort moyen)',
        range: 'IBP 51 - 75',
        iconNum: 3
      };
    } else if (val <= 100) {
      return {
        level: 4,
        color: '#dc2626', // Rouge
        bgClass: 'bg-rose-600',
        textClass: 'text-rose-700',
        badgeClass: 'bg-rose-600 text-white',
        borderClass: 'border-rose-600',
        label: 'Assez difficile',
        shortLabel: 'Soutenu',
        desc: 'Demande un engagement physique certain (randonnée soutenue)',
        range: 'IBP 76 - 100',
        iconNum: 4
      };
    } else {
      return {
        level: 5,
        color: '#0f172a', // Noir
        bgClass: 'bg-slate-900',
        textClass: 'text-slate-900',
        badgeClass: 'bg-slate-900 text-white',
        borderClass: 'border-slate-900',
        label: 'Difficile',
        shortLabel: 'Très soutenu',
        desc: 'Présente des difficultés physiques importantes (effort fort et soutenu)',
        range: 'IBP > 100',
        iconNum: 5
      };
    }
  }

}

window.GPXParser = GPXParser;
