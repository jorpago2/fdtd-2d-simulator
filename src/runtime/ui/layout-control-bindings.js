(function initFdtdLayoutControlBindings(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Layout control bindings dependency must provide ${name}().`);
    }
    return value;
  }

  function bindRangeProgressControls(documentRef, updateRangeProgress) {
    documentRef.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener("input", () => updateRangeProgress(input));
    });
  }

  function bindLayoutControls(dependencies) {
    const windowRef = dependencies.windowRef || global;
    const documentRef = dependencies.documentRef || global.document;
    const handleWindowResize = requireFunction(dependencies.handleWindowResize, "handleWindowResize");
    const updateRangeProgress = requireFunction(dependencies.updateRangeProgress, "updateRangeProgress");

    windowRef.addEventListener("resize", handleWindowResize);
    bindRangeProgressControls(documentRef, updateRangeProgress);
  }

  global.FdtdLayoutControlBindings = Object.freeze({
    bindLayoutControls,
  });
})(window);
