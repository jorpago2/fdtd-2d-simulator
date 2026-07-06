(function initFdtdRuntimeSession(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Runtime session dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Runtime session dependency must provide ${name}().`);
    }
    return value;
  }

  function createRuntimeSessionController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const el = requireObject(dependencies.el, "el");
    const numericInputs = requireObject(dependencies.numericInputs, "numericInputs");
    const appPerformanceModule = requireObject(dependencies.appPerformanceModule, "appPerformanceModule");
    const getSim = requireFunction(dependencies.getSim, "getSim");
    const getRuntimeController = requireFunction(dependencies.getRuntimeController, "getRuntimeController");
    const documentRef = dependencies.documentRef || global.document;
    const windowRef = dependencies.windowRef || global;

    let editSessionDepth = 0;
    let editSessionShouldResume = false;
    let performanceController = null;

    function getPerformanceController() {
      if (!performanceController) {
        performanceController = appPerformanceModule.createPerformanceController({
          el,
          state,
          getSim,
          getRuntimeController,
        });
        windowRef.fdtdPerformance = {
          now: performanceController.now,
          record: performanceController.record,
          performanceStats: performanceController.performanceStats,
        };
      }
      return performanceController;
    }

    function setRunning(running) {
      const runtimeController = getRuntimeController();
      if (runtimeController?.setRunning) {
        runtimeController.setRunning(running);
        return;
      }
      state.running = Boolean(running);
    }

    function beginEditSession() {
      if (editSessionDepth === 0) {
        editSessionShouldResume = Boolean(state.running);
        if (state.running) {
          setRunning(false);
        }
      }
      editSessionDepth += 1;
    }

    function endEditSession(scope = documentRef) {
      if (scope && !numericInputs.validateScope(scope)) return false;
      editSessionDepth = Math.max(0, editSessionDepth - 1);
      if (editSessionDepth === 0) {
        const shouldResume = editSessionShouldResume;
        editSessionShouldResume = false;
        if (shouldResume && !numericInputs.hasInvalidInputs(documentRef)) {
          setRunning(true);
        }
      }
      return true;
    }

    function timeStepBatch(stepCount, runner) {
      return getPerformanceController().timeStepBatch(stepCount, runner);
    }

    function instrumentSimulationPerformance(targetSim) {
      return getPerformanceController().instrumentSimulation(targetSim);
    }

    function resetPerformanceStats() {
      return getPerformanceController().reset();
    }

    function runtimeEngineLabel() {
      return getPerformanceController().runtimeEngineLabel();
    }

    function updatePerformanceStats(force = false) {
      return getPerformanceController().update(force);
    }

    return Object.freeze({
      setRunning,
      beginEditSession,
      endEditSession,
      timeStepBatch,
      instrumentSimulationPerformance,
      resetPerformanceStats,
      runtimeEngineLabel,
      updatePerformanceStats,
    });
  }

  global.FdtdRuntimeSession = Object.freeze({
    createRuntimeSessionController,
  });
})(window);
