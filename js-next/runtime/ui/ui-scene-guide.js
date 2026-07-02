(function initFdtdUiSceneGuide(global) {
  "use strict";

  function normalizeGuideText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function sceneGuideFamily(record) {
    const haystack = normalizeGuideText(`${record?.value} ${record?.title} ${record?.description}`);
    if (record?.value === "empty") return "empty";
    if (/(pt-symmetric|exceptional|non-hermitian|skin-effect)/.test(haystack)) return "nonhermitian";
    if (/(temporal|modulat|floquet|space-time|traveling|synthetic frequency)/.test(haystack)) return "temporal";
    if (/(kerr|chi2|chi3|nonlinear|vo2|pcm|saturable|switch|limiter)/.test(haystack)) return "nonlinear";
    if (/(drude|lorentz|debye|plasma|enz|metal|spp|plasmon|negative-index|superlens|hyperlens|metasurface|conductive|conductivity|skin-depth|absorber|metamaterial)/.test(haystack)) {
      return "dispersive";
    }
    if (/(photonic crystal|phc|ssh|valley|topolog|honeycomb|bloch|bic|bragg stack)/.test(haystack)) return "periodic";
    if (/(pec cylinder|cylinder scattering|mie|rcs|kerker|dimer|multiple scattering|localization|random medium)/.test(haystack)) {
      return "scattering";
    }
    if (/(interface|refraction|brewster|tir|coating|bragg mirror|lossy interface|anisotropic interface)/.test(haystack)) {
      return "interface";
    }
    if (/(chiral|bianisotropic|gyrotropic|ferrite|tensor|hyperbolic|anisotropic)/.test(haystack)) return "tensor";
    if (/(resonator|cavity|ring|fabry|purcell|beta-factor|ringdown|fano)/.test(haystack)) return "resonator";
    if (/(dipole|huygens|array|aperture|radiator|ntff|far-field)/.test(haystack)) return "radiation";
    if (/(waveguide|guide|coupler|mmi|mach|microstrip|stub)/.test(haystack)) return "guided";
    return "propagation";
  }

  const sceneGuideReferenceSets = {
    propagation: {
      books: ["A. Taflove and S. Hagness, Computational Electrodynamics, 3rd ed.", "J. D. Jackson, Classical Electrodynamics."],
      classics: ["K. S. Yee, IEEE Trans. Antennas Propag. 14, 302-307 (1966).", "J.-P. Berenger, J. Comput. Phys. 114, 185-200 (1994)."],
      reviews: ["A. F. Oskooi et al., Comput. Phys. Commun. 181, 687-702 (2010)."],
      recent: ["A. Y. Piggott et al., Sci. Rep. 5, 11327 (2015)."],
    },
    interface: {
      books: ["M. Born and E. Wolf, Principles of Optics.", "H. A. Macleod, Thin-Film Optical Filters."],
      classics: ["A. Fresnel, Ann. Chim. Phys. 17, 102-111 (1821).", "H. Kogelnik, Bell Syst. Tech. J. 48, 2909-2947 (1969)."],
      reviews: ["P. Yeh, Optical Waves in Layered Media."],
      recent: ["N. Yu and F. Capasso, Nat. Mater. 13, 139-150 (2014)."],
    },
    radiation: {
      books: ["C. A. Balanis, Antenna Theory.", "L. Novotny and B. Hecht, Principles of Nano-Optics."],
      classics: ["J. A. Stratton, Electromagnetic Theory.", "L. Rayleigh, Philos. Mag. 41, 107-120 (1871)."],
      reviews: ["P. Biagioni, J.-S. Huang, and B. Hecht, Rep. Prog. Phys. 75, 024402 (2012)."],
      recent: ["M. Decker and I. Staude, J. Opt. 18, 103001 (2016)."],
    },
    guided: {
      books: ["A. W. Snyder and J. Love, Optical Waveguide Theory.", "D. Marcuse, Theory of Dielectric Optical Waveguides."],
      classics: ["E. A. J. Marcatili, Bell Syst. Tech. J. 48, 2071-2102 (1969).", "L. B. Soldano and E. C. M. Pennings, J. Lightwave Technol. 13, 615-627 (1995)."],
      reviews: ["D. Thomson et al., J. Opt. 18, 073003 (2016)."],
      recent: ["D. Dai, J. Lightwave Technol. 35, 572-587 (2017)."],
    },
    resonator: {
      books: ["A. Yariv and P. Yeh, Photonics.", "H. A. Haus, Waves and Fields in Optoelectronics."],
      classics: ["E. M. Purcell, Phys. Rev. 69, 681 (1946).", "A. Yariv, Electron. Lett. 36, 321-322 (2000)."],
      reviews: ["K. J. Vahala, Nature 424, 839-846 (2003)."],
      recent: ["M. Notomi, Rep. Prog. Phys. 73, 096501 (2010)."],
    },
    scattering: {
      books: ["C. F. Bohren and D. R. Huffman, Absorption and Scattering of Light by Small Particles.", "H. C. van de Hulst, Light Scattering by Small Particles."],
      classics: ["G. Mie, Ann. Phys. 330, 377-445 (1908).", "M. Kerker, D.-S. Wang, and C. L. Giles, J. Opt. Soc. Am. 73, 765-767 (1983)."],
      reviews: ["A. I. Kuznetsov et al., Science 354, aag2472 (2016)."],
      recent: ["Y. Kivshar and A. Miroshnichenko, Opt. Photon. News 28, 24-31 (2017)."],
    },
    dispersive: {
      books: ["S. A. Maier, Plasmonics.", "N. Engheta and R. W. Ziolkowski, Metamaterials."],
      classics: ["J. B. Pendry, Phys. Rev. Lett. 85, 3966-3969 (2000).", "R. A. Shelby, D. R. Smith, and S. Schultz, Science 292, 77-79 (2001)."],
      reviews: ["N. I. Zheludev and Y. S. Kivshar, Nat. Mater. 11, 917-924 (2012).", "M. Silveirinha and N. Engheta, Phys. Rev. Lett. 97, 157403 (2006)."],
      recent: ["Z. Jacob, L. V. Alekseyev, and E. Narimanov, Opt. Express 14, 8247-8256 (2006).", "Z. Liu et al., Science 315, 1686 (2007)."],
    },
    tensor: {
      books: ["J. A. Kong, Electromagnetic Wave Theory.", "I. V. Lindell et al., Electromagnetic Waves in Chiral and Bi-Isotropic Media."],
      classics: ["B. D. H. Tellegen, Philips Res. Rep. 3, 81-101 (1948).", "D. L. Jaggard, A. R. Mickelson, and C. H. Papas, Appl. Phys. 18, 211-216 (1979)."],
      reviews: ["A. Serdyukov et al., Electromagnetics of Bi-Anisotropic Materials."],
      recent: ["C. Caloz and A. Sihvola, IEEE Antennas Propag. Mag. 62, 58-71 (2020)."],
    },
    nonlinear: {
      books: ["R. W. Boyd, Nonlinear Optics.", "Y. R. Shen, The Principles of Nonlinear Optics."],
      classics: ["P. A. Franken et al., Phys. Rev. Lett. 7, 118-119 (1961).", "J. A. Armstrong et al., Phys. Rev. 127, 1918-1939 (1962)."],
      reviews: ["D. N. Neshev and I. Aharonovich, Light Sci. Appl. 7, 58 (2018).", "M. Wuttig, H. Bhaskaran, and T. Taubner, Nat. Photonics 11, 465-476 (2017)."],
      recent: ["A. Shaltout, V. Shalaev, and M. Brongersma, Science 364, eaat3100 (2019)."],
    },
    temporal: {
      books: ["C. Caloz et al., Electromagnetic Nonreciprocity.", "R. W. Boyd, Nonlinear Optics."],
      classics: ["F. R. Morgenthaler, IRE Trans. Microwave Theory Tech. 6, 167-172 (1958).", "J. R. Zurita-Sanchez, P. Halevi, and J. C. Cervantes-Gonzalez, Phys. Rev. A 79, 053821 (2009)."],
      reviews: ["D. L. Sounas and A. Alu, Nat. Photonics 11, 774-783 (2017)."],
      recent: ["A. Shaltout et al., Science 364, eaat3100 (2019).", "E. Galiffi et al., Adv. Photonics 4, 014002 (2022)."],
    },
    periodic: {
      books: ["J. D. Joannopoulos et al., Photonic Crystals.", "K. Sakoda, Optical Properties of Photonic Crystals."],
      classics: ["E. Yablonovitch, Phys. Rev. Lett. 58, 2059-2062 (1987).", "S. John, Phys. Rev. Lett. 58, 2486-2489 (1987).", "S. G. Johnson and J. D. Joannopoulos, Opt. Express 8, 173-190 (2001)."],
      reviews: ["L. Lu, J. D. Joannopoulos, and M. Soljacic, Nat. Photonics 8, 821-829 (2014).", "T. Ozawa et al., Rev. Mod. Phys. 91, 015006 (2019)."],
      recent: ["C. W. Hsu et al., Nat. Rev. Mater. 1, 16048 (2016).", "M. I. Shalaev et al., Nat. Nanotechnol. 14, 31-34 (2019)."],
    },
    nonhermitian: {
      books: ["N. Moiseyev, Non-Hermitian Quantum Mechanics.", "C. M. Bender, PT Symmetry."],
      classics: ["C. M. Bender and S. Boettcher, Phys. Rev. Lett. 80, 5243-5246 (1998).", "C. E. Ruter et al., Nat. Phys. 6, 192-195 (2010)."],
      reviews: ["M.-A. Miri and A. Alu, Science 363, eaar7709 (2019).", "S. K. Ozdemir et al., Nat. Mater. 18, 783-798 (2019)."],
      recent: ["S. Weidemann et al., Science 368, 311-314 (2020)."],
    },
    empty: {
      books: ["A. Taflove and S. Hagness, Computational Electrodynamics."],
      classics: ["K. S. Yee, IEEE Trans. Antennas Propag. 14, 302-307 (1966)."],
      reviews: ["A. F. Oskooi et al., Comput. Phys. Commun. 181, 687-702 (2010)."],
      recent: ["A. Y. Piggott et al., Sci. Rep. 5, 11327 (2015)."],
    },
  };

  const sceneFamilyText = {
    propagation: {
      phenomenon: "Free-space or homogeneous-medium wave propagation",
      geometry: "Uniform or nearly uniform domain used to isolate wavelength, phase velocity, group delay, interference, diffraction, or CPML behavior.",
      expected: "Planar, Gaussian, evanescent, or diffracted waves with predictable wavelength and phase fronts.",
      explanation: "The simulation makes visible how the Yee update transports energy and how boundary conditions affect finite-domain propagation.",
    },
    interface: {
      phenomenon: "Reflection, transmission, refraction, and impedance matching at material interfaces",
      geometry: "One or more planar layers placed across the computational domain, usually with CPML at the outer edges.",
      expected: "Reflected and transmitted beams, Fresnel-angle behavior, critical-angle effects, or standing waves in multilayers.",
      explanation: "Boundary conditions enforce tangential field continuity, producing Fresnel coefficients and phase shifts.",
    },
    radiation: {
      phenomenon: "Localized-source radiation and directional emission",
      geometry: "Point, dipole, aperture, array, or Huygens-type source embedded in a finite 2D domain.",
      expected: "Near-field structure around the emitter and far-field/directivity trends when monitors are enabled.",
      explanation: "The local current distribution launches fields whose symmetry, phase, and environment determine the radiation pattern.",
    },
    guided: {
      phenomenon: "Guided-wave confinement and coupling",
      geometry: "High-index cores, bends, tapers, couplers, MMI sections, or microstrip-like regions embedded in a lower-index background.",
      expected: "Power confined to the guide, with bend loss, modal beating, coupling, or scattering depending on the geometry.",
      explanation: "Index contrast creates transverse confinement; discontinuities mix modes and radiate energy.",
    },
    resonator: {
      phenomenon: "Resonance, standing waves, and cavity-enhanced fields",
      geometry: "Fabry-Perot, ring, disk, defect, or stub cavity coupled to a source or waveguide.",
      expected: "Field build-up at resonant frequencies, standing-wave nodes, ringdown, or enhanced local density of states.",
      explanation: "Multiple round trips interfere constructively when the phase condition is met; loss and radiation set the Q factor.",
    },
    scattering: {
      phenomenon: "Electromagnetic scattering by finite objects",
      geometry: "One or more cylinders, apertures, or inclusions illuminated by a plane wave or localized source.",
      expected: "Incident, reflected, shadow, and scattered fields; possible forward/backward asymmetry or resonant hotspots.",
      explanation: "The object polarizes or enforces boundary conditions, re-radiating fields that interfere with the incident wave.",
    },
    dispersive: {
      phenomenon: "Dispersive, metallic, ENZ, plasmonic, or metamaterial response",
      geometry: "Drude/Lorentz/Debye or tensor-material regions embedded in the FDTD grid.",
      expected: "Skin depth, plasmonic confinement, ENZ phase behavior, negative-index refraction, absorption, or hot spots.",
      explanation: "Auxiliary material variables approximate frequency-dependent polarization and loss in the time domain.",
    },
    nonlinear: {
      phenomenon: "Intensity-dependent or state-dependent optical response",
      geometry: "Nonlinear slab, guide, resonator, phase-change region, or switching cell.",
      expected: "Field-dependent phase shift, harmonic content, bistability, saturation, or persistent material-state changes.",
      explanation: "The material update depends on local field intensity or state variables, so response changes during the run.",
    },
    tensor: {
      phenomenon: "Tensor, chiral, gyrotropic, or bianisotropic material response",
      geometry: "Anisotropic or magnetoelectrically coupled regions embedded in the finite Yee grid.",
      expected: "Polarization conversion, rotated phase fronts, non-reciprocal-looking bias effects, or tensor-conditioned field patterns.",
      explanation: "The local constitutive update couples field components through tensor permittivity, gyrotropy, or the reduced kappa_n bianisotropic proxy.",
    },
    temporal: {
      phenomenon: "Time-varying media, Floquet sidebands, and space-time modulation",
      geometry: "A finite region whose material parameters vary in time, sometimes with a traveling modulation phase.",
      expected: "Frequency conversion, sidebands, asymmetric transmission, or synthetic-frequency coupling.",
      explanation: "Time modulation exchanges energy with the wave and breaks the assumptions of a static medium.",
    },
    periodic: {
      phenomenon: "Periodic, defect, BIC, or topological photonic behavior",
      geometry: "Lattice, defect cavity, SSH chain, valley-Hall interface, or photonic-crystal waveguide.",
      expected: "Bandgap-like attenuation, defect localization, interface transport, disorder robustness, or leakage suppression.",
      explanation: "Spatial periodicity shapes Bloch modes; symmetry and topology can protect or suppress coupling channels.",
    },
    nonhermitian: {
      phenomenon: "Gain/loss, PT symmetry, exceptional points, or non-Hermitian transport",
      geometry: "Coupled guides or resonators with balanced/unbalanced gain and loss regions.",
      expected: "Mode coalescence proxies, asymmetric amplification/attenuation, or skin-effect-like field accumulation.",
      explanation: "Non-conservative material updates make modal amplitudes grow or decay, changing the effective spectrum.",
    },
    empty: {
      phenomenon: "Blank FDTD sandbox",
      geometry: "Empty domain with CPML boundaries.",
      expected: "No field until a source or material is added.",
      explanation: "Use this as a controlled starting point to build custom scenes.",
    },
  };

  function sceneGuideTemplate(record, context = {}) {
    const family = sceneGuideFamily(record);
    const title = record.title || "Custom scene";
    const description = record.description || context.emptyDescription || "Blank domain.";
    const sourceHint = context.sourceHint || "configured source";
    const solver = context.solver || "TMz / Ez";
    const commonErrors = [
      "Too few cells per wavelength, which changes phase velocity and resonance frequency.",
      "CPML too close to the object or source, producing artificial reflections.",
      "Interpreting early transients as steady-state results before the field has settled.",
    ];
    const base = {
      phenomenon: title,
      description: `Example summary: ${description}`,
      fdtd: `The scene advances Maxwell's curl equations on a 2D Yee grid using the ${solver} formulation. It is a teaching model, so staircasing, finite domain size, and CPML settings should be checked before making quantitative claims.`,
      geometry: "Finite 2D computational window with CPML boundaries and the preset geometry drawn on the grid.",
      source: `${sourceHint}; phase, amplitude, and position are taken from the preset and can be edited from the source menu.`,
      materials: "Air plus the preset materials; dispersive, lossy, anisotropic, nonlinear, or PEC regions are included when the chosen scene requires them.",
      expected: "Field maps should show the qualitative wave pattern associated with the selected preset: propagation, scattering, confinement, coupling, resonance, absorption, or sideband generation.",
      explanation: "Use the color map to follow phase and amplitude. Compare wavelength, field nodes, flux direction, and monitor readouts with the physical mechanism described by the scene.",
      errors: commonErrors,
      enabled: "Teaching demonstrations, quick design intuition, and first-pass sanity checks before moving to a higher-fidelity solver or experiment.",
      experiments: "Compare with microwave bench analogues, integrated-photonic test structures, near-field scans, far-field scattering measurements, or transmission/reflection spectra depending on the scene.",
      references: sceneGuideReferenceSets[family] || sceneGuideReferenceSets.propagation,
    };

    return { ...base, ...(sceneFamilyText[family] || {}) };
  }

  function pecCylinderSceneGuide(record, context = {}) {
    return {
      ...sceneGuideTemplate(record, context),
      phenomenon: "Scattering of a plane wave by a perfectly conducting cylinder",
      description: "A canonical 2D scattering problem: a metallic cylinder blocks the tangential electric field and re-radiates a scattered wave.",
      fdtd: "The FDTD grid launches a plane-wave-like excitation toward a PEC inclusion. The PEC condition forces the appropriate tangential field component to vanish at the object boundary, and CPML layers absorb outgoing waves.",
      geometry: "Circular PEC cylinder in a homogeneous air background, surrounded by CPML. The circular boundary is represented on a Cartesian grid, so staircasing error depends on resolution.",
      source: "Plane-wave line source incident on the cylinder; use monitors or the color map to separate incident, reflected, and shadow regions qualitatively.",
      materials: "Air plus an ideal PEC obstacle. The PEC model is lossless and perfectly reflecting, so it does not represent finite-conductivity skin depth.",
      expected: "A strong shadow behind the cylinder, interference fringes in front of it, and cylindrical scattered waves propagating outward.",
      explanation: "The incoming wave induces surface currents on the PEC boundary. Those currents radiate the scattered field, which interferes with the incident wave and produces the observed pattern.",
      errors: [
        "Using too coarse a grid, which makes the cylinder look polygonal and shifts the scattering pattern.",
        "Placing the cylinder or monitors too close to the CPML, causing artificial absorption or reflection artifacts.",
        "Comparing directly with 3D Mie scattering; this scene is a 2D cylinder analogue, not a sphere.",
      ],
      enabled: "Radar-cross-section intuition, microwave scattering demos, antenna blockage studies, optical/nanophotonic scattering analogues, and validation of boundary handling in FDTD codes.",
      experiments: "Microwave scattering from metallic rods, optical scattering from nanowires, near-field scans around conducting obstacles, and far-field angular scattering measurements.",
    };
  }

  function buildSceneGuide(record, context = {}) {
    if (record?.value === "pecCylinder") return pecCylinderSceneGuide(record, context);
    return sceneGuideTemplate(record || {}, context);
  }

  function createSceneGuideRenderer(documentRef) {
    function appendSceneGuideField(parent, label, value) {
      const item = documentRef.createElement("div");
      item.className = "scene-guide-item";
      const title = documentRef.createElement("h3");
      title.textContent = label;
      const body = documentRef.createElement("p");
      body.textContent = value;
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
