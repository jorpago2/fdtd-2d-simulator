(function initFdtdMaterialDiagnostics() {
  "use strict";

  Object.assign(FDTDSim.prototype, {
    dispersiveDeltaEpsilonAt(idx, angularFrequency) {
      const kind = this.dispersiveMaterial[idx];
      if (!kind) return 0;
      const omega = Math.max(1e-9, Math.abs(angularFrequency));
      const gamma = Math.max(0, this.dispersionGamma[idx]);
      if (kind === 1) {
        const omegaP = Math.max(0, this.dispersionOmegaP[idx]);
        return -(omegaP * omegaP) / Math.max(1e-12, omega * omega + gamma * gamma);
      }
      if (kind === 2) {
        const omega0 = Math.max(0, this.dispersionOmega0[idx]);
        const deltaEps = this.dispersionDeltaEps[idx];
        const detuning = omega0 * omega0 - omega * omega;
        const denominator = detuning * detuning + gamma * gamma * omega * omega;
        return denominator > 1e-12 ? (deltaEps * omega0 * omega0 * detuning) / denominator : 0;
      }
      if (kind === 3) {
        const tau = Math.max(1, this.dispersionTau[idx]);
        return this.dispersionDeltaEps[idx] / (1 + omega * omega * tau * tau);
      }
      return 0;
    },

    dispersiveDeltaMuAt(idx, angularFrequency) {
      const kind = this.muDispersiveMaterial[idx];
      if (!kind) return 0;
      const omega = Math.max(1e-9, Math.abs(angularFrequency));
      const gamma = Math.max(0, this.muDispersionGamma[idx]);
      if (kind === 1) {
        const omegaP = Math.max(0, this.muDispersionOmegaP[idx]);
        return -(omegaP * omegaP) / Math.max(1e-12, omega * omega + gamma * gamma);
      }
      if (kind === 2) {
        const omega0 = Math.max(0, this.muDispersionOmega0[idx]);
        const deltaMu = this.muDispersionDeltaMu[idx];
        const detuning = omega0 * omega0 - omega * omega;
        const denominator = detuning * detuning + gamma * gamma * omega * omega;
        return denominator > 1e-12 ? (deltaMu * omega0 * omega0 * detuning) / denominator : 0;
      }
      if (kind === 3) {
        const tau = Math.max(1, this.muDispersionTau[idx]);
        return this.muDispersionDeltaMu[idx] / (1 + omega * omega * tau * tau);
      }
      return 0;
    },

    effectiveScalarEpsilonAt(idx, angularFrequency) {
      const delta = this.dispersiveDeltaEpsilonAt(idx, angularFrequency);
      const axes = this.dispersiveMaterial[idx] ? this.dispersionAxes[idx] || 3 : 0;
      const epsX = (Number(this.eps[idx]) || 0) + (axes & 1 ? delta : 0);
      const epsY = (Number(this.epsY[idx]) || 0) + (axes & 2 ? delta : 0);
      return 0.5 * (epsX + epsY);
    },

    effectiveScalarMuAt(idx, angularFrequency) {
      const delta = this.dispersiveDeltaMuAt(idx, angularFrequency);
      const axes = this.muDispersiveMaterial[idx] ? this.muDispersionAxes[idx] || 3 : 0;
      const muX = (Number(this.mu[idx]) || 0) + (axes & 1 ? delta : 0);
      const muY = (Number(this.muY[idx]) || 0) + (axes & 2 ? delta : 0);
      return 0.5 * (muX + muY);
    },

    effectiveHzEpsilonTensorAt(idx, angularFrequency) {
      let epsXX = Number(this.eps[idx]) || 0;
      let epsYY = Number(this.epsY[idx]) || 0;
      let epsXY = Number(this.epsilonXY[idx]) || 0;
      const delta = this.dispersiveDeltaEpsilonAt(idx, angularFrequency);
      if (delta !== 0) {
        const axes = this.dispersionAxes[idx] || 3;
        if (axes === 1) {
          const axisX = Number.isFinite(this.dispersionAxisX[idx]) ? this.dispersionAxisX[idx] : 1;
          const axisY = Number.isFinite(this.dispersionAxisY[idx]) ? this.dispersionAxisY[idx] : 0;
          epsXX += delta * axisX * axisX;
          epsYY += delta * axisY * axisY;
          epsXY += delta * axisX * axisY;
        } else {
          if (axes & 1) epsXX += delta;
          if (axes & 2) epsYY += delta;
        }
      }
      return { epsXX, epsYY, epsXY };
    },

    materialTensorDiagnostics() {
      const cache = this.materialTensorDiagnosticsCache;
      if (cache && cache.n === this.n && this.time - cache.time < 32) return cache.value;
      const angularFrequency = 2 * Math.PI * this.diagnosticFrequency();
      const result = {
        checkedCells: 0,
        tensorCells: 0,
        dispersiveCells: 0,
        indefiniteCells: 0,
        nearSingularCells: 0,
        negativeCells: 0,
        maxCondition: 1,
        minAbsEigenvalue: Infinity,
        maxAbsEigenvalue: 0,
      };

      for (let i = 0; i < this.n; i += 1) {
        if (this.material[i] === 0 || this.material[i] === 2) continue;
        const hasTensor =
          this.electricTensorMaterial[i] ||
          this.gyrotropicMaterial[i] ||
          this.dispersiveMaterial[i] ||
          Math.abs((this.eps[i] || 0) - (this.epsY[i] || 0)) > 1e-9;
        if (!hasTensor) continue;
        const tensor = this.effectiveHzEpsilonTensorAt(i, angularFrequency);
        const halfTrace = 0.5 * (tensor.epsXX + tensor.epsYY);
        const halfDiff = 0.5 * (tensor.epsXX - tensor.epsYY);
        const radius = Math.hypot(halfDiff, tensor.epsXY);
        const lambda1 = halfTrace + radius;
        const lambda2 = halfTrace - radius;
        const abs1 = Math.abs(lambda1);
        const abs2 = Math.abs(lambda2);
        const maxAbs = Math.max(abs1, abs2);
        const minAbs = Math.min(abs1, abs2);
        const condition = maxAbs / Math.max(1e-12, minAbs);
        result.checkedCells += 1;
        if (this.electricTensorMaterial[i] || this.gyrotropicMaterial[i] || Math.abs(tensor.epsXY) > 1e-9) {
          result.tensorCells += 1;
        }
        if (this.dispersiveMaterial[i]) result.dispersiveCells += 1;
        if (lambda1 * lambda2 < 0) result.indefiniteCells += 1;
        if (lambda1 < 0 || lambda2 < 0) result.negativeCells += 1;
        if (minAbs < 0.035 || condition > 200) result.nearSingularCells += 1;
        result.maxCondition = Math.max(result.maxCondition, condition);
        result.minAbsEigenvalue = Math.min(result.minAbsEigenvalue, minAbs);
        result.maxAbsEigenvalue = Math.max(result.maxAbsEigenvalue, maxAbs);
      }

      if (!Number.isFinite(result.minAbsEigenvalue)) result.minAbsEigenvalue = 0;
      this.materialTensorDiagnosticsCache = { n: this.n, time: this.time, value: result };
      return result;
    },

    negativeIndexDiagnostics() {
      if (state.preset !== "negativeIndexSlab" && state.preset !== "superlensSlab") return null;
      const angularFrequency = 2 * Math.PI * this.diagnosticFrequency();
      let cells = 0;
      let epsSum = 0;
      let muSum = 0;
      let doubleNegativeCells = 0;
      let nearSingularCells = 0;

      for (let i = 0; i < this.n; i += 1) {
        if (this.material[i] === 0 || this.material[i] === 2) continue;
        if (!this.dispersiveMaterial[i] && !this.muDispersiveMaterial[i]) continue;
        const epsEff = this.effectiveScalarEpsilonAt(i, angularFrequency);
        const muEff = this.effectiveScalarMuAt(i, angularFrequency);
        if (!Number.isFinite(epsEff) || !Number.isFinite(muEff)) continue;
        cells += 1;
        epsSum += epsEff;
        muSum += muEff;
        if (epsEff < 0 && muEff < 0) doubleNegativeCells += 1;
        if (Math.abs(epsEff) < 0.05 || Math.abs(muEff) < 0.05) nearSingularCells += 1;
      }

      if (cells <= 0) return null;
      const epsEff = epsSum / cells;
      const muEff = muSum / cells;
      const nAbs = Math.sqrt(Math.max(0, Math.abs(epsEff * muEff)));
      const nEff = epsEff < 0 && muEff < 0 ? -nAbs : nAbs;
      return { cells, epsEff, muEff, nEff, doubleNegativeCells, nearSingularCells };
    },

    negativeIndexMaterialBounds() {
      if (!negativeIndexAnalysisPresets.has(state.preset)) return null;
      let minX = this.nx;
      let maxX = -1;
      let minY = this.ny;
      let maxY = -1;
      let cells = 0;
      for (let y = this.activeInteriorMinY(); y <= this.activeInteriorMaxY(); y += 1) {
        const row = y * this.nx;
        for (let x = this.activeInteriorMinX(); x <= this.activeInteriorMaxX(); x += 1) {
          const idx = row + x;
          if (this.material[idx] === 0 || this.material[idx] === 2) continue;
          if (!this.dispersiveMaterial[idx] && !this.muDispersiveMaterial[idx]) continue;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          cells += 1;
        }
      }
      if (cells <= 0 || maxX < minX || maxY < minY) return null;
      return { minX, maxX, minY, maxY, cells };
    },

    negativeIndexBeamCentroidFit(xMin, xMax, yMin, yMax) {
      xMin = clampInt(Math.round(xMin), this.activeInteriorMinX(), this.activeInteriorMaxX());
      xMax = clampInt(Math.round(xMax), xMin, this.activeInteriorMaxX());
      yMin = clampInt(Math.round(yMin), this.activeInteriorMinY(), this.activeInteriorMaxY());
      yMax = clampInt(Math.round(yMax), yMin, this.activeInteriorMaxY());
      const columns = [];
      let maxColumnEnergy = 0;
      for (let x = xMin; x <= xMax; x += 1) {
        let energy = 0;
        let yWeighted = 0;
        let peak = 0;
        for (let y = yMin; y <= yMax; y += 1) {
          const idx = this.id(x, y);
          if (this.material[idx] === 2) continue;
          const value = this.scalarAnalysisValueAt(idx);
          const intensity = value * value;
          if (!Number.isFinite(intensity) || intensity <= 0) continue;
          energy += intensity;
          yWeighted += intensity * y;
          peak = Math.max(peak, intensity);
        }
        if (energy > 0) {
          maxColumnEnergy = Math.max(maxColumnEnergy, energy);
          columns.push({ x, y: yWeighted / energy, energy, peak });
        }
      }
      if (columns.length < 3 || maxColumnEnergy <= 1e-24) return null;
      const threshold = maxColumnEnergy * 0.06;
      let weightSum = 0;
      let xSum = 0;
      let ySum = 0;
      let xxSum = 0;
      let xySum = 0;
      let peak = 0;
      for (const column of columns) {
        if (column.energy < threshold) continue;
        const weight = column.energy;
        weightSum += weight;
        xSum += weight * column.x;
        ySum += weight * column.y;
        xxSum += weight * column.x * column.x;
        xySum += weight * column.x * column.y;
        peak = Math.max(peak, column.peak);
      }
      const denom = weightSum * xxSum - xSum * xSum;
      if (weightSum <= 1e-24 || Math.abs(denom) < 1e-9) return null;
      const slope = (weightSum * xySum - xSum * ySum) / denom;
      const xMean = xSum / weightSum;
      const yMean = ySum / weightSum;
      let widthNumerator = 0;
      for (const column of columns) {
        if (column.energy < threshold) continue;
        const residual = column.y - (yMean + slope * (column.x - xMean));
        widthNumerator += column.energy * residual * residual;
      }
      return {
        slope,
        angleDeg: (Math.atan(slope) * 180) / Math.PI,
        xMean,
        yMean,
        rmsWidthCells: Math.sqrt(Math.max(0, widthNumerator / weightSum)),
        peak,
        energy: weightSum,
        columns: columns.filter((column) => column.energy >= threshold).length,
      };
    },

    negativeIndexLineImageStats(xCenter, yMin, yMax, halfWidth = 1) {
      const xMin = clampInt(Math.round(xCenter - halfWidth), this.activeInteriorMinX(), this.activeInteriorMaxX());
      const xMax = clampInt(Math.round(xCenter + halfWidth), xMin, this.activeInteriorMaxX());
      yMin = clampInt(Math.round(yMin), this.activeInteriorMinY(), this.activeInteriorMaxY());
      yMax = clampInt(Math.round(yMax), yMin, this.activeInteriorMaxY());
      let energy = 0;
      let yWeighted = 0;
      let peak = 0;
      for (let x = xMin; x <= xMax; x += 1) {
        for (let y = yMin; y <= yMax; y += 1) {
          const idx = this.id(x, y);
          if (this.material[idx] === 2) continue;
          const value = this.scalarAnalysisValueAt(idx);
          const intensity = value * value;
          if (!Number.isFinite(intensity) || intensity <= 0) continue;
          energy += intensity;
          yWeighted += intensity * y;
          peak = Math.max(peak, intensity);
        }
      }
      if (energy <= 1e-24) return null;
      const yMean = yWeighted / energy;
      let variance = 0;
      for (let x = xMin; x <= xMax; x += 1) {
        for (let y = yMin; y <= yMax; y += 1) {
          const idx = this.id(x, y);
          if (this.material[idx] === 2) continue;
          const value = this.scalarAnalysisValueAt(idx);
          const intensity = value * value;
          if (!Number.isFinite(intensity) || intensity <= 0) continue;
          const dy = y - yMean;
          variance += intensity * dy * dy;
        }
      }
      return {
        x: 0.5 * (xMin + xMax),
        yMean,
        rmsWidthCells: Math.sqrt(Math.max(0, variance / energy)),
        peak,
        energy,
      };
    },

    negativeIndexPhaseFrontFit(xMin, xMax, yMin, yMax) {
      xMin = clampInt(
        Math.round(xMin),
        Math.max(1, this.activeInteriorMinX()),
        Math.min(this.nx - 2, this.activeInteriorMaxX()),
      );
      xMax = clampInt(Math.round(xMax), xMin, Math.min(this.nx - 2, this.activeInteriorMaxX()));
      yMin = clampInt(
        Math.round(yMin),
        Math.max(1, this.activeInteriorMinY()),
        Math.min(this.ny - 2, this.activeInteriorMaxY()),
      );
      yMax = clampInt(Math.round(yMax), yMin, Math.min(this.ny - 2, this.activeInteriorMaxY()));
      let sxx = 0;
      let sxy = 0;
      let syy = 0;
      let energy = 0;
      let gradientEnergy = 0;
      let samples = 0;
      for (let y = yMin; y <= yMax; y += 1) {
        for (let x = xMin; x <= xMax; x += 1) {
          const idx = this.id(x, y);
          if (this.material[idx] === 2) continue;
          const center = this.scalarAnalysisValueAt(idx);
          const gx =
            0.5 * (this.scalarAnalysisValueAt(this.id(x + 1, y)) - this.scalarAnalysisValueAt(this.id(x - 1, y)));
          const gy =
            0.5 * (this.scalarAnalysisValueAt(this.id(x, y + 1)) - this.scalarAnalysisValueAt(this.id(x, y - 1)));
          const intensity = center * center;
          const grad2 = gx * gx + gy * gy;
          if (!Number.isFinite(grad2) || grad2 <= 1e-24) continue;
          sxx += gx * gx;
          sxy += gx * gy;
          syy += gy * gy;
          energy += Number.isFinite(intensity) ? intensity : 0;
          gradientEnergy += grad2;
          samples += 1;
        }
      }
      const trace = sxx + syy;
      if (samples < 9 || trace <= 1e-24) return null;
      const anisotropy = Math.hypot(sxx - syy, 2 * sxy);
      const waveAxisAngleRad = 0.5 * Math.atan2(2 * sxy, sxx - syy);
      const waveAxisAngleDeg = (waveAxisAngleRad * 180) / Math.PI;
      const phaseFrontAngleDeg = waveAxisAngleDeg >= 0 ? waveAxisAngleDeg - 90 : waveAxisAngleDeg + 90;
      return {
        waveAxisAngleDeg,
        phaseFrontAngleDeg,
        waveAxisSlope: Math.tan(waveAxisAngleRad),
        coherence: clamp(anisotropy / trace, 0, 1),
        rmsGradient: Math.sqrt(gradientEnergy / samples),
        energy,
        samples,
      };
    },

    negativeIndexQuantitativeEstimate() {
      if (!negativeIndexAnalysisPresets.has(state.preset)) return null;
      const bounds = this.negativeIndexMaterialBounds();
      const material = this.negativeIndexDiagnostics();
      if (!bounds || !material) return null;
      const pad = Math.max(2, Math.round(state.cellsPerWavelength * 0.18));
      const span = Math.max(6, lambdaToCells(1.05));
      const yMargin = Math.max(2, Math.round(state.cellsPerWavelength * 0.18));
      const yMin = Math.max(this.activeInteriorMinY(), bounds.minY - yMargin);
      const yMax = Math.min(this.activeInteriorMaxY(), bounds.maxY + yMargin);
      const incident = this.negativeIndexBeamCentroidFit(bounds.minX - span, bounds.minX - pad, yMin, yMax);
      const slab = this.negativeIndexBeamCentroidFit(bounds.minX + 1, bounds.maxX - 1, yMin, yMax);
      const transmitted = this.negativeIndexBeamCentroidFit(bounds.maxX + pad, bounds.maxX + span, yMin, yMax);
      const incidentPhase = this.negativeIndexPhaseFrontFit(bounds.minX - span, bounds.minX - pad, yMin, yMax);
      const slabPhase = this.negativeIndexPhaseFrontFit(bounds.minX + 1, bounds.maxX - 1, yMin, yMax);
      const transmittedPhase = this.negativeIndexPhaseFrontFit(bounds.maxX + pad, bounds.maxX + span, yMin, yMax);
      const source = state.sources[0] || defaultSourceConfig;
      const sourceAngleDeg = Number(source.angleDeg) || 0;
      const sourceSlope = Math.tan((sourceAngleDeg * Math.PI) / 180);
      const slabSlope = slab?.slope ?? 0;
      const slopeRatio = Math.abs(sourceSlope) > 1e-6 ? Math.abs(slabSlope) / Math.abs(sourceSlope) : Math.abs(slabSlope);
      const negativeRefractionScore =
        slab && Math.abs(slabSlope) > 1e-6 && Math.abs(sourceSlope) > 1e-6
          ? (sourceSlope * slabSlope < 0 ? 1 : -1) * clamp(slopeRatio, 0, 1)
          : 0;
      const sourceX = this.sourceXCell(source);
      const objectDistance = Math.max(1, bounds.minX - sourceX);
      const imageX = clampInt(bounds.maxX + objectDistance, this.activeInteriorMinX(), this.activeInteriorMaxX());
      const objectStats = this.negativeIndexLineImageStats(sourceX, yMin, yMax, Math.max(1, Math.round(pad * 0.5)));
      const imageStats = this.negativeIndexLineImageStats(imageX, yMin, yMax, Math.max(1, Math.round(pad * 0.5)));
      const imageTransfer = objectStats && imageStats ? imageStats.peak / Math.max(1e-24, objectStats.peak) : 0;
      const imageEnergyTransfer = objectStats && imageStats ? imageStats.energy / Math.max(1e-24, objectStats.energy) : 0;
      const resolutionRatio =
        objectStats && imageStats && objectStats.rmsWidthCells > 1e-9 ? imageStats.rmsWidthCells / objectStats.rmsWidthCells : 0;
      const powerResidual =
        state.preset === "negativeIndexSlab" && this.diagnosticSamples > 0
          ? 1 - (this.diagnosticReflectance || 0) - (this.diagnosticTransmittance || 0)
          : null;

      return {
        material,
        bounds,
        sourceAngleDeg,
        incidentAngleDeg: incident?.angleDeg ?? 0,
        slabAngleDeg: slab?.angleDeg ?? 0,
        transmittedAngleDeg: transmitted?.angleDeg ?? 0,
        incidentPhaseAngleDeg: incidentPhase?.waveAxisAngleDeg ?? 0,
        slabPhaseAngleDeg: slabPhase?.waveAxisAngleDeg ?? 0,
        transmittedPhaseAngleDeg: transmittedPhase?.waveAxisAngleDeg ?? 0,
        slabPhaseFrontAngleDeg: slabPhase?.phaseFrontAngleDeg ?? 0,
        slabPhaseCoherence: slabPhase?.coherence ?? 0,
        incident,
        slab,
        transmitted,
        incidentPhase,
        slabPhase,
        transmittedPhase,
        negativeRefractionScore,
        negativeRefractionObserved: negativeRefractionScore > 0,
        powerResidual,
        objectPlaneLambda: cellsToLambda(sourceX),
        imagePlaneLambda: cellsToLambda(imageX),
        objectWidthLambda: objectStats ? objectStats.rmsWidthCells / Math.max(1, state.cellsPerWavelength) : 0,
        imageWidthLambda: imageStats ? imageStats.rmsWidthCells / Math.max(1, state.cellsPerWavelength) : 0,
        imageTransfer,
        imageEnergyTransfer,
        resolutionRatio,
      };
    },
  });
})();
