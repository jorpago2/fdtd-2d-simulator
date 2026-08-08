(function initFdtdUiSceneGuide(global) {
  "use strict";

  function normalizeGuideText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function sceneGuideFamily(record) {
    const explicitFamily = sceneGuideContent[record?.value]?.family;
    if (explicitFamily) return explicitFamily;
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

  const sceneGuideReferenceDois = Object.freeze({
    "K. S. Yee, IEEE Trans. Antennas Propag. 14, 302-307 (1966).": "10.1109/TAP.1966.1138693",
    "J.-P. Berenger, J. Comput. Phys. 114, 185-200 (1994).": "10.1006/jcph.1994.1159",
    "A. F. Oskooi et al., Comput. Phys. Commun. 181, 687-702 (2010).": "10.1016/j.cpc.2009.11.008",
    "A. Y. Piggott et al., Sci. Rep. 5, 11327 (2015).": "10.1038/srep11327",
    "H. Kogelnik, Bell Syst. Tech. J. 48, 2909-2947 (1969).": "10.1002/j.1538-7305.1969.tb01198.x",
    "N. Yu and F. Capasso, Nat. Mater. 13, 139-150 (2014).": "10.1038/nmat3839",
    "L. Rayleigh, Philos. Mag. 41, 107-120 (1871).": "10.1080/14786447108640452",
    "P. Biagioni, J.-S. Huang, and B. Hecht, Rep. Prog. Phys. 75, 024402 (2012).": "10.1088/0034-4885/75/2/024402",
    "M. Decker and I. Staude, J. Opt. 18, 103001 (2016).": "10.1088/2040-8978/18/10/103001",
    "E. A. J. Marcatili, Bell Syst. Tech. J. 48, 2071-2102 (1969).": "10.1002/j.1538-7305.1969.tb01166.x",
    "L. B. Soldano and E. C. M. Pennings, J. Lightwave Technol. 13, 615-627 (1995).": "10.1109/50.372474",
    "D. Thomson et al., J. Opt. 18, 073003 (2016).": "10.1088/2040-8978/18/7/073003",
    "D. Dai, J. Lightwave Technol. 35, 572-587 (2017).": "10.1109/JLT.2016.2587727",
    "E. M. Purcell, Phys. Rev. 69, 681 (1946).": "10.1103/PhysRev.69.674.2",
    "A. Yariv, Electron. Lett. 36, 321-322 (2000).": "10.1049/el:20000340",
    "K. J. Vahala, Nature 424, 839-846 (2003).": "10.1038/nature01939",
    "M. Notomi, Rep. Prog. Phys. 73, 096501 (2010).": "10.1088/0034-4885/73/9/096501",
    "G. Mie, Ann. Phys. 330, 377-445 (1908).": "10.1002/andp.19083300302",
    "M. Kerker, D.-S. Wang, and C. L. Giles, J. Opt. Soc. Am. 73, 765-767 (1983).": "10.1364/JOSA.73.000765",
    "A. I. Kuznetsov et al., Science 354, aag2472 (2016).": "10.1126/science.aag2472",
    "Y. Kivshar and A. Miroshnichenko, Opt. Photon. News 28, 24-31 (2017).": "10.1364/OPN.28.1.000024",
    "J. B. Pendry, Phys. Rev. Lett. 85, 3966-3969 (2000).": "10.1103/PhysRevLett.85.3966",
    "R. A. Shelby, D. R. Smith, and S. Schultz, Science 292, 77-79 (2001).": "10.1126/science.1058847",
    "N. I. Zheludev and Y. S. Kivshar, Nat. Mater. 11, 917-924 (2012).": "10.1038/nmat3431",
    "M. Silveirinha and N. Engheta, Phys. Rev. Lett. 97, 157403 (2006).": "10.1103/PhysRevLett.97.157403",
    "Z. Jacob, L. V. Alekseyev, and E. Narimanov, Opt. Express 14, 8247-8256 (2006).": "10.1364/OE.14.008247",
    "Z. Liu et al., Science 315, 1686 (2007).": "10.1126/science.1137368",
    "D. L. Jaggard, A. R. Mickelson, and C. H. Papas, Appl. Phys. 18, 211-216 (1979).": "10.1007/BF00886864",
    "C. Caloz and A. Sihvola, IEEE Antennas Propag. Mag. 62, 58-71 (2020).": "10.1109/MAP.2019.2955698",
    "P. A. Franken et al., Phys. Rev. Lett. 7, 118-119 (1961).": "10.1103/PhysRevLett.7.118",
    "J. A. Armstrong et al., Phys. Rev. 127, 1918-1939 (1962).": "10.1103/PhysRev.127.1918",
    "D. N. Neshev and I. Aharonovich, Light Sci. Appl. 7, 58 (2018).": "10.1038/s41377-018-0058-1",
    "M. Wuttig, H. Bhaskaran, and T. Taubner, Nat. Photonics 11, 465-476 (2017).": "10.1038/nphoton.2017.126",
    "A. Shaltout, V. Shalaev, and M. Brongersma, Science 364, eaat3100 (2019).": "10.1126/science.aat3100",
    "F. R. Morgenthaler, IRE Trans. Microwave Theory Tech. 6, 167-172 (1958).": "10.1109/TMTT.1958.1124533",
    "J. R. Zurita-Sanchez, P. Halevi, and J. C. Cervantes-Gonzalez, Phys. Rev. A 79, 053821 (2009).": "10.1103/PhysRevA.79.053821",
    "D. L. Sounas and A. Alu, Nat. Photonics 11, 774-783 (2017).": "10.1038/nphoton.2017.155",
    "A. Shaltout et al., Science 364, eaat3100 (2019).": "10.1126/science.aat3100",
    "E. Galiffi et al., Adv. Photonics 4, 014002 (2022).": "10.1117/1.AP.4.1.014002",
    "E. Yablonovitch, Phys. Rev. Lett. 58, 2059-2062 (1987).": "10.1103/PhysRevLett.58.2059",
    "S. John, Phys. Rev. Lett. 58, 2486-2489 (1987).": "10.1103/PhysRevLett.58.2486",
    "S. G. Johnson and J. D. Joannopoulos, Opt. Express 8, 173-190 (2001).": "10.1364/OE.8.000173",
    "L. Lu, J. D. Joannopoulos, and M. Soljacic, Nat. Photonics 8, 821-829 (2014).": "10.1038/nphoton.2014.248",
    "T. Ozawa et al., Rev. Mod. Phys. 91, 015006 (2019).": "10.1103/RevModPhys.91.015006",
    "C. W. Hsu et al., Nat. Rev. Mater. 1, 16048 (2016).": "10.1038/natrevmats.2016.48",
    "M. I. Shalaev et al., Nat. Nanotechnol. 14, 31-34 (2019).": "10.1038/s41565-018-0297-6",
    "C. M. Bender and S. Boettcher, Phys. Rev. Lett. 80, 5243-5246 (1998).": "10.1103/PhysRevLett.80.5243",
    "C. E. Ruter et al., Nat. Phys. 6, 192-195 (2010).": "10.1038/nphys1515",
    "M.-A. Miri and A. Alu, Science 363, eaar7709 (2019).": "10.1126/science.aar7709",
    "S. K. Ozdemir et al., Nat. Mater. 18, 783-798 (2019).": "10.1038/s41563-019-0304-9",
    "S. Weidemann et al., Science 368, 311-314 (2020).": "10.1126/science.aaz8727",
  });

  function sceneGuideReferenceDoiUrl(reference) {
    const doi = sceneGuideReferenceDois[reference];
    return doi ? `https://doi.org/${doi}` : "";
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
      expected: "After the initial warm-up, open Results and verify harmonic hierarchy, hysteresis, saturation, or persistent material-state changes rather than judging a single field frame.",
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
      expected: "After the DFT warm-up, open Results and verify sidebands or forward/reverse contrast; the canvas remains the qualitative propagation view.",
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
      expected: "After the analysis warm-up, open Results and verify eigenvalue splitting/coalescence or localization against the passive/trivial reference.",
      explanation: "Non-conservative material updates make modal amplitudes grow or decay, changing the effective spectrum.",
    },
    empty: {
      phenomenon: "Blank FDTD sandbox",
      geometry: "Empty domain with CPML boundaries.",
      expected: "No field until a source or material is added.",
      explanation: "Use this as a controlled starting point to build custom scenes.",
    },
  };

  function sceneGuideEntry(family, phenomenon, canvas, results, explanation, references = null, details = null) {
    return {
      ...(details || {}),
      family,
      phenomenon,
      expected: `Canvas: ${canvas} Results: ${results}`,
      explanation,
      references,
    };
  }

  const sceneGuideContent = Object.freeze({
    planeWaveAir: sceneGuideEntry(
      "propagation",
      "Right-going plane-wave transport in homogeneous air",
      "after startup, parallel Ez phase fronts should cross the empty domain without a material discontinuity.",
      "the propagation check should show finite energy, a right/left energy ratio above 20, and Poynting direction consistent with the source angle.",
      "A continuous line source launches the TMz field on the Yee grid; in uniform air the wave keeps a constant wavelength while CPML removes outgoing energy.",
    ),
    planeWaveDielectric: sceneGuideEntry(
      "propagation",
      "Reduced wavelength of a plane wave in a uniform dielectric",
      "after startup, the phase fronts should remain planar but be more closely spaced than in air; display Ez with the epsilon overlay to compare field and medium.",
      "the material and source checks should confirm a filled n = 1.5 domain, finite injected energy, and forward Poynting flow.",
      "The dielectric increases the phase index, so the wavelength shortens relative to free space while the imposed source frequency is unchanged.",
    ),
    gaussianPulseAir: sceneGuideEntry(
      "propagation",
      "Broadband Gaussian pulse propagation and CPML decay",
      "follow the compact pulse as it leaves the source, crosses the air region, and disappears into the absorbing boundaries.",
      "the temporal-source check should identify a Gaussian launch and a final residual-energy ratio below 0.08 after the pulse exits.",
      "A finite-duration source excites a band of frequencies; a well-behaved CPML absorbs the packet instead of leaving a persistent standing field.",
    ),
    twoSourceInterference: sceneGuideEntry(
      "propagation",
      "Interference of two coherent point emitters",
      "once both circular wavefronts overlap, alternating constructive and destructive fringes should appear symmetrically about the source pair.",
      "the interference profile should contain at least three maxima with visibility of at least 0.25 and bounded symmetry error.",
      "The two Jz sources have a fixed phase relation, so their complex fields add at each point and create stationary maxima and minima.",
    ),
    frequencyBeat: sceneGuideEntry(
      "propagation",
      "Temporal beating from two detuned coherent sources",
      "after several carrier cycles, watch a downstream point brighten and dim with a slow envelope rather than remain at constant amplitude.",
      "the temporal probe should resolve at least 400 samples and an envelope dynamic range above 1.25.",
      "Superposing nearby frequencies produces a difference-frequency envelope on top of the faster carrier oscillation.",
    ),
    singleSlit: sceneGuideEntry(
      "propagation",
      "Diffraction through one subwavelength PEC slit",
      "after the incident front reaches the screen, a central transmitted lobe should spread into the shadow region with approximate mirror symmetry.",
      "the downstream profile should have finite transmitted energy and a central peak at least 1.1 times its mean.",
      "The narrow aperture truncates the incident phase front and acts as a secondary 2D source; the Cartesian PEC edge also introduces resolution-dependent staircasing.",
    ),
    doubleSlit: sceneGuideEntry(
      "propagation",
      "Young-type interference from two PEC apertures",
      "after transmission through both slits, several symmetric bright and dark bands should form downstream.",
      "the aperture diagnostic should find finite transmission and at least three resolved profile maxima.",
      "Each slit launches a diffracted field; their path-dependent phase difference creates the multi-fringe pattern.",
    ),
    circularAperture: sceneGuideEntry(
      "radiation",
      "Diffraction by a finite circular opening in a 2D PEC screen",
      "once illuminated, the open central region should transmit a symmetric expanding field while the surrounding PEC blocks the wave.",
      "the geometry check should retain at least 20 open cells and the profile should show a central peak above its mean.",
      "The grid represents a 2D aperture cross-section, not a full 3D Airy disk; diffraction follows from the finite transverse opening and its staircased boundary.",
    ),
    teTmComparison: sceneGuideEntry(
      "interface",
      "Polarization-dependent Fresnel response at one dielectric interface",
      "during the angular sweep, compare the reflected patterns for the Hz and Ez solver routes rather than interpreting one instantaneous frame.",
      "the angle-sweep panel should report both polarization traces for an oblique air-dielectric interface.",
      "TEz and TMz impose different tangential field ratios at the same boundary, producing different angle-dependent Fresnel coefficients.",
    ),
    poyntingPlaneWave: sceneGuideEntry(
      "propagation",
      "Energy-flow direction of an oblique plane wave",
      "from startup, the Poynting view and quiver arrows should point along the oblique propagation direction.",
      "the flux diagnostic should show positive directionality and a Poynting-angle error below 25 degrees.",
      "The time-averaged cross product of electric and magnetic fields indicates transported power, whereas the scalar field alone shows phase and sign.",
    ),
    evanescentWave: sceneGuideEntry(
      "propagation",
      "Exponential decay of an imposed supercritical spatial harmonic",
      "immediately around the evanescent line source, Ez should oscillate tangentially but decay rapidly in the normal direction.",
      "the source diagnostic should confirm k_parallel/k0 above 1.1 and near/far energy ratios above the configured decay bounds.",
      "Because the imposed tangential wavenumber exceeds the propagating value, the normal wavenumber is imaginary and carries no ordinary far-field beam.",
    ),
    pmlAbsorption: sceneGuideEntry(
      "propagation",
      "Late-time absorption of an outgoing pulse by CPML",
      "follow the pulse into the boundary and look for decay without a visible return wave into the physical domain.",
      "the CPML check should keep both late-energy and reflected-power ratios below 0.08.",
      "Graded conductivity and recursive memory variables continue Maxwell's update into a matched absorbing layer; residual reflection remains discretization dependent.",
    ),
    normalInterface: sceneGuideEntry(
      "interface",
      "Normal-incidence Fresnel reflection and transmission",
      "after the line wave reaches the n = 1.5 half-space, a weak reflected wave and a shorter transmitted wavelength should be visible.",
      "the carrier spectrum should populate R/T/residual and place reflectance within 0.08 of the analytical R = 0.04 reference.",
      "Continuity of tangential fields at the impedance step fixes the reflected and transmitted amplitudes; quantitative power requires the DFT port normalization.",
    ),
    obliqueRefraction: sceneGuideEntry(
      "interface",
      "Snell refraction of a finite-width Gaussian beam",
      "once the oblique beam enters the dielectric, its energy-flow direction should bend toward the interface normal.",
      "the transmitted-flow diagnostic should be directional and agree with Snell's angle within 18 degrees.",
      "Tangential phase matching conserves the interface-parallel wavevector, while the higher refractive index reduces the transmitted angle.",
    ),
    brewsterTm: sceneGuideEntry(
      "interface",
      "TM reflection minimum at the Brewster angle",
      "use the angular sweep after its scan completes; the canvas only provides the oblique-interface context.",
      "the sampled TM reflectance at the analytical Brewster angle should remain below 0.12, while the analytical sweep minimum stays within 6 degrees of arctan(n2/n1).",
      "At the Brewster condition the reflected and transmitted rays are orthogonal, forcing the TM Fresnel reflection coefficient through zero in the ideal lossless interface.",
    ),
    brewsterTeTm: sceneGuideEntry(
      "interface",
      "Contrasting TE and TM angular reflection near Brewster incidence",
      "during the dual sweep, the TM curve should develop a deep minimum while the TE curve remains finite.",
      "Results should retain both numerical polarization sweeps and their analytical Fresnel references near 56 degrees.",
      "Only the TM boundary conditions admit the electric-field geometry needed for the Brewster cancellation; TE reflection has no corresponding zero.",
    ),
    totalInternalReflection: sceneGuideEntry(
      "interface",
      "Total internal reflection with an evanescent low-index tail",
      "after the high-index beam reaches the air boundary above critical angle, the main beam should reflect while a field tail hugs the air side.",
      "the interface band should retain measurable energy while far-side air energy stays bounded relative to that band.",
      "Tangential phase matching above the critical angle makes the normal air-side wavevector imaginary, yielding evanescent penetration without propagating transmission.",
    ),
    frustratedTir: sceneGuideEntry(
      "interface",
      "Evanescent tunneling across a narrow air gap",
      "once the incident field reaches the gap, the evanescent tail should overlap the second high-index region and launch a transmitted beam.",
      "far-side energy should exceed the isolated-TIR reference by at least a factor of 1.3.",
      "A second dielectric placed within the evanescent decay length converts part of the non-propagating gap field back into a propagating mode.",
    ),
    quarterWaveCoating: sceneGuideEntry(
      "interface",
      "Antireflection by a quarter-wave dielectric coating",
      "after steady illumination, the backward field before the coated substrate should be weaker than for a bare interface.",
      "the line monitor should report reflectance below 0.12 with finite energy in both coating and substrate.",
      "The two principal reflected waves acquire a relative half-cycle phase and similar amplitudes, producing destructive interference near the design wavelength.",
    ),
    braggMirror: sceneGuideEntry(
      "interface",
      "Stop-band reflection from a six-pair Bragg mirror",
      "once the wave reaches the alternating stack, a strong standing pattern should form on the incident side and transmission should be suppressed.",
      "the layer audit should find at least ten segments and a reflectance above 0.1 at the teaching frequency.",
      "Quarter-wave optical thicknesses make reflections from successive interfaces add coherently inside the stop band.",
    ),
    lossyInterface: sceneGuideEntry(
      "interface",
      "Refraction and attenuation in a lossy dielectric half-space",
      "with Ez plus epsilon overlay, the transmitted wave should enter the dielectric and fade with propagation depth.",
      "the material diagnostic should confirm the lossy half-space and finite, but reduced, energy inside it.",
      "The imaginary refractive-index component represents conductive or absorptive loss, converting field energy into material dissipation during propagation.",
    ),
    anisotropicInterface: sceneGuideEntry(
      "interface",
      "Oblique transmission into an anisotropic dielectric",
      "with Ez plus epsilon overlay, inspect the transmitted phase fronts and energy direction after the Gaussian beam crosses the tensor interface.",
      "the tensor route should find distinct epsilon components throughout the half-space and measurable transmitted material energy.",
      "Unequal principal permittivities alter the polarization-dependent dispersion surface, so phase and energy directions need not follow the isotropic Snell construction.",
    ),
    jzDipole: sceneGuideEntry(
      "radiation",
      "Localized Ez radiation from a Jz electric-current dipole",
      "immediately after excitation, circular 2D wavefronts should expand from one localized source point.",
      "the source-neighborhood diagnostic should confirm one Ez dipole and finite local energy.",
      "A localized out-of-plane electric current directly drives Ez in the TMz formulation and radiates the cylindrical-wave analogue of a line dipole.",
    ),
    inPlaneDipole: sceneGuideEntry(
      "radiation",
      "Radiation from an in-plane electric-current dipole in the Hz formulation",
      "after launch, the Hz pattern should show the orientation-dependent lobes of the localized Jx/Jy source.",
      "Results should identify the Hz solver, the in-plane source route, and finite source-neighborhood energy.",
      "In 2D TEz, in-plane electric currents couple to Ex/Ey and generate Hz; this is physically distinct from injecting an Ez point source.",
    ),
    mzDipole: sceneGuideEntry(
      "radiation",
      "Symmetric Hz radiation from an effective Mz magnetic dipole",
      "after startup, wavefronts should expand approximately symmetrically from the magnetic-current source in homogeneous air.",
      "the directional-energy ratios should stay within the configured 0.85-1.18 symmetry bounds.",
      "A localized out-of-plane magnetic-current term is the electromagnetic dual of the Jz source and directly excites Hz in the reduced model.",
    ),
    dipoleSubstrate: sceneGuideEntry(
      "radiation",
      "Asymmetric dipole emission near a dielectric substrate",
      "once the expanding field reaches the substrate, compare the radiation above it with the field coupled into the high-index side.",
      "the guide should report a valid point source, a finite substrate mask, and nonzero source-region energy.",
      "The nearby dielectric changes the optical density of states and redirects part of the dipole field through reflection and transmission at the interface.",
    ),
    dipoleNearPec: sceneGuideEntry(
      "radiation",
      "Dipole interference with its PEC image",
      "after the source reaches the mirror, the direct and reflected fields should form an asymmetric standing/radiating pattern.",
      "the scene check should confirm one localized dipole, a nearby PEC mirror, and finite excitation energy.",
      "The PEC enforces zero tangential electric field and can be interpreted through an image source whose phase controls reinforcement and cancellation.",
    ),
    huygensRadiator: sceneGuideEntry(
      "radiation",
      "Forward-biased Huygens-source radiation",
      "after the source settles, most visible radiation should leave through the forward half-space with a suppressed backward lobe.",
      "the NTFF/source diagnostics should show a forward/backward sector ratio above 5 and a forward peak within 15 degrees of target.",
      "Co-located electric- and magnetic-like source terms are phased so their backward radiation cancels while their forward radiation adds.",
    ),
    circularDipole: sceneGuideEntry(
      "radiation",
      "Quadrature excitation of a circular dipole source",
      "watch the two source components cycle in quadrature and launch a rotating local field pattern before the wave reaches CPML.",
      "the source diagnostic should identify the circular route and finite localized energy.",
      "Equal orthogonal source components separated by a quarter cycle synthesize circular polarization in the reduced 2D field representation.",
    ),
    janusDipole: sceneGuideEntry(
      "radiation",
      "Directional Janus-source coupling into a dielectric guide",
      "after the near field overlaps the guide, energy should preferentially enter one guided direction rather than radiate symmetrically.",
      "Results should confirm the Janus route, finite high-index guide energy, and finite source overlap; this is a directional-coupling proxy, not calibrated beta factor.",
      "The source combines field components with a phase relation whose evanescent spectrum couples differently to opposite guide directions.",
    ),
    dipoleArray: sceneGuideEntry(
      "radiation",
      "Broadside radiation from an equal-phase dipole array",
      "after all eight emitters overlap in the far zone, the main lobe should point broadside to the vertical array.",
      "the NTFF check should keep the phase step near zero and the forward peak within 10 degrees of broadside.",
      "Uniform half-wavelength spacing and equal phase make transverse path delays cancel at broadside and add phase away from it.",
    ),
    phasedDipoleArray: sceneGuideEntry(
      "radiation",
      "Beam steering by progressive dipole-array phase",
      "after the eight-source field reaches the far-field contour, the main lobe should tilt away from broadside.",
      "the measured phase progression should imply a steering angle near -12 degrees and the NTFF peak should agree within 20 degrees.",
      "A constant phase increment shifts the direction in which propagation delay is compensated, steering the array factor without moving the elements.",
    ),
    apertureRadiator: sceneGuideEntry(
      "radiation",
      "Radiation through a slot in a PEC screen",
      "after the point-source field reaches the screen, only the open slot should launch a transmitted diffracted wave.",
      "the geometry diagnostic should confirm the source, PEC screen, and an aperture at least 20 cells wide.",
      "The conducting screen blocks tangential electric field except at the slot, where the transmitted near field behaves as an aperture source.",
    ),
    nearFarFieldNtff: sceneGuideEntry(
      "radiation",
      "Equivalence-principle conversion from near field to angular far field",
      "watch the local dipole wave on the canvas, then wait for at least 48 analysis samples before opening the angular result.",
      "the normalized NTFF pattern should contain at least 48 finite samples and a nontrivial bounded angular variation.",
      "Equivalent electric and magnetic currents sampled on the enclosing contour reconstruct the radiated far field; the output is normalized, not a calibrated antenna gain.",
    ),
    slabWaveguide: sceneGuideEntry(
      "guided",
      "Fundamental-mode confinement in a dielectric slab waveguide",
      "after the mode-profile launch settles, the field should remain concentrated in the high-index core and travel mainly forward.",
      "the modal diagnostic should show core energy above 0.45, backward and radiation ratios below 0.02, and finite input overlap.",
      "Total-internal-reflection confinement supports a transverse eigenmode; the finite-difference source approximates that mode instead of exciting the guide with a uniform line.",
    ),
    multimodeSlab: sceneGuideEntry(
      "guided",
      "Beating of two modes in a wide slab waveguide",
      "after both modal launches overlap, the transverse field profile should evolve periodically along the wider core.",
      "the guide check should confirm two mode-profile sources, including a higher-order mode, and finite source overlap.",
      "Modes with different propagation constants accumulate relative phase along the guide, producing longitudinal beating while remaining transversely confined.",
    ),
    lossyGuide: sceneGuideEntry(
      "guided",
      "Attenuation of a guided mode in an absorptive core",
      "with the field plus epsilon overlay, the launched mode should remain core-confined but fade as it propagates.",
      "Results should confirm a mode-profile source, lossy high-index cells, and finite energy in the guide band.",
      "The complex constitutive response removes electromagnetic energy from the otherwise guided mode, adding attenuation without changing the basic confinement mechanism.",
    ),
    waveguideBend: sceneGuideEntry(
      "guided",
      "Mode transport and radiation at a 90-degree dielectric bend",
      "once the pulse reaches the quarter-ring path, follow it around the corner and inspect any field radiated outside the output arm.",
      "the geometry check should confirm the off-axis guide and centroid shift; use downstream power qualitatively because bend loss is not calibrated here.",
      "The curved discontinuity forces the guided field to adapt continuously; insufficient radius or grid staircasing couples part of the mode to radiation.",
    ),
    taperWaveguide: sceneGuideEntry(
      "guided",
      "Adiabatic-like expansion through a gradual waveguide taper",
      "after launch, the mode should broaden with the core while producing less abrupt backscatter than a width step.",
      "the geometry diagnostic should show a substantial width range with adjacent-column changes below 0.16 lambda0.",
      "A gradual boundary variation reduces coupling between the forward mode and reflected or radiative modes, subject to the finite taper length.",
    ),
    widthStepWaveguide: sceneGuideEntry(
      "guided",
      "Modal mismatch at an abrupt waveguide-width discontinuity",
      "when the guided field reaches the step, look for a changed transverse profile plus localized reflection and radiation.",
      "the scene check should identify narrow and wide sections with an abrupt width jump of at least 0.16 lambda0.",
      "The input mode is not an eigenmode of the wider section, so continuity at the step redistributes its amplitude among transmitted, reflected, and radiative components.",
    ),
    directionalCoupler: sceneGuideEntry(
      "guided",
      "Evanescent power transfer between parallel dielectric guides",
      "after the launched mode traverses the coupling length, the initially dark neighboring guide should carry a visible downstream field.",
      "time-sampled downstream Poynting flux should place at least 30% of forward power in the cross guide.",
      "The isolated guide modes hybridize into even and odd supermodes; their accumulated phase difference periodically transfers power between guides.",
    ),
    mmiWaveguide: sceneGuideEntry(
      "guided",
      "Balanced self-imaging in a 1x2 multimode-interference splitter",
      "after the input reaches the wide section, multimode beating should form two comparable images at the output guides.",
      "the time-sampled output Ez-squared split should remain within 0.10 of 50/50.",
      "Several lateral modes propagate through the wide region and rephase near the output plane to reproduce balanced images of the input field.",
    ),
    machZehnder: sceneGuideEntry(
      "guided",
      "Phase-controlled recombination in a Mach-Zehnder interferometer",
      "follow the mode through the splitter, both separated arms, the phase-shifter section, and the final combiner.",
      "Results should show finite energy in both arms, the phase shifter, combiner, and output guide; this is a route/overlap check, not a calibrated transfer curve.",
      "The splitter creates two coherent paths; their relative phase at the combiner determines whether the output interferes constructively or destructively.",
    ),
    guideScatterer: sceneGuideEntry(
      "guided",
      "Perturbation of a guided mode by a nearby dielectric scatterer",
      "when the forward mode passes the off-axis inclusion, inspect local field distortion and weak radiation outside the core.",
      "the contract should confirm a straight guide, one offset perturbation, and the modal source; no scattering cross section is claimed.",
      "The inclusion samples the evanescent tail and changes the local permittivity, coupling the guided mode to reflected and radiative fields.",
    ),
    microstrip: sceneGuideEntry(
      "guided",
      "Quasi-TEM field confinement in a 2D microstrip cross-section",
      "with Hz and the epsilon overlay, the field should occupy the dielectric between the PEC strip and ground plane and fringe into air.",
      "Results should confirm separated PEC conductors, a dielectric substrate, and at least 5% of field energy in the substrate.",
      "The strip-ground potential difference supports a quasi-TEM cross-sectional field; this invariant 2D model does not simulate propagation along the physical microstrip length.",
    ),
    stubResonator: sceneGuideEntry(
      "resonator",
      "Odd-quarter-wave resonance of an open dielectric side stub",
      "within about 4 s, magnitude view should show a high-contrast standing pattern in the open stub and weaker through transmission.",
      "the stub visibility should exceed 0.5 and the resonator/guide energy ratio should remain finite; confirm any notch with the port result.",
      "The tuned branch returns a phase-shifted field to the bus, creating a standing resonance in the stub and destructive interference in the through channel.",
    ),
    fabryPerot: sceneGuideEntry(
      "resonator",
      "Field localization between two dielectric Bragg reflectors",
      "after repeated round trips, magnitude view should brighten in the central defect between the mirror stacks.",
      "the localization diagnostic should place at least 1% of total field energy in the cavity; it does not constitute a calibrated Q measurement.",
      "Counter-propagating reflections add constructively when the round-trip phase matches a longitudinal cavity condition.",
    ),
    fabryPerotStanding: sceneGuideEntry(
      "resonator",
      "Standing-wave contrast in a driven Fabry-Perot cavity",
      "after at least 64 analysis samples, nodes and antinodes should remain fixed inside the central cavity.",
      "the cavity-line diagnostic should report visibility above 0.2 and peak-to-background contrast above 1.2.",
      "Near resonance, coherent forward and backward intracavity waves have comparable amplitude and form a stationary interference pattern.",
    ),
    ringResonator: sceneGuideEntry(
      "resonator",
      "Ring build-up and destructive interference at the through port",
      "within about 4 s, magnitude view should show circulation around the side-coupled ring and a weakened field after the coupler.",
      "ring/bus energy should exceed 0.20 and the sweep/port diagnostic should distinguish the resonant notch from off resonance.",
      "At resonance the circulating field adds coherently each round trip; the component coupled back to the bus opposes the direct through field.",
    ),
    addDropRing: sceneGuideEntry(
      "resonator",
      "Resonant transfer from an input bus to an add-drop output",
      "within about 5 s, the ring and drop guide should brighten while the through field is reduced.",
      "ring/bus energy should exceed 0.20 and drop/bus energy should exceed 0.10, with on/off resonance comparison in Results.",
      "The resonant circulating mode couples to both buses, redirecting part of the input power into the drop channel while interfering at the through port.",
    ),
    racetrackResonator: sceneGuideEntry(
      "resonator",
      "Pulsed excitation and decay of a racetrack resonator",
      "after the guided pulse passes, magnitude view should retain a circulating racetrack field that decays in time.",
      "the resonator should store at least 0.5% of the energy and the fitted teaching Q proxy should exceed 100 after 64 samples.",
      "The straight coupling section transfers pulse energy into the closed path; post-pulse leakage and material loss determine the observed ringdown.",
    ),
    dielectricCavity: sceneGuideEntry(
      "resonator",
      "Localized dipole excitation of a high-index disk cavity",
      "after launch, magnitude view should show the internal dipole feeding a field pattern concentrated in the dielectric disk.",
      "the cavity check should confirm the central disk, embedded source, and finite source-overlap energy.",
      "Index contrast partially traps waves by internal reflection, while the source symmetry selects which leaky disk modes are excited.",
    ),
    pecCavity: sceneGuideEntry(
      "resonator",
      "Standing field inside a finite PEC box cavity",
      "after the Gaussian point pulse reflects from all four walls, a bounded nodal pattern should form inside the conducting frame.",
      "Results should confirm the closed PEC frame, internal source, and finite overlap; no eigenfrequency accuracy is claimed without convergence.",
      "The PEC boundary forces the tangential electric field to vanish, admitting discrete standing patterns set by the box dimensions.",
    ),
    quarterWaveCavity: sceneGuideEntry(
      "resonator",
      "Short-circuited odd-quarter-wave stub resonance and ringdown",
      "after the pulse reaches the branch, magnitude view should show a standing antinode pattern in the PEC-terminated stub followed by decay.",
      "visibility should exceed 0.5, stored-energy ratio 0.005, and the loaded-Q teaching proxy 40 after 64 samples.",
      "The PEC short fixes a field node at the termination; an odd guided quarter wavelength transforms it into a strong response at the bus junction.",
    ),
    qRingdown: sceneGuideEntry(
      "resonator",
      "Loaded-Q estimation from a pulsed cavity-energy decay",
      "after the excitation pulse leaves, the cavity field should persist briefly and then decay without continued driving.",
      "after at least 128 samples, the fitted ringdown Q should be finite, positive, and above 100; treat it as a finite-window proxy.",
      "For approximately exponential stored-energy decay, the decay constant maps to loaded Q, but CPML leakage, sampling window, and grid dispersion affect the estimate.",
    ),
    purcell2d: sceneGuideEntry(
      "resonator",
      "Bounded 2D Q/Aeff cavity-emission metric",
      "after the internal dipole excites the nested cavity, magnitude view should show concentrated field around the source region.",
      "Results should report finite Q, effective area between 0.05 and 20 lambda0 squared, and a bounded Q/Aeff teaching metric.",
      "The ratio combines temporal storage with 2D field confinement; it is an educational analogue and must not be interpreted as a calibrated 3D Purcell factor.",
    ),
    betaFactor: sceneGuideEntry(
      "radiation",
      "Dipole coupling into a slab-guide flux channel",
      "after the nearby dipole launches, field should enter the dielectric guide and propagate away from the source.",
      "the bounded guided-flux ratio should lie between 0.001 and 0.2 after 128 samples; it is not a fully normalized spontaneous-emission beta factor.",
      "The guide samples part of the emitter's local spectrum and carries it as a bound mode, while the remaining energy radiates or is absorbed by the finite domain.",
    ),
    degenerateModes: sceneGuideEntry(
      "resonator",
      "Two-source excitation of near-degenerate disk-cavity modes",
      "after both off-center dipoles excite the disk, inspect the superposed cavity pattern rather than expecting one stationary symmetry.",
      "the analysis should resolve a finite two-peak spectral split after 128 samples and maintain measurable disk localization.",
      "The symmetric cavity supports related modal patterns; separated sources couple to different combinations, while grid staircasing can lift ideal degeneracy.",
    ),
    pecCylinder: sceneGuideEntry(
      "scattering",
      "Plane-wave scattering and shadowing by a 2D PEC cylinder",
      "after illumination, look for a strong downstream shadow, upstream interference fringes, and outgoing cylindrical scattered waves.",
      "the obstacle check should confirm PEC cells and bounded shadow energy; this is a 2D cylinder, not 3D Mie-sphere scattering.",
      "Surface currents enforce zero tangential electric field and reradiate a scattered field that interferes with the incident plane wave.",
      null,
      {
        fdtd: "The FDTD grid launches a plane-wave-like excitation toward a PEC inclusion. The PEC boundary forces the tangential electric field to vanish, and CPML absorbs outgoing waves.",
        geometry: "Circular PEC cylinder in homogeneous air, represented on the Cartesian grid with resolution-dependent staircasing.",
        materials: "Air plus an ideal, lossless PEC obstacle; finite-conductivity skin depth is not represented.",
        errors: [
          "Using too coarse a grid, which makes the cylinder polygonal and shifts its scattering pattern.",
          "Placing the cylinder or sampling contour too close to CPML.",
          "Comparing this 2D cylinder directly with 3D Mie scattering from a sphere.",
        ],
      },
    ),
    dielectricCylinder: sceneGuideEntry(
      "scattering",
      "Near-field scattering by a lossless dielectric cylinder",
      "once illuminated, field should enter the n = 2 cylinder and create side scattering plus a modified downstream pattern.",
      "the near-field diagnostic should show finite object energy and side scattering above the configured back-region comparison.",
      "Polarization inside the finite dielectric reradiates with a phase set by index contrast and cylinder size, producing a 2D resonant-scattering pattern.",
    ),
    mieCylinder: sceneGuideEntry(
      "scattering",
      "Broadband Mie-like response of a high-index 2D cylinder",
      "after the pulse reaches the cylinder, inspect transient internal hotspots and outgoing scattered rings across the pulse bandwidth.",
      "Results should confirm high-index object energy and finite off-axis scattering; no calibrated analytical Mie spectrum is claimed.",
      "The broadband pulse overlaps multiple 2D cylinder resonances whose electric and magnetic-like responses depend on size, polarization, and grid resolution.",
    ),
    rcsCylinder: sceneGuideEntry(
      "scattering",
      "Incident-subtracted 2D NTFF scattering width of a PEC cylinder",
      "use the canvas for the near field, then wait for at least 512 analysis samples before reading the angular pattern.",
      "the NTFF result should be finite and directionally nontrivial after background subtraction; it is a 2D scattering-width estimate, not 3D RCS.",
      "Equivalent currents on the sampling contour transform the scattered near field into an angular far-field observable after removing the incident reference.",
    ),
    lossyCylinder: sceneGuideEntry(
      "scattering",
      "Scattering plus absorption in a lossy dielectric cylinder",
      "with field plus epsilon overlay, the wave should penetrate the object while its internal and downstream amplitude are attenuated.",
      "the material check should find lossy high-index cells, finite object energy, and bounded downstream channel energy.",
      "The induced polarization reradiates as in dielectric scattering, while the imaginary constitutive term dissipates part of the stored field energy.",
    ),
    dielectricDimer: sceneGuideEntry(
      "scattering",
      "Near-field hybridization across a dielectric-dimer gap",
      "after illumination, inspect the narrow gap for a coupled field pattern distinct from either isolated cylinder.",
      "the geometry and energy checks should confirm two high-index objects, finite gap energy, and finite off-axis scattering.",
      "Evanescent fields of the two resonators overlap across the gap, splitting their isolated responses into collective bonding- and antibonding-like patterns.",
    ),
    kerker2d: sceneGuideEntry(
      "scattering",
      "Strong forward/backward contrast in 2D high-index scattering",
      "use Hz near-field view for the cylinder response, then inspect the angular result after at least 512 samples.",
      "the normalized NTFF forward/backward ratio should exceed 5; this is a 2D directional-scattering analogue, not a complete multipole proof.",
      "Interference between electric- and magnetic-like cylinder responses suppresses one angular direction while reinforcing the other near the selected frequency.",
    ),
    multipleScattering: sceneGuideEntry(
      "scattering",
      "Wave redistribution by a deterministic cluster of scatterers",
      "after the incident field enters the cluster, a complex speckle-like pattern should spread beyond the original central channel.",
      "Results should confirm many inclusions, finite lateral energy, and finite transmitted-channel energy without assigning a diffusion coefficient.",
      "Repeated phase-delayed scattering among inclusions creates many interfering paths and redistributes energy laterally and longitudinally.",
    ),
    weakLocalization: sceneGuideEntry(
      "scattering",
      "Coherent multiple-scattering precursor in weak disorder",
      "after the wave samples many weak inclusions, look for fine speckle and enhanced return-path interference around the incident region.",
      "the disorder check should report many inclusions, finite lateral spread, and a nonempty forward channel; it does not validate coherent-backscattering width.",
      "Time-reversed multiple-scattering paths can interfere constructively in the backward direction, but this short 2D scene only exposes the qualitative precursor.",
    ),
    andersonLocalization: sceneGuideEntry(
      "scattering",
      "Bounded transport and field trapping in dense high-contrast disorder",
      "after the pulse enters the dense random region, energy should remain spatially irregular and less able to reach the right boundary.",
      "after 512 samples, lateral energy should exceed 0.2 and right/left channel transport stay below 0.8; no localization length is fitted.",
      "Strong recurrent scattering can inhibit transport and concentrate the field, but finite size and runtime prevent a quantitative Anderson-localization claim.",
    ),
    diffusiveRandomMedium: sceneGuideEntry(
      "scattering",
      "Speckle-like spreading through an extended weak random medium",
      "once the field traverses the random region, it should broaden laterally while retaining measurable forward transport.",
      "the transport diagnostic should show finite lateral spread and a nonzero right/left channel ratio after analysis warm-up.",
      "Many weak scattering events randomize phase and direction, producing a diffusive-looking intensity distribution without a fitted mean free path.",
    ),
    finiteConductivity: sceneGuideEntry(
      "dispersive",
      "Explicit J = sigma E damping in a conductive half-space",
      "with field plus epsilon overlay, follow the pulse into the conductor and watch it decay with depth and time.",
      "the conductive-current route should be active and the late-energy ratio should remain below 0.3; no calibrated skin-depth fit is claimed.",
      "Ohmic current is updated with the electric field and removes electromagnetic energy locally rather than applying cosmetic frame damping.",
    ),
    drudeMetal: sceneGuideEntry(
      "dispersive",
      "Free-carrier Drude ADE response below the plasma frequency",
      "after the incident field reaches the metal, display the field with epsilon overlay and inspect the reflected wave plus shallow material penetration.",
      "Results should report negative effective epsilon, active ADE current, and finite temporal energy in the dispersive cells.",
      "The auxiliary current follows the driven free-electron equation, producing frequency-dependent negative permittivity and loss.",
    ),
    lorentzMedium: sceneGuideEntry(
      "dispersive",
      "Resonant bound-charge polarization in a Lorentz slab",
      "after excitation reaches the slab, field plus epsilon overlay should reveal strong material interaction and delayed oscillatory response.",
      "the Lorentz ADE diagnostic should show elevated effective epsilon and finite energy in the resonant cells.",
      "A damped auxiliary polarization oscillator stores and returns energy near its resonance, creating dispersive phase delay and absorption.",
    ),
    debyeDielectric: sceneGuideEntry(
      "dispersive",
      "Relaxational polarization in a Debye dielectric",
      "after the wave enters the slab, use field plus epsilon overlay to compare its response with a nondispersive dielectric.",
      "Results should identify Debye ADE cells, effective epsilon above the high-frequency baseline, and finite material energy.",
      "The first-order polarization state relaxes toward the applied field, yielding a frequency-dependent permittivity without a resonant oscillation.",
    ),
    plasmaCutoff: sceneGuideEntry(
      "dispersive",
      "Reflection near a collisionless-plasma cutoff",
      "once the incident wave reaches the plasma slab, the field should remain largely outside while an evanescent tail penetrates the material.",
      "the ADE diagnostic should report negative effective epsilon and finite, bounded material energy.",
      "Below the plasma frequency the Drude-like effective permittivity is negative, so the bulk wavenumber becomes non-propagating in this model.",
    ),
    enzSlab: sceneGuideEntry(
      "dispersive",
      "Near-uniform phase response in a passive ENZ slab",
      "with field plus epsilon overlay, inspect the thin slab for small phase variation once the wave overlaps it.",
      "Results should place mean absolute effective epsilon below 0.15 and confirm finite dispersive-cell interaction.",
      "Near epsilon = 0 the internal phase constant is small, but transmission and enhancement still depend on impedance, loss, thickness, and discretization.",
    ),
    anisotropicMedium: sceneGuideEntry(
      "tensor",
      "Field response of a block with unequal principal permittivities",
      "with field plus epsilon overlay, watch the localized excitation propagate differently along the two tensor axes.",
      "the tensor diagnostic should find at least 400 anisotropic cells, epsilon contrast above 1.5, and finite material energy.",
      "Different epsilon_x and epsilon_y values reshape the local dispersion relation and therefore the phase and energy distribution.",
    ),
    hyperbolicMedium: sceneGuideEntry(
      "dispersive",
      "Indefinite anisotropic Drude response in a hyperbolic block",
      "with Hz plus epsilon overlay, inspect directional high-spatial-frequency structure emitted inside the tensor material.",
      "Results should confirm opposite-sign effective tensor eigenvalues and substantial field overlap; no calibrated isofrequency contour is extracted.",
      "One positive and one negative principal permittivity produce an open hyperbolic dispersion surface in the effective 2D Drude model.",
    ),
    chiralMedium: sceneGuideEntry(
      "tensor",
      "Passivity-limited six-field magnetoelectric coupling",
      "with Hz and material overlay, inspect the block for a finite cross-field component after the incident wave enters.",
      "the six-field diagnostic should report nonzero kappa, positive passivity margin, and finite cross-polarized energy; optical rotation is not calibrated.",
      "The local bianisotropic update couples electric and magnetic components through kappa while limiting the coupling to preserve the implemented passivity bound.",
    ),
    bianisotropicMedium: sceneGuideEntry(
      "tensor",
      "Combined anisotropic epsilon/mu and magnetoelectric coupling",
      "after the wave enters the block, display Hz with epsilon or mu overlay and look for primary-to-cross-field conversion.",
      "Results should confirm anisotropic cells, nonzero kappa, positive passivity margin, and finite cross-field fraction.",
      "Tensor epsilon and mu set different component responses while the magnetoelectric term mixes the electric and magnetic subspaces in the six-field update.",
    ),
    gyrotropicMedium: sceneGuideEntry(
      "tensor",
      "Antisymmetric gyrotropic-tensor response",
      "with Hz plus epsilon overlay, inspect the field after it overlaps the biased tensor block for a rotated or asymmetric pattern.",
      "the tensor check should find at least 400 gyrotropic cells, |g| above 0.2, and finite material energy.",
      "Opposite-sign off-diagonal epsilon terms couple orthogonal in-plane components and break the symmetry of an ordinary reciprocal scalar dielectric.",
    ),
    braggStack: sceneGuideEntry(
      "periodic",
      "Stop-band reflection from a one-dimensional periodic dielectric stack",
      "after illumination, the periodic layers should support a strong incident-side standing pattern with reduced downstream field.",
      "the stack should contain at least ten layers and show reflectance above 0.1 with bounded transmitted-side energy.",
      "Periodic quarter-wave phase accumulation makes interface reflections add coherently over a frequency band.",
    ),
    photonicCrystal: sceneGuideEntry(
      "periodic",
      "Bloch-band formation in a square lattice of dielectric rods",
      "after the wave reaches the lattice, use field plus epsilon overlay to see periodic scattering across the rod array.",
      "the compact Bloch/PWE panel should report finite bands, a nonzero gap observable, and at least 13 path points.",
      "Discrete translational symmetry folds plane-wave components into Bloch modes; the compact PWE result is a teaching reference rather than a converged band solver.",
    ),
    phcPointDefect: sceneGuideEntry(
      "periodic",
      "Localized state at a missing-rod photonic-crystal defect",
      "after the central dipole excites the lattice, magnitude plus epsilon overlay should brighten around the vacant site.",
      "the defect and cavity regions should hold measurable energy while the surrounding-lattice Bloch/PWE reference remains available.",
      "Removing one periodic scatterer creates a local spectral state that can concentrate field inside the lattice band structure.",
    ),
    phcWaveguide: sceneGuideEntry(
      "periodic",
      "Channel confinement in a photonic-crystal line defect",
      "once launched, field should remain concentrated in the missing-row channel and propagate well beyond the source.",
      "line-defect energy should exceed 0.12, downstream/source energy ratio 3, and downstream/upstream ratio 2 with bounded adjacent-row leakage.",
      "The removed row supports modes inside the surrounding crystal's forbidden or weakly transmitting frequency range.",
    ),
    phcOptimizedCavity: sceneGuideEntry(
      "periodic",
      "Field localization in a shifted L3 photonic-crystal cavity",
      "after local excitation, magnitude plus epsilon overlay should concentrate inside the three-hole defect and decay into the lattice.",
      "Results should confirm the shifted geometry, finite cavity energy, compact Bloch path, and a bounded Q proxy above 4; no optimization claim is made.",
      "Removing three sites creates the defect, while nearby shifts and tapers alter leakage channels and modal confinement.",
    ),
    phcDisorder: sceneGuideEntry(
      "periodic",
      "Scattering from deterministic positional disorder in a rod lattice",
      "with field plus epsilon overlay, compare the irregular speckle and propagation path with the perfect photonic crystal.",
      "the lattice audit should report a nonzero mean rod displacement and finite field interaction; no disorder-induced localization length is claimed.",
      "Randomized rod positions break exact Bloch periodicity and mix crystal wavevectors, increasing scattering between lattice channels.",
    ),
    phcDarkMode: sceneGuideEntry(
      "periodic",
      "Antisymmetric excitation of a dark photonic-crystal defect",
      "after the opposite-phase dipoles settle, magnitude view should localize field in the symmetric defect with weak visible leakage.",
      "Results should confirm nearly 180-degree source phase difference, cavity overlap, low asymmetry, and finite leakage/Q proxies.",
      "Odd source symmetry couples to a defect pattern that poorly overlaps the dominant radiation channel; the leakage value remains a compact proxy.",
    ),
    quasiBic: sceneGuideEntry(
      "periodic",
      "Leakage opened by weak symmetry breaking in a quasi-BIC defect",
      "after excitation, compare the localized field and outgoing leakage with the symmetric dark-mode scene.",
      "Results should report deliberate source/geometry asymmetry, finite cavity energy, and a bounded leakage/Q proxy.",
      "Breaking the cancellation symmetry opens a radiation channel, converting the idealized dark state into a finite-lifetime resonance.",
    ),
    symmetryProtectedBic: sceneGuideEntry(
      "periodic",
      "Symmetry-protected leakage suppression in an L3-like cavity",
      "after opposite-phase excitation, magnitude view should retain a symmetric localized cavity pattern with limited radiation.",
      "the compact analysis should confirm source antisymmetry, low structural asymmetry, finite cavity overlap, and Q proxy above 4.",
      "Mode and radiation-channel symmetries are mismatched, suppressing coupling in the ideal limit; finite grid and domain leave residual leakage.",
    ),
    fanoResonator: sceneGuideEntry(
      "resonator",
      "Interference between a bus continuum and a side-resonator pathway",
      "once the guided wave reaches the side cavity, inspect resonator build-up and the perturbed through field.",
      "the temporal diagnostic should confirm finite resonator energy and coupling to the bus; a calibrated asymmetric line shape still requires a frequency sweep.",
      "The direct bus path interferes with the delayed resonant path, producing the phase-sensitive mechanism behind a Fano response.",
    ),
    sshTrivial: sceneGuideEntry(
      "periodic",
      "Trivial dimerization of a finite SSH chain",
      "with field plus epsilon overlay, inspect the alternating large-small gaps and the absence of a deliberately seeded interface state.",
      "the analytic reference should report winding 0 and a finite gap for d1 greater than d2.",
      "The chosen intracell coupling is stronger than the intercell coupling, placing the clean tight-binding analogue in its trivial convention.",
    ),
    sshTopological: sceneGuideEntry(
      "periodic",
      "Topological dimerization of a finite SSH chain",
      "with field plus epsilon overlay, compare the inverted small-large gap order with the trivial preset.",
      "the analytic reference should report winding 1 and a finite gap for d1 less than d2.",
      "Exchanging intracell and intercell couplings changes the clean SSH winding, although the canvas is a finite full-wave analogue rather than the tight-binding Hamiltonian itself.",
    ),
    sshInterface: sceneGuideEntry(
      "periodic",
      "Localized state at an interface between SSH dimerizations",
      "after the central dipole launches, magnitude plus epsilon overlay should concentrate field around the junction of the two gap orders.",
      "the clean-limit reference should mark winding 1 and the interface region should hold at least half of the sampled field energy.",
      "Joining domains with different SSH winding creates an interface-state analogue inside the clean-limit gap.",
    ),
    sshDisorder: sceneGuideEntry(
      "periodic",
      "Persistence of an SSH-interface field under deterministic disorder",
      "after excitation, inspect whether magnitude remains concentrated near the perturbed interface rather than following perfect periodic spacing.",
      "Results should retain the clean-limit winding/gap reference and at least 50% interface-energy fraction; no disordered invariant is calculated.",
      "Moderate positional disorder perturbs couplings but need not remove the interface state while the effective gap remains open.",
    ),
    nonHermitianSsh: sceneGuideEntry(
      "nonhermitian",
      "Gain/loss-modified SSH interface response",
      "with field plus epsilon overlay, watch the interface pattern become biased toward alternating gain and loss sites after warm-up.",
      "Results should confirm both gain/loss masks, saturable stabilization, finite non-Hermitian gap proxy, and localized interface energy.",
      "Alternating amplification and attenuation make the effective coupled system non-Hermitian; the displayed gap is a reduced analytic diagnostic, not a full-wave eigenvalue solve.",
    ),
    honeycombLattice: sceneGuideEntry(
      "periodic",
      "Baseline sublattice bias in a honeycomb-like photonic lattice",
      "with field plus epsilon overlay, inspect the two-site unit cells before comparing domain-wall variants.",
      "the geometry diagnostic should confirm many rods and the same mass-bias sign in the upper and lower halves.",
      "Unequal sublattice sites open a valley-like gap in the reduced lattice picture; this uniform domain provides the trivial reference geometry.",
    ),
    valleyHall: sceneGuideEntry(
      "periodic",
      "Guided transport along an inverted Valley-Hall domain wall",
      "after launch, Poynting view should follow the straight interface between oppositely biased honeycomb domains.",
      "Results should confirm inverted sublattice signs and finite energy concentrated along the interface channel.",
      "Reversing the sublattice mass changes the valley-Hall phase of the reduced lattice, allowing an interface-channel analogue between the domains.",
    ),
    valleyHallBend: sceneGuideEntry(
      "periodic",
      "Transport through a 90-degree Valley-Hall domain-wall bend",
      "after the pulse reaches the corner, Poynting view should turn into the vertical channel with limited return toward the source.",
      "downstream bend energy should exceed 0.1, downstream/upstream ratio 0.2, and backscatter remain below 0.25.",
      "The bent interface continues the inverted-domain boundary, guiding the valley-like channel around the corner within the limitations of the finite lattice.",
    ),
    topologicalPumping: sceneGuideEntry(
      "temporal",
      "Materially modulated SSH-chain transport route",
      "with field plus epsilon overlay, watch the chain while its site parameters vary in time after analysis warm-up.",
      "Results should confirm active modulation, finite site-chain overlap, and analysis samples; no quantized pump displacement is claimed.",
      "Cyclic parameter modulation can move an eigenstate through a synthetic parameter space, but this scene validates only the active modulated-chain precursor.",
    ),
    topologyDefect: sceneGuideEntry(
      "periodic",
      "Valley-Hall channel interacting with a strong PEC defect",
      "after the interface field reaches the obstacle, inspect diversion, local reflection, and any continuation along the domain wall.",
      "the scene contract should confirm both inverted domains, the PEC defect, and finite channel-region energy; robustness is qualitative here.",
      "The strong obstacle perturbs the interface path and tests whether the structured channel can route around it without asserting disorder-proof transmission.",
    ),
    sppInterface: sceneGuideEntry(
      "dispersive",
      "Surface-plasmon-polariton localization at a metal-dielectric interface",
      "with Hz plus epsilon overlay, the near-field dipole should launch a wave bound to the horizontal interface and decaying into both media.",
      "surface-band energy should exceed the configured air and bulk comparison bands and represent at least 20% of sampled energy.",
      "Opposite-sign permittivities permit a TM-like bound surface mode whose parallel wavenumber exceeds that of the adjacent dielectric.",
    ),
    sppGrating: sceneGuideEntry(
      "dispersive",
      "Grating-assisted launch of an interface-localized SPP-like field",
      "after oblique illumination reaches the teeth, Hz plus epsilon overlay should show a wave propagating along the metal surface.",
      "the geometry should include many grating cells and surface energy should exceed the air and bulk-metal comparison bands.",
      "The periodic teeth supply additional tangential momentum that couples the incident propagating wave to the larger-wavenumber surface mode.",
    ),
    localizedPlasmon: sceneGuideEntry(
      "dispersive",
      "Localized Drude-disk plasmon near-field storage",
      "with field plus epsilon overlay, the driven nanodisk should show a concentrated, spatially localized near-field pattern.",
      "Results should confirm Drude cells and finite disk, near-field, and dispersive-material energy.",
      "Collective free-carrier polarization resonates against the restoring surface charge, producing a localized field enhancement limited by damping and grid resolution.",
    ),
    plasmonicDimer: sceneGuideEntry(
      "dispersive",
      "Bonding-mode hot spot in a resolved Drude-dimer gap",
      "with the electric field plus epsilon overlay, the narrow gap should become much brighter than the nearby background after excitation.",
      "peak gap enhancement should exceed 12 and mean enhancement 3, with at least 16 resolved gap cells.",
      "Opposing surface charges on the coupled disks concentrate electric field in the gap; the quantitative enhancement is strongly mesh dependent.",
    ),
    metasurfacePhaseBars: sceneGuideEntry(
      "dispersive",
      "Wavefront steering by a graded dielectric-bar metasurface",
      "after transmission through the bar array, inspect the phase fronts or Poynting flow for a tilt relative to the incident wave.",
      "the geometry diagnostic should confirm at least 13 bars, a finite height gradient, and material-field overlap; steering angle is qualitative.",
      "Different bar heights impose different propagation phases across the aperture, approximating a transverse phase gradient.",
    ),
    perfectAbsorber: sceneGuideEntry(
      "dispersive",
      "Low-reflection absorption in a graded lossy sheet backed by PEC",
      "after steady illumination, little field should return upstream and none should propagate beyond the PEC backplane.",
      "the line balance should report absorption proxy above 0.95, reflectance below 0.01, and transmission below 0.001.",
      "The graded lossy layer reduces front-face mismatch and dissipates the field, while the conductor blocks transmission; the result is monitor-normalization dependent.",
    ),
    negativeIndexSlab: sceneGuideEntry(
      "dispersive",
      "Phase evolution in a passive double-negative Drude slab",
      "with Hz plus epsilon or mu overlay, compare the in-slab phase fronts with the forward Poynting direction after warm-up.",
      "Results should confirm simultaneous negative effective epsilon and mu plus finite coherent slab field; calibrated negative refraction remains pending.",
      "When both effective constitutive parameters are negative, phase velocity can oppose energy flow, but a converged reference is required for quantitative claims.",
    ),
    superlensSlab: sceneGuideEntry(
      "dispersive",
      "Finite point-source image transfer through a double-negative slab",
      "after the point field crosses the slab, inspect the image-side plane for a localized feature corresponding to the source.",
      "the 2D transfer metric should be finite and the sampled image width below 0.85 of the object-plane width under this preset.",
      "The low-loss double-negative model can amplify selected evanescent components, but the displayed transfer is finite-domain evidence rather than a general super-resolution claim.",
    ),
    hyperlens: sceneGuideEntry(
      "dispersive",
      "Angular-harmonic transfer through a 2D hyperbolic annulus",
      "with Hz plus epsilon overlay, watch inner-source detail propagate radially through the anisotropic annulus.",
      "after analysis warm-up, the inner/outer-ring MTF should have at least eight valid harmonics and finite transfer; calibration remains pending.",
      "Radial and tangential tensor components map high angular spatial frequencies through the annulus in the reduced hyperbolic model.",
    ),
    enzEmitter: sceneGuideEntry(
      "dispersive",
      "Dipole coupling to a nearby passive ENZ slab",
      "with the electric field plus epsilon overlay, compare the dipole near field inside and outside the near-zero-permittivity layer.",
      "Results should confirm the Drude ENZ tuning and finite emitter-to-slab energy overlap; directional enhancement is not calibrated.",
      "The ENZ layer alters phase and impedance near the emitter, reshaping its local field and available coupling channels.",
    ),
    kerrSlab: sceneGuideEntry(
      "nonlinear",
      "Instantaneous intensity-dependent permittivity in a Kerr slab",
      "with the electric field plus epsilon overlay, watch the active slab's material shading respond where field intensity is largest.",
      "after the wave reaches the slab, Results should confirm nonlinear cells and finite active-material energy; no calibrated n2 curve is inferred.",
      "The local Kerr update changes permittivity in proportion to the internally scaled field intensity, coupling the visible cause and material response.",
    ),
    shgSlab: sceneGuideEntry(
      "nonlinear",
      "Second-harmonic generation in a chi2 slab",
      "with field plus epsilon overlay, first verify pump overlap with the slab; the harmonic itself should be judged after analysis warm-up.",
      "Results should show a finite H2 response above 0.05 and at least 1.2 times the H3 readout.",
      "The quadratic polarization-current term contains a component at twice the pump frequency; the reported amplitude is not a calibrated conversion efficiency.",
    ),
    thgSlab: sceneGuideEntry(
      "nonlinear",
      "Third-harmonic generation from a chi3 polarization current",
      "with field plus epsilon overlay, verify pump penetration into the nonlinear slab before opening the spectrum.",
      "after analysis warm-up, H3 should be finite and above 0.05; no absolute THG efficiency is claimed.",
      "Cubing the oscillating pump field creates a polarization component at three times the carrier frequency alongside a fundamental-frequency contribution.",
    ),
    spmKerrPulse: sceneGuideEntry(
      "nonlinear",
      "Self-phase modulation of a pulse in a Kerr section",
      "follow the pulse through the active region with field plus epsilon overlay and inspect its temporal distortion after exit.",
      "Results should show finite active-section overlap and a sideband ratio above 0.2 after analysis warm-up.",
      "The pulse intensity changes its own refractive index in time, imposing a time-dependent phase and broadening the spectrum.",
    ),
    kerrBistableCavity: sceneGuideEntry(
      "nonlinear",
      "Intensity-dependent detuning of a Kerr ring cavity",
      "after the guided mode reaches the ring, use field plus epsilon overlay to see whether the nonlinear cavity stores energy.",
      "Results should confirm finite guide and active-ring overlap; bistability requires the amplitude sweep and is not established by one frame.",
      "Kerr-induced index change shifts the cavity phase condition, feeding back on stored intensity and enabling a hysteretic response under suitable drive.",
    ),
    vo2SwitchingSlab: sceneGuideEntry(
      "nonlinear",
      "Thresholded hysteretic switching in a VO2-like slab",
      "with the electric field plus epsilon overlay, watch high-field regions change material state after the switching delay.",
      "Results should show at least 50 switched cells, phase-state maximum above 0.1, and increased loss; this is a phenomenological VO2-like model.",
      "The local intensity state crosses different heating and recovery thresholds, changing permittivity and loss with hysteresis rather than modeling microscopic VO2 dynamics.",
    ),
    pcmMemoryCell: sceneGuideEntry(
      "nonlinear",
      "Persistent switching of a phase-change memory cell in a guide",
      "with field plus epsilon overlay, watch the compact cell switch under illumination and retain its altered material shading after the field is cleared.",
      "Results should report at least 40 switched cells, peak phase state above 0.8, and finite guided overlap.",
      "The phenomenological phase variable integrates the optical stimulus and is intentionally persistent, representing memory rather than a microscopic crystallization model.",
    ),
    saturableAbsorber: sceneGuideEntry(
      "nonlinear",
      "Intensity-dependent bleaching of a saturable absorber",
      "with field plus epsilon overlay, observe the lossy section change state where the incident field exceeds its threshold.",
      "Results should show at least 100 responding cells, peak phase state above 0.5, and finite absorber energy.",
      "The state-dependent loss decreases as the local drive saturates the absorber proxy, allowing stronger fields to experience less attenuation.",
    ),
    allOpticalSwitch: sceneGuideEntry(
      "nonlinear",
      "Active-arm control in a nonlinear interferometric switch",
      "follow the mode through the Kerr/phase-change control section with the field plus epsilon overlay, then compare the two output arms.",
      "Results should confirm active-region overlap, switched cells, and finite output-arm energy; a calibrated extinction ratio is not yet claimed.",
      "The control section changes one path's phase and loss, altering interference at the output combiner.",
    ),
    nonlinearLimiter: sceneGuideEntry(
      "nonlinear",
      "Intensity-triggered loss in a nonlinear limiter section",
      "with field plus epsilon overlay, watch the limiter state activate in the high-field region and suppress downstream amplitude.",
      "Results should show at least 100 switched cells, peak state above 0.5, and finite limiter overlap; no calibrated limiting curve is claimed.",
      "Above threshold the phenomenological state increases local loss, providing negative feedback on transmitted field amplitude.",
    ),
    temporalInterface: sceneGuideEntry(
      "temporal",
      "Sideband generation at a uniformly time-modulated interface",
      "with field plus epsilon overlay, watch the dielectric half-space change coherently after the incident wave reaches it.",
      "after at least 48 DFT samples, Results should show coherent modulation phase and a finite reflected Floquet sideband.",
      "A time-varying permittivity exchanges energy with the field and changes optical frequency; passive R+T+A balance is incomplete without modulation work.",
    ),
    temporalSlab: sceneGuideEntry(
      "temporal",
      "Frequency conversion in a finite uniformly modulated slab",
      "with field plus epsilon overlay, verify that the wave overlaps the entire in-phase oscillating slab.",
      "after at least 48 DFT samples, Results should report coherent phase, finite slab energy, and a reflected sideband above the diagnostic floor.",
      "Uniform temporal modulation mixes the carrier with integer modulation harmonics while exchanging energy with the external modulation drive.",
    ),
    temporalModulation: sceneGuideEntry(
      "temporal",
      "Floquet sidebands from a compact uniform epsilon modulator",
      "with field plus epsilon overlay, watch the compact region oscillate in phase once illuminated.",
      "after DFT warm-up, the reflected sideband power should exceed 1e-5 with coherent modulation phase; the truncated balance is not a full scattering matrix.",
      "Periodic coefficient variation couples frequencies separated by the modulation frequency and adds or removes energy from the electromagnetic subsystem.",
    ),
    temporalCrystal: sceneGuideEntry(
      "temporal",
      "Sideband response of an extended time-periodic dielectric lattice",
      "with field plus epsilon overlay, inspect the coherently modulated background and embedded static ribs after the wave enters the structure.",
      "after at least 48 DFT samples, Results should confirm the extended modulated mask and a finite Floquet sideband.",
      "The spatial lattice shapes propagation while uniform temporal periodicity couples the carrier into Floquet frequency orders.",
    ),
    modulatedGuide: sceneGuideEntry(
      "temporal",
      "Guided-wave frequency conversion in a finite modulated section",
      "with field plus epsilon overlay, follow the mode into the active guide segment and onward to the passive output.",
      "Results should show guide, active-section, and output overlap plus a finite reflected sideband after DFT warm-up.",
      "Temporal index variation mixes frequencies while transverse index contrast keeps the converted field coupled to the waveguide.",
    ),
    travelingModulation: sceneGuideEntry(
      "temporal",
      "Space-time phase progression in a traveling-modulated guide",
      "with field plus epsilon overlay, watch the material wave advance along the guide instead of oscillating everywhere in phase.",
      "Results should show low phase coherence, phase spread above 20 rad, finite phase velocity, guide overlap, and a reflected sideband.",
      "A traveling modulation supplies both frequency and momentum, so forward and reverse waves can experience different coupling conditions.",
    ),
    temporalIsolator: sceneGuideEntry(
      "temporal",
      "Traveling modulation followed by asymmetric guide loss",
      "with field plus epsilon overlay, follow the mode through the traveling active section and downstream lossy region.",
      "Results should confirm phase progression, loss cells, output overlap, and finite sidebands; calibrated isolation requires forward/reverse reference runs.",
      "Space-time coupling shifts modal frequency and momentum, while the lossy section preferentially removes selected converted content in this teaching workflow.",
    ),
    modulatedRing: sceneGuideEntry(
      "temporal",
      "Sidebands from a uniformly modulated ring resonator",
      "with field plus epsilon overlay, watch guided energy enter the ring while its index oscillates coherently.",
      "after DFT warm-up, Results should show ring overlap, coherent phase, and finite reflected sideband power.",
      "Resonant storage increases interaction time with the temporal perturbation, coupling the carrier to modulation-shifted frequency orders.",
    ),
    floquetResonators: sceneGuideEntry(
      "temporal",
      "Staggered-phase Floquet coupling across three resonators",
      "with field plus epsilon overlay, compare the three resonators as their local modulation phases advance stepwise.",
      "Results should detect three resonator peaks, low global phase coherence, finite resonator-band energy, and a Floquet sideband.",
      "Different local modulation phases synthesize a directed phase around the coupled-resonator network and mix optical frequency orders.",
    ),
    syntheticFrequency: sceneGuideEntry(
      "temporal",
      "Five-step modulation phase across a resonator chain",
      "with field plus epsilon overlay, inspect sequentially phased material oscillation and field transfer along the five-site chain.",
      "Results should find at least four resonator peaks, broad phase spread, guide overlap, and finite sideband power.",
      "The modulation harmonics act as couplings between frequency orders, while the five spatial phases emulate a synthetic-frequency hopping phase.",
    ),
    ptSymmetricCoupler: sceneGuideEntry(
      "nonhermitian",
      "Unbroken-phase response of balanced gain/loss coupled guides",
      "with field plus epsilon overlay, compare intensity in the gain and loss guides after the modal field fills both channels.",
      "after at least 48 samples, the 2x2 diagnostic should show gamma/kappa below 0.95, finite real splitting, and the unbroken label.",
      "Balanced amplification and attenuation preserve a real reduced-model eigenvalue pair below the PT threshold; saturation prevents unlimited numerical growth.",
    ),
    exceptionalPointCoupler: sceneGuideEntry(
      "nonhermitian",
      "Near-coalescence of a gain/loss coupler at an exceptional point",
      "with field plus epsilon overlay, inspect the strongly asymmetric coupled-guide distribution after warm-up.",
      "the reduced 2x2 diagnostic should place gamma/kappa within 0.95-1.05, coalescence above 0.8, and real splitting below 0.001.",
      "At the reduced-model threshold, eigenvalues and eigenvectors coalesce; this diagnostic does not replace a converged full-wave eigenmode calculation.",
    ),
    nonHermitianSkin: sceneGuideEntry(
      "nonhermitian",
      "Edge accumulation in a biased non-Hermitian SSH chain",
      "with field plus epsilon overlay, watch the launched lattice field accumulate toward one edge and favor gain over loss sites.",
      "after at least 48 samples, Results should show strong signed edge and gain/loss bias with finite coupled-region overlap.",
      "Non-reciprocal effective hopping plus gain/loss biases bulk-like states toward a boundary; the metric is a finite-scene localization diagnostic, not a non-Bloch invariant.",
    ),
    bicKerr: sceneGuideEntry(
      "nonlinear",
      "Kerr-active defect overlap in an antisymmetrically driven PhC cavity",
      "with field plus epsilon overlay, the opposite-phase dipoles should localize field in the nonlinear defect.",
      "after 48 samples, Results should show active-material overlap above 0.05, cavity overlap above 0.1, and finite leakage/Q proxies.",
      "Antisymmetric excitation suppresses a leading radiation channel while the Kerr defect changes local phase; both effects remain reduced teaching diagnostics.",
    ),
    bicEnz: sceneGuideEntry(
      "dispersive",
      "ENZ-active defect overlap in an antisymmetrically driven PhC cavity",
      "with field plus epsilon overlay, the opposite-phase dipoles should concentrate field around the dispersive ENZ defect.",
      "after 48 samples, Results should show finite ENZ overlap, cavity energy above 0.1, and bounded leakage/Q proxies.",
      "The PhC defect localizes the field while the near-zero-permittivity inclusion modifies its phase and confinement; no full eigenmode BIC claim is made.",
    ),
    janusTopologicalGuide: sceneGuideEntry(
      "periodic",
      "Directional Janus-source loading of a Valley-Hall-like guide",
      "with field plus epsilon overlay, watch the near-field source preferentially feed one direction of the structured interface.",
      "after 48 samples, Results should confirm material and guide overlap above 0.1 plus finite Janus-source overlap.",
      "The Janus source's asymmetric evanescent spectrum couples to the interface-channel analogue, combining source directionality with structured guiding.",
    ),
    huygensCavity: sceneGuideEntry(
      "resonator",
      "Directional Huygens-source coupling to a side cavity",
      "after launch, follow the forward-biased field along the guide and into the nearby dielectric cavity.",
      "after 48 samples, Results should show guide overlap above 0.1, cavity overlap above 0.05, and finite source overlap.",
      "Electric- and magnetic-like source components suppress one radiation direction while the resonator provides a frequency-selective storage pathway.",
    ),
    topologyTemporalMod: sceneGuideEntry(
      "temporal",
      "Uniform temporal conversion inside a Valley-Hall-like channel",
      "with field plus epsilon overlay, watch the interface field traverse the coherently oscillating input segment.",
      "after DFT warm-up, Results should show coherent modulation, active-material overlap above 0.2, and finite Floquet sideband power.",
      "The structured domain wall guides the field while the uniform temporal segment exchanges energy and generates frequency-shifted components.",
    ),
    nonreciprocalValleyHall: sceneGuideEntry(
      "temporal",
      "Traveling-modulation segment in a Valley-Hall-like guide",
      "with field plus epsilon overlay, watch the material phase travel along the structured channel as the guided field overlaps it.",
      "Results should show phase spread above 12 rad, finite phase velocity, active overlap above 0.25, and sidebands; calibrated nonreciprocity is not claimed.",
      "The modulation supplies directed momentum to the interface-channel analogue, but forward/reverse transmission references are required to establish isolation.",
    ),
    spaceTimeCrystal: sceneGuideEntry(
      "temporal",
      "Traveling modulation across a dielectric stripe lattice",
      "with field plus epsilon overlay, observe the material-wave phase advance across many stripes after illumination.",
      "after DFT warm-up, Results should show low phase coherence, phase spread above 16 rad, active overlap above 0.1, and finite sideband power.",
      "Combining spatial periodicity with traveling temporal modulation couples wavevector and frequency; energy balance must include work performed by the modulation.",
    ),
  });

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

  function mergeSceneGuideReferences(base, additions) {
    return Object.fromEntries(
      ["books", "classics", "reviews", "recent"].map((category) => [category, [...new Set([...(base?.[category] || []), ...(additions?.[category] || [])])]]),
    );
  }

  function buildSceneGuide(record, context = {}) {
    const content = sceneGuideContent[record?.value] || null;
    const template = sceneGuideTemplate(record || {}, context);
    if (!content) return template;
    const { family: _family, references, ...overrides } = content;
    return {
      ...template,
      ...overrides,
      references: mergeSceneGuideReferences(template.references, references),
    };
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
        li.appendChild(documentRef.createTextNode(text));
        const doiUrl = sceneGuideReferenceDoiUrl(text);
        if (doiUrl) {
          li.appendChild(documentRef.createTextNode(" "));
          const link = documentRef.createElement("a");
          link.href = doiUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "DOI";
          link.setAttribute("aria-label", `Open DOI for ${text}`);
          li.appendChild(link);
        }
        list.appendChild(li);
      });
      item.append(title, list);
      parent.appendChild(item);
    }

    function appendSceneGuideReferences(parent, references) {
      const details = documentRef.createElement("section");
      details.className = "scene-guide-details";
      details.dataset.carbonDisclosure = "";
      details.dataset.title = "References";
      const body = documentRef.createElement("div");
      body.className = "scene-guide-reference-grid";
      [
        ["Books", references.books],
        ["Classic papers", references.classics],
        ["Reviews", references.reviews],
        ["Recent papers", references.recent],
      ].forEach(([label, items]) => appendSceneGuideList(body, label, items));
      details.append(body);
      parent.appendChild(details);
    }

    function render(panel, record, guide) {
      if (!panel) return;
      panel.replaceChildren();

      const grid = documentRef.createElement("div");
      grid.className = "scene-guide-grid";
      appendSceneGuideField(grid, "Phenomenon", guide.phenomenon);
      appendSceneGuideField(grid, "FDTD simulation", guide.fdtd);
      appendSceneGuideField(grid, "Expected results", guide.expected);

      const modelDetails = documentRef.createElement("section");
      modelDetails.className = "scene-guide-details";
      modelDetails.dataset.carbonDisclosure = "";
      modelDetails.dataset.title = "Model details";
      const modelBody = documentRef.createElement("div");
      modelBody.className = "scene-guide-grid";
      appendSceneGuideField(modelBody, "Description", guide.description);
      appendSceneGuideField(modelBody, "Geometry", guide.geometry);
      appendSceneGuideField(modelBody, "Source", guide.source);
      appendSceneGuideField(modelBody, "Materials", guide.materials);
      appendSceneGuideField(modelBody, "Explanation", guide.explanation);
      modelDetails.append(modelBody);

      const details = documentRef.createElement("section");
      details.className = "scene-guide-details";
      details.dataset.carbonDisclosure = "";
      details.dataset.title = "More context";
      const detailsBody = documentRef.createElement("div");
      detailsBody.className = "scene-guide-grid";
      appendSceneGuideList(detailsBody, "Common mistakes", guide.errors);
      appendSceneGuideField(detailsBody, "What it enables", guide.enabled);
      appendSceneGuideField(detailsBody, "Related experiments", guide.experiments);
      details.append(detailsBody);

      panel.append(grid, modelDetails, details);
      appendSceneGuideReferences(panel, guide.references);
      global.FdtdCarbonUI?.upgradeDisclosures?.(panel);
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
    sceneGuideContentIds: Object.freeze(Object.keys(sceneGuideContent)),
    sceneGuideReferenceDoiUrl,
    sceneGuideFamily,
  });
})(window);
