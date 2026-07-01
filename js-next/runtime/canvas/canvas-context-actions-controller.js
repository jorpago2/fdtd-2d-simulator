(function initFdtdCanvasContextActions(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Canvas context action dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Canvas context action dependency must provide ${name}().`);
    }
    return value;
  }

  function createCanvasContextActionsController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const el = requireObject(dependencies.el, "el");
    const contextMenus = requireObject(dependencies.contextMenus, "contextMenus");
    const contextMenuState = requireObject(dependencies.contextMenuState, "contextMenuState");
    const boundarySideLabels = requireObject(dependencies.boundarySideLabels, "boundarySideLabels");
    const inPlaneElectricCurrentShapes = requireObject(
      dependencies.inPlaneElectricCurrentShapes,
      "inPlaneElectricCurrentShapes",
    );

    const getSim = requireFunction(dependencies.getSim, "getSim");
    const getSimulationEffects = requireFunction(dependencies.getSimulationEffects, "getSimulationEffects");
    const getEntitySelection = requireFunction(dependencies.getEntitySelection, "getEntitySelection");
    const clearMaterialSelection = requireFunction(dependencies.clearMaterialSelection, "clearMaterialSelection");
    const clampInt = requireFunction(dependencies.clampInt, "clampInt");
    const cellsToLambda = requireFunction(dependencies.cellsToLambda, "cellsToLambda");
    const formatLambda = requireFunction(dependencies.formatLambda, "formatLambda");
    const makeSource = requireFunction(dependencies.makeSource, "makeSource");
    const makeMonitor = requireFunction(dependencies.makeMonitor, "makeMonitor");
    const addSource = requireFunction(dependencies.addSource, "addSource");
    const addMonitor = requireFunction(dependencies.addMonitor, "addMonitor");
    const selectedSource = requireFunction(dependencies.selectedSource, "selectedSource");
    const explicitlySelectedMonitor = requireFunction(dependencies.explicitlySelectedMonitor, "explicitlySelectedMonitor");
    const normalizeSource = requireFunction(dependencies.normalizeSource, "normalizeSource");
    const normalizeMonitor = requireFunction(dependencies.normalizeMonitor, "normalizeMonitor");
    const readSourceEditorValues = requireFunction(dependencies.readSourceEditorValues, "readSourceEditorValues");
    const readMonitorEditorValues = requireFunction(dependencies.readMonitorEditorValues, "readMonitorEditorValues");
    const normalizeBoundarySides = requireFunction(dependencies.normalizeBoundarySides, "normalizeBoundarySides");
    const boundarySideMode = requireFunction(dependencies.boundarySideMode, "boundarySideMode");
    const boundarySideIsAbsorbing = requireFunction(dependencies.boundarySideIsAbsorbing, "boundarySideIsAbsorbing");
    const updateControlText = requireFunction(dependencies.updateControlText, "updateControlText");

    function gridPointToSourcePosition(point) {
      const sim = getSim();
      const x = clampInt(point.x, sim.sourcePlacementMinX(), sim.sourcePlacementMaxX());
      const y = clampInt(point.y, sim.sourcePlacementMinY(), sim.sourcePlacementMaxY());
      return {
        xLambda: cellsToLambda(x),
        yLambda: cellsToLambda(y),
      };
    }

    function gridPointToMonitorPosition(point) {
      const sim = getSim();
      const x = clampInt(point.x, sim.activeInteriorMinX(), sim.activeInteriorMaxX());
      const y = clampInt(point.y, sim.activeInteriorMinY(), sim.activeInteriorMaxY());
      return {
        xLambda: cellsToLambda(x),
        yLambda: cellsToLambda(y),
      };
    }

    function openCanvasContextMenuAt(clientX, clientY) {
      if (!el.canvasContextMenu) return;
      const sim = getSim();
      clearMaterialSelection(false);
      const point = sim.clientToGridCell(clientX, clientY);
      if (el.canvasContextMenuHint) {
        el.canvasContextMenuHint.textContent =
          `x / \u03bb0 ${formatLambda(cellsToLambda(point.x))}, y / \u03bb0 ${formatLambda(cellsToLambda(point.y))}`;
      }
      contextMenus.openCanvasContextMenuAt(clientX, clientY, point);
      sim.render();
    }

    function openSourceMenuAt(clientX, clientY, source = null) {
      if (!el.sourceMenu) return;
      const sim = getSim();
      let draft = null;
      let mode = "add";
      if (source) {
        mode = "edit";
        getEntitySelection().selectSource(source.id);
      } else {
        const point = sim.clientToGridCell(clientX, clientY);
        draft = makeSource(gridPointToSourcePosition(point), false);
      }
      contextMenus.openSourceMenuAt(clientX, clientY, { mode, draft });
      updateControlText();
      sim.render();
    }

    function closeSourceMenu() {
      contextMenus.closeSourceMenu();
    }

    function openMonitorMenuAt(clientX, clientY, monitor = null) {
      if (!el.monitorMenu) return;
      const sim = getSim();
      let draft = null;
      let mode = "add";
      if (monitor) {
        mode = "edit";
        getEntitySelection().selectMonitor(monitor.id);
      } else {
        const point = sim.clientToGridCell(clientX, clientY);
        draft = makeMonitor(gridPointToMonitorPosition(point), false);
      }
      contextMenus.openMonitorMenuAt(clientX, clientY, { mode, draft });
      updateControlText();
      sim.render();
    }

    function closeMonitorMenu() {
      contextMenus.closeMonitorMenu();
    }

    function closeCanvasContextMenu() {
      contextMenus.closeCanvasContextMenu();
    }

    function openBrushMenuAt(clientX, clientY, options = {}) {
      if (!el.brushMenu) return;
      const sim = getSim();
      const mode = options.mode === "region" ? "region" : "brush";
      contextMenus.openBrushMenuAt(clientX, clientY, { mode });
      if (mode === "brush") {
        state.canvasMode = "brush";
      }
      updateControlText();
      sim.render();
    }

    function closeBrushMenu() {
      contextMenus.closeBrushMenu();
    }

    function updateBoundaryMenuControls() {
      normalizeBoundarySides();
      if (el.boundaryMenuInput) {
        el.boundaryMenuInput.value = boundarySideMode(contextMenuState.boundaryMenuSide);
      }
      if (el.boundaryMenuHint) {
        const sideLabel = boundarySideLabels[contextMenuState.boundaryMenuSide] || "Boundary";
        const modeLabel = boundarySideIsAbsorbing(contextMenuState.boundaryMenuSide) ? "CPML absorbing" : "reflective";
        el.boundaryMenuHint.textContent = `${sideLabel} boundary \u00b7 ${modeLabel}`;
      }
    }

    function openBoundaryMenuAt(clientX, clientY) {
      if (!el.boundaryMenu) return;
      const sim = getSim();
      const side = sim.boundarySideAtClientPoint(clientX, clientY) || contextMenuState.boundaryMenuSide || "top";
      contextMenus.openBoundaryMenuAt(clientX, clientY, side);
      updateBoundaryMenuControls();
      sim.render();
    }

    function closeBoundaryMenu() {
      contextMenus.closeBoundaryMenu();
    }

    function closeContextMenus() {
      contextMenus.closeContextMenus();
    }

    function applySourceMenu() {
      const simulationEffects = getSimulationEffects();
      const sim = getSim();
      simulationEffects.commit({ dirty: true, disableResponsiveGrid: true });
      const values = readSourceEditorValues();
      const componentChanged = inPlaneElectricCurrentShapes.has(values.shape) && state.fieldComponent !== "hz";
      if (componentChanged) {
        state.fieldComponent = "hz";
      }
      if (contextMenuState.sourceMenuMode === "add") {
        addSource(values);
      } else {
        const source = selectedSource();
        if (source) {
          Object.assign(source, values);
          normalizeSource(source);
          state.sourceDefaults = { ...source };
          delete state.sourceDefaults.id;
        }
      }
      closeSourceMenu();
      if (componentChanged) {
        sim.resetFields();
      }
      simulationEffects.commitSourceMutation({ dirty: false, disableResponsiveGrid: false });
    }

    function applyMonitorMenu() {
      const simulationEffects = getSimulationEffects();
      simulationEffects.commit({ disableResponsiveGrid: true });
      const values = readMonitorEditorValues();
      if (contextMenuState.monitorMenuMode === "add") {
        addMonitor(values);
      } else {
        const monitor = explicitlySelectedMonitor();
        if (monitor) {
          Object.assign(monitor, values);
          normalizeMonitor(monitor);
          state.monitorDefaults = { ...monitor };
          delete state.monitorDefaults.id;
        }
      }
      closeMonitorMenu();
      simulationEffects.commitMonitorMutation({ disableResponsiveGrid: false });
    }

    return Object.freeze({
      applyMonitorMenu,
      applySourceMenu,
      closeBrushMenu,
      closeBoundaryMenu,
      closeCanvasContextMenu,
      closeContextMenus,
      closeMonitorMenu,
      closeSourceMenu,
      openBrushMenuAt,
      openBoundaryMenuAt,
      openCanvasContextMenuAt,
      openMonitorMenuAt,
      openSourceMenuAt,
      updateBoundaryMenuControls,
    });
  }

  global.FdtdCanvasContextActions = Object.freeze({
    createCanvasContextActionsController,
  });
})(window);
