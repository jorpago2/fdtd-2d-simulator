# src

This folder contains only browser assets that are loaded by the simulator.

## Rules

- Keep modules small and domain-focused.
- Register active runtime modules as explicit `window.Fdtd...` globals.
- Use explicit dependency checks at module boundaries.
- Keep pure data/formatting logic away from DOM code.
- Keep UI code away from FDTD stepping and numerical kernels.
- Move UI ownership into typed React components incrementally.
- Preserve physical behavior and validation coverage while replacing legacy modules.

## Active Layout

```text
data/                Typed data loaders and contracts.
legacy-runtime.json  Temporary ordered inventory of classic scripts.
main.tsx             Typed React and runtime bootstrap entry.
runtime/             Classic simulation/runtime modules retained during migration.
styles/              Canonical stylesheet processed by Vite.
```

## Load Pattern

Vite builds `main.tsx`, which registers typed modules and then loads `legacy-runtime.json` sequentially. The numerical runtime remains classic JavaScript until each layer has typed parity coverage.

## Runtime

`index.html` loads only the React/TypeScript entry. That entry owns isolated shell regions, typed data modules, and the temporary ordered bootstrap for the canonical simulation path in `src/runtime/`.

When `main.js` depends on a new runtime module, add it to `src/runtime/app/runtime-dependencies.js` instead of adding ad hoc load checks.

Reference modules used only for parity checks live in `tests/reference-modules/`; they are not part of the deployed app. The `window.FdtdNext` namespace is reserved for those reference modules.
