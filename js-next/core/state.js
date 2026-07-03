(function initFdtdNextState(global) {
  "use strict";

  const root = global.FdtdNext || (global.FdtdNext = {});
  const core = root.core || (root.core = {});
  const contracts = core.contracts;
  if (!contracts) {
    throw new Error("js-next/core/contracts.js must be loaded before js-next/core/state.js");
  }

  const DEFAULT_MONITOR_CONFIG = Object.freeze({
    quantity: "scalar",
    xLambda: 4.5,
    yLambda: 3,
    lengthLambda: 2,
    angleDeg: 90,
  });

  function normalizeTheme(theme) {
    return contracts.enumValue(theme, ["light", "dark"], "light");
  }

  function normalizeUiDepth(depth) {
    return contracts.enumValue(depth, ["teaching", "advanced"], "teaching");
  }

  function readStoredTheme(storageKey, windowRef = global) {
    try {
      return normalizeTheme(windowRef.localStorage?.getItem(storageKey));
    } catch {
      return "light";
    }
  }

  function createInitialAppState(options) {
    const config = contracts.requireObject(options, "createInitialAppState options");
    const defaultSourceConfig = contracts.requireObject(config.defaultSourceConfig, "defaultSourceConfig");
    const defaultBoundarySides = contracts.requireObject(config.defaultBoundarySides, "defaultBoundarySides");
    const defaultGrid = contracts.requireObject(config.defaultGrid, "defaultGrid");
    const themeStorageKey = String(config.themeStorageKey || "");
    const windowRef = config.windowRef || global;

    return {
      running: false,
      theme: readStoredTheme(themeStorageKey, windowRef),
      uiDepth: config.uiDepth == null ? "teaching" : normalizeUiDepth(config.uiDepth),
      timeRate: 1,
      renderFps: 0,
      gain: 1,
      autoScale: false,
      fieldComponent: "ez",
      fieldDisplay: "scalar",
      fieldQuiver: false,
      diagnosticsEnabled: false,
      visualProfile: "auto",
      visualLayerBoundaries: true,
      visualLayerDiagnostics: true,
      visualLayerMonitors: false,
      visualLayerAxes: true,
      visualLayerScale: true,
      visualLayerSources: true,
      visualLayerColorbar: true,
      analysisEnabled: true,
      analysisSampleEvery: 4,
      sweepMode: "angle",
      sweepStart: 0,
      sweepEnd: 70,
      sweepSamples: 9,
      sweepSteps: 720,
      sweepBidirectional: false,
      sweepRunning: false,
      sweepCancelRequested: false,
      sweepResults: [],
      viewMode: "field",
      viewProjection: "2d",
      surfaceOrbitYawDeg: 0,
      surfaceOrbitPitchDeg: 0,
      materialPart: "real",
      canvasMode: "select",
      drawPreviewCell: null,
      hoveredSourceId: null,
      hoveredMonitorId: null,
      sources: [],
      retiringSources: [],
      selectedSourceId: null,
      nextSourceId: 1,
      sourceDefaults: contracts.clonePlainData(defaultSourceConfig),
      monitors: [],
      selectedMonitorId: null,
      nextMonitorId: 1,
      monitorDefaults: { ...DEFAULT_MONITOR_CONFIG },
      wavelengthUm: 1,
      cellsPerWavelength: 20,
      boundary: "absorbing",
      boundarySides: contracts.clonePlainData(defaultBoundarySides),
      preset: "empty",
      gridNx: contracts.positiveNumber(defaultGrid.nx, "defaultGrid.nx"),
      gridNy: contracts.positiveNumber(defaultGrid.ny, "defaultGrid.ny"),
      slabThicknessLambda: 0.5,
      customAnisotropic: false,
      customEpsReal: 4,
      customEpsImag: 0.0005,
      customEpsYReal: 4,
      customEpsYImag: 0.0005,
      customMuReal: 1,
      customMuImag: 0,
      customMuYReal: 1,
      customMuYImag: 0,
      brush: "custom",
      brushTool: "paint",
      brushGeometry: "rectangle",
      geometryWidthLambda: 1,
      geometryHeightLambda: 0.5,
      geometryRadiusLambda: 0.45,
      geometryInnerRadiusLambda: 0.25,
      brushSizeLambda: 0.2,
      materialModulationEnabled: false,
      materialNonlinearEnabled: false,
      materialHarmonicEnabled: false,
      materialDispersionEnabled: false,
      materialConductivityEnabled: false,
      materialSaturableGainEnabled: false,
      materialPhaseChangeEnabled: false,
      materialGyrotropyEnabled: false,
      materialBianisotropyEnabled: false,
      materialFullVectorBianisotropyEnabled: false,
      kerrChi3: 0.5,
      kerrSaturation: 5,
      harmonicChi2: 0.08,
      harmonicChi3: 0,
      harmonicSaturation: 6,
      conductivitySigma: 0,
      conductivitySigmaY: 0,
      gainSaturation: 4,
      phaseEpsOn: 9,
      phaseLossOn: 0.08,
      phaseThresholdOn: 0.8,
      phaseThresholdOff: 0.2,
      phaseTauOn: 18,
      phaseTauOff: 180,
      gyrotropyG: 0.25,
      bianisotropyKappa: 0.2,
      dispersionModel: "none",
      dispersionOmegaP: 0.28,
      dispersionGamma: 0.018,
      dispersionOmega0: 0.15,
      dispersionDeltaEps: 2,
      dispersionTau: 18,
      modulationDepth: 0.2,
      modulationFrequency: 0.01,
      modulationPeriodLambda: 2,
      modulationAngleDeg: 0,
      modulationPhaseDeg: 0,
    };
  }

  core.state = Object.freeze({
    DEFAULT_MONITOR_CONFIG,
    createInitialAppState,
    normalizeTheme,
    normalizeUiDepth,
    readStoredTheme,
  });
})(window);
