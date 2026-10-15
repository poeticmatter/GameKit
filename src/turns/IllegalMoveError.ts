/**
 * Thrown by a game's `applyMove` when a move breaks the rules. Boards only offer legal
 * moves, so this signals a stale or tampered move, or a bug; transports catch it and
 * leave the state unchanged.
 */
export class IllegalMoveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IllegalMoveError'
  }
}
