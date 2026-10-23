// Data cells use the same age colors in both themes. Choose text from their actual luminance.
export function relativeLuminance(color: string) {
  let rgb: number[];
  if (/^#[\da-f]{6}$/i.test(color)) {
    rgb = color
      .slice(1)
      .match(/../g)!
      .map((v) => parseInt(v, 16) / 255);
  } else {
    const hsl = /^hsl\(([\d.]+) ([\d.]+)% ([\d.]+)%\)$/.exec(color);
    if (!hsl) throw new Error(`Unsupported data color: ${color}`);
    const h = Number(hsl[1]) / 30,
      s = Number(hsl[2]) / 100,
      l = Number(hsl[3]) / 100;
    const a = s * Math.min(l, 1 - l);
    rgb = [0, 8, 4].map((n) => {
      const k = (n + h) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    });
  }
  const linear = rgb.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function dataTextTone(color: string): 'dark' | 'light' {
  const luminance = relativeLuminance(color);
  // Correspond to --data-dark (#050505) and --data-light (#FFFFFF).
  return (luminance + 0.05) / (relativeLuminance('#050505') + 0.05) >= 1.05 / (luminance + 0.05)
    ? 'dark'
    : 'light';
}
