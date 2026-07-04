# Performance Route

This simulator separates performance work into measurable stages. The goal is to improve speed without changing the physical model silently.

## Runtime Metrics

Open the advanced `Results -> Performance` panel while the simulator is running. It reports exponentially smoothed estimates for:

- FDTD step cost, in ms per simulated step.
- Render cost, in ms per canvas redraw.
- Render sub-costs for field/material pixel mapping, canvas presentation, and overlays.
- Measurement cost, in ms per diagnostic `measure()` call.
- Solver sub-costs for WASM kernel time, JavaScript kernel time, source packing, auxiliary material updates, boundary/source cleanup, and diagnostics.
- Estimated solver capacity, in steps per second.
- Active engine label and grid size.

Interpret these as profiling guides, not publication metrics. Browser scheduling, thermal throttling, device pixel ratio, active overlays, and the selected material model all affect the numbers.

## Browser Benchmark

For repeatable JS/WASM comparisons, run:

```powershell
npm run benchmark:perf -- --browser-channel=msedge
```

The benchmark opens the app in a browser, tests the default static TMz path on several grids, and reports separate costs for:

- `sim.step()`, including source injection, boundary cleanup, and diagnostics updates.
- Solver subphase timings sampled inside `sim.step()`, when available.
- `sim.render()`, including field-to-pixel mapping and overlays.
- `sim.measure()`, for a forced full-field measurement.
- Cached `sim.measure()` calls, which should be close to zero when no field, view, scale, or projection state changed.
- UI `measureForUi()` refreshes, which may reuse the previous diagnostic value briefly after field changes when exact physics diagnostics are not being requested.

Use custom grids when profiling a target device:

```powershell
npm run benchmark:perf -- --browser-channel=msedge --grids=180x120,360x240,720x480 --steps=240 --json
```

Benchmark a specific scene, for example the finite-conductivity skin-depth case:

```powershell
npm run benchmark:perf -- --browser-channel=msedge --preset=finiteConductivity
```

The reported WASM/JS speedup is meaningful for the static Yee update only. Dynamic materials that force the JavaScript path must be benchmarked separately before moving them to C++/WASM.

`measure()` is revision-cached. The first call after a field update still scans the full field, but repeated calls with the same field revision and visual measurement mode reuse the measured max/energy values. This avoids duplicate work in UI update paths without changing the rendered field or the FDTD update.

UI-driven refreshes use `measureForUi()` where an exact new diagnostic value is not required. It can reuse the last measured max/energy for a short interval after field changes, while explicit validation, final sweep points, manual step/reset actions, and divergence handling still call full `measure()`. This separates physical diagnostics from routine control-panel refreshes.

Reference run on this Windows/Edge workstation after limiting renormalization to active fields:

| Grid | WASM step | JS step | WASM speedup | Render | Measure |
| --- | ---: | ---: | ---: | ---: | ---: |
| 180 x 120 | 0.52 ms | 1.21 ms | 2.34x | 2.13 ms | 0.86 ms |
| 360 x 240 | 1.65 ms | 4.66 ms | 2.82x | 3.64 ms | 1.42 ms |
| 720 x 480 | 5.29 ms | 18.13 ms | 3.43x | 11.52 ms | 5.39 ms |

These values are hardware- and browser-dependent. They are useful as a local regression baseline, not as universal performance claims.

## Current Backend

The app currently loads `assets/wasm/fdtd-core.wasm` through `src/runtime/simulation/wasm-backend.js`. The active kernel is now built from `native/fdtd-core/fdtd-core.cpp`, which exports:

- `step`: TMz-style `Ez, Hx, Hy` Yee update.
- `step_hz`: TEz-style `Hz, Ex, Ey` Yee update.
- `kernel_features`: compiled-kernel capability bitmask. Bit 0 is finite electric conductivity, bit 1 is Kerr, bit 2 is saturable gain, bit 3 is TEz tensor/gyrotropy, bit 4 is exact TFSF injection, bit 5 is CPML with recursive memory terms, bit 6 is mode-source injection, bit 7 is electric ADE, bit 8 is magnetic ADE, bit 9 is space-time permittivity modulation, bit 10 is harmonic nonlinear polarization, bit 11 is phase-change material state, and bit 12 is bianisotropic constitutive coupling.

The compiled kernel includes CPML absorbing boundaries, finite conductivity `J = sigma E`, Kerr permittivity updates, space-time permittivity modulation, harmonic nonlinear polarization, phase-change material state updates, bianisotropic constitutive coupling, saturable gain/loss decay, TEz tensor/gyrotropic electric updates, mode-profile source injection, electric and magnetic ADE Drude/Lorentz/Debye memory-current updates, and exact rectangular TFSF boundary corrections for line and Gaussian incident fields. ADE runs in WASM for both TMz and TEz, including packed TFSF incident-field corrections when the active source shape is supported. Mode-profile sources can run with dynamic material elsewhere in the device when the modal injection cross-section itself remains static. Advanced material paths outside this set still fall back to JavaScript. The engine label remains the source of truth exposed by the app.

## Execution Model

Continuous Play advances FDTD steps on the main browser runtime. The active engine can still switch between the compiled C++/WASM kernels and JavaScript kernels according to the material, source, and boundary features enabled in the scene. Keeping one interactive execution path avoids cross-thread field copies and keeps UI, controls, diagnostics, and rendering synchronized.

Large-grid performance work should focus first on reducing render cost, moving additional material kernels into C++/WASM, and limiting diagnostic work to the requested observables. Any future parallel execution design should only be introduced if it uses a validated zero-copy strategy, such as `SharedArrayBuffer` with the required COOP/COEP headers or a renderer that owns its field buffers.

## C++ Backend Path

`native/fdtd-core/fdtd-core.cpp` is the maintainable source for the compiled backend. The JavaScript wrapper owns the byte-offset memory layout and packs auxiliary TFSF/source-mode parameters into the imported WebAssembly memory before each compiled step. The ordered JS argument schema is checked by `npm test` against the exported `step` and `step_hz` C++ signatures so positional drift is caught before deployment.

Build it with a clang toolchain that supports `wasm32`:

```powershell
.\scripts\build-wasm-cpp.ps1
```

The script can auto-detect a WASI SDK installed under `%USERPROFILE%\.cache\fdtd-tools\wasi-sdk-*-windows` or a `WASI_SDK_PATH` environment variable. If clang is elsewhere, pass an absolute compiler path:

```powershell
.\scripts\build-wasm-cpp.ps1 -Compiler "C:\path\to\clang++.exe"
```

After replacing `assets/wasm/fdtd-core.wasm`, run:

```powershell
npm test
npm run test:browser
```

For scientific confidence, also compare short JS and WASM trajectories on homogeneous media and simple dielectric interfaces with tolerances on max field, energy, and R/T estimates.

## Priority Order

1. Use the runtime panel to identify whether the current bottleneck is stepping, rendering, or diagnostics.
2. Compile and validate the C++ kernel after every numerical change to the Yee/CPML update.
3. Port dynamic material kernels that currently force JavaScript fallback. CPML, finite conductivity, Kerr, space-time modulation, harmonic nonlinear polarization, phase-change material state, bianisotropic coupling, saturable gain, TEz tensor/gyrotropy, mode sources, exact TFSF source corrections, and electric/magnetic ADE are in the C++/WASM kernel. Remaining fallback decisions should be made only for combinations that have a specific physical coupling not represented by the current packed-source, static-mode-source, or local-material kernels.
4. Reconsider shared-memory execution only after a benchmark shows that synchronization costs are lower than the current single-runtime path.
