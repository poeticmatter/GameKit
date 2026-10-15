import type { GameOutcome, GameRules, PlayerIndex } from '../types'
import type { PlaytestTable, SoloPlaytest } from './session'

// What a playtest showed: every table by turn position, so a seat's real advantage shows
// even when the game picks the first player at random.

export interface SeatResult {
  seat: PlayerIndex
  /** 0 for the seat that took the first turn; null if the seat hasn't had a turn yet. */
  turnPosition: number | null
  /** Null while the table is in play or when the game keeps no score. */
  score: number | null
  hasWon: boolean
}

export interface TableSummary {
  turnCount: number
  isOver: boolean
  /** By turn position; seats yet to play come last, in seat order. */
  seats: SeatResult[]
}

export interface PlaytestSummary {
  strategyNote: string
  turnCount: number
  tables: TableSummary[]
  /**
   * Finished tables won by the seat at each turn position; a tie counts for every winner.
   * Null when the game reports no outcomes or no table has finished.
   */
  winsByTurnPosition: number[] | null
}

function summarizeTable<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  table: PlaytestTable<State>,
  seatCount: number,
): TableSummary {
  const isOver = rules.activePlayer(table.state) === null
  const outcome: GameOutcome | null = isOver && rules.outcome ? rules.outcome(table.state) : null
  const seatsYetToPlay = Array.from({ length: seatCount }, (_, seat) => seat).filter(seat => !table.turnOrder.includes(seat))
  const seats = [...table.turnOrder, ...seatsYetToPlay].map(seat => {
    const turnPosition = table.turnOrder.indexOf(seat)
    return {
      seat,
      turnPosition: turnPosition === -1 ? null : turnPosition,
      score: outcome?.scores?.[seat] ?? null,
      hasWon: outcome?.winners.includes(seat) ?? false,
    }
  })
  return { turnCount: table.turnCount, isOver, seats }
}

function countWinsByTurnPosition(tables: TableSummary[], seatCount: number): number[] | null {
  const finishedTables = tables.filter(table => table.isOver)
  if (finishedTables.length === 0) return null
  const wins = new Array<number>(seatCount).fill(0)
  for (const { seats } of finishedTables) {
    for (const { turnPosition, hasWon } of seats) {
      if (hasWon && turnPosition !== null) wins[turnPosition] += 1
    }
  }
  return wins
}

export function summarizePlaytest<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  session: SoloPlaytest<State>,
): PlaytestSummary {
  const tables = session.tables.map(table => summarizeTable(rules, table, session.seatCount))
  return {
    strategyNote: session.strategyNote,
    turnCount: tables.reduce((total, table) => total + table.turnCount, 0),
    tables,
    winsByTurnPosition: rules.outcome ? countWinsByTurnPosition(tables, session.seatCount) : null,
  }
}
