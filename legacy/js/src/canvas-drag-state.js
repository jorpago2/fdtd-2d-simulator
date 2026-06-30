(function initFdtdCanvasDragState(global) {
  "use strict";

  function defaultRequestFrame(callback) {
    return global.requestAnimationFrame(callback);
  }

  function defaultCancelFrame(frameId) {
    global.cancelAnimationFrame(frameId);
  }

  function createCanvasDragState(options = {}) {
    const requestFrame = options.requestAnimationFrame || defaultRequestFrame;
    const cancelFrame = options.cancelAnimationFrame || defaultCancelFrame;
    const state = {
      source: {
        pointerId: null,
        entityId: null,
        offset: null,
        renderFrame: null,
      },
      monitor: {
        pointerId: null,
        entityId: null,
        offset: null,
        renderFrame: null,
      },
      material: {
        pointerId: null,
        dragState: null,
      },
    };

    function beginSource({ pointerId, sourceId, offset }) {
      state.source.pointerId = pointerId;
      state.source.entityId = sourceId;
      state.source.offset = offset;
    }

    function clearSource() {
      state.source.pointerId = null;
      state.source.entityId = null;
      state.source.offset = null;
    }

    function sourceMatches(pointerId) {
      return state.source.pointerId === pointerId && state.source.entityId !== null && Boolean(state.source.offset);
    }

    function beginMonitor({ pointerId, monitorId, offset }) {
      state.monitor.pointerId = pointerId;
      state.monitor.entityId = monitorId;
      state.monitor.offset = offset;
    }

    function clearMonitor() {
      state.monitor.pointerId = null;
      state.monitor.entityId = null;
      state.monitor.offset = null;
    }

    function monitorMatches(pointerId) {
      return state.monitor.pointerId === pointerId && state.monitor.entityId !== null && Boolean(state.monitor.offset);
    }

    function beginMaterial({ pointerId, dragState }) {
      state.material.pointerId = pointerId;
      state.material.dragState = dragState;
    }

    function clearMaterial() {
      state.material.pointerId = null;
      state.material.dragState = null;
    }

    function materialMatches(pointerId) {
      return state.material.pointerId === pointerId && Boolean(state.material.dragState);
    }

    function clearEntityDrags() {
      clearSource();
      clearMonitor();
      clearMaterial();
    }

    function requestRenderFrame(kind, callback) {
      const bucket = state[kind];
      if (!bucket || bucket.renderFrame !== null) return;
      bucket.renderFrame = requestFrame(() => {
        bucket.renderFrame = null;
        callback();
      });
    }

    function flushRenderFrame(kind, callback) {
      const bucket = state[kind];
      if (!bucket) return;
      if (bucket.renderFrame !== null) {
        cancelFrame(bucket.renderFrame);
        bucket.renderFrame = null;
      }
      callback();
    }

    return Object.freeze({
      state,
      beginMaterial,
      beginMonitor,
      beginSource,
      clearEntityDrags,
      clearMaterial,
      clearMonitor,
      clearSource,
      flushRenderFrame,
      materialMatches,
      monitorMatches,
      requestRenderFrame,
      sourceMatches,
    });
  }

  global.FdtdCanvasDragState = Object.freeze({
    createCanvasDragState,
  });
})(window);
