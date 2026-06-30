(function initFdtdFieldObservables() {
  "use strict";

  Object.assign(FDTDSim.prototype, {
    fieldValueAt(i, display = state.fieldDisplay) {
      if (state.viewMode === "poynting") {
        const s = this.poyntingAt(i);
        if (display === "transverseX") return s.x;
        if (display === "transverseY") return s.y;
        return Math.hypot(s.x, s.y);
      }
      if (display === "transverseX") return this.hx[i];
      if (display === "transverseY") return this.hy[i];
      if (display === "electricMag") {
        if (state.fieldComponent === "hz") {
          if (this.fullVectorBianisotropyActive()) return Math.hypot(this.hx[i], this.hy[i], this.dualEz[i]);
          return Math.hypot(this.hx[i], this.hy[i]);
        }
        return Math.abs(this.ez[i]);
      }
      if (display === "magneticMag") {
        if (state.fieldComponent === "hz") {
          if (this.fullVectorBianisotropyActive()) return Math.hypot(this.ez[i], this.dualHx[i], this.dualHy[i]);
          return Math.abs(this.ez[i]);
        }
        return Math.hypot(this.hx[i], this.hy[i]);
      }
      return this.ez[i];
    },

    poyntingAt(i) {
      if (state.fieldComponent === "hz") {
        if (this.fullVectorBianisotropyActive()) {
          return {
            x: this.hy[i] * this.ez[i] - this.dualEz[i] * this.dualHy[i],
            y: this.dualEz[i] * this.dualHx[i] - this.hx[i] * this.ez[i],
          };
        }
        return { x: this.hy[i] * this.ez[i], y: -this.hx[i] * this.ez[i] };
      }
      return { x: -this.ez[i] * this.hy[i], y: this.ez[i] * this.hx[i] };
    },

    fieldPhysicalScale() {
      return state.viewMode === "poynting" ? this.fieldScale * this.fieldScale : this.fieldScale;
    },

    fieldPowerScale() {
      const scale = Number(this.fieldScale);
      if (!Number.isFinite(scale)) return scale > 0 ? Infinity : 0;
      return scale * scale;
    },

    fieldPhysicalLogScale() {
      return (state.viewMode === "poynting" ? 2 : 1) * this.fieldLog10Scale;
    },

    fieldDisplayIsMagnitude() {
      return fieldDisplayConfig().magnitude;
    },

    transverseVectorAt(i) {
      if (state.viewMode === "poynting") return this.poyntingAt(i);
      return { x: this.hx[i], y: this.hy[i] };
    },
  });
})();
