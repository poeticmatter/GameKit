import type { ComponentType } from 'react'
import type { Seating } from '../core/roomLink'

/**
 * Contracts between the simultaneous platform and a game. Two players each commit a
 * plan for the turn without seeing the other's, then the turn resolves.
 *
 * The names match the original game-template platform, so a game built on it can move
 * to the kit by changing its imports.
 */

export type PlayerSlot = 1 | 2

export type UserRole = PlayerSlot | 'spectator'

export type ConnectionStatus =
  | 'connecting'
  | 'waiting_for_partner'
  | 'playing'
  | 'spectating'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

/** Every game state carries a turn counter; transports use it to reject stale plans. */
export interface TurnBasedState {
  turn: number
}

/** Every plan is stamped with the turn it was made for. */
export interface TurnPlan {
  turn: number
}

/**
 * Pure game rules. Both players commit a plan simultaneously, then
 * {@link GameRules.resolveTurn} produces the next state. Must be deterministic: in async
 * play two clients may resolve the same turn and must agree on the result.
 */
export interface GameRules<Settings, State extends TurnBasedState, Plan extends TurnPlan> {
  createInitialState(settings: Settings): State
  resolveTurn(state: State, p1Plan: Plan, p2Plan: Plan): State
}

export interface SettingsFormProps<Settings> {
  settings: Settings
  onChange: (settings: Settings) => void
}

export interface BoardProps<State, Plan> {
  state: State
  role: UserRole
  /** True once this player has committed a plan for the current turn. */
  hasCommitted: boolean
  onSubmitPlan: (plan: Plan) => void
  seating: Seating
}

export interface GameModule<Settings, State extends TurnBasedState, Plan extends TurnPlan> {
  rules: GameRules<Settings, State, Plan>
  defaultSettings: Settings
  SettingsForm: ComponentType<SettingsFormProps<Settings>>
  Board: ComponentType<BoardProps<State, Plan>>
}

/** What every transport hook returns, so the match screen doesn't care which is in use. */
export interface MatchConnection<State, Plan> {
  state: State | null
  role: UserRole
  status: ConnectionStatus
  errorMessage: string | null
  hasCommitted: boolean
  spectatorCount: number
  submitPlan: (plan: Plan) => void
}
