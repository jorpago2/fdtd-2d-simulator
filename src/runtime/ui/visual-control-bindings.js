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

  function forEachNode(nodes, callback) {
    nodes?.forEach?.(callback);
  }

  function bindVisualControls(dependencies) {
    const el = requireObject(dependencies.el, "el");
    const state = requireObject(dependencies.state, "state");
    const sim = requireObject(dependencies.sim, "sim");
    const updateControlText = requireFunction(dependencies.updateControlText, "updateControlText");
    const updateStats = requireFunction(dependencies.updateStats, "updateStats");
    const setCustomVisualLayer = requireFunction(dependencies.setCustomVisualLayer, "setCustomVisualLayer");

    function measureVisualState() {
      if (typeof sim.measureForUi === "function") sim.measureForUi();
      else sim.measure();
    }

    forEachNode(el.fieldComponentButtons, (button) => {
      button.addEventListener("click", () => {
        const component = button.dataset.fieldComponent === "hz" ? "hz" : "ez";
        if (state.fieldComponent === component) return;
        state.fieldComponent = component;
        sim.resetFields();
        measureVisualState();
        updateControlText();
        updateStats();
        sim.render();
      });
    });

    forEachNode(el.fieldDisplayButtons, (button) => {
      button.addEventListener("click", () => {
        const display = button.dataset.fieldDisplay || "scalar";
        state.fieldDisplay = FIELD_DISPLAY_VALUES.includes(display) ? display : "scalar";
        measureVisualState();
        updateControlText();
        updateStats();
        sim.render();
      });
    });

    forEachNode(el.fieldQuiverInputs, (input) => {
      input.addEventListener("change", () => {
        state.fieldQuiver = input.checked;
        updateControlText();
        sim.render();
      });
    });

    forEachNode(el.visualLayerInputs, (input) => {
      input.addEventListener("change", () => {
        setCustomVisualLayer(input.dataset.visualLayer, input.checked);
      });
    });

    forEachNode(el.viewModeButtons, (button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.viewMode;
        state.viewMode = VIEW_MODE_VALUES.includes(mode) ? mode : "field";
        if (state.viewMode === "poynting") {
          state.fieldDisplay = "scalar";
        }
        measureVisualState();
        updateControlText();
        updateStats();
        sim.render();
      });
    });

    forEachNode(el.viewProjectionButtons, (button) => {
      button.addEventListener("click", () => {
        state.viewProjection = button.dataset.viewProjection === "3d" ? "3d" : "2d";
        updateControlText();
        sim.render();
      });
    });

    forEachNode(el.materialPartButtons, (button) => {
      button.addEventListener("click", () => {
        state.materialPart = button.dataset.materialPart === "imag" ? "imag" : "real";
        updateControlText();
        sim.render();
      });
    });
  }

  global.FdtdVisualControlBindings = Object.freeze({
    bindVisualControls,
  });
})(window);
