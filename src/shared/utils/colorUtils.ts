/**
 * Convert a hex color string to comma-separated RGB values.
 * Supports 3-char and 6-char hex, with or without leading #.
 * Returns '0, 0, 0' for invalid input.
 */
export function hexToRgb(hex: string): string {
  // Strip leading #
  let clean = hex.startsWith('#') ? hex.slice(1) : hex;

  // Expand 3-char shorthand to 6-char
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }

  if (clean.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '0, 0, 0';
  }

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
