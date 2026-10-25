import { useCallback, useState } from 'react'
import { confirmIrreversible, irreversibleReasonOf } from './irreversible'
import type { TurnActions } from './TurnBar'
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
import type { GameRules, MatchConnection } from './types'

export interface DraftedTurn<State, Move> {
  /** What the board shows: the state on record, or the player's turn so far on top of it. */
  state: State | null
  /** For the board's `onMove`. Plays the move in the draft, or sends the turn if it can't be undone. */
  onMove: (move: Move) => void
  /** Non-null while the player has a turn on their screen. */
  actions: TurnActions | null
}

type Connection<State, Move> = Pick<MatchConnection<State, Move>, 'state' | 'role' | 'status' | 'submitMoves'>

/**
 * Turns an online connection into the solo playtest's way of playing: the player's moves
 * stay on their screen, undoable, until they end their turn, when all of them are sent
 * together.
 * A move that can't be undone (see GameRules.irreversibleReason) first asks the player,
 * then sends the turn so far at once, so it can't be taken back by reloading either.
 */
export function useTurnDraft<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  { state: sent, role, status, submitMoves }: Connection<State, Move>,
): DraftedTurn<State, Move> {
  const [kept, setKept] = useState<TurnDraft<State, Move> | null>(null)
  const draft = draftFor(kept, sent)
  const shown = draft ? stateOfDraft(draft) : sent
  const seat = typeof role === 'number' && status === 'playing' ? role : null

  const send = useCallback(
    (turn: TurnDraft<State, Move>) => {
      submitMoves(turn.moves)
      setKept(markSending(turn))
    },
    [submitMoves],
  )

  const onMove = useCallback(
    (move: Move) => {
      if (seat === null || sent === null) return
      const turn = draft ?? startDraft<State, Move>(sent)
      const current = stateOfDraft(turn)
      if (rules.activePlayer(current) !== seat) return
      const reason = irreversibleReasonOf(rules, current, move)
      if (reason !== null && !confirmIrreversible(reason)) return
      const next = playDraftMove(rules, turn, seat, move)
      if (next === null) return
      if (reason === null) setKept(next)
      else send(next)
    },
    [rules, seat, sent, draft, send],
  )

  const isOnTurn = seat !== null && shown !== null && rules.activePlayer(shown) === seat
  const actions: TurnActions | null =
    seat !== null && (isOnTurn || draft !== null)
      ? {
          canUndo: canUndoDraft(draft),
          canEndTurn: canEndDraft(rules, draft, seat),
          onUndo: () => draft && setKept(undoDraftMove(draft)),
          onEndTurn: () => draft && canEndDraft(rules, draft, seat) && send(draft),
        }
      : null

  return { state: shown, onMove, actions }
}
