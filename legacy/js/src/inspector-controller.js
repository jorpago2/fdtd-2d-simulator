(function initFdtdInspectorController(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error("Inspector dependency must provide " + name + "().");
    }
    return value;
  }

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error("Inspector dependency must provide " + name + ".");
    }
    return value;
  }

  function createInspectorController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const sim = requireObject(dependencies.sim, "sim");
    const el = requireObject(dependencies.el, "el");
    const materialSelection = requireObject(dependencies.materialSelection, "materialSelection");
    const document = dependencies.documentRef || global.document;

    const explicitlySelectedMonitor = requireFunction(dependencies.explicitlySelectedMonitor, "explicitlySelectedMonitor");
    const explicitlySelectedSource = requireFunction(dependencies.explicitlySelectedSource, "explicitlySelectedSource");
    const dominantMaterialKind = requireFunction(dependencies.dominantMaterialKind, "dominantMaterialKind");
    const cellsToLambda = requireFunction(dependencies.cellsToLambda, "cellsToLambda");
    const formatLambda = requireFunction(dependencies.formatLambda, "formatLambda");
    const formatFieldValue = requireFunction(dependencies.formatFieldValue, "formatFieldValue");
    const sourceShapeLabel = requireFunction(dependencies.sourceShapeLabel, "sourceShapeLabel");
    const sourceTypeLabel = requireFunction(dependencies.sourceTypeLabel, "sourceTypeLabel");
    const sourceCouplingLabel = requireFunction(dependencies.sourceCouplingLabel, "sourceCouplingLabel");
    const sourceUsesWidth = requireFunction(dependencies.sourceUsesWidth, "sourceUsesWidth");
    const monitorQuantityLabel = requireFunction(dependencies.monitorQuantityLabel, "monitorQuantityLabel");
    const formatMonitorAngle = requireFunction(dependencies.formatMonitorAngle, "formatMonitorAngle");
    const solverModeLabel = requireFunction(dependencies.solverModeLabel, "solverModeLabel");
    const boundarySummaryLabel = requireFunction(dependencies.boundarySummaryLabel, "boundarySummaryLabel");
    const runtimeEngineLabel = requireFunction(dependencies.runtimeEngineLabel, "runtimeEngineLabel");

    function setInspectorDetails(rows) {
      if (!el.inspectorDetails) return;
      el.inspectorDetails.replaceChildren();
      rows.forEach(([label, value]) => {
        const row = document.createElement("div");
        const labelNode = document.createElement("span");
        const valueNode = document.createElement("output");
        labelNode.textContent = label;
        valueNode.textContent = value;
        row.append(labelNode, valueNode);
        el.inspectorDetails.appendChild(row);
      });
    }

    function materialRegionStats(region) {
      const cells = region?.cells || [];
      if (cells.length === 0) return null;
      const sums = {
        eps: 0,
        loss: 0,
        epsY: 0,
        mu: 0,
        muLoss: 0,
        sigma: 0,
      };
      const features = new Set();
      for (const cell of cells) {
        const idx = sim.id(cell.x, cell.y);
        sums.eps += sim.eps[idx] || 0;
        sums.loss += sim.loss[idx] || 0;
        sums.epsY += sim.epsY[idx] || 0;
        sums.mu += sim.mu[idx] || 0;
        sums.muLoss += sim.muLoss[idx] || 0;
        sums.sigma += sim.conductivity[idx] || 0;
        if (sim.material[idx] === 2) features.add("PEC");
        if (sim.dispersiveMaterial[idx] || sim.muDispersiveMaterial[idx]) features.add("ADE");
        if (sim.nonlinearMaterial[idx]) features.add("Kerr");
        if (sim.modulatedMaterial[idx]) features.add("modulated");
        if (sim.phaseChangeMaterial[idx]) features.add("memory");
        if (sim.gyrotropicMaterial[idx]) features.add("gyro");
        if (sim.bianisotropicMaterial[idx]) features.add("bianiso");
        if (sim.electricTensorMaterial[idx]) features.add("tensor");
        if (sim.conductivity[idx] > 0 || sim.conductivityY[idx] > 0) features.add("sigma");
      }
      const inv = 1 / cells.length;
      return {
        eps: sums.eps * inv,
        loss: sums.loss * inv,
        epsY: sums.epsY * inv,
        mu: sums.mu * inv,
        muLoss: sums.muLoss * inv,
        sigma: sums.sigma * inv,
        features: Array.from(features),
      };
    }

    function updateInspector() {
      if (!el.inspectorKind || !el.inspectorTitle || !el.inspectorDetails) return;
      const monitor = explicitlySelectedMonitor();
      const source = explicitlySelectedSource();
      const region = materialSelection.region;
      const hasRegion = Boolean(region?.cells?.length);
      const hasMonitor = Boolean(monitor) && !hasRegion;
      const hasSource = Boolean(source) && !hasRegion && !hasMonitor;
    
      el.inspectorEditBtn.disabled = !(hasSource || hasMonitor || hasRegion);
      el.inspectorClearBtn.disabled = !(hasSource || hasMonitor || hasRegion);
    
      if (hasRegion) {
        const stats = materialRegionStats(region);
        const b = region.bounds;
        el.inspectorKind.textContent = "Material";
        el.inspectorTitle.textContent = `${dominantMaterialKind(region).toUpperCase()} region`;
        setInspectorDetails([
          ["Cells", String(region.cells.length)],
          ["Bounds", `${formatLambda(cellsToLambda(b.minX))}-${formatLambda(cellsToLambda(b.maxX + 1))} λ0`],
          ["Height", `${formatLambda(cellsToLambda(b.maxY - b.minY + 1))} λ0`],
          ["εx avg", stats ? formatFieldValue(stats.eps) : "-"],
          ["εy avg", stats ? formatFieldValue(stats.epsY) : "-"],
          ["μ avg", stats ? formatFieldValue(stats.mu) : "-"],
          ["Loss", stats ? formatFieldValue(stats.loss) : "-"],
          ["Flags", stats?.features.length ? stats.features.join(", ") : "static"],
        ]);
        if (el.inspectorNote) {
          el.inspectorNote.textContent = "Region values are averaged over selected grid cells.";
        }
        return;
      }
    
      if (hasSource) {
        el.inspectorKind.textContent = "Source";
        el.inspectorTitle.textContent = `Source ${source.id}: ${sourceShapeLabel(source.shape)}`;
        setInspectorDetails([
          ["Time", sourceTypeLabel(source.type)],
          ["Coupling", sourceCouplingLabel(source.shape)],
          ["x / λ0", formatLambda(source.xLambda)],
          ["y / λ0", formatLambda(source.yLambda)],
          ["f Δt", source.frequency.toFixed(3)],
          ["Amplitude", source.amplitude.toFixed(2)],
          ["Phase", `${Math.round(source.phaseDeg || 0)} deg`],
          ["Angle", `${Math.round(source.angleDeg || 0)} deg`],
        ]);
        if (el.inspectorNote) {
          el.inspectorNote.textContent = sourceUsesWidth(source.shape)
            ? `FWHM / λ0 ${formatLambda(source.widthLambda)}.`
            : "Point or line source; spatial width control is inactive.";
        }
        if (el.inspectorNote && source.shape === "evanescentLine") {
          const ratio = source.evanescentKParallelRatio ?? source.widthLambda;
          el.inspectorNote.textContent = `Evanescent source: k_parallel/k0 = ${formatLambda(ratio)}.`;
        }
        return;
      }
    
      if (hasMonitor) {
        const measurement = sim.measureCustomMonitor(monitor);
        el.inspectorKind.textContent = "Monitor";
        el.inspectorTitle.textContent = `Monitor M${monitor.id}: ${monitorQuantityLabel(monitor.quantity)}`;
        setInspectorDetails([
          ["x / λ0", formatLambda(monitor.xLambda)],
          ["y / λ0", formatLambda(monitor.yLambda)],
          ["Length", `${formatLambda(monitor.lengthLambda)} λ0`],
          ["Angle", `${formatMonitorAngle(monitor.angleDeg)} deg`],
          ["Samples", String(measurement.samples || 0)],
          ["Mean", formatFieldValue(measurement.mean || 0)],
          ["RMS", formatFieldValue(measurement.rms || 0)],
          ["Flux n", formatFieldValue(measurement.normalFlux || 0)],
        ]);
        if (el.inspectorNote) {
          el.inspectorNote.textContent = "Custom monitor values are sampled along the selected line segment.";
        }
        return;
      }
    
      const presetLabel = el.presetInput?.selectedOptions?.[0]?.textContent?.trim() || state.preset;
      el.inspectorKind.textContent = "Scene";
      el.inspectorTitle.textContent = "No explicit selection";
      setInspectorDetails([
        ["Preset", presetLabel],
        ["Sources", String(state.sources.length)],
        ["Monitors", String(state.monitors.length)],
        ["Grid", `${sim.nx} x ${sim.ny}`],
        ["Mode", solverModeLabel()],
        ["Boundary", boundarySummaryLabel()],
        ["Engine", runtimeEngineLabel()],
      ]);
      if (el.inspectorNote) {
        el.inspectorNote.textContent = "Select a source, monitor, or material region on the canvas.";
      }
    }

    return Object.freeze({
      updateInspector,
    });
  }

  global.FdtdInspectorController = Object.freeze({
    createInspectorController,
  });
})(window);
