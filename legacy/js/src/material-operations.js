(function initFdtdMaterialOperations(global) {
  "use strict";

  function materialKindFromCode(code) {
    if (code === 2) return "pec";
    if (code === 3) return "lossy";
    if (code === 4) return "custom";
    return "custom";
  }

  function dominantMaterialKind(region) {
    const counts = new Map();
    for (const cell of region?.cells ?? []) {
      const kind = materialKindFromCode(cell.material);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    let bestKind = "custom";
    let bestCount = -1;
    for (const [kind, count] of counts) {
      if (count > bestCount) {
        bestKind = kind;
        bestCount = count;
      }
    }
    return bestKind;
  }

  function createMaterialOperations({
    state,
    getSim,
    getEntitySelection,
    getMaterialSelection,
    getDragStateController,
    getSimulationEffects,
    selectedSource,
    selectedMonitor,
    callbacks,
  }) {
    function clearMaterialSelection(render = true) {
      getEntitySelection().clearMaterial();
      getDragStateController().clearMaterial();
      callbacks.updateInspector();
      if (render) getSim().render();
    }

    function deleteSelectedElement() {
      const monitor = selectedMonitor();
      if (monitor) {
        callbacks.deleteMonitor(monitor.id);
        callbacks.closeMonitorMenu();
        getSimulationEffects().commitMonitorMutation();
        return true;
      }
      const source = selectedSource();
      if (source) {
        callbacks.deleteSource(source.id);
        callbacks.closeSourceMenu();
        clearMaterialSelection(false);
        getSimulationEffects().commitSourceMutation();
        return true;
      }
      const materialSelection = getMaterialSelection();
      if (materialSelection.region) {
        const sim = getSim();
        const simulationEffects = getSimulationEffects();
        simulationEffects.commit({ dirty: true, disableResponsiveGrid: true });
        getEntitySelection().replaceMaterial(sim.applyMaterialKindToRegion(materialSelection.region, "erase"));
        callbacks.closeBrushMenu();
        simulationEffects.commit({ measure: true, controls: true, stats: true, render: true });
        return true;
      }
      return false;
    }

    function selectMaterialRegion(region, render = true) {
      getEntitySelection().selectMaterial(region);
      if (region) {
        state.brush = dominantMaterialKind(region);
      }
      callbacks.updateInspector();
      if (render) {
        callbacks.updateControlText();
        getSim().render();
      }
    }

    function selectMaterialRegionAt(clientX, clientY, render = true) {
      const region = getSim().findMaterialRegionAtClientPoint(clientX, clientY);
      if (region) {
        selectMaterialRegion(region, render);
      }
      return region;
    }

    function applyMaterialKindToSelection(kind) {
      const materialSelection = getMaterialSelection();
      if (!materialSelection.region) return;
      const sim = getSim();
      const simulationEffects = getSimulationEffects();
      simulationEffects.commit({ dirty: true, disableResponsiveGrid: true });
      state.brush = kind;
      getEntitySelection().replaceMaterial(sim.applyMaterialKindToRegion(materialSelection.region, kind));
      simulationEffects.commit({ measure: true, controls: true, stats: true, render: true });
    }

    return {
      clearMaterialSelection,
      deleteSelectedElement,
      selectMaterialRegion,
      selectMaterialRegionAt,
      applyMaterialKindToSelection,
    };
  }

  global.FdtdMaterialOperations = {
    materialKindFromCode,
    dominantMaterialKind,
    createMaterialOperations,
  };
})(window);
