(function initFdtdSourceMonitorEditors(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error("Source/monitor editor dependency must provide " + name + "().");
    }
    return value;
  }

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error("Source/monitor editor dependency must provide " + name + ".");
    }
    return value;
  }

  function createSourceMonitorEditorController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const el = requireObject(dependencies.el, "el");
    const sim = requireObject(dependencies.sim, "sim");
    const contextMenuState = requireObject(dependencies.contextMenuState, "contextMenuState");
    const simulationEffects = requireObject(dependencies.simulationEffects, "simulationEffects");
    const sourceMonitorModel = requireObject(dependencies.sourceMonitorModel, "sourceMonitorModel");

    const inPlaneElectricCurrentShapes = requireObject(dependencies.inPlaneElectricCurrentShapes, "inPlaneElectricCurrentShapes");
    const currentSourceShapes = requireObject(dependencies.currentSourceShapes, "currentSourceShapes");
    const incidentFieldSourceShapes = requireObject(dependencies.incidentFieldSourceShapes, "incidentFieldSourceShapes");
    const circularDipoleSourceShapes = requireObject(dependencies.circularDipoleSourceShapes, "circularDipoleSourceShapes");
    const sourceShapeLabels = requireObject(dependencies.sourceShapeLabels, "sourceShapeLabels");
    const validateNumericInputs = typeof dependencies.validateNumericInputs === "function"
      ? dependencies.validateNumericInputs
      : () => true;

    const selectedSource = requireFunction(dependencies.selectedSource, "selectedSource");
    const explicitlySelectedMonitor = requireFunction(dependencies.explicitlySelectedMonitor, "explicitlySelectedMonitor");
    const normalizeSource = requireFunction(dependencies.normalizeSource, "normalizeSource");
    const normalizeMonitor = requireFunction(dependencies.normalizeMonitor, "normalizeMonitor");
    const currentSourceLetter = requireFunction(dependencies.currentSourceLetter, "currentSourceLetter");
    const simulatedFieldLetter = requireFunction(dependencies.simulatedFieldLetter, "simulatedFieldLetter");
    const sourceShapeLabel = requireFunction(dependencies.sourceShapeLabel, "sourceShapeLabel");
    const sourceCouplingLabel = requireFunction(dependencies.sourceCouplingLabel, "sourceCouplingLabel");
    const sourceUsesWidth = requireFunction(dependencies.sourceUsesWidth, "sourceUsesWidth");
    const sourceUsesAngle = requireFunction(dependencies.sourceUsesAngle, "sourceUsesAngle");
    const sourceUsesMultipoleControls = requireFunction(dependencies.sourceUsesMultipoleControls, "sourceUsesMultipoleControls");
    const setControlDisabled = requireFunction(dependencies.setControlDisabled, "setControlDisabled");
    const formatLambda = requireFunction(dependencies.formatLambda, "formatLambda");
    const formatLambdaOutput = requireFunction(dependencies.formatLambdaOutput, "formatLambdaOutput");
    const formatMonitorAngle = requireFunction(dependencies.formatMonitorAngle, "formatMonitorAngle");
    const monitorQuantityLabel = requireFunction(dependencies.monitorQuantityLabel, "monitorQuantityLabel");
    const minSourceXLambda = requireFunction(dependencies.minSourceXLambda, "minSourceXLambda");
    const minSourceYLambda = requireFunction(dependencies.minSourceYLambda, "minSourceYLambda");
    const maxSourceXLambda = requireFunction(dependencies.maxSourceXLambda, "maxSourceXLambda");
    const maxSourceYLambda = requireFunction(dependencies.maxSourceYLambda, "maxSourceYLambda");
    const minMonitorXLambda = requireFunction(dependencies.minMonitorXLambda, "minMonitorXLambda");
    const minMonitorYLambda = requireFunction(dependencies.minMonitorYLambda, "minMonitorYLambda");
    const maxMonitorXLambda = requireFunction(dependencies.maxMonitorXLambda, "maxMonitorXLambda");
    const maxMonitorYLambda = requireFunction(dependencies.maxMonitorYLambda, "maxMonitorYLambda");

    function activeSourceEditorTarget() {
      if (contextMenuState.sourceMenuDraft) return contextMenuState.sourceMenuDraft;
      if (!el.sourceMenu?.hidden) return selectedSource();
      return selectedSource();
    }
    
    function activeMonitorEditorTarget() {
      if (contextMenuState.monitorMenuDraft) return contextMenuState.monitorMenuDraft;
      if (!el.monitorMenu?.hidden) return explicitlySelectedMonitor();
      return explicitlySelectedMonitor();
    }
    
    function sourceTypeLabel(type) {
      return {
        sine: "sine",
        gaussian: "Gaussian pulse",
        ricker: "Ricker",
      }[type] || "sine";
    }
    
    function sourceAmplitudeLabel(shape) {
      if (inPlaneElectricCurrentShapes.has(shape)) {
        return "J∥,0";
      }
      if (currentSourceShapes.has(shape)) {
        return `${currentSourceLetter()}z,0`;
      }
      return `${simulatedFieldLetter()}inc,0`;
    }
    
    function sourceAngleLabel(shape) {
      if (incidentFieldSourceShapes.has(shape)) return "incidence θ";
      if (inPlaneElectricCurrentShapes.has(shape)) return "J∥ angle θ";
      if (shape === "huygens" || shape === "janusDipole") return "direction θ";
      if (circularDipoleSourceShapes.has(shape)) return "spin axis θ";
      return `${currentSourceLetter()}z axis θ`;
    }

    function controlInputs(control) {
      return Array.from(control?.querySelectorAll?.("input, select, textarea") || []);
    }

    function syncDependentControl(control, visible) {
      if (!control) return;
      control.hidden = !visible;
      setControlDisabled(control, controlInputs(control), !visible);
    }

    function syncChildControlGroupVisibility(control) {
      const childControls = Array.from(control?.children || []).filter((child) => child.matches?.("label"));
      if (childControls.length === 0) return;
      const visible = childControls.some((child) => !child.hidden);
      control.hidden = !visible;
      setControlDisabled(control, [], !visible);
    }
    
    function updateSourceShapeOptionLabels() {
      if (!el.sourceShapeInput) return;
      const currentGroup = el.sourceShapeInput.querySelector("optgroup");
      if (currentGroup) {
        currentGroup.label = `Out-of-plane ${currentSourceLetter()}z source`;
      }
      Array.from(el.sourceShapeInput.options).forEach((option) => {
        if (Object.prototype.hasOwnProperty.call(sourceShapeLabels, option.value)) {
          option.textContent = sourceShapeLabel(option.value);
        }
      });
    }
    
    function populateSourceEditor(source) {
      const normalized = normalizeSource(source);
      const wavelengthRange = sourceMonitorModel.sourceWavelengthRange(state.cellsPerWavelength);
      const sourceWavelengthLambda = sourceMonitorModel.frequencyToSourceWavelengthLambda(
        normalized.frequency,
        state.cellsPerWavelength,
      );
      updateSourceShapeOptionLabels();
      el.sourceTypeInput.value = normalized.type;
      el.sourceShapeInput.value = normalized.shape;
      el.frequencyInput.min = wavelengthRange.min.toFixed(2);
      el.frequencyInput.max = wavelengthRange.max.toFixed(2);
      el.frequencyInput.step = "any";
      el.frequencyInput.value = sourceWavelengthLambda.toFixed(2);
      el.frequencyOutput.value = sourceWavelengthLambda.toFixed(2);
      el.amplitudeInput.value = String(Math.round(normalized.amplitude * 100));
      el.amplitudeOutput.value = normalized.amplitude.toFixed(2);
      global.FdtdScientificControls?.setLabel?.("amplitudeInput", sourceAmplitudeLabel(normalized.shape));
      el.sourceXInput.min = formatLambda(minSourceXLambda());
      el.sourceYInput.min = formatLambda(minSourceYLambda());
      el.sourceXInput.max = formatLambda(maxSourceXLambda());
      el.sourceYInput.max = formatLambda(maxSourceYLambda());
      el.sourceXInput.value = formatLambda(normalized.xLambda);
      el.sourceYInput.value = formatLambda(normalized.yLambda);
      if (normalized.shape === "evanescentLine") {
        global.FdtdScientificControls?.setLabel?.("sourceWidthInput", "k∥/k₀");
        el.sourceWidthInput.min = "1.01";
        el.sourceWidthInput.max = "2.50";
        el.sourceWidthInput.step = "0.01";
        el.sourceWidthInput.value = normalized.widthLambda.toFixed(2);
        el.sourceWidthOutput.value = normalized.widthLambda.toFixed(2);
      } else if (normalized.shape === "modeProfile") {
        global.FdtdScientificControls?.setLabel?.("sourceWidthInput", "mode window / λ₀");
        el.sourceWidthInput.min = "0.25";
        el.sourceWidthInput.max = "3.00";
        el.sourceWidthInput.step = "0.05";
        el.sourceWidthInput.value = formatLambda(normalized.widthLambda);
        el.sourceWidthOutput.value = formatLambda(normalized.widthLambda);
      } else {
        global.FdtdScientificControls?.setLabel?.("sourceWidthInput", "FWHM / λ₀");
        el.sourceWidthInput.min = "0.05";
        el.sourceWidthInput.max = "1.50";
        el.sourceWidthInput.step = "0.05";
        el.sourceWidthInput.value = formatLambda(normalized.widthLambda);
        el.sourceWidthOutput.value = formatLambda(normalized.widthLambda);
      }
      el.sourceAngleInput.value = String(Math.round(normalized.angleDeg));
      el.sourceAngleOutput.value = `${Math.round(normalized.angleDeg)}°`;
      global.FdtdScientificControls?.setLabel?.("sourceAngleInput", sourceAngleLabel(normalized.shape));
      if (el.sourceTimePhaseInput) {
        el.sourceTimePhaseInput.value = String(Math.round(normalized.phaseDeg));
      }
      if (el.sourceTimePhaseOutput) {
        el.sourceTimePhaseOutput.value = `${Math.round(normalized.phaseDeg)}°`;
      }
      el.sourceOrderInput.value = String(normalized.multipoleOrder);
      el.sourcePhaseInput.value = normalized.multipolePhase;
      const widthEnabled = sourceUsesWidth(normalized.shape);
      const angleEnabled = sourceUsesAngle(normalized.shape);
      syncDependentControl(el.sourceWidthControl, widthEnabled);
      syncDependentControl(el.sourceAngleControl, angleEnabled);
      el.sourceWidthInput.disabled = !widthEnabled;
      el.sourceAngleInput.disabled = !angleEnabled;
      syncDependentControl(el.sourceOrderControl, sourceUsesMultipoleControls(normalized.shape));
      syncDependentControl(el.sourcePhaseControl, sourceUsesMultipoleControls(normalized.shape));
      syncChildControlGroupVisibility(el.sourceOrderControl?.closest(".source-order-controls"));
      if (el.sourceMenuTitle) {
        el.sourceMenuTitle.textContent = contextMenuState.sourceMenuMode === "edit" ? `Edit source ${normalized.id ?? ""}`.trim() : "Add source";
      }
      if (el.sourceMenuHint) {
        el.sourceMenuHint.textContent =
          contextMenuState.sourceMenuMode === "edit"
            ? `${sourceTypeLabel(normalized.type)} · ${sourceShapeLabel(normalized.shape)} · ${sourceCouplingLabel(normalized.shape)}`
            : `x / λ₀ ${formatLambda(normalized.xLambda)}, y / λ₀ ${formatLambda(normalized.yLambda)}`;
      }
      if (el.sourceApplyBtn) {
        el.sourceApplyBtn.textContent = contextMenuState.sourceMenuMode === "edit" ? "Update source" : "Add source";
      }
      if (el.sourceDeleteBtn) {
        el.sourceDeleteBtn.hidden = contextMenuState.sourceMenuMode !== "edit";
      }
    }
    
    function readSourceEditorValues() {
      return sourceMonitorModel.readSourceEditorValues(el, {
        cellsPerWavelength: state.cellsPerWavelength,
      });
    }
    
    function syncSourceEditorTarget() {
      if (!validateNumericInputs(el.sourceMenu)) return;
      const target = activeSourceEditorTarget();
      if (!target) return;
      simulationEffects.commit({ disableResponsiveGrid: true });
      const values = readSourceEditorValues();
      const componentChanged = inPlaneElectricCurrentShapes.has(values.shape) && state.fieldComponent !== "hz";
      if (componentChanged) {
        state.fieldComponent = "hz";
      }
      Object.assign(target, values);
      normalizeSource(target);
      if (contextMenuState.sourceMenuMode === "edit") {
        state.sourceDefaults = { ...target };
        delete state.sourceDefaults.id;
      }
      if (componentChanged) {
        sim.resetFields();
      }
      if (contextMenuState.sourceMenuMode === "edit") {
        simulationEffects.commitSourceMutation({
          disableResponsiveGrid: false,
          controls: true,
          render: true,
        });
      } else {
        simulationEffects.commit({
          controls: true,
          render: false,
        });
      }
    }
    
    function populateMonitorEditor(monitor) {
      const normalized = normalizeMonitor(monitor);
      if (el.monitorQuantityInput) el.monitorQuantityInput.value = normalized.quantity;
      if (el.monitorXInput) {
        el.monitorXInput.min = formatLambda(minMonitorXLambda());
        el.monitorXInput.max = formatLambda(maxMonitorXLambda());
        el.monitorXInput.value = formatLambda(normalized.xLambda);
      }
      if (el.monitorYInput) {
        el.monitorYInput.min = formatLambda(minMonitorYLambda());
        el.monitorYInput.max = formatLambda(maxMonitorYLambda());
        el.monitorYInput.value = formatLambda(normalized.yLambda);
      }
      if (el.monitorLengthInput) {
        const maxLengthLambda = Math.max(0.1, Math.hypot(maxMonitorXLambda() - minMonitorXLambda(), maxMonitorYLambda() - minMonitorYLambda()));
        el.monitorLengthInput.max = formatLambda(maxLengthLambda);
        el.monitorLengthInput.value = formatLambda(normalized.lengthLambda);
      }
      if (el.monitorLengthOutput) el.monitorLengthOutput.value = formatLambda(normalized.lengthLambda);
      if (el.monitorAngleInput) el.monitorAngleInput.value = String(Math.round(normalized.angleDeg));
      if (el.monitorAngleOutput) el.monitorAngleOutput.value = `${formatMonitorAngle(normalized.angleDeg)}°`;
      if (el.monitorMenuTitle) {
        el.monitorMenuTitle.textContent = contextMenuState.monitorMenuMode === "edit" ? `Edit monitor M${normalized.id ?? ""}` : "Add monitor";
      }
      if (el.monitorMenuHint) {
        el.monitorMenuHint.textContent =
          contextMenuState.monitorMenuMode === "edit"
            ? `${monitorQuantityLabel(normalized.quantity)} · ${formatLambdaOutput(normalized.lengthLambda)}`
            : `x / λ0 ${formatLambda(normalized.xLambda)}, y / λ0 ${formatLambda(normalized.yLambda)}`;
      }
      if (el.monitorApplyBtn) {
        el.monitorApplyBtn.textContent = contextMenuState.monitorMenuMode === "edit" ? "Update monitor" : "Add monitor";
      }
      if (el.monitorDeleteBtn) {
        el.monitorDeleteBtn.hidden = contextMenuState.monitorMenuMode !== "edit";
      }
    }
    
    function readMonitorEditorValues() {
      return sourceMonitorModel.readMonitorEditorValues(el);
    }
    
    function syncMonitorEditorTarget() {
      if (!validateNumericInputs(el.monitorMenu)) return;
      const target = activeMonitorEditorTarget();
      if (!target) return;
      simulationEffects.commit({ disableResponsiveGrid: true });
      Object.assign(target, readMonitorEditorValues());
      normalizeMonitor(target);
      if (contextMenuState.monitorMenuMode === "edit") {
        state.monitorDefaults = { ...target };
        delete state.monitorDefaults.id;
      }
      simulationEffects.commitMonitorMutation();
    }

    return Object.freeze({
      activeMonitorEditorTarget,
      activeSourceEditorTarget,
      populateMonitorEditor,
      populateSourceEditor,
      readMonitorEditorValues,
      readSourceEditorValues,
      sourceTypeLabel,
      syncMonitorEditorTarget,
      syncSourceEditorTarget,
      updateSourceShapeOptionLabels,
    });
  }

  global.FdtdSourceMonitorEditors = Object.freeze({
    createSourceMonitorEditorController,
  });
})(window);
