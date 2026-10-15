import type { UserRole } from './types'

/** Messages between host and guests. The host is authoritative for all state. */
export type PeerMessage<State, Plan> =
  | { type: 'STATE'; state: State; spectatorCount: number }
  | { type: 'ASSIGNED_ROLE'; role: UserRole }
  | { type: 'SUBMIT_PLAN'; plan: Plan }
