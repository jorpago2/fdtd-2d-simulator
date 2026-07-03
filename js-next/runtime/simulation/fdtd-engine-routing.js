(function initFdtdEngineRouting() {
  "use strict";

  Object.assign(FDTDSim.prototype, {
    attachWasmBackend(backend) {
      if (this.wasmBackend) return;
      const previous = this.snapshotWasmBackendStateArrays();

      this.wasmBackend = backend;
      this.wasmBackend.configure(this);
      this.allocateAuxiliaryArrays({ preserveExisting: true });
      this.restoreWasmBackendStateArrays(previous);
      this.buildBoundary(state.boundary);
      this.clearCpmlMaterials();
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

    canUseCompiledBoundaryStep() {
      return !this.cpmlActive?.() || Boolean(this.wasmBackend?.supportsCpml?.());
    },

    canUseCompiledMaterialStep() {
      if (!this.wasmBackend?.canStep(state.fieldComponent)) return false;
      if (!this.canUseCompiledBoundaryStep()) return false;
      const hasModeProfileSource = Boolean(this.hasModeProfileSource?.());
      if (hasModeProfileSource) {
        if (!this.wasmBackend.supportsModeSource?.()) return false;
        if (!this.wasmBackend.canPackModeSources?.(this)) return false;
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
          return false;
        }
      }
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
        if (!this.wasmBackend.supportsElectricAde?.()) return false;
      }
      return true;
    },

    compiledMaterialEngineLabel() {
      if (!this.canUseCompiledMaterialStep()) return "";
      const labels = [];
      if (this.cpmlActive?.()) labels.push("CPML");
      if (state.materialConductivityEnabled) labels.push("sigma");
      if (state.materialNonlinearEnabled) labels.push("Kerr");
      if (state.materialSaturableGainEnabled) labels.push("gain");
      if (state.materialGyrotropyEnabled) labels.push("tensor");
      if (state.materialDispersionEnabled) labels.push("ADE");
      if (this.hasTfsfIncidentSource?.()) labels.push("TFSF");
      if (this.hasModeProfileSource?.()) labels.push("mode");
      return labels.length > 0 ? `WASM ${labels.join("+")}` : "WASM";
    },

    cpmlEngineLabel(label) {
      if (!this.cpmlActive?.() || !String(label).startsWith("JS")) return label;
      if (label === "JS") return "JS CPML";
      return label.replace(/^JS\s+/, "JS CPML+");
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
        if (this.fullVectorBianisotropyActive()) return this.cpmlEngineLabel("JS 6-field");
        if (state.materialBianisotropyEnabled) return this.cpmlEngineLabel("JS bianiso");
        if (state.materialGyrotropyEnabled) return this.cpmlEngineLabel("JS tensor");
        if (state.materialPhaseChangeEnabled) return this.cpmlEngineLabel("JS memory");
        if (this.hasTfsfIncidentSource?.()) return this.cpmlEngineLabel("JS TFSF+dynamic");
        return this.cpmlEngineLabel(state.materialSaturableGainEnabled ? "JS gain" : "JS dynamic");
      }
      if (state.materialConductivityEnabled) {
        return this.cpmlEngineLabel(this.hasModeProfileSource?.() ? "JS sigma+mode source" : "JS sigma");
      }
      if (this.hasModeProfileSource?.()) return this.cpmlEngineLabel("JS mode source");
      if (this.hasTfsfIncidentSource?.()) {
        return this.canUseCompiledBoundaryStep() && this.wasmBackend?.canStep(state.fieldComponent) && this.wasmBackend.supportsTfsf?.()
          ? "WASM TFSF"
          : this.cpmlEngineLabel("JS TFSF");
      }
      if (this.cpmlActive?.()) return this.canUseCompiledBoundaryStep() && this.wasmBackend?.canStep(state.fieldComponent) ? "WASM CPML" : "JS CPML";
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
