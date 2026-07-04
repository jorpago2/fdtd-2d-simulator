(function initFdtdCanvasExport(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Canvas export dependency must provide ${name}.`);
    }
    return value;
  }

  function createCanvasExportController(dependencies) {
    const canvas = requireObject(dependencies.canvas, "canvas");
    const documentRef = requireObject(dependencies.documentRef || global.document, "documentRef");
    const fieldCanvas = dependencies.fieldCanvas || documentRef.getElementById?.("fieldCanvas") || null;
    const surfaceCanvas = dependencies.surfaceCanvas || documentRef.getElementById?.("surfaceCanvas") || null;
    const drawExportOverlays =
      typeof dependencies.drawExportOverlays === "function" ? dependencies.drawExportOverlays : () => {};

    function buildPngDataUrlWithExportOverlays() {
      const exportCanvas = documentRef.createElement("canvas");
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext("2d", { alpha: false });
      if (!ctx) return canvas.toDataURL("image/png");
      if (fieldCanvas && !fieldCanvas.hidden) {
        ctx.drawImage(fieldCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
      }
      if (surfaceCanvas && !surfaceCanvas.hidden) {
        const background = ctx.createLinearGradient(0, 0, 0, exportCanvas.height);
        background.addColorStop(0, "rgb(3, 5, 9)");
        background.addColorStop(0.58, "rgb(7, 8, 13)");
        background.addColorStop(1, "rgb(0, 0, 0)");
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        ctx.drawImage(surfaceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
      }
      ctx.drawImage(canvas, 0, 0);
      drawExportOverlays(ctx, exportCanvas.width, exportCanvas.height);
      return exportCanvas.toDataURL("image/png");
    }

    return Object.freeze({
      buildPngDataUrlWithExportOverlays,
    });
  }

  global.FdtdCanvasExport = Object.freeze({
    createCanvasExportController,
  });
})(window);
