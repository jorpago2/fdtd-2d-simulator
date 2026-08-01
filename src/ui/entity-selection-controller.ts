import type { MaterialRegion, MaterialSelectionController } from "./material-selection-controller";

type SelectionState = Record<string, unknown> & {
  selectedMonitorId?: unknown;
  selectedSourceId?: unknown;
};

type SelectionOptions = {
  clearEntities?: boolean;
  clearMaterial?: boolean;
  clearMonitor?: boolean;
  clearSource?: boolean;
};

function requireObject<T extends object>(value: unknown, name: string): T {
  if (!value || typeof value !== "object") {
    throw new Error(`Entity selection dependency must provide ${name}.`);
  }
  return value as T;
}

export function createEntitySelectionController(dependencies: {
  state: unknown;
  materialSelectionController: unknown;
}) {
  const state = requireObject<SelectionState>(dependencies.state, "state");
  const materialSelectionController = requireObject<MaterialSelectionController>(
    dependencies.materialSelectionController,
    "materialSelectionController",
  );

  function setSourceId(sourceId: unknown): void {
    state.selectedSourceId = sourceId ?? null;
  }

  function setMonitorId(monitorId: unknown): void {
    state.selectedMonitorId = monitorId ?? null;
  }

  function selectSource(sourceId: unknown, options: SelectionOptions = {}): void {
    state.selectedSourceId = sourceId ?? null;
    if (options.clearMonitor !== false) state.selectedMonitorId = null;
    if (options.clearMaterial !== false) materialSelectionController.clear();
  }

  function selectMonitor(monitorId: unknown, options: SelectionOptions = {}): void {
    state.selectedMonitorId = monitorId ?? null;
    if (options.clearSource !== false) state.selectedSourceId = null;
    if (options.clearMaterial !== false) materialSelectionController.clear();
  }

  function selectMaterial(region: MaterialRegion | null | undefined, options: SelectionOptions = {}): void {
    materialSelectionController.setRegion(region);
    if (region && options.clearEntities !== false) {
      state.selectedSourceId = null;
      state.selectedMonitorId = null;
    }
  }

  function clearAll(): void {
    state.selectedSourceId = null;
    state.selectedMonitorId = null;
    materialSelectionController.clear();
  }

  return Object.freeze({
    setSourceId,
    setMonitorId,
    selectSource,
    selectMonitor,
    selectMaterial,
    replaceMaterial: materialSelectionController.replaceRegion,
    clearMaterial: materialSelectionController.clear,
    clearAll,
  });
}

const entitySelectionModule = Object.freeze({ createEntitySelectionController });

declare global {
  interface Window {
    FdtdEntitySelectionController: typeof entitySelectionModule;
  }
}

window.FdtdEntitySelectionController = entitySelectionModule;
