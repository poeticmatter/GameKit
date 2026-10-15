import { describe, expect, it } from 'vitest'
import { nextIndex, nextRandom } from './random'

function sequence(seed: number, length: number): number[] {
  const values: number[] = []
  let state = seed
  for (let i = 0; i < length; i++) {
    const draw = nextRandom(state)
    values.push(draw.value)
    state = draw.nextState
  }
  return values
}

describe('seeded random', () => {
  it('repeats the same sequence from the same seed', () => {
    expect(sequence(42, 20)).toEqual(sequence(42, 20))
  })

  it('gives different sequences for different seeds', () => {
    expect(sequence(1, 5)).not.toEqual(sequence(2, 5))
  })

  it('stays in [0, 1)', () => {
    expect(sequence(7, 1000).every(value => value >= 0 && value < 1)).toBe(true)
  })

  it('picks indexes inside the range', () => {
    let state = 99
    const indexes = Array.from({ length: 600 }, () => {
      const { index, nextState } = nextIndex(state, 6)
      state = nextState
      return index
    })
    expect(new Set(indexes)).toEqual(new Set([0, 1, 2, 3, 4, 5]))
  })
})
