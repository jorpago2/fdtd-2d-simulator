# app

Top-level orchestration notes for the `js-next` app.

This layer owns or should own:

- module wiring
- app bootstrap
- controller lifecycle
- startup/shutdown order
- feature flags for deliberate runtime experiments

It should not own FDTD stepping, canvas drawing internals, or low-level DOM rendering.
