(function initFdtdUiScenes(global) {
  "use strict";

  function normalizeSceneText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function cleanSceneGroupLabel(label) {
    return String(label || "General")
      .replace(/^\d+(?:-\d+)?\.\s*/, "")
      .trim();
  }

  function parseSceneOptionLabel(label) {
    const text = String(label || "").trim();
    const match = text.match(/^(\d+)\s*[\u00b7.-]\s*(.+)$/);
    if (!match) return { index: null, title: text || "Untitled scene" };
    return {
      index: Number(match[1]),
      title: match[2].trim(),
    };
  }

  function sceneBadgeLabels(record) {
    const haystack = normalizeSceneText(`${record.value} ${record.title} ${record.description}`);
    const badges = [];
    const add = (label) => {
      if (!badges.includes(label)) badges.push(label);
    };

    if (record.value === "empty") add("Blank");
    if (/(waveguide|guide|coupler|mmi|mach|microstrip|stub)/.test(haystack)) add("Guided");
    if (/(resonator|cavity|ring|fabry|purcell|beta-factor|ringdown)/.test(haystack)) add("Resonator");
    if (/(drude|lorentz|debye|plasma|enz|metal|spp|plasmon|negative-index|superlens|conductive|conductivity)/.test(haystack)) {
      add("ADE/loss");
    }
    if (/(kerr|chi2|chi3|nonlinear|vo2|pcm|saturable|switch|limiter)/.test(haystack)) add("Nonlinear");
    if (/(temporal|modulat|floquet|space-time|traveling)/.test(haystack)) add("Time-varying");
    if (/(anisotropic|gyrotropic|bianisotropic|chiral|hyperbolic|tensor)/.test(haystack)) add("Tensor");
    if (/(photonic crystal|phc|ssh|valley|topolog|bic|honeycomb|bloch)/.test(haystack)) add("Periodic/topology");
    if (/(pt-symmetric|exceptional|non-hermitian|skin-effect|balanced gain)/.test(haystack)) add("Gain/loss");
    if (/(ntff|far-field|rcs|scattering|kerker|mie)/.test(haystack)) add("NTFF");
    if (/(pml|cpml|absorbing)/.test(haystack)) add("CPML");
    return badges.length > 0 ? badges.slice(0, 4) : ["FDTD"];
  }

  function sceneThumbnailKind(record) {
    const haystack = normalizeSceneText(`${record.value} ${record.title} ${record.description} ${record.badges.join(" ")}`);
    if (/(ring|resonator|cavity|fabry|purcell)/.test(haystack)) return "resonator";
    if (/(waveguide|guide|coupler|mmi|mach|microstrip|stub)/.test(haystack)) return "waveguide";
    if (/(photonic crystal|phc|ssh|valley|topolog|honeycomb|lattice)/.test(haystack)) return "lattice";
    if (/(interface|refraction|brewster|tir|coating|mirror|slab)/.test(haystack)) return "interface";
    if (/(slit|aperture|diffraction|scatter|cylinder|dimer|mie|kerker|rcs)/.test(haystack)) return "scatterer";
    if (/(temporal|modulat|floquet|space-time|traveling)/.test(haystack)) return "temporal";
    if (/(drude|plasmon|spp|enz|metal|negative-index|superlens|hyperlens)/.test(haystack)) return "dispersive";
    return "wave";
  }

  function sceneThumbnailSrc(value) {
    const safeValue = String(value || "").replace(/[^A-Za-z0-9_-]/g, "");
    return safeValue ? `assets/scene-thumbnails/${safeValue}.webp` : "";
  }

  function createSceneRecordFromOption(option, sceneDescriptions) {
    const rawLabel = option.textContent || option.value;
    const parsed = parseSceneOptionLabel(rawLabel);
    const groupLabel = option.parentElement?.tagName === "OPTGROUP" ? option.parentElement.label : "General";
    const group = cleanSceneGroupLabel(groupLabel);
    const record = {
      value: option.value,
      index: parsed.index,
      title: parsed.title,
      group,
      groupLabel,
      description: sceneDescriptions[option.value] || "",
      badges: [],
      thumbnail: "wave",
      thumbnailSrc: "",
      haystack: "",
    };
    record.badges = sceneBadgeLabels(record);
    record.thumbnail = sceneThumbnailKind(record);
    record.thumbnailSrc = sceneThumbnailSrc(record.value);
    record.haystack = normalizeSceneText(
      `${record.value} ${record.index ?? ""} ${record.title} ${record.group} ${record.groupLabel} ${record.description} ${record.badges.join(" ")}`
    );
    return record;
  }

  function createSceneRecordFromCatalogScene(scene) {
    const parsed = parseSceneOptionLabel(scene.title || "");
    const record = {
      value: scene.value || scene.id,
      index: scene.index == null ? parsed.index : Number(scene.index),
      title: parsed.index == null ? scene.title || "Untitled scene" : parsed.title,
      group: scene.group || scene.groupName || cleanSceneGroupLabel(scene.groupLabel),
      groupLabel: scene.groupLabel || scene.group || "General",
      description: scene.description || "",
      guide: scene.guide || null,
      badges: [],
      thumbnail: "wave",
      thumbnailSrc: "",
      haystack: "",
    };
    record.badges = scene.badges?.length ? scene.badges.map(String) : sceneBadgeLabels(record);
    record.thumbnail = scene.thumbnail || sceneThumbnailKind(record);
    record.thumbnailSrc = scene.thumbnailSrc || scene.image || sceneThumbnailSrc(record.value);
    record.haystack = normalizeSceneText(
      `${record.value} ${record.index ?? ""} ${record.title} ${record.group} ${record.groupLabel} ${record.description} ${record.badges.join(" ")}`
    );
    return record;
  }

  function groupCountLabel(count) {
    return `${count} scene${count === 1 ? "" : "s"}`;
  }

  function createSceneBrowserController(options) {
    const {
      documentRef = global.document,
      el,
      getCurrentPreset,
      onSelectScene,
      sceneDescriptions = {},
    } = options || {};

    if (!el) throw new Error("createSceneBrowserController requires DOM refs");

    const state = {
      catalog: null,
      filter: "",
      records: [],
      view: "current",
      viewControlsBound: false,
    };

    function normalizeSceneView(value) {
      return value === "browse" ? "browse" : "current";
    }

    function setSceneView(view, { focusSearch = false } = {}) {
      const nextView = normalizeSceneView(view);
      state.view = nextView;
      global.dispatchEvent?.(new CustomEvent("fdtd:scene-view-sync", { detail: { view: nextView } }));
      if (nextView === "browse" && focusSearch) {
        el.sceneSearchInput?.focus?.({ preventScroll: true });
      }
    }

    function bindSceneViewControls() {
      if (state.viewControlsBound) return;
      state.viewControlsBound = true;
      global.addEventListener?.("fdtd:scene-view-request", (event) => {
        const nextView = normalizeSceneView(event?.detail?.view);
        setSceneView(nextView, { focusSearch: nextView === "browse" });
      });
      setSceneView(state.view);
    }

    function collectSceneRecords() {
      return state.catalog?.scenes?.length
        ? state.catalog.scenes.map(createSceneRecordFromCatalogScene)
        : [];
    }

    function currentSceneGroupLabel() {
      return sceneRecordByValue(getCurrentPreset?.())?.groupLabel || "";
    }

    function firstAvailableGroupLabel(records = state.records) {
      return records.find((record) => record.groupLabel)?.groupLabel || "";
    }

    function ensureActiveFilter() {
      if (state.records.some((record) => record.groupLabel === state.filter)) return;
      state.filter = currentSceneGroupLabel() || firstAvailableGroupLabel();
    }

    function sceneSearchTerms() {
      const query = normalizeSceneText(el.sceneSearchInput?.value || "");
      return query.split(/\s+/).filter(Boolean);
    }

    function sceneRecordMatchesSearch(record, terms = sceneSearchTerms()) {
      return terms.every((term) => record.haystack.includes(term));
    }

    function visibleSceneRecords() {
      const terms = sceneSearchTerms();
      ensureActiveFilter();
      return state.records.filter((record) => {
        if (terms.length === 0 && record.groupLabel !== state.filter) return false;
        return sceneRecordMatchesSearch(record, terms);
      });
    }

    function sceneRecordByValue(value) {
      return state.records.find((record) => record.value === value) || null;
    }

    function currentSceneRecordFallback(value = getCurrentPreset?.()) {
      return {
        badges: ["FDTD"],
        description: sceneDescriptions.empty,
        group: "General",
        groupLabel: "General",
        index: null,
        thumbnail: "wave",
        thumbnailSrc: sceneThumbnailSrc(value),
        title: "Custom scene",
        value,
      };
    }

    function updateSceneSpotlight(record) {
      const current = record || sceneRecordByValue(getCurrentPreset?.()) || currentSceneRecordFallback();
      global.dispatchEvent?.(new CustomEvent("fdtd:scene-title", {
        detail: { title: current.title || "Custom scene" },
      }));
      global.dispatchEvent?.(new CustomEvent("fdtd:scene-selection", { detail: { record: current } }));
    }

    function updateSceneBrowserMeta(records = visibleSceneRecords()) {
      const visibleCount = records.length;
      const searchActive = Boolean((el.sceneSearchInput?.value || "").trim());
      const groupName = cleanSceneGroupLabel(state.filter || "Group");
      global.dispatchEvent?.(new CustomEvent("fdtd:scene-browser-meta", { detail: {
        hidden: !searchActive,
        text: searchActive
          ? `${groupCountLabel(visibleCount)} across all families`
          : `${groupCountLabel(visibleCount)} in ${groupName}`,
      } }));
      updateSceneSpotlight(sceneRecordByValue(getCurrentPreset?.()));
    }

    function renderSceneFilterBar() {
      if (!el.sceneFilterBar) return;
      ensureActiveFilter();
      const groups = Array.from(new Set(state.records.map((record) => record.groupLabel)));
      const terms = sceneSearchTerms();
      const matchingRecords = state.records.filter((record) => sceneRecordMatchesSearch(record, terms));
      const counts = new Map();
      groups.forEach((groupLabel) => {
        counts.set(
          groupLabel,
          matchingRecords.filter((record) => record.groupLabel === groupLabel).length
        );
      });
      const filters = groups
        .map((groupLabel) => ({
          value: groupLabel,
          label: cleanSceneGroupLabel(groupLabel),
          count: counts.get(groupLabel) || 0,
        }))
        .filter((filter) => terms.length === 0 || filter.count > 0);

      const renderer = global.FdtdCarbonUI?.renderSceneFilters;
      if (typeof renderer !== "function") throw new Error("Carbon scene filter renderer is unavailable");
      renderer({
        target: el.sceneFilterBar,
        filters: filters.map((filter) => ({
          ...filter,
          disabled: terms.length === 0 && filter.value !== state.filter && filter.count === 0,
        })),
        selectedValue: terms.length > 0 ? "" : state.filter,
        onSelect(value) {
          state.filter = value;
          global.dispatchEvent?.(new CustomEvent("fdtd:scene-search-clear"));
          renderSceneFilterBar();
          renderSceneCards();
        },
      });
    }

    function renderSceneCards() {
      if (!el.sceneCards) return;
      const records = visibleSceneRecords();
      updateSceneBrowserMeta(records);
      const renderer = global.FdtdCarbonUI?.renderSceneCards;
      if (typeof renderer !== "function") throw new Error("Carbon scene card renderer is unavailable");
      renderer({
        target: el.sceneCards,
        records,
        currentPreset: getCurrentPreset?.() || "",
        onSelect(value) {
          onSelectScene?.(value);
          setSceneView("current");
        },
      });
    }

    function syncSceneBrowserSelection({ focusCurrent = false } = {}) {
      if (!el.sceneCards) return;
      const currentPreset = getCurrentPreset?.();
      const currentRecord = sceneRecordByValue(currentPreset);
      if (!state.filter) ensureActiveFilter();
      if (focusCurrent && currentRecord?.groupLabel && state.filter !== currentRecord.groupLabel) {
        state.filter = currentRecord.groupLabel;
        renderSceneFilterBar();
        renderSceneCards();
        return;
      }
      updateSceneBrowserMeta(visibleSceneRecords());
      renderSceneCards();
    }

    function rebuildSceneBrowser({ focusCurrent = false } = {}) {
      state.records = collectSceneRecords();
      if (focusCurrent || !state.filter) {
        state.filter = currentSceneGroupLabel() || firstAvailableGroupLabel();
      }
      ensureActiveFilter();
      renderSceneFilterBar();
      renderSceneCards();
    }

    function buildSceneBrowser() {
      bindSceneViewControls();
      rebuildSceneBrowser();
    }

    function setSceneCatalog(catalog) {
      state.catalog = catalog && Array.isArray(catalog.scenes) ? catalog : null;
      rebuildSceneBrowser({ focusCurrent: true });
    }

    return Object.freeze({
      buildSceneBrowser,
      bindSceneViewControls,
      cleanSceneGroupLabel,
      collectSceneRecords,
      currentSceneRecordFallback,
      parseSceneOptionLabel,
      renderSceneCards,
      renderSceneFilterBar,
      sceneBadgeLabels,
      sceneRecordByValue,
      sceneRecordMatchesSearch,
      sceneSearchTerms,
      sceneThumbnailKind,
      sceneThumbnailSrc,
      setSceneCatalog,
      setSceneView,
      syncSceneBrowserSelection,
      updateSceneBrowserMeta,
      visibleSceneRecords,
      get records() {
        return state.records;
      },
    });
  }

  global.FdtdUiScenes = Object.freeze({
    cleanSceneGroupLabel,
    createSceneBrowserController,
    normalizeSceneText,
    parseSceneOptionLabel,
    sceneBadgeLabels,
    sceneThumbnailKind,
    sceneThumbnailSrc,
  });
})(window);
