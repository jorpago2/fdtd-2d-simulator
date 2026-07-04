(function initFdtdCanvasSourceOverlays() {
  "use strict";

  Object.assign(FDTDSim.prototype, {
    drawSourceMarkers() {
      for (const source of state.sources) {
        this.drawSourceMarker(source);
      }
    },

    drawSourceMarker(source) {
      const sx = this.sourceXCell(source);
      const sy = this.sourceYCell(source);
      const x = this.gridToCanvasX(sx + 0.5);
      const y = this.gridToCanvasY(sy + 0.5);
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const viewport = this.renderViewport();
      const margin = 12 * dpr;
      const isLineLike = lineLikeIncidentSourceShapes.has(source.shape);
      if (isLineLike && (x < viewport.left - margin || x > viewport.right + margin)) return;
      if (!isLineLike && (x < viewport.left - margin || x > viewport.right + margin || y < viewport.top - margin || y > viewport.bottom + margin)) return;
      this.ctx.save();
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      this.ctx.lineWidth = Math.max(1, dpr);
      if (source.id === state.selectedSourceId) {
        this.drawSourceSelectionHalo(x, y, source);
      } else if (source.id === state.hoveredSourceId) {
        this.drawSourceHoverHalo(x, y, source);
      }
      if (source.shape === "line" || source.shape === "evanescentLine") {
        const markerMarginY = Math.min(36 * dpr, Math.max(0, viewport.height * 0.36));
        const markerY = clamp(y, viewport.top + markerMarginY, viewport.bottom - markerMarginY);
        this.ctx.beginPath();
        this.ctx.moveTo(x, viewport.top + 8 * dpr);
        this.ctx.lineTo(x, viewport.bottom - 8 * dpr);
        this.ctx.stroke();
        if (source.shape === "line") {
          this.drawSourceWaveVectorArrow(x, markerY, source);
        }
        if (source.shape === "evanescentLine") {
          const { alpha } = this.evanescentWaveNumbers(source);
          const decayPixels = (1 / Math.max(alpha, 1e-9)) * viewport.pixelsPerCell;
          const arrowLength = Math.max(18 * dpr, Math.min(70 * dpr, decayPixels * 2.5));
          this.drawOverlayArrow(x + 7 * dpr, markerY, x + 7 * dpr + arrowLength, markerY, true);
          this.drawOverlayLabel("ev", x + 14 * dpr + arrowLength, markerY, "left", true);
        }
      } else if (source.shape === "gaussianProfile" || source.shape === "modeProfile") {
        const fwhm = state.preset === "customSlab" ? this.slabCoreThicknessCells() : Math.max(4, Math.round(this.ny * 0.09));
        const modalWindow = Math.max(4, Math.round((Number(source.widthLambda) || 1.15) * state.cellsPerWavelength));
        const halfHeight = (source.shape === "modeProfile" ? modalWindow : fwhm) * 0.5 * viewport.pixelsPerCell;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - halfHeight);
        this.ctx.lineTo(x, y + halfHeight);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3 * Math.max(1, window.devicePixelRatio || 1), 0, Math.PI * 2);
        this.ctx.stroke();
        if (source.shape === "gaussianProfile") {
          this.drawSourceWaveVectorArrow(x, y, source, {
            startPad: Math.max(8 * dpr, Math.min(18 * dpr, halfHeight * 0.14)),
          });
        }
        if (source.shape === "modeProfile") this.drawOverlayLabel("mode", x + 12 * dpr, y, "left", true);
      } else if (localizedSourceShapes.has(source.shape) || inPlaneElectricCurrentShapes.has(source.shape)) {
        this.drawAnalyticSourceGlyph(x, y, source);
      } else {
        this.drawPointSourceGlyph(x, y);
      }
      this.ctx.restore();
    },

    drawSourceWaveVectorArrow(x, y, source, options = {}) {
      if (state.viewProjection !== "2d" || !this.isTfsfIncidentSource?.(source)) return;

      const ctx = this.ctx;
      const viewport = this.renderViewport();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const { x: ux, y: uy } = this.sourceIncidentCanvasDirection(source);
      const length = Number.isFinite(Number(options.length)) ? Number(options.length) : 38 * dpr;
      const startPad = Number.isFinite(Number(options.startPad)) ? Number(options.startPad) : 8 * dpr;
      const x0 = x + ux * startPad;
      const y0 = y + uy * startPad;
      const x1 = x + ux * (startPad + length);
      const y1 = y + uy * (startPad + length);
      const labelMarginX = Math.min(16 * dpr, Math.max(0, viewport.width * 0.45));
      const labelMarginY = Math.min(16 * dpr, Math.max(0, viewport.height * 0.45));
      const labelX = clamp(x1 + ux * 12 * dpr, viewport.left + labelMarginX, viewport.right - labelMarginX);
      const labelY = clamp(y1 + uy * 12 * dpr, viewport.top + labelMarginY, viewport.bottom - labelMarginY);

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      this.drawOverlayArrow(x0, y0, x1, y1, true);
      this.drawOverlayLabel("k", labelX, labelY, "center", true);
      ctx.restore();
    },

    sourceIncidentCanvasDirection(source) {
      const theta = ((Number(source?.angleDeg) || 0) * Math.PI) / 180;
      return {
        x: Math.cos(theta),
        // Incident-field phases use grid y, which maps to positive canvas y.
        y: Math.sin(theta),
      };
    },

    drawSourceSelectionHalo(x, y, source) {
      const ctx = this.ctx;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const radius =
        localizedSourceShapes.has(source.shape) || inPlaneElectricCurrentShapes.has(source.shape)
          ? this.sourceFwhmCanvasRadius(source) + 6 * dpr
          : 18 * dpr;
      const isMoving = dragState.source.pointerId != null && dragState.source.entityId === source.id;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isMoving ? "rgba(255, 178, 74, 0.12)" : "rgba(0, 112, 244, 0.08)";
      ctx.fill();
      ctx.strokeStyle = isMoving ? "rgba(196, 112, 16, 0.96)" : "rgba(0, 112, 244, 0.9)";
      ctx.lineWidth = (isMoving ? 2.6 : 2.1) * dpr;
      ctx.setLineDash(isMoving ? [] : [5 * dpr, 4 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x, y, radius + 4 * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = isMoving ? "rgba(255, 238, 198, 0.7)" : "rgba(255, 255, 255, 0.58)";
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
      this.drawOverlayLabel(isMoving ? `moving S${source.id}` : `S${source.id}`, x + radius + 10 * dpr, y, "left");
      ctx.restore();
    },

    drawSourceHoverHalo(x, y, source) {
      const ctx = this.ctx;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const radius =
        localizedSourceShapes.has(source.shape) || inPlaneElectricCurrentShapes.has(source.shape)
          ? this.sourceFwhmCanvasRadius(source) + 5 * dpr
          : 16 * dpr;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(69, 192, 201, 0.78)";
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
      this.drawOverlayLabel(`S${source.id}`, x + radius + 10 * dpr, y, "left");
      ctx.restore();
    },

    drawPointSourceGlyph(x, y) {
      const ctx = this.ctx;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const radius = 7 * dpr;
      const arm = 13 * dpr;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.moveTo(x - arm, y);
      ctx.lineTo(x - radius - 2 * dpr, y);
      ctx.moveTo(x + radius + 2 * dpr, y);
      ctx.lineTo(x + arm, y);
      ctx.moveTo(x, y - arm);
      ctx.lineTo(x, y - radius - 2 * dpr);
      ctx.moveTo(x, y + radius + 2 * dpr);
      ctx.lineTo(x, y + arm);
      this.strokeOverlayPath(5 * dpr, 2 * dpr);

      ctx.beginPath();
      ctx.arc(x, y, 2.2 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(5, 11, 15, 0.94)";
      ctx.fill();
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
      ctx.stroke();
    },

    drawAnalyticSourceGlyph(x, y, source) {
      const ctx = this.ctx;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const radius = this.sourceFwhmCanvasRadius(source);
      const theta = (source.angleDeg * Math.PI) / 180;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.strokeOverlayPath(5 * dpr, 2 * dpr);

      ctx.beginPath();
      ctx.arc(x, y, 2.3 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(5, 11, 15, 0.94)";
      ctx.fill();

      if (source.shape === "gaussianSpot") return;

      const dx = Math.cos(theta) * radius;
      const dy = -Math.sin(theta) * radius;
      const wing = Math.PI / 6;
      const head = 8 * dpr;
      const angle = Math.atan2(dy, dx);
      const x0 = x - dx;
      const y0 = y - dy;
      const x1 = x + dx;
      const y1 = y + dy;

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - head * Math.cos(angle - wing), y1 - head * Math.sin(angle - wing));
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - head * Math.cos(angle + wing), y1 - head * Math.sin(angle + wing));

      if (source.shape === "quadrupole" || source.shape === "multipole") {
        const crossDx = -dy * 0.45;
        const crossDy = dx * 0.45;
        ctx.moveTo(x - crossDx, y - crossDy);
        ctx.lineTo(x + crossDx, y + crossDy);
      }

      this.strokeOverlayPath(5 * dpr, 2 * dpr);

      if (circularDipoleSourceShapes.has(source.shape)) {
        const spinRadius = Math.max(8 * dpr, radius * 0.42);
        const spinSign = source.shape === "circularDipoleCw" ? 1 : -1;
        const start = theta + spinSign * 0.15;
        const end = theta + spinSign * 1.65 * Math.PI;
        const headAngle = end + spinSign * Math.PI * 0.5;
        const hx = x + spinRadius * Math.cos(end);
        const hy = y - spinRadius * Math.sin(end);
        ctx.beginPath();
        ctx.arc(x, y, spinRadius, -start, -end, spinSign < 0);
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - 6 * dpr * Math.cos(headAngle - 0.45), hy + 6 * dpr * Math.sin(headAngle - 0.45));
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - 6 * dpr * Math.cos(headAngle + 0.45), hy + 6 * dpr * Math.sin(headAngle + 0.45));
        this.strokeOverlayPath(4 * dpr, 1.6 * dpr);
        this.drawOverlayLabel(source.shape === "circularDipoleCw" ? "+90" : "-90", x + radius + 14 * dpr, y, "left");
        return;
      }

      if (source.shape === "janusDipole") {
        this.drawOverlayLabel("Janus", x + radius + 14 * dpr, y, "left");
        return;
      }

      if (source.shape === "huygens") {
        this.drawOverlayLabel("Huygens", x + radius + 14 * dpr, y, "left");
        return;
      }

      if (inPlaneElectricCurrentShapes.has(source.shape)) {
        this.drawOverlayLabel("J||", x + radius + 14 * dpr, y, "left");
        return;
      }

      if (source.shape === "pointDipole") {
        this.drawOverlayLabel("p", x + radius + 14 * dpr, y, "left");
        return;
      }

      if (source.shape === "multipole") {
        this.drawOverlayLabel(`n=${this.localizedSourceOrder("multipole", source)}`, x + radius + 14 * dpr, y, "left");
      }
    },

    sourceAtClientPoint(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const cx = (clientX - rect.left) * dpr;
      const cy = (clientY - rect.top) * dpr;
      let best = null;
      let bestDistance = Infinity;
      for (const source of state.sources) {
        const sx = this.sourceXCell(source);
        const sy = this.sourceYCell(source);
        const x = this.gridToCanvasX(sx + 0.5);
        const y = this.gridToCanvasY(sy + 0.5);
        const distance =
          lineLikeIncidentSourceShapes.has(source.shape) || source.shape === "gaussianProfile"
            ? Math.abs(cx - x)
            : Math.hypot(cx - x, cy - y);
        const radius = this.sourceHitRadius(source);
        if (distance <= radius && distance < bestDistance) {
          best = source;
          bestDistance = distance;
        }
      }
      return best;
    },

    sourceHitRadius(source) {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      if (localizedSourceShapes.has(source.shape) || inPlaneElectricCurrentShapes.has(source.shape)) {
        return Math.max(18 * dpr, this.sourceFwhmCanvasRadius(source) + 8 * dpr);
      }
      if (lineLikeIncidentSourceShapes.has(source.shape)) return 18 * dpr;
      if (source.shape === "gaussianProfile") return 22 * dpr;
      return 18 * dpr;
    },
  });
})();
