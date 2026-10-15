import { useState, type ReactNode } from 'react'
import { MAX_PLAYER_NAME_LENGTH, normalizePlayerName, recallPlayerName, rememberPlayerName } from '../core/browserMemory'
import { Button, Card, ColorSwatch, FieldLabel, TextInput } from '../core/controls'
import type { RoomLink } from '../core/roomLink'
import { CenteredScreen, ShareLink } from '../core/screens'
import type { PlayerAppearance, PlayerIndex, PlayerProfile, SeatChoice } from './types'

type AppearanceOf = (index: PlayerIndex) => PlayerAppearance

interface Seats {
  players: PlayerProfile[]
  playerCount: number
  appearanceOf: AppearanceOf
}

/** One row per seat: who sits there, or that it's still open. */
function SeatList({ players, playerCount, appearanceOf, renderAction }: Seats & { renderAction?: (index: PlayerIndex) => ReactNode }) {
  return (
    <ul className="flex w-full flex-col divide-y divide-slot text-left">
      {Array.from({ length: playerCount }, (_, index) => {
        const player = players[index]
        const appearance = appearanceOf(index)
        return (
          <li key={index} className="flex items-center gap-3 py-2">
            <ColorSwatch color={appearance.color} size={18} />
            <span className={`flex-1 ${player ? 'font-semibold' : 'text-ink-faint'}`}>
              {player ? player.name : `Open seat (${appearance.name})`}
            </span>
            {player && renderAction?.(index)}
          </li>
        )
      })}
    </ul>
  )
}

export function WaitingForPlayersScreen({ room, ...seats }: Seats & { room: RoomLink }) {
  const missing = seats.playerCount - seats.players.length
  return (
    <CenteredScreen>
      <h2 className="text-2xl font-bold">
        Waiting for {missing} more {missing === 1 ? 'player' : 'players'}
      </h2>
      <p className="text-sm text-ink-soft">Send them this link. The game starts when every seat is taken.</p>
      <ShareLink room={room} />
      <Card className="w-full max-w-sm">
        <SeatList {...seats} />
      </Card>
    </CenteredScreen>
  )
}

/** Shown to a browser that opened a room link but holds no seat in it yet. */
export function JoinScreen({ gameId, seatChoice, ...seats }: Seats & { gameId: string; seatChoice: SeatChoice }) {
  const [name, setName] = useState(() => recallPlayerName(gameId))
  const nextSeat = seats.players.length
  const hasOpenSeat = nextSeat < seats.playerCount

  function join() {
    const chosenName = normalizePlayerName(name) || `Player ${nextSeat + 1}`
    rememberPlayerName(gameId, chosenName)
    seatChoice.claimSeat(chosenName)
  }

  return (
    <CenteredScreen>
      <h2 className="text-2xl font-bold">{hasOpenSeat ? 'Join the game' : 'This game is full'}</h2>
      <Card className="flex w-full max-w-sm flex-col gap-4">
        {hasOpenSeat && (
          <>
            <label className="flex flex-col gap-1.5 text-left">
              <FieldLabel>Your name</FieldLabel>
              <TextInput value={name} onChange={setName} placeholder={`Player ${nextSeat + 1}`} maxLength={MAX_PLAYER_NAME_LENGTH} />
            </label>
            <Button onClick={join}>Play as {seats.appearanceOf(nextSeat).name}</Button>
          </>
        )}
        <SeatList
          {...seats}
          renderAction={index => (
            <button
              type="button"
              onClick={() => seatChoice.resumeSeat(index)}
              className="text-xs font-semibold text-ink-soft underline hover:text-ink"
            >
              That’s me
            </button>
          )}
        />
        <Button tone="secondary" onClick={seatChoice.watch}>
          Just watch
        </Button>
      </Card>
    </CenteredScreen>
  )
}
