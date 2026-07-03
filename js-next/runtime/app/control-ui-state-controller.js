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
      documentElement.dataset.theme = state.theme;
      uiCore.setExclusiveButtonState(el.themeButtons, "themeChoice", state.theme, {
        selectedAttribute: "aria-pressed",
      });
    }

    function applyTheme(theme, render = true) {
      state.theme = normalizeTheme(theme);
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
      uiCore.setPressed(el.selectModeBtn, state.canvasMode === "select");
      uiCore.setPressed(el.brushModeBtn, state.canvasMode === "brush");
    }

    function updateCanvasInteractionState() {
      el.canvasFrame?.classList.toggle("is-draw-mode", state.canvasMode === "brush");
      el.stage?.classList.toggle("is-draw-mode", state.canvasMode === "brush");
      el.canvas?.setAttribute("data-canvas-mode", state.canvasMode);
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
      const running = Boolean(state.running);
      if (el.playPauseIcon) {
        el.playPauseIcon.textContent = running ? "\u2161" : "\u25b6";
      }
      if (el.playPauseBtn) {
        const label = running ? "Pause simulation" : "Start simulation";
        el.playPauseBtn.title = label;
        el.playPauseBtn.setAttribute("aria-label", label);
        uiCore.setPressed(el.playPauseBtn, running);
      }
    }

    function updateFieldDisplayControls() {
      uiCore.setExclusiveButtonState(el.fieldDisplayButtons, "fieldDisplay", state.fieldDisplay, {
        selectedAttribute: "aria-pressed",
      });
      const fieldDisplayVisible = state.viewMode === "field";
      if (el.fieldDisplayControl) el.fieldDisplayControl.hidden = !fieldDisplayVisible;
      el.visualComponentRows?.forEach?.((row) => {
        row.hidden = !fieldDisplayVisible;
      });
      el.fieldQuiverInputs?.forEach?.((input) => {
        input.checked = Boolean(state.fieldQuiver);
      });
      const quiverAvailable =
        state.viewProjection === "2d" && (state.viewMode === "field" || state.viewMode === "poynting");
      el.fieldQuiverControls?.forEach?.((control) => {
        control.classList.toggle("is-disabled", !quiverAvailable);
      });
    }

    function updateVisualControls() {
      const visualSnapshot = visualLayerModel.visualLayerSnapshot(state);
      el.visualLayerInputs?.forEach?.((input) => {
        const layer = input.dataset.visualLayer;
        input.checked = Boolean(visualSnapshot[layer]);
      });
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
