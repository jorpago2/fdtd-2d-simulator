(function initFdtdBrushControls(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error("Brush controls dependency must provide " + name + "().");
    }
    return value;
  }

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error("Brush controls dependency must provide " + name + ".");
    }
    return value;
  }

  function createBrushControlsController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const el = requireObject(dependencies.el, "el");
    const document = dependencies.documentRef || global.document;
    const contextMenuState = requireObject(dependencies.contextMenuState, "contextMenuState");
    const materialSelection = requireObject(dependencies.materialSelection, "materialSelection");
    const uiCore = requireObject(dependencies.uiCore, "uiCore");
    const materialEditorModel = requireObject(dependencies.materialEditorModel, "materialEditorModel");
    const normalizeDispersionModel = requireFunction(dependencies.normalizeDispersionModel, "normalizeDispersionModel");
    const setControlDisabled = requireFunction(dependencies.setControlDisabled, "setControlDisabled");
    const formatLambdaOutput = requireFunction(dependencies.formatLambdaOutput, "formatLambdaOutput");
    const currentBrushLabel = requireFunction(dependencies.currentBrushLabel, "currentBrushLabel");

    function normalizeBrushGeometryState() {
      materialEditorModel.normalizeBrushGeometryState(state);
    }
    
    function geometryUsesWidth(shape = state.brushGeometry) {
      return materialEditorModel.geometryUsesWidth(shape);
    }
    
    function geometryUsesHeight(shape = state.brushGeometry) {
      return materialEditorModel.geometryUsesHeight(shape);
    }
    
    function geometryUsesRadius(shape = state.brushGeometry) {
      return materialEditorModel.geometryUsesRadius(shape);
    }
    
    function geometryUsesInnerRadius(shape = state.brushGeometry) {
      return materialEditorModel.geometryUsesInnerRadius(shape);
    }

    function controlInputs(control) {
      return Array.from(control?.querySelectorAll?.("input, select, textarea") || []);
    }

    function syncDependentControl(control, visible) {
      if (!control) return;
      control.hidden = !visible;
      setControlDisabled(control, controlInputs(control), !visible);
    }

    function syncDependentControls(selector, visible) {
      document.querySelectorAll(selector).forEach((control) => {
        syncDependentControl(control, visible);
      });
    }

    function syncChildControlGroupVisibility(control) {
      const childControls = Array.from(control?.children || []).filter((child) => child.matches?.("label"));
      if (childControls.length === 0) return;
      const visible = childControls.some((child) => !child.hidden);
      control.hidden = !visible;
      setControlDisabled(control, [], !visible);
    }

    function updateBrushControls() {
      normalizeBrushGeometryState();
      document.querySelectorAll("[data-brush]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.brush === state.brush);
      });
      const editsRegion = contextMenuState.brushMenuMode === "region" && Boolean(materialSelection.region);
      const isCustomBrush = state.brush === "custom";
      if (el.brushToolControl) {
        el.brushToolControl.hidden = editsRegion;
      }
      el.brushToolButtons?.forEach((button) => {
        uiCore.setPressed(button, button.dataset.brushTool === state.brushTool);
      });
      if (el.brushGeometryPanel) {
        el.brushGeometryPanel.hidden = editsRegion || state.brushTool !== "geometry";
      }
      if (el.brushSizeControl) {
        el.brushSizeControl.hidden = editsRegion || state.brushTool === "geometry";
      }
      if (el.brushGeometryInput) {
        el.brushGeometryInput.value = state.brushGeometry;
      }
      if (el.geometryWidthInput) {
        el.geometryWidthInput.value = state.geometryWidthLambda.toFixed(2);
      }
      if (el.geometryHeightInput) {
        el.geometryHeightInput.value = state.geometryHeightLambda.toFixed(2);
      }
      if (el.geometryRadiusInput) {
        el.geometryRadiusInput.value = state.geometryRadiusLambda.toFixed(2);
      }
      if (el.geometryInnerRadiusInput) {
        el.geometryInnerRadiusInput.value = state.geometryInnerRadiusLambda.toFixed(2);
      }
      setControlDisabled(el.geometryWidthControl, el.geometryWidthInput, !geometryUsesWidth() || editsRegion);
      setControlDisabled(el.geometryHeightControl, el.geometryHeightInput, !geometryUsesHeight() || editsRegion);
      setControlDisabled(el.geometryRadiusControl, el.geometryRadiusInput, !geometryUsesRadius() || editsRegion);
      setControlDisabled(el.geometryInnerRadiusControl, el.geometryInnerRadiusInput, !geometryUsesInnerRadius() || editsRegion);
      setControlDisabled(el.customAnisotropyInput?.closest("label"), el.customAnisotropyInput, !isCustomBrush);
      document.querySelectorAll(".brush-material-params").forEach((control) => {
        setControlDisabled(control, [...control.querySelectorAll("input")], !isCustomBrush);
      });
      syncDependentControls(".brush-anisotropic-params", isCustomBrush && state.customAnisotropic);
      setControlDisabled(el.gyrotropyEnabledInput?.closest("label"), el.gyrotropyEnabledInput, !isCustomBrush);
      syncDependentControls(".gyrotropy-params", isCustomBrush && state.materialGyrotropyEnabled);
      setControlDisabled(el.bianisotropyEnabledInput?.closest("label"), el.bianisotropyEnabledInput, !isCustomBrush);
      syncDependentControls(".bianisotropy-params", isCustomBrush && state.materialBianisotropyEnabled);
      const modulationControlsDisabled = !isCustomBrush;
      setControlDisabled(el.modulationEnabledInput?.closest("label"), el.modulationEnabledInput, modulationControlsDisabled);
      syncDependentControls(".modulation-params", isCustomBrush && state.materialModulationEnabled);
      syncDependentControl(el.modulationPhaseInput?.closest("label"), isCustomBrush && state.materialModulationEnabled);
      setControlDisabled(el.nonlinearEnabledInput?.closest("label"), el.nonlinearEnabledInput, modulationControlsDisabled);
      syncDependentControls(".nonlinear-params", isCustomBrush && state.materialNonlinearEnabled);
      setControlDisabled(el.harmonicEnabledInput?.closest("label"), el.harmonicEnabledInput, modulationControlsDisabled);
      syncDependentControls(".harmonic-params", isCustomBrush && state.materialHarmonicEnabled);
      setControlDisabled(el.phaseChangeEnabledInput?.closest("label"), el.phaseChangeEnabledInput, !isCustomBrush);
      syncDependentControls(".phase-change-params", isCustomBrush && state.materialPhaseChangeEnabled);
      setControlDisabled(el.conductivityEnabledInput?.closest("label"), el.conductivityEnabledInput, !isCustomBrush);
      syncDependentControls(".conductivity-params", isCustomBrush && state.materialConductivityEnabled);
      syncDependentControl(el.conductivitySigmaYControl, isCustomBrush && state.materialConductivityEnabled && state.customAnisotropic);
      setControlDisabled(el.saturableGainEnabledInput?.closest("label"), el.saturableGainEnabledInput, !isCustomBrush);
      syncDependentControls(".saturable-gain-params", isCustomBrush && state.materialSaturableGainEnabled);
      const dispersionModel = normalizeDispersionModel(state.dispersionModel);
      const dispersionActive = isCustomBrush && dispersionModel !== "none";
      if (el.dispersionModelInput) {
        el.dispersionModelInput.value = dispersionModel;
      }
      setControlDisabled(el.dispersionModelInput?.closest("label"), el.dispersionModelInput, !isCustomBrush);
      syncDependentControl(el.dispersionOmegaPControl, dispersionActive && ["drude", "plasma"].includes(dispersionModel));
      syncDependentControl(el.dispersionGammaControl, dispersionActive && ["drude", "plasma", "lorentz"].includes(dispersionModel));
      syncDependentControl(el.dispersionOmega0Control, dispersionActive && dispersionModel === "lorentz");
      syncDependentControl(el.dispersionDeltaEpsControl, dispersionActive && ["lorentz", "debye"].includes(dispersionModel));
      syncDependentControl(el.dispersionTauControl, dispersionActive && dispersionModel === "debye");
      document.querySelectorAll(".dispersion-params").forEach((control) => {
        syncChildControlGroupVisibility(control);
      });
      if (el.brushMenuSizeInput) {
        el.brushMenuSizeInput.value = String(state.brushSizeLambda);
      }
      if (el.brushMenuSizeOutput) {
        el.brushMenuSizeOutput.value = formatLambdaOutput(state.brushSizeLambda);
      }
      if (el.brushMenuHint) {
        el.brushMenuHint.textContent = editsRegion
          ? `Selected material region: ${materialSelection.region.cells.length} cells`
          : state.brushTool === "geometry"
            ? `Geometry · Material: ${currentBrushLabel()}`
            : `Brush · Material: ${currentBrushLabel()}`;
      }
      if (el.brushMenuClearMaterialsBtn) {
        el.brushMenuClearMaterialsBtn.hidden = editsRegion;
      }
      if (el.brushMenuClearFieldsBtn) {
        el.brushMenuClearFieldsBtn.hidden = editsRegion;
      }
    }

    return Object.freeze({
      geometryUsesHeight,
      geometryUsesInnerRadius,
      geometryUsesRadius,
      geometryUsesWidth,
      normalizeBrushGeometryState,
      updateBrushControls,
    });
  }

  global.FdtdBrushControls = Object.freeze({
    createBrushControlsController,
  });
})(window);
