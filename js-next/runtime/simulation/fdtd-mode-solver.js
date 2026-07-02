(function initFdtdModeSolver(global) {
  "use strict";

  function finitePositive(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function clampInt(value, min, max) {
    return Math.round(Math.max(min, Math.min(max, Number(value) || 0)));
  }

  function normalizeVector(vector) {
    let normSquared = 0;
    for (let i = 0; i < vector.length; i += 1) normSquared += vector[i] * vector[i];
    const norm = Math.sqrt(normSquared);
    if (!(norm > 1e-18)) return 0;
    for (let i = 0; i < vector.length; i += 1) vector[i] /= norm;
    return norm;
  }

  function dot(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
    return sum;
  }

  function applyTridiagonal(diagonal, offDiagonal, vector, out) {
    const n = diagonal.length;
    for (let i = 0; i < n; i += 1) {
      out[i] =
        diagonal[i] * vector[i] +
        (i > 0 ? offDiagonal[i - 1] * vector[i - 1] : 0) +
        (i + 1 < n ? offDiagonal[i] * vector[i + 1] : 0);
    }
    return out;
  }

  function initialModeGuess(length, modeIndex, centerIndex) {
    const vector = new Float64Array(length);
    const center = Number.isFinite(centerIndex) ? centerIndex : 0.5 * (length - 1);
    const sigma = Math.max(2, length / 8);
    for (let i = 0; i < length; i += 1) {
      const u = (i - center) / sigma;
      const gaussian = Math.exp(-0.5 * u * u);
      if (modeIndex === 0) {
        vector[i] = gaussian;
      } else if (modeIndex === 1) {
        vector[i] = u * gaussian;
      } else {
        vector[i] = Math.cos((Math.PI * modeIndex * (i + 1)) / (length + 1)) * gaussian;
      }
    }
    if (normalizeVector(vector) === 0) {
      for (let i = 0; i < length; i += 1) vector[i] = Math.sin((Math.PI * (modeIndex + 1) * (i + 1)) / (length + 1));
      normalizeVector(vector);
    }
    return vector;
  }

  function orientModeProfile(vector, centerIndex) {
    const oriented = new Float32Array(vector.length);
    let signProbe = 0;
    const center = clampInt(centerIndex, 0, vector.length - 1);
    const radius = Math.max(1, Math.round(vector.length * 0.04));
    for (let i = Math.max(0, center - radius); i <= Math.min(vector.length - 1, center + radius); i += 1) {
      signProbe += vector[i];
    }
    const sign = signProbe < 0 ? -1 : 1;
    let maxAbs = 0;
    for (let i = 0; i < vector.length; i += 1) maxAbs = Math.max(maxAbs, Math.abs(vector[i]));
    const scale = maxAbs > 0 ? sign / maxAbs : sign;
    for (let i = 0; i < vector.length; i += 1) oriented[i] = vector[i] * scale;
    return oriented;
  }

  function differentiateProfile(profile) {
    const derivative = new Float32Array(profile.length);
    if (profile.length < 2) return derivative;
    for (let i = 0; i < profile.length; i += 1) {
      if (i === 0) {
        derivative[i] = profile[1] - profile[0];
      } else if (i + 1 === profile.length) {
        derivative[i] = profile[i] - profile[i - 1];
      } else {
        derivative[i] = 0.5 * (profile[i + 1] - profile[i - 1]);
      }
    }
    return derivative;
  }

  function solveScalarModes({
    epsilonProfile,
    muProfile = null,
    k0Cells,
    modeCount = 1,
    centerIndex = null,
    maxIterations = 96,
  } = {}) {
    if (!epsilonProfile || typeof epsilonProfile.length !== "number") return [];
    const n = epsilonProfile.length;
    if (n < 5) return [];
    const k0 = finitePositive(k0Cells, 0);
    if (!(k0 > 0)) return [];
    const count = clampInt(modeCount, 1, Math.min(4, n - 2));
    const diagonal = new Float64Array(n);
    const shiftedDiagonal = new Float64Array(n);
    const offDiagonal = new Float64Array(Math.max(0, n - 1));
    const k0Squared = k0 * k0;
    // Shifted iteration targets the largest algebraic beta^2 mode, not the largest-magnitude Laplacian branch.
    const spectralShift = 4 + k0Squared * 0.01;
    let minIndex = Infinity;
    let maxIndex = 0;
    for (let i = 0; i < n; i += 1) {
      const epsilon = finitePositive(epsilonProfile[i], 1);
      const mu = finitePositive(muProfile?.[i], 1);
      const indexSquared = Math.max(1e-6, epsilon * mu);
      minIndex = Math.min(minIndex, Math.sqrt(indexSquared));
      maxIndex = Math.max(maxIndex, Math.sqrt(indexSquared));
      diagonal[i] = k0Squared * indexSquared - 2;
      shiftedDiagonal[i] = diagonal[i] + spectralShift;
      if (i + 1 < n) offDiagonal[i] = 1;
    }

    const modes = [];
    for (let modeIndex = 0; modeIndex < count; modeIndex += 1) {
      const vector = initialModeGuess(n, modeIndex, centerIndex);
      const next = new Float64Array(n);
      let eigenvalue = 0;
      for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        applyTridiagonal(shiftedDiagonal, offDiagonal, vector, next);
        for (const previousMode of modes) {
          const projection = dot(next, previousMode.vector);
          for (let i = 0; i < n; i += 1) next[i] -= projection * previousMode.vector[i];
        }
        if (normalizeVector(next) === 0) break;
        vector.set(next);
      }
      applyTridiagonal(diagonal, offDiagonal, vector, next);
      eigenvalue = dot(vector, next);
      if (!(eigenvalue > 0)) continue;
      const betaCells = Math.sqrt(eigenvalue);
      const profile = orientModeProfile(vector, centerIndex);
      modes.push({
        betaCells,
        confinementIndexMin: minIndex,
        confinementIndexMax: maxIndex,
        eigenvalue,
        neff: betaCells / k0,
        profile,
        profileDerivative: differentiateProfile(profile),
        vector: new Float64Array(vector),
      });
    }

    return modes
      .sort((a, b) => b.eigenvalue - a.eigenvalue)
      .map(({ vector, ...mode }) => mode);
  }

  global.FdtdModeSolver = Object.freeze({
    solveScalarModes,
  });
})(typeof window !== "undefined" ? window : self);
