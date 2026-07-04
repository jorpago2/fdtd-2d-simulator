(function initFdtdMaterialEditorModel(global) {
  "use strict";

  const DISPERSION_MODELS = Object.freeze(["drude", "plasma", "lorentz", "debye"]);
  const VALID_BRUSH_GEOMETRIES = Object.freeze(["rectangle", "disk", "ellipse", "ring"]);
  const DEFAULT_BIANISOTROPY_KAPPA_LIMIT = 0.85;

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeDispersionModel(model) {
    return DISPERSION_MODELS.includes(model) ? model : "none";
  }

  function normalizeBianisotropyKappa(value, limit = DEFAULT_BIANISOTROPY_KAPPA_LIMIT) {
    const finiteLimit = Math.max(0, Number(limit) || DEFAULT_BIANISOTROPY_KAPPA_LIMIT);
    return clampNumber(Number(value) || 0, -finiteLimit, finiteLimit);
  }

  function brushDispersionParams(state, normalizeModel = normalizeDispersionModel) {
    const model = normalizeModel(state.dispersionModel);
    if (model === "none") return null;
    return {
      dispersion: model,
      dispersionAxes: 3,
      omegaP: state.dispersionOmegaP,
      gamma: state.dispersionGamma,
      omega0: state.dispersionOmega0,
      deltaEps: state.dispersionDeltaEps,
      tau: state.dispersionTau,
    };
  }

  function brushConductivityParams(state) {
    if (!state.materialConductivityEnabled) return { sigma: 0, sigmaY: 0 };
    const sigma = Math.max(0, Number(state.conductivitySigma) || 0);
    return {
      sigma,
      sigmaY: state.customAnisotropic ? Math.max(0, Number(state.conductivitySigmaY) || 0) : sigma,
    };
  }

  function brushPhaseChangeParams(state) {
    if (!state.materialPhaseChangeEnabled) return null;
    return {
      phaseChange: true,
      phaseEpsOn: state.phaseEpsOn,
      phaseLossOn: state.phaseLossOn,
      phaseThresholdOn: state.phaseThresholdOn,
      phaseThresholdOff: state.phaseThresholdOff,
      phaseTauOn: state.phaseTauOn,
      phaseTauOff: state.phaseTauOff,
    };
  }

  function brushGyrotropyValue(state) {
    return state.materialGyrotropyEnabled ? clampNumber(Number(state.gyrotropyG) || 0, -5, 5) : 0;
  }

  function brushBianisotropyValue(state, limit = DEFAULT_BIANISOTROPY_KAPPA_LIMIT) {
    return state.materialBianisotropyEnabled ? normalizeBianisotropyKappa(state.bianisotropyKappa, limit) : 0;
  }

  function normalizeBrushGeometryState(state) {
    if (!VALID_BRUSH_GEOMETRIES.includes(state.brushGeometry)) state.brushGeometry = "rectangle";
    state.geometryWidthLambda = clampNumber(Number(state.geometryWidthLambda) || 1, 0.05, 50);
    state.geometryHeightLambda = clampNumber(Number(state.geometryHeightLambda) || 0.5, 0.05, 50);
    state.geometryRadiusLambda = clampNumber(Number(state.geometryRadiusLambda) || 0.45, 0.05, 25);
    state.geometryInnerRadiusLambda = clampNumber(Number(state.geometryInnerRadiusLambda) || 0.25, 0.01, 25);
    if (state.geometryInnerRadiusLambda >= state.geometryRadiusLambda) {
      state.geometryInnerRadiusLambda = Math.max(0.01, state.geometryRadiusLambda * 0.55);
    }
    return state;
  }

  function geometryUsesWidth(shape) {
    return shape === "rectangle" || shape === "ellipse";
  }

  function geometryUsesHeight(shape) {
    return shape === "rectangle" || shape === "ellipse";
  }

  function geometryUsesRadius(shape) {
    return shape === "disk" || shape === "ring";
  }

  function geometryUsesInnerRadius(shape) {
    return shape === "ring";
  }

  function readCustomMaterialEditorValues(el, normalizeModel = normalizeDispersionModel) {
    return {
      customAnisotropic: Boolean(el.customAnisotropyInput?.checked),
      materialModulationEnabled: Boolean(el.modulationEnabledInput?.checked),
      materialNonlinearEnabled: Boolean(el.nonlinearEnabledInput?.checked),
      materialHarmonicEnabled: Boolean(el.harmonicEnabledInput?.checked),
      materialPhaseChangeEnabled: Boolean(el.phaseChangeEnabledInput?.checked),
      materialGyrotropyEnabled: Boolean(el.gyrotropyEnabledInput?.checked),
      materialBianisotropyEnabled: Boolean(el.bianisotropyEnabledInput?.checked),
      materialConductivityEnabled: Boolean(el.conductivityEnabledInput?.checked),
      materialSaturableGainEnabled: Boolean(el.saturableGainEnabledInput?.checked),
      dispersionModel: normalizeModel(el.dispersionModelInput?.value),
      customEpsReal: finiteNumber(el.customEpsRealInput?.value),
      customEpsImag: finiteNumber(el.customEpsImagInput?.value),
      customEpsYReal: finiteNumber(el.customEpsYRealInput?.value),
      customEpsYImag: finiteNumber(el.customEpsYImagInput?.value),
      customMuReal: finiteNumber(el.customMuRealInput?.value),
      customMuImag: finiteNumber(el.customMuImagInput?.value),
      customMuYReal: finiteNumber(el.customMuYRealInput?.value),
      customMuYImag: finiteNumber(el.customMuYImagInput?.value),
      gyrotropyG: finiteNumber(el.gyrotropyGInput?.value),
      bianisotropyKappa: finiteNumber(el.bianisotropyKappaInput?.value),
      modulationDepth: finiteNumber(el.modulationDepthInput?.value),
      modulationFrequency: finiteNumber(el.modulationFrequencyInput?.value),
      modulationPeriodLambda: finiteNumber(el.modulationPeriodInput?.value),
      modulationAngleDeg: finiteNumber(el.modulationAngleInput?.value),
      modulationPhaseDeg: finiteNumber(el.modulationPhaseInput?.value),
      kerrChi3: finiteNumber(el.kerrChi3Input?.value),
      kerrSaturation: finiteNumber(el.kerrSaturationInput?.value),
      harmonicChi2: finiteNumber(el.harmonicChi2Input?.value),
      harmonicChi3: finiteNumber(el.harmonicChi3Input?.value),
      harmonicSaturation: finiteNumber(el.harmonicSaturationInput?.value),
      phaseEpsOn: finiteNumber(el.phaseEpsOnInput?.value),
      phaseLossOn: finiteNumber(el.phaseLossOnInput?.value),
      phaseThresholdOn: finiteNumber(el.phaseThresholdOnInput?.value),
      phaseThresholdOff: finiteNumber(el.phaseThresholdOffInput?.value),
      phaseTauOn: finiteNumber(el.phaseTauOnInput?.value),
      phaseTauOff: finiteNumber(el.phaseTauOffInput?.value),
      conductivitySigma: finiteNumber(el.conductivitySigmaInput?.value),
      conductivitySigmaY: finiteNumber(el.conductivitySigmaYInput?.value),
      gainSaturation: finiteNumber(el.gainSaturationInput?.value),
      dispersionOmegaP: finiteNumber(el.dispersionOmegaPInput?.value),
      dispersionGamma: finiteNumber(el.dispersionGammaInput?.value),
      dispersionOmega0: finiteNumber(el.dispersionOmega0Input?.value),
      dispersionDeltaEps: finiteNumber(el.dispersionDeltaEpsInput?.value),
      dispersionTau: finiteNumber(el.dispersionTauInput?.value),
    };
  }

  function assignFinite(state, key, value, min, max) {
    if (value == null) return;
    state[key] = clampNumber(value, min, max);
  }

  function applyCustomMaterialEditorValues(state, values, options = {}) {
    const normalizeModel = options.normalizeDispersionModel || normalizeDispersionModel;
    const bianisotropyLimit = options.bianisotropyKappaLimit ?? DEFAULT_BIANISOTROPY_KAPPA_LIMIT;
    const previousFieldComponent = state.fieldComponent;

    state.customAnisotropic = Boolean(values.customAnisotropic);
    state.materialModulationEnabled = Boolean(values.materialModulationEnabled);
    state.materialNonlinearEnabled = Boolean(values.materialNonlinearEnabled);
    state.materialHarmonicEnabled = Boolean(values.materialHarmonicEnabled);
    state.materialPhaseChangeEnabled = Boolean(values.materialPhaseChangeEnabled);
    state.materialGyrotropyEnabled = Boolean(values.materialGyrotropyEnabled);
    state.materialBianisotropyEnabled = Boolean(values.materialBianisotropyEnabled);
    state.materialConductivityEnabled = Boolean(values.materialConductivityEnabled);
    state.materialSaturableGainEnabled = Boolean(values.materialSaturableGainEnabled);

    if (state.materialGyrotropyEnabled && state.fieldComponent !== "hz") {
      state.fieldComponent = "hz";
    }

    state.dispersionModel = normalizeModel(values.dispersionModel);
    state.materialDispersionEnabled = state.dispersionModel !== "none";

    assignFinite(state, "customEpsReal", values.customEpsReal, -30, 30);
    assignFinite(state, "customEpsImag", values.customEpsImag, -30, 30);
    assignFinite(state, "customEpsYReal", values.customEpsYReal, -30, 30);
    assignFinite(state, "customEpsYImag", values.customEpsYImag, -30, 30);
    assignFinite(state, "customMuReal", values.customMuReal, -30, 30);
    assignFinite(state, "customMuImag", values.customMuImag, -30, 30);
    assignFinite(state, "customMuYReal", values.customMuYReal, -30, 30);
    assignFinite(state, "customMuYImag", values.customMuYImag, -30, 30);
    assignFinite(state, "gyrotropyG", values.gyrotropyG, -5, 5);
    if (values.bianisotropyKappa != null) {
      state.bianisotropyKappa = normalizeBianisotropyKappa(values.bianisotropyKappa, bianisotropyLimit);
    }
    assignFinite(state, "modulationDepth", values.modulationDepth, 0, 0.95);
    assignFinite(state, "modulationFrequency", values.modulationFrequency, -0.2, 0.2);
    assignFinite(state, "modulationPeriodLambda", values.modulationPeriodLambda, 0.1, 20);
    if (values.modulationAngleDeg != null) {
      state.modulationAngleDeg = ((values.modulationAngleDeg % 360) + 360) % 360;
    }
    assignFinite(state, "modulationPhaseDeg", values.modulationPhaseDeg, -180, 180);
    assignFinite(state, "kerrChi3", values.kerrChi3, -20, 20);
    assignFinite(state, "kerrSaturation", values.kerrSaturation, 0.05, 50);
    assignFinite(state, "harmonicChi2", values.harmonicChi2, -2, 2);
    assignFinite(state, "harmonicChi3", values.harmonicChi3, -2, 2);
    assignFinite(state, "harmonicSaturation", values.harmonicSaturation, 0.05, 50);
    assignFinite(state, "phaseEpsOn", values.phaseEpsOn, -30, 30);
    assignFinite(state, "phaseLossOn", values.phaseLossOn, -30, 30);
    assignFinite(state, "phaseThresholdOn", values.phaseThresholdOn, 0, 100);
    if (values.phaseThresholdOff != null) {
      state.phaseThresholdOff = Math.min(state.phaseThresholdOn, clampNumber(values.phaseThresholdOff, 0, 100));
    }
    assignFinite(state, "phaseTauOn", values.phaseTauOn, 1, 1000);
    assignFinite(state, "phaseTauOff", values.phaseTauOff, 1, 2000);
    assignFinite(state, "conductivitySigma", values.conductivitySigma, 0, 5);
    assignFinite(state, "conductivitySigmaY", values.conductivitySigmaY, 0, 5);
    assignFinite(state, "gainSaturation", values.gainSaturation, 0.05, 100);
    assignFinite(state, "dispersionOmegaP", values.dispersionOmegaP, 0, 1.2);
    assignFinite(state, "dispersionGamma", values.dispersionGamma, 0, 0.5);
    assignFinite(state, "dispersionOmega0", values.dispersionOmega0, 0, 1.2);
    assignFinite(state, "dispersionDeltaEps", values.dispersionDeltaEps, -20, 20);
    assignFinite(state, "dispersionTau", values.dispersionTau, 1, 200);

    return {
      fieldComponentChanged: state.fieldComponent !== previousFieldComponent,
      shouldRestoreDynamicMaterials: shouldRestoreDynamicMaterialsToBase(state),
    };
  }

  function shouldRestoreDynamicMaterialsToBase(state) {
    return (
      !state.materialModulationEnabled &&
      !state.materialNonlinearEnabled &&
      !state.materialHarmonicEnabled &&
      !state.materialPhaseChangeEnabled &&
      !state.materialGyrotropyEnabled &&
      !state.materialBianisotropyEnabled &&
      !state.materialDispersionEnabled
    );
  }

  global.FdtdMaterialEditorModel = Object.freeze({
    normalizeDispersionModel,
    normalizeBianisotropyKappa,
    brushDispersionParams,
    brushConductivityParams,
    brushPhaseChangeParams,
    brushGyrotropyValue,
    brushBianisotropyValue,
    normalizeBrushGeometryState,
    geometryUsesWidth,
    geometryUsesHeight,
    geometryUsesRadius,
    geometryUsesInnerRadius,
    readCustomMaterialEditorValues,
    applyCustomMaterialEditorValues,
    shouldRestoreDynamicMaterialsToBase,
  });
})(window);
