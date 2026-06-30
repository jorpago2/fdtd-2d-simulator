# js-next

This folder is the next JavaScript architecture for the FDTD simulator. The active browser path now runs through `js-next/runtime/`, while cleaner modules are prepared in the domain folders.

## Rules

- Keep modules small and domain-focused.
- Register modules under `window.FdtdNext`.
- Use explicit dependency checks at module boundaries.
- Keep pure data/formatting logic away from DOM code.
- Keep UI code away from FDTD stepping and numerical kernels.
- Do not add frameworks or a build system.

## Proposed Layers

```text
core/        State, units, contracts, formatters, scene JSON.
simulation/  FDTD state, kernels, materials, sources, diagnostics, workers.
canvas/      Viewport, renderer, overlays, colorbar, pointer interactions.
ui/          DOM collection, controls, drawer, scene/results panels.
app/         Bootstrap and top-level orchestration.
```

## Load Pattern

For now these are classic browser scripts, not ES modules, so they remain compatible with the current validator and deployment model. A future switch to `type="module"` should be made only when the whole app is ready for that migration.

## Active Runtime

`index.html` loads `js-next/runtime/` as the active application path. That folder is a compatibility cutover from the former `src/` and root `app.js` stack, grouped by responsibility so the old active path is no longer mixed into the page.

## Validated Blocks

- `core/`: contracts, initial state, imported-state normalization, formatters, and scene snapshots.
- `ui/core.js`: shared button, panel, and accessibility state helpers.
- `canvas/viewport.js`: grid-to-canvas viewport math and installable simulation viewport methods.
