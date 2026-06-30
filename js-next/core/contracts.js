(function initFdtdNextContracts(global) {
  "use strict";

  const root = global.FdtdNext || (global.FdtdNext = {});
  const core = root.core || (root.core = {});

  function fail(message) {
    throw new Error(`FdtdNext contract error: ${message}`);
  }

  function requireObject(value, name) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail(`${name} must be an object.`);
    }
    return value;
  }

  function requireArray(value, name) {
    if (!Array.isArray(value)) {
      fail(`${name} must be an array.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      fail(`${name} must be a function.`);
    }
    return value;
  }

  function finiteNumber(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      fail(`${name} must be a finite number.`);
    }
    return number;
  }

  function positiveNumber(value, name) {
    const number = finiteNumber(value, name);
    if (number <= 0) {
      fail(`${name} must be positive.`);
    }
    return number;
  }

  function enumValue(value, allowedValues, fallback) {
    return allowedValues.includes(value) ? value : fallback;
  }

  function clonePlainData(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  core.contracts = Object.freeze({
    clonePlainData,
    enumValue,
    fail,
    finiteNumber,
    positiveNumber,
    requireArray,
    requireFunction,
    requireObject,
  });
})(window);
