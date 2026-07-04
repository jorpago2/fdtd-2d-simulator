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

async function stepPhysicsSimulation(page, steps) {
  return page.evaluate(async (stepCount) => {
    const sampleStride = Math.max(1, Math.floor(stepCount / 60));
    const lateStart = Math.max(0, Math.floor(stepCount * 0.78));
    let energyPeak = 0;
    let lateEnergySum = 0;
    let lateEnergySamples = 0;
    const t0 = performance.now();
    for (let step = 0; step < stepCount; step += 1) {
      sim.step();
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
    return {
      elapsedMs: performance.now() - t0,
      energyPeak,
      lateEnergyAverage: lateEnergySamples > 0 ? lateEnergySum / lateEnergySamples : 0,
      lateEnergyRatio: lateEnergySamples > 0 ? lateEnergySum / lateEnergySamples / Math.max(1e-30, energyPeak) : 0,
      diagnosticSamples: sim.diagnosticSamples || 0,
      analysisSamples: sim.analysisSamples || 0,
    };
  }, steps);
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
      powerBalanceResidual:
        sim.diagnosticSamples > 0 ? 1 - (sim.diagnosticReflectance || 0) - (sim.diagnosticTransmittance || 0) : null,
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

function recordAcceptanceIssue(status, message, warningOnly = false) {
  if (warningOnly) status.warnings.push(message);
  else status.failures.push(message);
}

async function brewsterScanMetrics(page, testCase) {
  const expectedAngle = Number(testCase.reference?.expectedAngleDeg) || 56.31;
  const scanSteps = Math.max(720, Math.trunc(Number(testCase.acceptance?.scanSteps) || 1800));
  return page.evaluate(async ({ expectedAngle, scanSteps }) => {
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
        samples: sim.diagnosticSamples || 0,
      });
    }
    Object.assign(source, savedSource);
    if (typeof normalizeSource === "function") normalizeSource(source);
    state.diagnosticsEnabled = savedDiagnostics;
    const minimum = results.reduce((best, item) => (item.reflectance < best.reflectance ? item : best), results[0]);
    return { expectedAngleDeg: expectedAngle, scanSteps, minimum, results };
  }, { expectedAngle, scanSteps });
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
    };
  });
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

async function runSmokeCase(page, testCase) {
  const steps = Math.trunc(Number(testCase.steps) || Number(matrix.profiles[testCase.profile]?.steps) || 8);
  const startedAt = Date.now();
  await selectPreset(page, testCase.preset);
  if (mode === "physics") await preparePhysicsCase(page, testCase);
  const before = await simulationSnapshot(page);
  const stepResult = mode === "physics"
    ? await stepPhysicsSimulation(page, steps)
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
    const rTolerance = Number(testCase.acceptance?.reflectanceAbsTolerance);
    const balanceTolerance = Number(testCase.acceptance?.powerBalanceTolerance);
    if (!(status.diagnostics.samples > 12)) status.failures.push("Fresnel diagnostics did not collect enough line-monitor samples");
    if (Number.isFinite(expectedR) && Number.isFinite(rTolerance)) {
      const error = Math.abs(status.diagnostics.reflectance - expectedR);
      status.diagnostics.reflectanceAbsError = error;
      if (error > rTolerance) {
        status.failures.push(`Fresnel R error ${error} exceeds ${rTolerance}`);
      }
    }
    if (Number.isFinite(balanceTolerance)) {
      const residual = Math.abs(Number(status.diagnostics.powerBalanceResidual));
      if (!Number.isFinite(residual) || residual > balanceTolerance) {
        recordAcceptanceIssue(
          status,
          `Fresnel power-balance residual ${residual} exceeds ${balanceTolerance}; line-monitor T still needs reference normalization`,
          Boolean(testCase.acceptance?.powerBalanceWarningOnly),
        );
      }
    }
  }
  if (testCase.id === "brewster_tm_minimum") {
    status.brewsterScan = await brewsterScanMetrics(page, testCase);
    const angleTolerance = Number(testCase.acceptance?.angleToleranceDeg);
    const reflectanceLimit = Number(testCase.acceptance?.maxMinimumReflectance);
    if (!status.brewsterScan?.minimum) {
      status.failures.push("Brewster scan did not produce a minimum");
    } else {
      const angleError = Math.abs(status.brewsterScan.minimum.angleDeg - status.brewsterScan.expectedAngleDeg);
      status.brewsterScan.angleErrorDeg = angleError;
      if (Number.isFinite(angleTolerance) && angleError > angleTolerance) {
        recordAcceptanceIssue(
          status,
          `Brewster scan minimum angle error ${angleError} deg exceeds ${angleTolerance} deg; oblique monitor regression is diagnostic-only`,
          Boolean(testCase.acceptance?.minimumAngleWarningOnly),
        );
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
  if (testCase.id === "slab_waveguide_confinement") {
    status.modeLaunch = await slabWaveguideLaunchMetrics(page);
    const backwardLimit = Number(testCase.acceptance?.backwardEnergyRatioMax);
    const radiationLimit = Number(testCase.acceptance?.radiationEnergyRatioMax);
    const coreFractionLimit = Number(testCase.acceptance?.coreEnergyFractionMin);
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
  }
  if (testCase.id === "resonator_ringdown_q") {
    status.analysis = await diagnosticMetrics(page);
    const minSamples = Number(testCase.acceptance?.minAnalysisSamples);
    if (Number.isFinite(minSamples) && status.analysis.analysisSamples < minSamples) {
      status.failures.push(`ringdown analysis has ${status.analysis.analysisSamples} samples, expected at least ${minSamples}`);
    }
    if (testCase.acceptance?.qProxyFinite && !(Number.isFinite(status.analysis.ringdownQ) && status.analysis.ringdownQ > 0)) {
      status.failures.push(`ringdown Q proxy is not finite and positive: ${status.analysis.ringdownQ}`);
    }
  }
  if (testCase.id === "single_slit_diffraction_symmetry" || testCase.id === "double_slit_interference_profile") {
    status.diffraction = await apertureDiffractionMetrics(page, testCase.preset === "doubleSlit" ? "double" : "single");
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
  if (testCase.id === "spp_interface_surface_localization" || testCase.id === "spp_grating_surface_coupling") {
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
  if (testCase.id === "negative_index_observable_finite" || testCase.id === "superlens_image_proxy_finite") {
    status.negativeIndex = await negativeIndexMetrics(page);
    const metrics = status.negativeIndex.metrics;
    const minSamples = Number(testCase.acceptance?.minAnalysisSamples);
    const minCells = Number(testCase.acceptance?.doubleNegativeCellsMin);
    const minCoherence = Number(testCase.acceptance?.slabPhaseCoherenceMin);
    const minTransfer = Number(testCase.acceptance?.imageTransferMin);
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
      if (Number.isFinite(minTransfer) && metrics.imageTransfer < minTransfer) {
        status.failures.push(`superlens image transfer ${metrics.imageTransfer} below ${minTransfer}`);
      }
    }
  }
  if (testCase.id === "quarter_wave_coating_low_reflection" || testCase.id === "bragg_mirror_stopband_reflection") {
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
  }
  if (
    testCase.id === "pec_cylinder_scattering_shadow" ||
    testCase.id === "dielectric_cylinder_scattering_presence" ||
    testCase.id === "mie_cylinder_high_index_response" ||
    testCase.id === "rcs_cylinder_ntff_finite" ||
    testCase.id === "lossy_cylinder_absorption_proxy" ||
    testCase.id === "dielectric_dimer_gap_coupling" ||
    testCase.id === "kerker_forward_backward_contrast"
  ) {
    status.scattering = await scatteringCylinderMetrics(page);
    const minMaterialCells = Number(testCase.acceptance?.materialCellsMin);
    const minPecCells = Number(testCase.acceptance?.pecCellsMin);
    const minLossyCells = Number(testCase.acceptance?.lossyCellsMin);
    const minHighIndexCells = Number(testCase.acceptance?.highIndexCellsMin);
    const minObjectEnergy = Number(testCase.acceptance?.objectEnergyMin);
    const maxShadowRatio = Number(testCase.acceptance?.shadowToUpstreamRatioMax);
    const minSideToBack = Number(testCase.acceptance?.sideToBackRatioMin);
    const minBackToFront = Number(testCase.acceptance?.backToFrontRatioMin);
    const minSamples = Number(testCase.acceptance?.minAnalysisSamples);
    const minScatteringTotal = Number(testCase.acceptance?.scatteringTotalMin);
    const minForwardBackward = Number(testCase.acceptance?.forwardBackwardRatioMin);
    const minBackwardForward = Number(testCase.acceptance?.backwardForwardRatioMin);
    const minObjectCount = Number(testCase.acceptance?.objectCountProxyMin);
    const minGapEnergy = Number(testCase.acceptance?.dimerGapEnergyMin);
    const minGapToObject = Number(testCase.acceptance?.dimerGapToObjectRatioMin);
    if (Number.isFinite(minMaterialCells) && status.scattering.objectMaterialCells < minMaterialCells) {
      status.failures.push(`scatterer material cells ${status.scattering.objectMaterialCells} below ${minMaterialCells}`);
    }
    if (Number.isFinite(minPecCells) && status.scattering.objectPecCells < minPecCells) {
      status.failures.push(`PEC scatterer cells ${status.scattering.objectPecCells} below ${minPecCells}`);
    }
    if (Number.isFinite(minLossyCells) && status.scattering.objectLossyCells < minLossyCells) {
      status.failures.push(`lossy scatterer cells ${status.scattering.objectLossyCells} below ${minLossyCells}`);
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
    testCase.id === "anderson_localization_trapping_proxy" ||
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
