export type Sample = { position: number; time: number };
export function record(history: Sample[], position: number, time: number) {
  history.push({ position, time });
  if (history.length > 5) history.shift();
}
/** px/s over the last five recent pointer samples. */
export function velocity(history: Sample[]) {
  const last = history.at(-1);
  const first = history.find((s) => last && last.time - s.time <= 100);
  return first && last && last.time > first.time
    ? ((last.position - first.position) / (last.time - first.time)) * 1000
    : 0;
}
export function project(initialVelocity: number, decelerationRate = 0.998) {
  return ((initialVelocity / 1000) * decelerationRate) / (1 - decelerationRate);
}
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
export function shouldDismiss(position: number, speed: number, dimension: number) {
  // Reversing the finger reverses the decision, even after a long drag.
  return speed >= 0 && position + project(speed) > dimension / 2;
}
/** Analytic critically damped spring. Cancellation leaves the presentation value intact. */
export function spring({
  from,
  to,
  velocity: initialVelocity = 0,
  response = 0.3,
  update,
  complete,
}: {
  from: number;
  to: number;
  velocity?: number;
  response?: number;
  update: (position: number) => void;
  complete?: () => void;
}) {
  const omega = (2 * Math.PI) / response;
  const a = from - to,
    b = initialVelocity + omega * a,
    start = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const t = (now - start) / 1000,
      decay = Math.exp(-omega * t);
    const displacement = (a + b * t) * decay;
    const speed = (b - omega * (a + b * t)) * decay;
    update(to + displacement);
    if (Math.abs(displacement) < 0.25 && Math.abs(speed) < 5) {
      update(to);
      complete?.();
    } else frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
