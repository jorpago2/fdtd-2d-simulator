(function initFdtdRuntimeDependencies(global) {
  "use strict";

  const MAIN_SCRIPT = "src/runtime/app/main.js";

  const REQUIRED_MODULES = Object.freeze([
    ["appStateModule", "FdtdAppState", "app-state.js"],
    ["appFormattersModule", "FdtdAppFormatters", "app-formatters.js"],
    ["visualLayerModel", "FdtdVisualLayerModel", "visual-layer-model.js"],
    ["boundaryStateModule", "FdtdBoundaryState", "boundary-state.js"],
    ["uiCore", "FdtdUiCore", "ui-core.js"],
    ["uiDom", "FdtdUiDom", "ui-dom.js"],
    ["uiDrawerModule", "FdtdUiDrawer", "ui-drawer.js"],
    ["uiScenesModule", "FdtdUiScenes", "ui-scenes.js"],
    ["uiSceneGuideModule", "FdtdUiSceneGuide", "ui-scene-guide.js"],
    ["uiResultsModule", "FdtdUiResults", "ui-results.js"],
    ["uiResultsChartsModule", "FdtdUiResultsCharts", "ui-results-charts.js"],
    ["numericInputModule", "FdtdNumericInputController", "numeric-input-controller.js"],
    ["controlSyncUi", "FdtdControlSyncUi", "control-sync-ui.js"],
    ["sceneCodec", "FdtdSceneCodec", "scene-codec.js"],
    ["sourceMonitorModel", "FdtdSourceMonitorModel", "source-monitor-model.js"],
    ["sourceMonitorOperationsModule", "FdtdSourceMonitorOperations", "source-monitor-operations.js"],
    ["materialEditorModel", "FdtdMaterialEditorModel", "material-editor-model.js"],
    ["materialEditorUi", "FdtdMaterialEditorUi", "material-editor-ui.js"],
    ["materialOperationsModule", "FdtdMaterialOperations", "material-operations.js"],
    ["materialSelectionModule", "FdtdMaterialSelectionController", "material-selection-controller.js"],
    ["entitySelectionModule", "FdtdEntitySelectionController", "entity-selection-controller.js"],
    ["sceneApplicationModule", "FdtdSceneApplication", "scene-application.js"],
    ["stateNormalizerModule", "FdtdStateNormalizer", "state-normalizer.js"],
    ["simulationEffectsModule", "FdtdSimulationEffects", "simulation-effects.js"],
    ["runtimeControllerModule", "FdtdRuntimeController", "runtime-controller.js"],
    ["canvasRenderControllerModule", "FdtdCanvasRenderController", "canvas-render-controller.js"],
    ["canvasColorbarModule", "FdtdCanvasColorbar", "canvas-colorbar.js"],
    ["canvasExportModule", "FdtdCanvasExport", "canvas-export.js"],
    ["runtimeControlBindingsModule", "FdtdRuntimeControlBindings", "runtime-control-bindings.js"],
    ["visualControlBindingsModule", "FdtdVisualControlBindings", "visual-control-bindings.js"],
    ["resultsControlBindingsModule", "FdtdResultsControlBindings", "results-control-bindings.js"],
    ["sourceMonitorControlBindingsModule", "FdtdSourceMonitorControlBindings", "source-monitor-control-bindings.js"],
    ["materialControlBindingsModule", "FdtdMaterialControlBindings", "material-control-bindings.js"],
    ["configControlBindingsModule", "FdtdConfigControlBindings", "config-control-bindings.js"],
    ["brushControlBindingsModule", "FdtdBrushControlBindings", "brush-control-bindings.js"],
    ["shellControlBindingsModule", "FdtdShellControlBindings", "shell-control-bindings.js"],
    ["layoutControlBindingsModule", "FdtdLayoutControlBindings", "layout-control-bindings.js"],
    ["sceneReproModule", "FdtdSceneRepro", "scene-repro.js"],
    ["canvasInteractionModel", "FdtdCanvasInteractionModel", "canvas-interaction-model.js"],
    ["canvasPointerStateModule", "FdtdCanvasPointerState", "canvas-pointer-state.js"],
    ["canvasDragStateModule", "FdtdCanvasDragState", "canvas-drag-state.js"],
    ["canvasInteractionsModule", "FdtdCanvasInteractions", "canvas-interactions.js"],
    ["canvasSurfaceOrbitControllerModule", "FdtdCanvasSurfaceOrbitController", "canvas-surface-orbit-controller.js"],
    ["contextMenuModule", "FdtdContextMenuController", "context-menu-controller.js"],
    ["canvasContextActionsModule", "FdtdCanvasContextActions", "canvas-context-actions-controller.js"],
    ["appBootstrapModule", "FdtdAppBootstrap", "app-bootstrap.js"],
    ["appLayoutModule", "FdtdAppLayout", "app-layout.js"],
    ["appPerformanceModule", "FdtdAppPerformance", "app-performance.js"],
    ["controlUiStateModule", "FdtdControlUiState", "control-ui-state-controller.js"],
    ["sweepAnalysisModule", "FdtdSweepAnalysis", "sweep-analysis-controller.js"],
    ["materialStabilityModule", "FdtdMaterialStability", "material-stability-controller.js"],
    ["sourceMonitorEditorsModule", "FdtdSourceMonitorEditors", "source-monitor-editor-controller.js"],
    ["brushControlsModule", "FdtdBrushControls", "brush-controls-controller.js"],
    ["controlTextModule", "FdtdControlTextController", "control-text-controller.js"],
    ["sceneStateControllerModule", "FdtdSceneStateController", "scene-state-controller.js"],
    ["canvasEditActionsModule", "FdtdCanvasEditActions", "canvas-edit-actions-controller.js"],
    ["canvasGestureActionsModule", "FdtdCanvasGestureActions", "canvas-gesture-actions-controller.js"],
    ["configMaterialHandlersModule", "FdtdConfigMaterialHandlers", "config-material-handlers-controller.js"],
  ]);

  function resolveRuntimeDependencies(windowRef = global) {
    const dependencies = {};
    for (const [key, globalName, fileName] of REQUIRED_MODULES) {
      const moduleValue = windowRef[globalName];
      if (!moduleValue) {
        throw new Error(`src runtime module ${fileName} must be loaded before ${MAIN_SCRIPT}`);
      }
      dependencies[key] = moduleValue;
    }
    return dependencies;
  }

  global.FdtdRuntimeDependencies = Object.freeze({
    REQUIRED_MODULES,
    resolveRuntimeDependencies,
  });
})(window);
