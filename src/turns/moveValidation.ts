import { IllegalMoveError } from './IllegalMoveError'
import type { GameRules, PlayerIndex } from './types'

/**
 * Applies `move` if `player` is the one the game is waiting for. Returns null, leaving
 * the state alone, when it's not their turn or the rules reject the move. Any other
 * error is a bug and propagates.
 */
export function applyPlayerMove<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  state: State,
  player: PlayerIndex,
  move: Move,
): State | null {
  const activePlayer = rules.activePlayer(state)
  if (activePlayer !== player) {
    const whoseTurn = activePlayer === null ? 'nobody' : `player ${activePlayer + 1}`
    console.warn(`Ignored a move from player ${player + 1}: it is ${whoseTurn}'s turn.`, move)
    return null
  }
  try {
    return rules.applyMove(state, move)
  } catch (err) {
    if (!(err instanceof IllegalMoveError)) throw err
    console.error(`Rejected an illegal move from player ${player + 1}: ${err.message}`, move)
    return null
  }
}

/**
 * Applies a whole turn's moves, in order, as {@link applyPlayerMove} would one at a time.
 * Returns null, leaving the state alone, if any of them is refused.
 */
export function applyPlayerMoves<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  state: State,
  player: PlayerIndex,
  moves: Move[],
): State | null {
  let current = state
  for (const move of moves) {
    const next = applyPlayerMove(rules, current, player, move)
    if (next === null) return null
    current = next
  }
  return current
}
