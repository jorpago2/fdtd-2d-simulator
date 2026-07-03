(function initFdtdConfigMaterialHandlers(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error("Config/material handler dependency must provide " + name + "().");
    }
    return value;
  }

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error("Config/material handler dependency must provide " + name + ".");
    }
    return value;
  }

  function createConfigMaterialHandlersController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const sim = requireObject(dependencies.sim, "sim");
    const el = requireObject(dependencies.el, "el");
    const contextMenuState = requireObject(dependencies.contextMenuState, "contextMenuState");
    const materialSelection = requireObject(dependencies.materialSelection, "materialSelection");
    const entitySelection = requireObject(dependencies.entitySelection, "entitySelection");
    const simulationEffects = requireObject(dependencies.simulationEffects, "simulationEffects");
    const materialEditorModel = requireObject(dependencies.materialEditorModel, "materialEditorModel");
    const maxGrid = requireObject(dependencies.maxGrid, "maxGrid");
    const COURANT = Number(dependencies.COURANT);
    const BIANISOTROPY_KAPPA_LIMIT = Number(dependencies.BIANISOTROPY_KAPPA_LIMIT);
    if (!Number.isFinite(COURANT)) throw new Error("Config/material handler dependency must provide finite COURANT.");
    if (!Number.isFinite(BIANISOTROPY_KAPPA_LIMIT)) throw new Error("Config/material handler dependency must provide finite BIANISOTROPY_KAPPA_LIMIT.");

    const clamp = requireFunction(dependencies.clamp, "clamp");
    const clampInt = requireFunction(dependencies.clampInt, "clampInt");
    const updateControlText = requireFunction(dependencies.updateControlText, "updateControlText");
    const updateStats = requireFunction(dependencies.updateStats, "updateStats");
    const disableResponsiveGridOrientation = requireFunction(dependencies.disableResponsiveGridOrientation, "disableResponsiveGridOrientation");
    const normalizeDispersionModel = requireFunction(dependencies.normalizeDispersionModel, "normalizeDispersionModel");
    const markWorkerDirty = requireFunction(dependencies.markWorkerDirty, "markWorkerDirty");
    const clearMaterialSelection = requireFunction(dependencies.clearMaterialSelection, "clearMaterialSelection");
    const clearCanvasHover = requireFunction(dependencies.clearCanvasHover, "clearCanvasHover");
    const gridSizeIsAutoOrientable = requireFunction(dependencies.gridSizeIsAutoOrientable, "gridSizeIsAutoOrientable");
    const enableResponsiveGridOrientation = requireFunction(dependencies.enableResponsiveGridOrientation, "enableResponsiveGridOrientation");
    const applyResponsiveGridOrientation = requireFunction(dependencies.applyResponsiveGridOrientation, "applyResponsiveGridOrientation");
    const syncSceneBrowserSelection = requireFunction(dependencies.syncSceneBrowserSelection, "syncSceneBrowserSelection");
    const boundarySideMode = requireFunction(dependencies.boundarySideMode, "boundarySideMode");
    const setBoundarySideMode = requireFunction(dependencies.setBoundarySideMode, "setBoundarySideMode");
    const closeBoundaryMenu = requireFunction(dependencies.closeBoundaryMenu, "closeBoundaryMenu");
    const applySimulationGridSize = requireFunction(dependencies.applySimulationGridSize, "applySimulationGridSize");
    const normalizeBrushGeometryState = requireFunction(dependencies.normalizeBrushGeometryState, "normalizeBrushGeometryState");
    const applyMaterialKindToSelection = requireFunction(dependencies.applyMaterialKindToSelection, "applyMaterialKindToSelection");
    const closeBrushMenu = requireFunction(dependencies.closeBrushMenu, "closeBrushMenu");
    const validateNumericInputs = typeof dependencies.validateNumericInputs === "function"
      ? dependencies.validateNumericInputs
      : () => true;

    const MAX_GRID = maxGrid;

    function handleWavelengthInput() {
      const value = Number(el.wavelengthInput.value);
      if (!Number.isFinite(value)) return;
      state.wavelengthUm = clamp(value, 0.1, 10);
      updateControlText();
    }

    function handleCellsPerWavelengthInput() {
      disableResponsiveGridOrientation();
      const value = Number(el.cellsPerWavelengthInput.value);
      if (!Number.isFinite(value)) return;
      state.cellsPerWavelength = clampInt(value, 8, 80);
      const nextFrequency = COURANT / state.cellsPerWavelength;
      state.sourceDefaults.frequency = nextFrequency;
      state.sources.forEach((source) => {
        source.frequency = nextFrequency;
      });
      el.frequencyInput.value = String(Math.round(nextFrequency * 1000));
      sim.buildBoundary(state.boundary);
      if (state.preset !== "empty") {
        sim.applyPreset(state.preset);
        sim.zeroBoundaryFields();
        sim.measure();
        updateStats();
        sim.render();
      } else {
        sim.refreshCpmlMaterialContinuation(true);
        sim.zeroBoundaryFields();
        sim.measure();
        updateStats();
        sim.render();
      }
      updateControlText();
    }

    function handleCustomMaterialInput() {
      if (!validateNumericInputs(el.brushMenu)) return;
      simulationEffects.commit({ dirty: true, disableResponsiveGrid: true });
      const values = materialEditorModel.readCustomMaterialEditorValues(el, normalizeDispersionModel);
      const materialUpdate = materialEditorModel.applyCustomMaterialEditorValues(state, values, {
        normalizeDispersionModel,
        bianisotropyKappaLimit: BIANISOTROPY_KAPPA_LIMIT,
      });
      if (contextMenuState.brushMenuMode === "region" && materialSelection.region) {
        state.brush = "custom";
        entitySelection.replaceMaterial(sim.applyMaterialKindToRegion(materialSelection.region, "custom"));
      } else {
        sim.updateCustomMaterialCells(true);
      }
      if (materialUpdate.shouldRestoreDynamicMaterials) {
        sim.restoreDynamicMaterialsToBase();
      }
      simulationEffects.commit({ measure: true, controls: true, stats: true, render: true });
    }

    function applySelectedPreset() {
      markWorkerDirty();
      clearMaterialSelection(false);
      clearCanvasHover(false);
      state.preset = el.presetInput.value;
      if (gridSizeIsAutoOrientable()) {
        enableResponsiveGridOrientation();
      }
      const gridChanged = applyResponsiveGridOrientation({ render: false });
      if (!gridChanged) {
        sim.applyPreset(state.preset);
      }
      sim.measure();
      updateControlText();
      updateStats();
      sim.render();
      syncSceneBrowserSelection({ focusCurrent: true });
    }

    function handleSlabThicknessInput() {
      state.slabThicknessLambda = Number(el.slabThicknessInput.value);
      if (state.preset === "customSlab") {
        sim.applyPreset(state.preset);
        sim.measure();
        updateStats();
        sim.render();
      }
      updateControlText();
    }

    function applyBoundaryMode(mode, side = contextMenuState.boundaryMenuSide) {
      markWorkerDirty();
      disableResponsiveGridOrientation();
      clearMaterialSelection(false);
      clearCanvasHover(false);
      const previousMode = boundarySideMode(side);
      setBoundarySideMode(side, mode);
      sim.buildBoundary();
      if (previousMode === "absorbing" && boundarySideMode(side) === "reflective") {
        sim.clearBoundarySideMaterials(side);
      }
      sim.clearCpmlMaterials();
      sim.zeroBoundaryFields();
      sim.measure();
      updateControlText();
      updateStats();
      sim.render();
    }

    function handleBoundaryMenuInput() {
      applyBoundaryMode(el.boundaryMenuInput.value, contextMenuState.boundaryMenuSide);
      closeBoundaryMenu();
      sim.render();
    }

    function applyGridSizeFromInputs() {
      disableResponsiveGridOrientation();
      const nx = clampInt(el.gridNxInput.value, 80, MAX_GRID.nx);
      const ny = clampInt(el.gridNyInput.value, 60, MAX_GRID.ny);
      applySimulationGridSize(nx, ny);
    }

    function handleBrushSizeInput() {
      state.brushSizeLambda = Number(el.brushMenuSizeInput.value);
      state.canvasMode = "brush";
      updateControlText();
      sim.render();
    }

    function handleBrushToolButton(button) {
      state.brushTool = button.dataset.brushTool === "geometry" ? "geometry" : "paint";
      state.canvasMode = "brush";
      updateControlText();
      sim.render();
    }

    function handleBrushGeometryInput() {
      state.brushGeometry = el.brushGeometryInput?.value || "rectangle";
      state.brushTool = "geometry";
      state.canvasMode = "brush";
      normalizeBrushGeometryState();
      updateControlText();
      sim.render();
    }

    function handleGeometryDimensionInput() {
      const width = Number(el.geometryWidthInput?.value);
      const height = Number(el.geometryHeightInput?.value);
      const radius = Number(el.geometryRadiusInput?.value);
      const innerRadius = Number(el.geometryInnerRadiusInput?.value);
      if (Number.isFinite(width)) state.geometryWidthLambda = width;
      if (Number.isFinite(height)) state.geometryHeightLambda = height;
      if (Number.isFinite(radius)) state.geometryRadiusLambda = radius;
      if (Number.isFinite(innerRadius)) state.geometryInnerRadiusLambda = innerRadius;
      state.brushTool = "geometry";
      state.canvasMode = "brush";
      normalizeBrushGeometryState();
      updateControlText();
      sim.render();
    }

    function handleBrushMaterialButton(button) {
      const brush = button.dataset.brush;
      if (contextMenuState.brushMenuMode === "region" && materialSelection.region) {
        applyMaterialKindToSelection(brush);
        if (brush === "erase") {
          closeBrushMenu();
        }
        return;
      }
      state.brush = brush;
      state.canvasMode = "brush";
      updateControlText();
      sim.render();
    }

    function clearMedium() {
      clearMaterialSelection(false);
      sim.clearMaterials();
      state.preset = "empty";
      state.materialDispersionEnabled = false;
      state.materialHarmonicEnabled = false;
      state.materialConductivityEnabled = false;
      state.materialSaturableGainEnabled = false;
      state.materialPhaseChangeEnabled = false;
      state.materialGyrotropyEnabled = false;
      state.materialBianisotropyEnabled = false;
      el.presetInput.value = "empty";
      simulationEffects.commit({ dirty: true, measure: true, controls: true, stats: true, render: true });
    }

    function clearField() {
      sim.resetFields();
      simulationEffects.commit({ measure: true, stats: true, render: true });
    }

    function closeBrushMenuAndRender() {
      closeBrushMenu();
      sim.render();
    }

    function closeBoundaryMenuAndRender() {
      closeBoundaryMenu();
      sim.render();
    }

    return Object.freeze({
      handleWavelengthInput,
      handleCellsPerWavelengthInput,
      handleCustomMaterialInput,
      applySelectedPreset,
      handleSlabThicknessInput,
      applyBoundaryMode,
      handleBoundaryMenuInput,
      applyGridSizeFromInputs,
      handleBrushSizeInput,
      handleBrushToolButton,
      handleBrushGeometryInput,
      handleGeometryDimensionInput,
      handleBrushMaterialButton,
      clearMedium,
      clearField,
      closeBrushMenuAndRender,
      closeBoundaryMenuAndRender,
    });
  }

  global.FdtdConfigMaterialHandlers = Object.freeze({
    createConfigMaterialHandlersController,
  });
})(window);
