(function initFdtdCanvasDrawPreviewOverlay() {
  "use strict";

  function previewLineWidth(dpr) {
    return Math.max(1.6 * dpr, 1);
  }

  function previewStrokeColor() {
    return state.brush === "erase" ? "rgba(179, 38, 61, 0.95)" : "rgba(8, 124, 137, 0.95)";
  }

  function previewFillColor() {
    return state.brush === "erase" ? "rgba(179, 38, 61, 0.08)" : "rgba(8, 124, 137, 0.10)";
  }

  Object.assign(FDTDSim.prototype, {
    drawDrawPreviewOverlay() {
      if (state.canvasMode !== "brush" || state.viewProjection !== "2d") return;
      const point = state.drawPreviewCell;
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;

      const ctx = this.ctx;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const viewport = this.renderViewport();
      ctx.save();
      ctx.beginPath();
      ctx.rect(viewport.left, viewport.top, viewport.width, viewport.height);
      ctx.clip();
      ctx.lineWidth = previewLineWidth(dpr);
      ctx.strokeStyle = previewStrokeColor();
      ctx.fillStyle = previewFillColor();
      ctx.setLineDash(state.brush === "erase" ? [6 * dpr, 4 * dpr] : []);
      if (state.brushTool === "geometry") {
        this.drawBrushGeometryPreview(point.x, point.y, dpr);
      } else {
        this.drawBrushRadiusPreview(point.x, point.y, dpr);
      }
      ctx.restore();
    },

    drawBrushRadiusPreview(x, y, dpr) {
      const radius = Math.max(1, lambdaToCells(state.brushSizeLambda));
      const cx = this.gridToCanvasX(x + 0.5);
      const cy = this.gridToCanvasY(y + 0.5);
      const rx = Math.abs(this.gridToCanvasX(x + 0.5 + radius) - cx);
      const ry = Math.abs(this.gridToCanvasY(y + 0.5 + radius) - cy);
      const ctx = this.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(rx, 2 * dpr), Math.max(ry, 2 * dpr), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
      ctx.lineWidth = Math.max(0.85 * dpr, 1);
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(rx - 2 * dpr, dpr), Math.max(ry - 2 * dpr, dpr), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },

    drawBrushGeometryPreview(cx, cy, dpr) {
      const geometry = state.brushGeometry || "rectangle";
      const width = Math.max(1, lambdaToCells(state.geometryWidthLambda));
      const height = Math.max(1, lambdaToCells(state.geometryHeightLambda));
      const outerRadius = Math.max(1, lambdaToCells(state.geometryRadiusLambda));
      const innerRadius = Math.max(0, Math.min(outerRadius - 1, lambdaToCells(state.geometryInnerRadiusLambda)));
      if (geometry === "disk") {
        this.drawBrushPreviewEllipse(cx, cy, outerRadius, outerRadius, dpr);
      } else if (geometry === "ellipse") {
        this.drawBrushPreviewEllipse(cx, cy, Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)), dpr);
      } else if (geometry === "ring") {
        this.drawBrushPreviewEllipse(cx, cy, outerRadius, outerRadius, dpr);
        if (innerRadius > 0) {
          const ctx = this.ctx;
          ctx.save();
          ctx.setLineDash([4 * dpr, 4 * dpr]);
          this.drawBrushPreviewEllipse(cx, cy, innerRadius, innerRadius, dpr, false);
          ctx.restore();
        }
      } else {
        this.drawBrushPreviewRectangle(cx, cy, width, height, dpr);
      }
    },

    drawBrushPreviewRectangle(cx, cy, width, height, dpr) {
      const x0 = Math.round(cx - width / 2);
      const y0 = Math.round(cy - height / 2);
      const rect = this.gridRectToCanvas(x0, y0, x0 + width, y0 + height);
      if (!rect) return;
      const ctx = this.ctx;
      ctx.save();
      ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
      ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
      ctx.lineWidth = Math.max(0.8 * dpr, 1);
      ctx.strokeRect(rect.left + 2 * dpr, rect.top + 2 * dpr, Math.max(0, rect.width - 4 * dpr), Math.max(0, rect.height - 4 * dpr));
      ctx.restore();
    },

    drawBrushPreviewEllipse(cx, cy, rxCells, ryCells, dpr, fill = true) {
      const centerX = this.gridToCanvasX(cx + 0.5);
      const centerY = this.gridToCanvasY(cy + 0.5);
      const rx = Math.abs(this.gridToCanvasX(cx + 0.5 + rxCells) - centerX);
      const ry = Math.abs(this.gridToCanvasY(cy + 0.5 + ryCells) - centerY);
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, Math.max(rx, 2 * dpr), Math.max(ry, 2 * dpr), 0, 0, Math.PI * 2);
      if (fill) ctx.fill();
      ctx.stroke();
    },
  });
})();
