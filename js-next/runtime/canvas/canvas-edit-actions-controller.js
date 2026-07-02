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
    let activePaintStroke = null;

    function canvasToGrid(event) {
      const sim = getSim();
      return sim.clientToGridCell(event.clientX, event.clientY);
    }

    function pointerSamples(event) {
      const coalesced = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
      const samples = Array.isArray(coalesced) ? coalesced.filter((sample) => Number.isFinite(sample.clientX) && Number.isFinite(sample.clientY)) : [];
      const lastSample = samples[samples.length - 1];
      if (!lastSample || lastSample.clientX !== event.clientX || lastSample.clientY !== event.clientY) {
        samples.push(event);
      }
      return samples;
    }

    function sameGridPoint(a, b) {
      return Boolean(a && b && a.x === b.x && a.y === b.y);
    }

    function applyPaintPoint(sim, point, radius, kind) {
      if (!activePaintStroke?.lastPoint) {
        sim.paint(point.x, point.y, radius, kind);
      } else if (!sameGridPoint(activePaintStroke.lastPoint, point)) {
        sim.paintStrokeSegment(activePaintStroke.lastPoint.x, activePaintStroke.lastPoint.y, point.x, point.y, radius, kind);
      } else {
        return false;
      }
      activePaintStroke.lastPoint = point;
      return true;
    }

    function paintStrokeSamples(event) {
      const sim = getSim();
      const simulationEffects = getSimulationEffects();
      const radius = Math.max(1, lambdaToCells(state.brushSizeLambda));
      let painted = false;
      for (const sample of pointerSamples(event)) {
        painted = applyPaintPoint(sim, canvasToGrid(sample), radius, state.brush) || painted;
      }
      if (!painted) return;
      simulationEffects.commit({ dirty: true, disableResponsiveGrid: true });
      clearMaterialSelection(false);
      sim.refreshCpmlMaterialContinuation(false);
      simulationEffects.repaint();
    }

    function beginPaintStroke(event) {
      activePaintStroke = {
        pointerId: event.pointerId,
        lastPoint: null,
      };
      paintStrokeSamples(event);
    }

    function paintFromEvent(event) {
      if (!activePaintStroke || activePaintStroke.pointerId !== event.pointerId) {
        beginPaintStroke(event);
        return;
      }
      paintStrokeSamples(event);
    }

    function endPaintStroke(event) {
      if (activePaintStroke?.pointerId === event.pointerId) {
        paintStrokeSamples(event);
      }
      activePaintStroke = null;
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
      beginPaintStroke,
      canvasToGrid,
      endPaintStroke,
      paintFromEvent,
      insertGeometryFromEvent,
    });
  }

  global.FdtdCanvasEditActions = Object.freeze({
    createCanvasEditActionsController,
  });
})(window);
