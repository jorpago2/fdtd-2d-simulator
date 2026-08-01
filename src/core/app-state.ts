export const defaultMonitorConfig = {
  quantity: "scalar",
  xLambda: 4.5,
  yLambda: 3,
  lengthLambda: 2,
  angleDeg: 90,
};

type StorageWindow = {
  localStorage?: { getItem(key: string): string | null };
};

type InitialStateOptions = {
  defaultSourceConfig: Record<string, unknown>;
  defaultBoundarySides: Record<string, unknown>;
  defaultGrid: { nx: number; ny: number };
  themeStorageKey: string;
  windowRef?: StorageWindow;
};

export function normalizeTheme(theme: unknown): "dark" | "light" {
  return theme === "dark" ? "dark" : "light";
}

export function initialTheme(storageKey: string, windowRef: StorageWindow = window): "dark" | "light" {
  try {
    return normalizeTheme(windowRef.localStorage?.getItem(storageKey));
  } catch {
    return "light";
  }
}

export function normalizeUiDepth(depth: unknown): "advanced" | "teaching" {
  return depth === "advanced" ? "advanced" : "teaching";
}

export function initialUiDepth(): "teaching" {
  return "teaching";
}

export function createInitialAppState({
  defaultSourceConfig,
  defaultBoundarySides,
  defaultGrid,
  themeStorageKey,
  windowRef = window,
}: InitialStateOptions) {
  return {
    running: false,
    theme: initialTheme(themeStorageKey, windowRef),
    uiDepth: initialUiDepth(),
    timeRate: 1,
    renderFps: 0,
    gain: 1,
    autoScale: false,
    fieldComponent: "ez",
    fieldDisplay: "scalar",
    fieldQuiver: false,
    materialFieldOverlay: false,
    diagnosticsEnabled: false,
    maxwellCheckEnabled: false,
    visualLayerBoundaries: true,
    visualLayerMonitors: false,
    visualLayerAxes: true,
    visualLayerScale: true,
    visualLayerSources: true,
    visualLayerColorbar: true,
    analysisEnabled: true,
    analysisSampleEvery: 4,
    sweepMode: "angle",
    sweepStart: 0,
    sweepEnd: 70,
    sweepSamples: 9,
    sweepSteps: 720,
    sweepBidirectional: false,
    sweepRunning: false,
    sweepCancelRequested: false,
    sweepResults: [],
    viewMode: "field",
    viewProjection: "2d",
    surfaceOrbitYawDeg: 0,
    surfaceOrbitPitchDeg: 0,
    materialPart: "real",
    canvasMode: "select",
    drawPreviewCell: null,
    hoveredSourceId: null,
    hoveredMonitorId: null,
    sources: [],
    retiringSources: [],
    selectedSourceId: null,
    nextSourceId: 1,
    sourceDefaults: { ...defaultSourceConfig },
    monitors: [],
    selectedMonitorId: null,
    nextMonitorId: 1,
    monitorDefaults: { ...defaultMonitorConfig },
    wavelengthUm: 1,
    cellsPerWavelength: 20,
    boundary: "absorbing",
    boundarySides: { ...defaultBoundarySides },
    subpixelSmoothingEnabled: false,
    preset: "planeWaveAir",
    gridNx: defaultGrid.nx,
    gridNy: defaultGrid.ny,
    slabThicknessLambda: 0.5,
    customAnisotropic: false,
    customEpsReal: 4,
    customEpsImag: 0,
    customEpsYReal: 4,
    customEpsYImag: 0,
    customMuReal: 1,
    customMuImag: 0,
    customMuYReal: 1,
    customMuYImag: 0,
    brush: "custom",
    brushTool: "paint",
    brushGeometry: "rectangle",
    geometryWidthLambda: 1,
    geometryHeightLambda: 0.5,
    geometryRadiusLambda: 0.45,
    geometryInnerRadiusLambda: 0.25,
    brushSizeLambda: 0.2,
    materialModulationEnabled: false,
    materialNonlinearEnabled: false,
    materialHarmonicEnabled: false,
    materialDispersionEnabled: false,
    materialConductivityEnabled: false,
    materialSaturableGainEnabled: false,
    materialPhaseChangeEnabled: false,
    materialGyrotropyEnabled: false,
    materialBianisotropyEnabled: false,
    materialFullVectorBianisotropyEnabled: false,
    kerrChi3: 0.5,
    kerrSaturation: 5,
    harmonicChi2: 0.08,
    harmonicChi3: 0,
    harmonicSaturation: 6,
    conductivitySigma: 0,
    conductivitySigmaY: 0,
    gainSaturation: 4,
    phaseEpsOn: 9,
    phaseLossOn: 0.08,
    phaseThresholdOn: 0.8,
    phaseThresholdOff: 0.2,
    phaseTauOn: 18,
    phaseTauOff: 180,
    gyrotropyG: 0.25,
    bianisotropyKappa: 0.2,
    dispersionModel: "none",
    dispersionOmegaP: 0.28,
    dispersionGamma: 0.018,
    dispersionOmega0: 0.15,
    dispersionDeltaEps: 2,
    dispersionTau: 18,
    modulationDepth: 0.2,
    modulationFrequency: 0.01,
    modulationPeriodLambda: 2,
    modulationAngleDeg: 0,
    modulationPhaseDeg: 0,
  };
}

const appStateModule = {
  defaultMonitorConfig,
  normalizeTheme,
  normalizeUiDepth,
  initialTheme,
  initialUiDepth,
  createInitialAppState,
};

declare global {
  interface Window {
    FdtdAppState: typeof appStateModule;
  }
}

if (typeof window !== "undefined") window.FdtdAppState = appStateModule;
