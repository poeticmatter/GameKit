import type { PlayerIndex, PlayerProfile, UserRole } from './types'

/** Sent by the host, which is authoritative for all state. */
export type HostMessage<State> =
  | { type: 'SNAPSHOT'; state: State; version: number; players: PlayerProfile[]; playerCount: number }
  | { type: 'ROLE'; role: UserRole }

/**
 * Sent by guests. A turn carries the version its moves were made on, so a stale one is
 * refused, and the host answers with a snapshot so the guest catches up.
 */
export type GuestMessage<Move> =
  | { type: 'CLAIM_SEAT'; name: string }
  | { type: 'RESUME_SEAT'; seat: PlayerIndex }
  | { type: 'WATCH' }
  | { type: 'TURN'; version: number; moves: Move[] }
