# Scene Teaching Guide

This guide translates the validation audit into teaching use. It does not claim that every Atlas scene is publication-grade. It tells an instructor what each family can safely demonstrate, which observables are reliable, and where a scene is intentionally a reduced proxy.

## Confidence Levels

| Level | Meaning | Suitable teaching use | Not suitable for |
| --- | --- | --- | --- |
| Quantitative check | The validation matrix compares a targeted observable with an analytic, numerical, or reproducible reduced reference. | Lab-style exercises, regression examples, parameter studies with caveats. | Publication claims without convergence and independent references. |
| Contract/proxy check | The scene runs, has the intended geometry/material/source route, and exposes finite reduced observables. | Concept introduction, mechanism visualization, guided discussion. | Absolute efficiencies, calibrated S-parameters, fitted spectra, or device metrics. |
| Qualitative caveat | The scene is deliberately labeled as a proxy or analogue. | Showing physical intuition and modeling assumptions. | Claims about exact devices, 3D behavior, or topological/material invariants. |

## Family Guidance

| Family | Use it to teach | Best observables | Main caveat |
| --- | --- | --- | --- |
| Maxwell and propagation | Yee-grid propagation, interference, apertures, CPML behavior. | Field phase, energy stability, aperture profiles, Poynting direction. | Short browser runs are regression checks, not convergence studies. |
| Interfaces and multilayers | Fresnel reflection, refraction, Brewster angle, TIR, coatings, Bragg stacks. | Analytic Fresnel R, low R near Brewster angle, evanescent/frustrated-TIR field overlap, coating/stack reflectance proxies. | Raw line-monitor T is a finite-scene port observable; do not use it alone as de-embedded power balance. |
| Sources and radiation | Dipoles, phased arrays, Huygens/Janus sources, NTFF workflow. | Source count/phase/polarization, near-field energy, reduced far-field samples. | Radiation patterns need analytic fits and grid convergence for quantitative antenna claims. |
| Guided optics | Mode launch, bends, tapers, couplers, MMI, MZI, resonator side branches. | Mode-profile source route, guide geometry, guided-band energy, splitter/coupler proxies. | Coupling ratios and phase shifts are teaching proxies unless de-embedded against ports. |
| Resonators and cavities | Ringdown, standing waves, cavity localization, beta/Purcell proxies. | Analysis samples, Q proxy, cavity energy fraction, Q/Aeff proxy. | 2D Q and Purcell proxies are not 3D LDOS or measured lifetime predictions. |
| Scattering and disorder | Cylinder/dimer scattering, random transport, localization intuition. | Scatterer geometry, finite interaction energy, NTFF/scattering-width proxies, lateral spread. | Not a calibrated Mie/RCS/localization-length workflow. |
| Materials and tensors | Drude/Lorentz/Debye/plasma, ENZ, anisotropy, gyrotropy, bianisotropy. | ADE state, effective epsilon, tensor masks, passivity/cross-field diagnostics. | Dispersion spectra, optical rotation, and S-parameters need dedicated references. |
| Periodic photonics and BICs | Photonic crystals, line defects, Fano side resonators, symmetry effects. | Lattice/defect geometry, Bloch/reduced leakage proxies, field overlap. | Band diagrams, eigenfrequencies, BIC Q scaling, and Fano spectra are not fully solved here. |
| Topological photonics | SSH, honeycomb, Valley-Hall analogues, disorder/interface intuition. | Dimerization, winding proxies, interface geometry, finite guide overlap. | Berry curvature, Chern/valley-Chern, non-Bloch spectra, and protected transmission need separate solvers. |
| Plasmonics and metamaterials | SPP localization, grating coupling, metasurface phase trends, ENZ/negative-index analogues. | Drude masks, surface/gap energy, absorber/backplane geometry, reduced transfer observables. | Coupling efficiency, absorber retrieval, hyperlens MTF, and superlens transfer functions are not calibrated. |
| Nonlinear and active media | Kerr, harmonics, phase-change, saturable absorption, switching/limiting intuition. | Active-cell overlap, harmonic/sideband proxies, phase-state response, output-arm energy. | Nonlinear transfer curves, hysteresis, conversion efficiency, and switching energy need controlled sweeps. |
| Time-varying and Floquet media | Temporal interfaces, modulation, sidebands, synthetic-frequency intuition. | Modulated-cell masks, phase coherence/spread, reduced sideband readouts. | De-embedded multi-port Floquet scattering and isolation spectra are not provided by default. |
| Coupled and non-Hermitian workflows | PT/EP proxies, skin-effect analogues, hybrid source/topology/cavity scenes. | Gain/loss masks, reduced modal proxies, active-region overlap, source/guide/cavity overlap. | Eigenvalue coalescence, non-Bloch theory, and calibrated isolation/transport spectra need external validation. |

## Reviewed WARN Scenes

These 28 scenes are intentionally kept as `WARN`, not because they fail to run, but because their teaching claims must stay bounded.

| Scene | What is valid for teaching | Do not claim without extra work |
| --- | --- | --- |
| `machZehnder` | Split-arm guided layout with mode-profile launch and a phase-shifter section. | Calibrated transfer curve, extinction ratio, or phase sensitivity. |
| `microstrip` | 2D Hz cross-section with PEC strip, substrate, ground plane, and finite excitation. | Quasi-TEM impedance, dispersion, or S-parameters of a real microstrip. |
| `purcell2d` | Dipole/cavity interaction with live Q/Aeff proxy. | Absolute 3D Purcell factor or emitter lifetime. |
| `hyperbolicMedium` | Reduced Drude tensor route for hyperbolic-medium intuition. | Broadband causal hyperbolic material evidence. |
| `chiralMedium` | Six-field chiral route and cross-coupled fields. | Calibrated optical rotation or chiral S-parameters. |
| `gyrotropicMedium` | Gyrotropic material masks and non-scalar update route. | Faraday rotation or nonreciprocal isolation. |
| `phcPointDefect` | Point-defect geometry and localized-field intuition. | Eigenfrequency/Q or mode-volume convergence. |
| `phcOptimizedCavity` | Optimized-looking cavity geometry and field localization. | Reproduced optimization objective or global optimum. |
| `phcDarkMode` | Symmetry-dark-mode concept and source-symmetry intuition. | Quantitative radiation suppression. |
| `symmetryProtectedBic` | Symmetry-protected BIC analogue. | Diverging-Q scaling or eigenmode proof. |
| `nonHermitianSsh` | Non-Hermitian SSH flags and gain/loss route. | Biorthogonal eigenmodes or non-Hermitian topological invariant. |
| `topologicalPumping` | Modulated Thouless-pump-like transport intuition. | Quantized adiabatic pumping. |
| `sppGrating` | Real Drude grating geometry and surface localization. | De-embedded grating-coupler efficiency. |
| `superlensSlab` | Drude slab and reduced image-transfer intuition. | Calibrated evanescent transfer function. |
| `hyperlens` | Scalar 2D Hz hyperlens transfer trend. | Full cylindrical 3D hyperlens resolution. |
| `spmKerrPulse` | Kerr active-region overlap and qualitative SPM sidebands. | Nonlinear phase shift or calibrated spectrum. |
| `kerrBistableCavity` | Kerr cavity workflow. | Hysteresis branches or switching thresholds. |
| `saturableAbsorber` | Saturable-loss material route. | Transmission-vs-intensity curve. |
| `allOpticalSwitch` | Active guide/switching layout and overlap. | Extinction ratio or switching energy. |
| `nonlinearLimiter` | Limiter material route and active overlap. | Limiter threshold or dynamic range. |
| `temporalIsolator` | Traveling-modulation isolator analogue and sideband intuition. | Calibrated reverse/forward isolation spectrum. |
| `syntheticFrequency` | Sideband ladder / synthetic-frequency concept. | Quantitative frequency-lattice Hamiltonian. |
| `exceptionalPointCoupler` | PT-coupler EP proxy and reduced coalescence estimate. | Rigorous exceptional-point topology. |
| `nonHermitianSkin` | Active/lossy skin-effect analogue. | Non-Bloch eigenmode validation. |
| `janusTopologicalGuide` | Directional source coupled to structured guide. | Protected topological transport. |
| `huygensCavity` | Huygens source/cavity workflow. | Optimized Purcell, beta-factor, or far-field metrics. |
| `nonreciprocalValleyHall` | Hybrid nonreciprocal/Valley-Hall guide concept. | Nonreciprocal topological S-parameters. |
| `spaceTimeCrystal` | Spatiotemporal modulation and sideband concept. | Full space-time band structure. |

## High-Impact Upgrade Path

1. Add de-embedded port normalization for interface and guided-device transmission.
2. Add grid-refinement presets for the P0 and highest-use P1 teaching scenes.
3. Add analytic or independent references for the main proxy families: transfer-matrix multilayers, mode-solver waveguides, Mie cylinder scattering, photonic-crystal band diagrams, nonlinear transfer curves, and Floquet S-parameters.
4. Keep proxy labels visible in teaching material until those references exist.
