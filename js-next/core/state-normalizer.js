(function initFdtdNextStateNormalizer(global) {
  "use strict";

  const root = global.FdtdNext || (global.FdtdNext = {});
  const core = root.core || (root.core = {});
  const contracts = core.contracts;
  if (!contracts) {
    throw new Error("js-next/core/contracts.js must be loaded before js-next/core/state-normalizer.js");
  }

  const FIELD_DISPLAY_VALUES = Object.freeze(["scalar", "transverseX", "transverseY", "electricMag", "magneticMag"]);
  const VIEW_MODE_VALUES = Object.freeze(["field", "epsilon", "mu", "poynting"]);

  function objectHasKey(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function normalizeChoice(value, allowedValues, fallback) {
    return allowedValues.includes(value) ? value : fallback;
  }

  function createStateNormalizer(dependencies) {
    const state = contracts.requireObject(dependencies.state, "state");
    const maxGrid = contracts.requireObject(dependencies.maxGrid, "maxGrid");
    const visualLayerStateKeys = contracts.requireObject(dependencies.visualLayerStateKeys, "visualLayerStateKeys");
    const materialNames = contracts.requireObject(dependencies.materialNames, "materialNames");
    const defaultMonitorConfig = contracts.requireObject(dependencies.defaultMonitorConfig, "defaultMonitorConfig");
    const clampNumber = contracts.requireFunction(dependencies.clampNumber, "clampNumber");
    const clampInt = contracts.requireFunction(dependencies.clampInt, "clampInt");
    const normalizeTheme = contracts.requireFunction(dependencies.normalizeTheme, "normalizeTheme");
    const normalizedVisualProfile = contracts.requireFunction(dependencies.normalizedVisualProfile, "normalizedVisualProfile");
    const normalizeSweepMode = contracts.requireFunction(dependencies.normalizeSweepMode, "normalizeSweepMode");
    const normalizeBoundaryMode = contracts.requireFunction(dependencies.normalizeBoundaryMode, "normalizeBoundaryMode");
    const normalizeBoundarySides = contracts.requireFunction(dependencies.normalizeBoundarySides, "normalizeBoundarySides");
    const knownPresetValue = contracts.requireFunction(dependencies.knownPresetValue, "knownPresetValue");
    const normalizeDispersionModel = contracts.requireFunction(dependencies.normalizeDispersionModel, "normalizeDispersionModel");
    const normalizeBrushGeometryState = contracts.requireFunction(dependencies.normalizeBrushGeometryState, "normalizeBrushGeometryState");
    const normalizeMonitor = contracts.requireFunction(dependencies.normalizeMonitor, "normalizeMonitor");

    function normalizeVisualLayerFlags() {
      Object.values(visualLayerStateKeys).forEach((stateKey) => {
        state[stateKey] = state[stateKey] == null ? stateKey !== "visualLayerMonitors" : Boolean(state[stateKey]);
      });
    }

    function normalizeMonitorState() {
      state.monitors = Array.isArray(state.monitors) ? state.monitors : [];
      state.selectedMonitorId = state.monitors.some((monitor) => monitor.id === state.selectedMonitorId)
        ? state.selectedMonitorId
        : null;
      state.nextMonitorId = Math.max(1, Number(state.nextMonitorId) || 1);
      state.monitorDefaults = normalizeMonitor({
        ...defaultMonitorConfig,
        ...(state.monitorDefaults && typeof state.monitorDefaults === "object" ? state.monitorDefaults : {}),
      });
    }

    function normalizeImportedStateValues() {
      state.theme = normalizeTheme(state.theme);
      state.stepsPerFrame = clampNumber(Number(state.stepsPerFrame) || 1, 0.2, 12);
      state.gain = clampNumber(Number(state.gain) || 1, 0.1, 10);
      state.autoScale = Boolean(state.autoScale);
      state.fieldComponent = state.fieldComponent === "hz" ? "hz" : "ez";
      state.fieldDisplay = normalizeChoice(state.fieldDisplay, FIELD_DISPLAY_VALUES, "scalar");
      state.fieldQuiver = Boolean(state.fieldQuiver);
      state.diagnosticsEnabled = Boolean(state.diagnosticsEnabled);
      state.visualProfile = normalizedVisualProfile(state.visualProfile);
      normalizeVisualLayerFlags();
      state.analysisEnabled = Boolean(state.analysisEnabled);
      state.analysisSampleEvery = clampInt(state.analysisSampleEvery, 1, 16);
      state.sweepMode = normalizeSweepMode(state.sweepMode);
      state.sweepSamples = clampInt(state.sweepSamples, 3, 41);
      state.sweepSteps = clampInt(state.sweepSteps, 120, 4000);
      state.sweepBidirectional = Boolean(state.sweepBidirectional);
      state.viewMode = normalizeChoice(state.viewMode, VIEW_MODE_VALUES, "field");
      state.viewProjection = state.viewProjection === "3d" ? "3d" : "2d";
      state.materialPart = state.materialPart === "imag" ? "imag" : "real";
      state.canvasMode = state.canvasMode === "brush" ? "brush" : "select";
      state.wavelengthUm = clampNumber(Number(state.wavelengthUm) || 1, 0.1, 10);
      state.cellsPerWavelength = clampInt(state.cellsPerWavelength, 8, 80);
      state.gridNx = clampInt(state.gridNx, 80, maxGrid.nx);
      state.gridNy = clampInt(state.gridNy, 60, maxGrid.ny);
      state.boundary = normalizeBoundaryMode(state.boundary);
      normalizeBoundarySides();
      if (!knownPresetValue(state.preset)) state.preset = "empty";
      state.slabThicknessLambda = clampNumber(Number(state.slabThicknessLambda) || 0.5, 0.05, 20);
      state.customAnisotropic = Boolean(state.customAnisotropic);
      state.dispersionModel = normalizeDispersionModel(state.dispersionModel);
      state.materialDispersionEnabled = Boolean(state.materialDispersionEnabled) || state.dispersionModel !== "none";
      state.materialModulationEnabled = Boolean(state.materialModulationEnabled);
      state.materialNonlinearEnabled = Boolean(state.materialNonlinearEnabled);
      state.materialHarmonicEnabled = Boolean(state.materialHarmonicEnabled);
      state.materialConductivityEnabled = Boolean(state.materialConductivityEnabled);
      state.materialSaturableGainEnabled = Boolean(state.materialSaturableGainEnabled);
      state.materialPhaseChangeEnabled = Boolean(state.materialPhaseChangeEnabled);
      state.materialGyrotropyEnabled = Boolean(state.materialGyrotropyEnabled);
      state.materialBianisotropyEnabled = Boolean(state.materialBianisotropyEnabled);
      state.brush = objectHasKey(materialNames, state.brush) ? state.brush : "custom";
      state.brushTool = state.brushTool === "geometry" ? "geometry" : "paint";
      normalizeBrushGeometryState();
      normalizeMonitorState();
    }

    return Object.freeze({
      normalizeImportedStateValues,
    });
  }

  core.stateNormalizer = Object.freeze({
    FIELD_DISPLAY_VALUES,
    VIEW_MODE_VALUES,
    createStateNormalizer,
    normalizeChoice,
  });
})(window);
