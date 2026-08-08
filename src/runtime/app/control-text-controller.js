(function initFdtdControlTextController(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error("Control text dependency must provide " + name + "().");
    }
    return value;
  }

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error("Control text dependency must provide " + name + ".");
    }
    return value;
  }

  function createControlTextController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const sim = requireObject(dependencies.sim, "sim");
    const el = requireObject(dependencies.el, "el");
    const uiCore = requireObject(dependencies.uiCore, "uiCore");
    const controlSyncUi = requireObject(dependencies.controlSyncUi, "controlSyncUi");
    const materialEditorUi = requireObject(dependencies.materialEditorUi, "materialEditorUi");
    const sceneDescriptions = requireObject(dependencies.sceneDescriptions, "sceneDescriptions");
    const COURANT = Number(dependencies.COURANT);
    if (!Number.isFinite(COURANT)) throw new Error("Control text dependency must provide finite COURANT.");

    const clampAllSourcesToInterior = requireFunction(dependencies.clampAllSourcesToInterior, "clampAllSourcesToInterior");
    const clampAllMonitorsToInterior = requireFunction(dependencies.clampAllMonitorsToInterior, "clampAllMonitorsToInterior");
    const updateCanvasAspectRatio = requireFunction(dependencies.updateCanvasAspectRatio, "updateCanvasAspectRatio");
    const updateThemeControls = requireFunction(dependencies.updateThemeControls, "updateThemeControls");
    const activeSourceEditorTarget = requireFunction(dependencies.activeSourceEditorTarget, "activeSourceEditorTarget");
    const selectedSource = requireFunction(dependencies.selectedSource, "selectedSource");
    const activeMonitorEditorTarget = requireFunction(dependencies.activeMonitorEditorTarget, "activeMonitorEditorTarget");
    const formatTimeRate = requireFunction(dependencies.formatTimeRate, "formatTimeRate");
    const updateSourceShapeOptionLabels = requireFunction(dependencies.updateSourceShapeOptionLabels, "updateSourceShapeOptionLabels");
    const updateFieldDisplayControls = requireFunction(dependencies.updateFieldDisplayControls, "updateFieldDisplayControls");
    const normalizeDispersionModel = requireFunction(dependencies.normalizeDispersionModel, "normalizeDispersionModel");
    const formatLambdaOutput = requireFunction(dependencies.formatLambdaOutput, "formatLambdaOutput");
    const updateSceneGuidePanel = requireFunction(dependencies.updateSceneGuidePanel, "updateSceneGuidePanel");
    const syncSceneBrowserSelection = requireFunction(dependencies.syncSceneBrowserSelection, "syncSceneBrowserSelection");
    const updateRunControls = requireFunction(dependencies.updateRunControls, "updateRunControls");
    const updateCanvasModeControls = requireFunction(dependencies.updateCanvasModeControls, "updateCanvasModeControls");
    const updateCanvasInteractionState = requireFunction(dependencies.updateCanvasInteractionState, "updateCanvasInteractionState");
    const updateVisualControls = requireFunction(dependencies.updateVisualControls, "updateVisualControls");
    const updateBrushControls = requireFunction(dependencies.updateBrushControls, "updateBrushControls");
    const updateBoundaryMenuControls = requireFunction(dependencies.updateBoundaryMenuControls, "updateBoundaryMenuControls");
    const populateSourceEditor = requireFunction(dependencies.populateSourceEditor, "populateSourceEditor");
    const populateMonitorEditor = requireFunction(dependencies.populateMonitorEditor, "populateMonitorEditor");
    const boundarySummaryLabel = requireFunction(dependencies.boundarySummaryLabel, "boundarySummaryLabel");
    const cellsToLambda = requireFunction(dependencies.cellsToLambda, "cellsToLambda");
    const formatCompactLambda = requireFunction(dependencies.formatCompactLambda, "formatCompactLambda");
    const formatLambda = requireFunction(dependencies.formatLambda, "formatLambda");
    const updateMaterialWarning = requireFunction(dependencies.updateMaterialWarning, "updateMaterialWarning");
    const updateStabilitySummary = requireFunction(dependencies.updateStabilitySummary, "updateStabilitySummary");
    const updateSweepControls = requireFunction(dependencies.updateSweepControls, "updateSweepControls");
    const updateAnalysisControls = requireFunction(dependencies.updateAnalysisControls, "updateAnalysisControls");

    function updateControlText() {
      clampAllSourcesToInterior();
      clampAllMonitorsToInterior();
      updateCanvasAspectRatio(sim.nx, sim.ny);
      updateThemeControls();
      const editorSource = activeSourceEditorTarget() || selectedSource();
      const editorMonitor = activeMonitorEditorTarget();
      controlSyncUi.syncRuntimeAndViewControls({ el, formatTimeRate, state, uiCore });
      updateSourceShapeOptionLabels();
      updateFieldDisplayControls();
      if (el.wavelengthInput) el.wavelengthInput.value = state.wavelengthUm.toFixed(2);
      if (el.cellsPerWavelengthInput) el.cellsPerWavelengthInput.value = String(state.cellsPerWavelength);
      el.customAnisotropyInput.checked = state.customAnisotropic;
      materialEditorUi.syncCustomMaterialLabels({ el, state });
      materialEditorUi.syncCustomMaterialEditorValues({ el, normalizeDispersionModel, state });
      controlSyncUi.syncSceneAndGridControls({ el, formatLambdaOutput, sceneDescriptions, state });
      updateSceneGuidePanel();
      syncSceneBrowserSelection();
      updateRunControls();
      updateCanvasModeControls();
      updateCanvasInteractionState();
      updateVisualControls();
      updateBrushControls();
      updateBoundaryMenuControls();
      if (editorSource) {
        populateSourceEditor(editorSource);
      }
      if (editorMonitor) {
        populateMonitorEditor(editorMonitor);
      }
      const boundary = boundarySummaryLabel();
      if (el.headerSimulationStatus) {
        const status = sim.lastDiverged ? "Unstable" : state.running ? "Running" : sim.time > 0 ? "Paused" : "Ready";
        el.headerSimulationStatus.dataset.state = status.toLowerCase();
        const statusLabel = el.headerSimulationStatus.querySelector(".header-status-label");
        if (statusLabel) statusLabel.textContent = status;
      }
      if (el.statusGridOutput) el.statusGridOutput.textContent = `${sim.nx} \u00d7 ${sim.ny}`;
      if (el.statusStepOutput) el.statusStepOutput.textContent = String(sim.time);
      if (el.statusCourantOutput) el.statusCourantOutput.textContent = COURANT.toFixed(2);
      if (el.statusBoundaryOutput) el.statusBoundaryOutput.textContent = boundary;
      controlSyncUi.syncConfigSummaryControls({
        boundary,
        cellsToLambda,
        courant: COURANT,
        el,
        formatCompactLambda,
        formatLambda,
        gridNx: sim.nx,
        gridNy: sim.ny,
        state,
      });
      updateMaterialWarning();
      updateStabilitySummary();
      updateSweepControls();
      updateAnalysisControls();
    }

    return Object.freeze({
      updateControlText,
    });
  }

  global.FdtdControlTextController = Object.freeze({
    createControlTextController,
  });
})(window);
