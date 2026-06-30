(function initFdtdBrushControlBindings(global) {
  "use strict";

  const GEOMETRY_DIMENSION_KEYS = Object.freeze([
    "geometryWidthInput",
    "geometryHeightInput",
    "geometryRadiusInput",
    "geometryInnerRadiusInput",
  ]);

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Brush control bindings dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Brush control bindings dependency must provide ${name}().`);
    }
    return value;
  }

  function forEachNode(nodes, callback) {
    nodes?.forEach?.(callback);
  }

  function bindInputAndChange(input, handler) {
    input?.addEventListener("input", handler);
    input?.addEventListener("change", handler);
  }

  function bindBrushControls(dependencies) {
    const el = requireObject(dependencies.el, "el");
    const documentRef = dependencies.documentRef || global.document;
    const handleBrushSizeInput = requireFunction(dependencies.handleBrushSizeInput, "handleBrushSizeInput");
    const handleBrushToolButton = requireFunction(dependencies.handleBrushToolButton, "handleBrushToolButton");
    const handleBrushGeometryInput = requireFunction(
      dependencies.handleBrushGeometryInput,
      "handleBrushGeometryInput",
    );
    const handleGeometryDimensionInput = requireFunction(
      dependencies.handleGeometryDimensionInput,
      "handleGeometryDimensionInput",
    );
    const handleBrushMaterialButton = requireFunction(
      dependencies.handleBrushMaterialButton,
      "handleBrushMaterialButton",
    );
    const clearMedium = requireFunction(dependencies.clearMedium, "clearMedium");
    const clearField = requireFunction(dependencies.clearField, "clearField");
    const closeBrushMenuAndRender = requireFunction(
      dependencies.closeBrushMenuAndRender,
      "closeBrushMenuAndRender",
    );
    const closeBoundaryMenuAndRender = requireFunction(
      dependencies.closeBoundaryMenuAndRender,
      "closeBoundaryMenuAndRender",
    );

    el.brushMenuSizeInput?.addEventListener("input", handleBrushSizeInput);

    forEachNode(el.brushToolButtons, (button) => {
      button.addEventListener("click", () => handleBrushToolButton(button));
    });

    el.brushGeometryInput?.addEventListener("change", handleBrushGeometryInput);
    GEOMETRY_DIMENSION_KEYS.forEach((key) => {
      bindInputAndChange(el[key], handleGeometryDimensionInput);
    });

    documentRef.querySelectorAll("[data-brush]").forEach((button) => {
      button.addEventListener("click", () => handleBrushMaterialButton(button));
    });

    el.brushMenuClearMaterialsBtn?.addEventListener("click", clearMedium);
    el.brushMenuClearFieldsBtn?.addEventListener("click", clearField);
    el.brushMenuCloseBtn?.addEventListener("click", closeBrushMenuAndRender);
    el.boundaryMenuCloseBtn?.addEventListener("click", closeBoundaryMenuAndRender);
  }

  global.FdtdBrushControlBindings = Object.freeze({
    GEOMETRY_DIMENSION_KEYS,
    bindBrushControls,
  });
})(window);
