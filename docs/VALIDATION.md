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
- CPML late-time residual-energy proxy after a Gaussian pulse leaves the active domain.
- Slab-waveguide modal launch metrics: forward guided energy, backward ratio, cladding radiation ratio, and core energy fraction.
- Ringdown analysis sample count and finite positive Q proxy.
- Source deletion / retirement stability after a running source is removed.
- P1 proxy-contract checks for Mach-Zehnder split-arm geometry, microstrip Hz PEC/substrate cross-section, and Purcell 2D Q/Aeff diagnostics.
- P1 aperture checks: single-slit downstream symmetry and central lobe, and double-slit multi-peak interference profile.
- P1 material/device checks: source/radiation routes and phase contracts, conductivity route and late-time attenuation proxy, ADE route plus effective permittivity for Drude/Lorentz/Debye/plasma/ENZ and hyperbolic tensor scenes, anisotropic/gyrotropic tensor-cell diagnostics, six-field bianisotropy passivity and cross-energy diagnostics, interfaces and multilayers (quarter-wave coating, Bragg mirror/stack, total internal reflection, and frustrated TIR), Fabry-Perot cavity localization/standing-wave contrast, ring/add-drop resonator coupling, cylinder/dimer scattering and random-medium spread proxies, photonic-crystal/BIC/Fano geometry plus reduced Bloch/leakage observables, SSH/honeycomb/Valley-Hall topology proxies, plasmonic/metasurface/absorber/ENZ geometry and overlap proxies, SPP interface/grating surface localization, negative-index/superlens reduced observables, nonlinear/harmonic/phase-change active-media reduced observables, time-varying/Floquet media geometry, sideband, phase-coherence, and active-region overlap proxies, and coupled/non-Hermitian workflow proxies for PT/EP, skin-effect analogues, BIC-active defects, Janus/Huygens sources, and hybrid topology-temporal scenes.

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

`PASS` means the configured checks are satisfied.

`WARN` means the project is runnable, but a maintenance issue should be reviewed.

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
- The topological-photonics P1 checks verify SSH dimerization and analytic winding proxies, interface/disorder/non-Hermitian SSH flags, honeycomb sublattice inversion, Valley-Hall bend/defect geometry, modulation masks, and finite field overlap. They do not replace eigenspectrum calculations, Berry curvature/Chern or valley-Chern extraction, topological pump cycle integration, protected-transmission spectra, or mesh convergence.
- The plasmonic/metamaterial P1 checks verify Drude masks, localized/dimer geometries, finite near/gap fields, metasurface bar gradients, lossy absorber backplanes, hyperlens reduced MTF samples, and ENZ slab overlap. They do not replace resonance spectra, field-enhancement calibration, absorber S-parameter retrieval, full hyperlens imaging metrics, or mesh convergence.
- The browser physics runner reports raw interface transmittance and runtime Brewster-scan minima as diagnostics. Blocking checks use observables that are meaningful for the finite scene: Fresnel R, low R at the analytic Brewster angle, PML residual energy, slab modal launch, ringdown Q, and source-retirement stability.
- The nonlinear/active-media P1 checks verify masks, active-cell counts, field overlap, reduced H2/H3/sideband observables, phase-state response, active-section/output-arm energy, and limiter-loss overlap. They do not replace calibrated nonlinear transfer curves, harmonic conversion efficiencies, hysteresis loops, bistability curves, pump-probe switching dynamics, or mesh convergence.
- The time-varying/Floquet P1 checks verify modulated masks, active-cell counts, finite reduced sideband readouts, uniform versus traveling or staggered modulation phase coherence, and field overlap with slabs, guides, rings, or resonator chains. They do not replace calibrated de-embedded multi-incidence scattering matrices, sideband power-balance closure, reverse-port isolation spectra, or mesh convergence.
- The coupled/non-Hermitian P1 checks verify gain/loss masks, PT modal proxy availability, EP proximity proxy, non-Hermitian skin edge/localization proxies, BIC active-defect overlap, Janus/Huygens source routing, and hybrid topology-temporal Floquet observables. They do not replace eigenmode coalescence calculations, non-Bloch spectra, calibrated isolation/transport spectra, or device-level S-parameter validation.
- Quantitative BIC/topological, chiral/bianisotropic, hyperlens, and negative-index validations still need calibrated references and convergence workflows beyond the reduced browser observables.
- `test:browser` depends on Playwright and a local Chromium install, but is intentionally short.
- `test:browser:physics` is intentionally slower because it runs the long browser physics cases from the matrix.
- `npm test` has no external runtime dependency beyond Node.
