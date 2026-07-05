#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const jsonMode = process.argv.includes("--json");
const writeReports = process.argv.includes("--write");
const stepsPerScene = Math.max(1, Math.trunc(Number(argValue("--steps", process.env.SCENE_AUDIT_STEPS || "24"))));
const markdownOutput = path.resolve(rootDir, argValue("--out-md", "docs/SCENE_AUDIT.md"));
const jsonOutput = path.resolve(rootDir, argValue("--out-json", "docs/scene-audit-report.json"));

const catalog = JSON.parse(fs.readFileSync(path.join(rootDir, "src/runtime/data/scene-catalog.json"), "utf8"));
const matrix = JSON.parse(fs.readFileSync(path.join(rootDir, "scripts/validation-matrix.json"), "utf8"));
const catalogJs = fs.readFileSync(path.join(rootDir, "src/runtime/data/catalog.js"), "utf8");

const validationByPreset = new Map();
for (const testCase of matrix.cases) {
  if (!validationByPreset.has(testCase.preset)) validationByPreset.set(testCase.preset, []);
  validationByPreset.get(testCase.preset).push(testCase);
}

function extractPresetSet(name) {
  const match = catalogJs.match(new RegExp(`const\\s+${name}\\s*=\\s*new\\s+Set\\(\\[([\\s\\S]*?)\\]\\);`));
  if (!match) return new Set();
  return new Set(Array.from(match[1].matchAll(/"([^"]+)"/g), (item) => item[1]));
}

const analysisSets = {
  absorption: extractPresetSet("absorptionAnalysisPresets"),
  bianisotropy: extractPresetSet("bianisotropyAnalysisPresets"),
  coupled: extractPresetSet("coupledWorkflowAnalysisPresets"),
  harmonic: extractPresetSet("harmonicAnalysisPresets"),
  leakage: extractPresetSet("leakageAnalysisPresets"),
  negativeIndex: extractPresetSet("negativeIndexAnalysisPresets"),
  nonlinear: extractPresetSet("nonlinearAnalysisPresets"),
  phaseChange: extractPresetSet("phaseChangeAnalysisPresets"),
  phcBloch: extractPresetSet("phcBlochAnalysisPresets"),
  ptModal: extractPresetSet("ptModalAnalysisPresets"),
  resonator: extractPresetSet("resonatorAnalysisPresets"),
  scattering: extractPresetSet("scatteringAnalysisPresets"),
  sshBloch: extractPresetSet("sshBlochAnalysisPresets"),
  temporalFloquet: extractPresetSet("temporalFloquetAnalysisPresets"),
};

const hzRequiredPresets = new Set([
  "teTmComparison",
  "brewsterTm",
  "brewsterTeTm",
  "inPlaneDipole",
  "mzDipole",
  "microstrip",
  "chiralMedium",
  "bianisotropicMedium",
  "gyrotropicMedium",
  "sppInterface",
  "sppGrating",
  "hyperlens",
]);

const directionSweepPresets = new Set([
  "travelingModulation",
  "temporalIsolator",
  "topologyTemporalMod",
  "nonreciprocalValleyHall",
  "spaceTimeCrystal",
]);

const materialModulationPresets = new Set([
  ...analysisSets.temporalFloquet,
  "topologicalPumping",
]);

const amplitudeSweepPresets = new Set([
  "shgSlab",
  "thgSlab",
  "spmKerrPulse",
  "kerrBistableCavity",
  "saturableAbsorber",
  "allOpticalSwitch",
  "nonlinearLimiter",
  "vo2SwitchingSlab",
  "pcmMemoryCell",
]);

const frequencySweepPresets = new Set(["negativeIndexSlab", "superlensSlab", "hyperlens"]);
const gainLossSweepPresets = new Set(["ptSymmetricCoupler", "exceptionalPointCoupler"]);
const gainPresets = new Set(["nonHermitianSsh", "ptSymmetricCoupler", "exceptionalPointCoupler", "nonHermitianSkin"]);

const qualitativeCaveats = new Map([
  ["hyperlens", "Scalar 2D Hz hyperlens analogue; useful for teaching transfer trends, not a full cylindrical 3D validation."],
  ["topologicalPumping", "Qualitative Thouless-pump-like transport proxy; no eigenmode or adiabatic-cycle validation in this pass."],
  ["sppGrating", "SPP grating geometry and surface localization are validated; coupling efficiency is not a de-embedded grating-coupler metric."],
  ["superlensSlab", "Drude superlens proxy with reduced transfer observable; not a calibrated evanescent-wave transfer-function measurement."],
  ["spmKerrPulse", "Kerr SPM proxy; spectral broadening is reduced/qualitative, not a calibrated nonlinear phase-shift curve."],
  ["kerrBistableCavity", "Kerr bistability proxy; no hysteresis sweep or steady-state branch extraction is claimed."],
  ["saturableAbsorber", "Saturable-absorber route is active, but the transmission-vs-intensity curve is not calibrated in this audit."],
  ["allOpticalSwitch", "All-optical-switch layout proxy; not a calibrated extinction-ratio or switching-energy result."],
  ["nonlinearLimiter", "Nonlinear limiter proxy; needs input-output transfer validation before limiter-threshold claims."],
  ["temporalIsolator", "Temporal-isolator analogue; reduced sideband/isolation observables are not de-embedded two-port S-parameters."],
  ["syntheticFrequency", "Synthetic-frequency-dimension proxy; sideband graph intuition is shown without a calibrated frequency-lattice model."],
  ["exceptionalPointCoupler", "Exceptional-point proxy; reduced modal coalescence is checked, not a full eigenvalue/topology validation."],
  ["nonHermitianSkin", "Reduced active/lossy lattice analogue; not a non-Bloch eigenmode validation."],
  ["janusTopologicalGuide", "Hybrid Janus/topological-guide proxy; directional coupling is qualitative without protected-transport spectra."],
  ["huygensCavity", "Hybrid Huygens/cavity source workflow; not a calibrated Purcell, beta-factor, or far-field optimization."],
  ["nonreciprocalValleyHall", "Nonreciprocal Valley-Hall proxy; needs reverse-port spectra and topological invariant checks for quantitative claims."],
  ["spaceTimeCrystal", "Space-time-crystal proxy; modulation and sidebands are reduced observables, not a full band-structure validation."],
]);

function startStaticServer() {
  const mimeTypes = new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".mjs", "text/javascript; charset=utf-8"],
    [".png", "image/png"],
    [".svg", "image/svg+xml; charset=utf-8"],
    [".wasm", "application/wasm"],
    [".webp", "image/webp"],
  ]);

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/favicon.ico") {
      response.writeHead(204, { "Cache-Control": "no-store" });
      response.end();
      return;
    }
    const relPath = requestUrl.pathname === "/" ? "index.html" : decodeURIComponent(requestUrl.pathname.slice(1));
    const resolved = path.resolve(rootDir, relPath);
    if (resolved !== rootDir && !resolved.startsWith(`${rootDir}${path.sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    fs.readFile(resolved, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": mimeTypes.get(path.extname(resolved).toLowerCase()) || "application/octet-stream",
      });
      response.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function importPlaywright() {
  try {
    return await import("playwright");
  } catch (firstError) {
    const require = createRequire(import.meta.url);
    const roots = (process.env.NODE_PATH || "")
      .split(path.delimiter)
      .map((item) => item.trim())
      .filter(Boolean);
    const candidateRoots = [...roots];
    for (const root of roots) {
      const pnpmRoot = path.join(root, ".pnpm");
      if (!fs.existsSync(pnpmRoot)) continue;
      for (const entry of fs.readdirSync(pnpmRoot, { withFileTypes: true })) {
        if (entry.isDirectory() && /^playwright@/.test(entry.name)) {
          candidateRoots.push(path.join(pnpmRoot, entry.name, "node_modules"));
        }
      }
    }
    for (const root of candidateRoots) {
      try {
        return require(path.join(root, "playwright"));
      } catch {
        // Try the next candidate root.
      }
    }
    throw new Error(`Playwright is required for scene contract audits: ${firstError.message}`);
  }
}

async function launchBrowser(chromium) {
  const launchOptions = { headless: true };
  if (process.platform === "win32") launchOptions.channel = "msedge";
  try {
    return await chromium.launch(launchOptions);
  } catch (error) {
    if (!launchOptions.channel) throw error;
    return chromium.launch({ headless: true });
  }
}

async function selectPreset(page, preset) {
  await page.evaluate((nextPreset) => {
    const input = document.getElementById("presetInput");
    if (!input) throw new Error("presetInput not found");
    input.value = nextPreset;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, preset);
  await page.waitForTimeout(25);
}

function sceneHaystack(scene) {
  return `${scene.id} ${scene.title || ""} ${scene.description || ""} ${scene.groupLabel || ""}`.toLowerCase();
}

function inferContract(scene) {
  const text = sceneHaystack(scene);
  const id = scene.id;
  const expected = {
    source: id !== "empty",
    dispersion: /\b(drude|lorentz|debye|plasma|enz|spp|plasmon|plasmonic|negative-index|negative index|superlens|hyperlens|metal)\b/.test(text),
    conductivity: /\b(conductivity|conductive|finite conductor)\b/.test(text),
    nonlinear:
      /\b(kerr|nonlinear|shg|thg|harmonic|spm|bistable|all-optical|saturable|limiter|vo2|pcm|phase-change|phase change)\b/.test(text) ||
      analysisSets.nonlinear.has(id),
    harmonic: /\b(shg|thg|chi2|chi3|second-harmonic|third-harmonic)\b/.test(text) || analysisSets.harmonic.has(id),
    phaseChange: /\b(vo2|pcm|phase-change|phase change|memory cell)\b/.test(text) || analysisSets.phaseChange.has(id),
    modulation:
      materialModulationPresets.has(id) ||
      /\b(time-varying|floquet|temporally modulated|temporal epsilon|temporal interface|temporal slab|temporal crystal|space-time|synthetic frequency|traveling modulation|topological pumping|nonreciprocal)\b/.test(text),
    gyrotropy: /\b(gyrotropic|faraday)\b/.test(text),
    bianisotropy: /\b(chiral|bianisotropic|bianisotropy)\b/.test(text) || analysisSets.bianisotropy.has(id),
    gain: gainPresets.has(id),
    fieldComponent: hzRequiredPresets.has(id) ? "hz" : null,
    sweepMode: null,
  };

  if (analysisSets.phcBloch.has(id)) expected.sweepMode = "blochK";
  if (frequencySweepPresets.has(id)) expected.sweepMode = "frequency";
  if (amplitudeSweepPresets.has(id)) expected.sweepMode = "amplitude";
  if (directionSweepPresets.has(id)) expected.sweepMode = "direction";
  if (gainLossSweepPresets.has(id)) expected.sweepMode = "gainLoss";

  const contractTags = [];
  if (expected.fieldComponent) contractTags.push(`${expected.fieldComponent.toUpperCase()} polarization`);
  if (expected.dispersion) contractTags.push("dispersive material");
  if (expected.conductivity) contractTags.push("conductive material");
  if (expected.nonlinear) contractTags.push("nonlinear material");
  if (expected.harmonic) contractTags.push("harmonic conversion");
  if (expected.modulation) contractTags.push("time modulation");
  if (expected.gyrotropy) contractTags.push("gyrotropy");
  if (expected.bianisotropy) contractTags.push("bianisotropy");
  if (expected.gain) contractTags.push("gain/loss");
  if (expected.sweepMode) contractTags.push(`${expected.sweepMode} sweep`);
  if (contractTags.length === 0) contractTags.push("static Maxwell/FDTD scene");

  return {
    expected,
    contractTags,
    qualitativeCaveat:
      qualitativeCaveats.get(id) ||
      (/\b(proxy|analogue|qualitative|reduced)\b/.test(text)
        ? "Description frames the scene as qualitative/reduced/proxy; avoid quantitative claims without extra validation."
        : ""),
  };
}

function countStatus(rows) {
  return rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {
    PASS: 0,
    VALIDATION_GAP: 0,
    WARN: 0,
    FIX_REQUIRED: 0,
  });
}

function isExecutableValidationCase(testCase) {
  return Boolean(testCase.browserSmoke || testCase.acceptance?.script);
}

function proxyValidationCaveat(cases) {
  const proxyCases = cases.filter((testCase) => {
    const text = `${testCase.id} ${(testCase.checks || []).join(" ")} ${testCase.rationale || ""}`.toLowerCase();
    return ["proxy", "reduced", "qualitative", "analogue"].some((marker) => text.includes(marker));
  });
  if (proxyCases.length === 0) return "";
  const ids = proxyCases.map((testCase) => testCase.id).slice(0, 2).join(", ");
  const suffix = proxyCases.length > 2 ? ", ..." : "";
  return `Executable validation is reduced/proxy (${ids}${suffix}); suitable for bounded teaching use, not calibrated device claims without stronger behavioral or quantitative validation.`;
}

function evaluateScene(scene, contract, runtime) {
  const blockers = [];
  const warnings = [];
  const gaps = [];
  const state = runtime.state;
  const counts = runtime.counts;
  const finite = runtime.finite;
  const expected = contract.expected;
  const cases = validationByPreset.get(scene.id) || [];

  if (state.preset !== scene.id) blockers.push(`preset mismatch: state=${state.preset}`);
  if (expected.source && runtime.sources.length === 0) blockers.push("no source configured");
  if (!expected.source && runtime.sources.length !== 0) blockers.push("empty scene has sources");
  for (const [index, source] of runtime.sources.entries()) {
    if (!source.finite) blockers.push(`source ${index + 1} has non-finite parameter`);
    if (!source.insidePlacement) blockers.push(`source ${index + 1} is outside placement bounds`);
  }
  if (runtime.uiHasNonFiniteText) blockers.push("UI contains NaN, Infinity, or undefined");
  if (runtime.after.diverged) blockers.push("simulation diverged");
  if (!Number.isFinite(runtime.after.energy)) blockers.push("energy is non-finite");
  if (!Number.isFinite(runtime.after.maxField)) blockers.push("max field is non-finite");

  for (const [name, stats] of Object.entries(finite.fields)) {
    if (stats.nonFinite > 0) blockers.push(`${name} has ${stats.nonFinite} non-finite field value(s)`);
  }
  for (const [name, stats] of Object.entries(finite.materials)) {
    if (stats.nonFinite > 0) blockers.push(`${name} has ${stats.nonFinite} non-finite material value(s)`);
  }

  if (expected.fieldComponent && state.fieldComponent !== expected.fieldComponent) {
    blockers.push(`expected ${expected.fieldComponent} solver, got ${state.fieldComponent}`);
  }
  if (expected.dispersion && !state.materialDispersionEnabled && counts.dispersiveCells === 0) {
    blockers.push("expected dispersive material, but no ADE/dispersive cells are active");
  }
  if (expected.conductivity && !state.materialConductivityEnabled && counts.conductiveCells === 0) {
    blockers.push("expected conductivity, but no conductive cells are active");
  }
  if (expected.nonlinear && !state.materialNonlinearEnabled && !state.materialHarmonicEnabled && !state.materialPhaseChangeEnabled && !state.materialSaturableGainEnabled && counts.nonlinearCells === 0) {
    blockers.push("expected nonlinear/active response, but no nonlinear or active material is enabled");
  }
  if (expected.harmonic && !state.materialHarmonicEnabled) {
    blockers.push("expected harmonic conversion, but harmonic material flag is off");
  }
  if (expected.phaseChange && !state.materialPhaseChangeEnabled && counts.phaseChangeCells === 0) {
    blockers.push("expected phase-change dynamics, but no phase-change cells are active");
  }
  if (expected.modulation && !state.materialModulationEnabled && counts.modulatedCells === 0) {
    blockers.push("expected time modulation, but no modulated cells are active");
  }
  if (expected.gyrotropy && !state.materialGyrotropyEnabled && counts.gyrotropicCells === 0) {
    blockers.push("expected gyrotropy, but no gyrotropic cells are active");
  }
  if (expected.bianisotropy && !state.materialBianisotropyEnabled && counts.bianisotropicCells === 0) {
    blockers.push("expected bianisotropy, but no bianisotropic cells are active");
  }
  if (expected.gain && !state.materialSaturableGainEnabled && counts.gainCells === 0) {
    blockers.push("expected active gain/loss material, but gain-limited flag is off");
  }
  if (expected.sweepMode && state.sweepMode !== expected.sweepMode) {
    blockers.push(`expected ${expected.sweepMode} sweep, got ${state.sweepMode}`);
  }

  if (contract.qualitativeCaveat) warnings.push(contract.qualitativeCaveat);
  else {
    const proxyCaveat = proxyValidationCaveat(cases);
    if (proxyCaveat) warnings.push(proxyCaveat);
  }
  const executableCases = cases.filter(isExecutableValidationCase);
  if (cases.length === 0 && scene.id !== "empty") {
    gaps.push("no validation-matrix case covers this preset");
  } else if (cases.length > 0 && executableCases.length === 0) {
    gaps.push("validation-matrix entry is tracking-only; no executable browser or script case covers this preset");
  }

  const status = blockers.length > 0 ? "FIX_REQUIRED" : warnings.length > 0 ? "WARN" : gaps.length > 0 ? "VALIDATION_GAP" : "PASS";
  return {
    status,
    blockers,
    warnings,
    gaps,
    validationCases: cases.map((testCase) => `${testCase.id}:${testCase.priority}/${testCase.profile}`),
  };
}

async function auditScene(page, scene) {
  await selectPreset(page, scene.id);
  return page.evaluate(
    async ({ sceneId, stepCount }) => {
      const countWhere = (array, predicate) => {
        if (!array || typeof array.length !== "number") return 0;
        let count = 0;
        for (let i = 0; i < array.length; i += 1) {
          if (predicate(array[i])) count += 1;
        }
        return count;
      };
      const finiteStats = (array) => {
        if (!array || typeof array.length !== "number") return { maxAbs: 0, nonFinite: 0 };
        let maxAbs = 0;
        let nonFinite = 0;
        for (let i = 0; i < array.length; i += 1) {
          const value = Number(array[i]);
          if (!Number.isFinite(value)) {
            nonFinite += 1;
            continue;
          }
          maxAbs = Math.max(maxAbs, Math.abs(value));
        }
        return { maxAbs, nonFinite };
      };
      const countNonZero = (array, threshold = 0) => countWhere(array, (value) => Math.abs(Number(value) || 0) > threshold);

      state.running = false;
      sim.resetDiagnostics?.();
      sim.measure?.();
      const beforeTime = sim.time || 0;
      const t0 = performance.now();
      for (let step = 0; step < stepCount; step += 1) {
        sim.step();
      }
      sim.measure?.();
      const elapsedMs = performance.now() - t0;

      const sourceMinX = sim.sourcePlacementMinX();
      const sourceMaxX = sim.sourcePlacementMaxX();
      const sourceMinY = sim.sourcePlacementMinY();
      const sourceMaxY = sim.sourcePlacementMaxY();
      const sources = (state.sources || []).map((source) => {
        const x = sim.sourceXCell(source);
        const y = sim.sourceYCell(source);
        return {
          type: source.type,
          shape: source.shape,
          x,
          y,
          xLambda: source.xLambda,
          yLambda: source.yLambda,
          angleDeg: source.angleDeg,
          frequency: source.frequency,
          amplitude: source.amplitude,
          finite:
            Number.isFinite(Number(source.xLambda)) &&
            Number.isFinite(Number(source.yLambda)) &&
            Number.isFinite(Number(source.frequency)) &&
            Number.isFinite(Number(source.amplitude)),
          insidePlacement: x >= sourceMinX && x <= sourceMaxX && y >= sourceMinY && y <= sourceMaxY,
        };
      });

      return {
        state: {
          preset: state.preset,
          fieldComponent: state.fieldComponent,
          fieldDisplay: state.fieldDisplay,
          viewMode: state.viewMode,
          analysisEnabled: state.analysisEnabled,
          analysisSampleEvery: state.analysisSampleEvery,
          sweepMode: state.sweepMode,
          sweepStart: state.sweepStart,
          sweepEnd: state.sweepEnd,
          sweepSamples: state.sweepSamples,
          sweepSteps: state.sweepSteps,
          materialModulationEnabled: state.materialModulationEnabled,
          materialNonlinearEnabled: state.materialNonlinearEnabled,
          materialHarmonicEnabled: state.materialHarmonicEnabled,
          materialDispersionEnabled: state.materialDispersionEnabled,
          materialConductivityEnabled: state.materialConductivityEnabled,
          materialSaturableGainEnabled: state.materialSaturableGainEnabled,
          materialPhaseChangeEnabled: state.materialPhaseChangeEnabled,
          materialGyrotropyEnabled: state.materialGyrotropyEnabled,
          materialBianisotropyEnabled: state.materialBianisotropyEnabled,
          materialFullVectorBianisotropyEnabled: state.materialFullVectorBianisotropyEnabled,
        },
        after: {
          time: sim.time || 0,
          advancedSteps: (sim.time || 0) - beforeTime,
          elapsedMs,
          engine: sim.engineLabel?.() || "",
          maxField: Number(sim.lastMaxField) || 0,
          energy: Number(sim.lastEnergy) || 0,
          diverged: Boolean(sim.diverged),
          renormalizedCount: sim.renormalizedCount || 0,
          analysisSamples: sim.analysisSamples || 0,
        },
        sources,
        counts: {
          materialCells: countNonZero(sim.material),
          pecCells: countWhere(sim.material, (value) => value === 2),
          dielectricCells: countWhere(sim.material, (value) => value === 4),
          dispersiveCells: countNonZero(sim.dispersiveMaterial) + countNonZero(sim.muDispersiveMaterial),
          conductiveCells: countNonZero(sim.conductivity, 1e-9) + countNonZero(sim.conductivityY, 1e-9),
          modulatedCells: countNonZero(sim.modulatedMaterial),
          nonlinearCells: countNonZero(sim.nonlinearMaterial),
          phaseChangeCells: countNonZero(sim.phaseChangeMaterial),
          gyrotropicCells: countNonZero(sim.gyrotropicMaterial),
          bianisotropicCells: countNonZero(sim.bianisotropicMaterial),
          gainCells: countWhere(sim.loss, (value) => Number(value) < 0) + countWhere(sim.lossY, (value) => Number(value) < 0),
        },
        finite: {
          fields: {
            ez: finiteStats(sim.ez),
            hz: finiteStats(sim.hz),
            hx: finiteStats(sim.hx),
            hy: finiteStats(sim.hy),
            ex: finiteStats(sim.ex),
            ey: finiteStats(sim.ey),
          },
          materials: {
            eps: finiteStats(sim.eps),
            epsY: finiteStats(sim.epsY),
            loss: finiteStats(sim.loss),
            lossY: finiteStats(sim.lossY),
            mu: finiteStats(sim.mu),
            muY: finiteStats(sim.muY),
          },
        },
        uiHasNonFiniteText: /\b(NaN|Infinity|undefined)\b/.test(document.body?.innerText || ""),
      };
    },
    { sceneId: scene.id, stepCount: stepsPerScene },
  );
}

function gitShortHead() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: rootDir,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) return "unknown";
  const head = result.stdout.trim();
  const status = spawnSync("git", ["status", "--short"], {
    cwd: rootDir,
    encoding: "utf8",
    windowsHide: true,
  });
  return status.status === 0 && status.stdout.trim() ? `${head}+working-tree` : head;
}

function escapeCell(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function compactIssueList(row) {
  const issues = [...row.blockers, ...row.warnings, ...row.gaps];
  return issues.length > 0 ? issues.join("; ") : "OK";
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Scene Physics Audit");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Git commit: ${report.gitCommit}`);
  lines.push(`Scenes audited: ${report.sceneCount}`);
  lines.push(`Steps per scene: ${report.stepsPerScene}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Status | Count | Meaning |");
  lines.push("| --- | ---: | --- |");
  lines.push(`| PASS | ${report.summary.PASS || 0} | Configured contract/runtime checks pass and no scene-level caveat is attached. |`);
  lines.push(`| VALIDATION_GAP | ${report.summary.VALIDATION_GAP || 0} | Scene runs and matches its contract, but lacks an executable dedicated validation case. |`);
  lines.push(`| WARN | ${report.summary.WARN || 0} | Scene runs, but has a documented teaching/modeling caveat. |`);
  lines.push(`| FIX_REQUIRED | ${report.summary.FIX_REQUIRED || 0} | Scene violates its inferred physical or runtime contract. |`);
  lines.push("");
  lines.push("## Blocking Findings");
  lines.push("");
  const blocking = report.rows.filter((row) => row.status === "FIX_REQUIRED");
  if (blocking.length === 0) {
    lines.push("No `FIX_REQUIRED` scenes were found in this pass.");
  } else {
    for (const row of blocking) {
      lines.push(`- \`${row.id}\` (${row.title}): ${row.blockers.join("; ")}`);
    }
  }
  lines.push("");
  lines.push("## Full Scene Table");
  lines.push("");
  lines.push("| # | Scene | Group | Status | Contract | Runtime | Validation | Notes |");
  lines.push("| ---: | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of report.rows) {
    const runtime = `${row.runtime.engine || "unknown"}, ${row.runtime.advancedSteps} steps, E=${Number(row.runtime.energy).toExponential(2)}`;
    const validation = row.validationCases.length > 0 ? row.validationCases.join(", ") : "none";
    lines.push(
      `| ${row.index ?? ""} | \`${escapeCell(row.id)}\` ${escapeCell(row.title)} | ${escapeCell(row.groupLabel)} | ${row.status} | ${escapeCell(row.contractTags.join(", "))} | ${escapeCell(runtime)} | ${escapeCell(validation)} | ${escapeCell(compactIssueList(row))} |`,
    );
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This audit checks whether each example is educationally coherent and runnable, not whether it is publication-grade.");
  lines.push("- `WARN` scenes are runnable, but carry a teaching/modeling caveat, reduced/proxy observable, or missing calibrated reference for stronger claims.");
  lines.push("- `VALIDATION_GAP` marks a scene that still needs an executable targeted metric before stronger claims are made.");
  lines.push("- Use `scripts/audit-scene-contracts.mjs --write` to regenerate this report after preset changes.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const server = await startStaticServer();
  const port = server.address().port;
  const { chromium } = await importPlaywright();
  const browser = await launchBrowser(chromium);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => typeof state !== "undefined" && typeof sim !== "undefined" && document.getElementById("presetInput"));

  const rows = [];
  for (const scene of catalog.scenes) {
    const contract = inferContract(scene);
    const runtime = await auditScene(page, scene);
    const evaluation = evaluateScene(scene, contract, runtime);
    rows.push({
      id: scene.id,
      index: scene.index ?? "",
      title: scene.title || "",
      groupId: scene.groupId || "",
      groupLabel: scene.groupLabel || "",
      description: scene.description || "",
      status: evaluation.status,
      contractTags: contract.contractTags,
      validationCases: evaluation.validationCases,
      blockers: evaluation.blockers,
      warnings: evaluation.warnings,
      gaps: evaluation.gaps,
      runtime: {
        fieldComponent: runtime.state.fieldComponent,
        viewMode: runtime.state.viewMode,
        sweepMode: runtime.state.sweepMode,
        engine: runtime.after.engine,
        advancedSteps: runtime.after.advancedSteps,
        maxField: runtime.after.maxField,
        energy: runtime.after.energy,
        analysisSamples: runtime.after.analysisSamples,
        materialCells: runtime.counts.materialCells,
        dispersiveCells: runtime.counts.dispersiveCells,
        modulatedCells: runtime.counts.modulatedCells,
        nonlinearCells: runtime.counts.nonlinearCells,
        sourceCount: runtime.sources.length,
      },
    });
  }

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  const report = {
    generatedAt: new Date().toISOString(),
    gitCommit: gitShortHead(),
    stepsPerScene,
    sceneCount: rows.length,
    summary: countStatus(rows),
    consoleErrors,
    pageErrors,
    rows,
  };
  report.status = rows.some((row) => row.status === "FIX_REQUIRED") || consoleErrors.length > 0 || pageErrors.length > 0 ? "WARN" : "PASS";

  if (writeReports) {
    fs.mkdirSync(path.dirname(markdownOutput), { recursive: true });
    fs.writeFileSync(markdownOutput, renderMarkdown(report));
    fs.writeFileSync(jsonOutput, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      JSON.stringify(
        {
          status: report.status,
          scenes: report.sceneCount,
          stepsPerScene: report.stepsPerScene,
          summary: report.summary,
          consoleErrors: report.consoleErrors.length,
          pageErrors: report.pageErrors.length,
          markdown: writeReports ? path.relative(rootDir, markdownOutput).replace(/\\/g, "/") : null,
          json: writeReports ? path.relative(rootDir, jsonOutput).replace(/\\/g, "/") : null,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
