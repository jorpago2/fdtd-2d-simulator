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
    const helpGuideElements = () => Boolean(el.helpGuideToggle && el.helpGuidePanel);
    const helpGuideOpen = () => helpGuideElements() && !el.helpGuidePanel.hidden;
    const setHelpGuideOpen = (open, { restoreFocus = false } = {}) => {
      if (!helpGuideElements()) return;
      el.helpGuidePanel.hidden = !open;
      el.helpGuideToggle.setAttribute("aria-expanded", String(Boolean(open)));
      if (open) {
        closeCanvasActionsMenu();
        el.helpGuidePanel.focus?.({ preventScroll: true });
      } else if (restoreFocus) {
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
