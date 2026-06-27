#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const matrix = JSON.parse(fs.readFileSync(path.join(__dirname, "validation-matrix.json"), "utf8"));
const smokeCases = matrix.cases.filter((testCase) => testCase.browserSmoke);
const report = {
  status: "PASS",
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
  } catch {
    console.error("Playwright is required for browser smoke tests.");
    console.error("Run: npm install && npx playwright install chromium");
    process.exit(2);
  }
}

async function selectPreset(page, preset) {
  await page.selectOption("#presetInput", preset);
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

async function runSmokeCase(page, testCase) {
  const steps = matrix.profiles[testCase.profile]?.steps ?? 8;
  const startedAt = Date.now();
  await selectPreset(page, testCase.preset);
  const beforeStep = await page.textContent("#stepCounter");
  const elapsedMs = await stepSimulation(page, steps);
  const afterStep = await page.textContent("#stepCounter");
  const maxField = await page.textContent("#maxField");
  const energy = await page.textContent("#energyValue");
  const bodyText = await page.locator("body").innerText();
  const stabilityMedia = await page.textContent("#stabilityMediaValue");
  const status = {
    id: testCase.id,
    preset: testCase.preset,
    priority: testCase.priority,
    steps,
    elapsedMs: Number(elapsedMs.toFixed(1)),
    msPerStep: Number((elapsedMs / Math.max(1, steps)).toFixed(2)),
    beforeStep,
    afterStep,
    maxField,
    energy,
    stabilityMedia,
    passed: true,
    failures: [],
  };

  if (Number(afterStep) <= Number(beforeStep)) status.failures.push("step counter did not advance");
  if (!parseFiniteUiNumber(maxField)) status.failures.push("max field is non-finite");
  if (!parseFiniteUiNumber(energy)) status.failures.push("energy is non-finite");
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
  await page.click('[data-control-tab="config"]');
  await page.click("#copySceneUrlBtn");
  await page.waitForTimeout(200);
  const statusText = await page.textContent("#reproStatus");
  const shareUrl = await page.inputValue("#shareSceneUrlOutput").catch(() => "");
  const passed = /Copied|URL generated/.test(statusText || "") || shareUrl.includes("scene=");
  return {
    id: "json_reproducibility",
    preset: "current",
    priority: "P1",
    passed,
    statusText,
    shareUrlLength: shareUrl.length,
    failures: passed ? [] : ["share URL was not copied or generated"],
  };
}

async function main() {
  const { chromium } = await importPlaywright();
  const server = await startStaticServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 840 } });

  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    report.pageErrors.push(error.message);
  });

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    for (const testCase of smokeCases.filter((item) => item.priority === "P0")) {
      report.cases.push(await runSmokeCase(page, testCase));
    }
    report.cases.push(await runReproducibilitySmoke(page));
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
