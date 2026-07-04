(function initFdtdNextFormatters(global) {
  "use strict";

  const root = global.FdtdNext || (global.FdtdNext = {});
  const core = root.core || (root.core = {});
  const contracts = core.contracts;
  if (!contracts) {
    throw new Error("tests/reference-modules/core/contracts.js must be loaded before tests/reference-modules/core/formatters.js");
  }

  function trimFixed(value, digits) {
    return Number(value).toFixed(digits).replace(/\.?0+$/, "");
  }

  function formatLambda(value) {
    return Number(value).toFixed(2);
  }

  function formatCompactLambda(value) {
    return Number(value).toFixed(1).replace(/\.0$/, "");
  }

  function formatLambdaOutput(value) {
    return `${formatLambda(value)} \u03bb\u2080`;
  }

  function formatTimeRate(value) {
    return `${Number(value).toFixed(1).replace(/\.0$/, "")}x`;
  }

  function formatSpeed(value) {
    return formatTimeRate(value);
  }

  function formatScaleBarValue(value) {
    const number = Number(value);
    if (Math.abs(number) >= 10 || Number.isInteger(number)) return number.toFixed(0);
    if (Math.abs(number) >= 1) return trimFixed(number, 1);
    if (Math.abs(number) >= 0.01) return trimFixed(number, 2);
    return number.toExponential(1);
  }

  function niceScaleLength(visibleLambdaWidth) {
    const target = Math.max(Number(visibleLambdaWidth) * 0.18, 1e-9);
    const exponent = Math.floor(Math.log10(target));
    const base = Math.pow(10, exponent);
    const normalized = target / base;
    if (normalized <= 1) return base;
    if (normalized <= 2) return 2 * base;
    if (normalized <= 5) return 5 * base;
    return 10 * base;
  }

  function createFieldFormatters(state) {
    contracts.requireObject(state, "state");

    function simulatedFieldLetter() {
      return state.fieldComponent === "hz" ? "H" : "E";
    }

    function transverseFieldLetter() {
      return state.fieldComponent === "hz" ? "E" : "H";
    }

    function fieldComponentHtml(letter, component = "") {
      return `<i>${letter}</i>${component ? `<sub>${component}</sub>` : ""}`;
    }

    function simulatedFieldComponentHtml() {
      return fieldComponentHtml(simulatedFieldLetter(), "z");
    }

    function simulatedFieldUnitHtml() {
      return fieldComponentHtml(simulatedFieldLetter(), "0");
    }

    function transverseFieldUnitHtml() {
      return fieldComponentHtml(transverseFieldLetter(), "0");
    }

    function scalarFieldComponentKey() {
      return state.fieldComponent === "hz" ? "Hz" : "Ez";
    }

    function solverModeLabel() {
      return state.fieldComponent === "hz" ? "TEz / Hz" : "TMz / Ez";
    }

    function fieldDisplayConfig(display = state.fieldDisplay) {
      const scalarLetter = simulatedFieldLetter();
      const transverseLetter = transverseFieldLetter();
      const scalarUnit = simulatedFieldUnitHtml();
      const transverseUnit = transverseFieldUnitHtml();
      const fieldConfigs = {
        scalar: {
          key: `${scalarLetter}z`,
          labelHtml: simulatedFieldComponentHtml(),
          metricHtml: simulatedFieldComponentHtml(),
          title: `Show ${scalarFieldComponentKey()}`,
          unitHtml: scalarUnit,
          magnitude: false,
        },
        transverseX: {
          key: `${transverseLetter}x`,
          labelHtml: fieldComponentHtml(transverseLetter, "x"),
          metricHtml: fieldComponentHtml(transverseLetter, "x"),
          title: `Show ${transverseLetter}x`,
          unitHtml: transverseUnit,
          magnitude: false,
        },
        transverseY: {
          key: `${transverseLetter}y`,
          labelHtml: fieldComponentHtml(transverseLetter, "y"),
          metricHtml: fieldComponentHtml(transverseLetter, "y"),
          title: `Show ${transverseLetter}y`,
          unitHtml: transverseUnit,
          magnitude: false,
        },
        electricMag: {
          key: "|E|",
          labelHtml: `|${fieldComponentHtml("E")}|`,
          metricHtml: fieldComponentHtml("E"),
          title: "Show electric-field magnitude",
          unitHtml: fieldComponentHtml("E", "0"),
          magnitude: true,
        },
        magneticMag: {
          key: "|H|",
          labelHtml: `|${fieldComponentHtml("H")}|`,
          metricHtml: fieldComponentHtml("H"),
          title: "Show magnetic-field magnitude",
          unitHtml: fieldComponentHtml("H", "0"),
          magnitude: true,
        },
      };
      const poyntingConfigs = {
        scalar: {
          key: "|S|",
          labelHtml: `|${fieldComponentHtml("S")}|`,
          metricHtml: fieldComponentHtml("S"),
          title: "Show Poynting-vector magnitude",
          unitHtml: fieldComponentHtml("S", "0"),
          magnitude: true,
        },
        transverseX: {
          key: "Sx",
          labelHtml: fieldComponentHtml("S", "x"),
          metricHtml: fieldComponentHtml("S", "x"),
          title: "Show x-directed Poynting flux",
          unitHtml: fieldComponentHtml("S", "0"),
          magnitude: false,
        },
        transverseY: {
          key: "Sy",
          labelHtml: fieldComponentHtml("S", "y"),
          metricHtml: fieldComponentHtml("S", "y"),
          title: "Show y-directed Poynting flux",
          unitHtml: fieldComponentHtml("S", "0"),
          magnitude: false,
        },
      };
      const configs = state.viewMode === "poynting" ? poyntingConfigs : fieldConfigs;
      return configs[display] || configs.scalar;
    }

    return Object.freeze({
      fieldComponentHtml,
      fieldDisplayConfig,
      scalarFieldComponentKey,
      simulatedFieldComponentHtml,
      simulatedFieldLetter,
      simulatedFieldUnitHtml,
      solverModeLabel,
      transverseFieldLetter,
      transverseFieldUnitHtml,
    });
  }

  function createSourceFormatters({ state, materialNames, inPlaneElectricCurrentShapes, circularDipoleSourceShapes, incidentFieldSourceShapes }) {
    contracts.requireObject(state, "state");
    const materials = contracts.requireObject(materialNames, "materialNames");
    const inPlaneShapes = inPlaneElectricCurrentShapes || new Set();
    const circularShapes = circularDipoleSourceShapes || new Set();
    const incidentShapes = incidentFieldSourceShapes || new Set();

    function currentSourceLetter() {
      return state.fieldComponent === "hz" ? "M" : "J";
    }

    function sourceShapeLabel(shape) {
      const sourceLetter = currentSourceLetter();
      const dipoleKind = state.fieldComponent === "hz" ? "magnetic" : "electric";
      if (inPlaneShapes.has(shape)) return "In-plane electric dipole Jx/Jy";
      return {
        point: `${sourceLetter}z filament`,
        line: "Plane wave",
        gaussianProfile: "Gaussian line",
        gaussianSpot: `Gaussian ${sourceLetter}z patch`,
        pointDipole: `Point ${dipoleKind} dipole`,
        dipole: `${sourceLetter}z dipole pair`,
        circularDipoleCw: `Circular ${dipoleKind} dipole +90 deg`,
        circularDipoleCcw: `Circular ${dipoleKind} dipole -90 deg`,
        janusDipole: `Janus ${dipoleKind} dipole`,
        huygens: "Huygens source",
        quadrupole: `${sourceLetter}z quadrupole pattern`,
        multipole: `2D ${sourceLetter}z multipole pattern`,
        evanescentLine: "Evanescent line",
      }[shape] || "Source";
    }

    function sourceCouplingLabel(shape) {
      if (inPlaneShapes.has(shape)) return "in-plane electric current";
      if (circularShapes.has(shape)) return "quadrature dipole";
      if (shape === "janusDipole") return "quadrature Janus pair";
      if (shape === "huygens") return "cardioid Huygens pair";
      if (shape === "evanescentLine") return "evanescent incident field";
      return incidentShapes.has(shape) ? "incident field" : `out-of-plane ${currentSourceLetter()}z`;
    }

    function sourceSummaryLabel() {
      if (state.sources.length === 1) {
        const shape = state.sources[0].shape;
        return `${sourceShapeLabel(shape)} \u00b7 ${sourceCouplingLabel(shape)}`;
      }
      return `${state.sources.length} sources`;
    }

    function currentBrushLabel() {
      if (state.brush === "custom" && state.materialBianisotropyEnabled) return "Custom magnetoelectric kappa_n";
      if (state.brush === "custom" && state.materialGyrotropyEnabled) return "Custom gyrotropic epsilon tensor";
      return state.brush === "custom" && state.customAnisotropic
        ? "Custom anisotropic epsilon, mu"
        : materials[state.brush];
    }

    return Object.freeze({
      currentBrushLabel,
      currentSourceLetter,
      sourceCouplingLabel,
      sourceShapeLabel,
      sourceSummaryLabel,
    });
  }

  function createAppFormatters(dependencies) {
    const field = createFieldFormatters(dependencies.state);
    const source = createSourceFormatters(dependencies);

    function monitorQuantityLabel(quantity) {
      return {
        scalar: `${field.scalarFieldComponentKey()} mean`,
        magnitude: `mean |${field.scalarFieldComponentKey()}|`,
        normalFlux: "normal flux",
        tangentFlux: "tangential flux",
      }[quantity] || `${field.scalarFieldComponentKey()} mean`;
    }

    return Object.freeze({
      ...field,
      ...source,
      formatCompactLambda,
      formatLambda,
      formatLambdaOutput,
      formatScaleBarValue,
      formatTimeRate,
      formatSpeed,
      monitorQuantityLabel,
      niceScaleLength,
      trimFixed,
    });
  }

  core.formatters = Object.freeze({
    createAppFormatters,
    createFieldFormatters,
    createSourceFormatters,
    formatCompactLambda,
    formatLambda,
    formatLambdaOutput,
    formatScaleBarValue,
    formatTimeRate,
    formatSpeed,
    niceScaleLength,
    trimFixed,
  });
})(window);
