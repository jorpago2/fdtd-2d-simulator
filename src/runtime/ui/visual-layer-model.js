(function initFdtdVisualLayerModel(global) {
  "use strict";

  const VISUAL_LAYER_STATE_KEYS = Object.freeze({
    boundaries: "visualLayerBoundaries",
    monitors: "visualLayerMonitors",
    axes: "visualLayerAxes",
    scale: "visualLayerScale",
    sources: "visualLayerSources",
    colorbar: "visualLayerColorbar",
  });
  const DEFAULT_VISUAL_LAYER_STATE = Object.freeze({
    boundaries: true,
    monitors: false,
    axes: true,
    scale: true,
    sources: true,
    colorbar: true,
  });

  function visualLayerSnapshot(state) {
    return Object.fromEntries(
      Object.entries(VISUAL_LAYER_STATE_KEYS).map(([layer, stateKey]) => [
        layer,
        state?.[stateKey] == null ? DEFAULT_VISUAL_LAYER_STATE[layer] : Boolean(state[stateKey]),
      ]),
    );
  }

  function visualLayerEnabled(state, layer, options = {}) {
    const stateKey = VISUAL_LAYER_STATE_KEYS[layer];
    if (!stateKey) return true;
    const overrides = options.renderOverrides;
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, layer)) {
      return Boolean(overrides[layer]);
    }
    const snapshot = options.snapshot || visualLayerSnapshot(state, options);
    return Boolean(snapshot[layer]);
  }

  function applyCustomVisualLayer(state, layer, enabled) {
    const stateKey = VISUAL_LAYER_STATE_KEYS[layer];
    if (!state || !stateKey) return false;
    state[stateKey] = Boolean(enabled);
    return true;
  }

  global.FdtdVisualLayerModel = Object.freeze({
    VISUAL_LAYER_STATE_KEYS,
    DEFAULT_VISUAL_LAYER_STATE,
    visualLayerSnapshot,
    visualLayerEnabled,
    applyCustomVisualLayer,
  });
})(window);
