const FIELD_DISPLAY_VALUES = Object.freeze(["scalar", "transverseX", "transverseY", "electricMag", "magneticMag"]);
const VIEW_MODE_VALUES = Object.freeze(["field", "epsilon", "mu", "poynting"]);
const RENDER_FPS_VALUES = Object.freeze([0, 15, 30, 60]);

type AppState = Record<string, unknown>;
type UnknownFunction = (...args: never[]) => unknown;

function requireFunction<T extends UnknownFunction>(value: unknown, name: string): T {
  if (typeof value !== "function") {
    throw new Error(`State normalizer dependency must provide ${name}().`);
  }
  return value as T;
}

function requireObject<T extends object>(value: unknown, name: string): T {
  if (!value || typeof value !== "object") {
    throw new Error(`State normalizer dependency must provide ${name}.`);
  }
  return value as T;
}

function objectHasKey(object: object, key: unknown): boolean {
  return Object.prototype.hasOwnProperty.call(object, key as PropertyKey);
}

function normalizeChoice(value: unknown, allowedValues: readonly unknown[], fallback: string): string {
  return allowedValues.includes(value) ? String(value) : fallback;
}

function normalizeRenderFps(value: unknown): number {
  const fps = Number(value);
  return RENDER_FPS_VALUES.includes(fps) ? fps : 0;
}

export function createStateNormalizer(dependencies: Record<string, unknown>) {
  const state = requireObject<AppState>(dependencies.state, "state");
  const maxGrid = requireObject<{ nx: number; ny: number }>(dependencies.maxGrid, "maxGrid");
  const visualLayerStateKeys = requireObject<Record<string, string>>(dependencies.visualLayerStateKeys, "visualLayerStateKeys");
  const materialNames = requireObject<Record<string, unknown>>(dependencies.materialNames, "materialNames");
  const defaultMonitorConfig = requireObject<Record<string, unknown>>(dependencies.defaultMonitorConfig, "defaultMonitorConfig");
  const clampNumber = requireFunction<(value: unknown, min: number, max: number) => number>(dependencies.clampNumber, "clampNumber");
  const clampInt = requireFunction<(value: unknown, min: number, max: number) => number>(dependencies.clampInt, "clampInt");
  const normalizeTheme = requireFunction<(value: unknown) => unknown>(dependencies.normalizeTheme, "normalizeTheme");
  const normalizeSweepMode = requireFunction<(value: unknown) => unknown>(dependencies.normalizeSweepMode, "normalizeSweepMode");
  const normalizeBoundaryMode = requireFunction<(value: unknown) => unknown>(dependencies.normalizeBoundaryMode, "normalizeBoundaryMode");
  const normalizeBoundarySides = requireFunction<() => unknown>(dependencies.normalizeBoundarySides, "normalizeBoundarySides");
  const knownPresetValue = requireFunction<(value: unknown) => boolean>(dependencies.knownPresetValue, "knownPresetValue");
  const normalizeDispersionModel = requireFunction<(value: unknown) => unknown>(dependencies.normalizeDispersionModel, "normalizeDispersionModel");
  const normalizeBrushGeometryState = requireFunction<() => unknown>(dependencies.normalizeBrushGeometryState, "normalizeBrushGeometryState");
  const normalizeMonitor = requireFunction<(monitor: Record<string, unknown>) => unknown>(dependencies.normalizeMonitor, "normalizeMonitor");

  function normalizeVisualLayerFlags(): void {
    Object.values(visualLayerStateKeys).forEach((stateKey) => {
      state[stateKey] = state[stateKey] == null ? stateKey !== "visualLayerMonitors" : Boolean(state[stateKey]);
    });
  }

  function normalizeMonitorState(): void {
    const monitors = (Array.isArray(state.monitors) ? state.monitors : []) as Array<Record<string, unknown>>;
    state.monitors = monitors;
    state.selectedMonitorId = monitors.some((monitor) => monitor.id === state.selectedMonitorId)
      ? state.selectedMonitorId
      : null;
    state.nextMonitorId = Math.max(1, Number(state.nextMonitorId) || 1);
    state.monitorDefaults = normalizeMonitor({
      ...defaultMonitorConfig,
      ...(state.monitorDefaults && typeof state.monitorDefaults === "object" ? state.monitorDefaults : {}),
    });
  }

  function normalizeImportedStateValues(): void {
    state.theme = normalizeTheme(state.theme);
    state.timeRate = clampNumber(Number(state.timeRate ?? state.stepsPerFrame) || 1, 0.1, 10);
    state.renderFps = normalizeRenderFps(state.renderFps);
    delete state.stepsPerFrame;
    state.gain = clampNumber(Number(state.gain) || 1, 0.1, 10);
    state.autoScale = Boolean(state.autoScale);
    state.fieldComponent = state.fieldComponent === "hz" ? "hz" : "ez";
    state.fieldDisplay = normalizeChoice(state.fieldDisplay, FIELD_DISPLAY_VALUES, "scalar");
    state.fieldQuiver = Boolean(state.fieldQuiver);
    state.materialFieldOverlay = Boolean(state.materialFieldOverlay);
    state.diagnosticsEnabled = Boolean(state.diagnosticsEnabled);
    delete state.visualProfile;
    normalizeVisualLayerFlags();
    state.analysisEnabled = Boolean(state.analysisEnabled);
    state.analysisSampleEvery = clampInt(state.analysisSampleEvery, 1, 16);
    state.sweepMode = normalizeSweepMode(state.sweepMode);
    state.sweepSamples = clampInt(state.sweepSamples, 3, 41);
    state.sweepSteps = clampInt(state.sweepSteps, 120, 4000);
    state.sweepBidirectional = Boolean(state.sweepBidirectional);
    state.viewMode = normalizeChoice(state.viewMode, VIEW_MODE_VALUES, "field");
    if (state.viewMode === "poynting") state.fieldDisplay = "scalar";
    state.viewProjection = state.viewProjection === "3d" ? "3d" : "2d";
    state.materialPart = state.materialPart === "imag" ? "imag" : "real";
    state.canvasMode = state.canvasMode === "brush" ? "brush" : "select";
    state.wavelengthUm = clampNumber(Number(state.wavelengthUm) || 1, 0.1, 10);
    state.cellsPerWavelength = clampInt(state.cellsPerWavelength, 8, 80);
    state.gridNx = clampInt(state.gridNx, 80, maxGrid.nx);
    state.gridNy = clampInt(state.gridNy, 60, maxGrid.ny);
    state.boundary = normalizeBoundaryMode(state.boundary);
    normalizeBoundarySides();
    state.subpixelSmoothingEnabled = Boolean(state.subpixelSmoothingEnabled);
    if (!knownPresetValue(state.preset)) state.preset = "empty";
    state.slabThicknessLambda = clampNumber(Number(state.slabThicknessLambda) || 0.5, 0.05, 20);
    state.customAnisotropic = Boolean(state.customAnisotropic);
    state.dispersionModel = normalizeDispersionModel(state.dispersionModel);
    state.materialDispersionEnabled = Boolean(state.materialDispersionEnabled) || state.dispersionModel !== "none";
    state.materialModulationEnabled = Boolean(state.materialModulationEnabled);
    state.materialNonlinearEnabled = Boolean(state.materialNonlinearEnabled);
    state.materialHarmonicEnabled = Boolean(state.materialHarmonicEnabled);
    state.materialConductivityEnabled = Boolean(state.materialConductivityEnabled);
    state.materialSaturableGainEnabled = Boolean(state.materialSaturableGainEnabled);
    state.materialPhaseChangeEnabled = Boolean(state.materialPhaseChangeEnabled);
    state.materialGyrotropyEnabled = Boolean(state.materialGyrotropyEnabled);
    state.materialBianisotropyEnabled = Boolean(state.materialBianisotropyEnabled);
    state.brush = objectHasKey(materialNames, state.brush) ? state.brush : "custom";
    state.brushTool = state.brushTool === "geometry" ? "geometry" : "paint";
    normalizeBrushGeometryState();
    normalizeMonitorState();
  }

  return Object.freeze({ normalizeImportedStateValues });
}

const stateNormalizerModule = Object.freeze({ createStateNormalizer });

declare global {
  interface Window {
    FdtdStateNormalizer: typeof stateNormalizerModule;
  }
}

if (typeof window !== "undefined") window.FdtdStateNormalizer = stateNormalizerModule;
