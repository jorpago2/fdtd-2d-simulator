import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssFiles = [
  "src/styles/fdtd-ui.css",
];
const cssFileRoles = {
  "src/styles/fdtd-ui.css": "canonical",
};
const jsFiles = [
  "src/runtime/app/main.js",
  "src/runtime/ui/ui-core.js",
  "src/runtime/ui/ui-dom.js",
  "src/runtime/ui/ui-drawer.js",
  "src/runtime/ui/ui-scenes.js",
  "src/runtime/ui/ui-scene-guide.js",
  "src/runtime/ui/ui-results.js",
  "src/runtime/ui/ui-results-charts.js",
];

const cssDomains = {
  drawer: /control-panel|control-tab|mobile-layer|drawer|backdrop|panel-section/,
  buttons: /button|icon-button|text-button|primary-button|mode-toggle|theme-toggle|segmented|toggle/,
  canvas: /canvas-toolbar|stage|canvas-frame|colorbar|source-menu|context-menu/,
  visual: /visual-panel|visual-summary|visual-layer|field-display|projection-toggle|view-toggle/,
  scene: /scene-guide|scene-card|scene-filter|scene-list|scene-browser/,
};

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitSelectorList(rawSelector) {
  const selectors = [];
  let current = "";
  let parenDepth = 0;
  let bracketDepth = 0;
  let quote = null;

  for (let index = 0; index < rawSelector.length; index += 1) {
    const char = rawSelector[index];
    const previous = rawSelector[index - 1];

    if (quote) {
      current += char;
      if (char === quote && previous !== "\\") quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "(") parenDepth += 1;
    if (char === ")" && parenDepth > 0) parenDepth -= 1;
    if (char === "[") bracketDepth += 1;
    if (char === "]" && bracketDepth > 0) bracketDepth -= 1;

    if (char === "," && parenDepth === 0 && bracketDepth === 0) {
      selectors.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) selectors.push(current.trim());
  return selectors;
}

function extractCssSelectors(css) {
  const selectors = [];
  const cleanCss = stripCssComments(css);
  const rulePattern = /([^{}]+)\{/g;
  let match;
  while ((match = rulePattern.exec(cleanCss))) {
    const rawSelector = match[1].trim();
    if (!rawSelector || rawSelector.startsWith("@")) continue;
    splitSelectorList(rawSelector)
      .map((selector) => selector.trim())
      .filter(Boolean)
      .filter((selector) => !/^(from|to|\d+%)$/.test(selector))
      .forEach((selector) => selectors.push(selector));
  }
  return selectors;
}

function cssMetrics() {
  const selectorOwners = new Map();
  const files = cssFiles
    .filter((file) => fs.existsSync(path.join(repoRoot, file)))
    .map((file) => {
      const text = readRepoFile(file);
      const selectors = extractCssSelectors(text);
      const mediaQueries = [...text.matchAll(/@media\s*([^{]+)/g)].map((match) => match[1].trim());
      selectors.forEach((selector) => {
        if (!selectorOwners.has(selector)) selectorOwners.set(selector, new Set());
        selectorOwners.get(selector).add(file);
      });
      return {
        file,
        role: cssFileRoles[file] || "unclassified",
        bytes: Buffer.byteLength(text),
        important: countMatches(text, /!important/g),
        selectors: selectors.length,
        importantPerSelector: selectors.length > 0 ? countMatches(text, /!important/g) / selectors.length : 0,
        mediaQueries: [...new Set(mediaQueries)],
        repeatedMediaQueries: [...mediaQueries.reduce((counts, query) => {
          counts.set(query, (counts.get(query) || 0) + 1);
          return counts;
        }, new Map())]
          .filter(([, count]) => count > 1)
          .map(([query, count]) => ({ query, count })),
      };
    });

  const duplicatedSelectors = [...selectorOwners.entries()]
    .filter(([, owners]) => owners.size > 1)
    .map(([selector, owners]) => ({ selector, files: [...owners].sort() }))
    .sort((a, b) => b.files.length - a.files.length || a.selector.localeCompare(b.selector));

  const duplicatedSelectorsByDomain = Object.entries(cssDomains).map(([domain, pattern]) => {
    const selectors = duplicatedSelectors.filter((entry) => pattern.test(entry.selector));
    return {
      domain,
      count: selectors.length,
      selectors,
    };
  });

  return { duplicatedSelectors, duplicatedSelectorsByDomain, files };
}

function jsMetrics() {
  return jsFiles
    .filter((file) => fs.existsSync(path.join(repoRoot, file)))
    .map((file) => {
      const text = readRepoFile(file);
      return {
        file,
        bytes: Buffer.byteLength(text),
        domQueries: countMatches(text, /\b(querySelector|getElementById)\b/g),
        eventListeners: countMatches(text, /\.addEventListener\(/g),
        functionLikeBlocks: countMatches(text, /^\s*(function|async function|const\s+\w+\s*=\s*(async\s*)?\(|let\s+\w+\s*=\s*(async\s*)?\()/gm),
      };
    });
}

const report = {
  css: cssMetrics(),
  js: jsMetrics(),
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("UI audit");
  console.log("");
  console.log("CSS files");
  report.css.files.forEach((file) => {
    console.log(
      `- ${file.file} [${file.role}]: ${file.bytes} bytes, ${file.selectors} selectors, ${file.important} !important (${file.importantPerSelector.toFixed(2)} per selector)`,
    );
  });
  const cssByRole = report.css.files.reduce((roles, file) => {
    const current = roles.get(file.role) || { bytes: 0, selectors: 0, important: 0 };
    current.bytes += file.bytes;
    current.selectors += file.selectors;
    current.important += file.important;
    roles.set(file.role, current);
    return roles;
  }, new Map());
  console.log("");
  console.log("CSS totals by role");
  [...cssByRole.entries()].forEach(([role, metrics]) => {
    console.log(`- ${role}: ${metrics.bytes} bytes, ${metrics.selectors} selectors, ${metrics.important} !important`);
  });
  console.log("");
  console.log(`Duplicated selectors across CSS files: ${report.css.duplicatedSelectors.length}`);
  report.css.duplicatedSelectors.slice(0, 20).forEach((entry) => {
    console.log(`- ${entry.selector} (${entry.files.join(", ")})`);
  });
  console.log("");
  console.log("Duplicated selectors by UI domain");
  report.css.duplicatedSelectorsByDomain.forEach((entry) => {
    console.log(`- ${entry.domain}: ${entry.count}`);
    entry.selectors.slice(0, 8).forEach((selector) => {
      console.log(`  - ${selector.selector} (${selector.files.join(", ")})`);
    });
  });
  console.log("");
  console.log("Media query inventory");
  report.css.files.forEach((file) => {
    console.log(`- ${file.file}: ${file.mediaQueries.length ? file.mediaQueries.join(" | ") : "none"}`);
  });
  console.log("");
  console.log("Repeated media queries within the same file");
  report.css.files.forEach((file) => {
    if (!file.repeatedMediaQueries.length) {
      console.log(`- ${file.file}: none`);
      return;
    }
    const repeated = file.repeatedMediaQueries.map((entry) => `${entry.query} x${entry.count}`).join(" | ");
    console.log(`- ${file.file}: ${repeated}`);
  });
  console.log("");
  console.log("JavaScript UI density");
  report.js.forEach((file) => {
    console.log(`- ${file.file}: ${file.bytes} bytes, ${file.domQueries} DOM queries, ${file.eventListeners} listeners, ${file.functionLikeBlocks} function-like blocks`);
  });
}
