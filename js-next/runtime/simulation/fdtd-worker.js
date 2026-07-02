"use strict";

self.window = self;
self.window.devicePixelRatio = 1;
self.fdtdPerformance = null;

let state = {};

function makeHeadlessContext() {
  return {
    imageSmoothingEnabled: false,
    createImageData(width, height) {
      return { width, height, data: new Uint8ClampedArray(Math.max(1, width * height * 4)) };
    },
    clearRect() {},
    drawImage() {},
    putImageData() {},
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    arc() {},
    fillText() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
  };
}

function makeHeadlessCanvas(width = 1, height = 1) {
  return {
    width,
    height,
    style: {},
    dataset: {},
    getContext() {
      return makeHeadlessContext();
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: this.width || 1, height: this.height || 1 };
    },
  };
}

self.document = {
  createElement(tagName) {
    return tagName === "canvas" ? makeHeadlessCanvas() : {};
  },
};

function updateCanvasAspectRatio() {}
function updateColorbar() {}
function updateMaterialWarning() {}

function lambdaToCells(valueLambda) {
  return Math.round((Number(valueLambda) || 0) * state.cellsPerWavelength);
}

function cellsToLambda(cells) {
  return cells / state.cellsPerWavelength;
}

function normalizeBoundaryMode(mode) {
  return mode === "reflective" ? "reflective" : "absorbing";
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

importScripts(
  "fdtd-worker-protocol.js?v=20260702-worker-policy-1",
  "../core/constants.js?v=20260630-js-next-cutover-1",
  "wasm-backend.js?v=20260630-js-next-cutover-1",
  "../core/numerics.js?v=20260630-js-next-cutover-1",
  "../data/colormaps.js?v=20260630-js-next-cutover-1",
  "../data/catalog.js?v=20260630-js-next-cutover-1",
  "fdtd-sim.js?v=20260630-js-next-cutover-1",
  "fdtd-array-state.js?v=20260630-js-next-cutover-1",
  "fdtd-engine-routing.js?v=20260630-js-next-cutover-1",
  "../canvas/canvas-viewport.js?v=20260630-js-next-cutover-1",
  "fdtd-field-state.js?v=20260630-js-next-cutover-1",
  "fdtd-materials.js?v=20260630-js-next-cutover-1",
  "fdtd-field-observables.js?v=20260630-js-next-cutover-1",
  "fdtd-boundaries.js?v=20260630-js-next-cutover-1",
  "fdtd-presets.js?v=20260630-js-next-cutover-1",
  "fdtd-incident-field.js?v=20260630-js-next-cutover-1",
  "fdtd-mode-solver.js?v=20260702-mode-source-1",
  "fdtd-sources.js?v=20260630-js-next-cutover-1",
  "fdtd-analysis-sampling.js?v=20260630-js-next-cutover-1",
  "fdtd-custom-monitors.js?v=20260630-js-next-cutover-1",
  "fdtd-line-diagnostics.js?v=20260630-js-next-cutover-1",
  "fdtd-analysis-observables.js?v=20260630-js-next-cutover-1",
  "fdtd-material-diagnostics.js?v=20260630-js-next-cutover-1",
  "fdtd-diagnostics.js?v=20260630-js-next-cutover-1",
  "fdtd-yee.js?v=20260630-js-next-cutover-1"
);

let sim = null;
let wasmReady = false;
let wasmLoadPromise = null;

function clonePlainState(nextState) {
  return fdtdWorkerClonePlainData(nextState);
}

function collectTransferables(arrays) {
  return fdtdWorkerCollectTransferables(arrays);
}

function collectArrays(names) {
  return fdtdWorkerCollectArrays(sim, names).arrays;
}

function collectProps() {
  return fdtdWorkerCollectProps(sim, { engine: sim?.engineLabel?.() || "JS" });
}

function applyArrays(arrays = {}) {
  fdtdWorkerApplyArrays(sim, arrays);
}

function applyProps(props = {}) {
  fdtdWorkerApplyProps(sim, props);
}

async function ensureWasmBackend() {
  if (wasmReady || !self.WebAssembly || !sim || sim.wasmBackend) return;
  if (!wasmLoadPromise) {
    const wasmUrl = new URL(`../../../${WASM_CORE_URL}`, self.location.href).toString();
    wasmLoadPromise = WasmFdtdBackend.load(wasmUrl)
      .then((backend) => {
        sim.attachWasmBackend(backend);
        wasmReady = true;
      })
      .catch((error) => {
        wasmReady = false;
        throw error;
      });
  }
  await wasmLoadPromise;
}

async function initialize(payload) {
  state = clonePlainState(payload.state);
  normalizeBoundarySides();
  const nx = Math.max(1, Number(payload.nx) || DEFAULT_GRID.nx);
  const ny = Math.max(1, Number(payload.ny) || DEFAULT_GRID.ny);
  sim = new FDTDSim(makeHeadlessCanvas(nx, ny), { nx, ny });
  try {
    await ensureWasmBackend();
  } catch (error) {
    console.warn("Worker WASM backend unavailable; using JavaScript", error);
  }
  applyArrays(payload.arrays);
  applyProps(payload.props);
  return {
    props: collectProps(),
    wasmReady,
  };
}

function stepSimulation(payload) {
  state = clonePlainState(payload.state);
  normalizeBoundarySides();
  const steps = Math.max(1, Math.floor(Number(payload.steps) || 1));
  const startedAt = performance.now();
  for (let i = 0; i < steps; i += 1) sim.step();
  if (payload.measure) sim.measure();
  const elapsedMs = performance.now() - startedAt;
  const arrayNames = payload.fullSync ? FDTD_WORKER_FULL_ARRAYS : fdtdWorkerFrameArrayNames(sim);
  const arrays = collectArrays(arrayNames);
  return {
    steps,
    elapsedMs,
    arrays,
    props: collectProps(),
  };
}

self.onmessage = async (event) => {
  const message = event.data || {};
  try {
    if (message.type === "init") {
      const result = await initialize(message);
      self.postMessage({ type: "ready", requestId: message.requestId, ...result });
      return;
    }
    if (message.type === "step") {
      if (!sim) throw new Error("Worker simulation is not initialized.");
      const result = stepSimulation(message);
      self.postMessage({ type: "stepped", requestId: message.requestId, ...result }, collectTransferables(result.arrays));
      return;
    }
    if (message.type === "sync") {
      if (!sim) throw new Error("Worker simulation is not initialized.");
      const arrays = collectArrays(FDTD_WORKER_FULL_ARRAYS);
      self.postMessage({ type: "synced", requestId: message.requestId, arrays, props: collectProps() }, collectTransferables(arrays));
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId: message.requestId,
      message: error?.message || String(error),
      stack: error?.stack || "",
    });
  }
};
