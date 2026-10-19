import type { MatchTable } from '../core/matchTable'
import type { NewMatch, PlayerIndex, PlayerProfile } from './types'

/**
 * Database I/O for turn-based async play. The table stores data only: the active
 * player's client applies each move with the game's pure rules and writes the result.
 * The table's shape is in the turn template's supabase/migrations/.
 *
 * Error policy: every Supabase `error` is thrown; useAsyncMatch is the handling
 * boundary. A missing row on {@link loadMatch} is normal and returns null.
 */

export interface MatchRow<Settings, State> {
  id: string
  settings: Settings
  player_count: number
  players: PlayerProfile[]
  state: State
  /** Counts sent turns (and moves sent early, see GameRules.irreversibleReason); guards every state write. */
  version: number
}

/** Seats are claimed by a database function so two people joining at once can't collide. */
const claimSeatFunctionOf = (table: MatchTable) => `${table.gameId}_claim_seat`

/**
 * Creates the match row with the host in seat 0, unless it already exists. Idempotent,
 * so a double-invoked effect (React StrictMode) or a host reopening the link can't
 * reset a game.
 */
export async function createMatch<Settings, State>(table: MatchTable, code: string, match: NewMatch<Settings, State>): Promise<void> {
  const { error } = await table.client.from(table.name).upsert(
    {
      id: code,
      settings: match.setup.settings,
      player_count: match.setup.playerCount,
      players: [{ name: match.hostName }],
      state: match.initialState,
      version: 0,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) throw error
}

export async function loadMatch<Settings, State>(table: MatchTable, code: string): Promise<MatchRow<Settings, State> | null> {
  const { data, error } = await table.client.from(table.name).select('*').eq('id', code).maybeSingle()
  if (error) throw error
  // The client is untyped (no generated schema); rows are only ever written by this module.
  return data as MatchRow<Settings, State> | null
}

/** Takes the next free seat. Returns null when the room is full or doesn't exist. */
export async function claimSeat(table: MatchTable, code: string, name: string): Promise<PlayerIndex | null> {
  const { data, error } = await table.client.rpc(claimSeatFunctionOf(table), { room_id: code, player_name: name })
  if (error) throw error
  return typeof data === 'number' ? data : null
}

/**
 * Stores the state after a turn's moves, guarded on the version it was computed from.
 * Returns false when the stored version has moved on, so nothing was written.
 */
export async function saveMove<State>(table: MatchTable, code: string, fromVersion: number, nextState: State): Promise<boolean> {
  const { data, error } = await table.client
    .from(table.name)
    .update({ state: nextState, version: fromVersion + 1, updated_at: new Date().toISOString() })
    .eq('id', code)
    .eq('version', fromVersion)
    .select('version')
  if (error) throw error
  return data.length > 0
}
