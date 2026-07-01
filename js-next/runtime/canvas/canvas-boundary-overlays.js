(function initFdtdCanvasBoundaryOverlays() {
  "use strict";

  Object.assign(FDTDSim.prototype, {
    drawCpmlOverlay() {
      normalizeBoundarySides();

      const ctx = this.ctx;
      const viewport = this.renderViewport();
      const w = viewport.width;
      const h = viewport.height;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const dark = state.theme === "dark";
      const palette = {
        fill: dark ? "rgba(46, 232, 224, 0.04)" : "rgba(0, 116, 122, 0.055)",
        grid: dark ? "rgba(96, 244, 236, 0.16)" : "rgba(0, 111, 118, 0.20)",
        labelBackground: dark ? "rgba(2, 10, 14, 0.58)" : "rgba(255, 255, 255, 0.66)",
        labelBorder: dark ? "rgba(116, 255, 248, 0.18)" : "rgba(0, 110, 118, 0.16)",
        labelText: dark ? "rgba(220, 255, 252, 0.82)" : "rgba(4, 72, 80, 0.82)",
        interfaceStroke: dark ? "rgba(90, 236, 230, 0.54)" : "rgba(0, 97, 107, 0.58)",
      };
      const spacing = clamp(Math.min(w, h) / 26, 13 * dpr, 26 * dpr);
      const drawCpmlLabel = (rect) => {
        const fontPx = this.overlayTextFontPx(0.92);
        const label = "CPML";
        ctx.font = `600 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
        const metrics = ctx.measureText(label);
        const padX = Math.max(6 * dpr, fontPx * 0.45);
        const padY = Math.max(3 * dpr, fontPx * 0.24);
        const labelWidth = metrics.width + 2 * padX;
        const labelHeight = fontPx * 1.12 + 2 * padY;
        if (rect.width < labelWidth + 8 * dpr || rect.height < labelHeight + 6 * dpr) return;
        const left = rect.left + (rect.width - labelWidth) / 2;
        const top = rect.top + (rect.height - labelHeight) / 2;
        ctx.fillStyle = palette.labelBackground;
        ctx.fillRect(left, top, labelWidth, labelHeight);
        ctx.strokeStyle = palette.labelBorder;
        ctx.lineWidth = Math.max(1, 0.8 * dpr);
        ctx.strokeRect(left, top, labelWidth, labelHeight);
        ctx.fillStyle = palette.labelText;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, rect.left + rect.width / 2, rect.top + rect.height / 2 + 0.5 * dpr);
      };
      const drawCpmlRegion = (side, x0, y0, x1, y1) => {
        const rect = this.gridRectToCanvas(x0, y0, x1, y1);
        if (!rect) return;
        ctx.save();
        ctx.fillStyle = palette.fill;
        ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
        ctx.beginPath();
        ctx.rect(rect.left, rect.top, rect.width, rect.height);
        ctx.clip();
        ctx.strokeStyle = palette.grid;
        ctx.lineWidth = Math.max(1, 0.75 * dpr);
        ctx.beginPath();
        const startX = Math.floor(rect.left / spacing) * spacing;
        const endX = rect.left + rect.width;
        const startY = Math.floor(rect.top / spacing) * spacing;
        const endY = rect.top + rect.height;
        for (let x = startX; x <= endX; x += spacing) {
          ctx.moveTo(x, rect.top);
          ctx.lineTo(x, rect.top + rect.height);
        }
        for (let y = startY; y <= endY; y += spacing) {
          ctx.moveTo(rect.left, y);
          ctx.lineTo(rect.left + rect.width, y);
        }
        ctx.stroke();
        if (rect.width > 36 * dpr && rect.height > 18 * dpr) {
          drawCpmlLabel(rect);
        }
        ctx.restore();
      };

      const drawReflectiveEdge = (side) => {
        if (boundarySideIsAbsorbing(side)) return;
        const layer = Math.max(1, this.boundaryControlLayer());
        const metalCells = clampInt(Math.round(state.cellsPerWavelength * 0.14), 3, Math.max(3, Math.min(10, Math.floor(layer * 0.45))));
        const rect =
          side === "top"
            ? this.gridRectToCanvas(0, layer - metalCells, this.nx, layer)
            : side === "bottom"
              ? this.gridRectToCanvas(0, this.ny - layer, this.nx, this.ny - layer + metalCells)
              : side === "left"
                ? this.gridRectToCanvas(layer - metalCells, 0, layer, this.ny)
                : this.gridRectToCanvas(this.nx - layer, 0, this.nx - layer + metalCells, this.ny);
        if (!rect) return;
        const horizontal = side === "top" || side === "bottom";
        const metalGradient = horizontal
          ? ctx.createLinearGradient(rect.left, rect.top, rect.left, rect.top + rect.height)
          : ctx.createLinearGradient(rect.left, rect.top, rect.left + rect.width, rect.top);
        metalGradient.addColorStop(0, "rgba(255, 255, 255, 0.58)");
        metalGradient.addColorStop(0.18, "rgba(154, 164, 170, 0.7)");
        metalGradient.addColorStop(0.52, "rgba(42, 51, 58, 0.86)");
        metalGradient.addColorStop(1, "rgba(6, 10, 14, 0.92)");
        ctx.save();
        ctx.fillStyle = metalGradient;
        ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
        ctx.beginPath();
        ctx.rect(rect.left, rect.top, rect.width, rect.height);
        ctx.clip();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = Math.max(1, dpr);
        ctx.beginPath();
        const hatchSpacing = Math.max(7 * dpr, metalCells * dpr * 0.65);
        const hatchExtent = rect.width + rect.height;
        for (let p = -hatchExtent; p <= hatchExtent * 2; p += hatchSpacing) {
          ctx.moveTo(rect.left + p, rect.top + rect.height);
          ctx.lineTo(rect.left + p + rect.height, rect.top);
        }
        ctx.stroke();
        ctx.strokeStyle = "rgba(3, 7, 10, 0.68)";
        ctx.lineWidth = Math.max(1.2 * dpr, 1);
        ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
        ctx.restore();
      };

      if (this.cpmlLayer > 0) {
        const topInset = boundarySideIsAbsorbing("top") ? this.cpmlLayer : 0;
        const bottomInset = boundarySideIsAbsorbing("bottom") ? this.cpmlLayer : 0;
        if (boundarySideIsAbsorbing("top")) drawCpmlRegion("top", 0, 0, this.nx, this.cpmlLayer);
        if (boundarySideIsAbsorbing("bottom")) drawCpmlRegion("bottom", 0, this.ny - this.cpmlLayer, this.nx, this.ny);
        if (boundarySideIsAbsorbing("left")) drawCpmlRegion("left", 0, topInset, this.cpmlLayer, this.ny - bottomInset);
        if (boundarySideIsAbsorbing("right")) drawCpmlRegion("right", this.nx - this.cpmlLayer, topInset, this.nx, this.ny - bottomInset);
      }

      BOUNDARY_SIDES.forEach((side) => drawReflectiveEdge(side));

      const drawBoundaryInterfaceLine = (side) => {
        const layer = this.boundaryControlLayer();
        if (layer <= 0) return;
        const absorbing = boundarySideIsAbsorbing(side);
        ctx.save();
        ctx.strokeStyle = absorbing ? palette.interfaceStroke : "rgba(3, 7, 10, 0.88)";
        ctx.lineWidth = Math.max(absorbing ? 1 : 1.35, dpr);
        ctx.setLineDash(absorbing ? [6 * dpr, 4 * dpr] : []);
        ctx.beginPath();
        if (side === "left") {
          const x = this.gridToCanvasX(layer);
          ctx.moveTo(x, viewport.top);
          ctx.lineTo(x, viewport.bottom);
        } else if (side === "right") {
          const x = this.gridToCanvasX(this.nx - layer);
          ctx.moveTo(x, viewport.top);
          ctx.lineTo(x, viewport.bottom);
        } else if (side === "top") {
          const y = this.gridToCanvasY(layer);
          ctx.moveTo(viewport.left, y);
          ctx.lineTo(viewport.right, y);
        } else if (side === "bottom") {
          const y = this.gridToCanvasY(this.ny - layer);
          ctx.moveTo(viewport.left, y);
          ctx.lineTo(viewport.right, y);
        }
        ctx.stroke();
        ctx.restore();
      };
      BOUNDARY_SIDES.forEach((side) => drawBoundaryInterfaceLine(side));
    },
  });
})();
