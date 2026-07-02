#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const stepsPerScene = Math.max(1, Number(process.env.SCENE_STEPS || 24));
const jsonMode = process.argv.includes("--json");

const catalog = JSON.parse(fs.readFileSync(path.join(rootDir, "js-next", "runtime", "data", "scene-catalog.json"), "utf8"));

const report = {
  status: "PASS",
  stepsPerScene,
  groups: [],
  failures: [],
  consoleErrors: [],
  pageErrors: [],
  performance: {
    totalElapsedMs: 0,
    medianMsPerStep: null,
  },
};

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml; charset=utf-8",
    ".wasm": "application/wasm",
  }[ext] || "application/octet-stream";
}

function startStaticServer() {
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
        "Content-Type": mimeType(resolved),
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
    throw new Error(`Playwright is required for scene-library validation: ${firstError.message}`);
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

function summarizeFailures(groupReports) {
  return groupReports.flatMap((group) =>
    group.scenes
      .filter((scene) => scene.failures.length > 0)
      .map((scene) => `${group.label} / ${scene.index ?? "-"} ${scene.title}: ${scene.failures.join("; ")}`),
  );
}

async function auditScene(page, scene) {
  await selectPreset(page, scene.id);
  return page.evaluate(
    ({ sceneId, expectedIndex, expectedTitle, expectedGroupLabel, stepCount }) => {
      const finiteStats = (array) => {
        if (!array || typeof array.length !== "number") return null;
        let nonFinite = 0;
        let maxAbs = 0;
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < array.length; i += 1) {
          const value = array[i];
          if (!Number.isFinite(value)) {
            nonFinite += 1;
            continue;
          }
          const abs = Math.abs(value);
          if (abs > maxAbs) maxAbs = abs;
          if (value < min) min = value;
          if (value > max) max = value;
        }
        return {
          max: max === -Infinity ? 0 : max,
          maxAbs,
          min: min === Infinity ? 0 : min,
          nonFinite,
        };
      };

      const countNonZero = (array, threshold = 0) => {
        if (!array || typeof array.length !== "number") return 0;
        let count = 0;
        for (let i = 0; i < array.length; i += 1) {
          if (Math.abs(Number(array[i]) || 0) > threshold) count += 1;
        }
        return count;
      };

      const failures = [];
      const option = document.querySelector(`#presetInput option[value="${CSS.escape(sceneId)}"]`);
      const selectedText = document.getElementById("presetInput")?.selectedOptions?.[0]?.textContent?.trim() || "";
      const optionGroupLabel = option?.parentElement?.tagName === "OPTGROUP" ? option.parentElement.label : "General";
      const minX = sim.activeInteriorMinX();
      const maxX = sim.activeInteriorMaxX();
      const minY = sim.activeInteriorMinY();
      const maxY = sim.activeInteriorMaxY();
      const sourceMinX = sim.sourcePlacementMinX();
      const sourceMaxX = sim.sourcePlacementMaxX();
      const sourceMinY = sim.sourcePlacementMinY();
      const sourceMaxY = sim.sourcePlacementMaxY();
      const sourceSummaries = (state.sources || []).map((source) => {
        const x = sim.sourceXCell(source);
        const y = sim.sourceYCell(source);
        return {
          shape: source.shape,
          type: source.type,
          x,
          y,
          xLambda: source.xLambda,
          yLambda: source.yLambda,
          insidePlacement: x >= sourceMinX && x <= sourceMaxX && y >= sourceMinY && y <= sourceMaxY,
          finite:
            Number.isFinite(Number(source.xLambda)) &&
            Number.isFinite(Number(source.yLambda)) &&
            Number.isFinite(Number(source.amplitude)) &&
            Number.isFinite(Number(source.frequency)),
        };
      });

      if (state.preset !== sceneId) failures.push(`state preset is ${state.preset}`);
      if (!option) failures.push("preset option missing from HTML");
      if (option && optionGroupLabel !== expectedGroupLabel) failures.push("HTML option group differs from catalog");
      if (sceneId !== "empty" && sourceSummaries.length === 0) failures.push("scene has no source");
      if (sceneId === "empty" && sourceSummaries.length !== 0) failures.push("empty scene unexpectedly has sources");
      if (!Number.isFinite(minX) || !Number.isFinite(maxX) || minX >= maxX) failures.push("invalid active x range");
      if (!Number.isFinite(minY) || !Number.isFinite(maxY) || minY >= maxY) failures.push("invalid active y range");
      for (const [idx, source] of sourceSummaries.entries()) {
        if (!source.finite) failures.push(`source ${idx + 1} has non-finite numeric parameters`);
        if (!source.insidePlacement) failures.push(`source ${idx + 1} is outside placement region`);
      }

      const materialArrays = {
        conductivity: finiteStats(sim.conductivity),
        conductivityY: finiteStats(sim.conductivityY),
        eps: finiteStats(sim.eps),
        epsY: finiteStats(sim.epsY),
        loss: finiteStats(sim.loss),
        lossY: finiteStats(sim.lossY),
        mu: finiteStats(sim.mu),
        muY: finiteStats(sim.muY),
      };
      for (const [name, stats] of Object.entries(materialArrays)) {
        if (stats?.nonFinite) failures.push(`${name} has ${stats.nonFinite} non-finite value(s)`);
      }

      const materialSummary = {
        bianisotropicCells: countNonZero(sim.bianisotropicMaterial),
        conductiveCells: countNonZero(sim.conductivity, 1e-9) + countNonZero(sim.conductivityY, 1e-9),
        dispersiveCells: countNonZero(sim.dispersiveMaterial) + countNonZero(sim.muDispersiveMaterial),
        gyrotropicCells: countNonZero(sim.gyrotropicMaterial),
        harmonicCells: countNonZero(sim.harmonicPrevPz) + countNonZero(sim.harmonicPrevPx) + countNonZero(sim.harmonicPrevPy),
        materialCells: countNonZero(sim.material),
        modulatedCells: countNonZero(sim.modulatedMaterial),
        nonlinearCells: countNonZero(sim.nonlinearMaterial),
        phaseChangeCells: countNonZero(sim.phaseChangeMaterial),
      };

      const beforeTime = sim.time;
      const startedAt = performance.now();
      for (let i = 0; i < stepCount; i += 1) sim.step();
      sim.measure();
      const elapsedMs = performance.now() - startedAt;
      const fieldArrays = {
        ez: finiteStats(sim.ez),
        ezx: finiteStats(sim.ezx),
        ezy: finiteStats(sim.ezy),
        hx: finiteStats(sim.hx),
        hy: finiteStats(sim.hy),
      };
      if (state.materialBianisotropyEnabled) {
        fieldArrays.dualEz = finiteStats(sim.dualEz);
        fieldArrays.dualHx = finiteStats(sim.dualHx);
        fieldArrays.dualHy = finiteStats(sim.dualHy);
      }
      for (const [name, stats] of Object.entries(fieldArrays)) {
        if (stats?.nonFinite) failures.push(`${name} has ${stats.nonFinite} non-finite field value(s)`);
      }
      if (sim.time <= beforeTime && sceneId !== "empty") failures.push("time did not advance");
      if (sim.lastDiverged) failures.push("simulation reported divergence");
      if (!Number.isFinite(sim.lastMax)) failures.push("lastMax is non-finite");
      if (!Number.isFinite(sim.lastEnergy)) failures.push("lastEnergy is non-finite");
      if (sim.renormalizedCount > 0) failures.push(`fields renormalized ${sim.renormalizedCount} time(s) during short run`);
      if (sceneId !== "empty" && sim.lastMax <= 0 && sim.lastEnergy <= 0) failures.push("short run produced no measurable field");

      return {
        id: sceneId,
        index: expectedIndex,
        title: expectedTitle,
        selectedText,
        fieldComponent: state.fieldComponent,
        materialSummary,
        msPerStep: elapsedMs / Math.max(1, stepCount),
        runtime: {
          engine: sim.engineLabel?.() || "",
          energy: sim.lastEnergy,
          lastMax: sim.lastMax,
          renormalizedCount: sim.renormalizedCount,
          time: sim.time,
        },
        sources: sourceSummaries,
        failures,
      };
    },
    {
      expectedGroupLabel: scene.groupLabel,
      expectedIndex: scene.index,
      expectedTitle: scene.title,
      sceneId: scene.id,
      stepCount: stepsPerScene,
    },
  );
}

async function main() {
  const startedAt = Date.now();
  const { chromium } = await importPlaywright();
  const server = await startStaticServer();
  const port = server.address().port;
  const browser = await launchBrowser(chromium);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    report.pageErrors.push(error.message);
  });

  try {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
    await page.waitForSelector("#presetInput", { state: "attached", timeout: 15000 });
    const sceneById = new Map(catalog.scenes.map((scene) => [scene.id, scene]));
    for (const group of catalog.groups) {
      const groupReport = {
        id: group.id,
        label: group.label,
        passed: true,
        scenes: [],
      };
      for (const sceneId of group.sceneIds) {
        const scene = sceneById.get(sceneId);
        if (!scene) {
          groupReport.scenes.push({
            id: sceneId,
            index: null,
            title: "Missing scene",
            failures: ["scene id is present in group but missing from catalog scenes"],
          });
          continue;
        }
        const sceneReport = await auditScene(page, scene);
        groupReport.scenes.push(sceneReport);
      }
      groupReport.passed = groupReport.scenes.every((scene) => scene.failures.length === 0);
      report.groups.push(groupReport);
      if (!jsonMode) {
        const status = groupReport.passed ? "PASS" : "FAIL";
        console.log(`${status}: ${group.label} (${groupReport.scenes.length} scenes)`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  report.failures = summarizeFailures(report.groups);
  report.performance.totalElapsedMs = Date.now() - startedAt;
  const stepTimes = report.groups
    .flatMap((group) => group.scenes.map((scene) => scene.msPerStep))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  report.performance.medianMsPerStep = stepTimes.length ? stepTimes[Math.floor(stepTimes.length / 2)] : null;
  if (report.failures.length > 0 || report.consoleErrors.length > 0 || report.pageErrors.length > 0) report.status = "BLOCK";

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Scene library validation: ${report.status}`);
    console.log(`Scenes: ${report.groups.reduce((sum, group) => sum + group.scenes.length, 0)}, steps/scene: ${stepsPerScene}`);
    if (report.failures.length > 0) {
      console.log("Failures:");
      for (const failure of report.failures) console.log(`- ${failure}`);
    }
    if (report.consoleErrors.length > 0) {
      console.log("Console errors:");
      for (const error of report.consoleErrors) console.log(`- ${error}`);
    }
    if (report.pageErrors.length > 0) {
      console.log("Page errors:");
      for (const error of report.pageErrors) console.log(`- ${error}`);
    }
  }
  process.exit(report.status === "PASS" ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
