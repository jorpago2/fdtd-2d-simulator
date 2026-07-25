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
const sceneIds = new Set(scenes.map((scene) => scene.id));
const contentIds = new Set(guideApi.sceneGuideContentIds || []);
const orphanContentIds = [...contentIds].filter((id) => !sceneIds.has(id));
const doiExemptReferences = new Set([
  "J. A. Stratton, Electromagnetic Theory.",
  "A. Fresnel, Ann. Chim. Phys. 17, 102-111 (1821).",
  "P. Yeh, Optical Waves in Layered Media.",
  "B. D. H. Tellegen, Philips Res. Rep. 3, 81-101 (1948).",
  "A. Serdyukov et al., Electromagnetics of Bi-Anisotropic Materials.",
]);
const genericGuideSnippets = [
  "Field maps should show the qualitative wave pattern associated with the selected preset",
  "Use the color map to follow phase and amplitude",
];

function escapeMarkdownTableCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

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
  const unresolvedReferences = ["classics", "reviews", "recent"]
    .flatMap((category) => guide.references?.[category] || [])
    .filter((reference) => !guideApi.sceneGuideReferenceDoiUrl(reference) && !doiExemptReferences.has(reference));
  const validationCases = validationCasesByPreset.get(scene.id) || [];
  const registered = contentIds.has(scene.id);
  const expectedFormat = /^Canvas:\s+.+\s+Results:\s+.+/u.test(guide.expected);
  const generic = genericGuideSnippets.some((snippet) => guide.expected.includes(snippet) || guide.explanation.includes(snippet));
  const status =
    complete &&
    registered &&
    specific.phenomenon &&
    specific.expected &&
    specific.explanation &&
    expectedFormat &&
    !generic &&
    validationCases.length > 0 &&
    unresolvedReferences.length === 0
      ? "PASS"
      : "WARN";
  return {
    index: scene.index,
    id: scene.id,
    title: scene.title,
    family,
    complete,
    specific,
    registered,
    expectedFormat,
    generic,
    expectedSignature: guide.expected,
    doiLinks,
    referenceCount: references.length,
    unresolvedReferences,
    validationCaseIds: validationCases.map((testCase) => testCase.id),
    validationCases: validationCases.length,
    status,
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
  registered: rows.filter((row) => row.registered).length,
  expectedFormat: rows.filter((row) => row.expectedFormat).length,
  orphanContentIds,
  unresolvedReferences: [...new Set(rows.flatMap((row) => row.unresolvedReferences))],
  uniqueReferences: uniqueReferences.size,
  doiLinkedReferences: linkedReferences.length,
  rows,
};

async function verifyDoi(reference) {
  const url = guideApi.sceneGuideReferenceDoiUrl(reference);
  const doi = url.replace("https://doi.org/", "");
  try {
    const resolver = await fetch(url, { method: "HEAD", redirect: "manual" });
    let crossref;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      crossref = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
        headers: { "User-Agent": "Maxwell-FDTD-Lab/1.0 (mailto:noreply@example.com)" },
      });
      if (crossref.status !== 429 && crossref.status < 500) break;
      const retryAfterMs = Number(crossref.headers.get("retry-after")) * 1000;
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : 1000 * (attempt + 1)));
    }
    const resolverRedirected = resolver.status >= 300 && resolver.status < 400 && Boolean(resolver.headers.get("location"));
    return {
      reference,
      doi,
      ok: (resolver.ok || resolverRedirected) && Boolean(crossref?.ok),
      resolverStatus: resolver.status,
      crossrefStatus: crossref?.status,
    };
  } catch (error) {
    return { reference, doi, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function verifyDois(references, concurrency = 2) {
  const pending = [...references];
  const verified = [];
  async function worker() {
    while (pending.length) verified.push(await verifyDoi(pending.shift()));
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
  return verified.sort((a, b) => a.doi.localeCompare(b.doi));
}

const doiVerification = process.argv.includes("--check-doi") ? await verifyDois(linkedReferences) : null;
const failedDois = doiVerification?.filter((result) => !result.ok) || [];

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
    `- Explicit scene records: ${report.registered}/${report.examples}; orphan records: ${report.orphanContentIds.length}.`,
    `- Canvas/Results contract: ${report.expectedFormat}/${report.examples}.`,
    `- Scenes represented in the validation matrix: ${report.validationCovered}/${report.examples}.`,
    `- Unique references: ${report.uniqueReferences}; DOI-linked: ${report.doiLinkedReferences}; unresolved journal references: ${report.unresolvedReferences.length}.`,
    `- Online DOI resolver/Crossref check: ${doiVerification ? `${doiVerification.length - failedDois.length}/${doiVerification.length} passed` : "not run (use --check-doi)"}.`,
    "",
    "`WARN` means the guide is complete and usable, but its expected result or explanation is still shared at family level. It does not mean the scene or solver failed physical validation.",
    "",
    "## Per-example audit",
    "",
    "| # | Scene | Family | Expected signature | Validation cases | DOI links | Status |",
    "| ---: | --- | --- | --- | --- | ---: | --- |",
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.index} | \`${row.id}\` - ${row.title} | ${row.family} | ${escapeMarkdownTableCell(row.expectedSignature)} | ${row.validationCaseIds.map((id) => `\`${id}\``).join("<br>")} | ${row.doiLinks}/${row.referenceCount} | ${row.status} |`,
    );
  }

  lines.push(
    "",
    "## Method and limitations",
    "",
    "- PASS requires an explicit preset record, unique core teaching text, a `Canvas:`/`Results:` observation contract, validation-matrix coverage, and no unresolved journal reference.",
    "- Automated checks establish coverage and traceability, not scientific truth. Numerical claims remain bounded by the linked validation case and its convergence status.",
    "- Books and explicitly identified historical sources may remain without DOI; journal references otherwise require a DOI mapping.",
  );
  return `${lines.join("\n")}\n`;
}

if (process.argv.includes("--write")) {
  fs.writeFileSync(path.join(root, "docs/SCENE_DOCUMENTATION_AUDIT.md"), markdown());
}

console.log(JSON.stringify({ ...report, rows: undefined, doiChecked: doiVerification?.length || 0, failedDois }, null, 2));
if (report.pass !== report.examples || report.orphanContentIds.length || report.unresolvedReferences.length || failedDois.length) process.exitCode = 1;
