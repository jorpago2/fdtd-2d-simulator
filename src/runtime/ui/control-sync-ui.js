(function initFdtdControlSyncUi(global) {
  "use strict";

  function syncRuntimeAndViewControls({ el, state }) {
    if (el?.speedInput) el.speedInput.value = String(state.timeRate);
    if (el?.gainInput) el.gainInput.value = String(state.gain);
    global.FdtdReactUI?.notify?.();
  }

  function syncSceneAndGridControls() {
    global.FdtdReactUI?.notify?.();
  }

  function syncConfigSummaryControls() {
    global.FdtdReactUI?.notify?.();
  }

  global.FdtdControlSyncUi = Object.freeze({
    syncConfigSummaryControls,
    syncRuntimeAndViewControls,
    syncSceneAndGridControls,
  });
})(window);
