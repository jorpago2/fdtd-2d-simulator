# Validation Protocol

This project now separates three levels of confidence:

1. Static consistency checks.
2. Browser smoke checks.
3. Physics validation and convergence checks.

The goal is not to claim that every Atlas scene is publication-grade. The goal is to make clear which results are only qualitative examples and which ones have a reproducible validation path.

## Quick Commands

```powershell
npm test
```

Runs `scripts/validate-static.mjs`. It checks:

- JavaScript syntax for the ordered browser scripts.
- HTML script/CSS links.
- Scene dropdown values against `applyPreset`.
- Scene dropdown values against `sceneDescriptions`.
- Validation matrix presets.
- 2D Yee CFL condition, `S < 1 / sqrt(2)`.
- Reproducibility UI and scene snapshot functions.
- JS/WASM FDTD step argument count parity against the exported C++ kernels.

```powershell
npm run validate:architecture
```

Runs refactor guardrails: active assets must not load retired paths, the app must keep a single canonical stylesheet, runtime dependency checks must stay delegated to `runtime-dependencies.js`, pure simulation files must avoid DOM APIs outside documented integration exceptions, and `main.js` must stay below the current centrality budget.

```powershell
npm install
npx playwright install chromium
npm run test:browser
```

Runs the fast smoke subset in `scripts/browser-smoke.mjs`. It starts a local static server, opens Chromium, loads P0 cases whose profile is `smoke`, advances the simulation for a few steps, checks for non-finite UI values, checks active media labels where relevant, verifies JSON scene export, and reports an approximate `msPerStep`.

```powershell
npm run test:browser:physics
```

Runs the heavier P0 browser cases whose profile is `physics`. These scenarios use direct in-browser stepping with quantitative diagnostics and should be treated as validation checks, not as a quick pre-commit smoke test.

```powershell
npm run test:browser:physics:all
```

Runs every browser-executable physics case in the validation matrix, including P1 scene-family checks. Use this after editing presets or scientific observables; it is intentionally slower than the P0 physics gate.

Current quantitative checks include:

- Normal-incidence Fresnel reflectance against the analytic air-dielectric reference; raw line-monitor transmittance is reported as a bounded port observable, not used as an independent energy-closure claim for the finite TFSF scene.
- TM Brewster reflectance at the analytical angle, with the compact runtime angle scan reported alongside an analytic Fresnel reference curve.
- Frustrated total internal reflection checks require a finite air gap, a second high-index medium, tunneled far-side field energy, and a contrast above the isolated-TIR reference.
- CPML late-time residual-energy proxy after a Gaussian pulse leaves the active domain.
- Magnetic-dipole `Mz` source route in the `Hz` formulation, with homogeneous-domain checks for a single sinusoidal point source, local field energy, and approximate left/right and upper/lower symmetry.
- Equal-phase dipole-array geometry, with checks for eight sinusoidal point sources, vertical half-wavelength spacing, zero progressive phase, and local source energy.
- NTFF workflow generation, with analysis sample count, finite normalized angular samples, positive far-field peak, and bounded nontrivial angular variation.
- Mach-Zehnder 2D guided-interferometer routing, with mode-source launch, split arms, a distinct phase-shifter section, and finite field energy reaching splitter, both arms, combiner, and output guide. This is not a calibrated phase-transfer or extinction-ratio curve.
- Microstrip 2D cross-section field contract, with `Hz` formulation, PEC strip, PEC ground plane inside the active domain, dielectric substrate, finite strip-ground separation, and substrate field energy. This is not a characteristic-impedance or S-parameter extraction.
- Add-drop ring coupling, with bus/drop waveguide cells, ring energy storage, ring-to-bus coupling, and finite drop-bus energy. This is not a calibrated resonance spectrum or loaded-Q extraction.
- Ringdown Q estimation, with analysis sample count, finite positive Q estimate, bounded Q range, and late-time energy below the peak envelope.
- Dielectric-cylinder near-field scattering, with a lossless high-index object, nonzero object energy, lateral scattering contrast, and a bounded downstream shadow ratio. This is not a calibrated Mie or scattering-width benchmark.
- PEC-cylinder 2D NTFF scattering-width workflow, with incident-background subtraction, accumulated analysis samples, finite scattering width, and nontrivial forward/backward contrast. This is not a 3D RCS claim.
- Absorbing dielectric cylinder interaction, with lossy high-index cells, finite in-object field energy, lateral scattering contrast, and bounded downstream attenuation. This is not an absolute absorption cross-section.
- 2D NTFF forward/backward contrast, with `Hz` polarization, finite high-index-cylinder scattering width, and strong forward/backward asymmetry. This is not a calibrated Kerker-condition multipole decomposition.
- Dense-disorder trapping transport, with deterministic high-contrast disorder, accumulated analysis samples, lateral scattered-energy fraction, and bounded right-boundary transport. This is not a calibrated Anderson localization-length extraction.
- Finite-conductivity damping, with explicit `J = sigma E` activation, large conductive half-space, finite conductor field energy, and bounded late-time energy. This is not a fitted skin-depth measurement.
- Indefinite Drude tensor route, with `Hz` ADE, anisotropic dispersive cells, indefinite effective tensor diagnostics, and finite material-region energy. This is not a broadband hyperbolic-material retrieval.
- Slab-waveguide modal launch metrics: forward guided energy, backward ratio, cladding radiation ratio, and core energy fraction.
- Ringdown analysis sample count and finite positive Q proxy.
- Source deletion / retirement stability after a running source is removed.
- P1 contract checks for Mach-Zehnder split-arm propagation, microstrip Hz PEC/substrate cross-section, bounded 2D cavity Q/Aeff diagnostics, dipole-to-guide guided-flux ratio, and dual-dipole disk spectral splitting.
- P1 aperture checks: single-slit downstream symmetry and central lobe, and double-slit multi-peak interference profile.
- P1 material/device checks: source/radiation routes and phase contracts, conductivity route and late-time attenuation proxy, ADE route plus effective permittivity for Drude/Lorentz/Debye/plasma/ENZ and hyperbolic tensor scenes, anisotropic/gyrotropic tensor-cell diagnostics, six-field bianisotropy passivity and cross-energy diagnostics, interfaces and multilayers (quarter-wave coating, Bragg mirror/stack, total internal reflection, and frustrated TIR), Fabry-Perot cavity localization/standing-wave contrast, ring/add-drop resonator coupling, cylinder/dimer scattering and random-medium spread proxies, photonic-crystal/BIC/Fano geometry plus reduced Bloch/leakage observables, SSH/honeycomb/Valley-Hall topology proxies, plasmonic/metasurface/absorber/ENZ geometry and overlap proxies, SPP interface/grating surface localization, negative-index/superlens reduced observables, nonlinear/harmonic/phase-change active-media reduced observables, time-varying/Floquet media geometry, sideband, phase-coherence, and active-region overlap proxies, and coupled/non-Hermitian workflow proxies for PT/EP, skin-effect analogues, BIC-active defects, Janus/Huygens sources, and hybrid topology-temporal scenes.
- Six-field bianisotropic coupling response, with `Hz` routing, the full-vector six-field path, nonzero passivity-limited kappa, positive energy-form margin, and finite cross-field energy. This is not an optical-rotation or tensor S-parameter extraction.
- Gyrotropic tensor block route, with `Hz` routing, nonzero antisymmetric tensor coefficient `g`, tensor-cell diagnostics, and finite material-region energy. This is not a calibrated Faraday-rotation or nonreciprocal S-parameter extraction.
- 2D photonic-crystal lattice route, with high-index rod count, row/column coverage, Bloch-k sweep activation, compact PWE band estimate, structure factor, and finite gap observable. This is not a full band-diagram convergence study.
- PhC point-defect route, with a missing central rod, point-dipole source, finite center-defect energy fraction, local cavity-window field overlap, and compact Bloch/PWE reference for the surrounding lattice. This is not an eigenmode frequency or Q-convergence extraction.
- Shifted/tapered L3 PhC cavity route, with three central vacancies, point-dipole excitation, local field overlap, explicit shifted-hole offset, analysis samples, and compact Bloch/PWE reference. This is not an independently optimized or grid-converged cavity-Q result.
- Antisymmetric PhC-defect excitation route, with mirror-symmetric lattice geometry, two equal-amplitude opposite-phase point dipoles, finite center-defect and cavity-window field overlap, and compact leakage/PWE diagnostics. This is not a modal-overlap or radiation-suppression proof of a dark mode.
- Asymmetric PhC-defect route, with deliberate source amplitude/phase imbalance, finite geometry offset, local field overlap, finite asymmetry metric, and compact leakage/PWE diagnostics. This is not a quasi-BIC Q-scaling or eigenmode-continuation study.
- Symmetric shifted L3 PhC-cavity route, with three central vacancies, equal-amplitude opposite-phase point dipoles, explicit shifted-hole offset, finite local field overlap, and compact leakage/PWE diagnostics. This is not a proof of a symmetry-protected BIC or diverging-Q scaling.
- SSH interface route, with high-index site count, topological dimerization reference, winding/gap check, expected interface-state flag, and finite field energy localized near the interface. This is not a full-wave eigenmode extraction.
- Disordered SSH interface route, with deterministic site perturbations, clean-limit winding/gap reference, accumulated analysis samples, expected interface-state flag, and finite interface-region field energy. This is not a disorder-averaged topological protection study.
- Non-Hermitian SSH gain/loss route, with alternating active/lossy site masks, saturable gain stabilization, accumulated analysis samples, finite non-Hermitian gap estimate, and finite interface-region field energy. This is not a biorthogonal eigenspectrum or non-Bloch invariant calculation.
- Valley-Hall bend route, with high-index honeycomb coverage, opposite sublattice-bias signs across the horizontal and vertical domain-wall segments, finite source overlap, and finite bent-channel field energy. This is not a protected-transmission or valley-Chern extraction.

## Matrix

The validation source of truth is:

```text
scripts/validation-matrix.json
```

Current P0 cases:

| Case | Preset | Purpose |
| --- | --- | --- |
| `air_propagation` | `planeWaveAir` | Baseline homogeneous Yee propagation. |
| `normal_interface_fresnel` | `normalInterface` | First quantitative Fresnel R/T check. |
| `brewster_tm_minimum` | `brewsterTm` | Oblique incidence and TM Brewster minimum. |
| `pml_reflection` | `pmlAbsorption` | CPML absorbing-boundary residual/reflection check. |
| `slab_waveguide_confinement` | `slabWaveguide` | Integrated-photonics guided-mode workflow. |
| `resonator_ringdown_q` | `qRingdown` | Ringdown analysis and Q proxy. |
| `advanced_material_smoke` | `drudeMetal` | ADE/dispersive material state arrays. |

P1 entries include both executable scene-family checks and tracking entries for known quantitative gaps. Executable P1 examples currently cover source/radiation routing, polarization, array phase, slot/PEC/substrate, and NTFF proxies; single/double-slit diffraction; conductivity and ADE/tensor material behavior; interfaces and multilayers; Fabry-Perot/ring resonator behavior; scattering/disorder scenes; photonic-crystal/BIC/Fano reduced observables; SSH/honeycomb/Valley-Hall topology proxies; plasmonic/metasurface/absorber/ENZ reduced checks; SPP interface/grating localization; negative-index/superlens reduced observables; nonlinear/active-media overlap, harmonic, sideband, switching, and limiter proxies; time-varying/Floquet media checks for uniform, traveling, and staggered modulation; and coupled/non-Hermitian workflow checks. Tracking-only P1 entries remain for analytic source-pattern regression, monitor/observable sweeps, calibrated nonlinear material transfer curves, coupled-workflow references beyond reduced proxies, Floquet de-embedding, hyperlens MTF calibration, and calibrated six-field bianisotropy references.

## Interpretation

`PASS` means the configured checks are satisfied and no scene-level caveat is currently attached.

`WARN` means the project is runnable, but the example has a documented teaching/modeling caveat, reduced/proxy observable, or missing calibrated reference for stronger claims.

`BLOCK` means the result should not be trusted until the blocker is fixed.

For research-grade use, browser smoke checks are not enough. Use the matrix as a starting point for:

- Grid refinement, for example 12, 20, and 32 cells per lambda0.
- Longer runs to reduce transient contamination.
- Power-balance checks, especially for interfaces, CPML, gain/loss, and dispersive media.
- Analytical or independent numerical references where available.

## Current Limitations

- The browser smoke test is intentionally short; it is a regression guard, not a full physical proof.
- Some Atlas scenes are qualitative demonstrations by design.
- The first-pass source-physics scenes still need analytic source-pattern regression tests for phase, envelope, and steering-angle sign.
- The source/radiation P1 checks verify source route, solver polarization, source count, array phase progression, substrate/PEC/slot/guide geometry, finite source-neighborhood energy, and NTFF sample generation. They do not replace analytic radiation-pattern fits, aperture antenna theory, or grid-converged far-field calibration.
- The first-pass monitor/observable scenes now use separated forward/backward power estimates for R/T, but still need analytic angular-sweep regression and grid convergence before quantitative claims.
- The aperture diffraction checks are executable scene-behavior tests. They do not replace far-field diffraction theory fits or mesh-convergence studies.
- The interface, multilayer, and resonator P1 checks verify geometry, finite energy localization, monitor samples, and qualitative coupling. They do not replace transfer-matrix spectra, de-embedded S-parameters, Q extraction, or mesh-convergence studies.
- The scattering/disorder P1 checks verify scatterer geometry, finite field interaction, NTFF/scattering-width availability where configured, and qualitative lateral spread or transport proxies. They do not replace calibrated 2D Mie/RCS references, mean-free-path fits, coherent-backscattering analysis, localization-length extraction, or mesh convergence.
- The material/tensor P1 checks verify the intended numerical route and first-order observables: conductive sigma masks, ADE material kind and effective epsilon, tensor definiteness, gyrotropy masks, and six-field bianisotropy passivity/cross-energy. They do not replace fitted dispersion spectra, skin-depth extraction, optical-activity rotation, tensor S-parameters, or mesh convergence.
- The photonic-crystal/BIC/Fano P1 checks verify lattice geometry, defects, line guides, intentional symmetry/asymmetry, side-resonator separation, finite field overlap, and reduced Bloch/leakage/PWE proxies. They do not replace calibrated band diagrams, eigenmode solvers, de-embedded transmission spectra, Q extraction, or mesh convergence.
- The PhC line-defect waveguide check requires a localized source, significant line-channel energy, and bounded adjacent-row leakage. It is not a calibrated W1/eigenmode transmission benchmark.
- The topological-photonics P1 checks verify SSH dimerization and analytic winding proxies, interface/disorder/non-Hermitian SSH flags, honeycomb sublattice inversion, Valley-Hall bend/defect geometry, modulation masks, and finite field overlap. They do not replace eigenspectrum calculations, Berry curvature/Chern or valley-Chern extraction, topological pump cycle integration, protected-transmission spectra, or mesh convergence.
- The modulated SSH-chain route verifies active material modulation, modulation depth/frequency, analysis samples, site-count bounds, source overlap, and finite chain-region field energy. It is not an adiabatic Thouless-pump cycle or pumped-displacement calculation.
- The plasmonic/metamaterial P1 checks verify Drude masks, localized/dimer geometries, finite near/gap fields, metasurface bar gradients, lossy absorber backplanes, hyperbolic annular-transfer MTF samples, and ENZ slab overlap. They do not replace resonance spectra, field-enhancement calibration, absorber S-parameter retrieval, full hyperlens imaging metrics, or mesh convergence.
- The SPP grating launcher check verifies Hz polarization, Drude dispersion, grating teeth above the metal interface, and a surface-band energy fraction above the far-air comparison band. It is not an absolute grating-coupler efficiency extraction.
- The backed absorber check verifies a graded lossy sheet, PEC backplane, finite line-diagnostic samples, high estimated absorption, low reflection, and blocked transmission. It is still a finite-scene line-monitor estimate rather than a de-embedded S-parameter retrieval.
- The double-negative Drude slab check verifies ADE electric and magnetic dispersion, effective epsilon and mu near -1, finite in-slab field/phase energy, phase-front coherence, and transmitted field energy under normal incidence. It is not an oblique negative-refraction-angle benchmark.
- The DNG slab image-transfer check verifies double-negative material cells, finite field/phase energy in the slab, nonzero point-source image-plane transfer, and an image-plane width below the object-plane width. It is not a calibrated evanescent transfer-function measurement.
- The 2D hyperbolic annular-transfer check verifies Hz Drude-tensor routing, tensor-like dispersive cells, finite material-region energy, nonzero inner-to-outer ring transfer, valid angular-harmonic samples, and finite MTF bandwidth. It is not a 3D cylindrical hyperlens benchmark.
- The browser physics runner reports raw interface transmittance and runtime Brewster-scan minima as diagnostics. Blocking checks use observables that are meaningful for the finite scene: Fresnel R, low R at the analytic Brewster angle, PML residual energy, slab modal launch, ringdown Q, and source-retirement stability.
- The nonlinear/active-media P1 checks verify masks, active-cell counts, field overlap, H2/H3/sideband observables, phase-state response, active-section/output-arm energy, and limiter-loss overlap. They do not replace calibrated nonlinear transfer curves, harmonic conversion efficiencies, hysteresis loops, bistability curves, pump-probe switching dynamics, or mesh convergence.
- The SHG chi2 slab check verifies enabled harmonic material, nonlinear-region field overlap, accumulated analysis samples, substantial H2 readout, and H2-dominant harmonic content. It is not an absolute conversion-efficiency calibration.
- The chi3 harmonic slab check verifies enabled harmonic material, nonlinear-region field overlap, accumulated analysis samples, and finite H3 readout. It is not a calibrated or H3-dominant THG-efficiency measurement.
- The Kerr SPM sideband check verifies enabled Kerr material, accumulated analysis samples, nonlinear-region overlap, active-section energy, and finite sideband response. It is not a calibrated nonlinear phase-shift curve.
- The Kerr ring-cavity overlap check verifies mode-launched guide energy, Kerr cavity cells, analysis samples, and finite active-section field overlap. It is not a hysteresis or steady-state bistability extraction.
- The VO2 phase-change slab check verifies enabled phase-state material, finite switched-cell count, nonzero phase-state amplitude, material overlap, and increased loss in the switched region. It is not a calibrated thermal/electronic transition model.
- The PCM memory-cell check verifies a compact phase-change inclusion in a guide, guided-field overlap, high phase-state amplitude, nonzero phase-state mean, and switched-cell count. It is not a retention/endurance model.
- The saturable-absorber state check verifies lossy active cells, phase-state response, switched-cell count, and finite absorber-region field energy. It is not a calibrated transmission-versus-intensity curve.
- The all-optical active-section check verifies simultaneous Kerr and phase-state routes, active-region field overlap, switched-state response, and output-arm energy. It is not an extinction-ratio or switching-energy benchmark.
- The nonlinear-limiter active-loss check verifies phase-state material, high-loss state, switched cells, and finite limiter-region field energy. It is not a calibrated input-output limiting curve.
- The time-varying/Floquet P1 checks verify modulated masks, active-cell counts, finite reduced sideband readouts, uniform versus traveling or staggered modulation phase coherence, and field overlap with slabs, guides, rings, or resonator chains. They do not replace calibrated de-embedded multi-incidence scattering matrices, sideband power-balance closure, reverse-port isolation spectra, or mesh convergence.
- The coupled/non-Hermitian P1 checks verify gain/loss masks, PT modal proxy availability, EP proximity proxy, non-Hermitian skin edge/localization proxies, BIC active-defect overlap, Janus/Huygens source routing, and hybrid topology-temporal Floquet observables. They do not replace eigenmode coalescence calculations, non-Bloch spectra, calibrated isolation/transport spectra, or device-level S-parameter validation.
- Quantitative BIC/topological, optical-activity/tensor-parameter, hyperlens, and negative-index validations still need calibrated references and convergence workflows beyond the reduced browser observables.
- `test:browser` depends on Playwright and a local Chromium install, but is intentionally short.
- `test:browser:physics` is intentionally slower because it runs the long browser physics cases from the matrix.
- `npm test` has no external runtime dependency beyond Node.
