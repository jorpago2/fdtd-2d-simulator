# simulation

Numerical and physical simulation code for the future `js-next` app.

This layer should eventually own:

- grid and field state
- FDTD stepping
- materials
- sources
- boundaries
- diagnostics and observables
- worker/WASM routing

It should not read DOM elements or mutate UI controls.
