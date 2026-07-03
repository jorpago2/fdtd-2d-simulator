# canvas

Canvas-facing code for the `js-next` app.

This layer owns or should own:

- viewport math
- renderer coordination
- overlays
- colorbar/export composition
- pointer, keyboard, touch, and drag interactions

It should depend on simulation interfaces, not directly on UI drawer state.

## Current Files

- `viewport.js`: pure viewport calculations plus optional method installation for the active simulation object.
