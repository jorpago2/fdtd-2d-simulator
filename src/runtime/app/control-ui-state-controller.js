(function initFdtdControlUiState(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Control UI state dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Control UI state dependency must provide ${name}().`);
    }
    return value;
  }

  function createControlUiStateController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const el = requireObject(dependencies.el, "el");
    const uiCore = requireObject(dependencies.uiCore, "uiCore");
    const visualLayerModel = requireObject(dependencies.visualLayerModel, "visualLayerModel");
    const documentElement = requireObject(dependencies.documentElement, "documentElement");
    const windowRef = requireObject(dependencies.windowRef || global, "windowRef");
    const normalizeTheme = requireFunction(dependencies.normalizeTheme, "normalizeTheme");
    const normalizeUiDepth = requireFunction(dependencies.normalizeUiDepth, "normalizeUiDepth");
    const clearCanvasHover = requireFunction(dependencies.clearCanvasHover, "clearCanvasHover");
    const updateControlText = requireFunction(dependencies.updateControlText, "updateControlText");
    const getSim = requireFunction(dependencies.getSim, "getSim");
    const getCanvasColorbarController = requireFunction(
      dependencies.getCanvasColorbarController,
      "getCanvasColorbarController",
    );
    const isControlTextReady = dependencies.isControlTextReady || (() => true);
    const themeStorageKey = String(dependencies.themeStorageKey || "");

    function renderIfAvailable() {
      getSim()?.render?.();
    }

    function updateColorbarIfAvailable() {
      getCanvasColorbarController()?.update?.();
    }

    function updateThemeControls() {
      state.theme = normalizeTheme(state.theme);
      const carbonTheme = state.theme === "dark" ? "g100" : "g10";
      const runtimeThemeChanged = documentElement.dataset.theme !== state.theme;
      const carbonThemeNeedsSync = documentElement.dataset.carbonTheme !== carbonTheme;
      if (typeof windowRef.CustomEvent === "function" && typeof windowRef.dispatchEvent === "function") {
        if (carbonThemeNeedsSync) {
          windowRef.dispatchEvent(new windowRef.CustomEvent("fdtd:theme-request", {
            detail: { theme: state.theme },
          }));
        }
        if (runtimeThemeChanged || carbonThemeNeedsSync) {
          windowRef.dispatchEvent(new windowRef.CustomEvent("fdtd:theme-applied", { detail: { theme: state.theme } }));
        }
      }
    }

    function applyTheme(theme, render = true) {
      const nextTheme = normalizeTheme(theme);
      const carbonTheme = nextTheme === "dark" ? "g100" : "g10";
      const themeAlreadyApplied =
        state.theme === nextTheme
        && documentElement.dataset.theme === nextTheme
        && documentElement.dataset.carbonTheme === carbonTheme;
      state.theme = nextTheme;
      if (themeAlreadyApplied) return;
      try {
        windowRef.localStorage?.setItem(themeStorageKey, state.theme);
      } catch {
        // Storage can be unavailable in private or embedded browser contexts.
      }
      updateThemeControls();
      updateColorbarIfAvailable();
      if (render) renderIfAvailable();
    }

    function applyUiDepth(depth, refresh = true) {
      state.uiDepth = normalizeUiDepth(depth);
      uiCore.setExclusiveButtonState(el.uiDepthButtons, "uiDepthChoice", state.uiDepth, {
        selectedAttribute: "aria-pressed",
      });
      if (refresh && isControlTextReady()) {
        updateControlText();
      }
      if (refresh) renderIfAvailable();
    }

    function updateCanvasModeControls() {
      global.FdtdReactUI?.notify?.();
    }

    function updateCanvasInteractionState() {
      global.FdtdReactUI?.notify?.();
    }

    function setCanvasMode(mode) {
      const nextMode = mode === "brush" ? "brush" : "select";
      if (state.canvasMode === nextMode) {
        updateCanvasModeControls();
        updateCanvasInteractionState();
        return;
      }
      state.canvasMode = nextMode;
      clearCanvasHover(false);
      updateCanvasModeControls();
      updateCanvasInteractionState();
      renderIfAvailable();
    }

    function updateRunControls() {
      global.FdtdReactUI?.notify?.();
    }

    function updateFieldDisplayControls() {
      global.FdtdReactUI?.notify?.();
    }

    function updateVisualControls() {
      visualLayerModel.visualLayerSnapshot(state);
      global.FdtdReactUI?.notify?.();
      updateColorbarIfAvailable();
    }

    function setCustomVisualLayer(layer, enabled) {
      visualLayerModel.applyCustomVisualLayer(state, layer, enabled);
      updateVisualControls();
      renderIfAvailable();
    }

    return Object.freeze({
      applyTheme,
      applyUiDepth,
      setCanvasMode,
      setCustomVisualLayer,
      updateCanvasInteractionState,
      updateCanvasModeControls,
      updateFieldDisplayControls,
      updateRunControls,
      updateThemeControls,
      updateVisualControls,
    });
  }

  global.FdtdControlUiState = Object.freeze({
    createControlUiStateController,
  });
})(window);
