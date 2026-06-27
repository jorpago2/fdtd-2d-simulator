"use strict";

Object.assign(FDTDSim.prototype, {
resetDiagnostics() {
  this.diagnosticFluxLeft = 0;
  this.diagnosticFluxRight = 0;
  this.diagnosticReflectedPower = 0;
  this.diagnosticIncidentPower = 0;
  this.diagnosticTransmittedPower = 0;
  this.diagnosticIncidentFlux = 0;
  this.diagnosticReflectance = 0;
  this.diagnosticTransmittance = 0;
  this.diagnosticSamples = 0;
  this.diagnosticAngleDeg = 0;
  this.diagnosticPhasors = {
    incident: { re: 0, im: 0 },
    reflected: { re: 0, im: 0 },
    transmitted: { re: 0, im: 0 },
  };
  this.diagnosticDftKey = "";
  this.diagnosticDftChannels = [];
  this.diagnosticDftSummary = null;
  this.diagnosticDftSampleIndex = 0;
  this.diagnosticDftSampleCount = 0;
  this.diagnosticDftTimeSeries = new Float64Array(DIAGNOSTIC_DFT_WINDOW);
  this.diagnosticDftIncidentSeries = new Float32Array(DIAGNOSTIC_DFT_WINDOW);
  this.diagnosticDftReflectedSeries = new Float32Array(DIAGNOSTIC_DFT_WINDOW);
  this.diagnosticDftTransmittedSeries = new Float32Array(DIAGNOSTIC_DFT_WINDOW);
  this.diagnosticImpedanceLeft = 1;
  this.diagnosticImpedanceRight = 1;
  this.resetAnalysisDiagnostics();
},

resetAnalysisDiagnostics() {
  this.analysisSamples = 0;
  this.analysisProbeIndex = 0;
  this.analysisProbeCount = 0;
  this.analysisProbeSeries = new Float32Array(512);
  this.analysisEnergyIndex = 0;
  this.analysisEnergyCount = 0;
  this.analysisEnergySeries = new Float32Array(512);
  this.analysisContourKey = "";
  this.analysisContour = [];
  this.analysisContourRe = new Float32Array(0);
  this.analysisContourIm = new Float32Array(0);
  this.analysisContourDnRe = new Float32Array(0);
  this.analysisContourDnIm = new Float32Array(0);
  this.analysisFarField = [];
  this.analysisFarFieldMode = "ntff";
  this.analysisFarFieldPeak = 0;
  this.analysisScatteringTotal = 0;
  this.analysisScatteringForward = 0;
  this.analysisScatteringBackward = 0;
  this.analysisEnergyEwma = 0;
  this.analysisSourceIntensityEwma = 0;
  this.analysisOutwardFluxEwma = 0;
  this.analysisGuidedFluxEwma = 0;
  this.analysisHyperlensInnerEnergyEwma = 0;
  this.analysisHyperlensOuterEnergyEwma = 0;
  this.analysisHyperlensInnerDetailEwma = 0;
  this.analysisHyperlensOuterDetailEwma = 0;
  this.analysisMetrics = null;
},

analysisProbeCell() {
  const x = clampInt(Math.round(this.nx * 0.58), this.activeInteriorMinX(), this.activeInteriorMaxX());
  const y = clampInt(Math.round(this.ny * 0.5), this.activeInteriorMinY(), this.activeInteriorMaxY());
  return this.id(x, y);
},

ensureAnalysisContour() {
  const margin = Math.max(3, Math.round(state.cellsPerWavelength * 0.28));
  const minX = clampInt(this.activeInteriorMinX() + margin, 1, this.nx - 2);
  const maxX = clampInt(this.activeInteriorMaxX() - margin, minX + 1, this.nx - 2);
  const minY = clampInt(this.activeInteriorMinY() + margin, 1, this.ny - 2);
  const maxY = clampInt(this.activeInteriorMaxY() - margin, minY + 1, this.ny - 2);
  const stride = Math.max(2, Math.round(state.cellsPerWavelength * 0.16));
  const key = `${state.fieldComponent},${this.nx},${this.ny},${minX},${maxX},${minY},${maxY},${stride}`;
  if (key === this.analysisContourKey) return;

  const samples = [];
  const push = (x, y, nx, ny) => samples.push({ x, y, idx: this.id(x, y), nx, ny, dl: stride });
  for (let x = minX; x <= maxX; x += stride) push(x, minY, 0, -1);
  for (let y = minY + stride; y <= maxY; y += stride) push(maxX, y, 1, 0);
  for (let x = maxX - stride; x >= minX; x -= stride) push(x, maxY, 0, 1);
  for (let y = maxY - stride; y > minY; y -= stride) push(minX, y, -1, 0);

  this.analysisContourKey = key;
  this.analysisContour = samples;
  this.analysisContourRe = new Float32Array(samples.length);
  this.analysisContourIm = new Float32Array(samples.length);
  this.analysisContourDnRe = new Float32Array(samples.length);
  this.analysisContourDnIm = new Float32Array(samples.length);
  this.analysisFarField = [];
  this.analysisFarFieldPeak = 0;
  this.analysisScatteringTotal = 0;
  this.analysisScatteringForward = 0;
  this.analysisScatteringBackward = 0;
  this.analysisMetrics = null;
},

scalarAnalysisValueAt(idx) {
  const value = this.fieldValueAt(idx, "scalar") * this.fieldScale;
  return Number.isFinite(value) ? value : 0;
},

analysisSourceCell() {
  const source = state.sources[0] || defaultSourceConfig;
  const x = this.sourceXCell(source);
  const y = this.sourceYCell(source);
  return this.id(x, y);
},

analysisSourceIntensityEstimate() {
  const source = state.sources[0] || defaultSourceConfig;
  const sx = this.sourceXCell(source);
  const sy = this.sourceYCell(source);
  const radius = Math.max(2, Math.round(this.sourceEnvelopeFwhmCells(source) * 0.55));
  let maxIntensity = 0;
  for (let y = Math.max(this.activeInteriorMinY(), sy - radius); y <= Math.min(this.activeInteriorMaxY(), sy + radius); y += 1) {
    for (let x = Math.max(this.activeInteriorMinX(), sx - radius); x <= Math.min(this.activeInteriorMaxX(), sx + radius); x += 1) {
      const idx = this.id(x, y);
      if (this.material[idx] === 2) continue;
      const value = this.scalarAnalysisValueAt(idx);
      const intensity = value * value;
      if (intensity > maxIntensity) maxIntensity = intensity;
    }
  }
  return maxIntensity;
},

analysisTotalFieldEnergy() {
  const scaleSquared = Number.isFinite(this.fieldScale) ? this.fieldScale * this.fieldScale : 0;
  if (scaleSquared <= 0) return 0;
  const minX = this.activeInteriorMinX();
  const maxX = this.activeInteriorMaxX();
  const minY = this.activeInteriorMinY();
  const maxY = this.activeInteriorMaxY();
  let energy = 0;
  for (let y = minY; y <= maxY; y += 1) {
    const row = y * this.nx;
    for (let x = minX; x <= maxX; x += 1) {
      const idx = row + x;
      if (this.material[idx] === 2) continue;
      const scalar = this.ez[idx];
      const tx = this.hx[idx];
      const ty = this.hy[idx];
      if (state.fieldComponent === "hz") {
        energy +=
          Math.abs(this.mu[idx]) * scalar * scalar +
          Math.abs(this.eps[idx]) * tx * tx +
          Math.abs(this.epsY[idx]) * ty * ty;
      } else {
        energy +=
          Math.abs(this.eps[idx]) * scalar * scalar +
          Math.abs(this.mu[idx]) * tx * tx +
          Math.abs(this.muY[idx]) * ty * ty;
      }
    }
  }
  return 0.5 * energy * scaleSquared;
},

hyperlensRingSample(radiusCells, angleCount = 96) {
  const centerX = clampInt(Math.round(this.nx * 0.5 + lambdaToCells(0.35)), this.activeInteriorMinX(), this.activeInteriorMaxX());
  const centerY = clampInt(Math.round(this.ny * 0.5), this.activeInteriorMinY(), this.activeInteriorMaxY());
  const harmonics = [2, 3, 4, 5, 6, 7, 8];
  const re = new Array(harmonics.length).fill(0);
  const im = new Array(harmonics.length).fill(0);
  let energy = 0;
  let samples = 0;
  for (let n = 0; n < angleCount; n += 1) {
    const theta = (2 * Math.PI * n) / angleCount;
    const x = clampInt(Math.round(centerX + radiusCells * Math.cos(theta)), this.activeInteriorMinX(), this.activeInteriorMaxX());
    const y = clampInt(Math.round(centerY + radiusCells * Math.sin(theta)), this.activeInteriorMinY(), this.activeInteriorMaxY());
    const idx = this.id(x, y);
    if (this.material[idx] === 2) continue;
    const value = this.scalarAnalysisValueAt(idx);
    energy += value * value;
    for (let h = 0; h < harmonics.length; h += 1) {
      const phase = harmonics[h] * theta;
      re[h] += value * Math.cos(phase);
      im[h] -= value * Math.sin(phase);
    }
    samples += 1;
  }
  if (samples <= 0) return { energy: 0, detail: 0 };
  let detail = 0;
  for (let h = 0; h < harmonics.length; h += 1) {
    const amplitude = (2 * Math.hypot(re[h], im[h])) / samples;
    detail += amplitude * amplitude;
  }
  return { energy: energy / samples, detail };
},

updateHyperlensAnalysis(alpha) {
  if (state.preset !== "hyperlens") return;
  const inner = this.hyperlensRingSample(lambdaToCells(0.52));
  const outer = this.hyperlensRingSample(lambdaToCells(1.16));
  this.analysisHyperlensInnerEnergyEwma = (1 - alpha) * this.analysisHyperlensInnerEnergyEwma + alpha * inner.energy;
  this.analysisHyperlensOuterEnergyEwma = (1 - alpha) * this.analysisHyperlensOuterEnergyEwma + alpha * outer.energy;
  this.analysisHyperlensInnerDetailEwma = (1 - alpha) * this.analysisHyperlensInnerDetailEwma + alpha * inner.detail;
  this.analysisHyperlensOuterDetailEwma = (1 - alpha) * this.analysisHyperlensOuterDetailEwma + alpha * outer.detail;
},

analysisHyperlensEstimate() {
  if (state.preset !== "hyperlens" || this.analysisSamples < 8) return null;
  const innerEnergy = Math.max(0, this.analysisHyperlensInnerEnergyEwma);
  const outerEnergy = Math.max(0, this.analysisHyperlensOuterEnergyEwma);
  const innerDetail = Math.max(0, this.analysisHyperlensInnerDetailEwma);
  const outerDetail = Math.max(0, this.analysisHyperlensOuterDetailEwma);
  return {
    innerEnergy,
    outerEnergy,
    transfer: innerEnergy > 1e-24 ? outerEnergy / innerEnergy : 0,
    innerDetail,
    outerDetail,
    detailTransfer: innerDetail > 1e-24 ? outerDetail / innerDetail : 0,
  };
},

analysisContourFluxEstimate() {
  const source = state.sources[0] || defaultSourceConfig;
  const sourceY = this.sourceYCell(source);
  const guidedBand = Math.max(3, Math.round(state.cellsPerWavelength * 0.32));
  const scaleSquared = Number.isFinite(this.fieldScale) ? this.fieldScale * this.fieldScale : 0;
  let outward = 0;
  let guided = 0;

  for (const sample of this.analysisContour) {
    const s = this.poyntingAt(sample.idx);
    const flux = (s.x * sample.nx + s.y * sample.ny) * (sample.dl || 1) * scaleSquared;
    if (!Number.isFinite(flux) || flux <= 0) continue;
    outward += flux;
    if (Math.abs(sample.nx) > 0.5 && Math.abs(sample.y - sourceY) <= guidedBand) {
      guided += flux;
    }
  }

  return { outward, guided };
},

normalDerivativeSourceAt(sample) {
  const idx = sample.idx;
  let value;
  if (state.fieldComponent === "hz") {
    value = sample.ny * this.hx[idx] - sample.nx * this.hy[idx];
  } else {
    value = sample.nx * this.hy[idx] - sample.ny * this.hx[idx];
  }
  const scaled = value * this.fieldScale;
  return Number.isFinite(scaled) ? scaled : 0;
},

analysisScatteringSource() {
  if (!scatteringAnalysisPresets.has(state.preset)) return null;
  const source = this.diagnosticIncidentSource();
  if (!source || source.shape !== "line" || source.type !== "sine") return null;
  return source;
},

incidentPlaneWaveReferenceAt(sample, source, k) {
  const sx = this.sourceXCell(source);
  const sy = this.sourceYCell(source);
  const theta = ((Number(source.angleDeg) || 0) * Math.PI) / 180;
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const phase =
    -k * ((sample.x - sx) * ux + (sample.y - sy) * uy) + ((Number(source.phaseDeg) || 0) * Math.PI) / 180;
  const amplitude = Number(source.amplitude) || defaultSourceConfig.amplitude;
  const normalProjection = sample.nx * ux + sample.ny * uy;
  const derivativeAmplitude = (-normalProjection * amplitude) / Math.max(this.courant, 1e-9);

  return {
    scalarRe: 0.5 * amplitude * Math.sin(phase),
    scalarIm: -0.5 * amplitude * Math.cos(phase),
    dnRe: 0.5 * derivativeAmplitude * Math.sin(phase),
    dnIm: -0.5 * derivativeAmplitude * Math.cos(phase),
  };
},

updateAnalysisDiagnostics() {
  if (!state.analysisEnabled || this.time % Math.max(1, state.analysisSampleEvery) !== 0) return;
  this.ensureAnalysisContour();
  const frequency = Math.max(1e-6, this.diagnosticFrequency());
  const phase = 2 * Math.PI * frequency * this.time;
  const cosPhase = Math.cos(phase);
  const sinPhase = Math.sin(phase);
  const alpha = this.analysisSamples < 32 ? 0.18 : 0.035;

  const probeValue = this.scalarAnalysisValueAt(this.analysisProbeCell());
  this.analysisProbeSeries[this.analysisProbeIndex] = probeValue;
  this.analysisProbeIndex = (this.analysisProbeIndex + 1) % this.analysisProbeSeries.length;
  this.analysisProbeCount = Math.min(this.analysisProbeCount + 1, this.analysisProbeSeries.length);

  const energyValue = this.analysisTotalFieldEnergy();
  this.analysisEnergySeries[this.analysisEnergyIndex] = energyValue;
  this.analysisEnergyIndex = (this.analysisEnergyIndex + 1) % this.analysisEnergySeries.length;
  this.analysisEnergyCount = Math.min(this.analysisEnergyCount + 1, this.analysisEnergySeries.length);

  const sourceIntensity = this.analysisSourceIntensityEstimate();
  const fluxEstimate = this.analysisContourFluxEstimate();
  this.analysisEnergyEwma = (1 - alpha) * this.analysisEnergyEwma + alpha * energyValue;
  this.analysisSourceIntensityEwma = (1 - alpha) * this.analysisSourceIntensityEwma + alpha * sourceIntensity;
  this.analysisOutwardFluxEwma = (1 - alpha) * this.analysisOutwardFluxEwma + alpha * fluxEstimate.outward;
  this.analysisGuidedFluxEwma = (1 - alpha) * this.analysisGuidedFluxEwma + alpha * fluxEstimate.guided;
  this.updateHyperlensAnalysis(alpha);

  for (let i = 0; i < this.analysisContour.length; i += 1) {
    const sample = this.analysisContour[i];
    const value = this.scalarAnalysisValueAt(sample.idx);
    const normalDerivativeSource = this.normalDerivativeSourceAt(sample);
    this.analysisContourRe[i] = (1 - alpha) * this.analysisContourRe[i] + alpha * value * cosPhase;
    this.analysisContourIm[i] = (1 - alpha) * this.analysisContourIm[i] - alpha * value * sinPhase;
    this.analysisContourDnRe[i] = (1 - alpha) * this.analysisContourDnRe[i] + alpha * normalDerivativeSource * cosPhase;
    this.analysisContourDnIm[i] = (1 - alpha) * this.analysisContourDnIm[i] - alpha * normalDerivativeSource * sinPhase;
  }
  this.analysisSamples += 1;
  this.analysisFarField = [];
  this.analysisFarFieldPeak = 0;
  this.analysisScatteringTotal = 0;
  this.analysisScatteringForward = 0;
  this.analysisScatteringBackward = 0;
  this.analysisMetrics = null;
},

analysisOrderedSeries(series, index, count) {
  const length = series.length || 0;
  if (count <= 0 || length <= 0) return [];
  const start = (index - count + length) % length;
  const values = [];
  for (let i = 0; i < count; i += 1) {
    values.push(series[(start + i) % length]);
  }
  return values;
},

orderedAnalysisProbeSamples() {
  return this.analysisOrderedSeries(this.analysisProbeSeries, this.analysisProbeIndex, this.analysisProbeCount);
},

orderedAnalysisEnergySamples() {
  return this.analysisOrderedSeries(this.analysisEnergySeries, this.analysisEnergyIndex, this.analysisEnergyCount);
},

analysisSpectrumEstimate(binCount = 96) {
  const values = this.orderedAnalysisProbeSamples();
  if (values.length < 32) return null;
  const dt = Math.max(1, state.analysisSampleEvery);
  const maxFrequency = 0.1;
  const bins = [];
  let maxMag = 0;

  for (let b = 1; b < binCount; b += 1) {
    const f = (maxFrequency * b) / (binCount - 1);
    let re = 0;
    let im = 0;
    for (let n = 0; n < values.length; n += 1) {
      const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / Math.max(1, values.length - 1));
      const phase = 2 * Math.PI * f * dt * n;
      re += window * values[n] * Math.cos(phase);
      im -= window * values[n] * Math.sin(phase);
    }
    const magnitude = Math.hypot(re, im) / values.length;
    if (magnitude > maxMag) maxMag = magnitude;
    bins.push({ f, magnitude });
  }

  if (maxMag <= 1e-14) return null;
  let peakIndex = 0;
  for (let i = 1; i < bins.length; i += 1) {
    if (bins[i].magnitude > bins[peakIndex].magnitude) peakIndex = i;
  }

  let secondIndex = -1;
  for (let i = 0; i < bins.length; i += 1) {
    if (Math.abs(i - peakIndex) < 3) continue;
    if (secondIndex < 0 || bins[i].magnitude > bins[secondIndex].magnitude) secondIndex = i;
  }

  const halfPower = bins[peakIndex].magnitude / Math.SQRT2;
  let left = peakIndex;
  while (left > 0 && bins[left].magnitude > halfPower) left -= 1;
  let right = peakIndex;
  while (right < bins.length - 1 && bins[right].magnitude > halfPower) right += 1;
  const bandwidth = right > left ? Math.max(1e-6, bins[right].f - bins[left].f) : 0;
  const spectralQ = bandwidth > 0 ? bins[peakIndex].f / bandwidth : 0;

  return {
    peakFrequency: bins[peakIndex].f,
    peakMagnitude: bins[peakIndex].magnitude,
    spectralQ,
    secondFrequency: secondIndex >= 0 ? bins[secondIndex].f : 0,
    secondMagnitude: secondIndex >= 0 ? bins[secondIndex].magnitude : 0,
  };
},

analysisSpectrumMagnitudeAt(targetFrequency) {
  const values = this.orderedAnalysisProbeSamples();
  if (values.length < 32 || !Number.isFinite(targetFrequency) || targetFrequency <= 0) return 0;
  const dt = Math.max(1, state.analysisSampleEvery);
  let re = 0;
  let im = 0;
  let windowSum = 0;
  for (let n = 0; n < values.length; n += 1) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / Math.max(1, values.length - 1));
    const phase = 2 * Math.PI * targetFrequency * dt * n;
    re += window * values[n] * Math.cos(phase);
    im -= window * values[n] * Math.sin(phase);
    windowSum += window;
  }
  return windowSum > 1e-12 ? Math.hypot(re, im) / windowSum : 0;
},

analysisFloquetEstimate(orderLimit = 2) {
  if (!temporalFloquetAnalysisPresets.has(state.preset)) return null;
  if (this.diagnosticDftSummary?.orders?.length && this.diagnosticDftSampleCount >= 48) {
    return this.diagnosticDftSummary;
  }
  const modulationFrequency = Math.abs(Number(state.modulationFrequency) || 0);
  if (!Number.isFinite(modulationFrequency) || modulationFrequency <= 1e-6) return null;
  if (this.analysisProbeCount < 48) return null;
  const carrierFrequency = Math.max(1e-6, this.diagnosticFrequency());
  const carrierMagnitude = this.analysisSpectrumMagnitudeAt(carrierFrequency);
  if (!Number.isFinite(carrierMagnitude) || carrierMagnitude <= 1e-12) return null;
  const orders = [];
  let sidebandPower = 0;
  let upPower = 0;
  let downPower = 0;
  let maxSidebandRatio = 0;
  let maxSidebandOrder = 0;

  for (let order = -orderLimit; order <= orderLimit; order += 1) {
    const frequency = carrierFrequency + order * modulationFrequency;
    const magnitude = frequency > 1e-6 ? this.analysisSpectrumMagnitudeAt(frequency) : 0;
    const amplitudeRatio = magnitude / carrierMagnitude;
    const powerRatio = amplitudeRatio * amplitudeRatio;
    orders.push({
      order,
      frequency,
      magnitude,
      amplitudeRatio,
      powerRatio,
    });
    if (order === 0) continue;
    sidebandPower += powerRatio;
    if (order > 0) upPower += powerRatio;
    else downPower += powerRatio;
    if (amplitudeRatio > maxSidebandRatio) {
      maxSidebandRatio = amplitudeRatio;
      maxSidebandOrder = order;
    }
  }

  return {
    carrierFrequency,
    modulationFrequency,
    carrierMagnitude,
    orders,
    sidebandPower,
    upPower,
    downPower,
    maxSidebandRatio,
    maxSidebandOrder,
    firstUpper: orders.find((channel) => channel.order === 1)?.amplitudeRatio || 0,
    firstLower: orders.find((channel) => channel.order === -1)?.amplitudeRatio || 0,
  };
},

phaseChangeStateEstimate() {
  if (!state.materialPhaseChangeEnabled) return 0;
  let count = 0;
  let sum = 0;
  for (let i = 0; i < this.n; i += 1) {
    if (!this.phaseChangeMaterial[i]) continue;
    count += 1;
    sum += this.phaseState[i];
  }
  return count > 0 ? sum / count : 0;
},

estimateBalancedGainLossMagnitude() {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < this.n; i += 1) {
    if (this.material[i] === 2) continue;
    const value = Math.abs(Number(this.loss[i]) || 0);
    if (value < 0.008) continue;
    sum += value;
    count += 1;
  }
  if (count > 0) return sum / count;
  return state.preset === "exceptionalPointCoupler" ? 0.04 : 0.032;
},

ptModalEstimate() {
  if (!ptModalAnalysisPresets.has(state.preset)) return null;
  const gamma = this.estimateBalancedGainLossMagnitude();
  const coupling = state.preset === "exceptionalPointCoupler" ? 0.04 : 0.045;
  const normalizedGamma = coupling > 1e-9 ? gamma / coupling : 0;
  const discriminant = coupling * coupling - gamma * gamma;
  const realSplit = 2 * Math.sqrt(Math.max(0, discriminant));
  const imagSplit = 2 * Math.sqrt(Math.max(0, -discriminant));
  const epDistance = Math.abs(normalizedGamma - 1);
  const phase = epDistance < 0.035 ? "near-EP" : normalizedGamma < 1 ? "unbroken" : "broken";
  return {
    gamma,
    coupling,
    normalizedGamma,
    realSplit,
    imagSplit,
    epDistance,
    phase,
    coalescence: 1 / (1 + 24 * epDistance),
  };
},

sshBlochEstimate() {
  if (!sshBlochAnalysisPresets.has(state.preset)) return null;
  const topological = state.preset !== "sshTrivial";
  const t1 = topological ? 0.25 : 0.42;
  const t2 = topological ? 0.42 : 0.25;
  const winding = t2 > t1 ? 1 : 0;
  const bandGap = 2 * Math.abs(t2 - t1);
  const edgeExpected = state.preset === "sshInterface" || state.preset === "sshDisorder" || state.preset === "nonHermitianSsh";
  const gamma = state.preset === "nonHermitianSsh" ? this.estimateBalancedGainLossMagnitude() : 0;
  const nonHermitianGap = Math.sqrt(Math.max(0, Math.pow(Math.abs(t2 - t1), 2) - gamma * gamma));
  return {
    t1,
    t2,
    winding,
    bandGap,
    edgeExpected,
    gamma,
    nonHermitianGap,
  };
},

phcInverseEpsilonFourier(aCells, bounds, basis) {
  if (!bounds || bounds.maxX < bounds.minX || bounds.maxY < bounds.minY) return null;
  const reciprocalKeys = new Map();
  basis.forEach((left) => {
    basis.forEach((right) => {
      const qx = left.gx - right.gx;
      const qy = left.gy - right.gy;
      const key = `${qx},${qy}`;
      if (!reciprocalKeys.has(key)) reciprocalKeys.set(key, { qx, qy, re: 0, im: 0 });
    });
  });
  const qValues = Array.from(reciprocalKeys.values());
  const originX = (bounds.minX + bounds.maxX) * 0.5;
  const originY = (bounds.minY + bounds.maxY) * 0.5;
  const phaseScale = (2 * Math.PI) / Math.max(2, aCells);
  let area = 0;
  let epsSum = 0;
  let highIndexArea = 0;

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    const row = y * this.nx;
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const idx = row + x;
      if (this.material[idx] === 2) continue;
      let epsValue = Math.max(Math.abs(this.eps[idx]), Math.abs(this.epsY[idx]), 1);
      if (!Number.isFinite(epsValue) || epsValue <= 1e-6) epsValue = 1;
      const invEps = 1 / clamp(epsValue, 0.05, 100);
      const dx = x - originX;
      const dy = y - originY;
      qValues.forEach((q) => {
        const phase = -phaseScale * (q.qx * dx + q.qy * dy);
        q.re += invEps * Math.cos(phase);
        q.im += invEps * Math.sin(phase);
      });
      epsSum += epsValue;
      if (epsValue > 1.2 && this.material[idx] !== 0) highIndexArea += 1;
      area += 1;
    }
  }

  if (area <= 0) return null;
  const coefficients = new Map();
  let maxNonzeroMagnitude = 0;
  qValues.forEach((q) => {
    const re = q.re / area;
    const im = q.im / area;
    const magnitude = Math.hypot(re, im);
    if (q.qx !== 0 || q.qy !== 0) maxNonzeroMagnitude = Math.max(maxNonzeroMagnitude, magnitude);
    coefficients.set(`${q.qx},${q.qy}`, { re, im, magnitude });
  });
  const eta0 = coefficients.get("0,0")?.re || 1;
  return {
    coefficients,
    eta0,
    inverseEpsContrast: maxNonzeroMagnitude / Math.max(1e-9, Math.abs(eta0)),
    fillFraction: highIndexArea / area,
    averageEps: epsSum / area,
    area,
  };
},

phcPlaneWaveBandsAt(kxNorm, kyNorm, aCells, fourier, basis) {
  if (!fourier || !basis?.length) return [];
  const reciprocal = (2 * Math.PI) / Math.max(2, aCells);
  const frequencyScale = COURANT / (2 * Math.PI);
  const kx = (Math.PI * clamp(kxNorm, 0, 1)) / Math.max(2, aCells);
  const ky = (Math.PI * clamp(kyNorm, 0, 1)) / Math.max(2, aCells);
  const matrix = basis.map(() => basis.map(() => 0));
  for (let i = 0; i < basis.length; i += 1) {
    const left = basis[i];
    const leftX = kx + reciprocal * left.gx;
    const leftY = ky + reciprocal * left.gy;
    for (let j = i; j < basis.length; j += 1) {
      const right = basis[j];
      const rightX = kx + reciprocal * right.gx;
      const rightY = ky + reciprocal * right.gy;
      const diffKey = `${left.gx - right.gx},${left.gy - right.gy}`;
      const coeff = fourier.coefficients.get(diffKey);
      const eta = i === j ? fourier.eta0 : coeff?.re || 0;
      const value = (leftX * rightX + leftY * rightY) * eta;
      matrix[i][j] = value;
      matrix[j][i] = value;
    }
  }
  return symmetricJacobiEigenvalues(matrix)
    .map((eigenvalue) => Math.sqrt(Math.max(0, eigenvalue)) * frequencyScale)
    .filter((frequency) => Number.isFinite(frequency))
    .sort((left, right) => left - right);
},

phcBlochPathEstimate(aCells, fourier, basis) {
  const waypoints = [
    { label: "G", kx: 0, ky: 0 },
    { label: "X", kx: 1, ky: 0 },
    { label: "M", kx: 1, ky: 1 },
    { label: "G", kx: 0, ky: 0 },
  ];
  const samplesPerSegment = 4;
  const points = [];
  let distance = 0;
  let previous = null;
  let minGap = Infinity;
  let minGapLabel = "";
  let minGapRatio = 0;
  let firstBandMax = 0;
  let secondBandMin = Infinity;

  for (let segment = 0; segment < waypoints.length - 1; segment += 1) {
    const start = waypoints[segment];
    const end = waypoints[segment + 1];
    for (let index = 0; index <= samplesPerSegment; index += 1) {
      if (segment > 0 && index === 0) continue;
      const t = index / samplesPerSegment;
      const kx = start.kx + (end.kx - start.kx) * t;
      const ky = start.ky + (end.ky - start.ky) * t;
      if (previous) distance += Math.hypot(kx - previous.kx, ky - previous.ky);
      const bands = this.phcPlaneWaveBandsAt(kx, ky, aCells, fourier, basis).slice(0, 4);
      if (bands.length >= 2) {
        const gap = Math.max(0, bands[1] - bands[0]);
        const center = 0.5 * (bands[0] + bands[1]);
        const label = index === 0 ? start.label : index === samplesPerSegment ? end.label : `${start.label}-${end.label}`;
        if (gap < minGap) {
          minGap = gap;
          minGapLabel = label;
          minGapRatio = center > 1e-9 ? gap / center : 0;
        }
        firstBandMax = Math.max(firstBandMax, bands[0]);
        secondBandMin = Math.min(secondBandMin, bands[1]);
      }
      points.push({ kx, ky, distance, label: index === samplesPerSegment ? end.label : "", bands });
      previous = { kx, ky };
    }
  }

  return {
    pointCount: points.length,
    points,
    minGap: Number.isFinite(minGap) ? minGap : 0,
    minGapLabel,
    minGapRatio,
    firstBandMax,
    secondBandMin: Number.isFinite(secondBandMin) ? secondBandMin : 0,
  };
},

phcPlaneWaveBlochEstimate(kNorm, aCells, bounds) {
  const basisShells = 1;
  const basis = planeWaveBasis(basisShells);
  const fourier = this.phcInverseEpsilonFourier(aCells, bounds, basis);
  if (!fourier) return null;

  const k = clamp(Number(kNorm) || 0, 0, 1);
  const bands = this.phcPlaneWaveBandsAt(k, 0, aCells, fourier, basis).slice(0, 4);
  if (bands.length === 0) return null;
  const lowerBand = bands[0] || 0;
  const upperBand = bands[1] || 0;
  const bandGap = Math.max(0, upperBand - lowerBand);
  const gapCenter = 0.5 * (lowerBand + upperBand);
  const delta = 0.02;
  const kLow = clamp(k - delta, 0, 1);
  const kHigh = clamp(k + delta, 0, 1);
  const lowBands = this.phcPlaneWaveBandsAt(kLow, 0, aCells, fourier, basis);
  const highBands = this.phcPlaneWaveBandsAt(kHigh, 0, aCells, fourier, basis);
  const groupVelocity =
    kHigh > kLow && lowBands.length > 0 && highBands.length > 0
      ? (highBands[0] - lowBands[0]) / (kHigh - kLow)
      : 0;
  const path = this.phcBlochPathEstimate(aCells, fourier, basis);

  return {
    basisSize: basis.length,
    basisShells,
    eta0: fourier.eta0,
    inverseEpsContrast: fourier.inverseEpsContrast,
    fillFraction: fourier.fillFraction,
    averageEps: fourier.averageEps,
    bands,
    fundamentalFrequency: lowerBand,
    secondBandFrequency: upperBand,
    bandGap,
    gapRatio: gapCenter > 1e-9 ? bandGap / gapCenter : 0,
    groupVelocity,
    normalizedFrequency: (lowerBand * aCells) / Math.max(1e-9, COURANT),
    path,
  };
},

phcBlochEstimate(kNorm = 0) {
  if (!phcBlochAnalysisPresets.has(state.preset)) return null;
  const k = clamp(Number(kNorm) || 0, 0, 1);
  const aCells = Math.max(2, lambdaToCells(0.45));
  const cx = (this.nx - 1) * 0.5;
  const cy = (this.ny - 1) * 0.5;
  const phaseScale = (Math.PI * k) / aCells;
  let count = 0;
  let weightSum = 0;
  let epsSum = 0;
  let re = 0;
  let im = 0;
  let oddX = 0;
  let oddY = 0;
  let secondMoment = 0;
  let materialMinX = this.nx;
  let materialMaxX = -1;
  let materialMinY = this.ny;
  let materialMaxY = -1;

  const minX = this.activeInteriorMinX();
  const maxX = this.activeInteriorMaxX();
  const minY = this.activeInteriorMinY();
  const maxY = this.activeInteriorMaxY();
  for (let y = minY; y <= maxY; y += 1) {
    const row = y * this.nx;
    for (let x = minX; x <= maxX; x += 1) {
      const idx = row + x;
      if (this.material[idx] === 0 || this.material[idx] === 2) continue;
      const epsValue = Math.max(Math.abs(this.eps[idx]), Math.abs(this.epsY[idx]));
      if (epsValue < 1.2) continue;
      const weight = clamp(epsValue - 1, 0, 30);
      if (weight <= 0) continue;
      const dx = x - cx;
      const dy = y - cy;
      const phase = phaseScale * dx;
      re += weight * Math.cos(phase);
      im += weight * Math.sin(phase);
      oddX += weight * Math.sign(dx || 0);
      oddY += weight * Math.sign(dy || 0);
      secondMoment += weight * (dx * dx + dy * dy);
      epsSum += epsValue * weight;
      weightSum += weight;
      materialMinX = Math.min(materialMinX, x);
      materialMaxX = Math.max(materialMaxX, x);
      materialMinY = Math.min(materialMinY, y);
      materialMaxY = Math.max(materialMaxY, y);
      count += 1;
    }
  }

  if (count === 0 || weightSum <= 1e-12) return null;
  const padding = Math.max(2, Math.round(0.55 * aCells));
  const modalBounds = {
    minX: Math.max(minX, materialMinX - padding),
    maxX: Math.min(maxX, materialMaxX + padding),
    minY: Math.max(minY, materialMinY - padding),
    maxY: Math.min(maxY, materialMaxY + padding),
  };
  const modal = this.phcPlaneWaveBlochEstimate(k, aCells, modalBounds);
  const structureFactor = Math.hypot(re, im) / weightSum;
  const asymmetry = Math.hypot(oddX, oddY) / weightSum;
  const averageEps = epsSum / weightSum;
  const radiusCells = Math.sqrt(secondMoment / weightSum);
  const finiteSizeLeakage = 1 / Math.max(20, radiusCells);
  const kLeakage = 0.08 * k * k;
  const symmetryLeakage = asymmetry * asymmetry;
  const contrastLeakage = 0.015 * Math.max(0, 1 - structureFactor);
  const leakage = clamp(finiteSizeLeakage + kLeakage + symmetryLeakage + contrastLeakage, 0, 1);
  const qProxy = 1 / Math.max(1e-6, leakage);
  const baseFrequency = (COURANT / Math.max(8, state.cellsPerWavelength)) / Math.sqrt(Math.max(1, averageEps));
  const fallbackBandFrequency = baseFrequency * (1 + 0.28 * (1 - Math.cos(Math.PI * k)));
  const fallbackGroupProxy = baseFrequency * 0.28 * Math.PI * Math.sin(Math.PI * k);
  const bandFrequency = modal?.fundamentalFrequency ?? fallbackBandFrequency;
  const groupProxy = modal?.groupVelocity ?? fallbackGroupProxy;
  return {
    k,
    structureFactor,
    asymmetry,
    leakage,
    qProxy,
    bandFrequency,
    groupProxy,
    averageEps,
    cells: count,
    modal,
  };
},

analysisRingdownEstimate(peakFrequency) {
  const values = this.orderedAnalysisEnergySamples();
  if (values.length < 48) return null;
  let peakIndex = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > values[peakIndex]) peakIndex = i;
  }
  const start = peakIndex + 8;
  if (values.length - start < 24) return null;
  let tailMax = 0;
  for (let i = start; i < values.length; i += 1) {
    if (values[i] > tailMax) tailMax = values[i];
  }
  if (tailMax <= 1e-24) return null;

  const threshold = tailMax * 1e-5;
  const dt = Math.max(1, state.analysisSampleEvery);
  let count = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = start; i < values.length; i += 1) {
    const energy = values[i];
    if (!Number.isFinite(energy) || energy <= threshold) continue;
    const t = (i - start) * dt;
    const logEnergy = Math.log(energy);
    count += 1;
    sx += t;
    sy += logEnergy;
    sxx += t * t;
    sxy += t * logEnergy;
  }
  const denom = count * sxx - sx * sx;
  if (count < 16 || Math.abs(denom) < 1e-9) return null;
  const slope = (count * sxy - sx * sy) / denom;
  if (!Number.isFinite(slope) || slope >= -1e-7) return null;
  const frequency = Math.max(1e-6, peakFrequency || this.diagnosticFrequency());
  const q = (-2 * Math.PI * frequency) / slope;
  if (!Number.isFinite(q) || q <= 0) return null;
  return {
    q,
    decayTime: -1 / slope,
    points: count,
    peakSample: peakIndex,
  };
},

analysisMetricEstimate() {
  if (!state.analysisEnabled) return null;
  const ptModal = this.ptModalEstimate();
  const sshBloch = this.sshBlochEstimate();
  const phcBloch = this.phcBlochEstimate(0);
  const phaseAverage = this.phaseChangeStateEstimate();
  const floquet = this.analysisFloquetEstimate();
  const hyperlens = this.analysisHyperlensEstimate();
  if (this.analysisSamples < 8) {
    this.analysisMetrics = {
      spectrum: null,
      ringdown: null,
      beta: 0,
      modeAreaLambda2: 0,
      purcellProxy: 0,
      leakageRate: 0,
      split: ptModal ? Math.max(ptModal.realSplit, ptModal.imagSplit) : 0,
      spectralSplit: 0,
      ptModal,
      sshBloch,
      phcBloch,
      harmonic2: 0,
      harmonic3: 0,
      sidebandRatio: 0,
      phaseAverage,
      floquet,
      hyperlens,
    };
    return this.analysisMetrics;
  }
  const spectrum = this.analysisSpectrumEstimate();
  const ringdown = this.analysisRingdownEstimate(spectrum?.peakFrequency || this.diagnosticFrequency());
  const beta =
    this.analysisOutwardFluxEwma > 1e-18
      ? clamp(this.analysisGuidedFluxEwma / this.analysisOutwardFluxEwma, 0, 1)
      : 0;
  const modeAreaLambda2 =
    this.analysisSourceIntensityEwma > 1e-18
      ? this.analysisEnergyEwma / this.analysisSourceIntensityEwma / Math.max(1, state.cellsPerWavelength * state.cellsPerWavelength)
      : 0;
  const purcellProxy = ringdown && modeAreaLambda2 > 1e-9 ? ringdown.q / modeAreaLambda2 : 0;
  const leakageRate =
    this.analysisEnergyEwma > 1e-18 ? Math.max(0, this.analysisOutwardFluxEwma) / this.analysisEnergyEwma : 0;
  const spectralSplit =
    spectrum && spectrum.secondMagnitude > spectrum.peakMagnitude * 0.18
      ? Math.abs(spectrum.secondFrequency - spectrum.peakFrequency)
      : 0;
  const split = ptModal ? Math.max(ptModal.realSplit, ptModal.imagSplit) : spectralSplit;
  const fundamentalFrequency = Math.max(1e-6, this.diagnosticFrequency());
  const fundamentalMagnitude = this.analysisSpectrumMagnitudeAt(fundamentalFrequency);
  const harmonic2Magnitude = this.analysisSpectrumMagnitudeAt(2 * fundamentalFrequency);
  const harmonic3Magnitude = this.analysisSpectrumMagnitudeAt(3 * fundamentalFrequency);
  const harmonic2 = fundamentalMagnitude > 1e-12 ? harmonic2Magnitude / fundamentalMagnitude : 0;
  const harmonic3 = fundamentalMagnitude > 1e-12 ? harmonic3Magnitude / fundamentalMagnitude : 0;
  const sidebandRatio = spectrum?.peakMagnitude > 1e-12 ? spectrum.secondMagnitude / spectrum.peakMagnitude : 0;

  this.analysisMetrics = {
    spectrum,
    ringdown,
    beta,
    modeAreaLambda2,
    purcellProxy,
    leakageRate,
    split,
    spectralSplit,
    ptModal,
    sshBloch,
    phcBloch,
    harmonic2,
    harmonic3,
    sidebandRatio,
    phaseAverage,
    floquet,
    hyperlens,
  };
  return this.analysisMetrics;
},

analysisFarFieldEstimate(angleCount = 96) {
  if (!state.analysisEnabled || this.analysisSamples < 4) return [];
  if (this.analysisFarField.length === angleCount) return this.analysisFarField;
  this.ensureAnalysisContour();
  if (this.analysisContour.length === 0) return [];
  const frequency = Math.max(1e-6, this.diagnosticFrequency());
  const omega = 2 * Math.PI * frequency;
  const k = (2 * Math.PI * frequency) / Math.max(1e-6, this.courant);
  const scatteringSource = this.analysisScatteringSource();
  const scatteringMode = Boolean(scatteringSource);
  const incidentAmplitude = scatteringMode
    ? Math.max(1e-9, Math.abs(Number(scatteringSource.amplitude) || defaultSourceConfig.amplitude))
    : 1;
  const cx = this.nx * 0.5;
  const cy = this.ny * 0.5;
  const values = [];
  let maxPower = 0;
  let maxSigma = 0;

  for (let a = 0; a < angleCount; a += 1) {
    const theta = (2 * Math.PI * a) / angleCount;
    const ux = Math.cos(theta);
    const uy = Math.sin(theta);
    let re = 0;
    let im = 0;
    for (let i = 0; i < this.analysisContour.length; i += 1) {
      const sample = this.analysisContour[i];
      const projection = (sample.x - cx) * ux + (sample.y - cy) * uy;
      const phase = k * projection;
      const c = Math.cos(phase);
      const s = Math.sin(phase);
      let scalarRe = this.analysisContourRe[i];
      let scalarIm = this.analysisContourIm[i];
      let derivativeSourceRe = this.analysisContourDnRe[i];
      let derivativeSourceIm = this.analysisContourDnIm[i];
      const normalProjection = sample.nx * ux + sample.ny * uy;

      if (scatteringMode) {
        const incident = this.incidentPlaneWaveReferenceAt(sample, scatteringSource, k);
        scalarRe -= incident.scalarRe;
        scalarIm -= incident.scalarIm;
        derivativeSourceRe -= incident.dnRe;
        derivativeSourceIm -= incident.dnIm;
      }

      const dNormalRe = -omega * derivativeSourceIm;
      const dNormalIm = omega * derivativeSourceRe;
      const radiationRe = dNormalRe + k * normalProjection * scalarIm;
      const radiationIm = dNormalIm - k * normalProjection * scalarRe;
      const dl = sample.dl || 1;
      re += dl * (radiationRe * c + radiationIm * s);
      im += dl * (radiationIm * c - radiationRe * s);
    }
    const power = re * re + im * im;
    if (power > maxPower) maxPower = power;
    const sigma = scatteringMode ? power / (4 * Math.PI * Math.PI * incidentAmplitude * incidentAmplitude) : 0;
    if (sigma > maxSigma) maxSigma = sigma;
    values.push({ theta, power, sigma });
  }

  if (scatteringMode) {
    const dTheta = (2 * Math.PI) / Math.max(1, angleCount);
    const sourceTheta = (((Number(scatteringSource.angleDeg) || 0) % 360) * Math.PI) / 180;
    const angularDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    const nearestSigma = (target) => {
      let best = values[0] || { sigma: 0, theta: 0 };
      let bestDistance = Infinity;
      for (const point of values) {
        const distance = angularDistance(point.theta, target);
        if (distance < bestDistance) {
          best = point;
          bestDistance = distance;
        }
      }
      return best.sigma || 0;
    };
    const scale = maxSigma > 1e-24 ? 1 / maxSigma : 0;
    this.analysisFarFieldMode = "scattering";
    this.analysisFarFieldPeak = maxSigma;
    this.analysisScatteringTotal = values.reduce((sum, point) => sum + (point.sigma || 0) * dTheta, 0);
    this.analysisScatteringForward = nearestSigma(sourceTheta);
    this.analysisScatteringBackward = nearestSigma(sourceTheta + Math.PI);
    this.analysisFarField = values.map((point) => ({
      theta: point.theta,
      value: point.sigma * scale,
      sigma: point.sigma,
    }));
    return this.analysisFarField;
  }

  const scale = maxPower > 1e-24 ? 1 / maxPower : 0;
  this.analysisFarFieldMode = "ntff";
  this.analysisFarFieldPeak = maxPower;
  this.analysisScatteringTotal = 0;
  this.analysisScatteringForward = 0;
  this.analysisScatteringBackward = 0;
  this.analysisFarField = values.map((point) => ({ theta: point.theta, value: point.power * scale }));
  return this.analysisFarField;
},

fieldValueAt(i, display = state.fieldDisplay) {
  if (state.viewMode === "poynting") {
    const s = this.poyntingAt(i);
    if (display === "transverseX") return s.x;
    if (display === "transverseY") return s.y;
    return Math.hypot(s.x, s.y);
  }
  if (display === "transverseX") return this.hx[i];
  if (display === "transverseY") return this.hy[i];
  if (display === "electricMag") {
    if (state.fieldComponent === "hz") {
      if (this.fullVectorBianisotropyActive()) return Math.hypot(this.hx[i], this.hy[i], this.dualEz[i]);
      return Math.hypot(this.hx[i], this.hy[i]);
    }
    return Math.abs(this.ez[i]);
  }
  if (display === "magneticMag") {
    if (state.fieldComponent === "hz") {
      if (this.fullVectorBianisotropyActive()) return Math.hypot(this.ez[i], this.dualHx[i], this.dualHy[i]);
      return Math.abs(this.ez[i]);
    }
    return Math.hypot(this.hx[i], this.hy[i]);
  }
  return this.ez[i];
},

poyntingAt(i) {
  if (state.fieldComponent === "hz") {
    if (this.fullVectorBianisotropyActive()) {
      return {
        x: this.hy[i] * this.ez[i] - this.dualEz[i] * this.dualHy[i],
        y: this.dualEz[i] * this.dualHx[i] - this.hx[i] * this.ez[i],
      };
    }
    return { x: this.hy[i] * this.ez[i], y: -this.hx[i] * this.ez[i] };
  }
  return { x: -this.ez[i] * this.hy[i], y: this.ez[i] * this.hx[i] };
},

dispersiveDeltaEpsilonAt(idx, angularFrequency) {
  const kind = this.dispersiveMaterial[idx];
  if (!kind) return 0;
  const omega = Math.max(1e-9, Math.abs(angularFrequency));
  const gamma = Math.max(0, this.dispersionGamma[idx]);
  if (kind === 1) {
    const omegaP = Math.max(0, this.dispersionOmegaP[idx]);
    return -(omegaP * omegaP) / Math.max(1e-12, omega * omega + gamma * gamma);
  }
  if (kind === 2) {
    const omega0 = Math.max(0, this.dispersionOmega0[idx]);
    const deltaEps = this.dispersionDeltaEps[idx];
    const detuning = omega0 * omega0 - omega * omega;
    const denominator = detuning * detuning + gamma * gamma * omega * omega;
    return denominator > 1e-12 ? (deltaEps * omega0 * omega0 * detuning) / denominator : 0;
  }
  if (kind === 3) {
    const tau = Math.max(1, this.dispersionTau[idx]);
    return this.dispersionDeltaEps[idx] / (1 + omega * omega * tau * tau);
  }
  return 0;
},

dispersiveDeltaMuAt(idx, angularFrequency) {
  const kind = this.muDispersiveMaterial[idx];
  if (!kind) return 0;
  const omega = Math.max(1e-9, Math.abs(angularFrequency));
  const gamma = Math.max(0, this.muDispersionGamma[idx]);
  if (kind === 1) {
    const omegaP = Math.max(0, this.muDispersionOmegaP[idx]);
    return -(omegaP * omegaP) / Math.max(1e-12, omega * omega + gamma * gamma);
  }
  if (kind === 2) {
    const omega0 = Math.max(0, this.muDispersionOmega0[idx]);
    const deltaMu = this.muDispersionDeltaMu[idx];
    const detuning = omega0 * omega0 - omega * omega;
    const denominator = detuning * detuning + gamma * gamma * omega * omega;
    return denominator > 1e-12 ? (deltaMu * omega0 * omega0 * detuning) / denominator : 0;
  }
  if (kind === 3) {
    const tau = Math.max(1, this.muDispersionTau[idx]);
    return this.muDispersionDeltaMu[idx] / (1 + omega * omega * tau * tau);
  }
  return 0;
},

effectiveScalarEpsilonAt(idx, angularFrequency) {
  const delta = this.dispersiveDeltaEpsilonAt(idx, angularFrequency);
  const axes = this.dispersiveMaterial[idx] ? this.dispersionAxes[idx] || 3 : 0;
  const epsX = (Number(this.eps[idx]) || 0) + (axes & 1 ? delta : 0);
  const epsY = (Number(this.epsY[idx]) || 0) + (axes & 2 ? delta : 0);
  return 0.5 * (epsX + epsY);
},

effectiveScalarMuAt(idx, angularFrequency) {
  const delta = this.dispersiveDeltaMuAt(idx, angularFrequency);
  const axes = this.muDispersiveMaterial[idx] ? this.muDispersionAxes[idx] || 3 : 0;
  const muX = (Number(this.mu[idx]) || 0) + (axes & 1 ? delta : 0);
  const muY = (Number(this.muY[idx]) || 0) + (axes & 2 ? delta : 0);
  return 0.5 * (muX + muY);
},

effectiveHzEpsilonTensorAt(idx, angularFrequency) {
  let epsXX = Number(this.eps[idx]) || 0;
  let epsYY = Number(this.epsY[idx]) || 0;
  let epsXY = Number(this.epsilonXY[idx]) || 0;
  const delta = this.dispersiveDeltaEpsilonAt(idx, angularFrequency);
  if (delta !== 0) {
    const axes = this.dispersionAxes[idx] || 3;
    if (axes === 1) {
      const axisX = Number.isFinite(this.dispersionAxisX[idx]) ? this.dispersionAxisX[idx] : 1;
      const axisY = Number.isFinite(this.dispersionAxisY[idx]) ? this.dispersionAxisY[idx] : 0;
      epsXX += delta * axisX * axisX;
      epsYY += delta * axisY * axisY;
      epsXY += delta * axisX * axisY;
    } else {
      if (axes & 1) epsXX += delta;
      if (axes & 2) epsYY += delta;
    }
  }
  return { epsXX, epsYY, epsXY };
},

materialTensorDiagnostics() {
  const cache = this.materialTensorDiagnosticsCache;
  if (cache && cache.n === this.n && this.time - cache.time < 32) return cache.value;
  const angularFrequency = 2 * Math.PI * this.diagnosticFrequency();
  const result = {
    checkedCells: 0,
    tensorCells: 0,
    dispersiveCells: 0,
    indefiniteCells: 0,
    nearSingularCells: 0,
    negativeCells: 0,
    maxCondition: 1,
    minAbsEigenvalue: Infinity,
    maxAbsEigenvalue: 0,
  };

  for (let i = 0; i < this.n; i += 1) {
    if (this.material[i] === 0 || this.material[i] === 2) continue;
    const hasTensor =
      this.electricTensorMaterial[i] ||
      this.gyrotropicMaterial[i] ||
      this.dispersiveMaterial[i] ||
      Math.abs((this.eps[i] || 0) - (this.epsY[i] || 0)) > 1e-9;
    if (!hasTensor) continue;
    const tensor = this.effectiveHzEpsilonTensorAt(i, angularFrequency);
    const halfTrace = 0.5 * (tensor.epsXX + tensor.epsYY);
    const halfDiff = 0.5 * (tensor.epsXX - tensor.epsYY);
    const radius = Math.hypot(halfDiff, tensor.epsXY);
    const lambda1 = halfTrace + radius;
    const lambda2 = halfTrace - radius;
    const abs1 = Math.abs(lambda1);
    const abs2 = Math.abs(lambda2);
    const maxAbs = Math.max(abs1, abs2);
    const minAbs = Math.min(abs1, abs2);
    const condition = maxAbs / Math.max(1e-12, minAbs);
    result.checkedCells += 1;
    if (this.electricTensorMaterial[i] || this.gyrotropicMaterial[i] || Math.abs(tensor.epsXY) > 1e-9) {
      result.tensorCells += 1;
    }
    if (this.dispersiveMaterial[i]) result.dispersiveCells += 1;
    if (lambda1 * lambda2 < 0) result.indefiniteCells += 1;
    if (lambda1 < 0 || lambda2 < 0) result.negativeCells += 1;
    if (minAbs < 0.035 || condition > 200) result.nearSingularCells += 1;
    result.maxCondition = Math.max(result.maxCondition, condition);
    result.minAbsEigenvalue = Math.min(result.minAbsEigenvalue, minAbs);
    result.maxAbsEigenvalue = Math.max(result.maxAbsEigenvalue, maxAbs);
  }

  if (!Number.isFinite(result.minAbsEigenvalue)) result.minAbsEigenvalue = 0;
  this.materialTensorDiagnosticsCache = { n: this.n, time: this.time, value: result };
  return result;
},

negativeIndexDiagnostics() {
  if (state.preset !== "negativeIndexSlab" && state.preset !== "superlensSlab") return null;
  const angularFrequency = 2 * Math.PI * this.diagnosticFrequency();
  let cells = 0;
  let epsSum = 0;
  let muSum = 0;
  let doubleNegativeCells = 0;
  let nearSingularCells = 0;

  for (let i = 0; i < this.n; i += 1) {
    if (this.material[i] === 0 || this.material[i] === 2) continue;
    if (!this.dispersiveMaterial[i] && !this.muDispersiveMaterial[i]) continue;
    const epsEff = this.effectiveScalarEpsilonAt(i, angularFrequency);
    const muEff = this.effectiveScalarMuAt(i, angularFrequency);
    if (!Number.isFinite(epsEff) || !Number.isFinite(muEff)) continue;
    cells += 1;
    epsSum += epsEff;
    muSum += muEff;
    if (epsEff < 0 && muEff < 0) doubleNegativeCells += 1;
    if (Math.abs(epsEff) < 0.05 || Math.abs(muEff) < 0.05) nearSingularCells += 1;
  }

  if (cells <= 0) return null;
  const epsEff = epsSum / cells;
  const muEff = muSum / cells;
  const nAbs = Math.sqrt(Math.max(0, Math.abs(epsEff * muEff)));
  const nEff = epsEff < 0 && muEff < 0 ? -nAbs : nAbs;
  return { cells, epsEff, muEff, nEff, doubleNegativeCells, nearSingularCells };
},

fullVectorBianisotropyDiagnostics() {
  if (!this.fullVectorBianisotropyActive()) return null;
  let cells = 0;
  let primaryEnergy = 0;
  let crossEnergy = 0;
  let maxCrossField = 0;
  for (let i = 0; i < this.n; i += 1) {
    if (!this.bianisotropicMaterial[i] || this.material[i] === 2) continue;
    cells += 1;
    primaryEnergy += this.ez[i] * this.ez[i] + this.hx[i] * this.hx[i] + this.hy[i] * this.hy[i];
    const cross =
      this.dualEz[i] * this.dualEz[i] +
      this.dualHx[i] * this.dualHx[i] +
      this.dualHy[i] * this.dualHy[i];
    crossEnergy += cross;
    maxCrossField = Math.max(maxCrossField, Math.abs(this.dualEz[i]), Math.abs(this.dualHx[i]), Math.abs(this.dualHy[i]));
  }
  if (cells <= 0) return null;
  return {
    cells,
    primaryEnergy,
    crossEnergy,
    crossEnergyRatio: crossEnergy / Math.max(1e-18, primaryEnergy),
    maxCrossField,
  };
},

fieldPhysicalScale() {
  return state.viewMode === "poynting" ? this.fieldScale * this.fieldScale : this.fieldScale;
},

fieldPhysicalLogScale() {
  return (state.viewMode === "poynting" ? 2 : 1) * this.fieldLog10Scale;
},

fieldDisplayIsMagnitude() {
  return fieldDisplayConfig().magnitude;
},

transverseVectorAt(i) {
  if (state.viewMode === "poynting") return this.poyntingAt(i);
  return { x: this.hx[i], y: this.hy[i] };
},

diagnosticMonitorPositions() {
  const min = this.activeInteriorMinX();
  const max = this.activeInteriorMaxX();
  const width = Math.max(1, max - min);
  return {
    left: clampInt(min + width * 0.28, min, max),
    right: clampInt(min + width * 0.74, min, max),
  };
},

diagnosticIncidentSource() {
  return state.sources.find((source) => incidentFieldSourceShapes.has(source.shape)) || state.sources[0] || defaultSourceConfig;
},

diagnosticDirection() {
  const source = this.diagnosticIncidentSource();
  const theta = ((Number(source.angleDeg) || 0) * Math.PI) / 180;
  return {
    theta,
    cos: Math.cos(theta),
    sin: Math.sin(theta),
    angleDeg: ((Number(source.angleDeg) || 0) % 360 + 360) % 360,
  };
},

lineDirectionalFluxAt(x, direction = this.diagnosticDirection()) {
  const y0 = this.activeInteriorMinY();
  const y1 = this.activeInteriorMaxY();
  let flux = 0;
  let samples = 0;
  for (let y = y0; y <= y1; y += 1) {
    const idx = this.id(x, y);
    if (this.material[idx] === 2) continue;
    const s = this.poyntingAt(idx);
    flux += s.x * direction.cos + s.y * direction.sin;
    samples += 1;
  }
  return samples > 0 ? (flux / samples) * this.fieldPhysicalScale() : 0;
},

directionalTangentialFieldsAt(idx, direction) {
  const cos = direction.cos;
  const sin = direction.sin;
  if (state.fieldComponent === "hz") {
    const eParallel = this.hy[idx] * cos - this.hx[idx] * sin;
    return { electric: eParallel, magnetic: this.ez[idx] };
  }
  const hParallel = this.hx[idx] * sin - this.hy[idx] * cos;
  return { electric: this.ez[idx], magnetic: hParallel };
},

lineWaveSeparationAt(x, direction = this.diagnosticDirection()) {
  const y0 = this.activeInteriorMinY();
  const y1 = this.activeInteriorMaxY();
  let forward = 0;
  let backward = 0;
  let impedance = 0;
  let samples = 0;
  for (let y = y0; y <= y1; y += 1) {
    const idx = this.id(x, y);
    if (this.material[idx] === 2) continue;
    const epsValue = Math.max(1e-6, Math.abs(state.fieldComponent === "hz" ? this.epsY[idx] : this.eps[idx]));
    const muValue = Math.max(1e-6, Math.abs(state.fieldComponent === "hz" ? this.mu[idx] : this.muY[idx]));
    const z = Math.sqrt(muValue / epsValue);
    if (!Number.isFinite(z) || z <= 0) continue;
    const tangential = this.directionalTangentialFieldsAt(idx, direction);
    forward += 0.5 * (tangential.electric + z * tangential.magnetic);
    backward += 0.5 * (tangential.electric - z * tangential.magnetic);
    impedance += z;
    samples += 1;
  }
  if (samples <= 0) return { forward: 0, backward: 0, impedance: 1 };
  return { forward: forward / samples, backward: backward / samples, impedance: impedance / samples };
},

diagnosticFrequency() {
  const sineSource = state.sources.find((source) => source.type === "sine") || this.diagnosticIncidentSource();
  return clamp(Number(sineSource?.frequency) || defaultSourceConfig.frequency, 0.006, 0.095);
},

diagnosticDftOrders() {
  const omega = Math.abs(Number(state.modulationFrequency) || 0);
  return temporalFloquetAnalysisPresets.has(state.preset) && omega > 1e-6 ? [-2, -1, 0, 1, 2] : [];
},

ensureDiagnosticDftChannels() {
  const carrier = this.diagnosticFrequency();
  const omega = Math.abs(Number(state.modulationFrequency) || 0);
  const orders = this.diagnosticDftOrders();
  const key = `${state.preset},${state.fieldComponent},${carrier.toFixed(6)},${omega.toFixed(6)},${orders.join(":")}`;
  if (key === this.diagnosticDftKey) return;
  this.diagnosticDftKey = key;
  this.diagnosticDftSummary = null;
  this.clearDiagnosticDftSamples();
  this.diagnosticDftChannels = orders
    .map((order) => ({
      order,
      frequency: carrier + order * omega,
      incident: { re: 0, im: 0 },
      reflected: { re: 0, im: 0 },
      transmitted: { re: 0, im: 0 },
      incidentPower: 0,
      reflectedPower: 0,
      transmittedPower: 0,
      transmittedAmplitudeRatio: 0,
      reflectedAmplitudeRatio: 0,
      transmittedPowerRatio: 0,
      reflectedPowerRatio: 0,
    }))
    .filter((channel) => channel.frequency > 1e-6 && channel.frequency <= 0.25);
},

clearDiagnosticDftSamples() {
  this.diagnosticDftSampleIndex = 0;
  this.diagnosticDftSampleCount = 0;
},

recordDiagnosticDftSample(incident, transmitted) {
  const length = this.diagnosticDftIncidentSeries?.length || 0;
  if (length <= 0) return;
  const index = this.diagnosticDftSampleIndex;
  this.diagnosticDftTimeSeries[index] = this.time;
  this.diagnosticDftIncidentSeries[index] = Number.isFinite(incident.forward) ? incident.forward : 0;
  this.diagnosticDftReflectedSeries[index] = Number.isFinite(incident.backward) ? incident.backward : 0;
  this.diagnosticDftTransmittedSeries[index] = Number.isFinite(transmitted.forward) ? transmitted.forward : 0;
  this.diagnosticDftSampleIndex = (index + 1) % length;
  this.diagnosticDftSampleCount = Math.min(this.diagnosticDftSampleCount + 1, length);
},

diagnosticDftPhasor(series, frequency) {
  const count = this.diagnosticDftSampleCount;
  const length = series?.length || 0;
  if (count < 48 || length <= 0 || !Number.isFinite(frequency) || frequency <= 0) return { re: 0, im: 0 };
  const start = (this.diagnosticDftSampleIndex - count + length) % length;
  let re = 0;
  let im = 0;
  let windowSum = 0;
  for (let n = 0; n < count; n += 1) {
    const index = (start + n) % length;
    const value = series[index];
    if (!Number.isFinite(value)) continue;
    const window = count > 1 ? 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (count - 1)) : 1;
    const phase = 2 * Math.PI * frequency * this.diagnosticDftTimeSeries[index];
    re += window * value * Math.cos(phase);
    im -= window * value * Math.sin(phase);
    windowSum += window;
  }
  if (windowSum <= 1e-12) return { re: 0, im: 0 };
  return { re: re / windowSum, im: im / windowSum };
},

accumulateDiagnosticPhasor(name, value, phase) {
  const target = this.diagnosticPhasors[name];
  if (!target || !Number.isFinite(value)) return;
  const alpha = this.diagnosticSamples < 12 ? 0.22 : 0.035;
  target.re = (1 - alpha) * target.re + alpha * value * Math.cos(phase);
  target.im = (1 - alpha) * target.im - alpha * value * Math.sin(phase);
},

accumulatePhasorObject(target, value, phase, alpha) {
  if (!target || !Number.isFinite(value)) return;
  target.re = (1 - alpha) * target.re + alpha * value * Math.cos(phase);
  target.im = (1 - alpha) * target.im - alpha * value * Math.sin(phase);
},

diagnosticPowerFromPhasor(name, impedance) {
  const target = this.diagnosticPhasors[name];
  if (!target || this.diagnosticSamples <= 0) return 0;
  const amplitude = 2 * Math.hypot(target.re, target.im);
  const z = Math.max(1e-9, Math.abs(impedance));
  return (amplitude * amplitude * this.fieldPhysicalScale()) / (2 * z);
},

diagnosticPowerFromPhasorObject(target, impedance) {
  if (!target || this.diagnosticSamples <= 0) return 0;
  const amplitude = 2 * Math.hypot(target.re, target.im);
  const z = Math.max(1e-9, Math.abs(impedance));
  return (amplitude * amplitude * this.fieldPhysicalScale()) / (2 * z);
},

updateDiagnosticDftChannels(incident, transmitted, rightIncident = false) {
  this.ensureDiagnosticDftChannels();
  if (!this.diagnosticDftChannels.length) {
    this.diagnosticDftSummary = null;
    return;
  }
  this.recordDiagnosticDftSample(incident, transmitted);
  if (this.diagnosticDftSampleCount < 48) {
    this.diagnosticDftSummary = null;
    return;
  }
  this.diagnosticDftChannels.forEach((channel) => {
    channel.incident = this.diagnosticDftPhasor(this.diagnosticDftIncidentSeries, channel.frequency);
    channel.reflected = this.diagnosticDftPhasor(this.diagnosticDftReflectedSeries, channel.frequency);
    channel.transmitted = this.diagnosticDftPhasor(this.diagnosticDftTransmittedSeries, channel.frequency);
  });

  const carrier = this.diagnosticDftChannels.find((channel) => channel.order === 0);
  if (!carrier) {
    this.diagnosticDftSummary = null;
    return;
  }
  this.diagnosticDftChannels.forEach((channel) => {
    channel.incidentPower = this.diagnosticPowerFromPhasorObject(channel.incident, incident.impedance);
    channel.reflectedPower = this.diagnosticPowerFromPhasorObject(channel.reflected, incident.impedance);
    channel.transmittedPower = this.diagnosticPowerFromPhasorObject(channel.transmitted, transmitted.impedance);
  });
  const carrierIncidentAmplitude = 2 * Math.hypot(carrier.incident.re, carrier.incident.im);
  const carrierIncidentPower = Math.max(1e-18, carrier.incidentPower);
  let transmittedSidebandPower = 0;
  let reflectedSidebandPower = 0;
  let upPower = 0;
  let downPower = 0;
  let maxSidebandRatio = 0;
  let maxSidebandOrder = 0;
  let totalTransmittedPower = 0;
  let totalReflectedPower = 0;
  const inputPort = rightIncident ? "right" : "left";
  const transmittedPort = rightIncident ? "left" : "right";
  const reflectedPort = inputPort;
  const scatteringEntries = [];
  this.diagnosticDftChannels.forEach((channel) => {
    const transmittedAmplitude = 2 * Math.hypot(channel.transmitted.re, channel.transmitted.im);
    const reflectedAmplitude = 2 * Math.hypot(channel.reflected.re, channel.reflected.im);
    const transmittedS = complexPhasorRatio(channel.transmitted, carrier.incident);
    const reflectedS = complexPhasorRatio(channel.reflected, carrier.incident);
    channel.transmittedAmplitudeRatio =
      carrierIncidentAmplitude > 1e-12 ? transmittedAmplitude / carrierIncidentAmplitude : 0;
    channel.reflectedAmplitudeRatio =
      carrierIncidentAmplitude > 1e-12 ? reflectedAmplitude / carrierIncidentAmplitude : 0;
    channel.transmittedPowerRatio = channel.transmittedPower / carrierIncidentPower;
    channel.reflectedPowerRatio = channel.reflectedPower / carrierIncidentPower;
    channel.transmittedS = transmittedS;
    channel.reflectedS = reflectedS;
    totalTransmittedPower += channel.transmittedPowerRatio;
    totalReflectedPower += channel.reflectedPowerRatio;
    scatteringEntries.push(
      {
        inputPort,
        outputPort: transmittedPort,
        inputOrder: 0,
        outputOrder: channel.order,
        path: "T",
        frequency: channel.frequency,
        re: transmittedS.re,
        im: transmittedS.im,
        amplitude: transmittedS.amplitude,
        phaseRad: transmittedS.phaseRad,
        powerRatio: channel.transmittedPowerRatio,
      },
      {
        inputPort,
        outputPort: reflectedPort,
        inputOrder: 0,
        outputOrder: channel.order,
        path: "R",
        frequency: channel.frequency,
        re: reflectedS.re,
        im: reflectedS.im,
        amplitude: reflectedS.amplitude,
        phaseRad: reflectedS.phaseRad,
        powerRatio: channel.reflectedPowerRatio,
      },
    );
    if (channel.order === 0) return;
    transmittedSidebandPower += channel.transmittedPowerRatio;
    reflectedSidebandPower += channel.reflectedPowerRatio;
    if (channel.order > 0) upPower += channel.transmittedPowerRatio;
    else downPower += channel.transmittedPowerRatio;
    if (channel.transmittedAmplitudeRatio > maxSidebandRatio) {
      maxSidebandRatio = channel.transmittedAmplitudeRatio;
      maxSidebandOrder = channel.order;
    }
  });
  this.diagnosticDftSummary = {
    carrierFrequency: carrier.frequency,
    modulationFrequency: Math.abs(Number(state.modulationFrequency) || 0),
    carrierIncidentPower,
    carrierIncidentAmplitude,
    orders: this.diagnosticDftChannels.map((channel) => ({
      order: channel.order,
      frequency: channel.frequency,
      amplitudeRatio: channel.transmittedAmplitudeRatio,
      reflectedAmplitudeRatio: channel.reflectedAmplitudeRatio,
      powerRatio: channel.transmittedPowerRatio,
      reflectedPowerRatio: channel.reflectedPowerRatio,
      transmittedPhaseRad: channel.transmittedS.phaseRad,
      reflectedPhaseRad: channel.reflectedS.phaseRad,
      transmittedRe: channel.transmittedS.re,
      transmittedIm: channel.transmittedS.im,
      reflectedRe: channel.reflectedS.re,
      reflectedIm: channel.reflectedS.im,
      incidentPower: channel.incidentPower,
      reflectedPower: channel.reflectedPower,
      transmittedPower: channel.transmittedPower,
    })),
    scatteringMatrix: {
      inputPort,
      transmittedPort,
      reflectedPort,
      incidentOrder: 0,
      entries: scatteringEntries,
      totalTransmittedPower,
      totalReflectedPower,
      totalOutgoingPower: totalTransmittedPower + totalReflectedPower,
      transmittedSidebandPower,
      reflectedSidebandPower,
      normalization: "carrier incident DFT phasor at the input monitor",
    },
    sidebandPower: transmittedSidebandPower,
    reflectedSidebandPower,
    upPower,
    downPower,
    maxSidebandRatio,
    maxSidebandOrder,
    firstUpper: this.diagnosticDftChannels.find((channel) => channel.order === 1)?.transmittedAmplitudeRatio || 0,
    firstLower: this.diagnosticDftChannels.find((channel) => channel.order === -1)?.transmittedAmplitudeRatio || 0,
    portDft: true,
  };
},

updateDiagnostics() {
  if (!state.diagnosticsEnabled) {
    this.resetDiagnostics();
    return;
  }
  this.updateAnalysisDiagnostics();
  const monitors = this.diagnosticMonitorPositions();
  const direction = this.diagnosticDirection();
  this.diagnosticAngleDeg = direction.angleDeg;
  this.diagnosticFluxLeft = this.lineDirectionalFluxAt(monitors.left, direction);
  this.diagnosticFluxRight = this.lineDirectionalFluxAt(monitors.right, direction);
  const left = this.lineWaveSeparationAt(monitors.left, direction);
  const right = this.lineWaveSeparationAt(monitors.right, direction);
  const phase = 2 * Math.PI * this.diagnosticFrequency() * this.time;
  const rightIncident = direction.cos < 0;
  const incident = rightIncident ? right : left;
  const transmitted = rightIncident ? left : right;
  this.accumulateDiagnosticPhasor("incident", incident.forward, phase);
  this.accumulateDiagnosticPhasor("reflected", incident.backward, phase);
  this.accumulateDiagnosticPhasor("transmitted", transmitted.forward, phase);
  this.updateDiagnosticDftChannels(incident, transmitted, rightIncident);
  this.diagnosticSamples += 1;
  this.diagnosticImpedanceLeft = left.impedance;
  this.diagnosticImpedanceRight = right.impedance;
  this.diagnosticIncidentPower = this.diagnosticPowerFromPhasor("incident", incident.impedance);
  this.diagnosticReflectedPower = this.diagnosticPowerFromPhasor("reflected", incident.impedance);
  this.diagnosticTransmittedPower = this.diagnosticPowerFromPhasor("transmitted", transmitted.impedance);
  if (this.diagnosticIncidentPower > 1e-12) {
    this.diagnosticReflectance = clamp(this.diagnosticReflectedPower / this.diagnosticIncidentPower, 0, 9.999);
    this.diagnosticTransmittance = clamp(this.diagnosticTransmittedPower / this.diagnosticIncidentPower, 0, 9.999);
  } else {
    this.diagnosticTransmittance = 0;
    this.diagnosticReflectance = 0;
  }
},

measure() {
  this.renormalizeFields();
  if (this.lastDiverged) {
    this.lastMax = 0;
    this.lastMaxLog10 = -Infinity;
    this.lastEnergy = 0;
    this.lastEnergyLog10 = -Infinity;
    return;
  }

  let maxAbs = 0;
  let energy = 0;
  for (let i = 0; i < this.n; i += 1) {
    const value = this.fieldValueAt(i);
    const abs = Math.abs(value);
    if (abs > maxAbs) maxAbs = abs;
    energy += value * value;
  }
  const physicalLogScale = this.fieldPhysicalLogScale();
  this.lastMaxLog10 = maxAbs === 0 ? -Infinity : Math.log10(maxAbs) + physicalLogScale;
  this.lastEnergyLog10 = energy === 0 ? -Infinity : Math.log10(energy / this.n) + 2 * physicalLogScale;
  this.lastMax = this.lastMaxLog10 < 300 ? Math.pow(10, this.lastMaxLog10) : Infinity;
  this.lastEnergy = this.lastEnergyLog10 < 300 ? Math.pow(10, this.lastEnergyLog10) : Infinity;
}
});
