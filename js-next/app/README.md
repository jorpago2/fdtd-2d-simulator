# app

Top-level orchestration for the future `js-next` app.

This layer should eventually own:

- module wiring
- app bootstrap
- controller lifecycle
- startup/shutdown order
- feature flags during migration

It should not own FDTD stepping, canvas drawing internals, or low-level DOM rendering.
