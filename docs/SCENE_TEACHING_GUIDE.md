# Scene Teaching Guide

This guide translates the validation audit into teaching use. It does not claim that every Atlas scene is publication-grade. It tells an instructor what each family can safely demonstrate, which observables are reliable, and where a scene uses bounded diagnostics rather than calibrated device metrics.

## Confidence Levels

| Level | Meaning | Suitable teaching use | Not suitable for |
| --- | --- | --- | --- |
| Quantitative check | The validation matrix compares a targeted observable with an analytic, numerical, or reproducible reduced reference. | Lab-style exercises, regression examples, parameter studies with caveats. | Publication claims without convergence and independent references. |
| Contract/diagnostic check | The scene runs, has the intended geometry/material/source route, and exposes finite targeted diagnostics. | Concept introduction, mechanism visualization, guided discussion. | Absolute efficiencies, calibrated S-parameters, fitted spectra, or device metrics. |
| Bounded teaching claim | The scene is deliberately labeled around the behavior that is directly checked. | Showing physical intuition and modeling assumptions. | Claims about exact devices, 3D behavior, or topological/material invariants. |

## Family Guidance

| Family | Use it to teach | Best observables | Main caveat |
| --- | --- | --- | --- |
| Maxwell and propagation | Yee-grid propagation, interference, apertures, CPML behavior. | Field phase, energy stability, aperture profiles, Poynting direction. | Short browser runs are regression checks, not convergence studies. |
| Interfaces and multilayers | Fresnel reflection, refraction, Brewster angle, TIR, coatings, Bragg stacks. | Analytic Fresnel R, low R near Brewster angle, evanescent/frustrated-TIR field overlap, frustrated-TIR contrast against isolated TIR, coating/stack reflectance diagnostics. | Raw line-monitor T is a finite-scene port observable; do not use it alone as de-embedded power balance. |
| Sources and radiation | Dipoles, phased arrays, Huygens/Janus sources, NTFF workflow. | Source count/phase/polarization, near-field energy, finite far-field samples. | Radiation patterns need analytic fits and grid convergence for quantitative antenna claims. |
| Guided optics | Mode launch, bends, tapers, couplers, MMI, MZI, resonator side branches. | Mode-profile source route, guide geometry, guided-band energy, splitter/coupler diagnostics. | Coupling ratios and phase shifts need de-embedding against ports for calibrated device claims. |
| Resonators and cavities | Ringdown, standing waves, cavity localization, 2D Q/Aeff and dipole-guide flux workflows. | Analysis samples, Q estimate, cavity energy fraction, Q/Aeff metric, guided-flux ratio. | 2D Q/Aeff and guided-flux ratios are not 3D LDOS, measured lifetime, or de-embedded beta-factor predictions. |
| Scattering and disorder | Cylinder/dimer scattering, random transport, localization intuition. | Scatterer geometry, finite interaction energy, NTFF/scattering-width diagnostics, lateral spread. | Not a calibrated Mie/RCS/localization-length workflow. |
| Materials and tensors | Drude/Lorentz/Debye/plasma, ENZ, anisotropy, gyrotropy, bianisotropy. | ADE state, effective epsilon, tensor masks, passivity/cross-field diagnostics. | Dispersion spectra, optical rotation, and S-parameters need dedicated references. |
| Periodic photonics and BICs | Photonic crystals, line defects, Fano side resonators, symmetry effects. | Lattice/defect geometry, Bloch/leakage diagnostics, field overlap. | Band diagrams, eigenfrequencies, BIC Q scaling, and Fano spectra are not fully solved here. |
| Topological photonics | SSH, honeycomb, Valley-Hall analogues, disorder/interface intuition. | Dimerization, winding diagnostics, interface geometry, finite guide overlap. | Berry curvature, Chern/valley-Chern, non-Bloch spectra, and protected transmission need separate solvers. |
| Plasmonics and metamaterials | SPP localization, grating coupling, dipole-fed dimer hot spots, metasurface phase trends, ENZ/negative-index scenes. | Drude masks, surface localization, dimer gap enhancement, absorber/backplane geometry, bounded transfer diagnostics. | Coupling efficiency, calibrated field enhancement spectra, absorber retrieval, hyperlens MTF, and superlens transfer functions are not calibrated. |
| Nonlinear and active media | Kerr, harmonics, phase-change, saturable absorption, switching/limiting intuition. | Active-cell overlap, harmonic/sideband diagnostics, phase-state response, output-arm energy. | Nonlinear transfer curves, hysteresis, conversion efficiency, and switching energy need controlled sweeps. |
| Time-varying and Floquet media | Temporal interfaces, modulation, sidebands, phased resonator chains. | Modulated-cell masks, phase coherence/spread, reflected-sideband diagnostics. | De-embedded multi-port Floquet scattering and isolation spectra are not provided by default. |
| Coupled and non-Hermitian workflows | PT/near-EP diagnostics, biased gain/loss SSH chains, hybrid source/Valley-Hall/cavity scenes. | Gain/loss masks, modal diagnostics, active-region overlap, source/guide/cavity overlap. | Eigenvalue coalescence, non-Bloch theory, and calibrated isolation/transport spectra need external validation. |

## Current Audit Status

The current audit has `PASS 141`, `WARN 0`, `VALIDATION_GAP 0`, and `FIX_REQUIRED 0`. This means every scene currently has an executable or static validation contract aligned with its visible teaching claim. It does not mean every scene is publication-grade.

## High-Impact Upgrade Path

1. Add de-embedded port normalization for interface and guided-device transmission.
2. Add grid-refinement presets for the P0 and highest-use P1 teaching scenes.
3. Add analytic or independent references for the main diagnostic families: transfer-matrix multilayers, mode-solver waveguides, Mie cylinder scattering, photonic-crystal band diagrams, nonlinear transfer curves, and Floquet S-parameters.
4. Keep bounded-claim labels visible in teaching material until those references exist.
