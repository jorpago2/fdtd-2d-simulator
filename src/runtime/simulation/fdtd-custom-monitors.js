(function initFdtdCustomMonitors() {
  "use strict";

  Object.assign(FDTDSim.prototype, {
    monitorXCell(monitor) {
      return clampInt(lambdaToCells(monitor.xLambda), this.activeInteriorMinX(), this.activeInteriorMaxX());
    },

    monitorYCell(monitor) {
      return clampInt(lambdaToCells(monitor.yLambda), this.activeInteriorMinY(), this.activeInteriorMaxY());
    },

    monitorLengthCells(monitor) {
      return Math.max(1, lambdaToCells(monitor.lengthLambda));
    },

    monitorSegment(monitor) {
      const cx = this.monitorXCell(monitor) + 0.5;
      const cy = this.monitorYCell(monitor) + 0.5;
      const theta = ((Number(monitor.angleDeg) || 0) * Math.PI) / 180;
      const ux = Math.cos(theta);
      const uy = Math.sin(theta);
      const length = this.monitorLengthCells(monitor);
      const half = length * 0.5;
      return {
        cx,
        cy,
        ux,
        uy,
        nx: -uy,
        ny: ux,
        length,
        x0: cx - ux * half,
        y0: cy - uy * half,
        x1: cx + ux * half,
        y1: cy + uy * half,
      };
    },

    monitorSampleCells(monitor) {
      const segment = this.monitorSegment(monitor);
      const count = clampInt(Math.ceil(segment.length) + 1, 2, Math.max(this.nx, this.ny) * 2);
      const cells = [];
      const seen = new Set();
      let duplicateSamples = 0;
      let pecSamples = 0;
      const clipped =
        Math.min(segment.x0, segment.x1) < this.activeInteriorMinX() + 0.5 ||
        Math.max(segment.x0, segment.x1) > this.activeInteriorMaxX() + 0.5 ||
        Math.min(segment.y0, segment.y1) < this.activeInteriorMinY() + 0.5 ||
        Math.max(segment.y0, segment.y1) > this.activeInteriorMaxY() + 0.5;
      for (let sample = 0; sample < count; sample += 1) {
        const t = count <= 1 ? 0.5 : sample / (count - 1);
        const x = clampInt(Math.round(segment.x0 + (segment.x1 - segment.x0) * t - 0.5), this.activeInteriorMinX(), this.activeInteriorMaxX());
        const y = clampInt(Math.round(segment.y0 + (segment.y1 - segment.y0) * t - 0.5), this.activeInteriorMinY(), this.activeInteriorMaxY());
        const idx = this.id(x, y);
        if (seen.has(idx)) {
          duplicateSamples += 1;
          continue;
        }
        seen.add(idx);
        if (this.material[idx] === 2) {
          pecSamples += 1;
          continue;
        }
        cells.push({ idx, x, y });
      }
      return { segment, cells, requestedSamples: count, duplicateSamples, pecSamples, clipped };
    },

    monitorFieldMagnitudeAt(idx) {
      return Math.abs(this.ez[idx]);
    },

    measureCustomMonitor(monitor) {
      const normalized = typeof normalizeMonitor === "function" ? normalizeMonitor({ ...monitor }) : monitor;
      const { segment, cells, requestedSamples, duplicateSamples, pecSamples, clipped } = this.monitorSampleCells(normalized);
      const amplitudeScale = this.fieldScale;
      const powerScale = this.fieldPowerScale();
      let sum = 0;
      let absSum = 0;
      let squareSum = 0;
      let magnitudeSum = 0;
      let normalFluxSum = 0;
      let tangentFluxSum = 0;
      for (const sample of cells) {
        const scalar = this.ez[sample.idx] * amplitudeScale;
        const magnitude = this.monitorFieldMagnitudeAt(sample.idx) * amplitudeScale;
        const poynting = this.poyntingAt(sample.idx);
        const normalFlux = (poynting.x * segment.nx + poynting.y * segment.ny) * powerScale;
        const tangentFlux = (poynting.x * segment.ux + poynting.y * segment.uy) * powerScale;
        sum += scalar;
        absSum += Math.abs(scalar);
        squareSum += scalar * scalar;
        magnitudeSum += magnitude;
        normalFluxSum += normalFlux;
        tangentFluxSum += tangentFlux;
      }
      const samples = cells.length;
      const mean = samples > 0 ? sum / samples : 0;
      const rms = samples > 0 ? Math.sqrt(squareSum / samples) : 0;
      const magnitude = samples > 0 ? magnitudeSum / samples : 0;
      const normalFlux = samples > 0 ? normalFluxSum / samples : 0;
      const tangentFlux = samples > 0 ? tangentFluxSum / samples : 0;
      const absMean = samples > 0 ? absSum / samples : 0;
      const quantity = normalized.quantity || "scalar";
      const value =
        quantity === "magnitude"
          ? magnitude
          : quantity === "normalFlux"
            ? normalFlux
            : quantity === "tangentFlux"
              ? tangentFlux
              : mean;
      return {
        monitor: normalized,
        segment,
        samples,
        requestedSamples,
        duplicateSamples,
        pecSamples,
        clipped,
        samplingWarning: samples === 0 || pecSamples > 0 || clipped,
        time: this.time,
        value,
        mean,
        absMean,
        rms,
        magnitude,
        normalFlux,
        tangentFlux,
      };
    },

    measureCustomMonitors() {
      return (state.monitors || []).map((monitor) => this.measureCustomMonitor(monitor));
    },
  });
})();
