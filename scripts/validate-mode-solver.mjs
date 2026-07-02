#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function repoPath(...parts) {
  return path.join(rootDir, ...parts);
}

function loadModeSolver() {
  const context = { console };
  context.window = context;
  context.self = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(repoPath("js-next", "runtime", "simulation", "fdtd-mode-solver.js"), "utf8"), context, {
    filename: "fdtd-mode-solver.js",
  });
  return context.FdtdModeSolver;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function energyFraction(profile, firstIndex, lastIndex) {
  let totalEnergy = 0;
  let selectedEnergy = 0;
  for (let i = 0; i < profile.length; i += 1) {
    const energy = profile[i] * profile[i];
    totalEnergy += energy;
    if (i >= firstIndex && i <= lastIndex) selectedEnergy += energy;
  }
  return totalEnergy > 0 ? selectedEnergy / totalEnergy : 0;
}

function signChangeCount(profile, threshold = 0.05) {
  let previousSign = 0;
  let changes = 0;
  for (const value of profile) {
    if (Math.abs(value) < threshold) continue;
    const sign = Math.sign(value);
    if (previousSign && sign !== previousSign) changes += 1;
    previousSign = sign;
  }
  return changes;
}

function maxAbs(values, firstIndex = 0, lastIndex = values.length - 1) {
  let maxValue = 0;
  for (let i = firstIndex; i <= lastIndex; i += 1) maxValue = Math.max(maxValue, Math.abs(values[i]));
  return maxValue;
}

function validateHomogeneousMedium(solver) {
  const k0Cells = (2 * Math.PI) / 20;
  const modes = solver.solveScalarModes({
    epsilonProfile: Float64Array.from({ length: 121 }, () => 4),
    k0Cells,
    modeCount: 2,
    centerIndex: 60,
    maxIterations: 160,
  });
  assertCondition(modes.length >= 2, "homogeneous medium should return at least two scalar finite-difference modes");
  assertCondition(modes[0].neff > 1.98 && modes[0].neff < 2.001, `homogeneous fundamental neff=${modes[0].neff}`);
  assertCondition(modes[0].profile[60] > 0.95, "homogeneous fundamental should be centered and positive");
  assertCondition(modes[0].profileDerivative?.length === modes[0].profile.length, "homogeneous mode should include transverse derivative samples");
  assertCondition(signChangeCount(modes[1].profile) === 1, "homogeneous first-order mode should have one transverse node");
}

function validateSlabGuide(solver) {
  const k0Cells = (2 * Math.PI) / 20;
  const epsilonProfile = Array.from({ length: 181 }, () => 1);
  for (let i = 75; i <= 105; i += 1) epsilonProfile[i] = 11.56;
  const modes = solver.solveScalarModes({
    epsilonProfile: Float64Array.from(epsilonProfile),
    k0Cells,
    modeCount: 3,
    centerIndex: 90,
    maxIterations: 160,
  });
  assertCondition(modes.length >= 3, "slab guide should return three guided scalar modes for the validation profile");
  assertCondition(modes[0].neff > 1.0 && modes[0].neff < 3.4, `slab fundamental neff=${modes[0].neff}`);
  assertCondition(energyFraction(modes[0].profile, 75, 105) > 0.98, "slab fundamental should be concentrated in the high-index core");
  assertCondition(signChangeCount(modes[0].profile) === 0, "slab fundamental should not have a transverse node");
  assertCondition(signChangeCount(modes[1].profile) === 1, "slab first-order mode should have one transverse node");
  assertCondition(Math.abs(modes[0].profileDerivative[90]) < 1e-3, "symmetric slab fundamental derivative should vanish at the guide center");
  assertCondition(maxAbs(modes[0].profileDerivative, 75, 89) > 0.02, "slab fundamental derivative should be nonzero on the upper half-core");
  assertCondition(maxAbs(modes[0].profileDerivative, 91, 105) > 0.02, "slab fundamental derivative should be nonzero on the lower half-core");
}

function main() {
  const solver = loadModeSolver();
  assertCondition(solver && typeof solver.solveScalarModes === "function", "FdtdModeSolver.solveScalarModes is missing");
  validateHomogeneousMedium(solver);
  validateSlabGuide(solver);
  console.log("Mode solver validation: PASS");
}

main();
