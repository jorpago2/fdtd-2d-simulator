(function initFdtdSourceMonitorOperations(global) {
  "use strict";

  function createSourceMonitorOperations({
    state,
    sourceMonitorModel,
    defaultSourceConfig,
    defaultMonitorConfig,
    sourceShapeLabels,
    getSourceBounds,
    getMonitorBounds,
    getEntitySelection,
    getSim = () => null,
  }) {
    const sourceRetireCycles = 2.5;
    const minRetireSteps = 24;

    function sourceModelContext() {
      return {
        defaultSourceConfig,
        sourceShapeLabels,
        bounds: getSourceBounds(),
      };
    }

    function monitorModelContext() {
      return {
        defaultMonitorConfig,
        bounds: getMonitorBounds(),
      };
    }

    function normalizeSource(source) {
      return sourceMonitorModel.normalizeSource(source, sourceModelContext());
    }

    function makeSource(overrides = {}, assignId = true) {
      const result = sourceMonitorModel.makeSource({
        defaults: state.sourceDefaults,
        overrides,
        nextId: state.nextSourceId,
        assignId,
        context: sourceModelContext(),
      });
      if (assignId) {
        state.nextSourceId = result.nextId;
      }
      return result.source;
    }

    function selectedSource() {
      return state.sources.find((source) => source.id === state.selectedSourceId) || state.sources[0] || null;
    }

    function replacePrimarySource(overrides = {}) {
      const entitySelection = getEntitySelection();
      if (state.sources.length === 0) {
        const source = makeSource(overrides);
        state.sources.push(source);
        entitySelection.setSourceId(source.id);
        return source;
      }
      const source = state.sources[0];
      Object.assign(source, overrides);
      normalizeSource(source);
      entitySelection.selectSource(source.id, { clearMaterial: false });
      return source;
    }

    function addSource(overrides = {}) {
      const source = makeSource(overrides);
      state.sources.push(source);
      getEntitySelection().selectSource(source.id);
      state.sourceDefaults = { ...source };
      delete state.sourceDefaults.id;
      return source;
    }

    function sourceRetireDuration(source) {
      const frequency = Math.max(0, Number(source?.frequency) || 0);
      if (source?.type === "sine" && frequency > 0) {
        return Math.max(minRetireSteps, Math.ceil(sourceRetireCycles / frequency));
      }
      return minRetireSteps;
    }

    function retireSourceForShutdown(source) {
      const sim = getSim();
      const retireStartTime = Number.isFinite(sim?.time) ? sim.time : 0;
      if (!(retireStartTime > 0) || Math.abs(Number(source?.amplitude) || 0) <= 0) return;
      if (!Array.isArray(state.retiringSources)) state.retiringSources = [];
      state.retiringSources.push({
        ...source,
        retireStartTime,
        retireDuration: sourceRetireDuration(source),
      });
    }

    function deleteSource(sourceId) {
      const index = state.sources.findIndex((source) => source.id === sourceId);
      if (index < 0) return;
      retireSourceForShutdown(state.sources[index]);
      state.sources.splice(index, 1);
      getEntitySelection().setSourceId(state.sources[Math.min(index, state.sources.length - 1)]?.id ?? null);
    }

    function explicitlySelectedSource() {
      return state.sources.find((source) => source.id === state.selectedSourceId) || null;
    }

    function clampAllSourcesToInterior() {
      state.sources.forEach((source) => normalizeSource(source));
    }

    function normalizeMonitor(monitor) {
      return sourceMonitorModel.normalizeMonitor(monitor, monitorModelContext());
    }

    function makeMonitor(overrides = {}, assignId = true) {
      const result = sourceMonitorModel.makeMonitor({
        defaults: state.monitorDefaults,
        overrides,
        nextId: state.nextMonitorId,
        assignId,
        context: monitorModelContext(),
      });
      if (assignId) {
        state.nextMonitorId = result.nextId;
      }
      return result.monitor;
    }

    function selectedMonitor() {
      return state.monitors.find((monitor) => monitor.id === state.selectedMonitorId) || state.monitors[0] || null;
    }

    function explicitlySelectedMonitor() {
      return state.monitors.find((monitor) => monitor.id === state.selectedMonitorId) || null;
    }

    function addMonitor(overrides = {}) {
      const monitor = makeMonitor(overrides);
      state.monitors.push(monitor);
      getEntitySelection().selectMonitor(monitor.id);
      state.visualProfile = "custom";
      state.monitorDefaults = { ...monitor };
      delete state.monitorDefaults.id;
      return monitor;
    }

    function deleteMonitor(monitorId) {
      const index = state.monitors.findIndex((monitor) => monitor.id === monitorId);
      if (index < 0) return;
      state.monitors.splice(index, 1);
      getEntitySelection().setMonitorId(state.monitors[Math.min(index, state.monitors.length - 1)]?.id ?? null);
    }

    function clampAllMonitorsToInterior() {
      state.monitors.forEach((monitor) => normalizeMonitor(monitor));
    }

    return {
      sourceModelContext,
      monitorModelContext,
      normalizeSource,
      makeSource,
      selectedSource,
      replacePrimarySource,
      addSource,
      deleteSource,
      explicitlySelectedSource,
      clampAllSourcesToInterior,
      normalizeMonitor,
      makeMonitor,
      selectedMonitor,
      explicitlySelectedMonitor,
      addMonitor,
      deleteMonitor,
      clampAllMonitorsToInterior,
    };
  }

  global.FdtdSourceMonitorOperations = {
    createSourceMonitorOperations,
  };
})(window);
