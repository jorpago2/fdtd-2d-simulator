# Source Layout

The browser app still uses classic ordered scripts instead of ES modules. Keep the load order in `index.html` consistent with these dependencies:

1. `constants.js`: shared numerical/UI constants.
2. `wasm-backend.js`: compiled FDTD backend and WASM memory layout.
3. `numerics.js`: pure numerical helpers used by diagnostics and rendering.
4. `colormaps.js`: scientific color maps and color interpolation.
5. `catalog.js`: material names, source shapes, Atlas scene descriptions, and analysis preset sets.
6. `fdtd-sim.js`: the base 2D-FDTD simulation shell, resize lifecycle, and grid indexing.
7. `fdtd-array-state.js`: typed-array allocation, auxiliary dynamic-material arrays, and JS-to-WASM array migration snapshots.
8. `fdtd-engine-routing.js`: WASM backend attachment, compiled-path eligibility, dynamic-material routing, and engine labels.
9. `canvas-viewport.js`: canvas pixel sizing, view camera, grid/client coordinate conversion, zoom, pan, and viewport aspect preservation.
10. `fdtd-field-state.js`: field reset, physical field scale, divergence recovery, and renormalization.
11. `fdtd-materials.js`: material state, cell/region editing, conductivity, nonlinear response, phase change, bianisotropy, and ADE dispersion.
12. `fdtd-field-observables.js`: field, Poynting vector, magnitude, scale, and transverse-vector observables shared by rendering and diagnostics.
13. `fdtd-boundaries.js`: absorbing PML profiles, reflective boundary clearing, boundary hit testing, and boundary material continuation.
14. `fdtd-presets.js`: brush geometry, source placement bounds, Atlas geometry builders, and preset scene assembly.
15. `fdtd-sources.js`: source waveforms, incident-field injection, localized/multipole sources, and current-source coupling.
16. `fdtd-analysis-sampling.js`: analysis buffers, contour sampling, probe/energy series, EWMA observables, and deferred analysis updates.
17. `fdtd-custom-monitors.js`: arbitrary monitor geometry, line sampling, per-monitor field/flux measurements, and monitor result batches.
18. `fdtd-line-diagnostics.js`: fixed L/R monitor placement, directional wave separation, R/T power estimates, and port DFT/Floquet line diagnostics.
19. `fdtd-analysis-observables.js`: ordered analysis traces, probe spectra, ringdown/Q estimates, probe Floquet fallback, and NTFF/scattering far-field patterns.
20. `fdtd-material-diagnostics.js`: dispersive effective epsilon/mu, tensor conditioning, negative-index, and superlens metrics.
21. `fdtd-diagnostics.js`: specialized scene metrics, global field measurement, and diagnostics orchestration.
22. `fdtd-yee.js`: one-step FDTD orchestration plus TMz/TEz Yee update kernels.
23. `fdtd-rendering.js`: field/material rendering, surface view, and field quiver rendering.
24. `canvas-reference-overlays.js`: reference overlays and shared overlay drawing primitives such as scale bar, axes, k-vector, labels, and arrows.
25. `canvas-source-overlays.js`: source glyphs, source selection/hover overlays, and source hit testing.
26. `canvas-monitor-overlays.js`: diagnostic line monitor overlays, custom monitor overlays, and monitor hit testing.
27. `canvas-material-overlays.js`: material region selection and hover overlays.
28. `canvas-boundary-overlays.js`: PML and reflective boundary overlays.
29. `canvas-colorbar.js` and `canvas-export.js`: colorbar state plus PNG export composition.
30. `canvas-edit-actions-controller.js`: canvas paint and brush-geometry insertion actions used by pointer interactions.
31. `canvas-gesture-actions-controller.js`: keyboard view controls, pinch/pan, touch promotion, and source/monitor/material drag actions.
32. `fdtd-worker-protocol.js`, `fdtd-worker.js`, and `worker-engine.js`: optional headless Worker stepping route for continuous Play.
33. `app-state.js`: initial UI/simulation state defaults and theme/depth normalization.
34. `app-formatters.js`: field labels, source labels, lambda/scale formatting, and compact UI text helpers.
35. `source-monitor-operations.js`: source and custom monitor creation, normalization, selection, deletion, and bounds contexts.
36. `material-operations.js`: material-region selection, deletion, and material-kind application operations.
37. `app-bootstrap.js`: final startup sequence that binds layout controls, restores shared state, measures, renders, and starts the runtime loop.
38. `app-layout.js`: responsive grid orientation, canvas aspect sizing, range-progress styling, and compact viewport queries.
39. `app-performance.js`: performance EWMA state, simulation instrumentation, timing formatting, and runtime-panel updates.
40. `sweep-analysis-controller.js`: sweep modes, analysis chart updates, steady-state estimates, Bloch-k sweeps, and sweep CSV export.
41. `material-stability-controller.js`: material warnings, numerical health labels, CFL notes, and stability summary text.
42. `source-monitor-editor-controller.js`: source/monitor editor form population, labels, validation sync, and live draft updates.
43. `brush-controls-controller.js`: brush/material editor visibility, geometry-control enablement, and brush-menu status text.
44. `inspector-controller.js`: selected source/monitor/material/scene inspector text and material-region summary metrics.
45. `control-text-controller.js`: top-level UI text/control synchronization across runtime, scene, visual, brush, config, and analysis panels.
46. `scene-state-controller.js`: scene snapshot/export/import helpers, share status text, preset lookup, and imported source/monitor sanitization.
47. `config-material-handlers-controller.js`: wavelength/grid/preset/boundary/material-editor/brush action handlers shared by Config, Material, and Brush bindings.
48. `../app.js`: remaining orchestration glue, controllers, thin handler adapters, and app startup wiring.

The active compiled kernel is built from `../wasm-src/fdtd-core.cpp` -> `../fdtd-core.wasm` and includes finite conductivity, Kerr, saturable gain, and TEz tensor/gyrotropy support. The previous hand-maintained reference remains in `../fdtd-core.wat`; see `../docs/PERFORMANCE.md` before changing the WASM build path.

Next safe refactors are smaller: move more remaining `app.js` orchestration into explicit modules, especially canvas interaction glue and context-menu callbacks.
