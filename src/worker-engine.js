"use strict";

class FdtdWorkerEngine {
  constructor(targetSim, callbacks = {}) {
    this.sim = targetSim;
    this.callbacks = callbacks;
    this.worker = null;
    this.ready = false;
    this.syncing = false;
    this.busy = false;
    this.pendingSteps = 0;
    this.syncRequested = false;
    this.requestId = 0;
    this.failureCount = 0;
    this.lastError = "";
    this.lastEngine = "";
    this.disabled = typeof Worker === "undefined";
    this.maxPendingSteps = 96;
  }

  supported() {
    return !this.disabled && typeof Worker !== "undefined";
  }

  isActive() {
    return this.supported() && (this.ready || this.syncing || this.busy || this.pendingSteps > 0);
  }

  label(baseLabel) {
    const engineLabel = this.lastEngine || baseLabel;
    return this.isActive() ? `${engineLabel} + Worker` : baseLabel;
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
    }
    this.worker = null;
    this.ready = false;
    this.syncing = false;
    this.busy = false;
    this.pendingSteps = 0;
    this.syncRequested = false;
  }

  markDirty() {
    this.terminate();
  }

  ensureWorker() {
    if (!this.supported()) return false;
    if (this.worker) return true;
    this.worker = new Worker("src/fdtd-worker.js?v=20260628-worker-engine-1");
    this.worker.onmessage = (event) => this.handleMessage(event.data || {});
    this.worker.onerror = (event) => {
      this.handleError(event.message || "Worker error");
    };
    return true;
  }

  plainStateSnapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  collectProps() {
    const props = {};
    for (const name of FDTD_WORKER_SCALAR_PROPS) {
      if (typeof this.sim[name] !== "undefined") props[name] = this.sim[name];
    }
    if (this.sim.diagnosticPhasors) props.diagnosticPhasors = JSON.parse(JSON.stringify(this.sim.diagnosticPhasors));
    if (this.sim.diagnosticDftSummary) props.diagnosticDftSummary = JSON.parse(JSON.stringify(this.sim.diagnosticDftSummary));
    if (this.sim.analysisMetrics) props.analysisMetrics = JSON.parse(JSON.stringify(this.sim.analysisMetrics));
    return props;
  }

  collectArrays(names) {
    const arrays = {};
    const transfer = [];
    for (const name of names) {
      const source = this.sim[name];
      if (!source || typeof source.length !== "number") continue;
      const copy = new source.constructor(source);
      arrays[name] = copy;
      if (copy.buffer?.byteLength) transfer.push(copy.buffer);
    }
    return { arrays, transfer };
  }

  applyProps(props = {}) {
    for (const name of FDTD_WORKER_SCALAR_PROPS) {
      if (Object.prototype.hasOwnProperty.call(props, name)) this.sim[name] = props[name];
    }
    if (props.diagnosticPhasors) this.sim.diagnosticPhasors = props.diagnosticPhasors;
    if (props.diagnosticDftSummary) this.sim.diagnosticDftSummary = props.diagnosticDftSummary;
    if (props.analysisMetrics) this.sim.analysisMetrics = props.analysisMetrics;
    if (props.engine) this.lastEngine = props.engine;
  }

  applyArrays(arrays = {}) {
    for (const [name, source] of Object.entries(arrays)) {
      const target = this.sim[name];
      if (!target || typeof target.set !== "function" || target.length !== source.length) continue;
      target.set(source);
    }
  }

  post(message, transfer = []) {
    this.worker.postMessage({ ...message, requestId: ++this.requestId }, transfer);
  }

  syncFromMain() {
    if (!this.ensureWorker()) return false;
    if (this.ready || this.syncing) return true;
    const { arrays, transfer } = this.collectArrays(FDTD_WORKER_FULL_ARRAYS);
    this.syncing = true;
    this.post(
      {
        type: "init",
        nx: this.sim.nx,
        ny: this.sim.ny,
        state: this.plainStateSnapshot(),
        props: this.collectProps(),
        arrays,
      },
      transfer,
    );
    return true;
  }

  queueSteps(stepCount) {
    if (!this.supported()) return false;
    const steps = Math.max(1, Math.floor(Number(stepCount) || 1));
    this.pendingSteps = Math.min(this.pendingSteps + steps, this.maxPendingSteps);
    if (!this.ready) {
      return this.syncFromMain();
    }
    this.dispatch();
    return true;
  }

  dispatch() {
    if (!this.ready || this.busy || this.pendingSteps <= 0) return;
    const steps = Math.min(this.pendingSteps, 24);
    this.pendingSteps -= steps;
    this.busy = true;
    this.post({
      type: "step",
      steps,
      measure: false,
      fullSync: false,
      state: this.plainStateSnapshot(),
    });
  }

  requestFullSync() {
    if (!this.worker || !this.ready) return false;
    this.pendingSteps = 0;
    if (this.busy) {
      this.syncRequested = true;
      return true;
    }
    this.busy = true;
    this.syncRequested = false;
    this.post({ type: "sync" });
    return true;
  }

  applyResult(message) {
    this.applyArrays(message.arrays);
    this.applyProps(message.props);
    this.failureCount = 0;
    this.lastError = "";
  }

  handleMessage(message) {
    if (message.type === "ready") {
      this.syncing = false;
      this.ready = true;
      this.applyProps(message.props);
      this.dispatch();
      this.callbacks.onReady?.(message);
      return;
    }
    if (message.type === "stepped") {
      this.busy = false;
      this.applyResult(message);
      this.callbacks.onStep?.(message);
      if (this.syncRequested && !state.running) {
        this.requestFullSync();
      } else if (state.running) {
        this.dispatch();
      }
      return;
    }
    if (message.type === "synced") {
      this.busy = false;
      this.applyResult(message);
      this.callbacks.onSync?.(message);
      return;
    }
    if (message.type === "error") {
      this.handleError(message.message || "Worker failed");
    }
  }

  handleError(message) {
    this.failureCount += 1;
    this.lastError = message;
    console.warn("FDTD worker unavailable; falling back to main thread", message);
    this.terminate();
    if (this.failureCount >= 2) this.disabled = true;
    this.callbacks.onError?.(message);
  }
}

window.FdtdWorkerEngine = FdtdWorkerEngine;
