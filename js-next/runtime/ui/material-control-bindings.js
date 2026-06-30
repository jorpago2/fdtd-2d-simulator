(function initFdtdMaterialControlBindings(global) {
  "use strict";

  const CHANGE_ONLY_KEYS = Object.freeze([
    "customAnisotropyInput",
    "gyrotropyEnabledInput",
    "bianisotropyEnabledInput",
    "modulationEnabledInput",
    "nonlinearEnabledInput",
    "harmonicEnabledInput",
    "phaseChangeEnabledInput",
    "conductivityEnabledInput",
    "saturableGainEnabledInput",
    "dispersionModelInput",
  ]);

  const INPUT_AND_CHANGE_KEYS = Object.freeze([
    "customEpsRealInput",
    "customEpsImagInput",
    "customEpsYRealInput",
    "customEpsYImagInput",
    "customMuRealInput",
    "customMuImagInput",
    "customMuYRealInput",
    "customMuYImagInput",
    "gyrotropyGInput",
    "bianisotropyKappaInput",
    "modulationDepthInput",
    "modulationFrequencyInput",
    "modulationPeriodInput",
    "modulationAngleInput",
    "modulationPhaseInput",
    "kerrChi3Input",
    "kerrSaturationInput",
    "harmonicChi2Input",
    "harmonicChi3Input",
    "harmonicSaturationInput",
    "phaseEpsOnInput",
    "phaseLossOnInput",
    "phaseThresholdOnInput",
    "phaseThresholdOffInput",
    "phaseTauOnInput",
    "phaseTauOffInput",
    "conductivitySigmaInput",
    "conductivitySigmaYInput",
    "gainSaturationInput",
    "dispersionOmegaPInput",
    "dispersionGammaInput",
    "dispersionOmega0Input",
    "dispersionDeltaEpsInput",
    "dispersionTauInput",
  ]);

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Material control bindings dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Material control bindings dependency must provide ${name}().`);
    }
    return value;
  }

  function bindInputEvents(input, events, handler) {
    events.forEach((eventName) => {
      input?.addEventListener(eventName, handler);
    });
  }

  function bindMaterialControls(dependencies) {
    const el = requireObject(dependencies.el, "el");
    const handleCustomMaterialInput = requireFunction(
      dependencies.handleCustomMaterialInput,
      "handleCustomMaterialInput",
    );

    CHANGE_ONLY_KEYS.forEach((key) => {
      bindInputEvents(el[key], ["change"], handleCustomMaterialInput);
    });
    INPUT_AND_CHANGE_KEYS.forEach((key) => {
      bindInputEvents(el[key], ["input", "change"], handleCustomMaterialInput);
    });
  }

  global.FdtdMaterialControlBindings = Object.freeze({
    CHANGE_ONLY_KEYS,
    INPUT_AND_CHANGE_KEYS,
    bindMaterialControls,
  });
})(window);
