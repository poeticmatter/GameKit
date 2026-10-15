import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ASYNC_NOT_CONFIGURED_MESSAGE, tableNameOf, type GameConfig, type SupabaseConfig } from './config'

/** A game's table on the shared Supabase project, plus the client to reach it. */
export interface MatchTable {
  client: SupabaseClient
  name: string
  gameId: string
}

let cachedClient: { config: SupabaseConfig; client: SupabaseClient } | null = null

/** One client per page, created on first use so live and hot-seat play never touch Supabase. */
function clientFor(config: SupabaseConfig): SupabaseClient {
  if (cachedClient?.config.url !== config.url || cachedClient.config.anonKey !== config.anonKey) {
    cachedClient = { config, client: createClient(config.url, config.anonKey) }
  }
  return cachedClient.client
}

class AsyncNotConfiguredError extends Error {
  constructor() {
    super(ASYNC_NOT_CONFIGURED_MESSAGE)
    this.name = 'AsyncNotConfiguredError'
  }
}

/** Throws when the game has no Supabase settings; check `config.supabase` first to avoid it. */
export function matchTableOf(config: GameConfig): MatchTable {
  if (!config.supabase) throw new AsyncNotConfiguredError()
  return { client: clientFor(config.supabase), name: tableNameOf(config), gameId: config.id }
}

/** Supabase returns plain error objects, not Error instances; this reads either. */
export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) return String(err.message)
  return 'Connection error.'
}
