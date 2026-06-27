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

```powershell
npm install
npx playwright install chromium
npm run test:browser
```

Runs `scripts/browser-smoke.mjs`. It starts a local static server, opens Chromium, loads P0 validation scenes, advances the simulation for a few steps, checks for non-finite UI values, checks active media labels where relevant, and reports an approximate `msPerStep`.

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
| `pml_reflection` | `pmlAbsorption` | Absorbing-boundary residual/reflection check. |
| `slab_waveguide_confinement` | `slabWaveguide` | Integrated-photonics guided-mode workflow. |
| `resonator_ringdown_q` | `qRingdown` | Ringdown analysis and Q proxy. |
| `advanced_material_smoke` | `drudeMetal` | ADE/dispersive material state arrays. |

P1 entries document known quantitative gaps, including negative-index/superlens validation and calibrated six-field bianisotropy validation.

## Interpretation

`PASS` means the configured checks are satisfied.

`WARN` means the project is runnable, but a maintenance issue should be reviewed.

`BLOCK` means the result should not be trusted until the blocker is fixed.

For research-grade use, browser smoke checks are not enough. Use the matrix as a starting point for:

- Grid refinement, for example 12, 20, and 32 cells per lambda0.
- Longer runs to reduce transient contamination.
- Power-balance checks, especially for interfaces, PML, gain/loss, and dispersive media.
- Analytical or independent numerical references where available.

## Current Limitations

- The browser smoke test is intentionally short; it is a regression guard, not a full physical proof.
- Some Atlas scenes are qualitative demonstrations by design.
- Quantitative Floquet, BIC, chiral/bianisotropic, hyperlens, negative-index, and nonlinear transfer validations still need calibrated references and convergence workflows.
- `test:browser` depends on Playwright and a local Chromium install. `npm test` has no external runtime dependency beyond Node.
