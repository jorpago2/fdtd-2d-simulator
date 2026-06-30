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
      document.querySelectorAll(".brush-anisotropic-params").forEach((control) => {
        control.hidden = !state.customAnisotropic;
      });
      document.querySelectorAll(".brush-material-params").forEach((control) => {
        setControlDisabled(control, [...control.querySelectorAll("input")], !isCustomBrush);
      });
      setControlDisabled(el.gyrotropyEnabledInput?.closest("label"), el.gyrotropyEnabledInput, !isCustomBrush);
      document.querySelectorAll(".gyrotropy-params").forEach((control) => {
        setControlDisabled(control, [...control.querySelectorAll("input")], !isCustomBrush || !state.materialGyrotropyEnabled);
      });
      setControlDisabled(el.bianisotropyEnabledInput?.closest("label"), el.bianisotropyEnabledInput, !isCustomBrush);
      document.querySelectorAll(".bianisotropy-params").forEach((control) => {
        setControlDisabled(control, [...control.querySelectorAll("input")], !isCustomBrush || !state.materialBianisotropyEnabled);
      });
      const modulationControlsDisabled = !isCustomBrush;
      setControlDisabled(el.modulationEnabledInput?.closest("label"), el.modulationEnabledInput, modulationControlsDisabled);
      document.querySelectorAll(".modulation-params").forEach((control) => {
        setControlDisabled(control, [...control.querySelectorAll("input")], modulationControlsDisabled || !state.materialModulationEnabled);
      });
      setControlDisabled(el.modulationPhaseInput?.closest("label"), el.modulationPhaseInput, modulationControlsDisabled || !state.materialModulationEnabled);
      setControlDisabled(el.nonlinearEnabledInput?.closest("label"), el.nonlinearEnabledInput, modulationControlsDisabled);
      document.querySelectorAll(".nonlinear-params").forEach((control) => {
        setControlDisabled(control, [...control.querySelectorAll("input")], modulationControlsDisabled || !state.materialNonlinearEnabled);
      });
      setControlDisabled(el.harmonicEnabledInput?.closest("label"), el.harmonicEnabledInput, modulationControlsDisabled);
      document.querySelectorAll(".harmonic-params").forEach((control) => {
        setControlDisabled(control, [...control.querySelectorAll("input")], modulationControlsDisabled || !state.materialHarmonicEnabled);
      });
      setControlDisabled(el.phaseChangeEnabledInput?.closest("label"), el.phaseChangeEnabledInput, !isCustomBrush);
      document.querySelectorAll(".phase-change-params").forEach((control) => {
        setControlDisabled(control, [...control.querySelectorAll("input")], !isCustomBrush || !state.materialPhaseChangeEnabled);
      });
      setControlDisabled(el.conductivityEnabledInput?.closest("label"), el.conductivityEnabledInput, !isCustomBrush);
      if (el.conductivitySigmaYControl) {
        el.conductivitySigmaYControl.hidden = !state.customAnisotropic;
      }
      document.querySelectorAll(".conductivity-params").forEach((control) => {
        setControlDisabled(control, [...control.querySelectorAll("input")], !isCustomBrush || !state.materialConductivityEnabled);
      });
      setControlDisabled(el.saturableGainEnabledInput?.closest("label"), el.saturableGainEnabledInput, !isCustomBrush);
      document.querySelectorAll(".saturable-gain-params").forEach((control) => {
        setControlDisabled(control, [...control.querySelectorAll("input")], !isCustomBrush || !state.materialSaturableGainEnabled);
      });
      const dispersionModel = normalizeDispersionModel(state.dispersionModel);
      const dispersionDisabled = !isCustomBrush || dispersionModel === "none";
      if (el.dispersionModelInput) {
        el.dispersionModelInput.value = dispersionModel;
      }
      setControlDisabled(el.dispersionModelInput?.closest("label"), el.dispersionModelInput, !isCustomBrush);
      if (el.dispersionOmegaPControl) {
        el.dispersionOmegaPControl.hidden = !["drude", "plasma"].includes(dispersionModel);
      }
      if (el.dispersionGammaControl) {
        el.dispersionGammaControl.hidden = !["drude", "plasma", "lorentz"].includes(dispersionModel);
      }
      if (el.dispersionOmega0Control) {
        el.dispersionOmega0Control.hidden = dispersionModel !== "lorentz";
      }
      if (el.dispersionDeltaEpsControl) {
        el.dispersionDeltaEpsControl.hidden = !["lorentz", "debye"].includes(dispersionModel);
      }
      if (el.dispersionTauControl) {
        el.dispersionTauControl.hidden = dispersionModel !== "debye";
      }
      document.querySelectorAll(".dispersion-params").forEach((control) => {
        setControlDisabled(control, [...control.querySelectorAll("input")], dispersionDisabled);
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
