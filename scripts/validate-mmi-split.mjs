#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const options = parseOptions(process.argv.slice(2));
const jsonMode = Boolean(options.json);
const warmupSteps = positiveInt(options.warmup, 900);
const sampleSteps = positiveInt(options.samples, 1200);
const sampleEvery = positiveInt(options.sampleEvery, 2);
const splitTolerance = positiveNumber(options.tolerance, 0.1);
const monitorXLambda = positiveNumber(options.monitorX, 7.2);
const guideHalfWidthLambda = positiveNumber(options.halfWidth, 0.11);

function parseOptions(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function positiveInt(value, fallback) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readText(...parts) {
  return fs.readFileSync(path.join(rootDir, ...parts), "utf8");
}

function headlessBootstrap() {
  return `
let sim = null;

function makeHeadlessContext() {
  const context = {
    imageSmoothingEnabled: false,
    createImageData(width, height) {
      return { width, height, data: new Uint8ClampedArray(Math.max(1, width * height * 4)) };
    },
    getImageData(_x, _y, width, height) {
      return { width, height, data: new Uint8ClampedArray(Math.max(1, width * height * 4)) };
    },
    putImageData() {},
    clearRect() {},
    drawImage() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    arc() {},
    ellipse() {},
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    setLineDash() {},
    fillText() {},
    strokeText() {},
    measureText(text) {
      return { width: String(text).length * 7 };
    },
    createLinearGradient() {
      return { addColorStop() {} };
    },
  };
  return context;
}

function makeHeadlessCanvas(width = 1, height = 1) {
  return {
    width,
    height,
    style: {},
    getContext() {
      return makeHeadlessContext();
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: this.width || 1, height: this.height || 1 };
    },
  };
}

const document = {
  createElement(tagName) {
    return tagName === "canvas" ? makeHeadlessCanvas() : {};
  },
};

const window = { devicePixelRatio: 1 };

function updateCanvasAspectRatio() {}
function updateColorbar() {}
function updateMaterialWarning() {}

function fieldDisplayConfig(display = state.fieldDisplay) {
  const magnitude = display === "electricMag" || display === "magneticMag" || state.viewMode === "poynting";
  return { magnitude };
}

function normalizeTheme(theme) {
  return theme === "dark" ? "dark" : "light";
}

function normalizeUiDepth(depth) {
  return depth === "advanced" ? "advanced" : "teaching";
}

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

const state = {
  running: false,
  theme: "light",
  uiDepth: "teaching",
  timeRate: 1,
  renderFps: 0,
  gain: 1,
  autoScale: true,
  fieldComponent: "ez",
  fieldDisplay: "scalar",
  fieldQuiver: false,
  diagnosticsEnabled: true,
  visualLayerBoundaries: true,
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

function lambdaToCells(valueLambda) {
  return Math.round((Number(valueLambda) || 0) * state.cellsPerWavelength);
}

function cellsToLambda(cells) {
  return cells / state.cellsPerWavelength;
}

function maxSourceXLambda() {
  return sim ? cellsToLambda(sim.sourcePlacementMaxX()) : cellsToLambda(state.gridNx - 2);
}

function maxSourceYLambda() {
  return sim ? cellsToLambda(sim.sourcePlacementMaxY()) : cellsToLambda(state.gridNy - 2);
}

function minSourceXLambda() {
  return sim ? cellsToLambda(sim.sourcePlacementMinX()) : cellsToLambda(1);
}

function minSourceYLambda() {
  return sim ? cellsToLambda(sim.sourcePlacementMinY()) : cellsToLambda(1);
}

function normalizeBoundarySides() {
  const fallback = normalizeBoundaryMode(state.boundary);
  if (!state.boundarySides || typeof state.boundarySides !== "object") {
    state.boundarySides = { left: fallback, right: fallback, top: fallback, bottom: fallback };
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
  return normalizeBoundaryMode(sides[side]);
}

function boundarySideIsAbsorbing(side) {
  return boundarySideMode(side) === "absorbing";
}

function anyAbsorbingBoundarySide() {
  return BOUNDARY_SIDES.some((side) => boundarySideIsAbsorbing(side));
}

function setBoundarySideMode(side, mode) {
  if (!BOUNDARY_SIDES.includes(side)) return;
  normalizeBoundarySides();
  state.boundarySides[side] = normalizeBoundaryMode(mode);
  normalizeBoundarySides();
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

function normalizeSource(source) {
  source.type = ["sine", "gaussian", "ricker"].includes(source.type) ? source.type : "sine";
  source.shape = Object.prototype.hasOwnProperty.call(sourceShapeLabels, source.shape) ? source.shape : "point";
  source.frequency = clamp(Number(source.frequency) || defaultSourceConfig.frequency, 0.001, 0.02);
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

function clampSweepRangeForMode(mode, value) {
  const normalizedMode = normalizeSweepMode(mode);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    if (normalizedMode === "frequency") return defaultSourceConfig.frequency;
    if (normalizedMode === "amplitude") return defaultSourceConfig.amplitude;
    if (normalizedMode === "gainLoss") return 0.04;
    return 0;
  }
  if (normalizedMode === "frequency") return clamp(numeric, 0.001, 0.02);
  if (normalizedMode === "amplitude") return clamp(numeric, 0.05, 1.2);
  if (normalizedMode === "gainLoss") return clamp(numeric, 0, 0.1);
  if (normalizedMode === "symmetry") return clamp(numeric, 0, 0.25);
  if (normalizedMode === "blochK" || normalizedMode === "direction") return clamp(numeric, 0, 1);
  return clamp(numeric, -80, 80);
}
`;
}

function loadSimulator() {
  const files = [
    ["src", "constants.js"],
    ["src", "numerics.js"],
    ["src", "catalog.js"],
    ["src", "wasm-backend.js"],
    ["src", "fdtd-sim.js"],
    ["src", "fdtd-materials.js"],
    ["src", "fdtd-boundaries.js"],
    ["src", "fdtd-presets.js"],
    ["src", "fdtd-sources.js"],
    ["src", "fdtd-diagnostics.js"],
    ["src", "fdtd-yee.js"],
  ];
  const exportCode = `
function createHeadlessSim(nx = DEFAULT_GRID.nx, ny = DEFAULT_GRID.ny) {
  state.gridNx = nx;
  state.gridNy = ny;
  sim = new FDTDSim(makeHeadlessCanvas(nx, ny), { nx, ny });
  return sim;
}

globalThis.__fdtd = {
  createHeadlessSim,
  state,
  DEFAULT_GRID,
  lambdaToCells,
  cellsToLambda,
};
`;
  const bundle = [
    files.slice(0, 3).map((file) => readText(...file)).join("\n"),
    headlessBootstrap(),
    files.slice(3).map((file) => readText(...file)).join("\n"),
    exportCode,
  ].join("\n");
  const context = {
    console,
    Math,
    Date,
    performance: { now: () => Date.now() },
    WebAssembly: undefined,
    Uint8Array,
    Uint8ClampedArray,
    Int8Array,
    Uint16Array,
    Int16Array,
    Uint32Array,
    Int32Array,
    Float32Array,
    Float64Array,
    ArrayBuffer,
    DataView,
    Set,
    Map,
    WeakMap,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    RegExp,
    Error,
  };
  vm.createContext(context);
  vm.runInContext(bundle, context, { filename: "headless-fdtd-bundle.js" });
  return context.__fdtd;
}

function finiteArray(values) {
  return values.every((value) => Number.isFinite(value));
}

function outputMetrics(sim, helpers, monitorX, centerY, halfWidth) {
  const x = helpers.lambdaToCells(monitorX);
  if (x < sim.activeInteriorMinX() || x > sim.activeInteriorMaxX()) {
    throw new Error(
      `Monitor x=${monitorX} lambda0 maps to cell ${x}, outside the active interior ` +
        `[${sim.activeInteriorMinX()}, ${sim.activeInteriorMaxX()}].`,
    );
  }
  const center = helpers.lambdaToCells(centerY);
  const radius = Math.max(2, helpers.lambdaToCells(halfWidth));
  const y0 = Math.max(sim.activeInteriorMinY(), center - radius);
  const y1 = Math.min(sim.activeInteriorMaxY(), center + radius);
  let ez2 = 0;
  let eAbs = 0;
  let sx = 0;
  let forwardSx = 0;
  let samples = 0;
  for (let y = y0; y <= y1; y += 1) {
    const idx = sim.id(x, y);
    const ez = sim.ez[idx] * sim.fieldPhysicalScale();
    const poynting = sim.poyntingAt(idx).x * sim.fieldPhysicalScale();
    ez2 += ez * ez;
    eAbs += Math.abs(ez);
    sx += poynting;
    forwardSx += Math.max(0, poynting);
    samples += 1;
  }
  return {
    x,
    y0,
    y1,
    samples,
    ez2,
    eAbs,
    sx,
    forwardSx,
  };
}

function ratio(upper, lower, key) {
  const total = upper[key] + lower[key];
  return total > 0 ? upper[key] / total : Number.NaN;
}

function runValidation() {
  const fdtd = loadSimulator();
  const sim = fdtd.createHeadlessSim(fdtd.DEFAULT_GRID.nx, fdtd.DEFAULT_GRID.ny);
  const state = fdtd.state;
  state.preset = "mmiWaveguide";
  sim.applyPreset(state.preset);
  sim.resetFields();

  const midYLambda = fdtd.cellsToLambda(sim.ny) * 0.5;
  const upperCenterY = midYLambda - 0.25;
  const lowerCenterY = midYLambda + 0.25;
  const totals = {
    upper: { ez2: 0, eAbs: 0, sx: 0, forwardSx: 0, samples: 0 },
    lower: { ez2: 0, eAbs: 0, sx: 0, forwardSx: 0, samples: 0 },
  };
  const totalSteps = warmupSteps + sampleSteps;

  for (let step = 0; step < totalSteps; step += 1) {
    sim.step();
    if (step < warmupSteps || step % sampleEvery !== 0) continue;
    const upper = outputMetrics(sim, fdtd, monitorXLambda, upperCenterY, guideHalfWidthLambda);
    const lower = outputMetrics(sim, fdtd, monitorXLambda, lowerCenterY, guideHalfWidthLambda);
    for (const key of ["ez2", "eAbs", "sx", "forwardSx"]) {
      totals.upper[key] += upper[key];
      totals.lower[key] += lower[key];
    }
    totals.upper.samples += 1;
    totals.lower.samples += 1;
    totals.upper.band = { x: upper.x, y0: upper.y0, y1: upper.y1 };
    totals.lower.band = { x: lower.x, y0: lower.y0, y1: lower.y1 };
  }

  const eEnergyUpperFraction = ratio(totals.upper, totals.lower, "ez2");
  const eAbsUpperFraction = ratio(totals.upper, totals.lower, "eAbs");
  const poyntingForwardUpperFraction = ratio(totals.upper, totals.lower, "forwardSx");
  const signedPoyntingUpperFraction = ratio(totals.upper, totals.lower, "sx");
  const imbalance = Math.abs(eEnergyUpperFraction - 0.5);
  const pass = finiteArray([
    eEnergyUpperFraction,
    eAbsUpperFraction,
    poyntingForwardUpperFraction,
    signedPoyntingUpperFraction,
    totals.upper.ez2,
    totals.lower.ez2,
  ]) && imbalance <= splitTolerance;

  return {
    status: pass ? "PASS" : "FAIL",
    preset: state.preset,
    grid: { nx: sim.nx, ny: sim.ny, cellsPerWavelength: state.cellsPerWavelength },
    steps: { warmup: warmupSteps, sampled: sampleSteps, sampleEvery, sampleCount: totals.upper.samples },
    monitor: {
      xLambda: monitorXLambda,
      guideHalfWidthLambda,
      upperCenterYLambda: upperCenterY,
      lowerCenterYLambda: lowerCenterY,
      upperBand: totals.upper.band,
      lowerBand: totals.lower.band,
    },
    fractions: {
      eEnergyUpper: eEnergyUpperFraction,
      eEnergyLower: 1 - eEnergyUpperFraction,
      eAbsUpper: eAbsUpperFraction,
      forwardPoyntingUpper: poyntingForwardUpperFraction,
      signedPoyntingUpper: signedPoyntingUpperFraction,
    },
    totals,
    acceptance: {
      metric: "time-averaged integrated Ez^2 in the two output guides",
      targetUpperFraction: 0.5,
      tolerance: splitTolerance,
      imbalance,
    },
  };
}

const report = runValidation();

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const pct = (value) => `${(100 * value).toFixed(1)}%`;
  console.log(`MMI split validation: ${report.status}`);
  console.log(`Ez^2 split upper/lower: ${pct(report.fractions.eEnergyUpper)} / ${pct(report.fractions.eEnergyLower)}`);
  console.log(`|Ez| split upper: ${pct(report.fractions.eAbsUpper)}`);
  console.log(`Forward Sx split upper: ${pct(report.fractions.forwardPoyntingUpper)}`);
  console.log(`Acceptance: |upper - 50%| <= ${(100 * report.acceptance.tolerance).toFixed(1)}%, measured ${(100 * report.acceptance.imbalance).toFixed(1)}%`);
}

process.exit(report.status === "PASS" ? 0 : 1);
