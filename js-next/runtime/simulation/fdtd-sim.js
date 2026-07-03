"use strict";

class FDTDSim {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.surfaceCanvas = document.getElementById?.("surfaceCanvas") || null;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.courant = COURANT;
    this.wasmBackend = null;
    this.viewX = 0;
    this.viewY = 0;
    this.viewZoom = 1;
    this.fieldScale = 1;
    this.fieldLog10Scale = 0;
    this.renormalizedCount = 0;
    this.lastRenormalized = false;
    this.lastDiverged = false;
    this.resize(config.nx, config.ny);
  }

  resize(nx, ny) {
    this.nx = nx;
    this.ny = ny;
    this.n = nx * ny;
    this.allocateArrays();
    this.cpmlLayer = 0;
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
    this.renormalizedCount = 0;
    this.lastRenormalized = false;
    this.lastDiverged = false;
    this.offscreen = document.createElement("canvas");
    this.offscreen.width = nx;
    this.offscreen.height = ny;
    this.offscreenCtx = this.offscreen.getContext("2d", { alpha: false });
    this.image = this.offscreenCtx.createImageData(nx, ny);
    this.clearMaterials(false);
    this.resetFields();
    this.buildBoundary(state.boundary);
    this.resetView();
    updateCanvasAspectRatio(nx, ny);
    this.fitCanvas();
  }

  id(x, y) {
    return x + y * this.nx;
  }
}
