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

  function nearestScrollableAncestor(element, stopAt) {
    let parent = element?.parentElement;
    while (parent && parent !== stopAt) {
      const style = global.getComputedStyle?.(parent);
      const overflowY = style?.overflowY || "";
      if ((overflowY === "auto" || overflowY === "scroll") && parent.scrollHeight > parent.clientHeight) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }

  function scrollChildIntoView(container, selector, scheduler = global.requestAnimationFrame) {
    if (!container || !selector) return;
    const schedule = scheduler || ((callback) => global.setTimeout(callback, 0));
    schedule(() => {
      const section = container.querySelector(selector);
      if (!section) return;
      container.scrollTop = 0;
      const scrollParent = nearestScrollableAncestor(section, container);
      if (!scrollParent) return;
      const sectionRect = section.getBoundingClientRect();
      const parentRect = scrollParent.getBoundingClientRect();
      scrollParent.scrollTop += sectionRect.top - parentRect.top;
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
