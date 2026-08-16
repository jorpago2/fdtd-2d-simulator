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

  function bindConfigControls(dependencies) {
    const el = requireObject(dependencies.el, "el");
    const documentRef = dependencies.documentRef || global.document;
    const handleWavelengthInput = requireFunction(dependencies.handleWavelengthInput, "handleWavelengthInput");
    const handleCellsPerWavelengthInput = requireFunction(
      dependencies.handleCellsPerWavelengthInput,
      "handleCellsPerWavelengthInput",
    );
    const handleSlabThicknessInput = requireFunction(
      dependencies.handleSlabThicknessInput,
      "handleSlabThicknessInput",
    );
    const handleBoundaryMenuInput = requireFunction(dependencies.handleBoundaryMenuInput, "handleBoundaryMenuInput");
    const applyGridSizeFromInputs = requireFunction(
      dependencies.applyGridSizeFromInputs,
      "applyGridSizeFromInputs",
    );
    const handleSubpixelSmoothingInput = requireFunction(
      dependencies.handleSubpixelSmoothingInput,
      "handleSubpixelSmoothingInput",
    );

    global.addEventListener("fdtd:boundary-mode-request", (event) => {
      handleBoundaryMenuInput(event.detail?.mode);
    });
    const handleInput = (event) => {
      const id = event.target?.id;
      if (id === "wavelengthInput") handleWavelengthInput();
      else if (id === "cellsPerWavelengthInput") handleCellsPerWavelengthInput();
      else if (id === "slabThicknessInput") handleSlabThicknessInput();
      else if (id === "subpixelSmoothingInput") handleSubpixelSmoothingInput();
      else if (event.type === "change" && (id === "gridNxInput" || id === "gridNyInput")) applyGridSizeFromInputs();
    };
    documentRef.addEventListener("input", handleInput);
    documentRef.addEventListener("change", handleInput);
    documentRef.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.target?.id === "gridNxInput" || event.target?.id === "gridNyInput")) {
        applyGridSizeFromInputs();
      }
    });
  }

  global.FdtdConfigControlBindings = Object.freeze({
    bindConfigControls,
  });
})(window);
