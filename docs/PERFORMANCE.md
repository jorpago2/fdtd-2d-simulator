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
- Whether continuous Play is using the browser Worker route.

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
- `kernel_features`: compiled-kernel capability bitmask. Bit 0 is finite electric conductivity, bit 1 is Kerr, bit 2 is saturable gain, and bit 3 is TEz tensor/gyrotropy.

The compiled kernel includes finite conductivity `J = sigma E`, Kerr permittivity updates, saturable gain/loss decay, and TEz tensor/gyrotropic electric updates. Electric ADE Drude/Lorentz/Debye scenes use a conservative hybrid path: the Yee step runs in WASM and the ADE memory-current correction remains in JavaScript to preserve the existing update order. Advanced material paths outside this set still fall back to JavaScript. The engine label remains the source of truth exposed by the app.

## Worker Engine

Continuous Play can now advance FDTD steps in `src/fdtd-worker.js`. The main thread keeps UI, controls, and canvas rendering responsive while `src/worker-engine.js` sends step batches to a headless worker-side simulator. The worker loads the same physics modules as the main app and tries to use the same C++/WASM backend; if Worker or WASM loading fails, the app falls back to the previous main-thread stepping path.

The worker syncs a full simulation snapshot when a run starts, returns field/material arrays needed for rendering after each batch, and performs a full sync when pausing. Geometry, source, material, preset, boundary, grid, import, reset, or backend changes invalidate the worker snapshot so the next run starts from the current main-thread state.

This first worker route targets interactive responsiveness, not zero-copy throughput. Field arrays are copied between threads, so very large grids can still become transfer-bandwidth limited. A future deeper optimization should evaluate `SharedArrayBuffer` with COOP/COEP headers or an OffscreenCanvas/worker-owned renderer.

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
3. Port dynamic material kernels that currently force JavaScript fallback. Finite conductivity, Kerr, saturable gain, and TEz tensor/gyrotropy are in the C++/WASM kernel; electric ADE uses the compiled Yee + JS memory-response route. Remaining candidates are full ADE memory-current kernels, modulation, phase change, harmonic nonlinear polarization, and broader bianisotropy.
4. Extend the Worker route to long-running sweeps and consider zero-copy/shared-memory rendering for very large grids.
