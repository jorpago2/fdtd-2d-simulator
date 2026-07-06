#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), "..");

function readText(...parts) {
  return fs.readFileSync(path.join(rootDir, ...parts), "utf8");
}

function loadScripts(context, files) {
  for (const file of files) {
    vm.runInContext(readText(...file), context, { filename: file.join("/") });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNearlyEqual(actual, expected, message, tolerance = 1e-6) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: ${actual} !== ${expected}`);
  }
}

function createContext() {
  const context = {
    console,
    Math,
    Uint8Array,
    Float32Array,
    state: {
      subpixelSmoothingEnabled: false,
      fieldComponent: "ez",
      customAnisotropic: false,
      customEpsReal: 4,
      customEpsImag: 0,
      customEpsYReal: 4,
      customEpsYImag: 0,
      customMuReal: 1,
      customMuImag: 0,
      customMuYReal: 1,
      customMuYImag: 0,
      materialModulationEnabled: false,
      materialNonlinearEnabled: false,
      materialHarmonicEnabled: false,
      materialDispersionEnabled: false,
      materialConductivityEnabled: false,
      materialSaturableGainEnabled: false,
      materialPhaseChangeEnabled: false,
      materialGyrotropyEnabled: false,
      materialBianisotropyEnabled: false,
    },
    clamp(value, min, max) {
      return Math.max(min, Math.min(max, Number(value)));
    },
    clampInt(value, min, max) {
      return Math.round(context.clamp(Number(value) || 0, min, max));
    },
    dispersionAxesMask(value, fallback = 0) {
      return Number.isFinite(value) ? value : fallback;
    },
    normalizeBianisotropyKappa(value) {
      return Number(value) || 0;
    },
    brushDispersionParams() {
      return null;
    },
    brushConductivityParams() {
      return { sigma: 0, sigmaY: 0 };
    },
    brushGyrotropyValue() {
      return 0;
    },
    brushBianisotropyValue() {
      return 0;
    },
    brushPhaseChangeParams() {
      return null;
    },
  };
  context.window = context;
  context.globalThis = context;
  context.FDTDSim = function FDTDSim() {};
  vm.createContext(context);
  loadScripts(context, [
    ["src", "runtime", "simulation", "fdtd-array-state.js"],
    ["src", "runtime", "simulation", "fdtd-subpixel-materials.js"],
    ["src", "runtime", "simulation", "fdtd-materials.js"],
  ]);
  Object.assign(context.FDTDSim.prototype, {
    id(x, y) {
      return x + y * this.nx;
    },
    activeInteriorMinX() {
      return 1;
    },
    activeInteriorMaxX() {
      return this.nx - 2;
    },
    activeInteriorMinY() {
      return 1;
    },
    activeInteriorMaxY() {
      return this.ny - 2;
    },
    isInBoundaryControlRegion() {
      return false;
    },
    refreshCpmlMaterialContinuation() {},
    resetFields() {},
    zeroElectricCell() {},
    zeroDualFieldCell() {},
  });
  return context;
}

function createSim(context, nx = 24, ny = 20) {
  const sim = new context.FDTDSim();
  sim.nx = nx;
  sim.ny = ny;
  sim.n = nx * ny;
  sim.materialTextureRevision = 0;
  sim.materialValueRevision = 0;
  sim.allocateJsCoreArrays();
  sim.allocateAuxiliaryArrays();
  sim.initializeSubpixelMaterialState();
  sim.clearMaterials(false);
  return sim;
}

function drawCorner(sim) {
  sim.setMaterial(10, 10, "dielectric");
  sim.setMaterial(11, 10, "dielectric");
  sim.setMaterial(10, 11, "dielectric");
}

function findSmoothedCell(sim) {
  for (let i = 0; i < sim.n; i += 1) {
    if (Math.abs(sim.eps[i] - sim.rawEps[i]) > 1e-6 || Math.abs(sim.epsY[i] - sim.rawEpsY[i]) > 1e-6) {
      return i;
    }
  }
  return -1;
}

function validateDisabledIsRaw(context) {
  const sim = createSim(context);
  drawCorner(sim);
  context.state.subpixelSmoothingEnabled = false;
  sim.rebuildSubpixelMaterialCoefficients({ force: true, refreshCpml: false });
  for (let i = 0; i < sim.n; i += 1) {
    assertNearlyEqual(sim.eps[i], sim.rawEps[i], "disabled smoothing eps mismatch");
    assertNearlyEqual(sim.epsY[i], sim.rawEpsY[i], "disabled smoothing epsY mismatch");
  }
}

function validatePassiveCornerSmoothing(context) {
  const sim = createSim(context);
  drawCorner(sim);
  context.state.subpixelSmoothingEnabled = true;
  sim.rebuildSubpixelMaterialCoefficients({ force: true, refreshCpml: false });
  const smoothedIdx = findSmoothedCell(sim);
  assert(smoothedIdx >= 0, "passive corner should produce at least one effective coefficient");
  assert(sim.subpixelSmoothedCells > 0, "smoothed cell count should be positive");
  return { sim, smoothedIdx };
}

function validateIdempotence(context) {
  const { sim } = validatePassiveCornerSmoothing(context);
  const eps = new Float32Array(sim.eps);
  const epsY = new Float32Array(sim.epsY);
  sim.rebuildSubpixelMaterialCoefficients({ force: true, refreshCpml: false });
  for (let i = 0; i < sim.n; i += 1) {
    assertNearlyEqual(sim.eps[i], eps[i], "subpixel smoothing must be idempotent for eps");
    assertNearlyEqual(sim.epsY[i], epsY[i], "subpixel smoothing must be idempotent for epsY");
  }
}

function validateExportUsesRaw(context) {
  const { sim, smoothedIdx } = validatePassiveCornerSmoothing(context);
  const x = smoothedIdx % sim.nx;
  const y = Math.floor(smoothedIdx / sim.nx);
  const cell = sim.snapshotMaterialCell(x, y);
  assertNearlyEqual(cell.eps, sim.rawEps[smoothedIdx], "snapshot must export raw eps");
  assertNearlyEqual(cell.epsY, sim.rawEpsY[smoothedIdx], "snapshot must export raw epsY");
}

function validatePecAndPlanarInterfacesAreConservative(context) {
  const sim = createSim(context);
  for (let y = 1; y < sim.ny - 1; y += 1) {
    for (let x = 12; x < sim.nx - 1; x += 1) {
      sim.setMaterial(x, y, "dielectric");
    }
  }
  sim.setMaterial(11, 10, "pec");
  context.state.subpixelSmoothingEnabled = true;
  sim.rebuildSubpixelMaterialCoefficients({ force: true, refreshCpml: false });
  const pecIdx = sim.id(11, 10);
  assertNearlyEqual(sim.eps[pecIdx], 1, "PEC eps must remain unchanged");
  for (let y = 2; y < sim.ny - 2; y += 1) {
    const leftIdx = sim.id(11, y);
    const rightIdx = sim.id(12, y);
    assertNearlyEqual(sim.eps[leftIdx], sim.rawEps[leftIdx], "planar interface air cell should not be smoothed");
    assertNearlyEqual(sim.eps[rightIdx], sim.rawEps[rightIdx], "planar interface dielectric cell should not be smoothed");
  }
}

const context = createContext();
validateDisabledIsRaw(context);
validatePassiveCornerSmoothing(context);
validateIdempotence(context);
validateExportUsesRaw(context);
validatePecAndPlanarInterfacesAreConservative(context);
console.log("Subpixel smoothing validation: PASS");
