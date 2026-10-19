import { describe, expect, it, vi } from 'vitest'
import { IllegalMoveError } from './IllegalMoveError'
import { applyPlayerMove, applyPlayerMoves } from './moveValidation'
import { parseRole } from './seats'
import type { GameRules } from './types'
import { deriveStatus, validRole } from './useAsyncMatch'

// A counting game: the active player adds 1 or 2, then play passes on. Adding 3 is illegal.
interface CountState {
  total: number
  activePlayer: number
}

const countRules: GameRules<null, CountState, number> = {
  createInitialState: () => ({ total: 0, activePlayer: 0 }),
  activePlayer: state => (state.total >= 10 ? null : state.activePlayer),
  applyMove: (state, amount) => {
    if (amount > 2) throw new IllegalMoveError(`Can't add ${amount}`)
    return { total: state.total + amount, activePlayer: (state.activePlayer + 1) % 2 }
  },
}

describe('applying a player’s move', () => {
  const start = countRules.createInitialState({ settings: null, playerCount: 2, seed: 1 })

  it('applies a legal move from the active player', () => {
    expect(applyPlayerMove(countRules, start, 0, 2)).toEqual({ total: 2, activePlayer: 1 })
  })

  it('ignores a move from someone whose turn it isn’t', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(applyPlayerMove(countRules, start, 1, 1)).toBeNull()
  })

  it('rejects an illegal move without throwing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(applyPlayerMove(countRules, start, 0, 3)).toBeNull()
  })

  it('lets unexpected errors through', () => {
    const brokenRules = { ...countRules, applyMove: () => { throw new TypeError('bug') } }
    expect(() => applyPlayerMove(brokenRules, start, 0, 1)).toThrow(TypeError)
  })
})

describe('applying a turn’s moves', () => {
  // The counting game passes play on after every move, so a turn of two moves must be refused.
  const start = countRules.createInitialState({ settings: null, playerCount: 2, seed: 1 })

  it('applies a single move like applyPlayerMove', () => {
    expect(applyPlayerMoves(countRules, start, 0, [2])).toEqual({ total: 2, activePlayer: 1 })
  })

  it('applies no moves as no change', () => {
    expect(applyPlayerMoves(countRules, start, 0, [])).toBe(start)
  })

  it('refuses the whole turn when a later move is refused', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(applyPlayerMoves(countRules, start, 0, [1, 1])).toBeNull()
  })

  it('refuses the whole turn when a move is illegal', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(applyPlayerMoves(countRules, start, 0, [3])).toBeNull()
  })
})

describe('remembered seats', () => {
  it('reads a seat number', () => {
    expect(parseRole('2')).toBe(2)
  })

  it('reads a spectator', () => {
    expect(parseRole('spectator')).toBe('spectator')
  })

  it('ignores anything else', () => {
    expect(parseRole('-1')).toBeNull()
  })

  it('only trusts a seat the room has filled', () => {
    expect(validRole(3, 2)).toBeNull()
  })
})

describe('async match status', () => {
  const room = (seated: number, size: number) => ({ players: Array(seated), player_count: size })

  it('asks a newcomer to choose a seat', () => {
    expect(deriveStatus(room(2, 3), null, null)).toBe('choosing_seat')
  })

  it('waits until every seat is taken', () => {
    expect(deriveStatus(room(2, 3), 0, null)).toBe('waiting_for_players')
  })

  it('plays once the room is full', () => {
    expect(deriveStatus(room(3, 3), 1, null)).toBe('playing')
  })

  it('reports an error over anything else', () => {
    expect(deriveStatus(room(3, 3), 1, 'Offline')).toBe('error')
  })
})
