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

  function createRuntimeController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const sim = requireObject(dependencies.sim, "sim");
    const timeStepBatch = requireFunction(dependencies.timeStepBatch, "timeStepBatch");
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

    function runtimeEngineLabel() {
      return sim.engineLabel();
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

    function setRunning(nextRunning) {
      const shouldRun = Boolean(nextRunning);
      const wasRunning = Boolean(state.running);
      state.running = shouldRun;
      if (wasRunning && !shouldRun) {
        finalizeDeferredResults();
      }
      updateControlText();
      return state.running;
    }

    function toggleRunning() {
      return setRunning(!state.running);
    }

    function advanceOneStep() {
      timeStepBatch(1, () => {
        sim.step();
      });
      sim.measure();
      updateStats();
      sim.render();
    }

    function resetSimulationFields() {
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
          timeStepBatch(stepsThisFrame, () => {
            for (let stepIndex = 0; stepIndex < stepsThisFrame; stepIndex += 1) {
              sim.step();
            }
          });
          advancedSimulation = true;
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
      runtimeEngineLabel,
      effectiveStepsPerFrame,
      setRunning,
      toggleRunning,
      advanceOneStep,
      resetSimulationFields,
      clampStepAccumulator,
      startAnimationLoop,
    });
  }

  global.FdtdRuntimeController = Object.freeze({
    createRuntimeController,
  });
})(window);
