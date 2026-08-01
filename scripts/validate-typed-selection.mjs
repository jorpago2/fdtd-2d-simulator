#!/usr/bin/env node

import assert from "node:assert/strict";

globalThis.window = globalThis;

const { createMaterialSelectionController } = await import("../src/ui/material-selection-controller.ts");
const { createEntitySelectionController } = await import("../src/ui/entity-selection-controller.ts");

const materialSelection = createMaterialSelectionController();
const state = { selectedSourceId: null, selectedMonitorId: null };
const entitySelection = createEntitySelectionController({
  state,
  materialSelectionController: materialSelection,
});
const region = { cells: [1, 2, 3], kind: "dielectric" };

entitySelection.selectMaterial(region);
assert.equal(materialSelection.getRegion(), region);
assert.equal(materialSelection.hasRegion(), true);

state.selectedMonitorId = 8;
entitySelection.selectSource(4);
assert.equal(state.selectedSourceId, 4);
assert.equal(state.selectedMonitorId, null);
assert.equal(materialSelection.hasRegion(), false);

entitySelection.selectMonitor(9, { clearSource: false });
assert.equal(state.selectedSourceId, 4);
assert.equal(state.selectedMonitorId, 9);

entitySelection.selectMaterial(region);
assert.equal(state.selectedSourceId, null);
assert.equal(state.selectedMonitorId, null);

entitySelection.clearAll();
assert.equal(materialSelection.getRegion(), null);

console.log("Typed selection validation: PASS");
