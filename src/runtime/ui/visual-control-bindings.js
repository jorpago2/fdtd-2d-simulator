(function initFdtdVisualControlBindings(global) {
  "use strict";

  const FIELD_DISPLAY_VALUES = Object.freeze(["scalar", "transverseX", "transverseY", "electricMag", "magneticMag"]);
  const VIEW_MODE_VALUES = Object.freeze(["field", "poynting", "epsilon", "mu"]);

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Visual control bindings dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Visual control bindings dependency must provide ${name}().`);
    }
    return value;
  }

  function bindVisualControls(dependencies) {
    const el = requireObject(dependencies.el, "el");
    const state = requireObject(dependencies.state, "state");
    const sim = requireObject(dependencies.sim, "sim");
    const updateControlText = requireFunction(dependencies.updateControlText, "updateControlText");
    const updateStats = requireFunction(dependencies.updateStats, "updateStats");
    const setCustomVisualLayer = requireFunction(dependencies.setCustomVisualLayer, "setCustomVisualLayer");
    let pendingLayoutFrame = 0;

    function scheduleCanvasLayoutRefresh() {
      if (typeof global.requestAnimationFrame !== "function") {
        sim.fitCanvas?.();
        sim.render();
        return;
      }
      if (pendingLayoutFrame && typeof global.cancelAnimationFrame === "function") {
        global.cancelAnimationFrame(pendingLayoutFrame);
      }
      pendingLayoutFrame = global.requestAnimationFrame(() => {
        pendingLayoutFrame = global.requestAnimationFrame(() => {
          pendingLayoutFrame = 0;
          sim.fitCanvas?.();
          sim.render();
        });
      });
    }

    function measureVisualState() {
      if (typeof sim.measureForUi === "function") sim.measureForUi();
      else sim.measure();
    }

    function applyVisualChoice(property, value) {
      if (property === "fieldComponent") {
        const component = value === "hz" ? "hz" : "ez";
        if (state.fieldComponent === component) return;
        state.fieldComponent = component;
        sim.resetFields();
        measureVisualState();
        updateControlText();
        updateStats();
        sim.render();
        return;
      }
      if (property === "fieldDisplay") {
        state.fieldDisplay = FIELD_DISPLAY_VALUES.includes(value) ? value : "scalar";
        measureVisualState();
        updateControlText();
        updateStats();
        sim.render();
        return;
      }
      if (property === "fieldQuiver") {
        state.fieldQuiver = Boolean(value);
        updateControlText();
        sim.render();
        return;
      }
      if (property === "materialFieldOverlay") {
        state.materialFieldOverlay = Boolean(value);
        measureVisualState();
        updateControlText();
        sim.render();
        return;
      }
      if (property === "viewMode") {
        state.viewMode = VIEW_MODE_VALUES.includes(value) ? value : "field";
        if (state.viewMode === "poynting") {
          state.fieldDisplay = "scalar";
        }
        measureVisualState();
        updateControlText();
        updateStats();
        sim.render();
        return;
      }
      if (property === "viewProjection") {
        state.viewProjection = value === "3d" ? "3d" : "2d";
        updateControlText();
        sim.render();
        scheduleCanvasLayoutRefresh();
        return;
      }
      if (property === "materialPart") {
        state.materialPart = value === "imag" ? "imag" : "real";
        updateControlText();
        sim.render();
      }
    }

    global.addEventListener?.("fdtd:visual-choice", (event) => {
      applyVisualChoice(event?.detail?.property, event?.detail?.value);
    });
    global.addEventListener?.("fdtd:visual-layer", (event) => {
      setCustomVisualLayer(event?.detail?.layer, Boolean(event?.detail?.enabled));
    });

    global.addEventListener?.("fdtd:control-drawer-state", scheduleCanvasLayoutRefresh);
    global.addEventListener?.("fdtd:theme-change", scheduleCanvasLayoutRefresh);

    const observedCanvas = sim.canvas || el.canvas;
    if (observedCanvas && typeof global.ResizeObserver === "function" && !sim.canvasResizeObserver) {
      sim.canvasResizeObserver = new global.ResizeObserver((entries) => {
        const rect = entries?.[0]?.contentRect;
        if ((Number(rect?.width) || 0) > 0 && (Number(rect?.height) || 0) > 0) {
          scheduleCanvasLayoutRefresh();
        }
      });
      sim.canvasResizeObserver.observe(observedCanvas);
    }
  }

  global.FdtdVisualControlBindings = Object.freeze({
    bindVisualControls,
  });
})(window);
