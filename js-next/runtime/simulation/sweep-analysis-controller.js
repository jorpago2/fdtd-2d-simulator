(function initFdtdSweepAnalysis(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error("Sweep analysis dependency must provide " + name + "().");
    }
    return value;
  }

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error("Sweep analysis dependency must provide " + name + ".");
    }
    return value;
  }

  function createSweepAnalysisController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const el = requireObject(dependencies.el, "el");
    const sim = requireObject(dependencies.sim, "sim");
    const resultsCharts = requireObject(dependencies.resultsCharts, "resultsCharts");
    const defaultSourceConfig = requireObject(dependencies.defaultSourceConfig, "defaultSourceConfig");

    const clamp = requireFunction(dependencies.clamp, "clamp");
    const clampInt = requireFunction(dependencies.clampInt, "clampInt");
    const selectedSource = requireFunction(dependencies.selectedSource, "selectedSource");
    const normalizeSource = requireFunction(dependencies.normalizeSource, "normalizeSource");
    const maxSourceXLambda = requireFunction(dependencies.maxSourceXLambda, "maxSourceXLambda");
    const minSourceXLambda = requireFunction(dependencies.minSourceXLambda, "minSourceXLambda");
    const setControlDisabled = requireFunction(dependencies.setControlDisabled, "setControlDisabled");
    const timeStepBatch = requireFunction(dependencies.timeStepBatch, "timeStepBatch");
    const updateControlText = requireFunction(dependencies.updateControlText, "updateControlText");
    const updateStats = requireFunction(dependencies.updateStats, "updateStats");
    const formatDiagnosticRatio = requireFunction(dependencies.formatDiagnosticRatio, "formatDiagnosticRatio");
    const formatFieldValue = requireFunction(dependencies.formatFieldValue, "formatFieldValue");
    const safeFilePart = requireFunction(dependencies.safeFilePart, "safeFilePart");

    const incidentFieldSourceShapes = requireObject(dependencies.incidentFieldSourceShapes, "incidentFieldSourceShapes");
    const negativeIndexAnalysisPresets = requireObject(dependencies.negativeIndexAnalysisPresets, "negativeIndexAnalysisPresets");
    const bianisotropyAnalysisPresets = requireObject(dependencies.bianisotropyAnalysisPresets, "bianisotropyAnalysisPresets");
    const temporalFloquetAnalysisPresets = requireObject(dependencies.temporalFloquetAnalysisPresets, "temporalFloquetAnalysisPresets");
    const nonlinearAnalysisPresets = requireObject(dependencies.nonlinearAnalysisPresets, "nonlinearAnalysisPresets");
    const phaseChangeAnalysisPresets = requireObject(dependencies.phaseChangeAnalysisPresets, "phaseChangeAnalysisPresets");
    const harmonicAnalysisPresets = requireObject(dependencies.harmonicAnalysisPresets, "harmonicAnalysisPresets");
    const resonatorAnalysisPresets = requireObject(dependencies.resonatorAnalysisPresets, "resonatorAnalysisPresets");
    const purcellAnalysisPresets = requireObject(dependencies.purcellAnalysisPresets, "purcellAnalysisPresets");
    const betaAnalysisPresets = requireObject(dependencies.betaAnalysisPresets, "betaAnalysisPresets");
    const degenerateAnalysisPresets = requireObject(dependencies.degenerateAnalysisPresets, "degenerateAnalysisPresets");
    const ptModalAnalysisPresets = requireObject(dependencies.ptModalAnalysisPresets, "ptModalAnalysisPresets");
    const leakageAnalysisPresets = requireObject(dependencies.leakageAnalysisPresets, "leakageAnalysisPresets");
    const phcBlochAnalysisPresets = requireObject(dependencies.phcBlochAnalysisPresets, "phcBlochAnalysisPresets");
    const coupledWorkflowAnalysisPresets = requireObject(dependencies.coupledWorkflowAnalysisPresets, "coupledWorkflowAnalysisPresets");
    const absorptionAnalysisPresets = requireObject(dependencies.absorptionAnalysisPresets, "absorptionAnalysisPresets");

    const SWEEP_STEADY_WINDOW = 5;
    const SWEEP_STEADY_MIN_SAMPLES = 4;
    const SWEEP_STEADY_TOLERANCE = 0.035;
    const SWEEP_STEADY_ABSOLUTE_FLOOR = 1e-4;
    
    function sweepSourceTarget() {
      return state.sources.find((source) => incidentFieldSourceShapes.has(source.shape)) || selectedSource() || state.sources[0] || null;
    }
    
    function normalizeSweepMode(mode) {
      if (
        mode === "frequency" ||
        mode === "amplitude" ||
        mode === "gainLoss" ||
        mode === "symmetry" ||
        mode === "blochK" ||
        mode === "direction"
      ) {
        return mode;
      }
      return "angle";
    }
    
    function sweepModeLabel(mode = state.sweepMode) {
      if (mode === "frequency") return "f";
      if (mode === "amplitude") return "A";
      if (mode === "symmetry") return "d";
      if (mode === "blochK") return "k";
      if (mode === "direction") return "dir";
      if (mode === "gainLoss") return "γ";
      return "θ";
    }
    
    function sweepUnitLabel(mode = state.sweepMode) {
      return mode === "angle" ? "°" : "";
    }
    
    function clampSweepRangeForMode(mode, value) {
      const normalizedMode = normalizeSweepMode(mode);
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        if (normalizedMode === "frequency") return defaultSourceConfig.frequency;
        if (normalizedMode === "amplitude") return defaultSourceConfig.amplitude;
        if (normalizedMode === "gainLoss") return 0.04;
        if (normalizedMode === "symmetry") return 0;
        if (normalizedMode === "blochK") return 0;
        if (normalizedMode === "direction") return 0;
        return 0;
      }
      if (normalizedMode === "frequency") return clamp(numeric, 0.006, 0.095);
      if (normalizedMode === "amplitude") return clamp(numeric, 0.05, 1.2);
      if (normalizedMode === "gainLoss") return clamp(numeric, 0, 0.1);
      if (normalizedMode === "symmetry") return clamp(numeric, 0, 0.25);
      if (normalizedMode === "blochK") return clamp(numeric, 0, 1);
      if (normalizedMode === "direction") return clamp(numeric, 0, 1);
      return clamp(numeric, -80, 80);
    }
    
    function formatSweepValue(value) {
      if (state.sweepMode === "frequency") return Number(value).toFixed(3);
      if (state.sweepMode === "amplitude") return Number(value).toFixed(2);
      if (state.sweepMode === "symmetry") return Number(value).toFixed(3);
      if (state.sweepMode === "blochK") return Number(value).toFixed(3);
      if (state.sweepMode === "gainLoss") return Number(value).toFixed(3);
      if (state.sweepMode === "direction") return Number(value) >= 0.5 ? "R" : "F";
      return String(Math.round(Number(value)));
    }
    
    function syncSweepStateFromInputs() {
      state.sweepMode = normalizeSweepMode(el.sweepModeInput?.value);
      state.sweepStart = clampSweepRangeForMode(state.sweepMode, el.sweepStartInput?.value);
      state.sweepEnd = clampSweepRangeForMode(state.sweepMode, el.sweepEndInput?.value);
      state.sweepSamples = clampInt(Number(el.sweepSamplesInput?.value) || 9, 3, 41);
      if (state.sweepMode === "direction") state.sweepSamples = 2;
      state.sweepSteps = clampInt(Number(el.sweepStepsInput?.value) || 720, 120, 4000);
      state.sweepBidirectional =
        state.sweepMode === "amplitude" && Boolean(el.sweepBidirectionalInput?.checked);
    }
    
    function updateSweepControls() {
      if (!el.sweepModeInput) return;
      const frequencyMode = state.sweepMode === "frequency";
      const amplitudeMode = state.sweepMode === "amplitude";
      const gainLossMode = state.sweepMode === "gainLoss";
      const symmetryMode = state.sweepMode === "symmetry";
      const blochMode = state.sweepMode === "blochK";
      const directionMode = state.sweepMode === "direction";
      const bidirectionalEnabled = amplitudeMode && state.sweepBidirectional;
      const sweepInputRange = () => {
        if (frequencyMode) return { min: "0.006", max: "0.095", step: "0.001", decimals: 3 };
        if (amplitudeMode) return { min: "0.05", max: "1.2", step: "0.05", decimals: 2 };
        if (gainLossMode) return { min: "0", max: "0.1", step: "0.002", decimals: 3 };
        if (symmetryMode) return { min: "0", max: "0.25", step: "0.005", decimals: 3 };
        if (blochMode) return { min: "0", max: "1", step: "0.02", decimals: 3 };
        if (directionMode) return { min: "0", max: "1", step: "1", decimals: 0 };
        return { min: "-80", max: "80", step: "1", decimals: 0 };
      };
      const inputRange = sweepInputRange();
      const formatSweepInput = (value) =>
        inputRange.decimals > 0 ? Number(value).toFixed(inputRange.decimals) : String(Math.round(Number(value)));
      el.sweepModeInput.value = state.sweepMode;
      if (el.sweepStartInput) {
        el.sweepStartInput.min = inputRange.min;
        el.sweepStartInput.max = inputRange.max;
        el.sweepStartInput.step = inputRange.step;
        el.sweepStartInput.value = formatSweepInput(state.sweepStart);
      }
      if (el.sweepEndInput) {
        el.sweepEndInput.min = inputRange.min;
        el.sweepEndInput.max = inputRange.max;
        el.sweepEndInput.step = inputRange.step;
        el.sweepEndInput.value = formatSweepInput(state.sweepEnd);
      }
      setControlDisabled(el.sweepStartInput?.closest("label"), el.sweepStartInput, directionMode);
      setControlDisabled(el.sweepEndInput?.closest("label"), el.sweepEndInput, directionMode);
      if (el.sweepSamplesInput) {
        el.sweepSamplesInput.min = directionMode ? "2" : "3";
        el.sweepSamplesInput.max = directionMode ? "2" : "41";
        el.sweepSamplesInput.value = String(state.sweepSamples);
        setControlDisabled(el.sweepSamplesInput.closest("label"), el.sweepSamplesInput, directionMode);
      }
      if (el.sweepStepsInput) el.sweepStepsInput.value = String(state.sweepSteps);
      if (el.sweepBidirectionalInput) {
        el.sweepBidirectionalInput.checked = bidirectionalEnabled;
        setControlDisabled(el.sweepBidirectionalInput.closest("label"), el.sweepBidirectionalInput, !amplitudeMode || state.sweepRunning);
      }
      if (el.sweepRunBtn) el.sweepRunBtn.textContent = state.sweepRunning ? "Cancel sweep" : "Run sweep";
      if (el.sweepExportBtn) el.sweepExportBtn.disabled = state.sweepRunning || state.sweepResults.length === 0;
      drawSweepChart();
    }
    
    function setSweepStatus(text) {
      if (el.sweepStatus) el.sweepStatus.textContent = text;
    }
    
    function sweepReadyStatusText() {
      if (state.sweepMode === "blochK") return "Bloch k sweep uses the current photonic-crystal geometry.";
      if (state.preset === "hyperlens" && (state.sweepMode === "frequency" || state.sweepMode === "amplitude")) {
        return "Hyperlens sweep plots outer/inner ring transfer from FDTD field samples.";
      }
      if (negativeIndexAnalysisPresets.has(state.preset) && (state.sweepMode === "frequency" || state.sweepMode === "amplitude")) {
        return state.preset === "superlensSlab"
          ? "Superlens sweep plots image-transfer and width metrics from FDTD field samples."
          : "Negative-index sweep plots the in-slab beam-angle sign and power-balance residual.";
      }
      if (bianisotropyAnalysisPresets.has(state.preset) && (state.sweepMode === "frequency" || state.sweepMode === "amplitude")) {
        return "Bianisotropy sweep plots cross-polarized output conversion from the six-field FDTD path.";
      }
      return "Sweep uses the current scene and the active incident source.";
    }
    
    function nextAnimationFrame() {
      return new Promise((resolve) => requestAnimationFrame(resolve));
    }
    
    function brewsterSweepReference() {
      if (state.sweepMode !== "angle") return null;
      if (state.preset !== "brewsterTm" && state.preset !== "brewsterTeTm" && state.preset !== "teTmComparison") return null;
      const n1 = 1;
      const n2 = 1.5;
      return {
        n1,
        n2,
        thetaB: (Math.atan(n2 / n1) * 180) / Math.PI,
        comparePolarizations: state.preset === "brewsterTeTm" || state.preset === "teTmComparison",
      };
    }
    
    function dualPolarizationSweepEnabled() {
      return (state.preset === "brewsterTeTm" || state.preset === "teTmComparison") && state.sweepMode === "angle";
    }
    
    function gainLossSweepCompatible() {
      return state.preset === "ptSymmetricCoupler" || state.preset === "exceptionalPointCoupler";
    }
    
    function gainLossSweepSnapshot() {
      return {
        loss: new Float32Array(sim.loss),
        lossY: new Float32Array(sim.lossY),
      };
    }
    
    function restoreGainLossSweepSnapshot(snapshot) {
      if (!snapshot) return;
      sim.loss.set(snapshot.loss);
      sim.lossY.set(snapshot.lossY);
    }
    
    function applyGainLossSweepValue(snapshot, value) {
      if (!snapshot || !gainLossSweepCompatible()) return 0;
      const gamma = clampSweepRangeForMode("gainLoss", value);
      let count = 0;
      for (let i = 0; i < sim.n; i += 1) {
        const baseLoss = snapshot.loss[i];
        if (Math.abs(baseLoss) < 0.01 || sim.material[i] === 2) continue;
        const signedLoss = baseLoss < 0 ? -gamma : gamma;
        sim.loss[i] = signedLoss;
        sim.lossY[i] = Math.abs(snapshot.lossY[i]) >= 0.01 ? signedLoss : snapshot.lossY[i];
        count += 1;
      }
      return count;
    }
    
    function symmetrySweepCompatible() {
      return state.preset === "phcDarkMode" || state.preset === "quasiBic" || state.preset === "symmetryProtectedBic";
    }
    
    function blochSweepCompatible() {
      return phcBlochAnalysisPresets.has(state.preset);
    }
    
    function directionSweepCompatible() {
      return (
        state.preset === "travelingModulation" ||
        state.preset === "temporalIsolator" ||
        state.preset === "topologyTemporalMod" ||
        state.preset === "nonreciprocalValleyHall" ||
        state.preset === "spaceTimeCrystal"
      );
    }
    
    function applyDirectionSweepValue(source, value) {
      if (!source) return "forward";
      const reverse = Number(value) >= 0.5;
      source.type = "sine";
      source.shape = incidentFieldSourceShapes.has(source.shape) ? source.shape : "gaussianProfile";
      source.angleDeg = reverse ? 180 : 0;
      source.xLambda = reverse ? maxSourceXLambda() - 0.12 : minSourceXLambda() + 0.12;
      normalizeSource(source);
      return reverse ? "reverse" : "forward";
    }
    
    function symmetrySweepSnapshot() {
      return sim.snapshotMaterialArrays();
    }
    
    function restoreSymmetrySweepSnapshot(snapshot) {
      if (!snapshot) return;
      sim.restoreMaterialArrays(snapshot);
      sim.refreshPmlMaterialContinuation(false);
    }
    
    function applySymmetrySweepValue(snapshot, value) {
      if (!snapshot || !symmetrySweepCompatible()) return 0;
      const delta = clampSweepRangeForMode("symmetry", value);
      sim.restoreMaterialArrays(snapshot);
      if (delta <= 1e-9) {
        sim.refreshPmlMaterialContinuation(false);
        return 0;
      }
    
      const cx = (sim.nx - 1) * 0.5;
      const cy = (sim.ny - 1) * 0.5;
      const spanX = Math.max(4, state.cellsPerWavelength * 2.4);
      const spanY = Math.max(4, state.cellsPerWavelength * 1.7);
      const minX = Math.max(1, Math.floor(cx - spanX));
      const maxX = Math.min(sim.nx - 2, Math.ceil(cx + spanX));
      const minY = Math.max(1, Math.floor(cy - spanY));
      const maxY = Math.min(sim.ny - 2, Math.ceil(cy + spanY));
      let count = 0;
    
      for (let y = minY; y <= maxY; y += 1) {
        const dy = Math.abs((y - cy) / spanY);
        if (dy > 1) continue;
        for (let x = minX; x <= maxX; x += 1) {
          const dx = (x - cx) / spanX;
          if (Math.abs(dx) > 1) continue;
          const idx = sim.id(x, y);
          if (snapshot.material[idx] === 0 || snapshot.material[idx] === 2 || snapshot.eps[idx] <= 1.2) continue;
          const weight = (1 - Math.abs(dx)) * (1 - dy);
          const sign = x >= cx ? -1 : 1;
          const scale = clamp(1 + sign * delta * weight, 0.65, 1.35);
          sim.eps[idx] = clamp(snapshot.eps[idx] * scale, 1, 30);
          sim.epsY[idx] = clamp(snapshot.epsY[idx] * scale, 1, 30);
          if (snapshot.modulatedMaterial[idx] || snapshot.nonlinearMaterial[idx]) {
            sim.modulationBaseEps[idx] = sim.eps[idx];
            sim.modulationBaseEpsY[idx] = sim.epsY[idx];
          }
          count += 1;
        }
      }
      sim.refreshPmlMaterialContinuation(false);
      return count;
    }
    
    function bidirectionalSweepActive() {
      return state.sweepMode === "amplitude" && Boolean(state.sweepBidirectional);
    }
    
    function buildSweepScanPoints() {
      if (state.sweepMode === "direction") {
        return [
          { value: 0, branch: "forward", branchIndex: 0 },
          { value: 1, branch: "reverse", branchIndex: 1 },
        ];
      }
      const valueCount = Math.max(1, state.sweepSamples);
      const values = Array.from({ length: valueCount }, (_unused, index) => {
        const t = valueCount === 1 ? 0 : index / (valueCount - 1);
        return state.sweepStart + (state.sweepEnd - state.sweepStart) * t;
      });
      if (!bidirectionalSweepActive()) {
        return values.map((value, index) => ({ value, branch: "", branchIndex: index }));
      }
      return [
        ...values.map((value, index) => ({ value, branch: "forward", branchIndex: index })),
        ...values.slice().reverse().map((value, index) => ({ value, branch: "reverse", branchIndex: index })),
      ];
    }
    
    function sweepAuxMetric() {
      if (state.sweepMode === "gainLoss") return { key: "split", label: "df", only: true };
      if (state.sweepMode === "symmetry") return { key: "leakage", label: "leak", only: true };
      if (state.sweepMode === "blochK") return { key: "blochBandFrequency", label: "f1", only: true };
      if (state.preset === "hyperlens" && (state.sweepMode === "frequency" || state.sweepMode === "amplitude")) {
        return { key: "hyperlensTransfer", label: "Hout/Hin", only: true };
      }
      if (negativeIndexAnalysisPresets.has(state.preset) && (state.sweepMode === "frequency" || state.sweepMode === "amplitude")) {
        return state.preset === "superlensSlab"
          ? { key: "superlensImageTransfer", label: "img", only: true }
          : { key: "negativeRefractionScore", label: "neg", only: true };
      }
      if (bianisotropyAnalysisPresets.has(state.preset) && (state.sweepMode === "frequency" || state.sweepMode === "amplitude")) {
        return { key: "bianisotropyOutputCrossFraction", label: "xpol", only: true };
      }
      if (
        (state.sweepMode === "amplitude" || state.sweepMode === "frequency") &&
        temporalFloquetAnalysisPresets.has(state.preset)
      ) {
        return { key: "floquetPowerSideband", label: "Pside" };
      }
      if (state.sweepMode !== "amplitude") return null;
      if (state.preset === "shgSlab") return { key: "h2", label: "H2" };
      if (state.preset === "thgSlab") return { key: "h3", label: "H3" };
      if (phaseChangeAnalysisPresets.has(state.preset)) return { key: "phaseState", label: "s" };
      if (state.preset === "exceptionalPointCoupler") return { key: "split", label: "df" };
      if (nonlinearAnalysisPresets.has(state.preset)) return { key: "sideband", label: "side" };
      return null;
    }
    
    function sweepMetricValue(metrics, key) {
      if (key === "h2") return metrics?.harmonic2 || 0;
      if (key === "h3") return metrics?.harmonic3 || 0;
      if (key === "sideband") return metrics?.sidebandRatio || 0;
      if (key === "phaseState") return metrics?.phaseAverage ?? sim.phaseChangeStateEstimate();
      if (key === "split") return metrics?.split || 0;
      if (key === "leakage") return metrics?.leakageRate || 0;
      if (key === "blochLeakage") return metrics?.phcBloch?.leakage || 0;
      if (key === "blochBandFrequency") return metrics?.phcBloch?.bandFrequency || 0;
      if (key === "floquetPowerSideband") return metrics?.floquet?.sidebandPower || 0;
      if (key === "hyperlensTransfer") return metrics?.hyperlens?.transfer || 0;
      if (key === "hyperlensDetailTransfer") return metrics?.hyperlens?.detailTransfer || 0;
      if (key === "negativeRefractionScore") return metrics?.negativeIndex?.negativeRefractionScore || 0;
      if (key === "superlensImageTransfer") return metrics?.negativeIndex?.imageTransfer || 0;
      if (key === "bianisotropyOutputCrossFraction") return metrics?.bianisotropy?.outputCrossFraction || 0;
      if (key === "bianisotropyMaterialCrossFraction") return metrics?.bianisotropy?.materialCrossFraction || 0;
      return 0;
    }
    
    function sweepSteadyObservation(metrics = null) {
      const observation = {
        r: sim.diagnosticReflectance || 0,
        t: sim.diagnosticTransmittance || 0,
      };
      const auxMetric = sweepAuxMetric();
      if (auxMetric) observation[auxMetric.key] = sweepMetricValue(metrics, auxMetric.key);
      if (phaseChangeAnalysisPresets.has(state.preset)) {
        observation.phaseState = sweepMetricValue(metrics, "phaseState");
      }
      return observation;
    }
    
    function sweepSteadyEstimate(history) {
      const tail = history
        .filter(Boolean)
        .slice(-SWEEP_STEADY_WINDOW);
      if (tail.length < SWEEP_STEADY_MIN_SAMPLES) {
        return {
          steady: false,
          drift: Infinity,
          key: "samples",
          samples: tail.length,
          tolerance: SWEEP_STEADY_TOLERANCE,
        };
      }
      const keys = Array.from(new Set(tail.flatMap((sample) => Object.keys(sample))));
      let worstDrift = 0;
      let worstKey = "";
      let validKeys = 0;
    
      keys.forEach((key) => {
        const values = tail
          .map((sample) => Number(sample[key]))
          .filter((value) => Number.isFinite(value));
        if (values.length < SWEEP_STEADY_MIN_SAMPLES) return;
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const meanAbs = values.reduce((sum, value) => sum + Math.abs(value), 0) / values.length;
        const scale = Math.max(SWEEP_STEADY_ABSOLUTE_FLOOR, meanAbs);
        const drift = (maxValue - minValue) / scale;
        validKeys += 1;
        if (drift >= worstDrift) {
          worstDrift = drift;
          worstKey = key;
        }
      });
    
      if (validKeys === 0) {
        return {
          steady: false,
          drift: Infinity,
          key: "metrics",
          samples: tail.length,
          tolerance: SWEEP_STEADY_TOLERANCE,
        };
      }
    
      return {
        steady: worstDrift <= SWEEP_STEADY_TOLERANCE,
        drift: worstDrift,
        key: worstKey,
        samples: tail.length,
        tolerance: SWEEP_STEADY_TOLERANCE,
      };
    }
    
    function formatSweepDrift(value) {
      if (!Number.isFinite(value)) return "n/a";
      const percent = 100 * value;
      if (percent >= 10) return `${percent.toFixed(0)}%`;
      if (percent >= 1) return `${percent.toFixed(1)}%`;
      return `${percent.toFixed(2)}%`;
    }
    
    function directionSweepIsolationEstimate(results = state.sweepResults) {
      if (state.sweepMode !== "direction") return null;
      const forward = results.find((result) => result.branch === "forward");
      const reverse = results.find((result) => result.branch === "reverse");
      if (!forward || !reverse) return null;
      const floor = 1e-6;
      const tForward = Math.max(0, Number(forward.t) || 0);
      const tReverse = Math.max(0, Number(reverse.t) || 0);
      const isolationDb = 10 * Math.log10((tForward + floor) / (tReverse + floor));
      return {
        tForward,
        tReverse,
        isolationDb: Number.isFinite(isolationDb) ? isolationDb : 0,
      };
    }
    
    function formatIsolationDb(value) {
      if (!Number.isFinite(value)) return "n/a";
      return `${value >= 0 ? "+" : ""}${value.toFixed(Math.abs(value) < 10 ? 2 : 1)} dB`;
    }
    
    function sweepResultStatusText(result, pointIndex, pointCount) {
      const auxMetric = sweepAuxMetric();
      const branchText = result.branch ? `${result.branch} ` : "";
      const steadyText = result.steady ? " | steady" : ` | drift=${formatSweepDrift(result.steadyDrift)}`;
      const epText =
        state.sweepMode === "gainLoss" && result.epPhase
          ? ` | ${result.epPhase} EPd=${formatDiagnosticRatio(result.epDistance || 0)}`
          : "";
      if (auxMetric) {
        if (auxMetric.only) {
          return `Recorded ${branchText}${pointIndex + 1}/${pointCount}: ${auxMetric.label}=${formatDiagnosticRatio(result[auxMetric.key] || 0)}${epText}${steadyText}`;
        }
        return `Recorded ${branchText}${pointIndex + 1}/${pointCount}: T=${formatDiagnosticRatio(result.t)}, ${auxMetric.label}=${formatDiagnosticRatio(result[auxMetric.key] || 0)}${epText}${steadyText}`;
      }
      return `Recorded ${branchText}${pointIndex + 1}/${pointCount}: R=${formatDiagnosticRatio(result.r)}, T=${formatDiagnosticRatio(result.t)}${steadyText}`;
    }
    
    function fresnelReflectance(angleDeg, n1, n2, polarization) {
      const thetaI = (clamp(Number(angleDeg) || 0, -89.9, 89.9) * Math.PI) / 180;
      const sinI = Math.sin(thetaI);
      const cosI = Math.cos(thetaI);
      const sinT = (n1 / n2) * sinI;
      if (Math.abs(sinT) >= 1) return 1;
      const cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
      const numerator =
        polarization === "tm"
          ? n2 * cosI - n1 * cosT
          : n1 * cosI - n2 * cosT;
      const denominator =
        polarization === "tm"
          ? n2 * cosI + n1 * cosT
          : n1 * cosI + n2 * cosT;
      if (Math.abs(denominator) < 1e-12) return 1;
      const r = numerator / denominator;
      return clamp(r * r, 0, 1);
    }
    
    function sweepChartEmptyMessage(dualPolarization = dualPolarizationSweepEnabled(), auxMetric = sweepAuxMetric()) {
      if (dualPolarization) return "Run a sweep to plot TE/TM reflectance";
      if (!auxMetric) return "Run a sweep to plot R and T";
      if (auxMetric.only) return `Run ${state.sweepMode} sweep to plot ${auxMetric.label}`;
      return bidirectionalSweepActive()
        ? `Run bidirectional amplitude sweep to plot T and ${auxMetric.label}`
        : `Run amplitude sweep to plot T and ${auxMetric.label}`;
    }
    
    function sweepChartLatestReadout(results = state.sweepResults || []) {
      return results.length > 0
        ? `${results.length} sweep points | ${sweepModeLabel()} ${formatSweepValue(results[results.length - 1].x)}`
        : "No sweep point";
    }
    
    function drawSweepChart() {
      const results = state.sweepResults || [];
      const dualPolarization = dualPolarizationSweepEnabled();
      const auxMetric = sweepAuxMetric();
      resultsCharts.drawSweepChart({
        auxMetric,
        dualPolarization,
        emptyMessage: sweepChartEmptyMessage(dualPolarization, auxMetric),
        fresnelReflectance,
        latestReadout: sweepChartLatestReadout(results),
        reference: brewsterSweepReference(),
        results,
        sweepAxisLabel: `${sweepModeLabel()} ${sweepUnitLabel()}`.trim(),
        sweepEnd: state.sweepEnd,
        sweepStart: state.sweepStart,
        theme: state.theme,
        unitLabel: sweepUnitLabel(),
      });
    }
    
    function canvasRelativePoint(canvas, event) {
      return resultsCharts.canvasRelativePoint(canvas, event);
    }
    
    function updateSweepChartReadout(event) {
      if (!el.sweepChartReadout || !el.sweepChart) return;
      el.sweepChartReadout.textContent = resultsCharts.sweepReadoutText({
        canvas: el.sweepChart,
        event,
        modeLabel: sweepModeLabel(),
        results: state.sweepResults || [],
      });
    }
    
    function chartPalette() {
      return resultsCharts.chartPalette(state.theme);
    }
    
    function prepareChartCanvas(canvas, minWidth = 260, minHeight = 130) {
      return resultsCharts.prepareChartCanvas(canvas, minWidth, minHeight);
    }
    
    function orderedProbeSamples() {
      const count = sim.analysisProbeCount || 0;
      const series = sim.analysisProbeSeries || [];
      const length = series.length || 0;
      if (count <= 0 || length <= 0) return [];
      const start = (sim.analysisProbeIndex - count + length) % length;
      const values = [];
      for (let i = 0; i < count; i += 1) {
        values.push(series[(start + i) % length]);
      }
      return values;
    }
    
    function drawSpectrumChart() {
      resultsCharts.drawSpectrumChart({
        sampleEvery: state.analysisSampleEvery,
        theme: state.theme,
        values: orderedProbeSamples(),
      });
    }
    
    function drawFarFieldChart() {
      const scatteringMode = sim.analysisFarFieldMode === "scattering" || Boolean(sim.analysisScatteringSource());
      resultsCharts.drawFarFieldChart({
        data: sim.analysisFarFieldEstimate(96),
        scatteringMode,
        scatteringTotalText: scatteringMode && sim.analysisScatteringTotal > 0 ? formatFieldValue(sim.analysisScatteringTotal) : "",
        theme: state.theme,
      });
    }
    
    function updateSpectrumReadout(event) {
      resultsCharts.updateSpectrumReadout(event);
    }
    
    function updateFarFieldReadout(event) {
      const scatteringMode = sim.analysisFarFieldMode === "scattering" || Boolean(sim.analysisScatteringSource());
      resultsCharts.updateFarFieldReadout(event, { scatteringMode });
    }
    
    function updateAnalysisControls() {
      if (el.analysisInput) el.analysisInput.checked = state.analysisEnabled;
      drawSpectrumChart();
      drawFarFieldChart();
      if (el.analysisStatus) {
        const sampleText = `${sim.analysisSamples || 0} samples`;
        const contourText = `${sim.analysisContour?.length || 0} contour pts`;
        const scatteringMode = sim.analysisFarFieldMode === "scattering" || Boolean(sim.analysisScatteringSource());
        const forwardBackward =
          sim.analysisScatteringBackward > 1e-24 ? sim.analysisScatteringForward / sim.analysisScatteringBackward : Infinity;
        const scatteringText =
          scatteringMode && sim.analysisScatteringTotal > 0
            ? ` | σ/λ₀=${formatFieldValue(sim.analysisScatteringTotal)} | F/B=${
                Number.isFinite(forwardBackward) ? formatFieldValue(forwardBackward) : "inf"
              }`
            : "";
        const metrics = sim.analysisMetricEstimate();
        let resonatorText = "";
        if (metrics && resonatorAnalysisPresets.has(state.preset)) {
          if (metrics.ringdown?.q) resonatorText += ` | Q~${formatFieldValue(metrics.ringdown.q)}`;
          if (purcellAnalysisPresets.has(state.preset) && metrics.purcellProxy > 0) {
            resonatorText += ` | Q/Aeff=${formatFieldValue(metrics.purcellProxy)}`;
          }
          if (betaAnalysisPresets.has(state.preset) && metrics.beta > 0) {
            resonatorText += ` | beta~${formatDiagnosticRatio(metrics.beta)}`;
          }
          if (degenerateAnalysisPresets.has(state.preset) && metrics.split > 0) {
            resonatorText += ` | df=${formatFieldValue(metrics.split)}`;
          }
          if (ptModalAnalysisPresets.has(state.preset) && metrics.ptModal) {
            resonatorText += ` | g/k=${formatDiagnosticRatio(metrics.ptModal.normalizedGamma)} | ${metrics.ptModal.phase}`;
            resonatorText += ` | EPd=${formatDiagnosticRatio(metrics.ptModal.epDistance)}`;
          }
          if (leakageAnalysisPresets.has(state.preset) && metrics.leakageRate > 0) {
            resonatorText += ` | leak~${formatFieldValue(metrics.leakageRate)}`;
          }
        }
        let topologicalText = "";
        if (metrics?.sshBloch) {
          topologicalText += ` | W=${metrics.sshBloch.winding} | gap=${formatFieldValue(metrics.sshBloch.bandGap)}`;
          if (metrics.sshBloch.edgeExpected) topologicalText += " | edge";
          if (state.preset === "nonHermitianSsh") topologicalText += ` | nh-gap=${formatFieldValue(metrics.sshBloch.nonHermitianGap)}`;
        }
        if (metrics?.phcBloch) {
          topologicalText += ` | BZ leak=${formatFieldValue(metrics.phcBloch.leakage)} | SF=${formatDiagnosticRatio(metrics.phcBloch.structureFactor)}`;
          if (metrics.phcBloch.modal) {
            topologicalText += ` | PWE b${metrics.phcBloch.modal.basisSize} f1=${formatFieldValue(metrics.phcBloch.modal.fundamentalFrequency)}`;
            if (metrics.phcBloch.modal.bandGap > 0) topologicalText += ` | gap=${formatFieldValue(metrics.phcBloch.modal.bandGap)}`;
            if (metrics.phcBloch.modal.path?.minGap > 0) topologicalText += ` | pathGap=${formatFieldValue(metrics.phcBloch.modal.path.minGap)}`;
          }
          if (leakageAnalysisPresets.has(state.preset)) topologicalText += ` | Qk~${formatFieldValue(metrics.phcBloch.qProxy)}`;
        }
        const coupled = metrics?.coupledWorkflow;
        const coupledText =
          coupled && coupledWorkflowAnalysisPresets.has(state.preset)
            ? state.preset === "nonHermitianSkin"
              ? ` | skin=${formatDiagnosticRatio(coupled.skinEdgeFraction)} | bias=${formatDiagnosticRatio(coupled.skinBias)} | GL=${formatDiagnosticRatio(
                  coupled.gainLossBias,
                )}`
              : state.preset === "bicKerr" || state.preset === "bicEnz"
                ? ` | active=${formatDiagnosticRatio(coupled.activeMaterialFraction)} | cav=${formatDiagnosticRatio(coupled.cavityEnergyFraction)}`
              : state.preset === "huygensCavity"
                ? ` | cav=${formatDiagnosticRatio(coupled.cavityEnergyFraction)} | src=${formatDiagnosticRatio(coupled.sourceOverlapFraction)}`
                : state.preset === "janusTopologicalGuide"
                  ? ` | guide=${formatDiagnosticRatio(coupled.guideEnergyFraction)} | mat=${formatDiagnosticRatio(coupled.materialEnergyFraction)}`
                  : ` | guide=${formatDiagnosticRatio(coupled.guideEnergyFraction)} | Cw=${formatDiagnosticRatio(
                      coupled.modulationPhase?.spatialCoherence || 0,
                    )}`
            : "";
        const absorptionText =
          absorptionAnalysisPresets.has(state.preset) && sim.diagnosticSamples > 8
            ? ` | A~${formatDiagnosticRatio(
                clamp(1 - (sim.diagnosticReflectance || 0) - (sim.diagnosticTransmittance || 0), 0, 1),
              )}`
            : "";
        let nonlinearText = "";
        if (metrics && nonlinearAnalysisPresets.has(state.preset)) {
          if (harmonicAnalysisPresets.has(state.preset)) {
            if (metrics.harmonic2 > 1e-4) nonlinearText += ` | H2~${formatDiagnosticRatio(metrics.harmonic2)}`;
            if (metrics.harmonic3 > 1e-4) nonlinearText += ` | H3~${formatDiagnosticRatio(metrics.harmonic3)}`;
          }
          if (metrics.sidebandRatio > 0.05) {
            nonlinearText += ` | side~${formatDiagnosticRatio(metrics.sidebandRatio)}`;
          }
          if (phaseChangeAnalysisPresets.has(state.preset)) {
            nonlinearText += ` | s~${formatDiagnosticRatio(metrics.phaseAverage)}`;
          }
        }
        const floquetPlusOrder = metrics?.floquet?.orders?.find((channel) => channel.order === 1);
        const floquetPhaseCoherence = metrics?.floquet?.modulationPhase?.spatialCoherence || 0;
        const floquetText =
          metrics?.floquet && temporalFloquetAnalysisPresets.has(state.preset)
            ? metrics.floquet.scatteringMatrix
              ? ` | DFT T+1=${formatDiagnosticRatio(metrics.floquet.firstUpper)} | T-1=${formatDiagnosticRatio(
                  metrics.floquet.firstLower,
                )} | R+1=${formatDiagnosticRatio(floquetPlusOrder?.reflectedAmplitudeRatio || 0)} | Pout=${formatDiagnosticRatio(
                  metrics.floquet.scatteringMatrix.totalOutgoingPower,
                )} | dP=${formatDiagnosticRatio(metrics.floquet.scatteringMatrix.powerBalanceAbsResidual)} | m*=${
                  metrics.floquet.maxSidebandOrder
                } | Cphi=${formatDiagnosticRatio(floquetPhaseCoherence)}`
              : ` | probe S+1=${formatDiagnosticRatio(metrics.floquet.firstUpper)} | S-1=${formatDiagnosticRatio(
                  metrics.floquet.firstLower,
                )} | Pside=${formatDiagnosticRatio(metrics.floquet.sidebandPower)} | m*=${
                  metrics.floquet.maxSidebandOrder
                } | Cphi=${formatDiagnosticRatio(floquetPhaseCoherence)}`
            : "";
        const hyperlensText =
          metrics?.hyperlens && state.preset === "hyperlens"
            ? ` | Hout/Hin=${formatDiagnosticRatio(metrics.hyperlens.transfer)} | detail=${formatDiagnosticRatio(
                metrics.hyperlens.detailTransfer,
              )} | MTF=${formatDiagnosticRatio(metrics.hyperlens.mtfMean)} | m50=${formatFieldValue(
                metrics.hyperlens.mtfBandwidthOrder,
              )}`
            : "";
        const negativeIndexText =
          metrics?.negativeIndex && negativeIndexAnalysisPresets.has(state.preset)
            ? state.preset === "superlensSlab"
              ? ` | img=${formatDiagnosticRatio(metrics.negativeIndex.imageTransfer)} | w=${formatFieldValue(
                  metrics.negativeIndex.imageWidthLambda,
                )}lambda`
              : ` | theta_slab=${formatFieldValue(metrics.negativeIndex.slabAngleDeg)}deg | neg=${formatDiagnosticRatio(
                  metrics.negativeIndex.negativeRefractionScore,
                )} | phi=${formatFieldValue(metrics.negativeIndex.slabPhaseAngleDeg)}deg | coh=${formatDiagnosticRatio(
                  metrics.negativeIndex.slabPhaseCoherence,
                )} | resid=${formatDiagnosticRatio(metrics.negativeIndex.powerResidual)}`
            : "";
        const bianisotropyText =
          metrics?.bianisotropy && bianisotropyAnalysisPresets.has(state.preset)
            ? ` | xpol=${formatDiagnosticRatio(metrics.bianisotropy.materialCrossFraction)} | out=${formatDiagnosticRatio(
                metrics.bianisotropy.outputCrossFraction,
              )} | corr=${formatDiagnosticRatio(metrics.bianisotropy.kappaSignedOutputCorrelation)} | pass=${formatDiagnosticRatio(
                metrics.bianisotropy.passivityMargin,
              )}`
            : "";
        el.analysisStatus.textContent = state.analysisEnabled
          ? `${sampleText} · ${contourText} · f=${formatFieldValue(sim.diagnosticFrequency())}`
          : "Analysis paused.";
        if (state.analysisEnabled) {
          el.analysisStatus.textContent = `${sampleText} | ${contourText} | f=${formatFieldValue(
            sim.diagnosticFrequency(),
          )}${scatteringText}${resonatorText}${topologicalText}${coupledText}${absorptionText}${nonlinearText}${floquetText}${hyperlensText}${negativeIndexText}${bianisotropyText}`;
        }
      }
    }
    
    async function runBlochKSweep(scanPoints = buildSweepScanPoints()) {
      if (!blochSweepCompatible()) {
        setSweepStatus("Bloch k sweep is available for photonic-crystal and BIC presets.");
        return;
      }
      const wasRunning = state.running;
      state.running = false;
      state.sweepRunning = true;
      state.sweepCancelRequested = false;
      state.sweepResults = [];
      updateControlText();
      updateStats();
      drawSweepChart();
      let completionMessage = "";
    
      try {
        for (let pointIndex = 0; pointIndex < scanPoints.length; pointIndex += 1) {
          if (state.sweepCancelRequested) break;
          const point = scanPoints[pointIndex];
          const metrics = sim.phcBlochEstimate(point.value);
          if (!metrics) {
            completionMessage = "Bloch k sweep needs high-index photonic-crystal material in the active scene.";
            break;
          }
          const modal = metrics.modal || {};
          const result = {
            x: metrics.k,
            branch: point.branch,
            branchIndex: point.branchIndex,
            r: 0,
            t: 0,
            blochK: metrics.k,
            blochLeakage: metrics.leakage,
            blochQ: metrics.qProxy,
            blochStructureFactor: metrics.structureFactor,
            blochAsymmetry: metrics.asymmetry,
            blochBandFrequency: metrics.bandFrequency,
            blochSecondBandFrequency: modal.secondBandFrequency || 0,
            blochBandGap: modal.bandGap || 0,
            blochGapRatio: modal.gapRatio || 0,
            blochNormalizedFrequency: modal.normalizedFrequency || 0,
            blochPlaneWaveContrast: modal.inverseEpsContrast || 0,
            blochPlaneWaveFill: modal.fillFraction || 0,
            blochPlaneWaveBasis: modal.basisSize || 0,
            blochPlaneWaveShells: modal.basisShells || 0,
            blochPathGap: modal.path?.minGap || 0,
            blochPathGapRatio: modal.path?.minGapRatio || 0,
            blochPathGapLocation: modal.path?.minGapLabel || "",
            blochPathSamples: modal.path?.pointCount || 0,
            blochPathFirstBandMax: modal.path?.firstBandMax || 0,
            blochPathSecondBandMin: modal.path?.secondBandMin || 0,
            blochGroup: metrics.groupProxy,
            blochAverageEps: metrics.averageEps,
            blochCells: metrics.cells,
            steady: true,
            steadyDrift: 0,
            steadyMetric: "bloch",
            steadySamples: 1,
            steadyTolerance: 0,
          };
          state.sweepResults.push(result);
          drawSweepChart();
          setSweepStatus(
            `Recorded ${pointIndex + 1}/${scanPoints.length}: rad=${formatDiagnosticRatio(result.blochLeakage)}, Qk=${formatFieldValue(
              result.blochQ,
            )}, f1=${formatFieldValue(result.blochBandFrequency)}, pathGap=${formatFieldValue(result.blochPathGap)}`,
          );
          await nextAnimationFrame();
        }
      } finally {
        const cancelled = state.sweepCancelRequested;
        const pointLabel = state.sweepResults.length === 1 ? "point" : "points";
        state.running = wasRunning && !cancelled;
        state.sweepRunning = false;
        state.sweepCancelRequested = false;
        updateControlText();
        updateStats();
        sim.render();
        drawSweepChart();
        setSweepStatus(
          completionMessage ||
            (cancelled
              ? `Bloch k sweep cancelled. ${state.sweepResults.length} ${pointLabel} recorded.`
              : `Bloch k sweep complete. ${state.sweepResults.length} ${pointLabel} recorded.`),
        );
      }
    }
    
    async function runSweep() {
      if (state.sweepRunning) {
        state.sweepCancelRequested = true;
        setSweepStatus("Cancelling sweep...");
        return;
      }
    
      syncSweepStateFromInputs();
      const scanPoints = buildSweepScanPoints();
      if (state.sweepMode === "blochK") {
        if (!blochSweepCompatible()) {
          setSweepStatus("Bloch k sweep is available for photonic-crystal and BIC presets.");
          return;
        }
        await runBlochKSweep(scanPoints);
        return;
      }
      if (state.sweepMode === "gainLoss" && !gainLossSweepCompatible()) {
        setSweepStatus("Gain/loss sweep is available for PT and exceptional-point presets.");
        return;
      }
      if (state.sweepMode === "symmetry" && !symmetrySweepCompatible()) {
        setSweepStatus("Symmetry sweep is available for BIC and quasi-BIC photonic-crystal presets.");
        return;
      }
      if (state.sweepMode === "direction" && !directionSweepCompatible()) {
        setSweepStatus("Direction sweep is available for traveling-modulation and nonreciprocal presets.");
        return;
      }
      const target = sweepSourceTarget();
      if (!target) {
        setSweepStatus("Add a source before running a sweep.");
        return;
      }
    
      const sourceSnapshots = state.sources.map((source) => ({ ...source }));
      const lossSweepSnapshot = state.sweepMode === "gainLoss" ? gainLossSweepSnapshot() : null;
      const symmetryMaterialSnapshot = state.sweepMode === "symmetry" ? symmetrySweepSnapshot() : null;
      const selectedSourceId = state.selectedSourceId;
      const sourceDefaults = { ...state.sourceDefaults };
      const diagnosticsEnabled = state.diagnosticsEnabled;
      const fieldComponentSnapshot = state.fieldComponent;
      const wasRunning = state.running;
      const dualPolarization = dualPolarizationSweepEnabled();
      const memorySweep = bidirectionalSweepActive();
    
      state.running = false;
      state.diagnosticsEnabled = true;
      state.sweepRunning = true;
      state.sweepCancelRequested = false;
      state.sweepResults = [];
      updateControlText();
      updateStats();
      sim.render();
    
      try {
        const runSingleSweepSimulation = async (
          value,
          pointIndex,
          component = state.fieldComponent,
          label = "",
          preserveFields = false,
        ) => {
          state.fieldComponent = component === "hz" ? "hz" : "ez";
          const activeTarget = sweepSourceTarget();
          if (!activeTarget) return null;
    
          if (state.sweepMode === "frequency") {
            const frequency = clampSweepRangeForMode("frequency", value);
            state.sources.forEach((source) => {
              source.type = "sine";
              source.frequency = frequency;
              normalizeSource(source);
            });
          } else if (state.sweepMode === "amplitude") {
            activeTarget.amplitude = clampSweepRangeForMode("amplitude", value);
            normalizeSource(activeTarget);
          } else if (state.sweepMode === "gainLoss") {
            applyGainLossSweepValue(lossSweepSnapshot, value);
          } else if (state.sweepMode === "symmetry") {
            applySymmetrySweepValue(symmetryMaterialSnapshot, value);
          } else if (state.sweepMode === "direction") {
            applyDirectionSweepValue(activeTarget, value);
          } else {
            activeTarget.type = "sine";
            activeTarget.angleDeg = ((clampSweepRangeForMode("angle", value) % 360) + 360) % 360;
            normalizeSource(activeTarget);
          }
          state.sourceDefaults = { ...activeTarget };
          delete state.sourceDefaults.id;
    
          if (!preserveFields) sim.resetFields();
          sim.resetDiagnostics();
          if (state.sweepMode === "gainLoss") {
            applyGainLossSweepValue(lossSweepSnapshot, value);
          } else if (state.sweepMode === "symmetry") {
            applySymmetrySweepValue(symmetryMaterialSnapshot, value);
          }
          const labelText = label ? ` ${label}` : "";
          setSweepStatus(
            `Point ${pointIndex + 1}/${scanPoints.length}${labelText}: ${sweepModeLabel()}=${formatSweepValue(value)}${sweepUnitLabel()}`,
          );
          updateControlText();
    
          let stepsDone = 0;
          const steadyHistory = [];
          while (stepsDone < state.sweepSteps) {
            if (state.sweepCancelRequested) break;
            const chunk = Math.min(36, state.sweepSteps - stepsDone);
            timeStepBatch(chunk, () => {
              for (let step = 0; step < chunk; step += 1) {
                sim.step();
              }
            });
            stepsDone += chunk;
            sim.measure();
            const steadyMetrics = state.analysisEnabled ? sim.analysisMetricEstimate() : null;
            steadyHistory.push(sweepSteadyObservation(steadyMetrics));
            updateStats();
            if (stepsDone % 144 === 0 || stepsDone >= state.sweepSteps) {
              sim.render();
              await nextAnimationFrame();
            }
          }
    
          if (state.sweepCancelRequested) return null;
          sim.measure();
          const metrics = sim.analysisMetricEstimate();
          const steadyEstimate = sweepSteadyEstimate(steadyHistory);
          const floquetOrders = metrics?.floquet?.orders || [];
          const floquetOrder = (order) => floquetOrders.find((channel) => channel.order === order);
          const floquetMatrix = metrics?.floquet?.scatteringMatrix || null;
          return {
            r: sim.diagnosticReflectance || 0,
            t: sim.diagnosticTransmittance || 0,
            pInc: sim.diagnosticIncidentPower || 0,
            pRef: sim.diagnosticReflectedPower || 0,
            pTrn: sim.diagnosticTransmittedPower || 0,
            h2: metrics?.harmonic2 || 0,
            h3: metrics?.harmonic3 || 0,
            sideband: metrics?.sidebandRatio || 0,
            floquetCarrier: metrics?.floquet?.carrierFrequency || 0,
            floquetOmega: metrics?.floquet?.modulationFrequency || 0,
            floquetSMinus2: floquetOrder(-2)?.amplitudeRatio || 0,
            floquetSMinus1: metrics?.floquet?.firstLower || 0,
            floquetS0: floquetOrder(0)?.amplitudeRatio || 0,
            floquetSPlus1: metrics?.floquet?.firstUpper || 0,
            floquetSPlus2: floquetOrder(2)?.amplitudeRatio || 0,
            floquetRMinus2: floquetOrder(-2)?.reflectedAmplitudeRatio || 0,
            floquetRMinus1: floquetOrder(-1)?.reflectedAmplitudeRatio || 0,
            floquetR0: floquetOrder(0)?.reflectedAmplitudeRatio || 0,
            floquetRPlus1: floquetOrder(1)?.reflectedAmplitudeRatio || 0,
            floquetRPlus2: floquetOrder(2)?.reflectedAmplitudeRatio || 0,
            floquetTPhasePlus1: floquetOrder(1)?.transmittedPhaseRad || 0,
            floquetRPhasePlus1: floquetOrder(1)?.reflectedPhaseRad || 0,
            floquetPowerTotal: floquetMatrix?.totalOutgoingPower || 0,
            floquetPowerTransmitted: floquetMatrix?.totalTransmittedPower || 0,
            floquetPowerReflected: floquetMatrix?.totalReflectedPower || 0,
            floquetPowerResidual: floquetMatrix?.powerBalanceResidual || 0,
            floquetPowerAbsResidual: floquetMatrix?.powerBalanceAbsResidual || 0,
            floquetPowerSideband: metrics?.floquet?.sidebandPower || 0,
            floquetPowerReflectedSideband: metrics?.floquet?.reflectedSidebandPower || 0,
            floquetPowerUp: metrics?.floquet?.upPower || 0,
            floquetPowerDown: metrics?.floquet?.downPower || 0,
            floquetMaxSideband: metrics?.floquet?.maxSidebandRatio || 0,
            floquetMaxOrder: metrics?.floquet?.maxSidebandOrder || 0,
            floquetModulationPhaseCoherence: metrics?.floquet?.modulationPhase?.spatialCoherence || 0,
            floquetModulationPhaseVelocity: metrics?.floquet?.modulationPhase?.phaseVelocityLambdaPerStep || 0,
            floquetMethod: metrics?.floquet?.portDft ? "port-dft" : metrics?.floquet ? "probe-dft" : "",
            hyperlensTransfer: metrics?.hyperlens?.transfer || 0,
            hyperlensDetailTransfer: metrics?.hyperlens?.detailTransfer || 0,
            hyperlensMtfMean: metrics?.hyperlens?.mtfMean || 0,
            hyperlensMtfPeakTransfer: metrics?.hyperlens?.mtfPeakTransfer || 0,
            hyperlensMtfHighOrderMean: metrics?.hyperlens?.mtfHighOrderMean || 0,
            hyperlensMtfBandwidthOrder: metrics?.hyperlens?.mtfBandwidthOrder || 0,
            hyperlensMtfLowOrderTransfer: metrics?.hyperlens?.mtfLowOrderTransfer || 0,
            hyperlensInnerEnergy: metrics?.hyperlens?.innerEnergy || 0,
            hyperlensOuterEnergy: metrics?.hyperlens?.outerEnergy || 0,
            negativeSourceAngleDeg: metrics?.negativeIndex?.sourceAngleDeg || 0,
            negativeIncidentAngleDeg: metrics?.negativeIndex?.incidentAngleDeg || 0,
            negativeSlabAngleDeg: metrics?.negativeIndex?.slabAngleDeg || 0,
            negativeTransmittedAngleDeg: metrics?.negativeIndex?.transmittedAngleDeg || 0,
            negativeIncidentPhaseAngleDeg: metrics?.negativeIndex?.incidentPhaseAngleDeg || 0,
            negativeSlabPhaseAngleDeg: metrics?.negativeIndex?.slabPhaseAngleDeg || 0,
            negativeTransmittedPhaseAngleDeg: metrics?.negativeIndex?.transmittedPhaseAngleDeg || 0,
            negativeSlabPhaseFrontAngleDeg: metrics?.negativeIndex?.slabPhaseFrontAngleDeg || 0,
            negativeSlabPhaseCoherence: metrics?.negativeIndex?.slabPhaseCoherence || 0,
            negativeRefractionScore: metrics?.negativeIndex?.negativeRefractionScore || 0,
            negativePowerResidual: metrics?.negativeIndex?.powerResidual || 0,
            negativeNEff: metrics?.negativeIndex?.material?.nEff || 0,
            negativeEpsEff: metrics?.negativeIndex?.material?.epsEff || 0,
            negativeMuEff: metrics?.negativeIndex?.material?.muEff || 0,
            superlensImageTransfer: metrics?.negativeIndex?.imageTransfer || 0,
            superlensImageEnergyTransfer: metrics?.negativeIndex?.imageEnergyTransfer || 0,
            superlensObjectWidthLambda: metrics?.negativeIndex?.objectWidthLambda || 0,
            superlensImageWidthLambda: metrics?.negativeIndex?.imageWidthLambda || 0,
            superlensResolutionRatio: metrics?.negativeIndex?.resolutionRatio || 0,
            bianisotropyKappaMean: metrics?.bianisotropy?.meanKappa || 0,
            bianisotropyKappaMax: metrics?.bianisotropy?.maxKappa || 0,
            bianisotropyPassivityMargin: metrics?.bianisotropy?.passivityMargin || 0,
            bianisotropyPrimaryEnergy: metrics?.bianisotropy?.material?.primaryEnergy || 0,
            bianisotropyCrossEnergy: metrics?.bianisotropy?.material?.crossEnergy || 0,
            bianisotropyCrossEnergyRatio: metrics?.bianisotropy?.materialConversionRatio || 0,
            bianisotropyMaterialCrossFraction: metrics?.bianisotropy?.materialCrossFraction || 0,
            bianisotropyInputCrossFraction: metrics?.bianisotropy?.inputCrossFraction || 0,
            bianisotropyOutputCrossFraction: metrics?.bianisotropy?.outputCrossFraction || 0,
            bianisotropyGeneratedCrossFraction: metrics?.bianisotropy?.generatedCrossFraction || 0,
            bianisotropyOutputConversionRatio: metrics?.bianisotropy?.outputConversionRatio || 0,
            bianisotropyInputCrossCorrelation: metrics?.bianisotropy?.inputCrossCorrelation || 0,
            bianisotropyOutputCrossCorrelation: metrics?.bianisotropy?.outputCrossCorrelation || 0,
            bianisotropyGeneratedCrossCorrelation: metrics?.bianisotropy?.generatedCrossCorrelation || 0,
            bianisotropyKappaSignedOutputCorrelation: metrics?.bianisotropy?.kappaSignedOutputCorrelation || 0,
            bianisotropyPowerResidual: metrics?.bianisotropy?.powerResidual || 0,
            bianisotropyPassiveFlag: metrics?.bianisotropy?.passiveDefinite ? 1 : 0,
            coupledCentroidX: metrics?.coupledWorkflow?.centroidXNorm || 0,
            coupledCentroidY: metrics?.coupledWorkflow?.centroidYNorm || 0,
            coupledSkinEdgeFraction: metrics?.coupledWorkflow?.skinEdgeFraction || 0,
            coupledSkinBias: metrics?.coupledWorkflow?.skinBias || 0,
            coupledGainLossBias: metrics?.coupledWorkflow?.gainLossBias || 0,
            coupledGuideEnergyFraction: metrics?.coupledWorkflow?.guideEnergyFraction || 0,
            coupledCavityEnergyFraction: metrics?.coupledWorkflow?.cavityEnergyFraction || 0,
            coupledMaterialEnergyFraction: metrics?.coupledWorkflow?.materialEnergyFraction || 0,
            coupledHighIndexEnergyFraction: metrics?.coupledWorkflow?.highIndexEnergyFraction || 0,
            coupledActiveMaterialFraction: metrics?.coupledWorkflow?.activeMaterialFraction || 0,
            coupledSourceOverlapFraction: metrics?.coupledWorkflow?.sourceOverlapFraction || 0,
            coupledPhaseCoherence: metrics?.coupledWorkflow?.modulationPhase?.spatialCoherence || 0,
            phaseState: metrics?.phaseAverage || 0,
            split: metrics?.split || 0,
            spectralSplit: metrics?.spectralSplit || 0,
            ptGamma: metrics?.ptModal?.gamma || 0,
            ptCoupling: metrics?.ptModal?.coupling || 0,
            ptGammaOverKappa: metrics?.ptModal?.normalizedGamma || 0,
            epDistance: metrics?.ptModal?.epDistance || 0,
            epCoalescence: metrics?.ptModal?.coalescence || 0,
            modalSplitReal: metrics?.ptModal?.realSplit || 0,
            modalSplitImag: metrics?.ptModal?.imagSplit || 0,
            epPhase: metrics?.ptModal?.phase || "",
            sshWinding: metrics?.sshBloch?.winding ?? 0,
            sshBandGap: metrics?.sshBloch?.bandGap || 0,
            sshNonHermitianGap: metrics?.sshBloch?.nonHermitianGap || 0,
            sshEdgeExpected: metrics?.sshBloch?.edgeExpected ? 1 : 0,
            leakage: metrics?.leakageRate || 0,
            q: metrics?.ringdown?.q || 0,
            steady: steadyEstimate.steady,
            steadyDrift: steadyEstimate.drift,
            steadyMetric: steadyEstimate.key,
            steadySamples: steadyEstimate.samples,
            steadyTolerance: steadyEstimate.tolerance,
          };
        };
    
        for (let pointIndex = 0; pointIndex < scanPoints.length; pointIndex += 1) {
          if (state.sweepCancelRequested) break;
          const point = scanPoints[pointIndex];
          const value = point.value;
          const preserveFields = memorySweep && pointIndex > 0;
    
          if (dualPolarization) {
            const tm = await runSingleSweepSimulation(value, pointIndex, "hz", "TM");
            if (state.sweepCancelRequested || !tm) break;
            const te = await runSingleSweepSimulation(value, pointIndex, "ez", "TE");
            if (state.sweepCancelRequested || !te) break;
            const result = {
              x: value,
              branch: point.branch,
              r: tm.r,
              t: tm.t,
              rTm: tm.r,
              tTm: tm.t,
              rTe: te.r,
              tTe: te.t,
              pIncTm: tm.pInc,
              pRefTm: tm.pRef,
              pTrnTm: tm.pTrn,
              pIncTe: te.pInc,
              pRefTe: te.pRef,
              pTrnTe: te.pTrn,
              steady: Boolean(tm.steady && te.steady),
              steadyDrift: Math.max(tm.steadyDrift || 0, te.steadyDrift || 0),
              steadyMetric: (tm.steadyDrift || 0) >= (te.steadyDrift || 0) ? `TM:${tm.steadyMetric}` : `TE:${te.steadyMetric}`,
              steadySamples: Math.min(tm.steadySamples || 0, te.steadySamples || 0),
              steadyTolerance: Math.max(tm.steadyTolerance || 0, te.steadyTolerance || 0),
            };
            state.sweepResults.push(result);
            drawSweepChart();
            setSweepStatus(
              `Recorded ${pointIndex + 1}/${scanPoints.length}: R_TM=${formatDiagnosticRatio(result.rTm)}, R_TE=${formatDiagnosticRatio(result.rTe)}${
                result.steady ? " | steady" : ` | drift=${formatSweepDrift(result.steadyDrift)}`
              }`,
            );
            await nextAnimationFrame();
            continue;
          }
    
          const single = await runSingleSweepSimulation(value, pointIndex, state.fieldComponent, point.branch, preserveFields);
          if (state.sweepCancelRequested || !single) break;
          const result = {
            x: value,
            branch: point.branch,
            branchIndex: point.branchIndex,
            direction: state.sweepMode === "direction" ? point.branch : "",
            ...single,
          };
          state.sweepResults.push(result);
          drawSweepChart();
          setSweepStatus(sweepResultStatusText(result, pointIndex, scanPoints.length));
          await nextAnimationFrame();
        }
      } finally {
        const cancelled = state.sweepCancelRequested;
        const pointLabel = state.sweepResults.length === 1 ? "point" : "points";
        restoreGainLossSweepSnapshot(lossSweepSnapshot);
        restoreSymmetrySweepSnapshot(symmetryMaterialSnapshot);
        state.sources = sourceSnapshots.map((source) => ({ ...source }));
        state.selectedSourceId = selectedSourceId;
        state.sourceDefaults = { ...sourceDefaults };
        state.diagnosticsEnabled = diagnosticsEnabled;
        state.fieldComponent = fieldComponentSnapshot;
        state.running = wasRunning && !cancelled;
        state.sweepRunning = false;
        state.sweepCancelRequested = false;
        sim.resetFields();
        sim.resetDiagnostics();
        sim.measure();
        updateControlText();
        updateStats();
        sim.render();
        drawSweepChart();
        const isolation = directionSweepIsolationEstimate();
        if (isolation) {
          state.sweepResults.forEach((result) => {
            result.tForward = isolation.tForward;
            result.tReverse = isolation.tReverse;
            result.isolationDb = isolation.isolationDb;
          });
        }
        const driftingCount = state.sweepResults.filter((result) => result.steady === false).length;
        const driftText =
          driftingCount > 0
            ? ` ${driftingCount} ${driftingCount === 1 ? "point is" : "points are"} still drifting; increase steps / point.`
            : state.sweepResults.length > 0
              ? ` All points steady within ${formatSweepDrift(SWEEP_STEADY_TOLERANCE)}.`
              : "";
        const isolationText = isolation
          ? ` Isolation ${formatIsolationDb(isolation.isolationDb)} (Tf=${formatDiagnosticRatio(isolation.tForward)}, Tr=${formatDiagnosticRatio(
              isolation.tReverse,
            )}).`
          : "";
        setSweepStatus(
          cancelled
            ? `Sweep cancelled. ${state.sweepResults.length} ${pointLabel} recorded.${driftText}${isolationText}`
            : `Sweep complete. ${state.sweepResults.length} ${pointLabel} recorded.${driftText}${isolationText}`,
        );
      }
    }

    function csvCell(value) {
      if (value == null) return "";
      if (typeof value === "number") return Number.isFinite(value) ? value.toPrecision(10) : "";
      const text = String(value);
      return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    }

    function exportSweepCsv() {
      const results = state.sweepResults || [];
      if (results.length === 0) {
        setSweepStatus("Run a sweep before exporting CSV data.");
        return;
      }
      const optionalColumns = [
        "r",
        "t",
        "pInc",
        "pRef",
        "pTrn",
        "rTm",
        "tTm",
        "rTe",
        "tTe",
        "pIncTm",
        "pRefTm",
        "pTrnTm",
        "pIncTe",
        "pRefTe",
        "pTrnTe",
        "h2",
        "h3",
        "sideband",
        "floquetCarrier",
        "floquetOmega",
        "floquetSMinus2",
        "floquetSMinus1",
        "floquetS0",
        "floquetSPlus1",
        "floquetSPlus2",
        "floquetRMinus2",
        "floquetRMinus1",
        "floquetR0",
        "floquetRPlus1",
        "floquetRPlus2",
        "floquetTPhasePlus1",
        "floquetRPhasePlus1",
        "floquetPowerTotal",
        "floquetPowerTransmitted",
        "floquetPowerReflected",
        "floquetPowerResidual",
        "floquetPowerAbsResidual",
        "floquetPowerSideband",
        "floquetPowerReflectedSideband",
        "floquetPowerUp",
        "floquetPowerDown",
        "floquetMaxSideband",
        "floquetMaxOrder",
        "floquetMethod",
        "hyperlensTransfer",
        "hyperlensDetailTransfer",
        "hyperlensMtfMean",
        "hyperlensMtfPeakTransfer",
        "hyperlensMtfHighOrderMean",
        "hyperlensMtfBandwidthOrder",
        "hyperlensMtfLowOrderTransfer",
        "hyperlensInnerEnergy",
        "hyperlensOuterEnergy",
        "negativeSourceAngleDeg",
        "negativeIncidentAngleDeg",
        "negativeSlabAngleDeg",
        "negativeTransmittedAngleDeg",
        "negativeIncidentPhaseAngleDeg",
        "negativeSlabPhaseAngleDeg",
        "negativeTransmittedPhaseAngleDeg",
        "negativeSlabPhaseFrontAngleDeg",
        "negativeSlabPhaseCoherence",
        "negativeRefractionScore",
        "negativePowerResidual",
        "negativeNEff",
        "negativeEpsEff",
        "negativeMuEff",
        "superlensImageTransfer",
        "superlensImageEnergyTransfer",
        "superlensObjectWidthLambda",
        "superlensImageWidthLambda",
        "superlensResolutionRatio",
        "bianisotropyKappaMean",
        "bianisotropyKappaMax",
        "bianisotropyPassivityMargin",
        "bianisotropyPrimaryEnergy",
        "bianisotropyCrossEnergy",
        "bianisotropyCrossEnergyRatio",
        "bianisotropyMaterialCrossFraction",
        "bianisotropyInputCrossFraction",
        "bianisotropyOutputCrossFraction",
        "bianisotropyGeneratedCrossFraction",
        "bianisotropyOutputConversionRatio",
        "bianisotropyInputCrossCorrelation",
        "bianisotropyOutputCrossCorrelation",
        "bianisotropyGeneratedCrossCorrelation",
        "bianisotropyKappaSignedOutputCorrelation",
        "bianisotropyPowerResidual",
        "bianisotropyPassiveFlag",
        "phaseState",
        "split",
        "spectralSplit",
        "ptGamma",
        "ptCoupling",
        "ptGammaOverKappa",
        "epDistance",
        "epCoalescence",
        "modalSplitReal",
        "modalSplitImag",
        "sshWinding",
        "sshBandGap",
        "sshNonHermitianGap",
        "sshEdgeExpected",
        "blochK",
        "blochLeakage",
        "blochQ",
        "blochStructureFactor",
        "blochAsymmetry",
        "blochBandFrequency",
        "blochSecondBandFrequency",
        "blochBandGap",
        "blochGapRatio",
        "blochNormalizedFrequency",
        "blochPlaneWaveContrast",
        "blochPlaneWaveFill",
        "blochPlaneWaveBasis",
        "blochPlaneWaveShells",
        "blochPathGap",
        "blochPathGapRatio",
        "blochPathGapLocation",
        "blochPathSamples",
        "blochPathFirstBandMax",
        "blochPathSecondBandMin",
        "blochGroup",
        "blochAverageEps",
        "blochCells",
        "leakage",
        "q",
        "tForward",
        "tReverse",
        "isolationDb",
      ];
      const columns = [
        "index",
        "preset",
        "sweepMode",
        "branch",
        "direction",
        "epPhase",
        "branchIndex",
        "x",
        "steady",
        "steadyDrift",
        "steadyMetric",
        "steadySamples",
        "steadyTolerance",
        ...optionalColumns.filter((key) =>
          results.some((row) => Number.isFinite(row[key]) || (typeof row[key] === "string" && row[key].length > 0)),
        ),
      ];
      const lines = [
        columns.join(","),
        ...results.map((row, index) =>
          columns
            .map((column) => {
              if (column === "index") return csvCell(index);
              if (column === "preset") return csvCell(state.preset);
              if (column === "sweepMode") return csvCell(state.sweepMode);
              return csvCell(row[column]);
            })
            .join(","),
        ),
      ];
      const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fdtd-sweep-${safeFilePart(state.preset)}-${safeFilePart(state.sweepMode)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSweepStatus(`Exported ${results.length} sweep rows to CSV.`);
    }

    return Object.freeze({
      clampSweepRangeForMode,
      drawFarFieldChart,
      drawSpectrumChart,
      drawSweepChart,
      exportSweepCsv,
      formatSweepValue,
      normalizeSweepMode,
      runSweep,
      setSweepStatus,
      sweepModeLabel,
      sweepReadyStatusText,
      sweepUnitLabel,
      syncSweepStateFromInputs,
      updateAnalysisControls,
      updateFarFieldReadout,
      updateSpectrumReadout,
      updateSweepChartReadout,
      updateSweepControls,
    });
  }

  global.FdtdSweepAnalysis = Object.freeze({
    createSweepAnalysisController,
  });
})(window);
