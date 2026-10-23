/** Four equal integer intervals, rounded up to a readable count scale. */
export function countScale(maximum: number) {
  const raw = Math.max(1, Math.ceil(maximum / 4));
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((n) => n * magnitude).find((n) => n >= raw)!;
  return { maximum: step * 4, ticks: [4, 3, 2, 1, 0].map((n) => n * step) };
}
