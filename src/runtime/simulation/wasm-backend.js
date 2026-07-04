"use strict";

const WASM_FEATURE_CONDUCTIVITY = 1 << 0;
const WASM_FEATURE_KERR = 1 << 1;
const WASM_FEATURE_SATURABLE_GAIN = 1 << 2;
const WASM_FEATURE_TENSOR_GYRO = 1 << 3;
const WASM_FEATURE_TFSF = 1 << 4;
const WASM_FEATURE_CPML = 1 << 5;
const WASM_FEATURE_MODE_SOURCE = 1 << 6;
const WASM_FEATURE_ELECTRIC_ADE = 1 << 7;
const WASM_FEATURE_MAGNETIC_ADE = 1 << 8;
const WASM_FEATURE_MODULATION = 1 << 9;
const WASM_FEATURE_HARMONIC = 1 << 10;
const WASM_FEATURE_PHASE_CHANGE = 1 << 11;
const WASM_FEATURE_BIANISOTROPY = 1 << 12;

const WASM_STEP_KERR = 1 << 0;
const WASM_STEP_SATURABLE_GAIN = 1 << 1;
const WASM_STEP_TENSOR_GYRO = 1 << 2;
const WASM_STEP_ELECTRIC_ADE = 1 << 3;
const WASM_STEP_MAGNETIC_ADE = 1 << 4;
const WASM_STEP_MODULATION = 1 << 5;
const WASM_MAX_TFSF_SOURCES = 32;
const WASM_TFSF_STRIDE = 16;
const WASM_TFSF_SOURCE_TYPE = { sine: 0, gaussian: 1, ricker: 2 };
const WASM_MAX_MODE_SOURCES = 8;
const WASM_MODE_SOURCE_STRIDE = 16;
const WASM_LAYOUT_GROUP_DYNAMIC_MATERIAL = "dynamicMaterial";
const WASM_LAYOUT_GROUP_TENSOR_GYRO = "tensorGyro";
const WASM_LAYOUT_GROUP_ELECTRIC_ADE = "electricAde";
const WASM_LAYOUT_GROUP_MAGNETIC_ADE = "magneticAde";
const WASM_LAYOUT_GROUP_PHASE_CHANGE = "phaseChange";
const WASM_LAYOUT_GROUP_HARMONIC = "harmonic";
const WASM_LAYOUT_GROUP_BIANISOTROPY = "bianisotropy";
const WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY = "fullVectorBianisotropy";

const WASM_STEP_FIELD_OFFSET_NAMES = Object.freeze([
  "ez",
  "ezx",
  "ezy",
  "hx",
  "hy",
  "eps",
  "loss",
  "epsY",
  "lossY",
  "conductivity",
  "conductivityY",
  "mu",
  "muLoss",
  "muY",
  "muLossY",
  "material",
  "modulatedMaterial",
  "modulationPhaseOffset",
  "nonlinearMaterial",
  "electricTensorMaterial",
  "gyrotropicMaterial",
  "dispersiveMaterial",
  "dispersionAxes",
  "dispersionAxisX",
  "dispersionAxisY",
  "modulationBaseEps",
  "modulationBaseEpsY",
  "epsilonXY",
  "gyrotropyG",
  "dispersionOmegaP",
  "dispersionGamma",
  "dispersionOmega0",
  "dispersionDeltaEps",
  "dispersionTau",
  "muDispersiveMaterial",
  "muDispersionAxes",
  "muDispersionOmegaP",
  "muDispersionGamma",
  "muDispersionOmega0",
  "muDispersionDeltaMu",
  "muDispersionTau",
  "dispPz",
  "dispJz",
  "dispPx",
  "dispJx",
  "dispPy",
  "dispJy",
  "magDispMz",
  "magDispJz",
  "magDispMx",
  "magDispJx",
  "magDispMy",
  "magDispJy",
  "cpmlKappaEX",
  "cpmlKappaHX",
  "cpmlKappaEY",
  "cpmlKappaHY",
  "cpmlAEX",
  "cpmlAHX",
  "cpmlAEY",
  "cpmlAHY",
  "cpmlBEX",
  "cpmlBHX",
  "cpmlBEY",
  "cpmlBHY",
  "cpmlPsiHxY",
  "cpmlPsiHyX",
  "cpmlPsiEzX",
  "cpmlPsiEzY",
  "cpmlPsiExY",
  "cpmlPsiEyX",
  "cpmlPsiHzX",
  "cpmlPsiHzY",
]);

const WASM_STEP_RUNTIME_PARAMETER_NAMES = Object.freeze([
  "cpmlLayer",
  "runtimeFlags",
  "kerrChi3",
  "kerrSaturation",
  "gainSaturation",
  "modulationDepth",
  "modulationPeriodCells",
  "modulationCosTheta",
  "modulationSinTheta",
  "modulationOmegaCycles",
  "modulationPhase",
  "time",
  "fieldScale",
]);

const WASM_STEP_SOURCE_OFFSET_NAMES = Object.freeze([
  "tfsfSources",
  "modeSources",
  "modeProfiles",
  "modeEpsilonProfiles",
  "modeMuProfiles",
]);

const WASM_STEP_ARGUMENT_NAMES = Object.freeze([
  "nx",
  "ny",
  "courant",
  ...WASM_STEP_FIELD_OFFSET_NAMES,
  ...WASM_STEP_RUNTIME_PARAMETER_NAMES,
  "tfsfSources",
  "tfsfSourceCount",
  "modeSources",
  "modeProfiles",
  "modeEpsilonProfiles",
  "modeMuProfiles",
  "modeSourceCount",
]);

const WASM_LAYOUT_GROUP_LABELS = Object.freeze({
  [WASM_LAYOUT_GROUP_DYNAMIC_MATERIAL]: "dynamic material",
  [WASM_LAYOUT_GROUP_TENSOR_GYRO]: "tensor/gyrotropic material",
  [WASM_LAYOUT_GROUP_ELECTRIC_ADE]: "electric ADE",
  [WASM_LAYOUT_GROUP_MAGNETIC_ADE]: "magnetic ADE",
  [WASM_LAYOUT_GROUP_PHASE_CHANGE]: "phase change",
  [WASM_LAYOUT_GROUP_HARMONIC]: "harmonic nonlinear",
  [WASM_LAYOUT_GROUP_BIANISOTROPY]: "bianisotropy",
  [WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY]: "full-vector bianisotropy",
});

function wasmAlign4(value) {
  return (value + 3) & ~3;
}

function wasmAlign8(value) {
  return (value + 7) & ~7;
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
        fdtd_cosf: Math.cos,
        fdtd_expf: Math.exp,
      },
    });
    return new WasmFdtdBackend(memory, instance.exports);
  }

  normalizeLayoutGroups(groups) {
    return groups instanceof Set ? new Set(groups) : new Set(Array.isArray(groups) ? groups : []);
  }

  requiredLayoutGroups(sim) {
    const groups = new Set();
    if (
      state.materialModulationEnabled ||
      state.materialNonlinearEnabled ||
      state.materialHarmonicEnabled ||
      state.materialPhaseChangeEnabled
    ) {
      groups.add(WASM_LAYOUT_GROUP_DYNAMIC_MATERIAL);
    }
    if (state.materialGyrotropyEnabled) {
      groups.add(WASM_LAYOUT_GROUP_TENSOR_GYRO);
    }
    if (state.materialDispersionEnabled) {
      groups.add(WASM_LAYOUT_GROUP_ELECTRIC_ADE);
      if (sim?.hasActiveMagneticDispersion?.()) groups.add(WASM_LAYOUT_GROUP_MAGNETIC_ADE);
    }
    if (state.materialPhaseChangeEnabled) {
      groups.add(WASM_LAYOUT_GROUP_PHASE_CHANGE);
    }
    if (state.materialHarmonicEnabled) {
      groups.add(WASM_LAYOUT_GROUP_HARMONIC);
    }
    if (state.materialBianisotropyEnabled) {
      groups.add(WASM_LAYOUT_GROUP_BIANISOTROPY);
      if (sim?.fullVectorBianisotropyActive?.()) groups.add(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY);
    }
    return groups;
  }

  layoutHasGroups(groups) {
    if (!this.layout?.groups) return false;
    for (const group of groups) {
      if (!this.layout.groups.has(group)) return false;
    }
    return true;
  }

  ensureLayoutForCurrentFeatures(sim) {
    const groups = this.requiredLayoutGroups(sim);
    if (this.layoutHasGroups(groups)) return true;
    const previous = sim.snapshotWasmBackendStateArrays?.() || {};
    try {
      this.configure(sim, { groups });
      sim.allocateAuxiliaryArrays?.({ preserveExisting: true });
      sim.restoreWasmBackendStateArrays?.(previous);
      return true;
    } catch (error) {
      const profile = Array.from(groups).map((group) => WASM_LAYOUT_GROUP_LABELS[group] || group).join(", ") || "base";
      console.warn(`WASM FDTD memory profile could not be expanded (${profile}); using JavaScript fallback.`, error);
      return false;
    }
  }

  hasLayoutGroup(group) {
    return Boolean(this.layout?.groups?.has(group));
  }

  hasDynamicMaterialLayout() {
    return this.hasLayoutGroup(WASM_LAYOUT_GROUP_DYNAMIC_MATERIAL);
  }

  hasTensorGyroLayout() {
    return this.hasLayoutGroup(WASM_LAYOUT_GROUP_TENSOR_GYRO);
  }

  hasElectricAdeLayout() {
    return this.hasLayoutGroup(WASM_LAYOUT_GROUP_ELECTRIC_ADE);
  }

  hasMagneticAdeLayout() {
    return this.hasLayoutGroup(WASM_LAYOUT_GROUP_MAGNETIC_ADE);
  }

  hasPhaseChangeLayout() {
    return this.hasLayoutGroup(WASM_LAYOUT_GROUP_PHASE_CHANGE);
  }

  hasHarmonicLayout() {
    return this.hasLayoutGroup(WASM_LAYOUT_GROUP_HARMONIC);
  }

  hasBianisotropyLayout() {
    return this.hasLayoutGroup(WASM_LAYOUT_GROUP_BIANISOTROPY);
  }

  hasFullVectorBianisotropyLayout() {
    return this.hasLayoutGroup(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY);
  }

  createLayout(nx, ny, options = {}) {
    const groups = this.normalizeLayoutGroups(options.groups);
    const offsets = {};
    const allocated = {};
    let cursor = 0;
    const f32 = (name, length) => {
      cursor = wasmAlign4(cursor);
      offsets[name] = cursor;
      allocated[name] = true;
      cursor += length * Float32Array.BYTES_PER_ELEMENT;
    };
    const f64 = (name, length) => {
      cursor = wasmAlign8(cursor);
      offsets[name] = cursor;
      allocated[name] = true;
      cursor += length * Float64Array.BYTES_PER_ELEMENT;
    };
    const u8 = (name, length) => {
      offsets[name] = cursor;
      allocated[name] = true;
      cursor += length;
    };
    const optionalF32 = (group, name, length) => {
      if (groups.has(group)) f32(name, length);
      else offsets[name] = offsets.__dummyF32;
    };
    const optionalU8 = (group, name, length) => {
      if (groups.has(group)) u8(name, length);
      else offsets[name] = offsets.__dummyU8;
    };

    const n = nx * ny;
    f32("__dummyF32", n);
    u8("__dummyU8", n);
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
    optionalF32(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY, "dualEz", n);
    optionalF32(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY, "dualEzx", n);
    optionalF32(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY, "dualEzy", n);
    optionalF32(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY, "dualHx", n);
    optionalF32(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY, "dualHy", n);
    optionalU8(WASM_LAYOUT_GROUP_BIANISOTROPY, "bianisotropicMaterial", n);
    optionalF32(WASM_LAYOUT_GROUP_BIANISOTROPY, "bianisotropyKappa", n);
    optionalF32(WASM_LAYOUT_GROUP_BIANISOTROPY, "bianisotropyPrevScalar", n);
    optionalF32(WASM_LAYOUT_GROUP_BIANISOTROPY, "bianisotropyPrevSplitX", n);
    optionalF32(WASM_LAYOUT_GROUP_BIANISOTROPY, "bianisotropyPrevSplitY", n);
    optionalF32(WASM_LAYOUT_GROUP_BIANISOTROPY, "bianisotropyPrevTx", n);
    optionalF32(WASM_LAYOUT_GROUP_BIANISOTROPY, "bianisotropyPrevTy", n);
    optionalF32(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY, "bianisotropyPrevDualEz", n);
    optionalF32(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY, "bianisotropyPrevDualEzx", n);
    optionalF32(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY, "bianisotropyPrevDualEzy", n);
    optionalF32(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY, "bianisotropyPrevDualHx", n);
    optionalF32(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY, "bianisotropyPrevDualHy", n);
    u8("material", n);
    optionalU8(WASM_LAYOUT_GROUP_DYNAMIC_MATERIAL, "modulatedMaterial", n);
    optionalF32(WASM_LAYOUT_GROUP_DYNAMIC_MATERIAL, "modulationPhaseOffset", n);
    optionalU8(WASM_LAYOUT_GROUP_DYNAMIC_MATERIAL, "nonlinearMaterial", n);
    optionalU8(WASM_LAYOUT_GROUP_TENSOR_GYRO, "electricTensorMaterial", n);
    optionalU8(WASM_LAYOUT_GROUP_TENSOR_GYRO, "gyrotropicMaterial", n);
    optionalU8(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispersiveMaterial", n);
    optionalU8(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispersionAxes", n);
    optionalF32(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispersionAxisX", n);
    optionalF32(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispersionAxisY", n);
    optionalF32(WASM_LAYOUT_GROUP_DYNAMIC_MATERIAL, "modulationBaseEps", n);
    optionalF32(WASM_LAYOUT_GROUP_DYNAMIC_MATERIAL, "modulationBaseEpsY", n);
    optionalU8(WASM_LAYOUT_GROUP_PHASE_CHANGE, "phaseChangeMaterial", n);
    optionalF32(WASM_LAYOUT_GROUP_PHASE_CHANGE, "phaseState", n);
    optionalF32(WASM_LAYOUT_GROUP_PHASE_CHANGE, "phaseEpsOff", n);
    optionalF32(WASM_LAYOUT_GROUP_PHASE_CHANGE, "phaseLossOff", n);
    optionalF32(WASM_LAYOUT_GROUP_PHASE_CHANGE, "phaseEpsYOff", n);
    optionalF32(WASM_LAYOUT_GROUP_PHASE_CHANGE, "phaseLossYOff", n);
    optionalF32(WASM_LAYOUT_GROUP_PHASE_CHANGE, "phaseEpsOn", n);
    optionalF32(WASM_LAYOUT_GROUP_PHASE_CHANGE, "phaseLossOn", n);
    optionalF32(WASM_LAYOUT_GROUP_PHASE_CHANGE, "phaseEpsYOn", n);
    optionalF32(WASM_LAYOUT_GROUP_PHASE_CHANGE, "phaseLossYOn", n);
    optionalF32(WASM_LAYOUT_GROUP_TENSOR_GYRO, "epsilonXY", n);
    optionalF32(WASM_LAYOUT_GROUP_TENSOR_GYRO, "gyrotropyG", n);
    optionalF32(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispersionOmegaP", n);
    optionalF32(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispersionGamma", n);
    optionalF32(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispersionOmega0", n);
    optionalF32(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispersionDeltaEps", n);
    optionalF32(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispersionTau", n);
    optionalU8(WASM_LAYOUT_GROUP_MAGNETIC_ADE, "muDispersiveMaterial", n);
    optionalU8(WASM_LAYOUT_GROUP_MAGNETIC_ADE, "muDispersionAxes", n);
    optionalF32(WASM_LAYOUT_GROUP_MAGNETIC_ADE, "muDispersionOmegaP", n);
    optionalF32(WASM_LAYOUT_GROUP_MAGNETIC_ADE, "muDispersionGamma", n);
    optionalF32(WASM_LAYOUT_GROUP_MAGNETIC_ADE, "muDispersionOmega0", n);
    optionalF32(WASM_LAYOUT_GROUP_MAGNETIC_ADE, "muDispersionDeltaMu", n);
    optionalF32(WASM_LAYOUT_GROUP_MAGNETIC_ADE, "muDispersionTau", n);
    optionalF32(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispPz", n);
    optionalF32(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispJz", n);
    optionalF32(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispPx", n);
    optionalF32(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispJx", n);
    optionalF32(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispPy", n);
    optionalF32(WASM_LAYOUT_GROUP_ELECTRIC_ADE, "dispJy", n);
    optionalF32(WASM_LAYOUT_GROUP_MAGNETIC_ADE, "magDispMz", n);
    optionalF32(WASM_LAYOUT_GROUP_MAGNETIC_ADE, "magDispJz", n);
    optionalF32(WASM_LAYOUT_GROUP_MAGNETIC_ADE, "magDispMx", n);
    optionalF32(WASM_LAYOUT_GROUP_MAGNETIC_ADE, "magDispJx", n);
    optionalF32(WASM_LAYOUT_GROUP_MAGNETIC_ADE, "magDispMy", n);
    optionalF32(WASM_LAYOUT_GROUP_MAGNETIC_ADE, "magDispJy", n);
    optionalF32(WASM_LAYOUT_GROUP_HARMONIC, "harmonicPrevPz", n);
    optionalF32(WASM_LAYOUT_GROUP_HARMONIC, "harmonicPrevPx", n);
    optionalF32(WASM_LAYOUT_GROUP_HARMONIC, "harmonicPrevPy", n);
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
    optionalF32(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY, "cpmlPsiDualHxY", n);
    optionalF32(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY, "cpmlPsiDualHyX", n);
    optionalF32(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY, "cpmlPsiDualEzX", n);
    optionalF32(WASM_LAYOUT_GROUP_FULL_VECTOR_BIANISOTROPY, "cpmlPsiDualEzY", n);
    f32("tfsfSources", WASM_MAX_TFSF_SOURCES * WASM_TFSF_STRIDE);
    f32("modeSources", WASM_MAX_MODE_SOURCES * WASM_MODE_SOURCE_STRIDE);
    f32("modeProfiles", WASM_MAX_MODE_SOURCES * ny);
    f32("modeEpsilonProfiles", WASM_MAX_MODE_SOURCES * ny);
    f32("modeMuProfiles", WASM_MAX_MODE_SOURCES * ny);
    f64("measureStats", 2);

    return {
      offsets,
      allocated,
      groups,
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

  configure(sim, options = {}) {
    const groups = options.groups ? this.normalizeLayoutGroups(options.groups) : this.requiredLayoutGroups(sim);
    const layout = this.createLayout(sim.nx, sim.ny, { groups });
    this.ensureCapacity(layout.totalBytes);
    this.layout = layout;
    const buffer = this.memory.buffer;
    const n = sim.n;
    const o = layout.offsets;
    const allocated = layout.allocated;
    const bindF32 = (name, length = n) => {
      if (allocated[name]) {
        sim[name] = new Float32Array(buffer, o[name], length);
      } else if (!(sim[name] instanceof Float32Array) || sim[name].length !== length || sim[name].buffer === buffer) {
        sim[name] = new Float32Array(length);
      }
    };
    const bindU8 = (name, length = n) => {
      if (allocated[name]) {
        sim[name] = new Uint8Array(buffer, o[name], length);
      } else if (!(sim[name] instanceof Uint8Array) || sim[name].length !== length || sim[name].buffer === buffer) {
        sim[name] = new Uint8Array(length);
      }
    };

    bindF32("ez");
    bindF32("ezx");
    bindF32("ezy");
    bindF32("hx");
    bindF32("hy");
    bindF32("eps");
    bindF32("loss");
    bindF32("epsY");
    bindF32("lossY");
    bindF32("conductivity");
    bindF32("conductivityY");
    bindF32("mu");
    bindF32("muLoss");
    bindF32("muY");
    bindF32("muLossY");
    bindF32("dualEz");
    bindF32("dualEzx");
    bindF32("dualEzy");
    bindF32("dualHx");
    bindF32("dualHy");
    bindU8("bianisotropicMaterial");
    bindF32("bianisotropyKappa");
    bindF32("bianisotropyPrevScalar");
    bindF32("bianisotropyPrevSplitX");
    bindF32("bianisotropyPrevSplitY");
    bindF32("bianisotropyPrevTx");
    bindF32("bianisotropyPrevTy");
    bindF32("bianisotropyPrevDualEz");
    bindF32("bianisotropyPrevDualEzx");
    bindF32("bianisotropyPrevDualEzy");
    bindF32("bianisotropyPrevDualHx");
    bindF32("bianisotropyPrevDualHy");
    bindU8("material");
    bindU8("modulatedMaterial");
    bindF32("modulationPhaseOffset");
    bindU8("nonlinearMaterial");
    bindU8("electricTensorMaterial");
    bindU8("gyrotropicMaterial");
    bindU8("dispersiveMaterial");
    bindU8("dispersionAxes");
    bindF32("dispersionAxisX");
    bindF32("dispersionAxisY");
    bindF32("modulationBaseEps");
    bindF32("modulationBaseEpsY");
    bindU8("phaseChangeMaterial");
    bindF32("phaseState");
    bindF32("phaseEpsOff");
    bindF32("phaseLossOff");
    bindF32("phaseEpsYOff");
    bindF32("phaseLossYOff");
    bindF32("phaseEpsOn");
    bindF32("phaseLossOn");
    bindF32("phaseEpsYOn");
    bindF32("phaseLossYOn");
    bindF32("epsilonXY");
    bindF32("gyrotropyG");
    bindF32("dispersionOmegaP");
    bindF32("dispersionGamma");
    bindF32("dispersionOmega0");
    bindF32("dispersionDeltaEps");
    bindF32("dispersionTau");
    bindU8("muDispersiveMaterial");
    bindU8("muDispersionAxes");
    bindF32("muDispersionOmegaP");
    bindF32("muDispersionGamma");
    bindF32("muDispersionOmega0");
    bindF32("muDispersionDeltaMu");
    bindF32("muDispersionTau");
    bindF32("dispPz");
    bindF32("dispJz");
    bindF32("dispPx");
    bindF32("dispJx");
    bindF32("dispPy");
    bindF32("dispJy");
    bindF32("magDispMz");
    bindF32("magDispJz");
    bindF32("magDispMx");
    bindF32("magDispJx");
    bindF32("magDispMy");
    bindF32("magDispJy");
    bindF32("harmonicPrevPz");
    bindF32("harmonicPrevPx");
    bindF32("harmonicPrevPy");
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
    bindF32("cpmlPsiDualHxY");
    bindF32("cpmlPsiDualHyX");
    bindF32("cpmlPsiDualEzX");
    bindF32("cpmlPsiDualEzY");
    this.tfsfSources = new Float32Array(buffer, o.tfsfSources, WASM_MAX_TFSF_SOURCES * WASM_TFSF_STRIDE);
    this.modeSources = new Float32Array(buffer, o.modeSources, WASM_MAX_MODE_SOURCES * WASM_MODE_SOURCE_STRIDE);
    this.modeProfiles = new Float32Array(buffer, o.modeProfiles, WASM_MAX_MODE_SOURCES * sim.ny);
    this.modeEpsilonProfiles = new Float32Array(buffer, o.modeEpsilonProfiles, WASM_MAX_MODE_SOURCES * sim.ny);
    this.modeMuProfiles = new Float32Array(buffer, o.modeMuProfiles, WASM_MAX_MODE_SOURCES * sim.ny);
    this.measureStats = new Float64Array(buffer, o.measureStats, 2);
  }

  measureMode() {
    if (state.viewMode === "poynting") {
      if (state.fieldDisplay === "transverseX") return 6;
      if (state.fieldDisplay === "transverseY") return 7;
      return 5;
    }
    if (state.fieldDisplay === "transverseX") return 1;
    if (state.fieldDisplay === "transverseY") return 2;
    if (state.fieldDisplay === "electricMag") return 3;
    if (state.fieldDisplay === "magneticMag") return 4;
    return 0;
  }

  measureField(sim) {
    if (typeof this.exports.measure_field !== "function" || !this.layout?.offsets || !this.measureStats) return null;
    const fullVector = Boolean(sim.fullVectorBianisotropyActive?.());
    if (fullVector && !this.hasFullVectorBianisotropyLayout()) return null;
    const o = this.layout.offsets;
    this.exports.measure_field(
      sim.n,
      this.measureMode(),
      state.fieldComponent === "hz" ? 1 : 0,
      fullVector ? 1 : 0,
      o.ez,
      o.hx,
      o.hy,
      o.dualEz,
      o.dualHx,
      o.dualHy,
      o.measureStats
    );
    return {
      maxAbs: this.measureStats[0],
      energy: this.measureStats[1],
    };
  }

  renormalizeFields(sim) {
    if (typeof this.exports.renormalize_fields !== "function" || !this.layout?.offsets || !this.measureStats) return false;
    const includeBianisotropy = Boolean(state.materialBianisotropyEnabled);
    const includeFullVector = Boolean(sim.fullVectorBianisotropyActive?.());
    if (includeBianisotropy && !this.hasBianisotropyLayout()) return false;
    if (includeFullVector && !this.hasFullVectorBianisotropyLayout()) return false;
    const o = this.layout.offsets;
    this.exports.renormalize_fields(
      sim.n,
      includeBianisotropy ? 1 : 0,
      includeFullVector ? 1 : 0,
      o.ez,
      o.ezx,
      o.ezy,
      o.hx,
      o.hy,
      o.cpmlPsiHxY,
      o.cpmlPsiHyX,
      o.cpmlPsiEzX,
      o.cpmlPsiEzY,
      o.cpmlPsiExY,
      o.cpmlPsiEyX,
      o.cpmlPsiHzX,
      o.cpmlPsiHzY,
      o.cpmlPsiDualHxY,
      o.cpmlPsiDualHyX,
      o.cpmlPsiDualEzX,
      o.cpmlPsiDualEzY,
      o.dualEz,
      o.dualEzx,
      o.dualEzy,
      o.dualHx,
      o.dualHy,
      o.bianisotropyPrevScalar,
      o.bianisotropyPrevSplitX,
      o.bianisotropyPrevSplitY,
      o.bianisotropyPrevTx,
      o.bianisotropyPrevTy,
      o.bianisotropyPrevDualEz,
      o.bianisotropyPrevDualEzx,
      o.bianisotropyPrevDualEzy,
      o.bianisotropyPrevDualHx,
      o.bianisotropyPrevDualHy,
      FIELD_RENORMALIZE_HIGH,
      FIELD_RENORMALIZE_TARGET,
      o.measureStats
    );
    const factor = Number(this.measureStats[0]) || 0;
    if (factor < 0) {
      sim.resetFields();
      sim.lastDiverged = true;
      return true;
    }
    if (factor > 0) {
      sim.setFieldLog10Scale(sim.fieldLog10Scale + Math.log10(factor));
      sim.renormalizedCount += 1;
      sim.lastRenormalized = true;
      return true;
    }
    sim.lastRenormalized = false;
    return true;
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

  solverPhaseStart() {
    const perf = typeof window !== "undefined" ? window.fdtdPerformance : null;
    return perf?.now ? perf.now() : null;
  }

  recordSolverPhase(name, startedAt) {
    const perf = typeof window !== "undefined" ? window.fdtdPerformance : null;
    if (!perf?.record || !perf?.now || startedAt == null) return;
    perf.record(name, perf.now() - startedAt);
  }

  validateStepKernelOffsets(offsets) {
    const requiredNames = [...WASM_STEP_FIELD_OFFSET_NAMES, ...WASM_STEP_SOURCE_OFFSET_NAMES];
    const missing = requiredNames.filter((name) => {
      const value = offsets?.[name];
      return !Number.isFinite(value) || value < 0;
    });
    if (missing.length > 0) {
      throw new Error(`WASM step layout is missing offset(s): ${missing.join(", ")}`);
    }
  }

  validateStepKernelArguments(args) {
    if (args.length !== WASM_STEP_ARGUMENT_NAMES.length) {
      throw new Error(`WASM step argument count mismatch: JS has ${args.length}, schema has ${WASM_STEP_ARGUMENT_NAMES.length}.`);
    }
    const invalid = [];
    args.forEach((value, index) => {
      if (!Number.isFinite(value)) invalid.push(WASM_STEP_ARGUMENT_NAMES[index] || `arg${index}`);
    });
    if (invalid.length > 0) {
      throw new Error(`WASM step argument(s) are not finite: ${invalid.join(", ")}`);
    }
  }

  buildStepKernelArguments(sim, offsets, parameters) {
    const args = [
      sim.nx,
      sim.ny,
      sim.courant,
      ...WASM_STEP_FIELD_OFFSET_NAMES.map((name) => offsets[name]),
      parameters.cpmlLayer,
      parameters.runtimeFlags,
      parameters.kerrChi3,
      parameters.kerrSaturation,
      parameters.gainSaturation,
      parameters.modulationDepth,
      parameters.modulationPeriodCells,
      parameters.modulationCosTheta,
      parameters.modulationSinTheta,
      parameters.modulationOmegaCycles,
      parameters.modulationPhase,
      parameters.time,
      parameters.fieldScale,
      offsets.tfsfSources,
      parameters.tfsfSourceCount,
      offsets.modeSources,
      offsets.modeProfiles,
      offsets.modeEpsilonProfiles,
      offsets.modeMuProfiles,
      parameters.modeSourceCount,
    ];
    this.validateStepKernelArguments(args);
    return args;
  }

  stepWithOffsets(sim, component, offsets, options = {}) {
    const o = offsets;
    const stepExport = component === "hz" ? this.exports.step_hz : this.exports.step;
    const runtimeFlags = this.stepRuntimeFlags(component, sim);
    const modulationDepth = state.materialModulationEnabled ? Math.min(0.95, Math.max(0, Number(state.modulationDepth) || 0)) : 0;
    const modulationPeriodCells = Math.max(1, Math.round(Math.max(0.1, Number(state.modulationPeriodLambda) || 0.1) * Math.max(1, Number(state.cellsPerWavelength) || 1)));
    const modulationTheta = ((Number(state.modulationAngleDeg) || 0) * Math.PI) / 180;
    const modulationPhase = ((Number(state.modulationPhaseDeg) || 0) * Math.PI) / 180;
    const includeSources = options.includeSources !== false;
    this.validateStepKernelOffsets(o);
    let phaseStartedAt = this.solverPhaseStart();
    const tfsfSourceCount = includeSources && this.supportsTfsf() ? this.packTfsfSources(sim) : 0;
    const modeSourceCount = includeSources && this.supportsModeSource() ? this.packModeSources(sim) : 0;
    this.recordSolverPhase("solverSourcePackMs", phaseStartedAt);
    const args = this.buildStepKernelArguments(sim, o, {
      cpmlLayer: Math.max(0, Math.trunc(Number(sim.cpmlLayer) || 0)),
      runtimeFlags,
      kerrChi3: Number(state.kerrChi3) || 0,
      kerrSaturation: Math.max(0.05, Number(state.kerrSaturation) || 5),
      gainSaturation: Math.max(0.05, Number(state.gainSaturation) || 4),
      modulationDepth,
      modulationPeriodCells,
      modulationCosTheta: Math.cos(modulationTheta),
      modulationSinTheta: Math.sin(modulationTheta),
      modulationOmegaCycles: Number(state.modulationFrequency) || 0,
      modulationPhase,
      time: sim.time,
      fieldScale: Number.isFinite(sim.fieldScale) ? sim.fieldScale : 1,
      tfsfSourceCount,
      modeSourceCount,
    });
    phaseStartedAt = this.solverPhaseStart();
    try {
      stepExport(...args);
    } finally {
      this.recordSolverPhase("solverWasmKernelMs", phaseStartedAt);
    }
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
    }, { includeSources: false });
  }

  applyPhaseChangeResponse(sim) {
    if (typeof this.exports.apply_phase_change_response !== "function" || !this.layout?.offsets) return false;
    const o = this.layout.offsets;
    this.exports.apply_phase_change_response(
      sim.nx,
      sim.ny,
      state.fieldComponent === "hz" ? 1 : 0,
      o.ez,
      o.hx,
      o.hy,
      o.eps,
      o.loss,
      o.epsY,
      o.lossY,
      o.material,
      o.modulatedMaterial,
      o.nonlinearMaterial,
      o.modulationBaseEps,
      o.modulationBaseEpsY,
      o.phaseChangeMaterial,
      o.phaseState,
      o.phaseEpsOff,
      o.phaseLossOff,
      o.phaseEpsYOff,
      o.phaseLossYOff,
      o.phaseEpsOn,
      o.phaseLossOn,
      o.phaseEpsYOn,
      o.phaseLossYOn,
      Math.max(0, Number(state.phaseThresholdOn) || 0),
      Math.max(0, Number(state.phaseThresholdOff) || 0),
      Math.max(1, Number(state.phaseTauOn) || 18),
      Math.max(1, Number(state.phaseTauOff) || 180),
      Number.isFinite(sim.fieldScale) ? sim.fieldScale : 1
    );
    return true;
  }

  applyHarmonicNonlinearResponse(sim) {
    if (typeof this.exports.apply_harmonic_nonlinear_response !== "function" || !this.layout?.offsets) return false;
    const o = this.layout.offsets;
    this.exports.apply_harmonic_nonlinear_response(
      sim.nx,
      sim.ny,
      state.fieldComponent === "hz" ? 1 : 0,
      sim.courant,
      o.ez,
      o.ezx,
      o.ezy,
      o.hx,
      o.hy,
      o.eps,
      o.epsY,
      o.material,
      o.nonlinearMaterial,
      o.harmonicPrevPz,
      o.harmonicPrevPx,
      o.harmonicPrevPy,
      Number(state.harmonicChi2) || 0,
      Number(state.harmonicChi3) || 0,
      Math.max(0.05, Number(state.harmonicSaturation) || 6),
      Number.isFinite(sim.fieldScale) ? sim.fieldScale : 1
    );
    return true;
  }

  applyBianisotropicResponse(sim) {
    if (typeof this.exports.apply_bianisotropic_response !== "function" || !this.layout?.offsets) return false;
    const o = this.layout.offsets;
    this.exports.apply_bianisotropic_response(
      sim.n,
      state.fieldComponent === "hz" ? 1 : 0,
      sim.fullVectorBianisotropyActive?.() ? 1 : 0,
      o.ez,
      o.ezx,
      o.ezy,
      o.hx,
      o.hy,
      o.dualEz,
      o.dualEzx,
      o.dualEzy,
      o.dualHx,
      o.dualHy,
      o.eps,
      o.epsY,
      o.mu,
      o.muY,
      o.material,
      o.bianisotropicMaterial,
      o.bianisotropyKappa,
      o.bianisotropyPrevScalar,
      o.bianisotropyPrevSplitX,
      o.bianisotropyPrevSplitY,
      o.bianisotropyPrevTx,
      o.bianisotropyPrevTy,
      o.bianisotropyPrevDualEz,
      o.bianisotropyPrevDualEzx,
      o.bianisotropyPrevDualEzy,
      o.bianisotropyPrevDualHx,
      o.bianisotropyPrevDualHy,
      Number(BIANISOTROPY_KAPPA_LIMIT) || 0.85
    );
    return true;
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

  supportsMagneticAde() {
    return this.supportsFeature(WASM_FEATURE_MAGNETIC_ADE);
  }

  supportsModulation() {
    return this.supportsFeature(WASM_FEATURE_MODULATION);
  }

  supportsHarmonic() {
    return this.supportsFeature(WASM_FEATURE_HARMONIC) && typeof this.exports.apply_harmonic_nonlinear_response === "function";
  }

  supportsPhaseChange() {
    return this.supportsFeature(WASM_FEATURE_PHASE_CHANGE) && typeof this.exports.apply_phase_change_response === "function";
  }

  supportsBianisotropy() {
    return this.supportsFeature(WASM_FEATURE_BIANISOTROPY) && typeof this.exports.apply_bianisotropic_response === "function";
  }

  stepRuntimeFlags(component, sim = null) {
    let flags = 0;
    if (state.materialNonlinearEnabled) flags |= WASM_STEP_KERR;
    if (state.materialModulationEnabled) flags |= WASM_STEP_MODULATION;
    if (state.materialSaturableGainEnabled) flags |= WASM_STEP_SATURABLE_GAIN;
    if (component === "hz" && state.materialGyrotropyEnabled) flags |= WASM_STEP_TENSOR_GYRO;
    if (state.materialDispersionEnabled) {
      flags |= WASM_STEP_ELECTRIC_ADE;
      if (sim?.hasActiveMagneticDispersion?.()) flags |= WASM_STEP_MAGNETIC_ADE;
    }
    return flags;
  }
}
