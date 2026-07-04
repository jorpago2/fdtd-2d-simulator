# src runtime

This folder is the active runtime for the simulator.

`index.html` loads JavaScript from this tree. The files preserve explicit public
globals for the ordered classic-script app while keeping runtime ownership split
across core, data, simulation, canvas, UI, and app orchestration folders.
