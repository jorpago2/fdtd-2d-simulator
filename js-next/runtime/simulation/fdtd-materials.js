"use strict";

Object.assign(FDTDSim.prototype, {
clearMaterials(resetFields = true) {
  this.material.fill(0);
  this.eps.fill(1);
  this.loss.fill(0);
  this.epsY.fill(1);
  this.lossY.fill(0);
  this.mu.fill(1);
  this.muLoss.fill(0);
  this.muY.fill(1);
  this.muLossY.fill(0);
  this.modulatedMaterial.fill(0);
  this.modulationPhaseOffset.fill(0);
  this.nonlinearMaterial.fill(0);
  this.dispersiveMaterial.fill(0);
  this.dispersionAxes.fill(0);
  this.dispersionAxisX.fill(1);
  this.dispersionAxisY.fill(0);
  this.electricTensorMaterial.fill(0);
  this.epsilonXY.fill(0);
  this.gyrotropicMaterial.fill(0);
  this.gyrotropyG.fill(0);
  this.bianisotropicMaterial.fill(0);
  this.bianisotropyKappa.fill(0);
  this.bianisotropyPrevScalar.fill(0);
  this.bianisotropyPrevSplitX.fill(0);
  this.bianisotropyPrevSplitY.fill(0);
  this.bianisotropyPrevTx.fill(0);
  this.bianisotropyPrevTy.fill(0);
  this.dualEz.fill(0);
  this.dualEzx.fill(0);
  this.dualEzy.fill(0);
  this.dualHx.fill(0);
  this.dualHy.fill(0);
  this.bianisotropyPrevDualEz.fill(0);
  this.bianisotropyPrevDualEzx.fill(0);
  this.bianisotropyPrevDualEzy.fill(0);
  this.bianisotropyPrevDualHx.fill(0);
  this.bianisotropyPrevDualHy.fill(0);
  this.phaseChangeMaterial.fill(0);
  this.phaseState.fill(0);
  this.phaseEpsOff.fill(1);
  this.phaseLossOff.fill(0);
  this.phaseEpsYOff.fill(1);
  this.phaseLossYOff.fill(0);
  this.phaseEpsOn.fill(1);
  this.phaseLossOn.fill(0);
  this.phaseEpsYOn.fill(1);
  this.phaseLossYOn.fill(0);
  this.conductivity.fill(0);
  this.conductivityY.fill(0);
  this.modulationBaseEps.fill(1);
  this.modulationBaseEpsY.fill(1);
  this.dispersionOmegaP.fill(0);
  this.dispersionGamma.fill(0);
  this.dispersionOmega0.fill(0);
  this.dispersionDeltaEps.fill(0);
  this.dispersionTau.fill(1);
  this.muDispersiveMaterial.fill(0);
  this.muDispersionAxes.fill(0);
  this.muDispersionOmegaP.fill(0);
  this.muDispersionGamma.fill(0);
  this.muDispersionOmega0.fill(0);
  this.muDispersionDeltaMu.fill(0);
  this.muDispersionTau.fill(1);
  this.dispPz.fill(0);
  this.dispJz.fill(0);
  this.dispPx.fill(0);
  this.dispJx.fill(0);
  this.dispPy.fill(0);
  this.dispJy.fill(0);
  this.magDispMz.fill(0);
  this.magDispJz.fill(0);
  this.magDispMx.fill(0);
  this.magDispJx.fill(0);
  this.magDispMy.fill(0);
  this.magDispJy.fill(0);
  this.dualEz.fill(0);
  this.dualEzx.fill(0);
  this.dualEzy.fill(0);
  this.dualHx.fill(0);
  this.dualHy.fill(0);
  this.bianisotropyPrevDualEz.fill(0);
  this.bianisotropyPrevDualEzx.fill(0);
  this.bianisotropyPrevDualEzy.fill(0);
  this.bianisotropyPrevDualHx.fill(0);
  this.bianisotropyPrevDualHy.fill(0);
  this.harmonicPrevPz.fill(0);
  this.harmonicPrevPx.fill(0);
  this.harmonicPrevPy.fill(0);
  this.refreshCpmlMaterialContinuation(false);
  if (resetFields) {
    this.resetFields();
  }
},

copyMaterialCellByIndex(targetIdx, sourceIdx) {
  this.material[targetIdx] = this.material[sourceIdx];
  this.eps[targetIdx] = this.eps[sourceIdx];
  this.loss[targetIdx] = this.loss[sourceIdx];
  this.epsY[targetIdx] = this.epsY[sourceIdx];
  this.lossY[targetIdx] = this.lossY[sourceIdx];
  this.mu[targetIdx] = this.mu[sourceIdx];
  this.muLoss[targetIdx] = this.muLoss[sourceIdx];
  this.muY[targetIdx] = this.muY[sourceIdx];
  this.muLossY[targetIdx] = this.muLossY[sourceIdx];
  this.modulatedMaterial[targetIdx] = this.modulatedMaterial[sourceIdx];
  this.modulationPhaseOffset[targetIdx] = this.modulationPhaseOffset[sourceIdx];
  this.nonlinearMaterial[targetIdx] = this.nonlinearMaterial[sourceIdx];
  this.dispersiveMaterial[targetIdx] = this.dispersiveMaterial[sourceIdx];
  this.dispersionAxes[targetIdx] = this.dispersionAxes[sourceIdx];
  this.dispersionAxisX[targetIdx] = this.dispersionAxisX[sourceIdx];
  this.dispersionAxisY[targetIdx] = this.dispersionAxisY[sourceIdx];
  this.electricTensorMaterial[targetIdx] = this.electricTensorMaterial[sourceIdx];
  this.epsilonXY[targetIdx] = this.epsilonXY[sourceIdx];
  this.gyrotropicMaterial[targetIdx] = this.gyrotropicMaterial[sourceIdx];
  this.gyrotropyG[targetIdx] = this.gyrotropyG[sourceIdx];
  this.bianisotropicMaterial[targetIdx] = this.bianisotropicMaterial[sourceIdx];
  this.bianisotropyKappa[targetIdx] = this.bianisotropyKappa[sourceIdx];
  this.bianisotropyPrevScalar[targetIdx] = this.bianisotropyPrevScalar[sourceIdx];
  this.bianisotropyPrevSplitX[targetIdx] = this.bianisotropyPrevSplitX[sourceIdx];
  this.bianisotropyPrevSplitY[targetIdx] = this.bianisotropyPrevSplitY[sourceIdx];
  this.bianisotropyPrevTx[targetIdx] = this.bianisotropyPrevTx[sourceIdx];
  this.bianisotropyPrevTy[targetIdx] = this.bianisotropyPrevTy[sourceIdx];
  this.dualEz[targetIdx] = this.dualEz[sourceIdx];
  this.dualEzx[targetIdx] = this.dualEzx[sourceIdx];
  this.dualEzy[targetIdx] = this.dualEzy[sourceIdx];
  this.dualHx[targetIdx] = this.dualHx[sourceIdx];
  this.dualHy[targetIdx] = this.dualHy[sourceIdx];
  this.bianisotropyPrevDualEz[targetIdx] = this.bianisotropyPrevDualEz[sourceIdx];
  this.bianisotropyPrevDualEzx[targetIdx] = this.bianisotropyPrevDualEzx[sourceIdx];
  this.bianisotropyPrevDualEzy[targetIdx] = this.bianisotropyPrevDualEzy[sourceIdx];
  this.bianisotropyPrevDualHx[targetIdx] = this.bianisotropyPrevDualHx[sourceIdx];
  this.bianisotropyPrevDualHy[targetIdx] = this.bianisotropyPrevDualHy[sourceIdx];
  this.phaseChangeMaterial[targetIdx] = this.phaseChangeMaterial[sourceIdx];
  this.phaseState[targetIdx] = this.phaseState[sourceIdx];
  this.phaseEpsOff[targetIdx] = this.phaseEpsOff[sourceIdx];
  this.phaseLossOff[targetIdx] = this.phaseLossOff[sourceIdx];
  this.phaseEpsYOff[targetIdx] = this.phaseEpsYOff[sourceIdx];
  this.phaseLossYOff[targetIdx] = this.phaseLossYOff[sourceIdx];
  this.phaseEpsOn[targetIdx] = this.phaseEpsOn[sourceIdx];
  this.phaseLossOn[targetIdx] = this.phaseLossOn[sourceIdx];
  this.phaseEpsYOn[targetIdx] = this.phaseEpsYOn[sourceIdx];
  this.phaseLossYOn[targetIdx] = this.phaseLossYOn[sourceIdx];
  this.conductivity[targetIdx] = this.conductivity[sourceIdx];
  this.conductivityY[targetIdx] = this.conductivityY[sourceIdx];
  this.modulationBaseEps[targetIdx] = this.modulationBaseEps[sourceIdx];
  this.modulationBaseEpsY[targetIdx] = this.modulationBaseEpsY[sourceIdx];
  this.dispersionOmegaP[targetIdx] = this.dispersionOmegaP[sourceIdx];
  this.dispersionGamma[targetIdx] = this.dispersionGamma[sourceIdx];
  this.dispersionOmega0[targetIdx] = this.dispersionOmega0[sourceIdx];
  this.dispersionDeltaEps[targetIdx] = this.dispersionDeltaEps[sourceIdx];
  this.dispersionTau[targetIdx] = this.dispersionTau[sourceIdx];
  this.muDispersiveMaterial[targetIdx] = this.muDispersiveMaterial[sourceIdx];
  this.muDispersionAxes[targetIdx] = this.muDispersionAxes[sourceIdx];
  this.muDispersionOmegaP[targetIdx] = this.muDispersionOmegaP[sourceIdx];
  this.muDispersionGamma[targetIdx] = this.muDispersionGamma[sourceIdx];
  this.muDispersionOmega0[targetIdx] = this.muDispersionOmega0[sourceIdx];
  this.muDispersionDeltaMu[targetIdx] = this.muDispersionDeltaMu[sourceIdx];
  this.muDispersionTau[targetIdx] = this.muDispersionTau[sourceIdx];
  this.dispPz[targetIdx] = this.dispPz[sourceIdx];
  this.dispJz[targetIdx] = this.dispJz[sourceIdx];
  this.dispPx[targetIdx] = this.dispPx[sourceIdx];
  this.dispJx[targetIdx] = this.dispJx[sourceIdx];
  this.dispPy[targetIdx] = this.dispPy[sourceIdx];
  this.dispJy[targetIdx] = this.dispJy[sourceIdx];
  this.magDispMz[targetIdx] = this.magDispMz[sourceIdx];
  this.magDispJz[targetIdx] = this.magDispJz[sourceIdx];
  this.magDispMx[targetIdx] = this.magDispMx[sourceIdx];
  this.magDispJx[targetIdx] = this.magDispJx[sourceIdx];
  this.magDispMy[targetIdx] = this.magDispMy[sourceIdx];
  this.magDispJy[targetIdx] = this.magDispJy[sourceIdx];
  this.harmonicPrevPz[targetIdx] = this.harmonicPrevPz[sourceIdx];
  this.harmonicPrevPx[targetIdx] = this.harmonicPrevPx[sourceIdx];
  this.harmonicPrevPy[targetIdx] = this.harmonicPrevPy[sourceIdx];
},

copyPassiveCpmlMaterialCellByIndex(targetIdx, sourceIdx) {
  this.material[targetIdx] = this.material[sourceIdx];
  this.eps[targetIdx] = this.eps[sourceIdx];
  this.epsY[targetIdx] = this.epsY[sourceIdx];
  this.mu[targetIdx] = this.mu[sourceIdx];
  this.muY[targetIdx] = this.muY[sourceIdx];
  this.loss[targetIdx] = Math.max(0, Number(this.loss[sourceIdx]) || 0);
  this.lossY[targetIdx] = Math.max(0, Number(this.lossY[sourceIdx]) || 0);
  this.muLoss[targetIdx] = Math.max(0, Number(this.muLoss[sourceIdx]) || 0);
  this.muLossY[targetIdx] = Math.max(0, Number(this.muLossY[sourceIdx]) || 0);
  this.conductivity[targetIdx] = Math.max(0, Number(this.conductivity[sourceIdx]) || 0);
  this.conductivityY[targetIdx] = Math.max(0, Number(this.conductivityY[sourceIdx]) || 0);

  this.modulatedMaterial[targetIdx] = 0;
  this.modulationPhaseOffset[targetIdx] = 0;
  this.nonlinearMaterial[targetIdx] = 0;
  this.dispersiveMaterial[targetIdx] = 0;
  this.dispersionAxes[targetIdx] = 0;
  this.dispersionAxisX[targetIdx] = 1;
  this.dispersionAxisY[targetIdx] = 0;
  this.electricTensorMaterial[targetIdx] = 0;
  this.epsilonXY[targetIdx] = 0;
  this.gyrotropicMaterial[targetIdx] = 0;
  this.gyrotropyG[targetIdx] = 0;
  this.bianisotropicMaterial[targetIdx] = 0;
  this.bianisotropyKappa[targetIdx] = 0;
  this.phaseChangeMaterial[targetIdx] = 0;
  this.phaseState[targetIdx] = 0;
  this.phaseEpsOff[targetIdx] = this.eps[targetIdx];
  this.phaseLossOff[targetIdx] = this.loss[targetIdx];
  this.phaseEpsYOff[targetIdx] = this.epsY[targetIdx];
  this.phaseLossYOff[targetIdx] = this.lossY[targetIdx];
  this.phaseEpsOn[targetIdx] = this.eps[targetIdx];
  this.phaseLossOn[targetIdx] = this.loss[targetIdx];
  this.phaseEpsYOn[targetIdx] = this.epsY[targetIdx];
  this.phaseLossYOn[targetIdx] = this.lossY[targetIdx];
  this.modulationBaseEps[targetIdx] = this.eps[targetIdx];
  this.modulationBaseEpsY[targetIdx] = this.epsY[targetIdx];
  this.dispersionOmegaP[targetIdx] = 0;
  this.dispersionGamma[targetIdx] = 0;
  this.dispersionOmega0[targetIdx] = 0;
  this.dispersionDeltaEps[targetIdx] = 0;
  this.dispersionTau[targetIdx] = 1;
  this.muDispersiveMaterial[targetIdx] = 0;
  this.muDispersionAxes[targetIdx] = 0;
  this.muDispersionOmegaP[targetIdx] = 0;
  this.muDispersionGamma[targetIdx] = 0;
  this.muDispersionOmega0[targetIdx] = 0;
  this.muDispersionDeltaMu[targetIdx] = 0;
  this.muDispersionTau[targetIdx] = 1;
  this.dispPz[targetIdx] = 0;
  this.dispJz[targetIdx] = 0;
  this.dispPx[targetIdx] = 0;
  this.dispJx[targetIdx] = 0;
  this.dispPy[targetIdx] = 0;
  this.dispJy[targetIdx] = 0;
  this.magDispMz[targetIdx] = 0;
  this.magDispJz[targetIdx] = 0;
  this.magDispMx[targetIdx] = 0;
  this.magDispJx[targetIdx] = 0;
  this.magDispMy[targetIdx] = 0;
  this.magDispJy[targetIdx] = 0;
  this.bianisotropyPrevScalar[targetIdx] = 0;
  this.bianisotropyPrevSplitX[targetIdx] = 0;
  this.bianisotropyPrevSplitY[targetIdx] = 0;
  this.bianisotropyPrevTx[targetIdx] = 0;
  this.bianisotropyPrevTy[targetIdx] = 0;
  this.dualEz[targetIdx] = 0;
  this.dualEzx[targetIdx] = 0;
  this.dualEzy[targetIdx] = 0;
  this.dualHx[targetIdx] = 0;
  this.dualHy[targetIdx] = 0;
  this.bianisotropyPrevDualEz[targetIdx] = 0;
  this.bianisotropyPrevDualEzx[targetIdx] = 0;
  this.bianisotropyPrevDualEzy[targetIdx] = 0;
  this.bianisotropyPrevDualHx[targetIdx] = 0;
  this.bianisotropyPrevDualHy[targetIdx] = 0;
  this.harmonicPrevPz[targetIdx] = 0;
  this.harmonicPrevPx[targetIdx] = 0;
  this.harmonicPrevPy[targetIdx] = 0;
},

setCellModulation(idx, enabled, baseEps = this.eps[idx], baseEpsY = this.epsY[idx], phaseOffsetRad = 0) {
  this.modulatedMaterial[idx] = enabled ? 1 : 0;
  this.modulationBaseEps[idx] = Number.isFinite(baseEps) ? baseEps : this.eps[idx];
  this.modulationBaseEpsY[idx] = Number.isFinite(baseEpsY) ? baseEpsY : this.epsY[idx];
  this.modulationPhaseOffset[idx] = enabled && Number.isFinite(phaseOffsetRad) ? phaseOffsetRad : 0;
},

setCellNonlinearity(idx, enabled, baseEps = this.eps[idx], baseEpsY = this.epsY[idx]) {
  this.nonlinearMaterial[idx] = enabled ? 1 : 0;
  this.modulationBaseEps[idx] = Number.isFinite(baseEps) ? baseEps : this.eps[idx];
  this.modulationBaseEpsY[idx] = Number.isFinite(baseEpsY) ? baseEpsY : this.epsY[idx];
  if (!enabled) {
    this.harmonicPrevPz[idx] = 0;
    this.harmonicPrevPx[idx] = 0;
    this.harmonicPrevPy[idx] = 0;
  }
},

setCellDispersion(idx, params = null) {
  this.materialTensorDiagnosticsCache = null;
  const model = params?.dispersion || "none";
  const kind = model === "drude" || model === "plasma" ? 1 : model === "lorentz" ? 2 : model === "debye" ? 3 : 0;
  this.dispersiveMaterial[idx] = kind;
  this.dispersionAxes[idx] = kind ? dispersionAxesMask(params?.dispersionAxes ?? params?.axes, 3) : 0;
  let axisX = Number(params?.dispersionAxisX);
  let axisY = Number(params?.dispersionAxisY);
  if (!Number.isFinite(axisX) || !Number.isFinite(axisY)) {
    const angleDeg = Number(params?.dispersionAxisAngleDeg);
    const angleRad = Number.isFinite(angleDeg) ? (angleDeg * Math.PI) / 180 : Number(params?.dispersionAxisAngleRad) || 0;
    axisX = Math.cos(angleRad);
    axisY = Math.sin(angleRad);
  }
  const axisNorm = Math.hypot(axisX, axisY);
  this.dispersionAxisX[idx] = kind && axisNorm > 1e-9 ? axisX / axisNorm : 1;
  this.dispersionAxisY[idx] = kind && axisNorm > 1e-9 ? axisY / axisNorm : 0;
  this.dispersionOmegaP[idx] = kind ? Math.max(0, Number(params.omegaP) || 0) : 0;
  this.dispersionGamma[idx] = kind ? Math.max(0, Number(params.gamma) || 0) : 0;
  this.dispersionOmega0[idx] = kind ? Math.max(0, Number(params.omega0) || 0) : 0;
  this.dispersionDeltaEps[idx] = kind ? Number(params.deltaEps) || 0 : 0;
  this.dispersionTau[idx] = kind ? Math.max(1, Number(params.tau) || 1) : 1;
  this.dispPz[idx] = 0;
  this.dispJz[idx] = 0;
  this.dispPx[idx] = 0;
  this.dispJx[idx] = 0;
  this.dispPy[idx] = 0;
  this.dispJy[idx] = 0;
},

setCellMagneticDispersion(idx, params = null) {
  this.materialTensorDiagnosticsCache = null;
  const model = params?.muDispersion || params?.magneticDispersion || "none";
  const kind = model === "drude" || model === "plasma" ? 1 : model === "lorentz" ? 2 : model === "debye" ? 3 : 0;
  this.muDispersiveMaterial[idx] = kind;
  this.muDispersionAxes[idx] = kind ? dispersionAxesMask(params?.muDispersionAxes ?? params?.magneticAxes, 3) : 0;
  this.muDispersionOmegaP[idx] = kind ? Math.max(0, Number(params.muOmegaP ?? params.magneticOmegaP) || 0) : 0;
  this.muDispersionGamma[idx] = kind ? Math.max(0, Number(params.muGamma ?? params.magneticGamma) || 0) : 0;
  this.muDispersionOmega0[idx] = kind ? Math.max(0, Number(params.muOmega0 ?? params.magneticOmega0) || 0) : 0;
  this.muDispersionDeltaMu[idx] = kind ? Number(params.deltaMu ?? params.magneticDeltaMu) || 0 : 0;
  this.muDispersionTau[idx] = kind ? Math.max(1, Number(params.muTau ?? params.magneticTau) || 1) : 1;
  this.magDispMz[idx] = 0;
  this.magDispJz[idx] = 0;
  this.magDispMx[idx] = 0;
  this.magDispJx[idx] = 0;
  this.magDispMy[idx] = 0;
  this.magDispJy[idx] = 0;
},

setCellConductivity(idx, sigma = 0, sigmaY = sigma) {
  this.conductivity[idx] = Math.max(0, Number(sigma) || 0);
  this.conductivityY[idx] = Math.max(0, Number(sigmaY) || 0);
},

setCellGyrotropy(idx, value = 0) {
  this.materialTensorDiagnosticsCache = null;
  const g = clamp(Number(value) || 0, -5, 5);
  this.gyrotropicMaterial[idx] = g === 0 ? 0 : 1;
  this.gyrotropyG[idx] = g;
},

setCellElectricTensor(idx, epsilonXY = 0) {
  this.materialTensorDiagnosticsCache = null;
  const value = clamp(Number(epsilonXY) || 0, -30, 30);
  this.electricTensorMaterial[idx] = Math.abs(value) > 1e-12 ? 1 : 0;
  this.epsilonXY[idx] = value;
},

setCellBianisotropy(idx, value = 0) {
  const kappa = normalizeBianisotropyKappa(value);
  this.bianisotropicMaterial[idx] = kappa === 0 ? 0 : 1;
  this.bianisotropyKappa[idx] = kappa;
  this.bianisotropyPrevScalar[idx] = this.ez[idx] || 0;
  this.bianisotropyPrevSplitX[idx] = this.ezx[idx] || 0;
  this.bianisotropyPrevSplitY[idx] = this.ezy[idx] || 0;
  this.bianisotropyPrevTx[idx] = this.hx[idx] || 0;
  this.bianisotropyPrevTy[idx] = this.hy[idx] || 0;
},

setCellPhaseChange(idx, params = null) {
  const enabled = Boolean(params?.phaseChange);
  this.phaseChangeMaterial[idx] = enabled ? 1 : 0;
  if (!enabled) {
    this.phaseState[idx] = 0;
    this.phaseEpsOff[idx] = this.eps[idx];
    this.phaseLossOff[idx] = this.loss[idx];
    this.phaseEpsYOff[idx] = this.epsY[idx];
    this.phaseLossYOff[idx] = this.lossY[idx];
    this.phaseEpsOn[idx] = this.eps[idx];
    this.phaseLossOn[idx] = this.loss[idx];
    this.phaseEpsYOn[idx] = this.epsY[idx];
    this.phaseLossYOn[idx] = this.lossY[idx];
    return;
  }
  const offEps = Number.isFinite(params.phaseEpsOff) ? params.phaseEpsOff : this.eps[idx];
  const offLoss = Number.isFinite(params.phaseLossOff) ? params.phaseLossOff : this.loss[idx];
  const offEpsY = Number.isFinite(params.phaseEpsYOff) ? params.phaseEpsYOff : this.epsY[idx];
  const offLossY = Number.isFinite(params.phaseLossYOff) ? params.phaseLossYOff : this.lossY[idx];
  const onEps = Number.isFinite(params.phaseEpsOn) ? params.phaseEpsOn : state.phaseEpsOn;
  const onLoss = Number.isFinite(params.phaseLossOn) ? params.phaseLossOn : state.phaseLossOn;
  this.phaseState[idx] = clamp(Number(params.phaseState) || 0, 0, 1);
  this.phaseEpsOff[idx] = offEps;
  this.phaseLossOff[idx] = offLoss;
  this.phaseEpsYOff[idx] = offEpsY;
  this.phaseLossYOff[idx] = offLossY;
  this.phaseEpsOn[idx] = onEps;
  this.phaseLossOn[idx] = onLoss;
  this.phaseEpsYOn[idx] = Number.isFinite(params.phaseEpsYOn) ? params.phaseEpsYOn : onEps;
  this.phaseLossYOn[idx] = Number.isFinite(params.phaseLossYOn) ? params.phaseLossYOn : onLoss;
},

setMaterial(x, y, kind) {
  if (x < 1 || y < 1 || x >= this.nx - 1 || y >= this.ny - 1) return;
  if (this.isInBoundaryControlRegion(x, y)) return;
  const idx = this.id(x, y);
  if (kind === "dielectric") {
    this.material[idx] = 1;
    this.eps[idx] = 4.2;
    this.loss[idx] = 0.001;
    this.epsY[idx] = 4.2;
    this.lossY[idx] = 0.001;
    this.mu[idx] = 1;
    this.muLoss[idx] = 0;
    this.muY[idx] = 1;
    this.muLossY[idx] = 0;
    this.setCellModulation(idx, false);
    this.setCellNonlinearity(idx, false);
    this.setCellDispersion(idx, null);
    this.setCellMagneticDispersion(idx, null);
    this.setCellConductivity(idx, 0, 0);
    this.setCellGyrotropy(idx, 0);
    this.setCellElectricTensor(idx, 0);
    this.setCellBianisotropy(idx, 0);
    this.setCellPhaseChange(idx, null);
  } else if (kind === "pec") {
    this.material[idx] = 2;
    this.eps[idx] = 1;
    this.loss[idx] = 0;
    this.epsY[idx] = 1;
    this.lossY[idx] = 0;
    this.mu[idx] = 1;
    this.muLoss[idx] = 0;
    this.muY[idx] = 1;
    this.muLossY[idx] = 0;
    this.setCellModulation(idx, false);
    this.setCellNonlinearity(idx, false);
    this.setCellDispersion(idx, null);
    this.setCellMagneticDispersion(idx, null);
    this.setCellConductivity(idx, 0, 0);
    this.setCellGyrotropy(idx, 0);
    this.setCellElectricTensor(idx, 0);
    this.setCellBianisotropy(idx, 0);
    this.setCellPhaseChange(idx, null);
    this.zeroElectricCell(idx);
    this.zeroDualFieldCell(idx);
  } else if (kind === "lossy") {
    this.material[idx] = 3;
    this.eps[idx] = 2.6;
    this.loss[idx] = 0.028;
    this.epsY[idx] = 2.6;
    this.lossY[idx] = 0.028;
    this.mu[idx] = 1;
    this.muLoss[idx] = 0;
    this.muY[idx] = 1;
    this.muLossY[idx] = 0;
    this.setCellModulation(idx, false);
    this.setCellNonlinearity(idx, false);
    this.setCellDispersion(idx, null);
    this.setCellMagneticDispersion(idx, null);
    this.setCellConductivity(idx, 0, 0);
    this.setCellGyrotropy(idx, 0);
    this.setCellElectricTensor(idx, 0);
    this.setCellBianisotropy(idx, 0);
    this.setCellPhaseChange(idx, null);
  } else if (kind === "custom") {
    this.material[idx] = 4;
    this.eps[idx] = state.customEpsReal;
    this.loss[idx] = state.customEpsImag;
    this.epsY[idx] = state.customAnisotropic ? state.customEpsYReal : state.customEpsReal;
    this.lossY[idx] = state.customAnisotropic ? state.customEpsYImag : state.customEpsImag;
    this.mu[idx] = state.customMuReal;
    this.muLoss[idx] = state.customMuImag;
    this.muY[idx] = state.customAnisotropic ? state.customMuYReal : state.customMuReal;
    this.muLossY[idx] = state.customAnisotropic ? state.customMuYImag : state.customMuImag;
    this.setCellModulation(idx, state.materialModulationEnabled, this.eps[idx], this.epsY[idx]);
    this.setCellNonlinearity(idx, state.materialNonlinearEnabled || state.materialHarmonicEnabled, this.eps[idx], this.epsY[idx]);
    this.setCellDispersion(idx, brushDispersionParams());
    this.setCellMagneticDispersion(idx, null);
    const conductivity = brushConductivityParams();
    this.setCellConductivity(idx, conductivity.sigma, conductivity.sigmaY);
    this.setCellGyrotropy(idx, brushGyrotropyValue());
    this.setCellElectricTensor(idx, 0);
    this.setCellBianisotropy(idx, brushBianisotropyValue());
    this.setCellPhaseChange(idx, brushPhaseChangeParams());
  } else if (kind === "sio2") {
    this.material[idx] = 5;
    this.eps[idx] = 2.07;
    this.loss[idx] = 0;
    this.epsY[idx] = 2.07;
    this.lossY[idx] = 0;
    this.mu[idx] = 1;
    this.muLoss[idx] = 0;
    this.muY[idx] = 1;
    this.muLossY[idx] = 0;
    this.setCellModulation(idx, false);
    this.setCellNonlinearity(idx, false);
    this.setCellDispersion(idx, null);
    this.setCellMagneticDispersion(idx, null);
    this.setCellConductivity(idx, 0, 0);
    this.setCellGyrotropy(idx, 0);
    this.setCellElectricTensor(idx, 0);
    this.setCellBianisotropy(idx, 0);
    this.setCellPhaseChange(idx, null);
  } else {
    this.material[idx] = 0;
    this.eps[idx] = 1;
    this.loss[idx] = 0;
    this.epsY[idx] = 1;
    this.lossY[idx] = 0;
    this.mu[idx] = 1;
    this.muLoss[idx] = 0;
    this.muY[idx] = 1;
    this.muLossY[idx] = 0;
    this.setCellModulation(idx, false);
    this.setCellNonlinearity(idx, false);
    this.setCellDispersion(idx, null);
    this.setCellMagneticDispersion(idx, null);
    this.setCellConductivity(idx, 0, 0);
    this.setCellGyrotropy(idx, 0);
    this.setCellElectricTensor(idx, 0);
    this.setCellBianisotropy(idx, 0);
    this.setCellPhaseChange(idx, null);
  }
},

snapshotMaterialCell(x, y) {
  const idx = this.id(x, y);
  return {
    x,
    y,
    material: this.material[idx],
    eps: this.eps[idx],
    loss: this.loss[idx],
    epsY: this.epsY[idx],
    lossY: this.lossY[idx],
    mu: this.mu[idx],
    muLoss: this.muLoss[idx],
    muY: this.muY[idx],
    muLossY: this.muLossY[idx],
    modulated: this.modulatedMaterial[idx],
    modulationPhaseOffset: this.modulationPhaseOffset[idx],
    nonlinear: this.nonlinearMaterial[idx],
    dispersive: this.dispersiveMaterial[idx],
    dispersionAxes: this.dispersionAxes[idx],
    dispersionAxisX: this.dispersionAxisX[idx],
    dispersionAxisY: this.dispersionAxisY[idx],
    electricTensor: this.electricTensorMaterial[idx],
    epsilonXY: this.epsilonXY[idx],
    gyrotropic: this.gyrotropicMaterial[idx],
    gyrotropyG: this.gyrotropyG[idx],
    bianisotropic: this.bianisotropicMaterial[idx],
    bianisotropyKappa: this.bianisotropyKappa[idx],
    bianisotropyPrevScalar: this.bianisotropyPrevScalar[idx],
    bianisotropyPrevSplitX: this.bianisotropyPrevSplitX[idx],
    bianisotropyPrevSplitY: this.bianisotropyPrevSplitY[idx],
    bianisotropyPrevTx: this.bianisotropyPrevTx[idx],
    bianisotropyPrevTy: this.bianisotropyPrevTy[idx],
    phaseChange: this.phaseChangeMaterial[idx],
    phaseState: this.phaseState[idx],
    phaseEpsOff: this.phaseEpsOff[idx],
    phaseLossOff: this.phaseLossOff[idx],
    phaseEpsYOff: this.phaseEpsYOff[idx],
    phaseLossYOff: this.phaseLossYOff[idx],
    phaseEpsOn: this.phaseEpsOn[idx],
    phaseLossOn: this.phaseLossOn[idx],
    phaseEpsYOn: this.phaseEpsYOn[idx],
    phaseLossYOn: this.phaseLossYOn[idx],
    conductivity: this.conductivity[idx],
    conductivityY: this.conductivityY[idx],
    modulationBaseEps: this.modulationBaseEps[idx],
    modulationBaseEpsY: this.modulationBaseEpsY[idx],
    dispersionOmegaP: this.dispersionOmegaP[idx],
    dispersionGamma: this.dispersionGamma[idx],
    dispersionOmega0: this.dispersionOmega0[idx],
    dispersionDeltaEps: this.dispersionDeltaEps[idx],
    dispersionTau: this.dispersionTau[idx],
    muDispersive: this.muDispersiveMaterial[idx],
    muDispersionAxes: this.muDispersionAxes[idx],
    muDispersionOmegaP: this.muDispersionOmegaP[idx],
    muDispersionGamma: this.muDispersionGamma[idx],
    muDispersionOmega0: this.muDispersionOmega0[idx],
    muDispersionDeltaMu: this.muDispersionDeltaMu[idx],
    muDispersionTau: this.muDispersionTau[idx],
  };
},

writeMaterialCell(x, y, cell) {
  if (x < 1 || y < 1 || x >= this.nx - 1 || y >= this.ny - 1) return false;
  if (this.isInBoundaryControlRegion(x, y)) return false;
  const idx = this.id(x, y);
  this.material[idx] = cell.material;
  this.eps[idx] = cell.eps;
  this.loss[idx] = cell.loss;
  this.epsY[idx] = cell.epsY;
  this.lossY[idx] = cell.lossY;
  this.mu[idx] = cell.mu;
  this.muLoss[idx] = cell.muLoss;
  this.muY[idx] = cell.muY;
  this.muLossY[idx] = cell.muLossY;
  this.modulatedMaterial[idx] = cell.modulated ? 1 : 0;
  this.modulationPhaseOffset[idx] = cell.modulated && Number.isFinite(cell.modulationPhaseOffset) ? cell.modulationPhaseOffset : 0;
  this.nonlinearMaterial[idx] = cell.nonlinear ? 1 : 0;
  this.dispersiveMaterial[idx] = cell.dispersive || 0;
  this.dispersionAxes[idx] = this.dispersiveMaterial[idx] ? dispersionAxesMask(cell.dispersionAxes, 3) : 0;
  this.dispersionAxisX[idx] = Number.isFinite(cell.dispersionAxisX) ? cell.dispersionAxisX : 1;
  this.dispersionAxisY[idx] = Number.isFinite(cell.dispersionAxisY) ? cell.dispersionAxisY : 0;
  this.muDispersiveMaterial[idx] = cell.muDispersive || 0;
  this.muDispersionAxes[idx] = this.muDispersiveMaterial[idx] ? dispersionAxesMask(cell.muDispersionAxes, 3) : 0;
  this.muDispersionOmegaP[idx] = Number.isFinite(cell.muDispersionOmegaP) ? cell.muDispersionOmegaP : 0;
  this.muDispersionGamma[idx] = Number.isFinite(cell.muDispersionGamma) ? cell.muDispersionGamma : 0;
  this.muDispersionOmega0[idx] = Number.isFinite(cell.muDispersionOmega0) ? cell.muDispersionOmega0 : 0;
  this.muDispersionDeltaMu[idx] = Number.isFinite(cell.muDispersionDeltaMu) ? cell.muDispersionDeltaMu : 0;
  this.muDispersionTau[idx] = Number.isFinite(cell.muDispersionTau) ? cell.muDispersionTau : 1;
  this.electricTensorMaterial[idx] = cell.electricTensor ? 1 : 0;
  this.epsilonXY[idx] = clamp(Number(cell.epsilonXY) || 0, -30, 30);
  this.gyrotropicMaterial[idx] = cell.gyrotropic ? 1 : 0;
  this.gyrotropyG[idx] = clamp(Number(cell.gyrotropyG) || 0, -5, 5);
  this.bianisotropicMaterial[idx] = cell.bianisotropic ? 1 : 0;
  this.bianisotropyKappa[idx] = normalizeBianisotropyKappa(cell.bianisotropyKappa);
  this.bianisotropyPrevScalar[idx] = Number.isFinite(cell.bianisotropyPrevScalar) ? cell.bianisotropyPrevScalar : this.ez[idx];
  this.bianisotropyPrevSplitX[idx] = Number.isFinite(cell.bianisotropyPrevSplitX) ? cell.bianisotropyPrevSplitX : this.ezx[idx];
  this.bianisotropyPrevSplitY[idx] = Number.isFinite(cell.bianisotropyPrevSplitY) ? cell.bianisotropyPrevSplitY : this.ezy[idx];
  this.bianisotropyPrevTx[idx] = Number.isFinite(cell.bianisotropyPrevTx) ? cell.bianisotropyPrevTx : this.hx[idx];
  this.bianisotropyPrevTy[idx] = Number.isFinite(cell.bianisotropyPrevTy) ? cell.bianisotropyPrevTy : this.hy[idx];
  this.phaseChangeMaterial[idx] = cell.phaseChange ? 1 : 0;
  this.phaseState[idx] = clamp(Number(cell.phaseState) || 0, 0, 1);
  this.phaseEpsOff[idx] = Number.isFinite(cell.phaseEpsOff) ? cell.phaseEpsOff : cell.eps;
  this.phaseLossOff[idx] = Number.isFinite(cell.phaseLossOff) ? cell.phaseLossOff : cell.loss;
  this.phaseEpsYOff[idx] = Number.isFinite(cell.phaseEpsYOff) ? cell.phaseEpsYOff : cell.epsY;
  this.phaseLossYOff[idx] = Number.isFinite(cell.phaseLossYOff) ? cell.phaseLossYOff : cell.lossY;
  this.phaseEpsOn[idx] = Number.isFinite(cell.phaseEpsOn) ? cell.phaseEpsOn : cell.eps;
  this.phaseLossOn[idx] = Number.isFinite(cell.phaseLossOn) ? cell.phaseLossOn : cell.loss;
  this.phaseEpsYOn[idx] = Number.isFinite(cell.phaseEpsYOn) ? cell.phaseEpsYOn : this.phaseEpsOn[idx];
  this.phaseLossYOn[idx] = Number.isFinite(cell.phaseLossYOn) ? cell.phaseLossYOn : this.phaseLossOn[idx];
  this.conductivity[idx] = Math.max(0, Number(cell.conductivity) || 0);
  this.conductivityY[idx] = Math.max(0, Number(cell.conductivityY) || 0);
  this.modulationBaseEps[idx] = Number.isFinite(cell.modulationBaseEps) ? cell.modulationBaseEps : cell.eps;
  this.modulationBaseEpsY[idx] = Number.isFinite(cell.modulationBaseEpsY) ? cell.modulationBaseEpsY : cell.epsY;
  this.dispersionOmegaP[idx] = Number.isFinite(cell.dispersionOmegaP) ? cell.dispersionOmegaP : 0;
  this.dispersionGamma[idx] = Number.isFinite(cell.dispersionGamma) ? cell.dispersionGamma : 0;
  this.dispersionOmega0[idx] = Number.isFinite(cell.dispersionOmega0) ? cell.dispersionOmega0 : 0;
  this.dispersionDeltaEps[idx] = Number.isFinite(cell.dispersionDeltaEps) ? cell.dispersionDeltaEps : 0;
  this.dispersionTau[idx] = Number.isFinite(cell.dispersionTau) ? cell.dispersionTau : 1;
  this.dispPz[idx] = 0;
  this.dispJz[idx] = 0;
  this.dispPx[idx] = 0;
  this.dispJx[idx] = 0;
  this.dispPy[idx] = 0;
  this.dispJy[idx] = 0;
  this.magDispMz[idx] = 0;
  this.magDispJz[idx] = 0;
  this.magDispMx[idx] = 0;
  this.magDispJx[idx] = 0;
  this.magDispMy[idx] = 0;
  this.magDispJy[idx] = 0;
  this.dualEz[idx] = 0;
  this.dualEzx[idx] = 0;
  this.dualEzy[idx] = 0;
  this.dualHx[idx] = 0;
  this.dualHy[idx] = 0;
  this.bianisotropyPrevDualEz[idx] = 0;
  this.bianisotropyPrevDualEzx[idx] = 0;
  this.bianisotropyPrevDualEzy[idx] = 0;
  this.bianisotropyPrevDualHx[idx] = 0;
  this.bianisotropyPrevDualHy[idx] = 0;
  this.harmonicPrevPz[idx] = 0;
  this.harmonicPrevPx[idx] = 0;
  this.harmonicPrevPy[idx] = 0;
  if (cell.material === 2) {
    this.zeroElectricCell(idx);
    this.zeroDualFieldCell(idx);
  }
  return true;
},

writeAirCellAtIndex(idx) {
  this.material[idx] = 0;
  this.eps[idx] = 1;
  this.loss[idx] = 0;
  this.epsY[idx] = 1;
  this.lossY[idx] = 0;
  this.mu[idx] = 1;
  this.muLoss[idx] = 0;
  this.muY[idx] = 1;
  this.muLossY[idx] = 0;
  this.modulatedMaterial[idx] = 0;
  this.modulationPhaseOffset[idx] = 0;
  this.nonlinearMaterial[idx] = 0;
  this.dispersiveMaterial[idx] = 0;
  this.dispersionAxes[idx] = 0;
  this.dispersionAxisX[idx] = 1;
  this.dispersionAxisY[idx] = 0;
  this.muDispersiveMaterial[idx] = 0;
  this.muDispersionAxes[idx] = 0;
  this.muDispersionOmegaP[idx] = 0;
  this.muDispersionGamma[idx] = 0;
  this.muDispersionOmega0[idx] = 0;
  this.muDispersionDeltaMu[idx] = 0;
  this.muDispersionTau[idx] = 1;
  this.electricTensorMaterial[idx] = 0;
  this.epsilonXY[idx] = 0;
  this.gyrotropicMaterial[idx] = 0;
  this.gyrotropyG[idx] = 0;
  this.bianisotropicMaterial[idx] = 0;
  this.bianisotropyKappa[idx] = 0;
  this.bianisotropyPrevScalar[idx] = 0;
  this.bianisotropyPrevSplitX[idx] = 0;
  this.bianisotropyPrevSplitY[idx] = 0;
  this.bianisotropyPrevTx[idx] = 0;
  this.bianisotropyPrevTy[idx] = 0;
  this.phaseChangeMaterial[idx] = 0;
  this.phaseState[idx] = 0;
  this.phaseEpsOff[idx] = 1;
  this.phaseLossOff[idx] = 0;
  this.phaseEpsYOff[idx] = 1;
  this.phaseLossYOff[idx] = 0;
  this.phaseEpsOn[idx] = 1;
  this.phaseLossOn[idx] = 0;
  this.phaseEpsYOn[idx] = 1;
  this.phaseLossYOn[idx] = 0;
  this.conductivity[idx] = 0;
  this.conductivityY[idx] = 0;
  this.modulationBaseEps[idx] = 1;
  this.modulationBaseEpsY[idx] = 1;
  this.dispersionOmegaP[idx] = 0;
  this.dispersionGamma[idx] = 0;
  this.dispersionOmega0[idx] = 0;
  this.dispersionDeltaEps[idx] = 0;
  this.dispersionTau[idx] = 1;
  this.dispPz[idx] = 0;
  this.dispJz[idx] = 0;
  this.dispPx[idx] = 0;
  this.dispJx[idx] = 0;
  this.dispPy[idx] = 0;
  this.dispJy[idx] = 0;
  this.magDispMz[idx] = 0;
  this.magDispJz[idx] = 0;
  this.magDispMx[idx] = 0;
  this.magDispJx[idx] = 0;
  this.magDispMy[idx] = 0;
  this.magDispJy[idx] = 0;
  this.dualEz[idx] = 0;
  this.dualEzx[idx] = 0;
  this.dualEzy[idx] = 0;
  this.dualHx[idx] = 0;
  this.dualHy[idx] = 0;
  this.bianisotropyPrevDualEz[idx] = 0;
  this.bianisotropyPrevDualEzx[idx] = 0;
  this.bianisotropyPrevDualEzy[idx] = 0;
  this.bianisotropyPrevDualHx[idx] = 0;
  this.bianisotropyPrevDualHy[idx] = 0;
  this.harmonicPrevPz[idx] = 0;
  this.harmonicPrevPx[idx] = 0;
  this.harmonicPrevPy[idx] = 0;
},

selectableMaterialAt(x, y) {
  if (x < 1 || y < 1 || x >= this.nx - 1 || y >= this.ny - 1) return false;
  if (this.isInBoundaryControlRegion(x, y)) return false;
  return this.material[this.id(x, y)] !== 0;
},

materialRegionBounds(cells) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const cell of cells) {
    if (cell.x < minX) minX = cell.x;
    if (cell.y < minY) minY = cell.y;
    if (cell.x > maxX) maxX = cell.x;
    if (cell.y > maxY) maxY = cell.y;
  }
  return { minX, minY, maxX, maxY };
},

findMaterialRegionAtCell(startX, startY) {
  if (!this.selectableMaterialAt(startX, startY)) return null;
  const visited = new Uint8Array(this.n);
  const stack = [this.id(startX, startY)];
  visited[this.id(startX, startY)] = 1;
  const cells = [];
  const pushNeighbor = (x, y) => {
    if (!this.selectableMaterialAt(x, y)) return;
    const idx = this.id(x, y);
    if (visited[idx]) return;
    visited[idx] = 1;
    stack.push(idx);
  };

  while (stack.length > 0) {
    const idx = stack.pop();
    const x = idx % this.nx;
    const y = Math.floor(idx / this.nx);
    cells.push(this.snapshotMaterialCell(x, y));
    pushNeighbor(x + 1, y);
    pushNeighbor(x - 1, y);
    pushNeighbor(x, y + 1);
    pushNeighbor(x, y - 1);
  }

  return {
    cells,
    bounds: this.materialRegionBounds(cells),
  };
},

findMaterialRegionAtClientPoint(clientX, clientY) {
  const point = this.clientToGridCell(clientX, clientY);
  return this.findMaterialRegionAtCell(point.x, point.y);
},

snapshotMaterialArrays() {
  return {
    material: new Uint8Array(this.material),
    eps: new Float32Array(this.eps),
    loss: new Float32Array(this.loss),
    epsY: new Float32Array(this.epsY),
    lossY: new Float32Array(this.lossY),
    mu: new Float32Array(this.mu),
    muLoss: new Float32Array(this.muLoss),
    muY: new Float32Array(this.muY),
    muLossY: new Float32Array(this.muLossY),
    modulatedMaterial: new Uint8Array(this.modulatedMaterial),
    modulationPhaseOffset: new Float32Array(this.modulationPhaseOffset),
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
  };
},

restoreMaterialArrays(snapshot) {
  this.material.set(snapshot.material);
  this.eps.set(snapshot.eps);
  this.loss.set(snapshot.loss);
  this.epsY.set(snapshot.epsY);
  this.lossY.set(snapshot.lossY);
  this.mu.set(snapshot.mu);
  this.muLoss.set(snapshot.muLoss);
  this.muY.set(snapshot.muY);
  this.muLossY.set(snapshot.muLossY);
  this.modulatedMaterial.set(snapshot.modulatedMaterial);
  if (snapshot.modulationPhaseOffset) this.modulationPhaseOffset.set(snapshot.modulationPhaseOffset);
  else this.modulationPhaseOffset.fill(0);
  this.nonlinearMaterial.set(snapshot.nonlinearMaterial);
  this.dispersiveMaterial.set(snapshot.dispersiveMaterial);
  this.dispersionAxes.set(snapshot.dispersionAxes);
  this.dispersionAxisX.set(snapshot.dispersionAxisX);
  this.dispersionAxisY.set(snapshot.dispersionAxisY);
  this.electricTensorMaterial.set(snapshot.electricTensorMaterial);
  this.epsilonXY.set(snapshot.epsilonXY);
  this.gyrotropicMaterial.set(snapshot.gyrotropicMaterial);
  this.gyrotropyG.set(snapshot.gyrotropyG);
  this.bianisotropicMaterial.set(snapshot.bianisotropicMaterial);
  this.bianisotropyKappa.set(snapshot.bianisotropyKappa);
  this.bianisotropyPrevScalar.set(snapshot.bianisotropyPrevScalar);
  this.bianisotropyPrevSplitX.set(snapshot.bianisotropyPrevSplitX);
  this.bianisotropyPrevSplitY.set(snapshot.bianisotropyPrevSplitY);
  this.bianisotropyPrevTx.set(snapshot.bianisotropyPrevTx);
  this.bianisotropyPrevTy.set(snapshot.bianisotropyPrevTy);
  this.phaseChangeMaterial.set(snapshot.phaseChangeMaterial);
  this.phaseState.set(snapshot.phaseState);
  this.phaseEpsOff.set(snapshot.phaseEpsOff);
  this.phaseLossOff.set(snapshot.phaseLossOff);
  this.phaseEpsYOff.set(snapshot.phaseEpsYOff);
  this.phaseLossYOff.set(snapshot.phaseLossYOff);
  this.phaseEpsOn.set(snapshot.phaseEpsOn);
  this.phaseLossOn.set(snapshot.phaseLossOn);
  this.phaseEpsYOn.set(snapshot.phaseEpsYOn);
  this.phaseLossYOn.set(snapshot.phaseLossYOn);
  this.conductivity.set(snapshot.conductivity);
  this.conductivityY.set(snapshot.conductivityY);
  this.modulationBaseEps.set(snapshot.modulationBaseEps);
  this.modulationBaseEpsY.set(snapshot.modulationBaseEpsY);
  this.dispersionOmegaP.set(snapshot.dispersionOmegaP);
  this.dispersionGamma.set(snapshot.dispersionGamma);
  this.dispersionOmega0.set(snapshot.dispersionOmega0);
  this.dispersionDeltaEps.set(snapshot.dispersionDeltaEps);
  this.dispersionTau.set(snapshot.dispersionTau);
  this.muDispersiveMaterial.set(snapshot.muDispersiveMaterial);
  this.muDispersionAxes.set(snapshot.muDispersionAxes);
  this.muDispersionOmegaP.set(snapshot.muDispersionOmegaP);
  this.muDispersionGamma.set(snapshot.muDispersionGamma);
  this.muDispersionOmega0.set(snapshot.muDispersionOmega0);
  this.muDispersionDeltaMu.set(snapshot.muDispersionDeltaMu);
  this.muDispersionTau.set(snapshot.muDispersionTau);
},

snapshotMaterialArraysWithoutRegion(region) {
  const snapshot = this.snapshotMaterialArrays();
  for (const cell of region.cells) {
    const idx = this.id(cell.x, cell.y);
    snapshot.material[idx] = 0;
    snapshot.eps[idx] = 1;
    snapshot.loss[idx] = 0;
    snapshot.epsY[idx] = 1;
    snapshot.lossY[idx] = 0;
    snapshot.mu[idx] = 1;
    snapshot.muLoss[idx] = 0;
    snapshot.muY[idx] = 1;
    snapshot.muLossY[idx] = 0;
    snapshot.modulatedMaterial[idx] = 0;
    snapshot.modulationPhaseOffset[idx] = 0;
    snapshot.nonlinearMaterial[idx] = 0;
    snapshot.dispersiveMaterial[idx] = 0;
    snapshot.dispersionAxes[idx] = 0;
    snapshot.dispersionAxisX[idx] = 1;
    snapshot.dispersionAxisY[idx] = 0;
    snapshot.muDispersiveMaterial[idx] = 0;
    snapshot.muDispersionAxes[idx] = 0;
    snapshot.muDispersionOmegaP[idx] = 0;
    snapshot.muDispersionGamma[idx] = 0;
    snapshot.muDispersionOmega0[idx] = 0;
    snapshot.muDispersionDeltaMu[idx] = 0;
    snapshot.muDispersionTau[idx] = 1;
    snapshot.electricTensorMaterial[idx] = 0;
    snapshot.epsilonXY[idx] = 0;
    snapshot.gyrotropicMaterial[idx] = 0;
    snapshot.gyrotropyG[idx] = 0;
    snapshot.bianisotropicMaterial[idx] = 0;
    snapshot.bianisotropyKappa[idx] = 0;
    snapshot.bianisotropyPrevScalar[idx] = 0;
    snapshot.bianisotropyPrevSplitX[idx] = 0;
    snapshot.bianisotropyPrevSplitY[idx] = 0;
    snapshot.bianisotropyPrevTx[idx] = 0;
    snapshot.bianisotropyPrevTy[idx] = 0;
    snapshot.phaseChangeMaterial[idx] = 0;
    snapshot.phaseState[idx] = 0;
    snapshot.phaseEpsOff[idx] = 1;
    snapshot.phaseLossOff[idx] = 0;
    snapshot.phaseEpsYOff[idx] = 1;
    snapshot.phaseLossYOff[idx] = 0;
    snapshot.phaseEpsOn[idx] = 1;
    snapshot.phaseLossOn[idx] = 0;
    snapshot.phaseEpsYOn[idx] = 1;
    snapshot.phaseLossYOn[idx] = 0;
    snapshot.conductivity[idx] = 0;
    snapshot.conductivityY[idx] = 0;
    snapshot.modulationBaseEps[idx] = 1;
    snapshot.modulationBaseEpsY[idx] = 1;
    snapshot.dispersionOmegaP[idx] = 0;
    snapshot.dispersionGamma[idx] = 0;
    snapshot.dispersionOmega0[idx] = 0;
    snapshot.dispersionDeltaEps[idx] = 0;
    snapshot.dispersionTau[idx] = 1;
  }
  return snapshot;
},

clampMaterialRegionOffset(region, dx, dy) {
  const minDx = this.activeInteriorMinX() - region.bounds.minX;
  const maxDx = this.activeInteriorMaxX() - region.bounds.maxX;
  const minDy = this.activeInteriorMinY() - region.bounds.minY;
  const maxDy = this.activeInteriorMaxY() - region.bounds.maxY;
  return {
    dx: clampInt(dx, minDx, maxDx),
    dy: clampInt(dy, minDy, maxDy),
  };
},

shiftedMaterialRegion(region, dx, dy) {
  const cells = region.cells.map((cell) => ({
    ...cell,
    x: cell.x + dx,
    y: cell.y + dy,
  }));
  return {
    cells,
    bounds: this.materialRegionBounds(cells),
  };
},

renderMaterialRegionFromBase(base, region, dx, dy) {
  this.restoreMaterialArrays(base);
  const shifted = this.shiftedMaterialRegion(region, dx, dy);
  for (const cell of shifted.cells) {
    this.writeMaterialCell(cell.x, cell.y, cell);
  }
  this.refreshCpmlMaterialContinuation(false);
  this.resetFields();
  return shifted;
},

applyMaterialKindToRegion(region, kind) {
  if (!region) return null;
  if (kind === "erase") {
    for (const cell of region.cells) {
      this.setMaterial(cell.x, cell.y, "erase");
    }
    this.refreshCpmlMaterialContinuation(false);
    this.resetFields();
    return null;
  }
  for (const cell of region.cells) {
    this.setMaterial(cell.x, cell.y, kind);
  }
  this.refreshCpmlMaterialContinuation(false);
  this.resetFields();
  const firstCell = region.cells[0];
  return firstCell ? this.findMaterialRegionAtCell(firstCell.x, firstCell.y) : null;
},

updateCustomMaterialCells(resetFields = true) {
  for (let i = 0; i < this.n; i += 1) {
    if (this.material[i] !== 4) continue;
    this.eps[i] = state.customEpsReal;
    this.loss[i] = state.customEpsImag;
    this.epsY[i] = state.customAnisotropic ? state.customEpsYReal : state.customEpsReal;
    this.lossY[i] = state.customAnisotropic ? state.customEpsYImag : state.customEpsImag;
    this.modulationBaseEps[i] = this.eps[i];
    this.modulationBaseEpsY[i] = this.epsY[i];
    this.modulatedMaterial[i] = state.materialModulationEnabled ? 1 : 0;
    this.modulationPhaseOffset[i] = 0;
    this.setCellNonlinearity(i, state.materialNonlinearEnabled || state.materialHarmonicEnabled, this.eps[i], this.epsY[i]);
    this.setCellDispersion(i, brushDispersionParams());
    const conductivity = brushConductivityParams();
    this.setCellConductivity(i, conductivity.sigma, conductivity.sigmaY);
    this.setCellPhaseChange(i, brushPhaseChangeParams());
    this.setCellGyrotropy(i, brushGyrotropyValue());
    this.setCellBianisotropy(i, brushBianisotropyValue());
    this.mu[i] = state.customMuReal;
    this.muLoss[i] = state.customMuImag;
    this.muY[i] = state.customAnisotropic ? state.customMuYReal : state.customMuReal;
    this.muLossY[i] = state.customAnisotropic ? state.customMuYImag : state.customMuImag;
  }
  this.refreshCpmlMaterialContinuation(false);
  if (resetFields) {
    this.resetFields();
  }
},

restoreDynamicMaterialsToBase() {
  for (let i = 0; i < this.n; i += 1) {
    if (!this.modulatedMaterial[i] && !this.nonlinearMaterial[i]) continue;
    this.eps[i] = this.modulationBaseEps[i];
    this.epsY[i] = this.modulationBaseEpsY[i];
  }
},

restoreModulatedMaterialsToBase() {
  this.restoreDynamicMaterialsToBase();
},

nonlinearIntensityAt(idx) {
  const scale = Number.isFinite(this.fieldScale) ? this.fieldScale : 1;
  const scaleSquared = scale * scale;
  if (state.fieldComponent === "hz") {
    return (this.hx[idx] * this.hx[idx] + this.hy[idx] * this.hy[idx]) * scaleSquared;
  }
  return this.ez[idx] * this.ez[idx] * scaleSquared;
},

nonlinearPolarization(fieldValue) {
  const chi2 = clamp(Number(state.harmonicChi2) || 0, -2, 2);
  const chi3 = clamp(Number(state.harmonicChi3) || 0, -2, 2);
  if (chi2 === 0 && chi3 === 0) return 0;
  const field = clamp(fieldValue, -1e4, 1e4);
  const saturation = Math.max(0.05, Number(state.harmonicSaturation) || 6);
  const limiter = 1 / (1 + (field * field) / saturation);
  return limiter * (chi2 * field * field + chi3 * field * field * field);
},

applyHarmonicNonlinearResponse() {
  if (!state.materialHarmonicEnabled) return;
  const nx = this.nx;
  const ny = this.ny;
  const s = this.courant;
  const fieldScale = Number.isFinite(this.fieldScale) ? this.fieldScale : 1;
  const rawScale = 1 / Math.max(1e-12, fieldScale);

  if (state.fieldComponent === "hz") {
    for (let y = 1; y < ny - 1; y += 1) {
      const row = y * nx;
      for (let x = 1; x < nx - 1; x += 1) {
        const idx = row + x;
        if (!this.nonlinearMaterial[idx] || this.material[idx] === 2) continue;
        const px = this.nonlinearPolarization(this.hx[idx] * fieldScale);
        const py = this.nonlinearPolarization(this.hy[idx] * fieldScale);
        const jx = clamp((px - this.harmonicPrevPx[idx]) * rawScale, -1e4, 1e4);
        const jy = clamp((py - this.harmonicPrevPy[idx]) * rawScale, -1e4, 1e4);
        this.harmonicPrevPx[idx] = px;
        this.harmonicPrevPy[idx] = py;
        this.hx[idx] -= (s / this.safeMaterialDenominator(this.eps[idx])) * jx;
        this.hy[idx] -= (s / this.safeMaterialDenominator(this.epsY[idx])) * jy;
      }
    }
    return;
  }

  for (let y = 1; y < ny - 1; y += 1) {
    const row = y * nx;
    for (let x = 1; x < nx - 1; x += 1) {
      const idx = row + x;
      if (!this.nonlinearMaterial[idx] || this.material[idx] === 2) continue;
      const pz = this.nonlinearPolarization(this.ez[idx] * fieldScale);
      const jz = clamp((pz - this.harmonicPrevPz[idx]) * rawScale, -1e4, 1e4);
      this.harmonicPrevPz[idx] = pz;
      this.ezx[idx] -= (s / this.safeMaterialDenominator(this.eps[idx])) * jz * 0.5;
      this.ezy[idx] -= (s / this.safeMaterialDenominator(this.epsY[idx])) * jz * 0.5;
      this.ez[idx] = this.ezx[idx] + this.ezy[idx];
    }
  }
},

applyDynamicMaterialResponse() {
  if (!state.materialModulationEnabled && !state.materialNonlinearEnabled) return;
  const modulationActive = state.materialModulationEnabled;
  const nonlinearActive = state.materialNonlinearEnabled;
  const depth = modulationActive ? clamp(Number(state.modulationDepth) || 0, 0, 0.95) : 0;
  const periodCells = Math.max(1, lambdaToCells(Math.max(0.1, state.modulationPeriodLambda)));
  const theta = (state.modulationAngleDeg * Math.PI) / 180;
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const omegaCycles = Number(state.modulationFrequency) || 0;
  const phase = (state.modulationPhaseDeg * Math.PI) / 180;
  const chi3 = nonlinearActive ? clamp(Number(state.kerrChi3) || 0, -20, 20) : 0;
  const saturation = Math.max(0.05, Number(state.kerrSaturation) || 5);

  for (let y = 0; y < this.ny; y += 1) {
    const row = y * this.nx;
    for (let x = 0; x < this.nx; x += 1) {
      const idx = row + x;
      if (!this.modulatedMaterial[idx] && !this.nonlinearMaterial[idx]) continue;
      let factor = 1;
      if (depth > 0 && this.modulatedMaterial[idx]) {
        const spatialCycles = (x * cosTheta + y * sinTheta) / periodCells;
        const localPhase = Number.isFinite(this.modulationPhaseOffset[idx]) ? this.modulationPhaseOffset[idx] : 0;
        const argument = 2 * Math.PI * (spatialCycles - omegaCycles * this.time) + phase + localPhase;
        factor += depth * Math.cos(argument);
      }
      let deltaEps = 0;
      if (chi3 !== 0 && this.nonlinearMaterial[idx]) {
        const physicalIntensity = Math.min(this.nonlinearIntensityAt(idx), 1e6);
        const saturatedIntensity = physicalIntensity / (1 + physicalIntensity / saturation);
        deltaEps = chi3 * saturatedIntensity;
      }
      this.eps[idx] = clamp(this.modulationBaseEps[idx] * factor + deltaEps, -30, 30);
      this.epsY[idx] = clamp(this.modulationBaseEpsY[idx] * factor + deltaEps, -30, 30);
    }
  }
},

applyPhaseChangeResponse() {
  if (!state.materialPhaseChangeEnabled) return;
  const thresholdOn = Math.max(0, Number(state.phaseThresholdOn) || 0);
  const thresholdOff = Math.min(thresholdOn, Math.max(0, Number(state.phaseThresholdOff) || 0));
  const tauOn = Math.max(1, Number(state.phaseTauOn) || 18);
  const tauOff = Math.max(1, Number(state.phaseTauOff) || 180);
  const alphaOn = 1 - Math.exp(-1 / tauOn);
  const alphaOff = 1 - Math.exp(-1 / tauOff);

  for (let i = 0; i < this.n; i += 1) {
    if (!this.phaseChangeMaterial[i] || this.material[i] === 2) continue;
    const intensity = Math.min(this.nonlinearIntensityAt(i), 1e12);
    let s = this.phaseState[i];
    if (intensity >= thresholdOn) {
      s += (1 - s) * alphaOn;
    } else if (intensity <= thresholdOff) {
      s -= s * alphaOff;
    }
    s = clamp(s, 0, 1);
    this.phaseState[i] = s;
    this.eps[i] = clamp(lerp(this.phaseEpsOff[i], this.phaseEpsOn[i], s), -30, 30);
    this.loss[i] = clamp(lerp(this.phaseLossOff[i], this.phaseLossOn[i], s), -30, 30);
    this.epsY[i] = clamp(lerp(this.phaseEpsYOff[i], this.phaseEpsYOn[i], s), -30, 30);
    this.lossY[i] = clamp(lerp(this.phaseLossYOff[i], this.phaseLossYOn[i], s), -30, 30);
    if (this.modulatedMaterial[i] || this.nonlinearMaterial[i]) {
      this.modulationBaseEps[i] = this.eps[i];
      this.modulationBaseEpsY[i] = this.epsY[i];
    }
  }
},

fullVectorBianisotropyActive() {
  return Boolean(
    state.materialFullVectorBianisotropyEnabled &&
      state.materialBianisotropyEnabled &&
      state.fieldComponent === "hz"
  );
},

canUseCompiledFullVectorBianisotropy() {
  return Boolean(
    this.fullVectorBianisotropyActive() &&
      this.wasmBackend?.canStep("hz") &&
      this.wasmBackend?.canStep("ez") &&
      (!this.cpmlActive?.() || this.wasmBackend?.supportsCpml?.()) &&
      !this.hasTfsfIncidentSource?.() &&
      !this.hasModeProfileSource?.() &&
      !state.materialModulationEnabled &&
      !state.materialNonlinearEnabled &&
      !state.materialHarmonicEnabled &&
      !state.materialDispersionEnabled &&
      !state.materialConductivityEnabled &&
      !state.materialSaturableGainEnabled &&
      !state.materialPhaseChangeEnabled &&
      !state.materialGyrotropyEnabled
  );
},

setSplitFieldValue(idx, scalarArray, splitXArray, splitYArray, nextValue) {
  const value = Number.isFinite(nextValue) ? nextValue : 0;
  const oldValue = scalarArray[idx];
  if (Math.abs(oldValue) > 1e-12) {
    const scale = value / oldValue;
    splitXArray[idx] *= scale;
    splitYArray[idx] *= scale;
  } else {
    splitXArray[idx] = value * 0.5;
    splitYArray[idx] = value * 0.5;
  }
  scalarArray[idx] = value;
},

stepDualTmMode() {
  if (!this.fullVectorBianisotropyActive()) return;
  if (this.canUseCompiledFullVectorBianisotropy()) {
    this.wasmBackend.stepDualTm(this);
    return;
  }
  const nx = this.nx;
  const ny = this.ny;
  const s = this.courant;
  const ez = this.dualEz;
  const ezx = this.dualEzx;
  const ezy = this.dualEzy;
  const hx = this.dualHx;
  const hy = this.dualHy;

  for (let y = 0; y < ny - 1; y += 1) {
    const row = y * nx;
    for (let x = 0; x < nx; x += 1) {
      const i = row + x;
      const dEzDy = this.cpmlDerivativeY(ez[i + nx] - ez[i], this.cpmlPsiDualHxY, i, y, false);
      const magneticDecay = this.magneticLossDecay(this.muLoss[i]);
      const magneticScale = s / this.safeMaterialDenominator(this.mu[i]);
      hx[i] = (hx[i] - magneticScale * dEzDy) * magneticDecay;
    }
  }

  for (let y = 0; y < ny; y += 1) {
    const row = y * nx;
    for (let x = 0; x < nx - 1; x += 1) {
      const i = row + x;
      const dEzDx = this.cpmlDerivativeX(ez[i + 1] - ez[i], this.cpmlPsiDualHyX, i, x, false);
      const magneticDecay = this.magneticLossDecay(this.muLossY[i]);
      const magneticScale = s / this.safeMaterialDenominator(this.muY[i]);
      hy[i] = (hy[i] + magneticScale * dEzDx) * magneticDecay;
    }
  }

  for (let y = 1; y < ny - 1; y += 1) {
    const row = y * nx;
    for (let x = 1; x < nx - 1; x += 1) {
      const i = row + x;
      if (this.material[i] === 2) {
        this.zeroDualFieldCell(i);
        continue;
      }
      const dHyDx = this.cpmlDerivativeX(hy[i] - hy[i - 1], this.cpmlPsiDualEzX, i, x, true);
      const dHxDy = this.cpmlDerivativeY(hx[i] - hx[i - nx], this.cpmlPsiDualEzY, i, y, true);
      const decayX = this.electricLossDecay(this.loss[i], i);
      const decayY = this.electricLossDecay(this.lossY[i], i);
      const materialScaleX = s / this.safeMaterialDenominator(this.eps[i]);
      const materialScaleY = s / this.safeMaterialDenominator(this.epsY[i]);
      const sigmaDampX = this.conductivityDamp(this.conductivity[i], this.eps[i]);
      const sigmaDampY = this.conductivityDamp(this.conductivityY[i], this.epsY[i]);
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

solveBianisotropicIncrement(oldElectric, oldMagnetic, nextElectric, nextMagnetic, epsValue, muValue, kappaNorm) {
  const epsEff = this.safeMaterialDenominator(epsValue);
  const muEff = this.safeMaterialDenominator(muValue);
  const kappaScale = Math.sqrt(Math.abs(epsEff * muEff));
  const kappa = normalizeBianisotropyKappa(kappaNorm) * kappaScale;
  const det = epsEff * muEff - kappa * kappa;
  if (!Number.isFinite(det) || Math.abs(det) <= 1e-9) {
    return { electric: nextElectric, magnetic: nextMagnetic };
  }
  const deltaElectric0 = clamp(nextElectric - oldElectric, -1e4, 1e4);
  const deltaMagnetic0 = clamp(nextMagnetic - oldMagnetic, -1e4, 1e4);
  if (deltaElectric0 === 0 && deltaMagnetic0 === 0) {
    return { electric: oldElectric, magnetic: oldMagnetic };
  }
  const dDisplacement = epsEff * deltaElectric0;
  const dFlux = muEff * deltaMagnetic0;
  const deltaElectric = (muEff * dDisplacement - kappa * dFlux) / det;
  const deltaMagnetic = (-kappa * dDisplacement + epsEff * dFlux) / det;
  return {
    electric: oldElectric + clamp(deltaElectric, -1e4, 1e4),
    magnetic: oldMagnetic + clamp(deltaMagnetic, -1e4, 1e4),
  };
},

applyBianisotropicResponse() {
  if (!state.materialBianisotropyEnabled) return;
  if (this.fullVectorBianisotropyActive()) {
    this.applyFullVectorBianisotropicResponse();
    return;
  }
  const hzMode = state.fieldComponent === "hz";
  for (let i = 0; i < this.n; i += 1) {
    if (!this.bianisotropicMaterial[i] || this.material[i] === 2) continue;
    const kappa = normalizeBianisotropyKappa(this.bianisotropyKappa[i]);
    if (kappa === 0) continue;

    if (hzMode) {
      const pairX = this.solveBianisotropicIncrement(
        this.bianisotropyPrevTy[i],
        this.bianisotropyPrevSplitX[i],
        this.hy[i],
        this.ezx[i],
        this.epsY[i],
        this.mu[i],
        kappa,
      );
      const pairY = this.solveBianisotropicIncrement(
        this.bianisotropyPrevTx[i],
        this.bianisotropyPrevSplitY[i],
        this.hx[i],
        this.ezy[i],
        this.eps[i],
        this.muY[i],
        -kappa,
      );
      this.hy[i] = pairX.electric;
      this.ezx[i] = pairX.magnetic;
      this.hx[i] = pairY.electric;
      this.ezy[i] = pairY.magnetic;
    } else {
      const pairX = this.solveBianisotropicIncrement(
        this.bianisotropyPrevSplitX[i],
        this.bianisotropyPrevTy[i],
        this.ezx[i],
        this.hy[i],
        this.eps[i],
        this.muY[i],
        kappa,
      );
      const pairY = this.solveBianisotropicIncrement(
        this.bianisotropyPrevSplitY[i],
        this.bianisotropyPrevTx[i],
        this.ezy[i],
        this.hx[i],
        this.epsY[i],
        this.mu[i],
        -kappa,
      );
      this.ezx[i] = pairX.electric;
      this.hy[i] = pairX.magnetic;
      this.ezy[i] = pairY.electric;
      this.hx[i] = pairY.magnetic;
    }

    this.ez[i] = this.ezx[i] + this.ezy[i];
    this.bianisotropyPrevScalar[i] = this.ez[i];
    this.bianisotropyPrevSplitX[i] = this.ezx[i];
    this.bianisotropyPrevSplitY[i] = this.ezy[i];
    this.bianisotropyPrevTx[i] = this.hx[i];
    this.bianisotropyPrevTy[i] = this.hy[i];
  }
},

applyFullVectorBianisotropicResponse() {
  for (let i = 0; i < this.n; i += 1) {
    if (!this.bianisotropicMaterial[i] || this.material[i] === 2) continue;
    const kappa = normalizeBianisotropyKappa(this.bianisotropyKappa[i]);
    if (kappa === 0) continue;

    const pairX = this.solveBianisotropicIncrement(
      this.bianisotropyPrevTx[i],
      this.bianisotropyPrevDualHx[i],
      this.hx[i],
      this.dualHx[i],
      this.eps[i],
      this.mu[i],
      kappa,
    );
    this.hx[i] = pairX.electric;
    this.dualHx[i] = pairX.magnetic;

    const pairY = this.solveBianisotropicIncrement(
      this.bianisotropyPrevTy[i],
      this.bianisotropyPrevDualHy[i],
      this.hy[i],
      this.dualHy[i],
      this.epsY[i],
      this.muY[i],
      kappa,
    );
    this.hy[i] = pairY.electric;
    this.dualHy[i] = pairY.magnetic;

    const epsZ = 0.5 * (this.safeMaterialDenominator(this.eps[i]) + this.safeMaterialDenominator(this.epsY[i]));
    const muZ = 0.5 * (this.safeMaterialDenominator(this.mu[i]) + this.safeMaterialDenominator(this.muY[i]));
    const pairZ = this.solveBianisotropicIncrement(
      this.bianisotropyPrevDualEz[i],
      this.bianisotropyPrevScalar[i],
      this.dualEz[i],
      this.ez[i],
      epsZ,
      muZ,
      kappa,
    );
    this.setSplitFieldValue(i, this.dualEz, this.dualEzx, this.dualEzy, pairZ.electric);
    this.setSplitFieldValue(i, this.ez, this.ezx, this.ezy, pairZ.magnetic);

    this.bianisotropyPrevScalar[i] = this.ez[i];
    this.bianisotropyPrevSplitX[i] = this.ezx[i];
    this.bianisotropyPrevSplitY[i] = this.ezy[i];
    this.bianisotropyPrevTx[i] = this.hx[i];
    this.bianisotropyPrevTy[i] = this.hy[i];
    this.bianisotropyPrevDualEz[i] = this.dualEz[i];
    this.bianisotropyPrevDualEzx[i] = this.dualEzx[i];
    this.bianisotropyPrevDualEzy[i] = this.dualEzy[i];
    this.bianisotropyPrevDualHx[i] = this.dualHx[i];
    this.bianisotropyPrevDualHy[i] = this.dualHy[i];
  }
},

advanceSecondOrderPolarization(fieldValue, polarizationValue, currentValue, resonanceOmega, dampingGamma, driveCoeff) {
  const gammaHalf = 0.5 * Math.max(0, dampingGamma);
  const omega = Math.max(0, resonanceOmega);
  const omega2 = omega * omega;
  const previousPolarization = polarizationValue - currentValue;
  const denominator = 1 + gammaHalf;
  const nextPolarization = (
    (2 - omega2) * polarizationValue
    - (1 - gammaHalf) * previousPolarization
    + driveCoeff * fieldValue
  ) / denominator;
  return {
    polarization: nextPolarization,
    current: nextPolarization - polarizationValue,
  };
},

advanceDispersiveCurrent(idx, fieldValue, polarization, current) {
  const kind = this.dispersiveMaterial[idx];
  if (!kind) return 0;
  const gamma = Math.max(0, this.dispersionGamma[idx]);
  let p = polarization[idx];
  let j = current[idx];

  if (kind === 1) {
    const omegaP = Math.max(0, this.dispersionOmegaP[idx]);
    const next = this.advanceSecondOrderPolarization(fieldValue, p, j, 0, gamma, omegaP * omegaP);
    p = next.polarization;
    j = next.current;
  } else if (kind === 2) {
    const omega0 = Math.max(0, this.dispersionOmega0[idx]);
    const deltaEps = this.dispersionDeltaEps[idx];
    const next = this.advanceSecondOrderPolarization(
      fieldValue,
      p,
      j,
      omega0,
      gamma,
      deltaEps * omega0 * omega0,
    );
    p = next.polarization;
    j = next.current;
  } else if (kind === 3) {
    const tau = Math.max(1, this.dispersionTau[idx]);
    const relax = Math.exp(-1 / tau);
    const nextP = relax * p + (1 - relax) * this.dispersionDeltaEps[idx] * fieldValue;
    j = nextP - p;
    p = nextP;
  }

  polarization[idx] = clamp(p, -1e6, 1e6);
  current[idx] = clamp(j, -1e6, 1e6);
  return current[idx];
},

advanceMagneticDispersiveCurrent(idx, fieldValue, magnetization, current) {
  const kind = this.muDispersiveMaterial[idx];
  if (!kind) return 0;
  const gamma = Math.max(0, this.muDispersionGamma[idx]);
  let m = magnetization[idx];
  let j = current[idx];

  if (kind === 1) {
    const omegaP = Math.max(0, this.muDispersionOmegaP[idx]);
    const next = this.advanceSecondOrderPolarization(fieldValue, m, j, 0, gamma, omegaP * omegaP);
    m = next.polarization;
    j = next.current;
  } else if (kind === 2) {
    const omega0 = Math.max(0, this.muDispersionOmega0[idx]);
    const deltaMu = this.muDispersionDeltaMu[idx];
    const next = this.advanceSecondOrderPolarization(
      fieldValue,
      m,
      j,
      omega0,
      gamma,
      deltaMu * omega0 * omega0,
    );
    m = next.polarization;
    j = next.current;
  } else if (kind === 3) {
    const tau = Math.max(1, this.muDispersionTau[idx]);
    const relax = Math.exp(-1 / tau);
    const nextM = relax * m + (1 - relax) * this.muDispersionDeltaMu[idx] * fieldValue;
    j = nextM - m;
    m = nextM;
  }

  magnetization[idx] = clamp(m, -1e6, 1e6);
  current[idx] = clamp(j, -1e6, 1e6);
  return current[idx];
},

safeMaterialDenominator(value) {
  const numeric = Number(value) || 0;
  if (Math.abs(numeric) >= 1e-6) return numeric;
  return numeric < 0 ? -1e-6 : 1e-6;
},

applyHzElectricCurrentVector(idx, x, y, jx, jy) {
  if (jx === 0 && jy === 0) return;
  const sourceX = -this.courant * jx;
  const sourceY = -this.courant * jy;
  const epsX = this.eps[idx];
  const epsYi = this.epsY[idx];
  const k = this.epsilonXY[idx] || 0;
  const g = this.gyrotropyG[idx] || 0;
  const upperOffDiagonal = k + g;
  const lowerOffDiagonal = k - g;
  const det = epsX * epsYi - upperOffDiagonal * lowerOffDiagonal;
  const safeDet = Math.abs(det) < 1e-6 ? (det < 0 ? -1e-6 : 1e-6) : det;
  this.hx[idx] += (epsYi * sourceX - upperOffDiagonal * sourceY) / safeDet;
  this.hy[idx] += (-lowerOffDiagonal * sourceX + epsX * sourceY) / safeDet;
},

applyDispersiveElectricResponse() {
  if (!state.materialDispersionEnabled) return;
  const nx = this.nx;
  const ny = this.ny;
  const s = this.courant;
  if (state.fieldComponent === "hz") {
    for (let y = 1; y < ny - 1; y += 1) {
      const row = y * nx;
      for (let x = 1; x < nx - 1; x += 1) {
        const idx = row + x;
        if (!this.dispersiveMaterial[idx] || this.material[idx] === 2) continue;
        const axes = this.dispersionAxes[idx] || 3;
        let jx = 0;
        let jy = 0;
        if (axes === 1) {
          const axisX = Number.isFinite(this.dispersionAxisX[idx]) ? this.dispersionAxisX[idx] : 1;
          const axisY = Number.isFinite(this.dispersionAxisY[idx]) ? this.dispersionAxisY[idx] : 0;
          const fieldAlongAxis = axisX * this.hx[idx] + axisY * this.hy[idx];
          const jAxis = this.advanceDispersiveCurrent(idx, fieldAlongAxis, this.dispPx, this.dispJx);
          jx = axisX * jAxis;
          jy = axisY * jAxis;
        } else {
          jx = axes & 1 ? this.advanceDispersiveCurrent(idx, this.hx[idx], this.dispPx, this.dispJx) : 0;
          jy = axes & 2 ? this.advanceDispersiveCurrent(idx, this.hy[idx], this.dispPy, this.dispJy) : 0;
        }
        this.applyHzElectricCurrentVector(idx, x, y, jx, jy);
      }
    }
    return;
  }

  for (let y = 1; y < ny - 1; y += 1) {
    const row = y * nx;
    for (let x = 1; x < nx - 1; x += 1) {
      const idx = row + x;
      if (!this.dispersiveMaterial[idx] || this.material[idx] === 2) continue;
      if (!((this.dispersionAxes[idx] || 3) & 1)) continue;
      const jz = this.advanceDispersiveCurrent(idx, this.ez[idx], this.dispPz, this.dispJz);
      const epsX = this.safeMaterialDenominator(this.eps[idx]);
      const epsY = this.safeMaterialDenominator(this.epsY[idx]);
      this.ezx[idx] -= (s / epsX) * jz * 0.5;
      this.ezy[idx] -= (s / epsY) * jz * 0.5;
      this.ez[idx] = this.ezx[idx] + this.ezy[idx];
    }
  }
},

applyDispersiveMagneticResponse(component = state.fieldComponent) {
  if (!state.materialDispersionEnabled) return;
  const nx = this.nx;
  const ny = this.ny;
  const s = this.courant;

  if (component === "hz") {
    for (let y = 1; y < ny - 1; y += 1) {
      const row = y * nx;
      for (let x = 1; x < nx - 1; x += 1) {
        const idx = row + x;
        if (!this.muDispersiveMaterial[idx] || this.material[idx] === 2) continue;
        if (!((this.muDispersionAxes[idx] || 1) & 1)) continue;
        const jz = this.advanceMagneticDispersiveCurrent(idx, this.ez[idx], this.magDispMz, this.magDispJz);
        const muX = this.safeMaterialDenominator(this.mu[idx]);
        const muY = this.safeMaterialDenominator(this.muY[idx]);
        const decayX = this.magneticLossDecay(this.muLoss[idx]);
        const decayY = this.magneticLossDecay(this.muLossY[idx]);
        this.ezx[idx] -= (s / muX) * jz * 0.5 * decayX;
        this.ezy[idx] -= (s / muY) * jz * 0.5 * decayY;
        this.ez[idx] = this.ezx[idx] + this.ezy[idx];
      }
    }
    return;
  }

  for (let y = 0; y < ny - 1; y += 1) {
    const row = y * nx;
    for (let x = 0; x < nx; x += 1) {
      const idx = row + x;
      if (!this.muDispersiveMaterial[idx] || this.material[idx] === 2) continue;
      if (!((this.muDispersionAxes[idx] || 3) & 1)) continue;
      const jx = this.advanceMagneticDispersiveCurrent(idx, this.hx[idx], this.magDispMx, this.magDispJx);
      const muX = this.safeMaterialDenominator(this.mu[idx]);
      const decay = this.magneticLossDecay(this.muLoss[idx]);
      this.hx[idx] -= (s / muX) * jx * decay;
    }
  }

  for (let y = 0; y < ny; y += 1) {
    const row = y * nx;
    for (let x = 0; x < nx - 1; x += 1) {
      const idx = row + x;
      if (!this.muDispersiveMaterial[idx] || this.material[idx] === 2) continue;
      if (!((this.muDispersionAxes[idx] || 3) & 2)) continue;
      const jy = this.advanceMagneticDispersiveCurrent(idx, this.hy[idx], this.magDispMy, this.magDispJy);
      const muY = this.safeMaterialDenominator(this.muY[idx]);
      const decay = this.magneticLossDecay(this.muLossY[idx]);
      this.hy[idx] -= (s / muY) * jy * decay;
    }
  }
},

conductivityDamp(sigma, materialValue) {
  const value = Number(sigma) || 0;
  if (value <= 0) return 0;
  const denominator = Math.max(1e-6, Math.abs(materialValue));
  return Math.min(1e6, (value * this.courant) / (2 * denominator));
},

effectiveElectricLoss(lossValue, idx) {
  let value = Number(lossValue) || 0;
  if (state.materialSaturableGainEnabled && value < 0) {
    const saturation = Math.max(0.05, Number(state.gainSaturation) || 4);
    const intensity = Math.min(this.nonlinearIntensityAt(idx), 1e12);
    value /= 1 + intensity / saturation;
  }
  return Math.max(-0.95, value);
},

electricLossDecay(lossValue, idx) {
  return 1 / (1 + this.effectiveElectricLoss(lossValue, idx));
},

effectiveMagneticLoss(lossValue) {
  return Math.max(-0.95, Number(lossValue) || 0);
},

magneticLossDecay(lossValue) {
  return 1 / (1 + this.effectiveMagneticLoss(lossValue));
}
});
