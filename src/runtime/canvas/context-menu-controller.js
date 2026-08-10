(function initFdtdContextMenuController(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Context menu controller dependency must provide ${name}.`);
    }
    return value;
  }

  function optionalFunction(value, fallback) {
    return typeof value === "function" ? value : fallback;
  }

  function createContextMenuController(dependencies) {
    const el = requireObject(dependencies.el, "el");
    const beginEditSession = optionalFunction(dependencies.beginEditSession, () => {});
    const endEditSession = optionalFunction(dependencies.endEditSession, () => {});
    const onInspectorOpen = optionalFunction(dependencies.onInspectorOpen, () => {});
    const validateEditScope = optionalFunction(dependencies.validateEditScope, () => true);
    const state = {
      sourceMenuMode: "add",
      sourceMenuDraft: null,
      canvasContextPoint: null,
      monitorMenuMode: "add",
      monitorMenuDraft: null,
      brushMenuMode: "brush",
      boundaryMenuSide: "top",
      restoreFocusTarget: null,
    };

    function contextMenuElements() {
      return [el.canvasContextMenu, el.sourceMenu, el.monitorMenu, el.brushMenu, el.boundaryMenu].filter(Boolean);
    }

    function anyContextMenuOpen() {
      return contextMenuElements().some((menu) => !menu.hidden);
    }

    function mountContextMenus() {
      const host = el.contextInspectorHost;
      if (!host) return;
      contextMenuElements().forEach((menu) => {
        menu.dataset.contextualInspector = "true";
        menu.style.removeProperty("left");
        menu.style.removeProperty("top");
        menu.style.removeProperty("max-height");
        menu.style.removeProperty("overflow-y");
        host.appendChild(menu);
      });
    }

    function syncContextualInspectorState() {
      const open = anyContextMenuOpen();
      const host = el.contextInspectorHost;
      if (host) {
        host.hidden = !open;
        host.inert = !open;
        host.setAttribute("aria-hidden", String(!open));
      }
      el.appShell?.classList.toggle("contextual-inspector-open", open);
    }

    function activeElementInsideContextMenu() {
      const activeElement = global.document?.activeElement;
      return Boolean(activeElement && contextMenuElements().some((menu) => menu.contains(activeElement)));
    }

    function rememberFocusTarget() {
      const activeElement = global.document?.activeElement;
      if (!activeElement || activeElementInsideContextMenu()) return;
      state.restoreFocusTarget = activeElement;
    }

    function restoreFocusIfClosed() {
      if (anyContextMenuOpen()) return;
      const target = state.restoreFocusTarget;
      state.restoreFocusTarget = null;
      if (target?.isConnected && typeof target.focus === "function") {
        target.focus({ preventScroll: true });
      }
    }

    function focusFirstMenuControl(menu) {
      const selector = [
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(",");
      const schedule = global.requestAnimationFrame || ((callback) => global.setTimeout(callback, 0));
      schedule(() => {
        const content = menu.querySelector(".source-menu-body, .context-choice-grid");
        const target = content?.querySelector(selector) || menu.querySelector(selector);
        target?.focus?.({ preventScroll: true });
      });
    }

    function resetMenuScroll(menu) {
      if (!menu) return;
      menu.scrollTop = 0;
      const body = menu.querySelector(".source-menu-body");
      if (body) {
        body.scrollTop = 0;
        body.scrollLeft = 0;
      }
    }

    function showMenu(menu) {
      onInspectorOpen();
      menu.hidden = false;
      resetMenuScroll(menu);
      syncContextualInspectorState();
      focusFirstMenuControl(menu);
    }

    function closeMenu(menu, cleanup) {
      if (!menu || menu.hidden) return true;
      if (!validateEditScope(menu)) return false;
      menu.hidden = true;
      cleanup?.();
      state.canvasContextPoint = null;
      syncContextualInspectorState();
      restoreFocusIfClosed();
      endEditSession(menu);
      return true;
    }

    function closeCanvasContextMenu() {
      return closeMenu(el.canvasContextMenu, () => {
        state.canvasContextPoint = null;
      });
    }

    function closeSourceMenu() {
      return closeMenu(el.sourceMenu, () => {
        state.sourceMenuDraft = null;
      });
    }

    function closeMonitorMenu() {
      return closeMenu(el.monitorMenu, () => {
        state.monitorMenuDraft = null;
      });
    }

    function closeBrushMenu() {
      return closeMenu(el.brushMenu, () => {
        state.brushMenuMode = "brush";
      });
    }

    function closeBoundaryMenu() {
      return closeMenu(el.boundaryMenu);
    }

    function closeContextMenus() {
      const closed = [
        closeCanvasContextMenu(),
        closeSourceMenu(),
        closeMonitorMenu(),
        closeBrushMenu(),
        closeBoundaryMenu(),
      ];
      return closed.every(Boolean);
    }

    function openCanvasContextMenuAt(_clientX, _clientY, point) {
      if (!el.canvasContextMenu) return;
      if (!closeSourceMenu() || !closeMonitorMenu() || !closeBrushMenu() || !closeBoundaryMenu()) return;
      rememberFocusTarget();
      state.canvasContextPoint = point || null;
      beginEditSession(el.canvasContextMenu);
      showMenu(el.canvasContextMenu);
    }

    function openSourceMenuAt(_clientX, _clientY, options = {}) {
      if (!el.sourceMenu) return;
      if (!closeCanvasContextMenu() || !closeMonitorMenu() || !closeBrushMenu() || !closeBoundaryMenu()) return;
      rememberFocusTarget();
      state.sourceMenuMode = options.mode === "edit" ? "edit" : "add";
      state.sourceMenuDraft = options.draft || null;
      beginEditSession(el.sourceMenu);
      showMenu(el.sourceMenu);
    }

    function openMonitorMenuAt(_clientX, _clientY, options = {}) {
      if (!el.monitorMenu) return;
      if (!closeCanvasContextMenu() || !closeSourceMenu() || !closeBrushMenu() || !closeBoundaryMenu()) return;
      rememberFocusTarget();
      state.monitorMenuMode = options.mode === "edit" ? "edit" : "add";
      state.monitorMenuDraft = options.draft || null;
      beginEditSession(el.monitorMenu);
      showMenu(el.monitorMenu);
    }

    function openBrushMenuAt(_clientX, _clientY, options = {}) {
      if (!el.brushMenu) return;
      if (!closeCanvasContextMenu() || !closeSourceMenu() || !closeMonitorMenu() || !closeBoundaryMenu()) return;
      rememberFocusTarget();
      state.brushMenuMode = options.mode === "region" ? "region" : "brush";
      beginEditSession(el.brushMenu);
      showMenu(el.brushMenu);
    }

    function openBoundaryMenuAt(_clientX, _clientY, side = state.boundaryMenuSide) {
      if (!el.boundaryMenu) return;
      if (!closeCanvasContextMenu() || !closeSourceMenu() || !closeMonitorMenu() || !closeBrushMenu()) return;
      rememberFocusTarget();
      state.boundaryMenuSide = side || state.boundaryMenuSide || "top";
      beginEditSession(el.boundaryMenu);
      showMenu(el.boundaryMenu);
    }

    mountContextMenus();
    syncContextualInspectorState();

    return {
      state,
      openCanvasContextMenuAt,
      openSourceMenuAt,
      openMonitorMenuAt,
      openBrushMenuAt,
      openBoundaryMenuAt,
      closeCanvasContextMenu,
      closeSourceMenu,
      closeMonitorMenu,
      closeBrushMenu,
      closeBoundaryMenu,
      closeContextMenus,
    };
  }

  global.FdtdContextMenuController = Object.freeze({
    createContextMenuController,
  });
})(window);
