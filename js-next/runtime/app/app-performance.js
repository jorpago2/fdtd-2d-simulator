(function initFdtdAppPerformance(global) {
  "use strict";

  const PERF_EWMA_ALPHA = 0.14;
  const PERF_UI_INTERVAL_MS = 250;

  function createPerformanceController({
    el,
    state,
    getSim,
    getRuntimeController,
  }) {
    const performanceStats = {
      stepMs: 0,
      renderMs: 0,
      renderMapMs: 0,
      renderPresentMs: 0,
      renderOverlayMs: 0,
      measureMs: 0,
      stepSamples: 0,
      renderSamples: 0,
      renderMapSamples: 0,
      renderPresentSamples: 0,
      renderOverlaySamples: 0,
      measureSamples: 0,
      lastUiUpdateMs: 0,
    };

    function now() {
      return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    }

    function record(name, elapsedMs, sampleCount = 1) {
      const count = Math.max(1, Number(sampleCount) || 1);
      const perSampleMs = Number(elapsedMs) / count;
      if (!Number.isFinite(perSampleMs) || perSampleMs < 0) return;
      const sampleKey = `${name.replace("Ms", "")}Samples`;
      const previousSamples = performanceStats[sampleKey] || 0;
      performanceStats[name] = previousSamples > 0
        ? performanceStats[name] * (1 - PERF_EWMA_ALPHA) + perSampleMs * PERF_EWMA_ALPHA
        : perSampleMs;
      performanceStats[sampleKey] = previousSamples + count;
    }

    function timeStepBatch(stepCount, runner) {
      const count = Math.max(1, Number(stepCount) || 1);
      const startMs = now();
      try {
        return runner();
      } finally {
        record("stepMs", now() - startMs, count);
      }
    }

    function instrumentSimulation(targetSim) {
      const rawRender = targetSim.render.bind(targetSim);
      targetSim.render = (...args) => {
        const startMs = now();
        try {
          return rawRender(...args);
        } finally {
          record("renderMs", now() - startMs);
        }
      };

      const rawMeasure = targetSim.measure.bind(targetSim);
      targetSim.measure = (...args) => {
        const startMs = now();
        try {
          return rawMeasure(...args);
        } finally {
          record("measureMs", now() - startMs);
        }
      };
    }

    function formatMs(value, samples) {
      if (!samples) return "-";
      if (!Number.isFinite(value)) return "-";
      if (value < 0.005) return "<0.005 ms";
      if (value < 1) return `${value.toFixed(3)} ms`;
      if (value < 10) return `${value.toFixed(2)} ms`;
      return `${value.toFixed(1)} ms`;
    }

    function formatRate(stepMs, samples) {
      if (!samples || !Number.isFinite(stepMs) || stepMs <= 0) return "-";
      const rate = 1000 / stepMs;
      if (rate >= 100000) return `${(rate / 1000).toFixed(0)}k step/s`;
      if (rate >= 1000) return `${(rate / 1000).toFixed(1)}k step/s`;
      if (rate >= 10) return `${rate.toFixed(0)} step/s`;
      return `${rate.toFixed(1)} step/s`;
    }

    function runtimeEngineLabel() {
      const sim = getSim();
      return getRuntimeController()?.runtimeEngineLabel() || sim?.engineLabel?.() || "JS";
    }

    function update(force = false) {
      const nowMs = now();
      if (!force && nowMs - performanceStats.lastUiUpdateMs < PERF_UI_INTERVAL_MS) return;
      performanceStats.lastUiUpdateMs = nowMs;

      const sim = getSim();
      if (!sim) return;

      const engineText = runtimeEngineLabel();
      const gridText = `${sim.nx} x ${sim.ny} (${sim.n.toLocaleString()} cells)`;
      const stepText = formatMs(performanceStats.stepMs, performanceStats.stepSamples);
      const renderText = formatMs(performanceStats.renderMs, performanceStats.renderSamples);
      const renderMapText = formatMs(performanceStats.renderMapMs, performanceStats.renderMapSamples);
      const renderPresentText = formatMs(performanceStats.renderPresentMs, performanceStats.renderPresentSamples);
      const renderOverlayText = formatMs(performanceStats.renderOverlayMs, performanceStats.renderOverlaySamples);
      const measureText = formatMs(performanceStats.measureMs, performanceStats.measureSamples);
      const throughputText = formatRate(performanceStats.stepMs, performanceStats.stepSamples);
      const compiledActive = /^WASM/.test(engineText);
      const materialPath = sim.canUseCompiledMaterialStep?.()
        ? state.materialDispersionEnabled
          ? "compiled Yee + ADE path"
          : "compiled material path"
        : sim.hasDynamicMaterialResponse?.()
        ? "dynamic material path"
        : state.materialConductivityEnabled
          ? "conductive static path"
          : "static-material path";
      const statusText = performanceStats.stepSamples > 0
        ? `${compiledActive ? "Compiled kernel active" : "JavaScript fallback"}; ${materialPath}.`
        : "Run or step the simulation to collect timing samples.";

      if (el.performanceBackendOutput) el.performanceBackendOutput.textContent = engineText;
      if (el.performanceGridOutput) el.performanceGridOutput.textContent = gridText;
      if (el.performanceStepOutput) el.performanceStepOutput.textContent = stepText;
      if (el.performanceRenderOutput) el.performanceRenderOutput.textContent = renderText;
      if (el.performanceRenderMapOutput) el.performanceRenderMapOutput.textContent = renderMapText;
      if (el.performanceRenderPresentOutput) el.performanceRenderPresentOutput.textContent = renderPresentText;
      if (el.performanceRenderOverlayOutput) el.performanceRenderOverlayOutput.textContent = renderOverlayText;
      if (el.performanceMeasureOutput) el.performanceMeasureOutput.textContent = measureText;
      if (el.performanceThroughputOutput) el.performanceThroughputOutput.textContent = throughputText;
      if (el.performanceStatus) el.performanceStatus.textContent = statusText;
    }

    function reset() {
      performanceStats.stepMs = 0;
      performanceStats.renderMs = 0;
      performanceStats.renderMapMs = 0;
      performanceStats.renderPresentMs = 0;
      performanceStats.renderOverlayMs = 0;
      performanceStats.measureMs = 0;
      performanceStats.stepSamples = 0;
      performanceStats.renderSamples = 0;
      performanceStats.renderMapSamples = 0;
      performanceStats.renderPresentSamples = 0;
      performanceStats.renderOverlaySamples = 0;
      performanceStats.measureSamples = 0;
      performanceStats.lastUiUpdateMs = 0;
      update(true);
    }

    return {
      performanceStats,
      now,
      record,
      timeStepBatch,
      instrumentSimulation,
      reset,
      formatMs,
      formatRate,
      runtimeEngineLabel,
      update,
    };
  }

  global.FdtdAppPerformance = {
    createPerformanceController,
  };
})(window);
