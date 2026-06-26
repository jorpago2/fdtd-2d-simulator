# Atlas FDTD 2D: scenes not currently implemented

This file tracks catalog experiments from `Atlas_FDTD_2D_Catalogo_Experimentos_Simulables.md`
that are not present in the Scene dropdown yet.

Implemented dropdown scenes are geometry/source/material presets for the current 2D
FDTD engine. Some are qualitative visual presets rather than automated validation experiments,
because the app still needs calibrated modal, sweep, and equivalence-principle post-processing.

## Implemented in the first source-physics pass

- 24 In-plane electric dipole: implemented as a localized `Jx/Jy` current source in the `Hz` solver.
- 32 Progressive-phase dipole array: implemented with per-source temporal phase `phaseDeg`.

## Implemented in the first monitor/observable pass

- 10 Poynting vector: implemented as a `S` view with `Sx`, `Sy`, `|S|`, vector quiver, and two line-flux monitors.
- Normal-incidence CW line monitors now estimate `Pinc`, `Pref`, `Ptrn`, `R`, and `T` by decomposing the fields into forward/backward waves using local impedance.
- Oblique CW line monitors project flux and field decomposition onto the incident source direction `theta_k`.
- A generic sweep runner can now scan incident angle or source frequency, run the current scene at each point, and plot `R` and `T`.
- A first spectral/near-to-far analysis panel now records a time probe, plots a probe spectrum, and estimates an angular far-field pattern from a closed scalar phasor contour.
- Calibrated equivalence-principle NTFF remains future work; the current far-field chart is qualitative.

## Implemented in the first nonlinear-material pass

- 111 Kerr nonlinear slab: implemented as an instantaneous saturated Kerr update on tagged material cells, `epsilon = epsilon_base + chi3 |F|^2`.
- 112 SHG and 113 THG slabs: implemented qualitatively as nonlinear polarization-current sources, `J_NL = d(chi2 E^2 + chi3 E^3)/dt`, on tagged material cells.
- 116 VO2 switching slab and 117 PCM memory cell: implemented qualitatively with a persistent phase-state variable `s` per tagged cell, threshold hysteresis, and finite on/off switching times.
- 131 PT guides: implemented qualitatively as balanced gain/loss coupled guides with intensity-saturated gain to avoid immediate numerical blow-up.

## Implemented in the first dispersive-material pass

- 70 Finite-conductivity skin depth: implemented as a conductive material update using `J = sigma E`.
- 71 Drude metal and 74 plasma: implemented with an explicit electric-polarization ADE current on tagged material cells.
- 72 Lorentz resonant medium: implemented with a second-order Lorentz ADE polarization oscillator.
- 73 Debye dielectric: implemented with first-order relaxation polarization.
- Draw materials can also be assigned manual Drude, plasma, Lorentz, or Debye ADE parameters from the contextual Draw menu.

## Implemented in the first tensor-material pass

- 78 Chiral medium and 79 bianisotropic medium: implemented qualitatively as a 2D effective magnetoelectric coupling `kappa` that converts scalar-field time variation into a transverse response on tagged cells.
- 80 Ferrite/gyrotropic medium: implemented qualitatively in the `Hz` solver with an antisymmetric in-plane epsilon tensor, `eps_xy = +g` and `eps_yx = -g`, on tagged material cells.

## Implemented in the first plasmonics pass

- 101 SPP interface: implemented as a Drude metal-dielectric interface with near-field dipole excitation.
- 102 SPP grating: implemented as a shallow Drude grating with qualitative grating-assisted coupling.
- 103 localized plasmon and 104 plasmonic dimer: implemented as Drude nanodisk presets, including a narrow dimer gap.

## Not implemented because they need a new source model

- 11 Evanescent isolated wave: requires a source with imposed spatial spectrum `kx > k0`.

## Not implemented because they need monitors, sweeps, or post-processing

- 9 TEz/TMz comparison: the solver can switch `Ez`/`Hz`, but this is a workflow, not a preset.
- 15 Brewster TM and 16 TE/TM Brewster comparison: the generic angular sweep exists, but these still need a dedicated preset/overlay that marks the Brewster minimum and compares polarizations.
- 34 Near-field/far-field: a qualitative contour estimate exists, but a calibrated equivalence-principle near-to-far transform is still needed.
- 48 Fabry-Perot standing field: covered qualitatively by the Fabry-Perot preset, but no resonance finder exists.
- 55 Q by ringdown, 56 Purcell 2D, 57 beta-factor, 58 degenerate modes: require time monitors and energy/power extraction.
- 62 RCS 2D and 65 Kerker 2D: require calibrated angular far-field and scattering normalization.
- 89 Symmetry-protected BIC: requires parameter/k sweeps and Q extraction.

## Not implemented because the physics is not in the material model

- Full-vector reciprocal chiral/bianisotropic media still require a six-component 2D update coupling both `Ez` and `Hz` polarizations simultaneously; the current 78/79 presets are qualitative scalar-mode approximations.
- 114-115 and 118-120 advanced nonlinear workflows still require dedicated physics or validation metrics beyond the current Kerr, harmonic, and phase-change presets.
- 132 exceptional point: requires modal/eigenvalue analysis or a dedicated parameter sweep to locate the coalescence point quantitatively.

## Not implemented because the geometry/workflow is still too specific

- 38 Waveguide bend, 43 Mach-Zehnder, 45 microstrip, 51 racetrack, 54 quarter-wave cavity.
- 85 Optimized PhC cavity, 87 symmetry-dark mode, 88 quasi-BIC.
- 94 SSH with disorder, 95 non-Hermitian SSH, 96 honeycomb lattice, 97 Valley Hall, 98 Valley Hall bend, 99 topological pumping, 100 topology with strong defect.
- 106 perfect absorber and 109 hyperlens.
- 121 temporal interface, 122 temporal slab, 124 temporal crystal, 125 temporally modulated guide, 127 ideal temporal isolator, 128 modulated ring, 129 Floquet resonators, 130 synthetic frequency dimension.
- 133 non-Hermitian skin effect, 134 BIC + Kerr, 135 BIC + ENZ, 136 Janus + topological guide, 137 Huygens + cavity, 138 topology + temporal modulation, 139 nonreciprocity + Valley Hall, 140 space-time crystal.

## Implemented with idealized constant-material approximations

- 75 ENZ slab uses constant complex epsilon, not a dispersive ENZ model.
- 77 Hyperbolic medium uses diagonal constant anisotropy.
- 107 Negative-index slab and 108 superlens use constant negative epsilon and mu. These are useful visual presets, but can be numerically delicate.
- 123 Temporal epsilon modulation and 126 traveling modulation use the current sinusoidal epsilon modulation on tagged material cells.
