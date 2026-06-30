(function initFdtdSourceMonitorControlBindings(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Source/monitor control bindings dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Source/monitor control bindings dependency must provide ${name}().`);
    }
    return value;
  }

  function forEachNode(nodes, callback) {
    nodes?.forEach?.(callback);
  }

  function bindSourceMonitorControls(dependencies) {
    const el = requireObject(dependencies.el, "el");
    const sim = requireObject(dependencies.sim, "sim");
    const simulationEffects = requireObject(dependencies.simulationEffects, "simulationEffects");
    const applySourceMenu = requireFunction(dependencies.applySourceMenu, "applySourceMenu");
    const selectedSource = requireFunction(dependencies.selectedSource, "selectedSource");
    const deleteSource = requireFunction(dependencies.deleteSource, "deleteSource");
    const closeSourceMenu = requireFunction(dependencies.closeSourceMenu, "closeSourceMenu");
    const syncSourceEditorTarget = requireFunction(dependencies.syncSourceEditorTarget, "syncSourceEditorTarget");
    const applyMonitorMenu = requireFunction(dependencies.applyMonitorMenu, "applyMonitorMenu");
    const explicitlySelectedMonitor = requireFunction(dependencies.explicitlySelectedMonitor, "explicitlySelectedMonitor");
    const deleteMonitor = requireFunction(dependencies.deleteMonitor, "deleteMonitor");
    const closeMonitorMenu = requireFunction(dependencies.closeMonitorMenu, "closeMonitorMenu");
    const syncMonitorEditorTarget = requireFunction(dependencies.syncMonitorEditorTarget, "syncMonitorEditorTarget");

    el.sourceApplyBtn?.addEventListener("click", () => {
      applySourceMenu();
    });

    el.sourceDeleteBtn?.addEventListener("click", () => {
      const source = selectedSource();
      if (!source) return;
      deleteSource(source.id);
      closeSourceMenu();
      simulationEffects.commitSourceMutation();
    });

    el.sourceCloseBtn?.addEventListener("click", () => {
      closeSourceMenu();
      sim.render();
    });

    el.monitorApplyBtn?.addEventListener("click", () => {
      applyMonitorMenu();
    });

    el.monitorDeleteBtn?.addEventListener("click", () => {
      const monitor = explicitlySelectedMonitor();
      if (!monitor) return;
      deleteMonitor(monitor.id);
      closeMonitorMenu();
      simulationEffects.commitMonitorMutation();
    });

    el.monitorCloseBtn?.addEventListener("click", () => {
      closeMonitorMenu();
      sim.render();
    });

    forEachNode([el.monitorQuantityInput, el.monitorXInput, el.monitorYInput, el.monitorLengthInput, el.monitorAngleInput], (input) => {
      input?.addEventListener("input", syncMonitorEditorTarget);
      input?.addEventListener("change", syncMonitorEditorTarget);
    });

    el.sourceTypeInput?.addEventListener("change", syncSourceEditorTarget);
    el.sourceShapeInput?.addEventListener("change", syncSourceEditorTarget);
    el.amplitudeInput?.addEventListener("input", syncSourceEditorTarget);
    el.sourceXInput?.addEventListener("change", syncSourceEditorTarget);
    el.sourceYInput?.addEventListener("change", syncSourceEditorTarget);
    el.sourceWidthInput?.addEventListener("input", syncSourceEditorTarget);
    el.sourcePhaseInput?.addEventListener("change", syncSourceEditorTarget);

    const syncSourceAndResetDiagnostics = () => {
      sim.resetDiagnostics();
      syncSourceEditorTarget();
    };
    el.frequencyInput?.addEventListener("input", syncSourceAndResetDiagnostics);
    el.sourceAngleInput?.addEventListener("input", syncSourceAndResetDiagnostics);
    el.sourceTimePhaseInput?.addEventListener("input", syncSourceAndResetDiagnostics);

    el.sourceOrderInput?.addEventListener("input", syncSourceEditorTarget);
    el.sourceOrderInput?.addEventListener("change", syncSourceEditorTarget);
  }

  global.FdtdSourceMonitorControlBindings = Object.freeze({
    bindSourceMonitorControls,
  });
})(window);
