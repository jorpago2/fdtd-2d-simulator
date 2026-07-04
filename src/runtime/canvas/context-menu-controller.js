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

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function createContextMenuController(dependencies) {
    const el = requireObject(dependencies.el, "el");
    const beginEditSession = optionalFunction(dependencies.beginEditSession, () => {});
    const endEditSession = optionalFunction(dependencies.endEditSession, () => {});
    const validateEditScope = optionalFunction(dependencies.validateEditScope, () => true);
    const floatingMenuPad = 10;
    const minimumDragRoom = 12;
    let activeMenuDrag = null;
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

    function floatingMenuBounds(menu) {
      const frame = menu?.parentElement;
      if (!frame || !menu) return;
      const frameRect = frame.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const maxLeft = Math.max(
        floatingMenuPad,
        Math.min(
          frameRect.width - menuRect.width - floatingMenuPad,
          global.innerWidth - frameRect.left - menuRect.width - floatingMenuPad
        )
      );
      const maxTop = Math.max(
        floatingMenuPad,
        Math.min(
          frameRect.height - menuRect.height - floatingMenuPad,
          global.innerHeight - frameRect.top - menuRect.height - floatingMenuPad
        )
      );
      return {
        minLeft: floatingMenuPad,
        minTop: floatingMenuPad,
        maxLeft,
        maxTop,
        canDragX: maxLeft - floatingMenuPad > minimumDragRoom,
        canDragY: maxTop - floatingMenuPad > minimumDragRoom,
      };
    }

    function updateFloatingMenuDragAvailability(menu, bounds = floatingMenuBounds(menu)) {
      if (!menu || menu.hidden) return;
      menu.dataset.floatingMenuDraggable = String(Boolean(bounds?.canDragX || bounds?.canDragY));
    }

    function clampFloatingMenuPosition(menu, desiredLeft, desiredTop) {
      const bounds = floatingMenuBounds(menu);
      if (!bounds) return null;
      const left = clamp(desiredLeft, bounds.minLeft, bounds.maxLeft);
      const top = clamp(desiredTop, bounds.minTop, bounds.maxTop);
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      updateFloatingMenuDragAvailability(menu, bounds);
      return { left, top, bounds };
    }

    function refreshFloatingMenuPosition(menu) {
      if (!menu || menu.hidden) return;
      const left = Number.parseFloat(menu.style.left);
      const top = Number.parseFloat(menu.style.top);
      if (!Number.isFinite(left) || !Number.isFinite(top)) return;
      clampFloatingMenuPosition(menu, left, top);
    }

    function refreshOpenFloatingMenus() {
      contextMenuElements().forEach(refreshFloatingMenuPosition);
    }

    function positionFloatingMenu(menu, clientX, clientY) {
      const frame = menu?.parentElement;
      if (!frame || !menu) return;
      const frameRect = frame.getBoundingClientRect();
      menu.style.removeProperty("max-height");
      menu.style.removeProperty("overflow-y");
      const cssMaxHeight = Number.parseFloat(global.getComputedStyle(menu).maxHeight);
      const preferredMaxHeight = Number.isFinite(cssMaxHeight) && cssMaxHeight > 0 ? cssMaxHeight : Infinity;
      const availableHeight = Math.max(
        220,
        Math.min(preferredMaxHeight, frameRect.height - floatingMenuPad * 2, global.innerHeight - frameRect.top - floatingMenuPad)
      );
      menu.style.setProperty("max-height", `${availableHeight}px`, "important");
      menu.style.setProperty("overflow-y", "auto", "important");
      clampFloatingMenuPosition(menu, clientX - frameRect.left + floatingMenuPad, clientY - frameRect.top + floatingMenuPad);
    }

    function isInteractiveDragTarget(target) {
      return Boolean(target?.closest?.("button, input, select, textarea, a, label, summary, [role='button']"));
    }

    function endFloatingMenuDrag(event) {
      if (!activeMenuDrag || (event?.pointerId != null && event.pointerId !== activeMenuDrag.pointerId)) return;
      activeMenuDrag.menu.classList.remove("is-dragging");
      try {
        activeMenuDrag.header.releasePointerCapture?.(activeMenuDrag.pointerId);
      } catch {
        // Pointer capture may already be gone if the browser cancelled the gesture.
      }
      activeMenuDrag = null;
      global.document.removeEventListener("pointermove", handleFloatingMenuDragMove, true);
      global.document.removeEventListener("pointerup", endFloatingMenuDrag, true);
      global.document.removeEventListener("pointercancel", endFloatingMenuDrag, true);
    }

    function handleFloatingMenuDragMove(event) {
      if (!activeMenuDrag || event.pointerId !== activeMenuDrag.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const dx = activeMenuDrag.bounds.canDragX ? event.clientX - activeMenuDrag.startClientX : 0;
      const dy = activeMenuDrag.bounds.canDragY ? event.clientY - activeMenuDrag.startClientY : 0;
      const result = clampFloatingMenuPosition(
        activeMenuDrag.menu,
        activeMenuDrag.startLeft + dx,
        activeMenuDrag.startTop + dy
      );
      if (result?.bounds) {
        activeMenuDrag.bounds = result.bounds;
      }
    }

    function beginFloatingMenuDrag(event) {
      if (event.button != null && event.button !== 0) return;
      if (isInteractiveDragTarget(event.target)) return;
      const header = event.currentTarget;
      const menu = header.closest?.(".source-menu");
      if (!menu || menu.hidden) return;
      const currentLeft = Number.parseFloat(menu.style.left);
      const currentTop = Number.parseFloat(menu.style.top);
      const bounds = floatingMenuBounds(menu);
      if (!bounds || (!bounds.canDragX && !bounds.canDragY) || !Number.isFinite(currentLeft) || !Number.isFinite(currentTop)) {
        updateFloatingMenuDragAvailability(menu, bounds);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      activeMenuDrag = {
        menu,
        header,
        bounds,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startLeft: currentLeft,
        startTop: currentTop,
      };
      menu.classList.add("is-dragging");
      try {
        header.setPointerCapture?.(event.pointerId);
      } catch {
        // Continue with document-level listeners if pointer capture is unavailable.
      }
      global.document.addEventListener("pointermove", handleFloatingMenuDragMove, true);
      global.document.addEventListener("pointerup", endFloatingMenuDrag, true);
      global.document.addEventListener("pointercancel", endFloatingMenuDrag, true);
    }

    function bindFloatingMenuDrag() {
      contextMenuElements().forEach((menu) => {
        const header = menu.querySelector(".source-menu-header");
        if (!header || header.dataset.dragBound === "true") return;
        header.dataset.dragBound = "true";
        header.addEventListener("pointerdown", beginFloatingMenuDrag);
      });
      if (typeof global.ResizeObserver === "function") {
        const observer = new global.ResizeObserver((entries) => {
          entries.forEach((entry) => refreshFloatingMenuPosition(entry.target));
        });
        contextMenuElements().forEach((menu) => observer.observe(menu));
      }
      global.addEventListener("resize", refreshOpenFloatingMenus);
    }

    function closeMenu(menu, cleanup) {
      if (!menu || menu.hidden) return true;
      if (!validateEditScope(menu)) return false;
      menu.hidden = true;
      cleanup?.();
      state.canvasContextPoint = null;
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

    function openCanvasContextMenuAt(clientX, clientY, point) {
      if (!el.canvasContextMenu) return;
      if (!closeSourceMenu() || !closeMonitorMenu() || !closeBrushMenu() || !closeBoundaryMenu()) return;
      rememberFocusTarget();
      state.canvasContextPoint = point || null;
      beginEditSession(el.canvasContextMenu);
      el.canvasContextMenu.hidden = false;
      positionFloatingMenu(el.canvasContextMenu, clientX, clientY);
      focusFirstMenuControl(el.canvasContextMenu);
    }

    function openSourceMenuAt(clientX, clientY, options = {}) {
      if (!el.sourceMenu) return;
      if (!closeCanvasContextMenu() || !closeMonitorMenu() || !closeBrushMenu() || !closeBoundaryMenu()) return;
      rememberFocusTarget();
      state.sourceMenuMode = options.mode === "edit" ? "edit" : "add";
      state.sourceMenuDraft = options.draft || null;
      beginEditSession(el.sourceMenu);
      el.sourceMenu.hidden = false;
      positionFloatingMenu(el.sourceMenu, clientX, clientY);
      focusFirstMenuControl(el.sourceMenu);
    }

    function openMonitorMenuAt(clientX, clientY, options = {}) {
      if (!el.monitorMenu) return;
      if (!closeCanvasContextMenu() || !closeSourceMenu() || !closeBrushMenu() || !closeBoundaryMenu()) return;
      rememberFocusTarget();
      state.monitorMenuMode = options.mode === "edit" ? "edit" : "add";
      state.monitorMenuDraft = options.draft || null;
      beginEditSession(el.monitorMenu);
      el.monitorMenu.hidden = false;
      positionFloatingMenu(el.monitorMenu, clientX, clientY);
      focusFirstMenuControl(el.monitorMenu);
    }

    function openBrushMenuAt(clientX, clientY, options = {}) {
      if (!el.brushMenu) return;
      if (!closeCanvasContextMenu() || !closeSourceMenu() || !closeMonitorMenu() || !closeBoundaryMenu()) return;
      rememberFocusTarget();
      state.brushMenuMode = options.mode === "region" ? "region" : "brush";
      beginEditSession(el.brushMenu);
      el.brushMenu.hidden = false;
      positionFloatingMenu(el.brushMenu, clientX, clientY);
      focusFirstMenuControl(el.brushMenu);
    }

    function openBoundaryMenuAt(clientX, clientY, side = state.boundaryMenuSide) {
      if (!el.boundaryMenu) return;
      if (!closeCanvasContextMenu() || !closeSourceMenu() || !closeMonitorMenu() || !closeBrushMenu()) return;
      rememberFocusTarget();
      state.boundaryMenuSide = side || state.boundaryMenuSide || "top";
      beginEditSession(el.boundaryMenu);
      el.boundaryMenu.hidden = false;
      positionFloatingMenu(el.boundaryMenu, clientX, clientY);
      focusFirstMenuControl(el.boundaryMenu);
    }

    bindFloatingMenuDrag();

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
