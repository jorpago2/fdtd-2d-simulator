export type BoundaryMode = "absorbing" | "reflective";

type BoundaryState = Record<string, unknown> & {
  boundary?: unknown;
  boundarySides?: Record<string, unknown>;
};

type BoundaryStateDependencies = {
  state: unknown;
  boundarySides?: readonly string[];
  boundarySideLabels?: Record<string, string>;
};

function requireObject(value: unknown, name: string): BoundaryState {
  if (!value || typeof value !== "object") {
    throw new Error(`Boundary state dependency must provide ${name}.`);
  }
  return value as BoundaryState;
}

export function normalizeBoundaryMode(mode: unknown): BoundaryMode {
  return mode === "reflective" ? "reflective" : "absorbing";
}

export function createBoundaryStateController(dependencies: BoundaryStateDependencies) {
  const state = requireObject(dependencies.state, "state");
  const boundarySides = dependencies.boundarySides || window.BOUNDARY_SIDES || ["left", "right", "top", "bottom"];
  const boundarySideLabels = dependencies.boundarySideLabels || window.boundarySideLabels || {};

  function normalizeBoundarySides(): Record<string, BoundaryMode> {
    const fallback = normalizeBoundaryMode(state.boundary);
    let sides = state.boundarySides;
    if (!sides || typeof sides !== "object") {
      sides = { left: fallback, right: fallback, top: fallback, bottom: fallback };
      state.boundarySides = sides;
    }
    for (const side of boundarySides) {
      sides[side] = normalizeBoundaryMode(sides[side] || fallback);
    }
    const modes = boundarySides.map((side) => sides[side]);
    state.boundary = modes.every((mode) => mode === "absorbing")
      ? "absorbing"
      : modes.every((mode) => mode === "reflective")
        ? "reflective"
        : "mixed";
    return sides as Record<string, BoundaryMode>;
  }

  function boundarySideMode(side: string): BoundaryMode {
    return normalizeBoundarySides()[side] || "absorbing";
  }

  function boundarySideIsAbsorbing(side: string): boolean {
    return boundarySideMode(side) === "absorbing";
  }

  function anyAbsorbingBoundarySide(): boolean {
    return boundarySides.some((side) => boundarySideIsAbsorbing(side));
  }

  function setBoundarySideMode(side: string, mode: unknown): void {
    const sides = normalizeBoundarySides();
    if (!boundarySides.includes(side)) return;
    sides[side] = normalizeBoundaryMode(mode);
    normalizeBoundarySides();
  }

  function boundarySummaryLabel(): string {
    normalizeBoundarySides();
    if (state.boundary === "absorbing") return "CPML absorbing";
    if (state.boundary === "reflective") return "reflective";
    const absorbing = boundarySides
      .filter((side) => boundarySideIsAbsorbing(side))
      .map((side) => (boundarySideLabels[side] || side).toLowerCase())
      .join(", ");
    return `mixed boundary (${absorbing || "no"} CPML)`;
  }

  return Object.freeze({
    anyAbsorbingBoundarySide,
    boundarySideIsAbsorbing,
    boundarySideMode,
    boundarySummaryLabel,
    normalizeBoundarySides,
    setBoundarySideMode,
  });
}

const boundaryStateModule = Object.freeze({ createBoundaryStateController, normalizeBoundaryMode });

declare global {
  interface Window {
    BOUNDARY_SIDES?: readonly string[];
    boundarySideLabels?: Record<string, string>;
    FdtdBoundaryState: typeof boundaryStateModule;
  }
}

window.FdtdBoundaryState = boundaryStateModule;
