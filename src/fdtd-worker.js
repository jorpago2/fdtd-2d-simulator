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
  "fdtd-worker-protocol.js",
  "constants.js",
  "wasm-backend.js",
  "numerics.js",
  "colormaps.js",
  "catalog.js",
  "fdtd-sim.js",
  "fdtd-materials.js",
  "fdtd-boundaries.js",
  "fdtd-presets.js",
  "fdtd-sources.js",
  "fdtd-diagnostics.js",
  "fdtd-yee.js",
);

let sim = null;
let wasmReady = false;
let wasmLoadPromise = null;

function clonePlainState(nextState) {
  return JSON.parse(JSON.stringify(nextState || {}));
}

function collectTransferables(arrays) {
  const buffers = new Set();
  for (const array of Object.values(arrays)) {
    if (array?.buffer?.byteLength) buffers.add(array.buffer);
  }
  return Array.from(buffers);
}

function collectArrays(names) {
  const arrays = {};
  for (const name of names) {
    const source = sim?.[name];
    if (!source || typeof source.length !== "number") continue;
    arrays[name] = new source.constructor(source);
  }
  return arrays;
}

function collectProps() {
  const props = {};
  for (const name of FDTD_WORKER_SCALAR_PROPS) {
    const value = sim?.[name];
    if (typeof value !== "undefined") props[name] = value;
  }
  props.engine = sim?.engineLabel?.() || "JS";
  props.diagnosticPhasors = sim?.diagnosticPhasors ? JSON.parse(JSON.stringify(sim.diagnosticPhasors)) : null;
  props.diagnosticDftSummary = sim?.diagnosticDftSummary ? JSON.parse(JSON.stringify(sim.diagnosticDftSummary)) : null;
  props.analysisMetrics = sim?.analysisMetrics ? JSON.parse(JSON.stringify(sim.analysisMetrics)) : null;
  return props;
}

function applyArrays(arrays = {}) {
  for (const [name, source] of Object.entries(arrays)) {
    const target = sim?.[name];
    if (!target || typeof target.set !== "function" || target.length !== source.length) continue;
    target.set(source);
  }
}

function applyProps(props = {}) {
  for (const name of FDTD_WORKER_SCALAR_PROPS) {
    if (Object.prototype.hasOwnProperty.call(props, name)) sim[name] = props[name];
  }
  if (props.diagnosticPhasors) sim.diagnosticPhasors = props.diagnosticPhasors;
  if (props.diagnosticDftSummary) sim.diagnosticDftSummary = props.diagnosticDftSummary;
  if (props.analysisMetrics) sim.analysisMetrics = props.analysisMetrics;
}

async function ensureWasmBackend() {
  if (wasmReady || !self.WebAssembly || !sim || sim.wasmBackend) return;
  if (!wasmLoadPromise) {
    const wasmUrl = new URL(`../${WASM_CORE_URL}`, self.location.href).toString();
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
  const arrayNames = payload.fullSync ? FDTD_WORKER_FULL_ARRAYS : FDTD_WORKER_FRAME_ARRAYS;
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
