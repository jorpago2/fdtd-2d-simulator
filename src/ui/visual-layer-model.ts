export const VISUAL_LAYER_STATE_KEYS = Object.freeze({
  boundaries: "visualLayerBoundaries",
  monitors: "visualLayerMonitors",
  axes: "visualLayerAxes",
  scale: "visualLayerScale",
  sources: "visualLayerSources",
  colorbar: "visualLayerColorbar",
} as const);

export type VisualLayer = keyof typeof VISUAL_LAYER_STATE_KEYS;
type VisualState = Record<string, unknown>;

export const DEFAULT_VISUAL_LAYER_STATE: Readonly<Record<VisualLayer, boolean>> = Object.freeze({
  boundaries: true,
  monitors: false,
  axes: true,
  scale: true,
  sources: true,
  colorbar: true,
});

export interface VisualLayerOptions {
  renderOverrides?: Partial<Record<VisualLayer, boolean>>;
  snapshot?: Partial<Record<VisualLayer, boolean>>;
}

function knownLayer(layer: string): layer is VisualLayer {
  return Object.prototype.hasOwnProperty.call(VISUAL_LAYER_STATE_KEYS, layer);
}

export function visualLayerSnapshot(state: VisualState | null | undefined): Record<VisualLayer, boolean> {
  return Object.fromEntries(
    Object.entries(VISUAL_LAYER_STATE_KEYS).map(([layer, stateKey]) => [
      layer,
      state?.[stateKey] == null
        ? DEFAULT_VISUAL_LAYER_STATE[layer as VisualLayer]
        : Boolean(state[stateKey]),
    ]),
  ) as Record<VisualLayer, boolean>;
}

export function visualLayerEnabled(
  state: VisualState | null | undefined,
  layer: string,
  options: VisualLayerOptions = {},
): boolean {
  if (!knownLayer(layer)) return true;
  if (options.renderOverrides && Object.prototype.hasOwnProperty.call(options.renderOverrides, layer)) {
    return Boolean(options.renderOverrides[layer]);
  }
  return Boolean((options.snapshot || visualLayerSnapshot(state))[layer]);
}

export function applyCustomVisualLayer(state: VisualState | null | undefined, layer: string, enabled: unknown): boolean {
  if (!state || !knownLayer(layer)) return false;
  state[VISUAL_LAYER_STATE_KEYS[layer]] = Boolean(enabled);
  return true;
}

const visualLayerModel = Object.freeze({
  VISUAL_LAYER_STATE_KEYS,
  DEFAULT_VISUAL_LAYER_STATE,
  visualLayerSnapshot,
  visualLayerEnabled,
  applyCustomVisualLayer,
});

declare global {
  interface Window {
    FdtdVisualLayerModel: typeof visualLayerModel;
  }
}

window.FdtdVisualLayerModel = visualLayerModel;
