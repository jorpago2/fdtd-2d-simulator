"use strict";

const WASM_FEATURE_CONDUCTIVITY = 1 << 0;
const WASM_FEATURE_KERR = 1 << 1;
const WASM_FEATURE_SATURABLE_GAIN = 1 << 2;
const WASM_FEATURE_TENSOR_GYRO = 1 << 3;

const WASM_STEP_KERR = 1 << 0;
const WASM_STEP_SATURABLE_GAIN = 1 << 1;
const WASM_STEP_TENSOR_GYRO = 1 << 2;

function wasmAlign4(value) {
  return (value + 3) & ~3;
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
      cursor = wasmAlign4(cursor);
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
    f32("conductivity", n);
    f32("conductivityY", n);
    f32("mu", n);
    f32("muLoss", n);
    f32("muY", n);
    f32("muLossY", n);
    f32("dualEz", n);
    f32("dualEzx", n);
    f32("dualEzy", n);
    f32("dualHx", n);
    f32("dualHy", n);
    u8("material", n);
    u8("nonlinearMaterial", n);
    u8("electricTensorMaterial", n);
    u8("gyrotropicMaterial", n);
    f32("modulationBaseEps", n);
    f32("modulationBaseEpsY", n);
    f32("epsilonXY", n);
    f32("gyrotropyG", n);
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
      totalBytes: wasmAlign4(cursor),
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
    sim.conductivity = new Float32Array(buffer, o.conductivity, n);
    sim.conductivityY = new Float32Array(buffer, o.conductivityY, n);
    sim.mu = new Float32Array(buffer, o.mu, n);
    sim.muLoss = new Float32Array(buffer, o.muLoss, n);
    sim.muY = new Float32Array(buffer, o.muY, n);
    sim.muLossY = new Float32Array(buffer, o.muLossY, n);
    sim.dualEz = new Float32Array(buffer, o.dualEz, n);
    sim.dualEzx = new Float32Array(buffer, o.dualEzx, n);
    sim.dualEzy = new Float32Array(buffer, o.dualEzy, n);
    sim.dualHx = new Float32Array(buffer, o.dualHx, n);
    sim.dualHy = new Float32Array(buffer, o.dualHy, n);
    sim.material = new Uint8Array(buffer, o.material, n);
    sim.nonlinearMaterial = new Uint8Array(buffer, o.nonlinearMaterial, n);
    sim.electricTensorMaterial = new Uint8Array(buffer, o.electricTensorMaterial, n);
    sim.gyrotropicMaterial = new Uint8Array(buffer, o.gyrotropicMaterial, n);
    sim.modulationBaseEps = new Float32Array(buffer, o.modulationBaseEps, n);
    sim.modulationBaseEpsY = new Float32Array(buffer, o.modulationBaseEpsY, n);
    sim.epsilonXY = new Float32Array(buffer, o.epsilonXY, n);
    sim.gyrotropyG = new Float32Array(buffer, o.gyrotropyG, n);
    sim.eCaX = new Float32Array(buffer, o.eCaX, sim.nx);
    sim.eCbX = new Float32Array(buffer, o.eCbX, sim.nx);
    sim.hCaX = new Float32Array(buffer, o.hCaX, sim.nx);
    sim.hCbX = new Float32Array(buffer, o.hCbX, sim.nx);
    sim.eCaY = new Float32Array(buffer, o.eCaY, sim.ny);
    sim.eCbY = new Float32Array(buffer, o.eCbY, sim.ny);
    sim.hCaY = new Float32Array(buffer, o.hCaY, sim.ny);
    sim.hCbY = new Float32Array(buffer, o.hCbY, sim.ny);
  }

  stepWithOffsets(sim, component, offsets) {
    const o = offsets;
    const stepExport = component === "hz" ? this.exports.step_hz : this.exports.step;
    const runtimeFlags = this.stepRuntimeFlags(component);
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
      o.conductivity,
      o.conductivityY,
      o.mu,
      o.muLoss,
      o.muY,
      o.muLossY,
      o.material,
      o.nonlinearMaterial,
      o.electricTensorMaterial,
      o.gyrotropicMaterial,
      o.modulationBaseEps,
      o.modulationBaseEpsY,
      o.epsilonXY,
      o.gyrotropyG,
      o.eCaX,
      o.eCbX,
      o.eCaY,
      o.eCbY,
      o.hCaX,
      o.hCbX,
      o.hCaY,
      o.hCbY,
      runtimeFlags,
      Number(state.kerrChi3) || 0,
      Math.max(0.05, Number(state.kerrSaturation) || 5),
      Math.max(0.05, Number(state.gainSaturation) || 4)
    );
  }

  step(sim) {
    this.stepComponent(sim, state.fieldComponent);
  }

  stepComponent(sim, component) {
    this.stepWithOffsets(sim, component, this.layout.offsets);
  }

  stepDualTm(sim) {
    const o = this.layout.offsets;
    this.stepWithOffsets(sim, "ez", {
      ...o,
      ez: o.dualEz,
      ezx: o.dualEzx,
      ezy: o.dualEzy,
      hx: o.dualHx,
      hy: o.dualHy,
    });
  }

  canStep(component) {
    return component === "hz" ? typeof this.exports.step_hz === "function" : typeof this.exports.step === "function";
  }

  kernelFeatures() {
    return typeof this.exports.kernel_features === "function" ? Number(this.exports.kernel_features()) || 0 : 0;
  }

  supportsFeature(feature) {
    return (this.kernelFeatures() & feature) !== 0;
  }

  supportsConductivity() {
    return this.supportsFeature(WASM_FEATURE_CONDUCTIVITY);
  }

  supportsKerr() {
    return this.supportsFeature(WASM_FEATURE_KERR);
  }

  supportsSaturableGain() {
    return this.supportsFeature(WASM_FEATURE_SATURABLE_GAIN);
  }

  supportsTensorGyro() {
    return this.supportsFeature(WASM_FEATURE_TENSOR_GYRO);
  }

  stepRuntimeFlags(component) {
    let flags = 0;
    if (state.materialNonlinearEnabled && !state.materialModulationEnabled) flags |= WASM_STEP_KERR;
    if (state.materialSaturableGainEnabled) flags |= WASM_STEP_SATURABLE_GAIN;
    if (component === "hz" && state.materialGyrotropyEnabled) flags |= WASM_STEP_TENSOR_GYRO;
    return flags;
  }
}
