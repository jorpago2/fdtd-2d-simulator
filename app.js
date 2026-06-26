"use strict";

const COURANT = 0.48;
const DEFAULT_GRID = { nx: 180, ny: 120 };
const MAX_GRID = { nx: 1200, ny: 800 };
const MIN_CANVAS_DISPLAY_ASPECT = 0.75;
const MAX_CANVAS_DISPLAY_ASPECT = 6;
const MIN_CANVAS_DISPLAY_HEIGHT = 220;
const MAX_CANVAS_DISPLAY_HEIGHT = 780;
const CANVAS_DISPLAY_VIEWPORT_FRACTION = 0.68;
const WASM_CORE_URL = "fdtd-core.wasm?v=20260626-tez-wasm-1";
const WASM_PAGE_BYTES = 65536;
const WASM_MAX_PAGES = 4096;
const FIELD_RENORMALIZE_HIGH = 1e12;
const FIELD_RENORMALIZE_TARGET = 1e3;
const THEME_STORAGE_KEY = "fdtdTheme";

const materialNames = {
  custom: "Custom ε, μ",
  dielectric: "Dielectric",
  pec: "PEC",
  lossy: "Loss",
  erase: "Erase",
};

const localizedSourceShapes = new Set([
  "gaussianSpot",
  "pointDipole",
  "dipole",
  "circularDipoleCw",
  "circularDipoleCcw",
  "janusDipole",
  "huygens",
  "quadrupole",
  "multipole",
]);
const inPlaneElectricCurrentShapes = new Set(["inPlaneElectricDipole"]);
const currentSourceShapes = new Set(["point", ...localizedSourceShapes]);
const incidentFieldSourceShapes = new Set(["line", "gaussianProfile"]);
const circularDipoleSourceShapes = new Set(["circularDipoleCw", "circularDipoleCcw"]);

const sourceShapeLabels = {
  point: "Jz filament",
  line: "Plane wave",
  gaussianProfile: "Gaussian line",
  gaussianSpot: "Gaussian Jz patch",
  pointDipole: "Point electric dipole",
  dipole: "Jz dipole pair",
  circularDipoleCw: "Circular dipole +90 deg",
  circularDipoleCcw: "Circular dipole -90 deg",
  janusDipole: "Janus dipole",
  huygens: "Huygens source",
  quadrupole: "Jz quadrupole pattern",
  multipole: "Jz multipole pattern",
  inPlaneElectricDipole: "In-plane electric dipole",
};

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
  }[shape] || "Source";
}

function sourceCouplingLabel(shape) {
  if (inPlaneElectricCurrentShapes.has(shape)) return "in-plane electric current";
  if (circularDipoleSourceShapes.has(shape)) return "quadrature dipole";
  if (shape === "janusDipole") return "quadrature Janus pair";
  if (shape === "huygens") return "cardioid Huygens pair";
  return incidentFieldSourceShapes.has(shape) ? "incident field" : `out-of-plane ${currentSourceLetter()}z`;
}

const defaultSourceConfig = {
  type: "sine",
  shape: "point",
  frequency: COURANT / 20,
  amplitude: 0.55,
  xLambda: 1.2,
  yLambda: 3,
  widthLambda: 0.35,
  angleDeg: 0,
  phaseDeg: 0,
  multipoleOrder: 3,
  multipolePhase: "cos",
};

const sceneDescriptions = {
  empty: "Blank domain. Use right-click menus to add sources, boundaries, and drawn materials.",
  planeWaveAir: "Atlas 1: homogeneous air with a continuous line source.",
  planeWaveDielectric: "Atlas 2: full dielectric domain, n = 1.5, to show shorter wavelength and slower phase velocity.",
  gaussianPulseAir: "Atlas 3: Gaussian pulse in free space with absorbing boundaries.",
  twoSourceInterference: "Atlas 4: two coherent point Jz sources separated by about 1.5 lambda0.",
  frequencyBeat: "Atlas 5: two nearby CW frequencies to reveal a beat envelope.",
  singleSlit: "Atlas 6: PEC screen with one subwavelength slit.",
  doubleSlit: "Atlas 7: PEC screen with two slits for Young-type interference.",
  circularAperture: "Atlas 8: 2D circular aperture cut into a PEC screen.",
  poyntingPlaneWave: "Atlas 10: oblique plane wave shown as Poynting flux with vector arrows.",
  pmlAbsorption: "Atlas 12: pulsed source aimed at the absorbing boundary for reflection checks.",
  normalInterface: "Atlas 13: air to n = 1.5 vertical interface.",
  obliqueRefraction: "Atlas 14: oblique Gaussian beam on an air-dielectric interface.",
  totalInternalReflection: "Atlas 17: beam incident from n = 1.5 toward air above the critical angle.",
  frustratedTir: "Atlas 18: two high-index regions separated by a narrow air gap.",
  quarterWaveCoating: "Atlas 19: air, quarter-wave coating, and n = 1.5 substrate.",
  braggMirror: "Atlas 20: six-pair n = 1.5 / n = 2.5 Bragg mirror.",
  lossyInterface: "Atlas 21: air to n = 1.5 + 0.1i interface.",
  anisotropicInterface: "Atlas 22: right-hand medium with eps_x != eps_y.",
  jzDipole: "Atlas 23: localized electric Jz dipole in air.",
  inPlaneDipole: "Atlas 24: in-plane electric Jx/Jy dipole using the Hz solver.",
  mzDipole: "Atlas 25: localized magnetic Mz dipole using the Hz solver.",
  dipoleSubstrate: "Atlas 26: Jz dipole close to a dielectric substrate.",
  dipoleNearPec: "Atlas 27: Jz dipole close to a PEC mirror.",
  huygensRadiator: "Atlas 28: analytic Huygens-like source for directional radiation.",
  circularDipole: "Atlas 29: quadrature circular dipole source.",
  janusDipole: "Atlas 30: Janus source near a dielectric waveguide.",
  dipoleArray: "Atlas 31: equal-phase dipole array.",
  phasedDipoleArray: "Atlas 32: progressive temporal phase per dipole for beam steering.",
  apertureRadiator: "Atlas 33: source behind a PEC slot aperture.",
  slabWaveguide: "Atlas 35: high-index slab guide with a Gaussian line source approximation.",
  multimodeSlab: "Atlas 36: wider slab guide for multimode beating.",
  lossyGuide: "Atlas 37: lossy high-index guide.",
  taperWaveguide: "Atlas 39: width taper from narrow to wide guide.",
  widthStepWaveguide: "Atlas 40: abrupt waveguide width step.",
  directionalCoupler: "Atlas 41: two parallel guides separated by a small gap.",
  mmiWaveguide: "Atlas 42: narrow input feeding a wider multimode section.",
  guideScatterer: "Atlas 44: small dielectric scatterer beside a guide.",
  stubResonator: "Atlas 46: side stub attached to a straight guide.",
  fabryPerot: "Atlas 47: dielectric cavity placed between two Bragg reflectors.",
  ringResonator: "Atlas 49: dielectric ring coupled to one bus waveguide.",
  addDropRing: "Atlas 50: dielectric ring coupled to input and drop buses.",
  dielectricCavity: "Atlas 52: high-index disk with an internal dipole source.",
  pecCavity: "Atlas 53: PEC half-wave box cavity with a point source.",
  pecCylinder: "Atlas 59: PEC cylinder under plane-wave illumination.",
  dielectricCylinder: "Atlas 60: n = 2 cylinder scattering.",
  mieCylinder: "Atlas 61: high-index cylinder for Mie-like resonances.",
  lossyCylinder: "Atlas 63: absorbing dielectric cylinder.",
  dielectricDimer: "Atlas 64: two high-index cylinders with a narrow gap.",
  multipleScattering: "Atlas 66: deterministic random cluster of cylinders.",
  weakLocalization: "Atlas 67: many weak inclusions for multiple scattering.",
  finiteConductivity: "Atlas 70: conductive half-space using an explicit J = sigma E update to show skin-depth attenuation.",
  drudeMetal: "Atlas 71: Drude ADE metal with plasma frequency and damping.",
  lorentzMedium: "Atlas 72: Lorentz ADE resonant dielectric slab.",
  debyeDielectric: "Atlas 73: Debye relaxation dielectric slab.",
  plasmaCutoff: "Atlas 74: collisionless plasma slab near cutoff.",
  enzSlab: "Atlas 75: epsilon-near-zero slab using constant complex epsilon.",
  anisotropicMedium: "Atlas 76: anisotropic block, eps_x = 4, eps_y = 2.",
  hyperbolicMedium: "Atlas 77: constant anisotropic medium with eps_x > 0 and eps_y < 0.",
  chiralMedium: "Atlas 78: qualitative 2D effective chiral medium using a signed magnetoelectric coupling kappa.",
  bianisotropicMedium: "Atlas 79: qualitative 2D effective bianisotropic block with magnetoelectric coupling kappa.",
  gyrotropicMedium: "Atlas 80: qualitative gyrotropic epsilon tensor in the Hz solver, using eps_xy = +g and eps_yx = -g.",
  braggStack: "Atlas 81: 1D periodic Bragg stack.",
  photonicCrystal: "Atlas 82: square lattice of high-index rods.",
  phcPointDefect: "Atlas 83: photonic crystal with one missing central rod.",
  phcWaveguide: "Atlas 84: photonic crystal line-defect waveguide.",
  phcDisorder: "Atlas 86: photonic crystal with deterministic positional disorder.",
  fanoResonator: "Atlas 90: straight guide with a side-coupled dielectric resonator.",
  sshTrivial: "Atlas 91: qualitative SSH chain with d1 > d2.",
  sshTopological: "Atlas 92: qualitative SSH chain with d1 < d2.",
  sshInterface: "Atlas 93: interface between two SSH dimerizations.",
  sppInterface: "Atlas 101: Drude metal-dielectric interface excited by a near-field dipole.",
  sppGrating: "Atlas 102: shallow Drude grating for qualitative SPP coupling.",
  localizedPlasmon: "Atlas 103: localized plasmon on a Drude nanodisk.",
  plasmonicDimer: "Atlas 104: two Drude disks with a narrow hot gap.",
  metasurfacePhaseBars: "Atlas 105: phase-gradient metasurface approximated by dielectric bars.",
  negativeIndexSlab: "Atlas 107: constant eps < 0 and mu < 0 slab. This is idealized and can be numerically delicate.",
  superlensSlab: "Atlas 108: idealized eps = -1, mu = -1 superlens slab.",
  enzEmitter: "Atlas 110: dipole close to an ENZ slab.",
  kerrSlab: "Atlas 111: instantaneous Kerr slab with epsilon updated from normalized field intensity.",
  shgSlab: "Atlas 112: chi2 nonlinear slab using a polarization-current source for second-harmonic generation.",
  thgSlab: "Atlas 113: chi3 nonlinear slab using a polarization-current source for third-harmonic generation.",
  vo2SwitchingSlab: "Atlas 116: VO2-like phase-change slab with intensity threshold, hysteresis, and finite switching time.",
  pcmMemoryCell: "Atlas 117: small phase-change memory cell embedded in a guide; the switched state persists after the field is cleared.",
  temporalModulation: "Atlas 123: region tagged with the current sinusoidal epsilon modulation model.",
  travelingModulation: "Atlas 126: guide section tagged with traveling epsilon modulation.",
  ptSymmetricCoupler: "Atlas 131: PT-symmetric coupled guides with balanced gain/loss and saturable gain stabilization.",
};

const BOUNDARY_SIDES = ["left", "right", "top", "bottom"];
const defaultBoundarySides = {
  left: "absorbing",
  right: "absorbing",
  top: "absorbing",
  bottom: "absorbing",
};
const boundarySideLabels = {
  left: "Left",
  right: "Right",
  top: "Top",
  bottom: "Bottom",
};

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

const state = {
  running: false,
  theme: initialTheme(),
  stepsPerFrame: 1,
  gain: 1,
  autoScale: true,
  fieldComponent: "ez",
  fieldDisplay: "scalar",
  fieldQuiver: false,
  diagnosticsEnabled: true,
  analysisEnabled: true,
  analysisSampleEvery: 4,
  sweepMode: "angle",
  sweepStart: 0,
  sweepEnd: 70,
  sweepSamples: 9,
  sweepSteps: 720,
  sweepRunning: false,
  sweepCancelRequested: false,
  sweepResults: [],
  viewMode: "field",
  viewProjection: "2d",
  materialPart: "real",
  canvasMode: "select",
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

document.documentElement.dataset.theme = state.theme;

let selectedMaterialRegion = null;

function normalizeBoundaryMode(mode) {
  return mode === "reflective" ? "reflective" : "absorbing";
}

function normalizeDispersionModel(model) {
  return ["drude", "plasma", "lorentz", "debye"].includes(model) ? model : "none";
}

function brushDispersionParams() {
  const model = normalizeDispersionModel(state.dispersionModel);
  if (model === "none") return null;
  return {
    dispersion: model,
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

function brushBianisotropyValue() {
  return state.materialBianisotropyEnabled ? clamp(Number(state.bianisotropyKappa) || 0, -5, 5) : 0;
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
  if (state.brush === "custom" && state.materialBianisotropyEnabled) return "Custom magnetoelectric κ";
  if (state.brush === "custom" && state.materialGyrotropyEnabled) return "Custom gyrotropic ε tensor";
  return state.brush === "custom" && state.customAnisotropic ? "Custom anisotropic ε, μ" : materialNames[state.brush];
}

const el = {
  canvas: document.getElementById("simCanvas"),
  canvasFrame: document.querySelector(".canvas-frame"),
  themeButtons: document.querySelectorAll("[data-theme-choice]"),
  fieldComponentButtons: document.querySelectorAll("[data-field-component]"),
  viewModeButtons: document.querySelectorAll("[data-view-mode]"),
  fieldViewButton: document.querySelector('[data-view-mode="field"]'),
  fieldDisplayControl: document.getElementById("fieldDisplayControl"),
  fieldDisplayButtons: document.querySelectorAll("[data-field-display]"),
  fieldQuiverControl: document.getElementById("fieldQuiverControl"),
  fieldQuiverInput: document.getElementById("fieldQuiverInput"),
  fieldQuiverLabel: document.getElementById("fieldQuiverLabel"),
  viewProjectionButtons: document.querySelectorAll("[data-view-projection]"),
  materialPartControl: document.getElementById("materialPartControl"),
  materialPartButtons: document.querySelectorAll("[data-material-part]"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  playPauseIcon: document.getElementById("playPauseIcon"),
  stepBtn: document.getElementById("stepBtn"),
  resetBtn: document.getElementById("resetBtn"),
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
  sweepModeInput: document.getElementById("sweepModeInput"),
  sweepStartInput: document.getElementById("sweepStartInput"),
  sweepEndInput: document.getElementById("sweepEndInput"),
  sweepSamplesInput: document.getElementById("sweepSamplesInput"),
  sweepStepsInput: document.getElementById("sweepStepsInput"),
  sweepRunBtn: document.getElementById("sweepRunBtn"),
  sweepStatus: document.getElementById("sweepStatus"),
  sweepChart: document.getElementById("sweepChart"),
  analysisInput: document.getElementById("analysisInput"),
  analysisResetBtn: document.getElementById("analysisResetBtn"),
  analysisStatus: document.getElementById("analysisStatus"),
  spectrumChart: document.getElementById("spectrumChart"),
  farFieldChart: document.getElementById("farFieldChart"),
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
  sceneNote: document.getElementById("sceneNote"),
  slabThicknessControl: document.getElementById("slabThicknessControl"),
  slabThicknessInput: document.getElementById("slabThicknessInput"),
  slabThicknessOutput: document.getElementById("slabThicknessOutput"),
  gridNxInput: document.getElementById("gridNxInput"),
  gridNyInput: document.getElementById("gridNyInput"),
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
  fieldMetricSymbol: document.getElementById("fieldMetricSymbol"),
  fieldMetricUnit: document.getElementById("fieldMetricUnit"),
  energyValue: document.getElementById("energyValue"),
  fluxLeftOutput: document.getElementById("fluxLeftOutput"),
  diagnosticAngleOutput: document.getElementById("diagnosticAngleOutput"),
  reflectedPowerOutput: document.getElementById("reflectedPowerOutput"),
  fluxRightOutput: document.getElementById("fluxRightOutput"),
  reflectanceOutput: document.getElementById("reflectanceOutput"),
  transmittanceOutput: document.getElementById("transmittanceOutput"),
  gridLabel: document.getElementById("gridLabel"),
  materialLabel: document.getElementById("materialLabel"),
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

function align4(value) {
  return (value + 3) & ~3;
}

function updateCanvasAspectRatio(nx = state.gridNx, ny = state.gridNy) {
  if (!el.canvasFrame) return;
  const safeNx = Math.max(1, Number(nx) || DEFAULT_GRID.nx);
  const safeNy = Math.max(1, Number(ny) || DEFAULT_GRID.ny);
  const physicalAspect = safeNx / safeNy;
  const displayAspect = clamp(physicalAspect, MIN_CANVAS_DISPLAY_ASPECT, MAX_CANVAS_DISPLAY_ASPECT);
  const viewportHeight = Math.max(1, window.innerHeight || MAX_CANVAS_DISPLAY_HEIGHT);
  const targetHeight = clamp(
    viewportHeight * CANVAS_DISPLAY_VIEWPORT_FRACTION,
    MIN_CANVAS_DISPLAY_HEIGHT,
    MAX_CANVAS_DISPLAY_HEIGHT
  );
  el.canvasFrame.style.setProperty("--sim-aspect-ratio", `${displayAspect} / 1`);
  el.canvasFrame.style.setProperty("--sim-frame-width-limit", `${displayAspect * targetHeight}px`);
  el.canvasFrame.dataset.aspectCapped = String(Math.abs(displayAspect - physicalAspect) > 1e-6);
}

class WasmFdtdBackend {
  constructor(memory, exports) {
    this.memory = memory;
    this.exports = exports;
    this.layout = null;
  }

  static async load(url) {
    const memory = new WebAssembly.Memory({ initial: 1, maximum: WASM_MAX_PAGES });
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load ${url}: ${response.status}`);
    }
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, { env: { memory } });
    return new WasmFdtdBackend(memory, instance.exports);
  }

  createLayout(nx, ny) {
    const offsets = {};
    let cursor = 0;
    const f32 = (name, length) => {
      cursor = align4(cursor);
      offsets[name] = cursor;
      cursor += length * Float32Array.BYTES_PER_ELEMENT;
    };
    const u8 = (name, length) => {
      offsets[name] = cursor;
      cursor += length;
    };

    const n = nx * ny;
    f32("ez", n);
    f32("ezx", n);
    f32("ezy", n);
    f32("hx", n);
    f32("hy", n);
    f32("eps", n);
    f32("loss", n);
    f32("epsY", n);
    f32("lossY", n);
    f32("mu", n);
    f32("muLoss", n);
    f32("muY", n);
    f32("muLossY", n);
    u8("material", n);
    f32("eCaX", nx);
    f32("eCbX", nx);
    f32("hCaX", nx);
    f32("hCbX", nx);
    f32("eCaY", ny);
    f32("eCbY", ny);
    f32("hCaY", ny);
    f32("hCbY", ny);

    return {
      offsets,
      totalBytes: align4(cursor),
    };
  }

  ensureCapacity(totalBytes) {
    const currentPages = this.memory.buffer.byteLength / WASM_PAGE_BYTES;
    const requiredPages = Math.ceil(totalBytes / WASM_PAGE_BYTES);
    if (requiredPages > WASM_MAX_PAGES) {
      throw new Error("WASM memory limit exceeded");
    }
    if (requiredPages > currentPages) {
      this.memory.grow(requiredPages - currentPages);
    }
  }

  configure(sim) {
    const layout = this.createLayout(sim.nx, sim.ny);
    this.ensureCapacity(layout.totalBytes);
    this.layout = layout;
    const buffer = this.memory.buffer;
    const n = sim.n;
    const o = layout.offsets;

    sim.ez = new Float32Array(buffer, o.ez, n);
    sim.ezx = new Float32Array(buffer, o.ezx, n);
    sim.ezy = new Float32Array(buffer, o.ezy, n);
    sim.hx = new Float32Array(buffer, o.hx, n);
    sim.hy = new Float32Array(buffer, o.hy, n);
    sim.eps = new Float32Array(buffer, o.eps, n);
    sim.loss = new Float32Array(buffer, o.loss, n);
    sim.epsY = new Float32Array(buffer, o.epsY, n);
    sim.lossY = new Float32Array(buffer, o.lossY, n);
    sim.mu = new Float32Array(buffer, o.mu, n);
    sim.muLoss = new Float32Array(buffer, o.muLoss, n);
    sim.muY = new Float32Array(buffer, o.muY, n);
    sim.muLossY = new Float32Array(buffer, o.muLossY, n);
    sim.material = new Uint8Array(buffer, o.material, n);
    sim.eCaX = new Float32Array(buffer, o.eCaX, sim.nx);
    sim.eCbX = new Float32Array(buffer, o.eCbX, sim.nx);
    sim.hCaX = new Float32Array(buffer, o.hCaX, sim.nx);
    sim.hCbX = new Float32Array(buffer, o.hCbX, sim.nx);
    sim.eCaY = new Float32Array(buffer, o.eCaY, sim.ny);
    sim.eCbY = new Float32Array(buffer, o.eCbY, sim.ny);
    sim.hCaY = new Float32Array(buffer, o.hCaY, sim.ny);
    sim.hCbY = new Float32Array(buffer, o.hCbY, sim.ny);
  }

  step(sim) {
    const o = this.layout.offsets;
    const stepExport = state.fieldComponent === "hz" ? this.exports.step_hz : this.exports.step;
    stepExport(
      sim.nx,
      sim.ny,
      sim.courant,
      o.ez,
      o.ezx,
      o.ezy,
      o.hx,
      o.hy,
      o.eps,
      o.loss,
      o.epsY,
      o.lossY,
      o.mu,
      o.muLoss,
      o.muY,
      o.muLossY,
      o.material,
      o.eCaX,
      o.eCbX,
      o.eCaY,
      o.eCbY,
      o.hCaX,
      o.hCbX,
      o.hCaY,
      o.hCbY
    );
  }

  canStep(component) {
    return component === "hz" ? typeof this.exports.step_hz === "function" : typeof this.exports.step === "function";
  }
}

class FDTDSim {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.courant = COURANT;
    this.wasmBackend = null;
    this.viewX = 0;
    this.viewY = 0;
    this.viewZoom = 1;
    this.fieldScale = 1;
    this.fieldLog10Scale = 0;
    this.renormalizedCount = 0;
    this.lastRenormalized = false;
    this.lastDiverged = false;
    this.resize(config.nx, config.ny);
  }

  allocateArrays() {
    if (this.wasmBackend) {
      this.wasmBackend.configure(this);
    } else {
      this.ez = new Float32Array(this.n);
      this.ezx = new Float32Array(this.n);
      this.ezy = new Float32Array(this.n);
      this.hx = new Float32Array(this.n);
      this.hy = new Float32Array(this.n);
      this.eps = new Float32Array(this.n);
      this.loss = new Float32Array(this.n);
      this.epsY = new Float32Array(this.n);
      this.lossY = new Float32Array(this.n);
      this.mu = new Float32Array(this.n);
      this.muLoss = new Float32Array(this.n);
      this.muY = new Float32Array(this.n);
      this.muLossY = new Float32Array(this.n);
      this.material = new Uint8Array(this.n);
      this.eCaX = new Float32Array(this.nx);
      this.eCbX = new Float32Array(this.nx);
      this.hCaX = new Float32Array(this.nx);
      this.hCbX = new Float32Array(this.nx);
      this.eCaY = new Float32Array(this.ny);
      this.eCbY = new Float32Array(this.ny);
      this.hCaY = new Float32Array(this.ny);
      this.hCbY = new Float32Array(this.ny);
    }
    this.modulatedMaterial = new Uint8Array(this.n);
    this.nonlinearMaterial = new Uint8Array(this.n);
    this.dispersiveMaterial = new Uint8Array(this.n);
    this.gyrotropicMaterial = new Uint8Array(this.n);
    this.gyrotropyG = new Float32Array(this.n);
    this.bianisotropicMaterial = new Uint8Array(this.n);
    this.bianisotropyKappa = new Float32Array(this.n);
    this.bianisotropyPrevScalar = new Float32Array(this.n);
    this.phaseChangeMaterial = new Uint8Array(this.n);
    this.phaseState = new Float32Array(this.n);
    this.phaseEpsOff = new Float32Array(this.n);
    this.phaseLossOff = new Float32Array(this.n);
    this.phaseEpsYOff = new Float32Array(this.n);
    this.phaseLossYOff = new Float32Array(this.n);
    this.phaseEpsOn = new Float32Array(this.n);
    this.phaseLossOn = new Float32Array(this.n);
    this.phaseEpsYOn = new Float32Array(this.n);
    this.phaseLossYOn = new Float32Array(this.n);
    this.conductivity = new Float32Array(this.n);
    this.conductivityY = new Float32Array(this.n);
    this.modulationBaseEps = new Float32Array(this.n);
    this.modulationBaseEpsY = new Float32Array(this.n);
    this.dispersionOmegaP = new Float32Array(this.n);
    this.dispersionGamma = new Float32Array(this.n);
    this.dispersionOmega0 = new Float32Array(this.n);
    this.dispersionDeltaEps = new Float32Array(this.n);
    this.dispersionTau = new Float32Array(this.n);
    this.dispPz = new Float32Array(this.n);
    this.dispJz = new Float32Array(this.n);
    this.dispPx = new Float32Array(this.n);
    this.dispJx = new Float32Array(this.n);
    this.dispPy = new Float32Array(this.n);
    this.dispJy = new Float32Array(this.n);
    this.harmonicPrevPz = new Float32Array(this.n);
    this.harmonicPrevPx = new Float32Array(this.n);
    this.harmonicPrevPy = new Float32Array(this.n);
  }

  resize(nx, ny) {
    this.nx = nx;
    this.ny = ny;
    this.n = nx * ny;
    this.allocateArrays();
    this.pmlLayer = 0;
    this.time = 0;
    this.lastMax = 0;
    this.lastMaxLog10 = -Infinity;
    this.lastEnergy = 0;
    this.lastEnergyLog10 = -Infinity;
    this.lastViewRange = 1;
    this.lastViewRangeLog10 = 0;
    this.resetDiagnostics();
    this.fieldScale = 1;
    this.fieldLog10Scale = 0;
    this.renormalizedCount = 0;
    this.lastRenormalized = false;
    this.lastDiverged = false;
    this.offscreen = document.createElement("canvas");
    this.offscreen.width = nx;
    this.offscreen.height = ny;
    this.offscreenCtx = this.offscreen.getContext("2d", { alpha: false });
    this.image = this.offscreenCtx.createImageData(nx, ny);
    this.clearMaterials(false);
    this.resetFields();
    this.buildBoundary(state.boundary);
    this.resetView();
    updateCanvasAspectRatio(nx, ny);
    this.fitCanvas();
  }

  maxViewZoom() {
    return Math.max(1, Math.min(80, this.nx / 8, this.ny / 8));
  }

  visibleGridWidth() {
    return this.nx / this.viewZoom;
  }

  visibleGridHeight() {
    return this.ny / this.viewZoom;
  }

  resetView() {
    this.viewZoom = 1;
    this.viewX = 0;
    this.viewY = 0;
  }

  clampView() {
    this.viewZoom = clamp(this.viewZoom, 1, this.maxViewZoom());
    const viewWidth = this.visibleGridWidth();
    const viewHeight = this.visibleGridHeight();
    this.viewX = viewWidth >= this.nx ? 0 : clamp(this.viewX, 0, this.nx - viewWidth);
    this.viewY = viewHeight >= this.ny ? 0 : clamp(this.viewY, 0, this.ny - viewHeight);
  }

  zoomAtClientPoint(clientX, clientY, factor) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const fracX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const fracY = clamp((clientY - rect.top) / rect.height, 0, 1);
    const worldX = this.viewX + fracX * this.visibleGridWidth();
    const worldY = this.viewY + fracY * this.visibleGridHeight();
    const nextZoom = clamp(this.viewZoom * factor, 1, this.maxViewZoom());
    if (Math.abs(nextZoom - this.viewZoom) < 1e-6) return false;
    this.viewZoom = nextZoom;
    this.viewX = worldX - fracX * this.visibleGridWidth();
    this.viewY = worldY - fracY * this.visibleGridHeight();
    this.clampView();
    return true;
  }

  setZoomFromGesture(anchorClientX, anchorClientY, anchorWorldX, anchorWorldY, nextZoom) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const fracX = clamp((anchorClientX - rect.left) / rect.width, 0, 1);
    const fracY = clamp((anchorClientY - rect.top) / rect.height, 0, 1);
    this.viewZoom = clamp(nextZoom, 1, this.maxViewZoom());
    this.viewX = anchorWorldX - fracX * this.visibleGridWidth();
    this.viewY = anchorWorldY - fracY * this.visibleGridHeight();
    this.clampView();
    return true;
  }

  panByClientDelta(deltaX, deltaY) {
    if (this.viewZoom <= 1) return false;
    const rect = this.canvas.getBoundingClientRect();
    this.viewX -= (deltaX / Math.max(1, rect.width)) * this.visibleGridWidth();
    this.viewY -= (deltaY / Math.max(1, rect.height)) * this.visibleGridHeight();
    this.clampView();
    return true;
  }

  clientToGridFloat(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const fracX = rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;
    const fracY = rect.height > 0 ? clamp((clientY - rect.top) / rect.height, 0, 1) : 0;
    return {
      x: this.viewX + fracX * this.visibleGridWidth(),
      y: this.viewY + fracY * this.visibleGridHeight(),
    };
  }

  clientToGridCell(clientX, clientY) {
    const point = this.clientToGridFloat(clientX, clientY);
    return {
      x: clampInt(Math.floor(point.x), 1, this.nx - 2),
      y: clampInt(Math.floor(point.y), 1, this.ny - 2),
    };
  }

  gridToCanvasX(x) {
    return ((x - this.viewX) / this.visibleGridWidth()) * this.canvas.width;
  }

  gridToCanvasY(y) {
    return ((y - this.viewY) / this.visibleGridHeight()) * this.canvas.height;
  }

  gridRectToCanvas(x0, y0, x1, y1) {
    const visibleX0 = Math.max(x0, this.viewX);
    const visibleY0 = Math.max(y0, this.viewY);
    const visibleX1 = Math.min(x1, this.viewX + this.visibleGridWidth());
    const visibleY1 = Math.min(y1, this.viewY + this.visibleGridHeight());
    if (visibleX1 <= visibleX0 || visibleY1 <= visibleY0) return null;
    const left = this.gridToCanvasX(visibleX0);
    const top = this.gridToCanvasY(visibleY0);
    const right = this.gridToCanvasX(visibleX1);
    const bottom = this.gridToCanvasY(visibleY1);
    return {
      left,
      top,
      width: right - left,
      height: bottom - top,
    };
  }

  attachWasmBackend(backend) {
    if (this.wasmBackend) return;
    const previous = {
      ez: new Float32Array(this.ez),
      ezx: new Float32Array(this.ezx),
      ezy: new Float32Array(this.ezy),
      hx: new Float32Array(this.hx),
      hy: new Float32Array(this.hy),
      eps: new Float32Array(this.eps),
      loss: new Float32Array(this.loss),
      epsY: new Float32Array(this.epsY),
      lossY: new Float32Array(this.lossY),
      mu: new Float32Array(this.mu),
      muLoss: new Float32Array(this.muLoss),
      muY: new Float32Array(this.muY),
      muLossY: new Float32Array(this.muLossY),
      material: new Uint8Array(this.material),
      modulatedMaterial: new Uint8Array(this.modulatedMaterial),
      nonlinearMaterial: new Uint8Array(this.nonlinearMaterial),
      dispersiveMaterial: new Uint8Array(this.dispersiveMaterial),
      gyrotropicMaterial: new Uint8Array(this.gyrotropicMaterial),
      gyrotropyG: new Float32Array(this.gyrotropyG),
      bianisotropicMaterial: new Uint8Array(this.bianisotropicMaterial),
      bianisotropyKappa: new Float32Array(this.bianisotropyKappa),
      bianisotropyPrevScalar: new Float32Array(this.bianisotropyPrevScalar),
      phaseChangeMaterial: new Uint8Array(this.phaseChangeMaterial),
      phaseState: new Float32Array(this.phaseState),
      phaseEpsOff: new Float32Array(this.phaseEpsOff),
      phaseLossOff: new Float32Array(this.phaseLossOff),
      phaseEpsYOff: new Float32Array(this.phaseEpsYOff),
      phaseLossYOff: new Float32Array(this.phaseLossYOff),
      phaseEpsOn: new Float32Array(this.phaseEpsOn),
      phaseLossOn: new Float32Array(this.phaseLossOn),
      phaseEpsYOn: new Float32Array(this.phaseEpsYOn),
      phaseLossYOn: new Float32Array(this.phaseLossYOn),
      conductivity: new Float32Array(this.conductivity),
      conductivityY: new Float32Array(this.conductivityY),
      modulationBaseEps: new Float32Array(this.modulationBaseEps),
      modulationBaseEpsY: new Float32Array(this.modulationBaseEpsY),
      dispersionOmegaP: new Float32Array(this.dispersionOmegaP),
      dispersionGamma: new Float32Array(this.dispersionGamma),
      dispersionOmega0: new Float32Array(this.dispersionOmega0),
      dispersionDeltaEps: new Float32Array(this.dispersionDeltaEps),
      dispersionTau: new Float32Array(this.dispersionTau),
      harmonicPrevPz: new Float32Array(this.harmonicPrevPz),
      harmonicPrevPx: new Float32Array(this.harmonicPrevPx),
      harmonicPrevPy: new Float32Array(this.harmonicPrevPy),
    };

    this.wasmBackend = backend;
    this.wasmBackend.configure(this);
    this.modulatedMaterial = new Uint8Array(this.n);
    this.nonlinearMaterial = new Uint8Array(this.n);
    this.dispersiveMaterial = new Uint8Array(this.n);
    this.gyrotropicMaterial = new Uint8Array(this.n);
    this.gyrotropyG = new Float32Array(this.n);
    this.bianisotropicMaterial = new Uint8Array(this.n);
    this.bianisotropyKappa = new Float32Array(this.n);
    this.bianisotropyPrevScalar = new Float32Array(this.n);
    this.phaseChangeMaterial = new Uint8Array(this.n);
    this.phaseState = new Float32Array(this.n);
    this.phaseEpsOff = new Float32Array(this.n);
    this.phaseLossOff = new Float32Array(this.n);
    this.phaseEpsYOff = new Float32Array(this.n);
    this.phaseLossYOff = new Float32Array(this.n);
    this.phaseEpsOn = new Float32Array(this.n);
    this.phaseLossOn = new Float32Array(this.n);
    this.phaseEpsYOn = new Float32Array(this.n);
    this.phaseLossYOn = new Float32Array(this.n);
    this.conductivity = new Float32Array(this.n);
    this.conductivityY = new Float32Array(this.n);
    this.modulationBaseEps = new Float32Array(this.n);
    this.modulationBaseEpsY = new Float32Array(this.n);
    this.dispersionOmegaP = new Float32Array(this.n);
    this.dispersionGamma = new Float32Array(this.n);
    this.dispersionOmega0 = new Float32Array(this.n);
    this.dispersionDeltaEps = new Float32Array(this.n);
    this.dispersionTau = new Float32Array(this.n);
    this.dispPz = new Float32Array(this.n);
    this.dispJz = new Float32Array(this.n);
    this.dispPx = new Float32Array(this.n);
    this.dispJx = new Float32Array(this.n);
    this.dispPy = new Float32Array(this.n);
    this.dispJy = new Float32Array(this.n);
    this.harmonicPrevPz = new Float32Array(this.n);
    this.harmonicPrevPx = new Float32Array(this.n);
    this.harmonicPrevPy = new Float32Array(this.n);
    this.ez.set(previous.ez);
    this.ezx.set(previous.ezx);
    this.ezy.set(previous.ezy);
    this.hx.set(previous.hx);
    this.hy.set(previous.hy);
    this.eps.set(previous.eps);
    this.loss.set(previous.loss);
    this.epsY.set(previous.epsY);
    this.lossY.set(previous.lossY);
    this.mu.set(previous.mu);
    this.muLoss.set(previous.muLoss);
    this.muY.set(previous.muY);
    this.muLossY.set(previous.muLossY);
    this.material.set(previous.material);
    this.modulatedMaterial.set(previous.modulatedMaterial);
    this.nonlinearMaterial.set(previous.nonlinearMaterial);
    this.dispersiveMaterial.set(previous.dispersiveMaterial);
    this.gyrotropicMaterial.set(previous.gyrotropicMaterial);
    this.gyrotropyG.set(previous.gyrotropyG);
    this.bianisotropicMaterial.set(previous.bianisotropicMaterial);
    this.bianisotropyKappa.set(previous.bianisotropyKappa);
    this.bianisotropyPrevScalar.set(previous.bianisotropyPrevScalar);
    this.phaseChangeMaterial.set(previous.phaseChangeMaterial);
    this.phaseState.set(previous.phaseState);
    this.phaseEpsOff.set(previous.phaseEpsOff);
    this.phaseLossOff.set(previous.phaseLossOff);
    this.phaseEpsYOff.set(previous.phaseEpsYOff);
    this.phaseLossYOff.set(previous.phaseLossYOff);
    this.phaseEpsOn.set(previous.phaseEpsOn);
    this.phaseLossOn.set(previous.phaseLossOn);
    this.phaseEpsYOn.set(previous.phaseEpsYOn);
    this.phaseLossYOn.set(previous.phaseLossYOn);
    this.conductivity.set(previous.conductivity);
    this.conductivityY.set(previous.conductivityY);
    this.modulationBaseEps.set(previous.modulationBaseEps);
    this.modulationBaseEpsY.set(previous.modulationBaseEpsY);
    this.dispersionOmegaP.set(previous.dispersionOmegaP);
    this.dispersionGamma.set(previous.dispersionGamma);
    this.dispersionOmega0.set(previous.dispersionOmega0);
    this.dispersionDeltaEps.set(previous.dispersionDeltaEps);
    this.dispersionTau.set(previous.dispersionTau);
    this.harmonicPrevPz.set(previous.harmonicPrevPz);
    this.harmonicPrevPx.set(previous.harmonicPrevPx);
    this.harmonicPrevPy.set(previous.harmonicPrevPy);
    this.buildBoundary(state.boundary);
    this.clearPmlMaterials();
    this.zeroBoundaryFields();
  }

  engineLabel() {
    if (
      state.materialModulationEnabled ||
      state.materialNonlinearEnabled ||
      state.materialHarmonicEnabled ||
      state.materialDispersionEnabled ||
      state.materialSaturableGainEnabled ||
      state.materialPhaseChangeEnabled ||
      state.materialGyrotropyEnabled ||
      state.materialBianisotropyEnabled
    ) {
      if (state.materialBianisotropyEnabled) return "JS bianiso";
      if (state.materialGyrotropyEnabled) return "JS tensor";
      if (state.materialPhaseChangeEnabled) return "JS memory";
      return state.materialSaturableGainEnabled ? "JS gain" : "JS dynamic";
    }
    if (state.materialConductivityEnabled) return "JS sigma";
    return this.wasmBackend?.canStep(state.fieldComponent) ? "WASM" : "JS";
  }

  hasDynamicMaterialResponse() {
    return Boolean(
      state.materialModulationEnabled ||
        state.materialNonlinearEnabled ||
        state.materialHarmonicEnabled ||
        state.materialDispersionEnabled ||
        state.materialConductivityEnabled ||
        state.materialSaturableGainEnabled ||
        state.materialPhaseChangeEnabled ||
        state.materialGyrotropyEnabled ||
        state.materialBianisotropyEnabled
    );
  }

  id(x, y) {
    return x + y * this.nx;
  }

  fitCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  buildBoundary() {
    normalizeBoundarySides();
    const layer = anyAbsorbingBoundarySide() ? this.nominalBoundaryLayer() : 0;
    const order = 4;
    const targetReflection = 1e-10;
    const sigmaMax = layer > 0 ? (-Math.log(targetReflection) * (order + 1)) / (2 * layer) : 0;
    this.pmlLayer = layer;

    const fillProfile = (ca, cb, length, offset, minSideAbsorbing, maxSideAbsorbing) => {
      const edge = length - 1;
      for (let i = 0; i < length; i += 1) {
        let sigma = 0;
        if (layer > 0) {
          const position = i + offset;
          const leftDepth = minSideAbsorbing ? layer - position : 0;
          const rightDepth = maxSideAbsorbing ? layer - (edge - position) : 0;
          const depth = Math.max(leftDepth, rightDepth, 0);
          if (depth > 0) {
            const normalizedDepth = depth / layer;
            sigma = this.courant * sigmaMax * Math.pow(normalizedDepth, order);
          }
        }

        if (sigma > 1e-9) {
          const decay = Math.exp(-sigma);
          ca[i] = decay;
          cb[i] = (1 - decay) / sigma;
        } else {
          ca[i] = 1;
          cb[i] = 1;
        }
      }
    };

    fillProfile(this.eCaX, this.eCbX, this.nx, 0, boundarySideIsAbsorbing("left"), boundarySideIsAbsorbing("right"));
    fillProfile(this.eCaY, this.eCbY, this.ny, 0, boundarySideIsAbsorbing("top"), boundarySideIsAbsorbing("bottom"));
    fillProfile(this.hCaX, this.hCbX, this.nx, 0.5, boundarySideIsAbsorbing("left"), boundarySideIsAbsorbing("right"));
    fillProfile(this.hCaY, this.hCbY, this.ny, 0.5, boundarySideIsAbsorbing("top"), boundarySideIsAbsorbing("bottom"));
    this.refreshPmlMaterialContinuation(false);
  }

  nominalBoundaryLayer() {
    const smallestDimension = Math.min(this.nx, this.ny);
    const wavelengthLayer = Math.round(state.cellsPerWavelength * 0.9);
    const fractionalLayer = Math.round(smallestDimension * 0.16);
    const desiredLayer = Math.max(18, wavelengthLayer, fractionalLayer);
    const maxLayer = Math.max(10, Math.floor(smallestDimension * 0.24));
    return Math.min(desiredLayer, maxLayer);
  }

  boundaryControlLayer() {
    return this.pmlLayer > 0 ? this.pmlLayer : this.nominalBoundaryLayer();
  }

  zeroOuterElectricField() {
    const nx = this.nx;
    const ny = this.ny;
    for (let x = 0; x < nx; x += 1) {
      this.zeroElectricCell(x);
      this.zeroElectricCell(x + (ny - 1) * nx);
    }
    for (let y = 0; y < ny; y += 1) {
      this.zeroElectricCell(y * nx);
      this.zeroElectricCell(y * nx + nx - 1);
    }
  }

  zeroOuterBoundaryFields() {
    const nx = this.nx;
    const ny = this.ny;
    this.zeroOuterElectricField();
    for (let x = 0; x < nx; x += 1) {
      const top = x;
      const bottom = x + (ny - 1) * nx;
      this.hx[top] = 0;
      this.hy[top] = 0;
      this.hx[bottom] = 0;
      this.hy[bottom] = 0;
    }
    for (let y = 0; y < ny; y += 1) {
      const left = y * nx;
      const right = left + nx - 1;
      this.hx[left] = 0;
      this.hy[left] = 0;
      this.hx[right] = 0;
      this.hy[right] = 0;
    }
  }

  zeroReflectiveBoundaryFields() {
    const layer = this.boundaryControlLayer();
    if (layer <= 0) return;

    const zeroRect = (x0, y0, x1, y1) => {
      const minX = clampInt(x0, 0, this.nx);
      const minY = clampInt(y0, 0, this.ny);
      const maxX = clampInt(x1, 0, this.nx);
      const maxY = clampInt(y1, 0, this.ny);
      for (let y = minY; y < maxY; y += 1) {
        const row = y * this.nx;
        for (let x = minX; x < maxX; x += 1) {
          const idx = row + x;
          this.zeroElectricCell(idx);
          this.hx[idx] = 0;
          this.hy[idx] = 0;
        }
      }
    };

    if (!boundarySideIsAbsorbing("left")) zeroRect(0, 0, layer, this.ny);
    if (!boundarySideIsAbsorbing("right")) zeroRect(this.nx - layer, 0, this.nx, this.ny);
    if (!boundarySideIsAbsorbing("top")) zeroRect(0, 0, this.nx, layer);
    if (!boundarySideIsAbsorbing("bottom")) zeroRect(0, this.ny - layer, this.nx, this.ny);
  }

  zeroBoundaryFields() {
    this.zeroOuterBoundaryFields();
    this.zeroReflectiveBoundaryFields();
  }

  resetFields() {
    this.ez.fill(0);
    this.ezx.fill(0);
    this.ezy.fill(0);
    this.hx.fill(0);
    this.hy.fill(0);
    this.restoreDynamicMaterialsToBase?.();
    this.dispPz?.fill(0);
    this.dispJz?.fill(0);
    this.dispPx?.fill(0);
    this.dispJx?.fill(0);
    this.dispPy?.fill(0);
    this.dispJy?.fill(0);
    this.bianisotropyPrevScalar?.fill(0);
    this.harmonicPrevPz?.fill(0);
    this.harmonicPrevPx?.fill(0);
    this.harmonicPrevPy?.fill(0);
    this.time = 0;
    this.lastMax = 0;
    this.lastMaxLog10 = -Infinity;
    this.lastEnergy = 0;
    this.lastEnergyLog10 = -Infinity;
    this.lastViewRange = 1;
    this.lastViewRangeLog10 = 0;
    this.resetDiagnostics();
    this.fieldScale = 1;
    this.fieldLog10Scale = 0;
    this.lastRenormalized = false;
    this.lastDiverged = false;
  }

  resetDiagnostics() {
    this.diagnosticFluxLeft = 0;
    this.diagnosticFluxRight = 0;
    this.diagnosticReflectedPower = 0;
    this.diagnosticIncidentPower = 0;
    this.diagnosticTransmittedPower = 0;
    this.diagnosticIncidentFlux = 0;
    this.diagnosticReflectance = 0;
    this.diagnosticTransmittance = 0;
    this.diagnosticSamples = 0;
    this.diagnosticAngleDeg = 0;
    this.diagnosticPhasors = {
      incident: { re: 0, im: 0 },
      reflected: { re: 0, im: 0 },
      transmitted: { re: 0, im: 0 },
    };
    this.diagnosticImpedanceLeft = 1;
    this.diagnosticImpedanceRight = 1;
    this.resetAnalysisDiagnostics();
  }

  resetAnalysisDiagnostics() {
    this.analysisSamples = 0;
    this.analysisProbeIndex = 0;
    this.analysisProbeCount = 0;
    this.analysisProbeSeries = new Float32Array(512);
    this.analysisContourKey = "";
    this.analysisContour = [];
    this.analysisContourRe = new Float32Array(0);
    this.analysisContourIm = new Float32Array(0);
    this.analysisFarField = [];
  }

  analysisProbeCell() {
    const x = clampInt(Math.round(this.nx * 0.58), this.activeInteriorMinX(), this.activeInteriorMaxX());
    const y = clampInt(Math.round(this.ny * 0.5), this.activeInteriorMinY(), this.activeInteriorMaxY());
    return this.id(x, y);
  }

  ensureAnalysisContour() {
    const margin = Math.max(3, Math.round(state.cellsPerWavelength * 0.28));
    const minX = clampInt(this.activeInteriorMinX() + margin, 1, this.nx - 2);
    const maxX = clampInt(this.activeInteriorMaxX() - margin, minX + 1, this.nx - 2);
    const minY = clampInt(this.activeInteriorMinY() + margin, 1, this.ny - 2);
    const maxY = clampInt(this.activeInteriorMaxY() - margin, minY + 1, this.ny - 2);
    const stride = Math.max(2, Math.round(state.cellsPerWavelength * 0.16));
    const key = `${this.nx},${this.ny},${minX},${maxX},${minY},${maxY},${stride}`;
    if (key === this.analysisContourKey) return;

    const samples = [];
    const push = (x, y, nx, ny) => samples.push({ x, y, idx: this.id(x, y), nx, ny });
    for (let x = minX; x <= maxX; x += stride) push(x, minY, 0, -1);
    for (let y = minY + stride; y <= maxY; y += stride) push(maxX, y, 1, 0);
    for (let x = maxX - stride; x >= minX; x -= stride) push(x, maxY, 0, 1);
    for (let y = maxY - stride; y > minY; y -= stride) push(minX, y, -1, 0);

    this.analysisContourKey = key;
    this.analysisContour = samples;
    this.analysisContourRe = new Float32Array(samples.length);
    this.analysisContourIm = new Float32Array(samples.length);
    this.analysisFarField = [];
  }

  scalarAnalysisValueAt(idx) {
    const value = this.fieldValueAt(idx, "scalar") * this.fieldPhysicalScale();
    return Number.isFinite(value) ? value : 0;
  }

  updateAnalysisDiagnostics() {
    if (!state.analysisEnabled || this.time % Math.max(1, state.analysisSampleEvery) !== 0) return;
    this.ensureAnalysisContour();
    const frequency = Math.max(1e-6, this.diagnosticFrequency());
    const phase = 2 * Math.PI * frequency * this.time;
    const cosPhase = Math.cos(phase);
    const sinPhase = Math.sin(phase);
    const alpha = this.analysisSamples < 32 ? 0.18 : 0.035;

    const probeValue = this.scalarAnalysisValueAt(this.analysisProbeCell());
    this.analysisProbeSeries[this.analysisProbeIndex] = probeValue;
    this.analysisProbeIndex = (this.analysisProbeIndex + 1) % this.analysisProbeSeries.length;
    this.analysisProbeCount = Math.min(this.analysisProbeCount + 1, this.analysisProbeSeries.length);

    for (let i = 0; i < this.analysisContour.length; i += 1) {
      const sample = this.analysisContour[i];
      const value = this.scalarAnalysisValueAt(sample.idx);
      this.analysisContourRe[i] = (1 - alpha) * this.analysisContourRe[i] + alpha * value * cosPhase;
      this.analysisContourIm[i] = (1 - alpha) * this.analysisContourIm[i] - alpha * value * sinPhase;
    }
    this.analysisSamples += 1;
    this.analysisFarField = [];
  }

  analysisFarFieldEstimate(angleCount = 96) {
    if (!state.analysisEnabled || this.analysisSamples < 4) return [];
    if (this.analysisFarField.length === angleCount) return this.analysisFarField;
    this.ensureAnalysisContour();
    if (this.analysisContour.length === 0) return [];
    const frequency = Math.max(1e-6, this.diagnosticFrequency());
    const k = (2 * Math.PI * frequency) / Math.max(1e-6, this.courant);
    const cx = this.nx * 0.5;
    const cy = this.ny * 0.5;
    const values = [];
    let maxAmp = 0;

    for (let a = 0; a < angleCount; a += 1) {
      const theta = (2 * Math.PI * a) / angleCount;
      const ux = Math.cos(theta);
      const uy = Math.sin(theta);
      let re = 0;
      let im = 0;
      for (let i = 0; i < this.analysisContour.length; i += 1) {
        const sample = this.analysisContour[i];
        const projection = (sample.x - cx) * ux + (sample.y - cy) * uy;
        const phase = k * projection;
        const c = Math.cos(phase);
        const s = Math.sin(phase);
        const er = this.analysisContourRe[i];
        const ei = this.analysisContourIm[i];
        const normalWeight = 0.65 + 0.35 * Math.abs(sample.nx * ux + sample.ny * uy);
        re += normalWeight * (er * c + ei * s);
        im += normalWeight * (ei * c - er * s);
      }
      const amplitude = Math.hypot(re, im);
      if (amplitude > maxAmp) maxAmp = amplitude;
      values.push({ theta, amplitude });
    }

    const scale = maxAmp > 1e-12 ? 1 / maxAmp : 0;
    this.analysisFarField = values.map((point) => ({ theta: point.theta, value: point.amplitude * scale }));
    return this.analysisFarField;
  }

  setFieldLog10Scale(value) {
    this.fieldLog10Scale = value;
    this.fieldScale = value < 300 ? Math.pow(10, value) : Infinity;
  }

  renormalizeFields() {
    const arrays = [this.ez, this.ezx, this.ezy, this.hx, this.hy];
    let maxAbs = 0;

    for (const array of arrays) {
      for (let i = 0; i < array.length; i += 1) {
        const value = array[i];
        if (!Number.isFinite(value)) {
          this.resetFields();
          this.lastDiverged = true;
          return;
        }
        const abs = Math.abs(value);
        if (abs > maxAbs) maxAbs = abs;
      }
    }

    if (maxAbs <= FIELD_RENORMALIZE_HIGH) {
      this.lastRenormalized = false;
      return;
    }

    const factor = maxAbs / FIELD_RENORMALIZE_TARGET;
    for (const array of arrays) {
      for (let i = 0; i < array.length; i += 1) {
        array[i] /= factor;
      }
    }
    this.setFieldLog10Scale(this.fieldLog10Scale + Math.log10(factor));
    this.renormalizedCount += 1;
    this.lastRenormalized = true;
  }

  clearMaterials(resetFields = true) {
    this.material.fill(0);
    this.eps.fill(1);
    this.loss.fill(0);
    this.epsY.fill(1);
    this.lossY.fill(0);
    this.mu.fill(1);
    this.muLoss.fill(0);
    this.muY.fill(1);
    this.muLossY.fill(0);
    this.modulatedMaterial.fill(0);
    this.nonlinearMaterial.fill(0);
    this.dispersiveMaterial.fill(0);
    this.gyrotropicMaterial.fill(0);
    this.gyrotropyG.fill(0);
    this.bianisotropicMaterial.fill(0);
    this.bianisotropyKappa.fill(0);
    this.bianisotropyPrevScalar.fill(0);
    this.phaseChangeMaterial.fill(0);
    this.phaseState.fill(0);
    this.phaseEpsOff.fill(1);
    this.phaseLossOff.fill(0);
    this.phaseEpsYOff.fill(1);
    this.phaseLossYOff.fill(0);
    this.phaseEpsOn.fill(1);
    this.phaseLossOn.fill(0);
    this.phaseEpsYOn.fill(1);
    this.phaseLossYOn.fill(0);
    this.conductivity.fill(0);
    this.conductivityY.fill(0);
    this.modulationBaseEps.fill(1);
    this.modulationBaseEpsY.fill(1);
    this.dispersionOmegaP.fill(0);
    this.dispersionGamma.fill(0);
    this.dispersionOmega0.fill(0);
    this.dispersionDeltaEps.fill(0);
    this.dispersionTau.fill(1);
    this.dispPz.fill(0);
    this.dispJz.fill(0);
    this.dispPx.fill(0);
    this.dispJx.fill(0);
    this.dispPy.fill(0);
    this.dispJy.fill(0);
    this.harmonicPrevPz.fill(0);
    this.harmonicPrevPx.fill(0);
    this.harmonicPrevPy.fill(0);
    this.refreshPmlMaterialContinuation(false);
    if (resetFields) {
      this.resetFields();
    }
  }

  copyMaterialCellByIndex(targetIdx, sourceIdx) {
    this.material[targetIdx] = this.material[sourceIdx];
    this.eps[targetIdx] = this.eps[sourceIdx];
    this.loss[targetIdx] = this.loss[sourceIdx];
    this.epsY[targetIdx] = this.epsY[sourceIdx];
    this.lossY[targetIdx] = this.lossY[sourceIdx];
    this.mu[targetIdx] = this.mu[sourceIdx];
    this.muLoss[targetIdx] = this.muLoss[sourceIdx];
    this.muY[targetIdx] = this.muY[sourceIdx];
    this.muLossY[targetIdx] = this.muLossY[sourceIdx];
    this.modulatedMaterial[targetIdx] = this.modulatedMaterial[sourceIdx];
    this.nonlinearMaterial[targetIdx] = this.nonlinearMaterial[sourceIdx];
    this.dispersiveMaterial[targetIdx] = this.dispersiveMaterial[sourceIdx];
    this.gyrotropicMaterial[targetIdx] = this.gyrotropicMaterial[sourceIdx];
    this.gyrotropyG[targetIdx] = this.gyrotropyG[sourceIdx];
    this.bianisotropicMaterial[targetIdx] = this.bianisotropicMaterial[sourceIdx];
    this.bianisotropyKappa[targetIdx] = this.bianisotropyKappa[sourceIdx];
    this.bianisotropyPrevScalar[targetIdx] = this.bianisotropyPrevScalar[sourceIdx];
    this.phaseChangeMaterial[targetIdx] = this.phaseChangeMaterial[sourceIdx];
    this.phaseState[targetIdx] = this.phaseState[sourceIdx];
    this.phaseEpsOff[targetIdx] = this.phaseEpsOff[sourceIdx];
    this.phaseLossOff[targetIdx] = this.phaseLossOff[sourceIdx];
    this.phaseEpsYOff[targetIdx] = this.phaseEpsYOff[sourceIdx];
    this.phaseLossYOff[targetIdx] = this.phaseLossYOff[sourceIdx];
    this.phaseEpsOn[targetIdx] = this.phaseEpsOn[sourceIdx];
    this.phaseLossOn[targetIdx] = this.phaseLossOn[sourceIdx];
    this.phaseEpsYOn[targetIdx] = this.phaseEpsYOn[sourceIdx];
    this.phaseLossYOn[targetIdx] = this.phaseLossYOn[sourceIdx];
    this.conductivity[targetIdx] = this.conductivity[sourceIdx];
    this.conductivityY[targetIdx] = this.conductivityY[sourceIdx];
    this.modulationBaseEps[targetIdx] = this.modulationBaseEps[sourceIdx];
    this.modulationBaseEpsY[targetIdx] = this.modulationBaseEpsY[sourceIdx];
    this.dispersionOmegaP[targetIdx] = this.dispersionOmegaP[sourceIdx];
    this.dispersionGamma[targetIdx] = this.dispersionGamma[sourceIdx];
    this.dispersionOmega0[targetIdx] = this.dispersionOmega0[sourceIdx];
    this.dispersionDeltaEps[targetIdx] = this.dispersionDeltaEps[sourceIdx];
    this.dispersionTau[targetIdx] = this.dispersionTau[sourceIdx];
    this.dispPz[targetIdx] = this.dispPz[sourceIdx];
    this.dispJz[targetIdx] = this.dispJz[sourceIdx];
    this.dispPx[targetIdx] = this.dispPx[sourceIdx];
    this.dispJx[targetIdx] = this.dispJx[sourceIdx];
    this.dispPy[targetIdx] = this.dispPy[sourceIdx];
    this.dispJy[targetIdx] = this.dispJy[sourceIdx];
    this.harmonicPrevPz[targetIdx] = this.harmonicPrevPz[sourceIdx];
    this.harmonicPrevPx[targetIdx] = this.harmonicPrevPx[sourceIdx];
    this.harmonicPrevPy[targetIdx] = this.harmonicPrevPy[sourceIdx];
  }

  refreshPmlMaterialContinuation(resetPmlFields = false) {
    if (!anyAbsorbingBoundarySide() || this.pmlLayer <= 0) return;
    const minX = boundarySideIsAbsorbing("left") ? this.pmlLayer : 0;
    const minY = boundarySideIsAbsorbing("top") ? this.pmlLayer : 0;
    const maxX = boundarySideIsAbsorbing("right") ? this.nx - this.pmlLayer - 1 : this.nx - 1;
    const maxY = boundarySideIsAbsorbing("bottom") ? this.ny - this.pmlLayer - 1 : this.ny - 1;
    if (maxX < minX || maxY < minY) return;

    for (let y = 0; y < this.ny; y += 1) {
      const sourceY = Math.max(minY, Math.min(maxY, y));
      for (let x = 0; x < this.nx; x += 1) {
        if (!this.isInPml(x, y)) continue;
        const sourceX = Math.max(minX, Math.min(maxX, x));
        const idx = this.id(x, y);
        this.copyMaterialCellByIndex(idx, this.id(sourceX, sourceY));
        if (resetPmlFields || this.material[idx] === 2) {
          this.zeroElectricCell(idx);
          this.hx[idx] = 0;
          this.hy[idx] = 0;
        }
      }
    }
  }

  clearPmlMaterials() {
    this.refreshPmlMaterialContinuation(true);
  }

  isInPml(x, y) {
    return (
      this.pmlLayer > 0 &&
      ((boundarySideIsAbsorbing("left") && x < this.pmlLayer) ||
        (boundarySideIsAbsorbing("right") && x >= this.nx - this.pmlLayer) ||
        (boundarySideIsAbsorbing("top") && y < this.pmlLayer) ||
        (boundarySideIsAbsorbing("bottom") && y >= this.ny - this.pmlLayer))
    );
  }

  isInReflectiveBoundary(x, y) {
    const layer = this.boundaryControlLayer();
    return (
      layer > 0 &&
      ((!boundarySideIsAbsorbing("left") && x < layer) ||
        (!boundarySideIsAbsorbing("right") && x >= this.nx - layer) ||
        (!boundarySideIsAbsorbing("top") && y < layer) ||
        (!boundarySideIsAbsorbing("bottom") && y >= this.ny - layer))
    );
  }

  boundarySideAtCell(x, y) {
    const layer = this.boundaryControlLayer();
    if (layer <= 0) return null;
    const candidates = [];
    if (x < layer) candidates.push({ side: "left", distance: x });
    if (x >= this.nx - layer) candidates.push({ side: "right", distance: this.nx - 1 - x });
    if (y < layer) candidates.push({ side: "top", distance: y });
    if (y >= this.ny - layer) candidates.push({ side: "bottom", distance: this.ny - 1 - y });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0].side;
  }

  isInBoundaryControlRegion(x, y) {
    return Boolean(this.boundarySideAtCell(x, y));
  }

  clientIsInBoundaryControlRegion(clientX, clientY) {
    const point = this.clientToGridCell(clientX, clientY);
    return this.isInBoundaryControlRegion(point.x, point.y);
  }

  boundarySideAtClientPoint(clientX, clientY) {
    const point = this.clientToGridCell(clientX, clientY);
    return this.boundarySideAtCell(point.x, point.y);
  }

  clearBoundarySideMaterials(side) {
    const layer = this.boundaryControlLayer();
    const clearCell = (x, y) => {
      const idx = this.id(x, y);
      this.writeAirCellAtIndex(idx);
      this.zeroElectricCell(idx);
      this.hx[idx] = 0;
      this.hy[idx] = 0;
    };
    if (side === "left") {
      for (let y = 1; y < this.ny - 1; y += 1) {
        for (let x = 1; x < Math.min(this.nx - 1, layer); x += 1) clearCell(x, y);
      }
    } else if (side === "right") {
      for (let y = 1; y < this.ny - 1; y += 1) {
        for (let x = Math.max(1, this.nx - layer); x < this.nx - 1; x += 1) clearCell(x, y);
      }
    } else if (side === "top") {
      for (let y = 1; y < Math.min(this.ny - 1, layer); y += 1) {
        for (let x = 1; x < this.nx - 1; x += 1) clearCell(x, y);
      }
    } else if (side === "bottom") {
      for (let y = Math.max(1, this.ny - layer); y < this.ny - 1; y += 1) {
        for (let x = 1; x < this.nx - 1; x += 1) clearCell(x, y);
      }
    }
  }

  setCellModulation(idx, enabled, baseEps = this.eps[idx], baseEpsY = this.epsY[idx]) {
    this.modulatedMaterial[idx] = enabled ? 1 : 0;
    this.modulationBaseEps[idx] = Number.isFinite(baseEps) ? baseEps : this.eps[idx];
    this.modulationBaseEpsY[idx] = Number.isFinite(baseEpsY) ? baseEpsY : this.epsY[idx];
  }

  setCellNonlinearity(idx, enabled, baseEps = this.eps[idx], baseEpsY = this.epsY[idx]) {
    this.nonlinearMaterial[idx] = enabled ? 1 : 0;
    this.modulationBaseEps[idx] = Number.isFinite(baseEps) ? baseEps : this.eps[idx];
    this.modulationBaseEpsY[idx] = Number.isFinite(baseEpsY) ? baseEpsY : this.epsY[idx];
    if (!enabled) {
      this.harmonicPrevPz[idx] = 0;
      this.harmonicPrevPx[idx] = 0;
      this.harmonicPrevPy[idx] = 0;
    }
  }

  setCellDispersion(idx, params = null) {
    const model = params?.dispersion || "none";
    const kind = model === "drude" || model === "plasma" ? 1 : model === "lorentz" ? 2 : model === "debye" ? 3 : 0;
    this.dispersiveMaterial[idx] = kind;
    this.dispersionOmegaP[idx] = kind ? Math.max(0, Number(params.omegaP) || 0) : 0;
    this.dispersionGamma[idx] = kind ? Math.max(0, Number(params.gamma) || 0) : 0;
    this.dispersionOmega0[idx] = kind ? Math.max(0, Number(params.omega0) || 0) : 0;
    this.dispersionDeltaEps[idx] = kind ? Number(params.deltaEps) || 0 : 0;
    this.dispersionTau[idx] = kind ? Math.max(1, Number(params.tau) || 1) : 1;
    this.dispPz[idx] = 0;
    this.dispJz[idx] = 0;
    this.dispPx[idx] = 0;
    this.dispJx[idx] = 0;
    this.dispPy[idx] = 0;
    this.dispJy[idx] = 0;
  }

  setCellConductivity(idx, sigma = 0, sigmaY = sigma) {
    this.conductivity[idx] = Math.max(0, Number(sigma) || 0);
    this.conductivityY[idx] = Math.max(0, Number(sigmaY) || 0);
  }

  setCellGyrotropy(idx, value = 0) {
    const g = clamp(Number(value) || 0, -5, 5);
    this.gyrotropicMaterial[idx] = g === 0 ? 0 : 1;
    this.gyrotropyG[idx] = g;
  }

  setCellBianisotropy(idx, value = 0) {
    const kappa = clamp(Number(value) || 0, -5, 5);
    this.bianisotropicMaterial[idx] = kappa === 0 ? 0 : 1;
    this.bianisotropyKappa[idx] = kappa;
    this.bianisotropyPrevScalar[idx] = this.ez[idx] || 0;
  }

  setCellPhaseChange(idx, params = null) {
    const enabled = Boolean(params?.phaseChange);
    this.phaseChangeMaterial[idx] = enabled ? 1 : 0;
    if (!enabled) {
      this.phaseState[idx] = 0;
      this.phaseEpsOff[idx] = this.eps[idx];
      this.phaseLossOff[idx] = this.loss[idx];
      this.phaseEpsYOff[idx] = this.epsY[idx];
      this.phaseLossYOff[idx] = this.lossY[idx];
      this.phaseEpsOn[idx] = this.eps[idx];
      this.phaseLossOn[idx] = this.loss[idx];
      this.phaseEpsYOn[idx] = this.epsY[idx];
      this.phaseLossYOn[idx] = this.lossY[idx];
      return;
    }
    const offEps = Number.isFinite(params.phaseEpsOff) ? params.phaseEpsOff : this.eps[idx];
    const offLoss = Number.isFinite(params.phaseLossOff) ? params.phaseLossOff : this.loss[idx];
    const offEpsY = Number.isFinite(params.phaseEpsYOff) ? params.phaseEpsYOff : this.epsY[idx];
    const offLossY = Number.isFinite(params.phaseLossYOff) ? params.phaseLossYOff : this.lossY[idx];
    const onEps = Number.isFinite(params.phaseEpsOn) ? params.phaseEpsOn : state.phaseEpsOn;
    const onLoss = Number.isFinite(params.phaseLossOn) ? params.phaseLossOn : state.phaseLossOn;
    this.phaseState[idx] = clamp(Number(params.phaseState) || 0, 0, 1);
    this.phaseEpsOff[idx] = offEps;
    this.phaseLossOff[idx] = offLoss;
    this.phaseEpsYOff[idx] = offEpsY;
    this.phaseLossYOff[idx] = offLossY;
    this.phaseEpsOn[idx] = onEps;
    this.phaseLossOn[idx] = onLoss;
    this.phaseEpsYOn[idx] = Number.isFinite(params.phaseEpsYOn) ? params.phaseEpsYOn : onEps;
    this.phaseLossYOn[idx] = Number.isFinite(params.phaseLossYOn) ? params.phaseLossYOn : onLoss;
  }

  setMaterial(x, y, kind) {
    if (x < 1 || y < 1 || x >= this.nx - 1 || y >= this.ny - 1) return;
    if (this.isInBoundaryControlRegion(x, y)) return;
    const idx = this.id(x, y);
    if (kind === "dielectric") {
      this.material[idx] = 1;
      this.eps[idx] = 4.2;
      this.loss[idx] = 0.001;
      this.epsY[idx] = 4.2;
      this.lossY[idx] = 0.001;
      this.mu[idx] = 1;
      this.muLoss[idx] = 0;
      this.muY[idx] = 1;
      this.muLossY[idx] = 0;
      this.setCellModulation(idx, false);
      this.setCellNonlinearity(idx, false);
      this.setCellDispersion(idx, null);
      this.setCellConductivity(idx, 0, 0);
      this.setCellGyrotropy(idx, 0);
      this.setCellBianisotropy(idx, 0);
      this.setCellPhaseChange(idx, null);
    } else if (kind === "pec") {
      this.material[idx] = 2;
      this.eps[idx] = 1;
      this.loss[idx] = 0;
      this.epsY[idx] = 1;
      this.lossY[idx] = 0;
      this.mu[idx] = 1;
      this.muLoss[idx] = 0;
      this.muY[idx] = 1;
      this.muLossY[idx] = 0;
      this.setCellModulation(idx, false);
      this.setCellNonlinearity(idx, false);
      this.setCellDispersion(idx, null);
      this.setCellConductivity(idx, 0, 0);
      this.setCellGyrotropy(idx, 0);
      this.setCellBianisotropy(idx, 0);
      this.setCellPhaseChange(idx, null);
      this.zeroElectricCell(idx);
    } else if (kind === "lossy") {
      this.material[idx] = 3;
      this.eps[idx] = 2.6;
      this.loss[idx] = 0.028;
      this.epsY[idx] = 2.6;
      this.lossY[idx] = 0.028;
      this.mu[idx] = 1;
      this.muLoss[idx] = 0;
      this.muY[idx] = 1;
      this.muLossY[idx] = 0;
      this.setCellModulation(idx, false);
      this.setCellNonlinearity(idx, false);
      this.setCellDispersion(idx, null);
      this.setCellConductivity(idx, 0, 0);
      this.setCellGyrotropy(idx, 0);
      this.setCellBianisotropy(idx, 0);
      this.setCellPhaseChange(idx, null);
    } else if (kind === "custom") {
      this.material[idx] = 4;
      this.eps[idx] = state.customEpsReal;
      this.loss[idx] = state.customEpsImag;
      this.epsY[idx] = state.customAnisotropic ? state.customEpsYReal : state.customEpsReal;
      this.lossY[idx] = state.customAnisotropic ? state.customEpsYImag : state.customEpsImag;
      this.mu[idx] = state.customMuReal;
      this.muLoss[idx] = state.customMuImag;
      this.muY[idx] = state.customAnisotropic ? state.customMuYReal : state.customMuReal;
      this.muLossY[idx] = state.customAnisotropic ? state.customMuYImag : state.customMuImag;
      this.setCellModulation(idx, state.materialModulationEnabled, this.eps[idx], this.epsY[idx]);
      this.setCellNonlinearity(idx, state.materialNonlinearEnabled || state.materialHarmonicEnabled, this.eps[idx], this.epsY[idx]);
      this.setCellDispersion(idx, brushDispersionParams());
      const conductivity = brushConductivityParams();
      this.setCellConductivity(idx, conductivity.sigma, conductivity.sigmaY);
      this.setCellGyrotropy(idx, brushGyrotropyValue());
      this.setCellBianisotropy(idx, brushBianisotropyValue());
      this.setCellPhaseChange(idx, brushPhaseChangeParams());
    } else if (kind === "sio2") {
      this.material[idx] = 5;
      this.eps[idx] = 2.07;
      this.loss[idx] = 0;
      this.epsY[idx] = 2.07;
      this.lossY[idx] = 0;
      this.mu[idx] = 1;
      this.muLoss[idx] = 0;
      this.muY[idx] = 1;
      this.muLossY[idx] = 0;
      this.setCellModulation(idx, false);
      this.setCellNonlinearity(idx, false);
      this.setCellDispersion(idx, null);
      this.setCellConductivity(idx, 0, 0);
      this.setCellGyrotropy(idx, 0);
      this.setCellBianisotropy(idx, 0);
      this.setCellPhaseChange(idx, null);
    } else {
      this.material[idx] = 0;
      this.eps[idx] = 1;
      this.loss[idx] = 0;
      this.epsY[idx] = 1;
      this.lossY[idx] = 0;
      this.mu[idx] = 1;
      this.muLoss[idx] = 0;
      this.muY[idx] = 1;
      this.muLossY[idx] = 0;
      this.setCellModulation(idx, false);
      this.setCellNonlinearity(idx, false);
      this.setCellDispersion(idx, null);
      this.setCellConductivity(idx, 0, 0);
      this.setCellGyrotropy(idx, 0);
      this.setCellBianisotropy(idx, 0);
      this.setCellPhaseChange(idx, null);
    }
  }

  snapshotMaterialCell(x, y) {
    const idx = this.id(x, y);
    return {
      x,
      y,
      material: this.material[idx],
      eps: this.eps[idx],
      loss: this.loss[idx],
      epsY: this.epsY[idx],
      lossY: this.lossY[idx],
      mu: this.mu[idx],
      muLoss: this.muLoss[idx],
      muY: this.muY[idx],
      muLossY: this.muLossY[idx],
      modulated: this.modulatedMaterial[idx],
      nonlinear: this.nonlinearMaterial[idx],
      dispersive: this.dispersiveMaterial[idx],
      gyrotropic: this.gyrotropicMaterial[idx],
      gyrotropyG: this.gyrotropyG[idx],
      bianisotropic: this.bianisotropicMaterial[idx],
      bianisotropyKappa: this.bianisotropyKappa[idx],
      bianisotropyPrevScalar: this.bianisotropyPrevScalar[idx],
      phaseChange: this.phaseChangeMaterial[idx],
      phaseState: this.phaseState[idx],
      phaseEpsOff: this.phaseEpsOff[idx],
      phaseLossOff: this.phaseLossOff[idx],
      phaseEpsYOff: this.phaseEpsYOff[idx],
      phaseLossYOff: this.phaseLossYOff[idx],
      phaseEpsOn: this.phaseEpsOn[idx],
      phaseLossOn: this.phaseLossOn[idx],
      phaseEpsYOn: this.phaseEpsYOn[idx],
      phaseLossYOn: this.phaseLossYOn[idx],
      conductivity: this.conductivity[idx],
      conductivityY: this.conductivityY[idx],
      modulationBaseEps: this.modulationBaseEps[idx],
      modulationBaseEpsY: this.modulationBaseEpsY[idx],
      dispersionOmegaP: this.dispersionOmegaP[idx],
      dispersionGamma: this.dispersionGamma[idx],
      dispersionOmega0: this.dispersionOmega0[idx],
      dispersionDeltaEps: this.dispersionDeltaEps[idx],
      dispersionTau: this.dispersionTau[idx],
    };
  }

  writeMaterialCell(x, y, cell) {
    if (x < 1 || y < 1 || x >= this.nx - 1 || y >= this.ny - 1) return false;
    if (this.isInBoundaryControlRegion(x, y)) return false;
    const idx = this.id(x, y);
    this.material[idx] = cell.material;
    this.eps[idx] = cell.eps;
    this.loss[idx] = cell.loss;
    this.epsY[idx] = cell.epsY;
    this.lossY[idx] = cell.lossY;
    this.mu[idx] = cell.mu;
    this.muLoss[idx] = cell.muLoss;
    this.muY[idx] = cell.muY;
    this.muLossY[idx] = cell.muLossY;
    this.modulatedMaterial[idx] = cell.modulated ? 1 : 0;
    this.nonlinearMaterial[idx] = cell.nonlinear ? 1 : 0;
    this.dispersiveMaterial[idx] = cell.dispersive || 0;
    this.gyrotropicMaterial[idx] = cell.gyrotropic ? 1 : 0;
    this.gyrotropyG[idx] = clamp(Number(cell.gyrotropyG) || 0, -5, 5);
    this.bianisotropicMaterial[idx] = cell.bianisotropic ? 1 : 0;
    this.bianisotropyKappa[idx] = clamp(Number(cell.bianisotropyKappa) || 0, -5, 5);
    this.bianisotropyPrevScalar[idx] = Number.isFinite(cell.bianisotropyPrevScalar) ? cell.bianisotropyPrevScalar : this.ez[idx];
    this.phaseChangeMaterial[idx] = cell.phaseChange ? 1 : 0;
    this.phaseState[idx] = clamp(Number(cell.phaseState) || 0, 0, 1);
    this.phaseEpsOff[idx] = Number.isFinite(cell.phaseEpsOff) ? cell.phaseEpsOff : cell.eps;
    this.phaseLossOff[idx] = Number.isFinite(cell.phaseLossOff) ? cell.phaseLossOff : cell.loss;
    this.phaseEpsYOff[idx] = Number.isFinite(cell.phaseEpsYOff) ? cell.phaseEpsYOff : cell.epsY;
    this.phaseLossYOff[idx] = Number.isFinite(cell.phaseLossYOff) ? cell.phaseLossYOff : cell.lossY;
    this.phaseEpsOn[idx] = Number.isFinite(cell.phaseEpsOn) ? cell.phaseEpsOn : cell.eps;
    this.phaseLossOn[idx] = Number.isFinite(cell.phaseLossOn) ? cell.phaseLossOn : cell.loss;
    this.phaseEpsYOn[idx] = Number.isFinite(cell.phaseEpsYOn) ? cell.phaseEpsYOn : this.phaseEpsOn[idx];
    this.phaseLossYOn[idx] = Number.isFinite(cell.phaseLossYOn) ? cell.phaseLossYOn : this.phaseLossOn[idx];
    this.conductivity[idx] = Math.max(0, Number(cell.conductivity) || 0);
    this.conductivityY[idx] = Math.max(0, Number(cell.conductivityY) || 0);
    this.modulationBaseEps[idx] = Number.isFinite(cell.modulationBaseEps) ? cell.modulationBaseEps : cell.eps;
    this.modulationBaseEpsY[idx] = Number.isFinite(cell.modulationBaseEpsY) ? cell.modulationBaseEpsY : cell.epsY;
    this.dispersionOmegaP[idx] = Number.isFinite(cell.dispersionOmegaP) ? cell.dispersionOmegaP : 0;
    this.dispersionGamma[idx] = Number.isFinite(cell.dispersionGamma) ? cell.dispersionGamma : 0;
    this.dispersionOmega0[idx] = Number.isFinite(cell.dispersionOmega0) ? cell.dispersionOmega0 : 0;
    this.dispersionDeltaEps[idx] = Number.isFinite(cell.dispersionDeltaEps) ? cell.dispersionDeltaEps : 0;
    this.dispersionTau[idx] = Number.isFinite(cell.dispersionTau) ? cell.dispersionTau : 1;
    this.dispPz[idx] = 0;
    this.dispJz[idx] = 0;
    this.dispPx[idx] = 0;
    this.dispJx[idx] = 0;
    this.dispPy[idx] = 0;
    this.dispJy[idx] = 0;
    this.harmonicPrevPz[idx] = 0;
    this.harmonicPrevPx[idx] = 0;
    this.harmonicPrevPy[idx] = 0;
    if (cell.material === 2) {
      this.zeroElectricCell(idx);
    }
    return true;
  }

  writeAirCellAtIndex(idx) {
    this.material[idx] = 0;
    this.eps[idx] = 1;
    this.loss[idx] = 0;
    this.epsY[idx] = 1;
    this.lossY[idx] = 0;
    this.mu[idx] = 1;
    this.muLoss[idx] = 0;
    this.muY[idx] = 1;
    this.muLossY[idx] = 0;
    this.modulatedMaterial[idx] = 0;
    this.nonlinearMaterial[idx] = 0;
    this.dispersiveMaterial[idx] = 0;
    this.gyrotropicMaterial[idx] = 0;
    this.gyrotropyG[idx] = 0;
    this.bianisotropicMaterial[idx] = 0;
    this.bianisotropyKappa[idx] = 0;
    this.bianisotropyPrevScalar[idx] = 0;
    this.phaseChangeMaterial[idx] = 0;
    this.phaseState[idx] = 0;
    this.phaseEpsOff[idx] = 1;
    this.phaseLossOff[idx] = 0;
    this.phaseEpsYOff[idx] = 1;
    this.phaseLossYOff[idx] = 0;
    this.phaseEpsOn[idx] = 1;
    this.phaseLossOn[idx] = 0;
    this.phaseEpsYOn[idx] = 1;
    this.phaseLossYOn[idx] = 0;
    this.conductivity[idx] = 0;
    this.conductivityY[idx] = 0;
    this.modulationBaseEps[idx] = 1;
    this.modulationBaseEpsY[idx] = 1;
    this.dispersionOmegaP[idx] = 0;
    this.dispersionGamma[idx] = 0;
    this.dispersionOmega0[idx] = 0;
    this.dispersionDeltaEps[idx] = 0;
    this.dispersionTau[idx] = 1;
    this.dispPz[idx] = 0;
    this.dispJz[idx] = 0;
    this.dispPx[idx] = 0;
    this.dispJx[idx] = 0;
    this.dispPy[idx] = 0;
    this.dispJy[idx] = 0;
    this.harmonicPrevPz[idx] = 0;
    this.harmonicPrevPx[idx] = 0;
    this.harmonicPrevPy[idx] = 0;
  }

  selectableMaterialAt(x, y) {
    if (x < 1 || y < 1 || x >= this.nx - 1 || y >= this.ny - 1) return false;
    if (this.isInBoundaryControlRegion(x, y)) return false;
    return this.material[this.id(x, y)] !== 0;
  }

  materialRegionBounds(cells) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const cell of cells) {
      if (cell.x < minX) minX = cell.x;
      if (cell.y < minY) minY = cell.y;
      if (cell.x > maxX) maxX = cell.x;
      if (cell.y > maxY) maxY = cell.y;
    }
    return { minX, minY, maxX, maxY };
  }

  findMaterialRegionAtCell(startX, startY) {
    if (!this.selectableMaterialAt(startX, startY)) return null;
    const visited = new Uint8Array(this.n);
    const stack = [this.id(startX, startY)];
    visited[this.id(startX, startY)] = 1;
    const cells = [];
    const pushNeighbor = (x, y) => {
      if (!this.selectableMaterialAt(x, y)) return;
      const idx = this.id(x, y);
      if (visited[idx]) return;
      visited[idx] = 1;
      stack.push(idx);
    };

    while (stack.length > 0) {
      const idx = stack.pop();
      const x = idx % this.nx;
      const y = Math.floor(idx / this.nx);
      cells.push(this.snapshotMaterialCell(x, y));
      pushNeighbor(x + 1, y);
      pushNeighbor(x - 1, y);
      pushNeighbor(x, y + 1);
      pushNeighbor(x, y - 1);
    }

    return {
      cells,
      bounds: this.materialRegionBounds(cells),
    };
  }

  findMaterialRegionAtClientPoint(clientX, clientY) {
    const point = this.clientToGridCell(clientX, clientY);
    return this.findMaterialRegionAtCell(point.x, point.y);
  }

  snapshotMaterialArrays() {
    return {
      material: new Uint8Array(this.material),
      eps: new Float32Array(this.eps),
      loss: new Float32Array(this.loss),
      epsY: new Float32Array(this.epsY),
      lossY: new Float32Array(this.lossY),
      mu: new Float32Array(this.mu),
      muLoss: new Float32Array(this.muLoss),
      muY: new Float32Array(this.muY),
      muLossY: new Float32Array(this.muLossY),
      modulatedMaterial: new Uint8Array(this.modulatedMaterial),
      nonlinearMaterial: new Uint8Array(this.nonlinearMaterial),
      dispersiveMaterial: new Uint8Array(this.dispersiveMaterial),
      gyrotropicMaterial: new Uint8Array(this.gyrotropicMaterial),
      gyrotropyG: new Float32Array(this.gyrotropyG),
      bianisotropicMaterial: new Uint8Array(this.bianisotropicMaterial),
      bianisotropyKappa: new Float32Array(this.bianisotropyKappa),
      bianisotropyPrevScalar: new Float32Array(this.bianisotropyPrevScalar),
      phaseChangeMaterial: new Uint8Array(this.phaseChangeMaterial),
      phaseState: new Float32Array(this.phaseState),
      phaseEpsOff: new Float32Array(this.phaseEpsOff),
      phaseLossOff: new Float32Array(this.phaseLossOff),
      phaseEpsYOff: new Float32Array(this.phaseEpsYOff),
      phaseLossYOff: new Float32Array(this.phaseLossYOff),
      phaseEpsOn: new Float32Array(this.phaseEpsOn),
      phaseLossOn: new Float32Array(this.phaseLossOn),
      phaseEpsYOn: new Float32Array(this.phaseEpsYOn),
      phaseLossYOn: new Float32Array(this.phaseLossYOn),
      conductivity: new Float32Array(this.conductivity),
      conductivityY: new Float32Array(this.conductivityY),
      modulationBaseEps: new Float32Array(this.modulationBaseEps),
      modulationBaseEpsY: new Float32Array(this.modulationBaseEpsY),
      dispersionOmegaP: new Float32Array(this.dispersionOmegaP),
      dispersionGamma: new Float32Array(this.dispersionGamma),
      dispersionOmega0: new Float32Array(this.dispersionOmega0),
      dispersionDeltaEps: new Float32Array(this.dispersionDeltaEps),
      dispersionTau: new Float32Array(this.dispersionTau),
    };
  }

  restoreMaterialArrays(snapshot) {
    this.material.set(snapshot.material);
    this.eps.set(snapshot.eps);
    this.loss.set(snapshot.loss);
    this.epsY.set(snapshot.epsY);
    this.lossY.set(snapshot.lossY);
    this.mu.set(snapshot.mu);
    this.muLoss.set(snapshot.muLoss);
    this.muY.set(snapshot.muY);
    this.muLossY.set(snapshot.muLossY);
    this.modulatedMaterial.set(snapshot.modulatedMaterial);
    this.nonlinearMaterial.set(snapshot.nonlinearMaterial);
    this.dispersiveMaterial.set(snapshot.dispersiveMaterial);
    this.gyrotropicMaterial.set(snapshot.gyrotropicMaterial);
    this.gyrotropyG.set(snapshot.gyrotropyG);
    this.bianisotropicMaterial.set(snapshot.bianisotropicMaterial);
    this.bianisotropyKappa.set(snapshot.bianisotropyKappa);
    this.bianisotropyPrevScalar.set(snapshot.bianisotropyPrevScalar);
    this.phaseChangeMaterial.set(snapshot.phaseChangeMaterial);
    this.phaseState.set(snapshot.phaseState);
    this.phaseEpsOff.set(snapshot.phaseEpsOff);
    this.phaseLossOff.set(snapshot.phaseLossOff);
    this.phaseEpsYOff.set(snapshot.phaseEpsYOff);
    this.phaseLossYOff.set(snapshot.phaseLossYOff);
    this.phaseEpsOn.set(snapshot.phaseEpsOn);
    this.phaseLossOn.set(snapshot.phaseLossOn);
    this.phaseEpsYOn.set(snapshot.phaseEpsYOn);
    this.phaseLossYOn.set(snapshot.phaseLossYOn);
    this.conductivity.set(snapshot.conductivity);
    this.conductivityY.set(snapshot.conductivityY);
    this.modulationBaseEps.set(snapshot.modulationBaseEps);
    this.modulationBaseEpsY.set(snapshot.modulationBaseEpsY);
    this.dispersionOmegaP.set(snapshot.dispersionOmegaP);
    this.dispersionGamma.set(snapshot.dispersionGamma);
    this.dispersionOmega0.set(snapshot.dispersionOmega0);
    this.dispersionDeltaEps.set(snapshot.dispersionDeltaEps);
    this.dispersionTau.set(snapshot.dispersionTau);
  }

  snapshotMaterialArraysWithoutRegion(region) {
    const snapshot = this.snapshotMaterialArrays();
    for (const cell of region.cells) {
      const idx = this.id(cell.x, cell.y);
      snapshot.material[idx] = 0;
      snapshot.eps[idx] = 1;
      snapshot.loss[idx] = 0;
      snapshot.epsY[idx] = 1;
      snapshot.lossY[idx] = 0;
      snapshot.mu[idx] = 1;
      snapshot.muLoss[idx] = 0;
      snapshot.muY[idx] = 1;
      snapshot.muLossY[idx] = 0;
      snapshot.modulatedMaterial[idx] = 0;
      snapshot.nonlinearMaterial[idx] = 0;
      snapshot.dispersiveMaterial[idx] = 0;
      snapshot.gyrotropicMaterial[idx] = 0;
      snapshot.gyrotropyG[idx] = 0;
      snapshot.bianisotropicMaterial[idx] = 0;
      snapshot.bianisotropyKappa[idx] = 0;
      snapshot.bianisotropyPrevScalar[idx] = 0;
      snapshot.phaseChangeMaterial[idx] = 0;
      snapshot.phaseState[idx] = 0;
      snapshot.phaseEpsOff[idx] = 1;
      snapshot.phaseLossOff[idx] = 0;
      snapshot.phaseEpsYOff[idx] = 1;
      snapshot.phaseLossYOff[idx] = 0;
      snapshot.phaseEpsOn[idx] = 1;
      snapshot.phaseLossOn[idx] = 0;
      snapshot.phaseEpsYOn[idx] = 1;
      snapshot.phaseLossYOn[idx] = 0;
      snapshot.conductivity[idx] = 0;
      snapshot.conductivityY[idx] = 0;
      snapshot.modulationBaseEps[idx] = 1;
      snapshot.modulationBaseEpsY[idx] = 1;
      snapshot.dispersionOmegaP[idx] = 0;
      snapshot.dispersionGamma[idx] = 0;
      snapshot.dispersionOmega0[idx] = 0;
      snapshot.dispersionDeltaEps[idx] = 0;
      snapshot.dispersionTau[idx] = 1;
    }
    return snapshot;
  }

  clampMaterialRegionOffset(region, dx, dy) {
    const minDx = this.activeInteriorMinX() - region.bounds.minX;
    const maxDx = this.activeInteriorMaxX() - region.bounds.maxX;
    const minDy = this.activeInteriorMinY() - region.bounds.minY;
    const maxDy = this.activeInteriorMaxY() - region.bounds.maxY;
    return {
      dx: clampInt(dx, minDx, maxDx),
      dy: clampInt(dy, minDy, maxDy),
    };
  }

  shiftedMaterialRegion(region, dx, dy) {
    const cells = region.cells.map((cell) => ({
      ...cell,
      x: cell.x + dx,
      y: cell.y + dy,
    }));
    return {
      cells,
      bounds: this.materialRegionBounds(cells),
    };
  }

  renderMaterialRegionFromBase(base, region, dx, dy) {
    this.restoreMaterialArrays(base);
    const shifted = this.shiftedMaterialRegion(region, dx, dy);
    for (const cell of shifted.cells) {
      this.writeMaterialCell(cell.x, cell.y, cell);
    }
    this.refreshPmlMaterialContinuation(false);
    this.resetFields();
    return shifted;
  }

  applyMaterialKindToRegion(region, kind) {
    if (!region) return null;
    if (kind === "erase") {
      for (const cell of region.cells) {
        this.setMaterial(cell.x, cell.y, "erase");
      }
      this.refreshPmlMaterialContinuation(false);
      this.resetFields();
      return null;
    }
    for (const cell of region.cells) {
      this.setMaterial(cell.x, cell.y, kind);
    }
    this.refreshPmlMaterialContinuation(false);
    this.resetFields();
    const firstCell = region.cells[0];
    return firstCell ? this.findMaterialRegionAtCell(firstCell.x, firstCell.y) : null;
  }

  updateCustomMaterialCells(resetFields = true) {
    for (let i = 0; i < this.n; i += 1) {
      if (this.material[i] !== 4) continue;
      this.eps[i] = state.customEpsReal;
      this.loss[i] = state.customEpsImag;
      this.epsY[i] = state.customAnisotropic ? state.customEpsYReal : state.customEpsReal;
      this.lossY[i] = state.customAnisotropic ? state.customEpsYImag : state.customEpsImag;
      this.modulationBaseEps[i] = this.eps[i];
      this.modulationBaseEpsY[i] = this.epsY[i];
      this.modulatedMaterial[i] = state.materialModulationEnabled ? 1 : 0;
      this.setCellNonlinearity(i, state.materialNonlinearEnabled || state.materialHarmonicEnabled, this.eps[i], this.epsY[i]);
      this.setCellDispersion(i, brushDispersionParams());
      const conductivity = brushConductivityParams();
      this.setCellConductivity(i, conductivity.sigma, conductivity.sigmaY);
      this.setCellPhaseChange(i, brushPhaseChangeParams());
      this.setCellGyrotropy(i, brushGyrotropyValue());
      this.mu[i] = state.customMuReal;
      this.muLoss[i] = state.customMuImag;
      this.muY[i] = state.customAnisotropic ? state.customMuYReal : state.customMuReal;
      this.muLossY[i] = state.customAnisotropic ? state.customMuYImag : state.customMuImag;
    }
    this.refreshPmlMaterialContinuation(false);
    if (resetFields) {
      this.resetFields();
    }
  }

  paint(x, y, radius, kind) {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy <= r2) {
          this.setMaterial(x + dx, y + dy, kind);
        }
      }
    }
  }

  rect(x0, y0, w, h, kind) {
    const x1 = Math.min(this.nx - 2, x0 + w);
    const y1 = Math.min(this.ny - 2, y0 + h);
    for (let y = Math.max(1, y0); y <= y1; y += 1) {
      for (let x = Math.max(1, x0); x <= x1; x += 1) {
        this.setMaterial(x, y, kind);
      }
    }
  }

  ellipse(cx, cy, rx, ry, kind) {
    for (let y = Math.max(1, Math.floor(cy - ry)); y <= Math.min(this.ny - 2, Math.ceil(cy + ry)); y += 1) {
      for (let x = Math.max(1, Math.floor(cx - rx)); x <= Math.min(this.nx - 2, Math.ceil(cx + rx)); x += 1) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          this.setMaterial(x, y, kind);
        }
      }
    }
  }

  insertBrushGeometry(cx, cy, kind, options) {
    const geometry = options.geometry || "rectangle";
    const width = Math.max(1, lambdaToCells(options.widthLambda));
    const height = Math.max(1, lambdaToCells(options.heightLambda));
    const outerRadius = Math.max(1, lambdaToCells(options.radiusLambda));
    const innerRadius = Math.max(0, Math.min(outerRadius - 1, lambdaToCells(options.innerRadiusLambda)));
    const inserted = [];
    const seen = new Set();
    const addCell = (x, y) => {
      if (x < 1 || y < 1 || x >= this.nx - 1 || y >= this.ny - 1) return;
      if (this.isInBoundaryControlRegion(x, y)) return;
      this.setMaterial(x, y, kind);
      if (kind === "erase") return;
      const idx = this.id(x, y);
      if (seen.has(idx) || this.material[idx] === 0) return;
      seen.add(idx);
      inserted.push(this.snapshotMaterialCell(x, y));
    };
    const addRectangle = (w, h) => {
      const x0 = Math.round(cx - w / 2);
      const y0 = Math.round(cy - h / 2);
      for (let y = y0; y < y0 + h; y += 1) {
        for (let x = x0; x < x0 + w; x += 1) {
          addCell(x, y);
        }
      }
    };
    const addEllipse = (rx, ry, innerRx = 0, innerRy = 0) => {
      const minX = Math.floor(cx - rx);
      const maxX = Math.ceil(cx + rx);
      const minY = Math.floor(cy - ry);
      const maxY = Math.ceil(cy + ry);
      const safeInnerRx = Math.max(0, innerRx);
      const safeInnerRy = Math.max(0, innerRy);
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const dx = (x - cx) / Math.max(1, rx);
          const dy = (y - cy) / Math.max(1, ry);
          const outer = dx * dx + dy * dy <= 1;
          if (!outer) continue;
          if (safeInnerRx > 0 && safeInnerRy > 0) {
            const innerDx = (x - cx) / safeInnerRx;
            const innerDy = (y - cy) / safeInnerRy;
            if (innerDx * innerDx + innerDy * innerDy < 1) continue;
          }
          addCell(x, y);
        }
      }
    };

    if (geometry === "disk") {
      addEllipse(outerRadius, outerRadius);
    } else if (geometry === "ellipse") {
      addEllipse(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
    } else if (geometry === "ring") {
      addEllipse(outerRadius, outerRadius, innerRadius, innerRadius);
    } else {
      addRectangle(width, height);
    }

    this.refreshPmlMaterialContinuation(false);
    if (kind === "erase" || inserted.length === 0) return null;
    return {
      cells: inserted,
      bounds: this.materialRegionBounds(inserted),
    };
  }

  slabCoreThicknessCells() {
    return Math.max(2, lambdaToCells(state.slabThicknessLambda));
  }

  sourceXCell(source) {
    return clampInt(lambdaToCells(source.xLambda), this.sourcePlacementMinX(), this.sourcePlacementMaxX());
  }

  sourceYCell(source) {
    return clampInt(lambdaToCells(source.yLambda), this.sourcePlacementMinY(), this.sourcePlacementMaxY());
  }

  sourceEnvelopeFwhmCells(source) {
    return Math.max(2, lambdaToCells(source.widthLambda));
  }

  activeInteriorMinX() {
    return this.boundaryControlLayer() + 1;
  }

  activeInteriorMaxX() {
    return this.nx - this.boundaryControlLayer() - 2;
  }

  activeInteriorMinY() {
    return this.boundaryControlLayer() + 1;
  }

  activeInteriorMaxY() {
    return this.ny - this.boundaryControlLayer() - 2;
  }

  sourceGuardMarginCells(side) {
    if (!boundarySideIsAbsorbing(side)) return 0;
    return Math.max(4, Math.round(state.cellsPerWavelength * 0.45));
  }

  sourcePlacementBounds(min, max, minSide, maxSide) {
    const minMargin = this.sourceGuardMarginCells(minSide);
    const maxMargin = this.sourceGuardMarginCells(maxSide);
    if (max - min <= minMargin + maxMargin) return { min, max };
    return { min: min + minMargin, max: max - maxMargin };
  }

  sourcePlacementMinX() {
    return this.sourcePlacementBounds(this.activeInteriorMinX(), this.activeInteriorMaxX(), "left", "right").min;
  }

  sourcePlacementMaxX() {
    return this.sourcePlacementBounds(this.activeInteriorMinX(), this.activeInteriorMaxX(), "left", "right").max;
  }

  sourcePlacementMinY() {
    return this.sourcePlacementBounds(this.activeInteriorMinY(), this.activeInteriorMaxY(), "top", "bottom").min;
  }

  sourcePlacementMaxY() {
    return this.sourcePlacementBounds(this.activeInteriorMinY(), this.activeInteriorMaxY(), "top", "bottom").max;
  }

  applyPreset(name) {
    for (const side of BOUNDARY_SIDES) setBoundarySideMode(side, "absorbing");
    this.buildBoundary();
    this.clearMaterials(false);

    state.fieldComponent = "ez";
    state.fieldDisplay = "scalar";
    state.fieldQuiver = false;
    state.viewMode = "field";
    state.materialPart = "real";
    state.materialModulationEnabled = false;
    state.materialNonlinearEnabled = false;
    state.materialHarmonicEnabled = false;
    state.materialDispersionEnabled = false;
    state.materialConductivityEnabled = false;
    state.materialSaturableGainEnabled = false;
    state.materialPhaseChangeEnabled = false;
    state.materialGyrotropyEnabled = false;
    state.kerrChi3 = 0.5;
    state.kerrSaturation = 5;
    state.harmonicChi2 = 0.08;
    state.harmonicChi3 = 0;
    state.harmonicSaturation = 6;
    state.conductivitySigma = 0;
    state.conductivitySigmaY = 0;
    state.gainSaturation = 4;
    state.phaseEpsOn = 9;
    state.phaseLossOn = 0.08;
    state.phaseThresholdOn = 0.8;
    state.phaseThresholdOff = 0.2;
    state.phaseTauOn = 18;
    state.phaseTauOff = 180;
    state.gyrotropyG = 0.25;
    state.dispersionModel = "none";
    state.dispersionOmegaP = 0.28;
    state.dispersionGamma = 0.018;
    state.dispersionOmega0 = 0.15;
    state.dispersionDeltaEps = 2;
    state.dispersionTau = 18;
    state.modulationDepth = 0.2;
    state.modulationFrequency = 0.01;
    state.modulationPeriodLambda = 2;
    state.modulationAngleDeg = 0;
    state.modulationPhaseDeg = 0;

    const minX = this.activeInteriorMinX();
    const maxX = this.activeInteriorMaxX();
    const minY = this.activeInteriorMinY();
    const maxY = this.activeInteriorMaxY();
    const domainXLambda = cellsToLambda(this.nx);
    const domainYLambda = cellsToLambda(this.ny);
    const midXLambda = domainXLambda * 0.5;
    const midYLambda = domainYLambda * 0.5;
    const sourceFrequency = COURANT / Math.max(8, state.cellsPerWavelength);
    const sourceX = (value) => clamp(value, minSourceXLambda(), maxSourceXLambda());
    const sourceY = (value) => clamp(value, minSourceYLambda(), maxSourceYLambda());
    const mat = {
      air: { material: 0 },
      pec: { material: 2 },
      n12: { material: 4, eps: 1.44 },
      n15: { material: 4, eps: 2.25 },
      n20: { material: 4, eps: 4 },
      n25: { material: 4, eps: 6.25 },
      n34: { material: 4, eps: 11.56 },
      coating: { material: 4, eps: 1.5 },
      lossyN15: { material: 4, eps: 2.25, loss: 0.1 },
      lossyGuide: { material: 4, eps: 11.56, loss: 0.02 },
      finiteConductor: { material: 4, eps: 1, loss: 0, sigma: 0.42 },
      ptGain: { material: 4, eps: 6.25, loss: -0.032 },
      ptLoss: { material: 4, eps: 6.25, loss: 0.032 },
      weak: { material: 4, eps: 1.35 },
      enz: { material: 4, eps: 0.08, loss: 0.02 },
      anisotropic: { material: 4, eps: 4, epsY: 2 },
      hyperbolic: { material: 4, eps: 4, epsY: -2 },
      gyrotropic: { material: 4, eps: 4, epsY: 4, gyro: 0.35 },
      negative: { material: 4, eps: -1, mu: -1 },
      metalLoss: { material: 4, eps: -12, loss: 4 },
      drudeMetal: { material: 4, eps: 1, loss: 0.002, dispersion: "drude", omegaP: 0.28, gamma: 0.018 },
      plasmonicMetal: { material: 4, eps: 1, loss: 0.004, dispersion: "drude", omegaP: 0.34, gamma: 0.026 },
      plasma: { material: 4, eps: 1, loss: 0, dispersion: "plasma", omegaP: 2 * Math.PI * sourceFrequency * 1.25, gamma: 0.001 },
      lorentz: {
        material: 4,
        eps: 1.7,
        loss: 0.002,
        dispersion: "lorentz",
        omega0: 2 * Math.PI * sourceFrequency * 1.05,
        gamma: 0.025,
        deltaEps: 2.0,
      },
      debye: { material: 4, eps: 1.8, loss: 0.001, dispersion: "debye", deltaEps: 3.0, tau: 18 },
      phaseOff: { material: 4, eps: 3.2, loss: 0.002, phaseChange: true, phaseEpsOn: 9, phaseLossOn: 0.08 },
      pcmOff: { material: 4, eps: 4, loss: 0.001, phaseChange: true, phaseEpsOn: 12, phaseLossOn: 0.03 },
    };

    const setSources = (configs) => {
      const base = {
        type: "sine",
        shape: "line",
        frequency: sourceFrequency,
        amplitude: 0.55,
        xLambda: sourceX(1),
        yLambda: sourceY(midYLambda),
        widthLambda: 0.35,
        angleDeg: 0,
        phaseDeg: 0,
        multipoleOrder: 3,
        multipolePhase: "cos",
      };
      state.sources = configs.map((config, index) => {
        const source = normalizeSource({ ...base, ...config });
        source.id = index + 1;
        return source;
      });
      if (state.sources.length === 0) {
        const source = normalizeSource({ ...defaultSourceConfig, frequency: sourceFrequency, yLambda: sourceY(midYLambda) });
        source.id = 1;
        state.sources = [source];
      }
      state.nextSourceId = state.sources.length + 1;
      state.selectedSourceId = state.sources[0]?.id ?? null;
      state.sourceDefaults = { ...(state.sources[0] || defaultSourceConfig) };
      delete state.sourceDefaults.id;
    };

    const writeMaterialCell = (x, y, params = mat.air) => {
      if (x < minX || y < minY || x > maxX || y > maxY) return;
      if (this.isInBoundaryControlRegion(x, y)) return;
      const idx = this.id(x, y);
      if ((params.material ?? 0) === 0) {
        this.writeAirCellAtIndex(idx);
        return;
      }
      const material = params.material ?? 4;
      const eps = params.eps ?? 1;
      const loss = params.loss ?? 0;
      const epsY = params.epsY ?? eps;
      const lossY = params.lossY ?? loss;
      const mu = params.mu ?? 1;
      const muLoss = params.muLoss ?? 0;
      const muY = params.muY ?? mu;
      const muLossY = params.muLossY ?? muLoss;
      const sigma = params.sigma ?? 0;
      const sigmaY = params.sigmaY ?? sigma;
      this.material[idx] = material;
      this.eps[idx] = material === 2 ? 1 : eps;
      this.loss[idx] = material === 2 ? 0 : loss;
      this.epsY[idx] = material === 2 ? 1 : epsY;
      this.lossY[idx] = material === 2 ? 0 : lossY;
      this.mu[idx] = material === 2 ? 1 : mu;
      this.muLoss[idx] = material === 2 ? 0 : muLoss;
      this.muY[idx] = material === 2 ? 1 : muY;
      this.muLossY[idx] = material === 2 ? 0 : muLossY;
      this.setCellModulation(idx, Boolean(params.modulated) && material !== 2, this.eps[idx], this.epsY[idx]);
      this.setCellNonlinearity(idx, Boolean(params.nonlinear) && material !== 2, this.eps[idx], this.epsY[idx]);
      this.setCellDispersion(idx, material !== 2 ? params : null);
      this.setCellConductivity(idx, material !== 2 ? sigma : 0, material !== 2 ? sigmaY : 0);
      this.setCellGyrotropy(idx, material !== 2 ? params.gyro ?? params.gyrotropyG ?? 0 : 0);
      this.setCellPhaseChange(idx, material !== 2 ? params : null);
      if (material === 2) this.zeroElectricCell(idx);
    };

    const rectCells = (x0, y0, w, h, params) => {
      const xStart = Math.max(minX, Math.round(x0));
      const xEnd = Math.min(maxX, Math.round(x0 + w - 1));
      const yStart = Math.max(minY, Math.round(y0));
      const yEnd = Math.min(maxY, Math.round(y0 + h - 1));
      for (let y = yStart; y <= yEnd; y += 1) {
        for (let x = xStart; x <= xEnd; x += 1) writeMaterialCell(x, y, params);
      }
    };
    const rectL = (xL, yL, wL, hL, params) => {
      rectCells(lambdaToCells(xL), lambdaToCells(yL), Math.max(1, lambdaToCells(wL)), Math.max(1, lambdaToCells(hL)), params);
    };
    const ellipseCells = (cx, cy, rx, ry, params) => {
      const rX = Math.max(1, Math.round(rx));
      const rY = Math.max(1, Math.round(ry));
      for (let y = Math.max(minY, cy - rY); y <= Math.min(maxY, cy + rY); y += 1) {
        const yy = (y - cy) / rY;
        for (let x = Math.max(minX, cx - rX); x <= Math.min(maxX, cx + rX); x += 1) {
          const xx = (x - cx) / rX;
          if (xx * xx + yy * yy <= 1) writeMaterialCell(x, y, params);
        }
      }
    };
    const ellipseL = (cxL, cyL, rxL, ryL, params) => {
      ellipseCells(lambdaToCells(cxL), lambdaToCells(cyL), lambdaToCells(rxL), lambdaToCells(ryL), params);
    };
    const ringL = (cxL, cyL, outerRxL, outerRyL, innerRxL, innerRyL, params) => {
      const cx = lambdaToCells(cxL);
      const cy = lambdaToCells(cyL);
      const outerRx = Math.max(1, lambdaToCells(outerRxL));
      const outerRy = Math.max(1, lambdaToCells(outerRyL));
      const innerRx = Math.max(1, lambdaToCells(innerRxL));
      const innerRy = Math.max(1, lambdaToCells(innerRyL));
      for (let y = Math.max(minY, cy - outerRy); y <= Math.min(maxY, cy + outerRy); y += 1) {
        const yo = (y - cy) / outerRy;
        const yi = (y - cy) / innerRy;
        for (let x = Math.max(minX, cx - outerRx); x <= Math.min(maxX, cx + outerRx); x += 1) {
          const xo = (x - cx) / outerRx;
          const xi = (x - cx) / innerRx;
          if (xo * xo + yo * yo <= 1 && xi * xi + yi * yi >= 1) writeMaterialCell(x, y, params);
        }
      }
    };
    const rotatedRectL = (cxL, cyL, lengthL, widthL, angleDeg, params) => {
      const cx = lambdaToCells(cxL);
      const cy = lambdaToCells(cyL);
      const halfLength = Math.max(1, lambdaToCells(lengthL) / 2);
      const halfWidth = Math.max(1, lambdaToCells(widthL) / 2);
      const theta = (angleDeg * Math.PI) / 180;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      const radius = Math.ceil(Math.hypot(halfLength, halfWidth));
      for (let y = Math.max(minY, cy - radius); y <= Math.min(maxY, cy + radius); y += 1) {
        for (let x = Math.max(minX, cx - radius); x <= Math.min(maxX, cx + radius); x += 1) {
          const dx = x - cx;
          const dy = y - cy;
          const u = dx * cosTheta + dy * sinTheta;
          const v = -dx * sinTheta + dy * cosTheta;
          if (Math.abs(u) <= halfLength && Math.abs(v) <= halfWidth) writeMaterialCell(x, y, params);
        }
      }
    };
    const rectFrameL = (cxL, cyL, wL, hL, tL, params) => {
      rectL(cxL - wL / 2, cyL - hL / 2, wL, tL, params);
      rectL(cxL - wL / 2, cyL + hL / 2 - tL, wL, tL, params);
      rectL(cxL - wL / 2, cyL - hL / 2, tL, hL, params);
      rectL(cxL + wL / 2 - tL, cyL - hL / 2, tL, hL, params);
    };
    const fillAll = (params) => rectCells(minX, minY, maxX - minX + 1, maxY - minY + 1, params);
    const fillRightOf = (xL, params) => rectCells(lambdaToCells(xL), minY, maxX - lambdaToCells(xL) + 1, maxY - minY + 1, params);
    const fillLeftOf = (xL, params) => rectCells(minX, minY, lambdaToCells(xL) - minX, maxY - minY + 1, params);
    const braggLayers = (startL, pairs, y0L, hL, paramsA = mat.n15, paramsB = mat.n25) => {
      let x = startL;
      const dA = 1 / (4 * 1.5);
      const dB = 1 / (4 * 2.5);
      for (let i = 0; i < pairs; i += 1) {
        rectL(x, y0L, dA, hL, paramsA);
        x += dA;
        rectL(x, y0L, dB, hL, paramsB);
        x += dB;
      }
    };
    const guide = (yL, widthL, params = mat.n34, x0L = 0.4, x1L = domainXLambda - 0.4) => {
      rectL(x0L, yL - widthL / 2, Math.max(0.1, x1L - x0L), widthL, params);
    };
    const guideSource = (yL, overrides = {}) => {
      setSources([{ shape: "gaussianProfile", xLambda: sourceX(0.9), yLambda: sourceY(yL), widthLambda: 0.35, ...overrides }]);
    };
    const phc = ({ skip = () => false, disorder = false, rows = 9, cols = 15 } = {}) => {
      let seed = 1337;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const a = 0.45;
      const r = 0.115;
      for (let ix = -Math.floor(cols / 2); ix <= Math.floor(cols / 2); ix += 1) {
        for (let iy = -Math.floor(rows / 2); iy <= Math.floor(rows / 2); iy += 1) {
          if (skip(ix, iy)) continue;
          const jitterX = disorder ? (rand() - 0.5) * 0.06 : 0;
          const jitterY = disorder ? (rand() - 0.5) * 0.06 : 0;
          ellipseL(midXLambda + ix * a + jitterX, midYLambda + iy * a + jitterY, r, r, mat.n34);
        }
      }
    };
    const scatterCluster = (count, params, radiusL, weak = false) => {
      let seed = weak ? 911 : 503;
      const rand = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x80000000;
      };
      for (let i = 0; i < count; i += 1) {
        const x = 2.7 + rand() * Math.max(1, domainXLambda - 5.2);
        const y = 1 + rand() * Math.max(1, domainYLambda - 2);
        const r = radiusL * (0.75 + rand() * 0.5);
        ellipseL(x, y, r, r, params);
      }
    };
    const sshChain = (d1, d2, interfaceMode = false) => {
      const r = 0.13;
      let x = Math.max(1.2, midXLambda - 3.1);
      for (let i = 0; i < 15; i += 1) {
        ellipseL(x, midYLambda, r, r, mat.n34);
        const useFirstGap = interfaceMode ? i < 7 ? i % 2 === 0 : i % 2 !== 0 : i % 2 === 0;
        x += useFirstGap ? d1 : d2;
      }
    };

    setSources([{ shape: "point", xLambda: sourceX(1.2), yLambda: sourceY(midYLambda) }]);

    switch (name) {
      case "planeWaveAir":
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "planeWaveDielectric":
        fillAll(mat.n15);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "gaussianPulseAir":
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "twoSourceInterference":
        setSources([
          { shape: "point", xLambda: sourceX(1.7), yLambda: sourceY(midYLambda - 0.75), amplitude: 0.42 },
          { shape: "point", xLambda: sourceX(1.7), yLambda: sourceY(midYLambda + 0.75), amplitude: 0.42 },
        ]);
        break;
      case "frequencyBeat":
        setSources([
          { shape: "point", xLambda: sourceX(1.6), yLambda: sourceY(midYLambda - 0.45), frequency: sourceFrequency * 0.93 },
          { shape: "point", xLambda: sourceX(1.6), yLambda: sourceY(midYLambda + 0.45), frequency: sourceFrequency * 1.08 },
        ]);
        break;
      case "singleSlit":
        rectL(midXLambda - 0.03, 0, 0.12, domainYLambda, mat.pec);
        rectL(midXLambda - 0.08, midYLambda - 0.25, 0.22, 0.5, mat.air);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "doubleSlit":
        rectL(midXLambda - 0.03, 0, 0.12, domainYLambda, mat.pec);
        rectL(midXLambda - 0.08, midYLambda - 0.73, 0.22, 0.25, mat.air);
        rectL(midXLambda - 0.08, midYLambda + 0.48, 0.22, 0.25, mat.air);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "circularAperture":
        rectL(midXLambda - 0.03, 0, 0.12, domainYLambda, mat.pec);
        ellipseL(midXLambda, midYLambda, 0.5, 0.5, mat.air);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "poyntingPlaneWave":
        state.viewMode = "poynting";
        state.fieldDisplay = "scalar";
        state.fieldQuiver = true;
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), angleDeg: 25 }]);
        break;
      case "pmlAbsorption":
        setSources([{ type: "gaussian", shape: "gaussianSpot", xLambda: sourceX(1.1), yLambda: sourceY(midYLambda), widthLambda: 0.45, amplitude: 1 }]);
        break;
      case "normalInterface":
        fillRightOf(midXLambda, mat.n15);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "obliqueRefraction":
        fillRightOf(midXLambda, mat.n15);
        setSources([{ shape: "gaussianProfile", xLambda: sourceX(1.0), yLambda: sourceY(midYLambda), widthLambda: 0.8, angleDeg: 28 }]);
        break;
      case "totalInternalReflection":
        fillLeftOf(midXLambda, mat.n15);
        setSources([{ shape: "gaussianProfile", xLambda: sourceX(1.1), yLambda: sourceY(midYLambda), widthLambda: 0.8, angleDeg: 48 }]);
        break;
      case "frustratedTir":
        fillLeftOf(midXLambda - 0.18, mat.n15);
        fillRightOf(midXLambda + 0.18, mat.n15);
        setSources([{ shape: "gaussianProfile", xLambda: sourceX(1.1), yLambda: sourceY(midYLambda), widthLambda: 0.8, angleDeg: 48 }]);
        break;
      case "quarterWaveCoating": {
        const d = 1 / (4 * Math.sqrt(1.5));
        rectL(midXLambda - d, 0, d, domainYLambda, mat.coating);
        fillRightOf(midXLambda, mat.n15);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      }
      case "braggMirror":
      case "braggStack":
        braggLayers(midXLambda - 0.8, 6, 0, domainYLambda);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "lossyInterface":
        fillRightOf(midXLambda, mat.lossyN15);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "anisotropicInterface":
        fillRightOf(midXLambda, mat.anisotropic);
        setSources([{ shape: "gaussianProfile", xLambda: sourceX(1.0), yLambda: sourceY(midYLambda), widthLambda: 0.8, angleDeg: 24 }]);
        break;
      case "jzDipole":
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.35 }]);
        break;
      case "inPlaneDipole":
        state.fieldComponent = "hz";
        setSources([
          {
            shape: "inPlaneElectricDipole",
            xLambda: sourceX(midXLambda),
            yLambda: sourceY(midYLambda),
            widthLambda: 0.35,
            angleDeg: 0,
          },
        ]);
        break;
      case "mzDipole":
        state.fieldComponent = "hz";
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.35 }]);
        break;
      case "dipoleSubstrate":
        rectL(0, midYLambda + 0.35, domainXLambda, Math.max(0.1, domainYLambda - midYLambda - 0.35), mat.n15);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda + 0.1), widthLambda: 0.32 }]);
        break;
      case "dipoleNearPec":
        rectL(midXLambda + 1.0, 0, 0.12, domainYLambda, mat.pec);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.32 }]);
        break;
      case "huygensRadiator":
        setSources([{ shape: "huygens", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.45, angleDeg: 0 }]);
        break;
      case "circularDipole":
        setSources([{ shape: "circularDipoleCw", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.45 }]);
        break;
      case "janusDipole":
        guide(midYLambda, 0.28, mat.n34, midXLambda - 2.2, domainXLambda - 0.6);
        setSources([{ shape: "janusDipole", xLambda: sourceX(midXLambda - 0.75), yLambda: sourceY(midYLambda - 0.42), widthLambda: 0.42, angleDeg: 0 }]);
        break;
      case "dipoleArray": {
        const sources = [];
        for (let i = 0; i < 8; i += 1) {
          sources.push({ shape: "pointDipole", xLambda: sourceX(1.6), yLambda: sourceY(midYLambda - 1.75 + i * 0.5), widthLambda: 0.24, amplitude: 0.32 });
        }
        setSources(sources);
        break;
      }
      case "phasedDipoleArray": {
        const sources = [];
        const phaseStep = 35;
        for (let i = 0; i < 8; i += 1) {
          sources.push({
            shape: "pointDipole",
            xLambda: sourceX(1.6),
            yLambda: sourceY(midYLambda - 1.75 + i * 0.5),
            widthLambda: 0.24,
            amplitude: 0.32,
            phaseDeg: (i - 3.5) * phaseStep,
          });
        }
        setSources(sources);
        break;
      }
      case "apertureRadiator":
        rectL(midXLambda - 0.03, 0, 0.12, domainYLambda, mat.pec);
        rectL(midXLambda - 0.08, midYLambda - 0.28, 0.22, 0.56, mat.air);
        setSources([{ shape: "point", xLambda: sourceX(midXLambda - 0.55), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "slabWaveguide":
        guide(midYLambda, 0.25, mat.n34);
        guideSource(midYLambda, { widthLambda: 0.25 });
        break;
      case "multimodeSlab":
        guide(midYLambda, 0.8, mat.n34);
        guideSource(midYLambda, { widthLambda: 0.45 });
        break;
      case "lossyGuide":
        guide(midYLambda, 0.32, mat.lossyGuide);
        guideSource(midYLambda, { widthLambda: 0.32 });
        break;
      case "taperWaveguide": {
        const x0 = 1.4;
        const length = 3.0;
        for (let i = 0; i < 80; i += 1) {
          const t = i / 79;
          const width = 0.1 + t * 0.3;
          rectL(x0 + t * length, midYLambda - width / 2, length / 80 + 0.02, width, mat.n34);
        }
        guide(midYLambda, 0.4, mat.n34, x0 + length, domainXLambda - 0.5);
        guideSource(midYLambda, { widthLambda: 0.18 });
        break;
      }
      case "widthStepWaveguide":
        guide(midYLambda, 0.25, mat.n34, 0.5, midXLambda);
        guide(midYLambda, 0.5, mat.n34, midXLambda, domainXLambda - 0.5);
        guideSource(midYLambda, { widthLambda: 0.25 });
        break;
      case "directionalCoupler":
        guide(midYLambda - 0.23, 0.22, mat.n34, 0.6, domainXLambda - 0.6);
        guide(midYLambda + 0.23, 0.22, mat.n34, 1.4, domainXLambda - 0.6);
        guideSource(midYLambda - 0.23, { widthLambda: 0.22 });
        break;
      case "mmiWaveguide":
        guide(midYLambda, 0.24, mat.n34, 0.5, 2.2);
        rectL(2.2, midYLambda - 0.5, 3.5, 1.0, mat.n34);
        guide(midYLambda - 0.25, 0.22, mat.n34, 5.7, domainXLambda - 0.5);
        guide(midYLambda + 0.25, 0.22, mat.n34, 5.7, domainXLambda - 0.5);
        guideSource(midYLambda, { widthLambda: 0.25 });
        break;
      case "guideScatterer":
        guide(midYLambda, 0.28, mat.n34);
        ellipseL(midXLambda + 0.9, midYLambda - 0.32, 0.08, 0.08, mat.n20);
        guideSource(midYLambda, { widthLambda: 0.25 });
        break;
      case "stubResonator":
        guide(midYLambda, 0.25, mat.n34);
        rectL(midXLambda - 0.12, midYLambda - 1.05, 0.25, 1.05, mat.n34);
        guideSource(midYLambda, { widthLambda: 0.25 });
        break;
      case "fabryPerot":
        braggLayers(midXLambda - 2.0, 4, 0, domainYLambda);
        braggLayers(midXLambda + 0.65, 4, 0, domainYLambda);
        rectL(midXLambda - 0.55, 0, 1.1, domainYLambda, mat.n15);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "ringResonator":
        guide(midYLambda + 1.25, 0.24, mat.n34);
        ringL(midXLambda + 0.5, midYLambda, 1.1, 1.1, 0.84, 0.84, mat.n34);
        guideSource(midYLambda + 1.25, { widthLambda: 0.24 });
        break;
      case "addDropRing":
        guide(midYLambda + 1.25, 0.24, mat.n34);
        guide(midYLambda - 1.25, 0.24, mat.n34);
        ringL(midXLambda + 0.5, midYLambda, 1.1, 1.1, 0.84, 0.84, mat.n34);
        guideSource(midYLambda + 1.25, { widthLambda: 0.24 });
        break;
      case "dielectricCavity":
        ellipseL(midXLambda, midYLambda, 0.42, 0.42, mat.n34);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.22, amplitude: 0.45 }]);
        break;
      case "pecCavity":
        rectFrameL(midXLambda, midYLambda, 1.4, 1.0, 0.08, mat.pec);
        setSources([{ type: "gaussian", shape: "point", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), amplitude: 0.8 }]);
        break;
      case "pecCylinder":
        ellipseL(midXLambda + 0.7, midYLambda, 0.3, 0.3, mat.pec);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "dielectricCylinder":
        ellipseL(midXLambda + 0.7, midYLambda, 0.3, 0.3, mat.n20);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "mieCylinder":
        ellipseL(midXLambda + 0.7, midYLambda, 0.25, 0.25, mat.n34);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "lossyCylinder":
        ellipseL(midXLambda + 0.7, midYLambda, 0.3, 0.3, { material: 4, eps: 4, loss: 0.2 });
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "dielectricDimer":
        ellipseL(midXLambda + 0.45, midYLambda, 0.25, 0.25, mat.n34);
        ellipseL(midXLambda + 1.05, midYLambda, 0.25, 0.25, mat.n34);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "multipleScattering":
        scatterCluster(20, mat.n20, 0.13);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "weakLocalization":
        scatterCluster(48, mat.weak, 0.07, true);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "finiteConductivity":
        state.materialConductivityEnabled = true;
        state.conductivitySigma = mat.finiteConductor.sigma;
        state.conductivitySigmaY = mat.finiteConductor.sigma;
        rectL(midXLambda - 0.15, 0.65, Math.max(0.25, domainXLambda - midXLambda - 0.5), domainYLambda - 1.3, mat.finiteConductor);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.65 }]);
        break;
      case "drudeMetal":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.drudeMetal.omegaP;
        state.dispersionGamma = mat.drudeMetal.gamma;
        rectL(midXLambda - 0.22, 0.65, 0.44, domainYLambda - 1.3, mat.drudeMetal);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.55 }]);
        break;
      case "lorentzMedium":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "lorentz";
        state.dispersionOmega0 = mat.lorentz.omega0;
        state.dispersionGamma = mat.lorentz.gamma;
        state.dispersionDeltaEps = mat.lorentz.deltaEps;
        rectL(midXLambda - 0.75, 0.75, 1.5, domainYLambda - 1.5, mat.lorentz);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.55 }]);
        break;
      case "debyeDielectric":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "debye";
        state.dispersionDeltaEps = mat.debye.deltaEps;
        state.dispersionTau = mat.debye.tau;
        rectL(midXLambda - 0.75, 0.75, 1.5, domainYLambda - 1.5, mat.debye);
        setSources([{ type: "ricker", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.55 }]);
        break;
      case "plasmaCutoff":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "plasma";
        state.dispersionOmegaP = mat.plasma.omegaP;
        state.dispersionGamma = mat.plasma.gamma;
        rectL(midXLambda - 0.7, 0.65, 1.4, domainYLambda - 1.3, mat.plasma);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.45 }]);
        break;
      case "enzSlab":
        rectL(midXLambda - 0.15, 0, 0.3, domainYLambda, mat.enz);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "anisotropicMedium":
        rectL(midXLambda - 1.2, midYLambda - 1.2, 2.4, 2.4, mat.anisotropic);
        setSources([{ shape: "point", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), amplitude: 0.55 }]);
        break;
      case "hyperbolicMedium":
        rectL(midXLambda - 1.3, midYLambda - 1.2, 2.6, 2.4, mat.hyperbolic);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.35, amplitude: 0.35 }]);
        break;
      case "gyrotropicMedium":
        state.fieldComponent = "hz";
        state.fieldDisplay = "electricMag";
        state.fieldQuiver = true;
        state.materialGyrotropyEnabled = true;
        state.gyrotropyG = mat.gyrotropic.gyro;
        rectL(midXLambda - 1.0, 0.75, 2.0, domainYLambda - 1.5, mat.gyrotropic);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.65 }]);
        break;
      case "photonicCrystal":
        phc();
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "phcPointDefect":
        phc({ skip: (ix, iy) => ix === 0 && iy === 0 });
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.25, amplitude: 0.55 }]);
        break;
      case "phcWaveguide":
        phc({ skip: (_ix, iy) => iy === 0 });
        guideSource(midYLambda, { widthLambda: 0.32 });
        break;
      case "phcDisorder":
        phc({ disorder: true });
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "fanoResonator":
        guide(midYLambda, 0.25, mat.n34);
        ellipseL(midXLambda + 0.8, midYLambda - 0.62, 0.36, 0.36, mat.n34);
        guideSource(midYLambda, { widthLambda: 0.25 });
        break;
      case "sshTrivial":
        sshChain(0.42, 0.25);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda - 3), yLambda: sourceY(midYLambda), widthLambda: 0.24 }]);
        break;
      case "sshTopological":
        sshChain(0.25, 0.42);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda - 3), yLambda: sourceY(midYLambda), widthLambda: 0.24 }]);
        break;
      case "sshInterface":
        sshChain(0.25, 0.42, true);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.24 }]);
        break;
      case "sppInterface": {
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.plasmonicMetal.omegaP;
        state.dispersionGamma = mat.plasmonicMetal.gamma;
        const interfaceY = midYLambda + 0.45;
        rectL(0, interfaceY, domainXLambda, Math.max(0.1, domainYLambda - interfaceY), mat.plasmonicMetal);
        setSources([
          {
            shape: "pointDipole",
            xLambda: sourceX(midXLambda - 2.2),
            yLambda: sourceY(interfaceY - 0.16),
            widthLambda: 0.22,
            amplitude: 0.38,
          },
        ]);
        break;
      }
      case "sppGrating": {
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.plasmonicMetal.omegaP;
        state.dispersionGamma = mat.plasmonicMetal.gamma;
        const interfaceY = midYLambda + 0.55;
        rectL(0, interfaceY, domainXLambda, Math.max(0.1, domainYLambda - interfaceY), mat.plasmonicMetal);
        const pitch = 0.42;
        const start = Math.max(1.2, midXLambda - 2.2);
        for (let i = 0; i < 11; i += 1) {
          const x = start + i * pitch;
          rectL(x, interfaceY - 0.13, 0.16, 0.13, mat.plasmonicMetal);
          if (i % 2 === 0) {
            rectL(x + 0.16, interfaceY, 0.10, 0.11, mat.air);
          }
        }
        setSources([
          {
            shape: "gaussianProfile",
            xLambda: sourceX(1.15),
            yLambda: sourceY(interfaceY - 0.9),
            widthLambda: 0.75,
            angleDeg: 18,
            amplitude: 0.42,
          },
        ]);
        break;
      }
      case "localizedPlasmon":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.plasmonicMetal.omegaP;
        state.dispersionGamma = mat.plasmonicMetal.gamma;
        ellipseL(midXLambda + 0.35, midYLambda, 0.34, 0.34, mat.plasmonicMetal);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.55, amplitude: 0.55 }]);
        break;
      case "plasmonicDimer":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.plasmonicMetal.omegaP;
        state.dispersionGamma = mat.plasmonicMetal.gamma;
        ellipseL(midXLambda + 0.15, midYLambda, 0.26, 0.26, mat.plasmonicMetal);
        ellipseL(midXLambda + 0.75, midYLambda, 0.26, 0.26, mat.plasmonicMetal);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.45, amplitude: 0.5 }]);
        break;
      case "metasurfacePhaseBars":
        for (let i = -7; i <= 7; i += 1) {
          const y = midYLambda + i * 0.28;
          const h = 0.12 + (i + 7) * 0.018;
          rectL(midXLambda - 0.04, y - h / 2, 0.08, h, mat.n34);
        }
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "negativeIndexSlab":
        rectL(midXLambda - 0.45, 0.5, 0.9, domainYLambda - 1.0, mat.negative);
        setSources([{ shape: "gaussianProfile", xLambda: sourceX(1.0), yLambda: sourceY(midYLambda), widthLambda: 0.8, angleDeg: 28, amplitude: 0.35 }]);
        break;
      case "superlensSlab":
        rectL(midXLambda - 0.25, 0.6, 0.5, domainYLambda - 1.2, mat.negative);
        setSources([{ shape: "point", xLambda: sourceX(midXLambda - 1.0), yLambda: sourceY(midYLambda), amplitude: 0.35 }]);
        break;
      case "enzEmitter":
        rectL(midXLambda + 0.25, 0.7, 0.45, domainYLambda - 1.4, mat.enz);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda - 0.35), yLambda: sourceY(midYLambda), widthLambda: 0.3, amplitude: 0.45 }]);
        break;
      case "kerrSlab":
        state.materialNonlinearEnabled = true;
        state.kerrChi3 = 0.65;
        state.kerrSaturation = 3.5;
        rectL(midXLambda - 0.9, 0.75, 1.8, domainYLambda - 1.5, { ...mat.n15, nonlinear: true });
        setSources([{ shape: "gaussianProfile", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.75, amplitude: 0.75 }]);
        break;
      case "shgSlab":
        state.materialHarmonicEnabled = true;
        state.harmonicChi2 = 0.12;
        state.harmonicChi3 = 0;
        state.harmonicSaturation = 5.5;
        rectL(midXLambda - 0.9, 0.75, 1.8, domainYLambda - 1.5, { ...mat.n15, nonlinear: true });
        setSources([{ type: "sine", shape: "gaussianProfile", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.72, amplitude: 0.62 }]);
        break;
      case "thgSlab":
        state.materialHarmonicEnabled = true;
        state.harmonicChi2 = 0;
        state.harmonicChi3 = 0.055;
        state.harmonicSaturation = 5.5;
        rectL(midXLambda - 0.9, 0.75, 1.8, domainYLambda - 1.5, { ...mat.n15, nonlinear: true });
        setSources([{ type: "sine", shape: "gaussianProfile", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.72, amplitude: 0.68 }]);
        break;
      case "vo2SwitchingSlab":
        state.materialPhaseChangeEnabled = true;
        state.phaseEpsOn = 9;
        state.phaseLossOn = 0.08;
        state.phaseThresholdOn = 0.55;
        state.phaseThresholdOff = 0.16;
        state.phaseTauOn = 14;
        state.phaseTauOff = 220;
        rectL(midXLambda - 0.85, 0.75, 1.7, domainYLambda - 1.5, mat.phaseOff);
        setSources([
          {
            type: "gaussian",
            shape: "gaussianProfile",
            xLambda: sourceX(0.9),
            yLambda: sourceY(midYLambda),
            widthLambda: 0.75,
            amplitude: 0.9,
          },
        ]);
        break;
      case "pcmMemoryCell":
        state.materialPhaseChangeEnabled = true;
        state.phaseEpsOn = 12;
        state.phaseLossOn = 0.03;
        state.phaseThresholdOn = 0.45;
        state.phaseThresholdOff = 0.08;
        state.phaseTauOn = 20;
        state.phaseTauOff = 900;
        guide(midYLambda, 0.28, mat.n34, 0.6, domainXLambda - 0.6);
        ellipseL(midXLambda + 0.45, midYLambda, 0.28, 0.18, mat.pcmOff);
        guideSource(midYLambda, { type: "gaussian", widthLambda: 0.32, amplitude: 0.75 });
        break;
      case "temporalModulation":
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.18;
        state.modulationFrequency = 0.012;
        state.modulationPeriodLambda = 20;
        rectL(midXLambda - 1.25, midYLambda - 1.0, 2.5, 2.0, { ...mat.n15, modulated: true });
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.4 }]);
        break;
      case "travelingModulation":
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.2;
        state.modulationFrequency = 0.014;
        state.modulationPeriodLambda = 1.2;
        state.modulationAngleDeg = 0;
        guide(midYLambda, 0.34, { ...mat.n15, modulated: true }, midXLambda - 2.0, midXLambda + 2.0);
        guideSource(midYLambda, { widthLambda: 0.32, amplitude: 0.4 });
        break;
      case "ptSymmetricCoupler":
        state.materialSaturableGainEnabled = true;
        state.gainSaturation = 3.6;
        guide(midYLambda - 0.24, 0.24, mat.ptGain, 0.7, domainXLambda - 0.7);
        guide(midYLambda + 0.24, 0.24, mat.ptLoss, 0.7, domainXLambda - 0.7);
        setSources([
          {
            type: "gaussian",
            shape: "gaussianProfile",
            xLambda: sourceX(0.95),
            yLambda: sourceY(midYLambda + 0.24),
            widthLambda: 0.28,
            amplitude: 0.42,
          },
        ]);
        break;
      case "dielectricBlock":
        rectL(midXLambda - 0.9, midYLambda - 1.0, 1.8, 2.0, mat.n15);
        break;
      case "lens":
        ellipseL(midXLambda + 0.6, midYLambda, 0.55, 1.7, mat.n15);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "waveguide":
        guide(midYLambda - 0.5, 0.12, mat.pec);
        guide(midYLambda + 0.5, 0.12, mat.pec);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "scatterers":
        scatterCluster(8, mat.n20, 0.16);
        scatterCluster(4, mat.lossyN15, 0.14, true);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "empty":
      default:
        break;
    }
    this.refreshPmlMaterialContinuation(false);
    this.resetFields();
  }

  sourceSample(source, phaseRad = 0) {
    const f = source.frequency;
    const absolutePhase = ((Number(source.phaseDeg) || 0) * Math.PI) / 180;
    const phaseTimeOffset = f > 0 ? (phaseRad + absolutePhase) / (2 * Math.PI * f) : 0;
    return this.sourceSampleAtTime(source, this.time + phaseTimeOffset);
  }

  sourceSampleAtTime(source, t) {
    const f = source.frequency;
    const amp = source.amplitude;
    if (source.type === "gaussian") {
      const center = 48;
      const width = 14;
      return amp * Math.exp(-((t - center) * (t - center)) / (2 * width * width));
    }
    if (source.type === "ricker") {
      const center = 48;
      const a = Math.PI * f * (t - center);
      const a2 = a * a;
      return amp * (1 - 2 * a2) * Math.exp(-a2);
    }
    return amp * Math.sin(2 * Math.PI * f * t);
  }

  injectSource() {
    for (const source of state.sources) {
      this.injectSingleSource(source);
    }
  }

  injectSingleSource(source) {
    const sx = this.sourceXCell(source);
    const sy = this.sourceYCell(source);
    if (source.shape === "line") {
      this.injectPlaneWaveIncidentField(source, sx, sy);
      return;
    }
    if (source.shape === "gaussianProfile") {
      this.injectGaussianLineIncidentField(source, sx, sy);
      return;
    }
    const value = this.sourceSample(source);
    if (inPlaneElectricCurrentShapes.has(source.shape)) {
      this.injectInPlaneElectricCurrent(sx, sy, source, value);
      return;
    }
    if (localizedSourceShapes.has(source.shape)) {
      this.injectLocalizedAnalyticCurrent(sx, sy, source);
      return;
    }
    this.injectPointCurrent(value, sx, sy);
  }

  incidentLinePhase(source, y, sy) {
    const theta = (source.angleDeg * Math.PI) / 180;
    const kCells = (2 * Math.PI * source.frequency) / Math.max(COURANT, 1e-9);
    return -kCells * (y - sy) * Math.sin(theta);
  }

  injectPlaneWaveIncidentField(source, sx, sy) {
    const halfWindow = Math.max(12, Math.round(this.ny * 0.42));
    const y0 = Math.max(this.activeInteriorMinY(), sy - halfWindow);
    const y1 = Math.min(this.activeInteriorMaxY(), sy + halfWindow);
    for (let y = y0; y <= y1; y += 1) {
      const taper = 0.54 + 0.46 * Math.sin(Math.PI * (y - y0) / Math.max(1, y1 - y0));
      const idx = this.id(sx, y);
      if (this.material[idx] !== 2) {
        const value = this.sourceSample(source, this.incidentLinePhase(source, y, sy));
        this.addIncidentScalarField(idx, value * taper);
      }
    }
  }

  injectGaussianLineIncidentField(source, sx, sy) {
    const fwhm = state.preset === "customSlab" ? this.slabCoreThicknessCells() : Math.max(4, Math.round(this.ny * 0.09));
    const halfWindow = Math.max(3, Math.ceil(fwhm * 2.5));
    const y0 = Math.max(this.activeInteriorMinY(), sy - halfWindow);
    const y1 = Math.min(this.activeInteriorMaxY(), sy + halfWindow);
    for (let y = y0; y <= y1; y += 1) {
      const normalized = (y - sy) / fwhm;
      const profile = Math.exp(-4 * Math.LN2 * normalized * normalized);
      const idx = this.id(sx, y);
      if (this.material[idx] !== 2) {
        const value = this.sourceSample(source, this.incidentLinePhase(source, y, sy));
        this.addIncidentScalarField(idx, value * profile);
      }
    }
  }

  injectPointCurrent(value, sx, sy) {
    const x0 = Math.max(this.activeInteriorMinX(), sx - 1);
    const x1 = Math.min(this.activeInteriorMaxX(), sx + 1);
    const y0 = Math.max(this.activeInteriorMinY(), sy - 1);
    const y1 = Math.min(this.activeInteriorMaxY(), sy + 1);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const idx = this.id(x, y);
        if (this.material[idx] !== 2) {
          this.addScalarCurrentSource(idx, value * (x === sx && y === sy ? 1 : 0.45), x, y);
        }
      }
    }
  }

  injectLocalizedAnalyticCurrent(sx, sy, source) {
    const shape = source.shape;
    const order = this.localizedSourceOrder(shape, source);
    const fwhm = this.sourceEnvelopeFwhmCells(source);
    const sigma = Math.max(1, fwhm / (2 * Math.sqrt(2 * Math.LN2)));
    const radiusSigma = shape === "gaussianSpot" ? 3 : Math.max(3.5, Math.sqrt(order) + 1.5);
    const radius = Math.ceil(sigma * radiusSigma);
    const minX = Math.max(this.activeInteriorMinX(), sx - radius);
    const maxX = Math.min(this.activeInteriorMaxX(), sx + radius);
    const minY = Math.max(this.activeInteriorMinY(), sy - radius);
    const maxY = Math.min(this.activeInteriorMaxY(), sy + radius);
    const theta = (source.angleDeg * Math.PI) / 180;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const sourceSamples = new Map();
    const sampleAtPhase = (phaseRad) => {
      const key = Math.round(phaseRad * 1e6);
      if (!sourceSamples.has(key)) sourceSamples.set(key, this.sourceSample(source, phaseRad));
      return sourceSamples.get(key);
    };

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - sx;
        const dy = sy - y;
        const u = (dx * cosTheta + dy * sinTheta) / sigma;
        const v = (-dx * sinTheta + dy * cosTheta) / sigma;
        const terms = this.localizedSourceTerms(shape, order, u, v, source);
        let value = 0;
        for (const term of terms) {
          if (Math.abs(term.profile) < 1e-4) continue;
          value += sampleAtPhase(term.phaseRad || 0) * term.profile;
        }
        if (Math.abs(value) < 1e-5) continue;
        const idx = this.id(x, y);
        if (this.material[idx] !== 2) {
          this.addScalarCurrentSource(idx, value, x, y);
        }
      }
    }
  }

  injectInPlaneElectricCurrent(sx, sy, source, value) {
    if (state.fieldComponent !== "hz") return;
    const fwhm = this.sourceEnvelopeFwhmCells(source);
    const sigma = Math.max(1, fwhm / (2 * Math.sqrt(2 * Math.LN2)));
    const radius = Math.ceil(sigma * 3);
    const theta = (source.angleDeg * Math.PI) / 180;
    const ux = Math.cos(theta);
    const uy = Math.sin(theta);
    const minX = Math.max(this.activeInteriorMinX(), sx - radius);
    const maxX = Math.min(this.activeInteriorMaxX(), sx + radius);
    const minY = Math.max(this.activeInteriorMinY(), sy - radius);
    const maxY = Math.min(this.activeInteriorMaxY(), sy + radius);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = (x - sx) / sigma;
        const dy = (y - sy) / sigma;
        const profile = Math.exp(-0.5 * (dx * dx + dy * dy));
        if (profile < 1e-4) continue;
        const idx = this.id(x, y);
        if (this.material[idx] === 2) continue;
        this.addElectricCurrentJx(idx, value * profile * ux, x, y);
        this.addElectricCurrentJy(idx, value * profile * uy, x, y);
      }
    }
  }

  localizedSourceOrder(shape, source) {
    if (shape === "pointDipole" || circularDipoleSourceShapes.has(shape) || shape === "janusDipole" || shape === "huygens") return 1;
    if (shape === "dipole") return 1;
    if (shape === "quadrupole") return 2;
    if (shape === "multipole") return clampInt(source.multipoleOrder, 1, 8);
    return 0;
  }

  localizedSourceTerms(shape, order, u, v, source) {
    const gaussian = this.localizedGaussianProfile(u, v);
    const dipoleU = this.localizedHermiteProfile(1, u, v, false);
    const dipoleV = this.localizedHermiteProfile(1, u, v, true);
    if (shape === "gaussianSpot") return [{ profile: gaussian, phaseRad: 0 }];
    if (shape === "pointDipole" || shape === "dipole") return [{ profile: dipoleU, phaseRad: 0 }];
    if (shape === "circularDipoleCw") {
      return [
        { profile: dipoleU, phaseRad: 0 },
        { profile: dipoleV, phaseRad: Math.PI / 2 },
      ];
    }
    if (shape === "circularDipoleCcw") {
      return [
        { profile: dipoleU, phaseRad: 0 },
        { profile: dipoleV, phaseRad: -Math.PI / 2 },
      ];
    }
    if (shape === "janusDipole") {
      return [
        { profile: 0.72 * dipoleU, phaseRad: 0 },
        { profile: 0.72 * gaussian, phaseRad: Math.PI / 2 },
      ];
    }
    if (shape === "huygens") {
      return [
        { profile: 0.56 * gaussian, phaseRad: 0 },
        { profile: 0.56 * dipoleU, phaseRad: 0 },
      ];
    }
    return [{ profile: this.localizedSourceProfile(shape, order, u, v, source), phaseRad: 0 }];
  }

  localizedGaussianProfile(u, v) {
    return Math.exp(-0.5 * (u * u + v * v));
  }

  localizedHermiteProfile(order, u, v, useSineAngular = false) {
    const r2 = u * u + v * v;
    if (r2 < 1e-12 || order < 1) return 0;
    const rho = Math.sqrt(r2);
    const phi = Math.atan2(v, u);
    const angular = useSineAngular ? Math.sin(order * phi) : Math.cos(order * phi);
    const envelope = Math.exp(-0.5 * r2);
    const peak = Math.pow(order, order * 0.5) * Math.exp(-0.5 * order);
    return (Math.pow(rho, order) * angular * envelope) / Math.max(peak, 1e-9);
  }

  localizedSourceProfile(shape, order, u, v, source) {
    if (shape === "gaussianSpot") return this.localizedGaussianProfile(u, v);
    return this.localizedHermiteProfile(order, u, v, shape === "multipole" && source.multipolePhase === "sin");
  }

  sourceFwhmCanvasRadius(source) {
    const fwhm = this.sourceEnvelopeFwhmCells(source);
    const pixelsPerCell = Math.min(this.canvas.width / this.visibleGridWidth(), this.canvas.height / this.visibleGridHeight());
    return Math.max(6 * Math.max(1, window.devicePixelRatio || 1), 0.5 * fwhm * pixelsPerCell);
  }

  zeroElectricCell(idx) {
    this.ez[idx] = 0;
    this.ezx[idx] = 0;
    this.ezy[idx] = 0;
  }

  addIncidentScalarField(idx, value) {
    const scaledValue = Number.isFinite(this.fieldScale) ? value / this.fieldScale : 0;
    const half = scaledValue * 0.5;
    this.ezx[idx] += half;
    this.ezy[idx] += half;
    this.ez[idx] = this.ezx[idx] + this.ezy[idx];
  }

  addScalarCurrentSource(idx, value, x, y) {
    if (state.fieldComponent === "hz") {
      this.addMagneticCurrentMz(idx, value, x, y);
    } else {
      this.addElectricCurrentJz(idx, value, x, y);
    }
  }

  addElectricCurrentJz(idx, jz, x, y) {
    const scaledJz = Number.isFinite(this.fieldScale) ? jz / this.fieldScale : 0;
    const halfJz = scaledJz * 0.5;
    const currentScaleX = this.eCbX[x] * (this.courant / this.eps[idx]);
    const currentScaleY = this.eCbY[y] * (this.courant / this.epsY[idx]);
    const decayX = this.electricLossDecay(this.loss[idx], idx);
    const decayY = this.electricLossDecay(this.lossY[idx], idx);
    this.ezx[idx] -= currentScaleX * halfJz * decayX;
    this.ezy[idx] -= currentScaleY * halfJz * decayY;
    this.ez[idx] = this.ezx[idx] + this.ezy[idx];
  }

  addMagneticCurrentMz(idx, mz, x, y) {
    const scaledMz = Number.isFinite(this.fieldScale) ? mz / this.fieldScale : 0;
    const halfMz = scaledMz * 0.5;
    const currentScaleX = this.hCbX[x] * (this.courant / this.mu[idx]);
    const currentScaleY = this.hCbY[y] * (this.courant / this.muY[idx]);
    const decayX = 1 / (1 + this.muLoss[idx]);
    const decayY = 1 / (1 + this.muLossY[idx]);
    this.ezx[idx] -= currentScaleX * halfMz * decayX;
    this.ezy[idx] -= currentScaleY * halfMz * decayY;
    this.ez[idx] = this.ezx[idx] + this.ezy[idx];
  }

  addElectricCurrentJx(idx, jx, x, y) {
    const scaledJx = Number.isFinite(this.fieldScale) ? jx / this.fieldScale : 0;
    const currentScale = this.eCbY[y] * (this.courant / this.eps[idx]);
    const decay = this.electricLossDecay(this.loss[idx], idx);
    this.hx[idx] -= currentScale * scaledJx * decay;
  }

  addElectricCurrentJy(idx, jy, x, y) {
    const scaledJy = Number.isFinite(this.fieldScale) ? jy / this.fieldScale : 0;
    const currentScale = this.eCbX[x] * (this.courant / this.epsY[idx]);
    const decay = this.electricLossDecay(this.lossY[idx], idx);
    this.hy[idx] -= currentScale * scaledJy * decay;
  }

  restoreDynamicMaterialsToBase() {
    for (let i = 0; i < this.n; i += 1) {
      if (!this.modulatedMaterial[i] && !this.nonlinearMaterial[i]) continue;
      this.eps[i] = this.modulationBaseEps[i];
      this.epsY[i] = this.modulationBaseEpsY[i];
    }
  }

  restoreModulatedMaterialsToBase() {
    this.restoreDynamicMaterialsToBase();
  }

  nonlinearIntensityAt(idx) {
    if (state.fieldComponent === "hz") {
      return this.hx[idx] * this.hx[idx] + this.hy[idx] * this.hy[idx];
    }
    return this.ez[idx] * this.ez[idx];
  }

  nonlinearPolarization(fieldValue) {
    const chi2 = clamp(Number(state.harmonicChi2) || 0, -2, 2);
    const chi3 = clamp(Number(state.harmonicChi3) || 0, -2, 2);
    if (chi2 === 0 && chi3 === 0) return 0;
    const field = clamp(fieldValue, -1e4, 1e4);
    const saturation = Math.max(0.05, Number(state.harmonicSaturation) || 6);
    const limiter = 1 / (1 + (field * field) / saturation);
    return limiter * (chi2 * field * field + chi3 * field * field * field);
  }

  applyHarmonicNonlinearResponse() {
    if (!state.materialHarmonicEnabled) return;
    const nx = this.nx;
    const ny = this.ny;
    const s = this.courant;

    if (state.fieldComponent === "hz") {
      for (let y = 1; y < ny - 1; y += 1) {
        const row = y * nx;
        for (let x = 1; x < nx - 1; x += 1) {
          const idx = row + x;
          if (!this.nonlinearMaterial[idx] || this.material[idx] === 2) continue;
          const px = this.nonlinearPolarization(this.hx[idx]);
          const py = this.nonlinearPolarization(this.hy[idx]);
          const jx = clamp(px - this.harmonicPrevPx[idx], -1e4, 1e4);
          const jy = clamp(py - this.harmonicPrevPy[idx], -1e4, 1e4);
          this.harmonicPrevPx[idx] = px;
          this.harmonicPrevPy[idx] = py;
          this.hx[idx] -= this.eCbY[y] * (s / Math.max(1e-6, Math.abs(this.eps[idx]))) * jx;
          this.hy[idx] -= this.eCbX[x] * (s / Math.max(1e-6, Math.abs(this.epsY[idx]))) * jy;
        }
      }
      return;
    }

    for (let y = 1; y < ny - 1; y += 1) {
      const row = y * nx;
      for (let x = 1; x < nx - 1; x += 1) {
        const idx = row + x;
        if (!this.nonlinearMaterial[idx] || this.material[idx] === 2) continue;
        const pz = this.nonlinearPolarization(this.ez[idx]);
        const jz = clamp(pz - this.harmonicPrevPz[idx], -1e4, 1e4);
        this.harmonicPrevPz[idx] = pz;
        this.ezx[idx] -= this.eCbX[x] * (s / Math.max(1e-6, Math.abs(this.eps[idx]))) * jz * 0.5;
        this.ezy[idx] -= this.eCbY[y] * (s / Math.max(1e-6, Math.abs(this.epsY[idx]))) * jz * 0.5;
        this.ez[idx] = this.ezx[idx] + this.ezy[idx];
      }
    }
  }

  applyDynamicMaterialResponse() {
    if (!state.materialModulationEnabled && !state.materialNonlinearEnabled) return;
    const modulationActive = state.materialModulationEnabled;
    const nonlinearActive = state.materialNonlinearEnabled;
    const depth = modulationActive ? clamp(Number(state.modulationDepth) || 0, 0, 0.95) : 0;
    const periodCells = Math.max(1, lambdaToCells(Math.max(0.1, state.modulationPeriodLambda)));
    const theta = (state.modulationAngleDeg * Math.PI) / 180;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const omegaCycles = Number(state.modulationFrequency) || 0;
    const phase = (state.modulationPhaseDeg * Math.PI) / 180;
    const chi3 = nonlinearActive ? clamp(Number(state.kerrChi3) || 0, -20, 20) : 0;
    const saturation = Math.max(0.05, Number(state.kerrSaturation) || 5);

    for (let y = 0; y < this.ny; y += 1) {
      const row = y * this.nx;
      for (let x = 0; x < this.nx; x += 1) {
        const idx = row + x;
        if (!this.modulatedMaterial[idx] && !this.nonlinearMaterial[idx]) continue;
        let factor = 1;
        if (depth > 0 && this.modulatedMaterial[idx]) {
          const spatialCycles = (x * cosTheta + y * sinTheta) / periodCells;
          const argument = 2 * Math.PI * (spatialCycles - omegaCycles * this.time) + phase;
          factor += depth * Math.cos(argument);
        }
        let deltaEps = 0;
        if (chi3 !== 0 && this.nonlinearMaterial[idx]) {
          const rawIntensity = Math.min(this.nonlinearIntensityAt(idx), 1e6);
          const saturatedIntensity = rawIntensity / (1 + rawIntensity / saturation);
          deltaEps = chi3 * saturatedIntensity;
        }
        this.eps[idx] = clamp(this.modulationBaseEps[idx] * factor + deltaEps, -30, 30);
        this.epsY[idx] = clamp(this.modulationBaseEpsY[idx] * factor + deltaEps, -30, 30);
      }
    }
  }

  applyPhaseChangeResponse() {
    if (!state.materialPhaseChangeEnabled) return;
    const thresholdOn = Math.max(0, Number(state.phaseThresholdOn) || 0);
    const thresholdOff = Math.min(thresholdOn, Math.max(0, Number(state.phaseThresholdOff) || 0));
    const tauOn = Math.max(1, Number(state.phaseTauOn) || 18);
    const tauOff = Math.max(1, Number(state.phaseTauOff) || 180);
    const alphaOn = 1 - Math.exp(-1 / tauOn);
    const alphaOff = 1 - Math.exp(-1 / tauOff);

    for (let i = 0; i < this.n; i += 1) {
      if (!this.phaseChangeMaterial[i] || this.material[i] === 2) continue;
      const intensity = Math.min(this.nonlinearIntensityAt(i), 1e12);
      let s = this.phaseState[i];
      if (intensity >= thresholdOn) {
        s += (1 - s) * alphaOn;
      } else if (intensity <= thresholdOff) {
        s -= s * alphaOff;
      }
      s = clamp(s, 0, 1);
      this.phaseState[i] = s;
      this.eps[i] = clamp(lerp(this.phaseEpsOff[i], this.phaseEpsOn[i], s), -30, 30);
      this.loss[i] = clamp(lerp(this.phaseLossOff[i], this.phaseLossOn[i], s), -30, 30);
      this.epsY[i] = clamp(lerp(this.phaseEpsYOff[i], this.phaseEpsYOn[i], s), -30, 30);
      this.lossY[i] = clamp(lerp(this.phaseLossYOff[i], this.phaseLossYOn[i], s), -30, 30);
      if (this.modulatedMaterial[i] || this.nonlinearMaterial[i]) {
        this.modulationBaseEps[i] = this.eps[i];
        this.modulationBaseEpsY[i] = this.epsY[i];
      }
    }
  }

  advanceDispersiveCurrent(idx, fieldValue, polarization, current) {
    const kind = this.dispersiveMaterial[idx];
    if (!kind) return 0;
    const gamma = Math.max(0, this.dispersionGamma[idx]);
    const decay = Math.exp(-gamma);
    const sourceCoeff = gamma > 1e-6 ? (1 - decay) / gamma : 1;
    let p = polarization[idx];
    let j = current[idx];

    if (kind === 1) {
      const omegaP = Math.max(0, this.dispersionOmegaP[idx]);
      j = decay * j + sourceCoeff * omegaP * omegaP * fieldValue;
      p += j;
    } else if (kind === 2) {
      const omega0 = Math.max(0, this.dispersionOmega0[idx]);
      const deltaEps = this.dispersionDeltaEps[idx];
      j = decay * j + sourceCoeff * (deltaEps * omega0 * omega0 * fieldValue - omega0 * omega0 * p);
      p += j;
    } else if (kind === 3) {
      const tau = Math.max(1, this.dispersionTau[idx]);
      const relax = Math.exp(-1 / tau);
      const nextP = relax * p + (1 - relax) * this.dispersionDeltaEps[idx] * fieldValue;
      j = nextP - p;
      p = nextP;
    }

    polarization[idx] = clamp(p, -1e6, 1e6);
    current[idx] = clamp(j, -1e6, 1e6);
    return current[idx];
  }

  applyDispersiveElectricResponse() {
    if (!state.materialDispersionEnabled) return;
    const nx = this.nx;
    const ny = this.ny;
    const s = this.courant;
    if (state.fieldComponent === "hz") {
      for (let y = 1; y < ny - 1; y += 1) {
        const row = y * nx;
        for (let x = 1; x < nx - 1; x += 1) {
          const idx = row + x;
          if (!this.dispersiveMaterial[idx] || this.material[idx] === 2) continue;
          const jx = this.advanceDispersiveCurrent(idx, this.hx[idx], this.dispPx, this.dispJx);
          const jy = this.advanceDispersiveCurrent(idx, this.hy[idx], this.dispPy, this.dispJy);
          const epsX = Math.max(1e-6, Math.abs(this.eps[idx]));
          const epsY = Math.max(1e-6, Math.abs(this.epsY[idx]));
          this.hx[idx] -= this.eCbY[y] * (s / epsX) * jx;
          this.hy[idx] -= this.eCbX[x] * (s / epsY) * jy;
        }
      }
      return;
    }

    for (let y = 1; y < ny - 1; y += 1) {
      const row = y * nx;
      for (let x = 1; x < nx - 1; x += 1) {
        const idx = row + x;
        if (!this.dispersiveMaterial[idx] || this.material[idx] === 2) continue;
        const jz = this.advanceDispersiveCurrent(idx, this.ez[idx], this.dispPz, this.dispJz);
        const epsX = Math.max(1e-6, Math.abs(this.eps[idx]));
        const epsY = Math.max(1e-6, Math.abs(this.epsY[idx]));
        this.ezx[idx] -= this.eCbX[x] * (s / epsX) * jz * 0.5;
        this.ezy[idx] -= this.eCbY[y] * (s / epsY) * jz * 0.5;
        this.ez[idx] = this.ezx[idx] + this.ezy[idx];
      }
    }
  }

  step() {
    this.applyPhaseChangeResponse();
    this.applyDynamicMaterialResponse();
    if (!this.hasDynamicMaterialResponse() && this.wasmBackend?.canStep(state.fieldComponent)) {
      this.wasmBackend.step(this);
      this.zeroBoundaryFields();
      this.injectSource();
      this.time += 1;
      this.updateDiagnostics();
      return;
    }

    if (state.fieldComponent === "hz") {
      this.stepHzMode();
    } else {
      this.stepEzMode();
      this.applyDispersiveElectricResponse();
    }
    this.applyHarmonicNonlinearResponse();

    this.zeroBoundaryFields();
    this.injectSource();
    this.time += 1;
    this.updateDiagnostics();
  }

  conductivityDamp(sigma, materialValue) {
    const value = Number(sigma) || 0;
    if (value <= 0) return 0;
    const denominator = Math.max(1e-6, Math.abs(materialValue));
    return Math.min(1e6, (value * this.courant) / (2 * denominator));
  }

  effectiveElectricLoss(lossValue, idx) {
    let value = Number(lossValue) || 0;
    if (state.materialSaturableGainEnabled && value < 0) {
      const saturation = Math.max(0.05, Number(state.gainSaturation) || 4);
      const intensity = Math.min(this.nonlinearIntensityAt(idx), 1e12);
      value /= 1 + intensity / saturation;
    }
    return Math.max(-0.95, value);
  }

  electricLossDecay(lossValue, idx) {
    return 1 / (1 + this.effectiveElectricLoss(lossValue, idx));
  }

  stepEzMode() {
    const nx = this.nx;
    const ny = this.ny;
    const s = this.courant;
    const ez = this.ez;
    const ezx = this.ezx;
    const ezy = this.ezy;
    const hx = this.hx;
    const hy = this.hy;
    const eps = this.eps;
    const loss = this.loss;
    const epsY = this.epsY;
    const lossY = this.lossY;
    const conductivity = this.conductivity;
    const conductivityY = this.conductivityY;
    const mu = this.mu;
    const muLoss = this.muLoss;
    const muY = this.muY;
    const muLossY = this.muLossY;
    const eCaX = this.eCaX;
    const eCbX = this.eCbX;
    const eCaY = this.eCaY;
    const eCbY = this.eCbY;
    const hCaX = this.hCaX;
    const hCbX = this.hCbX;
    const hCaY = this.hCaY;
    const hCbY = this.hCbY;

    for (let y = 0; y < ny - 1; y += 1) {
      const row = y * nx;
      const ca = hCaY[y];
      const cb = hCbY[y];
      for (let x = 0; x < nx; x += 1) {
        const i = row + x;
        const magneticDecay = 1 / (1 + muLoss[i]);
        const magneticScale = s / mu[i];
        hx[i] = (ca * hx[i] - cb * magneticScale * (ez[i + nx] - ez[i])) * magneticDecay;
      }
    }

    for (let y = 0; y < ny; y += 1) {
      const row = y * nx;
      for (let x = 0; x < nx - 1; x += 1) {
        const i = row + x;
        const magneticDecay = 1 / (1 + muLossY[i]);
        const magneticScale = s / muY[i];
        hy[i] = (hCaX[x] * hy[i] + hCbX[x] * magneticScale * (ez[i + 1] - ez[i])) * magneticDecay;
      }
    }

    for (let y = 1; y < ny - 1; y += 1) {
      const row = y * nx;
      for (let x = 1; x < nx - 1; x += 1) {
        const i = row + x;
        if (this.material[i] === 2) {
          this.zeroElectricCell(i);
          continue;
        }
        const dHyDx = hy[i] - hy[i - 1];
        const dHxDy = hx[i] - hx[i - nx];
        const decayX = this.electricLossDecay(loss[i], i);
        const decayY = this.electricLossDecay(lossY[i], i);
        const materialScaleX = s / eps[i];
        const materialScaleY = s / epsY[i];
        const sigmaDampX = this.conductivityDamp(conductivity[i], eps[i]);
        const sigmaDampY = this.conductivityDamp(conductivityY[i], epsY[i]);
        const sigmaCaX = (1 - sigmaDampX) / (1 + sigmaDampX);
        const sigmaCaY = (1 - sigmaDampY) / (1 + sigmaDampY);
        const sigmaCbX = 1 / (1 + sigmaDampX);
        const sigmaCbY = 1 / (1 + sigmaDampY);
        ezx[i] = (sigmaCaX * eCaX[x] * ezx[i] + sigmaCbX * eCbX[x] * materialScaleX * dHyDx) * decayX;
        ezy[i] = (sigmaCaY * eCaY[y] * ezy[i] - sigmaCbY * eCbY[y] * materialScaleY * dHxDy) * decayY;
        ez[i] = ezx[i] + ezy[i];
      }
    }
  }

  stepHzMode() {
    const nx = this.nx;
    const ny = this.ny;
    const s = this.courant;
    const hz = this.ez;
    const hzx = this.ezx;
    const hzy = this.ezy;
    const ex = this.hx;
    const ey = this.hy;
    const eps = this.eps;
    const loss = this.loss;
    const epsY = this.epsY;
    const lossY = this.lossY;
    const conductivity = this.conductivity;
    const conductivityY = this.conductivityY;
    const gyrotropicMaterial = this.gyrotropicMaterial;
    const gyrotropyG = this.gyrotropyG;
    const mu = this.mu;
    const muLoss = this.muLoss;
    const muY = this.muY;
    const muLossY = this.muLossY;
    const eCaX = this.eCaX;
    const eCbX = this.eCbX;
    const eCaY = this.eCaY;
    const eCbY = this.eCbY;
    const hCaX = this.hCaX;
    const hCbX = this.hCbX;
    const hCaY = this.hCaY;
    const hCbY = this.hCbY;

    for (let y = 0; y < ny - 1; y += 1) {
      const row = y * nx;
      const ca = eCaY[y];
      const cb = eCbY[y];
      for (let x = 0; x < nx; x += 1) {
        const i = row + x;
        if (this.material[i] === 2) {
          ex[i] = 0;
          continue;
        }
        if (gyrotropicMaterial[i]) continue;
        const electricDecay = this.electricLossDecay(loss[i], i);
        const electricScale = s / eps[i];
        const sigmaDamp = this.conductivityDamp(conductivity[i], eps[i]);
        const sigmaCa = (1 - sigmaDamp) / (1 + sigmaDamp);
        const sigmaCb = 1 / (1 + sigmaDamp);
        ex[i] = (sigmaCa * ca * ex[i] + sigmaCb * cb * electricScale * (hz[i + nx] - hz[i])) * electricDecay;
      }
    }

    for (let y = 0; y < ny; y += 1) {
      const row = y * nx;
      for (let x = 0; x < nx - 1; x += 1) {
        const i = row + x;
        if (this.material[i] === 2) {
          ey[i] = 0;
          continue;
        }
        if (gyrotropicMaterial[i]) continue;
        const electricDecay = this.electricLossDecay(lossY[i], i);
        const electricScale = s / epsY[i];
        const sigmaDamp = this.conductivityDamp(conductivityY[i], epsY[i]);
        const sigmaCa = (1 - sigmaDamp) / (1 + sigmaDamp);
        const sigmaCb = 1 / (1 + sigmaDamp);
        ey[i] = (sigmaCa * eCaX[x] * ey[i] - sigmaCb * eCbX[x] * electricScale * (hz[i + 1] - hz[i])) * electricDecay;
      }
    }

    for (let y = 0; y < ny - 1; y += 1) {
      const row = y * nx;
      const caX = eCaY[y];
      const cbX = eCbY[y];
      for (let x = 0; x < nx - 1; x += 1) {
        const i = row + x;
        if (!gyrotropicMaterial[i]) continue;
        if (this.material[i] === 2) {
          ex[i] = 0;
          ey[i] = 0;
          continue;
        }
        const epsX = eps[i];
        const epsYi = epsY[i];
        const g = gyrotropyG[i];
        const det = epsX * epsYi + g * g;
        const safeDet = Math.abs(det) < 1e-6 ? (det < 0 ? -1e-6 : 1e-6) : det;
        const sigmaDampX = this.conductivityDamp(conductivity[i], epsX);
        const sigmaDampY = this.conductivityDamp(conductivityY[i], epsYi);
        const sigmaCaX = (1 - sigmaDampX) / (1 + sigmaDampX);
        const sigmaCaY = (1 - sigmaDampY) / (1 + sigmaDampY);
        const sigmaCbX = 1 / (1 + sigmaDampX);
        const sigmaCbY = 1 / (1 + sigmaDampY);
        const sourceX = sigmaCbX * cbX * s * (hz[i + nx] - hz[i]);
        const sourceY = -sigmaCbY * eCbX[x] * s * (hz[i + 1] - hz[i]);
        const coupledX = (epsYi * sourceX - g * sourceY) / safeDet;
        const coupledY = (g * sourceX + epsX * sourceY) / safeDet;
        const decayX = this.electricLossDecay(loss[i], i);
        const decayY = this.electricLossDecay(lossY[i], i);
        ex[i] = (sigmaCaX * caX * ex[i] + coupledX) * decayX;
        ey[i] = (sigmaCaY * eCaX[x] * ey[i] + coupledY) * decayY;
      }
    }

    this.applyDispersiveElectricResponse();

    for (let y = 1; y < ny - 1; y += 1) {
      const row = y * nx;
      for (let x = 1; x < nx - 1; x += 1) {
        const i = row + x;
        if (this.material[i] === 2) {
          this.zeroElectricCell(i);
          ex[i] = 0;
          ey[i] = 0;
          continue;
        }
        const dEyDx = ey[i] - ey[i - 1];
        const dExDy = ex[i] - ex[i - nx];
        const decayX = 1 / (1 + muLoss[i]);
        const decayY = 1 / (1 + muLossY[i]);
        const materialScaleX = s / mu[i];
        const materialScaleY = s / muY[i];
        hzx[i] = (hCaX[x] * hzx[i] - hCbX[x] * materialScaleX * dEyDx) * decayX;
        hzy[i] = (hCaY[y] * hzy[i] + hCbY[y] * materialScaleY * dExDy) * decayY;
        hz[i] = hzx[i] + hzy[i];
      }
    }
  }

  fieldValueAt(i, display = state.fieldDisplay) {
    if (state.viewMode === "poynting") {
      const s = this.poyntingAt(i);
      if (display === "transverseX") return s.x;
      if (display === "transverseY") return s.y;
      return Math.hypot(s.x, s.y);
    }
    if (display === "transverseX") return this.hx[i];
    if (display === "transverseY") return this.hy[i];
    if (display === "electricMag") {
      if (state.fieldComponent === "hz") {
        return Math.hypot(this.hx[i], this.hy[i]);
      }
      return Math.abs(this.ez[i]);
    }
    if (display === "magneticMag") {
      if (state.fieldComponent === "hz") {
        return Math.abs(this.ez[i]);
      }
      return Math.hypot(this.hx[i], this.hy[i]);
    }
    return this.ez[i];
  }

  poyntingAt(i) {
    if (state.fieldComponent === "hz") {
      return { x: this.hy[i] * this.ez[i], y: -this.hx[i] * this.ez[i] };
    }
    return { x: -this.ez[i] * this.hy[i], y: this.ez[i] * this.hx[i] };
  }

  fieldPhysicalScale() {
    return state.viewMode === "poynting" ? this.fieldScale * this.fieldScale : this.fieldScale;
  }

  fieldPhysicalLogScale() {
    return (state.viewMode === "poynting" ? 2 : 1) * this.fieldLog10Scale;
  }

  fieldDisplayIsMagnitude() {
    return fieldDisplayConfig().magnitude;
  }

  transverseVectorAt(i) {
    if (state.viewMode === "poynting") return this.poyntingAt(i);
    return { x: this.hx[i], y: this.hy[i] };
  }

  diagnosticMonitorPositions() {
    const min = this.activeInteriorMinX();
    const max = this.activeInteriorMaxX();
    const width = Math.max(1, max - min);
    return {
      left: clampInt(min + width * 0.28, min, max),
      right: clampInt(min + width * 0.74, min, max),
    };
  }

  diagnosticIncidentSource() {
    return state.sources.find((source) => incidentFieldSourceShapes.has(source.shape)) || state.sources[0] || defaultSourceConfig;
  }

  diagnosticDirection() {
    const source = this.diagnosticIncidentSource();
    const theta = ((Number(source.angleDeg) || 0) * Math.PI) / 180;
    return {
      theta,
      cos: Math.cos(theta),
      sin: Math.sin(theta),
      angleDeg: ((Number(source.angleDeg) || 0) % 360 + 360) % 360,
    };
  }

  lineDirectionalFluxAt(x, direction = this.diagnosticDirection()) {
    const y0 = this.activeInteriorMinY();
    const y1 = this.activeInteriorMaxY();
    let flux = 0;
    let samples = 0;
    for (let y = y0; y <= y1; y += 1) {
      const idx = this.id(x, y);
      if (this.material[idx] === 2) continue;
      const s = this.poyntingAt(idx);
      flux += s.x * direction.cos + s.y * direction.sin;
      samples += 1;
    }
    return samples > 0 ? (flux / samples) * this.fieldPhysicalScale() : 0;
  }

  directionalTangentialFieldsAt(idx, direction) {
    const cos = direction.cos;
    const sin = direction.sin;
    if (state.fieldComponent === "hz") {
      const eParallel = this.hy[idx] * cos - this.hx[idx] * sin;
      return { electric: eParallel, magnetic: this.ez[idx] };
    }
    const hParallel = this.hx[idx] * sin - this.hy[idx] * cos;
    return { electric: this.ez[idx], magnetic: hParallel };
  }

  lineWaveSeparationAt(x, direction = this.diagnosticDirection()) {
    const y0 = this.activeInteriorMinY();
    const y1 = this.activeInteriorMaxY();
    let forward = 0;
    let backward = 0;
    let impedance = 0;
    let samples = 0;
    for (let y = y0; y <= y1; y += 1) {
      const idx = this.id(x, y);
      if (this.material[idx] === 2) continue;
      const epsValue = Math.max(1e-6, Math.abs(state.fieldComponent === "hz" ? this.epsY[idx] : this.eps[idx]));
      const muValue = Math.max(1e-6, Math.abs(state.fieldComponent === "hz" ? this.mu[idx] : this.muY[idx]));
      const z = Math.sqrt(muValue / epsValue);
      if (!Number.isFinite(z) || z <= 0) continue;
      const tangential = this.directionalTangentialFieldsAt(idx, direction);
      forward += 0.5 * (tangential.electric + z * tangential.magnetic);
      backward += 0.5 * (tangential.electric - z * tangential.magnetic);
      impedance += z;
      samples += 1;
    }
    if (samples <= 0) return { forward: 0, backward: 0, impedance: 1 };
    return { forward: forward / samples, backward: backward / samples, impedance: impedance / samples };
  }

  diagnosticFrequency() {
    const sineSource = state.sources.find((source) => source.type === "sine") || this.diagnosticIncidentSource();
    return clamp(Number(sineSource?.frequency) || defaultSourceConfig.frequency, 0.006, 0.095);
  }

  accumulateDiagnosticPhasor(name, value, phase) {
    const target = this.diagnosticPhasors[name];
    if (!target || !Number.isFinite(value)) return;
    const alpha = this.diagnosticSamples < 12 ? 0.22 : 0.035;
    target.re = (1 - alpha) * target.re + alpha * value * Math.cos(phase);
    target.im = (1 - alpha) * target.im - alpha * value * Math.sin(phase);
  }

  diagnosticPowerFromPhasor(name, impedance) {
    const target = this.diagnosticPhasors[name];
    if (!target || this.diagnosticSamples <= 0) return 0;
    const amplitude = 2 * Math.hypot(target.re, target.im);
    const z = Math.max(1e-9, Math.abs(impedance));
    return (amplitude * amplitude * this.fieldPhysicalScale()) / (2 * z);
  }

  updateDiagnostics() {
    if (!state.diagnosticsEnabled) {
      this.resetDiagnostics();
      return;
    }
    this.updateAnalysisDiagnostics();
    const monitors = this.diagnosticMonitorPositions();
    const direction = this.diagnosticDirection();
    this.diagnosticAngleDeg = direction.angleDeg;
    this.diagnosticFluxLeft = this.lineDirectionalFluxAt(monitors.left, direction);
    this.diagnosticFluxRight = this.lineDirectionalFluxAt(monitors.right, direction);
    const left = this.lineWaveSeparationAt(monitors.left, direction);
    const right = this.lineWaveSeparationAt(monitors.right, direction);
    const phase = 2 * Math.PI * this.diagnosticFrequency() * this.time;
    this.accumulateDiagnosticPhasor("incident", left.forward, phase);
    this.accumulateDiagnosticPhasor("reflected", left.backward, phase);
    this.accumulateDiagnosticPhasor("transmitted", right.forward, phase);
    this.diagnosticSamples += 1;
    this.diagnosticImpedanceLeft = left.impedance;
    this.diagnosticImpedanceRight = right.impedance;
    this.diagnosticIncidentPower = this.diagnosticPowerFromPhasor("incident", this.diagnosticImpedanceLeft);
    this.diagnosticReflectedPower = this.diagnosticPowerFromPhasor("reflected", this.diagnosticImpedanceLeft);
    this.diagnosticTransmittedPower = this.diagnosticPowerFromPhasor("transmitted", this.diagnosticImpedanceRight);
    if (this.diagnosticIncidentPower > 1e-12) {
      this.diagnosticReflectance = clamp(this.diagnosticReflectedPower / this.diagnosticIncidentPower, 0, 9.999);
      this.diagnosticTransmittance = clamp(this.diagnosticTransmittedPower / this.diagnosticIncidentPower, 0, 9.999);
    } else {
      this.diagnosticTransmittance = 0;
      this.diagnosticReflectance = 0;
    }
  }

  measure() {
    this.renormalizeFields();
    if (this.lastDiverged) {
      this.lastMax = 0;
      this.lastMaxLog10 = -Infinity;
      this.lastEnergy = 0;
      this.lastEnergyLog10 = -Infinity;
      return;
    }

    let maxAbs = 0;
    let energy = 0;
    for (let i = 0; i < this.n; i += 1) {
      const value = this.fieldValueAt(i);
      const abs = Math.abs(value);
      if (abs > maxAbs) maxAbs = abs;
      energy += value * value;
    }
    const physicalLogScale = this.fieldPhysicalLogScale();
    this.lastMaxLog10 = maxAbs === 0 ? -Infinity : Math.log10(maxAbs) + physicalLogScale;
    this.lastEnergyLog10 = energy === 0 ? -Infinity : Math.log10(energy / this.n) + 2 * physicalLogScale;
    this.lastMax = this.lastMaxLog10 < 300 ? Math.pow(10, this.lastMaxLog10) : Infinity;
    this.lastEnergy = this.lastEnergyLog10 < 300 ? Math.pow(10, this.lastEnergyLog10) : Infinity;
  }

  fieldRenderScale() {
    this.renormalizeFields();
    let maxAbs = this.lastMax;
    if (state.autoScale || maxAbs === 0) {
      maxAbs = 0;
      for (let i = 0; i < this.n; i += 1) {
        const value = Math.abs(this.fieldValueAt(i));
        if (value > maxAbs) maxAbs = value;
      }
    } else {
      maxAbs = maxAbs / this.fieldPhysicalScale();
    }
    const scale = state.autoScale ? 0.94 / Math.max(0.02, maxAbs) : state.gain * this.fieldPhysicalScale();
    this.lastViewRangeLog10 = state.autoScale
      ? Math.log10(1 / Math.max(scale, 1e-300)) + this.fieldPhysicalLogScale()
      : Math.log10(1 / Math.max(state.gain, 1e-300));
    this.lastViewRange = this.lastViewRangeLog10 < 300 ? Math.pow(10, this.lastViewRangeLog10) : Infinity;
    return scale;
  }

  renderFieldImage(data) {
    const scale = this.fieldRenderScale();
    const isMagnitude = this.fieldDisplayIsMagnitude();

    for (let i = 0; i < this.n; i += 1) {
      const value = this.fieldValueAt(i);
      const rawMapped = Number.isFinite(value) ? value * scale : 0;
      const mapped = Number.isFinite(rawMapped)
        ? isMagnitude
          ? clamp(rawMapped, 0, 1)
          : clamp(rawMapped, -1, 1)
        : Math.sign(value || 0);
      let r;
      let g;
      let b;
      if (mapped >= 0) {
        r = Math.round(255 - 10 * mapped);
        g = Math.round(255 - 215 * mapped);
        b = Math.round(255 - 239 * mapped);
      } else {
        const v = -mapped;
        r = Math.round(255 - 240 * v);
        g = Math.round(255 - 189 * v);
        b = Math.round(255 - 7 * v);
      }

      if (this.material[i] === 1) {
        r = Math.round(r * 0.78 + 36);
        g = Math.round(g * 0.78 + 62);
        b = Math.round(b * 0.78 + 42);
      } else if (this.material[i] === 2) {
        r = 8;
        g = 11;
        b = 13;
      } else if (this.material[i] === 3) {
        r = Math.round(r * 0.72 + 92);
        g = Math.round(g * 0.72 + 48);
        b = Math.round(b * 0.72 + 12);
      } else if (this.material[i] === 4) {
        r = Math.round(r * 0.52 + 18);
        g = Math.round(g * 0.52 + 24);
        b = Math.round(b * 0.52 + 74);
      } else if (this.material[i] === 5) {
        r = Math.round(r * 0.84 + 26);
        g = Math.round(g * 0.84 + 42);
        b = Math.round(b * 0.84 + 52);
      }

      const p = i * 4;
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = 255;
    }
  }

  surfaceFieldColor(mapped, shade = 1) {
    const stops = [
      { t: 0, c: [17, 18, 74] },
      { t: 0.28, c: [96, 31, 145] },
      { t: 0.5, c: [226, 89, 56] },
      { t: 0.76, c: [255, 208, 24] },
      { t: 1, c: [255, 249, 204] },
    ];
    const t = clamp((mapped + 1) * 0.5, 0, 1);
    let left = stops[0];
    let right = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i += 1) {
      if (t >= stops[i].t && t <= stops[i + 1].t) {
        left = stops[i];
        right = stops[i + 1];
        break;
      }
    }
    const local = right.t === left.t ? 0 : (t - left.t) / (right.t - left.t);
    const r = Math.round((left.c[0] + (right.c[0] - left.c[0]) * local) * shade);
    const g = Math.round((left.c[1] + (right.c[1] - left.c[1]) * local) * shade);
    const b = Math.round((left.c[2] + (right.c[2] - left.c[2]) * local) * shade);
    return `rgb(${clamp(r, 0, 255)}, ${clamp(g, 0, 255)}, ${clamp(b, 0, 255)})`;
  }

  materialViewContext() {
    const showingMu = state.viewMode === "mu";
    const values = showingMu
      ? state.materialPart === "imag"
        ? this.muLoss
        : this.mu
      : state.materialPart === "imag"
        ? this.loss
        : this.eps;
    const center = state.materialPart === "imag" ? 0 : 1;
    const minimumRange = state.materialPart === "imag" ? 0.001 : 0.25;
    let minValue = Infinity;
    let maxValue = -Infinity;
    for (let i = 0; i < this.n; i += 1) {
      const value = values[i];
      if (!Number.isFinite(value)) continue;
      if (value < minValue) minValue = value;
      if (value > maxValue) maxValue = value;
    }
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      minValue = center;
      maxValue = center;
    }
    let min = Math.min(minValue, center);
    let max = Math.max(maxValue, center);
    if (max - min < minimumRange) {
      min = center - minimumRange;
      max = center + minimumRange;
    }
    this.lastMaterialViewCenter = center;
    this.lastMaterialViewMin = min;
    this.lastMaterialViewMax = max;
    return { values, center, min, max };
  }

  materialMappedValue(value, context) {
    let rawMapped = 0;
    if (Number.isFinite(value)) {
      rawMapped =
        value >= context.center
          ? context.max === context.center
            ? 0
            : (value - context.center) / (context.max - context.center)
          : context.min === context.center
            ? 0
            : (value - context.center) / (context.center - context.min);
    }
    return Number.isFinite(rawMapped) ? clamp(rawMapped, -1, 1) : Math.sign(value || 0);
  }

  materialSurfaceColor(mapped, shade = 1) {
    let r;
    let g;
    let b;
    if (mapped >= 0) {
      r = Math.round((255 - 10 * mapped) * shade);
      g = Math.round((255 - 215 * mapped) * shade);
      b = Math.round((255 - 239 * mapped) * shade);
    } else {
      const v = -mapped;
      r = Math.round((255 - 240 * v) * shade);
      g = Math.round((255 - 189 * v) * shade);
      b = Math.round((255 - 7 * v) * shade);
    }
    return `rgb(${clamp(r, 0, 255)}, ${clamp(g, 0, 255)}, ${clamp(b, 0, 255)})`;
  }

  surfaceRenderContext() {
    if (state.viewMode === "epsilon" || state.viewMode === "mu") {
      return { kind: "material", material: this.materialViewContext() };
    }
    return { kind: "field", scale: this.fieldRenderScale() };
  }

  surfaceSample(x, y, context) {
    const sx = Math.max(0, Math.min(this.nx - 1, Math.floor(x)));
    const sy = Math.max(0, Math.min(this.ny - 1, Math.floor(y)));
    const i = this.id(sx, sy);
    let mapped;
    if (context.kind === "material") {
      mapped = this.materialMappedValue(context.material.values[i], context.material);
    } else {
      const value = this.fieldValueAt(i);
      const rawMapped = Number.isFinite(value) ? value * context.scale : 0;
      mapped = Number.isFinite(rawMapped)
        ? this.fieldDisplayIsMagnitude()
          ? clamp(rawMapped, 0, 1)
          : clamp(rawMapped, -1, 1)
        : Math.sign(value || 0);
    }
    return { mapped, material: this.material[i] };
  }

  surfaceColor(mapped, shade, context) {
    return context.kind === "material" ? this.materialSurfaceColor(mapped, shade) : this.surfaceFieldColor(mapped, shade);
  }

  projectSurfacePoint(x, y, mapped, dims) {
    const u = (x - this.viewX) / this.visibleGridWidth() - 0.5;
    const v = (y - this.viewY) / this.visibleGridHeight() - 0.5;
    return {
      x: dims.cx + u * dims.planeW + v * dims.skewW,
      y: dims.cy + v * dims.planeH - mapped * dims.heightScale,
    };
  }

  renderSurfaceField() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const surfaceContext = this.surfaceRenderContext();
    const background = ctx.createLinearGradient(0, 0, 0, h);
    background.addColorStop(0, "rgb(3, 5, 9)");
    background.addColorStop(0.58, "rgb(7, 8, 13)");
    background.addColorStop(1, "rgb(0, 0, 0)");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);

    const viewW = this.visibleGridWidth();
    const viewH = this.visibleGridHeight();
    const targetCols = clampInt(w / (13 * dpr), 42, 96);
    const targetRows = clampInt(h / (12 * dpr), 32, 72);
    const stepX = Math.max(1, Math.ceil(viewW / targetCols));
    const stepY = Math.max(1, Math.ceil(viewH / targetRows));
    const x0 = this.viewX;
    const y0 = this.viewY;
    const x1 = this.viewX + viewW;
    const y1 = this.viewY + viewH;
    const xs = [];
    const ys = [];

    for (let x = x0; x < x1; x += stepX) xs.push(Math.min(x, this.nx));
    if (xs.length === 0 || xs[xs.length - 1] < x1) xs.push(Math.min(x1, this.nx));
    for (let y = y0; y < y1; y += stepY) ys.push(Math.min(y, this.ny));
    if (ys.length === 0 || ys[ys.length - 1] < y1) ys.push(Math.min(y1, this.ny));

    const dims = {
      cx: w * 0.48,
      cy: h * 0.63,
      planeW: w * 0.78,
      planeH: h * 0.5,
      skewW: w * 0.18,
      heightScale: clamp(Math.min(w, h) * 0.2, 28 * dpr, 116 * dpr),
    };

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(0.65 * dpr, 0.8);
    for (let row = 0; row < ys.length - 1; row += 1) {
      const rowLight = 0.86 + (row / Math.max(1, ys.length - 2)) * 0.12;
      for (let col = 0; col < xs.length - 1; col += 1) {
        const p00 = this.surfaceSample(xs[col], ys[row], surfaceContext);
        const p10 = this.surfaceSample(xs[col + 1], ys[row], surfaceContext);
        const p11 = this.surfaceSample(xs[col + 1], ys[row + 1], surfaceContext);
        const p01 = this.surfaceSample(xs[col], ys[row + 1], surfaceContext);
        const avg = (p00.mapped + p10.mapped + p11.mapped + p01.mapped) * 0.25;
        const slope =
          Math.abs((p10.mapped + p11.mapped - p00.mapped - p01.mapped) * 0.5) +
          Math.abs((p01.mapped + p11.mapped - p00.mapped - p10.mapped) * 0.5);
        const shade = clamp(rowLight - slope * 0.12 + Math.max(0, avg) * 0.08, 0.62, 1.08);
        const allPec = p00.material === 2 && p10.material === 2 && p11.material === 2 && p01.material === 2;
        const q00 = this.projectSurfacePoint(xs[col], ys[row], p00.mapped, dims);
        const q10 = this.projectSurfacePoint(xs[col + 1], ys[row], p10.mapped, dims);
        const q11 = this.projectSurfacePoint(xs[col + 1], ys[row + 1], p11.mapped, dims);
        const q01 = this.projectSurfacePoint(xs[col], ys[row + 1], p01.mapped, dims);

        ctx.beginPath();
        ctx.moveTo(q00.x, q00.y);
        ctx.lineTo(q10.x, q10.y);
        ctx.lineTo(q11.x, q11.y);
        ctx.lineTo(q01.x, q01.y);
        ctx.closePath();
        ctx.fillStyle = allPec ? "rgb(7, 8, 11)" : this.surfaceColor(avg, shade, surfaceContext);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 244, 170, ${0.035 + Math.abs(avg) * 0.04})`;
        ctx.stroke();
      }
    }

    const corners = [
      this.projectSurfacePoint(x0, y0, 0, dims),
      this.projectSurfacePoint(x1, y0, 0, dims),
      this.projectSurfacePoint(x1, y1, 0, dims),
      this.projectSurfacePoint(x0, y1, 0, dims),
    ];
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = Math.max(1 * dpr, 1);
    ctx.stroke();
    ctx.restore();
  }

  renderMaterialImage(data) {
    const materialContext = this.materialViewContext();

    for (let i = 0; i < this.n; i += 1) {
      const mapped = this.materialMappedValue(materialContext.values[i], materialContext);
      let r;
      let g;
      let b;
      if (mapped >= 0) {
        r = Math.round(255 - 10 * mapped);
        g = Math.round(255 - 215 * mapped);
        b = Math.round(255 - 239 * mapped);
      } else {
        const v = -mapped;
        r = Math.round(255 - 240 * v);
        g = Math.round(255 - 189 * v);
        b = Math.round(255 - 7 * v);
      }

      if (this.material[i] === 2) {
        r = 8;
        g = 11;
        b = 13;
      }

      const p = i * 4;
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = 255;
    }
  }

  render() {
    this.fitCanvas();
    this.clampView();
    if (state.viewProjection === "3d") {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.renderSurfaceField();
      updateColorbar();
      updateMaterialWarning();
      return;
    }

    const data = this.image.data;
    if (state.viewMode === "epsilon" || state.viewMode === "mu") {
      this.renderMaterialImage(data);
    } else {
      this.renderFieldImage(data);
    }

    this.offscreenCtx.putImageData(this.image, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      this.offscreen,
      this.viewX,
      this.viewY,
      this.visibleGridWidth(),
      this.visibleGridHeight(),
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    this.drawPmlOverlay();
    this.drawDiagnosticsOverlay();
    this.drawMaterialSelectionOverlay();
    this.drawFieldQuiverOverlay();
    this.drawReferenceOverlay();
    this.drawSourceMarkers();
    updateColorbar();
    updateMaterialWarning();
  }

  drawMaterialSelectionOverlay() {
    if (!selectedMaterialRegion || selectedMaterialRegion.cells.length === 0) return;
    const rect = this.gridRectToCanvas(
      selectedMaterialRegion.bounds.minX,
      selectedMaterialRegion.bounds.minY,
      selectedMaterialRegion.bounds.maxX + 1,
      selectedMaterialRegion.bounds.maxY + 1
    );
    if (!rect) return;
    const ctx = this.ctx;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    ctx.save();
    ctx.fillStyle = "rgba(8, 124, 137, 0.12)";
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
    ctx.strokeStyle = "rgba(0, 52, 58, 0.9)";
    ctx.lineWidth = Math.max(1.5 * dpr, 1);
    ctx.setLineDash([7 * dpr, 4 * dpr]);
    ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(0, 52, 58, 0.86)";
    ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    const label = `${selectedMaterialRegion.cells.length} cells`;
    ctx.fillText(label, rect.left + 6 * dpr, Math.max(14 * dpr, rect.top - 5 * dpr));
    ctx.restore();
  }

  drawPmlOverlay() {
    normalizeBoundarySides();

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const spacing = Math.max(8 * dpr, Math.min(w, h) / 40);
    const drawPmlRegion = (side, x0, y0, x1, y1) => {
      const rect = this.gridRectToCanvas(x0, y0, x1, y1);
      if (!rect) return;
      ctx.save();
      ctx.fillStyle = "rgba(0, 92, 102, 0.08)";
      ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
      ctx.beginPath();
      ctx.rect(rect.left, rect.top, rect.width, rect.height);
      ctx.clip();
      ctx.strokeStyle = "rgba(0, 92, 102, 0.36)";
      ctx.lineWidth = Math.max(1, dpr);
      ctx.beginPath();
      const startX = Math.floor(rect.left / spacing) * spacing;
      const endX = rect.left + rect.width;
      const startY = Math.floor(rect.top / spacing) * spacing;
      const endY = rect.top + rect.height;
      for (let x = startX; x <= endX; x += spacing) {
        ctx.moveTo(x, rect.top);
        ctx.lineTo(x, rect.top + rect.height);
      }
      for (let y = startY; y <= endY; y += spacing) {
        ctx.moveTo(rect.left, y);
        ctx.lineTo(rect.left + rect.width, y);
      }
      ctx.stroke();
      if (rect.width > 36 * dpr && rect.height > 18 * dpr) {
        ctx.fillStyle = "rgba(0, 58, 64, 0.82)";
        ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("PML", rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
      ctx.restore();
    };

    const drawReflectiveEdge = (side) => {
      if (boundarySideIsAbsorbing(side)) return;
      const layer = Math.max(1, this.boundaryControlLayer());
      const metalCells = clampInt(Math.round(state.cellsPerWavelength * 0.14), 3, Math.max(3, Math.min(10, Math.floor(layer * 0.45))));
      const rect =
        side === "top"
          ? this.gridRectToCanvas(0, layer - metalCells, this.nx, layer)
          : side === "bottom"
            ? this.gridRectToCanvas(0, this.ny - layer, this.nx, this.ny - layer + metalCells)
            : side === "left"
              ? this.gridRectToCanvas(layer - metalCells, 0, layer, this.ny)
              : this.gridRectToCanvas(this.nx - layer, 0, this.nx - layer + metalCells, this.ny);
      if (!rect) return;
      const horizontal = side === "top" || side === "bottom";
      const metalGradient = horizontal
        ? ctx.createLinearGradient(rect.left, rect.top, rect.left, rect.top + rect.height)
        : ctx.createLinearGradient(rect.left, rect.top, rect.left + rect.width, rect.top);
      metalGradient.addColorStop(0, "rgba(255, 255, 255, 0.58)");
      metalGradient.addColorStop(0.18, "rgba(154, 164, 170, 0.7)");
      metalGradient.addColorStop(0.52, "rgba(42, 51, 58, 0.86)");
      metalGradient.addColorStop(1, "rgba(6, 10, 14, 0.92)");
      ctx.save();
      ctx.fillStyle = metalGradient;
      ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
      ctx.beginPath();
      ctx.rect(rect.left, rect.top, rect.width, rect.height);
      ctx.clip();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = Math.max(1, dpr);
      ctx.beginPath();
      const hatchSpacing = Math.max(7 * dpr, metalCells * dpr * 0.65);
      const hatchExtent = rect.width + rect.height;
      for (let p = -hatchExtent; p <= hatchExtent * 2; p += hatchSpacing) {
        ctx.moveTo(rect.left + p, rect.top + rect.height);
        ctx.lineTo(rect.left + p + rect.height, rect.top);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(3, 7, 10, 0.68)";
      ctx.lineWidth = Math.max(1.2 * dpr, 1);
      ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
      ctx.restore();
    };

    if (this.pmlLayer > 0) {
      const topInset = boundarySideIsAbsorbing("top") ? this.pmlLayer : 0;
      const bottomInset = boundarySideIsAbsorbing("bottom") ? this.pmlLayer : 0;
      if (boundarySideIsAbsorbing("top")) drawPmlRegion("top", 0, 0, this.nx, this.pmlLayer);
      if (boundarySideIsAbsorbing("bottom")) drawPmlRegion("bottom", 0, this.ny - this.pmlLayer, this.nx, this.ny);
      if (boundarySideIsAbsorbing("left")) drawPmlRegion("left", 0, topInset, this.pmlLayer, this.ny - bottomInset);
      if (boundarySideIsAbsorbing("right")) drawPmlRegion("right", this.nx - this.pmlLayer, topInset, this.nx, this.ny - bottomInset);
    }

    BOUNDARY_SIDES.forEach((side) => drawReflectiveEdge(side));

    const drawBoundaryInterfaceLine = (side) => {
      const layer = this.boundaryControlLayer();
      if (layer <= 0) return;
      const absorbing = boundarySideIsAbsorbing(side);
      ctx.save();
      ctx.strokeStyle = absorbing ? "rgba(0, 92, 102, 0.75)" : "rgba(3, 7, 10, 0.88)";
      ctx.lineWidth = Math.max(absorbing ? 1 : 1.35, dpr);
      ctx.setLineDash(absorbing ? [6 * dpr, 4 * dpr] : []);
      ctx.beginPath();
      if (side === "left") {
        const x = this.gridToCanvasX(layer);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      } else if (side === "right") {
        const x = this.gridToCanvasX(this.nx - layer);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      } else if (side === "top") {
        const y = this.gridToCanvasY(layer);
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      } else if (side === "bottom") {
        const y = this.gridToCanvasY(this.ny - layer);
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
      ctx.restore();
    };
    BOUNDARY_SIDES.forEach((side) => drawBoundaryInterfaceLine(side));
  }

  drawFieldQuiverOverlay() {
    if (!state.fieldQuiver || (state.viewMode !== "field" && state.viewMode !== "poynting") || state.viewProjection !== "2d") return;

    const ctx = this.ctx;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const viewW = this.visibleGridWidth();
    const viewH = this.visibleGridHeight();
    const cols = clampInt(this.canvas.width / (58 * dpr), 8, 26);
    const rows = clampInt(this.canvas.height / (58 * dpr), 6, 22);
    const samples = [];
    let maxMag = 0;

    for (let row = 0; row < rows; row += 1) {
      const gy = this.viewY + ((row + 0.5) / rows) * viewH;
      const y = clampInt(Math.round(gy), 1, this.ny - 2);
      for (let col = 0; col < cols; col += 1) {
        const gx = this.viewX + ((col + 0.5) / cols) * viewW;
        const x = clampInt(Math.round(gx), 1, this.nx - 2);
        const idx = this.id(x, y);
        if (this.material[idx] === 2) continue;
        const vector = this.transverseVectorAt(idx);
        const mag = Math.hypot(vector.x, vector.y);
        if (!Number.isFinite(mag) || mag <= 0) continue;
        maxMag = Math.max(maxMag, mag);
        samples.push({ x, y, vx: vector.x, vy: vector.y, mag });
      }
    }

    if (maxMag <= 1e-12) return;

    const maxLength = clamp(Math.min(this.canvas.width / cols, this.canvas.height / rows) * 0.42, 8 * dpr, 22 * dpr);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const sample of samples) {
      const normalized = clamp(sample.mag / maxMag, 0, 1);
      if (normalized < 0.04) continue;
      const cx = this.gridToCanvasX(sample.x + 0.5);
      const cy = this.gridToCanvasY(sample.y + 0.5);
      const ux = sample.vx / sample.mag;
      const uy = -sample.vy / sample.mag;
      const length = maxLength * (0.28 + 0.72 * Math.sqrt(normalized));
      const x0 = cx - ux * length * 0.35;
      const y0 = cy - uy * length * 0.35;
      const x1 = cx + ux * length * 0.65;
      const y1 = cy + uy * length * 0.65;
      const head = Math.max(3.8 * dpr, length * 0.28);
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const alpha = 0.26 + 0.52 * normalized;

      ctx.lineWidth = Math.max(3.2 * dpr, 3);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.38 * alpha})`;
      this.strokeQuiverArrow(ctx, x0, y0, x1, y1, angle, head);
      ctx.lineWidth = Math.max(1.25 * dpr, 1);
      ctx.strokeStyle = `rgba(5, 13, 18, ${alpha})`;
      this.strokeQuiverArrow(ctx, x0, y0, x1, y1, angle, head);
    }
    ctx.restore();
  }

  strokeQuiverArrow(ctx, x0, y0, x1, y1, angle, head) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(angle - Math.PI / 7), y1 - head * Math.sin(angle - Math.PI / 7));
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(angle + Math.PI / 7), y1 - head * Math.sin(angle + Math.PI / 7));
    ctx.stroke();
  }

  drawDiagnosticsOverlay() {
    if (!state.diagnosticsEnabled || state.viewProjection !== "2d") return;
    const ctx = this.ctx;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const monitors = this.diagnosticMonitorPositions();
    const direction = this.diagnosticDirection();
    const drawLine = (xCell, label, color) => {
      const x = this.gridToCanvasX(xCell + 0.5);
      if (x < -2 * dpr || x > this.canvas.width + 2 * dpr) return;
      ctx.save();
      ctx.setLineDash([7 * dpr, 6 * dpr]);
      ctx.lineWidth = Math.max(1.4 * dpr, 1);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, 10 * dpr);
      ctx.lineTo(x, this.canvas.height - 10 * dpr);
      ctx.stroke();
      ctx.setLineDash([]);
      this.drawOverlayLabel(label, x + 12 * dpr, 24 * dpr, "left");
      ctx.restore();
    };
    drawLine(monitors.left, "L", "rgba(11, 98, 232, 0.74)");
    drawLine(monitors.right, "R", "rgba(16, 136, 82, 0.74)");
    const arrowLength = 34 * dpr;
    const x0 = 22 * dpr;
    const y0 = 22 * dpr;
    this.drawOverlayArrow(x0, y0, x0 + arrowLength * direction.cos, y0 - arrowLength * direction.sin);
    this.drawOverlayLabel("k", x0 + arrowLength * direction.cos + 13 * dpr, y0 - arrowLength * direction.sin, "center");
  }

  drawReferenceOverlay() {
    this.drawScaleBarOverlay();
    this.drawAxisGlyphOverlay();
  }

  drawScaleBarOverlay() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const visibleLambdaWidth = Math.max(cellsToLambda(this.visibleGridWidth()), 1e-6);
    const scaleLambda = niceScaleLength(visibleLambdaWidth);
    const colorbarReserve = 108 * dpr;
    const rightPad = state.viewMode === "field" || state.viewMode === "poynting" || state.viewProjection === "3d" ? colorbarReserve : 22 * dpr;
    const x1 = Math.max(96 * dpr, w - rightPad);
    const availableWidth = Math.max(48 * dpr, x1 - 22 * dpr);
    const scaleWidth = clamp((scaleLambda / visibleLambdaWidth) * w, 42 * dpr, availableWidth * 0.72);
    const x0 = Math.max(22 * dpr, x1 - scaleWidth);
    const y = h - 34 * dpr;
    const tick = 8 * dpr;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.moveTo(x0, y - tick);
    ctx.lineTo(x0, y + tick);
    ctx.moveTo(x1, y - tick);
    ctx.lineTo(x1, y + tick);
    this.strokeOverlayPath(5 * dpr, 2 * dpr);

    this.drawOverlayLabel(`${formatScaleBarValue(scaleLambda)} λ₀`, (x0 + x1) / 2, y - 17 * dpr, "center");
    ctx.restore();
  }

  drawAxisGlyphOverlay() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const size = clamp(Math.min(w, h) * 0.085, 36 * dpr, 56 * dpr);
    const originX = 34 * dpr;
    const originY = h - 74 * dpr;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    this.drawOverlayArrow(originX, originY, originX + size, originY);
    this.drawOverlayArrow(originX, originY, originX, originY - size);
    this.drawOverlayLabel("x", originX + size + 13 * dpr, originY, "center");
    this.drawOverlayLabel("y", originX, originY - size - 13 * dpr, "center");
    ctx.restore();
  }

  drawOverlayArrow(x0, y0, x1, y1) {
    const ctx = this.ctx;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const head = 9 * dpr;
    const wing = Math.PI / 6;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(angle - wing), y1 - head * Math.sin(angle - wing));
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(angle + wing), y1 - head * Math.sin(angle + wing));
    this.strokeOverlayPath(5 * dpr, 2 * dpr);
  }

  strokeOverlayPath(shadowWidth, lineWidth) {
    const ctx = this.ctx;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
    ctx.lineWidth = shadowWidth;
    ctx.stroke();
    ctx.strokeStyle = "rgba(5, 11, 15, 0.94)";
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  drawOverlayLabel(text, x, y, align) {
    const ctx = this.ctx;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
    const metrics = ctx.measureText(text);
    const padX = 5 * dpr;
    const padY = 3 * dpr;
    const width = metrics.width + 2 * padX;
    const height = 13 * dpr + 2 * padY;
    const left = align === "center" ? x - width / 2 : x - padX;
    const top = y - height / 2;

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.68)";
    ctx.fillRect(left, top, width, height);
    ctx.fillStyle = "rgba(5, 11, 15, 0.94)";
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  drawSourceMarkers() {
    for (const source of state.sources) {
      this.drawSourceMarker(source);
    }
  }

  drawSourceMarker(source) {
    const sx = this.sourceXCell(source);
    const sy = this.sourceYCell(source);
    const x = this.gridToCanvasX(sx + 0.5);
    const y = this.gridToCanvasY(sy + 0.5);
    const margin = 12 * Math.max(1, window.devicePixelRatio || 1);
    if (source.shape === "line" && (x < -margin || x > this.canvas.width + margin)) return;
    if (source.shape !== "line" && (x < -margin || x > this.canvas.width + margin || y < -margin || y > this.canvas.height + margin)) return;
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    this.ctx.lineWidth = Math.max(1, window.devicePixelRatio || 1);
    if (source.id === state.selectedSourceId) {
      this.drawSourceSelectionHalo(x, y, source);
    }
    if (source.shape === "line") {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 8);
      this.ctx.lineTo(x, this.canvas.height - 8);
      this.ctx.stroke();
    } else if (source.shape === "gaussianProfile") {
      const fwhm = state.preset === "customSlab" ? this.slabCoreThicknessCells() : Math.max(4, Math.round(this.ny * 0.09));
      const halfHeight = (fwhm * 0.5) * (this.canvas.height / this.visibleGridHeight());
      this.ctx.beginPath();
      this.ctx.moveTo(x, y - halfHeight);
      this.ctx.lineTo(x, y + halfHeight);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(x, y, 3 * Math.max(1, window.devicePixelRatio || 1), 0, Math.PI * 2);
      this.ctx.stroke();
    } else if (localizedSourceShapes.has(source.shape) || inPlaneElectricCurrentShapes.has(source.shape)) {
      this.drawAnalyticSourceGlyph(x, y, source);
    } else {
      this.drawPointSourceGlyph(x, y);
    }
    this.ctx.restore();
  }

  drawSourceSelectionHalo(x, y, source) {
    const ctx = this.ctx;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const radius =
      localizedSourceShapes.has(source.shape) || inPlaneElectricCurrentShapes.has(source.shape)
        ? this.sourceFwhmCanvasRadius(source) + 6 * dpr
        : 18 * dpr;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 112, 244, 0.85)";
    ctx.lineWidth = 2 * dpr;
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.stroke();
    ctx.restore();
  }

  drawPointSourceGlyph(x, y) {
    const ctx = this.ctx;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const radius = 7 * dpr;
    const arm = 13 * dpr;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.moveTo(x - arm, y);
    ctx.lineTo(x - radius - 2 * dpr, y);
    ctx.moveTo(x + radius + 2 * dpr, y);
    ctx.lineTo(x + arm, y);
    ctx.moveTo(x, y - arm);
    ctx.lineTo(x, y - radius - 2 * dpr);
    ctx.moveTo(x, y + radius + 2 * dpr);
    ctx.lineTo(x, y + arm);
    this.strokeOverlayPath(5 * dpr, 2 * dpr);

    ctx.beginPath();
    ctx.arc(x, y, 2.2 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(5, 11, 15, 0.94)";
    ctx.fill();
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
    ctx.stroke();
  }

  drawAnalyticSourceGlyph(x, y, source) {
    const ctx = this.ctx;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const radius = this.sourceFwhmCanvasRadius(source);
    const theta = (source.angleDeg * Math.PI) / 180;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.strokeOverlayPath(5 * dpr, 2 * dpr);

    ctx.beginPath();
    ctx.arc(x, y, 2.3 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(5, 11, 15, 0.94)";
    ctx.fill();

    if (source.shape === "gaussianSpot") return;

    const dx = Math.cos(theta) * radius;
    const dy = -Math.sin(theta) * radius;
    const wing = Math.PI / 6;
    const head = 8 * dpr;
    const angle = Math.atan2(dy, dx);
    const x0 = x - dx;
    const y0 = y - dy;
    const x1 = x + dx;
    const y1 = y + dy;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(angle - wing), y1 - head * Math.sin(angle - wing));
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(angle + wing), y1 - head * Math.sin(angle + wing));

    if (source.shape === "quadrupole" || source.shape === "multipole") {
      const crossDx = -dy * 0.45;
      const crossDy = dx * 0.45;
      ctx.moveTo(x - crossDx, y - crossDy);
      ctx.lineTo(x + crossDx, y + crossDy);
    }

    this.strokeOverlayPath(5 * dpr, 2 * dpr);

    if (circularDipoleSourceShapes.has(source.shape)) {
      const spinRadius = Math.max(8 * dpr, radius * 0.42);
      const spinSign = source.shape === "circularDipoleCw" ? 1 : -1;
      const start = theta + spinSign * 0.15;
      const end = theta + spinSign * 1.65 * Math.PI;
      const headAngle = end + spinSign * Math.PI * 0.5;
      const hx = x + spinRadius * Math.cos(end);
      const hy = y - spinRadius * Math.sin(end);
      ctx.beginPath();
      ctx.arc(x, y, spinRadius, -start, -end, spinSign < 0);
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - 6 * dpr * Math.cos(headAngle - 0.45), hy + 6 * dpr * Math.sin(headAngle - 0.45));
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - 6 * dpr * Math.cos(headAngle + 0.45), hy + 6 * dpr * Math.sin(headAngle + 0.45));
      this.strokeOverlayPath(4 * dpr, 1.6 * dpr);
      this.drawOverlayLabel(source.shape === "circularDipoleCw" ? "+90" : "-90", x + radius + 14 * dpr, y, "left");
      return;
    }

    if (source.shape === "janusDipole") {
      this.drawOverlayLabel("Janus", x + radius + 14 * dpr, y, "left");
      return;
    }

    if (source.shape === "huygens") {
      this.drawOverlayLabel("Huygens", x + radius + 14 * dpr, y, "left");
      return;
    }

    if (inPlaneElectricCurrentShapes.has(source.shape)) {
      this.drawOverlayLabel("J||", x + radius + 14 * dpr, y, "left");
      return;
    }

    if (source.shape === "pointDipole") {
      this.drawOverlayLabel("p", x + radius + 14 * dpr, y, "left");
      return;
    }

    if (source.shape === "multipole") {
      this.drawOverlayLabel(`n=${this.localizedSourceOrder("multipole", source)}`, x + radius + 14 * dpr, y, "left");
    }
  }

  sourceAtClientPoint(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cx = (clientX - rect.left) * dpr;
    const cy = (clientY - rect.top) * dpr;
    let best = null;
    let bestDistance = Infinity;
    for (const source of state.sources) {
      const sx = this.sourceXCell(source);
      const sy = this.sourceYCell(source);
      const x = this.gridToCanvasX(sx + 0.5);
      const y = this.gridToCanvasY(sy + 0.5);
      const distance =
        source.shape === "line" || source.shape === "gaussianProfile"
          ? Math.abs(cx - x)
          : Math.hypot(cx - x, cy - y);
      const radius = this.sourceHitRadius(source);
      if (distance <= radius && distance < bestDistance) {
        best = source;
        bestDistance = distance;
      }
    }
    return best;
  }

  sourceHitRadius(source) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    if (localizedSourceShapes.has(source.shape) || inPlaneElectricCurrentShapes.has(source.shape)) {
      return Math.max(18 * dpr, this.sourceFwhmCanvasRadius(source) + 8 * dpr);
    }
    if (source.shape === "line") return 18 * dpr;
    if (source.shape === "gaussianProfile") return 22 * dpr;
    return 18 * dpr;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clampInt(value, min, max) {
  return Math.round(clamp(Number(value) || 0, min, max));
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
  source.widthLambda = clamp(Number(source.widthLambda) || defaultSourceConfig.widthLambda, 0.05, 1.5);
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
  return localizedSourceShapes.has(shape) || inPlaneElectricCurrentShapes.has(shape);
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
  if (render) sim.render();
}

function deleteSelectedElement() {
  const source = explicitlySelectedSource();
  if (source) {
    deleteSource(source.id);
    closeSourceMenu();
    clearMaterialSelection(false);
    updateControlText();
    sim.render();
    return true;
  }
  if (selectedMaterialRegion) {
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
  }
  if (sim.lastDiverged) {
    notes.push("Non-finite field detected; fields were reset.");
  } else if (sim.fieldLog10Scale !== 0) {
    notes.push(`Field scale ${formatScaleFromLog(sim.fieldLog10Scale)}x.`);
  }
  el.materialWarning.textContent = notes.join(" ");
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
  el.sourceWidthInput.value = formatLambda(normalized.widthLambda);
  el.sourceWidthOutput.value = formatLambda(normalized.widthLambda);
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
    clearMaterialSelection(false);
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
}

function updateThemeControls() {
  el.themeButtons?.forEach((button) => {
    const active = button.dataset.themeChoice === state.theme;
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
  el.playPauseIcon.textContent = state.running ? "⏸" : "▶";
  updateCanvasModeControls();
  updateBrushControls();
  updateBoundaryMenuControls();
  if (editorSource) {
    populateSourceEditor(editorSource);
  }
  el.gridLabel.textContent = `${sim.nx} x ${sim.ny} · ${formatLambda(cellsToLambda(sim.nx))} λ₀ x ${formatLambda(cellsToLambda(sim.ny))} λ₀ · ${sim.viewZoom.toFixed(2)}x`;
  if (el.materialLabel) {
    el.materialLabel.textContent = `Material: ${currentBrushLabel()}`;
  }
  if (el.modePill) {
    const boundary = boundarySummaryLabel();
    const sourceLabel =
      state.sources.length === 1
        ? `${sourceShapeLabel(state.sources[0].shape)} · ${sourceCouplingLabel(state.sources[0].shape)}`
        : `${state.sources.length} sources`;
    el.modePill.textContent = `Sources: ${sourceLabel} - ${boundary} boundary`;
  }
  updateMaterialWarning();
  updateAllRangeProgress();
  updateSweepControls();
  updateAnalysisControls();
}

function updateStats() {
  if (el.stepCounter) el.stepCounter.textContent = String(sim.time);
  if (el.maxField) el.maxField.textContent = formatFieldMetric(sim.lastMax, sim.lastMaxLog10);
  if (el.energyValue) el.energyValue.textContent = formatFieldMetric(sim.lastEnergy, sim.lastEnergyLog10);
  if (el.fluxLeftOutput) el.fluxLeftOutput.textContent = formatFieldValue(sim.diagnosticIncidentPower || 0);
  if (el.diagnosticAngleOutput) {
    const diagnosticAngle = sim.diagnosticSamples > 0 ? sim.diagnosticAngleDeg : sim.diagnosticDirection().angleDeg;
    el.diagnosticAngleOutput.textContent = `${formatMonitorAngle(diagnosticAngle)}°`;
  }
  if (el.reflectedPowerOutput) el.reflectedPowerOutput.textContent = formatFieldValue(sim.diagnosticReflectedPower || 0);
  if (el.fluxRightOutput) el.fluxRightOutput.textContent = formatFieldValue(sim.diagnosticTransmittedPower || 0);
  if (el.reflectanceOutput) el.reflectanceOutput.textContent = formatDiagnosticRatio(sim.diagnosticReflectance || 0);
  if (el.transmittanceOutput) el.transmittanceOutput.textContent = formatDiagnosticRatio(sim.diagnosticTransmittance || 0);
  if (el.engineValue) el.engineValue.textContent = sim.engineLabel();
  updateMaterialWarning();
  updateAnalysisControls();
}

function formatDiagnosticRatio(value) {
  if (!Number.isFinite(value)) return "0";
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

function sweepSourceTarget() {
  return state.sources.find((source) => incidentFieldSourceShapes.has(source.shape)) || selectedSource() || state.sources[0] || null;
}

function sweepModeLabel(mode = state.sweepMode) {
  return mode === "frequency" ? "f" : "θ";
}

function sweepUnitLabel(mode = state.sweepMode) {
  return mode === "frequency" ? "" : "°";
}

function clampSweepRangeForMode(mode, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return mode === "frequency" ? defaultSourceConfig.frequency : 0;
  return mode === "frequency" ? clamp(numeric, 0.006, 0.095) : clamp(numeric, -80, 80);
}

function formatSweepValue(value) {
  return state.sweepMode === "frequency" ? Number(value).toFixed(3) : String(Math.round(Number(value)));
}

function syncSweepStateFromInputs() {
  state.sweepMode = el.sweepModeInput?.value === "frequency" ? "frequency" : "angle";
  state.sweepStart = clampSweepRangeForMode(state.sweepMode, el.sweepStartInput?.value);
  state.sweepEnd = clampSweepRangeForMode(state.sweepMode, el.sweepEndInput?.value);
  state.sweepSamples = clampInt(Number(el.sweepSamplesInput?.value) || 9, 3, 41);
  state.sweepSteps = clampInt(Number(el.sweepStepsInput?.value) || 720, 120, 4000);
}

function updateSweepControls() {
  if (!el.sweepModeInput) return;
  const frequencyMode = state.sweepMode === "frequency";
  el.sweepModeInput.value = state.sweepMode;
  if (el.sweepStartInput) {
    el.sweepStartInput.min = frequencyMode ? "0.006" : "-80";
    el.sweepStartInput.max = frequencyMode ? "0.095" : "80";
    el.sweepStartInput.step = frequencyMode ? "0.001" : "1";
    el.sweepStartInput.value = frequencyMode ? state.sweepStart.toFixed(3) : String(Math.round(state.sweepStart));
  }
  if (el.sweepEndInput) {
    el.sweepEndInput.min = frequencyMode ? "0.006" : "-80";
    el.sweepEndInput.max = frequencyMode ? "0.095" : "80";
    el.sweepEndInput.step = frequencyMode ? "0.001" : "1";
    el.sweepEndInput.value = frequencyMode ? state.sweepEnd.toFixed(3) : String(Math.round(state.sweepEnd));
  }
  if (el.sweepSamplesInput) el.sweepSamplesInput.value = String(state.sweepSamples);
  if (el.sweepStepsInput) el.sweepStepsInput.value = String(state.sweepSteps);
  if (el.sweepRunBtn) el.sweepRunBtn.textContent = state.sweepRunning ? "Cancel sweep" : "Run sweep";
  drawSweepChart();
}

function setSweepStatus(text) {
  if (el.sweepStatus) el.sweepStatus.textContent = text;
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
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
  const xValues = results.map((point) => point.x);
  const xMin = results.length ? Math.min(...xValues) : state.sweepStart;
  const xMax = results.length ? Math.max(...xValues) : state.sweepEnd;
  const yMaxRaw = Math.max(1, ...results.flatMap((point) => [point.r || 0, point.t || 0]));
  const yMax = yMaxRaw > 1.2 ? Math.ceil(yMaxRaw * 10) / 10 : 1;
  const toX = (value) => padL + ((value - xMin) / Math.max(1e-9, xMax - xMin)) * plotW;
  const toY = (value) => padT + plotH - (clamp(value, 0, yMax) / yMax) * plotH;

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

  const drawSeries = (key, color) => {
    if (results.length === 0) return;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2 * dpr, 1.5);
    ctx.beginPath();
    results.forEach((point, index) => {
      const x = toX(point.x);
      const y = toY(point[key]);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    results.forEach((point) => {
      ctx.beginPath();
      ctx.arc(toX(point.x), toY(point[key]), 2.6 * dpr, 0, Math.PI * 2);
      ctx.fill();
    });
  };
  drawSeries("r", rColor);
  drawSeries("t", tColor);

  ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = text;
  ctx.textAlign = "left";
  ctx.fillText("R", padL + 8 * dpr, padT + 12 * dpr);
  ctx.fillStyle = rColor;
  ctx.fillRect(padL + 24 * dpr, padT + 8 * dpr, 14 * dpr, 3 * dpr);
  ctx.fillStyle = text;
  ctx.fillText("T", padL + 48 * dpr, padT + 12 * dpr);
  ctx.fillStyle = tColor;
  ctx.fillRect(padL + 64 * dpr, padT + 8 * dpr, 14 * dpr, 3 * dpr);
  ctx.fillStyle = text;
  ctx.textAlign = "right";
  ctx.fillText(yMax.toFixed(yMax > 1 ? 1 : 0), padL - 7 * dpr, padT + 2 * dpr);
  ctx.fillText("0", padL - 7 * dpr, padT + plotH);
  ctx.textAlign = "center";
  ctx.fillText(`${sweepModeLabel()} ${sweepUnitLabel()}`.trim(), padL + plotW / 2, height - 12 * dpr);
  if (results.length === 0) {
    ctx.fillStyle = dark ? "rgba(224, 232, 238, 0.56)" : "rgba(51, 65, 74, 0.56)";
    ctx.fillText("Run a sweep to plot R and T", padL + plotW / 2, padT + plotH / 2);
  }
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
    ctx.fillText("Collecting contour phasors", cx, cy);
  }

  ctx.fillStyle = colors.text;
  ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("Near-to-far estimate", 12 * dpr, 11 * dpr);
  ctx.textAlign = "center";
  ctx.fillText("0°", cx + radius + 10 * dpr, cy);
  ctx.fillText("90°", cx, cy + radius + 12 * dpr);
}

function updateAnalysisControls() {
  if (el.analysisInput) el.analysisInput.checked = state.analysisEnabled;
  if (el.analysisStatus) {
    const sampleText = `${sim.analysisSamples || 0} samples`;
    const contourText = `${sim.analysisContour?.length || 0} contour pts`;
    el.analysisStatus.textContent = state.analysisEnabled
      ? `${sampleText} · ${contourText} · f=${formatFieldValue(sim.diagnosticFrequency())}`
      : "Analysis paused.";
  }
  drawSpectrumChart();
  drawFarFieldChart();
}

async function runSweep() {
  if (state.sweepRunning) {
    state.sweepCancelRequested = true;
    setSweepStatus("Cancelling sweep...");
    return;
  }

  syncSweepStateFromInputs();
  const target = sweepSourceTarget();
  if (!target) {
    setSweepStatus("Add a source before running a sweep.");
    return;
  }

  const sourceSnapshots = state.sources.map((source) => ({ ...source }));
  const selectedSourceId = state.selectedSourceId;
  const sourceDefaults = { ...state.sourceDefaults };
  const diagnosticsEnabled = state.diagnosticsEnabled;
  const wasRunning = state.running;
  const valueCount = Math.max(1, state.sweepSamples);
  const values = Array.from({ length: valueCount }, (_unused, index) => {
    const t = valueCount === 1 ? 0 : index / (valueCount - 1);
    return state.sweepStart + (state.sweepEnd - state.sweepStart) * t;
  });

  state.running = false;
  state.diagnosticsEnabled = true;
  state.sweepRunning = true;
  state.sweepCancelRequested = false;
  state.sweepResults = [];
  updateControlText();
  updateStats();
  sim.render();

  try {
    for (let pointIndex = 0; pointIndex < values.length; pointIndex += 1) {
      if (state.sweepCancelRequested) break;
      const value = values[pointIndex];
      const activeTarget = sweepSourceTarget();
      if (!activeTarget) break;

      if (state.sweepMode === "frequency") {
        const frequency = clampSweepRangeForMode("frequency", value);
        state.sources.forEach((source) => {
          source.type = "sine";
          source.frequency = frequency;
          normalizeSource(source);
        });
      } else {
        activeTarget.type = "sine";
        activeTarget.angleDeg = ((clampSweepRangeForMode("angle", value) % 360) + 360) % 360;
        normalizeSource(activeTarget);
      }
      state.sourceDefaults = { ...activeTarget };
      delete state.sourceDefaults.id;

      sim.resetFields();
      sim.resetDiagnostics();
      setSweepStatus(
        `Point ${pointIndex + 1}/${values.length}: ${sweepModeLabel()}=${formatSweepValue(value)}${sweepUnitLabel()}`,
      );
      updateControlText();

      let stepsDone = 0;
      while (stepsDone < state.sweepSteps) {
        if (state.sweepCancelRequested) break;
        const chunk = Math.min(36, state.sweepSteps - stepsDone);
        for (let step = 0; step < chunk; step += 1) {
          sim.step();
        }
        stepsDone += chunk;
        sim.measure();
        updateStats();
        if (stepsDone % 144 === 0 || stepsDone >= state.sweepSteps) {
          sim.render();
          await nextAnimationFrame();
        }
      }

      if (state.sweepCancelRequested) break;
      sim.measure();
      const result = {
        x: value,
        r: sim.diagnosticReflectance || 0,
        t: sim.diagnosticTransmittance || 0,
        pInc: sim.diagnosticIncidentPower || 0,
        pRef: sim.diagnosticReflectedPower || 0,
        pTrn: sim.diagnosticTransmittedPower || 0,
      };
      state.sweepResults.push(result);
      drawSweepChart();
      setSweepStatus(
        `Recorded ${pointIndex + 1}/${values.length}: R=${formatDiagnosticRatio(result.r)}, T=${formatDiagnosticRatio(result.t)}`,
      );
      await nextAnimationFrame();
    }
  } finally {
    const cancelled = state.sweepCancelRequested;
    const pointLabel = state.sweepResults.length === 1 ? "point" : "points";
    state.sources = sourceSnapshots.map((source) => ({ ...source }));
    state.selectedSourceId = selectedSourceId;
    state.sourceDefaults = { ...sourceDefaults };
    state.diagnosticsEnabled = diagnosticsEnabled;
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
    setSweepStatus(
      cancelled
        ? `Sweep cancelled. ${state.sweepResults.length} ${pointLabel} recorded.`
        : `Sweep complete. ${state.sweepResults.length} ${pointLabel} recorded.`,
    );
  }
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
    el.colorbarTitle.innerHTML = `${state.materialPart === "imag" ? "Im" : "Re"}(${symbol})`;
    if (centerStop >= 99.9) {
      el.colorbarMax.textContent = formatBound(max);
      el.colorbarMid.textContent = formatBound((max + center) * 0.5);
      el.colorbarMin.textContent = formatMaterialMapValue(center);
      el.colorbarGradient.style.background = "linear-gradient(to bottom, rgb(245, 40, 16) 0%, rgb(255, 255, 255) 100%)";
    } else if (centerStop <= 0.1) {
      el.colorbarMax.textContent = formatMaterialMapValue(center);
      el.colorbarMid.textContent = formatBound((min + center) * 0.5);
      el.colorbarMin.textContent = formatBound(min);
      el.colorbarGradient.style.background = "linear-gradient(to bottom, rgb(255, 255, 255) 0%, rgb(15, 66, 248) 100%)";
    } else {
      el.colorbarMax.textContent = formatBound(max);
      el.colorbarMid.textContent = formatMaterialMapValue(center);
      el.colorbarMin.textContent = formatBound(min);
      el.colorbarGradient.style.background = `linear-gradient(to bottom, rgb(245, 40, 16) 0%, rgb(255, 255, 255) ${centerStop.toFixed(1)}%, rgb(15, 66, 248) 100%)`;
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
  el.colorbarGradient.style.background =
    state.viewProjection === "3d"
      ? "linear-gradient(to bottom, rgb(255, 249, 204) 0%, rgb(255, 208, 24) 24%, rgb(226, 89, 56) 50%, rgb(96, 31, 145) 73%, rgb(17, 18, 74) 100%)"
      : displayConfig.magnitude
        ? "linear-gradient(to bottom, rgb(245, 40, 16) 0%, rgb(255, 255, 255) 100%)"
      : "";
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
  clearMaterialSelection(false);
  const point = canvasToGrid(event);
  sim.paint(point.x, point.y, Math.max(1, lambdaToCells(state.brushSizeLambda)), state.brush);
  sim.refreshPmlMaterialContinuation(false);
  sim.render();
}

function insertGeometryFromEvent(event) {
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

el.stepBtn.addEventListener("click", () => {
  sim.step();
  sim.measure();
  updateStats();
  sim.render();
});

el.resetBtn.addEventListener("click", () => {
  sim.resetFields();
  sim.measure();
  updateStats();
  sim.render();
});

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

el.themeButtons?.forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.themeChoice);
  });
});

el.sourceApplyBtn.addEventListener("click", () => {
  applySourceMenu();
});

el.sourceDeleteBtn.addEventListener("click", () => {
  const source = selectedSource();
  if (source) {
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

el.sweepModeInput?.addEventListener("change", () => {
  const nextMode = el.sweepModeInput.value === "frequency" ? "frequency" : "angle";
  state.sweepMode = nextMode;
  if (nextMode === "frequency") {
    state.sweepStart = 0.012;
    state.sweepEnd = 0.055;
  } else {
    state.sweepStart = 0;
    state.sweepEnd = 70;
  }
  state.sweepResults = [];
  setSweepStatus("Sweep uses the current scene and the active incident source.");
  updateControlText();
});

[el.sweepStartInput, el.sweepEndInput, el.sweepSamplesInput, el.sweepStepsInput].forEach((input) => {
  input?.addEventListener("change", () => {
    syncSweepStateFromInputs();
    state.sweepResults = [];
    setSweepStatus("Sweep uses the current scene and the active incident source.");
    updateControlText();
  });
});

el.sweepRunBtn?.addEventListener("click", () => {
  runSweep();
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
  state.customAnisotropic = Boolean(el.customAnisotropyInput.checked);
  state.materialModulationEnabled = Boolean(el.modulationEnabledInput.checked);
  state.materialNonlinearEnabled = Boolean(el.nonlinearEnabledInput.checked);
  state.materialHarmonicEnabled = Boolean(el.harmonicEnabledInput?.checked);
  state.materialPhaseChangeEnabled = Boolean(el.phaseChangeEnabledInput?.checked);
  state.materialGyrotropyEnabled = Boolean(el.gyrotropyEnabledInput?.checked);
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

el.presetInput.addEventListener("change", () => {
  clearMaterialSelection(false);
  state.preset = el.presetInput.value;
  sim.applyPreset(state.preset);
  sim.measure();
  updateControlText();
  updateStats();
  sim.render();
});

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
  clearMaterialSelection(false);
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
  clearMaterialSelection(false);
  const nx = clampInt(el.gridNxInput.value, 80, MAX_GRID.nx);
  const ny = clampInt(el.gridNyInput.value, 60, MAX_GRID.ny);
  state.gridNx = nx;
  state.gridNy = ny;
  sim.resize(nx, ny);
  clampAllSourcesToInterior();
  sim.applyPreset(state.preset);
  updateControlText();
  updateStats();
  sim.render();
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
  sim.render();
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
}

function updatePan(event) {
  if (panPointerId !== event.pointerId || !lastPanPoint) return false;
  const dx = event.clientX - lastPanPoint.x;
  const dy = event.clientY - lastPanPoint.y;
  lastPanPoint = { x: event.clientX, y: event.clientY };
  if (sim.panByClientDelta(dx, dy)) {
    updateViewInteraction();
  }
  return true;
}

function beginSourceDrag(event, source) {
  closeContextMenus();
  clearMaterialSelection(false);
  state.selectedSourceId = source.id;
  dragSourcePointerId = event.pointerId;
  dragSourceId = source.id;
  const point = sim.clientToGridFloat(event.clientX, event.clientY);
  dragSourceOffset = {
    x: sim.sourceXCell(source) - point.x,
    y: sim.sourceYCell(source) - point.y,
  };
  pointerDown = false;
  paintPointerId = null;
  panPointerId = null;
  lastPanPoint = null;
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
  sim.render();
  return true;
}

function endSourceDrag(event) {
  if (dragSourcePointerId !== event.pointerId) return;
  dragSourcePointerId = null;
  dragSourceId = null;
  dragSourceOffset = null;
}

function beginMaterialDrag(event, region) {
  closeContextMenus();
  selectMaterialRegion(region, false);
  dragMaterialPointerId = event.pointerId;
  const point = sim.clientToGridFloat(event.clientX, event.clientY);
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
  sim.render();
  return true;
}

function endMaterialDrag(event) {
  if (dragMaterialPointerId !== event.pointerId) return;
  dragMaterialPointerId = null;
  materialDragState = null;
  sim.measure();
  updateStats();
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
  storePointer(event);
  try {
    el.canvas.setPointerCapture(event.pointerId);
  } catch {
    // Some touch/browser combinations can reject pointer capture.
  }
  if (activePointers.size >= 2) {
    pointerDown = false;
    paintPointerId = null;
    dragSourcePointerId = null;
    dragSourceId = null;
    dragSourceOffset = null;
    dragMaterialPointerId = null;
    materialDragState = null;
    pinchState = null;
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
      const source = sim.sourceAtClientPoint(event.clientX, event.clientY);
      closeContextMenus();
      if (source && !event.shiftKey && !event.altKey) {
        beginSourceDrag(event, source);
      } else {
        const region = selectMaterialRegionAt(event.clientX, event.clientY, false);
        state.selectedSourceId = null;
        if (region && !event.shiftKey && !event.altKey) {
          beginMaterialDrag(event, region);
        } else {
          clearMaterialSelection(false);
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
    dragSourcePointerId = null;
    dragSourceId = null;
    dragSourceOffset = null;
    dragMaterialPointerId = null;
    materialDragState = null;
    updatePinchGesture();
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

  if (updatePan(event)) {
    event.preventDefault();
    return;
  }

  if (pointerDown && paintPointerId === event.pointerId) {
    paintFromEvent(event);
    event.preventDefault();
  }
});

function endPointer(event) {
  activePointers.delete(event.pointerId);
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
}

el.canvas.addEventListener("pointerup", endPointer);
el.canvas.addEventListener("pointercancel", endPointer);

document.addEventListener("pointerdown", (event) => {
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
  if (event.key === "Escape" && (!el.sourceMenu?.hidden || !el.brushMenu?.hidden || !el.boundaryMenu?.hidden)) {
    closeContextMenus();
    sim.render();
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
  updateCanvasAspectRatio(sim.nx, sim.ny);
  sim.fitCanvas();
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

sim.measure();
updateControlText();
updateStats();
sim.render();
initWasmBackend();
requestAnimationFrame(animate);
