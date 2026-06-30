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
    };

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
    }

    function closeSourceMenu() {
      if (!el.sourceMenu) return;
      el.sourceMenu.hidden = true;
      state.sourceMenuDraft = null;
    }

    function closeMonitorMenu() {
      if (!el.monitorMenu) return;
      el.monitorMenu.hidden = true;
      state.monitorMenuDraft = null;
    }

    function closeBrushMenu() {
      if (!el.brushMenu) return;
      el.brushMenu.hidden = true;
      state.brushMenuMode = "brush";
    }

    function closeBoundaryMenu() {
      if (!el.boundaryMenu) return;
      el.boundaryMenu.hidden = true;
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
      state.canvasContextPoint = point || null;
      el.canvasContextMenu.hidden = false;
      positionFloatingMenu(el.canvasContextMenu, clientX, clientY);
    }

    function openSourceMenuAt(clientX, clientY, options = {}) {
      if (!el.sourceMenu) return;
      closeCanvasContextMenu();
      closeMonitorMenu();
      closeBrushMenu();
      closeBoundaryMenu();
      state.sourceMenuMode = options.mode === "edit" ? "edit" : "add";
      state.sourceMenuDraft = options.draft || null;
      el.sourceMenu.hidden = false;
      positionFloatingMenu(el.sourceMenu, clientX, clientY);
    }

    function openMonitorMenuAt(clientX, clientY, options = {}) {
      if (!el.monitorMenu) return;
      closeCanvasContextMenu();
      closeSourceMenu();
      closeBrushMenu();
      closeBoundaryMenu();
      state.monitorMenuMode = options.mode === "edit" ? "edit" : "add";
      state.monitorMenuDraft = options.draft || null;
      el.monitorMenu.hidden = false;
      positionFloatingMenu(el.monitorMenu, clientX, clientY);
    }

    function openBrushMenuAt(clientX, clientY, options = {}) {
      if (!el.brushMenu) return;
      closeCanvasContextMenu();
      closeSourceMenu();
      closeMonitorMenu();
      closeBoundaryMenu();
      state.brushMenuMode = options.mode === "region" ? "region" : "brush";
      el.brushMenu.hidden = false;
      positionFloatingMenu(el.brushMenu, clientX, clientY);
    }

    function openBoundaryMenuAt(clientX, clientY, side = state.boundaryMenuSide) {
      if (!el.boundaryMenu) return;
      closeCanvasContextMenu();
      closeSourceMenu();
      closeMonitorMenu();
      closeBrushMenu();
      state.boundaryMenuSide = side || state.boundaryMenuSide || "top";
      el.boundaryMenu.hidden = false;
      positionFloatingMenu(el.boundaryMenu, clientX, clientY);
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
