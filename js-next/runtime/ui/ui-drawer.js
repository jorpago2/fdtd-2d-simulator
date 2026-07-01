(function initFdtdUiDrawer(global) {
  "use strict";

  const DEFAULT_CONTROL_PANEL_CONTEXTS = Object.freeze({
    scenes: Object.freeze({ compactTitle: "Scene", kicker: "Step 1 · Scene", title: "Scene setup" }),
    simulation: Object.freeze({ compactTitle: "Simulate", kicker: "Step 2 · Simulate", title: "Run and display" }),
    results: Object.freeze({ compactTitle: "Results", kicker: "Step 3 · Results", title: "Measurements" }),
    config: Object.freeze({ compactTitle: "Numerics", kicker: "Step 4 · Numerics", title: "Numerics" }),
  });

  const DEFAULT_TAB_LAYERS = Object.freeze({
    scenes: "scenes",
    simulation: "simulation",
    results: "results",
    config: "config",
  });

  const DEFAULT_MOBILE_LAYER_ROUTES = Object.freeze({
    scenes: Object.freeze({ tab: "scenes", focusSelector: ".scene-section" }),
    simulation: Object.freeze({ tab: "simulation", focusSelector: ".run-section" }),
    results: Object.freeze({ tab: "results", focusSelector: ".diagnostics-section" }),
    config: Object.freeze({ tab: "config", focusSelector: ".scale-section" }),
  });

  function createMediaMatcher(query) {
    return () => global.matchMedia?.(query)?.matches ?? false;
  }

  function createDrawerController(options) {
    const {
      callbacks = {},
      compactCanvasMediaQuery = "(max-width: 1180px)",
      compactControlsMediaQuery,
      compactPanelTitleMediaQuery,
      compactResultsMediaQuery,
      contexts = DEFAULT_CONTROL_PANEL_CONTEXTS,
      documentRef = global.document,
      el,
      mobileLayerRoutes = DEFAULT_MOBILE_LAYER_ROUTES,
      tabLayers = DEFAULT_TAB_LAYERS,
      uiCore,
    } = options || {};

    if (!el) throw new Error("createDrawerController requires DOM refs");
    if (!uiCore) throw new Error("createDrawerController requires FdtdUiCore");

    const compactCanvasActive = createMediaMatcher(compactCanvasMediaQuery);
    const compactControlsActive = createMediaMatcher(compactControlsMediaQuery);
    const compactPanelTitleActive = createMediaMatcher(compactPanelTitleMediaQuery);
    const compactResultsActive = createMediaMatcher(compactResultsMediaQuery);
    let lastCompactResultsDetailState = null;

    function controlTabLayerName(tabName) {
      return tabLayers[tabName] || "scenes";
    }

    function activeControlTabName() {
      return uiCore.activeDatasetValue(el.controlTabButtons, "controlTab", "scenes");
    }

    function activeMobileLayerName() {
      return uiCore.activeDatasetValue(el.mobileLayerButtons, "mobileLayer");
    }

    function updateControlPanelContext(layerName = activeMobileLayerName() || controlTabLayerName(activeControlTabName())) {
      const context = contexts[layerName] || contexts.scenes;
      const panelTitle = compactPanelTitleActive() ? context.compactTitle || context.title : context.title;
      if (el.controlPanelKicker) {
        el.controlPanelKicker.textContent = context.kicker;
      }
      if (el.controlPanelTitle) {
        el.controlPanelTitle.textContent = panelTitle;
      }
      if (el.controlPanel) {
        el.controlPanel.setAttribute("aria-label", `${context.title} controls`);
      }
    }

    function setMobileLayerActive(layerName) {
      if (el.controlPanel) {
        el.controlPanel.dataset.mobileLayer = layerName;
      }
      updateControlPanelContext(layerName);
      uiCore.setExclusiveButtonState(el.mobileLayerButtons, "mobileLayer", layerName, {
        currentValue: "page",
        selectedAttribute: null,
      });
    }

    function focusControlPanelSection(selector) {
      uiCore.scrollChildIntoView(el.controlPanel, selector);
    }

    function activateControlTab(tabName, options = {}) {
      const selected = tabName || "scenes";
      uiCore.setExclusiveButtonState(el.controlTabButtons, "controlTab", selected);
      uiCore.setExclusivePanels(el.controlTabPanels, "controlPanel", selected);
      setMobileLayerActive(options.layer || controlTabLayerName(selected));
      if (options.focusSelector) {
        focusControlPanelSection(options.focusSelector);
      }
      if (selected === "results") {
        callbacks.onResultsTabActivated?.();
      }
    }

    function activateMobileLayer(layerName) {
      const layer = layerName || "scenes";
      const route = mobileLayerRoutes[layer] || mobileLayerRoutes.scenes;
      activateControlTab(route.tab, { layer, focusSelector: route.focusSelector });
    }

    function syncResultsDetailPanels(force = false) {
      const compact = compactResultsActive();
      if (!force && compact === lastCompactResultsDetailState) return;
      lastCompactResultsDetailState = compact;
      if (!compact) return;
      el.resultsDetailPanels?.forEach((panel) => {
        panel.open = false;
      });
    }

    function controlDrawerOverlayActive() {
      return callbacks.isControlDrawerOverlayActive?.() ?? true;
    }

    function refreshControlPanelData() {
      callbacks.refreshControlPanelData?.();
    }

    function setControlDrawerOpen(open) {
      const isOpen = Boolean(open) && controlDrawerOverlayActive();
      uiCore.setClass(el.appShell, "controls-open", isOpen);
      uiCore.setClass(documentRef.body, "controls-drawer-open", isOpen);
      uiCore.setExpanded(el.controlDrawerToggle, isOpen);
      uiCore.setHidden(el.controlDrawerBackdrop, !isOpen);
      if (isOpen) {
        closeCanvasActionsMenu();
        closeCanvasOptionsMenu();
        if (activeMobileLayerName() === "visual") {
          setMobileLayerActive(controlTabLayerName(activeControlTabName()));
        }
        refreshControlPanelData();
        el.controlPanel?.focus?.({ preventScroll: true });
      }
    }

    function closeControlDrawer() {
      setControlDrawerOpen(false);
    }

    function toggleControlDrawer() {
      setControlDrawerOpen(!el.appShell?.classList.contains("controls-open"));
    }

    function canvasActionsMenuActive() {
      return Boolean(el.canvasActionToggle && el.canvasActionMenu);
    }

    function setCanvasActionsOpen(open) {
      const isOpen = Boolean(open) && canvasActionsMenuActive();
      uiCore.setClass(el.stage, "canvas-actions-open", isOpen);
      uiCore.setExpanded(el.canvasActionToggle, isOpen);
      if (isOpen) {
        closeCanvasOptionsMenu();
      }
    }

    function closeCanvasActionsMenu() {
      setCanvasActionsOpen(false);
    }

    function toggleCanvasActionsMenu() {
      setCanvasActionsOpen(!el.stage?.classList.contains("canvas-actions-open"));
    }

    function canvasOptionsMenuActive() {
      return compactCanvasActive();
    }

    function setCanvasOptionsOpen(open) {
      const isOpen = Boolean(open) && canvasOptionsMenuActive();
      uiCore.setClass(el.stage, "canvas-options-open", isOpen);
      uiCore.setExpanded(el.canvasOptionsToggle, isOpen);
      if (isOpen) {
        closeCanvasActionsMenu();
        setMobileLayerActive("simulation");
      }
    }

    function closeCanvasOptionsMenu() {
      const restorePanelLayer =
        activeMobileLayerName() === "simulation" && controlTabLayerName(activeControlTabName()) !== "simulation";
      setCanvasOptionsOpen(false);
      if (restorePanelLayer) {
        setMobileLayerActive(controlTabLayerName(activeControlTabName()));
      }
    }

    function toggleCanvasOptionsMenu() {
      setCanvasOptionsOpen(!el.stage?.classList.contains("canvas-options-open"));
    }

    function handleControlTabKeydown(event) {
      const buttons = Array.from(el.controlTabButtons || []);
      const currentIndex = buttons.indexOf(event.currentTarget);
      if (currentIndex < 0) return;
      const lastIndex = buttons.length - 1;
      let nextIndex = currentIndex;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = currentIndex >= lastIndex ? 0 : currentIndex + 1;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = currentIndex <= 0 ? lastIndex : currentIndex - 1;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = lastIndex;
      else return;
      event.preventDefault();
      const nextButton = buttons[nextIndex];
      nextButton.focus();
      activateControlTab(nextButton.dataset.controlTab);
    }

    return Object.freeze({
      activateControlTab,
      activateMobileLayer,
      activeControlTabName,
      activeMobileLayerName,
      canvasActionsMenuActive,
      canvasOptionsMenuActive,
      closeCanvasActionsMenu,
      closeCanvasOptionsMenu,
      closeControlDrawer,
      compactControlDrawerActive: compactControlsActive,
      controlDrawerOverlayActive,
      controlTabLayerName,
      focusControlPanelSection,
      handleControlTabKeydown,
      refreshControlPanelData,
      setCanvasActionsOpen,
      setCanvasOptionsOpen,
      setControlDrawerOpen,
      setMobileLayerActive,
      syncResultsDetailPanels,
      toggleCanvasActionsMenu,
      toggleCanvasOptionsMenu,
      toggleControlDrawer,
      updateControlPanelContext,
    });
  }

  global.FdtdUiDrawer = Object.freeze({ createDrawerController });
})(window);
