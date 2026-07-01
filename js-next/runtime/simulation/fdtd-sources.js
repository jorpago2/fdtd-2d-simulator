"use strict";

const incidentFieldModule = globalThis.FdtdIncidentField;
if (!incidentFieldModule) {
  throw new Error("fdtd-incident-field.js must be loaded before fdtd-sources.js");
}

Object.assign(FDTDSim.prototype, {
sourceShutdownFactor(source, solverTime = this.time) {
  return incidentFieldModule.sourceShutdownFactor?.(source, solverTime) ?? 1;
},

effectiveSourceAmplitude(source, solverTime = this.time) {
  return (Number(source?.amplitude) || 0) * this.sourceShutdownFactor(source, solverTime);
},

pruneRetiredSources() {
  if (!Array.isArray(state.retiringSources)) {
    state.retiringSources = [];
    return;
  }
  if (state.retiringSources.length === 0) return;
  state.retiringSources = state.retiringSources.filter((source) => this.sourceShutdownFactor(source, this.time) > 0);
},

activeSolverSources() {
  this.pruneRetiredSources();
  const retiringSources = Array.isArray(state.retiringSources) ? state.retiringSources : [];
  return retiringSources.length > 0 ? state.sources.concat(retiringSources) : state.sources;
},

sourceSample(source, phaseRad = 0) {
  return this.sourceSampleAtPhaseTime(source, this.time, phaseRad);
},

sourceSampleAtPhaseTime(source, t, phaseRad = 0) {
  const f = source.frequency;
  const absolutePhase = ((Number(source.phaseDeg) || 0) * Math.PI) / 180;
  const phaseTimeOffset = f > 0 ? (phaseRad + absolutePhase) / (2 * Math.PI * f) : 0;
  const shutdown = this.sourceShutdownFactor(source, t);
  return shutdown <= 0 ? 0 : shutdown * this.sourceSampleAtTime(source, t + phaseTimeOffset);
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
  for (const source of this.activeSolverSources()) {
    this.injectSingleSource(source);
  }
},

injectSingleSource(source) {
  if (this.isTfsfIncidentSource(source)) {
    return;
  }
  const sx = this.sourceXCell(source);
  const sy = this.sourceYCell(source);
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

isTfsfIncidentSource(source) {
  return source?.shape === "line" || source?.shape === "gaussianProfile";
},

hasTfsfIncidentSource() {
  return this.activeSolverSources().some((source) => this.isTfsfIncidentSource(source));
},

tfsfSourceParams(source) {
  return incidentFieldModule.createTfsfDescriptor({
    sim: this,
    state,
    source,
    courant: COURANT,
  });
},

tfsfIncidentEnvelope(params, x, y) {
  return incidentFieldModule.envelope(params, x, y);
},

tfsfIncidentScalar(params, x, y, t) {
  return incidentFieldModule.scalar(params, x, y, t, this.fieldScale);
},

tfsfTmIncidentH(params, x, y, t) {
  return incidentFieldModule.tmIncidentH(params, x, y, t, this.fieldScale);
},

tfsfTeIncidentE(params, x, y, t) {
  return incidentFieldModule.teIncidentE(params, x, y, t, this.fieldScale);
},

electricUpdateCoeffX(idx, x) {
  const eps = this.safeMaterialDenominator(this.eps[idx]);
  const sigmaDamp = this.conductivityDamp(this.conductivity[idx], eps);
  const sigmaCb = 1 / (1 + sigmaDamp);
  return sigmaCb * (this.courant / eps) * this.electricLossDecay(this.loss[idx], idx);
},

electricUpdateCoeffY(idx, y) {
  const epsY = this.safeMaterialDenominator(this.epsY[idx]);
  const sigmaDamp = this.conductivityDamp(this.conductivityY[idx], epsY);
  const sigmaCb = 1 / (1 + sigmaDamp);
  return sigmaCb * (this.courant / epsY) * this.electricLossDecay(this.lossY[idx], idx);
},

transverseElectricUpdateCoeffX(idx, y) {
  const eps = this.safeMaterialDenominator(this.eps[idx]);
  const sigmaDamp = this.conductivityDamp(this.conductivity[idx], eps);
  const sigmaCb = 1 / (1 + sigmaDamp);
  return sigmaCb * (this.courant / eps) * this.electricLossDecay(this.loss[idx], idx);
},

transverseElectricUpdateCoeffY(idx, x) {
  const epsY = this.safeMaterialDenominator(this.epsY[idx]);
  const sigmaDamp = this.conductivityDamp(this.conductivityY[idx], epsY);
  const sigmaCb = 1 / (1 + sigmaDamp);
  return sigmaCb * (this.courant / epsY) * this.electricLossDecay(this.lossY[idx], idx);
},

magneticUpdateCoeffX(idx, x) {
  const mu = this.safeMaterialDenominator(this.mu[idx]);
  return (this.courant / mu) * this.magneticLossDecay(this.muLoss[idx]);
},

magneticUpdateCoeffY(idx, y) {
  const muY = this.safeMaterialDenominator(this.muY[idx]);
  return (this.courant / muY) * this.magneticLossDecay(this.muLossY[idx]);
},

transverseMagneticUpdateCoeffX(idx, x) {
  const muY = this.safeMaterialDenominator(this.muY[idx]);
  return (this.courant / muY) * this.magneticLossDecay(this.muLossY[idx]);
},

transverseMagneticUpdateCoeffY(idx, y) {
  const mu = this.safeMaterialDenominator(this.mu[idx]);
  return (this.courant / mu) * this.magneticLossDecay(this.muLoss[idx]);
},

applyTfsfTransverseCorrections() {
  for (const source of this.activeSolverSources()) {
    if (!this.isTfsfIncidentSource(source)) continue;
    const params = this.tfsfSourceParams(source);
    if (!params) continue;
    if (state.fieldComponent === "hz") this.applyTfsfTeElectricCorrections(params);
    else this.applyTfsfTmMagneticCorrections(params);
  }
},

applyTfsfScalarCorrections() {
  for (const source of this.activeSolverSources()) {
    if (!this.isTfsfIncidentSource(source)) continue;
    const params = this.tfsfSourceParams(source);
    if (!params) continue;
    if (state.fieldComponent === "hz") this.applyTfsfTeMagneticCorrections(params);
    else this.applyTfsfTmElectricCorrections(params);
  }
},

applyTfsfTmMagneticCorrections(params) {
  const { x0, x1, y0, y1 } = params;
  const t = this.time;
  for (let y = y0; y <= y1; y += 1) {
    const leftIdx = this.id(x0 - 1, y);
    if (this.material[leftIdx] !== 2) {
      const eLeft = this.tfsfIncidentScalar(params, x0, y, t);
      this.hy[leftIdx] -= this.transverseMagneticUpdateCoeffX(leftIdx, x0 - 1) * eLeft;
    }
    const rightIdx = this.id(x1, y);
    if (this.material[rightIdx] !== 2) {
      const eRight = this.tfsfIncidentScalar(params, x1, y, t);
      this.hy[rightIdx] += this.transverseMagneticUpdateCoeffX(rightIdx, x1) * eRight;
    }
  }
  for (let x = x0; x <= x1; x += 1) {
    const topIdx = this.id(x, y0 - 1);
    if (this.material[topIdx] !== 2) {
      const eTop = this.tfsfIncidentScalar(params, x, y0, t);
      this.hx[topIdx] += this.transverseMagneticUpdateCoeffY(topIdx, y0 - 1) * eTop;
    }
    const bottomIdx = this.id(x, y1);
    if (this.material[bottomIdx] !== 2) {
      const eBottom = this.tfsfIncidentScalar(params, x, y1, t);
      this.hx[bottomIdx] -= this.transverseMagneticUpdateCoeffY(bottomIdx, y1) * eBottom;
    }
  }
},

applyTfsfTmElectricCorrections(params) {
  const { x0, x1, y0, y1 } = params;
  const t = this.time + 0.5;
  for (let y = y0; y <= y1; y += 1) {
    const leftIdx = this.id(x0, y);
    if (this.material[leftIdx] !== 2) {
      const hLeft = this.tfsfTmIncidentH(params, x0 - 0.5, y, t).hy;
      this.ezx[leftIdx] -= this.electricUpdateCoeffX(leftIdx, x0) * hLeft;
      this.ez[leftIdx] = this.ezx[leftIdx] + this.ezy[leftIdx];
    }
    const rightIdx = this.id(x1, y);
    if (this.material[rightIdx] !== 2) {
      const hRight = this.tfsfTmIncidentH(params, x1 + 0.5, y, t).hy;
      this.ezx[rightIdx] += this.electricUpdateCoeffX(rightIdx, x1) * hRight;
      this.ez[rightIdx] = this.ezx[rightIdx] + this.ezy[rightIdx];
    }
  }
  for (let x = x0; x <= x1; x += 1) {
    const topIdx = this.id(x, y0);
    if (this.material[topIdx] !== 2) {
      const hTop = this.tfsfTmIncidentH(params, x, y0 - 0.5, t).hx;
      this.ezy[topIdx] += this.electricUpdateCoeffY(topIdx, y0) * hTop;
      this.ez[topIdx] = this.ezx[topIdx] + this.ezy[topIdx];
    }
    const bottomIdx = this.id(x, y1);
    if (this.material[bottomIdx] !== 2) {
      const hBottom = this.tfsfTmIncidentH(params, x, y1 + 0.5, t).hx;
      this.ezy[bottomIdx] -= this.electricUpdateCoeffY(bottomIdx, y1) * hBottom;
      this.ez[bottomIdx] = this.ezx[bottomIdx] + this.ezy[bottomIdx];
    }
  }
},

applyTfsfTeElectricCorrections(params) {
  const { x0, x1, y0, y1 } = params;
  const t = this.time;
  for (let y = y0; y <= y1; y += 1) {
    const leftIdx = this.id(x0 - 1, y);
    if (this.material[leftIdx] !== 2) {
      const hLeft = this.tfsfIncidentScalar(params, x0, y, t);
      this.hy[leftIdx] += this.transverseElectricUpdateCoeffY(leftIdx, x0 - 1) * hLeft;
    }
    const rightIdx = this.id(x1, y);
    if (this.material[rightIdx] !== 2) {
      const hRight = this.tfsfIncidentScalar(params, x1, y, t);
      this.hy[rightIdx] -= this.transverseElectricUpdateCoeffY(rightIdx, x1) * hRight;
    }
  }
  for (let x = x0; x <= x1; x += 1) {
    const topIdx = this.id(x, y0 - 1);
    if (this.material[topIdx] !== 2) {
      const hTop = this.tfsfIncidentScalar(params, x, y0, t);
      this.hx[topIdx] -= this.transverseElectricUpdateCoeffX(topIdx, y0 - 1) * hTop;
    }
    const bottomIdx = this.id(x, y1);
    if (this.material[bottomIdx] !== 2) {
      const hBottom = this.tfsfIncidentScalar(params, x, y1, t);
      this.hx[bottomIdx] += this.transverseElectricUpdateCoeffX(bottomIdx, y1) * hBottom;
    }
  }
},

applyTfsfTeMagneticCorrections(params) {
  const { x0, x1, y0, y1 } = params;
  const t = this.time + 0.5;
  for (let y = y0; y <= y1; y += 1) {
    const leftIdx = this.id(x0, y);
    if (this.material[leftIdx] !== 2) {
      const eLeft = this.tfsfTeIncidentE(params, x0 - 0.5, y, t).ey;
      this.ezx[leftIdx] += this.magneticUpdateCoeffX(leftIdx, x0) * eLeft;
      this.ez[leftIdx] = this.ezx[leftIdx] + this.ezy[leftIdx];
    }
    const rightIdx = this.id(x1, y);
    if (this.material[rightIdx] !== 2) {
      const eRight = this.tfsfTeIncidentE(params, x1 + 0.5, y, t).ey;
      this.ezx[rightIdx] -= this.magneticUpdateCoeffX(rightIdx, x1) * eRight;
      this.ez[rightIdx] = this.ezx[rightIdx] + this.ezy[rightIdx];
    }
  }
  for (let x = x0; x <= x1; x += 1) {
    const topIdx = this.id(x, y0);
    if (this.material[topIdx] !== 2) {
      const eTop = this.tfsfTeIncidentE(params, x, y0 - 0.5, t).ex;
      this.ezy[topIdx] -= this.magneticUpdateCoeffY(topIdx, y0) * eTop;
      this.ez[topIdx] = this.ezx[topIdx] + this.ezy[topIdx];
    }
    const bottomIdx = this.id(x, y1);
    if (this.material[bottomIdx] !== 2) {
      const eBottom = this.tfsfTeIncidentE(params, x, y1 + 0.5, t).ex;
      this.ezy[bottomIdx] += this.magneticUpdateCoeffY(bottomIdx, y1) * eBottom;
      this.ez[bottomIdx] = this.ezx[bottomIdx] + this.ezy[bottomIdx];
    }
  }
},

evanescentWaveNumbers(source) {
  const k0 = (2 * Math.PI * Math.max(1e-9, source.frequency)) / Math.max(COURANT, 1e-9);
  const kParallelRatio = clamp(Number(source.evanescentKParallelRatio ?? source.kParallelRatio ?? source.widthLambda) || 1.25, 1.01, 2.5);
  const kParallel = k0 * kParallelRatio;
  const alpha = k0 * Math.sqrt(Math.max(0, kParallelRatio * kParallelRatio - 1));
  return { k0, kParallel, kParallelRatio, alpha, alphaRatio: alpha / Math.max(k0, 1e-9) };
},

sourceLocalImpedance(sx, sy) {
  const idx = this.id(sx, sy);
  const eps = Math.max(1e-6, Math.abs(0.5 * (this.safeMaterialDenominator(this.eps[idx]) + this.safeMaterialDenominator(this.epsY[idx]))));
  const mu = Math.max(1e-6, Math.abs(0.5 * (this.safeMaterialDenominator(this.mu[idx]) + this.safeMaterialDenominator(this.muY[idx]))));
  return Math.sqrt(mu / eps);
},

injectEvanescentLineIncidentField(source, sx, sy) {
  const { k0, kParallel, kParallelRatio, alpha, alphaRatio } = this.evanescentWaveNumbers(source);
  const lambdaCells = (2 * Math.PI) / Math.max(k0, 1e-9);
  const decayCells = 1 / Math.max(alpha, 1e-9);
  const stripWidth = Math.ceil(Math.max(5, Math.min(lambdaCells * 3, decayCells * 4)));
  const x0 = clampInt(sx, this.activeInteriorMinX(), this.activeInteriorMaxX());
  const x1 = Math.min(this.activeInteriorMaxX(), x0 + stripWidth);
  const halfWindow = Math.max(12, Math.round(this.ny * 0.42));
  const y0 = Math.max(this.activeInteriorMinY(), sy - halfWindow);
  const y1 = Math.min(this.activeInteriorMaxY(), sy + halfWindow);
  const ySpan = Math.max(1, y1 - y0);
  const impedance = this.sourceLocalImpedance(sx, sy);
  const invImpedance = 1 / Math.max(1e-9, impedance);

  for (let y = y0; y <= y1; y += 1) {
    const edgeTaper = Math.sin(Math.PI * (y - y0) / ySpan);
    const phase = -kParallel * (y - sy);
    const lineValue = this.sourceSample(source, phase) * edgeTaper;
    const quadratureValue = this.sourceSample(source, phase + Math.PI / 2) * edgeTaper;
    if (Math.max(Math.abs(lineValue), Math.abs(quadratureValue)) < 1e-8) continue;
    for (let x = x0; x <= x1; x += 1) {
      const idx = this.id(x, y);
      if (this.material[idx] === 2) continue;
      const decay = Math.exp(-alpha * Math.max(0, x - x0));
      if (decay < 1e-4) break;
      const scalarValue = lineValue * decay;
      const quadratureScalar = quadratureValue * decay;
      this.addIncidentScalarField(idx, scalarValue);
      if (state.fieldComponent === "hz") {
        this.addTransverseIncidentField(idx, -impedance * kParallelRatio * scalarValue, impedance * alphaRatio * quadratureScalar);
      } else {
        this.addTransverseIncidentField(idx, invImpedance * kParallelRatio * scalarValue, -invImpedance * alphaRatio * quadratureScalar);
      }
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
  const pixelsPerCell = this.renderViewport().pixelsPerCell;
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

addTransverseIncidentField(idx, xValue, yValue) {
  const scale = Number.isFinite(this.fieldScale) && this.fieldScale !== 0 ? this.fieldScale : 1;
  this.hx[idx] += xValue / scale;
  this.hy[idx] += yValue / scale;
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
  const currentScaleX = this.courant / this.safeMaterialDenominator(this.eps[idx]);
  const currentScaleY = this.courant / this.safeMaterialDenominator(this.epsY[idx]);
  const decayX = this.electricLossDecay(this.loss[idx], idx);
  const decayY = this.electricLossDecay(this.lossY[idx], idx);
  this.ezx[idx] -= currentScaleX * halfJz * decayX;
  this.ezy[idx] -= currentScaleY * halfJz * decayY;
  this.ez[idx] = this.ezx[idx] + this.ezy[idx];
},

addMagneticCurrentMz(idx, mz, x, y) {
  const scaledMz = Number.isFinite(this.fieldScale) ? mz / this.fieldScale : 0;
  const halfMz = scaledMz * 0.5;
  const currentScaleX = this.courant / this.safeMaterialDenominator(this.mu[idx]);
  const currentScaleY = this.courant / this.safeMaterialDenominator(this.muY[idx]);
  const decayX = this.magneticLossDecay(this.muLoss[idx]);
  const decayY = this.magneticLossDecay(this.muLossY[idx]);
  this.ezx[idx] -= currentScaleX * halfMz * decayX;
  this.ezy[idx] -= currentScaleY * halfMz * decayY;
  this.ez[idx] = this.ezx[idx] + this.ezy[idx];
},

addElectricCurrentJx(idx, jx, x, y) {
  const scaledJx = Number.isFinite(this.fieldScale) ? jx / this.fieldScale : 0;
  const currentScale = this.courant / this.safeMaterialDenominator(this.eps[idx]);
  const decay = this.electricLossDecay(this.loss[idx], idx);
  this.hx[idx] -= currentScale * scaledJx * decay;
},

addElectricCurrentJy(idx, jy, x, y) {
  const scaledJy = Number.isFinite(this.fieldScale) ? jy / this.fieldScale : 0;
  const currentScale = this.courant / this.safeMaterialDenominator(this.epsY[idx]);
  const decay = this.electricLossDecay(this.lossY[idx], idx);
  this.hy[idx] -= currentScale * scaledJy * decay;
}
});
