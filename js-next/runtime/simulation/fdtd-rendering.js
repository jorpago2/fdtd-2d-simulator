"use strict";

const LIVE_RENDER_SCALE_INTERVAL_FRAMES = 6;

Object.assign(FDTDSim.prototype, {
fieldRenderScale() {
  this.renormalizeFields();
  const physicalScale = this.fieldPhysicalScale();
  const physicalLogScale = this.fieldPhysicalLogScale();
  const cacheKey = [
    state.viewMode,
    state.fieldDisplay,
    state.fieldComponent,
    this.fieldLog10Scale,
    this.renormalizedCount,
  ].join("|");

  if (
    state.running &&
    state.autoScale &&
    this.liveRenderScaleCache?.key === cacheKey &&
    this.liveRenderScaleCache.framesUntilRefresh > 0
  ) {
    this.liveRenderScaleCache.framesUntilRefresh -= 1;
    this.lastViewRange = this.liveRenderScaleCache.lastViewRange;
    this.lastViewRangeLog10 = this.liveRenderScaleCache.lastViewRangeLog10;
    return this.liveRenderScaleCache.scale;
  }

  let maxAbs = state.autoScale ? 0 : this.lastMax / Math.max(physicalScale, 1e-300);
  if (state.autoScale) {
    maxAbs = 0;
    if (state.viewMode !== "poynting" && state.fieldDisplay === "scalar") {
      const scalarField = this.ez;
      for (let i = 0; i < this.n; i += 1) {
        const value = Math.abs(scalarField[i]);
        if (value > maxAbs) maxAbs = value;
      }
    } else {
      for (let i = 0; i < this.n; i += 1) {
        const value = Math.abs(this.fieldValueAt(i));
        if (value > maxAbs) maxAbs = value;
      }
    }
  }
  const scale = state.autoScale ? 0.94 / Math.max(0.02, maxAbs) : state.gain * physicalScale;
  this.lastViewRangeLog10 = state.autoScale
    ? Math.log10(1 / Math.max(scale, 1e-300)) + physicalLogScale
    : Math.log10(1 / Math.max(state.gain, 1e-300));
  this.lastViewRange = this.lastViewRangeLog10 < 300 ? Math.pow(10, this.lastViewRangeLog10) : Infinity;
  this.liveRenderScaleCache =
    state.running && state.autoScale
      ? {
          key: cacheKey,
          scale,
          lastViewRange: this.lastViewRange,
          lastViewRangeLog10: this.lastViewRangeLog10,
          framesUntilRefresh: LIVE_RENDER_SCALE_INTERVAL_FRAMES - 1,
        }
      : null;
  return scale;
},

renderFieldImage(data) {
  const scale = this.fieldRenderScale();
  const isMagnitude = this.fieldDisplayIsMagnitude();
  const fieldMapName = currentFieldColormapName(isMagnitude);
  const colorLut = cmasherColorLut(fieldMapName, !isMagnitude);
  const useScalarField = state.viewMode !== "poynting" && state.fieldDisplay === "scalar";
  const scalarField = this.ez;

  for (let i = 0; i < this.n; i += 1) {
    const value = useScalarField ? scalarField[i] : this.fieldValueAt(i);
    const rawMapped = Number.isFinite(value) ? value * scale : 0;
    const mapped = Number.isFinite(rawMapped)
      ? isMagnitude
        ? clamp(rawMapped, 0, 1)
        : clamp(rawMapped, -1, 1)
      : Math.sign(value || 0);
    const colorT = isMagnitude ? mapped : 0.5 + 0.5 * mapped;
    const colorIndex = clamp(Math.round(colorT * CMASHER_LUT_LAST), 0, CMASHER_LUT_LAST) * 3;
    let r = colorLut[colorIndex];
    let g = colorLut[colorIndex + 1];
    let b = colorLut[colorIndex + 2];

    if (this.material[i] === 1) {
      r = Math.round(r * 0.78 + 36);
      g = Math.round(g * 0.78 + 62);
      b = Math.round(b * 0.78 + 42);
    } else if (this.material[i] === 2) {
      r = 8;
      g = 11;
      b = 13;
    } else if (this.material[i] === 3) {
      r = Math.round(r * 0.72 + 92);
      g = Math.round(g * 0.72 + 48);
      b = Math.round(b * 0.72 + 12);
    } else if (this.material[i] === 4) {
      r = Math.round(r * 0.52 + 18);
      g = Math.round(g * 0.52 + 24);
      b = Math.round(b * 0.52 + 74);
    } else if (this.material[i] === 5) {
      r = Math.round(r * 0.84 + 26);
      g = Math.round(g * 0.84 + 42);
      b = Math.round(b * 0.84 + 52);
    }

    const p = i * 4;
    data[p] = r;
    data[p + 1] = g;
    data[p + 2] = b;
    data[p + 3] = 255;
  }
},

surfaceFieldColor(mapped, shade = 1) {
  const magnitude = this.fieldDisplayIsMagnitude();
  const [r, g, b] = cmasherColor(currentFieldColormapName(magnitude), mapped, shade, !magnitude);
  return `rgb(${clamp(r, 0, 255)}, ${clamp(g, 0, 255)}, ${clamp(b, 0, 255)})`;
},

materialViewContext() {
  const showingMu = state.viewMode === "mu";
  const values = showingMu
    ? state.materialPart === "imag"
      ? this.muLoss
      : this.mu
    : state.materialPart === "imag"
      ? this.loss
      : this.eps;
  const center = state.materialPart === "imag" ? 0 : 1;
  const minimumRange = state.materialPart === "imag" ? 0.001 : 0.25;
  let minValue = Infinity;
  let maxValue = -Infinity;
  for (let i = 0; i < this.n; i += 1) {
    const value = values[i];
    if (!Number.isFinite(value)) continue;
    if (value < minValue) minValue = value;
    if (value > maxValue) maxValue = value;
  }
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    minValue = center;
    maxValue = center;
  }
  let min = Math.min(minValue, center);
  let max = Math.max(maxValue, center);
  if (max - min < minimumRange) {
    min = center - minimumRange;
    max = center + minimumRange;
  }
  this.lastMaterialViewCenter = center;
  this.lastMaterialViewMin = min;
  this.lastMaterialViewMax = max;
  return { values, center, min, max };
},

materialMappedValue(value, context) {
  let rawMapped = 0;
  if (Number.isFinite(value)) {
    rawMapped =
      value >= context.center
        ? context.max === context.center
          ? 0
          : (value - context.center) / (context.max - context.center)
        : context.min === context.center
          ? 0
          : (value - context.center) / (context.center - context.min);
  }
  return Number.isFinite(rawMapped) ? clamp(rawMapped, -1, 1) : Math.sign(value || 0);
},

materialSurfaceColor(mapped, shade = 1, materialContext = null) {
  const context = materialContext || this.materialViewContext();
  const materialMapName = currentMaterialColormapName(context);
  const materialMapSigned = state.materialPart === "imag" || (context.min < context.center && context.max > context.center);
  const [r, g, b] = cmasherColor(materialMapName, materialMapSigned ? mapped : 0.5 + 0.5 * mapped, shade, materialMapSigned);
  return `rgb(${clamp(r, 0, 255)}, ${clamp(g, 0, 255)}, ${clamp(b, 0, 255)})`;
},

surfaceRenderContext() {
  if (state.viewMode === "epsilon" || state.viewMode === "mu") {
    return { kind: "material", material: this.materialViewContext() };
  }
  return { kind: "field", scale: this.fieldRenderScale() };
},

surfaceSample(x, y, context) {
  const sx = Math.max(0, Math.min(this.nx - 1, Math.floor(x)));
  const sy = Math.max(0, Math.min(this.ny - 1, Math.floor(y)));
  const i = this.id(sx, sy);
  let mapped;
  if (context.kind === "material") {
    mapped = this.materialMappedValue(context.material.values[i], context.material);
  } else {
    const value = this.fieldValueAt(i);
    const rawMapped = Number.isFinite(value) ? value * context.scale : 0;
    mapped = Number.isFinite(rawMapped)
      ? this.fieldDisplayIsMagnitude()
        ? clamp(rawMapped, 0, 1)
        : clamp(rawMapped, -1, 1)
      : Math.sign(value || 0);
  }
  return { mapped, material: this.material[i] };
},

surfaceColor(mapped, shade, context) {
  return context.kind === "material" ? this.materialSurfaceColor(mapped, shade, context.material) : this.surfaceFieldColor(mapped, shade);
},

projectSurfacePoint(x, y, mapped, dims) {
  const u = (x - this.viewX) / this.visibleGridWidth() - 0.5;
  const v = (y - this.viewY) / this.visibleGridHeight() - 0.5;
  return {
    x: dims.cx + u * dims.planeW + v * dims.skewW,
    y: dims.cy + v * dims.planeH - mapped * dims.heightScale,
  };
},

renderSurfaceField() {
  const ctx = this.ctx;
  const w = this.canvas.width;
  const h = this.canvas.height;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const surfaceContext = this.surfaceRenderContext();
  const background = ctx.createLinearGradient(0, 0, 0, h);
  background.addColorStop(0, "rgb(3, 5, 9)");
  background.addColorStop(0.58, "rgb(7, 8, 13)");
  background.addColorStop(1, "rgb(0, 0, 0)");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);

  const viewW = this.visibleGridWidth();
  const viewH = this.visibleGridHeight();
  const targetCols = clampInt(w / (13 * dpr), 42, 96);
  const targetRows = clampInt(h / (12 * dpr), 32, 72);
  const stepX = Math.max(1, Math.ceil(viewW / targetCols));
  const stepY = Math.max(1, Math.ceil(viewH / targetRows));
  const x0 = this.viewX;
  const y0 = this.viewY;
  const x1 = this.viewX + viewW;
  const y1 = this.viewY + viewH;
  const xs = [];
  const ys = [];

  for (let x = x0; x < x1; x += stepX) xs.push(Math.min(x, this.nx));
  if (xs.length === 0 || xs[xs.length - 1] < x1) xs.push(Math.min(x1, this.nx));
  for (let y = y0; y < y1; y += stepY) ys.push(Math.min(y, this.ny));
  if (ys.length === 0 || ys[ys.length - 1] < y1) ys.push(Math.min(y1, this.ny));

  const dims = {
    cx: w * 0.48,
    cy: h * 0.63,
    planeW: w * 0.78,
    planeH: h * 0.5,
    skewW: w * 0.18,
    heightScale: clamp(Math.min(w, h) * 0.2, 28 * dpr, 116 * dpr),
  };

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(0.65 * dpr, 0.8);
  for (let row = 0; row < ys.length - 1; row += 1) {
    const rowLight = 0.86 + (row / Math.max(1, ys.length - 2)) * 0.12;
    for (let col = 0; col < xs.length - 1; col += 1) {
      const p00 = this.surfaceSample(xs[col], ys[row], surfaceContext);
      const p10 = this.surfaceSample(xs[col + 1], ys[row], surfaceContext);
      const p11 = this.surfaceSample(xs[col + 1], ys[row + 1], surfaceContext);
      const p01 = this.surfaceSample(xs[col], ys[row + 1], surfaceContext);
      const avg = (p00.mapped + p10.mapped + p11.mapped + p01.mapped) * 0.25;
      const slope =
        Math.abs((p10.mapped + p11.mapped - p00.mapped - p01.mapped) * 0.5) +
        Math.abs((p01.mapped + p11.mapped - p00.mapped - p10.mapped) * 0.5);
      const shade = clamp(rowLight - slope * 0.12 + Math.max(0, avg) * 0.08, 0.62, 1.08);
      const allPec = p00.material === 2 && p10.material === 2 && p11.material === 2 && p01.material === 2;
      const q00 = this.projectSurfacePoint(xs[col], ys[row], p00.mapped, dims);
      const q10 = this.projectSurfacePoint(xs[col + 1], ys[row], p10.mapped, dims);
      const q11 = this.projectSurfacePoint(xs[col + 1], ys[row + 1], p11.mapped, dims);
      const q01 = this.projectSurfacePoint(xs[col], ys[row + 1], p01.mapped, dims);

      ctx.beginPath();
      ctx.moveTo(q00.x, q00.y);
      ctx.lineTo(q10.x, q10.y);
      ctx.lineTo(q11.x, q11.y);
      ctx.lineTo(q01.x, q01.y);
      ctx.closePath();
      ctx.fillStyle = allPec ? "rgb(7, 8, 11)" : this.surfaceColor(avg, shade, surfaceContext);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 244, 170, ${0.035 + Math.abs(avg) * 0.04})`;
      ctx.stroke();
    }
  }

  const corners = [
    this.projectSurfacePoint(x0, y0, 0, dims),
    this.projectSurfacePoint(x1, y0, 0, dims),
    this.projectSurfacePoint(x1, y1, 0, dims),
    this.projectSurfacePoint(x0, y1, 0, dims),
  ];
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = Math.max(1 * dpr, 1);
  ctx.stroke();
  ctx.restore();
},

renderMaterialImage(data) {
  const materialContext = this.materialViewContext();
  const materialMapName = currentMaterialColormapName(materialContext);
  const materialMapSigned = state.materialPart === "imag" || (materialContext.min < materialContext.center && materialContext.max > materialContext.center);
  const materialSpan = Math.max(1e-9, materialContext.max - materialContext.min);
  const colorLut = cmasherColorLut(materialMapName, materialMapSigned);

  for (let i = 0; i < this.n; i += 1) {
    const mapped = this.materialMappedValue(materialContext.values[i], materialContext);
    const normalized = (materialContext.values[i] - materialContext.min) / materialSpan;
    const colorT = materialMapSigned ? 0.5 + 0.5 * mapped : clamp(normalized, 0, 1);
    const colorIndex = clamp(Math.round(colorT * CMASHER_LUT_LAST), 0, CMASHER_LUT_LAST) * 3;
    let r = colorLut[colorIndex];
    let g = colorLut[colorIndex + 1];
    let b = colorLut[colorIndex + 2];

    if (this.material[i] === 2) {
      r = 8;
      g = 11;
      b = 13;
    }

    const p = i * 4;
    data[p] = r;
    data[p + 1] = g;
    data[p + 2] = b;
    data[p + 3] = 255;
  }
},

render() {
  this.fitCanvas();
  this.clampView();
  const viewport = this.renderViewport();
  const perf = window.fdtdPerformance;
  const canRecordRenderBreakdown = typeof perf?.record === "function" && typeof perf?.now === "function";
  let renderPhaseStart = canRecordRenderBreakdown ? perf.now() : 0;
  if (state.viewProjection === "3d") {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderSurfaceField();
    if (canRecordRenderBreakdown) {
      perf.record("renderMapMs", perf.now() - renderPhaseStart);
    }
    if (visualLayerEnabled("scale")) {
      this.drawScaleBarOverlay();
    }
    updateColorbar();
    if (!state.running) {
      updateMaterialWarning();
    }
    return;
  }

  const data = this.image.data;
  if (state.viewMode === "epsilon" || state.viewMode === "mu") {
    this.renderMaterialImage(data);
  } else {
    this.renderFieldImage(data);
  }
  if (canRecordRenderBreakdown) {
    perf.record("renderMapMs", perf.now() - renderPhaseStart);
    renderPhaseStart = perf.now();
  }

  this.offscreenCtx.putImageData(this.image, 0, 0);
  this.ctx.fillStyle = state.theme === "dark" ? "rgb(3, 8, 12)" : "rgb(235, 244, 248)";
  this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  this.ctx.imageSmoothingEnabled = false;
  this.ctx.drawImage(
    this.offscreen,
    this.viewX,
    this.viewY,
    this.visibleGridWidth(),
    this.visibleGridHeight(),
    viewport.left,
    viewport.top,
    viewport.width,
    viewport.height
  );
  if (canRecordRenderBreakdown) {
    perf.record("renderPresentMs", perf.now() - renderPhaseStart);
    renderPhaseStart = perf.now();
  }
  if (visualLayerEnabled("boundaries")) {
    this.drawCpmlOverlay();
  }
  if (visualLayerEnabled("monitors") || state.monitors?.length) {
    this.drawDiagnosticsOverlay();
  }
  this.drawMaterialHoverOverlay();
  this.drawMaterialSelectionOverlay();
  this.drawFieldQuiverOverlay();
  this.drawReferenceOverlay();
  if (visualLayerEnabled("sources")) {
    this.drawSourceMarkers();
  }
  if (canRecordRenderBreakdown) {
    perf.record("renderOverlayMs", perf.now() - renderPhaseStart);
  }
  updateColorbar();
  if (!state.running) {
    updateMaterialWarning();
  }
},

drawFieldQuiverOverlay() {
  if (!state.fieldQuiver || (state.viewMode !== "field" && state.viewMode !== "poynting") || state.viewProjection !== "2d") return;

  const ctx = this.ctx;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const viewport = this.renderViewport();
  const viewW = this.visibleGridWidth();
  const viewH = this.visibleGridHeight();
  const cols = clampInt(viewport.width / (58 * dpr), 8, 26);
  const rows = clampInt(viewport.height / (58 * dpr), 6, 22);
  const samples = [];
  let maxMag = 0;

  for (let row = 0; row < rows; row += 1) {
    const gy = this.viewY + ((row + 0.5) / rows) * viewH;
    const y = clampInt(Math.round(gy), 1, this.ny - 2);
    for (let col = 0; col < cols; col += 1) {
      const gx = this.viewX + ((col + 0.5) / cols) * viewW;
      const x = clampInt(Math.round(gx), 1, this.nx - 2);
      const idx = this.id(x, y);
      if (this.material[idx] === 2) continue;
      const vector = this.transverseVectorAt(idx);
      const mag = Math.hypot(vector.x, vector.y);
      if (!Number.isFinite(mag) || mag <= 0) continue;
      maxMag = Math.max(maxMag, mag);
      samples.push({ x, y, vx: vector.x, vy: vector.y, mag });
    }
  }

  if (maxMag <= 1e-12) return;

  const maxLength = clamp(Math.min(viewport.width / cols, viewport.height / rows) * 0.42, 8 * dpr, 22 * dpr);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const sample of samples) {
    const normalized = clamp(sample.mag / maxMag, 0, 1);
    if (normalized < 0.04) continue;
    const cx = this.gridToCanvasX(sample.x + 0.5);
    const cy = this.gridToCanvasY(sample.y + 0.5);
    const ux = sample.vx / sample.mag;
    const uy = -sample.vy / sample.mag;
    const length = maxLength * (0.28 + 0.72 * Math.sqrt(normalized));
    const x0 = cx - ux * length * 0.35;
    const y0 = cy - uy * length * 0.35;
    const x1 = cx + ux * length * 0.65;
    const y1 = cy + uy * length * 0.65;
    const head = Math.max(3.8 * dpr, length * 0.28);
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const alpha = 0.26 + 0.52 * normalized;

    ctx.lineWidth = Math.max(3.2 * dpr, 3);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.38 * alpha})`;
    this.strokeQuiverArrow(ctx, x0, y0, x1, y1, angle, head);
    ctx.lineWidth = Math.max(1.25 * dpr, 1);
    ctx.strokeStyle = `rgba(5, 13, 18, ${alpha})`;
    this.strokeQuiverArrow(ctx, x0, y0, x1, y1, angle, head);
  }
  ctx.restore();
},

strokeQuiverArrow(ctx, x0, y0, x1, y1, angle, head) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(angle - Math.PI / 7), y1 - head * Math.sin(angle - Math.PI / 7));
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(angle + Math.PI / 7), y1 - head * Math.sin(angle + Math.PI / 7));
  ctx.stroke();
},

});
