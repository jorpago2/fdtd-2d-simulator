(function initFdtdCanvasInteractions(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Canvas interactions dependency must provide ${name}().`);
    }
    return value;
  }

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Canvas interactions dependency must provide ${name}.`);
    }
    return value;
  }

  function createCanvasInteractionsController(dependencies) {
    const el = requireObject(dependencies.el, "el");
    const state = requireObject(dependencies.state, "state");
    const sim = requireObject(dependencies.sim, "sim");
    const pointerState = requireObject(dependencies.pointerState, "pointerState");
    const pointerStateController = requireObject(dependencies.pointerStateController, "pointerStateController");
    const dragStateController = requireObject(dependencies.dragStateController, "dragStateController");
    const documentRef = dependencies.documentRef || global.document;
    const closeContextMenus = requireFunction(dependencies.closeContextMenus, "closeContextMenus");
    const clearCanvasHover = requireFunction(dependencies.clearCanvasHover, "clearCanvasHover");
    const updateViewInteraction = requireFunction(dependencies.updateViewInteraction, "updateViewInteraction");
    const handleCanvasKeydown = requireFunction(dependencies.handleCanvasKeydown, "handleCanvasKeydown");
    const beginPinchGesture = requireFunction(dependencies.beginPinchGesture, "beginPinchGesture");
    const updatePinchGesture = requireFunction(dependencies.updatePinchGesture, "updatePinchGesture");
    const beginPan = requireFunction(dependencies.beginPan, "beginPan");
    const beginPendingTouchInteraction = requireFunction(dependencies.beginPendingTouchInteraction, "beginPendingTouchInteraction");
    const markPendingTouchMoved = requireFunction(dependencies.markPendingTouchMoved, "markPendingTouchMoved");
    const promotePendingTouchDrag = requireFunction(dependencies.promotePendingTouchDrag, "promotePendingTouchDrag");
    const handleCanvasTouchTap = requireFunction(dependencies.handleCanvasTouchTap, "handleCanvasTouchTap");
    const clearPendingTouchInteraction = requireFunction(dependencies.clearPendingTouchInteraction, "clearPendingTouchInteraction");
    const updateSourceDrag = requireFunction(dependencies.updateSourceDrag, "updateSourceDrag");
    const updateMonitorDrag = requireFunction(dependencies.updateMonitorDrag, "updateMonitorDrag");
    const updateMaterialDrag = requireFunction(dependencies.updateMaterialDrag, "updateMaterialDrag");
    const updatePan = requireFunction(dependencies.updatePan, "updatePan");
    const endSourceDrag = requireFunction(dependencies.endSourceDrag, "endSourceDrag");
    const endMonitorDrag = requireFunction(dependencies.endMonitorDrag, "endMonitorDrag");
    const endMaterialDrag = requireFunction(dependencies.endMaterialDrag, "endMaterialDrag");
    const beginSourceDrag = requireFunction(dependencies.beginSourceDrag, "beginSourceDrag");
    const beginMonitorDrag = requireFunction(dependencies.beginMonitorDrag, "beginMonitorDrag");
    const beginMaterialDrag = requireFunction(dependencies.beginMaterialDrag, "beginMaterialDrag");
    const selectMaterialRegionAt = requireFunction(dependencies.selectMaterialRegionAt, "selectMaterialRegionAt");
    const clearMaterialSelection = requireFunction(dependencies.clearMaterialSelection, "clearMaterialSelection");
    const updateCanvasHover = requireFunction(dependencies.updateCanvasHover, "updateCanvasHover");
    const updateCanvasInteractionState = requireFunction(dependencies.updateCanvasInteractionState, "updateCanvasInteractionState");
    const insertGeometryFromEvent = requireFunction(dependencies.insertGeometryFromEvent, "insertGeometryFromEvent");
    const beginPaintStroke = requireFunction(dependencies.beginPaintStroke, "beginPaintStroke");
    const paintFromEvent = requireFunction(dependencies.paintFromEvent, "paintFromEvent");
    const endPaintStroke = requireFunction(dependencies.endPaintStroke, "endPaintStroke");
    const openBoundaryMenuAt = requireFunction(dependencies.openBoundaryMenuAt, "openBoundaryMenuAt");
    const openBrushMenuAt = requireFunction(dependencies.openBrushMenuAt, "openBrushMenuAt");
    const openSourceMenuAt = requireFunction(dependencies.openSourceMenuAt, "openSourceMenuAt");
    const openMonitorMenuAt = requireFunction(dependencies.openMonitorMenuAt, "openMonitorMenuAt");
    const openCanvasContextMenuAt = requireFunction(dependencies.openCanvasContextMenuAt, "openCanvasContextMenuAt");
    const closeCanvasActionsMenu = requireFunction(dependencies.closeCanvasActionsMenu, "closeCanvasActionsMenu");
    const closeCanvasOptionsMenu = requireFunction(dependencies.closeCanvasOptionsMenu, "closeCanvasOptionsMenu");
    const closeControlDrawer = requireFunction(dependencies.closeControlDrawer, "closeControlDrawer");
    const isEditableKeyTarget = requireFunction(dependencies.isEditableKeyTarget, "isEditableKeyTarget");
    const deleteSelectedElement = requireFunction(dependencies.deleteSelectedElement, "deleteSelectedElement");
    const touchDragStartPx = dependencies.touchDragStartPx ?? 8;

    function isDeleteShortcut(event) {
      return event.key === "Delete" || event.key === "Backspace" || event.code === "Delete" || event.code === "Backspace";
    }

    function focusCanvasForKeyboard(event) {
      if (event.pointerType === "touch") return;
      try {
        el.canvas.focus?.({ preventScroll: true });
      } catch {
        el.canvas.focus?.();
      }
    }

    function clearEntityDragState() {
      dragStateController.clearEntityDrags();
    }

    function handleWheel(event) {
      event.preventDefault();
      closeContextMenus();
      const factor = Math.exp(-event.deltaY * 0.0012);
      if (sim.zoomAtClientPoint(event.clientX, event.clientY, factor)) {
        updateViewInteraction();
      }
    }

    function handleDoubleClick() {
      closeContextMenus();
      sim.resetView();
      updateViewInteraction();
    }

    function handleContextMenu(event) {
      event.preventDefault();
      if (sim.clientIsInBoundaryControlRegion(event.clientX, event.clientY)) {
        openBoundaryMenuAt(event.clientX, event.clientY);
        return;
      }
      if (state.canvasMode === "brush") {
        openBrushMenuAt(event.clientX, event.clientY);
        return;
      }
      const source = sim.sourceAtClientPoint(event.clientX, event.clientY);
      if (source) {
        clearMaterialSelection(false);
        openSourceMenuAt(event.clientX, event.clientY, source);
        return;
      }
      const monitor = sim.monitorAtClientPoint(event.clientX, event.clientY);
      if (monitor) {
        clearMaterialSelection(false);
        openMonitorMenuAt(event.clientX, event.clientY, monitor);
        return;
      }
      const region = selectMaterialRegionAt(event.clientX, event.clientY, false);
      if (region) {
        openBrushMenuAt(event.clientX, event.clientY, { mode: "region" });
        return;
      }
      openCanvasContextMenuAt(event.clientX, event.clientY);
    }

    function capturePointer(event) {
      try {
        el.canvas.setPointerCapture(event.pointerId);
      } catch {
        // Some touch/browser combinations can reject pointer capture.
      }
    }

    function handleMultiPointerStart(event) {
      pointerStateController.resetForMultiPointer();
      clearEntityDragState();
      beginPinchGesture();
      event.preventDefault();
    }

    function handlePanStart(event) {
      closeContextMenus();
      beginPan(event);
      dragStateController.clearMonitor();
      dragStateController.clearMaterial();
      event.preventDefault();
    }

    function handleSelectPointerDown(event) {
      const isTouchPointer = event.pointerType === "touch";
      const source = sim.sourceAtClientPoint(event.clientX, event.clientY);
      const monitor = source ? null : sim.monitorAtClientPoint(event.clientX, event.clientY);
      closeContextMenus();
      if (source && !event.shiftKey && !event.altKey) {
        if (isTouchPointer) {
          clearMaterialSelection(false);
          state.selectedSourceId = source.id;
          state.selectedMonitorId = null;
          beginPendingTouchInteraction(event, "source", { sourceId: source.id });
          sim.render();
        } else {
          beginSourceDrag(event, source);
        }
        return;
      }
      if (monitor && !event.shiftKey && !event.altKey) {
        if (isTouchPointer) {
          clearMaterialSelection(false);
          state.selectedMonitorId = monitor.id;
          state.selectedSourceId = null;
          beginPendingTouchInteraction(event, "monitor", { monitorId: monitor.id });
          sim.render();
        } else {
          beginMonitorDrag(event, monitor);
        }
        return;
      }

      state.selectedSourceId = null;
      state.selectedMonitorId = null;
      const region = selectMaterialRegionAt(event.clientX, event.clientY, false);
      if (region && !event.shiftKey && !event.altKey) {
        if (isTouchPointer) {
          beginPendingTouchInteraction(event, "material", { region });
          sim.render();
        } else {
          beginMaterialDrag(event, region);
        }
      } else {
        clearMaterialSelection(false);
        if (isTouchPointer) {
          beginPan(event);
          beginPendingTouchInteraction(event, "empty");
        }
        sim.render();
      }
    }

    function handleDrawPointerDown(event) {
      closeContextMenus();
      if (state.brushTool === "geometry") {
        insertGeometryFromEvent(event);
        pointerStateController.clearPaint();
        event.preventDefault();
        return;
      }
      pointerStateController.beginPaint(event.pointerId);
      beginPaintStroke(event);
      event.preventDefault();
    }

    function handlePointerDown(event) {
      clearCanvasHover(false);
      focusCanvasForKeyboard(event);
      pointerStateController.storePointer(event);
      capturePointer(event);
      if (pointerState.activePointers.size >= 2) {
        handleMultiPointerStart(event);
        return;
      }
      if (event.button === 2) {
        event.preventDefault();
        return;
      }
      if (event.button === 1 || event.shiftKey || event.altKey) {
        handlePanStart(event);
        return;
      }
      if (event.button !== 0 && event.pointerType !== "touch") return;
      if (state.canvasMode === "select") {
        handleSelectPointerDown(event);
        event.preventDefault();
        return;
      }
      handleDrawPointerDown(event);
    }

    function handleMultiPointerMove(event) {
      pointerStateController.clearPanAndPaint();
      clearEntityDragState();
      clearPendingTouchInteraction();
      pointerStateController.clearLastCanvasTouchTap();
      updatePinchGesture();
      event.preventDefault();
    }

    function handlePointerMove(event) {
      if (pointerStateController.hasPointer(event.pointerId)) {
        pointerStateController.storePointer(event);
      }
      if (pointerState.activePointers.size >= 2) {
        handleMultiPointerMove(event);
        return;
      }
      if (promotePendingTouchDrag(event)) {
        event.preventDefault();
        return;
      }
      if (pointerState.pendingTouchInteraction?.pointerId === event.pointerId && pointerState.pendingTouchInteraction.kind !== "empty") {
        markPendingTouchMoved(event, touchDragStartPx);
        event.preventDefault();
        return;
      }
      if (updateSourceDrag(event) || updateMonitorDrag(event) || updateMaterialDrag(event)) {
        event.preventDefault();
        return;
      }
      if (pointerState.pendingTouchInteraction?.pointerId === event.pointerId && pointerState.pendingTouchInteraction.kind === "empty") {
        markPendingTouchMoved(event);
      }
      if (updatePan(event)) {
        event.preventDefault();
        return;
      }
      if (pointerStateController.isPainting(event.pointerId)) {
        paintFromEvent(event);
        event.preventDefault();
        return;
      }
      updateCanvasHover(event);
    }

    function handlePointerEnd(event) {
      const wasPainting = pointerStateController.isPainting(event.pointerId);
      const finishedTouchInteraction =
        pointerState.pendingTouchInteraction?.pointerId === event.pointerId ? pointerState.pendingTouchInteraction : null;
      pointerStateController.deletePointer(event.pointerId);
      if (finishedTouchInteraction) {
        if (event.type !== "pointerup" || (finishedTouchInteraction.kind === "empty" && finishedTouchInteraction.moved)) {
          pointerStateController.clearLastCanvasTouchTap();
        } else {
          handleCanvasTouchTap(event, finishedTouchInteraction);
        }
        clearPendingTouchInteraction();
      }
      endSourceDrag(event);
      endMonitorDrag(event);
      endMaterialDrag(event);
      if (wasPainting) {
        endPaintStroke(event);
      }
      pointerStateController.endPaint(event.pointerId);
      pointerStateController.endPan(event.pointerId);
      if (pointerState.activePointers.size < 2) {
        pointerStateController.clearPinch();
      } else {
        beginPinchGesture();
      }
      updateCanvasInteractionState();
    }

    function handleDocumentPointerDown(event) {
      if (el.stage?.classList.contains("canvas-actions-open") && !el.canvasToolbar?.contains(event.target)) {
        closeCanvasActionsMenu();
      }
      if (el.stage?.classList.contains("canvas-options-open") && !el.canvasToolbar?.contains(event.target)) {
        closeCanvasOptionsMenu();
      }
      const contextHidden = el.canvasContextMenu?.hidden ?? true;
      const sourceHidden = el.sourceMenu?.hidden ?? true;
      const monitorHidden = el.monitorMenu?.hidden ?? true;
      const brushHidden = el.brushMenu?.hidden ?? true;
      const boundaryHidden = el.boundaryMenu?.hidden ?? true;
      if (contextHidden && sourceHidden && monitorHidden && brushHidden && boundaryHidden) return;
      if (
        el.canvasContextMenu?.contains(event.target) ||
        el.sourceMenu?.contains(event.target) ||
        el.monitorMenu?.contains(event.target) ||
        el.brushMenu?.contains(event.target) ||
        el.boundaryMenu?.contains(event.target)
      ) {
        return;
      }
      if (event.target === el.canvas) return;
      closeContextMenus();
      sim.render();
    }

    function handleDocumentKeydown(event) {
      if (event.key === "Escape" && el.stage?.classList.contains("canvas-actions-open")) {
        closeCanvasActionsMenu();
        event.preventDefault();
        return;
      }
      if (event.key === "Escape" && el.stage?.classList.contains("canvas-options-open")) {
        closeCanvasOptionsMenu();
        event.preventDefault();
        return;
      }
      if (event.key === "Escape" && el.appShell?.classList.contains("controls-open")) {
        closeControlDrawer();
        event.preventDefault();
        return;
      }
      if (
        event.key === "Escape" &&
        (!el.canvasContextMenu?.hidden || !el.sourceMenu?.hidden || !el.monitorMenu?.hidden || !el.brushMenu?.hidden || !el.boundaryMenu?.hidden)
      ) {
        closeContextMenus();
        sim.render();
        return;
      }
      if (isDeleteShortcut(event) && !isEditableKeyTarget(event.target)) {
        if (deleteSelectedElement()) {
          event.preventDefault();
        }
      }
    }

    function bind() {
      el.canvas.addEventListener("wheel", handleWheel, { passive: false });
      el.canvas.addEventListener("dblclick", handleDoubleClick);
      el.canvas.addEventListener("keydown", handleCanvasKeydown);
      el.canvas.addEventListener("contextmenu", handleContextMenu);
      el.canvas.addEventListener("pointerdown", handlePointerDown);
      el.canvas.addEventListener("pointermove", handlePointerMove);
      el.canvas.addEventListener("pointerup", handlePointerEnd);
      el.canvas.addEventListener("pointercancel", handlePointerEnd);
      el.canvas.addEventListener("pointerleave", () => clearCanvasHover());
      documentRef.addEventListener("pointerdown", handleDocumentPointerDown);
      documentRef.addEventListener("keydown", handleDocumentKeydown);
    }

    return Object.freeze({
      bind,
      handleContextMenu,
      handlePointerDown,
      handlePointerEnd,
      handlePointerMove,
    });
  }

  global.FdtdCanvasInteractions = Object.freeze({
    createCanvasInteractionsController,
  });
})(window);
