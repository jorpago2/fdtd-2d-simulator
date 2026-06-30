(function initFdtdBoundaryState(global) {
  "use strict";

  function requireObject(value, name) {
    if (!value || typeof value !== "object") {
      throw new Error(`Boundary state dependency must provide ${name}.`);
    }
    return value;
  }

  function normalizeBoundaryMode(mode) {
    return mode === "reflective" ? "reflective" : "absorbing";
  }

  function createBoundaryStateController(dependencies) {
    const state = requireObject(dependencies.state, "state");
    const boundarySides = dependencies.boundarySides || global.BOUNDARY_SIDES || ["left", "right", "top", "bottom"];
    const boundarySideLabels = dependencies.boundarySideLabels || global.boundarySideLabels || {};

    function normalizeBoundarySides() {
      const fallback = normalizeBoundaryMode(state.boundary);
      if (!state.boundarySides || typeof state.boundarySides !== "object") {
        state.boundarySides = {
          left: fallback,
          right: fallback,
          top: fallback,
          bottom: fallback,
        };
      }
      for (const side of boundarySides) {
        state.boundarySides[side] = normalizeBoundaryMode(state.boundarySides[side] || fallback);
      }
      const modes = boundarySides.map((side) => state.boundarySides[side]);
      state.boundary = modes.every((mode) => mode === "absorbing")
        ? "absorbing"
        : modes.every((mode) => mode === "reflective")
          ? "reflective"
          : "mixed";
      return state.boundarySides;
    }

    function boundarySideMode(side) {
      const sides = normalizeBoundarySides();
      return sides[side] || "absorbing";
    }

    function boundarySideIsAbsorbing(side) {
      return boundarySideMode(side) === "absorbing";
    }

    function anyAbsorbingBoundarySide() {
      return boundarySides.some((side) => boundarySideIsAbsorbing(side));
    }

    function setBoundarySideMode(side, mode) {
      normalizeBoundarySides();
      if (!boundarySides.includes(side)) return;
      state.boundarySides[side] = normalizeBoundaryMode(mode);
      normalizeBoundarySides();
    }

    function boundarySummaryLabel() {
      normalizeBoundarySides();
      if (state.boundary === "absorbing") return "PML absorbing";
      if (state.boundary === "reflective") return "reflective";
      const absorbing = boundarySides
        .filter((side) => boundarySideIsAbsorbing(side))
        .map((side) => (boundarySideLabels[side] || side).toLowerCase())
        .join(", ");
      return `mixed boundary (${absorbing || "no"} PML)`;
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

  global.FdtdBoundaryState = Object.freeze({
    createBoundaryStateController,
    normalizeBoundaryMode,
  });
})(window);
