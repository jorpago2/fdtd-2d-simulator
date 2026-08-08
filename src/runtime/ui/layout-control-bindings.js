(function initFdtdLayoutControlBindings(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Layout control bindings dependency must provide ${name}().`);
    }
    return value;
  }

  function bindLayoutControls(dependencies) {
    const windowRef = dependencies.windowRef || global;
    const handleWindowResize = requireFunction(dependencies.handleWindowResize, "handleWindowResize");

    windowRef.addEventListener("resize", handleWindowResize);
  }

  global.FdtdLayoutControlBindings = Object.freeze({
    bindLayoutControls,
  });
})(window);
