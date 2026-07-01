(function initFdtdUiSceneGuide(global) {
  "use strict";

  const FALLBACK_REFERENCES = Object.freeze({
    books: ["A. Taflove and S. Hagness, Computational Electrodynamics."],
    classics: ["K. S. Yee, IEEE Trans. Antennas Propag. 14, 302-307 (1966)."],
    reviews: ["A. F. Oskooi et al., Comput. Phys. Commun. 181, 687-702 (2010)."],
    recent: [],
  });

  function normalizeGuideText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function sceneGuideFamily(record) {
    const haystack = normalizeGuideText(`${record?.value} ${record?.title} ${record?.group} ${record?.description}`);
    if (record?.value === "empty") return "empty";
    if (/(pt-symmetric|exceptional|non-hermitian|skin)/.test(haystack)) return "nonhermitian";
    if (/(temporal|modulat|floquet|space-time|traveling|synthetic frequency)/.test(haystack)) return "temporal";
    if (/(chiral|bianisotropic|gyrotropic|ferrite|tensor|hyperbolic)/.test(haystack)) return "tensor";
    if (/(pec cylinder|cylinder scattering|mie|rcs|kerker|dimer|multiple scattering|localization|random medium)/.test(haystack)) return "scattering";
    if (/(interface|refraction|brewster|tir|coating|bragg mirror|lossy interface|anisotropic interface)/.test(haystack)) return "interface";
    if (/(dipole|huygens|array|aperture|radiator|ntff|far-field)/.test(haystack)) return "radiation";
    if (/(waveguide|guide|coupler|mmi|mach|microstrip|stub)/.test(haystack)) return "guided";
    if (/(resonator|cavity|ring|fabry|purcell|beta-factor|ringdown|fano)/.test(haystack)) return "resonator";
    if (/(photonic crystal|phc|ssh|valley|topolog|honeycomb|bloch|bic)/.test(haystack)) return "periodic";
    if (/(drude|lorentz|debye|plasma|enz|metal|spp|plasmon|negative-index|superlens|hyperlens|metasurface)/.test(haystack)) return "dispersive";
    if (/(kerr|chi2|chi3|nonlinear|vo2|pcm|saturable|switch|limiter)/.test(haystack)) return "nonlinear";
    return "propagation";
  }

  function fallbackGuide(record = {}, context = {}) {
    const title = record.title || "Custom scene";
    const description = record.description || context.emptyDescription || "Blank domain.";
    const sourceHint = context.sourceHint || "configured source";
    const solver = context.solver || "TMz / Ez";
    return {
      phenomenon: title,
      description: `Example summary: ${description}`,
      fdtd: `The scene advances Maxwell's curl equations on a 2D Yee grid using the ${solver} formulation.`,
      geometry: "Finite 2D computational window with CPML boundaries and the preset geometry drawn on the grid.",
      source: `${sourceHint}; phase, amplitude, and position can be edited from the source menu.`,
      materials: "Air plus the materials required by the selected scene.",
      expected: "Field maps should show the qualitative wave pattern associated with the selected preset.",
      explanation: "Use the color map, wavelength scale, source position, and monitors to interpret the field pattern.",
      errors: [
        "Too few cells per wavelength, which changes phase velocity and resonance frequency.",
        "CPML too close to the object or source, producing artificial reflections.",
        "Interpreting early transients as steady-state results before the field has settled.",
      ],
      enabled: "Teaching demonstrations, quick design intuition, and first-pass sanity checks.",
      experiments: "Compare with a microwave bench analogue, an integrated-photonic test structure, or near-/far-field optical measurements when applicable.",
      references: FALLBACK_REFERENCES,
    };
  }

  function materializeGuideValue(value, context) {
    if (typeof value === "string") {
      return value
        .replaceAll("{sourceHint}", context.sourceHint || "configured source")
        .replaceAll("{solver}", context.solver || "TMz / Ez");
    }
    if (Array.isArray(value)) return value.map((item) => materializeGuideValue(item, context));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, materializeGuideValue(item, context)]));
    }
    return value;
  }

  function normalizeReferenceSet(references) {
    const source = references && typeof references === "object" ? references : {};
    return {
      books: Array.isArray(source.books) ? source.books : FALLBACK_REFERENCES.books,
      classics: Array.isArray(source.classics) ? source.classics : FALLBACK_REFERENCES.classics,
      reviews: Array.isArray(source.reviews) ? source.reviews : FALLBACK_REFERENCES.reviews,
      recent: Array.isArray(source.recent) ? source.recent : FALLBACK_REFERENCES.recent,
    };
  }

  function buildSceneGuide(record, context = {}) {
    const base = fallbackGuide(record || {}, context);
    const rawGuide = record?.guide && typeof record.guide === "object" ? record.guide : {};
    const guide = materializeGuideValue({ ...base, ...rawGuide }, context);
    guide.errors = Array.isArray(guide.errors) ? guide.errors : base.errors;
    guide.references = normalizeReferenceSet(guide.references);
    return guide;
  }

  function createSceneGuideRenderer(documentRef) {
    function appendSceneGuideField(parent, label, value) {
      const item = documentRef.createElement("div");
      item.className = "scene-guide-item";
      const title = documentRef.createElement("h3");
      title.textContent = label;
      const body = documentRef.createElement("p");
      body.textContent = value || "";
      item.append(title, body);
      parent.appendChild(item);
    }

    function appendSceneGuideList(parent, label, items) {
      const item = documentRef.createElement("div");
      item.className = "scene-guide-item";
      const title = documentRef.createElement("h3");
      title.textContent = label;
      const list = documentRef.createElement("ul");
      (items || []).forEach((text) => {
        const li = documentRef.createElement("li");
        li.textContent = text;
        list.appendChild(li);
      });
      item.append(title, list);
      parent.appendChild(item);
    }

    function appendSceneGuideReferences(parent, references) {
      const details = documentRef.createElement("details");
      details.className = "scene-guide-details";
      const summary = documentRef.createElement("summary");
      summary.textContent = "References";
      const body = documentRef.createElement("div");
      body.className = "scene-guide-reference-grid";
      [
        ["Books", references.books],
        ["Classic papers", references.classics],
        ["Reviews", references.reviews],
        ["Recent papers", references.recent],
      ].forEach(([label, items]) => appendSceneGuideList(body, label, items));
      details.append(summary, body);
      parent.appendChild(details);
    }

    function render(panel, record, guide) {
      if (!panel) return;
      panel.replaceChildren();

      const header = documentRef.createElement("div");
      header.className = "scene-guide-header";
      const eyebrow = documentRef.createElement("span");
      eyebrow.textContent = record.index == null ? "Custom scene" : `Atlas ${record.index}`;
      const title = documentRef.createElement("strong");
      title.textContent = record.title || guide.phenomenon;
      header.append(eyebrow, title);

      const grid = documentRef.createElement("div");
      grid.className = "scene-guide-grid";
      appendSceneGuideField(grid, "Phenomenon", guide.phenomenon);
      appendSceneGuideField(grid, "Description", guide.description);
      appendSceneGuideField(grid, "FDTD simulation", guide.fdtd);
      appendSceneGuideField(grid, "Geometry", guide.geometry);
      appendSceneGuideField(grid, "Source", guide.source);
      appendSceneGuideField(grid, "Materials", guide.materials);
      appendSceneGuideField(grid, "Expected results", guide.expected);
      appendSceneGuideField(grid, "Explanation", guide.explanation);

      const details = documentRef.createElement("details");
      details.className = "scene-guide-details";
      const detailsSummary = documentRef.createElement("summary");
      detailsSummary.textContent = "More context";
      const detailsBody = documentRef.createElement("div");
      detailsBody.className = "scene-guide-grid";
      appendSceneGuideList(detailsBody, "Common mistakes", guide.errors);
      appendSceneGuideField(detailsBody, "What it enables", guide.enabled);
      appendSceneGuideField(detailsBody, "Related experiments", guide.experiments);
      details.append(detailsSummary, detailsBody);

      panel.append(header, grid, details);
      appendSceneGuideReferences(panel, guide.references);
    }

    return { render };
  }

  function createSceneGuideController({ documentRef = global.document, panel, getContext = () => ({}) } = {}) {
    const renderer = createSceneGuideRenderer(documentRef);

    function update(record) {
      if (!panel || !record) return;
      const guide = buildSceneGuide(record, getContext());
      renderer.render(panel, record, guide);
    }

    return {
      buildSceneGuide,
      sceneGuideFamily,
      update,
    };
  }

  global.FdtdUiSceneGuide = Object.freeze({
    buildSceneGuide,
    createSceneGuideController,
    sceneGuideFamily,
  });
})(window);
