(function initFdtdMaterialEditorUi(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Material editor UI dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Material editor UI dependency must provide ${name}().`);
    }
    return value;
  }

  function precision(value, digits = 6) {
    return String(Number(Number(value).toPrecision(digits)));
  }

  function setChecked(input, checked) {
    if (input) input.checked = Boolean(checked);
  }

  function setValue(input, value) {
    if (input) input.value = String(value);
  }

  function syncCustomMaterialLabels({ el, state }) {
    requireObject(el, "el");
    requireObject(state, "state");
    const anisotropic = Boolean(state.customAnisotropic);
    setChecked(el.customAnisotropyInput, anisotropic);
    if (el.customEpsRealLabel) {
      el.customEpsRealLabel.innerHTML = anisotropic ? "&epsilon;<sub>x</sub>&prime;" : "&epsilon;&prime;";
    }
    if (el.customEpsImagLabel) {
      el.customEpsImagLabel.innerHTML = anisotropic ? "&ell;&epsilon;,x" : "&ell;&epsilon;";
    }
    if (el.customMuRealLabel) {
      el.customMuRealLabel.innerHTML = anisotropic ? "&mu;<sub>x</sub>&prime;" : "&mu;&prime;";
    }
    if (el.customMuImagLabel) {
      el.customMuImagLabel.innerHTML = anisotropic ? "&ell;&mu;,x" : "&ell;&mu;";
    }
  }

  function syncCustomMaterialEditorValues({ el, normalizeDispersionModel, state }) {
    requireObject(el, "el");
    requireObject(state, "state");
    const normalizeModel = requireFunction(normalizeDispersionModel, "normalizeDispersionModel");

    setValue(el.customEpsRealInput, state.customEpsReal.toFixed(2));
    setValue(el.customEpsImagInput, precision(state.customEpsImag));
    setValue(el.customEpsYRealInput, state.customEpsYReal.toFixed(2));
    setValue(el.customEpsYImagInput, precision(state.customEpsYImag));
    setValue(el.customMuRealInput, state.customMuReal.toFixed(2));
    setValue(el.customMuImagInput, precision(state.customMuImag));
    setValue(el.customMuYRealInput, state.customMuYReal.toFixed(2));
    setValue(el.customMuYImagInput, precision(state.customMuYImag));

    setChecked(el.gyrotropyEnabledInput, state.materialGyrotropyEnabled);
    setValue(el.gyrotropyGInput, precision(state.gyrotropyG));
    setChecked(el.bianisotropyEnabledInput, state.materialBianisotropyEnabled);
    setValue(el.bianisotropyKappaInput, precision(state.bianisotropyKappa));

    setChecked(el.modulationEnabledInput, state.materialModulationEnabled);
    setValue(el.modulationDepthInput, state.modulationDepth.toFixed(2));
    setValue(el.modulationFrequencyInput, state.modulationFrequency.toFixed(3));
    setValue(el.modulationPeriodInput, state.modulationPeriodLambda.toFixed(1));
    setValue(el.modulationAngleInput, Math.round(state.modulationAngleDeg));
    setValue(el.modulationPhaseInput, Math.round(state.modulationPhaseDeg));

    setChecked(el.nonlinearEnabledInput, state.materialNonlinearEnabled);
    setValue(el.kerrChi3Input, precision(state.kerrChi3));
    setValue(el.kerrSaturationInput, state.kerrSaturation.toFixed(2));

    setChecked(el.harmonicEnabledInput, state.materialHarmonicEnabled);
    setValue(el.harmonicChi2Input, precision(state.harmonicChi2));
    setValue(el.harmonicChi3Input, precision(state.harmonicChi3));
    setValue(el.harmonicSaturationInput, precision(state.harmonicSaturation));

    setChecked(el.phaseChangeEnabledInput, state.materialPhaseChangeEnabled);
    setValue(el.phaseEpsOnInput, precision(state.phaseEpsOn));
    setValue(el.phaseLossOnInput, precision(state.phaseLossOn));
    setValue(el.phaseThresholdOnInput, precision(state.phaseThresholdOn));
    setValue(el.phaseThresholdOffInput, precision(state.phaseThresholdOff));
    setValue(el.phaseTauOnInput, Math.round(state.phaseTauOn));
    setValue(el.phaseTauOffInput, Math.round(state.phaseTauOff));

    setChecked(el.conductivityEnabledInput, state.materialConductivityEnabled);
    setValue(el.conductivitySigmaInput, precision(state.conductivitySigma));
    setValue(el.conductivitySigmaYInput, precision(state.conductivitySigmaY));

    setChecked(el.saturableGainEnabledInput, state.materialSaturableGainEnabled);
    setValue(el.gainSaturationInput, precision(state.gainSaturation));

    setValue(el.dispersionModelInput, normalizeModel(state.dispersionModel));
    setValue(el.dispersionOmegaPInput, precision(state.dispersionOmegaP));
    setValue(el.dispersionGammaInput, precision(state.dispersionGamma));
    setValue(el.dispersionOmega0Input, precision(state.dispersionOmega0));
    setValue(el.dispersionDeltaEpsInput, precision(state.dispersionDeltaEps));
    setValue(el.dispersionTauInput, Math.round(state.dispersionTau));
  }

  global.FdtdMaterialEditorUi = Object.freeze({
    syncCustomMaterialLabels,
    syncCustomMaterialEditorValues,
  });
})(window);
