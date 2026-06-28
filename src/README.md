# Source Layout

The browser app still uses classic ordered scripts instead of ES modules. Keep the load order in `index.html` consistent with these dependencies:

1. `constants.js`: shared numerical/UI constants.
2. `wasm-backend.js`: compiled FDTD backend and WASM memory layout.
3. `numerics.js`: pure numerical helpers used by diagnostics and rendering.
4. `colormaps.js`: scientific color maps and color interpolation.
5. `catalog.js`: material names, source shapes, Atlas scene descriptions, and analysis preset sets.
6. `fdtd-sim.js`: the base 2D-FDTD simulation engine, field/view state, reset logic, and field normalization.
7. `fdtd-materials.js`: material state, cell/region editing, conductivity, nonlinear response, phase change, bianisotropy, and ADE dispersion.
8. `fdtd-boundaries.js`: absorbing PML profiles, reflective boundary clearing, boundary hit testing, and boundary material continuation.
9. `fdtd-presets.js`: brush geometry, source placement bounds, Atlas geometry builders, and preset scene assembly.
10. `fdtd-sources.js`: source waveforms, incident-field injection, localized/multipole sources, and current-source coupling.
11. `fdtd-diagnostics.js`: analysis probes, spectra, Bloch/Floquet estimates, monitor DFTs, material diagnostics, and field measurement.
12. `fdtd-yee.js`: one-step FDTD orchestration plus TMz/TEz Yee update kernels.
13. `fdtd-rendering.js`: field/material rendering, surface view, overlays, glyphs, and source hit testing.
14. `../app.js`: UI state, controls, event handlers, sweep orchestration, and app startup.

The active compiled kernel is built from `../wasm-src/fdtd-core.cpp` -> `../fdtd-core.wasm` and includes finite conductivity, Kerr, saturable gain, and TEz tensor/gyrotropy support. The previous hand-maintained reference remains in `../fdtd-core.wat`; see `../docs/PERFORMANCE.md` before changing the WASM build path.

Next safe refactors are smaller: split viewport/canvas coordinate helpers from `fdtd-sim.js`, or move field reset/renormalization into a dedicated field-state module.
