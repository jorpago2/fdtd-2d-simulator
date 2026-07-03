(function initFdtdControlSyncUi(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Control sync UI dependency must provide ${name}.`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Control sync UI dependency must provide ${name}().`);
    }
    return value;
  }

  function syncRuntimeAndViewControls({ el, formatTimeRate, state, uiCore }) {
    requireObject(el, "el");
    requireObject(state, "state");
    const core = requireObject(uiCore, "uiCore");
    const timeRateFormatter = requireFunction(formatTimeRate, "formatTimeRate");

    if (el.speedInput) el.speedInput.value = String(state.timeRate);
    if (el.speedOutput) el.speedOutput.value = timeRateFormatter(state.timeRate);
    if (el.renderFpsInput) el.renderFpsInput.value = String(state.renderFps || 0);
    if (el.renderFpsOutput) el.renderFpsOutput.value = state.renderFps > 0 ? `${state.renderFps} FPS` : "Auto";
    if (el.gainOutput) el.gainOutput.value = state.gain.toFixed(2);
    if (el.diagnosticsInput) {
      el.diagnosticsInput.checked = state.diagnosticsEnabled;
    }

    core.setExclusiveButtonState(el.fieldComponentButtons, "fieldComponent", state.fieldComponent, {
      selectedAttribute: "aria-pressed",
    });
    core.setExclusiveButtonState(el.viewModeButtons, "viewMode", state.viewMode, {
      selectedAttribute: "aria-pressed",
    });
    core.setExclusiveButtonState(el.viewProjectionButtons, "viewProjection", state.viewProjection, {
      selectedAttribute: "aria-pressed",
    });
    core.setExclusiveButtonState(el.materialPartButtons, "materialPart", state.materialPart, {
      selectedAttribute: "aria-pressed",
    });
    if (el.materialPartControl) {
      el.materialPartControl.hidden = state.viewMode !== "epsilon" && state.viewMode !== "mu";
    }
  }

  function syncSceneAndGridControls({ el, formatLambdaOutput, sceneDescriptions, state }) {
    requireObject(el, "el");
    requireObject(state, "state");
    const lambdaFormatter = requireFunction(formatLambdaOutput, "formatLambdaOutput");
    const descriptions = sceneDescriptions || {};

    if (el.gridNxInput) el.gridNxInput.value = String(state.gridNx);
    if (el.gridNyInput) el.gridNyInput.value = String(state.gridNy);
    if (el.sceneNote) {
      el.sceneNote.textContent = descriptions[state.preset] || descriptions.empty || "";
    }

    const showSlabThickness = state.preset === "customSlab";
    if (el.slabThicknessOutput) {
      el.slabThicknessOutput.value = lambdaFormatter(state.slabThicknessLambda);
    }
    if (el.slabThicknessInput) {
      el.slabThicknessInput.value = String(state.slabThicknessLambda);
      el.slabThicknessInput.disabled = !showSlabThickness;
    }
    if (el.slabThicknessControl) {
      el.slabThicknessControl.hidden = !showSlabThickness;
      el.slabThicknessControl.classList.toggle("is-disabled", !showSlabThickness);
    }
  }

  function syncConfigSummaryControls({
    boundary,
    cellsToLambda,
    courant,
    el,
    formatCompactLambda,
    formatLambda,
    gridNx,
    gridNy,
    state,
  }) {
    requireObject(el, "el");
    requireObject(state, "state");
    const toLambda = requireFunction(cellsToLambda, "cellsToLambda");
    const lambdaFormatter = requireFunction(formatLambda, "formatLambda");
    const compactLambdaFormatter = requireFunction(formatCompactLambda, "formatCompactLambda");
    const nx = Math.max(1, Number(gridNx) || 1);
    const ny = Math.max(1, Number(gridNy) || 1);
    const gridSummary = `${nx} x ${ny}`;
    const domainSummary = `${lambdaFormatter(toLambda(nx))} \u03bb\u2080 x ${lambdaFormatter(toLambda(ny))} \u03bb\u2080`;
    const compactGridSummary = `${nx}x${ny} \u00b7 ${compactLambdaFormatter(toLambda(nx))}x${compactLambdaFormatter(
      toLambda(ny),
    )} \u03bb\u2080`;
    const fullGridSummary = `${gridSummary} \u00b7 ${domainSummary}`;

    if (el.configScaleOutput) {
      el.configScaleOutput.textContent = `${state.wavelengthUm.toFixed(2)} \u00b5m \u00b7 ${state.cellsPerWavelength}/\u03bb\u2080`;
    }
    if (el.configGridOutput) {
      el.configGridOutput.textContent = compactGridSummary;
      el.configGridOutput.title = fullGridSummary;
    }
    if (el.configBoundaryOutput) {
      el.configBoundaryOutput.textContent = boundary || "";
    }
    if (el.configCflOutput) {
      el.configCflOutput.textContent = `S = ${Number(courant).toFixed(2)}`;
    }
  }

  global.FdtdControlSyncUi = Object.freeze({
    syncConfigSummaryControls,
    syncRuntimeAndViewControls,
    syncSceneAndGridControls,
  });
})(window);
