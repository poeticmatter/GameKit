import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LobbyShell, PlayModeField } from './core/screens'
import { HandoffScreen } from './simultaneous/screens'
import { JoinScreen } from './turns/screens'

// Render checks for the kit's own screens. No browser: localStorage is missing, which
// the kit treats as "nothing remembered".

const config = { id: 'test', title: 'Test Game', tagline: 'A game for tests.', supabase: null }
const appearanceOf = (index: number) => ({ name: ['Red', 'Blue', 'Green'][index], color: '#000' })
const seatChoice = { claimSeat: () => {}, resumeSeat: () => {}, watch: () => {} }

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('shared screens', () => {
  it('shows the game’s title in the lobby', () => {
    expect(renderToStaticMarkup(<LobbyShell config={config} canCreate onCreate={() => {}}>fields</LobbyShell>)).toContain('Test Game')
  })

  it('warns when async play has no Supabase settings', () => {
    expect(renderToStaticMarkup(<PlayModeField config={config} mode="async" onChange={() => {}} />)).toContain('VITE_SUPABASE_URL')
  })
})

describe('turn-based join screen', () => {
  it('offers the next open seat', () => {
    const html = renderToStaticMarkup(
      <JoinScreen gameId="test" seatChoice={seatChoice} players={[{ name: 'Ana' }]} playerCount={3} appearanceOf={appearanceOf} />,
    )
    expect(html).toContain('Play as Blue')
  })

  it('says when the game is full', () => {
    const html = renderToStaticMarkup(
      <JoinScreen gameId="test" seatChoice={seatChoice} players={[{ name: 'Ana' }, { name: 'Ben' }]} playerCount={2} appearanceOf={appearanceOf} />,
    )
    expect(html).toContain('This game is full')
  })
})

describe('simultaneous handoff', () => {
  it('names the player whose plan comes next', () => {
    expect(renderToStaticMarkup(<HandoffScreen slot={2} onReady={() => {}} />)).toContain('Next: Player 2')
  })
})
