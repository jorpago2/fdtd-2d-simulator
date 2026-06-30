(function initFdtdAnalysisObservables() {
  "use strict";

  Object.assign(FDTDSim.prototype, {
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
        modulationPhase: this.modulationPhaseCoherenceEstimate(),
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
  });
})();
