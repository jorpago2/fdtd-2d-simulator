"use strict";

function pointSegmentDistanceSquared(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0) {
    const ox = px - x0;
    const oy = py - y0;
    return ox * ox + oy * oy;
  }
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / lengthSquared));
  const cx = x0 + t * dx;
  const cy = y0 + t * dy;
  const ox = px - cx;
  const oy = py - cy;
  return ox * ox + oy * oy;
}

Object.assign(FDTDSim.prototype, {
  paint(x, y, radius, kind) {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy <= r2) {
          this.setMaterial(x + dx, y + dy, kind);
        }
      }
    }
  },

  paintStrokeSegment(x0, y0, x1, y1, radius, kind) {
    const ax = Math.round(Number(x0));
    const ay = Math.round(Number(y0));
    const bx = Math.round(Number(x1));
    const by = Math.round(Number(y1));
    const r = Math.max(1, Math.round(Number(radius) || 1));
    if (![ax, ay, bx, by].every(Number.isFinite)) return;
    const r2 = r * r;
    const minX = Math.max(1, Math.floor(Math.min(ax, bx) - r));
    const maxX = Math.min(this.nx - 2, Math.ceil(Math.max(ax, bx) + r));
    const minY = Math.max(1, Math.floor(Math.min(ay, by) - r));
    const maxY = Math.min(this.ny - 2, Math.ceil(Math.max(ay, by) + r));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (pointSegmentDistanceSquared(x, y, ax, ay, bx, by) <= r2) {
          this.setMaterial(x, y, kind);
        }
      }
    }
  },

  rect(x0, y0, w, h, kind) {
    const x1 = Math.min(this.nx - 2, x0 + w);
    const y1 = Math.min(this.ny - 2, y0 + h);
    for (let y = Math.max(1, y0); y <= y1; y += 1) {
      for (let x = Math.max(1, x0); x <= x1; x += 1) {
        this.setMaterial(x, y, kind);
      }
    }
  },

  ellipse(cx, cy, rx, ry, kind) {
    for (let y = Math.max(1, Math.floor(cy - ry)); y <= Math.min(this.ny - 2, Math.ceil(cy + ry)); y += 1) {
      for (let x = Math.max(1, Math.floor(cx - rx)); x <= Math.min(this.nx - 2, Math.ceil(cx + rx)); x += 1) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          this.setMaterial(x, y, kind);
        }
      }
    }
  },

  insertBrushGeometry(cx, cy, kind, options) {
    const geometry = options.geometry || "rectangle";
    const width = Math.max(1, lambdaToCells(options.widthLambda));
    const height = Math.max(1, lambdaToCells(options.heightLambda));
    const outerRadius = Math.max(1, lambdaToCells(options.radiusLambda));
    const innerRadius = Math.max(0, Math.min(outerRadius - 1, lambdaToCells(options.innerRadiusLambda)));
    const inserted = [];
    const seen = new Set();
    const addCell = (x, y) => {
      if (x < 1 || y < 1 || x >= this.nx - 1 || y >= this.ny - 1) return;
      if (this.isInBoundaryControlRegion(x, y)) return;
      this.setMaterial(x, y, kind);
      if (kind === "erase") return;
      const idx = this.id(x, y);
      if (seen.has(idx) || this.material[idx] === 0) return;
      seen.add(idx);
      inserted.push(this.snapshotMaterialCell(x, y));
    };
    const addRectangle = (w, h) => {
      const x0 = Math.round(cx - w / 2);
      const y0 = Math.round(cy - h / 2);
      for (let y = y0; y < y0 + h; y += 1) {
        for (let x = x0; x < x0 + w; x += 1) {
          addCell(x, y);
        }
      }
    };
    const addEllipse = (rx, ry, innerRx = 0, innerRy = 0) => {
      const minX = Math.floor(cx - rx);
      const maxX = Math.ceil(cx + rx);
      const minY = Math.floor(cy - ry);
      const maxY = Math.ceil(cy + ry);
      const safeInnerRx = Math.max(0, innerRx);
      const safeInnerRy = Math.max(0, innerRy);
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const dx = (x - cx) / Math.max(1, rx);
          const dy = (y - cy) / Math.max(1, ry);
          const outer = dx * dx + dy * dy <= 1;
          if (!outer) continue;
          if (safeInnerRx > 0 && safeInnerRy > 0) {
            const innerDx = (x - cx) / safeInnerRx;
            const innerDy = (y - cy) / safeInnerRy;
            if (innerDx * innerDx + innerDy * innerDy < 1) continue;
          }
          addCell(x, y);
        }
      }
    };

    if (geometry === "disk") {
      addEllipse(outerRadius, outerRadius);
    } else if (geometry === "ellipse") {
      addEllipse(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
    } else if (geometry === "ring") {
      addEllipse(outerRadius, outerRadius, innerRadius, innerRadius);
    } else {
      addRectangle(width, height);
    }

    this.refreshCpmlMaterialContinuation(false);
    if (kind === "erase" || inserted.length === 0) return null;
    return {
      cells: inserted,
      bounds: this.materialRegionBounds(inserted),
    };
  },

  slabCoreThicknessCells() {
    return Math.max(2, lambdaToCells(state.slabThicknessLambda));
  },

  sourceXCell(source) {
    return clampInt(lambdaToCells(source.xLambda), this.sourcePlacementMinX(), this.sourcePlacementMaxX());
  },

  sourceYCell(source) {
    return clampInt(lambdaToCells(source.yLambda), this.sourcePlacementMinY(), this.sourcePlacementMaxY());
  },

  sourceEnvelopeFwhmCells(source) {
    return Math.max(2, lambdaToCells(source.widthLambda));
  },

  activeInteriorBoundaryLayer(side) {
    return boundarySideIsAbsorbing(side) ? this.cpmlLayer : this.boundaryControlLayer();
  },

  activeInteriorMinX() {
    const layer = this.activeInteriorBoundaryLayer("left");
    return layer + (boundarySideIsAbsorbing("left") ? 0 : 1);
  },

  activeInteriorMaxX() {
    const layer = this.activeInteriorBoundaryLayer("right");
    return this.nx - layer - (boundarySideIsAbsorbing("right") ? 1 : 2);
  },

  activeInteriorMinY() {
    const layer = this.activeInteriorBoundaryLayer("top");
    return layer + (boundarySideIsAbsorbing("top") ? 0 : 1);
  },

  activeInteriorMaxY() {
    const layer = this.activeInteriorBoundaryLayer("bottom");
    return this.ny - layer - (boundarySideIsAbsorbing("bottom") ? 1 : 2);
  },

  sourceGuardMarginCells(side) {
    if (!boundarySideIsAbsorbing(side)) return 0;
    return Math.max(4, Math.round(state.cellsPerWavelength * 0.45));
  },

  sourcePlacementBounds(min, max, minSide, maxSide) {
    const minMargin = this.sourceGuardMarginCells(minSide);
    const maxMargin = this.sourceGuardMarginCells(maxSide);
    if (max - min <= minMargin + maxMargin) return { min, max };
    return { min: min + minMargin, max: max - maxMargin };
  },

  sourcePlacementMinX() {
    return this.sourcePlacementBounds(this.activeInteriorMinX(), this.activeInteriorMaxX(), "left", "right").min;
  },

  sourcePlacementMaxX() {
    return this.sourcePlacementBounds(this.activeInteriorMinX(), this.activeInteriorMaxX(), "left", "right").max;
  },

  sourcePlacementMinY() {
    return this.sourcePlacementBounds(this.activeInteriorMinY(), this.activeInteriorMaxY(), "top", "bottom").min;
  },

  sourcePlacementMaxY() {
    return this.sourcePlacementBounds(this.activeInteriorMinY(), this.activeInteriorMaxY(), "top", "bottom").max;
  },

  applyPreset(name) {
    for (const side of BOUNDARY_SIDES) setBoundarySideMode(side, "absorbing");
    this.buildBoundary();
    this.clearMaterials(false);
    state.sources = [];
    state.retiringSources = [];
    state.nextSourceId = 1;
    state.selectedSourceId = null;
    state.sourceDefaults = { ...defaultSourceConfig };

    state.fieldComponent = "ez";
    state.fieldDisplay = "scalar";
    state.fieldQuiver = false;
    state.viewMode = "field";
    state.materialPart = "real";
    state.analysisEnabled = true;
    state.analysisSampleEvery = 4;
    state.sweepMode = "angle";
    state.sweepStart = 0;
    state.sweepEnd = 70;
    state.sweepSamples = 9;
    state.sweepSteps = 720;
    state.sweepBidirectional = false;
    state.sweepResults = [];
    state.materialModulationEnabled = false;
    state.materialNonlinearEnabled = false;
    state.materialHarmonicEnabled = false;
    state.materialDispersionEnabled = false;
    state.materialConductivityEnabled = false;
    state.materialSaturableGainEnabled = false;
    state.materialPhaseChangeEnabled = false;
    state.materialGyrotropyEnabled = false;
    state.materialBianisotropyEnabled = false;
    state.materialFullVectorBianisotropyEnabled = false;
    state.kerrChi3 = 0.5;
    state.kerrSaturation = 5;
    state.harmonicChi2 = 0.08;
    state.harmonicChi3 = 0;
    state.harmonicSaturation = 6;
    state.conductivitySigma = 0;
    state.conductivitySigmaY = 0;
    state.gainSaturation = 4;
    state.phaseEpsOn = 9;
    state.phaseLossOn = 0.08;
    state.phaseThresholdOn = 0.8;
    state.phaseThresholdOff = 0.2;
    state.phaseTauOn = 18;
    state.phaseTauOff = 180;
    state.gyrotropyG = 0.25;
    state.bianisotropyKappa = 0.2;
    state.dispersionModel = "none";
    state.dispersionOmegaP = 0.28;
    state.dispersionGamma = 0.018;
    state.dispersionOmega0 = 0.15;
    state.dispersionDeltaEps = 2;
    state.dispersionTau = 18;
    state.modulationDepth = 0.2;
    state.modulationFrequency = 0.01;
    state.modulationPeriodLambda = 2;
    state.modulationAngleDeg = 0;
    state.modulationPhaseDeg = 0;

    if (name === "empty") {
      this.refreshCpmlMaterialContinuation(false);
      this.markMaterialChanged();
      this.resetFields();
      return;
    }

    const minX = this.activeInteriorMinX();
    const maxX = this.activeInteriorMaxX();
    const minY = this.activeInteriorMinY();
    const maxY = this.activeInteriorMaxY();
    const domainXLambda = cellsToLambda(this.nx);
    const domainYLambda = cellsToLambda(this.ny);
    const midXLambda = domainXLambda * 0.5;
    const midYLambda = domainYLambda * 0.5;
    const sourceFrequency = COURANT / Math.max(8, state.cellsPerWavelength);
    const sourceOmega = 2 * Math.PI * sourceFrequency;
    const enzGamma = 0.014;
    const enzTargetEpsilon = 0.04;
    const enzOmegaP = Math.sqrt(Math.max(0, (1 - enzTargetEpsilon) * (sourceOmega * sourceOmega + enzGamma * enzGamma)));
    const negativeTarget = -1;
    const negativeGamma = 0.026;
    const negativeOmegaP = Math.sqrt(Math.max(0, (1 - negativeTarget) * (sourceOmega * sourceOmega + negativeGamma * negativeGamma)));
    const sourceX = (value) => clamp(value, minSourceXLambda(), maxSourceXLambda());
    const sourceY = (value) => clamp(value, minSourceYLambda(), maxSourceYLambda());
    const mat = {
      air: { material: 0 },
      pec: { material: 2 },
      n12: { material: 4, eps: 1.44 },
      n15: { material: 4, eps: 2.25 },
      n20: { material: 4, eps: 4 },
      n25: { material: 4, eps: 6.25 },
      n34: { material: 4, eps: 11.56 },
      coating: { material: 4, eps: 1.5 },
      lossyN15: { material: 4, eps: 2.25, loss: 0.1 },
      lossyGuide: { material: 4, eps: 11.56, loss: 0.02 },
      finiteConductor: { material: 4, eps: 1, loss: 0, sigma: 0.42 },
      ptGain: { material: 4, eps: 6.25, loss: -0.032 },
      ptLoss: { material: 4, eps: 6.25, loss: 0.032 },
      weak: { material: 4, eps: 1.35 },
      enz: { material: 4, eps: 1, loss: 0.006, dispersion: "drude", omegaP: enzOmegaP, gamma: enzGamma },
      anisotropic: { material: 4, eps: 4, epsY: 2 },
      hyperbolic: { material: 4, eps: 4, epsY: -2 },
      chiral: { material: 4, eps: 3.2, epsY: 3.2, mu: 1.1, muY: 1.1, kappa: 0.22 },
      bianisotropic: { material: 4, eps: 4.2, epsY: 2.6, mu: 1.25, muY: 0.9, kappa: -0.32 },
      gyrotropic: { material: 4, eps: 4, epsY: 4, gyro: 0.35 },
      negativeDispersive: {
        material: 4,
        eps: 1,
        epsY: 1,
        loss: 0.01,
        lossY: 0.01,
        mu: 1,
        muY: 1,
        muLoss: 0.01,
        muLossY: 0.01,
        dispersion: "drude",
        omegaP: negativeOmegaP,
        gamma: negativeGamma,
        muDispersion: "drude",
        muOmegaP: negativeOmegaP,
        muGamma: negativeGamma,
      },
      metalLoss: { material: 4, eps: -12, loss: 4 },
      drudeMetal: { material: 4, eps: 1, loss: 0.002, dispersion: "drude", omegaP: 0.28, gamma: 0.018 },
      plasmonicMetal: { material: 4, eps: 1, loss: 0.004, dispersion: "drude", omegaP: 0.34, gamma: 0.026 },
      plasma: { material: 4, eps: 1, loss: 0, dispersion: "plasma", omegaP: 2 * Math.PI * sourceFrequency * 1.25, gamma: 0.001 },
      lorentz: {
        material: 4,
        eps: 1.7,
        loss: 0.002,
        dispersion: "lorentz",
        omega0: 2 * Math.PI * sourceFrequency * 1.05,
        gamma: 0.025,
        deltaEps: 2.0,
      },
      debye: { material: 4, eps: 1.8, loss: 0.001, dispersion: "debye", deltaEps: 3.0, tau: 18 },
      phaseOff: { material: 4, eps: 3.2, loss: 0.002, phaseChange: true, phaseEpsOn: 9, phaseLossOn: 0.08 },
      pcmOff: { material: 4, eps: 4, loss: 0.001, phaseChange: true, phaseEpsOn: 12, phaseLossOn: 0.03 },
    };
    const brewsterAngleDeg = (Math.atan(Math.sqrt(mat.n15.eps)) * 180) / Math.PI;

    const setSources = (configs) => {
      const base = {
        type: "sine",
        shape: "line",
        frequency: sourceFrequency,
        amplitude: 0.55,
        xLambda: sourceX(1),
        yLambda: sourceY(midYLambda),
        widthLambda: 0.35,
        angleDeg: 0,
        phaseDeg: 0,
        multipoleOrder: 3,
        multipolePhase: "cos",
      };
      state.sources = configs.map((config, index) => {
        const source = normalizeSource({ ...base, ...config });
        source.id = index + 1;
        return source;
      });
      if (state.sources.length === 0) {
        const source = normalizeSource({ ...defaultSourceConfig, frequency: sourceFrequency, yLambda: sourceY(midYLambda) });
        source.id = 1;
        state.sources = [source];
      }
      state.nextSourceId = state.sources.length + 1;
      state.selectedSourceId = state.sources[0]?.id ?? null;
      state.sourceDefaults = { ...(state.sources[0] || defaultSourceConfig) };
      delete state.sourceDefaults.id;
    };

    const writeMaterialCell = (x, y, params = mat.air) => {
      if (x < minX || y < minY || x > maxX || y > maxY) return;
      if (this.isInBoundaryControlRegion(x, y)) return;
      const idx = this.id(x, y);
      if ((params.material ?? 0) === 0) {
        this.writeAirCellAtIndex(idx);
        return;
      }
      const material = params.material ?? 4;
      const eps = params.eps ?? 1;
      const loss = params.loss ?? 0;
      const epsY = params.epsY ?? eps;
      const lossY = params.lossY ?? loss;
      const mu = params.mu ?? 1;
      const muLoss = params.muLoss ?? 0;
      const muY = params.muY ?? mu;
      const muLossY = params.muLossY ?? muLoss;
      const sigma = params.sigma ?? 0;
      const sigmaY = params.sigmaY ?? sigma;
      this.material[idx] = material;
      this.eps[idx] = material === 2 ? 1 : eps;
      this.loss[idx] = material === 2 ? 0 : loss;
      this.epsY[idx] = material === 2 ? 1 : epsY;
      this.lossY[idx] = material === 2 ? 0 : lossY;
      this.mu[idx] = material === 2 ? 1 : mu;
      this.muLoss[idx] = material === 2 ? 0 : muLoss;
      this.muY[idx] = material === 2 ? 1 : muY;
      this.muLossY[idx] = material === 2 ? 0 : muLossY;
      const modulationPhaseOffset =
        typeof params.modulationPhaseOffsetRad === "function"
          ? params.modulationPhaseOffsetRad(x, y, idx)
          : Number.isFinite(params.modulationPhaseOffsetRad)
            ? params.modulationPhaseOffsetRad
            : Number.isFinite(params.modulationPhaseOffsetDeg)
              ? (params.modulationPhaseOffsetDeg * Math.PI) / 180
              : 0;
      this.setCellModulation(
        idx,
        Boolean(params.modulated) && material !== 2,
        this.eps[idx],
        this.epsY[idx],
        modulationPhaseOffset,
      );
      this.setCellNonlinearity(idx, Boolean(params.nonlinear) && material !== 2, this.eps[idx], this.epsY[idx]);
      this.setCellDispersion(idx, material !== 2 ? params : null);
      this.setCellMagneticDispersion(idx, material !== 2 ? params : null);
      this.setCellConductivity(idx, material !== 2 ? sigma : 0, material !== 2 ? sigmaY : 0);
      this.setCellGyrotropy(idx, material !== 2 ? params.gyro ?? params.gyrotropyG ?? 0 : 0);
      this.setCellElectricTensor(idx, material !== 2 ? params.epsXY ?? params.epsilonXY ?? 0 : 0);
      this.setCellBianisotropy(idx, material !== 2 ? params.kappa ?? params.bianisotropyKappa ?? 0 : 0);
      this.setCellPhaseChange(idx, material !== 2 ? params : null);
      if (material === 2) {
        this.zeroElectricCell(idx);
        this.zeroDualFieldCell(idx);
      }
    };

    const rectCells = (x0, y0, w, h, params) => {
      const xStart = Math.max(minX, Math.round(x0));
      const xEnd = Math.min(maxX, Math.round(x0 + w - 1));
      const yStart = Math.max(minY, Math.round(y0));
      const yEnd = Math.min(maxY, Math.round(y0 + h - 1));
      for (let y = yStart; y <= yEnd; y += 1) {
        for (let x = xStart; x <= xEnd; x += 1) writeMaterialCell(x, y, params);
      }
    };
    const rectL = (xL, yL, wL, hL, params) => {
      rectCells(lambdaToCells(xL), lambdaToCells(yL), Math.max(1, lambdaToCells(wL)), Math.max(1, lambdaToCells(hL)), params);
    };
    const uniformModulationPhaseOffset = (x, y, extraPhaseRad = 0) => {
      const periodCells = Math.max(1, lambdaToCells(Math.max(0.1, state.modulationPeriodLambda)));
      const theta = ((Number(state.modulationAngleDeg) || 0) * Math.PI) / 180;
      return extraPhaseRad - (2 * Math.PI * (x * Math.cos(theta) + y * Math.sin(theta))) / periodCells;
    };
    const uniformTemporalMaterial = (params, extraPhaseRad = 0) => ({
      ...params,
      modulated: true,
      modulationPhaseOffsetRad: (x, y) => uniformModulationPhaseOffset(x, y, extraPhaseRad),
    });
    const ellipseCells = (cx, cy, rx, ry, params) => {
      const rX = Math.max(1, Math.round(rx));
      const rY = Math.max(1, Math.round(ry));
      for (let y = Math.max(minY, cy - rY); y <= Math.min(maxY, cy + rY); y += 1) {
        const yy = (y - cy) / rY;
        for (let x = Math.max(minX, cx - rX); x <= Math.min(maxX, cx + rX); x += 1) {
          const xx = (x - cx) / rX;
          if (xx * xx + yy * yy <= 1) writeMaterialCell(x, y, params);
        }
      }
    };
    const ellipseL = (cxL, cyL, rxL, ryL, params) => {
      ellipseCells(lambdaToCells(cxL), lambdaToCells(cyL), lambdaToCells(rxL), lambdaToCells(ryL), params);
    };
    const ringL = (cxL, cyL, outerRxL, outerRyL, innerRxL, innerRyL, params) => {
      const cx = lambdaToCells(cxL);
      const cy = lambdaToCells(cyL);
      const outerRx = Math.max(1, lambdaToCells(outerRxL));
      const outerRy = Math.max(1, lambdaToCells(outerRyL));
      const innerRx = Math.max(1, lambdaToCells(innerRxL));
      const innerRy = Math.max(1, lambdaToCells(innerRyL));
      for (let y = Math.max(minY, cy - outerRy); y <= Math.min(maxY, cy + outerRy); y += 1) {
        const yo = (y - cy) / outerRy;
        const yi = (y - cy) / innerRy;
        for (let x = Math.max(minX, cx - outerRx); x <= Math.min(maxX, cx + outerRx); x += 1) {
          const xo = (x - cx) / outerRx;
          const xi = (x - cx) / innerRx;
          if (xo * xo + yo * yo <= 1 && xi * xi + yi * yi >= 1) {
            const cellParams =
              typeof params === "function"
                ? params({ x, y, cx, cy, dx: x - cx, dy: y - cy, outerRx, outerRy, innerRx, innerRy })
                : params;
            writeMaterialCell(x, y, cellParams);
          }
        }
      }
    };
    const quarterRingL = (cxL, cyL, outerRL, innerRL, quadrant, params) => {
      const cx = lambdaToCells(cxL);
      const cy = lambdaToCells(cyL);
      const outerR = Math.max(1, lambdaToCells(outerRL));
      const innerR = Math.max(1, lambdaToCells(innerRL));
      const outerR2 = outerR * outerR;
      const innerR2 = innerR * innerR;
      for (let y = Math.max(minY, cy - outerR); y <= Math.min(maxY, cy + outerR); y += 1) {
        for (let x = Math.max(minX, cx - outerR); x <= Math.min(maxX, cx + outerR); x += 1) {
          const dx = x - cx;
          const dy = y - cy;
          if (quadrant === "ne" && (dx < 0 || dy > 0)) continue;
          if (quadrant === "nw" && (dx > 0 || dy > 0)) continue;
          if (quadrant === "se" && (dx < 0 || dy < 0)) continue;
          if (quadrant === "sw" && (dx > 0 || dy < 0)) continue;
          const r2 = dx * dx + dy * dy;
          if (r2 <= outerR2 && r2 >= innerR2) writeMaterialCell(x, y, params);
        }
      }
    };
    const rotatedRectL = (cxL, cyL, lengthL, widthL, angleDeg, params) => {
      const cx = lambdaToCells(cxL);
      const cy = lambdaToCells(cyL);
      const halfLength = Math.max(1, lambdaToCells(lengthL) / 2);
      const halfWidth = Math.max(1, lambdaToCells(widthL) / 2);
      const theta = (angleDeg * Math.PI) / 180;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      const radius = Math.ceil(Math.hypot(halfLength, halfWidth));
      for (let y = Math.max(minY, cy - radius); y <= Math.min(maxY, cy + radius); y += 1) {
        for (let x = Math.max(minX, cx - radius); x <= Math.min(maxX, cx + radius); x += 1) {
          const dx = x - cx;
          const dy = y - cy;
          const u = dx * cosTheta + dy * sinTheta;
          const v = -dx * sinTheta + dy * cosTheta;
          if (Math.abs(u) <= halfLength && Math.abs(v) <= halfWidth) writeMaterialCell(x, y, params);
        }
      }
    };
    const rectFrameL = (cxL, cyL, wL, hL, tL, params) => {
      rectL(cxL - wL / 2, cyL - hL / 2, wL, tL, params);
      rectL(cxL - wL / 2, cyL + hL / 2 - tL, wL, tL, params);
      rectL(cxL - wL / 2, cyL - hL / 2, tL, hL, params);
      rectL(cxL + wL / 2 - tL, cyL - hL / 2, tL, hL, params);
    };
    const fillAll = (params) => rectCells(minX, minY, maxX - minX + 1, maxY - minY + 1, params);
    const fillRightOf = (xL, params) => rectCells(lambdaToCells(xL), minY, maxX - lambdaToCells(xL) + 1, maxY - minY + 1, params);
    const fillLeftOf = (xL, params) => rectCells(minX, minY, lambdaToCells(xL) - minX, maxY - minY + 1, params);
    const braggLayers = (startL, pairs, y0L, hL, paramsA = mat.n15, paramsB = mat.n25) => {
      let x = startL;
      const dA = 1 / (4 * 1.5);
      const dB = 1 / (4 * 2.5);
      for (let i = 0; i < pairs; i += 1) {
        rectL(x, y0L, dA, hL, paramsA);
        x += dA;
        rectL(x, y0L, dB, hL, paramsB);
        x += dB;
      }
    };
    const guide = (yL, widthL, params = mat.n34, x0L = 0.4, x1L = domainXLambda - 0.4) => {
      rectL(x0L, yL - widthL / 2, Math.max(0.1, x1L - x0L), widthL, params);
    };
    const gaussianGuideSource = (yL, overrides = {}) => {
      setSources([{ shape: "gaussianProfile", xLambda: sourceX(0.9), yLambda: sourceY(yL), widthLambda: 0.35, ...overrides }]);
    };
    const modalGuideSource = (yL, overrides = {}) => {
      setSources([
        {
          shape: "modeProfile",
          xLambda: sourceX(0.9),
          yLambda: sourceY(yL),
          widthLambda: 1.15,
          modeOrder: 0,
          amplitude: 0.42,
          ...overrides,
        },
      ]);
    };
    const configureFrequencySweep = (start = 0.018, end = 0.052, samples = 9, steps = 900) => {
      state.sweepMode = "frequency";
      state.sweepStart = clampSweepRangeForMode("frequency", start);
      state.sweepEnd = clampSweepRangeForMode("frequency", end);
      state.sweepSamples = clampInt(samples, 3, 41);
      state.sweepSteps = clampInt(steps, 120, 4000);
      state.sweepBidirectional = false;
      state.sweepResults = [];
    };
    const configureAmplitudeSweep = (start = 0.1, end = 1.0, samples = 9, steps = 900, bidirectional = false) => {
      state.sweepMode = "amplitude";
      state.sweepStart = clampSweepRangeForMode("amplitude", start);
      state.sweepEnd = clampSweepRangeForMode("amplitude", end);
      state.sweepSamples = clampInt(samples, 3, 41);
      state.sweepSteps = clampInt(steps, 120, 4000);
      state.sweepBidirectional = Boolean(bidirectional);
      state.sweepResults = [];
    };
    const configureGainLossSweep = (start = 0, end = 0.07, samples = 11, steps = 1200) => {
      state.sweepMode = "gainLoss";
      state.sweepStart = clampSweepRangeForMode("gainLoss", start);
      state.sweepEnd = clampSweepRangeForMode("gainLoss", end);
      state.sweepSamples = clampInt(samples, 3, 41);
      state.sweepSteps = clampInt(steps, 120, 4000);
      state.sweepBidirectional = false;
      state.sweepResults = [];
    };
    const configureSymmetrySweep = (start = 0, end = 0.16, samples = 9, steps = 1200) => {
      state.sweepMode = "symmetry";
      state.sweepStart = clampSweepRangeForMode("symmetry", start);
      state.sweepEnd = clampSweepRangeForMode("symmetry", end);
      state.sweepSamples = clampInt(samples, 3, 41);
      state.sweepSteps = clampInt(steps, 120, 4000);
      state.sweepBidirectional = false;
      state.sweepResults = [];
    };
    const configureBlochSweep = (start = 0, end = 1, samples = 11, steps = 120) => {
      state.sweepMode = "blochK";
      state.sweepStart = clampSweepRangeForMode("blochK", start);
      state.sweepEnd = clampSweepRangeForMode("blochK", end);
      state.sweepSamples = clampInt(samples, 3, 41);
      state.sweepSteps = clampInt(steps, 120, 4000);
      state.sweepBidirectional = false;
      state.sweepResults = [];
    };
    const configureDirectionSweep = (steps = 1200) => {
      state.sweepMode = "direction";
      state.sweepStart = 0;
      state.sweepEnd = 1;
      state.sweepSamples = 2;
      state.sweepSteps = clampInt(steps, 120, 4000);
      state.sweepBidirectional = false;
      state.sweepResults = [];
    };
    const phc = ({ skip = () => false, disorder = false, rows = 9, cols = 15, radiusScale = () => 1, offset = () => ({ x: 0, y: 0 }) } = {}) => {
      let seed = 1337;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const a = 0.45;
      const r = 0.115;
      for (let ix = -Math.floor(cols / 2); ix <= Math.floor(cols / 2); ix += 1) {
        for (let iy = -Math.floor(rows / 2); iy <= Math.floor(rows / 2); iy += 1) {
          if (skip(ix, iy)) continue;
          const jitterX = disorder ? (rand() - 0.5) * 0.06 : 0;
          const jitterY = disorder ? (rand() - 0.5) * 0.06 : 0;
          const localOffset = offset(ix, iy) || { x: 0, y: 0 };
          const localRadius = r * clamp(Number(radiusScale(ix, iy)) || 1, 0.45, 1.8);
          ellipseL(
            midXLambda + ix * a + jitterX + (localOffset.x || 0),
            midYLambda + iy * a + jitterY + (localOffset.y || 0),
            localRadius,
            localRadius,
            mat.n34,
          );
        }
      }
    };
    const scatterCluster = (count, params, radiusL, weak = false) => {
      let seed = weak ? 911 : 503;
      const rand = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x80000000;
      };
      for (let i = 0; i < count; i += 1) {
        const x = 2.7 + rand() * Math.max(1, domainXLambda - 5.2);
        const y = 1 + rand() * Math.max(1, domainYLambda - 2);
        const r = radiusL * (0.75 + rand() * 0.5);
        ellipseL(x, y, r, r, params);
      }
    };
    const randomScatterSlab = (count, paramsForScatterer, radiusL, options = {}) => {
      let seed = options.seed || 6841;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const x0 = options.x0 ?? 2.35;
      const x1 = options.x1 ?? Math.max(x0 + 0.5, domainXLambda - 1.15);
      const y0 = options.y0 ?? 0.72;
      const y1 = options.y1 ?? Math.max(y0 + 0.5, domainYLambda - 0.72);
      for (let i = 0; i < count; i += 1) {
        const x = x0 + rand() * Math.max(0.2, x1 - x0);
        const y = y0 + rand() * Math.max(0.2, y1 - y0);
        const r = radiusL * (options.radiusJitter ? 1 - options.radiusJitter + 2 * options.radiusJitter * rand() : 1);
        const params =
          typeof paramsForScatterer === "function" ? paramsForScatterer({ index: i, rand, x, y, radius: r }) : paramsForScatterer;
        ellipseL(x, y, Math.max(0.025, r), Math.max(0.025, r), params);
      }
    };
    const sshChain = (d1, d2, interfaceMode = false, options = {}) => {
      const count = options.count || 15;
      const center = (count - 1) * 0.5;
      let seed = 2203;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      let x = options.startXLambda ?? Math.max(1.2, midXLambda - 3.1);
      for (let i = 0; i < count; i += 1) {
        const jitter = options.disorder ? (rand() - 0.5) * 0.075 : 0;
        const yJitter = options.disorder ? (rand() - 0.5) * 0.06 : 0;
        const y = midYLambda + (options.yOffset ? options.yOffset(i, center) : 0) + yJitter;
        const r = options.radiusForSite ? options.radiusForSite(i, center) : 0.13;
        const params = options.paramsForSite ? options.paramsForSite(i, center) : mat.n34;
        ellipseL(x + jitter, y, r, r, params);
        const useFirstGap = interfaceMode ? i < center ? i % 2 === 0 : i % 2 !== 0 : i % 2 === 0;
        x += useFirstGap ? d1 : d2;
      }
    };
    const honeycombLattice = ({ rows = 7, cols = 11, domainSign = () => 1, defect = null } = {}) => {
      const pitchX = 0.56;
      const pitchY = 0.48;
      const subDx = 0.13;
      const drawRod = (x, y, sublattice, sign) => {
        if (defect?.(x, y, sublattice)) return;
        const large = sign > 0 ? sublattice === "a" : sublattice === "b";
        const radius = large ? 0.125 : 0.085;
        ellipseL(x, y, radius, radius, mat.n34);
      };
      for (let iy = -Math.floor(rows / 2); iy <= Math.floor(rows / 2); iy += 1) {
        for (let ix = -Math.floor(cols / 2); ix <= Math.floor(cols / 2); ix += 1) {
          const rowOffset = Math.abs(iy % 2) === 1 ? pitchX * 0.5 : 0;
          const cx = midXLambda + ix * pitchX + rowOffset;
          const cy = midYLambda + iy * pitchY;
          const sign = domainSign(cx, cy);
          drawRod(cx - subDx, cy, "a", sign);
          drawRod(cx + subDx, cy, "b", sign);
        }
      }
    };
    const valleyHallLattice = ({ bend = false, strongDefect = false } = {}) => {
      const cornerX = midXLambda + 0.7;
      const domainSign = (x, y) => {
        if (!bend) return y < midYLambda ? 1 : -1;
        return x < cornerX ? (y < midYLambda ? 1 : -1) : (x < cornerX + 0.18 ? 1 : -1);
      };
      honeycombLattice({
        rows: 9,
        cols: 15,
        domainSign,
        defect: strongDefect
          ? (x, y) => Math.hypot(x - (midXLambda + 0.15), y - midYLambda) < 0.42
          : null,
      });
      if (strongDefect) ellipseL(midXLambda + 0.15, midYLambda, 0.28, 0.28, mat.pec);
    };

    setSources([{ shape: "point", xLambda: sourceX(1.2), yLambda: sourceY(midYLambda) }]);

    switch (name) {
      case "planeWaveAir":
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "planeWaveDielectric":
        fillAll(mat.n15);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "gaussianPulseAir":
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "twoSourceInterference":
        setSources([
          { shape: "point", xLambda: sourceX(1.7), yLambda: sourceY(midYLambda - 0.75), amplitude: 0.42 },
          { shape: "point", xLambda: sourceX(1.7), yLambda: sourceY(midYLambda + 0.75), amplitude: 0.42 },
        ]);
        break;
      case "frequencyBeat":
        setSources([
          { shape: "point", xLambda: sourceX(1.6), yLambda: sourceY(midYLambda - 0.45), frequency: sourceFrequency * 0.93 },
          { shape: "point", xLambda: sourceX(1.6), yLambda: sourceY(midYLambda + 0.45), frequency: sourceFrequency * 1.08 },
        ]);
        break;
      case "singleSlit":
        rectL(midXLambda - 0.03, 0, 0.12, domainYLambda, mat.pec);
        rectL(midXLambda - 0.08, midYLambda - 0.32, 0.22, 0.64, mat.air);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.65 }]);
        break;
      case "doubleSlit":
        rectL(midXLambda - 0.03, 0, 0.12, domainYLambda, mat.pec);
        rectL(midXLambda - 0.08, midYLambda - 0.86, 0.22, 0.42, mat.air);
        rectL(midXLambda - 0.08, midYLambda + 0.44, 0.22, 0.42, mat.air);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.65 }]);
        break;
      case "circularAperture":
        rectL(midXLambda - 0.03, 0, 0.12, domainYLambda, mat.pec);
        ellipseL(midXLambda, midYLambda, 0.5, 0.5, mat.air);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "poyntingPlaneWave":
        state.viewMode = "poynting";
        state.fieldDisplay = "scalar";
        state.fieldQuiver = true;
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), angleDeg: 25 }]);
        break;
      case "evanescentWave":
        state.viewMode = "field";
        state.fieldDisplay = "scalar";
        setSources([
          {
            shape: "evanescentLine",
            xLambda: sourceX(1.05),
            yLambda: sourceY(midYLambda),
            widthLambda: 1.28,
            evanescentKParallelRatio: 1.28,
            amplitude: 0.32,
          },
        ]);
        break;
      case "pmlAbsorption":
        setSources([{ type: "gaussian", shape: "gaussianSpot", xLambda: sourceX(1.1), yLambda: sourceY(midYLambda), widthLambda: 0.45, amplitude: 1 }]);
        break;
      case "teTmComparison":
        state.fieldComponent = "hz";
        state.fieldDisplay = "scalar";
        state.sweepMode = "angle";
        state.sweepStart = 0;
        state.sweepEnd = 70;
        state.sweepSamples = 15;
        state.sweepSteps = 840;
        state.sweepResults = [];
        fillRightOf(midXLambda, mat.n15);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), angleDeg: 35, amplitude: 0.48 }]);
        break;
      case "normalInterface":
        fillRightOf(midXLambda, mat.n15);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "obliqueRefraction":
        fillRightOf(midXLambda, mat.n15);
        setSources([{ shape: "gaussianProfile", xLambda: sourceX(1.0), yLambda: sourceY(midYLambda), widthLambda: 0.8, angleDeg: 28 }]);
        break;
      case "brewsterTm":
        state.fieldComponent = "hz";
        state.fieldDisplay = "scalar";
        state.sweepMode = "angle";
        state.sweepStart = 30;
        state.sweepEnd = 72;
        state.sweepSamples = 15;
        state.sweepSteps = 960;
        state.sweepResults = [];
        fillRightOf(midXLambda, mat.n15);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), angleDeg: brewsterAngleDeg, amplitude: 0.48 }]);
        break;
      case "brewsterTeTm":
        state.fieldComponent = "hz";
        state.fieldDisplay = "scalar";
        state.sweepMode = "angle";
        state.sweepStart = 20;
        state.sweepEnd = 75;
        state.sweepSamples = 17;
        state.sweepSteps = 960;
        state.sweepResults = [];
        fillRightOf(midXLambda, mat.n15);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), angleDeg: brewsterAngleDeg, amplitude: 0.48 }]);
        break;
      case "totalInternalReflection":
        fillLeftOf(midXLambda, mat.n15);
        setSources([{ shape: "gaussianProfile", xLambda: sourceX(1.1), yLambda: sourceY(midYLambda), widthLambda: 0.8, angleDeg: 48 }]);
        break;
      case "frustratedTir":
        fillLeftOf(midXLambda - 0.18, mat.n15);
        fillRightOf(midXLambda + 0.18, mat.n15);
        setSources([{ shape: "gaussianProfile", xLambda: sourceX(1.1), yLambda: sourceY(midYLambda), widthLambda: 0.8, angleDeg: 48 }]);
        break;
      case "quarterWaveCoating": {
        const d = 1 / (4 * Math.sqrt(1.5));
        rectL(midXLambda - d, 0, d, domainYLambda, mat.coating);
        fillRightOf(midXLambda, mat.n15);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      }
      case "braggMirror":
      case "braggStack":
        braggLayers(midXLambda - 0.8, 6, 0, domainYLambda);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "lossyInterface":
        fillRightOf(midXLambda, mat.lossyN15);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "anisotropicInterface":
        fillRightOf(midXLambda, mat.anisotropic);
        setSources([{ shape: "gaussianProfile", xLambda: sourceX(1.0), yLambda: sourceY(midYLambda), widthLambda: 0.8, angleDeg: 24 }]);
        break;
      case "jzDipole":
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.35 }]);
        break;
      case "inPlaneDipole":
        state.fieldComponent = "hz";
        setSources([
          {
            shape: "inPlaneElectricDipole",
            xLambda: sourceX(midXLambda),
            yLambda: sourceY(midYLambda),
            widthLambda: 0.35,
            angleDeg: 0,
          },
        ]);
        break;
      case "mzDipole":
        state.fieldComponent = "hz";
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.35 }]);
        break;
      case "dipoleSubstrate":
        rectL(0, midYLambda + 0.35, domainXLambda, Math.max(0.1, domainYLambda - midYLambda - 0.35), mat.n15);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda + 0.1), widthLambda: 0.32 }]);
        break;
      case "dipoleNearPec":
        rectL(midXLambda + 1.0, 0, 0.12, domainYLambda, mat.pec);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.32 }]);
        break;
      case "huygensRadiator":
        setSources([{ shape: "huygens", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.45, angleDeg: 0 }]);
        break;
      case "circularDipole":
        setSources([{ shape: "circularDipoleCw", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.45 }]);
        break;
      case "janusDipole":
        guide(midYLambda, 0.28, mat.n34, midXLambda - 2.2, domainXLambda - 0.6);
        setSources([{ shape: "janusDipole", xLambda: sourceX(midXLambda - 0.75), yLambda: sourceY(midYLambda - 0.42), widthLambda: 0.42, angleDeg: 0 }]);
        break;
      case "dipoleArray": {
        const sources = [];
        for (let i = 0; i < 8; i += 1) {
          sources.push({ shape: "pointDipole", xLambda: sourceX(1.6), yLambda: sourceY(midYLambda - 1.75 + i * 0.5), widthLambda: 0.24, amplitude: 0.32 });
        }
        setSources(sources);
        break;
      }
      case "phasedDipoleArray": {
        const sources = [];
        const elementSpacingLambda = 0.5;
        const steeringAngleDeg = -12;
        const phaseStep = -360 * elementSpacingLambda * Math.sin((steeringAngleDeg * Math.PI) / 180);
        for (let i = 0; i < 8; i += 1) {
          sources.push({
            shape: "pointDipole",
            xLambda: sourceX(1.6),
            yLambda: sourceY(midYLambda - 1.75 + i * 0.5),
            widthLambda: 0.24,
            amplitude: 0.32,
            phaseDeg: (i - 3.5) * phaseStep,
            arrayElementIndex: i,
            arrayPhaseStepDeg: phaseStep,
            arraySteeringAngleDeg: steeringAngleDeg,
          });
        }
        setSources(sources);
        break;
      }
      case "apertureRadiator":
        rectL(midXLambda - 0.03, 0, 0.12, domainYLambda, mat.pec);
        rectL(midXLambda - 0.08, midYLambda - 0.28, 0.22, 0.56, mat.air);
        setSources([{ shape: "point", xLambda: sourceX(midXLambda - 0.55), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "nearFarFieldNtff":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.35, amplitude: 0.45 }]);
        break;
      case "slabWaveguide":
        guide(midYLambda, 0.25, mat.n34);
        modalGuideSource(midYLambda, { widthLambda: 1.05 });
        break;
      case "multimodeSlab":
        guide(midYLambda, 0.8, mat.n34);
        setSources([
          { shape: "modeProfile", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 1.65, modeOrder: 0, amplitude: 0.34 },
          { shape: "modeProfile", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda + 0.12), widthLambda: 1.65, modeOrder: 1, amplitude: 0.24, phaseDeg: 90 },
        ]);
        break;
      case "lossyGuide":
        guide(midYLambda, 0.32, mat.lossyGuide);
        modalGuideSource(midYLambda, { widthLambda: 1.1, amplitude: 0.36 });
        break;
      case "waveguideBend": {
        const bendCx = midXLambda - 0.6;
        const bendCy = midYLambda + 0.55;
        guide(midYLambda, 0.26, mat.n34, 0.55, bendCx);
        rectL(bendCx + 0.55, midYLambda + 0.55, 0.26, Math.max(0.3, domainYLambda - midYLambda - 1.1), mat.n34);
        quarterRingL(bendCx, bendCy, 0.81, 0.55, "ne", mat.n34);
        modalGuideSource(midYLambda, { widthLambda: 1.05 });
        break;
      }
      case "taperWaveguide": {
        const x0 = 1.4;
        const length = 3.0;
        for (let i = 0; i < 80; i += 1) {
          const t = i / 79;
          const width = 0.1 + t * 0.3;
          rectL(x0 + t * length, midYLambda - width / 2, length / 80 + 0.02, width, mat.n34);
        }
        guide(midYLambda, 0.4, mat.n34, x0 + length, domainXLambda - 0.5);
        modalGuideSource(midYLambda, { widthLambda: 0.95 });
        break;
      }
      case "widthStepWaveguide":
        guide(midYLambda, 0.25, mat.n34, 0.5, midXLambda);
        guide(midYLambda, 0.5, mat.n34, midXLambda, domainXLambda - 0.5);
        modalGuideSource(midYLambda, { widthLambda: 1.05 });
        break;
      case "directionalCoupler":
        guide(midYLambda - 0.23, 0.22, mat.n34, 0.6, domainXLambda - 0.6);
        guide(midYLambda + 0.23, 0.22, mat.n34, 1.4, domainXLambda - 0.6);
        modalGuideSource(midYLambda - 0.23, { widthLambda: 0.72 });
        break;
      case "mmiWaveguide":
        guide(midYLambda, 0.24, mat.n34, 0.5, 2.2);
        rectL(2.2, midYLambda - 0.5, 3.5, 1.0, mat.n34);
        guide(midYLambda - 0.25, 0.22, mat.n34, 5.7, domainXLambda - 0.5);
        guide(midYLambda + 0.25, 0.22, mat.n34, 5.7, domainXLambda - 0.5);
        modalGuideSource(midYLambda, { widthLambda: 1.05 });
        break;
      case "machZehnder":
        guide(midYLambda, 0.22, mat.n34, 0.55, midXLambda - 2.1);
        rotatedRectL(midXLambda - 1.75, midYLambda - 0.34, 1.0, 0.22, -35, mat.n34);
        rotatedRectL(midXLambda - 1.75, midYLambda + 0.34, 1.0, 0.22, 35, mat.n34);
        guide(midYLambda - 0.68, 0.22, mat.n34, midXLambda - 1.35, midXLambda + 1.35);
        guide(midYLambda + 0.68, 0.22, mat.n34, midXLambda - 1.35, midXLambda + 1.35);
        rectL(midXLambda - 0.15, midYLambda - 0.79, 0.75, 0.22, mat.n20);
        rotatedRectL(midXLambda + 1.75, midYLambda - 0.34, 1.0, 0.22, 35, mat.n34);
        rotatedRectL(midXLambda + 1.75, midYLambda + 0.34, 1.0, 0.22, -35, mat.n34);
        guide(midYLambda, 0.22, mat.n34, midXLambda + 2.1, domainXLambda - 0.55);
        modalGuideSource(midYLambda, { widthLambda: 1.0 });
        break;
      case "guideScatterer":
        guide(midYLambda, 0.28, mat.n34);
        ellipseL(midXLambda + 0.9, midYLambda - 0.32, 0.08, 0.08, mat.n20);
        modalGuideSource(midYLambda, { widthLambda: 1.05 });
        break;
      case "microstrip":
        state.fieldComponent = "hz";
        state.viewMode = "field";
        rectL(0.4, midYLambda + 0.15, Math.max(0.4, domainXLambda - 0.8), Math.max(0.4, domainYLambda - midYLambda - 0.5), mat.n15);
        rectL(0.4, domainYLambda - 0.72, Math.max(0.4, domainXLambda - 0.8), 0.08, mat.pec);
        rectL(1.0, midYLambda + 0.04, Math.max(0.5, domainXLambda - 2.0), 0.08, mat.pec);
        setSources([{ type: "gaussian", shape: "gaussianProfile", xLambda: sourceX(1.0), yLambda: sourceY(midYLambda - 0.12), widthLambda: 0.34, amplitude: 0.55 }]);
        break;
      case "stubResonator":
        guide(midYLambda, 0.25, mat.n34);
        rectL(midXLambda - 0.12, midYLambda - 1.05, 0.25, 1.05, mat.n34);
        modalGuideSource(midYLambda, { widthLambda: 1.05 });
        break;
      case "fabryPerot":
        braggLayers(midXLambda - 2.0, 4, 0, domainYLambda);
        braggLayers(midXLambda + 0.65, 4, 0, domainYLambda);
        rectL(midXLambda - 0.55, 0, 1.1, domainYLambda, mat.n15);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "fabryPerotStanding":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        braggLayers(midXLambda - 2.0, 5, 0, domainYLambda);
        braggLayers(midXLambda + 0.65, 5, 0, domainYLambda);
        rectL(midXLambda - 0.55, 0, 1.1, domainYLambda, mat.n15);
        setSources([{ type: "sine", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.42 }]);
        break;
      case "ringResonator":
        guide(midYLambda + 1.25, 0.24, mat.n34);
        ringL(midXLambda + 0.5, midYLambda, 1.1, 1.1, 0.84, 0.84, mat.n34);
        modalGuideSource(midYLambda + 1.25, { widthLambda: 1.05 });
        break;
      case "addDropRing":
        guide(midYLambda + 1.25, 0.24, mat.n34);
        guide(midYLambda - 1.25, 0.24, mat.n34);
        ringL(midXLambda + 0.5, midYLambda, 1.1, 1.1, 0.84, 0.84, mat.n34);
        modalGuideSource(midYLambda + 1.25, { widthLambda: 1.05 });
        break;
      case "racetrackResonator":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        guide(midYLambda + 1.05, 0.24, mat.n34, 0.6, domainXLambda - 0.6);
        ringL(midXLambda + 0.45, midYLambda, 1.55, 0.82, 1.26, 0.55, mat.n34);
        modalGuideSource(midYLambda + 1.05, { widthLambda: 1.05 });
        break;
      case "dielectricCavity":
        ellipseL(midXLambda, midYLambda, 0.42, 0.42, mat.n34);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.22, amplitude: 0.45 }]);
        break;
      case "pecCavity":
        rectFrameL(midXLambda, midYLambda, 1.4, 1.0, 0.08, mat.pec);
        setSources([{ type: "gaussian", shape: "point", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), amplitude: 0.8 }]);
        break;
      case "quarterWaveCavity":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        guide(midYLambda, 0.24, mat.n34, 0.55, domainXLambda - 0.55);
        rectL(midXLambda - 0.1, midYLambda - 0.92, 0.22, 0.92, mat.n34);
        rectL(midXLambda - 0.16, midYLambda - 0.98, 0.34, 0.08, mat.pec);
        modalGuideSource(midYLambda, { type: "gaussian", widthLambda: 1.05, amplitude: 0.72 });
        break;
      case "qRingdown":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        ellipseL(midXLambda, midYLambda, 0.56, 0.56, mat.n34);
        setSources([
          { type: "gaussian", shape: "pointDipole", xLambda: sourceX(midXLambda + 0.12), yLambda: sourceY(midYLambda), widthLambda: 0.22, amplitude: 0.85 },
        ]);
        break;
      case "purcell2d":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        ellipseL(midXLambda, midYLambda, 0.52, 0.52, mat.n34);
        ellipseL(midXLambda, midYLambda, 0.18, 0.18, mat.n20);
        setSources([{ type: "gaussian", shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.2, amplitude: 0.78 }]);
        break;
      case "betaFactor":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        guide(midYLambda, 0.32, mat.n34, 0.7, domainXLambda - 0.7);
        setSources([{ type: "gaussian", shape: "pointDipole", xLambda: sourceX(midXLambda - 0.7), yLambda: sourceY(midYLambda), widthLambda: 0.24, amplitude: 0.72 }]);
        break;
      case "degenerateModes":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        ellipseL(midXLambda, midYLambda, 0.66, 0.66, mat.n34);
        setSources([
          { type: "gaussian", shape: "pointDipole", xLambda: sourceX(midXLambda + 0.18), yLambda: sourceY(midYLambda), widthLambda: 0.2, amplitude: 0.62 },
          { type: "gaussian", shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda + 0.18), widthLambda: 0.2, amplitude: 0.62 },
        ]);
        break;
      case "pecCylinder":
        ellipseL(midXLambda + 0.7, midYLambda, 0.3, 0.3, mat.pec);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "dielectricCylinder":
        ellipseL(midXLambda + 0.7, midYLambda, 0.3, 0.3, mat.n20);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "mieCylinder":
        ellipseL(midXLambda + 0.7, midYLambda, 0.25, 0.25, mat.n34);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "rcsCylinder":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        ellipseL(midXLambda + 0.7, midYLambda, 0.32, 0.32, mat.pec);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.45 }]);
        break;
      case "lossyCylinder":
        ellipseL(midXLambda + 0.7, midYLambda, 0.3, 0.3, { material: 4, eps: 4, loss: 0.2 });
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "dielectricDimer":
        ellipseL(midXLambda + 0.45, midYLambda, 0.25, 0.25, mat.n34);
        ellipseL(midXLambda + 1.05, midYLambda, 0.25, 0.25, mat.n34);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "kerker2d":
        state.fieldComponent = "hz";
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        ellipseL(midXLambda + 0.7, midYLambda, 0.28, 0.28, mat.n34);
        setSources([
          { shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), frequency: sourceFrequency * 1.12, amplitude: 0.42 },
        ]);
        break;
      case "multipleScattering":
        scatterCluster(20, mat.n20, 0.13);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "weakLocalization":
        scatterCluster(48, mat.weak, 0.07, true);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "andersonLocalization":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 4;
        randomScatterSlab(
          92,
          ({ index }) => (index % 6 === 0 ? mat.n34 : index % 3 === 0 ? mat.n25 : mat.n20),
          0.082,
          { seed: 6819, x0: 2.2, x1: domainXLambda - 1.15, y0: 0.8, y1: domainYLambda - 0.8, radiusJitter: 0.36 },
        );
        setSources([
          { type: "gaussian", shape: "gaussianProfile", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.42, amplitude: 0.7 },
        ]);
        break;
      case "diffusiveRandomMedium":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 4;
        randomScatterSlab(
          130,
          ({ index }) => (index % 4 === 0 ? mat.n15 : mat.weak),
          0.052,
          { seed: 6923, x0: 2.0, x1: domainXLambda - 1.0, y0: 0.62, y1: domainYLambda - 0.62, radiusJitter: 0.45 },
        );
        setSources([
          { type: "gaussian", shape: "gaussianProfile", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.7, amplitude: 0.78 },
        ]);
        break;
      case "finiteConductivity":
        state.materialConductivityEnabled = true;
        state.conductivitySigma = mat.finiteConductor.sigma;
        state.conductivitySigmaY = mat.finiteConductor.sigma;
        rectL(midXLambda - 0.15, 0.65, Math.max(0.25, domainXLambda - midXLambda - 0.5), domainYLambda - 1.3, mat.finiteConductor);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.65 }]);
        break;
      case "drudeMetal":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.drudeMetal.omegaP;
        state.dispersionGamma = mat.drudeMetal.gamma;
        rectL(midXLambda - 0.22, 0.65, 0.44, domainYLambda - 1.3, mat.drudeMetal);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.55 }]);
        break;
      case "lorentzMedium":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "lorentz";
        state.dispersionOmega0 = mat.lorentz.omega0;
        state.dispersionGamma = mat.lorentz.gamma;
        state.dispersionDeltaEps = mat.lorentz.deltaEps;
        rectL(midXLambda - 0.75, 0.75, 1.5, domainYLambda - 1.5, mat.lorentz);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.55 }]);
        break;
      case "debyeDielectric":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "debye";
        state.dispersionDeltaEps = mat.debye.deltaEps;
        state.dispersionTau = mat.debye.tau;
        rectL(midXLambda - 0.75, 0.75, 1.5, domainYLambda - 1.5, mat.debye);
        setSources([{ type: "ricker", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.55 }]);
        break;
      case "plasmaCutoff":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "plasma";
        state.dispersionOmegaP = mat.plasma.omegaP;
        state.dispersionGamma = mat.plasma.gamma;
        rectL(midXLambda - 0.7, 0.65, 1.4, domainYLambda - 1.3, mat.plasma);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.45 }]);
        break;
      case "enzSlab":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.enz.omegaP;
        state.dispersionGamma = mat.enz.gamma;
        rectL(midXLambda - 0.15, 0, 0.3, domainYLambda, mat.enz);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "anisotropicMedium":
        rectL(midXLambda - 1.2, midYLambda - 1.2, 2.4, 2.4, mat.anisotropic);
        setSources([{ shape: "point", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), amplitude: 0.55 }]);
        break;
      case "hyperbolicMedium":
        rectL(midXLambda - 1.3, midYLambda - 1.2, 2.6, 2.4, mat.hyperbolic);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.35, amplitude: 0.35 }]);
        break;
      case "chiralMedium":
        state.fieldComponent = "hz";
        state.fieldDisplay = "electricMag";
        state.fieldQuiver = true;
        state.materialBianisotropyEnabled = true;
        state.materialFullVectorBianisotropyEnabled = true;
        state.bianisotropyKappa = mat.chiral.kappa;
        rectL(midXLambda - 1.0, 0.75, 2.0, domainYLambda - 1.5, mat.chiral);
        setSources([{ type: "gaussian", shape: "gaussianProfile", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.78, amplitude: 0.62 }]);
        break;
      case "bianisotropicMedium":
        state.fieldComponent = "hz";
        state.fieldDisplay = "electricMag";
        state.fieldQuiver = true;
        state.materialBianisotropyEnabled = true;
        state.materialFullVectorBianisotropyEnabled = true;
        state.bianisotropyKappa = mat.bianisotropic.kappa;
        rectL(midXLambda - 1.05, midYLambda - 1.0, 2.1, 2.0, mat.bianisotropic);
        setSources([{ type: "gaussian", shape: "gaussianProfile", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.6, amplitude: 0.58 }]);
        break;
      case "gyrotropicMedium":
        state.fieldComponent = "hz";
        state.fieldDisplay = "electricMag";
        state.fieldQuiver = true;
        state.materialGyrotropyEnabled = true;
        state.gyrotropyG = mat.gyrotropic.gyro;
        rectL(midXLambda - 1.0, 0.75, 2.0, domainYLambda - 1.5, mat.gyrotropic);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.65 }]);
        break;
      case "photonicCrystal":
        configureBlochSweep(0, 1, 11, 120);
        phc();
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "phcPointDefect":
        configureBlochSweep(0, 1, 11, 120);
        phc({ skip: (ix, iy) => ix === 0 && iy === 0 });
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.25, amplitude: 0.55 }]);
        break;
      case "phcWaveguide":
        configureBlochSweep(0, 1, 11, 120);
        phc({ skip: (_ix, iy) => iy === 0 });
        gaussianGuideSource(midYLambda, { widthLambda: 0.32 });
        break;
      case "phcOptimizedCavity":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureBlochSweep(0, 1, 13, 120);
        phc({
          rows: 9,
          cols: 17,
          skip: (ix, iy) => iy === 0 && Math.abs(ix) <= 1,
          radiusScale: (ix, iy) => (iy === 0 && Math.abs(ix) === 2 ? 0.82 : Math.abs(iy) === 1 && Math.abs(ix) <= 2 ? 0.92 : 1),
          offset: (ix, iy) => (iy === 0 && Math.abs(ix) === 2 ? { x: Math.sign(ix) * 0.08, y: 0 } : { x: 0, y: 0 }),
        });
        setSources([{ type: "gaussian", shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.2, amplitude: 0.68 }]);
        break;
      case "phcDisorder":
        phc({ disorder: true });
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.9 }]);
        break;
      case "phcDarkMode":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureBlochSweep(0, 1, 13, 120);
        phc({ skip: (ix, iy) => ix === 0 && iy === 0, rows: 9, cols: 15 });
        setSources([
          { type: "sine", shape: "pointDipole", xLambda: sourceX(midXLambda - 0.16), yLambda: sourceY(midYLambda), widthLambda: 0.18, amplitude: 0.32, phaseDeg: 0 },
          { type: "sine", shape: "pointDipole", xLambda: sourceX(midXLambda + 0.16), yLambda: sourceY(midYLambda), widthLambda: 0.18, amplitude: 0.32, phaseDeg: 180 },
        ]);
        break;
      case "quasiBic":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureBlochSweep(0, 1, 13, 120);
        phc({
          skip: (ix, iy) => ix === 0 && iy === 0,
          rows: 9,
          cols: 15,
          radiusScale: (ix, iy) => (ix === 1 && iy === 0 ? 0.72 : ix === -1 && iy === 0 ? 1.08 : 1),
          offset: (ix, iy) => (ix === 1 && iy === 0 ? { x: 0.04, y: 0.03 } : { x: 0, y: 0 }),
        });
        setSources([
          { type: "sine", shape: "pointDipole", xLambda: sourceX(midXLambda - 0.16), yLambda: sourceY(midYLambda), widthLambda: 0.18, amplitude: 0.34, phaseDeg: 0 },
          { type: "sine", shape: "pointDipole", xLambda: sourceX(midXLambda + 0.16), yLambda: sourceY(midYLambda), widthLambda: 0.18, amplitude: 0.30, phaseDeg: 170 },
        ]);
        break;
      case "symmetryProtectedBic":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureBlochSweep(0, 1, 13, 120);
        phc({
          rows: 9,
          cols: 17,
          skip: (ix, iy) => iy === 0 && Math.abs(ix) <= 1,
          radiusScale: (ix, iy) => (iy === 0 && Math.abs(ix) === 2 ? 0.86 : 1),
          offset: (ix, iy) => (iy === 0 && Math.abs(ix) === 2 ? { x: Math.sign(ix) * 0.06, y: 0 } : { x: 0, y: 0 }),
        });
        setSources([
          { type: "sine", shape: "pointDipole", xLambda: sourceX(midXLambda - 0.2), yLambda: sourceY(midYLambda), widthLambda: 0.18, amplitude: 0.3, phaseDeg: 0 },
          { type: "sine", shape: "pointDipole", xLambda: sourceX(midXLambda + 0.2), yLambda: sourceY(midYLambda), widthLambda: 0.18, amplitude: 0.3, phaseDeg: 180 },
        ]);
        break;
      case "fanoResonator":
        guide(midYLambda, 0.25, mat.n34);
        ellipseL(midXLambda + 0.8, midYLambda - 0.62, 0.36, 0.36, mat.n34);
        modalGuideSource(midYLambda, { widthLambda: 1.05 });
        break;
      case "sshTrivial":
        sshChain(0.42, 0.25);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda - 3), yLambda: sourceY(midYLambda), widthLambda: 0.24 }]);
        break;
      case "sshTopological":
        sshChain(0.25, 0.42);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda - 3), yLambda: sourceY(midYLambda), widthLambda: 0.24 }]);
        break;
      case "sshInterface":
        sshChain(0.25, 0.42, true);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.24 }]);
        break;
      case "sshDisorder":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        sshChain(0.25, 0.42, true, { disorder: true, count: 17 });
        setSources([{ type: "gaussian", shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.24, amplitude: 0.58 }]);
        break;
      case "nonHermitianSsh":
        state.materialSaturableGainEnabled = true;
        state.gainSaturation = 3.2;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        sshChain(0.25, 0.42, true, {
          count: 17,
          radiusForSite: (i) => (i % 2 === 0 ? 0.13 : 0.115),
          paramsForSite: (i) => (i % 2 === 0 ? mat.ptGain : mat.ptLoss),
        });
        setSources([{ type: "gaussian", shape: "pointDipole", xLambda: sourceX(midXLambda), yLambda: sourceY(midYLambda), widthLambda: 0.24, amplitude: 0.46 }]);
        break;
      case "honeycombLattice":
        honeycombLattice({ rows: 9, cols: 13, domainSign: () => 1 });
        setSources([{ type: "gaussian", shape: "gaussianProfile", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.62, amplitude: 0.72 }]);
        break;
      case "valleyHall":
        state.viewMode = "poynting";
        state.fieldDisplay = "scalar";
        valleyHallLattice();
        setSources([{ type: "gaussian", shape: "gaussianProfile", xLambda: sourceX(0.95), yLambda: sourceY(midYLambda), widthLambda: 0.32, amplitude: 0.58 }]);
        break;
      case "valleyHallBend":
        state.viewMode = "poynting";
        state.fieldDisplay = "scalar";
        valleyHallLattice({ bend: true });
        setSources([{ type: "gaussian", shape: "gaussianProfile", xLambda: sourceX(0.95), yLambda: sourceY(midYLambda), widthLambda: 0.32, amplitude: 0.58 }]);
        break;
      case "topologicalPumping":
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.16;
        state.modulationFrequency = 0.011;
        state.modulationPeriodLambda = 1.6;
        state.modulationAngleDeg = 0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        sshChain(0.25, 0.42, true, {
          count: 17,
          yOffset: (i, center) => 0.08 * Math.sin(((i - center) * Math.PI) / 3),
          paramsForSite: () => ({ ...mat.n34, modulated: true }),
        });
        setSources([{ type: "gaussian", shape: "pointDipole", xLambda: sourceX(midXLambda - 2.4), yLambda: sourceY(midYLambda), widthLambda: 0.24, amplitude: 0.62 }]);
        break;
      case "topologyDefect":
        state.viewMode = "poynting";
        state.fieldDisplay = "scalar";
        valleyHallLattice({ strongDefect: true });
        setSources([{ type: "gaussian", shape: "gaussianProfile", xLambda: sourceX(0.95), yLambda: sourceY(midYLambda), widthLambda: 0.32, amplitude: 0.62 }]);
        break;
      case "sppInterface": {
        state.fieldComponent = "hz";
        state.fieldDisplay = "scalar";
        state.viewMode = "poynting";
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.plasmonicMetal.omegaP;
        state.dispersionGamma = mat.plasmonicMetal.gamma;
        const interfaceY = midYLambda + 0.45;
        rectL(0, interfaceY, domainXLambda, Math.max(0.1, domainYLambda - interfaceY), mat.plasmonicMetal);
        setSources([
          {
            shape: "pointDipole",
            xLambda: sourceX(midXLambda - 2.2),
            yLambda: sourceY(interfaceY - 0.16),
            widthLambda: 0.22,
            amplitude: 0.38,
          },
        ]);
        break;
      }
      case "sppGrating": {
        state.fieldComponent = "hz";
        state.fieldDisplay = "scalar";
        state.viewMode = "poynting";
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.plasmonicMetal.omegaP;
        state.dispersionGamma = mat.plasmonicMetal.gamma;
        const interfaceY = midYLambda + 0.55;
        rectL(0, interfaceY, domainXLambda, Math.max(0.1, domainYLambda - interfaceY), mat.plasmonicMetal);
        const pitch = 1.42;
        const start = Math.max(1.2, midXLambda - 4.25);
        for (let i = 0; i < 7; i += 1) {
          const x = start + i * pitch;
          rectL(x, interfaceY - 0.13, 0.22, 0.13, mat.plasmonicMetal);
          if (i % 2 === 0) {
            rectL(x + 0.22, interfaceY, 0.12, 0.11, mat.air);
          }
        }
        setSources([
          {
            shape: "gaussianProfile",
            xLambda: sourceX(1.15),
            yLambda: sourceY(interfaceY - 0.9),
            widthLambda: 0.75,
            angleDeg: 18,
            amplitude: 0.42,
          },
        ]);
        break;
      }
      case "localizedPlasmon":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.plasmonicMetal.omegaP;
        state.dispersionGamma = mat.plasmonicMetal.gamma;
        ellipseL(midXLambda + 0.35, midYLambda, 0.34, 0.34, mat.plasmonicMetal);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.55, amplitude: 0.55 }]);
        break;
      case "plasmonicDimer":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.plasmonicMetal.omegaP;
        state.dispersionGamma = mat.plasmonicMetal.gamma;
        ellipseL(midXLambda + 0.15, midYLambda, 0.26, 0.26, mat.plasmonicMetal);
        ellipseL(midXLambda + 0.75, midYLambda, 0.26, 0.26, mat.plasmonicMetal);
        setSources([{ type: "gaussian", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.45, amplitude: 0.5 }]);
        break;
      case "metasurfacePhaseBars":
        for (let i = -7; i <= 7; i += 1) {
          const y = midYLambda + i * 0.28;
          const h = 0.12 + (i + 7) * 0.018;
          rectL(midXLambda - 0.04, y - h / 2, 0.08, h, mat.n34);
        }
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "perfectAbsorber": {
        state.viewMode = "poynting";
        state.fieldDisplay = "scalar";
        state.analysisEnabled = true;
        state.analysisSampleEvery = 4;
        const start = midXLambda + 0.15;
        const layerWidth = 0.16;
        for (let i = 0; i < 7; i += 1) {
          const t = i / 6;
          const loss = 0.015 + 0.34 * t * t;
          rectL(start + i * layerWidth, 0.55, layerWidth + 0.01, domainYLambda - 1.1, {
            material: 4,
            eps: 1,
            epsY: 1,
            mu: 1,
            muY: 1,
            loss,
            lossY: loss,
            muLoss: loss,
            muLossY: loss,
          });
        }
        rectL(start + 7 * layerWidth + 0.02, 0.55, 0.08, domainYLambda - 1.1, mat.pec);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.45 }]);
        break;
      }
      case "negativeIndexSlab":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.negativeDispersive.omegaP;
        state.dispersionGamma = mat.negativeDispersive.gamma;
        configureFrequencySweep(sourceFrequency * 0.75, sourceFrequency * 1.25, 9, 1200);
        rectL(midXLambda - 0.45, 0.5, 0.9, domainYLambda - 1.0, mat.negativeDispersive);
        setSources([{ shape: "gaussianProfile", xLambda: sourceX(1.0), yLambda: sourceY(midYLambda), widthLambda: 0.8, angleDeg: 28, amplitude: 0.26 }]);
        break;
      case "superlensSlab":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.negativeDispersive.omegaP;
        state.dispersionGamma = mat.negativeDispersive.gamma;
        configureFrequencySweep(sourceFrequency * 0.75, sourceFrequency * 1.25, 9, 1200);
        rectL(midXLambda - 0.25, 0.6, 0.5, domainYLambda - 1.2, mat.negativeDispersive);
        setSources([{ shape: "point", xLambda: sourceX(midXLambda - 1.0), yLambda: sourceY(midYLambda), amplitude: 0.22 }]);
        break;
      case "hyperlens":
        state.fieldComponent = "hz";
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = 2 * Math.PI * sourceFrequency * 2.05;
        state.dispersionGamma = 0.022;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        state.fieldDisplay = "scalar";
        state.viewMode = "poynting";
        configureFrequencySweep(sourceFrequency * 0.72, sourceFrequency * 1.28, 9, 1200);
        {
          const radialTangentialDrude = ({ epsRadial, epsTangential, lossRadial, lossTangential, omegaP, gamma }) => {
            return ({ dx, dy }) => {
              const radius = Math.max(1e-9, Math.hypot(dx, dy));
              const radialX = dx / radius;
              const radialY = dy / radius;
              const tangentX = -radialY;
              const tangentY = radialX;
              const epsXX = epsRadial * radialX * radialX + epsTangential * tangentX * tangentX;
              const epsYY = epsRadial * radialY * radialY + epsTangential * tangentY * tangentY;
              const epsXY = (epsRadial - epsTangential) * radialX * radialY;
              const lossXX = lossRadial * radialX * radialX + lossTangential * tangentX * tangentX;
              const lossYY = lossRadial * radialY * radialY + lossTangential * tangentY * tangentY;
              return {
                material: 4,
                eps: epsXX,
                epsY: epsYY,
                epsXY,
                mu: 1,
                muY: 1,
                loss: lossXX,
                lossY: lossYY,
                dispersion: "drude",
                dispersionAxes: "x",
                dispersionAxisX: tangentX,
                dispersionAxisY: tangentY,
                omegaP,
                gamma,
              };
            };
          };
          ringL(
            midXLambda + 0.35,
            midYLambda,
            1.25,
            1.25,
            0.42,
            0.42,
            radialTangentialDrude({
              epsRadial: 2.9,
              epsTangential: 1.0,
              lossRadial: 0.026,
              lossTangential: 0.018,
              omegaP: 2 * Math.PI * sourceFrequency * 2.1,
              gamma: 0.022,
            }),
          );
          ringL(
            midXLambda + 0.35,
            midYLambda,
            0.74,
            0.74,
            0.5,
            0.5,
            radialTangentialDrude({
              epsRadial: 2.35,
              epsTangential: 1.0,
              lossRadial: 0.02,
              lossTangential: 0.014,
              omegaP: 2 * Math.PI * sourceFrequency * 1.8,
              gamma: 0.026,
            }),
          );
        }
        setSources([
          {
            shape: "pointDipole",
            xLambda: sourceX(midXLambda - 0.05),
            yLambda: sourceY(midYLambda),
            widthLambda: 0.22,
            amplitude: 0.16,
          },
        ]);
        break;
      case "enzEmitter":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.enz.omegaP;
        state.dispersionGamma = mat.enz.gamma;
        rectL(midXLambda + 0.25, 0.7, 0.45, domainYLambda - 1.4, mat.enz);
        setSources([{ shape: "pointDipole", xLambda: sourceX(midXLambda - 0.35), yLambda: sourceY(midYLambda), widthLambda: 0.3, amplitude: 0.45 }]);
        break;
      case "kerrSlab":
        state.materialNonlinearEnabled = true;
        state.kerrChi3 = 0.65;
        state.kerrSaturation = 3.5;
        rectL(midXLambda - 0.9, 0.75, 1.8, domainYLambda - 1.5, { ...mat.n15, nonlinear: true });
        setSources([{ shape: "gaussianProfile", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.75, amplitude: 0.75 }]);
        break;
      case "shgSlab":
        state.materialHarmonicEnabled = true;
        state.harmonicChi2 = 0.12;
        state.harmonicChi3 = 0;
        state.harmonicSaturation = 5.5;
        configureAmplitudeSweep(0.18, 0.9, 9, 900);
        rectL(midXLambda - 0.9, 0.75, 1.8, domainYLambda - 1.5, { ...mat.n15, nonlinear: true });
        setSources([{ type: "sine", shape: "gaussianProfile", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.72, amplitude: 0.62 }]);
        break;
      case "thgSlab":
        state.materialHarmonicEnabled = true;
        state.harmonicChi2 = 0;
        state.harmonicChi3 = 0.055;
        state.harmonicSaturation = 5.5;
        configureAmplitudeSweep(0.18, 0.9, 9, 900);
        rectL(midXLambda - 0.9, 0.75, 1.8, domainYLambda - 1.5, { ...mat.n15, nonlinear: true });
        setSources([{ type: "sine", shape: "gaussianProfile", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), widthLambda: 0.72, amplitude: 0.68 }]);
        break;
      case "spmKerrPulse":
        state.materialNonlinearEnabled = true;
        state.kerrChi3 = 0.72;
        state.kerrSaturation = 2.8;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureAmplitudeSweep(0.2, 1.0, 9, 900);
        rectL(midXLambda - 1.05, midYLambda - 0.42, 2.1, 0.84, {
          ...mat.n15,
          loss: 0.001,
          nonlinear: true,
        });
        rectL(midXLambda + 1.32, midYLambda - 0.32, 0.1, 0.64, { ...mat.lossyN15, loss: 0.018 });
        setSources([
          {
            type: "gaussian",
            shape: "gaussianProfile",
            xLambda: sourceX(0.9),
            yLambda: sourceY(midYLambda),
            widthLambda: 0.48,
            amplitude: 0.78,
          },
        ]);
        break;
      case "kerrBistableCavity":
        state.materialNonlinearEnabled = true;
        state.kerrChi3 = 0.42;
        state.kerrSaturation = 2.8;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureAmplitudeSweep(0.18, 0.75, 9, 1200, true);
        guide(midYLambda + 0.55, 0.24, mat.n15, 0.65, domainXLambda - 0.65);
        ringL(midXLambda + 0.12, midYLambda, 0.72, 0.72, 0.48, 0.48, {
          ...mat.n34,
          loss: 0.001,
          nonlinear: true,
        });
        rectL(midXLambda - 0.16, midYLambda - 0.13, 0.56, 0.26, {
          ...mat.n34,
          loss: 0.001,
          nonlinear: true,
        });
        modalGuideSource(midYLambda + 0.55, { type: "sine", widthLambda: 1.25, amplitude: 0.44 });
        break;
      case "vo2SwitchingSlab":
        state.materialPhaseChangeEnabled = true;
        state.phaseEpsOn = 9;
        state.phaseLossOn = 0.08;
        state.phaseThresholdOn = 0.55;
        state.phaseThresholdOff = 0.16;
        state.phaseTauOn = 14;
        state.phaseTauOff = 220;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureAmplitudeSweep(0.15, 0.95, 9, 900, true);
        rectL(midXLambda - 0.85, 0.75, 1.7, domainYLambda - 1.5, mat.phaseOff);
        setSources([
          {
            type: "gaussian",
            shape: "gaussianProfile",
            xLambda: sourceX(0.9),
            yLambda: sourceY(midYLambda),
            widthLambda: 0.75,
            amplitude: 0.9,
          },
        ]);
        break;
      case "pcmMemoryCell":
        state.materialPhaseChangeEnabled = true;
        state.phaseEpsOn = 12;
        state.phaseLossOn = 0.03;
        state.phaseThresholdOn = 0.45;
        state.phaseThresholdOff = 0.08;
        state.phaseTauOn = 20;
        state.phaseTauOff = 900;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureAmplitudeSweep(0.12, 0.85, 9, 1100, true);
        guide(midYLambda, 0.28, mat.n34, 0.6, domainXLambda - 0.6);
        ellipseL(midXLambda + 0.45, midYLambda, 0.28, 0.18, mat.pcmOff);
        modalGuideSource(midYLambda, { type: "gaussian", widthLambda: 1.05, amplitude: 0.75 });
        break;
      case "saturableAbsorber":
        state.materialPhaseChangeEnabled = true;
        state.phaseEpsOn = 2.25;
        state.phaseLossOn = 0.012;
        state.phaseThresholdOn = 0.0012;
        state.phaseThresholdOff = 0.00035;
        state.phaseTauOn = 10;
        state.phaseTauOff = 150;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureAmplitudeSweep(0.1, 1.0, 9, 900, true);
        rectL(midXLambda - 0.55, 0.8, 1.1, domainYLambda - 1.6, {
          material: 4,
          eps: 2.25,
          loss: 0.075,
          phaseChange: true,
          phaseEpsOn: 2.25,
          phaseLossOn: 0.012,
        });
        setSources([
          {
            type: "gaussian",
            shape: "gaussianProfile",
            xLambda: sourceX(0.9),
            yLambda: sourceY(midYLambda),
            widthLambda: 0.7,
            amplitude: 0.82,
          },
        ]);
        break;
      case "allOpticalSwitch":
        state.viewMode = "poynting";
        state.fieldDisplay = "scalar";
        state.materialNonlinearEnabled = true;
        state.materialPhaseChangeEnabled = true;
        state.kerrChi3 = 0.36;
        state.kerrSaturation = 3.0;
        state.phaseEpsOn = 4.8;
        state.phaseLossOn = 0.018;
        state.phaseThresholdOn = 0.001;
        state.phaseThresholdOff = 0.0003;
        state.phaseTauOn = 12;
        state.phaseTauOff = 180;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureAmplitudeSweep(0.1, 0.9, 9, 1100, true);
        guide(midYLambda, 0.22, mat.n15, 0.7, midXLambda - 1.15);
        guide(midYLambda - 0.38, 0.22, mat.n15, midXLambda - 1.05, midXLambda + 1.35);
        guide(midYLambda + 0.38, 0.22, mat.n15, midXLambda - 1.05, midXLambda + 1.35);
        rotatedRectL(midXLambda - 1.12, midYLambda - 0.19, 0.82, 0.22, -27, mat.n15);
        rotatedRectL(midXLambda - 1.12, midYLambda + 0.19, 0.82, 0.22, 27, mat.n15);
        rotatedRectL(midXLambda + 1.42, midYLambda - 0.19, 0.82, 0.22, 27, mat.n15);
        rotatedRectL(midXLambda + 1.42, midYLambda + 0.19, 0.82, 0.22, -27, mat.n15);
        guide(midYLambda, 0.22, mat.n15, midXLambda + 1.7, domainXLambda - 0.7);
        rectL(midXLambda - 0.05, midYLambda - 0.5, 0.55, 0.24, {
          ...mat.n34,
          loss: 0.001,
          nonlinear: true,
          phaseChange: true,
          phaseEpsOn: 4.8,
          phaseLossOn: 0.018,
        });
        modalGuideSource(midYLambda, { type: "gaussian", widthLambda: 1.25, amplitude: 0.74 });
        break;
      case "nonlinearLimiter":
        state.materialPhaseChangeEnabled = true;
        state.phaseEpsOn = 3.6;
        state.phaseLossOn = 0.16;
        state.phaseThresholdOn = 0.001;
        state.phaseThresholdOff = 0.0003;
        state.phaseTauOn = 8;
        state.phaseTauOff = 160;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureAmplitudeSweep(0.1, 1.0, 9, 900, true);
        rectL(midXLambda - 0.5, 0.8, 1.0, domainYLambda - 1.6, {
          material: 4,
          eps: 2.2,
          loss: 0.004,
          phaseChange: true,
          phaseEpsOn: 3.6,
          phaseLossOn: 0.16,
        });
        setSources([
          {
            type: "gaussian",
            shape: "gaussianProfile",
            xLambda: sourceX(0.9),
            yLambda: sourceY(midYLambda),
            widthLambda: 0.72,
            amplitude: 0.95,
          },
        ]);
        break;
      case "temporalInterface":
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.12;
        state.modulationFrequency = 0.01;
        state.modulationPeriodLambda = 20;
        state.modulationAngleDeg = 0;
        state.modulationPhaseDeg = 0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        rectL(midXLambda, 0.55, domainXLambda - midXLambda - 0.55, domainYLambda - 1.1, {
          ...uniformTemporalMaterial(mat.n15),
          loss: 0.001,
        });
        setSources([{ type: "sine", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.42 }]);
        break;
      case "temporalSlab":
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.14;
        state.modulationFrequency = 0.012;
        state.modulationPeriodLambda = 20;
        state.modulationAngleDeg = 0;
        state.modulationPhaseDeg = 0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        rectL(midXLambda - 0.75, 0.55, 1.5, domainYLambda - 1.1, uniformTemporalMaterial({ ...mat.n15, loss: 0.001 }));
        setSources([{ type: "sine", shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.42 }]);
        break;
      case "temporalModulation":
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.18;
        state.modulationFrequency = 0.012;
        state.modulationPeriodLambda = 20;
        state.modulationAngleDeg = 0;
        state.modulationPhaseDeg = 0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        rectL(midXLambda - 1.25, midYLambda - 1.0, 2.5, 2.0, uniformTemporalMaterial(mat.n15));
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda), amplitude: 0.4 }]);
        break;
      case "temporalCrystal":
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.13;
        state.modulationFrequency = 0.016;
        state.modulationPeriodLambda = 20;
        state.modulationAngleDeg = 0;
        state.modulationPhaseDeg = 0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        rectL(1.15, 0.65, domainXLambda - 2.3, domainYLambda - 1.3, uniformTemporalMaterial({ ...mat.n15, loss: 0.001 }));
        for (let i = -4; i <= 4; i += 1) {
          rectL(midXLambda + i * 0.48 - 0.035, 0.65, 0.07, domainYLambda - 1.3, uniformTemporalMaterial({ ...mat.n20, loss: 0.001 }));
        }
        setSources([{ type: "sine", shape: "line", xLambda: sourceX(0.85), yLambda: sourceY(midYLambda), amplitude: 0.38 }]);
        break;
      case "modulatedGuide":
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.14;
        state.modulationFrequency = 0.014;
        state.modulationPeriodLambda = 20;
        state.modulationAngleDeg = 0;
        state.modulationPhaseDeg = 0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        guide(midYLambda, 0.34, mat.n15, 0.6, domainXLambda - 0.6);
        guide(midYLambda, 0.34, uniformTemporalMaterial({ ...mat.n20, loss: 0.001 }), midXLambda - 1.25, midXLambda + 1.25);
        modalGuideSource(midYLambda, { type: "sine", widthLambda: 1.3, amplitude: 0.42 });
        break;
      case "travelingModulation":
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.2;
        state.modulationFrequency = 0.014;
        state.modulationPeriodLambda = 1.2;
        state.modulationAngleDeg = 0;
        state.modulationPhaseDeg = 0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        configureDirectionSweep(1000);
        guide(midYLambda, 0.34, { ...mat.n15, modulated: true }, midXLambda - 2.0, midXLambda + 2.0);
        gaussianGuideSource(midYLambda, { widthLambda: 0.32, amplitude: 0.4 });
        break;
      case "temporalIsolator":
        state.viewMode = "poynting";
        state.fieldDisplay = "scalar";
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.16;
        state.modulationFrequency = 0.015;
        state.modulationPeriodLambda = 1.05;
        state.modulationAngleDeg = 0;
        state.modulationPhaseDeg = 0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        configureDirectionSweep(1200);
        guide(midYLambda, 0.32, mat.n15, 0.55, domainXLambda - 0.55);
        guide(midYLambda, 0.32, { ...mat.n20, loss: 0.002, modulated: true }, midXLambda - 1.65, midXLambda + 1.65);
        rectL(midXLambda + 2.1, midYLambda - 0.5, 0.16, 1.0, mat.lossyN15);
        modalGuideSource(midYLambda, { widthLambda: 1.3, amplitude: 0.38 });
        break;
      case "modulatedRing":
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.1;
        state.modulationFrequency = 0.011;
        state.modulationPeriodLambda = 20;
        state.modulationAngleDeg = 0;
        state.modulationPhaseDeg = 0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        guide(midYLambda + 0.54, 0.26, mat.n15, 0.6, domainXLambda - 0.6);
        ringL(midXLambda + 0.2, midYLambda - 0.16, 0.62, 0.62, 0.43, 0.43, uniformTemporalMaterial({ ...mat.n34, loss: 0.0015 }));
        modalGuideSource(midYLambda + 0.54, { type: "sine", widthLambda: 1.25, amplitude: 0.42 });
        break;
      case "floquetResonators":
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.11;
        state.modulationFrequency = 0.015;
        state.modulationPeriodLambda = 1.35;
        state.modulationAngleDeg = 0;
        state.modulationPhaseDeg = 0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        guide(midYLambda + 0.42, 0.24, mat.n15, 0.65, domainXLambda - 0.65);
        for (let i = -1; i <= 1; i += 1) {
          ellipseL(
            midXLambda + i * 0.72,
            midYLambda - 0.1,
            0.28,
            0.28,
            uniformTemporalMaterial({ ...mat.n34, loss: 0.0015 }, ((i + 1) * 2 * Math.PI) / 3),
          );
        }
        modalGuideSource(midYLambda + 0.42, { type: "sine", widthLambda: 1.25, amplitude: 0.4 });
        break;
      case "syntheticFrequency":
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.1;
        state.modulationFrequency = 0.018;
        state.modulationPeriodLambda = 0.9;
        state.modulationAngleDeg = 0;
        state.modulationPhaseDeg = 0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        guide(midYLambda + 0.48, 0.22, mat.n15, 0.7, domainXLambda - 0.7);
        for (let i = -2; i <= 2; i += 1) {
          ellipseL(
            midXLambda + i * 0.48,
            midYLambda - 0.02,
            0.2,
            0.2,
            uniformTemporalMaterial({ ...mat.n20, loss: 0.002 }, ((i + 2) * 2 * Math.PI) / 5),
          );
        }
        modalGuideSource(midYLambda + 0.48, { type: "sine", widthLambda: 1.25, amplitude: 0.38 });
        break;
      case "ptSymmetricCoupler":
        state.materialSaturableGainEnabled = true;
        state.gainSaturation = 3.6;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureGainLossSweep(0, 0.065, 11, 1000);
        guide(midYLambda - 0.24, 0.24, mat.ptGain, 0.7, domainXLambda - 0.7);
        guide(midYLambda + 0.24, 0.24, mat.ptLoss, 0.7, domainXLambda - 0.7);
        setSources([
          {
            type: "gaussian",
            shape: "gaussianProfile",
            xLambda: sourceX(0.95),
            yLambda: sourceY(midYLambda + 0.24),
            widthLambda: 0.28,
            amplitude: 0.42,
          },
        ]);
        break;
      case "exceptionalPointCoupler":
        state.materialSaturableGainEnabled = true;
        state.gainSaturation = 3.0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureGainLossSweep(0, 0.08, 11, 1200);
        guide(midYLambda - 0.18, 0.22, { material: 4, eps: 6.25, loss: -0.04 }, 0.7, domainXLambda - 0.7);
        guide(midYLambda + 0.18, 0.22, { material: 4, eps: 6.25, loss: 0.04 }, 0.7, domainXLambda - 0.7);
        rectL(midXLambda - 0.48, midYLambda - 0.08, 0.96, 0.16, { material: 4, eps: 3.4, loss: 0.002 });
        setSources([
          {
            type: "gaussian",
            shape: "gaussianProfile",
            xLambda: sourceX(0.95),
            yLambda: sourceY(midYLambda - 0.18),
            widthLambda: 0.24,
            amplitude: 0.38,
          },
        ]);
        break;
      case "nonHermitianSkin":
        state.materialSaturableGainEnabled = true;
        state.gainSaturation = 3.4;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        sshChain(0.22, 0.44, true, {
          count: 19,
          radiusForSite: (i) => (i % 2 === 0 ? 0.13 : 0.11),
          paramsForSite: (i, center) => {
            const bias = (i - center) / Math.max(1, center);
            return { material: 4, eps: 6.25, loss: clamp(-0.022 * bias, -0.024, 0.024) };
          },
        });
        setSources([{ type: "gaussian", shape: "pointDipole", xLambda: sourceX(midXLambda - 2.4), yLambda: sourceY(midYLambda), widthLambda: 0.22, amplitude: 0.44 }]);
        break;
      case "bicKerr":
        state.materialNonlinearEnabled = true;
        state.kerrChi3 = 0.55;
        state.kerrSaturation = 3.2;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureBlochSweep(0, 1, 13, 120);
        phc({ skip: (ix, iy) => ix === 0 && iy === 0, rows: 9, cols: 15 });
        ellipseL(midXLambda, midYLambda, 0.22, 0.22, { ...mat.n34, loss: 0.001, nonlinear: true });
        setSources([
          { type: "sine", shape: "pointDipole", xLambda: sourceX(midXLambda - 0.16), yLambda: sourceY(midYLambda), widthLambda: 0.18, amplitude: 0.28, phaseDeg: 0 },
          { type: "sine", shape: "pointDipole", xLambda: sourceX(midXLambda + 0.16), yLambda: sourceY(midYLambda), widthLambda: 0.18, amplitude: 0.28, phaseDeg: 180 },
        ]);
        break;
      case "bicEnz":
        state.materialDispersionEnabled = true;
        state.dispersionModel = "drude";
        state.dispersionOmegaP = mat.enz.omegaP;
        state.dispersionGamma = mat.enz.gamma;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureBlochSweep(0, 1, 13, 120);
        phc({
          skip: (ix, iy) => ix === 0 && iy === 0,
          rows: 9,
          cols: 15,
          radiusScale: (ix, iy) => (Math.abs(ix) === 1 && iy === 0 ? 0.88 : 1),
        });
        ellipseL(midXLambda + 0.24, midYLambda, 0.18, 0.18, { ...mat.enz, loss: 0.025 });
        setSources([
          { type: "sine", shape: "pointDipole", xLambda: sourceX(midXLambda - 0.18), yLambda: sourceY(midYLambda), widthLambda: 0.18, amplitude: 0.28, phaseDeg: 0 },
          { type: "sine", shape: "pointDipole", xLambda: sourceX(midXLambda + 0.18), yLambda: sourceY(midYLambda), widthLambda: 0.18, amplitude: 0.24, phaseDeg: 180 },
        ]);
        break;
      case "janusTopologicalGuide":
        state.viewMode = "poynting";
        state.fieldDisplay = "scalar";
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        valleyHallLattice();
        setSources([{ type: "gaussian", shape: "janusDipole", xLambda: sourceX(1.35), yLambda: sourceY(midYLambda - 0.22), widthLambda: 0.36, angleDeg: 0, amplitude: 0.52 }]);
        break;
      case "huygensCavity":
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        guide(midYLambda, 0.24, mat.n15, 0.65, domainXLambda - 0.65);
        ellipseL(midXLambda + 0.7, midYLambda - 0.48, 0.38, 0.38, mat.n34);
        setSources([{ type: "gaussian", shape: "huygens", xLambda: sourceX(midXLambda - 1.15), yLambda: sourceY(midYLambda), widthLambda: 0.34, angleDeg: 0, amplitude: 0.46 }]);
        break;
      case "topologyTemporalMod":
        state.viewMode = "poynting";
        state.fieldDisplay = "scalar";
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.12;
        state.modulationFrequency = 0.012;
        state.modulationPeriodLambda = 20;
        state.modulationAngleDeg = 0;
        state.modulationPhaseDeg = 0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        configureDirectionSweep(1200);
        valleyHallLattice();
        rectL(midXLambda - 0.75, midYLambda - 0.16, 1.5, 0.32, uniformTemporalMaterial({ ...mat.n20, loss: 0.002 }));
        setSources([{ type: "sine", shape: "gaussianProfile", xLambda: sourceX(0.95), yLambda: sourceY(midYLambda), widthLambda: 0.3, amplitude: 0.52 }]);
        break;
      case "nonreciprocalValleyHall":
        state.viewMode = "poynting";
        state.fieldDisplay = "scalar";
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.14;
        state.modulationFrequency = 0.014;
        state.modulationPeriodLambda = 1.15;
        state.modulationAngleDeg = 0;
        state.modulationPhaseDeg = 0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 3;
        configureDirectionSweep(1200);
        valleyHallLattice();
        rectL(midXLambda - 1.1, midYLambda - 0.18, 2.2, 0.36, { ...mat.n20, loss: 0.002, modulated: true });
        setSources([{ type: "sine", shape: "gaussianProfile", xLambda: sourceX(0.95), yLambda: sourceY(midYLambda), widthLambda: 0.3, amplitude: 0.5 }]);
        break;
      case "spaceTimeCrystal":
        state.materialModulationEnabled = true;
        state.modulationDepth = 0.12;
        state.modulationFrequency = 0.016;
        state.modulationPeriodLambda = 1.2;
        state.modulationAngleDeg = 0;
        state.modulationPhaseDeg = 0;
        state.analysisEnabled = true;
        state.analysisSampleEvery = 2;
        configureDirectionSweep(1200);
        for (let i = -5; i <= 5; i += 1) {
          const params = i % 2 === 0 ? mat.n15 : mat.n20;
          rectL(midXLambda + i * 0.32 - 0.08, 0.7, 0.16, domainYLambda - 1.4, { ...params, loss: 0.0015, modulated: true });
        }
        setSources([{ type: "sine", shape: "line", xLambda: sourceX(0.85), yLambda: sourceY(midYLambda), amplitude: 0.38 }]);
        break;
      case "dielectricBlock":
        rectL(midXLambda - 0.9, midYLambda - 1.0, 1.8, 2.0, mat.n15);
        break;
      case "lens":
        ellipseL(midXLambda + 0.6, midYLambda, 0.55, 1.7, mat.n15);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "waveguide":
        guide(midYLambda - 0.5, 0.12, mat.pec);
        guide(midYLambda + 0.5, 0.12, mat.pec);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "scatterers":
        scatterCluster(8, mat.n20, 0.16);
        scatterCluster(4, mat.lossyN15, 0.14, true);
        setSources([{ shape: "line", xLambda: sourceX(0.9), yLambda: sourceY(midYLambda) }]);
        break;
      case "empty":
      default:
        break;
    }
    this.refreshCpmlMaterialContinuation(false);
    this.markMaterialChanged();
    this.resetFields();
  }
});
