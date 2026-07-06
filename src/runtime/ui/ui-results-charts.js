(function initFdtdUiResultsCharts(global) {
  "use strict";

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function chartPalette(theme) {
    const dark = theme === "dark";
    return {
      dark,
      bg: dark ? "rgba(13, 17, 22, 0.62)" : "rgba(255, 255, 255, 0.46)",
      grid: dark ? "rgba(226, 236, 245, 0.12)" : "rgba(25, 43, 54, 0.12)",
      axis: dark ? "rgba(230, 238, 245, 0.72)" : "rgba(30, 42, 50, 0.68)",
      text: dark ? "rgba(235, 241, 246, 0.86)" : "rgba(22, 32, 40, 0.82)",
      muted: dark ? "rgba(224, 232, 238, 0.56)" : "rgba(51, 65, 74, 0.56)",
      blue: "rgb(13, 107, 245)",
      green: "rgb(18, 143, 91)",
      red: "rgb(220, 72, 92)",
      reference: "rgba(183, 106, 37, 0.88)",
      referenceAlt: "rgba(128, 86, 190, 0.82)",
    };
  }

  function prepareChartCanvas(canvas, minWidth = 260, minHeight = 130) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, global.devicePixelRatio || 1);
    const width = Math.max(minWidth, Math.round(rect.width > 0 ? rect.width * dpr : minWidth));
    const height = Math.max(minHeight, Math.round(rect.height > 0 ? rect.height * dpr : minHeight));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    return ctx ? { ctx, width, height, dpr } : null;
  }

  function canvasRelativePoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clampNumber(event.clientX - rect.left, 0, rect.width),
      y: clampNumber(event.clientY - rect.top, 0, rect.height),
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    };
  }

  function createResultsChartsController({
    el,
    formatDiagnosticRatio = (value) => String(value),
    formatFieldValue = (value) => String(value),
    formatSweepValue = (value) => String(value),
  } = {}) {
    function drawSweepChart({
      auxMetric = null,
      dualPolarization = false,
      emptyMessage = "Run a sweep to plot R and T",
      fresnelReflectance = null,
      latestReadout = "No sweep point",
      reference = null,
      results = [],
      sweepAxisLabel = "",
      sweepEnd = 1,
      sweepStart = 0,
      theme = "light",
      unitLabel = "",
    } = {}) {
      const canvas = el?.sweepChart;
      const prepared = prepareChartCanvas(canvas, 260, 140);
      if (!prepared) return;

      const { ctx, width, height, dpr } = prepared;
      const colors = chartPalette(theme);
      const rColor = colors.blue;
      const tColor = colors.green;
      const auxColor = colors.red;
      const padL = 42 * dpr;
      const padR = 16 * dpr;
      const padT = 18 * dpr;
      const padB = 32 * dpr;
      const plotW = Math.max(1, width - padL - padR);
      const plotH = Math.max(1, height - padT - padB);
      const branchResultsAvailable = results.some((point) => point.branch);
      const xValues = results.map((point) => point.x);
      const xMin = results.length ? Math.min(...xValues) : sweepStart;
      const xMax = results.length ? Math.max(...xValues) : sweepEnd;
      const ySeries = dualPolarization
        ? results.flatMap((point) => [point.rTm || 0, point.rTe || 0])
        : auxMetric
          ? auxMetric.only
            ? results.map((point) => point[auxMetric.key] || 0)
            : results.flatMap((point) => [point.t || 0, point[auxMetric.key] || 0])
          : results.flatMap((point) => [point.r || 0, point.t || 0]);
      const yMaxRaw = Math.max(1, ...ySeries);
      const auxOnlyMax = Math.max(1e-4, ...ySeries);
      const yMax = auxMetric?.only ? auxOnlyMax * 1.12 : yMaxRaw > 1.2 ? Math.ceil(yMaxRaw * 10) / 10 : 1;
      const toX = (value) => padL + ((value - xMin) / Math.max(1e-9, xMax - xMin)) * plotW;
      const toY = (value) => padT + plotH - (clampNumber(value, 0, yMax) / yMax) * plotH;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = Math.max(1, dpr);
      ctx.beginPath();
      for (let i = 0; i <= 4; i += 1) {
        const y = padT + (plotH * i) / 4;
        ctx.moveTo(padL, y);
        ctx.lineTo(width - padR, y);
      }
      for (let i = 0; i <= 4; i += 1) {
        const x = padL + (plotW * i) / 4;
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
      }
      ctx.stroke();

      ctx.strokeStyle = colors.axis;
      ctx.lineWidth = Math.max(1.2 * dpr, 1);
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, padT + plotH);
      ctx.lineTo(width - padR, padT + plotH);
      ctx.stroke();

      const drawReferenceCurve = (polarization, color) => {
        if (!reference || !fresnelReflectance) return;
        const samples = 120;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.3 * dpr, 1);
        ctx.setLineDash([5 * dpr, 4 * dpr]);
        ctx.beginPath();
        for (let i = 0; i < samples; i += 1) {
          const t = samples === 1 ? 0 : i / (samples - 1);
          const angle = xMin + (xMax - xMin) * t;
          const x = toX(angle);
          const y = toY(fresnelReflectance(angle, reference.n1, reference.n2, polarization));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      };

      if (reference) {
        drawReferenceCurve("tm", colors.reference);
        if (reference.comparePolarizations) {
          drawReferenceCurve("te", colors.referenceAlt);
        }
        if (reference.thetaB >= Math.min(xMin, xMax) && reference.thetaB <= Math.max(xMin, xMax)) {
          const xb = toX(reference.thetaB);
          ctx.save();
          ctx.strokeStyle = "rgba(183, 106, 37, 0.72)";
          ctx.lineWidth = Math.max(1.4 * dpr, 1);
          ctx.setLineDash([3 * dpr, 4 * dpr]);
          ctx.beginPath();
          ctx.moveTo(xb, padT);
          ctx.lineTo(xb, padT + plotH);
          ctx.stroke();
          ctx.fillStyle = colors.text;
          ctx.font = `${10 * dpr}px ui-sans-serif, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(`thetaB ${reference.thetaB.toFixed(1)}${unitLabel}`, xb, padT + 3 * dpr);
          ctx.restore();
        }
      }

      const drawSeries = (key, color) => {
        if (results.length === 0 || !results.some((point) => Number.isFinite(point[key]))) return;
        const groups = branchResultsAvailable
          ? [
              { name: "forward", dashed: false },
              { name: "reverse", dashed: true },
            ]
          : [{ name: "", dashed: false }];
        groups.forEach((group) => {
          const points = group.name ? results.filter((point) => point.branch === group.name) : results;
          if (!points.some((point) => Number.isFinite(point[key]))) return;
          ctx.save();
          ctx.strokeStyle = color;
          ctx.fillStyle = color;
          ctx.lineWidth = Math.max(2 * dpr, 1.5);
          if (group.dashed) ctx.setLineDash([5 * dpr, 4 * dpr]);
          ctx.beginPath();
          points.forEach((point, index) => {
            const x = toX(point.x);
            const y = toY(point[key]);
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
          ctx.setLineDash([]);
          points.forEach((point) => {
            if (!Number.isFinite(point[key])) return;
            ctx.beginPath();
            ctx.arc(toX(point.x), toY(point[key]), 2.6 * dpr, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.restore();
        });
      };

      if (dualPolarization) {
        drawSeries("rTm", rColor);
        drawSeries("rTe", tColor);
      } else if (auxMetric) {
        if (!auxMetric.only) drawSeries("t", tColor);
        drawSeries(auxMetric.key, auxColor);
      } else {
        drawSeries("r", rColor);
        drawSeries("t", tColor);
      }

      ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillStyle = colors.text;
      ctx.textAlign = "left";
      if (dualPolarization) {
        ctx.fillText("R_TM", padL + 8 * dpr, padT + 12 * dpr);
        ctx.fillStyle = rColor;
        ctx.fillRect(padL + 42 * dpr, padT + 8 * dpr, 14 * dpr, 3 * dpr);
        ctx.fillStyle = colors.text;
        ctx.fillText("R_TE", padL + 64 * dpr, padT + 12 * dpr);
        ctx.fillStyle = tColor;
        ctx.fillRect(padL + 98 * dpr, padT + 8 * dpr, 14 * dpr, 3 * dpr);
      } else if (auxMetric) {
        const labelX = auxMetric.only ? 8 : 48;
        if (!auxMetric.only) {
          ctx.fillText("T", padL + 8 * dpr, padT + 12 * dpr);
          ctx.fillStyle = tColor;
          ctx.fillRect(padL + 24 * dpr, padT + 8 * dpr, 14 * dpr, 3 * dpr);
          ctx.fillStyle = colors.text;
        }
        ctx.fillText(auxMetric.label, padL + labelX * dpr, padT + 12 * dpr);
        ctx.fillStyle = auxColor;
        ctx.fillRect(padL + (labelX + 24) * dpr, padT + 8 * dpr, 14 * dpr, 3 * dpr);
      } else {
        ctx.fillText("R", padL + 8 * dpr, padT + 12 * dpr);
        ctx.fillStyle = rColor;
        ctx.fillRect(padL + 24 * dpr, padT + 8 * dpr, 14 * dpr, 3 * dpr);
        ctx.fillStyle = colors.text;
        ctx.fillText("T", padL + 48 * dpr, padT + 12 * dpr);
        ctx.fillStyle = tColor;
        ctx.fillRect(padL + 64 * dpr, padT + 8 * dpr, 14 * dpr, 3 * dpr);
      }

      if (reference) {
        ctx.fillStyle = colors.text;
        const refX = dualPolarization ? 124 : 88;
        ctx.fillText("TM ref", padL + refX * dpr, padT + 12 * dpr);
        ctx.strokeStyle = colors.reference;
        ctx.lineWidth = Math.max(1.3 * dpr, 1);
        ctx.setLineDash([5 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(padL + (refX + 42) * dpr, padT + 10 * dpr);
        ctx.lineTo(padL + (refX + 58) * dpr, padT + 10 * dpr);
        ctx.stroke();
        ctx.setLineDash([]);
        if (reference.comparePolarizations) {
          ctx.fillStyle = colors.text;
          ctx.fillText("TE ref", padL + (refX + 70) * dpr, padT + 12 * dpr);
          ctx.strokeStyle = colors.referenceAlt;
          ctx.setLineDash([5 * dpr, 4 * dpr]);
          ctx.beginPath();
          ctx.moveTo(padL + (refX + 112) * dpr, padT + 10 * dpr);
          ctx.lineTo(padL + (refX + 128) * dpr, padT + 10 * dpr);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      if (branchResultsAvailable) {
        ctx.fillStyle = colors.text;
        ctx.textAlign = "right";
        ctx.fillText("solid forward / dashed reverse", width - padR, padT + 12 * dpr);
      }
      ctx.fillStyle = colors.text;
      ctx.textAlign = "right";
      ctx.fillText(auxMetric?.only ? formatDiagnosticRatio(yMax) : yMax.toFixed(yMax > 1 ? 1 : 0), padL - 7 * dpr, padT + 2 * dpr);
      ctx.fillText("0", padL - 7 * dpr, padT + plotH);
      ctx.textAlign = "center";
      ctx.fillText(sweepAxisLabel, padL + plotW / 2, height - 12 * dpr);

      if (results.length === 0) {
        ctx.fillStyle = colors.muted;
        ctx.fillText(emptyMessage, padL + plotW / 2, padT + plotH / 2);
      }
      if (el?.sweepChartReadout) {
        el.sweepChartReadout.textContent = latestReadout;
      }
    }

    function sweepReadoutText({ canvas, event, results = [], modeLabel = "" } = {}) {
      if (!canvas || results.length === 0) return "No sweep point";
      const point = canvasRelativePoint(canvas, event);
      const xs = results.map((result) => result.x);
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const xValue = xMin + (point.x / point.width) * Math.max(1e-9, xMax - xMin);
      let nearest = results[0];
      let bestDistance = Infinity;
      for (const result of results) {
        const distance = Math.abs(result.x - xValue);
        if (distance < bestDistance) {
          bestDistance = distance;
          nearest = result;
        }
      }
      return [
        `${modeLabel}=${formatSweepValue(nearest.x)}`,
        Number.isFinite(nearest.r) ? `R=${formatDiagnosticRatio(nearest.r)}` : null,
        Number.isFinite(nearest.t) ? `T=${formatDiagnosticRatio(nearest.t)}` : null,
        nearest.branch ? nearest.branch : null,
      ]
        .filter(Boolean)
        .join(" | ");
    }

    function drawSpectrumChart({ maxFrequency = 0.1, portSpectrum = null, sampleEvery = 1, theme = "light", values = [] } = {}) {
      const prepared = prepareChartCanvas(el?.spectrumChart, 260, 126);
      if (!prepared) return;
      const { ctx, width, height, dpr } = prepared;
      const colors = chartPalette(theme);
      const padL = 38 * dpr;
      const padR = 14 * dpr;
      const padT = 22 * dpr;
      const padB = 28 * dpr;
      const plotW = Math.max(1, width - padL - padR);
      const plotH = Math.max(1, height - padT - padB);
      const binCount = 44;
      const bins = [];
      let maxMag = 0;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, width, height);

      if (values.length >= 16) {
        const dt = Math.max(1, sampleEvery);
        for (let b = 0; b < binCount; b += 1) {
          const f = (maxFrequency * b) / (binCount - 1);
          let re = 0;
          let im = 0;
          for (let n = 0; n < values.length; n += 1) {
            const windowValue = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / Math.max(1, values.length - 1));
            const phase = 2 * Math.PI * f * dt * n;
            re += windowValue * values[n] * Math.cos(phase);
            im -= windowValue * values[n] * Math.sin(phase);
          }
          const mag = Math.hypot(re, im) / values.length;
          if (mag > maxMag) maxMag = mag;
          bins.push({ f, mag });
        }
      }

      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = Math.max(1, dpr);
      ctx.beginPath();
      for (let i = 0; i <= 4; i += 1) {
        const y = padT + (plotH * i) / 4;
        ctx.moveTo(padL, y);
        ctx.lineTo(width - padR, y);
      }
      for (let i = 0; i <= 4; i += 1) {
        const x = padL + (plotW * i) / 4;
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
      }
      ctx.stroke();

      ctx.strokeStyle = colors.axis;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, padT + plotH);
      ctx.lineTo(width - padR, padT + plotH);
      ctx.stroke();

      const referenceActive = Boolean(portSpectrum?.reference?.active);
      const portPoints = Array.isArray(portSpectrum?.points) ? portSpectrum.points.filter((point) => point?.valid) : [];
      const plottedPortPoints = referenceActive
        ? portPoints
            .filter((point) => point.referenceNormalized?.valid)
            .map((point) => ({
              ...point,
              reflectance: point.referenceNormalized.reflectance,
              transmittance: point.referenceNormalized.transmittance,
              absorption: point.referenceNormalized.absorption,
            }))
        : portPoints;
      if (plottedPortPoints.length > 0) {
        const fMin = Math.min(...plottedPortPoints.map((point) => point.frequency));
        const fMax = Math.max(...plottedPortPoints.map((point) => point.frequency));
        const yMax = Math.max(
          1,
          ...plottedPortPoints.map((point) => Math.max(point.reflectance || 0, point.transmittance || 0, point.absorption || 0)),
        );
        const xFor = (frequency) => padL + ((frequency - fMin) / Math.max(1e-9, fMax - fMin)) * plotW;
        const yFor = (value) => padT + plotH - (clampNumber(value, 0, yMax) / yMax) * plotH;
        const drawCurve = (key, color) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(2 * dpr, 1.5);
          ctx.beginPath();
          plottedPortPoints.forEach((point, index) => {
            const x = xFor(point.frequency);
            const y = yFor(point[key]);
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
        };
        drawCurve("reflectance", colors.blue);
        drawCurve("transmittance", colors.green);
        drawCurve("absorption", colors.reference);
        ctx.fillStyle = colors.text;
        ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(referenceActive ? "Reference-normalized R/T/A" : "Line-port R/T/A", padL, 11 * dpr);
        ctx.fillStyle = colors.blue;
        ctx.fillText("R", width - padR - 58 * dpr, 11 * dpr);
        ctx.fillStyle = colors.green;
        ctx.fillText("T", width - padR - 38 * dpr, 11 * dpr);
        ctx.fillStyle = colors.reference;
        ctx.fillText("A", width - padR - 18 * dpr, 11 * dpr);
        ctx.fillStyle = colors.text;
        ctx.textAlign = "right";
        ctx.fillText(formatDiagnosticRatio(yMax), padL - 6 * dpr, padT + 2 * dpr);
        ctx.fillText("0", padL - 6 * dpr, padT + plotH);
        ctx.textAlign = "center";
        ctx.fillText("f", padL + plotW / 2, height - 11 * dpr);
      } else if (bins.length > 0 && maxMag > 1e-12) {
        ctx.strokeStyle = colors.blue;
        ctx.lineWidth = Math.max(2 * dpr, 1.5);
        ctx.beginPath();
        bins.forEach((bin, index) => {
          const x = padL + (bin.f / maxFrequency) * plotW;
          const db = Math.max(-54, 20 * Math.log10(bin.mag / maxMag));
          const y = padT + plotH - ((db + 54) / 54) * plotH;
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      } else {
        ctx.fillStyle = colors.muted;
        ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Collecting probe samples", padL + plotW / 2, padT + plotH / 2);
      }

      if (plottedPortPoints.length <= 0) {
        ctx.fillStyle = colors.text;
        ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText("Probe spectrum", padL, 11 * dpr);
        ctx.textAlign = "right";
        ctx.fillText("0 dB", padL - 6 * dpr, padT + 2 * dpr);
        ctx.fillText("-54", padL - 6 * dpr, padT + plotH);
        ctx.textAlign = "center";
        ctx.fillText("f", padL + plotW / 2, height - 11 * dpr);
      }
    }

    function drawFarFieldChart({ data = [], scatteringMode = false, scatteringTotalText = "", theme = "light" } = {}) {
      const prepared = prepareChartCanvas(el?.farFieldChart, 260, 126);
      if (!prepared) return;
      const { ctx, width, height, dpr } = prepared;
      const colors = chartPalette(theme);
      const cx = width * 0.5;
      const cy = height * 0.56;
      const radius = Math.min(width, height) * 0.34;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = Math.max(1, dpr);
      for (let r = 0.33; r <= 1.01; r += 0.33) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.stroke();

      if (data.length > 0) {
        ctx.fillStyle = theme === "dark" ? "rgba(13, 107, 245, 0.18)" : "rgba(13, 107, 245, 0.14)";
        ctx.strokeStyle = colors.blue;
        ctx.lineWidth = Math.max(2 * dpr, 1.5);
        ctx.beginPath();
        data.forEach((point, index) => {
          const r = radius * Math.sqrt(clampNumber(point.value, 0, 1));
          const x = cx + r * Math.cos(point.theta);
          const y = cy + r * Math.sin(point.theta);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = colors.muted;
        ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(scatteringMode ? "Collecting scattering phasors" : "Collecting NTFF contour phasors", cx, cy);
      }

      ctx.fillStyle = colors.text;
      ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(scatteringMode ? "Scattering width / lambda0" : "NTFF angular pattern", 12 * dpr, 11 * dpr);
      if (scatteringMode && scatteringTotalText) {
        ctx.fillStyle = colors.muted;
        ctx.textAlign = "right";
        ctx.fillText(`sigma/lambda0 ${scatteringTotalText}`, width - 12 * dpr, 11 * dpr);
        ctx.fillStyle = colors.text;
      }
      ctx.textAlign = "center";
      ctx.fillText("0 deg", cx + radius + 10 * dpr, cy);
      ctx.fillText("90 deg", cx, cy + radius + 12 * dpr);
    }

    function updateSpectrumReadout(event) {
      if (!el?.analysisChartReadout || !el?.spectrumChart) return;
      const point = canvasRelativePoint(el.spectrumChart, event);
      const f = clampNumber(point.x / point.width, 0, 1) * 0.1;
      const db = -54 + (1 - clampNumber(point.y / point.height, 0, 1)) * 54;
      el.analysisChartReadout.textContent = `Spectrum f=${formatFieldValue(f)} | ${db.toFixed(1)} dB`;
    }

    function updateFarFieldReadout(event, { scatteringMode = false } = {}) {
      if (!el?.analysisChartReadout || !el?.farFieldChart) return;
      const point = canvasRelativePoint(el.farFieldChart, event);
      const cx = point.width * 0.5;
      const cy = point.height * 0.56;
      const theta = (Math.atan2(point.y - cy, point.x - cx) * 180) / Math.PI;
      const normalized = ((theta % 360) + 360) % 360;
      el.analysisChartReadout.textContent = `${scatteringMode ? "Scattering" : "NTFF"} theta=${normalized.toFixed(1)} deg`;
    }

    return {
      canvasRelativePoint,
      chartPalette,
      drawFarFieldChart,
      drawSpectrumChart,
      drawSweepChart,
      prepareChartCanvas,
      sweepReadoutText,
      updateFarFieldReadout,
      updateSpectrumReadout,
    };
  }

  global.FdtdUiResultsCharts = Object.freeze({
    canvasRelativePoint,
    chartPalette,
    createResultsChartsController,
    prepareChartCanvas,
  });
})(window);
