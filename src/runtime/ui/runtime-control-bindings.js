(function initFdtdRuntimeControlBindings(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Runtime control bindings dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Runtime control bindings dependency must provide ${name}().`);
    }
    return value;
  }

  function bindRuntimeControls(dependencies) {
    const el = requireObject(dependencies.el, "el");
    const state = requireObject(dependencies.state, "state");
    const runtimeController = requireObject(dependencies.runtimeController, "runtimeController");
    const canvasRenderController = requireObject(dependencies.canvasRenderController, "canvasRenderController");
    const clamp = requireFunction(dependencies.clamp, "clamp");
    const updateControlText = requireFunction(dependencies.updateControlText, "updateControlText");

    el.playPauseBtn?.addEventListener("click", () => {
      runtimeController.toggleRunning();
    });

    el.stepBtn?.addEventListener("click", () => {
      runtimeController.advanceOneStep();
    });
    el.runStepBtn?.addEventListener("click", () => {
      runtimeController.advanceOneStep();
    });

    el.resetBtn?.addEventListener("click", () => {
      runtimeController.resetSimulationFields();
    });
    el.runResetBtn?.addEventListener("click", () => {
      runtimeController.resetSimulationFields();
    });

    el.saveBtn?.addEventListener("click", () => {
      canvasRenderController.downloadCanvasPng();
    });

    el.speedInput?.addEventListener("input", () => {
      state.timeRate = clamp(Number(el.speedInput.value), 0.1, 10);
      runtimeController.resetRuntimePacing();
      updateControlText();
    });

    el.renderFpsInput?.addEventListener("change", () => {
      const fps = Number(el.renderFpsInput.value);
      state.renderFps = [15, 30, 60].includes(fps) ? fps : 0;
      runtimeController.resetRuntimePacing();
      updateControlText();
    });

    el.gainInput?.addEventListener("input", () => {
      state.gain = Number(el.gainInput.value) / 100;
      updateControlText();
    });

    el.autoScaleInput?.addEventListener("change", () => {
      state.autoScale = el.autoScaleInput.checked;
    });
  }

  global.FdtdRuntimeControlBindings = Object.freeze({
    bindRuntimeControls,
  });
})(window);
