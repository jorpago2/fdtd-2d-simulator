"use strict";

Object.assign(FDTDSim.prototype, {
  buildBoundary() {
    normalizeBoundarySides();
    const layer = anyAbsorbingBoundarySide() ? this.nominalBoundaryLayer() : 0;
    this.cpmlLayer = layer;
    this.cpmlOrder = 4;
    this.cpmlKappaMax = 6;
    this.cpmlAlphaMax = 0.08 * this.courant;
    this.cpmlTargetReflection = 1e-10;

    this.buildCpmlProfile(this.cpmlKappaEX, this.cpmlAlphaEX, this.cpmlAEX, this.cpmlBEX, this.nx, 0, "left", "right");
    this.buildCpmlProfile(this.cpmlKappaEY, this.cpmlAlphaEY, this.cpmlAEY, this.cpmlBEY, this.ny, 0, "top", "bottom");
    this.buildCpmlProfile(this.cpmlKappaHX, this.cpmlAlphaHX, this.cpmlAHX, this.cpmlBHX, this.nx, 0.5, "left", "right");
    this.buildCpmlProfile(this.cpmlKappaHY, this.cpmlAlphaHY, this.cpmlAHY, this.cpmlBHY, this.ny, 0.5, "top", "bottom");
    this.resetCpmlMemory();
    this.refreshCpmlMaterialContinuation(false);
  },

  buildCpmlProfile(kappaArray, alphaArray, aArray, bArray, length, offset, minSide, maxSide) {
    const layer = this.cpmlLayer;
    const order = this.cpmlOrder || 4;
    const kappaMax = Math.max(1, Number(this.cpmlKappaMax) || 1);
    const alphaMax = Math.max(0, Number(this.cpmlAlphaMax) || 0);
    const targetReflection = Math.min(0.5, Math.max(1e-14, Number(this.cpmlTargetReflection) || 1e-10));
    const sigmaMax = layer > 0 ? (-Math.log(targetReflection) * (order + 1)) / (2 * layer) : 0;
    const minSideAbsorbing = boundarySideIsAbsorbing(minSide);
    const maxSideAbsorbing = boundarySideIsAbsorbing(maxSide);
    const edge = length - 1;

    for (let i = 0; i < length; i += 1) {
      let normalizedDepth = 0;
      if (layer > 0) {
        const position = i + offset;
        const minDepth = minSideAbsorbing ? layer - position : 0;
        const maxDepth = maxSideAbsorbing ? layer - (edge - position) : 0;
        normalizedDepth = clamp(Math.max(minDepth, maxDepth, 0) / layer, 0, 1);
      }

      if (normalizedDepth <= 0) {
        kappaArray[i] = 1;
        alphaArray[i] = 0;
        aArray[i] = 0;
        bArray[i] = 1;
        continue;
      }

      const graded = Math.pow(normalizedDepth, order);
      const sigmaDt = this.courant * sigmaMax * graded;
      const kappa = 1 + (kappaMax - 1) * graded;
      const alphaDt = alphaMax * (1 - normalizedDepth);
      const decayArgument = sigmaDt / kappa + alphaDt;
      const b = Math.exp(-decayArgument);
      const denominator = sigmaDt * kappa + kappa * kappa * alphaDt;
      const a = denominator > 1e-12 ? (sigmaDt * (b - 1)) / denominator : 0;
      kappaArray[i] = kappa;
      alphaArray[i] = alphaDt;
      aArray[i] = a;
      bArray[i] = b;
    }
  },

  resetCpmlMemory() {
    this.cpmlPsiHxY?.fill(0);
    this.cpmlPsiHyX?.fill(0);
    this.cpmlPsiEzX?.fill(0);
    this.cpmlPsiEzY?.fill(0);
    this.cpmlPsiExY?.fill(0);
    this.cpmlPsiEyX?.fill(0);
    this.cpmlPsiHzX?.fill(0);
    this.cpmlPsiHzY?.fill(0);
    this.cpmlPsiDualHxY?.fill(0);
    this.cpmlPsiDualHyX?.fill(0);
    this.cpmlPsiDualEzX?.fill(0);
    this.cpmlPsiDualEzY?.fill(0);
  },

  cpmlDerivativeX(rawDerivative, memory, idx, x, electricFieldPosition = true) {
    const kappaArray = electricFieldPosition ? this.cpmlKappaEX : this.cpmlKappaHX;
    const aArray = electricFieldPosition ? this.cpmlAEX : this.cpmlAHX;
    const bArray = electricFieldPosition ? this.cpmlBEX : this.cpmlBHX;
    const kappa = kappaArray[x] || 1;
    const a = aArray[x] || 0;
    if (a !== 0) memory[idx] = (bArray[x] || 0) * memory[idx] + a * rawDerivative;
    return rawDerivative / kappa + (a !== 0 ? memory[idx] : 0);
  },

  cpmlDerivativeY(rawDerivative, memory, idx, y, electricFieldPosition = true) {
    const kappaArray = electricFieldPosition ? this.cpmlKappaEY : this.cpmlKappaHY;
    const aArray = electricFieldPosition ? this.cpmlAEY : this.cpmlAHY;
    const bArray = electricFieldPosition ? this.cpmlBEY : this.cpmlBHY;
    const kappa = kappaArray[y] || 1;
    const a = aArray[y] || 0;
    if (a !== 0) memory[idx] = (bArray[y] || 0) * memory[idx] + a * rawDerivative;
    return rawDerivative / kappa + (a !== 0 ? memory[idx] : 0);
  },

  cpmlActive() {
    return this.cpmlLayer > 0 && anyAbsorbingBoundarySide();
  },

  nominalBoundaryLayer() {
    const smallestDimension = Math.min(this.nx, this.ny);
    const wavelengthLayer = Math.round(state.cellsPerWavelength * 0.9);
    const fractionalLayer = Math.round(smallestDimension * 0.16);
    const desiredLayer = Math.max(18, wavelengthLayer, fractionalLayer);
    const maxLayer = Math.max(10, Math.floor(smallestDimension * 0.24));
    return Math.min(desiredLayer, maxLayer);
  },

  boundaryControlLayer() {
    return this.cpmlLayer > 0 ? this.cpmlLayer : this.nominalBoundaryLayer();
  },

  reflectiveWallThicknessCells(layer = this.boundaryControlLayer()) {
    return clampInt(Math.round(state.cellsPerWavelength * 0.14), 3, Math.max(3, Math.min(10, Math.floor(layer * 0.45))));
  },

  zeroOuterElectricField() {
    const nx = this.nx;
    const ny = this.ny;
    for (let x = 0; x < nx; x += 1) {
      this.zeroElectricCell(x);
      this.zeroElectricCell(x + (ny - 1) * nx);
    }
    for (let y = 0; y < ny; y += 1) {
      this.zeroElectricCell(y * nx);
      this.zeroElectricCell(y * nx + nx - 1);
    }
  },

  zeroOuterBoundaryFields() {
    const nx = this.nx;
    const ny = this.ny;
    this.zeroOuterElectricField();
    for (let x = 0; x < nx; x += 1) {
      const top = x;
      const bottom = x + (ny - 1) * nx;
      this.hx[top] = 0;
      this.hy[top] = 0;
      this.hx[bottom] = 0;
      this.hy[bottom] = 0;
      this.zeroDualFieldCell(top);
      this.zeroDualFieldCell(bottom);
    }
    for (let y = 0; y < ny; y += 1) {
      const left = y * nx;
      const right = left + nx - 1;
      this.hx[left] = 0;
      this.hy[left] = 0;
      this.hx[right] = 0;
      this.hy[right] = 0;
      this.zeroDualFieldCell(left);
      this.zeroDualFieldCell(right);
    }
  },

  zeroReflectiveBoundaryFields() {
    const layer = this.boundaryControlLayer();
    if (layer <= 0) return;
    const thickness = this.reflectiveWallThicknessCells(layer);

    const zeroRect = (x0, y0, x1, y1) => {
      const minX = clampInt(x0, 0, this.nx);
      const minY = clampInt(y0, 0, this.ny);
      const maxX = clampInt(x1, 0, this.nx);
      const maxY = clampInt(y1, 0, this.ny);
      for (let y = minY; y < maxY; y += 1) {
        const row = y * this.nx;
        for (let x = minX; x < maxX; x += 1) {
          const idx = row + x;
          this.zeroElectricCell(idx);
          this.hx[idx] = 0;
          this.hy[idx] = 0;
          this.zeroDualFieldCell(idx);
        }
      }
    };

    if (!boundarySideIsAbsorbing("left")) zeroRect(layer - thickness, 0, layer, this.ny);
    if (!boundarySideIsAbsorbing("right")) zeroRect(this.nx - layer, 0, this.nx - layer + thickness, this.ny);
    if (!boundarySideIsAbsorbing("top")) zeroRect(0, layer - thickness, this.nx, layer);
    if (!boundarySideIsAbsorbing("bottom")) zeroRect(0, this.ny - layer, this.nx, this.ny - layer + thickness);
  },

  zeroBoundaryFields() {
    this.zeroOuterBoundaryFields();
    this.zeroReflectiveBoundaryFields();
  },

  refreshCpmlMaterialContinuation(resetCpmlFields = false) {
    if (!anyAbsorbingBoundarySide() || this.cpmlLayer <= 0) return;
    const minX = this.activeInteriorMinX();
    const minY = this.activeInteriorMinY();
    const maxX = this.activeInteriorMaxX();
    const maxY = this.activeInteriorMaxY();
    if (maxX < minX || maxY < minY) return;

    for (let y = 0; y < this.ny; y += 1) {
      const sourceY = Math.max(minY, Math.min(maxY, y));
      for (let x = 0; x < this.nx; x += 1) {
        if (!this.isInCpml(x, y)) continue;
        const sourceX = Math.max(minX, Math.min(maxX, x));
        const idx = this.id(x, y);
        this.copyPassiveCpmlMaterialCellByIndex(idx, this.id(sourceX, sourceY));
        if (resetCpmlFields || this.material[idx] === 2) {
          this.zeroElectricCell(idx);
          this.hx[idx] = 0;
          this.hy[idx] = 0;
        }
      }
    }
  },

  clearCpmlMaterials() {
    this.refreshCpmlMaterialContinuation(true);
  },

  isInCpml(x, y) {
    return (
      this.cpmlLayer > 0 &&
      ((boundarySideIsAbsorbing("left") && x < this.cpmlLayer) ||
        (boundarySideIsAbsorbing("right") && x >= this.nx - this.cpmlLayer) ||
        (boundarySideIsAbsorbing("top") && y < this.cpmlLayer) ||
        (boundarySideIsAbsorbing("bottom") && y >= this.ny - this.cpmlLayer))
    );
  },

  isInReflectiveBoundary(x, y) {
    const layer = this.boundaryControlLayer();
    return (
      layer > 0 &&
      ((!boundarySideIsAbsorbing("left") && x < layer) ||
        (!boundarySideIsAbsorbing("right") && x >= this.nx - layer) ||
        (!boundarySideIsAbsorbing("top") && y < layer) ||
        (!boundarySideIsAbsorbing("bottom") && y >= this.ny - layer))
    );
  },

  boundarySideAtCell(x, y) {
    const layer = this.boundaryControlLayer();
    if (layer <= 0) return null;
    const candidates = [];
    if (x < layer) candidates.push({ side: "left", distance: x });
    if (x >= this.nx - layer) candidates.push({ side: "right", distance: this.nx - 1 - x });
    if (y < layer) candidates.push({ side: "top", distance: y });
    if (y >= this.ny - layer) candidates.push({ side: "bottom", distance: this.ny - 1 - y });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0].side;
  },

  isInBoundaryControlRegion(x, y) {
    return Boolean(this.boundarySideAtCell(x, y));
  },

  clientIsInBoundaryControlRegion(clientX, clientY) {
    const point = this.clientToGridCell(clientX, clientY);
    return this.isInBoundaryControlRegion(point.x, point.y);
  },

  boundarySideAtClientPoint(clientX, clientY) {
    const point = this.clientToGridCell(clientX, clientY);
    return this.boundarySideAtCell(point.x, point.y);
  },

  clearBoundarySideMaterials(side) {
    const layer = this.boundaryControlLayer();
    const clearCell = (x, y) => {
      const idx = this.id(x, y);
      this.writeAirCellAtIndex(idx);
      this.zeroElectricCell(idx);
      this.zeroDualFieldCell(idx);
      this.hx[idx] = 0;
      this.hy[idx] = 0;
    };
    if (side === "left") {
      for (let y = 1; y < this.ny - 1; y += 1) {
        for (let x = 1; x < Math.min(this.nx - 1, layer); x += 1) clearCell(x, y);
      }
    } else if (side === "right") {
      for (let y = 1; y < this.ny - 1; y += 1) {
        for (let x = Math.max(1, this.nx - layer); x < this.nx - 1; x += 1) clearCell(x, y);
      }
    } else if (side === "top") {
      for (let y = 1; y < Math.min(this.ny - 1, layer); y += 1) {
        for (let x = 1; x < this.nx - 1; x += 1) clearCell(x, y);
      }
    } else if (side === "bottom") {
      for (let y = Math.max(1, this.ny - layer); y < this.ny - 1; y += 1) {
        for (let x = 1; x < this.nx - 1; x += 1) clearCell(x, y);
      }
    }
  }
});
