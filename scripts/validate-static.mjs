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

function runtimeModulePaths() {
  const entry = readText("src", "runtime-entry.ts");
  const modules = extractAll(/import\s+["']\.\/(runtime\/[^"']+\.js)["'];/g, entry)
    .map((source) => `src/${source}`);
  if (!modules.length) throw new Error("src/runtime-entry.ts must import the runtime modules");
  return modules;
}

function scriptPathMap(indexHtml) {
  const scripts = [...runtimeModulePaths(), ...extractAll(/<script\s+[^>]*src="([^"]+)"/g, indexHtml)].map(assetPath);
  return new Map(scripts.map((scriptPath) => [path.posix.basename(scriptPath), scriptPath]));
}

function activeScriptPath(scriptMap, basename) {
  const activePath = scriptMap.get(basename);
  if (!activePath) throw new Error(`Missing active script ${basename} in runtime-entry.ts or index.html`);
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

function validateRuntimeCore() {
  const result = spawnSync(process.execPath, [repoPath("scripts", "validate-runtime-core.mjs")], {
    encoding: "utf8",
    windowsHide: true,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  addCheck(
    "src core equivalence",
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
  const runtimeModules = runtimeModulePaths();
  const linkedScripts = extractAll(/<script\s+[^>]*src="([^"]+)"/g, indexHtml);
  const scripts = [...runtimeModules, ...linkedScripts];
  const stylesheets = extractAll(/<link\s+[^>]*rel="stylesheet"\s+href="([^"]+)"/g, indexHtml);
  const missing = [...scripts, ...stylesheets].filter((asset) => !fileExistsFromUrl(asset));
  const unversioned = [...linkedScripts, ...stylesheets].filter((asset) => !String(asset).includes("?v="));
  addCheck(
    "html linked assets",
    missing.length === 0 ? "PASS" : "BLOCK",
    missing.length === 0 ? `${scripts.length} scripts and ${stylesheets.length} stylesheets found` : `Missing: ${missing.join(", ")}`,
  );
  addCheck(
    "html cache-busted assets",
    unversioned.length === 0 ? "PASS" : "BLOCK",
    unversioned.length === 0
      ? `${linkedScripts.length + stylesheets.length} HTML-linked assets include ?v tokens; ${runtimeModules.length} modules are versioned by Vite`
      : unversioned.join(", "),
  );
}

function validateCarbonUi(indexHtml) {
  const styles = readText("src", "styles", "scientific-workbench.css");
  const carbon = readText("src", "styles", "carbon.scss");
  const missing = [];
  const inheritedFontPattern = /Nunito Sans|Helvetica Neue|SFMono|ui-monospace|ui-sans-serif|system-ui|Consolas|Menlo|Liberation Mono|Georgia|Times New Roman|Cambria Math|\bArial\b/i;
  const typographyFiles = [".css", ".scss", ".js", ".ts", ".tsx"]
    .flatMap((extension) => listFilesRecursive("src", extension))
    .concat(".storybook/preview.tsx");
  const activeUiSource = typographyFiles.map((file) => readText(...file.split("/"))).join("\n");
  const inheritedFontFiles = typographyFiles.filter((file) => inheritedFontPattern.test(readText(...file.split("/"))));
  if (!["@carbon/styles", "@carbon/react"].some((entry) => carbon.includes(`@use "${entry}"`))) {
    missing.push("Carbon Sass entry");
  }
  if (/tailwindcss|@theme inline/.test(styles)) missing.push("obsolete Tailwind contract");
  if (!indexHtml.includes("<ScientificAppShell")) missing.push("scientific-ui app shell");
  if (!indexHtml.includes("cds--g10")) missing.push("Carbon g10 chrome theme context");
  if (/\.cds--|:not\(\.cds--|Hallmark|instrument shell redesign/i.test(styles)) missing.push("inherited or Carbon-internal CSS selectors");
  if (/input\[type=["']range["']\]/i.test(styles)) missing.push("native range styling");
  if (/font:\s*inherit|label:not\(/i.test(styles)) missing.push("global rules that override Carbon internals");
  if (!styles.includes("--cds-body-compact-01-") || !styles.includes("--cds-heading-compact-01-")) missing.push("Carbon typography tokens");
  if (/<details\b|<summary\b|type=["']range["']/i.test(indexHtml)) missing.push("native disclosure or range markup");
  if (/createElement\(["']details["']\)|input\[type=["']range["']\]/i.test(activeUiSource)) missing.push("legacy dynamic disclosure or range code");
  if (inheritedFontFiles.length > 0) missing.push(`inherited typography in ${inheritedFontFiles.join(", ")}`);
  addCheck(
    "Carbon UI contract",
    missing.length === 0 ? "PASS" : "BLOCK",
    missing.length === 0 ? "Carbon Sass, scientific-ui shell, and IBM Plex typography found" : missing.join(", "),
  );
}

function validateContextKindSwitchers(indexHtml) {
  const switchers = Array.from(
    indexHtml.matchAll(/<div\b([^>]*class="[^"]*\bcontext-kind-switcher\b[^"]*"[^>]*)>([\s\S]*?)<\/div>/g),
  );
  const failures = [];
  if (switchers.length !== 3) failures.push(`expected 3 groups, found ${switchers.length}`);

  switchers.forEach((switcher, switcherIndex) => {
    const groupAttributes = switcher[1];
    if (!/\brole="group"/.test(groupAttributes)) failures.push(`group ${switcherIndex + 1} is not role=group`);
    const buttons = Array.from(switcher[2].matchAll(/<CarbonButton\b([^>]*)>/g), (match) => match[1]);
    if (buttons.length !== 3) failures.push(`group ${switcherIndex + 1} has ${buttons.length} buttons`);
    const activeCount = buttons.filter((attributes) => /\bclass="[^"]*\bis-active\b[^"]*"/.test(attributes)).length;
    if (activeCount !== 1) failures.push(`group ${switcherIndex + 1} has ${activeCount} active buttons`);
    buttons.forEach((attributes, buttonIndex) => {
      const kind = attributes.match(/\bdata-canvas-add="([^"]+)"/)?.[1] || `button ${buttonIndex + 1}`;
      const active = /\bclass="[^"]*\bis-active\b[^"]*"/.test(attributes);
      const pressed = attributes.match(/\baria-pressed="(true|false)"/)?.[1];
      if (pressed !== String(active)) {
        failures.push(`group ${switcherIndex + 1} ${kind} aria-pressed=${pressed || "missing"}, active=${active}`);
      }
    });
  });

  addCheck(
    "context kind switcher semantics",
    failures.length === 0 ? "PASS" : "BLOCK",
    failures.length === 0 ? "3 button groups keep aria-pressed synchronized with is-active" : failures.join(", "),
  );
}

function validateWorkbenchPresentationContracts(indexHtml) {
  const styles = readText("src", "styles", "scientific-workbench.css");
  const sliders = readText("src", "ui", "scientific-sliders.tsx");
  const visualBindings = readText("src", "runtime", "ui", "runtime-control-bindings.js");
  const sourceMonitorModel = readText("src", "runtime", "ui", "source-monitor-model.js");
  const sourceEditor = readText("src", "runtime", "ui", "source-monitor-editor-controller.js");
  const carbonShell = readText("src", "ui", "carbon-shell.tsx");
  const runtimeController = readText("src", "runtime", "app", "runtime-controller.js");
  const shellBindings = readText("src", "runtime", "ui", "shell-control-bindings.js");
  const canvasStage = readText("src", "ui", "canvas-stage.tsx");
  const colormaps = readText("src", "runtime", "data", "colormaps.js");
  const failures = [];

  if (indexHtml.includes("results-summary-grid")) {
    failures.push("legacy monitor summary remains in the HTML shell");
  }
  if (indexHtml.includes("config-summary-section")) {
    failures.push("legacy preflight summary remains in the HTML shell");
  }
  if (!styles.includes(".fdtd-run-outcome,\n.fdtd-preflight {\n  container-type: inline-size;")) {
    failures.push("FDTD summaries are not container-responsive");
  }
  if (!styles.startsWith('@import url("../../tokens.css");')) {
    failures.push("workbench does not load the visual token contract");
  }
  if (!/\.scientific-slider-output\s*\{[\s\S]*?clip:\s*rect\(0,?\s*0,?\s*0,?\s*0\);/.test(styles)) {
    failures.push("duplicate slider output is not visually hidden");
  }
  if (sliders.includes("hideTextInput") && !sliders.includes('labelText="Exact value"')) {
    failures.push("Carbon exact slider inputs are hidden without a visible exact-value field");
  }
  if (!sliders.includes('ariaLabelInput={`${configuration.labelText} exact value`}')) {
    failures.push("Carbon exact slider inputs are not labelled");
  }
  if (!sliders.includes("useRef(new EventTarget())") || !sliders.includes('dispatchEvent(new Event("input"))')) {
    failures.push("slider runtime events are not bridged through a stable target");
  }
  if (!/state\.gain\s*=\s*Number\(event\.detail\.value\)/.test(visualBindings)) {
    failures.push("display gain does not use direct user-facing units");
  }
  if (!/amplitude:\s*Number\(el\.amplitudeInput\.value\)/.test(sourceMonitorModel)) {
    failures.push("source amplitude does not use direct user-facing units");
  }
  if (!sourceEditor.includes("Incident amplitude") || !sourceEditor.includes("Incidence angle θ (°)")) {
    failures.push("source controls do not expose descriptive scientific labels");
  }
  if (!/\.help-guide-panel\s*\{[\s\S]*?position:\s*fixed;/.test(styles)) {
    failures.push("full help guide is not viewport-fixed");
  }
  if (!canvasStage.includes('id="helpGuidePanel"')) {
    failures.push("React does not own the full help guide");
  }
  if (!shellBindings.includes("el.appShell.inert = Boolean(open)")) {
    failures.push("full help guide does not make the application inert");
  }
  if (!/function resetSimulationFields\(\)[\s\S]*?sim\.render\(\);\s*updateControlText\(\);/.test(runtimeController)) {
    failures.push("reset does not publish a fresh presentation state");
  }
  if (carbonShell.includes("Result uses an earlier scene")) {
    failures.push("paused execution is still presented as a stale result");
  }
  if (!/function currentFieldColormapName\(magnitude = false\)\s*\{\s*if \(magnitude\) return "torch";\s*return state\.theme === "dark" \? "iceburn" : "redshift";/.test(colormaps)) {
    failures.push("signed field colormap does not provide light and dark neutral backgrounds");
  }

  addCheck(
    "workbench presentation contracts",
    failures.length === 0 ? "PASS" : "BLOCK",
    failures.length === 0
      ? "single summaries, direct-value Carbon sliders, container-aware layout, modal help, reset state, and theme-aware colormaps found"
      : failures.join(", "),
  );
}

function validatePresets(sceneCatalog, sceneDescriptions, presetSourceJs) {
  const catalogPresets = unique((sceneCatalog.scenes || []).map((scene) => scene.id).filter(Boolean));
  const presetCases = unique(extractAll(/case\s+"([^"]+)"/g, presetSourceJs));
  const descriptions = unique(Object.keys(sceneDescriptions));
  const missingPresetCases = catalogPresets.filter((preset) => preset !== "empty" && !presetCases.includes(preset));
  const missingDescriptions = catalogPresets.filter((preset) => !descriptions.includes(preset));
  const orphanDescriptions = descriptions.filter((preset) => !catalogPresets.includes(preset));

  addCheck(
    "scene catalog maps to applyPreset",
    missingPresetCases.length === 0 ? "PASS" : "BLOCK",
    missingPresetCases.length === 0 ? `${catalogPresets.length} catalog presets checked` : missingPresetCases.join(", "),
  );
  addCheck(
    "preset descriptions",
    missingDescriptions.length === 0 ? "PASS" : "BLOCK",
    missingDescriptions.length === 0 ? "Every catalog preset has a runtime description" : missingDescriptions.join(", "),
  );
  addCheck(
    "orphan catalog descriptions",
    orphanDescriptions.length === 0 ? "PASS" : "WARN",
    orphanDescriptions.length === 0 ? "No orphan descriptions" : orphanDescriptions.join(", "),
  );

  return catalogPresets;
}

function validateSceneCatalogJson(catalog, catalogPresets, sceneDescriptions) {
  const catalogPath = repoPath("src", "runtime", "data", "scene-catalog.json");
  if (!fs.existsSync(catalogPath)) {
    addCheck("scene catalog JSON", "BLOCK", "Missing src/runtime/data/scene-catalog.json");
    return;
  }

  const groups = Array.isArray(catalog.groups) ? catalog.groups : [];
  const scenes = Array.isArray(catalog.scenes) ? catalog.scenes : [];
  const jsonSceneIds = scenes.map((scene) => scene.id).filter(Boolean);
  const duplicateJsonIds = jsonSceneIds.filter((id, index) => jsonSceneIds.indexOf(id) !== index);
  const groupIds = new Set(groups.map((group) => group.id));
  const scenesWithoutGroup = scenes.filter((scene) => scene.groupId && !groupIds.has(scene.groupId)).map((scene) => scene.id);
  const missingFromJson = catalogPresets.filter((preset) => !jsonSceneIds.includes(preset));
  const orphanJsonScenes = jsonSceneIds.filter((preset) => !catalogPresets.includes(preset));
  const missingJsonDescriptions = jsonSceneIds.filter((preset) => !String(scenes.find((scene) => scene.id === preset)?.description || "").trim());
  const mismatchedGroupMembership = groups
    .map((group) => {
      const sceneIds = scenes.filter((scene) => scene.groupId === group.id).map((scene) => scene.id);
      const jsonIds = Array.isArray(group.sceneIds) ? group.sceneIds : [];
      return sceneIds.join("|") === jsonIds.join("|") ? "" : `${group.label}: group lists ${jsonIds.length} scene(s), records provide ${sceneIds.length}`;
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

function validateValidationMatrix(catalogPresets) {
  const matrix = JSON.parse(readText("scripts", "validation-matrix.json"));
  const ids = matrix.cases.map((testCase) => testCase.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const missingRequired = matrix.requiredP0Cases.filter((id) => !ids.includes(id));
  const unknownPresets = matrix.cases
    .map((testCase) => testCase.preset)
    .filter((preset) => !catalogPresets.includes(preset));
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
    unknownPresets.length === 0 ? "All validation presets exist in the scene catalog" : unique(unknownPresets).join(", "),
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
    "importSceneFileInput",
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

function validatePerformanceRoute(indexHtml, appJs, appPerformanceJs, fdtdSimJs, fdtdEngineRoutingJs, fdtdDiagnosticsJs, wasmBackendJs, wasmCpp) {
  const resultsViews = readText("src", "ui", "results-views.tsx");
  const requiredIds = [
    "performanceResetBtn",
  ];
  const missingIds = requiredIds.filter((id) => !resultsViews.includes(`id="${id}"`));
  const requiredSymbols = [
    "performanceStats",
    "solverWasmKernelMs",
    "solverJsKernelMs",
    "solverSourcePackMs",
    "solverAuxMaterialMs",
    "solverBoundarySourceMs",
    "solverDiagnosticsMs",
    "timeStepBatch",
    "instrumentSimulationPerformance",
    "updatePerformanceStats",
    "WASM_STEP_ARGUMENT_NAMES",
    "WASM_STEP_FIELD_OFFSET_NAMES",
    "buildStepKernelArguments",
    "validateStepKernelOffsets",
    "supportsConductivity",
    "supportsKerr",
    "supportsSaturableGain",
    "supportsTensorGyro",
    "canUseCompiledMaterialStep",
    "canUseCompiledKerrResponse",
    "kernel_features",
    "measure_field",
    "measureField",
    "measureForUi",
    "renormalize_fields",
    "renormalizeFields",
  ];
  const performanceSources = `${indexHtml}\n${resultsViews}\n${appJs}\n${appPerformanceJs}\n${fdtdSimJs}\n${fdtdEngineRoutingJs}\n${fdtdDiagnosticsJs}\n${wasmBackendJs}\n${wasmCpp}`;
  const missingSymbols = requiredSymbols.filter((symbol) => !performanceSources.includes(symbol));
  const requiredFiles = [
    ["docs", "PERFORMANCE.md"],
    ["native/fdtd-core", "fdtd-core.cpp"],
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

function extractFrozenStringArray(source, constName) {
  const pattern = new RegExp(`const\\s+${constName}\\s*=\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\);`);
  const match = source.match(pattern);
  return match ? extractAll(/"([^"]+)"/g, match[1]) : [];
}

function wasmExportParams(wasmCpp, exportName) {
  const pattern = new RegExp(`export_name\\("${exportName}"\\)[\\s\\S]*?void\\s+\\w+\\s*\\(([\\s\\S]*?)\\)\\s*\\{`);
  const match = wasmCpp.match(pattern);
  if (!match) return null;
  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.match(/([A-Za-z_]\w*)$/)?.[1] || "");
}

function normalizeWasmStepParamName(name, exportName) {
  let normalized = String(name || "");
  if (normalized === "s") return "courant";
  normalized = normalized.replace(/Offset$/, "");
  if (exportName === "step_hz") {
    const hzAliases = {
      hz: "ez",
      hzx: "ezx",
      hzy: "ezy",
      ex: "hx",
      ey: "hy",
    };
    return hzAliases[normalized] || normalized;
  }
  return normalized;
}

function wasmStepContractFailures(argumentNames, cxxParams, exportName) {
  if (!Array.isArray(cxxParams)) return [`missing C++ ${exportName} export`];
  const normalizedParams = cxxParams.map((name) => normalizeWasmStepParamName(name, exportName));
  const failures = [];
  if (argumentNames.length !== normalizedParams.length) {
    failures.push(`${exportName} expects ${normalizedParams.length} args, JS schema has ${argumentNames.length}`);
  }
  const limit = Math.min(argumentNames.length, normalizedParams.length);
  for (let index = 0; index < limit; index += 1) {
    if (argumentNames[index] !== normalizedParams[index]) {
      failures.push(`${exportName} arg ${index + 1} is ${normalizedParams[index]}, expected ${argumentNames[index]}`);
      break;
    }
  }
  return failures;
}

function validateWasmStepContract(wasmBackendJs, wasmCpp) {
  const fieldOffsetNames = extractFrozenStringArray(wasmBackendJs, "WASM_STEP_FIELD_OFFSET_NAMES");
  const runtimeParameterNames = extractFrozenStringArray(wasmBackendJs, "WASM_STEP_RUNTIME_PARAMETER_NAMES");
  const argumentNames = [
    "nx",
    "ny",
    "courant",
    ...fieldOffsetNames,
    ...runtimeParameterNames,
    "tfsfSources",
    "tfsfSourceCount",
    "modeSources",
    "modeProfiles",
    "modeEpsilonProfiles",
    "modeMuProfiles",
    "modeSourceCount",
  ];
  const stepParams = wasmExportParams(wasmCpp, "step");
  const stepHzParams = wasmExportParams(wasmCpp, "step_hz");
  const failures = [];
  if (!wasmBackendJs.includes("WASM_STEP_ARGUMENT_NAMES")) failures.push("missing WASM_STEP_ARGUMENT_NAMES");
  if (fieldOffsetNames.length === 0) failures.push("missing WASM_STEP_FIELD_OFFSET_NAMES");
  if (runtimeParameterNames.length === 0) failures.push("missing WASM_STEP_RUNTIME_PARAMETER_NAMES");
  failures.push(...wasmStepContractFailures(argumentNames, stepParams, "step"));
  failures.push(...wasmStepContractFailures(argumentNames, stepHzParams, "step_hz"));
  addCheck(
    "WASM step JS/C++ contract",
    failures.length === 0 ? "PASS" : "BLOCK",
    failures.length === 0 ? `${argumentNames.length} ordered arguments match step and step_hz` : failures.join(", "),
  );
}

function main() {
  const indexHtml = readText("index.html");
  const workspaceMarkup = listFilesRecursive("src/ui", ".tsx")
    .filter((file) => !file.endsWith(".stories.tsx"))
    .map((file) => readText(...file.split("/")))
    .join("\n")
    .replaceAll("className=", "class=")
    .replaceAll("tabIndex=", "tabindex=");
  const interfaceMarkup = `${indexHtml}\n${workspaceMarkup}`;
  const requiredMetadata = ["theme-color", "canonical", "og:site_name", "og:title", "og:description", "og:type", "og:url", "og:image:alt", "twitter:card", "twitter:title", "twitter:description", "twitter:image:alt"];
  const missingMetadata = requiredMetadata.filter((metadata) => !indexHtml.includes(metadata));
  addCheck(
    "public metadata",
    missingMetadata.length === 0 ? "PASS" : "BLOCK",
    missingMetadata.length === 0 ? "Canonical, Open Graph, Twitter, theme, and image metadata are present" : `Missing ${missingMetadata.join(", ")}`,
  );
  const activeScripts = scriptPathMap(indexHtml);
  const appFile = activeScriptPath(activeScripts, "main.js");
  const appJs = readText(...appFile.split("/"));
  const sceneCodecJs = readActiveScript(activeScripts, "scene-codec.js");
  const sceneReproJs = readActiveScript(activeScripts, "scene-repro.js");
  const fdtdSimJs = readActiveScript(activeScripts, "fdtd-sim.js");
  const fdtdEngineRoutingJs = readActiveScript(activeScripts, "fdtd-engine-routing.js");
  const fdtdDiagnosticsJs = readActiveScript(activeScripts, "fdtd-diagnostics.js");
  const wasmBackendJs = readActiveScript(activeScripts, "wasm-backend.js");
  const wasmCpp = readText("native/fdtd-core", "fdtd-core.cpp");
  const linkedJsFiles = [...activeScripts.values()].filter((file) => /\.m?js$/i.test(file));
  const srcFiles = listFilesRecursive("src", ".js");
  const referenceFiles = listFilesRecursive("tests/reference-modules", ".js");
  const jsFiles = unique([
    ...linkedJsFiles,
    ...srcFiles,
    ...referenceFiles,
    "scripts/generate-scene-thumbnails.mjs",
    "scripts/serve-static.mjs",
    "scripts/validate-runtime-core.mjs",
    "scripts/validate-mode-solver.mjs",
    "scripts/validate-scene-library.mjs",
    "scripts/browser-smoke.mjs",
    "scripts/browser-physics.mjs",
    "scripts/performance-benchmark.mjs",
  ]);

  runNodeSyntaxCheck(jsFiles);
  validateRuntimeCore();
  validateModeSolver();
  validateHtmlAssets(indexHtml);
  validateCarbonUi(interfaceMarkup);
  const missingAccessibilityHooks = [
    '<SkipToContent href="#simulatorWorkspace">',
    'id="simulatorWorkspace"',
    'tabindex={-1}',
  ].filter((fragment) => !interfaceMarkup.includes(fragment));
  addCheck(
    "workspace accessibility hooks",
    missingAccessibilityHooks.length === 0 ? "PASS" : "BLOCK",
    missingAccessibilityHooks.length === 0 ? "skip link and focus target found" : missingAccessibilityHooks.join(", "),
  );
  validateContextKindSwitchers(interfaceMarkup);
  validateWorkbenchPresentationContracts(interfaceMarkup);
  const { catalog, constants } = loadCatalog(
    readActiveScript(activeScripts, "constants.js"),
    readActiveScript(activeScripts, "catalog.js"),
  );
  const sceneCatalog = JSON.parse(readText("src", "runtime", "data", "scene-catalog.json"));
  const catalogPresets = validatePresets(
    sceneCatalog,
    catalog.sceneDescriptions,
    readActiveScript(activeScripts, "fdtd-presets.js"),
  );
  validateSceneCatalogJson(sceneCatalog, catalogPresets, catalog.sceneDescriptions);
  validateValidationMatrix(catalogPresets);
  validateNumerics(constants);
  validateUiReproducibility(interfaceMarkup, appJs, sceneCodecJs, sceneReproJs);
  const appPerformanceJs = readActiveScript(activeScripts, "app-performance.js");
  validatePerformanceRoute(interfaceMarkup, appJs, appPerformanceJs, fdtdSimJs, fdtdEngineRoutingJs, fdtdDiagnosticsJs, wasmBackendJs, wasmCpp);
  validateWasmStepContract(wasmBackendJs, wasmCpp);

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
