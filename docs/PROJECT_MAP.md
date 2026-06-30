# Project Map

This project is in a refactor-in-progress state. Use this map to avoid editing the wrong file.

## One-Minute Rule

- New UI/CSS work goes in `fdtd-ui.css`.
- The active app loads one stylesheet only: `fdtd-ui.css`.
- Active JavaScript now loads from `js-next/runtime/`.
- `legacy/js/src/` and `legacy/js/app.js` retain the old code as reference material, not as the active browser path.
- The cleaner long-term modules live in `js-next/core`, `js-next/ui`, `js-next/canvas`, `js-next/simulation`, and `js-next/app`.

## Active CSS Ownership

| File | Current role | Add new rules here? |
| --- | --- | --- |
| `fdtd-ui.css` | Canonical UI layer: tokens, canvas shell, drawer, buttons, menu panels, shared cards, context menus, Visual controls, responsive rules. | Yes. |

Historical CSS files are archived under `legacy/css/`. They are kept only as reference material and are not loaded by the app.

## Active JavaScript Ownership

`index.html` loads `js-next/runtime/` as the active compatibility runtime. The files are grouped by responsibility while preserving the existing public globals during the migration.

| Group | Active path | Purpose |
| --- | --- | --- |
| Core/data | `js-next/runtime/core`, `js-next/runtime/data` | Constants, numerics, catalog, colormaps, state, formatters, scene import/export. |
| Simulation | `js-next/runtime/simulation` | FDTD state, Yee stepping, materials, sources, PML, diagnostics, worker and WASM route. |
| Canvas | `js-next/runtime/canvas` | Viewport, rendering overlays, colorbar, PNG export, gestures, drag, context menus and inspector. |
| UI/controllers | `js-next/runtime/ui` | Drawer, scenes, results, controls, material/source/monitor editors, operations and bindings. |
| App orchestration | `js-next/runtime/app` | Bootstrap, runtime loop, layout, performance instrumentation and main wiring. |

`js-next/runtime/manifest.json` records the source-to-runtime mapping used for the cutover.

## Where To Change Common Things

| Task | Start here |
| --- | --- |
| Button/toggle/menu visual issue | `fdtd-ui.css` |
| Drawer open/close or selected menu section | `js-next/runtime/ui/ui-drawer.js` |
| Scene list, filters, educational guide text | `js-next/runtime/ui/ui-scenes.js`, `js-next/runtime/ui/ui-scene-guide.js`, `js-next/runtime/data/catalog.js` |
| Scene JSON export/import/share behavior | `js-next/runtime/app/scene-state-controller.js`, `js-next/runtime/core/scene-codec.js`, `js-next/runtime/core/scene-application.js`, `js-next/runtime/core/scene-repro.js` |
| Results panel display | `js-next/runtime/ui/ui-results.js`, `js-next/runtime/ui/results-control-bindings.js` |
| Sweep analysis, charts, and CSV | `js-next/runtime/simulation/sweep-analysis-controller.js`, `js-next/runtime/ui/ui-results-charts.js` |
| Metric calculation | `js-next/runtime/simulation/fdtd-analysis-observables.js`, `js-next/runtime/simulation/fdtd-line-diagnostics.js`, `js-next/runtime/simulation/fdtd-diagnostics.js` |
| Custom monitor geometry or measurement | `js-next/runtime/simulation/fdtd-custom-monitors.js`, `js-next/runtime/canvas/canvas-monitor-overlays.js`, `js-next/runtime/ui/source-monitor-control-bindings.js` |
| Canvas paint or brush geometry insertion | `js-next/runtime/canvas/canvas-edit-actions-controller.js`, `js-next/runtime/canvas/canvas-interactions.js` |
| Canvas keyboard, pinch/pan, touch, or drag behavior | `js-next/runtime/canvas/canvas-gesture-actions-controller.js`, `js-next/runtime/canvas/canvas-interactions.js`, `js-next/runtime/canvas/canvas-pointer-state.js`, `js-next/runtime/canvas/canvas-drag-state.js` |
| Source editor or source behavior | `js-next/runtime/ui/source-monitor-editor-controller.js`, `js-next/runtime/ui/source-monitor-model.js`, `js-next/runtime/ui/source-monitor-control-bindings.js`, `js-next/runtime/simulation/fdtd-sources.js` |
| Material selection/apply/delete operations | `js-next/runtime/ui/material-operations.js` |
| Brush/material editor controls | `js-next/runtime/ui/brush-controls-controller.js`, `js-next/runtime/ui/material-editor-model.js`, `js-next/runtime/ui/material-editor-ui.js` |
| Wavelength, grid, preset, boundary, material-editor, or brush action handlers | `js-next/runtime/ui/config-material-handlers-controller.js`, `js-next/runtime/ui/config-control-bindings.js`, `js-next/runtime/ui/material-control-bindings.js`, `js-next/runtime/ui/brush-control-bindings.js` |
| Selection inspector text | `js-next/runtime/canvas/inspector-controller.js` |
| Cross-panel text/control synchronization | `js-next/runtime/app/control-text-controller.js` |
| App defaults or UI text formatting | `js-next/runtime/core/app-state.js`, `js-next/runtime/core/app-formatters.js` |
| Canvas labels, scale, axes, k-vector | `js-next/runtime/canvas/canvas-reference-overlays.js` |
| Colorbar or PNG export | `js-next/runtime/canvas/canvas-colorbar.js`, `js-next/runtime/canvas/canvas-export.js` |
| Grid, CFL, default resolution | `js-next/runtime/core/constants.js`, `js-next/runtime/simulation/fdtd-sim.js`, `js-next/runtime/ui/config-control-bindings.js` |
| Material warnings and numerical health text | `js-next/runtime/ui/material-stability-controller.js` |
| Responsive canvas/layout behavior | `js-next/runtime/app/app-layout.js` |
| Performance panel/timing instrumentation | `js-next/runtime/app/app-performance.js` |

## Refactor Direction

- Keep `js-next/runtime/` stable until a cleaner module is ready to replace a compatibility file.
- Replace one block at a time: core/data, UI, canvas, simulation, worker/WASM, then orchestration.
- After a compatibility file is fully replaced, delete the corresponding legacy reference file from `legacy/js/` in a separate cleanup pass.
- Validate with `npm run validate:static` after each replacement block.
