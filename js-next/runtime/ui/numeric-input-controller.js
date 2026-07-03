(function initFdtdNumericInputController(global) {
  "use strict";

  const NUMERIC_INPUT_SELECTOR = "input[data-numeric-input='true']";
  const SETUP_INPUT_SELECTOR = "input[type='number'], " + NUMERIC_INPUT_SELECTOR;

  function isElement(value) {
    return Boolean(global.Element && value instanceof global.Element);
  }

  function isHiddenOrDisabled(input) {
    return Boolean(input?.disabled || input?.closest?.("[hidden]"));
  }

  function finiteAttribute(input, name) {
    const raw = input?.getAttribute?.(name);
    if (raw == null || raw === "") return null;
    const value = Number(String(raw).replace(",", "."));
    return Number.isFinite(value) ? value : null;
  }

  function normalizedNumericText(rawValue) {
    return String(rawValue ?? "").trim().replace(/\s+/g, "").replace(",", ".");
  }

  function parseNumericInput(input) {
    const text = String(input?.value ?? "").trim();
    if (text === "") {
      return { valid: false, message: "Enter a number." };
    }
    const normalized = normalizedNumericText(text);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) {
      return { valid: false, message: "Use a valid number." };
    }
    const value = Number(normalized);
    if (!Number.isFinite(value)) {
      return { valid: false, message: "Use a finite number." };
    }
    const min = finiteAttribute(input, "min");
    const max = finiteAttribute(input, "max");
    if (min != null && value < min) {
      return { valid: false, message: `Minimum value: ${min}.`, value };
    }
    if (max != null && value > max) {
      return { valid: false, message: `Maximum value: ${max}.`, value };
    }
    return { valid: true, value, normalized };
  }

  function formatCommittedValue(value) {
    if (!Number.isFinite(value)) return "";
    return String(value);
  }

  function createNumericInputController({ documentRef = global.document } = {}) {
    let bound = false;

    function numericInputs(scope = documentRef) {
      return Array.from(scope?.querySelectorAll?.(NUMERIC_INPUT_SELECTOR) || []);
    }

    function setupInput(input) {
      if (!input) return;
      input.dataset.numericInput = "true";
      if (!input.dataset.numericOriginalType) {
        input.dataset.numericOriginalType = input.type || "text";
      }
      if (!input.dataset.numericOriginalTitle) {
        input.dataset.numericOriginalTitle = input.getAttribute("title") || "";
      }
      if (input.type === "number") {
        input.type = "text";
      }
      if (!input.inputMode) {
        input.inputMode = "decimal";
      }
      if (!input.autocomplete) {
        input.autocomplete = "off";
      }
      validateInput(input, { focus: false });
    }

    function setup(root = documentRef) {
      Array.from(root?.querySelectorAll?.(SETUP_INPUT_SELECTOR) || []).forEach(setupInput);
    }

    function clearInvalid(input) {
      input.classList.remove("is-invalid");
      input.removeAttribute("aria-invalid");
      delete input.dataset.numericError;
      input.setCustomValidity?.("");
      const originalTitle = input.dataset.numericOriginalTitle || "";
      if (originalTitle) {
        input.setAttribute("title", originalTitle);
      } else {
        input.removeAttribute("title");
      }
    }

    function markInvalid(input, message, { focus = false } = {}) {
      input.classList.add("is-invalid");
      input.setAttribute("aria-invalid", "true");
      input.dataset.numericError = message;
      input.setAttribute("title", message);
      input.setCustomValidity?.(message);
      if (focus) {
        input.focus?.({ preventScroll: true });
        input.select?.();
        input.reportValidity?.();
      }
    }

    function validateInput(input, options = {}) {
      if (!input?.matches?.(NUMERIC_INPUT_SELECTOR)) return true;
      if (isHiddenOrDisabled(input)) {
        clearInvalid(input);
        return true;
      }
      const result = parseNumericInput(input);
      if (result.valid) {
        clearInvalid(input);
        return true;
      }
      markInvalid(input, result.message, options);
      return false;
    }

    function commitInput(input, options = {}) {
      if (!input?.matches?.(NUMERIC_INPUT_SELECTOR)) return true;
      if (isHiddenOrDisabled(input)) {
        clearInvalid(input);
        return true;
      }
      const result = parseNumericInput(input);
      if (!result.valid) {
        markInvalid(input, result.message, options);
        return false;
      }
      input.value = formatCommittedValue(result.value);
      clearInvalid(input);
      return true;
    }

    function activeNumericInput(scope = documentRef) {
      const activeElement = documentRef.activeElement;
      return activeElement?.matches?.(NUMERIC_INPUT_SELECTOR) && scope?.contains?.(activeElement) ? activeElement : null;
    }

    function commitActiveInput(scope = documentRef) {
      const input = activeNumericInput(scope);
      if (!input) return true;
      if (!commitInput(input, { focus: true })) return false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    function validateScope(scope = documentRef, options = {}) {
      setup(scope);
      if (options.commitActive !== false && !commitActiveInput(scope)) return false;
      const invalidInput = numericInputs(scope).find((input) => !validateInput(input));
      if (invalidInput) {
        validateInput(invalidInput, { focus: true });
        return false;
      }
      return true;
    }

    function hasInvalidInputs(scope = documentRef) {
      setup(scope);
      return numericInputs(scope).some((input) => !validateInput(input));
    }

    function handleInputCapture(event) {
      const input = isElement(event.target) ? event.target.closest(NUMERIC_INPUT_SELECTOR) : null;
      if (!input) return;
      validateInput(input);
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    function handleChangeCapture(event) {
      const input = isElement(event.target) ? event.target.closest(NUMERIC_INPUT_SELECTOR) : null;
      if (!input) return;
      if (!commitInput(input, { focus: true })) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    }

    function handleKeydownCapture(event) {
      if (event.key !== "Enter") return;
      const input = isElement(event.target) ? event.target.closest(NUMERIC_INPUT_SELECTOR) : null;
      if (!input) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (!commitInput(input, { focus: true })) return;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function bind() {
      setup();
      if (bound) return;
      bound = true;
      documentRef.addEventListener("input", handleInputCapture, true);
      documentRef.addEventListener("change", handleChangeCapture, true);
      documentRef.addEventListener("keydown", handleKeydownCapture, true);
    }

    return Object.freeze({
      bind,
      commitActiveInput,
      commitInput,
      hasInvalidInputs,
      parseNumericInput,
      setup,
      setupInput,
      validateInput,
      validateScope,
    });
  }

  global.FdtdNumericInputController = Object.freeze({
    createNumericInputController,
    normalizedNumericText,
  });
})(window);
