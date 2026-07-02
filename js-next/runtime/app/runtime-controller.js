(function initFdtdRuntimeController(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Runtime controller dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Runtime controller dependency must provide ${name}().`);
    }
    return value;
  }

  function parseWorkerMode(search) {
    const rawMode = new URLSearchParams(String(search || "")).get("worker");
    const mode = String(rawMode || "").trim().toLowerCase();
    if (["1", "true", "yes", "on", "force"].includes(mode)) return "force";
    if (["auto"].includes(mode)) return "auto";
    if (["0", "false", "no", "off", "none"].includes(mode)) return "off";
    return "off";
  }

  function createRuntimeController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const sim = requireObject(dependencies.sim, "sim");
    const getWorkerEngine = requireFunction(dependencies.getWorkerEngine, "getWorkerEngine");
    const timeStepBatch = requireFunction(dependencies.timeStepBatch, "timeStepBatch");
    const updatePerformanceStats = requireFunction(dependencies.updatePerformanceStats, "updatePerformanceStats");
    const finalizeDeferredResults = requireFunction(dependencies.finalizeDeferredResults, "finalizeDeferredResults");
    const updateControlText = requireFunction(dependencies.updateControlText, "updateControlText");
    const updateStats = requireFunction(dependencies.updateStats, "updateStats");
    const courant = Number(dependencies.courant);
    const visualCourantReference = Number(dependencies.visualCourantReference);
    const maxNumericalStepsPerFrame = Number(dependencies.maxNumericalStepsPerFrame);
    const scheduleFrame = dependencies.scheduleFrame || global.requestAnimationFrame?.bind(global);
    if (typeof scheduleFrame !== "function") {
      throw new Error("Runtime controller requires requestAnimationFrame or a scheduleFrame() dependency.");
    }

    let stepAccumulator = 0;
    let animationStarted = false;

    function requestedWorkerMode() {
      const search = dependencies.getLocationSearch ? dependencies.getLocationSearch() : global.location?.search;
      return parseWorkerMode(search);
    }

    function mainThreadUsesCompiledKernel() {
      return /^WASM/.test(sim.engineLabel());
    }

    function workerShouldStartForFrame() {
      const workerMode = requestedWorkerMode();
      if (workerMode === "off") return false;
      if (workerMode === "force") return true;
      return !mainThreadUsesCompiledKernel();
    }

    function queueWorkerStepsIfUseful(stepCount) {
      const workerEngine = getWorkerEngine();
      if (!workerEngine?.supported?.()) return false;
      if (workerEngine.isActive()) return workerEngine.queueSteps(stepCount);
      return workerShouldStartForFrame() ? workerEngine.queueSteps(stepCount) : false;
    }

    function runtimeEngineLabel() {
      const baseLabel = sim.engineLabel();
      const workerEngine = getWorkerEngine();
      return workerEngine?.label ? workerEngine.label(baseLabel) : baseLabel;
    }

    function visualStepScale() {
      if (!Number.isFinite(courant) || courant <= 0) return 1;
      if (!Number.isFinite(visualCourantReference) || visualCourantReference <= 0) return 1;
      return visualCourantReference / courant;
    }

    function effectiveStepsPerFrame() {
      const requestedVisualSpeed = Math.max(0, Number(state.stepsPerFrame) || 0);
      const requestedSteps = requestedVisualSpeed * visualStepScale();
      if (!Number.isFinite(maxNumericalStepsPerFrame) || maxNumericalStepsPerFrame <= 0) return requestedSteps;
      return Math.min(requestedSteps, maxNumericalStepsPerFrame);
    }

    function toggleRunning() {
      state.running = !state.running;
      if (!state.running) {
        const syncRequested = getWorkerEngine()?.requestFullSync?.();
        if (!syncRequested) {
          finalizeDeferredResults();
        }
      }
      updateControlText();
      return state.running;
    }

    function advanceOneStep() {
      getWorkerEngine()?.markDirty?.();
      timeStepBatch(1, () => {
        sim.step();
      });
      sim.measure();
      updateStats();
      sim.render();
    }

    function resetSimulationFields() {
      getWorkerEngine()?.markDirty?.();
      sim.resetFields();
      sim.measure();
      updateStats();
      sim.render();
    }

    function clampStepAccumulator(maxSteps = effectiveStepsPerFrame()) {
      const limit = Math.max(0, Number(maxSteps) || 0);
      stepAccumulator = Math.min(stepAccumulator, limit);
      return stepAccumulator;
    }

    function animationFrame() {
      let advancedSimulation = false;
      if (state.running) {
        stepAccumulator += effectiveStepsPerFrame();
        const stepsThisFrame = Math.floor(stepAccumulator);
        stepAccumulator -= stepsThisFrame;
        if (stepsThisFrame > 0) {
          if (queueWorkerStepsIfUseful(stepsThisFrame)) {
            updatePerformanceStats();
          } else {
            timeStepBatch(stepsThisFrame, () => {
              for (let stepIndex = 0; stepIndex < stepsThisFrame; stepIndex += 1) {
                sim.step();
              }
            });
            advancedSimulation = true;
          }
        }
      }
      if (advancedSimulation) {
        sim.render();
      }
      scheduleFrame(animationFrame);
    }

    function startAnimationLoop() {
      if (animationStarted) return;
      animationStarted = true;
      scheduleFrame(animationFrame);
    }

    return Object.freeze({
      requestedWorkerMode,
      mainThreadUsesCompiledKernel,
      workerShouldStartForFrame,
      queueWorkerStepsIfUseful,
      runtimeEngineLabel,
      effectiveStepsPerFrame,
      toggleRunning,
      advanceOneStep,
      resetSimulationFields,
      clampStepAccumulator,
      startAnimationLoop,
    });
  }

  global.FdtdRuntimeController = Object.freeze({
    parseWorkerMode,
    createRuntimeController,
  });
})(window);
