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

    modeProfileSourceCellUsesDynamicMaterial(idx) {
      if (idx < 0 || idx >= this.n || this.material?.[idx] === 2) return false;
      if (state.materialModulationEnabled && this.modulatedMaterial?.[idx]) return true;
      if ((state.materialNonlinearEnabled || state.materialHarmonicEnabled) && this.nonlinearMaterial?.[idx]) return true;
      if (state.materialPhaseChangeEnabled && this.phaseChangeMaterial?.[idx]) return true;
      if (state.materialDispersionEnabled && (this.dispersiveMaterial?.[idx] || this.muDispersiveMaterial?.[idx])) return true;
      if (state.materialSaturableGainEnabled && ((Number(this.loss?.[idx]) || 0) < 0 || (Number(this.lossY?.[idx]) || 0) < 0)) return true;
      return false;
    },

    modeProfileSourcesUseStaticCrossSections() {
      const sources = typeof this.activeSolverSources === "function" ? this.activeSolverSources() : state.sources;
      for (const source of sources) {
        if (source?.shape !== "modeProfile") continue;
        const descriptor = this.modeProfileSourceDescriptor?.(source);
        const length = Math.trunc(Number(descriptor?.profile?.length) || 0);
        if (!descriptor || length <= 0) return false;
        const x0 = Math.trunc(Number(descriptor.sx) || 0);
        for (let offset = 0; offset < length; offset += 1) {
          const y = descriptor.y0 + offset;
          if (y < 0 || y >= this.ny) return false;
          const leftIdx = this.id(Math.max(0, x0 - 1), y);
          const rightIdx = this.id(Math.min(this.nx - 1, x0), y);
          if (this.modeProfileSourceCellUsesDynamicMaterial(leftIdx) || this.modeProfileSourceCellUsesDynamicMaterial(rightIdx)) {
            return false;
          }
        }
      }
      return true;
    },

    canUseCompiledKerrResponse() {
      return Boolean(
        state.materialNonlinearEnabled &&
          this.wasmBackend?.supportsKerr() &&
          this.wasmBackend?.hasDynamicMaterialLayout?.() &&
          (!state.materialModulationEnabled || this.wasmBackend?.supportsModulation?.())
      );
    },

    canUseCompiledModulationResponse() {
      return Boolean(
        state.materialModulationEnabled &&
          this.wasmBackend?.supportsModulation?.() &&
          this.wasmBackend?.hasDynamicMaterialLayout?.()
      );
    },

    canUseCompiledDynamicMaterialResponse() {
      if (state.materialModulationEnabled && !this.canUseCompiledModulationResponse()) return false;
      if (state.materialNonlinearEnabled && !this.canUseCompiledKerrResponse()) return false;
      return Boolean(state.materialModulationEnabled || state.materialNonlinearEnabled);
    },

    canUseCompiledHarmonicResponse() {
      return Boolean(
        state.materialHarmonicEnabled &&
          this.wasmBackend?.supportsHarmonic?.() &&
          this.wasmBackend?.hasDynamicMaterialLayout?.() &&
          this.wasmBackend?.hasHarmonicLayout?.()
      );
    },

    canUseCompiledPhaseChangeResponse() {
      return Boolean(
        state.materialPhaseChangeEnabled &&
          this.wasmBackend?.supportsPhaseChange?.() &&
          this.wasmBackend?.hasDynamicMaterialLayout?.() &&
          this.wasmBackend?.hasPhaseChangeLayout?.()
      );
    },

    canUseCompiledBianisotropyResponse() {
      if (
        !state.materialBianisotropyEnabled ||
        !this.wasmBackend?.supportsBianisotropy?.() ||
        !this.wasmBackend?.hasBianisotropyLayout?.()
      ) {
        return false;
      }
      if (this.fullVectorBianisotropyActive?.()) return Boolean(this.canUseCompiledFullVectorBianisotropy?.());
      return true;
    },

    canUseCompiledBoundaryStep() {
      return !this.cpmlActive?.() || Boolean(this.wasmBackend?.supportsCpml?.());
    },

    canUseCompiledMaterialStep() {
      if (!this.wasmBackend?.canStep(state.fieldComponent)) return false;
      if (!this.canUseCompiledBoundaryStep()) return false;
      if (!this.wasmBackend.ensureLayoutForCurrentFeatures?.(this)) return false;
      const hasModeProfileSource = Boolean(this.hasModeProfileSource?.());
      if (hasModeProfileSource) {
        if (!this.wasmBackend.supportsModeSource?.()) return false;
        if (!this.wasmBackend.canPackModeSources?.(this)) return false;
        if (state.materialGyrotropyEnabled || state.materialBianisotropyEnabled) return false;
        const modeSourceHasDynamicMaterial =
          state.materialModulationEnabled ||
          state.materialNonlinearEnabled ||
          state.materialHarmonicEnabled ||
          state.materialDispersionEnabled ||
          state.materialSaturableGainEnabled ||
          state.materialPhaseChangeEnabled;
        if (modeSourceHasDynamicMaterial && !this.modeProfileSourcesUseStaticCrossSections()) return false;
      }
      if (this.hasTfsfIncidentSource?.()) {
        if (!this.wasmBackend.supportsTfsf?.()) return false;
        if (!this.wasmBackend.canPackTfsfSources?.(this)) return false;
      }
      if (state.materialBianisotropyEnabled && this.fullVectorBianisotropyActive?.()) return false;
      if (state.materialBianisotropyEnabled && !this.canUseCompiledBianisotropyResponse()) return false;
      if (state.materialModulationEnabled && !this.canUseCompiledModulationResponse()) return false;
      if (state.materialHarmonicEnabled && !this.canUseCompiledHarmonicResponse()) return false;
      if (state.materialPhaseChangeEnabled && !this.canUseCompiledPhaseChangeResponse()) return false;
      if (state.materialConductivityEnabled && !this.wasmBackend.supportsConductivity()) return false;
      if (state.materialNonlinearEnabled && !this.canUseCompiledKerrResponse()) return false;
      if (state.materialSaturableGainEnabled && !this.wasmBackend.supportsSaturableGain()) return false;
      if (state.materialGyrotropyEnabled) {
        if (state.fieldComponent !== "hz" || !this.wasmBackend.supportsTensorGyro() || !this.wasmBackend.hasTensorGyroLayout?.()) return false;
      }
      if (state.materialDispersionEnabled) {
        if (!this.wasmBackend.supportsElectricAde?.() || !this.wasmBackend.hasElectricAdeLayout?.()) return false;
        if (
          this.hasActiveMagneticDispersion() &&
          (!this.wasmBackend.supportsMagneticAde?.() || !this.wasmBackend.hasMagneticAdeLayout?.())
        ) {
          return false;
        }
      }
      return true;
    },

    compiledMaterialEngineLabel() {
      if (!this.canUseCompiledMaterialStep()) return "";
      const labels = [];
      if (this.cpmlActive?.()) labels.push("CPML");
      if (state.materialConductivityEnabled) labels.push("sigma");
      if (state.materialModulationEnabled) labels.push("mod");
      if (state.materialNonlinearEnabled) labels.push("Kerr");
      if (state.materialHarmonicEnabled) labels.push("harmonic");
      if (state.materialPhaseChangeEnabled) labels.push("phase");
      if (state.materialSaturableGainEnabled) labels.push("gain");
      if (state.materialGyrotropyEnabled) labels.push("tensor");
      if (state.materialBianisotropyEnabled) labels.push("bianiso");
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
        if (this.canUseCompiledFullVectorBianisotropy()) {
          return this.canUseCompiledBianisotropyResponse?.() ? "WASM 6-field" : "WASM+JS 6-field";
        }
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
