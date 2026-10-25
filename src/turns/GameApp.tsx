import { useCallback, useState } from 'react'
import { rememberPlayerName } from '../core/browserMemory'
import type { GameConfig } from '../core/config'
import { buildRoomUrl, generateRoomCode, generateSeed, readRoomLinkFromUrl, type RoomLink } from '../core/roomLink'
import { ProgressScreen, StatusScreen } from '../core/screens'
import { undisguised } from '../core/seatDisguise'
import { useTurnTitle } from '../core/useTurnTitle'
import { Lobby, type MatchRequest } from './Lobby'
import { startSoloPlaytest, type SoloPlaytest } from './playtest/session'
import { SoloPlaytestMatch } from './playtest/SoloPlaytestMatch'
import { loadPlaytest } from './playtest/storage'
import { JoinScreen, WaitingForPlayersScreen } from './screens'
import { rememberRole } from './seats'
import { TurnBar } from './TurnBar'
import type { GameModule, MatchConnection, MatchSetup, NewMatch } from './types'
import { useAsyncMatch } from './useAsyncMatch'
import { usePeerGuest } from './usePeerGuest'
import { usePeerHost } from './usePeerHost'
import { useTurnDraft } from './useTurnDraft'

/**
 * A whole turn-based game app: the lobby, then a match over whichever transport was
 * chosen, ending at the game's own Board. Routes on the URL (`?room=CODE[&mode=async]`);
 * solo playtests have no URL and resume from this browser's storage instead.
 */

interface AppProps<Settings, State, Move> {
  config: GameConfig
  game: GameModule<Settings, State, Move>
}

interface RoomProps<Settings, State, Move> extends AppProps<Settings, State, Move> {
  room: RoomLink
}

function isMyTurn<Settings, State, Move>(
  game: GameModule<Settings, State, Move>,
  state: State | null,
  { role, status }: MatchConnection<State, Move>,
) {
  return status === 'playing' && state !== null && role === game.rules.activePlayer(state)
}

/** Maps any online transport's connection to the right screen, ending at the Board. */
function MatchScreen<Settings, State, Move>({
  config,
  game,
  room,
  connection,
}: RoomProps<Settings, State, Move> & { connection: MatchConnection<State, Move> }) {
  const { status, errorMessage, players, playerCount, seatChoice } = connection
  // The player's own turn is played on their screen first; everyone else sees what was sent.
  const turn = useTurnDraft(game.rules, connection)
  const state = turn.state
  useTurnTitle(config.title, isMyTurn(game, state, connection))

  if (status === 'error') return <StatusScreen message={errorMessage ?? 'Connection error.'} />
  if (status === 'disconnected') return <StatusScreen message="Lost connection to the host." />
  if (status === 'reconnecting') return <ProgressScreen title="Connection lost" detail="Reconnecting…" />
  if (!state || playerCount === null) return <ProgressScreen title="Connecting…" />

  const seats = { players, playerCount, appearanceOf: game.playerAppearance }
  if (seatChoice) return <JoinScreen gameId={config.id} seatChoice={seatChoice} {...seats} />
  if (status === 'waiting_for_players') return <WaitingForPlayersScreen room={room} {...seats} />

  return (
    <>
      {turn.actions && <TurnBar {...turn.actions} />}
      <game.Board
        state={state}
        role={connection.role}
        players={players}
        onMove={turn.onMove}
        seating="remote"
        lookOf={undisguised}
      />
    </>
  )
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
  // Solo playtests have no room or URL; the one in progress is kept in this browser.
  const [playtest, setPlaytest] = useState<SoloPlaytest<State> | null>(() =>
    readRoomLinkFromUrl() ? null : loadPlaytest<State>(config.id),
  )

  const createMatch = useCallback(
    ({ settings, playerCount, mode, hostName, tableCount, strategyNote }: MatchRequest<Settings>) => {
      // Same settings everywhere; only the seed differs, so each table deals out differently.
      const newSetup = (): MatchSetup<Settings> => ({ settings, playerCount, seed: generateSeed() })
      // The Create button sits at the bottom of the lobby; start the match at the top.
      window.scrollTo(0, 0)
      if (mode === 'solo_playtest') {
        const setups = Array.from({ length: tableCount }, newSetup)
        setPlaytest(startSoloPlaytest(game.rules, { setups, strategyNote, randomState: generateSeed() }))
        return
      }
      const setup = newSetup()
      const link: RoomLink = { code: generateRoomCode(), transport: mode }
      rememberRole(config.id, link.code, 0)
      rememberPlayerName(config.id, hostName)
      history.replaceState(null, '', buildRoomUrl(link))
      setRoom({ link, newMatch: { setup, initialState: game.rules.createInitialState(setup), hostName } })
    },
    [config.id, game.rules],
  )

  if (playtest) return <SoloPlaytestMatch gameId={config.id} game={game} initialSession={playtest} />
  if (!room) return <Lobby config={config} game={game} onCreateMatch={createMatch} />

  const roomProps = { config, game, room: room.link }
  if (room.link.transport === 'async') return <AsyncMatch {...roomProps} newMatch={room.newMatch} />
  if (room.newMatch) return <LiveHostMatch {...roomProps} newMatch={room.newMatch} />
  return <LiveGuestMatch {...roomProps} />
}
