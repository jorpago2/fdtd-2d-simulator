# Codebase Coherence Audit

Date: 2026-07-06

This audit records the current structural state of the simulator and the guardrails that should stay green before larger physics, rendering, or UI changes. It is intentionally focused on maintainability and reproducibility, not on changing simulator behavior.

## Current Status

The project is coherent enough for incremental work: the active browser runtime is under `src/runtime/`, the canonical stylesheet is `src/styles/fdtd-ui.css`, reference modules are isolated under `tests/reference-modules/`, and the validators currently cover the most important architecture boundaries.

The main documentation drift found in this pass was the stale claim that active modules should register under `window.FdtdNext`. The deployed runtime uses explicit `window.Fdtd...` globals; `window.FdtdNext` is reserved for reference modules used by parity validators.

## Architecture Findings

- Active assets are loaded from `src/runtime/` and `src/styles/fdtd-ui.css`; retired active paths are not referenced by `index.html`.
- `runtime-dependencies.js` owns required module checks before `main.js`. If `main.js` cannot run without a new module, add it there instead of introducing local one-off guards.
- `runtime-session-controller.js` owns performance instrumentation and edit-session pause/resume state, keeping the central app file focused on composition.
- Optional controllers can remain optional only when the feature is genuinely optional and the app has a valid fallback when the module is absent.
- `main.js` is below the current hard centrality budget, but still large enough that future orchestration work should extract cohesive clusters instead of growing it further.
- `scripts/browser-smoke.mjs` is useful as a broad regression test, but it is too large to be the only long-term browser test surface.

## FDTD Findings

- The JavaScript and WASM routing is explicit. WASM support should continue to be selected by documented feature capability, not by optimistic dispatch.
- Simulation files mostly avoid DOM APIs. The current allowed DOM-facing exceptions are rendering, canvas integration, and sweep integration modules.
- Physics changes should keep the validation ladder intact: static checks, architecture checks, runtime parity checks, targeted numerical checks, and browser smoke tests.
- Browser snapshots are regression evidence for the educational app, not proof of numerical correctness. New numerical claims still need targeted test cases, convergence checks, or analytical comparisons.
- Large scientific files such as scene observables, presets, and material helpers should be split only by physical responsibility and only when a change naturally touches that area.

## Frontend Findings

- The UI uses one canonical stylesheet and avoids `!important`.
- CSS media queries are centralized enough to maintain the current desktop, tablet, and mobile breakpoints.
- `ui-dom.js` centralizes DOM lookup, which is preferable to scattering selectors through simulation code.
- Context menus, help flows, and responsive panels should keep using existing UI helpers and CSS tokens instead of introducing a second layout style.

## Guardrails Added

- The architecture validator now checks that active-runtime documentation does not drift back to the obsolete `window.FdtdNext` wording.
- The corrected documentation distinguishes deployed runtime globals from reference-module globals.

## Priority Backlog

### P0: Keep Stable

- Keep `validate-static`, `validate-architecture`, runtime parity, and browser smoke checks passing before pushing UI or physics changes.
- Do not change solver behavior while doing architecture cleanup unless the change is covered by a targeted numerical validation.
- Keep `src/` limited to active browser assets: `runtime/`, `styles/`, and `README.md`.

### P1: High-Impact Cleanup

- Continue extracting cohesive orchestration clusters from `main.js` before adding new app-level behavior.
- Split `scripts/browser-smoke.mjs` into smaller scenario modules while keeping one aggregate smoke command.
- Add an explicit policy for optional runtime modules: either promote them to `runtime-dependencies.js` or document their fallback path.

### P2: Future Architecture

- Consider ES modules only as one deliberate migration of the whole app; do not mix module systems casually.
- Add a convergence-study harness for selected canonical examples.
- Split large physics/data files by domain family when the next substantive edit already touches them.

## Acceptance Commands

Run these before considering this audit implemented:

```powershell
node scripts/validate-static.mjs
node scripts/validate-architecture.mjs
node scripts/audit-ui.mjs
node scripts/validate-runtime-core.mjs
node scripts/validate-mode-solver.mjs
node scripts/validate-subpixel-smoothing.mjs
node scripts/build-pages.mjs
node scripts/browser-smoke.mjs
```
