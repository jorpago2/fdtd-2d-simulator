(function initFdtdCanvasViewport(global) {
  "use strict";

  function canvasPixelSize(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, global.devicePixelRatio || 1);
    return {
      width: Math.max(1, Math.round(rect.width * dpr)),
      height: Math.max(1, Math.round(rect.height * dpr)),
      dpr,
    };
  }

  function viewportForGridView({ canvasWidth, canvasHeight, gridWidth, gridHeight }) {
    const safeCanvasWidth = Math.max(1, canvasWidth || 1);
    const safeCanvasHeight = Math.max(1, canvasHeight || 1);
    const safeGridWidth = Math.max(1e-9, gridWidth || 1);
    const safeGridHeight = Math.max(1e-9, gridHeight || 1);
    const viewAspect = safeGridWidth / safeGridHeight;
    const canvasAspect = safeCanvasWidth / safeCanvasHeight;
    let width = safeCanvasWidth;
    let height = safeCanvasHeight;

    if (canvasAspect > viewAspect) {
      width = height * viewAspect;
    } else {
      height = width / viewAspect;
    }

    const left = (safeCanvasWidth - width) * 0.5;
    const top = (safeCanvasHeight - height) * 0.5;
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      pixelsPerCell: width / safeGridWidth,
    };
  }

  Object.assign(FDTDSim.prototype, {
    maxViewZoom() {
      return Math.max(1, Math.min(80, this.nx / 8, this.ny / 8));
    },

    visibleGridWidth() {
      return this.nx / this.viewZoom;
    },

    visibleGridHeight() {
      return this.ny / this.viewZoom;
    },

    viewAspectRatio() {
      return this.visibleGridWidth() / Math.max(1e-9, this.visibleGridHeight());
    },

    renderViewport() {
      return viewportForGridView({
        canvasWidth: this.canvas.width,
        canvasHeight: this.canvas.height,
        gridWidth: this.visibleGridWidth(),
        gridHeight: this.visibleGridHeight(),
      });
    },

    clientViewportRect() {
      const rect = this.canvas.getBoundingClientRect();
      const viewport = this.renderViewport();
      const scaleX = rect.width / Math.max(1, this.canvas.width || 1);
      const scaleY = rect.height / Math.max(1, this.canvas.height || 1);
      return {
        left: rect.left + viewport.left * scaleX,
        top: rect.top + viewport.top * scaleY,
        width: viewport.width * scaleX,
        height: viewport.height * scaleY,
      };
    },

    clientToViewFractions(clientX, clientY) {
      const rect = this.clientViewportRect();
      return {
        x: rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0,
        y: rect.height > 0 ? clamp((clientY - rect.top) / rect.height, 0, 1) : 0,
      };
    },

    resetView() {
      this.viewZoom = 1;
      this.viewX = 0;
      this.viewY = 0;
    },

    clampView() {
      this.viewZoom = clamp(this.viewZoom, 1, this.maxViewZoom());
      const viewWidth = this.visibleGridWidth();
      const viewHeight = this.visibleGridHeight();
      this.viewX = viewWidth >= this.nx ? 0 : clamp(this.viewX, 0, this.nx - viewWidth);
      this.viewY = viewHeight >= this.ny ? 0 : clamp(this.viewY, 0, this.ny - viewHeight);
    },

    zoomAtClientPoint(clientX, clientY, factor) {
      const rect = this.clientViewportRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const { x: fracX, y: fracY } = this.clientToViewFractions(clientX, clientY);
      const worldX = this.viewX + fracX * this.visibleGridWidth();
      const worldY = this.viewY + fracY * this.visibleGridHeight();
      const nextZoom = clamp(this.viewZoom * factor, 1, this.maxViewZoom());
      if (Math.abs(nextZoom - this.viewZoom) < 1e-6) return false;
      this.viewZoom = nextZoom;
      this.viewX = worldX - fracX * this.visibleGridWidth();
      this.viewY = worldY - fracY * this.visibleGridHeight();
      this.clampView();
      return true;
    },

    setZoomFromGesture(anchorClientX, anchorClientY, anchorWorldX, anchorWorldY, nextZoom) {
      const rect = this.clientViewportRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const { x: fracX, y: fracY } = this.clientToViewFractions(anchorClientX, anchorClientY);
      this.viewZoom = clamp(nextZoom, 1, this.maxViewZoom());
      this.viewX = anchorWorldX - fracX * this.visibleGridWidth();
      this.viewY = anchorWorldY - fracY * this.visibleGridHeight();
      this.clampView();
      return true;
    },

    panByClientDelta(deltaX, deltaY) {
      if (this.viewZoom <= 1) return false;
      const rect = this.clientViewportRect();
      this.viewX -= (deltaX / Math.max(1, rect.width)) * this.visibleGridWidth();
      this.viewY -= (deltaY / Math.max(1, rect.height)) * this.visibleGridHeight();
      this.clampView();
      return true;
    },

    clientToGridFloat(clientX, clientY) {
      const { x: fracX, y: fracY } = this.clientToViewFractions(clientX, clientY);
      return {
        x: this.viewX + fracX * this.visibleGridWidth(),
        y: this.viewY + fracY * this.visibleGridHeight(),
      };
    },

    clientToGridCell(clientX, clientY) {
      const point = this.clientToGridFloat(clientX, clientY);
      return {
        x: clampInt(Math.floor(point.x), 1, this.nx - 2),
        y: clampInt(Math.floor(point.y), 1, this.ny - 2),
      };
    },

    gridToCanvasX(x) {
      const viewport = this.renderViewport();
      return viewport.left + ((x - this.viewX) / this.visibleGridWidth()) * viewport.width;
    },

    gridToCanvasY(y) {
      const viewport = this.renderViewport();
      return viewport.top + ((y - this.viewY) / this.visibleGridHeight()) * viewport.height;
    },

    gridRectToCanvas(x0, y0, x1, y1) {
      const visibleX0 = Math.max(x0, this.viewX);
      const visibleY0 = Math.max(y0, this.viewY);
      const visibleX1 = Math.min(x1, this.viewX + this.visibleGridWidth());
      const visibleY1 = Math.min(y1, this.viewY + this.visibleGridHeight());
      if (visibleX1 <= visibleX0 || visibleY1 <= visibleY0) return null;
      const left = this.gridToCanvasX(visibleX0);
      const top = this.gridToCanvasY(visibleY0);
      const right = this.gridToCanvasX(visibleX1);
      const bottom = this.gridToCanvasY(visibleY1);
      return {
        left,
        top,
        width: right - left,
        height: bottom - top,
      };
    },

    fitCanvas() {
      const { width, height } = canvasPixelSize(this.canvas);
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.imageSmoothingEnabled = false;
      }
      const viewport = this.renderViewport();
      this.canvas.dataset.gridAspect = this.viewAspectRatio().toFixed(6);
      this.canvas.dataset.domainAspect = (viewport.width / Math.max(1e-9, viewport.height)).toFixed(6);
      this.canvas.dataset.domainRect = [
        Math.round(viewport.left),
        Math.round(viewport.top),
        Math.round(viewport.width),
        Math.round(viewport.height),
      ].join(",");
    },
  });

  global.FdtdCanvasViewport = Object.freeze({
    canvasPixelSize,
    viewportForGridView,
  });
})(window);
