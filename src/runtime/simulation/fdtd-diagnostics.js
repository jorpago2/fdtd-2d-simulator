"use strict";

Object.assign(FDTDSim.prototype, {
resetDiagnostics() {
  this.resetLineDiagnostics();
  this.resetAnalysisDiagnostics();
},

hyperlensRingSample(radiusCells, angleCount = 96) {
  const centerX = clampInt(Math.round(this.nx * 0.5 + lambdaToCells(0.35)), this.activeInteriorMinX(), this.activeInteriorMaxX());
  const centerY = clampInt(Math.round(this.ny * 0.5), this.activeInteriorMinY(), this.activeInteriorMaxY());
  const harmonicOrders = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const re = new Array(harmonicOrders.length).fill(0);
  const im = new Array(harmonicOrders.length).fill(0);
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
    for (let h = 0; h < harmonicOrders.length; h += 1) {
      const phase = harmonicOrders[h] * theta;
      re[h] += value * Math.cos(phase);
      im[h] -= value * Math.sin(phase);
    }
    samples += 1;
  }
  if (samples <= 0) return { energy: 0, detail: 0, harmonics: [] };
  let detail = 0;
  const harmonics = [];
  for (let h = 0; h < harmonicOrders.length; h += 1) {
    const amplitude = (2 * Math.hypot(re[h], im[h])) / samples;
    const power = amplitude * amplitude;
    harmonics.push({ order: harmonicOrders[h], amplitude, power });
    detail += power;
  }
  return { energy: energy / samples, detail, harmonics };
},

hyperlensMtfStats(innerHarmonics = [], outerHarmonics = []) {
  const outerByOrder = new Map(outerHarmonics.map((item) => [item.order, item]));
  const curve = innerHarmonics.map((inner) => {
    const outer = outerByOrder.get(inner.order) || {};
    const innerAmplitude = Math.max(0, Number(inner.amplitude) || 0);
    const outerAmplitude = Math.max(0, Number(outer.amplitude) || 0);
    const transfer = innerAmplitude > 1e-12 ? outerAmplitude / innerAmplitude : 0;
    return {
      order: inner.order,
      innerAmplitude,
      outerAmplitude,
      transfer: Number.isFinite(transfer) ? transfer : 0,
      normalizedTransfer: 0,
    };
  });
  const valid = curve.filter((item) => item.innerAmplitude > 1e-12 && Number.isFinite(item.transfer));
  const lowOrder = valid.filter((item) => item.order <= 3 && item.transfer > 0);
  const lowOrderTransfer =
    lowOrder.length > 0
      ? lowOrder.reduce((sum, item) => sum + item.transfer, 0) / lowOrder.length
      : valid.reduce((peak, item) => Math.max(peak, item.transfer), 0);
  let meanTransfer = 0;
  let peakTransfer = 0;
  let mtfMean = 0;
  let mtfHighOrderMean = 0;
  let mtfHighOrderCount = 0;
  let mtfBandwidthOrder = 0;
  for (const item of valid) {
    meanTransfer += item.transfer;
    peakTransfer = Math.max(peakTransfer, item.transfer);
    item.normalizedTransfer = lowOrderTransfer > 1e-12 ? item.transfer / lowOrderTransfer : 0;
    mtfMean += item.normalizedTransfer;
    if (item.order >= 6) {
      mtfHighOrderMean += item.normalizedTransfer;
      mtfHighOrderCount += 1;
    }
    if (item.normalizedTransfer >= 0.5) mtfBandwidthOrder = Math.max(mtfBandwidthOrder, item.order);
  }
  if (valid.length > 0) {
    meanTransfer /= valid.length;
    mtfMean /= valid.length;
  }
  if (mtfHighOrderCount > 0) mtfHighOrderMean /= mtfHighOrderCount;
  return {
    curve,
    validCount: valid.length,
    lowOrderTransfer,
    meanTransfer,
    peakTransfer,
    mtfMean,
    mtfHighOrderMean,
    mtfBandwidthOrder,
  };
},

updateHyperlensAnalysis(alpha) {
  if (state.preset !== "hyperlens") return;
  const inner = this.hyperlensRingSample(lambdaToCells(0.52));
  const outer = this.hyperlensRingSample(lambdaToCells(1.16));
  const mtf = this.hyperlensMtfStats(inner.harmonics, outer.harmonics);
  this.analysisHyperlensInnerEnergyEwma = (1 - alpha) * this.analysisHyperlensInnerEnergyEwma + alpha * inner.energy;
  this.analysisHyperlensOuterEnergyEwma = (1 - alpha) * this.analysisHyperlensOuterEnergyEwma + alpha * outer.energy;
  this.analysisHyperlensInnerDetailEwma = (1 - alpha) * this.analysisHyperlensInnerDetailEwma + alpha * inner.detail;
  this.analysisHyperlensOuterDetailEwma = (1 - alpha) * this.analysisHyperlensOuterDetailEwma + alpha * outer.detail;
  this.analysisHyperlensMtfMeanEwma = (1 - alpha) * this.analysisHyperlensMtfMeanEwma + alpha * mtf.mtfMean;
  this.analysisHyperlensMtfPeakEwma = (1 - alpha) * this.analysisHyperlensMtfPeakEwma + alpha * mtf.peakTransfer;
  this.analysisHyperlensMtfHighOrderEwma =
    (1 - alpha) * this.analysisHyperlensMtfHighOrderEwma + alpha * mtf.mtfHighOrderMean;
  this.analysisHyperlensMtfBandwidthEwma =
    (1 - alpha) * this.analysisHyperlensMtfBandwidthEwma + alpha * mtf.mtfBandwidthOrder;
},

analysisHyperlensEstimate() {
  if (state.preset !== "hyperlens" || this.analysisSamples < 8) return null;
  const innerEnergy = Math.max(0, this.analysisHyperlensInnerEnergyEwma);
  const outerEnergy = Math.max(0, this.analysisHyperlensOuterEnergyEwma);
  const innerDetail = Math.max(0, this.analysisHyperlensInnerDetailEwma);
  const outerDetail = Math.max(0, this.analysisHyperlensOuterDetailEwma);
  const instantInner = this.hyperlensRingSample(lambdaToCells(0.52));
  const instantOuter = this.hyperlensRingSample(lambdaToCells(1.16));
  const mtf = this.hyperlensMtfStats(instantInner.harmonics, instantOuter.harmonics);
  const mtfBandwidthOrder = Math.max(0, Math.round(this.analysisHyperlensMtfBandwidthEwma || mtf.mtfBandwidthOrder));
  return {
    innerEnergy,
    outerEnergy,
    transfer: innerEnergy > 1e-24 ? outerEnergy / innerEnergy : 0,
    innerDetail,
    outerDetail,
    detailTransfer: innerDetail > 1e-24 ? outerDetail / innerDetail : 0,
    mtfCurve: mtf.curve,
    mtfValidCount: mtf.validCount,
    mtfLowOrderTransfer: mtf.lowOrderTransfer,
    mtfMean: Math.max(0, this.analysisHyperlensMtfMeanEwma || mtf.mtfMean),
    mtfPeakTransfer: Math.max(0, this.analysisHyperlensMtfPeakEwma || mtf.peakTransfer),
    mtfHighOrderMean: Math.max(0, this.analysisHyperlensMtfHighOrderEwma || mtf.mtfHighOrderMean),
    mtfBandwidthOrder,
  };
},


coupledWorkflowEstimate() {
  if (!coupledWorkflowAnalysisPresets.has(state.preset)) return null;
  const minX = this.activeInteriorMinX();
  const maxX = this.activeInteriorMaxX();
  const minY = this.activeInteriorMinY();
  const maxY = this.activeInteriorMaxY();
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const edgeWidth = Math.max(3, Math.round(state.cellsPerWavelength * 0.45));
  const source = state.sources[0] || defaultSourceConfig;
  const sourceX = this.sourceXCell(source);
  const sourceY = this.sourceYCell(source);
  const sourceRadius = Math.max(2, Math.round(this.sourceEnvelopeFwhmCells(source) * 0.85));
  const guideBand = Math.max(3, Math.round(state.cellsPerWavelength * 0.34));
  const cavityRadius = Math.max(3, Math.round(state.cellsPerWavelength * 0.85));
  const centerX = Math.round((minX + maxX) * 0.5);
  const centerY = Math.round((minY + maxY) * 0.5);

  let totalEnergy = 0;
  let materialEnergy = 0;
  let highIndexEnergy = 0;
  let modulatedEnergy = 0;
  let nonlinearEnergy = 0;
  let dispersiveEnergy = 0;
  let guideEnergy = 0;
  let cavityEnergy = 0;
  let sourceRegionEnergy = 0;
  let leftEdgeEnergy = 0;
  let rightEdgeEnergy = 0;
  let gainWeightedEnergy = 0;
  let lossWeightedEnergy = 0;
  let weightedX = 0;
  let weightedY = 0;
  let peakEnergy = 0;
  let peakX = centerX;
  let peakY = centerY;

  for (let y = minY; y <= maxY; y += 1) {
    const row = y * this.nx;
    for (let x = minX; x <= maxX; x += 1) {
      const idx = row + x;
      const energy = this.analysisFieldEnergyDensityAt(idx);
      if (energy <= 0) continue;
      totalEnergy += energy;
      weightedX += x * energy;
      weightedY += y * energy;
      if (energy > peakEnergy) {
        peakEnergy = energy;
        peakX = x;
        peakY = y;
      }
      if (this.material[idx] !== 0) materialEnergy += energy;
      if (Math.max(Math.abs(this.eps[idx]), Math.abs(this.epsY[idx])) > 2.2) highIndexEnergy += energy;
      if (this.modulatedMaterial[idx]) modulatedEnergy += energy;
      if (this.nonlinearMaterial[idx]) nonlinearEnergy += energy;
      if (this.dispersiveMaterial?.[idx] || this.muDispersiveMaterial?.[idx]) dispersiveEnergy += energy;
      if (Math.abs(y - sourceY) <= guideBand) guideEnergy += energy;
      if (Math.hypot(x - centerX, y - centerY) <= cavityRadius) cavityEnergy += energy;
      if (Math.hypot(x - sourceX, y - sourceY) <= sourceRadius) sourceRegionEnergy += energy;
      if (x <= minX + edgeWidth) leftEdgeEnergy += energy;
      if (x >= maxX - edgeWidth) rightEdgeEnergy += energy;
      const loss = Number(this.loss[idx]) || 0;
      if (loss < -1e-9) gainWeightedEnergy += -loss * energy;
      if (loss > 1e-9) lossWeightedEnergy += loss * energy;
    }
  }

  if (totalEnergy <= 1e-24) {
    return {
      totalEnergy: 0,
      centroidXNorm: 0.5,
      centroidYNorm: 0.5,
      peakXLambda: peakX / Math.max(1, state.cellsPerWavelength),
      peakYLambda: peakY / Math.max(1, state.cellsPerWavelength),
      skinEdgeFraction: 0,
      skinBias: 0,
      guideEnergyFraction: 0,
      cavityEnergyFraction: 0,
      materialEnergyFraction: 0,
      activeMaterialFraction: 0,
      sourceOverlapFraction: 0,
      gainLossBias: 0,
      modulationPhase: this.modulationPhaseCoherenceEstimate(),
    };
  }

  const centroidX = weightedX / totalEnergy;
  const centroidY = weightedY / totalEnergy;
  const edgeEnergy = leftEdgeEnergy + rightEdgeEnergy;
  const activeMaterialEnergy = modulatedEnergy + nonlinearEnergy + dispersiveEnergy;
  const gainLossTotal = gainWeightedEnergy + lossWeightedEnergy;
  return {
    totalEnergy,
    centroidXNorm: clamp((centroidX - minX) / spanX, 0, 1),
    centroidYNorm: clamp((centroidY - minY) / spanY, 0, 1),
    peakXLambda: peakX / Math.max(1, state.cellsPerWavelength),
    peakYLambda: peakY / Math.max(1, state.cellsPerWavelength),
    skinEdgeFraction: clamp(edgeEnergy / totalEnergy, 0, 1),
    skinBias: edgeEnergy > 1e-24 ? clamp((rightEdgeEnergy - leftEdgeEnergy) / edgeEnergy, -1, 1) : 0,
    guideEnergyFraction: clamp(guideEnergy / totalEnergy, 0, 1),
    cavityEnergyFraction: clamp(cavityEnergy / totalEnergy, 0, 1),
    materialEnergyFraction: clamp(materialEnergy / totalEnergy, 0, 1),
    highIndexEnergyFraction: clamp(highIndexEnergy / totalEnergy, 0, 1),
    activeMaterialFraction: clamp(activeMaterialEnergy / totalEnergy, 0, 1),
    sourceOverlapFraction: clamp(sourceRegionEnergy / totalEnergy, 0, 1),
    gainLossBias: gainLossTotal > 1e-24 ? clamp((gainWeightedEnergy - lossWeightedEnergy) / gainLossTotal, -1, 1) : 0,
    modulationPhase: this.modulationPhaseCoherenceEstimate(),
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

analysisMetricEstimate() {
  if (!state.analysisEnabled) return null;
  const ptModal = this.ptModalEstimate();
  const sshBloch = this.sshBlochEstimate();
  const phcBloch = this.phcBlochEstimate(0);
  const phaseAverage = this.phaseChangeStateEstimate();
  const floquet = this.analysisFloquetEstimate();
  const hyperlens = this.analysisHyperlensEstimate();
  const negativeIndex = this.negativeIndexQuantitativeEstimate();
  const bianisotropy = this.bianisotropyQuantitativeEstimate();
  const coupledWorkflow = this.coupledWorkflowEstimate();
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
      negativeIndex,
      bianisotropy,
      coupledWorkflow,
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
    negativeIndex,
    bianisotropy,
    coupledWorkflow,
  };
  return this.analysisMetrics;
},

fullVectorBianisotropyDiagnostics() {
  if (!this.fullVectorBianisotropyActive()) return null;
  let cells = 0;
  let primaryElectricEnergy = 0;
  let primaryMagneticEnergy = 0;
  let crossElectricEnergy = 0;
  let crossMagneticEnergy = 0;
  let primaryEnergy = 0;
  let crossEnergy = 0;
  let coupledEnergy = 0;
  let minCoupledEnergyDensity = Infinity;
  let negativeCoupledEnergyCells = 0;
  let maxCrossField = 0;
  let signedKappaSum = 0;
  let absKappaSum = 0;
  let maxKappa = 0;
  let minPassivityMargin = Infinity;
  for (let i = 0; i < this.n; i += 1) {
    if (!this.bianisotropicMaterial[i] || this.material[i] === 2) continue;
    const kappaNorm = normalizeBianisotropyKappa(this.bianisotropyKappa[i]);
    const absKappa = Math.abs(kappaNorm);
    const margin = 1 - absKappa * absKappa;
    const epsX = Math.max(1e-6, Math.abs(this.eps[i]));
    const epsY = Math.max(1e-6, Math.abs(this.epsY[i]));
    const muX = Math.max(1e-6, Math.abs(this.mu[i]));
    const muY = Math.max(1e-6, Math.abs(this.muY[i]));
    const epsZ = 0.5 * (epsX + epsY);
    const muZ = 0.5 * (muX + muY);
    const couplingX = kappaNorm * Math.sqrt(epsX * muX);
    const couplingY = kappaNorm * Math.sqrt(epsY * muY);
    const couplingZ = kappaNorm * Math.sqrt(epsZ * muZ);
    const primaryElectric = this.hx[i] * this.hx[i] + this.hy[i] * this.hy[i];
    const primaryMagnetic = this.ez[i] * this.ez[i];
    const crossElectric = this.dualEz[i] * this.dualEz[i];
    const crossMagnetic = this.dualHx[i] * this.dualHx[i] + this.dualHy[i] * this.dualHy[i];
    const coupledDensity =
      0.5 *
      (epsX * this.hx[i] * this.hx[i] +
        muX * this.dualHx[i] * this.dualHx[i] +
        2 * couplingX * this.hx[i] * this.dualHx[i] +
        epsY * this.hy[i] * this.hy[i] +
        muY * this.dualHy[i] * this.dualHy[i] +
        2 * couplingY * this.hy[i] * this.dualHy[i] +
        epsZ * this.dualEz[i] * this.dualEz[i] +
        muZ * this.ez[i] * this.ez[i] +
        2 * couplingZ * this.dualEz[i] * this.ez[i]);
    cells += 1;
    primaryElectricEnergy += primaryElectric;
    primaryMagneticEnergy += primaryMagnetic;
    crossElectricEnergy += crossElectric;
    crossMagneticEnergy += crossMagnetic;
    primaryEnergy += primaryElectric + primaryMagnetic;
    crossEnergy += crossElectric + crossMagnetic;
    if (Number.isFinite(coupledDensity)) {
      coupledEnergy += coupledDensity;
      minCoupledEnergyDensity = Math.min(minCoupledEnergyDensity, coupledDensity);
      if (coupledDensity < -1e-12) negativeCoupledEnergyCells += 1;
    }
    maxCrossField = Math.max(maxCrossField, Math.abs(this.dualEz[i]), Math.abs(this.dualHx[i]), Math.abs(this.dualHy[i]));
    signedKappaSum += kappaNorm;
    absKappaSum += absKappa;
    maxKappa = Math.max(maxKappa, absKappa);
    minPassivityMargin = Math.min(minPassivityMargin, margin);
  }
  if (cells <= 0) return null;
  if (!Number.isFinite(minCoupledEnergyDensity)) minCoupledEnergyDensity = 0;
  if (!Number.isFinite(minPassivityMargin)) minPassivityMargin = 0;
  const totalEnergy = primaryEnergy + crossEnergy;
  return {
    cells,
    primaryElectricEnergy,
    primaryMagneticEnergy,
    crossElectricEnergy,
    crossMagneticEnergy,
    primaryEnergy,
    crossEnergy,
    crossEnergyRatio: crossEnergy / Math.max(1e-18, primaryEnergy),
    crossEnergyFraction: crossEnergy / Math.max(1e-18, totalEnergy),
    electricConversionRatio: crossElectricEnergy / Math.max(1e-18, primaryElectricEnergy),
    magneticConversionRatio: crossMagneticEnergy / Math.max(1e-18, primaryMagneticEnergy),
    coupledEnergy,
    minCoupledEnergyDensity,
    negativeCoupledEnergyCells,
    meanKappa: signedKappaSum / cells,
    meanAbsKappa: absKappaSum / cells,
    maxKappa,
    minPassivityMargin,
    passiveDefinite: minPassivityMargin > 0 && negativeCoupledEnergyCells === 0,
    maxCrossField,
  };
},

bianisotropicMaterialBounds() {
  if (!this.fullVectorBianisotropyActive()) return null;
  let minX = this.nx;
  let maxX = -1;
  let minY = this.ny;
  let maxY = -1;
  let cells = 0;
  for (let y = this.activeInteriorMinY(); y <= this.activeInteriorMaxY(); y += 1) {
    const row = y * this.nx;
    for (let x = this.activeInteriorMinX(); x <= this.activeInteriorMaxX(); x += 1) {
      const idx = row + x;
      if (!this.bianisotropicMaterial[idx] || this.material[idx] === 2) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      cells += 1;
    }
  }
  if (cells <= 0 || maxX < minX || maxY < minY) return null;
  return { minX, maxX, minY, maxY, cells };
},

bianisotropyLineEnergyStats(xCenter, yMin, yMax, halfWidth = 1) {
  const xMin = clampInt(Math.round(xCenter - halfWidth), this.activeInteriorMinX(), this.activeInteriorMaxX());
  const xMax = clampInt(Math.round(xCenter + halfWidth), xMin, this.activeInteriorMaxX());
  yMin = clampInt(Math.round(yMin), this.activeInteriorMinY(), this.activeInteriorMaxY());
  yMax = clampInt(Math.round(yMax), yMin, this.activeInteriorMaxY());
  let primaryElectricEnergy = 0;
  let primaryMagneticEnergy = 0;
  let crossElectricEnergy = 0;
  let crossMagneticEnergy = 0;
  let samples = 0;
  let primaryPeak = 0;
  let crossPeak = 0;
  let primaryCrossDot = 0;
  let primaryNorm = 0;
  let crossNorm = 0;
  for (let x = xMin; x <= xMax; x += 1) {
    for (let y = yMin; y <= yMax; y += 1) {
      const idx = this.id(x, y);
      if (this.material[idx] === 2) continue;
      const primaryElectric = this.hx[idx] * this.hx[idx] + this.hy[idx] * this.hy[idx];
      const primaryMagnetic = this.ez[idx] * this.ez[idx];
      const crossElectric = this.dualEz[idx] * this.dualEz[idx];
      const crossMagnetic = this.dualHx[idx] * this.dualHx[idx] + this.dualHy[idx] * this.dualHy[idx];
      if (![primaryElectric, primaryMagnetic, crossElectric, crossMagnetic].every(Number.isFinite)) continue;
      primaryElectricEnergy += primaryElectric;
      primaryMagneticEnergy += primaryMagnetic;
      crossElectricEnergy += crossElectric;
      crossMagneticEnergy += crossMagnetic;
      primaryCrossDot += this.ez[idx] * this.dualEz[idx] + this.hx[idx] * this.dualHx[idx] + this.hy[idx] * this.dualHy[idx];
      primaryNorm += primaryElectric + primaryMagnetic;
      crossNorm += crossElectric + crossMagnetic;
      primaryPeak = Math.max(primaryPeak, primaryElectric + primaryMagnetic);
      crossPeak = Math.max(crossPeak, crossElectric + crossMagnetic);
      samples += 1;
    }
  }
  const primaryEnergy = primaryElectricEnergy + primaryMagneticEnergy;
  const crossEnergy = crossElectricEnergy + crossMagneticEnergy;
  const totalEnergy = primaryEnergy + crossEnergy;
  return {
    x: 0.5 * (xMin + xMax),
    samples,
    primaryElectricEnergy,
    primaryMagneticEnergy,
    crossElectricEnergy,
    crossMagneticEnergy,
    primaryEnergy,
    crossEnergy,
    primaryPeak,
    crossPeak,
    conversionRatio: crossEnergy / Math.max(1e-18, primaryEnergy),
    crossFraction: crossEnergy / Math.max(1e-18, totalEnergy),
    crossCorrelation: primaryCrossDot / Math.max(1e-18, Math.sqrt(primaryNorm * crossNorm)),
  };
},

bianisotropyQuantitativeEstimate() {
  if (!this.fullVectorBianisotropyActive()) return null;
  const material = this.fullVectorBianisotropyDiagnostics();
  const bounds = this.bianisotropicMaterialBounds();
  if (!material || !bounds) return null;
  const pad = Math.max(2, Math.round(state.cellsPerWavelength * 0.2));
  const yMargin = Math.max(2, Math.round(state.cellsPerWavelength * 0.18));
  const yMin = Math.max(this.activeInteriorMinY(), bounds.minY - yMargin);
  const yMax = Math.min(this.activeInteriorMaxY(), bounds.maxY + yMargin);
  const interfaceHalfWidth = Math.max(1, Math.round(pad * 0.5));
  const inputLine = this.bianisotropyLineEnergyStats(bounds.minX, yMin, yMax, interfaceHalfWidth);
  const outputLine = this.bianisotropyLineEnergyStats(bounds.maxX, yMin, yMax, interfaceHalfWidth);
  const generatedCrossFraction = Math.max(0, outputLine.crossFraction - inputLine.crossFraction);
  const generatedCrossCorrelation = outputLine.crossCorrelation - inputLine.crossCorrelation;
  const kappaSign = Math.abs(material.meanKappa) > 1e-9 ? Math.sign(material.meanKappa) : 0;
  const powerResidual =
    this.diagnosticSamples > 0 ? 1 - (this.diagnosticReflectance || 0) - (this.diagnosticTransmittance || 0) : null;
  return {
    material,
    bounds,
    inputLine,
    outputLine,
    materialCrossFraction: material.crossEnergyFraction,
    materialConversionRatio: material.crossEnergyRatio,
    outputCrossFraction: outputLine.crossFraction,
    outputConversionRatio: outputLine.conversionRatio,
    outputCrossCorrelation: outputLine.crossCorrelation,
    inputCrossCorrelation: inputLine.crossCorrelation,
    generatedCrossCorrelation,
    kappaSignedOutputCorrelation: kappaSign * outputLine.crossCorrelation,
    generatedCrossFraction,
    inputCrossFraction: inputLine.crossFraction,
    passivityMargin: material.minPassivityMargin,
    passiveDefinite: material.passiveDefinite,
    meanKappa: material.meanKappa,
    meanAbsKappa: material.meanAbsKappa,
    maxKappa: material.maxKappa,
    powerResidual,
  };
},

updateDiagnostics({ forceAnalysis = false } = {}) {
  if (!state.diagnosticsEnabled) {
    this.resetDiagnostics();
    return;
  }
  this.updateAnalysisDiagnostics(forceAnalysis);
  this.updateLineDiagnostics();
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
  if (state.viewMode !== "poynting" && state.fieldDisplay === "scalar") {
    const scalarField = this.ez;
    for (let i = 0; i < this.n; i += 1) {
      const value = scalarField[i];
      const abs = Math.abs(value);
      if (abs > maxAbs) maxAbs = abs;
      energy += value * value;
    }
  } else {
    for (let i = 0; i < this.n; i += 1) {
      const value = this.fieldValueAt(i);
      const abs = Math.abs(value);
      if (abs > maxAbs) maxAbs = abs;
      energy += value * value;
    }
  }
  const physicalLogScale = this.fieldPhysicalLogScale();
  this.lastMaxLog10 = maxAbs === 0 ? -Infinity : Math.log10(maxAbs) + physicalLogScale;
  this.lastEnergyLog10 = energy === 0 ? -Infinity : Math.log10(energy / this.n) + 2 * physicalLogScale;
  this.lastMax = this.lastMaxLog10 < 300 ? Math.pow(10, this.lastMaxLog10) : Infinity;
  this.lastEnergy = this.lastEnergyLog10 < 300 ? Math.pow(10, this.lastEnergyLog10) : Infinity;
}
});
