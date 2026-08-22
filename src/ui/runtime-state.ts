import { useSyncExternalStore } from "react";
import type { createInitialAppState } from "../core/app-state";

export type FdtdRuntimeState = ReturnType<typeof createInitialAppState>;

type RuntimeWindow = Window & {
  FdtdApp?: { state?: FdtdRuntimeState; sim?: { time?: number } };
  FdtdReactUI?: { notify: () => void };
};

let version = 0;
let runtimeReady = false;
let activeContextMenuId: string | null = null;
const listeners = new Set<() => void>();
const pendingActions: Array<{ name: string; detail: unknown }> = [];

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

export function useFdtdContextMenuOpen(menuId?: string) {
  return useSyncExternalStore(
    subscribe,
    () => menuId ? activeContextMenuId === menuId : activeContextMenuId !== null,
    () => false,
  );
}

export function useFdtdRuntimeSelector<T>(selector: (state: FdtdRuntimeState | null) => T) {
  return useSyncExternalStore(
    subscribe,
    () => selector(runtimeState()),
    () => selector(null),
  );
}

export function requestRuntimeAction<T>(name: string, detail?: T) {
  if (!runtimeReady) {
    pendingActions.push({ name, detail });
    return;
  }
  window.dispatchEvent(new CustomEvent(`fdtd:${name}`, { detail }));
}

(window as RuntimeWindow).FdtdReactUI = Object.freeze({ notify });
window.addEventListener("fdtd:runtime-ready", () => {
  runtimeReady = true;
  pendingActions.splice(0).forEach(({ name, detail }) => {
    window.dispatchEvent(new CustomEvent(`fdtd:${name}`, { detail }));
  });
  notify();
});
window.addEventListener("fdtd:context-inspector-state", (event) => {
  activeContextMenuId = (event as CustomEvent<{ activeMenuId?: string | null }>).detail?.activeMenuId ?? null;
  notify();
});
