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

function fileExistsFromUrl(assetUrl, baseDir = "") {
  const [pathname] = assetUrl.split("?");
  const normalized = pathname.replace(/^\.\//, "");
  return fs.existsSync(repoPath(baseDir, normalized));
}

function assetPath(assetUrl) {
  const [pathname] = String(assetUrl || "").split("?");
  return pathname.replace(/^\.\//, "").replace(/\\/g, "/");
}

function resolveRelativeAsset(assetUrl, baseFile) {
  const cleanAsset = assetPath(assetUrl);
  if (!baseFile || cleanAsset.startsWith("/")) return cleanAsset.replace(/^\/+/, "");
  const baseDir = path.posix.dirname(baseFile.replace(/\\/g, "/"));
  return path.posix.normalize(path.posix.join(baseDir, cleanAsset));
}

function scriptPathMap(indexHtml) {
  const scripts = extractAll(/<script\s+[^>]*src="([^"]+)"/g, indexHtml).map(assetPath);
  return new Map(scripts.map((scriptPath) => [path.posix.basename(scriptPath), scriptPath]));
}

function readActiveScript(scriptMap, basename, fallbackParts) {
  const activePath = scriptMap.get(basename);
  return activePath ? readText(...activePath.split("/")) : readText(...fallbackParts);
}

function extractAll(pattern, text, group = 1) {
  return Array.from(text.matchAll(pattern), (match) => match[group]);
}

function unique(values) {
  return Array.from(new Set(values)).sort();
}

function listFilesRecursive(relativeDir, extension) {
  const absoluteDir = repoPath(relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(relativePath, extension));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(relativePath.replace(/\\/g, "/"));
    }
  }
  return files;
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

function validateJsNextCore() {
  const result = spawnSync(process.execPath, [repoPath("scripts", "validate-js-next-core.mjs")], {
    encoding: "utf8",
    windowsHide: true,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  addCheck(
    "js-next core equivalence",
    result.status === 0 ? "PASS" : "BLOCK",
    output || "No output",
  );
}

function loadCatalog(constantsJs, catalogJs) {
  const code = [
    constantsJs,
    catalogJs,
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

function workerImportAssets(workerJs) {
  const importBlocks = extractAll(/importScripts\(([\s\S]*?)\);/g, workerJs);
  return unique(importBlocks.flatMap((block) => extractAll(/["']([^"']+)["']/g, block)));
}

function validateWorkerImports(workerJs, workerFile) {
  const imports = workerImportAssets(workerJs);
  const resolvedImports = imports.map((asset) => resolveRelativeAsset(asset, workerFile));
  const missing = resolvedImports.filter((asset) => !fs.existsSync(repoPath(asset)));
  addCheck(
    "worker importScripts assets",
    missing.length === 0 ? "PASS" : "BLOCK",
    missing.length === 0 ? `${imports.length} worker imports found` : `Missing: ${missing.join(", ")}`,
  );
  return resolvedImports;
}

function validatePresets(indexHtml, sceneDescriptions, presetSourceJs) {
  const presetSelect = indexHtml.match(/<select\s+id="presetInput"[\s\S]*?<\/select>/)?.[0] || "";
  const dropdownPresets = unique(extractAll(/<option\s+value="([^"]+)"/g, presetSelect));
  const presetCases = unique(extractAll(/case\s+"([^"]+)"/g, presetSourceJs));
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

function validateSceneCatalogJson(dropdownPresets, sceneDescriptions) {
  const catalogPath = repoPath("js-next", "runtime", "data", "scene-catalog.json");
  if (!fs.existsSync(catalogPath)) {
    addCheck("scene catalog JSON", "BLOCK", "Missing js-next/runtime/data/scene-catalog.json");
    return;
  }

  let catalog = null;
  try {
    catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  } catch (error) {
    addCheck("scene catalog JSON", "BLOCK", error.message);
    return;
  }

  const groups = Array.isArray(catalog.groups) ? catalog.groups : [];
  const scenes = Array.isArray(catalog.scenes) ? catalog.scenes : [];
  const jsonSceneIds = scenes.map((scene) => scene.id).filter(Boolean);
  const duplicateJsonIds = jsonSceneIds.filter((id, index) => jsonSceneIds.indexOf(id) !== index);
  const groupIds = new Set(groups.map((group) => group.id));
  const scenesWithoutGroup = scenes.filter((scene) => scene.groupId && !groupIds.has(scene.groupId)).map((scene) => scene.id);
  const missingFromJson = dropdownPresets.filter((preset) => !jsonSceneIds.includes(preset));
  const orphanJsonScenes = jsonSceneIds.filter((preset) => !dropdownPresets.includes(preset));
  const missingJsonDescriptions = jsonSceneIds.filter((preset) => !String(scenes.find((scene) => scene.id === preset)?.description || "").trim());
  const mismatchedDescriptions = jsonSceneIds.filter((preset) => {
    const jsonDescription = String(scenes.find((scene) => scene.id === preset)?.description || "");
    const embeddedDescription = String(sceneDescriptions[preset] || "");
    return embeddedDescription && jsonDescription !== embeddedDescription;
  });
  const missingGuides = scenes.filter((scene) => !scene.guide || typeof scene.guide !== "object").map((scene) => scene.id);

  const failures = [
    ...duplicateJsonIds.map((id) => `duplicate id ${id}`),
    ...scenesWithoutGroup.map((id) => `unknown group for ${id}`),
    ...missingFromJson.map((id) => `missing ${id}`),
    ...orphanJsonScenes.map((id) => `orphan ${id}`),
    ...missingJsonDescriptions.map((id) => `empty description for ${id}`),
    ...missingGuides.map((id) => `missing guide for ${id}`),
  ];
  addCheck(
    "scene catalog JSON",
    failures.length === 0 ? "PASS" : "BLOCK",
    failures.length === 0 ? `${jsonSceneIds.length} scenes in ${groups.length} groups` : failures.join(", "),
  );
  addCheck(
    "scene catalog description parity",
    mismatchedDescriptions.length === 0 ? "PASS" : "WARN",
    mismatchedDescriptions.length === 0 ? "JSON descriptions match embedded catalog" : mismatchedDescriptions.join(", "),
  );
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

function validateUiReproducibility(indexHtml, appJs, sceneCodecJs = "", sceneReproJs = "") {
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
  const reproducibilityJs = `${appJs}\n${sceneCodecJs}\n${sceneReproJs}`;
  const missingSymbols = requiredSymbols.filter((symbol) => !reproducibilityJs.includes(symbol));
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

function validatePerformanceRoute(indexHtml, appJs, appPerformanceJs, fdtdSimJs, fdtdEngineRoutingJs, wasmBackendJs, workerEngineJs, wasmCpp, activeFiles) {
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
    "supportsKerr",
    "supportsSaturableGain",
    "supportsTensorGyro",
    "canUseCompiledMaterialStep",
    "canUseCompiledKerrResponse",
    "FdtdWorkerEngine",
    "fdtd-worker.js",
    "kernel_features",
  ];
  const performanceSources = `${indexHtml}\n${appJs}\n${appPerformanceJs}\n${fdtdSimJs}\n${fdtdEngineRoutingJs}\n${wasmBackendJs}\n${workerEngineJs}\n${wasmCpp}`;
  const missingSymbols = requiredSymbols.filter((symbol) => !performanceSources.includes(symbol));
  const requiredFiles = [
    ["docs", "PERFORMANCE.md"],
    ["wasm-src", "fdtd-core.cpp"],
    ["scripts", "build-wasm-cpp.ps1"],
    activeFiles.fdtdWorker.split("/"),
    activeFiles.workerEngine.split("/"),
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
  const activeScripts = scriptPathMap(indexHtml);
  const appFile = activeScripts.get("main.js") || "legacy/js/app.js";
  const fdtdWorkerFile = activeScripts.get("fdtd-worker.js") || "js-next/runtime/simulation/fdtd-worker.js";
  const workerEngineFile = activeScripts.get("worker-engine.js") || "legacy/js/src/worker-engine.js";
  const appJs = readText(...appFile.split("/"));
  const sceneCodecJs = readActiveScript(activeScripts, "scene-codec.js", ["legacy/js/src", "scene-codec.js"]);
  const sceneReproJs = readActiveScript(activeScripts, "scene-repro.js", ["legacy/js/src", "scene-repro.js"]);
  const fdtdSimJs = readActiveScript(activeScripts, "fdtd-sim.js", ["legacy/js/src", "fdtd-sim.js"]);
  const fdtdEngineRoutingJs = readActiveScript(activeScripts, "fdtd-engine-routing.js", ["legacy/js/src", "fdtd-engine-routing.js"]);
  const fdtdWorkerJs = readText(...fdtdWorkerFile.split("/"));
  const wasmBackendJs = readActiveScript(activeScripts, "wasm-backend.js", ["legacy/js/src", "wasm-backend.js"]);
  const workerEngineJs = readText(...workerEngineFile.split("/"));
  const wasmCpp = readText("wasm-src", "fdtd-core.cpp");
  const linkedJsFiles = extractAll(/<script\s+[^>]*src="([^"]+)"/g, indexHtml)
    .map(assetPath)
    .filter(Boolean);
  const workerImportFiles = workerImportAssets(fdtdWorkerJs)
    .map((asset) => resolveRelativeAsset(asset, fdtdWorkerFile))
    .filter(Boolean);
  const jsNextFiles = listFilesRecursive("js-next", ".js");
  const jsFiles = unique([
    ...linkedJsFiles,
    ...workerImportFiles,
    ...jsNextFiles,
    "scripts/serve-static.mjs",
    "scripts/validate-js-next-core.mjs",
    "scripts/performance-benchmark.mjs",
  ]);

  runNodeSyntaxCheck(jsFiles);
  validateJsNextCore();
  validateHtmlAssets(indexHtml);
  validateWorkerImports(fdtdWorkerJs, fdtdWorkerFile);
  const { catalog, constants } = loadCatalog(
    readActiveScript(activeScripts, "constants.js", ["legacy/js/src", "constants.js"]),
    readActiveScript(activeScripts, "catalog.js", ["legacy/js/src", "catalog.js"]),
  );
  const dropdownPresets = validatePresets(
    indexHtml,
    catalog.sceneDescriptions,
    readActiveScript(activeScripts, "fdtd-presets.js", ["legacy/js/src", "fdtd-presets.js"]),
  );
  validateSceneCatalogJson(dropdownPresets, catalog.sceneDescriptions);
  validateValidationMatrix(dropdownPresets);
  validateNumerics(constants);
  validateUiReproducibility(indexHtml, appJs, sceneCodecJs, sceneReproJs);
  const appPerformanceJs = readActiveScript(activeScripts, "app-performance.js", ["legacy/js/src", "app-performance.js"]);
  validatePerformanceRoute(indexHtml, appJs, appPerformanceJs, fdtdSimJs, fdtdEngineRoutingJs, wasmBackendJs, workerEngineJs, wasmCpp, {
    fdtdWorker: fdtdWorkerFile,
    workerEngine: workerEngineFile,
  });

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
