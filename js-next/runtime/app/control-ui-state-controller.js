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
    const mobileCanvasViewportActive = requireFunction(
      dependencies.mobileCanvasViewportActive,
      "mobileCanvasViewportActive",
    );
    const fieldDisplayConfig = requireFunction(dependencies.fieldDisplayConfig, "fieldDisplayConfig");
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
      const fieldDisplayVisible = state.viewMode === "field" || state.viewMode === "poynting";
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

    function effectiveVisualProfileName() {
      return visualLayerModel.effectiveVisualProfile(state, {
        mobileCanvasViewportActive: mobileCanvasViewportActive(),
      });
    }

    function updateVisualControls() {
      const activeProfile = visualLayerModel.normalizedVisualProfile(state.visualProfile);
      const effectiveProfile = effectiveVisualProfileName();
      const visualSnapshot = visualLayerModel.visualLayerSnapshot(state, {
        mobileCanvasViewportActive: mobileCanvasViewportActive(),
        profile: effectiveProfile,
      });

      uiCore.setExclusiveButtonState(el.visualProfileButtons, "visualProfile", activeProfile, {
        selectedAttribute: "aria-pressed",
      });
      el.visualLayerInputs?.forEach?.((input) => {
        const layer = input.dataset.visualLayer;
        input.checked = Boolean(visualSnapshot[layer]);
      });
      if (el.visualGuideProfile) {
        el.visualGuideProfile.textContent = activeProfile === "auto" ? `Auto (${effectiveProfile})` : effectiveProfile;
      }
      if (el.visualGuideProjection) {
        el.visualGuideProjection.textContent = state.viewProjection === "3d" ? "3D surface" : "2D map";
      }
      if (el.visualGuideField) {
        const fieldLabel = state.viewMode === "field"
          ? "Field"
          : state.viewMode === "poynting"
            ? "Poynting"
            : state.viewMode === "epsilon"
              ? "Permittivity"
              : "Permeability";
        el.visualGuideField.innerHTML = `${fieldLabel} \u00b7 ${fieldDisplayConfig().labelHtml}`;
      }
      if (el.visualGuideScale) {
        el.visualGuideScale.textContent = `${state.wavelengthUm.toFixed(2)} \u00b5m \u00b7 ${state.cellsPerWavelength}/\u03bb\u2080`;
      }
      if (el.visualGuideOverlays) {
        el.visualGuideOverlays.textContent = visualLayerModel.visualOverlaySummary(state, { snapshot: visualSnapshot });
      }
      if (el.visualGuideNote) {
        el.visualGuideNote.textContent = visualLayerModel.visualGuideNoteText(state, { profile: effectiveProfile });
      }
      updateColorbarIfAvailable();
    }

    function applyVisualProfile(profile) {
      state.visualProfile = visualLayerModel.normalizedVisualProfile(profile);
      updateVisualControls();
      renderIfAvailable();
    }

    function setCustomVisualLayer(layer, enabled) {
      visualLayerModel.applyCustomVisualLayer(state, layer, enabled, {
        mobileCanvasViewportActive: mobileCanvasViewportActive(),
      });
      updateVisualControls();
      renderIfAvailable();
    }

    return Object.freeze({
      applyTheme,
      applyUiDepth,
      applyVisualProfile,
      effectiveVisualProfileName,
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
