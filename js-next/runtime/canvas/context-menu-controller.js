(function initFdtdContextMenuController(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Context menu controller dependency must provide ${name}.`);
    }
    return value;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function createContextMenuController(dependencies) {
    const el = requireObject(dependencies.el, "el");
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
        const target = menu.querySelector(selector);
        target?.focus?.({ preventScroll: true });
      });
    }

    function positionFloatingMenu(menu, clientX, clientY) {
      const frame = menu?.parentElement;
      if (!frame || !menu) return;
      const frameRect = frame.getBoundingClientRect();
      const pad = 10;
      menu.style.removeProperty("max-height");
      menu.style.removeProperty("overflow-y");
      const cssMaxHeight = Number.parseFloat(global.getComputedStyle(menu).maxHeight);
      const preferredMaxHeight = Number.isFinite(cssMaxHeight) && cssMaxHeight > 0 ? cssMaxHeight : Infinity;
      const availableHeight = Math.max(
        220,
        Math.min(preferredMaxHeight, frameRect.height - pad * 2, global.innerHeight - frameRect.top - pad)
      );
      menu.style.setProperty("max-height", `${availableHeight}px`, "important");
      menu.style.setProperty("overflow-y", "auto", "important");
      const menuRect = menu.getBoundingClientRect();
      const left = clamp(clientX - frameRect.left + pad, pad, Math.max(pad, frameRect.width - menuRect.width - pad));
      const maxTop = Math.max(
        pad,
        Math.min(frameRect.height - menuRect.height - pad, global.innerHeight - frameRect.top - menuRect.height - pad)
      );
      const top = clamp(clientY - frameRect.top + pad, pad, maxTop);
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    }

    function closeCanvasContextMenu() {
      if (!el.canvasContextMenu) return;
      el.canvasContextMenu.hidden = true;
      state.canvasContextPoint = null;
      restoreFocusIfClosed();
    }

    function closeSourceMenu() {
      if (!el.sourceMenu) return;
      el.sourceMenu.hidden = true;
      state.sourceMenuDraft = null;
      restoreFocusIfClosed();
    }

    function closeMonitorMenu() {
      if (!el.monitorMenu) return;
      el.monitorMenu.hidden = true;
      state.monitorMenuDraft = null;
      restoreFocusIfClosed();
    }

    function closeBrushMenu() {
      if (!el.brushMenu) return;
      el.brushMenu.hidden = true;
      state.brushMenuMode = "brush";
      restoreFocusIfClosed();
    }

    function closeBoundaryMenu() {
      if (!el.boundaryMenu) return;
      el.boundaryMenu.hidden = true;
      restoreFocusIfClosed();
    }

    function closeContextMenus() {
      closeCanvasContextMenu();
      closeSourceMenu();
      closeMonitorMenu();
      closeBrushMenu();
      closeBoundaryMenu();
    }

    function openCanvasContextMenuAt(clientX, clientY, point) {
      if (!el.canvasContextMenu) return;
      closeSourceMenu();
      closeMonitorMenu();
      closeBrushMenu();
      closeBoundaryMenu();
      rememberFocusTarget();
      state.canvasContextPoint = point || null;
      el.canvasContextMenu.hidden = false;
      positionFloatingMenu(el.canvasContextMenu, clientX, clientY);
      focusFirstMenuControl(el.canvasContextMenu);
    }

    function openSourceMenuAt(clientX, clientY, options = {}) {
      if (!el.sourceMenu) return;
      closeCanvasContextMenu();
      closeMonitorMenu();
      closeBrushMenu();
      closeBoundaryMenu();
      rememberFocusTarget();
      state.sourceMenuMode = options.mode === "edit" ? "edit" : "add";
      state.sourceMenuDraft = options.draft || null;
      el.sourceMenu.hidden = false;
      positionFloatingMenu(el.sourceMenu, clientX, clientY);
      focusFirstMenuControl(el.sourceMenu);
    }

    function openMonitorMenuAt(clientX, clientY, options = {}) {
      if (!el.monitorMenu) return;
      closeCanvasContextMenu();
      closeSourceMenu();
      closeBrushMenu();
      closeBoundaryMenu();
      rememberFocusTarget();
      state.monitorMenuMode = options.mode === "edit" ? "edit" : "add";
      state.monitorMenuDraft = options.draft || null;
      el.monitorMenu.hidden = false;
      positionFloatingMenu(el.monitorMenu, clientX, clientY);
      focusFirstMenuControl(el.monitorMenu);
    }

    function openBrushMenuAt(clientX, clientY, options = {}) {
      if (!el.brushMenu) return;
      closeCanvasContextMenu();
      closeSourceMenu();
      closeMonitorMenu();
      closeBoundaryMenu();
      rememberFocusTarget();
      state.brushMenuMode = options.mode === "region" ? "region" : "brush";
      el.brushMenu.hidden = false;
      positionFloatingMenu(el.brushMenu, clientX, clientY);
      focusFirstMenuControl(el.brushMenu);
    }

    function openBoundaryMenuAt(clientX, clientY, side = state.boundaryMenuSide) {
      if (!el.boundaryMenu) return;
      closeCanvasContextMenu();
      closeSourceMenu();
      closeMonitorMenu();
      closeBrushMenu();
      rememberFocusTarget();
      state.boundaryMenuSide = side || state.boundaryMenuSide || "top";
      el.boundaryMenu.hidden = false;
      positionFloatingMenu(el.boundaryMenu, clientX, clientY);
      focusFirstMenuControl(el.boundaryMenu);
    }

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
