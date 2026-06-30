(function initFdtdNextUiCore(global) {
  "use strict";

  const root = global.FdtdNext || (global.FdtdNext = {});
  const ui = root.ui || (root.ui = {});

  function toArray(collection) {
    return Array.from(collection || []);
  }

  function activeDatasetValue(collection, datasetKey, fallback) {
    const activeElement = toArray(collection).find((element) => element?.classList?.contains("is-active"));
    return activeElement?.dataset?.[datasetKey] ?? fallback;
  }

  function setExpanded(element, expanded) {
    if (!element) return;
    element.setAttribute("aria-expanded", String(Boolean(expanded)));
  }

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = Boolean(hidden);
  }

  function setPressed(element, pressed) {
    if (!element) return;
    const active = Boolean(pressed);
    element.classList.toggle("is-active", active);
    element.setAttribute("aria-pressed", String(active));
  }

  function setClass(element, className, active) {
    element?.classList?.toggle(className, Boolean(active));
  }

  function setExclusiveButtonState(collection, datasetKey, selectedValue, options = {}) {
    const { selectedAttribute = "aria-selected", currentValue = null } = options;
    toArray(collection).forEach((button) => {
      const active = button?.dataset?.[datasetKey] === selectedValue;
      button.classList.toggle("is-active", active);
      if (selectedAttribute) {
        button.setAttribute(selectedAttribute, String(active));
      }
      if (currentValue) {
        if (active) button.setAttribute("aria-current", currentValue);
        else button.removeAttribute("aria-current");
      }
    });
  }

  function setExclusivePanels(collection, datasetKey, selectedValue, activeClass = "is-active") {
    toArray(collection).forEach((panel) => {
      const active = panel?.dataset?.[datasetKey] === selectedValue;
      panel.classList.toggle(activeClass, active);
      panel.hidden = !active;
    });
  }

  function scrollChildIntoView(container, selector, scheduler = global.requestAnimationFrame) {
    if (!container || !selector) return;
    const schedule = scheduler || ((callback) => global.setTimeout(callback, 0));
    schedule(() => {
      const section = container.querySelector(selector);
      section?.scrollIntoView?.({ block: "start", inline: "nearest" });
    });
  }

  ui.core = Object.freeze({
    activeDatasetValue,
    scrollChildIntoView,
    setClass,
    setExclusiveButtonState,
    setExclusivePanels,
    setExpanded,
    setHidden,
    setPressed,
    toArray,
  });
})(window);
