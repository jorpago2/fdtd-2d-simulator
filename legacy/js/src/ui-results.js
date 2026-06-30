(function initFdtdUiResults(global) {
  "use strict";

  function createMetricNode(documentRef, label, value) {
    const metric = documentRef.createElement("div");
    metric.className = "diagnostic-metric";
    const labelNode = documentRef.createElement("span");
    const output = documentRef.createElement("output");
    labelNode.textContent = label;
    output.textContent = value;
    metric.append(labelNode, output);
    return metric;
  }

  function setOutputText(output, value) {
    if (output) output.textContent = value;
  }

  function resultsInsightText({ balance = 0, diagnosticsEnabled = true, lastDiverged = false, reflectance = 0, samples = 0, transmittance = 0 }, formatDiagnosticRatio) {
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
    if (samples < 20) {
      return {
        text: `Collecting monitor samples (${samples}). R/T will stabilize after a few wave periods.`,
        warning: false,
      };
    }
    const residual = Math.abs(balance);
    return {
      text: `R=${formatDiagnosticRatio(reflectance)}, T=${formatDiagnosticRatio(transmittance)}, residual=${formatDiagnosticRatio(balance)} from ${samples} samples.`,
      warning: residual > 0.25,
    };
  }

  function createResultsController({
    documentRef = global.document,
    el,
    formatDiagnosticRatio,
    formatFieldValue,
    measureCustomMonitors,
    monitorQuantityLabel,
  } = {}) {
    function updateRunState(isRunning) {
      setOutputText(el?.resultsStateOutput, isRunning ? "Running" : "Paused");
    }

    function updateInsight(diagnostics) {
      if (!el?.resultsInsightNote) return;
      const insight = resultsInsightText(diagnostics, formatDiagnosticRatio);
      el.resultsInsightNote.textContent = insight.text;
      el.resultsInsightNote.classList.toggle("is-warning", insight.warning);
    }

    function customMonitorResultsVisible() {
      if (!el?.customMonitorResults) return false;
      if (el.customMonitorResults.closest("[hidden]")) return false;
      return el.customMonitorResults.getClientRects().length > 0;
    }

    function renderCustomMonitorResults({ force = false, monitorCount = 0 } = {}) {
      if (!el?.customMonitorResults) return;
      if (!force && !customMonitorResultsVisible()) return;
      el.customMonitorResults.replaceChildren();
      if (monitorCount <= 0) {
        const note = documentRef.createElement("p");
        note.className = "results-insight-note";
        note.textContent = "Right-click the canvas to add a monitor.";
        el.customMonitorResults.appendChild(note);
        return;
      }

      const measurements = measureCustomMonitors?.() || [];
      measurements.forEach((measurement) => {
        const monitor = measurement.monitor;
        const card = documentRef.createElement("article");
        card.className = "custom-monitor-card";

        const header = documentRef.createElement("header");
        const title = documentRef.createElement("h3");
        title.textContent = `M${monitor.id}`;
        const kind = documentRef.createElement("span");
        kind.className = "monitor-kind";
        kind.textContent = monitorQuantityLabel(monitor.quantity);
        header.append(title, kind);

        const grid = documentRef.createElement("div");
        grid.className = "diagnostics-grid";
        [
          ["Value", formatFieldValue(measurement.value)],
          ["Mean", formatFieldValue(measurement.mean)],
          ["Mean |F|", formatFieldValue(measurement.magnitude)],
          ["RMS", formatFieldValue(measurement.rms)],
          ["Flux n", formatFieldValue(measurement.normalFlux)],
          ["Flux t", formatFieldValue(measurement.tangentFlux)],
          ["Samples", String(measurement.samples)],
        ].forEach(([label, value]) => {
          grid.appendChild(createMetricNode(documentRef, label, value));
        });

        card.append(header, grid);
        el.customMonitorResults.appendChild(card);
      });
    }

    function updateDiagnostics({
      angleText,
      balance,
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
    }) {
      setOutputText(el?.summaryReflectanceOutput, formatDiagnosticRatio(reflectance));
      setOutputText(el?.summaryTransmittanceOutput, formatDiagnosticRatio(transmittance));
      setOutputText(el?.summaryBalanceOutput, formatDiagnosticRatio(balance));
      setOutputText(el?.summaryAngleOutput, angleText);
      updateInsight({ balance, diagnosticsEnabled, lastDiverged, reflectance, samples, transmittance });
      setOutputText(el?.fluxLeftOutput, formatFieldValue(incidentPower || 0));
      setOutputText(el?.diagnosticAngleOutput, angleText);
      setOutputText(el?.reflectedPowerOutput, formatFieldValue(reflectedPower || 0));
      setOutputText(el?.fluxRightOutput, formatFieldValue(transmittedPower || 0));
      setOutputText(el?.reflectanceOutput, formatDiagnosticRatio(reflectance));
      setOutputText(el?.transmittanceOutput, formatDiagnosticRatio(transmittance));
      renderCustomMonitorResults({ monitorCount });
      setOutputText(el?.engineValue, engineText);
    }

    return {
      customMonitorResultsVisible,
      renderCustomMonitorResults,
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
