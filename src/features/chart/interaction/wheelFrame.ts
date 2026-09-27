/** Derive size and center from one parent layout snapshot. Measuring a child
 * spacer separately lets its previous position leak into the next wheel size. */
export function wheelFrame(width: number, area: { y: number; height: number }, hasError: boolean) {
  const controlsHeight = 44;
  const errorHeight = hasError ? 44 : 0;
  return {
    size: Math.min(width, Math.max(0, area.height - controlsHeight - errorHeight - 16)),
    center: { x: width / 2, y: area.y + (area.height - controlsHeight - errorHeight) / 2 },
  };
}
