(function initFdtdCanvasMonitorOverlays() {
  "use strict";

  Object.assign(FDTDSim.prototype, {
    drawDiagnosticsOverlay() {
      if (state.viewProjection !== "2d") return;
      const ctx = this.ctx;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const viewport = this.renderViewport();
      const monitors = this.diagnosticMonitorPositions();
      const drawLine = (xCell, label, color) => {
        const x = this.gridToCanvasX(xCell + 0.5);
        if (x < viewport.left - 2 * dpr || x > viewport.right + 2 * dpr) return;
        ctx.save();
        ctx.setLineDash([7 * dpr, 6 * dpr]);
        ctx.lineWidth = Math.max(1.4 * dpr, 1);
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, viewport.top + 10 * dpr);
        ctx.lineTo(x, viewport.bottom - 10 * dpr);
        ctx.stroke();
        ctx.setLineDash([]);
        this.drawOverlayLabel(label, x + 12 * dpr, viewport.top + 24 * dpr, "left");
        ctx.restore();
      };
      if (visualLayerEnabled("monitors") && state.diagnosticsEnabled) {
        drawLine(monitors.left, "L", "rgba(11, 98, 232, 0.74)");
        drawLine(monitors.right, "R", "rgba(16, 136, 82, 0.74)");
      }
      this.drawCustomMonitorMarkers();
    },

    drawCustomMonitorMarkers() {
      if (!state.monitors?.length) return;
      for (const monitor of state.monitors) {
        this.drawCustomMonitorMarker(monitor);
      }
    },

    drawCustomMonitorMarker(monitor) {
      const segment = this.monitorSegment(monitor);
      const x0 = this.gridToCanvasX(segment.x0);
      const y0 = this.gridToCanvasY(segment.y0);
      const x1 = this.gridToCanvasX(segment.x1);
      const y1 = this.gridToCanvasY(segment.y1);
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const viewport = this.renderViewport();
      const margin = 24 * dpr;
      const minX = Math.min(x0, x1);
      const maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1);
      const maxY = Math.max(y0, y1);
      if (maxX < viewport.left - margin || minX > viewport.right + margin || maxY < viewport.top - margin || minY > viewport.bottom + margin) return;

      const active = monitor.id === state.selectedMonitorId;
      const hovered = monitor.id === state.hoveredMonitorId;
      const moving = dragState.monitor.pointerId != null && dragState.monitor.entityId === monitor.id;
      const color = active || moving ? "rgba(255, 184, 74, 0.94)" : hovered ? "rgba(60, 210, 220, 0.88)" : "rgba(226, 72, 142, 0.82)";
      const label = moving ? `moving M${monitor.id}` : `M${monitor.id}`;
      const cx = this.gridToCanvasX(segment.cx);
      const cy = this.gridToCanvasY(segment.cy);
      const nx = -segment.uy;
      const ny = segment.ux;
      const normalLength = Math.max(12 * dpr, 0.08 * Math.hypot(x1 - x0, y1 - y0));

      this.ctx.save();
      this.ctx.lineCap = "round";
      this.ctx.setLineDash(active || hovered || moving ? [] : [7 * dpr, 5 * dpr]);
      this.ctx.lineWidth = Math.max((active || moving ? 3.2 : 2.1) * dpr, 1.5);
      this.ctx.strokeStyle = color;
      this.ctx.beginPath();
      this.ctx.moveTo(x0, y0);
      this.ctx.lineTo(x1, y1);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      this.ctx.lineWidth = Math.max(1.4 * dpr, 1);
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy);
      this.ctx.lineTo(cx + nx * normalLength, cy + ny * normalLength);
      this.ctx.stroke();
      this.drawOverlayLabel(label, cx + 10 * dpr, cy - 12 * dpr, "left");
      this.ctx.restore();
    },

    monitorAtClientPoint(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const px = (clientX - rect.left) * dpr;
      const py = (clientY - rect.top) * dpr;
      let best = null;
      let bestDistance = Infinity;
      for (const monitor of state.monitors || []) {
        const segment = this.monitorSegment(monitor);
        const x0 = this.gridToCanvasX(segment.x0);
        const y0 = this.gridToCanvasY(segment.y0);
        const x1 = this.gridToCanvasX(segment.x1);
        const y1 = this.gridToCanvasY(segment.y1);
        const vx = x1 - x0;
        const vy = y1 - y0;
        const denom = vx * vx + vy * vy;
        const t = denom > 1e-9 ? clamp(((px - x0) * vx + (py - y0) * vy) / denom, 0, 1) : 0;
        const cx = x0 + vx * t;
        const cy = y0 + vy * t;
        const distance = Math.hypot(px - cx, py - cy);
        const radius = 18 * dpr;
        if (distance <= radius && distance < bestDistance) {
          best = monitor;
          bestDistance = distance;
        }
      }
      return best;
    },
  });
})();
