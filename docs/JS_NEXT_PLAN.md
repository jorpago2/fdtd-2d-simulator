# JS Next Plan

`js-next/` contains the JavaScript architecture for the simulator. The active app loads through `js-next/runtime/`; domain folders outside `runtime/` hold small extracted helpers and architecture notes.

## Goals

- Keep the current simulator stable while improving JavaScript modules in controlled layers.
- Avoid adding frameworks, bundlers, package managers, or build steps.
- Separate numerical model, canvas rendering, UI, and app orchestration.
- Make dependencies explicit instead of relying on ambient globals.
- Keep functions pure when they only format, normalize, validate, or transform data.

## Directory Shape

```text
js-next/
  core/
    contracts.js
    state.js
    formatters.js
    scene-codec.js
  simulation/
  canvas/
  ui/
  app/
  README.md
```

## Refactor Rules

1. `js-next/runtime/` is the active, stable browser implementation.
2. Each `js-next` file owns one clear responsibility and exposes it under `window.FdtdNext`.
3. Do not duplicate active files wholesale. Rebuild small modules from the current behavior, with clearer names and dependency checks.
4. Keep load order explicit. No hidden side effects beyond registering a module on `window.FdtdNext`.
5. After a module is wired into `index.html`, run the project static validator before continuing.
6. Delete inactive code after the replacement is verified.

## Refactor Candidates

1. Core contracts and validators.
2. State defaults and normalization.
3. Formatting helpers.
4. Scene codec and JSON snapshot behavior.
5. DOM collection and UI bindings.
6. Canvas overlays.
7. Canvas interactions.
8. Results and analysis panels.
9. WASM routing.
10. FDTD kernels and material/source physics.

## Current Status

- `js-next/runtime/` is the canonical browser runtime.
- `index.html` now loads the active simulator from `js-next/runtime/`.
- Extracted helper modules with comparison coverage:
  - `core/contracts.js`
  - `core/state.js`
  - `core/formatters.js`
  - `core/scene-codec.js`
  - `core/state-normalizer.js`
  - `ui/core.js`
  - `canvas/viewport.js`

## Runtime Ownership

- `js-next/runtime/` preserves explicit public globals required by the ordered classic-script app.
- New runtime changes should keep dependency checks local and update `runtime-dependencies.js` when a new controller module is required before `main.js`.
- The simulator advances on the main browser runtime, using the C++/WASM backend when the active material/source configuration supports it.
