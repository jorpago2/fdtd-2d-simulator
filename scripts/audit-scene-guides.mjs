import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "src/runtime/data/scene-catalog.json"), "utf8"));
const validationMatrix = JSON.parse(fs.readFileSync(path.join(root, "scripts/validation-matrix.json"), "utf8"));
const guideSource = fs.readFileSync(path.join(root, "src/runtime/ui/ui-scene-guide.js"), "utf8");
const browserGlobal = {};
vm.runInNewContext(guideSource, { window: browserGlobal });

const guideApi = browserGlobal.FdtdUiSceneGuide;
const requiredFields = ["phenomenon", "description", "fdtd", "geometry", "source", "materials", "expected", "explanation", "enabled", "experiments"];
const scenes = catalog.scenes.filter((scene) => Number.isFinite(scene.index));
const guides = scenes.map((scene) => ({
  scene,
  family: guideApi.sceneGuideFamily({ value: scene.id, title: scene.title, description: scene.description }),
  guide: guideApi.buildSceneGuide(
    { value: scene.id, title: scene.title, description: scene.description, index: scene.index },
    { sourceHint: "configured source", solver: "TMz / Ez" },
  ),
}));

function occurrenceCounts(field) {
  const counts = new Map();
  for (const { guide } of guides) counts.set(guide[field], (counts.get(guide[field]) || 0) + 1);
  return counts;
}

const phenomenonCounts = occurrenceCounts("phenomenon");
const expectedCounts = occurrenceCounts("expected");
const explanationCounts = occurrenceCounts("explanation");
const uniqueReferences = new Set();
const validationCasesByPreset = new Map();
for (const testCase of validationMatrix.cases || []) {
  if (!validationCasesByPreset.has(testCase.preset)) validationCasesByPreset.set(testCase.preset, []);
  validationCasesByPreset.get(testCase.preset).push(testCase);
}

const rows = guides.map(({ scene, family, guide }) => {
  const references = [...new Set(Object.values(guide.references || {}).flat())];
  references.forEach((reference) => uniqueReferences.add(reference));
  const complete = requiredFields.every((field) => typeof guide[field] === "string" && guide[field].trim()) && Array.isArray(guide.errors) && guide.errors.length > 0;
  const specific = {
    phenomenon: phenomenonCounts.get(guide.phenomenon) === 1,
    expected: expectedCounts.get(guide.expected) === 1,
    explanation: explanationCounts.get(guide.explanation) === 1,
  };
  const doiLinks = references.filter((reference) => guideApi.sceneGuideReferenceDoiUrl(reference)).length;
  const validationCases = validationCasesByPreset.get(scene.id) || [];
  return {
    index: scene.index,
    id: scene.id,
    title: scene.title,
    family,
    complete,
    specific,
    doiLinks,
    referenceCount: references.length,
    validationCases: validationCases.length,
    status: complete && specific.expected && specific.explanation ? "PASS" : "WARN",
  };
});

const linkedReferences = [...uniqueReferences].filter((reference) => guideApi.sceneGuideReferenceDoiUrl(reference));
const report = {
  examples: rows.length,
  complete: rows.filter((row) => row.complete).length,
  sceneSpecificPhenomenon: rows.filter((row) => row.specific.phenomenon).length,
  sceneSpecificExpected: rows.filter((row) => row.specific.expected).length,
  sceneSpecificExplanation: rows.filter((row) => row.specific.explanation).length,
  pass: rows.filter((row) => row.status === "PASS").length,
  warn: rows.filter((row) => row.status === "WARN").length,
  validationCovered: rows.filter((row) => row.validationCases > 0).length,
  uniqueReferences: uniqueReferences.size,
  doiLinkedReferences: linkedReferences.length,
  rows,
};

function markdown() {
  const lines = [
    "# Scene Documentation Audit",
    "",
    "This report checks the 140 numbered scene guides rendered by the application. It measures structural completeness, scene-specific teaching text, and DOI-link coverage; it does not treat a family-level paragraph as an individual physical audit.",
    "",
    "## Summary",
    "",
    `- Complete guide structure: ${report.complete}/${report.examples}.`,
    `- Scene-specific phenomenon: ${report.sceneSpecificPhenomenon}/${report.examples}.`,
    `- Scene-specific expected result: ${report.sceneSpecificExpected}/${report.examples}.`,
    `- Scene-specific physical explanation: ${report.sceneSpecificExplanation}/${report.examples}.`,
    `- Current status: ${report.pass} PASS, ${report.warn} WARN.`,
    `- Scenes represented in the validation matrix: ${report.validationCovered}/${report.examples}.`,
    `- Unique references: ${report.uniqueReferences}; DOI-linked: ${report.doiLinkedReferences}.`,
    "",
    "`WARN` means the guide is complete and usable, but its expected result or explanation is still shared at family level. It does not mean the scene or solver failed physical validation.",
    "",
    "## Per-example audit",
    "",
    "| # | Scene | Family | Specific text | Validation cases | DOI links | Status |",
    "| ---: | --- | --- | ---: | ---: | ---: | --- |",
  ];

  for (const row of rows) {
    const specificCount = Object.values(row.specific).filter(Boolean).length;
    lines.push(`| ${row.index} | \`${row.id}\` - ${row.title} | ${row.family} | ${specificCount}/3 | ${row.validationCases} | ${row.doiLinks}/${row.referenceCount} | ${row.status} |`);
  }

  lines.push(
    "",
    "## Required remediation",
    "",
    "1. Convert each scene's existing validation checks and rationale into an observable-specific expected result: what should appear, approximately when, and in which view or Results metric.",
    "2. Replace family-level explanations with the mechanism actually represented by the preset geometry, source, material model, and solver polarization.",
    "3. Keep claims bounded to the implemented diagnostic; do not describe a proxy as a calibrated spectrum, Q, invariant, efficiency, or device transfer curve.",
    "4. Add a scene-specific paper when the family references do not directly support the modeled phenomenon. Journal references should use verified `https://doi.org/...` links; books and historical sources without a DOI remain plain text.",
  );
  return `${lines.join("\n")}\n`;
}

if (process.argv.includes("--write")) {
  fs.writeFileSync(path.join(root, "docs/SCENE_DOCUMENTATION_AUDIT.md"), markdown());
}

console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
if (report.complete !== report.examples || report.doiLinkedReferences === 0) process.exitCode = 1;
