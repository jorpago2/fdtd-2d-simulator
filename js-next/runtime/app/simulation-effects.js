(function initFdtdSimulationEffects(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Simulation effects dependency must provide ${name}().`);
    }
    return value;
  }

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Simulation effects dependency must provide ${name}.`);
    }
    return value;
  }

  function createSimulationEffectsController(dependencies) {
    const sim = requireObject(dependencies.sim, "sim");
    const markWorkerDirty = requireFunction(dependencies.markWorkerDirty, "markWorkerDirty");
    const disableResponsiveGridOrientation = requireFunction(
      dependencies.disableResponsiveGridOrientation,
      "disableResponsiveGridOrientation",
    );
    const updateControlText = requireFunction(dependencies.updateControlText, "updateControlText");
    const updateStats = requireFunction(dependencies.updateStats, "updateStats");

    function commit(options = {}) {
      if (options.dirty) markWorkerDirty();
      if (options.disableResponsiveGrid) disableResponsiveGridOrientation();
      if (options.measure) sim.measure();
      if (options.controls) updateControlText();
      if (options.stats) updateStats();
      if (options.render) sim.render();
    }

    function commitMaterialMutation(options = {}) {
      commit({
        dirty: options.dirty ?? true,
        disableResponsiveGrid: options.disableResponsiveGrid ?? true,
        measure: options.measure ?? true,
        controls: options.controls ?? true,
        stats: options.stats ?? true,
        render: options.render ?? true,
      });
    }

    function commitSourceMutation(options = {}) {
      commit({
        dirty: options.dirty ?? true,
        disableResponsiveGrid: options.disableResponsiveGrid ?? true,
        measure: Boolean(options.measure),
        controls: options.controls ?? true,
        stats: Boolean(options.stats),
        render: options.render ?? true,
      });
    }

    function commitMonitorMutation(options = {}) {
      commit({
        dirty: Boolean(options.dirty),
        disableResponsiveGrid: options.disableResponsiveGrid ?? true,
        measure: Boolean(options.measure),
        controls: options.controls ?? true,
        stats: options.stats ?? true,
        render: options.render ?? true,
      });
    }

    function repaint(options = {}) {
      commit({
        controls: Boolean(options.controls),
        stats: Boolean(options.stats),
        render: true,
      });
    }

    return Object.freeze({
      commit,
      commitMaterialMutation,
      commitSourceMutation,
      commitMonitorMutation,
      repaint,
    });
  }

  global.FdtdSimulationEffects = Object.freeze({
    createSimulationEffectsController,
  });
})(window);
