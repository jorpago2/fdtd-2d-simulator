#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const matrix = JSON.parse(fs.readFileSync(path.join(__dirname, "validation-matrix.json"), "utf8"));
const mode = process.argv.includes("--physics") ? "physics" : "smoke";
const smokeCases = matrix.cases.filter(
  (testCase) =>
    testCase.browserSmoke &&
    testCase.priority === "P0" &&
    (mode === "physics" ? testCase.profile === "physics" : testCase.profile === "smoke"),
);
const report = {
  status: "PASS",
  mode,
  cases: [],
  consoleErrors: [],
  pageErrors: [],
  performance: {},
};

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".wasm": "application/wasm",
    ".png": "image/png",
  }[ext] || "application/octet-stream";
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/favicon.ico") {
      res.writeHead(204, { "Cache-Control": "no-store" });
      res.end();
      return;
    }
    const relPath = requestUrl.pathname === "/" ? "index.html" : decodeURIComponent(requestUrl.pathname.slice(1));
    const resolved = path.resolve(rootDir, relPath);
    if (!resolved.startsWith(rootDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(resolved, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": mimeType(resolved),
        "Cache-Control": "no-store",
      });
      res.end(data);
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
        // Try the next NODE_PATH entry.
      }
    }
    console.error("Playwright is required for browser smoke tests.");
    console.error("Run: npm install && npx playwright install chromium");
    console.error(`Import error: ${firstError.message}`);
    process.exit(2);
  }
}

async function launchBrowser(chromium) {
  const launchOptions = { headless: true };
  if (process.platform === "win32") launchOptions.channel = "msedge";
  try {
    return await chromium.launch(launchOptions);
  } catch (channelError) {
    if (!launchOptions.channel) throw channelError;
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
  await page.waitForTimeout(40);
}

async function stepSimulation(page, steps) {
  const elapsed = await page.evaluate(async (stepCount) => {
    const button = document.getElementById("stepBtn");
    const t0 = performance.now();
    for (let i = 0; i < stepCount; i += 1) {
      button.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return performance.now() - t0;
  }, steps);
  return elapsed;
}

function parseFiniteUiNumber(text) {
  const normalized = String(text || "").trim();
  if (normalized === "overflow") return false;
  const value = Number(normalized.replace(/[^\deE.+-]/g, ""));
  return Number.isFinite(value);
}

async function simulationSnapshot(page) {
  return page.evaluate(() => {
    const readNumber = (id) => {
      const text = document.getElementById(id)?.textContent || "";
      const value = Number(String(text).replace(/[^\deE.+-]/g, ""));
      return Number.isFinite(value) ? value : null;
    };
    const runtime = typeof sim !== "undefined" ? sim : null;
    return {
      time: Number.isFinite(runtime?.time) ? runtime.time : readNumber("stepCounter"),
      maxField: Number.isFinite(runtime?.lastMax) ? runtime.lastMax : readNumber("maxField"),
      energy: Number.isFinite(runtime?.lastEnergy) ? runtime.lastEnergy : readNumber("energyValue"),
    };
  });
}

async function runSmokeCase(page, testCase) {
  const steps = matrix.profiles[testCase.profile]?.steps ?? 8;
  const startedAt = Date.now();
  await selectPreset(page, testCase.preset);
  const before = await simulationSnapshot(page);
  const elapsedMs = await stepSimulation(page, steps);
  const after = await simulationSnapshot(page);
  const bodyText = await page.locator("body").innerText();
  const stabilityMedia = await page.textContent("#stabilityMediaValue");
  const status = {
    id: testCase.id,
    preset: testCase.preset,
    priority: testCase.priority,
    steps,
    elapsedMs: Number(elapsedMs.toFixed(1)),
    msPerStep: Number((elapsedMs / Math.max(1, steps)).toFixed(2)),
    beforeStep: before.time,
    afterStep: after.time,
    maxField: after.maxField,
    energy: after.energy,
    stabilityMedia,
    passed: true,
    failures: [],
  };

  if (Number(after.time) <= Number(before.time)) status.failures.push("step counter did not advance");
  if (!Number.isFinite(Number(after.maxField)) && !parseFiniteUiNumber(after.maxField)) status.failures.push("max field is non-finite");
  if (!Number.isFinite(Number(after.energy)) && !parseFiniteUiNumber(after.energy)) status.failures.push("energy is non-finite");
  if (/\b(NaN|Infinity|undefined)\b/.test(bodyText)) status.failures.push("UI contains non-finite or undefined text");
  if (testCase.acceptance?.requiresActiveMediaLabel && !String(stabilityMedia).includes(testCase.acceptance.requiresActiveMediaLabel)) {
    status.failures.push(`stability media does not include ${testCase.acceptance.requiresActiveMediaLabel}`);
  }
  const budget = matrix.profiles[testCase.profile]?.maxMsPerStep;
  if (budget && status.msPerStep > budget) status.failures.push(`step cost ${status.msPerStep} ms exceeds budget ${budget} ms`);

  status.durationMs = Date.now() - startedAt;
  status.passed = status.failures.length === 0;
  return status;
}

async function runReproducibilitySmoke(page) {
  const snapshot = await page.evaluate(() => exportSceneState({ includeMaterials: true }));
  const passed =
    snapshot?.kind === "fdtd-2d-scene" &&
    Number.isInteger(snapshot?.grid?.nx) &&
    Number.isInteger(snapshot?.grid?.ny) &&
    Array.isArray(snapshot?.materials);
  return {
    id: "json_reproducibility",
    preset: "current",
    priority: "P1",
    passed,
    grid: snapshot?.grid,
    materialCells: snapshot?.materials?.length ?? null,
    failures: passed ? [] : ["scene snapshot was not serializable"],
  };
}

async function runCanvasActionMenuSmoke(page) {
  const status = await page.evaluate(() => {
    const toggle = document.getElementById("canvasActionToggle");
    const menu = document.getElementById("canvasActionMenu");
    const stage = document.querySelector(".stage");
    if (!toggle || !menu || !stage) {
      return { opened: false, expanded: null, menuDisplay: "", stageOpen: false };
    }
    toggle.click();
    const style = getComputedStyle(menu);
    return {
      opened: stage.classList.contains("canvas-actions-open") && style.display !== "none",
      expanded: toggle.getAttribute("aria-expanded"),
      menuDisplay: style.display,
      stageOpen: stage.classList.contains("canvas-actions-open"),
    };
  });
  const failures = [];
  if (!status.opened) failures.push("canvas action menu did not open from the toolbar toggle");
  if (status.expanded !== "true") failures.push("canvas action toggle did not report aria-expanded=true");
  return {
    id: "canvas_action_menu_toggle",
    preset: "current",
    priority: "P1",
    ...status,
    passed: failures.length === 0,
    failures,
  };
}

async function runBrushDependentParamsSmoke(page) {
  await selectPreset(page, "planeWaveAir");
  const status = await page.evaluate(() => {
    const brushMenu = document.getElementById("brushMenu");
    if (brushMenu) brushMenu.hidden = false;
    const isRendered = (control) => {
      if (!control) return false;
      const style = getComputedStyle(control);
      const rect = control.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const dependentSelectors = [
      ".brush-anisotropic-params",
      ".gyrotropy-params",
      ".bianisotropy-params",
      ".modulation-params",
      ".nonlinear-params",
      ".harmonic-params",
      ".phase-change-params",
      ".conductivity-params",
      ".saturable-gain-params",
    ];
    const allHidden = (selector) =>
      Array.from(document.querySelectorAll(selector)).every((control) => control.hidden && !isRendered(control));
    const allVisible = (selector) =>
      Array.from(document.querySelectorAll(selector)).every((control) => !control.hidden && isRendered(control));

    state.brush = "custom";
    Object.assign(state, {
      customAnisotropic: false,
      dispersionModel: "none",
      materialDispersionEnabled: false,
      materialBianisotropyEnabled: false,
      materialConductivityEnabled: false,
      materialGyrotropyEnabled: false,
      materialHarmonicEnabled: false,
      materialModulationEnabled: false,
      materialNonlinearEnabled: false,
      materialPhaseChangeEnabled: false,
      materialSaturableGainEnabled: false,
    });
    updateControlText();
    const hiddenWhenOff = dependentSelectors.every(allHidden);
    const modulationPhaseControl = document.getElementById("modulationPhaseInput")?.closest("label");
    const modulationPhaseHiddenWhenOff = modulationPhaseControl?.hidden === true && !isRendered(modulationPhaseControl);
    const dispersionHiddenWhenNone = allHidden(".dispersion-params");
    const materialWarning = document.getElementById("materialWarning");
    const emptyWarningHidden = materialWarning?.hidden === true && !isRendered(materialWarning);

    Object.assign(state, {
      customAnisotropic: true,
      dispersionModel: "lorentz",
      materialConductivityEnabled: true,
      materialGyrotropyEnabled: true,
      materialModulationEnabled: true,
    });
    updateControlText();
    const gyrotropyVisibleWhenOn = allVisible(".gyrotropy-params");
    const modulationVisibleWhenOn = allVisible(".modulation-params");
    const visibleModulationPhaseControl = document.getElementById("modulationPhaseInput")?.closest("label");
    const modulationPhaseVisibleWhenOn = visibleModulationPhaseControl?.hidden === false && isRendered(visibleModulationPhaseControl);
    const conductivityVisibleWhenOn = allVisible(".conductivity-params");
    const conductivityYControl = document.getElementById("conductivitySigmaYControl");
    const conductivityYVisibleWhenAnisotropic = conductivityYControl?.hidden === false && isRendered(conductivityYControl);
    const lorentzFieldsVisible =
      document.getElementById("dispersionGammaControl")?.hidden === false &&
      isRendered(document.getElementById("dispersionGammaControl")) &&
      document.getElementById("dispersionOmega0Control")?.hidden === false &&
      isRendered(document.getElementById("dispersionOmega0Control")) &&
      document.getElementById("dispersionDeltaEpsControl")?.hidden === false &&
      isRendered(document.getElementById("dispersionDeltaEpsControl"));
    const unrelatedDispersionFieldsHidden =
      document.getElementById("dispersionOmegaPControl")?.hidden === true &&
      !isRendered(document.getElementById("dispersionOmegaPControl")) &&
      document.getElementById("dispersionTauControl")?.hidden === true &&
      !isRendered(document.getElementById("dispersionTauControl"));

    state.brush = "pec";
    updateControlText();
    const hiddenWhenNonCustom = dependentSelectors.every(allHidden) && allHidden(".dispersion-params");

    return {
      hiddenWhenOff,
      modulationPhaseHiddenWhenOff,
      dispersionHiddenWhenNone,
      emptyWarningHidden,
      gyrotropyVisibleWhenOn,
      modulationVisibleWhenOn,
      modulationPhaseVisibleWhenOn,
      conductivityVisibleWhenOn,
      conductivityYVisibleWhenAnisotropic,
      lorentzFieldsVisible,
      unrelatedDispersionFieldsHidden,
      hiddenWhenNonCustom,
    };
  });
  const failures = [];
  if (!status.hiddenWhenOff) failures.push("dependent draw parameter groups remain visible when disabled");
  if (!status.modulationPhaseHiddenWhenOff) failures.push("modulation phase remains visible when modulation is disabled");
  if (!status.dispersionHiddenWhenNone) failures.push("dispersion parameter rows remain visible for the None model");
  if (!status.emptyWarningHidden) failures.push("empty material warning output remains visible");
  if (!status.gyrotropyVisibleWhenOn) failures.push("gyrotropy parameters do not appear when gyrotropy is enabled");
  if (!status.modulationVisibleWhenOn || !status.modulationPhaseVisibleWhenOn) {
    failures.push("modulation parameters do not appear when modulation is enabled");
  }
  if (!status.conductivityVisibleWhenOn || !status.conductivityYVisibleWhenAnisotropic) {
    failures.push("conductivity parameters do not appear for an enabled anisotropic material");
  }
  if (!status.lorentzFieldsVisible || !status.unrelatedDispersionFieldsHidden) {
    failures.push("Lorentz dispersion does not show exactly its expected parameter fields");
  }
  if (!status.hiddenWhenNonCustom) failures.push("dependent draw parameters remain visible for non-custom brushes");
  return {
    id: "brush_dependent_params_visibility",
    preset: "current",
    priority: "P1",
    ...status,
    passed: failures.length === 0,
    failures,
  };
}

async function splitStorageSnapshot(page) {
  return page.evaluate(() => {
    const maxAbs = (array) => {
      let max = 0;
      let nonFinite = 0;
      for (let i = 0; i < array.length; i += 1) {
        const value = array[i];
        if (!Number.isFinite(value)) {
          nonFinite += 1;
          continue;
        }
        max = Math.max(max, Math.abs(value));
      }
      return { max, nonFinite };
    };
    return {
      time: sim.time,
      sourceCount: state.sources.length,
      retiringSourceCount: Array.isArray(state.retiringSources) ? state.retiringSources.length : 0,
      engine: sim.engineLabel(),
      diverged: Boolean(sim.lastDiverged),
      renormalizedCount: sim.renormalizedCount,
      scalar: maxAbs(sim.ez),
      splitX: maxAbs(sim.ezx),
      splitY: maxAbs(sim.ezy),
      transverseX: maxAbs(sim.hx),
      transverseY: maxAbs(sim.hy),
    };
  });
}

async function runSourceMutationStability(page) {
  await selectPreset(page, "poyntingPlaneWave");
  await page.evaluate((steps) => {
    for (let i = 0; i < steps; i += 1) sim.step();
    sim.measure();
  }, 480);
  const beforeDelete = await splitStorageSnapshot(page);
  await page.evaluate(() => {
    const sourceId = state.sources[0]?.id;
    if (typeof deleteSource === "function" && sourceId != null) deleteSource(sourceId);
    else state.sources.splice(0, state.sources.length);
    simulationEffects.commitSourceMutation({ render: false });
  });
  const afterDelete = await splitStorageSnapshot(page);
  await page.evaluate((steps) => {
    for (let i = 0; i < steps; i += 1) sim.step();
    sim.measure();
  }, 480);
  const afterRun = await splitStorageSnapshot(page);
  const failures = [];
  const snapshots = [
    ["before delete", beforeDelete],
    ["after delete", afterDelete],
    ["after run", afterRun],
  ];
  for (const [label, snapshot] of snapshots) {
    const nonFinite =
      snapshot.scalar.nonFinite +
      snapshot.splitX.nonFinite +
      snapshot.splitY.nonFinite +
      snapshot.transverseX.nonFinite +
      snapshot.transverseY.nonFinite;
    if (nonFinite > 0) failures.push(`${label} contains ${nonFinite} non-finite field values`);
    if (snapshot.diverged) failures.push(`${label} reports divergence`);
    if (snapshot.renormalizedCount > 0) failures.push(`${label} unexpectedly renormalized fields`);
    const splitMax = Math.max(snapshot.splitX.max, snapshot.splitY.max);
    const splitLimit = Math.max(1e-6, 0.75 * snapshot.scalar.max);
    if (splitMax > splitLimit) failures.push(`${label} split scalar storage drifted (${splitMax} > ${splitLimit})`);
  }
  if (afterDelete.sourceCount !== 0 || afterRun.sourceCount !== 0) failures.push("source was not removed from the visible simulation state");
  if (afterDelete.retiringSourceCount <= 0) failures.push("deleted source did not enter the soft shutdown queue");
  if (afterRun.retiringSourceCount !== 0) failures.push("soft shutdown source was not pruned after the retirement window");
  if (afterRun.time <= beforeDelete.time) failures.push("simulation did not advance after source deletion");
  return {
    id: "source_mutation_split_stability",
    preset: "poyntingPlaneWave",
    priority: "P0",
    steps: 960,
    beforeDelete,
    afterDelete,
    afterRun,
    passed: failures.length === 0,
    failures,
  };
}

async function main() {
  const { chromium } = await importPlaywright();
  const server = await startStaticServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/index.html`;
  const browser = await launchBrowser(chromium);
  const page = await browser.newPage({ viewport: { width: 1280, height: 840 } });

  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    report.pageErrors.push(error.message);
  });

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    for (const testCase of smokeCases) {
      report.cases.push(await runSmokeCase(page, testCase));
    }
    if (mode === "physics") {
      report.cases.push(await runSourceMutationStability(page));
    }
    if (mode === "smoke") {
      report.cases.push(await runReproducibilitySmoke(page));
      report.cases.push(await runCanvasActionMenuSmoke(page));
      report.cases.push(await runBrushDependentParamsSmoke(page));
    }
  } finally {
    await browser.close();
    server.close();
  }

  const failedCases = report.cases.filter((testCase) => !testCase.passed);
  if (failedCases.length > 0 || report.consoleErrors.length > 0 || report.pageErrors.length > 0) {
    report.status = "BLOCK";
  }
  report.performance = {
    medianMsPerStep: (() => {
      const values = report.cases.filter((item) => Number.isFinite(item.msPerStep)).map((item) => item.msPerStep).sort((a, b) => a - b);
      if (values.length === 0) return null;
      return values[Math.floor(values.length / 2)];
    })(),
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.status === "PASS" ? 0 : 1);
}

main();
