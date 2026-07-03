(function initFdtdArrayState(global) {
  "use strict";

  const LENGTH_BY_GRID_AXIS = {
    n: (sim) => sim.n,
    nx: (sim) => sim.nx,
    ny: (sim) => sim.ny,
  };

  const JS_CORE_ARRAY_SPECS = Object.freeze([
    ["ez", Float32Array, "n"],
    ["ezx", Float32Array, "n"],
    ["ezy", Float32Array, "n"],
    ["hx", Float32Array, "n"],
    ["hy", Float32Array, "n"],
    ["eps", Float32Array, "n"],
    ["loss", Float32Array, "n"],
    ["epsY", Float32Array, "n"],
    ["lossY", Float32Array, "n"],
    ["conductivity", Float32Array, "n"],
    ["conductivityY", Float32Array, "n"],
    ["mu", Float32Array, "n"],
    ["muLoss", Float32Array, "n"],
    ["muY", Float32Array, "n"],
    ["muLossY", Float32Array, "n"],
    ["material", Uint8Array, "n"],
    ["nonlinearMaterial", Uint8Array, "n"],
    ["electricTensorMaterial", Uint8Array, "n"],
    ["gyrotropicMaterial", Uint8Array, "n"],
    ["modulationBaseEps", Float32Array, "n"],
    ["modulationBaseEpsY", Float32Array, "n"],
    ["epsilonXY", Float32Array, "n"],
    ["gyrotropyG", Float32Array, "n"],
    ["cpmlKappaEX", Float32Array, "nx"],
    ["cpmlKappaHX", Float32Array, "nx"],
    ["cpmlKappaEY", Float32Array, "ny"],
    ["cpmlKappaHY", Float32Array, "ny"],
    ["cpmlAlphaEX", Float32Array, "nx"],
    ["cpmlAlphaHX", Float32Array, "nx"],
    ["cpmlAlphaEY", Float32Array, "ny"],
    ["cpmlAlphaHY", Float32Array, "ny"],
    ["cpmlAEX", Float32Array, "nx"],
    ["cpmlAHX", Float32Array, "nx"],
    ["cpmlAEY", Float32Array, "ny"],
    ["cpmlAHY", Float32Array, "ny"],
    ["cpmlBEX", Float32Array, "nx"],
    ["cpmlBHX", Float32Array, "nx"],
    ["cpmlBEY", Float32Array, "ny"],
    ["cpmlBHY", Float32Array, "ny"],
    ["cpmlPsiHxY", Float32Array, "n"],
    ["cpmlPsiHyX", Float32Array, "n"],
    ["cpmlPsiEzX", Float32Array, "n"],
    ["cpmlPsiEzY", Float32Array, "n"],
    ["cpmlPsiExY", Float32Array, "n"],
    ["cpmlPsiEyX", Float32Array, "n"],
    ["cpmlPsiHzX", Float32Array, "n"],
    ["cpmlPsiHzY", Float32Array, "n"],
    ["cpmlPsiDualHxY", Float32Array, "n"],
    ["cpmlPsiDualHyX", Float32Array, "n"],
    ["cpmlPsiDualEzX", Float32Array, "n"],
    ["cpmlPsiDualEzY", Float32Array, "n"],
  ]);

  const AUXILIARY_ARRAY_SPECS = Object.freeze([
    ["modulatedMaterial", Uint8Array, "n"],
    ["modulationPhaseOffset", Float32Array, "n"],
    ["dispersiveMaterial", Uint8Array, "n"],
    ["dispersionAxes", Uint8Array, "n"],
    ["dispersionAxisX", Float32Array, "n"],
    ["dispersionAxisY", Float32Array, "n"],
    ["bianisotropicMaterial", Uint8Array, "n"],
    ["bianisotropyKappa", Float32Array, "n"],
    ["bianisotropyPrevScalar", Float32Array, "n"],
    ["bianisotropyPrevSplitX", Float32Array, "n"],
    ["bianisotropyPrevSplitY", Float32Array, "n"],
    ["bianisotropyPrevTx", Float32Array, "n"],
    ["bianisotropyPrevTy", Float32Array, "n"],
    ["dualEz", Float32Array, "n"],
    ["dualEzx", Float32Array, "n"],
    ["dualEzy", Float32Array, "n"],
    ["dualHx", Float32Array, "n"],
    ["dualHy", Float32Array, "n"],
    ["bianisotropyPrevDualEz", Float32Array, "n"],
    ["bianisotropyPrevDualEzx", Float32Array, "n"],
    ["bianisotropyPrevDualEzy", Float32Array, "n"],
    ["bianisotropyPrevDualHx", Float32Array, "n"],
    ["bianisotropyPrevDualHy", Float32Array, "n"],
    ["phaseChangeMaterial", Uint8Array, "n"],
    ["phaseState", Float32Array, "n"],
    ["phaseEpsOff", Float32Array, "n"],
    ["phaseLossOff", Float32Array, "n"],
    ["phaseEpsYOff", Float32Array, "n"],
    ["phaseLossYOff", Float32Array, "n"],
    ["phaseEpsOn", Float32Array, "n"],
    ["phaseLossOn", Float32Array, "n"],
    ["phaseEpsYOn", Float32Array, "n"],
    ["phaseLossYOn", Float32Array, "n"],
    ["dispersionOmegaP", Float32Array, "n"],
    ["dispersionGamma", Float32Array, "n"],
    ["dispersionOmega0", Float32Array, "n"],
    ["dispersionDeltaEps", Float32Array, "n"],
    ["dispersionTau", Float32Array, "n"],
    ["muDispersiveMaterial", Uint8Array, "n"],
    ["muDispersionAxes", Uint8Array, "n"],
    ["muDispersionOmegaP", Float32Array, "n"],
    ["muDispersionGamma", Float32Array, "n"],
    ["muDispersionOmega0", Float32Array, "n"],
    ["muDispersionDeltaMu", Float32Array, "n"],
    ["muDispersionTau", Float32Array, "n"],
    ["dispPz", Float32Array, "n"],
    ["dispJz", Float32Array, "n"],
    ["dispPx", Float32Array, "n"],
    ["dispJx", Float32Array, "n"],
    ["dispPy", Float32Array, "n"],
    ["dispJy", Float32Array, "n"],
    ["magDispMz", Float32Array, "n"],
    ["magDispJz", Float32Array, "n"],
    ["magDispMx", Float32Array, "n"],
    ["magDispJx", Float32Array, "n"],
    ["magDispMy", Float32Array, "n"],
    ["magDispJy", Float32Array, "n"],
    ["harmonicPrevPz", Float32Array, "n"],
    ["harmonicPrevPx", Float32Array, "n"],
    ["harmonicPrevPy", Float32Array, "n"],
  ]);

  const WASM_BACKEND_STATE_ARRAY_NAMES = Object.freeze([
    "ez",
    "ezx",
    "ezy",
    "hx",
    "hy",
    "eps",
    "loss",
    "epsY",
    "lossY",
    "mu",
    "muLoss",
    "muY",
    "muLossY",
    "material",
    "modulatedMaterial",
    "modulationPhaseOffset",
    "nonlinearMaterial",
    "dispersiveMaterial",
    "dispersionAxes",
    "dispersionAxisX",
    "dispersionAxisY",
    "electricTensorMaterial",
    "epsilonXY",
    "gyrotropicMaterial",
    "gyrotropyG",
    "bianisotropicMaterial",
    "bianisotropyKappa",
    "bianisotropyPrevScalar",
    "bianisotropyPrevSplitX",
    "bianisotropyPrevSplitY",
    "bianisotropyPrevTx",
    "bianisotropyPrevTy",
    "dualEz",
    "dualEzx",
    "dualEzy",
    "dualHx",
    "dualHy",
    "bianisotropyPrevDualEz",
    "bianisotropyPrevDualEzx",
    "bianisotropyPrevDualEzy",
    "bianisotropyPrevDualHx",
    "bianisotropyPrevDualHy",
    "phaseChangeMaterial",
    "phaseState",
    "phaseEpsOff",
    "phaseLossOff",
    "phaseEpsYOff",
    "phaseLossYOff",
    "phaseEpsOn",
    "phaseLossOn",
    "phaseEpsYOn",
    "phaseLossYOn",
    "conductivity",
    "conductivityY",
    "modulationBaseEps",
    "modulationBaseEpsY",
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
    "magDispMz",
    "magDispJz",
    "magDispMx",
    "magDispJx",
    "magDispMy",
    "magDispJy",
    "harmonicPrevPz",
    "harmonicPrevPx",
    "harmonicPrevPy",
    "cpmlKappaEX",
    "cpmlKappaHX",
    "cpmlKappaEY",
    "cpmlKappaHY",
    "cpmlAlphaEX",
    "cpmlAlphaHX",
    "cpmlAlphaEY",
    "cpmlAlphaHY",
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
    "cpmlPsiDualHxY",
    "cpmlPsiDualHyX",
    "cpmlPsiDualEzX",
    "cpmlPsiDualEzY",
  ]);

  function arrayLength(sim, axis) {
    const resolver = LENGTH_BY_GRID_AXIS[axis];
    const length = resolver ? resolver(sim) : 0;
    return Math.max(0, Math.floor(Number(length) || 0));
  }

  function allocateArraySpecs(sim, specs, options = {}) {
    const preserveExisting = Boolean(options.preserveExisting);
    for (const [name, ArrayType, axis] of specs) {
      const length = arrayLength(sim, axis);
      if (preserveExisting && sim[name] instanceof ArrayType && sim[name].length === length) {
        continue;
      }
      sim[name] = new ArrayType(length);
    }
  }

  function cloneArray(source) {
    return source && typeof source.length === "number" && typeof source.constructor === "function"
      ? new source.constructor(source)
      : null;
  }

  Object.assign(FDTDSim.prototype, {
    allocateJsCoreArrays() {
      allocateArraySpecs(this, JS_CORE_ARRAY_SPECS);
    },

    allocateAuxiliaryArrays(options = {}) {
      allocateArraySpecs(this, AUXILIARY_ARRAY_SPECS, options);
    },

    allocateArrays() {
      if (this.wasmBackend) {
        this.wasmBackend.configure(this);
        this.allocateAuxiliaryArrays({ preserveExisting: true });
      } else {
        this.allocateJsCoreArrays();
        this.allocateAuxiliaryArrays();
      }
    },

    snapshotWasmBackendStateArrays() {
      const snapshot = {};
      for (const name of WASM_BACKEND_STATE_ARRAY_NAMES) {
        snapshot[name] = cloneArray(this[name]);
      }
      return snapshot;
    },

    restoreWasmBackendStateArrays(snapshot = {}) {
      for (const name of WASM_BACKEND_STATE_ARRAY_NAMES) {
        if (snapshot[name] && this[name] && typeof this[name].set === "function") {
          this[name].set(snapshot[name]);
        }
      }
    },
  });

  global.FdtdArrayState = Object.freeze({
    auxiliaryArrayNames: AUXILIARY_ARRAY_SPECS.map(([name]) => name),
    jsCoreArrayNames: JS_CORE_ARRAY_SPECS.map(([name]) => name),
    wasmBackendStateArrayNames: Array.from(WASM_BACKEND_STATE_ARRAY_NAMES),
  });
})(typeof window !== "undefined" ? window : globalThis);
