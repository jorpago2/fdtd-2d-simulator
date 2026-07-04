#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_GRIDS = Object.freeze([
  { nx: 360, ny: 240 },
  { nx: 720, ny: 480 },
  { nx: 1200, ny: 800 },
]);
const RENDER_CASES = Object.freeze([
  {
    id: "field_scalar",
    label: "Field Ez",
    fieldComponent: "ez",
    viewMode: "field",
    fieldDisplay: "scalar",
    materialPart: "real",
  },
  {
    id: "field_magnitude",
    label: "Field |H|",
    fieldComponent: "ez",
    viewMode: "field",
    fieldDisplay: "magneticMag",
    materialPart: "real",
  },
  {
    id: "poynting_magnitude",
    label: "Poynting |S|",
    fieldComponent: "ez",
    viewMode: "poynting",
    fieldDisplay: "scalar",
    materialPart: "real",
  },
  {
    id: "epsilon_map",
    label: "Epsilon",
    fieldComponent: "ez",
    viewMode: "epsilon",
    fieldDisplay: "scalar",
    materialPart: "real",
  },
]);

function positiveInt(arg, prefix) {
  const value = Number(arg.slice(prefix.length));
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${prefix}${value} must be a positive integer.`);
  return value;
}

function parseGrids(value) {
  const grids = value
    .split(",")
    .map((item) => {
      const match = item.trim().match(/^(\d+)x(\d+)$/i);
      if (!match) throw new Error(`Invalid grid "${item}". Use NxM, e.g. 720x480.`);
      return { nx: Number(match[1]), ny: Number(match[2]) };
    });
  if (!grids.length) throw new Error("At least one grid is required.");
  return grids;
}

function parseCaseIds(value) {
  const ids = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const known = new Set(RENDER_CASES.map((item) => item.id));
  for (const id of ids) {
    if (!known.has(id)) {
      throw new Error(`Unknown render case "${id}". Known cases: ${Array.from(known).join(", ")}.`);
    }
  }
  return ids;
}

function parseArgs(argv) {
  const options = {
    rootDir: DEFAULT_ROOT,
    grids: DEFAULT_GRIDS,
    cases: RENDER_CASES.map((item) => item.id),
    samples: 24,
    warmup: 6,
    width: 1280,
    height: 840,
    browserChannel: process.platform === "win32" ? "msedge" : "",
    headless: true,
    includeOverlays: false,
    json: false,
  };

  for (const arg of argv) {
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--headful") {
      options.headless = false;
    } else if (arg === "--with-overlays") {
      options.includeOverlays = true;
    } else if (arg.startsWith("--root=")) {
      options.rootDir = path.resolve(process.cwd(), arg.slice("--root=".length));
    } else if (arg.startsWith("--grids=")) {
      options.grids = parseGrids(arg.slice("--grids=".length));
    } else if (arg.startsWith("--cases=")) {
      options.cases = parseCaseIds(arg.slice("--cases=".length));
    } else if (arg.startsWith("--samples=")) {
      options.samples = positiveInt(arg, "--samples=");
    } else if (arg.startsWith("--warmup=")) {
      options.warmup = positiveInt(arg, "--warmup=");
    } else if (arg.startsWith("--width=")) {
      options.width = positiveInt(arg, "--width=");
    } else if (arg.startsWith("--height=")) {
      options.height = positiveInt(arg, "--height=");
    } else if (arg.startsWith("--browser-channel=")) {
      options.browserChannel = arg.slice("--browser-channel=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

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
    ".svg": "image/svg+xml; charset=utf-8",
    ".webp": "image/webp",
  }[ext] || "application/octet-stream";
}

function startStaticServer(rootDir) {
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
    console.error("Playwright is required for render backend benchmarks.");
    console.error("Run: npm install");
    console.error(`Import error: ${firstError.message}`);
    process.exit(2);
  }
}

async function launchBrowser(chromium, options) {
  const launchOptions = { headless: options.headless };
  if (options.browserChannel) launchOptions.channel = options.browserChannel;
  try {
    return await chromium.launch(launchOptions);
  } catch (channelError) {
    if (!options.browserChannel) throw channelError;
    return chromium.launch({ headless: options.headless });
  }
}

function selectedRenderCases(options) {
  const selected = new Set(options.cases);
  return RENDER_CASES.filter((item) => selected.has(item.id));
}

async function runRenderBenchmarkCase(page, grid, renderCase, backend, options) {
  return page.evaluate(
    async ({ grid, renderCase, backend, samples, warmup, includeOverlays }) => {
      const saved = {
        running: state.running,
        preset: state.preset,
        fieldComponent: state.fieldComponent,
        viewMode: state.viewMode,
        viewProjection: state.viewProjection,
        fieldDisplay: state.fieldDisplay,
        materialPart: state.materialPart,
        autoScale: state.autoScale,
        gain: state.gain,
        fieldQuiver: state.fieldQuiver,
        materialBianisotropyEnabled: state.materialBianisotropyEnabled,
        materialFullVectorBianisotropyEnabled: state.materialFullVectorBianisotropyEnabled,
        visualLayerBoundaries: state.visualLayerBoundaries,
        visualLayerMonitors: state.visualLayerMonitors,
        visualLayerAxes: state.visualLayerAxes,
        visualLayerScale: state.visualLayerScale,
        visualLayerSources: state.visualLayerSources,
        visualLayerColorbar: state.visualLayerColorbar,
        fieldWebglRendererFailed: sim.fieldWebglRendererFailed,
      };

      const previousRecord = window.fdtdPerformance?.record || null;
      const phaseSamples = [];
      if (window.fdtdPerformance && previousRecord) {
        window.fdtdPerformance.record = (name, elapsedMs, sampleCount = 1) => {
          const perSampleMs = Number(elapsedMs) / Math.max(1, Number(sampleCount) || 1);
          if (/^render/.test(name) && Number.isFinite(perSampleMs)) phaseSamples.push({ name, ms: perSampleMs });
          previousRecord(name, elapsedMs, sampleCount);
        };
      }

      const phaseMean = (name) => {
        const values = phaseSamples.filter((sample) => sample.name === name).slice(-samples).map((sample) => sample.ms);
        if (!values.length) return null;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
      };

      try {
        state.running = false;
        state.preset = "empty";
        applySimulationGridSize(grid.nx, grid.ny, { applyPreset: true, render: false });

        state.fieldComponent = renderCase.fieldComponent;
        state.viewMode = renderCase.viewMode;
        state.viewProjection = "2d";
        state.fieldDisplay = renderCase.fieldDisplay;
        state.materialPart = renderCase.materialPart;
        state.autoScale = false;
        state.gain = 1.35;
        state.fieldQuiver = false;
        state.materialBianisotropyEnabled = false;
        state.materialFullVectorBianisotropyEnabled = false;

        if (!includeOverlays) {
          state.visualLayerBoundaries = false;
          state.visualLayerMonitors = false;
          state.visualLayerAxes = false;
          state.visualLayerScale = false;
          state.visualLayerSources = false;
          state.visualLayerColorbar = false;
        }

        sim.resetView();
        sim.resetFields();

        for (let y = 0; y < sim.ny; y += 1) {
          for (let x = 0; x < sim.nx; x += 1) {
            const i = sim.id(x, y);
            const xf = (x + 1) / sim.nx;
            const yf = (y + 1) / sim.ny;
            sim.ez[i] = Math.sin(xf * 16.5) * Math.cos(yf * 10.75) * 0.42;
            sim.hx[i] = Math.cos(xf * 12.25 + yf * 2.0) * 0.31;
            sim.hy[i] = Math.sin(yf * 18.5 - xf * 3.25) * 0.29;
            sim.material[i] = (x + 2 * y) % 37 === 0 ? 2 : (x + y) % 19 === 0 ? 4 : (x + y) % 13 === 0 ? 3 : (x + y) % 7 === 0 ? 1 : 0;
            sim.eps[i] = 1 + xf * 3.0 + yf * 0.25;
            sim.mu[i] = 1 + yf * 1.7 + xf * 0.15;
            sim.loss[i] = 0.001 + xf * 0.008;
            sim.muLoss[i] = 0.001 + yf * 0.006;
          }
        }

        sim.fieldScale = 1;
        sim.fieldLog10Scale = 0;
        sim.renormalizedCount = 0;
        sim.measure();

        if (backend === "cpu") {
          sim.fieldWebglRendererFailed = true;
        } else {
          sim.fieldWebglRendererFailed = false;
        }

        for (let i = 0; i < warmup; i += 1) sim.render();
        const elapsedSamples = [];
        for (let i = 0; i < samples; i += 1) {
          const startMs = performance.now();
          sim.render();
          elapsedSamples.push(performance.now() - startMs);
        }
        const meanRenderMs = elapsedSamples.reduce((sum, value) => sum + value, 0) / elapsedSamples.length;
        const sorted = [...elapsedSamples].sort((a, b) => a - b);
        const medianRenderMs = sorted[Math.floor(sorted.length / 2)];
        const p90RenderMs = sorted[Math.floor(sorted.length * 0.9)];
        const actualBackend = sim.lastFieldRenderBackend || "";
        const expectedBackendActive =
          backend === "cpu" ? /^Canvas2D/.test(actualBackend) : /^WebGL2/.test(actualBackend);

        return {
          backend,
          actualBackend,
          expectedBackendActive,
          caseId: renderCase.id,
          caseLabel: renderCase.label,
          nx: sim.nx,
          ny: sim.ny,
          cells: sim.n,
          samples,
          warmup,
          totalRenderMs: meanRenderMs,
          medianRenderMs,
          p90RenderMs,
          mapMs: phaseMean("renderMapMs"),
          presentMs: phaseMean("renderPresentMs"),
          overlayMs: phaseMean("renderOverlayMs"),
        };
      } finally {
        if (window.fdtdPerformance && previousRecord) window.fdtdPerformance.record = previousRecord;
        sim.fieldWebglRendererFailed = saved.fieldWebglRendererFailed;
        state.running = saved.running;
        state.preset = saved.preset;
        state.fieldComponent = saved.fieldComponent;
        state.viewMode = saved.viewMode;
        state.viewProjection = saved.viewProjection;
        state.fieldDisplay = saved.fieldDisplay;
        state.materialPart = saved.materialPart;
        state.autoScale = saved.autoScale;
        state.gain = saved.gain;
        state.fieldQuiver = saved.fieldQuiver;
        state.materialBianisotropyEnabled = saved.materialBianisotropyEnabled;
        state.materialFullVectorBianisotropyEnabled = saved.materialFullVectorBianisotropyEnabled;
        state.visualLayerBoundaries = saved.visualLayerBoundaries;
        state.visualLayerMonitors = saved.visualLayerMonitors;
        state.visualLayerAxes = saved.visualLayerAxes;
        state.visualLayerScale = saved.visualLayerScale;
        state.visualLayerSources = saved.visualLayerSources;
        state.visualLayerColorbar = saved.visualLayerColorbar;
      }
    },
    {
      grid,
      renderCase,
      backend,
      samples: options.samples,
      warmup: options.warmup,
      includeOverlays: options.includeOverlays,
    },
  );
}

function round(value, digits = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function summarizeResult(result) {
  return {
    ...result,
    totalRenderMs: round(result.totalRenderMs, 4),
    medianRenderMs: round(result.medianRenderMs, 4),
    p90RenderMs: round(result.p90RenderMs, 4),
    mapMs: round(result.mapMs, 4),
    presentMs: round(result.presentMs, 4),
    overlayMs: round(result.overlayMs, 4),
  };
}

function buildComparisons(results) {
  const comparisons = [];
  const groups = new Map();
  for (const result of results) {
    const key = `${result.nx}x${result.ny}|${result.caseId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(result);
  }
  for (const [key, group] of groups) {
    const cpu = group.find((item) => item.backend === "cpu");
    const webgl = group.find((item) => item.backend === "webgl");
    if (!cpu || !webgl) continue;
    comparisons.push({
      key,
      grid: `${cpu.nx}x${cpu.ny}`,
      caseId: cpu.caseId,
      caseLabel: cpu.caseLabel,
      totalSpeedup: round(cpu.totalRenderMs / webgl.totalRenderMs, 2),
      mapSpeedup: Number.isFinite(cpu.mapMs) && Number.isFinite(webgl.mapMs) ? round(cpu.mapMs / webgl.mapMs, 2) : null,
      cpuTotalMs: round(cpu.totalRenderMs, 4),
      webglTotalMs: round(webgl.totalRenderMs, 4),
      cpuMapMs: round(cpu.mapMs, 4),
      webglMapMs: round(webgl.mapMs, 4),
    });
  }
  return comparisons;
}

function formatTable(results, comparisons) {
  const comparisonByKey = new Map(comparisons.map((item) => [item.key, item]));
  const rows = [
    ["grid", "case", "backend", "actual", "total ms", "map ms", "present ms", "overlay ms", "speedup"],
    ...results.map((item) => {
      const comparison = comparisonByKey.get(`${item.nx}x${item.ny}|${item.caseId}`);
      return [
        `${item.nx}x${item.ny}`,
        item.caseLabel,
        item.backend.toUpperCase(),
        item.actualBackend,
        item.totalRenderMs.toFixed(4),
        item.mapMs == null ? "-" : item.mapMs.toFixed(4),
        item.presentMs == null ? "-" : item.presentMs.toFixed(4),
        item.overlayMs == null ? "-" : item.overlayMs.toFixed(4),
        item.backend === "webgl" && comparison?.totalSpeedup != null ? `${comparison.totalSpeedup}x` : "-",
      ];
    }),
  ];
  const widths = rows[0].map((_, col) => Math.max(...rows.map((row) => String(row[col]).length)));
  return rows.map((row) => row.map((cell, col) => String(cell).padEnd(widths[col])).join("  ")).join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = options.rootDir;
  if (!fs.existsSync(path.join(rootDir, "index.html"))) {
    throw new Error(`No index.html found in ${rootDir}`);
  }

  const { chromium } = await importPlaywright();
  const server = await startStaticServer(rootDir);
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/index.html?render-benchmark=${Date.now()}`;
  const browser = await launchBrowser(chromium, options);
  const page = await browser.newPage({ viewport: { width: options.width, height: options.height } });
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("404")) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    const environment = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      return {
        userAgent: navigator.userAgent,
        devicePixelRatio: window.devicePixelRatio,
        webgl2: Boolean(gl),
        webglRenderer: gl?.getParameter(gl.RENDERER) || "",
        webglVendor: gl?.getParameter(gl.VENDOR) || "",
      };
    });

    const results = [];
    for (const grid of options.grids) {
      for (const renderCase of selectedRenderCases(options)) {
        results.push(await runRenderBenchmarkCase(page, grid, renderCase, "cpu", options));
        results.push(await runRenderBenchmarkCase(page, grid, renderCase, "webgl", options));
      }
    }
    const summarizedResults = results.map(summarizeResult);
    const comparisons = buildComparisons(summarizedResults);
    const inactiveBackends = summarizedResults.filter((item) => !item.expectedBackendActive);
    const status = consoleErrors.length === 0 && pageErrors.length === 0 && inactiveBackends.length === 0 ? "PASS" : "WARN";
    const report = {
      status,
      options: {
        rootDir,
        grids: options.grids,
        cases: options.cases,
        samples: options.samples,
        warmup: options.warmup,
        viewport: { width: options.width, height: options.height },
        includeOverlays: options.includeOverlays,
      },
      environment,
      results: summarizedResults,
      comparisons,
      inactiveBackends,
      consoleErrors,
      pageErrors,
    };

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatTable(summarizedResults, comparisons));
      console.log("");
      console.log("CPU/WebGL total render speedup:");
      for (const item of comparisons) {
        console.log(`- ${item.grid} ${item.caseLabel}: ${item.totalSpeedup}x total, ${item.mapSpeedup ?? "-"}x map`);
      }
      if (status !== "PASS") {
        console.log("");
        console.log(`Status: ${status}`);
        for (const item of inactiveBackends) {
          console.log(`- ${item.backend} did not activate for ${item.nx}x${item.ny} ${item.caseLabel}: ${item.actualBackend}`);
        }
        for (const item of [...consoleErrors, ...pageErrors]) console.log(`- ${item}`);
      }
    }
    process.exitCode = status === "PASS" ? 0 : 1;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
