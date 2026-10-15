import { describe, expect, it, vi } from 'vitest'
import { dealNextTurn, playSoloMove, showSummary, type SoloPlaytest } from './session'
import { FINAL_TOTAL, playThrough, startTally, tallyRules, type TallyState } from './tallyGame'

/** The table of each of `count` deals in a row, ignoring what's played in between. */
function dealtTables(session: SoloPlaytest<TallyState>, count: number): number[] {
  const tableIndexes: number[] = []
  let current = session
  for (let deal = 0; deal < count; deal++) {
    current = dealNextTurn(tallyRules, { ...current, stage: 'between_turns' })
    tableIndexes.push(current.tableIndex)
  }
  return tableIndexes
}

describe('solo playtest deals', () => {
  it('sits the tester down as the first seat’s look', () => {
    const session = startTally([1, 2])
    const seat = tallyRules.activePlayer(session.tables[session.tableIndex].state)
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
})

describe('solo playtest moves', () => {
  const start = startTally([0, 0])
  const tableOnScreen = (session: SoloPlaytest<TallyState>) => session.tables[session.tableIndex]

  it('keeps the tester at the board while the same seat moves again', () => {
    expect(playSoloMove(tallyRules, start, 'add')).toMatchObject({ stage: 'playing', dealCount: start.dealCount })
  })

  it('takes the tester off the board when the turn passes', () => {
    expect(playSoloMove(tallyRules, start, 'pass').stage).toBe('between_turns')
  })

  it('counts a turn once it passes', () => {
    const afterTurn = playSoloMove(tallyRules, playSoloMove(tallyRules, start, 'add'), 'pass')
    expect(tableOnScreen(afterTurn).turnCount).toBe(1)
  })

  it('records the order seats first take their turns', () => {
    const session = playThrough(startTally([2]), ['pass', 'pass', 'pass'])
    expect(tableOnScreen(session).turnOrder).toEqual([2, 0, 1])
  })

  it('shows a finished table with its real seats', () => {
    expect(playThrough(start, ['add', 'add', 'add'])).toMatchObject({ stage: 'table_over', looks: [0, 1, 2] })
  })

  it('only changes the table on screen', () => {
    const otherTable = 1 - start.tableIndex
    expect(playSoloMove(tallyRules, start, 'add').tables[otherTable]).toBe(start.tables[otherTable])
  })

  it('ignores an illegal move', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(playSoloMove(tallyRules, start, 'cheat')).toBe(start)
  })

  it('ignores moves between turns', () => {
    const betweenTurns = playSoloMove(tallyRules, start, 'pass')
    expect(playSoloMove(tallyRules, betweenTurns, 'add')).toBe(betweenTurns)
  })
})

describe('solo playtest summary stage', () => {
  const start = startTally([0, 0])

  it('opens between turns', () => {
    expect(showSummary(playSoloMove(tallyRules, start, 'pass')).stage).toBe('summary')
  })

  it('never interrupts a turn', () => {
    expect(showSummary(start)).toBe(start)
  })

  it('lets the tester keep playing', () => {
    const summary = showSummary(playSoloMove(tallyRules, start, 'pass'))
    expect(dealNextTurn(tallyRules, summary).stage).toBe('playing')
  })
})
