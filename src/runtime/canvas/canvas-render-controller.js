(function initFdtdCanvasRenderController(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Canvas render controller dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Canvas render controller dependency must provide ${name}().`);
    }
    return value;
  }

  function createCanvasRenderController(dependencies) {
    const sim = requireObject(dependencies.sim, "sim");
    const documentRef = requireObject(dependencies.documentRef || global.document, "documentRef");
    const buildPngDataUrl = requireFunction(dependencies.buildPngDataUrl, "buildPngDataUrl");
    const getPngFileName = requireFunction(dependencies.getPngFileName, "getPngFileName");

    let currentRenderOverrides = null;

    function renderOverrides() {
      return currentRenderOverrides;
    }

    function withRenderOverrides(overrides, task) {
      const previousOverrides = currentRenderOverrides;
      currentRenderOverrides = { ...(previousOverrides || {}), ...(overrides || {}) };
      try {
        sim.render();
        return task();
      } finally {
        currentRenderOverrides = previousOverrides;
        sim.render();
      }
    }

    function downloadCanvasPng() {
      const link = documentRef.createElement("a");
      link.download = getPngFileName();
      link.href = withRenderOverrides({ scale: true, colorbar: true }, buildPngDataUrl);
      link.click();
    }

    return Object.freeze({
      renderOverrides,
      withRenderOverrides,
      downloadCanvasPng,
    });
  }

  global.FdtdCanvasRenderController = Object.freeze({
    createCanvasRenderController,
  });
})(window);
