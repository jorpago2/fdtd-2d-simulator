#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const publicEntries = [
  ".nojekyll",
  "index.html",
  "src/styles/fdtd-ui.css",
  "assets",
  path.join("src", "runtime"),
];

const blockedEntries = [
  ".git",
  ".github",
  ".cache",
  ".codex-remote-attachments",
  "docs",
  "legacy",
  "node_modules",
  "scripts",
  "tmp",
  "native/fdtd-core",
  "AGENTS.md",
  "EXAMPLE_SCENES_NOT_IMPLEMENTED.md",
  "package.json",
  "README.md",
];

function assertInsideRoot(targetPath) {
  const resolved = path.resolve(targetPath);
  if (resolved !== rootDir && !resolved.startsWith(`${rootDir}${path.sep}`)) {
    throw new Error(`Refusing to operate outside the repository: ${targetPath}`);
  }
  return resolved;
}

function removeDist() {
  const resolvedDist = assertInsideRoot(distDir);
  if (fs.existsSync(resolvedDist)) {
    fs.rmSync(resolvedDist, { recursive: true, force: true });
  }
  fs.mkdirSync(resolvedDist, { recursive: true });
}

function copyEntry(relativePath) {
  const source = path.join(rootDir, relativePath);
  const target = path.join(distDir, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing public entry: ${relativePath}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, {
    recursive: true,
    dereference: false,
    errorOnExist: false,
    force: true,
  });
}

function buildAssetVersion() {
  const sha = String(process.env.GITHUB_SHA || "").trim();
  if (/^[0-9a-f]{7,40}$/i.test(sha)) return `sha-${sha.slice(0, 12)}`;

  const result = spawnSync("git", ["rev-parse", "--short=12", "HEAD"], {
    cwd: rootDir,
    encoding: "utf8",
    windowsHide: true,
  });
  const localSha = String(result.stdout || "").trim();
  return /^[0-9a-f]{7,12}$/i.test(localSha) ? `sha-${localSha}` : `build-${Date.now()}`;
}

function stampLinkedAssetVersions(version) {
  const indexPath = path.join(distDir, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  const stamped = html.replace(
    /(<(?:link|script)\b[^>]+(?:href|src)="[^"]+\?v=)[^"]+(")/g,
    `$1${version}$2`,
  );
  fs.writeFileSync(indexPath, stamped);
}

function walkFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolute));
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }
  return files;
}

function validateDist() {
  const missing = publicEntries.filter((entry) => !fs.existsSync(path.join(distDir, entry)));
  if (missing.length) {
    throw new Error(`dist is missing public entries: ${missing.join(", ")}`);
  }

  const blocked = blockedEntries.filter((entry) => fs.existsSync(path.join(distDir, entry)));
  if (blocked.length) {
    throw new Error(`dist contains development-only entries: ${blocked.join(", ")}`);
  }

  const files = walkFiles(distDir);
  const thumbnailFiles = files.filter((file) => {
    const relative = path.relative(distDir, file).replace(/\\/g, "/");
    return relative.startsWith("assets/scene-thumbnails/") && relative.endsWith(".webp");
  });
  if (thumbnailFiles.length !== 141) {
    throw new Error(`Expected 141 scene thumbnails in dist, found ${thumbnailFiles.length}`);
  }

  const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  return { bytes, files: files.length, thumbnails: thumbnailFiles.length };
}

removeDist();
for (const entry of publicEntries) copyEntry(entry);
const assetVersion = buildAssetVersion();
stampLinkedAssetVersions(assetVersion);

const summary = validateDist();
console.log(
  `Pages build ready: dist/ contains ${summary.files} files, ${summary.thumbnails} thumbnails, ${summary.bytes} bytes; asset version ${assetVersion}.`,
);
