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
    const setControlDrawerOpen =
      typeof dependencies.setControlDrawerOpen === "function"
        ? dependencies.setControlDrawerOpen
        : (open) => {
            const isOpen = Boolean(el.appShell?.classList.contains("controls-open"));
            if (Boolean(open) !== isOpen) toggleControlDrawer();
          };
    const toggleCanvasActionsMenu = requireFunction(
      dependencies.toggleCanvasActionsMenu,
      "toggleCanvasActionsMenu",
    );
    const closeCanvasActionsMenu = requireFunction(dependencies.closeCanvasActionsMenu, "closeCanvasActionsMenu");
    const toggleCanvasOptionsMenu = requireFunction(
      dependencies.toggleCanvasOptionsMenu,
      "toggleCanvasOptionsMenu",
    );
    const closeCanvasOptionsMenu = requireFunction(
      dependencies.closeCanvasOptionsMenu,
      "closeCanvasOptionsMenu",
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
    const editHelpPanel = documentRef.querySelector('[data-help-guide-topic-panel="edit"]');
    if (editHelpPanel && editHelpPanel.dataset.progressiveDisclosure !== "true") {
      editHelpPanel.dataset.progressiveDisclosure = "true";
      const referenceContent = documentRef.createElement("div");
      referenceContent.className = "help-guide-reference-content";
      Array.from(editHelpPanel.children).forEach((child) => referenceContent.appendChild(child));

      const quickGuide = documentRef.createElement("div");
      quickGuide.className = "help-guide-quick-steps";
      const quickGuideIntro = documentRef.createElement("p");
      quickGuideIntro.textContent = "Edit changes the numerical experiment. Reset fields and recollect monitor data after changing geometry or materials.";
      const quickGuideList = documentRef.createElement("ul");
      [
        ["Select:", " tap an object to select it; drag to move it."],
        ["Add or edit:", " right-click on desktop or long-press on touch to open the contextual editor."],
        ["Draw:", " tap to paint one point, drag for a stroke, or long-press to configure the brush and material."],
      ].forEach(([label, description]) => {
        const item = documentRef.createElement("li");
        const term = documentRef.createElement("strong");
        term.textContent = label;
        item.append(term, description);
        quickGuideList.append(item);
      });
      quickGuide.append(quickGuideIntro, quickGuideList);

      const reference = documentRef.createElement("section");
      reference.className = "help-guide-reference scene-guide-details";
      reference.dataset.carbonDisclosure = "";
      reference.dataset.title = "Scientific editing reference";
      reference.append(referenceContent);
      editHelpPanel.append(quickGuide, reference);
      global.FdtdCarbonUI?.upgradeDisclosures?.(editHelpPanel);
    }
    let lastHelpGuideTopicButton = null;
    let helpGuideReturnFocus = null;
    const helpGuideDefaultKicker = el.helpGuideKicker?.textContent || "Quick guide";
    const helpGuideDefaultTitle = el.helpGuideTitle?.textContent || "How to use the simulator";
    const helpGuideElements = () => Boolean(el.helpGuideToggle && el.helpGuidePanel);
    const helpGuideOpen = () => helpGuideElements() && !el.helpGuidePanel.hidden;
    const stableHelpGuideTrigger = () => documentRef?.querySelector?.(".scientific-header-help__button") || null;
    const visibleConnectedElement = (element) => Boolean(
      element?.isConnected
      && (typeof element.getClientRects !== "function" || element.getClientRects().length > 0),
    );
    const helpGuideFocusableElements = () => Array.from(el.helpGuidePanel?.querySelectorAll?.(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) || []).filter((element) => {
      if (element.closest?.('[hidden], [inert], [aria-hidden="true"]')) return false;
      return typeof element.getClientRects !== "function" || element.getClientRects().length > 0;
    });
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
      if (
        open &&
        el.appShell?.classList.contains("controls-open") &&
        global.getComputedStyle?.(el.stage)?.display === "none"
      ) {
        setControlDrawerOpen(false);
      }
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
        const focusTarget = visibleConnectedElement(helpGuideReturnFocus)
          ? helpGuideReturnFocus
          : stableHelpGuideTrigger();
        focusTarget?.focus?.({ preventScroll: true });
      }
    };
    const walkthroughController = global.FdtdHelpWalkthrough?.createHelpWalkthroughController?.({
      activateControlTab,
      closeCanvasActionsMenu,
      closeCanvasContextMenuAndRender,
      closeCanvasOptionsMenu,
      closeControlDrawer,
      documentRef,
      el,
      setControlDrawerOpen,
      setHelpGuideOpen,
      windowRef,
    });

    el.selectModeBtn?.addEventListener("click", () => setCanvasMode("select"));
    el.brushModeBtn?.addEventListener("click", () => setCanvasMode("brush"));

    el.controlDrawerToggle?.addEventListener("click", toggleControlDrawer);
    el.controlDrawerCloseBtn?.addEventListener("click", closeControlDrawer);
    el.controlDrawerBackdrop?.addEventListener("click", closeControlDrawer);

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
    windowRef.addEventListener("fdtd:workflow-change", (event) => {
      const layer = event?.detail?.layer;
      if (!layer) return;
      const panelIsOpen = Boolean(el.appShell?.classList.contains("controls-open"));
      if (!panelIsOpen) toggleControlDrawer();
      activateMobileLayer(layer);
    });

    el.sceneSearchInput?.addEventListener("input", refreshSceneSearch);

    windowRef.addEventListener("fdtd:theme-change", (event) => {
      applyTheme(event?.detail?.theme);
    });
    forEachNode(el.uiDepthButtons, (button) => {
      button.addEventListener("click", () => applyUiDepth(button.dataset.uiDepthChoice));
    });

    el.canvasContextCloseBtn?.addEventListener("click", closeCanvasContextMenuAndRender);
    el.contextInspectorHost?.addEventListener("click", (event) => {
      const button = isElement(event.target) ? event.target.closest("[data-canvas-add]") : null;
      if (button) {
        handleCanvasContextAdd(button);
      }
    });

    el.helpGuideToggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!helpGuideOpen()) helpGuideReturnFocus = event.currentTarget;
      setHelpGuideOpen(!helpGuideOpen(), { restoreFocus: true });
    });
    const openHelpGuideFromHeader = () => {
      const activeElement = documentRef?.activeElement || null;
      helpGuideReturnFocus = visibleConnectedElement(activeElement) ? activeElement : stableHelpGuideTrigger();
      setHelpGuideOpen(true);
    };
    windowRef.FdtdOpenHelpGuide = openHelpGuideFromHeader;
    windowRef.addEventListener("fdtd:open-help-guide", openHelpGuideFromHeader);
    forEachNode(el.helpGuideTopicButtons, (button) => {
      button.addEventListener("click", () => {
        lastHelpGuideTopicButton = button;
        setHelpGuideTopic(button.dataset.helpGuideTopic);
      });
    });
    el.helpGuideBackBtn?.addEventListener("click", () => setHelpGuideTopic(null, { restoreFocus: true }));
    el.helpGuideCloseBtn?.addEventListener("click", () => setHelpGuideOpen(false, { restoreFocus: true }));
    el.helpGuidePanel?.addEventListener("click", (event) => event.stopPropagation());
    walkthroughController?.bind?.();
    documentRef?.addEventListener?.("click", (event) => {
      if (!helpGuideOpen()) return;
      if (isElement(event.target) && (event.target.closest("#helpGuidePanel") || event.target.closest("#helpGuideToggle"))) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setHelpGuideOpen(false, { restoreFocus: true });
    }, true);
    documentRef?.addEventListener?.("keydown", (event) => {
      if (!helpGuideOpen()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        setHelpGuideOpen(false, { restoreFocus: true });
        return;
      }
      if (event.key === "Tab") {
        const focusable = helpGuideFocusableElements();
        if (!focusable.length) {
          event.preventDefault();
          el.helpGuidePanel.focus?.({ preventScroll: true });
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = documentRef.activeElement;
        if (!el.helpGuidePanel.contains(active) || (event.shiftKey && (active === first || active === el.helpGuidePanel))) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus?.({ preventScroll: true });
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus?.({ preventScroll: true });
        }
      }
    }, true);
  }

  global.FdtdShellControlBindings = Object.freeze({
    bindShellControls,
  });
})(window);
