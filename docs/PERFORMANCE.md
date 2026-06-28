# Performance Route

This simulator separates performance work into measurable stages. The goal is to improve speed without changing the physical model silently.

## Runtime Metrics

Open the advanced `Results -> Performance` panel while the simulator is running. It reports exponentially smoothed estimates for:

- FDTD step cost, in ms per simulated step.
- Render cost, in ms per canvas redraw.
- Render sub-costs for field/material pixel mapping, canvas presentation, and overlays.
- Measurement cost, in ms per diagnostic `measure()` call.
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
- `sim.render()`, including field-to-pixel mapping and overlays.
- `sim.measure()`, for the diagnostic pass.

Use custom grids when profiling a target device:

```powershell
npm run benchmark:perf -- --browser-channel=msedge --grids=180x120,360x240,720x480 --steps=240 --json
```

Benchmark a specific scene, for example the finite-conductivity skin-depth case:

```powershell
npm run benchmark:perf -- --browser-channel=msedge --preset=finiteConductivity
```

The reported WASM/JS speedup is meaningful for the static Yee update only. Dynamic materials that force the JavaScript path must be benchmarked separately before moving them to C++/WASM.

Reference run on this Windows/Edge workstation after limiting renormalization to active fields:

| Grid | WASM step | JS step | WASM speedup | Render | Measure |
| --- | ---: | ---: | ---: | ---: | ---: |
| 180 x 120 | 0.52 ms | 1.21 ms | 2.34x | 2.13 ms | 0.86 ms |
| 360 x 240 | 1.65 ms | 4.66 ms | 2.82x | 3.64 ms | 1.42 ms |
| 720 x 480 | 5.29 ms | 18.13 ms | 3.43x | 11.52 ms | 5.39 ms |

These values are hardware- and browser-dependent. They are useful as a local regression baseline, not as universal performance claims.

## Current Backend

The app currently loads `fdtd-core.wasm` through `src/wasm-backend.js`. The active kernel is now built from `wasm-src/fdtd-core.cpp`, which exports:

- `step`: TMz-style `Ez, Hx, Hy` Yee update.
- `step_hz`: TEz-style `Hz, Ex, Ey` Yee update.
- `kernel_features`: compiled-kernel capability bitmask. Bit 0 means finite electric conductivity is included.

The compiled kernel includes the static finite-conductivity update `J = sigma E`, so conductive scenes can run as `WASM sigma` when no unsupported dynamic physics is active. Advanced dynamic material paths can still fall back to JavaScript. The performance panel reports whether the compiled kernel is available for the current field component, but the engine label remains the source of truth exposed by the app.

## C++ Migration Path

`wasm-src/fdtd-core.cpp` mirrors the previous WAT kernel with the same exported signatures and byte-offset memory layout. It is the maintainable source for the compiled backend.

Build it with a clang toolchain that supports `wasm32`:

```powershell
.\scripts\build-wasm-cpp.ps1
```

The script can auto-detect a WASI SDK installed under `%USERPROFILE%\.cache\fdtd-tools\wasi-sdk-*-windows` or a `WASI_SDK_PATH` environment variable. If clang is elsewhere, pass an absolute compiler path:

```powershell
.\scripts\build-wasm-cpp.ps1 -Compiler "C:\path\to\clang++.exe"
```

After replacing `fdtd-core.wasm`, run:

```powershell
npm test
npm run test:browser
```

For scientific confidence, also compare short JS and WASM trajectories on homogeneous media and simple dielectric interfaces with tolerances on max field, energy, and R/T estimates.

## Priority Order

1. Use the runtime panel to identify whether the current bottleneck is stepping, rendering, or diagnostics.
2. Compile and validate the C++ kernel as a replacement for the WAT-maintained WASM.
3. Port dynamic material kernels that currently force JavaScript fallback. Finite electric conductivity is already in the C++/WASM kernel; the next candidates are ADE dispersion, Kerr/saturable response, and tensor/gyrotropic TEz updates.
4. Move long-running sweeps to a Web Worker so UI and canvas interactions remain responsive.
