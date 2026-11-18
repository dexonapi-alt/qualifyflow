export type FocusPoint = { x: number; y: number };
export type FocusFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};
const cross = (a: FocusPoint, b: FocusPoint, c: FocusPoint) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Both card footprints plus their travel corridor, with a small edge allowance. */
export function inProfileFocusRegion(
  point: FocusPoint,
  home: FocusFrame,
  center: FocusFrame,
) {
  const edge = 10;
  const points = [home, center]
    .flatMap((r) => [
      { x: r.left - edge, y: r.top - edge },
      { x: r.left + r.width + edge, y: r.top - edge },
      { x: r.left + r.width + edge, y: r.top + r.height + edge },
      { x: r.left - edge, y: r.top + r.height + edge },
    ])
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: FocusPoint[] = [],
    upper: FocusPoint[] = [];
  for (const p of points) {
    while (
      lower.length > 1 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    )
      lower.pop();
    lower.push(p);
  }
  for (const p of [...points].reverse()) {
    while (
      upper.length > 1 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    )
      upper.pop();
    upper.push(p);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return (
    hull.length >= 3 &&
    hull.every((a, i) => cross(a, hull[(i + 1) % hull.length], point) >= 0)
  );
}
