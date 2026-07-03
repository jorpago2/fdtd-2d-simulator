# js-next

This folder contains the JavaScript architecture for the FDTD simulator. The active browser path runs through `js-next/runtime/`, while domain folders hold small extracted helpers and architecture notes.

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
simulation/  FDTD state, kernels, materials, sources, diagnostics.
canvas/      Viewport, renderer, overlays, colorbar, pointer interactions.
ui/          DOM collection, controls, drawer, scene/results panels.
app/         Bootstrap and top-level orchestration.
```

## Load Pattern

These are classic browser scripts, not ES modules, so they remain compatible with the current validator and deployment model. A future switch to `type="module"` should be made only if the whole app changes together.

## Active Runtime

`index.html` loads `js-next/runtime/` as the active application path. That folder is grouped by responsibility and is the canonical runtime used by the page.

## Validated Blocks

- `core/`: contracts, initial state, imported-state normalization, formatters, and scene snapshots.
- `ui/core.js`: shared button, panel, and accessibility state helpers.
- `canvas/viewport.js`: grid-to-canvas viewport math and installable simulation viewport methods.
