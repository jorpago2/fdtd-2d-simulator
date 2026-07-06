"use strict";

(function initFdtdMaxwellChecker() {
  const MAXWELL_SAMPLE_TARGET = 120000;
  const MAXWELL_EPS = 1e-12;

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function residualLevel(value, samples) {
    if (!samples) return "pending";
    if (!Number.isFinite(value)) return "caution";
    if (value < 5e-3) return "ok";
    if (value < 5e-2) return "caution";
    return "unstable";
  }

  function makeAccumulator(key, label, formula, note = "") {
    return {
      key,
      label,
      formula,
      note,
      residual2: 0,
      scale2: 0,
      maxNormalized: 0,
      samples: 0,
    };
  }

  function addResidual(accumulator, residual, terms) {
    const finiteResidual = finiteNumber(residual, 0);
    let scale2 = 0;
    for (const term of terms) {
      const finiteTerm = finiteNumber(term, 0);
      scale2 += finiteTerm * finiteTerm;
    }
    const scale = Math.sqrt(scale2) + MAXWELL_EPS;
    const normalized = Math.abs(finiteResidual) / scale;
    accumulator.residual2 += finiteResidual * finiteResidual;
    accumulator.scale2 += scale * scale;
    accumulator.maxNormalized = Math.max(accumulator.maxNormalized, normalized);
    accumulator.samples += 1;
  }

  function finalizeAccumulator(accumulator) {
    const residual = accumulator.samples > 0 ? Math.sqrt(accumulator.residual2 / Math.max(accumulator.scale2, MAXWELL_EPS)) : 0;
    return {
      key: accumulator.key,
      label: accumulator.label,
      formula: accumulator.formula,
      note: accumulator.note,
      residual,
      maxResidual: accumulator.samples > 0 ? accumulator.maxNormalized : 0,
      samples: accumulator.samples,
      level: residualLevel(residual, accumulator.samples),
      bar: clamp01(Math.sqrt(Math.max(0, residual)) * 10),
    };
  }

  function materialHasExtraTerms(sim, i) {
    if (sim.material[i] === 2) return true;
    if (Math.abs(sim.loss[i] || 0) > 1e-12 || Math.abs(sim.lossY[i] || 0) > 1e-12) return true;
    if (Math.abs(sim.muLoss[i] || 0) > 1e-12 || Math.abs(sim.muLossY[i] || 0) > 1e-12) return true;
    if (Math.abs(sim.conductivity?.[i] || 0) > 1e-12 || Math.abs(sim.conductivityY?.[i] || 0) > 1e-12) return true;
    if (sim.modulatedMaterial?.[i] || sim.nonlinearMaterial?.[i] || sim.phaseChangeMaterial?.[i]) return true;
    if (sim.dispersiveMaterial?.[i] || sim.muDispersiveMaterial?.[i]) return true;
    if (sim.gyrotropicMaterial?.[i] || sim.electricTensorMaterial?.[i] || sim.bianisotropicMaterial?.[i]) return true;
    return false;
  }

  function valuesDiffer(left, right) {
    const l = finiteNumber(left, 0);
    const r = finiteNumber(right, 0);
    const scale = Math.max(1, Math.abs(l), Math.abs(r));
    return Math.abs(l - r) > 1e-8 * scale;
  }

  function materialNeighborDiffers(sim, i, j) {
    if (sim.material[j] !== sim.material[i]) return true;
    if (valuesDiffer(sim.eps[j], sim.eps[i]) || valuesDiffer(sim.epsY[j], sim.epsY[i])) return true;
    if (valuesDiffer(sim.mu[j], sim.mu[i]) || valuesDiffer(sim.muY[j], sim.muY[i])) return true;
    if (valuesDiffer(sim.loss[j], sim.loss[i]) || valuesDiffer(sim.lossY[j], sim.lossY[i])) return true;
    if (valuesDiffer(sim.conductivity?.[j], sim.conductivity?.[i]) || valuesDiffer(sim.conductivityY?.[j], sim.conductivityY?.[i])) return true;
    return false;
  }

  function materialHasLocalInterface(sim, i) {
    const nx = sim.nx;
    return (
      materialNeighborDiffers(sim, i, i - 1) ||
      materialNeighborDiffers(sim, i, i + 1) ||
      materialNeighborDiffers(sim, i, i - nx) ||
      materialNeighborDiffers(sim, i, i + nx)
    );
  }

  function sourceGuards(sim) {
    const minX = Math.max(1, sim.activeInteriorMinX?.() ?? 1);
    const maxX = Math.min(sim.nx - 2, sim.activeInteriorMaxX?.() ?? sim.nx - 2);
    const minY = Math.max(1, sim.activeInteriorMinY?.() ?? 1);
    const maxY = Math.min(sim.ny - 2, sim.activeInteriorMaxY?.() ?? sim.ny - 2);
    return (state.sources || []).map((source) => {
      const sx = typeof sim.sourceXCell === "function" ? sim.sourceXCell(source) : Math.round(finiteNumber(source.xLambda, 0) * finiteNumber(state.cellsPerWavelength, 20));
      const sy = typeof sim.sourceYCell === "function" ? sim.sourceYCell(source) : Math.round(finiteNumber(source.yLambda, 0) * finiteNumber(state.cellsPerWavelength, 20));
      const width = typeof sim.sourceEnvelopeFwhmCells === "function" ? sim.sourceEnvelopeFwhmCells(source) : 4;
      const radius = Math.max(4, Math.ceil(width * 1.25));
      const shape = source.shape || source.type || "";
      if (["line", "gaussianProfile", "evanescentLine", "modeProfile"].includes(shape)) {
        return {
          x0: Math.max(minX, sx - radius),
          x1: Math.min(maxX, sx + radius),
          y0: minY,
          y1: maxY,
        };
      }
      return {
        x0: Math.max(minX, sx - radius),
        x1: Math.min(maxX, sx + radius),
        y0: Math.max(minY, sy - radius),
        y1: Math.min(maxY, sy + radius),
      };
    });
  }

  function insideAnyGuard(x, y, guards) {
    return guards.some((guard) => x >= guard.x0 && x <= guard.x1 && y >= guard.y0 && y <= guard.y1);
  }

  function sampleBounds(sim) {
    return {
      minX: Math.max(2, (sim.activeInteriorMinX?.() ?? 1) + 2),
      maxX: Math.min(sim.nx - 3, (sim.activeInteriorMaxX?.() ?? sim.nx - 2) - 2),
      minY: Math.max(2, (sim.activeInteriorMinY?.() ?? 1) + 2),
      maxY: Math.min(sim.ny - 3, (sim.activeInteriorMaxY?.() ?? sim.ny - 2) - 2),
    };
  }

  function sampleStride(bounds) {
    const width = Math.max(1, bounds.maxX - bounds.minX + 1);
    const height = Math.max(1, bounds.maxY - bounds.minY + 1);
    return Math.max(1, Math.ceil(Math.sqrt((width * height) / MAXWELL_SAMPLE_TARGET)));
  }

  function baseReport(enabled = Boolean(state.maxwellCheckEnabled)) {
    return {
      enabled,
      status: enabled ? "pending" : "off",
      component: state.fieldComponent === "hz" ? "TEz / Hz" : "TMz / Ez",
      time: 0,
      sampleCount: 0,
      skippedCount: 0,
      stride: 1,
      rows: [],
      note: enabled
        ? "Run at least one step to compare the discrete Yee update against Maxwell curl equations."
        : "Enable the checker to compute discrete Maxwell-equation residuals.",
    };
  }

  function reportStatus(rows, sampleCount) {
    if (sampleCount <= 0) return "pending";
    if (rows.some((row) => row.level === "unstable")) return "unstable";
    if (rows.some((row) => row.level === "caution")) return "caution";
    return "ok";
  }

  function maxwellSnapshotBuffers(sim) {
    const current = sim.maxwellCheckSnapshotBuffers;
    if (current?.ez?.length === sim.n) return current;
    // ponytail: one scratch snapshot per sim; per-step allocations on large grids make the GC do unpaid lab work.
    sim.maxwellCheckSnapshotBuffers = {
      component: "ez",
      time: 0,
      ez: new Float32Array(sim.n),
      ezx: new Float32Array(sim.n),
      ezy: new Float32Array(sim.n),
      hx: new Float32Array(sim.n),
      hy: new Float32Array(sim.n),
    };
    return sim.maxwellCheckSnapshotBuffers;
  }

  Object.assign(FDTDSim.prototype, {
    captureMaxwellCheckSnapshot() {
      if (!state.maxwellCheckEnabled || this.lastDiverged) return null;
      const snapshot = maxwellSnapshotBuffers(this);
      snapshot.component = state.fieldComponent === "hz" ? "hz" : "ez";
      snapshot.time = this.time;
      snapshot.ez.set(this.ez);
      snapshot.ezx.set(this.ezx);
      snapshot.ezy.set(this.ezy);
      snapshot.hx.set(this.hx);
      snapshot.hy.set(this.hy);
      return snapshot;
    },

    maxwellCellIsSampled(x, y, i, guards) {
      if (insideAnyGuard(x, y, guards)) return false;
      if (materialHasExtraTerms(this, i)) return false;
      if (materialHasLocalInterface(this, i)) return false;
      return true;
    },

    updateMaxwellCheck(snapshot) {
      if (!state.maxwellCheckEnabled) {
        this.lastMaxwellCheck = baseReport(false);
        return;
      }
      if (!snapshot || snapshot.component !== (state.fieldComponent === "hz" ? "hz" : "ez")) {
        this.lastMaxwellCheck = baseReport(true);
        return;
      }
      const report = snapshot.component === "hz" ? this.computeHzMaxwellCheck(snapshot) : this.computeEzMaxwellCheck(snapshot);
      this.lastMaxwellCheck = report;
    },

    maxwellCheckReport() {
      if (!state.maxwellCheckEnabled) return baseReport(false);
      return this.lastMaxwellCheck || baseReport(true);
    },

    computeEzMaxwellCheck(snapshot) {
      const nx = this.nx;
      const s = Math.max(MAXWELL_EPS, this.courant);
      const bounds = sampleBounds(this);
      const stride = sampleStride(bounds);
      const guards = sourceGuards(this);
      const rows = [
        makeAccumulator("faradayX", "Faraday x", "dB_x/dt + d_y E_z = 0", "Magnetic x update from the previous Ez field."),
        makeAccumulator("faradayY", "Faraday y", "dB_y/dt - d_x E_z = 0", "Magnetic y update from the previous Ez field."),
        makeAccumulator("ampereZx", "Ampere z-x", "dD_zx/dt - d_x H_y = 0", "Split Ezx update from the current Hy curl."),
        makeAccumulator("ampereZy", "Ampere z-y", "dD_zy/dt + d_y H_x = 0", "Split Ezy update from the current Hx curl."),
        makeAccumulator("gaussB", "Gauss B", "d_x B_x + d_y B_y = 0", "Discrete divergence proxy for the transverse magnetic field."),
      ];
      let sampleCount = 0;
      let skippedCount = 0;

      for (let y = bounds.minY; y <= bounds.maxY; y += stride) {
        const row = y * nx;
        for (let x = bounds.minX; x <= bounds.maxX; x += stride) {
          const i = row + x;
          if (!this.maxwellCellIsSampled(x, y, i, guards)) {
            skippedCount += 1;
            continue;
          }
          const dEzDy0 = snapshot.ez[i + nx] - snapshot.ez[i];
          const dEzDx0 = snapshot.ez[i + 1] - snapshot.ez[i];
          const dBxDt = this.mu[i] * (this.hx[i] - snapshot.hx[i]) / s;
          const dByDt = this.muY[i] * (this.hy[i] - snapshot.hy[i]) / s;
          const dDzxDt = this.eps[i] * (this.ezx[i] - snapshot.ezx[i]) / s;
          const dDzyDt = this.epsY[i] * (this.ezy[i] - snapshot.ezy[i]) / s;
          const dHyDx = this.hy[i] - this.hy[i - 1];
          const dHxDy = this.hx[i] - this.hx[i - nx];
          const dBxDx = this.mu[i] * this.hx[i] - this.mu[i - 1] * this.hx[i - 1];
          const dByDy = this.muY[i] * this.hy[i] - this.muY[i - nx] * this.hy[i - nx];

          addResidual(rows[0], dBxDt + dEzDy0, [dBxDt, dEzDy0]);
          addResidual(rows[1], dByDt - dEzDx0, [dByDt, dEzDx0]);
          addResidual(rows[2], dDzxDt - dHyDx, [dDzxDt, dHyDx]);
          addResidual(rows[3], dDzyDt + dHxDy, [dDzyDt, dHxDy]);
          addResidual(rows[4], dBxDx + dByDy, [dBxDx, dByDy]);
          sampleCount += 1;
        }
      }

      const finalRows = rows.map(finalizeAccumulator);
      finalRows.push({
        key: "gaussD",
        label: "Gauss D",
        formula: "d_z D_z = rho_free",
        note: "In 2D TMz/Ez, fields are invariant along z, so Gauss D is structurally satisfied away from injected current sources.",
        residual: 0,
        maxResidual: 0,
        samples: sampleCount,
        level: sampleCount > 0 ? "ok" : "pending",
        bar: 0,
      });
      return {
        enabled: true,
        status: reportStatus(finalRows, sampleCount),
        component: "TMz / Ez",
        time: this.time,
        sampleCount,
        skippedCount,
        stride,
        rows: finalRows,
        note: "Residuals are normalized and sampled outside CPML, PEC, source neighborhoods, material interfaces, loss, dispersion, tensors, gain, and nonlinear cells.",
      };
    },

    computeHzMaxwellCheck(snapshot) {
      const nx = this.nx;
      const s = Math.max(MAXWELL_EPS, this.courant);
      const bounds = sampleBounds(this);
      const stride = sampleStride(bounds);
      const guards = sourceGuards(this);
      const rows = [
        makeAccumulator("ampereX", "Ampere x", "dD_x/dt - d_y H_z = 0", "Electric x update from the previous Hz field."),
        makeAccumulator("ampereY", "Ampere y", "dD_y/dt + d_x H_z = 0", "Electric y update from the previous Hz field."),
        makeAccumulator("faradayZx", "Faraday z-x", "dB_zx/dt + d_x E_y = 0", "Split Hzx update from the current Ey curl."),
        makeAccumulator("faradayZy", "Faraday z-y", "dB_zy/dt - d_y E_x = 0", "Split Hzy update from the current Ex curl."),
        makeAccumulator("gaussD", "Gauss D", "d_x D_x + d_y D_y = rho_free", "Discrete divergence proxy for in-plane electric flux."),
      ];
      let sampleCount = 0;
      let skippedCount = 0;

      for (let y = bounds.minY; y <= bounds.maxY; y += stride) {
        const row = y * nx;
        for (let x = bounds.minX; x <= bounds.maxX; x += stride) {
          const i = row + x;
          if (!this.maxwellCellIsSampled(x, y, i, guards)) {
            skippedCount += 1;
            continue;
          }
          const dHzDy0 = snapshot.ez[i + nx] - snapshot.ez[i];
          const dHzDx0 = snapshot.ez[i + 1] - snapshot.ez[i];
          const dDxDt = this.eps[i] * (this.hx[i] - snapshot.hx[i]) / s;
          const dDyDt = this.epsY[i] * (this.hy[i] - snapshot.hy[i]) / s;
          const dBzxDt = this.mu[i] * (this.ezx[i] - snapshot.ezx[i]) / s;
          const dBzyDt = this.muY[i] * (this.ezy[i] - snapshot.ezy[i]) / s;
          const dEyDx = this.hy[i] - this.hy[i - 1];
          const dExDy = this.hx[i] - this.hx[i - nx];
          const dDxDx = this.eps[i] * this.hx[i] - this.eps[i - 1] * this.hx[i - 1];
          const dDyDy = this.epsY[i] * this.hy[i] - this.epsY[i - nx] * this.hy[i - nx];

          addResidual(rows[0], dDxDt - dHzDy0, [dDxDt, dHzDy0]);
          addResidual(rows[1], dDyDt + dHzDx0, [dDyDt, dHzDx0]);
          addResidual(rows[2], dBzxDt + dEyDx, [dBzxDt, dEyDx]);
          addResidual(rows[3], dBzyDt - dExDy, [dBzyDt, dExDy]);
          addResidual(rows[4], dDxDx + dDyDy, [dDxDx, dDyDy]);
          sampleCount += 1;
        }
      }

      const finalRows = rows.map(finalizeAccumulator);
      finalRows.push({
        key: "gaussB",
        label: "Gauss B",
        formula: "d_z B_z = 0",
        note: "In 2D TEz/Hz, fields are invariant along z, so Gauss B is structurally satisfied away from magnetic sources.",
        residual: 0,
        maxResidual: 0,
        samples: sampleCount,
        level: sampleCount > 0 ? "ok" : "pending",
        bar: 0,
      });
      return {
        enabled: true,
        status: reportStatus(finalRows, sampleCount),
        component: "TEz / Hz",
        time: this.time,
        sampleCount,
        skippedCount,
        stride,
        rows: finalRows,
        note: "Residuals are normalized and sampled outside CPML, PEC, source neighborhoods, material interfaces, loss, dispersion, tensors, gain, and nonlinear cells.",
      };
    },
  });
})();
