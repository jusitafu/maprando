/**
 * PDF Exporter for "Fiche Randonnée"
 * Includes IGN / Topo Map snapshot, Elevation Profile & Notes
 * Les Randonneurs Sanaryens - JLD Apps 2026
 */

class PDFExporter {
  /**
   * Identifie la (ou les) feuille(s) IGN TOP 25 / Série Bleue couvrant l'emprise géographique
   * Retourne la référence commerciale (ex: 3346 OT), le titre officiel, l'année d'édition papier
   * et le libellé à apposer sur le côté droit de la carte imprimée.
   */
  static getIgnSheetInfoForBounds(bounds) {
    if (!bounds || !bounds[0] || !bounds[1] || typeof window === 'undefined' || !window.IGN_TOP25_SHEETS) {
      return null;
    }
    const minLat = bounds[0][0];
    const minLon = bounds[0][1];
    const maxLat = bounds[1][0];
    const maxLon = bounds[1][1];
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;

    const sheets = window.IGN_TOP25_SHEETS;
    const commRefs = window.IGN_COMMERCIAL_REFS || {};
    const matches = [];

    for (let i = 0; i < sheets.length; i++) {
      const s = sheets[i];
      const b = s.b;
      if (!(b[2] < minLat || b[0] > maxLat || b[3] < minLon || b[1] > maxLon)) {
        const interLat = Math.min(maxLat, b[2]) - Math.max(minLat, b[0]);
        const interLon = Math.min(maxLon, b[3]) - Math.max(minLon, b[1]);
        const area = interLat * interLon;
        const containsCenter = (b[0] <= centerLat && centerLat <= b[2] && b[1] <= centerLon && centerLon <= b[3]);
        
        const commRef = commRefs[s.n] || null;
        const label = commRef ? `${commRef} « ${s.t} »` : `TOP 25 « ${s.t} » (${s.n})`;
        matches.push({
          num: s.n,
          title: s.t,
          annee: s.a,
          commercialRef: commRef,
          label: label,
          area: area,
          containsCenter: containsCenter
        });
      }
    }

    if (matches.length === 0) return null;

    matches.sort((a, b) => {
      if (a.containsCenter && !b.containsCenter) return -1;
      if (!a.containsCenter && b.containsCenter) return 1;
      return b.area - a.area;
    });

    const primary = matches[0];
    let verticalText = '';
    if (matches.length === 1) {
      verticalText = `CARTE IGN TOP 25 n° ${primary.label} — Édition papier : ${primary.annee}`;
    } else {
      const parts = matches.slice(0, 3).map(m => `${m.label} (Éd. ${m.annee})`);
      verticalText = `FEUILLES IGN TOP 25 : ${parts.join(' • ')}`;
    }

    return {
      primary: primary,
      allMatches: matches,
      verticalText: verticalText
    };
  }

  /**
   * Generate and download the Fiche Randonnée PDF
   * Supports Format (A4, A3) and Orientation (Portrait, Landscape)
   * @param {Object} hike - Hike data
   * @param {Object} options - { includeMap: bool, mapLayer: string, format: string, orientation: string, includeProfile: bool, includeNotes: bool }
   */
  static async exportFichePDF(hike, options = {}) {
    const { jsPDF } = window.jspdf;
    const format = (options.format || 'a4').toLowerCase(); // 'a4' or 'a3'
    const orientation = (options.orientation || 'portrait').toLowerCase(); // 'portrait' or 'landscape'
    const includeMap = options.includeMap !== false;
    const mapLayer = options.mapLayer || 'igntop25';
    const includeProfile = options.includeProfile !== false;
    const includeNotes = options.includeNotes !== false;
    const layoutStyle = options.layoutStyle || 'overlay'; // 'overlay' or 'columns'

    const doc = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: format
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const isA3 = format === 'a3';
    const isLandscape = orientation === 'landscape';
    const margin = isA3 ? 18 : 12;
    const contentWidth = pageWidth - (margin * 2);

    let currentY = margin;

    // Détection si la randonnée est en France métropolitaine / Corse
    const isInsideFrance = (hike.startPoint && hike.startPoint.lat >= 41.0 && hike.startPoint.lat <= 51.5 && hike.startPoint.lon >= -5.5 && hike.startPoint.lon <= 10.0);
    const layerLabels = {
      'igntop25': isInsideFrance ? "FOND OFFICIEL IGN TOP 25 (CARTE PAPIER)" : "FOND OPENTOPOMAP (RELIEF MONDIAL)",
      'ign': isInsideFrance ? "FOND OFFICIEL IGN TOP 25 (CARTE PAPIER)" : "FOND OPENTOPOMAP (RELIEF MONDIAL)",
      'ignplan': isInsideFrance ? "FOND OFFICIEL PLAN IGN (NUMÉRIQUE V2)" : "FOND OPENTOPOMAP (RELIEF MONDIAL)",
      'grmap': "CARTE DES GR® & SENTIERS BALISÉS (FOND ÉPURÉ)",
      'opentopo': "FOND OPENTOPOMAP (RELIEF MONDIAL)",
      'osmfr': "FOND OPENSTREETMAP FRANCE (SENTIERS)",
      'satellite': "FOND SATELLITE HAUTE DÉFINITION (IGN / ESRI)"
    };
    const layerLabel = layerLabels[mapLayer] || "FOND TOPOGRAPHIQUE";

    if (isLandscape) {
      // =========================================================================
      // DISPOSITION PAYSAGE (DASHBOARD 2 COLONNES HAUTE DÉFINITION)
      // =========================================================================

      // 1. Bandeau supérieur (Header Banner)
      const bannerH = isA3 ? 20 : 15;
      doc.setFillColor(15, 23, 42); // Slate 900
      doc.rect(margin, currentY, contentWidth, bannerH, 'F');

      // Club Logo or Text
      try {
        const logoImg = document.getElementById('app-logo-white') || document.getElementById('app-logo');
        if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
          const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
          const logoH = bannerH - 4;
          const logoW = logoH * logoAspect;
          doc.addImage(logoImg, 'PNG', margin + 3, currentY + 2, Math.min(logoW, 60), logoH);
        }
      } catch (e) {}

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA3 ? 14 : 11);
      doc.text("FICHE RANDONNÉE", pageWidth - margin - 5, currentY + (bannerH * 0.44), { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isA3 ? 9 : 7.2);
      doc.setTextColor(203, 213, 225); // Slate 300
      doc.text("RandoFinder - JLDApps 2026", pageWidth - margin - 5, currentY + (bannerH * 0.80), { align: 'right' });

      currentY += bannerH + 3;

      // 2. Bandeau Titre & Badges Métriques
      const metricsW = isA3 ? 175 : 126;
      const titleW = contentWidth - metricsW - 6;

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA3 ? 15 : 12);
      const titleLines = doc.splitTextToSize(hike.name || "Randonnée", titleW);
      doc.text(titleLines, margin, currentY + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isA3 ? 8 : 6.8);
      doc.setTextColor(100, 116, 139);
      const startCoord = `Départ GPS : Lat ${hike.startPoint.lat.toFixed(5)}°, Lon ${hike.startPoint.lon.toFixed(5)}° • ${hike.isLoop ? 'Boucle' : 'Traversée'}`;
      doc.text(startCoord, margin, currentY + 5 + (titleLines.length * 4.5));

      // 5 Badges métriques alignés à droite
      const ibpVal = (typeof hike.ibp === 'number') ? hike.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(hike) : 50);
      const ibpInfo = (typeof GPXParser !== 'undefined') ? GPXParser.getIBPLevel(ibpVal) : { level: 3, label: 'Peu difficile' };

      const badgeH = isA3 ? 14 : 11.5;
      const colW = (metricsW - 8) / 5;
      const metricsStartX = pageWidth - margin - metricsW;

      const metrics = [
        { label: "DISTANCE", val: `${hike.distanceKm} km` },
        { label: "DÉNIVELÉ D+", val: `+${hike.elevationGain} m` },
        { label: "IBP INDEX", val: `${ibpVal} (Niv. ${ibpInfo.level})` },
        { label: "ALTITUDE", val: `${hike.minElevation}m / ${hike.maxElevation}m` },
        { label: "DURÉE EST.", val: hike.estimatedDuration || "3h30" }
      ];

      metrics.forEach((m, idx) => {
        const bx = metricsStartX + (idx * (colW + 2));
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(bx, currentY, colW, badgeH, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(isA3 ? 6.5 : 5.5);
        doc.setTextColor(100, 116, 139);
        doc.text(m.label, bx + (colW / 2), currentY + (badgeH * 0.38), { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isA3 ? 9 : 7.2);
        doc.setTextColor(15, 23, 42);
        doc.text(m.val, bx + (colW / 2), currentY + (badgeH * 0.82), { align: 'center' });
      });

      currentY += Math.max(badgeH, (titleLines.length * 4.5) + 6) + 4;

      // 3. Corps principal : Panoramique avec incrustation OU 2 Colonnes
      const availableH = pageHeight - margin - 8 - currentY;
      const colGap = isA3 ? 6 : 5;

      if (layoutStyle === 'overlay' && includeMap) {
        // -----------------------------------------------------------------------
        // OPTION 1 : CARTE PANORAMIQUE AVEC PROFIL INCRUSTÉ EN COIN LIBRE
        // -----------------------------------------------------------------------
        const mapX = margin;
        const mapY = currentY;
        const mapW = contentWidth;
        const mapH = availableH;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isA3 ? 10.5 : 9);
        doc.setTextColor(15, 23, 42);
        doc.text(`1. CARTE PANORAMIQUE & ITINÉRAIRE (${layerLabel})`, mapX, mapY + 3.5);

        const actualMapY = mapY + 5;
        const actualMapH = mapH - 6;

        let mapResult = null;
        try {
          const pxW = Math.round(mapW * 4.5);
          const pxH = Math.round(actualMapH * 4.5);
          mapResult = await this.renderStaticMap(hike, pxW, pxH, mapLayer, null, options.trackColor, options);
          const mapImgData = mapResult && mapResult.imgData ? mapResult.imgData : mapResult;
          if (mapImgData) {
            doc.addImage(mapImgData, 'JPEG', mapX, actualMapY, mapW, actualMapH);
            doc.setDrawColor(203, 213, 225);
            doc.rect(mapX, actualMapY, mapW, actualMapH);

            // Mention verticale IGN TOP 25 sur le bord droit de la carte
            if (mapLayer === 'igntop25' && (hike.bounds || (hike.points && hike.points.length > 0))) {
              const b = hike.bounds || [[hike.points[0].lat, hike.points[0].lon], [hike.points[hike.points.length-1].lat, hike.points[hike.points.length-1].lon]];
              const sheetInfo = this.getIgnSheetInfoForBounds(b);
              if (sheetInfo && sheetInfo.verticalText) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(isA3 ? 6.2 : 4.8);
                doc.setTextColor(100, 116, 139);
                const vTextW = doc.getTextWidth(sheetInfo.verticalText);
                const x_fiche = pageWidth - (isA3 ? 6.5 : 5.0);
                const y_fiche_start = (actualMapY + (actualMapH / 2)) + (vTextW / 2);
                doc.text(sheetInfo.verticalText, x_fiche, y_fiche_start, { angle: 270 });
              }
            }
          }
        } catch (err) {
          console.warn("Erreur image carte panoramique :", err);
        }

        // Incrustation intelligente du profil altimétrique dans un coin sans trace
        if (includeProfile && mapResult && mapResult.zoom) {
          const cardW = isA3 ? 130 : 96;
          const cardH = isA3 ? 50 : 38;
          const sortedCorners = this.findBestCorners(
            hike, mapW, actualMapH, cardW, cardH,
            mapResult.imgWidth, mapResult.imgHeight,
            mapResult.zoom, mapResult.centerTileX, mapResult.centerTileY
          );
          const best = sortedCorners[0];
          const cardX = mapX + best.rx;
          const cardY = actualMapY + best.ry;

          // Ombre portée discrète et cadre blanc arrondi
          doc.setFillColor(15, 23, 42);
          doc.roundedRect(cardX + 0.8, cardY + 0.8, cardW, cardH, 2.5, 2.5, 'F');
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(203, 213, 225);
          doc.roundedRect(cardX, cardY, cardW, cardH, 2.5, 2.5, 'FD');

          // Header du carton de profil
          const headerH = isA3 ? 7.5 : 6;
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(cardX, cardY, cardW, headerH, 2.5, 2.5, 'F');
          doc.rect(cardX, cardY + headerH - 1, cardW, 1, 'F'); // alignement bas
          doc.setDrawColor(226, 232, 240);
          doc.line(cardX, cardY + headerH, cardX + cardW, cardY + headerH);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(isA3 ? 7.5 : 6.2);
          doc.setTextColor(15, 23, 42);
          doc.text(`PROFIL ALTIMÉTRIQUE (${hike.distanceKm} km • D+ ${hike.elevationGain || 0} m)`, cardX + 3, cardY + (headerH * 0.65));

          // Graphique haute définition
          try {
            const profileImgData = ElevationProfile.renderStaticChart(hike, 960, 320);
            if (profileImgData) {
              const chartY = cardY + headerH + 0.5;
              const chartH = cardH - headerH - 1.5;
              doc.addImage(profileImgData, 'PNG', cardX + 1.5, chartY, cardW - 3, chartH);
            }
          } catch (e) {
            console.warn("Erreur incrustation profil :", e);
          }

          // Si des notes sont demandées et non vides, tenter de les incruster dans le 2ème coin libre
          if (includeNotes && hike.notes && hike.notes.trim().length > 0 && sortedCorners.length > 1) {
            const secondBest = sortedCorners[1];
            if (secondBest.inside === 0) {
              const noteW = isA3 ? 120 : 88;
              const noteH = isA3 ? 36 : 28;
              const noteX = mapX + secondBest.rx;
              const noteY = actualMapY + secondBest.ry;

              doc.setFillColor(15, 23, 42);
              doc.roundedRect(noteX + 0.8, noteY + 0.8, noteW, noteH, 2.5, 2.5, 'F');
              doc.setFillColor(255, 255, 255);
              doc.setDrawColor(203, 213, 225);
              doc.roundedRect(noteX, noteY, noteW, noteH, 2.5, 2.5, 'FD');

              const nHeaderH = isA3 ? 6.5 : 5.2;
              doc.setFillColor(248, 250, 252);
              doc.roundedRect(noteX, noteY, noteW, nHeaderH, 2.5, 2.5, 'F');
              doc.rect(noteX, noteY + nHeaderH - 1, noteW, 1, 'F');
              doc.setDrawColor(226, 232, 240);
              doc.line(noteX, noteY + nHeaderH, noteX + noteW, noteY + nHeaderH);

              doc.setFont('helvetica', 'bold');
              doc.setFontSize(isA3 ? 7 : 5.8);
              doc.setTextColor(15, 23, 42);
              doc.text("NOTES & INFOS PRATIQUES", noteX + 3, noteY + (nHeaderH * 0.65));

              doc.setFont('helvetica', 'normal');
              doc.setFontSize(isA3 ? 7.5 : 6.2);
              doc.setTextColor(51, 65, 85);
              const splitNotes = doc.splitTextToSize(hike.notes.trim(), noteW - 6);
              doc.text(splitNotes, noteX + 3, noteY + nHeaderH + 3.5);
            }
          }
        }
      } else {
        // -----------------------------------------------------------------------
        // OPTION 2 : DEUX COLONNES (CARTE 70% + PROFIL RÉDUIT À DROITE 28%)
        // -----------------------------------------------------------------------
        let leftColW, rightColW;
        if (includeMap && (includeProfile || includeNotes)) {
          leftColW = Math.round((contentWidth - colGap) * 0.70); // Carte agrandie à 70% !
          rightColW = contentWidth - colGap - leftColW;
        } else {
          leftColW = contentWidth;
          rightColW = contentWidth;
        }

        // --- Colonne Gauche : Carte Topographique ---
        if (includeMap) {
          const mapX = margin;
          const mapY = currentY;
          const mapW = (includeProfile || includeNotes) ? leftColW : contentWidth;
          const mapH = availableH;

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(isA3 ? 10 : 8.5);
          doc.setTextColor(15, 23, 42);
          doc.text(`1. CARTE DE L'ITINÉRAIRE (${layerLabel})`, mapX, mapY + 3.5);

          const actualMapY = mapY + 5;
          const actualMapH = mapH - 6;

          try {
            const pxW = Math.round(mapW * 4.5);
            const pxH = Math.round(actualMapH * 4.5);
            const mapResult = await this.renderStaticMap(hike, pxW, pxH, mapLayer, null, options.trackColor, options);
            const mapImgData = mapResult && mapResult.imgData ? mapResult.imgData : mapResult;
            if (mapImgData) {
              doc.addImage(mapImgData, 'JPEG', mapX, actualMapY, mapW, actualMapH);
              doc.setDrawColor(203, 213, 225);
              doc.rect(mapX, actualMapY, mapW, actualMapH);
            }
          } catch (err) {
            console.warn("Erreur image carte paysage :", err);
          }
        }

        // --- Colonne Droite : Profil Réduit & Notes ---
        if (includeProfile || includeNotes) {
          const rightX = includeMap ? (margin + leftColW + colGap) : margin;
          let rightY = currentY;
          const rightW = includeMap ? rightColW : contentWidth;

          // Profil Altimétrique (taille réduite par rapport à avant)
          if (includeProfile) {
            const profH = includeNotes ? Math.round(availableH * 0.30) : availableH - 6; // Réduit à 30% au lieu de 45%

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(isA3 ? 9 : 7.8);
            doc.setTextColor(15, 23, 42);
            doc.text(`2. PROFIL (${hike.distanceKm} km • D+ ${hike.elevationGain || 0} m)`, rightX, rightY + 3.5);

            const actualProfY = rightY + 5;
            const actualProfH = profH - 6;

            try {
              const profileImgData = ElevationProfile.renderStaticChart(hike, 800, 260);
              if (profileImgData) {
                doc.addImage(profileImgData, 'PNG', rightX, actualProfY, rightW, actualProfH);
                doc.setDrawColor(203, 213, 225);
                doc.rect(rightX, actualProfY, rightW, actualProfH);
              }
            } catch (err) {
              console.warn("Erreur profil paysage :", err);
            }

            rightY += profH + 3;
          }

          // Notes & Conseils
          if (includeNotes) {
            const notesH = pageHeight - margin - 8 - rightY;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(isA3 ? 9 : 7.8);
            doc.setTextColor(15, 23, 42);
            doc.text("3. NOTES & INFOS PRATIQUES", rightX, rightY + 3.5);

            const actualNotesY = rightY + 5;
            const actualNotesH = notesH - 6;

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(rightX, actualNotesY, rightW, actualNotesH, 2, 2, 'FD');

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(isA3 ? 8 : 6.8);
            doc.setTextColor(51, 65, 85);

            const notesText = hike.notes && hike.notes.trim().length > 0
              ? hike.notes
              : "Aucune note particulière pour cette randonnée. Pensez à emporter de l'eau en quantité suffisante, de bonnes chaussures de marche et à vérifier la météo avant le départ.";

            const splitNotes = doc.splitTextToSize(notesText, rightW - 6);
            doc.text(splitNotes, rightX + 3, actualNotesY + 5);
          }
        }
      }

    } else {
      // =========================================================================
      // DISPOSITION PORTRAIT (A4 / A3 VERTICAL)
      // =========================================================================

      // 1. Header Banner
      const bannerH = isA3 ? 26 : 20;
      doc.setFillColor(15, 23, 42); // Slate 900
      doc.rect(margin, currentY, contentWidth, bannerH, 'F');

      // Logo sur bandeau
      try {
        const logoImg = document.getElementById('app-logo-white') || document.getElementById('app-logo');
        if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
          const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
          const logoH = bannerH - 6;
          const logoW = logoH * logoAspect;
          doc.addImage(logoImg, 'PNG', margin + 4, currentY + 3, Math.min(logoW, 60), logoH);
        }
      } catch (e) {}

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA3 ? 16 : 13);
      doc.text("FICHE RANDONNÉE", pageWidth - margin - 6, currentY + (bannerH * 0.45), { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isA3 ? 9.5 : 7.8);
      doc.setTextColor(203, 213, 225); // Slate 300
      doc.text("RandoFinder - JLDApps 2026", pageWidth - margin - 6, currentY + (bannerH * 0.80), { align: 'right' });

      currentY += bannerH + (isA3 ? 6 : 4);

      // 2. Hike Title & Place
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA3 ? 18 : 14);

      const titleLines = doc.splitTextToSize(hike.name || "Randonnée", contentWidth);
      doc.text(titleLines, margin, currentY);
      currentY += (titleLines.length * (isA3 ? 7 : 5.5)) + 3;

      // 3. Metrics Summary Box (Grid of 5 badges)
      const ibpVal = (typeof hike.ibp === 'number') ? hike.ibp : ((typeof GPXParser !== 'undefined') ? GPXParser.calculateIBP(hike) : 50);
      const ibpInfo = (typeof GPXParser !== 'undefined') ? GPXParser.getIBPLevel(ibpVal) : { level: 3, label: 'Peu difficile' };

      const boxH = isA3 ? 22 : 16;
      const colW = (contentWidth - 8) / 5;

      const metrics = [
        { label: "DISTANCE", val: `${hike.distanceKm} km` },
        { label: "DÉNIVELÉ D+", val: `+${hike.elevationGain} m` },
        { label: "IBP INDEX", val: `${ibpVal} (Niv. ${ibpInfo.level})` },
        { label: "ALTITUDE", val: `${hike.minElevation}m / ${hike.maxElevation}m` },
        { label: "DURÉE ESTIMÉE", val: hike.estimatedDuration || "3h30" }
      ];

      metrics.forEach((m, idx) => {
        const bx = margin + (idx * (colW + 2));
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(bx, currentY, colW, boxH, 2, 2, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(isA3 ? 8 : 6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(m.label, bx + (colW / 2), currentY + (boxH * 0.38), { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isA3 ? 12 : 9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(m.val, bx + (colW / 2), currentY + (boxH * 0.82), { align: 'center' });
      });

      currentY += boxH + (isA3 ? 5 : 4);

      // 4. GPS Departure Info
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isA3 ? 9 : 7.5);
      doc.setTextColor(71, 85, 105);
      const startCoord = `Point de départ GPS : Lat ${hike.startPoint.lat.toFixed(5)}°, Lon ${hike.startPoint.lon.toFixed(5)}° (${hike.isLoop ? 'Boucle' : 'Aller simple / Traversée'})`;
      doc.text(startCoord, margin, currentY);
      currentY += (isA3 ? 6 : 5);

      // 5. Option 1: Map Snapshot with Route (IGN / OpenTopoMap / OSM)
      if (includeMap) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isA3 ? 11 : 9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`1. CARTE DE L'ITINÉRAIRE (${layerLabel})`, margin, currentY);
        currentY += 4;

        const mapH = isA3 ? 125 : 76; // mm

        try {
          const pxW = Math.round(contentWidth * 4.5);
          const pxH = Math.round(mapH * 4.5);
          const mapResult = await this.renderStaticMap(hike, pxW, pxH, mapLayer, null, options.trackColor, options);
          const mapImgData = mapResult && mapResult.imgData ? mapResult.imgData : mapResult;
          if (mapImgData) {
            doc.addImage(mapImgData, 'JPEG', margin, currentY, contentWidth, mapH);
            doc.setDrawColor(203, 213, 225);
            doc.rect(margin, currentY, contentWidth, mapH);
            currentY += mapH + (isA3 ? 6 : 5);
          }
        } catch (err) {
          console.warn("Erreur image carte :", err);
        }
      }

      // 6. Option 2: Elevation Profile
      if (includeProfile) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isA3 ? 11 : 9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`2. PROFIL ALTIMÉTRIQUE (${hike.distanceKm} km • D+ ${hike.elevationGain || 0} m)`, margin, currentY);
        currentY += 4;

        const profH = isA3 ? 70 : 44; // mm

        try {
          const profileImgData = ElevationProfile.renderStaticChart(hike, 1000, 360);
          if (profileImgData) {
            doc.addImage(profileImgData, 'PNG', margin, currentY, contentWidth, profH);
            doc.setDrawColor(203, 213, 225);
            doc.rect(margin, currentY, contentWidth, profH);
            currentY += profH + (isA3 ? 6 : 5);
          }
        } catch (err) {
          console.warn("Erreur profil altimétrique :", err);
        }
      }

      // 7. Option 3: Free Notes & Practical Info
      if (includeNotes) {
        if (currentY > pageHeight - 35) {
          doc.addPage();
          currentY = margin + 5;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isA3 ? 11 : 9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("3. NOTES LIBRES & CONSEILS PRATIQUES", margin, currentY);
        currentY += 4;

        const notesH = Math.max(20, Math.min(isA3 ? 55 : 34, pageHeight - currentY - margin - 12));
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, currentY, contentWidth, notesH, 2, 2, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(isA3 ? 9 : 7.8);
        doc.setTextColor(51, 65, 85);

        const notesText = hike.notes && hike.notes.trim().length > 0
          ? hike.notes
          : "Aucune note particulière pour cette randonnée. Pensez à emporter de l'eau en quantité suffisante, de bonnes chaussures de marche et à vérifier la météo avant le départ.";

        const splitNotes = doc.splitTextToSize(notesText, contentWidth - 8);
        doc.text(splitNotes, margin + 4, currentY + 5);
      }
    }

    // Footer on all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isA3 ? 9 : 7.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`RandoFinder - ${hike.name} | Page ${p}/${totalPages}`, margin, pageHeight - 6);
      const dateStr = new Date().toLocaleDateString('fr-FR');
      const layoutStr = `${format.toUpperCase()} ${isLandscape ? 'Paysage' : 'Portrait'}`;
      doc.text(`Généré le ${dateStr} • ${layoutStr}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }

    // Clean filename for PDF
    const safeName = (hike.name || 'Fiche_Randonnee').replace(/[\\/:*?"<>|]/g, '_');
    const fileSuffix = `${format.toUpperCase()}_${isLandscape ? 'Paysage' : 'Portrait'}`;
    doc.save(`Fiche_${safeName}_${fileSuffix}.pdf`);
  }

  /**
   * Export an extracted map area to a high-definition PDF
   * Supports Format (A4, A3) and Orientation (Landscape, Portrait)
   * @param {Array} bounds - [[minLat, minLon], [maxLat, maxLon]]
   * @param {Object} options - { title, format, orientation, mapLayer, showCoords }
   */
  static async exportMapAreaPDF(bounds, options = {}) {
    const { jsPDF } = window.jspdf;
    const format = options.format || 'a4';
    const orientation = options.orientation || 'landscape';
    const mapLayer = options.mapLayer || 'igntop25';
    const title = options.title || 'Extrait de Carte';
    const showCoords = options.showCoords !== false;
    const showUtm = options.showUtmGrid !== false;
    const scaleMode = options.scaleMode || 'custom';
    const userScaleDenom = parseInt(options.scaleDenom, 10) || 25000;

    const doc = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: format,
      compress: true
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const isA3 = format === 'a3';

    // Marges physiques en millimètres (24 mm sur A3 et 20 mm sur A4 pour garantir 0 chevauchement entre UTM et référence verticale)
    const marginX = isA3 ? 24 : 20;
    const marginTop = isA3 ? 14 : 12;
    const marginBottom = isA3 ? 14 : 12;
    const contentWidth = pageWidth - (marginX * 2);

    let currentY = marginTop;

    let minLat = bounds[0][0];
    let minLon = bounds[0][1];
    let maxLat = bounds[1][0];
    let maxLon = bounds[1][1];
    const origCenterLat = (minLat + maxLat) / 2;
    const origCenterLon = (minLon + maxLon) / 2;

    const layerLabels = {
      'igntop25': "CARTE IGN TOP 25 OFFICIELLE (FLUX SCAN 25)",
      'ignplan': "PLAN IGN MULTI-ÉCHELLES (IGN EXPRESS)",
      'grmap': "CARTE DES GR® & SENTIERS BALISÉS (FOND ÉPURÉ)",
      'opentopo': "OPENTOPO MAP (RELIEF ET COURBES DE NIVEAU)",
      'osm': "OPENSTREETMAP MONDE",
      'satellite': "FOND SATELLITE HAUTE DÉFINITION (IGN / ESRI)"
    };
    const layerLabel = layerLabels[mapLayer] || "FOND TOPOGRAPHIQUE";

    // 1. Bandeau supérieur (Header Banner)
    const bannerH = isA3 ? 17 : 13;
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(marginX, currentY, contentWidth, bannerH, 'F');

    // Logo
    try {
      const logoImg = document.getElementById('app-logo-white') || document.getElementById('app-logo');
      if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
        const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
        const logoH = bannerH - 3.5;
        const logoW = logoH * logoAspect;
        doc.addImage(logoImg, 'PNG', marginX + 3, currentY + 1.75, Math.min(logoW, 55), logoH);
      }
    } catch (e) {}

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isA3 ? 12 : 9.5);
    doc.text("EXTRAIT DE CARTE TOPOGRAPHIQUE", pageWidth - marginX - 5, currentY + (bannerH * 0.44), { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isA3 ? 8 : 6.8);
    doc.setTextColor(203, 213, 225);
    doc.text("Map & Rando by JLDApps 2026", pageWidth - marginX - 5, currentY + (bannerH * 0.80), { align: 'right' });

    currentY += bannerH + 3;

    // 2. Titre personnalisé & Sous-titre
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isA3 ? 14 : 11);
    const titleLines = doc.splitTextToSize(title, contentWidth);
    doc.text(titleLines, marginX, currentY + 3.2);

    const subY = currentY + 3.8 + (titleLines.length * 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isA3 ? 7.5 : 6.5);
    doc.setTextColor(100, 116, 139);

    currentY = subY + 3.5;

    // 3. Cadre de la carte : dimensions physiques précises sur le papier
    const mapX = marginX;
    const mapY = currentY;
    const mapW = contentWidth;
    const footerH = isA3 ? 14 : 11.5; // Espace réservé pour la règle en cm, l'échelle et les mentions UTM
    const mapH = pageHeight - marginBottom - footerH - mapY;

    // 4. Calcul de l'Échelle Vraie Physique
    let finalScale = userScaleDenom;
    if (scaleMode === 'custom' && userScaleDenom > 0) {
      finalScale = userScaleDenom;
      // Dimensions terrain couvertes par la carte papier au millimètre près
      const groundW_m = (mapW / 1000) * finalScale;
      const groundH_m = (mapH / 1000) * finalScale;

      const metersPerLat = 111139;
      const metersPerLon = 111139 * Math.cos((origCenterLat * Math.PI) / 180);

      const deltaLat = groundH_m / metersPerLat;
      const deltaLon = groundW_m / metersPerLon;

      minLat = origCenterLat - deltaLat / 2;
      maxLat = origCenterLat + deltaLat / 2;
      minLon = origCenterLon - deltaLon / 2;
      maxLon = origCenterLon + deltaLon / 2;
    } else {
      // Mode Auto : calcul de l'échelle résultante
      const dLatMeters = Math.abs(maxLat - minLat) * 111139;
      finalScale = Math.round((dLatMeters / (mapH / 1000)) / 100) * 100;
    }

    const dKmWidth = ((mapW / 1000) * finalScale) / 1000;
    const dKmHeight = ((mapH / 1000) * finalScale) / 1000;
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const areaSubtitle = 'Zone couverte : ' + dKmWidth.toFixed(1) + ' km × ' + dKmHeight.toFixed(1) + ' km • Centre : Lat ' + origCenterLat.toFixed(4) + '°, Lon ' + origCenterLon.toFixed(4) + '° • ' + layerLabel + ' • Édité le ' + today;
    doc.text(areaSubtitle, marginX, subY);

    const actualBounds = [[minLat, minLon], [maxLat, maxLon]];

    // Détection de la (ou des) feuille(s) IGN TOP 25
    let ignSheetInfo = null;
    if (mapLayer === 'igntop25') {
      ignSheetInfo = this.getIgnSheetInfoForBounds(actualBounds);
    }

    // Tracé GPX optionnel
    const pseudoHike = {
      bounds: actualBounds,
      points: []
    };

    const srcHike = options.hike || null;
    if (srcHike) {
      let pts = srcHike.points;
      if ((!pts || pts.length === 0) && srcHike.rawGpx && typeof GPXParser !== 'undefined') {
        try {
          const parsed = GPXParser.parse(srcHike.rawGpx, srcHike.filename || 'trace.gpx');
          pts = parsed.points || [];
        } catch (e) { pts = []; }
      }
      if (pts && pts.length > 0) {
        pseudoHike.points = pts;
        pseudoHike.startPoint = srcHike.startPoint || { lat: pts[0].lat, lon: pts[0].lon };
        pseudoHike.endPoint = srcHike.endPoint || { lat: pts[pts.length - 1].lat, lon: pts[pts.length - 1].lon };
        pseudoHike.isLoop = !!srcHike.isLoop;
      }
    }

    // 5. Génération du fond de carte haute résolution
    try {
      const pxW = Math.round(mapW * 4.5);
      const pxH = Math.round(mapH * 4.5);
      const renderOpts = Object.assign({}, options, { showUtmGrid: false });
      const mapResult = await this.renderStaticMap(pseudoHike, pxW, pxH, mapLayer, 1.0, options.trackColor, renderOpts);
      const mapImgData = mapResult && mapResult.imgData ? mapResult.imgData : mapResult;

      if (mapImgData) {
        doc.addImage(mapImgData, 'JPEG', mapX, mapY, mapW, mapH);
      }
    } catch (err) {
      console.warn("Erreur export carte zone :", err);
    }

    // 6. Tracé vectoriel du Carroyage UTM et Coordonnées sur les Bords Latéraux (universel WGS84 mondial)
    const centerUtm = (typeof MapManager !== 'undefined') ? MapManager.latLonToUtm(origCenterLat, origCenterLon) : { zone: 31, band: 'T' };
    const zone = centerUtm.zone;
    const band = centerUtm.band;

    if (showUtm && typeof MapManager !== 'undefined') {
      const utmSW = MapManager.latLonToUtm(minLat, minLon);
      const utmNE = MapManager.latLonToUtm(maxLat, maxLon);
      const utmNW = MapManager.latLonToUtm(maxLat, minLon);
      const utmSE = MapManager.latLonToUtm(minLat, maxLon);

      const minE = Math.min(utmSW.easting, utmNE.easting, utmNW.easting, utmSE.easting);
      const maxE = Math.max(utmSW.easting, utmNE.easting, utmNW.easting, utmSE.easting);
      const minN = Math.min(utmSW.northing, utmNE.northing, utmNW.northing, utmSE.northing);
      const maxN = Math.max(utmSW.northing, utmNE.northing, utmNW.northing, utmSE.northing);

      const utmStep = 1000; // Carroyage 1 km x 1 km officiel TOP 25
      const startE = Math.floor(minE / utmStep) * utmStep;
      const endE = Math.ceil(maxE / utmStep) * utmStep;
      const startN = Math.floor(minN / utmStep) * utmStep;
      const endN = Math.ceil(maxN / utmStep) * utmStep;

      const lon2tileNorm = (lon) => (lon + 180) / 360;
      const lat2tileNorm = (lat) => (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2;

      const minTx = lon2tileNorm(minLon);
      const maxTx = lon2tileNorm(maxLon);
      const minTy = lat2tileNorm(maxLat);
      const maxTy = lat2tileNorm(minLat);

      const latLonToPdfMm = (lat, lon) => {
        const tx = lon2tileNorm(lon);
        const ty = lat2tileNorm(lat);
        const xFrac = (tx - minTx) / (maxTx - minTx);
        const yFrac = (ty - minTy) / (maxTy - minTy);
        return {
          x: mapX + xFrac * mapW,
          y: mapY + yFrac * mapH
        };
      };

      // 6.A LIGNES HORIZONTALES (Northing N) ET VALEURS SUR LES BORDS LATÉRAUX (Gauche & Droite)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA3 ? 7.5 : 6.2);

      for (let n = startN; n <= endN; n += utmStep) {
        const nSteps = 10;
        const pts = [];
        for (let s = 0; s <= nSteps; s++) {
          const currE = minE + (s / nSteps) * (maxE - minE);
          const ll = MapManager.utmToLatLon(currE, n, zone, origCenterLat >= 0);
          pts.push(latLonToPdfMm(ll.lat, ll.lon));
        }

        // 1. Tracé de la ligne de carroyage bleue
        doc.setDrawColor(2, 132, 199); // Bleu Cyan TOP 25
        doc.setLineWidth(0.18);
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const x1 = Math.max(mapX, Math.min(mapX + mapW, p1.x));
          const y1 = Math.max(mapY, Math.min(mapY + mapH, p1.y));
          const x2 = Math.max(mapX, Math.min(mapX + mapW, p2.x));
          const y2 = Math.max(mapY, Math.min(mapY + mapH, p2.y));
          doc.line(x1, y1, x2, y2);
        }

        // 2. Graduations et Valeurs sur les BORDS LATÉRAUX (Gauche et Droite)
        const kmN = Math.round(n / 1000);
        const leftLl = MapManager.utmToLatLon(minE, n, zone, origCenterLat >= 0);
        const leftPt = latLonToPdfMm(leftLl.lat, leftLl.lon);
        const rightLl = MapManager.utmToLatLon(maxE, n, zone, origCenterLat >= 0);
        const rightPt = latLonToPdfMm(rightLl.lat, rightLl.lon);

        // Bord latéral gauche
        if (leftPt.y >= mapY + 2 && leftPt.y <= mapY + mapH - 2) {
          doc.setDrawColor(2, 132, 199);
          doc.setLineWidth(0.4);
          doc.line(mapX - 2.5, leftPt.y, mapX, leftPt.y); // Tick vers l'extérieur

          doc.setTextColor(2, 132, 199);
          doc.text(String(kmN), mapX - 3.2, leftPt.y + 0.8, { align: 'right' });
        }

        // Bord latéral droit
        if (rightPt.y >= mapY + 2 && rightPt.y <= mapY + mapH - 2) {
          doc.setDrawColor(2, 132, 199);
          doc.setLineWidth(0.4);
          doc.line(mapX + mapW, rightPt.y, mapX + mapW + 2.5, rightPt.y); // Tick vers l'extérieur

          doc.setTextColor(2, 132, 199);
          doc.text(String(kmN), mapX + mapW + 3.2, rightPt.y + 0.8, { align: 'left' });
        }
      }

      // 6.B LIGNES VERTICALES (Easting E) ET VALEURS SUR LES BORDS HAUT ET BAS
      for (let e = startE; e <= endE; e += utmStep) {
        const nSteps = 10;
        const pts = [];
        for (let s = 0; s <= nSteps; s++) {
          const currN = minN + (s / nSteps) * (maxN - minN);
          const ll = MapManager.utmToLatLon(e, currN, zone, origCenterLat >= 0);
          pts.push(latLonToPdfMm(ll.lat, ll.lon));
        }

        doc.setDrawColor(2, 132, 199);
        doc.setLineWidth(0.18);
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const x1 = Math.max(mapX, Math.min(mapX + mapW, p1.x));
          const y1 = Math.max(mapY, Math.min(mapY + mapH, p1.y));
          const x2 = Math.max(mapX, Math.min(mapX + mapW, p2.x));
          const y2 = Math.max(mapY, Math.min(mapY + mapH, p2.y));
          doc.line(x1, y1, x2, y2);
        }

        const kmE = Math.round(e / 1000);
        const topLl = MapManager.utmToLatLon(e, maxN, zone, origCenterLat >= 0);
        const topPt = latLonToPdfMm(topLl.lat, topLl.lon);
        const botLl = MapManager.utmToLatLon(e, minN, zone, origCenterLat >= 0);
        const botPt = latLonToPdfMm(botLl.lat, botLl.lon);

        // Bord supérieur
        if (topPt.x >= mapX + 3 && topPt.x <= mapX + mapW - 3) {
          doc.setDrawColor(2, 132, 199);
          doc.setLineWidth(0.4);
          doc.line(topPt.x, mapY - 2.5, topPt.x, mapY);

          doc.setTextColor(2, 132, 199);
          doc.text(String(kmE), topPt.x, mapY - 3, { align: 'center' });
        }

        // Bord inférieur
        if (botPt.x >= mapX + 3 && botPt.x <= mapX + mapW - 3) {
          doc.setDrawColor(2, 132, 199);
          doc.setLineWidth(0.4);
          doc.line(botPt.x, mapY + mapH, botPt.x, mapY + mapH + 2.5);

          doc.setTextColor(2, 132, 199);
          doc.text(String(kmE), botPt.x, mapY + mapH + 4.8, { align: 'center' });
        }
      }
    }

    // 6.C MENTION VERTICALE DE LA FEUILLE IGN TOP 25 SUR LE CÔTÉ DROIT DE LA CARTE IMPRIMÉE
    if (ignSheetInfo && ignSheetInfo.verticalText) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA3 ? 7.2 : 5.8);
      doc.setTextColor(30, 41, 59); // Slate 800 - Typographie officielle de marge cartographique
      
      // Positionnée dans la marge droite (à 7.5 mm du bord physique de la feuille)
      // En rotation 270°, pour centrer verticalement sans que align:'center' ne décale le X horizontalement dans la carte :
      const vTextWidth = doc.getTextWidth(ignSheetInfo.verticalText);
      const x_ign = pageWidth - (isA3 ? 7.5 : 6.2);
      const y_start = (mapY + (mapH / 2)) + (vTextWidth / 2);
      doc.text(ignSheetInfo.verticalText, x_ign, y_start, { angle: 270 });
    }

    // 7. Cadre principal de la carte
    doc.setDrawColor(15, 23, 42); // Slate 900
    doc.setLineWidth(0.5);
    doc.rect(mapX, mapY, mapW, mapH);

    // 8. Coordonnées GPS (Lat/Lon) aux quatre coins
    if (showCoords) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA3 ? 6.5 : 5.2);

      const tlText = 'Lat ' + maxLat.toFixed(4) + '° • Lon ' + minLon.toFixed(4) + '°';
      const tlW = doc.getTextWidth(tlText) + 3;
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(mapX + 1.5, mapY + 1.5, tlW, 4.2, 0.8, 0.8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(tlText, mapX + 3, mapY + 4.5);

      const trText = 'Lat ' + maxLat.toFixed(4) + '° • Lon ' + maxLon.toFixed(4) + '°';
      const trW = doc.getTextWidth(trText) + 3;
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(mapX + mapW - trW - 1.5, mapY + 1.5, trW, 4.2, 0.8, 0.8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(trText, mapX + mapW - trW, mapY + 4.5);

      const blText = 'Lat ' + minLat.toFixed(4) + '° • Lon ' + minLon.toFixed(4) + '°';
      const blW = doc.getTextWidth(blText) + 3;
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(mapX + 1.5, mapY + mapH - 5.7, blW, 4.2, 0.8, 0.8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(blText, mapX + 3, mapY + mapH - 2.7);

      const brText = 'Lat ' + minLat.toFixed(4) + '° • Lon ' + maxLon.toFixed(4) + '°';
      const brW = doc.getTextWidth(brText) + 3;
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(mapX + mapW - brW - 1.5, mapY + mapH - 5.7, brW, 4.2, 0.8, 0.8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(brText, mapX + mapW - brW, mapY + mapH - 2.7);
    }

    // 9. CARTOUCHE BAS : ÉCHELLE VRAIE AVEC LE CENTIMÈTRE, RÈGLE GRADUÉE ET MENTION UTM
    const calibY = mapY + mapH + 6.5;

    // 9.A Segment d'étalonnage physique : EXACTEMENT 1 CM SUR LE PAPIER (10 mm)
    const calibX = mapX;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.7);
    doc.line(calibX, calibY, calibX + 10, calibY); // 10 mm = 1.0 cm strict
    doc.line(calibX, calibY - 2.5, calibX, calibY + 2.5);
    doc.line(calibX + 10, calibY - 2.5, calibX + 10, calibY + 2.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isA3 ? 7.5 : 6.5);
    doc.setTextColor(15, 23, 42);
    doc.text("1 cm", calibX + 5, calibY - 3, { align: 'center' });

    const metersPerCm = finalScale / 100;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isA3 ? 7 : 6);
    doc.setTextColor(5, 150, 105); // Émeraude foncé
    const cmInMetersText = '= ' + (metersPerCm >= 1000 ? (metersPerCm / 1000) + ' km' : metersPerCm + ' m');
    doc.text(cmInMetersText, calibX + 5, calibY + 4.2, { align: 'center' });

    // 9.B Règle graduée multi-centimètres (4 cm = 40 mm)
    const barX = calibX + 22;
    const barY = calibY - 1.5;
    const barH = 2.8;
    const cmSegments = 4;
    for (let c = 0; c < cmSegments; c++) {
      const segX = barX + (c * 10);
      doc.setFillColor(c % 2 === 0 ? 15 : 255, c % 2 === 0 ? 23 : 255, c % 2 === 0 ? 42 : 255);
      doc.rect(segX, barY, 10, barH, 'F');
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.2);
      doc.rect(segX, barY, 10, barH, 'S');

      const distM = c * metersPerCm;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(71, 85, 105);
      const label = distM === 0 ? '0' : (distM >= 1000 ? (distM / 1000) + 'km' : distM + 'm');
      doc.text(label, segX, barY - 1, { align: 'center' });
    }
    const totalDistM = cmSegments * metersPerCm;
    const finalLabel = totalDistM >= 1000 ? (totalDistM / 1000) + ' km' : totalDistM + ' m';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(71, 85, 105);
    doc.text(finalLabel, barX + (cmSegments * 10), barY - 1, { align: 'center' });

    // 9.C Descriptif d'échelle vraie & Feuille IGN
    const infoX = barX + (cmSegments * 10) + 7;
    const paperW = Math.round(pageWidth);
    const paperH = Math.round(pageHeight);

    // Espace horizontal maximal disponible avant le bloc UTM de droite
    const utmBlockW = (showUtm && typeof MapManager !== 'undefined') ? (isA3 ? 72 : 58) : 0;
    const maxInfoW = (mapX + mapW - utmBlockW - 5) - infoX;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isA3 ? 8.5 : 7.2);
    doc.setTextColor(15, 23, 42);
    doc.text('ÉCHELLE VRAIE 1 : ' + finalScale.toLocaleString('fr-FR'), infoX, calibY - 0.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isA3 ? 6.2 : 5.2);
    doc.setTextColor(71, 85, 105);
    const scaleLine = '1 cm papier = ' + (metersPerCm >= 1000 ? (metersPerCm / 1000) + ' km' : metersPerCm + ' m') + ' terrain • Format ' + format.toUpperCase() + ' (' + paperW + ' × ' + paperH + ' mm)';
    doc.text(scaleLine, infoX, calibY + 2.2);

    // Ligne complémentaire : Référence officielle IGN TOP 25 ou Satellite
    if (ignSheetInfo && ignSheetInfo.primary) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA3 ? 6 : 5);
      doc.setTextColor(30, 41, 59);
      const ignRefText = 'Réf. commerciale : TOP 25 n° ' + ignSheetInfo.primary.label + ' (Éd. ' + ignSheetInfo.primary.annee + ')';
      const truncatedRef = doc.getTextWidth(ignRefText) > maxInfoW ? (ignRefText.substring(0, 45) + '...') : ignRefText;
      doc.text(truncatedRef, infoX, calibY + 5.0);
    } else if (mapLayer === 'satellite') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA3 ? 6 : 5);
      doc.setTextColor(14, 116, 144);
      const satText = '🛰️ ' + (window.MapManagerInstance && window.MapManagerInstance.currentSatelliteDateStr ? window.MapManagerInstance.currentSatelliteDateStr : 'Imagerie Satellite Haute Définition');
      doc.text(satText, infoX, calibY + 5.0);
    }

    // 9.D Mention UTM et fuseau
    if (showUtm && typeof MapManager !== 'undefined') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA3 ? 7 : 6);
      doc.setTextColor(2, 132, 199);
      doc.text('🌐 Carroyage UTM WGS84 • Fuseau ' + zone + band + ' (1 km × 1 km)', mapX + mapW, calibY - 0.5, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isA3 ? 6 : 5);
      doc.setTextColor(100, 116, 139);
      doc.text('Valeurs kilométriques indiquées sur les bords latéraux', mapX + mapW, calibY + 3.0, { align: 'right' });
    }

    // 10. Téléchargement immédiat
    const safeTitle = (title || 'carte_extrait').replace(/[\\/:*?"<>|]/g, '_').substring(0, 40);
    const filename = safeTitle + '_1-' + finalScale + '_' + format + '.pdf';
    doc.save(filename);
  }

  static async renderStaticMap(hike, imgWidth = 720, imgHeight = 420, mapLayer = 'igntop25', customPadding = null, trackColor = null, options = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = imgWidth;
    canvas.height = imgHeight;
    const ctx = canvas.getContext('2d');

    // 1. Fond immédiat avant tout chargement
    ctx.fillStyle = '#e2e8f0'; // Fond neutre terre/mer
    ctx.fillRect(0, 0, imgWidth, imgHeight);

    if (!hike) return null;

    // 2. Assurer que les points de trace existent
    if ((!hike.points || hike.points.length === 0) && hike.rawGpx && typeof GPXParser !== 'undefined') {
      try {
        const parsed = GPXParser.parse(hike.rawGpx, hike.filename || 'trace.gpx');
        if (parsed.points && parsed.points.length > 0) {
          hike.points = parsed.points;
          hike.bounds = parsed.bounds;
        }
      } catch (e) {}
    }

    // 3. Calculer ou sécuriser les bounds
    let bounds = hike.bounds;
    if ((!bounds || !bounds[0] || !bounds[1]) && hike.points && hike.points.length > 0) {
      let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
      for (const p of hike.points) {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lon < minLon) minLon = p.lon;
        if (p.lon > maxLon) maxLon = p.lon;
      }
      bounds = [[minLat, minLon], [maxLat, maxLon]];
      hike.bounds = bounds;
    }

    if (!bounds || !bounds[0] || !bounds[1]) {
      const sp = hike.startPoint || { lat: 43.1189, lon: 5.8033 };
      bounds = [[sp.lat - 0.015, sp.lon - 0.015], [sp.lat + 0.015, sp.lon + 0.015]];
    }

    const minLat = bounds[0][0];
    const minLon = bounds[0][1];
    const maxLat = bounds[1][0];
    const maxLon = bounds[1][1];

    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;

    // Convertisseurs lat/lon vers coordonnées de tuiles Web Mercator
    const lon2tile = (lon, z) => ((lon + 180) / 360) * Math.pow(2, z);
    const lat2tile = (lat, z) =>
      ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, z);

    // Calcul du zoom maximal pour cadrer au plus près de la trace (zoom maximal juste autour de la trace)
    // Marge de 14% (0.86) par défaut, ou customPadding (ex: 0.96 pour extrait de carte)
    const padding = customPadding || 0.86;
    let zoom = 8;
    for (let z = 8; z <= 17; z++) {
      const tileDx = Math.abs(lon2tile(maxLon, z) - lon2tile(minLon, z));
      const tileDy = Math.abs(lat2tile(maxLat, z) - lat2tile(minLat, z));
      const pixW = tileDx * 256;
      const pixH = tileDy * 256;
      if (pixW <= imgWidth * padding && pixH <= imgHeight * padding) {
        zoom = z;
      } else {
        break;
      }
    }
    zoom = Math.max(7, Math.min(17, zoom));

    // Centrage mathématique parfait sur la boîte englobante de la trace
    const centerTileX = (lon2tile(minLon, zoom) + lon2tile(maxLon, zoom)) / 2;
    const centerTileY = (lat2tile(minLat, zoom) + lat2tile(maxLat, zoom)) / 2;

    const centerPixelX = imgWidth / 2;
    const centerPixelY = imgHeight / 2;

    const tilesAcross = Math.ceil(imgWidth / 256) + 2;
    const tilesDown = Math.ceil(imgHeight / 256) + 2;

    const startTileX = Math.floor(centerTileX - tilesAcross / 2);
    const startTileY = Math.floor(centerTileY - tilesDown / 2);

    // Détection si la randonnée est en France (IGN dessert la France métropolitaine + DOM)
    const isInsideFrance = (centerLat >= 41.0 && centerLat <= 51.5 && centerLon >= -5.5 && centerLon <= 10.0);

    // URLs des serveurs de tuiles cartographiques
    // Véritable IGN TOP 25 officiel (Scan 25 Touristique avec balisage GR® rose et rochers)
    const ignTop25Url = (x, y, z) => `https://data.geopf.fr/private/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}&FORMAT=image%2Fjpeg&apikey=ign_scan_ws`;

    const ignPlanUrl = (x, y, z) => `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}&FORMAT=image%2Fpng`;
    
    const openTopoUrl = (x, y, z) => {
      const sub = ['a', 'b', 'c'][Math.abs(x + y) % 3];
      return `https://${sub}.tile.opentopomap.org/${z}/${x}/${y}.png`;
    };
    
    const osmFrUrl = (x, y, z) => {
      const sub = ['a', 'b', 'c'][Math.abs(x + y) % 3];
      return `https://${sub}.tile.openstreetmap.fr/osmfr/${z}/${x}/${y}.png`;
    };
    
    const osmStdUrl = (x, y, z) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

    const esriSatUrl = (x, y, z) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

    const cartoLightUrl = (x, y, z) => {
      const sub = ['a', 'b', 'c', 'd'][Math.abs(x + y) % 4];
      return `https://${sub}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`;
    };
    const waymarkedHikingUrl = (x, y, z) => `https://tile.waymarkedtrails.org/hiking/${z}/${x}/${y}.png`;

    // Établir la cascade de fournisseurs selon le choix demandé
    let primaryUrlFn, fallbackUrlFn1, fallbackUrlFn2;
    let overlayUrlFn = null;
    let attributionText = '© IGN France / OpenStreetMap';

    if (mapLayer === 'ignplan') {
      if (isInsideFrance) {
        primaryUrlFn = ignPlanUrl;
        fallbackUrlFn1 = osmFrUrl;
        fallbackUrlFn2 = openTopoUrl;
        attributionText = '© IGN France - Plan Numérique v2';
      } else {
        primaryUrlFn = openTopoUrl;
        fallbackUrlFn1 = osmFrUrl;
        fallbackUrlFn2 = osmStdUrl;
        attributionText = '© OpenTopoMap / OpenStreetMap';
      }
    } else if (mapLayer === 'grmap') {
      primaryUrlFn = cartoLightUrl;
      fallbackUrlFn1 = osmFrUrl;
      fallbackUrlFn2 = osmStdUrl;
      overlayUrlFn = waymarkedHikingUrl;
      attributionText = '© OpenStreetMap / CARTO • Tracé GR® : Waymarked Trails';
    } else if (mapLayer === 'opentopo') {
      primaryUrlFn = openTopoUrl;
      fallbackUrlFn1 = isInsideFrance ? ignTop25Url : osmFrUrl;
      fallbackUrlFn2 = osmStdUrl;
      attributionText = '© OpenTopoMap / OpenStreetMap';
    } else if (mapLayer === 'osmfr') {
      primaryUrlFn = osmFrUrl;
      fallbackUrlFn1 = isInsideFrance ? ignTop25Url : openTopoUrl;
      fallbackUrlFn2 = osmStdUrl;
      attributionText = '© OpenStreetMap France';
    } else if (mapLayer === 'satellite') {
      primaryUrlFn = esriSatUrl;
      fallbackUrlFn1 = isInsideFrance ? ignTop25Url : osmStdUrl;
      fallbackUrlFn2 = osmStdUrl;
      attributionText = '© Esri World Imagery / IGN';
    } else {
      // 'igntop25' ou 'ign' par défaut : Vrai IGN TOP 25 officiel pour la France
      if (isInsideFrance) {
        primaryUrlFn = ignTop25Url;
        fallbackUrlFn1 = ignPlanUrl; // secours si besoin
        fallbackUrlFn2 = osmFrUrl;   // secours pour la mer / côtes
        attributionText = '© IGN France - Carte TOPO 25 (SCAN 25®)';
      } else {
        primaryUrlFn = openTopoUrl;
        fallbackUrlFn1 = osmFrUrl;
        fallbackUrlFn2 = osmStdUrl;
        attributionText = '© OpenTopoMap / OpenStreetMap';
      }
    }

    // Chargement d'une image avec délai maximal (évite les requêtes bloquées)
    const fetchTileImage = (url, timeoutMs = 8000) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) { settled = true; img.src = ''; resolve(null); }
        }, timeoutMs);
        img.onload = () => {
          if (settled) return;
          settled = true; clearTimeout(timer); resolve(img);
        };
        img.onerror = () => {
          if (settled) return;
          settled = true; clearTimeout(timer); resolve(null);
        };
        img.src = url;
      });
    };
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Fonction de chargement résiliente pour chaque tuile :
    // le fournisseur principal (ex: IGN) est réessayé plusieurs fois avant de basculer
    // sur un fournisseur de secours, pour garder un style cartographique homogène.
    const loadTile = async (tileX, tileY) => {
      const px = centerPixelX + (tileX - centerTileX) * 256;
      const py = centerPixelY + (tileY - centerTileY) * 256;

      const draw = (img) => {
        try { ctx.drawImage(img, px, py, 256, 256); } catch (e) {}
      };

      let baseDrawn = false;
      // 1. Fournisseur principal : 3 tentatives avec temporisation progressive
      const retryDelays = [0, 600, 1500];
      for (const delay of retryDelays) {
        if (delay) await sleep(delay);
        const img = await fetchTileImage(primaryUrlFn(tileX, tileY, zoom));
        if (img) { draw(img); baseDrawn = true; break; }
      }

      // 2. Secours uniquement si le principal reste indisponible (ex: mer hors couverture IGN)
      if (!baseDrawn) {
        for (const fn of [fallbackUrlFn1, fallbackUrlFn2]) {
          if (!fn) continue;
          const img = await fetchTileImage(fn(tileX, tileY, zoom));
          if (img) { draw(img); baseDrawn = true; break; }
        }
      }

      // 3. Surcouche éventuelle (ex: Réseau GR® Waymarked Trails sur fond épuré)
      if (overlayUrlFn && zoom <= 18) {
        const ovImg = await fetchTileImage(overlayUrlFn(tileX, tileY, zoom));
        if (ovImg) draw(ovImg);
      }
    };

    // File d'attente des tuiles, triées du centre vers l'extérieur
    const tileQueue = [];
    for (let tx = 0; tx < tilesAcross; tx++) {
      for (let ty = 0; ty < tilesDown; ty++) {
        tileQueue.push([startTileX + tx, startTileY + ty]);
      }
    }
    tileQueue.sort((a, b) =>
      Math.hypot(a[0] + 0.5 - centerTileX, a[1] + 0.5 - centerTileY) -
      Math.hypot(b[0] + 0.5 - centerTileX, b[1] + 0.5 - centerTileY)
    );

    // Téléchargement avec 6 requêtes simultanées maximum (évite la limitation du serveur IGN)
    const CONCURRENCY = 6;
    const worker = async () => {
      while (tileQueue.length > 0) {
        const [x, y] = tileQueue.shift();
        await loadTile(x, y);
      }
    };
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());

    // Attendre jusqu'à 45 secondes max (grands formats A3)
    await Promise.race([
      Promise.all(workers),
      new Promise(r => setTimeout(r, 45000))
    ]);

    // Helper: conversion (lat, lon) vers pixels canvas
    const latLonToPixel = (lat, lon) => {
      const tx = lon2tile(lon, zoom);
      const ty = lat2tile(lat, zoom);
      return {
        x: centerPixelX + (tx - centerTileX) * 256,
        y: centerPixelY + (ty - centerTileY) * 256
      };
    };

    // 0. Carroyage UTM kilométrique (si activé)
    if (typeof MapManager !== 'undefined' && options && options.showUtmGrid !== false) {
      try {
        const centerUtm = MapManager.latLonToUtm(centerLat, centerLon);
        const zone = centerUtm.zone;

        const utmSW = MapManager.latLonToUtm(minLat, minLon);
        const utmNE = MapManager.latLonToUtm(maxLat, maxLon);
        const utmNW = MapManager.latLonToUtm(maxLat, minLon);
        const utmSE = MapManager.latLonToUtm(minLat, maxLon);

        const minE = Math.min(utmSW.easting, utmNE.easting, utmNW.easting, utmSE.easting);
        const maxE = Math.max(utmSW.easting, utmNE.easting, utmNW.easting, utmSE.easting);
        const minN = Math.min(utmSW.northing, utmNE.northing, utmNW.northing, utmSE.northing);
        const maxN = Math.max(utmSW.northing, utmNE.northing, utmNW.northing, utmSE.northing);

        let step = 1000;
        if (zoom <= 9) step = 10000;
        else if (zoom <= 12) step = 2000;
        else step = 1000;

        const startE = Math.floor(minE / step) * step;
        const endE = Math.ceil(maxE / step) * step;
        const startN = Math.floor(minN / step) * step;
        const endN = Math.ceil(maxN / step) * step;

        const countE = Math.round((endE - startE) / step);
        const countN = Math.round((endN - startN) / step);

        if (countE <= 60 && countN <= 60 && countE >= 1 && countN >= 1) {
          ctx.save();
          const nSteps = 6;

          // 1. Liseré sous-jacent blanc pour contraste maximal sur forêts, reliefs et rochers
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.lineWidth = 3;
          ctx.setLineDash([]);

          for (let e = startE; e <= endE; e += step) {
            ctx.beginPath();
            let started = false;
            for (let s = 0; s <= nSteps; s++) {
              const currN = startN + (s / nSteps) * (endN - startN);
              const ll = MapManager.utmToLatLon(e, currN, zone, centerLat >= 0);
              const pix = latLonToPixel(ll.lat, ll.lon);
              if (!started) {
                ctx.moveTo(pix.x, pix.y);
                started = true;
              } else {
                ctx.lineTo(pix.x, pix.y);
              }
            }
            ctx.stroke();
          }

          for (let n = startN; n <= endN; n += step) {
            ctx.beginPath();
            let started = false;
            for (let s = 0; s <= nSteps; s++) {
              const currE = startE + (s / nSteps) * (endE - startE);
              const ll = MapManager.utmToLatLon(currE, n, zone, centerLat >= 0);
              const pix = latLonToPixel(ll.lat, ll.lon);
              if (!started) {
                ctx.moveTo(pix.x, pix.y);
                started = true;
              } else {
                ctx.lineTo(pix.x, pix.y);
              }
            }
            ctx.stroke();
          }

          // 2. Lignes principales Bleu Cartographique TOP 25
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);

          // Lignes verticales (Easting)
          for (let e = startE; e <= endE; e += step) {
            ctx.beginPath();
            let started = false;
            for (let s = 0; s <= nSteps; s++) {
              const currN = startN + (s / nSteps) * (endN - startN);
              const ll = MapManager.utmToLatLon(e, currN, zone, centerLat >= 0);
              const pix = latLonToPixel(ll.lat, ll.lon);
              if (!started) {
                ctx.moveTo(pix.x, pix.y);
                started = true;
              } else {
                ctx.lineTo(pix.x, pix.y);
              }
            }
            ctx.stroke();

            // Label kilométrique en bordure supérieure (toujours dégagée) et inférieure
            const botLL = MapManager.utmToLatLon(e, startN, zone, centerLat >= 0);
            const botPix = latLonToPixel(botLL.lat, botLL.lon);
            if (botPix.x >= 30 && botPix.x <= imgWidth - 30) {
              const labelText = String(Math.round(e / 1000));
              ctx.font = 'bold 12px monospace';
              const textW = ctx.measureText(labelText).width;
              const boxW = Math.max(textW + 10, 32);
              const boxH = 16;

              // Bordure haute (invariablement visible)
              ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
              ctx.fillRect(botPix.x - boxW / 2, 4, boxW, boxH);
              ctx.strokeStyle = '#0284c7';
              ctx.lineWidth = 1.2;
              ctx.strokeRect(botPix.x - boxW / 2, 4, boxW, boxH);
              ctx.fillStyle = '#0369a1';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelText, botPix.x, 4 + boxH / 2);

              // Bordure basse (si non recouverte par les badges d'angle)
              if (botPix.x > 280 && botPix.x < imgWidth - 250) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                ctx.fillRect(botPix.x - boxW / 2, imgHeight - boxH - 4, boxW, boxH);
                ctx.strokeStyle = '#0284c7';
                ctx.lineWidth = 1.2;
                ctx.strokeRect(botPix.x - boxW / 2, imgHeight - boxH - 4, boxW, boxH);
                ctx.fillStyle = '#0369a1';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(labelText, botPix.x, imgHeight - boxH / 2 - 4);
              }
            }
          }

          // Lignes horizontales (Northing)
          for (let n = startN; n <= endN; n += step) {
            ctx.beginPath();
            let started = false;
            for (let s = 0; s <= nSteps; s++) {
              const currE = startE + (s / nSteps) * (endE - startE);
              const ll = MapManager.utmToLatLon(currE, n, zone, centerLat >= 0);
              const pix = latLonToPixel(ll.lat, ll.lon);
              if (!started) {
                ctx.moveTo(pix.x, pix.y);
                started = true;
              } else {
                ctx.lineTo(pix.x, pix.y);
              }
            }
            ctx.stroke();

            // Label kilométrique en bordure gauche
            const leftLL = MapManager.utmToLatLon(startE, n, zone, centerLat >= 0);
            const leftPix = latLonToPixel(leftLL.lat, leftLL.lon);
            if (leftPix.y >= 30 && leftPix.y <= imgHeight - 30) {
              const labelText = String(Math.round(n / 1000));
              ctx.font = 'bold 12px monospace';
              const textW = ctx.measureText(labelText).width;
              const boxW = Math.max(textW + 10, 42);
              const boxH = 16;
              ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
              ctx.fillRect(4, leftPix.y - boxH / 2, boxW, boxH);
              ctx.strokeStyle = '#0284c7';
              ctx.lineWidth = 1.2;
              ctx.strokeRect(4, leftPix.y - boxH / 2, boxW, boxH);
              ctx.fillStyle = '#0369a1';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelText, 4 + boxW / 2, leftPix.y);
            }
          }

          ctx.restore();
        }
      } catch (e) {
        console.warn("Erreur tracé carroyage UTM :", e);
      }
    }

    // Dessiner le tracé GPX avec contraste maximal absolu
    if (hike.points && hike.points.length > 0) {
      const finalTrackColor = trackColor || '#1d4ed8'; // Bleu Roi Électrique par défaut (contraste maximal sur Top 25)

      // 1. Bordure d'ombre externe sombre (détache le halo blanc même sur fond blanc/neige/rochers clairs)
      ctx.beginPath();
      let first = latLonToPixel(hike.points[0].lat, hike.points[0].lon);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < hike.points.length; i++) {
        const pt = latLonToPixel(hike.points[i].lat, hike.points[i].lon);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)'; // Liseré sombre 10px
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 2. Halo blanc pur très contrasté (détache la trace des forêts vertes et sentiers GR roses)
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < hike.points.length; i++) {
        const pt = latLonToPixel(hike.points[i].lat, hike.points[i].lon);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 3. Tracé principal Bleu Roi Électrique (ou couleur personnalisée)
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < hike.points.length; i++) {
        const pt = latLonToPixel(hike.points[i].lat, hike.points[i].lon);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = finalTrackColor;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 4. Chevrons directionnels (flèches blanches) le long du tracé pour certifier le sens du parcours
      let accumulatedDist = 0;
      const arrowSpacing = 65; // pixels
      for (let i = 1; i < hike.points.length; i++) {
        const p1 = latLonToPixel(hike.points[i - 1].lat, hike.points[i - 1].lon);
        const p2 = latLonToPixel(hike.points[i].lat, hike.points[i].lon);
        const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        accumulatedDist += segLen;
        if (accumulatedDist >= arrowSpacing && segLen > 4) {
          accumulatedDist = 0;
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          
          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(-3.5, -3);
          ctx.lineTo(2.5, 0);
          ctx.lineTo(-3.5, 3);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
          ctx.restore();
        }
      }

      // 5. Marqueur de départ (Pastille verte 'D' avec halo blanc)
      const startPix = latLonToPixel(hike.startPoint.lat, hike.startPoint.lon);
      ctx.beginPath();
      ctx.arc(startPix.x, startPix.y, 9.5, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('D', startPix.x, startPix.y + 0.5);

      // 6. Marqueur d'arrivée (si hors boucle : Pastille rouge 'A')
      if (!hike.isLoop && hike.endPoint) {
        const endPix = latLonToPixel(hike.endPoint.lat, hike.endPoint.lon);
        ctx.beginPath();
        ctx.arc(endPix.x, endPix.y, 9.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('A', endPix.x, endPix.y + 0.5);
      }
    }

    // 7. Légende élégante en bas à gauche (uniquement si un tracé de randonnée est présent)
    if (hike.points && hike.points.length > 0) {
      const finalTrackColor = trackColor || '#1d4ed8';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      if (ctx.roundRect) {
        ctx.roundRect(10, imgHeight - 30, 260, 22, 5);
      } else {
        ctx.rect(10, imgHeight - 30, 260, 22);
      }
      ctx.fill();

      // Pastille verte Départ D
      ctx.beginPath();
      ctx.arc(22, imgHeight - 19, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Pastille rouge Arrivée A
      ctx.beginPath();
      ctx.arc(92, imgHeight - 19, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Trait Tracé GPX (Double contour Blanc + Bleu Roi)
      ctx.beginPath();
      ctx.moveTo(160, imgHeight - 19);
      ctx.lineTo(182, imgHeight - 19);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(160, imgHeight - 19);
      ctx.lineTo(182, imgHeight - 19);
      ctx.strokeStyle = finalTrackColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText("Départ", 32, imgHeight - 16);
      ctx.fillText("Arrivée", 102, imgHeight - 16);
      ctx.fillText("Tracé GPX", 190, imgHeight - 16);
    }

    // 6. Mention de copyright & Échelle cartographique en bas à droite
    const metersPerPixel = (40075016.686 * Math.cos((centerLat * Math.PI) / 180)) / (256 * Math.pow(2, zoom));
    const numericScale = Math.round(metersPerPixel * 3779.5275);
    let scaleBadgeText = `Échelle ~ 1 : ${numericScale.toLocaleString('fr-FR')}`;
    if (numericScale >= 21000 && numericScale <= 29000) {
      scaleBadgeText = `Échelle 1 : 25 000 (TOP 25)`;
    }
    const fullAttribution = `${scaleBadgeText} • ${attributionText}`;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    const textWidth = ctx.measureText(fullAttribution).width;
    if (ctx.roundRect) {
      ctx.roundRect(imgWidth - textWidth - 22, imgHeight - 22, textWidth + 16, 16, 3);
    } else {
      ctx.rect(imgWidth - textWidth - 22, imgHeight - 22, textWidth + 16, 16);
    }
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(fullAttribution, imgWidth - textWidth - 14, imgHeight - 10);

    return {
      imgData: canvas.toDataURL('image/jpeg', 0.92),
      zoom,
      centerTileX,
      centerTileY,
      imgWidth,
      imgHeight
    };
  }

  /**
   * Find the best corners on the map that have zero collision with the GPS track
   * Returns a list of corners sorted from best (furthest from track, zero collision) to worst
   */
  static findBestCorners(hike, mapW, mapH, cardW, cardH, imgWidth, imgHeight, zoom, centerTileX, centerTileY) {
    const lon2tile = (lon, z) => ((lon + 180) / 360) * Math.pow(2, z);
    const lat2tile = (lat, z) =>
      ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, z);

    const centerPixelX = imgWidth / 2;
    const centerPixelY = imgHeight / 2;

    const latLonToPix = (lat, lon) => {
      const tx = lon2tile(lon, zoom);
      const ty = lat2tile(lat, zoom);
      return {
        x: centerPixelX + (tx - centerTileX) * 256,
        y: centerPixelY + (ty - centerTileY) * 256
      };
    };

    // Candidate corners (relative mm coordinates within the map area)
    const corners = [
      { name: 'top-left', rx: 4, ry: 4 },
      { name: 'top-right', rx: mapW - cardW - 4, ry: 4 },
      { name: 'bottom-right', rx: mapW - cardW - 4, ry: mapH - cardH - 4 },
      { name: 'bottom-left', rx: 4, ry: mapH - cardH - 12 } // Above the bottom-left legend bar
    ];

    const pts = (hike.points && hike.points.length > 0) ? hike.points : [];
    if (pts.length === 0) {
      return corners.map(c => ({ ...c, cardW, cardH, inside: 0, minDist: 9999, score: 100000 }));
    }

    // Sample up to 300 points for high accuracy & fast performance
    const step = Math.max(1, Math.floor(pts.length / 300));
    const sampledPix = [];
    for (let i = 0; i < pts.length; i += step) {
      sampledPix.push(latLonToPix(pts[i].lat, pts[i].lon));
    }

    const scored = corners.map(c => {
      // Convert mm to pixels on canvas
      const cpx = (c.rx / mapW) * imgWidth;
      const cpy = (c.ry / mapH) * imgHeight;
      const cpw = (cardW / mapW) * imgWidth;
      const cph = (cardH / mapH) * imgHeight;

      // 15px security buffer around the card
      const buf = 15;
      const bx1 = cpx - buf;
      const bx2 = cpx + cpw + buf;
      const by1 = cpy - buf;
      const by2 = cpy + cph + buf;

      const ccx = cpx + cpw / 2;
      const ccy = cpy + cph / 2;

      let inside = 0;
      let minDist = 999999;

      for (const p of sampledPix) {
        if (p.x >= bx1 && p.x <= bx2 && p.y >= by1 && p.y <= by2) {
          inside++;
        }
        const d = Math.hypot(p.x - ccx, p.y - ccy);
        if (d < minDist) minDist = d;
      }

      // Priority: 0 points inside, then maximize distance from track
      const score = inside === 0 ? (100000 + minDist) : (-inside * 1000 + minDist);

      return {
        ...c,
        cardW,
        cardH,
        inside,
        minDist,
        score
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }
}

window.PDFExporter = PDFExporter;
