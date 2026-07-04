(function initFdtdCanvasColorbar(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Canvas colorbar dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Canvas colorbar dependency must provide ${name}().`);
    }
    return value;
  }

  function formatLogValue(logValue) {
    if (logValue === -Infinity) return "0";
    if (!Number.isFinite(logValue)) return "overflow";
    const exponent = Math.floor(logValue);
    const mantissa = Math.pow(10, logValue - exponent);
    return `${mantissa.toFixed(2)}e${exponent >= 0 ? "+" : ""}${exponent}`;
  }

  function formatFieldMetric(value, logValue, formatFieldValue) {
    if (Number.isFinite(value)) return formatFieldValue(value);
    return formatLogValue(logValue);
  }

  function formatMaterialMapValue(value) {
    if (!Number.isFinite(value)) return "overflow";
    const abs = Math.abs(value);
    if (abs < 1e-9) return "0";
    if (abs >= 10000) return value.toExponential(2);
    if (abs >= 100) return value.toFixed(0);
    if (abs >= 10) return value.toFixed(1);
    if (abs >= 1) return value.toFixed(2);
    if (abs >= 0.01) return value.toFixed(3);
    return value.toExponential(1);
  }

  function formatSignedMaterialMapValue(value) {
    const formatted = formatMaterialMapValue(value);
    return value > 0 && formatted !== "0" && formatted !== "overflow" ? `+${formatted}` : formatted;
  }

  function htmlToText(documentRef, html) {
    const node = documentRef.createElement("span");
    node.innerHTML = html || "";
    return node.textContent.trim();
  }

  function createCanvasColorbarController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const sim = requireObject(dependencies.sim, "sim");
    const el = requireObject(dependencies.el, "el");
    const documentRef = requireObject(dependencies.documentRef || global.document, "documentRef");
    const windowRef = requireObject(dependencies.windowRef || global, "windowRef");
    const clamp = requireFunction(dependencies.clamp, "clamp");
    const visualLayerEnabled = requireFunction(dependencies.visualLayerEnabled, "visualLayerEnabled");
    const fieldDisplayConfig = requireFunction(dependencies.fieldDisplayConfig, "fieldDisplayConfig");
    const formatFieldValue = requireFunction(dependencies.formatFieldValue, "formatFieldValue");
    const cmasherGradient = requireFunction(dependencies.cmasherGradient, "cmasherGradient");
    const cmasherMap = requireFunction(dependencies.cmasherMap, "cmasherMap");
    const currentFieldColormapName = requireFunction(dependencies.currentFieldColormapName, "currentFieldColormapName");
    const currentMaterialColormapName = requireFunction(
      dependencies.currentMaterialColormapName,
      "currentMaterialColormapName",
    );

    let renderSignature = "";
    let currentSnapshot = null;

    function materialSnapshot() {
      const center = Number.isFinite(sim.lastMaterialViewCenter)
        ? sim.lastMaterialViewCenter
        : state.materialPart === "imag"
          ? 0
          : 1;
      const min = Number.isFinite(sim.lastMaterialViewMin) ? sim.lastMaterialViewMin : center - 1;
      const max = Number.isFinite(sim.lastMaterialViewMax) ? sim.lastMaterialViewMax : center + 1;
      const span = Math.max(1e-9, max - min);
      const centerStop = clamp(((max - center) / span) * 100, 0, 100);
      const formatBound = state.materialPart === "imag" ? formatSignedMaterialMapValue : formatMaterialMapValue;
      const symbol = state.viewMode === "mu" ? "&mu;" : "&epsilon;";
      const materialContext = { center, min, max };
      const mapName = currentMaterialColormapName(materialContext);
      const titleHtml = `${state.materialPart === "imag" ? "Im" : "Re"}(${symbol})`;
      let maxText;
      let midText;
      let minText;

      if (state.materialPart !== "imag" && !(min < center && max > center)) {
        maxText = formatBound(max);
        midText = formatBound((min + max) * 0.5);
        minText = formatBound(min);
      } else if (centerStop >= 99.9) {
        maxText = formatBound(max);
        midText = formatBound((max + center) * 0.5);
        minText = formatMaterialMapValue(center);
      } else if (centerStop <= 0.1) {
        maxText = formatMaterialMapValue(center);
        midText = formatBound((min + center) * 0.5);
        minText = formatBound(min);
      } else {
        maxText = formatBound(max);
        midText = formatMaterialMapValue(center);
        minText = formatBound(min);
      }

      return {
        epsilonMap: true,
        gradient: cmasherGradient(mapName),
        mapName,
        maxText,
        midText,
        minText,
        titleHtml,
      };
    }

    function fieldSnapshot() {
      const range = sim.lastViewRange || 1;
      const displayConfig = fieldDisplayConfig();
      const mapName = currentFieldColormapName(displayConfig.magnitude);
      const titleHtml = `${displayConfig.labelHtml} / ${displayConfig.unitHtml}`;
      let maxText;
      let midText;
      let minText;

      if (displayConfig.magnitude) {
        maxText = formatFieldMetric(range, sim.lastViewRangeLog10, formatFieldValue);
        midText = formatFieldMetric(range * 0.5, sim.lastViewRangeLog10 + Math.log10(0.5), formatFieldValue);
        minText = "0";
      } else {
        maxText = `+${formatFieldMetric(range, sim.lastViewRangeLog10, formatFieldValue)}`;
        midText = "0";
        minText = `-${formatFieldMetric(range, sim.lastViewRangeLog10, formatFieldValue)}`;
      }

      return {
        epsilonMap: false,
        gradient: cmasherGradient(mapName),
        mapName,
        maxText,
        midText,
        minText,
        titleHtml,
      };
    }

    function buildSnapshot() {
      if (state.viewMode === "epsilon" || state.viewMode === "mu") return materialSnapshot();
      return fieldSnapshot();
    }

    function applyDomSnapshot(snapshot) {
      const signature = [
        snapshot.titleHtml,
        snapshot.maxText,
        snapshot.midText,
        snapshot.minText,
        snapshot.gradient,
        snapshot.epsilonMap ? "material" : "field",
      ].join("|");

      if (signature === renderSignature && currentSnapshot) return currentSnapshot;
      renderSignature = signature;
      el.colorbarTitle.innerHTML = snapshot.titleHtml;
      el.colorbarMax.textContent = snapshot.maxText;
      el.colorbarMid.textContent = snapshot.midText;
      el.colorbarMin.textContent = snapshot.minText;
      el.colorbarGradient.style.background = snapshot.gradient;
      el.colorbarGradient.classList.toggle("is-epsilon-map", snapshot.epsilonMap);
      currentSnapshot = {
        ...snapshot,
        titleText: el.colorbarTitle.textContent.trim() || htmlToText(documentRef, snapshot.titleHtml),
      };
      return currentSnapshot;
    }

    function update() {
      if (!el.colorbar) return null;
      el.colorbar.hidden = !visualLayerEnabled("colorbar");
      if (el.colorbar.hidden) {
        renderSignature = "hidden";
        currentSnapshot = null;
        return null;
      }
      return applyDomSnapshot(buildSnapshot());
    }

    function exportSnapshot() {
      if (currentSnapshot) return currentSnapshot;
      const snapshot = buildSnapshot();
      return {
        ...snapshot,
        titleText: htmlToText(documentRef, snapshot.titleHtml),
      };
    }

    function drawExport(ctx, width, height) {
      const snapshot = exportSnapshot();
      const dpr = Math.max(1, windowRef.devicePixelRatio || 1);
      const barWidth = clamp(width * 0.058, 60 * dpr, 88 * dpr);
      const barHeight = clamp(height * 0.25, 136 * dpr, 220 * dpr);
      const margin = clamp(Math.min(width, height) * 0.025, 14 * dpr, 28 * dpr);
      const x = width - barWidth - margin;
      const y = Math.max(margin, (height - barHeight) / 2);
      const dark = state.theme === "dark";
      const panelColor = dark ? "rgba(12, 15, 20, 0.90)" : "rgba(255, 255, 255, 0.92)";
      const borderColor = dark ? "rgba(255, 255, 255, 0.20)" : "rgba(17, 26, 31, 0.18)";
      const textColor = dark ? "rgba(247, 251, 255, 0.96)" : "rgba(17, 26, 31, 0.96)";
      const titleFont = Math.max(10 * dpr, Math.min(15 * dpr, width * 0.014));
      const labelFont = Math.max(9 * dpr, Math.min(13 * dpr, width * 0.012));
      const pad = Math.max(9 * dpr, barWidth * 0.13);
      const titleHeight = titleFont * 1.25;
      const gradientTop = y + pad + titleHeight;
      const gradientHeight = barHeight - 2 * pad - titleHeight;
      const gradientWidth = Math.max(10 * dpr, barWidth * 0.24);
      const gradientX = x + pad;
      const radius = Math.max(8 * dpr, barWidth * 0.12);

      ctx.save();
      ctx.fillStyle = panelColor;
      if (typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = Math.max(1, dpr);
        ctx.stroke();
      } else {
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = Math.max(1, dpr);
        ctx.strokeRect(x, y, barWidth, barHeight);
      }

      const gradient = ctx.createLinearGradient(0, gradientTop, 0, gradientTop + gradientHeight);
      for (const stop of [...cmasherMap(snapshot.mapName).stops].reverse()) {
        gradient.addColorStop(clamp(1 - stop.t, 0, 1), `rgb(${stop.c[0]}, ${stop.c[1]}, ${stop.c[2]})`);
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(gradientX, gradientTop, gradientWidth, gradientHeight);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = Math.max(1, 0.8 * dpr);
      ctx.strokeRect(gradientX, gradientTop, gradientWidth, gradientHeight);

      ctx.fillStyle = textColor;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.font = `700 ${titleFont}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(snapshot.titleText || "", x + barWidth / 2, y + pad + titleFont * 0.55);

      ctx.textAlign = "left";
      ctx.font = `${labelFont}px ui-sans-serif, system-ui, sans-serif`;
      const labelX = gradientX + gradientWidth + Math.max(7 * dpr, barWidth * 0.08);
      ctx.fillText(snapshot.maxText || "", labelX, gradientTop + labelFont * 0.2);
      ctx.fillText(snapshot.midText || "", labelX, gradientTop + gradientHeight * 0.5);
      ctx.fillText(snapshot.minText || "", labelX, gradientTop + gradientHeight - labelFont * 0.2);
      ctx.restore();
    }

    return Object.freeze({
      buildSnapshot,
      drawExport,
      update,
    });
  }

  global.FdtdCanvasColorbar = Object.freeze({
    createCanvasColorbarController,
  });
})(window);
