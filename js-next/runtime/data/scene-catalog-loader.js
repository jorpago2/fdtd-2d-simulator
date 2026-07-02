(function initFdtdSceneCatalogLoader(global) {
  "use strict";

  const CATALOG_URL = "js-next/runtime/data/scene-catalog.json?v=20260702-scene-library-1";

  let catalogPromise = null;

  function requireArray(value, name) {
    if (!Array.isArray(value)) {
      throw new Error(`Scene catalog must provide ${name} as an array.`);
    }
    return value;
  }

  function parseSceneTitle(value, fallbackTitle = "Untitled scene") {
    const title = String(value || "").trim();
    const match = title.match(/^(\d+)\s*[\u00b7.-]\s*(.+)$/);
    if (!match) return { index: null, title: title || fallbackTitle };
    return {
      index: Number(match[1]),
      title: match[2].trim() || fallbackTitle,
    };
  }

  function normalizeSceneCatalog(rawCatalog) {
    if (!rawCatalog || typeof rawCatalog !== "object") {
      throw new Error("Scene catalog response is not an object.");
    }

    const groups = requireArray(rawCatalog.groups, "groups").map((group, index) => ({
      id: String(group.id || `group-${index + 1}`),
      label: String(group.label || group.name || `Group ${index + 1}`),
      name: String(group.name || group.label || `Group ${index + 1}`),
      sceneIds: Array.isArray(group.sceneIds) ? group.sceneIds.map(String) : [],
    }));

    const groupById = new Map(groups.map((group) => [group.id, group]));
    const scenes = requireArray(rawCatalog.scenes, "scenes").map((scene) => {
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
        guide: scene.guide && typeof scene.guide === "object" ? scene.guide : null,
      };
    });

    const missingIds = scenes.filter((scene) => !scene.id).length;
    if (missingIds > 0) {
      throw new Error(`Scene catalog has ${missingIds} scene(s) without id.`);
    }

    return Object.freeze({
      schemaVersion: Number(rawCatalog.schemaVersion) || 1,
      groups: Object.freeze(groups),
      scenes: Object.freeze(scenes),
      descriptions: Object.freeze(Object.fromEntries(scenes.map((scene) => [scene.id, scene.description]))),
    });
  }

  function loadSceneCatalog(fetchRef = global.fetch) {
    if (catalogPromise) return catalogPromise;
    if (typeof fetchRef !== "function") {
      catalogPromise = Promise.reject(new Error("Scene catalog loader requires fetch()."));
      return catalogPromise;
    }

    catalogPromise = fetchRef(CATALOG_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load scene catalog: HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(normalizeSceneCatalog);

    return catalogPromise;
  }

  global.FdtdSceneCatalogLoader = Object.freeze({
    CATALOG_URL,
    loadSceneCatalog,
    normalizeSceneCatalog,
  });
})(window);
