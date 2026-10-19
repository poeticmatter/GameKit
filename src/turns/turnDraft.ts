import { applyPlayerMove } from './moveValidation'
import type { GameRules, PlayerIndex } from './types'

/**
 * An online player's turn in progress. Their moves are played on their own screen first,
 * where they can be undone, and only sent when the turn is ended, or at once for a move
 * that can't be undone (see {@link GameRules.irreversibleReason}). Everyone else keeps
 * seeing the last state that was sent.
 */
export interface TurnDraft<State, Move> {
  /** The state last sent, then the state after each move since. The last is what the board shows. */
  states: State[]
  /** The moves made since the state last sent, in order: `moves[i]` led to `states[i + 1]`. */
  moves: Move[]
  /** The moves have been sent and the draft is waiting to be replaced by the state they produced. */
  isSending: boolean
}

export function startDraft<State, Move>(sent: State): TurnDraft<State, Move> {
  return { states: [sent], moves: [], isSending: false }
}

export function stateOfDraft<State, Move>(draft: TurnDraft<State, Move>): State {
  return draft.states[draft.states.length - 1]
}

/**
 * The draft, if it was made from `sent`, the state now on record. Once any other state
 * has been sent, by this player or anyone else, the draft is out of date and is dropped.
 */
export function draftFor<State, Move>(draft: TurnDraft<State, Move> | null, sent: State | null): TurnDraft<State, Move> | null {
  return draft !== null && sent !== null && draft.states[0] === sent ? draft : null
}

/** Plays the player's move in the draft, or returns null if the rules don't allow it. */
export function playDraftMove<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  draft: TurnDraft<State, Move>,
  player: PlayerIndex,
  move: Move,
): TurnDraft<State, Move> | null {
  if (draft.isSending) return null
  const next = applyPlayerMove(rules, stateOfDraft(draft), player, move)
  return next === null ? null : { ...draft, states: [...draft.states, next], moves: [...draft.moves, move] }
}

export function canUndoDraft<State, Move>(draft: TurnDraft<State, Move> | null): boolean {
  return draft !== null && !draft.isSending && draft.moves.length > 0
}

/** Takes back the last move. */
export function undoDraftMove<State, Move>(draft: TurnDraft<State, Move>): TurnDraft<State, Move> {
  if (!canUndoDraft(draft)) return draft
  return { ...draft, states: draft.states.slice(0, -1), moves: draft.moves.slice(0, -1) }
}

/** The turn can be ended once play has passed to someone else, or the game is over. */
export function canEndDraft<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  draft: TurnDraft<State, Move> | null,
  player: PlayerIndex,
): boolean {
  return draft !== null && !draft.isSending && draft.moves.length > 0 && rules.activePlayer(stateOfDraft(draft)) !== player
}

export function markSending<State, Move>(draft: TurnDraft<State, Move>): TurnDraft<State, Move> {
  return { ...draft, isSending: true }
}
