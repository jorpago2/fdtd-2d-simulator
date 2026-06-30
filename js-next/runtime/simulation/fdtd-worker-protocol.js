"use strict";

const FDTD_WORKER_FRAME_ARRAYS = Object.freeze([
  "ez",
  "ezx",
  "ezy",
  "hx",
  "hy",
  "eps",
  "loss",
  "epsY",
  "lossY",
  "mu",
  "muLoss",
  "muY",
  "muLossY",
  "dualEz",
  "dualEzx",
  "dualEzy",
  "dualHx",
  "dualHy",
  "phaseState",
]);

const FDTD_WORKER_FULL_ARRAYS = Object.freeze([
  "ez",
  "ezx",
  "ezy",
  "hx",
  "hy",
  "eps",
  "loss",
  "epsY",
  "lossY",
  "conductivity",
  "conductivityY",
  "mu",
  "muLoss",
  "muY",
  "muLossY",
  "material",
  "modulatedMaterial",
  "modulationPhaseOffset",
  "nonlinearMaterial",
  "electricTensorMaterial",
  "epsilonXY",
  "gyrotropicMaterial",
  "gyrotropyG",
  "bianisotropicMaterial",
  "bianisotropyKappa",
  "bianisotropyPrevScalar",
  "bianisotropyPrevSplitX",
  "bianisotropyPrevSplitY",
  "bianisotropyPrevTx",
  "bianisotropyPrevTy",
  "dualEz",
  "dualEzx",
  "dualEzy",
  "dualHx",
  "dualHy",
  "bianisotropyPrevDualEz",
  "bianisotropyPrevDualEzx",
  "bianisotropyPrevDualEzy",
  "bianisotropyPrevDualHx",
  "bianisotropyPrevDualHy",
  "phaseChangeMaterial",
  "phaseState",
  "phaseEpsOff",
  "phaseLossOff",
  "phaseEpsYOff",
  "phaseLossYOff",
  "phaseEpsOn",
  "phaseLossOn",
  "phaseEpsYOn",
  "phaseLossYOn",
  "modulationBaseEps",
  "modulationBaseEpsY",
  "dispersiveMaterial",
  "dispersionAxes",
  "dispersionAxisX",
  "dispersionAxisY",
  "dispersionOmegaP",
  "dispersionGamma",
  "dispersionOmega0",
  "dispersionDeltaEps",
  "dispersionTau",
  "muDispersiveMaterial",
  "muDispersionAxes",
  "muDispersionOmegaP",
  "muDispersionGamma",
  "muDispersionOmega0",
  "muDispersionDeltaMu",
  "muDispersionTau",
  "dispPz",
  "dispJz",
  "dispPx",
  "dispJx",
  "dispPy",
  "dispJy",
  "magDispMz",
  "magDispJz",
  "magDispMx",
  "magDispJx",
  "magDispMy",
  "magDispJy",
  "harmonicPrevPz",
  "harmonicPrevPx",
  "harmonicPrevPy",
  "eCaX",
  "eCbX",
  "hCaX",
  "hCbX",
  "eCaY",
  "eCbY",
  "hCaY",
  "hCbY",
]);

const FDTD_WORKER_SCALAR_PROPS = Object.freeze([
  "time",
  "lastMax",
  "lastMaxLog10",
  "lastEnergy",
  "lastEnergyLog10",
  "lastViewRange",
  "lastViewRangeLog10",
  "fieldScale",
  "fieldLog10Scale",
  "renormalizedCount",
  "lastRenormalized",
  "lastDiverged",
  "diagnosticFluxLeft",
  "diagnosticFluxRight",
  "diagnosticReflectedPower",
  "diagnosticIncidentPower",
  "diagnosticTransmittedPower",
  "diagnosticReflectedPowerEwma",
  "diagnosticIncidentPowerEwma",
  "diagnosticTransmittedPowerEwma",
  "diagnosticReflectedPhasorPower",
  "diagnosticIncidentPhasorPower",
  "diagnosticTransmittedPhasorPower",
  "diagnosticIncidentFlux",
  "diagnosticReflectance",
  "diagnosticTransmittance",
  "diagnosticSamples",
  "diagnosticAngleDeg",
  "diagnosticImpedanceLeft",
  "diagnosticImpedanceRight",
  "analysisSamples",
  "analysisProbeIndex",
  "analysisProbeCount",
  "analysisEnergyIndex",
  "analysisEnergyCount",
  "analysisEnergyEwma",
  "analysisSourceIntensityEwma",
  "analysisOutwardFluxEwma",
  "analysisGuidedFluxEwma",
  "analysisHyperlensInnerEnergyEwma",
  "analysisHyperlensOuterEnergyEwma",
  "analysisHyperlensInnerDetailEwma",
  "analysisHyperlensOuterDetailEwma",
  "analysisHyperlensMtfMeanEwma",
  "analysisHyperlensMtfPeakEwma",
  "analysisHyperlensMtfHighOrderEwma",
  "analysisHyperlensMtfBandwidthEwma",
]);

function fdtdWorkerClonePlainData(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function fdtdWorkerCollectProps(sim, options = {}) {
  const props = {};
  for (const name of FDTD_WORKER_SCALAR_PROPS) {
    const value = sim?.[name];
    if (typeof value !== "undefined") props[name] = value;
  }
  if (sim?.diagnosticPhasors) props.diagnosticPhasors = fdtdWorkerClonePlainData(sim.diagnosticPhasors);
  if (sim?.diagnosticDftSummary) props.diagnosticDftSummary = fdtdWorkerClonePlainData(sim.diagnosticDftSummary);
  if (sim?.analysisMetrics) props.analysisMetrics = fdtdWorkerClonePlainData(sim.analysisMetrics);
  if (Object.prototype.hasOwnProperty.call(options, "engine")) {
    props.engine = typeof options.engine === "function" ? options.engine(sim) : options.engine;
  }
  return props;
}

function fdtdWorkerApplyProps(sim, props = {}) {
  if (!sim || !props) return;
  for (const name of FDTD_WORKER_SCALAR_PROPS) {
    if (Object.prototype.hasOwnProperty.call(props, name)) sim[name] = props[name];
  }
  if (props.diagnosticPhasors) sim.diagnosticPhasors = props.diagnosticPhasors;
  if (props.diagnosticDftSummary) sim.diagnosticDftSummary = props.diagnosticDftSummary;
  if (props.analysisMetrics) sim.analysisMetrics = props.analysisMetrics;
}

function fdtdWorkerCollectArrays(sim, names, options = {}) {
  const arrays = {};
  const transfer = [];
  for (const name of names) {
    const source = sim?.[name];
    if (!source || typeof source.length !== "number") continue;
    const copy = new source.constructor(source);
    arrays[name] = copy;
    if (options.transfer && copy.buffer?.byteLength) transfer.push(copy.buffer);
  }
  return { arrays, transfer };
}

function fdtdWorkerApplyArrays(sim, arrays = {}) {
  if (!sim || !arrays) return;
  for (const [name, source] of Object.entries(arrays)) {
    const target = sim[name];
    if (!target || typeof target.set !== "function" || target.length !== source.length) continue;
    target.set(source);
  }
}

function fdtdWorkerCollectTransferables(arrays = {}) {
  const buffers = new Set();
  for (const array of Object.values(arrays)) {
    if (array?.buffer?.byteLength) buffers.add(array.buffer);
  }
  return Array.from(buffers);
}
