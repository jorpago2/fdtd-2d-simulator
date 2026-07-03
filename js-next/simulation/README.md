# simulation

Numerical and physical simulation code for the `js-next` app.

This layer owns or should own:

- grid and field state
- FDTD stepping
- materials
- sources
- boundaries
- diagnostics and observables
- JS/WASM backend routing

It should not read DOM elements or mutate UI controls.
