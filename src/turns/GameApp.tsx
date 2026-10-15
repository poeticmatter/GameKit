import { useCallback, useState } from 'react'
import { rememberPlayerName } from '../core/browserMemory'
import type { GameConfig } from '../core/config'
import { buildRoomUrl, generateRoomCode, generateSeed, readRoomLinkFromUrl, type RoomLink } from '../core/roomLink'
import { ProgressScreen, StatusScreen } from '../core/screens'
import { useTurnTitle } from '../core/useTurnTitle'
import { Lobby, type MatchRequest } from './Lobby'
import { JoinScreen, WaitingForPlayersScreen } from './screens'
import { rememberRole } from './seats'
import type { GameModule, MatchConnection, MatchSetup, NewMatch } from './types'
import { useAsyncMatch } from './useAsyncMatch'
import { useHotSeatMatch } from './useHotSeatMatch'
import { usePeerGuest } from './usePeerGuest'
import { usePeerHost } from './usePeerHost'

/**
 * A whole turn-based game app: the lobby, then a match over whichever transport was
 * chosen, ending at the game's own Board. Routes on the URL (`?room=CODE[&mode=async]`);
 * hot-seat matches have no URL.
 */

interface AppProps<Settings, State, Move> {
  config: GameConfig
  game: GameModule<Settings, State, Move>
}

interface RoomProps<Settings, State, Move> extends AppProps<Settings, State, Move> {
  room: RoomLink
}

function isMyTurn<Settings, State, Move>(game: GameModule<Settings, State, Move>, { state, role, status }: MatchConnection<State, Move>) {
  return status === 'playing' && state !== null && role === game.rules.activePlayer(state)
}

/** Maps any online transport's connection to the right screen, ending at the Board. */
function MatchScreen<Settings, State, Move>({
  config,
  game,
  room,
  connection,
}: RoomProps<Settings, State, Move> & { connection: MatchConnection<State, Move> }) {
  const { state, status, errorMessage, players, playerCount, seatChoice } = connection
  useTurnTitle(config.title, isMyTurn(game, connection))

  if (status === 'error') return <StatusScreen message={errorMessage ?? 'Connection error.'} />
  if (status === 'disconnected') return <StatusScreen message="Lost connection to the host." />
  if (status === 'reconnecting') return <ProgressScreen title="Connection lost" detail="Reconnecting…" />
  if (!state || playerCount === null) return <ProgressScreen title="Connecting…" />

  const seats = { players, playerCount, appearanceOf: game.playerAppearance }
  if (seatChoice) return <JoinScreen gameId={config.id} seatChoice={seatChoice} {...seats} />
  if (status === 'waiting_for_players') return <WaitingForPlayersScreen room={room} {...seats} />

  return <game.Board state={state} role={connection.role} players={players} onMove={connection.submitMove} seating="remote" />
}

function AsyncMatch<Settings, State, Move>(props: RoomProps<Settings, State, Move> & { newMatch: NewMatch<Settings, State> | null }) {
  const { config, game, room, newMatch } = props
  const connection = useAsyncMatch({ config, roomCode: room.code, rules: game.rules, newMatch })
  return <MatchScreen {...props} connection={connection} />
}

function LiveHostMatch<Settings, State, Move>(props: RoomProps<Settings, State, Move> & { newMatch: NewMatch<Settings, State> }) {
  const { config, game, room, newMatch } = props
  const connection = usePeerHost({ config, roomCode: room.code, rules: game.rules, newMatch })
  return <MatchScreen {...props} connection={connection} />
}

function LiveGuestMatch<Settings, State, Move>(props: RoomProps<Settings, State, Move>) {
  const connection = usePeerGuest<State, Move>({ config: props.config, roomCode: props.room.code })
  return <MatchScreen {...props} connection={connection} />
}

function HotSeatMatch<Settings, State, Move>({ game, setup }: { game: GameModule<Settings, State, Move>; setup: MatchSetup<Settings> }) {
  const connection = useHotSeatMatch(game.rules, setup)
  if (!connection.state) return <ProgressScreen title="Starting…" />
  return (
    <game.Board
      state={connection.state}
      role={connection.role}
      players={connection.players}
      onMove={connection.submitMove}
      seating="hot_seat"
    />
  )
}

interface ActiveRoom<Settings, State> {
  link: RoomLink
  /** Present only in the tab that created the room. */
  newMatch: NewMatch<Settings, State> | null
}

export function TurnBasedGameApp<Settings, State, Move>({ config, game }: AppProps<Settings, State, Move>) {
  const [room, setRoom] = useState<ActiveRoom<Settings, State> | null>(() => {
    const link = readRoomLinkFromUrl()
    return link ? { link, newMatch: null } : null
  })
  // Hot-seat matches live only in memory: they have no room and no URL to share or resume.
  const [hotSeatSetup, setHotSeatSetup] = useState<MatchSetup<Settings> | null>(null)

  const createMatch = useCallback(
    ({ settings, playerCount, mode, hostName }: MatchRequest<Settings>) => {
      const setup: MatchSetup<Settings> = { settings, playerCount, seed: generateSeed() }
      // The Create button sits at the bottom of the lobby; start the match at the top.
      window.scrollTo(0, 0)
      if (mode === 'hot_seat') {
        setHotSeatSetup(setup)
        return
      }
      const link: RoomLink = { code: generateRoomCode(), transport: mode }
      rememberRole(config.id, link.code, 0)
      rememberPlayerName(config.id, hostName)
      history.replaceState(null, '', buildRoomUrl(link))
      setRoom({ link, newMatch: { setup, initialState: game.rules.createInitialState(setup), hostName } })
    },
    [config.id, game.rules],
  )

  if (hotSeatSetup) return <HotSeatMatch game={game} setup={hotSeatSetup} />
  if (!room) return <Lobby config={config} game={game} onCreateMatch={createMatch} />

  const roomProps = { config, game, room: room.link }
  if (room.link.transport === 'async') return <AsyncMatch {...roomProps} newMatch={room.newMatch} />
  if (room.newMatch) return <LiveHostMatch {...roomProps} newMatch={room.newMatch} />
  return <LiveGuestMatch {...roomProps} />
}
