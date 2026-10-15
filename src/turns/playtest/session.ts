import { nextIndex } from '../../core/random'
import { disguiseSeats, undisguisedLooks } from '../../core/seatDisguise'
import { applyPlayerMove } from '../moveValidation'
import type { GameRules, MatchSetup, PlayerIndex } from '../types'

/**
 * Hot seat as a solo playtest: one person plays every seat of several tables of the same
 * game, on one device, with nothing saved online.
 *
 * Each turn should be a fresh read of a board, not the continuation of a plan, so the
 * tester never knows where they're about to sit. After every turn they're dealt into a
 * random unfinished table, sometimes the same one again, and the seat they play is
 * disguised as the first seat while the others' looks are shuffled. A finished table
 * shows its real seats.
 */

export type SoloStage =
  /** The board is hidden until the tester is ready for the next deal. */
  | 'between_turns'
  | 'playing'
  /** The table on screen just finished and is shown undisguised. */
  | 'table_over'
  /** The results so far. Reached between turns, so no turn is left half-played. */
  | 'summary'

export interface PlaytestTable<State> {
  state: State
  /** Seats in the order they first took a turn here, i.e. by turn position. */
  turnOrder: PlayerIndex[]
  /** Turns finished at this table. */
  turnCount: number
}

export interface SoloPlaytest<State> {
  tables: PlaytestTable<State>[]
  /** The table on screen. */
  tableIndex: number
  seatCount: number
  /** `looks[seat]` is the seat whose look that seat is drawn with at the table on screen. */
  looks: PlayerIndex[]
  stage: SoloStage
  /** Counts deals, so each one can start with a fresh board. */
  dealCount: number
  randomState: number
  /** How the tester means to play every seat, written before the first turn. */
  strategyNote: string
}

export interface NewPlaytest<Settings> {
  /** One per table: the same settings and player count, each with its own seed. */
  setups: MatchSetup<Settings>[]
  strategyNote: string
  randomState: number
}

interface OpenSeat {
  tableIndex: number
  seat: PlayerIndex
}

function openSeatsOf<Settings, State, Move>(rules: GameRules<Settings, State, Move>, tables: PlaytestTable<State>[]): OpenSeat[] {
  return tables.flatMap((table, tableIndex) => {
    const seat = rules.activePlayer(table.state)
    return seat === null ? [] : [{ tableIndex, seat }]
  })
}

export function openTableCountOf<Settings, State, Move>(rules: GameRules<Settings, State, Move>, session: SoloPlaytest<State>): number {
  return openSeatsOf(rules, session.tables).length
}

function withTurnTaker(turnOrder: PlayerIndex[], seat: PlayerIndex | null): PlayerIndex[] {
  return seat === null || turnOrder.includes(seat) ? turnOrder : [...turnOrder, seat]
}

/** Moves the tester to a random unfinished table, which may be the one they just left. */
export function dealNextTurn<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  session: SoloPlaytest<State>,
): SoloPlaytest<State> {
  if (session.stage === 'playing') return session
  const openSeats = openSeatsOf(rules, session.tables)
  if (openSeats.length === 0) return session

  const draw = nextIndex(session.randomState, openSeats.length)
  const { tableIndex, seat } = openSeats[draw.index]
  const disguise = disguiseSeats(session.seatCount, seat, draw.nextState)
  return {
    ...session,
    tableIndex,
    looks: disguise.looks,
    stage: 'playing',
    dealCount: session.dealCount + 1,
    randomState: disguise.nextState,
  }
}

export function startSoloPlaytest<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  { setups, strategyNote, randomState }: NewPlaytest<Settings>,
): SoloPlaytest<State> {
  if (setups.length === 0) throw new RangeError('A solo playtest needs at least one table.')
  const seatCount = setups[0].playerCount
  const tables = setups.map(setup => {
    const state = rules.createInitialState(setup)
    return { state, turnOrder: withTurnTaker([], rules.activePlayer(state)), turnCount: 0 }
  })
  return dealNextTurn(rules, {
    tables,
    tableIndex: 0,
    seatCount,
    looks: undisguisedLooks(seatCount),
    stage: 'between_turns',
    dealCount: 0,
    randomState,
    strategyNote,
  })
}

/**
 * Applies the move at the table on screen. The tester stays there while the same seat
 * keeps moving, and is taken off the board once the turn passes or the table finishes.
 */
export function playSoloMove<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  session: SoloPlaytest<State>,
  move: Move,
): SoloPlaytest<State> {
  if (session.stage !== 'playing') return session
  const table = session.tables[session.tableIndex]
  const seat = rules.activePlayer(table.state)
  if (seat === null) return session
  const nextState = applyPlayerMove(rules, table.state, seat, move)
  if (nextState === null) return session

  const nextSeat = rules.activePlayer(nextState)
  const isTurnOver = nextSeat !== seat
  const nextTable: PlaytestTable<State> = isTurnOver
    ? { state: nextState, turnOrder: withTurnTaker(table.turnOrder, nextSeat), turnCount: table.turnCount + 1 }
    : { ...table, state: nextState }
  const tables = session.tables.map((current, index) => (index === session.tableIndex ? nextTable : current))

  if (!isTurnOver) return { ...session, tables }
  if (nextSeat === null) return { ...session, tables, stage: 'table_over', looks: undisguisedLooks(session.seatCount) }
  return { ...session, tables, stage: 'between_turns' }
}

export function showSummary<State>(session: SoloPlaytest<State>): SoloPlaytest<State> {
  return session.stage === 'playing' ? session : { ...session, stage: 'summary' }
}
