(function initFdtdUiCore(global) {
  "use strict";

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
    if (element.getAttribute?.("role") === "radio") {
      element.setAttribute("aria-checked", String(active));
      element.removeAttribute("aria-pressed");
    } else {
      element.setAttribute("aria-pressed", String(active));
    }
  }

  function setClass(element, className, active) {
    element?.classList?.toggle(className, Boolean(active));
  }

  function setExclusiveButtonState(collection, datasetKey, selectedValue, options = {}) {
    const {
      selectedAttribute = "aria-selected",
      currentValue = null,
    } = options;

    toArray(collection).forEach((button) => {
      const active = button?.dataset?.[datasetKey] === selectedValue;
      button.classList.toggle("is-active", active);
      if (button.getAttribute?.("role") === "radio") {
        button.setAttribute("aria-checked", String(active));
        button.removeAttribute("aria-pressed");
      } else if (selectedAttribute) {
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

  function scrollChildIntoView(container, selector) {
    if (!container || !selector) return;
    const schedule = global.requestAnimationFrame || ((callback) => global.setTimeout(callback, 0));
    schedule(() => {
      const section = container.querySelector(selector);
      section?.scrollIntoView?.({ block: "start", inline: "nearest" });
    });
  }

  function radioButtonsInGroup(group) {
    return toArray(group?.querySelectorAll?.("[role='radio']")).filter((button) => !button.disabled && !button.hidden);
  }

  function bindRadioGroupKeyboardNavigation(root = global.document) {
    toArray(root?.querySelectorAll?.("[role='radiogroup']")).forEach((group) => {
      if (group.dataset.radioKeyboardBound === "true") return;
      group.dataset.radioKeyboardBound = "true";
      group.addEventListener("keydown", (event) => {
        const current = event.target?.closest?.("[role='radio']");
        if (!current || !group.contains(current)) return;
        const buttons = radioButtonsInGroup(group);
        if (buttons.length < 2) return;
        const currentIndex = buttons.indexOf(current);
        if (currentIndex < 0) return;
        let nextIndex = currentIndex;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % buttons.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = buttons.length - 1;
        else return;
        event.preventDefault();
        buttons[nextIndex]?.focus?.({ preventScroll: true });
        buttons[nextIndex]?.click?.();
      });
    });
  }

  global.FdtdUiCore = Object.freeze({
    activeDatasetValue,
    bindRadioGroupKeyboardNavigation,
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
