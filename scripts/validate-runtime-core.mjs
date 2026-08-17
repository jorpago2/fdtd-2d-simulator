#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { TextDecoder, TextEncoder } from "node:util";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function readText(...parts) {
  return fs.readFileSync(path.join(rootDir, ...parts), "utf8");
}

function createBrowserContext() {
  const context = {
    console,
    TextDecoder,
    TextEncoder,
    atob(value) {
      return Buffer.from(String(value), "base64").toString("binary");
    },
    btoa(value) {
      return Buffer.from(String(value), "binary").toString("base64");
    },
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  return context;
}

function loadScripts(context, files) {
  for (const file of files) {
    vm.runInContext(readText(...file), context, { filename: file.join("/") });
  }
}

function assertDeepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(stablePlainData(actual));
  const expectedJson = JSON.stringify(stablePlainData(expected));
  if (actualJson !== expectedJson) {
    throw new Error(`${label} mismatch.\nactual:   ${actualJson}\nexpected: ${expectedJson}`);
  }
}

function stablePlainData(value) {
  if (Array.isArray(value)) return value.map(stablePlainData);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = stablePlainData(value[key]);
      return sorted;
    }, {});
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: ${actual} !== ${expected}`);
  }
}

function assertClose(actual, expected, label, tolerance = 1e-12) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label} mismatch: ${actual} !== ${expected}`);
  }
}

function makeDiagnosticSamplingSim(runtime, { compiled }) {
  const sim = new runtime.FDTDSim();
  sim.time = 0;
  sim.fieldScale = 1;
  sim.diagnosticsLastUpdateTime = null;
  sim.diagnosticsSamplingActive = false;
  sim.resetLineDiagnostics();
  sim.resetModePortDiagnostics();
  sim.resetAnalysisDiagnostics();

  sim.canUseCompiledMaterialStep = () => compiled;
  sim.wasmBackend = { step() {} };
  sim.stepEzMode = () => {};
  sim.applyDispersiveElectricResponse = () => {};
  sim.applyTfsfScalarCorrections = () => {};
  sim.applyHarmonicNonlinearResponse = () => {};
  sim.applyBianisotropicResponse = () => {};
  sim.zeroBoundaryFields = () => {};
  sim.injectSource = () => {};
  sim.reconcileSplitScalarState = () => {};

  sim.analysisProbeCell = () => 0;
  sim.scalarAnalysisValueAt = () => 1;
  sim.ensureAnalysisContour = () => {};
  sim.analysisTotalFieldEnergy = () => 2;
  sim.analysisSourceIntensityEstimate = () => 1;
  sim.analysisContourFluxEstimate = () => ({ outward: 0.5, guided: 0.25 });
  sim.diagnosticFrequency = () => 0.025;
  sim.diagnosticMonitorPositions = () => ({ left: 1, right: 2 });
  sim.diagnosticDirection = () => ({ angleDeg: 0, cos: 1, sin: 0 });
  sim.lineDirectionalFluxAt = () => 0;
  sim.lineWaveSeparationAt = (x) => ({
    backward: x === 1 ? 0.1 : 0,
    backwardPower: x === 1 ? 0.01 : 0,
    forward: x === 1 ? 1 : 0.8,
    forwardPower: x === 1 ? 1 : 0.64,
    impedance: 1,
  });
  sim.fieldPowerScale = () => 1;
  sim.updateHyperlensAnalysis = () => {};
  const modeSource = { frequency: 0.025, shape: "modeProfile" };
  sim.ensureModePortDiagnostics = () => ({
    positions: { inputX: 1, outputX: 3, reflectionX: 0, sy: 1 },
    source: modeSource,
    sourceDescriptor: {},
  });
  sim.modePortProjectionAt = (_source, x) => ({
    projection: {
      modalAmplitude: x === 1 ? 1 : x === 3 ? 0.8 : 0.1,
      overlap: 1,
    },
  });
  return sim;
}

function checkStepDiagnosticSampling(runtime) {
  Object.assign(runtime.state, {
    analysisEnabled: true,
    analysisSampleEvery: 4,
    diagnosticsEnabled: true,
    fieldComponent: "ez",
    materialHarmonicEnabled: false,
    materialModulationEnabled: false,
    materialNonlinearEnabled: false,
    materialPhaseChangeEnabled: false,
    running: true,
  });

  const compiledSim = makeDiagnosticSamplingSim(runtime, { compiled: true });
  for (let expectedSteps = 1; expectedSteps <= 64; expectedSteps += 1) {
    compiledSim.step();
    assertEqual(compiledSim.time, expectedSteps, `Play time after step ${expectedSteps}`);
    assertEqual(compiledSim.diagnosticDftSampleCount, expectedSteps, `Play line DFT samples after step ${expectedSteps}`);
    assertEqual(compiledSim.modePortDftSampleCount, expectedSteps, `Play mode-port samples after step ${expectedSteps}`);
  }
  assertEqual(compiledSim.analysisSamples, 16, "Play decimated analysis samples at 64 steps");
  assertEqual(compiledSim.analysisProbeCount, 16, "Play analysis probe samples at 64 steps");
  if (!compiledSim.diagnosticSpectrumSummary) {
    throw new Error("Play line DFT did not reach its 64-sample spectrum threshold");
  }
  if (!compiledSim.modePortDftSummary) {
    throw new Error("Play mode-port DFT did not reach its 64-sample S-parameter threshold");
  }
  assertEqual(compiledSim.diagnosticSpectrumSummary.sampleCount, 64, "Play line DFT spectrum threshold");
  assertEqual(compiledSim.modePortDftSummary.sampleCount, 64, "Play mode-port S-parameter threshold");

  compiledSim.updateDiagnostics({ forceAnalysis: true });
  assertEqual(compiledSim.diagnosticDftSampleCount, 64, "pause does not duplicate line DFT at a sampled time");
  assertEqual(compiledSim.modePortDftSampleCount, 64, "pause does not duplicate mode-port DFT at a sampled time");
  assertEqual(compiledSim.analysisSamples, 16, "pause does not duplicate analysis at a sampled time");

  compiledSim.step();
  assertEqual(compiledSim.diagnosticDftSampleCount, 65, "Play line DFT samples after off-cadence step");
  assertEqual(compiledSim.modePortDftSampleCount, 65, "Play mode-port samples after off-cadence step");
  assertEqual(compiledSim.analysisSamples, 16, "analysis cadence before forced pause sample");
  compiledSim.updateDiagnostics({ forceAnalysis: true });
  compiledSim.updateDiagnostics({ forceAnalysis: true });
  assertEqual(compiledSim.diagnosticDftSampleCount, 65, "forced pause never duplicates line DFT");
  assertEqual(compiledSim.modePortDftSampleCount, 65, "forced pause never duplicates mode-port DFT");
  assertEqual(compiledSim.analysisSamples, 17, "forced pause fills one off-cadence analysis sample");

  runtime.state.running = false;
  for (let expectedSteps = 66; expectedSteps <= 68; expectedSteps += 1) {
    compiledSim.step();
    assertEqual(compiledSim.diagnosticDftSampleCount, expectedSteps, `Step/sweep line DFT samples after step ${expectedSteps}`);
    assertEqual(compiledSim.modePortDftSampleCount, expectedSteps, `Step/sweep mode-port samples after step ${expectedSteps}`);
  }
  assertEqual(compiledSim.analysisSamples, 18, "Step/sweep analysis keeps configured cadence");

  runtime.state.running = true;
  const jsFallbackSim = makeDiagnosticSamplingSim(runtime, { compiled: false });
  jsFallbackSim.step();
  assertEqual(jsFallbackSim.diagnosticDftSampleCount, 1, "JS fallback Play line DFT sample");
  assertEqual(jsFallbackSim.modePortDftSampleCount, 1, "JS fallback Play mode-port sample");
}

function sampleStateOptions() {
  return {
    defaultSourceConfig: {
      angleDeg: 0,
      amplitude: 1,
      direction: "forward",
      frequency: 0.005,
      id: 1,
      phaseDeg: 0,
      shape: "point",
      widthLambda: 0.3,
      xLambda: 2,
      yLambda: 2,
    },
    defaultBoundarySides: {
      left: "absorbing",
      right: "absorbing",
      top: "absorbing",
      bottom: "absorbing",
    },
    defaultGrid: { nx: 360, ny: 240 },
    themeStorageKey: "fdtd-theme",
    windowRef: { localStorage: { getItem: () => "dark" } },
  };
}

function compareStateModules(runtime, next) {
  const runtimeState = runtime.FdtdAppState;
  const nextState = next.FdtdNext.core.state;
  assertEqual(nextState.normalizeTheme("dark"), runtimeState.normalizeTheme("dark"), "normalizeTheme dark");
  assertEqual(nextState.normalizeTheme("bad"), runtimeState.normalizeTheme("bad"), "normalizeTheme fallback");
  assertEqual(nextState.normalizeUiDepth("teaching"), runtimeState.normalizeUiDepth("teaching"), "normalizeUiDepth teaching");
  assertEqual(nextState.normalizeUiDepth("bad"), runtimeState.normalizeUiDepth("bad"), "normalizeUiDepth fallback");
  assertDeepEqual(
    nextState.createInitialAppState(sampleStateOptions()),
    runtimeState.createInitialAppState(sampleStateOptions()),
    "createInitialAppState",
  );
}

function compareFormatterModules(runtime, next) {
  const state = {
    fieldComponent: "ez",
    fieldDisplay: "scalar",
    viewMode: "field",
    sources: [{ shape: "point" }],
    brush: "custom",
    customAnisotropic: false,
    materialBianisotropyEnabled: false,
    materialGyrotropyEnabled: false,
  };
  const dependencies = {
    state,
    materialNames: { custom: "Custom" },
    inPlaneElectricCurrentShapes: new Set(["electricDipoleX", "electricDipoleY"]),
    circularDipoleSourceShapes: new Set(["circularDipoleCw", "circularDipoleCcw"]),
    incidentFieldSourceShapes: new Set(["line", "gaussianProfile", "evanescentLine"]),
  };
  const runtimeFormatters = runtime.FdtdAppFormatters.createAppFormatters(dependencies);
  const nextFormatters = next.FdtdNext.core.formatters.createAppFormatters(dependencies);
  const checks = [
    "simulatedFieldLetter",
    "simulatedFieldComponentHtml",
    "simulatedFieldUnitHtml",
    "scalarFieldComponentKey",
    "solverModeLabel",
    "transverseFieldLetter",
    "transverseFieldUnitHtml",
    "currentSourceLetter",
    "sourceSummaryLabel",
    "currentBrushLabel",
    "formatLambdaOutput",
    "formatTimeRate",
    "formatSpeed",
    "formatScaleBarValue",
  ];
  for (const name of checks) {
    const args = name === "formatLambdaOutput" || name === "formatTimeRate" || name === "formatSpeed" || name === "formatScaleBarValue" ? [1.25] : [];
    assertEqual(nextFormatters[name](...args), runtimeFormatters[name](...args), `formatter ${name}`);
  }
  assertDeepEqual(nextFormatters.fieldDisplayConfig("scalar"), runtimeFormatters.fieldDisplayConfig("scalar"), "fieldDisplayConfig scalar");
  assertEqual(nextFormatters.sourceShapeLabel("line"), runtimeFormatters.sourceShapeLabel("line"), "sourceShapeLabel");
  assertEqual(nextFormatters.sourceCouplingLabel("line"), runtimeFormatters.sourceCouplingLabel("line"), "sourceCouplingLabel");
  assertEqual(nextFormatters.monitorQuantityLabel("normalFlux"), runtimeFormatters.monitorQuantityLabel("normalFlux"), "monitorQuantityLabel");
}

function compareSceneCodecModules(runtime, next) {
  const runtimeCodec = runtime.FdtdSceneCodec;
  const nextCodec = next.FdtdNext.core.sceneCodec;
  const state = sampleStateOptions();
  const snapshot = {
    exportedAt: "2026-01-01T00:00:00.000Z",
    grid: { nx: 10, ny: 8 },
    view: { x: 1, y: 2, zoom: 1.5 },
    state: { theme: "dark", preset: "empty" },
    materials: [{ x: 2, y: 3, eps: 4 }],
  };
  assertEqual(nextCodec.SCENE_SNAPSHOT_VERSION, runtimeCodec.SCENE_SNAPSHOT_VERSION, "SCENE_SNAPSHOT_VERSION");
  assertEqual(nextCodec.SCENE_SHARE_URL_LIMIT, runtimeCodec.SCENE_SHARE_URL_LIMIT, "SCENE_SHARE_URL_LIMIT");
  assertDeepEqual(nextCodec.SERIALIZABLE_STATE_KEYS, runtimeCodec.SERIALIZABLE_STATE_KEYS, "SERIALIZABLE_STATE_KEYS");
  assertEqual(nextCodec.safeFilePart("A test scene!"), runtimeCodec.safeFilePart("A test scene!"), "safeFilePart");
  assertDeepEqual(
    nextCodec.serializableStateSnapshot(state, ["themeStorageKey", "defaultGrid"]),
    runtimeCodec.serializableStateSnapshot(state, ["themeStorageKey", "defaultGrid"]),
    "serializableStateSnapshot",
  );
  assertDeepEqual(
    nextCodec.createSceneSnapshot(snapshot),
    runtimeCodec.createSceneSnapshot(snapshot),
    "createSceneSnapshot",
  );
  const encoded = nextCodec.encodeSceneSnapshot(snapshot);
  assertDeepEqual(nextCodec.decodeSceneSnapshot(encoded), snapshot, "next encode/decode roundtrip");
}

function makeFakeElement(dataset = {}) {
  const classes = new Set();
  const attributes = {};
  return {
    dataset,
    hidden: false,
    tabIndex: 0,
    attributes,
    classList: {
      contains(className) {
        return classes.has(className);
      },
      toggle(className, active) {
        if (active) classes.add(className);
        else classes.delete(className);
      },
    },
    removeAttribute(name) {
      delete attributes[name];
    },
    getAttribute(name) {
      return attributes[name] ?? null;
    },
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
    snapshot() {
      return {
        attributes: { ...attributes },
        classes: Array.from(classes).sort(),
        hidden: this.hidden,
        tabIndex: this.tabIndex,
      };
    },
  };
}

function compareUiCoreModules(runtime, next) {
  const runtimeUi = runtime.FdtdUiCore;
  const nextUi = next.FdtdNext.ui.core;

  const runtimeButtons = [makeFakeElement({ mode: "select" }), makeFakeElement({ mode: "draw" })];
  const nextButtons = [makeFakeElement({ mode: "select" }), makeFakeElement({ mode: "draw" })];
  [...runtimeButtons, ...nextButtons].forEach((button) => button.setAttribute("role", "tab"));
  runtimeUi.setExclusiveButtonState(runtimeButtons, "mode", "draw", { currentValue: "page" });
  nextUi.setExclusiveButtonState(nextButtons, "mode", "draw", { currentValue: "page" });
  assertDeepEqual(nextButtons.map((button) => button.snapshot()), runtimeButtons.map((button) => button.snapshot()), "ui setExclusiveButtonState");
  assertDeepEqual(runtimeButtons.map((button) => button.tabIndex), [-1, 0], "ui tab roving tabindex");
  assertEqual(nextUi.activeDatasetValue(nextButtons, "mode", "fallback"), runtimeUi.activeDatasetValue(runtimeButtons, "mode", "fallback"), "ui activeDatasetValue");

  const runtimePanels = [makeFakeElement({ tab: "scene" }), makeFakeElement({ tab: "visual" })];
  const nextPanels = [makeFakeElement({ tab: "scene" }), makeFakeElement({ tab: "visual" })];
  runtimeUi.setExclusivePanels(runtimePanels, "tab", "visual");
  nextUi.setExclusivePanels(nextPanels, "tab", "visual");
  assertDeepEqual(nextPanels.map((panel) => panel.snapshot()), runtimePanels.map((panel) => panel.snapshot()), "ui setExclusivePanels");

  const runtimeButton = makeFakeElement();
  const nextButton = makeFakeElement();
  runtimeUi.setPressed(runtimeButton, true);
  nextUi.setPressed(nextButton, true);
  runtimeUi.setExpanded(runtimeButton, true);
  nextUi.setExpanded(nextButton, true);
  runtimeUi.setHidden(runtimeButton, false);
  nextUi.setHidden(nextButton, false);
  assertDeepEqual(nextButton.snapshot(), runtimeButton.snapshot(), "ui simple state setters");
}

function baseNormalizerState() {
  return {
    theme: "invalid",
    timeRate: 99,
    renderFps: 999,
    gain: 0,
    autoScale: 0,
    fieldComponent: "hz",
    fieldDisplay: "bad",
    fieldQuiver: 1,
    diagnosticsEnabled: 0,
    visualLayerBoundaries: null,
    visualLayerMonitors: null,
    visualLayerAxes: 0,
    visualLayerScale: 1,
    visualLayerSources: undefined,
    visualLayerColorbar: true,
    analysisEnabled: 1,
    analysisSampleEvery: 99,
    sweepMode: "bad",
    sweepSamples: 1,
    sweepSteps: 99,
    sweepBidirectional: 1,
    viewMode: "bad",
    viewProjection: "3d",
    materialPart: "imag",
    canvasMode: "brush",
    wavelengthUm: -1,
    cellsPerWavelength: 200,
    gridNx: 9999,
    gridNy: 1,
    boundary: "bad",
    boundarySides: null,
    preset: "unknown",
    slabThicknessLambda: 0,
    customAnisotropic: 1,
    dispersionModel: "bad",
    materialDispersionEnabled: 0,
    materialModulationEnabled: 1,
    materialNonlinearEnabled: 0,
    materialHarmonicEnabled: 1,
    materialConductivityEnabled: 0,
    materialSaturableGainEnabled: 1,
    materialPhaseChangeEnabled: 0,
    materialGyrotropyEnabled: 1,
    materialBianisotropyEnabled: 0,
    brush: "missing-material",
    brushTool: "bad",
    brushGeometry: "bad",
    monitors: "bad",
    selectedMonitorId: 123,
    nextMonitorId: 0,
    monitorDefaults: { quantity: "normalFlux", xLambda: 2, lengthLambda: 4 },
  };
}

function makeNormalizerDependencies(state) {
  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, Number(value)));
  }
  function clampInt(value, min, max) {
    return Math.round(clampNumber(Number(value) || 0, min, max));
  }
  function normalizeMonitor(monitor) {
    return {
      quantity: ["scalar", "magnitude", "normalFlux", "tangentFlux"].includes(monitor.quantity) ? monitor.quantity : "scalar",
      xLambda: clampNumber(Number(monitor.xLambda) || 4.5, 0, 20),
      yLambda: clampNumber(Number(monitor.yLambda) || 3, 0, 20),
      lengthLambda: clampNumber(Number(monitor.lengthLambda) || 2, 0.1, 20),
      angleDeg: clampNumber(Number(monitor.angleDeg) || 90, -180, 180),
    };
  }

  return {
    state,
    maxGrid: { nx: 720, ny: 480 },
    visualLayerStateKeys: {
      boundaries: "visualLayerBoundaries",
      monitors: "visualLayerMonitors",
      axes: "visualLayerAxes",
      scale: "visualLayerScale",
      sources: "visualLayerSources",
      colorbar: "visualLayerColorbar",
    },
    materialNames: { custom: "Custom", air: "Air" },
    defaultMonitorConfig: { quantity: "scalar", xLambda: 4.5, yLambda: 3, lengthLambda: 2, angleDeg: 90 },
    clampNumber,
    clampInt,
    normalizeTheme: (value) => (value === "dark" ? "dark" : "light"),
    normalizeSweepMode: (value) => (["angle", "frequency", "thickness"].includes(value) ? value : "angle"),
    normalizeBoundaryMode: (value) => (["absorbing", "periodic", "metal"].includes(value) ? value : "absorbing"),
    normalizeBoundarySides() {
      state.boundarySides = { left: "absorbing", right: "absorbing", top: "absorbing", bottom: "absorbing" };
    },
    knownPresetValue: (value) => value === "empty",
    normalizeDispersionModel: (value) => (["none", "drude", "lorentz", "debye"].includes(value) ? value : "none"),
    normalizeBrushGeometryState() {
      state.brushGeometry = ["rectangle", "ellipse", "ring"].includes(state.brushGeometry) ? state.brushGeometry : "rectangle";
    },
    normalizeMonitor,
  };
}

function compareStateNormalizerModules(runtime, next) {
  const runtimeState = baseNormalizerState();
  const nextState = JSON.parse(JSON.stringify(runtimeState));
  runtime.FdtdStateNormalizer.createStateNormalizer(makeNormalizerDependencies(runtimeState)).normalizeImportedStateValues();
  next.FdtdNext.core.stateNormalizer.createStateNormalizer(makeNormalizerDependencies(nextState)).normalizeImportedStateValues();
  assertDeepEqual(nextState, runtimeState, "state normalizer");
}

function makeViewportSim(Constructor) {
  const sim = new Constructor();
  sim.nx = 360;
  sim.ny = 240;
  sim.viewZoom = 1.8;
  sim.viewX = 20;
  sim.viewY = 10;
  sim.canvas = {
    width: 1200,
    height: 800,
    dataset: {},
    getBoundingClientRect() {
      return { left: 5, top: 10, width: 600, height: 400 };
    },
  };
  sim.ctx = { imageSmoothingEnabled: true };
  return sim;
}

function snapshotViewportSim(sim) {
  return {
    canvas: {
      width: sim.canvas.width,
      height: sim.canvas.height,
      dataset: { ...sim.canvas.dataset },
    },
    imageSmoothingEnabled: sim.ctx.imageSmoothingEnabled,
    viewX: sim.viewX,
    viewY: sim.viewY,
    viewZoom: sim.viewZoom,
  };
}

function compareViewportModules(runtime, next) {
  const viewportInput = { canvasWidth: 1200, canvasHeight: 800, gridWidth: 360, gridHeight: 240 };
  assertDeepEqual(
    next.FdtdNext.canvas.viewport.viewportForGridView(viewportInput),
    runtime.FdtdCanvasViewport.viewportForGridView(viewportInput),
    "viewportForGridView",
  );

  function NextSim() {}
  next.FdtdNext.canvas.viewport.installViewportMethods(NextSim, {
    clampNumber: runtime.clamp,
    clampInt: runtime.clampInt,
  });
  const runtimeSim = makeViewportSim(runtime.FDTDSim);
  const nextSim = makeViewportSim(NextSim);

  const readChecks = [
    "maxViewZoom",
    "visibleGridWidth",
    "visibleGridHeight",
    "viewAspectRatio",
    "renderViewport",
    "clientViewportRect",
  ];
  for (const name of readChecks) {
    assertDeepEqual(nextSim[name](), runtimeSim[name](), `viewport method ${name}`);
  }
  assertDeepEqual(nextSim.clientToViewFractions(180, 120), runtimeSim.clientToViewFractions(180, 120), "clientToViewFractions");
  assertDeepEqual(nextSim.clientToGridFloat(180, 120), runtimeSim.clientToGridFloat(180, 120), "clientToGridFloat");
  assertDeepEqual(nextSim.clientToGridCell(180, 120), runtimeSim.clientToGridCell(180, 120), "clientToGridCell");
  assertEqual(nextSim.gridToCanvasX(120), runtimeSim.gridToCanvasX(120), "gridToCanvasX");
  assertEqual(nextSim.gridToCanvasY(80), runtimeSim.gridToCanvasY(80), "gridToCanvasY");
  assertDeepEqual(nextSim.gridRectToCanvas(10, 20, 140, 160), runtimeSim.gridRectToCanvas(10, 20, 140, 160), "gridRectToCanvas");

  nextSim.zoomAtClientPoint(180, 120, 1.25);
  runtimeSim.zoomAtClientPoint(180, 120, 1.25);
  nextSim.panByClientDelta(24, -12);
  runtimeSim.panByClientDelta(24, -12);
  nextSim.setZoomFromGesture(220, 160, 90, 70, 2.2);
  runtimeSim.setZoomFromGesture(220, 160, 90, 70, 2.2);
  nextSim.fitCanvas();
  runtimeSim.fitCanvas();
  assertDeepEqual(snapshotViewportSim(nextSim), snapshotViewportSim(runtimeSim), "viewport mutating methods");
}

function checkHiddenViewportResizeGuard(runtime, next) {
  function verifyHiddenGuard(sim, label) {
    sim.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
    const before = { width: sim.canvas.width, height: sim.canvas.height };
    assertEqual(sim.fitCanvas(), false, `${label} hidden fit result`);
    assertEqual(sim.canvas.width, before.width, `${label} hidden canvas width`);
    assertEqual(sim.canvas.height, before.height, `${label} hidden canvas height`);

    sim.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 180 });
    assertEqual(sim.fitCanvas(), true, `${label} visible fit result`);
    assertEqual(sim.canvas.width, 640, `${label} restored canvas width`);
    assertEqual(sim.canvas.height, 360, `${label} restored canvas height`);
  }

  function NextSim() {}
  next.FdtdNext.canvas.viewport.installViewportMethods(NextSim, {
    clampNumber: runtime.clamp,
    clampInt: runtime.clampInt,
  });
  const runtimeSim = makeViewportSim(runtime.FDTDSim);
  runtimeSim.fieldCanvas = { width: runtimeSim.canvas.width, height: runtimeSim.canvas.height };
  runtimeSim.surfaceCanvas = { width: runtimeSim.canvas.width, height: runtimeSim.canvas.height };
  const nextSim = makeViewportSim(NextSim);

  verifyHiddenGuard(runtimeSim, "runtime viewport");
  verifyHiddenGuard(nextSim, "reference viewport");
  assertEqual(runtimeSim.fieldCanvas.width, 640, "runtime restored field canvas width");
  assertEqual(runtimeSim.fieldCanvas.height, 360, "runtime restored field canvas height");
  assertEqual(runtimeSim.surfaceCanvas.width, 640, "runtime restored surface canvas width");
  assertEqual(runtimeSim.surfaceCanvas.height, 360, "runtime restored surface canvas height");
}

function checkCanvasLayoutRefreshBindings() {
  const runtime = createBrowserContext();
  const listeners = new Map();
  const animationFrames = new Map();
  let nextFrameId = 1;
  runtime.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  runtime.addEventListener = (type, listener) => {
    const typeListeners = listeners.get(type) || [];
    typeListeners.push(listener);
    listeners.set(type, typeListeners);
  };
  runtime.dispatchEvent = (event) => {
    (listeners.get(event.type) || []).forEach((listener) => listener(event));
    return true;
  };
  runtime.requestAnimationFrame = (callback) => {
    const frameId = nextFrameId;
    nextFrameId += 1;
    animationFrames.set(frameId, callback);
    return frameId;
  };
  runtime.cancelAnimationFrame = (frameId) => animationFrames.delete(frameId);
  runtime.matchMedia = () => ({ matches: true });
  const flushAnimationFrame = () => {
    const callbacks = [...animationFrames.values()];
    animationFrames.clear();
    callbacks.forEach((callback) => callback());
  };
  const classList = (initial = []) => {
    const values = new Set(initial);
    return {
      contains: (name) => values.has(name),
      toggle(name, active) {
        if (active) values.add(name);
        else values.delete(name);
      },
    };
  };
  const element = (initialClasses = []) => ({
    classList: classList(initialClasses),
    dataset: {},
    hidden: false,
    attributes: {},
    addEventListener(type, listener) {
      this.listeners ||= new Map();
      this.listeners.set(type, listener);
    },
    focus() {},
    querySelector: () => null,
    removeAttribute(name) {
      delete this.attributes[name];
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
  });
  const documentRef = { activeElement: null, body: element() };

  loadScripts(runtime, [
    ["src", "runtime", "ui", "ui-core.js"],
    ["src", "runtime", "ui", "ui-drawer.js"],
    ["src", "runtime", "ui", "visual-control-bindings.js"],
  ]);

  const appShell = element();
  const controlPanel = element();
  const drawerEvents = [];
  runtime.addEventListener("fdtd:control-drawer-state", (event) => drawerEvents.push(event.detail?.open));
  const drawer = runtime.FdtdUiDrawer.createDrawerController({
    documentRef,
    el: {
      appShell,
      controlDrawerBackdrop: element(),
      controlDrawerToggle: element(),
      controlPanel,
      controlTabButtons: [],
      controlTabPanels: [],
      mobileLayerButtons: [],
    },
    uiCore: runtime.FdtdUiCore,
  });
  drawer.setControlDrawerOpen(true);
  drawer.setControlDrawerOpen(false);
  assertDeepEqual(drawerEvents, [true, false], "drawer layout-state events");
  assertEqual(controlPanel.attributes["aria-hidden"], undefined, "drawer leaves accessibility state to React");

  const projectionButton = element();
  projectionButton.dataset.viewProjection = "3d";
  let fitCalls = 0;
  let renderCalls = 0;
  const state = { viewProjection: "2d" };
  const sim = {
    canvas: element(),
    fitCanvas: () => {
      fitCalls += 1;
    },
    render: () => {
      renderCalls += 1;
    },
  };
  runtime.FdtdVisualControlBindings.bindVisualControls({
    el: { viewProjectionButtons: [projectionButton] },
    setCustomVisualLayer() {},
    sim,
    state,
    updateControlText() {},
    updateStats() {},
  });
  runtime.dispatchEvent(new runtime.CustomEvent("fdtd:visual-choice", {
    detail: { property: "viewProjection", value: "3d" },
  }));
  assertEqual(state.viewProjection, "3d", "projection state update");
  assertEqual(renderCalls, 1, "projection immediate render");
  flushAnimationFrame();
  flushAnimationFrame();
  assertEqual(fitCalls, 1, "projection post-layout fit");
  assertEqual(renderCalls, 2, "projection post-layout render");

  runtime.dispatchEvent(new runtime.CustomEvent("fdtd:control-drawer-state", { detail: { open: false } }));
  flushAnimationFrame();
  flushAnimationFrame();
  assertEqual(fitCalls, 2, "drawer post-layout fit");
  assertEqual(renderCalls, 3, "drawer post-layout render");
}

function checkMonitorResults(runtime) {
  const collecting = runtime.FdtdUiResults.resultsInsightText(
    { balanceReady: false, diagnosticsEnabled: true, samples: 20 },
    String,
  );
  if (!collecting.text.startsWith("Collecting monitor samples")) {
    throw new Error(`results readiness exposed an unready balance: ${collecting.text}`);
  }
  const ready = runtime.FdtdUiResults.resultsInsightText(
    {
      balance: 0.1,
      balanceMethod: "transverse line-integrated power",
      balanceReady: true,
      diagnosticsEnabled: true,
      reflectance: 0.2,
      samples: 20,
      transmittance: 0.7,
    },
    String,
  );
  if (!ready.text.includes("transverse line-integrated power")) {
    throw new Error(`results readiness omitted the estimator method: ${ready.text}`);
  }

  const spectralReadout = runtime.FdtdUiResultsCharts.spectrumReadoutText(
    {
      mode: "rta",
      points: [
        { frequency: 0.01, reflectance: 0.1, transmittance: 0.8, balanceResidual: 0.1 },
        { frequency: 0.02, reflectance: 0.3, transmittance: 0.8, balanceResidual: -0.1 },
      ],
    },
    0.019,
    String,
    String,
  );
  assertEqual(spectralReadout, "f=0.02 | R=0.3 | T=0.8 | residual=-0.1", "R/T/residual spectrum readout");

  runtime.state.fieldComponent = "ez";
  runtime.state.cellsPerWavelength = 20;
  const sim = new runtime.FDTDSim();
  sim.nx = 3;
  sim.ny = 4;
  sim.material = new Uint8Array(12);
  sim.ez = new Float64Array(12);
  sim.hx = new Float64Array(12);
  sim.hy = new Float64Array(12);
  sim.eps = new Float64Array(12).fill(1);
  sim.epsY = new Float64Array(12).fill(1);
  sim.mu = new Float64Array(12).fill(1);
  sim.muY = new Float64Array(12).fill(1);
  sim.id = (x, y) => y * sim.nx + x;
  sim.activeInteriorMinY = () => 0;
  sim.activeInteriorMaxY = () => 3;
  sim.fieldPowerScale = () => 1;
  [1, 2, 3, 4].forEach((field, y) => {
    for (let x = 0; x < sim.nx; x += 1) {
      const index = sim.id(x, y);
      sim.ez[index] = field;
      sim.hy[index] = -field;
    }
  });
  const separated = sim.lineWaveSeparationAt(1, { cos: 1, sin: 0 });
  assertClose(separated.forward, 2.5, "transverse mean forward field");
  assertClose(separated.backward, 0, "transverse mean backward field");
  assertClose(separated.forwardPower, 1.5, "transverse integrated forward power");

  sim.diagnosticDftSummary = { carrierIncidentPower: 9, orders: [{ order: 0, reflectedPowerRatio: 0.9, powerRatio: 0.05 }] };
  sim.diagnosticDftSampleCount = 64;
  sim.diagnosticSamples = 20;
  sim.diagnosticIncidentPowerEwma = 2;
  sim.diagnosticReflectedPowerEwma = 0.5;
  sim.diagnosticTransmittedPowerEwma = 1;
  sim.diagnosticIncidentPhasorPower = 9;
  sim.diagnosticReflectedPhasorPower = 8;
  sim.diagnosticTransmittedPhasorPower = 0.5;
  const integratedBalance = sim.diagnosticPowerBalanceEstimate();
  assertEqual(integratedBalance.method, "transverse line-integrated power", "steady-state balance method");
  assertClose(integratedBalance.reflectance, 0.25, "integrated reflectance");
  assertClose(integratedBalance.transmittance, 0.5, "integrated transmittance");

  sim.diagnosticDftSummary = {
    carrierFrequency: 0.01,
    carrierIncidentPower: 1,
    orders: [
      { order: 0, reflectedPowerRatio: 0.1, powerRatio: 0.6 },
      { order: 1, reflectedPowerRatio: 0.1, powerRatio: 0.1 },
    ],
    scatteringMatrix: { totalReflectedPower: 0.2, totalTransmittedPower: 0.7 },
  };
  const floquetBalance = sim.diagnosticPowerBalanceEstimate();
  assertEqual(floquetBalance.method, "line-mean DFT all measured orders", "Floquet balance method");
  assertClose(floquetBalance.reflectance, 0.2, "Floquet reflectance");
  assertClose(floquetBalance.transmittance, 0.7, "Floquet transmittance");
}

function deferredPromise() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function settlePromiseQueue() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

async function checkPlotlyRenderQueue(runtime) {
  let visible = true;
  let activeRenders = 0;
  let maxActiveRenders = 0;
  const attributes = {};
  const renderCalls = [];
  const resizeCalls = [];
  const toolbarResults = [];
  const reportedErrors = [];
  const unhandledRejections = [];
  const chart = {
    get clientHeight() {
      return visible ? 240 : 0;
    },
    get clientWidth() {
      return visible ? 640 : 0;
    },
    closest() {
      return null;
    },
    getClientRects() {
      return visible ? [{}] : [];
    },
    hidden: false,
    isConnected: true,
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
  };
  const originalConsole = runtime.console;
  const originalPlotly = runtime.Plotly;
  const originalScientificPlotUI = runtime.ScientificPlotUI;
  const onUnhandledRejection = (error) => unhandledRejections.push(error);

  process.on("unhandledRejection", onUnhandledRejection);
  runtime.console = { ...console, error: (...args) => reportedErrors.push(args) };
  runtime.queueMicrotask = queueMicrotask;
  runtime.ScientificPlotUI = {
    createConfig: (options) => options,
    createLayout: (options) => options,
    lineWidths: { primary: 1.75 },
    prepareToolbar: (result) => toolbarResults.push(result),
  };
  runtime.Plotly = {
    Plots: {
      resize(target) {
        resizeCalls.push(target);
      },
    },
    react(target, traces, layout, config) {
      const deferred = deferredPromise();
      activeRenders += 1;
      maxActiveRenders = Math.max(maxActiveRenders, activeRenders);
      renderCalls.push({ config, deferred, layout, target, traces });
      return deferred.promise.then(
        (value) => {
          activeRenders -= 1;
          return value;
        },
        (error) => {
          activeRenders -= 1;
          throw error;
        },
      );
    },
  };

  try {
    const controller = runtime.FdtdUiResultsCharts.createResultsChartsController({ el: { spectrumChart: chart } });
    const drawFrequency = (frequency) =>
      controller.drawSpectrumChart({
        portSpectrum: {
          points: [{ balanceResidual: 0.1, frequency, reflectance: 0.1, transmittance: 0.8, valid: true }],
        },
      });

    drawFrequency(0.01);
    drawFrequency(0.02);
    assertEqual(renderCalls.length, 0, "same-turn Plotly render deferral");
    await settlePromiseQueue();
    assertEqual(renderCalls.length, 1, "same-turn Plotly render coalescing");
    assertEqual(renderCalls[0].traces[0].x[0], 0.02, "same-turn Plotly latest state");

    drawFrequency(0.03);
    drawFrequency(0.04);
    await settlePromiseQueue();
    assertEqual(renderCalls.length, 1, "Plotly render serialization while pending");
    renderCalls[0].deferred.resolve("first");
    await settlePromiseQueue();
    assertEqual(renderCalls.length, 2, "Plotly queued render starts after completion");
    assertEqual(renderCalls[1].traces[0].x[0], 0.04, "pending Plotly latest state");

    visible = false;
    drawFrequency(0.05);
    renderCalls[1].deferred.resolve("second");
    await settlePromiseQueue();
    assertEqual(renderCalls.length, 2, "hidden Plotly chart is not rendered");

    visible = true;
    controller.resizeSpectrumChart();
    await settlePromiseQueue();
    assertEqual(renderCalls.length, 3, "hidden Plotly state resumes when visible");
    assertEqual(renderCalls[2].traces[0].x[0], 0.05, "hidden Plotly latest state");
    assertEqual(resizeCalls.length, 0, "Plotly resize does not overlap queued render");

    drawFrequency(0.06);
    renderCalls[2].deferred.reject(new Error("expected render failure"));
    await settlePromiseQueue();
    assertEqual(renderCalls.length, 4, "Plotly queue recovers after rejection");
    assertEqual(renderCalls[3].traces[0].x[0], 0.06, "Plotly state survives rejection");
    renderCalls[3].deferred.resolve("fourth");
    await settlePromiseQueue();
    controller.resizeSpectrumChart();
    await settlePromiseQueue();

    assertEqual(maxActiveRenders, 1, "maximum concurrent Plotly renders");
    assertEqual(resizeCalls.length, 1, "Plotly resize after queue drain");
    assertEqual(toolbarResults.join(","), "first,second,fourth", "Plotly toolbar preparation");
    assertEqual(reportedErrors.length, 1, "Plotly rejected render reporting");
    await new Promise((resolve) => setImmediate(resolve));
    assertEqual(unhandledRejections.length, 0, "Plotly unhandled rejections");
  } finally {
    process.off("unhandledRejection", onUnhandledRejection);
    runtime.console = originalConsole;
    runtime.Plotly = originalPlotly;
    runtime.ScientificPlotUI = originalScientificPlotUI;
  }
}

function checkHelpEscapeModalPrecedence() {
  const runtime = createBrowserContext();
  loadScripts(runtime, [["src", "runtime", "canvas", "canvas-interactions.js"]]);

  const documentListeners = new Map();
  const noopNames = [
    "closeContextMenus",
    "clearCanvasHover",
    "updateViewInteraction",
    "handleCanvasKeydown",
    "beginPinchGesture",
    "updatePinchGesture",
    "beginPan",
    "beginPendingTouchInteraction",
    "markPendingTouchMoved",
    "promotePendingTouchDrag",
    "handleCanvasTouchTap",
    "clearPendingTouchInteraction",
    "updateSourceDrag",
    "updateMonitorDrag",
    "updateMaterialDrag",
    "updatePan",
    "endSourceDrag",
    "endMonitorDrag",
    "endMaterialDrag",
    "beginSourceDrag",
    "beginMonitorDrag",
    "beginMaterialDrag",
    "selectMaterialRegionAt",
    "clearMaterialSelection",
    "updateCanvasHover",
    "updateCanvasInteractionState",
    "insertGeometryFromEvent",
    "beginPaintStroke",
    "paintFromEvent",
    "endPaintStroke",
    "openBoundaryMenuAt",
    "openBrushMenuAt",
    "openSourceMenuAt",
    "openMonitorMenuAt",
    "openCanvasContextMenuAt",
    "closeCanvasActionsMenu",
    "closeCanvasOptionsMenu",
  ];
  const dependencies = Object.fromEntries(noopNames.map((name) => [name, () => {}]));
  let drawerCloseCount = 0;
  const el = {
    appShell: { classList: { contains: (name) => name === "controls-open" } },
    canvas: { addEventListener() {} },
    helpGuidePanel: { hidden: false },
    stage: { classList: { contains: () => false } },
  };
  Object.assign(dependencies, {
    closeControlDrawer: () => {
      drawerCloseCount += 1;
    },
    deleteSelectedElement: () => false,
    documentRef: {
      addEventListener(type, listener) {
        documentListeners.set(type, listener);
      },
    },
    dragStateController: {},
    el,
    isEditableKeyTarget: () => false,
    pointerState: {},
    pointerStateController: {},
    sim: { render() {} },
    state: {},
  });

  runtime.FdtdCanvasInteractions.createCanvasInteractionsController(dependencies).bind();
  const keydown = documentListeners.get("keydown");
  assertEqual(typeof keydown, "function", "canvas document keydown binding");

  let prevented = false;
  keydown({ key: "Escape", preventDefault: () => { prevented = true; }, target: {} });
  assertEqual(drawerCloseCount, 0, "help Escape leaves underlying drawer open");
  assertEqual(prevented, false, "help Escape remains available to modal handler");

  el.helpGuidePanel.hidden = true;
  keydown({ key: "Escape", preventDefault: () => { prevented = true; }, target: {} });
  assertEqual(drawerCloseCount, 1, "drawer Escape still closes without help modal");
  assertEqual(prevented, true, "drawer Escape prevents the default action");
}

function checkThreeResourceDisposalOnCanvasReplacement() {
  const runtime = createBrowserContext();
  runtime.URL = URL;
  runtime.document = { baseURI: "https://fdtd.test/" };
  runtime.state = {};
  runtime.clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  runtime.clampInt = (value, min, max) => Math.round(runtime.clamp(Number(value) || 0, min, max));
  loadScripts(runtime, [["src", "runtime", "canvas", "canvas-surface-three-renderer.js"]]);

  const renderer = runtime.FdtdCanvasSurfaceThreeRenderer.createRenderer();
  const oldCanvas = {};
  const nextCanvas = {};
  const mesh = {};
  const outline = {};
  const disposed = [];
  const removed = [];
  const disposable = (name) => ({ dispose: () => disposed.push(name) });
  renderer.canvas = oldCanvas;
  renderer.scene = { remove: (object) => removed.push(object) };
  renderer.mesh = mesh;
  renderer.outline = outline;
  renderer.geometry = disposable("geometry");
  renderer.material = disposable("material");
  renderer.outlineGeometry = disposable("outlineGeometry");
  renderer.outlineMaterial = disposable("outlineMaterial");
  renderer.renderer = disposable("renderer");
  renderer.positions = new Float32Array(3);
  renderer.colors = new Float32Array(3);
  renderer.lastFrameKey = "stale-frame";
  renderer.runningReuseCounter = 1;

  assertEqual(renderer.ensureCanvas({ surfaceCanvas: nextCanvas }), nextCanvas, "replacement surface canvas");
  assertEqual(disposed.sort().join(","), "geometry,material,outlineGeometry,outlineMaterial,renderer", "Three resource disposal");
  assertEqual(removed.length, 2, "Three scene object removal count");
  assertEqual(removed[0], mesh, "Three mesh removal");
  assertEqual(removed[1], outline, "Three outline removal");
  assertEqual(renderer.renderer, null, "Three renderer reset");
  assertEqual(renderer.geometry, null, "Three geometry reset");
  assertEqual(renderer.material, null, "Three material reset");
  assertEqual(renderer.outlineGeometry, null, "Three outline geometry reset");
  assertEqual(renderer.outlineMaterial, null, "Three outline material reset");
  assertEqual(renderer.lastFrameKey, "", "Three frame cache reset");
  assertEqual(renderer.runningReuseCounter, 0, "Three reuse counter reset");
}

async function main() {
  const runtime = createBrowserContext();
  runtime.devicePixelRatio = 2;
  runtime.FDTDSim = function FDTDSim() {};
  runtime.clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  runtime.clampInt = (value, min, max) => Math.round(runtime.clamp(Number(value) || 0, min, max));
  runtime.state = { cellsPerWavelength: 20, fieldComponent: "ez", sources: [] };
  runtime.defaultSourceConfig = { angleDeg: 0, frequency: 0.005, shape: "line", type: "sine" };
  runtime.incidentFieldSourceShapes = new Set(["line", "gaussianProfile", "modeProfile", "tfsf"]);
  runtime.temporalFloquetAnalysisPresets = new Set();
  runtime.DIAGNOSTIC_DFT_WINDOW = 512;
  runtime.FdtdAppState = await import("../src/core/app-state.ts");
  loadScripts(runtime, [
    ["src", "runtime", "core", "numerics.js"],
    ["src", "runtime", "core", "app-formatters.js"],
    ["src", "runtime", "core", "scene-codec.js"],
    ["src", "runtime", "ui", "ui-core.js"],
    ["src", "runtime", "canvas", "canvas-viewport.js"],
    ["src", "runtime", "simulation", "fdtd-line-diagnostics.js"],
    ["src", "runtime", "simulation", "fdtd-modal-analysis.js"],
    ["src", "runtime", "simulation", "fdtd-analysis-sampling.js"],
    ["src", "runtime", "simulation", "fdtd-diagnostics.js"],
    ["src", "runtime", "simulation", "fdtd-yee.js"],
    ["src", "runtime", "ui", "ui-results.js"],
    ["src", "runtime", "ui", "ui-results-charts.js"],
  ]);
  runtime.FdtdStateNormalizer = await import("../src/core/state-normalizer.ts");

  const next = createBrowserContext();
  next.devicePixelRatio = 2;
  loadScripts(next, [
    ["tests", "reference-modules", "core", "contracts.js"],
    ["tests", "reference-modules", "core", "state.js"],
    ["tests", "reference-modules", "core", "formatters.js"],
    ["tests", "reference-modules", "core", "scene-codec.js"],
    ["tests", "reference-modules", "core", "state-normalizer.js"],
    ["tests", "reference-modules", "ui", "core.js"],
    ["tests", "reference-modules", "canvas", "viewport.js"],
  ]);

  compareStateModules(runtime, next);
  compareFormatterModules(runtime, next);
  compareSceneCodecModules(runtime, next);
  compareUiCoreModules(runtime, next);
  compareStateNormalizerModules(runtime, next);
  compareViewportModules(runtime, next);
  checkHiddenViewportResizeGuard(runtime, next);
  checkCanvasLayoutRefreshBindings();
  checkMonitorResults(runtime);
  checkStepDiagnosticSampling(runtime);
  checkHelpEscapeModalPrecedence();
  checkThreeResourceDisposalOnCanvasReplacement();
  await checkPlotlyRenderQueue(runtime);
  console.log("Runtime core validation: PASS");
}

await main();
