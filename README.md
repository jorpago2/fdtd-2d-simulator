# 2D FDTD Browser Simulator

Browser-based 2D finite-difference time-domain simulator for teaching and exploratory electromagnetic/photonic examples.

The app uses ordered classic scripts rather than a build pipeline. Open `index.html` through a local static server, or use any simple HTTP server from the repository root.

## Run

```powershell
python -m http.server 8766
```

Then open:

```text
http://127.0.0.1:8766/index.html
```

## Validation

Fast static validation:

```powershell
npm test
```

Optional browser smoke validation:

```powershell
npm install
npx playwright install chromium
npm run test:browser
```

The validation matrix is versioned in:

```text
scripts/validation-matrix.json
```

Protocol details are in:

```text
docs/VALIDATION.md
```

## Scope

The simulator includes many qualitative Atlas scenes for propagation, interfaces, radiation, guided optics, resonators, scattering, dispersive media, nonlinear media, temporal modulation, and selected topological/non-Hermitian analogues.

Not every scene is quantitatively calibrated. Treat advanced examples as teaching and exploration presets unless they have passed a specific validation case, convergence study, and comparison against an analytical or independent numerical reference.

## Important Numerical Assumptions

- Explicit 2D Yee update with fixed Courant number.
- Current CFL setting is checked against `S < 1 / sqrt(2)`.
- Absorbing boundaries are PML-style numerical layers.
- Many advanced media are reduced 2D analogues, not full 3D constitutive solvers.
- Publication-grade results require grid refinement and documented monitor/sweep settings.

## Source Layout

See:

```text
src/README.md
```

The app intentionally keeps the physics modules separate from UI orchestration in `app.js`.
