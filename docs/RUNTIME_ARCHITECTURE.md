# Runtime Architecture

`src/` contains the active browser assets for the simulator. Vite builds the typed React entry while the validated numerical app continues through `src/runtime/` during the migration. Reference modules used by validators live under `tests/reference-modules/`.

## Goals

- Keep the current simulator stable while improving JavaScript modules in controlled layers.
- Use React for UI ownership and Vite/TypeScript for the build and type boundary.
- Keep the animation loop, canvas renderer, WASM bridge, and field arrays outside React rendering.
- Separate numerical model, canvas rendering, UI, and app orchestration.
- Make dependencies explicit instead of relying on ambient globals.
- Keep functions pure when they only format, normalize, validate, or transform data.

## Directory Shape

```text
src/
  data/
    scene-catalog-loader.ts
  ui/
    visual-layer-model.ts
  legacy-runtime.json
  main.tsx
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

1. `src/main.tsx` owns migrated React UI; `src/runtime/` remains the stable simulation implementation until parity migration is complete.
2. Each runtime file owns one clear responsibility and exposes its public API through explicit `window.Fdtd...` globals.
3. Do not duplicate active files wholesale. Reference modules belong in `tests/reference-modules/` and must be covered by `validate-runtime-core.mjs`.
4. Keep legacy load order explicit in `legacy-runtime.json` until a layer is converted to typed ES modules.
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

- Vite and TypeScript are the canonical build path.
- React owns the migrated brand and footer islands; subsequent UI regions move only with browser parity coverage.
- The scene-catalog loader and visual-layer state model are TypeScript.
- `main.tsx` loads the remaining classic scripts sequentially from `legacy-runtime.json`.
- `src/runtime/` remains the canonical numerical and interaction runtime during the transition.
- Reference modules with comparison coverage:
  - `tests/reference-modules/core/contracts.js`
  - `tests/reference-modules/core/state.js`
  - `tests/reference-modules/core/formatters.js`
  - `tests/reference-modules/core/scene-codec.js`
  - `tests/reference-modules/core/state-normalizer.js`
  - `tests/reference-modules/ui/core.js`
  - `tests/reference-modules/canvas/viewport.js`

## Runtime Ownership

- `src/runtime/` temporarily preserves explicit public globals required by the ordered classic-script app.
- `tests/reference-modules/` uses `window.FdtdNext` for parity modules only; it is not the namespace of the deployed runtime.
- New runtime changes should keep dependency checks local and update `runtime-dependencies.js` when a new controller module is required before `main.js`.
- The simulator advances on the main browser runtime, using the C++/WASM backend when the active material/source configuration supports it.
