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
    let lastHelpGuideTopicButton = null;
    let helpGuideReturnFocus = null;
    let helpGuideState = { open: false, topic: null };
    const helpGuideElements = () => Boolean(el.helpGuidePanel);
    const helpGuideOpen = () => helpGuideState.open;
    const publishHelpGuideState = () => windowRef.dispatchEvent(new windowRef.CustomEvent("fdtd:help-guide-state", { detail: helpGuideState }));
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
      helpGuideState = { ...helpGuideState, topic: showDetail ? topic : null };
      publishHelpGuideState();
      if (showDetail) {
        global.requestAnimationFrame?.(() => el.helpGuideBackBtn?.focus?.({ preventScroll: true }));
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
      helpGuideState = { open: Boolean(open), topic: null };
      publishHelpGuideState();
      documentRef.body.classList.toggle("help-guide-open", Boolean(open));
      if (el.appShell) {
        el.appShell.inert = Boolean(open);
        if (open) el.appShell.setAttribute("aria-hidden", "true");
        else el.appShell.removeAttribute("aria-hidden");
      }
      if (open) {
        closeCanvasActionsMenu();
        global.requestAnimationFrame?.(() => (el.walkthroughStartBtn || helpGuideFocusableElements()[0] || el.helpGuidePanel)
          ?.focus?.({ preventScroll: true }));
      } else {
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

    windowRef.addEventListener("fdtd:canvas-mode", (event) => {
      setCanvasMode(event?.detail?.mode === "brush" ? "brush" : "select");
    });

    windowRef.addEventListener("fdtd:close-controls", closeControlDrawer);

    windowRef.addEventListener("fdtd:control-tab-request", (event) => {
      const layer = event?.detail?.tab;
      if (layer) windowRef.dispatchEvent(new windowRef.CustomEvent("fdtd:workflow-change", { detail: { layer } }));
    });
    windowRef.addEventListener("fdtd:workflow-change", (event) => {
      const layer = event?.detail?.layer;
      if (!layer) return;
      setControlDrawerOpen(true);
    });

    windowRef.addEventListener("fdtd:theme-change", (event) => {
      applyTheme(event?.detail?.theme);
    });

    const openHelpGuideFromHeader = () => {
      const activeElement = documentRef?.activeElement || null;
      helpGuideReturnFocus = visibleConnectedElement(activeElement) ? activeElement : stableHelpGuideTrigger();
      setHelpGuideOpen(true);
    };
    windowRef.FdtdOpenHelpGuide = openHelpGuideFromHeader;
    documentRef.addEventListener("input", (event) => {
      if (event.target?.id === "sceneSearchInput") refreshSceneSearch();
    });
    documentRef.addEventListener("click", (event) => {
      const target = isElement(event.target) ? event.target : null;
      const button = target?.closest?.("button");
      if (button?.id === "canvasOptionsToggle") {
        toggleCanvasOptionsMenu();
        return;
      }
      if (button?.dataset?.uiDepthChoice) {
        applyUiDepth(button.dataset.uiDepthChoice);
        return;
      }
      if (button?.id === "canvasContextCloseBtn") {
        closeCanvasContextMenuAndRender();
        return;
      }
      const contextAction = target?.closest?.("[data-canvas-add]");
      if (contextAction) {
        handleCanvasContextAdd(contextAction);
        return;
      }
      const helpTopic = button?.dataset?.helpGuideTopic;
      if (helpTopic) {
        lastHelpGuideTopicButton = button;
        setHelpGuideTopic(helpTopic);
      } else if (button?.id === "helpGuideBackBtn") {
        setHelpGuideTopic(null, { restoreFocus: true });
      } else if (button?.id === "helpGuideCloseBtn") {
        setHelpGuideOpen(false, { restoreFocus: true });
      }
    });
    walkthroughController?.bind?.();
    documentRef?.addEventListener?.("click", (event) => {
      if (!helpGuideOpen()) return;
      if (isElement(event.target) && event.target.closest("#helpGuidePanel")) return;
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
        const active = documentRef.activeElement;
        const activeIndex = focusable.indexOf(active);
        const nextIndex = activeIndex < 0
          ? event.shiftKey ? focusable.length - 1 : 0
          : (activeIndex + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
        event.preventDefault();
        focusable[nextIndex].focus?.({ preventScroll: true });
      }
    }, true);
  }

  global.FdtdShellControlBindings = Object.freeze({
    bindShellControls,
  });
})(window);
