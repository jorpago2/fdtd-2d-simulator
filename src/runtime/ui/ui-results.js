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

  function observableStatusLabel(status) {
    return {
      ok: "validated",
      caution: "check",
      pending: "pending",
      info: "reference",
    }[status] || "reference";
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
    buildSceneObservables,
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

    function renderSceneObservables() {
      if (!el?.sceneObservableResults || typeof buildSceneObservables !== "function") return;
      const report = buildSceneObservables() || {};
      const rows = Array.isArray(report.rows) ? report.rows : [];
      el.sceneObservableResults.replaceChildren();
      if (rows.length === 0) {
        const note = documentRef.createElement("p");
        note.className = "results-insight-note";
        note.textContent = report.note || "Run the simulation to collect scene observables.";
        el.sceneObservableResults.appendChild(note);
        return;
      }

      const card = documentRef.createElement("article");
      card.className = "scene-observable-card";
      card.dataset.healthLevel = report.status || "info";

      const header = documentRef.createElement("header");
      const title = documentRef.createElement("h3");
      title.textContent = report.title || "Scene observables";
      const status = documentRef.createElement("span");
      status.className = "scene-observable-status";
      status.dataset.healthLevel = report.status || "info";
      status.textContent = observableStatusLabel(report.status);
      header.append(title, status);

      const note = documentRef.createElement("p");
      note.className = "results-insight-note";
      note.textContent = report.note || "Measured quantities are compared with compact scene-specific references.";

      const list = documentRef.createElement("div");
      list.className = "scene-observable-list";
      rows.forEach((item) => {
        const rowNode = documentRef.createElement("div");
        rowNode.className = "scene-observable-row";
        rowNode.dataset.healthLevel = item.level || "info";

        const metric = documentRef.createElement("span");
        metric.className = "scene-observable-metric";
        metric.textContent = item.metric || "Observable";

        const values = documentRef.createElement("output");
        values.className = "scene-observable-values";
        const parts = [
          item.measured ? `measured: ${item.measured}` : null,
          item.expected ? `reference: ${item.expected}` : null,
          item.error && item.error !== "-" ? item.error : null,
        ].filter(Boolean);
        values.textContent = parts.join(" | ");

        rowNode.append(metric, values);
        if (item.note) {
          const rowNote = documentRef.createElement("small");
          rowNote.textContent = item.note;
          rowNode.appendChild(rowNote);
        }
        list.appendChild(rowNode);
      });

      card.append(header, note, list);
      el.sceneObservableResults.appendChild(card);
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
      renderSceneObservables();
      renderCustomMonitorResults({ monitorCount });
      setOutputText(el?.engineValue, engineText);
    }

    return {
      customMonitorResultsVisible,
      renderCustomMonitorResults,
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
