(function initFdtdCanvasReferenceOverlays() {
  "use strict";

  Object.assign(FDTDSim.prototype, {
    drawReferenceOverlay() {
      if (visualLayerEnabled("scale")) {
        this.drawScaleBarOverlay();
      }
      if (visualLayerEnabled("axes")) {
        this.drawAxisGlyphOverlay();
      }
      if (visualLayerEnabled("diagnostics")) {
        this.drawWaveVectorGlyphOverlay();
      }
    },

    drawScaleBarOverlay() {
      const ctx = this.ctx;
      const viewport = this.renderViewport();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const visibleLambdaWidth = Math.max(cellsToLambda(this.visibleGridWidth()), 1e-6);
      const scaleLambda = niceScaleLength(visibleLambdaWidth) * 0.5;
      const colorbarReserve = 108 * dpr;
      const rightPad =
        state.viewMode === "field" || state.viewMode === "poynting" || state.viewProjection === "3d"
          ? colorbarReserve
          : 22 * dpr;
      const x1 = Math.max(viewport.left + 96 * dpr, viewport.right - rightPad);
      const availableWidth = Math.max(48 * dpr, x1 - (viewport.left + 22 * dpr));
      const scaleWidth = clamp((scaleLambda / visibleLambdaWidth) * viewport.width, 42 * dpr, availableWidth * 0.72);
      const x0 = Math.max(viewport.left + 22 * dpr, x1 - scaleWidth);
      const y = viewport.bottom - 34 * dpr;
      const tick = 8 * dpr;

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.moveTo(x0, y - tick);
      ctx.lineTo(x0, y + tick);
      ctx.moveTo(x1, y - tick);
      ctx.lineTo(x1, y + tick);
      this.strokeOverlayPath(5 * dpr, 2 * dpr, true);

      this.drawOverlayLabel(`${formatScaleBarValue(scaleLambda)} \u03bb\u2080`, (x0 + x1) / 2, y - 17 * dpr, "center", true);
      ctx.restore();
    },

    drawAxisGlyphOverlay() {
      const ctx = this.ctx;
      const { dpr, axesOriginX, axesOriginY, axesSize } = this.referenceGlyphLayout();

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      this.drawOverlayArrow(axesOriginX, axesOriginY, axesOriginX + axesSize, axesOriginY, true);
      this.drawOverlayArrow(axesOriginX, axesOriginY, axesOriginX, axesOriginY - axesSize, true);
      this.drawOverlayLabel("x", axesOriginX + axesSize + 13 * dpr, axesOriginY, "center", true);
      this.drawOverlayLabel("y", axesOriginX, axesOriginY - axesSize - 13 * dpr, "center", true);
      ctx.restore();
    },

    drawWaveVectorGlyphOverlay() {
      if (state.viewProjection !== "2d") return;
      const ctx = this.ctx;
      const { dpr, kOriginX, kOriginY, kLength } = this.referenceGlyphLayout();
      const direction = this.diagnosticDirection();
      const endX = kOriginX + kLength * direction.cos;
      const endY = kOriginY + kLength * direction.sin;
      const labelX = endX + 12 * dpr * Math.sign(direction.cos || 1);
      const labelY = endY + 8 * dpr * Math.sign(direction.sin || 0);

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      this.drawOverlayArrow(kOriginX, kOriginY, endX, endY, true);
      this.drawOverlayLabel("k", labelX, labelY, "center", true);
      ctx.restore();
    },

    referenceGlyphLayout() {
      const viewport = this.renderViewport();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const cpmlRight = boundarySideIsAbsorbing("left") && this.cpmlLayer > 0 ? this.gridToCanvasX(this.cpmlLayer) : viewport.left;
      const cpmlTop = boundarySideIsAbsorbing("bottom") && this.cpmlLayer > 0 ? this.gridToCanvasY(this.ny - this.cpmlLayer) : viewport.bottom;
      const cpmlWidth = cpmlRight - viewport.left > 10 * dpr ? cpmlRight - viewport.left : Math.min(viewport.width * 0.22, 126 * dpr);
      const cpmlHeight = viewport.bottom - cpmlTop > 10 * dpr ? viewport.bottom - cpmlTop : Math.min(viewport.height * 0.18, 96 * dpr);
      const left = viewport.left;
      const centerX = left + cpmlWidth * 0.5;
      const centerY = viewport.bottom - cpmlHeight + cpmlHeight * 0.52;
      const size = clamp(Math.min(cpmlWidth, cpmlHeight) * 0.34, 24 * dpr, 44 * dpr);
      const gap = clamp(cpmlHeight * 0.18, 15 * dpr, 24 * dpr);
      const kLength = clamp(size * 0.76, 22 * dpr, 36 * dpr);
      return {
        dpr,
        axesSize: size,
        axesOriginX: centerX - size * 0.52,
        axesOriginY: centerY + gap * 0.55,
        kLength,
        kOriginX: centerX - kLength * 0.56,
        kOriginY: centerY - size * 0.68,
      };
    },

    overlayReferenceColor() {
      return state.theme === "dark" ? "rgba(255, 255, 255, 0.94)" : "rgba(0, 0, 0, 0.94)";
    },

    overlayTextFontPx(scale = 1) {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const viewport = this.renderViewport();
      const cssWidth = viewport.width / dpr;
      const cssHeight = viewport.height / dpr;
      const cssSize = clamp(Math.min(cssWidth, cssHeight) * 0.017, 12.5, 18);
      return cssSize * scale * dpr;
    },

    drawOverlayArrow(x0, y0, x1, y1, plain = false) {
      const ctx = this.ctx;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const head = 9 * dpr;
      const wing = Math.PI / 6;

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - head * Math.cos(angle - wing), y1 - head * Math.sin(angle - wing));
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - head * Math.cos(angle + wing), y1 - head * Math.sin(angle + wing));
      this.strokeOverlayPath(5 * dpr, 2 * dpr, plain);
    },

    strokeOverlayPath(shadowWidth, lineWidth, plain = false) {
      const ctx = this.ctx;
      if (plain) {
        ctx.strokeStyle = this.overlayReferenceColor();
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        return;
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
      ctx.lineWidth = shadowWidth;
      ctx.stroke();
      ctx.strokeStyle = "rgba(5, 11, 15, 0.94)";
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    },

    drawOverlayLabel(text, x, y, align, plain = false) {
      const ctx = this.ctx;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const fontPx = this.overlayTextFontPx();
      ctx.font = `${fontPx}px ui-sans-serif, system-ui, sans-serif`;
      const metrics = ctx.measureText(text);
      const padX = Math.max(5 * dpr, fontPx * 0.42);
      const padY = Math.max(3 * dpr, fontPx * 0.24);
      const width = metrics.width + 2 * padX;
      const height = fontPx * 1.18 + 2 * padY;
      const left = align === "center" ? x - width / 2 : x - padX;
      const top = y - height / 2;

      ctx.save();
      if (!plain) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.68)";
        ctx.fillRect(left, top, width, height);
      }
      ctx.fillStyle = plain ? this.overlayReferenceColor() : "rgba(5, 11, 15, 0.94)";
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillText(text, x, y);
      ctx.restore();
    },
  });
})();
