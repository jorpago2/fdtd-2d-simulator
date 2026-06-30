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
    const drawExportOverlays =
      typeof dependencies.drawExportOverlays === "function" ? dependencies.drawExportOverlays : () => {};

    function buildPngDataUrlWithExportOverlays() {
      const exportCanvas = documentRef.createElement("canvas");
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext("2d", { alpha: false });
      if (!ctx) return canvas.toDataURL("image/png");
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
