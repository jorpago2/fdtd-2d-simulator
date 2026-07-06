(function initFdtdModalAnalysis(global) {
  "use strict";

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function clampInteger(value, min, max) {
    return Math.round(clampNumber(value, min, max));
  }

  function complexPower(value) {
    const re = finiteNumber(value?.re, 0);
    const im = finiteNumber(value?.im, 0);
    return re * re + im * im;
  }

  function modePropagationSign(source) {
    const angleRad = ((finiteNumber(source?.angleDeg, 0) % 360) * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    return cos < -0.2 ? -1 : 1;
  }

  Object.assign(FDTDSim.prototype, {
    resetModePortDiagnostics() {
      this.modePortDftKey = "";
      this.modePortDftSampleIndex = 0;
      this.modePortDftSampleCount = 0;
      this.modePortDftSummary = null;
      this.modePortDftPositions = null;
      this.modePortDftTimeSeries = new Float64Array(DIAGNOSTIC_DFT_WINDOW);
      this.modePortDftInputSeries = new Float32Array(DIAGNOSTIC_DFT_WINDOW);
      this.modePortDftReflectedSeries = new Float32Array(DIAGNOSTIC_DFT_WINDOW);
      this.modePortDftTransmittedSeries = new Float32Array(DIAGNOSTIC_DFT_WINDOW);
    },

    modeAnalysisSource() {
      return state.sources.find((source) => source?.shape === "modeProfile") || null;
    },

    modeAnalysisDescriptorAt(source, x, sy) {
      if (!source || typeof this.modeProfileDescriptor !== "function") return null;
      const localSource = { ...source };
      return this.modeProfileDescriptor(localSource, x, sy);
    },

    modeProfileProjectionAt(descriptor, x) {
      if (!descriptor?.profile?.length) {
        return {
          x,
          samples: 0,
          overlap: 0,
          signedOverlap: 0,
          fieldNorm: 0,
          modalNorm: 0,
          modalAmplitude: 0,
          peakField: 0,
          valid: false,
        };
      }
      const xCell = clampInteger(x, this.activeInteriorMinX(), this.activeInteriorMaxX());
      let fieldNorm = 0;
      let modalNorm = 0;
      let overlap = 0;
      let samples = 0;
      let peakField = 0;
      for (let offset = 0; offset < descriptor.profile.length; offset += 1) {
        const y = descriptor.y0 + offset;
        if (y < this.activeInteriorMinY() || y > this.activeInteriorMaxY()) continue;
        const idx = this.id(xCell, y);
        if (this.material[idx] === 2) continue;
        const field = finiteNumber(this.ez[idx], 0) * finiteNumber(this.fieldScale, 1);
        const modal = finiteNumber(descriptor.profile[offset], 0);
        if (!Number.isFinite(field) || !Number.isFinite(modal)) continue;
        fieldNorm += field * field;
        modalNorm += modal * modal;
        overlap += field * modal;
        peakField = Math.max(peakField, Math.abs(field));
        samples += 1;
      }
      const denominator = Math.max(1e-30, fieldNorm * modalNorm);
      const signedOverlap = overlap / Math.sqrt(denominator);
      return {
        x: xCell,
        samples,
        overlap: clampNumber(signedOverlap * signedOverlap, 0, 1),
        signedOverlap: clampNumber(signedOverlap, -1, 1),
        fieldNorm,
        modalNorm,
        modalAmplitude: modalNorm > 1e-30 ? overlap / modalNorm : 0,
        peakField,
        valid: samples > 3 && fieldNorm > 1e-24 && modalNorm > 1e-24,
      };
    },

    modePortPositions(source, sourceDescriptor) {
      const cpw = Math.max(8, finiteNumber(state.cellsPerWavelength, 20));
      const sign = modePropagationSign(source);
      const sx = clampInteger(sourceDescriptor?.sx, this.activeInteriorMinX() + 1, this.activeInteriorMaxX() - 1);
      const sy = clampInteger(sourceDescriptor?.sy, this.activeInteriorMinY(), this.activeInteriorMaxY());
      const margin = Math.max(4, Math.round(cpw * 0.9));
      const portOffset = Math.max(3, Math.round(cpw * 0.7));
      const inputX = clampInteger(sx + sign * portOffset, this.activeInteriorMinX() + 1, this.activeInteriorMaxX() - 1);
      const outputX =
        sign > 0
          ? clampInteger(this.activeInteriorMaxX() - margin, this.activeInteriorMinX() + 1, this.activeInteriorMaxX() - 1)
          : clampInteger(this.activeInteriorMinX() + margin, this.activeInteriorMinX() + 1, this.activeInteriorMaxX() - 1);
      const reflectionX = clampInteger(sx - sign * portOffset, this.activeInteriorMinX() + 1, this.activeInteriorMaxX() - 1);
      return {
        cpw,
        sign,
        sx,
        sy,
        inputX,
        outputX,
        reflectionX,
        outputDistanceLambda: Math.abs(outputX - inputX) / cpw,
      };
    },

    modePortProjectionAt(source, x, sy, fallbackDescriptor = null) {
      const descriptor = this.modeAnalysisDescriptorAt(source, x, sy) || fallbackDescriptor;
      const projection = this.modeProfileProjectionAt(descriptor, x);
      return { descriptor, projection };
    },

    modePortDiagnosticsKey(source, sourceDescriptor, positions) {
      return [
        state.fieldComponent,
        this.nx,
        this.ny,
        finiteNumber(state.cellsPerWavelength, 0).toFixed(6),
        finiteNumber(source?.frequency, 0).toFixed(8),
        finiteNumber(source?.angleDeg, 0).toFixed(4),
        finiteNumber(source?.modeOrder, 0).toFixed(0),
        positions.inputX,
        positions.outputX,
        positions.reflectionX,
        finiteNumber(sourceDescriptor?.betaCells, 0).toFixed(8),
        finiteNumber(sourceDescriptor?.neff, 0).toFixed(8),
      ].join("|");
    },

    ensureModePortDiagnostics() {
      if (!this.modePortDftTimeSeries) this.resetModePortDiagnostics();
      const source = this.modeAnalysisSource();
      if (!source || typeof this.modeProfileSourceDescriptor !== "function") {
        this.modePortDftSummary = null;
        return null;
      }
      const sourceDescriptor = this.modeProfileSourceDescriptor(source);
      if (!sourceDescriptor?.profile?.length) {
        this.modePortDftSummary = null;
        return null;
      }
      const positions = this.modePortPositions(source, sourceDescriptor);
      const key = this.modePortDiagnosticsKey(source, sourceDescriptor, positions);
      if (key !== this.modePortDftKey) {
        this.modePortDftKey = key;
        this.modePortDftSampleIndex = 0;
        this.modePortDftSampleCount = 0;
        this.modePortDftSummary = null;
        this.modePortDftInputSeries.fill(0);
        this.modePortDftReflectedSeries.fill(0);
        this.modePortDftTransmittedSeries.fill(0);
      }
      this.modePortDftPositions = positions;
      return { source, sourceDescriptor, positions };
    },

    modePortDftPhasor(series, frequency) {
      const count = this.modePortDftSampleCount;
      const length = series?.length || 0;
      if (count < 48 || length <= 0 || !Number.isFinite(frequency) || frequency <= 0) return { re: 0, im: 0 };
      const start = (this.modePortDftSampleIndex - count + length) % length;
      let re = 0;
      let im = 0;
      let windowSum = 0;
      for (let n = 0; n < count; n += 1) {
        const index = (start + n) % length;
        const value = series[index];
        if (!Number.isFinite(value)) continue;
        const window = count > 1 ? 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (count - 1)) : 1;
        const phase = 2 * Math.PI * frequency * this.modePortDftTimeSeries[index];
        re += window * value * Math.cos(phase);
        im -= window * value * Math.sin(phase);
        windowSum += window;
      }
      if (windowSum <= 1e-12) return { re: 0, im: 0 };
      return { re: re / windowSum, im: im / windowSum };
    },

    updateModePortDiagnostics() {
      const setup = this.ensureModePortDiagnostics();
      if (!setup) return;
      const { source, sourceDescriptor, positions } = setup;
      const input = this.modePortProjectionAt(source, positions.inputX, positions.sy, sourceDescriptor);
      const reflected = this.modePortProjectionAt(source, positions.reflectionX, positions.sy, sourceDescriptor);
      const transmitted = this.modePortProjectionAt(source, positions.outputX, positions.sy, sourceDescriptor);
      const index = this.modePortDftSampleIndex;
      this.modePortDftTimeSeries[index] = this.time;
      this.modePortDftInputSeries[index] = finiteNumber(input.projection.modalAmplitude, 0);
      this.modePortDftReflectedSeries[index] = finiteNumber(reflected.projection.modalAmplitude, 0);
      this.modePortDftTransmittedSeries[index] = finiteNumber(transmitted.projection.modalAmplitude, 0);
      this.modePortDftSampleIndex = (index + 1) % this.modePortDftTimeSeries.length;
      this.modePortDftSampleCount = Math.min(this.modePortDftSampleCount + 1, this.modePortDftTimeSeries.length);

      if (this.modePortDftSampleCount < 64) {
        this.modePortDftSummary = null;
        return;
      }
      const updateStride = this.modePortDftSampleCount < 160 ? 8 : 16;
      if (this.modePortDftSummary && this.modePortDftSampleIndex % updateStride !== 0) return;

      const carrierFrequency = Math.max(1e-6, finiteNumber(source.frequency, this.diagnosticFrequency?.() || 0.02));
      const inputPhasor = this.modePortDftPhasor(this.modePortDftInputSeries, carrierFrequency);
      const reflectedPhasor = this.modePortDftPhasor(this.modePortDftReflectedSeries, carrierFrequency);
      const transmittedPhasor = this.modePortDftPhasor(this.modePortDftTransmittedSeries, carrierFrequency);
      const inputPower = complexPower(inputPhasor);
      const s11 = complexPhasorRatio(reflectedPhasor, inputPhasor);
      const s21 = complexPhasorRatio(transmittedPhasor, inputPhasor);
      const reflectance = clampNumber(complexPower(s11), 0, 9.999);
      const transmittance = clampNumber(complexPower(s21), 0, 9.999);
      const balanceResidual = 1 - reflectance - transmittance;
      this.modePortDftSummary = {
        valid: inputPower > 1e-18 && this.modePortDftSampleCount >= 64,
        carrierFrequency,
        sampleCount: this.modePortDftSampleCount,
        positions,
        inputPower,
        inputPhasor,
        reflectedPhasor,
        transmittedPhasor,
        s11,
        s21,
        reflectance,
        transmittance,
        absorption: clampNumber(balanceResidual, 0, 9.999),
        balanceResidual,
        inputOverlap: input.projection.overlap,
        outputOverlap: transmitted.projection.overlap,
        reflectedOverlap: reflected.projection.overlap,
        normalization: "single-mode projection phasors normalized to the input modal projection",
      };
    },

    modePortAnalysisEstimate() {
      const source = this.modeAnalysisSource();
      if (!source || typeof this.modeProfileSourceDescriptor !== "function") return null;
      const sourceDescriptor = this.modeProfileSourceDescriptor(source);
      if (!sourceDescriptor?.profile?.length) {
        return {
          available: false,
          reason: "no guided scalar mode found at the source cross-section",
          sourceShape: source?.shape || "",
        };
      }

      const positions = this.modePortPositions(source, sourceDescriptor);

      const inputDescriptor = this.modeAnalysisDescriptorAt(source, positions.inputX, positions.sy) || sourceDescriptor;
      const outputDescriptor = this.modeAnalysisDescriptorAt(source, positions.outputX, positions.sy) || sourceDescriptor;
      const reflectionDescriptor = this.modeAnalysisDescriptorAt(source, positions.reflectionX, positions.sy) || sourceDescriptor;
      const input = this.modeProfileProjectionAt(inputDescriptor, positions.inputX);
      const output = this.modeProfileProjectionAt(outputDescriptor, positions.outputX);
      const reflected = this.modeProfileProjectionAt(reflectionDescriptor, positions.reflectionX);
      const modalTransmissionProxy = clampNumber(output.overlap * finiteNumber(this.diagnosticTransmittance, 0), 0, 9.999);
      const modalReflectionProxy = clampNumber(reflected.overlap * finiteNumber(this.diagnosticReflectance, 0), 0, 9.999);
      const radiationFraction = clampNumber(1 - output.overlap, 0, 1);
      const sParameters = this.modePortDftSummary?.valid
        ? {
            s11: this.modePortDftSummary.s11,
            s21: this.modePortDftSummary.s21,
            reflectance: this.modePortDftSummary.reflectance,
            transmittance: this.modePortDftSummary.transmittance,
            absorption: this.modePortDftSummary.absorption,
            balanceResidual: this.modePortDftSummary.balanceResidual,
            sampleCount: this.modePortDftSummary.sampleCount,
            carrierFrequency: this.modePortDftSummary.carrierFrequency,
            outputDistanceLambda: this.modePortDftSummary.positions?.outputDistanceLambda || positions.outputDistanceLambda,
            normalization: this.modePortDftSummary.normalization,
          }
        : null;

      return {
        available: true,
        sourceShape: source.shape,
        modeOrder: Math.max(0, Math.round(finiteNumber(source.modeOrder, sourceDescriptor.modeOrder || 0))),
        neff: finiteNumber(sourceDescriptor.neff, 0),
        betaCells: finiteNumber(sourceDescriptor.betaCells, 0),
        windowLambda: (sourceDescriptor.y1 - sourceDescriptor.y0 + 1) / positions.cpw,
        directionSign: positions.sign,
        positions,
        input,
        output,
        reflected,
        inputOverlap: input.overlap,
        outputOverlap: output.overlap,
        reflectedOverlap: reflected.overlap,
        modalTransmissionProxy,
        modalReflectionProxy,
        radiationFraction,
        sParameters,
        samples: Math.min(input.samples, output.samples, reflected.samples),
        valid: input.valid || output.valid || reflected.valid,
        normalization: "normalized scalar inner product with the finite-difference source mode profile",
      };
    },
  });
})(typeof window !== "undefined" ? window : self);
