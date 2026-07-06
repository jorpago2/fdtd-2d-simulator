(function initFdtdFieldState() {
  "use strict";

  function valuesNearlyEqual(left, right) {
    const scale = Math.max(1, Math.abs(left), Math.abs(right));
    return Math.abs(left - right) <= 1e-6 * scale;
  }

  function rebalanceSplitPair(totalField, splitX, splitY, previousSplitX = null, previousSplitY = null, shouldRebalance = null) {
    if (!totalField || !splitX || !splitY) return;
    const length = Math.min(totalField.length, splitX.length, splitY.length);
    for (let i = 0; i < length; i += 1) {
      if (shouldRebalance && !shouldRebalance(i)) continue;
      const value = totalField[i];
      if (!Number.isFinite(value)) {
        totalField[i] = 0;
        splitX[i] = 0;
        splitY[i] = 0;
      } else {
        const half = value * 0.5;
        splitX[i] = half;
        splitY[i] = value - half;
      }
      if (previousSplitX && i < previousSplitX.length) previousSplitX[i] = splitX[i];
      if (previousSplitY && i < previousSplitY.length) previousSplitY[i] = splitY[i];
    }
  }

  Object.assign(FDTDSim.prototype, {
    markFieldsChanged() {
      this.fieldTextureRevision = (Number(this.fieldTextureRevision) || 0) + 1;
      this.measureCache = null;
    },

    resetFields() {
      this.ez.fill(0);
      this.ezx.fill(0);
      this.ezy.fill(0);
      this.hx.fill(0);
      this.hy.fill(0);
      this.restoreDynamicMaterialsToBase?.();
      this.dispPz?.fill(0);
      this.dispJz?.fill(0);
      this.dispPx?.fill(0);
      this.dispJx?.fill(0);
      this.dispPy?.fill(0);
      this.dispJy?.fill(0);
      this.magDispMz?.fill(0);
      this.magDispJz?.fill(0);
      this.magDispMx?.fill(0);
      this.magDispJx?.fill(0);
      this.magDispMy?.fill(0);
      this.magDispJy?.fill(0);
      this.dualEz?.fill(0);
      this.dualEzx?.fill(0);
      this.dualEzy?.fill(0);
      this.dualHx?.fill(0);
      this.dualHy?.fill(0);
      this.bianisotropyPrevScalar?.fill(0);
      this.bianisotropyPrevSplitX?.fill(0);
      this.bianisotropyPrevSplitY?.fill(0);
      this.bianisotropyPrevTx?.fill(0);
      this.bianisotropyPrevTy?.fill(0);
      this.bianisotropyPrevDualEz?.fill(0);
      this.bianisotropyPrevDualEzx?.fill(0);
      this.bianisotropyPrevDualEzy?.fill(0);
      this.bianisotropyPrevDualHx?.fill(0);
      this.bianisotropyPrevDualHy?.fill(0);
      this.harmonicPrevPz?.fill(0);
      this.harmonicPrevPx?.fill(0);
      this.harmonicPrevPy?.fill(0);
      this.resetCpmlMemory?.();
      this.time = 0;
      this.lastMax = 0;
      this.lastMaxLog10 = -Infinity;
      this.lastEnergy = 0;
      this.lastEnergyLog10 = -Infinity;
      this.measureCache = null;
      this.uiMeasureCache = null;
      this.lastMeasureTimeMs = 0;
      this.lastMaxwellCheck = null;
      this.lastViewRange = 1;
      this.lastViewRangeLog10 = 0;
      this.resetDiagnostics();
      this.fieldScale = 1;
      this.fieldLog10Scale = 0;
      this.lastRenormalized = false;
      this.lastDiverged = false;
      this.markFieldsChanged();
    },

    splitScalarStorageIsIsotropic(i) {
      if (this.material?.[i] === 2) return true;
      if (this.bianisotropicMaterial?.[i]) return false;
      if (state.fieldComponent === "hz") {
        return valuesNearlyEqual(this.mu[i], this.muY[i]) && valuesNearlyEqual(this.muLoss[i], this.muLossY[i]);
      }
      return (
        valuesNearlyEqual(this.eps[i], this.epsY[i]) &&
        valuesNearlyEqual(this.loss[i], this.lossY[i]) &&
        valuesNearlyEqual(this.conductivity[i], this.conductivityY[i])
      );
    },

    reconcileSplitScalarState(options = {}) {
      const shouldRebalance = options.isotropicOnly ? (i) => this.splitScalarStorageIsIsotropic(i) : null;
      rebalanceSplitPair(this.ez, this.ezx, this.ezy, this.bianisotropyPrevSplitX, this.bianisotropyPrevSplitY, shouldRebalance);
      if (this.dualEz && this.dualEzx && this.dualEzy) {
        rebalanceSplitPair(
          this.dualEz,
          this.dualEzx,
          this.dualEzy,
          this.bianisotropyPrevDualEzx,
          this.bianisotropyPrevDualEzy,
          shouldRebalance,
        );
      }
    },

    stabilizeAfterSourceMutation() {
      this.reconcileSplitScalarState({ isotropicOnly: true });
      this.liveRenderScaleCache = null;
      this.lastRenormalized = false;
      this.lastDiverged = false;
      this.resetDiagnostics();
      this.markFieldsChanged();
    },

    setFieldLog10Scale(value) {
      this.fieldLog10Scale = value;
      this.fieldScale = value < 300 ? Math.pow(10, value) : Infinity;
    },

    renormalizationArrays() {
      const arrays = [
        this.ez,
        this.ezx,
        this.ezy,
        this.hx,
        this.hy,
        this.cpmlPsiHxY,
        this.cpmlPsiHyX,
        this.cpmlPsiEzX,
        this.cpmlPsiEzY,
        this.cpmlPsiExY,
        this.cpmlPsiEyX,
        this.cpmlPsiHzX,
        this.cpmlPsiHzY,
      ].filter(Boolean);
      const fullVector = Boolean(this.fullVectorBianisotropyActive?.());

      if (state.materialBianisotropyEnabled) {
        arrays.push(
          this.bianisotropyPrevScalar,
          this.bianisotropyPrevSplitX,
          this.bianisotropyPrevSplitY,
          this.bianisotropyPrevTx,
          this.bianisotropyPrevTy,
        );
      }

      if (fullVector) {
        arrays.push(
          this.dualEz,
          this.dualEzx,
          this.dualEzy,
          this.dualHx,
          this.dualHy,
          this.cpmlPsiDualHxY,
          this.cpmlPsiDualHyX,
          this.cpmlPsiDualEzX,
          this.cpmlPsiDualEzY,
          this.bianisotropyPrevDualEz,
          this.bianisotropyPrevDualEzx,
          this.bianisotropyPrevDualEzy,
          this.bianisotropyPrevDualHx,
          this.bianisotropyPrevDualHy,
        );
      }

      return arrays.filter(Boolean);
    },

    renormalizeFields() {
      if (this.wasmBackend?.renormalizeFields?.(this) === true) return;
      const arrays = this.renormalizationArrays();
      let maxAbs = 0;

      for (const array of arrays) {
        for (let i = 0; i < array.length; i += 1) {
          const value = array[i];
          if (!Number.isFinite(value)) {
            this.resetFields();
            this.lastDiverged = true;
            return;
          }
          const abs = Math.abs(value);
          if (abs > maxAbs) maxAbs = abs;
        }
      }

      if (maxAbs <= FIELD_RENORMALIZE_HIGH) {
        this.lastRenormalized = false;
        return;
      }

      const factor = maxAbs / FIELD_RENORMALIZE_TARGET;
      for (const array of arrays) {
        for (let i = 0; i < array.length; i += 1) {
          array[i] /= factor;
        }
      }
      this.setFieldLog10Scale(this.fieldLog10Scale + Math.log10(factor));
      this.renormalizedCount += 1;
      this.lastRenormalized = true;
    },
  });
})();
