declare const __FDTD_BUILD_VERSION__: string;

type UnknownRecord = Record<string, unknown>;

export interface SceneGroup {
  id: string;
  label: string;
  name: string;
  sceneIds: string[];
}

export interface SceneRecord {
  id: string;
  value: string;
  index: number | null;
  title: string;
  groupId: string;
  groupLabel: string;
  groupName: string;
  group: string;
  description: string;
  guide: UnknownRecord | null;
}

export interface SceneCatalog {
  schemaVersion: number;
  groups: readonly SceneGroup[];
  scenes: readonly SceneRecord[];
  descriptions: Readonly<Record<string, string>>;
}

export const CATALOG_URL = `src/runtime/data/scene-catalog.json?v=${encodeURIComponent(__FDTD_BUILD_VERSION__)}`;

let catalogPromise: Promise<SceneCatalog> | null = null;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function requireArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Scene catalog must provide ${name} as an array.`);
  return value;
}

function parseSceneTitle(value: unknown, fallbackTitle = "Untitled scene"): { index: number | null; title: string } {
  const title = String(value || "").trim();
  const match = title.match(/^(\d+)\s*[\u00b7.-]\s*(.+)$/);
  if (!match) return { index: null, title: title || fallbackTitle };
  return {
    index: Number(match[1]),
    title: match[2].trim() || fallbackTitle,
  };
}

export function normalizeSceneCatalog(rawCatalog: unknown): SceneCatalog {
  if (!rawCatalog || typeof rawCatalog !== "object") throw new Error("Scene catalog response is not an object.");
  const raw = record(rawCatalog);
  const groups = requireArray(raw.groups, "groups").map((value, index): SceneGroup => {
    const group = record(value);
    return {
      id: String(group.id || `group-${index + 1}`),
      label: String(group.label || group.name || `Group ${index + 1}`),
      name: String(group.name || group.label || `Group ${index + 1}`),
      sceneIds: Array.isArray(group.sceneIds) ? group.sceneIds.map(String) : [],
    };
  });

  const groupById = new Map(groups.map((group) => [group.id, group]));
  const scenes = requireArray(raw.scenes, "scenes").map((value): SceneRecord => {
    const scene = record(value);
    const group = groupById.get(String(scene.groupId || ""));
    const groupLabel = String(scene.groupLabel || group?.label || "General");
    const groupName = String(scene.groupName || group?.name || groupLabel);
    const parsedTitle = parseSceneTitle(scene.title);
    const parsedIndex = Number.isFinite(Number(scene.index)) ? Number(scene.index) : parsedTitle.index;
    return {
      id: String(scene.id || ""),
      value: String(scene.id || ""),
      index: parsedIndex,
      title: parsedTitle.title,
      groupId: String(scene.groupId || group?.id || "general"),
      groupLabel,
      groupName,
      group: groupName,
      description: String(scene.description || ""),
      guide: scene.guide && typeof scene.guide === "object" ? record(scene.guide) : null,
    };
  });

  const missingIds = scenes.filter((scene) => !scene.id).length;
  if (missingIds > 0) throw new Error(`Scene catalog has ${missingIds} scene(s) without id.`);

  return Object.freeze({
    schemaVersion: Number(raw.schemaVersion) || 1,
    groups: Object.freeze(groups),
    scenes: Object.freeze(scenes),
    descriptions: Object.freeze(Object.fromEntries(scenes.map((scene) => [scene.id, scene.description]))),
  });
}

export function loadSceneCatalog(fetchRef: typeof fetch = window.fetch.bind(window)): Promise<SceneCatalog> {
  if (catalogPromise) return catalogPromise;
  if (typeof fetchRef !== "function") {
    catalogPromise = Promise.reject(new Error("Scene catalog loader requires fetch()."));
    return catalogPromise;
  }
  catalogPromise = fetchRef(CATALOG_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load scene catalog: HTTP ${response.status}`);
      return response.json() as Promise<unknown>;
    })
    .then(normalizeSceneCatalog);
  return catalogPromise;
}

const sceneCatalogLoader = Object.freeze({ CATALOG_URL, loadSceneCatalog, normalizeSceneCatalog });

declare global {
  interface Window {
    FdtdSceneCatalogLoader: typeof sceneCatalogLoader;
  }
}

window.FdtdSceneCatalogLoader = sceneCatalogLoader;
