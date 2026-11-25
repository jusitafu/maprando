/**
 * Ultra-Fast High-Performance Elevation Profile Chart
 * Les Randonneurs Sanaryens - JLD Apps 2026
 * Distinct, authentic topographic relief profiles with interactive cursor synchronization
 */

class ElevationProfile {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = typeof document !== 'undefined' ? document.getElementById(containerId) : null;
    this.currentHike = null;
    this.onHoverCallback = null;
    this.onLeaveCallback = null;
    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        if (this.currentHike && this.canvas) {
          this.resizeAndDraw();
        }
      }, { passive: true });
    }
  }

  ensureCanvas() {
    if (!this.container) {
      this.container = document.getElementById(this.containerId);
    }
    if (!this.container) return false;

    if (!this.canvas) {
      this.container.innerHTML = '';
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'w-full h-full cursor-crosshair block';
      this.container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d', { alpha: true });

      // Attach interaction listeners ONCE
      this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e), { passive: true });
      this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave(), { passive: true });
      this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
      this.canvas.addEventListener('touchend', () => this.handleMouseLeave(), { passive: true });
      this.canvas.addEventListener('click', () => {
        if (window.App) window.App.isHikePinned = true;
      });
    }

    return true;
  }

  render(hike, onHover = null, onLeave = null) {
    if (!hike) return;

    // Assurer que les points ont leurs distances cumulées calculées
    if (hike.points && hike.points.length > 0 && typeof hike.points[0].dist === 'undefined') {
      let cumulative = 0;
      hike.points[0].dist = 0;
      for (let i = 1; i < hike.points.length; i++) {
        const p1 = hike.points[i - 1];
        const p2 = hike.points[i];
        const p1Lon = p1.lon !== undefined ? p1.lon : p1.lng;
        const p2Lon = p2.lon !== undefined ? p2.lon : p2.lng;
        const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
        const dLon = ((p2Lon - p1Lon) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((p1.lat * Math.PI) / 180) * Math.cos((p2.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        cumulative += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        p2.dist = Math.round(cumulative * 100) / 100;
      }
      if (!hike.distanceKm) {
        hike.distanceKm = Math.round(cumulative * 10) / 10;
      }
    }

    if (!hike.distanceKm && hike.distance) {
      hike.distanceKm = parseFloat(hike.distance) || 0;
    }
    if ((!hike.minElevation || !hike.maxElevation) && hike.points && hike.points.length > 0) {
      let minE = Infinity, maxE = -Infinity;
      hike.points.forEach(p => {
        if (p.ele != null) {
          if (p.ele < minE) minE = p.ele;
          if (p.ele > maxE) maxE = p.ele;
        }
      });
      if (minE !== Infinity) {
        hike.minElevation = Math.round(minE);
        hike.maxElevation = Math.round(maxE);
      }
    }

    this.currentHike = hike;
    this.onHoverCallback = onHover;
    this.onLeaveCallback = onLeave;

    if (!this.ensureCanvas()) return;

    if (!hike || !hike.points || hike.points.length === 0) {
      if (this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      return;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Rendu synchrone direct préservant le curseur actif
    this.resizeAndDraw(this.cursorDist);

    // Détection automatique d'un GPX sans altitudes (profil plat à 0 m) -> enrichissement auto IGN RGE Alti
    const allZeroEle = hike.points.length >= 2 && hike.points.every(p => !p.ele || Math.abs(Number(p.ele)) < 0.5);
    if (allZeroEle && !hike._eleEnrichAttempted) {
      hike._eleEnrichAttempted = true;
      this.autoEnrichZeroElevation(hike);
    }
  }

  /**
   * Récupère automatiquement les altitudes réelles (IGN RGE Alti / Open-Meteo)
   * lorsqu'un fichier GPX chargé ne contient pas d'altitudes (tout à 0 m).
   */
  async autoEnrichZeroElevation(hike) {
    if (!hike || !hike.points || hike.points.length < 2) return;
    try {
      const pts = hike.points;
      const maxSamples = 60;
      const sampleStep = Math.max(1, Math.floor((pts.length - 1) / (maxSamples - 1)));
      const sampleIndices = [];
      for (let i = 0; i < pts.length; i += sampleStep) sampleIndices.push(i);
      if (sampleIndices[sampleIndices.length - 1] !== pts.length - 1) {
        sampleIndices.push(pts.length - 1);
      }

      const getLon = (p) => Number(p.lon !== undefined ? p.lon : p.lng);
      let fetchedEles = null;

      // 1) IGN Géoplateforme RGE Alti
      try {
        const lons = sampleIndices.map(i => getLon(pts[i]).toFixed(5)).join('|');
        const lats = sampleIndices.map(i => Number(pts[i].lat).toFixed(5)).join('|');
        const url = `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=${lons}&lat=${lats}&resource=ign_rge_alti_wld&zonly=true`;
        const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (resp.ok) {
          const data = await resp.json();
          const eles = data.elevations || [];
          if (eles.length === sampleIndices.length && eles.some(z => typeof z === 'number' && z > -500 && z !== -99999)) {
            fetchedEles = eles.map(z => (typeof z === 'number' && z > -500 && z !== -99999) ? Math.round(z * 10) / 10 : null);
          }
        }
      } catch (e) {}

      // 2) Fallback mondial Open-Meteo
      if (!fetchedEles) {
        try {
          const latsC = sampleIndices.map(i => Number(pts[i].lat).toFixed(5)).join(',');
          const lonsC = sampleIndices.map(i => getLon(pts[i]).toFixed(5)).join(',');
          const omUrl = `https://api.open-meteo.com/v1/elevation?latitude=${latsC}&longitude=${lonsC}`;
          const resp = await fetch(omUrl);
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data.elevation) && data.elevation.length === sampleIndices.length) {
              fetchedEles = data.elevation.map(z => (typeof z === 'number' && !isNaN(z)) ? Math.round(z * 10) / 10 : null);
            }
          }
        } catch (e) {}
      }

      if (!fetchedEles) return;

      let lastValid = fetchedEles.find(z => z !== null) || 0;
      for (let k = 0; k < sampleIndices.length; k++) {
        if (fetchedEles[k] !== null) lastValid = fetchedEles[k];
        pts[sampleIndices[k]].ele = lastValid;
      }
      for (let k = 0; k < sampleIndices.length - 1; k++) {
        const i1 = sampleIndices[k];
        const i2 = sampleIndices[k + 1];
        const z1 = pts[i1].ele;
        const z2 = pts[i2].ele;
        for (let j = i1 + 1; j < i2; j++) {
          const ratio = (j - i1) / (i2 - i1);
          pts[j].ele = Math.round((z1 + ratio * (z2 - z1)) * 10) / 10;
        }
      }

      // Recalculer D+, D-, min, max (avec lissage anti-bruit 4m)
      let dPlus = 0, dMoins = 0, minE = Infinity, maxE = -Infinity;
      let refEle = pts[0].ele;
      for (let i = 0; i < pts.length; i++) {
        const z = pts[i].ele;
        if (z < minE) minE = z;
        if (z > maxE) maxE = z;
        const diff = z - refEle;
        if (diff >= 4) { dPlus += diff; refEle = z; }
        else if (diff <= -4) { dMoins += Math.abs(diff); refEle = z; }
      }
      hike.elevationGain = Math.round(dPlus);
      hike.elevationLoss = Math.round(dMoins);
      hike.minElevation = Math.round(minE);
      hike.maxElevation = Math.round(maxE);

      // Mettre à jour l'interface si cette randonnée est toujours affichée
      if (this.currentHike === hike) {
        const elDplus = document.getElementById('preview-dplus');
        const elDmoins = document.getElementById('preview-dmoins');
        const elAlt = document.getElementById('preview-alt');
        if (elDplus) elDplus.textContent = `+${hike.elevationGain} m`;
        if (elDmoins) elDmoins.textContent = `-${hike.elevationLoss} m`;
        if (elAlt) elAlt.textContent = `${hike.minElevation}m / ${hike.maxElevation}m`;
        this.resizeAndDraw(this.cursorDist);
      }
      if (window.MapManagerInstance && typeof window.MapManagerInstance.showStandaloneGpxHud === 'function') {
        window.MapManagerInstance.showStandaloneGpxHud();
      }
    } catch (e) {
      console.warn('Auto-enrichissement altimétrique ignoré:', e);
    }
  }

  resizeAndDraw(cursorDist = null) {
    if (!this.canvas || !this.ctx || !this.currentHike) return;
    this.cursorDist = cursorDist;

    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const containerW = rect.width || this.container.clientWidth || this.container.parentElement?.clientWidth || 380;
    const containerH = rect.height || this.container.clientHeight || 112;
    const width = Math.max(50, containerW);
    const height = Math.max(30, containerH);

    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);

    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
    }

    this.ctx.save();
    this.ctx.scale(dpr, dpr);
    this.drawProfile(width, height, cursorDist);
    this.ctx.restore();
  }

  drawProfile(width, height, cursorDist = null) {
    const ctx = this.ctx;
    const hike = this.currentHike;
    if (!hike || !hike.points || hike.points.length === 0) return;

    const points = hike.points;
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 16, right: 18, bottom: 22, left: 40 };
    const chartW = Math.max(1, width - padding.left - padding.right);
    const chartH = Math.max(1, height - padding.top - padding.bottom);

    const maxDist = Math.max(0.1, parseFloat(hike.distanceKm || hike.distance || 0) || (points[points.length - 1]?.dist || 1));
    
    // Extract actual min and max elevation from the points array
    let minEle = Infinity;
    let maxEle = -Infinity;
    for (const p of points) {
      if (p.ele < minEle) minEle = p.ele;
      if (p.ele > maxEle) maxEle = p.ele;
    }
    if (minEle === Infinity) { minEle = hike.minElevation || 0; maxEle = hike.maxElevation || 100; }

    // 12% vertical breathing room so peaks aren't clipped
    const eleSpan = Math.max(25, maxEle - minEle);
    const displayMinEle = Math.floor(Math.max(0, minEle - eleSpan * 0.12));
    const displayMaxEle = Math.ceil(maxEle + eleSpan * 0.12);

    const getX = (dist) => padding.left + (dist / maxDist) * chartW;
    const getY = (ele) => padding.top + chartH - ((ele - displayMinEle) / (displayMaxEle - displayMinEle)) * chartH;

    // 1. Grid lines & Y-axis labels (Altitude)
    ctx.strokeStyle = '#e2e8f0';
    ctx.fillStyle = '#64748b';
    ctx.font = '500 9px Inter, system-ui, sans-serif';
    ctx.lineWidth = 1;

    const ySteps = 3;
    for (let i = 0; i <= ySteps; i++) {
      const eleVal = Math.round(displayMinEle + (i / ySteps) * (displayMaxEle - displayMinEle));
      const y = getY(eleVal);

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillText(eleVal + 'm', padding.left - 4, y + 3);
    }

    // 2. X-axis labels (Distance km)
    ctx.textAlign = 'center';
    const xSteps = Math.min(4, Math.max(2, Math.ceil(maxDist / 2)));
    for (let i = 0; i <= xSteps; i++) {
      const distVal = Math.round((i / xSteps) * maxDist * 10) / 10;
      const x = getX(distVal);
      ctx.fillText(distVal + ' km', x, height - 6);
    }

    // 3. Topographic Gradient area fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.50)');
    gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.20)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)');

    ctx.beginPath();
    ctx.moveTo(getX(points[0].dist), getY(points[0].ele));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(getX(points[i].dist), getY(points[i].ele));
    }
    ctx.lineTo(getX(points[points.length - 1].dist), padding.top + chartH);
    ctx.lineTo(getX(points[0].dist), padding.top + chartH);
    ctx.closePath();

    ctx.fillStyle = gradient;
    ctx.fill();

    // 4. Contour Line (Crisp Mountain Trail Polyline)
    ctx.beginPath();
    ctx.moveTo(getX(points[0].dist), getY(points[0].ele));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(getX(points[i].dist), getY(points[i].ele));
    }
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 5. Peak marker
    let peakPt = points[0];
    for (const p of points) {
      if (p.ele > peakPt.ele) peakPt = p;
    }
    const peakX = getX(peakPt.dist);
    const peakY = getY(peakPt.ele);

    ctx.beginPath();
    ctx.arc(peakX, peakY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#047857';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`▲ Max ${peakPt.ele}m`, Math.min(width - 35, Math.max(50, peakX)), Math.max(12, peakY - 6));

    // 6. Interactive Cursor Indicator (Synchronisé avec la carte)
    if (cursorDist !== null && !isNaN(cursorDist)) {
      const closest = this.findClosestPointByDist(cursorDist);
      if (closest && closest.point) {
        // Utilise la distance exacte interpolée pour un déplacement 100% continu et fluide
        const ptDist = cursorDist;
        const ptEle = closest.point.ele != null ? closest.point.ele : 0;
        const cx = Math.max(padding.left, Math.min(padding.left + chartW, getX(ptDist)));
        const cy = getY(ptEle);

        // Vertical dashed guide line
        ctx.beginPath();
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.moveTo(cx, padding.top);
        ctx.lineTo(cx, padding.top + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated Target Dot
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // High-contrast Tooltip Pill
        const eleVal = closest.point.ele != null ? `${Math.round(closest.point.ele)} m` : '-- m';
        const distVal = closest.point.dist != null ? `${closest.point.dist} km` : `${cursorDist.toFixed(1)} km`;
        const tooltipText = `${eleVal} • ${distVal}`;
        ctx.font = 'bold 11px Inter, system-ui, sans-serif';
        const textWidth = ctx.measureText(tooltipText).width;
        let tooltipX = cx + 8;
        if (tooltipX + textWidth + 8 > width) tooltipX = cx - textWidth - 12;
        let tooltipY = cy - 8;
        if (tooltipY < padding.top + 14) tooltipY = padding.top + 14;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.beginPath();
        ctx.roundRect(tooltipX - 4, tooltipY - 14, textWidth + 10, 18, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(tooltipText, tooltipX + 1, tooltipY);
      }
    }
  }

  handleMouseMove(e) {
    if (!this.canvas || !this.currentHike) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    this.updateCursorFromX(mouseX, rect.width);
  }

  handleTouchMove(e) {
    if (!this.canvas || !this.currentHike || !e.touches[0]) return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    this.updateCursorFromX(touchX, rect.width);
  }

  handleMouseLeave() {
    if (this.currentHike) {
      this.resizeAndDraw(null);
    }
    if (this.onLeaveCallback) {
      this.onLeaveCallback();
    }
  }

  setCursorDist(dist) {
    if (!this.canvas || !this.currentHike) return;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.cursorDist = dist;
    this.resizeAndDraw(dist);
  }

  clearCursor() {
    if (this.currentHike) {
      this.resizeAndDraw(null);
    }
  }

  updateCursorFromX(x, width) {
    const padding = { left: 40, right: 18 };
    const chartW = width - padding.left - padding.right;
    const relativeX = Math.max(0, Math.min(chartW, x - padding.left));
    const maxDist = parseFloat(this.currentHike.distanceKm || this.currentHike.distance || 0) || (this.currentHike.points && this.currentHike.points.length > 0 ? (this.currentHike.points[this.currentHike.points.length - 1].dist || 1) : 1);
    const dist = (relativeX / chartW) * maxDist;

    this.resizeAndDraw(dist);

    const closest = this.findClosestPointByDist(dist);
    if (closest && this.onHoverCallback) {
      this.onHoverCallback(closest.point, closest.index);
    }
  }

  findClosestPointByDist(targetDist) {
    if (!this.currentHike || !this.currentHike.points || this.currentHike.points.length === 0) return null;
    const points = this.currentHike.points;
    const totalKm = parseFloat(this.currentHike.distanceKm || this.currentHike.distance || 0) || (points[points.length - 1]?.dist || 1);

    let closest = points[0];
    let closestIdx = 0;
    const p0Dist = (points[0].dist != null && !isNaN(points[0].dist)) ? points[0].dist : 0;
    let minDiff = Math.abs(p0Dist - targetDist);

    for (let i = 1; i < points.length; i++) {
      const pDist = (points[i].dist != null && !isNaN(points[i].dist)) ? points[i].dist : ((i / Math.max(1, points.length - 1)) * totalKm);
      const diff = Math.abs(pDist - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        closest = points[i];
        closestIdx = i;
      }
    }

    return { point: closest, index: closestIdx };
  }

  /**
   * Generate a PNG Data URL of the elevation profile for PDF export
   */
  generateChartImage(width = 1000, height = 350) {
    return ElevationProfile.renderStaticChart(this.currentHike, width, height);
  }

  /**
   * Render a high-definition static elevation chart on an off-screen canvas
   * @param {Object} hike - Hike object with points or rawGpx
   * @param {number} width - Canvas width in pixels
   * @param {number} height - Canvas height in pixels
   * @returns {string|null} PNG Data URL
   */
  static renderStaticChart(hike, width = 1000, height = 350) {
    if (!hike) return null;

    // 1. Assurer que hike.points existe (sinon parser depuis rawGpx)
    let points = hike.points;
    if ((!points || points.length === 0) && hike.rawGpx && typeof GPXParser !== 'undefined') {
      try {
        const parsed = GPXParser.parse(hike.rawGpx, hike.filename || 'trace.gpx');
        if (parsed.points && parsed.points.length > 0) {
          points = parsed.points;
          hike.points = points;
          if (!hike.distanceKm && parsed.distanceKm) hike.distanceKm = parsed.distanceKm;
          if (!hike.elevationGain && parsed.elevationGain) hike.elevationGain = parsed.elevationGain;
          if (!hike.elevationLoss && parsed.elevationLoss) hike.elevationLoss = parsed.elevationLoss;
          if (!hike.minElevation && parsed.minElevation) hike.minElevation = parsed.minElevation;
          if (!hike.maxElevation && parsed.maxElevation) hike.maxElevation = parsed.maxElevation;
        }
      } catch (e) {
        console.warn("renderStaticChart: parsing rawGpx error", e);
      }
    }

    if (!points || points.length === 0) return null;

    // 2. Vérifier et calculer la distance cumulée si absente sur les points
    if (typeof points[0].dist === 'undefined') {
      let cumulative = 0;
      points[0].dist = 0;
      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        if (typeof GPXParser !== 'undefined' && GPXParser.haversineDistance) {
          cumulative += GPXParser.haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
        } else {
          const R = 6371;
          const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
          const dLon = ((p2.lon - p1.lon) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos((p1.lat * Math.PI) / 180) * Math.cos((p2.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
          cumulative += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
        p2.dist = Math.round(cumulative * 100) / 100;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Fond blanc pur pour le PDF
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Cadre subtil
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    if (ctx.roundRect) {
      ctx.roundRect(0.5, 0.5, width - 1, height - 1, 6);
      ctx.stroke();
    } else {
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    }

    const maxDist = Math.max(0.1, hike.distanceKm || points[points.length - 1].dist || 1);

    // Recherche min / max altitude réels
    let minEle = Infinity;
    let maxEle = -Infinity;
    for (const p of points) {
      const e = typeof p.ele === 'number' ? p.ele : 0;
      if (e < minEle) minEle = e;
      if (e > maxEle) maxEle = e;
    }

    if (minEle === Infinity || (minEle === 0 && maxEle === 0)) {
      minEle = hike.minElevation || 0;
      maxEle = hike.maxElevation || 0;
    }

    // Cas trace plate sans dénivelé significatif
    if (maxEle <= minEle + 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("Altitude constante ou profil non renseigné dans la trace GPS", width / 2, height / 2);
      return canvas.toDataURL('image/png');
    }

    const padding = { top: 32, right: 35, bottom: 32, left: 55 };
    const chartW = Math.max(10, width - padding.left - padding.right);
    const chartH = Math.max(10, height - padding.top - padding.bottom);

    // Marge verticale (12%)
    const eleSpan = Math.max(20, maxEle - minEle);
    const displayMinEle = Math.floor(Math.max(0, minEle - eleSpan * 0.08));
    const displayMaxEle = Math.ceil(maxEle + eleSpan * 0.12);

    const getX = (dist) => padding.left + (dist / maxDist) * chartW;
    const getY = (ele) => padding.top + chartH - ((ele - displayMinEle) / (displayMaxEle - displayMinEle)) * chartH;

    // 1. Grille horizontale & axes Y
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const eleVal = Math.round(displayMinEle + (i / ySteps) * (displayMaxEle - displayMinEle));
      const y = getY(eleVal);

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillText(eleVal + ' m', padding.left - 8, y + 4);
    }

    // 2. Grille verticale & axes X (Distance km)
    ctx.textAlign = 'center';
    const xSteps = Math.min(6, Math.max(3, Math.ceil(maxDist / 3)));
    for (let i = 0; i <= xSteps; i++) {
      const distVal = Math.round((i / xSteps) * maxDist * 10) / 10;
      const x = getX(distVal);

      ctx.beginPath();
      ctx.strokeStyle = '#f8fafc';
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartH);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.fillText(distVal + ' km', x, height - 10);
    }

    // 3. Dégradé de relief émeraude
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
    gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.18)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)');

    ctx.beginPath();
    ctx.moveTo(getX(points[0].dist), getY(points[0].ele));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(getX(points[i].dist), getY(points[i].ele));
    }
    ctx.lineTo(getX(points[points.length - 1].dist), padding.top + chartH);
    ctx.lineTo(getX(points[0].dist), padding.top + chartH);
    ctx.closePath();

    ctx.fillStyle = gradient;
    ctx.fill();

    // 4. Ligne de crête (Polyline verte haute précision)
    ctx.beginPath();
    ctx.moveTo(getX(points[0].dist), getY(points[0].ele));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(getX(points[i].dist), getY(points[i].ele));
    }
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // 5. Point culminant (Sommet)
    let peakPt = points[0];
    for (const p of points) {
      if (p.ele > peakPt.ele) peakPt = p;
    }
    const peakX = getX(peakPt.dist);
    const peakY = getY(peakPt.ele);

    ctx.beginPath();
    ctx.arc(peakX, peakY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#047857';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Badge Sommet
    const peakText = `▲ Max ${Math.round(peakPt.ele)} m`;
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const peakTxtW = ctx.measureText(peakText).width;
    const peakPillX = Math.min(width - padding.right - peakTxtW - 10, Math.max(padding.left + 5, peakX - peakTxtW / 2));
    const peakPillY = Math.max(padding.top + 2, peakY - 10);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    if (ctx.roundRect) {
      ctx.roundRect(peakPillX - 4, peakPillY - 12, peakTxtW + 8, 16, 4);
    } else {
      ctx.rect(peakPillX - 4, peakPillY - 12, peakTxtW + 8, 16);
    }
    ctx.fill();
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#047857';
    ctx.textAlign = 'left';
    ctx.fillText(peakText, peakPillX, peakPillY);

    // 6. Badge D+ / D- en haut à droite
    const dPlus = hike.elevationGain || 0;
    const dMoins = hike.elevationLoss || 0;
    const badgeText = `↗ +${dPlus} m  •  ↘ -${dMoins} m`;
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const badgeW = ctx.measureText(badgeText).width;

    ctx.fillStyle = '#f8fafc';
    if (ctx.roundRect) {
      ctx.roundRect(width - padding.right - badgeW - 14, 8, badgeW + 14, 20, 5);
    } else {
      ctx.rect(width - padding.right - badgeW - 14, 8, badgeW + 14, 20);
    }
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'right';
    ctx.fillText(badgeText, width - padding.right - 7, 22);

    return canvas.toDataURL('image/png');
  }

  /**
   * Impression pleine page du profil altimétrique en format A4 ou A3 Paysage
   * Fonctionne indifféremment depuis "Cartes & Outils" et "Randonner"
   */
  printProfile(format = 'A4') {
    const hike = this.currentHike;
    if (!hike || !hike.points || hike.points.length < 2) {
      alert('Aucun profil altimétrique actif à imprimer.');
      return;
    }

    const fmt = (format === 'A3') ? 'A3' : 'A4';
    const isA3 = fmt === 'A3';
    const canvasW = isA3 ? 2400 : 1800;
    const canvasH = isA3 ? 1320 : 980;

    // Générer l'image haute définition pleine page du profil
    const imgDataUrl = this.buildHighResPrintCanvas(hike, canvasW, canvasH);
    const title = (hike.name || hike.title || 'Profil Altimétrique').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const dist = hike.distanceKm || hike.distance || 0;
    const dPlus = hike.elevationGain || 0;
    const dMoins = hike.elevationLoss || 0;
    const minAlt = hike.minElevation || 0;
    const maxAlt = hike.maxElevation || 0;
    const ibp = hike.ibpIndex ? ` • IBP ${hike.ibpIndex}` : '';
    const dateStr = new Date().toLocaleDateString('fr-FR');

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Veuillez autoriser les fenêtres pop-up pour imprimer le profil altimétrique.');
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>Profil Altimétrique (${fmt} Paysage) - ${title}</title>
        <style id="page-size-style">
          @page { size: ${fmt} landscape; margin: 6mm; }
        </style>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #e2e8f0;
            color: #0f172a;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .no-print {
            width: 100%;
            background: #0f172a;
            color: #ffffff;
            padding: 10px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            position: sticky;
            top: 0;
            z-index: 50;
          }
          .btn {
            padding: 7px 14px;
            border-radius: 10px;
            border: 1px solid #334155;
            font-weight: 800;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.15s;
          }
          .btn-fmt { background: #1e293b; color: #cbd5e1; }
          .btn-fmt.active { background: #0284c7; color: #ffffff; border-color: #38bdf8; }
          .btn-print { background: #10b981; color: #ffffff; border-color: #34d399; }
          .btn-print:hover { background: #059669; }
          .btn-close { background: #7f1d1d; color: #fecaca; border-color: #dc2626; }
          .sheet {
            background: #ffffff;
            width: ${isA3 ? '408mm' : '285mm'};
            height: ${isA3 ? '285mm' : '198mm'};
            margin: 14px auto;
            padding: 6mm 8mm;
            box-shadow: 0 12px 35px rgba(15,23,42,0.2);
            border-radius: 6px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .sheet-header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            border-bottom: 2px solid #059669;
            padding-bottom: 4px;
            margin-bottom: 6px;
          }
          .sheet-title { font-size: 16px; font-weight: 900; color: #0f172a; }
          .sheet-sub { font-size: 11px; color: #475569; margin-top: 2px; font-weight: 600; }
          .stats-pills { display: flex; gap: 8px; }
          .pill {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 3px 9px;
            font-size: 11px;
            font-weight: 800;
            color: #0f172a;
          }
          .pill-green { background: #ecfdf5; border-color: #6ee7b7; color: #047857; }
          .pill-red { background: #fff1f2; border-color: #fda4af; color: #be123c; }
          .chart-wrap {
            flex: 1;
            width: 100%;
            min-height: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            background: #ffffff;
            padding: 4px;
            overflow: hidden;
          }
          .chart-wrap img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
          }
          .sheet-footer {
            display: flex;
            justify-content: space-between;
            font-size: 9.5px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 4px;
            margin-top: 6px;
          }
          @media print {
            body { background: #ffffff !important; }
            .no-print { display: none !important; }
            .sheet {
              width: 100% !important;
              height: 100vh !important;
              margin: 0 !important;
              padding: 2mm !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <div style="font-weight: 900; font-size: 13px;">📈 Impression Profil Altimétrique Pleine Page • <span id="lbl-fmt">${fmt} Paysage</span></div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" id="btn-a4" class="btn btn-fmt ${!isA3 ? 'active' : ''}" onclick="setFmt('A4')">Format A4 Paysage</button>
            <button type="button" id="btn-a3" class="btn btn-fmt ${isA3 ? 'active' : ''}" onclick="setFmt('A3')">Format A3 Paysage</button>
            <button type="button" class="btn btn-print" onclick="window.print()">🖨️ Imprimer / PDF</button>
            <button type="button" class="btn btn-close" onclick="window.close()">✕ Fermer</button>
          </div>
        </div>
        <div class="sheet" id="print-sheet">
          <div class="sheet-header">
            <div>
              <div class="sheet-title">▲ Profil Altimétrique : ${title}</div>
              <div class="sheet-sub">Map &amp; Rando by JLDApps 2026 • Format <span id="sub-fmt">${fmt}</span> Paysage${ibp}</div>
            </div>
            <div class="stats-pills">
              <span class="pill">📏 ${dist} km</span>
              <span class="pill pill-green">↗ D+ ${dPlus} m</span>
              <span class="pill pill-red">↘ D- ${dMoins} m</span>
              <span class="pill">⛰️ ${minAlt} m / ${maxAlt} m</span>
            </div>
          </div>
          <div class="chart-wrap">
            <img src="${imgDataUrl}" alt="Profil Altimétrique" />
          </div>
          <div class="sheet-footer">
            <div>Profil Topographique Haute Définition • Map &amp; Rando by JLDApps 2026</div>
            <div>Édité le ${dateStr}</div>
          </div>
        </div>
        <script>
          function setFmt(f) {
            document.getElementById('page-size-style').innerHTML = '@page { size: ' + f + ' landscape; margin: 6mm; }';
            document.getElementById('lbl-fmt').textContent = f + ' Paysage';
            document.getElementById('sub-fmt').textContent = f;
            document.getElementById('btn-a4').classList.toggle('active', f === 'A4');
            document.getElementById('btn-a3').classList.toggle('active', f === 'A3');
            var sh = document.getElementById('print-sheet');
            sh.style.width = (f === 'A3') ? '408mm' : '285mm';
            sh.style.height = (f === 'A3') ? '285mm' : '198mm';
          }
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  /**
   * Construit un canvas très haute résolution pour l'impression A4/A3 pleine page
   */
  buildHighResPrintCanvas(hike, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const pts = hike.points;
    const pad = { top: 68, right: 56, bottom: 72, left: 86 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const totalDist = Math.max(0.1, Number(hike.distanceKm || pts[pts.length - 1].dist || 1));
    let minE = Infinity, maxE = -Infinity;
    let maxPt = pts[0], minPt = pts[0];
    for (const p of pts) {
      const z = Number(p.ele || 0);
      if (z < minE) { minE = z; minPt = p; }
      if (z > maxE) { maxE = z; maxPt = p; }
    }
    if (!isFinite(minE)) { minE = 0; maxE = 100; }
    const rangeE = Math.max(20, maxE - minE);
    const yMin = Math.floor((minE - rangeE * 0.08) / 10) * 10;
    const yMax = Math.ceil((maxE + rangeE * 0.12) / 10) * 10;
    const ySpan = Math.max(10, yMax - yMin);

    const toX = (d) => pad.left + (d / totalDist) * plotW;
    const toY = (z) => pad.top + plotH - ((z - yMin) / ySpan) * plotH;

    // Grille horizontale (altitudes)
    const ySteps = 6;
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    for (let i = 0; i <= ySteps; i++) {
      const val = Math.round(yMin + (ySpan * i) / ySteps);
      const y = toY(val);
      ctx.strokeStyle = i === 0 ? '#64748b' : '#e2e8f0';
      ctx.lineWidth = i === 0 ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${val} m`, pad.left - 14, y);
    }

    // Grille verticale (kilomètres)
    const kmStep = totalDist <= 5 ? 0.5 : (totalDist <= 15 ? 1 : (totalDist <= 30 ? 2 : 5));
    for (let d = 0; d <= totalDist + 0.001; d += kmStep) {
      const x = toX(Math.min(d, totalDist));
      ctx.strokeStyle = d === 0 ? '#64748b' : '#e2e8f0';
      ctx.lineWidth = d === 0 ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${Number(d.toFixed(1))} km`, x, pad.top + plotH + 14);
    }

    // Aire dégradée sous la courbe
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.38)');
    grad.addColorStop(0.65, 'rgba(14, 165, 233, 0.18)');
    grad.addColorStop(1, 'rgba(14, 165, 233, 0.03)');

    ctx.beginPath();
    ctx.moveTo(toX(pts[0].dist || 0), pad.top + plotH);
    for (let i = 0; i < pts.length; i++) {
      ctx.lineTo(toX(pts[i].dist || 0), toY(Number(pts[i].ele || 0)));
    }
    ctx.lineTo(toX(pts[pts.length - 1].dist || totalDist), pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Courbe principale nette
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = toX(pts[i].dist || 0);
      const y = toY(Number(pts[i].ele || 0));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Badge Point Haut (Sommet)
    const peakX = toX(maxPt.dist || 0);
    const peakY = toY(Number(maxPt.ele || 0));
    ctx.beginPath();
    ctx.arc(peakX, peakY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    const peakLbl = `▲ Sommet : ${Math.round(maxE)} m (km ${(maxPt.dist || 0).toFixed(1)})`;
    ctx.font = 'bold 21px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const peakW = ctx.measureText(peakLbl).width + 24;
    const pBoxX = Math.min(width - pad.right - peakW, Math.max(pad.left, peakX - peakW / 2));
    const pBoxY = Math.max(10, peakY - 46);
    ctx.fillStyle = '#fef2f2';
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.fillRect(pBoxX, pBoxY, peakW, 34);
    ctx.strokeRect(pBoxX, pBoxY, peakW, 34);
    ctx.fillStyle = '#991b1b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(peakLbl, pBoxX + peakW / 2, pBoxY + 17);

    // Badge Point Bas
    const lowX = toX(minPt.dist || 0);
    const lowY = toY(Number(minPt.ele || 0));
    ctx.beginPath();
    ctx.arc(lowX, lowY, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Tracer les waypoints GPX éventuels sur le profil
    if (Array.isArray(hike.waypoints) && hike.waypoints.length > 0) {
      ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      hike.waypoints.forEach((wp) => {
        const wLat = Number(wp.lat);
        const wLon = Number(wp.lon !== undefined ? wp.lon : wp.lng);
        if (isNaN(wLat) || isNaN(wLon)) return;
        let bestPt = pts[0], bestD = Infinity;
        for (const p of pts) {
          const pLon = p.lon !== undefined ? p.lon : p.lng;
          const d = (p.lat - wLat) ** 2 + (pLon - wLon) ** 2;
          if (d < bestD) { bestD = d; bestPt = p; }
        }
        const wx = toX(bestPt.dist || 0);
        const wy = toY(Number(bestPt.ele || 0));
        ctx.save();
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.55)';
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx, pad.top + plotH);
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(wx, wy, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#0284c7';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (wp.name) {
          ctx.fillStyle = '#0f172a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(wp.name.slice(0, 22), wx, Math.max(pad.top + 22, wy - 12));
        }
      });
    }

    return canvas.toDataURL('image/png');
  }
}

window.ElevationProfile = ElevationProfile;
