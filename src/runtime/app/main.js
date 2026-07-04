"use strict";

const runtimeDependenciesModule = window.FdtdRuntimeDependencies;
if (!runtimeDependenciesModule) {
  throw new Error("src runtime module runtime-dependencies.js must be loaded before src/runtime/app/main.js");
}

const {
  appStateModule,
  appFormattersModule,
  visualLayerModel,
  boundaryStateModule,
  uiCore,
  uiDom,
  uiDrawerModule,
  uiScenesModule,
  uiSceneGuideModule,
  uiResultsModule,
  uiResultsChartsModule,
  numericInputModule,
  controlSyncUi,
  sceneCodec,
  sourceMonitorModel,
  sourceMonitorOperationsModule,
  materialEditorModel,
  materialEditorUi,
  materialOperationsModule,
  materialSelectionModule,
  entitySelectionModule,
  sceneApplicationModule,
  stateNormalizerModule,
  simulationEffectsModule,
  runtimeControllerModule,
  canvasRenderControllerModule,
  canvasColorbarModule,
  canvasExportModule,
  runtimeControlBindingsModule,
  visualControlBindingsModule,
  resultsControlBindingsModule,
  sourceMonitorControlBindingsModule,
  materialControlBindingsModule,
  configControlBindingsModule,
  brushControlBindingsModule,
  shellControlBindingsModule,
  layoutControlBindingsModule,
  sceneReproModule,
  canvasInteractionModel,
  canvasPointerStateModule,
  canvasDragStateModule,
  canvasInteractionsModule,
  canvasSurfaceOrbitControllerModule,
  contextMenuModule,
  canvasContextActionsModule,
  appBootstrapModule,
  appLayoutModule,
  appPerformanceModule,
  controlUiStateModule,
  sweepAnalysisModule,
  materialStabilityModule,
  sourceMonitorEditorsModule,
  brushControlsModule,
  controlTextModule,
  sceneStateControllerModule,
  canvasEditActionsModule,
  canvasGestureActionsModule,
  configMaterialHandlersModule,
} = runtimeDependenciesModule.resolveRuntimeDependencies(window);

const {
  defaultMonitorConfig,
  normalizeTheme,
  normalizeUiDepth,
  createInitialAppState,
} = appStateModule;

const VISUAL_LAYER_STATE_KEYS = visualLayerModel.VISUAL_LAYER_STATE_KEYS;

let canvasRenderController = null;
let canvasColorbarController = null;
let canvasExportController = null;
let sim = null;
let runtimeController = null;
let simulationEffects = null;
let stateNormalizer = null;
let sceneApplication = null;
let sceneRepro = null;
let sceneStateController = null;
let canvasEditActionsController = null;
let canvasGestureActionsController = null;
let canvasContextActionsController = null;
let surfaceOrbitController = null;
let boundaryStateController = null;

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
  currentBrushLabel,
  monitorQuantityLabel,
  niceScaleLength,
  formatScaleBarValue,
  trimFixed,
  formatLambda,
  formatCompactLambda,
  formatLambdaOutput,
  formatTimeRate,
} = appFormatters;

let materialSelectionController = null;
let materialSelection = { region: null };
let entitySelection = null;
let hoveredMaterialRegion = null;

function normalizeBoundaryMode(mode) {
  return boundaryStateModule.normalizeBoundaryMode(mode);
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
  return boundaryState().normalizeBoundarySides();
}

function boundarySideMode(side) {
  return boundaryState().boundarySideMode(side);
}

function boundarySideIsAbsorbing(side) {
  return boundaryState().boundarySideIsAbsorbing(side);
}

function anyAbsorbingBoundarySide() {
  return boundaryState().anyAbsorbingBoundarySide();
}

function setBoundarySideMode(side, mode) {
  boundaryState().setBoundarySideMode(side, mode);
}

function boundarySummaryLabel() {
  return boundaryState().boundarySummaryLabel();
}

const SCENE_SHARE_URL_LIMIT = sceneCodec.SCENE_SHARE_URL_LIMIT;
const SERIALIZABLE_STATE_KEYS = sceneCodec.SERIALIZABLE_STATE_KEYS;
const el = uiDom.validateDomRefs(uiDom.collectDomRefs(document));
const numericInputs = numericInputModule.createNumericInputController({ documentRef: document });
numericInputs.bind();
let editSessionDepth = 0;
let editSessionShouldResume = false;
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
        PORTRAIT_GRID: DEFAULT_PORTRAIT_GRID,
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

function visualLayerEnabled(layer, options = {}) {
  return visualLayerModel.visualLayerEnabled(state, layer, options);
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

function loadSceneCatalogForUi() {
  const loader = window.FdtdSceneCatalogLoader;
  if (!loader?.loadSceneCatalog) return;
  loader
    .loadSceneCatalog()
    .then((catalog) => {
      if (catalog?.descriptions) {
        Object.assign(sceneDescriptions, catalog.descriptions);
      }
      sceneBrowser.setSceneCatalog(catalog);
      updateSceneGuidePanel();
      syncSceneBrowserSelection();
      if (el.sceneNote) {
        el.sceneNote.textContent = sceneDescriptions[state.preset] || sceneDescriptions.empty || "";
      }
    })
    .catch((error) => {
      console.warn("Scene catalog JSON unavailable; using embedded scene metadata.", error);
    });
}

function selectScenePreset(value) {
  if (!el.presetInput || !value) return;
  el.presetInput.value = value;
  applySelectedPreset();
}

function materialRegionSignature(region) {
  if (!region?.bounds) return "";
  const b = region.bounds;
  return `${region.cells?.length || 0}:${b.minX},${b.minY},${b.maxX},${b.maxY}`;
}

function clearCanvasHover(render = true) {
  if (state.hoveredSourceId == null && state.hoveredMonitorId == null && !hoveredMaterialRegion && !state.drawPreviewCell) return;
  state.hoveredSourceId = null;
  state.hoveredMonitorId = null;
  hoveredMaterialRegion = null;
  state.drawPreviewCell = null;
  if (render) sim.render();
}

function updateCanvasHover(event) {
  if (state.canvasMode === "brush") {
    state.hoveredSourceId = null;
    state.hoveredMonitorId = null;
    hoveredMaterialRegion = null;
    const point = sim.clientToGridCell(event.clientX, event.clientY);
    const previous = state.drawPreviewCell;
    if (!previous || previous.x !== point.x || previous.y !== point.y) {
      state.drawPreviewCell = point;
      sim.render();
    }
    return;
  }
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
  updateStats();
}

function setSimulationRunning(running) {
  if (runtimeController?.setRunning) {
    runtimeController.setRunning(running);
    return;
  }
  state.running = Boolean(running);
}

function beginSimulationEditSession() {
  if (editSessionDepth === 0) {
    editSessionShouldResume = Boolean(state.running);
    if (state.running) {
      setSimulationRunning(false);
    }
  }
  editSessionDepth += 1;
}

function finishSimulationEditSession(scope = document) {
  if (scope && !numericInputs.validateScope(scope)) return false;
  editSessionDepth = Math.max(0, editSessionDepth - 1);
  if (editSessionDepth === 0) {
    const shouldResume = editSessionShouldResume;
    editSessionShouldResume = false;
    if (shouldResume && !numericInputs.hasInvalidInputs(document)) {
      setSimulationRunning(true);
    }
  }
  return true;
}

function closeControlDrawer() {
  if (controlDrawerOverlayActive() && !finishSimulationEditSession(el.controlPanel)) return;
  uiDrawer.closeControlDrawer();
}

function toggleControlDrawer() {
  if (!controlDrawerOverlayActive()) {
    uiDrawer.toggleControlDrawer();
    return;
  }
  if (el.appShell?.classList.contains("controls-open")) {
    closeControlDrawer();
    return;
  }
  beginSimulationEditSession();
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

function isEditableKeyTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, button, [contenteditable='true'], [contenteditable='']"));
}

function boundaryState() {
  if (!boundaryStateController) {
    boundaryStateController = boundaryStateModule.createBoundaryStateController({
      state,
      boundarySides: BOUNDARY_SIDES,
      boundarySideLabels,
    });
  }
  return boundaryStateController;
}

let controlUiStateController = null;
function controlUiState() {
  if (!controlUiStateController) {
    controlUiStateController = controlUiStateModule.createControlUiStateController({
      state,
      el,
      uiCore,
      visualLayerModel,
      documentElement: document.documentElement,
      windowRef: window,
      normalizeTheme,
      normalizeUiDepth,
      themeStorageKey: THEME_STORAGE_KEY,
      clearCanvasHover,
      updateControlText,
      getSim: () => sim,
      getCanvasColorbarController: () => canvasColorbarController,
      isControlTextReady: () => Boolean(controlTextController),
    });
  }
  return controlUiStateController;
}

function updateThemeControls() {
  controlUiState().updateThemeControls();
}

function applyTheme(theme, render = true) {
  controlUiState().applyTheme(theme, render);
}

function applyUiDepth(depth, refresh = true) {
  controlUiState().applyUiDepth(depth, refresh);
}

function setCanvasMode(mode) {
  controlUiState().setCanvasMode(mode);
}

function updateCanvasModeControls() {
  controlUiState().updateCanvasModeControls();
}

function updateCanvasInteractionState() {
  controlUiState().updateCanvasInteractionState();
}

function updateRunControls() {
  controlUiState().updateRunControls();
}

function updateFieldDisplayControls() {
  controlUiState().updateFieldDisplayControls();
}

function updateVisualControls() {
  controlUiState().updateVisualControls();
  surfaceOrbitController?.sync?.();
}

function setCustomVisualLayer(layer, enabled) {
  controlUiState().setCustomVisualLayer(layer, enabled);
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

function maxMonitorXLambda() {
  return cellsToLambda(sim.activeInteriorMaxX());
}

function maxMonitorYLambda() {
  return cellsToLambda(sim.activeInteriorMaxY());
}

function minMonitorXLambda() {
  return cellsToLambda(sim.activeInteriorMinX());
}

function minMonitorYLambda() {
  return cellsToLambda(sim.activeInteriorMinY());
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
  getSim: () => sim,
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
  return localizedSourceShapes.has(shape) || inPlaneElectricCurrentShapes.has(shape) || shape === "evanescentLine" || shape === "modeProfile";
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

function canvasContextActions() {
  if (!canvasContextActionsController) {
    canvasContextActionsController = canvasContextActionsModule.createCanvasContextActionsController({
      state,
      el,
      contextMenus,
      contextMenuState,
      boundarySideLabels,
      inPlaneElectricCurrentShapes,
      getSim: () => sim,
      getSimulationEffects: () => simulationEffects,
      getEntitySelection: () => entitySelection,
      clearMaterialSelection,
      clampInt,
      cellsToLambda,
      formatLambda,
      makeSource,
      makeMonitor,
      addSource,
      addMonitor,
      selectedSource,
      explicitlySelectedMonitor,
      normalizeSource,
      normalizeMonitor,
      readSourceEditorValues,
      readMonitorEditorValues,
      normalizeBoundarySides,
      boundarySideMode,
      boundarySideIsAbsorbing,
      updateControlText,
      validateNumericInputs: (scope) => numericInputs.validateScope(scope),
    });
  }
  return canvasContextActionsController;
}

function openCanvasContextMenuAt(clientX, clientY) {
  canvasContextActions().openCanvasContextMenuAt(clientX, clientY);
}

function openSourceMenuAt(clientX, clientY, source = null) {
  canvasContextActions().openSourceMenuAt(clientX, clientY, source);
}

function closeSourceMenu() {
  canvasContextActions().closeSourceMenu();
}

function openMonitorMenuAt(clientX, clientY, monitor = null) {
  canvasContextActions().openMonitorMenuAt(clientX, clientY, monitor);
}

function closeMonitorMenu() {
  canvasContextActions().closeMonitorMenu();
}

function closeCanvasContextMenu() {
  canvasContextActions().closeCanvasContextMenu();
}

function openBrushMenuAt(clientX, clientY, options = {}) {
  canvasContextActions().openBrushMenuAt(clientX, clientY, options);
}

function closeBrushMenu() {
  canvasContextActions().closeBrushMenu();
}

function updateBoundaryMenuControls() {
  canvasContextActions().updateBoundaryMenuControls();
}

function openBoundaryMenuAt(clientX, clientY) {
  canvasContextActions().openBoundaryMenuAt(clientX, clientY);
}

function closeBoundaryMenu() {
  canvasContextActions().closeBoundaryMenu();
}

function closeContextMenus() {
  canvasContextActions().closeContextMenus();
}

function applySourceMenu() {
  canvasContextActions().applySourceMenu();
}

function applyMonitorMenu() {
  canvasContextActions().applyMonitorMenu();
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

window.exportSceneState = exportSceneState;

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

function beginPaintStroke(event) {
  canvasEditActions().beginPaintStroke(event);
}

function paintFromEvent(event) {
  canvasEditActions().paintFromEvent(event);
}

function endPaintStroke(event) {
  canvasEditActions().endPaintStroke(event);
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
const contextMenus = contextMenuModule.createContextMenuController({
  el,
  beginEditSession: beginSimulationEditSession,
  endEditSession: finishSimulationEditSession,
  validateEditScope: (scope) => numericInputs.validateScope(scope),
});
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
runtimeController = runtimeControllerModule.createRuntimeController({
  state,
  sim,
  timeStepBatch,
  finalizeDeferredResults,
  updateControlText,
  updateStats,
  updatePerformanceStats,
  courant: COURANT,
  visualCourantReference: VISUAL_COURANT_REFERENCE,
  maxNumericalStepsPerFrame: MAX_NUMERICAL_STEPS_PER_FRAME,
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
  fieldCanvas: el.fieldCanvas,
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
  validateNumericInputs: (scope) => numericInputs.validateScope(scope, { commitActive: false }),
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
  formatTimeRate,
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
  boundarySummaryLabel,
  cellsToLambda,
  formatCompactLambda,
  formatLambda,
  updateMaterialWarning,
  updateStabilitySummary,
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
surfaceOrbitController = canvasSurfaceOrbitControllerModule.createCanvasSurfaceOrbitController({
  documentRef: document,
  windowRef: window,
  el,
  state,
  sim,
  closeContextMenus,
});
surfaceOrbitController.bind();
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
  updateCanvasHover,
  updateCanvasInteractionState,
  insertGeometryFromEvent,
  beginPaintStroke,
  paintFromEvent,
  endPaintStroke,
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
  applyTheme,
  applyUiDepth,
  closeCanvasContextMenuAndRender,
  handleCanvasContextAdd,
});
uiCore.bindRadioGroupKeyboardNavigation(document);

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
  updateControlText,
  updateStats,
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
      validateNumericInputs: (scope) => numericInputs.validateScope(scope, { commitActive: false }),
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

loadSceneCatalogForUi();
