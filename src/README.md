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
main.tsx  Typed React entry for migrated UI regions.
runtime/  Ordered classic-script runtime retained during migration.
styles/   Canonical stylesheet processed by Vite.
```

## Load Pattern

Vite builds `main.tsx`; the numerical runtime remains ordered classic JavaScript until each layer has typed parity coverage. Do not import those files as ES modules before removing their shared global contracts.

## Runtime

`index.html` loads the React entry and `src/runtime/`. The React entry currently owns isolated shell regions while the canonical simulation path remains in `src/runtime/`.

When `main.js` depends on a new runtime module, add it to `src/runtime/app/runtime-dependencies.js` instead of adding ad hoc load checks.

Reference modules used only for parity checks live in `tests/reference-modules/`; they are not part of the deployed app. The `window.FdtdNext` namespace is reserved for those reference modules.
