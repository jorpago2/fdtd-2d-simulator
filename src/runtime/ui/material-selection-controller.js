(function initFdtdMaterialSelectionController(global) {
  "use strict";

  function createMaterialSelectionController() {
    const state = {
      region: null,
    };

    function getRegion() {
      return state.region;
    }

    function setRegion(region) {
      state.region = region || null;
      return state.region;
    }

    function replaceRegion(region) {
      state.region = region || null;
      return state.region;
    }

    function clear() {
      state.region = null;
    }

    function hasRegion() {
      return Boolean(state.region?.cells?.length);
    }

    return Object.freeze({
      state,
      getRegion,
      setRegion,
      replaceRegion,
      clear,
      hasRegion,
    });
  }

  global.FdtdMaterialSelectionController = Object.freeze({
    createMaterialSelectionController,
  });
})(window);
