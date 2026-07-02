"use strict";

const appStateModule = window.FdtdAppState;
const appFormattersModule = window.FdtdAppFormatters;
if (!appStateModule) {
  throw new Error("src/app-state.js must be loaded before app.js");
}

if (!appFormattersModule) {
  throw new Error("src/app-formatters.js must be loaded before app.js");
}
const {
  defaultMonitorConfig,
  normalizeTheme,
  normalizeUiDepth,
  createInitialAppState,
} = appStateModule;

const visualLayerModel = window.FdtdVisualLayerModel;
if (!visualLayerModel) {
  throw new Error("src/visual-layer-model.js must be loaded before app.js");
}

const VISUAL_LAYER_STATE_KEYS = visualLayerModel.VISUAL_LAYER_STATE_KEYS;

let canvasRenderController = null;
let canvasColorbarController = null;
let canvasExportController = null;
let sim = null;
let workerEngine = null;
let runtimeController = null;
let simulationEffects = null;
let stateNormalizer = null;
let sceneApplication = null;
let sceneRepro = null;
let sceneStateController = null;
let canvasEditActionsController = null;
let canvasGestureActionsController = null;

const state = createInitialAppState({
  defaultSourceConfig,
  defaultBoundarySides,
  defaultGrid: DEFAULT_GRID,
  themeStorageKey: THEME_STORAGE_KEY,
  windowRef: window,
});

document.documentElement.dataset.theme = state.theme;

const appFormatters = appFormattersModule.createAppFormatters({
  state,
  materialNames,
  inPlaneElectricCurrentShapes,
  circularDipoleSourceShapes,
  incidentFieldSourceShapes,
});
const {
  simulatedFieldLetter,
  simulatedFieldComponentHtml,
  simulatedFieldUnitHtml,
  scalarFieldComponentKey,
  solverModeLabel,
  transverseFieldLetter,
  transverseFieldUnitHtml,
  fieldComponentHtml,
  fieldDisplayConfig,
  currentSourceLetter,
  sourceShapeLabel,
  sourceCouplingLabel,
  sourceSummaryLabel,
  currentBrushLabel,
  monitorQuantityLabel,
  niceScaleLength,
  formatScaleBarValue,
  trimFixed,
  formatLambda,
  formatCompactLambda,
  formatLambdaOutput,
  formatSpeed,
} = appFormatters;

let materialSelectionController = null;
let materialSelection = { region: null };
let entitySelection = null;
let hoveredMaterialRegion = null;

function normalizeBoundaryMode(mode) {
  return mode === "reflective" ? "reflective" : "absorbing";
}

function normalizeDispersionModel(model) {
  return materialEditorModel.normalizeDispersionModel(model);
}

function dispersionAxesMask(value, fallback = 3) {
  if (typeof value === "number") return clampInt(value, 0, 3);
  if (Array.isArray(value)) {
    let mask = 0;
    value.forEach((axis) => {
      const normalized = String(axis).toLowerCase();
      if (normalized === "x" || normalized === "z") mask |= 1;
      if (normalized === "y") mask |= 2;
    });
    return mask || fallback;
  }
  const normalized = String(value || "").toLowerCase();
  if (normalized === "x" || normalized === "z") return 1;
  if (normalized === "y") return 2;
  if (normalized === "xy" || normalized === "both" || normalized === "all") return 3;
  return fallback;
}

function brushDispersionParams() {
  return materialEditorModel.brushDispersionParams(state, normalizeDispersionModel);
}

function brushConductivityParams() {
  return materialEditorModel.brushConductivityParams(state);
}

function brushPhaseChangeParams() {
  return materialEditorModel.brushPhaseChangeParams(state);
}

function brushGyrotropyValue() {
  return materialEditorModel.brushGyrotropyValue(state);
}

function normalizeBianisotropyKappa(value) {
  return materialEditorModel.normalizeBianisotropyKappa(value, BIANISOTROPY_KAPPA_LIMIT);
}

function brushBianisotropyValue() {
  return materialEditorModel.brushBianisotropyValue(state, BIANISOTROPY_KAPPA_LIMIT);
}

function normalizeBoundarySides() {
  const fallback = normalizeBoundaryMode(state.boundary);
  if (!state.boundarySides || typeof state.boundarySides !== "object") {
    state.boundarySides = {
      left: fallback,
      right: fallback,
      top: fallback,
      bottom: fallback,
    };
  }
  for (const side of BOUNDARY_SIDES) {
    state.boundarySides[side] = normalizeBoundaryMode(state.boundarySides[side] || fallback);
  }
  const modes = BOUNDARY_SIDES.map((side) => state.boundarySides[side]);
  state.boundary = modes.every((mode) => mode === "absorbing")
    ? "absorbing"
    : modes.every((mode) => mode === "reflective")
      ? "reflective"
      : "mixed";
  return state.boundarySides;
}

function boundarySideMode(side) {
  const sides = normalizeBoundarySides();
  return sides[side] || "absorbing";
}

function boundarySideIsAbsorbing(side) {
  return boundarySideMode(side) === "absorbing";
}

function anyAbsorbingBoundarySide() {
  return BOUNDARY_SIDES.some((side) => boundarySideIsAbsorbing(side));
}

function setBoundarySideMode(side, mode) {
  normalizeBoundarySides();
  if (!BOUNDARY_SIDES.includes(side)) return;
  state.boundarySides[side] = normalizeBoundaryMode(mode);
  normalizeBoundarySides();
}

function boundarySummaryLabel() {
  normalizeBoundarySides();
  if (state.boundary === "absorbing") return "PML absorbing";
  if (state.boundary === "reflective") return "reflective";
  const absorbing = BOUNDARY_SIDES.filter((side) => boundarySideIsAbsorbing(side))
    .map((side) => boundarySideLabels[side].toLowerCase())
    .join(", ");
  return `mixed boundary (${absorbing || "no"} PML)`;
}

const uiCore = window.FdtdUiCore;
const uiDom = window.FdtdUiDom;
const uiDrawerModule = window.FdtdUiDrawer;
const uiScenesModule = window.FdtdUiScenes;
const uiSceneGuideModule = window.FdtdUiSceneGuide;
const uiResultsModule = window.FdtdUiResults;
const uiResultsChartsModule = window.FdtdUiResultsCharts;
const controlSyncUi = window.FdtdControlSyncUi;
const sceneCodec = window.FdtdSceneCodec;
const sourceMonitorModel = window.FdtdSourceMonitorModel;
const sourceMonitorOperationsModule = window.FdtdSourceMonitorOperations;
const materialEditorModel = window.FdtdMaterialEditorModel;
const materialEditorUi = window.FdtdMaterialEditorUi;
const materialOperationsModule = window.FdtdMaterialOperations;
const materialSelectionModule = window.FdtdMaterialSelectionController;
const entitySelectionModule = window.FdtdEntitySelectionController;
const sceneApplicationModule = window.FdtdSceneApplication;
const stateNormalizerModule = window.FdtdStateNormalizer;
const simulationEffectsModule = window.FdtdSimulationEffects;
const runtimeControllerModule = window.FdtdRuntimeController;
const canvasRenderControllerModule = window.FdtdCanvasRenderController;
const canvasColorbarModule = window.FdtdCanvasColorbar;
const canvasExportModule = window.FdtdCanvasExport;
const runtimeControlBindingsModule = window.FdtdRuntimeControlBindings;
const visualControlBindingsModule = window.FdtdVisualControlBindings;
const resultsControlBindingsModule = window.FdtdResultsControlBindings;
const sourceMonitorControlBindingsModule = window.FdtdSourceMonitorControlBindings;
const materialControlBindingsModule = window.FdtdMaterialControlBindings;
const configControlBindingsModule = window.FdtdConfigControlBindings;
const brushControlBindingsModule = window.FdtdBrushControlBindings;
const shellControlBindingsModule = window.FdtdShellControlBindings;
const layoutControlBindingsModule = window.FdtdLayoutControlBindings;
const sceneReproModule = window.FdtdSceneRepro;
const canvasInteractionModel = window.FdtdCanvasInteractionModel;
const canvasPointerStateModule = window.FdtdCanvasPointerState;
const canvasDragStateModule = window.FdtdCanvasDragState;
const canvasInteractionsModule = window.FdtdCanvasInteractions;
const contextMenuModule = window.FdtdContextMenuController;
const appBootstrapModule = window.FdtdAppBootstrap;
const appLayoutModule = window.FdtdAppLayout;
const appPerformanceModule = window.FdtdAppPerformance;
const sweepAnalysisModule = window.FdtdSweepAnalysis;
const materialStabilityModule = window.FdtdMaterialStability;
const sourceMonitorEditorsModule = window.FdtdSourceMonitorEditors;
const brushControlsModule = window.FdtdBrushControls;
const inspectorModule = window.FdtdInspectorController;
const controlTextModule = window.FdtdControlTextController;
const sceneStateControllerModule = window.FdtdSceneStateController;
const canvasEditActionsModule = window.FdtdCanvasEditActions;
const canvasGestureActionsModule = window.FdtdCanvasGestureActions;
const configMaterialHandlersModule = window.FdtdConfigMaterialHandlers;
if (!uiCore) {
  throw new Error("src/ui-core.js must be loaded before app.js");
}
if (!uiDom) {
  throw new Error("src/ui-dom.js must be loaded before app.js");
}
if (!uiDrawerModule) {
  throw new Error("src/ui-drawer.js must be loaded before app.js");
}
if (!uiScenesModule) {
  throw new Error("src/ui-scenes.js must be loaded before app.js");
}
if (!uiSceneGuideModule) {
  throw new Error("src/ui-scene-guide.js must be loaded before app.js");
}
if (!uiResultsModule) {
  throw new Error("src/ui-results.js must be loaded before app.js");
}
if (!uiResultsChartsModule) {
  throw new Error("src/ui-results-charts.js must be loaded before app.js");
}
if (!controlSyncUi) {
  throw new Error("src/control-sync-ui.js must be loaded before app.js");
}
if (!sceneCodec) {
  throw new Error("src/scene-codec.js must be loaded before app.js");
}
if (!sourceMonitorModel) {
  throw new Error("src/source-monitor-model.js must be loaded before app.js");
}
if (!sourceMonitorOperationsModule) {
  throw new Error("src/source-monitor-operations.js must be loaded before app.js");
}
if (!materialEditorModel) {
  throw new Error("src/material-editor-model.js must be loaded before app.js");
}
if (!materialEditorUi) {
  throw new Error("src/material-editor-ui.js must be loaded before app.js");
}
if (!materialOperationsModule) {
  throw new Error("src/material-operations.js must be loaded before app.js");
}
if (!materialSelectionModule) {
  throw new Error("src/material-selection-controller.js must be loaded before app.js");
}
if (!entitySelectionModule) {
  throw new Error("src/entity-selection-controller.js must be loaded before app.js");
}
if (!sceneApplicationModule) {
  throw new Error("src/scene-application.js must be loaded before app.js");
}
if (!stateNormalizerModule) {
  throw new Error("src/state-normalizer.js must be loaded before app.js");
}
if (!simulationEffectsModule) {
  throw new Error("src/simulation-effects.js must be loaded before app.js");
}
if (!runtimeControllerModule) {
  throw new Error("src/runtime-controller.js must be loaded before app.js");
}
if (!canvasRenderControllerModule) {
  throw new Error("src/canvas-render-controller.js must be loaded before app.js");
}
if (!canvasColorbarModule) {
  throw new Error("src/canvas-colorbar.js must be loaded before app.js");
}
if (!canvasExportModule) {
  throw new Error("src/canvas-export.js must be loaded before app.js");
}
if (!runtimeControlBindingsModule) {
  throw new Error("src/runtime-control-bindings.js must be loaded before app.js");
}
if (!visualControlBindingsModule) {
  throw new Error("src/visual-control-bindings.js must be loaded before app.js");
}
if (!resultsControlBindingsModule) {
  throw new Error("src/results-control-bindings.js must be loaded before app.js");
}
if (!sourceMonitorControlBindingsModule) {
  throw new Error("src/source-monitor-control-bindings.js must be loaded before app.js");
}
if (!materialControlBindingsModule) {
  throw new Error("src/material-control-bindings.js must be loaded before app.js");
}
if (!configControlBindingsModule) {
  throw new Error("src/config-control-bindings.js must be loaded before app.js");
}
if (!brushControlBindingsModule) {
  throw new Error("src/brush-control-bindings.js must be loaded before app.js");
}
if (!shellControlBindingsModule) {
  throw new Error("src/shell-control-bindings.js must be loaded before app.js");
}
if (!layoutControlBindingsModule) {
  throw new Error("src/layout-control-bindings.js must be loaded before app.js");
}
if (!sceneReproModule) {
  throw new Error("src/scene-repro.js must be loaded before app.js");
}
if (!canvasInteractionModel) {
  throw new Error("src/canvas-interaction-model.js must be loaded before app.js");
}
if (!canvasPointerStateModule) {
  throw new Error("src/canvas-pointer-state.js must be loaded before app.js");
}
if (!canvasDragStateModule) {
  throw new Error("src/canvas-drag-state.js must be loaded before app.js");
}
if (!canvasInteractionsModule) {
  throw new Error("src/canvas-interactions.js must be loaded before app.js");
}
if (!contextMenuModule) {
  throw new Error("src/context-menu-controller.js must be loaded before app.js");
}
if (!appBootstrapModule) {
  throw new Error("src/app-bootstrap.js must be loaded before app.js");
}
if (!appLayoutModule) {
  throw new Error("src/app-layout.js must be loaded before app.js");
}
if (!appPerformanceModule) {
  throw new Error("src/app-performance.js must be loaded before app.js");
}
if (!sweepAnalysisModule) {
  throw new Error("src/sweep-analysis-controller.js must be loaded before app.js");
}
if (!materialStabilityModule) {
  throw new Error("src/material-stability-controller.js must be loaded before app.js");
}
if (!sourceMonitorEditorsModule) {
  throw new Error("src/source-monitor-editor-controller.js must be loaded before app.js");
}
if (!brushControlsModule) {
  throw new Error("src/brush-controls-controller.js must be loaded before app.js");
}
if (!inspectorModule) {
  throw new Error("src/inspector-controller.js must be loaded before app.js");
}
if (!controlTextModule) {
  throw new Error("src/control-text-controller.js must be loaded before app.js");
}
if (!sceneStateControllerModule) {
  throw new Error("src/scene-state-controller.js must be loaded before app.js");
}
if (!canvasEditActionsModule) {
  throw new Error("src/canvas-edit-actions-controller.js must be loaded before app.js");
}
if (!canvasGestureActionsModule) {
  throw new Error("src/canvas-gesture-actions-controller.js must be loaded before app.js");
}
if (!configMaterialHandlersModule) {
  throw new Error("src/config-material-handlers-controller.js must be loaded before app.js");
}
const SCENE_SHARE_URL_LIMIT = sceneCodec.SCENE_SHARE_URL_LIMIT;
const SERIALIZABLE_STATE_KEYS = sceneCodec.SERIALIZABLE_STATE_KEYS;
const el = uiDom.validateDomRefs(uiDom.collectDomRefs(document));
materialSelectionController = materialSelectionModule.createMaterialSelectionController();
materialSelection = materialSelectionController.state;
entitySelection = entitySelectionModule.createEntitySelectionController({
  state,
  materialSelectionController,
});
const sceneBrowser = uiScenesModule.createSceneBrowserController({
  el,
  getCurrentPreset: () => state.preset,
  onSelectScene: (value) => selectScenePreset(value),
  sceneDescriptions,
});
const sceneGuide = uiSceneGuideModule.createSceneGuideController({
  documentRef: document,
  panel: el.sceneGuidePanel,
  getContext: () => {
    const sourceShape = state.sourceDefaults?.shape || state.sources?.[0]?.shape;
    return {
      sourceHint: sourceShape ? sourceShapeLabel(sourceShape) : "configured source",
      solver: solverModeLabel(),
    };
  },
});
const resultsView = uiResultsModule.createResultsController({
  documentRef: document,
  el,
  formatDiagnosticRatio,
  formatFieldValue,
  measureCustomMonitors: () => sim.measureCustomMonitors(),
  monitorQuantityLabel,
});
const resultsCharts = uiResultsChartsModule.createResultsChartsController({
  el,
  formatDiagnosticRatio,
  formatFieldValue,
  formatSweepValue,
});
let appLayoutController = null;
function layoutController() {
  if (!appLayoutController) {
    appLayoutController = appLayoutModule.createLayoutController({
      state,
      el,
      constants: {
        DEFAULT_GRID,
        PORTRAIT_GRID,
        PHONE_PORTRAIT_GRID,
        MAX_GRID,
        MIN_CANVAS_DISPLAY_ASPECT,
        MAX_CANVAS_DISPLAY_ASPECT,
        MAX_CANVAS_DISPLAY_HEIGHT,
        CANVAS_DISPLAY_VIEWPORT_FRACTION,
      },
      helpers: { clamp, clampInt },
      getSim: () => sim,
      callbacks: {
        clearMaterialSelection,
        clearCanvasHover,
        clampAllSourcesToInterior,
        updateControlText,
        updateStats,
      },
      windowRef: window,
      documentRef: document,
    });
  }
  return appLayoutController;
}

function disableResponsiveGridOrientation() {
  return layoutController().disableResponsiveGridOrientation();
}

function gridSizeMatches(grid, nx = state.gridNx, ny = state.gridNy) {
  return layoutController().gridSizeMatches(grid, nx, ny);
}

function gridSizeIsAutoOrientable(nx = state.gridNx, ny = state.gridNy) {
  return layoutController().gridSizeIsAutoOrientable(nx, ny);
}

function viewportPrefersPortraitGrid() {
  return layoutController().viewportPrefersPortraitGrid();
}

function viewportPrefersPhonePortraitGrid() {
  return layoutController().viewportPrefersPhonePortraitGrid();
}

function mobileCanvasViewportActive() {
  return layoutController().mobileCanvasViewportActive();
}

function responsiveDefaultGrid() {
  return layoutController().responsiveDefaultGrid();
}

function applySimulationGridSize(nx, ny, options = {}) {
  return layoutController().applySimulationGridSize(nx, ny, options);
}

function applyResponsiveGridOrientation(options = {}) {
  return layoutController().applyResponsiveGridOrientation(options);
}

function cssPixelValue(value) {
  return layoutController().cssPixelValue(value);
}

function stageLayoutChildVisible(element) {
  return layoutController().stageLayoutChildVisible(element);
}

function availableCanvasFrameHeight(viewportHeight, compactViewport) {
  return layoutController().availableCanvasFrameHeight(viewportHeight, compactViewport);
}

function updateCanvasAspectRatio(nx = state.gridNx, ny = state.gridNy) {
  return layoutController().updateCanvasAspectRatio(nx, ny);
}

function updateRangeProgress(input) {
  return layoutController().updateRangeProgress(input);
}

function updateAllRangeProgress() {
  return layoutController().updateAllRangeProgress();
}

function normalizeSceneText(value) {
  return uiScenesModule.normalizeSceneText(value);
}

function cleanSceneGroupLabel(label) {
  return uiScenesModule.cleanSceneGroupLabel(label);
}

function parseSceneOptionLabel(label) {
  return uiScenesModule.parseSceneOptionLabel(label);
}

function sceneBadgeLabels(record) {
  return uiScenesModule.sceneBadgeLabels(record);
}

function sceneThumbnailKind(record) {
  return uiScenesModule.sceneThumbnailKind(record);
}

function collectSceneRecords() {
  return sceneBrowser.collectSceneRecords();
}

function sceneSearchTerms() {
  return sceneBrowser.sceneSearchTerms();
}

function sceneRecordMatchesSearch(record, terms = sceneSearchTerms()) {
  return sceneBrowser.sceneRecordMatchesSearch(record, terms);
}

function visibleSceneRecords() {
  return sceneBrowser.visibleSceneRecords();
}

function renderSceneFilterBar() {
  sceneBrowser.renderSceneFilterBar();
}

function sceneRecordByValue(value) {
  return sceneBrowser.sceneRecordByValue(value);
}

function currentSceneRecordFallback(value = state.preset) {
  return sceneBrowser.currentSceneRecordFallback(value);
}

function updateSceneGuidePanel() {
  const record = sceneRecordByValue(state.preset) || currentSceneRecordFallback(state.preset);
  sceneGuide.update(record);
}

function updateSceneBrowserMeta(records) {
  sceneBrowser.updateSceneBrowserMeta(records);
}

function renderSceneCards() {
  sceneBrowser.renderSceneCards();
}

function syncSceneBrowserSelection(options) {
  sceneBrowser.syncSceneBrowserSelection(options);
}

function buildSceneBrowser() {
  sceneBrowser.buildSceneBrowser();
}

function selectScenePreset(value) {
  if (!el.presetInput || !value) return;
  el.presetInput.value = value;
  applySelectedPreset();
}

let inspectorController = null;
function inspector() {
  if (!inspectorController) {
    throw new Error("Inspector controller is not initialized.");
  }
  return inspectorController;
}

function updateInspector() {
  return inspector().updateInspector();
}

function materialRegionSignature(region) {
  if (!region?.bounds) return "";
  const b = region.bounds;
  return `${region.cells?.length || 0}:${b.minX},${b.minY},${b.maxX},${b.maxY}`;
}

function sourceClientPoint(source) {
  const rect = el.canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const x = sim.gridToCanvasX(sim.sourceXCell(source) + 0.5) / dpr + rect.left;
  const y = sim.gridToCanvasY(sim.sourceYCell(source) + 0.5) / dpr + rect.top;
  return { x, y };
}

function materialRegionClientPoint(region) {
  const rect = el.canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const b = region.bounds;
  const centerX = (b.minX + b.maxX + 1) * 0.5;
  const centerY = (b.minY + b.maxY + 1) * 0.5;
  return {
    x: sim.gridToCanvasX(centerX) / dpr + rect.left,
    y: sim.gridToCanvasY(centerY) / dpr + rect.top,
  };
}

function monitorClientPoint(monitor) {
  const rect = el.canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const x = sim.gridToCanvasX(sim.monitorXCell(monitor) + 0.5) / dpr + rect.left;
  const y = sim.gridToCanvasY(sim.monitorYCell(monitor) + 0.5) / dpr + rect.top;
  return { x, y };
}

function clearCanvasHover(render = true) {
  if (state.hoveredSourceId == null && state.hoveredMonitorId == null && !hoveredMaterialRegion) return;
  state.hoveredSourceId = null;
  state.hoveredMonitorId = null;
  hoveredMaterialRegion = null;
  if (render) sim.render();
}

function updateCanvasHover(event) {
  if (
    state.canvasMode !== "select" ||
    pointerState.pointerDown ||
    dragState.source.pointerId != null ||
    dragState.monitor.pointerId != null ||
    dragState.material.pointerId != null ||
    pointerState.panPointerId != null
  ) {
    clearCanvasHover();
    return;
  }
  const source = sim.sourceAtClientPoint(event.clientX, event.clientY);
  const monitor = source ? null : sim.monitorAtClientPoint(event.clientX, event.clientY);
  const previousSourceId = state.hoveredSourceId;
  const previousMonitorId = state.hoveredMonitorId;
  const previousRegionKey = materialRegionSignature(hoveredMaterialRegion);
  if (source) {
    state.hoveredSourceId = source.id;
    state.hoveredMonitorId = null;
    hoveredMaterialRegion = null;
  } else if (monitor) {
    state.hoveredSourceId = null;
    state.hoveredMonitorId = monitor.id;
    hoveredMaterialRegion = null;
  } else {
    state.hoveredSourceId = null;
    state.hoveredMonitorId = null;
    hoveredMaterialRegion = sim.findMaterialRegionAtClientPoint(event.clientX, event.clientY);
  }
  const nextRegionKey = materialRegionSignature(hoveredMaterialRegion);
  if (previousSourceId !== state.hoveredSourceId || previousMonitorId !== state.hoveredMonitorId || previousRegionKey !== nextRegionKey) {
    sim.render();
  }
}

const uiDrawer = uiDrawerModule.createDrawerController({
  callbacks: {
    onResultsTabActivated: () => renderCustomMonitorResults({ force: true }),
    refreshControlPanelData,
  },
  compactControlsMediaQuery: appLayoutModule.COMPACT_CONTROLS_MEDIA_QUERY,
  compactPanelTitleMediaQuery: appLayoutModule.COMPACT_PANEL_TITLE_MEDIA_QUERY,
  compactResultsMediaQuery: appLayoutModule.COMPACT_RESULTS_MEDIA_QUERY,
  el,
  uiCore,
});

function setMobileLayerActive(layerName) {
  uiDrawer.setMobileLayerActive(layerName);
}

function activeMobileLayerName() {
  return uiDrawer.activeMobileLayerName();
}

function focusControlPanelSection(selector) {
  uiDrawer.focusControlPanelSection(selector);
}

function activeControlTabName() {
  return uiDrawer.activeControlTabName();
}

function updateControlPanelContext(layerName) {
  uiDrawer.updateControlPanelContext(layerName);
}

function controlTabLayerName(tabName) {
  return uiDrawer.controlTabLayerName(tabName);
}

function activateControlTab(tabName, options = {}) {
  uiDrawer.activateControlTab(tabName, options);
}

function activateMobileLayer(layerName) {
  uiDrawer.activateMobileLayer(layerName);
}

function compactControlDrawerActive() {
  return uiDrawer.compactControlDrawerActive();
}

function compactResultsDetailsActive() {
  return layoutController().compactResultsDetailsActive();
}

function syncResultsDetailPanels(force = false) {
  uiDrawer.syncResultsDetailPanels(force);
}

function controlDrawerOverlayActive() {
  return uiDrawer.controlDrawerOverlayActive();
}

function setControlDrawerOpen(open) {
  uiDrawer.setControlDrawerOpen(open);
}

function refreshControlPanelData() {
  updateControlText();
  updateInspector();
  updateStats();
}

function closeControlDrawer() {
  uiDrawer.closeControlDrawer();
}

function toggleControlDrawer() {
  uiDrawer.toggleControlDrawer();
}

function canvasActionsMenuActive() {
  return uiDrawer.canvasActionsMenuActive();
}

function setCanvasActionsOpen(open) {
  uiDrawer.setCanvasActionsOpen(open);
}

function closeCanvasActionsMenu() {
  uiDrawer.closeCanvasActionsMenu();
}

function toggleCanvasActionsMenu() {
  uiDrawer.toggleCanvasActionsMenu();
}

function canvasOptionsMenuActive() {
  return uiDrawer.canvasOptionsMenuActive();
}

function setCanvasOptionsOpen(open) {
  uiDrawer.setCanvasOptionsOpen(open);
}

function closeCanvasOptionsMenu() {
  uiDrawer.closeCanvasOptionsMenu();
}

function toggleCanvasOptionsMenu() {
  uiDrawer.toggleCanvasOptionsMenu();
}

function handleControlTabKeydown(event) {
  uiDrawer.handleControlTabKeydown(event);
}

function lambdaToCells(valueLambda) {
  return Math.round((Number(valueLambda) || 0) * state.cellsPerWavelength);
}

function cellsToLambda(cells) {
  return cells / state.cellsPerWavelength;
}




function maxSourceXLambda() {
  return cellsToLambda(sim.sourcePlacementMaxX());
}

function maxSourceYLambda() {
  return cellsToLambda(sim.sourcePlacementMaxY());
}

function minSourceXLambda() {
  return cellsToLambda(sim.sourcePlacementMinX());
}

function minSourceYLambda() {
  return cellsToLambda(sim.sourcePlacementMinY());
}




let performanceController = null;
function getPerformanceController() {
  if (!performanceController) {
    performanceController = appPerformanceModule.createPerformanceController({
      el,
      state,
      getSim: () => sim,
      getRuntimeController: () => runtimeController,
    });
    window.fdtdPerformance = {
      now: performanceController.now,
      record: performanceController.record,
    };
  }
  return performanceController;
}

function performanceNowMs() {
  return getPerformanceController().now();
}

function recordPerformanceMetric(name, elapsedMs, sampleCount = 1) {
  return getPerformanceController().record(name, elapsedMs, sampleCount);
}

function timeStepBatch(stepCount, runner) {
  return getPerformanceController().timeStepBatch(stepCount, runner);
}

function instrumentSimulationPerformance(targetSim) {
  return getPerformanceController().instrumentSimulation(targetSim);
}

function resetPerformanceStats() {
  return getPerformanceController().reset();
}

function formatPerformanceMs(value, samples) {
  return getPerformanceController().formatMs(value, samples);
}

function formatPerformanceRate(stepMs, samples) {
  return getPerformanceController().formatRate(stepMs, samples);
}

function runtimeEngineLabel() {
  return getPerformanceController().runtimeEngineLabel();
}

function updatePerformanceStats(force = false) {
  return getPerformanceController().update(force);
}

function sourceBoundsLambda() {
  return {
    minX: minSourceXLambda(),
    maxX: maxSourceXLambda(),
    minY: minSourceYLambda(),
    maxY: maxSourceYLambda(),
  };
}

function monitorBoundsLambda() {
  return {
    minX: minMonitorXLambda(),
    maxX: maxMonitorXLambda(),
    minY: minMonitorYLambda(),
    maxY: maxMonitorYLambda(),
  };
}

const sourceMonitorOperations = sourceMonitorOperationsModule.createSourceMonitorOperations({
  state,
  sourceMonitorModel,
  defaultSourceConfig,
  defaultMonitorConfig,
  sourceShapeLabels,
  getSourceBounds: sourceBoundsLambda,
  getMonitorBounds: monitorBoundsLambda,
  getEntitySelection: () => entitySelection,
});
const {
  sourceModelContext,
  monitorModelContext,
  normalizeSource,
  makeSource,
  selectedSource,
  replacePrimarySource,
  addSource,
  deleteSource,
  explicitlySelectedSource,
  clampAllSourcesToInterior,
  normalizeMonitor,
  makeMonitor,
  selectedMonitor,
  explicitlySelectedMonitor,
  addMonitor,
  deleteMonitor,
  clampAllMonitorsToInterior,
} = sourceMonitorOperations;

function sourceUsesWidth(shape) {
  return localizedSourceShapes.has(shape) || inPlaneElectricCurrentShapes.has(shape) || shape === "evanescentLine";
}

function sourceUsesAngle(shape) {
  return (
    incidentFieldSourceShapes.has(shape) ||
    inPlaneElectricCurrentShapes.has(shape) ||
    shape === "pointDipole" ||
    shape === "dipole" ||
    circularDipoleSourceShapes.has(shape) ||
    shape === "janusDipole" ||
    shape === "huygens" ||
    shape === "quadrupole" ||
    shape === "multipole"
  );
}

function sourceUsesMultipoleControls(shape) {
  return shape === "multipole";
}

function setControlDisabled(control, inputOrInputs, disabled) {
  if (!control) return;
  control.classList.toggle("is-disabled", disabled);
  const inputs = Array.isArray(inputOrInputs) ? inputOrInputs : [inputOrInputs];
  inputs.forEach((input) => {
    if (input) input.disabled = disabled;
  });
}
const { materialKindFromCode, dominantMaterialKind } = materialOperationsModule;
const materialOperations = materialOperationsModule.createMaterialOperations({
  state,
  getSim: () => sim,
  getEntitySelection: () => entitySelection,
  getMaterialSelection: () => materialSelection,
  getDragStateController: () => dragStateController,
  getSimulationEffects: () => simulationEffects,
  selectedSource: explicitlySelectedSource,
  selectedMonitor: explicitlySelectedMonitor,
  callbacks: {
    updateInspector,
    updateControlText,
    closeMonitorMenu,
    closeSourceMenu,
    closeBrushMenu,
    deleteSource,
    deleteMonitor,
  },
});
const {
  clearMaterialSelection,
  deleteSelectedElement,
  selectMaterialRegion,
  selectMaterialRegionAt,
  applyMaterialKindToSelection,
} = materialOperations;

let brushControlsController = null;
function brushControls() {
  if (!brushControlsController) {
    throw new Error("Brush controls controller is not initialized.");
  }
  return brushControlsController;
}

function normalizeBrushGeometryState() {
  return brushControls().normalizeBrushGeometryState();
}

function geometryUsesWidth(shape = state.brushGeometry) {
  return brushControls().geometryUsesWidth(shape);
}

function geometryUsesHeight(shape = state.brushGeometry) {
  return brushControls().geometryUsesHeight(shape);
}

function geometryUsesRadius(shape = state.brushGeometry) {
  return brushControls().geometryUsesRadius(shape);
}

function geometryUsesInnerRadius(shape = state.brushGeometry) {
  return brushControls().geometryUsesInnerRadius(shape);
}

function updateBrushControls() {
  return brushControls().updateBrushControls();
}

let materialStabilityController = null;
function materialStability() {
  if (!materialStabilityController) {
    throw new Error("Material stability controller is not initialized.");
  }
  return materialStabilityController;
}

function updateMaterialWarning() {
  return materialStability().updateMaterialWarning();
}

function updateStabilitySummary() {
  return materialStability().updateStabilitySummary();
}

let sourceMonitorEditorController = null;
function sourceMonitorEditors() {
  if (!sourceMonitorEditorController) {
    throw new Error("Source/monitor editor controller is not initialized.");
  }
  return sourceMonitorEditorController;
}

function activeSourceEditorTarget() {
  return sourceMonitorEditors().activeSourceEditorTarget();
}

function activeMonitorEditorTarget() {
  return sourceMonitorEditors().activeMonitorEditorTarget();
}

function sourceTypeLabel(type) {
  return sourceMonitorEditors().sourceTypeLabel(type);
}

function updateSourceShapeOptionLabels() {
  return sourceMonitorEditors().updateSourceShapeOptionLabels();
}

function populateSourceEditor(source) {
  return sourceMonitorEditors().populateSourceEditor(source);
}

function readSourceEditorValues() {
  return sourceMonitorEditors().readSourceEditorValues();
}

function syncSourceEditorTarget() {
  return sourceMonitorEditors().syncSourceEditorTarget();
}

function populateMonitorEditor(monitor) {
  return sourceMonitorEditors().populateMonitorEditor(monitor);
}

function readMonitorEditorValues() {
  return sourceMonitorEditors().readMonitorEditorValues();
}

function syncMonitorEditorTarget() {
  return sourceMonitorEditors().syncMonitorEditorTarget();
}

function gridPointToSourcePosition(point) {
  const x = clampInt(point.x, sim.sourcePlacementMinX(), sim.sourcePlacementMaxX());
  const y = clampInt(point.y, sim.sourcePlacementMinY(), sim.sourcePlacementMaxY());
  return {
    xLambda: cellsToLambda(x),
    yLambda: cellsToLambda(y),
  };
}

function gridPointToMonitorPosition(point) {
  const x = clampInt(point.x, sim.activeInteriorMinX(), sim.activeInteriorMaxX());
  const y = clampInt(point.y, sim.activeInteriorMinY(), sim.activeInteriorMaxY());
  return {
    xLambda: cellsToLambda(x),
    yLambda: cellsToLambda(y),
  };
}

function openCanvasContextMenuAt(clientX, clientY) {
  if (!el.canvasContextMenu) return;
  clearMaterialSelection(false);
  const point = sim.clientToGridCell(clientX, clientY);
  if (el.canvasContextMenuHint) {
    el.canvasContextMenuHint.textContent = `x / λ0 ${formatLambda(cellsToLambda(point.x))}, y / λ0 ${formatLambda(cellsToLambda(point.y))}`;
  }
  contextMenus.openCanvasContextMenuAt(clientX, clientY, point);
  sim.render();
}

function openSourceMenuAt(clientX, clientY, source = null) {
  if (!el.sourceMenu) return;
  let draft = null;
  let mode = "add";
  if (source) {
    mode = "edit";
    entitySelection.selectSource(source.id);
  } else {
    const point = sim.clientToGridCell(clientX, clientY);
    draft = makeSource(gridPointToSourcePosition(point), false);
  }
  contextMenus.openSourceMenuAt(clientX, clientY, { mode, draft });
  updateControlText();
  sim.render();
}

function closeSourceMenu() {
  contextMenus.closeSourceMenu();
}

function openMonitorMenuAt(clientX, clientY, monitor = null) {
  if (!el.monitorMenu) return;
  let draft = null;
  let mode = "add";
  if (monitor) {
    mode = "edit";
    entitySelection.selectMonitor(monitor.id);
  } else {
    const point = sim.clientToGridCell(clientX, clientY);
    draft = makeMonitor(gridPointToMonitorPosition(point), false);
  }
  contextMenus.openMonitorMenuAt(clientX, clientY, { mode, draft });
  updateControlText();
  sim.render();
}

function closeMonitorMenu() {
  contextMenus.closeMonitorMenu();
}

function closeCanvasContextMenu() {
  contextMenus.closeCanvasContextMenu();
}

function openBrushMenuAt(clientX, clientY, options = {}) {
  if (!el.brushMenu) return;
  const mode = options.mode === "region" ? "region" : "brush";
  contextMenus.openBrushMenuAt(clientX, clientY, { mode });
  if (mode === "brush") {
    state.canvasMode = "brush";
  }
  updateControlText();
  sim.render();
}

function closeBrushMenu() {
  contextMenus.closeBrushMenu();
}

function updateBoundaryMenuControls() {
  normalizeBoundarySides();
  if (el.boundaryMenuInput) {
    el.boundaryMenuInput.value = boundarySideMode(contextMenuState.boundaryMenuSide);
  }
  if (el.boundaryMenuHint) {
    const sideLabel = boundarySideLabels[contextMenuState.boundaryMenuSide] || "Boundary";
    const modeLabel = boundarySideIsAbsorbing(contextMenuState.boundaryMenuSide) ? "PML absorbing" : "reflective";
    el.boundaryMenuHint.textContent = `${sideLabel} boundary · ${modeLabel}`;
  }
}

function openBoundaryMenuAt(clientX, clientY) {
  if (!el.boundaryMenu) return;
  const side = sim.boundarySideAtClientPoint(clientX, clientY) || contextMenuState.boundaryMenuSide || "top";
  contextMenus.openBoundaryMenuAt(clientX, clientY, side);
  updateBoundaryMenuControls();
  sim.render();
}

function closeBoundaryMenu() {
  contextMenus.closeBoundaryMenu();
}

function closeContextMenus() {
  contextMenus.closeContextMenus();
}

function applySourceMenu() {
  simulationEffects.commit({ dirty: true, disableResponsiveGrid: true });
  const values = readSourceEditorValues();
  const componentChanged = inPlaneElectricCurrentShapes.has(values.shape) && state.fieldComponent !== "hz";
  if (componentChanged) {
    state.fieldComponent = "hz";
  }
  if (contextMenuState.sourceMenuMode === "add") {
    addSource(values);
  } else {
    const source = selectedSource();
    if (source) {
      Object.assign(source, values);
      normalizeSource(source);
      state.sourceDefaults = { ...source };
      delete state.sourceDefaults.id;
    }
  }
  closeSourceMenu();
  if (componentChanged) {
    sim.resetFields();
  }
  simulationEffects.commitSourceMutation({ dirty: false, disableResponsiveGrid: false });
}

function applyMonitorMenu() {
  simulationEffects.commit({ disableResponsiveGrid: true });
  const values = readMonitorEditorValues();
  if (contextMenuState.monitorMenuMode === "add") {
    addMonitor(values);
  } else {
    const monitor = explicitlySelectedMonitor();
    if (monitor) {
      Object.assign(monitor, values);
      normalizeMonitor(monitor);
      state.monitorDefaults = { ...monitor };
      delete state.monitorDefaults.id;
    }
  }
  closeMonitorMenu();
  simulationEffects.commitMonitorMutation({ disableResponsiveGrid: false });
}

let controlTextController = null;
function controlText() {
  if (!controlTextController) {
    throw new Error("Control text controller is not initialized.");
  }
  return controlTextController;
}

function updateControlText() {
  return controlText().updateControlText();
}
function updateResultsInsight(diagnosticReflectance, diagnosticTransmittance, diagnosticBalance) {
  resultsView.updateInsight({
    balance: diagnosticBalance,
    diagnosticsEnabled: state.diagnosticsEnabled,
    lastDiverged: sim.lastDiverged,
    reflectance: diagnosticReflectance,
    samples: sim.diagnosticSamples || 0,
    transmittance: diagnosticTransmittance,
  });
}

function customMonitorResultsVisible() {
  return resultsView.customMonitorResultsVisible();
}

function renderCustomMonitorResults({ force = false } = {}) {
  resultsView.renderCustomMonitorResults({ force, monitorCount: state.monitors.length });
}

function updateStats() {
  const engineText = runtimeEngineLabel();
  const diagnosticAngle = sim.diagnosticSamples > 0 ? sim.diagnosticAngleDeg : sim.diagnosticDirection().angleDeg;
  const diagnosticAngleText = `${formatMonitorAngle(diagnosticAngle)}°`;
  const diagnosticReflectance = sim.diagnosticReflectance || 0;
  const diagnosticTransmittance = sim.diagnosticTransmittance || 0;
  const diagnosticBalance = sim.diagnosticSamples > 0 ? 1 - diagnosticReflectance - diagnosticTransmittance : 0;
  resultsView.updateDiagnostics({
    angleText: diagnosticAngleText,
    balance: diagnosticBalance,
    diagnosticsEnabled: state.diagnosticsEnabled,
    engineText,
    incidentPower: sim.diagnosticIncidentPower || 0,
    lastDiverged: sim.lastDiverged,
    monitorCount: state.monitors.length,
    reflectedPower: sim.diagnosticReflectedPower || 0,
    reflectance: diagnosticReflectance,
    samples: sim.diagnosticSamples || 0,
    transmittedPower: sim.diagnosticTransmittedPower || 0,
    transmittance: diagnosticTransmittance,
  });
  updateMaterialWarning();
  if (sim.lastDiverged || sim.time % 20 === 0) {
    updateStabilitySummary();
  }
  updateAnalysisControls();
  updatePerformanceStats();
}

function finalizeDeferredResults({ render = true } = {}) {
  sim.updateDiagnostics?.({ forceAnalysis: true });
  sim.measure();
  updateStats();
  if (render) sim.render();
}

function formatDiagnosticRatio(value) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) < 1e-12) return "0";
  if (value >= 10) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(3);
  return value.toExponential(1);
}

function formatMonitorAngle(value) {
  if (!Number.isFinite(value)) return "0";
  const normalized = ((value % 360) + 360) % 360;
  return normalized.toFixed(Math.abs(normalized - Math.round(normalized)) < 0.05 ? 0 : 1);
}

let sweepAnalysisController = null;
function sweepAnalysis() {
  if (!sweepAnalysisController) {
    throw new Error("Sweep analysis controller is not initialized.");
  }
  return sweepAnalysisController;
}

function normalizeSweepMode(mode) {
  return sweepAnalysis().normalizeSweepMode(mode);
}

function sweepModeLabel(mode = state.sweepMode) {
  return sweepAnalysis().sweepModeLabel(mode);
}

function sweepUnitLabel(mode = state.sweepMode) {
  return sweepAnalysis().sweepUnitLabel(mode);
}

function clampSweepRangeForMode(mode, value) {
  return sweepAnalysis().clampSweepRangeForMode(mode, value);
}

function formatSweepValue(value) {
  return sweepAnalysis().formatSweepValue(value);
}

function syncSweepStateFromInputs() {
  return sweepAnalysis().syncSweepStateFromInputs();
}

function updateSweepControls() {
  return sweepAnalysis().updateSweepControls();
}

function setSweepStatus(text) {
  return sweepAnalysis().setSweepStatus(text);
}

function sweepReadyStatusText() {
  return sweepAnalysis().sweepReadyStatusText();
}

function drawSweepChart() {
  return sweepAnalysis().drawSweepChart();
}

function updateSpectrumReadout(event) {
  return sweepAnalysis().updateSpectrumReadout(event);
}

function updateFarFieldReadout(event) {
  return sweepAnalysis().updateFarFieldReadout(event);
}

function updateAnalysisControls() {
  return sweepAnalysis().updateAnalysisControls();
}

async function runSweep() {
  return sweepAnalysis().runSweep();
}

function exportSweepCsv() {
  return sweepAnalysis().exportSweepCsv();
}

function updateSweepChartReadout(event) {
  return sweepAnalysis().updateSweepChartReadout(event);
}

function sceneState() {
  if (!sceneStateController) {
    sceneStateController = sceneStateControllerModule.createSceneStateController({
      state,
      el,
      sceneCodec,
      sourceMonitorModel,
      getSim: () => sim,
      getStateNormalizer: () => stateNormalizer,
      getSceneApplication: () => sceneApplication,
      sourceModelContext,
      monitorModelContext,
    });
  }
  return sceneStateController;
}

function safeFilePart(text) {
  return sceneState().safeFilePart(text);
}

function clonePlainData(value) {
  return sceneState().clonePlainData(value);
}

function setReproStatus(text, isWarning = false) {
  sceneState().setReproStatus(text, isWarning);
}

function knownPresetValue(value) {
  return sceneState().knownPresetValue(value);
}

function serializableStateSnapshot() {
  return sceneState().serializableStateSnapshot();
}

function snapshotDrawnMaterialCells() {
  return sceneState().snapshotDrawnMaterialCells();
}

function exportSceneState(options) {
  return sceneState().exportSceneState(options);
}

function normalizeImportedStateValues() {
  sceneState().normalizeImportedStateValues();
}

function sanitizeImportedSources(importedState) {
  sceneState().sanitizeImportedSources(importedState);
}

function sanitizeImportedMonitors(importedState) {
  sceneState().sanitizeImportedMonitors(importedState);
}

function applySceneState(snapshot) {
  sceneState().applySceneState(snapshot);
}

function encodeSceneSnapshot(snapshot) {
  return sceneState().encodeSceneSnapshot(snapshot);
}

function decodeSceneSnapshot(encoded) {
  return sceneState().decodeSceneSnapshot(encoded);
}

function formatFieldValue(value) {
  if (!Number.isFinite(value)) return "overflow";
  const abs = Math.abs(value);
  if (abs >= 10000) return value.toExponential(2);
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  if (abs >= 0.01) return value.toFixed(3);
  return value.toExponential(1);
}

function updateColorbar() {
  canvasColorbarController?.update();
}

function canvasEditActions() {
  if (!canvasEditActionsController) {
    canvasEditActionsController = canvasEditActionsModule.createCanvasEditActionsController({
      state,
      getSim: () => sim,
      getSimulationEffects: () => simulationEffects,
      getEntitySelection: () => entitySelection,
      lambdaToCells,
      clearMaterialSelection,
      normalizeBrushGeometryState,
    });
  }
  return canvasEditActionsController;
}

function canvasToGrid(event) {
  return canvasEditActions().canvasToGrid(event);
}

function paintFromEvent(event) {
  canvasEditActions().paintFromEvent(event);
}

function insertGeometryFromEvent(event) {
  canvasEditActions().insertGeometryFromEvent(event);
}

sim = new FDTDSim(el.canvas, DEFAULT_GRID);
materialStabilityController = materialStabilityModule.createMaterialStabilityController({
  state,
  sim,
  el,
  COURANT,
  BIANISOTROPY_KAPPA_LIMIT,
  normalizeDispersionModel,
  formatDiagnosticRatio,
  formatFieldValue,
});
instrumentSimulationPerformance(sim);
const contextMenus = contextMenuModule.createContextMenuController({ el });
const contextMenuState = contextMenus.state;
brushControlsController = brushControlsModule.createBrushControlsController({
  state,
  el,
  documentRef: document,
  contextMenuState,
  materialSelection,
  uiCore,
  materialEditorModel,
  normalizeDispersionModel,
  setControlDisabled,
  formatLambdaOutput,
  currentBrushLabel,
});
workerEngine = window.FdtdWorkerEngine
  ? new FdtdWorkerEngine(sim, {
      onStep(message) {
        recordPerformanceMetric("stepMs", message.elapsedMs, message.steps);
        updatePerformanceStats();
        sim.render();
      },
      onSync() {
        finalizeDeferredResults();
      },
      onError() {
        updateStats();
      },
    })
  : null;
runtimeController = runtimeControllerModule.createRuntimeController({
  state,
  sim,
  getWorkerEngine: () => workerEngine,
  timeStepBatch,
  updatePerformanceStats,
  finalizeDeferredResults,
  updateControlText,
  updateStats,
  getLocationSearch: () => window.location.search,
});
sweepAnalysisController = sweepAnalysisModule.createSweepAnalysisController({
  state,
  sim,
  el,
  resultsCharts,
  defaultSourceConfig,
  clamp,
  clampInt,
  selectedSource,
  normalizeSource,
  maxSourceXLambda,
  minSourceXLambda,
  setControlDisabled,
  timeStepBatch,
  updateControlText,
  updateStats,
  formatDiagnosticRatio,
  formatFieldValue,
  safeFilePart,
  incidentFieldSourceShapes,
  negativeIndexAnalysisPresets,
  bianisotropyAnalysisPresets,
  temporalFloquetAnalysisPresets,
  nonlinearAnalysisPresets,
  phaseChangeAnalysisPresets,
  harmonicAnalysisPresets,
  resonatorAnalysisPresets,
  purcellAnalysisPresets,
  betaAnalysisPresets,
  degenerateAnalysisPresets,
  ptModalAnalysisPresets,
  leakageAnalysisPresets,
  phcBlochAnalysisPresets,
  coupledWorkflowAnalysisPresets,
  absorptionAnalysisPresets,
});
canvasColorbarController = canvasColorbarModule.createCanvasColorbarController({
  state,
  sim,
  el,
  documentRef: document,
  windowRef: window,
  clamp,
  visualLayerEnabled,
  fieldDisplayConfig,
  formatFieldValue,
  cmasherGradient,
  cmasherMap,
  currentFieldColormapName,
  currentMaterialColormapName,
});
canvasExportController = canvasExportModule.createCanvasExportController({
  canvas: el.canvas,
  documentRef: document,
  drawExportOverlays: (ctx, width, height) => {
    canvasColorbarController.drawExport(ctx, width, height);
  },
});
canvasRenderController = canvasRenderControllerModule.createCanvasRenderController({
  sim,
  documentRef: document,
  buildPngDataUrl: canvasExportController.buildPngDataUrlWithExportOverlays,
  getPngFileName: () => `fdtd-2d-step-${sim.time}.png`,
});
simulationEffects = simulationEffectsModule.createSimulationEffectsController({
  sim,
  markWorkerDirty: () => workerEngine?.markDirty(),
  disableResponsiveGridOrientation,
  updateControlText,
  updateStats,
});
sourceMonitorEditorController = sourceMonitorEditorsModule.createSourceMonitorEditorController({
  state,
  sim,
  el,
  contextMenuState,
  simulationEffects,
  sourceMonitorModel,
  inPlaneElectricCurrentShapes,
  currentSourceShapes,
  incidentFieldSourceShapes,
  circularDipoleSourceShapes,
  sourceShapeLabels,
  selectedSource,
  explicitlySelectedMonitor,
  normalizeSource,
  normalizeMonitor,
  currentSourceLetter,
  simulatedFieldLetter,
  sourceShapeLabel,
  sourceCouplingLabel,
  sourceUsesWidth,
  sourceUsesAngle,
  sourceUsesMultipoleControls,
  setControlDisabled,
  formatLambda,
  formatLambdaOutput,
  formatMonitorAngle,
  monitorQuantityLabel,
  minSourceXLambda,
  minSourceYLambda,
  maxSourceXLambda,
  maxSourceYLambda,
  minMonitorXLambda,
  minMonitorYLambda,
  maxMonitorXLambda,
  maxMonitorYLambda,
});
inspectorController = inspectorModule.createInspectorController({
  state,
  sim,
  el,
  documentRef: document,
  materialSelection,
  explicitlySelectedMonitor,
  explicitlySelectedSource,
  dominantMaterialKind,
  cellsToLambda,
  formatLambda,
  formatFieldValue,
  sourceShapeLabel,
  sourceTypeLabel,
  sourceCouplingLabel,
  sourceUsesWidth,
  monitorQuantityLabel,
  formatMonitorAngle,
  solverModeLabel,
  boundarySummaryLabel,
  runtimeEngineLabel,
});
controlTextController = controlTextModule.createControlTextController({
  state,
  sim,
  el,
  uiCore,
  controlSyncUi,
  materialEditorUi,
  sceneDescriptions,
  COURANT,
  clampAllSourcesToInterior,
  clampAllMonitorsToInterior,
  updateCanvasAspectRatio,
  updateThemeControls,
  activeSourceEditorTarget,
  selectedSource,
  activeMonitorEditorTarget,
  formatSpeed,
  updateSourceShapeOptionLabels,
  updateFieldDisplayControls,
  normalizeDispersionModel,
  formatLambdaOutput,
  updateSceneGuidePanel,
  syncSceneBrowserSelection,
  updateRunControls,
  updateCanvasModeControls,
  updateCanvasInteractionState,
  updateVisualControls,
  updateBrushControls,
  updateBoundaryMenuControls,
  populateSourceEditor,
  populateMonitorEditor,
  solverModeLabel,
  boundarySummaryLabel,
  cellsToLambda,
  formatCompactLambda,
  formatLambda,
  currentBrushLabel,
  sourceSummaryLabel,
  updateMaterialWarning,
  updateStabilitySummary,
  updateInspector,
  updateAllRangeProgress,
  updateSweepControls,
  updateAnalysisControls,
});
stateNormalizer = stateNormalizerModule.createStateNormalizer({
  state,
  maxGrid: MAX_GRID,
  visualLayerStateKeys: VISUAL_LAYER_STATE_KEYS,
  materialNames,
  defaultMonitorConfig,
  clampNumber: clamp,
  clampInt,
  normalizeTheme,
  normalizedVisualProfile,
  normalizeSweepMode,
  normalizeBoundaryMode,
  normalizeBoundarySides,
  knownPresetValue,
  normalizeDispersionModel,
  normalizeBrushGeometryState,
  normalizeMonitor,
});
sceneApplication = sceneApplicationModule.createSceneApplicationController({
  state,
  sim,
  el,
  documentElement: document.documentElement,
  maxGrid: MAX_GRID,
  serializableStateKeys: SERIALIZABLE_STATE_KEYS,
  clonePlainData,
  clampInt,
  clampNumber: clamp,
  markWorkerDirty: () => workerEngine?.markDirty(),
  disableResponsiveGridOrientation,
  normalizeImportedStateValues,
  clearMaterialSelection,
  clearCanvasHover,
  closeContextMenus,
  sanitizeImportedSources,
  sanitizeImportedMonitors,
  updateControlText,
  updateStats,
  drawSweepChart,
});
sceneRepro = sceneReproModule.createSceneReproController({
  documentRef: document,
  windowRef: window,
  navigatorRef: navigator,
  el,
  sceneShareUrlLimit: SCENE_SHARE_URL_LIMIT,
  exportSceneState,
  applySceneState,
  encodeSceneSnapshot,
  decodeSceneSnapshot,
  safeFilePart,
  getPresetName: () => state.preset,
  setStatus: setReproStatus,
  warn: (...args) => console.warn(...args),
});
sceneRepro.bindControls();
const pointerStateController = canvasPointerStateModule.createCanvasPointerState();
const pointerState = pointerStateController.state;
const dragStateController = canvasDragStateModule.createCanvasDragState({
  requestAnimationFrame: (callback) => requestAnimationFrame(callback),
  cancelAnimationFrame: (frameId) => cancelAnimationFrame(frameId),
});
const dragState = dragStateController.state;
const TOUCH_DRAG_START_PX = 8;
const TOUCH_TAP_MAX_DISTANCE_PX = 10;
const TOUCH_DOUBLE_TAP_MS = 320;
const TOUCH_DOUBLE_TAP_DISTANCE_PX = 34;
const canvasInteractions = canvasInteractionsModule.createCanvasInteractionsController({
  documentRef: document,
  el,
  state,
  sim,
  pointerState,
  pointerStateController,
  dragStateController,
  closeContextMenus,
  clearCanvasHover,
  updateViewInteraction,
  handleCanvasKeydown,
  beginPinchGesture,
  updatePinchGesture,
  beginPan,
  updatePan,
  beginPendingTouchInteraction,
  markPendingTouchMoved,
  promotePendingTouchDrag,
  handleCanvasTouchTap,
  clearPendingTouchInteraction,
  updateSourceDrag,
  updateMonitorDrag,
  updateMaterialDrag,
  endSourceDrag,
  endMonitorDrag,
  endMaterialDrag,
  beginSourceDrag,
  beginMonitorDrag,
  beginMaterialDrag,
  selectMaterialRegionAt,
  clearMaterialSelection,
  updateInspector,
  updateCanvasHover,
  updateCanvasInteractionState,
  insertGeometryFromEvent,
  paintFromEvent,
  openBoundaryMenuAt,
  openBrushMenuAt,
  openSourceMenuAt,
  openMonitorMenuAt,
  openCanvasContextMenuAt,
  closeCanvasActionsMenu,
  closeCanvasOptionsMenu,
  closeControlDrawer,
  isEditableKeyTarget,
  deleteSelectedElement,
});
canvasInteractions.bind();

runtimeControlBindingsModule.bindRuntimeControls({
  el,
  state,
  runtimeController,
  canvasRenderController,
  clamp,
  updateControlText,
});

function refreshSceneSearch() {
  renderSceneFilterBar();
  renderSceneCards();
}

function editInspectorSelection() {
  const monitor = explicitlySelectedMonitor();
  if (monitor) {
    const point = monitorClientPoint(monitor);
    openMonitorMenuAt(point.x, point.y, monitor);
    return;
  }
  const source = explicitlySelectedSource();
  if (materialSelection.region) {
    const point = materialRegionClientPoint(materialSelection.region);
    openBrushMenuAt(point.x, point.y, { mode: "region" });
    return;
  }
  if (source) {
    const point = sourceClientPoint(source);
    openSourceMenuAt(point.x, point.y, source);
  }
}

function clearInspectorSelection() {
  entitySelection.clearAll();
  dragStateController.clearMaterial();
  updateControlText();
  sim.render();
}

function closeCanvasContextMenuAndRender() {
  closeCanvasContextMenu();
  sim.render();
}

function handleCanvasContextAdd(button) {
  const rect = el.canvas.getBoundingClientRect();
  const point = contextMenuState.canvasContextPoint || sim.clientToGridCell(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5);
  const clientX = sim.gridToCanvasX(point.x + 0.5) / Math.max(1, window.devicePixelRatio || 1) + rect.left;
  const clientY = sim.gridToCanvasY(point.y + 0.5) / Math.max(1, window.devicePixelRatio || 1) + rect.top;
  if (button.dataset.canvasAdd === "monitor") {
    closeCanvasContextMenu();
    openMonitorMenuAt(clientX, clientY, null);
  } else {
    closeCanvasContextMenu();
    openSourceMenuAt(clientX, clientY, null);
  }
}

shellControlBindingsModule.bindShellControls({
  el,
  windowRef: window,
  setCanvasMode,
  toggleControlDrawer,
  closeControlDrawer,
  toggleCanvasActionsMenu,
  closeCanvasActionsMenu,
  toggleCanvasOptionsMenu,
  activateControlTab,
  handleControlTabKeydown,
  activateMobileLayer,
  refreshSceneSearch,
  editInspectorSelection,
  clearInspectorSelection,
  applyTheme,
  applyUiDepth,
  closeCanvasContextMenuAndRender,
  handleCanvasContextAdd,
});

sourceMonitorControlBindingsModule.bindSourceMonitorControls({
  el,
  sim,
  simulationEffects,
  applySourceMenu,
  selectedSource,
  deleteSource,
  closeSourceMenu,
  syncSourceEditorTarget,
  applyMonitorMenu,
  explicitlySelectedMonitor,
  deleteMonitor,
  closeMonitorMenu,
  syncMonitorEditorTarget,
});

resultsControlBindingsModule.bindResultsControls({
  el,
  state,
  sim,
  updateControlText,
  updateStats,
  resetPerformanceStats,
  updateSpectrumReadout,
  updateFarFieldReadout,
  normalizeSweepMode,
  syncSweepStateFromInputs,
  setSweepStatus,
  sweepReadyStatusText,
  runSweep,
  exportSweepCsv,
  updateSweepChartReadout,
  sweepModeLabel,
  formatSweepValue,
});

visualControlBindingsModule.bindVisualControls({
  el,
  state,
  sim,
  markWorkerDirty: () => workerEngine?.markDirty(),
  updateControlText,
  updateStats,
  applyVisualProfile,
  setCustomVisualLayer,
});

let configMaterialHandlersController = null;
function configMaterialHandlers() {
  if (!configMaterialHandlersController) {
    configMaterialHandlersController = configMaterialHandlersModule.createConfigMaterialHandlersController({
      state,
      sim,
      el,
      contextMenuState,
      materialSelection,
      entitySelection,
      simulationEffects,
      materialEditorModel,
      maxGrid: MAX_GRID,
      COURANT,
      BIANISOTROPY_KAPPA_LIMIT,
      clamp,
      clampInt,
      updateControlText,
      updateStats,
      disableResponsiveGridOrientation,
      normalizeDispersionModel,
      markWorkerDirty: () => workerEngine?.markDirty(),
      clearMaterialSelection,
      clearCanvasHover,
      gridSizeIsAutoOrientable,
      enableResponsiveGridOrientation: () => layoutController().enableResponsiveGridOrientation(),
      applyResponsiveGridOrientation,
      syncSceneBrowserSelection,
      boundarySideMode,
      setBoundarySideMode,
      closeBoundaryMenu,
      applySimulationGridSize,
      normalizeBrushGeometryState,
      applyMaterialKindToSelection,
      closeBrushMenu,
    });
  }
  return configMaterialHandlersController;
}

function handleWavelengthInput() {
  configMaterialHandlers().handleWavelengthInput();
}

function handleCellsPerWavelengthInput() {
  configMaterialHandlers().handleCellsPerWavelengthInput();
}

function handleCustomMaterialInput() {
  configMaterialHandlers().handleCustomMaterialInput();
}

materialControlBindingsModule.bindMaterialControls({
  el,
  handleCustomMaterialInput,
});

function applySelectedPreset() {
  configMaterialHandlers().applySelectedPreset();
}

function handleSlabThicknessInput() {
  configMaterialHandlers().handleSlabThicknessInput();
}

function applyBoundaryMode(mode, side = contextMenuState.boundaryMenuSide) {
  configMaterialHandlers().applyBoundaryMode(mode, side);
}

function handleBoundaryMenuInput() {
  configMaterialHandlers().handleBoundaryMenuInput();
}

function applyGridSizeFromInputs() {
  configMaterialHandlers().applyGridSizeFromInputs();
}

configControlBindingsModule.bindConfigControls({
  el,
  handleWavelengthInput,
  handleCellsPerWavelengthInput,
  applySelectedPreset,
  handleSlabThicknessInput,
  handleBoundaryMenuInput,
  applyGridSizeFromInputs,
});

function handleBrushSizeInput() {
  configMaterialHandlers().handleBrushSizeInput();
}

function handleBrushToolButton(button) {
  configMaterialHandlers().handleBrushToolButton(button);
}

function handleBrushGeometryInput() {
  configMaterialHandlers().handleBrushGeometryInput();
}

function handleGeometryDimensionInput() {
  configMaterialHandlers().handleGeometryDimensionInput();
}

function handleBrushMaterialButton(button) {
  configMaterialHandlers().handleBrushMaterialButton(button);
}

function clearMedium() {
  configMaterialHandlers().clearMedium();
}

function clearField() {
  configMaterialHandlers().clearField();
}

function closeBrushMenuAndRender() {
  configMaterialHandlers().closeBrushMenuAndRender();
}

function closeBoundaryMenuAndRender() {
  configMaterialHandlers().closeBoundaryMenuAndRender();
}

brushControlBindingsModule.bindBrushControls({
  el,
  documentRef: document,
  handleBrushSizeInput,
  handleBrushToolButton,
  handleBrushGeometryInput,
  handleGeometryDimensionInput,
  handleBrushMaterialButton,
  clearMedium,
  clearField,
  closeBrushMenuAndRender,
  closeBoundaryMenuAndRender,
});

function canvasGestureActions() {
  if (!canvasGestureActionsController) {
    canvasGestureActionsController = canvasGestureActionsModule.createCanvasGestureActionsController({
      state,
      el,
      pointerState,
      pointerStateController,
      dragState,
      dragStateController,
      canvasInteractionModel,
      getSim: () => sim,
      getSimulationEffects: () => simulationEffects,
      getEntitySelection: () => entitySelection,
      updateControlText,
      updateCanvasInteractionState,
      closeContextMenus,
      updateInspector,
      updateStats,
      cellsToLambda,
      selectMaterialRegion,
      isEditableKeyTarget,
      performanceRef: performance,
      touchDragStartPx: TOUCH_DRAG_START_PX,
      touchTapMaxDistancePx: TOUCH_TAP_MAX_DISTANCE_PX,
      touchDoubleTapMs: TOUCH_DOUBLE_TAP_MS,
      touchDoubleTapDistancePx: TOUCH_DOUBLE_TAP_DISTANCE_PX,
    });
  }
  return canvasGestureActionsController;
}

function updateViewInteraction() {
  canvasGestureActions().updateViewInteraction();
}

function handleCanvasKeydown(event) {
  canvasGestureActions().handleCanvasKeydown(event);
}

function beginPinchGesture() {
  canvasGestureActions().beginPinchGesture();
}

function updatePinchGesture() {
  return canvasGestureActions().updatePinchGesture();
}

function beginPan(event) {
  canvasGestureActions().beginPan(event);
}

function updatePan(event) {
  return canvasGestureActions().updatePan(event);
}

function clearPendingTouchInteraction() {
  canvasGestureActions().clearPendingTouchInteraction();
}

function beginPendingTouchInteraction(event, kind, data = {}) {
  canvasGestureActions().beginPendingTouchInteraction(event, kind, data);
}

function markPendingTouchMoved(event, threshold = TOUCH_TAP_MAX_DISTANCE_PX) {
  return canvasGestureActions().markPendingTouchMoved(event, threshold);
}

function handleCanvasTouchTap(event, interaction) {
  return canvasGestureActions().handleCanvasTouchTap(event, interaction);
}

function promotePendingTouchDrag(event) {
  return canvasGestureActions().promotePendingTouchDrag(event);
}

function beginSourceDrag(event, source, originClientX = event.clientX, originClientY = event.clientY) {
  canvasGestureActions().beginSourceDrag(event, source, originClientX, originClientY);
}

function beginMonitorDrag(event, monitor, originClientX = event.clientX, originClientY = event.clientY) {
  canvasGestureActions().beginMonitorDrag(event, monitor, originClientX, originClientY);
}

function beginMaterialDrag(event, region, originClientX = event.clientX, originClientY = event.clientY) {
  canvasGestureActions().beginMaterialDrag(event, region, originClientX, originClientY);
}

function updateSourceDrag(event) {
  return canvasGestureActions().updateSourceDrag(event);
}

function updateMonitorDrag(event) {
  return canvasGestureActions().updateMonitorDrag(event);
}

function updateMaterialDrag(event) {
  return canvasGestureActions().updateMaterialDrag(event);
}

function endSourceDrag(event) {
  canvasGestureActions().endSourceDrag(event);
}

function endMonitorDrag(event) {
  canvasGestureActions().endMonitorDrag(event);
}

function endMaterialDrag(event) {
  canvasGestureActions().endMaterialDrag(event);
}

function handleWindowResize() {
  closeContextMenus();
  if (!controlDrawerOverlayActive()) {
    closeControlDrawer();
  }
  if (!canvasOptionsMenuActive()) {
    closeCanvasOptionsMenu();
  }
  if (!canvasActionsMenuActive()) {
    closeCanvasActionsMenu();
  }
  syncResultsDetailPanels();
  const gridChanged = applyResponsiveGridOrientation({ render: false });
  if (!gridChanged) {
    updateControlText();
    sim.fitCanvas();
  }
  updateVisualControls();
  updateControlPanelContext();
  sim.render();
}

async function initWasmBackend() {
  if (!window.WebAssembly) return;
  try {
    const backend = await WasmFdtdBackend.load(WASM_CORE_URL);
    sim.attachWasmBackend(backend);
    workerEngine?.markDirty();
    sim.measure();
    updateControlText();
    updateStats();
    sim.render();
    updatePerformanceStats(true);
    console.info("WASM FDTD backend enabled");
  } catch (error) {
    console.warn("WASM FDTD backend unavailable; using JavaScript", error);
    updateStats();
  }
}

appBootstrapModule.runAppBootstrap({
  layoutControlBindingsModule,
  windowRef: window,
  documentRef: document,
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
});
