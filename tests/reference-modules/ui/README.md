# UI Reference Modules

DOM and control-panel reference modules used by `scripts/validate-runtime-core.mjs`.

This layer owns or should own:

- DOM reference collection
- accessible control bindings
- drawer state
- scene browser UI
- results panel UI
- compact/large viewport presentation hooks

It should receive state and callbacks explicitly rather than importing simulation internals.

## Current Files

- `core.js`: small reusable helpers for exclusive buttons, tab panels, pressed/expanded/hidden state, and focused scrolling.
