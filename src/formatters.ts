/** Format one measurement for display in millimetres. */
export function formatMillimetres(value: number): string {
  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, '');
  return `${formatted} mm`;
}

/** Format a base-rail material length in metres without unnecessary zeros. */
export function formatMetres(lengthMillimetres: number): string {
  const metres = lengthMillimetres / 1000;
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 3,
  }).format(metres)} m`;
}

/** Format a glass panel as height x width with one shared mm unit. */
export function formatGlassDimensions(height: number, width: number): string {
  return `${height} x ${width} mm`;
}

/** Format an inventory or calculated price in Hungarian forints. */
export function formatHuf(value: number): string {
  return `${new Intl.NumberFormat('en-US').format(value)} HUF`;
}
