# src

This folder contains only browser assets that are loaded by the simulator.

## Rules

- Keep modules small and domain-focused.
- Register active runtime modules as explicit `window.Fdtd...` globals.
- Use explicit dependency checks at module boundaries.
- Keep pure data/formatting logic away from DOM code.
- Keep UI code away from FDTD stepping and numerical kernels.
- Do not add frameworks or a build system.

## Active Layout

```text
runtime/  Ordered classic-script JavaScript loaded by index.html.
styles/   Canonical stylesheet loaded by index.html.
```

## Load Pattern

These are classic browser scripts, not ES modules, so they remain compatible with the current validator and deployment model. A future switch to `type="module"` should be made only if the whole app changes together.

## Runtime

`index.html` loads `src/runtime/` as the active application path. That folder is grouped by responsibility and is the canonical runtime used by the page.

When `main.js` depends on a new runtime module, add it to `src/runtime/app/runtime-dependencies.js` instead of adding ad hoc load checks.

Reference modules used only for parity checks live in `tests/reference-modules/`; they are not part of the deployed app. The `window.FdtdNext` namespace is reserved for those reference modules.
