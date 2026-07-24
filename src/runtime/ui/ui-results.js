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

  function maxwellStatusLabel(status) {
    return {
      ok: "verified",
      caution: "inspect",
      unstable: "mismatch",
      pending: "pending",
      off: "off",
    }[status] || "pending";
  }

  function formatMaxwellResidual(value) {
    if (!Number.isFinite(value)) return "n/a";
    if (value === 0) return "0";
    const magnitude = Math.abs(value);
    if (magnitude < 1e-3 || magnitude >= 10) return value.toExponential(2);
    return value.toPrecision(3);
  }

  function formatMaxwellCount(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "0";
    return Math.round(number).toLocaleString("en-US");
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
    maxwellCheckReport,
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

    function renderMaxwellCheckResults({ maxwellCheckEnabled = false } = {}) {
      if (!el?.maxwellCheckResults) return;
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
      const enabled = Boolean(maxwellCheckEnabled || report.enabled);
      if (el.maxwellCheckInput) el.maxwellCheckInput.checked = enabled;
      el.maxwellCheckResults.replaceChildren();

      if (!enabled) {
        const note = documentRef.createElement("p");
        note.className = "results-insight-note";
        note.textContent = report.note || fallbackReport.note;
        el.maxwellCheckResults.appendChild(note);
        return;
      }

      const rows = Array.isArray(report.rows) ? report.rows : [];
      if (rows.length === 0) {
        const note = documentRef.createElement("p");
        note.className = "results-insight-note";
        note.textContent = report.note || "Run at least one step to compare the discrete Yee update against Maxwell curl equations.";
        el.maxwellCheckResults.appendChild(note);
        return;
      }

      const card = documentRef.createElement("article");
      card.className = "maxwell-check-card";
      card.dataset.healthLevel = report.status || "pending";

      const header = documentRef.createElement("header");
      const title = documentRef.createElement("h3");
      title.textContent = "Discrete residuals";
      const status = documentRef.createElement("span");
      status.className = "maxwell-check-status";
      status.dataset.healthLevel = report.status || "pending";
      status.textContent = maxwellStatusLabel(report.status);
      header.append(title, status);

      const meta = documentRef.createElement("p");
      meta.className = "results-insight-note";
      meta.textContent = [
        report.component || "Yee grid",
        `t=${formatMaxwellCount(report.time)}`,
        `${formatMaxwellCount(report.sampleCount)} samples`,
        `${formatMaxwellCount(report.skippedCount)} skipped`,
        `stride ${formatMaxwellCount(report.stride || 1)}`,
      ].join(" | ");

      const note = documentRef.createElement("p");
      note.className = "results-insight-note";
      note.textContent = report.note || "Residuals are normalized and sampled on regular interior cells.";

      const grid = documentRef.createElement("div");
      grid.className = "maxwell-equation-grid";
      rows.forEach((row) => {
        const rowCard = documentRef.createElement("article");
        rowCard.className = "maxwell-equation-card";
        rowCard.dataset.healthLevel = row.level || "pending";
        const residualWidth = `${Math.round(Math.max(0, Math.min(1, Number(row.bar) || 0)) * 1000) / 10}%`;
        rowCard.style.setProperty("--residual-width", residualWidth);

        const rowTitle = documentRef.createElement("h4");
        rowTitle.textContent = row.label || "Equation";

        const formula = documentRef.createElement("p");
        formula.className = "maxwell-equation-formula";
        formula.textContent = row.formula || "";

        const residual = documentRef.createElement("div");
        residual.className = "maxwell-residual-row";
        const residualLabel = documentRef.createElement("span");
        residualLabel.textContent = "normalized RMS";
        const residualValue = documentRef.createElement("output");
        residualValue.textContent = formatMaxwellResidual(row.residual);
        residual.append(residualLabel, residualValue);

        const peak = documentRef.createElement("div");
        peak.className = "maxwell-residual-row";
        const peakLabel = documentRef.createElement("span");
        peakLabel.textContent = "max local";
        const peakValue = documentRef.createElement("output");
        peakValue.textContent = formatMaxwellResidual(row.maxResidual);
        peak.append(peakLabel, peakValue);

        const bar = documentRef.createElement("div");
        bar.className = "maxwell-residual-bar";
        const fill = documentRef.createElement("span");
        fill.className = "maxwell-residual-fill";
        bar.appendChild(fill);

        rowCard.append(rowTitle, formula, residual, peak, bar);
        if (row.note) {
          const rowNote = documentRef.createElement("small");
          rowNote.textContent = row.note;
          rowCard.appendChild(rowNote);
        }
        grid.appendChild(rowCard);
      });

      card.append(header, meta, note, grid);
      el.maxwellCheckResults.appendChild(card);
    }

    function renderCustomMonitorResults({ force = false, monitorCount = 0 } = {}) {
      if (!el?.customMonitorResults) return;
      if (!force && !customMonitorResultsVisible()) return;
      el.customMonitorResults.replaceChildren();
      if (monitorCount <= 0) {
        const note = documentRef.createElement("p");
        note.className = "results-insight-note";
        note.textContent = "Right-click or long-press the canvas to add a monitor.";
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
      maxwellCheckEnabled,
    }) {
      const monitorDataReady = diagnosticsEnabled && samples > 0 && !lastDiverged;
      setOutputText(el?.summaryReflectanceOutput, monitorDataReady ? formatDiagnosticRatio(reflectance) : "\u2014");
      setOutputText(el?.summaryTransmittanceOutput, monitorDataReady ? formatDiagnosticRatio(transmittance) : "\u2014");
      setOutputText(el?.summaryBalanceOutput, monitorDataReady ? formatDiagnosticRatio(balance) : "\u2014");
      setOutputText(el?.summaryAngleOutput, angleText);
      updateInsight({ balance, diagnosticsEnabled, lastDiverged, reflectance, samples, transmittance });
      setOutputText(el?.fluxLeftOutput, monitorDataReady ? formatFieldValue(incidentPower || 0) : "\u2014");
      setOutputText(el?.diagnosticAngleOutput, angleText);
      setOutputText(el?.reflectedPowerOutput, monitorDataReady ? formatFieldValue(reflectedPower || 0) : "\u2014");
      setOutputText(el?.fluxRightOutput, monitorDataReady ? formatFieldValue(transmittedPower || 0) : "\u2014");
      setOutputText(el?.reflectanceOutput, monitorDataReady ? formatDiagnosticRatio(reflectance) : "\u2014");
      setOutputText(el?.transmittanceOutput, monitorDataReady ? formatDiagnosticRatio(transmittance) : "\u2014");
      renderSceneObservables();
      renderMaxwellCheckResults({ maxwellCheckEnabled });
      renderCustomMonitorResults({ monitorCount });
      setOutputText(el?.engineValue, engineText);
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
