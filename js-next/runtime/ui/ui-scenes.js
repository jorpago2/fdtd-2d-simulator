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
    if (/(tez|hz solver|in-plane|magnetic mz)/.test(haystack)) add("TEz");
    if (/(tm|jz|ez|electric dipole)/.test(haystack) && !badges.includes("TEz")) add("TMz");

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

  function cloneSceneCardTemplate(documentRef) {
    const template = typeof documentRef.getElementById === "function" ? documentRef.getElementById("sceneCardTemplate") : null;
    const templateContent = template?.content?.firstElementChild;
    if (templateContent) return templateContent.cloneNode(true);

    const span = (className) => {
      const node = documentRef.createElement("span");
      node.className = className;
      return node;
    };
    const card = documentRef.createElement("button");
    card.type = "button";
    card.className = "scene-card";
    card.dataset.sceneCard = "";
    const thumbnail = span("scene-card-thumb");
    thumbnail.setAttribute("aria-hidden", "true");
    thumbnail.append(documentRef.createElement("span"), documentRef.createElement("span"), documentRef.createElement("span"));
    const header = span("scene-card-header");
    header.append(span("scene-card-number"), span("scene-card-title"));
    card.append(thumbnail, header, span("scene-card-group"), span("scene-card-description"), span("scene-card-badges"));
    return card;
  }

  function ensureSceneThumb(thumbnail, documentRef, record = null) {
    thumbnail.className = thumbnail.classList?.contains("scene-spotlight-thumb")
      ? "scene-card-thumb scene-spotlight-thumb"
      : "scene-card-thumb";
    thumbnail.setAttribute("aria-hidden", "true");
    const src = record?.thumbnailSrc || sceneThumbnailSrc(record?.value);
    if (src) {
      const existing = thumbnail.querySelector("img.scene-thumb-image");
      if (existing?.getAttribute("src") === src) return;
      const image = documentRef.createElement("img");
      image.className = "scene-thumb-image";
      image.src = src;
      image.alt = "";
      image.width = 96;
      image.height = 96;
      image.decoding = "async";
      image.loading = thumbnail.classList.contains("scene-spotlight-thumb") ? "eager" : "lazy";
      image.draggable = false;
      thumbnail.replaceChildren(image);
      return;
    }
    if (!thumbnail.childElementCount) {
      thumbnail.append(documentRef.createElement("span"), documentRef.createElement("span"), documentRef.createElement("span"));
    }
  }

  function fillSceneBadges(badgeRow, record, documentRef) {
    if (!badgeRow) return;
    badgeRow.replaceChildren();
    record.badges.forEach((badgeLabel) => {
      const badge = documentRef.createElement("span");
      badge.className = "scene-card-badge";
      badge.textContent = badgeLabel;
      badgeRow.appendChild(badge);
    });
  }

  function fillSceneCard(card, record, documentRef, onSelectScene, getCurrentPreset) {
    const active = record.value === getCurrentPreset?.();
    card.dataset.sceneCard = record.value;
    card.dataset.sceneThumb = record.thumbnail;
    card.setAttribute("aria-pressed", String(active));

    const thumbnail = card.querySelector(".scene-card-thumb") || documentRef.createElement("span");
    ensureSceneThumb(thumbnail, documentRef, record);
    if (!thumbnail.parentElement) card.prepend(thumbnail);

    const number = card.querySelector(".scene-card-number");
    const title = card.querySelector(".scene-card-title");
    const group = card.querySelector(".scene-card-group");
    const description = card.querySelector(".scene-card-description");
    const badgeRow = card.querySelector(".scene-card-badges");

    if (number) number.textContent = record.index == null ? "-" : String(record.index);
    if (title) title.textContent = record.title;
    if (group) group.textContent = record.group;
    if (description) description.textContent = record.description || "Custom FDTD scene.";
    fillSceneBadges(badgeRow, record, documentRef);

    card.addEventListener("click", () => {
      onSelectScene?.(record.value);
    });
    return card;
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
    };

    function collectSceneRecords() {
      if (state.catalog?.scenes?.length) {
        return state.catalog.scenes.map(createSceneRecordFromCatalogScene);
      }
      if (!el.presetInput) return [];
      return Array.from(el.presetInput.querySelectorAll("option")).map((option) => createSceneRecordFromOption(option, sceneDescriptions));
    }

    function currentSceneGroupLabel() {
      return sceneRecordByValue(el.presetInput?.value || getCurrentPreset?.())?.groupLabel || "";
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
        if (record.groupLabel !== state.filter) return false;
        return sceneRecordMatchesSearch(record, terms);
      });
    }

    function sceneRecordByValue(value) {
      return state.records.find((record) => record.value === value) || null;
    }

    function currentSceneRecordFallback(value = getCurrentPreset?.()) {
      const option = Array.from(el.presetInput?.options || []).find((candidate) => candidate.value === value);
      if (!option) {
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
      const parsed = parseSceneOptionLabel(option.textContent || option.value);
      const groupLabel = option.parentElement?.tagName === "OPTGROUP" ? option.parentElement.label : "General";
      const record = {
        description: sceneDescriptions[value] || sceneDescriptions.empty,
        group: cleanSceneGroupLabel(groupLabel),
        groupLabel,
        index: parsed.index,
        title: parsed.title,
        value,
      };
      record.badges = sceneBadgeLabels(record);
      record.thumbnail = sceneThumbnailKind(record);
      record.thumbnailSrc = sceneThumbnailSrc(record.value);
      return record;
    }

    function updateSceneSpotlight(record) {
      if (!el.sceneSpotlight) return;
      const current = record || sceneRecordByValue(el.presetInput?.value || getCurrentPreset?.()) || currentSceneRecordFallback();
      const thumbnailKind = current.thumbnail || sceneThumbnailKind(current);
      el.sceneSpotlight.dataset.sceneThumb = thumbnailKind;
      const thumb = el.sceneSpotlight.querySelector(".scene-spotlight-thumb");
      if (thumb) ensureSceneThumb(thumb, documentRef, current);
      if (el.sceneSpotlightNumber) {
        el.sceneSpotlightNumber.textContent = current.index == null ? "Custom" : `Example ${current.index}`;
      }
      if (el.sceneSpotlightGroup) el.sceneSpotlightGroup.textContent = current.group || cleanSceneGroupLabel(current.groupLabel);
      if (el.sceneSpotlightTitle) el.sceneSpotlightTitle.textContent = current.title || "Custom scene";
      if (el.sceneSpotlightDescription) {
        el.sceneSpotlightDescription.textContent = current.description || sceneDescriptions.empty || "Custom FDTD scene.";
      }
      fillSceneBadges(el.sceneSpotlightBadges, current, documentRef);
    }

    function updateSceneBrowserMeta(records = visibleSceneRecords()) {
      const visibleCount = records.length;
      const groupTotal = state.records.filter((record) => record.groupLabel === state.filter).length;
      const searchActive = Boolean((el.sceneSearchInput?.value || "").trim());
      const groupName = cleanSceneGroupLabel(state.filter || "Group");
      if (el.sceneBrowserCount) {
        el.sceneBrowserCount.textContent = searchActive
          ? `${visibleCount} of ${groupCountLabel(groupTotal)} in ${groupName}`
          : `${groupCountLabel(visibleCount)} in ${groupName}`;
      }
      if (el.sceneBrowserActive) {
        const current = sceneRecordByValue(el.presetInput?.value || getCurrentPreset?.());
        el.sceneBrowserActive.textContent = current ? `Family: ${current.group}` : "Family: custom";
      }
      updateSceneSpotlight(sceneRecordByValue(el.presetInput?.value || getCurrentPreset?.()));
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
      const filters = groups.map((groupLabel) => ({
        value: groupLabel,
        label: cleanSceneGroupLabel(groupLabel),
      }));

      el.sceneFilterBar.replaceChildren();
      filters.forEach((filter) => {
        const button = documentRef.createElement("button");
        const active = state.filter === filter.value;
        button.type = "button";
        button.className = `scene-filter-button${active ? " is-active" : ""}`;
        button.dataset.sceneFilter = filter.value;
        button.setAttribute("role", "radio");
        button.setAttribute("aria-checked", String(active));
        const filterCount = counts.get(filter.value) || 0;
        button.disabled = !active && filterCount === 0;
        button.setAttribute("aria-label", `${filter.label}: ${filterCount} scenes`);
        const label = documentRef.createElement("span");
        label.className = "scene-filter-label";
        label.textContent = filter.label;
        const count = documentRef.createElement("span");
        count.className = "scene-filter-count";
        count.textContent = String(filterCount);
        button.append(label, count);
        button.addEventListener("click", () => {
          const shouldRestoreFocus = documentRef.activeElement === button;
          state.filter = filter.value;
          renderSceneFilterBar();
          renderSceneCards();
          if (shouldRestoreFocus) {
            const replacement = Array.from(el.sceneFilterBar.querySelectorAll("[data-scene-filter]")).find(
              (candidate) => candidate.dataset.sceneFilter === filter.value
            );
            replacement?.focus?.({ preventScroll: true });
          }
        });
        el.sceneFilterBar.appendChild(button);
      });
    }

    function renderSceneCards() {
      if (!el.sceneCards) return;
      const records = visibleSceneRecords();
      el.sceneCards.replaceChildren();
      updateSceneBrowserMeta(records);

      if (records.length === 0) {
        const emptyState = documentRef.createElement("p");
        emptyState.className = "scene-empty-state";
        emptyState.textContent = "No matching scenes in this group. Clear the search or choose another group.";
        el.sceneCards.appendChild(emptyState);
        return;
      }

      records.forEach((record) => {
        const card = fillSceneCard(cloneSceneCardTemplate(documentRef), record, documentRef, onSelectScene, getCurrentPreset);
        el.sceneCards.appendChild(card);
      });

      syncSceneBrowserSelection();
    }

    function syncSceneBrowserSelection({ focusCurrent = false } = {}) {
      if (!el.sceneCards) return;
      const currentPreset = el.presetInput?.value || getCurrentPreset?.();
      const currentRecord = sceneRecordByValue(currentPreset);
      if (!state.filter) ensureActiveFilter();
      if (focusCurrent && currentRecord?.groupLabel && state.filter !== currentRecord.groupLabel) {
        state.filter = currentRecord.groupLabel;
        renderSceneFilterBar();
        renderSceneCards();
        return;
      }
      updateSceneBrowserMeta(visibleSceneRecords());
      el.sceneCards.querySelectorAll("[data-scene-card]").forEach((card) => {
        const active = card.dataset.sceneCard === currentPreset;
        card.classList.toggle("is-active", active);
        card.setAttribute("aria-pressed", String(active));
        if (active) card.setAttribute("aria-current", "true");
        else card.removeAttribute("aria-current");
      });
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
      rebuildSceneBrowser();
    }

    function setSceneCatalog(catalog) {
      state.catalog = catalog && Array.isArray(catalog.scenes) ? catalog : null;
      rebuildSceneBrowser({ focusCurrent: true });
    }

    return Object.freeze({
      buildSceneBrowser,
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
