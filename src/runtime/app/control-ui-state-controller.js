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
      const scientificTheme = state.theme === "dark" ? "g100" : "g10";
      const runtimeThemeChanged = documentElement.dataset.theme !== state.theme;
      const scientificThemeNeedsSync = documentElement.dataset.scientificTheme !== scientificTheme;
      documentElement.dataset.theme = state.theme;
      documentElement.classList.toggle("cds--g100", state.theme === "dark");
      documentElement.classList.toggle("cds--g10", state.theme !== "dark");
      documentElement.ownerDocument
        ?.querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", state.theme === "dark" ? "#161616" : "#f4f4f4");
      if (typeof windowRef.CustomEvent === "function" && typeof windowRef.dispatchEvent === "function") {
        if (scientificThemeNeedsSync) {
          windowRef.dispatchEvent(new windowRef.CustomEvent("scientific-ui:theme-change", {
            detail: { preference: state.theme },
          }));
        }
        if (runtimeThemeChanged || scientificThemeNeedsSync) {
          windowRef.dispatchEvent(new windowRef.CustomEvent("fdtd:theme-applied", { detail: { theme: state.theme } }));
        }
      }
    }

    function applyTheme(theme, render = true) {
      const nextTheme = normalizeTheme(theme);
      const scientificTheme = nextTheme === "dark" ? "g100" : "g10";
      const themeAlreadyApplied =
        state.theme === nextTheme
        && documentElement.dataset.theme === nextTheme
        && documentElement.dataset.scientificTheme === scientificTheme;
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
      const playPauseBtn = global.document?.getElementById?.("playPauseBtn") || el.playPauseBtn;
      if (playPauseBtn) {
        const label = running ? "Pause simulation" : "Start simulation";
        playPauseBtn.title = label;
        playPauseBtn.setAttribute("aria-label", label);
        uiCore.setPressed(playPauseBtn, running);
        if (el.runPlayPauseBtn) {
          el.runPlayPauseBtn.title = label;
          el.runPlayPauseBtn.setAttribute("aria-label", label);
          el.runPlayPauseBtn.setAttribute("aria-pressed", String(running));
        }
        if (el.runPlayPauseIcon) el.runPlayPauseIcon.textContent = running ? "\u2161" : "\u25b6";
      }
    }

    function updateFieldDisplayControls() {
      uiCore.setExclusiveButtonState(el.fieldDisplayButtons, "fieldDisplay", state.fieldDisplay, {
        selectedAttribute: "aria-pressed",
      });
      const materialView = state.viewMode === "epsilon" || state.viewMode === "mu";
      const materialOverlayAvailable = materialView && state.viewProjection === "2d";
      const fieldDisplayVisible = state.viewMode === "field" || (materialOverlayAvailable && state.materialFieldOverlay);
      if (el.fieldDisplayControl) el.fieldDisplayControl.hidden = !fieldDisplayVisible;
      el.visualComponentRows?.forEach?.((row) => {
        row.hidden = !fieldDisplayVisible;
      });
      el.materialFieldOverlayInputs?.forEach?.((input) => {
        input.checked = Boolean(state.materialFieldOverlay);
      });
      el.materialFieldOverlayControls?.forEach?.((control) => {
        control.hidden = !materialOverlayAvailable;
      });
      el.fieldQuiverInputs?.forEach?.((input) => {
        input.checked = Boolean(state.fieldQuiver);
      });
      const quiverSymbol = state.viewMode === "poynting" ? "S" : state.fieldComponent === "hz" ? "E" : "H";
      el.fieldQuiverLabels?.forEach?.((label) => {
        const symbol = global.document.createElement("i");
        symbol.textContent = quiverSymbol;
        label.replaceChildren(symbol, global.document.createTextNode(" quiver"));
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
