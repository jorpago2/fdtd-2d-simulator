"use strict";

(function initFdtdSubpixelMaterials(global) {
  const RAW_EFFECTIVE_PAIRS = Object.freeze([
    ["rawEps", "eps", 1],
    ["rawLoss", "loss", 0],
    ["rawEpsY", "epsY", 1],
    ["rawLossY", "lossY", 0],
    ["rawConductivity", "conductivity", 0],
    ["rawConductivityY", "conductivityY", 0],
    ["rawMu", "mu", 1],
    ["rawMuLoss", "muLoss", 0],
    ["rawMuY", "muY", 1],
    ["rawMuLossY", "muLossY", 0],
  ]);
  const RAW_ARRAY_NAMES = Object.freeze(RAW_EFFECTIVE_PAIRS.map(([rawName]) => rawName));
  const ACTIVE_MATERIAL_EPSILON = 1e-6;
  const PASSIVE_EQUAL_EPSILON = 1e-6;

  function finiteOrDefault(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function nearlyEqual(a, b, tolerance = PASSIVE_EQUAL_EPSILON) {
    return Math.abs((Number(a) || 0) - (Number(b) || 0)) <= tolerance;
  }

  function arithmeticAverage(a, b) {
    return 0.5 * (a + b);
  }

  function harmonicAverage(a, b) {
    if (!(a > ACTIVE_MATERIAL_EPSILON) || !(b > ACTIVE_MATERIAL_EPSILON)) return arithmeticAverage(a, b);
    return 2 / (1 / a + 1 / b);
  }

  function averagedCandidates(baseValue, candidates) {
    if (!candidates.length) return baseValue;
    let sum = baseValue;
    for (const value of candidates) sum += value;
    return sum / (candidates.length + 1);
  }

  function clampBounds(sim, bounds = null, padding = 1) {
    const minInteriorX = Math.max(1, sim.activeInteriorMinX?.() ?? 1);
    const maxInteriorX = Math.min(sim.nx - 2, sim.activeInteriorMaxX?.() ?? sim.nx - 2);
    const minInteriorY = Math.max(1, sim.activeInteriorMinY?.() ?? 1);
    const maxInteriorY = Math.min(sim.ny - 2, sim.activeInteriorMaxY?.() ?? sim.ny - 2);
    if (!bounds) {
      return { minX: minInteriorX, maxX: maxInteriorX, minY: minInteriorY, maxY: maxInteriorY };
    }
    return {
      minX: Math.max(minInteriorX, Math.floor(bounds.minX) - padding),
      maxX: Math.min(maxInteriorX, Math.ceil(bounds.maxX) + padding),
      minY: Math.max(minInteriorY, Math.floor(bounds.minY) - padding),
      maxY: Math.min(maxInteriorY, Math.ceil(bounds.maxY) + padding),
    };
  }

  function mergeBounds(current, next) {
    if (!next) return current || null;
    if (!current) return { ...next };
    return {
      minX: Math.min(current.minX, next.minX),
      maxX: Math.max(current.maxX, next.maxX),
      minY: Math.min(current.minY, next.minY),
      maxY: Math.max(current.maxY, next.maxY),
    };
  }

  Object.assign(FDTDSim.prototype, {
    initializeSubpixelMaterialState() {
      this.subpixelMaterialDirty = true;
      this.subpixelMaterialDirtyBounds = null;
      this.subpixelLastEnabled = null;
      this.subpixelLastFieldComponent = null;
      this.subpixelSmoothedCells = 0;
      this.subpixelRawSynced = false;
    },

    fillRawMaterialDefaults() {
      for (const [rawName, _effectiveName, defaultValue] of RAW_EFFECTIVE_PAIRS) {
        this[rawName]?.fill(defaultValue);
      }
      this.subpixelRawSynced = true;
      this.markSubpixelSmoothingDirty();
    },

    rawMaterialArraysReady() {
      return RAW_ARRAY_NAMES.every((name) => this[name] && this[name].length === this.n);
    },

    syncRawMaterialCoefficientsFromEffective() {
      if (!this.rawMaterialArraysReady()) return false;
      for (const [rawName, effectiveName] of RAW_EFFECTIVE_PAIRS) {
        this[rawName].set(this[effectiveName]);
      }
      this.subpixelRawSynced = true;
      return true;
    },

    writeRawMaterialFromEffectiveAtIndex(idx) {
      if (!this.rawMaterialArraysReady() || idx < 0 || idx >= this.n) return;
      for (const [rawName, effectiveName] of RAW_EFFECTIVE_PAIRS) {
        this[rawName][idx] = this[effectiveName][idx];
      }
      this.subpixelRawSynced = true;
    },

    writeEffectiveMaterialFromRawAtIndex(idx) {
      if (!this.rawMaterialArraysReady() || idx < 0 || idx >= this.n) return;
      for (const [rawName, effectiveName, defaultValue] of RAW_EFFECTIVE_PAIRS) {
        this[effectiveName][idx] = finiteOrDefault(this[rawName][idx], defaultValue);
      }
    },

    copyRawMaterialCellByIndex(targetIdx, sourceIdx) {
      if (!this.rawMaterialArraysReady()) return;
      for (const [rawName] of RAW_EFFECTIVE_PAIRS) {
        this[rawName][targetIdx] = this[rawName][sourceIdx];
      }
    },

    markSubpixelSmoothingDirty(bounds = null) {
      this.subpixelMaterialDirty = true;
      this.subpixelMaterialDirtyBounds = mergeBounds(this.subpixelMaterialDirtyBounds, bounds);
    },

    markSubpixelSmoothingDirtyAroundCell(x, y, padding = 2) {
      this.markSubpixelSmoothingDirty({
        minX: Number(x) - padding,
        maxX: Number(x) + padding,
        minY: Number(y) - padding,
        maxY: Number(y) + padding,
      });
    },

    subpixelMaterialEnabled() {
      return Boolean(state.subpixelSmoothingEnabled);
    },

    subpixelMaterialCellIsPassive(idx) {
      if (idx < 0 || idx >= this.n) return false;
      if (this.material[idx] === 2) return false;
      if (this.modulatedMaterial[idx] || this.nonlinearMaterial[idx]) return false;
      if (this.dispersiveMaterial[idx] || this.muDispersiveMaterial[idx]) return false;
      if (this.electricTensorMaterial[idx] || this.gyrotropicMaterial[idx] || this.bianisotropicMaterial[idx]) return false;
      if (this.phaseChangeMaterial[idx]) return false;

      const eps = finiteOrDefault(this.rawEps[idx], this.eps[idx]);
      const epsY = finiteOrDefault(this.rawEpsY[idx], this.epsY[idx]);
      const mu = finiteOrDefault(this.rawMu[idx], this.mu[idx]);
      const muY = finiteOrDefault(this.rawMuY[idx], this.muY[idx]);
      const loss = finiteOrDefault(this.rawLoss[idx], this.loss[idx]);
      const lossY = finiteOrDefault(this.rawLossY[idx], this.lossY[idx]);
      const muLoss = finiteOrDefault(this.rawMuLoss[idx], this.muLoss[idx]);
      const muLossY = finiteOrDefault(this.rawMuLossY[idx], this.muLossY[idx]);
      const conductivity = finiteOrDefault(this.rawConductivity[idx], this.conductivity[idx]);
      const conductivityY = finiteOrDefault(this.rawConductivityY[idx], this.conductivityY[idx]);

      if (eps <= ACTIVE_MATERIAL_EPSILON || epsY <= ACTIVE_MATERIAL_EPSILON) return false;
      if (mu <= ACTIVE_MATERIAL_EPSILON || muY <= ACTIVE_MATERIAL_EPSILON) return false;
      if (loss < 0 || lossY < 0 || muLoss < 0 || muLossY < 0 || conductivity < 0 || conductivityY < 0) return false;
      if (!nearlyEqual(eps, epsY) || !nearlyEqual(mu, muY)) return false;
      if (!nearlyEqual(loss, lossY) || !nearlyEqual(muLoss, muLossY) || !nearlyEqual(conductivity, conductivityY)) return false;
      return true;
    },

    subpixelMaterialCellsDiffer(aIdx, bIdx) {
      if (this.material[aIdx] !== this.material[bIdx]) return true;
      return (
        !nearlyEqual(this.rawEps[aIdx], this.rawEps[bIdx]) ||
        !nearlyEqual(this.rawLoss[aIdx], this.rawLoss[bIdx]) ||
        !nearlyEqual(this.rawConductivity[aIdx], this.rawConductivity[bIdx]) ||
        !nearlyEqual(this.rawMu[aIdx], this.rawMu[bIdx]) ||
        !nearlyEqual(this.rawMuLoss[aIdx], this.rawMuLoss[bIdx])
      );
    },

    subpixelNeighborCandidates(idx, neighbors) {
      const candidates = [];
      for (const neighborIdx of neighbors) {
        if (!this.subpixelMaterialCellIsPassive(neighborIdx)) continue;
        if (!this.subpixelMaterialCellsDiffer(idx, neighborIdx)) continue;
        candidates.push(neighborIdx);
      }
      return candidates;
    },

    restoreRawCoefficientsToEffectiveRange(bounds) {
      if (!bounds || bounds.maxX < bounds.minX || bounds.maxY < bounds.minY) return;
      for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
        for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
          this.writeEffectiveMaterialFromRawAtIndex(this.id(x, y));
        }
      }
    },

    applySubpixelSmoothingToRange(bounds) {
      if (!this.subpixelMaterialEnabled() || !bounds || bounds.maxX < bounds.minX || bounds.maxY < bounds.minY) {
        this.subpixelSmoothedCells = 0;
        return 0;
      }
      let smoothedCells = 0;
      for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
        for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
          const idx = this.id(x, y);
          if (!this.subpixelMaterialCellIsPassive(idx)) continue;
          const xNeighbors = this.subpixelNeighborCandidates(idx, [this.id(x - 1, y), this.id(x + 1, y)]);
          const yNeighbors = this.subpixelNeighborCandidates(idx, [this.id(x, y - 1), this.id(x, y + 1)]);
          if (!xNeighbors.length || !yNeighbors.length) continue;

          const epsXCandidates = [];
          const epsYCandidates = [];
          const lossCandidates = [];
          const conductivityCandidates = [];
          const muXCandidates = [];
          const muYCandidates = [];
          const muLossCandidates = [];

          for (const neighborIdx of xNeighbors) {
            epsXCandidates.push(harmonicAverage(this.rawEps[idx], this.rawEps[neighborIdx]));
            epsYCandidates.push(arithmeticAverage(this.rawEpsY[idx], this.rawEpsY[neighborIdx]));
            lossCandidates.push(arithmeticAverage(this.rawLoss[idx], this.rawLoss[neighborIdx]));
            conductivityCandidates.push(arithmeticAverage(this.rawConductivity[idx], this.rawConductivity[neighborIdx]));
            muXCandidates.push(harmonicAverage(this.rawMu[idx], this.rawMu[neighborIdx]));
            muYCandidates.push(arithmeticAverage(this.rawMuY[idx], this.rawMuY[neighborIdx]));
            muLossCandidates.push(arithmeticAverage(this.rawMuLoss[idx], this.rawMuLoss[neighborIdx]));
          }
          for (const neighborIdx of yNeighbors) {
            epsXCandidates.push(arithmeticAverage(this.rawEps[idx], this.rawEps[neighborIdx]));
            epsYCandidates.push(harmonicAverage(this.rawEpsY[idx], this.rawEpsY[neighborIdx]));
            lossCandidates.push(arithmeticAverage(this.rawLoss[idx], this.rawLoss[neighborIdx]));
            conductivityCandidates.push(arithmeticAverage(this.rawConductivity[idx], this.rawConductivity[neighborIdx]));
            muXCandidates.push(arithmeticAverage(this.rawMu[idx], this.rawMu[neighborIdx]));
            muYCandidates.push(harmonicAverage(this.rawMuY[idx], this.rawMuY[neighborIdx]));
            muLossCandidates.push(arithmeticAverage(this.rawMuLoss[idx], this.rawMuLoss[neighborIdx]));
          }

          this.eps[idx] = averagedCandidates(this.rawEps[idx], epsXCandidates);
          this.epsY[idx] = averagedCandidates(this.rawEpsY[idx], epsYCandidates);
          this.loss[idx] = Math.max(0, averagedCandidates(this.rawLoss[idx], lossCandidates));
          this.lossY[idx] = this.loss[idx];
          this.conductivity[idx] = Math.max(0, averagedCandidates(this.rawConductivity[idx], conductivityCandidates));
          this.conductivityY[idx] = this.conductivity[idx];
          this.mu[idx] = averagedCandidates(this.rawMu[idx], muXCandidates);
          this.muY[idx] = averagedCandidates(this.rawMuY[idx], muYCandidates);
          this.muLoss[idx] = Math.max(0, averagedCandidates(this.rawMuLoss[idx], muLossCandidates));
          this.muLossY[idx] = this.muLoss[idx];
          smoothedCells += 1;
        }
      }
      this.subpixelSmoothedCells = smoothedCells;
      return smoothedCells;
    },

    rebuildSubpixelMaterialCoefficients(options = {}) {
      if (!this.rawMaterialArraysReady()) return false;
      if (!this.subpixelRawSynced) this.syncRawMaterialCoefficientsFromEffective();
      const enabled = this.subpixelMaterialEnabled();
      const fieldComponent = state.fieldComponent === "hz" ? "hz" : "ez";
      const force = Boolean(options.force);
      const settingChanged = this.subpixelLastEnabled !== enabled || this.subpixelLastFieldComponent !== fieldComponent;
      if (!force && !settingChanged && !this.subpixelMaterialDirty) return false;

      const dirtyBounds = force || settingChanged ? null : this.subpixelMaterialDirtyBounds;
      const bounds = clampBounds(this, dirtyBounds, 2);
      this.restoreRawCoefficientsToEffectiveRange(bounds);
      this.applySubpixelSmoothingToRange(bounds);
      this.subpixelMaterialDirty = false;
      this.subpixelMaterialDirtyBounds = null;
      this.subpixelLastEnabled = enabled;
      this.subpixelLastFieldComponent = fieldComponent;
      this.markMaterialChanged({ texture: false, values: true });
      if (options.refreshCpml !== false) {
        this.refreshCpmlMaterialContinuation(false);
      }
      return true;
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
