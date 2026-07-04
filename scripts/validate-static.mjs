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

function scriptPathMap(indexHtml) {
  const scripts = extractAll(/<script\s+[^>]*src="([^"]+)"/g, indexHtml).map(assetPath);
  return new Map(scripts.map((scriptPath) => [path.posix.basename(scriptPath), scriptPath]));
}

function activeScriptPath(scriptMap, basename) {
  const activePath = scriptMap.get(basename);
  if (!activePath) throw new Error(`Missing active script ${basename} in index.html`);
  return activePath;
}

function readActiveScript(scriptMap, basename) {
  return readText(...activeScriptPath(scriptMap, basename).split("/"));
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

function validateModeSolver() {
  const result = spawnSync(process.execPath, [repoPath("scripts", "validate-mode-solver.mjs")], {
    encoding: "utf8",
    windowsHide: true,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  addCheck(
    "mode solver",
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
  const unversioned = [...scripts, ...stylesheets].filter((asset) => !String(asset).includes("?v="));
  addCheck(
    "html linked assets",
    missing.length === 0 ? "PASS" : "BLOCK",
    missing.length === 0 ? `${scripts.length} scripts and ${stylesheets.length} stylesheets found` : `Missing: ${missing.join(", ")}`,
  );
  addCheck(
    "html cache-busted assets",
    unversioned.length === 0 ? "PASS" : "BLOCK",
    unversioned.length === 0 ? `${scripts.length + stylesheets.length} linked scripts/styles include ?v tokens` : unversioned.join(", "),
  );
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

function decodeHtmlText(value) {
  return String(value || "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function parseSceneOptionLabel(label) {
  const text = decodeHtmlText(label);
  const match = text.match(/^(\d+)\s*[\u00b7.-]\s*(.+)$/);
  if (!match) return { index: null, title: text || "Untitled scene" };
  return {
    index: Number(match[1]),
    title: match[2].trim(),
  };
}

function parsePresetSelect(indexHtml) {
  const presetSelect = indexHtml.match(/<select\s+id="presetInput"[\s\S]*?<\/select>/)?.[0] || "";
  const scenes = [];
  const groups = new Map();
  let currentGroupLabel = "General";
  const tokenPattern = /<optgroup\s+label="([^"]+)"\s*>|<\/optgroup>|<option\s+value="([^"]+)">([\s\S]*?)<\/option>/g;
  for (const match of presetSelect.matchAll(tokenPattern)) {
    if (match[1]) {
      currentGroupLabel = decodeHtmlText(match[1]);
      if (!groups.has(currentGroupLabel)) groups.set(currentGroupLabel, []);
      continue;
    }
    if (match[0].startsWith("</optgroup")) {
      currentGroupLabel = "General";
      continue;
    }
    const id = match[2];
    const parsed = parseSceneOptionLabel(match[3]);
    if (!groups.has(currentGroupLabel)) groups.set(currentGroupLabel, []);
    groups.get(currentGroupLabel).push(id);
    scenes.push({ id, groupLabel: currentGroupLabel, ...parsed });
  }
  return { groups, scenes };
}

function validateSceneCatalogJson(indexHtml, dropdownPresets, sceneDescriptions) {
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
  const htmlPresetData = parsePresetSelect(indexHtml);
  const htmlSceneById = new Map(htmlPresetData.scenes.map((scene) => [scene.id, scene]));
  const jsonSceneIds = scenes.map((scene) => scene.id).filter(Boolean);
  const duplicateJsonIds = jsonSceneIds.filter((id, index) => jsonSceneIds.indexOf(id) !== index);
  const groupIds = new Set(groups.map((group) => group.id));
  const scenesWithoutGroup = scenes.filter((scene) => scene.groupId && !groupIds.has(scene.groupId)).map((scene) => scene.id);
  const missingFromJson = dropdownPresets.filter((preset) => !jsonSceneIds.includes(preset));
  const orphanJsonScenes = jsonSceneIds.filter((preset) => !dropdownPresets.includes(preset));
  const missingJsonDescriptions = jsonSceneIds.filter((preset) => !String(scenes.find((scene) => scene.id === preset)?.description || "").trim());
  const mismatchedMetadata = scenes
    .map((scene) => ({ scene, htmlScene: htmlSceneById.get(scene.id) }))
    .filter(({ scene, htmlScene }) => {
      if (!htmlScene) return false;
      return (
        String(scene.groupLabel || "") !== htmlScene.groupLabel ||
        (scene.id !== "empty" && Number(scene.index) !== htmlScene.index) ||
        String(scene.title || "") !== htmlScene.title
      );
    })
    .map(({ scene, htmlScene }) => `${scene.id}: JSON ${scene.index ?? "-"} / ${scene.title || "-"} / ${scene.groupLabel || "-"} != HTML ${htmlScene.index ?? "-"} / ${htmlScene.title} / ${htmlScene.groupLabel}`);
  const mismatchedGroupMembership = groups
    .map((group) => {
      const htmlIds = htmlPresetData.groups.get(group.label) || [];
      const jsonIds = Array.isArray(group.sceneIds) ? group.sceneIds : [];
      return htmlIds.join("|") === jsonIds.join("|") ? "" : `${group.label}: JSON ${jsonIds.length} scene(s), HTML ${htmlIds.length} scene(s)`;
    })
    .filter(Boolean);
  const oversizedGroups = groups
    .filter((group) => Array.isArray(group.sceneIds) && group.sceneIds.length > 16)
    .map((group) => `${group.label} (${group.sceneIds.length})`);
  const staleInlineGuides = scenes.filter((scene) => scene.guide && typeof scene.guide === "object").map((scene) => scene.id);
  const mismatchedDescriptions = jsonSceneIds.filter((preset) => {
    const jsonDescription = String(scenes.find((scene) => scene.id === preset)?.description || "");
    const embeddedDescription = String(sceneDescriptions[preset] || "");
    return embeddedDescription && jsonDescription !== embeddedDescription;
  });

  const failures = [
    ...duplicateJsonIds.map((id) => `duplicate id ${id}`),
    ...scenesWithoutGroup.map((id) => `unknown group for ${id}`),
    ...missingFromJson.map((id) => `missing ${id}`),
    ...orphanJsonScenes.map((id) => `orphan ${id}`),
    ...missingJsonDescriptions.map((id) => `empty description for ${id}`),
    ...mismatchedMetadata,
    ...mismatchedGroupMembership,
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
  addCheck(
    "scene catalog group sizes",
    oversizedGroups.length === 0 ? "PASS" : "WARN",
    oversizedGroups.length === 0 ? "All scene groups stay below 17 examples" : oversizedGroups.join(", "),
  );
  addCheck(
    "scene catalog dynamic guides",
    staleInlineGuides.length === 0 ? "PASS" : "WARN",
    staleInlineGuides.length === 0 ? "Guides are generated from runtime scene metadata" : `Inline guide data present for ${staleInlineGuides.join(", ")}`,
  );
  validateSceneThumbnails(jsonSceneIds);
}

function readLe24(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readWebpDimensions(buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > buffer.length) return null;

    if (chunk === "VP8X" && chunkSize >= 10) {
      return {
        width: readLe24(buffer, dataOffset + 4) + 1,
        height: readLe24(buffer, dataOffset + 7) + 1,
      };
    }
    if (chunk === "VP8L" && chunkSize >= 5 && buffer[dataOffset] === 0x2f) {
      const bits = (
        buffer[dataOffset + 1] |
        (buffer[dataOffset + 2] << 8) |
        (buffer[dataOffset + 3] << 16) |
        (buffer[dataOffset + 4] << 24)
      ) >>> 0;
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
    if (
      chunk === "VP8 " &&
      chunkSize >= 10 &&
      buffer[dataOffset + 3] === 0x9d &&
      buffer[dataOffset + 4] === 0x01 &&
      buffer[dataOffset + 5] === 0x2a
    ) {
      return {
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  return null;
}

function validateSceneThumbnails(sceneIds) {
  const thumbnailDir = repoPath("assets", "scene-thumbnails");
  const failures = [];
  const sizes = [];
  const sceneIdSet = new Set(sceneIds);
  if (!fs.existsSync(thumbnailDir)) {
    addCheck("scene thumbnails", "BLOCK", "Missing assets/scene-thumbnails");
    return;
  }
  for (const id of sceneIds) {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      failures.push(`unsafe id ${id}`);
      continue;
    }
    const filePath = path.join(thumbnailDir, `${id}.webp`);
    if (!fs.existsSync(filePath)) {
      failures.push(`missing ${id}.webp`);
      continue;
    }
    const source = fs.readFileSync(filePath);
    const size = source.length;
    sizes.push(size);
    if (size > 24576) failures.push(`${id}.webp is ${size} B`);
    const dimensions = readWebpDimensions(source);
    if (!dimensions || dimensions.width !== dimensions.height || dimensions.width < 96) {
      failures.push(`${id}.webp is not a square WebP thumbnail`);
    }
  }
  const orphanThumbnails = fs
    .readdirSync(thumbnailDir)
    .filter((name) => name.endsWith(".webp"))
    .filter((name) => !sceneIdSet.has(name.replace(/\.webp$/, "")));
  failures.push(...orphanThumbnails.map((name) => `orphan ${name}`));
  const staleSvgThumbnails = fs
    .readdirSync(thumbnailDir)
    .filter((name) => name.endsWith(".svg"));
  failures.push(...staleSvgThumbnails.map((name) => `stale SVG thumbnail ${name}`));
  const totalBytes = sizes.reduce((sum, size) => sum + size, 0);
  const maxBytes = sizes.length ? Math.max(...sizes) : 0;
  addCheck(
    "scene thumbnails",
    failures.length === 0 ? "PASS" : "BLOCK",
    failures.length === 0
      ? `${sceneIds.length} square WebP thumbnails, ${Math.round(totalBytes / 1024)} KB total, max ${maxBytes} B`
      : failures.join(", "),
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

function validatePerformanceRoute(indexHtml, appJs, appPerformanceJs, fdtdSimJs, fdtdEngineRoutingJs, wasmBackendJs, wasmCpp) {
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
    "performanceTargetStepsOutput",
    "performanceLiveStepsOutput",
    "performanceFpsOutput",
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
    "kernel_features",
  ];
  const performanceSources = `${indexHtml}\n${appJs}\n${appPerformanceJs}\n${fdtdSimJs}\n${fdtdEngineRoutingJs}\n${wasmBackendJs}\n${wasmCpp}`;
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
    failures.length === 0 ? "Runtime panel and C++ WASM backend files found" : failures.join(", "),
  );
}

function main() {
  const indexHtml = readText("index.html");
  const activeScripts = scriptPathMap(indexHtml);
  const appFile = activeScriptPath(activeScripts, "main.js");
  const appJs = readText(...appFile.split("/"));
  const sceneCodecJs = readActiveScript(activeScripts, "scene-codec.js");
  const sceneReproJs = readActiveScript(activeScripts, "scene-repro.js");
  const fdtdSimJs = readActiveScript(activeScripts, "fdtd-sim.js");
  const fdtdEngineRoutingJs = readActiveScript(activeScripts, "fdtd-engine-routing.js");
  const wasmBackendJs = readActiveScript(activeScripts, "wasm-backend.js");
  const wasmCpp = readText("wasm-src", "fdtd-core.cpp");
  const linkedJsFiles = extractAll(/<script\s+[^>]*src="([^"]+)"/g, indexHtml)
    .map(assetPath)
    .filter(Boolean);
  const jsNextFiles = listFilesRecursive("js-next", ".js");
  const jsFiles = unique([
    ...linkedJsFiles,
    ...jsNextFiles,
    "scripts/generate-scene-thumbnails.mjs",
    "scripts/serve-static.mjs",
    "scripts/validate-js-next-core.mjs",
    "scripts/validate-mode-solver.mjs",
    "scripts/validate-scene-library.mjs",
    "scripts/performance-benchmark.mjs",
  ]);

  runNodeSyntaxCheck(jsFiles);
  validateJsNextCore();
  validateModeSolver();
  validateHtmlAssets(indexHtml);
  const { catalog, constants } = loadCatalog(
    readActiveScript(activeScripts, "constants.js"),
    readActiveScript(activeScripts, "catalog.js"),
  );
  const dropdownPresets = validatePresets(
    indexHtml,
    catalog.sceneDescriptions,
    readActiveScript(activeScripts, "fdtd-presets.js"),
  );
  validateSceneCatalogJson(indexHtml, dropdownPresets, catalog.sceneDescriptions);
  validateValidationMatrix(dropdownPresets);
  validateNumerics(constants);
  validateUiReproducibility(indexHtml, appJs, sceneCodecJs, sceneReproJs);
  const appPerformanceJs = readActiveScript(activeScripts, "app-performance.js");
  validatePerformanceRoute(indexHtml, appJs, appPerformanceJs, fdtdSimJs, fdtdEngineRoutingJs, wasmBackendJs, wasmCpp);

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
