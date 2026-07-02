#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.join(__dirname, "crop-imagegen-scene-thumbnails.py");
const scriptArgs = process.argv.slice(2);

const candidates = [
  process.env.PYTHON ? { command: process.env.PYTHON, args: [] } : null,
  process.platform === "win32" ? { command: "py", args: ["-3"] } : null,
  { command: "python3", args: [] },
  { command: "python", args: [] },
].filter(Boolean);

let missingPython = true;
for (const candidate of candidates) {
  const result = spawnSync(candidate.command, [...candidate.args, scriptPath, ...scriptArgs], {
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error?.code === "ENOENT") continue;
  missingPython = false;
  process.exit(result.status ?? 1);
}

if (missingPython) {
  console.error("Python is required to crop AI-generated scene thumbnail sheets.");
}
process.exit(1);
