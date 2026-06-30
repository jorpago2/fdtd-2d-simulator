(function initFdtdCanvasMaterialOverlays() {
  "use strict";

  Object.assign(FDTDSim.prototype, {
    drawMaterialSelectionOverlay() {
      const selectedRegion = materialSelection?.region;
      if (!selectedRegion || selectedRegion.cells.length === 0) return;
      const rect = this.gridRectToCanvas(
        selectedRegion.bounds.minX,
        selectedRegion.bounds.minY,
        selectedRegion.bounds.maxX + 1,
        selectedRegion.bounds.maxY + 1,
      );
      if (!rect) return;
      const ctx = this.ctx;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const isMoving = dragState.material.pointerId != null;
      ctx.save();
      ctx.fillStyle = isMoving ? "rgba(255, 178, 74, 0.16)" : "rgba(8, 124, 137, 0.12)";
      ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
      ctx.strokeStyle = isMoving ? "rgba(196, 112, 16, 0.95)" : "rgba(0, 52, 58, 0.92)";
      ctx.lineWidth = Math.max((isMoving ? 2.3 : 1.7) * dpr, 1);
      ctx.setLineDash(isMoving ? [] : [7 * dpr, 4 * dpr]);
      ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
      ctx.setLineDash([]);
      ctx.strokeStyle = isMoving ? "rgba(255, 238, 198, 0.72)" : "rgba(255, 255, 255, 0.58)";
      ctx.lineWidth = Math.max(1 * dpr, 1);
      ctx.strokeRect(rect.left + 3 * dpr, rect.top + 3 * dpr, Math.max(0, rect.width - 6 * dpr), Math.max(0, rect.height - 6 * dpr));
      ctx.fillStyle = isMoving ? "rgba(95, 52, 6, 0.9)" : "rgba(0, 52, 58, 0.86)";
      ctx.font = `${this.overlayTextFontPx()}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      const label = isMoving ? `moving \u00b7 ${selectedRegion.cells.length} cells` : `${selectedRegion.cells.length} cells`;
      ctx.fillText(label, rect.left + 6 * dpr, Math.max(14 * dpr, rect.top - 5 * dpr));
      ctx.restore();
    },

    drawMaterialHoverOverlay() {
      if (!hoveredMaterialRegion || hoveredMaterialRegion.cells.length === 0) return;
      const selectedRegion = materialSelection?.region;
      if (selectedRegion && materialRegionSignature(hoveredMaterialRegion) === materialRegionSignature(selectedRegion)) return;
      const rect = this.gridRectToCanvas(
        hoveredMaterialRegion.bounds.minX,
        hoveredMaterialRegion.bounds.minY,
        hoveredMaterialRegion.bounds.maxX + 1,
        hoveredMaterialRegion.bounds.maxY + 1,
      );
      if (!rect) return;
      const ctx = this.ctx;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      ctx.save();
      ctx.fillStyle = "rgba(69, 192, 201, 0.08)";
      ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
      ctx.strokeStyle = "rgba(69, 192, 201, 0.78)";
      ctx.lineWidth = Math.max(1.25 * dpr, 1);
      ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
      ctx.fillStyle = "rgba(11, 31, 36, 0.84)";
      ctx.font = `${this.overlayTextFontPx(0.95)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText("material", rect.left + 6 * dpr, Math.max(13 * dpr, rect.top - 4 * dpr));
      ctx.restore();
    },
  });
})();
