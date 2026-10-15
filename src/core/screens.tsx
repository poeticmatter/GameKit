import { useState, type ReactNode } from 'react'
import { Button, Card, FieldLabel, SegmentedControl } from './controls'
import type { GameConfig } from './config'
import { buildRoomUrl, type PlayMode, type RoomLink } from './roomLink'

export function returnToLobby() {
  window.location.href = window.location.pathname
}

export function CenteredScreen({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">{children}</div>
}

export function StatusScreen({ message }: { message: string }) {
  return (
    <CenteredScreen>
      <p className="text-lg text-ink-soft">{message}</p>
      <Button tone="secondary" onClick={returnToLobby}>
        Back to lobby
      </Button>
    </CenteredScreen>
  )
}

export function ProgressScreen({ title, detail }: { title: string; detail?: string }) {
  return (
    <CenteredScreen>
      <p className="text-lg font-semibold">{title}</p>
      {detail && <p className="animate-pulse text-sm text-ink-soft">{detail}</p>}
    </CenteredScreen>
  )
}

export function ShareLink({ room }: { room: RoomLink }) {
  const shareUrl = buildRoomUrl(room)
  const [isCopied, setIsCopied] = useState(false)
  function copy() {
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => setIsCopied(true))
      .catch(err => console.warn('Could not copy the room link; select it by hand instead.', err))
  }
  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <div className="flex items-center gap-2">
        <code className="flex-1 select-all break-all rounded-lg border border-rule bg-paper px-3 py-2 text-left text-sm">
          {shareUrl}
        </code>
        <Button tone="secondary" onClick={copy}>
          {isCopied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="font-mono text-xs text-ink-faint">Room {room.code}</p>
    </div>
  )
}

const PLAY_MODES: PlayMode[] = ['async', 'live', 'hot_seat']

const PLAY_MODE_TEXT: Record<PlayMode, { label: string; description: string }> = {
  async: {
    label: 'Async',
    description: 'Take your turn whenever you like. The game is saved online, so share the link and come back later.',
  },
  live: {
    label: 'Live',
    description: 'Everyone plays at the same time over direct peer-to-peer links. The game ends if the host closes the tab.',
  },
  hot_seat: {
    label: 'Hot Seat',
    description: 'Every seat is played on this device. Nothing is saved online.',
  },
}

export function PlayModeField({ config, mode, onChange }: { config: GameConfig; mode: PlayMode; onChange: (mode: PlayMode) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>Play mode</FieldLabel>
      <SegmentedControl<PlayMode> options={PLAY_MODES} value={mode} onChange={onChange} labelOf={option => PLAY_MODE_TEXT[option].label} />
      <p className="text-xs leading-relaxed text-ink-soft">{PLAY_MODE_TEXT[mode].description}</p>
      {mode === 'async' && !config.supabase && (
        <p className="text-xs leading-relaxed text-alert">Async play needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.</p>
      )}
    </div>
  )
}

/** The lobby's frame: the game's name, a card of fields, and the Create button. */
export function LobbyShell({
  config,
  canCreate,
  onCreate,
  children,
}: {
  config: GameConfig
  canCreate: boolean
  onCreate: () => void
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight">{config.title}</h1>
        <p className="max-w-sm text-sm leading-relaxed text-ink-soft">{config.tagline}</p>
      </div>
      <Card className="flex w-full max-w-sm flex-col gap-5">{children}</Card>
      <Button onClick={onCreate} disabled={!canCreate} className="px-10 py-3 text-lg">
        Create game
      </Button>
    </div>
  )
}

export const isModeAvailable = (config: GameConfig, mode: PlayMode): boolean => mode !== 'async' || config.supabase !== null
