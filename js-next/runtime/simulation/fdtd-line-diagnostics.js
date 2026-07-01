(function initFdtdLineDiagnostics() {
  "use strict";

  Object.assign(FDTDSim.prototype, {
    resetLineDiagnostics() {
      this.diagnosticFluxLeft = 0;
      this.diagnosticFluxRight = 0;
      this.diagnosticReflectedPower = 0;
      this.diagnosticIncidentPower = 0;
      this.diagnosticTransmittedPower = 0;
      this.diagnosticReflectedPowerEwma = 0;
      this.diagnosticIncidentPowerEwma = 0;
      this.diagnosticTransmittedPowerEwma = 0;
      this.diagnosticReflectedPhasorPower = 0;
      this.diagnosticIncidentPhasorPower = 0;
      this.diagnosticTransmittedPhasorPower = 0;
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
      return samples > 0 ? (flux / samples) * this.fieldPowerScale() : 0;
    },

    staggeredAverageX(array, x, y) {
      const idx = this.id(x, y);
      return x > 0 ? 0.5 * (array[idx] + array[idx - 1]) : array[idx];
    },

    staggeredAverageY(array, x, y) {
      const idx = this.id(x, y);
      return y > 0 ? 0.5 * (array[idx] + array[idx - this.nx]) : array[idx];
    },

    directionalTangentialFieldsAtCell(x, y, direction) {
      const cos = direction.cos;
      const sin = direction.sin;
      const idx = this.id(x, y);
      if (state.fieldComponent === "hz") {
        const ex = this.staggeredAverageY(this.hx, x, y);
        const ey = this.staggeredAverageX(this.hy, x, y);
        const eParallel = ey * cos - ex * sin;
        return { electric: eParallel, magnetic: this.ez[idx] };
      }
      const hx = this.staggeredAverageY(this.hx, x, y);
      const hy = this.staggeredAverageX(this.hy, x, y);
      const hParallel = hx * sin - hy * cos;
      return { electric: this.ez[idx], magnetic: hParallel };
    },

    directionalTangentialFieldsAt(idx, direction) {
      return this.directionalTangentialFieldsAtCell(idx % this.nx, Math.floor(idx / this.nx), direction);
    },

    lineWaveSeparationAt(x, direction = this.diagnosticDirection()) {
      const y0 = this.activeInteriorMinY();
      const y1 = this.activeInteriorMaxY();
      let forward = 0;
      let backward = 0;
      let forwardPower = 0;
      let backwardPower = 0;
      let impedance = 0;
      let samples = 0;
      const centerY = clampInt(Math.round((y0 + y1) * 0.5), y0, y1);
      let centerForward = 0;
      let centerBackward = 0;
      let centerDistance = Infinity;
      for (let y = y0; y <= y1; y += 1) {
        const idx = this.id(x, y);
        if (this.material[idx] === 2) continue;
        const epsValue = Math.max(1e-6, Math.abs(state.fieldComponent === "hz" ? this.epsY[idx] : this.eps[idx]));
        const muValue = Math.max(1e-6, Math.abs(state.fieldComponent === "hz" ? this.mu[idx] : this.muY[idx]));
        const z = Math.sqrt(muValue / epsValue);
        if (!Number.isFinite(z) || z <= 0) continue;
        const tangential = this.directionalTangentialFieldsAtCell(x, y, direction);
        const forwardField = 0.5 * (tangential.electric + z * tangential.magnetic);
        const backwardField = 0.5 * (tangential.electric - z * tangential.magnetic);
        const distance = Math.abs(y - centerY);
        if (distance < centerDistance) {
          centerDistance = distance;
          centerForward = forwardField;
          centerBackward = backwardField;
        }
        forward += forwardField;
        backward += backwardField;
        forwardPower += (forwardField * forwardField) / z;
        backwardPower += (backwardField * backwardField) / z;
        impedance += z;
        samples += 1;
      }
      if (samples <= 0) return { forward: 0, backward: 0, forwardPower: 0, backwardPower: 0, impedance: 1 };
      const powerScale = this.fieldPowerScale();
      return {
        forward: Number.isFinite(centerForward) ? centerForward : forward / samples,
        backward: Number.isFinite(centerBackward) ? centerBackward : backward / samples,
        forwardMean: forward / samples,
        backwardMean: backward / samples,
        forwardPower: (forwardPower / samples) * powerScale,
        backwardPower: (backwardPower / samples) * powerScale,
        impedance: impedance / samples,
      };
    },

    diagnosticFrequency() {
      const sineSource = state.sources.find((source) => source.type === "sine") || this.diagnosticIncidentSource();
      return clamp(Number(sineSource?.frequency) || defaultSourceConfig.frequency, 0.006, 0.095);
    },

    diagnosticDftOrders() {
      const omega = Math.abs(Number(state.modulationFrequency) || 0);
      return temporalFloquetAnalysisPresets.has(state.preset) && omega > 1e-6 ? [-2, -1, 0, 1, 2] : [];
    },

    modulationPhaseCoherenceEstimate() {
      if (!state.materialModulationEnabled || Math.abs(Number(state.modulationDepth) || 0) <= 1e-9) return null;
      const periodLambda = Math.max(0.1, Number(state.modulationPeriodLambda) || 1);
      const periodCells = Math.max(1, lambdaToCells(periodLambda));
      const theta = (((Number(state.modulationAngleDeg) || 0) % 360) * Math.PI) / 180;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      const globalPhase = ((Number(state.modulationPhaseDeg) || 0) * Math.PI) / 180;
      let count = 0;
      let re = 0;
      let im = 0;
      let phaseMin = Infinity;
      let phaseMax = -Infinity;

      for (let y = 0; y < this.ny; y += 1) {
        const row = y * this.nx;
        for (let x = 0; x < this.nx; x += 1) {
          const idx = row + x;
          if (!this.modulatedMaterial[idx]) continue;
          const localPhase = Number.isFinite(this.modulationPhaseOffset?.[idx]) ? this.modulationPhaseOffset[idx] : 0;
          const phase = (2 * Math.PI * (x * cosTheta + y * sinTheta)) / periodCells + globalPhase + localPhase;
          re += Math.cos(phase);
          im += Math.sin(phase);
          phaseMin = Math.min(phaseMin, phase);
          phaseMax = Math.max(phaseMax, phase);
          count += 1;
        }
      }
      if (count <= 0) return null;
      const meanRe = re / count;
      const meanIm = im / count;
      const spatialCoherence = clamp(Math.hypot(meanRe, meanIm), 0, 1);
      const modulationFrequency = Number(state.modulationFrequency) || 0;
      return {
        count,
        spatialCoherence,
        phaseSpreadRad: Number.isFinite(phaseMin) && Number.isFinite(phaseMax) ? phaseMax - phaseMin : 0,
        meanPhaseRad: Math.atan2(meanIm, meanRe),
        periodLambda,
        modulationFrequency,
        phaseVelocityLambdaPerStep: modulationFrequency * periodLambda,
      };
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

    accumulateDiagnosticPower(name, value) {
      if (!Number.isFinite(value) || value < 0) return;
      const alpha = this.diagnosticSamples < 24 ? 0.18 : 0.035;
      this[name] = (1 - alpha) * (Number(this[name]) || 0) + alpha * value;
    },

    diagnosticPowerFromPhasor(name, impedance) {
      const target = this.diagnosticPhasors[name];
      if (!target || this.diagnosticSamples <= 0) return 0;
      const amplitude = 2 * Math.hypot(target.re, target.im);
      const z = Math.max(1e-9, Math.abs(impedance));
      return (amplitude * amplitude * this.fieldPowerScale()) / (2 * z);
    },

    diagnosticPowerFromPhasorObject(target, impedance) {
      if (!target || this.diagnosticSamples <= 0) return 0;
      const amplitude = 2 * Math.hypot(target.re, target.im);
      const z = Math.max(1e-9, Math.abs(impedance));
      return (amplitude * amplitude * this.fieldPowerScale()) / (2 * z);
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
      const totalOutgoingPower = totalTransmittedPower + totalReflectedPower;
      const powerBalanceResidual = totalOutgoingPower - 1;
      const modulationPhase = this.modulationPhaseCoherenceEstimate();
      this.diagnosticDftSummary = {
        carrierFrequency: carrier.frequency,
        modulationFrequency: Math.abs(Number(state.modulationFrequency) || 0),
        modulationPhase,
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
          totalOutgoingPower,
          powerBalanceResidual,
          powerBalanceAbsResidual: Math.abs(powerBalanceResidual),
          transmittedSidebandPower,
          reflectedSidebandPower,
          normalization: "carrier incident DFT phasor at the input monitor",
          balanceNote:
            "Pout/Pinc - 1 for the measured orders; temporal modulation, loss/gain, truncation, and de-embedding error can all contribute.",
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

    updateLineDiagnostics() {
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
      this.accumulateDiagnosticPower("diagnosticIncidentPowerEwma", incident.forwardPower);
      this.accumulateDiagnosticPower("diagnosticReflectedPowerEwma", incident.backwardPower);
      this.accumulateDiagnosticPower("diagnosticTransmittedPowerEwma", transmitted.forwardPower);
      this.updateDiagnosticDftChannels(incident, transmitted, rightIncident);
      this.diagnosticSamples += 1;
      this.diagnosticImpedanceLeft = left.impedance;
      this.diagnosticImpedanceRight = right.impedance;
      this.diagnosticIncidentPhasorPower = this.diagnosticPowerFromPhasor("incident", incident.impedance);
      this.diagnosticReflectedPhasorPower = this.diagnosticPowerFromPhasor("reflected", incident.impedance);
      this.diagnosticTransmittedPhasorPower = this.diagnosticPowerFromPhasor("transmitted", transmitted.impedance);
      this.diagnosticIncidentPower = this.diagnosticIncidentPowerEwma || this.diagnosticIncidentPhasorPower;
      this.diagnosticReflectedPower = this.diagnosticReflectedPowerEwma || this.diagnosticReflectedPhasorPower;
      this.diagnosticTransmittedPower = this.diagnosticTransmittedPowerEwma || this.diagnosticTransmittedPhasorPower;
      if (this.diagnosticIncidentPower > 1e-12) {
        this.diagnosticReflectance = clamp(this.diagnosticReflectedPower / this.diagnosticIncidentPower, 0, 9.999);
        this.diagnosticTransmittance = clamp(this.diagnosticTransmittedPower / this.diagnosticIncidentPower, 0, 9.999);
      } else {
        this.diagnosticTransmittance = 0;
        this.diagnosticReflectance = 0;
      }
    },
  });
})();
