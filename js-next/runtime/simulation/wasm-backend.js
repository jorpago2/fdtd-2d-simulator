"use strict";

const WASM_FEATURE_CONDUCTIVITY = 1 << 0;
const WASM_FEATURE_KERR = 1 << 1;
const WASM_FEATURE_SATURABLE_GAIN = 1 << 2;
const WASM_FEATURE_TENSOR_GYRO = 1 << 3;
const WASM_FEATURE_TFSF = 1 << 4;
const WASM_FEATURE_CPML = 1 << 5;
const WASM_FEATURE_MODE_SOURCE = 1 << 6;
const WASM_FEATURE_ELECTRIC_ADE = 1 << 7;

const WASM_STEP_KERR = 1 << 0;
const WASM_STEP_SATURABLE_GAIN = 1 << 1;
const WASM_STEP_TENSOR_GYRO = 1 << 2;
const WASM_STEP_ELECTRIC_ADE = 1 << 3;
const WASM_MAX_TFSF_SOURCES = 32;
const WASM_TFSF_STRIDE = 16;
const WASM_TFSF_SOURCE_TYPE = { sine: 0, gaussian: 1, ricker: 2 };
const WASM_MAX_MODE_SOURCES = 8;
const WASM_MODE_SOURCE_STRIDE = 16;

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
    const { instance } = await WebAssembly.instantiate(bytes, {
      env: {
        memory,
        fdtd_sinf: Math.sin,
        fdtd_expf: Math.exp,
      },
    });
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
    u8("dispersiveMaterial", n);
    u8("dispersionAxes", n);
    f32("modulationBaseEps", n);
    f32("modulationBaseEpsY", n);
    f32("epsilonXY", n);
    f32("gyrotropyG", n);
    f32("dispersionOmegaP", n);
    f32("dispersionGamma", n);
    f32("dispersionOmega0", n);
    f32("dispersionDeltaEps", n);
    f32("dispersionTau", n);
    f32("dispPz", n);
    f32("dispJz", n);
    f32("cpmlKappaEX", nx);
    f32("cpmlKappaHX", nx);
    f32("cpmlKappaEY", ny);
    f32("cpmlKappaHY", ny);
    f32("cpmlAlphaEX", nx);
    f32("cpmlAlphaHX", nx);
    f32("cpmlAlphaEY", ny);
    f32("cpmlAlphaHY", ny);
    f32("cpmlAEX", nx);
    f32("cpmlAHX", nx);
    f32("cpmlAEY", ny);
    f32("cpmlAHY", ny);
    f32("cpmlBEX", nx);
    f32("cpmlBHX", nx);
    f32("cpmlBEY", ny);
    f32("cpmlBHY", ny);
    f32("cpmlPsiHxY", n);
    f32("cpmlPsiHyX", n);
    f32("cpmlPsiEzX", n);
    f32("cpmlPsiEzY", n);
    f32("cpmlPsiExY", n);
    f32("cpmlPsiEyX", n);
    f32("cpmlPsiHzX", n);
    f32("cpmlPsiHzY", n);
    f32("cpmlPsiDualHxY", n);
    f32("cpmlPsiDualHyX", n);
    f32("cpmlPsiDualEzX", n);
    f32("cpmlPsiDualEzY", n);
    f32("tfsfSources", WASM_MAX_TFSF_SOURCES * WASM_TFSF_STRIDE);
    f32("modeSources", WASM_MAX_MODE_SOURCES * WASM_MODE_SOURCE_STRIDE);
    f32("modeProfiles", WASM_MAX_MODE_SOURCES * ny);
    f32("modeEpsilonProfiles", WASM_MAX_MODE_SOURCES * ny);
    f32("modeMuProfiles", WASM_MAX_MODE_SOURCES * ny);

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
    sim.dispersiveMaterial = new Uint8Array(buffer, o.dispersiveMaterial, n);
    sim.dispersionAxes = new Uint8Array(buffer, o.dispersionAxes, n);
    sim.modulationBaseEps = new Float32Array(buffer, o.modulationBaseEps, n);
    sim.modulationBaseEpsY = new Float32Array(buffer, o.modulationBaseEpsY, n);
    sim.epsilonXY = new Float32Array(buffer, o.epsilonXY, n);
    sim.gyrotropyG = new Float32Array(buffer, o.gyrotropyG, n);
    sim.dispersionOmegaP = new Float32Array(buffer, o.dispersionOmegaP, n);
    sim.dispersionGamma = new Float32Array(buffer, o.dispersionGamma, n);
    sim.dispersionOmega0 = new Float32Array(buffer, o.dispersionOmega0, n);
    sim.dispersionDeltaEps = new Float32Array(buffer, o.dispersionDeltaEps, n);
    sim.dispersionTau = new Float32Array(buffer, o.dispersionTau, n);
    sim.dispPz = new Float32Array(buffer, o.dispPz, n);
    sim.dispJz = new Float32Array(buffer, o.dispJz, n);
    sim.cpmlKappaEX = new Float32Array(buffer, o.cpmlKappaEX, sim.nx);
    sim.cpmlKappaHX = new Float32Array(buffer, o.cpmlKappaHX, sim.nx);
    sim.cpmlKappaEY = new Float32Array(buffer, o.cpmlKappaEY, sim.ny);
    sim.cpmlKappaHY = new Float32Array(buffer, o.cpmlKappaHY, sim.ny);
    sim.cpmlAlphaEX = new Float32Array(buffer, o.cpmlAlphaEX, sim.nx);
    sim.cpmlAlphaHX = new Float32Array(buffer, o.cpmlAlphaHX, sim.nx);
    sim.cpmlAlphaEY = new Float32Array(buffer, o.cpmlAlphaEY, sim.ny);
    sim.cpmlAlphaHY = new Float32Array(buffer, o.cpmlAlphaHY, sim.ny);
    sim.cpmlAEX = new Float32Array(buffer, o.cpmlAEX, sim.nx);
    sim.cpmlAHX = new Float32Array(buffer, o.cpmlAHX, sim.nx);
    sim.cpmlAEY = new Float32Array(buffer, o.cpmlAEY, sim.ny);
    sim.cpmlAHY = new Float32Array(buffer, o.cpmlAHY, sim.ny);
    sim.cpmlBEX = new Float32Array(buffer, o.cpmlBEX, sim.nx);
    sim.cpmlBHX = new Float32Array(buffer, o.cpmlBHX, sim.nx);
    sim.cpmlBEY = new Float32Array(buffer, o.cpmlBEY, sim.ny);
    sim.cpmlBHY = new Float32Array(buffer, o.cpmlBHY, sim.ny);
    sim.cpmlPsiHxY = new Float32Array(buffer, o.cpmlPsiHxY, n);
    sim.cpmlPsiHyX = new Float32Array(buffer, o.cpmlPsiHyX, n);
    sim.cpmlPsiEzX = new Float32Array(buffer, o.cpmlPsiEzX, n);
    sim.cpmlPsiEzY = new Float32Array(buffer, o.cpmlPsiEzY, n);
    sim.cpmlPsiExY = new Float32Array(buffer, o.cpmlPsiExY, n);
    sim.cpmlPsiEyX = new Float32Array(buffer, o.cpmlPsiEyX, n);
    sim.cpmlPsiHzX = new Float32Array(buffer, o.cpmlPsiHzX, n);
    sim.cpmlPsiHzY = new Float32Array(buffer, o.cpmlPsiHzY, n);
    sim.cpmlPsiDualHxY = new Float32Array(buffer, o.cpmlPsiDualHxY, n);
    sim.cpmlPsiDualHyX = new Float32Array(buffer, o.cpmlPsiDualHyX, n);
    sim.cpmlPsiDualEzX = new Float32Array(buffer, o.cpmlPsiDualEzX, n);
    sim.cpmlPsiDualEzY = new Float32Array(buffer, o.cpmlPsiDualEzY, n);
    this.tfsfSources = new Float32Array(buffer, o.tfsfSources, WASM_MAX_TFSF_SOURCES * WASM_TFSF_STRIDE);
    this.modeSources = new Float32Array(buffer, o.modeSources, WASM_MAX_MODE_SOURCES * WASM_MODE_SOURCE_STRIDE);
    this.modeProfiles = new Float32Array(buffer, o.modeProfiles, WASM_MAX_MODE_SOURCES * sim.ny);
    this.modeEpsilonProfiles = new Float32Array(buffer, o.modeEpsilonProfiles, WASM_MAX_MODE_SOURCES * sim.ny);
    this.modeMuProfiles = new Float32Array(buffer, o.modeMuProfiles, WASM_MAX_MODE_SOURCES * sim.ny);
  }

  packTfsfSources(sim) {
    if (!this.tfsfSources) return 0;
    this.tfsfSources.fill(0);
    let count = 0;
    const sources = typeof sim.activeSolverSources === "function" ? sim.activeSolverSources() : state.sources;
    for (const source of sources) {
      if (count >= WASM_MAX_TFSF_SOURCES) break;
      if (!sim.isTfsfIncidentSource?.(source)) continue;
      const params = sim.tfsfSourceParams?.(source);
      if (!params) continue;
      const offset = count * WASM_TFSF_STRIDE;
      const type = WASM_TFSF_SOURCE_TYPE[source.type] ?? WASM_TFSF_SOURCE_TYPE.sine;
      this.tfsfSources[offset + 0] = type;
      this.tfsfSources[offset + 1] = params.profileCode;
      this.tfsfSources[offset + 2] = params.sx;
      this.tfsfSources[offset + 3] = params.sy;
      this.tfsfSources[offset + 4] = params.cosTheta;
      this.tfsfSources[offset + 5] = params.sinTheta;
      this.tfsfSources[offset + 6] = params.kCells;
      this.tfsfSources[offset + 7] = params.z;
      this.tfsfSources[offset + 8] = params.x0;
      this.tfsfSources[offset + 9] = params.x1;
      this.tfsfSources[offset + 10] = params.y0;
      this.tfsfSources[offset + 11] = params.y1;
      this.tfsfSources[offset + 12] = source.frequency;
      this.tfsfSources[offset + 13] =
        typeof sim.effectiveSourceAmplitude === "function" ? sim.effectiveSourceAmplitude(source, sim.time) : source.amplitude;
      this.tfsfSources[offset + 14] = ((Number(source.phaseDeg) || 0) * Math.PI) / 180;
      this.tfsfSources[offset + 15] = params.fwhmCells;
      count += 1;
    }
    return count;
  }

  canPackTfsfSources(sim) {
    let count = 0;
    const sources = typeof sim.activeSolverSources === "function" ? sim.activeSolverSources() : state.sources;
    for (const source of sources) {
      if (!sim.isTfsfIncidentSource?.(source)) continue;
      if (!sim.tfsfSourceParams?.(source)) continue;
      count += 1;
      if (count > WASM_MAX_TFSF_SOURCES) return false;
    }
    return true;
  }

  packModeSources(sim) {
    if (!this.modeSources || !this.modeProfiles || !this.modeEpsilonProfiles || !this.modeMuProfiles) return 0;
    this.modeSources.fill(0);
    let count = 0;
    const sources = typeof sim.activeSolverSources === "function" ? sim.activeSolverSources() : state.sources;
    for (const source of sources) {
      if (count >= WASM_MAX_MODE_SOURCES) break;
      if (source?.shape !== "modeProfile") continue;
      const descriptor = sim.modeProfileSourceDescriptor?.(source);
      const length = Math.min(sim.ny, Math.max(0, Math.trunc(Number(descriptor?.profile?.length) || 0)));
      if (!descriptor || length <= 0) continue;
      const descriptorOffset = count * WASM_MODE_SOURCE_STRIDE;
      const profileOffset = count * sim.ny;
      const type = WASM_TFSF_SOURCE_TYPE[source.type] ?? WASM_TFSF_SOURCE_TYPE.sine;
      this.modeSources[descriptorOffset + 0] = type;
      this.modeSources[descriptorOffset + 1] = descriptor.sx;
      this.modeSources[descriptorOffset + 2] = descriptor.y0;
      this.modeSources[descriptorOffset + 3] = length;
      this.modeSources[descriptorOffset + 4] = descriptor.betaCells;
      this.modeSources[descriptorOffset + 5] = descriptor.neff;
      this.modeSources[descriptorOffset + 6] = descriptor.confinementIndexMax || descriptor.neff || 1;
      this.modeSources[descriptorOffset + 7] = source.frequency;
      this.modeSources[descriptorOffset + 8] =
        typeof sim.effectiveSourceAmplitude === "function" ? sim.effectiveSourceAmplitude(source, sim.time) : source.amplitude;
      this.modeSources[descriptorOffset + 9] = ((Number(source.phaseDeg) || 0) * Math.PI) / 180;
      this.modeSources[descriptorOffset + 10] = profileOffset;
      for (let i = 0; i < length; i += 1) {
        const target = profileOffset + i;
        this.modeProfiles[target] = Number(descriptor.profile?.[i]) || 0;
        this.modeEpsilonProfiles[target] = Math.max(1e-6, Number(descriptor.epsilonProfile?.[i]) || 1);
        this.modeMuProfiles[target] = Math.max(1e-6, Number(descriptor.muProfile?.[i]) || 1);
      }
      count += 1;
    }
    return count;
  }

  canPackModeSources(sim) {
    let count = 0;
    const sources = typeof sim.activeSolverSources === "function" ? sim.activeSolverSources() : state.sources;
    for (const source of sources) {
      if (source?.shape !== "modeProfile") continue;
      const descriptor = sim.modeProfileSourceDescriptor?.(source);
      const length = Math.trunc(Number(descriptor?.profile?.length) || 0);
      if (!descriptor || length <= 0 || length > sim.ny) return false;
      count += 1;
      if (count > WASM_MAX_MODE_SOURCES) return false;
    }
    return true;
  }

  stepWithOffsets(sim, component, offsets) {
    const o = offsets;
    const stepExport = component === "hz" ? this.exports.step_hz : this.exports.step;
    const runtimeFlags = this.stepRuntimeFlags(component);
    const tfsfCount = this.supportsTfsf() ? this.packTfsfSources(sim) : 0;
    const modeSourceCount = this.supportsModeSource() ? this.packModeSources(sim) : 0;
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
      o.dispersiveMaterial,
      o.dispersionAxes,
      o.modulationBaseEps,
      o.modulationBaseEpsY,
      o.epsilonXY,
      o.gyrotropyG,
      o.dispersionOmegaP,
      o.dispersionGamma,
      o.dispersionOmega0,
      o.dispersionDeltaEps,
      o.dispersionTau,
      o.dispPz,
      o.dispJz,
      o.cpmlKappaEX,
      o.cpmlKappaHX,
      o.cpmlKappaEY,
      o.cpmlKappaHY,
      o.cpmlAEX,
      o.cpmlAHX,
      o.cpmlAEY,
      o.cpmlAHY,
      o.cpmlBEX,
      o.cpmlBHX,
      o.cpmlBEY,
      o.cpmlBHY,
      o.cpmlPsiHxY,
      o.cpmlPsiHyX,
      o.cpmlPsiEzX,
      o.cpmlPsiEzY,
      o.cpmlPsiExY,
      o.cpmlPsiEyX,
      o.cpmlPsiHzX,
      o.cpmlPsiHzY,
      runtimeFlags,
      Number(state.kerrChi3) || 0,
      Math.max(0.05, Number(state.kerrSaturation) || 5),
      Math.max(0.05, Number(state.gainSaturation) || 4),
      sim.time,
      Number.isFinite(sim.fieldScale) ? sim.fieldScale : 1,
      o.tfsfSources,
      tfsfCount,
      o.modeSources,
      o.modeProfiles,
      o.modeEpsilonProfiles,
      o.modeMuProfiles,
      modeSourceCount
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
      cpmlPsiHxY: o.cpmlPsiDualHxY,
      cpmlPsiHyX: o.cpmlPsiDualHyX,
      cpmlPsiEzX: o.cpmlPsiDualEzX,
      cpmlPsiEzY: o.cpmlPsiDualEzY,
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

  supportsTfsf() {
    return this.supportsFeature(WASM_FEATURE_TFSF);
  }

  supportsCpml() {
    return this.supportsFeature(WASM_FEATURE_CPML);
  }

  supportsModeSource() {
    return this.supportsFeature(WASM_FEATURE_MODE_SOURCE);
  }

  supportsElectricAde() {
    return this.supportsFeature(WASM_FEATURE_ELECTRIC_ADE);
  }

  stepRuntimeFlags(component) {
    let flags = 0;
    if (state.materialNonlinearEnabled && !state.materialModulationEnabled) flags |= WASM_STEP_KERR;
    if (state.materialSaturableGainEnabled) flags |= WASM_STEP_SATURABLE_GAIN;
    if (component === "hz" && state.materialGyrotropyEnabled) flags |= WASM_STEP_TENSOR_GYRO;
    if (component === "ez" && state.materialDispersionEnabled) flags |= WASM_STEP_ELECTRIC_ADE;
    return flags;
  }
}
