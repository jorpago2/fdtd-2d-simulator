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
    const documentRef = dependencies.documentRef || global.document;

    const syncSourceAndResetDiagnostics = () => {
      sim.resetDiagnostics();
      syncSourceEditorTarget();
    };

    documentRef.addEventListener("click", (event) => {
      const id = event.target?.closest?.("button")?.id;
      if (id === "sourceApplyBtn") applySourceMenu();
      else if (id === "sourceDeleteBtn") {
        const source = selectedSource();
        if (!source) return;
        deleteSource(source.id);
        closeSourceMenu();
        simulationEffects.commitSourceMutation();
      } else if (id === "sourceCloseBtn") {
        closeSourceMenu();
        sim.render();
      } else if (id === "monitorApplyBtn") applyMonitorMenu();
      else if (id === "monitorDeleteBtn") {
        const monitor = explicitlySelectedMonitor();
        if (!monitor) return;
        deleteMonitor(monitor.id);
        closeMonitorMenu();
        simulationEffects.commitMonitorMutation();
      } else if (id === "monitorCloseBtn") {
        closeMonitorMenu();
        sim.render();
      }
    });

    const monitorInputs = new Set(["monitorQuantityInput", "monitorXInput", "monitorYInput"]);
    const sourceInputs = new Set(["sourceTypeInput", "sourceShapeInput", "sourceXInput", "sourceYInput", "sourcePhaseInput", "sourceOrderInput"]);
    const handleControlInput = (event) => {
      const id = event.target?.id;
      if (monitorInputs.has(id)) syncMonitorEditorTarget();
      else if (sourceInputs.has(id)) syncSourceEditorTarget();
    };
    documentRef.addEventListener("input", handleControlInput);
    documentRef.addEventListener("change", handleControlInput);
    global.addEventListener("fdtd:slider-input", (event) => {
      const id = event?.detail?.id;
      if (["monitorLengthInput", "monitorAngleInput"].includes(id)) syncMonitorEditorTarget();
      else if (["frequencyInput", "sourceAngleInput", "sourceTimePhaseInput"].includes(id)) syncSourceAndResetDiagnostics();
      else if (["amplitudeInput", "sourceWidthInput"].includes(id)) syncSourceEditorTarget();
    });
  }

  global.FdtdSourceMonitorControlBindings = Object.freeze({
    bindSourceMonitorControls,
  });
})(window);
