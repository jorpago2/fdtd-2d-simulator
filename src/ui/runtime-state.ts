import { useSyncExternalStore } from "react";
import type { createInitialAppState } from "../core/app-state";

export type FdtdRuntimeState = ReturnType<typeof createInitialAppState>;

type RuntimeWindow = Window & {
  FdtdApp?: { state?: FdtdRuntimeState; sim?: { time?: number } };
  FdtdReactUI?: { notify: () => void };
};

let version = 0;
let runtimeReady = false;
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return version;
}

export function runtimeState(): FdtdRuntimeState | null {
  return (window as RuntimeWindow).FdtdApp?.state ?? null;
}

export function runtimeStep() {
  return Number((window as RuntimeWindow).FdtdApp?.sim?.time) || 0;
}

export function useFdtdRuntimeState() {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return runtimeState();
}

export function useFdtdRuntimeReady() {
  return useSyncExternalStore(subscribe, () => runtimeReady, () => false);
}

export function useFdtdRuntimeSelector<T>(selector: (state: FdtdRuntimeState | null) => T) {
  return useSyncExternalStore(
    subscribe,
    () => selector(runtimeState()),
    () => selector(null),
  );
}

export function requestRuntimeAction<T>(name: string, detail?: T) {
  window.dispatchEvent(new CustomEvent(`fdtd:${name}`, { detail }));
}

(window as RuntimeWindow).FdtdReactUI = Object.freeze({ notify });
window.addEventListener("fdtd:runtime-ready", () => {
  runtimeReady = true;
  notify();
});
