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
    const DEFAULT_VISUAL_REFRESH_HZ = 60;
    const MAX_VISUAL_CATCH_UP_FRAMES = 2;
    // Keep visual pacing smooth after expensive renders or WASM warm-up; FDTD dt is still fixed per step.
    const MAX_FRAME_DELTA_SECONDS = MAX_VISUAL_CATCH_UP_FRAMES / DEFAULT_VISUAL_REFRESH_HZ;

    const state = requireObject(dependencies.state, "state");
    const sim = requireObject(dependencies.sim, "sim");
    const timeStepBatch = requireFunction(dependencies.timeStepBatch, "timeStepBatch");
    const finalizeDeferredResults = requireFunction(dependencies.finalizeDeferredResults, "finalizeDeferredResults");
    const updateControlText = requireFunction(dependencies.updateControlText, "updateControlText");
    const updateStats = requireFunction(dependencies.updateStats, "updateStats");
    const updatePerformanceStats =
      typeof dependencies.updatePerformanceStats === "function" ? dependencies.updatePerformanceStats : () => {};
    const courant = Number(dependencies.courant);
    const visualCourantReference = Number(dependencies.visualCourantReference);
    const maxNumericalStepsPerFrame = Number(dependencies.maxNumericalStepsPerFrame);
    const scheduleFrame = dependencies.scheduleFrame || global.requestAnimationFrame?.bind(global);
    if (typeof scheduleFrame !== "function") {
      throw new Error("Runtime controller requires requestAnimationFrame or a scheduleFrame() dependency.");
    }

    let stepAccumulator = 0;
    let animationStarted = false;
    let previousFrameTimeMs = null;
    let lastRenderTimeMs = -Infinity;

    function currentTimeMs() {
      const now = global.performance?.now;
      return typeof now === "function" ? now.call(global.performance) : Date.now();
    }

    function runtimeEngineLabel() {
      return sim.engineLabel();
    }

    function visualStepScale() {
      if (!Number.isFinite(courant) || courant <= 0) return 1;
      if (!Number.isFinite(visualCourantReference) || visualCourantReference <= 0) return 1;
      return visualCourantReference / courant;
    }

    function maxStepsPerAnimationFrame() {
      if (!Number.isFinite(maxNumericalStepsPerFrame) || maxNumericalStepsPerFrame <= 0) return Infinity;
      return Math.max(1, Math.floor(maxNumericalStepsPerFrame));
    }

    function targetStepsPerSecond() {
      const requestedTimeRate = Math.max(0, Number(state.timeRate) || 0);
      const requestedSteps = requestedTimeRate * visualStepScale() * DEFAULT_VISUAL_REFRESH_HZ;
      const stepCap = maxStepsPerAnimationFrame();
      if (!Number.isFinite(stepCap)) return requestedSteps;
      return Math.min(requestedSteps, stepCap * DEFAULT_VISUAL_REFRESH_HZ);
    }

    function effectiveStepsPerFrame() {
      return targetStepsPerSecond() / DEFAULT_VISUAL_REFRESH_HZ;
    }

    function targetRenderFps() {
      const fps = Number(state.renderFps) || 0;
      return [15, 30, 60].includes(fps) ? fps : 0;
    }

    function shouldRenderFrame(nowMs) {
      const fps = targetRenderFps();
      if (fps <= 0) {
        lastRenderTimeMs = nowMs;
        return true;
      }
      const minIntervalMs = 1000 / fps;
      if (!Number.isFinite(lastRenderTimeMs) || nowMs - lastRenderTimeMs >= minIntervalMs - 1) {
        lastRenderTimeMs = nowMs;
        return true;
      }
      return false;
    }

    function resetRuntimePacing() {
      const nowMs = currentTimeMs();
      stepAccumulator = 0;
      previousFrameTimeMs = nowMs;
      lastRenderTimeMs = -Infinity;
    }

    function setRunning(nextRunning) {
      const shouldRun = Boolean(nextRunning);
      const wasRunning = Boolean(state.running);
      state.running = shouldRun;
      if (!wasRunning && shouldRun) {
        resetRuntimePacing();
      }
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
      resetRuntimePacing();
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

    function animationFrame(frameTimeMs) {
      const nowMs = Number.isFinite(Number(frameTimeMs)) ? Number(frameTimeMs) : currentTimeMs();
      const elapsedSeconds =
        previousFrameTimeMs == null
          ? 1 / DEFAULT_VISUAL_REFRESH_HZ
          : Math.min(MAX_FRAME_DELTA_SECONDS, Math.max(0, (nowMs - previousFrameTimeMs) / 1000));
      previousFrameTimeMs = nowMs;

      let advancedSimulation = false;
      if (state.running) {
        const frameStepCap = maxStepsPerAnimationFrame();
        stepAccumulator += targetStepsPerSecond() * elapsedSeconds;
        const stepsThisFrame = Math.min(Math.floor(stepAccumulator), frameStepCap);
        stepAccumulator -= stepsThisFrame;
        if (Number.isFinite(frameStepCap)) {
          stepAccumulator = Math.min(stepAccumulator, frameStepCap);
        }
        if (stepsThisFrame > 0) {
          timeStepBatch(stepsThisFrame, () => {
            for (let stepIndex = 0; stepIndex < stepsThisFrame; stepIndex += 1) {
              sim.step();
            }
          });
          advancedSimulation = true;
        }
      }
      if (advancedSimulation && shouldRenderFrame(nowMs)) {
        sim.render();
      }
      updatePerformanceStats();
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
      targetStepsPerSecond,
      targetRenderFps,
      resetRuntimePacing,
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
