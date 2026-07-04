# Runtime Architecture

`src/` contains the active browser assets for the simulator. The active app loads through `src/runtime/`; reference modules used by validators live under `tests/reference-modules/` so they are not confused with a second runtime.

## Goals

- Keep the current simulator stable while improving JavaScript modules in controlled layers.
- Avoid adding frameworks, bundlers, package managers, or build steps.
- Separate numerical model, canvas rendering, UI, and app orchestration.
- Make dependencies explicit instead of relying on ambient globals.
- Keep functions pure when they only format, normalize, validate, or transform data.

## Directory Shape

```text
src/
  runtime/
    app/
    canvas/
    core/
    data/
    simulation/
    ui/
  styles/
    fdtd-ui.css
  README.md
tests/
  reference-modules/
    core/
    canvas/
    ui/
```

## Refactor Rules

1. `src/runtime/` is the active, stable browser implementation.
2. Each runtime file owns one clear responsibility and exposes it under `window.FdtdNext`.
3. Do not duplicate active files wholesale. Reference modules belong in `tests/reference-modules/` and must be covered by `validate-runtime-core.mjs`.
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

- `src/runtime/` is the canonical browser runtime.
- `index.html` now loads the active simulator from `src/runtime/`.
- Reference modules with comparison coverage:
  - `tests/reference-modules/core/contracts.js`
  - `tests/reference-modules/core/state.js`
  - `tests/reference-modules/core/formatters.js`
  - `tests/reference-modules/core/scene-codec.js`
  - `tests/reference-modules/core/state-normalizer.js`
  - `tests/reference-modules/ui/core.js`
  - `tests/reference-modules/canvas/viewport.js`

## Runtime Ownership

- `src/runtime/` preserves explicit public globals required by the ordered classic-script app.
- New runtime changes should keep dependency checks local and update `runtime-dependencies.js` when a new controller module is required before `main.js`.
- The simulator advances on the main browser runtime, using the C++/WASM backend when the active material/source configuration supports it.
