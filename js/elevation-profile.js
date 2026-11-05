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
    }

    return true;
  }

  render(hike, onHover = null, onLeave = null) {
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
    }

    this.animationFrameId = requestAnimationFrame(() => {
      this.resizeAndDraw();
    });
  }

  resizeAndDraw(cursorDist = null) {
    if (!this.canvas || !this.ctx || !this.currentHike) return;

    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(10, rect.width || 380);
    const height = Math.max(10, rect.height || 110);

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

    const maxDist = Math.max(0.1, hike.distanceKm);
    
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

    // 6. Interactive Cursor Indicator
    if (cursorDist !== null) {
      const closest = this.findClosestPointByDist(cursorDist);
      if (closest) {
        const cx = getX(closest.point.dist);
        const cy = getY(closest.point.ele);

        // Vertical dashed guide line
        ctx.beginPath();
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.moveTo(cx, padding.top);
        ctx.lineTo(cx, padding.top + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated Target Dot
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // High-contrast Tooltip Pill
        const tooltipText = `${closest.point.ele} m • ${closest.point.dist} km`;
        ctx.font = 'bold 10px Inter, sans-serif';
        const textWidth = ctx.measureText(tooltipText).width;
        let tooltipX = cx + 8;
        if (tooltipX + textWidth + 8 > width) tooltipX = cx - textWidth - 12;
        let tooltipY = cy - 8;
        if (tooltipY < padding.top + 12) tooltipY = padding.top + 12;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.beginPath();
        ctx.roundRect(tooltipX - 4, tooltipY - 12, textWidth + 8, 17, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(tooltipText, tooltipX, tooltipY);
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

  updateCursorFromX(x, width) {
    const padding = { left: 40, right: 18 };
    const chartW = width - padding.left - padding.right;
    const relativeX = Math.max(0, Math.min(chartW, x - padding.left));
    const dist = (relativeX / chartW) * this.currentHike.distanceKm;

    this.resizeAndDraw(dist);

    const closest = this.findClosestPointByDist(dist);
    if (closest && this.onHoverCallback) {
      this.onHoverCallback(closest.point, closest.index);
    }
  }

  findClosestPointByDist(targetDist) {
    if (!this.currentHike || !this.currentHike.points || this.currentHike.points.length === 0) return null;
    const points = this.currentHike.points;

    let closest = points[0];
    let closestIdx = 0;
    let minDiff = Math.abs(points[0].dist - targetDist);

    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].dist - targetDist);
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
}

window.ElevationProfile = ElevationProfile;
