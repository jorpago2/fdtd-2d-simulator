#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const catalogPath = path.join(rootDir, "js-next", "runtime", "data", "scene-catalog.json");
const outputDir = path.join(rootDir, "assets", "scene-thumbnails");

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const scenes = Array.isArray(catalog.scenes) ? catalog.scenes : [];

const palettes = [
  ["#f6fbfc", "#0a7f8d", "#2f8f65", "#b66a2a", "#c43b51"],
  ["#f7fbf8", "#1668a8", "#15845f", "#b8841f", "#b63d69"],
  ["#fbfaf4", "#0d7894", "#5d8f38", "#b06b2f", "#9e496a"],
  ["#f7f9fd", "#2966a3", "#0c8b77", "#a76c25", "#b94141"],
];

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function safeSceneId(id) {
  const value = String(id || "");
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`Scene id cannot be used as a thumbnail filename: ${value}`);
  }
  return value;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function classifyScene(scene) {
  const text = normalizeText(`${scene.id} ${scene.title} ${scene.group} ${scene.groupLabel} ${scene.description}`);
  if (scene.id === "empty") return "empty";
  if (/(pt-symmetric|exceptional|non-hermitian|skin-effect|balanced gain|gain\/loss|gain and loss)/.test(text)) return "nonhermitian";
  if (/(temporal|modulat|floquet|space-time|travelling|traveling|time-varying|nonrecipro|space time crystal)/.test(text)) return "temporal";
  if (/(kerr|chi2|chi3|nonlinear|vo2|pcm|phase-change|saturable|bistab|switch|limiter|shg|thg)/.test(text)) return "nonlinear";
  if (/(anisotropic|gyrotropic|bianisotropic|chiral|hyperbolic|tensor|ferrite)/.test(text)) return "tensor";
  if (/(drude|lorentz|debye|plasma|enz|metal|spp|plasmon|negative-index|superlens|hyperlens|metamaterial|conductive|conductivity|skin-depth|absorber)/.test(text)) return "dispersive";
  if (/(photonic crystal|phc|ssh|valley|topolog|honeycomb|bloch|bic|lattice)/.test(text)) return "lattice";
  if (/(ring|resonator|cavity|fabry|purcell|beta-factor|ringdown|fano|stub)/.test(text)) return "resonator";
  if (/(waveguide|guide|coupler|mmi|mach|microstrip|taper)/.test(text)) return "guided";
  if (/(scatter|cylinder|mie|rcs|kerker|dimer|disorder|random|localization|slit|aperture|diffraction)/.test(text)) return "scatterer";
  if (/(dipole|huygens|array|radiator|ntff|far-field|source|antenna)/.test(text)) return "radiation";
  if (/(interface|refraction|brewster|tir|coating|mirror|multilayer|slab)/.test(text)) return "interface";
  return "wave";
}

function paletteFor(scene, seed) {
  return palettes[(Number(scene.groupId?.length || 0) + seed) % palettes.length];
}

function badge(scene, palette) {
  const index = scene.index == null ? "" : String(scene.index);
  const width = Math.max(18, 10 + index.length * 6);
  if (!index) return "";
  return `<rect x='6' y='6' width='${width}' height='14' rx='7' fill='#fff' opacity='.9'/><text x='${6 + width / 2}' y='17' text-anchor='middle' font-family='Arial,sans-serif' font-size='9' font-weight='700' fill='${palette[1]}'>${index}</text>`;
}

function shell(scene, body) {
  const seed = hashText(`${scene.id}:${scene.title}`);
  const palette = paletteFor(scene, seed);
  const bg = palette[0];
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96' width='96' height='96'><rect width='96' height='96' rx='10' fill='${bg}'/><path d='M16 8v80M32 8v80M48 8v80M64 8v80M80 8v80M8 16h80M8 32h80M8 48h80M8 64h80M8 80h80' stroke='#c9d9df' stroke-width='.7' opacity='.45'/>${body}${badge(scene, palette)}</svg>\n`;
}

function wave(scene, p, v) {
  const shift = v % 5;
  return `<path d='M8 ${32 + shift}c12-14 24 14 36 0s24-14 44 0M8 ${50 + shift}c12-14 24 14 36 0s24-14 44 0M8 ${68 + shift}c12-14 24 14 36 0s24-14 44 0' fill='none' stroke='${p[1]}' stroke-width='4' stroke-linecap='round' opacity='.8'/><path d='M18 18h40' stroke='${p[2]}' stroke-width='5' stroke-linecap='round'/>`;
}

function interfaceScene(scene, p, v) {
  const x = 46 + (v % 9) - 4;
  return `<rect x='${x}' y='14' width='34' height='68' rx='4' fill='${p[2]}' opacity='.24'/><path d='M${x} 12v72' stroke='${p[2]}' stroke-width='4'/><path d='M12 66L${x} 46l30-18' fill='none' stroke='${p[1]}' stroke-width='4' stroke-linecap='round'/><path d='M${x} 46L20 28' stroke='${p[3]}' stroke-width='3' stroke-linecap='round' opacity='.85'/>`;
}

function scatterer(scene, p, v) {
  const r = 10 + (v % 6);
  return `<path d='M10 30h28M10 48h28M10 66h28' stroke='${p[1]}' stroke-width='3' stroke-linecap='round'/><circle cx='56' cy='48' r='${r}' fill='${p[3]}' opacity='.85'/><circle cx='70' cy='35' r='6' fill='${p[2]}' opacity='.72'/><path d='M58 26c16 8 16 36 0 44' fill='none' stroke='${p[4]}' stroke-width='3' stroke-linecap='round' opacity='.76'/>`;
}

function radiation(scene, p, v) {
  const x = 45 + (v % 8);
  return `<circle cx='${x}' cy='50' r='5' fill='${p[4]}'/><path d='M${x - 18} 50a18 18 0 0 1 36 0M${x - 28} 50a28 28 0 0 1 56 0M${x - 38} 50a38 38 0 0 1 76 0' fill='none' stroke='${p[1]}' stroke-width='3' stroke-linecap='round'/><path d='M${x} 50l24-18' stroke='${p[2]}' stroke-width='4' stroke-linecap='round'/>`;
}

function guided(scene, p, v) {
  const y = 44 + (v % 7);
  return `<rect x='8' y='${y - 10}' width='80' height='20' rx='8' fill='${p[2]}' opacity='.34'/><path d='M10 ${y}h24c12 0 12-12 24-12h28' fill='none' stroke='${p[1]}' stroke-width='5' stroke-linecap='round'/><path d='M14 ${y + 17}h68' stroke='${p[3]}' stroke-width='3' stroke-linecap='round' opacity='.72'/>`;
}

function resonator(scene, p, v) {
  const r = 16 + (v % 5);
  return `<path d='M10 68h76' stroke='${p[1]}' stroke-width='5' stroke-linecap='round'/><circle cx='50' cy='40' r='${r}' fill='none' stroke='${p[2]}' stroke-width='7'/><circle cx='50' cy='40' r='6' fill='${p[3]}' opacity='.7'/><path d='M67 40h17' stroke='${p[4]}' stroke-width='3' stroke-linecap='round'/>`;
}

function lattice(scene, p, v) {
  let dots = "";
  for (let y = 24; y <= 72; y += 16) {
    for (let x = 24; x <= 72; x += 16) {
      const skip = (x + y + v) % 48 === 0;
      dots += `<circle cx='${x}' cy='${y}' r='${skip ? 3 : 5}' fill='${skip ? p[4] : p[(x + y) % 32 === 0 ? 2 : 1]}' opacity='${skip ? ".55" : ".9"}'/>`;
    }
  }
  return `${dots}<path d='M18 48h60' stroke='${p[3]}' stroke-width='3' stroke-linecap='round' opacity='.7'/>`;
}

function dispersive(scene, p, v) {
  const w = 20 + (v % 10);
  return `<rect x='46' y='12' width='${w}' height='72' rx='5' fill='${p[4]}' opacity='.62'/><path d='M12 28h34M12 46h34M12 64h34' stroke='${p[1]}' stroke-width='4' stroke-linecap='round'/><path d='M${46 + w} 26c11 6 11 38 0 44' fill='none' stroke='${p[3]}' stroke-width='3' stroke-linecap='round' opacity='.72'/>`;
}

function tensor(scene, p, v) {
  const rot = -20 + (v % 41);
  return `<ellipse cx='48' cy='50' rx='28' ry='15' fill='${p[2]}' opacity='.28' transform='rotate(${rot} 48 50)'/><path d='M26 70L70 26M31 31l34 34' stroke='${p[1]}' stroke-width='4' stroke-linecap='round'/><path d='M67 26l3 12l-12-3M65 65l-12-3l3 12' fill='none' stroke='${p[4]}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/>`;
}

function nonlinear(scene, p, v) {
  return `<rect x='34' y='20' width='30' height='56' rx='7' fill='${p[2]}' opacity='.32'/><path d='M10 44c10-10 20 10 30 0s20-10 46 0' fill='none' stroke='${p[1]}' stroke-width='4' stroke-linecap='round'/><path d='M12 62c8-7 16 7 24 0s16-7 48 0' fill='none' stroke='${p[4]}' stroke-width='3' stroke-linecap='round' opacity='.8'/><path d='M50 30l5 11l11 2l-9 7l2 12l-9-6l-10 6l3-12l-9-7l11-2z' fill='${p[3]}' opacity='.82'/>`;
}

function temporal(scene, p, v) {
  const x = 42 + (v % 13);
  return `<rect x='18' y='18' width='60' height='12' rx='3' fill='${p[1]}' opacity='.72'/><rect x='18' y='42' width='60' height='12' rx='3' fill='${p[4]}' opacity='.68'/><rect x='18' y='66' width='60' height='12' rx='3' fill='${p[2]}' opacity='.72'/><path d='M${x} 12v72' stroke='${p[3]}' stroke-width='4' stroke-linecap='round' stroke-dasharray='5 5'/><path d='M70 22l10 8l-10 8M70 58l10 8l-10 8' fill='none' stroke='${p[3]}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/>`;
}

function nonhermitian(scene, p, v) {
  const gap = 12 + (v % 6);
  return `<rect x='16' y='${38 - gap / 2}' width='64' height='10' rx='5' fill='${p[1]}' opacity='.78'/><rect x='16' y='${50 + gap / 2}' width='64' height='10' rx='5' fill='${p[4]}' opacity='.78'/><path d='M24 64c18 16 48 16 64-8M24 32c18-16 48-16 64 8' fill='none' stroke='${p[2]}' stroke-width='3' stroke-linecap='round' opacity='.8'/><text x='20' y='34' font-family='Arial,sans-serif' font-size='10' font-weight='700' fill='${p[1]}'>+</text><text x='20' y='76' font-family='Arial,sans-serif' font-size='10' font-weight='700' fill='${p[4]}'>-</text>`;
}

function empty(scene, p) {
  return `<path d='M20 72h28M20 72V44' stroke='${p[1]}' stroke-width='4' stroke-linecap='round'/><path d='M48 72l-8-5M48 72l-8 5M20 44l-5 8M20 44l5 8' stroke='${p[1]}' stroke-width='3' stroke-linecap='round'/><circle cx='68' cy='28' r='8' fill='none' stroke='${p[2]}' stroke-width='4' opacity='.7'/>`;
}

const renderers = {
  dispersive,
  empty,
  guided,
  interface: interfaceScene,
  lattice,
  nonhermitian,
  nonlinear,
  radiation,
  resonator,
  scatterer,
  temporal,
  tensor,
  wave,
};

function renderScene(scene) {
  const seed = hashText(`${scene.id}:${scene.title}`);
  const palette = paletteFor(scene, seed);
  const kind = classifyScene(scene);
  const body = (renderers[kind] || wave)(scene, palette, seed);
  return shell(scene, body);
}

fs.mkdirSync(outputDir, { recursive: true });

const keep = new Set();
for (const scene of scenes) {
  const id = safeSceneId(scene.id);
  const filePath = path.join(outputDir, `${id}.svg`);
  fs.writeFileSync(filePath, renderScene(scene), "utf8");
  keep.add(`${id}.svg`);
}

for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".svg") && !keep.has(entry.name)) {
    fs.rmSync(path.join(outputDir, entry.name));
  }
}

const sizes = [...keep].map((name) => fs.statSync(path.join(outputDir, name)).size);
const totalBytes = sizes.reduce((sum, size) => sum + size, 0);
const maxBytes = sizes.length ? Math.max(...sizes) : 0;
console.log(`Generated ${keep.size} scene thumbnails in assets/scene-thumbnails (${Math.round(totalBytes / 1024)} KB total, max ${maxBytes} B).`);
