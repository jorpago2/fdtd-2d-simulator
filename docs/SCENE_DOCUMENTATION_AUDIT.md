# Scene Documentation Audit

This report checks the 140 numbered scene guides rendered by the application. It measures structural completeness, scene-specific teaching text, and DOI-link coverage; it does not treat a family-level paragraph as an individual physical audit.

## Summary

- Complete guide structure: 140/140.
- Scene-specific phenomenon: 6/140.
- Scene-specific expected result: 6/140.
- Scene-specific physical explanation: 6/140.
- Current status: 6 PASS, 134 WARN.
- Scenes represented in the validation matrix: 140/140.
- Unique references: 79; DOI-linked: 51.

`WARN` means the guide is complete and usable, but its expected result or explanation is still shared at family level. It does not mean the scene or solver failed physical validation.

## Per-example audit

| # | Scene | Family | Specific text | Validation cases | DOI links | Status |
| ---: | --- | --- | ---: | ---: | ---: | --- |
| 1 | `planeWaveAir` - Plane wave in air | propagation | 0/3 | 2 | 4/6 | WARN |
| 2 | `planeWaveDielectric` - Plane wave in dielectric | propagation | 0/3 | 1 | 4/6 | WARN |
| 3 | `gaussianPulseAir` - Gaussian pulse in free space | propagation | 0/3 | 1 | 4/6 | WARN |
| 4 | `twoSourceInterference` - Two-source interference | propagation | 0/3 | 1 | 4/6 | WARN |
| 5 | `frequencyBeat` - Two-frequency beat | propagation | 0/3 | 1 | 4/6 | WARN |
| 6 | `singleSlit` - Single slit diffraction | propagation | 0/3 | 1 | 4/6 | WARN |
| 7 | `doubleSlit` - Double slit | propagation | 0/3 | 1 | 4/6 | WARN |
| 8 | `circularAperture` - Circular aperture | radiation | 0/3 | 2 | 3/6 | WARN |
| 9 | `teTmComparison` - TEz/TMz comparison | interface | 0/3 | 1 | 2/6 | WARN |
| 10 | `poyntingPlaneWave` - Poynting vector | propagation | 0/3 | 1 | 4/6 | WARN |
| 11 | `evanescentWave` - Evanescent isolated wave | propagation | 0/3 | 2 | 4/6 | WARN |
| 12 | `pmlAbsorption` - CPML absorption check | propagation | 0/3 | 1 | 4/6 | WARN |
| 13 | `normalInterface` - Normal air-dielectric interface | interface | 0/3 | 2 | 2/6 | WARN |
| 14 | `obliqueRefraction` - Oblique refraction | interface | 0/3 | 1 | 2/6 | WARN |
| 15 | `brewsterTm` - Brewster p/TM minimum | interface | 0/3 | 1 | 2/6 | WARN |
| 16 | `brewsterTeTm` - s/TE-p/TM Brewster comparison | interface | 0/3 | 2 | 2/6 | WARN |
| 17 | `totalInternalReflection` - Total internal reflection | propagation | 0/3 | 1 | 4/6 | WARN |
| 18 | `frustratedTir` - Frustrated TIR | interface | 0/3 | 1 | 2/6 | WARN |
| 19 | `quarterWaveCoating` - Quarter-wave coating | interface | 0/3 | 1 | 2/6 | WARN |
| 20 | `braggMirror` - 1D Bragg mirror | interface | 0/3 | 1 | 2/6 | WARN |
| 21 | `lossyInterface` - Lossy interface | interface | 0/3 | 1 | 2/6 | WARN |
| 22 | `anisotropicInterface` - Anisotropic interface | interface | 0/3 | 1 | 2/6 | WARN |
| 23 | `jzDipole` - Point electric dipole Jz | radiation | 0/3 | 1 | 3/6 | WARN |
| 24 | `inPlaneDipole` - In-plane electric dipole Jx/Jy | radiation | 0/3 | 1 | 3/6 | WARN |
| 25 | `mzDipole` - Effective magnetic dipole Mz | radiation | 0/3 | 1 | 3/6 | WARN |
| 26 | `dipoleSubstrate` - Dipole over substrate | radiation | 0/3 | 1 | 3/6 | WARN |
| 27 | `dipoleNearPec` - Dipole near PEC mirror | radiation | 0/3 | 1 | 3/6 | WARN |
| 28 | `huygensRadiator` - Huygens source | radiation | 0/3 | 1 | 3/6 | WARN |
| 29 | `circularDipole` - Circular dipole | radiation | 0/3 | 1 | 3/6 | WARN |
| 30 | `janusDipole` - Janus dipole | radiation | 0/3 | 1 | 3/6 | WARN |
| 31 | `dipoleArray` - Equal-phase dipole array | radiation | 0/3 | 1 | 3/6 | WARN |
| 32 | `phasedDipoleArray` - Progressive-phase dipole array | temporal | 0/3 | 1 | 5/7 | WARN |
| 33 | `apertureRadiator` - Slot aperture radiator | radiation | 0/3 | 1 | 3/6 | WARN |
| 34 | `nearFarFieldNtff` - Near-field / far-field NTFF | radiation | 0/3 | 1 | 3/6 | WARN |
| 35 | `slabWaveguide` - Single-mode slab waveguide | guided | 0/3 | 1 | 4/6 | WARN |
| 36 | `multimodeSlab` - Multimode slab waveguide | guided | 0/3 | 1 | 4/6 | WARN |
| 37 | `lossyGuide` - Lossy waveguide | guided | 0/3 | 1 | 4/6 | WARN |
| 38 | `waveguideBend` - Waveguide bend | resonator | 0/3 | 1 | 4/6 | WARN |
| 39 | `taperWaveguide` - Tapered waveguide | guided | 0/3 | 1 | 4/6 | WARN |
| 40 | `widthStepWaveguide` - Width step waveguide | guided | 0/3 | 1 | 4/6 | WARN |
| 41 | `directionalCoupler` - Directional coupler | guided | 0/3 | 1 | 4/6 | WARN |
| 42 | `mmiWaveguide` - MMI section | guided | 0/3 | 1 | 4/6 | WARN |
| 43 | `machZehnder` - Mach-Zehnder interferometer | guided | 0/3 | 1 | 4/6 | WARN |
| 44 | `guideScatterer` - Waveguide with scatterer | guided | 0/3 | 1 | 4/6 | WARN |
| 45 | `microstrip` - Microstrip cross-section | guided | 0/3 | 1 | 4/6 | WARN |
| 46 | `stubResonator` - Stub resonator | resonator | 3/3 | 1 | 4/6 | PASS |
| 47 | `fabryPerot` - Fabry-Perot cavity | resonator | 0/3 | 1 | 4/6 | WARN |
| 48 | `fabryPerotStanding` - Fabry-Perot standing field | resonator | 0/3 | 1 | 4/6 | WARN |
| 49 | `ringResonator` - Ring resonator | resonator | 3/3 | 1 | 4/6 | PASS |
| 50 | `addDropRing` - Add-drop ring | resonator | 3/3 | 1 | 4/6 | PASS |
| 51 | `racetrackResonator` - Racetrack resonator | resonator | 3/3 | 1 | 4/6 | PASS |
| 52 | `dielectricCavity` - Dielectric defect cavity | resonator | 0/3 | 1 | 4/6 | WARN |
| 53 | `pecCavity` - PEC half-wave cavity | resonator | 0/3 | 1 | 4/6 | WARN |
| 54 | `quarterWaveCavity` - Quarter-wave cavity | resonator | 3/3 | 1 | 4/6 | PASS |
| 55 | `qRingdown` - Q by ringdown | resonator | 0/3 | 1 | 4/6 | WARN |
| 56 | `purcell2d` - 2D cavity Q/Aeff metric | resonator | 0/3 | 1 | 4/6 | WARN |
| 57 | `betaFactor` - Dipole-to-guide flux ratio | radiation | 0/3 | 1 | 3/6 | WARN |
| 58 | `degenerateModes` - Dual-dipole disk spectrum | resonator | 0/3 | 1 | 4/6 | WARN |
| 59 | `pecCylinder` - PEC cylinder scattering | scattering | 3/3 | 1 | 4/6 | PASS |
| 60 | `dielectricCylinder` - Dielectric cylinder scattering | scattering | 0/3 | 1 | 4/6 | WARN |
| 61 | `mieCylinder` - High-index Mie cylinder | scattering | 0/3 | 1 | 4/6 | WARN |
| 62 | `rcsCylinder` - 2D NTFF scattering width | scattering | 0/3 | 1 | 4/6 | WARN |
| 63 | `lossyCylinder` - Absorbing dielectric cylinder | propagation | 0/3 | 1 | 4/6 | WARN |
| 64 | `dielectricDimer` - Dielectric dimer | scattering | 0/3 | 1 | 4/6 | WARN |
| 65 | `kerker2d` - Forward/backward contrast | scattering | 0/3 | 1 | 4/6 | WARN |
| 66 | `multipleScattering` - Multiple scattering | scattering | 0/3 | 1 | 4/6 | WARN |
| 67 | `weakLocalization` - Weak-localization disorder | scattering | 0/3 | 1 | 4/6 | WARN |
| 68 | `andersonLocalization` - Dense-disorder trapping | scattering | 0/3 | 1 | 4/6 | WARN |
| 69 | `diffusiveRandomMedium` - Diffusive random medium | scattering | 0/3 | 1 | 4/6 | WARN |
| 70 | `finiteConductivity` - Finite-conductivity damping | dispersive | 0/3 | 1 | 6/8 | WARN |
| 71 | `drudeMetal` - Drude metal | dispersive | 0/3 | 2 | 6/8 | WARN |
| 72 | `lorentzMedium` - Lorentz resonant medium | dispersive | 0/3 | 1 | 6/8 | WARN |
| 73 | `debyeDielectric` - Debye dielectric | dispersive | 0/3 | 1 | 6/8 | WARN |
| 74 | `plasmaCutoff` - Plasma cutoff | dispersive | 0/3 | 1 | 6/8 | WARN |
| 75 | `enzSlab` - ENZ slab | dispersive | 0/3 | 1 | 6/8 | WARN |
| 76 | `anisotropicMedium` - Anisotropic medium | tensor | 0/3 | 1 | 2/6 | WARN |
| 77 | `hyperbolicMedium` - Indefinite Drude tensor | dispersive | 0/3 | 1 | 6/8 | WARN |
| 78 | `chiralMedium` - 6-field bianisotropic coupling | tensor | 0/3 | 2 | 2/6 | WARN |
| 79 | `bianisotropicMedium` - 6-field bianisotropic medium | tensor | 0/3 | 1 | 2/6 | WARN |
| 80 | `gyrotropicMedium` - Gyrotropic tensor block | tensor | 0/3 | 1 | 2/6 | WARN |
| 81 | `braggStack` - 1D Bragg stack | periodic | 0/3 | 1 | 7/9 | WARN |
| 82 | `photonicCrystal` - 2D photonic crystal | periodic | 0/3 | 1 | 7/9 | WARN |
| 83 | `phcPointDefect` - PhC point defect | periodic | 0/3 | 1 | 7/9 | WARN |
| 84 | `phcWaveguide` - PhC line-defect waveguide | periodic | 0/3 | 1 | 7/9 | WARN |
| 85 | `phcOptimizedCavity` - Shifted L3 PhC cavity | periodic | 0/3 | 1 | 7/9 | WARN |
| 86 | `phcDisorder` - Disordered photonic crystal | periodic | 0/3 | 1 | 7/9 | WARN |
| 87 | `phcDarkMode` - Antisymmetric PhC defect | periodic | 0/3 | 1 | 7/9 | WARN |
| 88 | `quasiBic` - Asymmetric PhC defect | periodic | 0/3 | 1 | 7/9 | WARN |
| 89 | `symmetryProtectedBic` - Symmetric L3 PhC cavity | periodic | 0/3 | 1 | 7/9 | WARN |
| 90 | `fanoResonator` - Fano side resonator | resonator | 0/3 | 1 | 4/6 | WARN |
| 91 | `sshTrivial` - SSH chain, trivial | periodic | 0/3 | 1 | 7/9 | WARN |
| 92 | `sshTopological` - SSH chain, topological | periodic | 0/3 | 1 | 7/9 | WARN |
| 93 | `sshInterface` - SSH interface | periodic | 0/3 | 1 | 7/9 | WARN |
| 94 | `sshDisorder` - SSH with disorder | periodic | 0/3 | 1 | 7/9 | WARN |
| 95 | `nonHermitianSsh` - Non-Hermitian SSH | nonhermitian | 0/3 | 1 | 5/7 | WARN |
| 96 | `honeycombLattice` - Honeycomb lattice | periodic | 0/3 | 1 | 7/9 | WARN |
| 97 | `valleyHall` - Valley Hall interface | periodic | 0/3 | 1 | 7/9 | WARN |
| 98 | `valleyHallBend` - Valley Hall bend | periodic | 0/3 | 1 | 7/9 | WARN |
| 99 | `topologicalPumping` - Modulated SSH chain | temporal | 0/3 | 1 | 5/7 | WARN |
| 100 | `topologyDefect` - Topology with strong defect | periodic | 0/3 | 1 | 7/9 | WARN |
| 101 | `sppInterface` - SPP metal-dielectric interface | dispersive | 0/3 | 1 | 6/8 | WARN |
| 102 | `sppGrating` - SPP grating launcher | dispersive | 0/3 | 1 | 6/8 | WARN |
| 103 | `localizedPlasmon` - Localized plasmon disk | dispersive | 0/3 | 1 | 6/8 | WARN |
| 104 | `plasmonicDimer` - Plasmonic dimer | dispersive | 0/3 | 1 | 6/8 | WARN |
| 105 | `metasurfacePhaseBars` - Phase-gradient metasurface | dispersive | 0/3 | 1 | 6/8 | WARN |
| 106 | `perfectAbsorber` - Near-perfect backed absorber | dispersive | 0/3 | 1 | 6/8 | WARN |
| 107 | `negativeIndexSlab` - Double-negative Drude slab | dispersive | 0/3 | 2 | 6/8 | WARN |
| 108 | `superlensSlab` - DNG slab image transfer | dispersive | 0/3 | 1 | 6/8 | WARN |
| 109 | `hyperlens` - 2D hyperbolic annular transfer | dispersive | 0/3 | 2 | 6/8 | WARN |
| 110 | `enzEmitter` - Dipole near ENZ slab | dispersive | 0/3 | 1 | 6/8 | WARN |
| 111 | `kerrSlab` - Kerr nonlinear slab | nonlinear | 0/3 | 1 | 5/7 | WARN |
| 112 | `shgSlab` - SHG χ² slab | nonlinear | 0/3 | 1 | 5/7 | WARN |
| 113 | `thgSlab` - Chi3 harmonic slab | nonlinear | 0/3 | 1 | 5/7 | WARN |
| 114 | `spmKerrPulse` - Kerr SPM pulse | nonlinear | 0/3 | 2 | 5/7 | WARN |
| 115 | `kerrBistableCavity` - Kerr ring-cavity overlap | nonlinear | 0/3 | 1 | 5/7 | WARN |
| 116 | `vo2SwitchingSlab` - VO₂ switching slab | nonlinear | 0/3 | 1 | 5/7 | WARN |
| 117 | `pcmMemoryCell` - PCM memory cell | nonlinear | 0/3 | 1 | 5/7 | WARN |
| 118 | `saturableAbsorber` - Saturable absorber | nonlinear | 0/3 | 1 | 5/7 | WARN |
| 119 | `allOpticalSwitch` - All-optical active section | nonlinear | 0/3 | 1 | 5/7 | WARN |
| 120 | `nonlinearLimiter` - Nonlinear limiter | nonlinear | 0/3 | 1 | 5/7 | WARN |
| 121 | `temporalInterface` - Temporal interface | temporal | 0/3 | 1 | 5/7 | WARN |
| 122 | `temporalSlab` - Temporal slab | temporal | 0/3 | 1 | 5/7 | WARN |
| 123 | `temporalModulation` - Temporal epsilon modulation | temporal | 0/3 | 2 | 5/7 | WARN |
| 124 | `temporalCrystal` - Temporal crystal | temporal | 0/3 | 1 | 5/7 | WARN |
| 125 | `modulatedGuide` - Temporally modulated guide | temporal | 0/3 | 1 | 5/7 | WARN |
| 126 | `travelingModulation` - Traveling epsilon modulation | temporal | 0/3 | 1 | 5/7 | WARN |
| 127 | `temporalIsolator` - Traveling-modulated lossy guide | temporal | 0/3 | 1 | 5/7 | WARN |
| 128 | `modulatedRing` - Modulated ring | temporal | 0/3 | 1 | 5/7 | WARN |
| 129 | `floquetResonators` - Floquet resonators | temporal | 0/3 | 1 | 5/7 | WARN |
| 130 | `syntheticFrequency` - Five-phase modulated resonator chain | temporal | 0/3 | 1 | 5/7 | WARN |
| 131 | `ptSymmetricCoupler` - PT-symmetric gain/loss guides | nonhermitian | 0/3 | 1 | 5/7 | WARN |
| 132 | `exceptionalPointCoupler` - Near-EP gain/loss coupler | nonhermitian | 0/3 | 1 | 5/7 | WARN |
| 133 | `nonHermitianSkin` - Biased non-Hermitian SSH chain | nonhermitian | 0/3 | 2 | 5/7 | WARN |
| 134 | `bicKerr` - Kerr PhC defect cavity | nonlinear | 0/3 | 1 | 5/7 | WARN |
| 135 | `bicEnz` - ENZ PhC defect cavity | dispersive | 0/3 | 1 | 6/8 | WARN |
| 136 | `janusTopologicalGuide` - Janus source in Valley-Hall lattice | periodic | 0/3 | 1 | 7/9 | WARN |
| 137 | `huygensCavity` - Huygens source near cavity | resonator | 0/3 | 1 | 4/6 | WARN |
| 138 | `topologyTemporalMod` - Valley-Hall temporal segment | temporal | 0/3 | 1 | 5/7 | WARN |
| 139 | `nonreciprocalValleyHall` - Traveling-modulated Valley-Hall guide | temporal | 0/3 | 1 | 5/7 | WARN |
| 140 | `spaceTimeCrystal` - Traveling-modulated stripe lattice | temporal | 0/3 | 1 | 5/7 | WARN |

## Required remediation

1. Convert each scene's existing validation checks and rationale into an observable-specific expected result: what should appear, approximately when, and in which view or Results metric.
2. Replace family-level explanations with the mechanism actually represented by the preset geometry, source, material model, and solver polarization.
3. Keep claims bounded to the implemented diagnostic; do not describe a proxy as a calibrated spectrum, Q, invariant, efficiency, or device transfer curve.
4. Add a scene-specific paper when the family references do not directly support the modeled phenomenon. Journal references should use verified `https://doi.org/...` links; books and historical sources without a DOI remain plain text.
