import { readStored, writeStored } from '../core/browserMemory'
import type { UserRole } from './types'

// The seat this browser holds in each room, so reopening a link resumes it.

const SPECTATOR_VALUE = 'spectator'

const seatKey = (gameId: string, code: string) => `${gameId}-seat-${code}`

export function rememberRole(gameId: string, code: string, role: UserRole): void {
  writeStored(seatKey(gameId, code), String(role))
}

/** The role this browser took in the room before, or null if it never joined. */
export function recallRole(gameId: string, code: string): UserRole | null {
  return parseRole(readStored(seatKey(gameId, code)))
}

export function parseRole(stored: string | null): UserRole | null {
  if (stored === null) return null
  if (stored === SPECTATOR_VALUE) return 'spectator'
  const seat = Number(stored)
  return Number.isInteger(seat) && seat >= 0 ? seat : null
}
