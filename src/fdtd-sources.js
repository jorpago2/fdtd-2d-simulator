"use strict";

Object.assign(FDTDSim.prototype, {
sourceSample(source, phaseRad = 0) {
  return this.sourceSampleAtPhaseTime(source, this.time, phaseRad);
},

sourceSampleAtPhaseTime(source, t, phaseRad = 0) {
  const f = source.frequency;
  const absolutePhase = ((Number(source.phaseDeg) || 0) * Math.PI) / 180;
  const phaseTimeOffset = f > 0 ? (phaseRad + absolutePhase) / (2 * Math.PI * f) : 0;
  return this.sourceSampleAtTime(source, t + phaseTimeOffset);
},

sourceSampleAtTime(source, t) {
  const f = source.frequency;
  const amp = source.amplitude;
  if (source.type === "gaussian") {
    const center = 48;
    const width = 14;
    return amp * Math.exp(-((t - center) * (t - center)) / (2 * width * width));
  }
  if (source.type === "ricker") {
    const center = 48;
    const a = Math.PI * f * (t - center);
    const a2 = a * a;
    return amp * (1 - 2 * a2) * Math.exp(-a2);
  }
  return amp * Math.sin(2 * Math.PI * f * t);
},

injectSource() {
  for (const source of state.sources) {
    this.injectSingleSource(source);
  }
},

injectSingleSource(source) {
  const sx = this.sourceXCell(source);
  const sy = this.sourceYCell(source);
  if (source.shape === "line") {
    this.injectPlaneWaveIncidentField(source, sx, sy);
    return;
  }
  if (source.shape === "gaussianProfile") {
    this.injectGaussianLineIncidentField(source, sx, sy);
    return;
  }
  if (source.shape === "evanescentLine") {
    this.injectEvanescentLineIncidentField(source, sx, sy);
    return;
  }
  const value = this.sourceSample(source);
  if (inPlaneElectricCurrentShapes.has(source.shape)) {
    this.injectInPlaneElectricCurrent(sx, sy, source, value);
    return;
  }
  if (localizedSourceShapes.has(source.shape)) {
    this.injectLocalizedAnalyticCurrent(sx, sy, source);
    return;
  }
  this.injectPointCurrent(value, sx, sy);
},

incidentLinePhase(source, y, sy) {
  const theta = (source.angleDeg * Math.PI) / 180;
  const kCells = (2 * Math.PI * source.frequency) / Math.max(COURANT, 1e-9);
  return -kCells * (y - sy) * Math.sin(theta);
},

addDirectionalIncidentField(idx, value, x, y, source) {
  this.addIncidentScalarField(idx, value);

  const scaledValue = Number.isFinite(this.fieldScale) ? value / this.fieldScale : 0;
  if (Math.abs(scaledValue) < 1e-9) return;

  const theta = (source.angleDeg * Math.PI) / 180;
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  // Huygens-style pairing: the transverse companion selects the forward impedance branch.
  const transverseGain = 1;
  const directionX = cosTheta >= 0 ? 1 : -1;
  const transverseX = directionX > 0 ? x - 1 : x;
  if (transverseX < 0 || transverseX >= this.nx - 1) return;
  const transverseIdx = this.id(transverseX, y);
  if (this.material[transverseIdx] === 2) return;

  if (state.fieldComponent === "hz") {
    this.hx[idx] += -sinTheta * scaledValue * transverseGain;
    this.hy[transverseIdx] += cosTheta * scaledValue * transverseGain;
  } else {
    this.hx[idx] += sinTheta * scaledValue * transverseGain;
    this.hy[transverseIdx] -= cosTheta * scaledValue * transverseGain;
  }
},

evanescentWaveNumbers(source) {
  const k0 = (2 * Math.PI * Math.max(1e-9, source.frequency)) / Math.max(COURANT, 1e-9);
  const kParallelRatio = clamp(Number(source.widthLambda) || 1.25, 1.01, 2.5);
  const kParallel = k0 * kParallelRatio;
  const alpha = k0 * Math.sqrt(Math.max(0, kParallelRatio * kParallelRatio - 1));
  return { k0, kParallel, alpha };
},

injectPlaneWaveIncidentField(source, sx, sy) {
  const halfWindow = Math.max(12, Math.round(this.ny * 0.42));
  const y0 = Math.max(this.activeInteriorMinY(), sy - halfWindow);
  const y1 = Math.min(this.activeInteriorMaxY(), sy + halfWindow);
  for (let y = y0; y <= y1; y += 1) {
    const taper = 0.54 + 0.46 * Math.sin(Math.PI * (y - y0) / Math.max(1, y1 - y0));
    const idx = this.id(sx, y);
    if (this.material[idx] !== 2) {
      const value = this.sourceSample(source, this.incidentLinePhase(source, y, sy));
      this.addDirectionalIncidentField(idx, value * taper, sx, y, source);
    }
  }
},

injectGaussianLineIncidentField(source, sx, sy) {
  const fwhm = state.preset === "customSlab" ? this.slabCoreThicknessCells() : Math.max(4, Math.round(this.ny * 0.09));
  const halfWindow = Math.max(3, Math.ceil(fwhm * 2.5));
  const y0 = Math.max(this.activeInteriorMinY(), sy - halfWindow);
  const y1 = Math.min(this.activeInteriorMaxY(), sy + halfWindow);
  for (let y = y0; y <= y1; y += 1) {
    const normalized = (y - sy) / fwhm;
    const profile = Math.exp(-4 * Math.LN2 * normalized * normalized);
    const idx = this.id(sx, y);
    if (this.material[idx] !== 2) {
      const value = this.sourceSample(source, this.incidentLinePhase(source, y, sy));
      this.addDirectionalIncidentField(idx, value * profile, sx, y, source);
    }
  }
},

injectEvanescentLineIncidentField(source, sx, sy) {
  const { k0, kParallel, alpha } = this.evanescentWaveNumbers(source);
  const lambdaCells = (2 * Math.PI) / Math.max(k0, 1e-9);
  const decayCells = 1 / Math.max(alpha, 1e-9);
  const stripWidth = Math.ceil(Math.max(5, Math.min(lambdaCells * 3, decayCells * 4)));
  const x0 = clampInt(sx, this.activeInteriorMinX(), this.activeInteriorMaxX());
  const x1 = Math.min(this.activeInteriorMaxX(), x0 + stripWidth);
  const halfWindow = Math.max(12, Math.round(this.ny * 0.42));
  const y0 = Math.max(this.activeInteriorMinY(), sy - halfWindow);
  const y1 = Math.min(this.activeInteriorMaxY(), sy + halfWindow);
  const ySpan = Math.max(1, y1 - y0);

  for (let y = y0; y <= y1; y += 1) {
    const edgeTaper = Math.sin(Math.PI * (y - y0) / ySpan);
    const phase = -kParallel * (y - sy);
    const lineValue = this.sourceSample(source, phase) * edgeTaper;
    if (Math.abs(lineValue) < 1e-8) continue;
    for (let x = x0; x <= x1; x += 1) {
      const idx = this.id(x, y);
      if (this.material[idx] === 2) continue;
      const decay = Math.exp(-alpha * Math.max(0, x - x0));
      if (decay < 1e-4) break;
      this.addIncidentScalarField(idx, lineValue * decay);
    }
  }
},

injectPointCurrent(value, sx, sy) {
  const x0 = Math.max(this.activeInteriorMinX(), sx - 1);
  const x1 = Math.min(this.activeInteriorMaxX(), sx + 1);
  const y0 = Math.max(this.activeInteriorMinY(), sy - 1);
  const y1 = Math.min(this.activeInteriorMaxY(), sy + 1);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const idx = this.id(x, y);
      if (this.material[idx] !== 2) {
        this.addScalarCurrentSource(idx, value * (x === sx && y === sy ? 1 : 0.45), x, y);
      }
    }
  }
},

injectLocalizedAnalyticCurrent(sx, sy, source) {
  const shape = source.shape;
  const order = this.localizedSourceOrder(shape, source);
  const fwhm = this.sourceEnvelopeFwhmCells(source);
  const sigma = Math.max(1, fwhm / (2 * Math.sqrt(2 * Math.LN2)));
  const radiusSigma = shape === "gaussianSpot" ? 3 : Math.max(3.5, Math.sqrt(order) + 1.5);
  const radius = Math.ceil(sigma * radiusSigma);
  const minX = Math.max(this.activeInteriorMinX(), sx - radius);
  const maxX = Math.min(this.activeInteriorMaxX(), sx + radius);
  const minY = Math.max(this.activeInteriorMinY(), sy - radius);
  const maxY = Math.min(this.activeInteriorMaxY(), sy + radius);
  const theta = (source.angleDeg * Math.PI) / 180;
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const sourceSamples = new Map();
  const sampleAtPhase = (phaseRad) => {
    const key = Math.round(phaseRad * 1e6);
    if (!sourceSamples.has(key)) sourceSamples.set(key, this.sourceSample(source, phaseRad));
    return sourceSamples.get(key);
  };

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - sx;
      const dy = sy - y;
      const u = (dx * cosTheta + dy * sinTheta) / sigma;
      const v = (-dx * sinTheta + dy * cosTheta) / sigma;
      const terms = this.localizedSourceTerms(shape, order, u, v, source);
      let value = 0;
      for (const term of terms) {
        if (Math.abs(term.profile) < 1e-4) continue;
        value += sampleAtPhase(term.phaseRad || 0) * term.profile;
      }
      if (Math.abs(value) < 1e-5) continue;
      const idx = this.id(x, y);
      if (this.material[idx] !== 2) {
        this.addScalarCurrentSource(idx, value, x, y);
      }
    }
  }
},

injectInPlaneElectricCurrent(sx, sy, source, value) {
  if (state.fieldComponent !== "hz") return;
  const fwhm = this.sourceEnvelopeFwhmCells(source);
  const sigma = Math.max(1, fwhm / (2 * Math.sqrt(2 * Math.LN2)));
  const radius = Math.ceil(sigma * 3);
  const theta = (source.angleDeg * Math.PI) / 180;
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const minX = Math.max(this.activeInteriorMinX(), sx - radius);
  const maxX = Math.min(this.activeInteriorMaxX(), sx + radius);
  const minY = Math.max(this.activeInteriorMinY(), sy - radius);
  const maxY = Math.min(this.activeInteriorMaxY(), sy + radius);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = (x - sx) / sigma;
      const dy = (y - sy) / sigma;
      const profile = Math.exp(-0.5 * (dx * dx + dy * dy));
      if (profile < 1e-4) continue;
      const idx = this.id(x, y);
      if (this.material[idx] === 2) continue;
      this.addElectricCurrentJx(idx, value * profile * ux, x, y);
      this.addElectricCurrentJy(idx, value * profile * uy, x, y);
    }
  }
},

localizedSourceOrder(shape, source) {
  if (shape === "pointDipole" || circularDipoleSourceShapes.has(shape) || shape === "janusDipole" || shape === "huygens") return 1;
  if (shape === "dipole") return 1;
  if (shape === "quadrupole") return 2;
  if (shape === "multipole") return clampInt(source.multipoleOrder, 1, 8);
  return 0;
},

localizedSourceTerms(shape, order, u, v, source) {
  const gaussian = this.localizedGaussianProfile(u, v);
  const dipoleU = this.localizedHermiteProfile(1, u, v, false);
  const dipoleV = this.localizedHermiteProfile(1, u, v, true);
  if (shape === "gaussianSpot") return [{ profile: gaussian, phaseRad: 0 }];
  if (shape === "pointDipole" || shape === "dipole") return [{ profile: dipoleU, phaseRad: 0 }];
  if (shape === "circularDipoleCw") {
    return [
      { profile: dipoleU, phaseRad: 0 },
      { profile: dipoleV, phaseRad: Math.PI / 2 },
    ];
  }
  if (shape === "circularDipoleCcw") {
    return [
      { profile: dipoleU, phaseRad: 0 },
      { profile: dipoleV, phaseRad: -Math.PI / 2 },
    ];
  }
  if (shape === "janusDipole") {
    return [
      { profile: 0.72 * dipoleU, phaseRad: 0 },
      { profile: 0.72 * gaussian, phaseRad: Math.PI / 2 },
    ];
  }
  if (shape === "huygens") {
    return [
      { profile: 0.56 * gaussian, phaseRad: 0 },
      { profile: 0.56 * dipoleU, phaseRad: 0 },
    ];
  }
  return [{ profile: this.localizedSourceProfile(shape, order, u, v, source), phaseRad: 0 }];
},

localizedGaussianProfile(u, v) {
  return Math.exp(-0.5 * (u * u + v * v));
},

localizedHermiteProfile(order, u, v, useSineAngular = false) {
  const r2 = u * u + v * v;
  if (r2 < 1e-12 || order < 1) return 0;
  const rho = Math.sqrt(r2);
  const phi = Math.atan2(v, u);
  const angular = useSineAngular ? Math.sin(order * phi) : Math.cos(order * phi);
  const envelope = Math.exp(-0.5 * r2);
  const peak = Math.pow(order, order * 0.5) * Math.exp(-0.5 * order);
  return (Math.pow(rho, order) * angular * envelope) / Math.max(peak, 1e-9);
},

localizedSourceProfile(shape, order, u, v, source) {
  if (shape === "gaussianSpot") return this.localizedGaussianProfile(u, v);
  return this.localizedHermiteProfile(order, u, v, shape === "multipole" && source.multipolePhase === "sin");
},

sourceFwhmCanvasRadius(source) {
  const fwhm = this.sourceEnvelopeFwhmCells(source);
  const pixelsPerCell = Math.min(this.canvas.width / this.visibleGridWidth(), this.canvas.height / this.visibleGridHeight());
  return Math.max(6 * Math.max(1, window.devicePixelRatio || 1), 0.5 * fwhm * pixelsPerCell);
},

zeroElectricCell(idx) {
  this.ez[idx] = 0;
  this.ezx[idx] = 0;
  this.ezy[idx] = 0;
  if (this.bianisotropicMaterial?.[idx]) {
    this.bianisotropyPrevScalar[idx] = 0;
    this.bianisotropyPrevSplitX[idx] = 0;
    this.bianisotropyPrevSplitY[idx] = 0;
  }
},

zeroDualFieldCell(idx) {
  this.dualEz[idx] = 0;
  this.dualEzx[idx] = 0;
  this.dualEzy[idx] = 0;
  this.dualHx[idx] = 0;
  this.dualHy[idx] = 0;
  this.bianisotropyPrevDualEz[idx] = 0;
  this.bianisotropyPrevDualEzx[idx] = 0;
  this.bianisotropyPrevDualEzy[idx] = 0;
  this.bianisotropyPrevDualHx[idx] = 0;
  this.bianisotropyPrevDualHy[idx] = 0;
},

addIncidentScalarField(idx, value) {
  const scaledValue = Number.isFinite(this.fieldScale) ? value / this.fieldScale : 0;
  const half = scaledValue * 0.5;
  this.ezx[idx] += half;
  this.ezy[idx] += half;
  this.ez[idx] = this.ezx[idx] + this.ezy[idx];
},

addScalarCurrentSource(idx, value, x, y) {
  if (state.fieldComponent === "hz") {
    this.addMagneticCurrentMz(idx, value, x, y);
  } else {
    this.addElectricCurrentJz(idx, value, x, y);
  }
},

addElectricCurrentJz(idx, jz, x, y) {
  const scaledJz = Number.isFinite(this.fieldScale) ? jz / this.fieldScale : 0;
  const halfJz = scaledJz * 0.5;
  const currentScaleX = this.eCbX[x] * (this.courant / this.eps[idx]);
  const currentScaleY = this.eCbY[y] * (this.courant / this.epsY[idx]);
  const decayX = this.electricLossDecay(this.loss[idx], idx);
  const decayY = this.electricLossDecay(this.lossY[idx], idx);
  this.ezx[idx] -= currentScaleX * halfJz * decayX;
  this.ezy[idx] -= currentScaleY * halfJz * decayY;
  this.ez[idx] = this.ezx[idx] + this.ezy[idx];
},

addMagneticCurrentMz(idx, mz, x, y) {
  const scaledMz = Number.isFinite(this.fieldScale) ? mz / this.fieldScale : 0;
  const halfMz = scaledMz * 0.5;
  const currentScaleX = this.hCbX[x] * (this.courant / this.mu[idx]);
  const currentScaleY = this.hCbY[y] * (this.courant / this.muY[idx]);
  const decayX = 1 / (1 + this.muLoss[idx]);
  const decayY = 1 / (1 + this.muLossY[idx]);
  this.ezx[idx] -= currentScaleX * halfMz * decayX;
  this.ezy[idx] -= currentScaleY * halfMz * decayY;
  this.ez[idx] = this.ezx[idx] + this.ezy[idx];
},

addElectricCurrentJx(idx, jx, x, y) {
  const scaledJx = Number.isFinite(this.fieldScale) ? jx / this.fieldScale : 0;
  const currentScale = this.eCbY[y] * (this.courant / this.eps[idx]);
  const decay = this.electricLossDecay(this.loss[idx], idx);
  this.hx[idx] -= currentScale * scaledJx * decay;
},

addElectricCurrentJy(idx, jy, x, y) {
  const scaledJy = Number.isFinite(this.fieldScale) ? jy / this.fieldScale : 0;
  const currentScale = this.eCbX[x] * (this.courant / this.epsY[idx]);
  const decay = this.electricLossDecay(this.lossY[idx], idx);
  this.hy[idx] -= currentScale * scaledJy * decay;
}
});
