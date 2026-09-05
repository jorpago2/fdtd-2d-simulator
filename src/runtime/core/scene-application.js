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
    const applyTheme = typeof dependencies.applyTheme === "function" ? dependencies.applyTheme : null;
    const validateSceneSnapshot = typeof dependencies.validateSceneSnapshot === "function"
      ? dependencies.validateSceneSnapshot
      : (snapshot) => isPlainObject(snapshot)
        && snapshot.kind === "fdtd-2d-scene"
        && isPlainObject(snapshot.grid)
        && isPlainObject(snapshot.view)
        && isPlainObject(snapshot.state);
    const snapshotMaterials = typeof dependencies.snapshotMaterials === "function" ? dependencies.snapshotMaterials : null;

    function captureCurrentScene() {
      return {
        gridNx: sim.nx,
        gridNy: sim.ny,
        materials: snapshotMaterials ? snapshotMaterials() : null,
        state: clonePlainData(state),
        theme: documentElement?.dataset?.theme,
        view: { x: sim.viewX, y: sim.viewY, zoom: sim.viewZoom },
      };
    }

    function restoreCurrentScene(previous) {
      const currentKeys = Object.keys(state);
      currentKeys.forEach((key) => delete state[key]);
      Object.assign(state, clonePlainData(previous.state));
      if (applyTheme && previous.theme) applyTheme(previous.theme, false);
      else if (documentElement && previous.theme) documentElement.dataset.theme = previous.theme;

      if (Number.isInteger(previous.gridNx) && Number.isInteger(previous.gridNy)) sim.resize(previous.gridNx, previous.gridNy);
      if (previous.materials && Array.isArray(previous.materials)) {
        sim.clearMaterials(false);
        previous.materials.forEach((cell) => {
          sim.writeMaterialCell(clampInt(cell.x, 1, sim.nx - 2), clampInt(cell.y, 1, sim.ny - 2), cell);
        });
        sim.refreshCpmlMaterialContinuation(false);
      }
      if (previous.view) {
        sim.viewZoom = clampNumber(Number(previous.view.zoom) || 1, 1, sim.maxViewZoom());
        sim.viewX = Number(previous.view.x) || 0;
        sim.viewY = Number(previous.view.y) || 0;
        sim.clampView();
      }
      sim.resetFields();
      sim.resetDiagnostics();
      sim.measure();
      updateControlText();
      updateStats();
      drawSweepChart();
      sim.render();
    }

    function applySceneState(snapshot) {
      if (!validateSceneSnapshot(snapshot)) {
        throw new Error("Invalid scene JSON: required scene, grid, view, state or material fields are missing");
      }

      const previous = captureCurrentScene();
      try {
        disableResponsiveGridOrientation();

        const importedState = snapshot.state;
        const grid = snapshot.grid;
        assignSerializableImportedState({
          clonePlainData,
          importedState,
          serializableStateKeys,
          state,
        });

        state.gridNx = clampInt(grid.nx ?? importedState.gridNx ?? state.gridNx, 80, maxGrid.nx);
        state.gridNy = clampInt(grid.ny ?? importedState.gridNy ?? state.gridNy, 60, maxGrid.ny);
        normalizeImportedStateValues();
        if (applyTheme) {
          applyTheme(state.theme, false);
        } else if (documentElement) {
          documentElement.dataset.theme = state.theme;
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
      } catch (error) {
        try {
          restoreCurrentScene(previous);
        } catch (restoreError) {
          global.console?.error?.("Unable to restore the previous FDTD scene after import failure.", restoreError);
        }
        throw error;
      }
    }

    return Object.freeze({ applySceneState });
  }

  global.FdtdSceneApplication = Object.freeze({
    createSceneApplicationController,
  });
})(window);
