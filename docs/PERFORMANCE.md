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

## Current Backend

The app currently loads `fdtd-core.wasm` through `src/wasm-backend.js`. The checked-in source of that active kernel is still `fdtd-core.wat`, which exports:

- `step`: TMz-style `Ez, Hx, Hy` Yee update.
- `step_hz`: TEz-style `Hz, Ex, Ey` Yee update.

Advanced dynamic material paths can still fall back to JavaScript. The performance panel reports whether the compiled kernel is available for the current field component, but the engine label remains the source of truth exposed by the app.

## C++ Migration Path

`wasm-src/fdtd-core.cpp` mirrors the current WAT kernel with the same exported signatures and byte-offset memory layout. This is intended as the maintainable source for the next compiled backend.

Build it with a clang toolchain that supports `wasm32`:

```powershell
.\scripts\build-wasm-cpp.ps1
```

If clang is not on `PATH`, pass an absolute compiler path:

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
3. Port dynamic material kernels that currently force JavaScript fallback.
4. Move long-running sweeps to a Web Worker so UI and canvas interactions remain responsive.
