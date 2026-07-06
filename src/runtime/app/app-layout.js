(function initFdtdAppLayout(global) {
  "use strict";

  const COMPACT_CONTROLS_MEDIA_QUERY = "(max-width: 1023px), (max-height: 759px)";
  const COMPACT_RESULTS_MEDIA_QUERY = "(max-width: 1023px)";
  const COMPACT_PANEL_TITLE_MEDIA_QUERY = "(max-width: 430px)";

  function createLayoutController({
    state,
    el,
    constants,
    helpers,
    getSim,
    callbacks,
    windowRef = global,
    documentRef = global.document,
  }) {
    let automaticGridOrientationEnabled = true;

    function disableResponsiveGridOrientation() {
      automaticGridOrientationEnabled = false;
    }

    function enableResponsiveGridOrientation() {
      automaticGridOrientationEnabled = true;
    }

    function gridSizeMatches(grid, nx = state.gridNx, ny = state.gridNy) {
      return grid?.nx === nx && grid?.ny === ny;
    }

    function gridSizeIsAutoOrientable(nx = state.gridNx, ny = state.gridNy) {
      return (
        gridSizeMatches(constants.DEFAULT_GRID, nx, ny) ||
        gridSizeMatches(constants.PORTRAIT_GRID, nx, ny) ||
        gridSizeMatches(constants.PHONE_PORTRAIT_GRID, nx, ny)
      );
    }

    function viewportPrefersPortraitGrid() {
      const width = Math.max(1, windowRef.innerWidth || 1);
      const height = Math.max(1, windowRef.innerHeight || 1);
      return height / width >= 1.18;
    }

    function viewportPrefersPhonePortraitGrid() {
      const width = Math.max(1, windowRef.innerWidth || 1);
      const height = Math.max(1, windowRef.innerHeight || 1);
      return width <= 520 && height / width >= 1.42;
    }

    function mobileCanvasViewportActive() {
      return windowRef.matchMedia?.("(max-width: 760px)")?.matches ?? false;
    }

    function responsiveDefaultGrid() {
      if (viewportPrefersPhonePortraitGrid()) return constants.PHONE_PORTRAIT_GRID;
      return viewportPrefersPortraitGrid() ? constants.PORTRAIT_GRID : constants.DEFAULT_GRID;
    }

    function cssPixelValue(value) {
      const numeric = Number.parseFloat(value);
      return Number.isFinite(numeric) ? numeric : 0;
    }

    function stageLayoutChildVisible(element) {
      if (!element || element.hidden) return false;
      const style = getComputedStyle(element);
      if (style.display === "none" || style.position === "absolute" || style.position === "fixed") return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    }

    function availableCanvasFrameHeight(viewportHeight, compactViewport) {
      const mobileViewport = mobileCanvasViewportActive();
      const compactReserve = mobileViewport ? Math.min(130, viewportHeight * 0.16) : Math.min(230, viewportHeight * 0.28);
      const viewportTargetHeight = compactViewport ? viewportHeight - compactReserve : viewportHeight * constants.CANVAS_DISPLAY_VIEWPORT_FRACTION;
      if (!el.stage || !el.canvasFrame) return viewportTargetHeight;

      const stageRect = el.stage.getBoundingClientRect();
      if (!stageRect.height) return viewportTargetHeight;

      const stageStyle = getComputedStyle(el.stage);
      const paddingY = cssPixelValue(stageStyle.paddingTop) + cssPixelValue(stageStyle.paddingBottom);
      const rowGap = cssPixelValue(stageStyle.rowGap);
      const flowChildren = Array.from(el.stage.children).filter(stageLayoutChildVisible);
      const nonCanvasHeight = flowChildren
        .filter((child) => child !== el.canvasFrame)
        .reduce((height, child) => height + child.getBoundingClientRect().height, 0);
      const stageCanvasHeight = stageRect.height - nonCanvasHeight - paddingY - rowGap * Math.max(0, flowChildren.length - 1);
      if (mobileViewport) {
        return Math.max(1, stageCanvasHeight);
      }
      return Math.min(viewportTargetHeight, Math.max(1, stageCanvasHeight));
    }

    function updateCanvasAspectRatio(nx = state.gridNx, ny = state.gridNy) {
      if (!el.canvasFrame) return;
      const safeNx = Math.max(1, Number(nx) || constants.DEFAULT_GRID.nx);
      const safeNy = Math.max(1, Number(ny) || constants.DEFAULT_GRID.ny);
      const physicalAspect = safeNx / safeNy;
      const displayAspect = helpers.clamp(physicalAspect, constants.MIN_CANVAS_DISPLAY_ASPECT, constants.MAX_CANVAS_DISPLAY_ASPECT);
      const viewportHeight = Math.max(1, windowRef.innerHeight || constants.MAX_CANVAS_DISPLAY_HEIGHT);
      const compactViewport = windowRef.matchMedia?.(COMPACT_CONTROLS_MEDIA_QUERY)?.matches;
      const availableHeight = availableCanvasFrameHeight(viewportHeight, compactViewport);
      const targetHeight = helpers.clamp(availableHeight, 1, constants.MAX_CANVAS_DISPLAY_HEIGHT);
      el.canvasFrame.style.setProperty("--sim-aspect-ratio", `${displayAspect} / 1`);
      el.canvasFrame.style.setProperty("--sim-frame-width-limit", `${displayAspect * targetHeight}px`);
      el.canvasFrame.dataset.aspectCapped = String(Math.abs(displayAspect - physicalAspect) > 1e-6);
    }

    function updateRangeProgress(input) {
      if (!input) return;
      const min = Number(input.min || 0);
      const max = Number(input.max || 100);
      const value = Number(input.value);
      const progress = Number.isFinite(value) && max > min ? helpers.clamp(((value - min) / (max - min)) * 100, 0, 100) : 0;
      input.style.setProperty("--range-progress", `${progress}%`);
    }

    function updateAllRangeProgress() {
      documentRef.querySelectorAll('input[type="range"]').forEach(updateRangeProgress);
    }

    function applySimulationGridSize(nx, ny, { applyPreset = true, render = true } = {}) {
      const sim = getSim();
      callbacks.clearMaterialSelection(false);
      callbacks.clearCanvasHover(false);
      state.gridNx = helpers.clampInt(nx, 80, constants.MAX_GRID.nx);
      state.gridNy = helpers.clampInt(ny, 60, constants.MAX_GRID.ny);
      sim.resize(state.gridNx, state.gridNy);
      callbacks.clampAllSourcesToInterior();
      if (applyPreset) {
        sim.applyPreset(state.preset);
      }
      sim.measure();
      callbacks.updateControlText();
      callbacks.updateStats();
      if (render) {
        sim.render();
      }
    }

    function applyResponsiveGridOrientation({ render = true } = {}) {
      if (!automaticGridOrientationEnabled) return false;
      if (!gridSizeIsAutoOrientable()) {
        automaticGridOrientationEnabled = false;
        return false;
      }

      const targetGrid = responsiveDefaultGrid();
      if (gridSizeMatches(targetGrid)) return false;
      applySimulationGridSize(targetGrid.nx, targetGrid.ny, { applyPreset: true, render });
      return true;
    }

    function compactControlDrawerActive() {
      return windowRef.matchMedia?.(COMPACT_CONTROLS_MEDIA_QUERY)?.matches ?? false;
    }

    function compactResultsDetailsActive() {
      return windowRef.matchMedia?.(COMPACT_RESULTS_MEDIA_QUERY)?.matches ?? false;
    }

    return {
      disableResponsiveGridOrientation,
      enableResponsiveGridOrientation,
      gridSizeMatches,
      gridSizeIsAutoOrientable,
      viewportPrefersPortraitGrid,
      viewportPrefersPhonePortraitGrid,
      mobileCanvasViewportActive,
      responsiveDefaultGrid,
      cssPixelValue,
      stageLayoutChildVisible,
      availableCanvasFrameHeight,
      updateCanvasAspectRatio,
      updateRangeProgress,
      updateAllRangeProgress,
      applySimulationGridSize,
      applyResponsiveGridOrientation,
      compactControlDrawerActive,
      compactResultsDetailsActive,
      compactPanelTitleMediaQuery: COMPACT_PANEL_TITLE_MEDIA_QUERY,
      compactControlsMediaQuery: COMPACT_CONTROLS_MEDIA_QUERY,
      compactResultsMediaQuery: COMPACT_RESULTS_MEDIA_QUERY,
    };
  }

  global.FdtdAppLayout = {
    createLayoutController,
    COMPACT_CONTROLS_MEDIA_QUERY,
    COMPACT_RESULTS_MEDIA_QUERY,
    COMPACT_PANEL_TITLE_MEDIA_QUERY,
  };
})(window);
