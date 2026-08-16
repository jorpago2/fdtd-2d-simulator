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
    const documentRef = dependencies.documentRef || global.document;

    function refreshLineReferenceStatus(message = "") {
      if (!el.lineReferenceStatus) return;
      if (message) {
        el.lineReferenceStatus.textContent = message;
        return;
      }
      const status = typeof sim.linePortReferenceStatus === "function" ? sim.linePortReferenceStatus() : null;
      el.lineReferenceStatus.textContent = status?.message || "No line-monitor reference captured.";
    }

    function measureResultsUi() {
      if (typeof sim.measureForUi === "function") sim.measureForUi();
      else sim.measure();
    }

    refreshLineReferenceStatus();

    documentRef.addEventListener("change", (event) => {
      const id = event.target?.id;
      if (id === "maxwellCheckInput") {
        state.maxwellCheckEnabled = Boolean(event.target.checked);
        if (!state.maxwellCheckEnabled) sim.lastMaxwellCheck = null;
        else sim.updateMaxwellCheck?.(null);
        updateStats();
        sim.render();
      } else if (id === "analysisInput") {
        state.analysisEnabled = Boolean(event.target.checked);
        sim.resetAnalysisDiagnostics();
        updateControlText();
        sim.render();
      } else if (id === "sweepModeInput") {
        const nextMode = normalizeSweepMode(event.target.value);
        state.sweepMode = nextMode;
        applySweepModeDefaults(state, el, nextMode);
        resetSweepResults(state, setSweepStatus, sweepReadyStatusText, updateControlText);
      } else if (["sweepStartInput", "sweepEndInput", "sweepSamplesInput", "sweepStepsInput", "sweepBidirectionalInput"].includes(id)) {
        syncSweepStateFromInputs();
        resetSweepResults(state, setSweepStatus, sweepReadyStatusText, updateControlText);
      }
    });
    global.addEventListener("fdtd:results-setting", (event) => {
      if (event?.detail?.property !== "diagnosticsEnabled") return;
      state.diagnosticsEnabled = Boolean(event.detail.value);
      sim.resetDiagnostics();
      measureResultsUi();
      updateStats();
      sim.render();
    });

    documentRef.addEventListener("click", (event) => {
      const id = event.target?.closest?.("button")?.id;
      if (id === "diagnosticsResetBtn") {
        sim.resetDiagnostics();
        measureResultsUi();
        updateStats();
        sim.render();
      } else if (id === "maxwellCheckResetBtn") {
        sim.lastMaxwellCheck = null;
        if (state.maxwellCheckEnabled) sim.updateMaxwellCheck?.(null);
        updateStats();
        sim.render();
      } else if (id === "performanceResetBtn") resetPerformanceStats();
      else if (id === "analysisResetBtn") {
        sim.resetAnalysisDiagnostics();
        updateStats();
        sim.render();
      } else if (id === "lineReferenceCaptureBtn" || id === "lineReferenceClearBtn") {
        const capture = id === "lineReferenceCaptureBtn";
        const action = capture ? sim.captureLinePortReference : sim.clearLinePortReference;
        const result = typeof action === "function"
          ? action.call(sim)
          : { ok: false, message: "Line-monitor reference capture is unavailable." };
        refreshLineReferenceStatus(result.message);
        updateStats();
        sim.render();
      } else if (id === "sweepRunBtn") runSweep();
      else if (id === "sweepExportBtn") exportSweepCsv();
    });

    documentRef.addEventListener("toggle", (event) => {
      if (event.detail?.open && event.target?.closest?.(".results-detail-panel")) {
        global.requestAnimationFrame(updateStats);
      }
    });
    documentRef.addEventListener("focusin", (event) => {
      const chart = event.target?.closest?.("#spectrumChart, #farFieldChart");
      if (chart && el.analysisChartReadout) {
        el.analysisChartReadout.textContent = chart.getAttribute("aria-label") || "Chart";
      }
    });
    documentRef.addEventListener("pointermove", (event) => {
      if (event.target?.closest?.("#spectrumChart")) updateSpectrumReadout(event);
      else if (event.target?.closest?.("#farFieldChart")) updateFarFieldReadout(event);
      else if (event.target?.closest?.("#sweepChart")) updateSweepChartReadout(event);
    });
    documentRef.addEventListener("pointerleave", (event) => {
      const chart = event.target?.closest?.("#spectrumChart, #farFieldChart, #sweepChart");
      if (!chart) return;
      if (chart.id !== "sweepChart") {
        if (el.analysisChartReadout) el.analysisChartReadout.textContent = "Focus or move over a chart";
        return;
      }
      if (!el.sweepChartReadout) return;
      const results = state.sweepResults || [];
      el.sweepChartReadout.textContent = results.length > 0
        ? `${results.length} sweep points | ${sweepModeLabel()} ${formatSweepValue(results[results.length - 1].x)}`
        : "No sweep point";
    }, true);
  }

  global.FdtdResultsControlBindings = Object.freeze({
    bindResultsControls,
  });
})(window);
