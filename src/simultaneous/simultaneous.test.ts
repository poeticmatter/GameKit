import { describe, expect, it } from 'vitest'
import type { GameRules } from './types'
import { deriveStatus } from './useAsyncMatch'
import { commitPlan, type HotSeatProgress } from './useHotSeatMatch'

// Higher number wins the round.
interface DuelState {
  turn: number
  lastWinner: 1 | 2 | null
}
interface DuelPlan {
  turn: number
  value: number
}

const duelRules: GameRules<null, DuelState, DuelPlan> = {
  createInitialState: () => ({ turn: 1, lastWinner: null }),
  resolveTurn: (state, p1, p2) => ({ turn: state.turn + 1, lastWinner: p1.value === p2.value ? null : p1.value > p2.value ? 1 : 2 }),
}

const start: HotSeatProgress<DuelState, DuelPlan> = {
  state: duelRules.createInitialState(null),
  p1Plan: null,
  activeSlot: 1,
  isHandoffPending: false,
}

describe('hot-seat commits', () => {
  it('hands the device to player 2 after player 1 commits', () => {
    const afterP1 = commitPlan(start, { turn: 1, value: 3 }, duelRules)
    expect(afterP1).toMatchObject({ activeSlot: 2, isHandoffPending: true })
  })

  it('resolves the turn once player 2 commits', () => {
    const afterP1 = { ...commitPlan(start, { turn: 1, value: 3 }, duelRules), isHandoffPending: false }
    const resolved = commitPlan(afterP1, { turn: 1, value: 5 }, duelRules)
    expect(resolved.state).toEqual({ turn: 2, lastWinner: 2 })
  })

  it('ignores a plan made for another turn', () => {
    expect(commitPlan(start, { turn: 7, value: 3 }, duelRules)).toBe(start)
  })

  it('ignores input while the handoff screen is up', () => {
    const waiting = { ...start, isHandoffPending: true }
    expect(commitPlan(waiting, { turn: 1, value: 3 }, duelRules)).toBe(waiting)
  })
})

describe('async match status', () => {
  it('has the creator wait for an opponent', () => {
    expect(deriveStatus({ p2_joined: false }, 1, null)).toBe('waiting_for_partner')
  })

  it('plays once player 2 has joined', () => {
    expect(deriveStatus({ p2_joined: true }, 1, null)).toBe('playing')
  })
})
