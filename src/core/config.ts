/** Where async play stores games. The anon key is public by design; never pass the service key. */
export interface SupabaseConfig {
  url: string
  anonKey: string
}

/**
 * A game's identity within the lab, defined once in the game's `src/game.config.ts`.
 *
 * `id` must be unique across every lab game: it names the game's Supabase table and
 * functions, prefixes its PeerJS room ids on the public PeerJS server, and prefixes its
 * localStorage keys, so two games can never collide on shared infrastructure.
 */
export interface GameConfig {
  id: string
  title: string
  tagline: string
  /** Null when async play isn't configured; live play and solo playtests still work. */
  supabase: SupabaseConfig | null
}

/** The shape of Vite's `import.meta.env` that matters here. */
export interface SupabaseEnv {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

/** Reads the Supabase settings from a game's environment (`.env.local`). */
export function supabaseFromEnv(env: SupabaseEnv): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  return url && anonKey ? { url, anonKey } : null
}

/** Each game owns one table on the shared Supabase project. */
export const tableNameOf = (config: GameConfig): string => `${config.id}_games`

export const ASYNC_NOT_CONFIGURED_MESSAGE =
  'Async play is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (see .env.example).'
