# Project Map

Use this map to find the canonical files for UI, runtime, simulation, and validation changes.

## One-Minute Rule

- New UI/CSS work goes in `src/styles/fdtd-ui.css`.
- The active app loads one stylesheet only: `src/styles/fdtd-ui.css`.
- Active JavaScript loads from `src/runtime/`.
- Reference modules used by validators live in `tests/reference-modules/`; they are not browser load path.

## Active CSS Ownership

| File | Current role | Add new rules here? |
| --- | --- | --- |
| `src/styles/fdtd-ui.css` | Canonical UI layer: tokens, canvas shell, drawer, buttons, menu panels, shared cards, context menus, Visual controls, responsive rules. | Yes. |

No historical CSS bundle is part of the active repository path. Keep the app on the single canonical stylesheet unless a deliberate architecture change is made.

## Active JavaScript Ownership

`index.html` loads `src/runtime/` as the active runtime. The files are grouped by responsibility while preserving explicit script ordering and browser globals.

| Group | Active path | Purpose |
| --- | --- | --- |
| Core/data | `src/runtime/core`, `src/runtime/data` | Constants, numerics, catalog, colormaps, state, formatters, scene import/export. |
| Simulation | `src/runtime/simulation` | FDTD state, Yee stepping, materials, sources, CPML, diagnostics, and JS/WASM backend routing. |
| Canvas | `src/runtime/canvas` | Viewport, rendering overlays, colorbar, PNG export, gestures, drag, and context menus. |
| UI/controllers | `src/runtime/ui` | Drawer, scenes, results, controls, material/source/monitor editors, operations and bindings. |
| App orchestration | `src/runtime/app` | Bootstrap, runtime loop, layout, performance instrumentation and main wiring. |

## Where To Change Common Things

| Task | Start here |
| --- | --- |
| Button/toggle/menu visual issue | `src/styles/fdtd-ui.css` |
| Drawer open/close or selected menu section | `src/runtime/ui/ui-drawer.js` |
| Scene list, filters, educational guide text | `src/runtime/ui/ui-scenes.js`, `src/runtime/ui/ui-scene-guide.js`, `src/runtime/data/catalog.js` |
| Scene JSON export/import/share behavior | `src/runtime/app/scene-state-controller.js`, `src/runtime/core/scene-codec.js`, `src/runtime/core/scene-application.js`, `src/runtime/core/scene-repro.js` |
| Results panel display | `src/runtime/ui/ui-results.js`, `src/runtime/ui/results-control-bindings.js` |
| Sweep analysis, charts, and CSV | `src/runtime/simulation/sweep-analysis-controller.js`, `src/runtime/ui/ui-results-charts.js` |
| Metric calculation | `src/runtime/simulation/fdtd-analysis-observables.js`, `src/runtime/simulation/fdtd-line-diagnostics.js`, `src/runtime/simulation/fdtd-diagnostics.js` |
| Custom monitor geometry or measurement | `src/runtime/simulation/fdtd-custom-monitors.js`, `src/runtime/canvas/canvas-monitor-overlays.js`, `src/runtime/ui/source-monitor-control-bindings.js` |
| Canvas paint or brush geometry insertion | `src/runtime/canvas/canvas-edit-actions-controller.js`, `src/runtime/canvas/canvas-interactions.js` |
| Canvas keyboard, pinch/pan, touch, or drag behavior | `src/runtime/canvas/canvas-gesture-actions-controller.js`, `src/runtime/canvas/canvas-interactions.js`, `src/runtime/canvas/canvas-pointer-state.js`, `src/runtime/canvas/canvas-drag-state.js` |
| Canvas layer stack | `index.html`, `src/styles/fdtd-ui.css`, `src/runtime/canvas/canvas-viewport.js`, `src/runtime/canvas/canvas-export.js` manage the visible WebGL field layer, optional 3D surface layer, and transparent 2D interaction/overlay layer. |
| Source editor or source behavior | `src/runtime/ui/source-monitor-editor-controller.js`, `src/runtime/ui/source-monitor-model.js`, `src/runtime/ui/source-monitor-control-bindings.js`, `src/runtime/simulation/fdtd-sources.js` |
| Material selection/apply/delete operations | `src/runtime/ui/material-operations.js` |
| Brush/material editor controls | `src/runtime/ui/brush-controls-controller.js`, `src/runtime/ui/material-editor-model.js`, `src/runtime/ui/material-editor-ui.js` |
| Wavelength, grid, preset, boundary, material-editor, or brush action handlers | `src/runtime/ui/config-material-handlers-controller.js`, `src/runtime/ui/config-control-bindings.js`, `src/runtime/ui/material-control-bindings.js`, `src/runtime/ui/brush-control-bindings.js` |
| Cross-panel text/control synchronization | `src/runtime/app/control-text-controller.js` |
| App defaults or UI text formatting | `src/runtime/core/app-state.js`, `src/runtime/core/app-formatters.js` |
| Canvas labels, scale, axes, k-vector | `src/runtime/canvas/canvas-reference-overlays.js` |
| 2D/3D field rendering | `src/runtime/simulation/fdtd-rendering.js`, `src/runtime/canvas/canvas-field-webgl-renderer.js`, `src/runtime/canvas/canvas-surface-three-renderer.js` |
| Colorbar or PNG export | `src/runtime/canvas/canvas-colorbar.js`, `src/runtime/canvas/canvas-export.js` |
| Grid, CFL, default resolution | `src/runtime/core/constants.js`, `src/runtime/simulation/fdtd-sim.js`, `src/runtime/ui/config-control-bindings.js` |
| Material warnings and numerical health text | `src/runtime/ui/material-stability-controller.js` |
| Responsive canvas/layout behavior | `src/runtime/app/app-layout.js` |
| Performance panel/timing instrumentation | `src/runtime/app/app-performance.js` |

## Maintenance Direction

- Keep `src/runtime/` as the canonical browser path.
- Keep `src/` limited to `runtime/`, `styles/`, and its README so public repository structure stays unambiguous.
- Refactor one block at a time: core/data, UI, canvas, simulation, WASM routing, then orchestration.
- Remove inactive code when a replacement is validated, rather than keeping a second source of truth.
- Validate with `npm run validate:static` after each replacement block.
