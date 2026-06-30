(function initFdtdEngineRouting() {
  "use strict";

  Object.assign(FDTDSim.prototype, {
    attachWasmBackend(backend) {
      if (this.wasmBackend) return;
      const previous = this.snapshotWasmMigrationArrays();

      this.wasmBackend = backend;
      this.wasmBackend.configure(this);
      this.allocateAuxiliaryArrays();
      this.restoreWasmMigrationArrays(previous);
      this.buildBoundary(state.boundary);
      this.clearPmlMaterials();
      this.zeroBoundaryFields();
    },

    hasActiveMagneticDispersion() {
      if (!state.materialDispersionEnabled) return false;
      for (let i = 0; i < this.n; i += 1) {
        if (this.muDispersiveMaterial[i]) return true;
      }
      return false;
    },

    canUseCompiledKerrResponse() {
      return Boolean(
        state.materialNonlinearEnabled &&
          !state.materialModulationEnabled &&
          !state.materialPhaseChangeEnabled &&
          this.wasmBackend?.supportsKerr()
      );
    },

    canUseCompiledMaterialStep() {
      if (!this.wasmBackend?.canStep(state.fieldComponent)) return false;
      if (this.hasTfsfIncidentSource?.()) {
        if (!this.wasmBackend.supportsTfsf?.()) return false;
        if (!this.wasmBackend.canPackTfsfSources?.(this)) return false;
        if (state.materialDispersionEnabled) return false;
      }
      if (
        state.materialModulationEnabled ||
        state.materialHarmonicEnabled ||
        state.materialPhaseChangeEnabled ||
        state.materialBianisotropyEnabled
      ) {
        return false;
      }
      if (state.materialConductivityEnabled && !this.wasmBackend.supportsConductivity()) return false;
      if (state.materialNonlinearEnabled && !this.canUseCompiledKerrResponse()) return false;
      if (state.materialSaturableGainEnabled && !this.wasmBackend.supportsSaturableGain()) return false;
      if (state.materialGyrotropyEnabled) {
        if (state.fieldComponent !== "hz" || !this.wasmBackend.supportsTensorGyro()) return false;
      }
      if (state.materialDispersionEnabled) {
        if (state.fieldComponent !== "ez") return false;
        if (this.hasActiveMagneticDispersion()) return false;
      }
      return true;
    },

    compiledMaterialEngineLabel() {
      if (!this.canUseCompiledMaterialStep()) return "";
      const labels = [];
      if (state.materialConductivityEnabled) labels.push("sigma");
      if (state.materialNonlinearEnabled) labels.push("Kerr");
      if (state.materialSaturableGainEnabled) labels.push("gain");
      if (state.materialGyrotropyEnabled) labels.push("tensor");
      if (state.materialDispersionEnabled) labels.push("JS ADE");
      if (this.hasTfsfIncidentSource?.()) labels.push("TFSF");
      return labels.length > 0 ? `WASM ${labels.join("+")}` : "WASM";
    },

    engineLabel() {
      const compiledMaterialLabel = this.compiledMaterialEngineLabel();
      if (compiledMaterialLabel) return compiledMaterialLabel;
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
        if (this.canUseCompiledFullVectorBianisotropy()) return "WASM+JS 6-field";
        if (this.fullVectorBianisotropyActive()) return "JS 6-field";
        if (state.materialBianisotropyEnabled) return "JS bianiso";
        if (state.materialGyrotropyEnabled) return "JS tensor";
        if (state.materialPhaseChangeEnabled) return "JS memory";
        if (this.hasTfsfIncidentSource?.()) return "JS TFSF+dynamic";
        return state.materialSaturableGainEnabled ? "JS gain" : "JS dynamic";
      }
      if (state.materialConductivityEnabled) {
        return this.wasmBackend?.canStep(state.fieldComponent) && this.wasmBackend.supportsConductivity()
          ? "WASM sigma"
          : "JS sigma";
      }
      if (this.hasTfsfIncidentSource?.()) {
        return this.wasmBackend?.canStep(state.fieldComponent) && this.wasmBackend.supportsTfsf?.() ? "WASM TFSF" : "JS TFSF";
      }
      return this.wasmBackend?.canStep(state.fieldComponent) ? "WASM" : "JS";
    },

    hasDynamicMaterialResponse() {
      return Boolean(
        state.materialModulationEnabled ||
          state.materialNonlinearEnabled ||
          state.materialHarmonicEnabled ||
          state.materialDispersionEnabled ||
          (state.materialConductivityEnabled && !this.wasmBackend?.supportsConductivity()) ||
          state.materialSaturableGainEnabled ||
          state.materialPhaseChangeEnabled ||
          state.materialGyrotropyEnabled ||
          state.materialBianisotropyEnabled
      );
    },
  });
})();
