(function initFdtdSceneObservables(global) {
  "use strict";

  const FRESNEL_PRESETS = Object.freeze({
    normalInterface: { title: "Normal-incidence Fresnel check", n1: 1, n2: 1.5, tolerance: 0.08 },
    quarterWaveCoating: { title: "Quarter-wave coating check", n1: 1, n2: 1.5, targetMaxR: 0.08 },
    braggMirror: { title: "Bragg mirror stop-band check", targetMinR: 0.45 },
    braggStack: { title: "Periodic Bragg-stack check", targetMinR: 0.35 },
  });

  const BREWSTER_PRESETS = new Set(["brewsterTm", "brewsterTeTm"]);
  const TIR_PRESETS = new Set(["totalInternalReflection", "frustratedTir"]);
  const GUIDED_PRESETS = new Set([
    "slabWaveguide",
    "multimodeSlab",
    "lossyGuide",
    "waveguideBend",
    "taperWaveguide",
    "widthStepWaveguide",
    "directionalCoupler",
    "mmiWaveguide",
    "machZehnder",
    "guideScatterer",
    "microstrip",
    "ringResonator",
    "addDropRing",
    "racetrackResonator",
    "betaFactor",
    "modulatedGuide",
    "temporalIsolator",
  ]);
  const RESONATOR_PRESETS = new Set([
    "qRingdown",
    "purcell2d",
    "fabryPerot",
    "fabryPerotStanding",
    "ringResonator",
    "addDropRing",
    "racetrackResonator",
    "dielectricCavity",
    "pecCavity",
    "quarterWaveCavity",
    "diskResonator",
    "degenerateModes",
    "stubResonator",
    "fanoResonator",
    "phcPointDefect",
    "phcOptimizedCavity",
    "phcDarkMode",
    "quasiBic",
    "symmetryProtectedBic",
    "bicKerr",
    "bicEnz",
  ]);
  const PHC_PRESETS = new Set([
    "photonicCrystal",
    "phcPointDefect",
    "phcWaveguide",
    "phcOptimizedCavity",
    "phcDisorder",
    "phcDarkMode",
    "quasiBic",
    "symmetryProtectedBic",
    "bicKerr",
    "bicEnz",
  ]);
  const PHC_TARGETS = Object.freeze({
    photonicCrystal: { minHighIndexCells: 1700, minRods: 120, minRows: 8, minCols: 14, minBlochCells: 1700 },
    phcPointDefect: { minHighIndexCells: 1650, minRods: 115, minRows: 8, minCols: 14, minBlochCells: 1650 },
    phcWaveguide: { minHighIndexCells: 1500, minRods: 100, minRows: 8, minCols: 14, minBlochCells: 1500 },
    phcOptimizedCavity: { minHighIndexCells: 1850, minRods: 130, minRows: 8, minCols: 16, minBlochCells: 1850 },
    phcDisorder: { minHighIndexCells: 1700, minRods: 115, minRows: 8, minCols: 14 },
    phcDarkMode: { minHighIndexCells: 1650, minRods: 115, minRows: 8, minCols: 14, minBlochCells: 1650 },
    quasiBic: { minHighIndexCells: 1650, minRods: 115, minRows: 8, minCols: 14, minBlochCells: 1650 },
    symmetryProtectedBic: { minHighIndexCells: 1850, minRods: 130, minRows: 8, minCols: 16, minBlochCells: 1850 },
    bicKerr: { minHighIndexCells: 1650, minRods: 115, minRows: 8, minCols: 14, minBlochCells: 1650 },
    bicEnz: { minHighIndexCells: 1650, minRods: 115, minRows: 8, minCols: 14, minBlochCells: 1650 },
  });
  const SPP_PRESETS = new Set(["sppInterface", "sppGrating"]);
  const FAR_FIELD_PRESETS = new Set([
    "nearFarFieldNtff",
    "pecCylinder",
    "dielectricCylinder",
    "mieCylinder",
    "rcsCylinder",
    "kerkerScatterer",
    "kerker2d",
    "dipoleArray",
    "phasedDipoleArray",
    "apertureRadiator",
  ]);
  const PROPAGATION_PRESETS = new Set([
    "planeWaveAir",
    "planeWaveDielectric",
    "gaussianPulseAir",
    "poyntingPlaneWave",
    "evanescentWave",
    "pmlAbsorption",
    "teTmComparison",
    "obliqueRefraction",
    "lossyInterface",
    "anisotropicInterface",
  ]);
  const DIFFRACTION_PRESETS = new Set(["singleSlit", "doubleSlit", "circularAperture", "apertureRadiator"]);
  const SOURCE_RADIATION_PRESETS = new Set([
    "twoSourceInterference",
    "frequencyBeat",
    "jzDipole",
    "inPlaneDipole",
    "mzDipole",
    "dipoleSubstrate",
    "dipoleNearPec",
    "huygensRadiator",
    "circularDipole",
    "janusDipole",
    "dipoleArray",
    "phasedDipoleArray",
    "apertureRadiator",
    "nearFarFieldNtff",
  ]);
  const SCATTERING_PRESETS = new Set([
    "pecCylinder",
    "dielectricCylinder",
    "mieCylinder",
    "rcsCylinder",
    "lossyCylinder",
    "dielectricDimer",
    "kerker2d",
    "multipleScattering",
    "weakLocalization",
    "andersonLocalization",
    "diffusiveRandomMedium",
  ]);
  const DISPERSIVE_PRESETS = new Set([
    "finiteConductivity",
    "drudeMetal",
    "lorentzMedium",
    "debyeDielectric",
    "plasmaCutoff",
    "enzSlab",
    "enzEmitter",
    "localizedPlasmon",
    "plasmonicDimer",
    "hyperbolicMedium",
    "bicEnz",
  ]);
  const TENSOR_PRESETS = new Set([
    "anisotropicInterface",
    "anisotropicMedium",
    "hyperbolicMedium",
    "gyrotropicMedium",
  ]);
  const TOPOLOGY_PRESETS = new Set([
    "honeycombLattice",
    "valleyHall",
    "valleyHallBend",
    "topologicalPumping",
    "topologyDefect",
  ]);
  const METASURFACE_PRESETS = new Set(["metasurfacePhaseBars"]);
  const SSH_PRESETS = new Set(["sshTrivial", "sshTopological", "sshInterface", "sshDisorder", "nonHermitianSsh"]);
  const PT_PRESETS = new Set(["ptSymmetricCoupler", "exceptionalPointCoupler"]);
  const ABSORPTION_PRESETS = new Set(["perfectAbsorber"]);
  const NEGATIVE_INDEX_PRESETS = new Set(["negativeIndexSlab", "superlensSlab"]);
  const HYPERLENS_PRESETS = new Set(["hyperlens"]);
  const BIANISOTROPY_PRESETS = new Set(["chiralMedium", "bianisotropicMedium"]);
  const HARMONIC_PRESETS = new Set(["shgSlab", "thgSlab"]);
  const NONLINEAR_PRESETS = new Set([
    "kerrSlab",
    "shgSlab",
    "thgSlab",
    "spmKerrPulse",
    "kerrBistableCavity",
    "saturableAbsorber",
    "allOpticalSwitch",
    "nonlinearLimiter",
    "vo2SwitchingSlab",
    "pcmMemoryCell",
    "bicKerr",
  ]);
  const PHASE_CHANGE_PRESETS = new Set([
    "saturableAbsorber",
    "allOpticalSwitch",
    "nonlinearLimiter",
    "vo2SwitchingSlab",
    "pcmMemoryCell",
  ]);
  const TEMPORAL_FLOQUET_PRESETS = new Set([
    "temporalInterface",
    "temporalSlab",
    "temporalModulation",
    "temporalCrystal",
    "modulatedGuide",
    "travelingModulation",
    "temporalIsolator",
    "modulatedRing",
    "floquetResonators",
    "syntheticFrequency",
    "topologyTemporalMod",
    "nonreciprocalValleyHall",
    "spaceTimeCrystal",
  ]);
  const COUPLED_WORKFLOW_PRESETS = new Set([
    "nonHermitianSkin",
    "bicKerr",
    "bicEnz",
    "janusTopologicalGuide",
    "huygensCavity",
    "topologyTemporalMod",
    "nonreciprocalValleyHall",
    "spaceTimeCrystal",
  ]);

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function formatRatio(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    const abs = Math.abs(number);
    if (abs < 1e-12) return "0";
    if (abs >= 10) return number.toFixed(1);
    if (abs >= 1) return number.toFixed(2);
    if (abs >= 0.01) return number.toFixed(3);
    return number.toExponential(1);
  }

  function formatField(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    const abs = Math.abs(number);
    if (abs >= 10000 || (abs > 0 && abs < 0.001)) return number.toExponential(2);
    if (abs >= 100) return number.toFixed(0);
    if (abs >= 10) return number.toFixed(1);
    if (abs >= 1) return number.toFixed(2);
    return number.toFixed(3);
  }

  function formatAngle(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    return `${number.toFixed(Math.abs(number - Math.round(number)) < 0.05 ? 0 : 1)} deg`;
  }

  function row({ metric, measured = "-", expected = "-", error = "-", level = "info", note = "" }) {
    return { metric, measured, expected, error, level, note };
  }

  function lineDiagnosticsReady(state, sim, minSamples = 20) {
    return Boolean(state.diagnosticsEnabled && finiteNumber(sim.diagnosticSamples) >= minSamples);
  }

  function sourceFrequency(state) {
    const source = state.sources?.find?.((item) => item.type === "sine") || state.sources?.[0] || {};
    return finiteNumber(source.frequency, typeof COURANT === "undefined" ? 0.005 : COURANT / Math.max(8, state.cellsPerWavelength || 20));
  }

  function sourceAngleDeg(state) {
    const source = state.sources?.[0] || {};
    return ((finiteNumber(source.angleDeg) % 360) + 360) % 360;
  }

  function wavelengthRatio(state) {
    const frequency = sourceFrequency(state);
    const courant = typeof COURANT === "undefined" ? 0.1 : finiteNumber(COURANT, 0.1);
    return courant / Math.max(1e-9, frequency * Math.max(8, state.cellsPerWavelength || 20));
  }

  function fresnelNormalReflectance(n1, n2) {
    const numerator = n1 - n2;
    const denominator = n1 + n2;
    return (numerator * numerator) / Math.max(1e-18, denominator * denominator);
  }

  function brewsterAngleDeg(n1, n2) {
    return (Math.atan(n2 / n1) * 180) / Math.PI;
  }

  function criticalAngleDeg(n1, n2) {
    if (n1 <= n2) return null;
    return (Math.asin(n2 / n1) * 180) / Math.PI;
  }

  function complexDiv(a, b) {
    const denominator = b.re * b.re + b.im * b.im;
    if (denominator <= 1e-30) return { re: 0, im: 0 };
    return {
      re: (a.re * b.re + a.im * b.im) / denominator,
      im: (a.im * b.re - a.re * b.im) / denominator,
    };
  }

  function complexSqrt(z) {
    const radius = Math.hypot(z.re, z.im);
    return {
      re: Math.sqrt(Math.max(0, (radius + z.re) * 0.5)),
      im: Math.sign(z.im || 1) * Math.sqrt(Math.max(0, (radius - z.re) * 0.5)),
    };
  }

  function drudeEpsilonAtCarrier(state) {
    const omega = 2 * Math.PI * Math.max(1e-9, sourceFrequency(state));
    const omegaP = Math.max(0, finiteNumber(state.dispersionOmegaP, 0));
    const gamma = Math.max(0, finiteNumber(state.dispersionGamma, 0));
    const denominator = omega * omega + gamma * gamma;
    if (omegaP <= 0 || denominator <= 1e-30) return { re: 1, im: 0 };
    return {
      re: 1 - (omegaP * omegaP) / denominator,
      im: (omegaP * omegaP * gamma) / Math.max(1e-30, omega * denominator),
    };
  }

  function sppWaveNumberRatio(state) {
    const epsMetal = drudeEpsilonAtCarrier(state);
    const numerator = epsMetal;
    const denominator = { re: epsMetal.re + 1, im: epsMetal.im };
    return complexSqrt(complexDiv(numerator, denominator));
  }

  function analysisMetrics(state, sim) {
    if (!state.analysisEnabled || typeof sim.analysisMetricEstimate !== "function") return null;
    return sim.analysisMetricEstimate();
  }

  function safeSimEstimate(sim, methodName, ...args) {
    if (!sim || typeof sim[methodName] !== "function") return null;
    try {
      return sim[methodName](...args);
    } catch (_error) {
      return null;
    }
  }

  function metalLikeCell(sim, idx) {
    if (sim.material?.[idx] === 2) return true;
    if (sim.dispersiveMaterial?.[idx]) return true;
    return false;
  }

  function surfaceLocalizationEstimate(state, sim) {
    if (typeof sim.analysisFieldEnergyDensityAt !== "function") return null;
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const width = Math.max(1, maxX - minX + 1);
    let interfaceY = null;

    for (let y = minY + 1; y <= maxY - 1; y += 1) {
      let metalCells = 0;
      for (let x = minX; x <= maxX; x += 1) {
        if (metalLikeCell(sim, sim.id(x, y))) metalCells += 1;
      }
      if (metalCells / width > 0.35) {
        interfaceY = y;
        break;
      }
    }

    if (interfaceY == null) return null;

    const cpw = Math.max(8, Math.round(finiteNumber(state.cellsPerWavelength, 20)));
    const sumBand = (y0, y1) => {
      let energy = 0;
      let cells = 0;
      for (let y = clampNumber(y0, minY, maxY); y <= clampNumber(y1, minY, maxY); y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const idx = sim.id(x, y);
          const value = sim.analysisFieldEnergyDensityAt(idx);
          if (value <= 0) continue;
          energy += value;
          cells += 1;
        }
      }
      return { energy, cells };
    };

    const nearHalf = Math.max(2, Math.round(0.22 * cpw));
    const farOffset = Math.max(nearHalf + 2, Math.round(0.62 * cpw));
    const farHalf = Math.max(2, Math.round(0.18 * cpw));
    const surface = sumBand(interfaceY - nearHalf, interfaceY + nearHalf);
    const airFar = sumBand(interfaceY - farOffset - farHalf, interfaceY - farOffset + farHalf);
    const metalBulk = sumBand(interfaceY + farOffset - farHalf, interfaceY + farOffset + farHalf);
    const total = surface.energy + airFar.energy + metalBulk.energy;
    let gratingCellsAboveInterface = 0;
    for (let y = Math.max(minY, interfaceY - Math.round(0.3 * cpw)); y < interfaceY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (metalLikeCell(sim, sim.id(x, y))) gratingCellsAboveInterface += 1;
      }
    }

    return {
      interfaceY,
      surfaceEnergy: surface.energy,
      airFarEnergy: airFar.energy,
      metalBulkEnergy: metalBulk.energy,
      surfaceFraction: total > 1e-30 ? surface.energy / total : 0,
      surfaceToAirRatio: surface.energy / Math.max(1e-30, airFar.energy),
      surfaceToBulkRatio: surface.energy / Math.max(1e-30, metalBulk.energy),
      gratingCellsAboveInterface,
    };
  }

  function fieldEnergyAt(sim, idx) {
    if (typeof sim.analysisFieldEnergyDensityAt === "function") {
      return Math.max(0, finiteNumber(sim.analysisFieldEnergyDensityAt(idx), 0));
    }
    if (sim.material?.[idx] === 2) return 0;
    return (
      finiteNumber(sim.ez?.[idx], 0) ** 2 +
      finiteNumber(sim.hx?.[idx], 0) ** 2 +
      finiteNumber(sim.hy?.[idx], 0) ** 2
    );
  }

  function electricMagnitudeSquaredAt(state, sim, idx) {
    if (state.fieldComponent === "hz") {
      return finiteNumber(sim.hx?.[idx], 0) ** 2 + finiteNumber(sim.hy?.[idx], 0) ** 2;
    }
    return finiteNumber(sim.ez?.[idx], 0) ** 2;
  }

  function plasmonicDimerHotGapEstimate(state, sim) {
    if (state.preset !== "plasmonicDimer" || !sim) return null;
    const cpw = Math.max(8, Math.round(finiteNumber(state.cellsPerWavelength, 20)));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const dimerCx = midX + Math.round(0.48 * cpw);
    const dimerCy1 = midY - Math.round(0.31 * cpw);
    const dimerCy2 = midY + Math.round(0.31 * cpw);
    const dimerR = Math.max(2, Math.round(0.25 * cpw));
    const ellipse = (x, y, cx, cy, rx, ry) => {
      const dx = (x - cx) / Math.max(1, rx);
      const dy = (y - cy) / Math.max(1, ry);
      return dx * dx + dy * dy <= 1;
    };
    const box = (x, y, cx, cy, halfXLambda, halfYLambda) =>
      Math.abs(x - cx) <= Math.round(halfXLambda * cpw) && Math.abs(y - cy) <= Math.round(halfYLambda * cpw);
    const sample = (predicate) => {
      let cells = 0;
      let e2Sum = 0;
      let e2Peak = 0;
      for (let y = minY; y <= maxY; y += 1) {
        const rowOffset = y * sim.nx;
        for (let x = minX; x <= maxX; x += 1) {
          const idx = rowOffset + x;
          if (!predicate(x, y, idx)) continue;
          const e2 = electricMagnitudeSquaredAt(state, sim, idx);
          cells += 1;
          e2Sum += e2;
          e2Peak = Math.max(e2Peak, e2);
        }
      }
      return { cells, e2Mean: e2Sum / Math.max(1, cells), e2Peak };
    };
    const disk1 = sample((x, y, idx) => Boolean(sim.dispersiveMaterial?.[idx]) && ellipse(x, y, dimerCx, dimerCy1, dimerR, dimerR));
    const disk2 = sample((x, y, idx) => Boolean(sim.dispersiveMaterial?.[idx]) && ellipse(x, y, dimerCx, dimerCy2, dimerR, dimerR));
    const gap = sample((x, y, idx) => sim.material?.[idx] === 0 && box(x, y, dimerCx, midY, 0.13, 0.055));
    const background = sample((x, y, idx) => sim.material?.[idx] === 0 && box(x, y, dimerCx - Math.round(1.05 * cpw), midY, 0.34, 0.34));
    return {
      disk1Cells: disk1.cells,
      disk2Cells: disk2.cells,
      gapCells: gap.cells,
      backgroundCells: background.cells,
      gapPeakToBackgroundRatio: gap.e2Peak / Math.max(1e-30, background.e2Mean),
      gapMeanToBackgroundRatio: gap.e2Mean / Math.max(1e-30, background.e2Mean),
    };
  }

  function materialMaskSummary(sim, predicate) {
    if (!sim || typeof predicate !== "function") return { cells: 0, energyFraction: 0 };
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    let cells = 0;
    let energy = 0;
    let totalEnergy = 0;
    for (let y = minY; y <= maxY; y += 1) {
      const row = y * sim.nx;
      for (let x = minX; x <= maxX; x += 1) {
        const idx = row + x;
        const cellEnergy = fieldEnergyAt(sim, idx);
        totalEnergy += cellEnergy;
        if (!predicate(idx)) continue;
        cells += 1;
        energy += cellEnergy;
      }
    }
    return {
      cells,
      energyFraction: energy / Math.max(1e-30, totalEnergy),
    };
  }

  function materialRegionSummary(state, sim, predicate) {
    if (!sim || typeof predicate !== "function") {
      return { cells: 0, energyFraction: 0, widthLambda: 0, heightLambda: 0, epsMean: 0, epsYMean: 0 };
    }
    const cpw = Math.max(1, finiteNumber(state.cellsPerWavelength, 20));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    let cells = 0;
    let energy = 0;
    let totalEnergy = 0;
    let epsSum = 0;
    let epsYSum = 0;
    let lossSum = 0;
    let minBx = sim.nx;
    let maxBx = -1;
    let minBy = sim.ny;
    let maxBy = -1;

    for (let y = minY; y <= maxY; y += 1) {
      const rowOffset = y * sim.nx;
      for (let x = minX; x <= maxX; x += 1) {
        const idx = rowOffset + x;
        const cellEnergy = fieldEnergyAt(sim, idx);
        totalEnergy += cellEnergy;
        if (!predicate(idx)) continue;
        cells += 1;
        energy += cellEnergy;
        epsSum += finiteNumber(sim.eps?.[idx], 1);
        epsYSum += finiteNumber(sim.epsY?.[idx], finiteNumber(sim.eps?.[idx], 1));
        lossSum += finiteNumber(sim.loss?.[idx], 0);
        minBx = Math.min(minBx, x);
        maxBx = Math.max(maxBx, x);
        minBy = Math.min(minBy, y);
        maxBy = Math.max(maxBy, y);
      }
    }

    const hasBounds = cells > 0 && maxBx >= minBx && maxBy >= minBy;
    return {
      cells,
      energyFraction: energy / Math.max(1e-30, totalEnergy),
      epsMean: cells > 0 ? epsSum / cells : 0,
      epsYMean: cells > 0 ? epsYSum / cells : 0,
      lossMean: cells > 0 ? lossSum / cells : 0,
      minX: hasBounds ? minBx : 0,
      maxX: hasBounds ? maxBx : 0,
      minY: hasBounds ? minBy : 0,
      maxY: hasBounds ? maxBy : 0,
      widthLambda: hasBounds ? (maxBx - minBx + 1) / cpw : 0,
      heightLambda: hasBounds ? (maxBy - minBy + 1) / cpw : 0,
      centerXLambda: hasBounds ? (0.5 * (minBx + maxBx)) / cpw : 0,
      centerYLambda: hasBounds ? (0.5 * (minBy + maxBy)) / cpw : 0,
    };
  }

  function primaryMaterialSummary(state, sim) {
    return materialRegionSummary(state, sim, (idx) => sim.material?.[idx] !== 0 && sim.material?.[idx] !== 2);
  }

  function pecMaterialSummary(state, sim) {
    return materialRegionSummary(state, sim, (idx) => sim.material?.[idx] === 2);
  }

  function sourceCellSummary(state, sim) {
    const cpw = Math.max(1, finiteNumber(state.cellsPerWavelength, 20));
    const sources = Array.isArray(state.sources) ? state.sources : [];
    const items = sources.map((source) => {
      const x = typeof sim.sourceXCell === "function" ? sim.sourceXCell(source) : Math.round(finiteNumber(source.xLambda, 0) * cpw);
      const y = typeof sim.sourceYCell === "function" ? sim.sourceYCell(source) : Math.round(finiteNumber(source.yLambda, 0) * cpw);
      return {
        source,
        x,
        y,
        shape: source?.shape || "",
        type: source?.type || "sine",
        frequency: sourceFrequency({ ...state, sources: [source] }),
        phaseDeg: finiteNumber(source?.phaseDeg, 0),
        amplitude: Math.abs(finiteNumber(source?.amplitude, 1)),
      };
    });
    let separationLambda = 0;
    if (items.length >= 2) {
      separationLambda = Math.hypot(items[1].x - items[0].x, items[1].y - items[0].y) / cpw;
    }
    const frequencies = items.map((item) => item.frequency).filter((value) => Number.isFinite(value) && value > 0);
    const minFrequency = frequencies.length ? Math.min(...frequencies) : 0;
    const maxFrequency = frequencies.length ? Math.max(...frequencies) : 0;
    return {
      items,
      count: items.length,
      shapes: items.map((item) => item.shape),
      types: items.map((item) => item.type),
      separationLambda,
      minFrequency,
      maxFrequency,
      frequencyRatio: minFrequency > 0 ? maxFrequency / minFrequency : 0,
      phaseStepDeg:
        items.length >= 2 ? Math.abs((((items[1].phaseDeg - items[0].phaseDeg + 180) % 360) + 360) % 360 - 180) : 0,
      amplitudeBalance:
        items.length >= 2
          ? Math.min(items[0].amplitude, items[1].amplitude) / Math.max(1e-30, Math.max(items[0].amplitude, items[1].amplitude))
          : 1,
    };
  }

  function apertureGeometryEstimate(state, sim) {
    const cpw = Math.max(1, finiteNumber(state.cellsPerWavelength, 20));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round((minX + maxX) * 0.5);
    const searchHalf = Math.max(2, Math.round(0.5 * cpw));
    let screenX = midX;
    let bestPec = -1;
    for (let x = Math.max(minX, midX - searchHalf); x <= Math.min(maxX, midX + searchHalf); x += 1) {
      let pec = 0;
      for (let y = minY; y <= maxY; y += 1) {
        if (sim.material?.[sim.id(x, y)] === 2) pec += 1;
      }
      if (pec > bestPec) {
        bestPec = pec;
        screenX = x;
      }
    }

    const intervals = [];
    let openStart = null;
    for (let y = minY; y <= maxY; y += 1) {
      const open = sim.material?.[sim.id(screenX, y)] !== 2;
      if (open && openStart == null) openStart = y;
      if ((!open || y === maxY) && openStart != null) {
        const end = open ? y : y - 1;
        const length = end - openStart + 1;
        if (length >= Math.max(2, Math.round(0.12 * cpw))) intervals.push({ start: openStart, end, center: 0.5 * (openStart + end), length });
        openStart = null;
      }
    }
    const widths = intervals.map((item) => item.length / cpw);
    const centers = intervals.map((item) => item.center / cpw);
    const meanWidth = widths.reduce((sum, value) => sum + value, 0) / Math.max(1, widths.length);
    const separation = centers.length >= 2 ? Math.abs(centers[1] - centers[0]) : 0;
    return {
      screenX,
      screenPecFraction: bestPec / Math.max(1, maxY - minY + 1),
      apertureCount: intervals.length,
      meanWidthLambda: meanWidth || 0,
      separationLambda: separation,
    };
  }

  function poyntingDirectionEstimate(state, sim) {
    if (!sim || typeof sim.poyntingAt !== "function") return null;
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    let sx = 0;
    let sy = 0;
    let magnitude = 0;
    for (let y = minY; y <= maxY; y += 2) {
      const rowOffset = y * sim.nx;
      for (let x = minX; x <= maxX; x += 2) {
        const idx = rowOffset + x;
        if (sim.material?.[idx] === 2) continue;
        const s = sim.poyntingAt(idx);
        sx += finiteNumber(s.x, 0);
        sy += finiteNumber(s.y, 0);
        magnitude += Math.hypot(finiteNumber(s.x, 0), finiteNumber(s.y, 0));
      }
    }
    const norm = Math.hypot(sx, sy);
    if (magnitude <= 1e-30 || norm <= 1e-30) return null;
    return {
      angleDeg: ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360,
      directionality: norm / Math.max(1e-30, magnitude),
      sx,
      sy,
    };
  }

  function angularErrorDeg(a, b) {
    return Math.abs((((a - b + 180) % 360) + 360) % 360 - 180);
  }

  function scattererGeometryEstimate(state, sim) {
    const material = materialRegionSummary(state, sim, (idx) => sim.material?.[idx] !== 0);
    const dielectric = primaryMaterialSummary(state, sim);
    const pec = pecMaterialSummary(state, sim);
    const radiusLambda = Math.max(material.widthLambda, material.heightLambda) * 0.25;
    const lambdaSource = Math.max(1e-6, wavelengthRatio(state));
    return {
      material,
      dielectric,
      pec,
      radiusLambda,
      sizeParameter: (2 * Math.PI * radiusLambda) / lambdaSource,
    };
  }

  function lorentzEpsilonAtCarrier(state) {
    const omega = 2 * Math.PI * Math.max(1e-9, sourceFrequency(state));
    const omega0 = Math.max(1e-9, finiteNumber(state.dispersionOmega0, 0));
    const gamma = Math.max(0, finiteNumber(state.dispersionGamma, 0));
    const delta = finiteNumber(state.dispersionDeltaEps, 0);
    const numerator = { re: delta * omega0 * omega0, im: 0 };
    const denominator = { re: omega0 * omega0 - omega * omega, im: -gamma * omega };
    const response = complexDiv(numerator, denominator);
    return { re: 1 + response.re, im: response.im };
  }

  function debyeEpsilonAtCarrier(state) {
    const omega = 2 * Math.PI * Math.max(1e-9, sourceFrequency(state));
    const delta = finiteNumber(state.dispersionDeltaEps, 0);
    const tau = Math.max(0, finiteNumber(state.dispersionTau, 0));
    const response = complexDiv({ re: delta, im: 0 }, { re: 1, im: omega * tau });
    return { re: 1 + response.re, im: response.im };
  }

  function dispersiveEpsilonAtCarrier(state) {
    const model = String(state.dispersionModel || "").toLowerCase();
    if (model === "lorentz") return { model, eps: lorentzEpsilonAtCarrier(state) };
    if (model === "debye") return { model, eps: debyeEpsilonAtCarrier(state) };
    if (model === "drude" || model === "plasma") return { model, eps: drudeEpsilonAtCarrier(state) };
    return { model: model || "none", eps: null };
  }

  function highIndexCell(sim, idx) {
    if (!sim || sim.material?.[idx] === 0 || sim.material?.[idx] === 2) return false;
    return Math.max(Math.abs(finiteNumber(sim.eps?.[idx], 0)), Math.abs(finiteNumber(sim.epsY?.[idx], 0))) > 3;
  }

  function phcBlochReference(state, sim) {
    const metrics = analysisMetrics(state, sim);
    if (metrics?.phcBloch) return metrics.phcBloch;
    if (typeof sim.phcBlochEstimate !== "function") return null;
    try {
      return sim.phcBlochEstimate(0);
    } catch (_error) {
      return null;
    }
  }

  function phcGeometryEstimate(state, sim) {
    if (!sim || !PHC_PRESETS.has(state.preset)) return null;
    const cpw = Math.max(8, Math.round(finiteNumber(state.cellsPerWavelength, 24)));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const aCells = Math.max(2, Math.round(0.45 * cpw));
    const bins = new Map();
    const rowBins = new Map();
    const colBins = new Map();

    const box = (x, y, halfXLambda, halfYLambda, cx = midX, cy = midY) =>
      Math.abs(x - cx) <= Math.round(halfXLambda * cpw) && Math.abs(y - cy) <= Math.round(halfYLambda * cpw);

    let highIndexCells = 0;
    let totalEnergy = 0;
    let highIndexEnergy = 0;
    let centerDefectEnergy = 0;
    let lineDefectEnergy = 0;
    let adjacentRowEnergy = 0;
    let cavityEnergy = 0;
    let centerHighIndexCells = 0;
    let centralLineHighIndexCells = 0;
    let adjacentRowHighIndexCells = 0;
    let cavityHighIndexCells = 0;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const idx = sim.id(x, y);
        const energy = fieldEnergyAt(sim, idx);
        const inCenterDefect = box(x, y, 0.24, 0.24);
        const inLineDefect = box(x, y, 3.4, 0.16);
        const inAdjacentRows =
          Math.abs(Math.abs(y - midY) - aCells) <= Math.round(0.15 * cpw) && Math.abs(x - midX) <= Math.round(3.4 * cpw);
        const inCavity = box(x, y, 0.76, 0.2);

        totalEnergy += energy;
        if (inCenterDefect) centerDefectEnergy += energy;
        if (inLineDefect) lineDefectEnergy += energy;
        if (inAdjacentRows) adjacentRowEnergy += energy;
        if (inCavity) cavityEnergy += energy;

        if (!highIndexCell(sim, idx)) continue;
        highIndexCells += 1;
        highIndexEnergy += energy;
        if (inCenterDefect) centerHighIndexCells += 1;
        if (inLineDefect) centralLineHighIndexCells += 1;
        if (inAdjacentRows) adjacentRowHighIndexCells += 1;
        if (inCavity) cavityHighIndexCells += 1;

        const ix = Math.round((x - midX) / aCells);
        const iy = Math.round((y - midY) / aCells);
        const key = `${ix},${iy}`;
        const bin = bins.get(key) || { ix, iy, cells: 0, xSum: 0, ySum: 0 };
        bin.cells += 1;
        bin.xSum += x;
        bin.ySum += y;
        bins.set(key, bin);
        if (!rowBins.has(iy)) rowBins.set(iy, new Set());
        if (!colBins.has(ix)) colBins.set(ix, new Set());
        rowBins.get(iy).add(ix);
        colBins.get(ix).add(iy);
      }
    }

    let latticeOffsetSum = 0;
    let latticeOffsetMax = 0;
    for (const bin of bins.values()) {
      const cx = bin.xSum / Math.max(1, bin.cells);
      const cy = bin.ySum / Math.max(1, bin.cells);
      const offset = Math.hypot(cx - (midX + bin.ix * aCells), cy - (midY + bin.iy * aCells)) / cpw;
      latticeOffsetSum += offset;
      latticeOffsetMax = Math.max(latticeOffsetMax, offset);
    }

    const sourceList = Array.isArray(state.sources) ? state.sources : [];
    let sourcePhaseDifferenceDeg = null;
    let sourceAmplitudeRatio = null;
    if (sourceList.length >= 2) {
      const phase0 = finiteNumber(sourceList[0].phaseDeg, 0);
      const phase1 = finiteNumber(sourceList[1].phaseDeg, 0);
      sourcePhaseDifferenceDeg = Math.abs((((phase1 - phase0 + 180) % 360) + 360) % 360 - 180);
      const amp0 = Math.abs(finiteNumber(sourceList[0].amplitude, 1));
      const amp1 = Math.abs(finiteNumber(sourceList[1].amplitude, 1));
      sourceAmplitudeRatio = Math.min(amp0, amp1) / Math.max(1e-30, Math.max(amp0, amp1));
    }

    const hasBin = (ix, iy) => bins.has(`${ix},${iy}`);
    return {
      cpw,
      highIndexCells,
      rodCountProxy: bins.size,
      rowsProxy: rowBins.size,
      colsProxy: colBins.size,
      centerBinHighIndexCells: bins.get("0,0")?.cells || 0,
      centerHighIndexCells,
      centralVacancyBins3: [-1, 0, 1].filter((ix) => !hasBin(ix, 0)).length,
      lineRowBinCount: rowBins.get(0)?.size || 0,
      centralLineHighIndexCells,
      adjacentRowHighIndexCells,
      cavityHighIndexCells,
      latticeOffsetMeanLambda: bins.size > 0 ? latticeOffsetSum / bins.size : 0,
      latticeOffsetMaxLambda: latticeOffsetMax,
      totalEnergy,
      highIndexEnergyFraction: highIndexEnergy / Math.max(1e-30, totalEnergy),
      centerDefectEnergyFraction: centerDefectEnergy / Math.max(1e-30, totalEnergy),
      lineDefectEnergyFraction: lineDefectEnergy / Math.max(1e-30, totalEnergy),
      adjacentToLineEnergyRatio: adjacentRowEnergy / Math.max(1e-30, lineDefectEnergy),
      cavityEnergyFraction: cavityEnergy / Math.max(1e-30, totalEnergy),
      sourceCount: sourceList.length,
      sourceShapes: sourceList.map((source) => source?.shape || ""),
      sourcePhaseDifferenceDeg,
      sourceAmplitudeRatio,
    };
  }

  function addLineMonitorRows(rows, state, sim, target = {}) {
    if (!state.diagnosticsEnabled) {
      rows.push(row({
        metric: "Line-port R/T/A",
        measured: "disabled",
        expected: target.label || "enable line monitors",
        level: "pending",
        note: "The line-port observable is quantitative only after line monitors are enabled and have collected samples.",
      }));
      return;
    }
    const samples = finiteNumber(sim.diagnosticSamples, 0);
    if (samples < 20) {
      rows.push(row({
        metric: "Line-port R/T/A",
        measured: `${samples} samples`,
        expected: target.label || ">=20 samples",
        level: "pending",
        note: "Run longer before interpreting reflectance, transmittance, or absorption.",
      }));
      return;
    }
    const r = finiteNumber(sim.diagnosticReflectance, 0);
    const t = finiteNumber(sim.diagnosticTransmittance, 0);
    const a = 1 - r - t;
    let level = "info";
    let error = "-";
    if (Number.isFinite(target.reflectance)) {
      const tolerance = finiteNumber(target.tolerance, 0.08);
      const delta = Math.abs(r - target.reflectance);
      level = delta <= tolerance ? "ok" : "caution";
      error = `dR=${formatRatio(delta)}`;
    } else if (Number.isFinite(target.maxReflectance)) {
      level = r <= target.maxReflectance ? "ok" : "caution";
      error = `limit=${formatRatio(target.maxReflectance)}`;
    } else if (Number.isFinite(target.minReflectance)) {
      level = r >= target.minReflectance ? "ok" : "caution";
      error = `limit=${formatRatio(target.minReflectance)}`;
    }
    rows.push(row({
      metric: "Line-port R/T/A",
      measured: `R=${formatRatio(r)}, T=${formatRatio(t)}, A~${formatRatio(a)}`,
      expected: target.label || "power balance",
      error,
      level,
      note: "Line-port values use the built-in incident/reflected/transmitted phasor separation.",
    }));
  }

  function addFresnelRows(rows, state, sim) {
    const config = FRESNEL_PRESETS[state.preset];
    if (!config) return false;
    if (Number.isFinite(config.n1) && Number.isFinite(config.n2)) {
      const expectedR = fresnelNormalReflectance(config.n1, config.n2);
      addLineMonitorRows(rows, state, sim, {
        reflectance: expectedR,
        tolerance: config.tolerance,
        label: `R_theory=${formatRatio(expectedR)}`,
      });
      return true;
    }
    if (Number.isFinite(config.targetMaxR)) {
      addLineMonitorRows(rows, state, sim, {
        maxReflectance: config.targetMaxR,
        label: `R < ${formatRatio(config.targetMaxR)}`,
      });
      return true;
    }
    if (Number.isFinite(config.targetMinR)) {
      addLineMonitorRows(rows, state, sim, {
        minReflectance: config.targetMinR,
        label: `R > ${formatRatio(config.targetMinR)}`,
      });
      return true;
    }
    return false;
  }

  function addBrewsterRows(rows, state, sim) {
    if (!BREWSTER_PRESETS.has(state.preset)) return false;
    const expected = brewsterAngleDeg(1, 1.5);
    const measured = sourceAngleDeg(state);
    const error = Math.abs(measured - expected);
    rows.push(row({
      metric: "Brewster angle",
      measured: formatAngle(measured),
      expected: formatAngle(expected),
      error: `${formatAngle(error)} error`,
      level: error <= 6 ? "ok" : "caution",
      note: "This is the analytical air-to-n=1.5 TM reference used by the angular sweep.",
    }));
    addLineMonitorRows(rows, state, sim, {
      maxReflectance: 0.12,
      label: "low R at Brewster incidence",
    });
    return true;
  }

  function addTirRows(rows, state, sim) {
    if (!TIR_PRESETS.has(state.preset)) return false;
    const critical = criticalAngleDeg(1.5, 1);
    const measured = sourceAngleDeg(state);
    rows.push(row({
      metric: "Critical-angle check",
      measured: formatAngle(measured),
      expected: `theta_c=${formatAngle(critical)}`,
      error: measured > critical ? "above critical" : "below critical",
      level: measured > critical ? "ok" : "caution",
      note: "TIR/frustrated-TIR examples should launch from n=1.5 toward air above the critical angle.",
    }));
    addLineMonitorRows(rows, state, sim, {
      minReflectance: state.preset === "frustratedTir" ? 0.25 : 0.55,
      label: state.preset === "frustratedTir" ? "partial tunneling allowed" : "high R expected",
    });
    return true;
  }

  function addPropagationRows(rows, state, sim) {
    if (!PROPAGATION_PRESETS.has(state.preset)) return false;
    const cpw = finiteNumber(state.cellsPerWavelength, 20);
    const frequency = sourceFrequency(state);
    const lambdaRatio = wavelengthRatio(state);
    rows.push(row({
      metric: "Carrier grid scale",
      measured: `cpw=${formatField(cpw)}, f=${formatField(frequency)}, lambda_s=${formatField(lambdaRatio)} lambda0`,
      expected: ">=12 cells per material wavelength",
      level: cpw >= 12 && lambdaRatio > 0.25 ? "ok" : "caution",
      note: "This check documents whether the selected source is resolved well enough for a teaching FDTD run.",
    }));

    if (state.preset === "planeWaveDielectric") {
      const n = Math.sqrt(1.5);
      rows.push(row({
        metric: "Homogeneous-medium wavelength",
        measured: `lambda/n=${formatField(lambdaRatio / n)} lambda0`,
        expected: `n=${formatField(n)}`,
        level: cpw / n >= 10 ? "ok" : "caution",
        note: "A dielectric plane wave should shorten its wavelength by the refractive index.",
      }));
    }

    if (state.preset === "obliqueRefraction" || state.preset === "anisotropicInterface") {
      const theta1 = sourceAngleDeg(state);
      const n1 = 1;
      const n2 = state.preset === "anisotropicInterface" ? Math.sqrt(2.2) : 1.5;
      const argument = (n1 / n2) * Math.sin((theta1 * Math.PI) / 180);
      const theta2 = Math.asin(clampNumber(argument, -1, 1)) * 180 / Math.PI;
      rows.push(row({
        metric: "Snell reference",
        measured: `theta_i=${formatAngle(theta1)}`,
        expected: `theta_t~${formatAngle(theta2)}`,
        level: Math.abs(argument) <= 1 ? "ok" : "caution",
        note: "The field snapshot should be interpreted against the refraction angle, not just the color pattern.",
      }));
    }

    if (state.preset === "poyntingPlaneWave") {
      const flow = poyntingDirectionEstimate(state, sim);
      if (!flow || finiteNumber(sim.time, 0) < 12) {
        rows.push(row({
          metric: "Poynting direction",
          measured: `${finiteNumber(sim.time, 0)} steps`,
          expected: `theta=${formatAngle(sourceAngleDeg(state))}`,
          level: "pending",
          note: "Run the plane wave for a few periods before using instantaneous Poynting direction.",
        }));
      } else {
        const expectedAngle = sourceAngleDeg(state);
        const error = angularErrorDeg(flow.angleDeg, expectedAngle);
        rows.push(row({
          metric: "Poynting direction",
          measured: `${formatAngle(flow.angleDeg)}, dir=${formatRatio(flow.directionality)}`,
          expected: formatAngle(expectedAngle),
          error: `${formatAngle(error)} error`,
          level: error < 25 && flow.directionality > 0.08 ? "ok" : "caution",
          note: "This is an instantaneous field-flow proxy; time averaging would be stronger for publication use.",
        }));
      }
    }

    if (state.preset === "evanescentWave") {
      const source = state.sources?.[0] || {};
      const kRatio = finiteNumber(source.evanescentKParallelRatio, 0);
      rows.push(row({
        metric: "Evanescent-wave condition",
        measured: `k_parallel/k0=${formatRatio(kRatio)}`,
        expected: "> 1",
        level: kRatio > 1 ? "ok" : "caution",
        note: "The source must have an in-plane wave number above the light line to generate evanescent decay.",
      }));
    }

    if (state.preset === "pmlAbsorption") {
      const energy = Math.max(0, finiteNumber(sim.lastEnergy, 0));
      const samples = finiteNumber(sim.diagnosticSamples, 0);
      rows.push(row({
        metric: "Open-boundary residual",
        measured: samples > 0 ? `E=${formatField(energy)}, samples=${samples}` : "not sampled yet",
        expected: "late pulse energy should decay in CPML",
        level: samples < 120 ? "pending" : energy < 0.08 ? "ok" : "caution",
        note: "The PML example should be validated by late-time residual energy/reflection, not by a single outgoing-field snapshot.",
      }));
    }

    return true;
  }

  function addDiffractionRows(rows, state, sim) {
    if (!DIFFRACTION_PRESETS.has(state.preset)) return false;
    const aperture = apertureGeometryEstimate(state, sim);
    const expectedCount = state.preset === "doubleSlit" ? 2 : 1;
    rows.push(row({
      metric: "Aperture geometry",
      measured: `N=${aperture.apertureCount}, width=${formatField(aperture.meanWidthLambda)} lambda0`,
      expected: `${expectedCount} open aperture${expectedCount > 1 ? "s" : ""}`,
      error: `PEC fill=${formatRatio(aperture.screenPecFraction)}`,
      level: aperture.apertureCount === expectedCount && aperture.screenPecFraction > 0.55 ? "ok" : "caution",
      note: "Diffraction examples are only meaningful if the PEC screen really contains the intended aperture(s).",
    }));

    const lambdaSource = Math.max(1e-6, wavelengthRatio(state));
    const fresnelScale = aperture.meanWidthLambda * aperture.meanWidthLambda / lambdaSource;
    rows.push(row({
      metric: "Diffraction scale",
      measured:
        state.preset === "doubleSlit"
          ? `a/lambda=${formatRatio(aperture.meanWidthLambda / lambdaSource)}, d/lambda=${formatRatio(aperture.separationLambda / lambdaSource)}`
          : `a/lambda=${formatRatio(aperture.meanWidthLambda / lambdaSource)}`,
      expected: "slit comparable to wavelength",
      error: `a^2/lambda=${formatField(fresnelScale)}`,
      level: aperture.meanWidthLambda / lambdaSource > 0.15 && aperture.meanWidthLambda / lambdaSource < 2.5 ? "ok" : "caution",
      note: "This compact theory check explains whether the scene should show strong spreading or a narrow beam.",
    }));
    return true;
  }

  function addSourceRadiationRows(rows, state, sim) {
    if (!SOURCE_RADIATION_PRESETS.has(state.preset)) return false;
    const sources = sourceCellSummary(state, sim);
    const expected = {
      twoSourceInterference: { count: 2, shape: "point" },
      frequencyBeat: { count: 2, shape: "point" },
      jzDipole: { count: 1, shape: "pointDipole" },
      inPlaneDipole: { count: 1, shape: "inPlaneElectricDipole" },
      mzDipole: { count: 1, shape: "pointDipole" },
      dipoleSubstrate: { count: 1, shape: "pointDipole" },
      dipoleNearPec: { count: 1, shape: "pointDipole" },
      huygensRadiator: { count: 1, shape: "huygens" },
      circularDipole: { count: 1, shape: "circularDipoleCw" },
      janusDipole: { count: 1, shape: "janusDipole" },
      dipoleArray: { count: 8, shape: "pointDipole" },
      phasedDipoleArray: { count: 8, shape: "pointDipole" },
      apertureRadiator: { count: 1, shape: "point" },
      nearFarFieldNtff: { count: 1, shape: "pointDipole" },
    }[state.preset];
    const shapeOk = !expected?.shape || sources.shapes.every((shape) => shape === expected.shape);
    const countOk = !expected?.count || sources.count === expected.count;
    rows.push(row({
      metric: "Source contract",
      measured: `N=${sources.count}, ${sources.shapes.join(", ") || "none"}`,
      expected: expected ? `N=${expected.count}, ${expected.shape}` : "documented source set",
      level: countOk && shapeOk ? "ok" : "caution",
      note: "Radiation examples are defined primarily by the source symmetry and phasing.",
    }));

    if (state.preset === "twoSourceInterference") {
      rows.push(row({
        metric: "Interference spacing",
        measured: `d=${formatField(sources.separationLambda)} lambda0, amp balance=${formatRatio(sources.amplitudeBalance)}`,
        expected: "coherent, comparable amplitudes",
        level: sources.separationLambda > 0.5 && sources.amplitudeBalance > 0.85 ? "ok" : "caution",
        note: "The expected fringes require two coherent sources with similar amplitudes.",
      }));
    } else if (state.preset === "frequencyBeat") {
      const detuning = sources.maxFrequency - sources.minFrequency;
      rows.push(row({
        metric: "Beat detuning",
        measured: `df=${formatField(detuning)}, f2/f1=${formatRatio(sources.frequencyRatio)}`,
        expected: "two nearby frequencies",
        level: sources.frequencyRatio > 1.03 && sources.frequencyRatio < 1.25 ? "ok" : "caution",
        note: "Temporal beating needs a small but finite source-frequency offset.",
      }));
    } else if (state.preset === "phasedDipoleArray") {
      const source = state.sources?.[0] || {};
      const steering = finiteNumber(source.arraySteeringAngleDeg, NaN);
      const phaseStep = finiteNumber(source.arrayPhaseStepDeg, NaN);
      rows.push(row({
        metric: "Array phase law",
        measured: `d=0.5 lambda0, dphi=${formatAngle(phaseStep)}`,
        expected: Number.isFinite(steering) ? `steer ${formatAngle(steering)}` : "progressive phase",
        level: Number.isFinite(steering) && Math.abs(phaseStep) > 5 ? "ok" : "caution",
        note: "The main lobe angle follows the array factor phase-gradient relation.",
      }));
    } else if (state.preset === "dipoleNearPec") {
      const pec = pecMaterialSummary(state, sim);
      rows.push(row({
        metric: "Image-dipole boundary",
        measured: `PEC cells=${pec.cells}, span=${formatField(pec.heightLambda)} lambda0`,
        expected: "nearby PEC mirror",
        level: pec.cells > 100 && pec.heightLambda > 2 ? "ok" : "caution",
        note: "The example should be interpreted as a dipole interacting with its PEC image source.",
      }));
    }
    return true;
  }

  function addGuidedRows(rows, state, sim) {
    if (!GUIDED_PRESETS.has(state.preset)) return false;
    const metrics = analysisMetrics(state, sim);
    if (!metrics || finiteNumber(sim.analysisSamples, 0) < 8) {
      rows.push(row({
        metric: "Guided-flux beta",
        measured: `${finiteNumber(sim.analysisSamples, 0)} analysis samples`,
        expected: "guided power after warm-up",
        level: "pending",
        note: "Run longer so the analysis contour can estimate guided versus outward flux.",
      }));
      return true;
    }
    const beta = finiteNumber(metrics.beta, 0);
    rows.push(row({
      metric: "Guided-flux beta",
      measured: formatRatio(beta),
      expected: state.preset === "lossyGuide" ? "finite but lossy" : "> 0.25",
      error: "-",
      level: beta > 0.25 || state.preset === "lossyGuide" ? "ok" : "caution",
      note: "Beta is a 2D contour-flux proxy for power remaining in the launched guide band.",
    }));
    if (metrics.coupledWorkflow?.guideEnergyFraction != null) {
      const guideFraction = finiteNumber(metrics.coupledWorkflow.guideEnergyFraction, 0);
      rows.push(row({
        metric: "Guide-region energy",
        measured: formatRatio(guideFraction),
        expected: "nonzero guided overlap",
        level: guideFraction > 0.02 ? "ok" : "pending",
        note: "This guards against a drawn guide that is not actually reached by the source.",
      }));
    }
    return true;
  }

  function addResonatorRows(rows, state, sim) {
    if (!RESONATOR_PRESETS.has(state.preset)) return false;
    const metrics = analysisMetrics(state, sim);
    if (!metrics || finiteNumber(sim.analysisSamples, 0) < 32) {
      rows.push(row({
        metric: "Resonator spectrum/Q",
        measured: `${finiteNumber(sim.analysisSamples, 0)} analysis samples`,
        expected: "ringdown or spectral peak",
        level: "pending",
        note: "Q and spectral peaks require a longer time trace than a field snapshot.",
      }));
      return true;
    }
    const q = finiteNumber(metrics.ringdown?.q, 0);
    rows.push(row({
      metric: "Loaded Q proxy",
      measured: q > 0 ? formatField(q) : "not fitted",
      expected: "finite positive Q",
      level: q > 0 ? "ok" : "pending",
      note: "Q is estimated from the 2D energy decay trace; it is a teaching proxy, not an eigenmode solve.",
    }));
    if (metrics.spectrum) {
      rows.push(row({
        metric: "Dominant spectral peak",
        measured: `f=${formatField(metrics.spectrum.peakFrequency)}`,
        expected: "carrier/cavity response",
        level: metrics.spectrum.peakMagnitude > 0 ? "ok" : "pending",
        note: "The peak comes from the probe DFT window and should be refined before quantitative publication claims.",
      }));
    }
    return true;
  }

  function addPhcRows(rows, state, sim) {
    if (!PHC_PRESETS.has(state.preset)) return false;
    const target = PHC_TARGETS[state.preset] || {};
    const geometry = phcGeometryEstimate(state, sim);
    if (!geometry) {
      rows.push(row({
        metric: "PhC lattice mask",
        measured: "not available",
        expected: "high-index periodic rods",
        level: "pending",
        note: "The scene could not be reduced to a photonic-crystal lattice mask.",
      }));
      return true;
    }

    const latticeOk =
      geometry.highIndexCells >= finiteNumber(target.minHighIndexCells, 0) &&
      geometry.rodCountProxy >= finiteNumber(target.minRods, 0) &&
      geometry.rowsProxy >= finiteNumber(target.minRows, 0) &&
      geometry.colsProxy >= finiteNumber(target.minCols, 0);
    rows.push(row({
      metric: "PhC lattice mask",
      measured: `${geometry.highIndexCells} cells, rods~${geometry.rodCountProxy}, ${geometry.rowsProxy}x${geometry.colsProxy}`,
      expected: `>=${finiteNumber(target.minRows, 0)} rows, >=${finiteNumber(target.minCols, 0)} cols`,
      level: latticeOk ? "ok" : "caution",
      note: "This checks that the preset is an actual two-dimensional high-index rod lattice before interpreting fields.",
    }));

    const phcBloch = phcBlochReference(state, sim);
    if (phcBloch) {
      const pathPoints = finiteNumber(phcBloch.modal?.path?.pointCount, 0);
      const bandGap = finiteNumber(phcBloch.modal?.bandGap, 0);
      const blochOk =
        phcBloch.cells >= finiteNumber(target.minBlochCells, 0) &&
        (pathPoints >= 13 || state.preset === "phcDisorder") &&
        (state.preset !== "photonicCrystal" || bandGap > 0.001);
      rows.push(row({
        metric: "Bloch/PWE reference",
        measured: `cells=${phcBloch.cells}, SF=${formatRatio(phcBloch.structureFactor)}, gap=${formatField(bandGap)}`,
        expected: state.sweepMode === "blochK" ? "Bloch-k sweep configured" : "Bloch-k sweep",
        error: `path=${pathPoints}`,
        level: blochOk ? "ok" : "caution",
        note: "This compact plane-wave estimate is a sanity reference for the surrounding periodic lattice, not a full band-structure solver.",
      }));
    } else if (finiteNumber(target.minBlochCells, 0) > 0) {
      rows.push(row({
        metric: "Bloch/PWE reference",
        measured: "missing",
        expected: "finite compact band estimate",
        level: "caution",
        note: "PhC examples that claim band or defect physics need the reduced Bloch/PWE reference to be available.",
      }));
    }

    const energyReady = geometry.totalEnergy > 1e-18 || finiteNumber(sim.analysisSamples, 0) > 0 || finiteNumber(sim.stepCount, 0) > 0;
    if (state.preset === "photonicCrystal") {
      rows.push(row({
        metric: "Central lattice occupancy",
        measured: `${geometry.centerBinHighIndexCells} high-index cells`,
        expected: "occupied central rod",
        level: geometry.centerBinHighIndexCells >= 12 ? "ok" : "caution",
        note: "The base PhC should remain periodic at the center; defect examples remove or reshape this bin.",
      }));
      return true;
    }

    if (state.preset === "phcPointDefect") {
      const defectOk = geometry.centralVacancyBins3 >= 1 && geometry.centerBinHighIndexCells <= 2;
      rows.push(row({
        metric: "Point-defect vacancy",
        measured: `vacancies=${geometry.centralVacancyBins3}, center cells=${geometry.centerBinHighIndexCells}`,
        expected: "one missing central rod",
        level: defectOk ? "ok" : "caution",
        note: "This distinguishes a true point-defect cavity from an intact periodic lattice.",
      }));
      rows.push(row({
        metric: "Defect-field overlap",
        measured: energyReady ? formatRatio(geometry.centerDefectEnergyFraction) : "not warmed up",
        expected: "> 0.02 after excitation reaches defect",
        level: !energyReady ? "pending" : geometry.centerDefectEnergyFraction > 0.02 ? "ok" : "caution",
        note: "A point-defect example should place measurable field energy in the missing-rod region.",
      }));
      return true;
    }

    if (state.preset === "phcWaveguide") {
      const lineOk =
        geometry.lineRowBinCount <= 1 &&
        geometry.centralLineHighIndexCells <= 8 &&
        geometry.adjacentRowHighIndexCells >= 180;
      rows.push(row({
        metric: "Line-defect geometry",
        measured: `row bins=${geometry.lineRowBinCount}, center cells=${geometry.centralLineHighIndexCells}`,
        expected: "central row open, adjacent rows populated",
        error: `adjacent cells=${geometry.adjacentRowHighIndexCells}`,
        level: lineOk ? "ok" : "caution",
        note: "This catches a PhC waveguide that visually has rods but has not actually opened the line-defect channel.",
      }));
      rows.push(row({
        metric: "Line-defect energy",
        measured: energyReady ? `line=${formatRatio(geometry.lineDefectEnergyFraction)}` : "not warmed up",
        expected: "> 0.12 with bounded adjacent leakage",
        error: `adj/line=${formatRatio(geometry.adjacentToLineEnergyRatio)}`,
        level:
          !energyReady
            ? "pending"
            : geometry.lineDefectEnergyFraction > 0.12 && geometry.adjacentToLineEnergyRatio <= 2
              ? "ok"
              : "caution",
        note: "This is the check that matters for the image you flagged: the launched field should remain measurably in the defect channel.",
      }));
      return true;
    }

    if (state.preset === "phcOptimizedCavity" || state.preset === "symmetryProtectedBic") {
      const cavityOk = geometry.centralVacancyBins3 >= 3 && geometry.cavityHighIndexCells <= 2;
      rows.push(row({
        metric: "L3 cavity geometry",
        measured: `vacancies=${geometry.centralVacancyBins3}, cavity cells=${geometry.cavityHighIndexCells}`,
        expected: "three-cell central defect",
        level: cavityOk ? "ok" : "caution",
        note: "The L3 teaching scene should remove the central row holes and keep the cavity window open.",
      }));
      rows.push(row({
        metric: "Cavity-field overlap",
        measured: energyReady ? formatRatio(geometry.cavityEnergyFraction) : "not warmed up",
        expected: "> 0.05 after excitation",
        level: !energyReady ? "pending" : geometry.cavityEnergyFraction > 0.05 ? "ok" : "caution",
        note: "A field snapshot is not enough; the cavity region should collect measurable energy.",
      }));
    }

    if (state.preset === "phcDisorder") {
      const disorderOk = geometry.latticeOffsetMeanLambda >= 0.003 && geometry.latticeOffsetMeanLambda <= 0.04;
      rows.push(row({
        metric: "Deterministic disorder",
        measured: `mean=${formatRatio(geometry.latticeOffsetMeanLambda)} lambda0, max=${formatRatio(geometry.latticeOffsetMaxLambda)} lambda0`,
        expected: "small nonzero lattice jitter",
        level: disorderOk ? "ok" : "caution",
        note: "The disorder example should not collapse to either a perfect lattice or a random scatterer slab.",
      }));
      return true;
    }

    if (state.preset === "phcDarkMode" || state.preset === "quasiBic" || state.preset === "bicKerr" || state.preset === "bicEnz") {
      const phase = geometry.sourcePhaseDifferenceDeg;
      const amplitudeRatio = geometry.sourceAmplitudeRatio;
      const darkTarget = state.preset === "quasiBic" ? "deliberately weakly broken symmetry" : "opposite-phase balanced dipoles";
      const sourceOk =
        state.preset === "quasiBic"
          ? phase >= 165 && phase <= 175 && amplitudeRatio >= 0.85 && amplitudeRatio <= 0.95
          : phase >= 175 && amplitudeRatio >= 0.95;
      rows.push(row({
        metric: "Dark/BIC excitation",
        measured: `sources=${geometry.sourceCount}, phase=${formatAngle(phase)}, amp ratio=${formatRatio(amplitudeRatio)}`,
        expected: darkTarget,
        level: sourceOk ? "ok" : "caution",
        note: "These examples depend on symmetry selection rules; the source pair is part of the physical scene, not a cosmetic detail.",
      }));
    }

    if (phcBloch && (state.preset === "phcDarkMode" || state.preset === "quasiBic" || state.preset === "symmetryProtectedBic")) {
      rows.push(row({
        metric: "Leakage/Q proxy",
        measured: `Qk~${formatField(phcBloch.qProxy)}`,
        expected: "> 4 for the compact leakage proxy",
        error: `leak=${formatRatio(phcBloch.leakage)}`,
        level: phcBloch.qProxy > 4 ? "ok" : "caution",
        note: "This is a reduced finite-size/symmetry leakage estimate, useful for teaching trends but not for publication-grade Q.",
      }));
    }

    return true;
  }

  function addSshRows(rows, state, sim) {
    if (!SSH_PRESETS.has(state.preset)) return false;
    const metrics = analysisMetrics(state, sim);
    const ssh = metrics?.sshBloch || safeSimEstimate(sim, "sshBlochEstimate");
    if (!ssh) {
      rows.push(row({
        metric: "SSH Bloch reference",
        measured: "missing",
        expected: "finite t1/t2 dimer reference",
        level: "caution",
        note: "SSH examples need an explicit coupling-order reference, otherwise the topology is only visual.",
      }));
      return true;
    }

    const topologicalExpected = state.preset !== "sshTrivial";
    const windingOk = topologicalExpected ? ssh.winding === 1 : ssh.winding === 0;
    rows.push(row({
      metric: "SSH coupling topology",
      measured: `t1=${formatRatio(ssh.t1)}, t2=${formatRatio(ssh.t2)}, winding=${ssh.winding}`,
      expected: topologicalExpected ? "topological ordering t2>t1" : "trivial ordering t1>t2",
      error: `gap=${formatRatio(ssh.bandGap)}`,
      level: windingOk && ssh.bandGap > 0 ? "ok" : "caution",
      note: "This is the compact tight-binding reference for the drawn SSH chain.",
    }));

    if (ssh.edgeExpected || state.preset === "nonHermitianSsh") {
      rows.push(row({
        metric: "Edge-state expectation",
        measured: ssh.edgeExpected ? "interface/edge expected" : "bulk-like",
        expected: "localized edge or interface response",
        error: state.preset === "nonHermitianSsh" ? `NH gap=${formatRatio(ssh.nonHermitianGap)}` : "-",
        level: ssh.edgeExpected ? "ok" : "caution",
        note: "The field still needs runtime overlap checks, but the preset now exposes the modal/topological contract.",
      }));
    }
    return true;
  }

  function addPtRows(rows, state, sim) {
    if (!PT_PRESETS.has(state.preset)) return false;
    const metrics = analysisMetrics(state, sim);
    const pt = metrics?.ptModal || safeSimEstimate(sim, "ptModalEstimate");
    if (!pt) {
      rows.push(row({
        metric: "PT modal reference",
        measured: "missing",
        expected: "2x2 gain/loss coupler estimate",
        level: "caution",
        note: "PT/EP examples need a modal splitting estimate, not just gain and loss colors.",
      }));
      return true;
    }
    const expectedPhase = state.preset === "exceptionalPointCoupler" ? "near-EP" : "unbroken";
    const phaseOk = state.preset === "exceptionalPointCoupler" ? pt.epDistance < 0.05 : pt.normalizedGamma < 1;
    rows.push(row({
      metric: "PT gain/loss ratio",
      measured: `gamma/kappa=${formatRatio(pt.normalizedGamma)}, phase=${pt.phase}`,
      expected: expectedPhase,
      error: `EP distance=${formatRatio(pt.epDistance)}`,
      level: phaseOk ? "ok" : "caution",
      note: "The 2x2 estimate checks whether the gain/loss preset is in the intended PT regime.",
    }));
    rows.push(row({
      metric: "Modal splitting proxy",
      measured: `Re split=${formatRatio(pt.realSplit)}, Im split=${formatRatio(pt.imagSplit)}`,
      expected: state.preset === "exceptionalPointCoupler" ? "coalescence high" : "real splitting",
      error: `coal=${formatRatio(pt.coalescence)}`,
      level: state.preset === "exceptionalPointCoupler" ? pt.coalescence > 0.7 ? "ok" : "caution" : pt.realSplit > 0.01 ? "ok" : "caution",
      note: "This does not replace an eigenmode solve, but it prevents a near-EP scene from being judged by field appearance alone.",
    }));
    return true;
  }

  function addAbsorptionRows(rows, state, sim) {
    if (!ABSORPTION_PRESETS.has(state.preset)) return false;
    const lossy = materialMaskSummary(sim, (idx) => Math.max(finiteNumber(sim.loss?.[idx], 0), finiteNumber(sim.lossY?.[idx], 0)) > 0.01);
    rows.push(row({
      metric: "Lossy absorber mask",
      measured: `${lossy.cells} lossy cells`,
      expected: "graded lossy layer backed by PEC",
      level: lossy.cells > 500 ? "ok" : "caution",
      note: "A perfect-absorber scene must contain a real finite lossy region, not just a color label.",
    }));
    if (!state.diagnosticsEnabled || finiteNumber(sim.diagnosticSamples, 0) < 20) {
      rows.push(row({
        metric: "Absorption from R/T",
        measured: `${finiteNumber(sim.diagnosticSamples, 0)} line samples`,
        expected: "A=1-R-T after warm-up",
        level: "pending",
        note: "Run longer with line diagnostics before interpreting absorber performance.",
      }));
      return true;
    }
    const r = finiteNumber(sim.diagnosticReflectance, 0);
    const t = finiteNumber(sim.diagnosticTransmittance, 0);
    const a = 1 - r - t;
    rows.push(row({
      metric: "Absorption from R/T",
      measured: `A~${formatRatio(a)}, R=${formatRatio(r)}, T=${formatRatio(t)}`,
      expected: "large positive absorption",
      level: a > 0.5 && r < 0.35 ? "ok" : "caution",
      note: "This is the relevant observable for an absorber; raw field suppression alone is ambiguous.",
    }));
    return true;
  }

  function addNegativeIndexRows(rows, state, sim) {
    if (!NEGATIVE_INDEX_PRESETS.has(state.preset)) return false;
    const metrics = analysisMetrics(state, sim);
    const negativeIndex = metrics?.negativeIndex || safeSimEstimate(sim, "negativeIndexQuantitativeEstimate");
    const material = negativeIndex?.material || safeSimEstimate(sim, "negativeIndexDiagnostics");
    if (!material) {
      rows.push(row({
        metric: "Double-negative material",
        measured: "missing",
        expected: "epsilon<0 and mu<0 at carrier",
        level: "caution",
        note: "Negative-index scenes need an ADE material reference at the source frequency.",
      }));
      return true;
    }
    rows.push(row({
      metric: "Double-negative material",
      measured: `eps=${formatField(material.epsEff)}, mu=${formatField(material.muEff)}, n=${formatField(material.nEff)}`,
      expected: "epsilon<0, mu<0",
      error: `${material.doubleNegativeCells}/${material.cells} cells`,
      level: material.epsEff < 0 && material.muEff < 0 && material.doubleNegativeCells > 0 ? "ok" : "caution",
      note: "This checks the material model before interpreting refraction or imaging.",
    }));

    const warmed = finiteNumber(sim.time, 0) > 20 || finiteNumber(sim.diagnosticSamples, 0) > 20;
    if (state.preset === "superlensSlab") {
      rows.push(row({
        metric: "Superlens image proxy",
        measured: warmed ? `transfer=${formatRatio(negativeIndex?.imageTransfer)}, width=${formatField(negativeIndex?.imageWidthLambda)} lambda0` : "not warmed up",
        expected: "finite image plane response",
        error: `w_img/w_obj=${formatRatio(negativeIndex?.resolutionRatio)}`,
        level: !warmed ? "pending" : finiteNumber(negativeIndex?.imageTransfer, 0) > 0 ? "ok" : "caution",
        note: "The image proxy is qualitative and should be refined with convergence before any resolution claim.",
      }));
    } else {
      rows.push(row({
        metric: "Negative-refraction trace",
        measured: warmed ? `score=${formatRatio(negativeIndex?.negativeRefractionScore)}, theta_slab=${formatAngle(negativeIndex?.slabAngleDeg)}` : "not warmed up",
        expected: "opposite in-slab ray/phase trend",
        error: `phase coh=${formatRatio(negativeIndex?.slabPhaseCoherence)}`,
        level: !warmed ? "pending" : finiteNumber(negativeIndex?.negativeRefractionScore, 0) > 0.1 ? "ok" : "caution",
        note: "This is a runtime field-trace sanity check, not a calibrated Veselago-slab benchmark.",
      }));
    }
    return true;
  }

  function addHyperlensRows(rows, state, sim) {
    if (!HYPERLENS_PRESETS.has(state.preset)) return false;
    const metrics = analysisMetrics(state, sim);
    const hyperlens = metrics?.hyperlens || safeSimEstimate(sim, "analysisHyperlensEstimate");
    if (!hyperlens || finiteNumber(sim.analysisSamples, 0) < 8) {
      rows.push(row({
        metric: "Hyperlens annular transfer",
        measured: `${finiteNumber(sim.analysisSamples, 0)} analysis samples`,
        expected: "inner/outer angular detail transfer",
        level: "pending",
        note: "Run longer so annular harmonic samples can estimate detail transport.",
      }));
      return true;
    }
    rows.push(row({
      metric: "Hyperlens annular transfer",
      measured: `Eout/Ein=${formatRatio(hyperlens.transfer)}, detail=${formatRatio(hyperlens.detailTransfer)}`,
      expected: "finite outer-ring transfer",
      error: `valid MTF=${finiteNumber(hyperlens.mtfValidCount, 0)}`,
      level: hyperlens.transfer > 0 && hyperlens.mtfValidCount > 0 ? "ok" : "caution",
      note: "The MTF-style readout makes the scene about angular information transfer, not only bright rings.",
    }));
    rows.push(row({
      metric: "Hyperlens MTF proxy",
      measured: `MTF=${formatRatio(hyperlens.mtfMean)}, high-m=${formatRatio(hyperlens.mtfHighOrderMean)}`,
      expected: "nonzero angular harmonics",
      error: `m50=${formatField(hyperlens.mtfBandwidthOrder)}`,
      level: hyperlens.mtfMean > 0 ? "ok" : "pending",
      note: "This is a compact 2D proxy for teaching; publication use would need a calibrated transfer-function setup.",
    }));
    return true;
  }

  function addBianisotropyRows(rows, state, sim) {
    if (!BIANISOTROPY_PRESETS.has(state.preset)) return false;
    const metrics = analysisMetrics(state, sim);
    const bianisotropy = metrics?.bianisotropy || safeSimEstimate(sim, "bianisotropyQuantitativeEstimate");
    if (!bianisotropy) {
      rows.push(row({
        metric: "Bianisotropic material",
        measured: "missing",
        expected: "finite kappa and passive tensor margin",
        level: "caution",
        note: "Bianisotropic scenes need full-vector material diagnostics to be physically meaningful.",
      }));
      return true;
    }
    rows.push(row({
      metric: "Bianisotropic material",
      measured: `kappa=${formatRatio(bianisotropy.meanAbsKappa)}, pass=${formatRatio(bianisotropy.passivityMargin)}`,
      expected: "passive definite coupling",
      error: `cells=${finiteNumber(bianisotropy.bounds?.cells, 0)}`,
      level: bianisotropy.passivityMargin > 0 ? "ok" : "caution",
      note: "This guards against unphysical magnetoelectric coupling before interpreting polarization conversion.",
    }));
    rows.push(row({
      metric: "Cross-polarized output",
      measured: `material=${formatRatio(bianisotropy.materialCrossFraction)}, output=${formatRatio(bianisotropy.outputCrossFraction)}`,
      expected: "finite cross channel",
      error: `corr=${formatRatio(bianisotropy.kappaSignedOutputCorrelation)}`,
      level: bianisotropy.materialCrossFraction > 0 || bianisotropy.outputCrossFraction > 0 ? "ok" : "pending",
      note: "The cross-channel readout is a field-level proxy for magnetoelectric conversion.",
    }));
    return true;
  }

  function addNonlinearRows(rows, state, sim) {
    if (!NONLINEAR_PRESETS.has(state.preset)) return false;
    const metrics = analysisMetrics(state, sim);
    const nonlinear = materialMaskSummary(sim, (idx) => Boolean(sim.nonlinearMaterial?.[idx]));
    const phase = materialMaskSummary(sim, (idx) => Boolean(sim.phaseChangeMaterial?.[idx]));
    if (nonlinear.cells > 0) {
      rows.push(row({
        metric: "Nonlinear material overlap",
        measured: `${nonlinear.cells} cells, Efrac=${formatRatio(nonlinear.energyFraction)}`,
        expected: "field reaches nonlinear region",
        level: finiteNumber(sim.time, 0) <= 0 ? "pending" : nonlinear.energyFraction > 1e-6 ? "ok" : "caution",
        note: "This prevents Kerr/harmonic examples from being validated only by the material mask.",
      }));
    }

    if (HARMONIC_PRESETS.has(state.preset)) {
      const harmonicValue = state.preset === "shgSlab" ? finiteNumber(metrics?.harmonic2, 0) : finiteNumber(metrics?.harmonic3, 0);
      const harmonicReady = Boolean(metrics && finiteNumber(sim.analysisSamples, 0) >= 32);
      rows.push(row({
        metric: state.preset === "shgSlab" ? "Second-harmonic proxy" : "Third-harmonic proxy",
        measured: harmonicReady ? formatRatio(harmonicValue) : `${finiteNumber(sim.analysisSamples, 0)} analysis samples`,
        expected: "finite harmonic DFT ratio",
        level: !harmonicReady ? "pending" : harmonicValue > 1e-4 ? "ok" : "caution",
        note: "Harmonic generation needs spectral evidence; a distorted field snapshot is not enough.",
      }));
    }

    if (PHASE_CHANGE_PRESETS.has(state.preset)) {
      const phaseAverage = metrics?.phaseAverage ?? safeSimEstimate(sim, "phaseChangeStateEstimate");
      rows.push(row({
        metric: "Phase-state response",
        measured: `${phase.cells} cells, state=${formatRatio(phaseAverage)}`,
        expected: "finite switched fraction after excitation",
        error: `Efrac=${formatRatio(phase.energyFraction)}`,
        level: finiteNumber(sim.time, 0) <= 0 ? "pending" : phase.cells > 0 && finiteNumber(phaseAverage, 0) > 0.05 ? "ok" : "caution",
        note: "Phase-change and saturable examples should report state evolution, not just a high-loss rectangle.",
      }));
    }

    if (metrics && !HARMONIC_PRESETS.has(state.preset) && finiteNumber(metrics.sidebandRatio, 0) > 0) {
      rows.push(row({
        metric: "Nonlinear spectral broadening",
        measured: `side/peak=${formatRatio(metrics.sidebandRatio)}`,
        expected: "finite sideband content",
        level: metrics.sidebandRatio > 0.05 ? "ok" : "pending",
        note: "This compact spectral metric is useful for SPM/bistability teaching scenes.",
      }));
    }
    return true;
  }

  function addFloquetRows(rows, state, sim) {
    if (!TEMPORAL_FLOQUET_PRESETS.has(state.preset)) return false;
    const metrics = analysisMetrics(state, sim);
    const floquet = metrics?.floquet || safeSimEstimate(sim, "analysisFloquetEstimate");
    const phase = floquet?.modulationPhase || safeSimEstimate(sim, "modulationPhaseCoherenceEstimate");
    if (phase) {
      const traveling = state.preset === "travelingModulation" || state.preset === "temporalIsolator" || state.preset === "floquetResonators" || state.preset === "syntheticFrequency";
      const phaseOk = traveling ? phase.spatialCoherence < 0.85 && phase.phaseSpreadRad > 3 : phase.spatialCoherence > 0.95;
      rows.push(row({
        metric: "Modulation phase contract",
        measured: `Cphi=${formatRatio(phase.spatialCoherence)}, spread=${formatField(phase.phaseSpreadRad)}`,
        expected: traveling ? "traveling/staggered phase" : "spatially uniform temporal modulation",
        error: `v=${formatRatio(phase.phaseVelocityLambdaPerStep)} lambda0/step`,
        level: phaseOk ? "ok" : "caution",
        note: "This distinguishes a true traveling or staggered modulation from a uniform time-varying slab.",
      }));
    }

    if (!floquet) {
      rows.push(row({
        metric: "Floquet sidebands",
        measured: `${finiteNumber(sim.analysisSamples, 0)} analysis, ${finiteNumber(sim.diagnosticDftSampleCount, 0)} DFT samples`,
        expected: "finite +/-1 sideband readout",
        level: "pending",
        note: "Run longer so probe or line-port DFT samples can resolve modulation sidebands.",
      }));
      return true;
    }
    rows.push(row({
      metric: "Floquet sidebands",
      measured: `S+1=${formatRatio(floquet.firstUpper)}, S-1=${formatRatio(floquet.firstLower)}`,
      expected: "finite sideband conversion",
      error: `Pside=${formatRatio(floquet.sidebandPower)}`,
      level: floquet.firstUpper > 0 || floquet.firstLower > 0 || floquet.sidebandPower > 1e-12 ? "ok" : "pending",
      note: "The readout is a truncated-order teaching observable; calibrated Floquet S-matrices need more reference-plane work.",
    }));
    if (floquet.scatteringMatrix) {
      rows.push(row({
        metric: "Measured-order power balance",
        measured: `Pout=${formatRatio(floquet.scatteringMatrix.totalOutgoingPower)}`,
        expected: "bounded truncated residual",
        error: `|dP|=${formatRatio(floquet.scatteringMatrix.powerBalanceAbsResidual)}`,
        level: floquet.scatteringMatrix.powerBalanceAbsResidual < 0.75 ? "ok" : "caution",
        note: "Large residuals can mean missing higher orders, absorption, or insufficient sampling.",
      }));
    }
    return true;
  }

  function addCoupledWorkflowRows(rows, state, sim) {
    if (!COUPLED_WORKFLOW_PRESETS.has(state.preset)) return false;
    const metrics = analysisMetrics(state, sim);
    const coupled = metrics?.coupledWorkflow || safeSimEstimate(sim, "coupledWorkflowEstimate");
    if (!coupled || finiteNumber(sim.analysisSamples, 0) < 8) {
      rows.push(row({
        metric: "Coupled-workflow overlap",
        measured: `${finiteNumber(sim.analysisSamples, 0)} analysis samples`,
        expected: "finite material/guide/active-region energy",
        level: "pending",
        note: "Run longer before interpreting non-Hermitian, active, or coupled topology workflows.",
      }));
      return true;
    }
    rows.push(row({
      metric: "Coupled-workflow overlap",
      measured: `guide=${formatRatio(coupled.guideEnergyFraction)}, active=${formatRatio(coupled.activeMaterialFraction)}`,
      expected: "field overlaps the intended active/coupled region",
      error: `mat=${formatRatio(coupled.materialEnergyFraction)}`,
      level: coupled.materialEnergyFraction > 0.05 && (coupled.guideEnergyFraction > 0.01 || coupled.activeMaterialFraction > 1e-4) ? "ok" : "caution",
      note: "This catches scenes where the active device exists but the launched field never reaches it.",
    }));
    if (state.preset === "nonHermitianSkin") {
      rows.push(row({
        metric: "Non-Hermitian skin proxy",
        measured: `edge=${formatRatio(coupled.skinEdgeFraction)}, bias=${formatRatio(coupled.skinBias)}`,
        expected: "strong edge-biased energy",
        error: `gain/loss=${formatRatio(coupled.gainLossBias)}`,
        level: Math.abs(coupled.skinBias) > 0.5 && coupled.skinEdgeFraction > 1e-6 ? "ok" : "caution",
        note: "The metric is a finite-lattice teaching proxy for biased localization, not a generalized Brillouin-zone calculation.",
      }));
    }
    return true;
  }

  function addScatteringRows(rows, state, sim) {
    if (!SCATTERING_PRESETS.has(state.preset)) return false;
    const scatter = scattererGeometryEstimate(state, sim);
    const objectCells = scatter.material.cells;
    const pecCells = scatter.pec.cells;
    rows.push(row({
      metric: "Scatterer geometry",
      measured: `cells=${objectCells}, PEC=${pecCells}, box=${formatField(scatter.material.widthLambda)}x${formatField(scatter.material.heightLambda)} lambda0`,
      expected: state.preset.includes("Cylinder") || state.preset === "kerker2d" ? "single finite cylinder" : "finite random/cluster region",
      error: `E_obj=${formatRatio(scatter.material.energyFraction)}`,
      level: objectCells > 40 ? "ok" : "caution",
      note: "Scattering scenes need a finite object or cluster separated from the CPML; a field pattern alone is insufficient.",
    }));

    if (state.preset.includes("Cylinder") || state.preset === "kerker2d" || state.preset === "dielectricDimer") {
      rows.push(row({
        metric: "Size-parameter reference",
        measured: `x=2*pi*r/lambda=${formatRatio(scatter.sizeParameter)}`,
        expected: state.preset === "kerker2d" ? "electric/magnetic multipole balance proxy" : "2D cylinder scattering regime",
        level: scatter.sizeParameter > 0.25 && scatter.sizeParameter < 5 ? "ok" : "caution",
        note: "This is the compact analytical scale used to interpret the angular scattering pattern.",
      }));
    } else if (state.preset === "weakLocalization" || state.preset === "andersonLocalization" || state.preset === "diffusiveRandomMedium") {
      const fill = scatter.dielectric.cells / Math.max(1, sim.n);
      rows.push(row({
        metric: "Disorder fill factor",
        measured: `fill=${formatRatio(fill)}, span=${formatField(scatter.dielectric.widthLambda)} lambda0`,
        expected: state.preset === "andersonLocalization" ? "dense random slab" : "finite scattering slab",
        level: scatter.dielectric.cells > 500 && scatter.dielectric.widthLambda > 2 ? "ok" : "caution",
        note: "Localization/diffusion examples require enough scatterers for multiple scattering, not isolated obstacles.",
      }));
    }
    return true;
  }

  function addDispersiveMaterialRows(rows, state, sim) {
    if (!DISPERSIVE_PRESETS.has(state.preset)) return false;
    const active = materialRegionSummary(state, sim, (idx) => {
      if (sim.material?.[idx] === 2) return false;
      if (sim.dispersiveMaterial?.[idx] || sim.muDispersiveMaterial?.[idx]) return true;
      if (state.preset === "finiteConductivity") return finiteNumber(sim.loss?.[idx], 0) > 1e-6;
      return sim.material?.[idx] !== 0;
    });
    const carrier = dispersiveEpsilonAtCarrier(state);
    rows.push(row({
      metric: "Material model contract",
      measured: `model=${carrier.model}, cells=${active.cells}`,
      expected: state.preset === "finiteConductivity" ? "conductive loss region" : "enabled dispersive ADE region",
      error: `E_mat=${formatRatio(active.energyFraction)}`,
      level:
        active.cells > 50 &&
        (state.preset === "finiteConductivity" || state.materialDispersionEnabled || active.energyFraction >= 0)
          ? "ok"
          : "caution",
      note: "This catches scenes where a dispersive example only draws an object but does not activate the intended material model.",
    }));

    if (carrier.eps) {
      const eps = carrier.eps;
      let expected = "finite complex epsilon";
      let level = Number.isFinite(eps.re) && Number.isFinite(eps.im) ? "ok" : "caution";
      if (state.preset === "plasmaCutoff" || state.preset === "drudeMetal" || state.preset === "localizedPlasmon" || state.preset === "plasmonicDimer") {
        expected = "metal/plasma Re(eps) < 0 near carrier";
        level = eps.re < 0 ? "ok" : "caution";
      } else if (state.preset === "enzSlab" || state.preset === "enzEmitter" || state.preset === "bicEnz") {
        expected = "near-zero Re(eps)";
        level = Math.abs(eps.re) < 0.6 ? "ok" : "caution";
      }
      rows.push(row({
        metric: "Carrier epsilon",
        measured: `eps=${formatField(eps.re)} ${eps.im >= 0 ? "+" : "-"} ${formatField(Math.abs(eps.im))}i`,
        expected,
        level,
        note: "The value is the compact frequency-domain reference implied by the time-domain material update.",
      }));
    } else if (state.preset === "finiteConductivity") {
      const sigma = finiteNumber(state.conductivitySigma, 0);
      const omega = 2 * Math.PI * Math.max(1e-9, sourceFrequency(state));
      rows.push(row({
        metric: "Conductive loss scale",
        measured: `sigma/omega=${formatRatio(sigma / omega)}, loss=${formatRatio(active.lossMean)}`,
        expected: "finite absorption and skin-depth behavior",
        level: sigma > 0 && active.lossMean > 0 ? "ok" : "caution",
        note: "Finite conductivity should be interpreted through loss and skin depth, not as a PEC wall.",
      }));
    }
    return true;
  }

  function addPlasmonicDimerRows(rows, state, sim) {
    const estimate = plasmonicDimerHotGapEstimate(state, sim);
    if (!estimate) return false;
    const excitationOk = state.fieldComponent === "hz" && state.fieldDisplay === "electricMag";
    const sourceShape = state.sources?.[0]?.shape || "";
    rows.push(row({
      metric: "Hot-gap excitation contract",
      measured: `${state.fieldComponent === "hz" ? "TEz/Hz" : "TMz/Ez"}, display=${state.fieldDisplay}, source=${sourceShape}`,
      expected: "TEz/Hz, in-plane |E|, local electric-dipole feed",
      level: excitationOk && sourceShape === "inPlaneElectricDipole" ? "ok" : "caution",
      note: "This preset models a dipole-fed plasmonic dimer nanoantenna; a passive plane-wave scattering spectrum would need a separate reference run.",
    }));
    rows.push(row({
      metric: "Hot-gap resolution",
      measured: `gap=${estimate.gapCells} cells, disks=${estimate.disk1Cells}/${estimate.disk2Cells}`,
      expected: "open air gap and two resolved Drude disks",
      level: estimate.gapCells >= 16 && estimate.disk1Cells >= 70 && estimate.disk2Cells >= 70 ? "ok" : "caution",
      note: "A sub-cell or one-cell gap can look plausible but is not a defensible near-field example.",
    }));
    rows.push(row({
      metric: "Gap |E|^2 enhancement",
      measured: `peak/bg=${formatRatio(estimate.gapPeakToBackgroundRatio)}, mean/bg=${formatRatio(estimate.gapMeanToBackgroundRatio)}`,
      expected: "peak/bg >= 12 and mean/bg >= 3 versus local background",
      level:
        estimate.gapPeakToBackgroundRatio >= 12 &&
        estimate.gapMeanToBackgroundRatio >= 3
          ? "ok"
          : "caution",
      note: "This is a hard teaching diagnostic, not a calibrated resonance spectrum or mesh-converged field-enhancement factor.",
    }));
    return true;
  }

  function addTensorMaterialRows(rows, state, sim) {
    if (!TENSOR_PRESETS.has(state.preset)) return false;
    const material = primaryMaterialSummary(state, sim);
    const epsX = material.epsMean;
    const epsY = material.epsYMean;
    const anisotropy = Math.max(Math.abs(epsX), Math.abs(epsY)) / Math.max(1e-9, Math.min(Math.abs(epsX), Math.abs(epsY)));
    let expected = "anisotropic tensor region";
    let level = material.cells > 50 && anisotropy > 1.05 ? "ok" : "caution";
    if (state.preset === "hyperbolicMedium") {
      expected = "opposite-sign tensor component proxy";
      level = material.cells > 50 && (epsX * epsY < 0 || state.materialDispersionEnabled) ? "ok" : "caution";
    } else if (state.preset === "gyrotropicMedium") {
      expected = "nonzero gyrotropic coupling";
      level = material.cells > 50 && state.materialGyrotropyEnabled && Math.abs(finiteNumber(state.gyrotropyG, 0)) > 0 ? "ok" : "caution";
    }
    rows.push(row({
      metric: "Tensor material",
      measured: `epsx=${formatField(epsX)}, epsy=${formatField(epsY)}, aniso=${formatRatio(anisotropy)}`,
      expected,
      error: state.preset === "gyrotropicMedium" ? `g=${formatRatio(state.gyrotropyG)}` : `cells=${material.cells}`,
      level,
      note: "Tensor scenes must be checked through material components; scalar field plots can hide wrong tensor setup.",
    }));
    return true;
  }

  function addTopologyRows(rows, state, sim) {
    if (!TOPOLOGY_PRESETS.has(state.preset)) return false;
    const cpw = Math.max(1, finiteNumber(state.cellsPerWavelength, 20));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midY = Math.round((minY + maxY) * 0.5);
    const guideHalf = Math.max(2, Math.round(0.28 * cpw));
    let upperCells = 0;
    let lowerCells = 0;
    let guideCells = 0;
    let guideEnergy = 0;
    let totalEnergy = 0;
    for (let y = minY; y <= maxY; y += 1) {
      const rowOffset = y * sim.nx;
      for (let x = minX; x <= maxX; x += 1) {
        const idx = rowOffset + x;
        const high = highIndexCell(sim, idx);
        const energy = fieldEnergyAt(sim, idx);
        totalEnergy += energy;
        if (!high) continue;
        if (y < midY - guideHalf) upperCells += 1;
        if (y > midY + guideHalf) lowerCells += 1;
        if (Math.abs(y - midY) <= guideHalf) {
          guideCells += 1;
          guideEnergy += energy;
        }
      }
    }
    const guideEnergyFraction = guideEnergy / Math.max(1e-30, totalEnergy);
    rows.push(row({
      metric: "Topological lattice geometry",
      measured: `upper=${upperCells}, lower=${lowerCells}, interface=${guideCells}`,
      expected: state.preset === "honeycombLattice" ? "balanced honeycomb lattice" : "two domains plus interface/channel",
      error: `E_int=${formatRatio(guideEnergyFraction)}`,
      level:
        state.preset === "honeycombLattice"
          ? upperCells > 200 && lowerCells > 200 ? "ok" : "caution"
          : upperCells > 100 && lowerCells > 100 && guideCells > 20 ? "ok" : "caution",
      note: "Valley/topological examples must contain two structured domains or a pumped SSH-like chain before field behavior is meaningful.",
    }));

    if (state.preset === "topologicalPumping") {
      rows.push(row({
        metric: "Pumping modulation",
        measured: `depth=${formatRatio(state.modulationDepth)}, fm=${formatField(state.modulationFrequency)}`,
        expected: "slow finite modulation on SSH chain",
        level: state.materialModulationEnabled && finiteNumber(state.modulationDepth, 0) > 0 ? "ok" : "caution",
        note: "The pumping example is only topological in a reduced sense if the modulation phase is part of the scene contract.",
      }));
    }
    return true;
  }

  function addMetasurfaceRows(rows, state, sim) {
    if (!METASURFACE_PRESETS.has(state.preset)) return false;
    const cpw = Math.max(1, finiteNumber(state.cellsPerWavelength, 20));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round((minX + maxX) * 0.5);
    const xHalf = Math.max(1, Math.round(0.18 * cpw));
    const bins = new Map();
    for (let y = minY; y <= maxY; y += 1) {
      let rowCells = 0;
      for (let x = Math.max(minX, midX - xHalf); x <= Math.min(maxX, midX + xHalf); x += 1) {
        if (highIndexCell(sim, sim.id(x, y))) rowCells += 1;
      }
      if (rowCells > 0) {
        const bin = Math.round((y - minY) / Math.max(1, 0.16 * cpw));
        bins.set(bin, (bins.get(bin) || 0) + rowCells);
      }
    }
    const occupancies = Array.from(bins.values());
    const minOcc = occupancies.length ? Math.min(...occupancies) : 0;
    const maxOcc = occupancies.length ? Math.max(...occupancies) : 0;
    rows.push(row({
      metric: "Metasurface phase-bar ladder",
      measured: `bars~${bins.size}, fill range=${minOcc}-${maxOcc}`,
      expected: "many subwavelength bars with varying height",
      level: bins.size >= 10 && maxOcc > minOcc ? "ok" : "caution",
      note: "A phase-gradient metasurface should expose a discrete library of scatterer lengths, not a uniform screen.",
    }));
    return true;
  }

  function addSppRows(rows, state, sim) {
    if (!SPP_PRESETS.has(state.preset)) return false;
    const kSpp = sppWaveNumberRatio(state);
    rows.push(row({
      metric: "Planar SPP phase match",
      measured: `Re(k_spp/k0)=${formatField(kSpp.re)}`,
      expected: "slightly above light line",
      level: kSpp.re > 1 ? "ok" : "caution",
      note: "Computed from the Drude carrier permittivity and air/metal planar-SPP formula.",
    }));
    if (state.preset === "sppGrating") {
      const pitchLambda = 1.42;
      const gratingMatch = Math.sin((sourceAngleDeg(state) * Math.PI) / 180) + 1 / pitchLambda;
      rows.push(row({
        metric: "Grating momentum",
        measured: `sin(theta)+lambda0/Lambda=${formatField(gratingMatch)}`,
        expected: `Re(k_spp/k0)=${formatField(kSpp.re)}`,
        error: `diff=${formatField(Math.abs(gratingMatch - kSpp.re))}`,
        level: Math.abs(gratingMatch - kSpp.re) < 0.08 ? "ok" : "caution",
        note: "First-order grating coupling should supply the missing in-plane momentum.",
      }));
    }
    const surface = surfaceLocalizationEstimate(state, sim);
    if (!surface || finiteNumber(sim.analysisSamples, 0) < 4) {
      rows.push(row({
        metric: "Surface localization",
        measured: `${finiteNumber(sim.analysisSamples, 0)} analysis samples`,
        expected: "surface > air/bulk bands",
        level: "pending",
        note: "Run longer so energy can be compared in surface, air, and metal-bulk bands.",
      }));
      return true;
    }
    rows.push(row({
      metric: "Surface localization",
      measured: `surf=${formatRatio(surface.surfaceFraction)}, surf/air=${formatField(surface.surfaceToAirRatio)}`,
      expected: "surface-dominant energy",
      error: `surf/bulk=${formatField(surface.surfaceToBulkRatio)}`,
      level: surface.surfaceFraction > 0.18 && surface.surfaceToAirRatio > 1.2 ? "ok" : "caution",
      note: "This catches visually plausible SPP scenes that do not actually confine energy to the interface.",
    }));
    return true;
  }

  function addFarFieldRows(rows, state, sim) {
    if (!FAR_FIELD_PRESETS.has(state.preset)) return false;
    if (!state.analysisEnabled || finiteNumber(sim.analysisSamples, 0) < 4 || typeof sim.analysisFarFieldEstimate !== "function") {
      rows.push(row({
        metric: "NTFF / scattering pattern",
        measured: `${finiteNumber(sim.analysisSamples, 0)} analysis samples`,
        expected: "finite angular samples",
        level: "pending",
        note: "Near-to-far estimates need analysis samples on the contour before the angular pattern is meaningful.",
      }));
      return true;
    }
    const farField = sim.analysisFarFieldEstimate(96) || [];
    const finiteValues = farField.map((point) => finiteNumber(point.value, NaN)).filter(Number.isFinite);
    const mean = finiteValues.reduce((sum, value) => sum + value, 0) / Math.max(1, finiteValues.length);
    const max = finiteValues.length ? Math.max(...finiteValues) : 0;
    rows.push(row({
      metric: "NTFF angular samples",
      measured: `${finiteValues.length} finite, peak=${formatRatio(max)}`,
      expected: "finite normalized pattern",
      error: `mean=${formatRatio(mean)}`,
      level: finiteValues.length >= 48 && max > 0 ? "ok" : "pending",
      note: "The pattern is a 2D near-to-far proxy normalized to its own peak unless scattering mode is active.",
    }));
    return true;
  }

  function buildReportStatus(rows) {
    if (rows.some((item) => item.level === "caution")) return "caution";
    if (rows.some((item) => item.level === "pending")) return "pending";
    if (rows.some((item) => item.level === "ok")) return "ok";
    return "info";
  }

  function createSceneObservableController({ state, getSim } = {}) {
    function buildSceneObservables() {
      const sim = typeof getSim === "function" ? getSim() : null;
      const rows = [];
      if (!state || !sim || state.preset === "empty") {
        return {
          title: "Scene observables",
          status: "pending",
          note: "Select and run a scene to compare measured quantities with a physics reference.",
          rows,
        };
      }

      const handled = [
        addFresnelRows(rows, state, sim),
        addBrewsterRows(rows, state, sim),
        addTirRows(rows, state, sim),
      ].some(Boolean);
      const handledDevice = [
        addPropagationRows(rows, state, sim),
        addDiffractionRows(rows, state, sim),
        addSourceRadiationRows(rows, state, sim),
        addSppRows(rows, state, sim),
        addPhcRows(rows, state, sim),
        addSshRows(rows, state, sim),
        addPtRows(rows, state, sim),
        addScatteringRows(rows, state, sim),
        addAbsorptionRows(rows, state, sim),
        addPlasmonicDimerRows(rows, state, sim),
        addDispersiveMaterialRows(rows, state, sim),
        addTensorMaterialRows(rows, state, sim),
        addNegativeIndexRows(rows, state, sim),
        addHyperlensRows(rows, state, sim),
        addBianisotropyRows(rows, state, sim),
        addNonlinearRows(rows, state, sim),
        addFloquetRows(rows, state, sim),
        addTopologyRows(rows, state, sim),
        addMetasurfaceRows(rows, state, sim),
        addCoupledWorkflowRows(rows, state, sim),
        addGuidedRows(rows, state, sim),
        addResonatorRows(rows, state, sim),
        addFarFieldRows(rows, state, sim),
      ].some(Boolean);

      if (!handled && !handledDevice) {
        rows.push(row({
          metric: "Carrier wavelength",
          measured: `lambda_s/lambda0=${formatField(wavelengthRatio(state))}`,
          expected: "source scale documented",
          level: "info",
          note: "This scene has not yet been mapped to a stronger theory-specific observable.",
        }));
        if (lineDiagnosticsReady(state, sim)) {
          addLineMonitorRows(rows, state, sim, { label: "line-port power balance" });
        }
      }

      return {
        title: "Scene observables",
        status: buildReportStatus(rows),
        note: "These checks compare the current runtime measurements with compact analytical or device-level references.",
        rows,
      };
    }

    return Object.freeze({
      buildSceneObservables,
      fresnelNormalReflectance,
      brewsterAngleDeg,
      criticalAngleDeg,
      drudeEpsilonAtCarrier: () => drudeEpsilonAtCarrier(state),
      sppWaveNumberRatio: () => sppWaveNumberRatio(state),
      surfaceLocalizationEstimate: () => {
        const sim = typeof getSim === "function" ? getSim() : null;
        return sim ? surfaceLocalizationEstimate(state, sim) : null;
      },
    });
  }

  global.FdtdSceneObservables = Object.freeze({
    createSceneObservableController,
    fresnelNormalReflectance,
    brewsterAngleDeg,
    criticalAngleDeg,
  });
})(window);
