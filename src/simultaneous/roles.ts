import { readStored, writeStored } from '../core/browserMemory'
import type { PlayerSlot } from './types'

// The room creator plays as player 1; everyone else who opens an async link is player 2.
// The key format matches the original game-template, so remembered rooms survive a move
// to the kit.

const CREATOR_VALUE = '1'

const roleKey = (gameId: string, code: string) => `${gameId}-role-${code}`

/** Remembers that this browser created the room, so reopening the link resumes as player 1. */
export function rememberRoomCreator(gameId: string, code: string): void {
  writeStored(roleKey(gameId, code), CREATOR_VALUE)
}

export function recallSlot(gameId: string, code: string): PlayerSlot {
  return readStored(roleKey(gameId, code)) === CREATOR_VALUE ? 1 : 2
}
