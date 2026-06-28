"use strict";

class FDTDSim {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
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

  allocateArrays() {
    if (this.wasmBackend) {
      this.wasmBackend.configure(this);
    } else {
      this.ez = new Float32Array(this.n);
      this.ezx = new Float32Array(this.n);
      this.ezy = new Float32Array(this.n);
      this.hx = new Float32Array(this.n);
      this.hy = new Float32Array(this.n);
      this.eps = new Float32Array(this.n);
      this.loss = new Float32Array(this.n);
      this.epsY = new Float32Array(this.n);
      this.lossY = new Float32Array(this.n);
      this.conductivity = new Float32Array(this.n);
      this.conductivityY = new Float32Array(this.n);
      this.mu = new Float32Array(this.n);
      this.muLoss = new Float32Array(this.n);
      this.muY = new Float32Array(this.n);
      this.muLossY = new Float32Array(this.n);
      this.material = new Uint8Array(this.n);
      this.nonlinearMaterial = new Uint8Array(this.n);
      this.electricTensorMaterial = new Uint8Array(this.n);
      this.gyrotropicMaterial = new Uint8Array(this.n);
      this.modulationBaseEps = new Float32Array(this.n);
      this.modulationBaseEpsY = new Float32Array(this.n);
      this.epsilonXY = new Float32Array(this.n);
      this.gyrotropyG = new Float32Array(this.n);
      this.eCaX = new Float32Array(this.nx);
      this.eCbX = new Float32Array(this.nx);
      this.hCaX = new Float32Array(this.nx);
      this.hCbX = new Float32Array(this.nx);
      this.eCaY = new Float32Array(this.ny);
      this.eCbY = new Float32Array(this.ny);
      this.hCaY = new Float32Array(this.ny);
      this.hCbY = new Float32Array(this.ny);
    }
    this.modulatedMaterial = new Uint8Array(this.n);
    this.dispersiveMaterial = new Uint8Array(this.n);
    this.dispersionAxes = new Uint8Array(this.n);
    this.dispersionAxisX = new Float32Array(this.n);
    this.dispersionAxisY = new Float32Array(this.n);
    this.bianisotropicMaterial = new Uint8Array(this.n);
    this.bianisotropyKappa = new Float32Array(this.n);
    this.bianisotropyPrevScalar = new Float32Array(this.n);
    this.bianisotropyPrevSplitX = new Float32Array(this.n);
    this.bianisotropyPrevSplitY = new Float32Array(this.n);
    this.bianisotropyPrevTx = new Float32Array(this.n);
    this.bianisotropyPrevTy = new Float32Array(this.n);
    this.dualEz = new Float32Array(this.n);
    this.dualEzx = new Float32Array(this.n);
    this.dualEzy = new Float32Array(this.n);
    this.dualHx = new Float32Array(this.n);
    this.dualHy = new Float32Array(this.n);
    this.bianisotropyPrevDualEz = new Float32Array(this.n);
    this.bianisotropyPrevDualEzx = new Float32Array(this.n);
    this.bianisotropyPrevDualEzy = new Float32Array(this.n);
    this.bianisotropyPrevDualHx = new Float32Array(this.n);
    this.bianisotropyPrevDualHy = new Float32Array(this.n);
    this.phaseChangeMaterial = new Uint8Array(this.n);
    this.phaseState = new Float32Array(this.n);
    this.phaseEpsOff = new Float32Array(this.n);
    this.phaseLossOff = new Float32Array(this.n);
    this.phaseEpsYOff = new Float32Array(this.n);
    this.phaseLossYOff = new Float32Array(this.n);
    this.phaseEpsOn = new Float32Array(this.n);
    this.phaseLossOn = new Float32Array(this.n);
    this.phaseEpsYOn = new Float32Array(this.n);
    this.phaseLossYOn = new Float32Array(this.n);
    this.dispersionOmegaP = new Float32Array(this.n);
    this.dispersionGamma = new Float32Array(this.n);
    this.dispersionOmega0 = new Float32Array(this.n);
    this.dispersionDeltaEps = new Float32Array(this.n);
    this.dispersionTau = new Float32Array(this.n);
    this.muDispersiveMaterial = new Uint8Array(this.n);
    this.muDispersionAxes = new Uint8Array(this.n);
    this.muDispersionOmegaP = new Float32Array(this.n);
    this.muDispersionGamma = new Float32Array(this.n);
    this.muDispersionOmega0 = new Float32Array(this.n);
    this.muDispersionDeltaMu = new Float32Array(this.n);
    this.muDispersionTau = new Float32Array(this.n);
    this.dispPz = new Float32Array(this.n);
    this.dispJz = new Float32Array(this.n);
    this.dispPx = new Float32Array(this.n);
    this.dispJx = new Float32Array(this.n);
    this.dispPy = new Float32Array(this.n);
    this.dispJy = new Float32Array(this.n);
    this.magDispMz = new Float32Array(this.n);
    this.magDispJz = new Float32Array(this.n);
    this.magDispMx = new Float32Array(this.n);
    this.magDispJx = new Float32Array(this.n);
    this.magDispMy = new Float32Array(this.n);
    this.magDispJy = new Float32Array(this.n);
    this.harmonicPrevPz = new Float32Array(this.n);
    this.harmonicPrevPx = new Float32Array(this.n);
    this.harmonicPrevPy = new Float32Array(this.n);
  }

  resize(nx, ny) {
    this.nx = nx;
    this.ny = ny;
    this.n = nx * ny;
    this.allocateArrays();
    this.pmlLayer = 0;
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

  maxViewZoom() {
    return Math.max(1, Math.min(80, this.nx / 8, this.ny / 8));
  }

  visibleGridWidth() {
    return this.nx / this.viewZoom;
  }

  visibleGridHeight() {
    return this.ny / this.viewZoom;
  }

  resetView() {
    this.viewZoom = 1;
    this.viewX = 0;
    this.viewY = 0;
  }

  clampView() {
    this.viewZoom = clamp(this.viewZoom, 1, this.maxViewZoom());
    const viewWidth = this.visibleGridWidth();
    const viewHeight = this.visibleGridHeight();
    this.viewX = viewWidth >= this.nx ? 0 : clamp(this.viewX, 0, this.nx - viewWidth);
    this.viewY = viewHeight >= this.ny ? 0 : clamp(this.viewY, 0, this.ny - viewHeight);
  }

  zoomAtClientPoint(clientX, clientY, factor) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const fracX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const fracY = clamp((clientY - rect.top) / rect.height, 0, 1);
    const worldX = this.viewX + fracX * this.visibleGridWidth();
    const worldY = this.viewY + fracY * this.visibleGridHeight();
    const nextZoom = clamp(this.viewZoom * factor, 1, this.maxViewZoom());
    if (Math.abs(nextZoom - this.viewZoom) < 1e-6) return false;
    this.viewZoom = nextZoom;
    this.viewX = worldX - fracX * this.visibleGridWidth();
    this.viewY = worldY - fracY * this.visibleGridHeight();
    this.clampView();
    return true;
  }

  setZoomFromGesture(anchorClientX, anchorClientY, anchorWorldX, anchorWorldY, nextZoom) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const fracX = clamp((anchorClientX - rect.left) / rect.width, 0, 1);
    const fracY = clamp((anchorClientY - rect.top) / rect.height, 0, 1);
    this.viewZoom = clamp(nextZoom, 1, this.maxViewZoom());
    this.viewX = anchorWorldX - fracX * this.visibleGridWidth();
    this.viewY = anchorWorldY - fracY * this.visibleGridHeight();
    this.clampView();
    return true;
  }

  panByClientDelta(deltaX, deltaY) {
    if (this.viewZoom <= 1) return false;
    const rect = this.canvas.getBoundingClientRect();
    this.viewX -= (deltaX / Math.max(1, rect.width)) * this.visibleGridWidth();
    this.viewY -= (deltaY / Math.max(1, rect.height)) * this.visibleGridHeight();
    this.clampView();
    return true;
  }

  clientToGridFloat(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const fracX = rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;
    const fracY = rect.height > 0 ? clamp((clientY - rect.top) / rect.height, 0, 1) : 0;
    return {
      x: this.viewX + fracX * this.visibleGridWidth(),
      y: this.viewY + fracY * this.visibleGridHeight(),
    };
  }

  clientToGridCell(clientX, clientY) {
    const point = this.clientToGridFloat(clientX, clientY);
    return {
      x: clampInt(Math.floor(point.x), 1, this.nx - 2),
      y: clampInt(Math.floor(point.y), 1, this.ny - 2),
    };
  }

  gridToCanvasX(x) {
    return ((x - this.viewX) / this.visibleGridWidth()) * this.canvas.width;
  }

  gridToCanvasY(y) {
    return ((y - this.viewY) / this.visibleGridHeight()) * this.canvas.height;
  }

  gridRectToCanvas(x0, y0, x1, y1) {
    const visibleX0 = Math.max(x0, this.viewX);
    const visibleY0 = Math.max(y0, this.viewY);
    const visibleX1 = Math.min(x1, this.viewX + this.visibleGridWidth());
    const visibleY1 = Math.min(y1, this.viewY + this.visibleGridHeight());
    if (visibleX1 <= visibleX0 || visibleY1 <= visibleY0) return null;
    const left = this.gridToCanvasX(visibleX0);
    const top = this.gridToCanvasY(visibleY0);
    const right = this.gridToCanvasX(visibleX1);
    const bottom = this.gridToCanvasY(visibleY1);
    return {
      left,
      top,
      width: right - left,
      height: bottom - top,
    };
  }

  attachWasmBackend(backend) {
    if (this.wasmBackend) return;
    const previous = {
      ez: new Float32Array(this.ez),
      ezx: new Float32Array(this.ezx),
      ezy: new Float32Array(this.ezy),
      hx: new Float32Array(this.hx),
      hy: new Float32Array(this.hy),
      eps: new Float32Array(this.eps),
      loss: new Float32Array(this.loss),
      epsY: new Float32Array(this.epsY),
      lossY: new Float32Array(this.lossY),
      mu: new Float32Array(this.mu),
      muLoss: new Float32Array(this.muLoss),
      muY: new Float32Array(this.muY),
      muLossY: new Float32Array(this.muLossY),
      material: new Uint8Array(this.material),
      modulatedMaterial: new Uint8Array(this.modulatedMaterial),
      nonlinearMaterial: new Uint8Array(this.nonlinearMaterial),
      dispersiveMaterial: new Uint8Array(this.dispersiveMaterial),
      dispersionAxes: new Uint8Array(this.dispersionAxes),
      dispersionAxisX: new Float32Array(this.dispersionAxisX),
      dispersionAxisY: new Float32Array(this.dispersionAxisY),
      electricTensorMaterial: new Uint8Array(this.electricTensorMaterial),
      epsilonXY: new Float32Array(this.epsilonXY),
      gyrotropicMaterial: new Uint8Array(this.gyrotropicMaterial),
      gyrotropyG: new Float32Array(this.gyrotropyG),
      bianisotropicMaterial: new Uint8Array(this.bianisotropicMaterial),
      bianisotropyKappa: new Float32Array(this.bianisotropyKappa),
      bianisotropyPrevScalar: new Float32Array(this.bianisotropyPrevScalar),
      bianisotropyPrevSplitX: new Float32Array(this.bianisotropyPrevSplitX),
      bianisotropyPrevSplitY: new Float32Array(this.bianisotropyPrevSplitY),
      bianisotropyPrevTx: new Float32Array(this.bianisotropyPrevTx),
      bianisotropyPrevTy: new Float32Array(this.bianisotropyPrevTy),
      dualEz: new Float32Array(this.dualEz),
      dualEzx: new Float32Array(this.dualEzx),
      dualEzy: new Float32Array(this.dualEzy),
      dualHx: new Float32Array(this.dualHx),
      dualHy: new Float32Array(this.dualHy),
      bianisotropyPrevDualEz: new Float32Array(this.bianisotropyPrevDualEz),
      bianisotropyPrevDualEzx: new Float32Array(this.bianisotropyPrevDualEzx),
      bianisotropyPrevDualEzy: new Float32Array(this.bianisotropyPrevDualEzy),
      bianisotropyPrevDualHx: new Float32Array(this.bianisotropyPrevDualHx),
      bianisotropyPrevDualHy: new Float32Array(this.bianisotropyPrevDualHy),
      phaseChangeMaterial: new Uint8Array(this.phaseChangeMaterial),
      phaseState: new Float32Array(this.phaseState),
      phaseEpsOff: new Float32Array(this.phaseEpsOff),
      phaseLossOff: new Float32Array(this.phaseLossOff),
      phaseEpsYOff: new Float32Array(this.phaseEpsYOff),
      phaseLossYOff: new Float32Array(this.phaseLossYOff),
      phaseEpsOn: new Float32Array(this.phaseEpsOn),
      phaseLossOn: new Float32Array(this.phaseLossOn),
      phaseEpsYOn: new Float32Array(this.phaseEpsYOn),
      phaseLossYOn: new Float32Array(this.phaseLossYOn),
      conductivity: new Float32Array(this.conductivity),
      conductivityY: new Float32Array(this.conductivityY),
      modulationBaseEps: new Float32Array(this.modulationBaseEps),
      modulationBaseEpsY: new Float32Array(this.modulationBaseEpsY),
      dispersionOmegaP: new Float32Array(this.dispersionOmegaP),
      dispersionGamma: new Float32Array(this.dispersionGamma),
      dispersionOmega0: new Float32Array(this.dispersionOmega0),
      dispersionDeltaEps: new Float32Array(this.dispersionDeltaEps),
      dispersionTau: new Float32Array(this.dispersionTau),
      muDispersiveMaterial: new Uint8Array(this.muDispersiveMaterial),
      muDispersionAxes: new Uint8Array(this.muDispersionAxes),
      muDispersionOmegaP: new Float32Array(this.muDispersionOmegaP),
      muDispersionGamma: new Float32Array(this.muDispersionGamma),
      muDispersionOmega0: new Float32Array(this.muDispersionOmega0),
      muDispersionDeltaMu: new Float32Array(this.muDispersionDeltaMu),
      muDispersionTau: new Float32Array(this.muDispersionTau),
      magDispMz: new Float32Array(this.magDispMz),
      magDispJz: new Float32Array(this.magDispJz),
      magDispMx: new Float32Array(this.magDispMx),
      magDispJx: new Float32Array(this.magDispJx),
      magDispMy: new Float32Array(this.magDispMy),
      magDispJy: new Float32Array(this.magDispJy),
      harmonicPrevPz: new Float32Array(this.harmonicPrevPz),
      harmonicPrevPx: new Float32Array(this.harmonicPrevPx),
      harmonicPrevPy: new Float32Array(this.harmonicPrevPy),
    };

    this.wasmBackend = backend;
    this.wasmBackend.configure(this);
    this.modulatedMaterial = new Uint8Array(this.n);
    this.dispersiveMaterial = new Uint8Array(this.n);
    this.dispersionAxes = new Uint8Array(this.n);
    this.dispersionAxisX = new Float32Array(this.n);
    this.dispersionAxisY = new Float32Array(this.n);
    this.bianisotropicMaterial = new Uint8Array(this.n);
    this.bianisotropyKappa = new Float32Array(this.n);
    this.bianisotropyPrevScalar = new Float32Array(this.n);
    this.bianisotropyPrevSplitX = new Float32Array(this.n);
    this.bianisotropyPrevSplitY = new Float32Array(this.n);
    this.bianisotropyPrevTx = new Float32Array(this.n);
    this.bianisotropyPrevTy = new Float32Array(this.n);
    this.dualEz = new Float32Array(this.n);
    this.dualEzx = new Float32Array(this.n);
    this.dualEzy = new Float32Array(this.n);
    this.dualHx = new Float32Array(this.n);
    this.dualHy = new Float32Array(this.n);
    this.bianisotropyPrevDualEz = new Float32Array(this.n);
    this.bianisotropyPrevDualEzx = new Float32Array(this.n);
    this.bianisotropyPrevDualEzy = new Float32Array(this.n);
    this.bianisotropyPrevDualHx = new Float32Array(this.n);
    this.bianisotropyPrevDualHy = new Float32Array(this.n);
    this.phaseChangeMaterial = new Uint8Array(this.n);
    this.phaseState = new Float32Array(this.n);
    this.phaseEpsOff = new Float32Array(this.n);
    this.phaseLossOff = new Float32Array(this.n);
    this.phaseEpsYOff = new Float32Array(this.n);
    this.phaseLossYOff = new Float32Array(this.n);
    this.phaseEpsOn = new Float32Array(this.n);
    this.phaseLossOn = new Float32Array(this.n);
    this.phaseEpsYOn = new Float32Array(this.n);
    this.phaseLossYOn = new Float32Array(this.n);
    this.dispersionOmegaP = new Float32Array(this.n);
    this.dispersionGamma = new Float32Array(this.n);
    this.dispersionOmega0 = new Float32Array(this.n);
    this.dispersionDeltaEps = new Float32Array(this.n);
    this.dispersionTau = new Float32Array(this.n);
    this.muDispersiveMaterial = new Uint8Array(this.n);
    this.muDispersionAxes = new Uint8Array(this.n);
    this.muDispersionOmegaP = new Float32Array(this.n);
    this.muDispersionGamma = new Float32Array(this.n);
    this.muDispersionOmega0 = new Float32Array(this.n);
    this.muDispersionDeltaMu = new Float32Array(this.n);
    this.muDispersionTau = new Float32Array(this.n);
    this.dispPz = new Float32Array(this.n);
    this.dispJz = new Float32Array(this.n);
    this.dispPx = new Float32Array(this.n);
    this.dispJx = new Float32Array(this.n);
    this.dispPy = new Float32Array(this.n);
    this.dispJy = new Float32Array(this.n);
    this.magDispMz = new Float32Array(this.n);
    this.magDispJz = new Float32Array(this.n);
    this.magDispMx = new Float32Array(this.n);
    this.magDispJx = new Float32Array(this.n);
    this.magDispMy = new Float32Array(this.n);
    this.magDispJy = new Float32Array(this.n);
    this.harmonicPrevPz = new Float32Array(this.n);
    this.harmonicPrevPx = new Float32Array(this.n);
    this.harmonicPrevPy = new Float32Array(this.n);
    this.ez.set(previous.ez);
    this.ezx.set(previous.ezx);
    this.ezy.set(previous.ezy);
    this.hx.set(previous.hx);
    this.hy.set(previous.hy);
    this.eps.set(previous.eps);
    this.loss.set(previous.loss);
    this.epsY.set(previous.epsY);
    this.lossY.set(previous.lossY);
    this.mu.set(previous.mu);
    this.muLoss.set(previous.muLoss);
    this.muY.set(previous.muY);
    this.muLossY.set(previous.muLossY);
    this.material.set(previous.material);
    this.modulatedMaterial.set(previous.modulatedMaterial);
    this.nonlinearMaterial.set(previous.nonlinearMaterial);
    this.dispersiveMaterial.set(previous.dispersiveMaterial);
    this.dispersionAxes.set(previous.dispersionAxes);
    this.dispersionAxisX.set(previous.dispersionAxisX);
    this.dispersionAxisY.set(previous.dispersionAxisY);
    this.electricTensorMaterial.set(previous.electricTensorMaterial);
    this.epsilonXY.set(previous.epsilonXY);
    this.gyrotropicMaterial.set(previous.gyrotropicMaterial);
    this.gyrotropyG.set(previous.gyrotropyG);
    this.bianisotropicMaterial.set(previous.bianisotropicMaterial);
    this.bianisotropyKappa.set(previous.bianisotropyKappa);
    this.bianisotropyPrevScalar.set(previous.bianisotropyPrevScalar);
    this.bianisotropyPrevSplitX.set(previous.bianisotropyPrevSplitX);
    this.bianisotropyPrevSplitY.set(previous.bianisotropyPrevSplitY);
    this.bianisotropyPrevTx.set(previous.bianisotropyPrevTx);
    this.bianisotropyPrevTy.set(previous.bianisotropyPrevTy);
    this.dualEz.set(previous.dualEz);
    this.dualEzx.set(previous.dualEzx);
    this.dualEzy.set(previous.dualEzy);
    this.dualHx.set(previous.dualHx);
    this.dualHy.set(previous.dualHy);
    this.bianisotropyPrevDualEz.set(previous.bianisotropyPrevDualEz);
    this.bianisotropyPrevDualEzx.set(previous.bianisotropyPrevDualEzx);
    this.bianisotropyPrevDualEzy.set(previous.bianisotropyPrevDualEzy);
    this.bianisotropyPrevDualHx.set(previous.bianisotropyPrevDualHx);
    this.bianisotropyPrevDualHy.set(previous.bianisotropyPrevDualHy);
    this.phaseChangeMaterial.set(previous.phaseChangeMaterial);
    this.phaseState.set(previous.phaseState);
    this.phaseEpsOff.set(previous.phaseEpsOff);
    this.phaseLossOff.set(previous.phaseLossOff);
    this.phaseEpsYOff.set(previous.phaseEpsYOff);
    this.phaseLossYOff.set(previous.phaseLossYOff);
    this.phaseEpsOn.set(previous.phaseEpsOn);
    this.phaseLossOn.set(previous.phaseLossOn);
    this.phaseEpsYOn.set(previous.phaseEpsYOn);
    this.phaseLossYOn.set(previous.phaseLossYOn);
    this.conductivity.set(previous.conductivity);
    this.conductivityY.set(previous.conductivityY);
    this.modulationBaseEps.set(previous.modulationBaseEps);
    this.modulationBaseEpsY.set(previous.modulationBaseEpsY);
    this.dispersionOmegaP.set(previous.dispersionOmegaP);
    this.dispersionGamma.set(previous.dispersionGamma);
    this.dispersionOmega0.set(previous.dispersionOmega0);
    this.dispersionDeltaEps.set(previous.dispersionDeltaEps);
    this.dispersionTau.set(previous.dispersionTau);
    this.muDispersiveMaterial.set(previous.muDispersiveMaterial);
    this.muDispersionAxes.set(previous.muDispersionAxes);
    this.muDispersionOmegaP.set(previous.muDispersionOmegaP);
    this.muDispersionGamma.set(previous.muDispersionGamma);
    this.muDispersionOmega0.set(previous.muDispersionOmega0);
    this.muDispersionDeltaMu.set(previous.muDispersionDeltaMu);
    this.muDispersionTau.set(previous.muDispersionTau);
    this.magDispMz.set(previous.magDispMz);
    this.magDispJz.set(previous.magDispJz);
    this.magDispMx.set(previous.magDispMx);
    this.magDispJx.set(previous.magDispJx);
    this.magDispMy.set(previous.magDispMy);
    this.magDispJy.set(previous.magDispJy);
    this.harmonicPrevPz.set(previous.harmonicPrevPz);
    this.harmonicPrevPx.set(previous.harmonicPrevPx);
    this.harmonicPrevPy.set(previous.harmonicPrevPy);
    this.buildBoundary(state.boundary);
    this.clearPmlMaterials();
    this.zeroBoundaryFields();
  }

  hasActiveMagneticDispersion() {
    if (!state.materialDispersionEnabled) return false;
    for (let i = 0; i < this.n; i += 1) {
      if (this.muDispersiveMaterial[i]) return true;
    }
    return false;
  }

  canUseCompiledKerrResponse() {
    return Boolean(
      state.materialNonlinearEnabled &&
        !state.materialModulationEnabled &&
        !state.materialPhaseChangeEnabled &&
        this.wasmBackend?.supportsKerr()
    );
  }

  canUseCompiledMaterialStep() {
    if (!this.wasmBackend?.canStep(state.fieldComponent)) return false;
    if (this.hasTfsfIncidentSource?.()) {
      if (!this.wasmBackend.supportsTfsf?.()) return false;
      if (!this.wasmBackend.canPackTfsfSources?.(this)) return false;
      if (state.materialDispersionEnabled) return false;
    }
    if (
      state.materialModulationEnabled ||
      state.materialHarmonicEnabled ||
      state.materialPhaseChangeEnabled ||
      state.materialBianisotropyEnabled
    ) {
      return false;
    }
    if (state.materialConductivityEnabled && !this.wasmBackend.supportsConductivity()) return false;
    if (state.materialNonlinearEnabled && !this.canUseCompiledKerrResponse()) return false;
    if (state.materialSaturableGainEnabled && !this.wasmBackend.supportsSaturableGain()) return false;
    if (state.materialGyrotropyEnabled) {
      if (state.fieldComponent !== "hz" || !this.wasmBackend.supportsTensorGyro()) return false;
    }
    if (state.materialDispersionEnabled) {
      if (state.fieldComponent !== "ez") return false;
      if (this.hasActiveMagneticDispersion()) return false;
    }
    return true;
  }

  compiledMaterialEngineLabel() {
    if (!this.canUseCompiledMaterialStep()) return "";
    const labels = [];
    if (state.materialConductivityEnabled) labels.push("sigma");
    if (state.materialNonlinearEnabled) labels.push("Kerr");
    if (state.materialSaturableGainEnabled) labels.push("gain");
    if (state.materialGyrotropyEnabled) labels.push("tensor");
    if (state.materialDispersionEnabled) labels.push("JS ADE");
    if (this.hasTfsfIncidentSource?.()) labels.push("TFSF");
    return labels.length > 0 ? `WASM ${labels.join("+")}` : "WASM";
  }

  engineLabel() {
    const compiledMaterialLabel = this.compiledMaterialEngineLabel();
    if (compiledMaterialLabel) return compiledMaterialLabel;
    if (
      state.materialModulationEnabled ||
      state.materialNonlinearEnabled ||
      state.materialHarmonicEnabled ||
      state.materialDispersionEnabled ||
      state.materialSaturableGainEnabled ||
      state.materialPhaseChangeEnabled ||
      state.materialGyrotropyEnabled ||
      state.materialBianisotropyEnabled
    ) {
      if (this.canUseCompiledFullVectorBianisotropy()) return "WASM+JS 6-field";
      if (this.fullVectorBianisotropyActive()) return "JS 6-field";
      if (state.materialBianisotropyEnabled) return "JS bianiso";
      if (state.materialGyrotropyEnabled) return "JS tensor";
      if (state.materialPhaseChangeEnabled) return "JS memory";
      if (this.hasTfsfIncidentSource?.()) return "JS TFSF+dynamic";
      return state.materialSaturableGainEnabled ? "JS gain" : "JS dynamic";
    }
    if (state.materialConductivityEnabled) {
      return this.wasmBackend?.canStep(state.fieldComponent) && this.wasmBackend.supportsConductivity()
        ? "WASM sigma"
        : "JS sigma";
    }
    if (this.hasTfsfIncidentSource?.()) {
      return this.wasmBackend?.canStep(state.fieldComponent) && this.wasmBackend.supportsTfsf?.() ? "WASM TFSF" : "JS TFSF";
    }
    return this.wasmBackend?.canStep(state.fieldComponent) ? "WASM" : "JS";
  }

  hasDynamicMaterialResponse() {
    return Boolean(
      state.materialModulationEnabled ||
        state.materialNonlinearEnabled ||
        state.materialHarmonicEnabled ||
        state.materialDispersionEnabled ||
        (state.materialConductivityEnabled && !this.wasmBackend?.supportsConductivity()) ||
        state.materialSaturableGainEnabled ||
        state.materialPhaseChangeEnabled ||
        state.materialGyrotropyEnabled ||
        state.materialBianisotropyEnabled
    );
  }

  id(x, y) {
    return x + y * this.nx;
  }

  fitCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx.imageSmoothingEnabled = false;
    }
  }

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
  }

  setFieldLog10Scale(value) {
    this.fieldLog10Scale = value;
    this.fieldScale = value < 300 ? Math.pow(10, value) : Infinity;
  }

  renormalizationArrays() {
    const arrays = [
      this.ez,
      this.ezx,
      this.ezy,
      this.hx,
      this.hy,
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
  }

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
  }
}
