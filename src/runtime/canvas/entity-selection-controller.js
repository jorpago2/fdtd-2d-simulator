(function initFdtdEntitySelectionController(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Entity selection dependency must provide ${name}.`);
    }
    return value;
  }

  function createEntitySelectionController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const materialSelectionController = requireObject(
      dependencies.materialSelectionController,
      "materialSelectionController",
    );

    function setSourceId(sourceId) {
      state.selectedSourceId = sourceId ?? null;
    }

    function setMonitorId(monitorId) {
      state.selectedMonitorId = monitorId ?? null;
    }

    function selectSource(sourceId, options = {}) {
      state.selectedSourceId = sourceId ?? null;
      if (options.clearMonitor !== false) state.selectedMonitorId = null;
      if (options.clearMaterial !== false) materialSelectionController.clear();
    }

    function selectMonitor(monitorId, options = {}) {
      state.selectedMonitorId = monitorId ?? null;
      if (options.clearSource !== false) state.selectedSourceId = null;
      if (options.clearMaterial !== false) materialSelectionController.clear();
    }

    function selectMaterial(region, options = {}) {
      materialSelectionController.setRegion(region);
      if (region && options.clearEntities !== false) {
        state.selectedSourceId = null;
        state.selectedMonitorId = null;
      }
    }

    function replaceMaterial(region) {
      return materialSelectionController.replaceRegion(region);
    }

    function clearMaterial() {
      materialSelectionController.clear();
    }

    function clearAll() {
      state.selectedSourceId = null;
      state.selectedMonitorId = null;
      materialSelectionController.clear();
    }

    return Object.freeze({
      setSourceId,
      setMonitorId,
      selectSource,
      selectMonitor,
      selectMaterial,
      replaceMaterial,
      clearMaterial,
      clearAll,
    });
  }

  global.FdtdEntitySelectionController = Object.freeze({
    createEntitySelectionController,
  });
})(window);
