(function initFdtdMaterialStability(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error("Material stability dependency must provide " + name + "().");
    }
    return value;
  }

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error("Material stability dependency must provide " + name + ".");
    }
    return value;
  }

  const VACUUM_2D_CFL_LIMIT = 1 / Math.sqrt(2);

  function createMaterialStabilityController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const el = requireObject(dependencies.el, "el");
    const sim = requireObject(dependencies.sim, "sim");
    const COURANT = Number(dependencies.COURANT);
    const BIANISOTROPY_KAPPA_LIMIT = Number(dependencies.BIANISOTROPY_KAPPA_LIMIT);
    if (!Number.isFinite(COURANT)) throw new Error("Material stability dependency must provide finite COURANT.");
    if (!Number.isFinite(BIANISOTROPY_KAPPA_LIMIT)) throw new Error("Material stability dependency must provide finite BIANISOTROPY_KAPPA_LIMIT.");

    const normalizeDispersionModel = requireFunction(dependencies.normalizeDispersionModel, "normalizeDispersionModel");
    const formatDiagnosticRatio = requireFunction(dependencies.formatDiagnosticRatio, "formatDiagnosticRatio");
    const formatFieldValue = requireFunction(dependencies.formatFieldValue, "formatFieldValue");

    function formatScaleValue(value) {
      if (!Number.isFinite(value)) return "overflow";
      if (Math.abs(value) >= 1000 || Math.abs(value) < 0.01) return value.toExponential(2);
      return value.toFixed(2);
    }
    
    function formatScaleFromLog(logValue) {
      if (!Number.isFinite(logValue)) return "overflow";
      if (Math.abs(logValue) < 3) return formatScaleValue(Math.pow(10, logValue));
      return `1e${logValue >= 0 ? "+" : ""}${logValue.toFixed(0)}`;
    }
    
    function updateMaterialWarning() {
      const notes = [];
      if (Math.abs(state.customEpsReal) < 0.5) {
        notes.push("Near-zero ε′ can create very large fields; auto-normalization is active.");
      }
      if (state.customEpsImag < 0) {
        notes.push(
          state.materialSaturableGainEnabled
            ? "Negative electric loss ℓε adds gain; saturation limits growth at high intensity."
            : "Negative electric loss ℓε adds gain and may keep growing."
        );
      }
      if (state.customAnisotropic && Math.abs(state.customEpsYReal) < 0.5) {
        notes.push("Near-zero εy′ can create very large fields; auto-normalization is active.");
      }
      if (state.customAnisotropic && state.customEpsYImag < 0) {
        notes.push(
          state.materialSaturableGainEnabled
            ? "Negative εy″ adds gain; saturable gain limits growth at high intensity."
            : "Negative εy″ adds gain and may keep growing."
        );
      }
      if (Math.abs(state.customMuReal) < 0.5) {
        notes.push("Near-zero μ′ can create very large magnetic fields; auto-normalization is active.");
      }
      if (state.customMuImag < 0) {
        notes.push("Negative magnetic loss ℓμ adds gain and may keep growing.");
      }
      if (state.customAnisotropic && Math.abs(state.customMuYReal) < 0.5) {
        notes.push("Near-zero μy′ can create very large magnetic fields; auto-normalization is active.");
      }
      if (state.customAnisotropic && state.customMuYImag < 0) {
        notes.push("Negative μy″ adds magnetic gain and may keep growing.");
      }
      if (state.materialModulationEnabled && state.modulationDepth > 0) {
        notes.push("Space-time \u03b5\u2032 modulation is active; it can exchange energy with the field.");
      }
      if (state.materialNonlinearEnabled && state.kerrChi3 !== 0) {
        notes.push("Kerr \u03c7\u00b3 nonlinearity is active; strong fields change \u03b5\u2032 and may generate harmonics.");
      }
      if (state.materialHarmonicEnabled && (state.harmonicChi2 !== 0 || state.harmonicChi3 !== 0)) {
        const harmonicTargets = [
          state.harmonicChi2 !== 0 ? "2f" : null,
          state.harmonicChi3 !== 0 ? "3f" : null,
        ]
          .filter(Boolean)
          .join(" and ");
        notes.push(`Harmonic nonlinear polarization is active; the spectrum can show ${harmonicTargets} components.`);
      }
      if (state.materialPhaseChangeEnabled) {
        notes.push("Phase-change memory is active; epsilon follows a persistent state variable s.");
      }
      if (state.materialGyrotropyEnabled) {
        notes.push("Gyrotropic epsilon tensor is active in Hz mode: eps_xy = +g and eps_yx = -g.");
        if (state.fieldComponent !== "hz") {
          notes.push("Switch to Hz to apply the gyrotropic tensor update.");
        }
      }
      if (state.materialBianisotropyEnabled) {
        if (sim.fullVectorBianisotropyActive?.()) {
          const fullVector = sim.fullVectorBianisotropyDiagnostics?.();
          const ratioText = fullVector ? ` Cross-polarized energy ratio ~${formatDiagnosticRatio(fullVector.crossEnergyRatio)}.` : "";
          notes.push(`Six-component 2D bianisotropic FDTD is active; Ez/Hx/Hy and Hz/Ex/Ey are evolved and locally coupled by kappa_n.${ratioText}`);
        } else {
          notes.push("Passivity-limited reduced 2D magnetoelectric coupling is active; kappa_n locally mixes electric and magnetic field increments.");
        }
      }
      if (state.materialConductivityEnabled && (state.conductivitySigma > 0 || state.conductivitySigmaY > 0)) {
        notes.push("Finite normalized conductivity \u03c3 is active; the solver adds J = \u03c3E conduction loss.");
      }
      if (state.materialSaturableGainEnabled) {
        notes.push("Saturable gain is active; negative electric loss is intensity-limited.");
      }
      if (state.materialDispersionEnabled) {
        const model = normalizeDispersionModel(state.dispersionModel);
        const modelLabel = model === "none" ? "dispersive" : model;
        notes.push(`${modelLabel} ADE material is active; the response depends on frequency and field history.`);
        if (state.preset === "hyperlens") {
          notes.push("Hyperlens uses radial/tangential Drude ADE in Hz mode: the tangential in-plane component is dispersive and the radial component remains dielectric.");
        } else if (state.preset === "enzSlab" || state.preset === "enzEmitter" || state.preset === "bicEnz") {
          notes.push("ENZ uses a passive Drude ADE tuned so the real epsilon is near zero at the carrier frequency.");
        } else if (state.preset === "negativeIndexSlab" || state.preset === "superlensSlab") {
          const negativeIndex = sim.negativeIndexDiagnostics?.();
          if (negativeIndex) {
            notes.push(
              `Negative-index ADE: eps_eff~${formatFieldValue(negativeIndex.epsEff)}, mu_eff~${formatFieldValue(
                negativeIndex.muEff,
              )}, n_eff~${formatFieldValue(negativeIndex.nEff)} at the carrier frequency.`,
            );
          }
        }
      }
      if (state.fieldComponent === "hz") {
        const tensorDiagnostics = sim.materialTensorDiagnostics();
        if (tensorDiagnostics.checkedCells > 0) {
          if (tensorDiagnostics.indefiniteCells > 0) {
            notes.push(
              `${tensorDiagnostics.indefiniteCells} cells have indefinite epsilon(omega); keep loss on and verify convergence for hyperbolic-field detail.`,
            );
          }
          if (tensorDiagnostics.nearSingularCells > 0) {
            notes.push(
              `${tensorDiagnostics.nearSingularCells} cells are near-singular or ill-conditioned: min |lambda_epsilon|=${formatFieldValue(
                tensorDiagnostics.minAbsEigenvalue,
              )}, cond~${formatFieldValue(tensorDiagnostics.maxCondition)}.`,
            );
          } else if (tensorDiagnostics.tensorCells > 0 || tensorDiagnostics.dispersiveCells > 0) {
            notes.push(
              `Tensor epsilon check: ${tensorDiagnostics.checkedCells} cells, cond~${formatFieldValue(
                tensorDiagnostics.maxCondition,
              )}.`,
            );
          }
        }
      }
      if (sim.lastDiverged) {
        notes.push("Non-finite field detected; fields were reset.");
      } else if (sim.fieldLog10Scale !== 0) {
        notes.push(`Field scale ${formatScaleFromLog(sim.fieldLog10Scale)}x.`);
      }
      const warningText = notes.join(" ");
      el.materialWarning.textContent = warningText;
      el.materialWarning.hidden = !warningText;
    }
    
    function arrayHasNonzero(values) {
      return Boolean(values?.some?.((value) => value !== 0));
    }
    
    function activeMediaLabels() {
      const labels = [];
      if (state.materialModulationEnabled || arrayHasNonzero(sim.modulatedMaterial)) labels.push("modulated");
      if (state.materialNonlinearEnabled || state.materialHarmonicEnabled || arrayHasNonzero(sim.nonlinearMaterial)) labels.push("nonlinear");
      if (state.materialPhaseChangeEnabled || arrayHasNonzero(sim.phaseChangeMaterial)) labels.push("phase-change");
      if (state.materialDispersionEnabled || arrayHasNonzero(sim.dispersiveMaterial) || arrayHasNonzero(sim.muDispersiveMaterial)) labels.push("ADE");
      if (state.materialGyrotropyEnabled || arrayHasNonzero(sim.gyrotropicMaterial)) labels.push("gyrotropic");
      if (state.materialBianisotropyEnabled || arrayHasNonzero(sim.bianisotropicMaterial)) labels.push("bianisotropic");
      if (state.materialConductivityEnabled || arrayHasNonzero(sim.conductivity) || arrayHasNonzero(sim.conductivityY)) labels.push("conductive");
      if (state.materialSaturableGainEnabled) labels.push("gain-limited");
      return labels.length > 0 ? labels : ["static"];
    }
    
    function materialCflEstimate() {
      let minMaterialProduct = 1;
      let checkedCells = 0;
      let nearZeroProductCells = 0;
      let negativeMaterialCells = 0;
      let nonFiniteMaterialCells = 0;

      for (let i = 0; i < sim.n; i += 1) {
        if (sim.material[i] === 2) continue;
        const epsX = Number(sim.eps[i]);
        const epsY = Number(sim.epsY[i]);
        const muX = Number(sim.mu[i]);
        const muY = Number(sim.muY[i]);
        const values = [epsX, epsY, muX, muY];
        if (values.some((value) => !Number.isFinite(value))) {
          nonFiniteMaterialCells += 1;
          continue;
        }

        checkedCells += 1;
        if (values.some((value) => value < 0)) negativeMaterialCells += 1;

        const products = [epsX * muX, epsX * muY, epsY * muX, epsY * muY];
        const cellMinProduct = products.reduce((minimum, product) => {
          if (!Number.isFinite(product)) return minimum;
          return Math.min(minimum, Math.abs(product));
        }, Infinity);
        if (!Number.isFinite(cellMinProduct)) {
          nonFiniteMaterialCells += 1;
          continue;
        }
        if (cellMinProduct < 1e-6) nearZeroProductCells += 1;
        minMaterialProduct = Math.min(minMaterialProduct, cellMinProduct);
      }

      const minEffectiveIndex = Math.sqrt(Math.max(0, minMaterialProduct));
      const materialLimit = Math.min(VACUUM_2D_CFL_LIMIT, VACUUM_2D_CFL_LIMIT * minEffectiveIndex);
      return {
        checkedCells,
        materialLimit,
        minEffectiveIndex,
        nearZeroProductCells,
        negativeMaterialCells,
        nonFiniteMaterialCells,
        vacuumLimit: VACUUM_2D_CFL_LIMIT,
      };
    }

    function materialStabilityFlags(cflEstimate) {
      const flags = [];
      let minAbsEps = Infinity;
      let minAbsMu = Infinity;
      let negativeLossCells = 0;
      for (let i = 0; i < sim.n; i += 1) {
        if (sim.material[i] === 0 || sim.material[i] === 2) continue;
        minAbsEps = Math.min(minAbsEps, Math.abs(sim.eps[i]), Math.abs(sim.epsY[i]));
        minAbsMu = Math.min(minAbsMu, Math.abs(sim.mu[i]), Math.abs(sim.muY[i]));
        if (sim.loss[i] < 0 || sim.lossY[i] < 0 || sim.muLoss[i] < 0 || sim.muLossY[i] < 0) {
          negativeLossCells += 1;
        }
      }
      if (state.cellsPerWavelength < 10) flags.push("low spatial resolution");
      if (Number.isFinite(minAbsEps) && minAbsEps < 0.2) flags.push("near-zero eps");
      if (Number.isFinite(minAbsMu) && minAbsMu < 0.2) flags.push("near-zero mu");
      if (negativeLossCells > 0 || state.customEpsImag < 0 || state.customMuImag < 0) flags.push("gain or negative loss");
      if (cflEstimate.nonFiniteMaterialCells > 0) flags.push("non-finite material coefficient");
      if (cflEstimate.nearZeroProductCells > 0) flags.push("near-zero epsilon*mu");
      if (cflEstimate.negativeMaterialCells > 0 && !state.materialDispersionEnabled) flags.push("negative epsilon/mu without ADE");
      if (cflEstimate.materialLimit < cflEstimate.vacuumLimit - 1e-6) flags.push("reduced material CFL");
      if (state.materialModulationEnabled && state.modulationDepth > 0.5) flags.push("deep modulation");
      if (state.materialBianisotropyEnabled && Math.abs(state.bianisotropyKappa) > BIANISOTROPY_KAPPA_LIMIT * 0.8) flags.push("strong kappa");
      if (sim.lastDiverged) flags.push("recent non-finite field");
      return flags;
    }
    
    function healthStatusReason(cflStable, flags, cflEstimate) {
      const limit = cflEstimate.materialLimit;
      if (!cflStable) {
        return `CFL S=${COURANT.toFixed(2)} exceeds the material-aware 2D Yee estimate ${limit.toFixed(2)}; min sqrt(|epsilon*mu|)~${formatFieldValue(cflEstimate.minEffectiveIndex)}.`;
      }
      if (sim.lastDiverged) {
        return "Non-finite field was detected and the fields were reset.";
      }
      if (flags.length > 0) {
        return `Check before quantitative use: ${flags.join(", ")}.`;
      }
      return `CFL S=${COURANT.toFixed(2)} is below the material-aware estimate ${limit.toFixed(2)} and no material stability flags are active.`;
    }
    
    function applyHealthState(output, level, reason) {
      if (!output) return;
      output.textContent = level;
      output.title = reason;
      output.dataset.healthLevel = level;
      output.setAttribute("aria-label", `Numerical health: ${level}. ${reason}`);
      output.classList.toggle("is-warning", level === "caution");
      output.classList.toggle("is-danger", level === "unstable");
    }
    
    function updateHealthStatusOutputs(level, reason) {
      applyHealthState(el.configStabilityOutput, level, reason);
      applyHealthState(el.stabilityEstimateValue, level, reason);
    }
    
    function updateStabilitySummary() {
      const cflEstimate = materialCflEstimate();
      const limit = cflEstimate.materialLimit;
      const media = activeMediaLabels();
      const flags = materialStabilityFlags(cflEstimate);
      const cflStable = COURANT < limit;
      const level = !cflStable || sim.lastDiverged ? "unstable" : flags.length > 0 ? "caution" : "stable";
      const healthReason = healthStatusReason(cflStable, flags, cflEstimate);
      updateHealthStatusOutputs(level, healthReason);
      if (el.stabilityCflValue) {
        el.stabilityCflValue.textContent = `S = ${COURANT.toFixed(2)} / ${limit.toFixed(2)}`;
      }
      if (el.stabilityResolutionValue) {
        el.stabilityResolutionValue.textContent = `${state.cellsPerWavelength} cells / λ₀`;
      }
      if (el.stabilityMediaValue) {
        el.stabilityMediaValue.textContent = media.join(", ");
      }
      if (el.stabilityNote) {
        const base = `Explicit 2D Yee check: S must stay below min(1/sqrt(2), n_min/sqrt(2)). Current material estimate=${limit.toFixed(2)}.`;
        el.stabilityNote.textContent =
          flags.length > 0
            ? `${base} Watch: ${flags.join(", ")}. Run convergence checks for publishable results.`
            : `${base} Resolution is ${state.cellsPerWavelength} cells/λ₀; still verify convergence before quantitative claims.`;
        el.stabilityNote.classList.toggle("is-warning", level !== "stable");
      }
    }

    return Object.freeze({
      updateMaterialWarning,
      updateStabilitySummary,
    });
  }

  global.FdtdMaterialStability = Object.freeze({
    createMaterialStabilityController,
  });
})(window);
