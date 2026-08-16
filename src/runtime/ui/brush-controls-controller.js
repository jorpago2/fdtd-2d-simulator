(function initFdtdBrushControls(global) {
  "use strict";

  function createBrushControlsController(dependencies) {
    const { contextMenuState, el, materialEditorModel, materialSelection, state } = dependencies;
    if (!contextMenuState || !el || !materialEditorModel || !materialSelection || !state) {
      throw new Error("Brush controls require state, editor context, selection, model, and controls.");
    }
    const currentBrushLabel = dependencies.currentBrushLabel;

    function normalizeBrushGeometryState() {
      materialEditorModel.normalizeBrushGeometryState(state);
    }

    const geometryUsesWidth = (shape = state.brushGeometry) => materialEditorModel.geometryUsesWidth(shape);
    const geometryUsesHeight = (shape = state.brushGeometry) => materialEditorModel.geometryUsesHeight(shape);
    const geometryUsesRadius = (shape = state.brushGeometry) => materialEditorModel.geometryUsesRadius(shape);
    const geometryUsesInnerRadius = (shape = state.brushGeometry) => materialEditorModel.geometryUsesInnerRadius(shape);

    function updateBrushControls() {
      normalizeBrushGeometryState();
      const editsRegion = contextMenuState.brushMenuMode === "region" && Boolean(materialSelection.region);
      if (el.brushMenuSizeInput) el.brushMenuSizeInput.value = String(state.brushSizeLambda);
      global.dispatchEvent(new global.CustomEvent("fdtd:brush-editor", { detail: {
        editsRegion,
        hint: editsRegion
          ? `Selected material region: ${materialSelection.region.cells.length} cells`
          : state.brushTool === "geometry"
            ? `Geometry · Material: ${currentBrushLabel()}`
            : `Brush · Material: ${currentBrushLabel()}`,
      } }));
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

  global.FdtdBrushControls = Object.freeze({ createBrushControlsController });
})(window);
