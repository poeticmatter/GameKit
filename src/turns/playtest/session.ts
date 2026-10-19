import { nextIndex } from '../../core/random'
import { disguiseSeats, undisguisedLooks } from '../../core/seatDisguise'
import { irreversibleReasonOf } from '../irreversible'
import { applyPlayerMove } from '../moveValidation'
import type { GameRules, MatchSetup, PlayerIndex } from '../types'

/**
 * Hot seat as a solo playtest: one person plays every seat of several tables of the same
 * game, on one device, with nothing saved online.
 *
 * Each turn should be a fresh read of a board, not the continuation of a plan, so the
 * tester never knows where they're about to sit. Once they end a turn they're dealt
 * straight into a random unfinished table, sometimes the same one again, and the seat
 * they play is disguised as the first seat while the others' looks are shuffled. Moves
 * can be undone until the turn is ended, except those a game says can't be undone (see
 * GameRules.irreversibleReason). A finished table shows its real seats.
 */

export type SoloStage =
  /** The tester moves for the seat they were dealt. */
  | 'playing'
  /** The dealt seat's turn has passed; the tester can still undo it before ending it. */
  | 'turn_over'
  /** The table on screen just finished and is shown undisguised. */
  | 'table_over'
  /** The results so far. Never opened mid-turn, so no turn is left half-played. */
  | 'summary'

export interface PlaytestTable<State> {
  /** As of the last ended turn. */
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
  /**
   * The table on screen as it was dealt, then after each move since. The last is what the
   * board shows; the table itself only takes it when the turn is ended, so moves can be
   * undone until then.
   */
  turnStates: State[]
  /**
   * Index into `turnStates` of the earliest state a move can be undone back to: 0, until a
   * move that can't be undone is made, then that move's own state.
   */
  undoFloor: number
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

function isMidTurn<State>(session: SoloPlaytest<State>): boolean {
  return session.stage === 'playing' || session.stage === 'turn_over'
}

/** The table on screen as the board shows it, including moves not yet ended. */
export function stateOnScreen<State>(session: SoloPlaytest<State>): State {
  return session.turnStates[session.turnStates.length - 1]
}

/**
 * The seat the tester was dealt, or null between turns. It stays theirs once its turn
 * has passed, so the board keeps showing the table from that seat until the turn ends.
 */
export function dealtSeatOf<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  session: SoloPlaytest<State>,
): PlayerIndex | null {
  return isMidTurn(session) ? rules.activePlayer(session.turnStates[0]) : null
}

function hasMovesThisDeal<State>(session: SoloPlaytest<State>): boolean {
  return session.turnStates.length > 1
}

/** Moves the tester to a random unfinished table, which may be the one they just left. */
export function dealNextTurn<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  session: SoloPlaytest<State>,
): SoloPlaytest<State> {
  return isMidTurn(session) ? session : dealAnyTable(rules, session)
}

function dealAnyTable<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  session: SoloPlaytest<State>,
): SoloPlaytest<State> {
  const openSeats = openSeatsOf(rules, session.tables)
  if (openSeats.length === 0) return session

  const draw = nextIndex(session.randomState, openSeats.length)
  const { tableIndex, seat } = openSeats[draw.index]
  const disguise = disguiseSeats(session.seatCount, seat, draw.nextState)
  return {
    ...session,
    tableIndex,
    turnStates: [session.tables[tableIndex].state],
    undoFloor: 0,
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
  return dealAnyTable(rules, {
    tables,
    tableIndex: 0,
    turnStates: [tables[0].state],
    undoFloor: 0,
    seatCount,
    looks: undisguisedLooks(seatCount),
    stage: 'playing',
    dealCount: 0,
    randomState,
    strategyNote,
  })
}

/**
 * Applies the move at the table on screen. The tester stays there while the same seat
 * keeps moving; once the turn passes they can undo or end it, but not move again.
 */
export function playSoloMove<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  session: SoloPlaytest<State>,
  move: Move,
): SoloPlaytest<State> {
  if (session.stage !== 'playing') return session
  const state = stateOnScreen(session)
  const seat = rules.activePlayer(state)
  if (seat === null) return session
  const nextState = applyPlayerMove(rules, state, seat, move)
  if (nextState === null) return session

  const isTurnOver = rules.activePlayer(nextState) !== seat
  // A move that can't be undone makes its own state the furthest back an undo can reach.
  const undoFloor = irreversibleReasonOf(rules, state, move) === null ? session.undoFloor : session.turnStates.length
  return { ...session, turnStates: [...session.turnStates, nextState], undoFloor, stage: isTurnOver ? 'turn_over' : 'playing' }
}

/** Takes back the last move of this deal that can be undone, reopening the turn if that move had passed it. */
export function undoSoloMove<State>(session: SoloPlaytest<State>): SoloPlaytest<State> {
  if (!canUndo(session)) return session
  return { ...session, turnStates: session.turnStates.slice(0, -1), stage: 'playing' }
}

export function canUndo<State>(session: SoloPlaytest<State>): boolean {
  return isMidTurn(session) && session.turnStates.length - 1 > session.undoFloor
}

/**
 * Settles the turn the tester just played at its table, then deals the next one straight
 * away, or shows the table with its real seats if that turn finished it.
 */
export function endSoloTurn<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  session: SoloPlaytest<State>,
): SoloPlaytest<State> {
  if (session.stage !== 'turn_over') return session
  const table = session.tables[session.tableIndex]
  const state = stateOnScreen(session)
  const nextSeat = rules.activePlayer(state)
  const endedTable: PlaytestTable<State> = {
    state,
    turnOrder: withTurnTaker(table.turnOrder, nextSeat),
    turnCount: table.turnCount + 1,
  }
  const ended: SoloPlaytest<State> = {
    ...session,
    tables: session.tables.map((current, index) => (index === session.tableIndex ? endedTable : current)),
    turnStates: [state],
    undoFloor: 0,
  }
  if (nextSeat === null) return { ...ended, stage: 'table_over', looks: undisguisedLooks(session.seatCount) }
  return dealAnyTable(rules, ended)
}

/** The summary may only be seen between turns, never once a move has been made in one. */
export function canShowSummary<State>(session: SoloPlaytest<State>): boolean {
  return session.stage !== 'summary' && session.stage !== 'turn_over' && !hasMovesThisDeal(session)
}

export function showSummary<State>(session: SoloPlaytest<State>): SoloPlaytest<State> {
  return canShowSummary(session) ? { ...session, stage: 'summary' } : session
}
