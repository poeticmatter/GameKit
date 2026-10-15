import { describe, expect, it } from 'vitest'
import { supabaseFromEnv, tableNameOf } from './config'

describe('game config', () => {
  it('reads Supabase settings when both are set', () => {
    expect(supabaseFromEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'key' })).toEqual({
      url: 'https://x.supabase.co',
      anonKey: 'key',
    })
  })

  it('leaves async play off when a setting is missing', () => {
    expect(supabaseFromEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull()
  })

  it('names the table after the game id', () => {
    expect(tableNameOf({ id: 'votes', title: 'Votes', tagline: '', supabase: null })).toBe('votes_games')
  })
})
