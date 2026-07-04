(function initFdtdSceneCodec(global) {
  "use strict";

  const SCENE_SNAPSHOT_VERSION = 1;
  const SCENE_SHARE_URL_LIMIT = 7600;
  const SERIALIZABLE_STATE_KEYS = Object.freeze([
    "theme",
    "timeRate",
    "renderFps",
    "gain",
    "autoScale",
    "fieldComponent",
    "fieldDisplay",
    "fieldQuiver",
    "diagnosticsEnabled",
    "visualLayerBoundaries",
    "visualLayerMonitors",
    "visualLayerAxes",
    "visualLayerScale",
    "visualLayerSources",
    "visualLayerColorbar",
    "analysisEnabled",
    "analysisSampleEvery",
    "sweepMode",
    "sweepStart",
    "sweepEnd",
    "sweepSamples",
    "sweepSteps",
    "sweepBidirectional",
    "viewMode",
    "viewProjection",
    "materialPart",
    "canvasMode",
    "sources",
    "selectedSourceId",
    "nextSourceId",
    "sourceDefaults",
    "monitors",
    "selectedMonitorId",
    "nextMonitorId",
    "monitorDefaults",
    "wavelengthUm",
    "cellsPerWavelength",
    "boundary",
    "boundarySides",
    "preset",
    "gridNx",
    "gridNy",
    "slabThicknessLambda",
    "customAnisotropic",
    "customEpsReal",
    "customEpsImag",
    "customEpsYReal",
    "customEpsYImag",
    "customMuReal",
    "customMuImag",
    "customMuYReal",
    "customMuYImag",
    "brush",
    "brushTool",
    "brushGeometry",
    "geometryWidthLambda",
    "geometryHeightLambda",
    "geometryRadiusLambda",
    "geometryInnerRadiusLambda",
    "brushSizeLambda",
    "materialModulationEnabled",
    "materialNonlinearEnabled",
    "materialHarmonicEnabled",
    "materialDispersionEnabled",
    "materialConductivityEnabled",
    "materialSaturableGainEnabled",
    "materialPhaseChangeEnabled",
    "materialGyrotropyEnabled",
    "materialBianisotropyEnabled",
    "materialFullVectorBianisotropyEnabled",
    "kerrChi3",
    "kerrSaturation",
    "harmonicChi2",
    "harmonicChi3",
    "harmonicSaturation",
    "conductivitySigma",
    "conductivitySigmaY",
    "gainSaturation",
    "phaseEpsOn",
    "phaseLossOn",
    "phaseThresholdOn",
    "phaseThresholdOff",
    "phaseTauOn",
    "phaseTauOff",
    "gyrotropyG",
    "bianisotropyKappa",
    "dispersionModel",
    "dispersionOmegaP",
    "dispersionGamma",
    "dispersionOmega0",
    "dispersionDeltaEps",
    "dispersionTau",
    "modulationDepth",
    "modulationFrequency",
    "modulationPeriodLambda",
    "modulationAngleDeg",
    "modulationPhaseDeg",
  ]);

  function clonePlainData(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function safeFilePart(text) {
    return (
      String(text || "scene")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "scene"
    );
  }

  function serializableStateSnapshot(state, keys = SERIALIZABLE_STATE_KEYS) {
    const snapshot = {};
    for (const key of keys) {
      snapshot[key] = clonePlainData(state[key]);
    }
    return snapshot;
  }

  function createSceneSnapshot({ grid, materials, state, view, includeMaterials = true, exportedAt = new Date().toISOString() } = {}) {
    return {
      kind: "fdtd-2d-scene",
      version: SCENE_SNAPSHOT_VERSION,
      exportedAt,
      grid: clonePlainData(grid || {}),
      view: clonePlainData(view || {}),
      state: serializableStateSnapshot(state || {}),
      materials: includeMaterials ? clonePlainData(materials || []) : undefined,
    };
  }

  function encodeSceneSnapshot(snapshot) {
    const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodeSceneSnapshot(encoded) {
    const text = String(encoded || "");
    const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  global.FdtdSceneCodec = Object.freeze({
    SCENE_SHARE_URL_LIMIT,
    SCENE_SNAPSHOT_VERSION,
    SERIALIZABLE_STATE_KEYS,
    clonePlainData,
    createSceneSnapshot,
    decodeSceneSnapshot,
    encodeSceneSnapshot,
    safeFilePart,
    serializableStateSnapshot,
  });
})(window);
