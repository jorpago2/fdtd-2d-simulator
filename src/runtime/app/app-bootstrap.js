(function initFdtdAppBootstrap(global) {
  "use strict";

  function runAppBootstrap({
    layoutControlBindingsModule,
    windowRef,
    documentRef,
    handleWindowResize,
    updateRangeProgress,
    applyUiDepth,
    state,
    buildSceneBrowser,
    sceneRepro,
    applyResponsiveGridOrientation,
    sim,
    updateControlPanelContext,
    updateControlText,
    updateStats,
    updatePerformanceStats,
    initWasmBackend,
    runtimeController,
  }) {
    layoutControlBindingsModule.bindLayoutControls({
      windowRef,
      documentRef,
      handleWindowResize,
      updateRangeProgress,
    });

    applyUiDepth(state.uiDepth, false);
    buildSceneBrowser();
    const sceneLoadedFromUrl = sceneRepro?.loadSceneFromUrlParam() ?? false;
    if (!sceneLoadedFromUrl) {
      const gridChanged = applyResponsiveGridOrientation({ render: false });
      if (!gridChanged) sim.applyPreset(state.preset);
    }
    sim.measure();
    updateControlPanelContext();
    updateControlText();
    updateStats();
    sim.render();
    updatePerformanceStats(true);
    initWasmBackend();
    runtimeController.startAnimationLoop();
  }

  global.FdtdAppBootstrap = {
    runAppBootstrap,
  };
})(window);
