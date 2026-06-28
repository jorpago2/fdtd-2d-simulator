"use strict";

Object.assign(FDTDSim.prototype, {
  step() {
    this.applyPhaseChangeResponse();
    const compiledMaterialStep = this.canUseCompiledMaterialStep();
    const compiledHandlesKerr = compiledMaterialStep && this.canUseCompiledKerrResponse();
    if (!compiledHandlesKerr) {
      this.applyDynamicMaterialResponse();
    }
    if (compiledMaterialStep) {
      this.wasmBackend.step(this);
      if (state.materialDispersionEnabled && state.fieldComponent === "ez") {
        this.applyDispersiveElectricResponse();
      }
      this.zeroBoundaryFields();
      this.injectSource();
      this.time += 1;
      if (!state.running) this.updateDiagnostics();
      return;
    }

    if (state.fieldComponent === "hz") {
      if (this.canUseCompiledFullVectorBianisotropy()) {
        this.wasmBackend.stepComponent(this, "hz");
      } else {
        this.stepHzMode();
      }
      this.stepDualTmMode();
    } else {
      this.stepEzMode();
      this.applyDispersiveElectricResponse();
    }
    this.applyHarmonicNonlinearResponse();
    this.applyBianisotropicResponse();

    this.zeroBoundaryFields();
    this.injectSource();
    this.time += 1;
    if (!state.running) this.updateDiagnostics();
  },

  stepEzMode() {
    const nx = this.nx;
    const ny = this.ny;
    const s = this.courant;
    const ez = this.ez;
    const ezx = this.ezx;
    const ezy = this.ezy;
    const hx = this.hx;
    const hy = this.hy;
    const eps = this.eps;
    const loss = this.loss;
    const epsY = this.epsY;
    const lossY = this.lossY;
    const conductivity = this.conductivity;
    const conductivityY = this.conductivityY;
    const mu = this.mu;
    const muLoss = this.muLoss;
    const muY = this.muY;
    const muLossY = this.muLossY;
    const eCaX = this.eCaX;
    const eCbX = this.eCbX;
    const eCaY = this.eCaY;
    const eCbY = this.eCbY;
    const hCaX = this.hCaX;
    const hCbX = this.hCbX;
    const hCaY = this.hCaY;
    const hCbY = this.hCbY;

    for (let y = 0; y < ny - 1; y += 1) {
      const row = y * nx;
      const ca = hCaY[y];
      const cb = hCbY[y];
      for (let x = 0; x < nx; x += 1) {
        const i = row + x;
        const magneticDecay = 1 / (1 + muLoss[i]);
        const magneticScale = s / mu[i];
        hx[i] = (ca * hx[i] - cb * magneticScale * (ez[i + nx] - ez[i])) * magneticDecay;
      }
    }

    for (let y = 0; y < ny; y += 1) {
      const row = y * nx;
      for (let x = 0; x < nx - 1; x += 1) {
        const i = row + x;
        const magneticDecay = 1 / (1 + muLossY[i]);
        const magneticScale = s / muY[i];
        hy[i] = (hCaX[x] * hy[i] + hCbX[x] * magneticScale * (ez[i + 1] - ez[i])) * magneticDecay;
      }
    }

    this.applyDispersiveMagneticResponse("ez");

    for (let y = 1; y < ny - 1; y += 1) {
      const row = y * nx;
      for (let x = 1; x < nx - 1; x += 1) {
        const i = row + x;
        if (this.material[i] === 2) {
          this.zeroElectricCell(i);
          continue;
        }
        const dHyDx = hy[i] - hy[i - 1];
        const dHxDy = hx[i] - hx[i - nx];
        const decayX = this.electricLossDecay(loss[i], i);
        const decayY = this.electricLossDecay(lossY[i], i);
        const materialScaleX = s / eps[i];
        const materialScaleY = s / epsY[i];
        const sigmaDampX = this.conductivityDamp(conductivity[i], eps[i]);
        const sigmaDampY = this.conductivityDamp(conductivityY[i], epsY[i]);
        const sigmaCaX = (1 - sigmaDampX) / (1 + sigmaDampX);
        const sigmaCaY = (1 - sigmaDampY) / (1 + sigmaDampY);
        const sigmaCbX = 1 / (1 + sigmaDampX);
        const sigmaCbY = 1 / (1 + sigmaDampY);
        ezx[i] = (sigmaCaX * eCaX[x] * ezx[i] + sigmaCbX * eCbX[x] * materialScaleX * dHyDx) * decayX;
        ezy[i] = (sigmaCaY * eCaY[y] * ezy[i] - sigmaCbY * eCbY[y] * materialScaleY * dHxDy) * decayY;
        ez[i] = ezx[i] + ezy[i];
      }
    }
  },

  stepHzMode() {
    const nx = this.nx;
    const ny = this.ny;
    const s = this.courant;
    const hz = this.ez;
    const hzx = this.ezx;
    const hzy = this.ezy;
    const ex = this.hx;
    const ey = this.hy;
    const eps = this.eps;
    const loss = this.loss;
    const epsY = this.epsY;
    const lossY = this.lossY;
    const conductivity = this.conductivity;
    const conductivityY = this.conductivityY;
    const electricTensorMaterial = this.electricTensorMaterial;
    const epsilonXY = this.epsilonXY;
    const gyrotropicMaterial = this.gyrotropicMaterial;
    const gyrotropyG = this.gyrotropyG;
    const mu = this.mu;
    const muLoss = this.muLoss;
    const muY = this.muY;
    const muLossY = this.muLossY;
    const eCaX = this.eCaX;
    const eCbX = this.eCbX;
    const eCaY = this.eCaY;
    const eCbY = this.eCbY;
    const hCaX = this.hCaX;
    const hCbX = this.hCbX;
    const hCaY = this.hCaY;
    const hCbY = this.hCbY;

    for (let y = 0; y < ny - 1; y += 1) {
      const row = y * nx;
      const ca = eCaY[y];
      const cb = eCbY[y];
      for (let x = 0; x < nx; x += 1) {
        const i = row + x;
        if (this.material[i] === 2) {
          ex[i] = 0;
          continue;
        }
        if (gyrotropicMaterial[i] || electricTensorMaterial[i]) continue;
        const electricDecay = this.electricLossDecay(loss[i], i);
        const electricScale = s / eps[i];
        const sigmaDamp = this.conductivityDamp(conductivity[i], eps[i]);
        const sigmaCa = (1 - sigmaDamp) / (1 + sigmaDamp);
        const sigmaCb = 1 / (1 + sigmaDamp);
        ex[i] = (sigmaCa * ca * ex[i] + sigmaCb * cb * electricScale * (hz[i + nx] - hz[i])) * electricDecay;
      }
    }

    for (let y = 0; y < ny; y += 1) {
      const row = y * nx;
      for (let x = 0; x < nx - 1; x += 1) {
        const i = row + x;
        if (this.material[i] === 2) {
          ey[i] = 0;
          continue;
        }
        if (gyrotropicMaterial[i] || electricTensorMaterial[i]) continue;
        const electricDecay = this.electricLossDecay(lossY[i], i);
        const electricScale = s / epsY[i];
        const sigmaDamp = this.conductivityDamp(conductivityY[i], epsY[i]);
        const sigmaCa = (1 - sigmaDamp) / (1 + sigmaDamp);
        const sigmaCb = 1 / (1 + sigmaDamp);
        ey[i] = (sigmaCa * eCaX[x] * ey[i] - sigmaCb * eCbX[x] * electricScale * (hz[i + 1] - hz[i])) * electricDecay;
      }
    }

    for (let y = 0; y < ny - 1; y += 1) {
      const row = y * nx;
      const caX = eCaY[y];
      const cbX = eCbY[y];
      for (let x = 0; x < nx - 1; x += 1) {
        const i = row + x;
        if (!gyrotropicMaterial[i] && !electricTensorMaterial[i]) continue;
        if (this.material[i] === 2) {
          ex[i] = 0;
          ey[i] = 0;
          continue;
        }
        const epsX = eps[i];
        const epsYi = epsY[i];
        const g = gyrotropyG[i];
        const k = epsilonXY[i] || 0;
        const upperOffDiagonal = k + g;
        const lowerOffDiagonal = k - g;
        const det = epsX * epsYi - upperOffDiagonal * lowerOffDiagonal;
        const safeDet = Math.abs(det) < 1e-6 ? (det < 0 ? -1e-6 : 1e-6) : det;
        const sigmaDampX = this.conductivityDamp(conductivity[i], epsX);
        const sigmaDampY = this.conductivityDamp(conductivityY[i], epsYi);
        const sigmaCaX = (1 - sigmaDampX) / (1 + sigmaDampX);
        const sigmaCaY = (1 - sigmaDampY) / (1 + sigmaDampY);
        const sigmaCbX = 1 / (1 + sigmaDampX);
        const sigmaCbY = 1 / (1 + sigmaDampY);
        const sourceX = sigmaCbX * cbX * s * (hz[i + nx] - hz[i]);
        const sourceY = -sigmaCbY * eCbX[x] * s * (hz[i + 1] - hz[i]);
        const coupledX = (epsYi * sourceX - upperOffDiagonal * sourceY) / safeDet;
        const coupledY = (-lowerOffDiagonal * sourceX + epsX * sourceY) / safeDet;
        const decayX = this.electricLossDecay(loss[i], i);
        const decayY = this.electricLossDecay(lossY[i], i);
        ex[i] = (sigmaCaX * caX * ex[i] + coupledX) * decayX;
        ey[i] = (sigmaCaY * eCaX[x] * ey[i] + coupledY) * decayY;
      }
    }

    this.applyDispersiveElectricResponse();

    for (let y = 1; y < ny - 1; y += 1) {
      const row = y * nx;
      for (let x = 1; x < nx - 1; x += 1) {
        const i = row + x;
        if (this.material[i] === 2) {
          this.zeroElectricCell(i);
          ex[i] = 0;
          ey[i] = 0;
          continue;
        }
        const dEyDx = ey[i] - ey[i - 1];
        const dExDy = ex[i] - ex[i - nx];
        const decayX = 1 / (1 + muLoss[i]);
        const decayY = 1 / (1 + muLossY[i]);
        const materialScaleX = s / mu[i];
        const materialScaleY = s / muY[i];
        hzx[i] = (hCaX[x] * hzx[i] - hCbX[x] * materialScaleX * dEyDx) * decayX;
        hzy[i] = (hCaY[y] * hzy[i] + hCbY[y] * materialScaleY * dExDy) * decayY;
        hz[i] = hzx[i] + hzy[i];
      }
    }

    this.applyDispersiveMagneticResponse("hz");
  }
});
