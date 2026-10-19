import { afterEach, describe, expect, it, vi } from 'vitest'
import { confirmIrreversible, irreversibleReasonOf } from './irreversible'
import { IllegalMoveError } from './IllegalMoveError'
import { tallyRules, type TallyState } from './playtest/tallyGame'
import {
  canEndDraft,
  canUndoDraft,
  draftFor,
  markSending,
  playDraftMove,
  startDraft,
  stateOfDraft,
  undoDraftMove,
  type TurnDraft,
} from './turnDraft'
import type { TallyMove } from './playtest/tallyGame'

// The tally game: seat 0 starts, may add or roll as often as they like, then passes.

const start: TallyState = { adds: [0, 0, 0], activePlayer: 0 }

function play(draft: TurnDraft<TallyState, TallyMove>, ...moves: TallyMove[]): TurnDraft<TallyState, TallyMove> {
  return moves.reduce((current, move) => {
    const next = playDraftMove(tallyRules, current, 0, move)
    if (!next) throw new Error(`The draft refused ${move}`)
    return next
  }, draft)
}

describe('a turn draft', () => {
  it('shows the state sent until a move is made', () => {
    expect(stateOfDraft(startDraft(start))).toBe(start)
  })

  it('shows each move as soon as it is played', () => {
    expect(stateOfDraft(play(startDraft(start), 'add')).adds).toEqual([1, 0, 0])
  })

  it('keeps the moves in order, for sending', () => {
    expect(play(startDraft(start), 'add', 'add', 'pass').moves).toEqual(['add', 'add', 'pass'])
  })

  it('refuses a move from a player whose turn it is not', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(playDraftMove(tallyRules, startDraft(start), 1, 'add')).toBeNull()
  })

  it('refuses an illegal move', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(playDraftMove(tallyRules, startDraft(start), 0, 'cheat')).toBeNull()
  })

  it('refuses moves while it is being sent', () => {
    expect(playDraftMove(tallyRules, markSending(startDraft(start)), 0, 'add')).toBeNull()
  })
})

describe('undoing in a draft', () => {
  it('has nothing to undo before a move', () => {
    expect(canUndoDraft(startDraft(start))).toBe(false)
  })

  it('takes back the last move', () => {
    const undone = undoDraftMove(play(startDraft(start), 'add', 'add'))
    expect(stateOfDraft(undone).adds).toEqual([1, 0, 0])
    expect(undone.moves).toEqual(['add'])
  })

  it('reopens a turn that the undone move had passed', () => {
    const undone = undoDraftMove(play(startDraft(start), 'add', 'pass'))
    expect(tallyRules.activePlayer(stateOfDraft(undone))).toBe(0)
  })

  it('can go back to the state sent, and no further', () => {
    const undone = undoDraftMove(play(startDraft(start), 'add'))
    expect(stateOfDraft(undone)).toBe(start)
    expect(canUndoDraft(undone)).toBe(false)
  })

  it('can’t undo anything that is already being sent', () => {
    expect(canUndoDraft(markSending(play(startDraft(start), 'add')))).toBe(false)
  })

  it('is not a draft at all when there is no turn on screen', () => {
    expect(canUndoDraft(null)).toBe(false)
  })
})

describe('ending a turn from a draft', () => {
  it('waits for play to pass to someone else', () => {
    expect(canEndDraft(tallyRules, play(startDraft(start), 'add'), 0)).toBe(false)
    expect(canEndDraft(tallyRules, play(startDraft(start), 'add', 'pass'), 0)).toBe(true)
  })

  it('is possible when the move ended the game', () => {
    expect(canEndDraft(tallyRules, play(startDraft(start), 'add', 'add', 'add'), 0)).toBe(true)
  })

  it('needs a move to have been made', () => {
    expect(canEndDraft(tallyRules, startDraft(start), 1)).toBe(false)
  })

  it('can’t be done twice', () => {
    expect(canEndDraft(tallyRules, markSending(play(startDraft(start), 'add', 'pass')), 0)).toBe(false)
  })
})

describe('a draft going out of date', () => {
  it('stands while the state it was made from is still on record', () => {
    const draft = play(startDraft(start), 'add')
    expect(draftFor(draft, start)).toBe(draft)
  })

  it('is dropped once another state is on record', () => {
    const draft = play(startDraft(start), 'add')
    expect(draftFor(draft, { ...start })).toBeNull()
  })

  it('is dropped, along with the board, when nothing is on record', () => {
    expect(draftFor(play(startDraft(start), 'add'), null)).toBeNull()
  })

  it('is absent when there is none', () => {
    expect(draftFor(null, start)).toBeNull()
  })
})

describe('moves that can’t be undone', () => {
  it('give the game’s reason', () => {
    expect(irreversibleReasonOf(tallyRules, start, 'roll')).toBe('Rolling draws at random.')
  })

  it('are only those the game names', () => {
    expect(irreversibleReasonOf(tallyRules, start, 'add')).toBeNull()
  })

  it('are none in a game with no such moves', () => {
    const { irreversibleReason: _, ...plainRules } = tallyRules
    expect(irreversibleReasonOf(plainRules, start, 'roll')).toBeNull()
  })

  it('leave a move the rules reject to be rejected as usual', () => {
    const rules = {
      ...tallyRules,
      irreversibleReason: () => {
        throw new IllegalMoveError('Nope')
      },
    }
    expect(irreversibleReasonOf(rules, start, 'roll')).toBeNull()
  })

  it('let a real bug through', () => {
    const rules = {
      ...tallyRules,
      irreversibleReason: () => {
        throw new TypeError('bug')
      },
    }
    expect(() => irreversibleReasonOf(rules, start, 'roll')).toThrow(TypeError)
  })
})

describe('the warning before a move that can’t be undone', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubConfirm(answer: boolean) {
    const confirm = vi.fn(() => answer)
    vi.stubGlobal('window', { confirm })
    return confirm
  }

  it('gives the game’s reason and says the turn can’t be taken back', () => {
    const confirm = stubConfirm(true)
    confirmIrreversible('Rolling draws at random.')
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Rolling draws at random.'))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('won’t be able to undo'))
  })

  it('lets the player go ahead', () => {
    stubConfirm(true)
    expect(confirmIrreversible('Rolling draws at random.')).toBe(true)
  })

  it('lets the player think again', () => {
    stubConfirm(false)
    expect(confirmIrreversible('Rolling draws at random.')).toBe(false)
  })
})
