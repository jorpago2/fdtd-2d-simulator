(function initFdtdHelpWalkthrough(global) {
  "use strict";

  const DEFAULT_STEPS = Object.freeze([
    Object.freeze({
      target: "#controlDrawerToggle",
      title: "Open the controls",
      text: "This button opens the main workflow menu. The simulator is organized around Scene, Simulate, Results, and Numerics.",
      closeDrawer: true,
    }),
    Object.freeze({
      target: "#sceneCurrentPanel",
      tab: "scenes",
      focusSelector: "#sceneCurrentPanel",
      title: "Start from a scene",
      text: "Use Current to understand the loaded example, or Browse to search the scene library by physical family.",
    }),
    Object.freeze({
      target: "#playPauseBtn",
      title: "Run the FDTD update",
      text: "Play advances the time-domain solver. Reset clears fields and monitor traces without changing the selected scene.",
      closeDrawer: true,
    }),
    Object.freeze({
      target: ".visual-field-section",
      tab: "simulation",
      focusSelector: ".visual-field-section",
      title: "Choose what is displayed",
      text: "The Field map controls change the rendered quantity: fields, Poynting flux, material maps, projection, and components.",
    }),
    Object.freeze({
      target: "#tab-results",
      tab: "results",
      focusSelector: "#tab-results",
      title: "Measure before interpreting",
      text: "Results contains monitor fluxes, custom probes, spectra, far-field estimates, and scene-specific checks.",
    }),
    Object.freeze({
      target: ".canvas-mode-toggle.interaction-toggle",
      title: "Edit the geometry",
      text: "Select moves existing sources, monitors, and objects. Draw adds material regions with brush or parametric geometry tools.",
      closeDrawer: true,
    }),
    Object.freeze({
      target: "#cellsPerWavelengthInput",
      tab: "config",
      focusSelector: "#cellsPerWavelengthInput",
      title: "Check numerical resolution",
      text: "Cells per wavelength, subpixel smoothing, CFL, and performance diagnostics decide whether a visual result is numerically trustworthy.",
    }),
  ]);

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Help walkthrough dependency must provide ${name}.`);
    }
    return value;
  }

  function noop() {}

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isElement(value) {
    return Boolean(global.Element && value instanceof global.Element);
  }

  function createHelpWalkthroughController(options) {
    const {
      activateControlTab = noop,
      closeCanvasActionsMenu = noop,
      closeCanvasContextMenuAndRender = noop,
      closeCanvasOptionsMenu = noop,
      closeControlDrawer = noop,
      documentRef = global.document,
      el,
      setControlDrawerOpen = noop,
      setHelpGuideOpen = noop,
      steps = DEFAULT_STEPS,
      windowRef = global,
    } = options || {};

    requireObject(el, "el");

    let activeIndex = -1;
    let lastFocus = null;

    function hasElements() {
      return Boolean(
        el.walkthroughStartBtn &&
          el.walkthroughOverlay &&
          el.walkthroughHighlight &&
          el.walkthroughPanel &&
          el.walkthroughProgress &&
          el.walkthroughTitle &&
          el.walkthroughText &&
          el.walkthroughPrevBtn &&
          el.walkthroughNextBtn &&
          el.walkthroughSkipBtn,
      );
    }

    function isOpen() {
      return hasElements() && !el.walkthroughPanel.hidden;
    }

    function resolveTarget(step) {
      const selectors = String(step?.target || "")
        .split(",")
        .map((selector) => selector.trim())
        .filter(Boolean);
      for (const selector of selectors) {
        const node = documentRef.querySelector(selector);
        if (!node) continue;
        const rect = node.getBoundingClientRect();
        const style = windowRef.getComputedStyle?.(node);
        if (rect.width > 0 && rect.height > 0 && style?.visibility !== "hidden") return node;
      }
      return el.canvasFrame || documentRef.body;
    }

    function applyStepContext(step) {
      closeCanvasActionsMenu();
      closeCanvasOptionsMenu();
      closeCanvasContextMenuAndRender();
      if (step?.tab) {
        setControlDrawerOpen(true);
        activateControlTab(step.tab, { focusSelector: step.focusSelector || step.target });
      } else if (step?.closeDrawer) {
        closeControlDrawer();
      }
    }

    function position() {
      if (!isOpen()) return;
      const step = steps[activeIndex];
      const target = resolveTarget(step);
      const rect = target.getBoundingClientRect();
      const viewportWidth = Math.max(1, windowRef.innerWidth || documentRef.documentElement?.clientWidth || 1);
      const viewportHeight = Math.max(1, windowRef.innerHeight || documentRef.documentElement?.clientHeight || 1);
      const margin = 12;
      const gap = 14;
      const pad = 7;
      const highlightLeft = clampNumber(rect.left - pad, margin, Math.max(margin, viewportWidth - margin));
      const highlightTop = clampNumber(rect.top - pad, margin, Math.max(margin, viewportHeight - margin));
      const highlightRight = clampNumber(rect.right + pad, margin, Math.max(margin, viewportWidth - margin));
      const highlightBottom = clampNumber(rect.bottom + pad, margin, Math.max(margin, viewportHeight - margin));

      el.walkthroughHighlight.style.left = `${highlightLeft}px`;
      el.walkthroughHighlight.style.top = `${highlightTop}px`;
      el.walkthroughHighlight.style.width = `${Math.max(0, highlightRight - highlightLeft)}px`;
      el.walkthroughHighlight.style.height = `${Math.max(0, highlightBottom - highlightTop)}px`;

      const panelRect = el.walkthroughPanel.getBoundingClientRect();
      const panelWidth = Math.min(panelRect.width || 340, viewportWidth - margin * 2);
      const panelHeight = Math.min(panelRect.height || 220, viewportHeight - margin * 2);
      let left = rect.right + gap;
      if (left + panelWidth > viewportWidth - margin) {
        left = rect.left - panelWidth - gap;
      }
      if (left < margin) {
        left = clampNumber((viewportWidth - panelWidth) / 2, margin, Math.max(margin, viewportWidth - panelWidth - margin));
      }

      let top = clampNumber(rect.top, margin, Math.max(margin, viewportHeight - panelHeight - margin));
      if (viewportWidth <= 760) {
        const lowerTop = rect.bottom + gap;
        const upperTop = rect.top - panelHeight - gap;
        top =
          lowerTop + panelHeight <= viewportHeight - margin
            ? lowerTop
            : clampNumber(upperTop, margin, Math.max(margin, viewportHeight - panelHeight - margin));
      }

      el.walkthroughPanel.style.left = `${left}px`;
      el.walkthroughPanel.style.top = `${top}px`;
    }

    function refreshStep() {
      if (!isOpen()) return;
      const step = steps[activeIndex];
      if (!step) return;
      applyStepContext(step);
      el.walkthroughProgress.textContent = `Step ${activeIndex + 1} of ${steps.length}`;
      el.walkthroughTitle.textContent = step.title;
      el.walkthroughText.textContent = step.text;
      el.walkthroughPrevBtn.disabled = activeIndex <= 0;
      el.walkthroughNextBtn.textContent = activeIndex >= steps.length - 1 ? "Finish" : "Next";
      windowRef.requestAnimationFrame?.(() => {
        position();
        el.walkthroughPanel?.focus?.({ preventScroll: true });
      });
    }

    function setOpen(open, { restoreFocus = false } = {}) {
      if (!hasElements()) return;
      const shouldOpen = Boolean(open);
      el.walkthroughOverlay.hidden = !shouldOpen;
      el.walkthroughHighlight.hidden = !shouldOpen;
      el.walkthroughPanel.hidden = !shouldOpen;
      documentRef.body?.classList?.toggle("walkthrough-active", shouldOpen);
      if (shouldOpen) {
        activeIndex = activeIndex < 0 ? 0 : activeIndex;
        refreshStep();
      } else {
        activeIndex = -1;
        el.walkthroughPanel.removeAttribute("style");
        el.walkthroughHighlight.removeAttribute("style");
        if (restoreFocus && lastFocus?.focus) {
          lastFocus.focus({ preventScroll: true });
        }
        lastFocus = null;
      }
    }

    function start() {
      if (!hasElements()) return;
      lastFocus = el.helpGuideToggle || (isElement(documentRef.activeElement) ? documentRef.activeElement : el.walkthroughStartBtn);
      setHelpGuideOpen(false);
      activeIndex = 0;
      setOpen(true);
    }

    function move(delta) {
      if (!isOpen()) return;
      const nextIndex = activeIndex + delta;
      if (nextIndex >= steps.length) {
        setOpen(false, { restoreFocus: true });
        return;
      }
      activeIndex = clampNumber(nextIndex, 0, steps.length - 1);
      refreshStep();
    }

    function handleKeydown(event) {
      if (!isOpen()) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false, { restoreFocus: true });
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      }
    }

    function bind() {
      el.walkthroughStartBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        start();
      });
      el.walkthroughPanel?.addEventListener("click", (event) => event.stopPropagation());
      el.walkthroughPrevBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        move(-1);
      });
      el.walkthroughNextBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        move(1);
      });
      el.walkthroughSkipBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        setOpen(false, { restoreFocus: true });
      });
      windowRef.addEventListener?.("resize", position, { passive: true });
      documentRef.addEventListener?.("scroll", position, { passive: true, capture: true });
      documentRef.addEventListener?.("keydown", handleKeydown);
    }

    return Object.freeze({
      bind,
      close: setOpen.bind(null, false),
      isOpen,
      start,
    });
  }

  global.FdtdHelpWalkthrough = Object.freeze({
    createHelpWalkthroughController,
  });
})(window);
