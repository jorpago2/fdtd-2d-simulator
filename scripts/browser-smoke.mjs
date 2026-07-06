#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const rootArg = argumentValue("--root");
const rootDir = rootArg ? path.resolve(process.cwd(), rootArg) : path.resolve(__dirname, "..");
const matrix = JSON.parse(fs.readFileSync(path.join(__dirname, "validation-matrix.json"), "utf8"));
const mode = process.argv.includes("--physics") ? "physics" : "smoke";
const includeAllCases = process.argv.includes("--all");
const selectedCase = argumentValue("--case");
const selectedCaseIds = new Set(
  selectedCase
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);
const smokeCases = matrix.cases.filter(
  (testCase) =>
    testCase.browserSmoke &&
    (includeAllCases || selectedCaseIds.size > 0 || testCase.priority === "P0") &&
    (selectedCaseIds.size === 0 || selectedCaseIds.has(testCase.id)) &&
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
    ".svg": "image/svg+xml; charset=utf-8",
    ".webp": "image/webp",
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

async function preparePhysicsCase(page, testCase) {
  await page.evaluate(({ caseId, requiresAnalysis }) => {
    state.running = false;
    state.diagnosticsEnabled = true;
    state.analysisEnabled = requiresAnalysis || caseId === "resonator_ringdown_q";
    sim.resetFields();
    sim.resetDiagnostics();
    sim.measure();
  }, { caseId: testCase.id, requiresAnalysis: Boolean(testCase.acceptance?.requiresAnalysis) });
}

async function stepPhysicsSimulation(page, steps, testCase = {}) {
  return page.evaluate(async ({ stepCount, temporalProbe, materialMonitor, fanoMonitor }) => {
    const sampleStride = Math.max(1, Math.floor(stepCount / 60));
    const lateStart = Math.max(0, Math.floor(stepCount * 0.78));
    const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const fieldEnergyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return finite(sim.analysisFieldEnergyDensityAt(idx));
      if (sim.material[idx] === 2) return 0;
      const electric =
        finite(sim.ez?.[idx]) ** 2 +
        finite(sim.ex?.[idx]) ** 2 +
        finite(sim.ey?.[idx]) ** 2 +
        finite(sim.dualEz?.[idx]) ** 2;
      const magnetic =
        finite(sim.hz?.[idx]) ** 2 +
        finite(sim.hx?.[idx]) ** 2 +
        finite(sim.hy?.[idx]) ** 2 +
        finite(sim.dualHz?.[idx]) ** 2;
      return electric + magnetic;
    };
    let energyPeak = 0;
    let lateEnergySum = 0;
    let lateEnergySamples = 0;
    const probeValues = [];
    let probeIdx = null;
    let temporalSampleStride = 1;
    let temporalWarmup = 0;
    if (temporalProbe) {
      const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
      const sources = state.sources || [];
      const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
      const sxValues = sources.map((source) =>
        typeof sim.sourceXCell === "function" ? sim.sourceXCell(source) : Math.round(finite(source.xLambda) * cpw),
      );
      const syValues = sources.map((source) =>
        typeof sim.sourceYCell === "function" ? sim.sourceYCell(source) : Math.round(finite(source.yLambda) * cpw),
      );
      const sourceX = sxValues.length ? mean(sxValues) : Math.round(0.5 * (sim.activeInteriorMinX() + sim.activeInteriorMaxX()));
      const sourceY = syValues.length ? mean(syValues) : Math.round(0.5 * (sim.activeInteriorMinY() + sim.activeInteriorMaxY()));
      const probeX = Math.max(
        sim.activeInteriorMinX(),
        Math.min(sim.activeInteriorMaxX(), Math.round(sourceX + finite(temporalProbe.offsetXLambda, 2.2) * cpw)),
      );
      const probeY = Math.max(
        sim.activeInteriorMinY(),
        Math.min(sim.activeInteriorMaxY(), Math.round(sourceY + finite(temporalProbe.offsetYLambda, 0) * cpw)),
      );
      probeIdx = sim.id(probeX, probeY);
      temporalSampleStride = Math.max(1, Math.round(finite(temporalProbe.sampleStride, 4)));
      temporalWarmup = Math.max(0, Math.round(finite(temporalProbe.warmupSteps, Math.floor(stepCount * 0.2))));
    }
    const materialTemporal = materialMonitor
      ? {
          samples: 0,
          materialCells: 0,
          dispersiveCells: 0,
          conductiveCells: 0,
          materialEnergyPeak: 0,
          dispersiveEnergyPeak: 0,
          conductiveEnergyPeak: 0,
          totalEnergyAtMaterialPeak: 0,
          materialPeakFraction: 0,
          dispersivePeakFraction: 0,
          conductivePeakFraction: 0,
        }
      : null;
    const materialSampleStride = Math.max(1, Math.round(finite(materialMonitor?.sampleStride, Math.max(4, Math.floor(stepCount / 80)))));
    const materialWarmup = Math.max(0, Math.round(finite(materialMonitor?.warmupSteps, 0)));
    const sampleMaterialTemporal = () => {
      if (!materialTemporal) return;
      const minX = sim.activeInteriorMinX();
      const maxX = sim.activeInteriorMaxX();
      const minY = sim.activeInteriorMinY();
      const maxY = sim.activeInteriorMaxY();
      let totalEnergy = 0;
      let materialEnergy = 0;
      let dispersiveEnergy = 0;
      let conductiveEnergy = 0;
      let materialCells = 0;
      let dispersiveCells = 0;
      let conductiveCells = 0;
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const idx = sim.id(x, y);
          const energy = fieldEnergyAt(idx);
          totalEnergy += energy;
          const isMaterial = sim.material[idx] !== 0;
          const isDispersive = Boolean(Number(sim.dispersiveMaterial?.[idx]) || Number(sim.muDispersiveMaterial?.[idx]));
          const isConductive = Math.max(finite(sim.conductivity?.[idx]), finite(sim.conductivityY?.[idx])) > 0;
          if (isMaterial) {
            materialCells += 1;
            materialEnergy += energy;
          }
          if (isDispersive) {
            dispersiveCells += 1;
            dispersiveEnergy += energy;
          }
          if (isConductive) {
            conductiveCells += 1;
            conductiveEnergy += energy;
          }
        }
      }
      materialTemporal.samples += 1;
      materialTemporal.materialCells = Math.max(materialTemporal.materialCells, materialCells);
      materialTemporal.dispersiveCells = Math.max(materialTemporal.dispersiveCells, dispersiveCells);
      materialTemporal.conductiveCells = Math.max(materialTemporal.conductiveCells, conductiveCells);
      if (materialEnergy > materialTemporal.materialEnergyPeak) {
        materialTemporal.materialEnergyPeak = materialEnergy;
        materialTemporal.totalEnergyAtMaterialPeak = totalEnergy;
        materialTemporal.materialPeakFraction = materialEnergy / Math.max(1e-30, totalEnergy);
      }
      if (dispersiveEnergy > materialTemporal.dispersiveEnergyPeak) {
        materialTemporal.dispersiveEnergyPeak = dispersiveEnergy;
        materialTemporal.dispersivePeakFraction = dispersiveEnergy / Math.max(1e-30, totalEnergy);
      }
      if (conductiveEnergy > materialTemporal.conductiveEnergyPeak) {
        materialTemporal.conductiveEnergyPeak = conductiveEnergy;
        materialTemporal.conductivePeakFraction = conductiveEnergy / Math.max(1e-30, totalEnergy);
      }
    };
    const fanoTemporal = fanoMonitor
      ? {
          samples: 0,
          busHighIndexCells: 0,
          resonatorHighIndexCells: 0,
          gapHighIndexCells: 0,
          busEnergyPeak: 0,
          resonatorEnergyPeak: 0,
          gapEnergyPeak: 0,
          totalEnergyAtResonatorPeak: 0,
          busEnergyAtResonatorPeak: 0,
          resonatorPeakFraction: 0,
          resonatorToBusPeakRatio: 0,
        }
      : null;
    const fanoSampleStride = Math.max(1, Math.round(finite(fanoMonitor?.sampleStride, Math.max(4, Math.floor(stepCount / 90)))));
    const fanoWarmup = Math.max(0, Math.round(finite(fanoMonitor?.warmupSteps, 0)));
    const sampleFanoTemporal = () => {
      if (!fanoTemporal) return;
      const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
      const minX = sim.activeInteriorMinX();
      const maxX = sim.activeInteriorMaxX();
      const minY = sim.activeInteriorMinY();
      const maxY = sim.activeInteriorMaxY();
      const midX = Math.round(0.5 * (minX + maxX));
      const midY = Math.round(0.5 * (minY + maxY));
      const fanoCx = midX + Math.round(0.8 * cpw);
      const fanoCy = midY - Math.round(0.5 * cpw);
      const fanoRx = Math.max(2, Math.round(0.42 * cpw));
      const fanoRy = Math.max(2, Math.round(0.42 * cpw));
      let totalEnergy = 0;
      let busEnergy = 0;
      let resonatorEnergy = 0;
      let gapEnergy = 0;
      let busHighIndexCells = 0;
      let resonatorHighIndexCells = 0;
      let gapHighIndexCells = 0;
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const idx = sim.id(x, y);
          const energy = fieldEnergyAt(idx);
          const highIndex = sim.material[idx] !== 0 && Math.max(Math.abs(finite(sim.eps?.[idx])), Math.abs(finite(sim.epsY?.[idx]))) > 3.0;
          const inBus = Math.abs(y - midY) <= Math.round(0.18 * cpw);
          const inResonator = ((x - fanoCx) / fanoRx) ** 2 + ((y - fanoCy) / fanoRy) ** 2 <= 1;
          const inGap =
            Math.abs(x - fanoCx) <= Math.round(0.22 * cpw) &&
            y > fanoCy + Math.round(0.37 * cpw) &&
            y < midY - Math.round(0.12 * cpw);
          totalEnergy += energy;
          if (inBus) busEnergy += energy;
          if (inResonator) resonatorEnergy += energy;
          if (inGap) gapEnergy += energy;
          if (highIndex && inBus) busHighIndexCells += 1;
          if (highIndex && inResonator) resonatorHighIndexCells += 1;
          if (highIndex && inGap) gapHighIndexCells += 1;
        }
      }
      fanoTemporal.samples += 1;
      fanoTemporal.busHighIndexCells = Math.max(fanoTemporal.busHighIndexCells, busHighIndexCells);
      fanoTemporal.resonatorHighIndexCells = Math.max(fanoTemporal.resonatorHighIndexCells, resonatorHighIndexCells);
      fanoTemporal.gapHighIndexCells = Math.max(fanoTemporal.gapHighIndexCells, gapHighIndexCells);
      fanoTemporal.busEnergyPeak = Math.max(fanoTemporal.busEnergyPeak, busEnergy);
      fanoTemporal.gapEnergyPeak = Math.max(fanoTemporal.gapEnergyPeak, gapEnergy);
      if (resonatorEnergy > fanoTemporal.resonatorEnergyPeak) {
        fanoTemporal.resonatorEnergyPeak = resonatorEnergy;
        fanoTemporal.totalEnergyAtResonatorPeak = totalEnergy;
        fanoTemporal.busEnergyAtResonatorPeak = busEnergy;
        fanoTemporal.resonatorPeakFraction = resonatorEnergy / Math.max(1e-30, totalEnergy);
        fanoTemporal.resonatorToBusPeakRatio = resonatorEnergy / Math.max(1e-30, busEnergy);
      }
    };
    const t0 = performance.now();
    for (let step = 0; step < stepCount; step += 1) {
      sim.step();
      if (probeIdx != null && step >= temporalWarmup && step % temporalSampleStride === 0) {
        const value = state.fieldComponent === "hz" ? Number(sim.ez?.[probeIdx]) || 0 : Number(sim.ez?.[probeIdx]) || 0;
        probeValues.push(value);
      }
      if (materialTemporal && step >= materialWarmup && step % materialSampleStride === 0) sampleMaterialTemporal();
      if (fanoTemporal && step >= fanoWarmup && step % fanoSampleStride === 0) sampleFanoTemporal();
      if (step % sampleStride === 0 || step === stepCount - 1) {
        sim.measure();
        const energy = Number(sim.lastEnergy) || 0;
        energyPeak = Math.max(energyPeak, energy);
        if (step >= lateStart) {
          lateEnergySum += energy;
          lateEnergySamples += 1;
        }
      }
      if ((step + 1) % 180 === 0) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    sim.measure();
    const temporalStats = (() => {
      if (probeIdx == null) return null;
      const samples = probeValues.filter((value) => Number.isFinite(value));
      if (samples.length < 8) {
        return { samples: samples.length, peakAbs: 0, rmsMean: 0, rmsMin: 0, rmsMax: 0, envelopeDynamicRange: 0 };
      }
      const abs = samples.map((value) => Math.abs(value));
      const peakAbs = Math.max(...abs);
      const rms = (values) => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / Math.max(1, values.length));
      const windowCount = Math.min(16, Math.max(4, Math.floor(samples.length / 12)));
      const windowLength = Math.max(4, Math.floor(samples.length / windowCount));
      const rmsWindows = [];
      for (let start = 0; start + windowLength <= samples.length; start += windowLength) {
        rmsWindows.push(rms(samples.slice(start, start + windowLength)));
      }
      const rmsMin = rmsWindows.length ? Math.min(...rmsWindows) : 0;
      const rmsMax = rmsWindows.length ? Math.max(...rmsWindows) : 0;
      return {
        samples: samples.length,
        peakAbs,
        rmsMean: rms(samples),
        rmsMin,
        rmsMax,
        envelopeDynamicRange: rmsMax / Math.max(1e-30, rmsMin),
      };
    })();
    return {
      elapsedMs: performance.now() - t0,
      energyPeak,
      lateEnergyAverage: lateEnergySamples > 0 ? lateEnergySum / lateEnergySamples : 0,
      lateEnergyRatio: lateEnergySamples > 0 ? lateEnergySum / lateEnergySamples / Math.max(1e-30, energyPeak) : 0,
      finalEnergyRatio: (Number(sim.lastEnergy) || 0) / Math.max(1e-30, energyPeak),
      diagnosticSamples: sim.diagnosticSamples || 0,
      analysisSamples: sim.analysisSamples || 0,
      temporalProbe: temporalStats,
      materialTemporal,
      fanoTemporal,
    };
  }, {
    stepCount: steps,
    temporalProbe: testCase.acceptance?.temporalProbeCheck
      ? {
          offsetXLambda: testCase.acceptance.temporalProbeOffsetXLambda,
          offsetYLambda: testCase.acceptance.temporalProbeOffsetYLambda,
          sampleStride: testCase.acceptance.temporalProbeSampleStride,
          warmupSteps: testCase.acceptance.temporalProbeWarmupSteps,
        }
      : null,
    materialMonitor: testCase.acceptance?.materialTemporalCheck
      ? {
          sampleStride: testCase.acceptance.materialTemporalSampleStride,
          warmupSteps: testCase.acceptance.materialTemporalWarmupSteps,
        }
      : null,
    fanoMonitor: testCase.acceptance?.fanoTemporalCheck
      ? {
          sampleStride: testCase.acceptance.fanoTemporalSampleStride,
          warmupSteps: testCase.acceptance.fanoTemporalWarmupSteps,
        }
      : null,
  });
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

async function diagnosticMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const analysis = state.analysisEnabled ? sim.analysisMetricEstimate() : null;
    return {
      samples: sim.diagnosticSamples || 0,
      reflectance: sim.diagnosticReflectance || 0,
      transmittance: sim.diagnosticTransmittance || 0,
      powerBalanceMethod: sim.diagnosticPowerBalanceSummary?.method || null,
      powerBalanceResidual:
        sim.diagnosticPowerBalanceSummary?.balanceResidual ??
        (sim.diagnosticSamples > 0 ? 1 - (sim.diagnosticReflectance || 0) - (sim.diagnosticTransmittance || 0) : null),
      spectrumValidPointCount: sim.diagnosticSpectrumSummary?.validPointCount || 0,
      spectrumCarrierReflectance: sim.diagnosticSpectrumSummary?.carrierPoint?.reflectance ?? null,
      referenceActive: Boolean(sim.diagnosticSpectrumSummary?.reference?.active),
      referenceValidPointCount: sim.diagnosticSpectrumSummary?.reference?.validPointCount || 0,
      referenceCarrierReflectance: sim.diagnosticSpectrumSummary?.referenceCarrierPoint?.referenceNormalized?.reflectance ?? null,
      incidentPower: sim.diagnosticIncidentPower || 0,
      reflectedPower: sim.diagnosticReflectedPower || 0,
      transmittedPower: sim.diagnosticTransmittedPower || 0,
      angleDeg: sim.diagnosticAngleDeg || 0,
      analysisSamples: sim.analysisSamples || 0,
      ringdownQ: analysis?.ringdown?.q ?? null,
      leakageRate: analysis?.leakageRate ?? null,
    };
  });
}

function fresnelCoefficients(angleDeg, n1, n2, polarization = "tm") {
  const thetaI = (Number(angleDeg) * Math.PI) / 180;
  const safeN1 = Math.max(1e-9, Number(n1) || 1);
  const safeN2 = Math.max(1e-9, Number(n2) || 1);
  const sinT = (safeN1 / safeN2) * Math.sin(thetaI);
  if (Math.abs(sinT) >= 1) {
    return { reflectance: 1, transmittance: 0, totalInternalReflection: true };
  }
  const cosI = Math.cos(thetaI);
  const cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
  const pol = String(polarization || "tm").toLowerCase();
  const numerator =
    pol === "te" ? safeN1 * cosI - safeN2 * cosT : safeN2 * cosI - safeN1 * cosT;
  const denominator =
    pol === "te" ? safeN1 * cosI + safeN2 * cosT : safeN2 * cosI + safeN1 * cosT;
  const r = denominator === 0 ? 1 : numerator / denominator;
  const reflectance = Math.max(0, r * r);
  return {
    reflectance,
    transmittance: Math.max(0, 1 - reflectance),
    totalInternalReflection: false,
  };
}

async function brewsterScanMetrics(page, testCase) {
  const expectedAngle = Number(testCase.reference?.expectedAngleDeg) || 56.31;
  const scanSteps = Math.max(720, Math.trunc(Number(testCase.acceptance?.scanSteps) || 1800));
  const n1 = Number(testCase.reference?.n1) || 1;
  const n2 = Number(testCase.reference?.n2) || 1.5;
  return page.evaluate(async ({ expectedAngle, scanSteps, n1, n2 }) => {
    const fresnel = (angleDeg) => {
      const thetaI = (Number(angleDeg) * Math.PI) / 180;
      const sinT = (n1 / n2) * Math.sin(thetaI);
      if (Math.abs(sinT) >= 1) return { reflectance: 1, transmittance: 0 };
      const cosI = Math.cos(thetaI);
      const cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
      const numerator = n2 * cosI - n1 * cosT;
      const denominator = n2 * cosI + n1 * cosT;
      const reflectance = denominator === 0 ? 1 : (numerator / denominator) ** 2;
      return { reflectance, transmittance: Math.max(0, 1 - reflectance) };
    };
    const source = state.sources?.[0];
    if (!source) return null;
    const savedSource = { ...source };
    const savedDiagnostics = state.diagnosticsEnabled;
    const angles = [-10, -5, 0, 5, 10].map((delta) => expectedAngle + delta);
    const results = [];
    state.running = false;
    state.diagnosticsEnabled = true;
    for (const angle of angles) {
      Object.assign(source, savedSource, { type: "sine", angleDeg: angle });
      if (typeof normalizeSource === "function") normalizeSource(source);
      sim.resetFields();
      sim.resetDiagnostics();
      for (let step = 0; step < scanSteps; step += 1) {
        sim.step();
        if ((step + 1) % 180 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      sim.measure();
      results.push({
        angleDeg: angle,
        reflectance: sim.diagnosticReflectance || 0,
        transmittance: sim.diagnosticTransmittance || 0,
        reference: fresnel(angle),
        samples: sim.diagnosticSamples || 0,
      });
    }
    Object.assign(source, savedSource);
    if (typeof normalizeSource === "function") normalizeSource(source);
    state.diagnosticsEnabled = savedDiagnostics;
    const runtimeMinimum = results.reduce((best, item) => (item.reflectance < best.reflectance ? item : best), results[0]);
    const analyticMinimum = results.reduce((best, item) => (item.reference.reflectance < best.reference.reflectance ? item : best), results[0]);
    return { expectedAngleDeg: expectedAngle, scanSteps, runtimeMinimum, analyticMinimum, results };
  }, { expectedAngle, scanSteps, n1, n2 });
}

async function slabWaveguideLaunchMetrics(page) {
  return page.evaluate(() => {
    const source = state.sources?.[0] || null;
    if (!source || source.shape !== "modeProfile") return null;
    const sx = sim.sourceXCell(source);
    const sy = sim.sourceYCell(source);
    const coreHalfWidth = Math.max(4, Math.round(state.cellsPerWavelength * 0.18));
    const claddingOffset = Math.max(coreHalfWidth + 8, Math.round(state.cellsPerWavelength * 0.75));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const rightMaxX = Math.min(maxX - 8, sx + Math.round(state.cellsPerWavelength * 6));
    const rightCpmlStart = sim.nx - sim.cpmlLayer;
    const rightBeforeCpmlIdx = sim.id(Math.max(0, rightCpmlStart - 1), sy);
    const rightCpmlStartIdx = sim.id(Math.min(sim.nx - 1, rightCpmlStart), sy);
    const rightBoundaryBeforeCpml = {
      material: sim.material[rightBeforeCpmlIdx],
      eps: sim.eps[rightBeforeCpmlIdx],
      inCpml: sim.isInCpml(rightCpmlStart - 1, sy),
    };
    const rightBoundaryAtCpml = {
      material: sim.material[rightCpmlStartIdx],
      eps: sim.eps[rightCpmlStartIdx],
      inCpml: sim.isInCpml(rightCpmlStart, sy),
    };

    const energyAt = (idx) => {
      if (sim.material[idx] === 2) return 0;
      if (state.fieldComponent === "hz") {
        return (
          Math.abs(sim.mu[idx]) * sim.ez[idx] * sim.ez[idx] +
          Math.abs(sim.eps[idx]) * sim.hx[idx] * sim.hx[idx] +
          Math.abs(sim.epsY[idx]) * sim.hy[idx] * sim.hy[idx]
        );
      }
      return (
        Math.abs(sim.eps[idx]) * sim.ez[idx] * sim.ez[idx] +
        Math.abs(sim.mu[idx]) * sim.hx[idx] * sim.hx[idx] +
        Math.abs(sim.muY[idx]) * sim.hy[idx] * sim.hy[idx]
      );
    };

    const sumRegion = (x0, x1, yPredicate) => {
      let energy = 0;
      for (let y = minY; y <= maxY; y += 1) {
        if (!yPredicate(y)) continue;
        for (let x = Math.max(minX, x0); x <= Math.min(maxX, x1); x += 1) {
          energy += energyAt(sim.id(x, y));
        }
      }
      return energy;
    };

    const leftGuideEnergy = sumRegion(minX + 4, sx - 8, (y) => Math.abs(y - sy) <= coreHalfWidth);
    const rightGuideEnergy = sumRegion(sx + 16, rightMaxX, (y) => Math.abs(y - sy) <= coreHalfWidth);
    const rightCladdingEnergy = sumRegion(sx + 16, rightMaxX, (y) => Math.abs(y - sy) > claddingOffset);
    const totalRightEnergy = sumRegion(sx + 16, rightMaxX, () => true);
    return {
      engine: sim.engineLabel(),
      leftGuideEnergy,
      rightGuideEnergy,
      rightCladdingEnergy,
      totalRightEnergy,
      coreEnergyFraction: rightGuideEnergy / Math.max(1e-30, totalRightEnergy),
      rightBoundaryBeforeCpml,
      rightBoundaryAtCpml,
      rightBoundaryMaterialContinuous:
        rightBoundaryBeforeCpml.material === rightBoundaryAtCpml.material &&
        Math.abs(rightBoundaryBeforeCpml.eps - rightBoundaryAtCpml.eps) < 1e-6,
      backwardEnergyRatio: leftGuideEnergy / Math.max(1e-30, rightGuideEnergy),
      radiationEnergyRatio: rightCladdingEnergy / Math.max(1e-30, rightGuideEnergy),
    };
  });
}

async function guidedDeviceMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const analysis = state.analysisEnabled && typeof sim.analysisMetricEstimate === "function" ? sim.analysisMetricEstimate() : null;
    const modePort =
      analysis?.modePort || (typeof sim.modePortAnalysisEstimate === "function" ? sim.modePortAnalysisEstimate() : null);
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const finiteOrNull = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
    const sources = Array.isArray(state.sources) ? state.sources : [];
    const sourceCells = sources.map((source) => ({
      shape: source.shape || "",
      type: source.type || "",
      modeOrder: Number.isFinite(Number(source.modeOrder)) ? Number(source.modeOrder) : 0,
      x: typeof sim.sourceXCell === "function" ? sim.sourceXCell(source) : Math.round(finite(source.xLambda) * cpw),
      y: typeof sim.sourceYCell === "function" ? sim.sourceYCell(source) : Math.round(finite(source.yLambda) * cpw),
    }));
    const sourceX = sourceCells[0]?.x ?? midX;
    const sourceY = sourceCells[0]?.y ?? midY;
    const sourceXSpanLambda =
      sourceCells.length > 1
        ? (Math.max(...sourceCells.map((source) => source.x)) - Math.min(...sourceCells.map((source) => source.x))) / cpw
        : 0;
    const sourceYSpanLambda =
      sourceCells.length > 1
        ? (Math.max(...sourceCells.map((source) => source.y)) - Math.min(...sourceCells.map((source) => source.y))) / cpw
        : 0;
    const sourceSeparationLambda =
      sourceCells.length > 1
        ? Math.hypot(sourceCells[1].x - sourceCells[0].x, sourceCells[1].y - sourceCells[0].y) / cpw
        : 0;
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return finite(sim.analysisFieldEnergyDensityAt(idx));
      if (sim.material[idx] === 2) return 0;
      return finite(sim.ez[idx]) ** 2 + finite(sim.hx[idx]) ** 2 + finite(sim.hy[idx]) ** 2;
    };
    const isMaterial = (idx) => sim.material[idx] !== 0 && sim.material[idx] !== 2;
    const isHighIndex = (idx) => isMaterial(idx) && Math.max(Math.abs(finite(sim.eps?.[idx])), Math.abs(finite(sim.epsY?.[idx]))) > 3.0;
    const ellipse = (x, y, cx, cy, rxL, ryL, innerRxL = 0, innerRyL = 0) => {
      const outer =
        ((x - cx) / Math.max(1, rxL * cpw)) ** 2 + ((y - cy) / Math.max(1, ryL * cpw)) ** 2 <= 1;
      if (!outer || innerRxL <= 0 || innerRyL <= 0) return outer;
      const inner =
        ((x - cx) / Math.max(1, innerRxL * cpw)) ** 2 + ((y - cy) / Math.max(1, innerRyL * cpw)) ** 2 < 1;
      return !inner;
    };

    const columnSpans = [];
    const columnCentroids = [];
    let columnsWithHighIndex = 0;
    let columnsWithMultipleSegments = 0;
    let maxSegmentsPerColumn = 0;
    let maxSegmentSeparationLambda = 0;
    let materialCells = 0;
    let highIndexCells = 0;
    let lossyCells = 0;
    let pecCells = 0;
    let totalEnergy = 0;
    let highIndexEnergy = 0;
    let guideBandHighIndexCells = 0;
    let guideBandEnergy = 0;
    let inputGuideEnergy = 0;
    let outputGuideHighIndexCells = 0;
    let outputGuideEnergy = 0;
    let couplerThroughEnergy = 0;
    let couplerCrossEnergy = 0;
    let sourceOverlapEnergy = 0;
    let upperOffAxisHighIndexCells = 0;
    let lowerOffAxisHighIndexCells = 0;
    let stubHighIndexCells = 0;
    let stubEnergy = 0;
    let stubPecCells = 0;
    let offsetScattererHighIndexCells = 0;
    let centralDiskHighIndexCells = 0;
    let centralDiskEnergy = 0;
    let centralPecCells = 0;
    let ringCells = 0;
    let ringEnergy = 0;
    let racetrackRingCells = 0;
    let racetrackRingEnergy = 0;
    let busHighIndexCells = 0;
    let dropBusHighIndexCells = 0;
    let mziInputGuideEnergy = 0;
    let mziSplitterEnergy = 0;
    let mziUpperArmHighIndexCells = 0;
    let mziLowerArmHighIndexCells = 0;
    let mziUpperArmEnergy = 0;
    let mziLowerArmEnergy = 0;
    let mziPhaseShifterCells = 0;
    let mziPhaseShifterEnergy = 0;
    let mziCombinerEnergy = 0;
    let mziOutputGuideEnergy = 0;
    let materialMinX = Infinity;
    let materialMaxX = -Infinity;
    let materialMinY = Infinity;
    let materialMaxY = -Infinity;
    const guideHalf = Math.max(2, Math.round(0.42 * cpw));
    const portHalf = Math.max(2, Math.round(0.18 * cpw));
    const inputGuideX1 = sourceX + Math.round(1.4 * cpw);
    const outputGuideX0 = Math.min(maxX, sourceX + Math.round(4.0 * cpw));
    const couplerCrossY = sourceY + Math.round(0.46 * cpw);
    const offAxisThreshold = Math.max(2, Math.round(0.34 * cpw));
    const sourceRadius = Math.max(3, Math.round(0.45 * cpw));
    const mziArmHalfWidth = Math.max(2, Math.round(0.18 * cpw));
    const mziUpperArmY = midY - Math.round(0.48 * cpw);
    const mziLowerArmY = midY + Math.round(0.48 * cpw);
    const mziArmX0 = midX - Math.round(1.25 * cpw);
    const mziArmX1 = midX + Math.round(1.25 * cpw);
    const mziInputX1 = midX - Math.round(2.1 * cpw);
    const mziOutputX0 = midX + Math.round(2.1 * cpw);

    for (let x = minX; x <= maxX; x += 1) {
      const ys = [];
      let weightedY = 0;
      for (let y = minY; y <= maxY; y += 1) {
        const idx = sim.id(x, y);
        const energy = energyAt(idx);
        totalEnergy += energy;
        const material = isMaterial(idx);
        const highIndex = isHighIndex(idx);
        if (material || sim.material[idx] === 2) {
          materialMinX = Math.min(materialMinX, x);
          materialMaxX = Math.max(materialMaxX, x);
          materialMinY = Math.min(materialMinY, y);
          materialMaxY = Math.max(materialMaxY, y);
        }
        if (material) materialCells += 1;
        if (sim.material[idx] === 2) pecCells += 1;
        if (Math.max(Math.abs(finite(sim.loss?.[idx])), Math.abs(finite(sim.lossY?.[idx]))) > 1e-6) lossyCells += 1;
        if (sim.material[idx] !== 2 && Math.hypot(x - sourceX, y - sourceY) <= sourceRadius) sourceOverlapEnergy += energy;
        const inInputGuidePort = x <= inputGuideX1 && Math.abs(y - sourceY) <= portHalf;
        const inOutputGuidePort = x >= outputGuideX0 && Math.abs(y - sourceY) <= portHalf;
        const inCouplerCrossPort = x >= outputGuideX0 && Math.abs(y - couplerCrossY) <= portHalf;
        if (sim.material[idx] !== 2 && inInputGuidePort) inputGuideEnergy += energy;
        if (sim.material[idx] !== 2 && inOutputGuidePort) {
          outputGuideEnergy += energy;
          couplerThroughEnergy += energy;
        }
        if (sim.material[idx] !== 2 && inCouplerCrossPort) couplerCrossEnergy += energy;
        if (!highIndex) {
          if (sim.material[idx] === 2 && Math.abs(x - midX) <= Math.round(0.32 * cpw) && y < midY - Math.round(0.65 * cpw)) stubPecCells += 1;
          if (sim.material[idx] === 2 && Math.abs(x - midX) <= Math.round(0.9 * cpw) && Math.abs(y - midY) <= Math.round(0.7 * cpw)) centralPecCells += 1;
          continue;
        }
        ys.push(y);
        weightedY += y;
        highIndexCells += 1;
        highIndexEnergy += energy;
        if (Math.abs(y - sourceY) <= guideHalf) {
          guideBandHighIndexCells += 1;
          guideBandEnergy += energy;
        }
        if (x >= outputGuideX0 && Math.abs(y - sourceY) <= portHalf) {
          outputGuideHighIndexCells += 1;
        }
        if (y < sourceY - offAxisThreshold) upperOffAxisHighIndexCells += 1;
        if (y > sourceY + offAxisThreshold) lowerOffAxisHighIndexCells += 1;
        if (Math.abs(x - midX) <= Math.round(0.28 * cpw) && y < sourceY - Math.round(0.12 * cpw) && y > sourceY - Math.round(1.25 * cpw)) {
          stubHighIndexCells += 1;
          stubEnergy += energy;
        }
        if (Math.hypot(x - (midX + Math.round(0.9 * cpw)), y - (midY - Math.round(0.32 * cpw))) <= Math.round(0.18 * cpw)) {
          offsetScattererHighIndexCells += 1;
        }
        if (Math.hypot(x - midX, y - midY) <= Math.round(0.78 * cpw)) {
          centralDiskHighIndexCells += 1;
          centralDiskEnergy += energy;
        }
        if (ellipse(x, y, midX + Math.round(0.5 * cpw), midY, 1.1, 1.1, 0.84, 0.84)) {
          ringCells += 1;
          ringEnergy += energy;
        }
        if (ellipse(x, y, midX + Math.round(0.45 * cpw), midY, 1.55, 0.82, 1.26, 0.55)) {
          racetrackRingCells += 1;
          racetrackRingEnergy += energy;
        }
        if (Math.abs(y - (midY + Math.round(1.1 * cpw))) <= Math.round(0.22 * cpw)) busHighIndexCells += 1;
        if (Math.abs(y - (midY - Math.round(1.1 * cpw))) <= Math.round(0.22 * cpw)) dropBusHighIndexCells += 1;
        if (Math.abs(y - sourceY) <= guideHalf && x < mziInputX1) mziInputGuideEnergy += energy;
        if (Math.abs(x - (midX - Math.round(1.75 * cpw))) <= Math.round(0.55 * cpw) && Math.abs(y - midY) <= Math.round(0.75 * cpw)) {
          mziSplitterEnergy += energy;
        }
        if (x >= mziArmX0 && x <= mziArmX1 && Math.abs(y - mziUpperArmY) <= mziArmHalfWidth) {
          mziUpperArmHighIndexCells += 1;
          mziUpperArmEnergy += energy;
          if (Math.abs(x - (midX + Math.round(0.2 * cpw))) <= Math.round(0.45 * cpw) && finite(sim.eps?.[idx]) >= 9) {
            mziPhaseShifterCells += 1;
            mziPhaseShifterEnergy += energy;
          }
        }
        if (x >= mziArmX0 && x <= mziArmX1 && Math.abs(y - mziLowerArmY) <= mziArmHalfWidth) {
          mziLowerArmHighIndexCells += 1;
          mziLowerArmEnergy += energy;
        }
        if (Math.abs(x - (midX + Math.round(1.75 * cpw))) <= Math.round(0.55 * cpw) && Math.abs(y - midY) <= Math.round(0.75 * cpw)) {
          mziCombinerEnergy += energy;
        }
        if (Math.abs(y - sourceY) <= guideHalf && x > mziOutputX0) mziOutputGuideEnergy += energy;
      }
      if (!ys.length) continue;
      columnsWithHighIndex += 1;
      const span = (ys[ys.length - 1] - ys[0] + 1) / cpw;
      columnSpans.push(span);
      columnCentroids.push(weightedY / ys.length);
      const segments = [];
      let start = ys[0];
      let prev = ys[0];
      for (let i = 1; i < ys.length; i += 1) {
        if (ys[i] === prev + 1) {
          prev = ys[i];
          continue;
        }
        segments.push({ start, end: prev, center: 0.5 * (start + prev) });
        start = ys[i];
        prev = ys[i];
      }
      segments.push({ start, end: prev, center: 0.5 * (start + prev) });
      maxSegmentsPerColumn = Math.max(maxSegmentsPerColumn, segments.length);
      if (segments.length > 1) {
        columnsWithMultipleSegments += 1;
        maxSegmentSeparationLambda = Math.max(maxSegmentSeparationLambda, (segments[segments.length - 1].center - segments[0].center) / cpw);
      }
    }

    let maxAdjacentWidthJumpLambda = 0;
    for (let i = 1; i < columnSpans.length; i += 1) {
      maxAdjacentWidthJumpLambda = Math.max(maxAdjacentWidthJumpLambda, Math.abs(columnSpans[i] - columnSpans[i - 1]));
    }
    const sum = (values) => values.reduce((acc, value) => acc + value, 0);
    const minSpan = columnSpans.length ? Math.min(...columnSpans) : 0;
    const maxSpan = columnSpans.length ? Math.max(...columnSpans) : 0;
    const minCentroid = columnCentroids.length ? Math.min(...columnCentroids) : midY;
    const maxCentroid = columnCentroids.length ? Math.max(...columnCentroids) : midY;

    return {
      preset: state.preset,
      fieldComponent: state.fieldComponent,
      analysisSamples: sim.analysisSamples || 0,
      sourceCount: sourceCells.length,
      sourceShapes: sourceCells.map((source) => source.shape),
      sourceTypes: sourceCells.map((source) => source.type),
      sourceModeOrderMax: sourceCells.length ? Math.max(...sourceCells.map((source) => source.modeOrder)) : 0,
      sourceXSpanLambda,
      sourceYSpanLambda,
      sourceSeparationLambda,
      materialCells,
      highIndexCells,
      lossyCells,
      pecCells,
      materialBounds: Number.isFinite(materialMinX)
        ? {
            widthLambda: (materialMaxX - materialMinX + 1) / cpw,
            heightLambda: (materialMaxY - materialMinY + 1) / cpw,
          }
        : null,
      columnsWithHighIndex,
      columnsWithMultipleSegments,
      maxSegmentsPerColumn,
      maxSegmentSeparationLambda,
      minColumnSpanLambda: minSpan,
      maxColumnSpanLambda: maxSpan,
      meanColumnSpanLambda: columnSpans.length ? sum(columnSpans) / columnSpans.length : 0,
      widthRangeLambda: maxSpan - minSpan,
      maxAdjacentWidthJumpLambda,
      centroidShiftRangeLambda: (maxCentroid - minCentroid) / cpw,
      totalEnergy,
      highIndexEnergy,
      highIndexEnergyFraction: highIndexEnergy / Math.max(1e-30, totalEnergy),
      guideBandHighIndexCells,
      guideBandEnergyFraction: guideBandEnergy / Math.max(1e-30, totalEnergy),
      inputGuideEnergyFraction: inputGuideEnergy / Math.max(1e-30, totalEnergy),
      outputGuideHighIndexCells,
      outputGuideEnergyFraction: outputGuideEnergy / Math.max(1e-30, totalEnergy),
      outputGuideToInputRatio: outputGuideEnergy / Math.max(1e-30, inputGuideEnergy),
      couplerThroughEnergyFraction: couplerThroughEnergy / Math.max(1e-30, totalEnergy),
      couplerCrossEnergyFraction: couplerCrossEnergy / Math.max(1e-30, totalEnergy),
      couplerCrossToThroughRatio: couplerCrossEnergy / Math.max(1e-30, couplerThroughEnergy),
      sourceOverlapEnergyFraction: sourceOverlapEnergy / Math.max(1e-30, totalEnergy),
      upperOffAxisHighIndexCells,
      lowerOffAxisHighIndexCells,
      stubHighIndexCells,
      stubEnergyFraction: stubEnergy / Math.max(1e-30, totalEnergy),
      stubToGuideEnergyRatio: stubEnergy / Math.max(1e-30, guideBandEnergy),
      stubPecCells,
      offsetScattererHighIndexCells,
      centralDiskHighIndexCells,
      centralDiskEnergyFraction: centralDiskEnergy / Math.max(1e-30, totalEnergy),
      centralPecCells,
      ringCells,
      ringEnergyFraction: ringEnergy / Math.max(1e-30, totalEnergy),
      racetrackRingCells,
      racetrackRingEnergyFraction: racetrackRingEnergy / Math.max(1e-30, totalEnergy),
      busHighIndexCells,
      dropBusHighIndexCells,
      mziInputGuideEnergyFraction: mziInputGuideEnergy / Math.max(1e-30, totalEnergy),
      mziSplitterEnergyFraction: mziSplitterEnergy / Math.max(1e-30, totalEnergy),
      mziUpperArmHighIndexCells,
      mziLowerArmHighIndexCells,
      mziUpperArmEnergyFraction: mziUpperArmEnergy / Math.max(1e-30, totalEnergy),
      mziLowerArmEnergyFraction: mziLowerArmEnergy / Math.max(1e-30, totalEnergy),
      mziArmEnergyFraction: (mziUpperArmEnergy + mziLowerArmEnergy) / Math.max(1e-30, totalEnergy),
      mziArmEnergyBalance:
        mziUpperArmEnergy + mziLowerArmEnergy > 1e-30
          ? Math.abs(mziUpperArmEnergy - mziLowerArmEnergy) / Math.max(1e-30, mziUpperArmEnergy + mziLowerArmEnergy)
          : null,
      mziPhaseShifterCells,
      mziPhaseShifterEnergyFraction: mziPhaseShifterEnergy / Math.max(1e-30, totalEnergy),
      mziCombinerEnergyFraction: mziCombinerEnergy / Math.max(1e-30, totalEnergy),
      mziOutputGuideEnergyFraction: mziOutputGuideEnergy / Math.max(1e-30, totalEnergy),
      beta: finiteOrNull(analysis?.beta),
      split: finiteOrNull(analysis?.split),
      spectralSplit: finiteOrNull(analysis?.spectralSplit),
      ringdownQ: finiteOrNull(analysis?.ringdown?.q),
      modeAreaLambda2: finiteOrNull(analysis?.modeAreaLambda2),
      qAreaMetric: finiteOrNull(analysis?.purcellProxy),
      purcellProxy: finiteOrNull(analysis?.purcellProxy),
      leakageRate: finiteOrNull(analysis?.leakageRate),
      modePortAvailable: Boolean(modePort?.available),
      modePortValid: Boolean(modePort?.valid),
      modeEffectiveIndex: finiteOrNull(modePort?.neff),
      modeInputOverlap: finiteOrNull(modePort?.inputOverlap),
      modeOutputOverlap: finiteOrNull(modePort?.outputOverlap),
      modeRadiationFraction: finiteOrNull(modePort?.radiationFraction),
      modalTransmissionProxy: finiteOrNull(modePort?.modalTransmissionProxy),
      modalReflectionProxy: finiteOrNull(modePort?.modalReflectionProxy),
      modalS11Power: finiteOrNull(modePort?.sParameters?.reflectance),
      modalS21Power: finiteOrNull(modePort?.sParameters?.transmittance),
      modalSPowerResidual: finiteOrNull(modePort?.sParameters?.balanceResidual),
      modalSSamples: finiteOrNull(modePort?.sParameters?.sampleCount),
    };
  });
}

async function mmiSplitMetrics(page, testCase) {
  return page.evaluate(async (acceptance) => {
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const monitorXLambda = finite(acceptance.monitorXLambda, 7.2);
    const guideHalfWidthLambda = finite(acceptance.guideHalfWidthLambda, 0.11);
    const sampleSteps = Math.max(1, Math.round(finite(acceptance.mmiSampleSteps, 480)));
    const sampleEvery = Math.max(1, Math.round(finite(acceptance.mmiSampleEvery, 2)));
    const monitorX = Math.max(sim.activeInteriorMinX(), Math.min(sim.activeInteriorMaxX(), Math.round(monitorXLambda * cpw)));
    const midYLambda = sim.ny / cpw / 2;
    const upperCenterY = Math.round((midYLambda - 0.25) * cpw);
    const lowerCenterY = Math.round((midYLambda + 0.25) * cpw);
    const halfWidth = Math.max(2, Math.round(guideHalfWidthLambda * cpw));

    const integratePort = (centerY) => {
      const y0 = Math.max(sim.activeInteriorMinY(), centerY - halfWidth);
      const y1 = Math.min(sim.activeInteriorMaxY(), centerY + halfWidth);
      let ez2 = 0;
      let eAbs = 0;
      let sx = 0;
      let forwardSx = 0;
      let samples = 0;
      for (let y = y0; y <= y1; y += 1) {
        const idx = sim.id(monitorX, y);
        if (sim.material[idx] === 2) continue;
        const ez = finite(sim.ez?.[idx]) * (typeof sim.fieldPhysicalScale === "function" ? sim.fieldPhysicalScale() : 1);
        const poynting = typeof sim.poyntingAt === "function" ? finite(sim.poyntingAt(idx)?.x) : 0;
        ez2 += ez * ez;
        eAbs += Math.abs(ez);
        sx += poynting;
        forwardSx += Math.max(0, poynting);
        samples += 1;
      }
      return { y0, y1, ez2, eAbs, sx, forwardSx, samples };
    };

    const totals = {
      upper: { ez2: 0, eAbs: 0, sx: 0, forwardSx: 0, samples: 0 },
      lower: { ez2: 0, eAbs: 0, sx: 0, forwardSx: 0, samples: 0 },
      temporalSamples: 0,
    };
    for (let step = 0; step < sampleSteps; step += 1) {
      sim.step();
      if (step % sampleEvery !== 0) continue;
      const upper = integratePort(upperCenterY);
      const lower = integratePort(lowerCenterY);
      for (const key of ["ez2", "eAbs", "sx", "forwardSx"]) {
        totals.upper[key] += upper[key];
        totals.lower[key] += lower[key];
      }
      totals.upper.samples += upper.samples;
      totals.lower.samples += lower.samples;
      totals.upper.band = { x: monitorX, y0: upper.y0, y1: upper.y1 };
      totals.lower.band = { x: monitorX, y0: lower.y0, y1: lower.y1 };
      totals.temporalSamples += 1;
      if ((step + 1) % 180 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    sim.measure();
    const ratio = (upper, lower, key) => {
      const total = upper[key] + lower[key];
      return total > 1e-30 ? upper[key] / total : null;
    };
    const totalEz2 = totals.upper.ez2 + totals.lower.ez2;
    const totalForwardSx = totals.upper.forwardSx + totals.lower.forwardSx;
    return {
      preset: state.preset,
      monitorXLambda,
      guideHalfWidthLambda,
      sampleSteps,
      sampleEvery,
      temporalSamples: totals.temporalSamples,
      upper: totals.upper,
      lower: totals.lower,
      totalEz2,
      totalForwardSx,
      upperEz2Fraction: ratio(totals.upper, totals.lower, "ez2"),
      upperAbsFraction: ratio(totals.upper, totals.lower, "eAbs"),
      upperForwardSxFraction: ratio(totals.upper, totals.lower, "forwardSx"),
      signedSxBalance:
        Math.abs(totals.upper.sx) + Math.abs(totals.lower.sx) > 1e-30
          ? totals.upper.sx / (Math.abs(totals.upper.sx) + Math.abs(totals.lower.sx))
          : null,
    };
  }, testCase.acceptance || {});
}

async function directionalCouplerMetrics(page, testCase) {
  return page.evaluate(async (acceptance) => {
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const sources = Array.isArray(state.sources) ? state.sources : [];
    const source = sources[0] || {};
    const sourceY =
      typeof sim.sourceYCell === "function"
        ? sim.sourceYCell(source)
        : Math.round(finite(source.yLambda, sim.ny / cpw / 2) * cpw);
    const guideSeparationLambda = finite(acceptance.couplerGuideSeparationLambda, 0.46);
    const monitorStartLambda = finite(acceptance.couplerMonitorXStartLambda, 4.0);
    const monitorEndLambda = finite(acceptance.couplerMonitorXEndLambda, 12.2);
    const monitorStrideLambda = Math.max(0.1, finite(acceptance.couplerMonitorXStrideLambda, 0.35));
    const guideHalfWidthLambda = finite(acceptance.couplerGuideHalfWidthLambda, 0.11);
    const sampleSteps = Math.max(1, Math.round(finite(acceptance.couplerSampleSteps, 720)));
    const sampleEvery = Math.max(1, Math.round(finite(acceptance.couplerSampleEvery, 3)));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const throughCenterY = sourceY;
    const crossCenterY = sourceY + Math.round(guideSeparationLambda * cpw);
    const halfWidth = Math.max(2, Math.round(guideHalfWidthLambda * cpw));
    const monitorXs = [];
    for (let xLambda = monitorStartLambda; xLambda <= monitorEndLambda + 1e-9; xLambda += monitorStrideLambda) {
      const monitorX = Math.max(minX, Math.min(maxX, Math.round(xLambda * cpw)));
      if (!monitorXs.includes(monitorX)) monitorXs.push(monitorX);
    }
    if (!monitorXs.length) monitorXs.push(Math.round(0.5 * (minX + maxX)));

    const emptyPort = (x, centerY) => ({
      x,
      centerY,
      ez2: 0,
      eAbs: 0,
      sx: 0,
      forwardSx: 0,
      samples: 0,
    });
    const ports = monitorXs.map((monitorX) => ({
      x: monitorX,
      xLambda: monitorX / cpw,
      through: emptyPort(monitorX, throughCenterY),
      cross: emptyPort(monitorX, crossCenterY),
    }));
    const integrateInto = (target) => {
      const y0 = Math.max(minY, target.centerY - halfWidth);
      const y1 = Math.min(maxY, target.centerY + halfWidth);
      for (let y = y0; y <= y1; y += 1) {
        const idx = sim.id(target.x, y);
        if (sim.material[idx] === 2) continue;
        const ez = finite(sim.ez?.[idx]) * (typeof sim.fieldPhysicalScale === "function" ? sim.fieldPhysicalScale() : 1);
        const poynting = typeof sim.poyntingAt === "function" ? finite(sim.poyntingAt(idx)?.x) : 0;
        target.ez2 += ez * ez;
        target.eAbs += Math.abs(ez);
        target.sx += poynting;
        target.forwardSx += Math.max(0, poynting);
        target.samples += 1;
      }
    };

    let temporalSamples = 0;
    for (let step = 0; step < sampleSteps; step += 1) {
      sim.step();
      if (step % sampleEvery !== 0) continue;
      for (const port of ports) {
        integrateInto(port.through);
        integrateInto(port.cross);
      }
      temporalSamples += 1;
      if ((step + 1) % 180 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    sim.measure();

    const evaluatedPorts = ports.map((port) => {
      const totalForwardSx = port.through.forwardSx + port.cross.forwardSx;
      const totalEz2 = port.through.ez2 + port.cross.ez2;
      return {
        xLambda: port.xLambda,
        throughForwardSx: port.through.forwardSx,
        crossForwardSx: port.cross.forwardSx,
        totalForwardSx,
        totalEz2,
        crossForwardSxFraction: totalForwardSx > 1e-30 ? port.cross.forwardSx / totalForwardSx : null,
        crossEz2Fraction: totalEz2 > 1e-30 ? port.cross.ez2 / totalEz2 : null,
        signedSxBalance:
          Math.abs(port.through.sx) + Math.abs(port.cross.sx) > 1e-30
            ? (port.through.sx + port.cross.sx) / (Math.abs(port.through.sx) + Math.abs(port.cross.sx))
            : null,
      };
    });
    const eligible = evaluatedPorts.filter((port) => port.totalForwardSx > 1e-30 && Number.isFinite(port.crossForwardSxFraction));
    const best = eligible.reduce(
      (current, candidate) =>
        !current || candidate.crossForwardSxFraction > current.crossForwardSxFraction ? candidate : current,
      null,
    );
    const strongest = eligible.reduce(
      (current, candidate) => (!current || candidate.totalForwardSx > current.totalForwardSx ? candidate : current),
      null,
    );
    return {
      preset: state.preset,
      guideSeparationLambda,
      guideHalfWidthLambda,
      sampleSteps,
      sampleEvery,
      temporalSamples,
      monitorCount: evaluatedPorts.length,
      best,
      strongest,
      ports: evaluatedPorts,
    };
  }, testCase.acceptance || {});
}

async function apertureDiffractionMetrics(page, kind) {
  return page.evaluate((diffractionKind) => {
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const halfProbe = Math.max(1, Math.round(0.05 * cpw));
    const y0 = Math.max(minY + Math.round(0.35 * cpw), midY - Math.round(2.2 * cpw));
    const y1 = Math.min(maxY - Math.round(0.35 * cpw), midY + Math.round(2.2 * cpw));
    const fieldEnergyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return sim.analysisFieldEnergyDensityAt(idx);
      if (sim.material[idx] === 2) return 0;
      return sim.ez[idx] * sim.ez[idx] + sim.hx[idx] * sim.hx[idx] + sim.hy[idx] * sim.hy[idx];
    };
    const profileAt = (probeX) => {
      const values = [];
      let total = 0;
      let peak = 0;
      for (let y = y0; y <= y1; y += 1) {
        let energy = 0;
        for (let x = Math.max(minX, probeX - halfProbe); x <= Math.min(maxX, probeX + halfProbe); x += 1) {
          const value = fieldEnergyAt(sim.id(x, y));
          if (Number.isFinite(value) && value > 0) energy += value;
        }
        values.push(energy);
        total += energy;
        peak = Math.max(peak, energy);
      }
      return { probeX, values, total, peak };
    };
    let bestProfile = { probeX: midX + Math.round(0.2 * cpw), values: [], total: 0, peak: 0 };
    const downstreamStartLambda = diffractionKind === "double" ? 0.9 : 0.12;
    const xStart = Math.max(minX, midX + Math.round(downstreamStartLambda * cpw));
    const xEnd = Math.min(maxX - Math.round(0.4 * cpw), midX + Math.round(2.4 * cpw));
    const xStride = Math.max(1, Math.round(0.12 * cpw));
    for (let probeX = xStart; probeX <= xEnd; probeX += xStride) {
      const candidate = profileAt(probeX);
      if (candidate.total > bestProfile.total) bestProfile = candidate;
    }
    const profile = bestProfile.values;
    const totalEnergy = bestProfile.total;
    const maxEnergy = bestProfile.peak;
    const smooth = profile.map((value, index) => {
      const prev = profile[Math.max(0, index - 1)];
      const next = profile[Math.min(profile.length - 1, index + 1)];
      return 0.25 * prev + 0.5 * value + 0.25 * next;
    });
    const centerIndex = Math.max(0, Math.min(smooth.length - 1, midY - y0));
    const centerHalf = Math.max(1, Math.round(0.12 * cpw));
    let centerEnergy = 0;
    let centerPeak = 0;
    for (let index = Math.max(0, centerIndex - centerHalf); index <= Math.min(smooth.length - 1, centerIndex + centerHalf); index += 1) {
      centerEnergy += smooth[index];
      centerPeak = Math.max(centerPeak, smooth[index]);
    }
    let mirroredDiff = 0;
    let mirroredSum = 0;
    const mirrorHalf = Math.min(centerIndex, smooth.length - centerIndex - 1);
    for (let offset = 1; offset <= mirrorHalf; offset += 1) {
      const a = smooth[centerIndex - offset];
      const b = smooth[centerIndex + offset];
      mirroredDiff += Math.abs(a - b);
      mirroredSum += Math.abs(a) + Math.abs(b);
    }
    const peakThreshold = 0.18 * maxEnergy;
    const minimumSeparation = Math.max(2, Math.round(0.16 * cpw));
    const peaks = [];
    for (let index = 1; index < smooth.length - 1; index += 1) {
      if (smooth[index] <= peakThreshold || smooth[index] < smooth[index - 1] || smooth[index] < smooth[index + 1]) continue;
      const last = peaks[peaks.length - 1];
      if (last && index - last.index < minimumSeparation) {
        if (smooth[index] > last.energy) {
          last.index = index;
          last.energy = smooth[index];
          last.y = y0 + index;
        }
      } else {
        peaks.push({ index, y: y0 + index, energy: smooth[index] });
      }
    }
    const slitPlaneX = midX;
    let apertureEnergy = 0;
    for (let y = midY - Math.round(0.35 * cpw); y <= midY + Math.round(0.35 * cpw); y += 1) {
      for (let x = slitPlaneX - Math.round(0.1 * cpw); x <= slitPlaneX + Math.round(0.1 * cpw); x += 1) {
        const idx = sim.id(Math.max(minX, Math.min(maxX, x)), Math.max(minY, Math.min(maxY, y)));
        if (sim.material[idx] !== 2) apertureEnergy += fieldEnergyAt(idx);
      }
    }
    const meanEnergy = totalEnergy / Math.max(1, smooth.length);
    return {
      kind: diffractionKind,
      probeXLambda: bestProfile.probeX / cpw,
      samples: smooth.length,
      totalEnergy,
      maxEnergy,
      meanEnergy,
      centerEnergy,
      centerPeak,
      centerPeakRatio: centerPeak / Math.max(1e-30, meanEnergy),
      centerEnergyFraction: centerEnergy / Math.max(1e-30, totalEnergy),
      symmetryError: mirroredDiff / Math.max(1e-30, mirroredSum),
      peaks: peaks.map((peak) => ({ yLambda: peak.y / cpw, energy: peak.energy })),
      peakCount: peaks.length,
      apertureEnergy,
    };
  }, kind);
}

async function maxwellBlockMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midY = Math.round(0.5 * (minY + maxY));
    const sources = state.sources || [];
    const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return finite(sim.analysisFieldEnergyDensityAt(idx));
      if (sim.material[idx] === 2) return 0;
      return finite(sim.ez[idx]) ** 2 + finite(sim.hx[idx]) ** 2 + finite(sim.hy[idx]) ** 2;
    };
    const sourceCells = sources.map((source) => ({
      x: typeof sim.sourceXCell === "function" ? sim.sourceXCell(source) : Math.round(finite(source.xLambda) * cpw),
      y: typeof sim.sourceYCell === "function" ? sim.sourceYCell(source) : Math.round(finite(source.yLambda) * cpw),
      angleDeg: finite(source.angleDeg),
    }));
    const sourceX = sourceCells.length ? mean(sourceCells.map((source) => source.x)) : Math.round(0.5 * (minX + maxX));
    const sourceY = sourceCells.length ? mean(sourceCells.map((source) => source.y)) : midY;
    const sourceAngleDeg = sourceCells.length ? mean(sourceCells.map((source) => source.angleDeg)) : 0;

    let materialCells = 0;
    let pecCells = 0;
    let totalEnergy = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    let upperEnergy = 0;
    let lowerEnergy = 0;
    let sxSum = 0;
    let sySum = 0;
    let sMagnitudeSum = 0;
    const flowX0 = Math.max(minX, Math.round(sourceX + 0.65 * cpw));
    const flowX1 = Math.min(maxX, Math.round(sourceX + 4.4 * cpw));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const idx = sim.id(x, y);
        const energy = energyAt(idx);
        totalEnergy += energy;
        if (sim.material[idx] !== 0 && sim.material[idx] !== 2) materialCells += 1;
        if (sim.material[idx] === 2) pecCells += 1;
        if (x < sourceX - Math.round(0.45 * cpw)) leftEnergy += energy;
        if (x > sourceX + Math.round(0.45 * cpw)) rightEnergy += energy;
        if (y < sourceY - Math.round(0.45 * cpw)) upperEnergy += energy;
        if (y > sourceY + Math.round(0.45 * cpw)) lowerEnergy += energy;
        if (x >= flowX0 && x <= flowX1 && sim.material[idx] !== 2 && typeof sim.poyntingAt === "function" && x % 2 === 0 && y % 2 === 0) {
          const s = sim.poyntingAt(idx);
          const sx = finite(s?.x);
          const sy = finite(s?.y);
          sxSum += sx;
          sySum += sy;
          sMagnitudeSum += Math.hypot(sx, sy);
        }
      }
    }

    const poyntingNorm = Math.hypot(sxSum, sySum);
    const poyntingAngleDeg = poyntingNorm > 1e-30 ? ((Math.atan2(sySum, sxSum) * 180) / Math.PI + 360) % 360 : null;
    const poyntingDirectionality = poyntingNorm / Math.max(1e-30, sMagnitudeSum);
    const poyntingExpectedAngleDeg = ((sourceAngleDeg % 360) + 360) % 360;
    const poyntingAngleErrorDeg =
      poyntingAngleDeg == null ? null : Math.abs((((poyntingAngleDeg - poyntingExpectedAngleDeg + 180) % 360) + 360) % 360 - 180);

    const bandEnergy = (centerX, halfXLambda = 0.045, yCenter = sourceY, halfYLambda = 2.8) => {
      let energy = 0;
      let cells = 0;
      const x0 = Math.max(minX, Math.round(centerX - halfXLambda * cpw));
      const x1 = Math.min(maxX, Math.round(centerX + halfXLambda * cpw));
      const y0 = Math.max(minY, Math.round(yCenter - halfYLambda * cpw));
      const y1 = Math.min(maxY, Math.round(yCenter + halfYLambda * cpw));
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          const idx = sim.id(x, y);
          if (sim.material[idx] === 2) continue;
          energy += energyAt(idx);
          cells += 1;
        }
      }
      return { energy, cells };
    };
    const evanescentNear = bandEnergy(sourceX + 0.08 * cpw, 0.035, sourceY, 2.2);
    const evanescentMid = bandEnergy(sourceX + 0.38 * cpw, 0.035, sourceY, 2.2);
    const evanescentFar = bandEnergy(sourceX + 0.9 * cpw, 0.035, sourceY, 2.2);

    const interferenceProfile = (() => {
      const probeX = Math.max(minX, Math.min(maxX, Math.round(sourceX + 2.25 * cpw)));
      const halfProbe = Math.max(1, Math.round(0.045 * cpw));
      const y0 = Math.max(minY + Math.round(0.25 * cpw), Math.round(sourceY - 3.0 * cpw));
      const y1 = Math.min(maxY - Math.round(0.25 * cpw), Math.round(sourceY + 3.0 * cpw));
      const values = [];
      for (let y = y0; y <= y1; y += 1) {
        let energy = 0;
        for (let x = Math.max(minX, probeX - halfProbe); x <= Math.min(maxX, probeX + halfProbe); x += 1) {
          energy += energyAt(sim.id(x, y));
        }
        values.push(energy);
      }
      const smooth = values.map((value, index) => {
        const prev = values[Math.max(0, index - 1)];
        const next = values[Math.min(values.length - 1, index + 1)];
        return 0.25 * prev + 0.5 * value + 0.25 * next;
      });
      const peak = smooth.length ? Math.max(...smooth) : 0;
      const meanEnergy = mean(smooth);
      const threshold = 0.2 * peak;
      const minSeparation = Math.max(2, Math.round(0.18 * cpw));
      const peaks = [];
      for (let i = 1; i < smooth.length - 1; i += 1) {
        if (smooth[i] <= threshold || smooth[i] < smooth[i - 1] || smooth[i] < smooth[i + 1]) continue;
        const last = peaks[peaks.length - 1];
        if (last && i - last.index < minSeparation) {
          if (smooth[i] > last.energy) {
            last.index = i;
            last.energy = smooth[i];
          }
        } else {
          peaks.push({ index: i, energy: smooth[i] });
        }
      }
      const centerIndex = Math.max(0, Math.min(smooth.length - 1, Math.round(sourceY) - y0));
      let mirroredDiff = 0;
      let mirroredSum = 0;
      const mirrorHalf = Math.min(centerIndex, smooth.length - centerIndex - 1);
      for (let offset = 1; offset <= mirrorHalf; offset += 1) {
        const a = smooth[centerIndex - offset];
        const b = smooth[centerIndex + offset];
        mirroredDiff += Math.abs(a - b);
        mirroredSum += Math.abs(a) + Math.abs(b);
      }
      const sorted = [...smooth].sort((a, b) => a - b);
      const low = sorted.length ? sorted[Math.floor(sorted.length * 0.15)] : 0;
      const high = sorted.length ? sorted[Math.floor(sorted.length * 0.85)] : 0;
      return {
        probeXLambda: probeX / cpw,
        samples: smooth.length,
        peakCount: peaks.length,
        peakToMeanRatio: peak / Math.max(1e-30, meanEnergy),
        visibility: (high - low) / Math.max(1e-30, high + low),
        symmetryError: mirroredDiff / Math.max(1e-30, mirroredSum),
      };
    })();

    return {
      preset: state.preset,
      fieldComponent: state.fieldComponent,
      sourceCount: sources.length,
      sourceShapes: sources.map((source) => source.shape || ""),
      sourceTypes: sources.map((source) => source.type || ""),
      materialCells,
      pecCells,
      totalEnergy,
      rightToLeftEnergyRatio: rightEnergy / Math.max(1e-30, leftEnergy),
      lowerToUpperEnergyRatio: lowerEnergy / Math.max(1e-30, upperEnergy),
      poyntingAngleDeg,
      poyntingAngleErrorDeg,
      poyntingDirectionality,
      evanescentNearEnergy: evanescentNear.energy,
      evanescentMidEnergy: evanescentMid.energy,
      evanescentFarEnergy: evanescentFar.energy,
      evanescentNearToFarRatio: evanescentNear.energy / Math.max(1e-30, evanescentFar.energy),
      evanescentMidToFarRatio: evanescentMid.energy / Math.max(1e-30, evanescentFar.energy),
      interference: interferenceProfile,
    };
  });
}

async function interfaceOpticsMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const source = state.sources?.[0] || {};
    const sourceAngleDeg = Number(source.angleDeg) || 0;
    const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const sampleFlow = (x0, x1) => {
      let sxSum = 0;
      let sySum = 0;
      let magnitudeSum = 0;
      let energy = 0;
      let cells = 0;
      for (let y = minY; y <= maxY; y += 2) {
        for (let x = Math.max(minX, x0); x <= Math.min(maxX, x1); x += 2) {
          const idx = sim.id(x, y);
          if (sim.material[idx] === 2 || typeof sim.poyntingAt !== "function") continue;
          const s = sim.poyntingAt(idx);
          const sx = finite(s?.x);
          const sy = finite(s?.y);
          const e =
            typeof sim.analysisFieldEnergyDensityAt === "function"
              ? finite(sim.analysisFieldEnergyDensityAt(idx))
              : finite(sim.ez[idx]) ** 2 + finite(sim.hx[idx]) ** 2 + finite(sim.hy[idx]) ** 2;
          sxSum += sx;
          sySum += sy;
          magnitudeSum += Math.hypot(sx, sy);
          energy += e;
          cells += 1;
        }
      }
      const norm = Math.hypot(sxSum, sySum);
      return {
        cells,
        energy,
        angleDeg: norm > 1e-30 ? ((Math.atan2(sySum, sxSum) * 180) / Math.PI + 360) % 360 : null,
        directionality: norm / Math.max(1e-30, magnitudeSum),
      };
    };
    const beamCentroidFit = (x0, x1) => {
      const points = [];
      for (let x = Math.max(minX, x0); x <= Math.min(maxX, x1); x += 1) {
        let energy = 0;
        let yWeighted = 0;
        for (let y = minY; y <= maxY; y += 1) {
          const idx = sim.id(x, y);
          if (sim.material[idx] === 2) continue;
          const e =
            typeof sim.analysisFieldEnergyDensityAt === "function"
              ? finite(sim.analysisFieldEnergyDensityAt(idx))
              : finite(sim.ez[idx]) ** 2 + finite(sim.hx[idx]) ** 2 + finite(sim.hy[idx]) ** 2;
          energy += e;
          yWeighted += y * e;
        }
        if (energy > 1e-16) points.push({ x, y: yWeighted / energy, weight: energy });
      }
      if (points.length < 6) return null;
      const maxWeight = Math.max(...points.map((point) => point.weight));
      const filtered = points.filter((point) => point.weight >= 0.08 * maxWeight);
      const fitPoints = filtered.length >= 6 ? filtered : points;
      let weightSum = 0;
      let xMean = 0;
      let yMean = 0;
      for (const point of fitPoints) {
        weightSum += point.weight;
        xMean += point.weight * point.x;
        yMean += point.weight * point.y;
      }
      xMean /= Math.max(1e-30, weightSum);
      yMean /= Math.max(1e-30, weightSum);
      let numerator = 0;
      let denominator = 0;
      for (const point of fitPoints) {
        numerator += point.weight * (point.x - xMean) * (point.y - yMean);
        denominator += point.weight * (point.x - xMean) * (point.x - xMean);
      }
      const slope = denominator > 1e-30 ? numerator / denominator : 0;
      return {
        samples: fitPoints.length,
        angleDeg: (Math.atan(slope) * 180) / Math.PI,
        energy: fitPoints.reduce((sum, point) => sum + point.weight, 0),
      };
    };
    let epsSum = 0;
    let epsCells = 0;
    let materialEnergy = 0;
    let totalEnergy = 0;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const idx = sim.id(x, y);
        const e =
          typeof sim.analysisFieldEnergyDensityAt === "function"
            ? finite(sim.analysisFieldEnergyDensityAt(idx))
            : finite(sim.ez[idx]) ** 2 + finite(sim.hx[idx]) ** 2 + finite(sim.hy[idx]) ** 2;
        totalEnergy += e;
        if (x > midX && sim.material[idx] !== 0 && sim.material[idx] !== 2) {
          epsSum += Math.max(1e-9, Math.abs(finite(sim.eps[idx], 1)));
          epsCells += 1;
          materialEnergy += e;
        }
      }
    }
    const n2 = Math.sqrt(epsSum / Math.max(1, epsCells));
    const sinT = Math.sin((sourceAngleDeg * Math.PI) / 180) / Math.max(1e-9, n2);
    const expectedTransmittedAngleDeg = Math.asin(Math.max(-1, Math.min(1, sinT))) * 180 / Math.PI;
    const transmitted = sampleFlow(midX + Math.round(0.55 * cpw), midX + Math.round(3.2 * cpw));
    const incident = sampleFlow(Math.max(minX, midX - Math.round(4.5 * cpw)), midX - Math.round(0.6 * cpw));
    const incidentCentroid = beamCentroidFit(Math.max(minX, midX - Math.round(4.5 * cpw)), midX - Math.round(0.6 * cpw));
    const transmittedCentroid = beamCentroidFit(midX + Math.round(0.35 * cpw), midX + Math.round(3.2 * cpw));
    const transmittedAngleErrorDeg =
      transmitted.angleDeg == null
        ? null
        : Math.abs((((transmitted.angleDeg - expectedTransmittedAngleDeg + 180) % 360) + 360) % 360 - 180);
    const transmittedCentroidAngleErrorDeg =
      transmittedCentroid?.angleDeg == null ? null : Math.abs(transmittedCentroid.angleDeg - expectedTransmittedAngleDeg);
    return {
      preset: state.preset,
      sourceAngleDeg,
      n2,
      expectedTransmittedAngleDeg,
      transmittedAngleErrorDeg,
      transmittedCentroidAngleErrorDeg,
      materialEnergyFraction: materialEnergy / Math.max(1e-30, totalEnergy),
      incident,
      transmitted,
      incidentCentroid,
      transmittedCentroid,
    };
  });
}

async function dispersiveAdeMetrics(page) {
  return page.evaluate(() => {
    const arrayStats = (array, mask) => {
      let count = 0;
      let nonFinite = 0;
      let maxAbs = 0;
      let sumAbs = 0;
      for (let i = 0; i < array.length; i += 1) {
        if (mask && !mask(i)) continue;
        const value = Number(array[i]);
        if (!Number.isFinite(value)) {
          nonFinite += 1;
          continue;
        }
        const abs = Math.abs(value);
        maxAbs = Math.max(maxAbs, abs);
        sumAbs += abs;
        count += 1;
      }
      return { count, nonFinite, maxAbs, sumAbs };
    };
    const dispersiveMask = (idx) => Boolean(sim.dispersiveMaterial?.[idx] || sim.muDispersiveMaterial?.[idx]);
    const electricCurrent = ["dispJz", "dispJx", "dispJy"].map((name) => ({ name, ...arrayStats(sim[name], dispersiveMask) }));
    const electricPolarization = ["dispPz", "dispPx", "dispPy"].map((name) => ({ name, ...arrayStats(sim[name], dispersiveMask) }));
    const magneticCurrent = ["magDispJz", "magDispJx", "magDispJy"].map((name) => ({ name, ...arrayStats(sim[name], dispersiveMask) }));
    const dispersiveCells = arrayStats(sim.dispersiveMaterial, () => true).sumAbs + arrayStats(sim.muDispersiveMaterial, () => true).sumAbs;
    let effectiveEpsSum = 0;
    let effectiveEpsCount = 0;
    const omega = 2 * Math.PI * (typeof sim.diagnosticFrequency === "function" ? sim.diagnosticFrequency() : Number(state.sourceFrequency) || 0.035);
    for (let i = 0; i < sim.n; i += 1) {
      if (!sim.dispersiveMaterial?.[i]) continue;
      const value = typeof sim.effectiveScalarEpsilonAt === "function" ? sim.effectiveScalarEpsilonAt(i, omega) : sim.eps[i];
      if (!Number.isFinite(value)) continue;
      effectiveEpsSum += value;
      effectiveEpsCount += 1;
    }
    const maxElectricCurrent = electricCurrent.reduce((max, item) => Math.max(max, item.maxAbs), 0);
    const maxElectricPolarization = electricPolarization.reduce((max, item) => Math.max(max, item.maxAbs), 0);
    const maxMagneticCurrent = magneticCurrent.reduce((max, item) => Math.max(max, item.maxAbs), 0);
    return {
      enabled: Boolean(state.materialDispersionEnabled),
      model: state.dispersionModel,
      engine: sim.engineLabel?.() || "",
      dispersiveCells,
      effectiveEps: effectiveEpsCount > 0 ? effectiveEpsSum / effectiveEpsCount : null,
      maxElectricCurrent,
      maxElectricPolarization,
      maxMagneticCurrent,
      electricCurrent,
      electricPolarization,
      magneticCurrent,
    };
  });
}

async function materialModelMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const omega = 2 * Math.PI * (typeof sim.diagnosticFrequency === "function" ? sim.diagnosticFrequency() : Number(state.sourceFrequency) || 0.035);
    const finite = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
    const fieldEnergyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return finite(sim.analysisFieldEnergyDensityAt(idx));
      if (sim.material[idx] === 2) return 0;
      const primary = finite(sim.ez[idx]) ** 2 + finite(sim.hx[idx]) ** 2 + finite(sim.hy[idx]) ** 2;
      const dual = finite(sim.dualEz?.[idx]) ** 2 + finite(sim.dualHx?.[idx]) ** 2 + finite(sim.dualHy?.[idx]) ** 2;
      return primary + dual;
    };
    const emptyBounds = () => ({ minX: maxX + 1, maxX: minX - 1, minY: maxY + 1, maxY: minY - 1, cells: 0 });
    const updateBounds = (bounds, x, y) => {
      bounds.minX = Math.min(bounds.minX, x);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxY = Math.max(bounds.maxY, y);
      bounds.cells += 1;
    };
    const finalizeBounds = (bounds) => (bounds.cells > 0 ? bounds : null);
    const materialBounds = emptyBounds();
    const conductiveBounds = emptyBounds();
    const dispersiveBounds = emptyBounds();
    const tensorDiagnostics = typeof sim.materialTensorDiagnostics === "function" ? sim.materialTensorDiagnostics() : null;
    const counts = {
      materialCells: 0,
      conductiveCells: 0,
      dispersiveCells: 0,
      drudeLikeCells: 0,
      lorentzCells: 0,
      debyeCells: 0,
      magneticDispersiveCells: 0,
      anisotropicCells: 0,
      negativeEpsilonCells: 0,
      gyrotropicCells: 0,
      bianisotropicCells: 0,
    };
    const epsStats = {
      epsMean: 0,
      epsYMean: 0,
      epsDeltaMax: 0,
      effectiveEpsMean: null,
      effectiveEpsMin: null,
      effectiveEpsMax: null,
      effectiveEpsAbsMean: null,
    };
    let epsSum = 0;
    let epsYSum = 0;
    let effectiveSum = 0;
    let effectiveAbsSum = 0;
    let effectiveCount = 0;
    let totalEnergy = 0;
    let materialEnergy = 0;
    let conductiveEnergy = 0;
    let dispersiveEnergy = 0;
    let maxSigma = 0;
    let sigmaSum = 0;
    let maxGyrotropy = 0;
    let kappaAbsSum = 0;
    let maxAbsKappa = 0;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const idx = sim.id(x, y);
        if (sim.material[idx] === 2) continue;
        const energy = fieldEnergyAt(idx);
        totalEnergy += energy;
        const isMaterial = sim.material[idx] !== 0;
        const sigma = Math.max(finite(sim.conductivity?.[idx]), finite(sim.conductivityY?.[idx]));
        const dispersiveKind = Number(sim.dispersiveMaterial?.[idx]) || 0;
        const magneticKind = Number(sim.muDispersiveMaterial?.[idx]) || 0;
        const eps = finite(sim.eps?.[idx]);
        const epsY = finite(sim.epsY?.[idx]);
        const isAnisotropic = Math.abs(eps - epsY) > 1e-9;
        if (isMaterial) {
          updateBounds(materialBounds, x, y);
          counts.materialCells += 1;
          materialEnergy += energy;
          epsSum += eps;
          epsYSum += epsY;
          epsStats.epsDeltaMax = Math.max(epsStats.epsDeltaMax, Math.abs(eps - epsY));
          if (eps < 0 || epsY < 0) counts.negativeEpsilonCells += 1;
        }
        if (sigma > 0) {
          updateBounds(conductiveBounds, x, y);
          counts.conductiveCells += 1;
          conductiveEnergy += energy;
          maxSigma = Math.max(maxSigma, sigma);
          sigmaSum += sigma;
        }
        if (dispersiveKind || magneticKind) {
          updateBounds(dispersiveBounds, x, y);
          counts.dispersiveCells += dispersiveKind ? 1 : 0;
          counts.magneticDispersiveCells += magneticKind ? 1 : 0;
          if (dispersiveKind === 1) counts.drudeLikeCells += 1;
          if (dispersiveKind === 2) counts.lorentzCells += 1;
          if (dispersiveKind === 3) counts.debyeCells += 1;
          dispersiveEnergy += energy;
          if (dispersiveKind && typeof sim.effectiveScalarEpsilonAt === "function") {
            const effective = sim.effectiveScalarEpsilonAt(idx, omega);
            if (Number.isFinite(effective)) {
              effectiveSum += effective;
              effectiveAbsSum += Math.abs(effective);
              effectiveCount += 1;
              epsStats.effectiveEpsMin = epsStats.effectiveEpsMin === null ? effective : Math.min(epsStats.effectiveEpsMin, effective);
              epsStats.effectiveEpsMax = epsStats.effectiveEpsMax === null ? effective : Math.max(epsStats.effectiveEpsMax, effective);
            }
          }
        }
        if (isAnisotropic) counts.anisotropicCells += 1;
        if (sim.gyrotropicMaterial?.[idx]) {
          counts.gyrotropicCells += 1;
          maxGyrotropy = Math.max(maxGyrotropy, Math.abs(finite(sim.gyrotropyG?.[idx])));
        }
        if (sim.bianisotropicMaterial?.[idx]) {
          counts.bianisotropicCells += 1;
          const kappa = Math.abs(finite(sim.bianisotropyKappa?.[idx]));
          kappaAbsSum += kappa;
          maxAbsKappa = Math.max(maxAbsKappa, kappa);
        }
      }
    }
    epsStats.epsMean = counts.materialCells > 0 ? epsSum / counts.materialCells : 0;
    epsStats.epsYMean = counts.materialCells > 0 ? epsYSum / counts.materialCells : 0;
    epsStats.effectiveEpsMean = effectiveCount > 0 ? effectiveSum / effectiveCount : null;
    epsStats.effectiveEpsAbsMean = effectiveCount > 0 ? effectiveAbsSum / effectiveCount : null;

    const sumBoxEnergy = (x0, x1, y0, y1) => {
      let energy = 0;
      let cells = 0;
      for (let y = Math.max(minY, y0); y <= Math.min(maxY, y1); y += 1) {
        for (let x = Math.max(minX, x0); x <= Math.min(maxX, x1); x += 1) {
          energy += fieldEnergyAt(sim.id(x, y));
          cells += 1;
        }
      }
      return { energy, cells };
    };
    let conductorSkinDepth = null;
    const finalizedConductiveBounds = finalizeBounds(conductiveBounds);
    if (finalizedConductiveBounds) {
      const bandWidth = Math.max(2, Math.round(0.32 * cpw));
      const deepOffset = Math.max(bandWidth + 1, Math.round(0.9 * cpw));
      const entrance = sumBoxEnergy(
        finalizedConductiveBounds.minX,
        finalizedConductiveBounds.minX + bandWidth,
        finalizedConductiveBounds.minY,
        finalizedConductiveBounds.maxY,
      );
      const deep = sumBoxEnergy(
        finalizedConductiveBounds.minX + deepOffset,
        finalizedConductiveBounds.minX + deepOffset + bandWidth,
        finalizedConductiveBounds.minY,
        finalizedConductiveBounds.maxY,
      );
      conductorSkinDepth = {
        entranceEnergy: entrance.energy,
        deepEnergy: deep.energy,
        deepToEntranceRatio: deep.energy / Math.max(1e-30, entrance.energy),
        entranceCells: entrance.cells,
        deepCells: deep.cells,
      };
    }

    const analysis = state.analysisEnabled && typeof sim.analysisMetricEstimate === "function" ? sim.analysisMetricEstimate() : null;
    const bianisotropy =
      analysis?.bianisotropy ?? (typeof sim.bianisotropyQuantitativeEstimate === "function" ? sim.bianisotropyQuantitativeEstimate() : null);
    const fullVectorBianisotropy =
      typeof sim.fullVectorBianisotropyDiagnostics === "function" ? sim.fullVectorBianisotropyDiagnostics() : null;

    return {
      engine: sim.engineLabel?.() || "",
      fieldComponent: state.fieldComponent,
      materialDispersionEnabled: Boolean(state.materialDispersionEnabled),
      materialConductivityEnabled: Boolean(state.materialConductivityEnabled),
      materialGyrotropyEnabled: Boolean(state.materialGyrotropyEnabled),
      materialBianisotropyEnabled: Boolean(state.materialBianisotropyEnabled),
      materialFullVectorBianisotropyEnabled: Boolean(state.materialFullVectorBianisotropyEnabled),
      dispersionModel: state.dispersionModel,
      counts,
      epsStats,
      tensorDiagnostics,
      materialBounds: finalizeBounds(materialBounds),
      conductiveBounds: finalizedConductiveBounds,
      dispersiveBounds: finalizeBounds(dispersiveBounds),
      energy: {
        totalEnergy,
        materialEnergy,
        conductiveEnergy,
        dispersiveEnergy,
        materialEnergyFraction: materialEnergy / Math.max(1e-30, totalEnergy),
        conductiveEnergyFraction: conductiveEnergy / Math.max(1e-30, totalEnergy),
        dispersiveEnergyFraction: dispersiveEnergy / Math.max(1e-30, totalEnergy),
      },
      conductivity: {
        maxSigma,
        meanSigma: counts.conductiveCells > 0 ? sigmaSum / counts.conductiveCells : 0,
        skinDepthProxy: conductorSkinDepth,
      },
      gyrotropy: {
        maxAbsG: maxGyrotropy,
      },
      bianisotropy: {
        meanAbsKappa: counts.bianisotropicCells > 0 ? kappaAbsSum / counts.bianisotropicCells : 0,
        maxAbsKappa,
        quantitative: bianisotropy,
        fullVector: fullVectorBianisotropy,
      },
    };
  });
}

async function plasmonicSurfaceMetrics(page) {
  return page.evaluate(() => {
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const rowCounts = [];
    for (let y = minY; y <= maxY; y += 1) {
      let count = 0;
      for (let x = minX; x <= maxX; x += 1) {
        const idx = sim.id(x, y);
        if (sim.dispersiveMaterial?.[idx]) count += 1;
      }
      rowCounts.push({ y, count });
    }
    const fullRowThreshold = Math.max(8, Math.round((maxX - minX + 1) * 0.55));
    const baseRow = rowCounts.find((row) => row.count >= fullRowThreshold);
    const interfaceY = baseRow?.y ?? rowCounts.reduce((best, row) => (row.count > best.count ? row : best), { y: Math.round((minY + maxY) / 2), count: 0 }).y;
    const source = state.sources?.[0] || null;
    const sourceX = source ? sim.sourceXCell(source) : minX;
    const x0 = Math.max(minX, sourceX + Math.round(0.35 * cpw));
    const x1 = Math.min(maxX, x0 + Math.round(5.2 * cpw));
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return sim.analysisFieldEnergyDensityAt(idx);
      if (sim.material[idx] === 2) return 0;
      return sim.ez[idx] * sim.ez[idx] + sim.hx[idx] * sim.hx[idx] + sim.hy[idx] * sim.hy[idx];
    };
    const sumRegion = (yStart, yEnd) => {
      let energy = 0;
      let samples = 0;
      for (let y = Math.max(minY, yStart); y <= Math.min(maxY, yEnd); y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          const value = energyAt(sim.id(x, y));
          if (Number.isFinite(value) && value > 0) energy += value;
          samples += 1;
        }
      }
      return { energy, samples };
    };
    const nearHalf = Math.max(2, Math.round(0.18 * cpw));
    const farOffset = Math.max(nearHalf + 2, Math.round(0.65 * cpw));
    const surface = sumRegion(interfaceY - nearHalf, interfaceY + nearHalf);
    const airFar = sumRegion(interfaceY - farOffset - nearHalf, interfaceY - farOffset);
    const metalBulk = sumRegion(interfaceY + farOffset, interfaceY + farOffset + nearHalf);
    const total = surface.energy + airFar.energy + metalBulk.energy;
    let gratingCells = 0;
    for (let y = Math.max(minY, interfaceY - Math.round(0.22 * cpw)); y < interfaceY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (sim.dispersiveMaterial?.[sim.id(x, y)]) gratingCells += 1;
      }
    }
    return {
      fieldComponent: state.fieldComponent,
      dispersionEnabled: Boolean(state.materialDispersionEnabled),
      dispersiveRows: rowCounts.filter((row) => row.count > 0).length,
      interfaceYLambda: interfaceY / cpw,
      xStartLambda: x0 / cpw,
      xEndLambda: x1 / cpw,
      surfaceEnergy: surface.energy,
      airFarEnergy: airFar.energy,
      metalBulkEnergy: metalBulk.energy,
      totalEnergy: total,
      surfaceFraction: surface.energy / Math.max(1e-30, total),
      surfaceToAirRatio: surface.energy / Math.max(1e-30, airFar.energy),
      surfaceToBulkRatio: surface.energy / Math.max(1e-30, metalBulk.energy),
      gratingCellsAboveInterface: gratingCells,
    };
  });
}

async function negativeIndexMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const metrics = sim.analysisMetricEstimate?.()?.negativeIndex ?? null;
    return {
      analysisSamples: sim.analysisSamples || 0,
      metrics,
    };
  });
}

async function metamaterialMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const analysis = state.analysisEnabled && typeof sim.analysisMetricEstimate === "function" ? sim.analysisMetricEstimate() : null;
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const finite = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return finite(sim.analysisFieldEnergyDensityAt(idx));
      if (sim.material[idx] === 2) return 0;
      return finite(sim.ez[idx]) ** 2 + finite(sim.hx[idx]) ** 2 + finite(sim.hy[idx]) ** 2;
    };
    const epsAbsAt = (idx) => Math.max(Math.abs(finite(sim.eps?.[idx])), Math.abs(finite(sim.epsY?.[idx])));
    const highIndexAt = (idx) => sim.material[idx] !== 0 && sim.material[idx] !== 2 && epsAbsAt(idx) > 3.0;
    const dispersiveAt = (idx) => Boolean(sim.dispersiveMaterial?.[idx] || sim.muDispersiveMaterial?.[idx]);
    const lossyAt = (idx) =>
      Math.max(Math.abs(finite(sim.loss?.[idx])), Math.abs(finite(sim.lossY?.[idx])), Math.abs(finite(sim.muLoss?.[idx])), Math.abs(finite(sim.muLossY?.[idx]))) > 1e-6;
    const box = (x, y, halfXLambda, halfYLambda, cx = midX, cy = midY) =>
      Math.abs(x - cx) <= Math.round(halfXLambda * cpw) && Math.abs(y - cy) <= Math.round(halfYLambda * cpw);
    const ellipse = (x, y, cx, cy, rx, ry) => {
      const dx = (x - cx) / Math.max(1, rx);
      const dy = (y - cy) / Math.max(1, ry);
      return dx * dx + dy * dy <= 1;
    };
    const localizedCx = midX + Math.round(0.35 * cpw);
    const localizedRx = Math.max(2, Math.round(0.38 * cpw));
    const dimerCx = midX + Math.round(0.48 * cpw);
    const dimerCy1 = midY - Math.round(0.31 * cpw);
    const dimerCy2 = midY + Math.round(0.31 * cpw);
    const dimerCy = midY;
    const dimerR = Math.max(2, Math.round(0.25 * cpw));
    const enzX0 = midX + Math.round(0.25 * cpw);
    const enzX1 = enzX0 + Math.round(0.45 * cpw);

    let materialCells = 0;
    let highIndexCells = 0;
    let dispersiveCells = 0;
    let drudeCells = 0;
    let lossyCells = 0;
    let pecCells = 0;
    let tensorLikeCells = 0;
    let totalEnergy = 0;
    let materialEnergy = 0;
    let dispersiveEnergy = 0;
    let localizedDiskCells = 0;
    let localizedDiskEnergy = 0;
    let localizedNearEnergy = 0;
    let dimerDisk1Cells = 0;
    let dimerDisk2Cells = 0;
    let dimerDiskEnergy = 0;
    let dimerGapEnergy = 0;
    let dimerGapCells = 0;
    let dimerGapE2 = 0;
    let dimerGapPeakE2 = 0;
    let dimerBackgroundCells = 0;
    let dimerBackgroundE2 = 0;
    let metasurfaceMaterialCells = 0;
    let absorberLossMin = Infinity;
    let absorberLossMax = 0;
    let absorberPecBackplaneCells = 0;
    let enzCells = 0;
    let enzEnergy = 0;
    let effectiveEpsSum = 0;
    let effectiveEpsAbsSum = 0;
    let effectiveEpsCount = 0;
    const omega = 2 * Math.PI * (typeof sim.diagnosticFrequency === "function" ? sim.diagnosticFrequency() : Number(state.sourceFrequency) || 0.035);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const idx = sim.id(x, y);
        const energy = energyAt(idx);
        totalEnergy += energy;
        const isMaterial = sim.material[idx] !== 0;
        const isDispersive = dispersiveAt(idx);
        const isHigh = highIndexAt(idx);
        const isLocalizedDisk = ellipse(x, y, localizedCx, midY, localizedRx, localizedRx);
        const localizedDistance = Math.hypot(x - localizedCx, y - midY);
        const inLocalizedNear = localizedDistance > localizedRx && localizedDistance <= localizedRx + Math.round(0.28 * cpw);
        const e2 =
          state.fieldComponent === "hz"
            ? finite(sim.hx?.[idx]) ** 2 + finite(sim.hy?.[idx]) ** 2
            : finite(sim.ez?.[idx]) ** 2;
        const inDimer1 = ellipse(x, y, dimerCx, dimerCy1, dimerR, dimerR);
        const inDimer2 = ellipse(x, y, dimerCx, dimerCy2, dimerR, dimerR);
        const inDimerGap = box(x, y, 0.13, 0.055, dimerCx, dimerCy);
        const inDimerBackground = box(x, y, 0.34, 0.34, dimerCx - Math.round(1.05 * cpw), dimerCy);
        const inEnzSlab = x >= enzX0 && x <= enzX1 && y >= minY + Math.round(0.7 * cpw) && y <= maxY - Math.round(0.7 * cpw);

        if (isMaterial) {
          materialCells += 1;
          materialEnergy += energy;
        }
        if (isHigh) highIndexCells += 1;
        if (isDispersive) {
          dispersiveCells += 1;
          dispersiveEnergy += energy;
          if (Number(sim.dispersiveMaterial?.[idx]) === 1 || Number(sim.muDispersiveMaterial?.[idx]) === 1) drudeCells += 1;
          if (typeof sim.effectiveScalarEpsilonAt === "function") {
            const effective = sim.effectiveScalarEpsilonAt(idx, omega);
            if (Number.isFinite(effective)) {
              effectiveEpsSum += effective;
              effectiveEpsAbsSum += Math.abs(effective);
              effectiveEpsCount += 1;
            }
          }
        }
        if (lossyAt(idx)) {
          lossyCells += 1;
          const loss = Math.max(
            Math.abs(finite(sim.loss?.[idx])),
            Math.abs(finite(sim.lossY?.[idx])),
            Math.abs(finite(sim.muLoss?.[idx])),
            Math.abs(finite(sim.muLossY?.[idx])),
          );
          absorberLossMin = Math.min(absorberLossMin, loss);
          absorberLossMax = Math.max(absorberLossMax, loss);
        }
        if (sim.material[idx] === 2) {
          pecCells += 1;
          if (x > midX && box(x, y, 1.0, 5.8, midX + Math.round(1.3 * cpw), midY)) absorberPecBackplaneCells += 1;
        }
        if (Math.abs(finite(sim.epsXY?.[idx])) > 1e-9 || Math.abs(finite(sim.eps?.[idx]) - finite(sim.epsY?.[idx])) > 1e-9) tensorLikeCells += 1;
        if (isLocalizedDisk && isDispersive) localizedDiskCells += 1;
        if (isLocalizedDisk) localizedDiskEnergy += energy;
        if (inLocalizedNear) localizedNearEnergy += energy;
        if (inDimer1 && isDispersive) dimerDisk1Cells += 1;
        if (inDimer2 && isDispersive) dimerDisk2Cells += 1;
        if (inDimer1 || inDimer2) dimerDiskEnergy += energy;
        if (inDimerGap) dimerGapEnergy += energy;
        if (inDimerGap && !isMaterial) {
          dimerGapCells += 1;
          dimerGapE2 += e2;
          dimerGapPeakE2 = Math.max(dimerGapPeakE2, e2);
        }
        if (inDimerBackground && !isMaterial) {
          dimerBackgroundCells += 1;
          dimerBackgroundE2 += e2;
        }
        if (Math.abs(x - midX) <= Math.round(0.12 * cpw) && isHigh) metasurfaceMaterialCells += 1;
        if (inEnzSlab && isDispersive) {
          enzCells += 1;
          enzEnergy += energy;
        }
      }
    }

    const barHeights = [];
    for (let i = -7; i <= 7; i += 1) {
      const centerY = midY + Math.round(i * 0.28 * cpw);
      let yMin = Infinity;
      let yMax = -Infinity;
      let cells = 0;
      for (let y = Math.max(minY, centerY - Math.round(0.28 * cpw)); y <= Math.min(maxY, centerY + Math.round(0.28 * cpw)); y += 1) {
        for (let x = Math.max(minX, midX - Math.round(0.08 * cpw)); x <= Math.min(maxX, midX + Math.round(0.08 * cpw)); x += 1) {
          const idx = sim.id(x, y);
          if (!highIndexAt(idx)) continue;
          yMin = Math.min(yMin, y);
          yMax = Math.max(yMax, y);
          cells += 1;
        }
      }
      if (cells > 0) barHeights.push((yMax - yMin + 1) / cpw);
    }
    const barHeightMin = barHeights.length > 0 ? Math.min(...barHeights) : 0;
    const barHeightMax = barHeights.length > 0 ? Math.max(...barHeights) : 0;
    const absorptionProxy =
      sim.diagnosticSamples > 0 ? Math.max(0, Math.min(1, 1 - (sim.diagnosticReflectance || 0) - (sim.diagnosticTransmittance || 0))) : null;

    return {
      preset: state.preset,
      fieldComponent: state.fieldComponent,
      fieldDisplay: state.fieldDisplay,
      viewMode: state.viewMode,
      sourceShape: state.sources?.[0]?.shape || "",
      analysisSamples: sim.analysisSamples || 0,
      dispersionEnabled: Boolean(state.materialDispersionEnabled),
      dispersionModel: state.dispersionModel,
      materialCells,
      highIndexCells,
      dispersiveCells,
      drudeCells,
      lossyCells,
      pecCells,
      tensorLikeCells,
      totalEnergy,
      materialEnergy,
      materialEnergyFraction: materialEnergy / Math.max(1e-30, totalEnergy),
      dispersiveEnergy,
      dispersiveEnergyFraction: dispersiveEnergy / Math.max(1e-30, totalEnergy),
      localizedDiskCells,
      localizedDiskEnergy,
      localizedNearEnergy,
      localizedNearToDiskRatio: localizedNearEnergy / Math.max(1e-30, localizedDiskEnergy),
      dimerDisk1Cells,
      dimerDisk2Cells,
      dimerDiskEnergy,
      dimerGapEnergy,
      dimerGapToDiskRatio: dimerGapEnergy / Math.max(1e-30, dimerDiskEnergy),
      dimerGapCells,
      dimerGapPeakE2,
      dimerGapMeanE2: dimerGapE2 / Math.max(1, dimerGapCells),
      dimerBackgroundMeanE2: dimerBackgroundE2 / Math.max(1, dimerBackgroundCells),
      dimerGapPeakToBackgroundRatio: dimerGapPeakE2 / Math.max(1e-30, dimerBackgroundE2 / Math.max(1, dimerBackgroundCells)),
      dimerGapMeanToBackgroundRatio: (dimerGapE2 / Math.max(1, dimerGapCells)) / Math.max(1e-30, dimerBackgroundE2 / Math.max(1, dimerBackgroundCells)),
      metasurfaceMaterialCells,
      metasurfaceBarCount: barHeights.length,
      metasurfaceHeightSpanLambda: barHeightMax - barHeightMin,
      absorberLossMin: Number.isFinite(absorberLossMin) ? absorberLossMin : 0,
      absorberLossMax,
      absorberLossGradient: Math.max(0, absorberLossMax - (Number.isFinite(absorberLossMin) ? absorberLossMin : 0)),
      absorberPecBackplaneCells,
      diagnosticSamples: sim.diagnosticSamples || 0,
      reflectance: sim.diagnosticReflectance || 0,
      transmittance: sim.diagnosticTransmittance || 0,
      absorptionProxy,
      hyperlens: analysis?.hyperlens ?? null,
      enzCells,
      enzEnergy,
      enzEnergyFraction: enzEnergy / Math.max(1e-30, totalEnergy),
      effectiveEpsMean: effectiveEpsCount > 0 ? effectiveEpsSum / effectiveEpsCount : null,
      effectiveEpsAbsMean: effectiveEpsCount > 0 ? effectiveEpsAbsSum / effectiveEpsCount : null,
    };
  });
}

async function nonlinearMediaMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const analysis = state.analysisEnabled && typeof sim.analysisMetricEstimate === "function" ? sim.analysisMetricEstimate() : null;
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const finite = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return finite(sim.analysisFieldEnergyDensityAt(idx));
      if (sim.material[idx] === 2) return 0;
      return finite(sim.ez[idx]) ** 2 + finite(sim.hx[idx]) ** 2 + finite(sim.hy[idx]) ** 2;
    };
    const box = (x, y, halfXLambda, halfYLambda, cx = midX, cy = midY) =>
      Math.abs(x - cx) <= Math.round(halfXLambda * cpw) && Math.abs(y - cy) <= Math.round(halfYLambda * cpw);
    let materialCells = 0;
    let nonlinearCells = 0;
    let phaseChangeCells = 0;
    let lossyCells = 0;
    let highIndexCells = 0;
    let totalEnergy = 0;
    let materialEnergy = 0;
    let nonlinearEnergy = 0;
    let phaseChangeEnergy = 0;
    let guideEnergy = 0;
    let activeSectionEnergy = 0;
    let upperArmEnergy = 0;
    let lowerArmEnergy = 0;
    let limiterEnergy = 0;
    let phaseStateSum = 0;
    let phaseStateMax = 0;
    let switchedCells = 0;
    let lossMax = 0;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const idx = sim.id(x, y);
        const energy = energyAt(idx);
        totalEnergy += energy;
        const isMaterial = sim.material[idx] !== 0 && sim.material[idx] !== 2;
        const isNonlinear = Boolean(sim.nonlinearMaterial?.[idx]);
        const isPhase = Boolean(sim.phaseChangeMaterial?.[idx]);
        const loss = Math.max(Math.abs(finite(sim.loss?.[idx])), Math.abs(finite(sim.lossY?.[idx])));
        if (isMaterial) {
          materialCells += 1;
          materialEnergy += energy;
          if (Math.max(Math.abs(finite(sim.eps?.[idx])), Math.abs(finite(sim.epsY?.[idx]))) > 3.0) highIndexCells += 1;
        }
        if (isNonlinear) {
          nonlinearCells += 1;
          nonlinearEnergy += energy;
        }
        if (isPhase) {
          phaseChangeCells += 1;
          phaseChangeEnergy += energy;
          const phase = finite(sim.phaseState?.[idx]);
          phaseStateSum += phase;
          phaseStateMax = Math.max(phaseStateMax, phase);
          if (phase > 0.05) switchedCells += 1;
        }
        if (loss > 1e-6) {
          lossyCells += 1;
          lossMax = Math.max(lossMax, loss);
        }
        if (Math.abs(y - midY) <= Math.round(0.42 * cpw)) guideEnergy += energy;
        if (box(x, y, 0.65, 0.55, midX + Math.round(0.1 * cpw), midY)) activeSectionEnergy += energy;
        if (x > midX + Math.round(0.9 * cpw) && Math.abs(y - (midY - Math.round(0.38 * cpw))) <= Math.round(0.22 * cpw)) {
          upperArmEnergy += energy;
        }
        if (x > midX + Math.round(0.9 * cpw) && Math.abs(y - (midY + Math.round(0.38 * cpw))) <= Math.round(0.22 * cpw)) {
          lowerArmEnergy += energy;
        }
        if (box(x, y, 0.75, 5.0, midX + Math.round(0.25 * cpw), midY)) limiterEnergy += energy;
      }
    }

    return {
      preset: state.preset,
      analysisSamples: sim.analysisSamples || 0,
      materialNonlinearEnabled: Boolean(state.materialNonlinearEnabled),
      materialHarmonicEnabled: Boolean(state.materialHarmonicEnabled),
      materialPhaseChangeEnabled: Boolean(state.materialPhaseChangeEnabled),
      kerrChi3: Number(state.kerrChi3) || 0,
      harmonicChi2: Number(state.harmonicChi2) || 0,
      harmonicChi3: Number(state.harmonicChi3) || 0,
      phaseThresholdOn: Number(state.phaseThresholdOn) || 0,
      phaseThresholdOff: Number(state.phaseThresholdOff) || 0,
      materialCells,
      highIndexCells,
      nonlinearCells,
      phaseChangeCells,
      lossyCells,
      lossMax,
      totalEnergy,
      materialEnergy,
      materialEnergyFraction: materialEnergy / Math.max(1e-30, totalEnergy),
      nonlinearEnergy,
      nonlinearEnergyFraction: nonlinearEnergy / Math.max(1e-30, totalEnergy),
      phaseChangeEnergy,
      phaseChangeEnergyFraction: phaseChangeEnergy / Math.max(1e-30, totalEnergy),
      phaseStateMean: phaseChangeCells > 0 ? phaseStateSum / phaseChangeCells : 0,
      phaseStateMax,
      switchedCells,
      guideEnergy,
      guideEnergyFraction: guideEnergy / Math.max(1e-30, totalEnergy),
      activeSectionEnergy,
      activeSectionEnergyFraction: activeSectionEnergy / Math.max(1e-30, totalEnergy),
      outputArmEnergy: upperArmEnergy + lowerArmEnergy,
      outputArmEnergyFraction: (upperArmEnergy + lowerArmEnergy) / Math.max(1e-30, totalEnergy),
      armBalance:
        upperArmEnergy + lowerArmEnergy > 1e-30
          ? Math.abs(upperArmEnergy - lowerArmEnergy) / Math.max(1e-30, upperArmEnergy + lowerArmEnergy)
          : null,
      limiterEnergy,
      limiterEnergyFraction: limiterEnergy / Math.max(1e-30, totalEnergy),
      harmonic2: analysis?.harmonic2 ?? null,
      harmonic3: analysis?.harmonic3 ?? null,
      sidebandRatio: analysis?.sidebandRatio ?? null,
      phaseAverage: analysis?.phaseAverage ?? null,
    };
  });
}

async function temporalMediaMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const analysis = state.analysisEnabled && typeof sim.analysisMetricEstimate === "function" ? sim.analysisMetricEstimate() : null;
    const floquet = analysis?.floquet ?? null;
    const phase = floquet?.modulationPhase ?? (typeof sim.modulationPhaseCoherenceEstimate === "function" ? sim.modulationPhaseCoherenceEstimate() : null);
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const source = state.sources?.[0] || null;
    const sourceX = source && typeof sim.sourceXCell === "function" ? sim.sourceXCell(source) : minX;
    const sourceY = source && typeof sim.sourceYCell === "function" ? sim.sourceYCell(source) : midY;
    const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const finiteOrNull = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return finite(sim.analysisFieldEnergyDensityAt(idx));
      if (sim.material[idx] === 2) return 0;
      return finite(sim.ez[idx]) ** 2 + finite(sim.hx[idx]) ** 2 + finite(sim.hy[idx]) ** 2;
    };
    const highIndexAt = (idx) =>
      sim.material[idx] !== 0 && sim.material[idx] !== 2 && Math.max(Math.abs(finite(sim.eps?.[idx])), Math.abs(finite(sim.epsY?.[idx]))) > 3.0;
    const modulatedProfile = Array.from({ length: maxX - minX + 1 }, () => 0);
    const resonatorProfile = Array.from({ length: maxX - minX + 1 }, () => 0);
    let materialCells = 0;
    let highIndexCells = 0;
    let modulatedCells = 0;
    let lossyCells = 0;
    let totalEnergy = 0;
    let materialEnergy = 0;
    let highIndexEnergy = 0;
    let modulatedEnergy = 0;
    let guideEnergy = 0;
    let activeSectionEnergy = 0;
    let outputGuideEnergy = 0;
    let centralRegionEnergy = 0;
    let rightHalfEnergy = 0;
    let ringEnergy = 0;
    let resonatorBandEnergy = 0;
    let sourceNeighborhoodEnergy = 0;
    const guideHalfWidth = Math.max(3, Math.round(0.42 * cpw));
    const sourceRadius = Math.max(3, Math.round(0.48 * cpw));
    const activeHalfX = Math.round(2.2 * cpw);
    const activeHalfY = Math.round(0.65 * cpw);
    const ringCx = midX + Math.round(0.2 * cpw);
    const ringCy = midY - Math.round(0.16 * cpw);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const idx = sim.id(x, y);
        const energy = energyAt(idx);
        const isMaterial = sim.material[idx] !== 0 && sim.material[idx] !== 2;
        const isHighIndex = highIndexAt(idx);
        const isModulated = Boolean(sim.modulatedMaterial?.[idx]);
        const loss = Math.max(Math.abs(finite(sim.loss?.[idx])), Math.abs(finite(sim.lossY?.[idx])));
        const inGuide = Math.abs(y - sourceY) <= guideHalfWidth;
        const inActiveSection = Math.abs(x - midX) <= activeHalfX && Math.abs(y - sourceY) <= activeHalfY;
        const inCentralRegion = Math.abs(x - midX) <= Math.round(1.45 * cpw) && Math.abs(y - midY) <= Math.round(1.2 * cpw);
        const inRightHalf = x >= midX;
        const rx = (x - ringCx) / Math.max(1, cpw);
        const ry = (y - ringCy) / Math.max(1, cpw);
        const radius = Math.hypot(rx / 0.62, ry / 0.62);
        const innerRadius = Math.hypot(rx / 0.43, ry / 0.43);
        const inRing = radius <= 1.12 && innerRadius >= 0.72;
        const inResonatorBand = Math.abs(y - midY) <= Math.round(0.75 * cpw) && Math.abs(x - midX) <= Math.round(2.0 * cpw);
        totalEnergy += energy;
        if (isMaterial) {
          materialCells += 1;
          materialEnergy += energy;
        }
        if (isHighIndex) {
          highIndexCells += 1;
          highIndexEnergy += energy;
        }
        if (isModulated) {
          modulatedCells += 1;
          modulatedEnergy += energy;
          modulatedProfile[x - minX] += 1;
          if (isHighIndex && inResonatorBand) resonatorProfile[x - minX] += 1;
        }
        if (loss > 1e-6) lossyCells += 1;
        if (inGuide) guideEnergy += energy;
        if (inActiveSection) activeSectionEnergy += energy;
        if (inGuide && x > midX + Math.round(0.8 * cpw)) outputGuideEnergy += energy;
        if (inCentralRegion) centralRegionEnergy += energy;
        if (inRightHalf) rightHalfEnergy += energy;
        if (inRing) ringEnergy += energy;
        if (inResonatorBand) resonatorBandEnergy += energy;
        if (Math.hypot(x - sourceX, y - sourceY) <= sourceRadius) sourceNeighborhoodEnergy += energy;
      }
    }

    const countPeaks = (profile, minSeparationLambda = 0.25) => {
      const smooth = profile.map((value, index) => {
        const left = index > 0 ? profile[index - 1] : value;
        const right = index < profile.length - 1 ? profile[index + 1] : value;
        return 0.25 * left + 0.5 * value + 0.25 * right;
      });
      const maxProfile = smooth.reduce((max, value) => Math.max(max, value), 0);
      const threshold = Math.max(1, 0.32 * maxProfile);
      const minSeparation = Math.max(2, Math.round(minSeparationLambda * cpw));
      const peaks = [];
      for (let index = 1; index < smooth.length - 1; index += 1) {
        if (smooth[index] < threshold || smooth[index] < smooth[index - 1] || smooth[index] < smooth[index + 1]) continue;
        const x = minX + index;
        const last = peaks[peaks.length - 1];
        if (last && x - last.x < minSeparation) {
          if (smooth[index] > last.weight) {
            last.x = x;
            last.weight = smooth[index];
          }
        } else {
          peaks.push({ x, weight: smooth[index] });
        }
      }
      return {
        count: peaks.length,
        positionsLambda: peaks.map((peak) => Number((peak.x / cpw).toFixed(3))),
      };
    };
    const modulatedPeaks = countPeaks(modulatedProfile);
    const resonatorPeaks = countPeaks(resonatorProfile, 0.2);

    return {
      preset: state.preset,
      analysisSamples: sim.analysisSamples || 0,
      diagnosticDftSamples: sim.diagnosticDftSampleCount || 0,
      materialModulationEnabled: Boolean(state.materialModulationEnabled),
      modulationDepth: Number(state.modulationDepth) || 0,
      modulationFrequency: Number(state.modulationFrequency) || 0,
      modulationPeriodLambda: Number(state.modulationPeriodLambda) || 0,
      modulationAngleDeg: Number(state.modulationAngleDeg) || 0,
      materialCells,
      highIndexCells,
      modulatedCells,
      lossyCells,
      totalEnergy,
      materialEnergy,
      materialEnergyFraction: materialEnergy / Math.max(1e-30, totalEnergy),
      highIndexEnergy,
      highIndexEnergyFraction: highIndexEnergy / Math.max(1e-30, totalEnergy),
      modulatedEnergy,
      modulatedEnergyFraction: modulatedEnergy / Math.max(1e-30, totalEnergy),
      guideEnergy,
      guideEnergyFraction: guideEnergy / Math.max(1e-30, totalEnergy),
      activeSectionEnergy,
      activeSectionEnergyFraction: activeSectionEnergy / Math.max(1e-30, totalEnergy),
      outputGuideEnergy,
      outputGuideEnergyFraction: outputGuideEnergy / Math.max(1e-30, totalEnergy),
      centralRegionEnergy,
      centralRegionEnergyFraction: centralRegionEnergy / Math.max(1e-30, totalEnergy),
      rightHalfEnergy,
      rightHalfEnergyFraction: rightHalfEnergy / Math.max(1e-30, totalEnergy),
      ringEnergy,
      ringEnergyFraction: ringEnergy / Math.max(1e-30, totalEnergy),
      resonatorBandEnergy,
      resonatorBandEnergyFraction: resonatorBandEnergy / Math.max(1e-30, totalEnergy),
      sourceNeighborhoodEnergy,
      sourceNeighborhoodEnergyFraction: sourceNeighborhoodEnergy / Math.max(1e-30, totalEnergy),
      modulatedPeakCount: modulatedPeaks.count,
      modulatedPeakPositionsLambda: modulatedPeaks.positionsLambda,
      resonatorPeakCount: resonatorPeaks.count,
      resonatorPeakPositionsLambda: resonatorPeaks.positionsLambda,
      floquetPresent: Boolean(floquet),
      floquetPortDft: Boolean(floquet?.portDft),
      floquetSidebandPower: finiteOrNull(floquet?.sidebandPower),
      floquetReflectedSidebandPower: finiteOrNull(floquet?.reflectedSidebandPower),
      floquetMaxSidebandRatio: finiteOrNull(floquet?.maxSidebandRatio),
      floquetMaxSidebandOrder: finiteOrNull(floquet?.maxSidebandOrder),
      floquetFirstUpper: finiteOrNull(floquet?.firstUpper),
      floquetFirstLower: finiteOrNull(floquet?.firstLower),
      floquetPowerBalanceAbsResidual: finiteOrNull(floquet?.scatteringMatrix?.powerBalanceAbsResidual),
      modulationPhaseSpatialCoherence: finiteOrNull(phase?.spatialCoherence),
      modulationPhaseSpreadRad: finiteOrNull(phase?.phaseSpreadRad),
      modulationPhaseVelocityLambdaPerStep: finiteOrNull(phase?.phaseVelocityLambdaPerStep),
    };
  });
}

async function coupledWorkflowMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const analysis = state.analysisEnabled && typeof sim.analysisMetricEstimate === "function" ? sim.analysisMetricEstimate() : null;
    const coupled = analysis?.coupledWorkflow ?? null;
    const ptModal = analysis?.ptModal ?? null;
    const phcBloch = analysis?.phcBloch ?? null;
    const floquet = analysis?.floquet ?? null;
    const phase = floquet?.modulationPhase ?? coupled?.modulationPhase ?? (typeof sim.modulationPhaseCoherenceEstimate === "function" ? sim.modulationPhaseCoherenceEstimate() : null);
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const source = state.sources?.[0] || null;
    const sourceX = source && typeof sim.sourceXCell === "function" ? sim.sourceXCell(source) : minX;
    const sourceY = source && typeof sim.sourceYCell === "function" ? sim.sourceYCell(source) : midY;
    const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const finiteOrNull = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return finite(sim.analysisFieldEnergyDensityAt(idx));
      if (sim.material[idx] === 2) return 0;
      return finite(sim.ez[idx]) ** 2 + finite(sim.hx[idx]) ** 2 + finite(sim.hy[idx]) ** 2;
    };
    const sourcePhaseDifferenceDeg = (() => {
      const sources = state.sources || [];
      if (sources.length < 2) return null;
      const phase0 = Number(sources[0].phaseDeg || 0);
      const phase1 = Number(sources[1].phaseDeg || 0);
      return Math.abs((((phase1 - phase0 + 180) % 360) + 360) % 360 - 180);
    })();
    const guideHalfWidth = Math.max(3, Math.round(0.38 * cpw));
    const cavityRadius = Math.max(4, Math.round(0.85 * cpw));
    const sourceRadius = Math.max(3, Math.round(0.5 * cpw));
    const edgeWidth = Math.max(3, Math.round(0.45 * cpw));
    let materialCells = 0;
    let highIndexCells = 0;
    let gainCells = 0;
    let lossyCells = 0;
    let nonlinearCells = 0;
    let dispersiveCells = 0;
    let modulatedCells = 0;
    let totalEnergy = 0;
    let materialEnergy = 0;
    let highIndexEnergy = 0;
    let gainEnergy = 0;
    let lossEnergy = 0;
    let nonlinearEnergy = 0;
    let dispersiveEnergy = 0;
    let modulatedEnergy = 0;
    let guideEnergy = 0;
    let cavityEnergy = 0;
    let sourceOverlapEnergy = 0;
    let edgeEnergy = 0;
    let leftEdgeEnergy = 0;
    let rightEdgeEnergy = 0;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const idx = sim.id(x, y);
        const energy = energyAt(idx);
        const isMaterial = sim.material[idx] !== 0 && sim.material[idx] !== 2;
        const isHighIndex = isMaterial && Math.max(Math.abs(finite(sim.eps?.[idx])), Math.abs(finite(sim.epsY?.[idx]))) > 3.0;
        const loss = Math.max(finite(sim.loss?.[idx]), finite(sim.lossY?.[idx]));
        const isGain = Math.min(finite(sim.loss?.[idx]), finite(sim.lossY?.[idx])) < -1e-9;
        const isLossy = loss > 1e-9;
        const isNonlinear = Boolean(sim.nonlinearMaterial?.[idx]);
        const isDispersive = Boolean(sim.dispersiveMaterial?.[idx] || sim.muDispersiveMaterial?.[idx]);
        const isModulated = Boolean(sim.modulatedMaterial?.[idx]);
        totalEnergy += energy;
        if (isMaterial) {
          materialCells += 1;
          materialEnergy += energy;
        }
        if (isHighIndex) {
          highIndexCells += 1;
          highIndexEnergy += energy;
        }
        if (isGain) {
          gainCells += 1;
          gainEnergy += energy;
        }
        if (isLossy) {
          lossyCells += 1;
          lossEnergy += energy;
        }
        if (isNonlinear) {
          nonlinearCells += 1;
          nonlinearEnergy += energy;
        }
        if (isDispersive) {
          dispersiveCells += 1;
          dispersiveEnergy += energy;
        }
        if (isModulated) {
          modulatedCells += 1;
          modulatedEnergy += energy;
        }
        if (Math.abs(y - sourceY) <= guideHalfWidth) guideEnergy += energy;
        if (Math.hypot(x - midX, y - midY) <= cavityRadius) cavityEnergy += energy;
        if (Math.hypot(x - sourceX, y - sourceY) <= sourceRadius) sourceOverlapEnergy += energy;
        if (x <= minX + edgeWidth) {
          edgeEnergy += energy;
          leftEdgeEnergy += energy;
        }
        if (x >= maxX - edgeWidth) {
          edgeEnergy += energy;
          rightEdgeEnergy += energy;
        }
      }
    }

    const sourceShapes = (state.sources || []).map((item) => item.shape || "");
    const sourceTypes = (state.sources || []).map((item) => item.type || "");
    return {
      preset: state.preset,
      analysisSamples: sim.analysisSamples || 0,
      diagnosticDftSamples: sim.diagnosticDftSampleCount || 0,
      materialSaturableGainEnabled: Boolean(state.materialSaturableGainEnabled),
      materialNonlinearEnabled: Boolean(state.materialNonlinearEnabled),
      materialDispersionEnabled: Boolean(state.materialDispersionEnabled),
      materialModulationEnabled: Boolean(state.materialModulationEnabled),
      gainSaturation: Number(state.gainSaturation) || 0,
      modulationDepth: Number(state.modulationDepth) || 0,
      modulationFrequency: Number(state.modulationFrequency) || 0,
      sourceShapes,
      sourceTypes,
      sourcePhaseDifferenceDeg,
      materialCells,
      highIndexCells,
      gainCells,
      lossyCells,
      nonlinearCells,
      dispersiveCells,
      modulatedCells,
      totalEnergy,
      materialEnergyFraction: materialEnergy / Math.max(1e-30, totalEnergy),
      highIndexEnergyFraction: highIndexEnergy / Math.max(1e-30, totalEnergy),
      gainEnergyFraction: gainEnergy / Math.max(1e-30, totalEnergy),
      lossEnergyFraction: lossEnergy / Math.max(1e-30, totalEnergy),
      nonlinearEnergyFraction: nonlinearEnergy / Math.max(1e-30, totalEnergy),
      dispersiveEnergyFraction: dispersiveEnergy / Math.max(1e-30, totalEnergy),
      modulatedEnergyFraction: modulatedEnergy / Math.max(1e-30, totalEnergy),
      guideEnergyFraction: guideEnergy / Math.max(1e-30, totalEnergy),
      cavityEnergyFraction: cavityEnergy / Math.max(1e-30, totalEnergy),
      sourceOverlapFraction: sourceOverlapEnergy / Math.max(1e-30, totalEnergy),
      skinEdgeFraction: edgeEnergy / Math.max(1e-30, totalEnergy),
      skinBias: edgeEnergy > 1e-30 ? (rightEdgeEnergy - leftEdgeEnergy) / Math.max(1e-30, edgeEnergy) : 0,
      ptModalRequiredData: Boolean(ptModal),
      ptGamma: finiteOrNull(ptModal?.gamma),
      ptCoupling: finiteOrNull(ptModal?.coupling),
      ptNormalizedGamma: finiteOrNull(ptModal?.normalizedGamma),
      ptRealSplit: finiteOrNull(ptModal?.realSplit),
      ptImagSplit: finiteOrNull(ptModal?.imagSplit),
      ptEpDistance: finiteOrNull(ptModal?.epDistance),
      ptCoalescence: finiteOrNull(ptModal?.coalescence),
      ptPhase: ptModal?.phase ?? null,
      phcBlochRequiredData: Boolean(phcBloch),
      phcQProxy: finiteOrNull(phcBloch?.qProxy),
      phcLeakage: finiteOrNull(phcBloch?.leakage),
      coupledWorkflowRequiredData: Boolean(coupled),
      coupledCentroidXNorm: finiteOrNull(coupled?.centroidXNorm),
      coupledCentroidYNorm: finiteOrNull(coupled?.centroidYNorm),
      coupledSkinEdgeFraction: finiteOrNull(coupled?.skinEdgeFraction),
      coupledSkinBias: finiteOrNull(coupled?.skinBias),
      coupledGuideEnergyFraction: finiteOrNull(coupled?.guideEnergyFraction),
      coupledCavityEnergyFraction: finiteOrNull(coupled?.cavityEnergyFraction),
      coupledMaterialEnergyFraction: finiteOrNull(coupled?.materialEnergyFraction),
      coupledHighIndexEnergyFraction: finiteOrNull(coupled?.highIndexEnergyFraction),
      coupledActiveMaterialFraction: finiteOrNull(coupled?.activeMaterialFraction),
      coupledSourceOverlapFraction: finiteOrNull(coupled?.sourceOverlapFraction),
      coupledGainLossBias: finiteOrNull(coupled?.gainLossBias),
      floquetRequiredData: Boolean(floquet),
      floquetSidebandPower: finiteOrNull(floquet?.sidebandPower),
      floquetReflectedSidebandPower: finiteOrNull(floquet?.reflectedSidebandPower),
      floquetMaxSidebandRatio: finiteOrNull(floquet?.maxSidebandRatio),
      modulationPhaseSpatialCoherence: finiteOrNull(phase?.spatialCoherence),
      modulationPhaseSpreadRad: finiteOrNull(phase?.phaseSpreadRad),
      modulationPhaseVelocityLambdaPerStep: finiteOrNull(phase?.phaseVelocityLambdaPerStep),
    };
  });
}

async function sourceRadiationMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const sources = state.sources || [];
    const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return finite(sim.analysisFieldEnergyDensityAt(idx));
      if (sim.material[idx] === 2) return 0;
      return finite(sim.ez[idx]) ** 2 + finite(sim.hx[idx]) ** 2 + finite(sim.hy[idx]) ** 2;
    };
    const sourceCells = sources.map((source) => ({
      x: typeof sim.sourceXCell === "function" ? sim.sourceXCell(source) : Math.round(finite(source.xLambda) * cpw),
      y: typeof sim.sourceYCell === "function" ? sim.sourceYCell(source) : Math.round(finite(source.yLambda) * cpw),
      width: typeof sim.sourceEnvelopeFwhmCells === "function" ? sim.sourceEnvelopeFwhmCells(source) : Math.max(2, Math.round(finite(source.widthLambda, 0.35) * cpw)),
      phaseDeg: finite(source.phaseDeg),
      frequency: finite(source.frequency, 0.01),
      angleDeg: finite(source.angleDeg),
      evanescentKParallelRatio: Number.isFinite(Number(source.evanescentKParallelRatio ?? source.kParallelRatio))
        ? Number(source.evanescentKParallelRatio ?? source.kParallelRatio)
        : null,
      arrayPhaseStepDeg: Number.isFinite(Number(source.arrayPhaseStepDeg)) ? Number(source.arrayPhaseStepDeg) : null,
    }));
    const sourceShapes = sources.map((source) => source.shape || "");
    const sourceTypes = sources.map((source) => source.type || "");
    const sourcePhases = sourceCells.map((source) => source.phaseDeg);
    const sourceFrequencies = sourceCells.map((source) => source.frequency);
    const sourceAngles = sourceCells.map((source) => source.angleDeg);
    const evanescentRatios = sourceCells.map((source) => source.evanescentKParallelRatio).filter((value) => Number.isFinite(value));
    const phaseSteps = [];
    for (let i = 1; i < sourcePhases.length; i += 1) {
      phaseSteps.push((((sourcePhases[i] - sourcePhases[i - 1] + 180) % 360) + 360) % 360 - 180);
    }
    const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    const phaseStepMean = mean(phaseSteps);
    const phaseStepStd =
      phaseSteps.length > 0 ? Math.sqrt(mean(phaseSteps.map((value) => (value - phaseStepMean) * (value - phaseStepMean)))) : 0;
    const xs = sourceCells.map((source) => source.x);
    const ys = sourceCells.map((source) => source.y);
    const sourceXMin = xs.length ? Math.min(...xs) : minX;
    const sourceXMax = xs.length ? Math.max(...xs) : minX;
    const sourceYMin = ys.length ? Math.min(...ys) : minY;
    const sourceYMax = ys.length ? Math.max(...ys) : minY;
    const sourceXCenter = xs.length ? mean(xs) : Math.round(0.5 * (minX + maxX));
    const sourceYCenter = ys.length ? mean(ys) : Math.round(0.5 * (minY + maxY));
    const ySortedSources = [...sourceCells].sort((a, b) => a.y - b.y);
    const sourceYSpacings = [];
    for (let i = 1; i < ySortedSources.length; i += 1) {
      sourceYSpacings.push((ySortedSources[i].y - ySortedSources[i - 1].y) / cpw);
    }
    const sourceYSpacingMean = sourceYSpacings.length ? mean(sourceYSpacings) : 0;
    const sourceYSpacingStd = sourceYSpacings.length
      ? Math.sqrt(mean(sourceYSpacings.map((value) => (value - sourceYSpacingMean) * (value - sourceYSpacingMean))))
      : 0;
    let materialCells = 0;
    let highIndexCells = 0;
    let lossyCells = 0;
    let anisotropicCells = 0;
    let pecCells = 0;
    let totalEnergy = 0;
    let materialEnergy = 0;
    let highIndexEnergy = 0;
    let sourceNeighborhoodEnergy = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    let upperEnergy = 0;
    let lowerEnergy = 0;
    let apertureGapCells = 0;
    let microstripSubstrateCells = 0;
    let microstripStripPecCells = 0;
    let microstripGroundPecCells = 0;
    let microstripSubstrateEnergy = 0;
    let stripPecYSum = 0;
    let groundPecYSum = 0;
    const angularBinCount = 72;
    const angularBins = Array.from({ length: angularBinCount }, () => 0);
    const annulusMinRadius = Math.max(1.0 * cpw, 1.5 * Math.max(1, ...sourceCells.map((source) => source.width)));
    const annulusMaxRadius = Math.max(annulusMinRadius + 1, Math.min(5.5 * cpw, 0.45 * Math.min(maxX - minX, maxY - minY)));
    const normalizeAngleDeg = (angle) => {
      const wrapped = ((((angle + 180) % 360) + 360) % 360) - 180;
      return wrapped === -180 ? 180 : wrapped;
    };
    const angularDistanceDeg = (a, b) => Math.abs(normalizeAngleDeg(a - b));
    const arraySourceSpacingLambda = sourceYSpacingMean > 0 ? sourceYSpacingMean : 0;
    const arrayPhaseStep = sourceCells.find((source) => source.arrayPhaseStepDeg != null)?.arrayPhaseStepDeg ?? null;
    const derivedArraySteeringAngleDeg =
      sourceCells.length > 1 && Number.isFinite(arrayPhaseStep) && arraySourceSpacingLambda > 1e-9
        ? (Math.asin(Math.max(-1, Math.min(1, -arrayPhaseStep / (360 * arraySourceSpacingLambda)))) * 180) / Math.PI
        : null;
    const configuredArraySteeringAngleDeg = sources.find((source) => Number.isFinite(Number(source.arraySteeringAngleDeg)))?.arraySteeringAngleDeg;
    const expectedRadiationAngleDeg =
      Number.isFinite(Number(configuredArraySteeringAngleDeg))
        ? Number(configuredArraySteeringAngleDeg)
        : Number.isFinite(Number(derivedArraySteeringAngleDeg))
          ? Number(derivedArraySteeringAngleDeg)
          : sourceAngles.length
            ? mean(sourceAngles)
            : 0;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const idx = sim.id(x, y);
        const energy = energyAt(idx);
        const isMaterial = sim.material[idx] !== 0 && sim.material[idx] !== 2;
        const epsAbs = Math.max(Math.abs(finite(sim.eps?.[idx])), Math.abs(finite(sim.epsY?.[idx])));
        const isHighIndex = isMaterial && Math.max(Math.abs(finite(sim.eps?.[idx])), Math.abs(finite(sim.epsY?.[idx]))) > 3.0;
        const loss = Math.max(Math.abs(finite(sim.loss?.[idx])), Math.abs(finite(sim.lossY?.[idx])));
        totalEnergy += energy;
        if (isMaterial) {
          materialCells += 1;
          materialEnergy += energy;
        }
        if (isMaterial && epsAbs > 1.8 && epsAbs < 3.0 && y > midY) {
          microstripSubstrateCells += 1;
          microstripSubstrateEnergy += energy;
        }
        if (isHighIndex) {
          highIndexCells += 1;
          highIndexEnergy += energy;
        }
        if (loss > 1e-6) lossyCells += 1;
        if (isMaterial && Math.abs(finite(sim.eps?.[idx]) - finite(sim.epsY?.[idx])) > 1e-6) anisotropicCells += 1;
        if (sim.material[idx] === 2) pecCells += 1;
        if (sim.material[idx] === 0 && Math.abs(x - midX) <= Math.round(0.08 * cpw) && Math.abs(y - sourceYCenter) <= Math.round(0.38 * cpw)) {
          apertureGapCells += 1;
        }
        if (sim.material[idx] === 2 && y < midY + Math.round(0.5 * cpw)) {
          microstripStripPecCells += 1;
          stripPecYSum += y;
        }
        if (sim.material[idx] === 2 && y > midY + Math.round(1.2 * cpw)) {
          microstripGroundPecCells += 1;
          groundPecYSum += y;
        }
        for (const source of sourceCells) {
          const radius = Math.max(3, Math.round(source.width * 0.85));
          if (Math.hypot(x - source.x, y - source.y) <= radius) {
            sourceNeighborhoodEnergy += energy;
            break;
          }
        }
        if (x < sourceXCenter - Math.round(0.45 * cpw)) leftEnergy += energy;
        if (x > sourceXCenter + Math.round(0.45 * cpw)) rightEnergy += energy;
        if (y < sourceYCenter - Math.round(0.45 * cpw)) upperEnergy += energy;
        if (y > sourceYCenter + Math.round(0.45 * cpw)) lowerEnergy += energy;
        const dx = x - sourceXCenter;
        const dy = y - sourceYCenter;
        const radius = Math.hypot(dx, dy);
        if (radius >= annulusMinRadius && radius <= annulusMaxRadius && energy > 0) {
          const angleDeg = normalizeAngleDeg((Math.atan2(dy, dx) * 180) / Math.PI);
          const bin = Math.floor((((angleDeg + 180) / 360) * angularBinCount) % angularBinCount);
          angularBins[Math.max(0, Math.min(angularBinCount - 1, bin))] += energy;
        }
      }
    }

    const angularTotalEnergy = angularBins.reduce((sum, value) => sum + value, 0);
    let angularPeakBin = 0;
    for (let i = 1; i < angularBins.length; i += 1) {
      if (angularBins[i] > angularBins[angularPeakBin]) angularPeakBin = i;
    }
    const binCenterAngleDeg = (bin) => normalizeAngleDeg(-180 + ((bin + 0.5) * 360) / angularBinCount);
    const angularPeakAngleDeg = binCenterAngleDeg(angularPeakBin);
    const sectorEnergy = (targetDeg, halfWidthDeg) =>
      angularBins.reduce((sum, value, bin) => {
        const angle = binCenterAngleDeg(bin);
        return angularDistanceDeg(angle, targetDeg) <= halfWidthDeg ? sum + value : sum;
      }, 0);
    const forwardSectorEnergy = sectorEnergy(expectedRadiationAngleDeg, 35);
    const backwardSectorEnergy = sectorEnergy(expectedRadiationAngleDeg + 180, 35);
    let forwardHemispherePeakBin = -1;
    for (let i = 0; i < angularBins.length; i += 1) {
      const angle = binCenterAngleDeg(i);
      if (angularDistanceDeg(angle, expectedRadiationAngleDeg) > 90) continue;
      if (forwardHemispherePeakBin < 0 || angularBins[i] > angularBins[forwardHemispherePeakBin]) forwardHemispherePeakBin = i;
    }
    const forwardHemispherePeakAngleDeg = forwardHemispherePeakBin >= 0 ? binCenterAngleDeg(forwardHemispherePeakBin) : null;

    const farField = state.analysisEnabled && typeof sim.analysisFarFieldEstimate === "function" ? sim.analysisFarFieldEstimate(96) : [];
    const farFieldValues = farField
      .map((point) => finite(point?.value))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const farFieldMean = farFieldValues.length ? mean(farFieldValues) : 0;
    const farFieldStd = farFieldValues.length
      ? Math.sqrt(mean(farFieldValues.map((value) => (value - farFieldMean) * (value - farFieldMean))))
      : 0;
    return {
      preset: state.preset,
      fieldComponent: state.fieldComponent,
      viewMode: state.viewMode,
      fieldDisplay: state.fieldDisplay,
      fieldQuiver: Boolean(state.fieldQuiver),
      sweepMode: state.sweepMode,
      sweepSamples: Number(state.sweepSamples) || 0,
      analysisSamples: sim.analysisSamples || 0,
      sourceCount: sources.length,
      sourceShapes,
      sourceTypes,
      sourceFrequencyMin: sourceFrequencies.length ? Math.min(...sourceFrequencies) : 0,
      sourceFrequencyMax: sourceFrequencies.length ? Math.max(...sourceFrequencies) : 0,
      sourceFrequencySpread: sourceFrequencies.length ? Math.max(...sourceFrequencies) - Math.min(...sourceFrequencies) : 0,
      sourceFrequencyRatio:
        sourceFrequencies.length > 1 ? Math.max(...sourceFrequencies) / Math.max(1e-30, Math.min(...sourceFrequencies)) : 1,
      sourceAngleMeanAbsDeg: mean(sourceAngles.map((angle) => Math.abs(angle))),
      evanescentKParallelRatioMax: evanescentRatios.length ? Math.max(...evanescentRatios) : 0,
      sourceXSpanLambda: (sourceXMax - sourceXMin) / cpw,
      sourceYSpanLambda: (sourceYMax - sourceYMin) / cpw,
      sourceYSpacingMeanLambda: sourceYSpacingMean,
      sourceYSpacingStdLambda: sourceYSpacingStd,
      sourceYSpacingMinLambda: sourceYSpacings.length ? Math.min(...sourceYSpacings) : 0,
      sourceYSpacingMaxLambda: sourceYSpacings.length ? Math.max(...sourceYSpacings) : 0,
      sourcePhaseStepMeanDeg: phaseStepMean,
      sourcePhaseStepMeanAbsDeg: Math.abs(phaseStepMean),
      sourcePhaseStepStdDeg: phaseStepStd,
      configuredArrayPhaseStepDeg: sourceCells.find((source) => source.arrayPhaseStepDeg != null)?.arrayPhaseStepDeg ?? null,
      configuredArraySteeringAngleDeg: Number.isFinite(Number(configuredArraySteeringAngleDeg)) ? Number(configuredArraySteeringAngleDeg) : null,
      derivedArraySteeringAngleDeg: Number.isFinite(Number(derivedArraySteeringAngleDeg)) ? Number(derivedArraySteeringAngleDeg) : null,
      expectedRadiationAngleDeg,
      materialCells,
      highIndexCells,
      lossyCells,
      anisotropicCells,
      pecCells,
      apertureGapCells,
      microstripSubstrateCells,
      microstripStripPecCells,
      microstripGroundPecCells,
      microstripPecSeparationLambda:
        microstripStripPecCells > 0 && microstripGroundPecCells > 0
          ? groundPecYSum / microstripGroundPecCells / cpw - stripPecYSum / microstripStripPecCells / cpw
          : 0,
      totalEnergy,
      materialEnergyFraction: materialEnergy / Math.max(1e-30, totalEnergy),
      highIndexEnergyFraction: highIndexEnergy / Math.max(1e-30, totalEnergy),
      microstripSubstrateEnergyFraction: microstripSubstrateEnergy / Math.max(1e-30, totalEnergy),
      sourceNeighborhoodEnergyFraction: sourceNeighborhoodEnergy / Math.max(1e-30, totalEnergy),
      rightToLeftEnergyRatio: rightEnergy / Math.max(1e-30, leftEnergy),
      lowerToUpperEnergyRatio: lowerEnergy / Math.max(1e-30, upperEnergy),
      sourceAngularAnnulusMinLambda: annulusMinRadius / cpw,
      sourceAngularAnnulusMaxLambda: annulusMaxRadius / cpw,
      sourceAngularTotalEnergy: angularTotalEnergy,
      sourceAngularPeakAngleDeg: angularPeakAngleDeg,
      sourceAngularPeakEnergyFraction: angularTotalEnergy > 1e-30 ? angularBins[angularPeakBin] / angularTotalEnergy : 0,
      sourceForwardHemispherePeakAngleDeg: forwardHemispherePeakAngleDeg,
      sourceForwardHemispherePeakAngleErrorDeg:
        forwardHemispherePeakAngleDeg == null ? null : angularDistanceDeg(forwardHemispherePeakAngleDeg, expectedRadiationAngleDeg),
      sourceForwardSectorEnergyFraction: forwardSectorEnergy / Math.max(1e-30, angularTotalEnergy),
      sourceBackwardSectorEnergyFraction: backwardSectorEnergy / Math.max(1e-30, angularTotalEnergy),
      sourceForwardBackwardSectorRatio: forwardSectorEnergy / Math.max(1e-30, backwardSectorEnergy),
      farFieldSamples: farField.length || 0,
      farFieldFiniteSamples: farFieldValues.length,
      farFieldMode: sim.analysisFarFieldMode || "",
      farFieldPeak: Number(sim.analysisFarFieldPeak) || 0,
      farFieldMean,
      farFieldStd,
      farFieldNormalizedStd: farFieldMean > 1e-30 ? farFieldStd / farFieldMean : 0,
      farFieldMin: farFieldValues.length ? Math.min(...farFieldValues) : 0,
      farFieldMax: farFieldValues.length ? Math.max(...farFieldValues) : 0,
    };
  });
}

async function layeredOpticsMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return sim.analysisFieldEnergyDensityAt(idx);
      if (sim.material[idx] === 2) return 0;
      return sim.ez[idx] * sim.ez[idx] + sim.hx[idx] * sim.hx[idx] + sim.hy[idx] * sim.hy[idx];
    };
    const sumBox = (x0, x1, y0 = minY, y1 = maxY) => {
      let energy = 0;
      let materialCells = 0;
      let highIndexCells = 0;
      for (let y = Math.max(minY, y0); y <= Math.min(maxY, y1); y += 1) {
        for (let x = Math.max(minX, x0); x <= Math.min(maxX, x1); x += 1) {
          const idx = sim.id(x, y);
          energy += energyAt(idx);
          if (sim.material[idx] !== 0) materialCells += 1;
          if (Math.max(Math.abs(sim.eps[idx]), Math.abs(sim.epsY[idx])) > 2.0) highIndexCells += 1;
        }
      }
      return { energy, materialCells, highIndexCells };
    };
    const profileSegments = [];
    let current = null;
    for (let x = minX; x <= maxX; x += 1) {
      const idx = sim.id(x, midY);
      const key = `${sim.material[idx]}:${Math.round((sim.eps[idx] || 0) * 100)}:${Math.round((sim.epsY[idx] || 0) * 100)}`;
      if (!current || current.key !== key) {
        if (current) profileSegments.push(current);
        current = {
          key,
          x0: x,
          x1: x,
          material: sim.material[idx],
          eps: sim.eps[idx],
          epsY: sim.epsY[idx],
        };
      } else {
        current.x1 = x;
      }
    }
    if (current) profileSegments.push(current);
    const materialSegments = profileSegments
      .filter((segment) => segment.material !== 0)
      .map((segment) => ({
        x0Lambda: segment.x0 / cpw,
        x1Lambda: segment.x1 / cpw,
        eps: segment.eps,
        epsY: segment.epsY,
      }));
    const left = sumBox(midX - Math.round(3.0 * cpw), midX - Math.round(1.1 * cpw));
    const stack = sumBox(midX - Math.round(2.4 * cpw), midX + Math.round(2.4 * cpw));
    const right = sumBox(midX + Math.round(1.1 * cpw), midX + Math.round(3.0 * cpw));
    const all = sumBox(minX, maxX);
    return {
      reflectance: sim.diagnosticReflectance || 0,
      transmittance: sim.diagnosticTransmittance || 0,
      diagnosticSamples: sim.diagnosticSamples || 0,
      powerBalanceResidual:
        sim.diagnosticSamples > 0 ? 1 - (sim.diagnosticReflectance || 0) - (sim.diagnosticTransmittance || 0) : null,
      layerCount: materialSegments.length,
      materialSegments,
      leftEnergy: left.energy,
      stackEnergy: stack.energy,
      rightEnergy: right.energy,
      totalEnergy: all.energy,
      stackEnergyFraction: stack.energy / Math.max(1e-30, all.energy),
      rightToStackEnergyRatio: right.energy / Math.max(1e-30, stack.energy),
      highIndexCells: all.highIndexCells,
      materialCells: all.materialCells,
    };
  });
}

async function tirEnergyMetrics(page) {
  return page.evaluate(() => {
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return sim.analysisFieldEnergyDensityAt(idx);
      if (sim.material[idx] === 2) return 0;
      return sim.ez[idx] * sim.ez[idx] + sim.hx[idx] * sim.hx[idx] + sim.hy[idx] * sim.hy[idx];
    };
    const sumBox = (x0, x1) => {
      let energy = 0;
      let materialCells = 0;
      let highIndexCells = 0;
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = Math.max(minX, x0); x <= Math.min(maxX, x1); x += 1) {
          const idx = sim.id(x, y);
          energy += energyAt(idx);
          if (sim.material[idx] !== 0) materialCells += 1;
          if (Math.max(Math.abs(sim.eps[idx]), Math.abs(sim.epsY[idx])) > 1.8) highIndexCells += 1;
        }
      }
      return { energy, materialCells, highIndexCells };
    };
    const incidentSide = sumBox(midX - Math.round(2.1 * cpw), midX - Math.round(0.45 * cpw));
    const interfaceBand = sumBox(midX - Math.round(0.35 * cpw), midX + Math.round(0.35 * cpw));
    const transmittedNear = sumBox(midX + Math.round(0.35 * cpw), midX + Math.round(1.1 * cpw));
    const transmittedFar = sumBox(midX + Math.round(1.1 * cpw), midX + Math.round(2.8 * cpw));
    const centerY = Math.round(0.5 * (minY + maxY));
    const isHighIndexAt = (x) => {
      const idx = sim.id(x, centerY);
      return sim.material[idx] !== 0 && Math.max(Math.abs(sim.eps[idx]), Math.abs(sim.epsY[idx])) > 1.8;
    };
    let leftHighIndexEdge = null;
    for (let x = midX; x >= minX; x -= 1) {
      if (isHighIndexAt(x)) {
        leftHighIndexEdge = x;
        break;
      }
    }
    let rightHighIndexEdge = null;
    for (let x = midX; x <= maxX; x += 1) {
      if (isHighIndexAt(x)) {
        rightHighIndexEdge = x;
        break;
      }
    }
    const gapCells =
      leftHighIndexEdge !== null && rightHighIndexEdge !== null
        ? Math.max(0, rightHighIndexEdge - leftHighIndexEdge - 1)
        : null;
    return {
      reflectance: sim.diagnosticReflectance || 0,
      transmittance: sim.diagnosticTransmittance || 0,
      diagnosticSamples: sim.diagnosticSamples || 0,
      incidentEnergy: incidentSide.energy,
      interfaceEnergy: interfaceBand.energy,
      transmittedNearEnergy: transmittedNear.energy,
      transmittedFarEnergy: transmittedFar.energy,
      transmittedFarRatio: transmittedFar.energy / Math.max(1e-30, interfaceBand.energy),
      transmittedNearRatio: transmittedNear.energy / Math.max(1e-30, interfaceBand.energy),
      rightHighIndexCells: transmittedNear.highIndexCells + transmittedFar.highIndexCells,
      rightMaterialCells: transmittedNear.materialCells + transmittedFar.materialCells,
      airGapCells: gapCells,
      airGapLambda: gapCells === null ? null : gapCells / cpw,
    };
  });
}

async function tirReferenceMetrics(page, preset, steps, testCase) {
  await selectPreset(page, preset);
  if (mode === "physics") await preparePhysicsCase(page, testCase);
  const trace = mode === "physics"
    ? await stepPhysicsSimulation(page, steps)
    : { elapsedMs: await stepSimulation(page, steps) };
  const metrics = await tirEnergyMetrics(page);
  return {
    preset,
    steps,
    elapsedMs: Number(trace.elapsedMs.toFixed(1)),
    ...metrics,
  };
}

async function fabryPerotCavityMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return sim.analysisFieldEnergyDensityAt(idx);
      if (sim.material[idx] === 2) return 0;
      return sim.ez[idx] * sim.ez[idx] + sim.hx[idx] * sim.hx[idx] + sim.hy[idx] * sim.hy[idx];
    };
    const sumBox = (x0, x1, y0 = minY, y1 = maxY) => {
      let energy = 0;
      let materialCells = 0;
      for (let y = Math.max(minY, y0); y <= Math.min(maxY, y1); y += 1) {
        for (let x = Math.max(minX, x0); x <= Math.min(maxX, x1); x += 1) {
          const idx = sim.id(x, y);
          energy += energyAt(idx);
          if (sim.material[idx] !== 0) materialCells += 1;
        }
      }
      return { energy, materialCells };
    };
    const cavity = sumBox(midX - Math.round(0.58 * cpw), midX + Math.round(0.58 * cpw));
    const leftMirror = sumBox(midX - Math.round(2.1 * cpw), midX - Math.round(0.65 * cpw));
    const rightMirror = sumBox(midX + Math.round(0.62 * cpw), midX + Math.round(1.85 * cpw));
    const outside = sumBox(minX, maxX);
    const line = [];
    for (let x = midX - Math.round(0.58 * cpw); x <= midX + Math.round(0.58 * cpw); x += 1) {
      const value = energyAt(sim.id(Math.max(minX, Math.min(maxX, x)), midY));
      if (Number.isFinite(value)) line.push(value);
    }
    const lineMean = line.reduce((sum, value) => sum + value, 0) / Math.max(1, line.length);
    const lineMax = line.reduce((max, value) => Math.max(max, value), 0);
    const lineMin = line.reduce((min, value) => Math.min(min, value), Infinity);
    return {
      reflectance: sim.diagnosticReflectance || 0,
      transmittance: sim.diagnosticTransmittance || 0,
      diagnosticSamples: sim.diagnosticSamples || 0,
      analysisSamples: sim.analysisSamples || 0,
      cavityEnergy: cavity.energy,
      leftMirrorEnergy: leftMirror.energy,
      rightMirrorEnergy: rightMirror.energy,
      totalEnergy: outside.energy,
      cavityEnergyFraction: cavity.energy / Math.max(1e-30, outside.energy),
      mirrorEnergyFraction: (leftMirror.energy + rightMirror.energy) / Math.max(1e-30, outside.energy),
      cavityMaterialCells: cavity.materialCells,
      mirrorMaterialCells: leftMirror.materialCells + rightMirror.materialCells,
      standingContrast: lineMax / Math.max(1e-30, lineMean),
      standingVisibility: (lineMax - (Number.isFinite(lineMin) ? lineMin : 0)) / Math.max(1e-30, lineMax + (Number.isFinite(lineMin) ? lineMin : 0)),
    };
  });
}

async function ringResonatorMetrics(page) {
  return page.evaluate(() => {
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const cx = midX + Math.round(0.5 * cpw);
    const cy = midY;
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return sim.analysisFieldEnergyDensityAt(idx);
      if (sim.material[idx] === 2) return 0;
      return sim.ez[idx] * sim.ez[idx] + sim.hx[idx] * sim.hx[idx] + sim.hy[idx] * sim.hy[idx];
    };
    let ringEnergy = 0;
    let busEnergy = 0;
    let dropBusEnergy = 0;
    let totalEnergy = 0;
    let ringCells = 0;
    let busCells = 0;
    let dropBusCells = 0;
    const outerRx = Math.max(1, Math.round(1.1 * cpw));
    const outerRy = Math.max(1, Math.round(1.1 * cpw));
    const innerRx = Math.max(1, Math.round(0.84 * cpw));
    const innerRy = Math.max(1, Math.round(0.84 * cpw));
    const busHalf = Math.max(2, Math.round(0.18 * cpw));
    const busY = midY + Math.round(1.2 * cpw);
    const dropY = midY - Math.round(1.2 * cpw);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const idx = sim.id(x, y);
        const energy = energyAt(idx);
        totalEnergy += energy;
        const dx = x - cx;
        const dy = y - cy;
        const highIndex = Math.max(Math.abs(sim.eps[idx]), Math.abs(sim.epsY[idx])) > 5;
        const outer = (dx / outerRx) * (dx / outerRx) + (dy / outerRy) * (dy / outerRy) <= 1;
        const inner = (dx / innerRx) * (dx / innerRx) + (dy / innerRy) * (dy / innerRy) < 1;
        if (highIndex && outer && !inner) {
          ringEnergy += energy;
          ringCells += 1;
        }
        if (highIndex && Math.abs(y - busY) <= busHalf) {
          busEnergy += energy;
          busCells += 1;
        }
        if (highIndex && Math.abs(y - dropY) <= busHalf) {
          dropBusEnergy += energy;
          dropBusCells += 1;
        }
      }
    }
    return {
      ringEnergy,
      busEnergy,
      dropBusEnergy,
      totalEnergy,
      ringCells,
      busCells,
      dropBusCells,
      ringEnergyFraction: ringEnergy / Math.max(1e-30, totalEnergy),
      ringToBusRatio: ringEnergy / Math.max(1e-30, busEnergy),
      dropToBusRatio: dropBusEnergy / Math.max(1e-30, busEnergy),
    };
  });
}

async function scatteringCylinderMetrics(page) {
  return page.evaluate(() => {
    if (state.analysisEnabled) {
      sim.measure();
      sim.analysisFarFieldEstimate?.(96);
    }
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const cx = midX + Math.round(0.7 * cpw);
    const cy = midY;
    const source = state.sources?.[0] || null;
    const sourceX = source ? sim.sourceXCell(source) : minX;
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return sim.analysisFieldEnergyDensityAt(idx);
      if (sim.material[idx] === 2) return 0;
      return sim.ez[idx] * sim.ez[idx] + sim.hx[idx] * sim.hx[idx] + sim.hy[idx] * sim.hy[idx];
    };
    const sumBox = (x0, x1, y0, y1) => {
      let energy = 0;
      let materialCells = 0;
      let pecCells = 0;
      let lossyCells = 0;
      let highIndexCells = 0;
      for (let y = Math.max(minY, y0); y <= Math.min(maxY, y1); y += 1) {
        for (let x = Math.max(minX, x0); x <= Math.min(maxX, x1); x += 1) {
          const idx = sim.id(x, y);
          energy += energyAt(idx);
          if (sim.material[idx] !== 0) materialCells += 1;
          if (sim.material[idx] === 2) pecCells += 1;
          if ((Number(sim.loss?.[idx]) || 0) > 0.02 || (Number(sim.lossY?.[idx]) || 0) > 0.02) lossyCells += 1;
          if (Math.max(Math.abs(sim.eps[idx]), Math.abs(sim.epsY[idx])) > 3.0) highIndexCells += 1;
        }
      }
      return { energy, materialCells, pecCells, lossyCells, highIndexCells };
    };
    const radius = Math.round(0.38 * cpw);
    let objectEnergy = 0;
    let objectMaterialCells = 0;
    let objectPecCells = 0;
    let objectLossyCells = 0;
    let objectHighIndexCells = 0;
    let objectCountProxy = 0;
    const visitedBins = new Set();
    for (let y = Math.max(minY, cy - radius); y <= Math.min(maxY, cy + radius); y += 1) {
      for (let x = Math.max(minX, cx - radius); x <= Math.min(maxX, cx + radius); x += 1) {
        const idx = sim.id(x, y);
        if (sim.material[idx] === 0) continue;
        objectEnergy += energyAt(idx);
        objectMaterialCells += 1;
        if (sim.material[idx] === 2) objectPecCells += 1;
        if ((Number(sim.loss?.[idx]) || 0) > 0.02 || (Number(sim.lossY?.[idx]) || 0) > 0.02) objectLossyCells += 1;
        if (Math.max(Math.abs(sim.eps[idx]), Math.abs(sim.epsY[idx])) > 3.0) objectHighIndexCells += 1;
        visitedBins.add(`${Math.round((x - cx) / Math.max(2, Math.round(0.12 * cpw)))},${Math.round((y - cy) / Math.max(2, Math.round(0.12 * cpw)))}`);
      }
    }
    objectCountProxy = visitedBins.size;
    const front = sumBox(cx - Math.round(1.55 * cpw), cx - Math.round(0.52 * cpw), midY - Math.round(1.0 * cpw), midY + Math.round(1.0 * cpw));
    const back = sumBox(cx + Math.round(0.55 * cpw), cx + Math.round(1.85 * cpw), midY - Math.round(1.0 * cpw), midY + Math.round(1.0 * cpw));
    const side = {
      energy:
        sumBox(cx - Math.round(0.35 * cpw), cx + Math.round(1.4 * cpw), midY - Math.round(2.4 * cpw), midY - Math.round(1.05 * cpw)).energy +
        sumBox(cx - Math.round(0.35 * cpw), cx + Math.round(1.4 * cpw), midY + Math.round(1.05 * cpw), midY + Math.round(2.4 * cpw)).energy,
    };
    const upstream = sumBox(sourceX + Math.round(0.45 * cpw), cx - Math.round(0.75 * cpw), midY - Math.round(0.55 * cpw), midY + Math.round(0.55 * cpw));
    const shadow = sumBox(cx + Math.round(0.72 * cpw), cx + Math.round(2.2 * cpw), midY - Math.round(0.42 * cpw), midY + Math.round(0.42 * cpw));
    const dimerGap = sumBox(
      midX + Math.round(0.69 * cpw),
      midX + Math.round(0.81 * cpw),
      midY - Math.round(0.2 * cpw),
      midY + Math.round(0.2 * cpw),
    );
    return {
      fieldComponent: state.fieldComponent,
      analysisSamples: sim.analysisSamples || 0,
      farFieldMode: sim.analysisFarFieldMode || "",
      scatteringTotal: sim.analysisScatteringTotal || 0,
      scatteringForward: sim.analysisScatteringForward || 0,
      scatteringBackward: sim.analysisScatteringBackward || 0,
      forwardBackwardRatio: (sim.analysisScatteringForward || 0) / Math.max(1e-30, sim.analysisScatteringBackward || 0),
      backwardForwardRatio: (sim.analysisScatteringBackward || 0) / Math.max(1e-30, sim.analysisScatteringForward || 0),
      objectEnergy,
      objectMaterialCells,
      objectPecCells,
      objectLossyCells,
      objectHighIndexCells,
      objectCountProxy,
      frontEnergy: front.energy,
      backEnergy: back.energy,
      sideEnergy: side.energy,
      upstreamEnergy: upstream.energy,
      shadowEnergy: shadow.energy,
      dimerGapEnergy: dimerGap.energy,
      sideToBackRatio: side.energy / Math.max(1e-30, back.energy),
      shadowToUpstreamRatio: shadow.energy / Math.max(1e-30, upstream.energy),
      backToFrontRatio: back.energy / Math.max(1e-30, front.energy),
      dimerGapToObjectRatio: dimerGap.energy / Math.max(1e-30, objectEnergy),
    };
  });
}

async function randomScatteringMetrics(page) {
  return page.evaluate(() => {
    if (state.analysisEnabled) {
      sim.measure();
      sim.analysisFarFieldEstimate?.(96);
    }
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midY = Math.round(0.5 * (minY + maxY));
    const source = state.sources?.[0] || null;
    const sourceX = source ? sim.sourceXCell(source) : minX;
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return sim.analysisFieldEnergyDensityAt(idx);
      if (sim.material[idx] === 2) return 0;
      return sim.ez[idx] * sim.ez[idx] + sim.hx[idx] * sim.hx[idx] + sim.hy[idx] * sim.hy[idx];
    };
    const sumBox = (x0, x1, y0, y1) => {
      let energy = 0;
      let materialCells = 0;
      let highIndexCells = 0;
      for (let y = Math.max(minY, y0); y <= Math.min(maxY, y1); y += 1) {
        for (let x = Math.max(minX, x0); x <= Math.min(maxX, x1); x += 1) {
          const idx = sim.id(x, y);
          energy += energyAt(idx);
          if (sim.material[idx] !== 0) materialCells += 1;
          if (Math.max(Math.abs(sim.eps[idx]), Math.abs(sim.epsY[idx])) > 3.0) highIndexCells += 1;
        }
      }
      return { energy, materialCells, highIndexCells };
    };
    let materialCells = 0;
    let highIndexCells = 0;
    let xWeighted = 0;
    let yWeighted = 0;
    let energyTotal = 0;
    const occupiedBins = new Set();
    const bin = Math.max(2, Math.round(0.16 * cpw));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const idx = sim.id(x, y);
        const energy = energyAt(idx);
        energyTotal += energy;
        xWeighted += x * energy;
        yWeighted += y * energy;
        if (sim.material[idx] !== 0) {
          materialCells += 1;
          occupiedBins.add(`${Math.round(x / bin)},${Math.round(y / bin)}`);
        }
        if (Math.max(Math.abs(sim.eps[idx]), Math.abs(sim.epsY[idx])) > 3.0) highIndexCells += 1;
      }
    }
    const left = sumBox(sourceX + Math.round(0.4 * cpw), sourceX + Math.round(2.4 * cpw), midY - Math.round(0.55 * cpw), midY + Math.round(0.55 * cpw));
    const center = sumBox(sourceX + Math.round(2.5 * cpw), sourceX + Math.round(5.6 * cpw), midY - Math.round(0.75 * cpw), midY + Math.round(0.75 * cpw));
    const right = sumBox(maxX - Math.round(2.7 * cpw), maxX - Math.round(0.75 * cpw), midY - Math.round(0.55 * cpw), midY + Math.round(0.55 * cpw));
    const lateral = {
      energy:
        sumBox(sourceX + Math.round(1.6 * cpw), maxX - Math.round(0.8 * cpw), minY, midY - Math.round(1.0 * cpw)).energy +
        sumBox(sourceX + Math.round(1.6 * cpw), maxX - Math.round(0.8 * cpw), midY + Math.round(1.0 * cpw), maxY).energy,
    };
    return {
      analysisSamples: sim.analysisSamples || 0,
      farFieldMode: sim.analysisFarFieldMode || "",
      scatteringTotal: sim.analysisScatteringTotal || 0,
      materialCells,
      highIndexCells,
      scattererCountProxy: occupiedBins.size,
      totalEnergy: energyTotal,
      centroidXLambda: energyTotal > 1e-30 ? xWeighted / energyTotal / cpw : 0,
      centroidYLambda: energyTotal > 1e-30 ? yWeighted / energyTotal / cpw : 0,
      leftChannelEnergy: left.energy,
      centerChannelEnergy: center.energy,
      rightChannelEnergy: right.energy,
      lateralEnergy: lateral.energy,
      lateralFraction: lateral.energy / Math.max(1e-30, energyTotal),
      rightToLeftChannelRatio: right.energy / Math.max(1e-30, left.energy),
      centerToLeftChannelRatio: center.energy / Math.max(1e-30, left.energy),
    };
  });
}

async function periodicPhotonicsMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const analysis = state.analysisEnabled && typeof sim.analysisMetricEstimate === "function" ? sim.analysisMetricEstimate() : null;
    const phcBloch =
      typeof sim.phcBlochEstimate === "function" ? sim.phcBlochEstimate(0) : analysis?.phcBloch ?? null;
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const aCells = Math.max(2, Math.round(0.45 * cpw));
    const sourceList = Array.isArray(state.sources) ? state.sources : [];
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return sim.analysisFieldEnergyDensityAt(idx);
      if (sim.material[idx] === 2) return 0;
      return sim.ez[idx] * sim.ez[idx] + sim.hx[idx] * sim.hx[idx] + sim.hy[idx] * sim.hy[idx];
    };
    const isHighIndex = (idx) => sim.material[idx] !== 0 && Math.max(Math.abs(sim.eps[idx]), Math.abs(sim.epsY[idx])) > 3.0;
    const fanoCx = midX + Math.round(0.8 * cpw);
    const fanoCy = midY - Math.round(0.5 * cpw);
    const fanoRx = Math.max(2, Math.round(0.42 * cpw));
    const fanoRy = Math.max(2, Math.round(0.42 * cpw));
    const box = (x, y, halfXLambda, halfYLambda, cx = midX, cy = midY) =>
      Math.abs(x - cx) <= Math.round(halfXLambda * cpw) && Math.abs(y - cy) <= Math.round(halfYLambda * cpw);
    const ellipse = (x, y, cx, cy, rx, ry) => {
      const dx = (x - cx) / Math.max(1, rx);
      const dy = (y - cy) / Math.max(1, ry);
      return dx * dx + dy * dy <= 1;
    };

    const bins = new Map();
    const rowBins = new Map();
    const colBins = new Map();
    const materialBounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    let materialCells = 0;
    let highIndexCells = 0;
    let totalEnergy = 0;
    let highIndexEnergy = 0;
    let centerDefectEnergy = 0;
    let lineDefectEnergy = 0;
    let lineLeftEnergy = 0;
    let lineCenterEnergy = 0;
    let lineRightEnergy = 0;
    let lineSourceEnergy = 0;
    let adjacentRowEnergy = 0;
    let cavityEnergy = 0;
    let fanoBusEnergy = 0;
    let fanoResonatorEnergy = 0;
    let fanoGapEnergy = 0;
    let centerHighIndexCells = 0;
    let centralLineHighIndexCells = 0;
    let adjacentRowHighIndexCells = 0;
    let cavityHighIndexCells = 0;
    let fanoBusHighIndexCells = 0;
    let fanoResonatorHighIndexCells = 0;
    let fanoGapHighIndexCells = 0;
    const firstSource = sourceList[0] || null;
    const firstSourceX =
      firstSource && typeof sim.sourceXCell === "function"
        ? sim.sourceXCell(firstSource)
        : Math.round(Number(firstSource?.xLambda || midX / cpw) * cpw);
    const firstSourceY =
      firstSource && typeof sim.sourceYCell === "function"
        ? sim.sourceYCell(firstSource)
        : Math.round(Number(firstSource?.yLambda || midY / cpw) * cpw);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const idx = sim.id(x, y);
        const energy = energyAt(idx);
        totalEnergy += energy;

        const inCenterDefect = box(x, y, 0.24, 0.24);
        const inLineDefect = box(x, y, 3.4, 0.16);
        const inLineLeft = box(x, y, 0.55, 0.16, midX - Math.round(2.25 * cpw), midY);
        const inLineCenter = box(x, y, 0.55, 0.16, midX, midY);
        const inLineRight = box(x, y, 0.55, 0.16, midX + Math.round(2.25 * cpw), midY);
        const inLineSource = box(x, y, 0.45, 0.16, firstSourceX, firstSourceY);
        const inAdjacentRows =
          Math.abs(Math.abs(y - midY) - aCells) <= Math.round(0.15 * cpw) && Math.abs(x - midX) <= Math.round(3.4 * cpw);
        const inCavity = box(x, y, 0.76, 0.2);
        const inFanoBus = Math.abs(y - midY) <= Math.round(0.18 * cpw);
        const inFanoResonator = ellipse(x, y, fanoCx, fanoCy, fanoRx, fanoRy);
        const inFanoGap =
          Math.abs(x - fanoCx) <= Math.round(0.22 * cpw) &&
          y > fanoCy + Math.round(0.37 * cpw) &&
          y < midY - Math.round(0.12 * cpw);

        if (inCenterDefect) centerDefectEnergy += energy;
        if (inLineDefect) lineDefectEnergy += energy;
        if (inLineLeft) lineLeftEnergy += energy;
        if (inLineCenter) lineCenterEnergy += energy;
        if (inLineRight) lineRightEnergy += energy;
        if (inLineSource) lineSourceEnergy += energy;
        if (inAdjacentRows) adjacentRowEnergy += energy;
        if (inCavity) cavityEnergy += energy;
        if (inFanoBus) fanoBusEnergy += energy;
        if (inFanoResonator) fanoResonatorEnergy += energy;
        if (inFanoGap) fanoGapEnergy += energy;

        if (sim.material[idx] !== 0) {
          materialCells += 1;
          materialBounds.minX = Math.min(materialBounds.minX, x);
          materialBounds.maxX = Math.max(materialBounds.maxX, x);
          materialBounds.minY = Math.min(materialBounds.minY, y);
          materialBounds.maxY = Math.max(materialBounds.maxY, y);
        }

        if (!isHighIndex(idx)) continue;
        highIndexCells += 1;
        highIndexEnergy += energy;
        if (inCenterDefect) centerHighIndexCells += 1;
        if (inLineDefect) centralLineHighIndexCells += 1;
        if (inAdjacentRows) adjacentRowHighIndexCells += 1;
        if (inCavity) cavityHighIndexCells += 1;
        if (inFanoBus) fanoBusHighIndexCells += 1;
        if (inFanoResonator) fanoResonatorHighIndexCells += 1;
        if (inFanoGap) fanoGapHighIndexCells += 1;

        const ix = Math.round((x - midX) / aCells);
        const iy = Math.round((y - midY) / aCells);
        const key = `${ix},${iy}`;
        const bin = bins.get(key) || { ix, iy, cells: 0, xSum: 0, ySum: 0 };
        bin.cells += 1;
        bin.xSum += x;
        bin.ySum += y;
        bins.set(key, bin);
        if (!rowBins.has(iy)) rowBins.set(iy, new Set());
        if (!colBins.has(ix)) colBins.set(ix, new Set());
        rowBins.get(iy).add(ix);
        colBins.get(ix).add(iy);
      }
    }

    let latticeOffsetSum = 0;
    let latticeOffsetMax = 0;
    for (const bin of bins.values()) {
      const cx = bin.xSum / Math.max(1, bin.cells);
      const cy = bin.ySum / Math.max(1, bin.cells);
      const offset = Math.hypot(cx - (midX + bin.ix * aCells), cy - (midY + bin.iy * aCells)) / cpw;
      latticeOffsetSum += offset;
      latticeOffsetMax = Math.max(latticeOffsetMax, offset);
    }

    const hasBin = (ix, iy) => bins.has(`${ix},${iy}`);
    const centralVacancyBins3 = [-1, 0, 1].filter((ix) => !hasBin(ix, 0)).length;
    const lineRowBinCount = rowBins.get(0)?.size || 0;
    const centerBinHighIndexCells = bins.get("0,0")?.cells || 0;
    let sourcePhaseDifferenceDeg = null;
    let sourceAmplitudeRatio = null;
    let sourceSeparationLambda = null;
    if (sourceList.length >= 2) {
      const phase0 = Number(sourceList[0].phaseDeg || 0);
      const phase1 = Number(sourceList[1].phaseDeg || 0);
      sourcePhaseDifferenceDeg = Math.abs((((phase1 - phase0 + 180) % 360) + 360) % 360 - 180);
      const amp0 = Math.abs(Number(sourceList[0].amplitude ?? 1));
      const amp1 = Math.abs(Number(sourceList[1].amplitude ?? 1));
      sourceAmplitudeRatio = Math.min(amp0, amp1) / Math.max(1e-30, Math.max(amp0, amp1));
      const x0 = typeof sim.sourceXCell === "function" ? sim.sourceXCell(sourceList[0]) : Number(sourceList[0].xLambda || 0) * cpw;
      const y0 = typeof sim.sourceYCell === "function" ? sim.sourceYCell(sourceList[0]) : Number(sourceList[0].yLambda || 0) * cpw;
      const x1 = typeof sim.sourceXCell === "function" ? sim.sourceXCell(sourceList[1]) : Number(sourceList[1].xLambda || 0) * cpw;
      const y1 = typeof sim.sourceYCell === "function" ? sim.sourceYCell(sourceList[1]) : Number(sourceList[1].yLambda || 0) * cpw;
      sourceSeparationLambda = Math.hypot(x1 - x0, y1 - y0) / cpw;
    }

    return {
      preset: state.preset,
      sweepMode: state.sweepMode,
      fieldComponent: state.fieldComponent,
      analysisSamples: sim.analysisSamples || 0,
      leakageRate: analysis?.leakageRate ?? null,
      phcBloch,
      sourceCount: sourceList.length,
      sourceShapes: sourceList.map((source) => source?.shape || ""),
      sourcePhaseDifferenceDeg,
      sourceAmplitudeRatio,
      sourceSeparationLambda,
      materialCells,
      highIndexCells,
      materialBounds: Number.isFinite(materialBounds.minX)
        ? {
            minXLambda: materialBounds.minX / cpw,
            maxXLambda: materialBounds.maxX / cpw,
            minYLambda: materialBounds.minY / cpw,
            maxYLambda: materialBounds.maxY / cpw,
          }
        : null,
      rodCountProxy: bins.size,
      rowsProxy: rowBins.size,
      colsProxy: colBins.size,
      centerBinHighIndexCells,
      centerHighIndexCells,
      centralVacancyBins3,
      lineRowBinCount,
      centralLineHighIndexCells,
      adjacentRowHighIndexCells,
      cavityHighIndexCells,
      latticeOffsetMeanLambda: bins.size > 0 ? latticeOffsetSum / bins.size : 0,
      latticeOffsetMaxLambda: latticeOffsetMax,
      totalEnergy,
      highIndexEnergy,
      highIndexEnergyFraction: highIndexEnergy / Math.max(1e-30, totalEnergy),
      centerDefectEnergy,
      lineDefectEnergy,
      lineLeftEnergy,
      lineCenterEnergy,
      lineRightEnergy,
      lineSourceEnergy,
      adjacentRowEnergy,
      cavityEnergy,
      centerDefectEnergyFraction: centerDefectEnergy / Math.max(1e-30, totalEnergy),
      lineDefectEnergyFraction: lineDefectEnergy / Math.max(1e-30, totalEnergy),
      lineLeftEnergyFraction: lineLeftEnergy / Math.max(1e-30, totalEnergy),
      lineCenterEnergyFraction: lineCenterEnergy / Math.max(1e-30, totalEnergy),
      lineRightEnergyFraction: lineRightEnergy / Math.max(1e-30, totalEnergy),
      lineSourceEnergyFraction: lineSourceEnergy / Math.max(1e-30, totalEnergy),
      lineRightToSourceEnergyRatio: lineRightEnergy / Math.max(1e-30, lineSourceEnergy),
      lineRightToAdjacentEnergyRatio: lineRightEnergy / Math.max(1e-30, adjacentRowEnergy),
      lineRightToLeftEnergyRatio: lineRightEnergy / Math.max(1e-30, lineLeftEnergy),
      cavityEnergyFraction: cavityEnergy / Math.max(1e-30, totalEnergy),
      adjacentToLineEnergyRatio: adjacentRowEnergy / Math.max(1e-30, lineDefectEnergy),
      fanoBusHighIndexCells,
      fanoResonatorHighIndexCells,
      fanoGapHighIndexCells,
      fanoBusEnergy,
      fanoResonatorEnergy,
      fanoGapEnergy,
      fanoResonatorEnergyFraction: fanoResonatorEnergy / Math.max(1e-30, totalEnergy),
      fanoResonatorToBusRatio: fanoResonatorEnergy / Math.max(1e-30, fanoBusEnergy),
    };
  });
}

async function topologicalPhotonicsMetrics(page) {
  return page.evaluate(() => {
    sim.measure();
    const analysis = state.analysisEnabled && typeof sim.analysisMetricEstimate === "function" ? sim.analysisMetricEstimate() : null;
    const sshBloch = typeof sim.sshBlochEstimate === "function" ? sim.sshBlochEstimate() : analysis?.sshBloch ?? null;
    const cpw = Math.max(8, Math.round(state.cellsPerWavelength || 24));
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const midX = Math.round(0.5 * (minX + maxX));
    const midY = Math.round(0.5 * (minY + maxY));
    const cornerX = midX + Math.round(0.7 * cpw);
    const energyAt = (idx) => {
      if (typeof sim.analysisFieldEnergyDensityAt === "function") return sim.analysisFieldEnergyDensityAt(idx);
      if (sim.material[idx] === 2) return 0;
      return sim.ez[idx] * sim.ez[idx] + sim.hx[idx] * sim.hx[idx] + sim.hy[idx] * sim.hy[idx];
    };
    const highIndexAt = (idx) => sim.material[idx] !== 0 && sim.material[idx] !== 2 && Math.max(Math.abs(sim.eps[idx]), Math.abs(sim.epsY[idx])) > 3.0;
    const xProfile = Array.from({ length: maxX - minX + 1 }, () => 0);
    const honeycombCells = new Set();
    const honeycombSubBins = new Set();
    const sublattice = {
      top: { a: 0, b: 0 },
      bottom: { a: 0, b: 0 },
      leftTop: { a: 0, b: 0 },
      leftBottom: { a: 0, b: 0 },
      rightTop: { a: 0, b: 0 },
      rightBottom: { a: 0, b: 0 },
    };
    const pitchX = 0.56 * cpw;
    const pitchY = 0.48 * cpw;
    let materialCells = 0;
    let highIndexCells = 0;
    let pecCells = 0;
    let modulatedCells = 0;
    let gainCells = 0;
    let lossyCells = 0;
    let totalEnergy = 0;
    let highIndexEnergy = 0;
    let interfaceEnergy = 0;
    let bendChannelEnergy = 0;
    let defectHighIndexCells = 0;
    let defectPecCells = 0;
    let defectEnergy = 0;
    let yWeightedHighIndex = 0;
    let highIndexWeight = 0;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const idx = sim.id(x, y);
        const energy = energyAt(idx);
        const inStraightInterface = Math.abs(y - midY) <= Math.round(0.34 * cpw);
        const inBendChannel =
          (x <= cornerX && Math.abs(y - midY) <= Math.round(0.34 * cpw)) ||
          (x >= cornerX - Math.round(0.14 * cpw) && Math.abs(x - cornerX) <= Math.round(0.34 * cpw));
        const inDefect = Math.hypot(x - (midX + Math.round(0.15 * cpw)), y - midY) <= Math.round(0.44 * cpw);
        totalEnergy += energy;
        if (inStraightInterface) interfaceEnergy += energy;
        if (inBendChannel) bendChannelEnergy += energy;
        if (inDefect) defectEnergy += energy;
        if (sim.material[idx] !== 0) materialCells += 1;
        if (sim.material[idx] === 2) {
          pecCells += 1;
          if (inDefect) defectPecCells += 1;
        }
        if (sim.modulatedMaterial?.[idx]) modulatedCells += 1;
        const loss = Number(sim.loss?.[idx]) || 0;
        if (loss < -1e-9) gainCells += 1;
        if (loss > 1e-9) lossyCells += 1;
        if (!highIndexAt(idx)) continue;

        highIndexCells += 1;
        highIndexEnergy += energy;
        yWeightedHighIndex += y;
        highIndexWeight += 1;
        if (Math.abs(y - midY) <= Math.round(0.38 * cpw)) xProfile[x - minX] += 1;
        if (inDefect) defectHighIndexCells += 1;

        const iy = Math.round((y - midY) / pitchY);
        const rowOffset = Math.abs(iy % 2) === 1 ? 0.5 * pitchX : 0;
        const ix = Math.round((x - midX - rowOffset) / pitchX);
        const cellCenterX = midX + ix * pitchX + rowOffset;
        const sub = x < cellCenterX ? "a" : "b";
        honeycombCells.add(`${ix},${iy}`);
        honeycombSubBins.add(`${ix},${iy},${sub}`);
        const vertical = y < midY ? "top" : "bottom";
        const horizontal = x < cornerX ? "left" : "right";
        sublattice[vertical][sub] += 1;
        sublattice[`${horizontal}${vertical === "top" ? "Top" : "Bottom"}`][sub] += 1;
      }
    }

    const smooth = xProfile.map((value, index) => {
      const left = index > 0 ? xProfile[index - 1] : value;
      const right = index < xProfile.length - 1 ? xProfile[index + 1] : value;
      return 0.25 * left + 0.5 * value + 0.25 * right;
    });
    const maxProfile = smooth.reduce((max, value) => Math.max(max, value), 0);
    const peakThreshold = Math.max(1, 0.28 * maxProfile);
    const minPeakSeparation = Math.max(2, Math.round(0.16 * cpw));
    const sitePeaks = [];
    for (let index = 1; index < smooth.length - 1; index += 1) {
      if (smooth[index] < peakThreshold || smooth[index] < smooth[index - 1] || smooth[index] < smooth[index + 1]) continue;
      const x = minX + index;
      const last = sitePeaks[sitePeaks.length - 1];
      if (last && x - last.x < minPeakSeparation) {
        if (smooth[index] > last.weight) {
          last.x = x;
          last.weight = smooth[index];
        }
      } else {
        sitePeaks.push({ x, weight: smooth[index] });
      }
    }
    const gaps = [];
    for (let i = 1; i < sitePeaks.length; i += 1) gaps.push((sitePeaks[i].x - sitePeaks[i - 1].x) / cpw);
    const evenGaps = gaps.filter((_gap, index) => index % 2 === 0);
    const oddGaps = gaps.filter((_gap, index) => index % 2 === 1);
    const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    const bias = (bucket) => (bucket.a + bucket.b > 0 ? (bucket.a - bucket.b) / (bucket.a + bucket.b) : 0);
    const source = state.sources?.[0] || null;
    const sourceX = source && typeof sim.sourceXCell === "function" ? sim.sourceXCell(source) : minX;
    const sourceY = source && typeof sim.sourceYCell === "function" ? sim.sourceYCell(source) : midY;
    const sourceRadius = Math.max(2, Math.round(0.4 * cpw));
    let sourceEnergy = 0;
    for (let y = Math.max(minY, sourceY - sourceRadius); y <= Math.min(maxY, sourceY + sourceRadius); y += 1) {
      for (let x = Math.max(minX, sourceX - sourceRadius); x <= Math.min(maxX, sourceX + sourceRadius); x += 1) {
        if (Math.hypot(x - sourceX, y - sourceY) <= sourceRadius) sourceEnergy += energyAt(sim.id(x, y));
      }
    }

    return {
      preset: state.preset,
      fieldComponent: state.fieldComponent,
      viewMode: state.viewMode,
      analysisSamples: sim.analysisSamples || 0,
      materialSaturableGainEnabled: Boolean(state.materialSaturableGainEnabled),
      materialModulationEnabled: Boolean(state.materialModulationEnabled),
      modulationDepth: Number(state.modulationDepth) || 0,
      modulationFrequency: Number(state.modulationFrequency) || 0,
      sshBloch,
      materialCells,
      highIndexCells,
      pecCells,
      modulatedCells,
      gainCells,
      lossyCells,
      siteCountProxy: sitePeaks.length,
      sitePeaksLambda: sitePeaks.map((peak) => Number((peak.x / cpw).toFixed(3))),
      firstGapLambda: gaps[0] ?? null,
      secondGapLambda: gaps[1] ?? null,
      evenGapMeanLambda: mean(evenGaps),
      oddGapMeanLambda: mean(oddGaps),
      gapContrastLambda: Math.abs(mean(evenGaps) - mean(oddGaps)),
      verticalSpanLambda:
        highIndexWeight > 0 ? Math.abs(yWeightedHighIndex / highIndexWeight - midY) / cpw : 0,
      honeycombCellProxy: honeycombCells.size,
      honeycombSubBinProxy: honeycombSubBins.size,
      topSublatticeBias: bias(sublattice.top),
      bottomSublatticeBias: bias(sublattice.bottom),
      leftTopSublatticeBias: bias(sublattice.leftTop),
      leftBottomSublatticeBias: bias(sublattice.leftBottom),
      rightTopSublatticeBias: bias(sublattice.rightTop),
      rightBottomSublatticeBias: bias(sublattice.rightBottom),
      totalEnergy,
      highIndexEnergy,
      highIndexEnergyFraction: highIndexEnergy / Math.max(1e-30, totalEnergy),
      sourceEnergy,
      sourceEnergyFraction: sourceEnergy / Math.max(1e-30, totalEnergy),
      interfaceEnergy,
      interfaceEnergyFraction: interfaceEnergy / Math.max(1e-30, totalEnergy),
      bendChannelEnergy,
      bendChannelEnergyFraction: bendChannelEnergy / Math.max(1e-30, totalEnergy),
      defectHighIndexCells,
      defectPecCells,
      defectEnergy,
      defectEnergyFraction: defectEnergy / Math.max(1e-30, totalEnergy),
    };
  });
}

async function runSmokeCase(page, testCase) {
  const steps = Math.trunc(Number(testCase.steps) || Number(matrix.profiles[testCase.profile]?.steps) || 8);
  const startedAt = Date.now();
  await selectPreset(page, testCase.preset);
  if (mode === "physics") await preparePhysicsCase(page, testCase);
  const before = await simulationSnapshot(page);
  const stepResult = mode === "physics"
    ? await stepPhysicsSimulation(page, steps, testCase)
    : { elapsedMs: await stepSimulation(page, steps) };
  const elapsedMs = stepResult.elapsedMs;
  const after = await simulationSnapshot(page);
  const bodyText = await page.locator("body").innerText();
  const activeMedia = await page.evaluate(() => {
    const hasNonzero = (values) => Boolean(values?.some?.((value) => value !== 0));
    const labels = [];
    if (state.materialModulationEnabled || hasNonzero(sim.modulatedMaterial)) labels.push("modulated");
    if (state.materialNonlinearEnabled || state.materialHarmonicEnabled || hasNonzero(sim.nonlinearMaterial)) labels.push("nonlinear");
    if (state.materialPhaseChangeEnabled || hasNonzero(sim.phaseChangeMaterial)) labels.push("phase-change");
    if (state.materialDispersionEnabled || hasNonzero(sim.dispersiveMaterial) || hasNonzero(sim.muDispersiveMaterial)) labels.push("ADE");
    if (state.materialGyrotropyEnabled || hasNonzero(sim.gyrotropicMaterial)) labels.push("gyrotropic");
    if (state.materialBianisotropyEnabled || hasNonzero(sim.bianisotropicMaterial)) labels.push("bianisotropic");
    if (state.materialConductivityEnabled || hasNonzero(sim.conductivity) || hasNonzero(sim.conductivityY)) labels.push("conductive");
    if (state.materialSaturableGainEnabled) labels.push("gain-limited");
    return labels.length > 0 ? labels : ["static"];
  });
  const stabilityMedia = activeMedia.join(", ");
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
    physicsTrace: mode === "physics" ? stepResult : undefined,
    stabilityMedia,
    passed: true,
    failures: [],
    warnings: [],
  };

  if (Number(after.time) <= Number(before.time)) status.failures.push("step counter did not advance");
  if (!Number.isFinite(Number(after.maxField)) && !parseFiniteUiNumber(after.maxField)) status.failures.push("max field is non-finite");
  if (!Number.isFinite(Number(after.energy)) && !parseFiniteUiNumber(after.energy)) status.failures.push("energy is non-finite");
  if (/\b(NaN|Infinity|undefined)\b/.test(bodyText)) status.failures.push("UI contains non-finite or undefined text");
  if (testCase.acceptance?.requiresActiveMediaLabel && !String(stabilityMedia).includes(testCase.acceptance.requiresActiveMediaLabel)) {
    status.failures.push(`stability media does not include ${testCase.acceptance.requiresActiveMediaLabel}`);
  }
  if (testCase.id === "normal_interface_fresnel") {
    status.diagnostics = await diagnosticMetrics(page);
    const expectedR = Number(testCase.reference?.expectedR);
    const referenceN1 = Number(testCase.reference?.n1);
    const referenceN2 = Number(testCase.reference?.n2);
    const reference = fresnelCoefficients(0, referenceN1, referenceN2, "tm");
    const rTolerance = Number(testCase.acceptance?.reflectanceAbsTolerance);
    const rawTransmittanceMax = Number(testCase.acceptance?.rawTransmittanceMax);
    const minSpectrumBins = Number(testCase.acceptance?.spectralRtaMinBins);
    status.diagnostics.reference = {
      reflectance: Number.isFinite(expectedR) ? expectedR : reference.reflectance,
      transmittance: reference.transmittance,
      powerBalanceResidual: Math.abs(reference.reflectance + reference.transmittance - 1),
      note:
        "The line-monitor transmittance is a finite-scene port observable; Fresnel energy closure is checked against the analytic lossless interface reference, not by treating the finite monitor as a de-embedded S-parameter.",
    };
    if (!(status.diagnostics.samples > 12)) status.failures.push("Fresnel diagnostics did not collect enough line-monitor samples");
    if (Number.isFinite(expectedR) && Number.isFinite(rTolerance)) {
      const error = Math.abs(status.diagnostics.reflectance - expectedR);
      status.diagnostics.reflectanceAbsError = error;
      if (error > rTolerance) {
        status.failures.push(`Fresnel R error ${error} exceeds ${rTolerance}`);
      }
    }
    if (
      Number.isFinite(rawTransmittanceMax) &&
      !(Number.isFinite(status.diagnostics.transmittance) && status.diagnostics.transmittance >= 0 && status.diagnostics.transmittance <= rawTransmittanceMax)
    ) {
      status.failures.push(`raw line-monitor T ${status.diagnostics.transmittance} is outside [0, ${rawTransmittanceMax}]`);
    }
    if (Number.isFinite(minSpectrumBins) && status.diagnostics.spectrumValidPointCount < minSpectrumBins) {
      status.failures.push(`spectral R/T/A has ${status.diagnostics.spectrumValidPointCount} valid bins, expected at least ${minSpectrumBins}`);
    }
    if (testCase.acceptance?.powerBalanceRequiresDft && !String(status.diagnostics.powerBalanceMethod || "").includes("DFT")) {
      status.failures.push(`line-port power balance did not use DFT normalization: ${status.diagnostics.powerBalanceMethod}`);
    }
  }
  if (testCase.id === "brewster_tm_minimum") {
    status.brewsterScan = await brewsterScanMetrics(page, testCase);
    const angleTolerance = Number(testCase.acceptance?.angleToleranceDeg);
    const reflectanceLimit = Number(testCase.acceptance?.maxMinimumReflectance);
    if (!status.brewsterScan?.analyticMinimum) {
      status.failures.push("Brewster scan did not produce a minimum");
    } else {
      const angleError = Math.abs(status.brewsterScan.analyticMinimum.angleDeg - status.brewsterScan.expectedAngleDeg);
      status.brewsterScan.angleErrorDeg = angleError;
      if (Number.isFinite(angleTolerance) && angleError > angleTolerance) {
        status.failures.push(`Analytic Brewster scan minimum angle error ${angleError} deg exceeds ${angleTolerance} deg`);
      }
      const expectedPoint = status.brewsterScan.results.reduce((best, item) => {
        const error = Math.abs(item.angleDeg - status.brewsterScan.expectedAngleDeg);
        return error < best.error ? { item, error } : best;
      }, { item: null, error: Infinity }).item;
      status.brewsterScan.expectedPoint = expectedPoint;
      const expectedReflectance = expectedPoint?.reflectance;
      if (Number.isFinite(reflectanceLimit) && !(Number.isFinite(expectedReflectance) && expectedReflectance <= reflectanceLimit)) {
        status.failures.push(`Brewster-angle R ${expectedReflectance} exceeds ${reflectanceLimit}`);
      }
    }
  }
  if (testCase.id === "pml_reflection") {
    const lateEnergyLimit = Number(testCase.acceptance?.lateEnergyRatioMax);
    const reflectionLimit = Number(testCase.acceptance?.reflectionMax);
    status.pml = {
      lateEnergyRatio: stepResult.lateEnergyRatio,
      residualReflectionProxy: stepResult.lateEnergyRatio,
      energyPeak: stepResult.energyPeak,
      lateEnergyAverage: stepResult.lateEnergyAverage,
    };
    if (!(stepResult.energyPeak > 1e-12)) status.failures.push("PML pulse did not build measurable field energy");
    if (Number.isFinite(lateEnergyLimit) && stepResult.lateEnergyRatio > lateEnergyLimit) {
      status.failures.push(`late PML energy ratio ${stepResult.lateEnergyRatio} exceeds ${lateEnergyLimit}`);
    }
    if (Number.isFinite(reflectionLimit) && status.pml.residualReflectionProxy > reflectionLimit) {
      status.failures.push(`PML residual reflection proxy ${status.pml.residualReflectionProxy} exceeds ${reflectionLimit}`);
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(testCase.acceptance || {}, "lateEnergyRatioMax") &&
    testCase.id !== "pml_reflection" &&
    testCase.id !== "resonator_ringdown_q" &&
    !testCase.acceptance?.materialModelCheck
  ) {
    const lateEnergyLimit = Number(testCase.acceptance.lateEnergyRatioMax);
    if (Number.isFinite(lateEnergyLimit) && stepResult.lateEnergyRatio > lateEnergyLimit) {
      status.failures.push(`late energy ratio ${stepResult.lateEnergyRatio} exceeds ${lateEnergyLimit}`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(testCase.acceptance || {}, "finalEnergyRatioMax")) {
    const finalEnergyLimit = Number(testCase.acceptance.finalEnergyRatioMax);
    if (Number.isFinite(finalEnergyLimit) && stepResult.finalEnergyRatio > finalEnergyLimit) {
      status.failures.push(`final energy ratio ${stepResult.finalEnergyRatio} exceeds ${finalEnergyLimit}`);
    }
  }
  if (testCase.id === "slab_waveguide_confinement") {
    status.modeLaunch = await slabWaveguideLaunchMetrics(page);
    status.modePort = await page.evaluate(() => {
      const metric = typeof sim.modePortAnalysisEstimate === "function" ? sim.modePortAnalysisEstimate() : null;
      return metric
        ? {
            available: Boolean(metric.available),
            valid: Boolean(metric.valid),
            neff: Number.isFinite(metric.neff) ? metric.neff : null,
            inputOverlap: Number.isFinite(metric.inputOverlap) ? metric.inputOverlap : null,
            outputOverlap: Number.isFinite(metric.outputOverlap) ? metric.outputOverlap : null,
            radiationFraction: Number.isFinite(metric.radiationFraction) ? metric.radiationFraction : null,
            modalTransmissionProxy: Number.isFinite(metric.modalTransmissionProxy) ? metric.modalTransmissionProxy : null,
            modalReflectionProxy: Number.isFinite(metric.modalReflectionProxy) ? metric.modalReflectionProxy : null,
            modalS11Power: Number.isFinite(metric.sParameters?.reflectance) ? metric.sParameters.reflectance : null,
            modalS21Power: Number.isFinite(metric.sParameters?.transmittance) ? metric.sParameters.transmittance : null,
            modalSPowerResidual: Number.isFinite(metric.sParameters?.balanceResidual) ? metric.sParameters.balanceResidual : null,
            modalSSamples: Number.isFinite(metric.sParameters?.sampleCount) ? metric.sParameters.sampleCount : null,
          }
        : null;
    });
    const backwardLimit = Number(testCase.acceptance?.backwardEnergyRatioMax);
    const radiationLimit = Number(testCase.acceptance?.radiationEnergyRatioMax);
    const coreFractionLimit = Number(testCase.acceptance?.coreEnergyFractionMin);
    const minModeNeff = Number(testCase.acceptance?.modeEffectiveIndexMin);
    const minModeInputOverlap = Number(testCase.acceptance?.modeInputOverlapMin);
    const minModeOutputOverlap = Number(testCase.acceptance?.modeOutputOverlapMin);
    const requiresModalS = Boolean(testCase.acceptance?.modalSParametersFinite);
    if (!status.modeLaunch) {
      status.failures.push("slab waveguide did not expose modal launch metrics");
    } else {
      if (!(status.modeLaunch.rightGuideEnergy > 1e-12)) status.failures.push("slab waveguide did not launch measurable forward guided energy");
      if (Number.isFinite(coreFractionLimit) && status.modeLaunch.coreEnergyFraction < coreFractionLimit) {
        status.failures.push(`slab guide core energy fraction ${status.modeLaunch.coreEnergyFraction} is below ${coreFractionLimit}`);
      }
      if (!status.modeLaunch.rightBoundaryMaterialContinuous) {
        status.failures.push("slab waveguide has a material discontinuity at the right CPML entrance");
      }
      if (Number.isFinite(backwardLimit) && status.modeLaunch.backwardEnergyRatio > backwardLimit) {
        status.failures.push(`backward modal energy ratio ${status.modeLaunch.backwardEnergyRatio} exceeds ${backwardLimit}`);
      }
      if (Number.isFinite(radiationLimit) && status.modeLaunch.radiationEnergyRatio > radiationLimit) {
        status.failures.push(`cladding radiation energy ratio ${status.modeLaunch.radiationEnergyRatio} exceeds ${radiationLimit}`);
      }
    }
    if (!status.modePort?.available) {
      status.failures.push("slab waveguide did not expose finite-difference mode-port metrics");
    } else {
      if (Number.isFinite(minModeNeff) && !(Number.isFinite(status.modePort.neff) && status.modePort.neff >= minModeNeff)) {
        status.failures.push(`mode effective index ${status.modePort.neff} below ${minModeNeff}`);
      }
      if (
        Number.isFinite(minModeInputOverlap) &&
        !(Number.isFinite(status.modePort.inputOverlap) && status.modePort.inputOverlap >= minModeInputOverlap)
      ) {
        status.failures.push(`mode input overlap ${status.modePort.inputOverlap} below ${minModeInputOverlap}`);
      }
      if (
        Number.isFinite(minModeOutputOverlap) &&
        !(Number.isFinite(status.modePort.outputOverlap) && status.modePort.outputOverlap >= minModeOutputOverlap)
      ) {
        status.failures.push(`mode output overlap ${status.modePort.outputOverlap} below ${minModeOutputOverlap}`);
      }
      if (
        requiresModalS &&
        !(
          Number.isFinite(status.modePort.modalS11Power) &&
          Number.isFinite(status.modePort.modalS21Power) &&
          Number.isFinite(status.modePort.modalSPowerResidual)
        )
      ) {
        status.failures.push("modal S-parameter estimate is not finite");
      }
    }
  }
  if (testCase.id === "resonator_ringdown_q") {
    status.analysis = await diagnosticMetrics(page);
    const minSamples = Number(testCase.acceptance?.minAnalysisSamples);
    const minRingdownQ = Number(testCase.acceptance?.ringdownQMin);
    const maxRingdownQ = Number(testCase.acceptance?.ringdownQMax);
    const maxLateEnergyRatio = Number(testCase.acceptance?.lateEnergyRatioMax);
    if (Number.isFinite(minSamples) && status.analysis.analysisSamples < minSamples) {
      status.failures.push(`ringdown analysis has ${status.analysis.analysisSamples} samples, expected at least ${minSamples}`);
    }
    if ((testCase.acceptance?.qEstimateFinite || testCase.acceptance?.qProxyFinite) && !(Number.isFinite(status.analysis.ringdownQ) && status.analysis.ringdownQ > 0)) {
      status.failures.push(`ringdown Q estimate is not finite and positive: ${status.analysis.ringdownQ}`);
    }
    if (Number.isFinite(minRingdownQ) && !(Number.isFinite(status.analysis.ringdownQ) && status.analysis.ringdownQ >= minRingdownQ)) {
      status.failures.push(`ringdown Q estimate ${status.analysis.ringdownQ} below ${minRingdownQ}`);
    }
    if (Number.isFinite(maxRingdownQ) && !(Number.isFinite(status.analysis.ringdownQ) && status.analysis.ringdownQ <= maxRingdownQ)) {
      status.failures.push(`ringdown Q estimate ${status.analysis.ringdownQ} exceeds ${maxRingdownQ}`);
    }
    if (Number.isFinite(maxLateEnergyRatio) && stepResult.lateEnergyRatio > maxLateEnergyRatio) {
      status.failures.push(`ringdown late-energy ratio ${stepResult.lateEnergyRatio} exceeds ${maxLateEnergyRatio}`);
    }
  }
  if (
    testCase.id === "single_slit_diffraction_symmetry" ||
    testCase.id === "double_slit_interference_profile" ||
    testCase.id === "circular_aperture_diffraction_profile"
  ) {
    status.diffraction = await apertureDiffractionMetrics(page, testCase.preset === "doubleSlit" ? "double" : testCase.preset === "circularAperture" ? "circular" : "single");
    const minEnergy = Number(testCase.acceptance?.minTransmittedEnergy);
    const maxSymmetryError = Number(testCase.acceptance?.symmetryErrorMax);
    const minCenterPeakRatio = Number(testCase.acceptance?.centerPeakRatioMin);
    const minPeakCount = Number(testCase.acceptance?.peakCountMin);
    if (Number.isFinite(minEnergy) && !(status.diffraction.totalEnergy > minEnergy)) {
      status.failures.push(`diffraction profile energy ${status.diffraction.totalEnergy} is not above ${minEnergy}`);
    }
    if (Number.isFinite(maxSymmetryError) && status.diffraction.symmetryError > maxSymmetryError) {
      status.failures.push(`diffraction symmetry error ${status.diffraction.symmetryError} exceeds ${maxSymmetryError}`);
    }
    if (Number.isFinite(minCenterPeakRatio) && status.diffraction.centerPeakRatio < minCenterPeakRatio) {
      status.failures.push(`central diffraction peak ratio ${status.diffraction.centerPeakRatio} is below ${minCenterPeakRatio}`);
    }
    if (Number.isFinite(minPeakCount) && status.diffraction.peakCount < minPeakCount) {
      status.failures.push(`diffraction profile has ${status.diffraction.peakCount} peaks, expected at least ${minPeakCount}`);
    }
    if (!(status.diffraction.apertureEnergy > 0)) {
      status.failures.push("aperture region does not transmit measurable field energy");
    }
  }
  if (testCase.acceptance?.maxwellBlockCheck) {
    status.maxwell = await maxwellBlockMetrics(page);
    const minTotalEnergy = Number(testCase.acceptance?.totalEnergyMin);
    const maxMaterialCells = Number(testCase.acceptance?.materialCellsMax);
    const maxPecCells = Number(testCase.acceptance?.pecCellsMax);
    const minRightLeft = Number(testCase.acceptance?.rightToLeftEnergyRatioMin);
    const minLowerUpper = Number(testCase.acceptance?.lowerToUpperEnergyRatioMin);
    const maxLowerUpper = Number(testCase.acceptance?.lowerToUpperEnergyRatioMax);
    const maxPoyntingAngleError = Number(testCase.acceptance?.poyntingAngleErrorDegMax);
    const minPoyntingDirectionality = Number(testCase.acceptance?.poyntingDirectionalityMin);
    const minEvanescentNearFar = Number(testCase.acceptance?.evanescentNearToFarRatioMin);
    const minEvanescentMidFar = Number(testCase.acceptance?.evanescentMidToFarRatioMin);
    const minInterferencePeaks = Number(testCase.acceptance?.interferencePeakCountMin);
    const minInterferenceVisibility = Number(testCase.acceptance?.interferenceVisibilityMin);
    const maxInterferenceSymmetry = Number(testCase.acceptance?.interferenceSymmetryErrorMax);
    if (Number.isFinite(minTotalEnergy) && !(status.maxwell.totalEnergy > minTotalEnergy)) {
      status.failures.push(`Maxwell total energy ${status.maxwell.totalEnergy} is not above ${minTotalEnergy}`);
    }
    if (Number.isFinite(maxMaterialCells) && status.maxwell.materialCells > maxMaterialCells) {
      status.failures.push(`Maxwell material cells ${status.maxwell.materialCells} exceed ${maxMaterialCells}`);
    }
    if (Number.isFinite(maxPecCells) && status.maxwell.pecCells > maxPecCells) {
      status.failures.push(`Maxwell PEC cells ${status.maxwell.pecCells} exceed ${maxPecCells}`);
    }
    if (Number.isFinite(minRightLeft) && status.maxwell.rightToLeftEnergyRatio < minRightLeft) {
      status.failures.push(`Maxwell right/left energy ratio ${status.maxwell.rightToLeftEnergyRatio} below ${minRightLeft}`);
    }
    if (Number.isFinite(minLowerUpper) && status.maxwell.lowerToUpperEnergyRatio < minLowerUpper) {
      status.failures.push(`Maxwell lower/upper energy ratio ${status.maxwell.lowerToUpperEnergyRatio} below ${minLowerUpper}`);
    }
    if (Number.isFinite(maxLowerUpper) && status.maxwell.lowerToUpperEnergyRatio > maxLowerUpper) {
      status.failures.push(`Maxwell lower/upper energy ratio ${status.maxwell.lowerToUpperEnergyRatio} exceeds ${maxLowerUpper}`);
    }
    if (
      Number.isFinite(maxPoyntingAngleError) &&
      !(Number.isFinite(status.maxwell.poyntingAngleErrorDeg) && status.maxwell.poyntingAngleErrorDeg <= maxPoyntingAngleError)
    ) {
      status.failures.push(`Poynting angle error ${status.maxwell.poyntingAngleErrorDeg} exceeds ${maxPoyntingAngleError} deg`);
    }
    if (
      Number.isFinite(minPoyntingDirectionality) &&
      !(Number.isFinite(status.maxwell.poyntingDirectionality) && status.maxwell.poyntingDirectionality >= minPoyntingDirectionality)
    ) {
      status.failures.push(`Poynting directionality ${status.maxwell.poyntingDirectionality} below ${minPoyntingDirectionality}`);
    }
    if (Number.isFinite(minEvanescentNearFar) && status.maxwell.evanescentNearToFarRatio < minEvanescentNearFar) {
      status.failures.push(`evanescent near/far energy ratio ${status.maxwell.evanescentNearToFarRatio} below ${minEvanescentNearFar}`);
    }
    if (Number.isFinite(minEvanescentMidFar) && status.maxwell.evanescentMidToFarRatio < minEvanescentMidFar) {
      status.failures.push(`evanescent mid/far energy ratio ${status.maxwell.evanescentMidToFarRatio} below ${minEvanescentMidFar}`);
    }
    if (Number.isFinite(minInterferencePeaks) && status.maxwell.interference.peakCount < minInterferencePeaks) {
      status.failures.push(`interference profile peak count ${status.maxwell.interference.peakCount} below ${minInterferencePeaks}`);
    }
    if (Number.isFinite(minInterferenceVisibility) && status.maxwell.interference.visibility < minInterferenceVisibility) {
      status.failures.push(`interference visibility ${status.maxwell.interference.visibility} below ${minInterferenceVisibility}`);
    }
    if (Number.isFinite(maxInterferenceSymmetry) && status.maxwell.interference.symmetryError > maxInterferenceSymmetry) {
      status.failures.push(`interference symmetry error ${status.maxwell.interference.symmetryError} exceeds ${maxInterferenceSymmetry}`);
    }
  }
  if (testCase.acceptance?.interfaceOpticsCheck) {
    status.interfaceOptics = await interfaceOpticsMetrics(page);
    const minMaterialEnergy = Number(testCase.acceptance?.materialEnergyFractionMin);
    const minTransmittedEnergy = Number(testCase.acceptance?.transmittedFlowEnergyMin);
    const minTransmittedDirectionality = Number(testCase.acceptance?.transmittedDirectionalityMin);
    const maxSnellAngleError = Number(testCase.acceptance?.snellAngleErrorDegMax);
    if (Number.isFinite(minMaterialEnergy) && status.interfaceOptics.materialEnergyFraction < minMaterialEnergy) {
      status.failures.push(`interface material energy fraction ${status.interfaceOptics.materialEnergyFraction} below ${minMaterialEnergy}`);
    }
    if (Number.isFinite(minTransmittedEnergy) && status.interfaceOptics.transmitted.energy < minTransmittedEnergy) {
      status.failures.push(`transmitted-flow energy ${status.interfaceOptics.transmitted.energy} below ${minTransmittedEnergy}`);
    }
    if (
      Number.isFinite(minTransmittedDirectionality) &&
      !(Number.isFinite(status.interfaceOptics.transmitted.directionality) && status.interfaceOptics.transmitted.directionality >= minTransmittedDirectionality)
    ) {
      status.failures.push(`transmitted-flow directionality ${status.interfaceOptics.transmitted.directionality} below ${minTransmittedDirectionality}`);
    }
    if (
      Number.isFinite(maxSnellAngleError) &&
      !(
        Number.isFinite(status.interfaceOptics.transmittedCentroidAngleErrorDeg ?? status.interfaceOptics.transmittedAngleErrorDeg) &&
        (status.interfaceOptics.transmittedCentroidAngleErrorDeg ?? status.interfaceOptics.transmittedAngleErrorDeg) <= maxSnellAngleError
      )
    ) {
      status.failures.push(
        `Snell transmitted-angle error ${status.interfaceOptics.transmittedCentroidAngleErrorDeg ?? status.interfaceOptics.transmittedAngleErrorDeg} exceeds ${maxSnellAngleError} deg`,
      );
    }
  }
  if (testCase.acceptance?.temporalProbeCheck) {
    status.temporalProbe = stepResult.temporalProbe;
    const minSamples = Number(testCase.acceptance?.temporalProbeSamplesMin);
    const minPeakAbs = Number(testCase.acceptance?.temporalProbePeakAbsMin);
    const minEnvelopeDynamicRange = Number(testCase.acceptance?.temporalEnvelopeDynamicRangeMin);
    if (!status.temporalProbe) {
      status.failures.push("temporal probe was not collected");
    } else {
      if (Number.isFinite(minSamples) && status.temporalProbe.samples < minSamples) {
        status.failures.push(`temporal probe samples ${status.temporalProbe.samples} below ${minSamples}`);
      }
      if (Number.isFinite(minPeakAbs) && status.temporalProbe.peakAbs < minPeakAbs) {
        status.failures.push(`temporal probe peak ${status.temporalProbe.peakAbs} below ${minPeakAbs}`);
      }
      if (Number.isFinite(minEnvelopeDynamicRange) && status.temporalProbe.envelopeDynamicRange < minEnvelopeDynamicRange) {
        status.failures.push(`temporal envelope dynamic range ${status.temporalProbe.envelopeDynamicRange} below ${minEnvelopeDynamicRange}`);
      }
    }
  }
  if (testCase.acceptance?.materialTemporalCheck) {
    status.materialTemporal = stepResult.materialTemporal;
    const minSamples = Number(testCase.acceptance?.materialTemporalSamplesMin);
    const minMaterialPeak = Number(testCase.acceptance?.materialTemporalPeakEnergyMin);
    const minDispersivePeak = Number(testCase.acceptance?.dispersiveTemporalPeakEnergyMin);
    const minConductivePeak = Number(testCase.acceptance?.conductiveTemporalPeakEnergyMin);
    const minMaterialFraction = Number(testCase.acceptance?.materialTemporalPeakFractionMin);
    const minDispersiveFraction = Number(testCase.acceptance?.dispersiveTemporalPeakFractionMin);
    const minConductiveFraction = Number(testCase.acceptance?.conductiveTemporalPeakFractionMin);
    if (!status.materialTemporal) {
      status.failures.push("material temporal monitor was not collected");
    } else {
      if (Number.isFinite(minSamples) && status.materialTemporal.samples < minSamples) {
        status.failures.push(`material temporal samples ${status.materialTemporal.samples} below ${minSamples}`);
      }
      if (Number.isFinite(minMaterialPeak) && status.materialTemporal.materialEnergyPeak < minMaterialPeak) {
        status.failures.push(`material temporal peak energy ${status.materialTemporal.materialEnergyPeak} below ${minMaterialPeak}`);
      }
      if (Number.isFinite(minDispersivePeak) && status.materialTemporal.dispersiveEnergyPeak < minDispersivePeak) {
        status.failures.push(`dispersive temporal peak energy ${status.materialTemporal.dispersiveEnergyPeak} below ${minDispersivePeak}`);
      }
      if (Number.isFinite(minConductivePeak) && status.materialTemporal.conductiveEnergyPeak < minConductivePeak) {
        status.failures.push(`conductive temporal peak energy ${status.materialTemporal.conductiveEnergyPeak} below ${minConductivePeak}`);
      }
      if (Number.isFinite(minMaterialFraction) && status.materialTemporal.materialPeakFraction < minMaterialFraction) {
        status.failures.push(`material temporal peak fraction ${status.materialTemporal.materialPeakFraction} below ${minMaterialFraction}`);
      }
      if (Number.isFinite(minDispersiveFraction) && status.materialTemporal.dispersivePeakFraction < minDispersiveFraction) {
        status.failures.push(`dispersive temporal peak fraction ${status.materialTemporal.dispersivePeakFraction} below ${minDispersiveFraction}`);
      }
      if (Number.isFinite(minConductiveFraction) && status.materialTemporal.conductivePeakFraction < minConductiveFraction) {
        status.failures.push(`conductive temporal peak fraction ${status.materialTemporal.conductivePeakFraction} below ${minConductiveFraction}`);
      }
    }
  }
  if (testCase.id === "drude_ade_response") {
    status.ade = await dispersiveAdeMetrics(page);
    const minCells = Number(testCase.acceptance?.dispersiveCellsMin);
    const minCurrent = Number(testCase.acceptance?.adeCurrentMin);
    const maxEffectiveEps = Number(testCase.acceptance?.effectiveEpsMax);
    if (!status.ade.enabled) status.failures.push("Drude ADE material flag is disabled");
    if (status.ade.model !== "drude") status.failures.push(`expected drude dispersion model, got ${status.ade.model}`);
    if (!String(status.ade.engine).includes("ADE")) status.failures.push(`engine route does not include ADE: ${status.ade.engine}`);
    if (Number.isFinite(minCells) && status.ade.dispersiveCells < minCells) {
      status.failures.push(`Drude scene has ${status.ade.dispersiveCells} dispersive cells, expected at least ${minCells}`);
    }
    if (Number.isFinite(maxEffectiveEps) && !(Number.isFinite(status.ade.effectiveEps) && status.ade.effectiveEps < maxEffectiveEps)) {
      status.failures.push(`Drude effective epsilon ${status.ade.effectiveEps} is not below ${maxEffectiveEps}`);
    }
    if (
      !String(status.ade.engine).includes("WASM") &&
      Number.isFinite(minCurrent) &&
      status.ade.maxElectricCurrent < minCurrent &&
      status.ade.maxElectricPolarization < minCurrent
    ) {
      status.failures.push(`ADE response is too small: Jmax=${status.ade.maxElectricCurrent}, Pmax=${status.ade.maxElectricPolarization}`);
    }
  }
  if (testCase.acceptance?.materialModelCheck) {
    status.materialModel = await materialModelMetrics(page);
    const minMaterialCells = Number(testCase.acceptance?.materialCellsMin);
    const minMaterialEnergy = Number(testCase.acceptance?.materialEnergyMin);
    const minMaterialFraction = Number(testCase.acceptance?.materialEnergyFractionMin);
    const lateEnergyRatioMax = Number(testCase.acceptance?.lateEnergyRatioMax);
    const minConductiveCells = Number(testCase.acceptance?.conductiveCellsMin);
    const minSigma = Number(testCase.acceptance?.conductivitySigmaMin);
    const minConductorEntranceEnergy = Number(testCase.acceptance?.conductorEntranceEnergyMin);
    const maxConductorDeepRatio = Number(testCase.acceptance?.conductorDeepToEntranceRatioMax);
    const minDispersiveCells = Number(testCase.acceptance?.dispersiveCellsMin);
    const minDispersiveEnergy = Number(testCase.acceptance?.dispersiveEnergyMin);
    const effectiveEpsMeanMin = Number(testCase.acceptance?.effectiveEpsMeanMin);
    const effectiveEpsMeanMax = Number(testCase.acceptance?.effectiveEpsMeanMax);
    const effectiveEpsAbsMeanMax = Number(testCase.acceptance?.effectiveEpsAbsMeanMax);
    const minTensorCheckedCells = Number(testCase.acceptance?.tensorCheckedCellsMin);
    const minTensorCells = Number(testCase.acceptance?.tensorCellsMin);
    const minAnisotropicCells = Number(testCase.acceptance?.anisotropicCellsMin);
    const minEpsDelta = Number(testCase.acceptance?.epsAnisotropyDeltaMin);
    const minIndefiniteCells = Number(testCase.acceptance?.indefiniteCellsMin);
    const minNegativeTensorCells = Number(testCase.acceptance?.negativeTensorCellsMin);
    const minGyrotropicCells = Number(testCase.acceptance?.gyrotropicCellsMin);
    const minGyrotropy = Number(testCase.acceptance?.gyrotropyAbsMin);
    const minBianisotropicCells = Number(testCase.acceptance?.bianisotropicCellsMin);
    const minMeanAbsKappa = Number(testCase.acceptance?.meanAbsKappaMin);
    const minPassivityMargin = Number(testCase.acceptance?.passivityMarginMin);
    const minCrossField = Number(testCase.acceptance?.maxCrossFieldMin);
    const minMaterialCrossFraction = Number(testCase.acceptance?.materialCrossFractionMin);
    const expectedFieldComponent = testCase.acceptance?.fieldComponent;
    const expectedDispersionModel = testCase.acceptance?.dispersionModel;
    const expectedDispersiveKind = testCase.acceptance?.dispersiveKind;
    const kindCounts = {
      drudeLike: status.materialModel.counts.drudeLikeCells,
      lorentz: status.materialModel.counts.lorentzCells,
      debye: status.materialModel.counts.debyeCells,
    };
    if (expectedFieldComponent && status.materialModel.fieldComponent !== expectedFieldComponent) {
      status.failures.push(`expected ${expectedFieldComponent} field component, got ${status.materialModel.fieldComponent}`);
    }
    if (expectedDispersionModel && status.materialModel.dispersionModel !== expectedDispersionModel) {
      status.failures.push(`expected ${expectedDispersionModel} dispersion model, got ${status.materialModel.dispersionModel}`);
    }
    if (expectedDispersiveKind && !(kindCounts[expectedDispersiveKind] > 0)) {
      status.failures.push(`expected ${expectedDispersiveKind} ADE cells, got ${JSON.stringify(kindCounts)}`);
    }
    if (Number.isFinite(minMaterialCells) && status.materialModel.counts.materialCells < minMaterialCells) {
      status.failures.push(`material cells ${status.materialModel.counts.materialCells} below ${minMaterialCells}`);
    }
    if (Number.isFinite(minMaterialEnergy) && status.materialModel.energy.materialEnergy < minMaterialEnergy) {
      status.failures.push(`material-region energy ${status.materialModel.energy.materialEnergy} below ${minMaterialEnergy}`);
    }
    if (Number.isFinite(minMaterialFraction) && status.materialModel.energy.materialEnergyFraction < minMaterialFraction) {
      status.failures.push(`material energy fraction ${status.materialModel.energy.materialEnergyFraction} below ${minMaterialFraction}`);
    }
    if (Number.isFinite(lateEnergyRatioMax) && stepResult.lateEnergyRatio > lateEnergyRatioMax) {
      status.failures.push(`late energy ratio ${stepResult.lateEnergyRatio} exceeds ${lateEnergyRatioMax}`);
    }
    if (Number.isFinite(minConductiveCells) && status.materialModel.counts.conductiveCells < minConductiveCells) {
      status.failures.push(`conductive cells ${status.materialModel.counts.conductiveCells} below ${minConductiveCells}`);
    }
    if (Number.isFinite(minSigma) && status.materialModel.conductivity.maxSigma < minSigma) {
      status.failures.push(`conductivity sigma ${status.materialModel.conductivity.maxSigma} below ${minSigma}`);
    }
    const skin = status.materialModel.conductivity.skinDepthProxy;
    if (Number.isFinite(minConductorEntranceEnergy) && !(skin?.entranceEnergy > minConductorEntranceEnergy)) {
      status.failures.push(`conductive entrance energy ${skin?.entranceEnergy} below ${minConductorEntranceEnergy}`);
    }
    if (Number.isFinite(maxConductorDeepRatio) && !(skin?.deepToEntranceRatio < maxConductorDeepRatio)) {
      status.failures.push(`conductive deep/entrance energy ratio ${skin?.deepToEntranceRatio} exceeds ${maxConductorDeepRatio}`);
    }
    if (Number.isFinite(minDispersiveCells) && status.materialModel.counts.dispersiveCells < minDispersiveCells) {
      status.failures.push(`dispersive cells ${status.materialModel.counts.dispersiveCells} below ${minDispersiveCells}`);
    }
    if (Number.isFinite(minDispersiveEnergy) && status.materialModel.energy.dispersiveEnergy < minDispersiveEnergy) {
      status.failures.push(`dispersive-region energy ${status.materialModel.energy.dispersiveEnergy} below ${minDispersiveEnergy}`);
    }
    const effectiveEpsMean = status.materialModel.epsStats.effectiveEpsMean;
    const effectiveEpsAbsMean = status.materialModel.epsStats.effectiveEpsAbsMean;
    if (Number.isFinite(effectiveEpsMeanMin) && !(Number.isFinite(effectiveEpsMean) && effectiveEpsMean > effectiveEpsMeanMin)) {
      status.failures.push(`effective epsilon mean ${effectiveEpsMean} is not above ${effectiveEpsMeanMin}`);
    }
    if (Number.isFinite(effectiveEpsMeanMax) && !(Number.isFinite(effectiveEpsMean) && effectiveEpsMean < effectiveEpsMeanMax)) {
      status.failures.push(`effective epsilon mean ${effectiveEpsMean} is not below ${effectiveEpsMeanMax}`);
    }
    if (
      Number.isFinite(effectiveEpsAbsMeanMax) &&
      !(Number.isFinite(effectiveEpsAbsMean) && effectiveEpsAbsMean < effectiveEpsAbsMeanMax)
    ) {
      status.failures.push(`effective epsilon abs-mean ${effectiveEpsAbsMean} exceeds ${effectiveEpsAbsMeanMax}`);
    }
    const tensor = status.materialModel.tensorDiagnostics || {};
    if (Number.isFinite(minTensorCheckedCells) && Number(tensor.checkedCells || 0) < minTensorCheckedCells) {
      status.failures.push(`tensor-checked cells ${tensor.checkedCells || 0} below ${minTensorCheckedCells}`);
    }
    if (Number.isFinite(minTensorCells) && Number(tensor.tensorCells || 0) < minTensorCells) {
      status.failures.push(`tensor cells ${tensor.tensorCells || 0} below ${minTensorCells}`);
    }
    if (Number.isFinite(minAnisotropicCells) && status.materialModel.counts.anisotropicCells < minAnisotropicCells) {
      status.failures.push(`anisotropic cells ${status.materialModel.counts.anisotropicCells} below ${minAnisotropicCells}`);
    }
    if (Number.isFinite(minEpsDelta) && status.materialModel.epsStats.epsDeltaMax < minEpsDelta) {
      status.failures.push(`epsilon anisotropy delta ${status.materialModel.epsStats.epsDeltaMax} below ${minEpsDelta}`);
    }
    if (Number.isFinite(minIndefiniteCells) && Number(tensor.indefiniteCells || 0) < minIndefiniteCells) {
      status.failures.push(`indefinite tensor cells ${tensor.indefiniteCells || 0} below ${minIndefiniteCells}`);
    }
    if (Number.isFinite(minNegativeTensorCells) && Number(tensor.negativeCells || 0) < minNegativeTensorCells) {
      status.failures.push(`negative-eigenvalue tensor cells ${tensor.negativeCells || 0} below ${minNegativeTensorCells}`);
    }
    if (Number.isFinite(minGyrotropicCells) && status.materialModel.counts.gyrotropicCells < minGyrotropicCells) {
      status.failures.push(`gyrotropic cells ${status.materialModel.counts.gyrotropicCells} below ${minGyrotropicCells}`);
    }
    if (Number.isFinite(minGyrotropy) && status.materialModel.gyrotropy.maxAbsG < minGyrotropy) {
      status.failures.push(`gyrotropy |g| ${status.materialModel.gyrotropy.maxAbsG} below ${minGyrotropy}`);
    }
    if (Number.isFinite(minBianisotropicCells) && status.materialModel.counts.bianisotropicCells < minBianisotropicCells) {
      status.failures.push(`bianisotropic cells ${status.materialModel.counts.bianisotropicCells} below ${minBianisotropicCells}`);
    }
    if (Number.isFinite(minMeanAbsKappa) && status.materialModel.bianisotropy.meanAbsKappa < minMeanAbsKappa) {
      status.failures.push(`mean |kappa| ${status.materialModel.bianisotropy.meanAbsKappa} below ${minMeanAbsKappa}`);
    }
    const bianisotropic = status.materialModel.bianisotropy.quantitative;
    const fullVector = status.materialModel.bianisotropy.fullVector;
    if (testCase.acceptance?.passiveDefinite && !fullVector?.passiveDefinite) {
      status.failures.push("full-vector bianisotropy energy form is not passive definite");
    }
    if (Number.isFinite(minPassivityMargin) && !(Number(fullVector?.minPassivityMargin) > minPassivityMargin)) {
      status.failures.push(`bianisotropy passivity margin ${fullVector?.minPassivityMargin} below ${minPassivityMargin}`);
    }
    if (Number.isFinite(minCrossField) && !(Number(fullVector?.maxCrossField) > minCrossField)) {
      status.failures.push(`cross-field amplitude ${fullVector?.maxCrossField} below ${minCrossField}`);
    }
    if (Number.isFinite(minMaterialCrossFraction) && !(Number(bianisotropic?.materialCrossFraction) > minMaterialCrossFraction)) {
      status.failures.push(`material cross-energy fraction ${bianisotropic?.materialCrossFraction} below ${minMaterialCrossFraction}`);
    }
  }
  if (testCase.id === "spp_interface_surface_localization" || testCase.id === "spp_grating_surface_launcher") {
    status.spp = await plasmonicSurfaceMetrics(page);
    const minSurfaceFraction = Number(testCase.acceptance?.surfaceFractionMin);
    const minSurfaceToBulk = Number(testCase.acceptance?.surfaceToBulkRatioMin);
    const minSurfaceToAir = Number(testCase.acceptance?.surfaceToAirRatioMin);
    const minGratingCells = Number(testCase.acceptance?.gratingCellsAboveInterfaceMin);
    if (status.spp.fieldComponent !== "hz") status.failures.push(`SPP scene should use Hz polarization, got ${status.spp.fieldComponent}`);
    if (!status.spp.dispersionEnabled) status.failures.push("SPP scene does not enable Drude dispersion");
    if (Number.isFinite(minSurfaceFraction) && status.spp.surfaceFraction < minSurfaceFraction) {
      status.failures.push(`SPP surface energy fraction ${status.spp.surfaceFraction} is below ${minSurfaceFraction}`);
    }
    if (Number.isFinite(minSurfaceToBulk) && status.spp.surfaceToBulkRatio < minSurfaceToBulk) {
      status.failures.push(`SPP surface/bulk ratio ${status.spp.surfaceToBulkRatio} is below ${minSurfaceToBulk}`);
    }
    if (Number.isFinite(minSurfaceToAir) && status.spp.surfaceToAirRatio < minSurfaceToAir) {
      status.failures.push(`SPP surface/far-air ratio ${status.spp.surfaceToAirRatio} is below ${minSurfaceToAir}`);
    }
    if (Number.isFinite(minGratingCells) && status.spp.gratingCellsAboveInterface < minGratingCells) {
      status.failures.push(`SPP grating has ${status.spp.gratingCellsAboveInterface} metal cells above the interface, expected at least ${minGratingCells}`);
    }
  }
  if (testCase.id === "double_negative_drude_slab_phase" || testCase.id === "dng_slab_point_source_transfer") {
    status.negativeIndex = await negativeIndexMetrics(page);
    const metrics = status.negativeIndex.metrics;
    const minSamples = Number(testCase.acceptance?.minAnalysisSamples);
    const minCells = Number(testCase.acceptance?.doubleNegativeCellsMin);
    const minCoherence = Number(testCase.acceptance?.slabPhaseCoherenceMin);
    const minSlabBeamEnergy = Number(testCase.acceptance?.slabBeamEnergyMin);
    const minSlabPhaseEnergy = Number(testCase.acceptance?.slabPhaseEnergyMin);
    const minTransmittedBeamEnergy = Number(testCase.acceptance?.transmittedBeamEnergyMin);
    const minSourceAngleAbs = Number(testCase.acceptance?.sourceAngleAbsDegMin);
    const minNegativeScore = Number(testCase.acceptance?.negativeRefractionScoreMin);
    const minTransfer = Number(testCase.acceptance?.imageTransferMin);
    const maxResolutionRatio = Number(testCase.acceptance?.imageResolutionRatioMax);
    if (Number.isFinite(minSamples) && status.negativeIndex.analysisSamples < minSamples) {
      status.failures.push(`negative-index analysis has ${status.negativeIndex.analysisSamples} samples, expected at least ${minSamples}`);
    }
    if (!metrics) {
      status.failures.push("negative-index analysis metrics are missing");
    } else {
      if (Number.isFinite(minCells) && metrics.material.doubleNegativeCells < minCells) {
        status.failures.push(`double-negative material cells ${metrics.material.doubleNegativeCells} below ${minCells}`);
      }
      if (!(metrics.material.nEff < 0)) {
        status.failures.push(`effective refractive index is not negative: ${metrics.material.nEff}`);
      }
      if (Number.isFinite(minCoherence) && metrics.slabPhaseCoherence < minCoherence) {
        status.failures.push(`slab phase-front coherence ${metrics.slabPhaseCoherence} below ${minCoherence}`);
      }
      if (Number.isFinite(minSlabBeamEnergy) && !(Number(metrics.slab?.energy) >= minSlabBeamEnergy)) {
        status.failures.push(`slab beam energy ${metrics.slab?.energy} below ${minSlabBeamEnergy}`);
      }
      if (Number.isFinite(minSlabPhaseEnergy) && !(Number(metrics.slabPhase?.energy) >= minSlabPhaseEnergy)) {
        status.failures.push(`slab phase energy ${metrics.slabPhase?.energy} below ${minSlabPhaseEnergy}`);
      }
      if (Number.isFinite(minTransmittedBeamEnergy) && !(Number(metrics.transmitted?.energy) >= minTransmittedBeamEnergy)) {
        status.failures.push(`transmitted beam energy ${metrics.transmitted?.energy} below ${minTransmittedBeamEnergy}`);
      }
      if (Number.isFinite(minSourceAngleAbs) && Math.abs(metrics.sourceAngleDeg) < minSourceAngleAbs) {
        status.failures.push(`negative-index source angle ${metrics.sourceAngleDeg} below ${minSourceAngleAbs} deg`);
      }
      if (testCase.acceptance?.negativeRefractionObserved && !metrics.negativeRefractionObserved) {
        status.failures.push("negative refraction was not observed by the centroid-slope diagnostic");
      }
      if (Number.isFinite(minNegativeScore) && metrics.negativeRefractionScore < minNegativeScore) {
        status.failures.push(`negative-refraction score ${metrics.negativeRefractionScore} below ${minNegativeScore}`);
      }
      if (Number.isFinite(minTransfer) && metrics.imageTransfer < minTransfer) {
        status.failures.push(`superlens image transfer ${metrics.imageTransfer} below ${minTransfer}`);
      }
      if (Number.isFinite(maxResolutionRatio) && !(metrics.resolutionRatio > 0 && metrics.resolutionRatio <= maxResolutionRatio)) {
        status.failures.push(`image resolution ratio ${metrics.resolutionRatio} exceeds ${maxResolutionRatio}`);
      }
    }
  }
  if (testCase.acceptance?.metamaterialCheck) {
    status.metamaterial = await metamaterialMetrics(page);
    const metrics = status.metamaterial;
    const expectedFieldComponent = testCase.acceptance?.fieldComponent;
    const expectedFieldDisplay = testCase.acceptance?.fieldDisplay;
    const expectedSourceShape = testCase.acceptance?.sourceShape;
    const expectedDispersionModel = testCase.acceptance?.dispersionModel;
    const minMaterialCells = Number(testCase.acceptance?.materialCellsMin);
    const minHighIndexCells = Number(testCase.acceptance?.highIndexCellsMin);
    const minDispersiveCells = Number(testCase.acceptance?.dispersiveCellsMin);
    const minDrudeCells = Number(testCase.acceptance?.drudeCellsMin);
    const minLossyCells = Number(testCase.acceptance?.lossyCellsMin);
    const minPecCells = Number(testCase.acceptance?.pecCellsMin);
    const minTensorCells = Number(testCase.acceptance?.tensorLikeCellsMin);
    const minMaterialFraction = Number(testCase.acceptance?.materialEnergyFractionMin);
    const minDispersiveFraction = Number(testCase.acceptance?.dispersiveEnergyFractionMin);
    const minLocalizedDiskCells = Number(testCase.acceptance?.localizedDiskCellsMin);
    const minLocalizedDiskEnergy = Number(testCase.acceptance?.localizedDiskEnergyMin);
    const minLocalizedNearEnergy = Number(testCase.acceptance?.localizedNearEnergyMin);
    const minLocalizedNearToDisk = Number(testCase.acceptance?.localizedNearToDiskRatioMin);
    const minDimerDiskCells = Number(testCase.acceptance?.dimerDiskCellsMin);
    const minDimerGapEnergy = Number(testCase.acceptance?.dimerGapEnergyMin);
    const minDimerGapRatio = Number(testCase.acceptance?.dimerGapToDiskRatioMin);
    const minDimerGapCells = Number(testCase.acceptance?.dimerGapCellsMin);
    const minDimerGapPeakToBackground = Number(testCase.acceptance?.dimerGapPeakToBackgroundRatioMin);
    const minDimerGapMeanToBackground = Number(testCase.acceptance?.dimerGapMeanToBackgroundRatioMin);
    const minBars = Number(testCase.acceptance?.metasurfaceBarCountMin);
    const minHeightSpan = Number(testCase.acceptance?.metasurfaceHeightSpanLambdaMin);
    const minAbsorberGradient = Number(testCase.acceptance?.absorberLossGradientMin);
    const minBackplaneCells = Number(testCase.acceptance?.absorberPecBackplaneCellsMin);
    const minDiagnosticSamples = Number(testCase.acceptance?.minDiagnosticSamples);
    const minAbsorption = Number(testCase.acceptance?.absorptionProxyMin);
    const maxReflectance = Number(testCase.acceptance?.reflectanceMax);
    const maxTransmittance = Number(testCase.acceptance?.transmittanceMax);
    const minAnalysisSamples = Number(testCase.acceptance?.minAnalysisSamples);
    const minHyperlensTransfer = Number(testCase.acceptance?.hyperlensTransferMin);
    const minHyperlensMtfValid = Number(testCase.acceptance?.hyperlensMtfValidCountMin);
    const minHyperlensBandwidth = Number(testCase.acceptance?.hyperlensBandwidthOrderMin);
    const minEnzCells = Number(testCase.acceptance?.enzCellsMin);
    const maxEffectiveAbsEps = Number(testCase.acceptance?.effectiveEpsAbsMeanMax);
    const minEnzEnergyFraction = Number(testCase.acceptance?.enzEnergyFractionMin);
    if (expectedFieldComponent && metrics.fieldComponent !== expectedFieldComponent) {
      status.failures.push(`expected ${expectedFieldComponent} field component, got ${metrics.fieldComponent}`);
    }
    if (expectedFieldDisplay && metrics.fieldDisplay !== expectedFieldDisplay) {
      status.failures.push(`expected ${expectedFieldDisplay} field display, got ${metrics.fieldDisplay}`);
    }
    if (expectedSourceShape && metrics.sourceShape !== expectedSourceShape) {
      status.failures.push(`expected ${expectedSourceShape} source, got ${metrics.sourceShape}`);
    }
    if (testCase.acceptance?.dispersionEnabled && !metrics.dispersionEnabled) {
      status.failures.push("dispersion is not enabled for metamaterial/plasmonic scene");
    }
    if (expectedDispersionModel && metrics.dispersionModel !== expectedDispersionModel) {
      status.failures.push(`expected ${expectedDispersionModel} dispersion model, got ${metrics.dispersionModel}`);
    }
    if (Number.isFinite(minMaterialCells) && metrics.materialCells < minMaterialCells) {
      status.failures.push(`metamaterial cells ${metrics.materialCells} below ${minMaterialCells}`);
    }
    if (Number.isFinite(minHighIndexCells) && metrics.highIndexCells < minHighIndexCells) {
      status.failures.push(`high-index cells ${metrics.highIndexCells} below ${minHighIndexCells}`);
    }
    if (Number.isFinite(minDispersiveCells) && metrics.dispersiveCells < minDispersiveCells) {
      status.failures.push(`dispersive cells ${metrics.dispersiveCells} below ${minDispersiveCells}`);
    }
    if (Number.isFinite(minDrudeCells) && metrics.drudeCells < minDrudeCells) {
      status.failures.push(`Drude cells ${metrics.drudeCells} below ${minDrudeCells}`);
    }
    if (Number.isFinite(minLossyCells) && metrics.lossyCells < minLossyCells) {
      status.failures.push(`lossy cells ${metrics.lossyCells} below ${minLossyCells}`);
    }
    if (Number.isFinite(minPecCells) && metrics.pecCells < minPecCells) {
      status.failures.push(`PEC cells ${metrics.pecCells} below ${minPecCells}`);
    }
    if (Number.isFinite(minTensorCells) && metrics.tensorLikeCells < minTensorCells) {
      status.failures.push(`tensor-like cells ${metrics.tensorLikeCells} below ${minTensorCells}`);
    }
    if (Number.isFinite(minMaterialFraction) && metrics.materialEnergyFraction < minMaterialFraction) {
      status.failures.push(`material energy fraction ${metrics.materialEnergyFraction} below ${minMaterialFraction}`);
    }
    if (Number.isFinite(minDispersiveFraction) && metrics.dispersiveEnergyFraction < minDispersiveFraction) {
      status.failures.push(`dispersive energy fraction ${metrics.dispersiveEnergyFraction} below ${minDispersiveFraction}`);
    }
    if (Number.isFinite(minLocalizedDiskCells) && metrics.localizedDiskCells < minLocalizedDiskCells) {
      status.failures.push(`localized-plasmon disk cells ${metrics.localizedDiskCells} below ${minLocalizedDiskCells}`);
    }
    if (Number.isFinite(minLocalizedDiskEnergy) && metrics.localizedDiskEnergy < minLocalizedDiskEnergy) {
      status.failures.push(`localized-plasmon disk energy ${metrics.localizedDiskEnergy} below ${minLocalizedDiskEnergy}`);
    }
    if (Number.isFinite(minLocalizedNearEnergy) && metrics.localizedNearEnergy < minLocalizedNearEnergy) {
      status.failures.push(`localized-plasmon near-field energy ${metrics.localizedNearEnergy} below ${minLocalizedNearEnergy}`);
    }
    if (Number.isFinite(minLocalizedNearToDisk) && metrics.localizedNearToDiskRatio < minLocalizedNearToDisk) {
      status.failures.push(`localized-plasmon near/disk energy ratio ${metrics.localizedNearToDiskRatio} below ${minLocalizedNearToDisk}`);
    }
    if (
      Number.isFinite(minDimerDiskCells) &&
      (metrics.dimerDisk1Cells < minDimerDiskCells || metrics.dimerDisk2Cells < minDimerDiskCells)
    ) {
      status.failures.push(`dimer disk cells ${metrics.dimerDisk1Cells}/${metrics.dimerDisk2Cells} below ${minDimerDiskCells}`);
    }
    if (Number.isFinite(minDimerGapEnergy) && metrics.dimerGapEnergy < minDimerGapEnergy) {
      status.failures.push(`dimer gap energy ${metrics.dimerGapEnergy} below ${minDimerGapEnergy}`);
    }
    if (Number.isFinite(minDimerGapRatio) && metrics.dimerGapToDiskRatio < minDimerGapRatio) {
      status.failures.push(`dimer gap/disk energy ratio ${metrics.dimerGapToDiskRatio} below ${minDimerGapRatio}`);
    }
    if (Number.isFinite(minDimerGapCells) && metrics.dimerGapCells < minDimerGapCells) {
      status.failures.push(`dimer gap air cells ${metrics.dimerGapCells} below ${minDimerGapCells}`);
    }
    if (Number.isFinite(minDimerGapPeakToBackground) && metrics.dimerGapPeakToBackgroundRatio < minDimerGapPeakToBackground) {
      status.failures.push(`dimer gap peak/background E2 ratio ${metrics.dimerGapPeakToBackgroundRatio} below ${minDimerGapPeakToBackground}`);
    }
    if (Number.isFinite(minDimerGapMeanToBackground) && metrics.dimerGapMeanToBackgroundRatio < minDimerGapMeanToBackground) {
      status.failures.push(`dimer gap mean/background E2 ratio ${metrics.dimerGapMeanToBackgroundRatio} below ${minDimerGapMeanToBackground}`);
    }
    if (Number.isFinite(minBars) && metrics.metasurfaceBarCount < minBars) {
      status.failures.push(`metasurface bar count ${metrics.metasurfaceBarCount} below ${minBars}`);
    }
    if (Number.isFinite(minHeightSpan) && metrics.metasurfaceHeightSpanLambda < minHeightSpan) {
      status.failures.push(`metasurface height span ${metrics.metasurfaceHeightSpanLambda} below ${minHeightSpan}`);
    }
    if (Number.isFinite(minAbsorberGradient) && metrics.absorberLossGradient < minAbsorberGradient) {
      status.failures.push(`absorber loss gradient ${metrics.absorberLossGradient} below ${minAbsorberGradient}`);
    }
    if (Number.isFinite(minBackplaneCells) && metrics.absorberPecBackplaneCells < minBackplaneCells) {
      status.failures.push(`absorber PEC backplane cells ${metrics.absorberPecBackplaneCells} below ${minBackplaneCells}`);
    }
    if (Number.isFinite(minDiagnosticSamples) && metrics.diagnosticSamples < minDiagnosticSamples) {
      status.failures.push(`metamaterial diagnostics have ${metrics.diagnosticSamples} samples, expected at least ${minDiagnosticSamples}`);
    }
    if (Number.isFinite(minAbsorption) && !(Number.isFinite(metrics.absorptionProxy) && metrics.absorptionProxy >= minAbsorption)) {
      status.failures.push(`absorber proxy ${metrics.absorptionProxy} below ${minAbsorption}`);
    }
    if (Number.isFinite(maxReflectance) && !(Number.isFinite(metrics.reflectance) && metrics.reflectance <= maxReflectance)) {
      status.failures.push(`absorber reflectance ${metrics.reflectance} exceeds ${maxReflectance}`);
    }
    if (Number.isFinite(maxTransmittance) && !(Number.isFinite(metrics.transmittance) && metrics.transmittance <= maxTransmittance)) {
      status.failures.push(`absorber transmittance ${metrics.transmittance} exceeds ${maxTransmittance}`);
    }
    if (Number.isFinite(minAnalysisSamples) && metrics.analysisSamples < minAnalysisSamples) {
      status.failures.push(`metamaterial analysis has ${metrics.analysisSamples} samples, expected at least ${minAnalysisSamples}`);
    }
    if (testCase.acceptance?.hyperlensRequired && !metrics.hyperlens) {
      status.failures.push("hyperlens reduced analysis is missing");
    }
    if (metrics.hyperlens) {
      if (Number.isFinite(minHyperlensTransfer) && metrics.hyperlens.transfer < minHyperlensTransfer) {
        status.failures.push(`hyperlens transfer ${metrics.hyperlens.transfer} below ${minHyperlensTransfer}`);
      }
      if (Number.isFinite(minHyperlensMtfValid) && metrics.hyperlens.mtfValidCount < minHyperlensMtfValid) {
        status.failures.push(`hyperlens MTF valid count ${metrics.hyperlens.mtfValidCount} below ${minHyperlensMtfValid}`);
      }
      if (Number.isFinite(minHyperlensBandwidth) && metrics.hyperlens.mtfBandwidthOrder < minHyperlensBandwidth) {
        status.failures.push(`hyperlens MTF bandwidth order ${metrics.hyperlens.mtfBandwidthOrder} below ${minHyperlensBandwidth}`);
      }
    }
    if (Number.isFinite(minEnzCells) && metrics.enzCells < minEnzCells) {
      status.failures.push(`ENZ slab cells ${metrics.enzCells} below ${minEnzCells}`);
    }
    if (Number.isFinite(maxEffectiveAbsEps) && !(Number.isFinite(metrics.effectiveEpsAbsMean) && metrics.effectiveEpsAbsMean < maxEffectiveAbsEps)) {
      status.failures.push(`effective |epsilon| mean ${metrics.effectiveEpsAbsMean} exceeds ${maxEffectiveAbsEps}`);
    }
    if (Number.isFinite(minEnzEnergyFraction) && metrics.enzEnergyFraction < minEnzEnergyFraction) {
      status.failures.push(`ENZ slab energy fraction ${metrics.enzEnergyFraction} below ${minEnzEnergyFraction}`);
    }
  }
  if (testCase.acceptance?.nonlinearMediaCheck) {
    status.nonlinearMedia = await nonlinearMediaMetrics(page);
    const metrics = status.nonlinearMedia;
    const minMaterialCells = Number(testCase.acceptance?.materialCellsMin);
    const minHighIndexCells = Number(testCase.acceptance?.highIndexCellsMin);
    const minNonlinearCells = Number(testCase.acceptance?.nonlinearCellsMin);
    const minPhaseCells = Number(testCase.acceptance?.phaseChangeCellsMin);
    const minLossyCells = Number(testCase.acceptance?.lossyCellsMin);
    const minMaterialFraction = Number(testCase.acceptance?.materialEnergyFractionMin);
    const minNonlinearFraction = Number(testCase.acceptance?.nonlinearEnergyFractionMin);
    const minPhaseFraction = Number(testCase.acceptance?.phaseChangeEnergyFractionMin);
    const minAnalysisSamples = Number(testCase.acceptance?.minAnalysisSamples);
    const minHarmonic2 = Number(testCase.acceptance?.harmonic2Min);
    const minHarmonic3 = Number(testCase.acceptance?.harmonic3Min);
    const minHarmonic2To3 = Number(testCase.acceptance?.harmonic2To3RatioMin);
    const minHarmonic3To2 = Number(testCase.acceptance?.harmonic3To2RatioMin);
    const minSideband = Number(testCase.acceptance?.sidebandRatioMin);
    const minPhaseMean = Number(testCase.acceptance?.phaseStateMeanMin);
    const minPhaseMax = Number(testCase.acceptance?.phaseStateMaxMin);
    const minSwitchedCells = Number(testCase.acceptance?.switchedCellsMin);
    const minGuideFraction = Number(testCase.acceptance?.guideEnergyFractionMin);
    const minActiveFraction = Number(testCase.acceptance?.activeSectionEnergyFractionMin);
    const minOutputFraction = Number(testCase.acceptance?.outputArmEnergyFractionMin);
    const maxArmBalance = Number(testCase.acceptance?.armBalanceMax);
    const minLimiterFraction = Number(testCase.acceptance?.limiterEnergyFractionMin);
    const minLossMax = Number(testCase.acceptance?.lossMaxMin);
    if (testCase.acceptance?.nonlinearEnabled && !metrics.materialNonlinearEnabled) {
      status.failures.push("Kerr/nonlinear material flag is not enabled");
    }
    if (testCase.acceptance?.harmonicEnabled && !metrics.materialHarmonicEnabled) {
      status.failures.push("harmonic material flag is not enabled");
    }
    if (testCase.acceptance?.phaseChangeEnabled && !metrics.materialPhaseChangeEnabled) {
      status.failures.push("phase-change material flag is not enabled");
    }
    if (Number.isFinite(minMaterialCells) && metrics.materialCells < minMaterialCells) {
      status.failures.push(`nonlinear material cells ${metrics.materialCells} below ${minMaterialCells}`);
    }
    if (Number.isFinite(minHighIndexCells) && metrics.highIndexCells < minHighIndexCells) {
      status.failures.push(`nonlinear high-index cells ${metrics.highIndexCells} below ${minHighIndexCells}`);
    }
    if (Number.isFinite(minNonlinearCells) && metrics.nonlinearCells < minNonlinearCells) {
      status.failures.push(`nonlinear cells ${metrics.nonlinearCells} below ${minNonlinearCells}`);
    }
    if (Number.isFinite(minPhaseCells) && metrics.phaseChangeCells < minPhaseCells) {
      status.failures.push(`phase-change cells ${metrics.phaseChangeCells} below ${minPhaseCells}`);
    }
    if (Number.isFinite(minLossyCells) && metrics.lossyCells < minLossyCells) {
      status.failures.push(`lossy nonlinear cells ${metrics.lossyCells} below ${minLossyCells}`);
    }
    if (Number.isFinite(minMaterialFraction) && metrics.materialEnergyFraction < minMaterialFraction) {
      status.failures.push(`nonlinear material energy fraction ${metrics.materialEnergyFraction} below ${minMaterialFraction}`);
    }
    if (Number.isFinite(minNonlinearFraction) && metrics.nonlinearEnergyFraction < minNonlinearFraction) {
      status.failures.push(`nonlinear energy fraction ${metrics.nonlinearEnergyFraction} below ${minNonlinearFraction}`);
    }
    if (Number.isFinite(minPhaseFraction) && metrics.phaseChangeEnergyFraction < minPhaseFraction) {
      status.failures.push(`phase-change energy fraction ${metrics.phaseChangeEnergyFraction} below ${minPhaseFraction}`);
    }
    if (Number.isFinite(minAnalysisSamples) && metrics.analysisSamples < minAnalysisSamples) {
      status.failures.push(`nonlinear analysis has ${metrics.analysisSamples} samples, expected at least ${minAnalysisSamples}`);
    }
    if (Number.isFinite(minHarmonic2) && !(Number.isFinite(metrics.harmonic2) && metrics.harmonic2 >= minHarmonic2)) {
      status.failures.push(`H2 response ${metrics.harmonic2} below ${minHarmonic2}`);
    }
    if (Number.isFinite(minHarmonic3) && !(Number.isFinite(metrics.harmonic3) && metrics.harmonic3 >= minHarmonic3)) {
      status.failures.push(`H3 response ${metrics.harmonic3} below ${minHarmonic3}`);
    }
    if (Number.isFinite(minHarmonic2To3)) {
      const ratio = Number(metrics.harmonic2) / Math.max(1e-30, Number(metrics.harmonic3));
      if (!(Number.isFinite(ratio) && ratio >= minHarmonic2To3)) {
        status.failures.push(`H2/H3 response ratio ${ratio} below ${minHarmonic2To3}`);
      }
    }
    if (Number.isFinite(minHarmonic3To2)) {
      const ratio = Number(metrics.harmonic3) / Math.max(1e-30, Number(metrics.harmonic2));
      if (!(Number.isFinite(ratio) && ratio >= minHarmonic3To2)) {
        status.failures.push(`H3/H2 response ratio ${ratio} below ${minHarmonic3To2}`);
      }
    }
    if (Number.isFinite(minSideband) && !(Number.isFinite(metrics.sidebandRatio) && metrics.sidebandRatio >= minSideband)) {
      status.failures.push(`sideband proxy ${metrics.sidebandRatio} below ${minSideband}`);
    }
    if (Number.isFinite(minPhaseMean) && metrics.phaseStateMean < minPhaseMean) {
      status.failures.push(`phase-state mean ${metrics.phaseStateMean} below ${minPhaseMean}`);
    }
    if (Number.isFinite(minPhaseMax) && metrics.phaseStateMax < minPhaseMax) {
      status.failures.push(`phase-state max ${metrics.phaseStateMax} below ${minPhaseMax}`);
    }
    if (Number.isFinite(minSwitchedCells) && metrics.switchedCells < minSwitchedCells) {
      status.failures.push(`switched cells ${metrics.switchedCells} below ${minSwitchedCells}`);
    }
    if (Number.isFinite(minGuideFraction) && metrics.guideEnergyFraction < minGuideFraction) {
      status.failures.push(`guide energy fraction ${metrics.guideEnergyFraction} below ${minGuideFraction}`);
    }
    if (Number.isFinite(minActiveFraction) && metrics.activeSectionEnergyFraction < minActiveFraction) {
      status.failures.push(`active-section energy fraction ${metrics.activeSectionEnergyFraction} below ${minActiveFraction}`);
    }
    if (Number.isFinite(minOutputFraction) && metrics.outputArmEnergyFraction < minOutputFraction) {
      status.failures.push(`output-arm energy fraction ${metrics.outputArmEnergyFraction} below ${minOutputFraction}`);
    }
    if (Number.isFinite(maxArmBalance) && !(Number.isFinite(metrics.armBalance) && metrics.armBalance <= maxArmBalance)) {
      status.failures.push(`output-arm balance ${metrics.armBalance} exceeds ${maxArmBalance}`);
    }
    if (Number.isFinite(minLimiterFraction) && metrics.limiterEnergyFraction < minLimiterFraction) {
      status.failures.push(`limiter-section energy fraction ${metrics.limiterEnergyFraction} below ${minLimiterFraction}`);
    }
    if (Number.isFinite(minLossMax) && metrics.lossMax < minLossMax) {
      status.failures.push(`maximum nonlinear loss ${metrics.lossMax} below ${minLossMax}`);
    }
  }
  if (testCase.acceptance?.temporalMediaCheck) {
    status.temporalMedia = await temporalMediaMetrics(page);
    const metrics = status.temporalMedia;
    const minMaterialCells = Number(testCase.acceptance?.materialCellsMin);
    const minHighIndexCells = Number(testCase.acceptance?.highIndexCellsMin);
    const minModulatedCells = Number(testCase.acceptance?.modulatedCellsMin);
    const minLossyCells = Number(testCase.acceptance?.lossyCellsMin);
    const minModulationDepth = Number(testCase.acceptance?.modulationDepthMin);
    const minModulationFrequency = Number(testCase.acceptance?.modulationFrequencyMin);
    const minAnalysisSamples = Number(testCase.acceptance?.minAnalysisSamples);
    const minDftSamples = Number(testCase.acceptance?.minDiagnosticDftSamples);
    const minMaterialFraction = Number(testCase.acceptance?.materialEnergyFractionMin);
    const minModulatedFraction = Number(testCase.acceptance?.modulatedEnergyFractionMin);
    const minGuideFraction = Number(testCase.acceptance?.guideEnergyFractionMin);
    const minActiveFraction = Number(testCase.acceptance?.activeSectionEnergyFractionMin);
    const minOutputFraction = Number(testCase.acceptance?.outputGuideEnergyFractionMin);
    const minCentralFraction = Number(testCase.acceptance?.centralRegionEnergyFractionMin);
    const minRightHalfFraction = Number(testCase.acceptance?.rightHalfEnergyFractionMin);
    const minRingFraction = Number(testCase.acceptance?.ringEnergyFractionMin);
    const minResonatorBandFraction = Number(testCase.acceptance?.resonatorBandEnergyFractionMin);
    const minSidebandPower = Number(testCase.acceptance?.floquetSidebandPowerMin);
    const minReflectedSidebandPower = Number(testCase.acceptance?.floquetReflectedSidebandPowerMin);
    const minMaxSidebandRatio = Number(testCase.acceptance?.floquetMaxSidebandRatioMin);
    const minFirstUpper = Number(testCase.acceptance?.floquetFirstUpperMin);
    const minFirstLower = Number(testCase.acceptance?.floquetFirstLowerMin);
    const minPhaseCoherence = Number(testCase.acceptance?.modulationPhaseCoherenceMin);
    const maxPhaseCoherence = Number(testCase.acceptance?.modulationPhaseCoherenceMax);
    const minPhaseSpread = Number(testCase.acceptance?.modulationPhaseSpreadRadMin);
    const maxPhaseSpread = Number(testCase.acceptance?.modulationPhaseSpreadRadMax);
    const minPhaseVelocity = Number(testCase.acceptance?.modulationPhaseVelocityMin);
    const minModulatedPeaks = Number(testCase.acceptance?.modulatedPeakCountMin);
    const maxModulatedPeaks = Number(testCase.acceptance?.modulatedPeakCountMax);
    const minResonatorPeaks = Number(testCase.acceptance?.resonatorPeakCountMin);
    const maxResonatorPeaks = Number(testCase.acceptance?.resonatorPeakCountMax);
    if (testCase.acceptance?.temporalModulationEnabled && !metrics.materialModulationEnabled) {
      status.failures.push("temporal modulation flag is not enabled");
    }
    if (testCase.acceptance?.floquetRequired && !metrics.floquetPresent) {
      status.failures.push("Floquet reduced analysis is missing");
    }
    if (testCase.acceptance?.floquetPortDftRequired && !metrics.floquetPortDft) {
      status.failures.push("Floquet port-DFT reduced analysis is missing");
    }
    if (Number.isFinite(minMaterialCells) && metrics.materialCells < minMaterialCells) {
      status.failures.push(`temporal material cells ${metrics.materialCells} below ${minMaterialCells}`);
    }
    if (Number.isFinite(minHighIndexCells) && metrics.highIndexCells < minHighIndexCells) {
      status.failures.push(`temporal high-index cells ${metrics.highIndexCells} below ${minHighIndexCells}`);
    }
    if (Number.isFinite(minModulatedCells) && metrics.modulatedCells < minModulatedCells) {
      status.failures.push(`modulated cells ${metrics.modulatedCells} below ${minModulatedCells}`);
    }
    if (Number.isFinite(minLossyCells) && metrics.lossyCells < minLossyCells) {
      status.failures.push(`lossy temporal cells ${metrics.lossyCells} below ${minLossyCells}`);
    }
    if (Number.isFinite(minModulationDepth) && metrics.modulationDepth < minModulationDepth) {
      status.failures.push(`modulation depth ${metrics.modulationDepth} below ${minModulationDepth}`);
    }
    if (Number.isFinite(minModulationFrequency) && Math.abs(metrics.modulationFrequency) < minModulationFrequency) {
      status.failures.push(`modulation frequency ${metrics.modulationFrequency} below ${minModulationFrequency}`);
    }
    if (Number.isFinite(minAnalysisSamples) && metrics.analysisSamples < minAnalysisSamples) {
      status.failures.push(`temporal analysis has ${metrics.analysisSamples} samples, expected at least ${minAnalysisSamples}`);
    }
    if (Number.isFinite(minDftSamples) && metrics.diagnosticDftSamples < minDftSamples) {
      status.failures.push(`Floquet DFT has ${metrics.diagnosticDftSamples} samples, expected at least ${minDftSamples}`);
    }
    if (Number.isFinite(minMaterialFraction) && metrics.materialEnergyFraction < minMaterialFraction) {
      status.failures.push(`temporal material energy fraction ${metrics.materialEnergyFraction} below ${minMaterialFraction}`);
    }
    if (Number.isFinite(minModulatedFraction) && metrics.modulatedEnergyFraction < minModulatedFraction) {
      status.failures.push(`modulated energy fraction ${metrics.modulatedEnergyFraction} below ${minModulatedFraction}`);
    }
    if (Number.isFinite(minGuideFraction) && metrics.guideEnergyFraction < minGuideFraction) {
      status.failures.push(`temporal guide energy fraction ${metrics.guideEnergyFraction} below ${minGuideFraction}`);
    }
    if (Number.isFinite(minActiveFraction) && metrics.activeSectionEnergyFraction < minActiveFraction) {
      status.failures.push(`temporal active-section energy fraction ${metrics.activeSectionEnergyFraction} below ${minActiveFraction}`);
    }
    if (Number.isFinite(minOutputFraction) && metrics.outputGuideEnergyFraction < minOutputFraction) {
      status.failures.push(`temporal output-guide energy fraction ${metrics.outputGuideEnergyFraction} below ${minOutputFraction}`);
    }
    if (Number.isFinite(minCentralFraction) && metrics.centralRegionEnergyFraction < minCentralFraction) {
      status.failures.push(`temporal central-region energy fraction ${metrics.centralRegionEnergyFraction} below ${minCentralFraction}`);
    }
    if (Number.isFinite(minRightHalfFraction) && metrics.rightHalfEnergyFraction < minRightHalfFraction) {
      status.failures.push(`temporal right-half energy fraction ${metrics.rightHalfEnergyFraction} below ${minRightHalfFraction}`);
    }
    if (Number.isFinite(minRingFraction) && metrics.ringEnergyFraction < minRingFraction) {
      status.failures.push(`modulated-ring energy fraction ${metrics.ringEnergyFraction} below ${minRingFraction}`);
    }
    if (Number.isFinite(minResonatorBandFraction) && metrics.resonatorBandEnergyFraction < minResonatorBandFraction) {
      status.failures.push(`modulated resonator-band energy fraction ${metrics.resonatorBandEnergyFraction} below ${minResonatorBandFraction}`);
    }
    if (Number.isFinite(minSidebandPower) && !(Number.isFinite(metrics.floquetSidebandPower) && metrics.floquetSidebandPower >= minSidebandPower)) {
      status.failures.push(`Floquet sideband power ${metrics.floquetSidebandPower} below ${minSidebandPower}`);
    }
    if (
      Number.isFinite(minReflectedSidebandPower) &&
      !(Number.isFinite(metrics.floquetReflectedSidebandPower) && metrics.floquetReflectedSidebandPower >= minReflectedSidebandPower)
    ) {
      status.failures.push(`Floquet reflected sideband power ${metrics.floquetReflectedSidebandPower} below ${minReflectedSidebandPower}`);
    }
    if (Number.isFinite(minMaxSidebandRatio) && !(Number.isFinite(metrics.floquetMaxSidebandRatio) && metrics.floquetMaxSidebandRatio >= minMaxSidebandRatio)) {
      status.failures.push(`Floquet max sideband ratio ${metrics.floquetMaxSidebandRatio} below ${minMaxSidebandRatio}`);
    }
    if (Number.isFinite(minFirstUpper) && !(Number.isFinite(metrics.floquetFirstUpper) && metrics.floquetFirstUpper >= minFirstUpper)) {
      status.failures.push(`Floquet first upper sideband ${metrics.floquetFirstUpper} below ${minFirstUpper}`);
    }
    if (Number.isFinite(minFirstLower) && !(Number.isFinite(metrics.floquetFirstLower) && metrics.floquetFirstLower >= minFirstLower)) {
      status.failures.push(`Floquet first lower sideband ${metrics.floquetFirstLower} below ${minFirstLower}`);
    }
    if (Number.isFinite(minPhaseCoherence) && !(Number.isFinite(metrics.modulationPhaseSpatialCoherence) && metrics.modulationPhaseSpatialCoherence >= minPhaseCoherence)) {
      status.failures.push(`modulation phase coherence ${metrics.modulationPhaseSpatialCoherence} below ${minPhaseCoherence}`);
    }
    if (Number.isFinite(maxPhaseCoherence) && !(Number.isFinite(metrics.modulationPhaseSpatialCoherence) && metrics.modulationPhaseSpatialCoherence <= maxPhaseCoherence)) {
      status.failures.push(`modulation phase coherence ${metrics.modulationPhaseSpatialCoherence} exceeds ${maxPhaseCoherence}`);
    }
    if (Number.isFinite(minPhaseSpread) && !(Number.isFinite(metrics.modulationPhaseSpreadRad) && metrics.modulationPhaseSpreadRad >= minPhaseSpread)) {
      status.failures.push(`modulation phase spread ${metrics.modulationPhaseSpreadRad} below ${minPhaseSpread}`);
    }
    if (Number.isFinite(maxPhaseSpread) && !(Number.isFinite(metrics.modulationPhaseSpreadRad) && metrics.modulationPhaseSpreadRad <= maxPhaseSpread)) {
      status.failures.push(`modulation phase spread ${metrics.modulationPhaseSpreadRad} exceeds ${maxPhaseSpread}`);
    }
    if (Number.isFinite(minPhaseVelocity) && !(Number.isFinite(metrics.modulationPhaseVelocityLambdaPerStep) && Math.abs(metrics.modulationPhaseVelocityLambdaPerStep) >= minPhaseVelocity)) {
      status.failures.push(`modulation phase velocity ${metrics.modulationPhaseVelocityLambdaPerStep} below ${minPhaseVelocity}`);
    }
    if (Number.isFinite(minModulatedPeaks) && metrics.modulatedPeakCount < minModulatedPeaks) {
      status.failures.push(`modulated peak count ${metrics.modulatedPeakCount} below ${minModulatedPeaks}`);
    }
    if (Number.isFinite(maxModulatedPeaks) && metrics.modulatedPeakCount > maxModulatedPeaks) {
      status.failures.push(`modulated peak count ${metrics.modulatedPeakCount} exceeds ${maxModulatedPeaks}`);
    }
    if (Number.isFinite(minResonatorPeaks) && metrics.resonatorPeakCount < minResonatorPeaks) {
      status.failures.push(`resonator peak count ${metrics.resonatorPeakCount} below ${minResonatorPeaks}`);
    }
    if (Number.isFinite(maxResonatorPeaks) && metrics.resonatorPeakCount > maxResonatorPeaks) {
      status.failures.push(`resonator peak count ${metrics.resonatorPeakCount} exceeds ${maxResonatorPeaks}`);
    }
  }
  if (testCase.acceptance?.coupledWorkflowCheck) {
    status.coupledWorkflow = await coupledWorkflowMetrics(page);
    const metrics = status.coupledWorkflow;
    const minAnalysisSamples = Number(testCase.acceptance?.minAnalysisSamples);
    const minDftSamples = Number(testCase.acceptance?.minDiagnosticDftSamples);
    const minMaterialCells = Number(testCase.acceptance?.materialCellsMin);
    const minHighIndexCells = Number(testCase.acceptance?.highIndexCellsMin);
    const minGainCells = Number(testCase.acceptance?.gainCellsMin);
    const minLossyCells = Number(testCase.acceptance?.lossyCellsMin);
    const minNonlinearCells = Number(testCase.acceptance?.nonlinearCellsMin);
    const minDispersiveCells = Number(testCase.acceptance?.dispersiveCellsMin);
    const minModulatedCells = Number(testCase.acceptance?.modulatedCellsMin);
    const minMaterialFraction = Number(testCase.acceptance?.materialEnergyFractionMin);
    const minHighIndexFraction = Number(testCase.acceptance?.highIndexEnergyFractionMin);
    const minGainFraction = Number(testCase.acceptance?.gainEnergyFractionMin);
    const minLossFraction = Number(testCase.acceptance?.lossEnergyFractionMin);
    const minNonlinearFraction = Number(testCase.acceptance?.nonlinearEnergyFractionMin);
    const minDispersiveFraction = Number(testCase.acceptance?.dispersiveEnergyFractionMin);
    const minModulatedFraction = Number(testCase.acceptance?.modulatedEnergyFractionMin);
    const minGuideFraction = Number(testCase.acceptance?.guideEnergyFractionMin);
    const minCavityFraction = Number(testCase.acceptance?.cavityEnergyFractionMin);
    const minSourceFraction = Number(testCase.acceptance?.sourceOverlapFractionMin);
    const minSkinEdgeFraction = Number(testCase.acceptance?.skinEdgeFractionMin);
    const minAbsSkinBias = Number(testCase.acceptance?.absSkinBiasMin);
    const minPtNormalizedGamma = Number(testCase.acceptance?.ptNormalizedGammaMin);
    const maxPtNormalizedGamma = Number(testCase.acceptance?.ptNormalizedGammaMax);
    const maxPtEpDistance = Number(testCase.acceptance?.ptEpDistanceMax);
    const minPtCoalescence = Number(testCase.acceptance?.ptCoalescenceMin);
    const minPtRealSplit = Number(testCase.acceptance?.ptRealSplitMin);
    const maxPtRealSplit = Number(testCase.acceptance?.ptRealSplitMax);
    const minPtImagSplit = Number(testCase.acceptance?.ptImagSplitMin);
    const minPhcQ = Number(testCase.acceptance?.phcQProxyMin);
    const minPhcLeakage = Number(testCase.acceptance?.phcLeakageMin);
    const maxPhcLeakage = Number(testCase.acceptance?.phcLeakageMax);
    const minCoupledActive = Number(testCase.acceptance?.coupledActiveMaterialFractionMin);
    const minCoupledGuide = Number(testCase.acceptance?.coupledGuideEnergyFractionMin);
    const minCoupledCavity = Number(testCase.acceptance?.coupledCavityEnergyFractionMin);
    const minCoupledMaterial = Number(testCase.acceptance?.coupledMaterialEnergyFractionMin);
    const minCoupledHighIndex = Number(testCase.acceptance?.coupledHighIndexEnergyFractionMin);
    const minCoupledSource = Number(testCase.acceptance?.coupledSourceOverlapFractionMin);
    const minCoupledSkin = Number(testCase.acceptance?.coupledSkinEdgeFractionMin);
    const minAbsCoupledSkinBias = Number(testCase.acceptance?.absCoupledSkinBiasMin);
    const minAbsGainLossBias = Number(testCase.acceptance?.absCoupledGainLossBiasMin);
    const minSidebandPower = Number(testCase.acceptance?.floquetSidebandPowerMin);
    const minReflectedSidebandPower = Number(testCase.acceptance?.floquetReflectedSidebandPowerMin);
    const minMaxSidebandRatio = Number(testCase.acceptance?.floquetMaxSidebandRatioMin);
    const minPhaseCoherence = Number(testCase.acceptance?.modulationPhaseCoherenceMin);
    const maxPhaseCoherence = Number(testCase.acceptance?.modulationPhaseCoherenceMax);
    const minPhaseSpread = Number(testCase.acceptance?.modulationPhaseSpreadRadMin);
    const minPhaseVelocity = Number(testCase.acceptance?.modulationPhaseVelocityMin);
    const minSourcePhaseDifference = Number(testCase.acceptance?.sourcePhaseDifferenceDegMin);
    const maxSourcePhaseDifference = Number(testCase.acceptance?.sourcePhaseDifferenceDegMax);
    if (testCase.acceptance?.gainEnabled && !metrics.materialSaturableGainEnabled) {
      status.failures.push("saturable gain/loss flag is not enabled");
    }
    if (testCase.acceptance?.nonlinearEnabled && !metrics.materialNonlinearEnabled) {
      status.failures.push("nonlinear flag is not enabled");
    }
    if (testCase.acceptance?.dispersionEnabled && !metrics.materialDispersionEnabled) {
      status.failures.push("dispersion flag is not enabled");
    }
    if (testCase.acceptance?.temporalModulationEnabled && !metrics.materialModulationEnabled) {
      status.failures.push("temporal modulation flag is not enabled");
    }
    if (testCase.acceptance?.ptModalRequired && !metrics.ptModalRequiredData) {
      status.failures.push("PT modal reduced estimate is missing");
    }
    if (testCase.acceptance?.phcBlochRequired && !metrics.phcBlochRequiredData) {
      status.failures.push("photonic-crystal Bloch reduced estimate is missing");
    }
    if (testCase.acceptance?.coupledWorkflowRequired && !metrics.coupledWorkflowRequiredData) {
      status.failures.push("coupled-workflow reduced estimate is missing");
    }
    if (testCase.acceptance?.floquetRequired && !metrics.floquetRequiredData) {
      status.failures.push("Floquet reduced estimate is missing");
    }
    if (testCase.acceptance?.sourceShape && !metrics.sourceShapes.includes(testCase.acceptance.sourceShape)) {
      status.failures.push(`expected source shape ${testCase.acceptance.sourceShape}, got ${metrics.sourceShapes.join(",") || "none"}`);
    }
    if (Number.isFinite(minAnalysisSamples) && metrics.analysisSamples < minAnalysisSamples) {
      status.failures.push(`coupled workflow analysis has ${metrics.analysisSamples} samples, expected at least ${minAnalysisSamples}`);
    }
    if (Number.isFinite(minDftSamples) && metrics.diagnosticDftSamples < minDftSamples) {
      status.failures.push(`coupled workflow DFT has ${metrics.diagnosticDftSamples} samples, expected at least ${minDftSamples}`);
    }
    if (Number.isFinite(minMaterialCells) && metrics.materialCells < minMaterialCells) status.failures.push(`coupled material cells ${metrics.materialCells} below ${minMaterialCells}`);
    if (Number.isFinite(minHighIndexCells) && metrics.highIndexCells < minHighIndexCells) status.failures.push(`coupled high-index cells ${metrics.highIndexCells} below ${minHighIndexCells}`);
    if (Number.isFinite(minGainCells) && metrics.gainCells < minGainCells) status.failures.push(`coupled gain cells ${metrics.gainCells} below ${minGainCells}`);
    if (Number.isFinite(minLossyCells) && metrics.lossyCells < minLossyCells) status.failures.push(`coupled lossy cells ${metrics.lossyCells} below ${minLossyCells}`);
    if (Number.isFinite(minNonlinearCells) && metrics.nonlinearCells < minNonlinearCells) status.failures.push(`coupled nonlinear cells ${metrics.nonlinearCells} below ${minNonlinearCells}`);
    if (Number.isFinite(minDispersiveCells) && metrics.dispersiveCells < minDispersiveCells) status.failures.push(`coupled dispersive cells ${metrics.dispersiveCells} below ${minDispersiveCells}`);
    if (Number.isFinite(minModulatedCells) && metrics.modulatedCells < minModulatedCells) status.failures.push(`coupled modulated cells ${metrics.modulatedCells} below ${minModulatedCells}`);
    if (Number.isFinite(minMaterialFraction) && metrics.materialEnergyFraction < minMaterialFraction) status.failures.push(`coupled material energy fraction ${metrics.materialEnergyFraction} below ${minMaterialFraction}`);
    if (Number.isFinite(minHighIndexFraction) && metrics.highIndexEnergyFraction < minHighIndexFraction) status.failures.push(`coupled high-index energy fraction ${metrics.highIndexEnergyFraction} below ${minHighIndexFraction}`);
    if (Number.isFinite(minGainFraction) && metrics.gainEnergyFraction < minGainFraction) status.failures.push(`gain energy fraction ${metrics.gainEnergyFraction} below ${minGainFraction}`);
    if (Number.isFinite(minLossFraction) && metrics.lossEnergyFraction < minLossFraction) status.failures.push(`loss energy fraction ${metrics.lossEnergyFraction} below ${minLossFraction}`);
    if (Number.isFinite(minNonlinearFraction) && metrics.nonlinearEnergyFraction < minNonlinearFraction) status.failures.push(`coupled nonlinear energy fraction ${metrics.nonlinearEnergyFraction} below ${minNonlinearFraction}`);
    if (Number.isFinite(minDispersiveFraction) && metrics.dispersiveEnergyFraction < minDispersiveFraction) status.failures.push(`coupled dispersive energy fraction ${metrics.dispersiveEnergyFraction} below ${minDispersiveFraction}`);
    if (Number.isFinite(minModulatedFraction) && metrics.modulatedEnergyFraction < minModulatedFraction) status.failures.push(`coupled modulated energy fraction ${metrics.modulatedEnergyFraction} below ${minModulatedFraction}`);
    if (Number.isFinite(minGuideFraction) && metrics.guideEnergyFraction < minGuideFraction) status.failures.push(`coupled guide energy fraction ${metrics.guideEnergyFraction} below ${minGuideFraction}`);
    if (Number.isFinite(minCavityFraction) && metrics.cavityEnergyFraction < minCavityFraction) status.failures.push(`coupled cavity energy fraction ${metrics.cavityEnergyFraction} below ${minCavityFraction}`);
    if (Number.isFinite(minSourceFraction) && metrics.sourceOverlapFraction < minSourceFraction) status.failures.push(`source-overlap energy fraction ${metrics.sourceOverlapFraction} below ${minSourceFraction}`);
    if (Number.isFinite(minSkinEdgeFraction) && metrics.skinEdgeFraction < minSkinEdgeFraction) status.failures.push(`skin edge energy fraction ${metrics.skinEdgeFraction} below ${minSkinEdgeFraction}`);
    if (Number.isFinite(minAbsSkinBias) && Math.abs(metrics.skinBias) < minAbsSkinBias) status.failures.push(`skin-bias magnitude ${metrics.skinBias} below ${minAbsSkinBias}`);
    if (Number.isFinite(minPtNormalizedGamma) && !(Number.isFinite(metrics.ptNormalizedGamma) && metrics.ptNormalizedGamma >= minPtNormalizedGamma)) status.failures.push(`PT gamma/kappa ${metrics.ptNormalizedGamma} below ${minPtNormalizedGamma}`);
    if (Number.isFinite(maxPtNormalizedGamma) && !(Number.isFinite(metrics.ptNormalizedGamma) && metrics.ptNormalizedGamma <= maxPtNormalizedGamma)) status.failures.push(`PT gamma/kappa ${metrics.ptNormalizedGamma} exceeds ${maxPtNormalizedGamma}`);
    if (Number.isFinite(maxPtEpDistance) && !(Number.isFinite(metrics.ptEpDistance) && metrics.ptEpDistance <= maxPtEpDistance)) status.failures.push(`PT EP distance ${metrics.ptEpDistance} exceeds ${maxPtEpDistance}`);
    if (Number.isFinite(minPtCoalescence) && !(Number.isFinite(metrics.ptCoalescence) && metrics.ptCoalescence >= minPtCoalescence)) status.failures.push(`PT coalescence proxy ${metrics.ptCoalescence} below ${minPtCoalescence}`);
    if (Number.isFinite(minPtRealSplit) && !(Number.isFinite(metrics.ptRealSplit) && metrics.ptRealSplit >= minPtRealSplit)) status.failures.push(`PT real split ${metrics.ptRealSplit} below ${minPtRealSplit}`);
    if (Number.isFinite(maxPtRealSplit) && !(Number.isFinite(metrics.ptRealSplit) && metrics.ptRealSplit <= maxPtRealSplit)) status.failures.push(`PT real split ${metrics.ptRealSplit} exceeds ${maxPtRealSplit}`);
    if (Number.isFinite(minPtImagSplit) && !(Number.isFinite(metrics.ptImagSplit) && metrics.ptImagSplit >= minPtImagSplit)) status.failures.push(`PT imaginary split ${metrics.ptImagSplit} below ${minPtImagSplit}`);
    if (testCase.acceptance?.ptPhase && metrics.ptPhase !== testCase.acceptance.ptPhase) status.failures.push(`PT phase ${metrics.ptPhase} differs from expected ${testCase.acceptance.ptPhase}`);
    if (Number.isFinite(minPhcQ) && !(Number.isFinite(metrics.phcQProxy) && metrics.phcQProxy >= minPhcQ)) status.failures.push(`PHC Q proxy ${metrics.phcQProxy} below ${minPhcQ}`);
    if (Number.isFinite(minPhcLeakage) && !(Number.isFinite(metrics.phcLeakage) && metrics.phcLeakage >= minPhcLeakage)) status.failures.push(`PHC leakage ${metrics.phcLeakage} below ${minPhcLeakage}`);
    if (Number.isFinite(maxPhcLeakage) && !(Number.isFinite(metrics.phcLeakage) && metrics.phcLeakage <= maxPhcLeakage)) status.failures.push(`PHC leakage ${metrics.phcLeakage} exceeds ${maxPhcLeakage}`);
    if (Number.isFinite(minCoupledActive) && !(Number.isFinite(metrics.coupledActiveMaterialFraction) && metrics.coupledActiveMaterialFraction >= minCoupledActive)) status.failures.push(`coupled active-material fraction ${metrics.coupledActiveMaterialFraction} below ${minCoupledActive}`);
    if (Number.isFinite(minCoupledGuide) && !(Number.isFinite(metrics.coupledGuideEnergyFraction) && metrics.coupledGuideEnergyFraction >= minCoupledGuide)) status.failures.push(`coupled guide fraction ${metrics.coupledGuideEnergyFraction} below ${minCoupledGuide}`);
    if (Number.isFinite(minCoupledCavity) && !(Number.isFinite(metrics.coupledCavityEnergyFraction) && metrics.coupledCavityEnergyFraction >= minCoupledCavity)) status.failures.push(`coupled cavity fraction ${metrics.coupledCavityEnergyFraction} below ${minCoupledCavity}`);
    if (Number.isFinite(minCoupledMaterial) && !(Number.isFinite(metrics.coupledMaterialEnergyFraction) && metrics.coupledMaterialEnergyFraction >= minCoupledMaterial)) status.failures.push(`coupled material fraction ${metrics.coupledMaterialEnergyFraction} below ${minCoupledMaterial}`);
    if (Number.isFinite(minCoupledHighIndex) && !(Number.isFinite(metrics.coupledHighIndexEnergyFraction) && metrics.coupledHighIndexEnergyFraction >= minCoupledHighIndex)) status.failures.push(`coupled high-index fraction ${metrics.coupledHighIndexEnergyFraction} below ${minCoupledHighIndex}`);
    if (Number.isFinite(minCoupledSource) && !(Number.isFinite(metrics.coupledSourceOverlapFraction) && metrics.coupledSourceOverlapFraction >= minCoupledSource)) status.failures.push(`coupled source-overlap fraction ${metrics.coupledSourceOverlapFraction} below ${minCoupledSource}`);
    if (Number.isFinite(minCoupledSkin) && !(Number.isFinite(metrics.coupledSkinEdgeFraction) && metrics.coupledSkinEdgeFraction >= minCoupledSkin)) status.failures.push(`coupled skin edge fraction ${metrics.coupledSkinEdgeFraction} below ${minCoupledSkin}`);
    if (Number.isFinite(minAbsCoupledSkinBias) && !(Number.isFinite(metrics.coupledSkinBias) && Math.abs(metrics.coupledSkinBias) >= minAbsCoupledSkinBias)) status.failures.push(`coupled skin-bias magnitude ${metrics.coupledSkinBias} below ${minAbsCoupledSkinBias}`);
    if (Number.isFinite(minAbsGainLossBias) && !(Number.isFinite(metrics.coupledGainLossBias) && Math.abs(metrics.coupledGainLossBias) >= minAbsGainLossBias)) status.failures.push(`coupled gain/loss-bias magnitude ${metrics.coupledGainLossBias} below ${minAbsGainLossBias}`);
    if (Number.isFinite(minSidebandPower) && !(Number.isFinite(metrics.floquetSidebandPower) && metrics.floquetSidebandPower >= minSidebandPower)) status.failures.push(`coupled Floquet sideband power ${metrics.floquetSidebandPower} below ${minSidebandPower}`);
    if (Number.isFinite(minReflectedSidebandPower) && !(Number.isFinite(metrics.floquetReflectedSidebandPower) && metrics.floquetReflectedSidebandPower >= minReflectedSidebandPower)) status.failures.push(`coupled Floquet reflected sideband power ${metrics.floquetReflectedSidebandPower} below ${minReflectedSidebandPower}`);
    if (Number.isFinite(minMaxSidebandRatio) && !(Number.isFinite(metrics.floquetMaxSidebandRatio) && metrics.floquetMaxSidebandRatio >= minMaxSidebandRatio)) status.failures.push(`coupled Floquet sideband ratio ${metrics.floquetMaxSidebandRatio} below ${minMaxSidebandRatio}`);
    if (Number.isFinite(minPhaseCoherence) && !(Number.isFinite(metrics.modulationPhaseSpatialCoherence) && metrics.modulationPhaseSpatialCoherence >= minPhaseCoherence)) status.failures.push(`coupled modulation phase coherence ${metrics.modulationPhaseSpatialCoherence} below ${minPhaseCoherence}`);
    if (Number.isFinite(maxPhaseCoherence) && !(Number.isFinite(metrics.modulationPhaseSpatialCoherence) && metrics.modulationPhaseSpatialCoherence <= maxPhaseCoherence)) status.failures.push(`coupled modulation phase coherence ${metrics.modulationPhaseSpatialCoherence} exceeds ${maxPhaseCoherence}`);
    if (Number.isFinite(minPhaseSpread) && !(Number.isFinite(metrics.modulationPhaseSpreadRad) && metrics.modulationPhaseSpreadRad >= minPhaseSpread)) status.failures.push(`coupled modulation phase spread ${metrics.modulationPhaseSpreadRad} below ${minPhaseSpread}`);
    if (Number.isFinite(minPhaseVelocity) && !(Number.isFinite(metrics.modulationPhaseVelocityLambdaPerStep) && Math.abs(metrics.modulationPhaseVelocityLambdaPerStep) >= minPhaseVelocity)) status.failures.push(`coupled modulation phase velocity ${metrics.modulationPhaseVelocityLambdaPerStep} below ${minPhaseVelocity}`);
    if (Number.isFinite(minSourcePhaseDifference) && !(Number.isFinite(metrics.sourcePhaseDifferenceDeg) && metrics.sourcePhaseDifferenceDeg >= minSourcePhaseDifference)) status.failures.push(`source phase difference ${metrics.sourcePhaseDifferenceDeg} below ${minSourcePhaseDifference} deg`);
    if (Number.isFinite(maxSourcePhaseDifference) && !(Number.isFinite(metrics.sourcePhaseDifferenceDeg) && metrics.sourcePhaseDifferenceDeg <= maxSourcePhaseDifference)) status.failures.push(`source phase difference ${metrics.sourcePhaseDifferenceDeg} exceeds ${maxSourcePhaseDifference} deg`);
  }
  if (testCase.acceptance?.sourceRadiationCheck) {
    status.sourceRadiation = await sourceRadiationMetrics(page);
    const metrics = status.sourceRadiation;
    const minSourceCount = Number(testCase.acceptance?.sourceCountMin);
    const maxSourceCount = Number(testCase.acceptance?.sourceCountMax);
    const minMaterialCells = Number(testCase.acceptance?.materialCellsMin);
    const maxMaterialCells = Number(testCase.acceptance?.materialCellsMax);
    const minHighIndexCells = Number(testCase.acceptance?.highIndexCellsMin);
    const maxHighIndexCells = Number(testCase.acceptance?.highIndexCellsMax);
    const minLossyCells = Number(testCase.acceptance?.lossyCellsMin);
    const minAnisotropicCells = Number(testCase.acceptance?.anisotropicCellsMin);
    const minPecCells = Number(testCase.acceptance?.pecCellsMin);
    const maxPecCells = Number(testCase.acceptance?.pecCellsMax);
    const minApertureGapCells = Number(testCase.acceptance?.apertureGapCellsMin);
    const minMicrostripSubstrateCells = Number(testCase.acceptance?.microstripSubstrateCellsMin);
    const minMicrostripStripPecCells = Number(testCase.acceptance?.microstripStripPecCellsMin);
    const minMicrostripGroundPecCells = Number(testCase.acceptance?.microstripGroundPecCellsMin);
    const minMicrostripPecSeparation = Number(testCase.acceptance?.microstripPecSeparationLambdaMin);
    const maxMicrostripPecSeparation = Number(testCase.acceptance?.microstripPecSeparationLambdaMax);
    const minMicrostripSubstrateEnergy = Number(testCase.acceptance?.microstripSubstrateEnergyFractionMin);
    const minSourceYSpan = Number(testCase.acceptance?.sourceYSpanLambdaMin);
    const maxSourceYSpan = Number(testCase.acceptance?.sourceYSpanLambdaMax);
    const minSourceXSpan = Number(testCase.acceptance?.sourceXSpanLambdaMin);
    const maxSourceXSpan = Number(testCase.acceptance?.sourceXSpanLambdaMax);
    const minSourceYSpacingMean = Number(testCase.acceptance?.sourceYSpacingMeanLambdaMin);
    const maxSourceYSpacingMean = Number(testCase.acceptance?.sourceYSpacingMeanLambdaMax);
    const maxSourceYSpacingStd = Number(testCase.acceptance?.sourceYSpacingStdLambdaMax);
    const minSourceAngle = Number(testCase.acceptance?.sourceAngleMeanAbsDegMin);
    const maxSourceAngle = Number(testCase.acceptance?.sourceAngleMeanAbsDegMax);
    const minFrequencySpread = Number(testCase.acceptance?.sourceFrequencySpreadMin);
    const minFrequencyRatio = Number(testCase.acceptance?.sourceFrequencyRatioMin);
    const minEvanescentRatio = Number(testCase.acceptance?.evanescentKParallelRatioMin);
    const minPhaseStep = Number(testCase.acceptance?.sourcePhaseStepMeanAbsDegMin);
    const maxPhaseStep = Number(testCase.acceptance?.sourcePhaseStepMeanAbsDegMax);
    const maxPhaseStepStd = Number(testCase.acceptance?.sourcePhaseStepStdDegMax);
    const minMaterialFraction = Number(testCase.acceptance?.materialEnergyFractionMin);
    const minHighIndexFraction = Number(testCase.acceptance?.highIndexEnergyFractionMin);
    const minSourceFraction = Number(testCase.acceptance?.sourceNeighborhoodEnergyFractionMin);
    const minRightLeft = Number(testCase.acceptance?.rightToLeftEnergyRatioMin);
    const maxRightLeft = Number(testCase.acceptance?.rightToLeftEnergyRatioMax);
    const minLowerUpper = Number(testCase.acceptance?.lowerToUpperEnergyRatioMin);
    const maxLowerUpper = Number(testCase.acceptance?.lowerToUpperEnergyRatioMax);
    const minSourceAngularEnergy = Number(testCase.acceptance?.sourceAngularTotalEnergyMin);
    const minSourcePeakFraction = Number(testCase.acceptance?.sourceAngularPeakEnergyFractionMin);
    const minSourceForwardFraction = Number(testCase.acceptance?.sourceForwardSectorEnergyFractionMin);
    const maxSourceForwardFraction = Number(testCase.acceptance?.sourceForwardSectorEnergyFractionMax);
    const minSourceForwardBackward = Number(testCase.acceptance?.sourceForwardBackwardSectorRatioMin);
    const maxSourceForwardBackward = Number(testCase.acceptance?.sourceForwardBackwardSectorRatioMax);
    const maxSourceForwardPeakError = Number(testCase.acceptance?.sourceForwardPeakAngleErrorDegMax);
    const minSourceExpectedAngle = Number(testCase.acceptance?.sourceExpectedRadiationAngleDegMin);
    const maxSourceExpectedAngle = Number(testCase.acceptance?.sourceExpectedRadiationAngleDegMax);
    const minDerivedSteeringAngle = Number(testCase.acceptance?.derivedArraySteeringAngleDegMin);
    const maxDerivedSteeringAngle = Number(testCase.acceptance?.derivedArraySteeringAngleDegMax);
    const minFarFieldSamples = Number(testCase.acceptance?.farFieldSamplesMin);
    const minFarFieldFiniteSamples = Number(testCase.acceptance?.farFieldFiniteSamplesMin);
    const minFarFieldPeak = Number(testCase.acceptance?.farFieldPeakMin);
    const minFarFieldMean = Number(testCase.acceptance?.farFieldMeanMin);
    const maxFarFieldMean = Number(testCase.acceptance?.farFieldMeanMax);
    const minFarFieldNormalizedStd = Number(testCase.acceptance?.farFieldNormalizedStdMin);
    const maxFarFieldNormalizedStd = Number(testCase.acceptance?.farFieldNormalizedStdMax);
    const minAnalysisSamples = Number(testCase.acceptance?.minAnalysisSamples);
    const minSweepSamples = Number(testCase.acceptance?.sweepSamplesMin);
    if (testCase.acceptance?.fieldComponent && metrics.fieldComponent !== testCase.acceptance.fieldComponent) {
      status.failures.push(`field component ${metrics.fieldComponent} differs from expected ${testCase.acceptance.fieldComponent}`);
    }
    if (testCase.acceptance?.viewMode && metrics.viewMode !== testCase.acceptance.viewMode) {
      status.failures.push(`view mode ${metrics.viewMode} differs from expected ${testCase.acceptance.viewMode}`);
    }
    if (Object.prototype.hasOwnProperty.call(testCase.acceptance || {}, "fieldQuiver") && metrics.fieldQuiver !== Boolean(testCase.acceptance.fieldQuiver)) {
      status.failures.push(`field quiver ${metrics.fieldQuiver} differs from expected ${Boolean(testCase.acceptance.fieldQuiver)}`);
    }
    if (testCase.acceptance?.sweepMode && metrics.sweepMode !== testCase.acceptance.sweepMode) {
      status.failures.push(`sweep mode ${metrics.sweepMode} differs from expected ${testCase.acceptance.sweepMode}`);
    }
    if (testCase.acceptance?.sourceShape && !metrics.sourceShapes.includes(testCase.acceptance.sourceShape)) {
      status.failures.push(`expected source shape ${testCase.acceptance.sourceShape}, got ${metrics.sourceShapes.join(",") || "none"}`);
    }
    if (testCase.acceptance?.sourceType && !metrics.sourceTypes.includes(testCase.acceptance.sourceType)) {
      status.failures.push(`expected source type ${testCase.acceptance.sourceType}, got ${metrics.sourceTypes.join(",") || "none"}`);
    }
    if (Number.isFinite(minSourceCount) && metrics.sourceCount < minSourceCount) status.failures.push(`source count ${metrics.sourceCount} below ${minSourceCount}`);
    if (Number.isFinite(maxSourceCount) && metrics.sourceCount > maxSourceCount) status.failures.push(`source count ${metrics.sourceCount} exceeds ${maxSourceCount}`);
    if (Number.isFinite(minMaterialCells) && metrics.materialCells < minMaterialCells) status.failures.push(`source-scene material cells ${metrics.materialCells} below ${minMaterialCells}`);
    if (Number.isFinite(maxMaterialCells) && metrics.materialCells > maxMaterialCells) status.failures.push(`source-scene material cells ${metrics.materialCells} exceed ${maxMaterialCells}`);
    if (Number.isFinite(minHighIndexCells) && metrics.highIndexCells < minHighIndexCells) status.failures.push(`source-scene high-index cells ${metrics.highIndexCells} below ${minHighIndexCells}`);
    if (Number.isFinite(maxHighIndexCells) && metrics.highIndexCells > maxHighIndexCells) status.failures.push(`source-scene high-index cells ${metrics.highIndexCells} exceed ${maxHighIndexCells}`);
    if (Number.isFinite(minLossyCells) && metrics.lossyCells < minLossyCells) status.failures.push(`source-scene lossy cells ${metrics.lossyCells} below ${minLossyCells}`);
    if (Number.isFinite(minAnisotropicCells) && metrics.anisotropicCells < minAnisotropicCells) status.failures.push(`source-scene anisotropic cells ${metrics.anisotropicCells} below ${minAnisotropicCells}`);
    if (Number.isFinite(minPecCells) && metrics.pecCells < minPecCells) status.failures.push(`source-scene PEC cells ${metrics.pecCells} below ${minPecCells}`);
    if (Number.isFinite(maxPecCells) && metrics.pecCells > maxPecCells) status.failures.push(`source-scene PEC cells ${metrics.pecCells} exceed ${maxPecCells}`);
    if (Number.isFinite(minApertureGapCells) && metrics.apertureGapCells < minApertureGapCells) status.failures.push(`aperture gap cells ${metrics.apertureGapCells} below ${minApertureGapCells}`);
    if (Number.isFinite(minMicrostripSubstrateCells) && metrics.microstripSubstrateCells < minMicrostripSubstrateCells) {
      status.failures.push(`microstrip substrate cells ${metrics.microstripSubstrateCells} below ${minMicrostripSubstrateCells}`);
    }
    if (Number.isFinite(minMicrostripStripPecCells) && metrics.microstripStripPecCells < minMicrostripStripPecCells) {
      status.failures.push(`microstrip strip PEC cells ${metrics.microstripStripPecCells} below ${minMicrostripStripPecCells}`);
    }
    if (Number.isFinite(minMicrostripGroundPecCells) && metrics.microstripGroundPecCells < minMicrostripGroundPecCells) {
      status.failures.push(`microstrip ground PEC cells ${metrics.microstripGroundPecCells} below ${minMicrostripGroundPecCells}`);
    }
    if (Number.isFinite(minMicrostripPecSeparation) && metrics.microstripPecSeparationLambda < minMicrostripPecSeparation) {
      status.failures.push(`microstrip PEC separation ${metrics.microstripPecSeparationLambda} below ${minMicrostripPecSeparation}`);
    }
    if (Number.isFinite(maxMicrostripPecSeparation) && metrics.microstripPecSeparationLambda > maxMicrostripPecSeparation) {
      status.failures.push(`microstrip PEC separation ${metrics.microstripPecSeparationLambda} exceeds ${maxMicrostripPecSeparation}`);
    }
    if (Number.isFinite(minSourceYSpan) && metrics.sourceYSpanLambda < minSourceYSpan) status.failures.push(`source Y span ${metrics.sourceYSpanLambda} below ${minSourceYSpan}`);
    if (Number.isFinite(maxSourceYSpan) && metrics.sourceYSpanLambda > maxSourceYSpan) status.failures.push(`source Y span ${metrics.sourceYSpanLambda} exceeds ${maxSourceYSpan}`);
    if (Number.isFinite(minSourceXSpan) && metrics.sourceXSpanLambda < minSourceXSpan) status.failures.push(`source X span ${metrics.sourceXSpanLambda} below ${minSourceXSpan}`);
    if (Number.isFinite(maxSourceXSpan) && metrics.sourceXSpanLambda > maxSourceXSpan) status.failures.push(`source X span ${metrics.sourceXSpanLambda} exceeds ${maxSourceXSpan}`);
    if (Number.isFinite(minSourceYSpacingMean) && metrics.sourceYSpacingMeanLambda < minSourceYSpacingMean) {
      status.failures.push(`source Y spacing mean ${metrics.sourceYSpacingMeanLambda} below ${minSourceYSpacingMean}`);
    }
    if (Number.isFinite(maxSourceYSpacingMean) && metrics.sourceYSpacingMeanLambda > maxSourceYSpacingMean) {
      status.failures.push(`source Y spacing mean ${metrics.sourceYSpacingMeanLambda} exceeds ${maxSourceYSpacingMean}`);
    }
    if (Number.isFinite(maxSourceYSpacingStd) && metrics.sourceYSpacingStdLambda > maxSourceYSpacingStd) {
      status.failures.push(`source Y spacing std ${metrics.sourceYSpacingStdLambda} exceeds ${maxSourceYSpacingStd}`);
    }
    if (Number.isFinite(minSourceAngle) && metrics.sourceAngleMeanAbsDeg < minSourceAngle) status.failures.push(`mean source angle ${metrics.sourceAngleMeanAbsDeg} below ${minSourceAngle} deg`);
    if (Number.isFinite(maxSourceAngle) && metrics.sourceAngleMeanAbsDeg > maxSourceAngle) status.failures.push(`mean source angle ${metrics.sourceAngleMeanAbsDeg} exceeds ${maxSourceAngle} deg`);
    if (Number.isFinite(minFrequencySpread) && metrics.sourceFrequencySpread < minFrequencySpread) status.failures.push(`source frequency spread ${metrics.sourceFrequencySpread} below ${minFrequencySpread}`);
    if (Number.isFinite(minFrequencyRatio) && metrics.sourceFrequencyRatio < minFrequencyRatio) status.failures.push(`source frequency ratio ${metrics.sourceFrequencyRatio} below ${minFrequencyRatio}`);
    if (Number.isFinite(minEvanescentRatio) && metrics.evanescentKParallelRatioMax < minEvanescentRatio) status.failures.push(`evanescent k_parallel/k0 ${metrics.evanescentKParallelRatioMax} below ${minEvanescentRatio}`);
    if (Number.isFinite(minPhaseStep) && metrics.sourcePhaseStepMeanAbsDeg < minPhaseStep) status.failures.push(`source phase-step magnitude ${metrics.sourcePhaseStepMeanAbsDeg} below ${minPhaseStep}`);
    if (Number.isFinite(maxPhaseStep) && metrics.sourcePhaseStepMeanAbsDeg > maxPhaseStep) status.failures.push(`source phase-step magnitude ${metrics.sourcePhaseStepMeanAbsDeg} exceeds ${maxPhaseStep}`);
    if (Number.isFinite(maxPhaseStepStd) && metrics.sourcePhaseStepStdDeg > maxPhaseStepStd) status.failures.push(`source phase-step std ${metrics.sourcePhaseStepStdDeg} exceeds ${maxPhaseStepStd}`);
    if (Number.isFinite(minMaterialFraction) && metrics.materialEnergyFraction < minMaterialFraction) status.failures.push(`source-scene material energy fraction ${metrics.materialEnergyFraction} below ${minMaterialFraction}`);
    if (Number.isFinite(minHighIndexFraction) && metrics.highIndexEnergyFraction < minHighIndexFraction) status.failures.push(`source-scene high-index energy fraction ${metrics.highIndexEnergyFraction} below ${minHighIndexFraction}`);
    if (Number.isFinite(minMicrostripSubstrateEnergy) && metrics.microstripSubstrateEnergyFraction < minMicrostripSubstrateEnergy) {
      status.failures.push(`microstrip substrate energy fraction ${metrics.microstripSubstrateEnergyFraction} below ${minMicrostripSubstrateEnergy}`);
    }
    if (Number.isFinite(minSourceFraction) && metrics.sourceNeighborhoodEnergyFraction < minSourceFraction) status.failures.push(`source-neighborhood energy fraction ${metrics.sourceNeighborhoodEnergyFraction} below ${minSourceFraction}`);
    if (Number.isFinite(minRightLeft) && metrics.rightToLeftEnergyRatio < minRightLeft) status.failures.push(`right/left source energy ratio ${metrics.rightToLeftEnergyRatio} below ${minRightLeft}`);
    if (Number.isFinite(maxRightLeft) && metrics.rightToLeftEnergyRatio > maxRightLeft) status.failures.push(`right/left source energy ratio ${metrics.rightToLeftEnergyRatio} exceeds ${maxRightLeft}`);
    if (Number.isFinite(minLowerUpper) && metrics.lowerToUpperEnergyRatio < minLowerUpper) status.failures.push(`lower/upper source energy ratio ${metrics.lowerToUpperEnergyRatio} below ${minLowerUpper}`);
    if (Number.isFinite(maxLowerUpper) && metrics.lowerToUpperEnergyRatio > maxLowerUpper) status.failures.push(`lower/upper source energy ratio ${metrics.lowerToUpperEnergyRatio} exceeds ${maxLowerUpper}`);
    if (Number.isFinite(minSourceAngularEnergy) && metrics.sourceAngularTotalEnergy < minSourceAngularEnergy) {
      status.failures.push(`source angular annulus energy ${metrics.sourceAngularTotalEnergy} below ${minSourceAngularEnergy}`);
    }
    if (Number.isFinite(minSourcePeakFraction) && metrics.sourceAngularPeakEnergyFraction < minSourcePeakFraction) {
      status.failures.push(`source angular peak fraction ${metrics.sourceAngularPeakEnergyFraction} below ${minSourcePeakFraction}`);
    }
    if (Number.isFinite(minSourceForwardFraction) && metrics.sourceForwardSectorEnergyFraction < minSourceForwardFraction) {
      status.failures.push(`source forward-sector fraction ${metrics.sourceForwardSectorEnergyFraction} below ${minSourceForwardFraction}`);
    }
    if (Number.isFinite(maxSourceForwardFraction) && metrics.sourceForwardSectorEnergyFraction > maxSourceForwardFraction) {
      status.failures.push(`source forward-sector fraction ${metrics.sourceForwardSectorEnergyFraction} exceeds ${maxSourceForwardFraction}`);
    }
    if (Number.isFinite(minSourceForwardBackward) && metrics.sourceForwardBackwardSectorRatio < minSourceForwardBackward) {
      status.failures.push(`source forward/backward sector ratio ${metrics.sourceForwardBackwardSectorRatio} below ${minSourceForwardBackward}`);
    }
    if (Number.isFinite(maxSourceForwardBackward) && metrics.sourceForwardBackwardSectorRatio > maxSourceForwardBackward) {
      status.failures.push(`source forward/backward sector ratio ${metrics.sourceForwardBackwardSectorRatio} exceeds ${maxSourceForwardBackward}`);
    }
    if (
      Number.isFinite(maxSourceForwardPeakError) &&
      !(Number.isFinite(metrics.sourceForwardHemispherePeakAngleErrorDeg) && metrics.sourceForwardHemispherePeakAngleErrorDeg <= maxSourceForwardPeakError)
    ) {
      status.failures.push(`source forward peak-angle error ${metrics.sourceForwardHemispherePeakAngleErrorDeg} exceeds ${maxSourceForwardPeakError}`);
    }
    if (Number.isFinite(minSourceExpectedAngle) && metrics.expectedRadiationAngleDeg < minSourceExpectedAngle) {
      status.failures.push(`expected source radiation angle ${metrics.expectedRadiationAngleDeg} below ${minSourceExpectedAngle}`);
    }
    if (Number.isFinite(maxSourceExpectedAngle) && metrics.expectedRadiationAngleDeg > maxSourceExpectedAngle) {
      status.failures.push(`expected source radiation angle ${metrics.expectedRadiationAngleDeg} exceeds ${maxSourceExpectedAngle}`);
    }
    if (Number.isFinite(minDerivedSteeringAngle) && !(Number.isFinite(metrics.derivedArraySteeringAngleDeg) && metrics.derivedArraySteeringAngleDeg >= minDerivedSteeringAngle)) {
      status.failures.push(`derived array steering angle ${metrics.derivedArraySteeringAngleDeg} below ${minDerivedSteeringAngle}`);
    }
    if (Number.isFinite(maxDerivedSteeringAngle) && !(Number.isFinite(metrics.derivedArraySteeringAngleDeg) && metrics.derivedArraySteeringAngleDeg <= maxDerivedSteeringAngle)) {
      status.failures.push(`derived array steering angle ${metrics.derivedArraySteeringAngleDeg} exceeds ${maxDerivedSteeringAngle}`);
    }
    if (Number.isFinite(minFarFieldSamples) && metrics.farFieldSamples < minFarFieldSamples) status.failures.push(`far-field samples ${metrics.farFieldSamples} below ${minFarFieldSamples}`);
    if (Number.isFinite(minFarFieldFiniteSamples) && metrics.farFieldFiniteSamples < minFarFieldFiniteSamples) {
      status.failures.push(`finite far-field samples ${metrics.farFieldFiniteSamples} below ${minFarFieldFiniteSamples}`);
    }
    if (Number.isFinite(minFarFieldPeak) && metrics.farFieldPeak < minFarFieldPeak) status.failures.push(`far-field peak ${metrics.farFieldPeak} below ${minFarFieldPeak}`);
    if (Number.isFinite(minFarFieldMean) && metrics.farFieldMean < minFarFieldMean) status.failures.push(`mean far-field value ${metrics.farFieldMean} below ${minFarFieldMean}`);
    if (Number.isFinite(maxFarFieldMean) && metrics.farFieldMean > maxFarFieldMean) status.failures.push(`mean far-field value ${metrics.farFieldMean} exceeds ${maxFarFieldMean}`);
    if (Number.isFinite(minFarFieldNormalizedStd) && metrics.farFieldNormalizedStd < minFarFieldNormalizedStd) {
      status.failures.push(`normalized far-field std ${metrics.farFieldNormalizedStd} below ${minFarFieldNormalizedStd}`);
    }
    if (Number.isFinite(maxFarFieldNormalizedStd) && metrics.farFieldNormalizedStd > maxFarFieldNormalizedStd) {
      status.failures.push(`normalized far-field std ${metrics.farFieldNormalizedStd} exceeds ${maxFarFieldNormalizedStd}`);
    }
    if (Number.isFinite(minAnalysisSamples) && metrics.analysisSamples < minAnalysisSamples) status.failures.push(`source analysis samples ${metrics.analysisSamples} below ${minAnalysisSamples}`);
    if (Number.isFinite(minSweepSamples) && metrics.sweepSamples < minSweepSamples) status.failures.push(`sweep samples ${metrics.sweepSamples} below ${minSweepSamples}`);
    if (testCase.acceptance?.farFieldMode && metrics.farFieldMode !== testCase.acceptance.farFieldMode) {
      status.failures.push(`far-field mode ${metrics.farFieldMode} differs from expected ${testCase.acceptance.farFieldMode}`);
    }
  }
  if (testCase.acceptance?.mmiSplitCheck) {
    status.mmiSplit = await mmiSplitMetrics(page, testCase);
    const metrics = status.mmiSplit;
    const target = Number(testCase.acceptance?.upperFractionTarget ?? testCase.acceptance?.mmiUpperFractionTarget ?? 0.5);
    const tolerance = Number(testCase.acceptance?.upperFractionTolerance ?? testCase.acceptance?.mmiUpperFractionTolerance ?? 0.12);
    const minTemporalSamples = Number(testCase.acceptance?.mmiTemporalSamplesMin);
    const minTotalEz2 = Number(testCase.acceptance?.mmiTotalEz2Min);
    const minTotalForwardSx = Number(testCase.acceptance?.mmiTotalForwardSxMin);
    const maxSignedSxAbs = Number(testCase.acceptance?.mmiSignedSxBalanceAbsMax);
    if (Number.isFinite(minTemporalSamples) && metrics.temporalSamples < minTemporalSamples) {
      status.failures.push(`MMI temporal samples ${metrics.temporalSamples} below ${minTemporalSamples}`);
    }
    if (Number.isFinite(minTotalEz2) && metrics.totalEz2 < minTotalEz2) {
      status.failures.push(`MMI total Ez^2 ${metrics.totalEz2} below ${minTotalEz2}`);
    }
    if (Number.isFinite(minTotalForwardSx) && metrics.totalForwardSx < minTotalForwardSx) {
      status.failures.push(`MMI total forward Sx ${metrics.totalForwardSx} below ${minTotalForwardSx}`);
    }
    if (!(Number.isFinite(metrics.upperEz2Fraction) && Math.abs(metrics.upperEz2Fraction - target) <= tolerance)) {
      status.failures.push(`MMI upper Ez^2 fraction ${metrics.upperEz2Fraction} differs from ${target} by more than ${tolerance}`);
    }
    if (Number.isFinite(maxSignedSxAbs) && !(Number.isFinite(metrics.signedSxBalance) && Math.abs(metrics.signedSxBalance) <= maxSignedSxAbs)) {
      status.failures.push(`MMI signed Sx balance ${metrics.signedSxBalance} exceeds ${maxSignedSxAbs}`);
    }
  }
  if (testCase.acceptance?.directionalCouplerCheck) {
    status.directionalCoupler = await directionalCouplerMetrics(page, testCase);
    const metrics = status.directionalCoupler;
    const minTemporalSamples = Number(testCase.acceptance?.couplerTemporalSamplesMin);
    const minMonitorCount = Number(testCase.acceptance?.couplerMonitorCountMin);
    const minTotalForwardSx = Number(testCase.acceptance?.couplerBestTotalForwardSxMin);
    const minCrossForwardFraction = Number(testCase.acceptance?.couplerCrossForwardSxFractionMin);
    const minCrossEz2Fraction = Number(testCase.acceptance?.couplerCrossEz2FractionMin);
    if (Number.isFinite(minTemporalSamples) && metrics.temporalSamples < minTemporalSamples) {
      status.failures.push(`directional-coupler temporal samples ${metrics.temporalSamples} below ${minTemporalSamples}`);
    }
    if (Number.isFinite(minMonitorCount) && metrics.monitorCount < minMonitorCount) {
      status.failures.push(`directional-coupler monitor count ${metrics.monitorCount} below ${minMonitorCount}`);
    }
    if (
      Number.isFinite(minTotalForwardSx) &&
      !(metrics.best && Number.isFinite(metrics.best.totalForwardSx) && metrics.best.totalForwardSx >= minTotalForwardSx)
    ) {
      status.failures.push(`directional-coupler best total forward Sx ${metrics.best?.totalForwardSx} below ${minTotalForwardSx}`);
    }
    if (
      Number.isFinite(minCrossForwardFraction) &&
      !(metrics.best && Number.isFinite(metrics.best.crossForwardSxFraction) && metrics.best.crossForwardSxFraction >= minCrossForwardFraction)
    ) {
      status.failures.push(
        `directional-coupler cross forward-Sx fraction ${metrics.best?.crossForwardSxFraction} below ${minCrossForwardFraction}`,
      );
    }
    if (
      Number.isFinite(minCrossEz2Fraction) &&
      !(metrics.best && Number.isFinite(metrics.best.crossEz2Fraction) && metrics.best.crossEz2Fraction >= minCrossEz2Fraction)
    ) {
      status.failures.push(`directional-coupler cross Ez^2 fraction ${metrics.best?.crossEz2Fraction} below ${minCrossEz2Fraction}`);
    }
  }
  if (testCase.acceptance?.guidedDeviceCheck) {
    status.guidedDevice = await guidedDeviceMetrics(page);
    const metrics = status.guidedDevice;
    const minSourceCount = Number(testCase.acceptance?.sourceCountMin);
    const maxSourceCount = Number(testCase.acceptance?.sourceCountMax);
    const minModeOrder = Number(testCase.acceptance?.sourceModeOrderMaxMin);
    const minSourceYSpan = Number(testCase.acceptance?.sourceYSpanLambdaMin);
    const minSourceSeparation = Number(testCase.acceptance?.sourceSeparationLambdaMin);
    const minMaterialCells = Number(testCase.acceptance?.materialCellsMin);
    const minHighIndexCells = Number(testCase.acceptance?.highIndexCellsMin);
    const minLossyCells = Number(testCase.acceptance?.lossyCellsMin);
    const minPecCells = Number(testCase.acceptance?.pecCellsMin);
    const minGuideBandCells = Number(testCase.acceptance?.guideBandHighIndexCellsMin);
    const minColumns = Number(testCase.acceptance?.columnsWithHighIndexMin);
    const minMultiColumns = Number(testCase.acceptance?.columnsWithMultipleSegmentsMin);
    const minSegments = Number(testCase.acceptance?.maxSegmentsPerColumnMin);
    const minSegmentSeparation = Number(testCase.acceptance?.maxSegmentSeparationLambdaMin);
    const minMaxSpan = Number(testCase.acceptance?.maxColumnSpanLambdaMin);
    const maxMaxSpan = Number(testCase.acceptance?.maxColumnSpanLambdaMax);
    const minWidthRange = Number(testCase.acceptance?.widthRangeLambdaMin);
    const maxWidthRange = Number(testCase.acceptance?.widthRangeLambdaMax);
    const minWidthJump = Number(testCase.acceptance?.maxAdjacentWidthJumpLambdaMin);
    const maxWidthJump = Number(testCase.acceptance?.maxAdjacentWidthJumpLambdaMax);
    const minCentroidShift = Number(testCase.acceptance?.centroidShiftRangeLambdaMin);
    const minUpperOffAxis = Number(testCase.acceptance?.upperOffAxisHighIndexCellsMin);
    const minLowerOffAxis = Number(testCase.acceptance?.lowerOffAxisHighIndexCellsMin);
    const minStubCells = Number(testCase.acceptance?.stubHighIndexCellsMin);
    const minStubFraction = Number(testCase.acceptance?.stubEnergyFractionMin);
    const minStubToGuide = Number(testCase.acceptance?.stubToGuideEnergyRatioMin);
    const minStubPecCells = Number(testCase.acceptance?.stubPecCellsMin);
    const maxStubPecCells = Number(testCase.acceptance?.stubPecCellsMax);
    const minScattererCells = Number(testCase.acceptance?.offsetScattererHighIndexCellsMin);
    const minCentralDiskCells = Number(testCase.acceptance?.centralDiskHighIndexCellsMin);
    const minCentralPecCells = Number(testCase.acceptance?.centralPecCellsMin);
    const minRingCells = Number(testCase.acceptance?.ringCellsMin);
    const minRacetrackCells = Number(testCase.acceptance?.racetrackRingCellsMin);
    const minBusCells = Number(testCase.acceptance?.busHighIndexCellsMin);
    const minDropCells = Number(testCase.acceptance?.dropBusHighIndexCellsMin);
    const minHighIndexFraction = Number(testCase.acceptance?.highIndexEnergyFractionMin);
    const minGuideFraction = Number(testCase.acceptance?.guideBandEnergyFractionMin);
    const minSourceFraction = Number(testCase.acceptance?.sourceOverlapEnergyFractionMin);
    const minCentralDiskFraction = Number(testCase.acceptance?.centralDiskEnergyFractionMin);
    const minRingFraction = Number(testCase.acceptance?.ringEnergyFractionMin);
    const minRacetrackFraction = Number(testCase.acceptance?.racetrackRingEnergyFractionMin);
    const minBeta = Number(testCase.acceptance?.betaMin);
    const maxBeta = Number(testCase.acceptance?.betaMax);
    const minModeNeff = Number(testCase.acceptance?.modeEffectiveIndexMin);
    const minModeInputOverlap = Number(testCase.acceptance?.modeInputOverlapMin);
    const minModeOutputOverlap = Number(testCase.acceptance?.modeOutputOverlapMin);
    const maxModeRadiationFraction = Number(testCase.acceptance?.modeRadiationFractionMax);
    const maxModalReflectionProxy = Number(testCase.acceptance?.modalReflectionProxyMax);
    const requiresModalS = Boolean(testCase.acceptance?.modalSParametersFinite);
    const minSplit = Number(testCase.acceptance?.splitMin);
    const minSpectralSplit = Number(testCase.acceptance?.spectralSplitMin);
    const minRingdownQ = Number(testCase.acceptance?.ringdownQMin);
    const minModeArea = Number(testCase.acceptance?.modeAreaLambda2Min);
    const maxModeArea = Number(testCase.acceptance?.modeAreaLambda2Max);
    const minQAreaMetric = Number(testCase.acceptance?.qAreaMetricMin);
    const maxQAreaMetric = Number(testCase.acceptance?.qAreaMetricMax);
    const minPurcellProxy = Number(testCase.acceptance?.purcellProxyMin);
    const minAnalysisSamples = Number(testCase.acceptance?.minAnalysisSamples);
    const minBoundsWidth = Number(testCase.acceptance?.materialBoundsWidthLambdaMin);
    const minBoundsHeight = Number(testCase.acceptance?.materialBoundsHeightLambdaMin);
    const minMziUpperArmCells = Number(testCase.acceptance?.mziUpperArmHighIndexCellsMin);
    const minMziLowerArmCells = Number(testCase.acceptance?.mziLowerArmHighIndexCellsMin);
    const minMziPhaseCells = Number(testCase.acceptance?.mziPhaseShifterCellsMin);
    const minMziSplitterFraction = Number(testCase.acceptance?.mziSplitterEnergyFractionMin);
    const minMziArmFraction = Number(testCase.acceptance?.mziArmEnergyFractionMin);
    const maxMziArmBalance = Number(testCase.acceptance?.mziArmEnergyBalanceMax);
    const minMziPhaseFraction = Number(testCase.acceptance?.mziPhaseShifterEnergyFractionMin);
    const minMziCombinerFraction = Number(testCase.acceptance?.mziCombinerEnergyFractionMin);
    const minMziOutputFraction = Number(testCase.acceptance?.mziOutputGuideEnergyFractionMin);
    const maxMziInputFraction = Number(testCase.acceptance?.mziInputGuideEnergyFractionMax);
    if (testCase.acceptance?.fieldComponent && metrics.fieldComponent !== testCase.acceptance.fieldComponent) {
      status.failures.push(`guided field component ${metrics.fieldComponent} differs from expected ${testCase.acceptance.fieldComponent}`);
    }
    if (testCase.acceptance?.sourceShape && !metrics.sourceShapes.includes(testCase.acceptance.sourceShape)) {
      status.failures.push(`expected guided source shape ${testCase.acceptance.sourceShape}, got ${metrics.sourceShapes.join(",") || "none"}`);
    }
    if (testCase.acceptance?.sourceType && !metrics.sourceTypes.includes(testCase.acceptance.sourceType)) {
      status.failures.push(`expected guided source type ${testCase.acceptance.sourceType}, got ${metrics.sourceTypes.join(",") || "none"}`);
    }
    if (Number.isFinite(minSourceCount) && metrics.sourceCount < minSourceCount) status.failures.push(`guided source count ${metrics.sourceCount} below ${minSourceCount}`);
    if (Number.isFinite(maxSourceCount) && metrics.sourceCount > maxSourceCount) status.failures.push(`guided source count ${metrics.sourceCount} exceeds ${maxSourceCount}`);
    if (Number.isFinite(minModeOrder) && metrics.sourceModeOrderMax < minModeOrder) status.failures.push(`source mode order max ${metrics.sourceModeOrderMax} below ${minModeOrder}`);
    if (Number.isFinite(minSourceYSpan) && metrics.sourceYSpanLambda < minSourceYSpan) status.failures.push(`guided source Y span ${metrics.sourceYSpanLambda} below ${minSourceYSpan}`);
    if (Number.isFinite(minSourceSeparation) && metrics.sourceSeparationLambda < minSourceSeparation) status.failures.push(`guided source separation ${metrics.sourceSeparationLambda} below ${minSourceSeparation}`);
    if (Number.isFinite(minMaterialCells) && metrics.materialCells < minMaterialCells) status.failures.push(`guided material cells ${metrics.materialCells} below ${minMaterialCells}`);
    if (Number.isFinite(minHighIndexCells) && metrics.highIndexCells < minHighIndexCells) status.failures.push(`guided high-index cells ${metrics.highIndexCells} below ${minHighIndexCells}`);
    if (Number.isFinite(minLossyCells) && metrics.lossyCells < minLossyCells) status.failures.push(`guided lossy cells ${metrics.lossyCells} below ${minLossyCells}`);
    if (Number.isFinite(minPecCells) && metrics.pecCells < minPecCells) status.failures.push(`guided PEC cells ${metrics.pecCells} below ${minPecCells}`);
    if (Number.isFinite(minGuideBandCells) && metrics.guideBandHighIndexCells < minGuideBandCells) status.failures.push(`guide-band cells ${metrics.guideBandHighIndexCells} below ${minGuideBandCells}`);
    if (Number.isFinite(minColumns) && metrics.columnsWithHighIndex < minColumns) status.failures.push(`high-index columns ${metrics.columnsWithHighIndex} below ${minColumns}`);
    if (Number.isFinite(minMultiColumns) && metrics.columnsWithMultipleSegments < minMultiColumns) status.failures.push(`multi-segment guide columns ${metrics.columnsWithMultipleSegments} below ${minMultiColumns}`);
    if (Number.isFinite(minSegments) && metrics.maxSegmentsPerColumn < minSegments) status.failures.push(`max guide segments per column ${metrics.maxSegmentsPerColumn} below ${minSegments}`);
    if (Number.isFinite(minSegmentSeparation) && metrics.maxSegmentSeparationLambda < minSegmentSeparation) status.failures.push(`segment separation ${metrics.maxSegmentSeparationLambda} below ${minSegmentSeparation}`);
    if (Number.isFinite(minMaxSpan) && metrics.maxColumnSpanLambda < minMaxSpan) status.failures.push(`max column span ${metrics.maxColumnSpanLambda} below ${minMaxSpan}`);
    if (Number.isFinite(maxMaxSpan) && metrics.maxColumnSpanLambda > maxMaxSpan) status.failures.push(`max column span ${metrics.maxColumnSpanLambda} exceeds ${maxMaxSpan}`);
    if (Number.isFinite(minWidthRange) && metrics.widthRangeLambda < minWidthRange) status.failures.push(`guide width range ${metrics.widthRangeLambda} below ${minWidthRange}`);
    if (Number.isFinite(maxWidthRange) && metrics.widthRangeLambda > maxWidthRange) status.failures.push(`guide width range ${metrics.widthRangeLambda} exceeds ${maxWidthRange}`);
    if (Number.isFinite(minWidthJump) && metrics.maxAdjacentWidthJumpLambda < minWidthJump) status.failures.push(`guide width jump ${metrics.maxAdjacentWidthJumpLambda} below ${minWidthJump}`);
    if (Number.isFinite(maxWidthJump) && metrics.maxAdjacentWidthJumpLambda > maxWidthJump) status.failures.push(`guide width jump ${metrics.maxAdjacentWidthJumpLambda} exceeds ${maxWidthJump}`);
    if (Number.isFinite(minCentroidShift) && metrics.centroidShiftRangeLambda < minCentroidShift) status.failures.push(`guide centroid shift ${metrics.centroidShiftRangeLambda} below ${minCentroidShift}`);
    if (Number.isFinite(minUpperOffAxis) && metrics.upperOffAxisHighIndexCells < minUpperOffAxis) status.failures.push(`upper off-axis high-index cells ${metrics.upperOffAxisHighIndexCells} below ${minUpperOffAxis}`);
    if (Number.isFinite(minLowerOffAxis) && metrics.lowerOffAxisHighIndexCells < minLowerOffAxis) status.failures.push(`lower off-axis high-index cells ${metrics.lowerOffAxisHighIndexCells} below ${minLowerOffAxis}`);
    if (Number.isFinite(minStubCells) && metrics.stubHighIndexCells < minStubCells) status.failures.push(`stub high-index cells ${metrics.stubHighIndexCells} below ${minStubCells}`);
    if (Number.isFinite(minStubFraction) && metrics.stubEnergyFraction < minStubFraction) status.failures.push(`stub energy fraction ${metrics.stubEnergyFraction} below ${minStubFraction}`);
    if (Number.isFinite(minStubToGuide) && metrics.stubToGuideEnergyRatio < minStubToGuide) status.failures.push(`stub/guide energy ratio ${metrics.stubToGuideEnergyRatio} below ${minStubToGuide}`);
    if (Number.isFinite(minStubPecCells) && metrics.stubPecCells < minStubPecCells) status.failures.push(`stub PEC cells ${metrics.stubPecCells} below ${minStubPecCells}`);
    if (Number.isFinite(maxStubPecCells) && metrics.stubPecCells > maxStubPecCells) status.failures.push(`stub PEC cells ${metrics.stubPecCells} exceeds ${maxStubPecCells}`);
    if (Number.isFinite(minScattererCells) && metrics.offsetScattererHighIndexCells < minScattererCells) status.failures.push(`offset scatterer cells ${metrics.offsetScattererHighIndexCells} below ${minScattererCells}`);
    if (Number.isFinite(minCentralDiskCells) && metrics.centralDiskHighIndexCells < minCentralDiskCells) status.failures.push(`central disk high-index cells ${metrics.centralDiskHighIndexCells} below ${minCentralDiskCells}`);
    if (Number.isFinite(minCentralPecCells) && metrics.centralPecCells < minCentralPecCells) status.failures.push(`central PEC cells ${metrics.centralPecCells} below ${minCentralPecCells}`);
    if (Number.isFinite(minRingCells) && metrics.ringCells < minRingCells) status.failures.push(`guided ring cells ${metrics.ringCells} below ${minRingCells}`);
    if (Number.isFinite(minRacetrackCells) && metrics.racetrackRingCells < minRacetrackCells) status.failures.push(`racetrack ring cells ${metrics.racetrackRingCells} below ${minRacetrackCells}`);
    if (Number.isFinite(minBusCells) && metrics.busHighIndexCells < minBusCells) status.failures.push(`bus high-index cells ${metrics.busHighIndexCells} below ${minBusCells}`);
    if (Number.isFinite(minDropCells) && metrics.dropBusHighIndexCells < minDropCells) status.failures.push(`drop bus high-index cells ${metrics.dropBusHighIndexCells} below ${minDropCells}`);
    if (Number.isFinite(minHighIndexFraction) && metrics.highIndexEnergyFraction < minHighIndexFraction) status.failures.push(`guided high-index energy fraction ${metrics.highIndexEnergyFraction} below ${minHighIndexFraction}`);
    if (Number.isFinite(minGuideFraction) && metrics.guideBandEnergyFraction < minGuideFraction) status.failures.push(`guide-band energy fraction ${metrics.guideBandEnergyFraction} below ${minGuideFraction}`);
    if (Number.isFinite(minSourceFraction) && metrics.sourceOverlapEnergyFraction < minSourceFraction) status.failures.push(`guided source-overlap energy fraction ${metrics.sourceOverlapEnergyFraction} below ${minSourceFraction}`);
    if (Number.isFinite(minCentralDiskFraction) && metrics.centralDiskEnergyFraction < minCentralDiskFraction) status.failures.push(`central disk energy fraction ${metrics.centralDiskEnergyFraction} below ${minCentralDiskFraction}`);
    if (Number.isFinite(minRingFraction) && metrics.ringEnergyFraction < minRingFraction) status.failures.push(`guided ring energy fraction ${metrics.ringEnergyFraction} below ${minRingFraction}`);
    if (Number.isFinite(minRacetrackFraction) && metrics.racetrackRingEnergyFraction < minRacetrackFraction) status.failures.push(`racetrack ring energy fraction ${metrics.racetrackRingEnergyFraction} below ${minRacetrackFraction}`);
    if (Number.isFinite(minBeta) && !(Number.isFinite(metrics.beta) && metrics.beta >= minBeta)) status.failures.push(`guided-flux ratio ${metrics.beta} below ${minBeta}`);
    if (Number.isFinite(maxBeta) && !(Number.isFinite(metrics.beta) && metrics.beta <= maxBeta)) status.failures.push(`guided-flux ratio ${metrics.beta} exceeds ${maxBeta}`);
    if (Number.isFinite(minModeNeff) && !(Number.isFinite(metrics.modeEffectiveIndex) && metrics.modeEffectiveIndex >= minModeNeff)) {
      status.failures.push(`mode effective index ${metrics.modeEffectiveIndex} below ${minModeNeff}`);
    }
    if (Number.isFinite(minModeInputOverlap) && !(Number.isFinite(metrics.modeInputOverlap) && metrics.modeInputOverlap >= minModeInputOverlap)) {
      status.failures.push(`mode input overlap ${metrics.modeInputOverlap} below ${minModeInputOverlap}`);
    }
    if (Number.isFinite(minModeOutputOverlap) && !(Number.isFinite(metrics.modeOutputOverlap) && metrics.modeOutputOverlap >= minModeOutputOverlap)) {
      status.failures.push(`mode output overlap ${metrics.modeOutputOverlap} below ${minModeOutputOverlap}`);
    }
    if (
      Number.isFinite(maxModeRadiationFraction) &&
      !(Number.isFinite(metrics.modeRadiationFraction) && metrics.modeRadiationFraction <= maxModeRadiationFraction)
    ) {
      status.failures.push(`mode radiation fraction ${metrics.modeRadiationFraction} exceeds ${maxModeRadiationFraction}`);
    }
    if (
      requiresModalS &&
      !(Number.isFinite(metrics.modalS11Power) && Number.isFinite(metrics.modalS21Power) && Number.isFinite(metrics.modalSPowerResidual))
    ) {
      status.failures.push("modal S-parameter estimate is not finite");
    }
    if (
      Number.isFinite(maxModalReflectionProxy) &&
      !(Number.isFinite(metrics.modalReflectionProxy) && metrics.modalReflectionProxy <= maxModalReflectionProxy)
    ) {
      status.failures.push(`modal reflection proxy ${metrics.modalReflectionProxy} exceeds ${maxModalReflectionProxy}`);
    }
    if (Number.isFinite(minSplit) && !(Number.isFinite(metrics.split) && metrics.split >= minSplit)) status.failures.push(`mode/spectral split ${metrics.split} below ${minSplit}`);
    if (Number.isFinite(minSpectralSplit) && !(Number.isFinite(metrics.spectralSplit) && metrics.spectralSplit >= minSpectralSplit)) status.failures.push(`spectral split ${metrics.spectralSplit} below ${minSpectralSplit}`);
    if (Number.isFinite(minRingdownQ) && !(Number.isFinite(metrics.ringdownQ) && metrics.ringdownQ >= minRingdownQ)) status.failures.push(`ringdown Q ${metrics.ringdownQ} below ${minRingdownQ}`);
    if (Number.isFinite(minModeArea) && !(Number.isFinite(metrics.modeAreaLambda2) && metrics.modeAreaLambda2 >= minModeArea)) status.failures.push(`mode area ${metrics.modeAreaLambda2} below ${minModeArea}`);
    if (Number.isFinite(maxModeArea) && !(Number.isFinite(metrics.modeAreaLambda2) && metrics.modeAreaLambda2 <= maxModeArea)) status.failures.push(`mode area ${metrics.modeAreaLambda2} exceeds ${maxModeArea}`);
    if (Number.isFinite(minQAreaMetric) && !(Number.isFinite(metrics.qAreaMetric) && metrics.qAreaMetric >= minQAreaMetric)) status.failures.push(`Q/Aeff metric ${metrics.qAreaMetric} below ${minQAreaMetric}`);
    if (Number.isFinite(maxQAreaMetric) && !(Number.isFinite(metrics.qAreaMetric) && metrics.qAreaMetric <= maxQAreaMetric)) status.failures.push(`Q/Aeff metric ${metrics.qAreaMetric} exceeds ${maxQAreaMetric}`);
    if (Number.isFinite(minPurcellProxy) && !(Number.isFinite(metrics.purcellProxy) && metrics.purcellProxy >= minPurcellProxy)) status.failures.push(`legacy Q/Aeff metric ${metrics.purcellProxy} below ${minPurcellProxy}`);
    if (Number.isFinite(minAnalysisSamples) && metrics.analysisSamples < minAnalysisSamples) status.failures.push(`guided analysis samples ${metrics.analysisSamples} below ${minAnalysisSamples}`);
    if (Number.isFinite(minBoundsWidth) && (!metrics.materialBounds || metrics.materialBounds.widthLambda < minBoundsWidth)) {
      status.failures.push(`material width ${metrics.materialBounds?.widthLambda ?? 0} below ${minBoundsWidth}`);
    }
    if (Number.isFinite(minBoundsHeight) && (!metrics.materialBounds || metrics.materialBounds.heightLambda < minBoundsHeight)) {
      status.failures.push(`material height ${metrics.materialBounds?.heightLambda ?? 0} below ${minBoundsHeight}`);
    }
    if (Number.isFinite(minMziUpperArmCells) && metrics.mziUpperArmHighIndexCells < minMziUpperArmCells) {
      status.failures.push(`MZI upper-arm cells ${metrics.mziUpperArmHighIndexCells} below ${minMziUpperArmCells}`);
    }
    if (Number.isFinite(minMziLowerArmCells) && metrics.mziLowerArmHighIndexCells < minMziLowerArmCells) {
      status.failures.push(`MZI lower-arm cells ${metrics.mziLowerArmHighIndexCells} below ${minMziLowerArmCells}`);
    }
    if (Number.isFinite(minMziPhaseCells) && metrics.mziPhaseShifterCells < minMziPhaseCells) {
      status.failures.push(`MZI phase-shifter cells ${metrics.mziPhaseShifterCells} below ${minMziPhaseCells}`);
    }
    if (Number.isFinite(minMziSplitterFraction) && metrics.mziSplitterEnergyFraction < minMziSplitterFraction) {
      status.failures.push(`MZI splitter energy fraction ${metrics.mziSplitterEnergyFraction} below ${minMziSplitterFraction}`);
    }
    if (Number.isFinite(minMziArmFraction) && metrics.mziArmEnergyFraction < minMziArmFraction) {
      status.failures.push(`MZI arm energy fraction ${metrics.mziArmEnergyFraction} below ${minMziArmFraction}`);
    }
    if (Number.isFinite(maxMziArmBalance) && !(Number.isFinite(metrics.mziArmEnergyBalance) && metrics.mziArmEnergyBalance <= maxMziArmBalance)) {
      status.failures.push(`MZI arm energy balance ${metrics.mziArmEnergyBalance} exceeds ${maxMziArmBalance}`);
    }
    if (Number.isFinite(minMziPhaseFraction) && metrics.mziPhaseShifterEnergyFraction < minMziPhaseFraction) {
      status.failures.push(`MZI phase-shifter energy fraction ${metrics.mziPhaseShifterEnergyFraction} below ${minMziPhaseFraction}`);
    }
    if (Number.isFinite(minMziCombinerFraction) && metrics.mziCombinerEnergyFraction < minMziCombinerFraction) {
      status.failures.push(`MZI combiner energy fraction ${metrics.mziCombinerEnergyFraction} below ${minMziCombinerFraction}`);
    }
    if (Number.isFinite(minMziOutputFraction) && metrics.mziOutputGuideEnergyFraction < minMziOutputFraction) {
      status.failures.push(`MZI output-guide energy fraction ${metrics.mziOutputGuideEnergyFraction} below ${minMziOutputFraction}`);
    }
    if (Number.isFinite(maxMziInputFraction) && metrics.mziInputGuideEnergyFraction > maxMziInputFraction) {
      status.failures.push(`MZI input-guide energy fraction ${metrics.mziInputGuideEnergyFraction} exceeds ${maxMziInputFraction}`);
    }
  }
  if (testCase.acceptance?.periodicPhotonicsCheck) {
    status.periodicPhotonics = await periodicPhotonicsMetrics(page);
    const metrics = status.periodicPhotonics;
    const expectedSweepMode = testCase.acceptance?.sweepMode;
    const minHighIndexCells = Number(testCase.acceptance?.highIndexCellsMin);
    const minRodCount = Number(testCase.acceptance?.rodCountProxyMin);
    const maxRodCount = Number(testCase.acceptance?.rodCountProxyMax);
    const minRows = Number(testCase.acceptance?.rowsProxyMin);
    const minCols = Number(testCase.acceptance?.colsProxyMin);
    const maxCenterBinCells = Number(testCase.acceptance?.centerBinHighIndexCellsMax);
    const minCenterBinCells = Number(testCase.acceptance?.centerBinHighIndexCellsMin);
    const minCenterDefectFraction = Number(testCase.acceptance?.centerDefectEnergyFractionMin);
    const minCentralVacancies = Number(testCase.acceptance?.centralVacancyBins3Min);
    const maxLineRowBins = Number(testCase.acceptance?.lineRowBinCountMax);
    const minLineRowBins = Number(testCase.acceptance?.lineRowBinCountMin);
    const maxCentralLineCells = Number(testCase.acceptance?.centralLineHighIndexCellsMax);
    const minAdjacentLineCells = Number(testCase.acceptance?.adjacentRowHighIndexCellsMin);
    const maxCavityHighIndexCells = Number(testCase.acceptance?.cavityHighIndexCellsMax);
    const minCavityFraction = Number(testCase.acceptance?.cavityEnergyFractionMin);
    const minLineFraction = Number(testCase.acceptance?.lineDefectEnergyFractionMin);
    const minLineRightFraction = Number(testCase.acceptance?.lineRightEnergyFractionMin);
    const minLineRightToSourceRatio = Number(testCase.acceptance?.lineRightToSourceEnergyRatioMin);
    const minLineRightToLeftRatio = Number(testCase.acceptance?.lineRightToLeftEnergyRatioMin);
    const maxAdjacentToLineRatio = Number(testCase.acceptance?.adjacentToLineEnergyRatioMax);
    const minOffsetMean = Number(testCase.acceptance?.latticeOffsetMeanLambdaMin);
    const maxOffsetMean = Number(testCase.acceptance?.latticeOffsetMeanLambdaMax);
    const minOffsetMax = Number(testCase.acceptance?.latticeOffsetMaxLambdaMin);
    const maxOffsetMax = Number(testCase.acceptance?.latticeOffsetMaxLambdaMax);
    const minAnalysisSamples = Number(testCase.acceptance?.minAnalysisSamples);
    const maxLeakageRate = Number(testCase.acceptance?.leakageRateMax);
    const minSourceCount = Number(testCase.acceptance?.sourceCountMin);
    const minSourcePhaseDifference = Number(testCase.acceptance?.sourcePhaseDifferenceDegMin);
    const maxSourcePhaseDifference = Number(testCase.acceptance?.sourcePhaseDifferenceDegMax);
    const minSourceAmplitudeRatio = Number(testCase.acceptance?.sourceAmplitudeRatioMin);
    const maxSourceAmplitudeRatio = Number(testCase.acceptance?.sourceAmplitudeRatioMax);
    const minFanoBusCells = Number(testCase.acceptance?.fanoBusHighIndexCellsMin);
    const minFanoResonatorCells = Number(testCase.acceptance?.fanoResonatorHighIndexCellsMin);
    const maxFanoGapCells = Number(testCase.acceptance?.fanoGapHighIndexCellsMax);
    const minFanoResonatorEnergy = Number(testCase.acceptance?.fanoResonatorEnergyMin);
    const minFanoResonatorFraction = Number(testCase.acceptance?.fanoResonatorEnergyFractionMin);
    const minFanoTemporalSamples = Number(testCase.acceptance?.fanoTemporalSamplesMin);
    const minFanoTemporalEnergy = Number(testCase.acceptance?.fanoTemporalResonatorEnergyPeakMin);
    const minFanoTemporalFraction = Number(testCase.acceptance?.fanoTemporalResonatorPeakFractionMin);
    const minFanoTemporalRatio = Number(testCase.acceptance?.fanoTemporalResonatorToBusPeakRatioMin);
    if (expectedSweepMode && metrics.sweepMode !== expectedSweepMode) {
      status.failures.push(`expected ${expectedSweepMode} sweep, got ${metrics.sweepMode}`);
    }
    if (testCase.acceptance?.sourceShape && !metrics.sourceShapes.includes(testCase.acceptance.sourceShape)) {
      status.failures.push(`expected source shape ${testCase.acceptance.sourceShape}, got ${metrics.sourceShapes.join(",") || "none"}`);
    }
    if (Number.isFinite(minHighIndexCells) && metrics.highIndexCells < minHighIndexCells) {
      status.failures.push(`periodic high-index cells ${metrics.highIndexCells} below ${minHighIndexCells}`);
    }
    if (Number.isFinite(minRodCount) && metrics.rodCountProxy < minRodCount) {
      status.failures.push(`periodic rod-count proxy ${metrics.rodCountProxy} below ${minRodCount}`);
    }
    if (Number.isFinite(maxRodCount) && metrics.rodCountProxy > maxRodCount) {
      status.failures.push(`periodic rod-count proxy ${metrics.rodCountProxy} exceeds ${maxRodCount}`);
    }
    if (Number.isFinite(minRows) && metrics.rowsProxy < minRows) {
      status.failures.push(`periodic row-count proxy ${metrics.rowsProxy} below ${minRows}`);
    }
    if (Number.isFinite(minCols) && metrics.colsProxy < minCols) {
      status.failures.push(`periodic column-count proxy ${metrics.colsProxy} below ${minCols}`);
    }
    if (Number.isFinite(maxCenterBinCells) && metrics.centerBinHighIndexCells > maxCenterBinCells) {
      status.failures.push(`central high-index bin has ${metrics.centerBinHighIndexCells} cells, expected at most ${maxCenterBinCells}`);
    }
    if (Number.isFinite(minCenterBinCells) && metrics.centerBinHighIndexCells < minCenterBinCells) {
      status.failures.push(`central high-index bin has ${metrics.centerBinHighIndexCells} cells, expected at least ${minCenterBinCells}`);
    }
    if (Number.isFinite(minCentralVacancies) && metrics.centralVacancyBins3 < minCentralVacancies) {
      status.failures.push(`central-line vacancy count ${metrics.centralVacancyBins3} below ${minCentralVacancies}`);
    }
    if (Number.isFinite(minCenterDefectFraction) && metrics.centerDefectEnergyFraction < minCenterDefectFraction) {
      status.failures.push(`center-defect energy fraction ${metrics.centerDefectEnergyFraction} below ${minCenterDefectFraction}`);
    }
    if (Number.isFinite(maxLineRowBins) && metrics.lineRowBinCount > maxLineRowBins) {
      status.failures.push(`line-defect row has ${metrics.lineRowBinCount} high-index bins, expected at most ${maxLineRowBins}`);
    }
    if (Number.isFinite(minLineRowBins) && metrics.lineRowBinCount < minLineRowBins) {
      status.failures.push(`line-defect row has ${metrics.lineRowBinCount} high-index bins, expected at least ${minLineRowBins}`);
    }
    if (Number.isFinite(maxCentralLineCells) && metrics.centralLineHighIndexCells > maxCentralLineCells) {
      status.failures.push(`central line has ${metrics.centralLineHighIndexCells} high-index cells, expected at most ${maxCentralLineCells}`);
    }
    if (Number.isFinite(minAdjacentLineCells) && metrics.adjacentRowHighIndexCells < minAdjacentLineCells) {
      status.failures.push(`adjacent PhC rows have ${metrics.adjacentRowHighIndexCells} high-index cells, expected at least ${minAdjacentLineCells}`);
    }
    if (Number.isFinite(maxCavityHighIndexCells) && metrics.cavityHighIndexCells > maxCavityHighIndexCells) {
      status.failures.push(`PhC cavity window has ${metrics.cavityHighIndexCells} high-index cells, expected at most ${maxCavityHighIndexCells}`);
    }
    if (Number.isFinite(minCavityFraction) && metrics.cavityEnergyFraction < minCavityFraction) {
      status.failures.push(`PhC cavity energy fraction ${metrics.cavityEnergyFraction} below ${minCavityFraction}`);
    }
    if (Number.isFinite(minLineFraction) && metrics.lineDefectEnergyFraction < minLineFraction) {
      status.failures.push(`line-defect energy fraction ${metrics.lineDefectEnergyFraction} below ${minLineFraction}`);
    }
    if (Number.isFinite(minLineRightFraction) && metrics.lineRightEnergyFraction < minLineRightFraction) {
      status.failures.push(`line-defect downstream energy fraction ${metrics.lineRightEnergyFraction} below ${minLineRightFraction}`);
    }
    if (
      Number.isFinite(minLineRightToSourceRatio) &&
      !(Number.isFinite(metrics.lineRightToSourceEnergyRatio) && metrics.lineRightToSourceEnergyRatio >= minLineRightToSourceRatio)
    ) {
      status.failures.push(
        `line-defect downstream/source energy ratio ${metrics.lineRightToSourceEnergyRatio} below ${minLineRightToSourceRatio}`,
      );
    }
    if (
      Number.isFinite(minLineRightToLeftRatio) &&
      !(Number.isFinite(metrics.lineRightToLeftEnergyRatio) && metrics.lineRightToLeftEnergyRatio >= minLineRightToLeftRatio)
    ) {
      status.failures.push(
        `line-defect downstream/upstream energy ratio ${metrics.lineRightToLeftEnergyRatio} below ${minLineRightToLeftRatio}`,
      );
    }
    if (
      Number.isFinite(maxAdjacentToLineRatio) &&
      !(Number.isFinite(metrics.adjacentToLineEnergyRatio) && metrics.adjacentToLineEnergyRatio <= maxAdjacentToLineRatio)
    ) {
      status.failures.push(`adjacent-to-line energy ratio ${metrics.adjacentToLineEnergyRatio} exceeds ${maxAdjacentToLineRatio}`);
    }
    if (Number.isFinite(minOffsetMean) && metrics.latticeOffsetMeanLambda < minOffsetMean) {
      status.failures.push(`lattice offset mean ${metrics.latticeOffsetMeanLambda} below ${minOffsetMean}`);
    }
    if (Number.isFinite(maxOffsetMean) && metrics.latticeOffsetMeanLambda > maxOffsetMean) {
      status.failures.push(`lattice offset mean ${metrics.latticeOffsetMeanLambda} exceeds ${maxOffsetMean}`);
    }
    if (Number.isFinite(minOffsetMax) && metrics.latticeOffsetMaxLambda < minOffsetMax) {
      status.failures.push(`lattice offset max ${metrics.latticeOffsetMaxLambda} below ${minOffsetMax}`);
    }
    if (Number.isFinite(maxOffsetMax) && metrics.latticeOffsetMaxLambda > maxOffsetMax) {
      status.failures.push(`lattice offset max ${metrics.latticeOffsetMaxLambda} exceeds ${maxOffsetMax}`);
    }
    if (Number.isFinite(minAnalysisSamples) && metrics.analysisSamples < minAnalysisSamples) {
      status.failures.push(`periodic/BIC analysis has ${metrics.analysisSamples} samples, expected at least ${minAnalysisSamples}`);
    }
    if (Number.isFinite(maxLeakageRate) && !(Number.isFinite(metrics.leakageRate) && metrics.leakageRate <= maxLeakageRate)) {
      status.failures.push(`BIC leakage rate ${metrics.leakageRate} exceeds ${maxLeakageRate}`);
    }
    if (Number.isFinite(minSourceCount) && metrics.sourceCount < minSourceCount) {
      status.failures.push(`source count ${metrics.sourceCount} below ${minSourceCount}`);
    }
    if (
      Number.isFinite(minSourcePhaseDifference) &&
      !(Number.isFinite(metrics.sourcePhaseDifferenceDeg) && metrics.sourcePhaseDifferenceDeg >= minSourcePhaseDifference)
    ) {
      status.failures.push(`source phase difference ${metrics.sourcePhaseDifferenceDeg} below ${minSourcePhaseDifference} deg`);
    }
    if (
      Number.isFinite(maxSourcePhaseDifference) &&
      !(Number.isFinite(metrics.sourcePhaseDifferenceDeg) && metrics.sourcePhaseDifferenceDeg <= maxSourcePhaseDifference)
    ) {
      status.failures.push(`source phase difference ${metrics.sourcePhaseDifferenceDeg} exceeds ${maxSourcePhaseDifference} deg`);
    }
    if (
      Number.isFinite(minSourceAmplitudeRatio) &&
      !(Number.isFinite(metrics.sourceAmplitudeRatio) && metrics.sourceAmplitudeRatio >= minSourceAmplitudeRatio)
    ) {
      status.failures.push(`source amplitude ratio ${metrics.sourceAmplitudeRatio} below ${minSourceAmplitudeRatio}`);
    }
    if (
      Number.isFinite(maxSourceAmplitudeRatio) &&
      !(Number.isFinite(metrics.sourceAmplitudeRatio) && metrics.sourceAmplitudeRatio <= maxSourceAmplitudeRatio)
    ) {
      status.failures.push(`source amplitude ratio ${metrics.sourceAmplitudeRatio} exceeds ${maxSourceAmplitudeRatio}`);
    }
    if (testCase.acceptance?.phcBlochRequired && !metrics.phcBloch) {
      status.failures.push("PhC Bloch reduced estimate is missing");
    }
    if (metrics.phcBloch) {
      const minBlochCells = Number(testCase.acceptance?.phcBlochCellsMin);
      const minStructureFactor = Number(testCase.acceptance?.structureFactorMin);
      const maxAsymmetry = Number(testCase.acceptance?.phcAsymmetryMax);
      const minAsymmetry = Number(testCase.acceptance?.phcAsymmetryMin);
      const minQProxy = Number(testCase.acceptance?.qProxyMin);
      const maxQProxy = Number(testCase.acceptance?.qProxyMax);
      const minBandGap = Number(testCase.acceptance?.bandGapMin);
      const minGapRatio = Number(testCase.acceptance?.gapRatioMin);
      const minPathPoints = Number(testCase.acceptance?.blochPathPointsMin);
      if (Number.isFinite(minBlochCells) && metrics.phcBloch.cells < minBlochCells) {
        status.failures.push(`PhC Bloch cell count ${metrics.phcBloch.cells} below ${minBlochCells}`);
      }
      if (Number.isFinite(minStructureFactor) && metrics.phcBloch.structureFactor < minStructureFactor) {
        status.failures.push(`PhC structure factor ${metrics.phcBloch.structureFactor} below ${minStructureFactor}`);
      }
      if (Number.isFinite(maxAsymmetry) && metrics.phcBloch.asymmetry > maxAsymmetry) {
        status.failures.push(`PhC asymmetry ${metrics.phcBloch.asymmetry} exceeds ${maxAsymmetry}`);
      }
      if (Number.isFinite(minAsymmetry) && metrics.phcBloch.asymmetry < minAsymmetry) {
        status.failures.push(`PhC asymmetry ${metrics.phcBloch.asymmetry} below ${minAsymmetry}`);
      }
      if (Number.isFinite(minQProxy) && metrics.phcBloch.qProxy < minQProxy) {
        status.failures.push(`PhC Q proxy ${metrics.phcBloch.qProxy} below ${minQProxy}`);
      }
      if (Number.isFinite(maxQProxy) && metrics.phcBloch.qProxy > maxQProxy) {
        status.failures.push(`PhC Q proxy ${metrics.phcBloch.qProxy} exceeds ${maxQProxy}`);
      }
      if (Number.isFinite(minBandGap) && !(metrics.phcBloch.modal?.bandGap > minBandGap)) {
        status.failures.push(`PhC PWE band gap ${metrics.phcBloch.modal?.bandGap} below ${minBandGap}`);
      }
      if (Number.isFinite(minGapRatio) && !(metrics.phcBloch.modal?.gapRatio > minGapRatio)) {
        status.failures.push(`PhC PWE gap ratio ${metrics.phcBloch.modal?.gapRatio} below ${minGapRatio}`);
      }
      if (Number.isFinite(minPathPoints) && !(metrics.phcBloch.modal?.path?.pointCount >= minPathPoints)) {
        status.failures.push(`PhC Bloch path has ${metrics.phcBloch.modal?.path?.pointCount} points, expected at least ${minPathPoints}`);
      }
    }
    if (Number.isFinite(minFanoBusCells) && metrics.fanoBusHighIndexCells < minFanoBusCells) {
      status.failures.push(`Fano bus cells ${metrics.fanoBusHighIndexCells} below ${minFanoBusCells}`);
    }
    if (Number.isFinite(minFanoResonatorCells) && metrics.fanoResonatorHighIndexCells < minFanoResonatorCells) {
      status.failures.push(`Fano side-resonator cells ${metrics.fanoResonatorHighIndexCells} below ${minFanoResonatorCells}`);
    }
    if (Number.isFinite(maxFanoGapCells) && metrics.fanoGapHighIndexCells > maxFanoGapCells) {
      status.failures.push(`Fano bus-resonator gap has ${metrics.fanoGapHighIndexCells} high-index cells, expected at most ${maxFanoGapCells}`);
    }
    if (Number.isFinite(minFanoResonatorEnergy) && metrics.fanoResonatorEnergy < minFanoResonatorEnergy) {
      status.failures.push(`Fano side-resonator energy ${metrics.fanoResonatorEnergy} below ${minFanoResonatorEnergy}`);
    }
    if (Number.isFinite(minFanoResonatorFraction) && metrics.fanoResonatorEnergyFraction < minFanoResonatorFraction) {
      status.failures.push(`Fano side-resonator energy fraction ${metrics.fanoResonatorEnergyFraction} below ${minFanoResonatorFraction}`);
    }
    if (testCase.acceptance?.fanoTemporalCheck) {
      status.fanoTemporal = stepResult.fanoTemporal;
      if (!status.fanoTemporal) {
        status.failures.push("Fano temporal monitor was not collected");
      } else {
        if (Number.isFinite(minFanoTemporalSamples) && status.fanoTemporal.samples < minFanoTemporalSamples) {
          status.failures.push(`Fano temporal samples ${status.fanoTemporal.samples} below ${minFanoTemporalSamples}`);
        }
        if (Number.isFinite(minFanoTemporalEnergy) && status.fanoTemporal.resonatorEnergyPeak < minFanoTemporalEnergy) {
          status.failures.push(`Fano temporal resonator peak ${status.fanoTemporal.resonatorEnergyPeak} below ${minFanoTemporalEnergy}`);
        }
        if (Number.isFinite(minFanoTemporalFraction) && status.fanoTemporal.resonatorPeakFraction < minFanoTemporalFraction) {
          status.failures.push(`Fano temporal resonator fraction ${status.fanoTemporal.resonatorPeakFraction} below ${minFanoTemporalFraction}`);
        }
        if (Number.isFinite(minFanoTemporalRatio) && status.fanoTemporal.resonatorToBusPeakRatio < minFanoTemporalRatio) {
          status.failures.push(`Fano temporal resonator/bus ratio ${status.fanoTemporal.resonatorToBusPeakRatio} below ${minFanoTemporalRatio}`);
        }
      }
    }
  }
  if (testCase.acceptance?.topologicalPhotonicsCheck) {
    status.topologicalPhotonics = await topologicalPhotonicsMetrics(page);
    const metrics = status.topologicalPhotonics;
    const minHighIndexCells = Number(testCase.acceptance?.highIndexCellsMin);
    const minSiteCount = Number(testCase.acceptance?.siteCountProxyMin);
    const maxSiteCount = Number(testCase.acceptance?.siteCountProxyMax);
    const minGapContrast = Number(testCase.acceptance?.gapContrastLambdaMin);
    const firstGapMin = Number(testCase.acceptance?.firstGapLambdaMin);
    const firstGapMax = Number(testCase.acceptance?.firstGapLambdaMax);
    const secondGapMin = Number(testCase.acceptance?.secondGapLambdaMin);
    const secondGapMax = Number(testCase.acceptance?.secondGapLambdaMax);
    const expectedWinding = Number(testCase.acceptance?.sshWinding);
    const minBandGap = Number(testCase.acceptance?.sshBandGapMin);
    const minNhGap = Number(testCase.acceptance?.sshNonHermitianGapMin);
    const minAnalysisSamples = Number(testCase.acceptance?.minAnalysisSamples);
    const minGainCells = Number(testCase.acceptance?.gainCellsMin);
    const minLossyCells = Number(testCase.acceptance?.lossyCellsMin);
    const minModulatedCells = Number(testCase.acceptance?.modulatedCellsMin);
    const minModulationDepth = Number(testCase.acceptance?.modulationDepthMin);
    const minHoneycombCells = Number(testCase.acceptance?.honeycombCellProxyMin);
    const minHoneycombSubBins = Number(testCase.acceptance?.honeycombSubBinProxyMin);
    const minTopBias = Number(testCase.acceptance?.topSublatticeBiasMin);
    const maxTopBias = Number(testCase.acceptance?.topSublatticeBiasMax);
    const minBottomBias = Number(testCase.acceptance?.bottomSublatticeBiasMin);
    const maxBottomBias = Number(testCase.acceptance?.bottomSublatticeBiasMax);
    const minLeftTopBias = Number(testCase.acceptance?.leftTopSublatticeBiasMin);
    const maxLeftBottomBias = Number(testCase.acceptance?.leftBottomSublatticeBiasMax);
    const minRightTopBias = Number(testCase.acceptance?.rightTopSublatticeBiasMin);
    const maxRightTopBias = Number(testCase.acceptance?.rightTopSublatticeBiasMax);
    const maxRightBottomBias = Number(testCase.acceptance?.rightBottomSublatticeBiasMax);
    const minInterfaceFraction = Number(testCase.acceptance?.interfaceEnergyFractionMin);
    const minBendFraction = Number(testCase.acceptance?.bendChannelEnergyFractionMin);
    const minDefectPecCells = Number(testCase.acceptance?.defectPecCellsMin);
    const maxDefectHighIndexCells = Number(testCase.acceptance?.defectHighIndexCellsMax);
    const minSourceFraction = Number(testCase.acceptance?.sourceEnergyFractionMin);
    if (Number.isFinite(minHighIndexCells) && metrics.highIndexCells < minHighIndexCells) {
      status.failures.push(`topological high-index cells ${metrics.highIndexCells} below ${minHighIndexCells}`);
    }
    if (Number.isFinite(minSiteCount) && metrics.siteCountProxy < minSiteCount) {
      status.failures.push(`SSH site-count proxy ${metrics.siteCountProxy} below ${minSiteCount}`);
    }
    if (Number.isFinite(maxSiteCount) && metrics.siteCountProxy > maxSiteCount) {
      status.failures.push(`SSH site-count proxy ${metrics.siteCountProxy} exceeds ${maxSiteCount}`);
    }
    if (Number.isFinite(minGapContrast) && metrics.gapContrastLambda < minGapContrast) {
      status.failures.push(`SSH alternating-gap contrast ${metrics.gapContrastLambda} below ${minGapContrast}`);
    }
    if (Number.isFinite(firstGapMin) && !(metrics.firstGapLambda >= firstGapMin)) {
      status.failures.push(`first SSH gap ${metrics.firstGapLambda} below ${firstGapMin}`);
    }
    if (Number.isFinite(firstGapMax) && !(metrics.firstGapLambda <= firstGapMax)) {
      status.failures.push(`first SSH gap ${metrics.firstGapLambda} exceeds ${firstGapMax}`);
    }
    if (Number.isFinite(secondGapMin) && !(metrics.secondGapLambda >= secondGapMin)) {
      status.failures.push(`second SSH gap ${metrics.secondGapLambda} below ${secondGapMin}`);
    }
    if (Number.isFinite(secondGapMax) && !(metrics.secondGapLambda <= secondGapMax)) {
      status.failures.push(`second SSH gap ${metrics.secondGapLambda} exceeds ${secondGapMax}`);
    }
    if (testCase.acceptance?.sshBlochRequired && !metrics.sshBloch) {
      status.failures.push("SSH Bloch reduced estimate is missing");
    }
    if (metrics.sshBloch) {
      if (Number.isFinite(expectedWinding) && metrics.sshBloch.winding !== expectedWinding) {
        status.failures.push(`SSH winding ${metrics.sshBloch.winding} differs from expected ${expectedWinding}`);
      }
      if (testCase.acceptance?.sshEdgeExpected === true && !metrics.sshBloch.edgeExpected) {
        status.failures.push("SSH edge-state proxy is not enabled for an interface scene");
      }
      if (testCase.acceptance?.sshEdgeExpected === false && metrics.sshBloch.edgeExpected) {
        status.failures.push("SSH edge-state proxy is unexpectedly enabled");
      }
      if (Number.isFinite(minBandGap) && metrics.sshBloch.bandGap < minBandGap) {
        status.failures.push(`SSH band-gap proxy ${metrics.sshBloch.bandGap} below ${minBandGap}`);
      }
      if (Number.isFinite(minNhGap) && metrics.sshBloch.nonHermitianGap < minNhGap) {
        status.failures.push(`non-Hermitian SSH gap proxy ${metrics.sshBloch.nonHermitianGap} below ${minNhGap}`);
      }
    }
    if (Number.isFinite(minAnalysisSamples) && metrics.analysisSamples < minAnalysisSamples) {
      status.failures.push(`topological analysis has ${metrics.analysisSamples} samples, expected at least ${minAnalysisSamples}`);
    }
    if (Number.isFinite(minGainCells) && metrics.gainCells < minGainCells) {
      status.failures.push(`gain cells ${metrics.gainCells} below ${minGainCells}`);
    }
    if (Number.isFinite(minLossyCells) && metrics.lossyCells < minLossyCells) {
      status.failures.push(`loss cells ${metrics.lossyCells} below ${minLossyCells}`);
    }
    if (Number.isFinite(minModulatedCells) && metrics.modulatedCells < minModulatedCells) {
      status.failures.push(`modulated cells ${metrics.modulatedCells} below ${minModulatedCells}`);
    }
    if (Number.isFinite(minModulationDepth) && metrics.modulationDepth < minModulationDepth) {
      status.failures.push(`modulation depth ${metrics.modulationDepth} below ${minModulationDepth}`);
    }
    if (Number.isFinite(minHoneycombCells) && metrics.honeycombCellProxy < minHoneycombCells) {
      status.failures.push(`honeycomb cell proxy ${metrics.honeycombCellProxy} below ${minHoneycombCells}`);
    }
    if (Number.isFinite(minHoneycombSubBins) && metrics.honeycombSubBinProxy < minHoneycombSubBins) {
      status.failures.push(`honeycomb sublattice-bin proxy ${metrics.honeycombSubBinProxy} below ${minHoneycombSubBins}`);
    }
    if (Number.isFinite(minTopBias) && metrics.topSublatticeBias < minTopBias) {
      status.failures.push(`top sublattice bias ${metrics.topSublatticeBias} below ${minTopBias}`);
    }
    if (Number.isFinite(maxTopBias) && metrics.topSublatticeBias > maxTopBias) {
      status.failures.push(`top sublattice bias ${metrics.topSublatticeBias} exceeds ${maxTopBias}`);
    }
    if (Number.isFinite(minBottomBias) && metrics.bottomSublatticeBias < minBottomBias) {
      status.failures.push(`bottom sublattice bias ${metrics.bottomSublatticeBias} below ${minBottomBias}`);
    }
    if (Number.isFinite(maxBottomBias) && metrics.bottomSublatticeBias > maxBottomBias) {
      status.failures.push(`bottom sublattice bias ${metrics.bottomSublatticeBias} exceeds ${maxBottomBias}`);
    }
    if (Number.isFinite(minLeftTopBias) && metrics.leftTopSublatticeBias < minLeftTopBias) {
      status.failures.push(`left-top sublattice bias ${metrics.leftTopSublatticeBias} below ${minLeftTopBias}`);
    }
    if (Number.isFinite(maxLeftBottomBias) && metrics.leftBottomSublatticeBias > maxLeftBottomBias) {
      status.failures.push(`left-bottom sublattice bias ${metrics.leftBottomSublatticeBias} exceeds ${maxLeftBottomBias}`);
    }
    if (Number.isFinite(minRightTopBias) && metrics.rightTopSublatticeBias < minRightTopBias) {
      status.failures.push(`right-top sublattice bias ${metrics.rightTopSublatticeBias} below ${minRightTopBias}`);
    }
    if (Number.isFinite(maxRightTopBias) && metrics.rightTopSublatticeBias > maxRightTopBias) {
      status.failures.push(`right-top sublattice bias ${metrics.rightTopSublatticeBias} exceeds ${maxRightTopBias}`);
    }
    if (Number.isFinite(maxRightBottomBias) && metrics.rightBottomSublatticeBias > maxRightBottomBias) {
      status.failures.push(`right-bottom sublattice bias ${metrics.rightBottomSublatticeBias} exceeds ${maxRightBottomBias}`);
    }
    if (Number.isFinite(minInterfaceFraction) && metrics.interfaceEnergyFraction < minInterfaceFraction) {
      status.failures.push(`interface-channel energy fraction ${metrics.interfaceEnergyFraction} below ${minInterfaceFraction}`);
    }
    if (Number.isFinite(minBendFraction) && metrics.bendChannelEnergyFraction < minBendFraction) {
      status.failures.push(`bend-channel energy fraction ${metrics.bendChannelEnergyFraction} below ${minBendFraction}`);
    }
    if (Number.isFinite(minDefectPecCells) && metrics.defectPecCells < minDefectPecCells) {
      status.failures.push(`topological defect PEC cells ${metrics.defectPecCells} below ${minDefectPecCells}`);
    }
    if (Number.isFinite(maxDefectHighIndexCells) && metrics.defectHighIndexCells > maxDefectHighIndexCells) {
      status.failures.push(`topological defect high-index cells ${metrics.defectHighIndexCells} exceeds ${maxDefectHighIndexCells}`);
    }
    if (Number.isFinite(minSourceFraction) && metrics.sourceEnergyFraction < minSourceFraction) {
      status.failures.push(`source-region energy fraction ${metrics.sourceEnergyFraction} below ${minSourceFraction}`);
    }
  }
  if (
    testCase.id === "quarter_wave_coating_low_reflection" ||
    testCase.id === "bragg_mirror_stopband_reflection" ||
    testCase.id === "bragg_stack_periodic_layers"
  ) {
    status.layeredOptics = await layeredOpticsMetrics(page);
    const minSamples = Number(testCase.acceptance?.minDiagnosticSamples);
    const minLayers = Number(testCase.acceptance?.layerCountMin);
    const minReflectance = Number(testCase.acceptance?.reflectanceMin);
    const maxReflectance = Number(testCase.acceptance?.reflectanceMax);
    const minStackFraction = Number(testCase.acceptance?.stackEnergyFractionMin);
    const maxRightToStack = Number(testCase.acceptance?.rightToStackEnergyRatioMax);
    if (Number.isFinite(minSamples) && status.layeredOptics.diagnosticSamples < minSamples) {
      status.failures.push(`layered-optics diagnostics have ${status.layeredOptics.diagnosticSamples} samples, expected at least ${minSamples}`);
    }
    if (Number.isFinite(minLayers) && status.layeredOptics.layerCount < minLayers) {
      status.failures.push(`layered structure has ${status.layeredOptics.layerCount} material segments, expected at least ${minLayers}`);
    }
    if (Number.isFinite(minReflectance) && status.layeredOptics.reflectance < minReflectance) {
      status.failures.push(`reflectance ${status.layeredOptics.reflectance} is below ${minReflectance}`);
    }
    if (Number.isFinite(maxReflectance) && status.layeredOptics.reflectance > maxReflectance) {
      status.failures.push(`reflectance ${status.layeredOptics.reflectance} exceeds ${maxReflectance}`);
    }
    if (Number.isFinite(minStackFraction) && status.layeredOptics.stackEnergyFraction < minStackFraction) {
      status.failures.push(`stack energy fraction ${status.layeredOptics.stackEnergyFraction} is below ${minStackFraction}`);
    }
    if (Number.isFinite(maxRightToStack) && status.layeredOptics.rightToStackEnergyRatio > maxRightToStack) {
      status.failures.push(`right/stack energy ratio ${status.layeredOptics.rightToStackEnergyRatio} exceeds ${maxRightToStack}`);
    }
  }
  if (testCase.id === "total_internal_reflection_evanescent" || testCase.id === "frustrated_tir_tunneling") {
    status.tir = await tirEnergyMetrics(page);
    const minInterfaceEnergy = Number(testCase.acceptance?.interfaceEnergyMin);
    const maxFarRatio = Number(testCase.acceptance?.transmittedFarRatioMax);
    const minFarRatio = Number(testCase.acceptance?.transmittedFarRatioMin);
    const minRightHighIndexCells = Number(testCase.acceptance?.rightHighIndexCellsMin);
    const maxRightHighIndexCells = Number(testCase.acceptance?.rightHighIndexCellsMax);
    const minAirGapLambda = Number(testCase.acceptance?.airGapLambdaMin);
    const maxAirGapLambda = Number(testCase.acceptance?.airGapLambdaMax);
    if (Number.isFinite(minInterfaceEnergy) && status.tir.interfaceEnergy < minInterfaceEnergy) {
      status.failures.push(`TIR interface energy ${status.tir.interfaceEnergy} is below ${minInterfaceEnergy}`);
    }
    if (Number.isFinite(maxFarRatio) && status.tir.transmittedFarRatio > maxFarRatio) {
      status.failures.push(`TIR far-side energy ratio ${status.tir.transmittedFarRatio} exceeds ${maxFarRatio}`);
    }
    if (Number.isFinite(minFarRatio) && status.tir.transmittedFarRatio < minFarRatio) {
      status.failures.push(`frustrated-TIR far-side energy ratio ${status.tir.transmittedFarRatio} is below ${minFarRatio}`);
    }
    if (Number.isFinite(minRightHighIndexCells) && status.tir.rightHighIndexCells < minRightHighIndexCells) {
      status.failures.push(`right-side high-index cells ${status.tir.rightHighIndexCells} below ${minRightHighIndexCells}`);
    }
    if (Number.isFinite(maxRightHighIndexCells) && status.tir.rightHighIndexCells > maxRightHighIndexCells) {
      status.failures.push(`right-side high-index cells ${status.tir.rightHighIndexCells} exceed ${maxRightHighIndexCells}`);
    }
    if (Number.isFinite(minAirGapLambda) && !(status.tir.airGapLambda >= minAirGapLambda)) {
      status.failures.push(`TIR air gap ${status.tir.airGapLambda} lambda below ${minAirGapLambda}`);
    }
    if (Number.isFinite(maxAirGapLambda) && !(status.tir.airGapLambda <= maxAirGapLambda)) {
      status.failures.push(`TIR air gap ${status.tir.airGapLambda} lambda exceeds ${maxAirGapLambda}`);
    }
    const referencePreset = testCase.acceptance?.referencePreset;
    if (testCase.id === "frustrated_tir_tunneling" && typeof referencePreset === "string" && referencePreset) {
      status.tirReference = await tirReferenceMetrics(page, referencePreset, steps, testCase);
      const minContrast = Number(testCase.acceptance?.tunneledFarRatioVsReferenceMin);
      const maxReferenceRightHighIndexCells = Number(testCase.acceptance?.referenceRightHighIndexCellsMax);
      const contrast = status.tir.transmittedFarRatio / Math.max(1e-30, status.tirReference.transmittedFarRatio);
      status.tir.tunneledFarRatioVsReference = contrast;
      if (Number.isFinite(minContrast) && contrast < minContrast) {
        status.failures.push(`frustrated-TIR far-side ratio contrast ${contrast} below ${minContrast}`);
      }
      if (
        Number.isFinite(maxReferenceRightHighIndexCells) &&
        status.tirReference.rightHighIndexCells > maxReferenceRightHighIndexCells
      ) {
        status.failures.push(
          `reference TIR right-side high-index cells ${status.tirReference.rightHighIndexCells} exceed ${maxReferenceRightHighIndexCells}`,
        );
      }
    }
  }
  if (testCase.id === "fabry_perot_cavity_localization" || testCase.id === "fabry_perot_standing_wave") {
    status.fabryPerot = await fabryPerotCavityMetrics(page);
    const minCavityFraction = Number(testCase.acceptance?.cavityEnergyFractionMin);
    const minMirrorCells = Number(testCase.acceptance?.mirrorMaterialCellsMin);
    const minContrast = Number(testCase.acceptance?.standingContrastMin);
    const minVisibility = Number(testCase.acceptance?.standingVisibilityMin);
    const minSamples = Number(testCase.acceptance?.minAnalysisSamples);
    if (Number.isFinite(minCavityFraction) && status.fabryPerot.cavityEnergyFraction < minCavityFraction) {
      status.failures.push(`Fabry-Perot cavity energy fraction ${status.fabryPerot.cavityEnergyFraction} is below ${minCavityFraction}`);
    }
    if (Number.isFinite(minMirrorCells) && status.fabryPerot.mirrorMaterialCells < minMirrorCells) {
      status.failures.push(`Fabry-Perot mirror cells ${status.fabryPerot.mirrorMaterialCells} below ${minMirrorCells}`);
    }
    if (Number.isFinite(minContrast) && status.fabryPerot.standingContrast < minContrast) {
      status.failures.push(`Fabry-Perot standing contrast ${status.fabryPerot.standingContrast} below ${minContrast}`);
    }
    if (Number.isFinite(minVisibility) && status.fabryPerot.standingVisibility < minVisibility) {
      status.failures.push(`Fabry-Perot standing visibility ${status.fabryPerot.standingVisibility} below ${minVisibility}`);
    }
    if (Number.isFinite(minSamples) && status.fabryPerot.analysisSamples < minSamples) {
      status.failures.push(`Fabry-Perot analysis has ${status.fabryPerot.analysisSamples} samples, expected at least ${minSamples}`);
    }
  }
  if (testCase.id === "ring_resonator_coupling" || testCase.id === "add_drop_ring_coupling") {
    status.ring = await ringResonatorMetrics(page);
    const minRingCells = Number(testCase.acceptance?.ringCellsMin);
    const minBusCells = Number(testCase.acceptance?.busCellsMin);
    const minDropCells = Number(testCase.acceptance?.dropBusCellsMin);
    const minRingFraction = Number(testCase.acceptance?.ringEnergyFractionMin);
    const minRingToBus = Number(testCase.acceptance?.ringToBusRatioMin);
    const minDropToBus = Number(testCase.acceptance?.dropToBusRatioMin);
    const minDropFraction = Number(testCase.acceptance?.dropBusEnergyFractionMin);
    if (Number.isFinite(minRingCells) && status.ring.ringCells < minRingCells) {
      status.failures.push(`ring cells ${status.ring.ringCells} below ${minRingCells}`);
    }
    if (Number.isFinite(minBusCells) && status.ring.busCells < minBusCells) {
      status.failures.push(`bus cells ${status.ring.busCells} below ${minBusCells}`);
    }
    if (Number.isFinite(minDropCells) && status.ring.dropBusCells < minDropCells) {
      status.failures.push(`drop-bus cells ${status.ring.dropBusCells} below ${minDropCells}`);
    }
    if (Number.isFinite(minRingFraction) && status.ring.ringEnergyFraction < minRingFraction) {
      status.failures.push(`ring energy fraction ${status.ring.ringEnergyFraction} below ${minRingFraction}`);
    }
    if (Number.isFinite(minRingToBus) && status.ring.ringToBusRatio < minRingToBus) {
      status.failures.push(`ring/bus energy ratio ${status.ring.ringToBusRatio} below ${minRingToBus}`);
    }
    if (Number.isFinite(minDropToBus) && status.ring.dropToBusRatio < minDropToBus) {
      status.failures.push(`drop/bus energy ratio ${status.ring.dropToBusRatio} below ${minDropToBus}`);
    }
    if (
      Number.isFinite(minDropFraction) &&
      status.ring.dropBusEnergy / Math.max(1e-30, status.ring.totalEnergy) < minDropFraction
    ) {
      status.failures.push(
        `drop-bus energy fraction ${status.ring.dropBusEnergy / Math.max(1e-30, status.ring.totalEnergy)} below ${minDropFraction}`,
      );
    }
  }
  if (
    testCase.id === "pec_cylinder_scattering_shadow" ||
    testCase.id === "dielectric_cylinder_near_field_scattering" ||
    testCase.id === "mie_cylinder_high_index_response" ||
    testCase.id === "pec_cylinder_ntff_scattering_width" ||
    testCase.id === "lossy_cylinder_field_attenuation" ||
    testCase.id === "dielectric_dimer_gap_coupling" ||
    testCase.id === "kerker_forward_backward_contrast"
  ) {
    status.scattering = await scatteringCylinderMetrics(page);
    const minMaterialCells = Number(testCase.acceptance?.materialCellsMin);
    const minPecCells = Number(testCase.acceptance?.pecCellsMin);
    const maxPecCells = Number(testCase.acceptance?.pecCellsMax);
    const minLossyCells = Number(testCase.acceptance?.lossyCellsMin);
    const maxLossyCells = Number(testCase.acceptance?.lossyCellsMax);
    const minHighIndexCells = Number(testCase.acceptance?.highIndexCellsMin);
    const minObjectEnergy = Number(testCase.acceptance?.objectEnergyMin);
    const maxShadowRatio = Number(testCase.acceptance?.shadowToUpstreamRatioMax);
    const minSideToBack = Number(testCase.acceptance?.sideToBackRatioMin);
    const minBackToFront = Number(testCase.acceptance?.backToFrontRatioMin);
    const minSamples = Number(testCase.acceptance?.minAnalysisSamples);
    const minScatteringTotal = Number(testCase.acceptance?.scatteringTotalMin);
    const minForwardBackward = Number(testCase.acceptance?.forwardBackwardRatioMin);
    const minBackwardForward = Number(testCase.acceptance?.backwardForwardRatioMin);
    const maxBackwardForward = Number(testCase.acceptance?.backwardForwardRatioMax);
    const minObjectCount = Number(testCase.acceptance?.objectCountProxyMin);
    const minGapEnergy = Number(testCase.acceptance?.dimerGapEnergyMin);
    const minGapToObject = Number(testCase.acceptance?.dimerGapToObjectRatioMin);
    if (testCase.acceptance?.fieldComponent && status.scattering.fieldComponent !== testCase.acceptance.fieldComponent) {
      status.failures.push(`scattering field component ${status.scattering.fieldComponent} differs from expected ${testCase.acceptance.fieldComponent}`);
    }
    if (Number.isFinite(minMaterialCells) && status.scattering.objectMaterialCells < minMaterialCells) {
      status.failures.push(`scatterer material cells ${status.scattering.objectMaterialCells} below ${minMaterialCells}`);
    }
    if (Number.isFinite(minPecCells) && status.scattering.objectPecCells < minPecCells) {
      status.failures.push(`PEC scatterer cells ${status.scattering.objectPecCells} below ${minPecCells}`);
    }
    if (Number.isFinite(maxPecCells) && status.scattering.objectPecCells > maxPecCells) {
      status.failures.push(`PEC scatterer cells ${status.scattering.objectPecCells} exceeds ${maxPecCells}`);
    }
    if (Number.isFinite(minLossyCells) && status.scattering.objectLossyCells < minLossyCells) {
      status.failures.push(`lossy scatterer cells ${status.scattering.objectLossyCells} below ${minLossyCells}`);
    }
    if (Number.isFinite(maxLossyCells) && status.scattering.objectLossyCells > maxLossyCells) {
      status.failures.push(`lossy scatterer cells ${status.scattering.objectLossyCells} exceeds ${maxLossyCells}`);
    }
    if (Number.isFinite(minHighIndexCells) && status.scattering.objectHighIndexCells < minHighIndexCells) {
      status.failures.push(`high-index scatterer cells ${status.scattering.objectHighIndexCells} below ${minHighIndexCells}`);
    }
    if (Number.isFinite(minObjectEnergy) && status.scattering.objectEnergy < minObjectEnergy) {
      status.failures.push(`scatterer-region energy ${status.scattering.objectEnergy} below ${minObjectEnergy}`);
    }
    if (Number.isFinite(maxShadowRatio) && status.scattering.shadowToUpstreamRatio > maxShadowRatio) {
      status.failures.push(`shadow/upstream energy ratio ${status.scattering.shadowToUpstreamRatio} exceeds ${maxShadowRatio}`);
    }
    if (Number.isFinite(minSideToBack) && status.scattering.sideToBackRatio < minSideToBack) {
      status.failures.push(`side/back scattering energy ratio ${status.scattering.sideToBackRatio} below ${minSideToBack}`);
    }
    if (Number.isFinite(minBackToFront) && status.scattering.backToFrontRatio < minBackToFront) {
      status.failures.push(`back/front energy ratio ${status.scattering.backToFrontRatio} below ${minBackToFront}`);
    }
    if (Number.isFinite(minSamples) && status.scattering.analysisSamples < minSamples) {
      status.failures.push(`scattering analysis has ${status.scattering.analysisSamples} samples, expected at least ${minSamples}`);
    }
    if (Number.isFinite(minScatteringTotal) && status.scattering.scatteringTotal < minScatteringTotal) {
      status.failures.push(`scattering total ${status.scattering.scatteringTotal} below ${minScatteringTotal}`);
    }
    if (Number.isFinite(minForwardBackward) && status.scattering.forwardBackwardRatio < minForwardBackward) {
      status.failures.push(`forward/backward scattering ratio ${status.scattering.forwardBackwardRatio} below ${minForwardBackward}`);
    }
    if (Number.isFinite(minBackwardForward) && status.scattering.backwardForwardRatio < minBackwardForward) {
      status.failures.push(`backward/forward scattering ratio ${status.scattering.backwardForwardRatio} below ${minBackwardForward}`);
    }
    if (Number.isFinite(maxBackwardForward) && status.scattering.backwardForwardRatio > maxBackwardForward) {
      status.failures.push(`backward/forward scattering ratio ${status.scattering.backwardForwardRatio} exceeds ${maxBackwardForward}`);
    }
    if (Number.isFinite(minObjectCount) && status.scattering.objectCountProxy < minObjectCount) {
      status.failures.push(`scatterer count proxy ${status.scattering.objectCountProxy} below ${minObjectCount}`);
    }
    if (Number.isFinite(minGapEnergy) && status.scattering.dimerGapEnergy < minGapEnergy) {
      status.failures.push(`dimer-gap energy ${status.scattering.dimerGapEnergy} below ${minGapEnergy}`);
    }
    if (Number.isFinite(minGapToObject) && status.scattering.dimerGapToObjectRatio < minGapToObject) {
      status.failures.push(`dimer gap/object energy ratio ${status.scattering.dimerGapToObjectRatio} below ${minGapToObject}`);
    }
  }
  if (
    testCase.id === "multiple_scattering_cluster_spread" ||
    testCase.id === "weak_localization_disorder_spread" ||
    testCase.id === "dense_disorder_trapping_transport" ||
    testCase.id === "diffusive_random_medium_transport"
  ) {
    status.randomScattering = await randomScatteringMetrics(page);
    const minMaterialCells = Number(testCase.acceptance?.materialCellsMin);
    const minHighIndexCells = Number(testCase.acceptance?.highIndexCellsMin);
    const minScatterers = Number(testCase.acceptance?.scattererCountProxyMin);
    const minLateralFraction = Number(testCase.acceptance?.lateralFractionMin);
    const maxRightToLeft = Number(testCase.acceptance?.rightToLeftChannelRatioMax);
    const minRightToLeft = Number(testCase.acceptance?.rightToLeftChannelRatioMin);
    const minCenterToLeft = Number(testCase.acceptance?.centerToLeftChannelRatioMin);
    const minTotalEnergy = Number(testCase.acceptance?.totalEnergyMin);
    const minSamples = Number(testCase.acceptance?.minAnalysisSamples);
    if (Number.isFinite(minMaterialCells) && status.randomScattering.materialCells < minMaterialCells) {
      status.failures.push(`random-scattering material cells ${status.randomScattering.materialCells} below ${minMaterialCells}`);
    }
    if (Number.isFinite(minHighIndexCells) && status.randomScattering.highIndexCells < minHighIndexCells) {
      status.failures.push(`random-scattering high-index cells ${status.randomScattering.highIndexCells} below ${minHighIndexCells}`);
    }
    if (Number.isFinite(minScatterers) && status.randomScattering.scattererCountProxy < minScatterers) {
      status.failures.push(`random-scattering count proxy ${status.randomScattering.scattererCountProxy} below ${minScatterers}`);
    }
    if (Number.isFinite(minLateralFraction) && status.randomScattering.lateralFraction < minLateralFraction) {
      status.failures.push(`lateral scattered-energy fraction ${status.randomScattering.lateralFraction} below ${minLateralFraction}`);
    }
    if (Number.isFinite(minTotalEnergy) && status.randomScattering.totalEnergy < minTotalEnergy) {
      status.failures.push(`random-scattering total energy ${status.randomScattering.totalEnergy} below ${minTotalEnergy}`);
    }
    if (Number.isFinite(maxRightToLeft) && status.randomScattering.rightToLeftChannelRatio > maxRightToLeft) {
      status.failures.push(`right/left channel energy ratio ${status.randomScattering.rightToLeftChannelRatio} exceeds ${maxRightToLeft}`);
    }
    if (Number.isFinite(minRightToLeft) && status.randomScattering.rightToLeftChannelRatio < minRightToLeft) {
      status.failures.push(`right/left channel energy ratio ${status.randomScattering.rightToLeftChannelRatio} below ${minRightToLeft}`);
    }
    if (Number.isFinite(minCenterToLeft) && status.randomScattering.centerToLeftChannelRatio < minCenterToLeft) {
      status.failures.push(`center/left channel energy ratio ${status.randomScattering.centerToLeftChannelRatio} below ${minCenterToLeft}`);
    }
    if (Number.isFinite(minSamples) && status.randomScattering.analysisSamples < minSamples) {
      status.failures.push(`random-scattering analysis has ${status.randomScattering.analysisSamples} samples, expected at least ${minSamples}`);
    }
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

async function runControlNavigationSmoke(page) {
  const status = await page.evaluate(() => {
    if (!document.body.classList.contains("controls-drawer-open")) {
      document.getElementById("controlDrawerToggle")?.click();
    }
    const tabButtons = Array.from(document.querySelectorAll("[data-control-tab]"));
    const mobileButtons = Array.from(document.querySelectorAll(".mobile-layer-button[data-mobile-layer]"));
    const controlLabel = (button) =>
      `${button.querySelector(".nav-step")?.textContent.trim() || ""} ${button.querySelector(".nav-label")?.textContent.trim() || ""}`.trim();
    const tabLabels = tabButtons.map(controlLabel);
    const mobileLabels = mobileButtons.map(controlLabel);
    const clickTab = (name) => {
      document.querySelector(`[data-control-tab="${name}"]`)?.click();
      return {
        activePanel: document.querySelector(".control-tab-panel.is-active")?.id || "",
        runVisible: Boolean(document.querySelector("#tab-simulation .run-section")),
        scaleSectionVisible: Boolean(document.querySelector("#tab-config .scale-section")),
        stabilitySectionVisible: Boolean(document.querySelector("#tab-config .stability-section")),
        performanceInResults: Boolean(document.querySelector("#tab-results .performance-panel")),
        performanceInNumerics: Boolean(document.querySelector("#tab-config .performance-panel")),
        interfaceAccuracyPanelVisible: Boolean(document.querySelector("#tab-config .interface-accuracy-panel")),
        gridHasCellsPerWavelength: Boolean(document.querySelector("#tab-config .grid-section #cellsPerWavelengthInput")),
        gridHasSubpixelSmoothing: Boolean(document.querySelector("#tab-config .grid-section #subpixelSmoothingInput")),
        visualVisible: Boolean(document.querySelector("#tab-simulation .visual-field-section")),
        numericsTitle: document.querySelector("#tab-config .config-summary-section h2")?.textContent.trim() || "",
        openResultCards: Array.from(document.querySelectorAll("#tab-results .results-detail-panel"))
          .filter((panel) => panel.open)
          .map((panel) => panel.querySelector("summary")?.textContent?.trim() || panel.className),
        numericsCards: Array.from(document.querySelectorAll("#tab-config .config-detail-panel")).map((panel) => ({
          title: panel.querySelector("summary")?.textContent?.trim() || panel.className,
          open: panel.open,
        })),
      };
    };
    const simulateState = clickTab("simulation");
    const resultsState = clickTab("results");
    const numericsState = clickTab("config");
    const navigationState = {
      tabLabels,
      mobileLabels,
      hasVisualTab: Boolean(document.getElementById("tab-visual")),
      simulateState,
      resultsState,
      numericsState,
    };
    document.getElementById("controlDrawerBackdrop")?.click();
    return navigationState;
  });
  const failures = [];
  const expectedTabs = ["1 Scenes", "2 Simulate", "3 Results", "4 Numerics"];
  const expectedMobile = ["1 Scene", "2 Simulate", "3 Results", "4 Numerics"];
  if (status.tabLabels.join("|") !== expectedTabs.join("|")) failures.push("desktop control tabs do not match the four-section flow");
  if (status.mobileLabels.join("|") !== expectedMobile.join("|")) failures.push("mobile control layers do not match the four-section flow");
  if (status.hasVisualTab) failures.push("standalone Visual tab still exists after merging into Simulate");
  if (status.simulateState?.activePanel !== "tab-simulation") failures.push("Simulate tab did not activate the simulation panel");
  if (!status.simulateState?.runVisible || !status.simulateState?.visualVisible) {
    failures.push("Simulate tab does not contain both run and visual controls");
  }
  if (status.resultsState?.openResultCards?.length) {
    failures.push(`Results has open cards by default: ${status.resultsState.openResultCards.join(", ")}`);
  }
  if (status.resultsState?.performanceInResults) failures.push("Performance panel is still under Results");
  if (status.numericsState?.activePanel !== "tab-config" || status.numericsState?.numericsTitle !== "Numerics") {
    failures.push("Numerics tab did not activate the numerical setup panel");
  }
  if (!status.numericsState?.performanceInNumerics) failures.push("Performance panel is missing from Numerics");
  if (status.numericsState?.scaleSectionVisible) failures.push("Numerics still shows the Scale section");
  if (status.numericsState?.stabilitySectionVisible) failures.push("Numerics still shows the Stability section");
  const numericsCards = status.numericsState?.numericsCards || [];
  const numericsOrder = numericsCards.map((card) => card.title).join("|");
  if (numericsOrder !== "Grid|Reproducibility|Performance") {
    failures.push(`Numerics card order is ${numericsOrder || "empty"}`);
  }
  if (status.numericsState?.interfaceAccuracyPanelVisible) failures.push("Interface accuracy is still a standalone Numerics card");
  if (!status.numericsState?.gridHasCellsPerWavelength) failures.push("Grid card is missing cells-per-wavelength control");
  if (!status.numericsState?.gridHasSubpixelSmoothing) failures.push("Grid card is missing subpixel smoothing control");
  const unexpectedNumericsState = numericsCards.filter((card) => {
    if (card.title === "Grid" || card.title === "Reproducibility") return !card.open;
    return card.open;
  });
  if (unexpectedNumericsState.length) {
    failures.push(
      `Numerics card open state is wrong: ${unexpectedNumericsState
        .map((card) => `${card.title}:${card.open ? "open" : "closed"}`)
        .join(", ")}`,
    );
  }
  return {
    id: "control_navigation_four_sections",
    preset: "current",
    priority: "P1",
    ...status,
    passed: failures.length === 0,
    failures,
  };
}

async function runPoyntingComponentVisibilitySmoke(page) {
  const status = await page.evaluate(() => {
    document.querySelector('[data-control-tab="simulation"]')?.click();
    const visualPanel = document.querySelector("#tab-simulation .visual-field-section");
    const componentRow = visualPanel?.querySelector(".visual-component-row");
    const scalarButton = componentRow?.querySelector('[data-field-display="scalar"]');
    const transverseButton = componentRow?.querySelector('[data-field-display="transverseX"]');
    const fieldButton = visualPanel?.querySelector('[data-view-mode="field"]');
    const poyntingButton = visualPanel?.querySelector('[data-view-mode="poynting"]');
    transverseButton?.click();
    const beforePoynting = {
      componentRowHidden: Boolean(componentRow?.hidden),
      transverseSelected: transverseButton?.classList.contains("is-active") || false,
    };
    poyntingButton?.click();
    const afterPoynting = {
      componentRowHidden: Boolean(componentRow?.hidden),
      scalarSelected: scalarButton?.classList.contains("is-active") || false,
      poyntingSelected: poyntingButton?.classList.contains("is-active") || false,
      colorbarTitle: document.getElementById("colorbarTitle")?.textContent.trim() || "",
    };
    fieldButton?.click();
    const afterField = {
      componentRowHidden: Boolean(componentRow?.hidden),
      fieldSelected: fieldButton?.classList.contains("is-active") || false,
    };
    return {
      controlsFound: Boolean(visualPanel && componentRow && scalarButton && transverseButton && fieldButton && poyntingButton),
      beforePoynting,
      afterPoynting,
      afterField,
    };
  });
  const failures = [];
  if (!status.controlsFound) failures.push("visual field-map controls were not found");
  if (status.beforePoynting.componentRowHidden) failures.push("field component row is hidden before selecting Poynting quantity");
  if (!status.beforePoynting.transverseSelected) failures.push("field component row did not accept a non-scalar field display before selecting Poynting");
  if (!status.afterPoynting.componentRowHidden) failures.push("field component row remains visible after selecting Poynting quantity");
  if (!status.afterPoynting.scalarSelected) failures.push("Poynting quantity did not reset the hidden field display to scalar");
  if (!status.afterPoynting.poyntingSelected) failures.push("Poynting quantity button is not selected");
  if (!/S/.test(status.afterPoynting.colorbarTitle || "")) failures.push("Poynting colorbar title does not report S");
  if (status.afterField.componentRowHidden) failures.push("field component row did not reappear after returning to field quantity");
  if (!status.afterField.fieldSelected) failures.push("field quantity button is not selected after returning to field mode");
  return {
    id: "poynting_component_visibility",
    preset: "current",
    priority: "P1",
    ...status,
    passed: failures.length === 0,
    failures,
  };
}

async function runSceneMenuResponsiveSmoke(browser, url) {
  const viewports = [
    { name: "mobile", width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
    { name: "tablet", width: 768, height: 1024, isMobile: true, deviceScaleFactor: 2 },
    { name: "desktop", width: 1440, height: 1000, isMobile: false, deviceScaleFactor: 1 },
    { name: "uhd", width: 3840, height: 2160, isMobile: false, deviceScaleFactor: 1 },
  ];
  const states = [];
  const failures = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
      isMobile: viewport.isMobile,
      hasTouch: viewport.isMobile,
    });
    const page = await context.newPage();
    const localErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") localErrors.push(message.text());
    });
    page.on("pageerror", (error) => {
      localErrors.push(error.message);
    });

    try {
      await page.goto(url, { waitUntil: "networkidle" });
      await page.locator("#controlDrawerToggle").click();
      await page.waitForTimeout(120);
      await page.evaluate(() => {
        document.querySelector('[data-control-tab="scenes"]')?.click();
        document.querySelector('.mobile-layer-button[data-mobile-layer="scenes"]')?.click();
      });
      await selectPreset(page, "topologyTemporalMod");
      await page.waitForTimeout(120);
      const currentStatus = await page.evaluate(() => {
        const rect = (selector) => {
          const node = document.querySelector(selector);
          if (!node) return null;
          const bounds = node.getBoundingClientRect();
          return {
            top: Math.round(bounds.top),
            bottom: Math.round(bounds.bottom),
            left: Math.round(bounds.left),
            right: Math.round(bounds.right),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
          };
        };
        const panel = document.getElementById("controlPanel");
        const panelBounds = panel?.getBoundingClientRect();
        const spotlightImage = document.querySelector("#sceneSpotlight img.scene-thumb-image");
        const title = document.getElementById("sceneSpotlightTitle");
        const description = document.getElementById("sceneSpotlightDescription");
        const fallback = document.querySelector(".scene-select-fallback");
        const panelOverflow = panel ? panel.scrollWidth - panel.clientWidth : 0;
        return {
          activeView: document.querySelector("[data-scene-view].is-active")?.dataset.sceneView || "",
          activePanel: document.querySelector(".control-tab-panel.is-active")?.id || "",
          browsePanelHidden: document.getElementById("sceneBrowsePanel")?.hidden ?? true,
          currentPanelHidden: document.getElementById("sceneCurrentPanel")?.hidden ?? true,
          descriptionText: description?.textContent?.trim() || "",
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          fallbackDisplay: fallback ? getComputedStyle(fallback).display : "",
          family: document.getElementById("sceneSpotlightGroup")?.textContent?.trim() || "",
          panel: panelBounds
            ? {
                left: Math.round(panelBounds.left),
                right: Math.round(panelBounds.right),
                width: Math.round(panelBounds.width),
              }
            : null,
          panelOverflow,
          guide: rect("#sceneGuidePanel"),
          openGuideCards: Array.from(document.querySelectorAll("#sceneGuidePanel .scene-guide-details"))
            .filter((panel) => panel.open)
            .map((panel) => panel.querySelector("summary")?.textContent?.trim() || panel.className),
          spotlight: rect("#sceneSpotlight"),
          spotlightImage: spotlightImage
            ? {
                complete: spotlightImage.complete,
                naturalHeight: spotlightImage.naturalHeight,
                naturalWidth: spotlightImage.naturalWidth,
                src: spotlightImage.getAttribute("src") || "",
              }
            : null,
          titleText: title?.textContent?.trim() || "",
        };
      });
      await page.locator('[data-scene-view="browse"]').click();
      await page.waitForTimeout(120);
      const browseStatus = await page.evaluate(() => {
        const rect = (selector) => {
          const node = document.querySelector(selector);
          if (!node) return null;
          const bounds = node.getBoundingClientRect();
          return {
            top: Math.round(bounds.top),
            bottom: Math.round(bounds.bottom),
            left: Math.round(bounds.left),
            right: Math.round(bounds.right),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
          };
        };
        const panel = document.getElementById("controlPanel");
        const panelBounds = panel?.getBoundingClientRect();
        const cards = document.getElementById("sceneCards");
        const activeCardImage = document.querySelector('.scene-card.is-active img.scene-thumb-image');
        const cardImageCount = document.querySelectorAll("#sceneCards img.scene-thumb-image").length;
        return {
          activeView: document.querySelector("[data-scene-view].is-active")?.dataset.sceneView || "",
          browsePanelHidden: document.getElementById("sceneBrowsePanel")?.hidden ?? true,
          cardCount: cards?.querySelectorAll("[data-scene-card]").length || 0,
          cardImageCount,
          currentPanelHidden: document.getElementById("sceneCurrentPanel")?.hidden ?? true,
          panel: panelBounds
            ? {
                left: Math.round(panelBounds.left),
                right: Math.round(panelBounds.right),
                width: Math.round(panelBounds.width),
              }
            : null,
          panelOverflow: panel ? panel.scrollWidth - panel.clientWidth : 0,
          search: rect("#sceneSearchInput"),
          filterBar: rect("#sceneFilterBar"),
          cards: rect("#sceneCards"),
          activeCardImageSrc: activeCardImage?.getAttribute("src") || "",
        };
      });
      const status = { viewport: viewport.name, current: currentStatus, browse: browseStatus };
      states.push(status);
      failures.push(...localErrors.map((error) => `${viewport.name}: ${error}`));
      if (currentStatus.activePanel !== "tab-scenes") failures.push(`${viewport.name}: Scene panel is not active`);
      if (currentStatus.activeView !== "current") failures.push(`${viewport.name}: Scene menu did not default to Current view`);
      if (currentStatus.currentPanelHidden || !currentStatus.browsePanelHidden) {
        failures.push(`${viewport.name}: Current view visibility state is incorrect`);
      }
      if (!currentStatus.titleText || !currentStatus.descriptionText) failures.push(`${viewport.name}: spotlight title/description is empty`);
      if (!currentStatus.family) failures.push(`${viewport.name}: spotlight family is empty`);
      if (
        !currentStatus.spotlightImage ||
        !currentStatus.spotlightImage.src.endsWith("/topologyTemporalMod.webp") ||
        !currentStatus.spotlightImage.complete ||
        currentStatus.spotlightImage.naturalWidth <= 0 ||
        currentStatus.spotlightImage.naturalHeight <= 0
      ) {
        failures.push(`${viewport.name}: spotlight thumbnail image did not load`);
      }
      if (browseStatus.activeView !== "browse") failures.push(`${viewport.name}: Browse view did not activate`);
      if (!browseStatus.currentPanelHidden || browseStatus.browsePanelHidden) {
        failures.push(`${viewport.name}: Browse view visibility state is incorrect`);
      }
      if (browseStatus.cardCount <= 0) failures.push(`${viewport.name}: scene cards did not render`);
      if (browseStatus.cardImageCount !== browseStatus.cardCount) {
        failures.push(`${viewport.name}: not every visible scene card has a thumbnail image`);
      }
      if (!browseStatus.activeCardImageSrc.endsWith("/topologyTemporalMod.webp")) {
        failures.push(`${viewport.name}: active scene card thumbnail does not match the selected scene`);
      }
      if (currentStatus.fallbackDisplay !== "none") failures.push(`${viewport.name}: fallback select is still visible`);
      if (!browseStatus.search || browseStatus.search.height <= 0) failures.push(`${viewport.name}: scene search is not visible in Browse view`);
      if (!browseStatus.filterBar || browseStatus.filterBar.height <= 0) failures.push(`${viewport.name}: scene groups are not visible in Browse view`);
      if (!browseStatus.cards || browseStatus.cards.height <= 0) failures.push(`${viewport.name}: scene card scroll area is not visible in Browse view`);
      if (currentStatus.documentOverflow > 1) failures.push(`${viewport.name}: document horizontal overflow ${currentStatus.documentOverflow}`);
      if (currentStatus.panelOverflow > 1) failures.push(`${viewport.name}: control panel horizontal overflow ${currentStatus.panelOverflow}`);
      if (browseStatus.panelOverflow > 1) failures.push(`${viewport.name}: browse panel horizontal overflow ${browseStatus.panelOverflow}`);
      if (
        currentStatus.panel &&
        currentStatus.spotlight &&
        (currentStatus.spotlight.left < currentStatus.panel.left - 1 || currentStatus.spotlight.right > currentStatus.panel.right + 1)
      ) {
        failures.push(`${viewport.name}: spotlight exceeds the control panel bounds`);
      }
      if (
        currentStatus.spotlight &&
        currentStatus.guide &&
        currentStatus.guide.top < currentStatus.spotlight.bottom - 1
      ) {
        failures.push(`${viewport.name}: Current scene guide should be stacked below the scene card`);
      }
      if (currentStatus.openGuideCards?.length) {
        failures.push(`${viewport.name}: Scene guide has open cards by default: ${currentStatus.openGuideCards.join(", ")}`);
      }
      if (
        browseStatus.panel &&
        browseStatus.cards &&
        (browseStatus.cards.left < browseStatus.panel.left - 1 || browseStatus.cards.right > browseStatus.panel.right + 1)
      ) {
        failures.push(`${viewport.name}: scene cards exceed the control panel bounds`);
      }
    } finally {
      await context.close();
    }
  }

  return {
    id: "scene_menu_spotlight_responsive",
    preset: "topologyTemporalMod",
    priority: "P1",
    states,
    passed: failures.length === 0,
    failures,
  };
}

async function runSceneMenuSelectionSmoke(browser, url) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const failures = [];
  const states = [];
  const snapshotSceneMenu = async (label) => {
    const state = await page.evaluate((snapshotLabel) => {
      const visibleCards = Array.from(document.querySelectorAll("#sceneCards [data-scene-card]")).map(
        (card) => card.dataset.sceneCard || "",
      );
      return {
        label: snapshotLabel,
        activeFilter: document.querySelector("[data-scene-filter].is-active")?.dataset.sceneFilter || "",
        activeView: document.querySelector("[data-scene-view].is-active")?.dataset.sceneView || "",
        activeCard: document.querySelector(".scene-card.is-active")?.dataset.sceneCard || "",
        preset: document.getElementById("presetInput")?.value || "",
        spotlightTitle: document.getElementById("sceneSpotlightTitle")?.textContent?.trim() || "",
        visibleCards,
      };
    }, label);
    states.push(state);
    return state;
  };
  const clickIfPresent = async (selector) =>
    page.evaluate((targetSelector) => {
      const target = document.querySelector(targetSelector);
      if (!target) return false;
      target.click();
      return true;
    }, selector);
  const openBrowseView = async () => {
    if (!(await clickIfPresent('[data-scene-view="browse"]'))) {
      failures.push("Browse view button was not found");
    }
    await page.waitForTimeout(80);
  };

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator("#controlDrawerToggle").click();
    await page.waitForTimeout(120);
    await page.evaluate(() => {
      document.querySelector('[data-control-tab="scenes"]')?.click();
    });
    await selectPreset(page, "planeWaveAir");
    await page
      .waitForFunction(
        () =>
          document.querySelectorAll("[data-scene-view]").length >= 2 &&
          document.querySelectorAll("[data-scene-filter]").length > 0 &&
          document.querySelectorAll("#sceneCards [data-scene-card]").length > 0,
        null,
        { timeout: 3000 },
      )
      .catch(() => {
        failures.push("Scene browse controls did not render before interaction");
      });
    await page.waitForTimeout(120);
    await openBrowseView();

    if (!(await clickIfPresent('[data-scene-filter="3. Sources and radiation"]'))) {
      failures.push("Sources and radiation filter button was not found");
    }
    await page.waitForTimeout(80);
    const sourcesFilter = await snapshotSceneMenu("sources filter");
    if (sourcesFilter.activeFilter !== "3. Sources and radiation") {
      failures.push(`Sources filter did not stay active; got ${sourcesFilter.activeFilter || "none"}`);
    }
    if (!sourcesFilter.visibleCards.includes("jzDipole")) {
      failures.push("Sources filter did not reveal the Jz dipole scene card");
    }
    if (sourcesFilter.activeView !== "browse") {
      failures.push(`Sources filter should be tested in Browse view; got ${sourcesFilter.activeView || "none"}`);
    }

    if (!(await clickIfPresent('[data-scene-card="jzDipole"]'))) {
      failures.push("Jz dipole scene card was not clickable");
    }
    await page.waitForTimeout(160);
    const sourcesSelection = await snapshotSceneMenu("sources selection");
    if (sourcesSelection.preset !== "jzDipole") {
      failures.push(`Jz dipole card did not apply the preset; got ${sourcesSelection.preset || "none"}`);
    }
    if (sourcesSelection.activeCard !== "jzDipole") {
      failures.push(`Jz dipole card was not marked active; got ${sourcesSelection.activeCard || "none"}`);
    }
    if (sourcesSelection.activeView !== "current") {
      failures.push(`Selecting a scene should return to Current view; got ${sourcesSelection.activeView || "none"}`);
    }

    await openBrowseView();
    if (!(await clickIfPresent('[data-scene-filter="4. Guided optics"]'))) {
      failures.push("Guided optics filter button was not found");
    }
    await page.waitForTimeout(80);
    const guidedFilter = await snapshotSceneMenu("guided filter");
    if (guidedFilter.activeFilter !== "4. Guided optics") {
      failures.push(`Guided filter did not stay active; got ${guidedFilter.activeFilter || "none"}`);
    }
    if (!guidedFilter.visibleCards.includes("slabWaveguide")) {
      failures.push("Guided filter did not reveal the slab waveguide scene card");
    }
    if (guidedFilter.activeView !== "browse") {
      failures.push(`Guided filter should be tested in Browse view; got ${guidedFilter.activeView || "none"}`);
    }

    if (!(await clickIfPresent('[data-scene-card="slabWaveguide"]'))) {
      failures.push("Slab waveguide scene card was not clickable");
    }
    await page.waitForTimeout(160);
    const guidedSelection = await snapshotSceneMenu("guided selection");
    if (guidedSelection.preset !== "slabWaveguide") {
      failures.push(`Slab waveguide card did not apply the preset; got ${guidedSelection.preset || "none"}`);
    }
    if (guidedSelection.activeCard !== "slabWaveguide") {
      failures.push(`Slab waveguide card was not marked active; got ${guidedSelection.activeCard || "none"}`);
    }
    if (guidedSelection.activeView !== "current") {
      failures.push(`Selecting the guided scene should return to Current view; got ${guidedSelection.activeView || "none"}`);
    }
    const guidedSourceShape = await page.evaluate(() => state.sources?.[0]?.shape || "");
    if (guidedSourceShape !== "modeProfile") {
      failures.push(`Slab waveguide should load a guided mode profile source; got ${guidedSourceShape || "none"}`);
    }
  } finally {
    await context.close();
  }

  return {
    id: "scene_menu_selection_interaction",
    preset: "planeWaveAir",
    priority: "P1",
    states,
    passed: failures.length === 0,
    failures,
  };
}

async function runMobileSimulatePanelScrollSmoke(browser, url) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const localErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") localErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    localErrors.push(error.message);
  });

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator("#controlDrawerToggle").click();
    await page.locator('[data-mobile-layer="simulation"]:visible').click();
    await page.waitForTimeout(120);
    const status = await page.evaluate(() => {
      const panel = document.getElementById("controlPanel");
      const panels = document.querySelector(".control-tab-panels");
      const header = document.querySelector(".control-panel-header");
      const nav = document.querySelector(".mobile-layer-nav");
      const run = document.querySelector("#tab-simulation .run-section");
      const rect = (node) => {
        if (!node) return null;
        const bounds = node.getBoundingClientRect();
        return {
          top: Math.round(bounds.top),
          bottom: Math.round(bounds.bottom),
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height),
        };
      };
      return {
        panelScrollTop: panel?.scrollTop ?? null,
        panelsScrollTop: panels?.scrollTop ?? null,
        header: rect(header),
        nav: rect(nav),
        run: rect(run),
        activePanel: document.querySelector(".control-tab-panel.is-active")?.id || "",
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        viewportHeight: window.innerHeight,
      };
    });
    const failures = [...localErrors];
    if (status.activePanel !== "tab-simulation") failures.push("mobile Simulate layer did not activate the simulation panel");
    if (Number(status.panelScrollTop) > 1) failures.push(`control panel scrolled out of frame (${status.panelScrollTop})`);
    if (!status.header || status.header.top < 0 || status.header.bottom <= 0) failures.push("control panel header is not visible after tapping Simulate");
    if (!status.nav || status.nav.top < 0 || status.nav.bottom <= 0) failures.push("mobile layer navigation is not visible after tapping Simulate");
    if (!status.run || !status.nav || status.run.top < status.nav.bottom - 1) failures.push("Run controls overlap or precede the mobile layer navigation");
    if (status.overflow > 1) failures.push(`mobile Simulate panel has horizontal overflow ${status.overflow}`);
    return {
      id: "mobile_simulate_panel_scroll",
      preset: "current",
      priority: "P1",
      ...status,
      passed: failures.length === 0,
      failures,
    };
  } finally {
    await context.close();
  }
}

async function runMobileLayerScrollResetSmoke(browser, url) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const localErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") localErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    localErrors.push(error.message);
  });

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator("#controlDrawerToggle").click();
    await page.waitForTimeout(80);
    const layers = ["scenes", "simulation", "results", "config"];
    const layerStates = [];
    for (const layer of layers) {
      await page.locator(".control-tab-panels").evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      await page.locator(`.mobile-layer-button[data-mobile-layer="${layer}"]:visible`).click();
      await page.waitForTimeout(120);
      layerStates.push(await page.evaluate((layerName) => {
        const panel = document.getElementById("controlPanel");
        const scroller = document.querySelector(".control-tab-panels");
        const active = document.querySelector(".control-tab-panel.is-active");
        const header = document.querySelector(".control-panel-header")?.getBoundingClientRect();
        const nav = document.querySelector(".mobile-layer-nav")?.getBoundingClientRect();
        return {
          layer: layerName,
          activePanel: active?.id || "",
          panelScrollTop: panel?.scrollTop ?? null,
          panelsScrollTop: scroller?.scrollTop ?? null,
          headerTop: header ? Math.round(header.top) : null,
          navTop: nav ? Math.round(nav.top) : null,
        };
      }, layer));
    }
    const failures = [...localErrors];
    for (const state of layerStates) {
      if (Number(state.panelScrollTop) > 1) failures.push(`${state.layer} left the control panel scrolled (${state.panelScrollTop})`);
      if (Number(state.panelsScrollTop) > 1) failures.push(`${state.layer} did not reset content scroll (${state.panelsScrollTop})`);
      if (Number(state.headerTop) < 0 || Number(state.navTop) < 0) failures.push(`${state.layer} header/navigation is above the viewport`);
    }
    return {
      id: "mobile_layer_scroll_reset",
      preset: "current",
      priority: "P1",
      layerStates,
      passed: failures.length === 0,
      failures,
    };
  } finally {
    await context.close();
  }
}

async function runMobileToolbarHeightSmoke(browser, url) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const localErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") localErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    localErrors.push(error.message);
  });

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    const status = await page.evaluate(() => {
      const rect = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const bounds = node.getBoundingClientRect();
        return {
          top: Math.round(bounds.top),
          bottom: Math.round(bounds.bottom),
          height: Math.round(bounds.height),
          width: Math.round(bounds.width),
        };
      };
      const toolbarNode = document.querySelector(".canvas-toolbar");
      const actionToggleNode = document.getElementById("canvasActionToggle");
      const actionMenuNode = document.getElementById("canvasActionMenu");
      const resetNode = document.getElementById("resetBtn");
      const closedToolbar = rect(".canvas-toolbar");
      const boundsOf = (node) => {
        if (!node) return null;
        const bounds = node.getBoundingClientRect();
        return {
          top: Math.round(bounds.top),
          bottom: Math.round(bounds.bottom),
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          height: Math.round(bounds.height),
          width: Math.round(bounds.width),
          display: getComputedStyle(node).display,
        };
      };
      const closedActionToggle = boundsOf(actionToggleNode);
      actionToggleNode?.click();
      const openToolbarBounds = toolbarNode?.getBoundingClientRect();
      const openActionToggle = boundsOf(actionToggleNode);
      const openActionNodes = [resetNode, actionMenuNode, ...(actionMenuNode ? Array.from(actionMenuNode.querySelectorAll("button")) : [])]
        .map(boundsOf)
        .filter((bounds) => bounds && bounds.display !== "none");
      const minActionLeft = openActionNodes.length ? Math.min(...openActionNodes.map((bounds) => bounds.left)) : null;
      const maxActionRight = openActionNodes.length ? Math.max(...openActionNodes.map((bounds) => bounds.right)) : null;
      const minActionTop = openActionNodes.length ? Math.min(...openActionNodes.map((bounds) => bounds.top)) : null;
      const maxActionBottom = openActionNodes.length ? Math.max(...openActionNodes.map((bounds) => bounds.bottom)) : null;
      return {
        topbar: rect(".topbar"),
        toolbar: closedToolbar,
        menuButton: rect("#controlDrawerToggle"),
        playButton: rect("#playPauseBtn"),
        interactionToggle: rect(".interaction-toggle"),
        openToolbar: rect(".canvas-toolbar"),
        openToolbarOverflowX: toolbarNode && openToolbarBounds ? Math.round(toolbarNode.scrollWidth - openToolbarBounds.width) : null,
        actionToggleShiftX:
          closedActionToggle && openActionToggle ? Math.round(Math.abs(openActionToggle.left - closedActionToggle.left)) : null,
        actionMenuBounds: {
          minLeft: minActionLeft,
          maxRight: maxActionRight,
          minTop: minActionTop,
          maxBottom: maxActionBottom,
          overflowLeft: minActionLeft === null ? null : Math.max(0, -minActionLeft),
          overflowRight: maxActionRight === null ? null : Math.max(0, maxActionRight - window.innerWidth),
          outsideToolbar:
            !openToolbarBounds || minActionTop === null || maxActionBottom === null
              ? null
              : minActionTop < openToolbarBounds.top - 1 || maxActionBottom > openToolbarBounds.bottom + 1,
        },
      };
    });
    const failures = [...localErrors];
    if (!status.topbar || !status.toolbar) failures.push("mobile toolbar or menu block was not rendered");
    if (status.topbar && status.toolbar && Math.abs(status.topbar.height - status.toolbar.height) > 1) {
      failures.push(`mobile toolbar height ${status.toolbar.height} does not match menu block ${status.topbar.height}`);
    }
    if (status.menuButton && status.playButton && Math.abs(status.menuButton.height - status.playButton.height) > 1) {
      failures.push(`play button height ${status.playButton.height} does not match menu button ${status.menuButton.height}`);
    }
    if (status.menuButton && status.interactionToggle && Math.abs(status.menuButton.height - status.interactionToggle.height) > 1) {
      failures.push(`Select/Draw toggle height ${status.interactionToggle.height} does not match menu button ${status.menuButton.height}`);
    }
    if (status.toolbar && status.openToolbar && Math.abs(status.openToolbar.height - status.toolbar.height) > 1) {
      failures.push(`open mobile toolbar height ${status.openToolbar.height} should stay on one row like closed height ${status.toolbar.height}`);
    }
    if (Number(status.openToolbarOverflowX) > 1) {
      failures.push(`open mobile toolbar overflows horizontally by ${status.openToolbarOverflowX}px`);
    }
    if (Number(status.actionToggleShiftX) > 1) {
      failures.push(`canvas action toggle shifts by ${status.actionToggleShiftX}px when opened`);
    }
    if (Number(status.actionMenuBounds?.overflowLeft) > 1 || Number(status.actionMenuBounds?.overflowRight) > 1) {
      failures.push("open mobile action menu extends outside the viewport");
    }
    if (status.actionMenuBounds?.outsideToolbar) {
      failures.push("open mobile action buttons are not contained inside the toolbar");
    }
    return {
      id: "mobile_toolbar_height",
      preset: "current",
      priority: "P1",
      ...status,
      passed: failures.length === 0,
      failures,
    };
  } finally {
    await context.close();
  }
}

async function runBrushStrokeContinuitySmoke(page) {
  await selectPreset(page, "empty");
  const segment = await page.evaluate(() => {
    if (typeof closeContextMenus === "function") closeContextMenus();
    state.canvasMode = "brush";
    state.brushTool = "paint";
    state.brush = "pec";
    state.brushSizeLambda = Math.max(0.05, 1 / Math.max(1, state.cellsPerWavelength || 1));
    sim.applyPreset("empty");
    sim.render();
    const minX = sim.activeInteriorMinX();
    const maxX = sim.activeInteriorMaxX();
    const minY = sim.activeInteriorMinY();
    const maxY = sim.activeInteriorMaxY();
    const y = Math.round((minY + maxY) * 0.5);
    const x0 = Math.min(maxX - 4, minX + 24);
    const x1 = Math.max(x0 + 24, Math.min(maxX - 24, x0 + 128));
    return {
      x0,
      x1,
      y,
      start: {
        clientX: sim.gridToCanvasX(x0 + 0.5),
        clientY: sim.gridToCanvasY(y + 0.5),
      },
      end: {
        clientX: sim.gridToCanvasX(x1 + 0.5),
        clientY: sim.gridToCanvasY(y + 0.5),
      },
    };
  });
  await page.mouse.move(segment.start.clientX, segment.start.clientY);
  await page.mouse.down();
  await page.mouse.move(segment.end.clientX, segment.end.clientY, { steps: 1 });
  await page.mouse.up();
  const status = await page.evaluate(({ x0, x1, y }) => {
    const missingCells = [];
    let paintedCells = 0;
    for (let x = x0; x <= x1; x += 1) {
      if (sim.material[sim.id(x, y)] === 2) paintedCells += 1;
      else missingCells.push(x);
    }
    return {
      x0,
      x1,
      y,
      paintedCells,
      missingCells,
      spanCells: x1 - x0 + 1,
    };
  }, segment);
  const failures = [];
  if (status.missingCells.length > 0) {
    failures.push(`brush stroke has ${status.missingCells.length} gaps along a sparse pointer path`);
  }
  return {
    id: "brush_stroke_continuity",
    preset: "empty",
    priority: "P1",
    ...status,
    passed: failures.length === 0,
    failures,
  };
}

async function runDrawPreviewSmoke(page) {
  await selectPreset(page, "empty");
  await page.locator("#brushModeBtn").click();
  const brushPoint = await page.evaluate(() => {
    if (typeof closeContextMenus === "function") closeContextMenus();
    state.brushTool = "paint";
    state.brush = "custom";
    state.brushSizeLambda = 0.35;
    state.drawPreviewCell = null;
    sim.render();
    const x = Math.round((sim.activeInteriorMinX() + sim.activeInteriorMaxX()) * 0.45);
    const y = Math.round((sim.activeInteriorMinY() + sim.activeInteriorMaxY()) * 0.45);
    const rect = sim.canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    return {
      x,
      y,
      baseline: sim.canvas.toDataURL(),
      clientX: rect.left + sim.gridToCanvasX(x + 0.5) / dpr,
      clientY: rect.top + sim.gridToCanvasY(y + 0.5) / dpr,
    };
  });
  await page.mouse.move(brushPoint.clientX, brushPoint.clientY);
  await page.waitForTimeout(60);
  const brushStatus = await page.evaluate((baseline) => ({
    cursor: getComputedStyle(sim.canvas).cursor,
    previewCell: state.drawPreviewCell,
    changed: sim.canvas.toDataURL() !== baseline,
  }), brushPoint.baseline);

  const geometryPoint = await page.evaluate(() => {
    state.brushTool = "geometry";
    state.brushGeometry = "ring";
    state.geometryRadiusLambda = 0.55;
    state.geometryInnerRadiusLambda = 0.28;
    state.drawPreviewCell = null;
    sim.render();
    const x = Math.round((sim.activeInteriorMinX() + sim.activeInteriorMaxX()) * 0.58);
    const y = Math.round((sim.activeInteriorMinY() + sim.activeInteriorMaxY()) * 0.52);
    const rect = sim.canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    return {
      x,
      y,
      baseline: sim.canvas.toDataURL(),
      clientX: rect.left + sim.gridToCanvasX(x + 0.5) / dpr,
      clientY: rect.top + sim.gridToCanvasY(y + 0.5) / dpr,
    };
  });
  await page.mouse.move(geometryPoint.clientX, geometryPoint.clientY);
  await page.waitForTimeout(60);
  const geometryStatus = await page.evaluate((baseline) => ({
    previewCell: state.drawPreviewCell,
    changed: sim.canvas.toDataURL() !== baseline,
  }), geometryPoint.baseline);

  const failures = [];
  if (brushStatus.cursor === "default" || brushStatus.cursor === "auto") failures.push(`draw mode cursor remained ${brushStatus.cursor}`);
  if (!brushStatus.previewCell || brushStatus.previewCell.x !== brushPoint.x || brushStatus.previewCell.y !== brushPoint.y) {
    failures.push("brush preview did not track the hovered grid cell");
  }
  if (!brushStatus.changed) failures.push("brush preview did not alter the rendered canvas");
  if (!geometryStatus.previewCell || geometryStatus.previewCell.x !== geometryPoint.x || geometryStatus.previewCell.y !== geometryPoint.y) {
    failures.push("geometry preview did not track the hovered grid cell");
  }
  if (!geometryStatus.changed) failures.push("geometry preview did not alter the rendered canvas");
  return {
    id: "draw_cursor_preview",
    preset: "empty",
    priority: "P1",
    brushCursor: brushStatus.cursor,
    brushPreviewCell: brushStatus.previewCell,
    geometryPreviewCell: geometryStatus.previewCell,
    brushChanged: brushStatus.changed,
    geometryChanged: geometryStatus.changed,
    passed: failures.length === 0,
    failures,
  };
}

async function runSourceWaveVectorOverlaySmoke(page) {
  await selectPreset(page, "poyntingPlaneWave");
  const status = await page.evaluate(() => {
    const source = state.sources?.[0] || null;
    const direction = source ? sim.sourceIncidentCanvasDirection(source) : null;
    const descriptor = source ? sim.tfsfSourceParams(source) : null;
    return {
      angleDeg: source?.angleDeg ?? null,
      direction,
      descriptor: descriptor
        ? {
            cosTheta: descriptor.cosTheta,
            sinTheta: descriptor.sinTheta,
          }
        : null,
    };
  });
  const failures = [];
  const tolerance = 1e-9;
  if (!status.direction || !status.descriptor) {
    failures.push("incident source direction or TFSF descriptor was unavailable");
  } else {
    if (Math.abs(status.direction.x - status.descriptor.cosTheta) > tolerance) {
      failures.push(`k arrow x direction ${status.direction.x} does not match incident cos ${status.descriptor.cosTheta}`);
    }
    if (Math.abs(status.direction.y - status.descriptor.sinTheta) > tolerance) {
      failures.push(`k arrow y direction ${status.direction.y} does not match incident sin ${status.descriptor.sinTheta}`);
    }
    if (status.angleDeg > 0 && status.angleDeg < 90 && !(status.direction.x > 0 && status.direction.y > 0)) {
      failures.push(`positive oblique incidence should draw k down-right in canvas coordinates; got (${status.direction.x}, ${status.direction.y})`);
    }
  }
  return {
    id: "source_wave_vector_overlay_direction",
    preset: "poyntingPlaneWave",
    priority: "P1",
    ...status,
    passed: failures.length === 0,
    failures,
  };
}

async function runSourceDependentParamsSmoke(page) {
  await selectPreset(page, "planeWaveAir");
  const status = await page.evaluate(() => {
    const sourceMenu = document.getElementById("sourceMenu");
    if (sourceMenu) sourceMenu.hidden = false;
    const sourceDetailPanel = document.querySelector(".source-detail-panel");
    const isRendered = (control) => {
      if (!control) return false;
      const style = getComputedStyle(control);
      const rect = control.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const sourceTemplate = {
      id: 1,
      type: "sine",
      frequency: 0.005,
      amplitude: 0.55,
      xLambda: 1.2,
      yLambda: 3.0,
      widthLambda: 0.35,
      angleDeg: 30,
      phaseDeg: 0,
      multipoleOrder: 3,
      multipolePhase: "cos",
    };
    const shapeControlState = (shape) => {
      populateSourceEditor({
        ...sourceTemplate,
        shape,
        widthLambda: shape === "evanescentLine" ? 1.25 : shape === "modeProfile" ? 1.15 : sourceTemplate.widthLambda,
      });
      const visibleSourceIds = [
        "sourceWidthControl",
        "sourceAngleControl",
        "sourceOrderControl",
        "sourcePhaseControl",
      ].filter((id) => {
        const control = document.getElementById(id);
        return control?.hidden === false && isRendered(control);
      });
      const multipoleGroup = document.querySelector(".source-order-controls");
      const timePhaseControl = document.getElementById("sourceTimePhaseControl");
      return {
        visibleSourceIds,
        multipoleGroupVisible: multipoleGroup?.hidden === false && isRendered(multipoleGroup),
        timePhaseVisible: timePhaseControl?.hidden === false && isRendered(timePhaseControl),
      };
    };
    if (sourceDetailPanel) sourceDetailPanel.open = false;
    const closedAdvanced = shapeControlState("multipole");
    const sourceDetailsClosed = sourceDetailPanel?.open === false;
    if (sourceDetailPanel) sourceDetailPanel.open = true;
    return {
      sourceDetailsClosed,
      closedAdvanced,
      point: shapeControlState("point"),
      gaussianSpot: shapeControlState("gaussianSpot"),
      line: shapeControlState("line"),
      gaussianProfile: shapeControlState("gaussianProfile"),
      evanescentLine: shapeControlState("evanescentLine"),
      modeProfile: shapeControlState("modeProfile"),
      multipole: shapeControlState("multipole"),
    };
  });
  const failures = [];
  if (!status.sourceDetailsClosed) failures.push("source details should start collapsed");
  if (status.closedAdvanced?.timePhaseVisible || status.closedAdvanced?.multipoleGroupVisible) {
    failures.push("source advanced controls remain visible while Source details is collapsed");
  }
  const expectations = {
    point: [],
    gaussianSpot: ["sourceWidthControl"],
    line: ["sourceAngleControl"],
    gaussianProfile: ["sourceAngleControl"],
    evanescentLine: ["sourceWidthControl", "sourceAngleControl"],
    modeProfile: ["sourceWidthControl"],
    multipole: ["sourceWidthControl", "sourceAngleControl", "sourceOrderControl", "sourcePhaseControl"],
  };
  for (const [shape, expectedIds] of Object.entries(expectations)) {
    const actual = status[shape]?.visibleSourceIds || [];
    if (actual.join(",") !== expectedIds.join(",")) {
      failures.push(`${shape} source controls should show only ${expectedIds.join(", ") || "always-on controls"}`);
    }
    if (!status[shape]?.timePhaseVisible) {
      failures.push(`${shape} source should keep the temporal phase control visible`);
    }
    const expectsMultipoleGroup = expectedIds.includes("sourceOrderControl");
    if (Boolean(status[shape]?.multipoleGroupVisible) !== expectsMultipoleGroup) {
      failures.push(`${shape} source multipole group visibility is inconsistent`);
    }
  }
  return {
    id: "source_dependent_params_visibility",
    preset: "current",
    priority: "P1",
    ...status,
    passed: failures.length === 0,
    failures,
  };
}

async function runSceneObservablesSmoke(page) {
  const status = await page.evaluate(async () => {
    const selectAndRead = async (preset) => {
      const input = document.getElementById("presetInput");
      if (!input || typeof updateStats !== "function" || typeof FdtdSceneObservables === "undefined") {
        return { preset, loaded: false, panelText: "", rowCount: 0, report: null };
      }
      input.value = preset;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      updateStats();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return {
        preset: state.preset,
        loaded: true,
        panelText: document.getElementById("sceneObservableResults")?.textContent || "",
        rowCount: document.querySelectorAll(".scene-observable-row").length,
        report:
          typeof sceneObservables !== "undefined" && typeof sceneObservables.buildSceneObservables === "function"
            ? sceneObservables.buildSceneObservables()
            : null,
      };
    };
    return {
      planeWaveAir: await selectAndRead("planeWaveAir"),
      pmlAbsorption: await selectAndRead("pmlAbsorption"),
      doubleSlit: await selectAndRead("doubleSlit"),
      phasedDipoleArray: await selectAndRead("phasedDipoleArray"),
      normalInterface: await selectAndRead("normalInterface"),
      slabWaveguide: await selectAndRead("slabWaveguide"),
      sppGrating: await selectAndRead("sppGrating"),
      phcWaveguide: await selectAndRead("phcWaveguide"),
      kerker2d: await selectAndRead("kerker2d"),
      drudeMetal: await selectAndRead("drudeMetal"),
      valleyHall: await selectAndRead("valleyHall"),
      metasurfacePhaseBars: await selectAndRead("metasurfacePhaseBars"),
      microstrip: await selectAndRead("microstrip"),
      pecCavity: await selectAndRead("pecCavity"),
      quarterWaveCavity: await selectAndRead("quarterWaveCavity"),
      fanoResonator: await selectAndRead("fanoResonator"),
      sshInterface: await selectAndRead("sshInterface"),
      ptSymmetricCoupler: await selectAndRead("ptSymmetricCoupler"),
      perfectAbsorber: await selectAndRead("perfectAbsorber"),
      negativeIndexSlab: await selectAndRead("negativeIndexSlab"),
      chiralMedium: await selectAndRead("chiralMedium"),
      shgSlab: await selectAndRead("shgSlab"),
      temporalModulation: await selectAndRead("temporalModulation"),
    };
  });
  const failures = [];
  if (
    !status.planeWaveAir.loaded ||
    !status.pmlAbsorption.loaded ||
    !status.doubleSlit.loaded ||
    !status.phasedDipoleArray.loaded ||
    !status.normalInterface.loaded ||
    !status.slabWaveguide.loaded ||
    !status.sppGrating.loaded ||
    !status.phcWaveguide.loaded ||
    !status.kerker2d.loaded ||
    !status.drudeMetal.loaded ||
    !status.valleyHall.loaded ||
    !status.metasurfacePhaseBars.loaded ||
    !status.microstrip.loaded ||
    !status.pecCavity.loaded ||
    !status.quarterWaveCavity.loaded ||
    !status.fanoResonator.loaded ||
    !status.sshInterface.loaded ||
    !status.ptSymmetricCoupler.loaded ||
    !status.perfectAbsorber.loaded ||
    !status.negativeIndexSlab.loaded ||
    !status.chiralMedium.loaded ||
    !status.shgSlab.loaded ||
    !status.temporalModulation.loaded
  ) {
    failures.push("scene observable module or results panel did not load");
  }
  if (!status.planeWaveAir.panelText.includes("Carrier grid scale")) failures.push("planeWaveAir does not expose the grid-scale observable");
  if (!status.pmlAbsorption.panelText.includes("Open-boundary residual")) failures.push("pmlAbsorption does not expose the open-boundary residual observable");
  if (!status.doubleSlit.panelText.includes("Aperture geometry")) failures.push("doubleSlit does not expose the aperture geometry observable");
  if (!status.doubleSlit.panelText.includes("Diffraction scale")) failures.push("doubleSlit does not expose the diffraction-scale observable");
  if (!status.phasedDipoleArray.panelText.includes("Array phase law")) failures.push("phasedDipoleArray does not expose the array phase-law observable");
  if (!status.normalInterface.panelText.includes("R_theory=0.040")) failures.push("normalInterface does not expose the Fresnel R_theory reference");
  if (!status.normalInterface.panelText.includes("Spectral R/T/A")) failures.push("normalInterface does not expose the spectral R/T/A observable");
  if ((status.normalInterface.rowCount || 0) < 1) failures.push("normalInterface did not render scene observable rows");
  if (!status.slabWaveguide.panelText.includes("Mode-port overlap")) failures.push("slabWaveguide does not expose the mode-port observable");
  if (!status.slabWaveguide.panelText.includes("Guided-flux beta")) failures.push("slabWaveguide does not expose the guided beta observable");
  if (!status.sppGrating.panelText.includes("Planar SPP phase match")) failures.push("sppGrating does not expose the planar SPP phase-match observable");
  if (!status.sppGrating.panelText.includes("Grating momentum")) failures.push("sppGrating does not expose the grating momentum observable");
  const gratingRows = status.sppGrating.report?.rows || [];
  const gratingMomentum = gratingRows.find((item) => item.metric === "Grating momentum");
  if (gratingMomentum?.level !== "ok") failures.push("sppGrating grating momentum observable is not marked ok");
  if (!status.phcWaveguide.panelText.includes("Line-defect geometry")) failures.push("phcWaveguide does not expose the line-defect geometry observable");
  if (!status.phcWaveguide.panelText.includes("Line-defect energy")) failures.push("phcWaveguide does not expose the line-defect energy observable");
  const phcRows = status.phcWaveguide.report?.rows || [];
  const phcGeometry = phcRows.find((item) => item.metric === "Line-defect geometry");
  if (phcGeometry?.level !== "ok") failures.push("phcWaveguide line-defect geometry observable is not marked ok");
  if (!status.kerker2d.panelText.includes("Scatterer geometry")) failures.push("kerker2d does not expose the scatterer geometry observable");
  if (!status.kerker2d.panelText.includes("Size-parameter reference")) failures.push("kerker2d does not expose the size-parameter observable");
  if (!status.drudeMetal.panelText.includes("Material model contract")) failures.push("drudeMetal does not expose the material-model observable");
  if (!status.drudeMetal.panelText.includes("Carrier epsilon")) failures.push("drudeMetal does not expose the carrier-epsilon observable");
  if (!status.valleyHall.panelText.includes("Topological lattice geometry")) failures.push("valleyHall does not expose the topological lattice observable");
  if (!status.metasurfacePhaseBars.panelText.includes("Metasurface phase-bar ladder")) failures.push("metasurfacePhaseBars does not expose the metasurface geometry observable");
  if (!status.microstrip.panelText.includes("Guided-flux beta")) failures.push("microstrip does not expose the guided beta observable");
  if (!status.pecCavity.panelText.includes("Resonator spectrum/Q")) failures.push("pecCavity does not expose the resonator observable");
  if (!status.quarterWaveCavity.panelText.includes("Resonator spectrum/Q")) failures.push("quarterWaveCavity does not expose the resonator observable");
  if (!status.fanoResonator.panelText.includes("Resonator spectrum/Q")) failures.push("fanoResonator does not expose the resonator observable");
  if (!status.sshInterface.panelText.includes("SSH coupling topology")) failures.push("sshInterface does not expose the SSH topology observable");
  if (!status.ptSymmetricCoupler.panelText.includes("PT gain/loss ratio")) failures.push("ptSymmetricCoupler does not expose the PT modal observable");
  if (!status.perfectAbsorber.panelText.includes("Lossy absorber mask")) failures.push("perfectAbsorber does not expose the absorber material observable");
  if (!status.negativeIndexSlab.panelText.includes("Double-negative material")) failures.push("negativeIndexSlab does not expose the double-negative material observable");
  if (!status.chiralMedium.panelText.includes("Bianisotropic material")) failures.push("chiralMedium does not expose the bianisotropic material observable");
  if (!status.shgSlab.panelText.includes("Second-harmonic proxy")) failures.push("shgSlab does not expose the harmonic observable");
  if (!status.temporalModulation.panelText.includes("Modulation phase contract")) failures.push("temporalModulation does not expose the modulation phase observable");
  return {
    id: "scene_observables_panel",
    preset: "planeWaveAir,pmlAbsorption,doubleSlit,phasedDipoleArray,normalInterface,slabWaveguide,sppGrating,phcWaveguide,kerker2d,drudeMetal,valleyHall,metasurfacePhaseBars,microstrip,pecCavity,quarterWaveCavity,fanoResonator,sshInterface,ptSymmetricCoupler,perfectAbsorber,negativeIndexSlab,chiralMedium,shgSlab,temporalModulation",
    priority: "P1",
    ...status,
    passed: failures.length === 0,
    failures,
  };
}

async function runFloatingContextMenuDragSmoke(page) {
  await selectPreset(page, "planeWaveAir");
  const status = await page.evaluate(async () => {
    const canvas = document.getElementById("simCanvas");
    const menu = document.getElementById("sourceMenu");
    const header = menu?.querySelector(".source-menu-header");
    if (!canvas || !menu || !header || typeof openSourceMenuAt !== "function") {
      return { opened: false, draggable: null, movedX: 0, movedY: 0, withinFrame: false };
    }
    const canvasRect = canvas.getBoundingClientRect();
    openSourceMenuAt(canvasRect.left + canvasRect.width * 0.38, canvasRect.top + canvasRect.height * 0.28, null);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const before = menu.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const pointerId = 37;
    const startX = headerRect.left + Math.min(36, headerRect.width * 0.35);
    const startY = headerRect.top + Math.min(18, headerRect.height * 0.5);
    header.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId,
        button: 0,
        buttons: 1,
        clientX: startX,
        clientY: startY,
      })
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId,
        buttons: 1,
        clientX: startX + 96,
        clientY: startY + 54,
      })
    );
    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId,
        button: 0,
        buttons: 0,
        clientX: startX + 96,
        clientY: startY + 54,
      })
    );
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const after = menu.getBoundingClientRect();
    const frame = menu.parentElement.getBoundingClientRect();
    return {
      opened: menu.hidden === false,
      draggable: menu.dataset.floatingMenuDraggable,
      movedX: Number((after.left - before.left).toFixed(1)),
      movedY: Number((after.top - before.top).toFixed(1)),
      withinFrame:
        after.left >= frame.left - 0.5 &&
        after.top >= frame.top - 0.5 &&
        after.right <= frame.right + 0.5 &&
        after.bottom <= frame.bottom + 0.5,
    };
  });
  const failures = [];
  if (!status.opened) failures.push("source menu did not open before the drag test");
  if (status.draggable !== "true") failures.push("source menu did not advertise draggable state on a large viewport");
  if (Math.abs(status.movedX) < 20 && Math.abs(status.movedY) < 20) failures.push("source menu did not move after dragging the header");
  if (!status.withinFrame) failures.push("dragged source menu escaped the canvas frame");
  return {
    id: "floating_context_menu_drag",
    preset: "current",
    priority: "P1",
    ...status,
    passed: failures.length === 0,
    failures,
  };
}

async function runReflectiveBoundaryWallSmoke(page) {
  await selectPreset(page, "empty");
  const status = await page.evaluate(() => {
    state.running = false;
    for (const side of ["left", "right", "top", "bottom"]) setBoundarySideMode(side, "absorbing");
    setBoundarySideMode("right", "reflective");
    sim.buildBoundary();
    sim.clearBoundarySideMaterials("right");
    sim.clearCpmlMaterials();
    sim.resetFields();

    const layer = sim.boundaryControlLayer();
    const thickness = sim.reflectiveWallThicknessCells(layer);
    const wallStart = sim.nx - layer;
    const wallEnd = Math.min(sim.nx, wallStart + thickness);
    const probeX = Math.max(1, wallStart - 3);
    const probeY = Math.floor(sim.ny * 0.5);
    const probeIdx = sim.id(probeX, probeY);
    sim.ez[probeIdx] = 1;
    sim.ezx[probeIdx] = 0.5;
    sim.ezy[probeIdx] = 0.5;
    sim.hx[probeIdx] = 0.25;
    sim.hy[probeIdx] = -0.25;

    for (let y = 1; y < sim.ny - 1; y += 1) {
      for (let x = wallStart; x < wallEnd; x += 1) {
        const idx = sim.id(x, y);
        sim.ez[idx] = 1;
        sim.ezx[idx] = 0.5;
        sim.ezy[idx] = 0.5;
        sim.hx[idx] = 0.25;
        sim.hy[idx] = -0.25;
      }
    }

    sim.zeroBoundaryFields();

    let wallAbs = 0;
    for (let y = 1; y < sim.ny - 1; y += 1) {
      for (let x = wallStart; x < wallEnd; x += 1) {
        const idx = sim.id(x, y);
        wallAbs += Math.abs(sim.ez[idx]) + Math.abs(sim.ezx[idx]) + Math.abs(sim.ezy[idx]) + Math.abs(sim.hx[idx]) + Math.abs(sim.hy[idx]);
      }
    }
    const probeAbs =
      Math.abs(sim.ez[probeIdx]) +
      Math.abs(sim.ezx[probeIdx]) +
      Math.abs(sim.ezy[probeIdx]) +
      Math.abs(sim.hx[probeIdx]) +
      Math.abs(sim.hy[probeIdx]);

    return {
      boundary: { ...state.boundarySides },
      cpmlLayer: sim.cpmlLayer,
      layer,
      thickness,
      wallStart,
      activeInteriorMaxX: sim.activeInteriorMaxX(),
      sourcePlacementMaxX: sim.sourcePlacementMaxX(),
      wallAbs,
      probeAbs,
    };
  });
  const failures = [];
  if (status.boundary?.right !== "reflective") failures.push("right boundary did not enter reflective mode");
  if (status.wallAbs !== 0) failures.push("reflective boundary wall did not zero the visible PEC strip");
  if (status.probeAbs <= 0) failures.push("reflective boundary zeroing leaked into the active interior");
  if (status.activeInteriorMaxX >= status.wallStart) failures.push("active interior overlaps the reflective wall");
  if (status.sourcePlacementMaxX >= status.wallStart) failures.push("source placement overlaps the reflective wall");
  return {
    id: "reflective_boundary_wall",
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
    const materialDetailPanel = document.querySelector(".material-detail-panel");
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
    const visibleMaterialInputs = () =>
      Array.from(document.querySelectorAll("#brushMaterialGrid input")).filter(isRendered);
    const visibleInputGridShape = (inputs) => ({
      columns: new Set(inputs.map((input) => Math.round(input.getBoundingClientRect().left / 4))).size,
      rows: new Set(inputs.map((input) => Math.round(input.getBoundingClientRect().top / 4))).size,
    });

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
    if (materialDetailPanel) materialDetailPanel.open = false;
    updateControlText();
    const advancedMaterialClosedByDefault = materialDetailPanel?.open === false;
    const hiddenWhenOff = dependentSelectors.every(allHidden);
    const modulationPhaseControl = document.getElementById("modulationPhaseInput")?.closest("label");
    const modulationPhaseHiddenWhenOff = modulationPhaseControl?.hidden === true && !isRendered(modulationPhaseControl);
    const dispersionHiddenWhenNone = allHidden(".dispersion-params");
    const materialWarning = document.getElementById("materialWarning");
    const emptyWarningHidden = materialWarning?.hidden === true && !isRendered(materialWarning);
    const isotropicMaterialInputs = visibleMaterialInputs();
    const isotropicInputShape = visibleInputGridShape(isotropicMaterialInputs);
    const isotropicMaterialGrid =
      document.getElementById("brushMaterialGrid")?.classList.contains("is-anisotropic") === false &&
      isotropicMaterialInputs.length === 4 &&
      isotropicInputShape.columns === 2 &&
      isotropicInputShape.rows === 2;
    const geometryControlShape = (geometry) => {
      state.brushTool = "geometry";
      state.brushGeometry = geometry;
      updateControlText();
      const visibleGeometryIds = [
        "geometryWidthControl",
        "geometryHeightControl",
        "geometryRadiusControl",
        "geometryInnerRadiusControl",
      ].filter((id) => {
        const control = document.getElementById(id);
        return control?.hidden === false && isRendered(control);
      });
      const visibleGroups = Array.from(document.querySelectorAll(".geometry-params")).filter(
        (control) => control.hidden === false && isRendered(control)
      ).length;
      return { visibleGeometryIds, visibleGroups };
    };
    const geometryShapes = {
      rectangle: geometryControlShape("rectangle"),
      disk: geometryControlShape("disk"),
      ellipse: geometryControlShape("ellipse"),
      ring: geometryControlShape("ring"),
    };

    Object.assign(state, {
      brushTool: "paint",
      customAnisotropic: true,
      dispersionModel: "lorentz",
      materialConductivityEnabled: true,
      materialGyrotropyEnabled: true,
      materialModulationEnabled: true,
    });
    if (materialDetailPanel) materialDetailPanel.open = true;
    updateControlText();
    const gyrotropyVisibleWhenOn = allVisible(".gyrotropy-params");
    const modulationVisibleWhenOn = allVisible(".modulation-params");
    const visibleModulationPhaseControl = document.getElementById("modulationPhaseInput")?.closest("label");
    const modulationPhaseVisibleWhenOn = visibleModulationPhaseControl?.hidden === false && isRendered(visibleModulationPhaseControl);
    const conductivityVisibleWhenOn = allVisible(".conductivity-params");
    const conductivityYControl = document.getElementById("conductivitySigmaYControl");
    const conductivityYVisibleWhenAnisotropic = conductivityYControl?.hidden === false && isRendered(conductivityYControl);
    const anisotropicMaterialInputs = visibleMaterialInputs();
    const anisotropicMaterialGrid =
      document.getElementById("brushMaterialGrid")?.classList.contains("is-anisotropic") === true &&
      anisotropicMaterialInputs.length === 8 &&
      Array.from(document.querySelectorAll(".material-tensor-part")).filter(isRendered).length === 2 &&
      Array.from(document.querySelectorAll(".material-tensor-real input")).filter(isRendered).length === 4 &&
      Array.from(document.querySelectorAll(".material-tensor-imag input")).filter(isRendered).length === 4;
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
      advancedMaterialClosedByDefault,
      hiddenWhenOff,
      modulationPhaseHiddenWhenOff,
      dispersionHiddenWhenNone,
      emptyWarningHidden,
      isotropicMaterialGrid,
      geometryShapes,
      gyrotropyVisibleWhenOn,
      modulationVisibleWhenOn,
      modulationPhaseVisibleWhenOn,
      conductivityVisibleWhenOn,
      conductivityYVisibleWhenAnisotropic,
      anisotropicMaterialGrid,
      lorentzFieldsVisible,
      unrelatedDispersionFieldsHidden,
      hiddenWhenNonCustom,
    };
  });
  const failures = [];
  if (!status.advancedMaterialClosedByDefault) failures.push("advanced material model should start collapsed");
  if (!status.hiddenWhenOff) failures.push("dependent draw parameter groups remain visible when disabled");
  if (!status.modulationPhaseHiddenWhenOff) failures.push("modulation phase remains visible when modulation is disabled");
  if (!status.dispersionHiddenWhenNone) failures.push("dispersion parameter rows remain visible for the None model");
  if (!status.emptyWarningHidden) failures.push("empty material warning output remains visible");
  if (!status.isotropicMaterialGrid) failures.push("isotropic epsilon/mu controls are not arranged as a 2x2 grid");
  const geometryExpectations = {
    rectangle: ["geometryWidthControl", "geometryHeightControl"],
    disk: ["geometryRadiusControl"],
    ellipse: ["geometryWidthControl", "geometryHeightControl"],
    ring: ["geometryRadiusControl", "geometryInnerRadiusControl"],
  };
  for (const [geometry, expectedIds] of Object.entries(geometryExpectations)) {
    const actual = status.geometryShapes?.[geometry]?.visibleGeometryIds || [];
    if (actual.join(",") !== expectedIds.join(",")) {
      failures.push(`${geometry} geometry controls should show only ${expectedIds.join(", ")}`);
    }
    if ((status.geometryShapes?.[geometry]?.visibleGroups || 0) < 1) {
      failures.push(`${geometry} geometry controls should keep at least one visible group`);
    }
  }
  if (!status.gyrotropyVisibleWhenOn) failures.push("gyrotropy parameters do not appear when gyrotropy is enabled");
  if (!status.modulationVisibleWhenOn || !status.modulationPhaseVisibleWhenOn) {
    failures.push("modulation parameters do not appear when modulation is enabled");
  }
  if (!status.conductivityVisibleWhenOn || !status.conductivityYVisibleWhenAnisotropic) {
    failures.push("conductivity parameters do not appear for an enabled anisotropic material");
  }
  if (!status.anisotropicMaterialGrid) failures.push("anisotropic epsilon/mu controls are not arranged as real/imag matrices");
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
  await page.evaluate(() => {
    state.running = false;
    state.diagnosticsEnabled = false;
    state.analysisEnabled = false;
    sim.resetDiagnostics();
  });
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
    if (mode === "physics" && selectedCaseIds.size === 0) {
      report.cases.push(await runSourceMutationStability(page));
    }
    if (mode === "smoke") {
      report.cases.push(await runReproducibilitySmoke(page));
      report.cases.push(await runCanvasActionMenuSmoke(page));
      report.cases.push(await runControlNavigationSmoke(page));
      report.cases.push(await runPoyntingComponentVisibilitySmoke(page));
      report.cases.push(await runSceneMenuResponsiveSmoke(browser, url));
      report.cases.push(await runSceneMenuSelectionSmoke(browser, url));
      report.cases.push(await runMobileSimulatePanelScrollSmoke(browser, url));
      report.cases.push(await runMobileLayerScrollResetSmoke(browser, url));
      report.cases.push(await runMobileToolbarHeightSmoke(browser, url));
      report.cases.push(await runBrushStrokeContinuitySmoke(page));
      report.cases.push(await runDrawPreviewSmoke(page));
      report.cases.push(await runSourceWaveVectorOverlaySmoke(page));
      report.cases.push(await runSourceDependentParamsSmoke(page));
      report.cases.push(await runSceneObservablesSmoke(page));
      report.cases.push(await runFloatingContextMenuDragSmoke(page));
      report.cases.push(await runReflectiveBoundaryWallSmoke(page));
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
