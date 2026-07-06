(function initFdtdShellControlBindings(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Shell control bindings dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Shell control bindings dependency must provide ${name}().`);
    }
    return value;
  }

  function forEachNode(nodes, callback) {
    nodes?.forEach?.(callback);
  }

  function isElement(value) {
    return Boolean(global.Element && value instanceof global.Element);
  }

  function bindShellControls(dependencies) {
    const el = requireObject(dependencies.el, "el");
    const windowRef = dependencies.windowRef || global;
    const documentRef = dependencies.documentRef || global.document;
    const setCanvasMode = requireFunction(dependencies.setCanvasMode, "setCanvasMode");
    const toggleControlDrawer = requireFunction(dependencies.toggleControlDrawer, "toggleControlDrawer");
    const closeControlDrawer = requireFunction(dependencies.closeControlDrawer, "closeControlDrawer");
    const toggleCanvasActionsMenu = requireFunction(
      dependencies.toggleCanvasActionsMenu,
      "toggleCanvasActionsMenu",
    );
    const closeCanvasActionsMenu = requireFunction(dependencies.closeCanvasActionsMenu, "closeCanvasActionsMenu");
    const toggleCanvasOptionsMenu = requireFunction(
      dependencies.toggleCanvasOptionsMenu,
      "toggleCanvasOptionsMenu",
    );
    const activateControlTab = requireFunction(dependencies.activateControlTab, "activateControlTab");
    const handleControlTabKeydown = requireFunction(
      dependencies.handleControlTabKeydown,
      "handleControlTabKeydown",
    );
    const activateMobileLayer = requireFunction(dependencies.activateMobileLayer, "activateMobileLayer");
    const refreshSceneSearch = requireFunction(dependencies.refreshSceneSearch, "refreshSceneSearch");
    const applyTheme = requireFunction(dependencies.applyTheme, "applyTheme");
    const applyUiDepth = requireFunction(dependencies.applyUiDepth, "applyUiDepth");
    const closeCanvasContextMenuAndRender = requireFunction(
      dependencies.closeCanvasContextMenuAndRender,
      "closeCanvasContextMenuAndRender",
    );
    const handleCanvasContextAdd = requireFunction(
      dependencies.handleCanvasContextAdd,
      "handleCanvasContextAdd",
    );
    let lastHelpGuideTopicButton = null;
    const helpGuideDefaultKicker = el.helpGuideKicker?.textContent || "Quick guide";
    const helpGuideDefaultTitle = el.helpGuideTitle?.textContent || "How to use the simulator";
    const helpGuideElements = () => Boolean(el.helpGuideToggle && el.helpGuidePanel);
    const helpGuideOpen = () => helpGuideElements() && !el.helpGuidePanel.hidden;
    const setHelpGuideTopic = (topic, { restoreFocus = false } = {}) => {
      const showDetail = Boolean(topic);
      if (el.helpGuideHome) el.helpGuideHome.hidden = showDetail;
      if (el.helpGuideDetail) el.helpGuideDetail.hidden = !showDetail;
      if (el.helpGuideBackBtn) el.helpGuideBackBtn.hidden = !showDetail;
      forEachNode(el.helpGuideTopicPanels, (panel) => {
        panel.hidden = panel.dataset.helpGuideTopicPanel !== topic;
      });
      const activeButton = showDetail
        ? Array.from(el.helpGuideTopicButtons || []).find((button) => button.dataset.helpGuideTopic === topic)
        : null;
      if (el.helpGuideKicker) el.helpGuideKicker.textContent = showDetail ? "Guide detail" : helpGuideDefaultKicker;
      if (el.helpGuideTitle) {
        el.helpGuideTitle.textContent = showDetail
          ? activeButton?.querySelector("strong")?.textContent?.trim() || helpGuideDefaultTitle
          : helpGuideDefaultTitle;
      }
      if (showDetail) {
        el.helpGuideBackBtn?.focus?.({ preventScroll: true });
      } else if (restoreFocus) {
        lastHelpGuideTopicButton?.focus?.({ preventScroll: true });
      }
    };
    const setHelpGuideOpen = (open, { restoreFocus = false } = {}) => {
      if (!helpGuideElements()) return;
      el.helpGuidePanel.hidden = !open;
      el.helpGuideToggle.setAttribute("aria-expanded", String(Boolean(open)));
      if (open) {
        setHelpGuideTopic(null);
        closeCanvasActionsMenu();
        el.helpGuidePanel.focus?.({ preventScroll: true });
      } else {
        setHelpGuideTopic(null);
        lastHelpGuideTopicButton = null;
      }
      if (!open && restoreFocus) {
        el.helpGuideToggle.focus?.({ preventScroll: true });
      }
    };

    el.selectModeBtn?.addEventListener("click", () => setCanvasMode("select"));
    el.brushModeBtn?.addEventListener("click", () => setCanvasMode("brush"));

    el.controlDrawerToggle?.addEventListener("click", toggleControlDrawer);
    el.controlDrawerCloseBtn?.addEventListener("click", closeControlDrawer);
    el.controlDrawerBackdrop?.addEventListener("click", closeControlDrawer);

    el.canvasActionToggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCanvasActionsMenu();
    });
    el.canvasActionMenu?.addEventListener("click", (event) => {
      if (isElement(event.target) && event.target.closest("button")) {
        windowRef.setTimeout(closeCanvasActionsMenu, 0);
      }
    });
    el.canvasOptionsToggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCanvasOptionsMenu();
    });
    el.canvasViewControls?.addEventListener("click", (event) => {
      if (!isElement(event.target)) return;
      if (event.target.closest("button, input, label")) {
        event.stopPropagation();
      }
    });

    forEachNode(el.controlTabButtons, (button) => {
      button.addEventListener("click", () => activateControlTab(button.dataset.controlTab));
      button.addEventListener("keydown", handleControlTabKeydown);
    });
    forEachNode(el.mobileLayerButtons, (button) => {
      button.addEventListener("click", () => activateMobileLayer(button.dataset.mobileLayer));
    });

    el.sceneSearchInput?.addEventListener("input", refreshSceneSearch);

    forEachNode(el.themeButtons, (button) => {
      button.addEventListener("click", () => applyTheme(button.dataset.themeChoice));
    });
    forEachNode(el.uiDepthButtons, (button) => {
      button.addEventListener("click", () => applyUiDepth(button.dataset.uiDepthChoice));
    });

    el.canvasContextCloseBtn?.addEventListener("click", closeCanvasContextMenuAndRender);
    el.canvasContextMenu?.addEventListener("click", (event) => {
      const button = isElement(event.target) ? event.target.closest("[data-canvas-add]") : null;
      if (button) {
        handleCanvasContextAdd(button);
      }
    });

    el.helpGuideToggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      setHelpGuideOpen(!helpGuideOpen(), { restoreFocus: true });
    });
    forEachNode(el.helpGuideTopicButtons, (button) => {
      button.addEventListener("click", () => {
        lastHelpGuideTopicButton = button;
        setHelpGuideTopic(button.dataset.helpGuideTopic);
      });
    });
    el.helpGuideBackBtn?.addEventListener("click", () => setHelpGuideTopic(null, { restoreFocus: true }));
    el.helpGuideCloseBtn?.addEventListener("click", () => setHelpGuideOpen(false, { restoreFocus: true }));
    el.helpGuidePanel?.addEventListener("click", (event) => event.stopPropagation());
    documentRef?.addEventListener?.("click", (event) => {
      if (!helpGuideOpen()) return;
      if (isElement(event.target) && (event.target.closest("#helpGuidePanel") || event.target.closest("#helpGuideToggle"))) return;
      setHelpGuideOpen(false);
    });
    documentRef?.addEventListener?.("keydown", (event) => {
      if (event.key === "Escape" && helpGuideOpen()) {
        event.stopPropagation();
        setHelpGuideOpen(false, { restoreFocus: true });
      }
    });
  }

  global.FdtdShellControlBindings = Object.freeze({
    bindShellControls,
  });
})(window);
