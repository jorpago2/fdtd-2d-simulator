# Simulation Layer

Numerical and physical simulation code for `src/runtime/simulation/`.

This layer owns or should own:

- grid and field state
- FDTD stepping
- materials
- sources
- boundaries
- diagnostics and observables
- JS/WASM backend routing

It should not read DOM elements or mutate UI controls.
