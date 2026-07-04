#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const report = {
  status: "PASS",
  checks: [],
};

function repoPath(...parts) {
  return path.join(repoRoot, ...parts);
}

function readText(...parts) {
  return fs.readFileSync(repoPath(...parts), "utf8");
}

function listFilesRecursive(relativeDir, extension) {
  const root = repoPath(relativeDir);
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(relativePath, extension));
    } else if (!extension || entry.name.endsWith(extension)) {
      files.push(relativePath);
    }
  }
  return files;
}

function addCheck(name, passed, details = "") {
  report.checks.push({
    name,
    status: passed ? "PASS" : "BLOCK",
    details,
  });
  if (!passed) report.status = "BLOCK";
}

function scriptSources(indexHtml) {
  return [...indexHtml.matchAll(/<script\s+[^>]*src="([^"]+)"/g)].map((match) => match[1].split("?")[0]);
}

function stylesheetSources(indexHtml) {
  return [...indexHtml.matchAll(/<link\s+[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((match) => match[1].split("?")[0]);
}

function validateActiveAssets(indexHtml) {
  const scripts = scriptSources(indexHtml);
  const stylesheets = stylesheetSources(indexHtml);
  const retiredAssetRefs = [...scripts, ...stylesheets].filter((asset) => asset.startsWith("legacy/") || asset.startsWith("js-next/"));
  const nonRuntimeScripts = scripts.filter((asset) => !asset.startsWith("src/runtime/") && !asset.startsWith("assets/vendor/"));
  addCheck(
    "active assets avoid retired paths",
    retiredAssetRefs.length === 0,
    retiredAssetRefs.length ? retiredAssetRefs.join(", ") : "index.html loads src/runtime and src/styles/fdtd-ui.css",
  );
  addCheck(
    "active scripts stay in canonical runtime",
    nonRuntimeScripts.length === 0,
    nonRuntimeScripts.length ? nonRuntimeScripts.join(", ") : "all active scripts load from src/runtime",
  );
  addCheck(
    "single canonical stylesheet",
    stylesheets.length === 1 && stylesheets[0] === "src/styles/fdtd-ui.css",
    stylesheets.length ? stylesheets.join(", ") : "no stylesheet linked",
  );
}

function validatePackageScripts(packageJson) {
  const packageText = JSON.stringify(packageJson.scripts || {});
  const retiredScriptRefs = [...packageText.matchAll(/\b(?:legacy|js-next)\//g)].map((match) => match[0]);
  addCheck(
    "package scripts avoid retired active paths",
    retiredScriptRefs.length === 0,
    retiredScriptRefs.length ? retiredScriptRefs.join(", ") : "scripts target validators and src runtime",
  );
}

function validateSourceRootShape() {
  const allowedEntries = new Set(["README.md", "runtime", "styles"]);
  const srcEntries = fs.readdirSync(repoPath("src"), { withFileTypes: true }).map((entry) => entry.name);
  const unexpectedEntries = srcEntries.filter((entry) => !allowedEntries.has(entry));
  addCheck(
    "src contains only active browser assets",
    unexpectedEntries.length === 0,
    unexpectedEntries.length ? unexpectedEntries.join(", ") : "src contains runtime, styles, and README only",
  );
}

function validateRuntimeDependencyInventory(indexHtml) {
  const scripts = scriptSources(indexHtml);
  const dependencyIndex = scripts.indexOf("src/runtime/app/runtime-dependencies.js");
  const mainIndex = scripts.indexOf("src/runtime/app/main.js");
  addCheck(
    "runtime dependency inventory loads before main.js",
    dependencyIndex >= 0 && mainIndex >= 0 && dependencyIndex < mainIndex,
    dependencyIndex >= 0 && mainIndex >= 0
      ? `runtime-dependencies index ${dependencyIndex}; main.js index ${mainIndex}`
      : "runtime-dependencies.js or main.js missing from index.html",
  );

  const mainText = readText("src", "runtime", "app", "main.js");
  const repeatedLoadChecks = [...mainText.matchAll(/must be loaded before src\/runtime\/app\/main\.js/g)].length;
  addCheck(
    "main.js delegates runtime dependency checks",
    repeatedLoadChecks <= 1 && mainText.includes("runtimeDependenciesModule.resolveRuntimeDependencies"),
    `${repeatedLoadChecks} direct module-load error checks in main.js`,
  );
}

function validateSimulationDomBoundary() {
  const simulationFiles = listFilesRecursive("src/runtime/simulation", ".js");
  const allowedDomFiles = new Set([
    "src/runtime/simulation/fdtd-rendering.js",
    "src/runtime/simulation/fdtd-sim.js",
    "src/runtime/simulation/sweep-analysis-controller.js",
  ]);
  const forbiddenPatterns = [
    /\bdocument\b/,
    /\bquerySelector\b/,
    /\bgetElementById\b/,
    /\.addEventListener\(/,
    /\.classList\b/,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bgetComputedStyle\b/,
  ];
  const violations = [];
  for (const file of simulationFiles) {
    if (allowedDomFiles.has(file)) continue;
    const text = readText(...file.split("/"));
    if (forbiddenPatterns.some((pattern) => pattern.test(text))) {
      violations.push(file);
    }
  }
  addCheck(
    "pure simulation files avoid DOM APIs",
    violations.length === 0,
    violations.length
      ? violations.join(", ")
      : "DOM exceptions are limited to documented canvas, rendering, and sweep integration files",
  );
}

function validateUiCssBoundary(cssText) {
  const importantCount = [...cssText.matchAll(/!important/g)].length;
  addCheck("canonical CSS avoids !important", importantCount === 0, `${importantCount} !important occurrences`);
}

function validateCentralFileBudget() {
  const hardBudget = 2000;
  const mainLines = readText("src", "runtime", "app", "main.js")
    .split(/\r?\n/)
    .filter((line) => line.trim()).length;
  addCheck(
    "main.js centrality budget",
    mainLines <= hardBudget,
    `${mainLines} non-empty lines; hard budget is ${hardBudget} for the canonical runtime`,
  );
}

const indexHtml = readText("index.html");
validateActiveAssets(indexHtml);
validatePackageScripts(JSON.parse(readText("package.json")));
validateSourceRootShape();
validateRuntimeDependencyInventory(indexHtml);
validateSimulationDomBoundary();
validateUiCssBoundary(readText("src/styles/fdtd-ui.css"));
validateCentralFileBudget();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Architecture validation: ${report.status}`);
  for (const check of report.checks) {
    console.log(`- ${check.status}: ${check.name}${check.details ? ` (${check.details})` : ""}`);
  }
}

process.exit(report.status === "BLOCK" ? 1 : 0);
