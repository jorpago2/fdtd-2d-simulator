# src

This folder contains only browser assets that are loaded by the simulator.

## Rules

- Keep modules small and domain-focused.
- Keep active runtime dependencies explicit while global contracts are progressively typed.
- Use explicit dependency checks at module boundaries.
- Keep pure data/formatting logic away from DOM code.
- Keep UI code away from FDTD stepping and numerical kernels.
- Move UI ownership into typed React components incrementally.
- Preserve physical behavior and validation coverage while replacing legacy modules.

## Active Layout

```text
core/                Typed runtime state and domain models.
data/                Typed data loaders and contracts.
main.tsx             Typed React bootstrap entry.
runtime-entry.ts     Ordered Vite module graph for the numerical runtime.
ui/                  Typed UI state and view models.
runtime/             Simulation, canvas, controller, and numerical runtime modules.
styles/              Carbon entrypoint and scientific workbench layout processed by Vite.
```

## Load Pattern

Vite builds `main.tsx` and dynamically imports `runtime-entry.ts` after the React shell is mounted. The ordered imports in that entry preserve the validated initialization sequence without script-tag injection or a second asset pipeline.

## Runtime

`index.html` loads only the React/TypeScript entry. Vite bundles the canonical simulation path under `src/runtime/`; the deployed application no longer serves the source runtime directory directly.

When `main.js` depends on a new runtime module, add it to `src/runtime/app/runtime-dependencies.js` instead of adding ad hoc load checks.

Reference modules used only for parity checks live in `tests/reference-modules/`; they are not part of the deployed app. The `window.FdtdNext` namespace is reserved for those reference modules.
