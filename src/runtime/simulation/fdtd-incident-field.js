(function initFdtdIncidentField(global) {
  "use strict";

  const PROFILE_UNIFORM = 0;
  const PROFILE_GAUSSIAN = 1;
  const MODE_CONTINUOUS_PLANE_WAVE = "continuousPlaneWave";
  const MODE_DISCRETE_MONOCHROMATIC_PLANE_WAVE = "discreteMonochromaticPlaneWave";

  function finiteOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function sourceIncidentMedium(sim, sx, sy) {
    const idx = sim.id(sx, sy);
    const eps = Math.max(1e-6, Math.abs(0.5 * (finiteOrDefault(sim.eps[idx], 1) + finiteOrDefault(sim.epsY[idx], 1))));
    const mu = Math.max(1e-6, Math.abs(0.5 * (finiteOrDefault(sim.mu[idx], 1) + finiteOrDefault(sim.muY[idx], 1))));
    return {
      n: Math.sqrt(eps * mu),
      z: Math.sqrt(mu / eps),
    };
  }

  function continuousWaveNumber(source, medium, courant) {
    return (2 * Math.PI * Math.max(0, Number(source.frequency) || 0) * medium.n) / Math.max(courant, 1e-9);
  }

  function discreteYeeWaveNumber(source, medium, cosTheta, sinTheta, courant) {
    const omega = 2 * Math.PI * Math.max(0, Number(source.frequency) || 0);
    if (!(omega > 0) || !(medium.n > 0)) return 0;
    const continuousK = (omega * medium.n) / Math.max(courant, 1e-9);
    const target = (medium.n * Math.abs(Math.sin(0.5 * omega))) / Math.max(courant, 1e-9);
    if (!(target > 0)) return continuousK;

    const absCos = Math.abs(cosTheta);
    const absSin = Math.abs(sinTheta);
    let upper = Math.PI / Math.max(absCos, absSin, 1e-9);
    upper = Math.max(continuousK, Math.min(upper, Math.PI * Math.SQRT2));

    const spatialNorm = (k) => Math.hypot(Math.sin(0.5 * k * cosTheta), Math.sin(0.5 * k * sinTheta));
    if (spatialNorm(upper) < target) return upper;

    let low = 0;
    let high = upper;
    for (let i = 0; i < 48; i += 1) {
      const mid = 0.5 * (low + high);
      if (spatialNorm(mid) < target) low = mid;
      else high = mid;
    }
    return 0.5 * (low + high);
  }

  function planeWaveMode(source) {
    return source?.type === "sine" ? MODE_DISCRETE_MONOCHROMATIC_PLANE_WAVE : MODE_CONTINUOUS_PLANE_WAVE;
  }

  function componentScales(kCells, cosTheta, sinTheta, z) {
    const kxCells = kCells * cosTheta;
    const kyCells = kCells * sinTheta;
    const sinKx = Math.sin(0.5 * kxCells);
    const sinKy = Math.sin(0.5 * kyCells);
    const spatialNorm = Math.hypot(sinKx, sinKy);
    const impedance = Math.max(1e-9, z);
    if (!(spatialNorm > 1e-12)) {
      return {
        kxCells,
        kyCells,
        tmHxScale: sinTheta / impedance,
        tmHyScale: -cosTheta / impedance,
        teExScale: -sinTheta * impedance,
        teEyScale: cosTheta * impedance,
      };
    }
    return {
      kxCells,
      kyCells,
      tmHxScale: sinKy / (impedance * spatialNorm),
      tmHyScale: -sinKx / (impedance * spatialNorm),
      teExScale: (-impedance * sinKy) / spatialNorm,
      teEyScale: (impedance * sinKx) / spatialNorm,
    };
  }

  function profileCode(source) {
    return source?.shape === "gaussianProfile" ? PROFILE_GAUSSIAN : PROFILE_UNIFORM;
  }

  function profileFwhmCells(sim, state, source) {
    if (source?.shape !== "gaussianProfile") return 1;
    return state.preset === "customSlab" ? sim.slabCoreThicknessCells() : Math.max(4, Math.round(sim.ny * 0.09));
  }

  function sourceRamp(source, t) {
    if (source?.type !== "sine") return 1;
    const f = Math.max(0, Number(source.frequency) || 0);
    if (!(f > 0) || t <= 0) return 0;
    const rampDuration = Math.max(24, 1.5 / f);
    return t >= rampDuration ? 1 : Math.sin((0.5 * Math.PI * t) / rampDuration) ** 2;
  }

  function sourceShutdownFactor(source, solverTime) {
    const retireStartTime = Number(source?.retireStartTime);
    const retireDuration = Math.max(1, Number(source?.retireDuration) || 0);
    if (!Number.isFinite(retireStartTime) || !(retireDuration > 0)) return 1;
    const elapsed = (Number(solverTime) || 0) - retireStartTime;
    if (!(elapsed > 0)) return 1;
    if (elapsed >= retireDuration) return 0;
    return 0.5 * (1 + Math.cos((Math.PI * elapsed) / retireDuration));
  }

  function sourceSampleAtTime(source, t) {
    const f = Number(source.frequency) || 0;
    const amp = Number(source.amplitude) || 0;
    if (source.type === "gaussian") {
      const center = 48;
      const width = 14;
      return amp * Math.exp(-((t - center) * (t - center)) / (2 * width * width));
    }
    if (source.type === "ricker") {
      const center = 48;
      const a = Math.PI * f * (t - center);
      const a2 = a * a;
      return amp * (1 - 2 * a2) * Math.exp(-a2);
    }
    return amp * sourceRamp(source, t) * Math.sin(2 * Math.PI * f * t);
  }

  function envelope(descriptor, x, y) {
    if (descriptor.profileCode !== PROFILE_GAUSSIAN) return 1;
    const transverse = -(x - descriptor.sx) * descriptor.sinTheta + (y - descriptor.sy) * descriptor.cosTheta;
    return Math.exp(-4 * Math.LN2 * (transverse / descriptor.fwhmCells) * (transverse / descriptor.fwhmCells));
  }

  function sampleAtPhaseTime(descriptor, t, phaseRad = 0) {
    const source = descriptor.source;
    const f = Number(source.frequency) || 0;
    const absolutePhase = ((Number(source.phaseDeg) || 0) * Math.PI) / 180;
    const phaseTimeOffset = f > 0 ? (phaseRad + absolutePhase) / (2 * Math.PI * f) : 0;
    const shutdown = sourceShutdownFactor(source, t);
    return shutdown <= 0 ? 0 : shutdown * sourceSampleAtTime(source, t + phaseTimeOffset);
  }

  function scalar(descriptor, x, y, t, fieldScale) {
    const phase = -(descriptor.kxCells * (x - descriptor.sx) + descriptor.kyCells * (y - descriptor.sy));
    const value = sampleAtPhaseTime(descriptor, t, phase) * envelope(descriptor, x, y);
    return Number.isFinite(fieldScale) && fieldScale !== 0 ? value / fieldScale : 0;
  }

  function tmIncidentH(descriptor, x, y, t, fieldScale) {
    const value = scalar(descriptor, x, y, t, fieldScale);
    return {
      hx: descriptor.tmHxScale * value,
      hy: descriptor.tmHyScale * value,
    };
  }

  function teIncidentE(descriptor, x, y, t, fieldScale) {
    const value = scalar(descriptor, x, y, t, fieldScale);
    return {
      ex: descriptor.teExScale * value,
      ey: descriptor.teEyScale * value,
    };
  }

  function createTfsfDescriptor({ sim, state, source, courant }) {
    const sx = sim.sourceXCell(source);
    const sy = sim.sourceYCell(source);
    const theta = (source.angleDeg * Math.PI) / 180;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const medium = sourceIncidentMedium(sim, sx, sy);
    const mode = planeWaveMode(source);
    const kCells =
      mode === MODE_DISCRETE_MONOCHROMATIC_PLANE_WAVE
        ? discreteYeeWaveNumber(source, medium, cosTheta, sinTheta, courant)
        : continuousWaveNumber(source, medium, courant);
    const directionX = cosTheta >= 0 ? 1 : -1;
    const minX = Math.max(1, sim.activeInteriorMinX());
    const maxX = Math.min(sim.nx - 2, sim.activeInteriorMaxX());
    const minY = Math.max(1, sim.activeInteriorMinY());
    const maxY = Math.min(sim.ny - 2, sim.activeInteriorMaxY());
    const x0 = directionX > 0 ? clampInt(sx, minX + 1, maxX - 1) : minX;
    const x1 = directionX > 0 ? maxX : clampInt(sx, minX + 1, maxX - 1);
    if (x1 <= x0 || minY + 1 >= maxY) return null;
    return {
      source,
      mode,
      sx,
      sy,
      cosTheta,
      sinTheta,
      kCells,
      ...componentScales(kCells, cosTheta, sinTheta, medium.z),
      z: medium.z,
      profileCode: profileCode(source),
      fwhmCells: profileFwhmCells(sim, state, source),
      x0,
      x1,
      y0: minY,
      y1: maxY,
    };
  }

  global.FdtdIncidentField = Object.freeze({
    PROFILE_UNIFORM,
    PROFILE_GAUSSIAN,
    MODE_CONTINUOUS_PLANE_WAVE,
    MODE_DISCRETE_MONOCHROMATIC_PLANE_WAVE,
    createTfsfDescriptor,
    envelope,
    scalar,
    sourceShutdownFactor,
    sourceSampleAtTime,
    teIncidentE,
    tmIncidentH,
  });
})(typeof window !== "undefined" ? window : self);
