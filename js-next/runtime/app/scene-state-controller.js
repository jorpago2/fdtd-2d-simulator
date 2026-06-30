(function initFdtdSceneStateController(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Scene state dependency must provide ${name}().`);
    }
    return value;
  }

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Scene state dependency must provide ${name}.`);
    }
    return value;
  }

  function createSceneStateController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const el = requireObject(dependencies.el, "el");
    const sceneCodec = requireObject(dependencies.sceneCodec, "sceneCodec");
    const sourceMonitorModel = requireObject(dependencies.sourceMonitorModel, "sourceMonitorModel");
    const getSim = requireFunction(dependencies.getSim, "getSim");
    const getStateNormalizer = requireFunction(dependencies.getStateNormalizer, "getStateNormalizer");
    const getSceneApplication = requireFunction(dependencies.getSceneApplication, "getSceneApplication");
    const sourceModelContext = requireFunction(dependencies.sourceModelContext, "sourceModelContext");
    const monitorModelContext = requireFunction(dependencies.monitorModelContext, "monitorModelContext");

    function safeFilePart(text) {
      return sceneCodec.safeFilePart(text);
    }

    function clonePlainData(value) {
      return sceneCodec.clonePlainData(value);
    }

    function setReproStatus(text, isWarning = false) {
      if (!el.reproStatus) return;
      el.reproStatus.textContent = text;
      el.reproStatus.classList.toggle("is-warning", isWarning);
    }

    function knownPresetValue(value) {
      if (!el.presetInput) return false;
      return Array.from(el.presetInput.options).some((option) => option.value === value);
    }

    function serializableStateSnapshot() {
      return sceneCodec.serializableStateSnapshot(state);
    }

    function snapshotDrawnMaterialCells() {
      const sim = getSim();
      const cells = [];
      for (let y = 1; y < sim.ny - 1; y += 1) {
        for (let x = 1; x < sim.nx - 1; x += 1) {
          if (sim.isInBoundaryControlRegion?.(x, y)) continue;
          const idx = sim.id(x, y);
          if (sim.material[idx] === 0) continue;
          cells.push(sim.snapshotMaterialCell(x, y));
        }
      }
      return cells;
    }

    function exportSceneState({ includeMaterials = true } = {}) {
      const sim = getSim();
      return sceneCodec.createSceneSnapshot({
        grid: { nx: sim.nx, ny: sim.ny },
        includeMaterials,
        materials: includeMaterials ? snapshotDrawnMaterialCells() : [],
        state,
        view: {
          x: sim.viewX,
          y: sim.viewY,
          zoom: sim.viewZoom,
        },
      });
    }

    function normalizeImportedStateValues() {
      const stateNormalizer = getStateNormalizer();
      if (!stateNormalizer) {
        throw new Error("State normalizer is not initialized.");
      }
      stateNormalizer.normalizeImportedStateValues();
    }

    function sanitizeImportedSources(importedState) {
      const sanitizedSources = sourceMonitorModel.sanitizeImportedSources(importedState, sourceModelContext());
      state.sources = sanitizedSources.sources;
      state.selectedSourceId = sanitizedSources.selectedSourceId;
      state.sourceDefaults = sanitizedSources.sourceDefaults;
      state.nextSourceId = sanitizedSources.nextSourceId;
    }

    function sanitizeImportedMonitors(importedState) {
      const sanitizedMonitors = sourceMonitorModel.sanitizeImportedMonitors(importedState, monitorModelContext());
      state.monitors = sanitizedMonitors.monitors;
      state.selectedMonitorId = sanitizedMonitors.selectedMonitorId;
      state.monitorDefaults = sanitizedMonitors.monitorDefaults;
      state.nextMonitorId = sanitizedMonitors.nextMonitorId;
    }

    function applySceneState(snapshot) {
      const sceneApplication = getSceneApplication();
      if (!sceneApplication) {
        throw new Error("Scene application controller is not initialized.");
      }
      sceneApplication.applySceneState(snapshot);
    }

    function encodeSceneSnapshot(snapshot) {
      return sceneCodec.encodeSceneSnapshot(snapshot);
    }

    function decodeSceneSnapshot(encoded) {
      return sceneCodec.decodeSceneSnapshot(encoded);
    }

    return Object.freeze({
      safeFilePart,
      clonePlainData,
      setReproStatus,
      knownPresetValue,
      serializableStateSnapshot,
      snapshotDrawnMaterialCells,
      exportSceneState,
      normalizeImportedStateValues,
      sanitizeImportedSources,
      sanitizeImportedMonitors,
      applySceneState,
      encodeSceneSnapshot,
      decodeSceneSnapshot,
    });
  }

  global.FdtdSceneStateController = Object.freeze({
    createSceneStateController,
  });
})(window);
