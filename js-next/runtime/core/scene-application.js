(function initFdtdSceneApplication(global) {
  "use strict";

  const SOURCE_MONITOR_STATE_KEYS = Object.freeze(new Set([
    "sources",
    "sourceDefaults",
    "selectedSourceId",
    "nextSourceId",
    "monitors",
    "monitorDefaults",
    "selectedMonitorId",
    "nextMonitorId",
  ]));
  const LEGACY_IMPORTED_STATE_KEYS = Object.freeze({
    stepsPerFrame: "timeRate",
  });

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Scene application dependency must provide ${name}().`);
    }
    return value;
  }

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Scene application dependency must provide ${name}.`);
    }
    return value;
  }

  function assignSerializableImportedState({
    clonePlainData,
    importedState,
    serializableStateKeys,
    state,
  }) {
    for (const key of serializableStateKeys) {
      if (SOURCE_MONITOR_STATE_KEYS.has(key)) continue;
      if (Object.prototype.hasOwnProperty.call(importedState, key)) {
        state[key] = clonePlainData(importedState[key]);
      }
    }
    for (const [legacyKey, stateKey] of Object.entries(LEGACY_IMPORTED_STATE_KEYS)) {
      if (Object.prototype.hasOwnProperty.call(importedState, stateKey)) continue;
      if (Object.prototype.hasOwnProperty.call(importedState, legacyKey)) {
        state[stateKey] = clonePlainData(importedState[legacyKey]);
      }
    }
  }

  function applyMaterialPayload({ clampInt, sim, snapshot, state }) {
    if (Array.isArray(snapshot.materials)) {
      sim.clearMaterials(false);
      snapshot.materials.forEach((cell) => {
        if (!isPlainObject(cell)) return;
        sim.writeMaterialCell(clampInt(cell.x, 1, sim.nx - 2), clampInt(cell.y, 1, sim.ny - 2), cell);
      });
      sim.refreshCpmlMaterialContinuation(false);
      return;
    }
    sim.applyPreset(state.preset);
  }

  function restoreView({ clampNumber, sim, snapshot }) {
    if (!isPlainObject(snapshot.view)) return;
    sim.viewZoom = clampNumber(Number(snapshot.view.zoom) || 1, 1, sim.maxViewZoom());
    sim.viewX = Number(snapshot.view.x) || 0;
    sim.viewY = Number(snapshot.view.y) || 0;
    sim.clampView();
  }

  function createSceneApplicationController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const sim = requireObject(dependencies.sim, "sim");
    const maxGrid = requireObject(dependencies.maxGrid, "maxGrid");
    const el = dependencies.el || {};
    const documentElement = dependencies.documentElement || global.document?.documentElement;
    const serializableStateKeys = Array.from(dependencies.serializableStateKeys || []);
    const clonePlainData = requireFunction(dependencies.clonePlainData, "clonePlainData");
    const clampInt = requireFunction(dependencies.clampInt, "clampInt");
    const clampNumber = dependencies.clampNumber || ((value, min, max) => Math.max(min, Math.min(max, value)));
    const disableResponsiveGridOrientation = dependencies.disableResponsiveGridOrientation || (() => {});
    const normalizeImportedStateValues = requireFunction(dependencies.normalizeImportedStateValues, "normalizeImportedStateValues");
    const clearMaterialSelection = requireFunction(dependencies.clearMaterialSelection, "clearMaterialSelection");
    const clearCanvasHover = requireFunction(dependencies.clearCanvasHover, "clearCanvasHover");
    const closeContextMenus = requireFunction(dependencies.closeContextMenus, "closeContextMenus");
    const sanitizeImportedSources = requireFunction(dependencies.sanitizeImportedSources, "sanitizeImportedSources");
    const sanitizeImportedMonitors = requireFunction(dependencies.sanitizeImportedMonitors, "sanitizeImportedMonitors");
    const updateControlText = requireFunction(dependencies.updateControlText, "updateControlText");
    const updateStats = requireFunction(dependencies.updateStats, "updateStats");
    const drawSweepChart = requireFunction(dependencies.drawSweepChart, "drawSweepChart");

    function applySceneState(snapshot) {
      if (!isPlainObject(snapshot)) {
        throw new Error("Invalid scene JSON.");
      }

      disableResponsiveGridOrientation();

      const importedState = isPlainObject(snapshot.state) ? snapshot.state : {};
      const grid = isPlainObject(snapshot.grid) ? snapshot.grid : {};
      assignSerializableImportedState({
        clonePlainData,
        importedState,
        serializableStateKeys,
        state,
      });

      state.gridNx = clampInt(grid.nx ?? importedState.gridNx ?? state.gridNx, 80, maxGrid.nx);
      state.gridNy = clampInt(grid.ny ?? importedState.gridNy ?? state.gridNy, 60, maxGrid.ny);
      normalizeImportedStateValues();
      if (documentElement) {
        documentElement.dataset.theme = state.theme;
      }
      if (el.presetInput) {
        el.presetInput.value = state.preset;
      }

      clearMaterialSelection(false);
      clearCanvasHover(false);
      closeContextMenus();
      state.sweepResults = [];
      state.sweepRunning = false;
      state.sweepCancelRequested = false;
      state.retiringSources = [];

      sim.resize(state.gridNx, state.gridNy);
      sanitizeImportedSources(importedState);
      sanitizeImportedMonitors(importedState);
      applyMaterialPayload({ clampInt, sim, snapshot, state });
      restoreView({ clampNumber, sim, snapshot });

      sim.resetFields();
      sim.resetDiagnostics();
      sim.measure();
      updateControlText();
      updateStats();
      drawSweepChart();
      sim.render();
    }

    return Object.freeze({ applySceneState });
  }

  global.FdtdSceneApplication = Object.freeze({
    createSceneApplicationController,
  });
})(window);
