(function initFdtdResultsControlBindings(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Results control bindings dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Results control bindings dependency must provide ${name}().`);
    }
    return value;
  }

  function forEachNode(nodes, callback) {
    nodes?.forEach?.(callback);
  }

  function applySweepModeDefaults(state, el, mode) {
    if (mode === "frequency") {
      state.sweepStart = 0.012;
      state.sweepEnd = 0.055;
    } else if (mode === "amplitude") {
      state.sweepStart = 0.1;
      state.sweepEnd = 1.0;
    } else if (mode === "gainLoss") {
      state.sweepStart = 0;
      state.sweepEnd = 0.08;
    } else if (mode === "symmetry") {
      state.sweepStart = 0;
      state.sweepEnd = 0.16;
    } else if (mode === "blochK") {
      state.sweepStart = 0;
      state.sweepEnd = 1;
      state.sweepSamples = 11;
    } else if (mode === "direction") {
      state.sweepStart = 0;
      state.sweepEnd = 1;
      state.sweepSamples = 2;
    } else {
      state.sweepStart = 0;
      state.sweepEnd = 70;
    }
    state.sweepBidirectional = mode === "amplitude" && Boolean(el.sweepBidirectionalInput?.checked);
  }

  function resetSweepResults(state, setSweepStatus, sweepReadyStatusText, updateControlText) {
    state.sweepResults = [];
    setSweepStatus(sweepReadyStatusText());
    updateControlText();
  }

  function bindResultsControls(dependencies) {
    const el = requireObject(dependencies.el, "el");
    const state = requireObject(dependencies.state, "state");
    const sim = requireObject(dependencies.sim, "sim");
    const updateControlText = requireFunction(dependencies.updateControlText, "updateControlText");
    const updateStats = requireFunction(dependencies.updateStats, "updateStats");
    const resetPerformanceStats = requireFunction(dependencies.resetPerformanceStats, "resetPerformanceStats");
    const updateSpectrumReadout = requireFunction(dependencies.updateSpectrumReadout, "updateSpectrumReadout");
    const updateFarFieldReadout = requireFunction(dependencies.updateFarFieldReadout, "updateFarFieldReadout");
    const normalizeSweepMode = requireFunction(dependencies.normalizeSweepMode, "normalizeSweepMode");
    const syncSweepStateFromInputs = requireFunction(dependencies.syncSweepStateFromInputs, "syncSweepStateFromInputs");
    const setSweepStatus = requireFunction(dependencies.setSweepStatus, "setSweepStatus");
    const sweepReadyStatusText = requireFunction(dependencies.sweepReadyStatusText, "sweepReadyStatusText");
    const runSweep = requireFunction(dependencies.runSweep, "runSweep");
    const exportSweepCsv = requireFunction(dependencies.exportSweepCsv, "exportSweepCsv");
    const updateSweepChartReadout = requireFunction(dependencies.updateSweepChartReadout, "updateSweepChartReadout");
    const sweepModeLabel = requireFunction(dependencies.sweepModeLabel, "sweepModeLabel");
    const formatSweepValue = requireFunction(dependencies.formatSweepValue, "formatSweepValue");

    function refreshLineReferenceStatus(message = "") {
      if (!el.lineReferenceStatus) return;
      if (message) {
        el.lineReferenceStatus.textContent = message;
        return;
      }
      const status = typeof sim.linePortReferenceStatus === "function" ? sim.linePortReferenceStatus() : null;
      el.lineReferenceStatus.textContent = status?.message || "No line-port reference captured.";
    }

    function measureResultsUi() {
      if (typeof sim.measureForUi === "function") sim.measureForUi();
      else sim.measure();
    }

    el.diagnosticsInput?.addEventListener("change", () => {
      state.diagnosticsEnabled = el.diagnosticsInput.checked;
      sim.resetDiagnostics();
      measureResultsUi();
      updateStats();
      sim.render();
    });

    el.diagnosticsResetBtn?.addEventListener("click", () => {
      sim.resetDiagnostics();
      measureResultsUi();
      updateStats();
      sim.render();
    });

    el.maxwellCheckInput?.addEventListener("change", () => {
      state.maxwellCheckEnabled = Boolean(el.maxwellCheckInput.checked);
      if (!state.maxwellCheckEnabled) {
        sim.lastMaxwellCheck = null;
      } else if (typeof sim.updateMaxwellCheck === "function") {
        sim.updateMaxwellCheck(null);
      }
      updateStats();
      sim.render();
    });

    el.maxwellCheckResetBtn?.addEventListener("click", () => {
      sim.lastMaxwellCheck = null;
      if (state.maxwellCheckEnabled && typeof sim.updateMaxwellCheck === "function") {
        sim.updateMaxwellCheck(null);
      }
      updateStats();
      sim.render();
    });

    el.performanceResetBtn?.addEventListener("click", () => {
      resetPerformanceStats();
    });

    el.analysisInput?.addEventListener("change", () => {
      state.analysisEnabled = el.analysisInput.checked;
      sim.resetAnalysisDiagnostics();
      updateControlText();
      sim.render();
    });

    el.analysisResetBtn?.addEventListener("click", () => {
      sim.resetAnalysisDiagnostics();
      updateStats();
      sim.render();
    });

    el.lineReferenceCaptureBtn?.addEventListener("click", () => {
      const result =
        typeof sim.captureLinePortReference === "function"
          ? sim.captureLinePortReference()
          : { ok: false, message: "Line-port reference capture is unavailable." };
      refreshLineReferenceStatus(result.message);
      updateStats();
      sim.render();
    });

    el.lineReferenceClearBtn?.addEventListener("click", () => {
      const result =
        typeof sim.clearLinePortReference === "function"
          ? sim.clearLinePortReference()
          : { ok: false, message: "Line-port reference capture is unavailable." };
      refreshLineReferenceStatus(result.message);
      updateStats();
      sim.render();
    });

    refreshLineReferenceStatus();

    el.spectrumChart?.addEventListener("pointermove", updateSpectrumReadout);
    el.farFieldChart?.addEventListener("pointermove", updateFarFieldReadout);
    forEachNode([el.spectrumChart, el.farFieldChart], (canvas) => {
      canvas?.addEventListener("pointerleave", () => {
        if (el.analysisChartReadout) el.analysisChartReadout.textContent = "Move over a chart";
      });
    });

    el.sweepModeInput?.addEventListener("change", () => {
      const nextMode = normalizeSweepMode(el.sweepModeInput.value);
      state.sweepMode = nextMode;
      applySweepModeDefaults(state, el, nextMode);
      resetSweepResults(state, setSweepStatus, sweepReadyStatusText, updateControlText);
    });

    forEachNode(
      [el.sweepStartInput, el.sweepEndInput, el.sweepSamplesInput, el.sweepStepsInput, el.sweepBidirectionalInput],
      (input) => {
        input?.addEventListener("change", () => {
          syncSweepStateFromInputs();
          resetSweepResults(state, setSweepStatus, sweepReadyStatusText, updateControlText);
        });
      },
    );

    el.sweepRunBtn?.addEventListener("click", () => {
      runSweep();
    });

    el.sweepExportBtn?.addEventListener("click", () => {
      exportSweepCsv();
    });

    el.sweepChart?.addEventListener("pointermove", updateSweepChartReadout);
    el.sweepChart?.addEventListener("pointerleave", () => {
      if (!el.sweepChartReadout) return;
      const results = state.sweepResults || [];
      el.sweepChartReadout.textContent =
        results.length > 0
          ? `${results.length} sweep points | ${sweepModeLabel()} ${formatSweepValue(results[results.length - 1].x)}`
          : "No sweep point";
    });
  }

  global.FdtdResultsControlBindings = Object.freeze({
    bindResultsControls,
  });
})(window);
