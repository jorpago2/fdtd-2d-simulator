"use strict";

Object.assign(FDTDSim.prototype, {
fieldRenderScale() {
  this.renormalizeFields();
  let maxAbs = this.lastMax;
  if (state.autoScale || maxAbs === 0) {
    maxAbs = 0;
    for (let i = 0; i < this.n; i += 1) {
      const value = Math.abs(this.fieldValueAt(i));
      if (value > maxAbs) maxAbs = value;
    }
  } else {
    maxAbs = maxAbs / this.fieldPhysicalScale();
  }
  const scale = state.autoScale ? 0.94 / Math.max(0.02, maxAbs) : state.gain * this.fieldPhysicalScale();
  this.lastViewRangeLog10 = state.autoScale
    ? Math.log10(1 / Math.max(scale, 1e-300)) + this.fieldPhysicalLogScale()
    : Math.log10(1 / Math.max(state.gain, 1e-300));
  this.lastViewRange = this.lastViewRangeLog10 < 300 ? Math.pow(10, this.lastViewRangeLog10) : Infinity;
  return scale;
},

renderFieldImage(data) {
  const scale = this.fieldRenderScale();
  const isMagnitude = this.fieldDisplayIsMagnitude();

  for (let i = 0; i < this.n; i += 1) {
    const value = this.fieldValueAt(i);
    const rawMapped = Number.isFinite(value) ? value * scale : 0;
    const mapped = Number.isFinite(rawMapped)
      ? isMagnitude
        ? clamp(rawMapped, 0, 1)
        : clamp(rawMapped, -1, 1)
      : Math.sign(value || 0);
    let [r, g, b] = cmasherColor(currentFieldColormapName(isMagnitude), mapped, 1, !isMagnitude);

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

  for (let i = 0; i < this.n; i += 1) {
    const mapped = this.materialMappedValue(materialContext.values[i], materialContext);
    const normalized = (materialContext.values[i] - materialContext.min) / materialSpan;
    let [r, g, b] = cmasherColor(materialMapName, materialMapSigned ? mapped : normalized, 1, materialMapSigned);

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
  if (state.viewProjection === "3d") {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderSurfaceField();
    updateColorbar();
    updateMaterialWarning();
    return;
  }

  const data = this.image.data;
  if (state.viewMode === "epsilon" || state.viewMode === "mu") {
    this.renderMaterialImage(data);
  } else {
    this.renderFieldImage(data);
  }

  this.offscreenCtx.putImageData(this.image, 0, 0);
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  this.ctx.imageSmoothingEnabled = false;
  this.ctx.drawImage(
    this.offscreen,
    this.viewX,
    this.viewY,
    this.visibleGridWidth(),
    this.visibleGridHeight(),
    0,
    0,
    this.canvas.width,
    this.canvas.height
  );
  if (visualLayerEnabled("boundaries")) {
    this.drawPmlOverlay();
  }
  if (visualLayerEnabled("diagnostics")) {
    this.drawDiagnosticsOverlay();
  }
  this.drawMaterialHoverOverlay();
  this.drawMaterialSelectionOverlay();
  this.drawFieldQuiverOverlay();
  this.drawReferenceOverlay();
  if (visualLayerEnabled("sources")) {
    this.drawSourceMarkers();
  }
  updateColorbar();
  updateMaterialWarning();
},

drawMaterialSelectionOverlay() {
  if (!selectedMaterialRegion || selectedMaterialRegion.cells.length === 0) return;
  const rect = this.gridRectToCanvas(
    selectedMaterialRegion.bounds.minX,
    selectedMaterialRegion.bounds.minY,
    selectedMaterialRegion.bounds.maxX + 1,
    selectedMaterialRegion.bounds.maxY + 1
  );
  if (!rect) return;
  const ctx = this.ctx;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const isMoving = dragMaterialPointerId != null;
  ctx.save();
  ctx.fillStyle = isMoving ? "rgba(255, 178, 74, 0.16)" : "rgba(8, 124, 137, 0.12)";
  ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
  ctx.strokeStyle = isMoving ? "rgba(196, 112, 16, 0.95)" : "rgba(0, 52, 58, 0.92)";
  ctx.lineWidth = Math.max((isMoving ? 2.3 : 1.7) * dpr, 1);
  ctx.setLineDash(isMoving ? [] : [7 * dpr, 4 * dpr]);
  ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
  ctx.setLineDash([]);
  ctx.strokeStyle = isMoving ? "rgba(255, 238, 198, 0.72)" : "rgba(255, 255, 255, 0.58)";
  ctx.lineWidth = Math.max(1 * dpr, 1);
  ctx.strokeRect(rect.left + 3 * dpr, rect.top + 3 * dpr, Math.max(0, rect.width - 6 * dpr), Math.max(0, rect.height - 6 * dpr));
  ctx.fillStyle = isMoving ? "rgba(95, 52, 6, 0.9)" : "rgba(0, 52, 58, 0.86)";
  ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  const label = isMoving ? `moving · ${selectedMaterialRegion.cells.length} cells` : `${selectedMaterialRegion.cells.length} cells`;
  ctx.fillText(label, rect.left + 6 * dpr, Math.max(14 * dpr, rect.top - 5 * dpr));
  ctx.restore();
},

drawMaterialHoverOverlay() {
  if (!hoveredMaterialRegion || hoveredMaterialRegion.cells.length === 0) return;
  if (selectedMaterialRegion && materialRegionSignature(hoveredMaterialRegion) === materialRegionSignature(selectedMaterialRegion)) return;
  const rect = this.gridRectToCanvas(
    hoveredMaterialRegion.bounds.minX,
    hoveredMaterialRegion.bounds.minY,
    hoveredMaterialRegion.bounds.maxX + 1,
    hoveredMaterialRegion.bounds.maxY + 1
  );
  if (!rect) return;
  const ctx = this.ctx;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  ctx.save();
  ctx.fillStyle = "rgba(69, 192, 201, 0.08)";
  ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
  ctx.strokeStyle = "rgba(69, 192, 201, 0.78)";
  ctx.lineWidth = Math.max(1.25 * dpr, 1);
  ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
  ctx.fillStyle = "rgba(11, 31, 36, 0.84)";
  ctx.font = `${10.5 * dpr}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("material", rect.left + 6 * dpr, Math.max(13 * dpr, rect.top - 4 * dpr));
  ctx.restore();
},

drawPmlOverlay() {
  normalizeBoundarySides();

  const ctx = this.ctx;
  const w = this.canvas.width;
  const h = this.canvas.height;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const spacing = Math.max(8 * dpr, Math.min(w, h) / 40);
  const drawPmlRegion = (side, x0, y0, x1, y1) => {
    const rect = this.gridRectToCanvas(x0, y0, x1, y1);
    if (!rect) return;
    ctx.save();
    ctx.fillStyle = "rgba(0, 92, 102, 0.08)";
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
    ctx.beginPath();
    ctx.rect(rect.left, rect.top, rect.width, rect.height);
    ctx.clip();
    ctx.strokeStyle = "rgba(0, 92, 102, 0.36)";
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    const startX = Math.floor(rect.left / spacing) * spacing;
    const endX = rect.left + rect.width;
    const startY = Math.floor(rect.top / spacing) * spacing;
    const endY = rect.top + rect.height;
    for (let x = startX; x <= endX; x += spacing) {
      ctx.moveTo(x, rect.top);
      ctx.lineTo(x, rect.top + rect.height);
    }
    for (let y = startY; y <= endY; y += spacing) {
      ctx.moveTo(rect.left, y);
      ctx.lineTo(rect.left + rect.width, y);
    }
    ctx.stroke();
    if (rect.width > 36 * dpr && rect.height > 18 * dpr) {
      ctx.fillStyle = "rgba(0, 58, 64, 0.82)";
      ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PML", rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    ctx.restore();
  };

  const drawReflectiveEdge = (side) => {
    if (boundarySideIsAbsorbing(side)) return;
    const layer = Math.max(1, this.boundaryControlLayer());
    const metalCells = clampInt(Math.round(state.cellsPerWavelength * 0.14), 3, Math.max(3, Math.min(10, Math.floor(layer * 0.45))));
    const rect =
      side === "top"
        ? this.gridRectToCanvas(0, layer - metalCells, this.nx, layer)
        : side === "bottom"
          ? this.gridRectToCanvas(0, this.ny - layer, this.nx, this.ny - layer + metalCells)
          : side === "left"
            ? this.gridRectToCanvas(layer - metalCells, 0, layer, this.ny)
            : this.gridRectToCanvas(this.nx - layer, 0, this.nx - layer + metalCells, this.ny);
    if (!rect) return;
    const horizontal = side === "top" || side === "bottom";
    const metalGradient = horizontal
      ? ctx.createLinearGradient(rect.left, rect.top, rect.left, rect.top + rect.height)
      : ctx.createLinearGradient(rect.left, rect.top, rect.left + rect.width, rect.top);
    metalGradient.addColorStop(0, "rgba(255, 255, 255, 0.58)");
    metalGradient.addColorStop(0.18, "rgba(154, 164, 170, 0.7)");
    metalGradient.addColorStop(0.52, "rgba(42, 51, 58, 0.86)");
    metalGradient.addColorStop(1, "rgba(6, 10, 14, 0.92)");
    ctx.save();
    ctx.fillStyle = metalGradient;
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
    ctx.beginPath();
    ctx.rect(rect.left, rect.top, rect.width, rect.height);
    ctx.clip();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    const hatchSpacing = Math.max(7 * dpr, metalCells * dpr * 0.65);
    const hatchExtent = rect.width + rect.height;
    for (let p = -hatchExtent; p <= hatchExtent * 2; p += hatchSpacing) {
      ctx.moveTo(rect.left + p, rect.top + rect.height);
      ctx.lineTo(rect.left + p + rect.height, rect.top);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(3, 7, 10, 0.68)";
    ctx.lineWidth = Math.max(1.2 * dpr, 1);
    ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
    ctx.restore();
  };

  if (this.pmlLayer > 0) {
    const topInset = boundarySideIsAbsorbing("top") ? this.pmlLayer : 0;
    const bottomInset = boundarySideIsAbsorbing("bottom") ? this.pmlLayer : 0;
    if (boundarySideIsAbsorbing("top")) drawPmlRegion("top", 0, 0, this.nx, this.pmlLayer);
    if (boundarySideIsAbsorbing("bottom")) drawPmlRegion("bottom", 0, this.ny - this.pmlLayer, this.nx, this.ny);
    if (boundarySideIsAbsorbing("left")) drawPmlRegion("left", 0, topInset, this.pmlLayer, this.ny - bottomInset);
    if (boundarySideIsAbsorbing("right")) drawPmlRegion("right", this.nx - this.pmlLayer, topInset, this.nx, this.ny - bottomInset);
  }

  BOUNDARY_SIDES.forEach((side) => drawReflectiveEdge(side));

  const drawBoundaryInterfaceLine = (side) => {
    const layer = this.boundaryControlLayer();
    if (layer <= 0) return;
    const absorbing = boundarySideIsAbsorbing(side);
    ctx.save();
    ctx.strokeStyle = absorbing ? "rgba(0, 92, 102, 0.75)" : "rgba(3, 7, 10, 0.88)";
    ctx.lineWidth = Math.max(absorbing ? 1 : 1.35, dpr);
    ctx.setLineDash(absorbing ? [6 * dpr, 4 * dpr] : []);
    ctx.beginPath();
    if (side === "left") {
      const x = this.gridToCanvasX(layer);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    } else if (side === "right") {
      const x = this.gridToCanvasX(this.nx - layer);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    } else if (side === "top") {
      const y = this.gridToCanvasY(layer);
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    } else if (side === "bottom") {
      const y = this.gridToCanvasY(this.ny - layer);
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.restore();
  };
  BOUNDARY_SIDES.forEach((side) => drawBoundaryInterfaceLine(side));
},

drawFieldQuiverOverlay() {
  if (!state.fieldQuiver || (state.viewMode !== "field" && state.viewMode !== "poynting") || state.viewProjection !== "2d") return;

  const ctx = this.ctx;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const viewW = this.visibleGridWidth();
  const viewH = this.visibleGridHeight();
  const cols = clampInt(this.canvas.width / (58 * dpr), 8, 26);
  const rows = clampInt(this.canvas.height / (58 * dpr), 6, 22);
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

  const maxLength = clamp(Math.min(this.canvas.width / cols, this.canvas.height / rows) * 0.42, 8 * dpr, 22 * dpr);
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

drawDiagnosticsOverlay() {
  if (!state.diagnosticsEnabled || state.viewProjection !== "2d") return;
  const ctx = this.ctx;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const monitors = this.diagnosticMonitorPositions();
  const direction = this.diagnosticDirection();
  const drawLine = (xCell, label, color) => {
    const x = this.gridToCanvasX(xCell + 0.5);
    if (x < -2 * dpr || x > this.canvas.width + 2 * dpr) return;
    ctx.save();
    ctx.setLineDash([7 * dpr, 6 * dpr]);
    ctx.lineWidth = Math.max(1.4 * dpr, 1);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, 10 * dpr);
    ctx.lineTo(x, this.canvas.height - 10 * dpr);
    ctx.stroke();
    ctx.setLineDash([]);
    this.drawOverlayLabel(label, x + 12 * dpr, 24 * dpr, "left");
    ctx.restore();
  };
  drawLine(monitors.left, "L", "rgba(11, 98, 232, 0.74)");
  drawLine(monitors.right, "R", "rgba(16, 136, 82, 0.74)");
  const arrowLength = 34 * dpr;
  const x0 = 22 * dpr;
  const y0 = 22 * dpr;
  this.drawOverlayArrow(x0, y0, x0 + arrowLength * direction.cos, y0 - arrowLength * direction.sin, true);
  this.drawOverlayLabel("k", x0 + arrowLength * direction.cos + 13 * dpr, y0 - arrowLength * direction.sin, "center", true);
},

drawReferenceOverlay() {
  if (visualLayerEnabled("scale")) {
    this.drawScaleBarOverlay();
  }
  if (visualLayerEnabled("axes")) {
    this.drawAxisGlyphOverlay();
  }
},

drawScaleBarOverlay() {
  const ctx = this.ctx;
  const w = this.canvas.width;
  const h = this.canvas.height;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const visibleLambdaWidth = Math.max(cellsToLambda(this.visibleGridWidth()), 1e-6);
  const scaleLambda = niceScaleLength(visibleLambdaWidth);
  const colorbarReserve = 108 * dpr;
  const rightPad = state.viewMode === "field" || state.viewMode === "poynting" || state.viewProjection === "3d" ? colorbarReserve : 22 * dpr;
  const x1 = Math.max(96 * dpr, w - rightPad);
  const availableWidth = Math.max(48 * dpr, x1 - 22 * dpr);
  const scaleWidth = clamp((scaleLambda / visibleLambdaWidth) * w, 42 * dpr, availableWidth * 0.72);
  const x0 = Math.max(22 * dpr, x1 - scaleWidth);
  const y = h - 34 * dpr;
  const tick = 8 * dpr;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.moveTo(x0, y - tick);
  ctx.lineTo(x0, y + tick);
  ctx.moveTo(x1, y - tick);
  ctx.lineTo(x1, y + tick);
  this.strokeOverlayPath(5 * dpr, 2 * dpr, true);

  this.drawOverlayLabel(`${formatScaleBarValue(scaleLambda)} λ₀`, (x0 + x1) / 2, y - 17 * dpr, "center", true);
  ctx.restore();
},

drawAxisGlyphOverlay() {
  const ctx = this.ctx;
  const w = this.canvas.width;
  const h = this.canvas.height;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const size = clamp(Math.min(w, h) * 0.085, 36 * dpr, 56 * dpr);
  const originX = 34 * dpr;
  const originY = h - 74 * dpr;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  this.drawOverlayArrow(originX, originY, originX + size, originY, true);
  this.drawOverlayArrow(originX, originY, originX, originY - size, true);
  this.drawOverlayLabel("x", originX + size + 13 * dpr, originY, "center", true);
  this.drawOverlayLabel("y", originX, originY - size - 13 * dpr, "center", true);
  ctx.restore();
},

overlayReferenceColor() {
  return state.theme === "dark" ? "rgba(255, 255, 255, 0.94)" : "rgba(0, 0, 0, 0.94)";
},

drawOverlayArrow(x0, y0, x1, y1, plain = false) {
  const ctx = this.ctx;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const head = 9 * dpr;
  const wing = Math.PI / 6;

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(angle - wing), y1 - head * Math.sin(angle - wing));
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(angle + wing), y1 - head * Math.sin(angle + wing));
  this.strokeOverlayPath(5 * dpr, 2 * dpr, plain);
},

strokeOverlayPath(shadowWidth, lineWidth, plain = false) {
  const ctx = this.ctx;
  if (plain) {
    ctx.strokeStyle = this.overlayReferenceColor();
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    return;
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
  ctx.lineWidth = shadowWidth;
  ctx.stroke();
  ctx.strokeStyle = "rgba(5, 11, 15, 0.94)";
  ctx.lineWidth = lineWidth;
  ctx.stroke();
},

drawOverlayLabel(text, x, y, align, plain = false) {
  const ctx = this.ctx;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
  const metrics = ctx.measureText(text);
  const padX = 5 * dpr;
  const padY = 3 * dpr;
  const width = metrics.width + 2 * padX;
  const height = 13 * dpr + 2 * padY;
  const left = align === "center" ? x - width / 2 : x - padX;
  const top = y - height / 2;

  ctx.save();
  if (!plain) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.68)";
    ctx.fillRect(left, top, width, height);
  }
  ctx.fillStyle = plain ? this.overlayReferenceColor() : "rgba(5, 11, 15, 0.94)";
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
},

drawSourceMarkers() {
  for (const source of state.sources) {
    this.drawSourceMarker(source);
  }
},

drawSourceMarker(source) {
  const sx = this.sourceXCell(source);
  const sy = this.sourceYCell(source);
  const x = this.gridToCanvasX(sx + 0.5);
  const y = this.gridToCanvasY(sy + 0.5);
  const margin = 12 * Math.max(1, window.devicePixelRatio || 1);
  const isLineLike = lineLikeIncidentSourceShapes.has(source.shape);
  if (isLineLike && (x < -margin || x > this.canvas.width + margin)) return;
  if (!isLineLike && (x < -margin || x > this.canvas.width + margin || y < -margin || y > this.canvas.height + margin)) return;
  this.ctx.save();
  this.ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  this.ctx.lineWidth = Math.max(1, window.devicePixelRatio || 1);
  if (source.id === state.selectedSourceId) {
    this.drawSourceSelectionHalo(x, y, source);
  } else if (source.id === state.hoveredSourceId) {
    this.drawSourceHoverHalo(x, y, source);
  }
  if (source.shape === "line" || source.shape === "evanescentLine") {
    this.ctx.beginPath();
    this.ctx.moveTo(x, 8);
    this.ctx.lineTo(x, this.canvas.height - 8);
    this.ctx.stroke();
    if (source.shape === "evanescentLine") {
      const { alpha } = this.evanescentWaveNumbers(source);
      const decayPixels = (1 / Math.max(alpha, 1e-9)) * (this.canvas.width / this.visibleGridWidth());
      const arrowLength = Math.max(18 * Math.max(1, window.devicePixelRatio || 1), Math.min(70 * Math.max(1, window.devicePixelRatio || 1), decayPixels * 2.5));
      this.drawOverlayArrow(x + 7, y, x + 7 + arrowLength, y, true);
      this.drawOverlayLabel("ev", x + 14 + arrowLength, y, "left", true);
    }
  } else if (source.shape === "gaussianProfile") {
    const fwhm = state.preset === "customSlab" ? this.slabCoreThicknessCells() : Math.max(4, Math.round(this.ny * 0.09));
    const halfHeight = (fwhm * 0.5) * (this.canvas.height / this.visibleGridHeight());
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - halfHeight);
    this.ctx.lineTo(x, y + halfHeight);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.arc(x, y, 3 * Math.max(1, window.devicePixelRatio || 1), 0, Math.PI * 2);
    this.ctx.stroke();
  } else if (localizedSourceShapes.has(source.shape) || inPlaneElectricCurrentShapes.has(source.shape)) {
    this.drawAnalyticSourceGlyph(x, y, source);
  } else {
    this.drawPointSourceGlyph(x, y);
  }
  this.ctx.restore();
},

drawSourceSelectionHalo(x, y, source) {
  const ctx = this.ctx;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const radius =
    localizedSourceShapes.has(source.shape) || inPlaneElectricCurrentShapes.has(source.shape)
      ? this.sourceFwhmCanvasRadius(source) + 6 * dpr
      : 18 * dpr;
  const isMoving = dragSourcePointerId != null && dragSourceId === source.id;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = isMoving ? "rgba(255, 178, 74, 0.12)" : "rgba(0, 112, 244, 0.08)";
  ctx.fill();
  ctx.strokeStyle = isMoving ? "rgba(196, 112, 16, 0.96)" : "rgba(0, 112, 244, 0.9)";
  ctx.lineWidth = (isMoving ? 2.6 : 2.1) * dpr;
  ctx.setLineDash(isMoving ? [] : [5 * dpr, 4 * dpr]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(x, y, radius + 4 * dpr, 0, Math.PI * 2);
  ctx.strokeStyle = isMoving ? "rgba(255, 238, 198, 0.7)" : "rgba(255, 255, 255, 0.58)";
  ctx.lineWidth = 1 * dpr;
  ctx.stroke();
  this.drawOverlayLabel(isMoving ? `moving S${source.id}` : `S${source.id}`, x + radius + 10 * dpr, y, "left");
  ctx.restore();
},

drawSourceHoverHalo(x, y, source) {
  const ctx = this.ctx;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const radius =
    localizedSourceShapes.has(source.shape) || inPlaneElectricCurrentShapes.has(source.shape)
      ? this.sourceFwhmCanvasRadius(source) + 5 * dpr
      : 16 * dpr;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(69, 192, 201, 0.78)";
  ctx.lineWidth = 1.5 * dpr;
  ctx.stroke();
  this.drawOverlayLabel(`S${source.id}`, x + radius + 10 * dpr, y, "left");
  ctx.restore();
},

drawPointSourceGlyph(x, y) {
  const ctx = this.ctx;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const radius = 7 * dpr;
  const arm = 13 * dpr;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.moveTo(x - arm, y);
  ctx.lineTo(x - radius - 2 * dpr, y);
  ctx.moveTo(x + radius + 2 * dpr, y);
  ctx.lineTo(x + arm, y);
  ctx.moveTo(x, y - arm);
  ctx.lineTo(x, y - radius - 2 * dpr);
  ctx.moveTo(x, y + radius + 2 * dpr);
  ctx.lineTo(x, y + arm);
  this.strokeOverlayPath(5 * dpr, 2 * dpr);

  ctx.beginPath();
  ctx.arc(x, y, 2.2 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(5, 11, 15, 0.94)";
  ctx.fill();
  ctx.lineWidth = 1.5 * dpr;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
  ctx.stroke();
},

drawAnalyticSourceGlyph(x, y, source) {
  const ctx = this.ctx;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const radius = this.sourceFwhmCanvasRadius(source);
  const theta = (source.angleDeg * Math.PI) / 180;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  this.strokeOverlayPath(5 * dpr, 2 * dpr);

  ctx.beginPath();
  ctx.arc(x, y, 2.3 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(5, 11, 15, 0.94)";
  ctx.fill();

  if (source.shape === "gaussianSpot") return;

  const dx = Math.cos(theta) * radius;
  const dy = -Math.sin(theta) * radius;
  const wing = Math.PI / 6;
  const head = 8 * dpr;
  const angle = Math.atan2(dy, dx);
  const x0 = x - dx;
  const y0 = y - dy;
  const x1 = x + dx;
  const y1 = y + dy;

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(angle - wing), y1 - head * Math.sin(angle - wing));
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(angle + wing), y1 - head * Math.sin(angle + wing));

  if (source.shape === "quadrupole" || source.shape === "multipole") {
    const crossDx = -dy * 0.45;
    const crossDy = dx * 0.45;
    ctx.moveTo(x - crossDx, y - crossDy);
    ctx.lineTo(x + crossDx, y + crossDy);
  }

  this.strokeOverlayPath(5 * dpr, 2 * dpr);

  if (circularDipoleSourceShapes.has(source.shape)) {
    const spinRadius = Math.max(8 * dpr, radius * 0.42);
    const spinSign = source.shape === "circularDipoleCw" ? 1 : -1;
    const start = theta + spinSign * 0.15;
    const end = theta + spinSign * 1.65 * Math.PI;
    const headAngle = end + spinSign * Math.PI * 0.5;
    const hx = x + spinRadius * Math.cos(end);
    const hy = y - spinRadius * Math.sin(end);
    ctx.beginPath();
    ctx.arc(x, y, spinRadius, -start, -end, spinSign < 0);
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - 6 * dpr * Math.cos(headAngle - 0.45), hy + 6 * dpr * Math.sin(headAngle - 0.45));
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - 6 * dpr * Math.cos(headAngle + 0.45), hy + 6 * dpr * Math.sin(headAngle + 0.45));
    this.strokeOverlayPath(4 * dpr, 1.6 * dpr);
    this.drawOverlayLabel(source.shape === "circularDipoleCw" ? "+90" : "-90", x + radius + 14 * dpr, y, "left");
    return;
  }

  if (source.shape === "janusDipole") {
    this.drawOverlayLabel("Janus", x + radius + 14 * dpr, y, "left");
    return;
  }

  if (source.shape === "huygens") {
    this.drawOverlayLabel("Huygens", x + radius + 14 * dpr, y, "left");
    return;
  }

  if (inPlaneElectricCurrentShapes.has(source.shape)) {
    this.drawOverlayLabel("J||", x + radius + 14 * dpr, y, "left");
    return;
  }

  if (source.shape === "pointDipole") {
    this.drawOverlayLabel("p", x + radius + 14 * dpr, y, "left");
    return;
  }

  if (source.shape === "multipole") {
    this.drawOverlayLabel(`n=${this.localizedSourceOrder("multipole", source)}`, x + radius + 14 * dpr, y, "left");
  }
},

sourceAtClientPoint(clientX, clientY) {
  const rect = this.canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cx = (clientX - rect.left) * dpr;
  const cy = (clientY - rect.top) * dpr;
  let best = null;
  let bestDistance = Infinity;
  for (const source of state.sources) {
    const sx = this.sourceXCell(source);
    const sy = this.sourceYCell(source);
    const x = this.gridToCanvasX(sx + 0.5);
    const y = this.gridToCanvasY(sy + 0.5);
    const distance =
      lineLikeIncidentSourceShapes.has(source.shape) || source.shape === "gaussianProfile"
        ? Math.abs(cx - x)
        : Math.hypot(cx - x, cy - y);
    const radius = this.sourceHitRadius(source);
    if (distance <= radius && distance < bestDistance) {
      best = source;
      bestDistance = distance;
    }
  }
  return best;
},

sourceHitRadius(source) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  if (localizedSourceShapes.has(source.shape) || inPlaneElectricCurrentShapes.has(source.shape)) {
    return Math.max(18 * dpr, this.sourceFwhmCanvasRadius(source) + 8 * dpr);
  }
  if (lineLikeIncidentSourceShapes.has(source.shape)) return 18 * dpr;
  if (source.shape === "gaussianProfile") return 22 * dpr;
  return 18 * dpr;
}
});
