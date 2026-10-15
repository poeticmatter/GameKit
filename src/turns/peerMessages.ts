import type { PlayerIndex, PlayerProfile, UserRole } from './types'

/** Sent by the host, which is authoritative for all state. */
export type HostMessage<State> =
  | { type: 'SNAPSHOT'; state: State; version: number; players: PlayerProfile[]; playerCount: number }
  | { type: 'ROLE'; role: UserRole }

/** Sent by guests. Moves carry the version they were made on, so stale ones are dropped. */
export type GuestMessage<Move> =
  | { type: 'CLAIM_SEAT'; name: string }
  | { type: 'RESUME_SEAT'; seat: PlayerIndex }
  | { type: 'WATCH' }
  | { type: 'MOVE'; version: number; move: Move }
