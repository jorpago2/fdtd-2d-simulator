# Atlas FDTD 2D: scenes not currently implemented

This file tracks catalog experiments from `Atlas_FDTD_2D_Catalogo_Experimentos_Simulables.md`
that are not present in the Scene dropdown yet.

Implemented dropdown scenes are geometry/source/material presets for the current 2D
FDTD engine. Some are qualitative visual presets rather than automated validation experiments,
because the app still needs calibrated modal, sweep, and equivalence-principle post-processing.

Validation is now tracked separately in `scripts/validation-matrix.json` and documented in
`docs/VALIDATION.md`. Treat this file as the physics/workflow debt ledger, and the validation
matrix as the executable acceptance plan.

## Implemented in the first source-physics pass

- 11 Evanescent isolated wave: implemented as a monochromatic line source with imposed spatial phase `k_parallel > k0` and exponential normal decay.
- 24 In-plane electric dipole: implemented as a localized `Jx/Jy` current source in the `Hz` solver.
- 32 Progressive-phase dipole array: implemented with per-source temporal phase `phaseDeg`.

## Implemented in the first monitor/observable pass

- 9 TEz/TMz comparison: implemented as an air-dielectric interface preset that reuses the `Ez`/`Hz` solvers and the dual-polarization angular sweep to compare TE and TM reflectance.
- 10 Poynting vector: implemented as a `S` view with `Sx`, `Sy`, `|S|`, vector quiver, and two line-flux monitors.
- 15 Brewster TM and 16 TE/TM Brewster comparison: implemented as air-to-dielectric interface presets with preconfigured angular sweeps, analytic Fresnel/Brewster references, and a dual numerical TE/TM sweep for Atlas 16.
- Normal-incidence CW line monitors now estimate `Pinc`, `Pref`, `Ptrn`, `R`, and `T` by decomposing the fields into forward/backward waves using local impedance.
- Oblique CW line monitors project flux and field decomposition onto the incident source direction `theta_k`.
- A generic sweep runner can now scan incident angle, source frequency, source amplitude, PT gain/loss magnitude `gamma`, local BIC symmetry-breaking strength, finite-geometry Bloch wavevector `k/pi a`, or forward/reverse source direction. Depending on the scene, it plots `R`, `T`, TE/TM reflectance, nonlinear transfer proxies, BIC leakage, reduced plane-wave Bloch band/leakage proxies, reduced Floquet sideband `S_m` estimates, approximate isolation, or EP-style spectral splitting. Amplitude sweeps can optionally run a forward/reverse hysteresis cycle, estimate per-point steady drift from the last monitor windows, and export the measured rows as CSV.
- The spectral/near-to-far analysis panel records a time probe, plots a probe spectrum, and computes a normalized 2D equivalence-principle NTFF angular pattern from scalar-field and normal-derivative phasors on a closed contour.
- 34 Near-field/far-field: implemented as a dipole-radiation preset that exercises the normalized equivalence-principle NTFF analysis panel.
- 62 RCS 2D and 65 Kerker 2D: implemented as line-source scattering presets that subtract an analytic incident plane-wave reference from the NTFF contour phasors and report estimated 2D scattering width metrics, including `sigma/lambda0` and forward/backward contrast.
- 68 Anderson-localization disorder and 69 diffusive random medium are implemented as deterministic random-scattering presets. They complete the Atlas numbering gap between weak localization and finite-conductivity materials. The scenes are intended for qualitative/comparative 2D FDTD transport demonstrations; publication-grade localization analysis would still require ensemble averaging, mean-free-path extraction, and finite-size scaling.
- 107 Negative-index slab and 108 superlens now expose first-pass quantitative FDTD observables: incident/slab/transmitted beam-centroid angles, a negative-refraction sign score, a beam-case power-balance residual, and image-transfer/width metrics for the superlens. These metrics are shown in the analysis panel, can drive frequency/amplitude sweeps, and are exported to CSV.
- The scattering-width normalization is suitable for comparative 2D scalar studies. It is still an estimate because it has not yet been calibrated against analytic cylindrical Mie-series cross sections.
- The analysis panel now also stores a field-energy ringdown trace, contour Poynting flux estimates, and source-cell intensity for comparative resonator metrics.
- The material warning panel now includes an `Hz`-mode tensor-epsilon conditioning check at the carrier frequency, reporting indefinite, near-singular, or ill-conditioned anisotropic/dispersive cells for hyperbolic and tensor-material scenes.
- 48 Fabry-Perot standing field: implemented as a near-resonant driven Bragg-cavity preset.
- 55 Q by ringdown: implemented as a pulsed dielectric-cavity preset with an exponential energy-decay Q estimator.
- 56 Purcell 2D: implemented as a dipole-in-cavity preset reporting the comparative `Q/Aeff` proxy, not an absolute calibrated Purcell factor.
- 57 beta-factor: implemented as a dipole-to-slab-guide preset reporting guided contour flux divided by total outward contour flux.
- 58 Degenerate modes: implemented as a symmetric disk-cavity preset with off-center pulse excitation and a spectral peak-splitting indicator.
- 38 Waveguide bend, 43 Mach-Zehnder, 45 Microstrip, 51 Racetrack, and 54 Quarter-wave cavity are now implemented as geometry presets using the existing scalar 2D FDTD engine. Microstrip is a qualitative `Hz`-mode cross-section, not a full quasi-TEM transmission-line solver.
- 82-85 photonic-crystal scenes and 87-89 BIC/quasi-BIC scenes are implemented as finite photonic-crystal presets with symmetry-aware sources, Q/spectrum analysis where relevant, and a reduced Bloch-k sweep. The sweep now projects the current finite geometry onto Fourier coefficients of `1/epsilon`, solves a nine-plane-wave scalar Bloch matrix, samples the high-symmetry path Gamma-X-M-Gamma, and reports the first bands, direct and path gap proxies, structure factor, radiative-leakage proxy, Q proxy, and geometry asymmetry. The local symmetry-breaking sweep remains available manually for BIC scenes. They are useful comparative examples; full Bloch-periodic band/BIC validation remains future work.
- 91-95 SSH-family scenes now include an analytic clean-limit Bloch reference reporting winding number, band gap, edge-state expectation, and a reduced non-Hermitian gap proxy where applicable. 96 Honeycomb lattice, 97 Valley Hall, 98 Valley Hall bend, 99 Topological pumping, and 100 Topology with strong defect are implemented as qualitative topological-lattice presets using the scalar 2D engine, deterministic disorder, gain/loss tags, honeycomb-domain inversion, and traveling epsilon modulation where appropriate.

## Implemented in the first nonlinear-material pass

- 111 Kerr nonlinear slab: implemented as an instantaneous saturated Kerr update on tagged material cells, `epsilon = epsilon_base + chi3 |F|^2`.
- 112 SHG and 113 THG slabs: implemented qualitatively as nonlinear polarization-current sources, `J_NL = d(chi2 E^2 + chi3 E^3)/dt`, on tagged material cells.
- 114 Kerr SPM pulse and 115 Kerr bistable cavity: implemented as qualitative advanced Kerr workflows. The analysis panel reports spectral sideband proxies; SPM defaults to a source-amplitude sweep and the bistable cavity defaults to a bidirectional amplitude sweep for first-pass hysteresis curves.
- 116 VO2 switching slab and 117 PCM memory cell: implemented qualitatively with a persistent phase-state variable `s` per tagged cell, threshold hysteresis, finite on/off switching times, and default bidirectional amplitude sweeps.
- 118 saturable absorber, 119 all-optical switch, and 120 nonlinear limiter: implemented as phase-state/Kerr composite workflows. The analysis panel and amplitude-sweep chart report sideband and average switched-state proxies; these memory-like scenes default to bidirectional amplitude sweeps.
- 131 PT guides: implemented qualitatively as balanced gain/loss coupled guides with intensity-saturated gain to avoid immediate numerical blow-up. They now default to a `gamma` sweep of the balanced gain/loss magnitude and report a reduced 2x2 coupled-mode estimate of the PT phase.
- 132 exceptional point: implemented as a PT-symmetric coupled-guide proxy near the gain/loss-coupling balance. It now defaults to a `gamma` sweep that reports spectral/modal splitting, reduced coupled-mode `gamma/kappa`, PT phase, and distance to the EP; full geometry eigensolving remains future work.

## Implemented in the first temporal/spacetime pass

- 121 Temporal interface, 122 temporal slab, 123 temporal epsilon modulation, 124 temporal crystal, 125 temporally modulated guide, 126 traveling modulation, 127 temporal-isolator analogue, 128 modulated ring, 129 Floquet resonators, and 130 synthetic frequency dimension are implemented as examples using tagged sinusoidal epsilon modulation. The FDTD diagnostics now accumulate multi-frequency DFT phasors at the left/right line monitors and estimate a reduced two-port Floquet matrix `S_{m,0}` at `f0 + m Omega` for `m = -2..+2`, including transmitted `T_m`, reflected `R_m`, relative phase, sideband powers, total outgoing power, and dominant sideband order. The traveling-modulation and isolator-style presets also default to a forward/reverse direction sweep that reports approximate isolation; calibrated multi-incidence temporal scattering matrices remain future work.

## Implemented in the first coupled-workflow pass

- 133 Non-Hermitian skin-effect analogue, 134 BIC + Kerr, 135 BIC + ENZ, 136 Janus + topological guide, 137 Huygens + cavity, 138 topology + temporal modulation, 139 nonreciprocity + Valley Hall, and 140 space-time crystal are implemented as composite presets that combine existing scalar FDTD ingredients. BIC + Kerr and BIC + ENZ expose the reduced Bloch-k leakage/Q/band proxy; 138-140 expose the reduced Floquet sideband `S_m` readout. These are demonstration scenes, not full modal/eigenvalue or calibrated nonreciprocal-device validations.

## Implemented in the first dispersive-material pass

- 70 Finite-conductivity skin depth: implemented as a conductive material update using `J = sigma E`.
- 71 Drude metal and 74 plasma: implemented with an explicit electric-polarization ADE current on tagged material cells.
- 72 Lorentz resonant medium: implemented with a second-order Lorentz ADE polarization oscillator.
- 73 Debye dielectric: implemented with first-order relaxation polarization.
- 75 ENZ slab, 110 ENZ emitter, and the ENZ inclusion in 135 BIC + ENZ now use a passive Drude ADE tuned so the real effective epsilon is near zero at the carrier frequency, rather than a fixed complex epsilon placeholder.
- Draw materials can also be assigned manual Drude, plasma, Lorentz, or Debye ADE parameters from the contextual Draw menu.

## Implemented in the first magnetic-dispersion pass

- 107 Negative-index slab and 108 superlens now use matched passive electric and magnetic Drude ADE updates on tagged FDTD cells, with high-frequency `epsilon_inf = mu_inf = 1` and the Drude plasma frequency tuned so the carrier-frequency effective response is approximately double-negative. The material warning panel reports approximate `eps_eff`, `mu_eff`, and signed `n_eff` at the carrier frequency.

## Implemented in the first tensor-material pass

- 78 Chiral medium and 79 bianisotropic medium first gained a reduced 2D magnetoelectric model with passivity-limited normalized coupling `kappa_n`; the current state is the six-component path documented below.
- 80 Ferrite/gyrotropic medium: implemented qualitatively in the `Hz` solver with an antisymmetric in-plane epsilon tensor, `eps_xy = +g` and `eps_yx = -g`, on tagged material cells.

## Implemented in the first full-vector bianisotropy pass

- 78 Chiral medium and 79 bianisotropic medium now use a six-component 2D FDTD path in `Hz` mode: the primary `Hz/Ex/Ey` fields are evolved together with an auxiliary `Ez/Hx/Hy` channel, and tagged cells locally couple aligned electric and magnetic components with the passivity-limited `kappa_n` constitutive inversion. When the WASM backend is available, both Yee stencil updates reuse the compiled `step_hz` and `step` kernels, leaving only the local constitutive inversion in JavaScript. The material warning reports the cross-polarized energy ratio so the auxiliary channel is observable rather than hidden.
- 78 Chiral medium and 79 bianisotropic medium now also expose first-pass quantitative six-field observables: material cross-polarized energy fraction, output-line cross-polarized conversion, generated cross fraction, `kappa_n` statistics, and the local positive-definite passivity margin `1 - kappa_n^2`. These metrics are shown in the analysis panel, can drive frequency/amplitude sweeps, and are exported to CSV.

## Implemented in the first plasmonics pass

- 101 SPP interface: implemented as a Drude metal-dielectric interface with near-field dipole excitation.
- 102 SPP grating: implemented as a shallow Drude grating with qualitative grating-assisted coupling.
- 103 localized plasmon and 104 plasmonic dimer: implemented as Drude nanodisk presets, including a narrow dimer gap.
- 106 Perfect absorber and 109 Hyperlens are implemented as scalar 2D metamaterial presets. The absorber uses a graded impedance-matched lossy sheet backed by PEC and reports `A~ = 1 - R - T`; the hyperlens now uses a radial/tangential passive Drude ADE tensor in the `Hz` solver so the tangential in-plane epsilon component can be dispersive/indefinite while the radial component remains dielectric. The hyperlens analysis panel and frequency sweep now report outer/inner ring field transfer `Hout/Hin` plus a Fourier-angular detail-transfer proxy from harmonics `m=2..8`.

## Not implemented because they need monitors, sweeps, or post-processing

- Fully calibrated multi-port Floquet scattering matrices remain pending for 121-130 and 138-140. The current browser workflow now measures a reduced `S_{m,0}` two-port matrix directly from FDTD time traces for one incident carrier channel, but a full validation pass should add de-embedding to reference planes, reverse/sideband incident excitations, stricter modal normalization, power-balance residuals, and an explicit `S_{n,m}` matrix for all incident and generated frequency channels.
- Hyperlens PSF/MTF-style validation remains pending. The current `Hout/Hin` and angular-detail observables are useful FDTD comparison metrics, but a quantitative hyperlens validation should add controlled subwavelength source patterns, radial image extraction, grid/timestep convergence checks, and comparison against a reference solution.
- Publication-grade negative-index and superlens validation remains pending. The current 107/108 presets now use passive electric+magnetic ADE material dynamics and expose beam-angle, beam-case power-balance, and superlens image-transfer observables directly from FDTD fields, but validation should still add calibrated phase-front extraction, grid/timestep convergence checks, and comparison against a reference solution.
- Publication-grade chiral/bianisotropic validation remains pending. The current 78/79 presets now evolve six 2D field components and expose cross-polarized conversion plus passivity-margin observables directly from FDTD fields, but validation should still calibrate the time-domain `kappa_n` convention against a known reciprocal chiral or omega-medium reference, run grid/timestep convergence, and compare polarization conversion against an analytic or independent numerical solution.
- Full k-resolved BIC and quasi-BIC validation still requires Bloch-periodic boundaries and a higher-order geometry-derived eigenvalue solver. The in-browser Bloch-k sweep now includes a reduced nine-plane-wave scalar eigensolve and a Gamma-X-M-Gamma path estimate, but it remains a low-order finite-geometry projection rather than a rigorous band-structure proof. The symmetry-breaking sweep is still a local finite-cavity proxy. SSH scenes have a separate analytic Bloch reference.
- Publication-grade nonlinear transfer curves for 114-120 still require formal grid/timestep convergence checks, calibrated steady-state tolerances, and post-processing beyond the in-browser bidirectional amplitude sweep, steady-drift flag, and CSV export.
- Quantitative exceptional-point proof for 132 still requires a modal/eigenvalue solve of the actual FDTD geometry. The in-browser `gamma` sweep now includes a reduced 2x2 coupled-mode eigenvalue estimate, but it is not yet a geometry-derived eigenproblem.

## Not implemented because the geometry/workflow is still too specific

- No geometry-only Atlas dropdown scenes remain in this bucket. Remaining gaps require calibrated monitors, post-processing, or modal/sweep workflows rather than missing FDTD update physics.

## Implemented with idealized constant-material approximations

- 77 Hyperbolic medium uses diagonal constant anisotropy.
- 109 Hyperlens now uses a passive radial/tangential Drude ADE tensor rather than a constant positive-anisotropy placeholder. It also exposes a comparative FDTD observable for radial field transfer and angular-detail transfer. It is still a qualitative scalar-`Hz` 2D analogue; quantitative hyperlens validation still needs convergence checks, radial/tangential parameter calibration, and comparison against a reference solution.
- 121-130 temporal/spacetime examples use the current sinusoidal epsilon modulation on tagged material cells. The reduced `S_{m,0}` readout now comes from DFT phasors accumulated in the FDTD line monitors and separates transmitted/reflected orders, but it is still a one-incident-channel, two-monitor estimate rather than a fully calibrated multi-port Floquet scattering matrix. The 127 temporal-isolator scene reports an approximate forward/reverse isolation ratio, but this remains a traveling-modulation analogue rather than a proof of ideal one-way isolation.
- 133 and 139 use gain/loss or traveling-modulation analogues for non-Hermitian/nonreciprocal behavior; 139 now reports approximate isolation, while 133 still does not solve a non-Bloch skin spectrum.
- 134-140 are coupled demonstration presets built from existing scalar-mode components. They should be treated as exploratory teaching examples until modal, sideband, and S-parameter validation workflows are added.
