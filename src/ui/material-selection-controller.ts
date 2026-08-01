export type MaterialRegion = Record<string, unknown> & {
  cells?: readonly unknown[];
};

export function createMaterialSelectionController() {
  const state: { region: MaterialRegion | null } = { region: null };

  function getRegion(): MaterialRegion | null {
    return state.region;
  }

  function setRegion(region: MaterialRegion | null | undefined): MaterialRegion | null {
    state.region = region || null;
    return state.region;
  }

  function clear(): void {
    state.region = null;
  }

  function hasRegion(): boolean {
    return Boolean(state.region?.cells?.length);
  }

  return Object.freeze({
    state,
    getRegion,
    setRegion,
    replaceRegion: setRegion,
    clear,
    hasRegion,
  });
}

export type MaterialSelectionController = ReturnType<typeof createMaterialSelectionController>;

const materialSelectionModule = Object.freeze({ createMaterialSelectionController });

declare global {
  interface Window {
    FdtdMaterialSelectionController: typeof materialSelectionModule;
  }
}

window.FdtdMaterialSelectionController = materialSelectionModule;
