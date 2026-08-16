(function initFdtdUiResults(global) {
  "use strict";

  function resultsInsightText(
    {
      balance = 0,
      balanceMethod = "",
      balanceReady = false,
      diagnosticsEnabled = true,
      lastDiverged = false,
      reflectance = 0,
      samples = 0,
      transmittance = 0,
    },
    formatDiagnosticRatio,
  ) {
    if (lastDiverged) {
      return {
        text: "Field diverged. Reset the field or reduce gain/material contrast before trusting R/T.",
        warning: true,
      };
    }
    if (!diagnosticsEnabled) {
      return {
        text: "Line monitors are disabled; enable them to estimate reflectance and transmittance.",
        warning: true,
      };
    }
    if (samples <= 0) {
      return {
        text: "Run the simulation until the wave reaches the monitor lines.",
        warning: false,
      };
    }
    if (!balanceReady) {
      return {
        text: `Collecting monitor samples (${samples}). R/T will stabilize after a few wave periods.`,
        warning: false,
      };
    }
    const residual = Math.abs(balance);
    return {
      text: `R=${formatDiagnosticRatio(reflectance)}, T=${formatDiagnosticRatio(transmittance)}, residual=${formatDiagnosticRatio(
        balance,
      )} from ${samples} samples (${balanceMethod || "line monitors"}).`,
      warning: residual > 0.25,
    };
  }

  function createResultsController({
    el,
    formatDiagnosticRatio,
    formatFieldValue,
    buildSceneObservables,
    measureCustomMonitors,
    maxwellCheckReport,
    monitorQuantityLabel,
  } = {}) {
    function updateRunState(isRunning) {
      global.dispatchEvent?.(new CustomEvent("fdtd:results-run-state", { detail: { running: Boolean(isRunning) } }));
    }

    function updateInsight(diagnostics) {
      const insight = resultsInsightText(diagnostics, formatDiagnosticRatio);
      global.dispatchEvent?.(new CustomEvent("fdtd:results-insight", { detail: insight }));
      return insight;
    }

    function customMonitorResultsVisible() {
      if (!el?.customMonitorResults) return false;
      if (el.customMonitorResults.closest("[hidden]")) return false;
      return el.customMonitorResults.getClientRects().length > 0;
    }

    function renderSceneObservables() {
      const report = typeof buildSceneObservables === "function" ? buildSceneObservables() || {} : {};
      global.dispatchEvent?.(new CustomEvent("fdtd:scene-observables", { detail: report }));
    }

    function renderMaxwellCheckResults({ maxwellCheckEnabled = false } = {}) {
      const fallbackReport = {
        enabled: false,
        status: "off",
        component: "",
        sampleCount: 0,
        skippedCount: 0,
        stride: 1,
        rows: [],
        note: "Enable the checker to compute discrete Maxwell-equation residuals.",
      };
      const report = typeof maxwellCheckReport === "function" ? maxwellCheckReport() || fallbackReport : fallbackReport;
      global.dispatchEvent?.(new CustomEvent("fdtd:maxwell-check", {
        detail: { enabled: Boolean(maxwellCheckEnabled || report.enabled), report },
      }));
    }

    function renderCustomMonitorResults({ force = false, monitorCount = 0 } = {}) {
      if (!force && !customMonitorResultsVisible()) return;
      if (monitorCount <= 0) {
        global.dispatchEvent?.(new CustomEvent("fdtd:custom-monitors", { detail: [] }));
        return;
      }
      const cards = (measureCustomMonitors?.() || []).map((measurement) => {
        const monitor = measurement.monitor;
        const component = monitorQuantityLabel("scalar").replace(/\s+mean$/i, "");
        const samplingNotes = [
          `${measurement.samples} cells`,
          measurement.pecSamples > 0 ? `${measurement.pecSamples} PEC skipped` : null,
          measurement.clipped ? "clipped at interior" : null,
        ].filter(Boolean);
        const fieldMetrics = [
          ["Selected", formatFieldValue(measurement.value)],
          [`Mean ${component}`, formatFieldValue(measurement.mean)],
          [`Mean |${component}|`, formatFieldValue(measurement.magnitude)],
          [`RMS ${component}`, formatFieldValue(measurement.rms)],
        ];
        const fluxMetrics = [
          ["Selected", formatFieldValue(measurement.value)],
          ["Mean S·n", formatFieldValue(measurement.normalFlux)],
          ["Mean S·t", formatFieldValue(measurement.tangentFlux)],
        ];
        return {
          id: monitor.id,
          kind: monitorQuantityLabel(monitor.quantity),
          warning: Boolean(measurement.samplingWarning),
          meta: `Instantaneous t=${formatFieldValue(measurement.time)} | L=${Number(monitor.lengthLambda).toFixed(
            2,
          )} λ0 | θ=${Number(monitor.angleDeg).toFixed(1)}° | ${samplingNotes.join(" | ")}`,
          metrics: (monitor.quantity === "normalFlux" || monitor.quantity === "tangentFlux" ? fluxMetrics : fieldMetrics)
            .map(([label, value]) => ({ label, value })),
        };
      });
      global.dispatchEvent?.(new CustomEvent("fdtd:custom-monitors", { detail: cards }));
    }

    function updateDiagnostics({
      angleText,
      balance,
      balanceMethod,
      balanceReady,
      diagnosticsEnabled,
      incidentPower,
      lastDiverged,
      monitorCount,
      reflectedPower,
      reflectance,
      samples,
      transmittedPower,
      transmittance,
      engineText,
      maxwellCheckEnabled,
    }) {
      const monitorDataReady = diagnosticsEnabled && balanceReady && !lastDiverged;
      const reflectanceText = monitorDataReady ? formatDiagnosticRatio(reflectance) : "—";
      const transmittanceText = monitorDataReady ? formatDiagnosticRatio(transmittance) : "—";
      const balanceText = monitorDataReady ? formatDiagnosticRatio(balance) : "—";
      const incidentPowerText = monitorDataReady ? formatFieldValue(incidentPower || 0) : "—";
      const reflectedPowerText = monitorDataReady ? formatFieldValue(reflectedPower || 0) : "—";
      const transmittedPowerText = monitorDataReady ? formatFieldValue(transmittedPower || 0) : "—";
      const insight = updateInsight({ balance, balanceMethod, balanceReady, diagnosticsEnabled, lastDiverged, reflectance, samples, transmittance });
      renderSceneObservables();
      renderMaxwellCheckResults({ maxwellCheckEnabled });
      renderCustomMonitorResults({ monitorCount });
      global.dispatchEvent?.(new CustomEvent("fdtd:results-snapshot", {
        detail: {
          angle: angleText,
          balance: balanceText,
          diagnosticsEnabled,
          engine: engineText,
          insight: insight.text,
          incidentPower: incidentPowerText,
          reflectedPower: reflectedPowerText,
          reflectance: reflectanceText,
          transmittedPower: transmittedPowerText,
          transmittance: transmittanceText,
        },
      }));
    }

    return {
      customMonitorResultsVisible,
      renderCustomMonitorResults,
      renderMaxwellCheckResults,
      renderSceneObservables,
      updateDiagnostics,
      updateInsight,
      updateRunState,
    };
  }

  global.FdtdUiResults = Object.freeze({
    createResultsController,
    resultsInsightText,
  });
})(window);
