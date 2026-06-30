(function initFdtdConfigControlBindings(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Config control bindings dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Config control bindings dependency must provide ${name}().`);
    }
    return value;
  }

  function bindInputAndChange(input, handler) {
    input?.addEventListener("input", handler);
    input?.addEventListener("change", handler);
  }

  function bindEnterKey(input, handler) {
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        handler();
      }
    });
  }

  function bindConfigControls(dependencies) {
    const el = requireObject(dependencies.el, "el");
    const handleWavelengthInput = requireFunction(dependencies.handleWavelengthInput, "handleWavelengthInput");
    const handleCellsPerWavelengthInput = requireFunction(
      dependencies.handleCellsPerWavelengthInput,
      "handleCellsPerWavelengthInput",
    );
    const applySelectedPreset = requireFunction(dependencies.applySelectedPreset, "applySelectedPreset");
    const handleSlabThicknessInput = requireFunction(
      dependencies.handleSlabThicknessInput,
      "handleSlabThicknessInput",
    );
    const handleBoundaryMenuInput = requireFunction(dependencies.handleBoundaryMenuInput, "handleBoundaryMenuInput");
    const applyGridSizeFromInputs = requireFunction(
      dependencies.applyGridSizeFromInputs,
      "applyGridSizeFromInputs",
    );

    bindInputAndChange(el.wavelengthInput, handleWavelengthInput);
    bindInputAndChange(el.cellsPerWavelengthInput, handleCellsPerWavelengthInput);
    el.presetInput?.addEventListener("change", applySelectedPreset);
    el.slabThicknessInput?.addEventListener("input", handleSlabThicknessInput);
    el.boundaryMenuInput?.addEventListener("change", handleBoundaryMenuInput);

    [el.gridNxInput, el.gridNyInput].forEach((input) => {
      input?.addEventListener("change", applyGridSizeFromInputs);
      bindEnterKey(input, applyGridSizeFromInputs);
    });
  }

  global.FdtdConfigControlBindings = Object.freeze({
    bindConfigControls,
  });
})(window);
