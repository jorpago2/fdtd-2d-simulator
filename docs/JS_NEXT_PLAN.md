# JS Next Plan

`js-next/` is the JavaScript architecture track. The active app now loads through `js-next/runtime/`, while cleaner domain modules replace compatibility files block by block.

## Goals

- Keep the current simulator stable while replacing old JavaScript in controlled layers.
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

## Migration Rules

1. `js-next/runtime/` remains the active, stable implementation until each compatibility file is replaced by a cleaner domain module.
2. Each `js-next` file owns one clear responsibility and exposes it under `window.FdtdNext`.
3. Do not paste old files wholesale. Rebuild small modules from the current behavior, with clearer names and dependency checks.
4. Keep load order explicit. No hidden side effects beyond registering a module on `window.FdtdNext`.
5. After a module is wired into `index.html`, run the project static validator before continuing.
6. When a `src/` file is fully replaced, archive it under `legacy/js/` or delete it only after the replacement is verified.

## First Migration Candidates

1. Core contracts and validators.
2. State defaults and normalization.
3. Formatting helpers.
4. Scene codec and JSON snapshot behavior.
5. DOM collection and UI bindings.
6. Canvas overlays.
7. Canvas interactions.
8. Results and analysis panels.
9. Worker/WASM routing.
10. FDTD kernels and material/source physics.

## Current Status

- `js-next/` exists as a parallel architecture track.
- `index.html` now loads the active simulator from `js-next/runtime/`.
- `legacy/js/src/` plus `legacy/js/app.js` are retained as reference code, but are no longer the active script path.
- `js-next/runtime/manifest.json` records the migration mapping.
- Migrated and validation-compared so far:
  - `core/contracts.js`
  - `core/state.js`
  - `core/formatters.js`
  - `core/scene-codec.js`
  - `core/state-normalizer.js`
  - `ui/core.js`
  - `canvas/viewport.js`

## Runtime Cutover

- `js-next/runtime/` preserves existing public globals so the app remains stable during migration.
- The next cleanup pass should replace runtime compatibility files with the cleaner `js-next` modules block by block.
- The worker now starts from `js-next/runtime/simulation/fdtd-worker.js` and imports dependencies through runtime-relative paths.
