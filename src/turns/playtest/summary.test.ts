import { describe, expect, it } from 'vitest'
import type { SoloPlaytest } from './session'
import { summarizePlaytest } from './summary'
import { playThrough, startTally, tallyRules, type TallyState } from './tallyGame'

/** A finished table of three, where `turnOrder` lists the seats from first to last. */
function finishedTable(adds: number[], turnOrder: number[]) {
  return { state: { adds, activePlayer: 0 }, turnOrder, turnCount: 6 }
}

function withTables(tables: SoloPlaytest<TallyState>['tables']): SoloPlaytest<TallyState> {
  return { ...startTally(tables.map(() => 0)), tables }
}

describe('playtest summary', () => {
  it('carries the strategy note', () => {
    expect(summarizePlaytest(tallyRules, startTally([0], 'Hoard everything')).strategyNote).toBe('Hoard everything')
  })

  it('lists each table’s seats by turn position', () => {
    const session = playThrough(startTally([1]), ['pass', 'pass', 'add', 'add', 'add'])
    expect(summarizePlaytest(tallyRules, session).tables[0].seats.map(result => result.seat)).toEqual([1, 2, 0])
  })

  it('marks the winners of a finished table', () => {
    const session = playThrough(startTally([1]), ['pass', 'pass', 'add', 'add', 'add'])
    const winners = summarizePlaytest(tallyRules, session).tables[0].seats.filter(result => result.hasWon)
    expect(winners.map(result => result.seat)).toEqual([0])
  })

  it('puts seats yet to play last, with no turn position', () => {
    const seats = summarizePlaytest(tallyRules, startTally([1])).tables[0].seats
    expect(seats.map(result => [result.seat, result.turnPosition])).toEqual([
      [1, 0],
      [0, null],
      [2, null],
    ])
  })

  it('names no winners while a table is in play', () => {
    const seats = summarizePlaytest(tallyRules, startTally([0])).tables[0].seats
    expect(seats.some(result => result.hasWon)).toBe(false)
  })

  it('counts wins by turn position across finished tables', () => {
    const session = withTables([finishedTable([3, 0, 0], [1, 2, 0]), finishedTable([0, 2, 1], [0, 1, 2])])
    expect(summarizePlaytest(tallyRules, session).winsByTurnPosition).toEqual([0, 1, 1])
  })

  it('adds up the turns from every table', () => {
    const session = withTables([finishedTable([3, 0, 0], [1, 2, 0]), finishedTable([0, 2, 1], [0, 1, 2])])
    expect(summarizePlaytest(tallyRules, session).turnCount).toBe(12)
  })

  it('leaves out wins for a game that reports no outcomes', () => {
    const { outcome: _outcome, ...rulesWithoutOutcome } = tallyRules
    const session = withTables([finishedTable([3, 0, 0], [1, 2, 0])])
    expect(summarizePlaytest(rulesWithoutOutcome, session).winsByTurnPosition).toBeNull()
  })
})
