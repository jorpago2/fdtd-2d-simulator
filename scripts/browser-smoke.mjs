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
    return {
      engine: sim.engineLabel(),
      leftGuideEnergy,
      rightGuideEnergy,
      rightCladdingEnergy,
      backwardEnergyRatio: leftGuideEnergy / Math.max(1e-30, rightGuideEnergy),
      radiationEnergyRatio: rightCladdingEnergy / Math.max(1e-30, rightGuideEnergy),
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
  if (testCase.id === "slab_waveguide_confinement") {
    status.modeLaunch = await slabWaveguideLaunchMetrics(page);
    const backwardLimit = Number(testCase.acceptance?.backwardEnergyRatioMax);
    const radiationLimit = Number(testCase.acceptance?.radiationEnergyRatioMax);
    if (!status.modeLaunch) {
      status.failures.push("slab waveguide did not expose modal launch metrics");
    } else {
      if (!(status.modeLaunch.rightGuideEnergy > 1e-12)) status.failures.push("slab waveguide did not launch measurable forward guided energy");
      if (Number.isFinite(backwardLimit) && status.modeLaunch.backwardEnergyRatio > backwardLimit) {
        status.failures.push(`backward modal energy ratio ${status.modeLaunch.backwardEnergyRatio} exceeds ${backwardLimit}`);
      }
      if (Number.isFinite(radiationLimit) && status.modeLaunch.radiationEnergyRatio > radiationLimit) {
        status.failures.push(`cladding radiation energy ratio ${status.modeLaunch.radiationEnergyRatio} exceeds ${radiationLimit}`);
      }
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
        visualVisible: Boolean(document.querySelector("#tab-simulation .visual-field-section")),
        numericsTitle: document.querySelector("#tab-config .config-summary-section h2")?.textContent.trim() || "",
      };
    };
    const simulateState = clickTab("simulation");
    const numericsState = clickTab("config");
    return {
      tabLabels,
      mobileLabels,
      hasVisualTab: Boolean(document.getElementById("tab-visual")),
      simulateState,
      numericsState,
    };
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
  if (status.numericsState?.activePanel !== "tab-config" || status.numericsState?.numericsTitle !== "Numerics") {
    failures.push("Numerics tab did not activate the numerical setup panel");
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
      const status = await page.evaluate((viewportName) => {
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
        const spotlight = document.getElementById("sceneSpotlight");
        const spotlightImage = document.querySelector("#sceneSpotlight img.scene-thumb-image");
        const title = document.getElementById("sceneSpotlightTitle");
        const description = document.getElementById("sceneSpotlightDescription");
        const search = document.getElementById("sceneSearchInput");
        const fallback = document.querySelector(".scene-select-fallback");
        const cards = document.getElementById("sceneCards");
        const panelOverflow = panel ? panel.scrollWidth - panel.clientWidth : 0;
        const activeCardImage = document.querySelector('.scene-card.is-active img.scene-thumb-image');
        const cardImageCount = document.querySelectorAll("#sceneCards img.scene-thumb-image").length;
        return {
          viewport: viewportName,
          activePanel: document.querySelector(".control-tab-panel.is-active")?.id || "",
          cardCount: cards?.querySelectorAll("[data-scene-card]").length || 0,
          cardImageCount,
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
          search: rect("#sceneSearchInput"),
          spotlight: rect("#sceneSpotlight"),
          spotlightImage: spotlightImage
            ? {
                complete: spotlightImage.complete,
                naturalHeight: spotlightImage.naturalHeight,
                naturalWidth: spotlightImage.naturalWidth,
                src: spotlightImage.getAttribute("src") || "",
              }
            : null,
          activeCardImageSrc: activeCardImage?.getAttribute("src") || "",
          titleText: title?.textContent?.trim() || "",
        };
      }, viewport.name);
      states.push(status);
      failures.push(...localErrors.map((error) => `${viewport.name}: ${error}`));
      if (status.activePanel !== "tab-scenes") failures.push(`${viewport.name}: Scene panel is not active`);
      if (!status.titleText || !status.descriptionText) failures.push(`${viewport.name}: spotlight title/description is empty`);
      if (!status.family) failures.push(`${viewport.name}: spotlight family is empty`);
      if (
        !status.spotlightImage ||
        !status.spotlightImage.src.endsWith("/topologyTemporalMod.webp") ||
        !status.spotlightImage.complete ||
        status.spotlightImage.naturalWidth <= 0 ||
        status.spotlightImage.naturalHeight <= 0
      ) {
        failures.push(`${viewport.name}: spotlight thumbnail image did not load`);
      }
      if (status.cardCount <= 0) failures.push(`${viewport.name}: scene cards did not render`);
      if (status.cardImageCount !== status.cardCount) {
        failures.push(`${viewport.name}: not every visible scene card has a thumbnail image`);
      }
      if (!status.activeCardImageSrc.endsWith("/topologyTemporalMod.webp")) {
        failures.push(`${viewport.name}: active scene card thumbnail does not match the selected scene`);
      }
      if (status.fallbackDisplay !== "none") failures.push(`${viewport.name}: fallback select is still visible`);
      if (!status.spotlight || !status.search || status.spotlight.bottom > status.search.top) {
        failures.push(`${viewport.name}: scene spotlight does not lead the scene browser`);
      }
      if (status.documentOverflow > 1) failures.push(`${viewport.name}: document horizontal overflow ${status.documentOverflow}`);
      if (status.panelOverflow > 1) failures.push(`${viewport.name}: control panel horizontal overflow ${status.panelOverflow}`);
      if (
        status.panel &&
        status.spotlight &&
        (status.spotlight.left < status.panel.left - 1 || status.spotlight.right > status.panel.right + 1)
      ) {
        failures.push(`${viewport.name}: spotlight exceeds the control panel bounds`);
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

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator("#controlDrawerToggle").click();
    await page.waitForTimeout(120);
    await page.evaluate(() => {
      document.querySelector('[data-control-tab="scenes"]')?.click();
    });
    await selectPreset(page, "planeWaveAir");
    await page.waitForTimeout(120);

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
      frequency: 0.024,
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
      report.cases.push(await runControlNavigationSmoke(page));
      report.cases.push(await runSceneMenuResponsiveSmoke(browser, url));
      report.cases.push(await runSceneMenuSelectionSmoke(browser, url));
      report.cases.push(await runMobileSimulatePanelScrollSmoke(browser, url));
      report.cases.push(await runMobileLayerScrollResetSmoke(browser, url));
      report.cases.push(await runMobileToolbarHeightSmoke(browser, url));
      report.cases.push(await runBrushStrokeContinuitySmoke(page));
      report.cases.push(await runDrawPreviewSmoke(page));
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
