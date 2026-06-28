#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const DEFAULT_GRIDS = Object.freeze([
  { nx: 180, ny: 120 },
  { nx: 360, ny: 240 },
  { nx: 720, ny: 480 },
]);

function parseArgs(argv) {
  const options = {
    grids: DEFAULT_GRIDS,
    steps: 180,
    warmupSteps: 30,
    renderSamples: 12,
    measureSamples: 24,
    preset: "empty",
    browserChannel: process.platform === "win32" ? "msedge" : "",
    headless: true,
    json: false,
  };

  for (const arg of argv) {
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--headful") {
      options.headless = false;
    } else if (arg.startsWith("--grids=")) {
      options.grids = arg
        .slice("--grids=".length)
        .split(",")
        .map((item) => {
          const match = item.trim().match(/^(\d+)x(\d+)$/i);
          if (!match) throw new Error(`Invalid grid "${item}". Use NxM, e.g. 360x240.`);
          return { nx: Number(match[1]), ny: Number(match[2]) };
        });
    } else if (arg.startsWith("--steps=")) {
      options.steps = positiveInt(arg, "--steps=");
    } else if (arg.startsWith("--warmup=")) {
      options.warmupSteps = positiveInt(arg, "--warmup=");
    } else if (arg.startsWith("--render-samples=")) {
      options.renderSamples = positiveInt(arg, "--render-samples=");
    } else if (arg.startsWith("--measure-samples=")) {
      options.measureSamples = positiveInt(arg, "--measure-samples=");
    } else if (arg.startsWith("--preset=")) {
      options.preset = arg.slice("--preset=".length).trim() || "empty";
    } else if (arg.startsWith("--browser-channel=")) {
      options.browserChannel = arg.slice("--browser-channel=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.grids.length === 0) throw new Error("At least one grid is required.");
  return options;
}

function positiveInt(arg, prefix) {
  const value = Number(arg.slice(prefix.length));
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${prefix}${value} must be a positive integer.`);
  return value;
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
    console.error("Playwright is required for browser performance benchmarks.");
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

async function runBenchmarkCase(page, grid, backend, options) {
  return page.evaluate(
    async ({ grid, backend, steps, warmupSteps, renderSamples, measureSamples, preset }) => {
      const saved = {
        running: state.running,
        preset: state.preset,
        fieldComponent: state.fieldComponent,
        viewMode: state.viewMode,
        viewProjection: state.viewProjection,
        fieldDisplay: state.fieldDisplay,
        autoScale: state.autoScale,
        fieldQuiver: state.fieldQuiver,
      };
      const savedBackend = sim.wasmBackend;

      state.running = false;
      state.preset = preset;
      state.fieldComponent = "ez";
      state.viewMode = "field";
      state.viewProjection = "2d";
      state.fieldDisplay = "scalar";
      state.autoScale = true;
      state.fieldQuiver = false;

      applySimulationGridSize(grid.nx, grid.ny, { applyPreset: true, render: false });
      sim.resetFields();
      sim.measure();
      if (backend === "js") sim.wasmBackend = null;

      const engine = sim.engineLabel();
      const hasWasm = Boolean(savedBackend?.canStep(state.fieldComponent));
      if (backend === "wasm" && !hasWasm) {
        throw new Error("WASM backend is not available for the benchmark case.");
      }

      for (let i = 0; i < warmupSteps; i += 1) sim.step();
      const stepStart = performance.now();
      for (let i = 0; i < steps; i += 1) sim.step();
      const stepMs = (performance.now() - stepStart) / steps;

      const measureStart = performance.now();
      for (let i = 0; i < measureSamples; i += 1) sim.measure();
      const measureMs = (performance.now() - measureStart) / measureSamples;

      const renderStart = performance.now();
      for (let i = 0; i < renderSamples; i += 1) sim.render();
      const renderMs = (performance.now() - renderStart) / renderSamples;

      const maxField = sim.lastMax;
      const energy = sim.lastEnergy;
      const time = sim.time;

      sim.wasmBackend = savedBackend;
      state.running = saved.running;
      state.preset = saved.preset;
      state.fieldComponent = saved.fieldComponent;
      state.viewMode = saved.viewMode;
      state.viewProjection = saved.viewProjection;
      state.fieldDisplay = saved.fieldDisplay;
      state.autoScale = saved.autoScale;
      state.fieldQuiver = saved.fieldQuiver;

      return {
        backend,
        engine,
        preset,
        nx: sim.nx,
        ny: sim.ny,
        cells: sim.n,
        steps,
        warmupSteps,
        stepMs,
        measureMs,
        renderMs,
        stepsPerSecond: 1000 / stepMs,
        maxField,
        energy,
        time,
      };
    },
    {
      grid,
      backend,
      steps: options.steps,
      warmupSteps: options.warmupSteps,
      renderSamples: options.renderSamples,
      measureSamples: options.measureSamples,
      preset: options.preset,
    },
  );
}

function round(value, digits = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function summarizeResult(result) {
  return {
    ...result,
    stepMs: round(result.stepMs, 4),
    measureMs: round(result.measureMs, 4),
    renderMs: round(result.renderMs, 4),
    stepsPerSecond: round(result.stepsPerSecond, 1),
    maxField: round(result.maxField, 6),
    energy: round(result.energy, 6),
  };
}

function formatTable(results) {
  const rows = [
    ["grid", "backend", "engine", "step ms", "step/s", "render ms", "measure ms"],
    ...results.map((item) => [
      `${item.nx}x${item.ny}`,
      item.backend.toUpperCase(),
      item.engine,
      item.stepMs.toFixed(4),
      item.stepsPerSecond.toFixed(1),
      item.renderMs.toFixed(4),
      item.measureMs.toFixed(4),
    ]),
  ];
  const widths = rows[0].map((_, col) => Math.max(...rows.map((row) => String(row[col]).length)));
  return rows.map((row) => row.map((cell, col) => String(cell).padEnd(widths[col])).join("  ")).join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { chromium } = await importPlaywright();
  const server = await startStaticServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/index.html?benchmark=${Date.now()}`;
  const browser = await launchBrowser(chromium, options);
  const page = await browser.newPage({ viewport: { width: 1280, height: 840 } });
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("404")) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    const environment = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      defaultEngine: sim.engineLabel(),
    }));
    const results = [];
    for (const grid of options.grids) {
      results.push(await runBenchmarkCase(page, grid, "wasm", options));
      results.push(await runBenchmarkCase(page, grid, "js", options));
    }

    const summary = {
      status: consoleErrors.length === 0 && pageErrors.length === 0 ? "PASS" : "WARN",
      options,
      environment,
      results: results.map(summarizeResult),
      speedups: options.grids.map((grid) => {
        const wasm = results.find((item) => item.backend === "wasm" && item.nx === grid.nx && item.ny === grid.ny);
        const js = results.find((item) => item.backend === "js" && item.nx === grid.nx && item.ny === grid.ny);
        return {
          grid: `${grid.nx}x${grid.ny}`,
          stepSpeedup: wasm && js ? round(js.stepMs / wasm.stepMs, 2) : null,
        };
      }),
      consoleErrors,
      pageErrors,
    };

    if (options.json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(formatTable(summary.results));
      console.log("");
      console.log("WASM step speedup:");
      for (const item of summary.speedups) {
        console.log(`- ${item.grid}: ${item.stepSpeedup}x`);
      }
      if (summary.status !== "PASS") {
        console.log("");
        console.log(`Status: ${summary.status}`);
        for (const item of [...consoleErrors, ...pageErrors]) console.log(`- ${item}`);
      }
    }
    process.exitCode = summary.status === "PASS" ? 0 : 1;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
