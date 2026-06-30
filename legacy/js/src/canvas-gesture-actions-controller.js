(function initFdtdCanvasGestureActions(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Canvas gesture action dependency must provide ${name}().`);
    }
    return value;
  }

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Canvas gesture action dependency must provide ${name}.`);
    }
    return value;
  }

  function createCanvasGestureActionsController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const el = requireObject(dependencies.el, "el");
    const pointerState = requireObject(dependencies.pointerState, "pointerState");
    const pointerStateController = requireObject(dependencies.pointerStateController, "pointerStateController");
    const dragState = requireObject(dependencies.dragState, "dragState");
    const dragStateController = requireObject(dependencies.dragStateController, "dragStateController");
    const canvasInteractionModel = requireObject(dependencies.canvasInteractionModel, "canvasInteractionModel");
    const getSim = requireFunction(dependencies.getSim, "getSim");
    const getSimulationEffects = requireFunction(dependencies.getSimulationEffects, "getSimulationEffects");
    const getEntitySelection = requireFunction(dependencies.getEntitySelection, "getEntitySelection");
    const updateControlText = requireFunction(dependencies.updateControlText, "updateControlText");
    const updateCanvasInteractionState = requireFunction(
      dependencies.updateCanvasInteractionState,
      "updateCanvasInteractionState",
    );
    const closeContextMenus = requireFunction(dependencies.closeContextMenus, "closeContextMenus");
    const updateInspector = requireFunction(dependencies.updateInspector, "updateInspector");
    const updateStats = requireFunction(dependencies.updateStats, "updateStats");
    const cellsToLambda = requireFunction(dependencies.cellsToLambda, "cellsToLambda");
    const selectMaterialRegion = requireFunction(dependencies.selectMaterialRegion, "selectMaterialRegion");
    const isEditableKeyTarget = requireFunction(dependencies.isEditableKeyTarget, "isEditableKeyTarget");
    const performanceRef = dependencies.performanceRef || global.performance;
    const touchDragStartPx = dependencies.touchDragStartPx ?? 8;
    const touchTapMaxDistancePx = dependencies.touchTapMaxDistancePx ?? 10;
    const touchDoubleTapMs = dependencies.touchDoubleTapMs ?? 320;
    const touchDoubleTapDistancePx = dependencies.touchDoubleTapDistancePx ?? 34;

    function updateViewInteraction() {
      const sim = getSim();
      updateControlText();
      updateCanvasInteractionState();
      sim.render();
    }

    function handleCanvasKeydown(event) {
      const sim = getSim();
      if (isEditableKeyTarget(event.target)) return;
      const rect = el.canvas.getBoundingClientRect();
      const centerX = rect.left + rect.width * 0.5;
      const centerY = rect.top + rect.height * 0.5;
      const panStep = event.shiftKey ? 96 : 42;
      let changed = false;
      if (event.key === "+" || event.key === "=") {
        changed = sim.zoomAtClientPoint(centerX, centerY, 1.18);
      } else if (event.key === "-" || event.key === "_") {
        changed = sim.zoomAtClientPoint(centerX, centerY, 1 / 1.18);
      } else if (event.key === "0") {
        sim.resetView();
        changed = true;
      } else if (event.key === "ArrowLeft") {
        changed = sim.panByClientDelta(panStep, 0);
      } else if (event.key === "ArrowRight") {
        changed = sim.panByClientDelta(-panStep, 0);
      } else if (event.key === "ArrowUp") {
        changed = sim.panByClientDelta(0, panStep);
      } else if (event.key === "ArrowDown") {
        changed = sim.panByClientDelta(0, -panStep);
      } else {
        return;
      }
      event.preventDefault();
      if (changed) {
        updateViewInteraction();
      }
    }

    function gesturePointers() {
      return pointerStateController.gesturePointers();
    }

    function gestureCenter(points) {
      return {
        x: (points[0].clientX + points[1].clientX) * 0.5,
        y: (points[0].clientY + points[1].clientY) * 0.5,
      };
    }

    function gestureDistance(points) {
      return Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY);
    }

    function beginPinchGesture() {
      const sim = getSim();
      const points = gesturePointers();
      if (points.length < 2) return;
      const center = gestureCenter(points);
      const world = sim.clientToGridFloat(center.x, center.y);
      pointerStateController.beginPinch({
        distance: Math.max(1, gestureDistance(points)),
        zoom: sim.viewZoom,
        worldX: world.x,
        worldY: world.y,
      });
    }

    function updatePinchGesture() {
      const sim = getSim();
      const points = gesturePointers();
      if (points.length < 2) return false;
      if (!pointerState.pinchState) beginPinchGesture();
      const center = gestureCenter(points);
      const distance = Math.max(1, gestureDistance(points));
      const factor = distance / pointerState.pinchState.distance;
      sim.setZoomFromGesture(
        center.x,
        center.y,
        pointerState.pinchState.worldX,
        pointerState.pinchState.worldY,
        pointerState.pinchState.zoom * factor,
      );
      updateViewInteraction();
      return true;
    }

    function beginPan(event) {
      pointerStateController.beginPan(event);
      updateCanvasInteractionState();
    }

    function updatePan(event) {
      const sim = getSim();
      const delta = pointerStateController.updatePan(event);
      if (!delta) return false;
      if (sim.panByClientDelta(delta.dx, delta.dy)) {
        updateViewInteraction();
      }
      updateCanvasInteractionState();
      return true;
    }

    function clearPendingTouchInteraction() {
      pointerStateController.clearPendingTouchInteraction();
    }

    function beginPendingTouchInteraction(event, kind, data = {}) {
      pointerStateController.beginPendingTouchInteraction(event, kind, data);
    }

    function pendingTouchDistance(event) {
      return pointerStateController.pendingTouchDistance(event);
    }

    function markPendingTouchMoved(event, threshold = touchTapMaxDistancePx) {
      return pointerStateController.markPendingTouchMoved(event, threshold);
    }

    function handleCanvasTouchTap(event, interaction) {
      const sim = getSim();
      if (!interaction || interaction.kind !== "empty" || interaction.moved || event.pointerType !== "touch" || event.type !== "pointerup") {
        return false;
      }
      const now = event.timeStamp || performanceRef.now();
      const doubleTap = pointerStateController.registerTap(
        { x: interaction.startX, y: interaction.startY, time: now },
        {
          maxIntervalMs: touchDoubleTapMs,
          maxDistancePx: touchDoubleTapDistancePx,
        },
      );
      if (!doubleTap) return false;
      closeContextMenus();
      sim.resetView();
      updateViewInteraction();
      return true;
    }

    function promotePendingTouchDrag(event) {
      if (
        !pointerState.pendingTouchInteraction ||
        pointerState.pendingTouchInteraction.pointerId !== event.pointerId ||
        pointerState.pendingTouchInteraction.kind === "empty"
      ) {
        return false;
      }
      if (pendingTouchDistance(event) < touchDragStartPx) return false;
      const interaction = pointerState.pendingTouchInteraction;
      interaction.moved = true;
      clearPendingTouchInteraction();
      if (interaction.kind === "source") {
        const source = state.sources.find((candidate) => candidate.id === interaction.sourceId);
        if (!source) return true;
        beginSourceDrag(event, source, interaction.startX, interaction.startY);
        updateSourceDrag(event);
        return true;
      }
      if (interaction.kind === "monitor") {
        const monitor = state.monitors.find((candidate) => candidate.id === interaction.monitorId);
        if (!monitor) return true;
        beginMonitorDrag(event, monitor, interaction.startX, interaction.startY);
        updateMonitorDrag(event);
        return true;
      }
      if (interaction.kind === "material" && interaction.region) {
        beginMaterialDrag(event, interaction.region, interaction.startX, interaction.startY);
        updateMaterialDrag(event);
        return true;
      }
      return true;
    }

    function requestSourceDragRender() {
      dragStateController.requestRenderFrame("source", () => {
        getSim().render();
      });
    }

    function flushSourceDragRender() {
      dragStateController.flushRenderFrame("source", () => getSim().render());
    }

    function requestMonitorDragRender() {
      dragStateController.requestRenderFrame("monitor", () => {
        updateStats();
        getSim().render();
      });
    }

    function flushMonitorDragRender() {
      dragStateController.flushRenderFrame("monitor", () => {
        updateStats();
        getSim().render();
      });
    }

    function beginSourceDrag(event, source, originClientX = event.clientX, originClientY = event.clientY) {
      const sim = getSim();
      getSimulationEffects().commit({ disableResponsiveGrid: true });
      closeContextMenus();
      getEntitySelection().selectSource(source.id);
      updateInspector();
      const point = sim.clientToGridFloat(originClientX, originClientY);
      dragStateController.beginSource({
        pointerId: event.pointerId,
        sourceId: source.id,
        offset: canvasInteractionModel.computeSourceDragStart({
          pointerGridPoint: point,
          sourceCell: {
            x: sim.sourceXCell(source),
            y: sim.sourceYCell(source),
          },
        }).offset,
      });
      pointerStateController.clearPanAndPaint();
      updateCanvasInteractionState();
      sim.render();
    }

    function beginMonitorDrag(event, monitor, originClientX = event.clientX, originClientY = event.clientY) {
      const sim = getSim();
      getSimulationEffects().commit({ disableResponsiveGrid: true });
      closeContextMenus();
      getEntitySelection().selectMonitor(monitor.id);
      updateInspector();
      const point = sim.clientToGridFloat(originClientX, originClientY);
      dragStateController.beginMonitor({
        pointerId: event.pointerId,
        monitorId: monitor.id,
        offset: canvasInteractionModel.computeMonitorDragStart({
          pointerGridPoint: point,
          monitorCell: {
            x: sim.monitorXCell(monitor),
            y: sim.monitorYCell(monitor),
          },
        }).offset,
      });
      pointerStateController.clearPanAndPaint();
      updateCanvasInteractionState();
      sim.render();
    }

    function updateSourceDrag(event) {
      const sim = getSim();
      if (!dragStateController.sourceMatches(event.pointerId)) return false;
      const source = state.sources.find((candidate) => candidate.id === dragState.source.entityId);
      if (!source) return false;
      const point = sim.clientToGridFloat(event.clientX, event.clientY);
      const dragUpdate = canvasInteractionModel.computeSourceDragUpdate({
        pointerGridPoint: point,
        offset: dragState.source.offset,
        bounds: {
          minX: sim.sourcePlacementMinX(),
          maxX: sim.sourcePlacementMaxX(),
          minY: sim.sourcePlacementMinY(),
          maxY: sim.sourcePlacementMaxY(),
        },
        currentCell: {
          x: sim.sourceXCell(source),
          y: sim.sourceYCell(source),
        },
      });
      if (!dragUpdate.changed) {
        return true;
      }
      source.xLambda = cellsToLambda(dragUpdate.nextCell.x);
      source.yLambda = cellsToLambda(dragUpdate.nextCell.y);
      requestSourceDragRender();
      return true;
    }

    function endSourceDrag(event) {
      if (dragState.source.pointerId !== event.pointerId) return;
      const source = state.sources.find((candidate) => candidate.id === dragState.source.entityId);
      if (source) {
        state.sourceDefaults = { ...source };
        delete state.sourceDefaults.id;
      }
      dragStateController.clearSource();
      getSimulationEffects().commitSourceMutation({ render: false });
      updateCanvasInteractionState();
      flushSourceDragRender();
    }

    function updateMonitorDrag(event) {
      const sim = getSim();
      if (!dragStateController.monitorMatches(event.pointerId)) return false;
      const monitor = state.monitors.find((candidate) => candidate.id === dragState.monitor.entityId);
      if (!monitor) return false;
      const point = sim.clientToGridFloat(event.clientX, event.clientY);
      const dragUpdate = canvasInteractionModel.computeMonitorDragUpdate({
        pointerGridPoint: point,
        offset: dragState.monitor.offset,
        bounds: {
          minX: sim.activeInteriorMinX(),
          maxX: sim.activeInteriorMaxX(),
          minY: sim.activeInteriorMinY(),
          maxY: sim.activeInteriorMaxY(),
        },
        currentCell: {
          x: sim.monitorXCell(monitor),
          y: sim.monitorYCell(monitor),
        },
      });
      if (!dragUpdate.changed) {
        return true;
      }
      monitor.xLambda = cellsToLambda(dragUpdate.nextCell.x);
      monitor.yLambda = cellsToLambda(dragUpdate.nextCell.y);
      requestMonitorDragRender();
      return true;
    }

    function endMonitorDrag(event) {
      if (dragState.monitor.pointerId !== event.pointerId) return;
      const monitor = state.monitors.find((candidate) => candidate.id === dragState.monitor.entityId);
      if (monitor) {
        state.monitorDefaults = { ...monitor };
        delete state.monitorDefaults.id;
      }
      dragStateController.clearMonitor();
      getSimulationEffects().commitMonitorMutation({ stats: false, render: false });
      updateCanvasInteractionState();
      flushMonitorDragRender();
    }

    function beginMaterialDrag(event, region, originClientX = event.clientX, originClientY = event.clientY) {
      const sim = getSim();
      getSimulationEffects().commit({ disableResponsiveGrid: true });
      closeContextMenus();
      selectMaterialRegion(region, false);
      const point = sim.clientToGridFloat(originClientX, originClientY);
      dragStateController.beginMaterial({
        pointerId: event.pointerId,
        dragState: canvasInteractionModel.computeMaterialDragStart({
          pointerGridPoint: point,
          region,
          base: sim.snapshotMaterialArraysWithoutRegion(region),
        }),
      });
      pointerStateController.clearPanAndPaint();
      updateCanvasInteractionState();
      sim.render();
    }

    function updateMaterialDrag(event) {
      const sim = getSim();
      const simulationEffects = getSimulationEffects();
      if (!dragStateController.materialMatches(event.pointerId)) return false;
      const point = sim.clientToGridFloat(event.clientX, event.clientY);
      const dragDelta = canvasInteractionModel.computeMaterialDragDelta({
        pointerGridPoint: point,
        state: dragState.material.dragState,
        constrainOffset: (region, rawDx, rawDy) => sim.clampMaterialRegionOffset(region, rawDx, rawDy),
      });
      if (!dragDelta.changed) return true;
      getEntitySelection().replaceMaterial(
        sim.renderMaterialRegionFromBase(
          dragState.material.dragState.base,
          dragState.material.dragState.region,
          dragDelta.dx,
          dragDelta.dy,
        ),
      );
      dragState.material.dragState.dx = dragDelta.dx;
      dragState.material.dragState.dy = dragDelta.dy;
      simulationEffects.commit({ measure: true, stats: true });
      updateInspector();
      updateCanvasInteractionState();
      simulationEffects.repaint();
      return true;
    }

    function endMaterialDrag(event) {
      const simulationEffects = getSimulationEffects();
      if (dragState.material.pointerId !== event.pointerId) return;
      dragStateController.clearMaterial();
      simulationEffects.commit({ dirty: true, measure: true, stats: true });
      updateInspector();
      updateCanvasInteractionState();
      simulationEffects.repaint();
    }

    return Object.freeze({
      updateViewInteraction,
      handleCanvasKeydown,
      beginPinchGesture,
      updatePinchGesture,
      beginPan,
      updatePan,
      clearPendingTouchInteraction,
      beginPendingTouchInteraction,
      markPendingTouchMoved,
      handleCanvasTouchTap,
      promotePendingTouchDrag,
      beginSourceDrag,
      beginMonitorDrag,
      beginMaterialDrag,
      updateSourceDrag,
      updateMonitorDrag,
      updateMaterialDrag,
      endSourceDrag,
      endMonitorDrag,
      endMaterialDrag,
    });
  }

  global.FdtdCanvasGestureActions = Object.freeze({
    createCanvasGestureActionsController,
  });
})(window);
