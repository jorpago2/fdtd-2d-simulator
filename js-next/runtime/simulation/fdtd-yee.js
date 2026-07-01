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
      this.applyTfsfScalarCorrections();
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

    for (let y = 0; y < ny - 1; y += 1) {
      const row = y * nx;
      for (let x = 0; x < nx; x += 1) {
        const i = row + x;
        const dEzDy = this.cpmlDerivativeY(ez[i + nx] - ez[i], this.cpmlPsiHxY, i, y, false);
        const magneticDecay = this.magneticLossDecay(muLoss[i]);
        const magneticScale = s / this.safeMaterialDenominator(mu[i]);
        hx[i] = (hx[i] - magneticScale * dEzDy) * magneticDecay;
      }
    }

    for (let y = 0; y < ny; y += 1) {
      const row = y * nx;
      for (let x = 0; x < nx - 1; x += 1) {
        const i = row + x;
        const dEzDx = this.cpmlDerivativeX(ez[i + 1] - ez[i], this.cpmlPsiHyX, i, x, false);
        const magneticDecay = this.magneticLossDecay(muLossY[i]);
        const magneticScale = s / this.safeMaterialDenominator(muY[i]);
        hy[i] = (hy[i] + magneticScale * dEzDx) * magneticDecay;
      }
    }

    this.applyDispersiveMagneticResponse("ez");
    this.applyTfsfTransverseCorrections();

    for (let y = 1; y < ny - 1; y += 1) {
      const row = y * nx;
      for (let x = 1; x < nx - 1; x += 1) {
        const i = row + x;
        if (this.material[i] === 2) {
          this.zeroElectricCell(i);
          continue;
        }
        const dHyDx = this.cpmlDerivativeX(hy[i] - hy[i - 1], this.cpmlPsiEzX, i, x, true);
        const dHxDy = this.cpmlDerivativeY(hx[i] - hx[i - nx], this.cpmlPsiEzY, i, y, true);
        const decayX = this.electricLossDecay(loss[i], i);
        const decayY = this.electricLossDecay(lossY[i], i);
        const materialScaleX = s / this.safeMaterialDenominator(eps[i]);
        const materialScaleY = s / this.safeMaterialDenominator(epsY[i]);
        const sigmaDampX = this.conductivityDamp(conductivity[i], eps[i]);
        const sigmaDampY = this.conductivityDamp(conductivityY[i], epsY[i]);
        const sigmaCaX = (1 - sigmaDampX) / (1 + sigmaDampX);
        const sigmaCaY = (1 - sigmaDampY) / (1 + sigmaDampY);
        const sigmaCbX = 1 / (1 + sigmaDampX);
        const sigmaCbY = 1 / (1 + sigmaDampY);
        ezx[i] = (sigmaCaX * ezx[i] + sigmaCbX * materialScaleX * dHyDx) * decayX;
        ezy[i] = (sigmaCaY * ezy[i] - sigmaCbY * materialScaleY * dHxDy) * decayY;
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

    for (let y = 0; y < ny - 1; y += 1) {
      const row = y * nx;
      for (let x = 0; x < nx; x += 1) {
        const i = row + x;
        if (this.material[i] === 2) {
          ex[i] = 0;
          continue;
        }
        if (gyrotropicMaterial[i] || electricTensorMaterial[i]) continue;
        const dHzDy = this.cpmlDerivativeY(hz[i + nx] - hz[i], this.cpmlPsiExY, i, y, true);
        const electricDecay = this.electricLossDecay(loss[i], i);
        const electricScale = s / this.safeMaterialDenominator(eps[i]);
        const sigmaDamp = this.conductivityDamp(conductivity[i], eps[i]);
        const sigmaCa = (1 - sigmaDamp) / (1 + sigmaDamp);
        const sigmaCb = 1 / (1 + sigmaDamp);
        ex[i] = (sigmaCa * ex[i] + sigmaCb * electricScale * dHzDy) * electricDecay;
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
        const dHzDx = this.cpmlDerivativeX(hz[i + 1] - hz[i], this.cpmlPsiEyX, i, x, true);
        const electricDecay = this.electricLossDecay(lossY[i], i);
        const electricScale = s / this.safeMaterialDenominator(epsY[i]);
        const sigmaDamp = this.conductivityDamp(conductivityY[i], epsY[i]);
        const sigmaCa = (1 - sigmaDamp) / (1 + sigmaDamp);
        const sigmaCb = 1 / (1 + sigmaDamp);
        ey[i] = (sigmaCa * ey[i] - sigmaCb * electricScale * dHzDx) * electricDecay;
      }
    }

    for (let y = 0; y < ny - 1; y += 1) {
      const row = y * nx;
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
        const dHzDy = this.cpmlDerivativeY(hz[i + nx] - hz[i], this.cpmlPsiExY, i, y, true);
        const dHzDx = this.cpmlDerivativeX(hz[i + 1] - hz[i], this.cpmlPsiEyX, i, x, true);
        const sourceX = sigmaCbX * s * dHzDy;
        const sourceY = -sigmaCbY * s * dHzDx;
        const coupledX = (epsYi * sourceX - upperOffDiagonal * sourceY) / safeDet;
        const coupledY = (-lowerOffDiagonal * sourceX + epsX * sourceY) / safeDet;
        const decayX = this.electricLossDecay(loss[i], i);
        const decayY = this.electricLossDecay(lossY[i], i);
        ex[i] = (sigmaCaX * ex[i] + coupledX) * decayX;
        ey[i] = (sigmaCaY * ey[i] + coupledY) * decayY;
      }
    }

    this.applyDispersiveElectricResponse();
    this.applyTfsfTransverseCorrections();

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
        const dEyDx = this.cpmlDerivativeX(ey[i] - ey[i - 1], this.cpmlPsiHzX, i, x, false);
        const dExDy = this.cpmlDerivativeY(ex[i] - ex[i - nx], this.cpmlPsiHzY, i, y, false);
        const decayX = this.magneticLossDecay(muLoss[i]);
        const decayY = this.magneticLossDecay(muLossY[i]);
        const materialScaleX = s / this.safeMaterialDenominator(mu[i]);
        const materialScaleY = s / this.safeMaterialDenominator(muY[i]);
        hzx[i] = (hzx[i] - materialScaleX * dEyDx) * decayX;
        hzy[i] = (hzy[i] + materialScaleY * dExDy) * decayY;
        hz[i] = hzx[i] + hzy[i];
      }
    }

    this.applyDispersiveMagneticResponse("hz");
    this.applyTfsfScalarCorrections();
  }
});
