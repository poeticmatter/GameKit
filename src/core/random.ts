/**
 * Mulberry32: a small seeded generator built from 32-bit integer operations, so every
 * JavaScript engine produces the same sequence. Games keep the generator's state in
 * their game state, which keeps `applyMove` / `resolveTurn` pure and deterministic:
 * every client that applies the same moves draws the same numbers.
 */

const INCREMENT = 0x6d2b79f5
const UINT32_RANGE = 2 ** 32

export interface RandomDraw {
  /** In [0, 1). */
  value: number
  nextState: number
}

export function nextRandom(state: number): RandomDraw {
  const nextState = (state + INCREMENT) >>> 0
  let mixed = Math.imul(nextState ^ (nextState >>> 15), nextState | 1)
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
  return { value: ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE, nextState }
}

/** An integer in [0, count). */
export function nextIndex(state: number, count: number): { index: number; nextState: number } {
  const { value, nextState } = nextRandom(state)
  return { index: Math.floor(value * count), nextState }
}
