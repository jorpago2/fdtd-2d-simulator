"use strict";

function simulatedFieldLetter() {
  return state.fieldComponent === "hz" ? "H" : "E";
}

function simulatedFieldComponentHtml() {
  return `<i>${simulatedFieldLetter()}</i><sub>z</sub>`;
}

function simulatedFieldUnitHtml() {
  return `<i>${simulatedFieldLetter()}</i><sub>0</sub>`;
}

function scalarFieldComponentKey() {
  return state.fieldComponent === "hz" ? "Hz" : "Ez";
}

function solverModeLabel() {
  return state.fieldComponent === "hz" ? "TEz / Hz" : "TMz / Ez";
}

function transverseFieldLetter() {
  return state.fieldComponent === "hz" ? "E" : "H";
}

function transverseFieldUnitHtml() {
  return `<i>${transverseFieldLetter()}</i><sub>0</sub>`;
}

function fieldComponentHtml(letter, component = "") {
  return `<i>${letter}</i>${component ? `<sub>${component}</sub>` : ""}`;
}

function fieldDisplayConfig(display = state.fieldDisplay) {
  const scalarLetter = simulatedFieldLetter();
  const transverseLetter = transverseFieldLetter();
  const scalarUnit = simulatedFieldUnitHtml();
  const transverseUnit = transverseFieldUnitHtml();
  const configs = {
    scalar: {
      key: scalarFieldComponentKey(),
      labelHtml: simulatedFieldComponentHtml(),
      metricHtml: simulatedFieldComponentHtml(),
      title: `Show ${scalarFieldComponentKey()}`,
      unitHtml: scalarUnit,
      magnitude: false,
    },
    transverseX: {
      key: `${transverseLetter}x`,
      labelHtml: fieldComponentHtml(transverseLetter, "x"),
      metricHtml: fieldComponentHtml(transverseLetter, "x"),
      title: `Show ${transverseLetter}x`,
      unitHtml: transverseUnit,
      magnitude: false,
    },
    transverseY: {
      key: `${transverseLetter}y`,
      labelHtml: fieldComponentHtml(transverseLetter, "y"),
      metricHtml: fieldComponentHtml(transverseLetter, "y"),
      title: `Show ${transverseLetter}y`,
      unitHtml: transverseUnit,
      magnitude: false,
    },
    electricMag: {
      key: "|E|",
      labelHtml: `|${fieldComponentHtml("E")}|`,
      metricHtml: fieldComponentHtml("E"),
      title: "Show electric-field magnitude",
      unitHtml: fieldComponentHtml("E", "0"),
      magnitude: true,
    },
    magneticMag: {
      key: "|H|",
      labelHtml: `|${fieldComponentHtml("H")}|`,
      metricHtml: fieldComponentHtml("H"),
      title: "Show magnetic-field magnitude",
      unitHtml: fieldComponentHtml("H", "0"),
      magnitude: true,
    },
  };
  if (state.viewMode === "poynting") {
    const poyntingConfigs = {
      scalar: {
        key: "|S|",
        labelHtml: `|${fieldComponentHtml("S")}|`,
        metricHtml: fieldComponentHtml("S"),
        title: "Show Poynting-vector magnitude",
        unitHtml: fieldComponentHtml("S", "0"),
        magnitude: true,
      },
      transverseX: {
        key: "Sx",
        labelHtml: fieldComponentHtml("S", "x"),
        metricHtml: fieldComponentHtml("S", "x"),
        title: "Show x-directed Poynting flux",
        unitHtml: fieldComponentHtml("S", "0"),
        magnitude: false,
      },
      transverseY: {
        key: "Sy",
        labelHtml: fieldComponentHtml("S", "y"),
        metricHtml: fieldComponentHtml("S", "y"),
        title: "Show y-directed Poynting flux",
        unitHtml: fieldComponentHtml("S", "0"),
        magnitude: false,
      },
    };
    return poyntingConfigs[display] || poyntingConfigs.scalar;
  }
  return configs[display] || configs.scalar;
}

function currentSourceLetter() {
  return state.fieldComponent === "hz" ? "M" : "J";
}

function sourceShapeLabel(shape) {
  const sourceLetter = currentSourceLetter();
  const dipoleKind = state.fieldComponent === "hz" ? "magnetic" : "electric";
  if (inPlaneElectricCurrentShapes.has(shape)) return "In-plane electric dipole Jx/Jy";
  return {
    point: `${sourceLetter}z filament`,
    line: "Plane wave",
    gaussianProfile: "Gaussian line",
    gaussianSpot: `Gaussian ${sourceLetter}z patch`,
    pointDipole: `Point ${dipoleKind} dipole`,
    dipole: `${sourceLetter}z dipole pair`,
    circularDipoleCw: `Circular ${dipoleKind} dipole +90 deg`,
    circularDipoleCcw: `Circular ${dipoleKind} dipole -90 deg`,
    janusDipole: `Janus ${dipoleKind} dipole`,
    huygens: "Huygens source",
    quadrupole: `${sourceLetter}z quadrupole pattern`,
    multipole: `2D ${sourceLetter}z multipole pattern`,
    evanescentLine: "Evanescent line",
  }[shape] || "Source";
}

function sourceCouplingLabel(shape) {
  if (inPlaneElectricCurrentShapes.has(shape)) return "in-plane electric current";
  if (circularDipoleSourceShapes.has(shape)) return "quadrature dipole";
  if (shape === "janusDipole") return "quadrature Janus pair";
  if (shape === "huygens") return "cardioid Huygens pair";
  if (shape === "evanescentLine") return "evanescent incident field";
  return incidentFieldSourceShapes.has(shape) ? "incident field" : `out-of-plane ${currentSourceLetter()}z`;
}

function normalizeTheme(theme) {
  return theme === "dark" ? "dark" : "light";
}

function initialTheme() {
  try {
    return normalizeTheme(window.localStorage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "light";
  }
}

function normalizeUiDepth(depth) {
  return depth === "advanced" ? "advanced" : "teaching";
}

function initialUiDepth() {
  try {
    return normalizeUiDepth(window.localStorage?.getItem(UI_DEPTH_STORAGE_KEY));
  } catch {
    return "teaching";
  }
}

const VISUAL_PROFILE_NAMES = Object.freeze(["auto", "clean", "teaching", "analysis", "custom"]);
const VISUAL_LAYER_STATE_KEYS = Object.freeze({
  boundaries: "visualLayerBoundaries",
  diagnostics: "visualLayerDiagnostics",
  axes: "visualLayerAxes",
  scale: "visualLayerScale",
  sources: "visualLayerSources",
  colorbar: "visualLayerColorbar",
});
const COMPACT_RESULTS_MEDIA_QUERY = "(max-width: 1180px)";
const COMPACT_PANEL_TITLE_MEDIA_QUERY = "(max-width: 430px)";
const VISUAL_PROFILE_LAYERS = Object.freeze({
  clean: Object.freeze({
    boundaries: false,
    diagnostics: false,
    axes: false,
    scale: false,
    sources: true,
    colorbar: true,
  }),
  teaching: Object.freeze({
    boundaries: true,
    diagnostics: true,
    axes: true,
    scale: true,
    sources: true,
    colorbar: true,
  }),
  analysis: Object.freeze({
    boundaries: true,
    diagnostics: true,
    axes: false,
    scale: true,
    sources: true,
    colorbar: true,
  }),
});

const state = {
  running: false,
  theme: initialTheme(),
  uiDepth: initialUiDepth(),
  stepsPerFrame: 1,
  gain: 1,
  autoScale: true,
  fieldComponent: "ez",
  fieldDisplay: "scalar",
  fieldQuiver: false,
  diagnosticsEnabled: true,
  visualProfile: "auto",
  visualLayerBoundaries: true,
  visualLayerDiagnostics: true,
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
  materialPart: "real",
  canvasMode: "select",
  hoveredSourceId: null,
  sources: [{ id: 1, ...defaultSourceConfig }],
  selectedSourceId: 1,
  nextSourceId: 2,
  sourceDefaults: { ...defaultSourceConfig },
  wavelengthUm: 1,
  cellsPerWavelength: 20,
  boundary: "absorbing",
  boundarySides: { ...defaultBoundarySides },
  preset: "empty",
  gridNx: DEFAULT_GRID.nx,
  gridNy: DEFAULT_GRID.ny,
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

const SCENE_SNAPSHOT_VERSION = 1;
const SCENE_SHARE_URL_LIMIT = 7600;
const SERIALIZABLE_STATE_KEYS = Object.freeze([
  "theme",
  "stepsPerFrame",
  "gain",
  "autoScale",
  "fieldComponent",
  "fieldDisplay",
  "fieldQuiver",
  "diagnosticsEnabled",
  "visualProfile",
  "visualLayerBoundaries",
  "visualLayerDiagnostics",
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

document.documentElement.dataset.theme = state.theme;

let selectedMaterialRegion = null;
let hoveredMaterialRegion = null;

function normalizeBoundaryMode(mode) {
  return mode === "reflective" ? "reflective" : "absorbing";
}

function normalizeDispersionModel(model) {
  return ["drude", "plasma", "lorentz", "debye"].includes(model) ? model : "none";
}

function dispersionAxesMask(value, fallback = 3) {
  if (typeof value === "number") return clampInt(value, 0, 3);
  if (Array.isArray(value)) {
    let mask = 0;
    value.forEach((axis) => {
      const normalized = String(axis).toLowerCase();
      if (normalized === "x" || normalized === "z") mask |= 1;
      if (normalized === "y") mask |= 2;
    });
    return mask || fallback;
  }
  const normalized = String(value || "").toLowerCase();
  if (normalized === "x" || normalized === "z") return 1;
  if (normalized === "y") return 2;
  if (normalized === "xy" || normalized === "both" || normalized === "all") return 3;
  return fallback;
}

function brushDispersionParams() {
  const model = normalizeDispersionModel(state.dispersionModel);
  if (model === "none") return null;
  return {
    dispersion: model,
    dispersionAxes: 3,
    omegaP: state.dispersionOmegaP,
    gamma: state.dispersionGamma,
    omega0: state.dispersionOmega0,
    deltaEps: state.dispersionDeltaEps,
    tau: state.dispersionTau,
  };
}

function brushConductivityParams() {
  if (!state.materialConductivityEnabled) return { sigma: 0, sigmaY: 0 };
  const sigma = Math.max(0, Number(state.conductivitySigma) || 0);
  return {
    sigma,
    sigmaY: state.customAnisotropic ? Math.max(0, Number(state.conductivitySigmaY) || 0) : sigma,
  };
}

function brushPhaseChangeParams() {
  if (!state.materialPhaseChangeEnabled) return null;
  return {
    phaseChange: true,
    phaseEpsOn: state.phaseEpsOn,
    phaseLossOn: state.phaseLossOn,
    phaseThresholdOn: state.phaseThresholdOn,
    phaseThresholdOff: state.phaseThresholdOff,
    phaseTauOn: state.phaseTauOn,
    phaseTauOff: state.phaseTauOff,
  };
}

function brushGyrotropyValue() {
  return state.materialGyrotropyEnabled ? clamp(Number(state.gyrotropyG) || 0, -5, 5) : 0;
}

function normalizeBianisotropyKappa(value) {
  return clamp(Number(value) || 0, -BIANISOTROPY_KAPPA_LIMIT, BIANISOTROPY_KAPPA_LIMIT);
}

function brushBianisotropyValue() {
  return state.materialBianisotropyEnabled ? normalizeBianisotropyKappa(state.bianisotropyKappa) : 0;
}

function normalizeBoundarySides() {
  const fallback = normalizeBoundaryMode(state.boundary);
  if (!state.boundarySides || typeof state.boundarySides !== "object") {
    state.boundarySides = {
      left: fallback,
      right: fallback,
      top: fallback,
      bottom: fallback,
    };
  }
  for (const side of BOUNDARY_SIDES) {
    state.boundarySides[side] = normalizeBoundaryMode(state.boundarySides[side] || fallback);
  }
  const modes = BOUNDARY_SIDES.map((side) => state.boundarySides[side]);
  state.boundary = modes.every((mode) => mode === "absorbing")
    ? "absorbing"
    : modes.every((mode) => mode === "reflective")
      ? "reflective"
      : "mixed";
  return state.boundarySides;
}

function boundarySideMode(side) {
  const sides = normalizeBoundarySides();
  return sides[side] || "absorbing";
}

function boundarySideIsAbsorbing(side) {
  return boundarySideMode(side) === "absorbing";
}

function anyAbsorbingBoundarySide() {
  return BOUNDARY_SIDES.some((side) => boundarySideIsAbsorbing(side));
}

function setBoundarySideMode(side, mode) {
  normalizeBoundarySides();
  if (!BOUNDARY_SIDES.includes(side)) return;
  state.boundarySides[side] = normalizeBoundaryMode(mode);
  normalizeBoundarySides();
}

function boundarySummaryLabel() {
  normalizeBoundarySides();
  if (state.boundary === "absorbing") return "PML absorbing";
  if (state.boundary === "reflective") return "reflective";
  const absorbing = BOUNDARY_SIDES.filter((side) => boundarySideIsAbsorbing(side))
    .map((side) => boundarySideLabels[side].toLowerCase())
    .join(", ");
  return `mixed boundary (${absorbing || "no"} PML)`;
}

function currentBrushLabel() {
  if (state.brush === "custom" && state.materialBianisotropyEnabled) return "Custom magnetoelectric κn";
  if (state.brush === "custom" && state.materialGyrotropyEnabled) return "Custom gyrotropic ε tensor";
  return state.brush === "custom" && state.customAnisotropic ? "Custom anisotropic ε, μ" : materialNames[state.brush];
}

function sourceSummaryLabel() {
  if (state.sources.length === 1) {
    return `${sourceShapeLabel(state.sources[0].shape)} \u00b7 ${sourceCouplingLabel(state.sources[0].shape)}`;
  }
  return `${state.sources.length} sources`;
}

const el = {
  canvas: document.getElementById("simCanvas"),
  canvasFrame: document.querySelector(".canvas-frame"),
  stage: document.querySelector(".stage"),
  canvasToolbar: document.querySelector(".canvas-toolbar"),
  canvasActionMenu: document.getElementById("canvasActionMenu"),
  canvasActionToggle: document.getElementById("canvasActionToggle"),
  canvasViewControls: document.getElementById("canvasViewControls"),
  canvasOptionsToggle: document.getElementById("canvasOptionsToggle"),
  appShell: document.querySelector(".app-shell"),
  controlPanel: document.getElementById("controlPanel"),
  controlPanelKicker: document.getElementById("controlPanelKicker"),
  controlPanelTitle: document.getElementById("controlPanelTitle"),
  controlPanelNextBtn: document.getElementById("controlPanelNextBtn"),
  controlDrawerToggle: document.getElementById("controlDrawerToggle"),
  controlDrawerCloseBtn: document.getElementById("controlDrawerCloseBtn"),
  controlDrawerBackdrop: document.getElementById("controlDrawerBackdrop"),
  controlTabButtons: document.querySelectorAll("[data-control-tab]"),
  controlTabPanels: document.querySelectorAll("[data-control-panel]"),
  mobileLayerButtons: document.querySelectorAll(".mobile-layer-button[data-mobile-layer]"),
  themeButtons: document.querySelectorAll("[data-theme-choice]"),
  uiDepthButtons: document.querySelectorAll("[data-ui-depth-choice]"),
  fieldComponentButtons: document.querySelectorAll("[data-field-component]"),
  viewModeButtons: document.querySelectorAll("[data-view-mode]"),
  fieldViewButton: document.querySelector('[data-view-mode="field"]'),
  fieldDisplayControl: document.getElementById("fieldDisplayControl"),
  fieldDisplayButtons: document.querySelectorAll("[data-field-display]"),
  fieldQuiverControl: document.getElementById("fieldQuiverControl"),
  fieldQuiverInput: document.getElementById("fieldQuiverInput"),
  fieldQuiverLabel: document.getElementById("fieldQuiverLabel"),
  visualProfileButtons: document.querySelectorAll("[data-visual-profile]"),
  visualLayerInputs: document.querySelectorAll("[data-visual-layer]"),
  viewProjectionButtons: document.querySelectorAll("[data-view-projection]"),
  materialPartControl: document.getElementById("materialPartControl"),
  materialPartButtons: document.querySelectorAll("[data-material-part]"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  playPauseIcon: document.getElementById("playPauseIcon"),
  stepBtn: document.getElementById("stepBtn"),
  resetBtn: document.getElementById("resetBtn"),
  runStepBtn: document.getElementById("runStepBtn"),
  runResetBtn: document.getElementById("runResetBtn"),
  canvasFocusBtn: document.getElementById("canvasFocusBtn"),
  focusControlsBtn: document.getElementById("focusControlsBtn"),
  saveBtn: document.getElementById("saveBtn"),
  selectModeBtn: document.getElementById("selectModeBtn"),
  brushModeBtn: document.getElementById("brushModeBtn"),
  speedInput: document.getElementById("speedInput"),
  speedOutput: document.getElementById("speedOutput"),
  gainInput: document.getElementById("gainInput"),
  gainOutput: document.getElementById("gainOutput"),
  autoScaleInput: document.getElementById("autoScaleInput"),
  diagnosticsInput: document.getElementById("diagnosticsInput"),
  diagnosticsResetBtn: document.getElementById("diagnosticsResetBtn"),
  resultsStateOutput: document.getElementById("resultsStateOutput"),
  resultsDetailPanels: document.querySelectorAll(".results-detail-panel"),
  sweepModeInput: document.getElementById("sweepModeInput"),
  sweepStartInput: document.getElementById("sweepStartInput"),
  sweepEndInput: document.getElementById("sweepEndInput"),
  sweepSamplesInput: document.getElementById("sweepSamplesInput"),
  sweepStepsInput: document.getElementById("sweepStepsInput"),
  sweepBidirectionalInput: document.getElementById("sweepBidirectionalInput"),
  sweepRunBtn: document.getElementById("sweepRunBtn"),
  sweepExportBtn: document.getElementById("sweepExportBtn"),
  sweepStatus: document.getElementById("sweepStatus"),
  sweepChart: document.getElementById("sweepChart"),
  sweepChartReadout: document.getElementById("sweepChartReadout"),
  analysisInput: document.getElementById("analysisInput"),
  analysisResetBtn: document.getElementById("analysisResetBtn"),
  analysisStatus: document.getElementById("analysisStatus"),
  spectrumChart: document.getElementById("spectrumChart"),
  farFieldChart: document.getElementById("farFieldChart"),
  analysisChartReadout: document.getElementById("analysisChartReadout"),
  sourceTypeInput: document.getElementById("sourceTypeInput"),
  sourceShapeInput: document.getElementById("sourceShapeInput"),
  frequencyInput: document.getElementById("frequencyInput"),
  frequencyOutput: document.getElementById("frequencyOutput"),
  sourceAmplitudeLabel: document.getElementById("sourceAmplitudeLabel"),
  amplitudeInput: document.getElementById("amplitudeInput"),
  amplitudeOutput: document.getElementById("amplitudeOutput"),
  sourceXInput: document.getElementById("sourceXInput"),
  sourceYInput: document.getElementById("sourceYInput"),
  sourceWidthControl: document.getElementById("sourceWidthControl"),
  sourceWidthInput: document.getElementById("sourceWidthInput"),
  sourceWidthOutput: document.getElementById("sourceWidthOutput"),
  sourceAngleControl: document.getElementById("sourceAngleControl"),
  sourceAngleInput: document.getElementById("sourceAngleInput"),
  sourceAngleOutput: document.getElementById("sourceAngleOutput"),
  sourceTimePhaseControl: document.getElementById("sourceTimePhaseControl"),
  sourceTimePhaseInput: document.getElementById("sourceTimePhaseInput"),
  sourceTimePhaseOutput: document.getElementById("sourceTimePhaseOutput"),
  sourceOrderControl: document.getElementById("sourceOrderControl"),
  sourceOrderInput: document.getElementById("sourceOrderInput"),
  sourcePhaseControl: document.getElementById("sourcePhaseControl"),
  sourcePhaseInput: document.getElementById("sourcePhaseInput"),
  wavelengthInput: document.getElementById("wavelengthInput"),
  cellsPerWavelengthInput: document.getElementById("cellsPerWavelengthInput"),
  customAnisotropyInput: document.getElementById("customAnisotropyInput"),
  customEpsRealLabel: document.getElementById("customEpsRealLabel"),
  customEpsImagLabel: document.getElementById("customEpsImagLabel"),
  customMuRealLabel: document.getElementById("customMuRealLabel"),
  customMuImagLabel: document.getElementById("customMuImagLabel"),
  customEpsRealInput: document.getElementById("customEpsRealInput"),
  customEpsImagInput: document.getElementById("customEpsImagInput"),
  customEpsYRealInput: document.getElementById("customEpsYRealInput"),
  customEpsYImagInput: document.getElementById("customEpsYImagInput"),
  customMuRealInput: document.getElementById("customMuRealInput"),
  customMuImagInput: document.getElementById("customMuImagInput"),
  customMuYRealInput: document.getElementById("customMuYRealInput"),
  customMuYImagInput: document.getElementById("customMuYImagInput"),
  gyrotropyEnabledInput: document.getElementById("gyrotropyEnabledInput"),
  gyrotropyGInput: document.getElementById("gyrotropyGInput"),
  bianisotropyEnabledInput: document.getElementById("bianisotropyEnabledInput"),
  bianisotropyKappaInput: document.getElementById("bianisotropyKappaInput"),
  modulationEnabledInput: document.getElementById("modulationEnabledInput"),
  modulationDepthInput: document.getElementById("modulationDepthInput"),
  modulationFrequencyInput: document.getElementById("modulationFrequencyInput"),
  modulationPeriodInput: document.getElementById("modulationPeriodInput"),
  modulationAngleInput: document.getElementById("modulationAngleInput"),
  modulationPhaseInput: document.getElementById("modulationPhaseInput"),
  nonlinearEnabledInput: document.getElementById("nonlinearEnabledInput"),
  kerrChi3Input: document.getElementById("kerrChi3Input"),
  kerrSaturationInput: document.getElementById("kerrSaturationInput"),
  harmonicEnabledInput: document.getElementById("harmonicEnabledInput"),
  harmonicChi2Input: document.getElementById("harmonicChi2Input"),
  harmonicChi3Input: document.getElementById("harmonicChi3Input"),
  harmonicSaturationInput: document.getElementById("harmonicSaturationInput"),
  phaseChangeEnabledInput: document.getElementById("phaseChangeEnabledInput"),
  phaseEpsOnInput: document.getElementById("phaseEpsOnInput"),
  phaseLossOnInput: document.getElementById("phaseLossOnInput"),
  phaseThresholdOnInput: document.getElementById("phaseThresholdOnInput"),
  phaseThresholdOffInput: document.getElementById("phaseThresholdOffInput"),
  phaseTauOnInput: document.getElementById("phaseTauOnInput"),
  phaseTauOffInput: document.getElementById("phaseTauOffInput"),
  conductivityEnabledInput: document.getElementById("conductivityEnabledInput"),
  conductivitySigmaInput: document.getElementById("conductivitySigmaInput"),
  conductivitySigmaYControl: document.getElementById("conductivitySigmaYControl"),
  conductivitySigmaYInput: document.getElementById("conductivitySigmaYInput"),
  saturableGainEnabledInput: document.getElementById("saturableGainEnabledInput"),
  gainSaturationInput: document.getElementById("gainSaturationInput"),
  dispersionModelInput: document.getElementById("dispersionModelInput"),
  dispersionOmegaPControl: document.getElementById("dispersionOmegaPControl"),
  dispersionOmegaPInput: document.getElementById("dispersionOmegaPInput"),
  dispersionGammaControl: document.getElementById("dispersionGammaControl"),
  dispersionGammaInput: document.getElementById("dispersionGammaInput"),
  dispersionOmega0Control: document.getElementById("dispersionOmega0Control"),
  dispersionOmega0Input: document.getElementById("dispersionOmega0Input"),
  dispersionDeltaEpsControl: document.getElementById("dispersionDeltaEpsControl"),
  dispersionDeltaEpsInput: document.getElementById("dispersionDeltaEpsInput"),
  dispersionTauControl: document.getElementById("dispersionTauControl"),
  dispersionTauInput: document.getElementById("dispersionTauInput"),
  materialWarning: document.getElementById("materialWarning"),
  presetInput: document.getElementById("presetInput"),
  sceneSearchInput: document.getElementById("sceneSearchInput"),
  sceneFilterBar: document.getElementById("sceneFilterBar"),
  sceneCards: document.getElementById("sceneCards"),
  sceneNote: document.getElementById("sceneNote"),
  slabThicknessControl: document.getElementById("slabThicknessControl"),
  slabThicknessInput: document.getElementById("slabThicknessInput"),
  slabThicknessOutput: document.getElementById("slabThicknessOutput"),
  gridNxInput: document.getElementById("gridNxInput"),
  gridNyInput: document.getElementById("gridNyInput"),
  stabilityCflValue: document.getElementById("stabilityCflValue"),
  stabilityResolutionValue: document.getElementById("stabilityResolutionValue"),
  stabilityMediaValue: document.getElementById("stabilityMediaValue"),
  stabilityEstimateValue: document.getElementById("stabilityEstimateValue"),
  stabilityNote: document.getElementById("stabilityNote"),
  configScaleOutput: document.getElementById("configScaleOutput"),
  configGridOutput: document.getElementById("configGridOutput"),
  configBoundaryOutput: document.getElementById("configBoundaryOutput"),
  configCflOutput: document.getElementById("configCflOutput"),
  configStabilityOutput: document.getElementById("configStabilityOutput"),
  exportSceneBtn: document.getElementById("exportSceneBtn"),
  importSceneBtn: document.getElementById("importSceneBtn"),
  importSceneFileInput: document.getElementById("importSceneFileInput"),
  copySceneUrlBtn: document.getElementById("copySceneUrlBtn"),
  shareSceneUrlOutput: document.getElementById("shareSceneUrlOutput"),
  reproStatus: document.getElementById("reproStatus"),
  brushSizeInput: document.getElementById("brushSizeInput"),
  brushSizeOutput: document.getElementById("brushSizeOutput"),
  brushSizeControl: document.getElementById("brushSizeControl"),
  brushToolControl: document.getElementById("brushToolControl"),
  brushToolButtons: document.querySelectorAll("[data-brush-tool]"),
  brushGeometryPanel: document.getElementById("brushGeometryPanel"),
  brushGeometryInput: document.getElementById("brushGeometryInput"),
  geometryWidthControl: document.getElementById("geometryWidthControl"),
  geometryWidthInput: document.getElementById("geometryWidthInput"),
  geometryHeightControl: document.getElementById("geometryHeightControl"),
  geometryHeightInput: document.getElementById("geometryHeightInput"),
  geometryRadiusControl: document.getElementById("geometryRadiusControl"),
  geometryRadiusInput: document.getElementById("geometryRadiusInput"),
  geometryInnerRadiusControl: document.getElementById("geometryInnerRadiusControl"),
  geometryInnerRadiusInput: document.getElementById("geometryInnerRadiusInput"),
  brushMenu: document.getElementById("brushMenu"),
  brushMenuHint: document.getElementById("brushMenuHint"),
  brushMenuCloseBtn: document.getElementById("brushMenuCloseBtn"),
  brushMenuSizeInput: document.getElementById("brushMenuSizeInput"),
  brushMenuSizeOutput: document.getElementById("brushMenuSizeOutput"),
  brushMenuClearMaterialsBtn: document.getElementById("brushMenuClearMaterialsBtn"),
  brushMenuClearFieldsBtn: document.getElementById("brushMenuClearFieldsBtn"),
  boundaryMenu: document.getElementById("boundaryMenu"),
  boundaryMenuHint: document.getElementById("boundaryMenuHint"),
  boundaryMenuCloseBtn: document.getElementById("boundaryMenuCloseBtn"),
  boundaryMenuInput: document.getElementById("boundaryMenuInput"),
  clearMaterialsBtn: document.getElementById("clearMaterialsBtn"),
  clearFieldsBtn: document.getElementById("clearFieldsBtn"),
  stepCounter: document.getElementById("stepCounter"),
  maxField: document.getElementById("maxField"),
  topModeValue: document.getElementById("topModeValue"),
  topEngineValue: document.getElementById("topEngineValue"),
  topGridValue: document.getElementById("topGridValue"),
  topBoundaryValue: document.getElementById("topBoundaryValue"),
  topHealthValue: document.getElementById("topHealthValue"),
  topStepValue: document.getElementById("topStepValue"),
  topMaxFieldValue: document.getElementById("topMaxFieldValue"),
  mobileModeValue: document.getElementById("mobileModeValue"),
  mobileCanvasStateValue: document.getElementById("mobileCanvasStateValue"),
  mobileGridValue: document.getElementById("mobileGridValue"),
  mobileHealthValue: document.getElementById("mobileHealthValue"),
  mobileStepValue: document.getElementById("mobileStepValue"),
  mobileMaxFieldValue: document.getElementById("mobileMaxFieldValue"),
  simGuideSolver: document.getElementById("simGuideSolver"),
  simGuideSource: document.getElementById("simGuideSource"),
  simGuideBoundary: document.getElementById("simGuideBoundary"),
  simGuideMaterial: document.getElementById("simGuideMaterial"),
  simGuideCfl: document.getElementById("simGuideCfl"),
  simGuideWarning: document.getElementById("simGuideWarning"),
  inspectorKind: document.getElementById("inspectorKind"),
  inspectorTitle: document.getElementById("inspectorTitle"),
  inspectorDetails: document.getElementById("inspectorDetails"),
  inspectorNote: document.getElementById("inspectorNote"),
  inspectorEditBtn: document.getElementById("inspectorEditBtn"),
  inspectorClearBtn: document.getElementById("inspectorClearBtn"),
  selectionSheet: document.getElementById("selectionSheet"),
  selectionSheetKind: document.getElementById("selectionSheetKind"),
  selectionSheetTitle: document.getElementById("selectionSheetTitle"),
  selectionSheetDetails: document.getElementById("selectionSheetDetails"),
  selectionSheetEditBtn: document.getElementById("selectionSheetEditBtn"),
  selectionSheetClearBtn: document.getElementById("selectionSheetClearBtn"),
  fieldMetricSymbol: document.getElementById("fieldMetricSymbol"),
  fieldMetricUnit: document.getElementById("fieldMetricUnit"),
  energyValue: document.getElementById("energyValue"),
  summaryReflectanceOutput: document.getElementById("summaryReflectanceOutput"),
  summaryTransmittanceOutput: document.getElementById("summaryTransmittanceOutput"),
  summaryBalanceOutput: document.getElementById("summaryBalanceOutput"),
  summaryAngleOutput: document.getElementById("summaryAngleOutput"),
  fluxLeftOutput: document.getElementById("fluxLeftOutput"),
  diagnosticAngleOutput: document.getElementById("diagnosticAngleOutput"),
  reflectedPowerOutput: document.getElementById("reflectedPowerOutput"),
  fluxRightOutput: document.getElementById("fluxRightOutput"),
  reflectanceOutput: document.getElementById("reflectanceOutput"),
  transmittanceOutput: document.getElementById("transmittanceOutput"),
  gridLabel: document.getElementById("gridLabel"),
  hudModeLabel: document.getElementById("hudModeLabel"),
  hudStepLabel: document.getElementById("hudStepLabel"),
  hudFieldLabel: document.getElementById("hudFieldLabel"),
  canvasStateBadge: document.getElementById("canvasStateBadge"),
  canvasFocusStatus: document.getElementById("canvasFocusStatus"),
  canvasFocusStateValue: document.getElementById("canvasFocusStateValue"),
  canvasFocusStepValue: document.getElementById("canvasFocusStepValue"),
  canvasFocusMaxValue: document.getElementById("canvasFocusMaxValue"),
  canvasFocusExitBtn: document.getElementById("canvasFocusExitBtn"),
  materialLabel: document.getElementById("materialLabel"),
  colorbar: document.querySelector(".colorbar"),
  colorbarTitle: document.getElementById("colorbarTitle"),
  colorbarGradient: document.getElementById("colorbarGradient"),
  colorbarMax: document.getElementById("colorbarMax"),
  colorbarMid: document.getElementById("colorbarMid"),
  colorbarMin: document.getElementById("colorbarMin"),
  modePill: document.getElementById("modePill"),
  engineValue: document.getElementById("engineValue"),
  sourceMenu: document.getElementById("sourceMenu"),
  sourceMenuTitle: document.getElementById("sourceMenuTitle"),
  sourceMenuHint: document.getElementById("sourceMenuHint"),
  sourceApplyBtn: document.getElementById("sourceApplyBtn"),
  sourceDeleteBtn: document.getElementById("sourceDeleteBtn"),
  sourceCloseBtn: document.getElementById("sourceCloseBtn"),
};

const sceneBrowserState = {
  records: [],
  filter: "all",
};

const COMPACT_CONTROLS_MEDIA_QUERY = "(max-width: 1440px)";
let automaticGridOrientationEnabled = true;

function disableResponsiveGridOrientation() {
  automaticGridOrientationEnabled = false;
}

function gridSizeMatches(grid, nx = state.gridNx, ny = state.gridNy) {
  return Number(nx) === grid.nx && Number(ny) === grid.ny;
}

function gridSizeIsAutoOrientable(nx = state.gridNx, ny = state.gridNy) {
  return (
    gridSizeMatches(DEFAULT_GRID, nx, ny) ||
    gridSizeMatches(DEFAULT_PORTRAIT_GRID, nx, ny) ||
    gridSizeMatches(PHONE_PORTRAIT_GRID, nx, ny)
  );
}

function viewportPrefersPortraitGrid() {
  const width = Math.max(1, window.innerWidth || 1);
  const height = Math.max(1, window.innerHeight || 1);
  return compactControlDrawerActive() && height > width * 1.05;
}

function viewportPrefersPhonePortraitGrid() {
  const width = Math.max(1, window.innerWidth || 1);
  const height = Math.max(1, window.innerHeight || 1);
  return width <= 520 && height > width * 1.35;
}

function mobileCanvasViewportActive() {
  return window.matchMedia?.("(max-width: 760px)")?.matches ?? false;
}

function normalizedVisualProfile(profile) {
  return VISUAL_PROFILE_NAMES.includes(profile) ? profile : "auto";
}

function effectiveVisualProfile() {
  const profile = normalizedVisualProfile(state.visualProfile);
  if (profile === "auto") {
    if (state.uiDepth === "advanced") return "analysis";
    return mobileCanvasViewportActive() ? "clean" : "teaching";
  }
  if (profile === "custom") return "custom";
  return profile;
}

function visualLayerSnapshot(profile = effectiveVisualProfile()) {
  if (profile === "custom") {
    return Object.fromEntries(
      Object.entries(VISUAL_LAYER_STATE_KEYS).map(([layer, stateKey]) => [layer, Boolean(state[stateKey])])
    );
  }
  return { ...(VISUAL_PROFILE_LAYERS[profile] || VISUAL_PROFILE_LAYERS.teaching) };
}

function visualLayerEnabled(layer) {
  const stateKey = VISUAL_LAYER_STATE_KEYS[layer];
  if (!stateKey) return true;
  return Boolean(visualLayerSnapshot()[layer]);
}

function applyVisualProfile(profile) {
  state.visualProfile = normalizedVisualProfile(profile);
  updateVisualControls();
  sim.render();
}

function setCustomVisualLayer(layer, enabled) {
  const stateKey = VISUAL_LAYER_STATE_KEYS[layer];
  if (!stateKey) return;
  const snapshot = visualLayerSnapshot();
  Object.entries(VISUAL_LAYER_STATE_KEYS).forEach(([snapshotLayer, snapshotKey]) => {
    state[snapshotKey] = Boolean(snapshot[snapshotLayer]);
  });
  state.visualProfile = "custom";
  state[stateKey] = Boolean(enabled);
  updateVisualControls();
  sim.render();
}

function responsiveDefaultGrid() {
  if (!viewportPrefersPortraitGrid()) return DEFAULT_GRID;
  return viewportPrefersPhonePortraitGrid() ? PHONE_PORTRAIT_GRID : DEFAULT_PORTRAIT_GRID;
}

function applySimulationGridSize(nx, ny, { applyPreset = true, render = true } = {}) {
  clearMaterialSelection(false);
  clearCanvasHover(false);
  state.gridNx = clampInt(nx, 80, MAX_GRID.nx);
  state.gridNy = clampInt(ny, 60, MAX_GRID.ny);
  sim.resize(state.gridNx, state.gridNy);
  clampAllSourcesToInterior();
  if (applyPreset) {
    sim.applyPreset(state.preset);
  }
  sim.measure();
  updateControlText();
  updateStats();
  if (render) {
    sim.render();
  }
}

function applyResponsiveGridOrientation({ render = true } = {}) {
  if (!automaticGridOrientationEnabled) return false;
  if (!gridSizeIsAutoOrientable()) {
    automaticGridOrientationEnabled = false;
    return false;
  }

  const targetGrid = responsiveDefaultGrid();
  if (gridSizeMatches(targetGrid)) return false;
  applySimulationGridSize(targetGrid.nx, targetGrid.ny, { applyPreset: true, render });
  return true;
}

function cssPixelValue(value) {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function stageLayoutChildVisible(element) {
  if (!element || element.hidden) return false;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.position === "absolute" || style.position === "fixed") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

function availableCanvasFrameHeight(viewportHeight, compactViewport) {
  const mobileViewport = mobileCanvasViewportActive();
  const compactReserve = mobileViewport ? Math.min(130, viewportHeight * 0.16) : Math.min(230, viewportHeight * 0.28);
  const viewportTargetHeight = compactViewport ? viewportHeight - compactReserve : viewportHeight * CANVAS_DISPLAY_VIEWPORT_FRACTION;
  if (!el.stage || !el.canvasFrame) return viewportTargetHeight;

  const stageRect = el.stage.getBoundingClientRect();
  if (!stageRect.height) return viewportTargetHeight;

  const stageStyle = getComputedStyle(el.stage);
  const paddingY = cssPixelValue(stageStyle.paddingTop) + cssPixelValue(stageStyle.paddingBottom);
  const rowGap = cssPixelValue(stageStyle.rowGap);
  const flowChildren = Array.from(el.stage.children).filter(stageLayoutChildVisible);
  const nonCanvasHeight = flowChildren
    .filter((child) => child !== el.canvasFrame)
    .reduce((height, child) => height + child.getBoundingClientRect().height, 0);
  const stageCanvasHeight = stageRect.height - nonCanvasHeight - paddingY - rowGap * Math.max(0, flowChildren.length - 1);
  if (mobileViewport) {
    return Math.max(1, stageCanvasHeight);
  }
  return Math.min(viewportTargetHeight, Math.max(1, stageCanvasHeight));
}

function updateCanvasAspectRatio(nx = state.gridNx, ny = state.gridNy) {
  if (!el.canvasFrame) return;
  const safeNx = Math.max(1, Number(nx) || DEFAULT_GRID.nx);
  const safeNy = Math.max(1, Number(ny) || DEFAULT_GRID.ny);
  const physicalAspect = safeNx / safeNy;
  const displayAspect = clamp(physicalAspect, MIN_CANVAS_DISPLAY_ASPECT, MAX_CANVAS_DISPLAY_ASPECT);
  const viewportHeight = Math.max(1, window.innerHeight || MAX_CANVAS_DISPLAY_HEIGHT);
  const compactViewport = window.matchMedia?.(COMPACT_CONTROLS_MEDIA_QUERY)?.matches;
  const availableHeight = availableCanvasFrameHeight(viewportHeight, compactViewport);
  const targetHeight = clamp(availableHeight, 1, MAX_CANVAS_DISPLAY_HEIGHT);
  el.canvasFrame.style.setProperty("--sim-aspect-ratio", `${displayAspect} / 1`);
  el.canvasFrame.style.setProperty("--sim-frame-width-limit", `${displayAspect * targetHeight}px`);
  el.canvasFrame.dataset.aspectCapped = String(Math.abs(displayAspect - physicalAspect) > 1e-6);
}

function updateRangeProgress(input) {
  if (!input) return;
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value);
  const progress = Number.isFinite(value) && max > min ? clamp(((value - min) / (max - min)) * 100, 0, 100) : 0;
  input.style.setProperty("--range-progress", `${progress}%`);
}

function updateAllRangeProgress() {
  document.querySelectorAll('input[type="range"]').forEach(updateRangeProgress);
}

function normalizeSceneText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanSceneGroupLabel(label) {
  return String(label || "General")
    .replace(/^\d+(?:-\d+)?\.\s*/, "")
    .trim();
}

function parseSceneOptionLabel(label) {
  const text = String(label || "").trim();
  const match = text.match(/^(\d+)\s*[\u00b7.-]\s*(.+)$/);
  if (!match) return { index: null, title: text || "Untitled scene" };
  return {
    index: Number(match[1]),
    title: match[2].trim(),
  };
}

function sceneBadgeLabels(record) {
  const haystack = normalizeSceneText(`${record.title} ${record.group} ${record.description}`);
  const badges = [];
  const add = (label) => {
    if (!badges.includes(label)) badges.push(label);
  };

  if (record.value === "empty") add("Blank");
  if (/(waveguide|guide|coupler|mmi|mach|microstrip|stub)/.test(haystack)) add("Guided");
  if (/(resonator|cavity|ring|fabry|purcell|beta-factor|ringdown)/.test(haystack)) add("Resonator");
  if (/(drude|lorentz|debye|plasma|enz|metal|spp|plasmon|negative-index|superlens|conductive|conductivity)/.test(haystack)) {
    add("ADE/loss");
  }
  if (/(kerr|chi2|chi3|nonlinear|vo2|pcm|saturable|switch|limiter)/.test(haystack)) add("Nonlinear");
  if (/(temporal|modulat|floquet|space-time|traveling)/.test(haystack)) add("Time-varying");
  if (/(anisotropic|gyrotropic|bianisotropic|chiral|hyperbolic|tensor)/.test(haystack)) add("Tensor");
  if (/(photonic crystal|phc|ssh|valley|topolog|bic|honeycomb|bloch)/.test(haystack)) add("Periodic/topology");
  if (/(ntff|far-field|rcs|scattering|kerker|mie)/.test(haystack)) add("NTFF");
  if (/(pml|absorbing)/.test(haystack)) add("PML");
  if (/(tez|hz solver|in-plane|magnetic mz)/.test(haystack)) add("TEz");
  if (/(tm|jz|ez|electric dipole)/.test(haystack) && !badges.includes("TEz")) add("TMz");

  return badges.length > 0 ? badges.slice(0, 4) : ["FDTD"];
}

function sceneThumbnailKind(record) {
  const haystack = normalizeSceneText(`${record.title} ${record.group} ${record.description} ${record.badges.join(" ")}`);
  if (/(ring|resonator|cavity|fabry|purcell)/.test(haystack)) return "resonator";
  if (/(waveguide|guide|coupler|mmi|mach|microstrip|stub)/.test(haystack)) return "waveguide";
  if (/(photonic crystal|phc|ssh|valley|topolog|honeycomb|lattice)/.test(haystack)) return "lattice";
  if (/(interface|refraction|brewster|tir|coating|mirror|slab)/.test(haystack)) return "interface";
  if (/(slit|aperture|diffraction|scatter|cylinder|dimer|mie|kerker|rcs)/.test(haystack)) return "scatterer";
  if (/(temporal|modulat|floquet|space-time|traveling)/.test(haystack)) return "temporal";
  if (/(drude|plasmon|spp|enz|metal|negative-index|superlens|hyperlens)/.test(haystack)) return "dispersive";
  return "wave";
}

function collectSceneRecords() {
  if (!el.presetInput) return [];
  return Array.from(el.presetInput.querySelectorAll("option")).map((option) => {
    const rawLabel = option.textContent || option.value;
    const parsed = parseSceneOptionLabel(rawLabel);
    const groupLabel = option.parentElement?.tagName === "OPTGROUP" ? option.parentElement.label : "General";
    const group = cleanSceneGroupLabel(groupLabel);
    const record = {
      value: option.value,
      index: parsed.index,
      title: parsed.title,
      group,
      groupLabel,
      description: sceneDescriptions[option.value] || "",
      badges: [],
      thumbnail: "wave",
      haystack: "",
    };
    record.badges = sceneBadgeLabels(record);
    record.thumbnail = sceneThumbnailKind(record);
    record.haystack = normalizeSceneText(
      `${record.value} ${record.index ?? ""} ${record.title} ${record.group} ${record.groupLabel} ${record.description} ${record.badges.join(" ")}`
    );
    return record;
  });
}

function visibleSceneRecords() {
  const query = normalizeSceneText(el.sceneSearchInput?.value || "");
  const terms = query.split(/\s+/).filter(Boolean);
  return sceneBrowserState.records.filter((record) => {
    if (sceneBrowserState.filter !== "all" && record.groupLabel !== sceneBrowserState.filter) return false;
    return terms.every((term) => record.haystack.includes(term));
  });
}

function renderSceneFilterBar() {
  if (!el.sceneFilterBar) return;
  const groups = Array.from(new Set(sceneBrowserState.records.map((record) => record.groupLabel)));
  const filters = [{ value: "all", label: "All" }, ...groups.map((groupLabel) => ({
    value: groupLabel,
    label: cleanSceneGroupLabel(groupLabel),
  }))];

  el.sceneFilterBar.replaceChildren();
  filters.forEach((filter) => {
    const button = document.createElement("button");
    const active = sceneBrowserState.filter === filter.value;
    button.type = "button";
    button.className = `scene-filter-button${active ? " is-active" : ""}`;
    button.dataset.sceneFilter = filter.value;
    button.setAttribute("aria-pressed", String(active));
    button.textContent = filter.label;
    button.addEventListener("click", () => {
      sceneBrowserState.filter = filter.value;
      renderSceneFilterBar();
      renderSceneCards();
    });
    el.sceneFilterBar.appendChild(button);
  });
}

function renderSceneCards() {
  if (!el.sceneCards) return;
  const records = visibleSceneRecords();
  el.sceneCards.replaceChildren();

  if (records.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "scene-empty-state";
    emptyState.textContent = "No matching scenes.";
    el.sceneCards.appendChild(emptyState);
    return;
  }

  records.forEach((record) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "scene-card";
    card.dataset.sceneCard = record.value;
    card.dataset.sceneThumb = record.thumbnail;
    card.setAttribute("aria-pressed", String(record.value === state.preset));

    const thumbnail = document.createElement("span");
    thumbnail.className = "scene-card-thumb";
    thumbnail.setAttribute("aria-hidden", "true");
    thumbnail.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));

    const header = document.createElement("span");
    header.className = "scene-card-header";

    const number = document.createElement("span");
    number.className = "scene-card-number";
    number.textContent = record.index == null ? "-" : String(record.index);

    const title = document.createElement("span");
    title.className = "scene-card-title";
    title.textContent = record.title;

    header.append(number, title);

    const group = document.createElement("span");
    group.className = "scene-card-group";
    group.textContent = record.group;

    const description = document.createElement("span");
    description.className = "scene-card-description";
    description.textContent = record.description || "Custom FDTD scene.";

    const badgeRow = document.createElement("span");
    badgeRow.className = "scene-card-badges";
    record.badges.forEach((badgeLabel) => {
      const badge = document.createElement("span");
      badge.className = "scene-card-badge";
      badge.textContent = badgeLabel;
      badgeRow.appendChild(badge);
    });

    card.append(thumbnail, header, group, description, badgeRow);
    card.addEventListener("click", () => {
      selectScenePreset(record.value);
    });
    el.sceneCards.appendChild(card);
  });

  syncSceneBrowserSelection();
}

function syncSceneBrowserSelection() {
  if (!el.sceneCards) return;
  const currentPreset = el.presetInput?.value || state.preset;
  el.sceneCards.querySelectorAll("[data-scene-card]").forEach((card) => {
    const active = card.dataset.sceneCard === currentPreset;
    card.classList.toggle("is-active", active);
    card.setAttribute("aria-pressed", String(active));
    if (active) card.setAttribute("aria-current", "true");
    else card.removeAttribute("aria-current");
  });
}

function buildSceneBrowser() {
  sceneBrowserState.records = collectSceneRecords();
  renderSceneFilterBar();
  renderSceneCards();
}

function selectScenePreset(value) {
  if (!el.presetInput || !value) return;
  el.presetInput.value = value;
  applySelectedPreset();
}

function setInspectorDetails(rows) {
  if (!el.inspectorDetails) return;
  el.inspectorDetails.replaceChildren();
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    const labelNode = document.createElement("span");
    const valueNode = document.createElement("output");
    labelNode.textContent = label;
    valueNode.textContent = value;
    row.append(labelNode, valueNode);
    el.inspectorDetails.appendChild(row);
  });
}

function setSelectionSheet(kind, title, rows) {
  if (!el.selectionSheet || !el.selectionSheetKind || !el.selectionSheetTitle || !el.selectionSheetDetails) return;
  el.selectionSheet.hidden = false;
  el.stage?.classList.toggle("selection-sheet-open", true);
  el.selectionSheetKind.textContent = kind;
  el.selectionSheetTitle.textContent = title;
  el.selectionSheetDetails.replaceChildren();
  rows.slice(0, 5).forEach(([label, value]) => {
    const chip = document.createElement("span");
    const labelNode = document.createElement("small");
    const valueNode = document.createElement("output");
    labelNode.textContent = label;
    valueNode.textContent = value;
    chip.append(labelNode, valueNode);
    el.selectionSheetDetails.appendChild(chip);
  });
  updateCanvasInteractionState();
}

function hideSelectionSheet() {
  if (!el.selectionSheet) return;
  el.selectionSheet.hidden = true;
  el.stage?.classList.toggle("selection-sheet-open", false);
  el.selectionSheetDetails?.replaceChildren();
  updateCanvasInteractionState();
}

function materialRegionSignature(region) {
  if (!region?.bounds) return "";
  const b = region.bounds;
  return `${region.cells?.length || 0}:${b.minX},${b.minY},${b.maxX},${b.maxY}`;
}

function materialRegionStats(region) {
  const cells = region?.cells || [];
  if (cells.length === 0) return null;
  const sums = {
    eps: 0,
    loss: 0,
    epsY: 0,
    mu: 0,
    muLoss: 0,
    sigma: 0,
  };
  const features = new Set();
  for (const cell of cells) {
    const idx = sim.id(cell.x, cell.y);
    sums.eps += sim.eps[idx] || 0;
    sums.loss += sim.loss[idx] || 0;
    sums.epsY += sim.epsY[idx] || 0;
    sums.mu += sim.mu[idx] || 0;
    sums.muLoss += sim.muLoss[idx] || 0;
    sums.sigma += sim.conductivity[idx] || 0;
    if (sim.material[idx] === 2) features.add("PEC");
    if (sim.dispersiveMaterial[idx] || sim.muDispersiveMaterial[idx]) features.add("ADE");
    if (sim.nonlinearMaterial[idx]) features.add("Kerr");
    if (sim.modulatedMaterial[idx]) features.add("modulated");
    if (sim.phaseChangeMaterial[idx]) features.add("memory");
    if (sim.gyrotropicMaterial[idx]) features.add("gyro");
    if (sim.bianisotropicMaterial[idx]) features.add("bianiso");
    if (sim.electricTensorMaterial[idx]) features.add("tensor");
    if (sim.conductivity[idx] > 0 || sim.conductivityY[idx] > 0) features.add("sigma");
  }
  const inv = 1 / cells.length;
  return {
    eps: sums.eps * inv,
    loss: sums.loss * inv,
    epsY: sums.epsY * inv,
    mu: sums.mu * inv,
    muLoss: sums.muLoss * inv,
    sigma: sums.sigma * inv,
    features: Array.from(features),
  };
}

function sourceClientPoint(source) {
  const rect = el.canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const x = sim.gridToCanvasX(sim.sourceXCell(source) + 0.5) / dpr + rect.left;
  const y = sim.gridToCanvasY(sim.sourceYCell(source) + 0.5) / dpr + rect.top;
  return { x, y };
}

function materialRegionClientPoint(region) {
  const rect = el.canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const b = region.bounds;
  const centerX = (b.minX + b.maxX + 1) * 0.5;
  const centerY = (b.minY + b.maxY + 1) * 0.5;
  return {
    x: sim.gridToCanvasX(centerX) / dpr + rect.left,
    y: sim.gridToCanvasY(centerY) / dpr + rect.top,
  };
}

function clearCanvasHover(render = true) {
  if (state.hoveredSourceId == null && !hoveredMaterialRegion) return;
  state.hoveredSourceId = null;
  hoveredMaterialRegion = null;
  if (render) sim.render();
}

function updateCanvasHover(event) {
  if (state.canvasMode !== "select" || pointerDown || dragSourcePointerId != null || dragMaterialPointerId != null || panPointerId != null) {
    clearCanvasHover();
    return;
  }
  const source = sim.sourceAtClientPoint(event.clientX, event.clientY);
  const previousSourceId = state.hoveredSourceId;
  const previousRegionKey = materialRegionSignature(hoveredMaterialRegion);
  if (source) {
    state.hoveredSourceId = source.id;
    hoveredMaterialRegion = null;
  } else {
    state.hoveredSourceId = null;
    hoveredMaterialRegion = sim.findMaterialRegionAtClientPoint(event.clientX, event.clientY);
  }
  const nextRegionKey = materialRegionSignature(hoveredMaterialRegion);
  if (previousSourceId !== state.hoveredSourceId || previousRegionKey !== nextRegionKey) {
    sim.render();
  }
}

function updateInspector() {
  if (!el.inspectorKind || !el.inspectorTitle || !el.inspectorDetails) return;
  const source = explicitlySelectedSource();
  const region = selectedMaterialRegion;
  const hasRegion = Boolean(region?.cells?.length);
  const hasSource = Boolean(source) && !hasRegion;

  el.inspectorEditBtn.disabled = !(hasSource || hasRegion);
  el.inspectorClearBtn.disabled = !(hasSource || hasRegion);

  if (hasRegion) {
    const stats = materialRegionStats(region);
    const b = region.bounds;
    el.inspectorKind.textContent = "Material";
    el.inspectorTitle.textContent = `${dominantMaterialKind(region).toUpperCase()} region`;
    setInspectorDetails([
      ["Cells", String(region.cells.length)],
      ["Bounds", `${formatLambda(cellsToLambda(b.minX))}-${formatLambda(cellsToLambda(b.maxX + 1))} λ0`],
      ["Height", `${formatLambda(cellsToLambda(b.maxY - b.minY + 1))} λ0`],
      ["εx avg", stats ? formatFieldValue(stats.eps) : "-"],
      ["εy avg", stats ? formatFieldValue(stats.epsY) : "-"],
      ["μ avg", stats ? formatFieldValue(stats.mu) : "-"],
      ["Loss", stats ? formatFieldValue(stats.loss) : "-"],
      ["Flags", stats?.features.length ? stats.features.join(", ") : "static"],
    ]);
    setSelectionSheet("Material", el.inspectorTitle.textContent, [
      ["Cells", String(region.cells.length)],
      ["Width", `${formatLambda(cellsToLambda(b.maxX - b.minX + 1))} λ0`],
      ["Height", `${formatLambda(cellsToLambda(b.maxY - b.minY + 1))} λ0`],
      ["eps avg", stats ? formatFieldValue(stats.eps) : "-"],
      ["loss", stats ? formatFieldValue(stats.loss) : "-"],
    ]);
    if (el.inspectorNote) {
      el.inspectorNote.textContent = "Region values are averaged over selected grid cells.";
    }
    return;
  }

  if (hasSource) {
    el.inspectorKind.textContent = "Source";
    el.inspectorTitle.textContent = `Source ${source.id}: ${sourceShapeLabel(source.shape)}`;
    setInspectorDetails([
      ["Time", sourceTypeLabel(source.type)],
      ["Coupling", sourceCouplingLabel(source.shape)],
      ["x / λ0", formatLambda(source.xLambda)],
      ["y / λ0", formatLambda(source.yLambda)],
      ["f Δt", source.frequency.toFixed(3)],
      ["Amplitude", source.amplitude.toFixed(2)],
      ["Phase", `${Math.round(source.phaseDeg || 0)} deg`],
      ["Angle", `${Math.round(source.angleDeg || 0)} deg`],
    ]);
    setSelectionSheet("Source", el.inspectorTitle.textContent, [
      ["Time", sourceTypeLabel(source.type)],
      ["Coupling", sourceCouplingLabel(source.shape)],
      ["x", `${formatLambda(source.xLambda)} λ0`],
      ["y", `${formatLambda(source.yLambda)} λ0`],
      ["f dt", source.frequency.toFixed(3)],
    ]);
    if (el.inspectorNote) {
      el.inspectorNote.textContent = sourceUsesWidth(source.shape)
        ? `FWHM / λ0 ${formatLambda(source.widthLambda)}.`
        : "Point or line source; spatial width control is inactive.";
    }
    return;
  }

  const presetLabel = el.presetInput?.selectedOptions?.[0]?.textContent?.trim() || state.preset;
  el.inspectorKind.textContent = "Scene";
  el.inspectorTitle.textContent = "No explicit selection";
  setInspectorDetails([
    ["Preset", presetLabel],
    ["Sources", String(state.sources.length)],
    ["Grid", `${sim.nx} x ${sim.ny}`],
    ["Mode", solverModeLabel()],
    ["Boundary", boundarySummaryLabel()],
    ["Engine", sim.engineLabel()],
  ]);
  hideSelectionSheet();
  if (el.inspectorNote) {
    el.inspectorNote.textContent = "Select a source or material region on the canvas.";
  }
}

function setMobileLayerActive(layerName) {
  if (el.controlPanel) {
    el.controlPanel.dataset.mobileLayer = layerName;
  }
  updateControlPanelContext(layerName);
  el.mobileLayerButtons?.forEach((button) => {
    const active = button.dataset.mobileLayer === layerName;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

function activeMobileLayerName() {
  return Array.from(el.mobileLayerButtons || []).find((button) => button.classList.contains("is-active"))?.dataset.mobileLayer;
}

function focusControlPanelSection(selector) {
  if (!selector) return;
  requestAnimationFrame(() => {
    const section = el.controlPanel?.querySelector(selector);
    section?.scrollIntoView?.({ block: "start", inline: "nearest" });
  });
}

function activeControlTabName() {
  return Array.from(el.controlTabButtons || []).find((button) => button.classList.contains("is-active"))?.dataset.controlTab || "scenes";
}

const CONTROL_PANEL_CONTEXTS = {
  scenes: { compactTitle: "Scene", kicker: "Step 1 · Scene", nextLabel: "Run", nextLayer: "simulation", title: "Scene setup" },
  simulation: { compactTitle: "Run", kicker: "Step 2 · Run", nextLabel: "Results", nextLayer: "results", title: "Simulation control" },
  visual: { compactTitle: "Visual", kicker: "Step 3 · Visual", nextLabel: "Edit", nextLayer: "objects", title: "Canvas display" },
  objects: { compactTitle: "Edit", kicker: "Step 4 · Edit", nextLabel: "Results", nextLayer: "results", title: "Object editor" },
  results: { compactTitle: "Results", kicker: "Step 5 · Results", nextLabel: "Config", nextLayer: "config", title: "Measurements" },
  config: { compactTitle: "Config", kicker: "Step 6 · Config", nextLabel: "Scene", nextLayer: "scenes", title: "Numerics" },
};

function updateControlPanelContext(layerName = activeMobileLayerName() || controlTabLayerName(activeControlTabName())) {
  const context = CONTROL_PANEL_CONTEXTS[layerName] || CONTROL_PANEL_CONTEXTS.scenes;
  const compactTitleActive = window.matchMedia?.(COMPACT_PANEL_TITLE_MEDIA_QUERY)?.matches ?? false;
  const panelTitle = compactTitleActive ? context.compactTitle || context.title : context.title;
  if (el.controlPanelKicker) {
    el.controlPanelKicker.textContent = context.kicker;
  }
  if (el.controlPanelTitle) {
    el.controlPanelTitle.textContent = panelTitle;
  }
  if (el.controlPanel) {
    el.controlPanel.setAttribute("aria-label", `${context.title} controls`);
  }
  if (el.controlPanelNextBtn) {
    el.controlPanelNextBtn.textContent = context.nextLabel;
    el.controlPanelNextBtn.dataset.nextLayer = context.nextLayer;
    el.controlPanelNextBtn.setAttribute("aria-label", `Next step: ${context.nextLabel}`);
    el.controlPanelNextBtn.title = `Next step: ${context.nextLabel}`;
  }
}

function controlTabLayerName(tabName) {
  return {
    scenes: "scenes",
    simulation: "simulation",
    results: "results",
    config: "config",
  }[tabName] || "scenes";
}

function activateControlTab(tabName, options = {}) {
  const selected = tabName || "scenes";
  el.controlTabButtons?.forEach((button) => {
    const active = button.dataset.controlTab === selected;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  el.controlTabPanels?.forEach((panel) => {
    const active = panel.dataset.controlPanel === selected;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
  setMobileLayerActive(options.layer || controlTabLayerName(selected));
  if (options.focusSelector) {
    focusControlPanelSection(options.focusSelector);
  }
}

function activateMobileLayer(layerName) {
  const layer = layerName || "scenes";
  if (layer === "visual") {
    setMobileLayerActive("visual");
    closeControlDrawer();
    setCanvasOptionsOpen(true);
    el.canvasOptionsToggle?.focus?.({ preventScroll: true });
    return;
  }
  if (layer === "objects") {
    activateControlTab("simulation", { layer: "objects", focusSelector: ".inspector-section" });
    return;
  }
  if (layer === "simulation") {
    activateControlTab("simulation", { layer: "simulation", focusSelector: ".run-section" });
    return;
  }
  if (layer === "results") {
    activateControlTab("results", { layer: "results", focusSelector: ".diagnostics-section" });
    return;
  }
  if (layer === "config") {
    activateControlTab("config", { layer: "config", focusSelector: ".scale-section" });
    return;
  }
  activateControlTab("scenes", { layer: "scenes", focusSelector: ".scene-section" });
}

function compactControlDrawerActive() {
  return window.matchMedia?.(COMPACT_CONTROLS_MEDIA_QUERY)?.matches ?? false;
}

let lastCompactResultsDetailState = null;

function compactResultsDetailsActive() {
  return window.matchMedia?.(COMPACT_RESULTS_MEDIA_QUERY)?.matches ?? false;
}

function syncResultsDetailPanels(force = false) {
  const compact = compactResultsDetailsActive();
  if (!force && compact === lastCompactResultsDetailState) return;
  lastCompactResultsDetailState = compact;
  if (!compact) return;
  el.resultsDetailPanels?.forEach((panel) => {
    panel.open = false;
  });
}

function canvasFocusModeActive() {
  return el.appShell?.classList.contains("canvas-focus-mode") ?? false;
}

function controlDrawerOverlayActive() {
  return compactControlDrawerActive() || canvasFocusModeActive();
}

function setControlDrawerOpen(open) {
  const isOpen = Boolean(open) && controlDrawerOverlayActive();
  el.appShell?.classList.toggle("controls-open", isOpen);
  document.body.classList.toggle("controls-drawer-open", isOpen);
  if (el.controlDrawerToggle) {
    el.controlDrawerToggle.setAttribute("aria-expanded", String(isOpen));
  }
  if (el.focusControlsBtn) {
    el.focusControlsBtn.setAttribute("aria-expanded", String(isOpen));
  }
  if (el.controlDrawerBackdrop) {
    el.controlDrawerBackdrop.hidden = !isOpen;
  }
  if (isOpen) {
    closeCanvasActionsMenu();
    closeCanvasOptionsMenu();
    if (activeMobileLayerName() === "visual") {
      setMobileLayerActive(controlTabLayerName(activeControlTabName()));
    }
    el.controlPanel?.focus?.({ preventScroll: true });
  }
}

function closeControlDrawer() {
  setControlDrawerOpen(false);
}

function toggleControlDrawer() {
  setControlDrawerOpen(!el.appShell?.classList.contains("controls-open"));
}

function canvasActionsMenuActive() {
  return canvasFocusModeActive() || (window.matchMedia?.("(max-width: 1180px)")?.matches ?? false);
}

function setCanvasActionsOpen(open) {
  const isOpen = Boolean(open) && canvasActionsMenuActive();
  el.stage?.classList.toggle("canvas-actions-open", isOpen);
  if (el.canvasActionToggle) {
    el.canvasActionToggle.setAttribute("aria-expanded", String(isOpen));
  }
  if (isOpen) {
    closeCanvasOptionsMenu();
  }
}

function closeCanvasActionsMenu() {
  setCanvasActionsOpen(false);
}

function toggleCanvasActionsMenu() {
  setCanvasActionsOpen(!el.stage?.classList.contains("canvas-actions-open"));
}

function canvasOptionsMenuActive() {
  return canvasFocusModeActive() || (window.matchMedia?.("(max-width: 1180px)")?.matches ?? false);
}

function setCanvasOptionsOpen(open) {
  const isOpen = Boolean(open) && canvasOptionsMenuActive();
  el.stage?.classList.toggle("canvas-options-open", isOpen);
  if (el.canvasOptionsToggle) {
    el.canvasOptionsToggle.setAttribute("aria-expanded", String(isOpen));
  }
  if (isOpen) {
    closeCanvasActionsMenu();
    setMobileLayerActive("visual");
  }
}

function closeCanvasOptionsMenu() {
  const restorePanelLayer = activeMobileLayerName() === "visual";
  setCanvasOptionsOpen(false);
  if (restorePanelLayer) {
    setMobileLayerActive(controlTabLayerName(activeControlTabName()));
  }
}

function toggleCanvasOptionsMenu() {
  setCanvasOptionsOpen(!el.stage?.classList.contains("canvas-options-open"));
}

function refreshCanvasSizeAfterLayoutChange() {
  requestAnimationFrame(() => {
    sim.fitCanvas();
    sim.render();
  });
}

function setCanvasFocusMode(enabled) {
  const isEnabled = Boolean(enabled);
  closeContextMenus();
  closeCanvasActionsMenu();
  closeCanvasOptionsMenu();
  setControlDrawerOpen(false);
  el.appShell?.classList.toggle("canvas-focus-mode", isEnabled);
  document.body.classList.toggle("canvas-focus-mode", isEnabled);
  if (el.canvasFocusBtn) {
    el.canvasFocusBtn.setAttribute("aria-pressed", String(isEnabled));
    el.canvasFocusBtn.setAttribute("aria-label", isEnabled ? "Exit canvas focus" : "Focus canvas");
    el.canvasFocusBtn.title = isEnabled ? "Exit canvas focus" : "Focus canvas";
    el.canvasFocusBtn.textContent = isEnabled ? "×" : "⛶";
  }
  updateCanvasInteractionState();
  updateStats();
  refreshCanvasSizeAfterLayoutChange();
}

function toggleCanvasFocusMode() {
  setCanvasFocusMode(!canvasFocusModeActive());
}

function handleControlTabKeydown(event) {
  const buttons = Array.from(el.controlTabButtons || []);
  const currentIndex = buttons.indexOf(event.currentTarget);
  if (currentIndex < 0) return;
  const lastIndex = buttons.length - 1;
  let nextIndex = currentIndex;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = currentIndex >= lastIndex ? 0 : currentIndex + 1;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = currentIndex <= 0 ? lastIndex : currentIndex - 1;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = lastIndex;
  else return;
  event.preventDefault();
  const nextButton = buttons[nextIndex];
  nextButton.focus();
  activateControlTab(nextButton.dataset.controlTab);
}

function lambdaToCells(valueLambda) {
  return Math.round((Number(valueLambda) || 0) * state.cellsPerWavelength);
}

function cellsToLambda(cells) {
  return cells / state.cellsPerWavelength;
}

function niceScaleLength(visibleLambdaWidth) {
  const target = Math.max(visibleLambdaWidth * 0.18, 1e-9);
  const exponent = Math.floor(Math.log10(target));
  const base = Math.pow(10, exponent);
  const normalized = target / base;
  if (normalized <= 1) return base;
  if (normalized <= 2) return 2 * base;
  if (normalized <= 5) return 5 * base;
  return 10 * base;
}

function formatScaleBarValue(value) {
  if (Math.abs(value) >= 10 || Number.isInteger(value)) return value.toFixed(0);
  if (Math.abs(value) >= 1) return trimFixed(value, 1);
  if (Math.abs(value) >= 0.01) return trimFixed(value, 2);
  return value.toExponential(1);
}

function trimFixed(value, digits) {
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

function maxSourceXLambda() {
  return cellsToLambda(sim.sourcePlacementMaxX());
}

function maxSourceYLambda() {
  return cellsToLambda(sim.sourcePlacementMaxY());
}

function minSourceXLambda() {
  return cellsToLambda(sim.sourcePlacementMinX());
}

function minSourceYLambda() {
  return cellsToLambda(sim.sourcePlacementMinY());
}

function formatLambda(value) {
  return Number(value).toFixed(2);
}

function formatCompactLambda(value) {
  return Number(value)
    .toFixed(1)
    .replace(/\.0$/, "");
}

function formatLambdaOutput(value) {
  return `${formatLambda(value)} λ₀`;
}

function formatSpeed(value) {
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

function normalizeSource(source) {
  source.type = ["sine", "gaussian", "ricker"].includes(source.type) ? source.type : "sine";
  source.shape = Object.prototype.hasOwnProperty.call(sourceShapeLabels, source.shape) ? source.shape : "point";
  source.frequency = clamp(Number(source.frequency) || defaultSourceConfig.frequency, 0.006, 0.095);
  source.amplitude = clamp(Number(source.amplitude) || defaultSourceConfig.amplitude, 0.05, 1.2);
  source.xLambda = clamp(Number(source.xLambda) || defaultSourceConfig.xLambda, minSourceXLambda(), maxSourceXLambda());
  source.yLambda = clamp(Number(source.yLambda) || defaultSourceConfig.yLambda, minSourceYLambda(), maxSourceYLambda());
  source.widthLambda =
    source.shape === "evanescentLine"
      ? clamp(Number(source.widthLambda) || 1.25, 1.01, 2.5)
      : clamp(Number(source.widthLambda) || defaultSourceConfig.widthLambda, 0.05, 1.5);
  source.angleDeg = clamp(Number(source.angleDeg) || 0, 0, 360);
  source.phaseDeg = clamp(Number(source.phaseDeg) || 0, -180, 180);
  source.multipoleOrder = clampInt(source.multipoleOrder, 1, 8);
  source.multipolePhase = source.multipolePhase === "sin" ? "sin" : "cos";
  return source;
}

function makeSource(overrides = {}, assignId = true) {
  const source = normalizeSource({
    ...state.sourceDefaults,
    ...overrides,
  });
  if (assignId) {
    source.id = state.nextSourceId;
    state.nextSourceId += 1;
  }
  return source;
}

function selectedSource() {
  return state.sources.find((source) => source.id === state.selectedSourceId) || state.sources[0] || null;
}

function replacePrimarySource(overrides = {}) {
  if (state.sources.length === 0) {
    const source = makeSource(overrides);
    state.sources.push(source);
    state.selectedSourceId = source.id;
    return source;
  }
  const source = state.sources[0];
  Object.assign(source, overrides);
  normalizeSource(source);
  state.selectedSourceId = source.id;
  return source;
}

function addSource(overrides = {}) {
  const source = makeSource(overrides);
  state.sources.push(source);
  state.selectedSourceId = source.id;
  clearMaterialSelection(false);
  state.sourceDefaults = { ...source };
  delete state.sourceDefaults.id;
  return source;
}

function deleteSource(sourceId) {
  const index = state.sources.findIndex((source) => source.id === sourceId);
  if (index < 0) return;
  state.sources.splice(index, 1);
  state.selectedSourceId = state.sources[Math.min(index, state.sources.length - 1)]?.id ?? null;
}

function explicitlySelectedSource() {
  return state.sources.find((source) => source.id === state.selectedSourceId) || null;
}

function clampAllSourcesToInterior() {
  state.sources.forEach((source) => normalizeSource(source));
}

function sourceUsesWidth(shape) {
  return localizedSourceShapes.has(shape) || inPlaneElectricCurrentShapes.has(shape) || shape === "evanescentLine";
}

function sourceUsesAngle(shape) {
  return (
    incidentFieldSourceShapes.has(shape) ||
    inPlaneElectricCurrentShapes.has(shape) ||
    shape === "pointDipole" ||
    shape === "dipole" ||
    circularDipoleSourceShapes.has(shape) ||
    shape === "janusDipole" ||
    shape === "huygens" ||
    shape === "quadrupole" ||
    shape === "multipole"
  );
}

function sourceUsesMultipoleControls(shape) {
  return shape === "multipole";
}

function setControlDisabled(control, inputOrInputs, disabled) {
  if (!control) return;
  control.classList.toggle("is-disabled", disabled);
  const inputs = Array.isArray(inputOrInputs) ? inputOrInputs : [inputOrInputs];
  inputs.forEach((input) => {
    if (input) input.disabled = disabled;
  });
}

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

function clearMaterialSelection(render = true) {
  selectedMaterialRegion = null;
  dragMaterialPointerId = null;
  materialDragState = null;
  updateInspector();
  if (render) sim.render();
}

function deleteSelectedElement() {
  const source = explicitlySelectedSource();
  if (source) {
    disableResponsiveGridOrientation();
    deleteSource(source.id);
    closeSourceMenu();
    clearMaterialSelection(false);
    updateControlText();
    sim.render();
    return true;
  }
  if (selectedMaterialRegion) {
    disableResponsiveGridOrientation();
    selectedMaterialRegion = sim.applyMaterialKindToRegion(selectedMaterialRegion, "erase");
    closeBrushMenu();
    sim.measure();
    updateControlText();
    updateStats();
    sim.render();
    return true;
  }
  return false;
}

function isEditableKeyTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function selectMaterialRegion(region, render = true) {
  selectedMaterialRegion = region;
  if (region) {
    state.selectedSourceId = null;
    state.brush = dominantMaterialKind(region);
  }
  updateInspector();
  if (render) {
    updateControlText();
    sim.render();
  }
}

function selectMaterialRegionAt(clientX, clientY, render = true) {
  const region = sim.findMaterialRegionAtClientPoint(clientX, clientY);
  if (region) {
    selectMaterialRegion(region, render);
  }
  return region;
}

function applyMaterialKindToSelection(kind) {
  if (!selectedMaterialRegion) return;
  disableResponsiveGridOrientation();
  state.brush = kind;
  selectedMaterialRegion = sim.applyMaterialKindToRegion(selectedMaterialRegion, kind);
  sim.measure();
  updateControlText();
  updateStats();
  sim.render();
}

function normalizeBrushGeometryState() {
  const validGeometries = new Set(["rectangle", "disk", "ellipse", "ring"]);
  if (!validGeometries.has(state.brushGeometry)) state.brushGeometry = "rectangle";
  state.geometryWidthLambda = clamp(Number(state.geometryWidthLambda) || 1, 0.05, 50);
  state.geometryHeightLambda = clamp(Number(state.geometryHeightLambda) || 0.5, 0.05, 50);
  state.geometryRadiusLambda = clamp(Number(state.geometryRadiusLambda) || 0.45, 0.05, 25);
  state.geometryInnerRadiusLambda = clamp(Number(state.geometryInnerRadiusLambda) || 0.25, 0.01, 25);
  if (state.geometryInnerRadiusLambda >= state.geometryRadiusLambda) {
    state.geometryInnerRadiusLambda = Math.max(0.01, state.geometryRadiusLambda * 0.55);
  }
}

function geometryUsesWidth(shape = state.brushGeometry) {
  return shape === "rectangle" || shape === "ellipse";
}

function geometryUsesHeight(shape = state.brushGeometry) {
  return shape === "rectangle" || shape === "ellipse";
}

function geometryUsesRadius(shape = state.brushGeometry) {
  return shape === "disk" || shape === "ring";
}

function geometryUsesInnerRadius(shape = state.brushGeometry) {
  return shape === "ring";
}

function formatScaleValue(value) {
  if (!Number.isFinite(value)) return "overflow";
  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.01) return value.toExponential(2);
  return value.toFixed(2);
}

function formatScaleFromLog(logValue) {
  if (!Number.isFinite(logValue)) return "overflow";
  if (Math.abs(logValue) < 3) return formatScaleValue(Math.pow(10, logValue));
  return `1e${logValue >= 0 ? "+" : ""}${logValue.toFixed(0)}`;
}

function updateMaterialWarning() {
  const notes = [];
  if (Math.abs(state.customEpsReal) < 0.5) {
    notes.push("Near-zero ε′ can create very large fields; auto-normalization is active.");
  }
  if (state.customEpsImag < 0) {
    notes.push(
      state.materialSaturableGainEnabled
        ? "Negative ε″ adds gain; saturable gain limits growth at high intensity."
        : "Negative ε″ adds gain and may keep growing."
    );
  }
  if (state.customAnisotropic && Math.abs(state.customEpsYReal) < 0.5) {
    notes.push("Near-zero εy′ can create very large fields; auto-normalization is active.");
  }
  if (state.customAnisotropic && state.customEpsYImag < 0) {
    notes.push(
      state.materialSaturableGainEnabled
        ? "Negative εy″ adds gain; saturable gain limits growth at high intensity."
        : "Negative εy″ adds gain and may keep growing."
    );
  }
  if (Math.abs(state.customMuReal) < 0.5) {
    notes.push("Near-zero μ′ can create very large magnetic fields; auto-normalization is active.");
  }
  if (state.customMuImag < 0) {
    notes.push("Negative μ″ adds magnetic gain and may keep growing.");
  }
  if (state.customAnisotropic && Math.abs(state.customMuYReal) < 0.5) {
    notes.push("Near-zero μy′ can create very large magnetic fields; auto-normalization is active.");
  }
  if (state.customAnisotropic && state.customMuYImag < 0) {
    notes.push("Negative μy″ adds magnetic gain and may keep growing.");
  }
  if (state.materialModulationEnabled && state.modulationDepth > 0) {
    notes.push("Space-time \u03b5\u2032 modulation is active; it can exchange energy with the field.");
  }
  if (state.materialNonlinearEnabled && state.kerrChi3 !== 0) {
    notes.push("Kerr \u03c7\u00b3 nonlinearity is active; strong fields change \u03b5\u2032 and may generate harmonics.");
  }
  if (state.materialHarmonicEnabled && (state.harmonicChi2 !== 0 || state.harmonicChi3 !== 0)) {
    const harmonicTargets = [
      state.harmonicChi2 !== 0 ? "2f" : null,
      state.harmonicChi3 !== 0 ? "3f" : null,
    ]
      .filter(Boolean)
      .join(" and ");
    notes.push(`Harmonic nonlinear polarization is active; the spectrum can show ${harmonicTargets} components.`);
  }
  if (state.materialPhaseChangeEnabled) {
    notes.push("Phase-change memory is active; epsilon follows a persistent state variable s.");
  }
  if (state.materialGyrotropyEnabled) {
    notes.push("Gyrotropic epsilon tensor is active in Hz mode: eps_xy = +g and eps_yx = -g.");
    if (state.fieldComponent !== "hz") {
      notes.push("Switch to Hz to apply the gyrotropic tensor update.");
    }
  }
  if (state.materialBianisotropyEnabled) {
    if (sim.fullVectorBianisotropyActive?.()) {
      const fullVector = sim.fullVectorBianisotropyDiagnostics?.();
      const ratioText = fullVector ? ` Cross-polarized energy ratio ~${formatDiagnosticRatio(fullVector.crossEnergyRatio)}.` : "";
      notes.push(`Six-component 2D bianisotropic FDTD is active; Ez/Hx/Hy and Hz/Ex/Ey are evolved and locally coupled by kappa_n.${ratioText}`);
    } else {
      notes.push("Passivity-limited reduced 2D magnetoelectric coupling is active; kappa_n locally mixes electric and magnetic field increments.");
    }
  }
  if (state.materialConductivityEnabled && (state.conductivitySigma > 0 || state.conductivitySigmaY > 0)) {
    notes.push("Finite normalized conductivity \u03c3 is active; the solver adds J = \u03c3E conduction loss.");
  }
  if (state.materialSaturableGainEnabled) {
    notes.push("Saturable gain is active; negative electric loss is intensity-limited.");
  }
  if (state.materialDispersionEnabled) {
    const model = normalizeDispersionModel(state.dispersionModel);
    const modelLabel = model === "none" ? "dispersive" : model;
    notes.push(`${modelLabel} ADE material is active; the response depends on frequency and field history.`);
    if (state.preset === "hyperlens") {
      notes.push("Hyperlens uses radial/tangential Drude ADE in Hz mode: the tangential in-plane component is dispersive and the radial component remains dielectric.");
    } else if (state.preset === "enzSlab" || state.preset === "enzEmitter" || state.preset === "bicEnz") {
      notes.push("ENZ uses a passive Drude ADE tuned so the real epsilon is near zero at the carrier frequency.");
    } else if (state.preset === "negativeIndexSlab" || state.preset === "superlensSlab") {
      const negativeIndex = sim.negativeIndexDiagnostics?.();
      if (negativeIndex) {
        notes.push(
          `Negative-index ADE: eps_eff~${formatFieldValue(negativeIndex.epsEff)}, mu_eff~${formatFieldValue(
            negativeIndex.muEff,
          )}, n_eff~${formatFieldValue(negativeIndex.nEff)} at the carrier frequency.`,
        );
      }
    }
  }
  if (state.fieldComponent === "hz") {
    const tensorDiagnostics = sim.materialTensorDiagnostics();
    if (tensorDiagnostics.checkedCells > 0) {
      if (tensorDiagnostics.indefiniteCells > 0) {
        notes.push(
          `${tensorDiagnostics.indefiniteCells} cells have indefinite epsilon(omega); keep loss on and verify convergence for hyperbolic-field detail.`,
        );
      }
      if (tensorDiagnostics.nearSingularCells > 0) {
        notes.push(
          `${tensorDiagnostics.nearSingularCells} cells are near-singular or ill-conditioned: min |lambda_epsilon|=${formatFieldValue(
            tensorDiagnostics.minAbsEigenvalue,
          )}, cond~${formatFieldValue(tensorDiagnostics.maxCondition)}.`,
        );
      } else if (tensorDiagnostics.tensorCells > 0 || tensorDiagnostics.dispersiveCells > 0) {
        notes.push(
          `Tensor epsilon check: ${tensorDiagnostics.checkedCells} cells, cond~${formatFieldValue(
            tensorDiagnostics.maxCondition,
          )}.`,
        );
      }
    }
  }
  if (sim.lastDiverged) {
    notes.push("Non-finite field detected; fields were reset.");
  } else if (sim.fieldLog10Scale !== 0) {
    notes.push(`Field scale ${formatScaleFromLog(sim.fieldLog10Scale)}x.`);
  }
  const warningText = notes.join(" ");
  el.materialWarning.textContent = warningText;
  if (el.simGuideWarning) {
    el.simGuideWarning.textContent = warningText || `CFL S = ${COURANT.toFixed(2)} < ${(1 / Math.sqrt(2)).toFixed(2)} explicit 2D Yee limit.`;
    el.simGuideWarning.classList.toggle("is-warning", Boolean(warningText));
  }
}

function arrayHasNonzero(values) {
  return Boolean(values?.some?.((value) => value !== 0));
}

function activeMediaLabels() {
  const labels = [];
  if (state.materialModulationEnabled || arrayHasNonzero(sim.modulatedMaterial)) labels.push("modulated");
  if (state.materialNonlinearEnabled || state.materialHarmonicEnabled || arrayHasNonzero(sim.nonlinearMaterial)) labels.push("nonlinear");
  if (state.materialPhaseChangeEnabled || arrayHasNonzero(sim.phaseChangeMaterial)) labels.push("phase-change");
  if (state.materialDispersionEnabled || arrayHasNonzero(sim.dispersiveMaterial) || arrayHasNonzero(sim.muDispersiveMaterial)) labels.push("ADE");
  if (state.materialGyrotropyEnabled || arrayHasNonzero(sim.gyrotropicMaterial)) labels.push("gyrotropic");
  if (state.materialBianisotropyEnabled || arrayHasNonzero(sim.bianisotropicMaterial)) labels.push("bianisotropic");
  if (state.materialConductivityEnabled || arrayHasNonzero(sim.conductivity) || arrayHasNonzero(sim.conductivityY)) labels.push("conductive");
  if (state.materialSaturableGainEnabled) labels.push("gain-limited");
  return labels.length > 0 ? labels : ["static"];
}

function materialStabilityFlags() {
  const flags = [];
  let minAbsEps = Infinity;
  let minAbsMu = Infinity;
  let negativeLossCells = 0;
  for (let i = 0; i < sim.n; i += 1) {
    if (sim.material[i] === 0 || sim.material[i] === 2) continue;
    minAbsEps = Math.min(minAbsEps, Math.abs(sim.eps[i]), Math.abs(sim.epsY[i]));
    minAbsMu = Math.min(minAbsMu, Math.abs(sim.mu[i]), Math.abs(sim.muY[i]));
    if (sim.loss[i] < 0 || sim.lossY[i] < 0 || sim.muLoss[i] < 0 || sim.muLossY[i] < 0) {
      negativeLossCells += 1;
    }
  }
  if (state.cellsPerWavelength < 10) flags.push("low spatial resolution");
  if (Number.isFinite(minAbsEps) && minAbsEps < 0.2) flags.push("near-zero eps");
  if (Number.isFinite(minAbsMu) && minAbsMu < 0.2) flags.push("near-zero mu");
  if (negativeLossCells > 0 || state.customEpsImag < 0 || state.customMuImag < 0) flags.push("gain or negative loss");
  if (state.materialModulationEnabled && state.modulationDepth > 0.5) flags.push("deep modulation");
  if (state.materialBianisotropyEnabled && Math.abs(state.bianisotropyKappa) > BIANISOTROPY_KAPPA_LIMIT * 0.8) flags.push("strong kappa");
  if (sim.lastDiverged) flags.push("recent non-finite field");
  return flags;
}

function healthStatusReason(cflStable, flags, limit) {
  if (!cflStable) {
    return `CFL S=${COURANT.toFixed(2)} exceeds the explicit 2D Yee limit ${limit.toFixed(2)}.`;
  }
  if (sim.lastDiverged) {
    return "Non-finite field was detected and the fields were reset.";
  }
  if (flags.length > 0) {
    return `Check before quantitative use: ${flags.join(", ")}.`;
  }
  return `CFL S=${COURANT.toFixed(2)} is below ${limit.toFixed(2)} and no material stability flags are active.`;
}

function applyHealthState(output, level, reason) {
  if (!output) return;
  output.textContent = level;
  output.title = reason;
  output.dataset.healthLevel = level;
  output.setAttribute("aria-label", `Numerical health: ${level}. ${reason}`);
  output.classList.toggle("is-warning", level === "caution");
  output.classList.toggle("is-danger", level === "unstable");
}

function updateHealthStatusOutputs(level, reason) {
  applyHealthState(el.topHealthValue, level, reason);
  applyHealthState(el.mobileHealthValue, level, reason);
  applyHealthState(el.configStabilityOutput, level, reason);
  applyHealthState(el.stabilityEstimateValue, level, reason);
}

function updateStabilitySummary() {
  if (!el.stabilityCflValue) return;
  const limit = 1 / Math.sqrt(2);
  const media = activeMediaLabels();
  const flags = materialStabilityFlags();
  const cflStable = COURANT < limit;
  const level = !cflStable || sim.lastDiverged ? "unstable" : flags.length > 0 ? "caution" : "stable";
  const healthReason = healthStatusReason(cflStable, flags, limit);
  el.stabilityCflValue.textContent = `S = ${COURANT.toFixed(2)} / ${limit.toFixed(2)}`;
  el.stabilityResolutionValue.textContent = `${state.cellsPerWavelength} cells / lambda0`;
  el.stabilityMediaValue.textContent = media.join(", ");
  updateHealthStatusOutputs(level, healthReason);
  if (el.stabilityNote) {
    const base = `Explicit 2D Yee check: S must stay below 1/sqrt(2). Current S=${COURANT.toFixed(2)}.`;
    el.stabilityNote.textContent =
      flags.length > 0
        ? `${base} Watch: ${flags.join(", ")}. Run convergence checks for publishable results.`
        : `${base} Resolution is ${state.cellsPerWavelength} cells/lambda0; still verify convergence before quantitative claims.`;
    el.stabilityNote.classList.toggle("is-warning", level !== "stable");
  }
}

let sim = new FDTDSim(el.canvas, DEFAULT_GRID);
let pointerDown = false;
let paintPointerId = null;
let panPointerId = null;
let lastPanPoint = null;
let pinchState = null;
let dragSourcePointerId = null;
let dragSourceId = null;
let dragSourceOffset = null;
let dragMaterialPointerId = null;
let materialDragState = null;
const activePointers = new Map();
const TOUCH_DRAG_START_PX = 8;
const TOUCH_TAP_MAX_DISTANCE_PX = 10;
const TOUCH_DOUBLE_TAP_MS = 320;
const TOUCH_DOUBLE_TAP_DISTANCE_PX = 34;
let pendingTouchInteraction = null;
let lastCanvasTouchTap = null;
let framesSinceMeasure = 0;
let simStepAccumulator = 0;
let sourceMenuMode = "add";
let sourceMenuDraft = null;
let brushMenuMode = "brush";
let boundaryMenuSide = "top";

function activeSourceEditorTarget() {
  if (sourceMenuDraft) return sourceMenuDraft;
  if (!el.sourceMenu?.hidden) return selectedSource();
  return selectedSource();
}

function sourceTypeLabel(type) {
  return {
    sine: "sine",
    gaussian: "Gaussian pulse",
    ricker: "Ricker",
  }[type] || "sine";
}

function sourceAmplitudeLabelHtml(shape) {
  if (inPlaneElectricCurrentShapes.has(shape)) {
    return `<i>J</i><sub>&parallel;,0</sub>`;
  }
  if (currentSourceShapes.has(shape)) {
    return `<i>${currentSourceLetter()}</i><sub>z,0</sub>`;
  }
  return `<i>${simulatedFieldLetter()}</i><sub>inc,0</sub>`;
}

function sourceAngleLabelHtml(shape) {
  if (incidentFieldSourceShapes.has(shape)) return `incidence &theta;`;
  if (inPlaneElectricCurrentShapes.has(shape)) return `<i>J</i><sub>&parallel;</sub> angle &theta;`;
  if (shape === "huygens" || shape === "janusDipole") return `direction &theta;`;
  if (circularDipoleSourceShapes.has(shape)) return `spin axis &theta;`;
  return `${currentSourceLetter()}<sub>z</sub> axis &theta;`;
}

function updateSourceShapeOptionLabels() {
  if (!el.sourceShapeInput) return;
  const currentGroup = el.sourceShapeInput.querySelector("optgroup");
  if (currentGroup) {
    currentGroup.label = `Out-of-plane ${currentSourceLetter()}z source`;
  }
  Array.from(el.sourceShapeInput.options).forEach((option) => {
    if (Object.prototype.hasOwnProperty.call(sourceShapeLabels, option.value)) {
      option.textContent = sourceShapeLabel(option.value);
    }
  });
}

function populateSourceEditor(source) {
  const normalized = normalizeSource(source);
  updateSourceShapeOptionLabels();
  el.sourceTypeInput.value = normalized.type;
  el.sourceShapeInput.value = normalized.shape;
  el.frequencyInput.value = String(Math.round(normalized.frequency * 1000));
  el.frequencyOutput.value = normalized.frequency.toFixed(3);
  el.amplitudeInput.value = String(Math.round(normalized.amplitude * 100));
  el.amplitudeOutput.value = normalized.amplitude.toFixed(2);
  el.sourceAmplitudeLabel.innerHTML = sourceAmplitudeLabelHtml(normalized.shape);
  el.sourceXInput.min = formatLambda(minSourceXLambda());
  el.sourceYInput.min = formatLambda(minSourceYLambda());
  el.sourceXInput.max = formatLambda(maxSourceXLambda());
  el.sourceYInput.max = formatLambda(maxSourceYLambda());
  el.sourceXInput.value = formatLambda(normalized.xLambda);
  el.sourceYInput.value = formatLambda(normalized.yLambda);
  const widthLabel = el.sourceWidthControl?.querySelector("span");
  if (normalized.shape === "evanescentLine") {
    if (widthLabel) widthLabel.innerHTML = `<i>k</i><sub>&parallel;</sub>/<i>k</i><sub>0</sub>`;
    el.sourceWidthInput.min = "1.01";
    el.sourceWidthInput.max = "2.50";
    el.sourceWidthInput.step = "0.01";
    el.sourceWidthInput.value = normalized.widthLambda.toFixed(2);
    el.sourceWidthOutput.value = normalized.widthLambda.toFixed(2);
  } else {
    if (widthLabel) widthLabel.innerHTML = `FWHM / &lambda;<sub>0</sub>`;
    el.sourceWidthInput.min = "0.05";
    el.sourceWidthInput.max = "1.50";
    el.sourceWidthInput.step = "0.05";
    el.sourceWidthInput.value = formatLambda(normalized.widthLambda);
    el.sourceWidthOutput.value = formatLambda(normalized.widthLambda);
  }
  el.sourceAngleInput.value = String(Math.round(normalized.angleDeg));
  el.sourceAngleOutput.value = `${Math.round(normalized.angleDeg)}°`;
  const angleLabel = el.sourceAngleControl?.querySelector("span");
  if (angleLabel) angleLabel.innerHTML = sourceAngleLabelHtml(normalized.shape);
  if (el.sourceTimePhaseInput) {
    el.sourceTimePhaseInput.value = String(Math.round(normalized.phaseDeg));
  }
  if (el.sourceTimePhaseOutput) {
    el.sourceTimePhaseOutput.value = `${Math.round(normalized.phaseDeg)}°`;
  }
  el.sourceOrderInput.value = String(normalized.multipoleOrder);
  el.sourcePhaseInput.value = normalized.multipolePhase;
  setControlDisabled(el.sourceWidthControl, el.sourceWidthInput, !sourceUsesWidth(normalized.shape));
  setControlDisabled(el.sourceAngleControl, el.sourceAngleInput, !sourceUsesAngle(normalized.shape));
  setControlDisabled(el.sourceOrderControl, el.sourceOrderInput, !sourceUsesMultipoleControls(normalized.shape));
  setControlDisabled(el.sourcePhaseControl, el.sourcePhaseInput, !sourceUsesMultipoleControls(normalized.shape));
  if (el.sourceMenuTitle) {
    el.sourceMenuTitle.textContent = sourceMenuMode === "edit" ? `Edit source ${normalized.id ?? ""}`.trim() : "Add source";
  }
  if (el.sourceMenuHint) {
    el.sourceMenuHint.textContent =
      sourceMenuMode === "edit"
        ? `${sourceTypeLabel(normalized.type)} · ${sourceShapeLabel(normalized.shape)} · ${sourceCouplingLabel(normalized.shape)}`
        : `x / λ₀ ${formatLambda(normalized.xLambda)}, y / λ₀ ${formatLambda(normalized.yLambda)}`;
  }
  if (el.sourceApplyBtn) {
    el.sourceApplyBtn.textContent = sourceMenuMode === "edit" ? "Update source" : "Add source";
  }
  if (el.sourceDeleteBtn) {
    el.sourceDeleteBtn.hidden = sourceMenuMode !== "edit";
  }
}

function readSourceEditorValues() {
  return {
    type: el.sourceTypeInput.value,
    shape: el.sourceShapeInput.value,
    frequency: Number(el.frequencyInput.value) / 1000,
    amplitude: Number(el.amplitudeInput.value) / 100,
    xLambda: Number(el.sourceXInput.value),
    yLambda: Number(el.sourceYInput.value),
    widthLambda: Number(el.sourceWidthInput.value),
    angleDeg: Number(el.sourceAngleInput.value),
    phaseDeg: Number(el.sourceTimePhaseInput?.value ?? 0),
    multipoleOrder: Number(el.sourceOrderInput.value),
    multipolePhase: el.sourcePhaseInput.value === "sin" ? "sin" : "cos",
  };
}

function syncSourceEditorTarget() {
  const target = activeSourceEditorTarget();
  if (!target) return;
  disableResponsiveGridOrientation();
  const values = readSourceEditorValues();
  const componentChanged = inPlaneElectricCurrentShapes.has(values.shape) && state.fieldComponent !== "hz";
  if (componentChanged) {
    state.fieldComponent = "hz";
  }
  Object.assign(target, values);
  normalizeSource(target);
  if (sourceMenuMode === "edit") {
    state.sourceDefaults = { ...target };
    delete state.sourceDefaults.id;
    sim.render();
  }
  if (componentChanged) {
    sim.resetFields();
  }
  updateControlText();
}

function setCanvasMode(mode) {
  state.canvasMode = mode === "brush" ? "brush" : "select";
  if (state.canvasMode === "brush") {
    state.selectedSourceId = null;
    clearMaterialSelection(false);
    hideSelectionSheet();
  }
  closeSourceMenu();
  closeBrushMenu();
  closeBoundaryMenu();
  updateControlText();
  sim.render();
}

function applyTheme(theme, persist = true) {
  state.theme = normalizeTheme(theme);
  document.documentElement.dataset.theme = state.theme;
  if (persist) {
    try {
      window.localStorage?.setItem(THEME_STORAGE_KEY, state.theme);
    } catch {
      // Theme persistence is optional.
    }
  }
  updateThemeControls();
  sim.render();
  updateStats();
}

function updateThemeControls() {
  el.themeButtons?.forEach((button) => {
    const active = button.dataset.themeChoice === state.theme;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function applyUiDepth(depth, persist = true) {
  state.uiDepth = normalizeUiDepth(depth);
  if (el.appShell) {
    el.appShell.dataset.uiDepth = state.uiDepth;
  }
  updateUiDepthControls();
  updateVisualControls();
  syncResultsDetailPanels(true);
  sim.render();
  if (persist) {
    try {
      window.localStorage?.setItem(UI_DEPTH_STORAGE_KEY, state.uiDepth);
    } catch {
      // Interface-depth persistence is optional.
    }
  }
}

function updateUiDepthControls() {
  el.uiDepthButtons?.forEach((button) => {
    const active = button.dataset.uiDepthChoice === state.uiDepth;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function updateCanvasModeControls() {
  const isSelect = state.canvasMode === "select";
  el.selectModeBtn.classList.toggle("is-active", isSelect);
  el.brushModeBtn.classList.toggle("is-active", !isSelect);
  el.selectModeBtn.setAttribute("aria-pressed", String(isSelect));
  el.brushModeBtn.setAttribute("aria-pressed", String(!isSelect));
  el.canvas.classList.toggle("is-select-mode", isSelect);
  el.canvas.classList.toggle("is-brush-mode", !isSelect);
}

function runStateLabel() {
  return state.running ? "Run" : "Paused";
}

function updateRunControls() {
  const isRunning = Boolean(state.running);
  el.appShell?.classList.toggle("simulation-running", isRunning);
  if (el.appShell) {
    el.appShell.dataset.simState = isRunning ? "running" : "paused";
  }
  if (el.resultsStateOutput) {
    el.resultsStateOutput.textContent = isRunning ? "Running" : "Paused";
  }
  el.playPauseBtn?.classList.toggle("is-running", isRunning);
  el.playPauseBtn?.setAttribute("aria-pressed", String(isRunning));
  el.playPauseBtn?.setAttribute("aria-label", isRunning ? "Pause simulation" : "Start simulation");
  el.playPauseBtn?.setAttribute("title", isRunning ? "Pause simulation" : "Start simulation");
  if (el.playPauseIcon) {
    el.playPauseIcon.textContent = isRunning ? "⏸" : "▶";
  }
}

function interactionStateLabel() {
  if (dragSourcePointerId != null) return "Moving source";
  if (dragMaterialPointerId != null) return "Moving material";
  if (panPointerId != null) return "Pan";
  if (pinchState) return "Zoom";
  if (state.canvasMode === "brush") return currentBrushLabel() || "Draw";
  if (selectedMaterialRegion?.cells?.length) return `${selectedMaterialRegion.cells.length} cells`;
  const source = explicitlySelectedSource();
  if (source) return `Source ${source.id}`;
  return "Select";
}

function updateCanvasInteractionState() {
  const zoomed = sim.viewZoom > 1.005;
  const draggingSource = dragSourcePointerId != null;
  const draggingMaterial = dragMaterialPointerId != null;
  const panning = panPointerId != null;
  const pinching = Boolean(pinchState);
  const hasSelection = Boolean(explicitlySelectedSource() || selectedMaterialRegion?.cells?.length);
  el.canvasFrame?.classList.toggle("is-zoomed", zoomed);
  el.canvasFrame?.classList.toggle("is-panning", panning);
  el.canvasFrame?.classList.toggle("is-pinching", pinching);
  el.canvasFrame?.classList.toggle("is-dragging-source", draggingSource);
  el.canvasFrame?.classList.toggle("is-dragging-material", draggingMaterial);
  el.canvasFrame?.classList.toggle("has-selection", hasSelection);
  const interactionText = `${interactionStateLabel()} · ${sim.viewZoom.toFixed(2)}x`;
  if (el.canvasStateBadge) {
    el.canvasStateBadge.textContent = interactionText;
  }
  if (el.canvasFocusStateValue) {
    el.canvasFocusStateValue.textContent = `${runStateLabel()} · ${interactionText}`;
  }
  if (el.mobileCanvasStateValue) {
    el.mobileCanvasStateValue.textContent = `${runStateLabel()} · ${interactionText}`;
  }
}

function updateVisualControls() {
  state.visualProfile = normalizedVisualProfile(state.visualProfile);
  const activeProfile = state.visualProfile;
  const effectiveProfile = effectiveVisualProfile();
  const activeLayers = visualLayerSnapshot();
  if (el.appShell) {
    el.appShell.dataset.effectiveVisualProfile = effectiveProfile;
  }
  el.visualProfileButtons?.forEach((button) => {
    const active = button.dataset.visualProfile === activeProfile;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  el.visualLayerInputs?.forEach((input) => {
    const layer = input.dataset.visualLayer;
    input.checked = Boolean(activeLayers[layer]);
  });
  if (el.colorbar) {
    el.colorbar.hidden = !visualLayerEnabled("colorbar");
  }
}

function updateFieldDisplayControls() {
  const fieldViewActive = state.viewMode === "field" || state.viewMode === "poynting";
  const poyntingViewActive = state.viewMode === "poynting";
  if (poyntingViewActive && !["scalar", "transverseX", "transverseY"].includes(state.fieldDisplay)) {
    state.fieldDisplay = "scalar";
  }
  const selectedConfig = fieldDisplayConfig();

  if (el.fieldViewButton) {
    el.fieldViewButton.innerHTML = "<i>E</i>/<i>H</i>";
    el.fieldViewButton.title = "Show electromagnetic fields";
  }
  if (el.fieldDisplayControl) {
    el.fieldDisplayControl.hidden = !fieldViewActive;
  }
  if (el.fieldQuiverControl) {
    el.fieldQuiverControl.hidden = !fieldViewActive || state.viewProjection !== "2d";
  }
  el.fieldDisplayButtons.forEach((button) => {
    const display = button.dataset.fieldDisplay || "scalar";
    button.hidden = poyntingViewActive && !["scalar", "transverseX", "transverseY"].includes(display);
    const config = fieldDisplayConfig(display);
    const active = display === state.fieldDisplay;
    button.innerHTML = config.labelHtml;
    button.title = config.title;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  if (el.fieldQuiverInput) {
    const quiverLetter = poyntingViewActive ? "S" : transverseFieldLetter();
    el.fieldQuiverInput.checked = state.fieldQuiver;
    el.fieldQuiverControl.title = `Overlay ${quiverLetter} vector arrows`;
    if (el.fieldQuiverLabel) {
      el.fieldQuiverLabel.innerHTML = `${fieldComponentHtml(quiverLetter)} quiver`;
    }
  }
  if (el.fieldMetricSymbol) {
    el.fieldMetricSymbol.innerHTML = selectedConfig.metricHtml;
  }
  if (el.fieldMetricUnit) {
    el.fieldMetricUnit.innerHTML = selectedConfig.unitHtml;
  }
  el.canvas.setAttribute("aria-label", `Normalized ${selectedConfig.key} field of the FDTD simulation`);
}

function updateBrushControls() {
  normalizeBrushGeometryState();
  document.querySelectorAll("[data-brush]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.brush === state.brush);
  });
  const editsRegion = brushMenuMode === "region" && Boolean(selectedMaterialRegion);
  const isCustomBrush = state.brush === "custom";
  if (el.brushToolControl) {
    el.brushToolControl.hidden = editsRegion;
  }
  el.brushToolButtons?.forEach((button) => {
    const active = button.dataset.brushTool === state.brushTool;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  if (el.brushGeometryPanel) {
    el.brushGeometryPanel.hidden = editsRegion || state.brushTool !== "geometry";
  }
  if (el.brushSizeControl) {
    el.brushSizeControl.hidden = editsRegion || state.brushTool === "geometry";
  }
  if (el.brushGeometryInput) {
    el.brushGeometryInput.value = state.brushGeometry;
  }
  if (el.geometryWidthInput) {
    el.geometryWidthInput.value = state.geometryWidthLambda.toFixed(2);
  }
  if (el.geometryHeightInput) {
    el.geometryHeightInput.value = state.geometryHeightLambda.toFixed(2);
  }
  if (el.geometryRadiusInput) {
    el.geometryRadiusInput.value = state.geometryRadiusLambda.toFixed(2);
  }
  if (el.geometryInnerRadiusInput) {
    el.geometryInnerRadiusInput.value = state.geometryInnerRadiusLambda.toFixed(2);
  }
  setControlDisabled(el.geometryWidthControl, el.geometryWidthInput, !geometryUsesWidth() || editsRegion);
  setControlDisabled(el.geometryHeightControl, el.geometryHeightInput, !geometryUsesHeight() || editsRegion);
  setControlDisabled(el.geometryRadiusControl, el.geometryRadiusInput, !geometryUsesRadius() || editsRegion);
  setControlDisabled(el.geometryInnerRadiusControl, el.geometryInnerRadiusInput, !geometryUsesInnerRadius() || editsRegion);
  setControlDisabled(el.customAnisotropyInput?.closest("label"), el.customAnisotropyInput, !isCustomBrush);
  document.querySelectorAll(".brush-anisotropic-params").forEach((control) => {
    control.hidden = !state.customAnisotropic;
  });
  document.querySelectorAll(".brush-material-params").forEach((control) => {
    setControlDisabled(control, [...control.querySelectorAll("input")], !isCustomBrush);
  });
  setControlDisabled(el.gyrotropyEnabledInput?.closest("label"), el.gyrotropyEnabledInput, !isCustomBrush);
  document.querySelectorAll(".gyrotropy-params").forEach((control) => {
    setControlDisabled(control, [...control.querySelectorAll("input")], !isCustomBrush || !state.materialGyrotropyEnabled);
  });
  setControlDisabled(el.bianisotropyEnabledInput?.closest("label"), el.bianisotropyEnabledInput, !isCustomBrush);
  document.querySelectorAll(".bianisotropy-params").forEach((control) => {
    setControlDisabled(control, [...control.querySelectorAll("input")], !isCustomBrush || !state.materialBianisotropyEnabled);
  });
  const modulationControlsDisabled = !isCustomBrush;
  setControlDisabled(el.modulationEnabledInput?.closest("label"), el.modulationEnabledInput, modulationControlsDisabled);
  document.querySelectorAll(".modulation-params").forEach((control) => {
    setControlDisabled(control, [...control.querySelectorAll("input")], modulationControlsDisabled || !state.materialModulationEnabled);
  });
  setControlDisabled(el.modulationPhaseInput?.closest("label"), el.modulationPhaseInput, modulationControlsDisabled || !state.materialModulationEnabled);
  setControlDisabled(el.nonlinearEnabledInput?.closest("label"), el.nonlinearEnabledInput, modulationControlsDisabled);
  document.querySelectorAll(".nonlinear-params").forEach((control) => {
    setControlDisabled(control, [...control.querySelectorAll("input")], modulationControlsDisabled || !state.materialNonlinearEnabled);
  });
  setControlDisabled(el.harmonicEnabledInput?.closest("label"), el.harmonicEnabledInput, modulationControlsDisabled);
  document.querySelectorAll(".harmonic-params").forEach((control) => {
    setControlDisabled(control, [...control.querySelectorAll("input")], modulationControlsDisabled || !state.materialHarmonicEnabled);
  });
  setControlDisabled(el.phaseChangeEnabledInput?.closest("label"), el.phaseChangeEnabledInput, !isCustomBrush);
  document.querySelectorAll(".phase-change-params").forEach((control) => {
    setControlDisabled(control, [...control.querySelectorAll("input")], !isCustomBrush || !state.materialPhaseChangeEnabled);
  });
  setControlDisabled(el.conductivityEnabledInput?.closest("label"), el.conductivityEnabledInput, !isCustomBrush);
  if (el.conductivitySigmaYControl) {
    el.conductivitySigmaYControl.hidden = !state.customAnisotropic;
  }
  document.querySelectorAll(".conductivity-params").forEach((control) => {
    setControlDisabled(control, [...control.querySelectorAll("input")], !isCustomBrush || !state.materialConductivityEnabled);
  });
  setControlDisabled(el.saturableGainEnabledInput?.closest("label"), el.saturableGainEnabledInput, !isCustomBrush);
  document.querySelectorAll(".saturable-gain-params").forEach((control) => {
    setControlDisabled(control, [...control.querySelectorAll("input")], !isCustomBrush || !state.materialSaturableGainEnabled);
  });
  const dispersionModel = normalizeDispersionModel(state.dispersionModel);
  const dispersionDisabled = !isCustomBrush || dispersionModel === "none";
  if (el.dispersionModelInput) {
    el.dispersionModelInput.value = dispersionModel;
  }
  setControlDisabled(el.dispersionModelInput?.closest("label"), el.dispersionModelInput, !isCustomBrush);
  if (el.dispersionOmegaPControl) {
    el.dispersionOmegaPControl.hidden = !["drude", "plasma"].includes(dispersionModel);
  }
  if (el.dispersionGammaControl) {
    el.dispersionGammaControl.hidden = !["drude", "plasma", "lorentz"].includes(dispersionModel);
  }
  if (el.dispersionOmega0Control) {
    el.dispersionOmega0Control.hidden = dispersionModel !== "lorentz";
  }
  if (el.dispersionDeltaEpsControl) {
    el.dispersionDeltaEpsControl.hidden = !["lorentz", "debye"].includes(dispersionModel);
  }
  if (el.dispersionTauControl) {
    el.dispersionTauControl.hidden = dispersionModel !== "debye";
  }
  document.querySelectorAll(".dispersion-params").forEach((control) => {
    setControlDisabled(control, [...control.querySelectorAll("input")], dispersionDisabled);
  });
  if (el.brushMenuSizeInput) {
    el.brushMenuSizeInput.value = String(state.brushSizeLambda);
  }
  if (el.brushMenuSizeOutput) {
    el.brushMenuSizeOutput.value = formatLambdaOutput(state.brushSizeLambda);
  }
  if (el.brushMenuHint) {
    el.brushMenuHint.textContent = editsRegion
      ? `Selected material region: ${selectedMaterialRegion.cells.length} cells`
      : state.brushTool === "geometry"
        ? `Geometry · Material: ${currentBrushLabel()}`
        : `Brush · Material: ${currentBrushLabel()}`;
  }
  if (el.brushMenuClearMaterialsBtn) {
    el.brushMenuClearMaterialsBtn.hidden = editsRegion;
  }
  if (el.brushMenuClearFieldsBtn) {
    el.brushMenuClearFieldsBtn.hidden = editsRegion;
  }
}

function gridPointToSourcePosition(point) {
  const x = clampInt(point.x, sim.sourcePlacementMinX(), sim.sourcePlacementMaxX());
  const y = clampInt(point.y, sim.sourcePlacementMinY(), sim.sourcePlacementMaxY());
  return {
    xLambda: cellsToLambda(x),
    yLambda: cellsToLambda(y),
  };
}

function openSourceMenuAt(clientX, clientY, source = null) {
  if (!el.sourceMenu) return;
  closeBrushMenu();
  closeBoundaryMenu();
  clearMaterialSelection(false);
  if (source) {
    sourceMenuMode = "edit";
    sourceMenuDraft = null;
    state.selectedSourceId = source.id;
  } else {
    sourceMenuMode = "add";
    const point = sim.clientToGridCell(clientX, clientY);
    sourceMenuDraft = makeSource(gridPointToSourcePosition(point), false);
  }
  updateControlText();
  el.sourceMenu.hidden = false;
  positionSourceMenu(clientX, clientY);
  sim.render();
}

function positionSourceMenu(clientX, clientY) {
  positionFloatingMenu(el.sourceMenu, clientX, clientY);
}

function positionFloatingMenu(menu, clientX, clientY) {
  const frame = menu?.parentElement;
  if (!frame || !menu) return;
  const frameRect = frame.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const pad = 10;
  const left = clamp(clientX - frameRect.left + pad, pad, Math.max(pad, frameRect.width - menuRect.width - pad));
  const top = clamp(clientY - frameRect.top + pad, pad, Math.max(pad, frameRect.height - menuRect.height - pad));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function closeSourceMenu() {
  if (!el.sourceMenu) return;
  el.sourceMenu.hidden = true;
  sourceMenuDraft = null;
}

function openBrushMenuAt(clientX, clientY, options = {}) {
  if (!el.brushMenu) return;
  closeSourceMenu();
  closeBoundaryMenu();
  brushMenuMode = options.mode === "region" ? "region" : "brush";
  if (brushMenuMode === "brush") {
    state.canvasMode = "brush";
  }
  updateControlText();
  el.brushMenu.hidden = false;
  positionFloatingMenu(el.brushMenu, clientX, clientY);
  sim.render();
}

function closeBrushMenu() {
  if (!el.brushMenu) return;
  el.brushMenu.hidden = true;
  brushMenuMode = "brush";
}

function updateBoundaryMenuControls() {
  normalizeBoundarySides();
  if (el.boundaryMenuInput) {
    el.boundaryMenuInput.value = boundarySideMode(boundaryMenuSide);
  }
  if (el.boundaryMenuHint) {
    const sideLabel = boundarySideLabels[boundaryMenuSide] || "Boundary";
    const modeLabel = boundarySideIsAbsorbing(boundaryMenuSide) ? "PML absorbing" : "reflective";
    el.boundaryMenuHint.textContent = `${sideLabel} boundary · ${modeLabel}`;
  }
}

function openBoundaryMenuAt(clientX, clientY) {
  if (!el.boundaryMenu) return;
  closeSourceMenu();
  closeBrushMenu();
  boundaryMenuSide = sim.boundarySideAtClientPoint(clientX, clientY) || boundaryMenuSide || "top";
  updateBoundaryMenuControls();
  el.boundaryMenu.hidden = false;
  positionFloatingMenu(el.boundaryMenu, clientX, clientY);
  sim.render();
}

function closeBoundaryMenu() {
  if (!el.boundaryMenu) return;
  el.boundaryMenu.hidden = true;
}

function closeContextMenus() {
  closeSourceMenu();
  closeBrushMenu();
  closeBoundaryMenu();
}

function applySourceMenu() {
  disableResponsiveGridOrientation();
  const values = readSourceEditorValues();
  const componentChanged = inPlaneElectricCurrentShapes.has(values.shape) && state.fieldComponent !== "hz";
  if (componentChanged) {
    state.fieldComponent = "hz";
  }
  if (sourceMenuMode === "add") {
    addSource(values);
  } else {
    const source = selectedSource();
    if (source) {
      Object.assign(source, values);
      normalizeSource(source);
      state.sourceDefaults = { ...source };
      delete state.sourceDefaults.id;
    }
  }
  sourceMenuDraft = null;
  closeSourceMenu();
  if (componentChanged) {
    sim.resetFields();
  }
  updateControlText();
  sim.render();
}

function updateControlText() {
  clampAllSourcesToInterior();
  updateCanvasAspectRatio(sim.nx, sim.ny);
  updateThemeControls();
  const editorSource = activeSourceEditorTarget() || selectedSource();
  el.speedInput.value = String(state.stepsPerFrame);
  el.speedOutput.value = formatSpeed(state.stepsPerFrame);
  el.gainOutput.value = state.gain.toFixed(2);
  if (el.diagnosticsInput) {
    el.diagnosticsInput.checked = state.diagnosticsEnabled;
  }
  el.fieldComponentButtons.forEach((button) => {
    const active = button.dataset.fieldComponent === state.fieldComponent;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  updateSourceShapeOptionLabels();
  el.viewModeButtons.forEach((button) => {
    const active = button.dataset.viewMode === state.viewMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  el.viewProjectionButtons.forEach((button) => {
    const active = button.dataset.viewProjection === state.viewProjection;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  el.materialPartButtons.forEach((button) => {
    const active = button.dataset.materialPart === state.materialPart;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  el.materialPartControl.hidden = state.viewMode !== "epsilon" && state.viewMode !== "mu";
  updateFieldDisplayControls();
  el.wavelengthInput.value = state.wavelengthUm.toFixed(2);
  el.cellsPerWavelengthInput.value = String(state.cellsPerWavelength);
  el.customAnisotropyInput.checked = state.customAnisotropic;
  el.customEpsRealLabel.innerHTML = state.customAnisotropic ? "ε<sub>x</sub>′" : "ε′";
  el.customEpsImagLabel.innerHTML = state.customAnisotropic ? "ε<sub>x</sub>″" : "ε″";
  el.customMuRealLabel.innerHTML = state.customAnisotropic ? "μ<sub>x</sub>′" : "μ′";
  el.customMuImagLabel.innerHTML = state.customAnisotropic ? "μ<sub>x</sub>″" : "μ″";
  el.customEpsRealInput.value = state.customEpsReal.toFixed(2);
  el.customEpsImagInput.value = String(Number(state.customEpsImag.toPrecision(6)));
  el.customEpsYRealInput.value = state.customEpsYReal.toFixed(2);
  el.customEpsYImagInput.value = String(Number(state.customEpsYImag.toPrecision(6)));
  el.customMuRealInput.value = state.customMuReal.toFixed(2);
  el.customMuImagInput.value = String(Number(state.customMuImag.toPrecision(6)));
  el.customMuYRealInput.value = state.customMuYReal.toFixed(2);
  el.customMuYImagInput.value = String(Number(state.customMuYImag.toPrecision(6)));
  if (el.gyrotropyEnabledInput) {
    el.gyrotropyEnabledInput.checked = state.materialGyrotropyEnabled;
  }
  if (el.gyrotropyGInput) {
    el.gyrotropyGInput.value = String(Number(state.gyrotropyG.toPrecision(6)));
  }
  if (el.bianisotropyEnabledInput) {
    el.bianisotropyEnabledInput.checked = state.materialBianisotropyEnabled;
  }
  if (el.bianisotropyKappaInput) {
    el.bianisotropyKappaInput.value = String(Number(state.bianisotropyKappa.toPrecision(6)));
  }
  el.modulationEnabledInput.checked = state.materialModulationEnabled;
  el.modulationDepthInput.value = state.modulationDepth.toFixed(2);
  el.modulationFrequencyInput.value = state.modulationFrequency.toFixed(3);
  el.modulationPeriodInput.value = state.modulationPeriodLambda.toFixed(1);
  el.modulationAngleInput.value = String(Math.round(state.modulationAngleDeg));
  el.modulationPhaseInput.value = String(Math.round(state.modulationPhaseDeg));
  el.nonlinearEnabledInput.checked = state.materialNonlinearEnabled;
  el.kerrChi3Input.value = String(Number(state.kerrChi3.toPrecision(6)));
  el.kerrSaturationInput.value = state.kerrSaturation.toFixed(2);
  if (el.harmonicEnabledInput) {
    el.harmonicEnabledInput.checked = state.materialHarmonicEnabled;
  }
  if (el.harmonicChi2Input) {
    el.harmonicChi2Input.value = String(Number(state.harmonicChi2.toPrecision(6)));
  }
  if (el.harmonicChi3Input) {
    el.harmonicChi3Input.value = String(Number(state.harmonicChi3.toPrecision(6)));
  }
  if (el.harmonicSaturationInput) {
    el.harmonicSaturationInput.value = String(Number(state.harmonicSaturation.toPrecision(6)));
  }
  if (el.phaseChangeEnabledInput) {
    el.phaseChangeEnabledInput.checked = state.materialPhaseChangeEnabled;
  }
  if (el.phaseEpsOnInput) {
    el.phaseEpsOnInput.value = String(Number(state.phaseEpsOn.toPrecision(6)));
  }
  if (el.phaseLossOnInput) {
    el.phaseLossOnInput.value = String(Number(state.phaseLossOn.toPrecision(6)));
  }
  if (el.phaseThresholdOnInput) {
    el.phaseThresholdOnInput.value = String(Number(state.phaseThresholdOn.toPrecision(6)));
  }
  if (el.phaseThresholdOffInput) {
    el.phaseThresholdOffInput.value = String(Number(state.phaseThresholdOff.toPrecision(6)));
  }
  if (el.phaseTauOnInput) {
    el.phaseTauOnInput.value = String(Math.round(state.phaseTauOn));
  }
  if (el.phaseTauOffInput) {
    el.phaseTauOffInput.value = String(Math.round(state.phaseTauOff));
  }
  if (el.conductivityEnabledInput) {
    el.conductivityEnabledInput.checked = state.materialConductivityEnabled;
  }
  if (el.conductivitySigmaInput) {
    el.conductivitySigmaInput.value = String(Number(state.conductivitySigma.toPrecision(6)));
  }
  if (el.conductivitySigmaYInput) {
    el.conductivitySigmaYInput.value = String(Number(state.conductivitySigmaY.toPrecision(6)));
  }
  if (el.saturableGainEnabledInput) {
    el.saturableGainEnabledInput.checked = state.materialSaturableGainEnabled;
  }
  if (el.gainSaturationInput) {
    el.gainSaturationInput.value = String(Number(state.gainSaturation.toPrecision(6)));
  }
  if (el.dispersionModelInput) {
    el.dispersionModelInput.value = normalizeDispersionModel(state.dispersionModel);
  }
  if (el.dispersionOmegaPInput) {
    el.dispersionOmegaPInput.value = String(Number(state.dispersionOmegaP.toPrecision(6)));
  }
  if (el.dispersionGammaInput) {
    el.dispersionGammaInput.value = String(Number(state.dispersionGamma.toPrecision(6)));
  }
  if (el.dispersionOmega0Input) {
    el.dispersionOmega0Input.value = String(Number(state.dispersionOmega0.toPrecision(6)));
  }
  if (el.dispersionDeltaEpsInput) {
    el.dispersionDeltaEpsInput.value = String(Number(state.dispersionDeltaEps.toPrecision(6)));
  }
  if (el.dispersionTauInput) {
    el.dispersionTauInput.value = String(Math.round(state.dispersionTau));
  }
  el.gridNxInput.value = String(state.gridNx);
  el.gridNyInput.value = String(state.gridNy);
  if (el.sceneNote) {
    el.sceneNote.textContent = sceneDescriptions[state.preset] || sceneDescriptions.empty;
  }
  syncSceneBrowserSelection();
  el.slabThicknessOutput.value = formatLambdaOutput(state.slabThicknessLambda);
  el.slabThicknessInput.value = String(state.slabThicknessLambda);
  const showSlabThickness = state.preset === "customSlab";
  el.slabThicknessControl.hidden = !showSlabThickness;
  el.slabThicknessInput.disabled = !showSlabThickness;
  el.slabThicknessControl.classList.toggle("is-disabled", !showSlabThickness);
  if (el.brushSizeOutput) {
    el.brushSizeOutput.value = formatLambdaOutput(state.brushSizeLambda);
  }
  if (el.brushSizeInput) {
    el.brushSizeInput.value = String(state.brushSizeLambda);
  }
  updateRunControls();
  updateCanvasModeControls();
  updateCanvasInteractionState();
  updateVisualControls();
  updateBrushControls();
  updateBoundaryMenuControls();
  if (editorSource) {
    populateSourceEditor(editorSource);
  }
  const gridSummary = `${sim.nx} x ${sim.ny}`;
  const domainSummary = `${formatLambda(cellsToLambda(sim.nx))} \u03bb\u2080 x ${formatLambda(cellsToLambda(sim.ny))} \u03bb\u2080`;
  const compactGridSummary = `${sim.nx}x${sim.ny} \u00b7 ${formatCompactLambda(cellsToLambda(sim.nx))}x${formatCompactLambda(
    cellsToLambda(sim.ny)
  )} \u03bb\u2080`;
  const fullGridSummary = `${gridSummary} \u00b7 ${domainSummary}`;
  const topGridSummary = window.matchMedia?.("(max-width: 620px)")?.matches ? compactGridSummary : fullGridSummary;
  const zoomSummary = `${sim.viewZoom.toFixed(2)}x`;
  const solverSummary = solverModeLabel();
  const boundary = boundarySummaryLabel();
  el.gridLabel.textContent = `${gridSummary} \u00b7 ${domainSummary} \u00b7 ${zoomSummary}`;
  if (el.hudModeLabel) {
    el.hudModeLabel.textContent = solverSummary;
  }
  if (el.mobileModeValue) {
    el.mobileModeValue.textContent = solverSummary;
  }
  if (el.topModeValue) {
    el.topModeValue.textContent = solverSummary;
  }
  if (el.topGridValue) {
    el.topGridValue.textContent = topGridSummary;
    el.topGridValue.title = fullGridSummary;
  }
  if (el.mobileGridValue) {
    el.mobileGridValue.textContent = `${sim.nx}x${sim.ny}`;
    el.mobileGridValue.title = fullGridSummary;
  }
  if (el.topBoundaryValue) {
    el.topBoundaryValue.textContent = boundary;
  }
  if (el.configScaleOutput) {
    el.configScaleOutput.textContent = `${state.wavelengthUm.toFixed(2)} um · ${state.cellsPerWavelength} cells/lambda0`;
  }
  if (el.configGridOutput) {
    el.configGridOutput.textContent = compactGridSummary;
    el.configGridOutput.title = fullGridSummary;
  }
  if (el.configBoundaryOutput) {
    el.configBoundaryOutput.textContent = boundary;
  }
  if (el.configCflOutput) {
    el.configCflOutput.textContent = `S = ${COURANT.toFixed(2)}`;
  }
  const sourceLabel = sourceSummaryLabel();
  const materialLabel = currentBrushLabel();
  if (el.simGuideSolver) {
    el.simGuideSolver.textContent = solverSummary;
  }
  if (el.simGuideSource) {
    el.simGuideSource.textContent = sourceLabel;
  }
  if (el.simGuideBoundary) {
    el.simGuideBoundary.textContent = boundary;
  }
  if (el.simGuideMaterial) {
    el.simGuideMaterial.textContent = materialLabel;
  }
  if (el.simGuideCfl) {
    el.simGuideCfl.textContent = `S = ${COURANT.toFixed(2)}`;
  }
  if (el.materialLabel) {
    el.materialLabel.textContent = `Material: ${materialLabel}`;
  }
  if (el.modePill) {
    el.modePill.textContent = `Sources: ${sourceLabel} - ${boundary} boundary`;
  }
  updateMaterialWarning();
  updateStabilitySummary();
  updateInspector();
  updateAllRangeProgress();
  updateSweepControls();
  updateAnalysisControls();
}

function updateStats() {
  const stepText = String(sim.time);
  const maxFieldText = formatFieldMetric(sim.lastMax, sim.lastMaxLog10);
  const energyText = formatFieldMetric(sim.lastEnergy, sim.lastEnergyLog10);
  const engineText = sim.engineLabel();
  if (el.stepCounter) el.stepCounter.textContent = stepText;
  if (el.maxField) el.maxField.textContent = maxFieldText;
  if (el.energyValue) el.energyValue.textContent = energyText;
  if (el.topStepValue) el.topStepValue.textContent = stepText;
  if (el.topMaxFieldValue) el.topMaxFieldValue.textContent = maxFieldText;
  if (el.topEngineValue) el.topEngineValue.textContent = engineText;
  if (el.canvasFocusStepValue) el.canvasFocusStepValue.textContent = `step ${stepText}`;
  if (el.canvasFocusMaxValue) el.canvasFocusMaxValue.textContent = `max ${maxFieldText}`;
  if (el.mobileStepValue) el.mobileStepValue.textContent = stepText;
  if (el.mobileMaxFieldValue) el.mobileMaxFieldValue.textContent = maxFieldText;
  if (el.hudStepLabel) el.hudStepLabel.textContent = `step ${stepText}`;
  if (el.hudFieldLabel) el.hudFieldLabel.textContent = `max ${maxFieldText}`;
  const diagnosticAngle = sim.diagnosticSamples > 0 ? sim.diagnosticAngleDeg : sim.diagnosticDirection().angleDeg;
  const diagnosticAngleText = `${formatMonitorAngle(diagnosticAngle)}°`;
  const diagnosticReflectance = sim.diagnosticReflectance || 0;
  const diagnosticTransmittance = sim.diagnosticTransmittance || 0;
  const diagnosticBalance = sim.diagnosticSamples > 0 ? 1 - diagnosticReflectance - diagnosticTransmittance : 0;
  if (el.summaryReflectanceOutput) el.summaryReflectanceOutput.textContent = formatDiagnosticRatio(diagnosticReflectance);
  if (el.summaryTransmittanceOutput) el.summaryTransmittanceOutput.textContent = formatDiagnosticRatio(diagnosticTransmittance);
  if (el.summaryBalanceOutput) el.summaryBalanceOutput.textContent = formatDiagnosticRatio(diagnosticBalance);
  if (el.summaryAngleOutput) el.summaryAngleOutput.textContent = diagnosticAngleText;
  if (el.fluxLeftOutput) el.fluxLeftOutput.textContent = formatFieldValue(sim.diagnosticIncidentPower || 0);
  if (el.diagnosticAngleOutput) {
    el.diagnosticAngleOutput.textContent = diagnosticAngleText;
  }
  if (el.reflectedPowerOutput) el.reflectedPowerOutput.textContent = formatFieldValue(sim.diagnosticReflectedPower || 0);
  if (el.fluxRightOutput) el.fluxRightOutput.textContent = formatFieldValue(sim.diagnosticTransmittedPower || 0);
  if (el.reflectanceOutput) el.reflectanceOutput.textContent = formatDiagnosticRatio(diagnosticReflectance);
  if (el.transmittanceOutput) el.transmittanceOutput.textContent = formatDiagnosticRatio(diagnosticTransmittance);
  if (el.engineValue) el.engineValue.textContent = engineText;
  updateMaterialWarning();
  if (sim.lastDiverged || sim.time % 20 === 0) {
    updateStabilitySummary();
  }
  updateAnalysisControls();
}

function formatDiagnosticRatio(value) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) < 1e-12) return "0";
  if (value >= 10) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(3);
  return value.toExponential(1);
}

function formatMonitorAngle(value) {
  if (!Number.isFinite(value)) return "0";
  const normalized = ((value % 360) + 360) % 360;
  return normalized.toFixed(Math.abs(normalized - Math.round(normalized)) < 0.05 ? 0 : 1);
}

const SWEEP_STEADY_WINDOW = 5;
const SWEEP_STEADY_MIN_SAMPLES = 4;
const SWEEP_STEADY_TOLERANCE = 0.035;
const SWEEP_STEADY_ABSOLUTE_FLOOR = 1e-4;

function sweepSourceTarget() {
  return state.sources.find((source) => incidentFieldSourceShapes.has(source.shape)) || selectedSource() || state.sources[0] || null;
}

function normalizeSweepMode(mode) {
  if (
    mode === "frequency" ||
    mode === "amplitude" ||
    mode === "gainLoss" ||
    mode === "symmetry" ||
    mode === "blochK" ||
    mode === "direction"
  ) {
    return mode;
  }
  return "angle";
}

function sweepModeLabel(mode = state.sweepMode) {
  if (mode === "frequency") return "f";
  if (mode === "amplitude") return "A";
  if (mode === "symmetry") return "d";
  if (mode === "blochK") return "k";
  if (mode === "direction") return "dir";
  if (mode === "gainLoss") return "γ";
  return "θ";
}

function sweepUnitLabel(mode = state.sweepMode) {
  return mode === "angle" ? "°" : "";
}

function clampSweepRangeForMode(mode, value) {
  const normalizedMode = normalizeSweepMode(mode);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    if (normalizedMode === "frequency") return defaultSourceConfig.frequency;
    if (normalizedMode === "amplitude") return defaultSourceConfig.amplitude;
    if (normalizedMode === "gainLoss") return 0.04;
    if (normalizedMode === "symmetry") return 0;
    if (normalizedMode === "blochK") return 0;
    if (normalizedMode === "direction") return 0;
    return 0;
  }
  if (normalizedMode === "frequency") return clamp(numeric, 0.006, 0.095);
  if (normalizedMode === "amplitude") return clamp(numeric, 0.05, 1.2);
  if (normalizedMode === "gainLoss") return clamp(numeric, 0, 0.1);
  if (normalizedMode === "symmetry") return clamp(numeric, 0, 0.25);
  if (normalizedMode === "blochK") return clamp(numeric, 0, 1);
  if (normalizedMode === "direction") return clamp(numeric, 0, 1);
  return clamp(numeric, -80, 80);
}

function formatSweepValue(value) {
  if (state.sweepMode === "frequency") return Number(value).toFixed(3);
  if (state.sweepMode === "amplitude") return Number(value).toFixed(2);
  if (state.sweepMode === "symmetry") return Number(value).toFixed(3);
  if (state.sweepMode === "blochK") return Number(value).toFixed(3);
  if (state.sweepMode === "gainLoss") return Number(value).toFixed(3);
  if (state.sweepMode === "direction") return Number(value) >= 0.5 ? "R" : "F";
  return String(Math.round(Number(value)));
}

function syncSweepStateFromInputs() {
  state.sweepMode = normalizeSweepMode(el.sweepModeInput?.value);
  state.sweepStart = clampSweepRangeForMode(state.sweepMode, el.sweepStartInput?.value);
  state.sweepEnd = clampSweepRangeForMode(state.sweepMode, el.sweepEndInput?.value);
  state.sweepSamples = clampInt(Number(el.sweepSamplesInput?.value) || 9, 3, 41);
  if (state.sweepMode === "direction") state.sweepSamples = 2;
  state.sweepSteps = clampInt(Number(el.sweepStepsInput?.value) || 720, 120, 4000);
  state.sweepBidirectional =
    state.sweepMode === "amplitude" && Boolean(el.sweepBidirectionalInput?.checked);
}

function updateSweepControls() {
  if (!el.sweepModeInput) return;
  const frequencyMode = state.sweepMode === "frequency";
  const amplitudeMode = state.sweepMode === "amplitude";
  const gainLossMode = state.sweepMode === "gainLoss";
  const symmetryMode = state.sweepMode === "symmetry";
  const blochMode = state.sweepMode === "blochK";
  const directionMode = state.sweepMode === "direction";
  const bidirectionalEnabled = amplitudeMode && state.sweepBidirectional;
  const sweepInputRange = () => {
    if (frequencyMode) return { min: "0.006", max: "0.095", step: "0.001", decimals: 3 };
    if (amplitudeMode) return { min: "0.05", max: "1.2", step: "0.05", decimals: 2 };
    if (gainLossMode) return { min: "0", max: "0.1", step: "0.002", decimals: 3 };
    if (symmetryMode) return { min: "0", max: "0.25", step: "0.005", decimals: 3 };
    if (blochMode) return { min: "0", max: "1", step: "0.02", decimals: 3 };
    if (directionMode) return { min: "0", max: "1", step: "1", decimals: 0 };
    return { min: "-80", max: "80", step: "1", decimals: 0 };
  };
  const inputRange = sweepInputRange();
  const formatSweepInput = (value) =>
    inputRange.decimals > 0 ? Number(value).toFixed(inputRange.decimals) : String(Math.round(Number(value)));
  el.sweepModeInput.value = state.sweepMode;
  if (el.sweepStartInput) {
    el.sweepStartInput.min = inputRange.min;
    el.sweepStartInput.max = inputRange.max;
    el.sweepStartInput.step = inputRange.step;
    el.sweepStartInput.value = formatSweepInput(state.sweepStart);
  }
  if (el.sweepEndInput) {
    el.sweepEndInput.min = inputRange.min;
    el.sweepEndInput.max = inputRange.max;
    el.sweepEndInput.step = inputRange.step;
    el.sweepEndInput.value = formatSweepInput(state.sweepEnd);
  }
  setControlDisabled(el.sweepStartInput?.closest("label"), el.sweepStartInput, directionMode);
  setControlDisabled(el.sweepEndInput?.closest("label"), el.sweepEndInput, directionMode);
  if (el.sweepSamplesInput) {
    el.sweepSamplesInput.min = directionMode ? "2" : "3";
    el.sweepSamplesInput.max = directionMode ? "2" : "41";
    el.sweepSamplesInput.value = String(state.sweepSamples);
    setControlDisabled(el.sweepSamplesInput.closest("label"), el.sweepSamplesInput, directionMode);
  }
  if (el.sweepStepsInput) el.sweepStepsInput.value = String(state.sweepSteps);
  if (el.sweepBidirectionalInput) {
    el.sweepBidirectionalInput.checked = bidirectionalEnabled;
    setControlDisabled(el.sweepBidirectionalInput.closest("label"), el.sweepBidirectionalInput, !amplitudeMode || state.sweepRunning);
  }
  if (el.sweepRunBtn) el.sweepRunBtn.textContent = state.sweepRunning ? "Cancel sweep" : "Run sweep";
  if (el.sweepExportBtn) el.sweepExportBtn.disabled = state.sweepRunning || state.sweepResults.length === 0;
  drawSweepChart();
}

function setSweepStatus(text) {
  if (el.sweepStatus) el.sweepStatus.textContent = text;
}

function sweepReadyStatusText() {
  if (state.sweepMode === "blochK") return "Bloch k sweep uses the current photonic-crystal geometry.";
  if (state.preset === "hyperlens" && (state.sweepMode === "frequency" || state.sweepMode === "amplitude")) {
    return "Hyperlens sweep plots outer/inner ring transfer from FDTD field samples.";
  }
  return "Sweep uses the current scene and the active incident source.";
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function brewsterSweepReference() {
  if (state.sweepMode !== "angle") return null;
  if (state.preset !== "brewsterTm" && state.preset !== "brewsterTeTm" && state.preset !== "teTmComparison") return null;
  const n1 = 1;
  const n2 = 1.5;
  return {
    n1,
    n2,
    thetaB: (Math.atan(n2 / n1) * 180) / Math.PI,
    comparePolarizations: state.preset === "brewsterTeTm" || state.preset === "teTmComparison",
  };
}

function dualPolarizationSweepEnabled() {
  return (state.preset === "brewsterTeTm" || state.preset === "teTmComparison") && state.sweepMode === "angle";
}

function gainLossSweepCompatible() {
  return state.preset === "ptSymmetricCoupler" || state.preset === "exceptionalPointCoupler";
}

function gainLossSweepSnapshot() {
  return {
    loss: new Float32Array(sim.loss),
    lossY: new Float32Array(sim.lossY),
  };
}

function restoreGainLossSweepSnapshot(snapshot) {
  if (!snapshot) return;
  sim.loss.set(snapshot.loss);
  sim.lossY.set(snapshot.lossY);
}

function applyGainLossSweepValue(snapshot, value) {
  if (!snapshot || !gainLossSweepCompatible()) return 0;
  const gamma = clampSweepRangeForMode("gainLoss", value);
  let count = 0;
  for (let i = 0; i < sim.n; i += 1) {
    const baseLoss = snapshot.loss[i];
    if (Math.abs(baseLoss) < 0.01 || sim.material[i] === 2) continue;
    const signedLoss = baseLoss < 0 ? -gamma : gamma;
    sim.loss[i] = signedLoss;
    sim.lossY[i] = Math.abs(snapshot.lossY[i]) >= 0.01 ? signedLoss : snapshot.lossY[i];
    count += 1;
  }
  return count;
}

function symmetrySweepCompatible() {
  return state.preset === "phcDarkMode" || state.preset === "quasiBic" || state.preset === "symmetryProtectedBic";
}

function blochSweepCompatible() {
  return phcBlochAnalysisPresets.has(state.preset);
}

function directionSweepCompatible() {
  return (
    state.preset === "travelingModulation" ||
    state.preset === "temporalIsolator" ||
    state.preset === "topologyTemporalMod" ||
    state.preset === "nonreciprocalValleyHall" ||
    state.preset === "spaceTimeCrystal"
  );
}

function applyDirectionSweepValue(source, value) {
  if (!source) return "forward";
  const reverse = Number(value) >= 0.5;
  source.type = "sine";
  source.shape = incidentFieldSourceShapes.has(source.shape) ? source.shape : "gaussianProfile";
  source.angleDeg = reverse ? 180 : 0;
  source.xLambda = reverse ? maxSourceXLambda() - 0.12 : minSourceXLambda() + 0.12;
  normalizeSource(source);
  return reverse ? "reverse" : "forward";
}

function symmetrySweepSnapshot() {
  return sim.snapshotMaterialArrays();
}

function restoreSymmetrySweepSnapshot(snapshot) {
  if (!snapshot) return;
  sim.restoreMaterialArrays(snapshot);
  sim.refreshPmlMaterialContinuation(false);
}

function applySymmetrySweepValue(snapshot, value) {
  if (!snapshot || !symmetrySweepCompatible()) return 0;
  const delta = clampSweepRangeForMode("symmetry", value);
  sim.restoreMaterialArrays(snapshot);
  if (delta <= 1e-9) {
    sim.refreshPmlMaterialContinuation(false);
    return 0;
  }

  const cx = (sim.nx - 1) * 0.5;
  const cy = (sim.ny - 1) * 0.5;
  const spanX = Math.max(4, state.cellsPerWavelength * 2.4);
  const spanY = Math.max(4, state.cellsPerWavelength * 1.7);
  const minX = Math.max(1, Math.floor(cx - spanX));
  const maxX = Math.min(sim.nx - 2, Math.ceil(cx + spanX));
  const minY = Math.max(1, Math.floor(cy - spanY));
  const maxY = Math.min(sim.ny - 2, Math.ceil(cy + spanY));
  let count = 0;

  for (let y = minY; y <= maxY; y += 1) {
    const dy = Math.abs((y - cy) / spanY);
    if (dy > 1) continue;
    for (let x = minX; x <= maxX; x += 1) {
      const dx = (x - cx) / spanX;
      if (Math.abs(dx) > 1) continue;
      const idx = sim.id(x, y);
      if (snapshot.material[idx] === 0 || snapshot.material[idx] === 2 || snapshot.eps[idx] <= 1.2) continue;
      const weight = (1 - Math.abs(dx)) * (1 - dy);
      const sign = x >= cx ? -1 : 1;
      const scale = clamp(1 + sign * delta * weight, 0.65, 1.35);
      sim.eps[idx] = clamp(snapshot.eps[idx] * scale, 1, 30);
      sim.epsY[idx] = clamp(snapshot.epsY[idx] * scale, 1, 30);
      if (snapshot.modulatedMaterial[idx] || snapshot.nonlinearMaterial[idx]) {
        sim.modulationBaseEps[idx] = sim.eps[idx];
        sim.modulationBaseEpsY[idx] = sim.epsY[idx];
      }
      count += 1;
    }
  }
  sim.refreshPmlMaterialContinuation(false);
  return count;
}

function bidirectionalSweepActive() {
  return state.sweepMode === "amplitude" && Boolean(state.sweepBidirectional);
}

function buildSweepScanPoints() {
  if (state.sweepMode === "direction") {
    return [
      { value: 0, branch: "forward", branchIndex: 0 },
      { value: 1, branch: "reverse", branchIndex: 1 },
    ];
  }
  const valueCount = Math.max(1, state.sweepSamples);
  const values = Array.from({ length: valueCount }, (_unused, index) => {
    const t = valueCount === 1 ? 0 : index / (valueCount - 1);
    return state.sweepStart + (state.sweepEnd - state.sweepStart) * t;
  });
  if (!bidirectionalSweepActive()) {
    return values.map((value, index) => ({ value, branch: "", branchIndex: index }));
  }
  return [
    ...values.map((value, index) => ({ value, branch: "forward", branchIndex: index })),
    ...values.slice().reverse().map((value, index) => ({ value, branch: "reverse", branchIndex: index })),
  ];
}

function sweepAuxMetric() {
  if (state.sweepMode === "gainLoss") return { key: "split", label: "df", only: true };
  if (state.sweepMode === "symmetry") return { key: "leakage", label: "leak", only: true };
  if (state.sweepMode === "blochK") return { key: "blochBandFrequency", label: "f1", only: true };
  if (state.preset === "hyperlens" && (state.sweepMode === "frequency" || state.sweepMode === "amplitude")) {
    return { key: "hyperlensTransfer", label: "Hout/Hin", only: true };
  }
  if (
    (state.sweepMode === "amplitude" || state.sweepMode === "frequency") &&
    temporalFloquetAnalysisPresets.has(state.preset)
  ) {
    return { key: "floquetPowerSideband", label: "Pside" };
  }
  if (state.sweepMode !== "amplitude") return null;
  if (state.preset === "shgSlab") return { key: "h2", label: "H2" };
  if (state.preset === "thgSlab") return { key: "h3", label: "H3" };
  if (phaseChangeAnalysisPresets.has(state.preset)) return { key: "phaseState", label: "s" };
  if (state.preset === "exceptionalPointCoupler") return { key: "split", label: "df" };
  if (nonlinearAnalysisPresets.has(state.preset)) return { key: "sideband", label: "side" };
  return null;
}

function sweepMetricValue(metrics, key) {
  if (key === "h2") return metrics?.harmonic2 || 0;
  if (key === "h3") return metrics?.harmonic3 || 0;
  if (key === "sideband") return metrics?.sidebandRatio || 0;
  if (key === "phaseState") return metrics?.phaseAverage ?? sim.phaseChangeStateEstimate();
  if (key === "split") return metrics?.split || 0;
  if (key === "leakage") return metrics?.leakageRate || 0;
  if (key === "blochLeakage") return metrics?.phcBloch?.leakage || 0;
  if (key === "blochBandFrequency") return metrics?.phcBloch?.bandFrequency || 0;
  if (key === "floquetPowerSideband") return metrics?.floquet?.sidebandPower || 0;
  if (key === "hyperlensTransfer") return metrics?.hyperlens?.transfer || 0;
  if (key === "hyperlensDetailTransfer") return metrics?.hyperlens?.detailTransfer || 0;
  return 0;
}

function sweepSteadyObservation(metrics = null) {
  const observation = {
    r: sim.diagnosticReflectance || 0,
    t: sim.diagnosticTransmittance || 0,
  };
  const auxMetric = sweepAuxMetric();
  if (auxMetric) observation[auxMetric.key] = sweepMetricValue(metrics, auxMetric.key);
  if (phaseChangeAnalysisPresets.has(state.preset)) {
    observation.phaseState = sweepMetricValue(metrics, "phaseState");
  }
  return observation;
}

function sweepSteadyEstimate(history) {
  const tail = history
    .filter(Boolean)
    .slice(-SWEEP_STEADY_WINDOW);
  if (tail.length < SWEEP_STEADY_MIN_SAMPLES) {
    return {
      steady: false,
      drift: Infinity,
      key: "samples",
      samples: tail.length,
      tolerance: SWEEP_STEADY_TOLERANCE,
    };
  }
  const keys = Array.from(new Set(tail.flatMap((sample) => Object.keys(sample))));
  let worstDrift = 0;
  let worstKey = "";
  let validKeys = 0;

  keys.forEach((key) => {
    const values = tail
      .map((sample) => Number(sample[key]))
      .filter((value) => Number.isFinite(value));
    if (values.length < SWEEP_STEADY_MIN_SAMPLES) return;
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const meanAbs = values.reduce((sum, value) => sum + Math.abs(value), 0) / values.length;
    const scale = Math.max(SWEEP_STEADY_ABSOLUTE_FLOOR, meanAbs);
    const drift = (maxValue - minValue) / scale;
    validKeys += 1;
    if (drift >= worstDrift) {
      worstDrift = drift;
      worstKey = key;
    }
  });

  if (validKeys === 0) {
    return {
      steady: false,
      drift: Infinity,
      key: "metrics",
      samples: tail.length,
      tolerance: SWEEP_STEADY_TOLERANCE,
    };
  }

  return {
    steady: worstDrift <= SWEEP_STEADY_TOLERANCE,
    drift: worstDrift,
    key: worstKey,
    samples: tail.length,
    tolerance: SWEEP_STEADY_TOLERANCE,
  };
}

function formatSweepDrift(value) {
  if (!Number.isFinite(value)) return "n/a";
  const percent = 100 * value;
  if (percent >= 10) return `${percent.toFixed(0)}%`;
  if (percent >= 1) return `${percent.toFixed(1)}%`;
  return `${percent.toFixed(2)}%`;
}

function directionSweepIsolationEstimate(results = state.sweepResults) {
  if (state.sweepMode !== "direction") return null;
  const forward = results.find((result) => result.branch === "forward");
  const reverse = results.find((result) => result.branch === "reverse");
  if (!forward || !reverse) return null;
  const floor = 1e-6;
  const tForward = Math.max(0, Number(forward.t) || 0);
  const tReverse = Math.max(0, Number(reverse.t) || 0);
  const isolationDb = 10 * Math.log10((tForward + floor) / (tReverse + floor));
  return {
    tForward,
    tReverse,
    isolationDb: Number.isFinite(isolationDb) ? isolationDb : 0,
  };
}

function formatIsolationDb(value) {
  if (!Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(Math.abs(value) < 10 ? 2 : 1)} dB`;
}

function sweepResultStatusText(result, pointIndex, pointCount) {
  const auxMetric = sweepAuxMetric();
  const branchText = result.branch ? `${result.branch} ` : "";
  const steadyText = result.steady ? " | steady" : ` | drift=${formatSweepDrift(result.steadyDrift)}`;
  const epText =
    state.sweepMode === "gainLoss" && result.epPhase
      ? ` | ${result.epPhase} EPd=${formatDiagnosticRatio(result.epDistance || 0)}`
      : "";
  if (auxMetric) {
    if (auxMetric.only) {
      return `Recorded ${branchText}${pointIndex + 1}/${pointCount}: ${auxMetric.label}=${formatDiagnosticRatio(result[auxMetric.key] || 0)}${epText}${steadyText}`;
    }
    return `Recorded ${branchText}${pointIndex + 1}/${pointCount}: T=${formatDiagnosticRatio(result.t)}, ${auxMetric.label}=${formatDiagnosticRatio(result[auxMetric.key] || 0)}${epText}${steadyText}`;
  }
  return `Recorded ${branchText}${pointIndex + 1}/${pointCount}: R=${formatDiagnosticRatio(result.r)}, T=${formatDiagnosticRatio(result.t)}${steadyText}`;
}

function fresnelReflectance(angleDeg, n1, n2, polarization) {
  const thetaI = (clamp(Number(angleDeg) || 0, -89.9, 89.9) * Math.PI) / 180;
  const sinI = Math.sin(thetaI);
  const cosI = Math.cos(thetaI);
  const sinT = (n1 / n2) * sinI;
  if (Math.abs(sinT) >= 1) return 1;
  const cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
  const numerator =
    polarization === "tm"
      ? n2 * cosI - n1 * cosT
      : n1 * cosI - n2 * cosT;
  const denominator =
    polarization === "tm"
      ? n2 * cosI + n1 * cosT
      : n1 * cosI + n2 * cosT;
  if (Math.abs(denominator) < 1e-12) return 1;
  const r = numerator / denominator;
  return clamp(r * r, 0, 1);
}

function drawSweepChart() {
  const canvas = el.sweepChart;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(260, Math.round((rect.width || canvas.width) * dpr));
  const height = Math.max(140, Math.round((rect.height || canvas.height) * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dark = state.theme === "dark";
  const bg = dark ? "rgba(13, 17, 22, 0.62)" : "rgba(255, 255, 255, 0.46)";
  const grid = dark ? "rgba(226, 236, 245, 0.12)" : "rgba(25, 43, 54, 0.12)";
  const axis = dark ? "rgba(230, 238, 245, 0.72)" : "rgba(30, 42, 50, 0.68)";
  const text = dark ? "rgba(235, 241, 246, 0.86)" : "rgba(22, 32, 40, 0.82)";
  const rColor = "rgb(13, 107, 245)";
  const tColor = "rgb(18, 143, 91)";
  const auxColor = "rgb(220, 72, 92)";
  const padL = 42 * dpr;
  const padR = 16 * dpr;
  const padT = 18 * dpr;
  const padB = 32 * dpr;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const results = state.sweepResults || [];
  const dualPolarization = dualPolarizationSweepEnabled();
  const auxMetric = sweepAuxMetric();
  const branchResultsAvailable = results.some((point) => point.branch);
  const xValues = results.map((point) => point.x);
  const xMin = results.length ? Math.min(...xValues) : state.sweepStart;
  const xMax = results.length ? Math.max(...xValues) : state.sweepEnd;
  const ySeries = dualPolarization
    ? results.flatMap((point) => [point.rTm || 0, point.rTe || 0])
    : auxMetric
      ? auxMetric.only
        ? results.map((point) => point[auxMetric.key] || 0)
        : results.flatMap((point) => [point.t || 0, point[auxMetric.key] || 0])
      : results.flatMap((point) => [point.r || 0, point.t || 0]);
  const yMaxRaw = Math.max(1, ...ySeries);
  const auxOnlyMax = Math.max(1e-4, ...ySeries);
  const yMax = auxMetric?.only ? auxOnlyMax * 1.12 : yMaxRaw > 1.2 ? Math.ceil(yMaxRaw * 10) / 10 : 1;
  const toX = (value) => padL + ((value - xMin) / Math.max(1e-9, xMax - xMin)) * plotW;
  const toY = (value) => padT + plotH - (clamp(value, 0, yMax) / yMax) * plotH;
  const reference = brewsterSweepReference();

  ctx.strokeStyle = grid;
  ctx.lineWidth = Math.max(1, dpr);
  ctx.beginPath();
  for (let i = 0; i <= 4; i += 1) {
    const y = padT + (plotH * i) / 4;
    ctx.moveTo(padL, y);
    ctx.lineTo(width - padR, y);
  }
  for (let i = 0; i <= 4; i += 1) {
    const x = padL + (plotW * i) / 4;
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
  }
  ctx.stroke();

  ctx.strokeStyle = axis;
  ctx.lineWidth = Math.max(1.2 * dpr, 1);
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(width - padR, padT + plotH);
  ctx.stroke();

  const drawReferenceCurve = (polarization, color) => {
    if (!reference) return;
    const samples = 120;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.3 * dpr, 1);
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.beginPath();
    for (let i = 0; i < samples; i += 1) {
      const t = samples === 1 ? 0 : i / (samples - 1);
      const angle = xMin + (xMax - xMin) * t;
      const x = toX(angle);
      const y = toY(fresnelReflectance(angle, reference.n1, reference.n2, polarization));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  if (reference) {
    drawReferenceCurve("tm", "rgba(183, 106, 37, 0.88)");
    if (reference.comparePolarizations) {
      drawReferenceCurve("te", "rgba(128, 86, 190, 0.82)");
    }
    if (reference.thetaB >= Math.min(xMin, xMax) && reference.thetaB <= Math.max(xMin, xMax)) {
      const xb = toX(reference.thetaB);
      ctx.save();
      ctx.strokeStyle = "rgba(183, 106, 37, 0.72)";
      ctx.lineWidth = Math.max(1.4 * dpr, 1);
      ctx.setLineDash([3 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(xb, padT);
      ctx.lineTo(xb, padT + plotH);
      ctx.stroke();
      ctx.fillStyle = text;
      ctx.font = `${10 * dpr}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`thetaB ${reference.thetaB.toFixed(1)}${sweepUnitLabel()}`, xb, padT + 3 * dpr);
      ctx.restore();
    }
  }

  const drawSeries = (key, color) => {
    if (results.length === 0) return;
    if (!results.some((point) => Number.isFinite(point[key]))) return;
    const groups = branchResultsAvailable
      ? [
          { name: "forward", dashed: false },
          { name: "reverse", dashed: true },
        ]
      : [{ name: "", dashed: false }];
    groups.forEach((group) => {
      const points = group.name ? results.filter((point) => point.branch === group.name) : results;
      if (!points.some((point) => Number.isFinite(point[key]))) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(2 * dpr, 1.5);
      if (group.dashed) ctx.setLineDash([5 * dpr, 4 * dpr]);
      ctx.beginPath();
      points.forEach((point, index) => {
        const x = toX(point.x);
        const y = toY(point[key]);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      points.forEach((point) => {
        if (!Number.isFinite(point[key])) return;
        ctx.beginPath();
        ctx.arc(toX(point.x), toY(point[key]), 2.6 * dpr, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    });
  };
  if (dualPolarization) {
    drawSeries("rTm", rColor);
    drawSeries("rTe", tColor);
  } else if (auxMetric) {
    if (!auxMetric.only) drawSeries("t", tColor);
    drawSeries(auxMetric.key, auxColor);
  } else {
    drawSeries("r", rColor);
    drawSeries("t", tColor);
  }

  ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = text;
  ctx.textAlign = "left";
  if (dualPolarization) {
    ctx.fillText("R_TM", padL + 8 * dpr, padT + 12 * dpr);
    ctx.fillStyle = rColor;
    ctx.fillRect(padL + 42 * dpr, padT + 8 * dpr, 14 * dpr, 3 * dpr);
    ctx.fillStyle = text;
    ctx.fillText("R_TE", padL + 64 * dpr, padT + 12 * dpr);
    ctx.fillStyle = tColor;
    ctx.fillRect(padL + 98 * dpr, padT + 8 * dpr, 14 * dpr, 3 * dpr);
  } else if (auxMetric) {
    const labelX = auxMetric.only ? 8 : 48;
    if (!auxMetric.only) {
      ctx.fillText("T", padL + 8 * dpr, padT + 12 * dpr);
      ctx.fillStyle = tColor;
      ctx.fillRect(padL + 24 * dpr, padT + 8 * dpr, 14 * dpr, 3 * dpr);
      ctx.fillStyle = text;
    }
    ctx.fillText(auxMetric.label, padL + labelX * dpr, padT + 12 * dpr);
    ctx.fillStyle = auxColor;
    ctx.fillRect(padL + (labelX + 24) * dpr, padT + 8 * dpr, 14 * dpr, 3 * dpr);
  } else {
    ctx.fillText("R", padL + 8 * dpr, padT + 12 * dpr);
    ctx.fillStyle = rColor;
    ctx.fillRect(padL + 24 * dpr, padT + 8 * dpr, 14 * dpr, 3 * dpr);
    ctx.fillStyle = text;
    ctx.fillText("T", padL + 48 * dpr, padT + 12 * dpr);
    ctx.fillStyle = tColor;
    ctx.fillRect(padL + 64 * dpr, padT + 8 * dpr, 14 * dpr, 3 * dpr);
  }
  if (reference) {
    ctx.fillStyle = text;
    const refX = dualPolarization ? 124 : 88;
    ctx.fillText("TM ref", padL + refX * dpr, padT + 12 * dpr);
    ctx.strokeStyle = "rgba(183, 106, 37, 0.88)";
    ctx.lineWidth = Math.max(1.3 * dpr, 1);
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(padL + (refX + 42) * dpr, padT + 10 * dpr);
    ctx.lineTo(padL + (refX + 58) * dpr, padT + 10 * dpr);
    ctx.stroke();
    ctx.setLineDash([]);
    if (reference.comparePolarizations) {
      ctx.fillStyle = text;
      ctx.fillText("TE ref", padL + (refX + 70) * dpr, padT + 12 * dpr);
      ctx.strokeStyle = "rgba(128, 86, 190, 0.82)";
      ctx.setLineDash([5 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(padL + (refX + 112) * dpr, padT + 10 * dpr);
      ctx.lineTo(padL + (refX + 128) * dpr, padT + 10 * dpr);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (branchResultsAvailable) {
    ctx.fillStyle = text;
    ctx.textAlign = "right";
    ctx.fillText("solid forward / dashed reverse", width - padR, padT + 12 * dpr);
  }
  ctx.fillStyle = text;
  ctx.textAlign = "right";
  ctx.fillText(auxMetric?.only ? formatDiagnosticRatio(yMax) : yMax.toFixed(yMax > 1 ? 1 : 0), padL - 7 * dpr, padT + 2 * dpr);
  ctx.fillText("0", padL - 7 * dpr, padT + plotH);
  ctx.textAlign = "center";
  ctx.fillText(`${sweepModeLabel()} ${sweepUnitLabel()}`.trim(), padL + plotW / 2, height - 12 * dpr);
  if (results.length === 0) {
    ctx.fillStyle = dark ? "rgba(224, 232, 238, 0.56)" : "rgba(51, 65, 74, 0.56)";
    ctx.fillText(
      dualPolarization
          ? "Run a sweep to plot TE/TM reflectance"
        : auxMetric
          ? auxMetric.only
            ? `Run ${state.sweepMode} sweep to plot ${auxMetric.label}`
            : bidirectionalSweepActive()
              ? `Run bidirectional amplitude sweep to plot T and ${auxMetric.label}`
              : `Run amplitude sweep to plot T and ${auxMetric.label}`
          : "Run a sweep to plot R and T",
      padL + plotW / 2,
      padT + plotH / 2,
    );
  }
  if (el.sweepChartReadout) {
    el.sweepChartReadout.textContent =
      results.length > 0 ? `${results.length} sweep points | ${sweepModeLabel()} ${formatSweepValue(results[results.length - 1].x)}` : "No sweep point";
  }
}

function canvasRelativePoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp(event.clientX - rect.left, 0, rect.width),
    y: clamp(event.clientY - rect.top, 0, rect.height),
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
  };
}

function updateSweepChartReadout(event) {
  if (!el.sweepChartReadout || !el.sweepChart) return;
  const results = state.sweepResults || [];
  if (results.length === 0) {
    el.sweepChartReadout.textContent = "No sweep point";
    return;
  }
  const point = canvasRelativePoint(el.sweepChart, event);
  const xs = results.map((result) => result.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xValue = xMin + (point.x / point.width) * Math.max(1e-9, xMax - xMin);
  let nearest = results[0];
  let bestDistance = Infinity;
  for (const result of results) {
    const distance = Math.abs(result.x - xValue);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = result;
    }
  }
  const values = [
    `${sweepModeLabel()}=${formatSweepValue(nearest.x)}`,
    Number.isFinite(nearest.r) ? `R=${formatDiagnosticRatio(nearest.r)}` : null,
    Number.isFinite(nearest.t) ? `T=${formatDiagnosticRatio(nearest.t)}` : null,
    nearest.branch ? nearest.branch : null,
  ].filter(Boolean);
  el.sweepChartReadout.textContent = values.join(" | ");
}

function chartPalette() {
  const dark = state.theme === "dark";
  return {
    dark,
    bg: dark ? "rgba(13, 17, 22, 0.62)" : "rgba(255, 255, 255, 0.46)",
    grid: dark ? "rgba(226, 236, 245, 0.12)" : "rgba(25, 43, 54, 0.12)",
    axis: dark ? "rgba(230, 238, 245, 0.72)" : "rgba(30, 42, 50, 0.68)",
    text: dark ? "rgba(235, 241, 246, 0.86)" : "rgba(22, 32, 40, 0.82)",
    muted: dark ? "rgba(224, 232, 238, 0.56)" : "rgba(51, 65, 74, 0.56)",
    blue: "rgb(13, 107, 245)",
    green: "rgb(18, 143, 91)",
    red: "rgb(220, 72, 92)",
  };
}

function prepareChartCanvas(canvas, minWidth = 260, minHeight = 130) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(minWidth, Math.round((rect.width || canvas.width) * dpr));
  const height = Math.max(minHeight, Math.round((rect.height || canvas.height) * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  return ctx ? { ctx, width, height, dpr } : null;
}

function orderedProbeSamples() {
  const count = sim.analysisProbeCount || 0;
  const series = sim.analysisProbeSeries || [];
  const length = series.length || 0;
  if (count <= 0 || length <= 0) return [];
  const start = (sim.analysisProbeIndex - count + length) % length;
  const values = [];
  for (let i = 0; i < count; i += 1) {
    values.push(series[(start + i) % length]);
  }
  return values;
}

function drawSpectrumChart() {
  const prepared = prepareChartCanvas(el.spectrumChart, 260, 126);
  if (!prepared) return;
  const { ctx, width, height, dpr } = prepared;
  const colors = chartPalette();
  const padL = 38 * dpr;
  const padR = 14 * dpr;
  const padT = 22 * dpr;
  const padB = 28 * dpr;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);
  const values = orderedProbeSamples();
  const binCount = 44;
  const maxFrequency = 0.1;
  const bins = [];
  let maxMag = 0;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  if (values.length >= 16) {
    const dt = Math.max(1, state.analysisSampleEvery);
    for (let b = 0; b < binCount; b += 1) {
      const f = (maxFrequency * b) / (binCount - 1);
      let re = 0;
      let im = 0;
      for (let n = 0; n < values.length; n += 1) {
        const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / Math.max(1, values.length - 1));
        const phase = 2 * Math.PI * f * dt * n;
        re += window * values[n] * Math.cos(phase);
        im -= window * values[n] * Math.sin(phase);
      }
      const mag = Math.hypot(re, im) / values.length;
      if (mag > maxMag) maxMag = mag;
      bins.push({ f, mag });
    }
  }

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = Math.max(1, dpr);
  ctx.beginPath();
  for (let i = 0; i <= 4; i += 1) {
    const y = padT + (plotH * i) / 4;
    ctx.moveTo(padL, y);
    ctx.lineTo(width - padR, y);
  }
  for (let i = 0; i <= 4; i += 1) {
    const x = padL + (plotW * i) / 4;
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
  }
  ctx.stroke();

  ctx.strokeStyle = colors.axis;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(width - padR, padT + plotH);
  ctx.stroke();

  if (bins.length > 0 && maxMag > 1e-12) {
    ctx.strokeStyle = colors.blue;
    ctx.lineWidth = Math.max(2 * dpr, 1.5);
    ctx.beginPath();
    bins.forEach((bin, index) => {
      const x = padL + (bin.f / maxFrequency) * plotW;
      const db = Math.max(-54, 20 * Math.log10(bin.mag / maxMag));
      const y = padT + plotH - ((db + 54) / 54) * plotH;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  } else {
    ctx.fillStyle = colors.muted;
    ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Collecting probe samples", padL + plotW / 2, padT + plotH / 2);
  }

  ctx.fillStyle = colors.text;
  ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("Probe spectrum", padL, 11 * dpr);
  ctx.textAlign = "right";
  ctx.fillText("0 dB", padL - 6 * dpr, padT + 2 * dpr);
  ctx.fillText("-54", padL - 6 * dpr, padT + plotH);
  ctx.textAlign = "center";
  ctx.fillText("f", padL + plotW / 2, height - 11 * dpr);
}

function drawFarFieldChart() {
  const prepared = prepareChartCanvas(el.farFieldChart, 260, 126);
  if (!prepared) return;
  const { ctx, width, height, dpr } = prepared;
  const colors = chartPalette();
  const data = sim.analysisFarFieldEstimate(96);
  const scatteringMode = sim.analysisFarFieldMode === "scattering" || Boolean(sim.analysisScatteringSource());
  const cx = width * 0.5;
  const cy = height * 0.56;
  const radius = Math.min(width, height) * 0.34;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = Math.max(1, dpr);
  for (let r = 0.33; r <= 1.01; r += 0.33) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();

  if (data.length > 0) {
    ctx.fillStyle = state.theme === "dark" ? "rgba(13, 107, 245, 0.18)" : "rgba(13, 107, 245, 0.14)";
    ctx.strokeStyle = colors.blue;
    ctx.lineWidth = Math.max(2 * dpr, 1.5);
    ctx.beginPath();
    data.forEach((point, index) => {
      const r = radius * Math.sqrt(clamp(point.value, 0, 1));
      const x = cx + r * Math.cos(point.theta);
      const y = cy + r * Math.sin(point.theta);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = colors.muted;
    ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(scatteringMode ? "Collecting scattering phasors" : "Collecting NTFF contour phasors", cx, cy);
  }

  ctx.fillStyle = colors.text;
  ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(scatteringMode ? "Scattering width / lambda0" : "NTFF angular pattern", 12 * dpr, 11 * dpr);
  if (scatteringMode && sim.analysisScatteringTotal > 0) {
    ctx.fillStyle = colors.muted;
    ctx.textAlign = "right";
    ctx.fillText(`sigma/lambda0 ${formatFieldValue(sim.analysisScatteringTotal)}`, width - 12 * dpr, 11 * dpr);
    ctx.fillStyle = colors.text;
  }
  ctx.textAlign = "center";
  ctx.fillText("0°", cx + radius + 10 * dpr, cy);
  ctx.fillText("90°", cx, cy + radius + 12 * dpr);
}

function updateSpectrumReadout(event) {
  if (!el.analysisChartReadout || !el.spectrumChart) return;
  const point = canvasRelativePoint(el.spectrumChart, event);
  const f = clamp(point.x / point.width, 0, 1) * 0.1;
  const db = -54 + (1 - clamp(point.y / point.height, 0, 1)) * 54;
  el.analysisChartReadout.textContent = `Spectrum f=${formatFieldValue(f)} | ${db.toFixed(1)} dB`;
}

function updateFarFieldReadout(event) {
  if (!el.analysisChartReadout || !el.farFieldChart) return;
  const point = canvasRelativePoint(el.farFieldChart, event);
  const cx = point.width * 0.5;
  const cy = point.height * 0.56;
  const theta = (Math.atan2(point.y - cy, point.x - cx) * 180) / Math.PI;
  const normalized = ((theta % 360) + 360) % 360;
  const scatteringMode = sim.analysisFarFieldMode === "scattering" || Boolean(sim.analysisScatteringSource());
  el.analysisChartReadout.textContent = `${scatteringMode ? "Scattering" : "NTFF"} theta=${normalized.toFixed(1)}°`;
}

function updateAnalysisControls() {
  if (el.analysisInput) el.analysisInput.checked = state.analysisEnabled;
  drawSpectrumChart();
  drawFarFieldChart();
  if (el.analysisStatus) {
    const sampleText = `${sim.analysisSamples || 0} samples`;
    const contourText = `${sim.analysisContour?.length || 0} contour pts`;
    const scatteringMode = sim.analysisFarFieldMode === "scattering" || Boolean(sim.analysisScatteringSource());
    const forwardBackward =
      sim.analysisScatteringBackward > 1e-24 ? sim.analysisScatteringForward / sim.analysisScatteringBackward : Infinity;
    const scatteringText =
      scatteringMode && sim.analysisScatteringTotal > 0
        ? ` | sigma/lambda0=${formatFieldValue(sim.analysisScatteringTotal)} | F/B=${
            Number.isFinite(forwardBackward) ? formatFieldValue(forwardBackward) : "inf"
          }`
        : "";
    const metrics = sim.analysisMetricEstimate();
    let resonatorText = "";
    if (metrics && resonatorAnalysisPresets.has(state.preset)) {
      if (metrics.ringdown?.q) resonatorText += ` | Q~${formatFieldValue(metrics.ringdown.q)}`;
      if (purcellAnalysisPresets.has(state.preset) && metrics.purcellProxy > 0) {
        resonatorText += ` | Q/Aeff=${formatFieldValue(metrics.purcellProxy)}`;
      }
      if (betaAnalysisPresets.has(state.preset) && metrics.beta > 0) {
        resonatorText += ` | beta~${formatDiagnosticRatio(metrics.beta)}`;
      }
      if (degenerateAnalysisPresets.has(state.preset) && metrics.split > 0) {
        resonatorText += ` | df=${formatFieldValue(metrics.split)}`;
      }
      if (ptModalAnalysisPresets.has(state.preset) && metrics.ptModal) {
        resonatorText += ` | g/k=${formatDiagnosticRatio(metrics.ptModal.normalizedGamma)} | ${metrics.ptModal.phase}`;
        resonatorText += ` | EPd=${formatDiagnosticRatio(metrics.ptModal.epDistance)}`;
      }
      if (leakageAnalysisPresets.has(state.preset) && metrics.leakageRate > 0) {
        resonatorText += ` | leak~${formatFieldValue(metrics.leakageRate)}`;
      }
    }
    let topologicalText = "";
    if (metrics?.sshBloch) {
      topologicalText += ` | W=${metrics.sshBloch.winding} | gap=${formatFieldValue(metrics.sshBloch.bandGap)}`;
      if (metrics.sshBloch.edgeExpected) topologicalText += " | edge";
      if (state.preset === "nonHermitianSsh") topologicalText += ` | nh-gap=${formatFieldValue(metrics.sshBloch.nonHermitianGap)}`;
    }
    if (metrics?.phcBloch) {
      topologicalText += ` | BZ leak=${formatFieldValue(metrics.phcBloch.leakage)} | SF=${formatDiagnosticRatio(metrics.phcBloch.structureFactor)}`;
      if (metrics.phcBloch.modal) {
        topologicalText += ` | PWE b${metrics.phcBloch.modal.basisSize} f1=${formatFieldValue(metrics.phcBloch.modal.fundamentalFrequency)}`;
        if (metrics.phcBloch.modal.bandGap > 0) topologicalText += ` | gap=${formatFieldValue(metrics.phcBloch.modal.bandGap)}`;
        if (metrics.phcBloch.modal.path?.minGap > 0) topologicalText += ` | pathGap=${formatFieldValue(metrics.phcBloch.modal.path.minGap)}`;
      }
      if (leakageAnalysisPresets.has(state.preset)) topologicalText += ` | Qk~${formatFieldValue(metrics.phcBloch.qProxy)}`;
    }
    const absorptionText =
      absorptionAnalysisPresets.has(state.preset) && sim.diagnosticSamples > 8
        ? ` | A~${formatDiagnosticRatio(
            clamp(1 - (sim.diagnosticReflectance || 0) - (sim.diagnosticTransmittance || 0), 0, 1),
          )}`
        : "";
    let nonlinearText = "";
    if (metrics && nonlinearAnalysisPresets.has(state.preset)) {
      if (harmonicAnalysisPresets.has(state.preset)) {
        if (metrics.harmonic2 > 1e-4) nonlinearText += ` | H2~${formatDiagnosticRatio(metrics.harmonic2)}`;
        if (metrics.harmonic3 > 1e-4) nonlinearText += ` | H3~${formatDiagnosticRatio(metrics.harmonic3)}`;
      }
      if (metrics.sidebandRatio > 0.05) {
        nonlinearText += ` | side~${formatDiagnosticRatio(metrics.sidebandRatio)}`;
      }
      if (phaseChangeAnalysisPresets.has(state.preset)) {
        nonlinearText += ` | s~${formatDiagnosticRatio(metrics.phaseAverage)}`;
      }
    }
    const floquetPlusOrder = metrics?.floquet?.orders?.find((channel) => channel.order === 1);
    const floquetText =
      metrics?.floquet && temporalFloquetAnalysisPresets.has(state.preset)
        ? metrics.floquet.scatteringMatrix
          ? ` | DFT T+1=${formatDiagnosticRatio(metrics.floquet.firstUpper)} | T-1=${formatDiagnosticRatio(
              metrics.floquet.firstLower,
            )} | R+1=${formatDiagnosticRatio(floquetPlusOrder?.reflectedAmplitudeRatio || 0)} | Pout=${formatDiagnosticRatio(
              metrics.floquet.scatteringMatrix.totalOutgoingPower,
            )} | m*=${metrics.floquet.maxSidebandOrder}`
          : ` | probe S+1=${formatDiagnosticRatio(metrics.floquet.firstUpper)} | S-1=${formatDiagnosticRatio(
              metrics.floquet.firstLower,
            )} | Pside=${formatDiagnosticRatio(metrics.floquet.sidebandPower)} | m*=${metrics.floquet.maxSidebandOrder}`
        : "";
    const hyperlensText =
      metrics?.hyperlens && state.preset === "hyperlens"
        ? ` | Hout/Hin=${formatDiagnosticRatio(metrics.hyperlens.transfer)} | detail=${formatDiagnosticRatio(
            metrics.hyperlens.detailTransfer,
          )}`
        : "";
    el.analysisStatus.textContent = state.analysisEnabled
      ? `${sampleText} · ${contourText} · f=${formatFieldValue(sim.diagnosticFrequency())}`
      : "Analysis paused.";
    if (state.analysisEnabled) {
      el.analysisStatus.textContent = `${sampleText} | ${contourText} | f=${formatFieldValue(
        sim.diagnosticFrequency(),
      )}${scatteringText}${resonatorText}${topologicalText}${absorptionText}${nonlinearText}${floquetText}${hyperlensText}`;
    }
  }
}

async function runBlochKSweep(scanPoints = buildSweepScanPoints()) {
  if (!blochSweepCompatible()) {
    setSweepStatus("Bloch k sweep is available for photonic-crystal and BIC presets.");
    return;
  }
  const wasRunning = state.running;
  state.running = false;
  state.sweepRunning = true;
  state.sweepCancelRequested = false;
  state.sweepResults = [];
  updateControlText();
  updateStats();
  drawSweepChart();
  let completionMessage = "";

  try {
    for (let pointIndex = 0; pointIndex < scanPoints.length; pointIndex += 1) {
      if (state.sweepCancelRequested) break;
      const point = scanPoints[pointIndex];
      const metrics = sim.phcBlochEstimate(point.value);
      if (!metrics) {
        completionMessage = "Bloch k sweep needs high-index photonic-crystal material in the active scene.";
        break;
      }
      const modal = metrics.modal || {};
      const result = {
        x: metrics.k,
        branch: point.branch,
        branchIndex: point.branchIndex,
        r: 0,
        t: 0,
        blochK: metrics.k,
        blochLeakage: metrics.leakage,
        blochQ: metrics.qProxy,
        blochStructureFactor: metrics.structureFactor,
        blochAsymmetry: metrics.asymmetry,
        blochBandFrequency: metrics.bandFrequency,
        blochSecondBandFrequency: modal.secondBandFrequency || 0,
        blochBandGap: modal.bandGap || 0,
        blochGapRatio: modal.gapRatio || 0,
        blochNormalizedFrequency: modal.normalizedFrequency || 0,
        blochPlaneWaveContrast: modal.inverseEpsContrast || 0,
        blochPlaneWaveFill: modal.fillFraction || 0,
        blochPlaneWaveBasis: modal.basisSize || 0,
        blochPlaneWaveShells: modal.basisShells || 0,
        blochPathGap: modal.path?.minGap || 0,
        blochPathGapRatio: modal.path?.minGapRatio || 0,
        blochPathGapLocation: modal.path?.minGapLabel || "",
        blochPathSamples: modal.path?.pointCount || 0,
        blochPathFirstBandMax: modal.path?.firstBandMax || 0,
        blochPathSecondBandMin: modal.path?.secondBandMin || 0,
        blochGroup: metrics.groupProxy,
        blochAverageEps: metrics.averageEps,
        blochCells: metrics.cells,
        steady: true,
        steadyDrift: 0,
        steadyMetric: "bloch",
        steadySamples: 1,
        steadyTolerance: 0,
      };
      state.sweepResults.push(result);
      drawSweepChart();
      setSweepStatus(
        `Recorded ${pointIndex + 1}/${scanPoints.length}: rad=${formatDiagnosticRatio(result.blochLeakage)}, Qk=${formatFieldValue(
          result.blochQ,
        )}, f1=${formatFieldValue(result.blochBandFrequency)}, pathGap=${formatFieldValue(result.blochPathGap)}`,
      );
      await nextAnimationFrame();
    }
  } finally {
    const cancelled = state.sweepCancelRequested;
    const pointLabel = state.sweepResults.length === 1 ? "point" : "points";
    state.running = wasRunning && !cancelled;
    state.sweepRunning = false;
    state.sweepCancelRequested = false;
    updateControlText();
    updateStats();
    sim.render();
    drawSweepChart();
    setSweepStatus(
      completionMessage ||
        (cancelled
          ? `Bloch k sweep cancelled. ${state.sweepResults.length} ${pointLabel} recorded.`
          : `Bloch k sweep complete. ${state.sweepResults.length} ${pointLabel} recorded.`),
    );
  }
}

async function runSweep() {
  if (state.sweepRunning) {
    state.sweepCancelRequested = true;
    setSweepStatus("Cancelling sweep...");
    return;
  }

  syncSweepStateFromInputs();
  const scanPoints = buildSweepScanPoints();
  if (state.sweepMode === "blochK") {
    if (!blochSweepCompatible()) {
      setSweepStatus("Bloch k sweep is available for photonic-crystal and BIC presets.");
      return;
    }
    await runBlochKSweep(scanPoints);
    return;
  }
  if (state.sweepMode === "gainLoss" && !gainLossSweepCompatible()) {
    setSweepStatus("Gain/loss sweep is available for PT and exceptional-point presets.");
    return;
  }
  if (state.sweepMode === "symmetry" && !symmetrySweepCompatible()) {
    setSweepStatus("Symmetry sweep is available for BIC and quasi-BIC photonic-crystal presets.");
    return;
  }
  if (state.sweepMode === "direction" && !directionSweepCompatible()) {
    setSweepStatus("Direction sweep is available for traveling-modulation and nonreciprocal presets.");
    return;
  }
  const target = sweepSourceTarget();
  if (!target) {
    setSweepStatus("Add a source before running a sweep.");
    return;
  }

  const sourceSnapshots = state.sources.map((source) => ({ ...source }));
  const lossSweepSnapshot = state.sweepMode === "gainLoss" ? gainLossSweepSnapshot() : null;
  const symmetryMaterialSnapshot = state.sweepMode === "symmetry" ? symmetrySweepSnapshot() : null;
  const selectedSourceId = state.selectedSourceId;
  const sourceDefaults = { ...state.sourceDefaults };
  const diagnosticsEnabled = state.diagnosticsEnabled;
  const fieldComponentSnapshot = state.fieldComponent;
  const wasRunning = state.running;
  const dualPolarization = dualPolarizationSweepEnabled();
  const memorySweep = bidirectionalSweepActive();

  state.running = false;
  state.diagnosticsEnabled = true;
  state.sweepRunning = true;
  state.sweepCancelRequested = false;
  state.sweepResults = [];
  updateControlText();
  updateStats();
  sim.render();

  try {
    const runSingleSweepSimulation = async (
      value,
      pointIndex,
      component = state.fieldComponent,
      label = "",
      preserveFields = false,
    ) => {
      state.fieldComponent = component === "hz" ? "hz" : "ez";
      const activeTarget = sweepSourceTarget();
      if (!activeTarget) return null;

      if (state.sweepMode === "frequency") {
        const frequency = clampSweepRangeForMode("frequency", value);
        state.sources.forEach((source) => {
          source.type = "sine";
          source.frequency = frequency;
          normalizeSource(source);
        });
      } else if (state.sweepMode === "amplitude") {
        activeTarget.amplitude = clampSweepRangeForMode("amplitude", value);
        normalizeSource(activeTarget);
      } else if (state.sweepMode === "gainLoss") {
        applyGainLossSweepValue(lossSweepSnapshot, value);
      } else if (state.sweepMode === "symmetry") {
        applySymmetrySweepValue(symmetryMaterialSnapshot, value);
      } else if (state.sweepMode === "direction") {
        applyDirectionSweepValue(activeTarget, value);
      } else {
        activeTarget.type = "sine";
        activeTarget.angleDeg = ((clampSweepRangeForMode("angle", value) % 360) + 360) % 360;
        normalizeSource(activeTarget);
      }
      state.sourceDefaults = { ...activeTarget };
      delete state.sourceDefaults.id;

      if (!preserveFields) sim.resetFields();
      sim.resetDiagnostics();
      if (state.sweepMode === "gainLoss") {
        applyGainLossSweepValue(lossSweepSnapshot, value);
      } else if (state.sweepMode === "symmetry") {
        applySymmetrySweepValue(symmetryMaterialSnapshot, value);
      }
      const labelText = label ? ` ${label}` : "";
      setSweepStatus(
        `Point ${pointIndex + 1}/${scanPoints.length}${labelText}: ${sweepModeLabel()}=${formatSweepValue(value)}${sweepUnitLabel()}`,
      );
      updateControlText();

      let stepsDone = 0;
      const steadyHistory = [];
      while (stepsDone < state.sweepSteps) {
        if (state.sweepCancelRequested) break;
        const chunk = Math.min(36, state.sweepSteps - stepsDone);
        for (let step = 0; step < chunk; step += 1) {
          sim.step();
        }
        stepsDone += chunk;
        sim.measure();
        const steadyMetrics = state.analysisEnabled ? sim.analysisMetricEstimate() : null;
        steadyHistory.push(sweepSteadyObservation(steadyMetrics));
        updateStats();
        if (stepsDone % 144 === 0 || stepsDone >= state.sweepSteps) {
          sim.render();
          await nextAnimationFrame();
        }
      }

      if (state.sweepCancelRequested) return null;
      sim.measure();
      const metrics = sim.analysisMetricEstimate();
      const steadyEstimate = sweepSteadyEstimate(steadyHistory);
      const floquetOrders = metrics?.floquet?.orders || [];
      const floquetOrder = (order) => floquetOrders.find((channel) => channel.order === order);
      const floquetMatrix = metrics?.floquet?.scatteringMatrix || null;
      return {
        r: sim.diagnosticReflectance || 0,
        t: sim.diagnosticTransmittance || 0,
        pInc: sim.diagnosticIncidentPower || 0,
        pRef: sim.diagnosticReflectedPower || 0,
        pTrn: sim.diagnosticTransmittedPower || 0,
        h2: metrics?.harmonic2 || 0,
        h3: metrics?.harmonic3 || 0,
        sideband: metrics?.sidebandRatio || 0,
        floquetCarrier: metrics?.floquet?.carrierFrequency || 0,
        floquetOmega: metrics?.floquet?.modulationFrequency || 0,
        floquetSMinus2: floquetOrder(-2)?.amplitudeRatio || 0,
        floquetSMinus1: metrics?.floquet?.firstLower || 0,
        floquetS0: floquetOrder(0)?.amplitudeRatio || 0,
        floquetSPlus1: metrics?.floquet?.firstUpper || 0,
        floquetSPlus2: floquetOrder(2)?.amplitudeRatio || 0,
        floquetRMinus2: floquetOrder(-2)?.reflectedAmplitudeRatio || 0,
        floquetRMinus1: floquetOrder(-1)?.reflectedAmplitudeRatio || 0,
        floquetR0: floquetOrder(0)?.reflectedAmplitudeRatio || 0,
        floquetRPlus1: floquetOrder(1)?.reflectedAmplitudeRatio || 0,
        floquetRPlus2: floquetOrder(2)?.reflectedAmplitudeRatio || 0,
        floquetTPhasePlus1: floquetOrder(1)?.transmittedPhaseRad || 0,
        floquetRPhasePlus1: floquetOrder(1)?.reflectedPhaseRad || 0,
        floquetPowerTotal: floquetMatrix?.totalOutgoingPower || 0,
        floquetPowerTransmitted: floquetMatrix?.totalTransmittedPower || 0,
        floquetPowerReflected: floquetMatrix?.totalReflectedPower || 0,
        floquetPowerSideband: metrics?.floquet?.sidebandPower || 0,
        floquetPowerReflectedSideband: metrics?.floquet?.reflectedSidebandPower || 0,
        floquetPowerUp: metrics?.floquet?.upPower || 0,
        floquetPowerDown: metrics?.floquet?.downPower || 0,
        floquetMaxSideband: metrics?.floquet?.maxSidebandRatio || 0,
        floquetMaxOrder: metrics?.floquet?.maxSidebandOrder || 0,
        floquetMethod: metrics?.floquet?.portDft ? "port-dft" : metrics?.floquet ? "probe-dft" : "",
        hyperlensTransfer: metrics?.hyperlens?.transfer || 0,
        hyperlensDetailTransfer: metrics?.hyperlens?.detailTransfer || 0,
        hyperlensInnerEnergy: metrics?.hyperlens?.innerEnergy || 0,
        hyperlensOuterEnergy: metrics?.hyperlens?.outerEnergy || 0,
        phaseState: metrics?.phaseAverage || 0,
        split: metrics?.split || 0,
        spectralSplit: metrics?.spectralSplit || 0,
        ptGamma: metrics?.ptModal?.gamma || 0,
        ptCoupling: metrics?.ptModal?.coupling || 0,
        ptGammaOverKappa: metrics?.ptModal?.normalizedGamma || 0,
        epDistance: metrics?.ptModal?.epDistance || 0,
        epCoalescence: metrics?.ptModal?.coalescence || 0,
        modalSplitReal: metrics?.ptModal?.realSplit || 0,
        modalSplitImag: metrics?.ptModal?.imagSplit || 0,
        epPhase: metrics?.ptModal?.phase || "",
        sshWinding: metrics?.sshBloch?.winding ?? 0,
        sshBandGap: metrics?.sshBloch?.bandGap || 0,
        sshNonHermitianGap: metrics?.sshBloch?.nonHermitianGap || 0,
        sshEdgeExpected: metrics?.sshBloch?.edgeExpected ? 1 : 0,
        leakage: metrics?.leakageRate || 0,
        q: metrics?.ringdown?.q || 0,
        steady: steadyEstimate.steady,
        steadyDrift: steadyEstimate.drift,
        steadyMetric: steadyEstimate.key,
        steadySamples: steadyEstimate.samples,
        steadyTolerance: steadyEstimate.tolerance,
      };
    };

    for (let pointIndex = 0; pointIndex < scanPoints.length; pointIndex += 1) {
      if (state.sweepCancelRequested) break;
      const point = scanPoints[pointIndex];
      const value = point.value;
      const preserveFields = memorySweep && pointIndex > 0;

      if (dualPolarization) {
        const tm = await runSingleSweepSimulation(value, pointIndex, "hz", "TM");
        if (state.sweepCancelRequested || !tm) break;
        const te = await runSingleSweepSimulation(value, pointIndex, "ez", "TE");
        if (state.sweepCancelRequested || !te) break;
        const result = {
          x: value,
          branch: point.branch,
          r: tm.r,
          t: tm.t,
          rTm: tm.r,
          tTm: tm.t,
          rTe: te.r,
          tTe: te.t,
          pIncTm: tm.pInc,
          pRefTm: tm.pRef,
          pTrnTm: tm.pTrn,
          pIncTe: te.pInc,
          pRefTe: te.pRef,
          pTrnTe: te.pTrn,
          steady: Boolean(tm.steady && te.steady),
          steadyDrift: Math.max(tm.steadyDrift || 0, te.steadyDrift || 0),
          steadyMetric: (tm.steadyDrift || 0) >= (te.steadyDrift || 0) ? `TM:${tm.steadyMetric}` : `TE:${te.steadyMetric}`,
          steadySamples: Math.min(tm.steadySamples || 0, te.steadySamples || 0),
          steadyTolerance: Math.max(tm.steadyTolerance || 0, te.steadyTolerance || 0),
        };
        state.sweepResults.push(result);
        drawSweepChart();
        setSweepStatus(
          `Recorded ${pointIndex + 1}/${scanPoints.length}: R_TM=${formatDiagnosticRatio(result.rTm)}, R_TE=${formatDiagnosticRatio(result.rTe)}${
            result.steady ? " | steady" : ` | drift=${formatSweepDrift(result.steadyDrift)}`
          }`,
        );
        await nextAnimationFrame();
        continue;
      }

      const single = await runSingleSweepSimulation(value, pointIndex, state.fieldComponent, point.branch, preserveFields);
      if (state.sweepCancelRequested || !single) break;
      const result = {
        x: value,
        branch: point.branch,
        branchIndex: point.branchIndex,
        direction: state.sweepMode === "direction" ? point.branch : "",
        ...single,
      };
      state.sweepResults.push(result);
      drawSweepChart();
      setSweepStatus(sweepResultStatusText(result, pointIndex, scanPoints.length));
      await nextAnimationFrame();
    }
  } finally {
    const cancelled = state.sweepCancelRequested;
    const pointLabel = state.sweepResults.length === 1 ? "point" : "points";
    restoreGainLossSweepSnapshot(lossSweepSnapshot);
    restoreSymmetrySweepSnapshot(symmetryMaterialSnapshot);
    state.sources = sourceSnapshots.map((source) => ({ ...source }));
    state.selectedSourceId = selectedSourceId;
    state.sourceDefaults = { ...sourceDefaults };
    state.diagnosticsEnabled = diagnosticsEnabled;
    state.fieldComponent = fieldComponentSnapshot;
    state.running = wasRunning && !cancelled;
    state.sweepRunning = false;
    state.sweepCancelRequested = false;
    sim.resetFields();
    sim.resetDiagnostics();
    sim.measure();
    updateControlText();
    updateStats();
    sim.render();
    drawSweepChart();
    const isolation = directionSweepIsolationEstimate();
    if (isolation) {
      state.sweepResults.forEach((result) => {
        result.tForward = isolation.tForward;
        result.tReverse = isolation.tReverse;
        result.isolationDb = isolation.isolationDb;
      });
    }
    const driftingCount = state.sweepResults.filter((result) => result.steady === false).length;
    const driftText =
      driftingCount > 0
        ? ` ${driftingCount} ${driftingCount === 1 ? "point is" : "points are"} still drifting; increase steps / point.`
        : state.sweepResults.length > 0
          ? ` All points steady within ${formatSweepDrift(SWEEP_STEADY_TOLERANCE)}.`
          : "";
    const isolationText = isolation
      ? ` Isolation ${formatIsolationDb(isolation.isolationDb)} (Tf=${formatDiagnosticRatio(isolation.tForward)}, Tr=${formatDiagnosticRatio(
          isolation.tReverse,
        )}).`
      : "";
    setSweepStatus(
      cancelled
        ? `Sweep cancelled. ${state.sweepResults.length} ${pointLabel} recorded.${driftText}${isolationText}`
        : `Sweep complete. ${state.sweepResults.length} ${pointLabel} recorded.${driftText}${isolationText}`,
    );
  }
}

function csvCell(value) {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? value.toPrecision(10) : "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function safeFilePart(text) {
  return String(text || "scene")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "scene";
}

function clonePlainData(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
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
  const snapshot = {};
  for (const key of SERIALIZABLE_STATE_KEYS) {
    snapshot[key] = clonePlainData(state[key]);
  }
  return snapshot;
}

function snapshotDrawnMaterialCells() {
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
  return {
    kind: "fdtd-2d-scene",
    version: SCENE_SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    grid: { nx: sim.nx, ny: sim.ny },
    view: {
      x: sim.viewX,
      y: sim.viewY,
      zoom: sim.viewZoom,
    },
    state: serializableStateSnapshot(),
    materials: includeMaterials ? snapshotDrawnMaterialCells() : undefined,
  };
}

function downloadTextFile(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeImportedStateValues() {
  state.theme = normalizeTheme(state.theme);
  state.stepsPerFrame = clamp(Number(state.stepsPerFrame) || 1, 0.2, 12);
  state.gain = clamp(Number(state.gain) || 1, 0.1, 10);
  state.autoScale = Boolean(state.autoScale);
  state.fieldComponent = state.fieldComponent === "hz" ? "hz" : "ez";
  state.fieldDisplay = ["scalar", "transverseX", "transverseY", "electricMag", "magneticMag"].includes(state.fieldDisplay)
    ? state.fieldDisplay
    : "scalar";
  state.fieldQuiver = Boolean(state.fieldQuiver);
  state.diagnosticsEnabled = Boolean(state.diagnosticsEnabled);
  state.visualProfile = normalizedVisualProfile(state.visualProfile);
  Object.values(VISUAL_LAYER_STATE_KEYS).forEach((stateKey) => {
    state[stateKey] = state[stateKey] == null ? true : Boolean(state[stateKey]);
  });
  state.analysisEnabled = Boolean(state.analysisEnabled);
  state.analysisSampleEvery = clampInt(state.analysisSampleEvery, 1, 16);
  state.sweepMode = normalizeSweepMode(state.sweepMode);
  state.sweepSamples = clampInt(state.sweepSamples, 3, 41);
  state.sweepSteps = clampInt(state.sweepSteps, 120, 4000);
  state.sweepBidirectional = Boolean(state.sweepBidirectional);
  state.viewMode = ["field", "epsilon", "mu", "poynting"].includes(state.viewMode) ? state.viewMode : "field";
  state.viewProjection = state.viewProjection === "3d" ? "3d" : "2d";
  state.materialPart = state.materialPart === "imag" ? "imag" : "real";
  state.canvasMode = state.canvasMode === "brush" ? "brush" : "select";
  state.wavelengthUm = clamp(Number(state.wavelengthUm) || 1, 0.1, 10);
  state.cellsPerWavelength = clampInt(state.cellsPerWavelength, 8, 80);
  state.gridNx = clampInt(state.gridNx, 80, MAX_GRID.nx);
  state.gridNy = clampInt(state.gridNy, 60, MAX_GRID.ny);
  state.boundary = normalizeBoundaryMode(state.boundary);
  normalizeBoundarySides();
  if (!knownPresetValue(state.preset)) state.preset = "empty";
  state.slabThicknessLambda = clamp(Number(state.slabThicknessLambda) || 0.5, 0.05, 20);
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
  state.brush = Object.prototype.hasOwnProperty.call(materialNames, state.brush) ? state.brush : "custom";
  state.brushTool = state.brushTool === "geometry" ? "geometry" : "paint";
  normalizeBrushGeometryState();
}

function sanitizeImportedSources(importedState) {
  const rawSources = Array.isArray(importedState.sources) ? importedState.sources.slice(0, 32) : [];
  const usedIds = new Set();
  const sources = rawSources.map((rawSource, index) => {
    const source = normalizeSource({
      ...defaultSourceConfig,
      ...(rawSource && typeof rawSource === "object" ? rawSource : {}),
    });
    const rawId = Number(rawSource?.id);
    let id = Number.isFinite(rawId) && rawId > 0 ? Math.round(rawId) : index + 1;
    while (usedIds.has(id)) id += 1;
    usedIds.add(id);
    source.id = id;
    return source;
  });
  if (sources.length === 0) {
    sources.push(normalizeSource({ id: 1, ...defaultSourceConfig }));
  }
  state.sources = sources;
  const selectedId = Number(importedState.selectedSourceId);
  state.selectedSourceId = sources.some((source) => source.id === selectedId) ? selectedId : sources[0].id;
  const defaultSource = normalizeSource({
    ...defaultSourceConfig,
    ...(importedState.sourceDefaults && typeof importedState.sourceDefaults === "object" ? importedState.sourceDefaults : sources[0]),
  });
  delete defaultSource.id;
  state.sourceDefaults = defaultSource;
  const importedNextId = Number(importedState.nextSourceId);
  state.nextSourceId = Math.max(Number.isFinite(importedNextId) ? Math.round(importedNextId) : 1, ...sources.map((source) => source.id + 1));
}

function applySceneState(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Invalid scene JSON.");
  }
  disableResponsiveGridOrientation();
  const importedState = snapshot.state && typeof snapshot.state === "object" ? snapshot.state : {};
  const grid = snapshot.grid && typeof snapshot.grid === "object" ? snapshot.grid : {};
  for (const key of SERIALIZABLE_STATE_KEYS) {
    if (key === "sources" || key === "sourceDefaults" || key === "selectedSourceId" || key === "nextSourceId") continue;
    if (Object.prototype.hasOwnProperty.call(importedState, key)) {
      state[key] = clonePlainData(importedState[key]);
    }
  }
  state.gridNx = clampInt(grid.nx ?? importedState.gridNx ?? state.gridNx, 80, MAX_GRID.nx);
  state.gridNy = clampInt(grid.ny ?? importedState.gridNy ?? state.gridNy, 60, MAX_GRID.ny);
  normalizeImportedStateValues();
  document.documentElement.dataset.theme = state.theme;
  if (el.presetInput) el.presetInput.value = state.preset;
  clearMaterialSelection(false);
  clearCanvasHover(false);
  closeContextMenus();
  state.sweepResults = [];
  state.sweepRunning = false;
  state.sweepCancelRequested = false;
  sim.resize(state.gridNx, state.gridNy);
  sanitizeImportedSources(importedState);
  if (Array.isArray(snapshot.materials)) {
    sim.clearMaterials(false);
    snapshot.materials.forEach((cell) => {
      if (!cell || typeof cell !== "object") return;
      sim.writeMaterialCell(clampInt(cell.x, 1, sim.nx - 2), clampInt(cell.y, 1, sim.ny - 2), cell);
    });
    sim.refreshPmlMaterialContinuation(false);
  } else {
    sim.applyPreset(state.preset);
  }
  if (snapshot.view && typeof snapshot.view === "object") {
    sim.viewZoom = clamp(Number(snapshot.view.zoom) || 1, 1, sim.maxViewZoom());
    sim.viewX = Number(snapshot.view.x) || 0;
    sim.viewY = Number(snapshot.view.y) || 0;
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

function encodeSceneSnapshot(snapshot) {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeSceneSnapshot(encoded) {
  const padded = String(encoded || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(String(encoded || "").length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function downloadSceneJson() {
  const snapshot = exportSceneState({ includeMaterials: true });
  downloadTextFile(`fdtd-scene-${safeFilePart(state.preset)}.json`, JSON.stringify(snapshot, null, 2));
  setReproStatus(`Exported JSON with ${snapshot.materials.length} material cells.`);
}

async function importSceneJsonFile(file) {
  if (!file) return;
  try {
    const snapshot = JSON.parse(await file.text());
    applySceneState(snapshot);
    setReproStatus(`Imported ${file.name || "scene JSON"}.`);
  } catch (error) {
    console.warn("Scene import failed", error);
    setReproStatus(`Import failed: ${error.message || "invalid JSON"}.`, true);
  }
}

async function copyTextToClipboard(text) {
  let clipboardError = null;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      clipboardError = error;
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  window.focus();
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw clipboardError || new Error("Clipboard unavailable");
  }
}

async function copySceneUrl() {
  let urlText = "";
  let lightweight = false;
  try {
    let snapshot = exportSceneState({ includeMaterials: true });
    let encoded = encodeSceneSnapshot(snapshot);
    if (encoded.length > SCENE_SHARE_URL_LIMIT) {
      snapshot = exportSceneState({ includeMaterials: false });
      encoded = encodeSceneSnapshot(snapshot);
      lightweight = true;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("scene", encoded);
    urlText = url.toString();
    await copyTextToClipboard(urlText);
    if (el.shareSceneUrlOutput) {
      el.shareSceneUrlOutput.hidden = true;
      el.shareSceneUrlOutput.value = "";
    }
    setReproStatus(
      lightweight
        ? "Copied lightweight URL with parameters and preset; use JSON for drawn-cell exactness."
        : "Copied URL with full scene state.",
    );
  } catch (error) {
    console.warn("Scene URL copy failed", error);
    if (urlText && el.shareSceneUrlOutput) {
      el.shareSceneUrlOutput.value = urlText;
      el.shareSceneUrlOutput.hidden = false;
      el.shareSceneUrlOutput.focus({ preventScroll: true });
      el.shareSceneUrlOutput.select();
      setReproStatus(
        lightweight
          ? "Clipboard blocked; lightweight URL generated below. Use JSON for drawn-cell exactness."
          : "Clipboard blocked; URL generated below.",
        true,
      );
      return;
    }
    setReproStatus(`Copy failed: ${error.message || "clipboard unavailable"}.`, true);
  }
}

function loadSceneFromUrlParam() {
  const encoded = new URLSearchParams(window.location.search).get("scene");
  if (!encoded) return false;
  try {
    applySceneState(decodeSceneSnapshot(encoded));
    setReproStatus("Loaded scene from URL.");
    return true;
  } catch (error) {
    console.warn("Shared scene URL failed", error);
    setReproStatus("Shared scene URL could not be loaded.", true);
    return false;
  }
}

function exportSweepCsv() {
  const results = state.sweepResults || [];
  if (results.length === 0) {
    setSweepStatus("Run a sweep before exporting CSV data.");
    return;
  }
  const optionalColumns = [
    "r",
    "t",
    "pInc",
    "pRef",
    "pTrn",
    "rTm",
    "tTm",
    "rTe",
    "tTe",
    "pIncTm",
    "pRefTm",
    "pTrnTm",
    "pIncTe",
    "pRefTe",
    "pTrnTe",
    "h2",
    "h3",
    "sideband",
    "floquetCarrier",
    "floquetOmega",
    "floquetSMinus2",
    "floquetSMinus1",
    "floquetS0",
    "floquetSPlus1",
    "floquetSPlus2",
    "floquetRMinus2",
    "floquetRMinus1",
    "floquetR0",
    "floquetRPlus1",
    "floquetRPlus2",
    "floquetTPhasePlus1",
    "floquetRPhasePlus1",
    "floquetPowerTotal",
    "floquetPowerTransmitted",
    "floquetPowerReflected",
    "floquetPowerSideband",
    "floquetPowerReflectedSideband",
    "floquetPowerUp",
    "floquetPowerDown",
    "floquetMaxSideband",
    "floquetMaxOrder",
    "floquetMethod",
    "hyperlensTransfer",
    "hyperlensDetailTransfer",
    "hyperlensInnerEnergy",
    "hyperlensOuterEnergy",
    "phaseState",
    "split",
    "spectralSplit",
    "ptGamma",
    "ptCoupling",
    "ptGammaOverKappa",
    "epDistance",
    "epCoalescence",
    "modalSplitReal",
    "modalSplitImag",
    "sshWinding",
    "sshBandGap",
    "sshNonHermitianGap",
    "sshEdgeExpected",
    "blochK",
    "blochLeakage",
    "blochQ",
    "blochStructureFactor",
    "blochAsymmetry",
    "blochBandFrequency",
    "blochSecondBandFrequency",
    "blochBandGap",
    "blochGapRatio",
    "blochNormalizedFrequency",
    "blochPlaneWaveContrast",
    "blochPlaneWaveFill",
    "blochPlaneWaveBasis",
    "blochPlaneWaveShells",
    "blochPathGap",
    "blochPathGapRatio",
    "blochPathGapLocation",
    "blochPathSamples",
    "blochPathFirstBandMax",
    "blochPathSecondBandMin",
    "blochGroup",
    "blochAverageEps",
    "blochCells",
    "leakage",
    "q",
    "tForward",
    "tReverse",
    "isolationDb",
  ];
  const columns = [
    "index",
    "preset",
    "sweepMode",
    "branch",
    "direction",
    "epPhase",
    "branchIndex",
    "x",
    "steady",
    "steadyDrift",
    "steadyMetric",
    "steadySamples",
    "steadyTolerance",
    ...optionalColumns.filter((key) =>
      results.some((row) => Number.isFinite(row[key]) || (typeof row[key] === "string" && row[key].length > 0)),
    ),
  ];
  const lines = [
    columns.join(","),
    ...results.map((row, index) =>
      columns
        .map((column) => {
          if (column === "index") return csvCell(index);
          if (column === "preset") return csvCell(state.preset);
          if (column === "sweepMode") return csvCell(state.sweepMode);
          return csvCell(row[column]);
        })
        .join(","),
    ),
  ];
  const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fdtd-sweep-${safeFilePart(state.preset)}-${safeFilePart(state.sweepMode)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setSweepStatus(`Exported ${results.length} sweep rows to CSV.`);
}

function formatLogValue(logValue) {
  if (logValue === -Infinity) return "0";
  if (!Number.isFinite(logValue)) return "overflow";
  const exponent = Math.floor(logValue);
  const mantissa = Math.pow(10, logValue - exponent);
  return `${mantissa.toFixed(2)}e${exponent >= 0 ? "+" : ""}${exponent}`;
}

function formatFieldMetric(value, logValue) {
  if (Number.isFinite(value)) return formatFieldValue(value);
  return formatLogValue(logValue);
}

function formatFieldValue(value) {
  if (!Number.isFinite(value)) return "overflow";
  const abs = Math.abs(value);
  if (abs >= 10000) return value.toExponential(2);
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  if (abs >= 0.01) return value.toFixed(3);
  return value.toExponential(1);
}

function formatMaterialMapValue(value) {
  if (!Number.isFinite(value)) return "overflow";
  const abs = Math.abs(value);
  if (abs < 1e-9) return "0";
  if (abs >= 10000) return value.toExponential(2);
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  if (abs >= 0.01) return value.toFixed(3);
  return value.toExponential(1);
}

function formatSignedMaterialMapValue(value) {
  const formatted = formatMaterialMapValue(value);
  return value > 0 && formatted !== "0" && formatted !== "overflow" ? `+${formatted}` : formatted;
}

function updateColorbar() {
  if (!el.colorbar) return;
  el.colorbar.hidden = !visualLayerEnabled("colorbar");
  if (el.colorbar.hidden) return;

  if (state.viewMode === "epsilon" || state.viewMode === "mu") {
    const center = Number.isFinite(sim.lastMaterialViewCenter)
      ? sim.lastMaterialViewCenter
      : state.materialPart === "imag"
        ? 0
        : 1;
    const min = Number.isFinite(sim.lastMaterialViewMin) ? sim.lastMaterialViewMin : center - 1;
    const max = Number.isFinite(sim.lastMaterialViewMax) ? sim.lastMaterialViewMax : center + 1;
    const span = Math.max(1e-9, max - min);
    const centerStop = clamp(((max - center) / span) * 100, 0, 100);
    const formatBound = state.materialPart === "imag" ? formatSignedMaterialMapValue : formatMaterialMapValue;
    const symbol = state.viewMode === "mu" ? "&mu;" : "&epsilon;";
    const materialContext = { center, min, max };
    const materialMapName = currentMaterialColormapName(materialContext);
    const materialMapSigned = state.materialPart === "imag" || (min < center && max > center);
    el.colorbarTitle.innerHTML = `${state.materialPart === "imag" ? "Im" : "Re"}(${symbol})`;
    if (!materialMapSigned) {
      el.colorbarMax.textContent = formatBound(max);
      el.colorbarMid.textContent = formatBound((min + max) * 0.5);
      el.colorbarMin.textContent = formatBound(min);
      el.colorbarGradient.style.background = cmasherGradient(materialMapName);
    } else if (centerStop >= 99.9) {
      el.colorbarMax.textContent = formatBound(max);
      el.colorbarMid.textContent = formatBound((max + center) * 0.5);
      el.colorbarMin.textContent = formatMaterialMapValue(center);
      el.colorbarGradient.style.background = cmasherGradient(materialMapName);
    } else if (centerStop <= 0.1) {
      el.colorbarMax.textContent = formatMaterialMapValue(center);
      el.colorbarMid.textContent = formatBound((min + center) * 0.5);
      el.colorbarMin.textContent = formatBound(min);
      el.colorbarGradient.style.background = cmasherGradient(materialMapName);
    } else {
      el.colorbarMax.textContent = formatBound(max);
      el.colorbarMid.textContent = formatMaterialMapValue(center);
      el.colorbarMin.textContent = formatBound(min);
      el.colorbarGradient.style.background = cmasherGradient(materialMapName);
    }
    el.colorbarGradient.classList.add("is-epsilon-map");
    return;
  }

  const range = sim.lastViewRange || 1;
  const displayConfig = fieldDisplayConfig();
  el.colorbarTitle.innerHTML = `${displayConfig.labelHtml} / ${displayConfig.unitHtml}`;
  if (displayConfig.magnitude) {
    el.colorbarMax.textContent = formatFieldMetric(range, sim.lastViewRangeLog10);
    el.colorbarMid.textContent = formatFieldMetric(range * 0.5, sim.lastViewRangeLog10 + Math.log10(0.5));
    el.colorbarMin.textContent = "0";
  } else {
    el.colorbarMax.textContent = `+${formatFieldMetric(range, sim.lastViewRangeLog10)}`;
    el.colorbarMid.textContent = "0";
    el.colorbarMin.textContent = `-${formatFieldMetric(range, sim.lastViewRangeLog10)}`;
  }
  el.colorbarGradient.style.background = cmasherGradient(currentFieldColormapName(displayConfig.magnitude));
  el.colorbarGradient.classList.remove("is-epsilon-map");
}

function animate() {
  if (state.running) {
    simStepAccumulator += state.stepsPerFrame;
    const stepsThisFrame = Math.floor(simStepAccumulator);
    simStepAccumulator -= stepsThisFrame;
    for (let i = 0; i < stepsThisFrame; i += 1) {
      sim.step();
    }
    framesSinceMeasure += 1;
    if (framesSinceMeasure >= 4) {
      sim.measure();
      updateStats();
      framesSinceMeasure = 0;
    }
  }
  sim.render();
  requestAnimationFrame(animate);
}

function canvasToGrid(event) {
  return sim.clientToGridCell(event.clientX, event.clientY);
}

function paintFromEvent(event) {
  disableResponsiveGridOrientation();
  clearMaterialSelection(false);
  const point = canvasToGrid(event);
  sim.paint(point.x, point.y, Math.max(1, lambdaToCells(state.brushSizeLambda)), state.brush);
  sim.refreshPmlMaterialContinuation(false);
  sim.render();
}

function insertGeometryFromEvent(event) {
  disableResponsiveGridOrientation();
  clearMaterialSelection(false);
  normalizeBrushGeometryState();
  const point = canvasToGrid(event);
  const region = sim.insertBrushGeometry(point.x, point.y, state.brush, {
    geometry: state.brushGeometry,
    widthLambda: state.geometryWidthLambda,
    heightLambda: state.geometryHeightLambda,
    radiusLambda: state.geometryRadiusLambda,
    innerRadiusLambda: state.geometryInnerRadiusLambda,
  });
  selectedMaterialRegion = region;
  if (region) {
    state.selectedSourceId = null;
  }
  sim.measure();
  updateControlText();
  updateStats();
  sim.render();
}

el.playPauseBtn.addEventListener("click", () => {
  state.running = !state.running;
  updateControlText();
});

function advanceOneStep() {
  sim.step();
  sim.measure();
  updateStats();
  sim.render();
}

function resetSimulationFields() {
  sim.resetFields();
  sim.measure();
  updateStats();
  sim.render();
}

el.stepBtn.addEventListener("click", advanceOneStep);
el.runStepBtn?.addEventListener("click", advanceOneStep);
el.resetBtn.addEventListener("click", resetSimulationFields);
el.runResetBtn?.addEventListener("click", resetSimulationFields);

el.saveBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `fdtd-2d-step-${sim.time}.png`;
  link.href = el.canvas.toDataURL("image/png");
  link.click();
});

el.selectModeBtn.addEventListener("click", () => {
  setCanvasMode("select");
});

el.brushModeBtn.addEventListener("click", () => {
  setCanvasMode("brush");
});

el.canvasFocusBtn?.addEventListener("click", toggleCanvasFocusMode);
el.canvasFocusExitBtn?.addEventListener("click", () => setCanvasFocusMode(false));
el.focusControlsBtn?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleControlDrawer();
});
el.controlDrawerToggle?.addEventListener("click", toggleControlDrawer);
el.controlDrawerCloseBtn?.addEventListener("click", closeControlDrawer);
el.controlDrawerBackdrop?.addEventListener("click", closeControlDrawer);
el.canvasActionToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleCanvasActionsMenu();
});
el.canvasActionMenu?.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("button")) {
    window.setTimeout(closeCanvasActionsMenu, 0);
  }
});
el.canvasOptionsToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleCanvasOptionsMenu();
});
el.canvasViewControls?.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest(".visual-layer-switch")) return;
  if (event.target.closest("button, input")) {
    window.setTimeout(closeCanvasOptionsMenu, 0);
  }
});

el.controlTabButtons?.forEach((button) => {
  button.addEventListener("click", () => {
    activateControlTab(button.dataset.controlTab);
  });
  button.addEventListener("keydown", handleControlTabKeydown);
});

el.controlPanelNextBtn?.addEventListener("click", () => {
  activateMobileLayer(el.controlPanelNextBtn.dataset.nextLayer || "simulation");
});

el.mobileLayerButtons?.forEach((button) => {
  button.addEventListener("click", () => {
    activateMobileLayer(button.dataset.mobileLayer);
  });
});

el.sceneSearchInput?.addEventListener("input", () => {
  renderSceneCards();
});

el.inspectorEditBtn?.addEventListener("click", () => {
  const source = explicitlySelectedSource();
  if (selectedMaterialRegion) {
    const point = materialRegionClientPoint(selectedMaterialRegion);
    openBrushMenuAt(point.x, point.y, { mode: "region" });
    return;
  }
  if (source) {
    const point = sourceClientPoint(source);
    openSourceMenuAt(point.x, point.y, source);
  }
});

el.inspectorClearBtn?.addEventListener("click", () => {
  state.selectedSourceId = null;
  clearMaterialSelection(false);
  updateControlText();
  sim.render();
});

el.selectionSheetEditBtn?.addEventListener("click", () => {
  el.inspectorEditBtn?.click();
});

el.selectionSheetClearBtn?.addEventListener("click", () => {
  el.inspectorClearBtn?.click();
});

el.themeButtons?.forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.themeChoice);
  });
});

el.uiDepthButtons?.forEach((button) => {
  button.addEventListener("click", () => {
    applyUiDepth(button.dataset.uiDepthChoice);
  });
});

el.sourceApplyBtn.addEventListener("click", () => {
  applySourceMenu();
});

el.sourceDeleteBtn.addEventListener("click", () => {
  const source = selectedSource();
  if (source) {
    disableResponsiveGridOrientation();
    deleteSource(source.id);
    closeSourceMenu();
    updateControlText();
    sim.render();
  }
});

el.sourceCloseBtn.addEventListener("click", () => {
  closeSourceMenu();
  sim.render();
});

el.speedInput.addEventListener("input", () => {
  state.stepsPerFrame = clamp(Number(el.speedInput.value), 0.1, 10);
  simStepAccumulator = Math.min(simStepAccumulator, state.stepsPerFrame);
  updateControlText();
});

el.gainInput.addEventListener("input", () => {
  state.gain = Number(el.gainInput.value) / 100;
  updateControlText();
});

el.autoScaleInput.addEventListener("change", () => {
  state.autoScale = el.autoScaleInput.checked;
});

el.diagnosticsInput?.addEventListener("change", () => {
  state.diagnosticsEnabled = el.diagnosticsInput.checked;
  sim.resetDiagnostics();
  sim.measure();
  updateStats();
  sim.render();
});

el.diagnosticsResetBtn?.addEventListener("click", () => {
  sim.resetDiagnostics();
  sim.measure();
  updateStats();
  sim.render();
});

el.analysisInput?.addEventListener("change", () => {
  state.analysisEnabled = el.analysisInput.checked;
  sim.resetAnalysisDiagnostics();
  updateControlText();
  sim.render();
});

el.analysisResetBtn?.addEventListener("click", () => {
  sim.resetAnalysisDiagnostics();
  updateStats();
  sim.render();
});

el.spectrumChart?.addEventListener("pointermove", updateSpectrumReadout);
el.farFieldChart?.addEventListener("pointermove", updateFarFieldReadout);
[el.spectrumChart, el.farFieldChart].forEach((canvas) => {
  canvas?.addEventListener("pointerleave", () => {
    if (el.analysisChartReadout) el.analysisChartReadout.textContent = "Move over a chart";
  });
});

el.sweepModeInput?.addEventListener("change", () => {
  const nextMode = normalizeSweepMode(el.sweepModeInput.value);
  state.sweepMode = nextMode;
  if (nextMode === "frequency") {
    state.sweepStart = 0.012;
    state.sweepEnd = 0.055;
  } else if (nextMode === "amplitude") {
    state.sweepStart = 0.1;
    state.sweepEnd = 1.0;
  } else if (nextMode === "gainLoss") {
    state.sweepStart = 0;
    state.sweepEnd = 0.08;
  } else if (nextMode === "symmetry") {
    state.sweepStart = 0;
    state.sweepEnd = 0.16;
  } else if (nextMode === "blochK") {
    state.sweepStart = 0;
    state.sweepEnd = 1;
    state.sweepSamples = 11;
  } else if (nextMode === "direction") {
    state.sweepStart = 0;
    state.sweepEnd = 1;
    state.sweepSamples = 2;
  } else {
    state.sweepStart = 0;
    state.sweepEnd = 70;
  }
  state.sweepBidirectional = nextMode === "amplitude" && Boolean(el.sweepBidirectionalInput?.checked);
  state.sweepResults = [];
  setSweepStatus(sweepReadyStatusText());
  updateControlText();
});

[el.sweepStartInput, el.sweepEndInput, el.sweepSamplesInput, el.sweepStepsInput, el.sweepBidirectionalInput].forEach((input) => {
  input?.addEventListener("change", () => {
    syncSweepStateFromInputs();
    state.sweepResults = [];
    setSweepStatus(sweepReadyStatusText());
    updateControlText();
  });
});

el.sweepRunBtn?.addEventListener("click", () => {
  runSweep();
});

el.sweepExportBtn?.addEventListener("click", () => {
  exportSweepCsv();
});

el.sweepChart?.addEventListener("pointermove", updateSweepChartReadout);
el.sweepChart?.addEventListener("pointerleave", () => {
  if (!el.sweepChartReadout) return;
  const results = state.sweepResults || [];
  el.sweepChartReadout.textContent =
    results.length > 0 ? `${results.length} sweep points | ${sweepModeLabel()} ${formatSweepValue(results[results.length - 1].x)}` : "No sweep point";
});

el.fieldComponentButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const component = button.dataset.fieldComponent === "hz" ? "hz" : "ez";
    if (state.fieldComponent === component) return;
    state.fieldComponent = component;
    sim.resetFields();
    sim.measure();
    updateControlText();
    updateStats();
    sim.render();
  });
});

el.fieldDisplayButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const display = button.dataset.fieldDisplay || "scalar";
    state.fieldDisplay = ["scalar", "transverseX", "transverseY", "electricMag", "magneticMag"].includes(display)
      ? display
      : "scalar";
    sim.measure();
    updateControlText();
    updateStats();
    sim.render();
  });
});

el.fieldQuiverInput?.addEventListener("change", () => {
  state.fieldQuiver = el.fieldQuiverInput.checked;
  updateControlText();
  sim.render();
});

el.visualProfileButtons?.forEach((button) => {
  button.addEventListener("click", () => {
    applyVisualProfile(button.dataset.visualProfile || "auto");
  });
});

el.visualLayerInputs?.forEach((input) => {
  input.addEventListener("change", () => {
    setCustomVisualLayer(input.dataset.visualLayer, input.checked);
  });
});

el.viewModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.viewMode;
    state.viewMode = ["field", "poynting", "epsilon", "mu"].includes(mode) ? mode : "field";
    sim.measure();
    updateControlText();
    updateStats();
    sim.render();
  });
});

el.viewProjectionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.viewProjection = button.dataset.viewProjection === "3d" ? "3d" : "2d";
    updateControlText();
    sim.render();
  });
});

el.materialPartButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.materialPart = button.dataset.materialPart === "imag" ? "imag" : "real";
    updateControlText();
    sim.render();
  });
});

el.sourceTypeInput.addEventListener("change", () => {
  syncSourceEditorTarget();
});

el.sourceShapeInput.addEventListener("change", () => {
  syncSourceEditorTarget();
});

el.frequencyInput.addEventListener("input", () => {
  sim.resetDiagnostics();
  syncSourceEditorTarget();
});

el.amplitudeInput.addEventListener("input", () => {
  syncSourceEditorTarget();
});

el.sourceXInput.addEventListener("change", () => {
  syncSourceEditorTarget();
});

el.sourceYInput.addEventListener("change", () => {
  syncSourceEditorTarget();
});

el.sourceWidthInput.addEventListener("input", () => {
  syncSourceEditorTarget();
});

el.sourceAngleInput.addEventListener("input", () => {
  sim.resetDiagnostics();
  syncSourceEditorTarget();
});

el.sourceTimePhaseInput?.addEventListener("input", () => {
  sim.resetDiagnostics();
  syncSourceEditorTarget();
});

function handleSourceOrderInput() {
  syncSourceEditorTarget();
}

el.sourceOrderInput.addEventListener("input", handleSourceOrderInput);
el.sourceOrderInput.addEventListener("change", handleSourceOrderInput);

el.sourcePhaseInput.addEventListener("change", () => {
  syncSourceEditorTarget();
});

function handleWavelengthInput() {
  const value = Number(el.wavelengthInput.value);
  if (!Number.isFinite(value)) return;
  state.wavelengthUm = clamp(value, 0.1, 10);
  updateControlText();
}

function handleCellsPerWavelengthInput() {
  disableResponsiveGridOrientation();
  const value = Number(el.cellsPerWavelengthInput.value);
  if (!Number.isFinite(value)) return;
  state.cellsPerWavelength = clampInt(value, 8, 80);
  const nextFrequency = COURANT / state.cellsPerWavelength;
  state.sourceDefaults.frequency = nextFrequency;
  state.sources.forEach((source) => {
    source.frequency = nextFrequency;
  });
  el.frequencyInput.value = String(Math.round(nextFrequency * 1000));
  sim.buildBoundary(state.boundary);
  if (state.preset !== "empty") {
    sim.applyPreset(state.preset);
    sim.zeroBoundaryFields();
    sim.measure();
    updateStats();
    sim.render();
  } else {
    sim.refreshPmlMaterialContinuation(true);
    sim.zeroBoundaryFields();
    sim.measure();
    updateStats();
    sim.render();
  }
  updateControlText();
}

function handleCustomMaterialInput() {
  disableResponsiveGridOrientation();
  state.customAnisotropic = Boolean(el.customAnisotropyInput.checked);
  state.materialModulationEnabled = Boolean(el.modulationEnabledInput.checked);
  state.materialNonlinearEnabled = Boolean(el.nonlinearEnabledInput.checked);
  state.materialHarmonicEnabled = Boolean(el.harmonicEnabledInput?.checked);
  state.materialPhaseChangeEnabled = Boolean(el.phaseChangeEnabledInput?.checked);
  state.materialGyrotropyEnabled = Boolean(el.gyrotropyEnabledInput?.checked);
  state.materialBianisotropyEnabled = Boolean(el.bianisotropyEnabledInput?.checked);
  state.materialConductivityEnabled = Boolean(el.conductivityEnabledInput?.checked);
  state.materialSaturableGainEnabled = Boolean(el.saturableGainEnabledInput?.checked);
  if (state.materialGyrotropyEnabled && state.fieldComponent !== "hz") {
    state.fieldComponent = "hz";
  }
  state.dispersionModel = normalizeDispersionModel(el.dispersionModelInput?.value);
  state.materialDispersionEnabled = state.dispersionModel !== "none";
  const epsReal = Number(el.customEpsRealInput.value);
  const epsImag = Number(el.customEpsImagInput.value);
  const epsYReal = Number(el.customEpsYRealInput.value);
  const epsYImag = Number(el.customEpsYImagInput.value);
  const muReal = Number(el.customMuRealInput.value);
  const muImag = Number(el.customMuImagInput.value);
  const muYReal = Number(el.customMuYRealInput.value);
  const muYImag = Number(el.customMuYImagInput.value);
  const gyrotropyG = Number(el.gyrotropyGInput?.value);
  const bianisotropyKappa = Number(el.bianisotropyKappaInput?.value);
  const modulationDepth = Number(el.modulationDepthInput.value);
  const modulationFrequency = Number(el.modulationFrequencyInput.value);
  const modulationPeriod = Number(el.modulationPeriodInput.value);
  const modulationAngle = Number(el.modulationAngleInput.value);
  const modulationPhase = Number(el.modulationPhaseInput.value);
  const kerrChi3 = Number(el.kerrChi3Input.value);
  const kerrSaturation = Number(el.kerrSaturationInput.value);
  const harmonicChi2 = Number(el.harmonicChi2Input?.value);
  const harmonicChi3 = Number(el.harmonicChi3Input?.value);
  const harmonicSaturation = Number(el.harmonicSaturationInput?.value);
  const phaseEpsOn = Number(el.phaseEpsOnInput?.value);
  const phaseLossOn = Number(el.phaseLossOnInput?.value);
  const phaseThresholdOn = Number(el.phaseThresholdOnInput?.value);
  const phaseThresholdOff = Number(el.phaseThresholdOffInput?.value);
  const phaseTauOn = Number(el.phaseTauOnInput?.value);
  const phaseTauOff = Number(el.phaseTauOffInput?.value);
  const conductivitySigma = Number(el.conductivitySigmaInput?.value);
  const conductivitySigmaY = Number(el.conductivitySigmaYInput?.value);
  const gainSaturation = Number(el.gainSaturationInput?.value);
  const dispersionOmegaP = Number(el.dispersionOmegaPInput?.value);
  const dispersionGamma = Number(el.dispersionGammaInput?.value);
  const dispersionOmega0 = Number(el.dispersionOmega0Input?.value);
  const dispersionDeltaEps = Number(el.dispersionDeltaEpsInput?.value);
  const dispersionTau = Number(el.dispersionTauInput?.value);
  if (Number.isFinite(epsReal)) {
    state.customEpsReal = clamp(epsReal, -30, 30);
  }
  if (Number.isFinite(epsImag)) {
    state.customEpsImag = clamp(epsImag, -30, 30);
  }
  if (Number.isFinite(epsYReal)) {
    state.customEpsYReal = clamp(epsYReal, -30, 30);
  }
  if (Number.isFinite(epsYImag)) {
    state.customEpsYImag = clamp(epsYImag, -30, 30);
  }
  if (Number.isFinite(muReal)) {
    state.customMuReal = clamp(muReal, -30, 30);
  }
  if (Number.isFinite(muImag)) {
    state.customMuImag = clamp(muImag, -30, 30);
  }
  if (Number.isFinite(muYReal)) {
    state.customMuYReal = clamp(muYReal, -30, 30);
  }
  if (Number.isFinite(muYImag)) {
    state.customMuYImag = clamp(muYImag, -30, 30);
  }
  if (Number.isFinite(gyrotropyG)) {
    state.gyrotropyG = clamp(gyrotropyG, -5, 5);
  }
  if (Number.isFinite(bianisotropyKappa)) {
    state.bianisotropyKappa = normalizeBianisotropyKappa(bianisotropyKappa);
  }
  if (Number.isFinite(modulationDepth)) {
    state.modulationDepth = clamp(modulationDepth, 0, 0.95);
  }
  if (Number.isFinite(modulationFrequency)) {
    state.modulationFrequency = clamp(modulationFrequency, -0.2, 0.2);
  }
  if (Number.isFinite(modulationPeriod)) {
    state.modulationPeriodLambda = clamp(modulationPeriod, 0.1, 20);
  }
  if (Number.isFinite(modulationAngle)) {
    state.modulationAngleDeg = ((modulationAngle % 360) + 360) % 360;
  }
  if (Number.isFinite(modulationPhase)) {
    state.modulationPhaseDeg = clamp(modulationPhase, -180, 180);
  }
  if (Number.isFinite(kerrChi3)) {
    state.kerrChi3 = clamp(kerrChi3, -20, 20);
  }
  if (Number.isFinite(kerrSaturation)) {
    state.kerrSaturation = clamp(kerrSaturation, 0.05, 50);
  }
  if (Number.isFinite(harmonicChi2)) {
    state.harmonicChi2 = clamp(harmonicChi2, -2, 2);
  }
  if (Number.isFinite(harmonicChi3)) {
    state.harmonicChi3 = clamp(harmonicChi3, -2, 2);
  }
  if (Number.isFinite(harmonicSaturation)) {
    state.harmonicSaturation = clamp(harmonicSaturation, 0.05, 50);
  }
  if (Number.isFinite(phaseEpsOn)) {
    state.phaseEpsOn = clamp(phaseEpsOn, -30, 30);
  }
  if (Number.isFinite(phaseLossOn)) {
    state.phaseLossOn = clamp(phaseLossOn, -30, 30);
  }
  if (Number.isFinite(phaseThresholdOn)) {
    state.phaseThresholdOn = clamp(phaseThresholdOn, 0, 100);
  }
  if (Number.isFinite(phaseThresholdOff)) {
    state.phaseThresholdOff = Math.min(state.phaseThresholdOn, clamp(phaseThresholdOff, 0, 100));
  }
  if (Number.isFinite(phaseTauOn)) {
    state.phaseTauOn = clamp(phaseTauOn, 1, 1000);
  }
  if (Number.isFinite(phaseTauOff)) {
    state.phaseTauOff = clamp(phaseTauOff, 1, 2000);
  }
  if (Number.isFinite(conductivitySigma)) {
    state.conductivitySigma = clamp(conductivitySigma, 0, 5);
  }
  if (Number.isFinite(conductivitySigmaY)) {
    state.conductivitySigmaY = clamp(conductivitySigmaY, 0, 5);
  }
  if (Number.isFinite(gainSaturation)) {
    state.gainSaturation = clamp(gainSaturation, 0.05, 100);
  }
  if (Number.isFinite(dispersionOmegaP)) {
    state.dispersionOmegaP = clamp(dispersionOmegaP, 0, 1.2);
  }
  if (Number.isFinite(dispersionGamma)) {
    state.dispersionGamma = clamp(dispersionGamma, 0, 0.5);
  }
  if (Number.isFinite(dispersionOmega0)) {
    state.dispersionOmega0 = clamp(dispersionOmega0, 0, 1.2);
  }
  if (Number.isFinite(dispersionDeltaEps)) {
    state.dispersionDeltaEps = clamp(dispersionDeltaEps, -20, 20);
  }
  if (Number.isFinite(dispersionTau)) {
    state.dispersionTau = clamp(dispersionTau, 1, 200);
  }
  if (brushMenuMode === "region" && selectedMaterialRegion) {
    state.brush = "custom";
    selectedMaterialRegion = sim.applyMaterialKindToRegion(selectedMaterialRegion, "custom");
  } else {
    sim.updateCustomMaterialCells(true);
  }
  if (
    !state.materialModulationEnabled &&
    !state.materialNonlinearEnabled &&
    !state.materialHarmonicEnabled &&
    !state.materialPhaseChangeEnabled &&
    !state.materialGyrotropyEnabled &&
    !state.materialBianisotropyEnabled &&
    !state.materialDispersionEnabled
  ) {
    sim.restoreDynamicMaterialsToBase();
  }
  sim.measure();
  updateControlText();
  updateStats();
  sim.render();
}

el.wavelengthInput.addEventListener("input", handleWavelengthInput);
el.wavelengthInput.addEventListener("change", handleWavelengthInput);
el.cellsPerWavelengthInput.addEventListener("input", handleCellsPerWavelengthInput);
el.cellsPerWavelengthInput.addEventListener("change", handleCellsPerWavelengthInput);
el.customAnisotropyInput.addEventListener("change", handleCustomMaterialInput);
el.customEpsRealInput.addEventListener("input", handleCustomMaterialInput);
el.customEpsRealInput.addEventListener("change", handleCustomMaterialInput);
el.customEpsImagInput.addEventListener("input", handleCustomMaterialInput);
el.customEpsImagInput.addEventListener("change", handleCustomMaterialInput);
el.customEpsYRealInput.addEventListener("input", handleCustomMaterialInput);
el.customEpsYRealInput.addEventListener("change", handleCustomMaterialInput);
el.customEpsYImagInput.addEventListener("input", handleCustomMaterialInput);
el.customEpsYImagInput.addEventListener("change", handleCustomMaterialInput);
el.customMuRealInput.addEventListener("input", handleCustomMaterialInput);
el.customMuRealInput.addEventListener("change", handleCustomMaterialInput);
el.customMuImagInput.addEventListener("input", handleCustomMaterialInput);
el.customMuImagInput.addEventListener("change", handleCustomMaterialInput);
el.customMuYRealInput.addEventListener("input", handleCustomMaterialInput);
el.customMuYRealInput.addEventListener("change", handleCustomMaterialInput);
el.customMuYImagInput.addEventListener("input", handleCustomMaterialInput);
el.customMuYImagInput.addEventListener("change", handleCustomMaterialInput);
el.gyrotropyEnabledInput.addEventListener("change", handleCustomMaterialInput);
el.gyrotropyGInput.addEventListener("input", handleCustomMaterialInput);
el.gyrotropyGInput.addEventListener("change", handleCustomMaterialInput);
el.bianisotropyEnabledInput.addEventListener("change", handleCustomMaterialInput);
el.bianisotropyKappaInput.addEventListener("input", handleCustomMaterialInput);
el.bianisotropyKappaInput.addEventListener("change", handleCustomMaterialInput);
el.modulationEnabledInput.addEventListener("change", handleCustomMaterialInput);
el.modulationDepthInput.addEventListener("input", handleCustomMaterialInput);
el.modulationDepthInput.addEventListener("change", handleCustomMaterialInput);
el.modulationFrequencyInput.addEventListener("input", handleCustomMaterialInput);
el.modulationFrequencyInput.addEventListener("change", handleCustomMaterialInput);
el.modulationPeriodInput.addEventListener("input", handleCustomMaterialInput);
el.modulationPeriodInput.addEventListener("change", handleCustomMaterialInput);
el.modulationAngleInput.addEventListener("input", handleCustomMaterialInput);
el.modulationAngleInput.addEventListener("change", handleCustomMaterialInput);
el.modulationPhaseInput.addEventListener("input", handleCustomMaterialInput);
el.modulationPhaseInput.addEventListener("change", handleCustomMaterialInput);
el.nonlinearEnabledInput.addEventListener("change", handleCustomMaterialInput);
el.kerrChi3Input.addEventListener("input", handleCustomMaterialInput);
el.kerrChi3Input.addEventListener("change", handleCustomMaterialInput);
el.kerrSaturationInput.addEventListener("input", handleCustomMaterialInput);
el.kerrSaturationInput.addEventListener("change", handleCustomMaterialInput);
el.harmonicEnabledInput.addEventListener("change", handleCustomMaterialInput);
el.harmonicChi2Input.addEventListener("input", handleCustomMaterialInput);
el.harmonicChi2Input.addEventListener("change", handleCustomMaterialInput);
el.harmonicChi3Input.addEventListener("input", handleCustomMaterialInput);
el.harmonicChi3Input.addEventListener("change", handleCustomMaterialInput);
el.harmonicSaturationInput.addEventListener("input", handleCustomMaterialInput);
el.harmonicSaturationInput.addEventListener("change", handleCustomMaterialInput);
el.phaseChangeEnabledInput.addEventListener("change", handleCustomMaterialInput);
el.phaseEpsOnInput.addEventListener("input", handleCustomMaterialInput);
el.phaseEpsOnInput.addEventListener("change", handleCustomMaterialInput);
el.phaseLossOnInput.addEventListener("input", handleCustomMaterialInput);
el.phaseLossOnInput.addEventListener("change", handleCustomMaterialInput);
el.phaseThresholdOnInput.addEventListener("input", handleCustomMaterialInput);
el.phaseThresholdOnInput.addEventListener("change", handleCustomMaterialInput);
el.phaseThresholdOffInput.addEventListener("input", handleCustomMaterialInput);
el.phaseThresholdOffInput.addEventListener("change", handleCustomMaterialInput);
el.phaseTauOnInput.addEventListener("input", handleCustomMaterialInput);
el.phaseTauOnInput.addEventListener("change", handleCustomMaterialInput);
el.phaseTauOffInput.addEventListener("input", handleCustomMaterialInput);
el.phaseTauOffInput.addEventListener("change", handleCustomMaterialInput);
el.conductivityEnabledInput.addEventListener("change", handleCustomMaterialInput);
el.conductivitySigmaInput.addEventListener("input", handleCustomMaterialInput);
el.conductivitySigmaInput.addEventListener("change", handleCustomMaterialInput);
el.conductivitySigmaYInput.addEventListener("input", handleCustomMaterialInput);
el.conductivitySigmaYInput.addEventListener("change", handleCustomMaterialInput);
el.saturableGainEnabledInput.addEventListener("change", handleCustomMaterialInput);
el.gainSaturationInput.addEventListener("input", handleCustomMaterialInput);
el.gainSaturationInput.addEventListener("change", handleCustomMaterialInput);
el.dispersionModelInput.addEventListener("change", handleCustomMaterialInput);
el.dispersionOmegaPInput.addEventListener("input", handleCustomMaterialInput);
el.dispersionOmegaPInput.addEventListener("change", handleCustomMaterialInput);
el.dispersionGammaInput.addEventListener("input", handleCustomMaterialInput);
el.dispersionGammaInput.addEventListener("change", handleCustomMaterialInput);
el.dispersionOmega0Input.addEventListener("input", handleCustomMaterialInput);
el.dispersionOmega0Input.addEventListener("change", handleCustomMaterialInput);
el.dispersionDeltaEpsInput.addEventListener("input", handleCustomMaterialInput);
el.dispersionDeltaEpsInput.addEventListener("change", handleCustomMaterialInput);
el.dispersionTauInput.addEventListener("input", handleCustomMaterialInput);
el.dispersionTauInput.addEventListener("change", handleCustomMaterialInput);

function applySelectedPreset() {
  clearMaterialSelection(false);
  clearCanvasHover(false);
  state.preset = el.presetInput.value;
  if (gridSizeIsAutoOrientable()) {
    automaticGridOrientationEnabled = true;
  }
  const gridChanged = applyResponsiveGridOrientation({ render: false });
  if (!gridChanged) {
    sim.applyPreset(state.preset);
  }
  sim.measure();
  updateControlText();
  updateStats();
  sim.render();
  syncSceneBrowserSelection();
}

el.presetInput.addEventListener("change", applySelectedPreset);

el.slabThicknessInput.addEventListener("input", () => {
  state.slabThicknessLambda = Number(el.slabThicknessInput.value);
  if (state.preset === "customSlab") {
    sim.applyPreset(state.preset);
    sim.measure();
    updateStats();
    sim.render();
  }
  updateControlText();
});

function applyBoundaryMode(mode, side = boundaryMenuSide) {
  disableResponsiveGridOrientation();
  clearMaterialSelection(false);
  clearCanvasHover(false);
  const previousMode = boundarySideMode(side);
  setBoundarySideMode(side, mode);
  sim.buildBoundary();
  if (previousMode === "absorbing" && boundarySideMode(side) === "reflective") {
    sim.clearBoundarySideMaterials(side);
  }
  sim.clearPmlMaterials();
  sim.zeroBoundaryFields();
  sim.measure();
  updateControlText();
  updateStats();
  sim.render();
}

el.boundaryMenuInput.addEventListener("change", () => {
  applyBoundaryMode(el.boundaryMenuInput.value, boundaryMenuSide);
  closeBoundaryMenu();
  sim.render();
});

function applyGridSizeFromInputs() {
  disableResponsiveGridOrientation();
  const nx = clampInt(el.gridNxInput.value, 80, MAX_GRID.nx);
  const ny = clampInt(el.gridNyInput.value, 60, MAX_GRID.ny);
  applySimulationGridSize(nx, ny);
}

el.gridNxInput.addEventListener("change", applyGridSizeFromInputs);
el.gridNyInput.addEventListener("change", applyGridSizeFromInputs);
el.gridNxInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    applyGridSizeFromInputs();
  }
});
el.gridNyInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    applyGridSizeFromInputs();
  }
});

el.exportSceneBtn?.addEventListener("click", downloadSceneJson);
el.importSceneBtn?.addEventListener("click", () => {
  el.importSceneFileInput?.click();
});
el.importSceneFileInput?.addEventListener("change", async () => {
  const file = el.importSceneFileInput.files?.[0];
  await importSceneJsonFile(file);
  el.importSceneFileInput.value = "";
});
el.copySceneUrlBtn?.addEventListener("click", () => {
  copySceneUrl();
});

function handleBrushSizeInput(input) {
  state.brushSizeLambda = Number(input.value);
  state.canvasMode = "brush";
  updateControlText();
}

if (el.brushSizeInput) {
  el.brushSizeInput.addEventListener("input", () => handleBrushSizeInput(el.brushSizeInput));
}
el.brushMenuSizeInput.addEventListener("input", () => handleBrushSizeInput(el.brushMenuSizeInput));

el.brushToolButtons?.forEach((button) => {
  button.addEventListener("click", () => {
    state.brushTool = button.dataset.brushTool === "geometry" ? "geometry" : "paint";
    state.canvasMode = "brush";
    updateControlText();
    sim.render();
  });
});

function handleBrushGeometryInput() {
  state.brushGeometry = el.brushGeometryInput?.value || "rectangle";
  state.brushTool = "geometry";
  state.canvasMode = "brush";
  normalizeBrushGeometryState();
  updateControlText();
  sim.render();
}

function handleGeometryDimensionInput() {
  const width = Number(el.geometryWidthInput?.value);
  const height = Number(el.geometryHeightInput?.value);
  const radius = Number(el.geometryRadiusInput?.value);
  const innerRadius = Number(el.geometryInnerRadiusInput?.value);
  if (Number.isFinite(width)) state.geometryWidthLambda = width;
  if (Number.isFinite(height)) state.geometryHeightLambda = height;
  if (Number.isFinite(radius)) state.geometryRadiusLambda = radius;
  if (Number.isFinite(innerRadius)) state.geometryInnerRadiusLambda = innerRadius;
  state.brushTool = "geometry";
  state.canvasMode = "brush";
  normalizeBrushGeometryState();
  updateControlText();
  sim.render();
}

el.brushGeometryInput?.addEventListener("change", handleBrushGeometryInput);
[
  el.geometryWidthInput,
  el.geometryHeightInput,
  el.geometryRadiusInput,
  el.geometryInnerRadiusInput,
].forEach((input) => {
  input?.addEventListener("input", handleGeometryDimensionInput);
  input?.addEventListener("change", handleGeometryDimensionInput);
});

document.querySelectorAll("[data-brush]").forEach((button) => {
  button.addEventListener("click", () => {
    const brush = button.dataset.brush;
    if (brushMenuMode === "region" && selectedMaterialRegion) {
      applyMaterialKindToSelection(brush);
      if (brush === "erase") {
        closeBrushMenu();
      }
      return;
    }
    state.brush = brush;
    state.canvasMode = "brush";
    updateControlText();
  });
});

function clearMedium() {
  clearMaterialSelection(false);
  sim.clearMaterials();
  state.preset = "empty";
  state.materialDispersionEnabled = false;
  state.materialHarmonicEnabled = false;
  state.materialConductivityEnabled = false;
  state.materialSaturableGainEnabled = false;
  state.materialPhaseChangeEnabled = false;
  state.materialGyrotropyEnabled = false;
  state.materialBianisotropyEnabled = false;
  el.presetInput.value = "empty";
  sim.measure();
  updateControlText();
  updateStats();
  sim.render();
}

function clearField() {
  sim.resetFields();
  sim.measure();
  updateStats();
  sim.render();
}

if (el.clearMaterialsBtn) {
  el.clearMaterialsBtn.addEventListener("click", clearMedium);
}
el.brushMenuClearMaterialsBtn.addEventListener("click", clearMedium);
if (el.clearFieldsBtn) {
  el.clearFieldsBtn.addEventListener("click", clearField);
}
el.brushMenuClearFieldsBtn.addEventListener("click", clearField);
el.brushMenuCloseBtn.addEventListener("click", () => {
  closeBrushMenu();
  sim.render();
});
el.boundaryMenuCloseBtn.addEventListener("click", () => {
  closeBoundaryMenu();
  sim.render();
});

function updateViewInteraction() {
  updateControlText();
  updateCanvasInteractionState();
  sim.render();
}

function handleCanvasKeydown(event) {
  if (isEditableKeyTarget(event.target)) return;
  const rect = el.canvas.getBoundingClientRect();
  const centerX = rect.left + rect.width * 0.5;
  const centerY = rect.top + rect.height * 0.5;
  const panStep = event.shiftKey ? 96 : 42;
  let changed = false;
  if (event.key === "+" || event.key === "=") {
    changed = sim.zoomAtClientPoint(centerX, centerY, 1.18);
  } else if (event.key === "-" || event.key === "_") {
    changed = sim.zoomAtClientPoint(centerX, centerY, 1 / 1.18);
  } else if (event.key === "0") {
    sim.resetView();
    changed = true;
  } else if (event.key === "ArrowLeft") {
    changed = sim.panByClientDelta(panStep, 0);
  } else if (event.key === "ArrowRight") {
    changed = sim.panByClientDelta(-panStep, 0);
  } else if (event.key === "ArrowUp") {
    changed = sim.panByClientDelta(0, panStep);
  } else if (event.key === "ArrowDown") {
    changed = sim.panByClientDelta(0, -panStep);
  } else {
    return;
  }
  event.preventDefault();
  if (changed) {
    updateViewInteraction();
  }
}

function storePointer(event) {
  activePointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY,
    pointerType: event.pointerType,
  });
}

function gesturePointers() {
  return Array.from(activePointers.values()).slice(0, 2);
}

function gestureCenter(points) {
  return {
    x: (points[0].clientX + points[1].clientX) * 0.5,
    y: (points[0].clientY + points[1].clientY) * 0.5,
  };
}

function gestureDistance(points) {
  return Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY);
}

function beginPinchGesture() {
  const points = gesturePointers();
  if (points.length < 2) return;
  const center = gestureCenter(points);
  const world = sim.clientToGridFloat(center.x, center.y);
  pinchState = {
    distance: Math.max(1, gestureDistance(points)),
    zoom: sim.viewZoom,
    worldX: world.x,
    worldY: world.y,
  };
}

function updatePinchGesture() {
  const points = gesturePointers();
  if (points.length < 2) return false;
  if (!pinchState) beginPinchGesture();
  const center = gestureCenter(points);
  const distance = Math.max(1, gestureDistance(points));
  const factor = distance / pinchState.distance;
  sim.setZoomFromGesture(center.x, center.y, pinchState.worldX, pinchState.worldY, pinchState.zoom * factor);
  updateViewInteraction();
  return true;
}

function beginPan(event) {
  panPointerId = event.pointerId;
  lastPanPoint = { x: event.clientX, y: event.clientY };
  pointerDown = false;
  paintPointerId = null;
  updateCanvasInteractionState();
}

function updatePan(event) {
  if (panPointerId !== event.pointerId || !lastPanPoint) return false;
  const dx = event.clientX - lastPanPoint.x;
  const dy = event.clientY - lastPanPoint.y;
  lastPanPoint = { x: event.clientX, y: event.clientY };
  if (sim.panByClientDelta(dx, dy)) {
    updateViewInteraction();
  }
  updateCanvasInteractionState();
  return true;
}

function clearPendingTouchInteraction() {
  pendingTouchInteraction = null;
}

function beginPendingTouchInteraction(event, kind, data = {}) {
  pendingTouchInteraction = {
    pointerId: event.pointerId,
    kind,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    ...data,
  };
  if (kind !== "empty") {
    lastCanvasTouchTap = null;
  }
}

function pendingTouchDistance(event) {
  if (!pendingTouchInteraction || pendingTouchInteraction.pointerId !== event.pointerId) return 0;
  return Math.hypot(event.clientX - pendingTouchInteraction.startX, event.clientY - pendingTouchInteraction.startY);
}

function markPendingTouchMoved(event, threshold = TOUCH_TAP_MAX_DISTANCE_PX) {
  if (!pendingTouchInteraction || pendingTouchInteraction.pointerId !== event.pointerId) return false;
  if (pendingTouchDistance(event) >= threshold) {
    pendingTouchInteraction.moved = true;
  }
  return pendingTouchInteraction.moved;
}

function handleCanvasTouchTap(event, interaction) {
  if (!interaction || interaction.kind !== "empty" || interaction.moved || event.pointerType !== "touch" || event.type !== "pointerup") {
    return false;
  }
  const now = event.timeStamp || performance.now();
  const currentTap = { x: interaction.startX, y: interaction.startY, time: now };
  const previousTap = lastCanvasTouchTap;
  lastCanvasTouchTap = currentTap;
  if (!previousTap) return false;
  const elapsed = now - previousTap.time;
  const distance = Math.hypot(currentTap.x - previousTap.x, currentTap.y - previousTap.y);
  if (elapsed > TOUCH_DOUBLE_TAP_MS || distance > TOUCH_DOUBLE_TAP_DISTANCE_PX) return false;
  lastCanvasTouchTap = null;
  closeContextMenus();
  sim.resetView();
  updateViewInteraction();
  return true;
}

function promotePendingTouchDrag(event) {
  if (!pendingTouchInteraction || pendingTouchInteraction.pointerId !== event.pointerId || pendingTouchInteraction.kind === "empty") {
    return false;
  }
  if (pendingTouchDistance(event) < TOUCH_DRAG_START_PX) return false;
  const interaction = pendingTouchInteraction;
  interaction.moved = true;
  clearPendingTouchInteraction();
  if (interaction.kind === "source") {
    const source = state.sources.find((candidate) => candidate.id === interaction.sourceId);
    if (!source) return true;
    beginSourceDrag(event, source, interaction.startX, interaction.startY);
    updateSourceDrag(event);
    return true;
  }
  if (interaction.kind === "material" && interaction.region) {
    beginMaterialDrag(event, interaction.region, interaction.startX, interaction.startY);
    updateMaterialDrag(event);
    return true;
  }
  return true;
}

function beginSourceDrag(event, source, originClientX = event.clientX, originClientY = event.clientY) {
  disableResponsiveGridOrientation();
  closeContextMenus();
  clearMaterialSelection(false);
  state.selectedSourceId = source.id;
  updateInspector();
  dragSourcePointerId = event.pointerId;
  dragSourceId = source.id;
  const point = sim.clientToGridFloat(originClientX, originClientY);
  dragSourceOffset = {
    x: sim.sourceXCell(source) - point.x,
    y: sim.sourceYCell(source) - point.y,
  };
  pointerDown = false;
  paintPointerId = null;
  panPointerId = null;
  lastPanPoint = null;
  updateCanvasInteractionState();
  sim.render();
}

function updateSourceDrag(event) {
  if (dragSourcePointerId !== event.pointerId || dragSourceId === null || !dragSourceOffset) return false;
  const source = state.sources.find((candidate) => candidate.id === dragSourceId);
  if (!source) return false;
  const point = sim.clientToGridFloat(event.clientX, event.clientY);
  const x = clampInt(point.x + dragSourceOffset.x, sim.sourcePlacementMinX(), sim.sourcePlacementMaxX());
  const y = clampInt(point.y + dragSourceOffset.y, sim.sourcePlacementMinY(), sim.sourcePlacementMaxY());
  source.xLambda = cellsToLambda(x);
  source.yLambda = cellsToLambda(y);
  state.sourceDefaults = { ...source };
  delete state.sourceDefaults.id;
  updateControlText();
  updateInspector();
  updateCanvasInteractionState();
  sim.render();
  return true;
}

function endSourceDrag(event) {
  if (dragSourcePointerId !== event.pointerId) return;
  dragSourcePointerId = null;
  dragSourceId = null;
  dragSourceOffset = null;
  updateCanvasInteractionState();
}

function beginMaterialDrag(event, region, originClientX = event.clientX, originClientY = event.clientY) {
  disableResponsiveGridOrientation();
  closeContextMenus();
  selectMaterialRegion(region, false);
  dragMaterialPointerId = event.pointerId;
  const point = sim.clientToGridFloat(originClientX, originClientY);
  materialDragState = {
    region,
    base: sim.snapshotMaterialArraysWithoutRegion(region),
    startX: point.x,
    startY: point.y,
    dx: 0,
    dy: 0,
  };
  pointerDown = false;
  paintPointerId = null;
  panPointerId = null;
  lastPanPoint = null;
  updateCanvasInteractionState();
  sim.render();
}

function updateMaterialDrag(event) {
  if (dragMaterialPointerId !== event.pointerId || !materialDragState) return false;
  const point = sim.clientToGridFloat(event.clientX, event.clientY);
  const rawDx = Math.round(point.x - materialDragState.startX);
  const rawDy = Math.round(point.y - materialDragState.startY);
  const { dx, dy } = sim.clampMaterialRegionOffset(materialDragState.region, rawDx, rawDy);
  if (dx === materialDragState.dx && dy === materialDragState.dy) return true;
  selectedMaterialRegion = sim.renderMaterialRegionFromBase(materialDragState.base, materialDragState.region, dx, dy);
  materialDragState.dx = dx;
  materialDragState.dy = dy;
  sim.measure();
  updateStats();
  updateInspector();
  updateCanvasInteractionState();
  sim.render();
  return true;
}

function endMaterialDrag(event) {
  if (dragMaterialPointerId !== event.pointerId) return;
  dragMaterialPointerId = null;
  materialDragState = null;
  sim.measure();
  updateStats();
  updateInspector();
  updateCanvasInteractionState();
  sim.render();
}

el.canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    closeContextMenus();
    const factor = Math.exp(-event.deltaY * 0.0012);
    if (sim.zoomAtClientPoint(event.clientX, event.clientY, factor)) {
      updateViewInteraction();
    }
  },
  { passive: false }
);

el.canvas.addEventListener("dblclick", () => {
  closeContextMenus();
  sim.resetView();
  updateViewInteraction();
});

el.canvas.addEventListener("keydown", handleCanvasKeydown);

el.canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  if (sim.clientIsInBoundaryControlRegion(event.clientX, event.clientY)) {
    openBoundaryMenuAt(event.clientX, event.clientY);
    return;
  }
  if (state.canvasMode === "brush") {
    openBrushMenuAt(event.clientX, event.clientY);
    return;
  }
  const source = sim.sourceAtClientPoint(event.clientX, event.clientY);
  if (source) {
    clearMaterialSelection(false);
    openSourceMenuAt(event.clientX, event.clientY, source);
    return;
  }
  const region = selectMaterialRegionAt(event.clientX, event.clientY, false);
  if (region) {
    openBrushMenuAt(event.clientX, event.clientY, { mode: "region" });
    return;
  }
  openSourceMenuAt(event.clientX, event.clientY, source);
});

el.canvas.addEventListener("pointerdown", (event) => {
  clearCanvasHover(false);
  storePointer(event);
  try {
    el.canvas.setPointerCapture(event.pointerId);
  } catch {
    // Some touch/browser combinations can reject pointer capture.
  }
  if (activePointers.size >= 2) {
    pointerDown = false;
    paintPointerId = null;
    panPointerId = null;
    lastPanPoint = null;
    dragSourcePointerId = null;
    dragSourceId = null;
    dragSourceOffset = null;
    dragMaterialPointerId = null;
    materialDragState = null;
    pinchState = null;
    clearPendingTouchInteraction();
    lastCanvasTouchTap = null;
    beginPinchGesture();
    event.preventDefault();
    return;
  }

  if (event.button === 2) {
    event.preventDefault();
    return;
  }

  if (event.button === 1 || event.shiftKey || event.altKey) {
    closeContextMenus();
    beginPan(event);
    dragMaterialPointerId = null;
    materialDragState = null;
    event.preventDefault();
    return;
  }

  if (event.button === 0 || event.pointerType === "touch") {
    if (state.canvasMode === "select") {
      const isTouchPointer = event.pointerType === "touch";
      const source = sim.sourceAtClientPoint(event.clientX, event.clientY);
      closeContextMenus();
      if (source && !event.shiftKey && !event.altKey) {
        if (isTouchPointer) {
          clearMaterialSelection(false);
          state.selectedSourceId = source.id;
          updateInspector();
          beginPendingTouchInteraction(event, "source", { sourceId: source.id });
          sim.render();
        } else {
          beginSourceDrag(event, source);
        }
      } else {
        const region = selectMaterialRegionAt(event.clientX, event.clientY, false);
        state.selectedSourceId = null;
        if (region && !event.shiftKey && !event.altKey) {
          if (isTouchPointer) {
            beginPendingTouchInteraction(event, "material", { region });
            sim.render();
          } else {
            beginMaterialDrag(event, region);
          }
        } else {
          clearMaterialSelection(false);
          if (isTouchPointer) {
            beginPan(event);
            beginPendingTouchInteraction(event, "empty");
          }
          sim.render();
        }
      }
      event.preventDefault();
      return;
    }
    closeContextMenus();
    if (state.brushTool === "geometry") {
      insertGeometryFromEvent(event);
      pointerDown = false;
      paintPointerId = null;
      event.preventDefault();
      return;
    }
    pointerDown = true;
    paintPointerId = event.pointerId;
    paintFromEvent(event);
    event.preventDefault();
  }
});

el.canvas.addEventListener("pointermove", (event) => {
  if (activePointers.has(event.pointerId)) {
    storePointer(event);
  }

  if (activePointers.size >= 2) {
    pointerDown = false;
    paintPointerId = null;
    panPointerId = null;
    lastPanPoint = null;
    dragSourcePointerId = null;
    dragSourceId = null;
    dragSourceOffset = null;
    dragMaterialPointerId = null;
    materialDragState = null;
    clearPendingTouchInteraction();
    lastCanvasTouchTap = null;
    updatePinchGesture();
    event.preventDefault();
    return;
  }

  if (promotePendingTouchDrag(event)) {
    event.preventDefault();
    return;
  }

  if (pendingTouchInteraction?.pointerId === event.pointerId && pendingTouchInteraction.kind !== "empty") {
    markPendingTouchMoved(event, TOUCH_DRAG_START_PX);
    event.preventDefault();
    return;
  }

  if (updateSourceDrag(event)) {
    event.preventDefault();
    return;
  }

  if (updateMaterialDrag(event)) {
    event.preventDefault();
    return;
  }

  if (pendingTouchInteraction?.pointerId === event.pointerId && pendingTouchInteraction.kind === "empty") {
    markPendingTouchMoved(event);
  }

  if (updatePan(event)) {
    event.preventDefault();
    return;
  }

  if (pointerDown && paintPointerId === event.pointerId) {
    paintFromEvent(event);
    event.preventDefault();
    return;
  }

  updateCanvasHover(event);
});

function endPointer(event) {
  const finishedTouchInteraction =
    pendingTouchInteraction?.pointerId === event.pointerId ? pendingTouchInteraction : null;
  activePointers.delete(event.pointerId);
  if (finishedTouchInteraction) {
    if (event.type !== "pointerup" || (finishedTouchInteraction.kind === "empty" && finishedTouchInteraction.moved)) {
      lastCanvasTouchTap = null;
    } else {
      handleCanvasTouchTap(event, finishedTouchInteraction);
    }
    clearPendingTouchInteraction();
  }
  endSourceDrag(event);
  endMaterialDrag(event);
  if (paintPointerId === event.pointerId) {
    pointerDown = false;
    paintPointerId = null;
  }
  if (panPointerId === event.pointerId) {
    panPointerId = null;
    lastPanPoint = null;
  }
  if (activePointers.size < 2) {
    pinchState = null;
  } else {
    beginPinchGesture();
  }
  updateCanvasInteractionState();
}

el.canvas.addEventListener("pointerup", endPointer);
el.canvas.addEventListener("pointercancel", endPointer);
el.canvas.addEventListener("pointerleave", () => clearCanvasHover());

document.addEventListener("pointerdown", (event) => {
  if (el.stage?.classList.contains("canvas-actions-open") && !el.canvasToolbar?.contains(event.target)) {
    closeCanvasActionsMenu();
  }
  if (el.stage?.classList.contains("canvas-options-open") && !el.canvasToolbar?.contains(event.target)) {
    closeCanvasOptionsMenu();
  }
  const sourceHidden = el.sourceMenu?.hidden ?? true;
  const brushHidden = el.brushMenu?.hidden ?? true;
  const boundaryHidden = el.boundaryMenu?.hidden ?? true;
  if (sourceHidden && brushHidden && boundaryHidden) return;
  if (el.sourceMenu?.contains(event.target) || el.brushMenu?.contains(event.target) || el.boundaryMenu?.contains(event.target)) return;
  if (event.target === el.canvas) return;
  closeContextMenus();
  sim.render();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && el.stage?.classList.contains("canvas-actions-open")) {
    closeCanvasActionsMenu();
    event.preventDefault();
    return;
  }
  if (event.key === "Escape" && el.stage?.classList.contains("canvas-options-open")) {
    closeCanvasOptionsMenu();
    event.preventDefault();
    return;
  }
  if (event.key === "Escape" && el.appShell?.classList.contains("controls-open")) {
    closeControlDrawer();
    event.preventDefault();
    return;
  }
  if (event.key === "Escape" && (!el.sourceMenu?.hidden || !el.brushMenu?.hidden || !el.boundaryMenu?.hidden)) {
    closeContextMenus();
    sim.render();
    return;
  }
  if (event.key === "Escape" && canvasFocusModeActive()) {
    setCanvasFocusMode(false);
    event.preventDefault();
    return;
  }
  if ((event.key === "Delete" || event.key === "Backspace") && !isEditableKeyTarget(event.target)) {
    if (deleteSelectedElement()) {
      event.preventDefault();
    }
  }
});

window.addEventListener("resize", () => {
  closeContextMenus();
  if (!controlDrawerOverlayActive()) {
    closeControlDrawer();
  }
  if (!canvasOptionsMenuActive()) {
    closeCanvasOptionsMenu();
  }
  if (!canvasActionsMenuActive()) {
    closeCanvasActionsMenu();
  }
  syncResultsDetailPanels();
  const gridChanged = applyResponsiveGridOrientation({ render: false });
  if (!gridChanged) {
    updateControlText();
    sim.fitCanvas();
  }
  updateVisualControls();
  updateControlPanelContext();
  sim.render();
});

async function initWasmBackend() {
  if (!window.WebAssembly) return;
  try {
    const backend = await WasmFdtdBackend.load(WASM_CORE_URL);
    sim.attachWasmBackend(backend);
    sim.measure();
    updateControlText();
    updateStats();
    sim.render();
    console.info("WASM FDTD backend enabled");
  } catch (error) {
    console.warn("WASM FDTD backend unavailable; using JavaScript", error);
    updateStats();
  }
}

document.querySelectorAll('input[type="range"]').forEach((input) => {
  input.addEventListener("input", () => updateRangeProgress(input));
});

applyUiDepth(state.uiDepth, false);
buildSceneBrowser();
const sceneLoadedFromUrl = loadSceneFromUrlParam();
if (!sceneLoadedFromUrl) {
  applyResponsiveGridOrientation({ render: false });
}
sim.measure();
updateControlPanelContext();
updateControlText();
updateStats();
sim.render();
initWasmBackend();
requestAnimationFrame(animate);
