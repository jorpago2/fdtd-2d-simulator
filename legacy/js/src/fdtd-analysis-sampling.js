(function initFdtdAnalysisSampling() {
  "use strict";

  Object.assign(FDTDSim.prototype, {
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
      this.analysisHyperlensMtfMeanEwma = 0;
      this.analysisHyperlensMtfPeakEwma = 0;
      this.analysisHyperlensMtfHighOrderEwma = 0;
      this.analysisHyperlensMtfBandwidthEwma = 0;
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

    analysisFieldEnergyDensityAt(idx) {
      const scaleSquared = Number.isFinite(this.fieldScale) ? this.fieldScale * this.fieldScale : 0;
      if (scaleSquared <= 0 || this.material[idx] === 2) return 0;
      let energy = 0;
      if (state.fieldComponent === "hz") {
        energy =
          Math.abs(this.mu[idx]) * this.ez[idx] * this.ez[idx] +
          Math.abs(this.eps[idx]) * this.hx[idx] * this.hx[idx] +
          Math.abs(this.epsY[idx]) * this.hy[idx] * this.hy[idx];
      } else {
        energy =
          Math.abs(this.eps[idx]) * this.ez[idx] * this.ez[idx] +
          Math.abs(this.mu[idx]) * this.hx[idx] * this.hx[idx] +
          Math.abs(this.muY[idx]) * this.hy[idx] * this.hy[idx];
      }
      return Number.isFinite(energy) && energy > 0 ? 0.5 * energy * scaleSquared : 0;
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

    updateAnalysisDiagnostics(force = false) {
      if (!state.analysisEnabled || (!force && this.time % Math.max(1, state.analysisSampleEvery) !== 0)) return;
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
  });
})();
