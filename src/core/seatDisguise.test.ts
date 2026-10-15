import { describe, expect, it } from 'vitest'
import { disguiseSeats, PLAYED_SEAT_LOOK } from './seatDisguise'

describe('seat disguise', () => {
  it('draws the played seat as the first seat', () => {
    expect(disguiseSeats(4, 2, 11).looks[2]).toBe(PLAYED_SEAT_LOOK)
  })

  it('gives every seat a different look', () => {
    expect([...disguiseSeats(5, 3, 11).looks].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
  })

  it('shuffles the other seats’ looks', () => {
    const disguises = new Set([1, 2, 3, 4, 5, 6].map(seed => disguiseSeats(4, 1, seed).looks.join()))
    expect(disguises.size).toBeGreaterThan(1)
  })

  it('refuses a seat that isn’t at the table', () => {
    expect(() => disguiseSeats(3, 3, 11)).toThrow(RangeError)
  })
})
