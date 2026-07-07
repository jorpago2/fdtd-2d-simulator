# 2D FDTD Browser Simulator

Browser-based 2D finite-difference time-domain simulator for teaching,
exploratory photonics, and regression-tested electromagnetic examples.

The project is intentionally static: `index.html` loads ordered browser scripts
from `src/runtime/` and one stylesheet from `src/styles/fdtd-ui.css`. There is
no application bundler in the runtime path. A local HTTP server is enough to run
the app.

## What It Does

- Runs explicit 2D Yee FDTD scenes in the browser.
- Provides CPML-style absorbing boundaries and CFL checks.
- Supports qualitative and semi-quantitative Atlas scenes for propagation,
  interfaces, diffraction, guided optics, resonators, scattering, dispersive
  media, nonlinear media, temporal modulation, and selected topological or
  non-Hermitian analogues.
- Includes source, material, monitor, sweep, reproducibility, and export tools.
- Uses JavaScript and WebAssembly simulation paths where available.
- Tracks validation through executable static, browser, and physics checks.

## Quick Start

Requirements:

- Node.js available on `PATH`.
- A modern browser.

Run the local static server:

```powershell
npm run serve
```

Open:

```text
http://127.0.0.1:8768/index.html
```

`npm install` is only needed for Playwright-based browser tests and benchmarks.

## Validation

Use the shortest check that matches the change.

| Purpose | Command |
| --- | --- |
| Static script, HTML, scene, CFL, and JS/WASM consistency | `npm test` |
| Architecture guardrails | `npm run validate:architecture` |
| Fast browser smoke checks | `npm install; npx playwright install chromium; npm run test:browser` |
| Quantitative browser physics checks | `npm run test:browser:physics` |
| Full browser-executable physics matrix | `npm run test:browser:physics:all` |
| UI audit | `npm run validate:ui` |
| Performance benchmark | `npm run benchmark` |

Validation sources:

- `scripts/validation-matrix.json`: case matrix and acceptance criteria.
- `docs/VALIDATION.md`: validation protocol and interpretation.
- `docs/SCENE_AUDIT.md`: scene contract audit.

## Numerical Scope

This is a 2D educational and exploratory simulator, not a replacement for a
calibrated 3D full-wave workflow.

Important assumptions:

- Explicit 2D Yee update with fixed Courant number.
- CFL condition checked against `S < 1 / sqrt(2)`.
- CPML-style layers use graded sigma, kappa, alpha, and recursive memory terms.
- Many advanced scenes are reduced 2D analogues of 3D physics.
- Browser smoke tests are regression checks, not physical proof.

For publication-grade use, add at minimum:

- Grid refinement, for example 12, 20, and 32 cells per wavelength.
- Longer runs to reduce transient contamination.
- Power-balance checks for interfaces, gain/loss, CPML, and dispersive media.
- Analytical references or independent numerical comparisons.
- Documented monitor positions, source definitions, and sweep settings.

## Project Layout

| Path | Role |
| --- | --- |
| `index.html` | Static app shell and ordered script list. |
| `src/runtime/` | Active browser runtime: core data, simulation, canvas, UI, and orchestration. |
| `src/styles/fdtd-ui.css` | Canonical stylesheet. |
| `assets/wasm/` | Compiled WebAssembly backend artifacts. |
| `assets/scene-thumbnails/` | Scene browser thumbnails. |
| `native/fdtd-core/` | C++ source for the WASM backend. |
| `scripts/` | Static validation, browser tests, audits, benchmarks, and deployment helpers. |
| `tests/reference-modules/` | Reference modules used by validators, not by the browser runtime. |
| `docs/` | Validation protocol, project map, and scene audit documentation. |

See `docs/PROJECT_MAP.md` before moving runtime, UI, simulation, or validation
ownership. It is the canonical map for where changes should start.

## Development Notes

- Keep runtime JavaScript in `src/runtime/`.
- Keep UI/CSS changes in `src/styles/fdtd-ui.css` unless there is an explicit
  architecture change.
- Preserve ordered classic scripts unless the loader architecture is deliberately
  changed.
- Prefer deleting retired paths over keeping duplicate sources of truth.
- Run `npm test` after routine changes; use browser physics checks after
  changing presets, solvers, observables, monitors, or material models.

## Deployment

GitHub Pages publishes the generated `dist/` folder, not the full repository.
This keeps development-only files such as `scripts/`, `docs/`, and
`native/fdtd-core/` out of the public artifact.

Build locally:

```powershell
npm run build:pages
```

For GitHub Pages, set the repository source to `GitHub Actions`; the workflow in
`.github/workflows/pages.yml` controls the published artifact.

## License

MIT. See `LICENSE`.
