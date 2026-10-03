/** Pure gesture rules shared by the pointer hook and the regression tests. */
export function classifySwipe(
  dx,
  dy,
  threshold = 44,
  verticalThreshold = 96,
  dominance = 1.25,
) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * dominance)
    return dx < 0 ? "left" : "right";
  if (
    Math.abs(dy) >= verticalThreshold &&
    Math.abs(dy) > Math.abs(dx) * dominance
  )
    return dy < 0 ? "up" : "down";
  return null;
}
export function nearestSlide(scrollLeft, width, count) {
  if (count <= 0 || width <= 0 || !Number.isFinite(scrollLeft)) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / width)));
}
export function isDoubleTap(previous, current, windowMs = 280) {
  return Boolean(
    previous &&
    current.time - previous.time >= 0 &&
    current.time - previous.time <= windowMs &&
    Math.hypot(current.x - previous.x, current.y - previous.y) < 24,
  );
}
