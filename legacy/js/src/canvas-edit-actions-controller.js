(function initFdtdCanvasEditActions(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Canvas edit action dependency must provide ${name}().`);
    }
    return value;
  }

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Canvas edit action dependency must provide ${name}.`);
    }
    return value;
  }

  function createCanvasEditActionsController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const getSim = requireFunction(dependencies.getSim, "getSim");
    const getSimulationEffects = requireFunction(dependencies.getSimulationEffects, "getSimulationEffects");
    const getEntitySelection = requireFunction(dependencies.getEntitySelection, "getEntitySelection");
    const lambdaToCells = requireFunction(dependencies.lambdaToCells, "lambdaToCells");
    const clearMaterialSelection = requireFunction(dependencies.clearMaterialSelection, "clearMaterialSelection");
    const normalizeBrushGeometryState = requireFunction(
      dependencies.normalizeBrushGeometryState,
      "normalizeBrushGeometryState",
    );

    function canvasToGrid(event) {
      const sim = getSim();
      return sim.clientToGridCell(event.clientX, event.clientY);
    }

    function paintFromEvent(event) {
      const sim = getSim();
      const simulationEffects = getSimulationEffects();
      simulationEffects.commit({ dirty: true, disableResponsiveGrid: true });
      clearMaterialSelection(false);
      const point = canvasToGrid(event);
      sim.paint(point.x, point.y, Math.max(1, lambdaToCells(state.brushSizeLambda)), state.brush);
      sim.refreshPmlMaterialContinuation(false);
      simulationEffects.repaint();
    }

    function insertGeometryFromEvent(event) {
      const sim = getSim();
      const simulationEffects = getSimulationEffects();
      simulationEffects.commit({ dirty: true, disableResponsiveGrid: true });
      clearMaterialSelection(false);
      normalizeBrushGeometryState();
      const point = canvasToGrid(event);
      const region = sim.insertBrushGeometry(point.x, point.y, state.brush, {
        geometry: state.brushGeometry,
        widthLambda: state.geometryWidthLambda,
        heightLambda: state.geometryHeightLambda,
        radiusLambda: state.geometryRadiusLambda,
        innerRadiusLambda: state.geometryInnerRadiusLambda,
      });
      getEntitySelection().selectMaterial(region);
      simulationEffects.commit({ measure: true, controls: true, stats: true, render: true });
    }

    return Object.freeze({
      canvasToGrid,
      paintFromEvent,
      insertGeometryFromEvent,
    });
  }

  global.FdtdCanvasEditActions = Object.freeze({
    createCanvasEditActionsController,
  });
})(window);
