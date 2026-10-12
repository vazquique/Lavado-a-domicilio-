// Black or white text, whichever reads better on the given "#rrggbb" background.
export function readableTextColor(hex: string): "#000000" | "#ffffff" {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return "#ffffff";
  const [r, g, b] = match.slice(1).map((part) => {
    const channel = parseInt(part, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast against white vs. against black (WCAG formula).
  return (1.05 / (luminance + 0.05)) >= ((luminance + 0.05) / 0.05) ? "#ffffff" : "#000000";
}
