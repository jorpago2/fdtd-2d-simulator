(function initFdtdCanvasInteractionModel(global) {
  "use strict";

  function clampInt(value, min, max) {
    return Math.round(Math.max(min, Math.min(max, Number(value) || 0)));
  }

  function dragOffsetFromCell(targetCell, pointerGridPoint) {
    return {
      x: targetCell.x - pointerGridPoint.x,
      y: targetCell.y - pointerGridPoint.y,
    };
  }

  function computeConstrainedGridPosition(pointerGridPoint, offset, bounds) {
    return {
      x: clampInt(pointerGridPoint.x + offset.x, bounds.minX, bounds.maxX),
      y: clampInt(pointerGridPoint.y + offset.y, bounds.minY, bounds.maxY),
    };
  }

  function computeSourceDragStart({ pointerGridPoint, sourceCell }) {
    return {
      offset: dragOffsetFromCell(sourceCell, pointerGridPoint),
    };
  }

  function computeSourceDragUpdate({ pointerGridPoint, offset, bounds, currentCell }) {
    const nextCell = computeConstrainedGridPosition(pointerGridPoint, offset, bounds);
    return {
      changed: nextCell.x !== currentCell.x || nextCell.y !== currentCell.y,
      nextCell,
    };
  }

  function computeMonitorDragStart({ pointerGridPoint, monitorCell }) {
    return {
      offset: dragOffsetFromCell(monitorCell, pointerGridPoint),
    };
  }

  function computeMonitorDragUpdate({ pointerGridPoint, offset, bounds, currentCell }) {
    const nextCell = computeConstrainedGridPosition(pointerGridPoint, offset, bounds);
    return {
      changed: nextCell.x !== currentCell.x || nextCell.y !== currentCell.y,
      nextCell,
    };
  }

  function computeMaterialDragStart({ pointerGridPoint, region, base }) {
    return {
      region,
      base,
      startX: pointerGridPoint.x,
      startY: pointerGridPoint.y,
      dx: 0,
      dy: 0,
    };
  }

  function computeMaterialDragDelta({ pointerGridPoint, state, constrainOffset }) {
    const rawDx = Math.round(pointerGridPoint.x - state.startX);
    const rawDy = Math.round(pointerGridPoint.y - state.startY);
    const { dx, dy } = constrainOffset(state.region, rawDx, rawDy);
    return {
      changed: dx !== state.dx || dy !== state.dy,
      dx,
      dy,
    };
  }

  global.FdtdCanvasInteractionModel = Object.freeze({
    computeMaterialDragDelta,
    computeMaterialDragStart,
    computeMonitorDragStart,
    computeMonitorDragUpdate,
    computeSourceDragStart,
    computeSourceDragUpdate,
  });
})(window);
