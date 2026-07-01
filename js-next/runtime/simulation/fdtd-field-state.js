(function initFdtdFieldState() {
  "use strict";

  Object.assign(FDTDSim.prototype, {
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
      this.lastViewRange = 1;
      this.lastViewRangeLog10 = 0;
      this.resetDiagnostics();
      this.fieldScale = 1;
      this.fieldLog10Scale = 0;
      this.lastRenormalized = false;
      this.lastDiverged = false;
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
        this.cpmlPsiDualHxY,
        this.cpmlPsiDualHyX,
        this.cpmlPsiDualEzX,
        this.cpmlPsiDualEzY,
      ].filter(Boolean);

      if (state.materialBianisotropyEnabled) {
        arrays.push(
          this.dualEz,
          this.dualEzx,
          this.dualEzy,
          this.dualHx,
          this.dualHy,
          this.bianisotropyPrevScalar,
          this.bianisotropyPrevSplitX,
          this.bianisotropyPrevSplitY,
          this.bianisotropyPrevTx,
          this.bianisotropyPrevTy,
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
