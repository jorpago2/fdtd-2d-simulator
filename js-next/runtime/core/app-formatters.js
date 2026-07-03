(function initFdtdAppFormatters(global) {
  "use strict";

  function createAppFormatters({
    state,
    materialNames,
    inPlaneElectricCurrentShapes,
    circularDipoleSourceShapes,
    incidentFieldSourceShapes,
  }) {
    function simulatedFieldLetter() {
      return state.fieldComponent === "hz" ? "H" : "E";
    }

    function simulatedFieldComponentHtml() {
      return `<i>${simulatedFieldLetter()}</i><sub>z</sub>`;
    }

    function simulatedFieldUnitHtml() {
      return `<i>${simulatedFieldLetter()}</i><sub>0</sub>`;
    }

    function scalarFieldComponentKey() {
      return state.fieldComponent === "hz" ? "Hz" : "Ez";
    }

    function solverModeLabel() {
      return state.fieldComponent === "hz" ? "TEz / Hz" : "TMz / Ez";
    }

    function transverseFieldLetter() {
      return state.fieldComponent === "hz" ? "E" : "H";
    }

    function transverseFieldUnitHtml() {
      return `<i>${transverseFieldLetter()}</i><sub>0</sub>`;
    }

    function fieldComponentHtml(letter, component = "") {
      return `<i>${letter}</i>${component ? `<sub>${component}</sub>` : ""}`;
    }

    function fieldDisplayConfig(display = state.fieldDisplay) {
      const scalarLetter = simulatedFieldLetter();
      const transverseLetter = transverseFieldLetter();
      const scalarUnit = simulatedFieldUnitHtml();
      const transverseUnit = transverseFieldUnitHtml();
      const configs = {
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
      if (state.viewMode === "poynting") {
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
        return poyntingConfigs[display] || poyntingConfigs.scalar;
      }
      return configs[display] || configs.scalar;
    }

    function currentSourceLetter() {
      return state.fieldComponent === "hz" ? "M" : "J";
    }

    function sourceShapeLabel(shape) {
      const sourceLetter = currentSourceLetter();
      const dipoleKind = state.fieldComponent === "hz" ? "magnetic" : "electric";
      if (inPlaneElectricCurrentShapes.has(shape)) return "In-plane electric dipole Jx/Jy";
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
        modeProfile: "Guided mode profile",
      }[shape] || "Source";
    }

    function sourceCouplingLabel(shape) {
      if (inPlaneElectricCurrentShapes.has(shape)) return "in-plane electric current";
      if (circularDipoleSourceShapes.has(shape)) return "quadrature dipole";
      if (shape === "janusDipole") return "quadrature Janus pair";
      if (shape === "huygens") return "cardioid Huygens pair";
      if (shape === "evanescentLine") return "evanescent incident field";
      if (shape === "modeProfile") return "finite-difference guided mode";
      return incidentFieldSourceShapes.has(shape) ? "incident field" : `out-of-plane ${currentSourceLetter()}z`;
    }

    function sourceSummaryLabel() {
      if (state.sources.length === 1) {
        return `${sourceShapeLabel(state.sources[0].shape)} \u00b7 ${sourceCouplingLabel(state.sources[0].shape)}`;
      }
      return `${state.sources.length} sources`;
    }

    function currentBrushLabel() {
      if (state.brush === "custom" && state.materialBianisotropyEnabled) return "Custom magnetoelectric kappa_n";
      if (state.brush === "custom" && state.materialGyrotropyEnabled) return "Custom gyrotropic epsilon tensor";
      return state.brush === "custom" && state.customAnisotropic ? "Custom anisotropic epsilon, mu" : materialNames[state.brush];
    }

    function monitorQuantityLabel(quantity) {
      return {
        scalar: `${scalarFieldComponentKey()} mean`,
        magnitude: `mean |${scalarFieldComponentKey()}|`,
        normalFlux: "normal flux",
        tangentFlux: "tangential flux",
      }[quantity] || `${scalarFieldComponentKey()} mean`;
    }

    function formatLambda(value) {
      return Number(value).toFixed(2);
    }

    function formatCompactLambda(value) {
      return Number(value)
        .toFixed(1)
        .replace(/\.0$/, "");
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

    function trimFixed(value, digits) {
      return value.toFixed(digits).replace(/\.?0+$/, "");
    }

    function formatScaleBarValue(value) {
      if (Math.abs(value) >= 10 || Number.isInteger(value)) return value.toFixed(0);
      if (Math.abs(value) >= 1) return trimFixed(value, 1);
      if (Math.abs(value) >= 0.01) return trimFixed(value, 2);
      return value.toExponential(1);
    }

    function niceScaleLength(visibleLambdaWidth) {
      const target = Math.max(visibleLambdaWidth * 0.18, 1e-9);
      const exponent = Math.floor(Math.log10(target));
      const base = Math.pow(10, exponent);
      const normalized = target / base;
      if (normalized <= 1) return base;
      if (normalized <= 2) return 2 * base;
      if (normalized <= 5) return 5 * base;
      return 10 * base;
    }

    return {
      simulatedFieldLetter,
      simulatedFieldComponentHtml,
      simulatedFieldUnitHtml,
      scalarFieldComponentKey,
      solverModeLabel,
      transverseFieldLetter,
      transverseFieldUnitHtml,
      fieldComponentHtml,
      fieldDisplayConfig,
      currentSourceLetter,
      sourceShapeLabel,
      sourceCouplingLabel,
      sourceSummaryLabel,
      currentBrushLabel,
      monitorQuantityLabel,
      niceScaleLength,
      formatScaleBarValue,
      trimFixed,
      formatLambda,
      formatCompactLambda,
      formatLambdaOutput,
      formatTimeRate,
      formatSpeed,
    };
  }

  global.FdtdAppFormatters = {
    createAppFormatters,
  };
})(window);
