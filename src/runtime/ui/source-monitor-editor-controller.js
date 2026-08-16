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

    const editorElementIds = Object.freeze([
      "sourceTypeInput", "sourceShapeInput", "sourceXInput", "sourceYInput",
      "sourceOrderInput", "sourcePhaseInput", "monitorQuantityInput",
      "monitorXInput", "monitorYInput", "sourceMenu", "monitorMenu",
    ]);

    function refreshEditorElements() {
      editorElementIds.forEach((id) => {
        el[id] = global.document.getElementById(id);
      });
    }

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
        return "Source amplitude J∥,₀";
      }
      if (currentSourceShapes.has(shape)) {
        return `Source amplitude ${currentSourceLetter()}z,₀`;
      }
      return `Incident amplitude ${simulatedFieldLetter()}inc,₀`;
    }
    
    function sourceAngleLabel(shape) {
      if (incidentFieldSourceShapes.has(shape)) return "Incidence angle θ (°)";
      if (inPlaneElectricCurrentShapes.has(shape)) return "Current angle θ (°)";
      if (shape === "huygens" || shape === "janusDipole") return "Direction θ (°)";
      if (circularDipoleSourceShapes.has(shape)) return "Spin axis θ (°)";
      return `${currentSourceLetter()}z axis θ (°)`;
    }

    function updateSourceShapeOptionLabels() {
      // React renders source labels from the current editor snapshot.
    }
    
    function populateSourceEditor(source) {
      refreshEditorElements();
      const normalized = normalizeSource(source);
      const wavelengthRange = sourceMonitorModel.sourceWavelengthRange(state.cellsPerWavelength);
      const sourceWavelengthLambda = sourceMonitorModel.frequencyToSourceWavelengthLambda(
        normalized.frequency,
        state.cellsPerWavelength,
      );
      el.frequencyInput.min = wavelengthRange.min.toFixed(2);
      el.frequencyInput.max = wavelengthRange.max.toFixed(2);
      el.frequencyInput.step = "any";
      el.frequencyInput.value = sourceWavelengthLambda.toFixed(2);
      el.amplitudeInput.value = normalized.amplitude.toFixed(2);
      global.FdtdScientificControls?.setLabel?.("amplitudeInput", sourceAmplitudeLabel(normalized.shape));
      if (normalized.shape === "evanescentLine") {
        global.FdtdScientificControls?.setLabel?.("sourceWidthInput", "k∥/k₀");
        el.sourceWidthInput.min = "1.01";
        el.sourceWidthInput.max = "2.50";
        el.sourceWidthInput.step = "0.01";
        el.sourceWidthInput.value = normalized.widthLambda.toFixed(2);
      } else if (normalized.shape === "modeProfile") {
        global.FdtdScientificControls?.setLabel?.("sourceWidthInput", "mode window / λ₀");
        el.sourceWidthInput.min = "0.25";
        el.sourceWidthInput.max = "3.00";
        el.sourceWidthInput.step = "0.05";
        el.sourceWidthInput.value = formatLambda(normalized.widthLambda);
      } else {
        global.FdtdScientificControls?.setLabel?.("sourceWidthInput", "FWHM / λ₀");
        el.sourceWidthInput.min = "0.05";
        el.sourceWidthInput.max = "1.50";
        el.sourceWidthInput.step = "0.05";
        el.sourceWidthInput.value = formatLambda(normalized.widthLambda);
      }
      el.sourceAngleInput.value = String(Math.round(normalized.angleDeg));
      global.FdtdScientificControls?.setLabel?.("sourceAngleInput", sourceAngleLabel(normalized.shape));
      if (el.sourceTimePhaseInput) el.sourceTimePhaseInput.value = String(Math.round(normalized.phaseDeg));
      const widthEnabled = sourceUsesWidth(normalized.shape);
      const angleEnabled = sourceUsesAngle(normalized.shape);
      el.sourceWidthInput.disabled = !widthEnabled;
      el.sourceAngleInput.disabled = !angleEnabled;
      global.dispatchEvent(new global.CustomEvent("fdtd:source-editor", { detail: {
        source: normalized,
        mode: contextMenuState.sourceMenuMode,
        title: contextMenuState.sourceMenuMode === "edit" ? `Edit source ${normalized.id ?? ""}`.trim() : "Add source",
        hint: contextMenuState.sourceMenuMode === "edit"
          ? `${sourceTypeLabel(normalized.type)} · ${sourceShapeLabel(normalized.shape)} · ${sourceCouplingLabel(normalized.shape)}`
          : `x / λ₀ ${formatLambda(normalized.xLambda)}, y / λ₀ ${formatLambda(normalized.yLambda)}`,
        widthEnabled,
        angleEnabled,
        multipoleEnabled: sourceUsesMultipoleControls(normalized.shape),
        minX: formatLambda(minSourceXLambda()),
        maxX: formatLambda(maxSourceXLambda()),
        minY: formatLambda(minSourceYLambda()),
        maxY: formatLambda(maxSourceYLambda()),
      } }));
    }
    
    function readSourceEditorValues() {
      refreshEditorElements();
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
      refreshEditorElements();
      const normalized = normalizeMonitor(monitor);
      if (el.monitorLengthInput) {
        const maxLengthLambda = Math.max(0.1, Math.hypot(maxMonitorXLambda() - minMonitorXLambda(), maxMonitorYLambda() - minMonitorYLambda()));
        el.monitorLengthInput.max = formatLambda(maxLengthLambda);
        el.monitorLengthInput.value = formatLambda(normalized.lengthLambda);
      }
      if (el.monitorAngleInput) el.monitorAngleInput.value = String(Math.round(normalized.angleDeg));
      global.dispatchEvent(new global.CustomEvent("fdtd:monitor-editor", { detail: {
        monitor: normalized,
        mode: contextMenuState.monitorMenuMode,
        title: contextMenuState.monitorMenuMode === "edit" ? `Edit monitor M${normalized.id ?? ""}` : "Add monitor",
        hint: contextMenuState.monitorMenuMode === "edit"
          ? `${monitorQuantityLabel(normalized.quantity)} · ${formatLambdaOutput(normalized.lengthLambda)}`
          : `x / λ0 ${formatLambda(normalized.xLambda)}, y / λ0 ${formatLambda(normalized.yLambda)}`,
        minX: formatLambda(minMonitorXLambda()),
        maxX: formatLambda(maxMonitorXLambda()),
        minY: formatLambda(minMonitorYLambda()),
        maxY: formatLambda(maxMonitorYLambda()),
      } }));
    }
    
    function readMonitorEditorValues() {
      refreshEditorElements();
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
