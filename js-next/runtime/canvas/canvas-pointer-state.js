(function initFdtdCanvasPointerState(global) {
  "use strict";

  function eventPoint(event) {
    return {
      x: event.clientX,
      y: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      pointerType: event.pointerType,
    };
  }

  function pointDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function createCanvasPointerState() {
    const state = {
      activePointers: new Map(),
      pointerDown: false,
      paintPointerId: null,
      panPointerId: null,
      lastPanPoint: null,
      pinchState: null,
      pendingTouchInteraction: null,
      lastCanvasTouchTap: null,
    };

    function storePointer(event) {
      state.activePointers.set(event.pointerId, eventPoint(event));
    }

    function deletePointer(pointerId) {
      state.activePointers.delete(pointerId);
    }

    function hasPointer(pointerId) {
      return state.activePointers.has(pointerId);
    }

    function gesturePointers() {
      return Array.from(state.activePointers.values()).slice(0, 2);
    }

    function clearPaint() {
      state.pointerDown = false;
      state.paintPointerId = null;
    }

    function beginPaint(pointerId) {
      state.pointerDown = true;
      state.paintPointerId = pointerId;
    }

    function isPainting(pointerId) {
      return state.pointerDown && state.paintPointerId === pointerId;
    }

    function endPaint(pointerId) {
      if (state.paintPointerId !== pointerId) return false;
      clearPaint();
      return true;
    }

    function beginPan(event) {
      state.panPointerId = event.pointerId;
      state.lastPanPoint = { x: event.clientX, y: event.clientY };
      clearPaint();
    }

    function updatePan(event) {
      if (state.panPointerId !== event.pointerId || !state.lastPanPoint) return null;
      const dx = event.clientX - state.lastPanPoint.x;
      const dy = event.clientY - state.lastPanPoint.y;
      state.lastPanPoint = { x: event.clientX, y: event.clientY };
      return { dx, dy };
    }

    function endPan(pointerId) {
      if (state.panPointerId !== pointerId) return false;
      state.panPointerId = null;
      state.lastPanPoint = null;
      return true;
    }

    function clearPan() {
      state.panPointerId = null;
      state.lastPanPoint = null;
    }

    function clearPanAndPaint() {
      clearPaint();
      clearPan();
    }

    function clearPinch() {
      state.pinchState = null;
    }

    function beginPinch(pinchState) {
      state.pinchState = pinchState;
    }

    function clearPendingTouchInteraction() {
      state.pendingTouchInteraction = null;
    }

    function beginPendingTouchInteraction(event, kind, data = {}) {
      state.pendingTouchInteraction = {
        pointerId: event.pointerId,
        kind,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        ...data,
      };
      if (kind !== "empty") {
        state.lastCanvasTouchTap = null;
      }
    }

    function pendingTouchDistance(event) {
      const interaction = state.pendingTouchInteraction;
      if (!interaction || interaction.pointerId !== event.pointerId) return 0;
      return Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY);
    }

    function markPendingTouchMoved(event, threshold) {
      const interaction = state.pendingTouchInteraction;
      if (!interaction || interaction.pointerId !== event.pointerId) return false;
      if (pendingTouchDistance(event) >= threshold) {
        interaction.moved = true;
      }
      return interaction.moved;
    }

    function clearLastCanvasTouchTap() {
      state.lastCanvasTouchTap = null;
    }

    function registerTap(tap, { maxIntervalMs, maxDistancePx }) {
      const previousTap = state.lastCanvasTouchTap;
      state.lastCanvasTouchTap = tap;
      if (!previousTap) return false;
      const elapsed = tap.time - previousTap.time;
      const distance = pointDistance(tap, previousTap);
      if (elapsed > maxIntervalMs || distance > maxDistancePx) return false;
      state.lastCanvasTouchTap = null;
      return true;
    }

    function resetForMultiPointer() {
      clearPanAndPaint();
      clearPinch();
      clearPendingTouchInteraction();
      clearLastCanvasTouchTap();
    }

    return Object.freeze({
      state,
      beginPaint,
      beginPan,
      beginPendingTouchInteraction,
      beginPinch,
      clearLastCanvasTouchTap,
      clearPaint,
      clearPan,
      clearPanAndPaint,
      clearPendingTouchInteraction,
      clearPinch,
      deletePointer,
      endPaint,
      endPan,
      gesturePointers,
      hasPointer,
      isPainting,
      markPendingTouchMoved,
      pendingTouchDistance,
      registerTap,
      resetForMultiPointer,
      storePointer,
      updatePan,
    });
  }

  global.FdtdCanvasPointerState = Object.freeze({
    createCanvasPointerState,
  });
})(window);
