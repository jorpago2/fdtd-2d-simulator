"use strict";

Object.assign(FDTDSim.prototype, {
  buildBoundary() {
    normalizeBoundarySides();
    const layer = anyAbsorbingBoundarySide() ? this.nominalBoundaryLayer() : 0;
    const order = 4;
    const targetReflection = 1e-10;
    const sigmaMax = layer > 0 ? (-Math.log(targetReflection) * (order + 1)) / (2 * layer) : 0;
    this.pmlLayer = layer;

    const fillProfile = (ca, cb, length, offset, minSideAbsorbing, maxSideAbsorbing) => {
      const edge = length - 1;
      for (let i = 0; i < length; i += 1) {
        let sigma = 0;
        if (layer > 0) {
          const position = i + offset;
          const leftDepth = minSideAbsorbing ? layer - position : 0;
          const rightDepth = maxSideAbsorbing ? layer - (edge - position) : 0;
          const depth = Math.max(leftDepth, rightDepth, 0);
          if (depth > 0) {
            const normalizedDepth = depth / layer;
            sigma = this.courant * sigmaMax * Math.pow(normalizedDepth, order);
          }
        }

        if (sigma > 1e-9) {
          const decay = Math.exp(-sigma);
          ca[i] = decay;
          cb[i] = (1 - decay) / sigma;
        } else {
          ca[i] = 1;
          cb[i] = 1;
        }
      }
    };

    fillProfile(this.eCaX, this.eCbX, this.nx, 0, boundarySideIsAbsorbing("left"), boundarySideIsAbsorbing("right"));
    fillProfile(this.eCaY, this.eCbY, this.ny, 0, boundarySideIsAbsorbing("top"), boundarySideIsAbsorbing("bottom"));
    fillProfile(this.hCaX, this.hCbX, this.nx, 0.5, boundarySideIsAbsorbing("left"), boundarySideIsAbsorbing("right"));
    fillProfile(this.hCaY, this.hCbY, this.ny, 0.5, boundarySideIsAbsorbing("top"), boundarySideIsAbsorbing("bottom"));
    this.refreshPmlMaterialContinuation(false);
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
    return this.pmlLayer > 0 ? this.pmlLayer : this.nominalBoundaryLayer();
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

    if (!boundarySideIsAbsorbing("left")) zeroRect(0, 0, layer, this.ny);
    if (!boundarySideIsAbsorbing("right")) zeroRect(this.nx - layer, 0, this.nx, this.ny);
    if (!boundarySideIsAbsorbing("top")) zeroRect(0, 0, this.nx, layer);
    if (!boundarySideIsAbsorbing("bottom")) zeroRect(0, this.ny - layer, this.nx, this.ny);
  },

  zeroBoundaryFields() {
    this.zeroOuterBoundaryFields();
    this.zeroReflectiveBoundaryFields();
  },

  refreshPmlMaterialContinuation(resetPmlFields = false) {
    if (!anyAbsorbingBoundarySide() || this.pmlLayer <= 0) return;
    const minX = boundarySideIsAbsorbing("left") ? this.pmlLayer : 0;
    const minY = boundarySideIsAbsorbing("top") ? this.pmlLayer : 0;
    const maxX = boundarySideIsAbsorbing("right") ? this.nx - this.pmlLayer - 1 : this.nx - 1;
    const maxY = boundarySideIsAbsorbing("bottom") ? this.ny - this.pmlLayer - 1 : this.ny - 1;
    if (maxX < minX || maxY < minY) return;

    for (let y = 0; y < this.ny; y += 1) {
      const sourceY = Math.max(minY, Math.min(maxY, y));
      for (let x = 0; x < this.nx; x += 1) {
        if (!this.isInPml(x, y)) continue;
        const sourceX = Math.max(minX, Math.min(maxX, x));
        const idx = this.id(x, y);
        this.copyMaterialCellByIndex(idx, this.id(sourceX, sourceY));
        if (resetPmlFields || this.material[idx] === 2) {
          this.zeroElectricCell(idx);
          this.hx[idx] = 0;
          this.hy[idx] = 0;
        }
      }
    }
  },

  clearPmlMaterials() {
    this.refreshPmlMaterialContinuation(true);
  },

  isInPml(x, y) {
    return (
      this.pmlLayer > 0 &&
      ((boundarySideIsAbsorbing("left") && x < this.pmlLayer) ||
        (boundarySideIsAbsorbing("right") && x >= this.nx - this.pmlLayer) ||
        (boundarySideIsAbsorbing("top") && y < this.pmlLayer) ||
        (boundarySideIsAbsorbing("bottom") && y >= this.ny - this.pmlLayer))
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
