import { IllegalMoveError } from './IllegalMoveError'
import type { GameRules } from './types'

/**
 * Why `move` can't be undone once played, or null if it can. Asks the game's
 * {@link GameRules.irreversibleReason}; a move the rules would reject is not irreversible,
 * it simply never happens.
 */
export function irreversibleReasonOf<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  state: State,
  move: Move,
): string | null {
  if (!rules.irreversibleReason) return null
  try {
    return rules.irreversibleReason(state, move)
  } catch (err) {
    if (!(err instanceof IllegalMoveError)) throw err
    return null
  }
}

/**
 * Pauses the game to warn the player that `reason` makes their move final, and returns
 * whether they want to go ahead. Uses the browser's own dialog, like quitting a playtest,
 * so nothing else on the page can act while it is open.
 */
export function confirmIrreversible(reason: string): boolean {
  return window.confirm(`${reason}\n\nIf you continue, you won’t be able to undo this move or any before it this turn.`)
}
