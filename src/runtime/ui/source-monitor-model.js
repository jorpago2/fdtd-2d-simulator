(function initFdtdSourceMonitorModel(global) {
  "use strict";

  const SOURCE_TYPES = Object.freeze(["sine", "gaussian", "ricker"]);
  const MONITOR_QUANTITIES = Object.freeze(["scalar", "magnitude", "normalFlux", "tangentFlux"]);
  const MAX_IMPORTED_ITEMS = 32;
  const MIN_SOURCE_FREQUENCY = 0.001;
  const MAX_SOURCE_FREQUENCY = 0.02;

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function finiteOrFallback(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number !== 0 ? number : fallback;
  }

  function clampFinite(value, fallback, min, max) {
    return clampNumber(finiteOrFallback(value, fallback), min, max);
  }

  function sourceReferenceFrequency(cellsPerWavelength) {
    const courant = typeof COURANT === "undefined" ? 0.1 : Number(COURANT);
    const cells = clampNumber(Number(cellsPerWavelength) || 20, 8, 80);
    return finiteOrFallback(courant, 0.1) / cells;
  }

  function sourceWavelengthRange(cellsPerWavelength) {
    const referenceFrequency = sourceReferenceFrequency(cellsPerWavelength);
    return {
      min: referenceFrequency / MAX_SOURCE_FREQUENCY,
      max: referenceFrequency / MIN_SOURCE_FREQUENCY,
    };
  }

  function frequencyToSourceWavelengthLambda(frequency, cellsPerWavelength) {
    const range = sourceWavelengthRange(cellsPerWavelength);
    const normalizedFrequency = clampFinite(
      frequency,
      sourceReferenceFrequency(cellsPerWavelength),
      MIN_SOURCE_FREQUENCY,
      MAX_SOURCE_FREQUENCY,
    );
    return clampNumber(sourceReferenceFrequency(cellsPerWavelength) / normalizedFrequency, range.min, range.max);
  }

  function sourceWavelengthLambdaToFrequency(wavelengthLambda, cellsPerWavelength) {
    const range = sourceWavelengthRange(cellsPerWavelength);
    const normalizedWavelength = clampFinite(wavelengthLambda, 1, range.min, range.max);
    return clampNumber(sourceReferenceFrequency(cellsPerWavelength) / normalizedWavelength, MIN_SOURCE_FREQUENCY, MAX_SOURCE_FREQUENCY);
  }

  function clampInt(value, min, max) {
    return Math.round(clampNumber(Number(value) || 0, min, max));
  }

  function boundsWithFallback(bounds, defaults) {
    const minX = Number(bounds?.minX);
    const maxX = Number(bounds?.maxX);
    const minY = Number(bounds?.minY);
    const maxY = Number(bounds?.maxY);
    return {
      minX: Number.isFinite(minX) ? minX : defaults.minX,
      maxX: Number.isFinite(maxX) ? maxX : defaults.maxX,
      minY: Number.isFinite(minY) ? minY : defaults.minY,
      maxY: Number.isFinite(maxY) ? maxY : defaults.maxY,
    };
  }

  function normalizeSource(source, context = {}) {
    const config = context.defaultSourceConfig || {};
    const bounds = boundsWithFallback(context.bounds, {
      minX: 0,
      maxX: Math.max(0.05, Number(config.xLambda) || 1),
      minY: 0,
      maxY: Math.max(0.05, Number(config.yLambda) || 1),
    });
    const shapeLabels = context.sourceShapeLabels || {};

    source.type = SOURCE_TYPES.includes(source.type) ? source.type : "sine";
    source.shape = Object.prototype.hasOwnProperty.call(shapeLabels, source.shape) ? source.shape : "point";
    source.frequency = clampFinite(source.frequency, config.frequency, MIN_SOURCE_FREQUENCY, MAX_SOURCE_FREQUENCY);
    source.amplitude = clampFinite(source.amplitude, config.amplitude, 0.05, 1.2);
    source.xLambda = clampFinite(source.xLambda, config.xLambda, bounds.minX, bounds.maxX);
    source.yLambda = clampFinite(source.yLambda, config.yLambda, bounds.minY, bounds.maxY);
    if (source.shape === "evanescentLine") {
      const kParallelRatio = clampFinite(
        source.evanescentKParallelRatio ?? source.kParallelRatio ?? source.widthLambda,
        config.evanescentKParallelRatio,
        1.01,
        2.5,
      );
      source.evanescentKParallelRatio = kParallelRatio;
      source.widthLambda = kParallelRatio;
    } else if (source.shape === "modeProfile") {
      source.widthLambda = clampFinite(source.widthLambda, config.widthLambda, 0.25, 3.0);
      source.modeOrder = clampInt(source.modeOrder, 0, 3);
      source.modeWindowLambda = clampFinite(source.modeWindowLambda ?? source.widthLambda, source.widthLambda, 0.25, 3.0);
    } else {
      source.widthLambda = clampFinite(source.widthLambda, config.widthLambda, 0.05, 1.5);
    }
    source.angleDeg = clampNumber(Number(source.angleDeg) || 0, 0, 360);
    source.phaseDeg = clampNumber(Number(source.phaseDeg) || 0, -180, 180);
    source.multipoleOrder = clampInt(source.multipoleOrder, 1, 8);
    source.multipolePhase = source.multipolePhase === "sin" ? "sin" : "cos";
    return source;
  }

  function normalizeMonitor(monitor, context = {}) {
    const config = context.defaultMonitorConfig || {};
    const bounds = boundsWithFallback(context.bounds, {
      minX: 0,
      maxX: Math.max(0.05, Number(config.xLambda) || 1),
      minY: 0,
      maxY: Math.max(0.05, Number(config.yLambda) || 1),
    });
    monitor.quantity = MONITOR_QUANTITIES.includes(monitor.quantity) ? monitor.quantity : "scalar";
    monitor.xLambda = clampFinite(monitor.xLambda, config.xLambda, bounds.minX, bounds.maxX);
    monitor.yLambda = clampFinite(monitor.yLambda, config.yLambda, bounds.minY, bounds.maxY);
    const maxLengthLambda = Math.max(0.1, Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY));
    monitor.lengthLambda = clampFinite(monitor.lengthLambda, config.lengthLambda, 0.05, maxLengthLambda);
    monitor.angleDeg = clampNumber(Number(monitor.angleDeg) || 0, 0, 180);
    return monitor;
  }

  function makeSource({ defaults, overrides, nextId, assignId = true, context = {} }) {
    const source = normalizeSource({
      ...(isPlainObject(defaults) ? defaults : {}),
      ...(isPlainObject(overrides) ? overrides : {}),
    }, context);
    if (!assignId) return { source, nextId };
    const id = Math.max(1, Math.round(Number(nextId) || 1));
    source.id = id;
    return { source, nextId: id + 1 };
  }

  function makeMonitor({ defaults, overrides, nextId, assignId = true, context = {} }) {
    const monitor = normalizeMonitor({
      ...(isPlainObject(defaults) ? defaults : {}),
      ...(isPlainObject(overrides) ? overrides : {}),
    }, context);
    if (!assignId) return { monitor, nextId };
    const id = Math.max(1, Math.round(Number(nextId) || 1));
    monitor.id = id;
    return { monitor, nextId: id + 1 };
  }

  function readSourceEditorValues(el, context = {}) {
    return {
      type: el.sourceTypeInput.value,
      shape: el.sourceShapeInput.value,
      frequency: sourceWavelengthLambdaToFrequency(Number(el.frequencyInput.value), context.cellsPerWavelength),
      amplitude: Number(el.amplitudeInput.value) / 100,
      xLambda: Number(el.sourceXInput.value),
      yLambda: Number(el.sourceYInput.value),
      widthLambda: Number(el.sourceWidthInput.value),
      angleDeg: Number(el.sourceAngleInput.value),
      phaseDeg: Number(el.sourceTimePhaseInput?.value ?? 0),
      multipoleOrder: Number(el.sourceOrderInput.value),
      multipolePhase: el.sourcePhaseInput.value === "sin" ? "sin" : "cos",
    };
  }

  function readMonitorEditorValues(el) {
    return {
      quantity: el.monitorQuantityInput?.value || "scalar",
      xLambda: Number(el.monitorXInput?.value),
      yLambda: Number(el.monitorYInput?.value),
      lengthLambda: Number(el.monitorLengthInput?.value),
      angleDeg: Number(el.monitorAngleInput?.value),
    };
  }

  function uniquePositiveId(rawId, fallbackId, usedIds) {
    const number = Number(rawId);
    let id = Number.isFinite(number) && number > 0 ? Math.round(number) : fallbackId;
    while (usedIds.has(id)) id += 1;
    usedIds.add(id);
    return id;
  }

  function nextIdForItems(importedNextId, items) {
    const imported = Number(importedNextId);
    return Math.max(
      Number.isFinite(imported) ? Math.round(imported) : 1,
      1,
      ...items.map((item) => item.id + 1),
    );
  }

  function sanitizeImportedSources(importedState = {}, context = {}) {
    const config = context.defaultSourceConfig || {};
    const rawSources = Array.isArray(importedState.sources) ? importedState.sources.slice(0, MAX_IMPORTED_ITEMS) : [];
    const usedIds = new Set();
    const sources = rawSources.map((rawSource, index) => {
      const source = normalizeSource({
        ...config,
        ...(isPlainObject(rawSource) ? rawSource : {}),
      }, context);
      source.id = uniquePositiveId(rawSource?.id, index + 1, usedIds);
      return source;
    });

    if (sources.length === 0) {
      sources.push(normalizeSource({ id: 1, ...config }, context));
    }

    const selectedId = Number(importedState.selectedSourceId);
    const selectedSourceId = sources.some((source) => source.id === selectedId) ? selectedId : sources[0].id;
    const defaultSource = normalizeSource({
      ...config,
      ...(isPlainObject(importedState.sourceDefaults) ? importedState.sourceDefaults : sources[0]),
    }, context);
    delete defaultSource.id;

    return {
      sources,
      selectedSourceId,
      sourceDefaults: defaultSource,
      nextSourceId: nextIdForItems(importedState.nextSourceId, sources),
    };
  }

  function sanitizeImportedMonitors(importedState = {}, context = {}) {
    const config = context.defaultMonitorConfig || {};
    const rawMonitors = Array.isArray(importedState.monitors) ? importedState.monitors.slice(0, MAX_IMPORTED_ITEMS) : [];
    const usedIds = new Set();
    const monitors = rawMonitors.map((rawMonitor, index) => {
      const monitor = normalizeMonitor({
        ...config,
        ...(isPlainObject(rawMonitor) ? rawMonitor : {}),
      }, context);
      monitor.id = uniquePositiveId(rawMonitor?.id, index + 1, usedIds);
      return monitor;
    });

    const selectedId = Number(importedState.selectedMonitorId);
    const selectedMonitorId = monitors.some((monitor) => monitor.id === selectedId) ? selectedId : null;
    const defaultMonitor = normalizeMonitor({
      ...config,
      ...(isPlainObject(importedState.monitorDefaults) ? importedState.monitorDefaults : monitors[0]),
    }, context);
    delete defaultMonitor.id;

    return {
      monitors,
      selectedMonitorId,
      monitorDefaults: defaultMonitor,
      nextMonitorId: nextIdForItems(importedState.nextMonitorId, monitors),
    };
  }

  global.FdtdSourceMonitorModel = Object.freeze({
    normalizeSource,
    normalizeMonitor,
    frequencyToSourceWavelengthLambda,
    sourceWavelengthRange,
    makeSource,
    makeMonitor,
    readSourceEditorValues,
    readMonitorEditorValues,
    sanitizeImportedSources,
    sanitizeImportedMonitors,
  });
})(window);
