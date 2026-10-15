import { describe, expect, it, vi } from 'vitest'
import {
  canUndo,
  dealNextTurn,
  dealtSeatOf,
  endSoloTurn,
  playSoloMove,
  showSummary,
  stateOnScreen,
  undoSoloMove,
  type SoloPlaytest,
} from './session'
import { FINAL_TOTAL, playThrough, startTally, tallyRules, type TallyMove, type TallyState } from './tallyGame'

/** The table of each of `count` deals in a row, ignoring what's played in between. */
function dealtTables(session: SoloPlaytest<TallyState>, count: number): number[] {
  const tableIndexes: number[] = []
  let current = session
  for (let deal = 0; deal < count; deal++) {
    current = dealNextTurn(tallyRules, { ...current, stage: 'summary' })
    tableIndexes.push(current.tableIndex)
  }
  return tableIndexes
}

function playMoves(session: SoloPlaytest<TallyState>, moves: TallyMove[]): SoloPlaytest<TallyState> {
  return moves.reduce((current, move) => playSoloMove(tallyRules, current, move), session)
}

describe('solo playtest deals', () => {
  it('sits the tester down as the first seat’s look', () => {
    const session = startTally([1, 2])
    const seat = tallyRules.activePlayer(stateOnScreen(session))
    expect(seat === null ? null : session.looks[seat]).toBe(0)
  })

  it('visits every table', () => {
    expect(new Set(dealtTables(startTally([0, 0, 0]), 60))).toEqual(new Set([0, 1, 2]))
  })

  it('sometimes deals the same table twice in a row', () => {
    const tables = dealtTables(startTally([0, 0, 0]), 60)
    expect(tables.some((table, deal) => table === tables[deal + 1])).toBe(true)
  })

  it('skips finished tables', () => {
    const session = startTally([0, 0])
    const [first, second] = session.tables
    const firstTableOver = { ...session, tables: [{ ...first, state: { ...first.state, adds: [FINAL_TOTAL, 0, 0] } }, second] }
    expect(new Set(dealtTables(firstTableOver, 20))).toEqual(new Set([1]))
  })

  it('deals nothing once every table is over', () => {
    const over = playThrough(startTally([0]), ['add', 'add', 'add'])
    expect(dealNextTurn(tallyRules, over)).toBe(over)
  })

  it('never deals mid-turn', () => {
    const start = startTally([0, 0])
    expect(dealNextTurn(tallyRules, start)).toBe(start)
  })
})

describe('solo playtest moves', () => {
  const start = startTally([0, 0])

  it('keeps the tester at the board while the same seat moves again', () => {
    expect(playSoloMove(tallyRules, start, 'add')).toMatchObject({ stage: 'playing', dealCount: start.dealCount })
  })

  it('shows the move on the board', () => {
    const seat = tallyRules.activePlayer(stateOnScreen(start)) ?? -1
    expect(stateOnScreen(playSoloMove(tallyRules, start, 'add')).adds[seat]).toBe(1)
  })

  it('waits for the tester to end a turn that has passed', () => {
    expect(playSoloMove(tallyRules, start, 'pass').stage).toBe('turn_over')
  })

  it('keeps the tester in the dealt seat after its turn passes', () => {
    expect(dealtSeatOf(tallyRules, playSoloMove(tallyRules, start, 'pass'))).toBe(tallyRules.activePlayer(stateOnScreen(start)))
  })

  it('takes no more moves once the turn has passed', () => {
    const turnOver = playSoloMove(tallyRules, start, 'pass')
    expect(playSoloMove(tallyRules, turnOver, 'add')).toBe(turnOver)
  })

  it('leaves the table alone until the turn is ended', () => {
    expect(playSoloMove(tallyRules, start, 'add').tables).toBe(start.tables)
  })

  it('ignores an illegal move', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(playSoloMove(tallyRules, start, 'cheat')).toBe(start)
  })
})

describe('solo playtest undo', () => {
  const start = startTally([0, 0])

  it('takes back the last move', () => {
    expect(stateOnScreen(undoSoloMove(playMoves(start, ['add', 'add'])))).toEqual(stateOnScreen(playMoves(start, ['add'])))
  })

  it('reopens a turn that the undone move had passed', () => {
    expect(undoSoloMove(playMoves(start, ['add', 'pass'])).stage).toBe('playing')
  })

  it('has nothing to undo before the first move', () => {
    expect(canUndo(start)).toBe(false)
  })

  it('can’t reach back past an ended turn', () => {
    const nextDeal = endSoloTurn(tallyRules, playMoves(start, ['add', 'pass']))
    expect(canUndo(nextDeal)).toBe(false)
  })
})

describe('solo playtest turn end', () => {
  const start = startTally([0, 0])

  it('deals the next turn straight away', () => {
    expect(endSoloTurn(tallyRules, playMoves(start, ['pass']))).toMatchObject({ stage: 'playing', dealCount: start.dealCount + 1 })
  })

  it('does nothing while the seat can still move', () => {
    const midTurn = playMoves(start, ['add'])
    expect(endSoloTurn(tallyRules, midTurn)).toBe(midTurn)
  })

  it('counts the ended turn at its table', () => {
    const ended = endSoloTurn(tallyRules, playMoves(start, ['add', 'pass']))
    expect(ended.tables[start.tableIndex].turnCount).toBe(1)
  })

  it('records the order seats first take their turns', () => {
    const session = playThrough(startTally([2]), ['pass', 'pass', 'pass'])
    expect(session.tables[0].turnOrder).toEqual([2, 0, 1])
  })

  it('shows a finished table with its real seats', () => {
    const finished = endSoloTurn(tallyRules, playMoves(start, ['add', 'add', 'add']))
    expect(finished).toMatchObject({ stage: 'table_over', looks: [0, 1, 2] })
  })

  it('only changes the table on screen', () => {
    const otherTable = 1 - start.tableIndex
    expect(endSoloTurn(tallyRules, playMoves(start, ['pass'])).tables[otherTable]).toBe(start.tables[otherTable])
  })
})

describe('solo playtest summary stage', () => {
  const start = startTally([0, 0])

  it('opens before a move is made', () => {
    expect(showSummary(start).stage).toBe('summary')
  })

  it('never interrupts a turn under way', () => {
    const midTurn = playMoves(start, ['add'])
    expect(showSummary(midTurn)).toBe(midTurn)
  })

  it('lets the tester keep playing', () => {
    expect(dealNextTurn(tallyRules, showSummary(start)).stage).toBe('playing')
  })
})
