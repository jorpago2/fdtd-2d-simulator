(function initFdtdSceneCatalogLoader(global) {
  "use strict";

  const CATALOG_URL = "js-next/runtime/data/scene-catalog.json?v=20260630-scene-json-1";

  let catalogPromise = null;

  function requireArray(value, name) {
    if (!Array.isArray(value)) {
      throw new Error(`Scene catalog must provide ${name} as an array.`);
    }
    return value;
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
      return {
        id: String(scene.id || ""),
        value: String(scene.id || ""),
        index: Number.isFinite(Number(scene.index)) ? Number(scene.index) : null,
        title: String(scene.title || "Untitled scene"),
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
