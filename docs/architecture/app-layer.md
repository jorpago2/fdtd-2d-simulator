# App Layer

Top-level orchestration notes for `src/runtime/app/`.

This layer owns or should own:

- module wiring
- app bootstrap
- controller lifecycle
- startup/shutdown order
- feature flags for deliberate runtime experiments

It should not own FDTD stepping, canvas drawing internals, or low-level DOM rendering.
