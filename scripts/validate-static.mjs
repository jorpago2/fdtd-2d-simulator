#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const jsonMode = process.argv.includes("--json");

const report = {
  status: "PASS",
  blockers: [],
  warnings: [],
  checks: [],
};

function addCheck(name, status, details = "") {
  report.checks.push({ name, status, details });
  if (status === "BLOCK") report.blockers.push(`${name}: ${details}`);
  if (status === "WARN") report.warnings.push(`${name}: ${details}`);
}

function repoPath(...parts) {
  return path.join(rootDir, ...parts);
}

function readText(...parts) {
  return fs.readFileSync(repoPath(...parts), "utf8");
}

function fileExistsFromUrl(assetUrl) {
  const [pathname] = assetUrl.split("?");
  const normalized = pathname.replace(/^\.\//, "");
  return fs.existsSync(repoPath(normalized));
}

function extractAll(pattern, text, group = 1) {
  return Array.from(text.matchAll(pattern), (match) => match[group]);
}

function unique(values) {
  return Array.from(new Set(values)).sort();
}

function runNodeSyntaxCheck(files) {
  const failed = [];
  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", repoPath(file)], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0) {
      failed.push(`${file}: ${(result.stderr || result.stdout).trim()}`);
    }
  }
  addCheck(
    "javascript syntax",
    failed.length === 0 ? "PASS" : "BLOCK",
    failed.length === 0 ? `${files.length} files checked` : failed.join("\n"),
  );
}

function loadCatalog() {
  const code = [
    readText("src", "constants.js"),
    readText("src", "catalog.js"),
    "globalThis.__catalog = { materialNames, sourceShapeLabels, sceneDescriptions, BOUNDARY_SIDES };",
    "globalThis.__constants = { COURANT, DEFAULT_GRID, MAX_GRID };",
  ].join("\n");
  const context = { console, Math, Set, Object, Array, Number, String, RegExp };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: "catalog-bundle.js" });
  return {
    catalog: context.__catalog,
    constants: context.__constants,
  };
}

function validateHtmlAssets(indexHtml) {
  const scripts = extractAll(/<script\s+[^>]*src="([^"]+)"/g, indexHtml);
  const stylesheets = extractAll(/<link\s+[^>]*rel="stylesheet"\s+href="([^"]+)"/g, indexHtml);
  const missing = [...scripts, ...stylesheets].filter((asset) => !fileExistsFromUrl(asset));
  addCheck(
    "html linked assets",
    missing.length === 0 ? "PASS" : "BLOCK",
    missing.length === 0 ? `${scripts.length} scripts and ${stylesheets.length} stylesheets found` : `Missing: ${missing.join(", ")}`,
  );
}

function validatePresets(indexHtml, sceneDescriptions) {
  const presetSelect = indexHtml.match(/<select\s+id="presetInput"[\s\S]*?<\/select>/)?.[0] || "";
  const dropdownPresets = unique(extractAll(/<option\s+value="([^"]+)"/g, presetSelect));
  const presetCases = unique(extractAll(/case\s+"([^"]+)"/g, readText("src", "fdtd-presets.js")));
  const descriptions = unique(Object.keys(sceneDescriptions));
  const missingPresetCases = dropdownPresets.filter((preset) => preset !== "empty" && !presetCases.includes(preset));
  const missingDescriptions = dropdownPresets.filter((preset) => !descriptions.includes(preset));
  const orphanDescriptions = descriptions.filter((preset) => !dropdownPresets.includes(preset));

  addCheck(
    "preset dropdown maps to applyPreset",
    missingPresetCases.length === 0 ? "PASS" : "BLOCK",
    missingPresetCases.length === 0 ? `${dropdownPresets.length} dropdown presets checked` : missingPresetCases.join(", "),
  );
  addCheck(
    "preset descriptions",
    missingDescriptions.length === 0 ? "PASS" : "BLOCK",
    missingDescriptions.length === 0 ? "Every dropdown preset has a catalog description" : missingDescriptions.join(", "),
  );
  addCheck(
    "orphan catalog descriptions",
    orphanDescriptions.length === 0 ? "PASS" : "WARN",
    orphanDescriptions.length === 0 ? "No orphan descriptions" : orphanDescriptions.join(", "),
  );

  return dropdownPresets;
}

function validateValidationMatrix(dropdownPresets) {
  const matrix = JSON.parse(readText("scripts", "validation-matrix.json"));
  const ids = matrix.cases.map((testCase) => testCase.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const missingRequired = matrix.requiredP0Cases.filter((id) => !ids.includes(id));
  const unknownPresets = matrix.cases
    .map((testCase) => testCase.preset)
    .filter((preset) => !dropdownPresets.includes(preset));
  const p0Cases = matrix.cases.filter((testCase) => testCase.priority === "P0");
  const p0WithoutSmoke = p0Cases.filter((testCase) => !testCase.browserSmoke).map((testCase) => testCase.id);

  addCheck(
    "validation matrix ids",
    duplicateIds.length === 0 ? "PASS" : "BLOCK",
    duplicateIds.length === 0 ? `${ids.length} cases` : `Duplicates: ${unique(duplicateIds).join(", ")}`,
  );
  addCheck(
    "validation matrix required P0",
    missingRequired.length === 0 ? "PASS" : "BLOCK",
    missingRequired.length === 0 ? `${matrix.requiredP0Cases.length} required P0 cases present` : missingRequired.join(", "),
  );
  addCheck(
    "validation matrix presets",
    unknownPresets.length === 0 ? "PASS" : "BLOCK",
    unknownPresets.length === 0 ? "All validation presets exist in the scene dropdown" : unique(unknownPresets).join(", "),
  );
  addCheck(
    "P0 browser smoke coverage",
    p0WithoutSmoke.length === 0 ? "PASS" : "WARN",
    p0WithoutSmoke.length === 0 ? `${p0Cases.length} P0 cases marked for browser smoke` : p0WithoutSmoke.join(", "),
  );
  return matrix;
}

function validateNumerics(constants) {
  const cflLimit = 1 / Math.sqrt(2);
  const courant = Number(constants.COURANT);
  addCheck(
    "2D Yee CFL",
    Number.isFinite(courant) && courant < cflLimit ? "PASS" : "BLOCK",
    `COURANT=${courant}, limit=${cflLimit.toFixed(6)}`,
  );
  addCheck(
    "default grid bounds",
    constants.DEFAULT_GRID.nx <= constants.MAX_GRID.nx && constants.DEFAULT_GRID.ny <= constants.MAX_GRID.ny ? "PASS" : "BLOCK",
    `default=${constants.DEFAULT_GRID.nx}x${constants.DEFAULT_GRID.ny}, max=${constants.MAX_GRID.nx}x${constants.MAX_GRID.ny}`,
  );
}

function validateUiReproducibility(indexHtml, appJs) {
  const requiredIds = [
    "stabilityCflValue",
    "stabilityResolutionValue",
    "stabilityMediaValue",
    "stabilityEstimateValue",
    "exportSceneBtn",
    "importSceneBtn",
    "copySceneUrlBtn",
    "shareSceneUrlOutput",
  ];
  const missingIds = requiredIds.filter((id) => !indexHtml.includes(`id="${id}"`));
  const requiredSymbols = [
    "SCENE_SNAPSHOT_VERSION",
    "exportSceneState",
    "applySceneState",
    "copySceneUrl",
    "updateStabilitySummary",
  ];
  const missingSymbols = requiredSymbols.filter((symbol) => !appJs.includes(symbol));
  addCheck(
    "reproducibility UI ids",
    missingIds.length === 0 ? "PASS" : "BLOCK",
    missingIds.length === 0 ? `${requiredIds.length} ids found` : missingIds.join(", "),
  );
  addCheck(
    "reproducibility functions",
    missingSymbols.length === 0 ? "PASS" : "BLOCK",
    missingSymbols.length === 0 ? `${requiredSymbols.length} functions/symbols found` : missingSymbols.join(", "),
  );
}

function validatePerformanceRoute(indexHtml, appJs, wasmBackendJs, wasmCpp) {
  const requiredIds = [
    "performanceBackendOutput",
    "performanceGridOutput",
    "performanceStepOutput",
    "performanceRenderOutput",
    "performanceRenderMapOutput",
    "performanceRenderPresentOutput",
    "performanceRenderOverlayOutput",
    "performanceMeasureOutput",
    "performanceThroughputOutput",
    "performanceStatus",
    "performanceResetBtn",
  ];
  const missingIds = requiredIds.filter((id) => !indexHtml.includes(`id="${id}"`));
  const requiredSymbols = [
    "performanceStats",
    "timeStepBatch",
    "instrumentSimulationPerformance",
    "updatePerformanceStats",
    "supportsConductivity",
    "kernel_features",
  ];
  const performanceSources = `${appJs}\n${wasmBackendJs}\n${wasmCpp}`;
  const missingSymbols = requiredSymbols.filter((symbol) => !performanceSources.includes(symbol));
  const requiredFiles = [
    ["docs", "PERFORMANCE.md"],
    ["wasm-src", "fdtd-core.cpp"],
    ["scripts", "build-wasm-cpp.ps1"],
  ];
  const missingFiles = requiredFiles
    .map((parts) => ({ parts, filePath: repoPath(...parts) }))
    .filter((item) => !fs.existsSync(item.filePath))
    .map((item) => item.parts.join("/"));
  const failures = [
    ...missingIds.map((id) => `missing id ${id}`),
    ...missingSymbols.map((symbol) => `missing symbol ${symbol}`),
    ...missingFiles.map((file) => `missing file ${file}`),
  ];
  addCheck(
    "performance route",
    failures.length === 0 ? "PASS" : "BLOCK",
    failures.length === 0 ? "Runtime panel and C++ WASM migration files found" : failures.join(", "),
  );
}

function main() {
  const indexHtml = readText("index.html");
  const appJs = readText("app.js");
  const wasmBackendJs = readText("src", "wasm-backend.js");
  const wasmCpp = readText("wasm-src", "fdtd-core.cpp");
  const jsFiles = [
    "src/constants.js",
    "src/wasm-backend.js",
    "src/numerics.js",
    "src/colormaps.js",
    "src/catalog.js",
    "src/fdtd-sim.js",
    "src/fdtd-materials.js",
    "src/fdtd-boundaries.js",
    "src/fdtd-presets.js",
    "src/fdtd-sources.js",
    "src/fdtd-diagnostics.js",
    "src/fdtd-yee.js",
    "src/fdtd-rendering.js",
    "app.js",
    "scripts/performance-benchmark.mjs",
  ];

  runNodeSyntaxCheck(jsFiles);
  validateHtmlAssets(indexHtml);
  const { catalog, constants } = loadCatalog();
  const dropdownPresets = validatePresets(indexHtml, catalog.sceneDescriptions);
  validateValidationMatrix(dropdownPresets);
  validateNumerics(constants);
  validateUiReproducibility(indexHtml, appJs);
  validatePerformanceRoute(indexHtml, appJs, wasmBackendJs, wasmCpp);

  if (report.blockers.length > 0) report.status = "BLOCK";
  else if (report.warnings.length > 0) report.status = "WARN";

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Static validation: ${report.status}`);
    for (const check of report.checks) {
      console.log(`- ${check.status}: ${check.name}${check.details ? ` (${check.details})` : ""}`);
    }
  }
  process.exit(report.status === "BLOCK" ? 1 : 0);
}

main();
