import type { ComponentType } from 'react'
import type { Seating } from '../core/roomLink'

/**
 * Contracts between the turn-based platform and a game. Players take turns in order:
 * the game names whose decision it awaits, and only that player's moves are applied.
 * A turn may take several moves.
 */

/** A seat at the table, 0-based, in the order players joined. */
export type PlayerIndex = number

export type UserRole = PlayerIndex | 'spectator'

export type ConnectionStatus =
  | 'connecting'
  /** Connected, but this browser hasn't taken a seat or chosen to watch yet. */
  | 'choosing_seat'
  | 'waiting_for_players'
  | 'playing'
  | 'spectating'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

export interface MatchSetup<Settings> {
  settings: Settings
  playerCount: number
  /** Seeds any randomness, so every client derives the same game. */
  seed: number
}

/** Everything the room's creator knows that nobody else does yet. */
export interface NewMatch<Settings, State> {
  setup: MatchSetup<Settings>
  initialState: State
  hostName: string
}

/**
 * Pure game rules. Must be deterministic: in async play the moving client computes the
 * next state and everyone else trusts the stored result. Keep randomness in the state
 * (see nextRandom) so replaying the same moves always gives the same game.
 */
export interface GameRules<Settings, State, Move> {
  createInitialState(setup: MatchSetup<Settings>): State
  /** The player whose move the game awaits, or null once it's over. */
  activePlayer(state: State): PlayerIndex | null
  /** Applies the active player's move. Throws IllegalMoveError if it breaks the rules. */
  applyMove(state: State, move: Move): State
  /**
   * How a finished game ended, for the solo playtest summary. Only called once
   * activePlayer is null; without it the summary can't name winners.
   */
  outcome?(state: State): GameOutcome
  /**
   * Why `move` can't be undone once it is played, or null if it can. Return a message when
   * the move draws on the game's randomness (or reveals anything else the player could use
   * to take back the move and choose differently). The player is warned before such a move
   * and, if they go ahead, it is sent to the other players at once, along with the turn's
   * moves so far; nothing before it can be undone either. `move` may be one the rules would
   * reject, in which case it may throw IllegalMoveError.
   */
  irreversibleReason?(state: State, move: Move): string | null
}

export interface GameOutcome {
  /** Several for a tie; empty if nobody won. */
  winners: PlayerIndex[]
  /** Each seat's final score, in seat order, if the game keeps score. */
  scores?: number[]
}

export interface PlayerProfile {
  name: string
  /** Live play knows who is connected; async play doesn't track it. */
  isOnline?: boolean
}

/** How the kit's own screens show a seat before the game's board appears. */
export interface PlayerAppearance {
  name: string
  color: string
}

export interface SettingsFormProps<Settings> {
  settings: Settings
  playerCount: number
  onChange: (settings: Settings) => void
}

export interface BoardProps<State, Move> {
  state: State
  role: UserRole
  /** In seat order. */
  players: PlayerProfile[]
  onMove: (move: Move) => void
  seating: Seating
  /**
   * The seat whose look (colours, pieces) to draw a seat with. Every seat looks like
   * itself online; in a solo playtest the seat being played looks like seat 0 and
   * the rest are shuffled, so draw every seat-coloured thing through this.
   */
  lookOf: (seat: PlayerIndex) => PlayerIndex
}

export interface GameModule<Settings, State, Move> {
  rules: GameRules<Settings, State, Move>
  minPlayers: number
  maxPlayers: number
  defaultSettings: Settings
  playerAppearance(index: PlayerIndex): PlayerAppearance
  SettingsForm: ComponentType<SettingsFormProps<Settings>>
  Board: ComponentType<BoardProps<State, Move>>
}

/** Offered while a browser that opened a room link decides how to take part. */
export interface SeatChoice {
  claimSeat(name: string): void
  /** Takes back a seat this person already holds, e.g. from another device. */
  resumeSeat(index: PlayerIndex): void
  watch(): void
}

/** What every transport hook returns, so the match screen doesn't care which is in use. */
export interface MatchConnection<State, Move> {
  state: State | null
  role: UserRole
  /** Seats taken so far, in seat order. */
  players: PlayerProfile[]
  /** Null until the match's size is known. */
  playerCount: number | null
  status: ConnectionStatus
  errorMessage: string | null
  /** Non-null only while status is 'choosing_seat'. */
  seatChoice: SeatChoice | null
  /**
   * Sends the moves of one turn, in order, all played by this player. They are applied
   * together, or not at all if any is refused.
   */
  submitMoves: (moves: Move[]) => void
}
