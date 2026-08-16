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

    global.addEventListener("fdtd:slider-input", (event) => {
      if (event?.detail?.id === "brushMenuSizeInput") handleBrushSizeInput();
    });
    const geometryInputIds = new Set(GEOMETRY_DIMENSION_KEYS.map((key) => el[key]?.id).filter(Boolean));
    const handleInput = (event) => {
      if (geometryInputIds.has(event.target?.id)) handleGeometryDimensionInput();
      else if (event.target?.id === "brushGeometryInput") handleBrushGeometryInput();
    };
    documentRef.addEventListener("input", handleInput);
    documentRef.addEventListener("change", handleInput);
    documentRef.addEventListener("click", (event) => {
      const button = event.target?.closest?.("button");
      if (!button) return;
      if (button.matches("[data-brush-tool]")) handleBrushToolButton(button);
      else if (button.matches("[data-brush]")) handleBrushMaterialButton(button);
      else if (button.id === "brushMenuClearMaterialsBtn") clearMedium();
      else if (button.id === "brushMenuClearFieldsBtn") clearField();
      else if (button.id === "brushMenuCloseBtn") closeBrushMenuAndRender();
      else if (button.id === "boundaryMenuCloseBtn") closeBoundaryMenuAndRender();
    });
  }

  global.FdtdBrushControlBindings = Object.freeze({
    GEOMETRY_DIMENSION_KEYS,
    bindBrushControls,
  });
})(window);
