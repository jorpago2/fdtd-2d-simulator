(function initFdtdCanvasSurfaceOrbitController(global) {
  "use strict";

  const DEFAULT_YAW_DEG = 0;
  const DEFAULT_PITCH_DEG = 0;
  const PITCH_LIMIT_DEG = 62;
  const BUTTON_STEP_DEG = 12;
  const DRAG_YAW_DEG_PER_PX = 0.34;
  const DRAG_PITCH_DEG_PER_PX = 0.28;
  const WHEEL_DEG_PER_PX = 0.12;

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Surface orbit dependency must provide ${name}.`);
    }
    return value;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function wrapAngleDeg(value) {
    const angle = Number(value) || 0;
    return ((((angle + 180) % 360) + 360) % 360) - 180;
  }

  function normalizedOrbit(state) {
    const yawDeg = wrapAngleDeg(state.surfaceOrbitYawDeg ?? DEFAULT_YAW_DEG);
    const pitchDeg = clamp(Number(state.surfaceOrbitPitchDeg ?? DEFAULT_PITCH_DEG) || 0, -PITCH_LIMIT_DEG, PITCH_LIMIT_DEG);
    state.surfaceOrbitYawDeg = yawDeg;
    state.surfaceOrbitPitchDeg = pitchDeg;
    return { yawDeg, pitchDeg };
  }

  function createCanvasSurfaceOrbitController(dependencies) {
    const el = requireObject(dependencies.el, "el");
    const state = requireObject(dependencies.state, "state");
    const sim = requireObject(dependencies.sim, "sim");
    const windowRef = dependencies.windowRef || global;
    const documentRef = dependencies.documentRef || global.document;
    const closeContextMenus = typeof dependencies.closeContextMenus === "function" ? dependencies.closeContextMenus : () => {};
    const requestFrame =
      typeof windowRef.requestAnimationFrame === "function"
        ? (callback) => windowRef.requestAnimationFrame(callback)
        : (callback) => windowRef.setTimeout(callback, 16);
    const cancelFrame =
      typeof windowRef.cancelAnimationFrame === "function"
        ? (frameId) => windowRef.cancelAnimationFrame(frameId)
        : (frameId) => windowRef.clearTimeout(frameId);

    let activeDrag = null;
    let renderFrame = null;
    let bound = false;

    function orbitEnabled() {
      return state.viewProjection === "3d";
    }

    function stopEvent(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }

    function updateReadout() {
      const orbit = normalizedOrbit(state);
      if (el.surfaceOrbitReadout) {
        el.surfaceOrbitReadout.value = `3D orbit yaw ${Math.round(orbit.yawDeg)} deg, pitch ${Math.round(orbit.pitchDeg)} deg`;
      }
      if (el.surfaceOrbitGizmo) {
        el.surfaceOrbitGizmo.style.setProperty("--surface-orbit-yaw", `${orbit.yawDeg}deg`);
        el.surfaceOrbitGizmo.style.setProperty("--surface-orbit-pitch", `${orbit.pitchDeg}deg`);
      }
    }

    function scheduleRender() {
      if (renderFrame !== null) return;
      renderFrame = requestFrame(() => {
        renderFrame = null;
        sim.render();
      });
    }

    function setOrbit(yawDeg, pitchDeg, { render = true } = {}) {
      state.surfaceOrbitYawDeg = wrapAngleDeg(yawDeg);
      state.surfaceOrbitPitchDeg = clamp(Number(pitchDeg) || 0, -PITCH_LIMIT_DEG, PITCH_LIMIT_DEG);
      updateReadout();
      if (render) scheduleRender();
    }

    function rotateBy(deltaYawDeg, deltaPitchDeg) {
      const orbit = normalizedOrbit(state);
      setOrbit(orbit.yawDeg + deltaYawDeg, orbit.pitchDeg + deltaPitchDeg);
    }

    function resetOrbit() {
      setOrbit(DEFAULT_YAW_DEG, DEFAULT_PITCH_DEG);
    }

    function sync() {
      const enabled = orbitEnabled();
      if (el.surfaceOrbitControls) {
        el.surfaceOrbitControls.hidden = !enabled;
      }
      el.canvasFrame?.classList.toggle("is-surface-orbit-available", enabled);
      if (!enabled) endDrag();
      updateReadout();
    }

    function beginDrag(event, target) {
      if (!orbitEnabled()) return false;
      if (target === "canvas" && event.button !== 1) return false;
      if (target !== "canvas" && event.button > 0) return false;
      activeDrag = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
        target,
        captureTarget: event.currentTarget,
      };
      closeContextMenus();
      el.surfaceOrbitGizmo?.classList.toggle("is-dragging", true);
      try {
        event.currentTarget?.setPointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture can fail in embedded browsers; document listeners still finish the drag.
      }
      stopEvent(event);
      return true;
    }

    function updateDrag(event) {
      if (!activeDrag || activeDrag.pointerId !== event.pointerId) return false;
      const dx = event.clientX - activeDrag.lastX;
      const dy = event.clientY - activeDrag.lastY;
      activeDrag.lastX = event.clientX;
      activeDrag.lastY = event.clientY;
      rotateBy(dx * DRAG_YAW_DEG_PER_PX, -dy * DRAG_PITCH_DEG_PER_PX);
      stopEvent(event);
      return true;
    }

    function endDrag(event) {
      if (!activeDrag) return false;
      if (event?.pointerId != null && activeDrag.pointerId !== event.pointerId) return false;
      try {
        activeDrag.captureTarget?.releasePointerCapture?.(activeDrag.pointerId);
      } catch {
        // No action needed if capture was never established.
      }
      activeDrag = null;
      el.surfaceOrbitGizmo?.classList.toggle("is-dragging", false);
      if (event) stopEvent(event);
      return true;
    }

    function handleCanvasPointerDownCapture(event) {
      beginDrag(event, "canvas");
    }

    function handleGizmoPointerDown(event) {
      beginDrag(event, "gizmo");
    }

    function handlePointerMoveCapture(event) {
      updateDrag(event);
    }

    function handlePointerEndCapture(event) {
      endDrag(event);
    }

    function handleCanvasWheelCapture(event) {
      if (!orbitEnabled() || event.ctrlKey) return;
      const horizontalGesture = Math.abs(event.deltaX || 0) > 0.5;
      const modifiedGesture = event.shiftKey || event.altKey;
      if (!horizontalGesture && !modifiedGesture) return;
      const deltaYawDeg = Number(event.deltaX || 0) * WHEEL_DEG_PER_PX;
      const deltaPitchDeg = -Number(event.deltaY || 0) * WHEEL_DEG_PER_PX;
      if (Math.abs(deltaYawDeg) < 0.01 && Math.abs(deltaPitchDeg) < 0.01) return;
      rotateBy(deltaYawDeg, deltaPitchDeg);
      stopEvent(event);
    }

    function handleControlClick(event) {
      const button = event.target instanceof Element ? event.target.closest("[data-surface-orbit-action]") : null;
      if (!button) return;
      const orbit = normalizedOrbit(state);
      const action = button.dataset.surfaceOrbitAction;
      if (action === "reset") resetOrbit();
      else if (action === "yaw-left") setOrbit(orbit.yawDeg - BUTTON_STEP_DEG, orbit.pitchDeg);
      else if (action === "yaw-right") setOrbit(orbit.yawDeg + BUTTON_STEP_DEG, orbit.pitchDeg);
      else if (action === "pitch-up") setOrbit(orbit.yawDeg, orbit.pitchDeg + BUTTON_STEP_DEG);
      else if (action === "pitch-down") setOrbit(orbit.yawDeg, orbit.pitchDeg - BUTTON_STEP_DEG);
    }

    function bind() {
      if (bound) return;
      bound = true;
      el.canvas?.addEventListener("pointerdown", handleCanvasPointerDownCapture, true);
      el.canvas?.addEventListener("wheel", handleCanvasWheelCapture, { capture: true, passive: false });
      el.surfaceOrbitGizmo?.addEventListener("pointerdown", handleGizmoPointerDown);
      el.surfaceOrbitControls?.addEventListener("click", handleControlClick);
      documentRef?.addEventListener?.("pointermove", handlePointerMoveCapture, true);
      documentRef?.addEventListener?.("pointerup", handlePointerEndCapture, true);
      documentRef?.addEventListener?.("pointercancel", handlePointerEndCapture, true);
      sync();
    }

    function destroy() {
      if (!bound) return;
      bound = false;
      el.canvas?.removeEventListener("pointerdown", handleCanvasPointerDownCapture, true);
      el.canvas?.removeEventListener("wheel", handleCanvasWheelCapture, true);
      el.surfaceOrbitGizmo?.removeEventListener("pointerdown", handleGizmoPointerDown);
      el.surfaceOrbitControls?.removeEventListener("click", handleControlClick);
      documentRef?.removeEventListener?.("pointermove", handlePointerMoveCapture, true);
      documentRef?.removeEventListener?.("pointerup", handlePointerEndCapture, true);
      documentRef?.removeEventListener?.("pointercancel", handlePointerEndCapture, true);
      if (renderFrame !== null) {
        cancelFrame(renderFrame);
        renderFrame = null;
      }
    }

    return Object.freeze({
      bind,
      destroy,
      normalizedOrbit: () => normalizedOrbit(state),
      resetOrbit,
      rotateBy,
      setOrbit,
      sync,
    });
  }

  global.FdtdCanvasSurfaceOrbitController = Object.freeze({
    createCanvasSurfaceOrbitController,
    normalizedOrbit,
  });
})(window);
