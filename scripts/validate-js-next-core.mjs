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
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
    snapshot() {
      return {
        attributes: { ...attributes },
        classes: Array.from(classes).sort(),
        hidden: this.hidden,
      };
    },
  };
}

function compareUiCoreModules(runtime, next) {
  const runtimeUi = runtime.FdtdUiCore;
  const nextUi = next.FdtdNext.ui.core;

  const runtimeButtons = [makeFakeElement({ mode: "select" }), makeFakeElement({ mode: "draw" })];
  const nextButtons = [makeFakeElement({ mode: "select" }), makeFakeElement({ mode: "draw" })];
  runtimeUi.setExclusiveButtonState(runtimeButtons, "mode", "draw", { currentValue: "page" });
  nextUi.setExclusiveButtonState(nextButtons, "mode", "draw", { currentValue: "page" });
  assertDeepEqual(nextButtons.map((button) => button.snapshot()), runtimeButtons.map((button) => button.snapshot()), "ui setExclusiveButtonState");
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

function main() {
  const runtime = createBrowserContext();
  runtime.devicePixelRatio = 2;
  runtime.FDTDSim = function FDTDSim() {};
  runtime.clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  runtime.clampInt = (value, min, max) => Math.round(runtime.clamp(Number(value) || 0, min, max));
  loadScripts(runtime, [
    ["js-next", "runtime", "core", "app-state.js"],
    ["js-next", "runtime", "core", "app-formatters.js"],
    ["js-next", "runtime", "core", "scene-codec.js"],
    ["js-next", "runtime", "ui", "ui-core.js"],
    ["js-next", "runtime", "core", "state-normalizer.js"],
    ["js-next", "runtime", "canvas", "canvas-viewport.js"],
  ]);

  const next = createBrowserContext();
  next.devicePixelRatio = 2;
  loadScripts(next, [
    ["js-next", "core", "contracts.js"],
    ["js-next", "core", "state.js"],
    ["js-next", "core", "formatters.js"],
    ["js-next", "core", "scene-codec.js"],
    ["js-next", "core", "state-normalizer.js"],
    ["js-next", "ui", "core.js"],
    ["js-next", "canvas", "viewport.js"],
  ]);

  compareStateModules(runtime, next);
  compareFormatterModules(runtime, next);
  compareSceneCodecModules(runtime, next);
  compareUiCoreModules(runtime, next);
  compareStateNormalizerModules(runtime, next);
  compareViewportModules(runtime, next);
  console.log("JS next core validation: PASS");
}

main();
