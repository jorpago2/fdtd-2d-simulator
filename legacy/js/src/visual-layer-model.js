(function initFdtdVisualLayerModel(global) {
  "use strict";

  const VISUAL_PROFILE_NAMES = Object.freeze(["auto", "clean", "teaching", "analysis", "custom"]);
  const VISUAL_LAYER_STATE_KEYS = Object.freeze({
    boundaries: "visualLayerBoundaries",
    diagnostics: "visualLayerDiagnostics",
    monitors: "visualLayerMonitors",
    axes: "visualLayerAxes",
    scale: "visualLayerScale",
    sources: "visualLayerSources",
    colorbar: "visualLayerColorbar",
  });
  const VISUAL_LAYER_LABELS = Object.freeze({
    boundaries: "PML/bounds",
    diagnostics: "k vector",
    monitors: "line monitors",
    axes: "axes",
    scale: "scale",
    sources: "sources",
    colorbar: "colorbar",
  });
  const VISUAL_PROFILE_LAYERS = Object.freeze({
    clean: Object.freeze({
      boundaries: false,
      diagnostics: false,
      monitors: false,
      axes: false,
      scale: false,
      sources: true,
      colorbar: true,
    }),
    teaching: Object.freeze({
      boundaries: true,
      diagnostics: true,
      monitors: false,
      axes: true,
      scale: true,
      sources: true,
      colorbar: true,
    }),
    analysis: Object.freeze({
      boundaries: true,
      diagnostics: true,
      monitors: false,
      axes: false,
      scale: true,
      sources: true,
      colorbar: true,
    }),
  });

  function normalizedVisualProfile(profile) {
    return VISUAL_PROFILE_NAMES.includes(profile) ? profile : "auto";
  }

  function effectiveVisualProfile(state, options = {}) {
    const profile = normalizedVisualProfile(state?.visualProfile);
    if (profile === "auto") {
      if (state?.uiDepth === "advanced") return "analysis";
      return options.mobileCanvasViewportActive ? "clean" : "teaching";
    }
    return profile === "custom" ? "custom" : profile;
  }

  function visualLayerSnapshot(state, options = {}) {
    const profile = options.profile || effectiveVisualProfile(state, options);
    if (profile === "custom") {
      return Object.fromEntries(
        Object.entries(VISUAL_LAYER_STATE_KEYS).map(([layer, stateKey]) => [
          layer,
          state?.[stateKey] == null ? stateKey !== "visualLayerMonitors" : Boolean(state[stateKey]),
        ]),
      );
    }
    return { ...(VISUAL_PROFILE_LAYERS[profile] || VISUAL_PROFILE_LAYERS.teaching) };
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

  function visualOverlaySummary(state, options = {}) {
    const snapshot = options.snapshot || visualLayerSnapshot(state, options);
    const enabled = Object.entries(snapshot)
      .filter(([, active]) => active)
      .map(([layer]) => VISUAL_LAYER_LABELS[layer] || layer);
    if (enabled.length === 0) return "none";
    if (enabled.length <= 3) return enabled.join(", ");
    return `${enabled.slice(0, 3).join(", ")} +${enabled.length - 3}`;
  }

  function visualGuideNoteText(state, options = {}) {
    const profile = options.profile || effectiveVisualProfile(state, options);
    if (profile === "clean") return "Clean view keeps the field readable on compact screens.";
    if (profile === "analysis") return "Analysis view keeps monitors and scale visible for measurements.";
    return "Teaching view shows boundaries, axes, scale and source markers.";
  }

  function applyCustomVisualLayer(state, layer, enabled, options = {}) {
    const stateKey = VISUAL_LAYER_STATE_KEYS[layer];
    if (!state || !stateKey) return false;
    const snapshot = visualLayerSnapshot(state, options);
    Object.entries(VISUAL_LAYER_STATE_KEYS).forEach(([snapshotLayer, snapshotKey]) => {
      state[snapshotKey] = Boolean(snapshot[snapshotLayer]);
    });
    state.visualProfile = "custom";
    state[stateKey] = Boolean(enabled);
    return true;
  }

  global.FdtdVisualLayerModel = Object.freeze({
    VISUAL_PROFILE_NAMES,
    VISUAL_LAYER_STATE_KEYS,
    VISUAL_LAYER_LABELS,
    VISUAL_PROFILE_LAYERS,
    normalizedVisualProfile,
    effectiveVisualProfile,
    visualLayerSnapshot,
    visualLayerEnabled,
    visualOverlaySummary,
    visualGuideNoteText,
    applyCustomVisualLayer,
  });
})(window);
