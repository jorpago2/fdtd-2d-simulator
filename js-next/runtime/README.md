# js-next runtime

This folder is the active compatibility runtime for the simulator.

`index.html` now loads JavaScript from this tree instead of `src/` and `app.js`.
The files preserve the public globals used by the current application while the
implementation is migrated into the cleaner `js-next/core`, `js-next/ui`,
`js-next/canvas`, `js-next/simulation`, and `js-next/app` modules.

The manifest records the source-to-runtime mapping used for the cutover.

