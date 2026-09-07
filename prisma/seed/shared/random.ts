/**
 * The single random source the seeds share, so a run can be made reproducible in
 * one place instead of every module reaching for `Math.random` on its own.
 */
export type Random = () => number;

/** Fisher-Yates, on a copy, so a caller's template list is never reordered. */
export function shuffle<T>(items: readonly T[], random: Random = Math.random) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapWith = pickIndex(index + 1, random);
    [shuffled[index], shuffled[swapWith]] = [
      shuffled[swapWith],
      shuffled[index],
    ];
  }
  return shuffled;
}

/**
 * An index inside `[0, length)`. Clamped because a `random` that can return
 * exactly 1 — which the seeds' own test doubles do — would otherwise index one
 * past the end.
 */
export function pickIndex(length: number, random: Random = Math.random) {
  if (length <= 0) throw new Error("ต้องมีตัวเลือกอย่างน้อย 1 รายการ");
  return Math.min(Math.floor(random() * length), length - 1);
}

export function pick<T>(items: readonly T[], random: Random = Math.random) {
  return items[pickIndex(items.length, random)];
}
